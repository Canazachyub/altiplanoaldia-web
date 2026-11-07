# Altiplano al Día — sitio web (frontend)

Diario digital de noticias de Puno y la región. React 18 + Vite + TypeScript, sin backend:
las notas salen del monitor de medios (`F:\ALTIPLANO AL DIA\data\posts.db`) exportadas a
`public/data/noticias.json`.

## Arrancar en local

- Doble clic en **`Iniciar sitio.bat`**, o bien `npm install` (la primera vez) y luego `npm run dev`
- Abre http://localhost:5180 (también se ve desde otros equipos de la red, en la IP de esta PC)

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto 5180 |
| `npm run build` | Compila a `dist/` (sitio estático, listo para cualquier hosting) |
| `npm run preview` | Sirve `dist/` en http://localhost:4173 |
| `npm run datos` | Vuelve a exportar las noticias y fotos desde el monitor |
| `npm run logo` | Regenera el logo vectorial en todos los formatos |
| `bash scripts/generar_imagenes.sh` | Genera con ChatGPT (Codex) las ilustraciones que falten |

## Qué incluye

Portada con apertura y "Lo último", cinta animada de último minuto, bloques por sección, "Lo más
leído", noticias por ámbito (distrital → internacional), página de nota (datos clave, fuentes con
enlace al original, compartir, tamaño de letra, barra de lectura, relacionadas), secciones con
"cargar más", buscador, "Lo último" por día, denuncia ciudadana por WhatsApp (+51 982 591 289),
boletín por WhatsApp, quiénes somos, 404, modo oscuro, clima de Puno en vivo, menú lateral,
manifiesto PWA y botón flotante de WhatsApp.

### Mejoras v2

- **Notas**: "Lo que difiere entre medios" (discrepancias detectadas por el monitor), aporte de cada fuente,
  escuchar en voz alta, guardar para después, imagen 1080×1920 para historias (TikTok/WhatsApp/Facebook),
  compartir nativo en celular, nota anterior/siguiente, datos estructurados NewsArticle para Google.
- **Provincias de Puno** (`/provincias`): las 13 provincias detectadas en el texto de cada nota.
- **Clima y heladas** (`/clima`): 6 ciudades, pronóstico a 7 días, alerta de heladas y de radiación UV.
- **Ediciones en PDF** (`/ediciones`): visor y descarga de los boletines consolidados del monitor.
- **Medios** (`/medio/<nombre>`) y **Guardadas** (`/guardadas`).
- Aviso "Hay N noticias nuevas" (revisa cada 3 min), filtros por sección en "Lo último", esqueletos de carga,
  límite de errores, atajo `/` para buscar, lectura sin conexión (service worker, solo en `build`),
  `rss.xml`, `sitemap.xml` y `robots.txt` (se generan con `npm run datos -- --url https://tu-dominio`).

## Diseño

- `DESIGN.md`: sistema de diseño (marca, color, tipografía, retícula, componentes, imágenes)
- `.claude/skills/`: `altiplano-marca`, `altiplano-ui`, `altiplano-editorial`, `altiplano-imagenes`
- `public/brand/`: logo en SVG, PNG (600/1200/2400), PDF y EPS para imprenta, WebP, ICO e isotipo
