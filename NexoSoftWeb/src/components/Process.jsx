import { PROCESS_INTRO, STEPS } from '../content'

export default function Process() {
  return (
    <section id="proceso" className="process">
      <div className="section-head">
        <p className="kicker">{PROCESS_INTRO.kicker}</p>
        <h2>{PROCESS_INTRO.title}</h2>
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
