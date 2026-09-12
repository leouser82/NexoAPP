import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDistance, mapsUrl } from '../geo/geo.js'
import { loadCardPhoto } from '../geo/placeDetails.js'
import { useLocationData } from '../geo/LocationContext.jsx'

/**
 * Shows a photo of this place or a neutral tile. Never a stock image.
 * Only starts looking once the card is close to the viewport.
 */
function PlaceThumb({ place }) {
  const { label } = useLocationData()
  const [src, setSrc] = useState(place.image || '')
  const holder = useRef(null)

  useEffect(() => {
    setSrc(place.image || '')
    if (place.image || !holder.current) return undefined

    let alive = true
    const node = holder.current
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        loadCardPhoto(place, label).then((url) => {
          if (alive && url) setSrc(url)
        })
      },
      { rootMargin: '300px' },
    )
    observer.observe(node)
    return () => {
      alive = false
      observer.disconnect()
    }
  }, [place.id, place.image, label])

  if (!src) {
    return (
      <div className="place-thumb placeholder" ref={holder} aria-hidden="true">
        {String(place.name || '?').trim().charAt(0).toUpperCase()}
      </div>
    )
  }

  return <img className="place-thumb" ref={holder} src={src} alt="" loading="lazy" onError={() => setSrc('')} />
}

function GlutenTag({ place, gfState }) {
  if (place.certified || gfState === 'confirmado') return <span className="tag ok">Sin TACC</span>
  if (gfState === 'mencionado') return <span className="tag ok">Sin TACC publicado</span>
  return <span className="tag warn">Sin confirmar</span>
}

export default function PlaceCard({ place, extra, to, gfState }) {
  const dist = formatDistance(place.distanceKm)
  const href = to || `/lugar/${encodeURIComponent(place.id)}`

  return (
    <Link to={href} className="card place-card">
      <PlaceThumb place={place} />
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
        <GlutenTag place={place} gfState={gfState} />
        {(place.tags || [])
          .filter((t) => t !== 'Cerca' && t !== 'A confirmar')
          .slice(0, 2)
          .map((t) => (
            <span className="tag" key={t}>
              {t}
            </span>
          ))}
        {extra}
      </div>
    </Link>
  )
}
