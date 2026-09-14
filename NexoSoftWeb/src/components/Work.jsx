import { useCopy } from '../i18n/LanguageContext.jsx'

export default function Work() {
  const { copy } = useCopy()
  const { case: workCase, workIntro, workItems } = copy
  return (
    <section id="trabajo" className="work">
      <div className="section-head">
        <p className="kicker">{workIntro.kicker}</p>
        <h2>{workIntro.title}</h2>
      </div>
      <article className="case">
        <a className="case-visual" href="https://singlutenlife.site/">
          <div className="case-frame">
            <img src="/assets/case-singluten.png" alt={workCase.imageAlt} />
          </div>
          <span className="case-open">{workCase.open}</span>
        </a>
        <div className="case-copy">
          <p className="tag">{workCase.tag}</p>
          <h3>{workCase.title}</h3>
          <p>{workCase.text}</p>
          <ul>
            {workCase.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="case-actions">
            <a className="btn primary" href="https://singlutenlife.site/">
              {workCase.view}
            </a>
            <a className="text-link" href="#contacto">
              {workCase.similar}
            </a>
          </div>
        </div>
      </article>
      <div className="work-row">
        {workItems.map((item) => (
          <article key={item.title}>
            <img src={item.img} alt={item.alt} />
            <h4>{item.title}</h4>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
