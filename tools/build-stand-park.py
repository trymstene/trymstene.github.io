# -*- coding: utf-8 -*-
"""The Banana Stand's PARK — outdoor scene art (banana-stand-plan, 21 Jul).

Generates the ground plate and the stand hut, house-pixel style:
  public/assets/banana-stand/park.png  (320x240 ground: grass, dirt path,
                                        pond with sand rim, trees, flowers)
  public/assets/banana-stand/hut.png   (88x80 stand: yellow walls, brown
                                        roof, banana on top, TRANSPARENT
                                        window the keeper stands behind)
Deterministic (seeded) so reruns are stable. A 3x contact sheet lands in
tools/park-contact.png for review. Run: python tools/build-stand-park.py
"""
import math
import os
import random
from PIL import Image

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SITE, 'public', 'assets', 'banana-stand')
os.makedirs(OUT, exist_ok=True)
rng = random.Random(1999)  # the year, obviously

W, H = 320, 240

# palette
GRASS = (88, 168, 60)
GRASS_D = (76, 148, 52)
GRASS_L = (100, 182, 72)
PATH = (185, 141, 79)
PATH_D = (138, 101, 54)
PATH_S = (163, 122, 66)
SAND = (227, 210, 149)
SAND_D = (179, 160, 106)
WATER = (63, 127, 209)
WATER_L = (95, 160, 232)
SPARK = (207, 232, 255)
CANOPY = (46, 139, 52)
CANOPY_D = (37, 110, 42)
CANOPY_L = (63, 168, 69)
TRUNK = (122, 82, 48)
TRUNK_D = (95, 61, 28)

im = Image.new('RGBA', (W, H))
px = im.load()

# ---- grass base with mowed-lawn noise --------------------------------------
for y in range(H):
    for x in range(W):
        r = rng.random()
        px[x, y] = GRASS_D if r < 0.10 else GRASS_L if r < 0.17 else GRASS

# ---- the dirt path: bottom entrance up to the stand ------------------------
def path_half_width(y):
    return 22 if y > 200 else 20 if y > 140 else 18

for y in range(58, H):
    cx = 160 + round(6 * math.sin(y / 46))
    hw = path_half_width(y)
    for x in range(cx - hw, cx + hw + 1):
        d = abs(x - cx)
        if d > hw - 1:
            px[x, y] = PATH_D
        else:
            r = rng.random()
            px[x, y] = PATH_S if r < 0.16 else PATH_D if r < 0.19 else PATH

# a widened dirt apron where the stand sits (it's a shop, feet wear the lawn)
for y in range(58, 92):
    for x in range(112, 209):
        if abs(x - 160) < 46 - (58 - min(y, 58)) and rng.random() > 0.06:
            d_edge = min(abs(x - 114), abs(x - 206), abs(y - 60))
            px[x, y] = PATH_D if d_edge < 2 else (PATH_S if rng.random() < 0.15 else PATH)

# ---- the pond (right side) with a sand rim + sparkles ----------------------
PCX, PCY, PRX, PRY = 262, 178, 42, 27
for y in range(H):
    for x in range(W):
        d = math.hypot((x - PCX) / PRX, (y - PCY) / PRY)
        if d <= 1.0:
            px[x, y] = WATER
        elif d <= 1.10:
            px[x, y] = SAND_D if d > 1.07 else SAND
# lighter shallows on the top-left of the pond + sparkle dashes
for y in range(H):
    for x in range(W):
        d = math.hypot((x - PCX) / PRX, (y - PCY) / PRY)
        if d <= 1.0 and (x - PCX) + (y - PCY) < -20:
            px[x, y] = WATER_L
for sx, sy, ln in [(244, 170, 4), (270, 184, 3), (256, 192, 4), (278, 172, 2), (238, 186, 3)]:
    for i in range(ln):
        px[sx + i, sy] = SPARK

# ---- trees (canopy blob + trunk), parked at the edges ----------------------
def tree(cx, cy, r):
    # trunk first so the canopy overlaps it
    for y in range(cy + r - 4, cy + r + 7):
        for x in range(cx - 2, cx + 3):
            if 0 <= x < W and 0 <= y < H:
                px[x, y] = TRUNK_D if abs(x - cx) == 2 else TRUNK
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if not (0 <= x < W and 0 <= y < H):
                continue
            d = math.hypot(x - cx, (y - cy) * 1.15)
            if d <= r:
                wob = rng.random() < 0.12
                if d > r - 1.5:
                    px[x, y] = CANOPY_D
                elif (x - cx) + (y - cy) < -r * 0.6 and not wob:
                    px[x, y] = CANOPY_L
                else:
                    px[x, y] = CANOPY_D if wob else CANOPY

tree(34, 42, 19)
tree(287, 44, 17)
tree(20, 148, 15)
tree(300, 122, 13)
tree(52, 224, 16)

# ---- bushes + flowers ------------------------------------------------------
def bush(cx, cy, r):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if 0 <= x < W and 0 <= y < H and math.hypot(x - cx, (y - cy) * 1.4) <= r:
                px[x, y] = CANOPY_D if math.hypot(x - cx, (y - cy) * 1.4) > r - 1.4 else CANOPY

bush(102, 62, 7)
bush(224, 66, 6)
bush(305, 214, 8)
bush(14, 84, 6)

FLOWERS = [(255, 255, 255), (255, 225, 53), (255, 154, 187)]
for _ in range(46):
    x, y = rng.randrange(4, W - 4), rng.randrange(96, H - 6)
    on_grass = px[x, y][:3] in (GRASS, GRASS_D, GRASS_L)
    if on_grass:
        px[x, y] = FLOWERS[rng.randrange(3)]

im.save(os.path.join(OUT, 'park.png'), optimize=True)
print('wrote park.png')

# ============================================================================
# the HUT — a real banana stand: yellow walls, brown roof, banana on top,
# transparent WINDOW (the keeper's canvas sits behind it in the DOM)
HW, HH = 88, 80
hut = Image.new('RGBA', (HW, HH), (0, 0, 0, 0))
hp = hut.load()

ROOF = (138, 90, 43)
ROOF_D = (95, 61, 28)
ROOF_L = (166, 113, 58)
WALL = (255, 225, 53)
WALL_D = (230, 197, 46)
FRAME = (122, 74, 33)
SILL = (169, 120, 67)
NANA = (255, 210, 63)
NANA_D = (230, 168, 23)
STEM = (122, 74, 33)

# roof: a peaked cap, rows widening from the apex
for y in range(6, 26):
    half = round((y - 4) * 2.35)
    for x in range(HW // 2 - half, HW // 2 + half):
        if 0 <= x < HW:
            edge = x in (HW // 2 - half, HW // 2 + half - 1) or y in (6, 25)
            hp[x, y] = ROOF_D if edge else (ROOF_L if y < 12 else ROOF)
# the banana lying on the roof ridge
for i, (dx, dy) in enumerate([(-8, 2), (-7, 1), (-6, 0), (-5, 0), (-4, -1), (-3, -1), (-2, -1), (-1, -1), (0, -1), (1, -1), (2, 0), (3, 0), (4, 1), (5, 2)]):
    x, y = HW // 2 + dx, 4 + dy
    hp[x, y] = NANA
    hp[x, y + 1] = NANA_D
hp[HW // 2 + 6, 6] = STEM
hp[HW // 2 - 9, 5] = STEM

# walls
for y in range(26, 74):
    for x in range(6, HW - 6):
        edge = x in (6, HW - 7) or y == 73
        plank = (x - 6) % 10 == 9
        hp[x, y] = FRAME if edge else (WALL_D if plank else WALL)
# window hole (transparent) + frame
WX0, WX1, WY0, WY1 = 22, 66, 32, 56
for y in range(WY0 - 2, WY1 + 2):
    for x in range(WX0 - 2, WX1 + 2):
        if WX0 <= x < WX1 and WY0 <= y < WY1:
            hp[x, y] = (0, 0, 0, 0)
        else:
            hp[x, y] = FRAME
# counter sill under the window
for y in range(WY1 + 2, WY1 + 9):
    for x in range(WX0 - 4, WX1 + 4):
        hp[x, y] = FRAME if y == WY1 + 8 or x in (WX0 - 4, WX1 + 3) else (SILL if y == WY1 + 2 else ROOF)
# base shadow strip
for x in range(6, HW - 6):
    hp[x, 74] = ROOF_D
    hp[x, 75] = ROOF_D

hut.save(os.path.join(OUT, 'hut.png'), optimize=True)
print('wrote hut.png')

# ---- contact sheet: park at 2x with the hut composed where it lives --------
K = 2
sheet = im.resize((W * K, H * K), Image.NEAREST).convert('RGBA')
hs = hut.resize((HW * K, HH * K), Image.NEAREST)
sheet.paste(hs, (round(W * K / 2 - HW * K / 2), 4), hs)
sheet.save(os.path.join(SITE, 'tools', 'park-contact.png'))
print('wrote tools/park-contact.png')
