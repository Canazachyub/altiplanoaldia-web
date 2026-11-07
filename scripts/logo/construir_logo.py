"""Reconstruye el logo de Altiplano al Día como SVG vectorial (texto convertido a trazos)
y lo exporta a PNG, PDF, EPS, WebP e ICO.

Uso:  py -3.12 scripts/logo/construir_logo.py
Requiere: fonttools, pillow, Inkscape (C:/Program Files/Inkscape/bin/inkscape.exe)
"""
import subprocess
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
FUENTES = RAIZ / "public" / "fonts"
SALIDA = RAIZ / "public" / "brand"
INKSCAPE = r"C:/Program Files/Inkscape/bin/inkscape.exe"

AZUL, AMARILLO, NEGRO, BLANCO = "#043F9B", "#FFEE00", "#111111", "#FFFFFF"

SLAB = TTFont(FUENTES / "AlfaSlabOne-Regular.ttf")
SERIF = TTFont(FUENTES / "PT_Serif-Web-Regular.ttf")


def texto(font, cadena, tam, x, y, espaciado=0.0):
    """Devuelve (d, ancho) del texto como trazo SVG con línea base en y."""
    gs, cmap = font.getGlyphSet(), font.getBestCmap()
    upm = font["head"].unitsPerEm
    k = tam / upm
    pen = SVGPathPen(gs)
    cx = 0.0
    for ch in cadena:
        nombre = cmap[ord(ch)]
        glifo = gs[nombre]
        glifo.draw(TransformPen(pen, (k, 0, 0, -k, x + cx, y)))
        cx += glifo.width * k + espaciado
    return pen.getCommands(), cx - espaciado


def ancho(font, cadena, tam, espaciado=0.0):
    return texto(font, cadena, tam, 0, 0, espaciado)[1]


def caja_tinta(font, letra, tam):
    """Ancho y alto de tinta (bbox) de un glifo a un tamaño dado."""
    from fontTools.pens.boundsPen import BoundsPen
    gs = font.getGlyphSet()
    bp = BoundsPen(gs)
    gs[font.getBestCmap()[ord(letra)]].draw(bp)
    x0, y0, x1, y1 = bp.bounds
    k = tam / font["head"].unitsPerEm
    return x0 * k, y0 * k, x1 * k, y1 * k


def svg(w, h, cuerpo, fondo=None):
    bg = f'<rect width="{w}" height="{h}" fill="{fondo}"/>' if fondo else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" '
            f'width="{w:.0f}" height="{h:.0f}" role="img" aria-label="Altiplano al Día">'
            f'<title>Altiplano al Día</title>{bg}{cuerpo}</svg>\n')


def isotipo(x, y, lado, color_a=AZUL, color_caja=AMARILLO):
    """Cuadro amarillo con la A azul: geometría propia que replica la A del logo original
    (ápice plano, contraforma triangular, patas con remate slab). Coordenadas en caja 100x100."""
    exterior = [(39, 9), (61, 9), (83, 79), (89, 79), (89, 91), (60, 91), (60, 79), (64, 79),
                (60.5, 67), (39.5, 67), (36, 79), (40, 79), (40, 91), (11, 91), (11, 79), (17, 79)]
    contra = [(50, 27), (56.5, 53), (43.5, 53)]
    k = lado / 100

    def trazo(pts):
        return "M" + " L".join(f"{x + px * k:.2f} {y + py * k:.2f}" for px, py in pts) + " Z"

    d = trazo(exterior) + " " + trazo(contra)
    return (f'<rect x="{x}" y="{y}" width="{lado}" height="{lado}" fill="{color_caja}"/>'
            f'<path d="{d}" fill="{color_a}" fill-rule="evenodd"/>')


def logo_horizontal(color_txt=NEGRO, color_a=AZUL, color_caja=AMARILLO):
    alto = 266
    lado = alto
    cuerpo = isotipo(0, 0, lado, color_a, color_caja)
    tam = 236
    base = 190
    x = lado + 6
    d, w = texto(SLAB, "ltiplano", tam, x, base, espaciado=-4)
    cuerpo += f'<path d="{d}" fill="{color_txt}"/>'
    fin = x + w
    tam2 = 64
    w2 = ancho(SERIF, "AL DÍA", tam2, espaciado=4)
    d2, _ = texto(SERIF, "AL DÍA", tam2, fin - w2, alto - 6, espaciado=4)
    cuerpo += f'<path d="{d2}" fill="{color_txt}"/>'
    return fin + 4, alto, cuerpo


def logo_apilado(color_txt=NEGRO):
    """Versión vertical: isotipo arriba, nombre debajo (redes, avatares grandes)."""
    lado = 300
    tam = 150
    w = ancho(SLAB, "Altiplano", tam, -2)
    W = max(w, lado) + 40
    cuerpo = isotipo((W - lado) / 2, 20, lado)
    d, _ = texto(SLAB, "Altiplano", tam, (W - w) / 2, 20 + lado + 150, -2)
    cuerpo += f'<path d="{d}" fill="{color_txt}"/>'
    tam2 = 70
    w2 = ancho(SERIF, "AL DÍA", tam2, 6)
    d2, _ = texto(SERIF, "AL DÍA", tam2, (W - w2) / 2, 20 + lado + 245, 6)
    cuerpo += f'<path d="{d2}" fill="{color_txt}"/>'
    return W, 20 + lado + 275, cuerpo


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    piezas = {}
    w, h, c = logo_horizontal()
    piezas["logo-horizontal"] = svg(w, h, c)
    w, h, c = logo_horizontal(BLANCO)
    piezas["logo-horizontal-blanco"] = svg(w, h, c)
    w, h, c = logo_horizontal(BLANCO, AZUL, AMARILLO)
    piezas["logo-horizontal-fondo-azul"] = svg(w + 60, h + 60, f'<g transform="translate(30 30)">{c}</g>', AZUL)
    w, h, c = logo_horizontal(NEGRO, NEGRO, "#FFFFFF")
    piezas["logo-horizontal-mono"] = svg(w, h, f'<rect width="266" height="266" fill="none" stroke="#111" stroke-width="10"/>{c}')
    w, h, c = logo_apilado()
    piezas["logo-apilado"] = svg(w, h, c)
    piezas["isotipo"] = svg(512, 512, isotipo(0, 0, 512))
    piezas["isotipo-redondo"] = svg(512, 512, f'<clipPath id="r"><circle cx="256" cy="256" r="256"/></clipPath><g clip-path="url(#r)">{isotipo(0, 0, 512)}</g>')
    piezas["favicon"] = svg(64, 64, isotipo(0, 0, 64))

    for nombre, contenido in piezas.items():
        (SALIDA / f"{nombre}.svg").write_text(contenido, encoding="utf-8")

    # Rasterizados y formatos de imprenta con Inkscape
    png = SALIDA / "png"; png.mkdir(exist_ok=True)
    imp = SALIDA / "imprenta"; imp.mkdir(exist_ok=True)
    tareas = []
    for nombre in ["logo-horizontal", "logo-horizontal-blanco", "logo-horizontal-fondo-azul", "logo-horizontal-mono", "logo-apilado"]:
        for ancho_px in (600, 1200, 2400):
            tareas.append((nombre, ["--export-type=png", f"--export-width={ancho_px}", f"--export-filename={png / f'{nombre}-{ancho_px}.png'}"]))
        tareas.append((nombre, ["--export-type=pdf", "--export-text-to-path", f"--export-filename={imp / f'{nombre}.pdf'}"]))
        tareas.append((nombre, ["--export-type=eps", "--export-text-to-path", f"--export-filename={imp / f'{nombre}.eps'}"]))
    for tam in (16, 32, 48, 180, 192, 512, 1024):
        tareas.append(("isotipo", ["--export-type=png", f"--export-width={tam}", f"--export-filename={png / f'isotipo-{tam}.png'}"]))
    tareas.append(("isotipo-redondo", ["--export-type=png", "--export-width=1024", f"--export-filename={png / 'isotipo-redondo-1024.png'}"]))
    for nombre, args in tareas:
        subprocess.run([INKSCAPE, str(SALIDA / f"{nombre}.svg"), *args], check=True, capture_output=True)

    # WebP para la web, ICO multi-tamaño e íconos PWA en /public
    for nombre in ["logo-horizontal", "logo-horizontal-blanco"]:
        Image.open(png / f"{nombre}-1200.png").save(SALIDA / f"{nombre}.webp", "WEBP", quality=92)
    Image.open(png / "isotipo-512.png").save(RAIZ / "public" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    for tam, destino in ((180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png")):
        (RAIZ / "public" / destino).write_bytes((png / f"isotipo-{tam}.png").read_bytes())
    (RAIZ / "public" / "favicon.svg").write_text(piezas["favicon"], encoding="utf-8")
    print("Logo generado en", SALIDA)


if __name__ == "__main__":
    main()
