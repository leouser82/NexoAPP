import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = path.resolve(__dirname, '../.cache/places')
const PAGE_DIR = path.resolve(__dirname, '../.cache/pages')
const TTL_MS = 7 * 24 * 60 * 60 * 1000
const PAGE_TTL_MS = 3 * 24 * 60 * 60 * 1000

const memory = new Map()
const pending = new Map()

function ensureDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })
}

function fileFor(key) {
  const hash = createHash('sha1').update(key).digest('hex').slice(0, 20)
  return path.join(CACHE_DIR, `${hash}.json`)
}

export function readCache(key) {
  if (memory.has(key)) return memory.get(key)
  try {
    const file = fileFor(key)
    const stat = fs.statSync(file)
    if (Date.now() - stat.mtimeMs > TTL_MS) return null
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    memory.set(key, data)
    return data
  } catch {
    return null
  }
}

export function writeCache(key, value) {
  memory.set(key, value)
  try {
    ensureDir()
    fs.writeFileSync(fileFor(key), JSON.stringify(value), 'utf8')
  } catch {
    // cache is best-effort
  }
}

/** Raw HTML cache: a re-parse or a retry must not cost another request. */
export function readPage(url) {
  try {
    const file = path.join(PAGE_DIR, `${createHash('sha1').update(url).digest('hex')}.html`)
    if (Date.now() - fs.statSync(file).mtimeMs > PAGE_TTL_MS) return null
    return fs.readFileSync(file, 'utf8')
  } catch {
    return null
  }
}

export function writePage(url, html) {
  if (!html || html.length < 200) return
  try {
    if (!fs.existsSync(PAGE_DIR)) fs.mkdirSync(PAGE_DIR, { recursive: true })
    fs.writeFileSync(
      path.join(PAGE_DIR, `${createHash('sha1').update(url).digest('hex')}.html`),
      html,
      'utf8',
    )
  } catch {
    // cache is best-effort
  }
}

/** Collapses concurrent identical lookups into a single scrape. */
export function dedupe(key, task) {
  if (pending.has(key)) return pending.get(key)
  const promise = task().finally(() => pending.delete(key))
  pending.set(key, promise)
  return promise
}
