import { SITE } from '../content'
import LangSwitch from '../i18n/LangSwitch.jsx'
import { useCopy } from '../i18n/LanguageContext.jsx'

export default function Header() {
  const { copy } = useCopy()
  const nav = copy.nav
  return (
    <header className="nav">
      <a className="logo" href="#top">
        <img src="/assets/favicon.png" alt="" width="36" height="36" />
        nexo<span>studio</span>
        <span className="sr-only">{SITE.name}</span>
      </a>
      <div className="nav-end">
        <nav aria-label={SITE.name}>
          <a href="#servicios">{nav.services}</a>
          <a href="#trabajo">{nav.work}</a>
          <a href="#proceso">{nav.process}</a>
          <a href="#contacto" className="nav-cta">
            {nav.start}
          </a>
        </nav>
        <LangSwitch />
      </div>
    </header>
  )
}
