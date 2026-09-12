import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatDistance, mapsUrl } from '../geo/geo.js'
import { getCachedPlace } from '../geo/placeCache.js'
import { formatArs, loadPlaceDetails } from '../geo/placeDetails.js'
import { useLocationData } from '../geo/LocationContext.jsx'

export default function PlaceDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { places, pharmacies, label } = useLocationData()
  const decoded = decodeURIComponent(id || '')
  const place =
    [...places, ...pharmacies].find((item) => item.id === decoded) || getCachedPlace(decoded)

  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [photoIndex, setPhotoIndex] = useState(0)
  const [tab, setTab] = useState('fotos')
  const [broken, setBroken] = useState(() => new Set())

  const dropPhoto = (url) => setBroken((prev) => new Set(prev).add(url))

  useEffect(() => {
    if (!place) return
    let alive = true
    setLoading(true)
    loadPlaceDetails(place, label, (data) => {
      if (!alive) return
      setDetails(data)
      setLoading(false)
    }).finally(() => {
      if (alive) setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [place?.id, label])

  if (!place) {
    return (
      <main className="page">
        <p>No encontramos ese lugar. Volvé a la lista para cargarlo de nuevo.</p>
        <Link className="linkish" to="/lugares">
          Ver lugares
        </Link>
      </main>
    )
  }

  const photos = (details?.photos || []).filter((url) => !broken.has(url))
  const photo = photos[photoIndex] || photos[0] || ''
  const menu = details?.menu || []
  const reviews = details?.reviews || []
  const hours = details?.hours || { rows: [], openLabel: '' }
  const features = details?.features || []
  const gfMentions = details?.gfMentions || []
  const gfConfirmed = place.certified || details?.gfOfficial || details?.gfState === 'confirmado'

  const tabs = [
    { id: 'fotos', label: 'Fotos' },
    menu.length ? { id: 'menu', label: 'Menú' } : null,
    { id: 'horarios', label: 'Horarios' },
    { id: 'opiniones', label: 'Opiniones' },
  ].filter(Boolean)

  return (
    <main className="page">
      <button className="back" onClick={() => navigate(-1)}>
        ← Volver
      </button>

      <p className="meta" style={{ margin: '0 0 4px' }}>
        {place.type} · {formatDistance(place.distanceKm)}
      </p>
      <h2 className="page-title">{place.name}</h2>
      {details?.rating ? (
        <p className="place-rating">
          <strong>{String(details.rating).replace('.', ',')}</strong>
          <span className="stars">{'★★★★★'.slice(0, Math.round(details.rating))}</span>
          {details.reviewCount ? <span>({details.reviewCount})</span> : null}
        </p>
      ) : null}
      {place.address ? <p className="note" style={{ marginTop: 0 }}>{place.address}</p> : null}

      <div className="tags" style={{ marginBottom: 14 }}>
        {gfConfirmed ? (
          <span className="tag ok">Sin TACC</span>
        ) : gfMentions.length ? (
          <span className="tag ok">Sin TACC publicado</span>
        ) : (
          <span className="tag warn">Sin TACC sin confirmar</span>
        )}
        {details?.cuisine ? <span className="tag">{details.cuisine}</span> : null}
        {hours.openLabel ? <span className="tag ok">{hours.openLabel}</span> : null}
      </div>

      <section id="fotos" className="place-gallery">
        <div className="place-gallery-main">
          {photo ? (
            <img src={photo} alt={place.name} onError={() => dropPhoto(photo)} />
          ) : details?.mapEmbed ? (
            <iframe title="Mapa" src={details.mapEmbed} className="place-map" />
          ) : (
            <div className="place-photo-empty">Todavía no hay fotos de este local</div>
          )}
          {photos.length > 1 ? (
            <>
              <button
                type="button"
                className="gallery-nav prev"
                onClick={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
              >
                ‹
              </button>
              <button
                type="button"
                className="gallery-nav next"
                onClick={() => setPhotoIndex((i) => (i + 1) % photos.length)}
              >
                ›
              </button>
              <span className="gallery-count">
                {photoIndex + 1}/{photos.length}
              </span>
            </>
          ) : null}
        </div>
        {photos.length > 1 ? (
          <div className="place-gallery-side">
            {photos.slice(0, 3).map((url, index) => (
              <button
                type="button"
                key={url}
                className={index === photoIndex ? 'active' : ''}
                onClick={() => setPhotoIndex(index)}
              >
                <img src={url} alt="" onError={() => dropPhoto(url)} />
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <nav className="place-tabs">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? 'active' : ''}
            onClick={() => {
              setTab(item.id)
              document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {loading ? <p className="note">Buscando fotos, horarios y datos publicados del local…</p> : null}

      <div className="place-split">
        <section className="card place-block">
          <h3>Sobre el lugar</h3>
          <p>{details?.about || `${place.name} es una ${place.type.toLowerCase()}${place.address ? ` en ${place.address}` : ''}.`}</p>
          {details?.phone ? <p className="note">Tel: {details.phone}</p> : null}
          {features.length ? (
            <ul className="feature-list">
              {features.map((item) => (
                <li key={item.label}>
                  {item.ok ? '✓' : '✕'} {item.label}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <section className="card place-block" id="menu">
          <h3>Qué ofrecen sin TACC</h3>
          {gfMentions.length ? (
            <div className="gf-evidence">
              {gfMentions.map((item) => (
                <blockquote key={item.text.slice(0, 30)}>
                  <p>{item.text}</p>
                  <cite>{new URL(item.source).hostname.replace(/^www\./, '')}</cite>
                </blockquote>
              ))}
            </div>
          ) : (
            <p className="note">
              No encontramos ninguna publicación del local sobre sin TACC. Preguntá antes de comprar.
            </p>
          )}
          {menu.length ? (
            <div className="menu-list">
              {menu.map((item) => (
                <article className="menu-row" key={item.name}>
                  <div>
                    <h4>{item.name}</h4>
                    <p className="meta">{item.gf ? 'Sin TACC' : 'Publicado en su web'}</p>
                  </div>
                  {item.price ? <strong>{formatArs(item.price)}</strong> : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <div className="place-split">
        <section className="card place-block">
          <h3>Ubicación</h3>
          {place.address ? <p>{place.address}</p> : null}
          <a className="maps-link" href={mapsUrl(place)} target="_blank" rel="noreferrer">
            Ver en Google Maps
          </a>
          {details?.mapEmbed ? <iframe title="Mapa del lugar" src={details.mapEmbed} className="place-map-embed" /> : null}
        </section>
        <section className="card place-block" id="horarios">
          <div className="hours-head">
            <h3>Horarios</h3>
            {hours.openLabel ? <span className="tag ok">{hours.openLabel}</span> : null}
          </div>
          {hours.rows.length ? (
            <ul className="hours-list">
              {hours.rows.map((row) => (
                <li key={row.key} className={row.range === 'Cerrado' ? 'off' : ''}>
                  <span>{row.day}</span>
                  <strong>{row.range}</strong>
                </li>
              ))}
            </ul>
          ) : hours.openLabel ? (
            <p>{hours.openLabel}</p>
          ) : (
            <p className="note">No hay horario publicado para este local.</p>
          )}
        </section>
      </div>

      <section className="card place-block" id="opiniones">
        <h3>Opiniones</h3>
        {details?.rating ? (
          <p className="note">
            {details.rating} estrellas
            {details.reviewCount ? ` · ${details.reviewCount} opiniones` : ''}
          </p>
        ) : null}
        {reviews.length ? (
          <div className="review-list">
            {reviews.map((review) => (
              <article key={review.text.slice(0, 24)}>
                <h4>{review.author}</h4>
                <p>{review.text}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="note">Todavía no hay reseñas públicas para mostrar. Podés ver más en Google.</p>
        )}
        {details?.sources?.length ? (
          <p className="note" style={{ marginTop: 10 }}>
            Datos públicos de {details.sources.map((url) => new URL(url).hostname.replace(/^www\./, '')).join(', ')}
          </p>
        ) : null}
        <a className="btn btn-light" style={{ marginTop: 12 }} href={mapsUrl(place)} target="_blank" rel="noreferrer">
          Ver opiniones en Google
        </a>
      </section>

      <div className="hero-actions" style={{ marginTop: 18 }}>
        <a className="btn btn-light" href={mapsUrl(place)} target="_blank" rel="noreferrer">
          Cómo llegar
        </a>
        {details?.website ? (
          <a className="btn btn-ghost" href={details.website} target="_blank" rel="noreferrer">
            Sitio o menú
          </a>
        ) : null}
      </div>
    </main>
  )
}
