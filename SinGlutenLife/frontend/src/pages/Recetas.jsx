import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { recipes } from '../data/mock.js'

export default function Recetas() {
  const [budget, setBudget] = useState(8000)
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    return recipes.filter((r) => r.cost <= budget && r.title.toLowerCase().includes(q.toLowerCase()))
  }, [budget, q])

  return (
    <main className="page">
      <h2 className="page-title">Cociná a tu medida</h2>
      <p className="note" style={{ margin: '0 0 14px' }}>
        Decinos cuánto querés gastar. Te mostramos recetas que entran y dónde comprar cada cosa.
      </p>
      <div className="budget-box">
        <label>
          Hasta este presupuesto
          <span>${Number(budget).toLocaleString('es-AR')}</span>
        </label>
        <input type="range" min="1500" max="10000" step="100" value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
      </div>
      <input className="search" placeholder="Buscar receta…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid-cards">
        {list.map((r) => (
          <Link key={r.id} className="card recipe-card" to={`/recetas/${r.id}`}>
            <h4>{r.title}</h4>
            <p>{r.summary}</p>
            <div className="tags">
              {r.tags.map((t) => (
                <span className="tag" key={t}>
                  {t}
                </span>
              ))}
            </div>
            <div className="row-stats" style={{ marginTop: 10 }}>
              <span>{r.minutes} min</span>
              <span>{r.difficulty}</span>
              <span className="cost">${r.cost.toLocaleString('es-AR')}</span>
            </div>
          </Link>
        ))}
      </div>
      {list.length === 0 && <p className="note">Subí un poco el presupuesto para ver más recetas.</p>}
    </main>
  )
}
