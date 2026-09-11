const CATEGORY_PHOTOS = {
  Panadería: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80',
  Confitería: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=900&q=80',
  Dietética: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80',
  Pizzería: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
  'Take away': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80',
  Café: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80',
  Restaurante: 'https://images.unsplash.com/photo-1517248135467-4c7edcad90c4?auto=format&fit=crop&w=900&q=80',
  Farmacia: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=900&q=80',
}

const imageCache = new Map()

const GENERIC_WORD = /^(restaurante|confiter[ií]a|panader[ií]a|diet[eé]tica|farmacia|comida|take|away|cafeter[ií]a|parrilla|el|la|los|las|de|del|y)$/i

function significantTokens(name) {
  return String(name)
    .toLowerCase()
    .split(/[\s\-–,/]+/)
    .filter((token) => token.length > 3 && !GENERIC_WORD.test(token))
}

function wikiMatches(name, title) {
  const tokens = significantTokens(name)
  if (!tokens.length) return false
  const hay = String(title || '').toLowerCase()
  return tokens.some((token) => hay.includes(token))
}

export function categoryPhoto(type) {
  return CATEGORY_PHOTOS[type] || CATEGORY_PHOTOS.Restaurante
}

export function cardPhoto(place) {
  return place.image || categoryPhoto(place.type)
}

async function fetchJson(url, ms = 9000) {
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

export async function resolvePlaceImage(place, areaLabel = '') {
  if (place.image) return place.image
  const key = `${place.name}|${place.type}`
  if (imageCache.has(key)) return imageCache.get(key)

  const fallback = categoryPhoto(place.type)
  const query = `${place.name} ${areaLabel}`.trim()
  const generic = /^(panader[ií]a|farmacia|diet[eé]tica|confiter[ií]a|restaurante|cafeter[ií]a)$/i.test(place.name)

  if (generic) {
    imageCache.set(key, fallback)
    return fallback
  }

  try {
    const wiki = await fetchJson(
      `https://es.wikipedia.org/w/api.php?origin=*&action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=800&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(query)}`,
    )
    const pages = wiki.query?.pages || {}
    const page = Object.values(pages)[0]
    if (page?.thumbnail?.source && wikiMatches(place.name, page.title)) {
      imageCache.set(key, page.thumbnail.source)
      return page.thumbnail.source
    }
  } catch {
    // continue
  }

  try {
    const commons = await fetchJson(
      `https://commons.wikimedia.org/w/api.php?origin=*&action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=1&gsrsearch=${encodeURIComponent(place.name)}&prop=imageinfo&iiprop=url&iiurlwidth=800`,
    )
    const pages = commons.query?.pages || {}
    const url = Object.values(pages)[0]?.imageinfo?.[0]?.thumburl || Object.values(pages)[0]?.imageinfo?.[0]?.url
    if (url) {
      imageCache.set(key, url)
      return url
    }
  } catch {
    // continue
  }

  imageCache.set(key, fallback)
  return fallback
}
