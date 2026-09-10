import { APP_URL, WORK_ITEMS } from '../content'

export default function Work() {
  return (
    <section id="trabajo" className="work">
      <div className="section-head">
        <p className="kicker">Portafolio</p>
        <h2>Piezas recientes. El resto, en una llamada.</h2>
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
          <p className="tag">Producto · Salud · App web</p>
          <h3>SinGluten Life</h3>
          <p>
            Plataforma para personas celíacas: lugares seguros, farmacias, recetas y menú del
            día. Estética cálida, clara y confiable — hecha para usarse todos los días, no para
            impresionar un jury.
          </p>
          <ul>
            <li>Producto de consumo diario</li>
            <li>UI de app con mapa, recetas y discovery</li>
            <li>Stack: React + visión de backend .NET</li>
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
