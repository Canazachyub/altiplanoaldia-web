import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AMBITOS, SECCIONES, SITIO, enlaceWhatsApp, pub } from '../config/sitio'
import { IcoArriba, IcoWhatsapp } from './Iconos'
import { Redes } from './Cabecera'

export default function Pie() {
  const [arriba, setArriba] = useState(false)
  useEffect(() => {
    const f = () => setArriba(window.scrollY > 900)
    window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])

  return (
    <>
      <footer className="pie">
        <div className="contenedor pie__in">
          <div className="pie__marca">
            <img src={pub('brand/logo-horizontal-blanco.svg')} alt="Altiplano al Día" width="240" height="53" />
            <p>{SITIO.lema}. Diario digital de Puno: periodismo regional hecho desde el altiplano para las 13 provincias.</p>
            <div className="pie__redes"><Redes conTexto /></div>
          </div>
          <nav aria-label="Secciones (pie)">
            <p className="pie__titulo">Secciones</p>
            <ul>
              {SECCIONES.map((s) => (
                <li key={s.clave}><Link to={`/seccion/${s.clave}`}>{s.nombre}</Link></li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Ámbitos (pie)">
            <p className="pie__titulo">Ámbitos</p>
            <ul>
              {AMBITOS.map((a) => (
                <li key={a.clave}><Link to={`/ambito/${a.clave}`}>{a.nombre}</Link></li>
              ))}
              <li><Link to="/lo-ultimo">Lo último</Link></li>
              <li><Link to="/provincias">Provincias</Link></li>
              <li><Link to="/clima">Clima y heladas</Link></li>
              <li><Link to="/ediciones">Edición en PDF</Link></li>
            </ul>
          </nav>
          <div>
            <p className="pie__titulo">Contacto</p>
            <ul>
              <li><Link to="/nosotros">Quiénes somos</Link></li>
              <li><Link to="/boletin">Boletín por WhatsApp</Link></li>
              <li><Link to="/denuncia">Haz tu denuncia</Link></li>
              <li><a href="/rss.xml">RSS</a></li>
            </ul>
            <a className="btn btn--amarillo pie__wa" href={enlaceWhatsApp('Hola Altiplano al Día, quiero hacer una denuncia: ')} target="_blank" rel="noopener noreferrer">
              <IcoWhatsapp size={18} /> {SITIO.whatsappVisible}
            </a>
          </div>
        </div>
        <div className="pie__legal">
          <div className="contenedor">
            © {new Date().getFullYear()} Altiplano al Día · Puno, Perú. Todos los derechos reservados. Créditos fotográficos en cada nota.
          </div>
        </div>
      </footer>
      <a className="wa-flotante" href={enlaceWhatsApp('Hola Altiplano al Día, quiero hacer una denuncia: ')} target="_blank" rel="noopener noreferrer" aria-label={`Denuncias por WhatsApp ${SITIO.whatsappVisible}`}>
        <IcoWhatsapp size={28} />
      </a>
      <button className={`ir-arriba${arriba ? ' ir-arriba--visible' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Volver arriba" tabIndex={arriba ? 0 : -1}>
        <IcoArriba size={22} />
      </button>
    </>
  )
}
