import { NAV, SITE } from '../content'

export default function Header() {
  return (
    <header className="nav">
      <a className="logo" href="#top">
        <img src="/assets/favicon.png" alt="" width="36" height="36" />
        nexo<span>studio</span>
        <span className="sr-only">{SITE.name}</span>
      </a>
      <nav aria-label={SITE.name}>
        <a href="#servicios">{NAV.services}</a>
        <a href="#trabajo">{NAV.work}</a>
        <a href="#proceso">{NAV.process}</a>
        <a href="#contacto" className="nav-cta">
          {NAV.start}
        </a>
      </nav>
    </header>
  )
}
