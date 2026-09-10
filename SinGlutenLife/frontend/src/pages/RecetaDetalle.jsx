import { Link, useNavigate, useParams } from 'react-router-dom'
import { recipes, storeKindLabel } from '../data/mock.js'

export default function RecetaDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const recipe = recipes.find((r) => r.id === id)

  if (!recipe) {
    return (
      <main className="page">
        <p>No encontramos esa receta.</p>
        <Link className="linkish" to="/recetas">
          Volver
        </Link>
      </main>
    )
  }

  const byStore = recipe.ingredients.reduce((acc, ing) => {
    acc[ing.store] = acc[ing.store] || { kind: ing.storeKind, items: [], total: 0 }
    acc[ing.store].items.push(ing)
    acc[ing.store].total += ing.price
    return acc
  }, {})

  return (
    <main className="page">
      <button className="back" onClick={() => navigate(-1)}>
        ← Volver
      </button>
      <h2 className="page-title">{recipe.title}</h2>
      <p className="note" style={{ marginTop: 0 }}>
        {recipe.summary}
      </p>
      <div className="row-stats" style={{ marginBottom: 16 }}>
        <span>{recipe.minutes} min</span>
        <span>{recipe.servings} porciones</span>
        <span>{recipe.difficulty}</span>
        <span className="cost">${recipe.cost.toLocaleString('es-AR')}</span>
      </div>

      <h3 style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Ingredientes</h3>
      <div className="card">
        {recipe.ingredients.map((ing) => (
          <div className="ingredient" key={ing.name}>
            <div>
              <strong>{ing.name}</strong>
              <div className="meta">
                {ing.qty} · {ing.store} ({storeKindLabel[ing.storeKind]})
              </div>
            </div>
            <div className="cost">${ing.price.toLocaleString('es-AR')}</div>
          </div>
        ))}
      </div>

      <h3 style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Dónde comprar, según costo</h3>
      <p className="note">Agrupamos los ingredientes por comercio sugerido (datos de ejemplo).</p>
      {Object.entries(byStore).map(([store, info]) => (
        <article className="card" key={store} style={{ marginBottom: 12 }}>
          <h4 style={{ margin: '0 0 4px' }}>{store}</h4>
          <div className="meta">{storeKindLabel[info.kind]}</div>
          <ul className="note">
            {info.items.map((i) => (
              <li key={i.name}>
                {i.name} — ${i.price.toLocaleString('es-AR')}
              </li>
            ))}
          </ul>
          <div className="total-row">
            <span>Subtotal</span>
            <span>${info.total.toLocaleString('es-AR')}</span>
          </div>
        </article>
      ))}

      <h3 style={{ fontFamily: 'Fraunces, Georgia, serif' }}>Pasos</h3>
      <ol className="steps">
        {recipe.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </main>
  )
}
