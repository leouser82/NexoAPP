import { fetchPage } from './http.js'
import {
  addressFrom,
  decodeEntities,
  descriptionFrom,
  distinctiveTokens,
  extractJsonLd,
  featuresFrom,
  filterPhotos,
  glutenMentions,
  hoursFromJsonLd,
  hoursFromText,
  hoursToRows,
  htmlToText,
  imagesFrom,
  menuFrom,
  normalizeKey,
  pickBusinessNode,
  ratingFromJsonLd,
  ratingFromText,
  relevanceScore,
  reviewsFromJsonLd,
  reviewsFromText,
  todayLabel,
} from './parse.js'

const DENY_HOST =
  /google\.|gstatic|googleusercontent|youtube|duckduckgo|bing\.com|mojeek|wikipedia|wikimedia|facebook\.com\/(?:login|sharer)|instagram\.com\/accounts|twitter\.com|x\.com|pinterest|linkedin|apple\.com|doubleclick|amazon\.|mercadolibre\.com\.ar\/(?:jm|gz)/i

const DENY_PATH = /\.(?:pdf|jpg|jpeg|png|gif|webp|zip|mp4|svg|css|js)(?:\?|$)/i

/** Pages that usually hold structured local-business data. */
const PREFERRED_HOST =
  /helvetica|guiaoleo|restaurantguru|tripadvisor|yelp|cylex|paginasamarillas|opentable|pedidosya|rappi|foursquare|zonagastronomica|donde|eltenedor|thefork|infocomercial|puntosdeventa|nuestrosnegocios|comolle|barrio|clasificados/i

/** Bloom-style bitmap: cheap dedupe of visited URLs without storing every string. */
class UrlFilter {
  constructor(bits = 1 << 16) {
    this.bits = new Uint8Array(bits)
    this.size = bits
  }

  hashes(value) {
    let h1 = 2166136261
    let h2 = 5381
    for (let i = 0; i < value.length; i += 1) {
      h1 = (h1 ^ value.charCodeAt(i)) * 16777619
      h2 = (h2 * 33 + value.charCodeAt(i)) | 0
    }
    const a = Math.abs(h1) % this.size
    const b = Math.abs(h2) % this.size
    const c = Math.abs(h1 ^ h2) % this.size
    return [a, b, c]
  }

  seen(url) {
    const [a, b, c] = this.hashes(url)
    return this.bits[a] === 1 && this.bits[b] === 1 && this.bits[c] === 1
  }

  add(url) {
    for (const index of this.hashes(url)) this.bits[index] = 1
  }
}

function canonical(url) {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    for (const param of [...parsed.searchParams.keys()]) {
      if (/^utm_|^fbclid|^gclid|^ref$/i.test(param)) parsed.searchParams.delete(param)
    }
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

function allowed(url) {
  const clean = canonical(url)
  if (!clean) return false
  if (DENY_HOST.test(clean) || DENY_PATH.test(clean)) return false
  return /^https?:\/\//.test(clean)
}

function decodeSearchHref(href) {
  const ddg = href.match(/uddg=([^&]+)/)
  if (ddg) return decodeURIComponent(ddg[1])
  if (href.startsWith('//duckduckgo.com/l/')) return ''
  return href
}

function linksFrom(html, baseUrl) {
  const links = []
  for (const match of String(html || '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{0,160}?)<\/a>/gi)) {
    const raw = decodeEntities(decodeSearchHref(match[1]))
    if (!raw) continue
    let absolute = raw
    if (raw.startsWith('/')) {
      try {
        absolute = new URL(raw, baseUrl).toString()
      } catch {
        continue
      }
    }
    if (!allowed(absolute)) continue
    links.push({ url: canonical(absolute), anchor: htmlToText(match[2]) })
  }
  return links
}

const SEARCH_ENGINES = [
  (query) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
  (query) => `https://www.mojeek.com/search?q=${encodeURIComponent(query)}`,
  (query) => `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,
]

function rank(candidate, nameTokens) {
  let score = 0
  const url = normalizeKey(candidate.url)
  const anchor = normalizeKey(candidate.anchor)
  if (PREFERRED_HOST.test(url)) score += 6
  for (const token of nameTokens) {
    if (anchor.includes(token)) score += 2
    if (url.includes(token)) score += 1
  }
  if (/horario|opiniones|resenas|telefono|direccion|menu|carta/.test(url)) score += 2
  return score
}

function streetTokens(address) {
  return normalizeKey(address)
    .replace(/\b\d+\b/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 4 && !/^(avenida|calle|general|presidente|teniente|doctor)$/.test(token))
    .sort((a, b) => b.length - a.length)
    .slice(0, 2)
}

/** Is "<street> <number>" actually written on the page, in either order? */
function addressAppears(text, address, number) {
  const haystack = normalizeKey(text)
  const streets = streetTokens(address)
  if (!streets.length) return haystack.includes(number)

  // Allow a few words in between: "Rodriguez Peña 264", "264 Rodriguez Peña".
  return streets.some(
    (street) =>
      new RegExp(`${street}.{0,28}${number}`).test(haystack) ||
      new RegExp(`${number}.{0,28}${street}`).test(haystack),
  )
}

function parsePage(html, url, { name, address, area }) {
  const text = htmlToText(html)
  if (text.length < 200) return null

  const title = decodeEntities((html.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i) || [, ''])[1])
  const score = relevanceScore({ text, title, name, address, area })
  if (score < 4) return null

  // Street numbers are the strongest evidence available: a page about the shop
  // two blocks away shares the street name but never the number. The number
  // must sit next to the street name, since directories also list neighbours.
  const number = (String(address).match(/\b\d{2,5}\b/) || [])[0]
  let addressVerified = false
  if (number) {
    if (!addressAppears(text, address, number)) return null
    addressVerified = true
  } else {
    // No number: we need both a real name and the street written on the page.
    const haystack = normalizeKey(text)
    const streetOk = streetTokens(address).some((street) => haystack.includes(street))
    if (!distinctiveTokens(name).length || !streetOk) return null
  }

  // Only a detail page about this place may contribute photos; listing pages
  // would hand us their own site artwork.
  const nameTokens = normalizeKey(name)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3)
  const titleMatch = nameTokens.length
    ? nameTokens.every((token) => normalizeKey(title).includes(token))
    : false
  const listing = /\b(?:listado|listing|directorio|rubro|categor[ií]a|en\s+\w+\s*$)/i.test(title) && !titleMatch

  const nodes = extractJsonLd(html)
  const node = pickBusinessNode(nodes)

  const ldHours = node ? hoursFromJsonLd(node) : new Map()
  const hoursMap = ldHours.size ? ldHours : hoursFromText(text)
  const rows = hoursToRows(hoursMap)

  const ldRating = node ? ratingFromJsonLd(node) : { rating: null, reviewCount: null }
  const textRating = ratingFromText(text)
  const jsonReviews = node ? reviewsFromJsonLd(node) : []

  return {
    score,
    source: canonical(url),
    structured: Boolean(node),
    // A generic name matches any bakery's file names, so those places only get
    // photos from a page that also proves the street number.
    photos:
      titleMatch && !listing && (addressVerified || distinctiveTokens(name).length)
        ? filterPhotos(imagesFrom(html, node), name)
        : [],
    rating: ldRating.rating ?? textRating.rating,
    reviewCount: ldRating.reviewCount ?? textRating.reviewCount,
    reviews: jsonReviews.length ? jsonReviews : reviewsFromText(text),
    hoursRows: rows,
    openLabel: todayLabel(rows),
    features: featuresFrom(text, node),
    menu: menuFrom(text, node),
    gfMentions: glutenMentions(text).map((quote) => ({ text: quote, source: canonical(url) })),
    phone: decodeEntities(node?.telephone || (text.match(/(?:\+54|011|\(11\))[\d\s\-.]{6,14}/) || [''])[0]).trim(),
    address: addressFrom(node),
    summary: descriptionFrom(html, node, text),
    website: typeof node?.url === 'string' && allowed(node.url) ? node.url : '',
  }
}

function mergeRecords(records) {
  const best = {
    photos: [],
    rating: null,
    reviewCount: null,
    reviews: [],
    hoursRows: [],
    openLabel: '',
    features: [],
    menu: [],
    gfMentions: [],
    phone: '',
    address: '',
    summary: '',
    website: '',
    sources: [],
  }

  // Structured pages win; higher relevance breaks ties.
  const ordered = [...records].sort(
    (a, b) => Number(b.structured) - Number(a.structured) || b.score - a.score,
  )

  for (const record of ordered) {
    best.sources.push(record.source)
    best.photos = [...new Set([...best.photos, ...record.photos])].slice(0, 10)
    if (best.rating == null && record.rating != null) best.rating = record.rating
    if (best.reviewCount == null && record.reviewCount != null) best.reviewCount = record.reviewCount
    if (!best.reviews.length && record.reviews.length) best.reviews = record.reviews
    if (!best.hoursRows.length && record.hoursRows.length) {
      best.hoursRows = record.hoursRows
      best.openLabel = record.openLabel
    }
    if (!best.features.length && record.features.length) best.features = record.features
    if (!best.menu.length && record.menu.length) best.menu = record.menu
    for (const mention of record.gfMentions || []) {
      if (best.gfMentions.length < 3 && !best.gfMentions.some((item) => item.text === mention.text)) {
        best.gfMentions.push(mention)
      }
    }
    if (!best.phone && record.phone) best.phone = record.phone
    if (!best.address && record.address) best.address = record.address
    if (!best.summary && record.summary) best.summary = record.summary
    if (!best.website && record.website) best.website = record.website
  }

  best.sources = [...new Set(best.sources)].slice(0, 4)
  // Facebook CDN links carry an expiry token, so keep them as a last resort.
  best.photos.sort((a, b) => Number(/fbcdn/i.test(a)) - Number(/fbcdn/i.test(b)))
  return best
}

/**
 * Focused search for gluten-free claims. It skips the street-number rule,
 * because a bakery's own page about being sin TACC often omits the address, so
 * instead it demands the full name in the title plus the area in the body, and
 * it only ever returns quoted sentences with their source.
 */
export async function crawlGluten({ name, area = '', address = '' }) {
  const tokens = distinctiveTokens(name)
  if (!tokens.length) return []

  // With a single common token ("Chino") any directory page would match, so
  // those places also need their street number printed on the page.
  const number = (String(address).match(/\b\d{2,5}\b/) || [])[0] || ''
  const needsAddress = tokens.length < 2 && tokens[0].length < 7
  if (needsAddress && !number) return []

  const where = [area, address].filter(Boolean)[0] || ''
  const queries = [`${name} ${where} sin tacc`.trim(), `${name} ${where} sin gluten celiacos`.trim()]
  const filter = new UrlFilter()
  const mentions = []

  for (const query of queries) {
    const results = await fetchPage(SEARCH_ENGINES[0](query))
    if (!results) continue

    const candidates = linksFrom(results, 'https://duckduckgo.com/')
      .map((candidate) => ({ ...candidate, rank: rank(candidate, tokens) }))
      .filter((candidate) => candidate.rank >= 2 && !filter.seen(candidate.url))
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 2)

    for (const candidate of candidates) {
      filter.add(candidate.url)
      const html = await fetchPage(candidate.url, { referer: 'https://duckduckgo.com/' })
      if (!html) continue

      const title = normalizeKey(
        decodeEntities((html.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i) || [, ''])[1]),
      )
      const text = htmlToText(html)
      const haystack = normalizeKey(text)
      const areaOk = !area || normalizeKey(area).split(/[^a-z0-9]+/).some((token) => token.length > 3 && haystack.includes(token))
      if (!tokens.every((token) => title.includes(token)) || !areaOk) continue
      if (needsAddress && !addressAppears(text, address, number)) continue

      for (const quote of glutenMentions(text)) {
        if (mentions.length >= 3) return mentions
        if (!mentions.some((item) => item.text === quote)) {
          mentions.push({ text: quote, source: canonical(candidate.url) })
        }
      }
    }
    if (mentions.length) break
  }

  return mentions
}

/**
 * Breadth-first crawl: search results → candidate pages → (optionally) one level
 * deeper when a listing links to the place. Stops as soon as the data is complete.
 */
export async function crawlPlace({ name, address, area = '', type = '', maxPages = 4 }) {
  const nameTokens = normalizeKey(name)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3)

  const filter = new UrlFilter()
  const where = [address, area].filter(Boolean).join(' ')
  const queries = [
    `${name} ${where}`.trim(),
    `${name} ${where} horarios opiniones`.trim(),
    [type, where].filter(Boolean).join(' ').trim(),
  ].filter(Boolean)

  // Search plan, consumed lazily: extra engines/queries only run when the
  // cheaper ones produced no usable candidate.
  const plan = []
  for (const query of queries) for (const engine of SEARCH_ENGINES) plan.push(engine(query))

  const frontier = []
  const records = []
  let fetched = 0

  const expand = () => {
    while (plan.length) {
      const url = plan.shift()
      if (filter.seen(url)) continue
      filter.add(url)
      frontier.push({ url, depth: 0 })
      return true
    }
    return false
  }

  expand()

  while (fetched < maxPages) {
    if (!frontier.length && !expand()) break
    const next = frontier.shift()
    if (!next) continue
    const { url, depth } = next

    const html = await fetchPage(url, { referer: depth === 0 ? '' : 'https://duckduckgo.com/' })
    if (!html) continue

    if (depth === 0) {
      const candidates = linksFrom(html, url)
        .map((candidate) => ({ ...candidate, rank: rank(candidate, nameTokens) }))
        .filter((candidate) => candidate.rank > 0)
        .sort((a, b) => b.rank - a.rank)

      for (const candidate of candidates.slice(0, 4)) {
        if (filter.seen(candidate.url)) continue
        filter.add(candidate.url)
        frontier.push({ url: candidate.url, depth: 1 })
      }
      continue
    }

    fetched += 1
    const record = parsePage(html, url, { name, address, area })
    if (record) {
      records.push(record)
      const done = record.hoursRows.length && record.rating != null && record.reviews.length
      if (done) break
    } else if (depth === 1) {
      // Listing page: follow the anchor that names this place (depth-first drill down).
      const deeper = linksFrom(html, url)
        .map((candidate) => ({ ...candidate, rank: rank(candidate, nameTokens) }))
        .filter((candidate) => candidate.rank >= 2)
        .sort((a, b) => b.rank - a.rank)
      for (const candidate of deeper.slice(0, 2)) {
        if (filter.seen(candidate.url)) continue
        filter.add(candidate.url)
        frontier.push({ url: candidate.url, depth: 2 })
      }
    }
  }

  return mergeRecords(records)
}
