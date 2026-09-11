import { MARQUEE } from '../content'

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-grid">
        <div className="hero-copy">
          <p className="kicker">Sitios y sistemas · Hosting propio · Hecho con IA</p>
          <h1>
            Tu negocio, online,
            <em>fácil de entender.</em>
          </h1>
          <p className="lede">
            Te armamos el sitio o el sistema que tu negocio necesita: se ve profesional, se
            entiende al toque y queda publicado en nuestro hosting. Vos te ocupás de vender;
            nosotros de que internet trabaje para vos.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href="#contacto">
              Quiero mi sitio
            </a>
            <a className="btn ghost" href="#proceso">
              Cómo trabajamos
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
