import { SERVICES } from '../content'

export default function Services() {
  return (
    <section id="servicios" className="services">
      <div className="section-head">
        <p className="kicker">Servicios</p>
        <h2>Lo que contrato un estudio por el precio de un freelance.</h2>
      </div>
      <div className="service-grid">
        {SERVICES.map((service) => (
          <article key={service.id} className={service.tall ? 'card tall' : 'card'}>
            <span>{service.id}</span>
            <h3>{service.title}</h3>
            <p>{service.text}</p>
            {service.items ? (
              <ul>
                {service.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
