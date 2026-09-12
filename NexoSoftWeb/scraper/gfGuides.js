import { fetchJson, fetchPage } from './http.js'
import { overpass } from './overpass.js'
import { dedupe, readCache, writeCache } from './store.js'

/**
 * Confirmed gluten-free places, taken from the guides that publish the data
 * instead of scraping each place. Nothing here is guessed: every record keeps
 * the guide it came from and the level that guide assigned.
 */

const CELIMAP_API = 'https://www.celimap.com.ar/api/places'
const CELIMAP_PAGE = 100
const CELIMAP_MAX_PAGES = 24
const DAY_MS = 24 * 60 * 60 * 1000

const TYPE_LABEL = {
  restaurant: 'Restaurante',
  bakery: 'Panadería',
  cafe: 'Café',
  bar: 'Bar',
  store: 'Dietética',
  icecream: 'Heladería',
  pizzeria: 'Pizzería',
  other: 'Sin TACC',
}

const DEDICATED = new Set(['dedicated_gf', '100_gf', 'dedicado'])
const OPTIONS = new Set(['gf_options', 'opciones_sin_tacc', 'limited'])

/** Some records come out as UTF-8 read as Latin-1 ("MiÃ©rcoles"). */
function fixText(value) {
  const text = String(value || '').trim()
  if (!/Ã.|Â./.test(text)) return text
  try {
    return Buffer.from(text, 'latin1').toString('utf8')
  } catch {
    return text
  }
}

function levelOf(value) {
  if (DEDICATED.has(value)) return 'dedicado'
  if (OPTIONS.has(value)) return 'opciones'
  return ''
}

/** "Italia 136, B1870 Avellaneda, Provincia de …, Argentina" is too long. */
function shortAddress(value) {
  const parts = fixText(value)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !/^argentina$/i.test(part) && !/^provincia de/i.test(part))
  const street = parts[0] || ''
  const town = (parts[1] || '').replace(/^[A-Z]?\d{4}[A-Z]{0,3}\s*/, '')
  return [street, town].filter(Boolean).join(', ')
}

/** CeliMap ships a JSON endpoint with the whole country, coordinates included. */
async function celimapPlaces() {
  const key = 'guide:celimap:v2'
  const cached = readCache(key, DAY_MS)
  if (cached) return cached

  return dedupe(key, async () => {
    const first = await fetchJson(`${CELIMAP_API}?limit=${CELIMAP_PAGE}&page=1`, { retries: 1 })
    const total = first?.pagination?.pages || 0
    if (!first?.places?.length) return []

    const pages = Math.min(total, CELIMAP_MAX_PAGES)
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
        fetchJson(`${CELIMAP_API}?limit=${CELIMAP_PAGE}&page=${index + 2}`, { retries: 1 }),
      ),
    )

    const raw = [first, ...rest].flatMap((payload) => payload?.places || [])
    const places = raw
      .filter((item) => item?.status !== 'rejected' && item?.location?.lat && item?.location?.lng)
      .map((item) => {
        const level = levelOf(item.safetyLevel) || levelOf((item.tags || [])[0]) || 'opciones'
        return {
          id: `cm-${item._id}`,
          name: fixText(item.name),
          type: TYPE_LABEL[item.type] || 'Sin TACC',
          lat: item.location.lat,
          lon: item.location.lng,
          address: shortAddress(item.address),
          // Some records put the street in the neighbourhood field.
          area: /\d/.test(item.neighborhood || '') ? '' : fixText(item.neighborhood),
          level,
          hours: fixText(item.openingHours),
          photos: (item.photos || []).filter((url) => /^https?:\/\//.test(url)).slice(0, 8),
          googlePlaceId: item.googlePlaceId || '',
          guide: 'CeliMap',
          guideUrl: item.slug ? `https://www.celimap.com.ar/lugar/${item.slug}` : 'https://www.celimap.com.ar/mapa',
        }
      })
      .filter((place) => place.name)

    writeCache(key, places)
    return places
  })
}

/**
 * SinTaccto keeps a Google map with 678 places. Its KML carries what a celiac
 * actually asks: dedicated or mixed kitchen, raw material and hours.
 */
const SINTACCTO_MID = '18wKMA95xo1ZX2iyGu9_-iv3Jr9gilM4'
const SINTACCTO_POST = 'https://sintaccto.com/sintacc/2024/01/15/mapa-celiaco-de-la-ciudad-de-buenos-aires/'
const DAY_LINE = /^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/i

function kmlText(raw) {
  return String(raw || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function kmlFields(description) {
  const lines = kmlText(description)
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)

  const fields = {}
  let current = ''
  for (const line of lines) {
    const head = line.match(/^-?\s*([^:]{3,48}?)\s*:\s*(.*)$/)
    if (head && !DAY_LINE.test(line)) {
      current = head[1]
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
      fields[current] = head[2] ? [head[2]] : []
      continue
    }
    if (current) fields[current].push(line)
  }
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.join('\n').trim()]))
}

function sintacctoType(value) {
  const text = String(value || '').toLowerCase()
  if (/panader|pasteler/.test(text)) return 'Panadería'
  if (/helader/.test(text)) return 'Heladería'
  if (/caf[eé]|cafeter|casa de t[eé]/.test(text)) return 'Café'
  if (/bar\b|cervecer|bodeg[oó]n/.test(text)) return 'Bar'
  if (/pizzer/.test(text)) return 'Pizzería'
  if (/almac[eé]n|diet[eé]tica|tienda|mercado/.test(text)) return 'Dietética'
  if (/restaurante|parrilla|resto|sushi|bistr/.test(text)) return 'Restaurante'
  return 'Sin TACC'
}

async function sintacctoPlaces() {
  const key = 'guide:sintaccto:v1'
  const cached = readCache(key, DAY_MS)
  if (cached) return cached

  return dedupe(key, async () => {
    const xml = await fetchPage(
      `https://www.google.com/maps/d/kml?mid=${SINTACCTO_MID}&forcekml=1`,
      { timeoutMs: 25000, retries: 1 },
    )
    if (!xml) return []

    const places = []
    for (const [, block] of xml.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g)) {
      const name = kmlText((block.match(/<name>([\s\S]*?)<\/name>/) || [])[1]).trim()
      const point = (block.match(/<coordinates>([\s\S]*?)<\/coordinates>/) || [])[1] || ''
      const [lon, lat] = point.trim().split(',').map(Number)
      if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue

      const fields = kmlFields((block.match(/<description>([\s\S]*?)<\/description>/) || [])[1])
      const kitchen = fields.cocina || fields['nivel de cuidados'] || ''
      const dedicated = /100\s*%|libre de gluten|sin gluten|sin tacc/i.test(kitchen) && !/mixta/i.test(kitchen)
      const hours = (fields['horarios de atencion'] || '')
        .split('\n')
        .filter((line) => DAY_LINE.test(line))
        .join('\n')

      places.push({
        id: `st-${lat.toFixed(5)}-${lon.toFixed(5)}`,
        name,
        type: sintacctoType(fields['tipo de comercio']),
        lat,
        lon,
        address: fields.direccion || '',
        area: '',
        level: dedicated ? 'dedicado' : 'opciones',
        hours,
        photos: [],
        kitchen,
        supply: fields['materia prima'] || '',
        mode: fields.modalidad || '',
        care: fields['cuidados para evitar la contaminacion cruzada'] || '',
        guide: 'SinTaccto',
        guideUrl: SINTACCTO_POST,
      })
    }

    writeCache(key, places)
    return places
  })
}

/** OpenStreetMap covers towns the guides miss, and adds phone and website. */
async function osmGlutenPlaces(lat, lon, km) {
  const radius = Math.round(km * 1000)
  const key = `guide:osm:${lat.toFixed(2)}:${lon.toFixed(2)}:${Math.round(km)}`
  const cached = readCache(key, DAY_MS)
  if (cached) return cached

  const query = `[out:json][timeout:20];
(
  node["diet:gluten_free"~"yes|only|limited"](around:${radius},${lat},${lon});
  way["diet:gluten_free"~"yes|only|limited"](around:${radius},${lat},${lon});
  node["gluten_free"="yes"](around:${radius},${lat},${lon});
  node["name"~"sin *tacc|celia|gluten",i](around:${radius},${lat},${lon});
);
out tags center;`

  const data = await overpass(query)
  const places = (data.elements || [])
    .map((element) => {
      const tags = element.tags || {}
      const name = tags.name || tags.brand || ''
      const point = Number.isFinite(element.lat)
        ? { lat: element.lat, lon: element.lon }
        : element.center
          ? { lat: element.center.lat, lon: element.center.lon }
          : null
      if (!name || !point) return null

      const diet = String(tags['diet:gluten_free'] || '').toLowerCase()
      const named = /sin\s*tacc|sintacc|celia|gluten/i.test(name)
      const level = diet === 'only' ? 'dedicado' : diet ? 'opciones' : named ? 'opciones' : ''
      if (!level) return null

      const kind = tags.shop === 'bakery' ? 'Panadería' : tags.shop === 'health_food' ? 'Dietética' : tags.amenity === 'cafe' ? 'Café' : tags.amenity === 'restaurant' ? 'Restaurante' : tags.shop ? 'Dietética' : 'Sin TACC'

      return {
        id: `osm-${element.type || 'n'}-${element.id}`,
        name,
        type: kind,
        lat: point.lat,
        lon: point.lon,
        address: [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '),
        area: [tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(', '),
        level,
        hours: tags.opening_hours || '',
        photos: tags.image && /^https?:\/\//.test(tags.image) ? [tags.image] : [],
        phone: tags.phone || tags['contact:phone'] || '',
        website: tags.website || tags['contact:website'] || '',
        guide: 'OpenStreetMap',
        guideUrl: `https://www.openstreetmap.org/${element.type || 'node'}/${element.id}`,
      }
    })
    .filter(Boolean)

  writeCache(key, places)
  return places
}

function haversineKm(a, b) {
  const toRad = (value) => (value * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

function normalizeName(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Same shop listed by two guides: keep the richer record, note both guides. */
function merge(list) {
  const byKey = new Map()
  for (const place of list) {
    const key = `${normalizeName(place.name)}|${place.lat.toFixed(3)}|${place.lon.toFixed(3)}`
    const previous = byKey.get(key)
    if (!previous) {
      byKey.set(key, { ...place, guides: [place.guide] })
      continue
    }
    previous.guides = [...new Set([...previous.guides, place.guide])]
    if (!previous.photos.length && place.photos.length) previous.photos = place.photos
    for (const field of ['hours', 'address', 'area', 'phone', 'website', 'kitchen', 'supply', 'mode', 'care']) {
      if (!previous[field] && place[field]) previous[field] = place[field]
    }
    if (previous.level !== 'dedicado' && place.level === 'dedicado') previous.level = 'dedicado'
  }
  return [...byKey.values()]
}

/**
 * Confirmed places within `km`, closest first. The national dataset is cached
 * for a day, so this is a local filter and answers in milliseconds.
 */
export async function gfPlacesNear({ lat, lon, km = 25, limit = 120 }) {
  const origin = { lat: Number(lat), lon: Number(lon) }
  if (!Number.isFinite(origin.lat) || !Number.isFinite(origin.lon)) return { places: [], guides: [] }

  // Overpass can take 15 s on a cold zone. It adds a handful of places, so it
  // never holds the answer back: it keeps going and lands in the next request.
  const osmTask = osmGlutenPlaces(origin.lat, origin.lon, Math.min(km, 30)).catch(() => [])
  const osmSoon = Promise.race([
    osmTask,
    new Promise((resolve) => {
      setTimeout(() => resolve([]), 4000).unref?.()
    }),
  ])

  const [celimap, sintaccto, osm] = await Promise.all([
    celimapPlaces().catch(() => []),
    sintacctoPlaces().catch(() => []),
    osmSoon,
  ])

  const places = merge([...celimap, ...sintaccto, ...osm])
    .map((place) => ({ ...place, distanceKm: haversineKm(origin, place) }))
    .filter((place) => place.distanceKm <= km)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)

  return {
    places,
    guides: [...new Set(places.flatMap((place) => place.guides))],
    total: places.length,
  }
}
