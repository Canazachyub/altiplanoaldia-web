/**
 * Altiplano al Día — panel de noticias en Google Sheets.
 *
 * Hojas (se crean con «Altiplano → Inicializar»):
 *   Hoy            las notas del día que publicó el maquetador (versión original)
 *   AAAA-MM-DD     archivo: una hoja por día con las notas de ese día (no se borran)
 *   Ediciones      cambios hechos desde la web (/admin); se aplican SOLO a la web
 *   Usuarios       usuario, nombre, rol (admin | editor), clave cifrada, activo
 *   Registro       quién cambió qué y cuándo
 *
 * API (Web App, POST con JSON en texto plano; GET ?accion=ediciones es público):
 *   publicar        (clave API)  el maquetador sube las notas del día
 *   login           usuario + clave → token de sesión (6 h)
 *   dias, notas     días archivados y notas de un día (con sus ediciones)
 *   editar, restaurar
 *   usuarios, guardar_usuario   (solo admin)
 *   cambiar_clave, salir
 */

const H_HOY = 'Hoy'
const H_EDICIONES = 'Ediciones'
const H_USUARIOS = 'Usuarios'
const H_REGISTRO = 'Registro'
const COLS_NOTA = ['id', 'dia', 'fecha', 'seccion', 'antetitulo', 'titular', 'bajada', 'cuerpo', 'lugar', 'imagen', 'slug']
const COLS_EDICION = ['id', 'dia', 'antetitulo', 'titular', 'bajada', 'cuerpo', 'seccion', 'oculta', 'usuario', 'fecha']
const COLS_USUARIO = ['usuario', 'nombre', 'rol', 'sal', 'hash', 'activo', 'creado', 'ultimo_ingreso']
const COLS_REGISTRO = ['fecha', 'usuario', 'accion', 'id', 'detalle']
const SESION_SEG = 6 * 60 * 60
const INTENTOS_MAX = 5
const BLOQUEO_SEG = 15 * 60
const ITERACIONES = 2000
const DIA = /^\d{4}-\d{2}-\d{2}$/

// ------------------------------------------------------------------ menú e inicialización
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Altiplano')
    .addItem('Inicializar (primera vez)', 'inicializar')
    .addItem('Ver clave API del maquetador', 'verClaveApi')
    .addItem('Restablecer clave del usuario admin', 'restablecerAdmin')
    .addToUi()
}

function inicializar() {
  const ss = SpreadsheetApp.getActive()
  hoja_(H_HOY, COLS_NOTA)
  hoja_(H_EDICIONES, COLS_EDICION)
  const us = hoja_(H_USUARIOS, COLS_USUARIO)
  hoja_(H_REGISTRO, COLS_REGISTRO)
  const props = PropertiesService.getScriptProperties()
  if (!props.getProperty('API_CLAVE')) props.setProperty('API_CLAVE', aleatorio_(32))
  let aviso = 'Hojas listas.'
  if (us.getLastRow() < 2) {
    const clave = aleatorio_(12)
    crearUsuario_('admin', 'Administrador', 'admin', clave)
    aviso += '\n\nUsuario: admin\nClave: ' + clave + '\n\nAnótala y cámbiala al entrar (Mi clave).'
  }
  aviso += '\n\nClave API del maquetador:\n' + props.getProperty('API_CLAVE')
  ss.toast('Inicializado', 'Altiplano', 5)
  SpreadsheetApp.getUi().alert(aviso)
}

function verClaveApi() {
  SpreadsheetApp.getUi().alert('Clave API del maquetador:\n' + PropertiesService.getScriptProperties().getProperty('API_CLAVE'))
}

function restablecerAdmin() {
  const clave = aleatorio_(12)
  const fila = buscarUsuario_('admin')
  if (fila) guardarClave_(fila.fila, clave)
  else crearUsuario_('admin', 'Administrador', 'admin', clave)
  SpreadsheetApp.getUi().alert('Usuario: admin\nNueva clave: ' + clave)
}

// ------------------------------------------------------------------ entrada web
function doGet(e) {
  const accion = (e && e.parameter && e.parameter.accion) || ''
  if (accion === 'ediciones') return json_(edicionesPublicas_())
  return json_({ ok: true, servicio: 'Altiplano al Día' })
}

function doPost(e) {
  let d
  try {
    d = JSON.parse(e.postData.contents)
  } catch (x) {
    return json_({ ok: false, error: 'Pedido inválido.' })
  }
  try {
    const acciones = {
      publicar: publicar_, login: login_, salir: salir_, dias: dias_, notas: notas_, editar: editar_,
      restaurar: restaurar_, usuarios: usuarios_, guardar_usuario: guardarUsuario_, cambiar_clave: cambiarClave_,
    }
    const f = acciones[d.accion]
    if (!f) return json_({ ok: false, error: 'Acción desconocida.' })
    return json_(Object.assign({ ok: true }, f(d)))
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) })
  }
}

// ------------------------------------------------------------------ maquetador → Sheets
function publicar_(d) {
  const clave = PropertiesService.getScriptProperties().getProperty('API_CLAVE')
  if (!clave || d.clave !== clave) throw new Error('Clave API incorrecta.')
  if (!DIA.test(d.dia || '')) throw new Error('Día inválido.')
  const filas = (d.notas || []).map(function (n) {
    return [n.id, d.dia, seguro_(n.fecha), seguro_(n.seccion), seguro_(n.antetitulo), seguro_(n.titular), seguro_(n.bajada),
      seguro_((n.cuerpo || []).join('\n\n').slice(0, 49000)), seguro_(n.lugar), seguro_(n.imagen), seguro_(n.slug)]
  })
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    escribir_(hoja_(d.dia, COLS_NOTA), filas)       // archivo del día (se reescribe con la última versión)
    escribir_(hoja_(H_HOY, COLS_NOTA), filas)
    ordenarHojas_()
  } finally {
    lock.releaseLock()
  }
  return { notas: filas.length, dia: d.dia }
}

// ------------------------------------------------------------------ sesión
function login_(d) {
  const usuario = String(d.usuario || '').trim().toLowerCase()
  const cache = CacheService.getScriptCache()
  const kInt = 'intentos:' + usuario
  const intentos = Number(cache.get(kInt) || 0)
  if (intentos >= INTENTOS_MAX) throw new Error('Demasiados intentos. Espera 15 minutos.')
  const u = buscarUsuario_(usuario)
  if (!u || !u.activo || hash_(String(d.clave || ''), u.sal) !== u.hash) {
    cache.put(kInt, String(intentos + 1), BLOQUEO_SEG)
    Utilities.sleep(600)
    throw new Error('Usuario o clave incorrectos.')
  }
  cache.remove(kInt)
  const token = Utilities.getUuid() + Utilities.getUuid()
  cache.put('sesion:' + token, JSON.stringify({ usuario: u.usuario }), SESION_SEG)
  hoja_(H_USUARIOS, COLS_USUARIO).getRange(u.fila, COLS_USUARIO.indexOf('ultimo_ingreso') + 1).setValue(new Date())
  return { token: token, usuario: u.usuario, nombre: u.nombre, rol: u.rol }
}

function salir_(d) {
  CacheService.getScriptCache().remove('sesion:' + d.token)
  return {}
}

/** Usuario de la sesión (se vuelve a leer de la hoja: si el admin lo desactiva, deja de entrar). */
function sesion_(d, soloAdmin) {
  const s = d.token && CacheService.getScriptCache().get('sesion:' + d.token)
  if (!s) throw new Error('Sesión vencida. Vuelve a entrar.')
  const u = buscarUsuario_(JSON.parse(s).usuario)
  if (!u || !u.activo) throw new Error('Usuario desactivado.')
  if (soloAdmin && u.rol !== 'admin') throw new Error('Solo el administrador puede hacer esto.')
  return u
}

// ------------------------------------------------------------------ notas
function dias_(d) {
  sesion_(d)
  const dias = SpreadsheetApp.getActive().getSheets().map(function (h) { return h.getName() })
    .filter(function (n) { return DIA.test(n) }).sort().reverse()
  return { dias: dias }
}

function notas_(d) {
  sesion_(d)
  if (!DIA.test(d.dia || '')) throw new Error('Día inválido.')
  const h = SpreadsheetApp.getActive().getSheetByName(d.dia)
  if (!h) return { notas: [] }
  const ed = mapaEdiciones_()
  const notas = filas_(h).map(function (n) {
    const e = ed[String(n.id)]
    return {
      id: Number(n.id), dia: d.dia, fecha: texto_(n.fecha), seccion: n.seccion, slug: n.slug, imagen: n.imagen, lugar: n.lugar,
      original: { antetitulo: n.antetitulo, titular: n.titular, bajada: n.bajada, cuerpo: n.cuerpo },
      edicion: e ? { antetitulo: e.antetitulo, titular: e.titular, bajada: e.bajada, cuerpo: e.cuerpo, seccion: e.seccion,
        oculta: e.oculta === true || e.oculta === 'TRUE', usuario: e.usuario, fecha: texto_(e.fecha) } : null,
    }
  })
  return { notas: notas }
}

function editar_(d) {
  const u = sesion_(d)
  const c = d.cambios || {}
  const id = Number(d.id)
  if (!id) throw new Error('Nota inválida.')
  const fila = [id, d.dia || '', limpio_(c.antetitulo, 200), limpio_(c.titular, 300), limpio_(c.bajada, 600),
    limpio_(c.cuerpo, 49000), limpio_(c.seccion, 40), c.oculta === true, u.usuario, new Date()]
  if (!fila[3] && !fila[7]) throw new Error('El titular no puede quedar vacío.')
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    const h = hoja_(H_EDICIONES, COLS_EDICION)
    const i = filaPorId_(h, id)
    if (i) h.getRange(i, 1, 1, fila.length).setValues([fila])
    else h.appendRow(fila)
    registrar_(u.usuario, c.oculta ? 'ocultar' : 'editar', id, fila[3])
  } finally {
    lock.releaseLock()
  }
  CacheService.getScriptCache().remove('ediciones')
  return {}
}

function restaurar_(d) {
  const u = sesion_(d)
  const h = hoja_(H_EDICIONES, COLS_EDICION)
  const i = filaPorId_(h, Number(d.id))
  if (i) h.deleteRow(i)
  registrar_(u.usuario, 'restaurar', d.id, '')
  CacheService.getScriptCache().remove('ediciones')
  return {}
}

/** {id: cambios} para la web (lo baja la compilación del sitio). */
function edicionesPublicas_() {
  const cache = CacheService.getScriptCache()
  const c = cache.get('ediciones')
  if (c) return JSON.parse(c)
  const out = {}
  const ed = mapaEdiciones_()
  Object.keys(ed).forEach(function (id) {
    const e = ed[id]
    const o = {}
    if (e.antetitulo) o.antetitulo = String(e.antetitulo)
    if (e.titular) o.titular = String(e.titular)
    if (e.bajada) o.bajada = String(e.bajada)
    if (e.cuerpo) o.cuerpo = String(e.cuerpo).split(/\n\s*\n/).map(function (p) { return p.trim() }).filter(String)
    if (e.seccion) o.seccion = String(e.seccion)
    if (e.oculta === true || e.oculta === 'TRUE') o.oculta = true
    out[id] = o
  })
  cache.put('ediciones', JSON.stringify(out), 120)
  return out
}

// ------------------------------------------------------------------ usuarios
function usuarios_(d) {
  sesion_(d, true)
  return {
    usuarios: filas_(hoja_(H_USUARIOS, COLS_USUARIO)).map(function (u) {
      return { usuario: u.usuario, nombre: u.nombre, rol: u.rol, activo: u.activo === true || u.activo === 'TRUE',
        ultimo_ingreso: texto_(u.ultimo_ingreso) }
    }),
  }
}

function guardarUsuario_(d) {
  const yo = sesion_(d, true)
  const x = d.datos || {}
  const usuario = String(x.usuario || '').trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) throw new Error('Usuario: 3 a 30 letras, números, punto o guion.')
  const rol = x.rol === 'admin' ? 'admin' : 'editor'
  const activo = x.activo !== false
  const nombre = limpio_(x.nombre, 80) || usuario
  if (x.clave) validarClave_(x.clave)
  const u = buscarUsuario_(usuario)
  if (!u) {
    if (!x.clave) throw new Error('Pon una clave para el usuario nuevo.')
    crearUsuario_(usuario, nombre, rol, x.clave, activo)
  } else {
    if (u.usuario === yo.usuario && (!activo || rol !== 'admin')) throw new Error('No puedes quitarte el rol de admin ni desactivarte.')
    const h = hoja_(H_USUARIOS, COLS_USUARIO)
    h.getRange(u.fila, 2, 1, 2).setValues([[nombre, rol]])
    h.getRange(u.fila, COLS_USUARIO.indexOf('activo') + 1).setValue(activo)
    if (x.clave) guardarClave_(u.fila, x.clave)
  }
  registrar_(yo.usuario, u ? 'modificar_usuario' : 'crear_usuario', '', usuario + ' (' + rol + (activo ? '' : ', inactivo') + ')')
  return {}
}

function cambiarClave_(d) {
  const u = sesion_(d)
  if (hash_(String(d.actual || ''), u.sal) !== u.hash) throw new Error('La clave actual no es correcta.')
  validarClave_(d.nueva)
  guardarClave_(u.fila, d.nueva)
  registrar_(u.usuario, 'cambiar_clave', '', '')
  return {}
}

function validarClave_(c) {
  if (String(c || '').length < 8) throw new Error('La clave debe tener al menos 8 caracteres.')
}

function crearUsuario_(usuario, nombre, rol, clave, activo) {
  const sal = aleatorio_(16)
  hoja_(H_USUARIOS, COLS_USUARIO).appendRow([usuario, nombre, rol, sal, hash_(clave, sal), activo !== false, new Date(), ''])
}

function guardarClave_(fila, clave) {
  const sal = aleatorio_(16)
  hoja_(H_USUARIOS, COLS_USUARIO).getRange(fila, COLS_USUARIO.indexOf('sal') + 1, 1, 2).setValues([[sal, hash_(clave, sal)]])
}

function buscarUsuario_(usuario) {
  const h = hoja_(H_USUARIOS, COLS_USUARIO)
  const datos = h.getDataRange().getValues()
  for (let i = 1; i < datos.length; i++) {
    if (String(datos[i][0]).toLowerCase() === usuario) {
      return { fila: i + 1, usuario: String(datos[i][0]).toLowerCase(), nombre: datos[i][1], rol: datos[i][2], sal: datos[i][3],
        hash: datos[i][4], activo: datos[i][5] === true || datos[i][5] === 'TRUE' }
    }
  }
  return null
}

// ------------------------------------------------------------------ utilidades
function hash_(clave, sal) {
  let b = Utilities.newBlob(sal + ':' + clave).getBytes()
  for (let i = 0; i < ITERACIONES; i++) b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, b.concat(Utilities.newBlob(sal).getBytes()))
  return Utilities.base64Encode(b)
}

function aleatorio_(n) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let s = ''
  while (s.length < n) {
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random()).forEach(function (x) {
      if (s.length < n) s += abc[(x + 256) % abc.length]
    })
  }
  return s
}

function hoja_(nombre, cols) {
  const ss = SpreadsheetApp.getActive()
  let h = ss.getSheetByName(nombre)
  if (!h) {
    h = ss.insertSheet(nombre)
    h.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold')
    h.setFrozenRows(1)
  }
  return h
}

function escribir_(h, filas) {
  const n = COLS_NOTA.length
  if (h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, h.getLastColumn()).clearContent()
  if (filas.length) h.getRange(2, 1, filas.length, n).setValues(filas)
}

function filas_(h) {
  const v = h.getDataRange().getValues()
  const cab = v.shift() || []
  return v.filter(function (f) { return f[0] !== '' }).map(function (f) {
    const o = {}
    cab.forEach(function (c, i) { o[c] = f[i] })
    return o
  })
}

function filaPorId_(h, id) {
  const ids = h.getRange(1, 1, Math.max(1, h.getLastRow()), 1).getValues()
  for (let i = 1; i < ids.length; i++) if (Number(ids[i][0]) === id) return i + 1
  return 0
}

function mapaEdiciones_() {
  const m = {}
  filas_(hoja_(H_EDICIONES, COLS_EDICION)).forEach(function (e) { m[String(e.id)] = e })
  return m
}

function ordenarHojas_() {
  const ss = SpreadsheetApp.getActive()
  const fijas = [H_HOY, H_EDICIONES, H_USUARIOS, H_REGISTRO]
  const dias = ss.getSheets().map(function (h) { return h.getName() }).filter(function (n) { return DIA.test(n) }).sort().reverse()
  fijas.concat(dias).forEach(function (n, i) {
    const h = ss.getSheetByName(n)
    if (h) { ss.setActiveSheet(h); ss.moveActiveSheet(i + 1) }
  })
}

function registrar_(usuario, accion, id, detalle) {
  hoja_(H_REGISTRO, COLS_REGISTRO).appendRow([new Date(), usuario, accion, id || '', String(detalle || '').slice(0, 300)])
}

function limpio_(v, max) {
  return seguro_(String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max))
}

/** Texto que Sheets no toma como fórmula (un titular que empiece con «=» no se ejecuta). */
function seguro_(v) {
  const s = String(v == null ? '' : v)
  return /^[=+\-@]/.test(s) ? "'" + s : s
}

function texto_(v) {
  return v instanceof Date ? Utilities.formatDate(v, 'America/Lima', "yyyy-MM-dd'T'HH:mm:ss") : String(v || '')
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}
