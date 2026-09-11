export default function Header() {
  return (
    <header className="nav">
      <a className="logo" href="#top">
        <img src="/assets/favicon.png" alt="" width="36" height="36" />
        nexo<span>studio</span>
      </a>
      <nav>
        <a href="#servicios">Qué te llevás</a>
        <a href="#trabajo">Ejemplos</a>
        <a href="#proceso">Cómo va</a>
        <a href="#contacto" className="nav-cta">
          Empezar
        </a>
      </nav>
    </header>
  )
}
