const DAY_ORDER = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const DAY_ALIASES = {
  sunday: 'Domingo',
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  su: 'Domingo',
  mo: 'Lunes',
  tu: 'Martes',
  we: 'Miércoles',
  th: 'Jueves',
  fr: 'Viernes',
  sa: 'Sábado',
  domingo: 'Domingo',
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  miércoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  sábado: 'Sábado',
}

const ENTITIES = {
  nbsp: ' ',
  amp: '&',
  quot: '"',
  apos: "'",
  ndash: '–',
  mdash: '—',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  ntilde: 'ñ',
  Aacute: 'Á',
  Eacute: 'É',
  Iacute: 'Í',
  Oacute: 'Ó',
  Uacute: 'Ú',
  Ntilde: 'Ñ',
  uuml: 'ü',
  deg: '°',
  hellip: '…',
}

export function decodeEntities(input) {
  return String(input || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => ENTITIES[name] ?? match)
}

export function htmlToText(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

const GENERIC_WORD =
  /^(?:panaderia|confiteria|panificadora|restaurante|resto|parrilla|pizzeria|pizza|cafe|cafeteria|bar|farmacia|dietetica|kiosco|almacen|supermercado|heladeria|comida|rotiseria|take|away|de|del|la|el|los|las|y|san|santa)$/

export function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** JSON-LD blocks are the most reliable source: schema.org LocalBusiness. */
export function extractJsonLd(html) {
  const nodes = []
  for (const match of String(html || '').matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const raw = match[1].trim().replace(/^<!\[CDATA\[|\]\]>$/g, '')
    try {
      const parsed = JSON.parse(raw)
      const queue = Array.isArray(parsed) ? [...parsed] : [parsed]
      while (queue.length) {
        const node = queue.shift()
        if (!node || typeof node !== 'object') continue
        if (Array.isArray(node['@graph'])) queue.push(...node['@graph'])
        nodes.push(node)
      }
    } catch {
      // malformed block, keep going
    }
  }
  return nodes
}

const BUSINESS_TYPES =
  /restaurant|bakery|store|localbusiness|foodestablishment|cafe|pharmacy|shop|grocery|organization|place/i

export function pickBusinessNode(nodes) {
  const typed = nodes.filter((node) => {
    const type = Array.isArray(node['@type']) ? node['@type'].join(' ') : node['@type']
    return BUSINESS_TYPES.test(String(type || ''))
  })
  // Prefer the node carrying the most useful fields.
  return (
    typed.sort((a, b) => scoreNode(b) - scoreNode(a))[0] ||
    nodes.find((node) => node.aggregateRating || node.openingHoursSpecification) ||
    null
  )
}

function scoreNode(node) {
  let score = 0
  if (node.aggregateRating) score += 4
  if (node.openingHoursSpecification || node.openingHours) score += 4
  if (node.review) score += 3
  if (node.image) score += 2
  if (node.address) score += 1
  if (node.telephone) score += 1
  if (node.hasMenu || node.menu) score += 2
  return score
}

function asArray(value) {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function timePart(value) {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/)
  if (!match) return ''
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

/** openingHoursSpecification → { Lunes: ['08:00 – 19:00'] } */
export function hoursFromJsonLd(node) {
  const byDay = new Map()
  const add = (day, range) => {
    if (!day || !range) return
    const list = byDay.get(day) || []
    if (!list.includes(range)) list.push(range)
    byDay.set(day, list)
  }

  for (const spec of asArray(node?.openingHoursSpecification)) {
    const opens = timePart(spec?.opens)
    const closes = timePart(spec?.closes)
    if (!opens || !closes) continue
    for (const raw of asArray(spec?.dayOfWeek)) {
      const key = normalizeKey(String(raw).split('/').pop())
      const day = DAY_ALIASES[key] || DAY_ALIASES[key.slice(0, 2)]
      add(day, `${opens} – ${closes}`)
    }
  }

  for (const line of asArray(node?.openingHours)) {
    const text = String(line)
    const times = [...text.matchAll(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/g)]
    if (!times.length) continue
    const dayTokens = [...text.matchAll(/\b([A-Za-z]{2,9})\b/g)].map((m) => normalizeKey(m[1]))
    const days = dayTokens.map((token) => DAY_ALIASES[token] || DAY_ALIASES[token.slice(0, 2)]).filter(Boolean)
    const targets = days.length ? days : DAY_ORDER
    for (const day of targets) {
      for (const time of times) add(day, `${timePart(time[1])} – ${timePart(time[2])}`)
    }
  }

  return byDay
}

/**
 * Plain-text fallback. Handles "Lunes 08:00–14:00, 15:30–19:00" and the
 * layout used by directory sites, where the day and the range sit on
 * separate lines ("Lunes Lun \n 07:00-21:00").
 */
export function hoursFromText(text) {
  const byDay = new Map()
  for (const day of DAY_ORDER) {
    const pattern = new RegExp(
      `${day}[^\\d]{0,24}((?:\\d{1,2}[:.]\\d{2}\\s*(?:[–\\-]|a)\\s*\\d{1,2}[:.]\\d{2})(?:[^\\d]{0,6}\\d{1,2}[:.]\\d{2}\\s*(?:[–\\-]|a)\\s*\\d{1,2}[:.]\\d{2})*)`,
      'i',
    )
    const match = text.match(pattern)
    if (!match) continue
    const ranges = [...match[1].matchAll(/(\d{1,2})[:.](\d{2})\s*(?:[–\-]|a)\s*(\d{1,2})[:.](\d{2})/g)].map(
      (m) => `${m[1].padStart(2, '0')}:${m[2]} – ${m[3].padStart(2, '0')}:${m[4]}`,
    )
    if (ranges.length) byDay.set(day, ranges)
  }
  if (/24\s*horas|24\/7|abierto siempre/i.test(text) && !byDay.size) {
    for (const day of DAY_ORDER) byDay.set(day, ['00:00 – 24:00'])
  }
  return byDay
}

export function hoursToRows(byDay) {
  return DAY_ORDER.filter((day) => byDay.has(day)).map((day) => ({
    key: day.slice(0, 2),
    day,
    range: byDay.get(day).join(' / '),
  }))
}

export function todayLabel(rows) {
  if (!rows.length) return ''
  const now = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const map = { Sun: 'Domingo', Mon: 'Lunes', Tue: 'Martes', Wed: 'Miércoles', Thu: 'Jueves', Fri: 'Viernes', Sat: 'Sábado' }
  const dayName = map[now.find((p) => p.type === 'weekday')?.value] || ''
  const minutes =
    Number(now.find((p) => p.type === 'hour')?.value || 0) * 60 +
    Number(now.find((p) => p.type === 'minute')?.value || 0)
  const row = rows.find((item) => item.day === dayName)
  if (!row) return 'Hoy cerrado'

  for (const range of row.range.split(' / ')) {
    const [from, to] = range.split('–').map((part) => part.trim())
    const [fh, fm] = from.split(':').map(Number)
    const [th, tm] = to.split(':').map(Number)
    const start = fh * 60 + fm
    const end = th * 60 + tm
    if (minutes >= start && minutes < end) return `Abierto · cierra ${to}`
    if (minutes < start) return `Cerrado · abre ${from}`
  }
  return 'Cerrado por hoy'
}

export function ratingFromJsonLd(node) {
  const agg = node?.aggregateRating
  if (!agg) return { rating: null, reviewCount: null }
  const best = Number(agg.bestRating || 5)
  let rating = Number(String(agg.ratingValue || '').replace(',', '.'))
  if (!Number.isFinite(rating)) rating = null
  if (rating && best && best !== 5) rating = Number(((rating / best) * 5).toFixed(1))
  const count = Number(String(agg.reviewCount || agg.ratingCount || '').replace(/\D/g, ''))
  return { rating, reviewCount: Number.isFinite(count) && count ? count : null }
}

export function ratingFromText(text) {
  const overTen = text.match(/(\d(?:[.,]\d)?)\s*\/\s*10/)
  const overFive = text.match(/(\d(?:[.,]\d)?)\s*(?:\/\s*5|puntos sobre 5|estrellas|de 5)/i)
  const parens = text.match(/(\d(?:[.,]\d)?)\s*\(\s*([\d.]+)\s*(?:reseñas|opiniones|reviews)/i)
  const count = text.match(/([\d.]{1,7})\s*(?:reseñas|opiniones|reviews)/i)

  let rating = null
  if (overFive) rating = Number(overFive[1].replace(',', '.'))
  else if (overTen) rating = Number((Number(overTen[1].replace(',', '.')) / 2).toFixed(1))
  else if (parens) {
    const value = Number(parens[1].replace(',', '.'))
    rating = value > 5 ? Number((value / 2).toFixed(1)) : value
  }
  if (rating && (rating < 1 || rating > 5)) rating = null

  const reviewCount = count ? Number(count[1].replace(/\./g, '')) : parens ? Number(parens[2].replace(/\./g, '')) : null
  return { rating, reviewCount: Number.isFinite(reviewCount) ? reviewCount : null }
}

const REVIEW_NOISE =
  /cookie|javascript|iniciar sesi|pol[ií]tica|privacidad|t[eé]rminos|suscrib|copyright|derechos reservados|script|http|www\./i

export function reviewsFromJsonLd(node) {
  return asArray(node?.review)
    .map((review) => {
      const body = decodeEntities(review?.reviewBody || review?.description || '').trim()
      if (!body || body.length < 15 || REVIEW_NOISE.test(body)) return null
      const authorRaw = review?.author
      const author = decodeEntities(
        (typeof authorRaw === 'string' ? authorRaw : authorRaw?.name) || 'Cliente',
      ).trim()
      const stars = Number(review?.reviewRating?.ratingValue) || null
      return { author: author.slice(0, 40) || 'Cliente', text: body.slice(0, 320), stars }
    })
    .filter(Boolean)
    .slice(0, 8)
}

/** Quoted opinions inside directory articles ("excelente atención"). */
export function reviewsFromText(text) {
  const found = []
  const seen = new Set()
  for (const match of text.matchAll(/[“"]([^”"]{12,240})[”"]/g)) {
    const line = match[1].trim()
    const key = normalizeKey(line)
    if (seen.has(key) || REVIEW_NOISE.test(line)) continue
    if (!/[a-záéíóúñ]/i.test(line)) continue
    if (!/(excelente|muy |rico|buen|fresc|atenci|calidad|recomiend|cordial|amable|delicios|precio|variedad|servicio)/i.test(line)) {
      continue
    }
    seen.add(key)
    found.push({ author: 'Cliente', text: line, stars: null })
    if (found.length >= 8) break
  }
  return found
}

const PHOTO_JUNK =
  /logo|sprite|placeholder|avatar|icon|favicon|blank|pixel|default|og-image|og_image|share[-_]?image|no-destacada|sin-imagen|banner|\/ads?\/|chat__|[-_]map\.|\/maps\/|spacer|loader|stars?[-_]|flag|pattern|watermark/i

export function imagesFrom(html, node) {
  const found = []
  for (const image of asArray(node?.image)) {
    const url = typeof image === 'string' ? image : image?.url || image?.contentUrl
    if (url) found.push(url)
  }
  for (const attr of ['content']) {
    for (const match of String(html || '').matchAll(
      new RegExp(
        `<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]+${attr}=["']([^"']+)["']`,
        'gi',
      ),
    )) {
      found.push(match[1])
    }
  }
  for (const match of String(html || '').matchAll(
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/gi,
  )) {
    found.push(match[1])
  }
  // Gallery images, including the lazy-loading attributes directories use.
  for (const match of String(html || '').matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0]
    for (const attr of ['data-src', 'data-original', 'data-lazy-src', 'src']) {
      const value = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, 'i'))
      if (value) found.push(value[1])
    }
  }
  return [
    ...new Set(
      found
        .map((url) => decodeEntities(url).trim())
        .filter((url) => /^https?:\/\//.test(url))
        .filter((url) => !PHOTO_JUNK.test(url))
        .filter((url) => !/\.svg(?:\?|$)|\.gif(?:\?|$)/i.test(url))
        // Reviewer avatars and tiny thumbnails: /s30-, =s48, =w60.
        .filter((url) => !/[=/][swh](?:[0-9]|[1-9][0-9]|1[0-9]{2})[-=/]/i.test(url))
        .filter((url) => !/googleusercontent\.com\/.*\/photo\.jpg/i.test(url)),
    ),
  ]
}

/**
 * Keep only photos that plausibly belong to this place: either the file name
 * carries a token of the place name, or it sits on a photo CDN used by review
 * sites. Anything else is site branding and would be the same for every place.
 */
export function filterPhotos(urls, name) {
  const tokens = normalizeKey(name)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3)
  const needed = tokens.length >= 3 ? 2 : tokens.length
  // Hosts that only ever serve user photos of the business itself.
  const reviewCdn = /img\d*\.restaurantguru\.com|media-cdn\.tripadvisor|dynamic-media-cdn\.tripadvisor|lh\d\.googleusercontent\.com|scontent[^/]*\.fbcdn\.net/i

  const seen = new Set()
  const kept = []
  for (const url of urls) {
    const file = normalizeKey(url.split('?')[0].split('/').pop() || '')
    const small = file.match(/[-_](\d{2,4})x(\d{2,4})\./)
    if (small && Number(small[1]) < 300) continue

    const hits = tokens.filter((token) => file.includes(token)).length
    const byName = needed > 0 && hits >= needed
    if (!byName && !reviewCdn.test(url)) continue

    const key = file.replace(/[-_]\d{2,4}x\d{2,4}\./, '.')
    if (seen.has(key)) continue
    seen.add(key)
    kept.push(url)
  }
  return kept
}

export function featuresFrom(text, node) {
  const features = []
  const add = (label, ok) => {
    if (!features.some((item) => item.label === label)) features.push({ label, ok })
  }
  if (node?.hasDeliveryMethod || /entrega a domicilio|delivery|env[ií]o a domicilio/i.test(text)) {
    add('Entrega a domicilio', true)
  }
  if (/no dispone de espacio para el consumo|no.{0,20}consumo en el local|solo para llevar|estrictamente de despacho/i.test(text)) {
    add('Consumo en el lugar', false)
  } else if (/consumo en el lugar|para comer ac[áa]|sal[óo]n comedor|mesas disponibles/i.test(text)) {
    add('Consumo en el lugar', true)
  }
  if (/para llevar|take ?away|takeout/i.test(text)) add('Para llevar', true)
  if (/reserv(a|as|ar)\b/i.test(text)) add('Reservas', true)
  if (/acepta (tarjetas|mercado pago|d[eé]bito)/i.test(text)) add('Tarjetas', true)
  if (/accesible|silla de ruedas|wheelchair/i.test(text)) add('Accesible', true)
  return features.slice(0, 6)
}

const GF_HINT = /sin\s*tacc|sintacc|sin gluten|gluten\s*free|celiac|libre de gluten|premezcla/i
const PRICE_HINT = /\$\s?\d{1,3}(?:[.\s]\d{3})+|\$\s?\d{3,6}/

export function menuFrom(text, node) {
  const items = []
  const seen = new Set()

  for (const section of asArray(node?.hasMenu?.hasMenuSection || node?.hasMenu)) {
    for (const item of asArray(section?.hasMenuItem)) {
      const name = decodeEntities(item?.name || '').trim()
      if (!name) continue
      const price = Number(String(item?.offers?.price || '').replace(/[^\d]/g, '')) || null
      const key = normalizeKey(name)
      if (seen.has(key)) continue
      seen.add(key)
      items.push({ name: name.slice(0, 90), price, gf: GF_HINT.test(name) })
    }
  }

  for (const line of text.split('\n')) {
    const clean = line.replace(/^[\-•*\d.)\s]+/, '').trim()
    if (clean.length < 6 || clean.length > 110) continue
    const gf = GF_HINT.test(clean)
    const hasPrice = PRICE_HINT.test(clean)
    if (!gf && !hasPrice) continue
    if (REVIEW_NOISE.test(clean)) continue
    const name = clean
      .replace(PRICE_HINT, ' ')
      // Delivery sites write "Con Curry cuesta $25.700,00": keep only the dish.
      .replace(/[,.]\d{2}(?=\D|$)/g, ' ')
      .replace(/\b(?:cuesta|precio|vale|desde)\b/gi, ' ')
      .replace(/^[\s,.;:$-]+|[\s,.;:$-]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    const key = normalizeKey(name)
    // A price with no dish attached is leftover markup, not a menu item.
    if (name.replace(/[^a-záéíóúñ]/gi, '').length < 4 || seen.has(key)) continue
    seen.add(key)
    const price = hasPrice ? Number(clean.match(PRICE_HINT)[0].replace(/[^\d]/g, '')) || null : null
    items.push({ name: name.slice(0, 90), price, gf })
    if (items.length >= 18) break
  }

  return items
}

/**
 * Sentences where the place is said to handle gluten-free food. These are
 * quoted verbatim with their source, because "sin TACC" is never something the
 * app should claim on its own.
 */
export function glutenMentions(text) {
  const found = []
  const seen = new Set()
  for (const raw of String(text).split(/(?<=[.!?])\s+|\n/)) {
    const line = raw.trim().replace(/\s{2,}/g, ' ')
    if (line.length < 20 || line.length > 260) continue
    if (!GF_HINT.test(line)) continue
    if (REVIEW_NOISE.test(line)) continue
    // Titles, nav and directory headings, which say nothing about this place.
    if (line.includes('|') || line.startsWith('¿')) continue
    if (/saltar al contenido|sugerir lugar|men[uú] principal|iniciar sesi|ver m[aá]s|filtrar|buscar/i.test(line)) continue
    if (/\bmejor(?:es)?\b|\btop\s*\d|gu[ií]a\b|listado|ranking|d[oó]nde comer|lugares para comer|mapa\b/i.test(line)) continue
    const key = normalizeKey(line).slice(0, 60)
    if (seen.has(key)) continue
    seen.add(key)
    found.push(line)
    if (found.length >= 3) break
  }
  return found
}

export function addressFrom(node) {
  const address = node?.address
  if (!address) return ''
  if (typeof address === 'string') return decodeEntities(address)
  return decodeEntities(
    [address.streetAddress, address.addressLocality, address.addressRegion].filter(Boolean).join(', '),
  )
}

export function descriptionFrom(html, node, text) {
  const fromNode = decodeEntities(node?.description || '').trim()
  if (fromNode.length > 60) return fromNode.slice(0, 520)
  const meta = String(html || '').match(
    /<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]+content=["']([^"']{60,})["']/i,
  )
  if (meta) return decodeEntities(meta[1]).slice(0, 520)
  const paragraph = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 120 && !REVIEW_NOISE.test(line))
  return paragraph ? paragraph.slice(0, 520) : ''
}

/**
 * How confident are we that this page is about the requested place?
 * The area is decisive: chains repeat the same name in other towns, and a page
 * about another branch would give us the wrong photo and the wrong hours.
 */
export function relevanceScore({ text, title, name, address, area = '' }) {
  const haystack = normalizeKey(`${title} ${text.slice(0, 6000)}`)
  const tokens = (value) =>
    normalizeKey(value)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 3)

  let score = 0
  for (const token of tokens(name)) if (haystack.includes(token)) score += 2

  // Long street names would otherwise outweigh everything else, so their
  // contribution is capped.
  const streetHits = tokens(address).filter((token) => haystack.includes(token)).length
  score += Math.min(6, streetHits * 3)

  const areaTokens = tokens(area)
  const areaHit = areaTokens.some((token) => haystack.includes(token))
  if (areaTokens.length) {
    if (areaHit) score += 3
    else score -= 4
  }
  if (/horario|opiniones|rese[nñ]as|tel[eé]fono|direcci[oó]n/i.test(text)) score += 1
  return score
}

/**
 * Words that actually identify this business. A place recorded as just
 * "Panadería" cannot be searched by name: any bakery would match, and we would
 * show someone else's photo, hours and rating.
 */
export function distinctiveTokens(name) {
  return normalizeKey(name)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !GENERIC_WORD.test(token))
}

export { DAY_ORDER }
