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
        # ⚠️ TWO ROWS, NOT ONE. A single dark row is a 3px scratch at x3; a
        # gap plus the LIT TOP LIP of the board below is what makes two courses
        # read as two planks instead of one plank with a line on it.
        for x in range(BW):
            im.putpixel((x, top + BH - 1), rgb(SEAM))
            im.putpixel((x, top), rgb('#5f4e3a'))
    im.save(os.path.join(OUT, 'wall-board.png'))


def rail():
    """the batten across the top and bottom — what stops the field looking
    like wallpaper and starts it looking like carpentry"""
    # ⚠️ LIGHTER THAN THE FIELD, and it casts its OWN hard shadow. At 25%
    # lighter it read as one more plank; and a soft CSS blur under it was the
    # only smooth-edged object in a composition made entirely of pixels.
    H = 9
    im = Image.new('RGBA', (BW, H), (0, 0, 0, 0))
    rows = ['#7a6549', '#8a7455', '#7a6549', '#6b5942', '#5b4b38', '#483b2c', '#2f271d']
    for y in range(len(rows)):
        for x in range(BW):
            im.putpixel((x, y), rgb(rows[y]))
    for x in range(BW):                      # the shadow it throws on the field
        im.putpixel((x, 7), (0, 0, 0, 140))
        im.putpixel((x, 8), (0, 0, 0, 60))
    for start, run in [(9, 34), (58, 27)]:   # lit grain lines, wrapping
        for i in range(run):
            im.putpixel(((start + i) % BW, 2), rgb('#9c8666'))
    im.save(os.path.join(OUT, 'wall-rail.png'))


def screw():
    """8x8 with a real round head and a slot — at 6x6 the silhouette read as a
    pale blob rather than a fixing"""
    im = Image.new('RGBA', (8, 8), (0, 0, 0, 0))
    head = [(2, 0), (3, 0), (4, 0), (5, 0),
            (1, 1), (2, 1), (3, 1), (4, 1), (5, 1), (6, 1),
            (0, 2), (1, 2), (2, 2), (3, 2), (4, 2), (5, 2), (6, 2), (7, 2),
            (0, 3), (1, 3), (2, 3), (3, 3), (4, 3), (5, 3), (6, 3), (7, 3),
            (0, 4), (1, 4), (2, 4), (3, 4), (4, 4), (5, 4), (6, 4), (7, 4),
            (1, 5), (2, 5), (3, 5), (4, 5), (5, 5), (6, 5),
            (2, 6), (3, 6), (4, 6), (5, 6)]
    for x, y in head:
        im.putpixel((x, y), rgb(NAIL))
    for x, y in [(2, 0), (3, 0), (1, 1), (2, 1), (0, 2), (1, 2), (1, 3)]:
        im.putpixel((x, y), rgb('#c0ab8a'))          # lit from the top-left
    for x, y in [(5, 5), (4, 6), (5, 6), (6, 5), (7, 4), (6, 4)]:
        im.putpixel((x, y), rgb('#3a3126'))          # turning away from it
    for x in range(2, 6):                            # the slot
        im.putpixel((x, 3), rgb('#241d16'))
    im.putpixel((2, 4), rgb('#4a3f30'))
    im.putpixel((5, 4), rgb('#4a3f30'))
    for x, y in [(2, 7), (3, 7), (4, 7), (5, 7)]:    # its shadow on the wood
        im.putpixel((x, y), (0, 0, 0, 120))
    im.save(os.path.join(OUT, 'wall-screw.png'))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    board(); rail(); screw()
    print(f'  wall-board.png  {BW}x{BH * BOARDS}  ({BOARDS} boards, tiles both ways, grain wraps)')
    print(f'  wall-rail.png   {BW}x9   (batten + its own hard shadow)')
    print('  wall-screw.png  8x8')
    print('\ndrawn at x3 in the page')
