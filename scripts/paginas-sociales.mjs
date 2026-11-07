// Después de `vite build`: crea dist/nota/<slug>.html para cada noticia, con la misma app pero con su propio
// título, bajada y foto en las etiquetas Open Graph. Facebook, WhatsApp y X no ejecutan JavaScript: leen solo
// el HTML que reciben, así que sin esto todas las notas se compartían con el logo de la portada.
// GitHub Pages sirve /nota/<slug> desde nota/<slug>.html sin redirigir, así que la dirección no cambia.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'
const cname = existsSync('public/CNAME') ? readFileSync('public/CNAME', 'utf8').trim() : ''
const SITIO = (process.env.SITIO_URL || (cname ? `https://${cname}` : '')).replace(/\/$/, '')
if (!SITIO) {
  console.log('paginas-sociales: sin dominio (public/CNAME o SITIO_URL); no se generan páginas.')
  process.exit(0)
}

const base = readFileSync(join(DIST, 'index.html'), 'utf8')
const ruta = join(DIST, 'data', 'noticias.json')
if (!existsSync(ruta)) process.exit(0)
const datos = JSON.parse(readFileSync(ruta, 'utf8'))
const notas = Array.isArray(datos) ? datos : datos.notas ?? []

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const corto = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s)

/** Ancho y alto de un JPEG (lee el marcador SOF); null si no se puede. */
function medidas(archivo) {
  try {
    const b = readFileSync(archivo)
    let i = 2
    while (i < b.length) {
      if (b[i] !== 0xff) return null
      const m = b[i + 1]
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }
      i += 2 + b.readUInt16BE(i + 2)
    }
  } catch { /* sin foto */ }
  return null
}

/** Reemplaza el bloque de etiquetas de la portada por las de la nota. */
function pagina(n) {
  const url = `${SITIO}/nota/${n.slug}`
  const titulo = `${n.titular} | Altiplano al Día`
  const desc = corto(n.bajada || (n.cuerpo ?? []).find((p) => p && !p.startsWith('## ')) || '', 200)
  // Preferimos la tarjeta de marca que arma el maquetador (foto + sección + titular, 1200×630).
  const foto = n.imagen_compartir || n.imagen
  const img = foto ? `${SITIO}/${foto.replace(/^\//, '')}` : `${SITIO}/brand/og-portada.jpg`
  const tam = foto ? medidas(join(DIST, foto)) : { w: 1200, h: 630 }
  const meta = [
    `<meta property="og:site_name" content="Altiplano al Día" />`,
    `<meta property="og:locale" content="es_PE" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:title" content="${esc(n.titular)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:image" content="${esc(img)}" />`,
    ...(tam ? [`<meta property="og:image:width" content="${tam.w}" />`, `<meta property="og:image:height" content="${tam.h}" />`] : []),
    `<meta property="og:image:alt" content="${esc(n.titular)}" />`,
    ...(n.fecha ? [`<meta property="article:published_time" content="${esc(n.fecha)}" />`] : []),
    ...(n.seccion ? [`<meta property="article:section" content="${esc(n.seccion)}" />`] : []),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(n.titular)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
  ].join('\n    ')
  return base
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(titulo)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}" />`)
    .replace(/<!-- Vista previa al compartir[\s\S]*?<meta name="twitter:card"[^>]*>/, meta)
}

mkdirSync(join(DIST, 'nota'), { recursive: true })
let n = 0
for (const nota of notas) {
  if (!nota?.slug || !/^[a-z0-9-]+$/i.test(nota.slug)) continue
  writeFileSync(join(DIST, 'nota', `${nota.slug}.html`), pagina(nota))
  n++
}
console.log(`paginas-sociales: ${n} página(s) de nota con vista previa propia (${SITIO}).`)
