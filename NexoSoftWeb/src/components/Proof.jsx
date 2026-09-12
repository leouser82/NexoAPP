import { PROOF } from '../content'

export default function Proof() {
  return (
    <section className="proof" aria-label="Por qué Nexo Studio">
      {PROOF.map((item) => (
        <article key={item.id}>
          <strong>{item.id}</strong>
          <p>{item.text}</p>
        </article>
      ))}
    </section>
  )
}
