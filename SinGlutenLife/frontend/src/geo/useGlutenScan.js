import { useEffect, useRef, useState } from 'react'
import { loadGlutenState, peekGlutenState } from './placeDetails.js'

export const GF_OK = new Set(['confirmado', 'mencionado'])

/**
 * Tracks what is known about gluten-free handling for a list of places.
 * Reading the cache is free, so it runs always; the actual scraping only
 * starts when the user turns the sin TACC filter on.
 */
export function useGlutenScan(places, area, scanning) {
  const [states, setStates] = useState({})
  const [pending, setPending] = useState(0)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    if (!places.length) return undefined
    let cancelled = false

    const seed = {}
    for (const place of places) {
      if (place.certified) seed[place.id] = 'confirmado'
    }
    if (Object.keys(seed).length) setStates((prev) => ({ ...seed, ...prev }))

    const peekAll = async () => {
      for (const place of places) {
        if (cancelled) return
        if (place.certified) continue
        const data = await peekGlutenState(place, area)
        if (cancelled) return
        if (data.known) {
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
    if (!scanning || !places.length) return undefined
    let cancelled = false

    const scan = async () => {
      const todo = places.filter((place) => !place.certified && !states[place.id])
      setPending(todo.length)
      for (const place of todo) {
        if (cancelled) return
        const data = await loadGlutenState(place, area)
        if (cancelled) return
        setStates((prev) => ({ ...prev, [place.id]: data.gfState || 'sin datos' }))
        setPending((value) => Math.max(0, value - 1))
      }
    }
    scan()

    return () => {
      cancelled = true
    }
  }, [scanning, places, area])

  return { states, pending }
}
