import { readPage, writePage } from './store.js'

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
]

const ACCEPT_LANGS = ['es-AR,es;q=0.9,en;q=0.6', 'es-419,es;q=0.9,en;q=0.5', 'es-ES,es;q=0.9']

// Token bucket per host: avoids hammering a single server.
const BUCKET_CAPACITY = 4
const REFILL_MS = 900
const buckets = new Map()

// Global in-flight cap so a burst of cards cannot open dozens of sockets.
const MAX_PARALLEL = 4
let inFlight = 0
const waiting = []

const cookieJar = new Map()

function jitter(min, max) {
  return min + Math.random() * (max - min)
}

/** Poisson-ish pause so the request rhythm is not perfectly regular. */
function humanPause() {
  const mean = 420
  const value = -Math.log(1 - Math.random()) * mean
  return Math.min(2200, Math.max(120, value))
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function bucketFor(host) {
  let bucket = buckets.get(host)
  if (!bucket) {
    bucket = { tokens: BUCKET_CAPACITY, last: Date.now() }
    buckets.set(host, bucket)
  }
  const now = Date.now()
  const gained = Math.floor((now - bucket.last) / REFILL_MS)
  if (gained > 0) {
    bucket.tokens = Math.min(BUCKET_CAPACITY, bucket.tokens + gained)
    bucket.last = now
  }
  return bucket
}

async function takeToken(host) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const bucket = bucketFor(host)
    if (bucket.tokens > 0) {
      bucket.tokens -= 1
      return
    }
    await sleep(REFILL_MS / 2 + jitter(0, 200))
  }
}

async function acquireSlot() {
  if (inFlight < MAX_PARALLEL) {
    inFlight += 1
    return
  }
  await new Promise((resolve) => waiting.push(resolve))
  inFlight += 1
}

function releaseSlot() {
  inFlight = Math.max(0, inFlight - 1)
  waiting.shift()?.()
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)]
}

function headersFor(url, extra = {}) {
  const host = new URL(url).host
  const cookie = cookieJar.get(host)
  return {
    'User-Agent': pick(USER_AGENTS),
    'Accept-Language': pick(ACCEPT_LANGS),
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    ...(cookie ? { Cookie: cookie } : {}),
    ...extra,
  }
}

function rememberCookies(url, response) {
  const raw = response.headers.getSetCookie?.() || []
  if (!raw.length) return
  const host = new URL(url).host
  const pairs = raw.map((line) => line.split(';')[0]).filter(Boolean)
  if (pairs.length) cookieJar.set(host, pairs.join('; '))
}

/**
 * Fetch HTML with rate limiting, UA rotation, human-like pauses and retries.
 * Returns '' instead of throwing so callers can keep crawling.
 */
export async function fetchPage(url, { timeoutMs = 12000, retries = 2, referer = '', fresh = false } = {}) {
  let host
  try {
    host = new URL(url).host
  } catch {
    return ''
  }

  if (!fresh) {
    const cached = readPage(url)
    if (cached) return cached
  }

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await takeToken(host)
    await acquireSlot()
    await sleep(humanPause())

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: headersFor(url, referer ? { Referer: referer } : {}),
      })
      rememberCookies(url, response)

      if (response.status === 429 || response.status === 503) {
        throw new Error(`throttled-${response.status}`)
      }
      if (!response.ok) return ''

      const type = response.headers.get('content-type') || ''
      if (!/html|json|text/i.test(type)) return ''
      const body = await response.text()
      writePage(url, body)
      return body
    } catch {
      if (attempt === retries) return ''
      // Exponential backoff with jitter before retrying.
      await sleep(700 * 2 ** attempt + jitter(0, 500))
    } finally {
      clearTimeout(timer)
      releaseSlot()
    }
  }
  return ''
}

export async function fetchJson(url, options = {}) {
  const text = await fetchPage(url, { ...options })
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function postForm(url, body, { timeoutMs = 12000 } = {}) {
  const host = new URL(url).host
  await takeToken(host)
  await acquireSlot()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        ...headersFor(url),
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams(body),
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    releaseSlot()
  }
}
