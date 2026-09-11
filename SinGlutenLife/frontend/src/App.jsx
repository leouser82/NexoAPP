import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import { LocationProvider } from './geo/LocationContext.jsx'
import Farmacias from './pages/Farmacias.jsx'
import Home from './pages/Home.jsx'
import Lugares from './pages/Lugares.jsx'
import MenuDelDia from './pages/MenuDelDia.jsx'
import PlaceDetalle from './pages/PlaceDetalle.jsx'
import RecetaDetalle from './pages/RecetaDetalle.jsx'
import Recetas from './pages/Recetas.jsx'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined

export default function App() {
  return (
    <LocationProvider>
      <BrowserRouter basename={basename}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="lugares" element={<Lugares />} />
            <Route path="farmacias" element={<Farmacias />} />
            <Route path="lugar/:id" element={<PlaceDetalle />} />
            <Route path="menu" element={<MenuDelDia />} />
            <Route path="recetas" element={<Recetas />} />
            <Route path="recetas/:id" element={<RecetaDetalle />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LocationProvider>
  )
}
