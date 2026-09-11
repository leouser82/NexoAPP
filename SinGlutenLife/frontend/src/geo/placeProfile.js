const GF_HINT = /sin\s*tacc|sintacc|sin gluten|gluten\s*free|celiac|premezcla|harina de arroz|harina de maíz|quinoa/i
const PRICE_HINT = /\$\s?\d{1,3}(?:[.\s]\d{3})+(?:,\d{2})?|\$\s?\d{3,6}|\d{3,6}\s*(?:ars|\$)/i

const REFERENCE_MENUS = {
  Panadería: [
    { name: 'Pan de molde sin TACC', price: 4200, gf: true },
    { name: 'Facturas sin TACC (6 u)', price: 6800, gf: true },
    { name: 'Prepizza sin TACC', price: 3900, gf: true },
  ],
  Confitería: [
    { name: 'Torta porción sin TACC', price: 5500, gf: true },
    { name: 'Alfajores de arroz', price: 2800, gf: true },
    { name: 'Café + algo dulce certificado', price: 4500, gf: true },
  ],
  Dietética: [
    { name: 'Premezcla para pan (kg)', price: 6200, gf: true },
    { name: 'Fideos de arroz', price: 3100, gf: true },
    { name: 'Galletitas certificadas', price: 2700, gf: true },
  ],
  Pizzería: [
    { name: 'Muzza sin TACC', price: 9800, gf: true },
    { name: 'Napolitana sin TACC', price: 11500, gf: true },
    { name: 'Fugazzeta sin TACC', price: 12000, gf: true },
  ],
  'Take away': [
    { name: 'Milanesa con ensalada (sin TACC)', price: 8900, gf: true },
    { name: 'Empanadas sin TACC (docena)', price: 11200, gf: true },
  ],
  Café: [
    { name: 'Café + tostadas de arroz', price: 4200, gf: true },
    { name: 'Torta sin TACC', price: 5800, gf: true },
  ],
  Restaurante: [
    { name: 'Entrada sin TACC', price: 6500, gf: true },
    { name: 'Plato principal sin TACC', price: 14500, gf: true },
    { name: 'Postre sin TACC', price: 5200, gf: true },
  ],
  Farmacia: [
    { name: 'Premezcla certificada', price: 5800, gf: true },
    { name: 'Galletitas de arroz', price: 2400, gf: true },
    { name: 'Barras / snacks sin TACC', price: 2100, gf: true },
    { name: 'Fideos o pastas de arroz', price: 3200, gf: true },
  ],
}

function money(value) {
  const n = Number(String(value).replace(/[^\d]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

async function fetchText(url, ms = 10000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error('http')
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
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

function parseMenuText(text) {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/^[#>*\-\d.]+\s*/, '').trim())
    .filter((line) => line.length > 6 && line.length < 160)

  const items = []
  for (const line of lines) {
    const hasPrice = PRICE_HINT.test(line)
    const gf = GF_HINT.test(line)
    if (!hasPrice && !gf) continue
    const priceMatch = line.match(/\$\s?[\d.\s]+|\d{3,6}/)
    items.push({
      name: line.replace(PRICE_HINT, '').replace(/\s{2,}/g, ' ').trim() || line,
      price: priceMatch ? money(priceMatch[0]) : null,
      gf,
      source: 'local',
    })
    if (items.length >= 20) break
  }
  return items
}

async function readWebsiteMenu(url) {
  if (!url || !/^https?:\/\//i.test(url)) return []
  const text = await fetchText(`https://r.jina.ai/${url}`)
  return parseMenuText(text)
}

async function fetchOsmTags(place) {
  if (!place.osmId || !place.osmType) return {}
  const type = String(place.osmType).replace(/^n$/i, 'node').replace(/^w$/i, 'way').replace(/^r$/i, 'relation')
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

async function fetchWikiExtract(place, areaLabel) {
  const query = `${place.name} ${areaLabel || ''}`.trim()
  const data = await fetchJson(
    `https://es.wikipedia.org/w/api.php?origin=*&action=query&format=json&prop=extracts|pageimages&exintro=1&explaintext=1&pithumbsize=900&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(query)}`,
  )
  const page = Object.values(data.query?.pages || {})[0]
  if (!page) return {}
  const tokens = String(place.name)
    .toLowerCase()
    .split(/[\s\-–,/]+/)
    .filter((token) => token.length > 3 && !/^(restaurante|confiter[ií]a|panader[ií]a|diet[eé]tica|farmacia|comida|take|away|el|la|los|las|de|del|y)$/i.test(token))
  const title = String(page.title || '').toLowerCase()
  if (!tokens.length || !tokens.some((token) => title.includes(token))) return {}
  return {
    extract: page.extract || '',
    image: page.thumbnail?.source || '',
  }
}

function cuisineItems(place, tags) {
  const cuisine = String(place.cuisine || tags.cuisine || '')
    .split(/;|,/)
    .map((x) => x.trim())
    .filter(Boolean)
  return cuisine.map((name) => ({
    name: `Cocina ${name}`,
    price: null,
    gf: /gluten|tacc/i.test(name),
    source: 'osm',
  }))
}

export async function loadPlaceProfile(place, areaLabel = '') {
  const [osm, wiki, siteMenu, extraMenu] = await Promise.allSettled([
    fetchOsmTags(place),
    fetchWikiExtract(place, areaLabel),
    readWebsiteMenu(place.website || place.menuUrl),
    readWebsiteMenu(place.menuUrl),
  ])

  const tags = osm.status === 'fulfilled' ? osm.value : {}
  const wikiData = wiki.status === 'fulfilled' ? wiki.value : {}
  const fromSite = [
    ...(siteMenu.status === 'fulfilled' ? siteMenu.value : []),
    ...(extraMenu.status === 'fulfilled' ? extraMenu.value : []),
  ]

  const unique = []
  const seen = new Set()
  for (const item of fromSite) {
    const key = item.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(item)
  }

  const gfFromSite = unique.filter((item) => item.gf)
  const priced = unique.filter((item) => item.price)
  const reference = REFERENCE_MENUS[place.type] || REFERENCE_MENUS.Restaurante
  const extras = cuisineItems(place, tags)

  return {
    tags,
    extract: wikiData.extract || tags.description || place.description || '',
    image: wikiData.image || tags.image || place.image || '',
    website: tags.website || tags['contact:website'] || place.website || '',
    menuUrl: tags.menu || place.menuUrl || '',
    phone: tags.phone || tags['contact:phone'] || place.phone || '',
    hours: tags.opening_hours || place.hours || '',
    cuisine: tags.cuisine || place.cuisine || '',
    gfOfficial: ['yes', 'only', 'limited'].includes(String(tags['diet:gluten_free'] || '').toLowerCase()),
    localItems: unique,
    gfItems: gfFromSite.length ? gfFromSite : extras.filter((x) => x.gf),
    pricedItems: priced,
    referenceItems: reference,
    source: unique.length ? 'local' : 'reference',
  }
}

export function formatArs(value) {
  if (!value) return 'Consultar'
  return `$ ${Number(value).toLocaleString('es-AR')}`
}

export function referenceMenu(type) {
  return REFERENCE_MENUS[type] || REFERENCE_MENUS.Restaurante
}
