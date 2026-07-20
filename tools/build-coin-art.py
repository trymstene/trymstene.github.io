# -*- coding: utf-8 -*-
"""Bananacoin pixel art — the three denominations of Banana World's currency
(banana-stand-plan): a single gold bananacoin, a small stack with a coin
beside it, and the big stacks with a large coin beside them.

Draws each variant as a pixel grid, emits house-style rect-per-run SVGs (for
banana-stand.astro / later banana-rave.js floor drops) and renders a contact
sheet PNG for review. Run: python tools/build-coin-art.py
"""
import math
import os
from PIL import Image

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = os.path.join(SITE, 'tools', 'coin-contact.png')

# house gold (the thrown-banana / trophy family — deliberately NOT the banana
# body yellow #ffe135, so coins never read as jelly or banana flesh)
OUT = '#7a4a21'   # outline, dark bronze
FACE = '#ffd23f'  # coin face
SHADE = '#e6a817' # inner lip / shading
DEEP = '#b8781b'  # side-coin underside
HI = '#fff6c8'    # sparkle highlight


class Grid:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = {}

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[(x, y)] = c

    def blit(self, other, dx, dy):
        for (x, y), c in other.px.items():
            self.set(x + dx, y + dy, c)


# banana crescents (2px thick, bulging left, tips flaring right) hand-authored
# per coin size — offsets from the disc center
CRESCENTS = {
    17: [(1, -4), (2, -4), (3, -4), (0, -3), (1, -3), (-1, -2), (0, -2), (-2, -1), (-1, -1),
         (-2, 0), (-1, 0), (-2, 1), (-1, 1), (-1, 2), (0, 2), (0, 3), (1, 3), (1, 4), (2, 4), (3, 4)],
    13: [(1, -3), (2, -3), (0, -2), (1, -2), (-1, -1), (0, -1), (-1, 0), (0, 0),
         (-1, 1), (0, 1), (0, 2), (1, 2), (1, 3), (2, 3)],
    11: [(0, -2), (1, -2), (-1, -1), (0, -1), (-1, 0), (0, 0), (-1, 1), (0, 1), (0, 2), (1, 2)],
}


def disc_coin(D, emblem=True):
    """Upright coin: gold disc whose boundary cells become the outline (no
    compass-spike artifacts), inner lip, sparkle, banana crescent stamp."""
    g = Grid(D, D)
    c = (D - 1) / 2
    # smaller discs need a tighter radius or the corner cells survive the
    # distance test and the coin reads as a rounded square
    r = D / 2 - (0.85 if D <= 13 else 0.6)
    filled = set()
    for y in range(D):
        for x in range(D):
            if math.hypot(x - c, y - c) <= r:
                filled.add((x, y))
    for (x, y) in filled:
        edge = any((x + dx, y + dy) not in filled for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge:
            g.set(x, y, OUT)
        else:
            inner_edge = any(
                (x + dx, y + dy) not in filled for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2), (1, 1), (-1, -1), (1, -1), (-1, 1)))
            if inner_edge:
                g.set(x, y, HI if (x - c) + (y - c) < -r * 0.95 else SHADE)
            else:
                g.set(x, y, FACE)
    if emblem:
        cx, cy = round(c), round(c)
        for dx, dy in CRESCENTS[D]:
            if g.px.get((cx + dx, cy + dy)) == FACE:
                g.set(cx + dx, cy + dy, OUT)
    return g


def side_stack(n, w=11):
    """A stack of n coins seen from the side: each coin is a 2px slab (face +
    underside) with dark end caps; the whole pile sits on an outline base."""
    h = n * 2 + 1
    g = Grid(w, h)
    for i in range(n):
        y = h - 2 - i * 2  # bottom-up
        # slight jitter so the pile reads hand-stacked, not extruded
        off = (i % 3) - 1 if n >= 4 else 0
        x0, x1 = 1 + max(0, off), w - 2 + min(0, off)
        for x in range(x0, x1 + 1):
            g.set(x, y - 1, FACE)
            g.set(x, y, DEEP)
        g.set(x0 - 1, y - 1, OUT); g.set(x0 - 1, y, OUT)
        g.set(x1 + 1, y - 1, OUT); g.set(x1 + 1, y, OUT)
    # topmost coin catches the light
    top_y = h - 2 - (n - 1) * 2 - 1
    for x in range(2, 5):
        if (x, top_y) in g.px and g.px[(x, top_y)] == FACE:
            g.set(x, top_y, HI)
    return g


def compose(parts):
    """parts = [(grid, dx)] bottom-aligned on one canvas with 1px gaps."""
    w = sum(p.w for p, _ in parts) + sum(dx for _, dx in parts)
    h = max(p.h for p, _ in parts)
    g = Grid(w, h)
    x = 0
    for p, dx in parts:
        x += dx
        g.blit(p, x, h - p.h)
        x += p.w
    return g


# V1 — the bananacoin
v1 = disc_coin(13)

# V2 — a small stack + a coin leaning beside it
v2 = compose([(side_stack(3), 0), (disc_coin(11), 1)])

# V3 — the big pile: three stacks + the large bananacoin
v3 = compose([(side_stack(4), 0), (side_stack(6), 1), (side_stack(3), 1), (disc_coin(17), 2)])

VARIANTS = [('coin1', v1), ('coin2', v2), ('coin3', v3)]


def to_svg(g):
    """rect-per-run SVG at 1 unit/px, house crispEdges style."""
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


# contact sheet at 10x on the club's dark floor colour
K = 10
PAD = 20
sheet_w = sum(g.w for _, g in VARIANTS) * K + PAD * (len(VARIANTS) + 1)
sheet_h = max(g.h for _, g in VARIANTS) * K + PAD * 2
im = Image.new('RGBA', (sheet_w, sheet_h), (13, 11, 20, 255))
x = PAD
for name, g in VARIANTS:
    for (gx, gy), c in g.px.items():
        rgb = tuple(int(c[i:i + 2], 16) for i in (1, 3, 5))
        for yy in range(K):
            for xx in range(K):
                im.putpixel((x + gx * K + xx, PAD + (sheet_h - PAD * 2 - g.h * K) + gy * K + yy), rgb + (255,))
    x += g.w * K + PAD
im.save(SHEET)
print('sheet ->', SHEET)

out_js = os.path.join(SITE, 'src', 'data', 'coin-art.js')
lines = [
    '// GENERATED by tools/build-coin-art.py — do not hand-edit; rerun the tool.',
    '// The three bananacoin denominations (banana-stand-plan): coin1 = one',
    '// bananacoin, coin2 = a small stack + a coin, coin3 = the big pile.',
    'export const COIN_SVGS = {',
]
for name, g in VARIANTS:
    svg = to_svg(g)
    print(f'{name}: {g.w}x{g.h}, {len(svg)} chars')
    lines.append(f"  {name}: '{svg}',")
lines.append('};')
with open(out_js, 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(lines) + '\n')
print('wrote', out_js)
