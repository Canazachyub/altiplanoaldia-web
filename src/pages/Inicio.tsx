// Portada con la disposición de notas tipo larepublica.pe, con la identidad de Altiplano al Día.
// Estilos: src/styles/portada-lr.css (clases lr-*). Ninguna nota se repite en la página (`usadas`).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CajaBoletin } from '../components/Bloques'
import { IcoFlecha, IcoMegafono, IcoWhatsapp } from '../components/Iconos'
import { ErrorCarga, ImagenNota, varTema } from '../components/Piezas'
import Tarjeta, { ReferenciaFrescura, referenciaFrescura } from '../components/Tarjeta'
import { PROVINCIAS } from '../config/provincias'
import { SECCIONES, SITIO, enlaceWhatsApp, type Seccion } from '../config/sitio'
import { haceCuanto, masLeidas, ordenarPortada, provinciasDe, tiempo, useNotas, type Nota as NotaT } from '../data/noticias'
import { useTitulo } from '../hooks/useTitulo'
import { TarjetaEdicion } from './Mas'

/** Encabezado de módulo: texto con barra corta de color, filete fino a todo el ancho y chevrón. */
function LrTitulo({ titulo, enlace, color }: { titulo: string; enlace?: string; color?: string }) {
  return (
    <div className="lr-titulo" style={color ? ({ '--tema': color } as CSSProperties) : undefined}>
      <h2>
        {enlace ? (
          <Link to={enlace}>
            {titulo} <IcoFlecha size={18} className="lr-titulo__chevron" />
          </Link>
        ) : (
          titulo
        )}
      </h2>
    </div>
  )
}

function Panel({ etiqueta, className = '', children }: { etiqueta: string; className?: string; children: ReactNode }) {
  return (
    <section className={`lr-panel ${className}`} aria-label={etiqueta}>
      {children}
    </section>
  )
}

/** Caja de solo texto (el "Editorial" de LR): la nota del día de la redacción. */
function NotaDelDia({ nota }: { nota: NotaT }) {
  return (
    <article className="lr-contraste" style={varTema(nota.tema)}>
      <p className="lr-contraste__kicker">
        <span className="lr-pill lr-pill--marca">La nota del día</span>
      </p>
      <h2 className="lr-contraste__titular">
        <Link to={`/nota/${nota.slug}`}>{nota.titular}</Link>
      </h2>
      {nota.bajada && <p className="lr-contraste__bajada">{nota.bajada}</p>}
      <p className="lr-contraste__meta">Por {SITIO.firma}</p>
    </article>
  )
}

/** Franja promocional de la casa: denuncias por WhatsApp. */
function PromoDenuncia() {
  return (
    <aside className="lr-promo" aria-label="Haz tu denuncia">
      <p className="lr-promo__ante"><IcoMegafono size={18} /> Tu voz es noticia</p>
      <p className="lr-promo__texto">¿Viste algo que Puno debe saber? Envíanos tu denuncia con fotos o videos; protegemos tu identidad.</p>
      <a className="btn btn--amarillo" href={enlaceWhatsApp('Hola Altiplano al Día, quiero hacer una denuncia: ')} target="_blank" rel="noopener noreferrer">
        <IcoWhatsapp size={18} /> {SITIO.whatsappVisible}
      </a>
    </aside>
  )
}

/** Esqueleto de carga con la misma forma de la portada: apertura + riel + grilla. */
function EsqueletoPortada() {
  const linea = (w: string | number = '100%') => <span className="esq esq--linea" style={{ width: w }} />
  return (
    <div className="lr-portada" role="status" aria-label="Cargando noticias">
      <div className="contenedor lr-portada__in lr-esq">
        <div className="lr-apertura">
          <div className="lr-apertura__principal">
            <div className="lr-panel">
              <div className="lr-esq__apertura">
                <div>
                  {linea(120)}
                  <span className="esq esq--titulo" />
                  <span className="esq esq--titulo" style={{ width: '75%' }} />
                  {linea()}
                  {linea('85%')}
                </div>
                <span className="esq esq--media" />
              </div>
              <div className="lr-filas2">
                {[1, 2].map((i) => (
                  <div key={i} className="lr-esq__fila">
                    <span className="esq esq--media" />
                    <div>{linea()}{linea('70%')}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="lr-panel lr-grid3">
              {[1, 2, 3].map((i) => <div key={i}><span className="esq esq--media" />{linea()}{linea('60%')}</div>)}
            </div>
          </div>
          <div className="lr-panel lr-rail">
            {linea(160)}
            <span className="esq esq--media" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="lr-esq__fila lr-esq__fila--der">
                <div>{linea()}{linea('65%')}</div>
                <span className="esq esq--media" />
              </div>
            ))}
          </div>
        </div>
        <div className="lr-panel lr-grid4">
          {[1, 2, 3, 4].map((i) => <div key={i}><span className="esq esq--media" />{linea()}{linea('55%')}</div>)}
        </div>
      </div>
    </div>
  )
}

/** Riel fijo en escritorio: se pega bajo la cabecera; si es más alto que la ventana, se pega por su borde inferior. */
const TOPE_CABECERA = 112
function useRielFijo(listo: boolean) {
  const ref = useRef<HTMLElement>(null)
  const [top, setTop] = useState<number | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => {
      const principal = el.parentElement?.firstElementChild as HTMLElement | null
      const sirve = window.innerWidth > 1024 && !!principal && principal !== el && el.offsetHeight < principal.offsetHeight
      setTop(sirve ? Math.min(TOPE_CABECERA, window.innerHeight - el.offsetHeight - 16) : null)
    }
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(el)
    if (el.parentElement?.firstElementChild) ro?.observe(el.parentElement.firstElementChild)
    window.addEventListener('resize', medir)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [listo])
  return [ref, top] as const
}

const PASO_MAS = 8

type Bloque = { s: Seccion; ns: NotaT[] }
type Modulo = { tipo: 'lista' | 'tres' | 'par' | 'dos'; bloques: Bloque[] }

/** Patrón "Política" de LR: grande a la izquierda + 3 filas con miniatura a la derecha. */
function ModuloLista({ b }: { b: Bloque }) {
  const [p, ...r] = b.ns
  return (
    <Panel etiqueta={b.s.nombre} className="lr-modulo">
      <LrTitulo titulo={b.s.nombre} enlace={`/seccion/${b.s.clave}`} color={b.s.color} />
      <div className="lr-lista">
        <Tarjeta nota={p} variante="lr-foto" firma />
        <div className="lr-reglas">
          {r.map((n) => <Tarjeta key={n.id} nota={n} variante="lr-fila" />)}
        </div>
      </div>
    </Panel>
  )
}

/** Patrón "Economía" de LR: 3 tarjetas con foto y bajada + columna de titulares sin foto. */
function ModuloTres({ b }: { b: Bloque }) {
  // las tarjetas con foto solo para notas con foto; las demás van como titulares
  const fotos = b.ns.filter((n) => !!n.imagen).slice(0, 3)
  const textos = b.ns.filter((n) => !fotos.includes(n))
  return (
    <Panel etiqueta={b.s.nombre} className="lr-modulo">
      <LrTitulo titulo={b.s.nombre} enlace={`/seccion/${b.s.clave}`} color={b.s.color} />
      <div className="lr-tres">
        {fotos.map((n) => <Tarjeta key={n.id} nota={n} variante="lr-foto" bajada />)}
        {textos.length > 0 && (
          <div className="lr-reglas">
            {textos.map((n) => <Tarjeta key={n.id} nota={n} variante="lr-texto" />)}
          </div>
        )}
      </div>
    </Panel>
  )
}

/** Patrón "Mundo + Sociedad" de LR: media sección con foto + titulares sin foto. */
function MedioModulo({ b }: { b: Bloque }) {
  const [p, ...r] = b.ns
  return (
    <Panel etiqueta={b.s.nombre} className="lr-modulo">
      <LrTitulo titulo={b.s.nombre} enlace={`/seccion/${b.s.clave}`} color={b.s.color} />
      <div className="lr-mitad">
        <Tarjeta nota={p} variante="lr-foto" bajada />
        {r.length > 0 && (
          <div className="lr-reglas">
            {r.map((n) => <Tarjeta key={n.id} nota={n} variante="lr-texto" />)}
          </div>
        )}
      </div>
    </Panel>
  )
}

/** Patrón "Deportes" de LR: grande a la izquierda + 2 tarjetas con foto. */
function ModuloDos({ b }: { b: Bloque }) {
  const [p, ...r] = b.ns
  return (
    <Panel etiqueta={b.s.nombre} className="lr-modulo">
      <LrTitulo titulo={b.s.nombre} enlace={`/seccion/${b.s.clave}`} color={b.s.color} />
      <div className="lr-dos">
        <Tarjeta nota={p} variante="lr-foto" bajada firma />
        {r.map((n) => <Tarjeta key={n.id} nota={n} variante={n.imagen ? 'lr-foto' : 'lr-texto'} />)}
      </div>
    </Panel>
  )
}

/** Primero las notas con foto (orden estable): los lugares con foto nunca quedan con el dibujo de relleno. */
const fotoPrimero = (ns: NotaT[]) => [...ns].sort((a, b) => Number(!!b.imagen) - Number(!!a.imagen))

export default function Inicio() {
  const { notas, error } = useNotas()
  const [visiblesMas, setVisiblesMas] = useState(PASO_MAS)
  const [rielRef, rielTop] = useRielFijo(!!notas?.length)
  useTitulo()
  if (error) return <ErrorCarga error={error} />
  if (!notas) return <EsqueletoPortada />
  if (!notas.length) return <p className="contenedor vacio">Aún no hay noticias publicadas.</p>

  const orden = ordenarPortada(notas)
  const usadas = new Set<number>()
  const libres = (filtro: (n: NotaT) => boolean = () => true, fuente: NotaT[] = orden) =>
    fuente.filter((n) => !usadas.has(n.id) && filtro(n))
  const tomar = (filtro: (n: NotaT) => boolean, k: number, fuente: NotaT[] = orden) => {
    const r = libres(filtro, fuente).slice(0, k)
    r.forEach((n) => usadas.add(n.id))
    return r
  }

  // 1. Banda superior (orden editorial) + riel de últimas (orden cronológico)
  const apertura = tomar((n) => !!n.imagen, 1)[0] ?? tomar(() => true, 1)[0]
  const filas = tomar((n) => !!n.imagen, 2)
  const delDia = tomar((n) => !!n.bajada, 1)[0] ?? null
  const destacados = tomar((n) => !!n.imagen, 6)
  // `notas` ya viene de la más nueva a la más antigua; la primera del riel lleva foto
  const [ultima, ...ultimasResto] = fotoPrimero(tomar(() => true, 7, notas))

  // 2. Grilla automática (el "AutomaticGrid" de LR): 8 notas con foto
  const grilla = tomar((n) => !!n.imagen, 8)

  // 3. Banda oscura (el "LR+" de LR): lo más leído
  const leidas = masLeidas(libres((n) => !!n.imagen), 8)
  leidas.forEach((n) => usadas.add(n.id))

  // 4. Dos notas grandes
  const grandes = tomar((n) => !!n.imagen && !!n.bajada, 2)

  // 5. Provincias (el "Columnistas" de LR): una nota por provincia, la provincia hace de antetítulo
  const provDe = (n: NotaT) => provinciasDe(n, PROVINCIAS)
  const provincias: { nombre: string; clave: string; nota: NotaT }[] = []
  for (const p of PROVINCIAS) {
    if (provincias.length >= 8) break
    const n = libres((x) => provDe(x)[0] === p.clave)[0] ?? libres((x) => provDe(x).includes(p.clave))[0]
    if (n) { usadas.add(n.id); provincias.push({ nombre: p.nombre, clave: p.clave, nota: n }) }
  }

  // 6. Módulos por sección, rotando los patrones de LR; se saltan las secciones con pocas notas
  const disponibles = (clave: string) => libres((n) => n.seccion === clave).length
  const patrones: { tipo: Modulo['tipo']; min: number; max: number }[] = [
    { tipo: 'lista', min: 3, max: 4 },
    { tipo: 'tres', min: 4, max: 6 },
    { tipo: 'par', min: 2, max: 4 },
    { tipo: 'dos', min: 3, max: 3 },
  ]
  let cola = [...SECCIONES]
  const modulos: Modulo[] = []
  for (let i = 0, fallos = 0; cola.length && fallos < patrones.length; i++) {
    const p = patrones[i % patrones.length]
    const aptas = cola
      .filter((s) => disponibles(s.clave) >= p.min)
      .sort((a, b) => disponibles(b.clave) - disponibles(a.clave))
      .slice(0, p.tipo === 'par' ? 2 : 1)
    if (!aptas.length || (p.tipo === 'par' && aptas.length < 2)) {
      fallos++
      continue
    }
    fallos = 0
    modulos.push({ tipo: p.tipo, bloques: aptas.map((s) => ({ s, ns: fotoPrimero(tomar((n) => n.seccion === s.clave, p.max)) })) })
    cola = cola.filter((s) => !aptas.includes(s))
  }

  const restoTodo = fotoPrimero(libres())
  const resto = restoTodo.slice(0, visiblesMas)
  const restoFotos = resto.filter((n) => !!n.imagen)
  const restoTextos = resto.filter((n) => !n.imagen)
  const quedan = restoTodo.length - resto.length
  const frescura = referenciaFrescura(notas.map(tiempo))

  return (
    <ReferenciaFrescura.Provider value={frescura}>
    <div className="lr-portada">
      <div className="contenedor lr-portada__in">
        <h1 className="sr-only">Altiplano al Día: noticias de Puno y la región</h1>

        {/* 1. Apertura + Últimas noticias */}
        <div className="lr-apertura">
          <div className="lr-apertura__principal">
            <section className="lr-panel" aria-label="Noticias principales">
              <Tarjeta nota={apertura} variante="lr-apertura" nivel="h2" prioridad bajada antetitulo firma />
              {filas.length > 0 && (
                <div className="lr-filas2">
                  {filas.map((n) => <Tarjeta key={n.id} nota={n} variante="lr-izq" nivel="h2" prioridad firma />)}
                </div>
              )}
            </section>

            {delDia && <NotaDelDia nota={delDia} />}

            <PromoDenuncia />

            {destacados.length > 0 && (
              <Panel etiqueta="Destacados">
                <LrTitulo titulo="Destacados" />
                <div className="lr-grid3">
                  {destacados.map((n) => <Tarjeta key={n.id} nota={n} variante="lr-foto" />)}
                </div>
              </Panel>
            )}
          </div>

          {ultima && (
            <aside
              ref={rielRef}
              className={`lr-panel lr-rail${rielTop != null ? ' lr-rail--fijo' : ''}`}
              style={rielTop != null ? ({ '--lr-rail-top': `${rielTop}px` } as CSSProperties) : undefined}
              aria-label="Últimas noticias"
            >
              <LrTitulo titulo="Últimas noticias" enlace="/lo-ultimo" color="var(--alerta)" />
              <Tarjeta nota={ultima} variante="lr-foto" />
              <ul className="lr-reglas">
                {ultimasResto.map((n) => (
                  <li key={n.id}><Tarjeta nota={n} variante="lr-fila" /></li>
                ))}
              </ul>
            </aside>
          )}
        </div>

        {/* 2. Grilla automática */}
        {grilla.length > 0 && (
          <Panel etiqueta="Lo último en Puno" className="lr-modulo">
            <LrTitulo titulo="Lo último en Puno" enlace="/lo-ultimo" />
            <div className="lr-grid4">
              {grilla.map((n) => <Tarjeta key={n.id} nota={n} variante="lr-foto" firma />)}
            </div>
          </Panel>
        )}

        {/* 3. Banda oscura: lo más leído */}
        {leidas.length > 0 && (
          <section className="lr-oscuro" aria-label="Lo más leído">
            <LrTitulo titulo="Lo más leído" />
            <ol className="lr-oscuro__grid">
              {leidas.map((n, i) => (
                <li key={n.id} className="lr-oscuro__item">
                  <Link to={`/nota/${n.slug}`} className="lr-oscuro__media" tabIndex={-1} aria-hidden="true">
                    <ImagenNota nota={n} />
                    <span className="lr-oscuro__n">{i + 1}</span>
                  </Link>
                  <h3 className="lr-oscuro__titular"><Link to={`/nota/${n.slug}`}>{n.titular}</Link></h3>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* 4. Dos notas grandes */}
        {grandes.length > 0 && (
          <Panel etiqueta="Informes" className="lr-modulo">
            <LrTitulo titulo="Informes" />
            <div className="lr-grandes">
              {grandes.map((n) => <Tarjeta key={n.id} nota={n} variante="lr-foto" bajada firma />)}
            </div>
          </Panel>
        )}

        {/* 5. Provincias (como "Columnistas") */}
        {provincias.length > 0 && (
          <Panel etiqueta="Provincias" className="lr-modulo">
            <LrTitulo titulo="Provincias" enlace="/provincias" />
            <ul className="lr-col" style={{ '--lr-col-n': Math.min(4, provincias.length) } as CSSProperties}>
              {provincias.map(({ nombre, clave, nota }) => (
                <li key={clave} className="lr-col__item">
                  <Link to={`/provincia/${clave}`} className="lr-col__ante">{nombre}</Link>
                  <h3 className="lr-col__titular"><Link to={`/nota/${nota.slug}`}>{nota.titular}</Link></h3>
                  <p className="lr-col__meta">{haceCuanto(nota.fecha)}</p>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {/* 6. Secciones */}
        {modulos.map((m) =>
          m.tipo === 'par' ? (
            <div key={m.bloques.map((b) => b.s.clave).join('-')} className="lr-par">
              {m.bloques.map((b) => <MedioModulo key={b.s.clave} b={b} />)}
            </div>
          ) : m.tipo === 'lista' ? (
            <ModuloLista key={m.bloques[0].s.clave} b={m.bloques[0]} />
          ) : m.tipo === 'tres' ? (
            <ModuloTres key={m.bloques[0].s.clave} b={m.bloques[0]} />
          ) : (
            <ModuloDos key={m.bloques[0].s.clave} b={m.bloques[0]} />
          ),
        )}

        <div className="lr-fila-impresa">
          <Panel etiqueta="Edición en PDF" className="lr-modulo lr-impresa">
            <LrTitulo titulo="Edición en PDF" enlace="/ediciones" />
            <TarjetaEdicion />
          </Panel>
          <Panel etiqueta="Boletín" className="lr-modulo lr-impresa">
            <LrTitulo titulo="Boletín" />
            <CajaBoletin />
          </Panel>
        </div>

        {resto.length > 0 && (
          <Panel etiqueta="Más noticias" className="lr-modulo">
            <LrTitulo titulo="Más noticias" enlace="/lo-ultimo" />
            {restoFotos.length > 0 && (
              <div className="lr-grid4">
                {restoFotos.map((n) => <Tarjeta key={n.id} nota={n} variante="lr-foto" />)}
              </div>
            )}
            {restoTextos.length > 0 && (
              <div className="lr-reglas lr-reglas--columnas">
                {restoTextos.map((n) => <Tarjeta key={n.id} nota={n} variante="lr-texto" />)}
              </div>
            )}
            <div className="lr-mas">
              {quedan > 0 ? (
                <button type="button" className="btn btn--contorno" onClick={() => setVisiblesMas((v) => v + PASO_MAS)}>
                  Ver más noticias <span className="lr-mas__n">({quedan})</span>
                </button>
              ) : (
                <Link to="/lo-ultimo" className="btn btn--contorno">
                  Ver todas en Lo último <IcoFlecha size={16} />
                </Link>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
    </ReferenciaFrescura.Provider>
  )
}
