import { APP_URL, CASE, WORK_INTRO, WORK_ITEMS } from '../content'

export default function Work() {
  return (
    <section id="trabajo" className="work">
      <div className="section-head">
        <p className="kicker">{WORK_INTRO.kicker}</p>
        <h2>{WORK_INTRO.title}</h2>
      </div>
      <article className="case">
        <a className="case-visual" href={APP_URL}>
          <div className="case-frame">
            <img src="/assets/case-singluten.png" alt={CASE.imageAlt} />
          </div>
          <span className="case-open">{CASE.open}</span>
        </a>
        <div className="case-copy">
          <p className="tag">{CASE.tag}</p>
          <h3>{CASE.title}</h3>
          <p>{CASE.text}</p>
          <ul>
            {CASE.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="case-actions">
            <a className="btn primary" href={APP_URL}>
              {CASE.view}
            </a>
            <a className="text-link" href="#contacto">
              {CASE.similar}
            </a>
          </div>
        </div>
      </article>
      <div className="work-row">
        {WORK_ITEMS.map((item) => (
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
