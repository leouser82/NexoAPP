import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatDistance, mapsUrl } from '../geo/geo.js'
import { getCachedPlace } from '../geo/placeCache.js'
import { cardPhoto, resolvePlaceImage } from '../geo/placeMedia.js'
import { formatArs, loadPlaceProfile, referenceMenu } from '../geo/placeProfile.js'
import { useLocationData } from '../geo/LocationContext.jsx'

export default function PlaceDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { places, pharmacies, label } = useLocationData()
  const decoded = decodeURIComponent(id || '')
  const place =
    [...places, ...pharmacies].find((item) => item.id === decoded) || getCachedPlace(decoded)

  const [photo, setPhoto] = useState(place ? cardPhoto(place) : '')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!place) return
    let alive = true
    setLoading(true)
    resolvePlaceImage(place, label).then((url) => {
      if (alive && url) setPhoto(url)
    })
    loadPlaceProfile(place, label)
      .then((data) => {
        if (!alive) return
        setProfile(data)
        if (data.image) setPhoto(data.image)
      })
      .finally(() => {
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

  const fallback = referenceMenu(place.type)
  const gfItems = profile?.gfItems?.length ? profile.gfItems : fallback
  const menuItems = profile?.pricedItems?.length ? profile.pricedItems : fallback
  const realMenu = profile?.source === 'local'

  return (
    <main className="page">
      <button className="back" onClick={() => navigate(-1)}>
        ← Volver
      </button>
      <img
        className="place-hero-img"
        src={photo}
        alt={place.name}
        onError={(event) => {
          event.currentTarget.onerror = null
          event.currentTarget.src = cardPhoto(place)
        }}
      />
      <p className="meta" style={{ margin: '10px 0 0' }}>
        {place.type} · {formatDistance(place.distanceKm)}
      </p>
      <h2 className="page-title">{place.name}</h2>
      {place.address ? <p className="note">{place.address}</p> : null}
      {profile?.hours ? <p className="note">Horario: {profile.hours}</p> : null}
      {profile?.phone ? <p className="note">Tel: {profile.phone}</p> : null}

      <div className="tags" style={{ marginBottom: 16 }}>
        {(place.certified || profile?.gfOfficial) && <span className="tag ok">Sin TACC</span>}
        {profile?.cuisine ? <span className="tag">{profile.cuisine}</span> : null}
        {realMenu ? <span className="tag ok">Menú leído del local</span> : <span className="tag">Precios de referencia</span>}
      </div>

      {profile?.extract ? <p className="note">{profile.extract.slice(0, 280)}</p> : null}

      <div className="section-head">
        <h3>Qué ofrecen sin TACC</h3>
      </div>
      {loading && <p className="note">Buscando menú y precios del local…</p>}
      <div className="menu-list">
        {gfItems.map((item) => (
          <article className="card menu-row" key={`gf-${item.name}`}>
            <div>
              <h4>{item.name}</h4>
              <p className="meta">{item.gf || item.source === 'reference' ? 'Opción sin TACC' : 'Confirmar en el local'}</p>
            </div>
            <strong>{formatArs(item.price)}</strong>
          </article>
        ))}
      </div>

      {!realMenu && (
        <p className="note">
          Este local no publica el menú de forma legible. Mostramos precios habituales de Argentina
          para este tipo de sitio. Confirmá al pedir.
        </p>
      )}
      {realMenu ? (
        <>
          <div className="section-head">
            <h3>Precios y menú del lugar</h3>
          </div>
          <div className="menu-list">
            {menuItems.map((item) => (
              <article className="card menu-row" key={`m-${item.name}`}>
                <div>
                  <h4>{item.name}</h4>
                </div>
                <strong>{formatArs(item.price)}</strong>
              </article>
            ))}
          </div>
        </>
      ) : null}

      <div className="hero-actions" style={{ marginTop: 18 }}>
        <a className="btn btn-light" href={mapsUrl(place)} target="_blank" rel="noreferrer">
          Cómo llegar
        </a>
        {profile?.website ? (
          <a className="btn btn-ghost" href={profile.website} target="_blank" rel="noreferrer">
            Sitio del local
          </a>
        ) : null}
      </div>
    </main>
  )
}