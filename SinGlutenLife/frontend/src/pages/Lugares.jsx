import { useMemo, useState } from 'react'
import PlaceCard from '../components/PlaceCard.jsx'
import { useLocationData } from '../geo/LocationContext.jsx'
import { GF_OK, useGlutenScan } from '../geo/useGlutenScan.js'

export default function Lugares() {
  const { places, placesStatus, label, locate, source, status, error } = useLocationData()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('Todos')
  const [onlyGf, setOnlyGf] = useState(false)
  const { states, pending } = useGlutenScan(places, label, onlyGf)

  const filters = useMemo(() => {
    const types = [...new Set(places.map((p) => p.type))]
    return ['Todos', ...types]
  }, [places])

  const list = useMemo(() => {
    return places.filter((p) => {
      const byType = filter === 'Todos' || p.type === filter
      const text = `${p.name} ${p.address || ''} ${(p.tags || []).join(' ')}`.toLowerCase()
      const byGf = !onlyGf || GF_OK.has(states[p.id])
      return byType && byGf && text.includes(q.toLowerCase())
    })
  }, [places, q, filter, onlyGf, states])

  return (
    <main className="page">
      <div className="banner-proto">
        {status === 'locating' || placesStatus === 'loading'
          ? `Buscando lugares reales cerca de ${label}…`
          : source === 'gps'
            ? `Ubicación real · ${label}. Distancia medida en línea recta.`
            : source === 'ip'
              ? `Ubicación aproximada por red · ${label}. Tocá el pin de arriba para usar el GPS.`
              : error || 'No pudimos leer tu ubicación. Tocá el pin de arriba para reintentar.'}
      </div>
      <h2 className="page-title">¿Dónde comemos hoy?</h2>
      <p className="note" style={{ margin: '0 0 14px' }}>
        Panaderías, confiterías y dietéticas a 5 km. Restaurantes, los más cercanos hasta 50 km.
        Son locales de comida cerca tuyo: solo los que dicen “Sin TACC” tienen el dato publicado.
      </p>
      <input
        className="search"
        placeholder="Panadería, pizza, dietética…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="filters">
        {filters.map((f) => (
          <button key={f} className={`filter ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
        <button
          className={`filter gf ${onlyGf ? 'active' : ''}`}
          onClick={() => setOnlyGf((value) => !value)}
        >
          Sin TACC confirmado
        </button>
      </div>
      {onlyGf ? (
        <p className="note" style={{ margin: '0 0 10px' }}>
          {pending
            ? `Revisando qué publica cada local… faltan ${pending}. Los resultados se van sumando.`
            : 'Estos son los locales donde encontramos el dato publicado, con su fuente en la ficha.'}
        </p>
      ) : null}
      <div className="grid-cards">
        {list.map((p) => (
          <PlaceCard key={p.id} place={p} gfState={states[p.id]} />
        ))}
      </div>
      {placesStatus === 'loading' && <p className="note">Cargando mapa de locales…</p>}
      {placesStatus === 'ready' && list.length === 0 && (
        <p className="note">
          No hay resultados con ese filtro.{' '}
          <button type="button" className="text-btn" onClick={locate}>
            Actualizar ubicación
          </button>
        </p>
      )}
    </main>
  )
}