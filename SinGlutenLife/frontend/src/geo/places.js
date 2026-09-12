import { distanceKm } from './geo.js'
import { loadGuidePlaces, mergeGuidePlaces, osmGlutenQuery, osmToGuidePlace } from './guides.js'

/**
 * The list only carries places that a gluten-free guide publishes as such.
 * Ordinary bakeries and restaurants are not listed: for a celiac, a place with
 * no published information is not a result.
 */

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const GF_KM = 25
const MAX_PLACES = 150
const PHARMACY_KM = 5

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

function levelLabel(level) {
  return level === 'dedicado' ? '100% sin gluten' : 'Opciones sin TACC'
}

function guideToPlace(item, origin) {
  return {
    id: item.id,
    name: item.name,
    type: item.type || 'Sin TACC',
    category: 'comida',
    lat: item.lat,
    lon: item.lon,
    distanceKm: Number.isFinite(item.distanceKm) ? item.distanceKm : distanceKm(origin, item),
    address: item.address || '',
    city: item.area || '',
    hours: item.hours || '',
    tags: [levelLabel(item.level)],
    certified: true,
    level: item.level || 'opciones',
    image: item.photos?.[0] || '',
    photos: item.photos || [],
    phone: item.phone || '',
    website: item.website || '',
    guides: item.guides || [],
    guideUrl: item.guideUrl || '',
    googlePlaceId: item.googlePlaceId || '',
    kitchen: item.kitchen || '',
    supply: item.supply || '',
    mode: item.mode || '',
    care: item.care || '',
    cuisine: '',
    description: '',
    menuUrl: '',
    products: [],
    osmType: '',
    osmId: '',
  }
}

async function overpass(query, timeoutMs = 15000) {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      })
      if (!response.ok) continue
      const data = await response.json()
      if (data?.elements) return data.elements
    } catch {
      // se prueba el espejo siguiente
    } finally {
      clearTimeout(timer)
    }
  }
  return []
}

async function fetchOsmGluten(lat, lon) {
  const elements = await overpass(osmGlutenQuery(lat, lon, GF_KM))
  return elements.map(osmToGuidePlace).filter(Boolean)
}

function pharmacyQuery(lat, lon) {
  const radius = PHARMACY_KM * 1000
  return `
[out:json][timeout:18];
(
  node["amenity"="pharmacy"](around:${radius},${lat},${lon});
  node["shop"="chemist"](around:${radius},${lat},${lon});
);
out body;
`.trim()
}

async function fetchPharmacies(lat, lon) {
  const elements = await overpass(pharmacyQuery(lat, lon), 12000)
  return elements
    .map((el) => {
      const coords = coordsOf(el)
      const tags = el.tags || {}
      if (!coords || !tags.name) return null
      return {
            id: `fa-${el.type || 'n'}-${el.id}`,
            name: tags.name,
            type: 'Farmacia',
            category: 'farmacia',
            lat: coords.lat,
            lon: coords.lon,
            distanceKm: distanceKm({ lat, lon }, coords),
            address: addressOf(tags),
            city: [tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(', '),
            hours: tags.opening_hours || '',
            tags: [],
            certified: false,
            level: '',
            image: '',
            photos: [],
            phone: tags.phone || tags['contact:phone'] || '',
            website: tags.website || tags['contact:website'] || '',
            guides: [],
            guideUrl: '',
            products: [],
        osmType: el.type || 'node',
        osmId: el.id,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 40)
}

/**
 * Primero las guías, que responden enseguida. OpenStreetMap y las farmacias
 * llegan después: tardan y no deben demorar la lista.
 */
export async function fetchNearbyPlaces(lat, lon, onPartial) {
  const guide = await loadGuidePlaces(lat, lon, GF_KM).catch(() => [])
  const places = guide.map((item) => guideToPlace(item, { lat, lon })).slice(0, MAX_PLACES)
  onPartial?.({ all: places, places, pharmacies: [] })

  const [osm, pharmacies] = await Promise.all([
    fetchOsmGluten(lat, lon).catch(() => []),
    fetchPharmacies(lat, lon).catch(() => []),
  ])

  const merged = mergeGuidePlaces([...guide, ...osm])
    .map((item) => guideToPlace(item, { lat, lon }))
    .filter((place) => place.distanceKm <= GF_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, MAX_PLACES)

  return { all: [...merged, ...pharmacies], places: merged, pharmacies }
}
