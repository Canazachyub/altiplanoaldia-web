import { createContext, useContext } from 'react'
import { Link } from 'react-router-dom'
import type { Nota } from '../data/noticias'
import { haceCuanto, hora, tiempo } from '../data/noticias'
import { Antetitulo, ImagenNota, Meta, varTema } from './Piezas'

/**
 * Variantes de portada tipo La República (estilos en src/styles/portada-lr.css):
 * - `lr-apertura`: texto a la izquierda, foto grande a la derecha.
 * - `lr-izq`: miniatura a la izquierda, titular a la derecha.
 * - `lr-fila`: titular a la izquierda, miniatura a la derecha.
 * - `lr-foto`: foto arriba, titular (y bajada opcional) debajo.
 * - `lr-texto`: solo titular y metadatos.
 */
export type VarianteLR = 'lr-apertura' | 'lr-izq' | 'lr-fila' | 'lr-foto' | 'lr-texto'
export type Variante = 'apertura' | 'destacada' | 'normal' | 'horizontal' | 'lista' | 'numerada' | 'hora' | VarianteLR

interface Props {
  nota: Nota
  variante?: Variante
  numero?: number
  nivel?: 'h2' | 'h3'
  prioridad?: boolean
  /** Solo variantes lr-: muestra la bajada. */
  bajada?: boolean
  /** Solo variantes lr-: muestra el antetítulo (sección · ámbito). */
  antetitulo?: boolean
  /** Solo variantes lr-: firma de la redacción. */
  firma?: boolean
}

/**
 * Hora (ms) de la nota más nueva del conjunto. Si una página la provee, las tarjetas lr-* marcan
 * "NUEVO" (≤ 3 h de esa nota) y la apertura "ÚLTIMA HORA" (≤ 1 h). Se mide contra la nota más nueva
 * y no contra la hora actual porque los datos pueden tener días.
 */
export const ReferenciaFrescura = createContext<{ tope: number; desde: number } | null>(null)

const H1 = 3_600_000
/** Referencia de frescura: la nota más nueva y el corte (≤ 3 h y solo las `max` más recientes). */
export function referenciaFrescura(tiempos: number[], max = 5) {
  const orden = [...tiempos].sort((a, b) => b - a)
  const tope = orden[0] ?? 0
  return { tope, desde: Math.max(tope - 3 * H1, orden[Math.min(max, orden.length) - 1] ?? tope) }
}

function Frescura({ nota, apertura }: { nota: Nota; apertura: boolean }) {
  const ref = useContext(ReferenciaFrescura)
  if (ref == null || !nota.fecha) return null
  const t = tiempo(nota)
  const dif = ref.tope - t
  if (dif < 0 || t < ref.desde) return null
  if (apertura && dif <= H1) return <span className="lr-fresca lr-fresca--urgente">Última hora</span>
  return <span className="lr-fresca">Nuevo</span>
}

function TarjetaLR({ nota, variante, nivel = 'h3', prioridad, bajada, antetitulo, firma }: Props & { variante: VarianteLR }) {
  const H = nivel
  const url = `/nota/${nota.slug}`
  const firmaTxt = firma ? 'Por Redacción Altiplano al Día' : ''
  return (
    <article className={`lr-t lr-t--${variante.slice(3)}`} style={varTema(nota.tema)}>
      {variante !== 'lr-texto' && (
        <Link to={url} className="lr-t__media" tabIndex={-1} aria-hidden="true">
          <ImagenNota nota={nota} prioridad={prioridad} />
        </Link>
      )}
      <div className="lr-t__texto">
        <Frescura nota={nota} apertura={variante === 'lr-apertura'} />
        {antetitulo && <Antetitulo nota={nota} />}
        <H className="lr-t__titular">
          <Link to={url}>{nota.titular}</Link>
        </H>
        {bajada && nota.bajada && <p className="lr-t__bajada">{nota.bajada}</p>}
        {firmaTxt && <p className="lr-t__firma">{firmaTxt}</p>}
        <p className="lr-t__meta">
          <time dateTime={nota.fecha ?? undefined}>{haceCuanto(nota.fecha)}</time>
        </p>
      </div>
    </article>
  )
}

export default function Tarjeta(props: Props) {
  const { nota, variante = 'normal', numero, nivel = 'h3', prioridad } = props
  if (variante.startsWith('lr-')) return <TarjetaLR {...props} variante={variante as VarianteLR} />
  const H = nivel
  const url = `/nota/${nota.slug}`
  const conImagen = ['apertura', 'destacada', 'normal', 'horizontal'].includes(variante)
  const conBajada = variante === 'apertura' || variante === 'destacada'

  return (
    <article className={`tarjeta tarjeta--${variante}`} style={varTema(nota.tema)}>
      {variante === 'numerada' && <span className="tarjeta__numero" aria-hidden="true">{numero}</span>}
      {variante === 'hora' && (
        <time className="tarjeta__hora" dateTime={nota.fecha ?? undefined}>{hora(nota.fecha)}</time>
      )}
      {conImagen && (
        <Link to={url} className="tarjeta__media" tabIndex={-1} aria-hidden="true">
          <ImagenNota nota={nota} prioridad={prioridad} />
        </Link>
      )}
      <div className="tarjeta__texto">
        {variante !== 'hora' && <Antetitulo nota={nota} />}
        <H className="tarjeta__titular">
          <Link to={url}>{nota.titular}</Link>
        </H>
        {conBajada && nota.bajada && <p className="tarjeta__bajada">{nota.bajada}</p>}
        {variante !== 'hora' && variante !== 'numerada' && <Meta nota={nota} />}
      </div>
    </article>
  )
}
