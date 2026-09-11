import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { detectLocation } from './geo.js'
import { fetchNearbyPlaces } from './places.js'

const LocationContext = createContext({
  status: 'locating',
  coords: null,
  label: 'Buscando…',
  source: null,
  places: [],
  pharmacies: [],
  placesStatus: 'idle',
  error: '',
  locate: () => {},
})

export function LocationProvider({ children }) {
  const [status, setStatus] = useState('locating')
  const [coords, setCoords] = useState(null)
  const [label, setLabel] = useState('Buscando…')
  const [source, setSource] = useState(null)
  const [places, setPlaces] = useState([])
  const [pharmacies, setPharmacies] = useState([])
  const [placesStatus, setPlacesStatus] = useState('idle')
  const [error, setError] = useState('')

  const loadPlaces = useCallback(async (lat, lon) => {
    setPlacesStatus('loading')
    try {
      const nearby = await fetchNearbyPlaces(lat, lon, (partial) => {
        setPlaces(partial.places)
        setPharmacies(partial.pharmacies)
        if (partial.places.length + partial.pharmacies.length > 0) {
          setPlacesStatus('ready')
        }
      })
      setPlaces(nearby.places)
      setPharmacies(nearby.pharmacies)
      setPlacesStatus('ready')
    } catch {
      setPlacesStatus('error')
    }
  }, [])

  const locate = useCallback(async () => {
    setStatus('locating')
    setError('')
    setLabel('Buscando…')
    try {
      const found = await detectLocation()
      setCoords({ lat: found.lat, lon: found.lon })
      setLabel(found.label)
      setSource(found.source)
      setStatus('ready')
      await loadPlaces(found.lat, found.lon)
    } catch {
      setStatus('error')
      setLabel('Ubicación no disponible')
      setError('No pudimos leer tu ubicación. Activá el GPS y reintentá.')
    }
  }, [loadPlaces])

  useEffect(() => {
    locate()
  }, [locate])

  const value = useMemo(
    () => ({
      status,
      coords,
      label,
      source,
      places,
      pharmacies,
      placesStatus,
      error,
      locate,
    }),
    [status, coords, label, source, places, pharmacies, placesStatus, error, locate],
  )

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>
}

export function useLocationData() {
  return useContext(LocationContext)
}
