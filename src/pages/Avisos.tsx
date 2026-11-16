// Avisos que publica la gente: «Alerta Mascota» (perdidos, encontrados, maltrato, adopción), «Anuncios gratis»
// y el formulario de «Denuncia ciudadana». Todo va al servidor de Google Sheets (Apps Script):
//   · el aviso queda «pendiente» hasta que un editor lo aprueba en /admin;
//   · quien publica recibe un código con el que, sin cuenta, puede contar novedades o cerrar su aviso (/mi-aviso);
//   · la lista pública se pide en vivo, así un aviso aprobado sale en minutos.
// Mapas con OpenStreetMap (Leaflet), sin claves. Diseño de clasificados de diario: tipografía, filetes, sin adornos.
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Compartir } from '../components/Bloques'
import { IcoWhatsapp } from '../components/Iconos'
import { PROVINCIAS } from '../config/provincias'
import { SITIO, enlaceAnuncios, enlaceWhatsApp } from '../config/sitio'
import { useTitulo } from '../hooks/useTitulo'
import '../styles/avisos.css'

const API = (import.meta.env.VITE_SHEETS_API as string | undefined) ?? ''
const PUNO: [number, number] = [SITIO.lat, SITIO.lon]

type Seccion = 'mascotas' | 'anuncios' | 'denuncias'
interface Tipo { clave: string; nombre: string; plural: string; color: string }
interface Aviso {
  id: string
  creado: string
  estado: 'aprobado' | 'resuelto' | 'pendiente' | 'rechazado'
  etapa: 'activo' | 'archivo' | ''
  tipo: string
  provincia: string
  descripcion: string
  zona: string
  lat: number | null
  lng: number | null
  contacto: string
  autor: string
  foto: string
  enlace?: string
  novedades?: { texto: string; fecha: string; foto: string }[]
  desenlace?: string
  especie?: string
  nombre?: string
  fecha_hecho?: string
  titulo?: string
  precio?: string
}

export const TIPOS: Record<Seccion, Tipo[]> = {
  mascotas: [
    { clave: 'perdido', nombre: 'Se busca', plural: 'Se buscan', color: '#B71C1C' },
    { clave: 'encontrado', nombre: 'Encontrado', plural: 'Encontrados', color: '#2E6B30' },
    { clave: 'maltrato', nombre: 'Maltrato', plural: 'Maltrato', color: '#5B2A86' },
    { clave: 'adopcion', nombre: 'En adopción', plural: 'Adopción y ayuda', color: '#B45309' },
  ],
  anuncios: [
    { clave: 'empleo', nombre: 'Oferta de empleo', plural: 'Empleos', color: '#2E6B30' },
    { clave: 'busco_empleo', nombre: 'Busco empleo', plural: 'Busco empleo', color: '#4D7C0F' },
    { clave: 'venta', nombre: 'Vendo', plural: 'Vendo', color: '#043F9B' },
    { clave: 'compra', nombre: 'Compro', plural: 'Compro', color: '#9D174D' },
    { clave: 'alquiler', nombre: 'Alquilo', plural: 'Alquileres', color: '#0E7490' },
    { clave: 'servicios', nombre: 'Servicios', plural: 'Servicios', color: '#5B2A86' },
    { clave: 'eventos', nombre: 'Eventos', plural: 'Eventos', color: '#B45309' },
    { clave: 'otros', nombre: 'Otros', plural: 'Otros', color: '#4B5563' },
  ],
  denuncias: [
    { clave: 'servicios', nombre: 'Agua, luz y pistas', plural: '', color: '#043F9B' },
    { clave: 'seguridad', nombre: 'Seguridad', plural: '', color: '#B71C1C' },
    { clave: 'corrupcion', nombre: 'Corrupción', plural: '', color: '#5B2A86' },
    { clave: 'salud', nombre: 'Salud', plural: '', color: '#0E7490' },
    { clave: 'educacion', nombre: 'Educación', plural: '', color: '#B45309' },
    { clave: 'ambiente', nombre: 'Medio ambiente', plural: '', color: '#2E6B30' },
    { clave: 'transporte', nombre: 'Transporte', plural: '', color: '#4B5563' },
    { clave: 'otro', nombre: 'Otro tema', plural: '', color: '#374151' },
  ],
}
// Cómo puede terminar un aviso (lo elige quien lo publicó al cerrarlo).
const DESENLACES: Record<string, string[]> = {
  perdido: ['Volvió a casa', 'Lo encontramos', 'Ya no lo buscamos'],
  encontrado: ['Encontramos a su familia', 'Se quedó en un hogar', 'Lo llevamos a un albergue'],
  adopcion: ['Fue adoptado', 'Ya recibió la ayuda', 'Ya no está disponible'],
  maltrato: ['Se resolvió', 'Intervinieron las autoridades', 'Ya no sigue pasando'],
  empleo: ['El puesto ya se cubrió', 'Ya no está disponible'],
  busco_empleo: ['Ya conseguí trabajo', 'Ya no busco'],
  venta: ['Vendido', 'Ya no está a la venta'],
  compra: ['Ya lo conseguí', 'Ya no lo busco'],
  alquiler: ['Alquilado', 'Ya no está disponible'],
  servicios: ['Ya no ofrezco el servicio'],
  eventos: ['El evento ya pasó', 'Se suspendió'],
  otros: ['Resuelto', 'Ya no está disponible'],
}
const ESPECIES = [{ clave: 'perro', nombre: 'Perro' }, { clave: 'gato', nombre: 'Gato' }, { clave: 'otro', nombre: 'Otro' }]
export const tipoDe = (s: Seccion, clave: string) => TIPOS[s].find((t) => t.clave === clave) ?? TIPOS[s][TIPOS[s].length - 1]
export const fotoDrive = (id: string, ancho = 800) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${ancho}`
const OPCIONES_PROVINCIA = [...PROVINCIAS.map((x) => ({ clave: x.clave, nombre: x.clave === 'san-roman' ? 'San Román (Juliaca)' : x.nombre })), { clave: 'otra', nombre: 'Otra región' }]
export const nombreProvincia = (c: string) => PROVINCIAS.find((x) => x.clave === c)?.nombre ?? ''
const celularVisible = (c: string) => c.replace(/^51/, '').replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')
const fechaCorta = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' }).replace('.', '')
}
const NOMBRE_SECCION: Record<Seccion, string> = { mascotas: 'Alerta Mascota', anuncios: 'Anuncios gratis', denuncias: 'Denuncia ciudadana' }
const RUTA_SECCION: Record<Seccion, string> = { mascotas: '/alerta-mascota', anuncios: '/anuncios', denuncias: '/denuncia' }

function tituloDe(seccion: Seccion, a: Aviso) {
  if (seccion !== 'mascotas') return a.titulo || tipoDe(seccion, a.tipo).nombre
  const animal = a.especie === 'gato' ? 'gato' : a.especie === 'perro' ? 'perro' : 'animal'
  if (a.tipo === 'perdido') {
    const verbo = a.estado === 'resuelto' ? 'Se buscaba' : 'Se busca'
    return a.nombre ? `${verbo} a ${a.nombre}` : `${verbo} ${animal}`
  }
  if (a.tipo === 'encontrado') return a.nombre ? `${a.nombre}, encontrado` : `${animal[0].toUpperCase() + animal.slice(1)} encontrado`
  if (a.tipo === 'adopcion') return a.nombre ? `${a.nombre} busca hogar` : `${animal[0].toUpperCase() + animal.slice(1)} en adopción`
  return `Denuncia de maltrato animal`
}

async function llamar<T>(accion: string, datos: Record<string, unknown>): Promise<T> {
  const r = await fetch(API, { method: 'POST', body: JSON.stringify({ accion, ...datos }) })
  const j = await r.json().catch(() => ({ ok: false, error: 'Respuesta inválida del servidor.' }))
  if (!j.ok) throw new Error(j.error || 'No se pudo completar.')
  return j as T
}

// ------------------------------------------------------------------ iconos de línea (sin emojis)
const Svg = ({ children, size = 16 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
const IcoPin = () => <Svg size={14}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></Svg>
const IcoHuella = () => (
  <svg viewBox="0 0 64 64" width="56" height="56" fill="currentColor" aria-hidden="true">
    <ellipse cx="32" cy="42" rx="12" ry="10" /><ellipse cx="17" cy="27" rx="5" ry="7" /><ellipse cx="27" cy="18" rx="5" ry="7" />
    <ellipse cx="37" cy="18" rx="5" ry="7" /><ellipse cx="47" cy="27" rx="5" ry="7" />
  </svg>
)

// ------------------------------------------------------------------ datos
function useAvisos(seccion: Seccion) {
  const [avisos, setAvisos] = useState<Aviso[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!API) return
    let vivo = true
    fetch(`${API}?accion=avisos&seccion=${seccion}`)
      .then((r) => r.json())
      .then((j) => {
        if (!vivo) return
        if (j.ok) setAvisos(j.avisos as Aviso[])
        else setError(j.error || 'No se pudieron cargar los avisos.')
      })
      .catch(() => vivo && setError('No se pudieron cargar los avisos. Revisa tu conexión.'))
    return () => { vivo = false }
  }, [seccion])
  return { avisos, error }
}

/** Foto del celular → JPEG de hasta 1280 px (pesa poco y sube rápido). */
async function comprimir(archivo: File): Promise<{ b64: string; tipo: string; vista: string }> {
  const url = URL.createObjectURL(archivo)
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => mal(new Error('No se pudo leer la foto.'))
      i.src = url
    })
    const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * k)
    c.height = Math.round(img.naturalHeight * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    const vista = c.toDataURL('image/jpeg', 0.82)
    return { b64: vista.split(',')[1], tipo: 'image/jpeg', vista }
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ------------------------------------------------------------------ mapa (OpenStreetMap)
interface Punto { id: string; lat: number; lng: number; color: string; texto: string }

export function Mapa({ puntos, elegido, alElegir, alto = 340, alTocarPunto, zoomMax = 15 }: {
  puntos?: Punto[]
  elegido?: [number, number] | null
  alElegir?: (p: [number, number]) => void
  alto?: number
  alTocarPunto?: (id: string) => void
  zoomMax?: number
}) {
  const caja = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const capa = useRef<L.LayerGroup | null>(null)
  const marca = useRef<L.CircleMarker | null>(null)
  const elegir = useRef(alElegir)
  elegir.current = alElegir
  const tocar = useRef(alTocarPunto)
  tocar.current = alTocarPunto

  useEffect(() => {
    if (!caja.current || mapa.current) return
    const m = L.map(caja.current, { scrollWheelZoom: false }).setView(PUNO, 13)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    capa.current = L.layerGroup().addTo(m)
    m.on('click', (e: L.LeafletMouseEvent) => elegir.current?.([e.latlng.lat, e.latlng.lng]))
    mapa.current = m
    return () => { m.remove(); mapa.current = null }
  }, [])

  useEffect(() => {
    const m = mapa.current
    if (!m || !capa.current) return
    capa.current.clearLayers()
    const ps = puntos ?? []
    ps.forEach((p) => {
      L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 2, fillColor: p.color, fillOpacity: 1 })
        .bindTooltip(p.texto, { direction: 'top', offset: [0, -6] })
        .on('click', () => tocar.current?.(p.id))
        .addTo(capa.current!)
    })
    if (ps.length > 1) m.fitBounds(L.latLngBounds(ps.map((p) => [p.lat, p.lng] as [number, number])).pad(0.25), { maxZoom: zoomMax })
    else if (ps.length === 1) m.setView([ps[0].lat, ps[0].lng], zoomMax)
  }, [puntos, zoomMax])

  useEffect(() => {
    const m = mapa.current
    if (!m) return
    marca.current?.remove()
    marca.current = null
    if (elegido) {
      marca.current = L.circleMarker(elegido, { radius: 10, color: '#fff', weight: 3, fillColor: '#B71C1C', fillOpacity: 1 }).addTo(m)
      if (!m.getBounds().pad(-0.1).contains(elegido)) m.setView(elegido, Math.max(m.getZoom(), 15))
    }
  }, [elegido])

  return <div ref={caja} className="av-mapa" style={{ height: alto }} role="application" aria-label="Mapa de OpenStreetMap" />
}

// ------------------------------------------------------------------ ver la foto en grande
export function Ampliar({ src, alt, alCerrar }: { src: string; alt: string; alCerrar: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') alCerrar() }
    document.addEventListener('keydown', tecla)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', tecla); document.body.style.overflow = antes }
  }, [alCerrar])
  return (
    <div className="av-ampliar" role="dialog" aria-modal="true" aria-label={alt} onClick={alCerrar}>
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
      <button type="button" className="av-ampliar__cerrar" onClick={alCerrar} aria-label="Cerrar">×</button>
    </div>
  )
}

// ------------------------------------------------------------------ código para gestionar el aviso
function CodigoGestion({ seccion, id, clave }: { seccion: Seccion; id: string; clave: string }) {
  const [copiado, setCopiado] = useState(false)
  const enlace = `${location.origin}/mi-aviso?s=${seccion}&id=${encodeURIComponent(id)}&c=${encodeURIComponent(clave)}`
  const texto = `Mi ${seccion === 'denuncias' ? 'denuncia' : 'aviso'} en Altiplano al Día\nNúmero: ${id}\nCódigo: ${clave}\nPara verlo o cerrarlo: ${enlace}`
  return (
    <div className="av-codigo">
      <p className="av-codigo__titulo">Guarda estos datos</p>
      <p className="av-codigo__texto">
        {seccion === 'denuncias'
          ? 'Con ellos puedes ver en qué va tu denuncia y agregar información nueva.'
          : 'Con ellos puedes contar novedades o cerrar tu aviso cuando ya no haga falta (por ejemplo, si tu mascota volvió a casa). No hace falta crear una cuenta.'}
      </p>
      <dl className="av-codigo__datos">
        <div><dt>Número</dt><dd>{id}</dd></div>
        <div><dt>Código</dt><dd>{clave}</dd></div>
      </dl>
      <div className="av-acciones">
        <a className="av-boton av-boton--wa" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">
          <IcoWhatsapp size={16} /> Guardarlo en mi WhatsApp
        </a>
        <button type="button" className="av-boton" onClick={() => { navigator.clipboard?.writeText(texto).then(() => setCopiado(true)).catch(() => undefined) }}>
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ formulario
const VACIO = { tipo: '', enlace: '', provincia: '', especie: 'perro', nombre: '', titulo: '', precio: '', descripcion: '', zona: '', fecha_hecho: '', contacto: '', autor: '', web: '' }

function Campo({ etiqueta, nota, children, ancho }: { etiqueta: string; nota?: string; children: ReactNode; ancho?: boolean }) {
  return (
    <label className={`av-campo${ancho ? ' av-campo--ancho' : ''}`}>
      <span className="av-campo__etq">{etiqueta}{nota && <em> — {nota}</em>}</span>
      {children}
    </label>
  )
}

function Formulario({ seccion, alCerrar }: { seccion: Seccion; alCerrar: () => void }) {
  const [f, setF] = useState({ ...VACIO, tipo: TIPOS[seccion][0].clave })
  const [punto, setPunto] = useState<[number, number] | null>(null)
  const [foto, setFoto] = useState<{ b64: string; tipo: string; vista: string } | null>(null)
  const [acepto, setAcepto] = useState(false)
  const [estado, setEstado] = useState<'' | 'enviando'>('')
  const [listo, setListo] = useState<{ id: string; clave: string } | null>(null)
  const [error, setError] = useState('')
  const [buscando, setBuscando] = useState(false)
  const set = (k: keyof typeof VACIO) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const mascotas = seccion === 'mascotas'
  const denuncia = seccion === 'denuncias'
  const reservado = (mascotas && f.tipo === 'maltrato') || denuncia        // el número no se publica
  const empleo = f.tipo === 'empleo' || f.tipo === 'busco_empleo'

  const ubicarme = () => {
    if (!navigator.geolocation) return setError('Tu navegador no permite ubicarte. Toca el mapa para marcar el lugar.')
    navigator.geolocation.getCurrentPosition(
      (p) => setPunto([p.coords.latitude, p.coords.longitude]),
      () => setError('No pudimos ubicarte. Toca el mapa para marcar el lugar.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }
  // Busca la zona escrita en OpenStreetMap (Nominatim), solo cuando la persona lo pide.
  const buscarZona = async () => {
    if (f.zona.trim().length < 3) return
    setBuscando(true)
    try {
      const q = encodeURIComponent(`${f.zona}, ${nombreProvincia(f.provincia) || 'Puno'}, Perú`)
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=pe&q=${q}`)
      const j = await r.json()
      if (j[0]) setPunto([Number(j[0].lat), Number(j[0].lon)])
      else setError('No encontramos esa zona en el mapa. Toca el mapa para marcarla.')
    } catch {
      setError('No se pudo buscar la zona. Toca el mapa para marcarla.')
    } finally {
      setBuscando(false)
    }
  }
  const elegirFoto = async (archivo?: File) => {
    setError('')
    if (!archivo) return setFoto(null)
    try {
      setFoto(await comprimir(archivo))
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!f.provincia) return setError('Elige la provincia.')
    if (!acepto) return setError('Marca la casilla de aceptación para enviar.')
    setEstado('enviando')
    try {
      const datos = { ...f, lat: punto?.[0] ?? '', lng: punto?.[1] ?? '' }
      const r = await llamar<{ id: string; clave: string }>('enviar_aviso', { seccion, datos, foto: foto ? { b64: foto.b64, tipo: foto.tipo } : null })
      setListo({ id: r.id, clave: r.clave })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (x) {
      setError((x as Error).message || 'No se pudo enviar. Revisa tu conexión.')
    } finally {
      setEstado('')
    }
  }

  if (listo) {
    return (
      <div className="av-listo" role="status">
        <p className="av-listo__titulo">{denuncia ? 'Recibimos tu denuncia' : 'Recibimos tu aviso'}</p>
        <p>{denuncia
          ? 'La redacción la revisa y la verifica. Si dejaste tu número, podemos escribirte para pedirte más detalles.'
          : 'La redacción lo revisa y lo publica en esta página, normalmente en pocas horas.'}</p>
        <CodigoGestion seccion={seccion} id={listo.id} clave={listo.clave} />
        <div className="av-acciones">
          <button type="button" className="av-boton" onClick={alCerrar}>{denuncia ? 'Listo' : 'Volver a los avisos'}</button>
        </div>
      </div>
    )
  }

  return (
    <form className="av-form" onSubmit={enviar} noValidate={false}>
      <fieldset className="av-tipos">
        <legend className="av-campo__etq">{denuncia ? '¿Sobre qué es tu denuncia?' : '¿Qué quieres publicar?'}</legend>
        <div className="av-tipos__lista">
          {TIPOS[seccion].map((t) => (
            <label key={t.clave} className={`av-tipo${f.tipo === t.clave ? ' av-tipo--activo' : ''}`} style={{ '--tipo': t.color } as CSSProperties}>
              <input type="radio" name="tipo" value={t.clave} checked={f.tipo === t.clave} onChange={set('tipo')} />
              {t.nombre}
            </label>
          ))}
        </div>
      </fieldset>

      {denuncia && (
        <p className="av-aviso">
          Tu denuncia llega solo a la redacción y <strong>no se publica tal cual</strong>: la verificamos y, si corresponde,
          hacemos una nota. Puedes enviarla <strong>sin tu número</strong>. No escribas nombres de vecinos ni datos de menores.
        </p>
      )}
      {mascotas && f.tipo === 'maltrato' && (
        <p className="av-aviso">
          Cuéntanos qué viste, dónde y desde cuándo. <strong>Tu número no se publica</strong>: solo lo ve la redacción.
          No escribas nombres de personas ni subas fotos con sangre o heridas. Si el animal está en peligro ahora, llama a la Policía (105).
        </p>
      )}

      {mascotas && f.tipo !== 'maltrato' && (
        <div className="av-fila">
          <Campo etiqueta="Animal">
            <select value={f.especie} onChange={set('especie')}>{ESPECIES.map((s) => <option key={s.clave} value={s.clave}>{s.nombre}</option>)}</select>
          </Campo>
          <Campo etiqueta="Nombre" nota="si tiene">
            <input value={f.nombre} onChange={set('nombre')} maxLength={60} />
          </Campo>
          <Campo etiqueta={f.tipo === 'encontrado' ? 'Fecha en que lo encontraste' : f.tipo === 'perdido' ? 'Fecha en que se perdió' : 'Fecha'}>
            <input type="date" value={f.fecha_hecho} onChange={set('fecha_hecho')} max={new Date().toISOString().slice(0, 10)} />
          </Campo>
        </div>
      )}
      {seccion === 'anuncios' && (
        <div className="av-fila">
          <Campo etiqueta="Título" ancho>
            <input required minLength={4} maxLength={90} value={f.titulo} onChange={set('titulo')}
              placeholder={f.tipo === 'compra' ? 'Compro refrigeradora usada' : f.tipo === 'empleo' ? 'Se necesita ayudante de cocina' : f.tipo === 'busco_empleo' ? 'Busco trabajo de mesero' : 'Alquilo cuarto amoblado en Juliaca'} />
          </Campo>
          <Campo etiqueta={empleo ? 'Sueldo' : 'Precio'} nota="opcional">
            <input value={f.precio} onChange={set('precio')} maxLength={40} placeholder={empleo ? 'S/ 1 200 al mes' : 'S/ 350'} />
          </Campo>
        </div>
      )}

      <Campo etiqueta={denuncia ? 'Qué está pasando' : 'Descripción'}>
        <textarea required minLength={15} maxLength={1200} rows={5} value={f.descripcion} onChange={set('descripcion')}
          placeholder={mascotas
            ? (f.tipo === 'maltrato' ? 'Qué viste, desde cuándo pasa, cómo está el animal.' : 'Color, tamaño, collar, señas particulares, cómo se perdió o dónde lo encontraste.')
            : denuncia ? 'Qué pasa, desde cuándo, a quién afecta y dónde exactamente.'
            : f.tipo === 'empleo' ? 'Puesto, requisitos, horario, lugar de trabajo y cómo postular.'
            : f.tipo === 'busco_empleo' ? 'Qué sabes hacer, tu experiencia y tu horario disponible.'
            : f.tipo === 'compra' ? 'Qué buscas, en qué estado y cuánto puedes pagar.' : 'Qué ofreces, en qué estado, condiciones y horario.'} />
      </Campo>

      <div className="av-fila">
        <Campo etiqueta="Provincia">
          <select required value={f.provincia} onChange={set('provincia')}>
            <option value="" disabled>Elige…</option>
            {OPCIONES_PROVINCIA.map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Zona, barrio o referencia" ancho>
          <span className="av-zona">
            <input required minLength={3} maxLength={150} value={f.zona} onChange={set('zona')} placeholder="Barrio Bellavista, cerca del mercado" />
            <button type="button" className="av-boton" onClick={buscarZona} disabled={buscando}>{buscando ? 'Buscando…' : 'Ubicar en el mapa'}</button>
          </span>
        </Campo>
      </div>
      <div className="av-mapa-campo">
        <p className="av-ayuda">
          {punto ? 'Lugar marcado. Puedes moverlo tocando otro punto.' : 'Toca el mapa para marcar el lugar (opcional, ayuda mucho).'}{' '}
          <button type="button" className="av-enlace" onClick={ubicarme}>Usar mi ubicación</button>
          {punto && <> · <button type="button" className="av-enlace" onClick={() => setPunto(null)}>Quitar</button></>}
        </p>
        <Mapa elegido={punto} alElegir={setPunto} alto={260} />
      </div>

      <div className="av-fila">
        <Campo etiqueta="Foto" nota={denuncia ? 'opcional' : 'recomendada'}>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => elegirFoto(e.target.files?.[0])} />
        </Campo>
        {f.tipo !== 'maltrato' && (
          <Campo etiqueta={denuncia ? 'Enlace de Facebook o video' : 'Enlace de Facebook'} nota="opcional">
            <input type="url" inputMode="url" value={f.enlace} onChange={set('enlace')} maxLength={400}
              placeholder="https://www.facebook.com/…" pattern="https://(www\.|m\.|web\.)?(facebook\.com|fb\.com|fb\.watch)/.+" />
          </Campo>
        )}
      </div>
      {foto && <img className="av-vista" src={foto.vista} alt="Vista previa de la foto" />}

      <div className="av-fila">
        <Campo etiqueta="Celular o WhatsApp" nota={denuncia ? 'opcional, no se publica' : reservado ? 'no se publica' : 'se muestra en el aviso'}>
          <input required={!denuncia} inputMode="tel" autoComplete="tel" value={f.contacto} onChange={set('contacto')} placeholder="9__ ___ ___" />
        </Campo>
        {!reservado && (
          <Campo etiqueta="Tu nombre" nota="opcional">
            <input value={f.autor} onChange={set('autor')} maxLength={60} autoComplete="given-name" />
          </Campo>
        )}
      </div>
      {/* Trampa para robots: las personas no ven este campo. */}
      <label className="av-trampa" aria-hidden="true">Web<input tabIndex={-1} autoComplete="off" value={f.web} onChange={set('web')} /></label>

      <label className="av-acepto">
        <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
        <span>
          {denuncia
            ? 'Acepto que la redacción guarde mi denuncia para verificarla. Si dejo mi número, no se publica y se borra cuando se cierra el caso.'
            : reservado
            ? 'Acepto que la redacción guarde mi número para verificar la denuncia. No se publica y se borra 30 días después de cerrado el caso.'
            : 'Acepto que se publique mi número mientras el aviso esté vigente. Cuando se cierra o pasan dos meses, el número deja de mostrarse y luego se borra.'}
        </span>
      </label>
      {error && <p className="av-error" role="alert">{error}</p>}
      <div className="av-acciones">
        <button type="submit" className="av-boton av-boton--principal" disabled={estado === 'enviando'}>
          {estado === 'enviando' ? 'Enviando…' : denuncia ? 'Enviar denuncia' : 'Enviar para revisión'}
        </button>
        {!denuncia && <button type="button" className="av-boton av-boton--simple" onClick={alCerrar}>Cancelar</button>}
      </div>
    </form>
  )
}

// ------------------------------------------------------------------ ficha de un aviso
/** Publicación lista para compartir, al estilo de las notas: hashtags | resumen + enlace. */
function textoAviso(seccion: Seccion, a: Aviso, titulo: string, url: string) {
  const etiqueta = (t: string) => '#' + t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '')
    .split(' ').filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join('')
  const tags = ['#AltiplanoAlDía', etiqueta(seccion === 'mascotas' ? 'Alerta Mascota' : 'Anuncios Puno')]
  const prov = nombreProvincia(a.provincia)
  if (prov) tags.push(etiqueta(prov))
  const resumen = a.descripcion.length > 160 ? a.descripcion.slice(0, 157).replace(/\s+\S*$/, '') + '…' : a.descripcion
  const pedido = seccion === 'mascotas' && a.tipo === 'perdido' && a.estado !== 'resuelto' ? ' ¡Ayúdanos a encontrarlo, comparte!' : ''
  return `${tags.join(' ')} | ${titulo} (${a.zona}). ${resumen}${pedido}\n➡️ Mira el aviso aquí: ${url}`
}

// ------------------------------------------------------------------ aviso completo en ventana flotante
const MOTIVOS_REPORTE = [
  'Ya fue encontrado o ya se resolvió',
  'Los datos son falsos o engañosos',
  'El número no corresponde',
  'Contenido inapropiado',
  'Otro motivo',
]

function DetalleAviso({ seccion, a, alCerrar }: { seccion: Seccion; a: Aviso; alCerrar: () => void }) {
  const t = tipoDe(seccion, a.tipo)
  const titulo = tituloDe(seccion, a)
  const archivo = a.etapa === 'archivo'
  const cerrado = a.estado === 'resuelto'
  const prov = a.provincia && a.provincia !== 'otra' ? nombreProvincia(a.provincia) : ''
  const lugar = prov && !a.zona.toLowerCase().includes(prov.toLowerCase()) ? `${a.zona}, ${prov}` : a.zona
  const url = `${location.origin}${RUTA_SECCION[seccion]}#aviso-${a.id}`
  const [grande, setGrande] = useState('')
  const [conFoto, setConFoto] = useState(!!a.foto)
  const [reporte, setReporte] = useState(false)
  const [motivo, setMotivo] = useState('')
  const caja = useRef<HTMLDivElement>(null)
  const puntos = useMemo<Punto[]>(() => (a.lat != null && a.lng != null
    ? [{ id: a.id, lat: a.lat, lng: a.lng, color: t.color, texto: titulo }] : []), [a, t.color, titulo])

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && !grande) alCerrar() }
    document.addEventListener('keydown', tecla)
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    caja.current?.focus()
    return () => { document.removeEventListener('keydown', tecla); document.body.style.overflow = antes }
  }, [alCerrar, grande])

  const pedido = seccion === 'mascotas'
    ? (a.tipo === 'perdido' ? `Hola, tengo información sobre ${a.nombre || 'tu mascota'} (aviso «${titulo}» en Altiplano al Día): `
      : `Hola, vi tu aviso «${titulo}» en Altiplano al Día y quisiera más información.`)
    : `Hola, vi tu anuncio «${titulo}» en Altiplano al Día.`
  const textoReporte = `Hola Altiplano al Día, quiero reportar el aviso ${a.id} («${titulo}», ${NOMBRE_SECCION[seccion]}).\nMotivo: ${motivo}\nDetalle: `

  return (
    <div className="av-modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={alCerrar}>
      <div className="av-modal__caja" ref={caja} tabIndex={-1} onClick={(e) => e.stopPropagation()} style={{ '--tipo': t.color } as CSSProperties}>
        <button type="button" className="av-modal__cerrar" onClick={alCerrar} aria-label="Cerrar">×</button>
        <div className="av-modal__grid">
          <div className="av-modal__foto">
            {conFoto ? (
              <button type="button" className="av-ficha__ver" onClick={() => setGrande(fotoDrive(a.foto, 2000))} aria-label="Ver la foto en tamaño completo">
                <img src={fotoDrive(a.foto, 1200)} alt={titulo} onError={() => setConFoto(false)} />
              </button>
            ) : <div className="av-ficha__sinfoto">{seccion === 'mascotas' ? <IcoHuella /> : <span>{t.nombre}</span>}</div>}
            {conFoto && <p className="av-ayuda av-modal__pista">Toca la foto para verla completa.</p>}
            {cerrado && <span className="av-ficha__sello">{seccion === 'mascotas' && a.tipo === 'perdido' ? 'Volvió a casa' : 'Cerrado'}</span>}
          </div>
          <div className="av-modal__info">
            <p className="av-ficha__ante"><span className="av-ficha__tipo">{t.nombre}</span><span className="av-ficha__fecha">{fechaCorta(a.fecha_hecho || a.creado)}</span></p>
            <h2 className="av-modal__titulo">{titulo}</h2>
            <p className="av-ficha__lugar"><IcoPin /><span>{lugar}</span>{a.precio ? <strong className="av-ficha__precio">{a.precio}</strong> : null}</p>
            <p className="av-modal__texto">{a.descripcion}</p>
            {!!a.novedades?.length && (
              <ol className="av-novedades" aria-label="Novedades">
                {a.novedades.map((n, i) => (
                  <li key={i} className="av-ficha__novedad">
                    <b>Novedad, {fechaCorta(n.fecha)}:</b> {n.texto}
                    {n.foto && (
                      <button type="button" className="av-novedad__foto" onClick={() => setGrande(fotoDrive(n.foto, 2000))} aria-label="Ver la foto de la novedad">
                        <img src={fotoDrive(n.foto, 600)} alt="Foto de la novedad" loading="lazy" onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none' }} />
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {a.desenlace && cerrado && <p className="av-ficha__desenlace"><b>Cómo terminó:</b> {a.desenlace}</p>}

            {!archivo && (a.contacto || a.enlace) && (
              <div className="av-modal__acciones">
                {a.contacto && (
                  <a className="av-boton av-boton--principal" href={`https://wa.me/${a.contacto}?text=${encodeURIComponent(pedido)}`} target="_blank" rel="noopener noreferrer">
                    <IcoWhatsapp size={17} /> {seccion === 'mascotas' && a.tipo === 'perdido' ? 'Tengo información' : 'Escribir por WhatsApp'}
                  </a>
                )}
                {a.contacto && <span className="av-modal__numero">{celularVisible(a.contacto)}{a.autor ? ` · ${a.autor}` : ''}</span>}
                {a.enlace && <a className="av-enlace" href={a.enlace} target="_blank" rel="noopener noreferrer nofollow">Ver la publicación en Facebook</a>}
              </div>
            )}
            {archivo && <p className="av-ayuda">Aviso archivado: ya no se muestran los datos de contacto.</p>}

            {puntos.length > 0 && (
              <figure className="av-modal__mapa">
                <Mapa puntos={puntos} alto={200} zoomMax={archivo ? 13 : 16} />
                <figcaption>Ubicación referencial{archivo ? ' aproximada' : ''}.</figcaption>
              </figure>
            )}

            <div className="av-ficha__compartir">
              <span>Compartir</span>
              <Compartir url={url} titulo={titulo} texto={textoAviso(seccion, a, titulo, url)} />
            </div>

            <div className="av-modal__reporte">
              {!reporte ? (
                <button type="button" className="av-enlace av-enlace--suave" onClick={() => setReporte(true)}>Reportar este aviso</button>
              ) : (
                <div className="av-reporte">
                  <p className="av-campo__etq">¿Qué pasa con este aviso?</p>
                  <div className="av-opciones">
                    {MOTIVOS_REPORTE.map((m) => (
                      <label key={m} className={`av-opcion${motivo === m ? ' av-opcion--activa' : ''}`}>
                        <input type="radio" name="motivo-reporte" checked={motivo === m} onChange={() => setMotivo(m)} /> {m}
                      </label>
                    ))}
                  </div>
                  <div className="av-acciones">
                    <a className={`av-boton${motivo ? '' : ' av-boton--inactivo'}`} aria-disabled={!motivo}
                      href={motivo ? enlaceWhatsApp(textoReporte) : undefined} target="_blank" rel="noopener noreferrer"
                      onClick={(e) => { if (!motivo) e.preventDefault() }}>
                      <IcoWhatsapp size={15} /> Enviar a la redacción
                    </a>
                    <button type="button" className="av-boton av-boton--simple" onClick={() => { setReporte(false); setMotivo('') }}>Cancelar</button>
                  </div>
                  <p className="av-ayuda">El reporte llega a la redacción de Altiplano al Día, que revisa el aviso.</p>
                </div>
              )}
              <p className="av-ayuda">Aviso N.° {a.id} · <Link className="av-enlace av-enlace--suave" to={`/mi-aviso?s=${seccion}&id=${encodeURIComponent(a.id)}`}>¿Es tu aviso? Actualízalo o ciérralo</Link></p>
            </div>
          </div>
        </div>
      </div>
      {grande && <Ampliar src={grande} alt={titulo} alCerrar={() => setGrande('')} />}
    </div>
  )
}

function Ficha({ seccion, a, resaltado, alAbrir }: { seccion: Seccion; a: Aviso; resaltado: boolean; alAbrir?: () => void }) {
  const t = tipoDe(seccion, a.tipo)
  const [conFoto, setConFoto] = useState(!!a.foto)
  const [grande, setGrande] = useState('')
  const titulo = tituloDe(seccion, a)
  const archivo = a.etapa === 'archivo'
  const prov = a.provincia && a.provincia !== 'otra' ? nombreProvincia(a.provincia) : ''
  const lugar = prov && !a.zona.toLowerCase().includes(prov.toLowerCase()) ? `${a.zona}, ${prov}` : a.zona
  const cerrado = a.estado === 'resuelto'
  const url = `${location.origin}${RUTA_SECCION[seccion]}#aviso-${a.id}`
  return (
    <article id={`aviso-${a.id}`} className={`av-ficha${resaltado ? ' av-ficha--resaltada' : ''}${archivo ? ' av-ficha--archivo' : ''}`} style={{ '--tipo': t.color } as CSSProperties}>
      <div className={`av-ficha__foto${conFoto ? "" : " av-ficha__foto--sin"}${seccion === "mascotas" ? "" : " av-ficha__foto--texto"}`}>
        {conFoto
          ? (
            <button type="button" className="av-ficha__ver" onClick={() => (alAbrir ? alAbrir() : setGrande(fotoDrive(a.foto, 1600)))} aria-label={alAbrir ? `Ver el aviso completo: ${titulo}` : `Ver la foto de ${titulo} en grande`}>
              <img src={fotoDrive(a.foto)} alt={titulo} loading="lazy" onError={() => setConFoto(false)} />
            </button>
          )
          : <div className="av-ficha__sinfoto">{seccion === 'mascotas' ? <IcoHuella /> : <span>{t.nombre}</span>}</div>}
        {grande && <Ampliar src={grande} alt={titulo} alCerrar={() => setGrande('')} />}
        {cerrado && <span className="av-ficha__sello">{seccion === 'mascotas' && a.tipo === 'perdido' ? 'Volvió a casa' : 'Cerrado'}</span>}
      </div>
      <div className="av-ficha__cuerpo">
        <p className="av-ficha__ante"><span className="av-ficha__tipo">{t.nombre}</span><span className="av-ficha__fecha">{fechaCorta(a.fecha_hecho || a.creado)}</span></p>
        <h3 className="av-ficha__titulo">{alAbrir ? <button type="button" className="av-ficha__abrir" onClick={alAbrir}>{titulo}</button> : titulo}</h3>
        <p className="av-ficha__lugar"><IcoPin /><span>{lugar}</span>{a.precio ? <strong className="av-ficha__precio">{a.precio}</strong> : null}</p>
        <p className={`av-ficha__texto${alAbrir ? ' av-ficha__texto--corto' : ''}`}>{a.descripcion}</p>
        {alAbrir && <button type="button" className="av-enlace av-ficha__mas" onClick={alAbrir}>Ver aviso completo</button>}
        {!!a.novedades?.length && (
          <ol className="av-novedades" aria-label="Novedades">
            {a.novedades.map((n, i) => (
              <li key={i} className="av-ficha__novedad">
                <b>Novedad, {fechaCorta(n.fecha)}:</b> {n.texto}
                {n.foto && (
                  <button type="button" className="av-novedad__foto" onClick={() => setGrande(fotoDrive(n.foto, 1600))} aria-label="Ver la foto de la novedad en grande">
                    <img src={fotoDrive(n.foto, 400)} alt="Foto de la novedad" loading="lazy" onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none' }} />
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
        {a.desenlace && cerrado && <p className="av-ficha__desenlace"><b>Cómo terminó:</b> {a.desenlace}</p>}
        {!archivo && (
          <div className="av-ficha__pie">
            {a.contacto && (
              <a className="av-boton av-boton--wa" href={`https://wa.me/${a.contacto}?text=${encodeURIComponent(`Hola, vi tu aviso «${titulo}» en Altiplano al Día.`)}`} target="_blank" rel="noopener noreferrer">
                <IcoWhatsapp size={15} /> {celularVisible(a.contacto)}{a.autor ? ` · ${a.autor}` : ''}
              </a>
            )}
            {a.enlace && <a className="av-enlace" href={a.enlace} target="_blank" rel="noopener noreferrer nofollow">Ver en Facebook</a>}
          </div>
        )}
        {a.estado !== 'pendiente' && (
          <div className="av-ficha__compartir">
            <span>Compartir</span>
            <Compartir url={url} titulo={titulo} texto={textoAviso(seccion, a, titulo, url)} />
          </div>
        )}
      </div>
    </article>
  )
}

// ------------------------------------------------------------------ página de lista
function PaginaAvisos({ seccion, titulo, antetitulo, entrada, boton }: { seccion: Seccion; titulo: string; antetitulo: string; entrada: string; boton: string }) {
  useTitulo(titulo)
  const { avisos, error } = useAvisos(seccion)
  const [filtro, setFiltro] = useState('')
  const [donde, setDonde] = useState('')
  const [vista, setVista] = useState<'activo' | 'archivo'>('activo')
  const [form, setForm] = useState(false)
  const [resaltado, setResaltado] = useState('')
  const [abierto, setAbierto] = useState<Aviso | null>(null)
  const abrir = (a: Aviso | null) => {
    setAbierto(a)
    history.replaceState(null, '', a ? `#aviso-${a.id}` : location.pathname + location.search)
  }
  const enVista = useMemo(() => (avisos ?? []).filter((a) => (a.etapa || 'activo') === vista && (!donde || a.provincia === donde)), [avisos, vista, donde])
  const lista = useMemo(() => enVista.filter((a) => !filtro || a.tipo === filtro), [enVista, filtro])
  const cuenta = (clave: string) => enVista.filter((a) => a.tipo === clave).length
  const enArchivo = (avisos ?? []).filter((a) => a.etapa === 'archivo').length
  const puntos = useMemo<Punto[]>(
    () => lista.filter((a) => a.lat != null && a.lng != null).map((a) => ({
      id: a.id, lat: a.lat!, lng: a.lng!, color: tipoDe(seccion, a.tipo).color, texto: tituloDe(seccion, a),
    })),
    [lista, seccion],
  )
  const irA = (id: string) => {
    setResaltado(id)
    document.getElementById(`aviso-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  // Si llegan con #aviso-… (enlace compartido), se resalta ese aviso.
  useEffect(() => {
    const m = location.hash.match(/^#aviso-(.+)$/)
    const a = m && avisos?.find((x) => x.id === m[1])
    if (a) { setVista((a.etapa || 'activo') as 'activo' | 'archivo'); setAbierto(a) }
  }, [avisos])

  return (
    <div className="contenedor av">
      <header className="av-cab">
        <p className="av-cab__ante">{antetitulo}</p>
        <h1 className="av-cab__titulo">{titulo}</h1>
        <p className="av-cab__entrada">{entrada}</p>
        {API && !form && (
          <div className="av-cab__acciones">
            <button className="av-boton av-boton--principal" onClick={() => { setForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{boton}</button>
            <Link className="av-enlace" to={`/mi-aviso?s=${seccion}`}>Ya publiqué: actualizar o cerrar mi aviso</Link>
          </div>
        )}
        {seccion === 'anuncios' && (
          <p className="av-publicidad">
            ¿Tienes un negocio? <b>Anúnciate</b> en la web y en el boletín:{' '}
            <a href={enlaceAnuncios()} target="_blank" rel="noopener noreferrer"><IcoWhatsapp size={14} /> {SITIO.anunciosVisible}</a>
            {' '}· <a href={`mailto:${SITIO.correo}`}>{SITIO.correo}</a>
          </p>
        )}
      </header>

      {!API && (
        <p className="av-aviso">Muy pronto podrás publicar desde aquí. Mientras tanto, mándanos tu aviso con foto por WhatsApp al{' '}
          <a href={enlaceWhatsApp(`Hola Altiplano al Día, quiero publicar en ${titulo}: `)} target="_blank" rel="noopener noreferrer">{SITIO.whatsappVisible}</a>.</p>
      )}

      {form ? (
        <Formulario seccion={seccion} alCerrar={() => setForm(false)} />
      ) : API ? (
        <>
          <div className="av-barra">
            <div className="av-pestanas" role="tablist">
              <button role="tab" aria-selected={vista === 'activo'} className={vista === 'activo' ? 'activo' : ''} onClick={() => setVista('activo')}>Vigentes</button>
              <button role="tab" aria-selected={vista === 'archivo'} className={vista === 'archivo' ? 'activo' : ''} onClick={() => setVista('archivo')}>
                Archivo{enArchivo ? <span className="av-cuenta">{enArchivo}</span> : null}
              </button>
            </div>
            <label className="av-donde">
              <span>Provincia</span>
              <select value={donde} onChange={(e) => setDonde(e.target.value)}>
                <option value="">Toda la región</option>
                {OPCIONES_PROVINCIA.map((x) => <option key={x.clave} value={x.clave}>{x.nombre}</option>)}
              </select>
            </label>
          </div>
          <nav className="av-filtros" aria-label="Tipo de aviso">
            <button className={!filtro ? 'activo' : ''} onClick={() => setFiltro('')}>Todo <span className="av-cuenta">{enVista.length}</span></button>
            {TIPOS[seccion].map((t) => (
              <button key={t.clave} className={filtro === t.clave ? 'activo' : ''} style={{ '--tipo': t.color } as CSSProperties} onClick={() => setFiltro(t.clave)}>
                {t.plural}{cuenta(t.clave) ? <span className="av-cuenta">{cuenta(t.clave)}</span> : null}
              </button>
            ))}
          </nav>
          {vista === 'archivo' && (
            <p className="av-ayuda av-ayuda--bloque">Avisos cerrados o con más de {seccion === 'mascotas' ? 'dos meses' : 'un mes'}. Para cuidar a quienes los publicaron, aquí ya no aparecen sus números y la ubicación es aproximada.</p>
          )}
          {puntos.length > 0 && (
            <figure className="av-mapa-lista">
              <Mapa puntos={puntos} alTocarPunto={irA} zoomMax={vista === 'archivo' ? 13 : 15} />
              <figcaption>Toca un punto para ir al aviso. Mapa: OpenStreetMap.</figcaption>
            </figure>
          )}
          {error && <p className="av-error">{error}</p>}
          {!avisos && !error && <p className="av-ayuda">Cargando avisos…</p>}
          {avisos && lista.length === 0 && (
            <p className="av-vacio">{vista === 'archivo' ? 'No hay avisos archivados con este filtro.' : `No hay avisos vigentes${filtro || donde ? ' con este filtro' : ''}.`}</p>
          )}
          <div className="av-lista">
            {lista.map((a) => <Ficha key={a.id} seccion={seccion} a={a} resaltado={resaltado === a.id} alAbrir={() => abrir(a)} />)}
          </div>
          {abierto && <DetalleAviso seccion={seccion} a={abierto} alCerrar={() => abrir(null)} />}
        </>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------------ /mi-aviso: gestión por quien publicó
/** Lista con buscador para que la persona elija su aviso sin tener que copiar el número. */
function ElegirAviso({ seccion, elegido, alElegir }: { seccion: Seccion; elegido: string; alElegir: (id: string) => void }) {
  const { avisos } = useAvisos(seccion)
  const [q, setQ] = useState('')
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const lista = useMemo(() => {
    const t = norm(q.trim())
    return (avisos ?? []).filter((a) => a.etapa !== 'archivo')
      .filter((a) => !t || norm(`${tituloDe(seccion, a)} ${a.zona} ${a.descripcion} ${a.id}`).includes(t))
  }, [avisos, q, seccion])
  return (
    <div className="av-elegir">
      <Campo etiqueta="Busca y elige tu aviso">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={seccion === 'mascotas' ? 'Nombre de tu mascota, zona…' : 'Título, zona…'} />
      </Campo>
      {!avisos ? <p className="av-ayuda">Cargando avisos…</p> : (
        <ul className="av-elegir__lista">
          {lista.slice(0, 24).map((a) => {
            const t = tipoDe(seccion, a.tipo)
            return (
              <li key={a.id}>
                <button type="button" className={`av-elegir__item${elegido === a.id ? ' av-elegir__item--activo' : ''}`} style={{ '--tipo': t.color } as CSSProperties}
                  onClick={() => alElegir(a.id)} aria-pressed={elegido === a.id}>
                  {a.foto ? <img src={fotoDrive(a.foto, 200)} alt="" loading="lazy" /> : <span className="av-elegir__sinfoto" />}
                  <span className="av-elegir__txt">
                    <span className="av-elegir__tipo">{t.nombre}</span>
                    <strong>{tituloDe(seccion, a)}</strong>
                    <span className="av-elegir__zona">{a.zona}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {avisos && !lista.length && <p className="av-ayuda">No encontramos avisos publicados con ese texto.</p>}
      <p className="av-ayuda">¿Tu aviso no aparece? Si todavía está en revisión, escribe abajo el número que recibiste.</p>
    </div>
  )
}

export function MiAviso() {
  useTitulo('Mi aviso')
  const [params] = useSearchParams()
  const [seccion, setSeccion] = useState<Seccion>((['mascotas', 'anuncios', 'denuncias'].includes(params.get('s') || '') ? params.get('s') : 'mascotas') as Seccion)
  const [id, setId] = useState(params.get('id') || '')
  const [clave, setClave] = useState(params.get('c') || '')
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [novedad, setNovedad] = useState('')
  const [fotoNovedad, setFotoNovedad] = useState<{ b64: string; tipo: string; vista: string } | null>(null)
  const [motivo, setMotivo] = useState('')
  const [detalle, setDetalle] = useState('')

  const abrir = async (e?: FormEvent) => {
    e?.preventDefault()
    setError('')
    setOk('')
    setOcupado(true)
    try {
      const r = await llamar<{ aviso: Aviso }>('mi_aviso', { seccion, id, clave })
      setAviso(r.aviso)
    } catch (x) {
      setError((x as Error).message)
    } finally {
      setOcupado(false)
    }
  }
  useEffect(() => { if (API && params.get('id') && params.get('c')) abrir() }, [])   // enlace guardado: abre directo

  const enviarNovedad = async (e: FormEvent) => {
    e.preventDefault()
    setOcupado(true)
    setError('')
    try {
      await llamar('actualizar_aviso', { seccion, id, clave, texto: novedad, foto: fotoNovedad ? { b64: fotoNovedad.b64, tipo: fotoNovedad.tipo } : null })
      setNovedad('')
      setFotoNovedad(null)
      setOk('Novedad publicada en tu aviso.')
      await abrir()
    } catch (x) {
      setError((x as Error).message)
    } finally {
      setOcupado(false)
    }
  }
  const cerrar = async (e: FormEvent) => {
    e.preventDefault()
    if (!motivo) return setError('Elige cómo terminó.')
    setOcupado(true)
    setError('')
    try {
      const r = await llamar<{ estado: string }>('cerrar_aviso', { seccion, id, clave, desenlace: detalle.trim() ? `${motivo}. ${detalle.trim()}` : motivo })
      setOk(r.estado === 'retirado' ? 'Retiramos tu aviso: no se publicará.' : 'Aviso cerrado. Ya no se muestra tu número y en la web queda cómo terminó. ¡Gracias por avisar!')
      await abrir()
    } catch (x) {
      setError((x as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  const estadoTexto = aviso && (
    aviso.estado === 'pendiente' ? 'En revisión: la redacción todavía no lo publica.'
      : aviso.estado === 'aprobado' ? (seccion === 'denuncias' ? 'En verificación por la redacción.' : 'Publicado y vigente.')
      : aviso.estado === 'resuelto' ? 'Cerrado.'
      : 'No publicado.')
  const abierto = aviso && (aviso.estado === 'pendiente' || aviso.estado === 'aprobado')

  return (
    <div className="contenedor av av--angosto">
      <header className="av-cab">
        <p className="av-cab__ante">Gestiona lo que publicaste</p>
        <h1 className="av-cab__titulo">Mi aviso</h1>
        <p className="av-cab__entrada">Con el número y el código que recibiste al enviar, puedes ver en qué va tu aviso, contar una novedad o cerrarlo cuando ya no haga falta.</p>
      </header>
      {!API && <p className="av-aviso">Esta función se activa cuando conectemos el sistema. Mientras tanto, escríbenos al {SITIO.whatsappVisible}.</p>}

      {API && !aviso && (
        <form className="av-form" onSubmit={abrir}>
          <div className="av-fila">
            <Campo etiqueta="Sección">
              <select value={seccion} onChange={(e) => { setSeccion(e.target.value as Seccion); setId('') }}>
                {(Object.keys(NOMBRE_SECCION) as Seccion[]).map((s) => <option key={s} value={s}>{NOMBRE_SECCION[s]}</option>)}
              </select>
            </Campo>
          </div>
          {seccion !== 'denuncias' && <ElegirAviso seccion={seccion} elegido={id} alElegir={setId} />}
          <div className="av-fila">
            <Campo etiqueta="Número del aviso" nota={seccion === 'denuncias' ? undefined : 'se llena al elegirlo'}>
              <input required value={id} onChange={(e) => setId(e.target.value)} placeholder="M261115-ABCDE" autoCapitalize="characters" />
            </Campo>
            <Campo etiqueta="Código" nota="el que recibiste al enviar">
              <input required value={clave} onChange={(e) => setClave(e.target.value)} autoCapitalize="characters" autoComplete="off" autoFocus={!!id} />
            </Campo>
          </div>
          {error && <p className="av-error" role="alert">{error}</p>}
          <div className="av-acciones"><button className="av-boton av-boton--principal" disabled={ocupado}>{ocupado ? 'Buscando…' : 'Ver mi aviso'}</button></div>
        </form>
      )}

      {aviso && (
        <>
          <section className="av-estado">
            <p className="av-estado__etq">Estado</p>
            <p className="av-estado__valor">{estadoTexto}</p>
            {aviso.desenlace && <p className="av-ficha__desenlace"><b>Cómo terminó:</b> {aviso.desenlace}</p>}
          </section>
          <div className="av-lista av-lista--una"><Ficha seccion={seccion} a={{ ...aviso, etapa: 'activo' }} resaltado={false} /></div>
          {ok && <p className="av-ok" role="status">{ok}</p>}
          {error && <p className="av-error" role="alert">{error}</p>}
          {abierto && (
            <>
              <form className="av-form av-bloque" onSubmit={enviarNovedad}>
                <h2 className="av-bloque__titulo">{seccion === 'denuncias' ? 'Agregar información' : 'Contar una novedad'}</h2>
                {!!aviso.novedades?.length && <p className="av-ayuda">Llevas {aviso.novedades.length} de 10 novedades. Se muestran todas, la más reciente primero.</p>}
                <p className="av-ayuda">{seccion === 'mascotas' ? 'Por ejemplo: «La vieron el jueves cerca del mercado Bellavista».' : seccion === 'denuncias' ? 'Datos nuevos que ayuden a verificar tu denuncia.' : 'Por ejemplo: cambio de precio u horario.'} No escribas números de teléfono: se ocultan.</p>
                <textarea required minLength={5} maxLength={400} rows={3} value={novedad} onChange={(e) => setNovedad(e.target.value)} />
                <Campo etiqueta="Foto" nota="opcional">
                  <input type="file" accept="image/jpeg,image/png,image/webp"
                    onChange={async (e) => { const f = e.target.files?.[0]; try { setFotoNovedad(f ? await comprimir(f) : null) } catch (x) { setError((x as Error).message) } }} />
                </Campo>
                {fotoNovedad && <img className="av-vista" src={fotoNovedad.vista} alt="Vista previa" />}
                <div className="av-acciones"><button className="av-boton" disabled={ocupado}>Publicar novedad</button></div>
              </form>
              {seccion !== 'denuncias' && (
                <form className="av-form av-bloque" onSubmit={cerrar}>
                  <h2 className="av-bloque__titulo">Cerrar el aviso</h2>
                  <p className="av-ayuda">El aviso pasa al archivo con lo que cuentes aquí. Tu número deja de mostrarse de inmediato.</p>
                  <div className="av-opciones">
                    {(DESENLACES[aviso.tipo] || DESENLACES.otros).map((m) => (
                      <label key={m} className={`av-opcion${motivo === m ? ' av-opcion--activa' : ''}`}>
                        <input type="radio" name="motivo" value={m} checked={motivo === m} onChange={() => setMotivo(m)} /> {m}
                      </label>
                    ))}
                  </div>
                  <Campo etiqueta="Cuéntalo en pocas palabras" nota="opcional">
                    <textarea maxLength={300} rows={3} value={detalle} onChange={(e) => setDetalle(e.target.value)}
                      placeholder={seccion === 'mascotas' ? 'Una vecina lo reconoció por la foto y nos llamó. ¡Gracias a todos!' : ''} />
                  </Campo>
                  <div className="av-acciones"><button className="av-boton av-boton--principal" disabled={ocupado}>Cerrar mi aviso</button></div>
                </form>
              )}
            </>
          )}
          <p className="av-ayuda"><Link className="av-enlace" to={RUTA_SECCION[seccion]}>Volver a {NOMBRE_SECCION[seccion]}</Link></p>
        </>
      )}
    </div>
  )
}

/** Formulario de denuncia ciudadana (va a la hoja Denuncias; nunca se publica tal cual). */
export function FormularioDenuncia({ alCerrar }: { alCerrar: () => void }) {
  return <Formulario seccion="denuncias" alCerrar={alCerrar} />
}
export const hayServidor = !!API

export function AlertaMascota() {
  return (
    <PaginaAvisos
      seccion="mascotas"
      titulo="Alerta Mascota"
      antetitulo="Perdidos, encontrados, maltrato y adopción"
      entrada="Si se perdió tu perro o tu gato, si encontraste uno o si viste un caso de maltrato, publícalo aquí. Revisamos cada aviso antes de mostrarlo y lo difundimos en toda la región."
      boton="Publicar un aviso"
    />
  )
}

export function Anuncios() {
  return (
    <PaginaAvisos
      seccion="anuncios"
      titulo="Anuncios"
      antetitulo="Anuncios gratis de Puno y la región"
      entrada="Ofertas de trabajo, personas que buscan empleo, compra, venta, alquileres, servicios y eventos. Publicar no cuesta nada: tu anuncio sale cuando la redacción lo revisa."
      boton="Publicar un anuncio"
    />
  )
}

export default AlertaMascota
