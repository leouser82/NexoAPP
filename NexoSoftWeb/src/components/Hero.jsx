import { MARQUEE } from '../content'

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-grid">
        <div className="hero-copy">
          <p className="kicker">Freelance · Producto digital · Remoto</p>
          <h1>
            Marcas que se ven
            <em>imposibles de ignorar.</em>
          </h1>
          <p className="lede">
            Diseño y desarrollo para negocios que quieren verse premium y vender más. Landing,
            web, apps y sistemas — con look de producto actual, no de plantilla.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href="#contacto">
              Quiero un proyecto
            </a>
            <a className="btn ghost" href="#trabajo">
              Ver portafolio
            </a>
          </div>
        </div>
        <figure className="hero-visual">
          <img
            src="/assets/hero-studio.png"
            alt="Escritorio de estudio digital con laptop y ambiente azul oscuro"
          />
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
