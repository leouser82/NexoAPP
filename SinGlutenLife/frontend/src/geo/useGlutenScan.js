import { useEffect, useRef, useState } from 'react'
import { loadGlutenState, peekGlutenState } from './placeDetails.js'

export const GF_OK = new Set(['confirmado', 'mencionado'])

const PREFETCH = 10
const WORKERS = 2

/**
 * Tracks what is known about gluten-free handling for a list of places.
 * Reading the cache is free, so it always runs; the first few places are then
 * warmed in the background and the rest only when the filter is switched on.
 */
export function useGlutenScan(places, area, scanning) {
  const [states, setStates] = useState({})
  const [pending, setPending] = useState(0)
  const done = useRef(new Set())

  useEffect(() => {
    if (!places.length) return undefined
    let cancelled = false

    const seed = {}
    for (const place of places) {
      if (place.certified) {
        seed[place.id] = 'confirmado'
        done.current.add(place.id)
      }
    }
    if (Object.keys(seed).length) setStates((prev) => ({ ...seed, ...prev }))

    const peekAll = async () => {
      for (const place of places) {
        if (cancelled) return
        if (done.current.has(place.id)) continue
        const data = await peekGlutenState(place, area)
        if (cancelled) return
        if (data.known) {
          done.current.add(place.id)
          setStates((prev) => ({ ...prev, [place.id]: data.gfState }))
        }
      }
    }
    peekAll()

    return () => {
      cancelled = true
    }
  }, [places, area])

  useEffect(() => {
    if (!places.length) return undefined
    let cancelled = false

    const queue = (scanning ? places : places.slice(0, PREFETCH)).filter(
      (place) => !done.current.has(place.id),
    )
    if (scanning) setPending(queue.length)

    const worker = async () => {
      while (queue.length && !cancelled) {
        const place = queue.shift()
        const data = await loadGlutenState(place, area)
        done.current.add(place.id)
        if (cancelled) return
        setStates((prev) => ({ ...prev, [place.id]: data.gfState || 'sin datos' }))
        if (scanning) setPending((value) => Math.max(0, value - 1))
      }
    }
    Promise.all(Array.from({ length: WORKERS }, worker))

    return () => {
      cancelled = true
    }
  }, [scanning, places, area])

  return { states, pending }
}
