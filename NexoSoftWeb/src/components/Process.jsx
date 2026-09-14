import { useCopy } from '../i18n/LanguageContext.jsx'

export default function Process() {
  const { copy } = useCopy()
  return (
    <section id="proceso" className="process">
      <div className="section-head">
        <p className="kicker">{copy.processIntro.kicker}</p>
        <h2>{copy.processIntro.title}</h2>
      </div>
      <ol>
        {copy.steps.map((step) => (
          <li key={step.title}>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
