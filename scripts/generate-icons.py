"""Erzeugt alle Bild-Assets von kickflow aus einer gemeinsamen Vektor-Marke.

Marke: eine steigende Marktwert-Kurve, die im Fussball als Endpunkt-Marker ausläuft.
Aufruf: pip install pillow cairosvg && python3 scripts/generate-icons.py

Drei Sorten Ausgabe, alle aus derselben Geometrie:

  * Der Icon-Satz (quadratisch, TARGETS) - Favicon, PWA-Icons, Apple-Touch-Icon.
  * public/favicon.svg - dieselbe Marke als VEKTOR. Moderne Browser bevorzugen
    sie gegenueber der PNG und skalieren sie scharf auf jede Tab- und
    Lesezeichen-Groesse; die PNG bleibt als Rueckfall.
  * Das Share-Bild public/og-image.png (1200x630, OG_TARGET) - das Vorschaubild,
    das WhatsApp, Discord, Reddit & Co. zu einem geteilten Link zeigen. Es ist
    das einzige Asset mit Text; alles andere ist reine Geometrie.

Das Ergebnis ist deterministisch und liegt im Repo - laufen muss das Skript nur,
wenn sich die Marke oder der Text im Share-Bild aendert.
"""
import math, os, cairosvg
from PIL import Image, ImageChops

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

# (Pfad, Kantenlänge, Anteil der Marke, deckender Hintergrund)
# ---------------------------------------------------------------------------
# Speichern
# ---------------------------------------------------------------------------
# Alle Bilder hier sind derselbe dunkle Radialverlauf mit einer gruenen Kurve
# und einem weissen Ball darauf. Als 24-Bit-RGB kostet das etwa das Doppelte
# dessen, was eine 256er-Palette braucht — gemessen ueber den ganzen Satz:
# 156 kB auf 81 kB (-48 %).
#
# ## Warum MIT Dithering, obwohl das die Datei groesser macht
#
# Die naheliegende Variante — Palette OHNE Dithering — ist deutlich kleiner
# (-68 % statt -48 %) und sieht in der Messung sogar besser aus: die groesste
# Abweichung EINES Kanals EINES Pixels liegt bei 3 von 255.
#
# Sie ist trotzdem falsch, und das ist einmal ausprobiert und am Bild
# verglichen worden: bei 3/255 sind im Verlauf konzentrische Ringe SICHTBAR.
# Ohne Dithering ist der Fehler strukturiert — er verlaeuft entlang der Linien
# gleicher Helligkeit und legt genau das Muster an, fuer das das Auge am
# empfindlichsten ist. Der Verlauf spannt hier nur rund 11 Helligkeitsstufen je
# Kanal (#16231A nach #0B0F0C); auf 1200px Breite gedehnt liegt jede
# Stufengrenze als sichtbare Kante im Bild.
#
# Dithering verteilt denselben Fehler als feines Rauschen, und die Ringe sind
# weg. Die Lehre steht hier, weil die Messung in die Irre fuehrt: eine Schranke
# auf den maximalen Kanalfehler ist fuer Banding der falsche Waechter. Der
# Waechter unten prueft deshalb den mittleren Fehler (RMSE), fuer den Dithering
# keine Ausrede hat.
#
# `optimize=True` allein bringt nichts mehr: PIL faehrt zlib dabei schon auf
# Stufe 9, `compress_level=9` liefert byteidentische Dateien. Mehr holen nur
# externe Optimierer (oxipng, zopflipng) heraus, typischerweise weitere
# 5-15 % — die sind hier absichtlich keine Voraussetzung, weil dieses Skript
# von Hand laeuft und nicht im Build.
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
        # hellen Tab-Leiste, und Vorschaukarten kennen kein Alpha.
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

# Derselbe Aufruf wie die Vektorquelle, nur kleiner im viewBox — bei einem SVG
# ist die Zahl ohnehin nur der Bezugsrahmen, nicht die Ausgabegroesse. Der
# deckende Hintergrund bleibt AN: ein Favicon mit Alphakanal verschwindet in
# einer hellen Tab-Leiste, weil die dunkle Marke dann auf Weiss sitzt.
open(os.path.join(ROOT, "public/favicon.svg"), "w").write(canvas(64, 0.80, uid="fav"))
print(f"{'public/favicon.svg':44s} (Vektor-Favicon)")

# ---------------------------------------------------------------------------
# Share-Bild (Open Graph)
# ---------------------------------------------------------------------------
#
# 1200x630 ist das Format, auf das WhatsApp, Discord, Slack, Reddit und X ihre
# grosse Vorschaukarte auslegen (Seitenverhaeltnis 1.91:1). Kleinere Karten
# beschneiden mittig, deshalb steht alles Tragende in der Mitte und nichts am
# Rand.
#
# Der Text ist der einzige Teil der Marke, der nicht aus Geometrie entsteht.
# `SHARE_FONT` ist bewusst ein Stack mit generischem Ende: gerendert wird mit
# dem, was auf der Maschine liegt, die das Skript aufruft. Das Ergebnis liegt
# als PNG im Repo — wer es neu erzeugt und keine der genannten Schriften hat,
# bekommt eine andere Anmutung und sollte das Bild dann anschauen, bevor er es
# committet.
TEXT_MUTED, TEXT_SECONDARY = "#6B786C", "#9BAA9C"
SHARE_FONT = "DejaVu Sans,Helvetica,Arial,sans-serif"
OG_W, OG_H = 1200, 630
OG_TARGET = "public/og-image.png"

# Die Zeilen des Share-Bildes: (Text, Grundlinie y, Schriftgrad, Gewicht, Farbe).
SHARE_LINES = [
    ("kickflow", 408, 92, "700", WHITE),
    ("Der Aufstellungs-Optimizer für deine Kickbase-Liga", 466, 34, "400", TEXT_SECONDARY),
    ("Inoffiziell · kostenlos · läuft im Browser", 530, 26, "400", TEXT_MUTED),
]


def share_canvas(uid="og"):
    """Das Share-Bild: Marke oben mittig, darunter Wortmarke und zwei Textzeilen."""
    mark_h = 190
    k = mark_h / BOX_S
    tx, ty = OG_W / 2 - (BOX_X + BOX_S / 2) * k, 86 - BOX_Y * k
    text = "".join(
        f'<text x="{OG_W / 2:.0f}" y="{y}" text-anchor="middle" font-family="{SHARE_FONT}" '
        f'font-size="{size}" font-weight="{weight}" fill="{fill}">{label}</text>'
        for label, y, size, weight, fill in SHARE_LINES
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{OG_W}" height="{OG_H}" '
        f'viewBox="0 0 {OG_W} {OG_H}">'
        f'<radialGradient id="bg{uid}" cx="38%" cy="28%" r="88%">'
        f'<stop offset="0%" stop-color="{BG_DARK2}"/>'
        f'<stop offset="100%" stop-color="{BG_DARK}"/></radialGradient>'
        f'<rect width="{OG_W}" height="{OG_H}" fill="url(#bg{uid})"/>'
        f'<g transform="translate({tx:.3f},{ty:.3f}) scale({k:.6f})">{mark(uid)}</g>'
        f"{text}</svg>"
    )


import io as _io  # noqa: E402  — lokal, damit `render` oben unveraendert bleibt

_png = cairosvg.svg2png(bytestring=share_canvas().encode(), output_width=OG_W, output_height=OG_H)
_im = Image.open(_io.BytesIO(_png)).convert("RGBA")
_written, _rmse = save_png(_im, OG_TARGET)
print(f"{OG_TARGET:44s} {OG_W}x{OG_H}  {_written:6d} B  (RMSE {_rmse:.2f}/255)")
