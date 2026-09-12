import { distanceKm } from './geo.js'

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

async function fetchGuidePlaces(lat, lon) {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon), km: String(GF_KM) })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 40000)
  try {
    const response = await fetch(`/api/gf-places?${params}`, { signal: controller.signal })
    if (!response.ok) throw new Error('gf-places')
    const data = await response.json()
    return (data.places || []).map((item) => guideToPlace(item, { lat, lon }))
  } finally {
    clearTimeout(timer)
  }
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
  const body = new URLSearchParams({ data: pharmacyQuery(lat, lon) })
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body,
        signal: controller.signal,
      })
      if (!response.ok) continue
      const data = await response.json()
      return (data.elements || [])
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
    } catch {
      // try the next mirror
    } finally {
      clearTimeout(timer)
    }
  }
  return []
}

export async function fetchNearbyPlaces(lat, lon, onPartial) {
  const places = await fetchGuidePlaces(lat, lon).catch(() => [])
  onPartial?.({ all: places, places, pharmacies: [] })

  const pharmacies = await fetchPharmacies(lat, lon).catch(() => [])
  return { all: [...places, ...pharmacies], places, pharmacies }
}
