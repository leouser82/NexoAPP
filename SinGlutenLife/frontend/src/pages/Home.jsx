import { Link } from 'react-router-dom'
import { dailyMeals, pharmacies, places, recipes, user } from '../data/mock.js'

export default function Home() {
  const nearest = [...places, ...pharmacies].sort((a, b) => a.distanceKm - b.distanceKm)[0]
  const todayCost = dailyMeals.reduce((s, m) => s + m.cost, 0)

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-kicker">Tu día sin TACC</div>
        <h2>Hola {user.name}, hoy la mesa está de tu lado.</h2>
        <p>Locales cerca, el menú del día y recetas que respetan tu presupuesto. Sin vueltas, sin gluten.</p>
        <div className="hero-actions">
          <Link className="btn btn-light" to="/lugares">
            Ver qué hay cerca
          </Link>
          <Link className="btn btn-ghost" to="/menu">
            Armar el día
          </Link>
        </div>
        <div className="badge-row">
          <span className="badge">Celíaco / intolerante</span>
          <span className="badge">Hecho para Argentina</span>
        </div>
      </section>

      <div className="section-head">
        <h3>Empezá por acá</h3>
      </div>
      <div className="grid-2">
        <Link className="quick-card" to="/lugares">
          <span className="ico blue">🍽</span>
          <div>
            <h4>Comida cerca</h4>
            <span>{places.length} opciones listas para salir</span>
          </div>
        </Link>
        <Link className="quick-card" to="/farmacias">
          <span className="ico sky">💊</span>
          <div>
            <h4>Farmacias</h4>
            <span>Góndola sin TACC a mano</span>
          </div>
        </Link>
        <Link className="quick-card" to="/menu">
          <span className="ico coral">☀</span>
          <div>
            <h4>Menú de hoy</h4>
            <span>${todayCost.toLocaleString('es-AR')} para las 4 comidas</span>
          </div>
        </Link>
        <Link className="quick-card" to="/recetas">
          <span className="ico navy">🥗</span>
          <div>
            <h4>Cocinar en casa</h4>
            <span>Recetas que entran en tu bolsillo</span>
          </div>
        </Link>
      </div>

      <div className="section-head">
        <h3>A un paso tuyo</h3>
        <Link to="/lugares">Ver todas</Link>
      </div>
      <article className="card">
        <h4 style={{ margin: '0 0 4px' }}>{nearest.name}</h4>
        <p className="meta" style={{ margin: 0 }}>
          {nearest.type} · {nearest.distanceKm} km · {nearest.address}
        </p>
      </article>

      <div className="section-head">
        <h3>Una idea rica y económica</h3>
        <Link to="/recetas">Ver recetas</Link>
      </div>
      <Link className="card recipe-card" to={`/recetas/${recipes[2].id}`}>
        <h4>{recipes[2].title}</h4>
        <p>{recipes[2].summary}</p>
        <div className="row-stats">
          <span>{recipes[2].minutes} min</span>
          <span>${recipes[2].cost.toLocaleString('es-AR')}</span>
        </div>
      </Link>
    </main>
  )
}
