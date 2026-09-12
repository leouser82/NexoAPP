import { HERO, MARQUEE } from '../content'

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-grid">
        <div className="hero-copy">
          <p className="kicker">{HERO.kicker}</p>
          <h1>
            {HERO.titleBefore}
            <em>{HERO.titleAccent}</em>
          </h1>
          <p className="lede">{HERO.lede}</p>
          <div className="hero-actions">
            <a className="btn primary" href="#contacto">
              {HERO.primary}
            </a>
            <a className="btn ghost" href="#proceso">
              {HERO.secondary}
            </a>
          </div>
        </div>
        <figure className="hero-visual">
          <img src="/assets/hero-studio.png" alt={HERO.imageAlt} />
        </figure>
      </div>
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...MARQUEE, ...MARQUEE].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
