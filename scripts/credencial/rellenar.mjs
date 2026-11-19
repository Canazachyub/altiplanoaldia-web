// Rellena la plantilla de la credencial (frente.svg / dorso.svg). La usan el script de muestra y la web
// (src/pages/credencial.ts tiene la misma lógica en TypeScript: si cambias una, cambia la otra).
export const URL_VERIFICAR = 'https://altiplanoaldia.pe/verificar/'

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Parte el nombre en dos líneas equilibradas (nombres / apellidos). */
export function lineasNombre(nombre) {
  const p = String(nombre || '').trim().toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()).split(/\s+/)
  if (p.length <= 2) return [p.join(' '), '']
  const corte = p.length >= 4 ? p.length - 2 : Math.ceil(p.length / 2)
  return [p.slice(0, corte).join(' '), p.slice(corte).join(' ')]
}

/** Fecha AAAA-MM-DD → DD/MM/AAAA. */
export const fechaCorta = (f) => (/^\d{4}-\d{2}-\d{2}$/.test(f || '') ? f.split('-').reverse().join('/') : '')

/** QR como un solo <path> de módulos, escalado a `lado` unidades. */
export function qrPath(texto, lado, qrcode) {
  const q = qrcode(0, 'M')
  q.addData(texto)
  q.make()
  const n = q.getModuleCount()
  let d = ''
  for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (q.isDark(f, c)) d += `M${c} ${f}h1v1h-1z`
  return `<path transform="scale(${(lado / n).toFixed(4)})" d="${d}" fill="#000000"/>`
}

export function rellenar({ frente, dorso }, x, qrcode) {
  const url = URL_VERIFICAR + x.codigo
  const [n1, n2] = lineasNombre(x.nombre)
  const campos = {
    NOMBRE_1: esc(n1), NOMBRE_2: esc(n2), CARGO: esc(String(x.cargo || '').toUpperCase()), DNI: esc(x.dni || '—'),
    CODIGO: esc(x.codigo), VENCE: esc(fechaCorta(x.vence)), EMITIDA: esc(fechaCorta(x.emitida)),
    ANIO: esc(String(x.vence || '').slice(0, 4)), URL: esc(url.replace('https://', '')), FOTO: esc(x.foto || ''),
    QR_FRENTE: qrPath(url, 92, qrcode), QR_DORSO: qrPath(url, 128, qrcode),
    FIRMANTE: esc(x.firmante || 'Dirección general'), FIRMANTE_CARGO: esc((x.firmante_cargo || 'Altiplano al Día').toUpperCase()),
    FIRMA: esc(x.firma || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), TELEFONO: esc(x.telefono || '942 149 084'),
  }
  const poner = (s) => s.replace(/\{\{([A-Z_0-9]+)\}\}/g, (m, k) => (k in campos ? campos[k] : m))
  return { frente: poner(frente), dorso: poner(dorso) }
}
