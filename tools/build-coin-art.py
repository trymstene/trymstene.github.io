# -*- coding: utf-8 -*-
"""The BANANACOIN — Banana World's currency (banana-stand-plan).

Trym's design (21 Jul): a big golden coin with the FACE AND RAISED ARMS of
the hands-up dance frame stamped in it, everything remapped into gold — the
actual frame 2 sprite, not a redraw from imagination. Big coin first; the
small price-tag coin and the stacks get derived later.

Emits src/data/coin-art.js (COIN_SVGS) + a contact sheet for review.
Run: python tools/build-coin-art.py
"""
import importlib.util
import math
import os
from PIL import Image

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = os.path.join(SITE, 'tools', 'coin-contact.png')

spec = importlib.util.spec_from_file_location('ogc', os.path.join(SITE, 'tools', 'build-og-cards.py'))
ogc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ogc)

# the gold family (close to but NOT the banana body #ffe135 — a coin must
# never read as banana flesh)
OUT = '#7a4a21'   # dark bronze: outline, pupils, features
FACE = '#ffdc55'  # coin face — brightened (Trym: "a bit more yellow")
SHADE = '#e6a817' # inner lip + the banana body, embossed a step darker
DEEP = '#b8781b'  # mouth + deep shading
HI = '#fff6c8'    # eye whites, gloves, sparkle
PALE = '#fff0a0'  # the gloss band's lightest step


class Grid:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = {}

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[(x, y)] = c


def emblem_from_frame(target_w):
    """Frame 2 (hands up), cropped to head + face + raised arms, downscaled
    and every pixel classified into the gold ramp by nearest source colour."""
    frame = ogc.render_banana(2)
    crop = frame.crop((18, 30, 452, 330))  # arms span nearly the full width
    h = round(crop.height * target_w / crop.width)
    small = crop.resize((target_w, h), Image.LANCZOS)
    anchors = [((17, 17, 17), OUT), ((255, 253, 245), HI), ((232, 59, 59), DEEP), ((255, 225, 53), SHADE)]
    g = Grid(target_w, h)
    for y in range(h):
        for x in range(target_w):
            r, gg, b, a = small.getpixel((x, y))
            if a < 90:
                continue
            best, bd = None, 1e9
            for (ar, ag, ab), col in anchors:
                d = (r - ar) ** 2 + (gg - ag) ** 2 + (b - ab) ** 2
                if d < bd:
                    bd, best = d, col
            g.set(x, y, best)
    return g


def big_coin(D, emblem_w):
    """Large coin: boundary-outlined gold disc, inner lip, the frame-2 emblem
    stamped in the middle."""
    g = Grid(D, D)
    c = (D - 1) / 2
    r = D / 2 - 0.6
    filled = set()
    for y in range(D):
        for x in range(D):
            if math.hypot(x - c, y - c) <= r:
                filled.add((x, y))
    for (x, y) in filled:
        edge = any((x + dx, y + dy) not in filled for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge:
            # REEDED edge: the rim alternates dark/darker every ~22° like a
            # real milled coin
            seg = int(((math.atan2(y - c, x - c) + math.pi) / (math.pi / 8))) % 2
            g.set(x, y, OUT if seg else DEEP)
        else:
            d = math.hypot(x - c, y - c)
            if d > r - 2.1:
                # the lip: lit top-left, shaded bottom-right
                g.set(x, y, HI if (x - c) + (y - c) < -r * 0.95 else SHADE)
            elif r - 3.6 < d <= r - 2.6:
                # the GROOVE: a thin ring separating lip from field — deepens
                # to shadow on the lower-right
                g.set(x, y, DEEP if (x - c) + (y - c) > r * 0.45 else SHADE)
            else:
                g.set(x, y, FACE)
    em = emblem_from_frame(emblem_w)
    # bust framing: the body's crop-cut sits low, tucked toward the rim
    ox, oy = round(c - em.w / 2), round(c - em.h / 2) + 3
    for (x, y), col in em.px.items():
        # stamp only onto the coin face — the rim stays clean
        if g.px.get((ox + x, oy + y)) in (FACE, SHADE, HI):
            g.set(ox + x, oy + y, col)
    # THE SHINE: a diagonal gloss band sweeping "/" across the whole coin
    # (over the emblem too — glass, not paint). A wide band + a thin echo.
    GLOSS = {FACE: PALE, SHADE: FACE, DEEP: SHADE}
    for lo, hi in ((-7, -3), (0, 1)):  # offsets from the centre anti-diagonal
        for (x, y), col in list(g.px.items()):
            if lo <= (x + y) - 2 * c <= hi and col in GLOSS:
                g.set(x, y, GLOSS[col])
    return g


def crescent_px(w, sag, thick):
    """TRUE banana crescent (tips up): the circle through tips + belly bottom
    minus the same circle shifted up. Never freehand a banana."""
    R = ((w / 2) ** 2 + sag ** 2) / (2 * sag)
    cy_out, cy_in = sag - R, sag - R - thick
    pts = []
    for y in range(0, sag + thick + 1):
        for x in range(-w // 2 - 1, w // 2 + 2):
            if math.hypot(x, y - cy_out) <= R and math.hypot(x, y - cy_in) > R:
                pts.append((x, y))
    return pts


def arc_px(w, sag, thick):
    """Tiny-size crescent: a CONCENTRIC ring segment (smile band) — the
    shifted-circle subtraction bites holes below ~12px, this can't."""
    R = ((w / 2) ** 2 + sag ** 2) / (2 * sag)
    cy = sag - R
    pts = []
    for y in range(0, sag + 1):
        for x in range(-w // 2 - 1, w // 2 + 2):
            d = math.hypot(x, y - cy)
            if R - thick < d <= R:
                pts.append((x, y))
    return pts


def half(g):
    """the master at half size — clean 2:1 nearest-neighbour, no new art
    (Trym: 'no need to generate new coins when we have the template')"""
    out = Grid((g.w + 1) // 2, (g.h + 1) // 2)
    for y in range(out.h):
        for x in range(out.w):
            c = g.px.get((x * 2, y * 2))
            if c:
                out.set(x, y, c)
    return out


def side_stack(w, n):
    """a pile of coins seen from the side (the background prop)"""
    g = Grid(w, n * 3 + 1)
    h = g.h
    for i in range(n):
        yb = h - 1 - i * 3
        off = i % 2
        x0, x1 = 1 + off, w - 2 - (1 - off)
        for x in range(x0, x1 + 1):
            g.set(x, yb - 2, FACE)
            g.set(x, yb - 1, SHADE)
            g.set(x, yb, DEEP)
        for yy in (yb - 2, yb - 1, yb):
            g.set(x0 - 1, yy, OUT)
            g.set(x1 + 1, yy, OUT)
    # the top coin catches the light
    ty = h - 1 - (n - 1) * 3 - 2
    for x in range(3, min(8, w - 3)):
        if g.px.get((x, ty)) == FACE:
            g.set(x, ty, HI)
    return g


def crop(g):
    """rebase a grid to its painted bounding box — compositions can never be
    clipped again (two hand-sized grids in a row cut the third coin off)"""
    xs = [p[0] for p in g.px]
    ys = [p[1] for p in g.px]
    x0, y0 = min(xs), min(ys)
    out = Grid(max(xs) - x0 + 1, max(ys) - y0 + 1)
    for (x, y), c in g.px.items():
        out.set(x - x0, y - y0, c)
    return out


def cluster(master):
    """several coins — the master itself, halved and clustered"""
    m = half(master)  # 22px
    g = Grid(200, 200)  # oversized scratch; crop() sizes the result
    g.blit(m, 0, 9)
    g.blit(m, 14, 0)
    g.blit(m, 28, 10)
    return crop(g)


def stack_scene(master):
    """three stacks behind, THE coin itself — full size, no downscale — in
    front, overflowing them"""
    a, b, c = side_stack(15, 7), side_stack(13, 5), side_stack(15, 6)
    g = Grid(200, 200)
    base = 60
    g.blit(a, 0, base - a.h)
    g.blit(b, 14, base - b.h)
    g.blit(c, 28, base - c.h)
    g.blit(master, 16, base - master.h)  # the front coin overflows the piles
    return crop(g)


def _blit(self, other, dx, dy):
    for (x, y), c in other.px.items():
        self.set(x + dx, y + dy, c)


Grid.blit = _blit

COIN = big_coin(44, 30)  # 32 muddied the face — 30 keeps the smile readable
VARIANTS = [('coin', COIN), ('coins', cluster(COIN)), ('stack', stack_scene(COIN))]


def to_svg(g):
    rects = []
    for y in range(g.h):
        x = 0
        while x < g.w:
            c = g.px.get((x, y))
            if not c:
                x += 1
                continue
            run = 1
            while g.px.get((x + run, y)) == c:
                run += 1
            rects.append(f'<rect x="{x}" y="{y}" width="{run}" height="1" fill="{c}"/>')
            x += run
    return (f'<svg viewBox="0 0 {g.w} {g.h}" shape-rendering="crispEdges" '
            f'xmlns="http://www.w3.org/2000/svg">' + ''.join(rects) + '</svg>')


# contact sheet: all denominations at 10x on the club's dark floor
K = 10
PAD = 24
sheet_w = sum(g.w for _, g in VARIANTS) * K + PAD * (len(VARIANTS) + 1)
sheet_h = max(g.h for _, g in VARIANTS) * K + PAD * 2
im = Image.new('RGBA', (sheet_w, sheet_h), (13, 11, 20, 255))
ox = PAD
for _, g in VARIANTS:
    oy = PAD + (sheet_h - PAD * 2 - g.h * K) // 2
    for (gx, gy), c in g.px.items():
        rgb = tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))
        for yy in range(K):
            for xx in range(K):
                im.putpixel((ox + gx * K + xx, oy + gy * K + yy), rgb + (255,))
    ox += g.w * K + PAD
im.save(SHEET)
print('sheet ->', SHEET)

# PNG sprites — the PRODUCTION format (inline SVG rects bloated the HTML;
# Trym: "humongous amounts of HTML-bloat"). 1:1 pixel size; pages scale them
# up by INTEGER factors with image-rendering: pixelated.
OUT_DIR = os.path.join(SITE, 'public', 'assets', 'banana-stand')
os.makedirs(OUT_DIR, exist_ok=True)
for name, gr in VARIANTS:
    im2 = Image.new('RGBA', (gr.w, gr.h), (0, 0, 0, 0))
    for (x, y), col in gr.px.items():
        rgb = tuple(int(col[i:i + 2], 16) for i in (1, 3, 5))
        im2.putpixel((x, y), rgb + (255,))
    path = os.path.join(OUT_DIR, f'{name}.png')
    im2.save(path, optimize=True)
    print(f'{name}: {gr.w}x{gr.h} -> {path} ({os.path.getsize(path)} bytes)')
