// Pruebas del servidor del panel (Code.gs) sobre el simulador local.  Uso: node apps-script/pruebas/pruebas.mjs
import assert from 'node:assert/strict'
import { crearGoogle } from './simulador.mjs'

let ok = 0
let mal = 0
const prueba = (nombre, f) => {
  try {
    f()
    ok++
    console.log(`  ✔ ${nombre}`)
  } catch (e) {
    mal++
    console.log(`  ✘ ${nombre}\n      ${e.message.split('\n').join('\n      ')}`)
  }
}

const G = crearGoogle()
const notas = () => G.carpetas.find((c) => c.ruta() === 'Altiplano al Día/Notas')
let claveAdmin, claveApi, tokenAdmin, tokenEditor
const NOTAS = [
  { id: 101, fecha: '2026-11-07T10:00:00', seccion: 'politica', antetitulo: 'ANTE', titular: 'Titular uno', bajada: 'Bajada uno',
    cuerpo: ['Párrafo 1.', 'Párrafo 2.'], lugar: 'Puno', imagen: 'img/noticias/n101-aaaa1111.jpg', slug: 'titular-uno' },
  { id: 102, fecha: '2026-11-07T11:00:00', seccion: 'seguridad', antetitulo: '', titular: '=HYPERLINK("x")', bajada: '-menos',
    cuerpo: ['Texto.'], lugar: 'Juliaca', imagen: '', slug: 'titular-dos' },
]
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64')

console.log('\nInicialización')
prueba('crea las hojas, la carpeta de Drive, el admin y la clave API', () => {
  G.api.inicializar()
  for (const h of ['Hoy', 'Ediciones', 'Usuarios', 'Registro']) assert.ok(G.hoja(h), `falta la hoja ${h}`)
  const rutas = G.carpetas.map((c) => c.ruta())
  for (const r of ['Altiplano al Día/Notas', 'Altiplano al Día/Alerta Mascota/Perdidos', 'Altiplano al Día/Anuncios/Ofertas de empleo',
    'Altiplano al Día/Denuncias ciudadanas/Seguridad']) assert.ok(rutas.includes(r), `falta la carpeta ${r}`)
  for (const h of ['Mascotas', 'Anuncios', 'Denuncias']) assert.ok(G.hoja(h), `falta la hoja ${h}`)
  const m = G.alertas.at(-1).match(/Clave: (\S+)[\s\S]*Clave API del maquetador:\n(\S+)/)
  assert.ok(m, 'no mostró las claves')
  ;[, claveAdmin, claveApi] = m
  assert.equal(claveAdmin.length, 12)
  assert.equal(claveApi.length, 32)
  assert.equal(G.hoja('Usuarios').getLastRow(), 2)
})
prueba('la clave del admin se guarda cifrada (nunca en texto plano)', () => {
  const fila = G.hoja('Usuarios').datos[1]
  assert.ok(!fila.includes(claveAdmin))
  assert.equal(fila[2], 'admin')
  assert.ok(fila[4].length > 20)
})
prueba('inicializar otra vez no duplica el admin ni cambia la clave API', () => {
  G.api.inicializar()
  assert.equal(G.hoja('Usuarios').getLastRow(), 2)
  assert.equal(G.props.get('API_CLAVE'), claveApi)
})

console.log('\nMaquetador → Sheets / Drive')
prueba('publicar con clave API incorrecta se rechaza', () => {
  const r = G.post({ accion: 'publicar', clave: 'x', dia: '2026-11-07', notas: NOTAS })
  assert.equal(r.ok, false)
  assert.match(r.error, /Clave API/)
})
prueba('fotos_faltan + subir_foto guardan la foto en Drive una sola vez', () => {
  const f = G.post({ accion: 'fotos_faltan', clave: claveApi, nombres: ['n101-aaaa1111.jpg'] })
  assert.deepEqual(f.faltan, ['n101-aaaa1111.jpg'])
  const s = G.post({ accion: 'subir_foto', clave: claveApi, nombre: 'n101-aaaa1111.jpg', tipo: 'image/jpeg', b64: JPG.toString('base64') })
  assert.equal(s.ok, true, s.error)
  assert.equal(G.post({ accion: 'fotos_faltan', clave: claveApi, nombres: ['n101-aaaa1111.jpg'] }).faltan.length, 0)
  G.post({ accion: 'subir_foto', clave: claveApi, nombre: 'n101-aaaa1111.jpg', tipo: 'image/jpeg', b64: JPG.toString('base64') })
  assert.equal(notas().todos().length, 1, 'duplicó la foto')
})
prueba('subir_foto rechaza nombres peligrosos y formatos raros', () => {
  assert.equal(G.post({ accion: 'subir_foto', clave: claveApi, nombre: '../x.jpg', b64: 'AA==' }).ok, false)
  assert.equal(G.post({ accion: 'subir_foto', clave: claveApi, nombre: 'x.gif', b64: 'AA==' }).ok, false)
})
prueba('publicar escribe «Hoy» y la hoja del día, con el enlace de Drive', () => {
  const r = G.post({ accion: 'publicar', clave: claveApi, dia: '2026-11-07', notas: NOTAS })
  assert.equal(r.ok, true, r.error)
  assert.equal(r.notas, 2)
  for (const n of ['Hoy', '2026-11-07']) {
    const h = G.hoja(n)
    assert.equal(h.getLastRow(), 3, n)
    assert.equal(h.datos[1][7], 'Párrafo 1.\n\nPárrafo 2.')
    assert.match(h.datos[1][11], /^https:\/\/drive\.google\.com\//)
    assert.equal(h.datos[2][11], '')
  }
})
prueba('un titular que empieza con «=» o «-» no se ejecuta como fórmula', () => {
  assert.equal(G.hoja('2026-11-07').formulas, undefined)
  assert.equal(G.hoja('2026-11-07').datos[2][5], '=HYPERLINK("x")')
})
prueba('volver a publicar el día reemplaza (no duplica) y quita notas que ya no van', () => {
  G.post({ accion: 'publicar', clave: claveApi, dia: '2026-11-07', notas: [NOTAS[0]] })
  assert.equal(G.hoja('2026-11-07').getLastRow(), 2)
  G.post({ accion: 'publicar', clave: claveApi, dia: '2026-11-07', notas: NOTAS })
  assert.equal(G.hoja('2026-11-07').getLastRow(), 3)
})
prueba('cada día queda en su hoja (archivo) y las hojas se ordenan', () => {
  G.post({ accion: 'publicar', clave: claveApi, dia: '2026-11-06', notas: [{ ...NOTAS[0], id: 90, slug: 'ayer' }] })
  assert.deepEqual(G.hojas.map((h) => h.nombre), ['Hoy', 'Ediciones', 'Propias', 'Usuarios', 'Registro', 'Mascotas', 'Anuncios', 'Denuncias', 'Credenciales', '2026-11-07', '2026-11-06'])
  assert.equal(G.hoja('Hoy').datos[1][0], 90, '«Hoy» es la última publicación')
  G.post({ accion: 'publicar', clave: claveApi, dia: '2026-11-07', notas: NOTAS })
})
prueba('día con formato inválido se rechaza', () => {
  assert.equal(G.post({ accion: 'publicar', clave: claveApi, dia: 'Hoy', notas: [] }).ok, false)
})

console.log('\nIngreso')
prueba('clave incorrecta: rechazo con mensaje genérico', () => {
  const r = G.post({ accion: 'login', usuario: 'admin', clave: 'mala' })
  assert.equal(r.ok, false)
  assert.equal(r.error, 'Usuario o clave incorrectos.')
  assert.equal(G.post({ accion: 'login', usuario: 'nadie', clave: 'x' }).error, 'Usuario o clave incorrectos.')
})
prueba('clave correcta: entrega token, nombre y rol (sin mayúsculas en el usuario)', () => {
  const r = G.post({ accion: 'login', usuario: ' ADMIN ', clave: claveAdmin })
  assert.equal(r.ok, true, r.error)
  assert.equal(r.rol, 'admin')
  assert.ok(r.token.length > 60)
  tokenAdmin = r.token
})
prueba('5 intentos fallidos bloquean el usuario 15 minutos', () => {
  for (let i = 0; i < 5; i++) G.post({ accion: 'login', usuario: 'admin', clave: 'mala' + i })
  const r = G.post({ accion: 'login', usuario: 'admin', clave: claveAdmin })
  assert.match(r.error, /Demasiados intentos/)
  G.cache.delete('intentos:admin')
})
prueba('sin token o con token falso: «Sesión vencida»', () => {
  assert.match(G.post({ accion: 'dias' }).error, /Sesión vencida/)
  assert.match(G.post({ accion: 'dias', token: 'falso' }).error, /Sesión vencida/)
})

console.log('\nNotas y ediciones')
prueba('dias: lista los días archivados, el más reciente primero', () => {
  assert.deepEqual(G.post({ accion: 'dias', token: tokenAdmin }).dias, ['2026-11-07', '2026-11-06'])
})
prueba('notas: devuelve la versión original y sin edición', () => {
  const r = G.post({ accion: 'notas', token: tokenAdmin, dia: '2026-11-07' })
  assert.equal(r.notas.length, 2)
  assert.equal(r.notas[0].original.titular, 'Titular uno')
  assert.equal(r.notas[0].edicion, null)
  assert.match(r.notas[0].foto_drive, /drive\.google\.com/)
})
prueba('editar guarda en «Ediciones» y lo registra', () => {
  const r = G.post({ accion: 'editar', token: tokenAdmin, id: 101, dia: '2026-11-07',
    cambios: { titular: 'Titular corregido', bajada: 'Nueva bajada', antetitulo: 'ANTE', cuerpo: 'Uno.\n\nDos.\n\n\nTres.', seccion: 'cultura', oculta: false } })
  assert.equal(r.ok, true, r.error)
  assert.equal(G.hoja('Ediciones').getLastRow(), 2)
  assert.equal(G.hoja('Registro').datos.at(-1)[2], 'editar')
})
prueba('editar dos veces la misma nota actualiza la fila (no duplica)', () => {
  G.post({ accion: 'editar', token: tokenAdmin, id: 101, dia: '2026-11-07', cambios: { titular: 'Titular corregido 2', cuerpo: 'Uno.\n\nDos.' } })
  assert.equal(G.hoja('Ediciones').getLastRow(), 2)
})
prueba('el titular no puede quedar vacío (salvo para ocultar)', () => {
  assert.match(G.post({ accion: 'editar', token: tokenAdmin, id: 102, cambios: { titular: '  ' } }).error, /titular/)
  assert.equal(G.post({ accion: 'editar', token: tokenAdmin, id: 102, dia: '2026-11-07', cambios: { oculta: true } }).ok, true)
})
prueba('ediciones públicas (para la web): párrafos, sección y ocultas', () => {
  G.cache.delete('ediciones')
  const e = G.get({ accion: 'ediciones' })
  assert.equal(e['101'].titular, 'Titular corregido 2')
  assert.deepEqual(e['101'].cuerpo, ['Uno.', 'Dos.'])
  assert.equal(e['102'].oculta, true)
  assert.equal(e.ok, undefined, 'la respuesta debe ser solo el mapa de ediciones')
})
prueba('notas: muestra la edición y quién la hizo', () => {
  const n = G.post({ accion: 'notas', token: tokenAdmin, dia: '2026-11-07' }).notas.find((x) => x.id === 101)
  assert.equal(n.edicion.titular, 'Titular corregido 2')
  assert.equal(n.edicion.usuario, 'admin')
  assert.match(n.edicion.fecha, /^\d{4}-\d{2}-\d{2}T/)
})
prueba('restaurar vuelve a la versión del maquetador', () => {
  assert.equal(G.post({ accion: 'restaurar', token: tokenAdmin, id: 102 }).ok, true)
  G.cache.delete('ediciones')
  assert.equal(G.get({ accion: 'ediciones' })['102'], undefined)
})

console.log('\nFotos de los editores (Drive)')
let fotoId
prueba('subir_foto_edicion guarda la foto en Drive y devuelve su id', () => {
  const r = G.post({ accion: 'subir_foto_edicion', token: tokenAdmin, id: 101, tipo: 'image/jpeg', b64: JPG.toString('base64') })
  assert.equal(r.ok, true, r.error)
  fotoId = r.foto
  assert.equal(notas().todos().length, 2)
})
prueba('la edición guarda la foto y la web la recibe', () => {
  G.post({ accion: 'editar', token: tokenAdmin, id: 101, dia: '2026-11-07', cambios: { titular: 'Con foto', foto: fotoId } })
  G.cache.delete('ediciones')
  assert.equal(G.get({ accion: 'ediciones' })['101'].foto, fotoId)
})
prueba('GET ?accion=foto entrega la foto (solo de la carpeta del periódico)', () => {
  const r = G.get({ accion: 'foto', id: fotoId })
  assert.equal(r.ok, true)
  assert.deepEqual(Buffer.from(r.b64, 'base64'), JPG)
  assert.equal(G.get({ accion: 'foto', id: 'otro-archivo-cualquiera' }).ok, false)
})
prueba('«ninguna» quita la foto; un id inventado se ignora', () => {
  G.post({ accion: 'editar', token: tokenAdmin, id: 101, dia: '2026-11-07', cambios: { titular: 'Sin foto', foto: 'ninguna' } })
  G.cache.delete('ediciones')
  assert.equal(G.get({ accion: 'ediciones' })['101'].foto, 'ninguna')
  G.post({ accion: 'editar', token: tokenAdmin, id: 101, dia: '2026-11-07', cambios: { titular: 'X', foto: '<script>' } })
  G.cache.delete('ediciones')
  assert.equal(G.get({ accion: 'ediciones' })['101'].foto, undefined)
})
prueba('foto demasiado grande o de otro tipo se rechaza', () => {
  assert.match(G.post({ accion: 'subir_foto_edicion', token: tokenAdmin, id: 101, tipo: 'image/jpeg', b64: Buffer.alloc(9 * 1024 * 1024).toString('base64') }).error, /pesa demasiado/)
  assert.match(G.post({ accion: 'subir_foto_edicion', token: tokenAdmin, id: 101, tipo: 'application/pdf', b64: 'AA==' }).error, /Formato/)
})

console.log('\nUsuarios')
prueba('el admin crea un editor', () => {
  const r = G.post({ accion: 'guardar_usuario', token: tokenAdmin, datos: { usuario: 'Maria.Q', nombre: 'María Quispe', rol: 'editor', clave: 'clave-segura-1' } })
  assert.equal(r.ok, true, r.error)
  const l = G.post({ accion: 'usuarios', token: tokenAdmin }).usuarios
  assert.deepEqual(l.map((u) => u.usuario), ['admin', 'maria.q'])
  assert.ok(!JSON.stringify(l).includes('hash'), 'la lista no debe exponer claves cifradas')
})
prueba('validaciones: usuario inválido, clave corta, usuario nuevo sin clave', () => {
  assert.match(G.post({ accion: 'guardar_usuario', token: tokenAdmin, datos: { usuario: 'a b', clave: '12345678' } }).error, /Usuario/)
  assert.match(G.post({ accion: 'guardar_usuario', token: tokenAdmin, datos: { usuario: 'pedro', clave: 'corta' } }).error, /8 caracteres/)
  assert.match(G.post({ accion: 'guardar_usuario', token: tokenAdmin, datos: { usuario: 'pedro' } }).error, /clave/)
})
prueba('el editor entra, edita notas, pero no puede ver ni crear usuarios', () => {
  const r = G.post({ accion: 'login', usuario: 'maria.q', clave: 'clave-segura-1' })
  assert.equal(r.rol, 'editor')
  tokenEditor = r.token
  assert.equal(G.post({ accion: 'notas', token: tokenEditor, dia: '2026-11-07' }).ok, true)
  assert.match(G.post({ accion: 'usuarios', token: tokenEditor }).error, /administrador/)
  assert.match(G.post({ accion: 'guardar_usuario', token: tokenEditor, datos: { usuario: 'hacker', clave: '12345678', rol: 'admin' } }).error, /administrador/)
})
prueba('cambiar mi clave: pide la actual; después entra solo con la nueva', () => {
  assert.match(G.post({ accion: 'cambiar_clave', token: tokenEditor, actual: 'mala', nueva: 'otra-clave-22' }).error, /actual/)
  assert.equal(G.post({ accion: 'cambiar_clave', token: tokenEditor, actual: 'clave-segura-1', nueva: 'otra-clave-22' }).ok, true)
  assert.equal(G.post({ accion: 'login', usuario: 'maria.q', clave: 'clave-segura-1' }).ok, false)
  assert.equal(G.post({ accion: 'login', usuario: 'maria.q', clave: 'otra-clave-22' }).ok, true)
})
prueba('el admin no puede desactivarse ni quitarse el rol', () => {
  assert.match(G.post({ accion: 'guardar_usuario', token: tokenAdmin, datos: { usuario: 'admin', rol: 'editor' } }).error, /No puedes/)
  assert.match(G.post({ accion: 'guardar_usuario', token: tokenAdmin, datos: { usuario: 'admin', rol: 'admin', activo: false } }).error, /No puedes/)
})
prueba('desactivar a un editor corta su sesión y no lo deja entrar', () => {
  G.post({ accion: 'guardar_usuario', token: tokenAdmin, datos: { usuario: 'maria.q', nombre: 'María Quispe', rol: 'editor', activo: false } })
  assert.match(G.post({ accion: 'dias', token: tokenEditor }).error, /desactivado/)
  assert.equal(G.post({ accion: 'login', usuario: 'maria.q', clave: 'otra-clave-22' }).ok, false)
})
prueba('el admin le pone clave nueva a un usuario y lo reactiva', () => {
  G.post({ accion: 'guardar_usuario', token: tokenAdmin, datos: { usuario: 'maria.q', nombre: 'María Quispe', rol: 'editor', activo: true, clave: 'reiniciada-33' } })
  assert.equal(G.post({ accion: 'login', usuario: 'maria.q', clave: 'reiniciada-33' }).ok, true)
})
prueba('salir invalida el token', () => {
  G.post({ accion: 'salir', token: tokenAdmin })
  assert.match(G.post({ accion: 'dias', token: tokenAdmin }).error, /Sesión vencida/)
})
prueba('restablecer admin desde el menú da una clave nueva que funciona', () => {
  G.api.restablecerAdmin()
  const nueva = G.alertas.at(-1).match(/Nueva clave: (\S+)/)[1]
  assert.equal(G.post({ accion: 'login', usuario: 'admin', clave: nueva }).ok, true)
})

console.log('\nAvisos del público (Alerta Mascota y Anuncios)')
const AVISO = { tipo: 'perdido', especie: 'perro', nombre: 'Firulais', descripcion: 'Perrito marrón con collar rojo, responde a su nombre.',
  provincia: 'puno', zona: 'Barrio Laykakota, Puno', lat: -15.84123, lng: -70.02456, contacto: '987 654 321', autor: 'Ana', fecha_hecho: '2026-11-14' }
const carpetaMascotas = () => { const c = G.carpetas.find((x) => x.ruta() === 'Altiplano al Día/Alerta Mascota'); return { archivos: c.todos(), c } }
G.cache.delete('intentos:admin')
tokenAdmin = G.post({ accion: 'login', usuario: 'admin', clave: G.alertas.at(-1).match(/Nueva clave: (\S+)/)[1] }).token
let idAviso
prueba('enviar_aviso guarda el aviso «pendiente», con la foto privada en su carpeta', () => {
  const r = G.post({ accion: 'enviar_aviso', seccion: 'mascotas', datos: AVISO, foto: { b64: JPG.toString('base64'), tipo: 'image/jpeg' } })
  assert.equal(r.ok, true, r.error)
  idAviso = r.id
  assert.match(idAviso, /^M\d{6}-[A-Z0-9]{5}$/)
  assert.equal(G.hoja('Mascotas').datos.at(-1)[2], 'pendiente')
  assert.equal(carpetaMascotas().archivos.length, 1)
  assert.equal(carpetaMascotas().archivos[0].compartido, undefined)
  assert.match(carpetaMascotas().archivos[0].carpeta.ruta(), /Alerta Mascota\/Perdidos\/\d{4}-\d{2}$/, 'foto en tipo/mes')
  assert.equal(carpetaMascotas().archivos[0].nombre, idAviso + '.jpg', 'el archivo se llama como el id de la fila')
})
prueba('un aviso pendiente NO sale en la lista pública', () => {
  const r = G.get({ accion: 'avisos', seccion: 'mascotas' })
  assert.equal(r.ok, true)
  assert.equal(r.avisos.length, 0)
})
prueba('sin sesión no se puede moderar ni ver la lista interna', () => {
  assert.equal(G.post({ accion: 'avisos_admin', seccion: 'mascotas' }).ok, false)
  assert.equal(G.post({ accion: 'moderar_aviso', seccion: 'mascotas', id: idAviso, estado: 'aprobado' }).ok, false)
  assert.equal(G.post({ accion: 'foto_aviso', seccion: 'mascotas', foto: 'x' }).ok, false)
})
prueba('el panel ve el pendiente y su foto; al aprobarlo sale en la web con la foto compartida', () => {
  const l = G.post({ accion: 'avisos_admin', token: tokenAdmin, seccion: 'mascotas', estado: 'pendiente' })
  assert.equal(l.ok, true, l.error)
  assert.equal(l.avisos.length, 1)
  assert.equal(l.pendientes.mascotas, 1)
  const f = G.post({ accion: 'foto_aviso', token: tokenAdmin, seccion: 'mascotas', foto: l.avisos[0].foto })
  assert.equal(f.ok, true, f.error)
  const m = G.post({ accion: 'moderar_aviso', token: tokenAdmin, seccion: 'mascotas', id: idAviso, estado: 'aprobado' })
  assert.equal(m.ok, true, m.error)
  const r = G.get({ accion: 'avisos', seccion: 'mascotas' })
  assert.equal(r.avisos.length, 1)
  const a = r.avisos[0]
  assert.equal(a.contacto, '51987654321')
  assert.equal(a.nombre, 'Firulais')
  assert.equal(a.lat, -15.84123, 'mientras está activo se ve el punto exacto')
  assert.equal(a.moderador, undefined, 'la web no ve datos de moderación')
  assert.equal(carpetaMascotas().archivos[0].compartido, 'ANYONE_WITH_LINK')
})
prueba('rechazar lo saca de la web y vuelve la foto a privada', () => {
  G.post({ accion: 'moderar_aviso', token: tokenAdmin, seccion: 'mascotas', id: idAviso, estado: 'rechazado' })
  assert.equal(G.get({ accion: 'avisos', seccion: 'mascotas' }).avisos.length, 0)
  assert.equal(carpetaMascotas().archivos[0].compartido, 'PRIVATE')
})
prueba('validaciones: celular, tipo, descripción corta, ubicación fuera del Perú', () => {
  const mal = (datos) => G.post({ accion: 'enviar_aviso', seccion: 'mascotas', datos: { ...AVISO, contacto: '912345678', ...datos } })
  assert.match(mal({ contacto: '123' }).error, /celular/)
  assert.match(mal({ tipo: 'x' }).error, /tipo/)
  assert.match(mal({ descripcion: 'corto' }).error, /descripción/)
  assert.match(mal({ lat: 40, lng: -3 }).error, /ubicación/)
  assert.match(mal({ provincia: 'lima' }).error, /provincia/)
  assert.equal(G.post({ accion: 'enviar_aviso', seccion: 'otra', datos: AVISO }).ok, false)
})
prueba('trampa para robots: el campo oculto lleno no guarda nada', () => {
  const antes = G.hoja('Mascotas').getLastRow()
  assert.equal(G.post({ accion: 'enviar_aviso', seccion: 'mascotas', datos: { ...AVISO, web: 'http://spam' } }).ok, true)
  assert.equal(G.hoja('Mascotas').getLastRow(), antes)
})
prueba('un mismo número no puede mandar más de 3 avisos seguidos', () => {
  const d = { ...AVISO, contacto: '955555555' }
  for (let i = 0; i < 3; i++) assert.equal(G.post({ accion: 'enviar_aviso', seccion: 'mascotas', datos: d }).ok, true)
  assert.match(G.post({ accion: 'enviar_aviso', seccion: 'mascotas', datos: d }).error, /varios avisos/)
})
prueba('anuncio gratis: pide título, y una fórmula no se ejecuta en Sheets', () => {
  const base = { tipo: 'venta', descripcion: 'Vendo bicicleta en buen estado, poco uso.', provincia: 'san-roman', zona: 'Juliaca', contacto: '944444444' }
  assert.match(G.post({ accion: 'enviar_aviso', seccion: 'anuncios', datos: base }).error, /título/)
  const r = G.post({ accion: 'enviar_aviso', seccion: 'anuncios', datos: { ...base, titulo: '=IMPORTXML("x")', precio: 'S/ 300' } })
  assert.equal(r.ok, true, r.error)
  assert.match(r.id, /^A/)
  assert.equal(G.hoja('Anuncios').formulas, undefined)
  assert.equal(G.hoja('Anuncios').datos.at(-1)[4], '=IMPORTXML("x")')
})


console.log('\nCiclo de vida: archivo y borrado de datos personales')
const DIA_MS = 864e5
/** Cambia una celda de la hoja como si el aviso fuera de hace `dias` días. */
const envejecer = (hoja, id, col, dias) => {
  const h = G.hoja(hoja)
  const j = h.datos[0].indexOf(col)
  const fila = h.datos.find((f) => f[0] === id)
  fila[j] = new Date(Date.now() - dias * DIA_MS)
}
const filaDe = (hoja, id) => {
  const h = G.hoja(hoja)
  const f = h.datos.find((x) => x[0] === id)
  return Object.fromEntries(h.datos[0].map((c, i) => [c, f[i]]))
}
const publicar = (datos) => {
  const r = G.post({ accion: 'enviar_aviso', seccion: 'mascotas', datos: { ...AVISO, ...datos }, foto: { b64: JPG.toString('base64'), tipo: 'image/jpeg' } })
  assert.equal(r.ok, true, r.error)
  G.post({ accion: 'moderar_aviso', token: tokenAdmin, seccion: 'mascotas', id: r.id, estado: 'aprobado' })
  G.cache.delete('avisos:mascotas')
  return r.id
}
const verWeb = (id) => { G.cache.delete('avisos:mascotas'); return G.get({ accion: 'avisos', seccion: 'mascotas' }).avisos.find((a) => a.id === id) }

prueba('Inicializar deja programada la limpieza diaria (una sola vez)', () => {
  G.api.inicializar()
  G.api.inicializar()
  assert.deepEqual(G.activadores, ['depurarAvisos'])
})
prueba('resuelto: pasa al archivo de la web sin número, sin nombre y con ubicación aproximada', () => {
  const id = publicar({ contacto: '977777771' })
  assert.equal(verWeb(id).etapa, 'activo')
  G.post({ accion: 'moderar_aviso', token: tokenAdmin, seccion: 'mascotas', id, estado: 'resuelto' })
  const a = verWeb(id)
  assert.equal(a.etapa, 'archivo')
  assert.equal(a.contacto, '')
  assert.equal(a.autor, '')
  assert.equal(a.lat, -15.84)
  assert.equal(a.lng, -70.02)
  assert.equal(a.descripcion, AVISO.descripcion, 'la publicación se conserva')
  assert.equal(filaDe('Mascotas', id).contacto, '51977777771', 'en la hoja sigue hasta la limpieza')
})
prueba('aprobado de más de 60 días: pasa solo al archivo (sin número en la web)', () => {
  const id = publicar({ contacto: '977777772' })
  envejecer('Mascotas', id, 'moderado', 61)
  const a = verWeb(id)
  assert.equal(a.etapa, 'archivo')
  assert.equal(a.contacto, '')
})
prueba('limpieza: 30 días después del archivo borra número, nombre y punto exacto; la publicación queda', () => {
  const id = publicar({ contacto: '977777773' })
  envejecer('Mascotas', id, 'moderado', 95)                // venció hace 35 días
  const reciente = publicar({ contacto: '977777774' })    // activo: no se toca
  G.api.depurarAvisos()
  const f = filaDe('Mascotas', id)
  assert.equal(f.contacto, '')
  assert.equal(f.autor, '')
  assert.equal(f.lat, -15.84)
  assert.ok(f.depurado && typeof f.depurado.getTime === 'function', 'queda la fecha de limpieza')
  assert.equal(f.descripcion, AVISO.descripcion)
  assert.ok(f.foto, 'la foto de una publicación archivada se conserva')
  assert.equal(verWeb(id).etapa, 'archivo')
  assert.equal(filaDe('Mascotas', reciente).contacto, '51977777774')
  assert.equal(filaDe('Mascotas', reciente).lat, -15.84123)
})
prueba('limpieza: un rechazado o pendiente de más de 30 días se borra y su foto va a la papelera', () => {
  const r = G.post({ accion: 'enviar_aviso', seccion: 'mascotas', datos: { ...AVISO, contacto: '977777775' }, foto: { b64: JPG.toString('base64'), tipo: 'image/jpeg' } })
  const foto = filaDe('Mascotas', r.id).foto
  envejecer('Mascotas', r.id, 'creado', 31)
  G.api.depurarAvisos()
  const f = filaDe('Mascotas', r.id)
  assert.equal(f.contacto, '')
  assert.equal(f.lat, '')
  assert.equal(f.foto, '')
  assert.match(f.descripcion, /borrado/)
  assert.equal(carpetaMascotas().archivos.find((x) => x.id === foto).papelera, true)
  assert.match(G.hoja('Registro').datos.at(-1)[2], /depurar_avisos/)
})
prueba('una denuncia de maltrato nunca muestra el número de quien denuncia', () => {
  const id = publicar({ tipo: 'maltrato', contacto: '977777776' })
  const a = verWeb(id)
  assert.equal(a.etapa, 'activo')
  assert.equal(a.contacto, '')
  assert.equal(a.autor, '')
})

prueba('anuncio: tipo «compra» y enlace de Facebook (solo Facebook; se oculta en el archivo)', () => {
  const base = { tipo: 'compra', titulo: 'Compro bicicleta montañera', descripcion: 'Busco bicicleta aro 26 en buen estado.', provincia: 'puno', zona: 'Puno', contacto: '988888881' }
  assert.match(G.post({ accion: 'enviar_aviso', seccion: 'anuncios', datos: { ...base, enlace: 'https://sitio-raro.com/x' } }).error, /Facebook/)
  const r = G.post({ accion: 'enviar_aviso', seccion: 'anuncios', datos: { ...base, enlace: 'https://www.facebook.com/share/p/1AbCdEf/' } })
  assert.equal(r.ok, true, r.error)
  G.post({ accion: 'moderar_aviso', token: tokenAdmin, seccion: 'anuncios', id: r.id, estado: 'aprobado' })
  G.cache.delete('avisos:anuncios')
  const a = G.get({ accion: 'avisos', seccion: 'anuncios' }).avisos.find((x) => x.id === r.id)
  assert.equal(a.tipo, 'compra')
  assert.equal(a.enlace, 'https://www.facebook.com/share/p/1AbCdEf/')
  G.post({ accion: 'moderar_aviso', token: tokenAdmin, seccion: 'anuncios', id: r.id, estado: 'resuelto' })
  G.cache.delete('avisos:anuncios')
  assert.equal(G.get({ accion: 'avisos', seccion: 'anuncios' }).avisos.find((x) => x.id === r.id).enlace, '')
})

prueba('denuncia ciudadana: puede ser anónima, va a Denuncias ciudadanas/<tipo>/<mes> y NUNCA sale en la web', () => {
  const r = G.post({ accion: 'enviar_aviso', seccion: 'denuncias',
    datos: { tipo: 'seguridad', descripcion: 'Robos frecuentes de celulares en el paradero de la avenida.', provincia: 'san-roman', zona: 'Juliaca, av. Circunvalación' },
    foto: { b64: JPG.toString('base64'), tipo: 'image/jpeg' } })
  assert.equal(r.ok, true, r.error)
  assert.match(r.id, /^D\d{6}-/)
  assert.equal(filaDe('Denuncias', r.id).contacto, '')
  const c = G.carpetas.find((x) => x.ruta() === 'Altiplano al Día/Denuncias ciudadanas')
  assert.match(c.todos()[0].carpeta.ruta(), /Denuncias ciudadanas\/Seguridad\/\d{4}-\d{2}$/)
  G.post({ accion: 'moderar_aviso', token: tokenAdmin, seccion: 'denuncias', id: r.id, estado: 'aprobado' })
  const web = G.get({ accion: 'avisos', seccion: 'denuncias' })
  assert.equal(web.ok, false, 'las denuncias no tienen lista pública')
  const panel = G.post({ accion: 'avisos_admin', token: tokenAdmin, seccion: 'denuncias', estado: 'todos' })
  assert.equal(panel.avisos.length, 1)
})
prueba('anuncio de empleo y «busco empleo» van a sus carpetas', () => {
  for (const [tipo, carpeta] of [['empleo', 'Ofertas de empleo'], ['busco_empleo', 'Busco empleo']]) {
    const r = G.post({ accion: 'enviar_aviso', seccion: 'anuncios',
      datos: { tipo, titulo: 'Trabajo de prueba', descripcion: 'Detalle del puesto o del perfil buscado.', provincia: 'puno', zona: 'Puno', contacto: '98765432' + (tipo === 'empleo' ? '1' : '2') },
      foto: { b64: JPG.toString('base64'), tipo: 'image/jpeg' } })
    assert.equal(r.ok, true, r.error)
    const c = G.carpetas.find((x) => x.ruta() === 'Altiplano al Día/Anuncios/' + carpeta)
    assert.equal(c.todos().length, 1, carpeta)
  }
})

console.log('\nGestión por quien publicó (código)')
let gestion
prueba('al enviar se entrega un código de 8 letras, guardado cifrado en la hoja', () => {
  const r = G.post({ accion: 'enviar_aviso', seccion: 'mascotas', datos: { ...AVISO, nombre: 'Pelusa', contacto: '961000001' } })
  assert.equal(r.ok, true, r.error)
  assert.match(r.clave, /^[A-Z2-9]{8}$/)
  const f = filaDe('Mascotas', r.id)
  assert.notEqual(f.clave, r.clave)
  assert.ok(f.clave.length > 20)
  gestion = r
})
prueba('con un código equivocado no se ve nada, y 8 intentos bloquean', () => {
  assert.match(G.post({ accion: 'mi_aviso', seccion: 'mascotas', id: gestion.id, clave: 'MALO1234' }).error, /no coinciden/)
  for (let i = 0; i < 8; i++) G.post({ accion: 'mi_aviso', seccion: 'mascotas', id: gestion.id, clave: 'MALO' + i })
  assert.match(G.post({ accion: 'mi_aviso', seccion: 'mascotas', id: gestion.id, clave: gestion.clave }).error, /Demasiados/)
  G.cache.delete('gestion:' + gestion.id)
})
prueba('con el código ve su aviso (aunque esté pendiente) y puede contar una novedad, sin números a la vista', () => {
  const m = G.post({ accion: 'mi_aviso', seccion: 'mascotas', id: gestion.id.toLowerCase(), clave: gestion.clave.toLowerCase() })
  assert.equal(m.ok, true, m.error)
  assert.equal(m.aviso.estado, 'pendiente')
  G.post({ accion: 'moderar_aviso', token: tokenAdmin, seccion: 'mascotas', id: gestion.id, estado: 'aprobado' })
  const n = G.post({ accion: 'actualizar_aviso', seccion: 'mascotas', id: gestion.id, clave: gestion.clave, texto: 'La vieron cerca del mercado Bellavista, llamar al 951 234 567' })
  assert.equal(n.ok, true, n.error)
  const a = verWeb(gestion.id)
  assert.equal(a.novedades.length, 1)
  assert.match(a.novedades[0].texto, /mercado Bellavista/)
  assert.doesNotMatch(a.novedades[0].texto, /951/)
  assert.ok(a.novedades[0].fecha)
})
prueba('varias novedades, cada una con su fecha y con foto opcional (compartida si el aviso ya está publicado)', () => {
  const n = G.post({ accion: 'actualizar_aviso', seccion: 'mascotas', id: gestion.id, clave: gestion.clave,
    texto: 'Esta es la foto de donde la vieron por última vez.', foto: { b64: JPG.toString('base64'), tipo: 'image/jpeg' } })
  assert.equal(n.ok, true, n.error)
  assert.equal(n.novedades, 2)
  const a = verWeb(gestion.id)
  assert.equal(a.novedades.length, 2)
  assert.match(a.novedades[0].texto, /última vez/, 'la más reciente va primero')
  assert.ok(a.novedades[0].foto)
  const f = carpetaMascotas().archivos.find((x) => x.id === a.novedades[0].foto)
  assert.equal(f.nombre, gestion.id + '-novedad2.jpg')
  assert.equal(f.compartido, 'ANYONE_WITH_LINK')
})
prueba('cerrar explicando cómo terminó: pasa al archivo con su desenlace y sin número', () => {
  const r = G.post({ accion: 'cerrar_aviso', seccion: 'mascotas', id: gestion.id, clave: gestion.clave, desenlace: 'Volvió a casa. Una vecina la reconoció por la foto.' })
  assert.equal(r.ok, true, r.error)
  assert.equal(r.estado, 'resuelto')
  const a = verWeb(gestion.id)
  assert.equal(a.etapa, 'archivo')
  assert.equal(a.contacto, '')
  assert.match(a.desenlace, /Volvió a casa/)
  assert.match(G.post({ accion: 'cerrar_aviso', seccion: 'mascotas', id: gestion.id, clave: gestion.clave, desenlace: 'otra vez' }).error, /cerrado/)
})
prueba('si se retira antes de aprobarse, nunca llega a la web', () => {
  const r = G.post({ accion: 'enviar_aviso', seccion: 'anuncios',
    datos: { tipo: 'venta', titulo: 'Vendo mesa', descripcion: 'Mesa de madera de seis sillas.', provincia: 'puno', zona: 'Puno', contacto: '961000002' } })
  const c = G.post({ accion: 'cerrar_aviso', seccion: 'anuncios', id: r.id, clave: r.clave, desenlace: 'Ya la vendí' })
  assert.equal(c.estado, 'retirado')
  assert.equal(filaDe('Anuncios', r.id).estado, 'rechazado')
  G.cache.delete('avisos:anuncios')
  assert.equal(G.get({ accion: 'avisos', seccion: 'anuncios' }).avisos.find((x) => x.id === r.id), undefined)
})
prueba('la limpieza borra el código: después ya no se puede gestionar', () => {
  envejecer('Mascotas', gestion.id, 'cerrado', 31)
  G.api.depurarAvisos()
  assert.equal(filaDe('Mascotas', gestion.id).clave, '')
  assert.match(G.post({ accion: 'mi_aviso', seccion: 'mascotas', id: gestion.id, clave: gestion.clave }).error, /no coinciden/)
})

console.log('\nNotas propias (escritas en el panel)')
prueba('crear_nota: pide sesión, valida, guarda en «Propias» con foto en Notas/<mes> y sale en _nuevas', () => {
  const nota = { titular: 'Vecinos de Alto Puno inauguran su biblioteca comunal', bajada: 'La construyeron en faenas.', seccion: 'cultura',
    ambito: 'LOCAL', lugar: 'Puno', cuerpo: 'Primer párrafo de la nota con suficiente texto para pasar la validación mínima.\n\nSegundo párrafo con más detalles.',
    foto: { b64: JPG.toString('base64'), tipo: 'image/jpeg' } }
  assert.equal(G.post({ accion: 'crear_nota', nota }).ok, false, 'sin sesión no se puede')
  assert.match(G.post({ accion: 'crear_nota', token: tokenAdmin, nota: { ...nota, cuerpo: 'corto' } }).error, /corto/)
  const r = G.post({ accion: 'crear_nota', token: tokenAdmin, nota })
  assert.equal(r.ok, true, r.error)
  assert.ok(r.id > 9000000)
  assert.match(r.slug, /^vecinos-de-alto-puno-inauguran-su-biblioteca-comunal-\d+$/)
  const archivo = notas().todos().find((f) => f.nombre === `propia-${r.id}.jpg`)
  assert.ok(archivo, 'la foto va a Notas/<mes>')
  G.cache.delete('ediciones')
  const pub = G.get({ accion: 'ediciones' })
  const n = pub._nuevas.find((x) => x.id === r.id)
  assert.equal(n.cuerpo.length, 2)
  assert.equal(n.foto, archivo.id)
  const dia = n.dia
  const lista = G.post({ accion: 'notas', token: tokenAdmin, dia })
  const enPanel = lista.notas.find((x) => x.id === r.id)
  assert.equal(enPanel.propia, true)
  assert.ok(G.post({ accion: 'dias', token: tokenAdmin }).dias.includes(dia))
  // se corrige como cualquier nota (Ediciones)
  assert.equal(G.post({ accion: 'editar', token: tokenAdmin, id: r.id, dia, cambios: { titular: 'Titular corregido de la nota propia', oculta: false } }).ok, true)
})

prueba('ubicar_aviso: el editor (o quien publicó, con su código) pone el punto del mapa', () => {
  const r = G.post({ accion: 'enviar_aviso', seccion: 'mascotas', datos: { ...AVISO, lat: '', lng: '', contacto: '961000009' } })
  assert.equal(G.post({ accion: 'ubicar_aviso', seccion: 'mascotas', id: r.id, lat: -15.84, lng: -70.02 }).ok, false, 'sin sesión ni código no')
  assert.equal(G.post({ accion: 'ubicar_aviso', token: tokenAdmin, seccion: 'mascotas', id: r.id, lat: -15.8401, lng: -70.0222 }).ok, true)
  assert.equal(filaDe('Mascotas', r.id).lat, -15.8401)
  assert.equal(G.post({ accion: 'ubicar_aviso', seccion: 'mascotas', id: r.id, clave: r.clave, lat: -15.5, lng: -70.13 }).ok, true)
  assert.equal(filaDe('Mascotas', r.id).lng, -70.13)
  assert.match(G.post({ accion: 'ubicar_aviso', token: tokenAdmin, seccion: 'mascotas', id: r.id, lat: 40, lng: -3 }).error, /ubicación/)
})

prueba('ningún código ni clave cifrada queda como fórmula en Sheets (aunque empiece con +)', () => {
  for (let i = 0; i < 40; i++) G.post({ accion: 'enviar_aviso', seccion: 'denuncias', datos: { tipo: 'otro', descripcion: 'Prueba de cifrado número ' + i + ' con texto suficiente.', provincia: 'puno', zona: 'Puno' } })
  for (const h of ['Mascotas', 'Anuncios', 'Denuncias', 'Usuarios']) assert.equal(G.hoja(h).formulas, undefined, h)
})

console.log('\nCredenciales de prensa')
let codCred
prueba('el admin emite una credencial con foto; el editor no puede', () => {
  const datos = { nombre: 'Rosa Quispe Mamani', cargo: 'Reportera', dni: '41234567', vence: '2027-12-31', foto_b64: JPG.toString('base64'), foto_tipo: 'image/jpeg' }
  assert.equal(G.post({ accion: 'guardar_credencial', token: tokenEditor, datos }).ok, false)
  const r = G.post({ accion: 'guardar_credencial', token: tokenAdmin, datos })
  assert.ok(r.ok, r.error)
  assert.match(r.codigo, /^AAD-[A-HJ-NP-Z2-9]{6}$/)
  codCred = r.codigo
  assert.equal(G.carpetas.find((c) => c.ruta() === 'Altiplano al Día/Credenciales').archivos.length, 1)
})
prueba('la validación pública muestra vigente, DNI tapado y foto en base64', () => {
  const v = G.get({ accion: 'credencial', codigo: codCred.toLowerCase() })
  assert.equal(v.valida, true)
  assert.equal(v.estado, 'vigente')
  assert.equal(v.nombre, 'Rosa Quispe Mamani')
  assert.equal(v.dni, '****4567')
  assert.match(v.foto, /^data:image\/jpeg;base64,/)
  assert.equal(v.creado_por, undefined)
})
prueba('códigos inexistentes o mal formados no validan', () => {
  assert.equal(G.get({ accion: 'credencial', codigo: 'AAD-ZZZZZZ' }).estado, 'no_existe')
  assert.equal(G.get({ accion: 'credencial', codigo: "'; DROP" }).valida, false)
})
prueba('revocar exige motivo y la validación lo refleja; la foto se conserva', () => {
  const base = { codigo: codCred, nombre: 'Rosa Quispe Mamani', cargo: 'Reportera', dni: '41234567', vence: '2027-12-31', estado: 'revocada' }
  assert.equal(G.post({ accion: 'guardar_credencial', token: tokenAdmin, datos: base }).ok, false)
  const r = G.post({ accion: 'guardar_credencial', token: tokenAdmin, datos: { ...base, motivo: 'Dejó de colaborar' } })
  assert.ok(r.ok, r.error)
  const v = G.get({ accion: 'credencial', codigo: codCred })
  assert.equal(v.estado, 'revocada')
  assert.equal(v.valida, false)
  assert.equal(v.motivo, 'Dejó de colaborar')
  assert.match(v.foto, /^data:image/)
})
prueba('una credencial vencida no valida', () => {
  const r = G.post({ accion: 'guardar_credencial', token: tokenAdmin, datos: { nombre: 'Juan Mamani Ccori', cargo: 'Camarógrafo', vence: '2020-01-01', foto_b64: JPG.toString('base64') } })
  assert.ok(r.ok, r.error)
  assert.equal(G.get({ accion: 'credencial', codigo: r.codigo }).estado, 'vencida')
})
prueba('sin foto o con DNI inválido se rechaza', () => {
  assert.equal(G.post({ accion: 'guardar_credencial', token: tokenAdmin, datos: { nombre: 'Ana Ccama Ticona', cargo: 'Fotógrafa', vence: '2027-01-01' } }).ok, false)
  assert.equal(G.post({ accion: 'guardar_credencial', token: tokenAdmin, datos: { nombre: 'Ana Ccama Ticona', cargo: 'Fotógrafa', dni: '123', vence: '2027-01-01', foto_b64: JPG.toString('base64') } }).ok, false)
})
prueba('el panel lista credenciales y entrega la foto para imprimir (solo admin)', () => {
  const l = G.post({ accion: 'credenciales', token: tokenAdmin, codigo: codCred })
  assert.ok(l.ok, l.error)
  assert.ok(l.credenciales.length >= 2)
  assert.match(l.foto, /^data:image/)
  assert.equal(G.post({ accion: 'credenciales', token: tokenEditor }).ok, false)
})

console.log('\nRobustez')
prueba('pedido no JSON y acción desconocida responden con error claro', () => {
  assert.equal(JSON.parse(G.api.doPost({ postData: { contents: 'no-json' } }).texto).error, 'Pedido inválido.')
  assert.equal(G.post({ accion: 'borrar_todo' }).error, 'Acción desconocida.')
})
prueba('GET sin acción responde que el servicio está activo', () => {
  assert.equal(G.get({}).servicio, 'Altiplano al Día')
})

console.log(`\n${ok} pruebas bien, ${mal} con fallas.`)
process.exit(mal ? 1 : 0)
