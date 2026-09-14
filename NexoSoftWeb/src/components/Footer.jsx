import { useCopy } from '../i18n/LanguageContext.jsx'

export default function Footer() {
  const { copy } = useCopy()
  return (
    <footer>
      <p>{copy.footer.legal}</p>
      <p>{copy.footer.note}</p>
    </footer>
  )
}
