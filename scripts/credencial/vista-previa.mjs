// Vista previa de una credencial con foto real, antes de emitirla en el panel.
// Uso: node scripts/credencial/vista-previa.mjs "<foto>" "<Nombre completo>" "<Cargo>" [DNI] [AAAA-MM-DD vence] [salida]
// El código y el QR son de MUESTRA: la credencial válida se emite e imprime desde /admin → Credenciales.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { rellenar } from './rellenar.mjs'

const require = createRequire(import.meta.url)
const qrcode = require('qrcode-generator')
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const [foto, nombre, cargo, dni = '', vence = '', salida = path.join(RAIZ, 'public/brand/credencial/vista-previa')] = process.argv.slice(2)
if (!foto || !nombre || !cargo) {
  console.error('Uso: node scripts/credencial/vista-previa.mjs <foto> <nombre> <cargo> [dni] [vence] [carpeta]')
  process.exit(1)
}
const hoy = new Date().toISOString().slice(0, 10)
const unAnio = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10)
const tipo = /\.png$/i.test(foto) ? 'image/png' : 'image/jpeg'
const b64 = fs.readFileSync(foto).toString('base64')
const dir = path.join(RAIZ, 'public/brand/credencial')
const plantilla = { frente: fs.readFileSync(path.join(dir, 'frente.svg'), 'utf8'), dorso: fs.readFileSync(path.join(dir, 'dorso.svg'), 'utf8') }
const r = rellenar(plantilla, { codigo: 'AAD-MUESTR', nombre, cargo, dni, vence: vence || unAnio, emitida: hoy,
  foto: `data:${tipo};base64,${b64}` }, qrcode)
fs.mkdirSync(salida, { recursive: true })
const INK = process.env.INKSCAPE || 'C:/Program Files/Inkscape/bin/inkscape.exe'
const base = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
for (const lado of ['frente', 'dorso']) {
  const svg = path.join(salida, `${base}-${lado}.svg`)
  fs.writeFileSync(svg, r[lado])
  execFileSync(INK, [svg, '--export-type=png', '--export-dpi=300', `--export-filename=${svg.replace('.svg', '.png')}`])
  execFileSync(INK, [svg, '--export-type=pdf', '--export-text-to-path', `--export-filename=${svg.replace('.svg', '.pdf')}`])
}
console.log('Vista previa en', salida)
