// Funciones extra: aviso de notas nuevas, límite de errores, esqueletos, lectura en voz alta, guardar,
// y la tarjeta vertical para historias (TikTok, WhatsApp, Facebook).
import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SITIO, pub, seccionPorTema } from '../config/sitio'
import { aplicarNotas, consultarNuevas, fechaLarga, useGuardadas, useNotas, type Nota } from '../data/noticias'

// ---------- Aviso de notas nuevas (consulta cada 3 minutos) ----------
export function AvisoNuevas() {
  const { notas } = useNotas()
  const [frescas, setFrescas] = useState<Nota[] | null>(null)
  const ids = useRef<Set<number>>(new Set())
  useEffect(() => {
    if (notas) ids.current = new Set(notas.map((n) => n.id))
  }, [notas])
  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden) return
      consultarNuevas()
        .then((f) => {
          if (f.some((n) => !ids.current.has(n.id))) setFrescas(f)
        })
        .catch(() => {})
    }, 180_000)
    return () => clearInterval(t)
  }, [])
  if (!frescas) return null
  const nuevas = frescas.filter((n) => !ids.current.has(n.id)).length
  return (
    <button
      className="aviso-nuevas"
      onClick={() => {
        aplicarNotas(frescas)
        setFrescas(null)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }}
    >
      ↑ {nuevas === 1 ? 'Hay 1 noticia nueva' : `Hay ${nuevas} noticias nuevas`} · Ver ahora
    </button>
  )
}

// ---------- Límite de errores ----------
export class LimiteErrores extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="contenedor aviso-error" role="alert">
        <strong>Algo falló al mostrar esta página.</strong> Recarga la página o vuelve a la portada.
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="btn btn--azul" onClick={() => location.reload()}>Recargar</button>
          <a className="btn btn--contorno" href="/">Ir a la portada</a>
        </div>
      </div>
    )
  }
}

// ---------- Esqueleto de carga ----------
export function Esqueleto({ variante = 'portada' }: { variante?: 'portada' | 'nota' }) {
  if (variante === 'nota')
    return (
      <div className="contenedor esqueleto" role="status" aria-label="Cargando nota">
        <span className="esq esq--linea" style={{ width: 160 }} />
        <span className="esq esq--titulo" />
        <span className="esq esq--titulo" style={{ width: '70%' }} />
        <span className="esq esq--media" />
        {[1, 2, 3, 4].map((i) => <span key={i} className="esq esq--linea" />)}
      </div>
    )
  return (
    <div className="contenedor esqueleto" role="status" aria-label="Cargando noticias">
      <div className="esqueleto__apertura">
        <div><span className="esq esq--media" /><span className="esq esq--titulo" /><span className="esq esq--titulo" style={{ width: '60%' }} /></div>
        <div>{[1, 2, 3, 4, 5, 6].map((i) => <span key={i} className="esq esq--linea" />)}</div>
      </div>
      <div className="grid-4">{[1, 2, 3, 4].map((i) => <div key={i}><span className="esq esq--media" /><span className="esq esq--linea" /></div>)}</div>
    </div>
  )
}

// ---------- Escuchar la nota (Web Speech API) ----------
export function Escuchar({ nota }: { nota: Nota }) {
  const disponible = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [estado, setEstado] = useState<'parado' | 'hablando' | 'pausa'>('parado')
  useEffect(() => () => { if (disponible) speechSynthesis.cancel() }, [disponible, nota.id])
  if (!disponible) return null
  const iniciar = () => {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance([nota.titular, nota.bajada, ...nota.cuerpo].join('. '))
    u.lang = 'es-PE'
    const voz = speechSynthesis.getVoices().find((v) => v.lang.startsWith('es'))
    if (voz) u.voice = voz
    u.rate = 1.02
    u.onend = () => setEstado('parado')
    u.onerror = () => setEstado('parado')
    speechSynthesis.speak(u)
    setEstado('hablando')
  }
  const etiqueta = estado === 'hablando' ? 'Pausar' : estado === 'pausa' ? 'Continuar' : 'Escuchar'
  return (
    <span className="escuchar">
      <button
        className="btn-herramienta"
        aria-pressed={estado === 'hablando'}
        onClick={() => {
          if (estado === 'parado') iniciar()
          else if (estado === 'hablando') { speechSynthesis.pause(); setEstado('pausa') }
          else { speechSynthesis.resume(); setEstado('hablando') }
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          {estado === 'hablando' ? <path d="M9 5v14M15 5v14" /> : <path d="M3 10v4h4l5 4V6L7 10H3zM16 9a4 4 0 0 1 0 6" />}
        </svg>
        {etiqueta}
      </button>
      {estado !== 'parado' && (
        <button className="btn-herramienta" onClick={() => { speechSynthesis.cancel(); setEstado('parado') }} aria-label="Detener lectura">■</button>
      )}
    </span>
  )
}

// ---------- Guardar ----------
export function BotonGuardar({ nota, compacto = false }: { nota: Nota; compacto?: boolean }) {
  const { esta, alternar } = useGuardadas()
  const g = esta(nota.id)
  return (
    <button
      className={`btn-herramienta${g ? ' btn-herramienta--activo' : ''}${compacto ? ' btn-herramienta--icono' : ''}`}
      aria-pressed={g}
      aria-label={g ? 'Quitar de guardadas' : 'Guardar para leer después'}
      onClick={(e) => { e.preventDefault(); alternar(nota.id) }}
      title={g ? 'Guardada' : 'Guardar'}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={g ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 3h12v18l-6-4-6 4z" />
      </svg>
      {!compacto && (g ? 'Guardada' : 'Guardar')}
    </button>
  )
}

// ---------- Tarjeta vertical para historias ----------
function cargarImagen(src: string) {
  return new Promise<HTMLImageElement>((ok, mal) => {
    const i = new Image()
    i.onload = () => ok(i)
    i.onerror = mal
    i.src = src
  })
}

function partirLineas(ctx: CanvasRenderingContext2D, texto: string, ancho: number) {
  const palabras = texto.split(' ')
  const lineas: string[] = []
  let l = ''
  for (const p of palabras) {
    const prueba = l ? `${l} ${p}` : p
    if (ctx.measureText(prueba).width > ancho && l) { lineas.push(l); l = p } else l = prueba
  }
  if (l) lineas.push(l)
  return lineas
}

export async function dibujarHistoria(nota: Nota): Promise<Blob> {
  const W = 1080, H = 1920, M = 80
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  await Promise.all([
    document.fonts.load('700 80px "Zilla Slab"'),
    document.fonts.load('800 40px "Fira Sans Condensed"'),
    document.fonts.load('400 40px "PT Serif"'),
  ])
  const color = seccionPorTema(nota.tema).color
  ctx.fillStyle = '#043F9B'
  ctx.fillRect(0, 0, W, H)

  // Foto (o ilustración) arriba, recortada a cubrir
  const altoFoto = 980
  try {
    const img = await cargarImagen(pub(nota.imagen ?? `img/ia/${nota.seccion}.png`))
    const k = Math.max(W / img.width, altoFoto / img.height)
    const w = img.width * k, h = img.height * k
    ctx.drawImage(img, (W - w) / 2, (altoFoto - h) / 2, w, h)
  } catch {
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(0, 760); ctx.lineTo(260, 520); ctx.lineTo(420, 660); ctx.lineTo(640, 420); ctx.lineTo(1080, 800); ctx.stroke()
    ctx.strokeStyle = '#FFEE00'; ctx.beginPath(); ctx.arc(800, 260, 90, 0, Math.PI * 2); ctx.stroke()
  }
  const grad = ctx.createLinearGradient(0, altoFoto - 300, 0, altoFoto)
  grad.addColorStop(0, 'rgba(4,63,155,0)'); grad.addColorStop(1, 'rgba(4,63,155,1)')
  ctx.fillStyle = grad; ctx.fillRect(0, altoFoto - 300, W, 300)

  // Etiqueta de sección
  let y = altoFoto + 30
  ctx.font = '800 38px "Fira Sans Condensed"'
  const etiqueta = seccionPorTema(nota.tema).nombre.toUpperCase()
  const we = ctx.measureText(etiqueta).width + 48
  ctx.fillStyle = '#FFEE00'; ctx.fillRect(M, y, we, 64)
  ctx.fillStyle = color === '#043F9B' ? '#111' : color; ctx.fillRect(M, y + 58, we, 6)
  ctx.fillStyle = '#111'; ctx.textBaseline = 'middle'; ctx.fillText(etiqueta, M + 24, y + 33)
  y += 120

  // Titular
  ctx.textBaseline = 'alphabetic'
  let tam = 82
  ctx.font = `700 ${tam}px "Zilla Slab"`
  let lineas = partirLineas(ctx, nota.titular, W - M * 2)
  while (lineas.length > 6 && tam > 56) { tam -= 6; ctx.font = `700 ${tam}px "Zilla Slab"`; lineas = partirLineas(ctx, nota.titular, W - M * 2) }
  ctx.fillStyle = '#fff'
  for (const l of lineas) { y += tam * 1.12; ctx.fillText(l, M, y) }

  // Fecha
  y += 60
  ctx.font = '400 34px "PT Serif"'; ctx.fillStyle = '#DCE6F7'
  ctx.fillText(fechaLarga(nota.fecha).replace(/^./, (x) => x.toUpperCase()), M, y)

  // Pie con logo y contacto
  ctx.fillStyle = '#022A69'; ctx.fillRect(0, H - 260, W, 260)
  try {
    const logo = await cargarImagen(pub('brand/logo-horizontal-blanco.svg'))
    const lw = 520, lh = (logo.height / logo.width) * lw
    ctx.drawImage(logo, M, H - 260 + (170 - lh) / 2 + 20, lw, lh)
  } catch { /* sin logo */ }
  ctx.font = '800 32px "Fira Sans Condensed"'; ctx.fillStyle = '#FFEE00'; ctx.textAlign = 'right'
  ctx.fillText('DENUNCIAS', W - M, H - 170)
  ctx.font = '700 40px "Fira Sans Condensed"'; ctx.fillStyle = '#fff'
  ctx.fillText(SITIO.whatsappVisible, W - M, H - 120)
  ctx.font = '500 30px "Fira Sans Condensed"'; ctx.fillStyle = '#B9C8E6'
  ctx.fillText(SITIO.tiktokUsuario, W - M, H - 72)
  ctx.textAlign = 'left'

  return new Promise((ok) => c.toBlob((b) => ok(b!), 'image/png'))
}

export function BotonHistoria({ nota }: { nota: Nota }) {
  const [vista, setVista] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const dialogo = useRef<HTMLDialogElement>(null)
  const generar = async () => {
    setTrabajando(true)
    try {
      const b = await dibujarHistoria(nota)
      setBlob(b)
      setVista(URL.createObjectURL(b))
      dialogo.current?.showModal()
    } finally {
      setTrabajando(false)
    }
  }
  const archivo = `altiplano-${nota.slug.slice(0, 40)}.png`
  const compartir = async () => {
    if (!blob) return
    const f = new File([blob], archivo, { type: 'image/png' })
    if (navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f], title: nota.titular }) } catch { /* cancelado */ }
    }
  }
  return (
    <>
      <button className="btn-herramienta" onClick={generar} disabled={trabajando}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M10 18h4" /></svg>
        {trabajando ? 'Creando…' : 'Para historias'}
      </button>
      <dialog ref={dialogo} className="dialogo-historia" onClose={() => { if (vista) URL.revokeObjectURL(vista); setVista(null) }}>
        <div className="dialogo-historia__cab">
          <h2>Imagen para historias</h2>
          <button className="btn-icono" onClick={() => dialogo.current?.close()} aria-label="Cerrar">✕</button>
        </div>
        {vista && <img src={vista} alt={`Vista previa: ${nota.titular}`} />}
        <p>Formato 1080 × 1920, listo para TikTok, WhatsApp y Facebook.</p>
        <div className="dialogo-historia__acciones">
          {vista && <a className="btn btn--azul" href={vista} download={archivo}>Descargar PNG</a>}
          {'share' in navigator && <button className="btn btn--contorno" onClick={compartir}>Compartir</button>}
        </div>
      </dialog>
    </>
  )
}

/** Datos estructurados NewsArticle para buscadores. */
export function DatosEstructurados({ nota }: { nota: Nota }) {
  useEffect(() => {
    const s = document.createElement('script')
    s.type = 'application/ld+json'
    s.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: nota.titular,
      description: nota.bajada,
      datePublished: nota.fecha,
      articleSection: seccionPorTema(nota.tema).nombre,
      image: nota.imagen ? [new URL(pub(nota.imagen), location.origin).href] : undefined,
      author: { '@type': 'Organization', name: SITIO.nombre },
      publisher: { '@type': 'Organization', name: SITIO.nombre, logo: { '@type': 'ImageObject', url: new URL(pub('brand/png/logo-horizontal-600.png'), location.origin).href } },
      isBasedOn: nota.enlaces.map((e) => e.url),
    })
    document.head.appendChild(s)
    const desc = document.querySelector('meta[name="description"]')
    const previa = desc?.getAttribute('content')
    desc?.setAttribute('content', nota.bajada || nota.titular)
    return () => {
      s.remove()
      if (previa) desc?.setAttribute('content', previa)
    }
  }, [nota])
  return null
}

export function NotaVecina({ nota, tipo }: { nota?: Nota; tipo: 'anterior' | 'siguiente' }) {
  if (!nota) return <span />
  return (
    <Link to={`/nota/${nota.slug}`} className={`nota-vecina nota-vecina--${tipo}`}>
      <span className="nota-vecina__tipo">{tipo === 'anterior' ? '‹ Nota anterior' : 'Nota siguiente ›'}</span>
      <span className="nota-vecina__titular">{nota.titular}</span>
    </Link>
  )
}
