// Service worker de Altiplano al Día: lectura sin conexión.
// Recursos estáticos: primero caché. Noticias (JSON) y páginas: primero red, caché de respaldo.
const VERSION = 'aad-v2'
const BASICOS = ['/', '/favicon.svg', '/brand/logo-horizontal.svg', '/brand/logo-horizontal-blanco.svg', '/data/noticias.json']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASICOS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin) return

  const primeroRed = req.mode === 'navigate' || url.pathname.startsWith('/data/')
  if (primeroRed) {
    const clave = req.mode === 'navigate' ? '/' : req
    e.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok) {
            const copia = r.clone()
            caches.open(VERSION).then((c) => c.put(clave, copia))
          }
          return r
        })
        .catch(() => caches.match(clave)),
    )
    return
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((r) => {
          if (r.ok && /\.(js|css|ttf|png|jpe?g|webp|svg)$/.test(url.pathname)) {
            const copia = r.clone()
            caches.open(VERSION).then((c) => c.put(req, copia))
          }
          return r
        }),
    ),
  )
})
