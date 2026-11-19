// Credencial de prensa de Altiplano al Día (CR80 vertical: 54 × 85,6 mm).
//
// Genera la PLANTILLA (frente y dorso) en public/brand/credencial/, con campos {{NOMBRE_1}}, {{CARGO}}, etc.
// La web (/admin → Credenciales) carga esos SVG, reemplaza los campos, pone la foto y el QR, e imprime.
// Si se retoca el diseño en Inkscape, se guarda encima de frente.svg / dorso.svg (como SVG de Inkscape) y la
// web usa el diseño nuevo: solo hay que conservar los textos {{…}} y los grupos id="qr-frente" / id="qr-dorso".
//
// Uso:  node scripts/credencial/construir.mjs            → plantillas + muestra rellena (SVG)
//       node scripts/credencial/construir.mjs --pdf      → además exporta la muestra a PDF y PNG con Inkscape
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { rellenar } from './rellenar.mjs'

const require = createRequire(import.meta.url)
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SALIDA = path.join(RAIZ, 'public/brand/credencial')
const AZUL = '#043F9B'
const AZUL_900 = '#022A69'
const AMARILLO = '#FFEE00'
const TINTA = '#1A1A1A'
const SUAVE = '#5A6170'
const FIRA = "'Fira Sans Condensed', 'Arial Narrow', sans-serif"
const SLAB = "'Alfa Slab One', 'Rockwell', serif"

/** El logo blanco como <svg> anidado (mantiene sus trazos: no depende de fuentes). */
function logo(x, y, ancho, archivo = 'logo-horizontal-blanco.svg') {
  const s = fs.readFileSync(path.join(RAIZ, 'public/brand', archivo), 'utf8')
  const vb = s.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number)
  const alto = (ancho * vb[3]) / vb[2]
  const cuerpo = s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[\s\S]*?<\/title>/, '')
  return `<svg x="${x}" y="${y}" width="${ancho}" height="${alto.toFixed(1)}" viewBox="${vb.join(' ')}">${cuerpo}</svg>`
}

const cabecera = (titulo) => `
  <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
       xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
       width="54mm" height="85.6mm" viewBox="0 0 540 856">
  <title>${titulo}</title>
  <defs>
    <clipPath id="recorte-foto"><rect x="174" y="204" width="192" height="240" rx="10"/></clipPath>
    <pattern id="trama" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="9" height="22" fill="#FFFFFF" fill-opacity="0.06"/>
    </pattern>
  </defs>`.trim()

// Silueta gris para la plantilla vacía (la web la reemplaza por la foto).
const SILUETA = 'data:image/svg+xml;base64,' + Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 272"><rect width="220" height="272" fill="#D9DEE7"/>' +
  '<circle cx="110" cy="105" r="52" fill="#AEB6C4"/><path d="M20 272c6-62 44-98 90-98s84 36 90 98z" fill="#AEB6C4"/></svg>',
).toString('base64')

// Fondo azul con ondas (vector: se imprime nítido y se edita en Inkscape).
const ROJO = '#D32F2F'
const ondas = `
    <defs>
      <linearGradient id="g-azul" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0" stop-color="#1E6FD9"/><stop offset="0.55" stop-color="${AZUL}"/><stop offset="1" stop-color="${AZUL_900}"/>
      </linearGradient>
    </defs>
    <rect width="540" height="856" fill="url(#g-azul)"/>
    <path d="M0 250C120 190 230 300 360 250S540 170 540 170V420C430 470 330 360 200 420S0 470 0 470Z" fill="#FFFFFF" fill-opacity="0.07"/>
    <path d="M0 520C110 470 220 580 350 530S540 450 540 450V700C420 760 320 640 190 700S0 760 0 760Z" fill="#000000" fill-opacity="0.10"/>
    <path d="M0 640C140 590 260 700 390 650S540 600 540 600V856H0Z" fill="#FFFFFF" fill-opacity="0.06"/>
    <path d="M0 120C150 80 250 160 400 110S540 70 540 70V0H0Z" fill="#FFFFFF" fill-opacity="0.05"/>`

const FRENTE = `${cabecera('Credencial de prensa — frente')}
  <g inkscape:groupmode="layer" inkscape:label="Fondo" id="capa-fondo">${ondas}
  </g>
  <g inkscape:groupmode="layer" inkscape:label="Marca" id="capa-marca">
    ${logo(85, 40, 370)}
    <text x="455" y="146" text-anchor="end" font-family="${FIRA}" font-weight="500" font-size="18" fill="#FFFFFF" fill-opacity="0.9">Noticias de Puno y la región</text>
  </g>
  <g inkscape:groupmode="layer" inkscape:label="Panel blanco" id="capa-panel">
    <path d="M92 856V430A178 178 0 0 1 448 430V856Z" fill="#FFFFFF"/>
  </g>
  <g inkscape:groupmode="layer" inkscape:label="Foto" id="capa-foto">
    <rect x="166" y="196" width="208" height="256" rx="16" fill="#FFFFFF"/>
    <image id="foto" x="174" y="204" width="192" height="240" preserveAspectRatio="xMidYMid slice"
           clip-path="url(#recorte-foto)" href="{{FOTO}}" xlink:href="{{FOTO}}"/>
  </g>
  <g inkscape:groupmode="layer" inkscape:label="Datos" id="capa-datos" font-family="${FIRA}" text-anchor="middle">
    <text x="270" y="500" font-weight="600" font-size="34" fill="#3A3F4A">{{NOMBRE_1}}</text>
    <text x="270" y="540" font-weight="600" font-size="34" fill="#3A3F4A">{{NOMBRE_2}}</text>
    <path d="M140 560H400M140 606H400" stroke="${ROJO}" stroke-width="2"/>
    <text x="270" y="593" font-weight="800" font-size="25" letter-spacing="1.5" fill="${ROJO}">{{CARGO}}</text>
    <text x="270" y="644" font-weight="700" font-size="27" fill="${TINTA}">DNI: {{DNI}}</text>
    <text x="270" y="676" font-weight="500" font-style="italic" font-size="19" fill="${SUAVE}">www.altiplanoaldia.pe</text>
  </g>
  <g inkscape:groupmode="layer" inkscape:label="Prensa" id="capa-prensa">
    <path d="M44 706H70V786H44L56 746Z" fill="#9E1C1C"/>
    <path d="M496 706H470V786H496L484 746Z" fill="#9E1C1C"/>
    <rect x="62" y="696" width="416" height="96" fill="${ROJO}"/>
    <path d="M62 792L70 802V792ZM478 792L470 802V792Z" fill="#7A1414"/>
    <text x="270" y="772" text-anchor="middle" font-family="${FIRA}" font-weight="800" font-size="78" letter-spacing="5" fill="#FFFFFF">PRENSA</text>
  </g>
  <g inkscape:groupmode="layer" inkscape:label="Pie" id="capa-pie">
    ${logo(165, 806, 210, 'logo-horizontal.svg')}
  </g>
</svg>
`

const DORSO = `${cabecera('Credencial de prensa — dorso')}
  <g inkscape:groupmode="layer" inkscape:label="Fondo" id="capa-fondo">${ondas}
  </g>
  <g inkscape:groupmode="layer" inkscape:label="Panel blanco" id="capa-panel">
    <rect x="58" y="34" width="424" height="736" rx="44" fill="#FFFFFF"/>
  </g>
  <g inkscape:groupmode="layer" inkscape:label="Firma" id="capa-firma" font-family="${FIRA}" text-anchor="middle">
    <text x="270" y="92" font-weight="700" font-size="20" letter-spacing="1" fill="${SUAVE}">ALTIPLANO AL DÍA</text>
    <image id="firma" x="170" y="96" width="200" height="70" preserveAspectRatio="xMidYMid meet" href="{{FIRMA}}" xlink:href="{{FIRMA}}"/>
    <path d="M140 170H400" stroke="${TINTA}" stroke-width="1.5" stroke-dasharray="3 3"/>
    <text x="270" y="194" font-weight="600" font-size="19" fill="${TINTA}">{{FIRMANTE}}</text>
    <text x="270" y="215" font-weight="700" font-size="14" letter-spacing="1.5" fill="${SUAVE}">{{FIRMANTE_CARGO}}</text>
    <text x="270" y="250" font-weight="700" font-size="15" letter-spacing="2" fill="${TINTA}">FIRMA AUTORIZADA</text>
  </g>
  <g inkscape:groupmode="layer" inkscape:label="Texto" id="capa-texto" font-family="${FIRA}" fill="${TINTA}">
    <text x="270" y="296" text-anchor="middle" font-weight="500" font-size="23">Se ruega <tspan font-weight="800">DAR LAS</tspan></text>
    <text x="270" y="324" text-anchor="middle" font-weight="800" font-size="23">FACILIDADES DEL CASO <tspan font-weight="500">para</tspan></text>
    <text x="270" y="352" text-anchor="middle" font-weight="500" font-size="23">el cumplimiento de su labor periodística</text>
    <text x="96" y="398" font-weight="600" font-size="20">Términos:</text>
    <g font-weight="500" font-size="18">
      <text x="100" y="428"><tspan fill="${AZUL}" font-weight="800">•</tspan>  Esta credencial es personal e</text>
      <text x="118" y="450">intransferible. Solo es válida con DNI.</text>
      <text x="100" y="480"><tspan fill="${AZUL}" font-weight="800">•</tspan>  No autoriza a cobrar dinero ni a pedir</text>
      <text x="118" y="502">beneficios a nombre del medio.</text>
      <text x="100" y="532"><tspan fill="${AZUL}" font-weight="800">•</tspan>  En caso de pérdida, comuníquese al</text>
      <text x="118" y="554">WhatsApp {{TELEFONO}}.</text>
    </g>
  </g>
  <g inkscape:groupmode="layer" inkscape:label="QR y vigencia" id="capa-qr" font-family="${FIRA}" text-anchor="middle">
    <rect x="198" y="572" width="144" height="144" rx="8" fill="#FFFFFF" stroke="${AZUL}" stroke-width="3"/>
    <g id="qr-dorso" transform="translate(206 580)">{{QR_DORSO}}</g>
    <text x="270" y="736" font-weight="600" font-size="15" fill="${SUAVE}">Verifica: {{URL}}</text>
    <text x="270" y="760" font-weight="700" font-size="22" fill="${TINTA}">Válido hasta: {{VENCE}}</text>
  </g>
  <g inkscape:groupmode="layer" inkscape:label="Pie" id="capa-pie">
    ${logo(66, 790, 190)}
    <text x="474" y="812" text-anchor="end" font-family="${FIRA}" font-weight="600" font-size="15" fill="#FFFFFF">Diario digital · Puno, Perú</text>
    <text x="474" y="834" text-anchor="end" font-family="${FIRA}" font-weight="600" font-size="15" fill="${AMARILLO}">altiplanoaldia.pe</text>
  </g>
</svg>
`

fs.mkdirSync(SALIDA, { recursive: true })
const plantillaFrente = FRENTE.replaceAll('{{FOTO}}', '{{FOTO}}')
fs.writeFileSync(path.join(SALIDA, 'frente.svg'), plantillaFrente)
fs.writeFileSync(path.join(SALIDA, 'dorso.svg'), DORSO)
fs.writeFileSync(path.join(SALIDA, 'silueta.txt'), SILUETA)

// Muestra rellena (datos ficticios) para revisar el diseño.
const qrcode = require('qrcode-generator')
const datos = { codigo: 'AAD-K7M2QX', nombre: 'Rosa Elena Quispe Mamani', cargo: 'Reportera', dni: '41234567',
  vence: '2027-07-31', emitida: '2026-11-19', foto: SILUETA }
const muestra = rellenar({ frente: plantillaFrente, dorso: DORSO }, datos, qrcode)
fs.writeFileSync(path.join(SALIDA, 'muestra-frente.svg'), muestra.frente)
fs.writeFileSync(path.join(SALIDA, 'muestra-dorso.svg'), muestra.dorso)
console.log('Plantillas y muestra en', SALIDA)

if (process.argv.includes('--pdf')) {
  const INK = process.env.INKSCAPE || 'C:/Program Files/Inkscape/bin/inkscape.exe'
  for (const lado of ['frente', 'dorso']) {
    const svg = path.join(SALIDA, `muestra-${lado}.svg`)
    execFileSync(INK, [svg, '--export-type=pdf', '--export-text-to-path', `--export-filename=${svg.replace('.svg', '.pdf')}`])
    execFileSync(INK, [svg, '--export-type=png', '--export-dpi=300', `--export-filename=${svg.replace('.svg', '.png')}`])
  }
  console.log('Muestra exportada con Inkscape (PDF y PNG a 300 ppp).')
}
