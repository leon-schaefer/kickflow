"""Erzeugt den kompletten kickflow-Bildsatz aus einer gemeinsamen Vektor-Marke.

Marke: eine steigende Marktwert-Kurve, die im Fussball als Endpunkt-Marker ausläuft.
Aufruf: pip install pillow cairosvg && python3 scripts/generate-icons.py

Erzeugt drei Gruppen, alle aus derselben Geometrie weiter unten:

  1. Die Icons (Favicon, PWA-Icons, Apple-Touch-Icon) — quadratisch.
  2. public/favicon.svg — dieselbe Marke als VEKTOR. Moderne Browser
     bevorzugen sie gegenüber der PNG-Variante und skalieren sie scharf auf
     jede Tab- und Lesezeichen-Groesse; die PNG bleibt als Rueckfall fuer
     alles, was SVG-Favicons nicht kennt.
  3. public/og-image.png — das Vorschaubild fuer Links (Open Graph, Twitter
     Card), 1200x630. Das Format ist nicht frei waehlbar: 1.91:1 ist das
     Seitenverhaeltnis, das Facebook, LinkedIn, Slack, WhatsApp und Discord
     erwarten. Wer es aendert, bekommt beschnittene Vorschauen.

Die ERZEUGNISSE sind eingecheckt, dieses Skript laeuft nicht im Build. Es
braucht cairosvg (System-Cairo) und eine Schrift, beides in CI nicht
garantiert — und die Marke aendert sich einmal im Jahr, nicht pro Commit.
"""
import math, os, cairosvg
from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
BG_DARK, BG_DARK2 = "#0B0F0C", "#16231A"
GREEN, GREEN_HI, GREEN_LO = "#3FBF63", "#6FE08C", "#1E7A3C"
WHITE = "#F3F6F3"

# Marken-Geometrie im lokalen 1024er-Raum; Bounding-Box 167,129 .. 866,828 (quadratisch).
BOX_X, BOX_Y, BOX_S = 167, 129, 699
LINE = "M 196,738 L 342,600 L 452,672 L 620,436 L 712,344"
BX, BY, BR = 734, 322, 132

def pt(cx, cy, r, deg):
    a = math.radians(deg); return (cx + r*math.cos(a), cy + r*math.sin(a))

def poly(cx, cy, r, rot, n=5):
    return " ".join(f"{x:.2f},{y:.2f}" for x, y in (pt(cx, cy, r, rot + 360*i/n) for i in range(n)))

def ball_marks(color):
    """Nähte und Fünfecke des Fussballs — ohne den weissen Grundkreis."""
    r, seam = BR, 0.062*BR
    out = [f'<polygon points="{poly(BX, BY, 0.335*r, -90)}" fill="{color}"/>']
    for i in range(5):
        th = -90 + 72*i
        x1, y1 = pt(BX, BY, 0.335*r, th)
        x2, y2 = pt(BX, BY, 0.60*r, th)
        out.append(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{color}" '
                   f'stroke-width="{seam:.2f}" stroke-linecap="round"/>')
        for d in (-31, 31):
            x3, y3 = pt(BX, BY, 1.16*r, th + d)
            out.append(f'<line x1="{x2:.2f}" y1="{y2:.2f}" x2="{x3:.2f}" y2="{y3:.2f}" stroke="{color}" '
                       f'stroke-width="{seam:.2f}" stroke-linecap="round"/>')
    for i in range(5):
        th = -90 + 36 + 72*i
        rx, ry = pt(BX, BY, 1.12*r, th)
        out.append(f'<polygon points="{poly(rx, ry, 0.36*r, th + 180)}" fill="{color}"/>')
    return "".join(out)

def mark(uid):
    return f'''
  <linearGradient id="g{uid}" x1="{BOX_X}" y1="828" x2="866" y2="{BOX_Y}" gradientUnits="userSpaceOnUse">
    <stop offset="0%" stop-color="{GREEN_LO}"/><stop offset="55%" stop-color="{GREEN}"/>
    <stop offset="100%" stop-color="{GREEN_HI}"/>
  </linearGradient>
  <clipPath id="cb{uid}"><circle cx="{BX}" cy="{BY}" r="{BR}"/></clipPath>
  <path d="{LINE}" fill="none" stroke="url(#g{uid})" stroke-width="58"
        stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="{BX}" cy="{BY}" r="{BR}" fill="{WHITE}"/>
  <g clip-path="url(#cb{uid})">{ball_marks(BG_DARK)}</g>'''

def canvas(size, fill_ratio, bg=True, uid="x"):
    s = size * fill_ratio
    k = s / BOX_S
    tx, ty = (size - s) / 2 - BOX_X * k, (size - s) / 2 - BOX_Y * k
    back = (f'<radialGradient id="bg{uid}" cx="38%" cy="28%" r="88%">'
            f'<stop offset="0%" stop-color="{BG_DARK2}"/>'
            f'<stop offset="100%" stop-color="{BG_DARK}"/></radialGradient>'
            f'<rect width="{size}" height="{size}" fill="url(#bg{uid})"/>') if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
            f'viewBox="0 0 {size} {size}">{back}'
            f'<g transform="translate({tx:.3f},{ty:.3f}) scale({k:.6f})">{mark(uid)}</g></svg>')

def render(svg, size):
    import io
    return Image.open(io.BytesIO(cairosvg.svg2png(
        bytestring=svg.encode(), output_width=size, output_height=size))).convert("RGBA")

# --------------------------------------------------------------------------
# Speichern
# --------------------------------------------------------------------------
# Alle Bilder dieses Skripts sind derselbe dunkle Radialverlauf mit einer
# gruenen Kurve und einem weissen Ball darauf. Als 24-Bit-RGB kostet das rund
# das Doppelte dessen, was eine 256er-Palette braucht:
#
#   favicon.png             11247 -> 6109 Bytes  (-46 %)
#   icon-192.png            10762 -> 6067 Bytes  (-44 %)
#   icon-512.png            31174 -> 15714 Bytes (-50 %)
#   icon-maskable-512.png   28463 -> 14972 Bytes (-47 %)
#   apple-touch-icon.png     9984 -> 5561 Bytes  (-44 %)
#   og-image.png            64045 -> 32621 Bytes (-49 %)
#
# ## Warum MIT Dithering, obwohl das die Datei groesser macht
#
# Die naheliegende Variante — Palette OHNE Dithering — ist deutlich kleiner
# (og-image: 20296 statt 32621 Bytes, also -68 % statt -49 %) und sieht in der
# Messung sogar besser aus: die groesste Abweichung EINES Kanals EINES Pixels
# liegt bei 3 von 255.
#
# Sie ist trotzdem falsch, und das ist hier einmal ausprobiert und am Bild
# verglichen worden: bei 3/255 sind im Verlauf konzentrische Ringe SICHTBAR.
# Der Grund ist, dass der Fehler ohne Dithering strukturiert ist — er verlaeuft
# entlang der Linien gleicher Helligkeit und legt damit genau das Muster an,
# fuer das das Auge am empfindlichsten ist. Der Verlauf spannt hier nur rund
# 11 Helligkeitsstufen je Kanal (#16231A nach #0B0F0C); auf 1200px Breite
# gedehnt liegt jede Stufengrenze als sichtbare Kante im Bild.
#
# Dithering verteilt denselben Fehler als feines Rauschen und die Ringe sind
# weg. Die Lehre daraus steht hier, weil die Messung in die Irre fuehrt: eine
# Schranke auf den maximalen Kanalfehler ist fuer Banding der falsche
# Waechter. Der Waechter unten prueft deshalb den mittleren Fehler (RMSE), fuer
# den Dithering keine Ausrede hat.
#
# `optimize=True` allein bringt uebrigens nichts mehr: PIL faehrt zlib dabei
# schon auf Stufe 9, `compress_level=9` liefert byteidentische Dateien. Mehr
# als das hier holen nur externe Optimierer (oxipng, zopflipng) heraus,
# typischerweise weitere 5-15 % — die sind hier absichtlich keine
# Voraussetzung, weil dieses Skript von Hand laeuft und nicht im Build.
MAX_RMSE = 1.5

def save_png(im, rel_path, opaque_bg=(11, 15, 12)):
    """Speichert als gedithertes 256-Farben-PNG und prueft die Abweichung nach.

    Die Pruefung ist der Punkt: die Palette ist nur deshalb unbedenklich, weil
    DIESE Marke so wenige Farbtoene hat. Wuerde sie einmal bunter — ein Foto,
    ein zweiter Verlauf —, reichten 256 Farben nicht mehr, und niemand sieht
    das an einem 192px-Icon auf einem Homescreen. Dann bricht lieber dieses
    Skript.
    """
    if opaque_bg is not None:
        # Ohne Alphakanal: ein Favicon mit Transparenz verschwindet in einer
        # hellen Tab-Leiste, und einige Vorschau-Bots legen ein transparentes
        # OG-Bild auf Schwarz oder Weiss.
        flat = Image.new("RGB", im.size, opaque_bg)
        flat.paste(im, (0, 0), im if im.mode == "RGBA" else None)
        im = flat

    rgb = im.convert("RGB")
    # `convert("P", ADAPTIVE)` ist die Variante MIT Floyd-Steinberg-Dithering;
    # `quantize(dither=NONE)` waere die ohne. Siehe die Begruendung oben.
    quantized = rgb.convert("P", palette=Image.ADAPTIVE, colors=256)

    hist = ImageChops.difference(rgb, quantized.convert("RGB")).histogram()
    sq = n = 0
    for ch in range(3):
        for value, count in enumerate(hist[ch * 256:(ch + 1) * 256]):
            sq += count * value * value
            n += count
    rmse = math.sqrt(sq / n)
    if rmse > MAX_RMSE:
        raise SystemExit(
            f"{rel_path}: 256-Farben-Palette weicht im Mittel um {rmse:.2f}/255 ab "
            f"(erlaubt: {MAX_RMSE}). Die Marke hat jetzt zu viele Farbtoene fuer "
            f"eine Palette — save_png() auf RGB umstellen und die Groessen in den "
            f"Kommentaren darueber neu messen."
        )

    out = os.path.join(ROOT, rel_path)
    quantized.save(out, optimize=True)
    return os.path.getsize(out), rmse

# (Pfad, Kantenlänge, Anteil der Marke, deckender Hintergrund)
TARGETS = [
    ("public/favicon.png",                   196, 0.80, True),
    ("public/icons/icon-192.png",            192, 0.76, True),
    ("public/icons/icon-512.png",            512, 0.76, True),
    ("public/icons/icon-maskable-512.png",   512, 0.60, True),
    ("public/icons/apple-touch-icon.png",    180, 0.76, True),
]

for i, (path, size, ratio, bg) in enumerate(TARGETS):
    im = render(canvas(size, ratio, bg=bg, uid=f"u{i}"), size)
    written, rmse = save_png(im, path, opaque_bg=(11, 15, 12) if bg else None)
    print(f"{path:44s} {size}x{size}  {written:6d} B  (RMSE {rmse:.2f}/255)")

open(os.path.join(ROOT, "assets/icon.svg"), "w").write(canvas(1024, 0.76, uid="src"))
print(f"{'assets/icon.svg':44s} (Vektorquelle)")

# --------------------------------------------------------------------------
# Vektor-Favicon
# --------------------------------------------------------------------------
# Derselbe Aufruf wie die Vektorquelle, nur kleiner im viewBox — bei einem SVG
# ist die Zahl ohnehin nur der Bezugsrahmen, nicht die Ausgabegroesse. Der
# deckende Hintergrund bleibt AN: ein Favicon mit Alphakanal verschwindet in
# einer hellen Tab-Leiste, weil die dunkle Marke dann auf Weiss sitzt.
open(os.path.join(ROOT, "public/favicon.svg"), "w").write(canvas(64, 0.80, uid="fav"))
print(f"{'public/favicon.svg':44s} (Vektor-Favicon)")

# --------------------------------------------------------------------------
# Open-Graph-Vorschaubild
# --------------------------------------------------------------------------
OG_W, OG_H = 1200, 630
OG_MARGIN = 80
OG_TITLE = "kickflow"
OG_TAGLINE = "Aufstellung, Markt und Marktwerte"
OG_NOTE = "Inoffizielle App – nicht mit der Kickbase GmbH verbunden"

# Liberation Sans zuerst (metrisch wie Arial, auf Debian/Ubuntu vorhanden),
# DejaVu als Rückfall. Absichtlich eine LISTE mit klarem Fehler am Ende statt
# eines stillen Rückfalls auf PILs Bitmap-Default: der wäre bei 96px eine
# unlesbare Treppe, und das fällt an einem Bild, das niemand prüfen lässt,
# erst in einer fremden Chat-Vorschau auf.
FONT_CANDIDATES = {
    "bold": [
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ],
    "regular": [
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ],
}

def font_path(weight):
    for path in FONT_CANDIDATES[weight]:
        if os.path.exists(path):
            return path
    raise SystemExit(
        f"Keine {weight}-Schrift gefunden. Erwartet eine von:\n  "
        + "\n  ".join(FONT_CANDIDATES[weight])
        + "\n(Debian/Ubuntu: apt-get install fonts-liberation)"
    )

def fitted(weight, text, size, max_width, floor=14):
    """Groesste Schriftgroesse <= `size`, bei der `text` in `max_width` passt.

    Das ist kein Feinschliff, sondern der Fehler, der hier schon passiert ist:
    mit fest gesetzten 40px lief die Zeile rechts aus dem Bild heraus, und ein
    OG-Bild sieht sich niemand an — es wird in einer fremden Chat-Vorschau
    sichtbar, Wochen spaeter. Gemessen statt geschaetzt, weil die Metriken je
    nach gefundener Schrift (Liberation vs. DejaVu) anders ausfallen: DejaVu
    laeuft deutlich breiter, dieselbe Zahl kaeme dort wieder zu weit.
    """
    path = font_path(weight)
    for px in range(size, floor - 1, -1):
        f = ImageFont.truetype(path, px)
        if f.getbbox(text)[2] <= max_width:
            return f
    raise SystemExit(f"{text!r} passt selbst bei {floor}px nicht in {max_width}px")

def og_background():
    """Derselbe radiale Verlauf wie die Icons, nur im 1.91:1-Rahmen.

    Ueber cairosvg und nicht per PIL-Pixelschleife: der Verlauf ist damit
    garantiert derselbe wie auf den Icons, weil es dieselben zwei Stops sind.
    """
    import io
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{OG_W}" height="{OG_H}">'
           f'<radialGradient id="bgog" cx="30%" cy="24%" r="95%">'
           f'<stop offset="0%" stop-color="{BG_DARK2}"/>'
           f'<stop offset="100%" stop-color="{BG_DARK}"/></radialGradient>'
           f'<rect width="{OG_W}" height="{OG_H}" fill="url(#bgog)"/></svg>')
    return Image.open(io.BytesIO(cairosvg.svg2png(
        bytestring=svg.encode(), output_width=OG_W, output_height=OG_H))).convert("RGBA")

def build_og():
    img = og_background()

    # Die Marke links, ohne eigenen Hintergrund (bg=False) — sie sitzt auf dem
    # Verlauf des Bildes und braucht keine zweite Flaeche darunter.
    mark_size = 260
    mark = render(canvas(mark_size, 1.0, bg=False, uid="og"), mark_size)
    mark_x, mark_y = OG_MARGIN, (OG_H - mark_size) // 2
    img.paste(mark, (mark_x, mark_y), mark)

    draw = ImageDraw.Draw(img)
    text_x = mark_x + mark_size + 56
    avail = OG_W - text_x - OG_MARGIN

    title_f = fitted("bold", OG_TITLE, 104, avail)
    tag_f = fitted("regular", OG_TAGLINE, 40, avail)
    note_f = fitted("regular", OG_NOTE, 24, avail)

    # Von der vertikalen Mitte aus gesetzt und nicht von oben: so bleibt der
    # Block mittig, auch wenn eine Zeile dazukommt oder wegfaellt. Gemessen
    # wird mit `textbbox`, weil die Oberlaenge der Wortmarke sonst nicht
    # mitzaehlt.
    RULE_H, GAP_TITLE, GAP_RULE, GAP_TAG = 5, 24, 24, 28
    title_h = draw.textbbox((0, 0), OG_TITLE, font=title_f)[3]
    tag_h = draw.textbbox((0, 0), OG_TAGLINE, font=tag_f)[3]
    note_h = draw.textbbox((0, 0), OG_NOTE, font=note_f)[3]
    block_h = title_h + GAP_TITLE + RULE_H + GAP_RULE + tag_h + GAP_TAG + note_h
    y = (OG_H - block_h) // 2

    draw.text((text_x, y), OG_TITLE, font=title_f, fill=WHITE)
    y += title_h + GAP_TITLE
    # Akzentlinie zwischen Wortmarke und Zeile — greift das Gruen der Marke auf.
    draw.rectangle([text_x, y, text_x + 96, y + RULE_H], fill=GREEN)
    y += RULE_H + GAP_RULE
    draw.text((text_x, y), OG_TAGLINE, font=tag_f, fill="#9BAA9C")
    y += tag_h + GAP_TAG
    # Der Hinweis gehoert aufs Bild und nicht nur in die Seite: eine
    # Chat-Vorschau zeigt oft NUR Bild und Titel, und die Abgrenzung zur
    # Kickbase GmbH soll genau dort nicht fehlen. `--color-text-muted` aus den
    # Tokens, das seit dem Kontrast-Fix 4.68:1 auf dieser Flaeche erreicht.
    draw.text((text_x, y), OG_NOTE, font=note_f, fill="#849085")

    written, rmse = save_png(img, "public/og-image.png")
    print(f"{'public/og-image.png':44s} {OG_W}x{OG_H}  {written:6d} B  "
          f"(RMSE {rmse:.2f}/255, Titel {title_f.size}px, "
          f"Zeile {tag_f.size}px, Hinweis {note_f.size}px)")

build_og()
