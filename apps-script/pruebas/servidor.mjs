// Servidor local que imita la aplicación web de Apps Script (mismo Code.gs, servicios de Google simulados).
// Uso: node apps-script/pruebas/servidor.mjs [puerto] [archivo_de_claves]
//   → http://localhost:8787  (VITE_SHEETS_API / sheets_api apuntan aquí para probar sin Google)
import { writeFileSync } from 'node:fs'
import http from 'node:http'
import { crearGoogle } from './simulador.mjs'

const PUERTO = Number(process.argv[2] || 8787)
const G = crearGoogle()
G.api.inicializar()
const m = G.alertas.at(-1).match(/Clave: (\S+)[\s\S]*Clave API del maquetador:\n(\S+)/)
const claves = { admin: m[1], api: m[2], url: `http://localhost:${PUERTO}` }
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(claves))

http.createServer((req, res) => {
  const cab = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json; charset=utf-8' }
  if (req.method === 'OPTIONS') {
    // Apps Script real NO responde la consulta previa: si el panel la necesitara, fallaría en producción.
    res.writeHead(405, cab)
    return res.end('{"ok":false,"error":"preflight no admitido (igual que Apps Script)"}')
  }
  if (req.method === 'GET') {
    const u = new URL(req.url, 'http://x')
    res.writeHead(200, cab)
    return res.end(G.api.doGet({ parameter: Object.fromEntries(u.searchParams) }).texto)
  }
  let cuerpo = ''
  req.setEncoding('utf8')
  req.on('data', (c) => { cuerpo += c })
  req.on('end', () => {
    let salida
    try {
      salida = G.api.doPost({ postData: { contents: cuerpo } }).texto
    } catch (e) {
      salida = JSON.stringify({ ok: false, error: 'Error interno: ' + e.message })
    }
    res.writeHead(200, cab)
    res.end(salida)
  })
}).listen(PUERTO, () => console.log(`Simulador de Apps Script en ${claves.url}`))
