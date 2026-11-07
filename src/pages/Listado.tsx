// Páginas de listado: sección, ámbito, lo último y búsqueda (disposición tipo La República).
import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Esqueleto } from '../components/Extras'
import { AperturaLR, CabeceraLR, FeedLR, PaginaLR, RailLR } from '../components/Interiores'
import { ErrorCarga } from '../components/Piezas'
import { PROVINCIAS, provinciaPorClave } from '../config/provincias'
import { SECCIONES, ambitoPorClave, seccionPorClave } from '../config/sitio'
import { buscar, cargarDia, cargarIndice, provinciasDe, unirNotas, type IndiceArchivo, type Nota, useNotas } from '../data/noticias'
import { useTitulo } from '../hooks/useTitulo'
import NoEncontrado from './NoEncontrado'

const EN_APERTURA = 5

/**
 * Apertura (1 grande + 4) arriba y, debajo, el feed "Más noticias" con la columna derecha.
 * Las píldoras de provincia (?prov=clave) filtran solo el feed; la apertura no cambia.
 */
function ListadoLR({ lista, todas, vacio }: { lista: Nota[]; todas: Nota[]; vacio: string }) {
  const [params, setParams] = useSearchParams()
  const activa = provinciaPorClave(params.get('prov') ?? undefined)
  if (!lista.length) {
    return (
      <div className="lri-cols">
        <div className="lri-principal"><p className="vacio">{vacio}</p></div>
        <RailLR todas={todas} />
      </div>
    )
  }
  const apertura = lista.slice(0, EN_APERTURA)
  const resto = lista.slice(EN_APERTURA)
  const conteo = new Map<string, number>()
  for (const n of resto) for (const c of provinciasDe(n, PROVINCIAS)) conteo.set(c, (conteo.get(c) ?? 0) + 1)
  const opciones = PROVINCIAS.filter((p) => conteo.has(p.clave) || p.clave === activa?.clave)
    .sort((a, b) => (conteo.get(b.clave) ?? 0) - (conteo.get(a.clave) ?? 0))
  const feed = activa ? resto.filter((n) => provinciasDe(n, PROVINCIAS).includes(activa.clave)) : resto
  const elegir = (clave: string) =>
    setParams(
      (p) => {
        const q = new URLSearchParams(p)
        if (clave) q.set('prov', clave)
        else q.delete('prov')
        return q
      },
      { replace: true },
    )
  return (
    <>
      <AperturaLR notas={apertura} />
      <div className="lri-cols">
        <div className="lri-principal">
          {opciones.length > 0 && (
            <div className="chips-check lri-provs" role="group" aria-label="Filtrar más noticias por provincia">
              <span className="lri-provs__etiqueta" aria-hidden="true">Provincia</span>
              <button type="button" className={`chip${!activa ? ' chip--activo' : ''}`} aria-pressed={!activa} onClick={() => elegir('')}>
                Todas ({resto.length})
              </button>
              {opciones.map((p) => (
                <button key={p.clave} type="button" className={`chip${activa?.clave === p.clave ? ' chip--activo' : ''}`} aria-pressed={activa?.clave === p.clave} onClick={() => elegir(p.clave)}>
                  {p.nombre} ({conteo.get(p.clave) ?? 0})
                </button>
              ))}
            </div>
          )}
          {activa && !feed.length ? (
            <div className="lri-vacio" role="status">
              <p>No hay más noticias de {activa.nombre} en este listado.</p>
              <button type="button" className="lri-boton" onClick={() => elegir('')}>Ver todas las provincias</button>
            </div>
          ) : (
            <FeedLR key={activa?.clave ?? 'todas'} notas={feed} titulo={activa ? `Más noticias de ${activa.nombre}` : 'Más noticias'} />
          )}
        </div>
        <RailLR todas={todas} excluir={apertura.map((n) => n.id)} />
      </div>
    </>
  )
}

export function Seccion() {
  const { clave } = useParams()
  const { notas, error } = useNotas()
  const s = seccionPorClave(clave)
  useTitulo(s?.nombre)
  if (!s) return <NoEncontrado />
  if (error) return <ErrorCarga error={error} />
  if (!notas) return <Esqueleto />
  const lista = notas.filter((n) => n.seccion === s.clave)
  return (
    <PaginaLR className="listado-lr">
      <CabeceraLR titulo={s.nombre} descripcion={`Noticias de ${s.nombre.toLowerCase()} en Puno, la región y el país.`} color={s.color} icono={s.icono}>
        <nav className="lri-subnav" aria-label="Otras secciones">
          {SECCIONES.filter((x) => x.clave !== s.clave).map((x) => (
            <Link key={x.clave} to={`/seccion/${x.clave}`}>{x.nombre}</Link>
          ))}
        </nav>
      </CabeceraLR>
      <ListadoLR key={s.clave} lista={lista} todas={notas} vacio="Aún no hay noticias en esta sección." />
    </PaginaLR>
  )
}

export function Ambito() {
  const { clave } = useParams()
  const { notas, error } = useNotas()
  const a = ambitoPorClave(clave)
  useTitulo(a ? `Noticias de ámbito ${a.nombre.toLowerCase()}` : undefined)
  if (!a) return <NoEncontrado />
  if (error) return <ErrorCarga error={error} />
  if (!notas) return <Esqueleto />
  const lista = notas.filter((n) => n.ambito === a.valor)
  const desc: Record<string, string> = {
    distrital: 'Lo que pasa en los distritos de la región Puno.',
    local: 'Noticias de la ciudad y las provincias.',
    regional: 'La región Puno: gobierno regional, provincias y comunidades.',
    nacional: 'Lo que pasa en el Perú y afecta a Puno.',
    internacional: 'Noticias del mundo, con la mirada desde el altiplano.',
  }
  return (
    <PaginaLR className="listado-lr">
      <CabeceraLR titulo={a.nombre} descripcion={desc[a.clave]} color="var(--azul)" icono={a.icono} />
      <ListadoLR key={a.clave} lista={lista} todas={notas} vacio="Aún no hay noticias en este ámbito." />
    </PaginaLR>
  )
}

/** "sábado 7 de noviembre de 2026" para un día AAAA-MM-DD (al mediodía: sin saltos de zona horaria). */
const nombreDia = (dia: string) =>
  new Date(`${dia}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export function LoUltimo() {
  const { notas: hoy, error } = useNotas()
  const [filtro, setFiltro] = useState<string>('todas')
  const [params, setParams] = useSearchParams()
  const diaElegido = params.get('dia') ?? ''
  const [indice, setIndice] = useState<IndiceArchivo | null>(null)
  const [cargados, setCargados] = useState<Record<string, Nota[]>>({})
  const [cargando, setCargando] = useState(false)
  useTitulo(diaElegido ? `Noticias del ${nombreDia(diaElegido)}` : 'Lo último')

  useEffect(() => {
    cargarIndice().then(setIndice)
  }, [])
  // Un día elegido (?dia=AAAA-MM-DD) se baja del archivo.
  useEffect(() => {
    if (!diaElegido || cargados[diaElegido]) return
    setCargando(true)
    cargarDia(diaElegido).then((n) => {
      setCargados((c) => ({ ...c, [diaElegido]: n }))
      setCargando(false)
    })
  }, [diaElegido, cargados])

  if (error) return <ErrorCarga error={error} />
  if (!hoy || (diaElegido && !cargados[diaElegido])) return <Esqueleto />

  const diasArchivo = indice?.dias ?? []
  // El primer día del archivo es el de hoy (ya está en la portada); los demás se cargan de a uno.
  const anteriores = diasArchivo.slice(1).map((d) => d.dia)
  const siguiente = anteriores.find((d) => !cargados[d])
  const notas = diaElegido
    ? cargados[diaElegido]
    : unirNotas(hoy, ...anteriores.filter((d) => cargados[d]).map((d) => cargados[d]))
  const presentes = SECCIONES.filter((s) => notas.some((n) => n.seccion === s.clave))
  const visibles = filtro === 'todas' ? notas : notas.filter((n) => n.seccion === filtro)
  const cargarAnterior = () => {
    if (!siguiente) return
    setCargando(true)
    cargarDia(siguiente).then((n) => {
      setCargados((c) => ({ ...c, [siguiente]: n }))
      setCargando(false)
    })
  }
  return (
    <PaginaLR className="listado-lr lo-ultimo">
      <CabeceraLR
        titulo={diaElegido ? 'Archivo' : 'Lo último'}
        descripcion={diaElegido ? `Noticias del ${nombreDia(diaElegido)}.` : 'Todas las noticias, en orden de publicación.'}
        color="var(--alerta)"
      >
        {diasArchivo.length > 1 && (
          <div className="lri-archivo">
            <label htmlFor="dia-archivo">Archivo por día</label>
            <select
              id="dia-archivo"
              value={diaElegido}
              onChange={(e) => {
                setFiltro('todas')
                setParams(e.target.value ? { dia: e.target.value } : {})
              }}
            >
              <option value="">Lo último (todos los días)</option>
              {diasArchivo.map((d) => (
                <option key={d.dia} value={d.dia}>{nombreDia(d.dia).replace(/^./, (c) => c.toUpperCase())} ({d.n})</option>
              ))}
            </select>
          </div>
        )}
        <div className="chips-check lri-filtros" role="group" aria-label="Filtrar por sección">
          <button className={`chip${filtro === 'todas' ? ' chip--activo' : ''}`} aria-pressed={filtro === 'todas'} onClick={() => setFiltro('todas')}>Todas ({notas.length})</button>
          {presentes.map((s) => (
            <button key={s.clave} className={`chip${filtro === s.clave ? ' chip--activo' : ''}`} aria-pressed={filtro === s.clave} onClick={() => setFiltro(s.clave)}>
              {s.nombre} ({notas.filter((n) => n.seccion === s.clave).length})
            </button>
          ))}
        </div>
      </CabeceraLR>
      <div className="lri-cols">
        <div className="lri-principal">
          <FeedLR key={`${filtro}-${diaElegido}`} notas={visibles} titulo="" porDia vacio="No hay noticias con este filtro." />
          {!diaElegido && siguiente && (
            <div className="lri-feed__mas">
              <button className="lri-boton lri-boton--secundario" onClick={cargarAnterior} disabled={cargando}>
                {cargando ? 'Cargando…' : `Ver noticias del ${nombreDia(siguiente)}`}
              </button>
            </div>
          )}
        </div>
        <RailLR todas={hoy} excluir={visibles.slice(0, 12).map((n) => n.id)} />
      </div>
    </PaginaLR>
  )
}

export function Buscar() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [texto, setTexto] = useState(q)
  const { notas, error } = useNotas()
  // La búsqueda puede llegar por la URL (barra de tendencias, cabecera, enlaces compartidos): el campo la sigue.
  useEffect(() => {
    setTexto(q)
  }, [q])
  useTitulo(q ? `Resultados para "${q}"` : 'Buscar')
  if (error) return <ErrorCarga error={error} />
  if (!notas) return <Esqueleto />
  const res = buscar(notas, q)
  return (
    <PaginaLR className="listado-lr">
      <CabeceraLR titulo="Buscar" color="var(--azul)">
        <form className="buscador buscador--pagina" role="search" onSubmit={(e) => { e.preventDefault(); setParams(texto.trim() ? { q: texto.trim() } : {}) }}>
          <label htmlFor="qp" className="sr-only">Buscar noticias</label>
          <input id="qp" type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Juliaca, Sunat, Candelaria, UNA Puno…" />
          <button className="btn btn--azul" type="submit">Buscar</button>
        </form>
        {q && <p className="lri-cab__desc" role="status">{res.length} resultado{res.length === 1 ? '' : 's'} para «{q}»</p>}
      </CabeceraLR>
      <div className="lri-cols">
        <div className="lri-principal">
          <FeedLR key={q} notas={res} titulo={q && res.length ? 'Resultados' : ''} />
          {q && !res.length && <p className="vacio">No encontramos noticias con esas palabras. Prueba con otro término.</p>}
        </div>
        <RailLR todas={notas} />
      </div>
    </PaginaLR>
  )
}
