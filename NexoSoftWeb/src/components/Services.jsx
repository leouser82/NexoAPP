import { useCopy } from '../i18n/LanguageContext.jsx'

export default function Services() {
  const { copy } = useCopy()
  return (
    <section id="servicios" className="services">
      <div className="section-head">
        <p className="kicker">{copy.servicesIntro.kicker}</p>
        <h2>{copy.servicesIntro.title}</h2>
      </div>
      <div className="service-grid">
        {copy.services.map((service) => (
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
