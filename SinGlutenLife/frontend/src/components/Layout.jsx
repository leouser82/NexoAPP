import { NavLink, Outlet } from 'react-router-dom'
import { BrandMark, IconBook, IconHome, IconMeal, IconPill, IconPin, IconShop } from './Icons.jsx'
import { user } from '../data/mock.js'

const links = [
  { to: '/', label: 'Inicio', icon: IconHome, end: true },
  { to: '/lugares', label: 'Lugares', icon: IconShop },
  { to: '/farmacias', label: 'Farmacias', icon: IconPill },
  { to: '/menu', label: 'Menú', icon: IconMeal },
  { to: '/recetas', label: 'Recetas', icon: IconBook },
]

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <nav className="bottom-nav">
          {links.map(({ to, label, icon: Ico, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Ico />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="content">
        <header className="topbar">
          <div className="brand">
            <BrandMark />
            <div>
              <h1>SinGluten Life</h1>
              <p>Comé rico. Comé seguro.</p>
            </div>
          </div>
          <div className="chip-location">
            <IconPin />
            {user.neighborhood}
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  )
}
