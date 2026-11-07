// Página de nota con la disposición tipo La República: columna principal + columna derecha fija.
import { Fragment, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BannerDenuncia, Compartir, textoCompartir } from '../components/Bloques'
import { BotonGuardar, BotonHistoria, DatosEstructurados, Escuchar, Esqueleto } from '../components/Extras'
import { EtiquetasLR, MediaNotaLR, PaginaLR, PuedesVerLR, RailLR, RelacionadasLR, ResumenLR, SiguienteLR, fechaLR, resumenDe } from '../components/Interiores'
import { ErrorCarga, varTema } from '../components/Piezas'
import { SITIO, ambitoPorValor, pub, seccionPorTema } from '../config/sitio'
import { cargarDia, cargarIndice, minutosLectura, notaDelArchivo, registrarLectura, relacionadas, unirNotas, useNotas, type Nota as NotaT } from '../data/noticias'
import { useTitulo } from '../hooks/useTitulo'
import NoEncontrado from './NoEncontrado'

function BarraLectura() {
  const [p, setP] = useState(0)
  useEffect(() => {
    const f = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight
      setP(h > 0 ? Math.min(1, window.scrollY / h) : 0)
    }
    f()
    window.addEventListener('scroll', f, { passive: true })
    return () => window.removeEventListener('scroll', f)
  }, [])
  return <div className="barra-lectura" style={{ transform: `scaleX(${p})` }} aria-hidden="true" />
}

const TAMANOS = [16, 17, 19, 21, 23]
/** "Puedes ver" se inserta tras estos párrafos (índice 1 = después del 2.º), si el cuerpo sigue después. */
const PUEDES_VER_TRAS = [1, 4]

export default function Nota() {
  const { slug } = useParams()
  const { notas: hoy, error } = useNotas()
  const deHoy = hoy?.find((n) => n.slug === slug)
  // Nota de otro día: se busca en el archivo (enlaces viejos, Google, publicaciones compartidas).
  const [archivada, setArchivada] = useState<{ slug?: string; nota: NotaT | null; dia: NotaT[] } | null>(null)
  useEffect(() => {
    if (!hoy || deHoy || !slug) return
    let vivo = true
    notaDelArchivo(slug).then(async (n) => {
      const dia = n ? await cargarIndice().then((i) => cargarDia(i.slugs[slug])) : []
      if (vivo) setArchivada({ slug, nota: n, dia })
    })
    return () => {
      vivo = false
    }
  }, [hoy, deHoy, slug])
  const buscando = !!hoy && !deHoy && archivada?.slug !== slug
  const arch = archivada && archivada.slug === slug ? archivada : null
  const nota = deHoy ?? arch?.nota ?? undefined
  const notas = hoy && !deHoy && arch ? unirNotas(hoy, arch.dia) : hoy
  const [tam, setTam] = useState(() => {
    try {
      return Number(localStorage.getItem('aad-tam')) || 2
    } catch {
      return 2
    }
  })
  const [resumen, setResumen] = useState(false)
  useTitulo(nota?.titular)

  // Cada nota abre con el resumen plegado.
  useEffect(() => {
    setResumen(false)
  }, [nota?.id])

  useEffect(() => {
    if (nota) registrarLectura(nota.id)
  }, [nota])

  useEffect(() => {
    try {
      localStorage.setItem('aad-tam', String(tam))
    } catch {
      /* sin almacenamiento */
    }
  }, [tam])

  if (error) return <ErrorCarga error={error} />
  if (!notas || buscando) return <Esqueleto variante="nota" />
  if (!nota) return <NoEncontrado />

  const s = seccionPorTema(nota.tema)
  const a = ambitoPorValor(nota.ambito)
  // Enlace limpio (sin ?fbclid ni #…) para compartir; el texto lleva hashtags, resumen y enlace.
  const url = `${window.location.origin}/nota/${nota.slug}`
  const publicacion = textoCompartir(nota, url, s.nombre)
  const idx = notas.indexOf(nota)
  const puntos = resumenDe(nota)

  // "Siguiente nota": la próxima (más antigua) de la misma sección; si no hay, la más reciente de la sección
  // y, en último caso, la siguiente del sitio.
  const siguiente =
    notas.slice(idx + 1).find((n) => n.seccion === nota.seccion) ??
    notas.find((n) => n.seccion === nota.seccion && n.id !== nota.id) ??
    notas[idx + 1] ??
    notas[idx - 1]

  // "Puedes ver" (dentro del cuerpo) y "Notas relacionadas" (al final) salen de la misma lista, sin repetir
  // ni repetir la "Siguiente nota".
  const huecos = PUEDES_VER_TRAS.filter((i) => i < nota.cuerpo.length - 1)
  const candidatas = siguiente ? notas.filter((n) => n.id !== siguiente.id) : notas
  const rel = relacionadas(nota, candidatas, huecos.length + 3)
  const puedesVer = new Map(huecos.map((i, k) => [i, rel[k]] as const).filter(([, n]) => !!n))
  const alFinal = rel.slice(puedesVer.size, puedesVer.size + 3)
  const excluirRail = [nota.id, ...rel.map((n) => n.id), ...(siguiente ? [siguiente.id] : [])]

  return (
    <>
      <BarraLectura />
      <DatosEstructurados nota={nota} />
      <PaginaLR className="nota-pagina lri-nota-pagina" style={varTema(nota.tema)}>
        <nav className="migas" aria-label="Ruta">
          <Link to="/">Portada</Link> <span aria-hidden="true">›</span> <Link to={`/seccion/${s.clave}`}>{s.nombre}</Link>
          {a && (<> <span aria-hidden="true">›</span> <Link to={`/ambito/${a.clave}`}>{a.nombre}</Link></>)}
        </nav>

        <div className="lri-cols">
          <div className="lri-principal">
            <article className="nota lri-nota">
              <header className="lri-nota__cab">
                <p className="lri-nota__kicker"><Link to={`/seccion/${s.clave}`}>{s.nombre}</Link></p>
                <h1 className="nota__titular lri-nota__titular">{nota.titular}</h1>
                {nota.bajada && <p className="nota__bajada lri-nota__bajada">{nota.bajada}</p>}
              </header>

              <MediaNotaLR key={nota.id} nota={nota} />

              <div className="lri-nota__firma">
                <img src={pub('brand/isotipo.svg')} alt="" width="36" height="36" />
                <div>
                  <p className="lri-nota__autor">Por {SITIO.firma}</p>
                  <p className="lri-nota__fecha">
                    <time dateTime={nota.fecha ?? undefined}>{fechaLR(nota.fecha)}</time>
                    <span aria-hidden="true"> · </span>{minutosLectura(nota)} min de lectura
                  </p>
                </div>
              </div>

              <div className="lri-nota__herramientas">
                <div className="lri-nota__acciones">
                  {puntos.length > 0 && (
                    <button
                      type="button"
                      className={`btn-herramienta lri-btn-resumen${resumen ? ' btn-herramienta--activo' : ''}`}
                      aria-expanded={resumen}
                      aria-controls="lri-resumen"
                      onClick={() => setResumen((v) => !v)}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></svg>
                      Resumen
                    </button>
                  )}
                  <Escuchar nota={nota} />
                  <BotonGuardar nota={nota} />
                  <BotonHistoria nota={nota} />
                  {'share' in navigator && (
                    <button className="btn-herramienta" onClick={() => navigator.share({ title: nota.titular, text: publicacion.replace(/\n?➡️ Lee la nota aquí: .*$/, ''), url }).catch(() => {})}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
                      Compartir
                    </button>
                  )}
                </div>
                <div className="lri-nota__compartir">
                  <div className="tam-texto" role="group" aria-label="Tamaño del texto">
                    <button onClick={() => setTam((t) => Math.max(0, t - 1))} disabled={tam === 0} aria-label="Reducir texto">A−</button>
                    <button onClick={() => setTam((t) => Math.min(TAMANOS.length - 1, t + 1))} disabled={tam === TAMANOS.length - 1} aria-label="Agrandar texto">A+</button>
                  </div>
                  <Compartir url={url} titulo={nota.titular} texto={publicacion} />
                </div>
              </div>

              {puntos.length > 0 && <ResumenLR id="lri-resumen" items={puntos} abierto={resumen} />}

              <div className="lri-nota__zona">
                {/* Barra vertical de compartir, fija en el margen izquierdo (solo pantallas de 1280 px o más). */}
                <div className="lri-nota__rail-compartir">
                  <Compartir url={url} titulo={nota.titular} texto={publicacion} vertical />
                </div>

                <div className="nota__cuerpo lri-nota__cuerpo" style={{ fontSize: TAMANOS[tam] }}>
                  {nota.cuerpo.map((p, i) => {
                    const pv = puedesVer.get(i)
                    return (
                      <Fragment key={i}>
                        {p.startsWith('## ') ? (
                          <h2 className="nota__intertitulo">{p.slice(3)}</h2>
                        ) : (
                          <p className={i === 0 ? 'nota__primer' : undefined}>{p}</p>
                        )}
                        {pv && <PuedesVerLR nota={pv} />}
                      </Fragment>
                    )
                  })}

                  {nota.datos.length > 0 && (
                    <aside className="datos-clave" aria-label="Datos clave">
                      <h2>Datos clave</h2>
                      <ul>{nota.datos.map((d, i) => <li key={i}>{d}</li>)}</ul>
                    </aside>
                  )}



                  <EtiquetasLR nota={nota} />

                  {siguiente && <SiguienteLR nota={siguiente} />}

                  <BannerDenuncia compacto />
                </div>
              </div>
            </article>

            <RelacionadasLR notas={alFinal} />
          </div>

          <RailLR todas={notas} excluir={excluirRail} pegajoso />
        </div>
      </PaginaLR>
    </>
  )
}
