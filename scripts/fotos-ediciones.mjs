// Antes de compilar: convierte public/data/ediciones-fuente.json (lo que devuelve Apps Script) en
// public/data/ediciones.json y baja de Drive (a través de Apps Script) las fotos que cambiaron los editores,
// a public/img/ediciones/<id de Drive>.jpg. Así la web sirve las fotos desde su propio dominio.
// Uso: SHEETS_API=https://script.google.com/.../exec node scripts/fotos-ediciones.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const API = process.env.SHEETS_API || ''
const fuente = join('public', 'data', 'ediciones-fuente.json')
const destino = join('public', 'data', 'ediciones.json')
const carpeta = join('public', 'img', 'ediciones')

const ed = existsSync(fuente) ? JSON.parse(readFileSync(fuente, 'utf8')) : {}
mkdirSync(carpeta, { recursive: true })
let bajadas = 0
for (const [id, e] of Object.entries(ed)) {
  if (!e.foto) continue
  if (e.foto === 'ninguna') {
    e.imagen = null
    continue
  }
  if (!/^[A-Za-z0-9_-]{10,}$/.test(e.foto) || !API) continue
  const ext = 'jpg'
  const rel = `img/ediciones/${e.foto}.${ext}`
  if (!existsSync(join('public', rel))) {
    try {
      const r = await fetch(`${API}?accion=foto&id=${encodeURIComponent(e.foto)}`)
      const j = await r.json()
      if (!j.ok) throw new Error(j.error)
      writeFileSync(join('public', rel), Buffer.from(j.b64, 'base64'))
      bajadas++
    } catch (err) {
      console.warn(`fotos-ediciones: no se pudo bajar la foto de la nota ${id}: ${err.message}`)
      continue
    }
  }
  e.imagen = rel
}
writeFileSync(destino, JSON.stringify(ed))
console.log(`fotos-ediciones: ${Object.keys(ed).length} edición(es), ${bajadas} foto(s) bajada(s) de Drive.`)
