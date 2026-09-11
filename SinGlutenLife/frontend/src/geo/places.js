import { distanceKm } from './geo.js'

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const LOCAL_KM = 5
const RESTAURANT_KM = 50
const MAX_RESTAURANTS = 50

function maxKmFor(place) {
  return place.type === 'Restaurante' ? RESTAURANT_KM : LOCAL_KM
}

function coordsOf(el) {
  if (Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
    return { lat: el.lat, lon: el.lon }
  }
  if (el.center && Number.isFinite(el.center.lat)) {
    return { lat: el.center.lat, lon: el.center.lon }
  }
  return null
}

function addressOf(tags = {}) {
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ')
  return tags['addr:full'] || street || tags['addr:city'] || ''
}

function isGlutenFree(tags = {}, name = '') {
  const diet = String(tags['diet:gluten_free'] || '').toLowerCase()
  const gf = String(tags.gluten_free || '').toLowerCase()
  const haystack = `${name} ${tags.description || ''} ${tags.cuisine || ''}`.toLowerCase()
  return (
    diet === 'yes' ||
    diet === 'only' ||
    diet === 'limited' ||
    gf === 'yes' ||
    /sin\s*tacc|sintacc|celiac|gluten\s*free|sin gluten/.test(haystack)
  )
}

function classify(tags = {}, name = '') {
  const amenity = tags.amenity || ''
  const shop = tags.shop || ''
  const cuisine = String(tags.cuisine || '')
  if (amenity === 'pharmacy' || shop === 'chemist') {
    return { type: 'Farmacia', category: 'farmacia' }
  }
  if (shop === 'bakery' || /panader/.test(name.toLowerCase())) {
    return { type: 'Panadería', category: 'comida' }
  }
  if (shop === 'confectionery' || /confiter/.test(name.toLowerCase())) {
    return { type: 'Confitería', category: 'comida' }
  }
  if (shop === 'health_food' || /diet[eé]tica/.test(name.toLowerCase())) {
    return { type: 'Dietética', category: 'comida' }
  }
  if (/pizz/.test(`${name} ${cuisine}`.toLowerCase())) {
    return { type: 'Pizzería', category: 'comida' }
  }
  if (amenity === 'fast_food' || amenity === 'food_court') {
    return { type: 'Take away', category: 'comida' }
  }
  if (amenity === 'cafe' || amenity === 'ice_cream') {
    return { type: 'Café', category: 'comida' }
  }
  if (amenity === 'restaurant' || /restaurant|parrilla|resto/i.test(`${name} ${osmHint(tags)}`)) {
    return { type: 'Restaurante', category: 'comida' }
  }
  return { type: 'Restaurante', category: 'comida' }
}

function osmHint(tags = {}) {
  return `${tags.amenity || ''} ${tags.shop || ''}`
}

function toPlace(el, origin) {
  const coords = coordsOf(el)
  if (!coords) return null
  const tags = el.tags || {}
  const name = tags.name || tags.brand || 'Lugar sin nombre'
  const kind = classify(tags, name)
  const certified = isGlutenFree(tags, name)
  const tagsList = [
    certified ? '' : 'A confirmar',
    tags.cuisine,
    tags.organic === 'yes' ? 'Orgánico' : '',
  ].filter(Boolean)

  return {
    id: `${el.type || 'n'}-${el.id}`,
    name,
    ...kind,
    lat: coords.lat,
    lon: coords.lon,
    distanceKm: distanceKm(origin, coords),
    address: addressOf(tags),
    hours: tags.opening_hours || '',
    tags: tagsList.slice(0, 3),
    certified,
    phone: tags.phone || tags['contact:phone'] || '',
    website: tags.website || tags['contact:website'] || '',
    products: kind.category === 'farmacia' ? ['Alimentos sin TACC', 'Premezclas', 'Snacks'] : [],
  }
}

function overpassQuery(lat, lon) {
  const local = LOCAL_KM * 1000
  const far = RESTAURANT_KM * 1000
  return `
[out:json][timeout:18];
(
  node["diet:gluten_free"~"yes|only"](around:${far},${lat},${lon});
  node["name"~"tacc|celiac",i](around:${far},${lat},${lon});
  node["amenity"="restaurant"]["diet:gluten_free"~"yes|only"](around:${far},${lat},${lon});
  node["amenity"="restaurant"](around:${local},${lat},${lon});
  node["shop"="bakery"](around:${local},${lat},${lon});
  node["shop"="confectionery"](around:${local},${lat},${lon});
  node["shop"="health_food"](around:${local},${lat},${lon});
  node["amenity"="pharmacy"](around:${local},${lat},${lon});
  node["amenity"="cafe"](around:${local},${lat},${lon});
  node["amenity"="fast_food"](around:${local},${lat},${lon});
);
out body;
`.trim()
}

async function fetchOverpass(lat, lon) {
  const body = new URLSearchParams({ data: overpassQuery(lat, lon) })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(OVERPASS_ENDPOINTS[0], {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body,
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`overpass-${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchPhoton(query, lat, lon) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${lat}&lon=${lon}&limit=20`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error('photon')
    const data = await response.json()
    return data.features || []
  } finally {
    clearTimeout(timer)
  }
}

function photonToPlace(feature, origin) {
  const [lon, lat] = feature.geometry?.coordinates || []
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const props = feature.properties || {}
  const name = props.name || props.street || 'Lugar'
  const osmType = props.osm_value || props.type || ''
  const fakeTags = {
    amenity: osmType,
    shop: osmType,
    name,
    'addr:street': props.street,
    'addr:housenumber': props.housenumber,
    'addr:city': props.city,
  }
  const kind = classify(fakeTags, name)
  const certified = isGlutenFree({}, `${name} ${props.city || ''}`)
  return {
    id: `ph-${props.osm_type || 'n'}-${props.osm_id || `${lat}-${lon}`}`,
    name,
    ...kind,
    lat,
    lon,
    distanceKm: distanceKm(origin, { lat, lon }),
    address: [props.street, props.housenumber, props.city].filter(Boolean).join(' '),
    hours: '',
    tags: certified ? [] : ['Cerca'],
    certified,
    products: kind.category === 'farmacia' ? ['Alimentos sin TACC'] : [],
  }
}

function isGenericName(name) {
  return /^(panader[ií]a|farmacia|diet[eé]tica|cafeter[ií]a|confiter[ií]a|restaurante)$/i.test(String(name).trim())
}

function mergePlaces(list) {
  const map = new Map()
  for (const place of list) {
    if (!place) continue
    const key = `${place.name.toLowerCase().trim()}|${place.lat.toFixed(4)}|${place.lon.toFixed(4)}`
    const prev = map.get(key)
    if (!prev || (place.certified && !prev.certified) || (isGenericName(prev.name) && !isGenericName(place.name))) {
      map.set(key, place)
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.certified !== b.certified) return a.certified ? -1 : 1
    if (isGenericName(a.name) !== isGenericName(b.name)) return isGenericName(a.name) ? 1 : -1
    return a.distanceKm - b.distanceKm
  })
}

function splitPlaces(list) {
  const merged = mergePlaces(list).filter((p) => p.distanceKm <= maxKmFor(p))
  const restaurants = merged.filter((p) => p.type === 'Restaurante').slice(0, MAX_RESTAURANTS)
  const others = merged.filter((p) => p.type !== 'Restaurante')
  const all = [...restaurants, ...others].sort((a, b) => a.distanceKm - b.distanceKm)
  return {
    all,
    places: all.filter((p) => p.category === 'comida'),
    pharmacies: all.filter((p) => p.category === 'farmacia'),
  }
}

async function loadPhotonPlaces(origin) {
  const results = await Promise.allSettled([
    fetchPhoton('sin tacc', origin.lat, origin.lon),
    fetchPhoton('celiaco', origin.lat, origin.lon),
    fetchPhoton('dietetica', origin.lat, origin.lon),
    fetchPhoton('panaderia', origin.lat, origin.lon),
    fetchPhoton('confiteria', origin.lat, origin.lon),
    fetchPhoton('farmacia', origin.lat, origin.lon),
    fetchPhoton('restaurante', origin.lat, origin.lon),
    fetchPhoton('restaurante sin tacc', origin.lat, origin.lon),
    fetchPhoton('parrilla', origin.lat, origin.lon),
  ])
  return results.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])).map((feature) =>
    photonToPlace(feature, origin),
  )
}

export async function fetchNearbyPlaces(lat, lon, onPartial) {
  const origin = { lat, lon }
  const fromPhoton = await loadPhotonPlaces(origin)
  const partial = splitPlaces(fromPhoton)
  onPartial?.(partial)

  let fromOsm = []
  try {
    const overpass = await fetchOverpass(lat, lon)
    fromOsm = (overpass.elements || []).map((el) => toPlace(el, origin))
  } catch {
    fromOsm = []
  }

  return splitPlaces([...fromPhoton, ...fromOsm])
}
