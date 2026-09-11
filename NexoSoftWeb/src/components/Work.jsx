import { APP_URL, WORK_ITEMS } from '../content'

export default function Work() {
  return (
    <section id="trabajo" className="work">
      <div className="section-head">
        <p className="kicker">Ejemplos reales</p>
        <h2>Así se ve un sistema cuando está hecho para usarse.</h2>
      </div>
      <article className="case">
        <a className="case-visual" href={APP_URL}>
          <div className="case-frame">
            <img
              src="/assets/case-singluten.png"
              alt="Mesa con comida sin TACC y la app SinGluten Life en el celular"
            />
          </div>
          <span className="case-open">Abrir app →</span>
        </a>
        <div className="case-copy">
          <p className="tag">Salud · App para el día a día</p>
          <h3>SinGluten Life</h3>
          <p>
            Una app para personas celíacas: dónde comer, farmacias, recetas y el menú del día.
            Clara, cálida y fácil de usar — pensada para abrirla todos los días, no para
            impresionar.
          </p>
          <ul>
            <li>Encontrá lugares cerca, sin vueltas</li>
            <li>Recetas y menú del día al alcance</li>
            <li>Se ve y se siente como una app de verdad</li>
          </ul>
          <div className="case-actions">
            <a className="btn primary" href={APP_URL}>
              Ver la app
            </a>
            <a className="text-link" href="#contacto">
              Pedir un caso similar →
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
