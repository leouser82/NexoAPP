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
  const bits = [place.type.toLowerCase()]
  if (tags.cuisine || place.cuisine) bits.push(`cocina ${(tags.cuisine || place.cuisine).replace(/;/g, ', ')}`)
  if (place.level === 'dedicado') bits.push('publicado como 100% libre de gluten')
  else if (place.level === 'opciones') bits.push('publicado con opciones sin TACC')
  else if (['yes', 'only'].includes(String(tags['diet:gluten_free'] || '').toLowerCase())) {
    bits.push('con opción sin TACC en OpenStreetMap')
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

async function fetchLivePlace(place, area) {
  // En Hostinger responde public/place-info.php; en dev, el mismo path lo
  // atiende el motor en Node.
  const data = await fetchJson(`/place-info.php?${placeParams(place, area)}`, 30000)
  return data || {}
}

/** The guide entry is itself the sin TACC evidence, with its own link. */
function guideMention(place) {
  if (!place.level) return []
  const guides = place.guides?.length ? place.guides : ['La guía']
  const verb = guides.length > 1 ? 'lo publican' : 'lo publica'
  const text =
    place.level === 'dedicado'
      ? `${guides.join(' y ')} ${verb} como local 100% libre de gluten. No es una certificación: confirmá el protocolo y la contaminación cruzada en el local.`
      : `${guides.join(' y ')} ${verb} con opciones sin TACC. Confirmá en el local cómo manejan la contaminación cruzada.`
  return [{ text, source: place.guideUrl || 'https://www.celimap.com.ar/mapa' }]
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
    gfOfficial:
      place.level === 'dedicado' ||
      ['yes', 'only', 'limited'].includes(String(tags['diet:gluten_free'] || '').toLowerCase()),
    level: place.level || '',
    guides: place.guides || [],
    guideUrl: place.guideUrl || '',
    guideFacts: [
      ['Cocina', place.kitchen],
      ['Materia prima', place.supply],
      ['Modalidad', place.mode],
      ['Cuidados', place.care],
    ]
      .filter(([, value]) => value)
      .map(([label, value]) => ({ label, value })),
    menu: live.menu || [],
    gfMentions: [...guideMention(place), ...(live.gfMentions || [])].slice(0, 4),
    gfState: place.level ? 'confirmado' : live.gfState || 'desconocido',
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

  // What the guide already gave us: photos, hours and level, with no waiting.
  onUpdate?.(assembleDetails(place, {}, {}, uniquePhotos([...(place.photos || []), place.image])))

  // Phase 1: free sources, to fill in what the guide does not carry.
  const [osm, wiki] = await Promise.allSettled([fetchOsmTags(place), fetchWikiAbout(place, areaLabel)])
  const tags = osm.status === 'fulfilled' ? osm.value : {}
  const wikiData = wiki.status === 'fulfilled' ? wiki.value : {}

  const basePhotos = uniquePhotos([...(place.photos || []), place.image, tags.image, tags['image:url']])
  onUpdate?.(assembleDetails(place, tags, wikiData, basePhotos))

  // Phase 2: the scraper (photos, rating, opinions, hours, menu).
  const [live, commons] = await Promise.allSettled([
    fetchLivePlace(place, areaLabel),
    commonsPhotos(place),
  ])
  const liveData = live.status === 'fulfilled' ? live.value : {}
  const commonsList = commons.status === 'fulfilled' ? commons.value : []

  // The guide's own photos go first: they are the ones tied to this place.
  const photos = uniquePhotos([...basePhotos, ...(liveData.photos || []), ...commonsList])
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
