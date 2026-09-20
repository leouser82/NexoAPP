import { fetchJson, fetchPage } from './http.js'
import { readCache, writeCache } from './store.js'

const DAY_MS = 24 * 60 * 60 * 1000
const COUNTRIES = new Set([
  'it', 'es', 'fr', 'de', 'uk', 'ie', 'pt', 'br', 'mx', 'us', 'ca', 'au', 'nz',
  'nl', 'be', 'ch', 'at', 'pl', 'cz', 'se', 'no', 'dk', 'fi', 'gr', 'jp', 'kr',
  'cl', 'co', 'pe', 'uy', 'za', 'in', 'th', 'ae', 'il', 'tw', 'sg', 'hk',
])

const SKIP_NAME = /find me gluten|download our|log in|filter options|gluten-free friendly restaurants|what the gluten/i

function slug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function typeOf(value) {
  const text = String(value || '').toLowerCase()
  if (/baker|pastry|pasticc/.test(text)) return 'Panadería'
  if (/cafe|coffee|bar /.test(text)) return 'Café'
  if (/ice cream|gelat|helad/.test(text)) return 'Heladería'
  if (/pizza/.test(text)) return 'Pizzería'
  if (/grocery|market|shop|store|diet/.test(text)) return 'Dietética'
  if (/restaurant|trattoria|osteria|sushi|food/.test(text)) return 'Restaurante'
  return 'Sin TACC'
}

function decode(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function reversePoint(lat, lon) {
  const data = await fetchJson(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    { retries: 1 },
  )
  if (!data) return null
  return {
    city: data.city || data.locality || '',
    country: data.countryName || '',
    countryCode: String(data.countryCode || '').toLowerCase(),
    region: data.principalSubdivision || '',
    regionCode: String(data.principalSubdivisionCode || ''),
  }
}

function fmgfUrls(geo) {
  if (!geo) return []
  const cc = geo.countryCode === 'gb' ? 'uk' : geo.countryCode
  const city = slug(geo.city)
  const region = slug(geo.region)
  const urls = []
  if (cc === 'us') {
    const state = slug(geo.regionCode.split('-')[1] || geo.region).slice(0, 2)
    if (state && city) urls.push(`https://www.findmeglutenfree.com/us/${state}/${city}`)
    urls.push('https://www.findmeglutenfree.com/us')
  } else if (COUNTRIES.has(cc)) {
    urls.push(`https://www.findmeglutenfree.com/${cc}`)
    if (city) urls.push(`https://www.findmeglutenfree.com/${cc}/${city}`)
    if (region && city) urls.push(`https://www.findmeglutenfree.com/${cc}/${region}/${city}`)
  }
  return [...new Set(urls)]
}

function addPlace(places, seen, item, sourceUrl) {
  const name = decode(item.name)
  if (!name || name.length < 2 || name.length > 90 || SKIP_NAME.test(name)) return
  const address = decode(item.address)
  const lat = Number(item.lat)
  const lon = Number(item.lon)
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lon)
  if (!hasPoint && !/[0-9].+,/.test(address)) return
  const key = `${name.toLowerCase()}|${address.toLowerCase()}`
  if (seen.has(key)) return
  seen.add(key)
  places.push({
    name,
    address,
    lat: hasPoint ? lat : null,
    lon: hasPoint ? lon : null,
    type: typeOf(item.type),
    level: item.dedicated ? 'dedicado' : 'opciones',
    guide: 'Find Me Gluten Free',
    guideUrl: item.url || sourceUrl,
  })
}

function walk(node, places, seen, sourceUrl) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach((item) => walk(item, places, seen, sourceUrl))
    return
  }
  const name = node.name || node.title || node.businessName || node.bizName
  const loc = node.location || node.geo || node.coordinates || {}
  let address = ''
  if (typeof node.formattedAddress === 'string') address = node.formattedAddress
  else if (typeof node.formatted_address === 'string') address = node.formatted_address
  else if (typeof node.address === 'string') address = node.address
  else if (node.address && typeof node.address === 'object') {
    address = [node.address.streetAddress, node.address.addressLocality, node.address.addressCountry]
      .filter(Boolean)
      .join(', ')
  } else {
    address = [node.street, node.city, node.state, node.country].filter(Boolean).join(', ')
  }
  if (name && (address || loc.lat || loc.latitude)) {
    addPlace(
      places,
      seen,
      {
        name,
        address: typeof address === 'string' ? address : '',
        lat: node.lat || node.latitude || loc.lat || loc.latitude,
        lon: node.lng || node.lon || node.longitude || loc.lng || loc.longitude,
        type: node.category || node.cuisine || node.type || '',
        dedicated: /dedicated/i.test(String(node.dedicated || node.tags || node.description || '')),
        url: node.url || node.canonical || (node.slug ? `https://www.findmeglutenfree.com/biz/${node.slug}` : ''),
      },
      sourceUrl,
    )
  }
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') walk(value, places, seen, sourceUrl)
  }
}

function parseHtml(html, sourceUrl) {
  const places = []
  const seen = new Set()
  const next = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (next) {
    try {
      walk(JSON.parse(next[1]), places, seen, sourceUrl)
    } catch {
      // texto
    }
  }
  if (places.length >= 8) return places

  for (const block of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(block[1]), places, seen, sourceUrl)
    } catch {
      // bloque roto
    }
  }

  const text = decode(html.replace(/<script[\s\S]*?<\/script>/gi, '\n').replace(/<style[\s\S]*?<\/style>/gi, '\n').replace(/<[^>]+>/g, '\n'))
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  for (let i = 0; i < lines.length - 1; i += 1) {
    const name = lines[i]
    const nextLine = lines[i + 1]
    const later = lines[i + 2] || ''
    const address = /[0-9].+,/.test(nextLine) ? nextLine : /[0-9].+,/.test(later) ? later : ''
    if (!address || SKIP_NAME.test(name) || name.length < 3 || name.length > 70) continue
    if (/^(gf menu|featured|reported|view |follow |open )/i.test(name)) continue
    addPlace(
      places,
      seen,
      {
        name,
        address,
        type: later,
        dedicated: /dedicated gluten-free/i.test([lines[i + 3], lines[i + 4], later].join(' ')),
        url: sourceUrl,
      },
      sourceUrl,
    )
  }
  return places
}

async function geocode(address) {
  const key = `fmgf-geo:${address}`
  const cached = readCache(key, 14 * DAY_MS)
  if (cached) return cached
  const data = await fetchJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1`, { retries: 0 })
  const coords = data?.features?.[0]?.geometry?.coordinates
  if (!Array.isArray(coords) || coords.length < 2) return null
  const point = { lat: Number(coords[1]), lon: Number(coords[0]) }
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return null
  writeCache(key, point)
  return point
}

async function withCoords(listings) {
  const pending = listings.filter((item) => !Number.isFinite(item.lat) || !Number.isFinite(item.lon)).slice(0, 45)
  const known = listings.filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon))
  const queue = [...pending]
  const located = []
  async function worker() {
    while (queue.length) {
      const item = queue.shift()
      const point = await geocode(item.address).catch(() => null)
      if (point) located.push({ ...item, ...point })
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, queue.length || 1) }, () => worker()))
  return [...known, ...located]
}

function toGuide(item, index) {
  return {
    id: `fmgf-${slug(item.name)}-${index}`,
    name: item.name,
    type: item.type || 'Sin TACC',
    lat: item.lat,
    lon: item.lon,
    address: item.address || '',
    area: '',
    level: item.level || 'opciones',
    hours: '',
    photos: [],
    guide: item.guide,
    guideUrl: item.guideUrl,
  }
}

export async function worldGuidePlaces(lat, lon) {
  const key = `fmgf:near:${Number(lat).toFixed(2)}:${Number(lon).toFixed(2)}`
  const cached = readCache(key, DAY_MS)
  if (cached) return cached

  const geo = await reversePoint(lat, lon)
  if (!geo || geo.countryCode === 'ar') return []

  const urls = fmgfUrls(geo)
  const listings = []
  const seen = new Set()
  for (const url of urls) {
    const html = await fetchPage(url, { retries: 1, timeoutMs: 14000 })
    if (!html) continue
    for (const item of parseHtml(html, url)) {
      const mark = `${item.name}|${item.address}`
      if (seen.has(mark)) continue
      seen.add(mark)
      listings.push(item)
    }
    if (listings.length >= 20) break
  }

  const located = await withCoords(listings)
  const places = located.map(toGuide)
  writeCache(key, places)
  return places
}
