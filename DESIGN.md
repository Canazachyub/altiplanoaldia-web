# DESIGN.md — Sistema de diseño de Altiplano al Día

Fuente única de verdad para la identidad visual del diario digital **Altiplano al Día**
(noticias de Puno y la región). La identidad sale del boletín impreso del monitor
(`F:\ALTIPLANO AL DIA\data\diseno.json`) y la estructura de portal toma como referencia los
grandes diarios digitales peruanos (tipo Perú21): cabecera con secciones, cinta de último minuto,
apertura con nota principal, bloques por sección y "lo más leído".

Los tokens viven en `src/styles/tokens.css`. Si cambias un valor, cámbialo ahí y aquí.

---

## 1. Personalidad

| Rasgo | Cómo se ve |
|---|---|
| **Regional y orgulloso** | Azul lago Titicaca + amarillo sol andino. Ilustraciones de línea blanca (chakana, totora, vicuña, nevados). |
| **Directo, de servicio** | Titulares en slab pesada, bajadas cortas, "Datos clave" en cada nota, botón de denuncia siempre visible. |
| **Transparente** | Cada nota muestra **qué medios la reportaron** y enlaza a las publicaciones originales. Es el rasgo propio de la marca: las notas nacen del monitoreo cruzado de medios. |
| **Rápido** | Densidad alta en portada, tarjetas sin adornos, cinta de "Lo último" con hora. |

Tono de voz: periodístico, tercera persona, sin sensacionalismo. Antetítulos en mayúscula
condensada ("SEGURIDAD · REGIONAL"), titulares en oración (no todo mayúsculas).

---

## 2. Logo

Archivos en `public/brand/` (se regeneran con `npm run logo`):

| Archivo | Uso |
|---|---|
| `logo-horizontal.svg` | Cabecera sobre blanco. **Versión principal.** |
| `logo-horizontal-blanco.svg` | Sobre azul o fotos oscuras (pie de página, cabecera compacta oscura). |
| `logo-horizontal-fondo-azul.svg` | Piezas cerradas: banners, portadas de video. |
| `logo-horizontal-mono.svg` | Impresión a una tinta, sellos, fax. |
| `logo-apilado.svg` | Formatos cuadrados o verticales (post, afiche). |
| `isotipo.svg` / `isotipo-redondo.svg` | Avatar de redes (Facebook, TikTok), favicon, ícono de app. |
| `png/*-600/1200/2400.png` | Rasterizados para redes, documentos y presentaciones. |
| `imprenta/*.pdf`, `*.eps` | Imprenta y diseño (texto convertido a trazos). |

**Construcción.** Cuadro amarillo `#FFEE00` con la **A** azul `#043F9B` (geometría propia: ápice
plano, contraforma triangular, remates slab). A la derecha, "ltiplano" en Alfa Slab One
negro `#111111`; debajo, alineado a la derecha, "AL DÍA" en PT Serif regular, versalitas espaciadas.

**Reglas.**
- Área de respeto: la mitad del lado del cuadro amarillo por cada lado.
- Tamaño mínimo: 120 px de ancho (horizontal) / 24 px (isotipo).
- No cambiar colores, no estirar, no poner sombras ni contornos, no rotar.
- Sobre azul, el texto pasa a blanco; el cuadro amarillo y la A azul **no cambian**.

---

## 3. Color

| Token | Hex | Uso |
|---|---|---|
| `--azul` | `#043F9B` | Color de marca. Barras, enlaces, botones primarios, pie de página. |
| `--azul-900` | `#022A69` | Barra superior, hover de botones, fondos oscuros. |
| `--azul-200` | `#6E9BE0` | Degradados, bordes suaves, gráficos. |
| `--amarillo` | `#FFEE00` | Acento: subrayado de sección activa, etiquetas "ÚLTIMO", resaltados. Nunca texto sobre blanco. |
| `--alerta` | `#C62828` | Último minuto, seguridad/policiales, "EN VIVO". |
| `--tinta` | `#1A1A1A` | Texto principal. |
| `--gris-600` | `#5A5F6B` | Metadatos, fechas, créditos. |
| `--linea` | `#E3E6EC` | Separadores y bordes de tarjeta. |
| `--papel` | `#FFFFFF` / `--papel-2` `#F4F6FA` | Fondos. |

**Colores por tema** (antetítulos, filete superior de bloques, íconos):
Política `#043F9B` · Seguridad `#C62828` · Economía `#2E7D32` · Educación `#6A1B9A` ·
Salud `#00838F` · Sociedad `#D84315` · Cultura `#AD1457` · Deportes `#1565C0` ·
Medio ambiente `#2E7D32` · Otros `#37474F`.

Contraste: texto `--tinta` sobre blanco 16:1; blanco sobre `--azul` 9.6:1; `--tinta` sobre
`--amarillo` 15:1. El amarillo **solo** lleva texto oscuro encima.

Modo oscuro: fondo `#0E1420`, superficies `#161E2E`, texto `#E8ECF3`; el azul de marca sube a
`#5B8EE6` en enlaces para mantener contraste. Se activa por sistema o con el botón de la cabecera.

---

## 4. Tipografía (todas OFL, servidas desde `public/fonts/`)

| Rol | Familia | Peso | Tamaño (escritorio / móvil) |
|---|---|---|---|
| Marca, titulares de portada | **Alfa Slab One** | 400 | apertura 44/30 px |
| Titulares de nota y tarjetas | **Zilla Slab** | 700 | nota 42/30 · tarjeta 22/19 · lista 17 |
| Antetítulos, menú, botones, etiquetas | **Fira Sans Condensed** | 600–800, MAYÚSCULAS, `letter-spacing: .04em` | 12–14 |
| Cuerpo de nota, bajadas | **PT Serif** | 400 / 700 / itálica | cuerpo 19/17 · bajada 21/18 · interlineado 1.65 |
| Metadatos, pies de foto, datos | **PT Sans Narrow** | 400 / 700 | 13–14 |

Escala de titulares de tarjeta: XL 30 · L 22 · M 18 · S 16. Ancho de lectura de nota: máximo 68 ch.

---

## 5. Retícula y espaciado

- Contenedor: 1200 px máximo, margen lateral 16 px en móvil, 24 px en escritorio.
- Portada: 12 columnas, separación 24 px. Apertura = 8 col (nota principal + 2 secundarias) + 4 col (Lo último).
- Espaciado en múltiplos de 4: `--s1` 4 · `--s2` 8 · `--s3` 12 · `--s4` 16 · `--s6` 24 · `--s8` 32 · `--s12` 48.
- Puntos de corte: 640 (2 columnas), 960 (retícula completa), 1200 (contenedor fijo).
- Radios: 0 en fotos de tarjeta (estilo prensa), 4 px en botones y cajas, 999 px en chips.

---

## 6. Componentes

| Componente | Descripción |
|---|---|
| **Barra superior** | Azul 900. Fecha de Puno, clima en vivo (Open-Meteo), redes, botón amarillo "Denuncia". |
| **Cabecera** | Menú hamburguesa · logo centrado · buscar, modo oscuro, "Boletín". Se compacta y fija al bajar. |
| **Navegación de secciones** | Fira Sans Condensed en mayúsculas; la activa lleva subrayado amarillo de 4 px. Desplazable en móvil. |
| **Cinta "Lo último"** | Etiqueta roja + titulares con hora que se desplazan; se pausa al pasar el mouse o con foco. |
| **Tarjeta de nota** | Variantes `apertura`, `destacada`, `normal`, `horizontal`, `lista`, `numerada`. Foto 16:9 (o 4:3), antetítulo de color del tema, titular slab, bajada opcional, meta (hora relativa + n.º de fuentes). |
| **Bloque de sección** | Filete superior de 4 px del color del tema + ícono + nombre + "Ver más ›". 1 nota grande + 3 en lista. |
| **Lo más leído** | Lista numerada con números grandes en Alfa Slab azul. |
| **Datos clave** | Caja con borde izquierdo amarillo, lista de viñetas cuadradas azules. Sale del campo `DATOS` del monitor. |
| **Fuentes de la nota** | Chips con el nombre de cada medio + enlace a la publicación original. |
| **Compartir** | WhatsApp, Facebook, X, copiar enlace. Barra lateral fija en escritorio. |
| **Banner de denuncia** | Fondo azul con ilustración, CTA amarillo a WhatsApp +51 982 591 289. |
| **Caja de boletín** | Suscripción por WhatsApp (mensaje prellenado). |

Estados: foco visible (anillo amarillo 3 px + borde azul), hover en titulares = subrayado azul,
`prefers-reduced-motion` detiene la cinta y las transiciones.

---

## 7. Imágenes

- **Fotos de noticias**: las de las publicaciones monitoreadas (`public/img/noticias/`), siempre
  con crédito "Foto: <medio>".
- **Ilustraciones de marca** (`public/img/ia/`): generadas con ChatGPT (Codex `image_gen`) en un
  solo estilo: *línea blanca fina sobre azul #043F9B, acentos amarillos #FFEE00, sin texto*.
  Se usan como imagen de reemplazo cuando una nota no tiene foto, en cabeceras de sección, el
  banner de denuncia, la caja de boletín y la página 404. **Nunca** se presentan como foto de un
  hecho real.
- Íconos de tema y ámbito: `public/icons/tema_*.png`, `ambito_*.png` (versiones `_w` en blanco).

---

## 8. Canales oficiales

- Facebook: https://www.facebook.com/profile.php?id=100077594686001
- TikTok: https://www.tiktok.com/@altiplano_al_dia
- Denuncias (WhatsApp): +51 982 591 289 → `https://wa.me/51982591289`

Se configuran en un solo lugar: `src/config/sitio.ts`.
