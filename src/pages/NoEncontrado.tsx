import { useState } from 'react'
import { Link } from 'react-router-dom'
import { IlustracionMarca } from '../components/Piezas'
import { pub } from '../config/sitio'
import { useTitulo } from '../hooks/useTitulo'

export default function NoEncontrado() {
  useTitulo('Página no encontrada')
  const [ok, setOk] = useState(true)
  return (
    <div className="contenedor no-encontrado">
      <div className="no-encontrado__arte" aria-hidden="true">
        {ok ? <img src={pub('img/ia/error404.png')} alt="" onError={() => setOk(false)} /> : <IlustracionMarca seccion="Otros" />}
      </div>
      <p className="no-encontrado__codigo">404</p>
      <h1>Esta página se perdió en el altiplano</h1>
      <p>Puede que la nota se haya movido o que el enlace esté mal escrito.</p>
      <div className="no-encontrado__acciones">
        <Link to="/" className="btn btn--azul btn--grande">Ir a la portada</Link>
        <Link to="/buscar" className="btn btn--contorno">Buscar una noticia</Link>
      </div>
    </div>
  )
}
