import { STEPS } from '../content'

export default function Process() {
  return (
    <section id="proceso" className="process">
      <div className="section-head">
        <p className="kicker">Cómo va el trabajo</p>
        <h2>De tu primer mensaje a tu sitio en el aire.</h2>
      </div>
      <ol>
        {STEPS.map((step) => (
          <li key={step.title}>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
