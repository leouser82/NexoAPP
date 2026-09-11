import { Link } from 'react-router-dom'
import { dailyMeals, recipes, user } from '../data/mock.js'
import { formatDistance } from '../geo/geo.js'
import { useLocationData } from '../geo/LocationContext.jsx'

export default function Home() {
  const { places, pharmacies, placesStatus, label } = useLocationData()
  const nearby = [...places, ...pharmacies].sort((a, b) => a.distanceKm - b.distanceKm)
  const nearest = nearby[0]
  const todayCost = dailyMeals.reduce((s, m) => s + m.cost, 0)

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-kicker">Tu día sin TACC</div>
        <h2>Hola {user.name}, hoy la mesa está de tu lado.</h2>
        <p>
          Locales cerca de {label === 'Buscando…' ? 'vos' : label}, el menú del día y recetas que
          respetan tu presupuesto.
        </p>
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
            <span>
              {placesStatus === 'loading'
                ? 'Buscando locales…'
                : `${places.length} opciones cerca tuyo`}
            </span>
          </div>
        </Link>
        <Link className="quick-card" to="/farmacias">
          <span className="ico sky">💊</span>
          <div>
            <h4>Farmacias</h4>
            <span>
              {placesStatus === 'loading'
                ? 'Buscando farmacias…'
                : `${pharmacies.length} a un paso`}
            </span>
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
      {nearest ? (
        <article className="card">
          <h4 style={{ margin: '0 0 4px' }}>{nearest.name}</h4>
          <p className="meta" style={{ margin: 0 }}>
            {nearest.type} · {formatDistance(nearest.distanceKm)}
            {nearest.address ? ` · ${nearest.address}` : ''}
          </p>
        </article>
      ) : (
        <p className="note">
          {placesStatus === 'loading'
            ? 'Estamos midiendo qué hay cerca de tu ubicación…'
            : 'Todavía no encontramos lugares cerca. Probá actualizar la ubicación.'}
        </p>
      )}

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