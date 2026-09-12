import { mapEmbedUrl, parseOpeningHours } from './hours.js'

const GENERIC_WORD = /^(restaurante|confiter[ií]a|panader[ií]a|diet[eé]tica|farmacia|comida|take|away|cafeter[ií]a|parrilla|el|la|los|las|de|del|y|bar)$/i
const SKIP_PHOTO = /8m|protest|marcha|logo|icon|flag|mapa|escudo|svg|coat of arms|diagrama/i

const photoCache = new Map()
const detailCache = new Map()
const queue = []
let active = 0

function significantTokens(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[\s\-–,/]+/)
    .filter((token) => token.length > 3 && !GENERIC_WORD.test(token))
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function nameMatches(name, title) {
  const tokens = significantTokens(name)
  if (!tokens.length) return false
  const hay = normalize(title)
  return tokens.some((token) => hay.includes(token))
}

async function fetchJson(url, ms = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error('http')
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

function withSlot(task) {
  return new Promise((resolve, reject) => {
    const run = async () => {
      active += 1
      try {
        resolve(await task())
      } catch (error) {
        reject(error)
      } finally {
        active -= 1
        queue.shift()?.()
      }
    }
    if (active >= 3) queue.push(run)
    else run()
  })
}

function filePath(fileName) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName.replace(/^File:/i, ''))}?width=1200`
}

function placeParams(place, area = '') {
  return new URLSearchParams({
    name: place.name || '',
    address: place.address || '',
    area: place.city || area || '',
    lat: String(place.lat ?? ''),
    lon: String(place.lon ?? ''),
    type: place.type || '',
    website: place.website || '',
  })
}

async function fetchOsmTags(place) {
  if (!place.osmId || !place.osmType) return {}
  const type = String(place.osmType)
    .replace(/^n$/i, 'node')
    .replace(/^w$/i, 'way')
    .replace(/^r$/i, 'relation')
  const query = `[out:json][timeout:8];${type}(${place.osmId});out tags;`
  const body = new URLSearchParams({ data: query })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body,
      signal: controller.signal,
    })
    if (!response.ok) return {}
    const data = await response.json()
    return data.elements?.[0]?.tags || {}
  } finally {
    clearTimeout(timer)
  }
}

async function fetchWikidataImage(id) {
  if (!id || !/^Q\d+$/i.test(id)) return ''
  const data = await fetchJson(
    `https://www.wikidata.org/w/api.php?origin=*&action=wbgetentities&ids=${id}&props=claims&format=json`,
  )
  const file = data.entities?.[id]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
  return file ? filePath(file) : ''
}

async function fetchWikiAbout(place, areaLabel) {
  const query = `${place.name} ${areaLabel || ''}`.trim()
  const data = await fetchJson(
    `https://es.wikipedia.org/w/api.php?origin=*&action=query&format=json&prop=extracts|pageimages&exintro=1&explaintext=1&pithumbsize=900&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(query)}`,
  )
  const page = Object.values(data.query?.pages || {})[0]
  if (!page || !nameMatches(place.name, page.title)) return {}
  return { extract: page.extract || '', image: page.thumbnail?.source || '' }
}

async function commonsPhotos(place) {
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return []
  const geo = await fetchJson(
    `https://commons.wikimedia.org/w/api.php?origin=*&action=query&list=geosearch&gscoord=${place.lat}|${place.lon}&gsradius=70&gsnamespace=6&gslimit=8&format=json`,
  )
  const hits = (geo.query?.geosearch || [])
    .filter((item) => !SKIP_PHOTO.test(item.title))
    .filter((item) => nameMatches(place.name, item.title))
  if (!hits.length) return []
  const ids = hits.map((item) => item.pageid).join('|')
  const info = await fetchJson(
    `https://commons.wikimedia.org/w/api.php?origin=*&action=query&pageids=${ids}&prop=imageinfo&iiprop=url&iiurlwidth=1200&format=json`,
  )
  return Object.values(info.query?.pages || {})
    .map((page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url)
    .filter(Boolean)
}

function uniquePhotos(urls) {
  const seen = new Set()
  const list = []
  for (const url of urls) {
    if (!url || seen.has(url)) continue
    seen.add(url)
    list.push(url)
  }
  return list
}

function buildAbout(place, tags, hours) {
  if (tags.description) return tags.description
  if (place.description) return place.description
  const bits = [place.type]
  if (tags.cuisine || place.cuisine) bits.push(`cocina ${(tags.cuisine || place.cuisine).replace(/;/g, ', ')}`)
  if (place.certified || ['yes', 'only'].includes(String(tags['diet:gluten_free'] || '').toLowerCase())) {
    bits.push('con opción o sello sin TACC en OpenStreetMap')
  }
  if (hours.openLabel) bits.push(hours.openLabel.toLowerCase())
  if (place.address) bits.push(`en ${place.address}`)
  return `${place.name} es ${bits.join(', ')}.`
}

/** Card thumbnail: the scraper returns a photo of this place, or nothing. */
export async function loadCardPhoto(place, area = '') {
  if (place.image) return place.image
  const key = `${place.name}|${place.lat}|${place.lon}`
  if (photoCache.has(key)) return photoCache.get(key)

  return withSlot(async () => {
    if (photoCache.has(key)) return photoCache.get(key)
    let url = ''
    try {
      const data = await fetchJson(`/api/place-photo?${placeParams(place, area)}`, 25000)
      url = data?.photo || ''
    } catch {
      url = ''
    }
    if (!url) {
      try {
        url = (await commonsPhotos(place))[0] || ''
      } catch {
        url = ''
      }
    }
    photoCache.set(key, url)
    return url
  })
}

/**
 * What the scraper already knows about this place, read straight from the
 * cache: no request goes out, so the whole list can ask at once.
 */
export async function peekGlutenState(place, area = '') {
  try {
    const data = await fetchJson(`/api/place-gf?${placeParams(place, area)}`, 6000)
    return data || { known: false, gfState: 'desconocido' }
  } catch {
    return { known: false, gfState: 'desconocido' }
  }
}

/** Full lookup for a card, used when the user asks to check sin TACC. */
export async function loadGlutenState(place, area = '') {
  return withSlot(async () => {
    try {
      const data = await fetchJson(`/api/place-info?${placeParams(place, area)}`, 40000)
      if (data?.photos?.[0]) photoCache.set(`${place.name}|${place.lat}|${place.lon}`, data.photos[0])
      return data || {}
    } catch {
      return {}
    }
  })
}

async function fetchLivePlace(place, area) {
  const data = await fetchJson(`/api/place-info?${placeParams(place, area)}`, 30000)
  return data || {}
}

function assembleDetails(place, tags, wikiData, photos, live = {}) {
  const osmHours = parseOpeningHours(tags.opening_hours || place.hours || '')
  const hours = live.hoursRows?.length
    ? { rows: live.hoursRows, openLabel: live.openLabel || osmHours.openLabel, todayRange: '' }
    : { ...osmHours, openLabel: live.openLabel || osmHours.openLabel }

  return {
    photos,
    about:
      live.summary ||
      wikiData.extract ||
      tags.description ||
      place.description ||
      buildAbout(place, tags, hours),
    website: live.website || tags.website || tags['contact:website'] || place.website || '',
    menuUrl: tags.menu || place.menuUrl || '',
    phone: live.phone || tags.phone || tags['contact:phone'] || place.phone || '',
    hoursRaw: tags.opening_hours || place.hours || '',
    hours,
    cuisine: tags.cuisine || place.cuisine || '',
    gfOfficial: ['yes', 'only', 'limited'].includes(String(tags['diet:gluten_free'] || '').toLowerCase()),
    menu: live.menu || [],
    gfMentions: live.gfMentions || [],
    gfState: live.gfState || 'desconocido',
    reviews: live.reviews || [],
    rating: live.rating || null,
    reviewCount: live.reviewCount || null,
    features: live.features || [],
    sources: live.sources || [],
    mapEmbed: mapEmbedUrl(place),
  }
}

export async function loadPlaceDetails(place, areaLabel = '', onUpdate) {
  const cacheKey = place.id
  if (detailCache.has(cacheKey)) {
    const cached = detailCache.get(cacheKey)
    onUpdate?.(cached)
    return cached
  }

  // Phase 1: free sources, so the page renders something immediately.
  const [osm, wiki] = await Promise.allSettled([fetchOsmTags(place), fetchWikiAbout(place, areaLabel)])
  const tags = osm.status === 'fulfilled' ? osm.value : {}
  const wikiData = wiki.status === 'fulfilled' ? wiki.value : {}

  const basePhotos = uniquePhotos([place.image, tags.image, tags['image:url']])
  onUpdate?.(assembleDetails(place, tags, wikiData, basePhotos))

  // Phase 2: the scraper (photos, rating, opinions, hours, menu).
  const [live, commons] = await Promise.allSettled([
    fetchLivePlace(place, areaLabel),
    commonsPhotos(place),
  ])
  const liveData = live.status === 'fulfilled' ? live.value : {}
  const commonsList = commons.status === 'fulfilled' ? commons.value : []

  const photos = uniquePhotos([...(liveData.photos || []), ...basePhotos, ...commonsList])
  if (photos[0]) photoCache.set(`${place.name}|${place.lat}|${place.lon}`, photos[0])

  const details = assembleDetails(place, tags, wikiData, photos, liveData)
  detailCache.set(cacheKey, details)
  onUpdate?.(details)
  return details
}

export function formatArs(value) {
  if (!value) return ''
  return `$ ${Number(value).toLocaleString('es-AR')}`
}
