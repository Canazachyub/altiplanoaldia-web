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
 *   crear_nota      (editores) nota propia escrita en el panel → hoja «Propias»; sale en la web con las ediciones
 *
 * Avisos del público (Alerta Mascota, Anuncios gratis y Denuncias ciudadanas):
 *   Mascotas, Anuncios, Denuncias  avisos que manda la gente desde la web (estado: pendiente → aprobado …)
 *                        las denuncias nunca se publican: solo las ve la redacción en /admin
 *   enviar_aviso         (público)   aviso nuevo con foto opcional; queda «pendiente» hasta que un editor lo apruebe
 *   GET ?accion=avisos&seccion=mascotas|anuncios   (público) avisos aprobados y vigentes
 *   avisos_admin, moderar_aviso, foto_aviso        (editores) revisar, aprobar, rechazar, marcar resuelto
 *   mi_aviso, actualizar_aviso, cerrar_aviso        (quien publicó, con su código) ver el estado, contar
 *                                                   una novedad, cerrar el aviso explicando cómo terminó
 */

const H_HOY = 'Hoy'
const H_EDICIONES = 'Ediciones'
const H_USUARIOS = 'Usuarios'
const H_REGISTRO = 'Registro'
const COLS_NOTA = ['id', 'dia', 'fecha', 'seccion', 'antetitulo', 'titular', 'bajada', 'cuerpo', 'lugar', 'imagen', 'slug', 'foto_drive']
const COLS_EDICION = ['id', 'dia', 'antetitulo', 'titular', 'bajada', 'cuerpo', 'seccion', 'oculta', 'usuario', 'fecha', 'foto']
// Carpeta principal de Drive (cuenta de Altiplano al Día). Todo se ordena dentro, por tipo y por mes:
//   Notas/2026-11/                        fotos de las notas (maquetador) y las que cambian los editores
//   Alerta Mascota/Perdidos/2026-11/      M261115-ABCDE.jpg  (y Encontrados, Maltrato, Adopción y ayuda)
//   Anuncios/Ofertas de empleo/2026-11/   A261115-ABCDE.jpg  (Vendo, Compro, Alquilo, Busco empleo, …)
//   Denuncias ciudadanas/Seguridad/2026-11/  D261115-ABCDE.jpg  (Servicios públicos, Corrupción, …)
// El nombre del archivo es el id de la fila en la hoja: de la hoja se llega a la foto y de la foto a la fila.
// Si la carpeta principal no se puede abrir (otra cuenta), se crea «Altiplano al Día» en el Drive de quien publica.
const CARPETA_RAIZ = '1CZcFqPBYGKmyn9cXuuyID-KU6W7RXNfo'
const CARPETA_NOTAS = 'Notas'
const FOTO_MAX_BYTES = 8 * 1024 * 1024
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
    .addItem('Limpiar datos personales de avisos viejos', 'depurarAvisosMenu')
    .addToUi()
}

function inicializar() {
  const ss = SpreadsheetApp.getActive()
  hoja_(H_HOY, COLS_NOTA)
  hoja_(H_EDICIONES, COLS_EDICION)
  const us = hoja_(H_USUARIOS, COLS_USUARIO)
  hoja_(H_REGISTRO, COLS_REGISTRO)
  hoja_(H_PROPIAS, COLS_PROPIA)
  const props = PropertiesService.getScriptProperties()
  if (!props.getProperty('API_CLAVE')) props.setProperty('API_CLAVE', aleatorio_(32))
  carpeta_()
  carpetaRuta_([CARPETA_NOTAS, mes_()])
  Object.keys(AVISOS).forEach(function (k) {
    const c = AVISOS[k]
    hoja_(c.hoja, c.cols)
    c.tipos.forEach(function (t) { carpetaRuta_([c.carpeta, c.carpetas[t]]) })   // deja visible el árbol desde el inicio
  })
  activarDepuracion_()
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
  if (accion === 'avisos') {
    try {
      return json_(Object.assign({ ok: true }, avisosPublicos_(e.parameter.seccion)))
    } catch (err) {
      return json_({ ok: false, error: String((err && err.message) || err) })
    }
  }
  // Foto de una edición (la baja la compilación del sitio): solo archivos de la carpeta de fotos.
  if (accion === 'foto') {
    try {
      const f = fotoDeCarpeta_(e.parameter.id)
      return json_({ ok: true, tipo: f.getMimeType(), b64: Utilities.base64Encode(f.getBlob().getBytes()) })
    } catch (err) {
      return json_({ ok: false, error: String((err && err.message) || err) })
    }
  }
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
      fotos_faltan: fotosFaltan_, subir_foto: subirFotoApi_, subir_foto_edicion: subirFotoEdicion_,
      enviar_aviso: enviarAviso_, avisos_admin: avisosAdmin_, moderar_aviso: moderarAviso_, foto_aviso: fotoAviso_,
      mi_aviso: miAviso_, actualizar_aviso: actualizarAviso_, cerrar_aviso: cerrarAviso_, crear_nota: crearNota_,
      ubicar_aviso: ubicarAviso_,
    }
    const f = acciones[d.accion]
    if (!f) return json_({ ok: false, error: 'Acción desconocida.' })
    return json_(Object.assign({ ok: true }, f(d)))
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) })
  }
}

// ------------------------------------------------------------------ maquetador → Sheets
function claveApi_(d) {
  const clave = PropertiesService.getScriptProperties().getProperty('API_CLAVE')
  if (!clave || d.clave !== clave) throw new Error('Clave API incorrecta.')
}

function publicar_(d) {
  claveApi_(d)
  if (!DIA.test(d.dia || '')) throw new Error('Día inválido.')
  const enDrive = urlsFotos_()
  const filas = (d.notas || []).map(function (n) {
    const nombre = String(n.imagen || '').split('/').pop()
    return [n.id, d.dia, seguro_(n.fecha), seguro_(n.seccion), seguro_(n.antetitulo), seguro_(n.titular), seguro_(n.bajada),
      seguro_((n.cuerpo || []).join('\n\n').slice(0, 49000)), seguro_(n.lugar), seguro_(n.imagen), seguro_(n.slug),
      (nombre && enDrive[nombre]) || '']
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

// ------------------------------------------------------------------ fotos en Drive
function raiz_() {
  try {
    return DriveApp.getFolderById(CARPETA_RAIZ)
  } catch (e) { /* sin acceso a la carpeta del medio: se usa una propia */ }
  const props = PropertiesService.getScriptProperties()
  const id = props.getProperty('CARPETA_RAIZ_LOCAL')
  if (id) {
    try {
      return DriveApp.getFolderById(id)
    } catch (e) { /* la borraron: se crea otra */ }
  }
  const c = DriveApp.createFolder('Altiplano al Día')
  props.setProperty('CARPETA_RAIZ_LOCAL', c.getId())
  return c
}

/** Carpeta raíz/partes[0]/partes[1]/…: la busca por nombre, la crea si falta y recuerda su id. */
function carpetaRuta_(partes) {
  const props = PropertiesService.getScriptProperties()
  const k = 'ruta:' + partes.join('/')
  const id = props.getProperty(k)
  if (id) {
    try {
      return DriveApp.getFolderById(id)
    } catch (e) { /* la borraron: se vuelve a armar */ }
  }
  let c = raiz_()
  partes.forEach(function (nombre) {
    const it = c.getFoldersByName(nombre)
    c = it.hasNext() ? it.next() : c.createFolder(nombre)
  })
  props.setProperty(k, c.getId())
  return c
}

/** Mes de Lima, «AAAA-MM» (carpeta del mes). */
function mes_() {
  return new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 7)
}

/** ¿El archivo o carpeta está dentro de la carpeta `id` (hasta 4 niveles)? */
function dentroDe_(x, id, nivel) {
  if ((nivel || 0) > 4) return false
  const it = x.getParents()
  while (it.hasNext()) {
    const p = it.next()
    if (p.getId() === id || dentroDe_(p, id, (nivel || 0) + 1)) return true
  }
  return false
}

function carpeta_() {
  return carpetaRuta_([CARPETA_NOTAS])
}

/** {nombre de archivo: url} de las fotos ya guardadas (se guarda en caché unos minutos). */
function urlsFotos_() {
  const cache = CacheService.getScriptCache()
  const c = cache.get('fotos_drive')
  if (c) return JSON.parse(c)
  const out = {}
  const leer = function (c) {
    const it = c.getFiles()
    while (it.hasNext()) {
      const f = it.next()
      out[f.getName()] = f.getUrl()
    }
  }
  const raizNotas = carpeta_()
  leer(raizNotas)
  const meses = raizNotas.getFolders()
  while (meses.hasNext()) leer(meses.next())
  const s = JSON.stringify(out)
  if (s.length < 90000) cache.put('fotos_drive', s, 600)
  return out
}

/** El maquetador pregunta qué fotos faltan en Drive (por nombre: n<id>-<huella>.jpg). */
function fotosFaltan_(d) {
  claveApi_(d)
  const hay = urlsFotos_()
  return { faltan: (d.nombres || []).filter(function (n) { return !hay[n] }) }
}

function guardarFoto_(nombre, b64, tipo) {
  const bytes = Utilities.base64Decode(b64)
  if (bytes.length > FOTO_MAX_BYTES) throw new Error('La foto pesa demasiado (máx. 8 MB).')
  if (!/^image\/(jpeg|png|webp)$/.test(tipo || '')) throw new Error('Formato de foto no admitido (JPG, PNG o WEBP).')
  const f = carpetaRuta_([CARPETA_NOTAS, mes_()]).createFile(Utilities.newBlob(bytes, tipo, nombre))
  CacheService.getScriptCache().remove('fotos_drive')
  return f
}

function subirFotoApi_(d) {
  claveApi_(d)
  const nombre = String(d.nombre || '')
  if (!/^[a-z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(nombre)) throw new Error('Nombre de foto inválido.')
  if (urlsFotos_()[nombre]) return { url: urlsFotos_()[nombre] }
  return { url: guardarFoto_(nombre, d.b64, d.tipo || 'image/jpeg').getUrl() }
}

/** Foto nueva para una nota, subida por un editor desde el panel. */
function subirFotoEdicion_(d) {
  const u = sesion_(d)
  const id = Number(d.id)
  if (!id) throw new Error('Nota inválida.')
  const ext = d.tipo === 'image/png' ? 'png' : d.tipo === 'image/webp' ? 'webp' : 'jpg'
  const f = guardarFoto_('ed-' + id + '-' + Date.now() + '.' + ext, d.b64, d.tipo)
  registrar_(u.usuario, 'subir_foto', id, f.getName())
  return { foto: f.getId() }
}

function fotoDeCarpeta_(id) {
  const f = DriveApp.getFileById(String(id || ''))
  if (dentroDe_(f, carpeta_().getId())) return f
  throw new Error('Foto no encontrada.')
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
    .filter(function (n) { return DIA.test(n) })
  propias_().forEach(function (n) { const d = texto_(n.dia).slice(0, 10); if (DIA.test(d) && dias.indexOf(d) < 0) dias.push(d) })
  return { dias: dias.sort().reverse() }
}

function notas_(d) {
  sesion_(d)
  if (!DIA.test(d.dia || '')) throw new Error('Día inválido.')
  const h = SpreadsheetApp.getActive().getSheetByName(d.dia)
  const ed = mapaEdiciones_()
  const delDia = (h ? filas_(h) : []).concat(propias_().filter(function (n) { return texto_(n.dia).slice(0, 10) === d.dia })
    .map(function (n) {
      return { id: n.id, fecha: n.fecha, seccion: n.seccion, slug: n.slug, imagen: '', lugar: n.lugar, antetitulo: n.antetitulo,
        titular: n.titular, bajada: n.bajada, cuerpo: n.cuerpo, foto_drive: n.foto ? 'https://drive.google.com/file/d/' + n.foto + '/view' : '',
        propia: true, foto_propia: n.foto || '' }
    }))
  const notas = delDia.map(function (n) {
    const e = ed[String(n.id)]
    return {
      id: Number(n.id), dia: d.dia, fecha: texto_(n.fecha), seccion: n.seccion, slug: n.slug, imagen: n.imagen, lugar: n.lugar,
      original: { antetitulo: n.antetitulo, titular: n.titular, bajada: n.bajada, cuerpo: n.cuerpo },
      foto_drive: n.foto_drive || '', propia: !!n.propia, foto_propia: n.foto_propia || '',
      edicion: e ? { antetitulo: e.antetitulo, titular: e.titular, bajada: e.bajada, cuerpo: e.cuerpo, seccion: e.seccion,
        oculta: e.oculta === true || e.oculta === 'TRUE', usuario: e.usuario, fecha: texto_(e.fecha), foto: e.foto || '' } : null,
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
    limpio_(c.cuerpo, 49000), limpio_(c.seccion, 40), c.oculta === true, u.usuario, new Date(),
    /^[A-Za-z0-9_-]{10,}$|^ninguna$/.test(c.foto || '') ? c.foto : '']
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
    if (e.foto) o.foto = String(e.foto)          // id de Drive, o «ninguna» para quitar la foto
    out[id] = o
  })
  const nuevas = propiasPublicas_()
  if (nuevas.length) out._nuevas = nuevas
  cache.put('ediciones', JSON.stringify(out), 120)
  return out
}

// ------------------------------------------------------------------ notas propias (escritas en el panel)
// Una nota que no viene del maquetador: el editor la escribe en /admin → Notas → «Nueva nota». Se guarda en la
// hoja «Propias» (y su foto en Drive, Notas/<mes>/), y la web la toma en su próxima compilación (≈15 min) junto
// con las ediciones. Se corrige u oculta igual que cualquier nota (pestaña Ediciones). No entra al boletín PDF.
const H_PROPIAS = 'Propias'
const COLS_PROPIA = ['id', 'dia', 'fecha', 'seccion', 'ambito', 'antetitulo', 'titular', 'bajada', 'cuerpo', 'lugar',
  'foto', 'slug', 'usuario', 'creado']
const AMBITOS = ['DISTRITAL', 'LOCAL', 'REGIONAL', 'NACIONAL', 'INTERNACIONAL']
const PROPIA_ID_BASE = 9000000          // los ids del maquetador son mucho menores: nunca chocan

function slug_(t) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '')
}

function crearNota_(d) {
  const u = sesion_(d)
  const x = d.nota || {}
  const titular = limpio_(x.titular, 300)
  if (titular.length < 10) throw new Error('El titular es muy corto.')
  const cuerpo = limpio_(x.cuerpo, 49000)
  if (cuerpo.length < 80) throw new Error('El texto de la nota es muy corto (mínimo 80 letras).')
  const seccion = limpio_(x.seccion, 40)
  if (!seccion) throw new Error('Elige la sección.')
  const ambito = AMBITOS.indexOf(String(x.ambito || '')) >= 0 ? String(x.ambito) : 'REGIONAL'
  const ahora = new Date()
  const lima = new Date(ahora.getTime() - 5 * 3600e3).toISOString()
  const dia = DIA.test(x.dia || '') ? x.dia : lima.slice(0, 10)
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    const h = hoja_(H_PROPIAS, COLS_PROPIA)
    const ids = h.getLastRow() > 1 ? h.getRange(2, 1, h.getLastRow() - 1, 1).getValues().map(function (f) { return Number(f[0]) || 0 }) : []
    const id = Math.max(PROPIA_ID_BASE, Math.max.apply(null, ids.concat([0]))) + 1
    let foto = ''
    if (x.foto && x.foto.b64) {
      const tipo = String(x.foto.tipo || 'image/jpeg')
      const ext = tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg'
      foto = guardarFoto_('propia-' + id + '.' + ext, x.foto.b64, tipo).getId()
    }
    const slug = slug_(titular) + '-' + id
    h.appendRow([id, dia, lima.slice(0, 19), seccion, ambito, limpio_(x.antetitulo, 200), titular, limpio_(x.bajada, 600),
      cuerpo, limpio_(x.lugar, 80), foto, slug, u.usuario, ahora])
    registrar_(u.usuario, 'crear_nota', id, titular)
    CacheService.getScriptCache().remove('ediciones')
    return { id: id, slug: slug }
  } finally {
    lock.releaseLock()
  }
}

function propias_() {
  return filas_(hoja_(H_PROPIAS, COLS_PROPIA))
}

/** Notas propias tal como las necesita la web (van dentro de las ediciones públicas, en «_nuevas»). */
function propiasPublicas_() {
  return propias_().map(function (n) {
    return {
      id: Number(n.id), dia: texto_(n.dia).slice(0, 10), fecha: texto_(n.fecha), seccion: String(n.seccion), ambito: String(n.ambito),
      antetitulo: String(n.antetitulo || ''), titular: String(n.titular), bajada: String(n.bajada || ''),
      cuerpo: String(n.cuerpo || '').split(/\n\s*\n/).map(function (p) { return p.trim() }).filter(String),
      lugar: String(n.lugar || ''), foto: String(n.foto || ''), slug: String(n.slug),
    }
  })
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

// ------------------------------------------------------------------ avisos del público (Alerta Mascota, Anuncios)
// La gente manda su aviso desde la web; queda «pendiente» y no se ve hasta que un editor lo aprueba en /admin.
// La foto se guarda en una carpeta propia de Drive, privada; al aprobar el aviso se comparte «con el enlace»
// para que la web la pueda mostrar, y al rechazarlo vuelve a quedar privada.
//
// Ciclo de vida y datos personales (el número y la ubicación exacta no se guardan para siempre):
//   1. ACTIVO     aprobado y con menos de `dias` (mascotas 60, anuncios 30): se ve con su número y el punto exacto.
//   2. ARCHIVO    resuelto, o aprobado que ya venció: sigue en la web (pestaña «Archivo») pero SIN número,
//                 SIN nombre de quien publicó y con la ubicación redondeada a ~1 km (barrio, no la casa).
//   3. DEPURADO   30 días después de pasar al archivo, la limpieza diaria BORRA de la hoja el número, el enlace, el nombre
//                 y la ubicación exacta (queda la aproximada). La publicación (texto, foto, zona) se conserva.
//   Rechazados y pendientes sin revisar de más de 30 días: se borran número, nombre, texto y ubicación,
//   y la foto va a la papelera de Drive.
//   La limpieza corre sola cada madrugada (activador que crea «Inicializar») y también desde el menú.
const ESTADOS_AVISO = ['pendiente', 'aprobado', 'rechazado', 'resuelto']
const AVISOS = {
  mascotas: {
    hoja: 'Mascotas', carpeta: 'Alerta Mascota', prefijo: 'M', dias: 60,
    cols: ['id', 'creado', 'estado', 'tipo', 'especie', 'nombre', 'descripcion', 'provincia', 'zona', 'lat', 'lng', 'fecha_hecho',
      'contacto', 'autor', 'foto', 'enlace', 'moderador', 'moderado', 'nota_editor', 'cerrado', 'depurado',
      'clave', 'actualizacion', 'actualizado', 'desenlace'],
    tipos: ['perdido', 'encontrado', 'maltrato', 'adopcion'],
    carpetas: { perdido: 'Perdidos', encontrado: 'Encontrados', maltrato: 'Maltrato', adopcion: 'Adopción y ayuda' },
    especies: ['perro', 'gato', 'otro'],
  },
  anuncios: {
    hoja: 'Anuncios', carpeta: 'Anuncios', prefijo: 'A', dias: 30,
    cols: ['id', 'creado', 'estado', 'tipo', 'titulo', 'descripcion', 'provincia', 'zona', 'lat', 'lng', 'precio',
      'contacto', 'autor', 'foto', 'enlace', 'moderador', 'moderado', 'nota_editor', 'cerrado', 'depurado',
      'clave', 'actualizacion', 'actualizado', 'desenlace'],
    tipos: ['venta', 'compra', 'alquiler', 'empleo', 'busco_empleo', 'servicios', 'eventos', 'otros'],
    carpetas: { venta: 'Vendo', compra: 'Compro', alquiler: 'Alquilo', empleo: 'Ofertas de empleo', busco_empleo: 'Busco empleo',
      servicios: 'Servicios', eventos: 'Eventos', otros: 'Otros' },
  },
  // Denuncias ciudadanas: NUNCA salen en la web. Llegan a la redacción, que las verifica y decide si hace una nota.
  denuncias: {
    hoja: 'Denuncias', carpeta: 'Denuncias ciudadanas', prefijo: 'D', dias: 90, privada: true, anonima: true,
    cols: ['id', 'creado', 'estado', 'tipo', 'descripcion', 'provincia', 'zona', 'lat', 'lng',
      'contacto', 'autor', 'foto', 'enlace', 'moderador', 'moderado', 'nota_editor', 'cerrado', 'depurado',
      'clave', 'actualizacion', 'actualizado', 'desenlace'],
    tipos: ['servicios', 'seguridad', 'corrupcion', 'salud', 'educacion', 'ambiente', 'transporte', 'otro'],
    carpetas: { servicios: 'Servicios públicos', seguridad: 'Seguridad', corrupcion: 'Corrupción', salud: 'Salud',
      educacion: 'Educación', ambiente: 'Medio ambiente', transporte: 'Transporte', otro: 'Otros' },
  },
}
const AVISOS_POR_CONTACTO = 3          // avisos por número en 6 horas
const AVISOS_POR_HORA = 80             // tope general por hora (contra envíos masivos)
const DEPURAR_DIAS = 30               // días en el archivo antes de borrar número, nombre y ubicación exacta
const DESCARTE_DIAS = 30               // rechazados o pendientes sin revisar: se limpian a los 30 días
const PROVINCIAS = ['puno', 'san-roman', 'azangaro', 'melgar', 'el-collao', 'chucuito', 'yunguyo', 'huancane', 'moho',
  'putina', 'lampa', 'carabaya', 'sandia', 'otra']

function seccionAviso_(s) {
  const c = AVISOS[String(s || '')]
  if (!c) throw new Error('Sección inválida.')
  return c
}

function carpetaAvisos_(seccion, tipo) {
  const c = seccionAviso_(seccion)
  if (!tipo) return carpetaRuta_([c.carpeta])
  return carpetaRuta_([c.carpeta, c.carpetas[tipo] || 'Otros', mes_()])
}

/** Enlace opcional a la publicación de Facebook del aviso (solo Facebook: evita enlaces a sitios dudosos). */
function enlaceFacebook_(v) {
  const u = String(v || '').trim()
  if (!u) return ''
  if (u.length > 400 || !/^https:\/\/(www\.|m\.|web\.)?(facebook\.com|fb\.com|fb\.watch)\/\S+$/i.test(u)) {
    throw new Error('El enlace debe ser de una publicación de Facebook (https://www.facebook.com/…).')
  }
  return u
}

/** Celular peruano → «51XXXXXXXXX» (para el enlace de WhatsApp). */
function celular_(v) {
  let n = String(v || '').replace(/\D/g, '')
  if (n.length === 11 && n.indexOf('51') === 0) n = n.slice(2)
  if (!/^9\d{8}$/.test(n)) throw new Error('Pon un celular de 9 dígitos que empiece con 9.')
  return '51' + n
}

function coordenada_(v, min, max) {
  if (v === '' || v == null) return ''
  const n = Number(v)
  if (!isFinite(n) || n < min || n > max) throw new Error('La ubicación del mapa no es válida.')
  return Math.round(n * 1e5) / 1e5
}

function enviarAviso_(d) {
  const seccion = String(d.seccion || '')
  const c = seccionAviso_(seccion)
  const x = d.datos || {}
  if (x.web) return { id: 'ok' }                       // trampa para robots: el campo oculto vino lleno
  const tipo = String(x.tipo || '')
  if (c.tipos.indexOf(tipo) < 0) throw new Error('Elige el tipo de aviso.')
  const descripcion = limpio_(x.descripcion, 1200)
  if (descripcion.length < 15) throw new Error('Cuenta un poco más en la descripción (mínimo 15 letras).')
  const zona = limpio_(x.zona, 150)
  if (zona.length < 3) throw new Error('Escribe la zona o barrio.')
  const provincia = String(x.provincia || '')
  if (PROVINCIAS.indexOf(provincia) < 0) throw new Error('Elige la provincia.')
  const contacto = c.anonima && !String(x.contacto || '').trim() ? '' : celular_(x.contacto)
  const enlace = enlaceFacebook_(x.enlace)
  const lat = coordenada_(x.lat, -18.5, 0)
  const lng = coordenada_(x.lng, -81.5, -68.5)
  if ((lat === '') !== (lng === '')) throw new Error('La ubicación del mapa no es válida.')

  const cache = CacheService.getScriptCache()
  const kNum = 'aviso_num:' + (contacto || 'anonimo')
  const lima = new Date(Date.now() - 5 * 3600e3).toISOString()      // hora de Lima (UTC−5, sin horario de verano)
  const kHora = 'aviso_hora:' + lima.slice(0, 13)
  const porNum = Number(cache.get(kNum) || 0)
  const porHora = Number(cache.get(kHora) || 0)
  if (contacto && porNum >= AVISOS_POR_CONTACTO) throw new Error('Ya enviaste varios avisos. Espera unas horas o escríbenos por WhatsApp.')
  if (porHora >= AVISOS_POR_HORA) throw new Error('Hay muchos avisos en este momento. Intenta en un rato.')

  const id = c.prefijo + lima.slice(2, 10).replace(/-/g, '') + '-' +
    aleatorio_(8).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)
  let foto = ''
  if (d.foto && d.foto.b64) {
    const tipoFoto = String(d.foto.tipo || 'image/jpeg')
    const bytes = Utilities.base64Decode(d.foto.b64)
    if (bytes.length > FOTO_MAX_BYTES) throw new Error('La foto pesa demasiado (máx. 8 MB).')
    if (!/^image\/(jpeg|png|webp)$/.test(tipoFoto)) throw new Error('Formato de foto no admitido (JPG, PNG o WEBP).')
    const ext = tipoFoto === 'image/png' ? 'png' : tipoFoto === 'image/webp' ? 'webp' : 'jpg'
    foto = carpetaAvisos_(seccion, tipo).createFile(Utilities.newBlob(bytes, tipoFoto, id + '.' + ext)).getId()
  }

  const v = {
    id: id, creado: new Date(), estado: 'pendiente', tipo: tipo, descripcion: descripcion, provincia: provincia, zona: zona,
    lat: lat, lng: lng, contacto: contacto ? "'" + contacto : '', autor: limpio_(x.autor, 60), foto: foto, enlace: enlace, moderador: '', moderado: '',
    nota_editor: '', cerrado: '', depurado: '', actualizacion: '', actualizado: '', desenlace: '',
  }
  // Código para que quien publicó gestione su aviso sin cuenta (se guarda cifrado, como las claves del panel).
  const clave = aleatorio_(8).toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6) + aleatorio_(2).toUpperCase().replace(/[^A-Z2-9]/g, 'K')
  v.clave = hash_(clave, id)
  if (seccion === 'mascotas') {
    v.especie = c.especies.indexOf(x.especie) >= 0 ? x.especie : 'otro'
    v.nombre = limpio_(x.nombre, 60)
    v.fecha_hecho = /^\d{4}-\d{2}-\d{2}$/.test(x.fecha_hecho || '') ? x.fecha_hecho : ''
  } else if (seccion === 'anuncios') {
    v.titulo = limpio_(x.titulo, 90)
    if (v.titulo.length < 4) throw new Error('Ponle un título al anuncio.')
    v.precio = limpio_(x.precio, 40)
  }
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    hoja_(c.hoja, c.cols).appendRow(c.cols.map(function (k) { return v[k] === undefined ? '' : v[k] }))
  } finally {
    lock.releaseLock()
  }
  cache.put(kNum, String(porNum + 1), 6 * 3600)
  cache.put(kHora, String(porHora + 1), 3600)
  return { id: id, clave: clave }
}

/** Fecha (Date o texto) → milisegundos; 0 si no hay. */
function ms_(v) {
  if (v instanceof Date) return v.getTime()
  const t = v ? new Date(v).getTime() : NaN
  return isNaN(t) ? 0 : t
}

/** Cuándo dejó de estar activo (pasó al archivo); 0 si sigue activo o nunca se publicó. */
function cierre_(c, a, ahora) {
  if (a.estado === 'resuelto') return ms_(a.cerrado) || ms_(a.moderado) || ms_(a.creado)
  if (a.estado === 'aprobado') {
    const vence = (ms_(a.moderado) || ms_(a.creado)) + c.dias * 864e5
    return vence <= ahora ? vence : 0
  }
  return 0
}

/** «activo», «archivo» o '' (no se muestra en la web). */
function etapa_(c, a, ahora) {
  if (a.estado !== 'aprobado' && a.estado !== 'resuelto') return ''
  return cierre_(c, a, ahora) ? 'archivo' : 'activo'
}

/** Coordenada redondeada a 2 decimales (~1 km): el barrio, no la casa. */
function aprox_(v) {
  return v === '' || v == null ? null : Math.round(Number(v) * 100) / 100
}

/** Aviso tal como lo ve la web. En el archivo no van el número, ni el nombre, ni el punto exacto. */
function avisoPublico_(seccion, a, etapa) {
  const archivo = etapa === 'archivo'
  const o = {
    id: String(a.id), creado: texto_(a.creado), estado: String(a.estado), etapa: etapa || '', tipo: String(a.tipo),
    descripcion: String(a.descripcion), provincia: String(a.provincia || ''), zona: String(a.zona),
    lat: archivo ? aprox_(a.lat) : a.lat === '' ? null : Number(a.lat),
    lng: archivo ? aprox_(a.lng) : a.lng === '' ? null : Number(a.lng),
    contacto: archivo ? '' : String(a.contacto).replace(/^'/, ''), autor: archivo ? '' : String(a.autor || ''),
    foto: String(a.foto || ''), enlace: archivo ? '' : String(a.enlace || ''),
    novedades: novedades_(a).map(function (n) { return { texto: n.t, fecha: n.f, foto: n.foto || '' } }).reverse(),
    desenlace: String(a.desenlace || ''),
  }
  if (seccion === 'mascotas') {
    o.especie = String(a.especie)
    o.nombre = String(a.nombre || '')
    o.fecha_hecho = texto_(a.fecha_hecho).slice(0, 10)
    if (a.tipo === 'maltrato') { o.contacto = ''; o.autor = ''; o.enlace = '' }          // quien denuncia nunca sale en la web
  } else if (seccion === 'anuncios') {
    o.titulo = String(a.titulo)
    o.precio = String(a.precio || '')
  }
  return o
}

function avisosPublicos_(seccion) {
  const c = seccionAviso_(seccion)
  if (c.privada) throw new Error('Sección inválida.')
  const cache = CacheService.getScriptCache()
  const k = 'avisos:' + seccion
  const hit = cache.get(k)
  if (hit) return JSON.parse(hit)
  const ahora = Date.now()
  const activos = []
  const archivo = []
  filas_(hoja_(c.hoja, c.cols)).forEach(function (a) {
    const e = etapa_(c, a, ahora)
    if (e === 'activo') activos.push(avisoPublico_(seccion, a, e))
    else if (e === 'archivo') archivo.push(avisoPublico_(seccion, a, e))
  })
  const out = { avisos: activos.reverse().concat(archivo.reverse().slice(0, 300)) }
  const s = JSON.stringify(out)
  if (s.length < 90000) cache.put(k, s, 120)
  return out
}

function avisosAdmin_(d) {
  sesion_(d)
  const seccion = String(d.seccion || '')
  const c = seccionAviso_(seccion)
  const estado = String(d.estado || 'pendiente')
  const lista = filas_(hoja_(c.hoja, c.cols))
    .filter(function (a) { return estado === 'todos' || a.estado === estado })
    .map(function (a) {
      return Object.assign(avisoPublico_(seccion, a, ''), {
        contacto: String(a.contacto).replace(/^'/, ''), autor: String(a.autor || ''), enlace: String(a.enlace || ''),
        lat: a.lat === '' ? null : Number(a.lat), lng: a.lng === '' ? null : Number(a.lng),
        etapa: etapa_(c, a, Date.now()), depurado: texto_(a.depurado),
        moderador: String(a.moderador || ''), moderado: texto_(a.moderado), nota_editor: String(a.nota_editor || ''),
      })
    })
    .reverse()
    .slice(0, 200)
  const pendientes = {}
  Object.keys(AVISOS).forEach(function (s) {
    pendientes[s] = filas_(hoja_(AVISOS[s].hoja, AVISOS[s].cols)).filter(function (a) { return a.estado === 'pendiente' }).length
  })
  return { avisos: lista, pendientes: pendientes }
}

function moderarAviso_(d) {
  const u = sesion_(d)
  const seccion = String(d.seccion || '')
  const c = seccionAviso_(seccion)
  const estado = String(d.estado || '')
  if (ESTADOS_AVISO.indexOf(estado) < 0) throw new Error('Estado inválido.')
  const h = hoja_(c.hoja, c.cols)
  const ids = h.getRange(1, 1, Math.max(1, h.getLastRow()), 1).getValues()
  let fila = 0
  for (let i = 1; i < ids.length; i++) if (String(ids[i][0]) === String(d.id)) fila = i + 1
  if (!fila) throw new Error('Aviso no encontrado.')
  const col = function (k) { return c.cols.indexOf(k) + 1 }
  const foto = String(h.getRange(fila, col('foto')).getValue() || '')
  h.getRange(fila, col('estado')).setValue(estado)
  h.getRange(fila, col('moderador')).setValue(u.usuario)
  h.getRange(fila, col('moderado')).setValue(new Date())
  h.getRange(fila, col('cerrado')).setValue(estado === 'resuelto' ? new Date() : '')
  if (d.nota != null) h.getRange(fila, col('nota_editor')).setValue(limpio_(d.nota, 300))
  const publica = (estado === 'aprobado' || estado === 'resuelto') && !c.privada
  if (foto) compartirFoto_(seccion, foto, publica)
  const filaDatos = {}
  c.cols.forEach(function (k, j) { filaDatos[k] = h.getRange(fila, j + 1).getValue() })
  novedades_(filaDatos).forEach(function (n) { if (n.foto) compartirFoto_(seccion, n.foto, publica) })
  registrar_(u.usuario, 'aviso_' + estado, d.id, c.hoja)
  CacheService.getScriptCache().remove('avisos:' + seccion)
  return {}
}

/** Limpieza diaria de datos personales (ver el ciclo de vida arriba). Devuelve cuántos avisos limpió. */
function depurarAvisos() {
  const ahora = Date.now()
  let n = 0
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    Object.keys(AVISOS).forEach(function (seccion) {
      const c = AVISOS[seccion]
      const h = hoja_(c.hoja, c.cols)
      const v = h.getDataRange().getValues()
      const cab = v[0] || []
      const k = function (nombre) { return cab.indexOf(nombre) }
      for (let i = 1; i < v.length; i++) {
        const a = {}
        cab.forEach(function (nombre, j) { a[nombre] = v[i][j] })
        if (a.id === '' || a.depurado) continue
        const descarte = (a.estado === 'rechazado' || a.estado === 'pendiente') &&
          ahora - (ms_(a.moderado) || ms_(a.creado)) > DESCARTE_DIAS * 864e5
        const cerrado = cierre_(c, a, ahora)
        const archivoViejo = cerrado && ahora - cerrado > DEPURAR_DIAS * 864e5
        if (!descarte && !archivoViejo) continue
        const fila = v[i].slice()
        fila[k('contacto')] = ''
        fila[k('autor')] = ''
        fila[k('enlace')] = ''
        fila[k('clave')] = ''
        fila[k('depurado')] = new Date()
        if (descarte) {
          fila[k('descripcion')] = '(borrado: aviso no publicado)'
          fila[k('lat')] = ''
          fila[k('lng')] = ''
          if (a.foto) {
            try { fotoAvisoArchivo_(seccion, a.foto).setTrashed(true) } catch (e) { /* ya no estaba */ }
            fila[k('foto')] = ''
          }
          novedades_(a).forEach(function (nv) {
            if (nv.foto) try { fotoAvisoArchivo_(seccion, nv.foto).setTrashed(true) } catch (e) { /* ya no estaba */ }
          })
          fila[k('actualizacion')] = ''
        } else {
          fila[k('lat')] = a.lat === '' ? '' : aprox_(a.lat)
          fila[k('lng')] = a.lng === '' ? '' : aprox_(a.lng)
        }
        h.getRange(i + 1, 1, 1, fila.length).setValues([fila])
        n++
      }
      CacheService.getScriptCache().remove('avisos:' + seccion)
    })
  } finally {
    lock.releaseLock()
  }
  if (n) registrar_('sistema', 'depurar_avisos', '', n + ' aviso(s): datos personales borrados')
  return n
}

function depurarAvisosMenu() {
  SpreadsheetApp.getUi().alert('Limpieza hecha: ' + depurarAvisos() + ' aviso(s) sin datos personales.')
}

/** Crea (una sola vez) el activador que corre la limpieza cada madrugada. */
function activarDepuracion_() {
  const ya = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'depurarAvisos' })
  if (!ya) ScriptApp.newTrigger('depurarAvisos').timeBased().everyDays(1).atHour(3).create()
}


// ------------------------------------------------------------------ gestión por quien publicó (sin cuenta)
// Al enviar, la persona recibe un código. Con el id del aviso y ese código puede: ver en qué estado está,
// contar una novedad («lo vieron por el mercado») y cerrar el aviso explicando cómo terminó («volvió a casa»).
// El código se guarda cifrado; tras 8 intentos fallidos el aviso se bloquea 15 minutos. Se borra con la limpieza.
const GESTION_INTENTOS = 8

/** Quita números de celular o DNI de un texto público (7 o más dígitos seguidos, con o sin espacios). */
function sinNumeros_(t) {
  return String(t || '').replace(/(?:\d[\s.-]?){7,}/g, '[número oculto]')
}

/** Fila del aviso si el código es correcto; si no, error (y cuenta el intento). */
function avisoConClave_(d) {
  const seccion = String(d.seccion || '')
  const c = seccionAviso_(seccion)
  const id = String(d.id || '').trim().toUpperCase()
  const cache = CacheService.getScriptCache()
  const kInt = 'gestion:' + id
  const intentos = Number(cache.get(kInt) || 0)
  if (intentos >= GESTION_INTENTOS) throw new Error('Demasiados intentos. Espera 15 minutos.')
  const h = hoja_(c.hoja, c.cols)
  const v = h.getDataRange().getValues()
  const cab = v[0] || []
  for (let i = 1; i < v.length; i++) {
    if (String(v[i][0]).toUpperCase() !== id) continue
    const a = {}
    cab.forEach(function (nombre, j) { a[nombre] = v[i][j] })
    const clave = String(d.clave || '').trim().toUpperCase()
    if (a.clave && clave && hash_(clave, String(a.id)) === a.clave) {
      cache.remove(kInt)
      return { c: c, h: h, fila: i + 1, a: a, seccion: seccion, col: function (k) { return cab.indexOf(k) + 1 } }
    }
    break
  }
  cache.put(kInt, String(intentos + 1), BLOQUEO_SEG)
  throw new Error('El código o el número de aviso no coinciden.')
}

function miAviso_(d) {
  const x = avisoConClave_(d)
  const etapa = etapa_(x.c, x.a, Date.now())
  return {
    aviso: Object.assign(avisoPublico_(x.seccion, x.a, etapa), {
      estado: String(x.a.estado), etapa: etapa,
      contacto: String(x.a.contacto).replace(/^'/, ''), autor: String(x.a.autor || ''),
    }),
  }
}

/** Novedades del aviso: lista JSON [{t, f, foto}] en la columna «actualizacion» (acepta el texto suelto de antes). */
function novedades_(a) {
  const v = String(a.actualizacion || '').trim()
  if (!v) return []
  if (v[0] === '[') {
    try {
      return JSON.parse(v)
    } catch (e) { /* texto que no es lista */ }
  }
  return [{ t: v, f: texto_(a.actualizado) }]
}

const NOVEDADES_MAX = 10

function actualizarAviso_(d) {
  const x = avisoConClave_(d)
  if (x.a.estado !== 'pendiente' && x.a.estado !== 'aprobado') throw new Error('Este aviso ya está cerrado.')
  const texto = sinNumeros_(limpio_(d.texto, 400))
  if (texto.length < 5) throw new Error('Escribe la novedad.')
  const lista = novedades_(x.a)
  if (lista.length >= NOVEDADES_MAX) throw new Error('Este aviso ya tiene ' + NOVEDADES_MAX + ' novedades. Si cambió algo importante, escríbenos por WhatsApp.')
  let foto = ''
  if (d.foto && d.foto.b64) {
    const tipoFoto = String(d.foto.tipo || 'image/jpeg')
    const bytes = Utilities.base64Decode(d.foto.b64)
    if (bytes.length > FOTO_MAX_BYTES) throw new Error('La foto pesa demasiado (máx. 8 MB).')
    if (!/^image\/(jpeg|png|webp)$/.test(tipoFoto)) throw new Error('Formato de foto no admitido (JPG, PNG o WEBP).')
    const ext = tipoFoto === 'image/png' ? 'png' : tipoFoto === 'image/webp' ? 'webp' : 'jpg'
    const f = carpetaAvisos_(x.seccion, String(x.a.tipo)).createFile(
      Utilities.newBlob(bytes, tipoFoto, x.a.id + '-novedad' + (lista.length + 1) + '.' + ext))
    foto = f.getId()
    if (x.a.estado === 'aprobado' && !x.c.privada) compartirFoto_(x.seccion, foto, true)
  }
  lista.push({ t: texto, f: texto_(new Date()), foto: foto })
  x.h.getRange(x.fila, x.col('actualizacion')).setValue(JSON.stringify(lista))
  x.h.getRange(x.fila, x.col('actualizado')).setValue(new Date())
  registrar_('publico', 'aviso_novedad', x.a.id, x.c.hoja + (foto ? ' (con foto)' : ''))
  CacheService.getScriptCache().remove('avisos:' + x.seccion)
  return { novedades: lista.length }
}

/** Pone o corrige el punto del mapa: un editor (sesión) o quien publicó (id + código). */
function ubicarAviso_(d) {
  let x
  if (d.token) {
    const u = sesion_(d)
    const seccion = String(d.seccion || '')
    const c = seccionAviso_(seccion)
    const h = hoja_(c.hoja, c.cols)
    const ids = h.getRange(1, 1, Math.max(1, h.getLastRow()), 1).getValues()
    let fila = 0
    for (let i = 1; i < ids.length; i++) if (String(ids[i][0]) === String(d.id)) fila = i + 1
    if (!fila) throw new Error('Aviso no encontrado.')
    x = { c: c, h: h, fila: fila, seccion: seccion, usuario: u.usuario, col: function (k) { return c.cols.indexOf(k) + 1 } }
  } else {
    x = avisoConClave_(d)
    x.usuario = 'publico'
  }
  const lat = coordenada_(d.lat, -18.5, 0)
  const lng = coordenada_(d.lng, -81.5, -68.5)
  if ((lat === '') !== (lng === '')) throw new Error('La ubicación del mapa no es válida.')
  x.h.getRange(x.fila, x.col('lat')).setValue(lat)
  x.h.getRange(x.fila, x.col('lng')).setValue(lng)
  registrar_(x.usuario, 'aviso_ubicacion', d.id, x.c.hoja)
  CacheService.getScriptCache().remove('avisos:' + x.seccion)
  return {}
}

/** Cierra el aviso con su desenlace. Si aún no estaba publicado, solo se retira (nunca llega a la web). */
function cerrarAviso_(d) {
  const x = avisoConClave_(d)
  if (x.a.estado !== 'pendiente' && x.a.estado !== 'aprobado') throw new Error('Este aviso ya está cerrado.')
  const desenlace = sinNumeros_(limpio_(d.desenlace, 400))
  if (desenlace.length < 3) throw new Error('Cuéntanos cómo terminó.')
  const publicado = x.a.estado === 'aprobado'
  x.h.getRange(x.fila, x.col('estado')).setValue(publicado ? 'resuelto' : 'rechazado')
  x.h.getRange(x.fila, x.col('cerrado')).setValue(new Date())
  x.h.getRange(x.fila, x.col('desenlace')).setValue(desenlace)
  if (!publicado) x.h.getRange(x.fila, x.col('nota_editor')).setValue('Retirado por quien lo publicó antes de aprobarse.')
  registrar_('publico', publicado ? 'aviso_cerrado' : 'aviso_retirado', x.a.id, x.c.hoja + ': ' + desenlace.slice(0, 80))
  CacheService.getScriptCache().remove('avisos:' + x.seccion)
  return { estado: publicado ? 'resuelto' : 'retirado' }
}


function compartirFoto_(seccion, id, publica) {
  try {
    const f = fotoAvisoArchivo_(seccion, id)
    f.setSharing(publica ? DriveApp.Access.ANYONE_WITH_LINK : DriveApp.Access.PRIVATE,
      publica ? DriveApp.Permission.VIEW : DriveApp.Permission.NONE)
  } catch (e) { /* si Drive no deja compartir, la web muestra el aviso sin foto */ }
}

function fotoAvisoArchivo_(seccion, id) {
  const f = DriveApp.getFileById(String(id || ''))
  if (dentroDe_(f, carpetaAvisos_(seccion).getId())) return f
  throw new Error('Foto no encontrada.')
}

/** El panel ve la foto de un aviso aunque siga privada (pendiente). */
function fotoAviso_(d) {
  sesion_(d)
  const f = fotoAvisoArchivo_(String(d.seccion || ''), d.foto)
  return { tipo: f.getMimeType(), b64: Utilities.base64Encode(f.getBlob().getBytes()) }
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
  const fijas = [H_HOY, H_EDICIONES, H_PROPIAS, H_USUARIOS, H_REGISTRO, AVISOS.mascotas.hoja, AVISOS.anuncios.hoja, AVISOS.denuncias.hoja]
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
