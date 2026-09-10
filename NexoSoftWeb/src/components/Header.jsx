export default function Header() {
  return (
    <header className="nav">
      <a className="logo" href="#top">
        <img src="/assets/favicon.png" alt="" width="36" height="36" />
        nexo<span>studio</span>
      </a>
      <nav>
        <a href="#servicios">Servicios</a>
        <a href="#trabajo">Trabajo</a>
        <a href="#proceso">Método</a>
        <a href="#contacto" className="nav-cta">
          Reservar llamada
        </a>
      </nav>
    </header>
  )
}
