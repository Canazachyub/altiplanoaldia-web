// Piezas de las páginas interiores (sección y nota) con la disposición tipo La República,
// manteniendo la marca de Altiplano al Día (tokens, fuentes, colores por tema).
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router-dom'
import { PROVINCIAS } from '../config/provincias'
import { ambitoPorValor, pub, seccionPorTema } from '../config/sitio'
import { masLeidas, provinciasDe, type Nota } from '../data/noticias'
import { ImagenNota, varTema } from './Piezas'

// ---------- Fechas ----------
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

/** Las fechas del monitor son hora de Puno sin zona: se leen tal cual, sin convertir a la zona del lector. */
function partes(iso: string | null) {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/)
  if (!m) return null
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return { a, mes, d, h: m[4] ?? '00', min: m[5] ?? '00', dia: new Date(Date.UTC(a, mes - 1, d)).getUTCDay() }
}
const dos = (n: number) => String(n).padStart(2, '0')

/** "Jueves 05 de noviembre del 2026 · 22:52h" */
export function fechaLR(iso: string | null) {
  const p = partes(iso)
  if (!p) return ''
  const dia = DIAS[p.dia]
  return `${dia[0].toUpperCase()}${dia.slice(1)} ${dos(p.d)} de ${MESES[p.mes - 1]} del ${p.a} · ${p.h}:${p.min}h`
}

/** "05 NOV 26 | 17:52 h" */
export function fechaCortaLR(iso: string | null) {
  const p = partes(iso)
  if (!p) return ''
  return `${dos(p.d)} ${MESES_CORTOS[p.mes - 1]} ${String(p.a).slice(2)} | ${p.h}:${p.min} h`
}

/** "Jueves 05 de noviembre del 2026" (para separar el feed por día). */
export function diaLR(iso: string | null) {
  return fechaLR(iso).split(' · ')[0] || 'Sin fecha'
}

/** Etiqueta corta de la fila: provincia mencionada → ámbito. */
export function kickerLR(n: Nota) {
  const prov = provinciasDe(n, PROVINCIAS)[0]
  if (prov) return PROVINCIAS.find((p) => p.clave === prov)?.nombre ?? ''
  return ambitoPorValor(n.ambito)?.nombre ?? ''
}

const url = (n: Nota) => `/nota/${n.slug}`

// ---------- Estructura ----------
/** Publica la altura real de la cabecera fija en `--lri-cab-alto` (para los elementos pegajosos). */
function useAltoCabecera() {
  useEffect(() => {
    const cab = document.querySelector<HTMLElement>('.cabecera')
    if (!cab) return
    const fijar = () => document.documentElement.style.setProperty('--lri-cab-alto', `${Math.round(cab.getBoundingClientRect().height)}px`)
    fijar()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(fijar)
    ro.observe(cab)
    return () => ro.disconnect()
  }, [])
}

/** Fondo gris a todo el ancho + contenedor de 1288 px. */
export function PaginaLR({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  useAltoCabecera()
  return (
    <div className="lri" style={style}>
      <div className={`lri-contenedor ${className}`}>{children}</div>
    </div>
  )
}

/** Título de bloque: texto sans en mayúsculas con barra corta del color del tema debajo. */
export function TituloLR({ titulo, nivel = 'h2', enlace }: { titulo: string; nivel?: 'h1' | 'h2'; enlace?: string }) {
  const H = nivel
  return (
    <H className={`lri-titulo lri-titulo--${nivel}`}>
      {enlace ? <Link to={enlace}>{titulo}</Link> : titulo}
    </H>
  )
}

export function CabeceraLR({ titulo, descripcion, color, icono, children }: { titulo: string; descripcion?: string; color: string; icono?: string; children?: ReactNode }) {
  const [ico, setIco] = useState(true)
  return (
    <header className="lri-cab" style={{ '--tema': color } as CSSProperties}>
      <div className="lri-cab__fila">
        {icono && ico && <img className="lri-cab__ico" src={pub(`icons/${icono}.png`)} alt="" width="40" height="40" onError={() => setIco(false)} />}
        <TituloLR titulo={titulo} nivel="h1" />
      </div>
      {descripcion && <p className="lri-cab__desc">{descripcion}</p>}
      {children}
    </header>
  )
}

// ---------- Apertura de sección: 1 grande + 4 medianas ----------
export function AperturaLR({ notas }: { notas: Nota[] }) {
  if (!notas.length) return null
  const [grande, ...medianas] = notas
  return (
    <section className="lri-apertura" aria-label="Principales">
      <article className="lri-apertura__grande" style={varTema(grande.tema)}>
        <Link to={url(grande)} className="lri-media" tabIndex={-1} aria-hidden="true"><ImagenNota nota={grande} prioridad /></Link>
        <h2 className="lri-apertura__titular lri-apertura__titular--grande"><Link to={url(grande)}>{grande.titular}</Link></h2>
      </article>
      {medianas.slice(0, 4).map((n) => (
        <article key={n.id} className="lri-apertura__mediana" style={varTema(n.tema)}>
          <Link to={url(n)} className="lri-media" tabIndex={-1} aria-hidden="true"><ImagenNota nota={n} prioridad /></Link>
          <h2 className="lri-apertura__titular"><Link to={url(n)}>{n.titular}</Link></h2>
        </article>
      ))}
    </section>
  )
}

// ---------- Fila del feed ----------
export function FilaLR({ nota }: { nota: Nota }) {
  const k = kickerLR(nota)
  return (
    <article className="lri-fila" style={varTema(nota.tema)}>
      <Link to={url(nota)} className="lri-media lri-fila__media" tabIndex={-1} aria-hidden="true"><ImagenNota nota={nota} /></Link>
      <div className="lri-fila__texto">
        {k && <p className="lri-kicker">{k}</p>}
        <h3 className="lri-fila__titular"><Link to={url(nota)}>{nota.titular}</Link></h3>
        {nota.bajada && <p className="lri-fila__bajada">{nota.bajada}</p>}
        <p className="lri-fecha"><time dateTime={nota.fecha ?? undefined}>{fechaLR(nota.fecha)}</time></p>
      </div>
    </article>
  )
}

const LOTE = 12

/** Agrupa notas consecutivas del mismo día (para "Lo último"). */
function porDias(notas: Nota[]) {
  const grupos: { dia: string; notas: Nota[] }[] = []
  for (const n of notas) {
    const dia = diaLR(n.fecha)
    const ult = grupos[grupos.length - 1]
    if (ult && ult.dia === dia) ult.notas.push(n)
    else grupos.push({ dia, notas: [n] })
  }
  return grupos
}

/**
 * "Más noticias": filas con miniatura a la izquierda y botón "Ver más noticias (N)" que carga de 12 en 12.
 * Al cargar más, el foco pasa al titular de la primera nota nueva. Con `porDia`, cada día es un grupo
 * con su encabezado pegado bajo la cabecera mientras se recorre ese día.
 */
export function FeedLR({ notas, titulo = 'Más noticias', vacio, porDia = false }: { notas: Nota[]; titulo?: string; vacio?: string; porDia?: boolean }) {
  const [n, setN] = useState(LOTE)
  const raiz = useRef<HTMLElement>(null)
  const enfocar = useRef<number | null>(null)
  useEffect(() => {
    const i = enfocar.current
    if (i === null) return
    enfocar.current = null
    const fila = raiz.current?.querySelectorAll<HTMLElement>('.lri-fila')[i]
    fila?.querySelector<HTMLElement>('.lri-fila__titular a')?.focus()
  }, [n])
  if (!notas.length) return vacio ? <p className="vacio">{vacio}</p> : null
  const visibles = notas.slice(0, n)
  const restantes = notas.length - visibles.length
  const filas = (lista: Nota[]) => (
    <ul className="lri-feed__lista">
      {lista.map((x) => <li key={x.id}><FilaLR nota={x} /></li>)}
    </ul>
  )
  return (
    <section className={`lri-feed${porDia ? ' lri-feed--dias' : ''}`} aria-label={titulo || 'Noticias'} ref={raiz}>
      {titulo && <TituloLR titulo={titulo} />}
      {porDia
        ? porDias(visibles).map((g, i) => (
            <section key={`${g.dia}-${i}`} className="lri-feed__grupo" aria-label={g.dia}>
              <h2 className="lri-feed__dia">{g.dia}</h2>
              {filas(g.notas)}
            </section>
          ))
        : filas(visibles)}
      {restantes > 0 && (
        <div className="lri-feed__mas">
          <button
            className="lri-boton"
            onClick={() => {
              enfocar.current = n
              setN(n + LOTE)
            }}
          >
            Ver más noticias ({restantes})
          </button>
        </div>
      )}
    </section>
  )
}

// ---------- Columna derecha ----------
function FilaRail({ nota, conHora = false }: { nota: Nota; conHora?: boolean }) {
  return (
    <article className="lri-rfila" style={varTema(nota.tema)}>
      <Link to={url(nota)} className="lri-media lri-rfila__media" tabIndex={-1} aria-hidden="true"><ImagenNota nota={nota} /></Link>
      <div>
        {conHora && <p className="lri-rfila__hora"><time dateTime={nota.fecha ?? undefined}>{fechaCortaLR(nota.fecha)}</time></p>}
        <h3 className="lri-rfila__titular"><Link to={url(nota)}>{nota.titular}</Link></h3>
      </div>
    </article>
  )
}

export function MasVistoLR({ notas }: { notas: Nota[] }) {
  if (!notas.length) return null
  const [primera, ...resto] = notas
  return (
    <section className="lri-bloque" aria-label="Lo más visto">
      <TituloLR titulo="Lo más visto" />
      <article className="lri-rdest" style={varTema(primera.tema)}>
        <Link to={url(primera)} className="lri-media lri-rdest__media" tabIndex={-1} aria-hidden="true"><ImagenNota nota={primera} /></Link>
        <h3 className="lri-rdest__titular"><Link to={url(primera)}>{primera.titular}</Link></h3>
      </article>
      <ul className="lri-rlista">{resto.map((n) => <li key={n.id}><FilaRail nota={n} /></li>)}</ul>
    </section>
  )
}

export function LoUltimoLR({ notas }: { notas: Nota[] }) {
  if (!notas.length) return null
  return (
    <section className="lri-bloque" aria-label="Lo último">
      <TituloLR titulo="Lo último" enlace="/lo-ultimo" />
      <ul className="lri-rlista">{notas.map((n) => <li key={n.id}><FilaRail nota={n} conHora /></li>)}</ul>
    </section>
  )
}

/**
 * Oculta las filas del bloque pegajoso que no entran completas en la pantalla (solo escritorio), para que
 * el bloque fijo nunca quede más alto que la ventana y se corte. Se recalcula al cambiar la ventana o la cabecera.
 */
function useCabeEnPantalla(ref: RefObject<HTMLElement | null>, activo: boolean, clave: string) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!activo || !el) return
    const ajustar = () => {
      const filas = Array.from(el.querySelectorAll<HTMLElement>('.lri-rlista > li'))
      filas.forEach((li) => { li.hidden = false })
      if (!window.matchMedia('(min-width: 1025px)').matches) return
      const top = parseFloat(getComputedStyle(el).top) || 0
      const max = window.innerHeight - top - 32 // margen inferior + relleno del bloque
      const base = el.getBoundingClientRect().top
      const corte = filas.findIndex((li) => li.getBoundingClientRect().bottom - base > max)
      // Siempre queda al menos una fila visible; desde la que no entra, se ocultan todas las siguientes.
      if (corte >= 0) filas.slice(Math.max(1, corte)).forEach((li) => { li.hidden = true })
    }
    ajustar()
    window.addEventListener('resize', ajustar)
    const cab = document.querySelector('.cabecera')
    const ro = typeof ResizeObserver !== 'undefined' && cab ? new ResizeObserver(ajustar) : null
    if (ro && cab) ro.observe(cab)
    return () => {
      window.removeEventListener('resize', ajustar)
      ro?.disconnect()
    }
  }, [ref, activo, clave])
}

/** Columna derecha completa: "Lo más visto" + "Lo último" (sitio entero), sin repetir notas. */
export function RailLR({ todas, excluir = [], pegajoso = false }: { todas: Nota[]; excluir?: number[]; pegajoso?: boolean }) {
  const pegado = useRef<HTMLDivElement>(null)
  const fuera = new Set(excluir)
  const base = todas.filter((n) => !fuera.has(n.id))
  const vistas = masLeidas(base, 5)
  const ids = new Set(vistas.map((n) => n.id))
  const ultimas = base.filter((n) => !ids.has(n.id)).slice(0, 5)
  useCabeEnPantalla(pegado, pegajoso, ultimas.map((n) => n.id).join(','))
  return (
    <aside className={`lri-rail${pegajoso ? ' lri-rail--pegajoso' : ''}`} aria-label="Otras noticias">
      <MasVistoLR notas={vistas} />
      <div className="lri-rail__pegado" ref={pegado}><LoUltimoLR notas={ultimas} /></div>
    </aside>
  )
}

// ---------- Nota ----------
/** Imagen principal a lo ancho de la columna, con crédito debajo. Si es una foto real, se amplía en un visor. */
export function MediaNotaLR({ nota }: { nota: Nota }) {
  const [fallo, setFallo] = useState(false)
  const visor = useRef<HTMLDialogElement>(null)
  const esFoto = !!nota.imagen && !fallo
  const credito = esFoto ? (nota.medios[0] ? `Foto: ${nota.medios[0]}` : 'Foto') : 'Ilustración: Altiplano al Día'
  const cerrar = () => visor.current?.close()
  return (
    <figure className="lri-nota__media">
      {/* El error de la foto sube desde <ImagenNota>: así sabemos si se mostró la ilustración de reemplazo. */}
      <div className={`lri-media${esFoto ? ' lri-media--ampliable' : ''}`} onError={() => setFallo(true)}>
        <ImagenNota nota={nota} prioridad />
        {esFoto && (
          <button type="button" className="lri-ampliar" aria-haspopup="dialog" aria-label="Ampliar foto" onClick={() => visor.current?.showModal()}>
            <span className="lri-ampliar__ico" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
            </span>
          </button>
        )}
      </div>
      <figcaption className="lri-nota__credito">{credito}</figcaption>
      {esFoto && nota.imagen && (
        <dialog
          ref={visor}
          className="lri-visor"
          aria-label="Foto ampliada"
          onClick={(e) => {
            // Un clic fuera de la foto y del crédito cierra el visor (Esc lo cierra de forma nativa).
            if (!(e.target as HTMLElement).closest('img, .lri-visor__credito, button')) cerrar()
          }}
        >
          <button type="button" className="lri-visor__cerrar" onClick={cerrar} aria-label="Cerrar foto">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <div className="lri-visor__marco">
            <img src={pub(nota.imagen)} alt={nota.titular} loading="lazy" decoding="async" />
            <p className="lri-visor__credito">{credito}</p>
          </div>
        </dialog>
      )}
    </figure>
  )
}

/** Viñetas de "En resumen": los datos clave (3 a 5) o, si faltan, la primera oración de los primeros párrafos. */
export function resumenDe(n: Nota, max = 5) {
  const items = n.datos.map((d) => d.trim()).filter(Boolean).slice(0, max)
  for (const p of n.cuerpo.slice(0, 3)) {
    if (items.length >= 3) break
    const t = p.trim()
    const frase = t.match(/^.+?[.!?](?=\s+[A-ZÁÉÍÓÚÑ¿¡"“«]|$)/)?.[0] ?? t
    if (frase && !items.includes(frase)) items.push(frase)
  }
  return items
}

/** Caja "En resumen" (se abre con el botón "Resumen" de la fila de herramientas). */
export function ResumenLR({ id, items, abierto }: { id: string; items: string[]; abierto: boolean }) {
  return (
    <section id={id} className="lri-resumen" aria-label="En resumen" hidden={!abierto}>
      <h2 className="lri-resumen__titulo">En resumen</h2>
      <ul>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </section>
  )
}

/** Etiquetas al final de la nota: sección, provincias, ámbito y medios, como píldoras. */
export function EtiquetasLR({ nota }: { nota: Nota }) {
  const s = seccionPorTema(nota.tema)
  const a = ambitoPorValor(nota.ambito)
  const claves = provinciasDe(nota, PROVINCIAS)
  const provs = PROVINCIAS.filter((p) => claves.includes(p.clave))
  return (
    <nav className="lri-etiquetas" aria-label="Etiquetas de la nota">
      <h2 className="lri-etiquetas__titulo">Etiquetas</h2>
      <ul>
        <li><Link to={`/seccion/${s.clave}`} className="chip">{s.nombre}</Link></li>
        {provs.map((p) => (
          <li key={p.clave}>
            <Link to={`/provincia/${p.clave}`} className="chip">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" /></svg>
              {p.nombre}
            </Link>
          </li>
        ))}
        {a && <li><Link to={`/ambito/${a.clave}`} className="chip">{a.nombre}</Link></li>}
      </ul>
    </nav>
  )
}

/** Tarjeta "Siguiente nota" a todo el ancho al final del cuerpo. */
export function SiguienteLR({ nota }: { nota: Nota }) {
  const s = seccionPorTema(nota.tema)
  return (
    <aside className="lri-siguiente" style={varTema(nota.tema)} aria-label="Siguiente nota">
      <Link to={url(nota)} className="lri-siguiente__enlace">
        <div className="lri-media lri-siguiente__media" aria-hidden="true"><ImagenNota nota={nota} /></div>
        <div className="lri-siguiente__texto">
          <p className="lri-siguiente__etiqueta">Siguiente nota <span aria-hidden="true">·</span> {s.nombre}</p>
          <p className="lri-siguiente__titular">{nota.titular}</p>
          <p className="lri-siguiente__cta">Leer siguiente <span aria-hidden="true">→</span></p>
        </div>
      </Link>
    </aside>
  )
}

/** Tarjeta "Puedes ver" dentro del cuerpo de la nota. */
export function PuedesVerLR({ nota }: { nota: Nota }) {
  return (
    <aside className="lri-puedes" style={varTema(nota.tema)} aria-label="Puedes ver">
      <div className="lri-puedes__texto">
        <p className="lri-puedes__etiqueta">Puedes ver</p>
        <Link to={url(nota)} className="lri-puedes__titular">{nota.titular}</Link>
      </div>
      <Link to={url(nota)} className="lri-media lri-puedes__media" tabIndex={-1} aria-hidden="true"><ImagenNota nota={nota} /></Link>
    </aside>
  )
}

/** "Notas relacionadas": 3 tarjetas con imagen 2:1 arriba y titular. */
export function RelacionadasLR({ notas }: { notas: Nota[] }) {
  if (!notas.length) return null
  return (
    <section className="lri-relacionadas" aria-label="Notas relacionadas">
      <TituloLR titulo="Notas relacionadas" />
      <div className="lri-relacionadas__grid">
        {notas.map((n) => (
          <article key={n.id} className="lri-rel" style={varTema(n.tema)}>
            <Link to={url(n)} className="lri-media lri-rel__media" tabIndex={-1} aria-hidden="true"><ImagenNota nota={n} /></Link>
            {kickerLR(n) && <p className="lri-kicker">{kickerLR(n)}</p>}
            <h3 className="lri-rel__titular"><Link to={url(n)}>{n.titular}</Link></h3>
          </article>
        ))}
      </div>
    </section>
  )
}
