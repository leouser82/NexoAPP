import { fetchPage } from './scraper/http.js'
import { overpass } from './scraper/overpass.js'
import { crawlGluten, crawlPlace } from './scraper/crawl.js'
import {
  distinctiveTokens,
  extractJsonLd,
  glutenMentions,
  hoursFromJsonLd,
  hoursFromText,
  hoursToRows,
  htmlToText,
  imagesFrom,
  menuFrom,
  pickBusinessNode,
  todayLabel,
} from './scraper/parse.js'
import { dedupe, readCache, writeCache } from './scraper/store.js'

const EMPTY = {
  photos: [],
  rating: null,
  reviewCount: null,
  reviews: [],
  phone: '',
  openLabel: '',
  hoursRows: [],
  features: [],
  address: '',
  summary: '',
  website: '',
  menu: [],
  sources: [],
  gfMentions: [],
  gfState: 'desconocido',
}

function unique(list) {
  return [...new Set((list || []).filter(Boolean))]
}

/** OSM tags give phone / website / opening_hours for free and never block us. */
async function osmTags(lat, lon, name) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return {}
  const query = `[out:json][timeout:10];(node(around:120,${lat},${lon})["name"];way(around:120,${lat},${lon})["name"];);out tags center;`
  const data = await overpass(query, { timeoutMs: 14000 })
  const elements = data.elements || []
  if (!elements.length) return {}

  // Only trust an element whose name matches: the nearest node could be the
  // shop next door, and its photo or phone would be plain wrong.
  const needle = String(name || '').toLowerCase()
  const first = needle.split(/\s+/)[0] || ''
  const best =
    elements.find((el) => (el.tags?.name || '').toLowerCase() === needle) ||
    elements.find((el) => first.length > 3 && (el.tags?.name || '').toLowerCase().includes(first))
  return best?.tags || {}
}

/** The place's own site is the best photo source when it exists. */
async function siteDetails(url) {
  const empty = { photos: [], hoursRows: [], gfMentions: [] }
  if (!url) return empty
  const html = await fetchPage(url, { timeoutMs: 10000, retries: 1 })
  if (!html) return empty

  const node = pickBusinessNode(extractJsonLd(html))
  const ldHours = node ? hoursFromJsonLd(node) : new Map()
  const text = htmlToText(html)
  const hoursMap = ldHours.size ? ldHours : hoursFromText(text)
  return {
    photos: imagesFrom(html, node),
    hoursRows: hoursToRows(hoursMap),
    gfMentions: glutenMentions(text).map((quote) => ({ text: quote, source: url })),
  }
}

/** Review sites keep the card on one page and the menu on "<page>/menu". */
async function menuFromSources(sources) {
  for (const source of sources.slice(0, 1)) {
    if (/\/menu(?:\/|$)/i.test(source)) continue
    const html = await fetchPage(`${source.replace(/\/$/, '')}/menu`, { timeoutMs: 10000, retries: 1 })
    if (!html) continue
    const node = pickBusinessNode(extractJsonLd(html))
    const items = menuFrom(htmlToText(html), node)
    if (items.length) return items
  }
  return []
}

function fillOpenLabel(data) {
  if (data.hoursRows.length && !data.openLabel) data.openLabel = todayLabel(data.hoursRows)
  return data
}

function cacheKey(name, address, lat) {
  return `${String(name).toLowerCase()}|${String(address).toLowerCase()}|${Number(lat).toFixed(4)}`
}

export async function lookupPlace({ name = '', address = '', area = '', lat, lon, type = '', website = '' }) {
  const key = cacheKey(name, address, lat)
  const cached = readCache(key)
  if (cached) return cached

  return dedupe(key, async () => {
    const data = { ...EMPTY, address }
    // Either the name identifies the place, or the address carries a street number.
    const searchable = distinctiveTokens(name).length > 0 || /\b\d{2,5}\b/.test(address)

    // Independent sources, so they run together instead of one after another.
    const [crawled, tags] = await Promise.all([
      searchable ? crawlPlace({ name, address, area, type }).catch(() => ({})) : Promise.resolve({}),
      osmTags(Number(lat), Number(lon), name).catch(() => ({})),
    ])

    Object.assign(data, {
      photos: unique(crawled.photos),
      rating: crawled.rating ?? null,
      reviewCount: crawled.reviewCount ?? null,
      reviews: crawled.reviews || [],
      hoursRows: crawled.hoursRows || [],
      openLabel: crawled.openLabel || '',
      features: crawled.features || [],
      menu: crawled.menu || [],
      phone: crawled.phone || '',
      address: crawled.address || address,
      summary: crawled.summary || '',
      website: website || crawled.website || '',
      sources: crawled.sources || [],
      gfMentions: crawled.gfMentions || [],
    })

    data.phone = data.phone || tags.phone || tags['contact:phone'] || ''
    data.website = data.website || tags.website || tags['contact:website'] || ''
    if (tags.image) data.photos = unique([tags.image, ...data.photos])
    if (!data.hoursRows.length && tags.opening_hours) {
      const rows = hoursToRows(hoursFromText(tags.opening_hours.replace(/Mo/g, 'Lunes')))
      if (rows.length) data.hoursRows = rows
    }
    if (!data.address) {
      data.address = [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']]
        .filter(Boolean)
        .join(' ')
    }

    if (!data.menu.length && data.sources.length) {
      data.menu = await menuFromSources(data.sources).catch(() => [])
    }

    if (data.website && (!data.photos.length || !data.hoursRows.length || !data.gfMentions.length)) {
      const site = await siteDetails(data.website).catch(() => ({
        photos: [],
        hoursRows: [],
        gfMentions: [],
      }))
      data.photos = unique([...data.photos, ...site.photos]).slice(0, 10)
      if (!data.hoursRows.length) data.hoursRows = site.hoursRows
      if (!data.gfMentions.length) data.gfMentions = site.gfMentions
    }

    if (!data.gfMentions.length) {
      data.gfMentions = await crawlGluten({ name, area, address }).catch(() => [])
    }

    // "Confirmado" only when OSM tags it or a source says so in writing.
    const osmDiet = String(tags['diet:gluten_free'] || '').toLowerCase()
    if (['yes', 'only', 'limited'].includes(osmDiet)) {
      data.gfState = 'confirmado'
      data.gfMentions = [
        {
          text:
            osmDiet === 'only'
              ? 'OpenStreetMap lo registra como local exclusivamente sin gluten.'
              : 'OpenStreetMap lo registra con opciones sin gluten.',
          source: 'https://www.openstreetmap.org/',
        },
        ...data.gfMentions,
      ].slice(0, 4)
    } else if (data.gfMentions.length) {
      data.gfState = 'mencionado'
    } else {
      data.gfState = 'sin datos'
    }

    fillOpenLabel(data)
    writeCache(key, data)
    return data
  })
}

/** Cheap path for list cards: one photo, no deep crawl unless nothing else works. */
export async function lookupPhoto({ name = '', address = '', area = '', lat, lon, website = '' }) {
  const full = readCache(cacheKey(name, address, lat))
  if (full) return { photo: full.photos[0] || '' }

  const photoKey = `photo:${cacheKey(name, address, lat)}`
  const cached = readCache(photoKey)
  if (cached) return cached

  return dedupe(photoKey, async () => {
    let photo = ''
    const tags = await osmTags(Number(lat), Number(lon), name).catch(() => ({}))
    if (tags.image && /^https?:\/\//.test(tags.image)) photo = tags.image

    const site = website || tags.website || tags['contact:website'] || ''
    if (!photo && site) {
      const details = await siteDetails(site).catch(() => ({ photos: [] }))
      photo = details.photos[0] || ''
    }

    if (!photo && (distinctiveTokens(name).length || /\b\d{2,5}\b/.test(address))) {
      const crawled = await crawlPlace({ name, address, area, maxPages: 2 }).catch(() => ({ photos: [] }))
      photo = (crawled.photos || [])[0] || ''
    }

    const result = { photo }
    writeCache(photoKey, result)
    return result
  })
}
