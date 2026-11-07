// Carga y consulta de las noticias exportadas del monitor (public/data/noticias.json).
import { useEffect, useState } from 'react'
import { pub } from '../config/sitio'

export interface Enlace {
  medio: string | null
  url: string
}

export interface Nota {
  id: number
  slug: string
  titular: string
  bajada: string
  cuerpo: string[]
  datos: string[]
  tema: string
  seccion: string
  ambito: string
  fecha: string | null
  medios: string[]
  fuentes: number
  imagen: string | null
  enlaces: Enlace[]
  aportes?: { medio: string; aporte: string }[]
  discrepancias?: { aspecto: string; versiones: { medio: string; dice: string }[] }[]
  boletin?: number | null
  fijada?: boolean
  /** Impacto 1-10 que calcula el maquetador (muertos, heridos, crimen y corrupción pesan más); 0 = sin evaluar. */
  impacto?: number
}

export interface Boletin {
  numero: number | null
  fecha: string
  hora: string | null
  noticias: number | null
  paginas: number | null
  archivo: string
  portada: string | null
  kb: number
}

const descargar = (fresco = false) =>
  fetch(pub('data/noticias.json'), fresco ? { cache: 'no-store' } : undefined)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<Nota[]>
    })
    .then((notas) => notas.sort((a, b) => tiempo(b) - tiempo(a)))

let cache: Promise<Nota[]> | null = null
const oyentes = new Set<(n: Nota[]) => void>()

export function cargarNotas(): Promise<Nota[]> {
  if (!cache) {
    cache = descargar().catch((e) => {
      cache = null
      throw e
    })
  }
  return cache
}

/** Consulta si hay notas nuevas sin aplicar el cambio. Devuelve la lista fresca. */
export const consultarNuevas = () => descargar(true)

/** Reemplaza las notas en memoria y avisa a todos los componentes que las usan. */
export function aplicarNotas(notas: Nota[]) {
  cache = Promise.resolve(notas)
  oyentes.forEach((f) => f(notas))
}

export function useNotas() {
  const [notas, setNotas] = useState<Nota[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let vivo = true
    cargarNotas()
      .then((n) => vivo && setNotas(n))
      .catch((e) => vivo && setError(String(e)))
    oyentes.add(setNotas)
    return () => {
      vivo = false
      oyentes.delete(setNotas)
    }
  }, [])
  return { notas, error }
}

export function useBoletines() {
  const [b, setB] = useState<Boletin[] | null>(null)
  useEffect(() => {
    fetch(pub('data/boletines.json'))
      .then((r) => (r.ok ? r.json() : []))
      .then(setB)
      .catch(() => setB([]))
  }, [])
  return b
}

// ===== Provincias =====
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const cacheProv = new Map<number, string[]>()

/** Claves de las provincias de Puno mencionadas en la nota. */
export function provinciasDe(n: Nota, provincias: { clave: string; palabras: string[] }[]) {
  const c = cacheProv.get(n.id)
  if (c) return c
  const texto = ` ${sinTildes([n.titular, n.bajada, ...n.cuerpo].join(' '))} `
  const r = provincias.filter((p) => p.palabras.some((w) => texto.includes(sinTildes(w)))).map((p) => p.clave)
  cacheProv.set(n.id, r)
  return r
}

// ===== Guardadas (por navegador) =====
const CLAVE_GUARDADAS = 'aad-guardadas'
const leerGuardadas = (): number[] => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_GUARDADAS) || '[]')
  } catch {
    return []
  }
}

export function useGuardadas() {
  const [ids, setIds] = useState<number[]>(leerGuardadas)
  useEffect(() => {
    const f = () => setIds(leerGuardadas())
    window.addEventListener('aad-guardadas', f)
    window.addEventListener('storage', f)
    return () => {
      window.removeEventListener('aad-guardadas', f)
      window.removeEventListener('storage', f)
    }
  }, [])
  const alternar = (id: number) => {
    const actual = leerGuardadas()
    const nuevo = actual.includes(id) ? actual.filter((x) => x !== id) : [id, ...actual]
    try {
      localStorage.setItem(CLAVE_GUARDADAS, JSON.stringify(nuevo))
    } catch {
      /* sin almacenamiento */
    }
    setIds(nuevo)
    window.dispatchEvent(new Event('aad-guardadas'))
  }
  return { ids, alternar, esta: (id: number) => ids.includes(id) }
}

export const slugMedio = (m: string) => sinTildes(m).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const tiempo = (n: Nota) => (n.fecha ? new Date(n.fecha).getTime() : 0)

/** Las fechas del monitor son hora de Puno (UTC-5) sin zona: se interpretan como locales. */
export function fechaLarga(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('es-PE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function hora(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function haceCuanto(iso: string | null, ahora = Date.now()) {
  if (!iso) return ''
  const min = Math.round((ahora - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'Hace un momento'
  if (min < 60) return `Hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `Hace ${h} h`
  const d = Math.round(h / 24)
  if (d < 7) return d === 1 ? 'Ayer' : `Hace ${d} días`
  return new Date(iso).toLocaleDateString('es-PE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const minutosLectura = (n: Nota) =>
  Math.max(1, Math.round(n.cuerpo.join(' ').split(/\s+/).length / 200))

/** Puntaje editorial para ordenar la portada (ver skill altiplano-editorial). */
export function puntaje(n: Nota, masReciente: number) {
  const horas = (masReciente - tiempo(n)) / 3_600_000
  let p = 100 - horas * 1.5
  p += (n.fuentes - 1) * 6
  if (n.imagen) p += 8
  if (['REGIONAL', 'DISTRITAL', 'LOCAL'].includes(n.ambito)) p += 6
  // El impacto manda dentro del día: un punto vale unas 5 h de antigüedad, así un choque con muertos
  // de la mañana (10) queda arriba de una nota menor de la noche (5).
  p += (n.impacto ?? 0) * 8
  if (n.fijada) p += 1000
  return p
}

export function ordenarPortada(notas: Nota[]) {
  const max = Math.max(...notas.map(tiempo))
  return [...notas].sort((a, b) => puntaje(b, max) - puntaje(a, max))
}

// "Lo más leído": lecturas reales en este navegador + peso por fuentes (sin servidor de analítica).
const CLAVE_LECTURAS = 'aad-lecturas'

export function registrarLectura(id: number) {
  try {
    const l = JSON.parse(localStorage.getItem(CLAVE_LECTURAS) || '{}')
    l[id] = (l[id] || 0) + 1
    localStorage.setItem(CLAVE_LECTURAS, JSON.stringify(l))
  } catch {
    /* almacenamiento no disponible */
  }
}

export function masLeidas(notas: Nota[], n = 5) {
  let l: Record<string, number> = {}
  try {
    l = JSON.parse(localStorage.getItem(CLAVE_LECTURAS) || '{}')
  } catch {
    /* sin almacenamiento */
  }
  return [...notas]
    .sort((a, b) => (l[b.id] || 0) * 10 + b.fuentes * 3 - ((l[a.id] || 0) * 10 + a.fuentes * 3) || tiempo(b) - tiempo(a))
    .slice(0, n)
}

export function relacionadas(nota: Nota, notas: Nota[], n = 4) {
  const palabras = new Set(nota.titular.toLowerCase().split(/\W+/).filter((p) => p.length > 4))
  return notas
    .filter((o) => o.id !== nota.id)
    .map((o) => {
      let s = o.seccion === nota.seccion ? 3 : 0
      for (const p of o.titular.toLowerCase().split(/\W+/)) if (palabras.has(p)) s += 2
      return { o, s }
    })
    .sort((a, b) => b.s - a.s || tiempo(b.o) - tiempo(a.o))
    .slice(0, n)
    .map((x) => x.o)
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function buscar(notas: Nota[], q: string) {
  const terminos = normalizar(q).split(/\s+/).filter(Boolean)
  if (!terminos.length) return []
  return notas
    .map((n) => {
      const tit = normalizar(n.titular)
      const resto = normalizar([n.bajada, ...n.cuerpo, n.medios.join(' ')].join(' '))
      let s = 0
      for (const t of terminos) {
        if (tit.includes(t)) s += 5
        else if (resto.includes(t)) s += 1
        else return { n, s: 0 }
      }
      return { n, s }
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || tiempo(b.n) - tiempo(a.n))
    .map((x) => x.n)
}
