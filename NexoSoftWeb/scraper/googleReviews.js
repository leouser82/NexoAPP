import { fetchPage } from './http.js'
import { extractJsonLd, htmlToText, isUsefulReview, pickBusinessNode, reviewsFromJsonLd, reviewsFromText } from './parse.js'
import { dedupe, readCache, writeCache } from './store.js'

const DAY_MS = 24 * 60 * 60 * 1000
const REVIEW_SITES = /tripadvisor|guiaoleo|restaurantguru|opinions?|rese[nñ]as/i

function mapReview(raw, source) {
  if (!raw) return null
  const text = String(raw.text || raw.body || raw.reviewBody || raw.comment || raw.content || '').trim()
  if (!isUsefulReview(text)) return null
  const author = String(raw.author?.name || raw.author || raw.authorName || raw.user || 'Cliente').trim()
  const stars = Number(raw.rating || raw.stars || raw.reviewRating?.ratingValue) || null
  return { author: author.slice(0, 40) || 'Cliente', text: text.slice(0, 320), stars, source }
}

function celimapId(id = '', guideUrl = '') {
  const fromId = String(id).replace(/^cm-/, '')
  if (/^[a-f0-9]{20,}$/i.test(fromId)) return fromId
  const slug = String(guideUrl).match(/\/lugar\/([^/?#]+)/)?.[1]
  return slug || ''
}

async function fromCelimap(id, guideUrl) {
  const key = celimapId(id, guideUrl)
  if (!key) return { reviews: [], rating: null, reviewCount: null }

  const [placeRaw, listRaw] = await Promise.all([
    fetchPage(`https://www.celimap.com.ar/api/places/${key}`, { timeoutMs: 9000, retries: 0 }),
    fetchPage(`https://www.celimap.com.ar/api/reviews?placeId=${key}&limit=20`, { timeoutMs: 9000, retries: 0 }),
  ])

  let place = null
  try {
    place = JSON.parse(placeRaw || 'null')
  } catch {
    place = null
  }
  let list = []
  try {
    list = JSON.parse(listRaw || '{}').reviews || []
  } catch {
    list = []
  }

  const snap = place?.googleSnapshot || {}
  const reviews = [
    ...list.map((item) => mapReview(item, 'CeliMap')),
    ...(snap.reviews || []).map((item) => mapReview(item, 'Google')),
    ...(snap.glutenRelevant || []).map((item) => mapReview(item, 'Google')),
  ].filter(Boolean)

  return {
    reviews: reviews.slice(0, 8),
    rating: Number(snap.rating) || Number(place?.stats?.avgRating) || null,
    reviewCount: Number(snap.userRatingCount) || Number(place?.stats?.totalReviews) || null,
    mapsUrl: snap.googleMapsUri || '',
    googlePlaceId: place?.googlePlaceId || '',
  }
}

async function fromReviewSites({ name, address, area }) {
  const query = `${name} ${address || area} opiniones`
  const html = await fetchPage(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    timeoutMs: 8000,
    retries: 0,
  })
  if (!html) return []

  const links = [...html.matchAll(/uddg=([^&"]+)/g)]
    .map((match) => {
      try {
        return decodeURIComponent(match[1])
      } catch {
        return ''
      }
    })
    .filter((url) => /^https?:\/\//.test(url) && REVIEW_SITES.test(url))

  for (const url of [...new Set(links)].slice(0, 2)) {
    const page = await fetchPage(url, { timeoutMs: 8000, retries: 0 })
    if (!page) continue
    const node = pickBusinessNode(extractJsonLd(page))
    const found = (node ? reviewsFromJsonLd(node) : []).concat(reviewsFromText(htmlToText(page)))
    const clean = found.filter((item) => isUsefulReview(item.text)).slice(0, 6)
    if (clean.length) return clean.map((item) => ({ ...item, source: url }))
  }
  return []
}

/**
 * Reviews for one place, only when the detail page asks. The list never
 * calls this. CeliMap already copied Google's score; texts come from there
 * when they exist, otherwise from a short look at public review pages.
 */
export async function lookupReviews(query) {
  const key = `reviews:${query.id || query.name}|${query.lat || ''}`
  const cached = readCache(key, DAY_MS)
  if (cached?.reviews?.length || cached?.rating) return cached

  return dedupe(key, async () => {
    const celimap = await fromCelimap(query.id, query.guideUrl).catch(() => ({
      reviews: [],
      rating: null,
      reviewCount: null,
    }))

    let reviews = celimap.reviews || []
    if (!reviews.length) {
      reviews = await Promise.race([
        fromReviewSites(query).catch(() => []),
        new Promise((resolve) => {
          setTimeout(() => resolve([]), 7000)
        }),
      ])
    }

    const data = {
      reviews,
      rating: celimap.rating,
      reviewCount: celimap.reviewCount,
      mapsUrl: celimap.mapsUrl || '',
      googlePlaceId: query.googlePlaceId || celimap.googlePlaceId || '',
    }
    if (data.reviews.length || data.rating) writeCache(key, data)
    return data
  })
}

