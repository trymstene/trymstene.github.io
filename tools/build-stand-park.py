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

# v2 (Trym, 21 Jul): the park grew TALLER (club-sized) and the path became a
# CROSSROAD — up = the stand, bottom edge = the road back to the rave,
# left + right arms = not built yet (small DOM signs stand at their ends)
W, H = 320, 420
CROSS_Y = 300  # the horizontal road's centerline (passes UNDER the pond)

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

# ---- the dirt CROSSROAD ----------------------------------------------------
# vertical spine: the rave entrance at the bottom edge up to the stand
def path_half_width(y):
    return 22 if y > H - 40 else 20 if y > 140 else 18

def dirt(x, y):
    if not (0 <= x < W and 0 <= y < H):
        return
    r = rng.random()
    px[x, y] = PATH_S if r < 0.16 else PATH_D if r < 0.19 else PATH

for y in range(58, H):
    cx = 160 + round(6 * math.sin(y / 46))
    hw = path_half_width(y)
    for x in range(cx - hw, cx + hw + 1):
        if abs(x - cx) > hw - 1:
            px[x, y] = PATH_D
        else:
            dirt(x, y)

# the horizontal arms: left + right to the map edges (not built yet — the
# little signs at each end say so), passing UNDER the pond on the right
for x in range(0, W):
    cy = CROSS_Y + round(4 * math.sin(x / 40))
    for y in range(cy - 14, cy + 15):
        if abs(y - cy) > 13:
            if 0 <= x < W and 0 <= y < H and px[x, y][:3] not in (PATH, PATH_S, PATH_D):
                px[x, y] = PATH_D
        else:
            dirt(x, y)

# a widened dirt apron where the stand sits (it's a shop, feet wear the lawn)
for y in range(58, 92):
    for x in range(112, 209):
        if abs(x - 160) < 46 - (58 - min(y, 58)) and rng.random() > 0.06:
            d_edge = min(abs(x - 114), abs(x - 206), abs(y - 60))
            px[x, y] = PATH_D if d_edge < 2 else (PATH_S if rng.random() < 0.15 else PATH)

# ---- the pond (right side) with a sand rim + sparkles ----------------------
PCX, PCY, PRX, PRY = 258, 205, 42, 27  # above the right road arm
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
for sx, sy, ln in [(240, 197, 4), (266, 211, 3), (252, 219, 4), (274, 199, 2), (234, 213, 3)]:
    for i in range(ln):
        px[sx + i, sy] = SPARK

# ---- terrain variation: meadow patches + dry spots (before the trees) ------
MEADOW = (72, 138, 50)
DRY = (142, 168, 84)
def patch(cx, cy, rx, ry, col, density=0.85):
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            if not (0 <= x < W and 0 <= y < H):
                continue
            if px[x, y][:3] not in (GRASS, GRASS_D, GRASS_L):
                continue  # never paint over path/pond/anything built
            d = math.hypot((x - cx) / rx, (y - cy) / ry)
            if d <= 1.0 and rng.random() < density * (1.15 - d):
                px[x, y] = col

patch(80, 110, 34, 20, MEADOW)
patch(238, 118, 26, 15, MEADOW)
patch(110, 240, 30, 16, MEADOW)
patch(70, 350, 32, 18, MEADOW)
patch(240, 370, 26, 14, MEADOW)
patch(210, 258, 20, 11, DRY, 0.5)
patch(36, 190, 18, 10, DRY, 0.45)
patch(290, 330, 16, 9, DRY, 0.45)

# ---- trees in three styles: oak (round), pine (stacked), sapling -----------
def trunk(cx, y0, y1, w=2):
    for y in range(y0, y1):
        for x in range(cx - w, cx + w + 1):
            if 0 <= x < W and 0 <= y < H:
                px[x, y] = TRUNK_D if abs(x - cx) == w else TRUNK

def oak(cx, cy, r):
    trunk(cx, cy + r - 4, cy + r + 7)
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

PINE = (45, 110, 51)
PINE_D = (33, 84, 39)
PINE_L = (62, 134, 66)
def pine(cx, cy, h):
    trunk(cx, cy + h // 2, cy + h // 2 + 6, 1)
    tiers = 3
    for t in range(tiers):
        ty = cy - h // 2 + t * (h // tiers)
        half = 4 + t * 3
        for y in range(ty, ty + h // tiers + 2):
            row_half = round(half * (y - ty + 2) / (h / tiers + 2))
            for x in range(cx - row_half, cx + row_half + 1):
                if 0 <= x < W and 0 <= y < H:
                    edge = abs(x - cx) >= row_half - 1
                    px[x, y] = PINE_D if edge else (PINE_L if x < cx - row_half // 2 else PINE)

def sapling(cx, cy):
    trunk(cx, cy + 3, cy + 8, 1)
    for y in range(cy - 5, cy + 4):
        for x in range(cx - 5, cx + 6):
            if 0 <= x < W and 0 <= y < H and math.hypot(x - cx, (y - cy) * 1.2) <= 5:
                d = math.hypot(x - cx, (y - cy) * 1.2)
                px[x, y] = CANOPY_D if d > 3.8 else CANOPY

oak(34, 42, 19)
pine(287, 46, 26)
oak(20, 148, 15)
pine(304, 122, 22)
oak(52, 244, 16)
sapling(226, 154)
sapling(96, 176)
# the new lower half: the woods thicken toward the rave road
oak(30, 352, 18)
pine(296, 368, 26)
oak(288, 262, 14)
sapling(112, 330)
sapling(212, 396)
pine(70, 398, 22)

# ---- the picnic: checkered blanket, basket, two bananas hanging out --------
BLANK_R = (232, 69, 69)
BLANK_W = (255, 253, 245)
BX, BY, BW2, BH2 = 62, 150, 30, 20
for y in range(BY, BY + BH2):
    for x in range(BX, BX + BW2):
        check = ((x - BX) // 4 + (y - BY) // 4) % 2
        edge = x in (BX, BX + BW2 - 1) or y in (BY, BY + BH2 - 1)
        px[x, y] = (170, 48, 48, 255) if edge else ((BLANK_R if check else BLANK_W))
# basket
for y in range(BY + 5, BY + 11):
    for x in range(BX + 12, BX + 19):
        edge = x in (BX + 12, BX + 18) or y in (BY + 5, BY + 10)
        px[x, y] = (95, 61, 28, 255) if edge else (138, 90, 43, 255)
px[BX + 14, BY + 4] = (95, 61, 28, 255)
px[BX + 16, BY + 4] = (95, 61, 28, 255)

def mini_banana(cx, cy, flip=False):
    """a wee banana sitting on the grass — crescent, eye, smile"""
    BODY = (255, 225, 53)
    BODY_D = (230, 168, 23)
    INK = (17, 17, 17)
    pts = [(0, -5), (1, -4), (2, -3), (2, -2), (2, -1), (2, 0), (1, 1), (0, 2), (-1, 2), (-2, 2)]
    for dx, dy in pts:
        fx = -dx if flip else dx
        if 0 <= cx + fx < W and 0 <= cy + dy < H:
            px[cx + fx, cy + dy] = BODY
            if 0 <= cx + fx < W and 0 <= cy + dy + 1 < H and dy == 2:
                px[cx + fx, cy + dy + 1] = BODY_D
    sx = -1 if flip else 1
    px[cx + sx * 0, cy - 6] = (122, 74, 33, 255)          # stem
    px[cx + sx * 1, cy - 3] = INK                          # eye
    px[cx + sx * 1, cy - 1] = (232, 59, 59, 255)           # a happy mouth px

mini_banana(BX - 6, BY + 9)
mini_banana(BX + BW2 + 5, BY + 11, flip=True)

# (ducks are DOM sprites in the page — they drift back and forth in the pond)

# ---- bushes + flowers ------------------------------------------------------
def bush(cx, cy, r):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r, cx + r + 1):
            if 0 <= x < W and 0 <= y < H and math.hypot(x - cx, (y - cy) * 1.4) <= r:
                px[x, y] = CANOPY_D if math.hypot(x - cx, (y - cy) * 1.4) > r - 1.4 else CANOPY

bush(102, 62, 7)
bush(224, 66, 6)
bush(306, 240, 7)
bush(14, 84, 6)
bush(58, 274, 6)   # just above the left arm
bush(250, 332, 7)
bush(120, 404, 6)

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
HW, HH = 88, 86  # taller from the bottom — extra wall below the counter
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


def crescent_px(w, sag, thick):
    """A TRUE banana crescent (tips up): the circle through both tips and the
    belly bottom, minus the same circle shifted up — fat-bellied, taper-
    tipped by construction. NEVER freehand a banana (the worm era is over)."""
    R = ((w / 2) ** 2 + sag ** 2) / (2 * sag)
    cy_out, cy_in = sag - R, sag - R - thick
    pts = []
    for y in range(0, sag + thick + 1):
        for x in range(-w // 2 - 1, w // 2 + 2):
            if math.hypot(x, y - cy_out) <= R and math.hypot(x, y - cy_in) > R:
                pts.append((x, y))
    return pts

# the banana lying on the roof ridge — proper crescent, resting tips-up
RIDGE = crescent_px(20, 6, 4)
ridge_max_y = max(p[1] for p in RIDGE)
for dx, dy in RIDGE:
    x, y = HW // 2 + dx, dy
    if 0 <= x < HW and 0 <= y < HH:
        hp[x, y] = NANA_D if dy >= ridge_max_y - 1 else NANA
hp[HW // 2 + 11, 1] = STEM
hp[HW // 2 + 10, 2] = STEM

# walls — SOLID all the way to the sprite's bottom row (a transparent gap at
# the base let the keeper's feet peek through the building; Trym's catch)
for y in range(26, HH):
    for x in range(6, HW - 6):
        edge = x in (6, HW - 7) or y == HH - 1
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
    hp[x, HH - 3] = ROOF_D
    hp[x, HH - 2] = ROOF_D

# (the readable "BANANA STAND" sign is a DOM board on the page — pixel text
# at this sprite scale is impossible, and freehand banana glyphs are banned)

hut.save(os.path.join(OUT, 'hut.png'), optimize=True)
print('wrote hut.png')

# ---- contact sheet: park at 2x with the hut composed where it lives --------
K = 2
sheet = im.resize((W * K, H * K), Image.NEAREST).convert('RGBA')
hs = hut.resize((HW * K, HH * K), Image.NEAREST)
sheet.paste(hs, (round(W * K / 2 - HW * K / 2), 4), hs)
sheet.save(os.path.join(SITE, 'tools', 'park-contact.png'))
print('wrote tools/park-contact.png')
