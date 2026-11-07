import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Cabecera, { Cinta } from './components/Cabecera'
import { AvisoNuevas, LimiteErrores } from './components/Extras'
import Pie from './components/Pie'
import { Clima, Ediciones, Guardadas, Provincia, Provincias } from './pages/Mas'
import { useNotas } from './data/noticias'
import { Boletin, Denuncia, Nosotros } from './pages/Estaticas'
import Inicio from './pages/Inicio'
import { Ambito, Buscar, LoUltimo, Seccion } from './pages/Listado'
import NoEncontrado from './pages/NoEncontrado'
import Nota from './pages/Nota'
import { registrarVisita } from './analitica'

const Admin = lazy(() => import('./pages/Admin'))

function AlCambiarRuta() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    // tras el cambio de título de la página nueva
    const t = window.setTimeout(() => registrarVisita(pathname), 300)
    return () => window.clearTimeout(t)
  }, [pathname])
  return null
}

export default function App() {
  const { notas } = useNotas()
  return (
    <>
      <AlCambiarRuta />
      <Cabecera />
      {notas && <Cinta notas={notas} />}
      <AvisoNuevas />
      <main id="contenido" tabIndex={-1}>
        <LimiteErrores>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/nota/:slug" element={<Nota />} />
          <Route path="/seccion/:clave" element={<Seccion />} />
          <Route path="/ambito/:clave" element={<Ambito />} />
          <Route path="/lo-ultimo" element={<LoUltimo />} />
          <Route path="/admin" element={<Suspense fallback={null}><Admin /></Suspense>} />
          <Route path="/buscar" element={<Buscar />} />
          <Route path="/denuncia" element={<Denuncia />} />
          <Route path="/boletin" element={<Boletin />} />
          <Route path="/nosotros" element={<Nosotros />} />
          <Route path="/provincias" element={<Provincias />} />
          <Route path="/provincia/:clave" element={<Provincia />} />
          <Route path="/clima" element={<Clima />} />
          <Route path="/ediciones" element={<Ediciones />} />
          <Route path="/medio/:slug" element={<Navigate to="/" replace />} />
          <Route path="/guardadas" element={<Guardadas />} />
          <Route path="*" element={<NoEncontrado />} />
        </Routes>
        </LimiteErrores>
      </main>
      <Pie />
    </>
  )
}
