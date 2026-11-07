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
  assert.equal(G.carpetas.length, 1)
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
  assert.equal(G.carpetas[0].archivos.length, 1, 'duplicó la foto')
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
  assert.deepEqual(G.hojas.map((h) => h.nombre), ['Hoy', 'Ediciones', 'Usuarios', 'Registro', '2026-11-07', '2026-11-06'])
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
  assert.equal(G.carpetas[0].archivos.length, 2)
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
