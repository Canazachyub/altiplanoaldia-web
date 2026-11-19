// Credencial de prensa: relleno de la plantilla (public/brand/credencial/frente.svg y dorso.svg) y consulta
// pública de validación. Misma lógica que scripts/credencial/rellenar.mjs (si cambias una, cambia la otra).
import qrcode from 'qrcode-generator'

export const API = (import.meta.env.VITE_SHEETS_API as string | undefined) ?? ''
export const URL_VERIFICAR = 'https://altiplanoaldia.pe/verificar/'
export const CODIGO_CRED = /^AAD-[A-HJ-NP-Z2-9]{6}$/

export interface DatosCredencial {
  codigo: string
  nombre: string
  cargo: string
  dni: string
  vence: string
  emitida: string
  foto: string
  firmante?: string
  firmante_cargo?: string
  firma?: string
  telefono?: string
}

const VACIO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

export interface Validacion {
  ok: boolean
  error?: string
  valida: boolean
  estado: 'vigente' | 'vencida' | 'revocada' | 'no_existe'
  codigo: string
  nombre?: string
  cargo?: string
  dni?: string
  emitida?: string
  vence?: string
  motivo?: string
  foto?: string
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function lineasNombre(nombre: string): [string, string] {
  const p = String(nombre || '').trim().toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()).split(/\s+/).filter(Boolean)
  if (p.length <= 2) return [p.join(' '), '']
  const corte = p.length >= 4 ? p.length - 2 : Math.ceil(p.length / 2)
  return [p.slice(0, corte).join(' '), p.slice(corte).join(' ')]
}

export const fechaCorta = (f?: string) => (/^\d{4}-\d{2}-\d{2}$/.test(f || '') ? f!.split('-').reverse().join('/') : '')

function qrPath(texto: string, lado: number) {
  const q = qrcode(0, 'M')
  q.addData(texto)
  q.make()
  const n = q.getModuleCount()
  let d = ''
  for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (q.isDark(f, c)) d += `M${c} ${f}h1v1h-1z`
  return `<path transform="scale(${(lado / n).toFixed(4)})" d="${d}" fill="#000000"/>`
}

let plantillas: Promise<{ frente: string; dorso: string }> | null = null
export function cargarPlantillas() {
  plantillas ??= Promise.all(
    ['frente', 'dorso'].map((l) => fetch(`/brand/credencial/${l}.svg`).then((r) => {
      if (!r.ok) throw new Error('No se encontró la plantilla de la credencial.')
      return r.text()
    })),
  ).then(([frente, dorso]) => ({ frente, dorso }))
  return plantillas
}

/** Devuelve el frente y el dorso como SVG listos (con foto, QR y datos). */
export async function armarCredencial(x: DatosCredencial) {
  const { frente, dorso } = await cargarPlantillas()
  const url = URL_VERIFICAR + x.codigo
  const [n1, n2] = lineasNombre(x.nombre)
  const campos: Record<string, string> = {
    NOMBRE_1: esc(n1), NOMBRE_2: esc(n2), CARGO: esc(x.cargo.toUpperCase()), DNI: esc(x.dni || '—'),
    CODIGO: esc(x.codigo), VENCE: esc(fechaCorta(x.vence)), EMITIDA: esc(fechaCorta(x.emitida)),
    ANIO: esc(x.vence.slice(0, 4)), URL: esc(url.replace('https://', '')), FOTO: esc(x.foto),
    QR_FRENTE: qrPath(url, 92), QR_DORSO: qrPath(url, 112),
    FIRMANTE: esc(x.firmante || 'Dirección general'), FIRMANTE_CARGO: esc((x.firmante_cargo || 'Altiplano al Día').toUpperCase()),
    FIRMA: esc(x.firma || VACIO), TELEFONO: esc(x.telefono || '942 149 084'),
  }
  const poner = (s: string) => s.replace(/\{\{([A-Z_0-9]+)\}\}/g, (m, k: string) => (k in campos ? campos[k] : m))
  return { frente: poner(frente), dorso: poner(dorso) }
}

/** Validación pública (la abre el QR). */
export async function validar(codigo: string): Promise<Validacion> {
  if (!API) throw new Error('La validación no está conectada (VITE_SHEETS_API).')
  const r = await fetch(`${API}?accion=credencial&codigo=${encodeURIComponent(codigo)}`)
  const j = (await r.json()) as Validacion
  if (!j.ok) throw new Error(j.error || 'No se pudo consultar la credencial.')
  return j
}

/** Achica la foto en el navegador (retrato 3:4, máx. 600 px de alto) antes de subirla. */
export function prepararFoto(archivo: File): Promise<{ b64: string; tipo: string; vista: string }> {
  return new Promise((ok, mal) => {
    const img = new Image()
    img.onload = () => {
      const alto = Math.min(600, img.naturalHeight)
      const ancho = Math.round((alto * 220) / 272)
      const c = document.createElement('canvas')
      c.width = ancho
      c.height = alto
      const g = c.getContext('2d')!
      // recorte centrado al formato de la credencial (220 × 272)
      const r = Math.max(ancho / img.naturalWidth, alto / img.naturalHeight)
      const w = img.naturalWidth * r
      const h = img.naturalHeight * r
      g.drawImage(img, (ancho - w) / 2, (alto - h) / 2.6, w, h)
      const vista = c.toDataURL('image/jpeg', 0.88)
      URL.revokeObjectURL(img.src)
      ok({ b64: vista.split(',')[1], tipo: 'image/jpeg', vista })
    }
    img.onerror = () => mal(new Error('No se pudo leer la foto.'))
    img.src = URL.createObjectURL(archivo)
  })
}
