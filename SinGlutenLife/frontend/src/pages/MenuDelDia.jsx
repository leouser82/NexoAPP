import { Link } from 'react-router-dom'
import { dailyMeals } from '../data/mock.js'

export default function MenuDelDia() {
  const total = dailyMeals.reduce((s, m) => s + m.cost, 0)

  return (
    <main className="page">
      <h2 className="page-title">Hoy comés rico</h2>
      <p className="note" style={{ marginTop: 0 }}>
        Cuatro comidas, una receta cada una. El costo es una estimación de súper y farmacia.
      </p>
      {dailyMeals.map((m) => (
        <Link key={m.id} to={`/recetas/${m.recipeId}`} className="card meal">
          <div className="slot">
            {m.slot}
            <div style={{ fontWeight: 500, marginTop: 4 }}>{m.time}</div>
          </div>
          <div>
            <h4>{m.title}</h4>
            <div className="meta">
              {m.minutes} min · {m.kcal} kcal
            </div>
            <div className="note">{m.note}</div>
          </div>
          <div className="cost">${m.cost.toLocaleString('es-AR')}</div>
        </Link>
      ))}
      <div className="card total-row">
        <span>Total estimado del día</span>
        <span className="cost">${total.toLocaleString('es-AR')}</span>
      </div>
    </main>
  )
}
