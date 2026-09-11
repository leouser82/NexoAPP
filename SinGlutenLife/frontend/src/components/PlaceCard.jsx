import { formatDistance, mapsUrl } from '../geo/geo.js'

export default function PlaceCard({ place, extra }) {
  const dist = formatDistance(place.distanceKm)

  return (
    <article className="card place-card">
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
          <a className="meta maps-link" href={mapsUrl(place)} target="_blank" rel="noreferrer">
            Cómo llegar
          </a>
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
    </article>
  )
}