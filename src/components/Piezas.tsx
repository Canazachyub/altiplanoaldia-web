// Piezas pequeñas reutilizables: imagen con reemplazo, antetítulo, metadatos.
import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ambitoPorValor, pub, seccionPorTema } from '../config/sitio'
import { haceCuanto, type Nota } from '../data/noticias'

export const varTema = (tema: string) => ({ '--tema': seccionPorTema(tema).color }) as CSSProperties

/** Ilustración vectorial de marca: línea blanca sobre azul (chakana, nevados, lago) + ícono del tema. */
export function IlustracionMarca({ seccion, compacta = false }: { seccion: string; compacta?: boolean }) {
  const s = seccionPorTema(seccion) ?? undefined
  const icono = s?.icono ?? 'tema_otros'
  return (
    <div className={`ilus-marca${compacta ? ' ilus-marca--compacta' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" className="ilus-marca__fondo">
        <g fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" opacity=".9">
          <path d="M300 30h16v-8h16v8h16v16h8v16h-8v16h-16v8h-16v-8h-16v-16h-8v-16h8z" stroke="#FFEE00" />
          <circle cx="324" cy="54" r="14" stroke="#FFEE00" />
          <path d="M0 150l60-55 30 22 50-52 60 55 40-30 70 60 40-28 50 40" />
          <path d="M118 78l22-13 20 18M228 96l12-8 14 12" />
          <path d="M0 170c40-14 80-14 120 0s80 14 120 0 80-14 120 0 40 8 40 8" opacity=".7" />
          <path d="M0 188c40-12 80-12 120 0s80 12 120 0 80-12 120 0" opacity=".55" />
          <path d="M0 205c40-10 80-10 120 0s80 10 120 0 80-10 120 0" opacity=".4" />
          <path d="M40 196v-34M48 196l-4-30M32 196l4-28M360 200v-32M368 200l-4-28M352 200l4-26" opacity=".8" />
        </g>
      </svg>
      <img className="ilus-marca__icono" src={pub(`icons/${icono}_w.png`)} alt="" loading="lazy" />
    </div>
  )
}

/** Foto de la nota → ilustración IA de la sección (img/ia/<seccion>.png) → ilustración SVG de marca. */
export function ImagenNota({ nota, prioridad = false, conCredito = false }: { nota: Nota; prioridad?: boolean; conCredito?: boolean }) {
  const candidatos = [nota.imagen, `img/ia/${nota.seccion}.png`].filter(Boolean) as string[]
  // Se recuerdan las rutas que fallaron (no un índice), así un cambio de `nota` no hereda el estado.
  const [malas, setMalas] = useState<string[]>([])
  const [cargada, setCargada] = useState<string | null>(null)
  const src = candidatos.find((c) => !malas.includes(c))
  if (!src) return <IlustracionMarca seccion={nota.tema} />
  const esFoto = src === nota.imagen
  const fallar = () => setMalas((m) => (m.includes(src) ? m : [...m, src]))
  // Una imagen rota o vacía (0×0, p. ej. HTML servido como imagen) pasa al siguiente candidato.
  const revisar = (el: HTMLImageElement) => (el.naturalWidth > 0 ? setCargada(src) : fallar())
  return (
    <figure className={`img-nota${cargada === src ? '' : ' img-nota--cargando'}`}>
      <img
        key={src}
        ref={(el) => {
          // Si terminó (o falló) antes de que React enganchara onLoad/onError
          if (el?.complete && el.currentSrc && cargada !== src) revisar(el)
        }}
        src={pub(src)}
        alt={esFoto ? nota.titular : ''}
        loading={prioridad ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={(e) => revisar(e.currentTarget)}
        onError={fallar}
      />
      {conCredito && esFoto && <figcaption>{nota.titular}</figcaption>}
    </figure>
  )
}

export function Antetitulo({ nota, enlace = true }: { nota: Nota; enlace?: boolean }) {
  const s = seccionPorTema(nota.tema)
  const a = ambitoPorValor(nota.ambito)
  return (
    <p className="antetitulo" style={varTema(nota.tema)}>
      {enlace ? <Link to={`/seccion/${s.clave}`}>{s.nombre}</Link> : <span>{s.nombre}</span>}
      {a && (
        <>
          <span className="antetitulo__sep" aria-hidden="true">·</span>
          <span className="antetitulo__ambito">{a.nombre}</span>
        </>
      )}
    </p>
  )
}

export function Meta({ nota }: { nota: Nota }) {
  return (
    <p className="meta">
      <time dateTime={nota.fecha ?? undefined}>{haceCuanto(nota.fecha)}</time>
    </p>
  )
}

export function Cargando() {
  return (
    <div className="contenedor cargando" role="status">
      <span className="cargando__punto" />
      <span>Cargando noticias…</span>
    </div>
  )
}

export function ErrorCarga({ error }: { error: string }) {
  return (
    <div className="contenedor aviso-error" role="alert">
      <strong>No se pudieron cargar las noticias.</strong> {error}
    </div>
  )
}
