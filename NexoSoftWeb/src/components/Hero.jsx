import { useCopy } from '../i18n/LanguageContext.jsx'

export default function Hero() {
  const { copy } = useCopy()
  const { hero, marquee } = copy
  return (
    <section className="hero">
      <div className="hero-grid">
        <div className="hero-copy">
          <p className="kicker">{hero.kicker}</p>
          <h1>
            {hero.titleBefore}
            <em>{hero.titleAccent}</em>
          </h1>
          <p className="lede">{hero.lede}</p>
          <div className="hero-actions">
            <a className="btn primary" href="#contacto">
              {hero.primary}
            </a>
            <a className="btn ghost" href="#proceso">
              {hero.secondary}
            </a>
          </div>
        </div>
        <figure className="hero-visual">
          <img src="/assets/hero-studio.png" alt={hero.imageAlt} />
        </figure>
      </div>
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...marquee, ...marquee].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
