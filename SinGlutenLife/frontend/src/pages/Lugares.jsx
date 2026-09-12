import { useMemo, useState } from 'react'
import PlaceCard from '../components/PlaceCard.jsx'
import { useLocationData } from '../geo/LocationContext.jsx'

export default function Lugares() {
  const { places, placesStatus, label, locate, source, status, error } = useLocationData()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('Todos')
  const [onlyDedicated, setOnlyDedicated] = useState(false)

  const filters = useMemo(() => {
    const types = [...new Set(places.map((p) => p.type))]
    return ['Todos', ...types]
  }, [places])

  const list = useMemo(() => {
    return places.filter((p) => {
      const byType = filter === 'Todos' || p.type === filter
      const byLevel = !onlyDedicated || p.level === 'dedicado'
      const text = `${p.name} ${p.address || ''} ${p.city || ''} ${(p.tags || []).join(' ')}`.toLowerCase()
      return byType && byLevel && text.includes(q.toLowerCase())
    })
  }, [places, q, filter, onlyDedicated])

  const dedicated = useMemo(() => places.filter((p) => p.level === 'dedicado').length, [places])
  const guides = useMemo(() => [...new Set(places.flatMap((p) => p.guides || []))], [places])

  return (
    <main className="page">
      <div className="banner-proto">
        {status === 'locating' || placesStatus === 'loading'
          ? `Buscando lugares sin TACC cerca de ${label}…`
          : source === 'gps'
            ? `Ubicación real · ${label}. Distancia medida en línea recta.`
            : source === 'ip'
              ? `Ubicación aproximada por red · ${label}. Tocá el pin de arriba para usar el GPS.`
              : error || 'No pudimos leer tu ubicación. Tocá el pin de arriba para reintentar.'}
      </div>
      <h2 className="page-title">¿Dónde comemos hoy?</h2>
      <p className="note" style={{ margin: '0 0 14px' }}>
        {places.length
          ? `${places.length} lugares sin TACC a menos de 25 km, ${dedicated} con cocina 100% libre de gluten. Datos de ${guides.join(', ')}. Confirmá siempre el protocolo en el local.`
          : 'Solo mostramos lugares que figuran en guías sin TACC. Ninguna etiqueta reemplaza preguntar en el local.'}
      </p>
      <input
        className="search"
        placeholder="Buscar por nombre, barrio o dirección…"
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
          className={`filter gf ${onlyDedicated ? 'active' : ''}`}
          onClick={() => setOnlyDedicated((value) => !value)}
        >
          Solo 100% sin gluten
        </button>
      </div>
      <div className="grid-cards">
        {list.map((p) => (
          <PlaceCard key={p.id} place={p} />
        ))}
      </div>
      {placesStatus === 'loading' && <p className="note">Cargando guías sin TACC…</p>}
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
