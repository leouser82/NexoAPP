import { QUOTE } from '../content'

export default function Quote() {
  return (
    <section className="quote">
      <blockquote>
        {QUOTE.textBefore}
        <em>{QUOTE.textAccent}</em>
        {QUOTE.textAfter}
      </blockquote>
      <p>{QUOTE.note}</p>
    </section>
  )
}
