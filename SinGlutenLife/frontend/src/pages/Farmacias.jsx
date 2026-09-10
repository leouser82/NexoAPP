import { useState } from 'react'
import PlaceCard from '../components/PlaceCard.jsx'
import { pharmacies } from '../data/mock.js'

export default function Farmacias() {
  const [q, setQ] = useState('')
  const list = pharmacies.filter((p) => `${p.name} ${p.products.join(' ')}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <main className="page">
      <div className="banner-proto">
        Prototipo visual. Después cruzamos esto con el padrón ANMAT y el stock de las cadenas.
      </div>
      <h2 className="page-title">Farmacia, sin adivinar</h2>
      <p className="note" style={{ margin: '0 0 14px' }}>
        Galletitas, premezclas y snacks con sello. Cerca y listos.
      </p>
      <input
        className="search"
        placeholder="Galletitas, premezcla, barras…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="grid-cards">
        {list.map((p) => (
          <PlaceCard
            key={p.id}
            place={p}
            extra={p.products.slice(0, 2).map((prod) => (
              <span className="tag ok" key={prod}>
                {prod}
              </span>
            ))}
          />
        ))}
      </div>
    </main>
  )
}
