# -*- coding: utf-8 -*-
"""Build the hook-a-duck sprite for Banana Bay's pier midway.

ISOLATED from build-beach-scene.py on purpose: regenerating the duck must never
risk re-baking the whole beach plate (which needs the LimeZu pack present).
A single plump frame — the float/bob/tilt motion is CSS now, not a sprite strip.

Run: python tools/build-duck.py
"""
import os
import sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from blockify import blockify  # noqa: E402

SITE = os.path.dirname(HERE)
OUT = os.path.join(SITE, 'public', 'assets', 'beach', 'duck.png')

K = 4
W, H = 34, 30
BODY = (252, 208, 66)
LIT = (255, 236, 150)
SHD = (214, 158, 40)
BOTTOM = (198, 140, 32)
BEAK = (245, 146, 44)
BEAKD = (214, 110, 30)
EYE = (34, 26, 24)
WHITE = (255, 255, 255)
CHEEK = (255, 158, 122)
WING = (236, 186, 54)

s = Image.new('RGBA', (W * K, H * K), (0, 0, 0, 0))
d = ImageDraw.Draw(s)


def e(x0, y0, x1, y1, fill):
    d.ellipse([x0 * K, y0 * K, x1 * K, y1 * K], fill=fill)


def poly(pts, fill):
    d.polygon([(x * K, y * K) for x, y in pts], fill=fill)


# tail — a cheeky upturn at the back
poly([(4, 15), (0, 10), (7, 19)], BODY)
# body — plump, rounded
e(3, 13, 28, 28, BODY)
e(5, 13, 19, 21, LIT)          # belly highlight, upper-left light
e(4, 23, 28, 28, BOTTOM)       # self-shadow underside
# wing — a soft fold on the near side
e(10, 16, 22, 23, WING)
d.line([(11 * K, 20 * K), (21 * K, 21 * K)], fill=SHD, width=max(1, K // 2))
# head
e(16, 3, 31, 18, BODY)
e(17, 3, 27, 11, LIT)
e(19, 4, 22, 7, WHITE)         # glossy glint
e(20, 12, 24, 15, CHEEK)       # blush
# beak — upper + lower bill
poly([(29, 9), (34, 11), (29, 13)], BEAK)
poly([(29, 12), (32, 13), (29, 14)], BEAKD)
# eye + catchlight
e(23, 7, 26, 11, EYE)
e(23, 7, 24, 8, WHITE)

duck = blockify(s, factor=K, colors=10, alpha_thresh=0.42, sat=1.12, con=1.06, trim=False)
duck.save(OUT, optimize=True)
print('wrote', os.path.relpath(OUT, SITE), duck.size)
