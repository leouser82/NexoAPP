import { useCopy } from '../i18n/LanguageContext.jsx'

export default function Proof() {
  const { copy } = useCopy()
  return (
    <section className="proof" aria-label={copy.proofAria}>
      {copy.proof.map((item) => (
        <article key={item.id}>
          <strong>{item.id}</strong>
          <p>{item.text}</p>
        </article>
      ))}
    </section>
  )
}
