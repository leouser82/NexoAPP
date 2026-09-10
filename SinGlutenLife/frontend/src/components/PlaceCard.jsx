export default function PlaceCard({ place, extra }) {
  return (
    <article className="card place-card">
      <div>
        <h4>{place.name}</h4>
        <div className="meta">
          {place.type} · {place.address}
        </div>
        <div className="meta">{place.hours}</div>
      </div>
      <div className="distance">
        {place.distanceKm.toFixed(1)} km
        <div className="meta">★ {place.rating}</div>
      </div>
      <div className="tags">
        {place.certified && <span className="tag ok">Sin TACC certificado</span>}
        <span className="tag">{place.price}</span>
        {place.tags.slice(0, 2).map((t) => (
          <span className="tag" key={t}>
            {t}
          </span>
        ))}
        {extra}
      </div>
    </article>
  )
}
