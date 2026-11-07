"""Exporta las notas del monitor (F:/ALTIPLANO AL DIA/data/posts.db) al sitio.

Genera:
  public/data/noticias.json   notas (con datos clave, fuentes, aportes y discrepancias)
  public/data/boletines.json  boletines PDF consolidados (copiados a public/boletines/)
  public/img/noticias/        fotos de las notas
  public/rss.xml, public/sitemap.xml, public/robots.txt

Uso: python scripts/exportar_noticias.py [ruta_monitor] [--url https://dominio-del-sitio]
"""
import json, re, shutil, sqlite3, sys, unicodedata
from datetime import datetime
from email.utils import format_datetime
from pathlib import Path
from xml.sax.saxutils import escape

args = [a for a in sys.argv[1:] if not a.startswith("--")]
URL = next((sys.argv[i + 1] for i, a in enumerate(sys.argv) if a == "--url" and i + 1 < len(sys.argv)), "http://localhost:5180").rstrip("/")
if URL in args: args.remove(URL)
MON = Path(args[0] if args else r"F:/ALTIPLANO AL DIA")
OUT = Path(__file__).resolve().parent.parent / "public"
for d in ("data", "img/noticias", "boletines"):
    (OUT / d).mkdir(parents=True, exist_ok=True)


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:80]


TEMAS = {"Política": "politica", "Seguridad/Policiales": "seguridad", "Economía": "economia",
         "Educación": "educacion", "Salud": "salud", "Sociedad": "sociedad", "Cultura": "cultura",
         "Deportes": "deportes", "Medio ambiente": "ambiente", "Otros": "otros"}

db = sqlite3.connect(f"file:{MON / 'data/posts.db'}?mode=ro", uri=True)
db.text_factory = lambda b: b.decode("utf-8", "replace")

notas, vistos = [], set()
for gid, amb, tema, nota, medios, fecha, nf in db.execute(
        "select id, ambito, tema, nota_json, medios, fecha_hecho, n_fuentes from grupos "
        "where nota_json is not null order by fecha_hecho desc"):
    try:
        j = json.loads(nota)
    except Exception:
        continue
    tit = (j.get("TITULAR") or "").strip()
    if not tit or not j.get("CUERPO"):
        continue
    s = slug(tit)
    if s in vistos:
        s = f"{s}-{gid}"
    vistos.add(s)

    img = None
    for (ruta,) in db.execute("select imagen from posts where grupo_id=? and imagen is not null", (gid,)):
        p = Path(ruta.replace("\\", "/"))
        if not p.exists():
            p = MON / "data/img" / p.name
        if p.exists():
            shutil.copy2(p, OUT / "img/noticias" / p.name)
            img = f"img/noticias/{p.name}"
            break

    datos = [d["dato"] if isinstance(d, dict) else d for d in j.get("DATOS") or []]
    links = j.get("LINKS") or []
    if isinstance(links, dict):
        links = [links]
    aportes = [{"medio": f.get("medio"), "aporte": f.get("aporte")} for f in j.get("FUENTES") or []
               if f.get("medio") and f.get("aporte") and f.get("aporte") != "fuente única"]
    discrep = [{"aspecto": d.get("aspecto", ""),
                "versiones": [{"medio": v.get("medio"), "dice": v.get("dice")} for v in d.get("versiones") or []]}
               for d in j.get("DISCREPANCIAS") or [] if isinstance(d, dict)]
    boletin = db.execute("select max(consolidado_n) from posts where grupo_id=?", (gid,)).fetchone()[0]

    notas.append({
        "id": gid, "slug": s, "titular": tit, "bajada": j.get("BAJADA", ""),
        "cuerpo": [p.strip() for p in j["CUERPO"].split("\n") if p.strip()],
        "datos": datos, "tema": tema or "Otros", "seccion": TEMAS.get(tema, "otros"),
        "ambito": amb or "REGIONAL", "fecha": fecha,
        "medios": [m.strip() for m in (medios or "").split(",") if m.strip()],
        "fuentes": nf or 1, "imagen": img,
        "enlaces": [{"medio": l.get("medio"), "url": l.get("facebook") or l.get("externo")}
                    for l in links if l.get("facebook") or l.get("externo")],
        "aportes": aportes, "discrepancias": discrep, "boletin": boletin,
    })
(OUT / "data/noticias.json").write_text(json.dumps(notas, ensure_ascii=False, indent=1), encoding="utf-8")

# Edición en PDF: el último boletín diseñado por el monitor ("vista previa" exportada).
# Se busca el más reciente entre el Escritorio (vista_previa_AAAAMMDD_HHMMSS.pdf) y data/vista_previa.pdf.
def ultima_edicion():
    candidatos = list((Path.home() / "Desktop").glob("vista_previa_*.pdf")) + [MON / "data/vista_previa.pdf"]
    candidatos = [c for c in candidatos if c.exists()]
    return max(candidatos, key=lambda c: c.stat().st_mtime) if candidatos else None

for viejo in (OUT / "boletines").glob("*"):
    viejo.unlink()
boletines = []
pdf = ultima_edicion()
if pdf:
    destino = OUT / "boletines" / "edicion-actual.pdf"
    shutil.copy2(pdf, destino)
    info = {"numero": None, "fecha": datetime.fromtimestamp(pdf.stat().st_mtime).isoformat(timespec="seconds"),
            "hora": None, "noticias": None, "paginas": None, "archivo": "boletines/edicion-actual.pdf",
            "portada": None, "kb": round(pdf.stat().st_size / 1024), "origen": pdf.name}
    try:  # metadatos y portada con PyMuPDF (opcional)
        import pymupdf
        doc = pymupdf.open(pdf)
        texto = doc[0].get_text()
        info["paginas"] = doc.page_count
        m = re.search(r"Bolet[ií]n N[°º]\s*(\d+)", (doc.metadata or {}).get("title", "") + " " + texto)
        info["numero"] = int(m.group(1)) if m else None
        m = re.search(r"Edici[oó]n de las (\d{1,2}:\d{2})", texto)
        info["hora"] = m.group(1) if m else None
        m = re.search(r"(\d+)\s+NOTICIAS", texto)
        info["noticias"] = int(m.group(1)) if m else None
        m = re.search(r"vista_previa_(\d{8})_(\d{6})", pdf.name)
        if m:
            info["fecha"] = datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S").isoformat()
        doc[0].get_pixmap(dpi=110).save(OUT / "boletines" / "edicion-actual-portada.jpg", jpg_quality=82)
        info["portada"] = "boletines/edicion-actual-portada.jpg"
    except ImportError:
        print("Aviso: instala pymupdf (py -3.12 -m pip install pymupdf) para la portada y los datos de la edición.")
    boletines.append(info)
(OUT / "data/boletines.json").write_text(json.dumps(boletines, ensure_ascii=False, indent=1), encoding="utf-8")

# RSS 2.0
def rfc822(iso):
    try:
        return format_datetime(datetime.fromisoformat(iso).astimezone())
    except Exception:
        return ""

items = []
for n in notas[:50]:
    link = f"{URL}/nota/{n['slug']}"
    enclosure = f'<enclosure url="{URL}/{n["imagen"]}" type="image/jpeg" length="0"/>' if n["imagen"] else ""
    items.append(
        f"<item><title>{escape(n['titular'])}</title><link>{link}</link><guid isPermaLink=\"true\">{link}</guid>"
        f"<description>{escape(n['bajada'])}</description><category>{escape(n['tema'])}</category>"
        f"<pubDate>{rfc822(n['fecha'] or '')}</pubDate>{enclosure}</item>")
rss = ('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>'
       f"<title>Altiplano al Día</title><link>{URL}/</link><description>Noticias de Puno y la región</description>"
       f"<language>es-PE</language>{''.join(items)}</channel></rss>\n")
(OUT / "rss.xml").write_text(rss, encoding="utf-8")

# Sitemap y robots
rutas = ["", "lo-ultimo", "clima", "ediciones", "denuncia", "boletin", "nosotros"]
rutas += [f"seccion/{v}" for v in sorted(set(TEMAS.values()))]
rutas += [f"nota/{n['slug']}" for n in notas]
urls = "".join(f"<url><loc>{URL}/{r}</loc></url>" for r in rutas)
(OUT / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n', encoding="utf-8")
(OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {URL}/sitemap.xml\n", encoding="utf-8")

print(f"{len(notas)} notas ({sum(1 for n in notas if n['imagen'])} con foto, "
      f"{sum(1 for n in notas if n['discrepancias'])} con discrepancias), {len(boletines)} boletines PDF")
