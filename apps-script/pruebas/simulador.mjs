// Simulador local de los servicios de Google que usa Code.gs (Sheets, Drive, Cache, Properties, Lock,
// Utilities, ContentService). Ejecuta el MISMO Code.gs en una caja de arena de Node para probarlo sin
// cuenta de Google.
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const AQUI = dirname(fileURLToPath(import.meta.url))
const CODIGO = join(AQUI, '..', 'Code.gs')

const aFirmados = (buf) => Array.from(buf, (b) => (b > 127 ? b - 256 : b))
const aBuffer = (x) => (typeof x === 'string' ? Buffer.from(x, 'utf8') : Buffer.from(x.map((b) => (b + 256) % 256)))

class Rango {
  constructor(hoja, fila, col, nf = 1, nc = 1) { Object.assign(this, { hoja, fila, col, nf, nc }) }
  getValues() {
    const out = []
    for (let i = 0; i < this.nf; i++) {
      const f = this.hoja.datos[this.fila - 1 + i] || []
      out.push(Array.from({ length: this.nc }, (_, j) => (f[this.col - 1 + j] ?? '')))
    }
    return out
  }
  setValues(v) {
    if (v.length !== this.nf || v.some((f) => f.length !== this.nc)) throw new Error(`setValues: tamaño ${v.length}x${v[0]?.length} ≠ ${this.nf}x${this.nc}`)
    v.forEach((f, i) => f.forEach((x, j) => this.hoja.poner(this.fila + i, this.col + j, x)))
    return this
  }
  setValue(x) { this.hoja.poner(this.fila, this.col, x); return this }
  clearContent() {
    for (let i = 0; i < this.nf; i++) for (let j = 0; j < this.nc; j++) this.hoja.poner(this.fila + i, this.col + j, '')
    this.hoja.recortar()
    return this
  }
  setFontWeight() { return this }
}

class Hoja {
  constructor(nombre) { this.nombre = nombre; this.datos = [] }
  /** Como Sheets: un texto que empieza con ' se guarda sin la comilla y queda como texto. */
  poner(f, c, x) {
    while (this.datos.length < f) this.datos.push([])
    const fila = this.datos[f - 1]
    while (fila.length < c) fila.push('')
    if (typeof x === 'string' && /^[=+\-@]/.test(x)) this.formulas = (this.formulas || 0) + 1   // se ejecutaría como fórmula
    fila[c - 1] = typeof x === 'string' && x.startsWith("'") ? x.slice(1) : x
  }
  recortar() { while (this.datos.length && this.datos[this.datos.length - 1].every((x) => x === '')) this.datos.pop() }
  getName() { return this.nombre }
  getRange(f, c, nf = 1, nc = 1) { return new Rango(this, f, c, nf, nc) }
  getLastRow() { this.recortar(); return this.datos.length }
  getLastColumn() { return Math.max(0, ...this.datos.map((f) => f.length)) }
  getDataRange() { return new Rango(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())) }
  appendRow(f) { this.recortar(); const r = this.datos.length + 1; f.forEach((x, j) => this.poner(r, j + 1, x)); return this }
  deleteRow(i) { this.datos.splice(i - 1, 1); return this }
  setFrozenRows() { return this }
}

class Archivo {
  constructor(carpeta, blob) {
    this.id = 'f' + randomUUID().replace(/-/g, '')
    Object.assign(this, { carpeta, bytes: blob.bytes, tipo: blob.tipo, nombre: blob.nombre })
  }
  getId() { return this.id }
  getName() { return this.nombre }
  getUrl() { return `https://drive.google.com/file/d/${this.id}/view` }
  getMimeType() { return this.tipo }
  getBlob() { return { getBytes: () => aFirmados(this.bytes) } }
  getParents() { const l = [this.carpeta]; return { hasNext: () => l.length > 0, next: () => l.shift() } }
}

class Carpeta {
  constructor(nombre) { this.id = 'c' + randomUUID().replace(/-/g, ''); this.nombre = nombre; this.archivos = [] }
  getId() { return this.id }
  getFiles() { const l = [...this.archivos]; return { hasNext: () => l.length > 0, next: () => l.shift() } }
  createFile(blob) { const f = new Archivo(this, blob); this.archivos.push(f); return f }
}

export function crearGoogle() {
  const hojas = []
  let activa = null
  const props = new Map()
  const cache = new Map()
  const carpetas = []
  const alertas = []
  const ss = {
    getSheetByName: (n) => hojas.find((h) => h.nombre === n) || null,
    insertSheet: (n) => { const h = new Hoja(n); hojas.push(h); return h },
    getSheets: () => [...hojas],
    setActiveSheet: (h) => { activa = h },
    moveActiveSheet: (i) => { hojas.splice(hojas.indexOf(activa), 1); hojas.splice(i - 1, 0, activa) },
    toast: () => undefined,
  }
  const g = {
    SpreadsheetApp: {
      getActive: () => ss,
      getUi: () => ({ alert: (t) => alertas.push(t), createMenu: () => ({ addItem() { return this }, addToUi() {} }) }),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props.get(k) ?? null, setProperty: (k, v) => props.set(k, v) }) },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => { const e = cache.get(k); if (!e || e.hasta < Date.now()) return null; return e.v },
        put: (k, v, s = 600) => { if (String(v).length > 100000) throw new Error('caché: valor muy grande'); cache.set(k, { v: String(v), hasta: Date.now() + s * 1000 }) },
        remove: (k) => cache.delete(k),
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    DriveApp: {
      createFolder: (n) => { const c = new Carpeta(n); carpetas.push(c); return c },
      getFolderById: (id) => { const c = carpetas.find((x) => x.id === id); if (!c) throw new Error('No existe la carpeta'); return c },
      getFileById: (id) => { for (const c of carpetas) { const f = c.archivos.find((x) => x.id === id); if (f) return f } throw new Error('No existe el archivo') },
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, datos) => aFirmados(createHash(alg).update(aBuffer(datos)).digest()),
      newBlob: (datos, tipo, nombre) => {
        const bytes = typeof datos === 'string' ? Buffer.from(datos, 'utf8') : aBuffer(datos)
        return { bytes, tipo, nombre, getBytes: () => aFirmados(bytes) }
      },
      base64Encode: (b) => aBuffer(b).toString('base64'),
      base64Decode: (s) => aFirmados(Buffer.from(s, 'base64')),
      getUuid: () => randomUUID(),
      sleep: () => undefined,
      formatDate: (d) => new Date(d.getTime() - 5 * 3600e3).toISOString().slice(0, 19),
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (s) => ({ texto: s, setMimeType() { return this } }),
    },
    console,
  }
  const caja = vm.createContext(g)
  vm.runInContext(readFileSync(CODIGO, 'utf8') + '\n;globalThis.__api = { doGet, doPost, inicializar, verClaveApi, restablecerAdmin, onOpen }', caja)
  const api = caja.__api
  return {
    api, hojas, props, carpetas, alertas, cache,
    post: (o) => JSON.parse(api.doPost({ postData: { contents: JSON.stringify(o) } }).texto),
    get: (p) => JSON.parse(api.doGet({ parameter: p }).texto),
    hoja: (n) => hojas.find((h) => h.nombre === n),
  }
}
