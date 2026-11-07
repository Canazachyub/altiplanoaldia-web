// Páginas nuevas: provincias, clima y heladas, ediciones PDF, medios y guardadas.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { TituloBloque } from '../components/Bloques'
import { Esqueleto } from '../components/Extras'
import { ErrorCarga } from '../components/Piezas'
import Tarjeta from '../components/Tarjeta'
import { PROVINCIAS, provinciaPorClave } from '../config/provincias'
import { pub } from '../config/sitio'
import { IcoCopo, IcoGota, IcoHumedad, IcoOk, IcoTermometro, IcoUV, IcoViento, IconoClima } from '../components/IconosClima'
import { provinciasDe, useBoletines, useGuardadas, useNotas } from '../data/noticias'
import { useTitulo } from '../hooks/useTitulo'
import NoEncontrado from './NoEncontrado'

// ================= Provincias =================
export function MapaProvincias({ compacto = false }: { compacto?: boolean }) {
  const { notas } = useNotas()
  const cuenta = (c: string) => (notas ? notas.filter((n) => provinciasDe(n, PROVINCIAS).includes(c)).length : 0)
  const lista = [...PROVINCIAS].sort((a, b) => cuenta(b.clave) - cuenta(a.clave))
  return (
    <ul className={`provincias${compacto ? ' provincias--compacto' : ''}`}>
      {lista.map((p) => {
        const n = cuenta(p.clave)
        return (
          <li key={p.clave}>
            <Link to={`/provincia/${p.clave}`} className={`provincia${n ? '' : ' provincia--vacia'}`}>
              <span className="provincia__nombre">{p.nombre}</span>
              <span className="provincia__capital">{p.capital}</span>
              <span className="provincia__n">{n} {n === 1 ? 'nota' : 'notas'}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function Provincias() {
  useTitulo('Provincias de Puno')
  return (
    <div className="contenedor listado">
      <div>
        <h1 className="titulo-pagina">Provincias de Puno</h1>
        <p className="subtitulo-pagina">Las 13 provincias de la región. Elige una para ver sus noticias.</p>
      </div>
      <MapaProvincias />
    </div>
  )
}

export function Provincia() {
  const { clave } = useParams()
  const p = provinciaPorClave(clave)
  const { notas, error } = useNotas()
  useTitulo(p ? `Noticias de ${p.nombre}` : undefined)
  if (!p) return <NoEncontrado />
  if (error) return <ErrorCarga error={error} />
  if (!notas) return <Esqueleto />
  const lista = notas.filter((n) => provinciasDe(n, PROVINCIAS).includes(p.clave))
  return (
    <div className="contenedor listado">
      <header className="cab-provincia">
        <p className="antetitulo"><Link to="/provincias">Provincias de Puno</Link></p>
        <h1 className="titulo-pagina">{p.nombre}</h1>
        <p className="subtitulo-pagina">Capital: {p.capital} · {lista.length} {lista.length === 1 ? 'nota' : 'notas'}</p>
      </header>
      <nav className="chips-secciones" aria-label="Otras provincias">
        {PROVINCIAS.filter((x) => x.clave !== p.clave).map((x) => (
          <Link key={x.clave} to={`/provincia/${x.clave}`} className="chip">{x.nombre}</Link>
        ))}
      </nav>
      {lista.length ? (
        <div className="grid-3">{lista.map((n) => <Tarjeta key={n.id} nota={n} nivel="h2" />)}</div>
      ) : (
        <p className="vacio">Aún no hay noticias de {p.nombre}. ¿Pasa algo en tu provincia? <Link to="/denuncia">Cuéntanos</Link>.</p>
      )}
    </div>
  )
}

// ================= Clima y heladas =================
const CIUDADES = [
  { nombre: 'Puno', lat: -15.8402, lon: -70.0219 },
  { nombre: 'Juliaca', lat: -15.4997, lon: -70.1333 },
  { nombre: 'Ilave', lat: -16.0866, lon: -69.6386 },
  { nombre: 'Ayaviri', lat: -14.8817, lon: -70.5900 },
  { nombre: 'Azángaro', lat: -14.9083, lon: -70.1964 },
  { nombre: 'Macusani', lat: -14.0694, lon: -70.4311 },
]

const CLIMA: Record<number, string> = {
  0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Neblina', 48: 'Neblina',
  51: 'Llovizna', 53: 'Llovizna', 55: 'Llovizna', 56: 'Llovizna helada', 57: 'Llovizna helada', 61: 'Lluvia', 63: 'Lluvia',
  65: 'Lluvia fuerte', 66: 'Lluvia helada', 67: 'Lluvia helada', 71: 'Nevada', 73: 'Nevada', 75: 'Nevada fuerte', 77: 'Granizo',
  80: 'Chubascos', 81: 'Chubascos', 82: 'Chubascos fuertes', 85: 'Nevada', 86: 'Nevada fuerte', 95: 'Tormenta',
  96: 'Tormenta con granizo', 99: 'Tormenta con granizo',
}

interface Pronostico {
  actual: { t: number; codigo: number; viento: number; humedad: number }
  dias: { fecha: string; max: number; min: number; codigo: number; lluvia: number; uv: number }[]
}

function usePronostico(lat: number, lon: number) {
  const [p, setP] = useState<Pronostico | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    const ctrl = new AbortController()
    setP(null)
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        '&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max' +
        '&timezone=America%2FLima&forecast_days=7',
      { signal: ctrl.signal },
    )
      .then((r) => r.json())
      .then((j) =>
        setP({
          actual: { t: j.current.temperature_2m, codigo: j.current.weather_code, viento: j.current.wind_speed_10m, humedad: j.current.relative_humidity_2m },
          dias: j.daily.time.map((f: string, i: number) => ({
            fecha: f, max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i], codigo: j.daily.weather_code[i],
            lluvia: j.daily.precipitation_probability_max[i] ?? 0, uv: j.daily.uv_index_max[i] ?? 0,
          })),
        }),
      )
      .catch((e) => e.name !== 'AbortError' && setError(true))
    return () => ctrl.abort()
  }, [lat, lon])
  return { p, error }
}

const nivelUV = (uv: number) => (uv >= 11 ? 'Extremo' : uv >= 8 ? 'Muy alto' : uv >= 6 ? 'Alto' : uv >= 3 ? 'Moderado' : 'Bajo')

export function Clima() {
  useTitulo('Clima y heladas en Puno')
  const [i, setI] = useState(0)
  const ciudad = CIUDADES[i]
  const { p, error } = usePronostico(ciudad.lat, ciudad.lon)
  const heladas = p?.dias.filter((d) => d.min <= 0) ?? []
  const uvMax = p ? Math.max(...p.dias.map((d) => d.uv)) : 0
  return (
    <div className="contenedor listado clima">
      <div>
        <h1 className="titulo-pagina">Clima y heladas</h1>
        <p className="subtitulo-pagina">Pronóstico a 7 días para las principales ciudades de la región. Datos: Open-Meteo.</p>
      </div>
      <div className="clima__ciudades" role="tablist" aria-label="Ciudad">
        {CIUDADES.map((c, j) => (
          <button key={c.nombre} role="tab" aria-selected={i === j} className={`chip${i === j ? ' chip--activo' : ''}`} onClick={() => setI(j)}>{c.nombre}</button>
        ))}
      </div>
      {error && <p className="aviso-error">No se pudo obtener el pronóstico. Revisa tu conexión.</p>}
      {!p && !error && <div className="esqueleto"><span className="esq esq--media" style={{ aspectRatio: '5/1' }} /></div>}
      {p && (() => {
        const hoy = p.dias[0]
        const desc = CLIMA[p.actual.codigo] ?? 'Sin datos'
        const minSem = Math.min(...p.dias.map((d) => d.min))
        const maxSem = Math.max(...p.dias.map((d) => d.max))
        const pct = (v: number) => `${((v - minSem) / (maxSem - minSem || 1)) * 100}%`
        return (
        <>
          <section className="clima__actual" aria-label={`Ahora en ${ciudad.nombre}`}>
            <div className="clima__ahora">
              <span className="clima__icono"><IconoClima codigo={p.actual.codigo} size={112} /></span>
              <div>
                <p className="clima__ciudad">Ahora en {ciudad.nombre}</p>
                <p className="clima__temp">{Math.round(p.actual.t)}<span>°C</span></p>
                <p className="clima__desc">{desc}</p>
              </div>
            </div>
            <dl className="clima__datos">
              <div><dt><IcoTermometro /> Hoy</dt><dd>{Math.round(hoy.max)}° / {Math.round(hoy.min)}°</dd></div>
              <div><dt><IcoViento /> Viento</dt><dd>{Math.round(p.actual.viento)} km/h</dd></div>
              <div><dt><IcoHumedad /> Humedad</dt><dd>{p.actual.humedad}%</dd></div>
              <div><dt><IcoGota /> Lluvia</dt><dd>{hoy.lluvia}%</dd></div>
              <div><dt><IcoUV /> Índice UV</dt><dd>{Math.round(hoy.uv)} <small>{nivelUV(hoy.uv)}</small></dd></div>
            </dl>
          </section>
          <div className="clima__alertas">
            {heladas.length > 0 ? (
              <div className="alerta alerta--frio" role="note">
                <span className="alerta__ico"><IcoCopo size={22} /></span>
                <div>
                  <strong>Heladas: {heladas.length} {heladas.length === 1 ? 'noche' : 'noches'} bajo 0 °C</strong>
                  <p>Mínima más baja: {Math.min(...heladas.map((d) => d.min)).toFixed(1)} °C. Abriga a niños y adultos mayores, protege al ganado y los cultivos.</p>
                </div>
              </div>
            ) : (
              <div className="alerta alerta--ok" role="note">
                <span className="alerta__ico"><IcoOk size={22} /></span>
                <div><strong>Sin heladas previstas</strong><p>Las mínimas de la semana se mantienen sobre 0 °C.</p></div>
              </div>
            )}
            {uvMax >= 8 && (
              <div className="alerta alerta--uv" role="note">
                <span className="alerta__ico"><IcoUV size={22} /></span>
                <div>
                  <strong>Radiación UV {nivelUV(uvMax).toLowerCase()} (índice {Math.round(uvMax)})</strong>
                  <p>Usa sombrero, lentes y bloqueador entre las 10:00 y las 15:00. En el altiplano la radiación es más intensa.</p>
                </div>
              </div>
            )}
          </div>
          <h2 className="clima__subtitulo">Próximos 7 días</h2>
          <ol className="clima__dias">
            {p.dias.map((d, k) => {
              const f = new Date(`${d.fecha}T12:00`)
              return (
                <li key={d.fecha} className={d.min <= 0 ? 'clima__dia--helada' : undefined}>
                  <p className="clima__dia">{k === 0 ? 'Hoy' : f.toLocaleDateString('es-PE', { weekday: 'short' }).replace('.', '')} <span>{f.getDate()}</span></p>
                  <IconoClima codigo={d.codigo} size={52} titulo={CLIMA[d.codigo] ?? ''} />
                  <p className="clima__estado">{CLIMA[d.codigo] ?? ''}</p>
                  <p className="clima__rango"><strong>{Math.round(d.max)}°</strong> <span>{Math.round(d.min)}°</span></p>
                  <span className="clima__barra" aria-hidden="true"><i style={{ left: pct(d.min), right: `calc(100% - ${pct(d.max)})` }} /></span>
                  <p className="clima__extra"><span><IcoGota size={14} /> {d.lluvia}%</span><span><IcoUV size={14} /> {Math.round(d.uv)}</span></p>
                  {d.min <= 0 && <span className="clima__helada"><IcoCopo size={12} /> Helada</span>}
                </li>
              )
            })}
          </ol>
        </>
        )
      })()}
    </div>
  )
}

// ================= Edición en PDF =================
export function TarjetaEdicion() {
  const b = useBoletines()
  const e = b?.[0]
  if (!e) return null
  return (
    <section className="tarjeta-edicion" aria-label="Edición en PDF">
      <Link to="/ediciones" className="tarjeta-edicion__portada">
        {e.portada && <img src={pub(e.portada)} alt={`Portada del boletín N° ${e.numero ?? ''}`} loading="lazy" />}
      </Link>
      <div>
        <p className="tarjeta-edicion__ante">Edición en PDF</p>
        <h2><Link to="/ediciones">Boletín N° {e.numero}</Link></h2>
        <p>{e.noticias} noticias · {e.paginas} páginas</p>
        <Link to="/ediciones" className="btn btn--azul">Leer la edición</Link>
      </div>
    </section>
  )
}

export function Ediciones() {
  useTitulo('Edición en PDF')
  const b = useBoletines()
  const e = b?.[0]
  const fecha = e ? new Date(e.fecha).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const url = e ? new URL(pub(e.archivo), location.origin).href : ''
  return (
    <div className="contenedor listado">
      <div>
        <h1 className="titulo-pagina">Edición en PDF</h1>
        <p className="subtitulo-pagina">El boletín de Altiplano al Día con el diseño de la edición impresa, para leer, descargar, imprimir o compartir.</p>
      </div>
      {!b && <Esqueleto />}
      {b && !e && <p className="vacio">Aún no hay una edición publicada.</p>}
      {e && (
        <>
          <section className="edicion-actual">
            {e.portada && (
              <a href={pub(e.archivo)} target="_blank" rel="noopener" className="edicion-actual__portada">
                <img src={pub(e.portada)} alt={`Portada del boletín N° ${e.numero ?? ''}`} />
              </a>
            )}
            <div className="edicion-actual__info">
              <p className="antetitulo"><span>Última edición</span></p>
              <h2>Boletín N° {e.numero ?? '—'}</h2>
              <p className="edicion-actual__fecha">{fecha}{e.hora ? ` · Edición de las ${e.hora} h` : ''}</p>
              <ul className="edicion-actual__datos">
                {e.noticias != null && <li><strong>{e.noticias}</strong> noticias</li>}
                {e.paginas != null && <li><strong>{e.paginas}</strong> páginas</li>}
                <li><strong>{(e.kb / 1024).toFixed(1)}</strong> MB</li>
              </ul>
              <div className="edicion-actual__acciones">
                <a className="btn btn--azul btn--grande" href={pub(e.archivo)} target="_blank" rel="noopener">Abrir en pantalla completa</a>
                <a className="btn btn--amarillo btn--grande" href={pub(e.archivo)} download={`Altiplano-al-Dia-Boletin-${e.numero ?? ''}.pdf`}>Descargar PDF</a>
                <a className="btn btn--contorno" href={`https://wa.me/?text=${encodeURIComponent(`Boletín N° ${e.numero ?? ''} de Altiplano al Día: ${url}`)}`} target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a>
              </div>
            </div>
          </section>
          <iframe className="ediciones__visor" src={`${pub(e.archivo)}#view=FitH`} title={`Boletín N° ${e.numero ?? ''} en PDF`} />
        </>
      )}
    </div>
  )
}

// ================= Guardadas =================
export function Guardadas() {
  useTitulo('Mis notas guardadas')
  const { notas } = useNotas()
  const { ids, alternar } = useGuardadas()
  if (!notas) return <Esqueleto />
  const lista = ids.map((id) => notas.find((n) => n.id === id)).filter(Boolean) as typeof notas
  return (
    <div className="contenedor listado">
      <div>
        <h1 className="titulo-pagina">Guardadas</h1>
        <p className="subtitulo-pagina">Las notas que guardaste en este dispositivo para leer después.</p>
      </div>
      {lista.length ? (
        <>
          <TituloBloque titulo={`${lista.length} ${lista.length === 1 ? 'nota' : 'notas'}`} />
          <ul className="linea-tiempo">
            {lista.map((n) => (
              <li key={n.id} className="guardada">
                <Tarjeta nota={n} variante="horizontal" nivel="h2" />
                <button className="btn-herramienta" onClick={() => alternar(n.id)}>Quitar</button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="vacio">Todavía no guardaste notas. Usa el botón <strong>Guardar</strong> en cualquier nota.</p>
      )}
    </div>
  )
}
