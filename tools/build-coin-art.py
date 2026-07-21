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


COIN = big_coin(44, 30)  # 32 muddied the face — 30 keeps the smile readable
VARIANTS = [('coin', COIN)]


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


# contact sheet: the big coin at 10x on the club's dark floor
K = 10
PAD = 24
g = COIN
im = Image.new('RGBA', (g.w * K + PAD * 2, g.h * K + PAD * 2), (13, 11, 20, 255))
for (gx, gy), c in g.px.items():
    rgb = tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))
    for yy in range(K):
        for xx in range(K):
            im.putpixel((PAD + gx * K + xx, PAD + gy * K + yy), rgb + (255,))
im.save(SHEET)
print('sheet ->', SHEET)

out_js = os.path.join(SITE, 'src', 'data', 'coin-art.js')
lines = [
    '// GENERATED by tools/build-coin-art.py — do not hand-edit; rerun the tool.',
    '// THE BANANACOIN: the hands-up dance frame stamped in gold. Small/stack',
    '// denominations get derived from this master later (banana-stand-plan).',
    'export const COIN_SVGS = {',
]
for name, gr in VARIANTS:
    svg = to_svg(gr)
    print(f'{name}: {gr.w}x{gr.h}, {len(svg)} chars')
    lines.append(f"  {name}: '{svg}',")
lines.append('};')
with open(out_js, 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(lines) + '\n')
print('wrote', out_js)
