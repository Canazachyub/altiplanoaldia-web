// Bloques de portada: sección, más leídas, denuncia, boletín, compartir.
import { useState, type CSSProperties, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { SITIO, enlaceWhatsApp, pub, seccionPorClave } from '../config/sitio'
import type { Nota } from '../data/noticias'
import { IcoEnlace, IcoFacebook, IcoFlecha, IcoMegafono, IcoWhatsapp, IcoX } from './Iconos'
import { IlustracionMarca } from './Piezas'
import Tarjeta from './Tarjeta'

export function TituloBloque({ titulo, enlace, color, icono }: { titulo: string; enlace?: string; color?: string; icono?: string }) {
  return (
    <div className="titulo-bloque" style={color ? ({ '--tema': color } as CSSProperties) : undefined}>
      <h2>
        {icono && <img src={pub(`icons/${icono}.png`)} alt="" width="26" height="26" className="titulo-bloque__ico" />}
        {enlace ? <Link to={enlace}>{titulo}</Link> : titulo}
      </h2>
      {enlace && (
        <Link to={enlace} className="titulo-bloque__mas">
          Ver más <IcoFlecha size={14} />
        </Link>
      )}
    </div>
  )
}

export function BloqueSeccion({ seccion, notas }: { seccion: string; notas: Nota[] }) {
  const s = seccionPorClave(seccion)
  if (!s || !notas.length) return null
  const [principal, ...resto] = notas
  return (
    <section className="bloque-seccion" aria-label={s.nombre}>
      <TituloBloque titulo={s.nombre} enlace={`/seccion/${s.clave}`} color={s.color} icono={s.icono} />
      <div className="bloque-seccion__grid">
        <Tarjeta nota={principal} variante="destacada" />
        <div className="bloque-seccion__lista">
          {resto.slice(0, 3).map((n) => (
            <Tarjeta key={n.id} nota={n} variante="horizontal" />
          ))}
        </div>
      </div>
    </section>
  )
}

export function MasLeidas({ notas }: { notas: Nota[] }) {
  return (
    <section className="mas-leidas" aria-label="Lo más leído">
      <TituloBloque titulo="Lo más leído" />
      <ol>
        {notas.map((n, i) => (
          <li key={n.id}><Tarjeta nota={n} variante="numerada" numero={i + 1} /></li>
        ))}
      </ol>
    </section>
  )
}

export function BannerDenuncia({ compacto = false }: { compacto?: boolean }) {
  const [ok, setOk] = useState(true)
  return (
    <section className={`banner-denuncia${compacto ? ' banner-denuncia--compacto' : ''}`} aria-label="Haz tu denuncia">
      <div className="banner-denuncia__arte" aria-hidden="true">
        {ok ? <img src={pub('img/ia/radio.png')} alt="" loading="lazy" onError={() => setOk(false)} /> : <IlustracionMarca seccion="Sociedad" compacta />}
      </div>
      <div className="banner-denuncia__texto">
        <p className="banner-denuncia__ante"><IcoMegafono size={18} /> Tu voz es noticia</p>
        <h2>¿Viste algo que Puno debe saber?</h2>
        <p>Envíanos tu denuncia con fotos o videos por WhatsApp. Verificamos cada caso antes de publicarlo y protegemos tu identidad.</p>
        <div className="banner-denuncia__acciones">
          <a className="btn btn--amarillo btn--grande" href={enlaceWhatsApp('Hola Altiplano al Día, quiero hacer una denuncia: ')} target="_blank" rel="noopener noreferrer">
            <IcoWhatsapp size={20} /> {SITIO.whatsappVisible}
          </a>
          {!compacto && <Link to="/denuncia" className="btn btn--contorno-claro">Llenar formulario</Link>}
        </div>
      </div>
    </section>
  )
}

export function CajaBoletin() {
  const [ok, setOk] = useState(true)
  return (
    <section className="caja-boletin" aria-label="Boletín por WhatsApp">
      {ok ? (
        <img src={pub('img/ia/newsletter.png')} alt="" className="caja-boletin__arte" loading="lazy" onError={() => setOk(false)} />
      ) : (
        <div className="caja-boletin__arte"><IlustracionMarca seccion="Cultura" compacta /></div>
      )}
      <div>
        <h2>El boletín de Altiplano al Día</h2>
        <p>Las noticias de Puno y la región, resumidas, directo a tu WhatsApp.</p>
        <Link to="/boletin" className="btn btn--azul">Suscribirme gratis</Link>
      </div>
    </section>
  )
}

/** "#Seguridad", "#MedioAmbiente": nombre de sección como hashtag (conserva tildes, como hacen los medios). */
const hashtag = (s: string) =>
  '#' + s.split(/[\s/]+/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join('').replace(/[^\p{L}\p{N}]/gu, '')

/**
 * Texto listo para publicar, al estilo de los medios regionales:
 * "#AltiplanoAlDía #Seguridad #Puno | <bajada>\n➡️ Lee la nota aquí: <enlace>"
 */
export function textoCompartir(nota: Nota, url: string, seccion: string) {
  const tags = [hashtag(SITIO.nombre), hashtag(seccion)]
  const lugar = (nota.lugar ?? '').split(/[,–-]/)[0].trim()
  if (lugar && lugar.length <= 20 && !tags.includes(hashtag(lugar))) tags.push(hashtag(lugar))
  const resumen = nota.bajada || nota.titular
  return `${tags.join(' ')} | ${resumen}\n➡️ Lee la nota aquí: ${url}`
}

export function Compartir({ url, titulo, texto, vertical = false }: { url: string; titulo: string; texto?: string; vertical?: boolean }) {
  const [aviso, setAviso] = useState('')
  const publicacion = texto ?? `${titulo}\n${url}`
  const avisar = (m: string, ms = 2500) => {
    setAviso(m)
    setTimeout(() => setAviso(''), ms)
  }
  const copiarTexto = async () => {
    try {
      await navigator.clipboard.writeText(publicacion)
      return true
    } catch {
      return false
    }
  }
  const copiar = async () => {
    if (await copiarTexto()) avisar('Publicación copiada: hashtags, resumen y enlace')
  }
  // Facebook no deja escribir el texto de la publicación desde fuera: lo copiamos y el usuario lo pega.
  const facebook = async (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const ventana = window.open(e.currentTarget.href, 'compartir-fb', 'width=640,height=640')
    if (await copiarTexto()) avisar('Texto copiado: pégalo en tu publicación (Ctrl+V o mantener presionado → Pegar)', 6000)
    if (!ventana) window.location.href = e.currentTarget.href
  }
  const u = encodeURIComponent(url)
  const etiqueta = encodeURIComponent(hashtag(SITIO.nombre))
  const sinEnlace = publicacion.replace(/\n?➡️ Lee la nota aquí: .*$/, '')
  return (
    <div className={`compartir${vertical ? ' compartir--vertical' : ''}`} aria-label="Compartir esta nota" role="group">
      <a className="compartir__btn compartir__btn--wa" href={`https://wa.me/?text=${encodeURIComponent(publicacion)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartir en WhatsApp"><IcoWhatsapp size={18} /></a>
      <a className="compartir__btn compartir__btn--fb" href={`https://www.facebook.com/sharer/sharer.php?u=${u}&hashtag=${etiqueta}`} onClick={facebook} target="_blank" rel="noopener noreferrer" aria-label="Compartir en Facebook (copia el texto listo para pegar)"><IcoFacebook size={18} /></a>
      <a className="compartir__btn compartir__btn--x" href={`https://x.com/intent/post?text=${encodeURIComponent(sinEnlace.slice(0, 230))}&url=${u}`} target="_blank" rel="noopener noreferrer" aria-label="Compartir en X"><IcoX size={16} /></a>
      <button className="compartir__btn" onClick={copiar} aria-label="Copiar publicación con enlace"><IcoEnlace size={18} /></button>
      <span className="compartir__aviso" role="status">{aviso}</span>
    </div>
  )
}
