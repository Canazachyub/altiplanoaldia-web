import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AMBITOS, SECCIONES, SITIO, enlaceWhatsApp, pub } from '../config/sitio'
import { PROVINCIAS } from '../config/provincias'
import { hora, provinciasDe, type Nota } from '../data/noticias'
import {
  IcoBuscar, IcoCerrar, IcoFacebook, IcoLuna, IcoMegafono, IcoMenu, IcoSol, IcoTiktok, IcoWhatsapp,
} from './Iconos'

const CODIGOS_CLIMA: Record<number, string> = {
  0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Neblina', 48: 'Neblina',
  51: 'Llovizna', 53: 'Llovizna', 55: 'Llovizna', 61: 'Lluvia', 63: 'Lluvia', 65: 'Lluvia fuerte', 66: 'Lluvia helada',
  71: 'Nevada', 73: 'Nevada', 75: 'Nevada fuerte', 77: 'Granizo', 80: 'Chubascos', 81: 'Chubascos', 82: 'Chubascos',
  85: 'Nevada', 86: 'Nevada', 95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta con granizo',
}

export interface ClimaHoy { t: number; d: string; codigo: number; max: number | null; min: number | null }

// Una sola consulta a Open-Meteo por carga de página, compartida por la barra superior y la portada.
let pedidoClima: Promise<ClimaHoy> | null = null
function pedirClima() {
  if (!pedidoClima) {
    pedidoClima = fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${SITIO.lat}&longitude=${SITIO.lon}` +
        '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=America%2FLima',
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((j) => ({
        t: Math.round(j.current.temperature_2m),
        d: CODIGOS_CLIMA[j.current.weather_code] ?? '',
        codigo: j.current.weather_code,
        max: j.daily?.temperature_2m_max?.[0] != null ? Math.round(j.daily.temperature_2m_max[0]) : null,
        min: j.daily?.temperature_2m_min?.[0] != null ? Math.round(j.daily.temperature_2m_min[0]) : null,
      }))
      .catch((e) => {
        pedidoClima = null
        throw e
      })
  }
  return pedidoClima
}

/** Clima actual de Puno (Open-Meteo, sin API key). `null` mientras carga o si falla. */
export function useClima() {
  const [c, setC] = useState<ClimaHoy | null>(null)
  useEffect(() => {
    let vivo = true
    pedirClima()
      .then((x) => vivo && setC(x))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])
  return c
}

function Clima() {
  const c = useClima()
  if (!c) return null
  return (
    <Link to="/clima" className="barra-sup__clima" title={`Clima en ${SITIO.ciudad}: pronóstico y heladas`}>
      {SITIO.ciudad} {c.t}°C · {c.d}
    </Link>
  )
}

function useModoOscuro() {
  const [oscuro, setOscuro] = useState(() => {
    const t = document.documentElement.dataset.tema
    if (t) return t === 'oscuro'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })
  useEffect(() => {
    document.documentElement.dataset.tema = oscuro ? 'oscuro' : 'claro'
    try {
      localStorage.setItem('aad-tema', oscuro ? 'oscuro' : 'claro')
    } catch {
      /* sin almacenamiento */
    }
  }, [oscuro])
  return [oscuro, () => setOscuro((o) => !o)] as const
}

function Redes({ conTexto = false }: { conTexto?: boolean }) {
  return (
    <>
      <a href={SITIO.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook de Altiplano al Día" className="red red--fb">
        <IcoFacebook size={18} /> {conTexto && <span>Facebook</span>}
      </a>
      <a href={SITIO.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok de Altiplano al Día" className="red red--tt">
        <IcoTiktok size={18} /> {conTexto && <span>TikTok {SITIO.tiktokUsuario}</span>}
      </a>
    </>
  )
}

export { Redes }

// ===== Franja "Hoy:" (temas calientes, como la de larepublica.pe) =====
const VENTANA_HOY = 48 * 3_600_000
const sinTildes = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
/** Palabras con mayúscula que no hacen un tema por sí solas. */
const VACIAS = new Set(
  'el la los las un una unos unas en con por para tras sin ante desde hasta sobre entre segun durante y o e ni que se su sus al del de lo este esta estos estas ese esa hoy ayer manana nuevo nueva gobierno policia puno peru peruano peruana peruanos nacional regional provincial municipal'.split(' '),
)
const CONECTORES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'el'])
/** La provincia de Puno no es un tema (todo el sitio es Puno); San Román se conoce por Juliaca. */
const ETIQUETA_PROV: Record<string, string | null> = { puno: null, 'san-roman': 'Juliaca', putina: 'Putina' }
const esMayus = (w: string) => /^[A-ZÁÉÍÓÚÑÜ]/.test(w)

/** Secuencias de nombres propios del titular. La primera palabra de cada frase solo cuenta si la sigue otro nombre. */
function nombresPropios(titular: string): string[] {
  const out: string[] = []
  for (const frase of titular.split(/[:;.?!¿¡()«»"“”]+|\s[-–—]\s/)) {
    const toks = frase.split(/\s+/).filter(Boolean)
    const palabras = toks.map((x) => x.replace(/^['‘’]+|['‘’,]+$/g, ''))
    // Titulares en mayúsculas sostenidas: no sirven para la heurística
    if (palabras.filter((w) => w.length > 3 && w === w.toUpperCase()).length > palabras.length / 2) continue
    let actual: string[] = []
    const cerrar = () => {
      while (actual.length && CONECTORES.has(actual[actual.length - 1])) actual.pop()
      const nucleo = actual.filter((w) => !CONECTORES.has(w))
      if (nucleo.length && !(nucleo.length === 1 && VACIAS.has(sinTildes(nucleo[0])))) out.push(actual.join(' '))
      actual = []
    }
    palabras.forEach((w, i) => {
      const sig = palabras[i + 1]
      if (w && esMayus(w) && !/\d/.test(w)) {
        const inicial = i === 0
        if (inicial && (!sig || !esMayus(sig) || VACIAS.has(sinTildes(w)))) {
          /* primera palabra de la frase sin nombre compuesto detrás: mayúscula de oración */
        } else if (!actual.length && VACIAS.has(sinTildes(w))) {
          /* artículo o palabra vacía al inicio de la secuencia */
        } else actual.push(w)
      } else if (actual.length && CONECTORES.has(w) && sig && esMayus(sig)) {
        actual.push(w)
      } else cerrar()
      if (/,$/.test(toks[i])) cerrar()
    })
    cerrar()
  }
  return out
}

export interface TemaHoy { etiqueta: string; q: string; n: number }

/** ~8 temas de las últimas 48 h (relativas a la nota más nueva, no a la hora actual): provincias y nombres propios repetidos. */
export function temasHoy(notas: Nota[], max = 8): TemaHoy[] {
  const t = (n: Nota) => (n.fecha ? new Date(n.fecha).getTime() : 0)
  const tope = Math.max(0, ...notas.map(t))
  const recientes = notas.filter((n) => t(n) >= tope - VENTANA_HOY)

  const provs = PROVINCIAS.map((p) => ({
    etiqueta: p.clave in ETIQUETA_PROV ? ETIQUETA_PROV[p.clave] : p.nombre,
    n: recientes.filter((n) => provinciasDe(n, PROVINCIAS).includes(p.clave)).length,
  }))
    .filter((x): x is { etiqueta: string; n: number } => !!x.etiqueta && x.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, 4)
    .map((x) => ({ ...x, q: x.etiqueta, peso: x.n }))

  const titulares = recientes.map((n) => sinTildes(n.titular))
  const candidatos = new Map<string, string>()
  for (const n of recientes) for (const f of nombresPropios(n.titular)) if (!candidatos.has(sinTildes(f))) candidatos.set(sinTildes(f), f)
  const frases = [...candidatos]
    .map(([clave, etiqueta]) => {
      const re = new RegExp(`(^|[^a-z0-9])${clave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`)
      const n = titulares.filter((x) => re.test(x)).length
      const multi = etiqueta.includes(' ')
      return { etiqueta, q: etiqueta, n, peso: n + (multi ? 0.5 : 0), multi }
    })
    .filter((x) => x.n >= (x.multi ? 2 : 3) && x.etiqueta.length >= 3)

  const elegidos: (TemaHoy & { peso: number })[] = []
  for (const c of [...frases, ...provs].sort((a, b) => b.peso - a.peso || b.etiqueta.length - a.etiqueta.length)) {
    const k = sinTildes(c.etiqueta)
    if (elegidos.some((e) => sinTildes(e.etiqueta).includes(k) || k.includes(sinTildes(e.etiqueta)))) continue
    elegidos.push(c)
    if (elegidos.length >= max) break
  }
  return elegidos.map(({ etiqueta, q, n }) => ({ etiqueta, q, n }))
}

function FranjaHoy({ notas }: { notas: Nota[] }) {
  const temas = useMemo(() => temasHoy(notas), [notas])
  if (temas.length < 3) return null
  return (
    <nav className="lr-hoy" aria-label="Temas de hoy">
      <div className="contenedor lr-hoy__in">
        <span className="lr-hoy__etiqueta">Hoy:</span>
        <ul className="lr-hoy__lista">
          {temas.map((x) => (
            <li key={x.etiqueta}>
              <Link to={`/buscar?q=${encodeURIComponent(x.q)}`} title={`${x.n} notas sobre ${x.etiqueta}`}>{x.etiqueta}</Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

export function Cinta({ notas }: { notas: Nota[] }) {
  const ultimas = notas.slice(0, 10)
  if (!ultimas.length) return null
  return (
    <>
    <FranjaHoy notas={notas} />
    <div className="cinta" aria-label="Lo último">
      <div className="contenedor cinta__in">
        <Link to="/lo-ultimo" className="cinta__etiqueta">Lo último</Link>
        <div className="cinta__ventana">
          <ul className="cinta__pista">
            {[...ultimas, ...ultimas].map((n, i) => (
              <li key={`${n.id}-${i}`} aria-hidden={i >= ultimas.length || undefined}>
                <time>{hora(n.fecha)}</time>
                <Link to={`/nota/${n.slug}`} tabIndex={i >= ultimas.length ? -1 : undefined}>{n.titular}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
    </>
  )
}

export default function Cabecera() {
  const [menu, setMenu] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [compacta, setCompacta] = useState(false)
  const [oscuro, alternarOscuro] = useModoOscuro()
  const [q, setQ] = useState('')
  const navegar = useNavigate()
  const loc = useLocation()
  const inputRef = useRef<HTMLInputElement>(null)
  const cerrarRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const f = () => setCompacta(window.scrollY > 140)
    f()
    window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])

  useEffect(() => {
    setMenu(false)
    setBuscando(false)
  }, [loc.pathname, loc.search])

  useEffect(() => {
    if (buscando) inputRef.current?.focus()
  }, [buscando])

  useEffect(() => {
    const atajo = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault()
        setBuscando(true)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
    }
    window.addEventListener('keydown', atajo)
    return () => window.removeEventListener('keydown', atajo)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('sin-scroll', menu)
    if (menu) cerrarRef.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && (setMenu(false), setBuscando(false))
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [menu])

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (q.trim()) navegar(`/buscar?q=${encodeURIComponent(q.trim())}`)
  }

  const hoy = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <a href="#contenido" className="saltar">Saltar al contenido</a>
      <div className="barra-sup">
        <div className="contenedor barra-sup__in">
          <span className="barra-sup__fecha">{SITIO.ciudad}, {hoy}</span>
          <Clima />
          <span className="barra-sup__redes"><Redes /></span>
          <a className="barra-sup__denuncia" href={enlaceWhatsApp('Hola Altiplano al Día, quiero hacer una denuncia: ')} target="_blank" rel="noopener noreferrer">
            <IcoMegafono size={16} /> Denuncia: {SITIO.whatsappVisible}
          </a>
        </div>
      </div>

      <header className={`cabecera${compacta ? ' cabecera--compacta' : ''}`}>
        <div className="contenedor cabecera__in">
          <button className="btn-icono" onClick={() => setMenu(true)} aria-label="Abrir menú" aria-expanded={menu} aria-controls="menu-lateral">
            <IcoMenu size={24} /> <span className="cabecera__menu-txt">Menú</span>
          </button>
          <Link to="/" className="cabecera__logo" aria-label="Altiplano al Día, ir a la portada">
            <img src={pub('brand/logo-horizontal.svg')} alt="Altiplano al Día" className="logo logo--claro" width="300" height="66" />
            <img src={pub('brand/logo-horizontal-blanco.svg')} alt="" className="logo logo--oscuro" width="300" height="66" />
          </Link>
          <div className="cabecera__acciones">
            <Link to="/guardadas" className="btn-icono cabecera__guardadas" aria-label="Mis notas guardadas" title="Guardadas">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
            </Link>
            <button className="btn-icono" onClick={() => setBuscando((b) => !b)} aria-label="Buscar (atajo: /)" aria-expanded={buscando} title="Buscar ( / )">
              <IcoBuscar size={22} />
            </button>
            <button className="btn-icono" onClick={alternarOscuro} aria-label={oscuro ? 'Activar modo claro' : 'Activar modo oscuro'}>
              {oscuro ? <IcoSol size={22} /> : <IcoLuna size={22} />}
            </button>
            <Link to="/boletin" className="btn btn--amarillo cabecera__boletin">Boletín</Link>
          </div>
        </div>
        {buscando && (
          <form className="buscador contenedor" role="search" onSubmit={enviar}>
            <label htmlFor="q" className="sr-only">Buscar noticias</label>
            <input id="q" ref={inputRef} type="search" placeholder="Buscar en Altiplano al Día: Juliaca, UNA Puno, PNP…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn btn--azul" type="submit">Buscar</button>
          </form>
        )}
        <nav className="nav-secciones" aria-label="Secciones">
          <ul className="contenedor nav-secciones__lista">
            <li><NavLink to="/" end>Portada</NavLink></li>
            {SECCIONES.filter((s) => s.clave !== 'otros').map((s) => (
              <li key={s.clave}><NavLink to={`/seccion/${s.clave}`}>{s.clave === 'ambiente' ? 'Ambiente' : s.nombre}</NavLink></li>
            ))}
            <li><NavLink to="/ambito/nacional">Nacional</NavLink></li>
            <li><NavLink to="/provincias">Provincias</NavLink></li>
            <li><NavLink to="/clima">Clima</NavLink></li>
            <li><NavLink to="/denuncia" className="nav-secciones__denuncia">Denuncia</NavLink></li>
          </ul>
        </nav>
      </header>

      <div className={`velo${menu ? ' velo--visible' : ''}`} onClick={() => setMenu(false)} aria-hidden="true" />
      <aside id="menu-lateral" className={`menu-lateral${menu ? ' menu-lateral--abierto' : ''}`} aria-label="Menú" aria-hidden={!menu} {...(!menu ? { inert: "" } : {})}>
        <div className="menu-lateral__cab">
          <img src={pub('brand/logo-horizontal-blanco.svg')} alt="Altiplano al Día" width="180" height="40" />
          <button ref={cerrarRef} className="btn-icono" onClick={() => setMenu(false)} aria-label="Cerrar menú"><IcoCerrar size={24} /></button>
        </div>
        <form className="menu-lateral__buscar" role="search" onSubmit={enviar}>
          <input type="search" aria-label="Buscar noticias" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="submit" aria-label="Buscar"><IcoBuscar size={18} /></button>
        </form>
        <p className="menu-lateral__titulo">Secciones</p>
        <ul className="menu-lateral__lista">
          <li><Link to="/">Portada</Link></li>
          <li><Link to="/lo-ultimo">Lo último</Link></li>
          <li><Link to="/provincias">Provincias de Puno</Link></li>
          <li><Link to="/clima">Clima y heladas</Link></li>
          <li><Link to="/ediciones">Edición en PDF</Link></li>
          <li><Link to="/guardadas">Mis guardadas</Link></li>
          {SECCIONES.map((s) => (
            <li key={s.clave}>
              <Link to={`/seccion/${s.clave}`}>
                <img src={pub(`icons/${s.icono}_w.png`)} alt="" width="20" height="20" /> {s.nombre}
              </Link>
            </li>
          ))}
        </ul>
        <p className="menu-lateral__titulo">Por ámbito</p>
        <ul className="menu-lateral__chips">
          {AMBITOS.map((a) => (
            <li key={a.clave}><Link to={`/ambito/${a.clave}`}>{a.nombre}</Link></li>
          ))}
        </ul>
        <p className="menu-lateral__titulo">Altiplano al Día</p>
        <ul className="menu-lateral__lista">
          <li><Link to="/denuncia">Haz tu denuncia</Link></li>
          <li><Link to="/boletin">Boletín por WhatsApp</Link></li>
          <li><Link to="/nosotros">Quiénes somos</Link></li>
        </ul>
        <div className="menu-lateral__redes"><Redes conTexto /></div>
        <a className="btn btn--amarillo btn--bloque" href={enlaceWhatsApp('Hola Altiplano al Día, quiero hacer una denuncia: ')} target="_blank" rel="noopener noreferrer">
          <IcoWhatsapp size={18} /> Denuncias {SITIO.whatsappVisible}
        </a>
      </aside>
    </>
  )
}
