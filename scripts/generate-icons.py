"""Erzeugt den kompletten kickflow-Icon-Satz aus einer gemeinsamen Vektor-Marke.

Marke: eine steigende Marktwert-Kurve, die im Fussball als Endpunkt-Marker ausläuft.
Aufruf: pip install pillow cairosvg && python3 scripts/generate-icons.py
"""
import math, os, cairosvg
from PIL import Image

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

def mark(uid, layer="color"):
    """layer: color | solid (weisse Silhouette) | marks (nur Ballmuster, weiss)."""
    if layer == "marks":
        return (f'<clipPath id="cb{uid}"><circle cx="{BX}" cy="{BY}" r="{BR}"/></clipPath>'
                f'<g clip-path="url(#cb{uid})">{ball_marks("#FFFFFF")}</g>')
    if layer == "solid":
        return (f'<path d="{LINE}" fill="none" stroke="#FFFFFF" stroke-width="58" '
                f'stroke-linecap="round" stroke-linejoin="round"/>'
                f'<circle cx="{BX}" cy="{BY}" r="{BR}" fill="#FFFFFF"/>')
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

def canvas(size, fill_ratio, bg=True, layer="color", uid="x"):
    s = size * fill_ratio
    k = s / BOX_S
    tx, ty = (size - s) / 2 - BOX_X * k, (size - s) / 2 - BOX_Y * k
    back = (f'<radialGradient id="bg{uid}" cx="38%" cy="28%" r="88%">'
            f'<stop offset="0%" stop-color="{BG_DARK2}"/>'
            f'<stop offset="100%" stop-color="{BG_DARK}"/></radialGradient>'
            f'<rect width="{size}" height="{size}" fill="url(#bg{uid})"/>') if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
            f'viewBox="0 0 {size} {size}">{back}'
            f'<g transform="translate({tx:.3f},{ty:.3f}) scale({k:.6f})">{mark(uid, layer)}</g></svg>')

def render(svg, size):
    import io
    return Image.open(io.BytesIO(cairosvg.svg2png(
        bytestring=svg.encode(), output_width=size, output_height=size))).convert("RGBA")

def monochrome(size, ratio, uid):
    """Weisse Silhouette; das Ballmuster wird aus dem Alphakanal ausgestanzt."""
    solid = render(canvas(size, ratio, bg=False, layer="solid", uid=uid+"s"), size)
    marks = render(canvas(size, ratio, bg=False, layer="marks", uid=uid+"m"), size)
    a, m = solid.getchannel("A"), marks.getchannel("A")
    cut = Image.eval(m, lambda v: 255 - v)
    out = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    out.putalpha(Image.composite(a, Image.new("L", (size, size), 0), cut))
    out.paste((255, 255, 255), (0, 0), out.getchannel("A"))
    return out

# (Pfad, Kantenlänge, Anteil der Marke, deckender Hintergrund)
TARGETS = [
    ("assets/icon.png",                     1024, 0.76, True),
    ("assets/android-icon-foreground.png",   512, 0.62, False),
    ("assets/splash-icon.png",              1024, 0.94, False),
    ("assets/favicon.png",                   196, 0.80, True),
    ("public/icons/icon-192.png",            192, 0.76, True),
    ("public/icons/icon-512.png",            512, 0.76, True),
    ("public/icons/icon-maskable-512.png",   512, 0.60, True),
    ("public/icons/apple-touch-icon.png",    180, 0.76, True),
]

for i, (path, size, ratio, bg) in enumerate(TARGETS):
    im = render(canvas(size, ratio, bg=bg, uid=f"u{i}"), size)
    if bg:                                     # iOS/Store dulden keinen Alphakanal
        flat = Image.new("RGB", (size, size), (11, 15, 12))
        flat.paste(im, (0, 0), im)
        im = flat
    im.save(os.path.join(ROOT, path), optimize=True)
    print(f"{path:44s} {size}x{size}")

# Adaptiver Android-Hintergrund: flache Markenfarbe, damit der Vordergrund frei verschiebbar bleibt.
Image.new("RGB", (512, 512), (11, 15, 12)).save(
    os.path.join(ROOT, "assets/android-icon-background.png"), optimize=True)
print(f"{'assets/android-icon-background.png':44s} 512x512")

monochrome(432, 0.60, "mono").save(os.path.join(ROOT, "assets/android-icon-monochrome.png"), optimize=True)
print(f"{'assets/android-icon-monochrome.png':44s} 432x432")

open(os.path.join(ROOT, "assets/icon.svg"), "w").write(canvas(1024, 0.76, uid="src"))
print(f"{'assets/icon.svg':44s} (Vektorquelle)")
