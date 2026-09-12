import { postForm } from './http.js'

/**
 * overpass-api.de is unreachable from this host, so the query walks a list of
 * public mirrors and then sticks to the one that answered.
 */
const MIRRORS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]

let preferred = 0

export async function overpass(query, { timeoutMs = 20000 } = {}) {
  for (let step = 0; step < MIRRORS.length; step += 1) {
    const index = (preferred + step) % MIRRORS.length
    const data = await postForm(MIRRORS[index], { data: query }, { timeoutMs }).catch(() => null)
    if (data?.elements) {
      preferred = index
      return data
    }
  }
  return { elements: [] }
}
