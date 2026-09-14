import { useCopy } from '../i18n/LanguageContext.jsx'

export default function Quote() {
  const { copy } = useCopy()
  const quote = copy.quote
  return (
    <section className="quote">
      <blockquote>
        {quote.textBefore}
        <em>{quote.textAccent}</em>
        {quote.textAfter}
      </blockquote>
      <p>{quote.note}</p>
    </section>
  )
}
