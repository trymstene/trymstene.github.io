#!/usr/bin/env python3
"""🎖 THE SUPPORTER PLAQUES — drawn, not CSS'd.

A gradient with a border reads as a 1998 web button, which is what the first
cut of the park's supporters board looked like. These are pixel art: four
different OBJECTS, not four colours of the same rectangle.

    coffee  a torn paper note, taped down          (a one-off coffee)
    blue    a painted wooden plank, nailed on      (Friend of the Banana)
    silver  a riveted metal plate, corners clipped (Patron of the Park)
    gold    an engraved brass plate with flourishes(Legend of Banana World)

Each is emitted as THREE files — left cap, a one-tile middle, right cap — so a
name of any length keeps its drawn ends and only the plain middle stretches.
The middle is bands only, so it tiles seamlessly.

    python tools/build-supporter-plaques.py

Writes public/assets/supporters/plaq-<tier>-{l,m,r}.png at art scale (15px
tall); the page draws them at x2 with image-rendering: pixelated.
"""
import os
from PIL import Image

H = 15            # art rows
CAP = 12          # drawn end, art columns
MID = 4           # the tiling middle
REPS = 6          # mid tiles used while building the full plaque
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'supporters')

# ── the four objects ─────────────────────────────────────────────────────────
# bands: one colour per row, top to bottom — the whole body of the thing
# cut: how many pixels the silhouette pulls IN from the left on each row; the
#      right cap is its mirror. This is what stops them being rectangles.
# a real pixel radius, not a chamfer — the SAME curve on all three metals, so
# they read as a matching set of made objects
ROUND = [4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 4]
# torn wood: the ends are splintered, and no two rows break in the same place
TORN = [3, 3, 1, 1, 0, 0, 2, 2, 4, 4, 0, 0, 1, 3, 3]

TIERS = {
    'coffee': {
        'bands': ['#e0d6c2', '#d9cfb9', '#d2c8b0', '#cbc1a7', '#c5ba9f', '#beb396',
                  '#b8ac8e', '#b1a586', '#aa9e7e', '#a49775', '#9d906d', '#968965',
                  '#8c8059', '#7b7049', '#625939'],
        'cut': TORN,
        'line': '#46402a',
    },
    'blue': {
        'bands': ['#8fb4ff', '#6f9bf0', '#5786e6', '#4a79e0', '#4676dc', '#3f6fd8',
                  '#3f6fd8', '#3a68cf', '#3a68cf', '#3560c2', '#3059b5', '#2c53ab',
                  '#26489a', '#1e3d80', '#14264f'],
        'cut': ROUND,
        'line': '#0e1c3c',
    },
    'silver': {
        'bands': ['#ffffff', '#eef4fb', '#e2eaf4', '#d3dde9', '#c9d4e2', '#c1cddb',
                  '#b9c6d6', '#b9c6d6', '#adbbcc', '#a3b2c4', '#9aa9bc', '#94a2b3',
                  '#8391a3', '#6d7a8a', '#444e5c'],
        'cut': ROUND,
        'line': '#333b47',
    },
    'gold': {
        'bands': ['#ffefb4', '#ffdd7a', '#f8ce5c', '#f2c243', '#eeba34', '#e9b228',
                  '#e5ab1c', '#e5ab1c', '#dda216', '#d29711', '#c78f0e', '#bd8a0c',
                  '#a97806', '#8f6608', '#55380a'],
        'cut': ROUND,
        'line': '#402906',
    },
}
rgb = lambda h: (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)
CLEAR = (0, 0, 0, 0)


def build(tier, spec):
    W = CAP + MID * REPS + CAP
    im = Image.new('RGBA', (W, H), CLEAR)
    bands = [rgb(c) for c in spec['bands']]
    cut = spec['cut']

    # the body, pulled in by `cut` at both ends
    for y in range(H):
        for x in range(cut[y], W - cut[y]):
            im.putpixel((x, y), bands[y])

    # ── what makes each one a THING and not a swatch ──
    if tier == 'blue':
        for cx in (5, W - 7):                       # two nail heads, LIT on top
            im.putpixel((cx, 4), rgb('#cfe0ff'))
            im.putpixel((cx + 1, 4), rgb('#8fb4ff'))
            im.putpixel((cx, 5), rgb('#6f9bf0'))
            im.putpixel((cx + 1, 5), rgb('#2b4d8f'))
            im.putpixel((cx, 6), rgb('#14264f'))
            im.putpixel((cx + 1, 6), rgb('#14264f'))
        for y in (7, 11):                           # grain, on the mid's own period
            for x in range(cut[y] + 2, W - cut[y] - 2, 4):
                im.putpixel((x, y), rgb('#3560c2'))
    if tier == 'silver':
        for cx in (5, W - 7):                       # rivets
            im.putpixel((cx, 6), rgb('#7f8c9d'))
            im.putpixel((cx + 1, 6), rgb('#7f8c9d'))
            im.putpixel((cx, 7), rgb('#7f8c9d'))
            im.putpixel((cx + 1, 7), rgb('#9fadbe'))
            im.putpixel((cx, 5), rgb('#ffffff'))
        for y in range(3, 12):                      # brushed streaks, broken, not a seam
            if y % 3 == 0:
                continue
            im.putpixel((8, y), rgb('#eaf1fa') if y < 8 else rgb('#a9b7c8'))
            im.putpixel((W - 9, y), rgb('#eaf1fa') if y < 8 else rgb('#a9b7c8'))
    if tier == 'gold':
        for y in (2, H - 3):                        # an engraved line, all the way round
            for x in range(4, W - 4):
                im.putpixel((x, y), rgb('#a97806') if y == 2 else rgb('#ffe08a'))
        for x in (4, W - 5):
            for y in range(2, H - 2):
                im.putpixel((x, y), rgb('#c08606'))
        for cx in (7, W - 8):                       # a pip at each end
            im.putpixel((cx, 7), rgb('#fff3c0'))
            im.putpixel((cx, 6), rgb('#ffe08a'))
            im.putpixel((cx, 8), rgb('#b98305'))
    if tier == 'coffee':
        for y in (4, 8, 11):                        # wood grain, on the mid's 4px period
            for x in range(2, W - 2, 4):
                if cut[y] <= x < W - cut[y]:
                    im.putpixel((x, y), rgb('#a1996f'))
                    if x + 1 < W - cut[y]:
                        im.putpixel((x + 1, y), rgb('#a1996f'))
        for y in (2, 9):                            # knots and splits
            for x in range(cut[y] + 3, W - cut[y] - 3, 8):
                im.putpixel((x, y), rgb('#8d855f'))

    # ── the 1px outline that makes it pixel art rather than a shape ──
    line = rgb(spec['line'])
    px = im.load()
    edge = []
    for y in range(H):
        for x in range(W):
            if px[x, y][3] == 0:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < W and 0 <= ny < H) or px[nx, ny][3] == 0:
                    edge.append((x, y))
                    break
    for x, y in edge:
        im.putpixel((x, y), line)

    # ⚠️ slice AFTER outlining, then heal the seams: the cut faces between the
    # caps and the middle are interior, and an outline there would draw a bar
    # down the plaque every time the name got longer.
    mid_x = CAP + MID * (REPS // 2)
    parts = {
        'l': im.crop((0, 0, CAP, H)),
        'm': im.crop((mid_x, 0, mid_x + MID, H)),
        'r': im.crop((W - CAP, 0, W, H)),
    }
    os.makedirs(OUT, exist_ok=True)
    for k, img in parts.items():
        img.save(os.path.join(OUT, f'plaq-{tier}-{k}.png'))
    return parts


if __name__ == '__main__':
    for tier, spec in TIERS.items():
        build(tier, spec)
        print(f'  {tier:7s} -> plaq-{tier}-l/m/r.png')
    print(f'\nart {CAP}+{MID}+{CAP} x {H}, drawn at x2 in the page')
