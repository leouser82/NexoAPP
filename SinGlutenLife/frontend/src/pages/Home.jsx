import { Link } from 'react-router-dom'
import PlaceCard from '../components/PlaceCard.jsx'
import artComida from '../assets/comida-cerca.svg'
import artCocinar from '../assets/cocinar-casa.svg'
import { recipes } from '../data/recipes.js'
import { useLocationData } from '../geo/LocationContext.jsx'

export default function Home() {
  const { places, placesStatus, label } = useLocationData()
  const nearby = [...places].sort((a, b) => a.distanceKm - b.distanceKm)
  const nearest = nearby[0]
  const featured = recipes[3]

  return (
    <main className="page">
      <section className="hero">
        <div className="hero-kicker">Tu día sin TACC</div>
        <h2>Hola, hoy la mesa está de tu lado.</h2>
        <p>
          Locales cerca de {label === 'Buscando…' ? 'vos' : label} y recetas publicadas para cocinar en casa.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-light" to="/lugares">
            Ver qué hay cerca
          </Link>
          <Link className="btn btn-ghost" to="/recetas">
            Ver recetas
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
        <Link className="quick-card photo-card" to="/lugares">
          <img src={artComida} alt="" />
          <div>
            <h4>Comida cerca</h4>
            <span>
              {placesStatus === 'loading'
                ? 'Buscando locales…'
                : `${places.length} opciones cerca tuyo`}
            </span>
          </div>
        </Link>
        <Link className="quick-card photo-card" to="/recetas">
          <img src={artCocinar} alt="" />
          <div>
            <h4>Cocinar en casa</h4>
            <span>{recipes.length} recetas publicadas, sin precios inventados</span>
          </div>
        </Link>
      </div>

      <div className="section-head">
        <h3>A un paso tuyo</h3>
        <Link to="/lugares">Ver todas</Link>
      </div>
      {nearest ? (
        <PlaceCard place={nearest} />
      ) : (
        <p className="note">
          {placesStatus === 'loading'
            ? 'Estamos midiendo qué hay cerca de tu ubicación…'
            : 'Todavía no encontramos lugares cerca. Probá actualizar la ubicación.'}
        </p>
      )}

      <div className="section-head">
        <h3>Una receta para hoy</h3>
        <Link to="/recetas">Ver recetas</Link>
      </div>
      <Link className="card recipe-feature" to={`/recetas/${featured.id}`}>
        <span className="recipe-feature-kicker">Receta de {featured.sourceName}</span>
        <h4>{featured.title}</h4>
        <p>{featured.summary}</p>
        <div className="tags">
          {featured.tags.map((item) => (
            <span className="tag" key={item}>
              {item}
            </span>
          ))}
        </div>
        <div className="row-stats" style={{ marginTop: 10 }}>
          <span>{featured.minutes} min</span>
          <span>{featured.servings} porciones</span>
          <span>{featured.difficulty}</span>
        </div>
      </Link>
    </main>
  )
}
