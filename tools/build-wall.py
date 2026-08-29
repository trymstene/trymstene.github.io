#!/usr/bin/env python3
"""🪵 THE SUPPORTERS WALL — the boards you hang a plaque on.

The wall was a list of plaques on a flat page. A wall has to look like a wall:
horizontal boards with grain, a seam between each one, and screws holding it
to whatever is behind it. Then a plaque on it reads as MOUNTED rather than as
a row in a table.

Pieces, all tileable, all drawn at art scale and displayed at x3:

    wall-board.png   the field. THREE differently-grained boards stacked,
                     96x48, repeats both ways. Every grain mark wraps, so no
                     seam appears where copies meet.
    wall-rail.png    a horizontal batten for the top and bottom edges, 7px,
                     repeats sideways. Turns the field into a built thing.
    wall-screw.png   6x6, dropped into the corners by CSS.

⚠️ THE TILE MUST WRAP. Any grain mark that runs off the right edge has to come
back on the left at the same row, or the wall grows a visible vertical stripe
every N pixels — which is exactly what makes cheap wallpaper look like cheap
wallpaper.

    python tools/build-wall.py
"""
import os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'supporters')
# ⚠️ THE PERIOD HAS TO BE LONG ENOUGH TO STOP READING AS A PERIOD. The first
# cut was one 48x16 board with a knot in it, and the knot marched across the
# wall in a perfect grid every 48px — the eye finds that instantly. Three
# DIFFERENT boards stacked, 96 wide, means the pattern only repeats every
# 288x144 on screen, and no two adjacent boards share a grain.
BW, BH = 96, 16          # one board: 96 wide (the wrap period), 16 tall
BOARDS = 3               # stacked into one tile, each grained differently
rgb = lambda h: (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)

# a dark, warm timber that sits ON the page's #14181d without lighting it up —
# the plaques are the bright things, the wall is what holds them
FACE = ['#3b3025', '#453828', '#413428', '#3e3226', '#463a2a', '#423527',
        '#3f3327', '#453829', '#413528', '#3d3126', '#443729', '#403428',
        '#3c3025', '#382d23', '#2f261e', '#241d17']
GRAIN_D = '#342a20'      # a darker streak in the timber
GRAIN_L = '#4d3f2e'      # a lighter one
SEAM = '#1d1712'         # the gap between two boards
NAIL = '#8a7659'      # must read AGAINST the timber, not blend into it


def board():
    im = Image.new('RGBA', (BW, BH * BOARDS), (0, 0, 0, 0))
    # each board is grained on its own — (row, start, run, colour)
    GRAIN = [
        [(2, 7, 41, GRAIN_D), (4, 58, 30, GRAIN_L), (6, 21, 52, GRAIN_D),
         (9, 3, 27, GRAIN_L), (11, 66, 38, GRAIN_D), (13, 34, 22, GRAIN_D)],
        [(1, 45, 36, GRAIN_L), (3, 12, 49, GRAIN_D), (7, 70, 33, GRAIN_D),
         (8, 25, 20, GRAIN_L), (10, 51, 41, GRAIN_D), (12, 5, 29, GRAIN_D)],
        [(2, 62, 24, GRAIN_D), (5, 30, 45, GRAIN_L), (6, 84, 26, GRAIN_D),
         (9, 40, 34, GRAIN_D), (11, 9, 47, GRAIN_L), (13, 55, 31, GRAIN_D)],
    ]
    for b in range(BOARDS):
        top = b * BH
        for y in range(BH):
            for x in range(BW):
                im.putpixel((x, top + y), rgb(FACE[y]))
        for y, start, run, col in GRAIN[b]:
            for i in range(run):
                im.putpixel(((start + i) % BW, top + y), rgb(col))
        # the seam under this board, with the next board's lit edge above it
        for x in range(BW):
            im.putpixel((x, top + BH - 1), rgb(SEAM))
    im.save(os.path.join(OUT, 'wall-board.png'))


def rail():
    """the batten across the top and bottom — what stops the field looking
    like wallpaper and starts it looking like carpentry"""
    H = 7
    im = Image.new('RGBA', (BW, H), (0, 0, 0, 0))
    rows = ['#5a4a36', '#6b5942', '#5f4e3a', '#544534', '#4a3d2e', '#3e3327', '#2a221a']
    for y in range(H):
        for x in range(BW):
            im.putpixel((x, y), rgb(rows[y]))
    for start, run in [(9, 34), (58, 27)]:   # lit grain lines, wrapping
        for i in range(run):
            im.putpixel(((start + i) % BW, 2), rgb('#7a6650'))
    im.save(os.path.join(OUT, 'wall-rail.png'))


def screw():
    im = Image.new('RGBA', (6, 6), (0, 0, 0, 0))
    body = [(1, 1), (2, 1), (3, 1), (4, 1),
            (1, 2), (2, 2), (3, 2), (4, 2),
            (1, 3), (2, 3), (3, 3), (4, 3),
            (2, 0), (3, 0), (2, 4), (3, 4),
            (0, 2), (5, 2)]
    for x, y in body:
        im.putpixel((x, y), rgb(NAIL))
    for x, y in [(2, 0), (2, 1), (1, 1), (1, 2)]:   # lit on the top-left
        im.putpixel((x, y), rgb('#c0ab8a'))
    for x, y in [(3, 3), (3, 4), (4, 3), (4, 2)]:   # shadowed underneath
        im.putpixel((x, y), rgb('#2f281f'))
    for x, y in [(2, 2), (3, 2)]:            # the slot
        im.putpixel((x, y), rgb('#2b241b'))
    im.save(os.path.join(OUT, 'wall-screw.png'))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    board(); rail(); screw()
    print(f'  wall-board.png  {BW}x{BH * BOARDS}  ({BOARDS} boards, tiles both ways, grain wraps)')
    print('  wall-rail.png   48x7   (top and bottom batten)')
    print('  wall-screw.png  6x6')
    print('\ndrawn at x3 in the page')
