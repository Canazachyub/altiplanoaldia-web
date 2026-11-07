// Denuncia, boletín y quiénes somos.
import { useState, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Redes } from '../components/Cabecera'
import { IcoWhatsapp } from '../components/Iconos'
import { IlustracionMarca } from '../components/Piezas'
import { SECCIONES, SITIO, enlaceWhatsApp, pub } from '../config/sitio'
import { useTitulo } from '../hooks/useTitulo'

function Arte({ src, seccion }: { src: string; seccion: string }) {
  const [ok, setOk] = useState(true)
  return ok ? <img src={pub(src)} alt="" className="pagina-arte" onError={() => setOk(false)} /> : <div className="pagina-arte"><IlustracionMarca seccion={seccion} /></div>
}

const DISTRITOS = ['Puno', 'Juliaca', 'Ilave', 'Azángaro', 'Ayaviri', 'Juli', 'Lampa', 'Huancané', 'Moho', 'Putina', 'Sandia', 'Macusani', 'Yunguyo', 'Desaguadero', 'Otro']
const TIPOS = ['Servicios públicos (agua, luz, pistas)', 'Seguridad ciudadana', 'Corrupción o mal uso de recursos', 'Salud', 'Educación', 'Medio ambiente', 'Transporte', 'Otro']

export function Denuncia() {
  useTitulo('Haz tu denuncia')
  const [f, setF] = useState({ nombre: '', lugar: 'Puno', tipo: TIPOS[0], detalle: '', anonimo: true })
  const [enviado, setEnviado] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string; checked?: boolean; type?: string } }) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const mensaje = [
    '*DENUNCIA CIUDADANA · Altiplano al Día*',
    `Tipo: ${f.tipo}`,
    `Lugar: ${f.lugar}`,
    `Remitente: ${f.anonimo || !f.nombre.trim() ? 'Reservado' : f.nombre.trim()}`,
    '',
    f.detalle.trim(),
    '',
    '(Adjunto fotos o videos en el siguiente mensaje)',
  ].join('\n')

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    window.open(enlaceWhatsApp(mensaje), '_blank', 'noopener')
    setEnviado(true)
  }

  return (
    <div className="contenedor pagina-estatica">
      <div className="pagina-estatica__cab">
        <div>
          <p className="antetitulo" style={{ '--tema': '#C62828' } as CSSProperties}><span>Tu voz es noticia</span></p>
          <h1 className="titulo-pagina">Haz tu denuncia</h1>
          <p className="subtitulo-pagina">
            Cuéntanos qué está pasando en tu barrio, distrito o comunidad. El formulario arma el mensaje y lo abre en WhatsApp
            para que lo envíes al <strong>{SITIO.whatsappVisible}</strong> junto con tus fotos o videos.
          </p>
        </div>
        <Arte src="img/ia/radio.png" seccion="Sociedad" />
      </div>

      <div className="denuncia">
        <form className="formulario" onSubmit={enviar}>
          <label>Tipo de denuncia
            <select value={f.tipo} onChange={set('tipo')}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
          <label>¿Dónde ocurre?
            <select value={f.lugar} onChange={set('lugar')}>{DISTRITOS.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
          <label>Cuéntanos qué pasó <span className="req">(obligatorio)</span>
            <textarea required minLength={20} rows={6} value={f.detalle} onChange={set('detalle')} placeholder="Qué pasó, cuándo, dónde exactamente y a quién afecta." />
          </label>
          <label className="check">
            <input type="checkbox" checked={f.anonimo} onChange={set('anonimo')} /> Mantener mi identidad en reserva
          </label>
          {!f.anonimo && (
            <label>Tu nombre
              <input value={f.nombre} onChange={set('nombre')} autoComplete="name" />
            </label>
          )}
          <button type="submit" className="btn btn--amarillo btn--grande"><IcoWhatsapp size={20} /> Enviar por WhatsApp</button>
          {enviado && <p className="formulario__ok" role="status">Se abrió WhatsApp con tu mensaje. Envíalo y adjunta tus fotos o videos. ¡Gracias!</p>}
        </form>
        <aside className="denuncia__info">
          <h2>Cómo trabajamos tu denuncia</h2>
          <ol>
            <li><strong>Recibimos</strong> tu mensaje por WhatsApp.</li>
            <li><strong>Verificamos</strong>: vamos al lugar, hablamos con los afectados y pedimos la versión de las autoridades.</li>
            <li><strong>Publicamos</strong> solo lo verificado, sin exponer tu identidad si así lo pides.</li>
          </ol>
          <p>¿Prefieres escribir directamente?</p>
          <a className="btn btn--azul" href={enlaceWhatsApp('Hola Altiplano al Día, quiero hacer una denuncia: ')} target="_blank" rel="noopener noreferrer"><IcoWhatsapp size={18} /> {SITIO.whatsappVisible}</a>
          <div className="denuncia__redes"><Redes conTexto /></div>
        </aside>
      </div>
    </div>
  )
}

export function Boletin() {
  useTitulo('Boletín por WhatsApp')
  const [nombre, setNombre] = useState('')
  const [temas, setTemas] = useState<string[]>(['Política', 'Seguridad'])
  const alternar = (t: string) => setTemas((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const msg = `Hola Altiplano al Día, quiero recibir el boletín por WhatsApp.\nNombre: ${nombre.trim() || '—'}\nTemas: ${temas.join(', ') || 'Todos'}`
    window.open(enlaceWhatsApp(msg), '_blank', 'noopener')
  }
  return (
    <div className="contenedor pagina-estatica">
      <div className="pagina-estatica__cab">
        <div>
          <h1 className="titulo-pagina">El boletín de Altiplano al Día</h1>
          <p className="subtitulo-pagina">Las noticias más importantes de Puno y la región, resumidas en un boletín que llega a tu WhatsApp. Gratis.</p>
        </div>
        <Arte src="img/ia/newsletter.png" seccion="Cultura" />
      </div>
      <form className="formulario formulario--angosto" onSubmit={enviar}>
        <label>Tu nombre
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="given-name" />
        </label>
        <fieldset>
          <legend>¿Qué temas te interesan?</legend>
          <div className="chips-check">
            {SECCIONES.filter((s) => s.clave !== 'otros').map((s) => (
              <label key={s.clave} className={`chip${temas.includes(s.nombre) ? ' chip--activo' : ''}`}>
                <input type="checkbox" checked={temas.includes(s.nombre)} onChange={() => alternar(s.nombre)} /> {s.nombre}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="btn btn--amarillo btn--grande"><IcoWhatsapp size={20} /> Suscribirme por WhatsApp</button>
        <p className="formulario__nota">Se abrirá WhatsApp con tu solicitud para el {SITIO.whatsappVisible}. Puedes darte de baja cuando quieras.</p>
      </form>
    </div>
  )
}

export function Nosotros() {
  useTitulo('Quiénes somos')
  return (
    <div className="contenedor pagina-estatica">
      <div className="pagina-estatica__cab">
        <div>
          <h1 className="titulo-pagina">Quiénes somos</h1>
          <p className="subtitulo-pagina">
            Altiplano al Día es un diario digital de Puno. Nuestra redacción cubre a diario lo que pasa en la ciudad y en las
            13 provincias de la región, con notas propias, claras y con los datos clave.
          </p>
        </div>
        <img src={pub('brand/logo-apilado.svg')} alt="Altiplano al Día" className="pagina-arte pagina-arte--logo" />
      </div>
      <div className="nosotros">
        <section>
          <h2>Cómo hacemos las notas</h2>
          <p>Nuestra redacción reportea en el terreno, consulta a las autoridades y a los vecinos, y publica solo lo verificado. Cada nota lleva la firma de la redacción y la fecha de publicación.</p>
        </section>
        <section>
          <h2>Contacto</h2>
          <p>Denuncias y avisos por WhatsApp: <a href={enlaceWhatsApp('Hola Altiplano al Día')} target="_blank" rel="noopener noreferrer">{SITIO.whatsappVisible}</a></p>
          <div className="denuncia__redes"><Redes conTexto /></div>
          <p><Link to="/denuncia">Ir al formulario de denuncia ›</Link></p>
        </section>
      </div>
    </div>
  )
}
