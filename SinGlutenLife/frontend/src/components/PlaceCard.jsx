import { Link } from 'react-router-dom'
import { cardPhoto, categoryPhoto } from '../geo/placeMedia.js'
import { formatDistance, mapsUrl } from '../geo/geo.js'

export default function PlaceCard({ place, extra, to }) {
  const dist = formatDistance(place.distanceKm)
  const href = to || `/lugar/${encodeURIComponent(place.id)}`

  return (
    <Link to={href} className="card place-card">
      <img
        className="place-thumb"
        src={cardPhoto(place)}
        alt=""
        onError={(event) => {
          event.currentTarget.onerror = null
          event.currentTarget.src = categoryPhoto(place.type)
        }}
      />
      <div>
        <h4>{place.name}</h4>
        <div className="meta">
          {place.type}
          {place.address ? ` · ${place.address}` : ''}
        </div>
        {place.hours ? <div className="meta">{place.hours}</div> : null}
      </div>
      <div className="distance">
        {dist}
        {place.lat ? (
          <span
            className="meta maps-link"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              window.open(mapsUrl(place), '_blank', 'noopener,noreferrer')
            }}
          >
            Cómo llegar
          </span>
        ) : null}
      </div>
      <div className="tags">
        {place.certified && <span className="tag ok">Sin TACC</span>}
        {(place.tags || []).slice(0, 2).map((t) => (
          <span className="tag" key={t}>
            {t}
          </span>
        ))}
        {extra}
      </div>
    </Link>
  )
}