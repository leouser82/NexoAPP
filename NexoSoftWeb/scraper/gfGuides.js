import { fetchJson } from './http.js'
import { dedupe, readCache, writeCache } from './store.js'

/**
 * Dev twin of public/gf-guides.php: CeliMap does not allow browser requests,
 * so both environments answer the same path with the same raw payload and the
 * app does the rest.
 */

const CELIMAP_API = 'https://www.celimap.com.ar/api/places'
const PAGE_SIZE = 100
const MAX_PAGES = 24
const DAY_MS = 24 * 60 * 60 * 1000

export async function celimapRaw() {
  const key = 'guide:celimap:raw:v1'
  const cached = readCache(key, DAY_MS)
  if (cached) return cached

  return dedupe(key, async () => {
    const first = await fetchJson(`${CELIMAP_API}?limit=${PAGE_SIZE}&page=1`, { retries: 1 })
    if (!first?.places?.length) return { places: [], total: 0 }

    const pages = Math.max(1, Math.min(first.pagination?.pages || 1, MAX_PAGES))
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, index) =>
        fetchJson(`${CELIMAP_API}?limit=${PAGE_SIZE}&page=${index + 2}`, { retries: 1 }),
      ),
    )

    const places = [first, ...rest].flatMap((payload) => payload?.places || [])
    const data = { places, total: places.length, fetchedAt: new Date().toISOString() }
    writeCache(key, data)
    return data
  })
}
