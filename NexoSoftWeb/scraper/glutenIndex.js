import { fetchPage } from './http.js'
import { decodeEntities, extractJsonLd, htmlToText, normalizeKey } from './parse.js'
import { dedupe, readCache, writeCache } from './store.js'

const BASE = 'https://www.celimap.com.ar'
const MAX_PAGES = 8

const BARRIOS = [
  'Palermo',
  'Caballito',
  'Belgrano',
  'Recoleta',
  'San Nicolás',
  'Villa Crespo',
  'Villa Urquiza',
  'Monserrat',
  'Flores',
  'Almagro',
  'Balvanera',
  'Barracas',
  'La Boca',
  'Retiro',
  'Núñez',
  'San Telmo',
  'Puerto Madero',
  'Colegiales',
  'Chacarita',
  'Villa Devoto',
  'Liniers',
  'Mataderos',
  'Saavedra',
  'Floresta',
  'Constitución',
  'Villa del Parque',
  'Villa Luro',
  'Boedo',
  'Parque Patricios',
  'Coghlan',
  'Paternal',
  'Agronomía',
  'Villa Ortúzar',
  'Villa Pueyrredón',
  'Villa Real',
  'Versalles',
  'Vélez Sársfield',
  'Parque Chacabuco',
  'Nueva Pompeya',
  'Villa Lugano',
  'Villa Riachuelo',
  'Villa Soldati',
  'Barrio Norte',
]

const CABA = /ciudad autonoma|capital federal|\bcaba\b|buenos aires/

/**
 * CeliMap groups places by city slug, with CABA under "buenos-aires" and an
 * optional barrio filter that keeps the listing short.
 */
function targetFor(area) {
  const key = normalizeKey(area)
  if (!key) return null

  const barrio = BARRIOS.find((name) => key.includes(normalizeKey(name)))
  if (barrio || CABA.test(key)) return { slug: 'buenos-aires', barrio: barrio || '' }

  const slug = key
    .split(',')[0]
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug ? { slug, barrio: '' } : null
}

/**
 * Each card links to /lugar/<slug> and shows its badges nearby. A card often
 * links twice (image and title), so the flags of every block with the same
 * slug are merged.
 */
function flagsBySlug(html) {
  const flags = new Map()
  const parts = String(html).split('href="/lugar/')
  for (const part of parts.slice(1)) {
    const slug = part.slice(0, part.indexOf('"'))
    const block = htmlToText(part.slice(0, 4000))
    const previous = flags.get(slug) || { dedicated: false, certified: false, options: false }
    flags.set(slug, {
      dedicated: previous.dedicated || /100\s*%\s*(?:sin|libre de)\s*gluten/i.test(block),
      certified: previous.certified || /insumos certificados/i.test(block),
      options: previous.options || /tiene opciones/i.test(block),
    })
  }
  return flags
}

function parseListing(html) {
  const flags = flagsBySlug(html)
  const lists = extractJsonLd(html).filter((node) => String(node['@type']) === 'ItemList')
  const entries = []

  for (const item of lists.flatMap((list) => list.itemListElement || [])) {
    const place = item?.item
    const url = place?.url
    const name = decodeEntities(place?.name || '').trim()
    if (!url || !name) continue
    const slug = url.split('/lugar/')[1] || ''
    entries.push({
      name,
      address: decodeEntities(place?.address?.streetAddress || '').trim(),
      url,
      ...(flags.get(slug) || { dedicated: false, certified: false, options: true }),
    })
  }
  return entries
}

async function loadIndex({ slug, barrio }) {
  const key = `celimap:${slug}:${barrio}`
  const cached = readCache(key)
  if (cached) return cached

  const pageUrl = (page) => {
    const query = [barrio ? `barrio=${encodeURIComponent(barrio)}` : '', page > 1 ? `page=${page}` : '']
      .filter(Boolean)
      .join('&')
    return `${BASE}/sin-gluten/${slug}${query ? `?${query}` : ''}`
  }

  return dedupe(key, async () => {
    const first = await fetchPage(pageUrl(1), { timeoutMs: 14000, retries: 1 })
    const entries = first ? parseListing(first) : []
    if (entries.length >= 10) {
      // The listing is paginated ten by ten; one host, so the bucket paces it.
      const rest = await Promise.all(
        Array.from({ length: MAX_PAGES - 1 }, (_, index) =>
          fetchPage(pageUrl(index + 2), { timeoutMs: 14000, retries: 1 }),
        ),
      )
      for (const html of rest) {
        if (!html) continue
        entries.push(...parseListing(html))
      }
    }
    const index = { slug, barrio, entries }
    writeCache(key, index)
    return index
  })
}

function streetParts(address) {
  const number = (String(address).match(/\b\d{2,5}\b/) || [])[0] || ''
  const streets = normalizeKey(address)
    .replace(/\b\d+\b/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 4 && !/^(avenida|calle|general|presidente|teniente|doctor)$/.test(token))
  return { number, streets }
}

function sameAddress(a, b) {
  const left = streetParts(a)
  if (!left.number || !left.streets.length) return false
  const hay = normalizeKey(b)
  return hay.includes(left.number) && left.streets.some((street) => hay.includes(street))
}

function sameName(a, b) {
  const left = normalizeKey(a).replace(/[^a-z0-9]+/g, ' ').trim()
  const right = normalizeKey(b).replace(/[^a-z0-9]+/g, ' ').trim()
  return left.length > 6 && (left === right || right.startsWith(`${left} `) || left.startsWith(`${right} `))
}

/**
 * Looks the place up in the local gluten-free directory. Returns the entry with
 * its classification, or null: nothing is ever inferred.
 */
export async function glutenDirectory({ name = '', address = '', area = '' }) {
  const target = targetFor(area)
  if (!target) return null

  // The barrio listing is short and specific; the city listing is the fallback.
  const scopes = target.barrio ? [target, { slug: target.slug, barrio: '' }] : [target]
  let hit = null

  for (const scope of scopes) {
    const index = await loadIndex(scope).catch(() => null)
    if (!index?.entries?.length) continue
    hit =
      index.entries.find((entry) => address && sameAddress(address, entry.address)) ||
      index.entries.find((entry) => sameName(name, entry.name))
    if (hit) break
  }
  if (!hit) return null

  const label = hit.dedicated
    ? `CeliMap lo clasifica como 100% libre de gluten${hit.certified ? ', con insumos certificados' : ''}.`
    : `CeliMap lo lista con opciones sin TACC${hit.certified ? ' e insumos certificados' : ''}.`

  return {
    state: hit.dedicated ? 'confirmado' : 'mencionado',
    mention: {
      text: `${label} La propia guía aclara que no es una certificación: confirmá el protocolo en el local.`,
      source: hit.url,
    },
  }
}
