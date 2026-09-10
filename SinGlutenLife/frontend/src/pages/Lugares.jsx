import { useMemo, useState } from 'react'
import PlaceCard from '../components/PlaceCard.jsx'
import { places } from '../data/mock.js'

const filters = ['Todos', 'Panadería', 'Restaurante', 'Dietética', 'Take away', 'Pizzería']

export default function Lugares() {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('Todos')

  const list = useMemo(() => {
    return places.filter((p) => {
      const byType = filter === 'Todos' || p.type === filter
      const text = `${p.name} ${p.address} ${p.tags.join(' ')}`.toLowerCase()
      return byType && text.includes(q.toLowerCase())
    })
  }, [q, filter])

  return (
    <main className="page">
      <div className="banner-proto">
        Estamos en Palermo, de ejemplo. Pronto: tu GPS y un mapa real de locales sin TACC.
      </div>
      <h2 className="page-title">¿Dónde comemos hoy?</h2>
      <p className="note" style={{ margin: '0 0 14px' }}>
        Panaderías, restaurantes y dietéticas pensados para vos.
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
      </div>
      <div className="grid-cards">
        {list.map((p) => (
          <PlaceCard key={p.id} place={p} />
        ))}
      </div>
      {list.length === 0 && <p className="note">No hay resultados con ese filtro.</p>}
    </main>
  )
}
