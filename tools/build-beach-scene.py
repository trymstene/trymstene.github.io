# -*- coding: utf-8 -*-
"""🏖 BANANA BAY — the beach scene art (banana-beach-plan).

B1.5 "THE LOOKS PASS": everything is drawn in OUR chunky style, but the
CONSTRUCTION is lifted from studying LimeZu's Modern Exteriors beach set
(reference only — no pack pixels ship, see the art strategy in the plan):
  · a contact SHADOW under every object, so things sit in the sand
  · light comes from the UPPER LEFT — top-left edges light, lower-right dark
  · three shade steps per object, not two
  · palms/umbrellas/grass built from RADIATING BLADES, not blobs
Outputs:
  public/assets/beach/beach.png      1400x620 world plate
  public/assets/beach/sea-lines.png  160x196 tileable wave overlay (drifts)
  public/assets/beach/foam.png       160x18 tileable shoreline foam (4 frames)
  public/assets/beach/ball.png       16x16 volleyball
  public/assets/beach/crab.png       14x9 scuttler (faces right)
  public/assets/beach/gull.png       26x9 seagull, 2 wing frames
  public/assets/beach/shells.png     29-frame collection strip (16x16 each)
⚠️ GAMEPLAY GEOMETRY IS A CONTRACT with src/scripts/banana-beach.js — the net
(x582), court (400-764 / 404-584), bar hull (862+), pier (1160-1226),
lighthouse headland (1306,366) and waterline (266/290) must not move here
without moving there.
Run: python tools/build-beach-scene.py
"""
import math
import os
import random
from PIL import Image

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SITE, 'public', 'assets', 'beach')
os.makedirs(OUT, exist_ok=True)
rng = random.Random(1999)

W, H = 1400, 620
SEA_TOP, SEA_BOT = 100, 262
WET_BOT = 290
im = Image.new('RGBA', (W, H))
px = im.load()

# ---- palette: three steps per material, golden-hour warm -------------------
SKY = [(92, 42, 82), (163, 59, 52), (217, 106, 47), (240, 168, 60)]
SUN, SUN_L = (255, 216, 61), (255, 240, 160)
SEA_DEEP, SEA_MID, SEA_LIGHT = (31, 111, 143), (43, 135, 168), (63, 160, 189)
SPARK = (232, 246, 250)
WET, WET_D = (217, 185, 138), (198, 166, 120)
SAND, SAND_D, SAND_L = (236, 217, 168), (216, 190, 134), (246, 231, 190)
SHADE = (206, 180, 126)        # the contact-shadow tone on sand
SHADE_2 = (192, 165, 112)
DUNE, DUNE_L = (228, 206, 152), (247, 233, 191)
WOOD, WOOD_D, WOOD_L = (160, 106, 51), (120, 74, 32), (188, 132, 70)
FRAME, POST = (74, 44, 18), (95, 61, 28)
ROOF, ROOF_D = (208, 73, 27), (154, 50, 16)
WALL = (179, 118, 47)
RED, RED_D = (216, 60, 56), (168, 38, 36)
WHITE, WHITE_D = (255, 253, 245), (222, 216, 198)
TEAL = (63, 160, 189)
LEAF, LEAF_L, LEAF_D = (46, 139, 52), (80, 186, 82), (28, 96, 38)
TRUNK, TRUNK_L, TRUNK_D = (132, 90, 50), (166, 120, 70), (96, 62, 30)
STONE, STONE_L, STONE_D = (128, 126, 116), (166, 164, 152), (92, 90, 82)
INK = (17, 17, 17)
NET_C = (238, 234, 220)


def rect(x0, y0, x1, y1, col, p=None, w=W, h=H):
    p = p or px
    for y in range(y0, y1):
        for x in range(x0, x1):
            if 0 <= x < w and 0 <= y < h:
                p[x, y] = col


def put(x, y, col, p=None, w=W, h=H):
    p = p or px
    if 0 <= x < w and 0 <= y < h:
        p[x, y] = col


def ellipse(cx, cy, rx, ry, col, edge=None):
    for y in range(int(cy - ry), int(cy + ry + 1)):
        for x in range(int(cx - rx), int(cx + rx + 1)):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d <= 1.0:
                put(x, y, edge if (edge and d > 0.72) else col)


def shadow(cx, cy, rx, ry):
    """the contact shadow — the single biggest 'it sits in the sand' trick,
    two-toned and offset to the lower-RIGHT because the light is upper-left"""
    for y in range(int(cy - ry), int(cy + ry + 1)):
        for x in range(int(cx - rx), int(cx + rx + 1)):
            if not (0 <= x < W and 0 <= y < H):
                continue
            if px[x, y][:3] not in (SAND, SAND_D, SAND_L, DUNE, DUNE_L, WET, WET_D):
                continue
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d <= 1.0:
                px[x, y] = SHADE_2 if d < 0.45 else SHADE


# ---- sky + sun + clouds ----------------------------------------------------
for col, y0, y1 in zip(SKY, [0, 32, 60, 82], [32, 60, 82, SEA_TOP]):
    rect(0, y0, W, y1, col)
for y in range(62, SEA_TOP + 1):
    for x in range(W):
        d = math.hypot(x - 700, (y - SEA_TOP) * 1.05)
        if d <= 36:
            put(x, y, SUN_L if d < 22 and y < SEA_TOP - 8 else SUN)
# long thin sunset clouds
for cy, cx, cw in ((26, 250, 120), (44, 900, 160), (18, 1150, 90), (56, 430, 70)):
    for i in range(cw):
        x = cx + i
        t = i / cw
        thick = 1 + int(2 * math.sin(math.pi * t))
        for k in range(thick):
            put(x, cy + k, (255, 205, 150) if k == 0 else (232, 150, 110))

# ---- the sea ---------------------------------------------------------------
rect(0, SEA_TOP, W, 160, SEA_DEEP)
rect(0, 160, W, 215, SEA_MID)
rect(0, 215, W, SEA_BOT, SEA_LIGHT)
# a soft band boundary so the bands don't read as hard stripes
for x in range(W):
    if rng.random() < 0.5:
        put(x, 159 + rng.randrange(0, 2), SEA_MID)
    if rng.random() < 0.5:
        put(x, 214 + rng.randrange(0, 2), SEA_LIGHT)
# the sun's glitter road — a CONE that fans out toward the viewer, the way a
# real one does; a narrow column reads as a waterfall
for _ in range(520):
    y = rng.randrange(SEA_TOP + 4, SEA_BOT - 4)
    t = (y - SEA_TOP) / float(SEA_BOT - SEA_TOP)
    spread = int(20 + 260 * t * t)
    x = 700 + rng.randrange(-spread, spread)
    if rng.random() > 1.0 - abs(x - 700) / float(spread + 1) * 0.7:
        continue                                   # thinner toward the edges
    for i in range(rng.randrange(2, 7)):
        put(x + i, y, SPARK)


def sea_rock(cx, cy, r):
    """rounded rock with a lit top-left and a foam collar (pack technique)"""
    for y in range(cy - r - 2, cy + r + 3):
        for x in range(cx - r * 2, cx + r * 2 + 1):
            d = math.hypot((x - cx) / 2.0, y - cy)
            if d <= r:
                lit = (x - cx) / 2.0 + (y - cy) < -r * 0.45
                put(x, y, STONE_D if d > r - 1.3 else (STONE_L if lit else STONE))
    for i in range(r * 4 + 2):                 # foam collar
        x = cx - r * 2 - 1 + i
        if rng.random() < 0.8:
            put(x, cy + r, SPARK)
        if rng.random() < 0.45:
            put(x, cy + r + 1, SPARK)


sea_rock(240, 236, 9)
sea_rock(1046, 224, 7)
sea_rock(392, 198, 5)
sea_rock(880, 250, 6)

# breaking foam at the waterline: three ragged rows, thickest at the edge
for x in range(W):
    wob = math.sin(x / 26.0) * 1.6 + math.sin(x / 9.0) * 0.9
    base = SEA_BOT + int(wob)
    put(x, base, SPARK)
    if rng.random() < 0.72:
        put(x, base + 1, SPARK)
    if rng.random() < 0.3:
        put(x, base - 1, SPARK)
rect(0, SEA_BOT + 2, W, WET_BOT, WET)
for x in range(W):                              # wet-sand sheen streaks
    if rng.random() < 0.25:
        put(x, SEA_BOT + 3 + rng.randrange(0, 3), WET_D)

# ---- dry sand --------------------------------------------------------------
for y in range(WET_BOT, H):
    for x in range(W):
        r = rng.random()
        px[x, y] = SAND_D if r < 0.07 else SAND_L if r < 0.12 else SAND


def dune(cx, cy, rx, ry):
    """a RAISED mound: lit crest, mid body, and a shaded skirt along the
    lower-right — without the skirt it reads as a bald patch, not a dune"""
    for y in range(cy - ry, cy + ry + 2):
        for x in range(cx - rx, cx + rx + 1):
            if not (0 <= x < W and 0 <= y < H):
                continue
            d = math.hypot((x - cx) / rx, (y - cy) / ry)
            ry_off = (y - cy) / float(ry)
            if d <= 1.0:
                if ry_off < -0.34:
                    put(x, y, DUNE_L)
                elif ry_off > 0.52:
                    put(x, y, SHADE)               # the skirt in shadow
                else:
                    put(x, y, DUNE)
            elif d <= 1.06 and ry_off > 0:
                put(x, y, SHADE_2)
    for i in range(int(rx * 1.1)):                 # wind ripples on the crest
        x = cx - int(rx * 0.55) + i
        if rng.random() < 0.4:
            put(x, cy - int(ry * 0.45) + (i % 3), SAND_L)


dune(300, 316, 78, 20)
dune(560, 322, 62, 16)
dune(980, 314, 90, 22)
dune(1240, 330, 64, 18)


def grass(cx, cy, n=6, size=1.0):
    """dune grass: separate BLADES fanning out, not a green blob"""
    for i in range(n):
        a = -math.pi / 2 + (i - (n - 1) / 2) * 0.34 + rng.uniform(-0.06, 0.06)
        ln = int((9 + rng.randrange(0, 6)) * size)
        for t in range(ln):
            bend = (t / ln) ** 2 * 3.2 * (1 if a > -math.pi / 2 else -1)
            x = int(cx + math.cos(a) * t + bend)
            y = int(cy + math.sin(a) * t)
            put(x, y, LEAF_L if t < ln * 0.4 else LEAF)
    put(cx, cy + 1, LEAF_D)


for gx, gy in ((246, 306), (330, 312), (392, 308), (524, 316), (600, 314),
               (930, 306), (1012, 308), (1064, 312), (1210, 322), (1286, 326)):
    grass(gx, gy, 5 + rng.randrange(0, 3), 0.9 + rng.random() * 0.4)

# ---- the exit road back to the park (bottom-left) --------------------------
for y in range(536, 604):
    for x in range(0, 74 - (y - 536) // 4):
        if rng.random() > 0.12:
            put(x, y, SAND_L)

# ---- the BOARDWALK (west): deck + radio shack ------------------------------
shadow(78, 530, 84, 10)
rect(0, WET_BOT, 150, 528, WOOD)
for x in range(0, 150, 16):                     # planks, lit top edge each
    rect(x, WET_BOT, x + 1, 528, WOOD_D)
    rect(x + 1, WET_BOT, x + 2, 528, WOOD_L)
rect(146, WET_BOT, 150, 528, WOOD_D)
rect(0, WET_BOT, 146, WET_BOT + 3, WOOD_L)
rect(0, 524, 150, 528, WOOD_D)

rect(18, 304, 122, 388, WALL)                   # radio shack
for x in range(26, 122, 14):
    rect(x, 322, x + 1, 388, (158, 102, 38))
rect(18, 304, 20, 388, (200, 140, 66))          # lit left edge
rect(18, 304, 122, 322, ROOF)
rect(18, 304, 122, 308, (232, 96, 44))
rect(18, 318, 122, 322, ROOF_D)
rect(82, 342, 108, 388, FRAME)
rect(84, 344, 106, 388, (52, 30, 12))
rect(30, 338, 60, 358, TEAL)
rect(30, 338, 60, 342, (120, 200, 226))         # glass glint
for e in range(30, 60):
    put(e, 337, FRAME); put(e, 358, FRAME)
for e in range(337, 359):
    put(29, e, FRAME); put(60, e, FRAME)
rect(32, 366, 56, 382, (58, 36, 20))
for y in range(369, 381, 4):
    rect(35, y, 53, y + 1, INK)
rect(66, 296, 69, 306, FRAME)
put(67, 294, RED); put(68, 294, RED)

# ---- 🏐 THE VOLLEYBALL COURT ----------------------------------------------
CX0, CY0, CX1, CY1 = 400, 404, 764, 584
NET_X = 582
for x in range(CX0, CX1):
    put(x, CY0, WHITE); put(x, CY0 + 1, SAND_D)
    put(x, CY1, WHITE); put(x, CY1 - 1, SAND_D)
for y in range(CY0, CY1):
    put(CX0, y, WHITE); put(CX1 - 1, y, WHITE)
shadow(NET_X + 10, CY0 - 8, 12, 8)
shadow(NET_X + 10, CY1 + 6, 12, 8)
rect(NET_X - 4, CY0 - 30, NET_X + 4, CY0 + 4, POST)
rect(NET_X - 4, CY0 - 30, NET_X - 2, CY0 + 4, TRUNK_L)
rect(NET_X - 4, CY1 - 4, NET_X + 4, CY1 + 28, POST)
rect(NET_X - 4, CY1 - 4, NET_X - 2, CY1 + 28, TRUNK_L)
rect(NET_X - 5, CY0 - 34, NET_X + 5, CY0 - 30, WOOD_D)
rect(NET_X - 5, CY1 + 24, NET_X + 5, CY1 + 32, WOOD_D)
rect(NET_X - 5, CY0 - 26, NET_X + 5, CY1 + 24, NET_C)
for y in range(CY0 - 26, CY1 + 24, 6):
    rect(NET_X - 3, y, NET_X + 3, y + 3, (204, 200, 188))
rect(NET_X - 7, CY0 - 30, NET_X + 7, CY0 - 26, WHITE)
rect(NET_X - 7, CY1 + 24, NET_X + 7, CY1 + 28, WHITE)
rect(NET_X + 5, CY0 - 26, NET_X + 9, CY1 + 24, SHADE)

# ---- 🚢 CAPTAIN SPLIT'S SHIPWRECK BAR --------------------------------------
HX, HY = 862, 330
HULL, HULL_D, HULL_L = (128, 82, 40), (92, 56, 24), (162, 112, 60)
shadow(HX + 112, HY + 80, 118, 16)
for y in range(HY, HY + 84):
    t = (y - HY) / 84.0
    half = int(112 * math.sin(math.pi * (0.22 + 0.78 * t)) * 0.9)
    for x in range(HX + 112 - half, HX + 112 + half):
        edge = x <= HX + 112 - half + 2 or x >= HX + 112 + half - 3
        plank = (y - HY) % 12 < 2
        lit = x < HX + 112 - half + 8
        put(x, y, HULL_D if (edge or y > HY + 78) else (HULL_L if (plank or lit) else HULL))
rect(HX + 40, HY - 46, HX + 48, HY + 6, POST)
rect(HX + 40, HY - 46, HX + 42, HY + 6, TRUNK_L)
rect(HX + 20, HY - 46, HX + 92, HY - 38, (232, 226, 206))
for i in range(6):
    rect(HX + 24 + i * 12, HY - 38, HX + 30 + i * 12, HY - 30 + i % 3 * 4, (216, 210, 190))
rect(HX + 34, HY - 58, HX + 56, HY - 48, RED)
rect(HX + 34, HY - 58, HX + 56, HY - 56, (240, 96, 92))
rect(HX + 30, HY + 30, HX + 194, HY + 44, WOOD_L)
rect(HX + 30, HY + 30, HX + 194, HY + 33, (206, 154, 90))
rect(HX + 30, HY + 44, HX + 194, HY + 48, WOOD_D)
for sx in range(HX + 44, HX + 190, 36):
    shadow(sx + 9, HY + 76, 12, 4)
    rect(sx, HY + 54, sx + 18, HY + 60, WOOD)
    rect(sx, HY + 54, sx + 18, HY + 56, WOOD_L)
    rect(sx + 6, HY + 60, sx + 12, HY + 74, WOOD_D)
for i, col in enumerate([(94, 168, 88), (196, 88, 60), (86, 128, 196), (222, 186, 74)]):
    bx = HX + 52 + i * 34
    rect(bx, HY + 18, bx + 7, HY + 30, col)
    rect(bx, HY + 18, bx + 2, HY + 30, tuple(min(255, c + 45) for c in col))
    rect(bx + 2, HY + 13, bx + 5, HY + 18, col)
    put(bx + 2, HY + 11, WHITE)
rect(HX + 168, HY - 14, HX + 172, HY + 2, POST)
rect(HX + 160, HY + 2, HX + 180, HY + 18, (246, 206, 104))
rect(HX + 160, HY + 2, HX + 180, HY + 5, (200, 152, 62))
rect(HX + 166, HY + 7, HX + 174, HY + 14, (255, 246, 190))

# ---- 🗼 THE LIGHTHOUSE -----------------------------------------------------
LCX, LBASE = 1306, 356
# headland: a low rocky outcrop with an IRREGULAR silhouette — a smooth
# ellipse of dark stone reads as a hole in the sand, not a rock
ROCK_L, ROCK_M, ROCK_D = (196, 186, 168), (162, 150, 132), (118, 108, 94)
shadow(LCX + 14, LBASE + 20, 56, 12)
for y in range(LBASE - 28, LBASE + 22):
    for x in range(LCX - 60, LCX + 61):
        ang = math.atan2((y - (LBASE + 2)) / 20.0, (x - LCX) / 54.0)
        wob = 1.0 + 0.13 * math.sin(ang * 3.0) + 0.08 * math.sin(ang * 7.0 + 1.4)
        d = math.hypot((x - LCX) / 54.0, (y - (LBASE + 2)) / 20.0) / wob
        if d > 1.0:
            continue
        lit = (y - (LBASE + 2)) < -4 and (x - LCX) < 18
        speck = (x * 5 + y * 3) % 7
        put(x, y, ROCK_D if d > 0.9 else
            (ROCK_L if lit else (ROCK_L if speck == 0 else (ROCK_M if speck < 5 else ROCK_D))))
for gx in (LCX - 34, LCX + 6, LCX + 30):        # tufts clinging to the rock
    grass(gx, LBASE - 14, 4, 0.7)
for y in range(LBASE - 128, LBASE - 26):       # tower
    t = (y - (LBASE - 128)) / 102.0
    hw = int(15 + 10 * t)
    band = ((y - (LBASE - 128)) // 20) % 2 == 0
    for x in range(LCX - hw, LCX + hw):
        edge = abs(x - LCX) > hw - 3
        lit = (x - LCX) < -hw * 0.35
        base_col = (RED if band else WHITE)
        if lit and not edge:
            base_col = ((240, 96, 92) if band else (255, 255, 252))
        put(x, y, ((140, 32, 30) if band else WHITE_D) if edge else base_col)
rect(LCX - 26, LBASE - 138, LCX + 26, LBASE - 128, (86, 84, 78))
for x in range(LCX - 24, LCX + 24, 6):
    rect(x, LBASE - 146, x + 2, LBASE - 138, (72, 70, 64))
rect(LCX - 16, LBASE - 172, LCX + 16, LBASE - 146, (250, 236, 170))
rect(LCX - 16, LBASE - 172, LCX + 16, LBASE - 168, (86, 84, 78))
rect(LCX - 9, LBASE - 164, LCX + 9, LBASE - 152, (255, 252, 224))
rect(LCX - 7, LBASE - 182, LCX + 7, LBASE - 172, RED)
put(LCX, LBASE - 184, RED_D)
for i in range(4):                              # the beam, sweeping west
    rect(LCX - 30 - i * 30, LBASE - 164 + i * 2, LCX - 16 - i * 26, LBASE - 154 - i, (255, 246, 200))
rect(LCX - 8, LBASE - 56, LCX + 8, LBASE - 26, FRAME)
rect(LCX - 6, LBASE - 52, LCX + 6, LBASE - 28, (52, 30, 12))


# ---- palms: radiating fronds, ringed trunk, base mound, shadow -------------
def palm(cx, base, size=1.0):
    h = int(58 * size)
    shadow(cx + 14, base + 3, int(26 * size), int(8 * size))
    ellipse(cx + 2, base, 13 * size, 5 * size, SAND_D)       # sand mound
    for y in range(base - h, base):                          # trunk with rings
        lean = round((base - y) / 8.5)
        x0 = cx - 4 + lean
        ring = ((base - y) // 7) % 2 == 0
        rect(x0, y, x0 + 8, y + 1, TRUNK if ring else TRUNK_D)
        put(x0, y, TRUNK_L)
        put(x0 + 1, y, TRUNK_L)
    top = (cx + round(h / 8.5), base - h)
    for k, ang in enumerate((-2.75, -2.05, -1.35, -0.55, 0.25, 0.95, 1.65)):
        ln = int((26 + (k % 3) * 5) * size)
        for t in range(ln):                                  # one frond = a spine…
            droop = (t / ln) ** 2 * 9 * size
            fx = int(top[0] + math.cos(ang) * t)
            fy = int(top[1] + math.sin(ang) * t * 0.55 + droop)
            wid = max(1, int((1 - t / ln) * 4.5 * size) + 1)
            for o in range(-wid, wid + 1):                   # …with blades either side
                if (t + o) % 2 == 0:
                    put(fx, fy + o, LEAF_D if abs(o) >= wid - 1 else
                        (LEAF_L if (ang < -0.9 and abs(o) < wid - 1) else LEAF))
        put(int(top[0] + math.cos(ang) * ln), int(top[1] + math.sin(ang) * ln * 0.55 + 9 * size), LEAF_D)
    for dx, dy in ((-3, 4), (2, 5), (-1, 7)):                # coconuts
        ellipse(top[0] + dx, top[1] + dy, 2.6, 2.4, (128, 80, 34), (92, 54, 20))


palm(214, 392)
palm(346, 470, 0.85)
palm(818, 300, 1.1)
palm(1122, 386)
palm(1330, 470, 0.9)
palm(486, 344, 0.8)


# ---- beach furniture: umbrella (wedges), towels (stripes+fringe), floats ---
def umbrella(cx, top_y, col):
    shadow(cx + 16, top_y + 52, 26, 8)
    rect(cx - 2, top_y + 22, cx + 2, top_y + 52, POST)
    rect(cx - 2, top_y + 22, cx - 1, top_y + 52, (140, 100, 56))
    R = 30
    for y in range(top_y, top_y + 24):
        half = int(R * math.sin(math.pi * min(1.0, (y - top_y + 1) / 26.0)) * 0.98)
        for x in range(cx - half, cx + half + 1):
            a = math.atan2(y - top_y - 24, x - cx)
            wedge = int((a + math.pi) / math.pi * 8) % 2 == 0
            edge = abs(x - cx) >= half - 1 or y >= top_y + 22
            c = col if wedge else WHITE
            if edge:
                c = tuple(int(v * 0.72) for v in c) if wedge else WHITE_D
            put(x, y, c)
    put(cx, top_y - 1, FRAME)


def towel(x0, y0, col, col2=WHITE):
    shadow(x0 + 22, y0 + 20, 24, 6)
    for y in range(y0, y0 + 18):
        for x in range(x0, x0 + 40):
            stripe = ((y - y0) // 3) % 2 == 0
            put(x, y, col if stripe else col2)
    for x in range(x0, x0 + 40, 3):                # fringe, both short ends
        put(x, y0 - 1, col)
        put(x, y0 + 18, col)
    rect(x0, y0, x0 + 40, y0 + 1, tuple(int(v * 1.12) if v < 220 else v for v in col))


def float_ring(cx, cy, col):
    shadow(cx + 5, cy + 9, 15, 5)
    ellipse(cx, cy, 15, 9, col, tuple(int(v * 0.72) for v in col))
    ellipse(cx, cy, 7, 4, SAND)
    for i in range(-13, 14, 6):                    # white bands
        if abs(i) > 6:
            ellipse(cx + i, cy, 2.4, 3.4, WHITE)


umbrella(975, 404, RED)
umbrella(430, 300, (246, 176, 60))
towel(1016, 464, TEAL)
towel(232, 556, (240, 153, 123), (255, 236, 214))
towel(650, 330, (168, 128, 224))
float_ring(1268, 300, (232, 96, 88))
float_ring(122, 470, (96, 176, 232))


def chair(x0, y0, c1, c2):
    shadow(x0 + 26, y0 + 32, 26, 7)
    rect(x0, y0, x0 + 44, y0 + 12, WOOD_D)
    for i, x in enumerate(range(x0 + 2, x0 + 42, 7)):
        rect(x, y0 + 1, x + 7, y0 + 11, c1 if i % 2 == 0 else c2)
    for i, x in enumerate(range(x0 + 2, x0 + 42, 7)):
        rect(x, y0 + 12, x + 7, y0 + 28, c2 if i % 2 == 0 else c1)
    rect(x0, y0 + 12, x0 + 2, y0 + 34, WOOD_D)
    rect(x0 + 42, y0 + 12, x0 + 44, y0 + 34, WOOD_D)
    rect(x0, y0 + 28, x0 + 44, y0 + 30, WOOD)
    rect(x0, y0, x0 + 44, y0 + 2, WOOD_L)


chair(1092, 424, (255, 225, 53), WHITE)
chair(1150, 452, TEAL, WHITE)
chair(158, 460, (244, 137, 178), WHITE)

# ---- the bonfire ring ------------------------------------------------------
shadow(268, 500, 26, 9)
for ang in range(9):
    a = ang / 9 * math.tau
    sx, sy = 262 + round(math.cos(a) * 19), 494 + round(math.sin(a) * 12)
    ellipse(sx, sy, 4, 3, STONE if ang % 2 else STONE_L, STONE_D)
rect(243, 488, 281, 498, (58, 44, 30))
rect(244, 490, 280, 494, POST)
rect(252, 484, 258, 500, POST)
rect(266, 486, 272, 499, TRUNK_D)


# ---- scattered beach dressing: buckets, castles, deco starfish -------------
def bucket(cx, cy, col):
    shadow(cx + 4, cy + 8, 8, 3)
    for y in range(cy - 9, cy + 1):
        t = (y - (cy - 9)) / 10.0
        half = int(6 - 1.6 * t)
        for x in range(cx - half, cx + half + 1):
            edge = abs(x - cx) >= half
            lit = x < cx - half + 2
            put(x, y, tuple(int(v * 0.7) for v in col) if edge else (tuple(min(255, v + 40) for v in col) if lit else col))
    rect(cx - 7, cy - 11, cx + 8, cy - 9, tuple(int(v * 0.8) for v in col))
    for i in range(-6, 7):                          # handle
        put(cx + i, cy - 15 + abs(i) // 2, (90, 88, 82))


def sandcastle(cx, base):
    shadow(cx + 8, base + 3, 22, 6)
    for i, (dx, hgt, wid) in enumerate(((-13, 16, 6), (0, 22, 7), (13, 16, 6))):
        for y in range(base - hgt, base):
            for x in range(cx + dx - wid, cx + dx + wid + 1):
                edge = abs(x - (cx + dx)) >= wid
                lit = x < cx + dx - wid * 0.3
                put(x, y, SAND_D if edge else (DUNE_L if lit else DUNE))
        for x in range(cx + dx - wid - 1, cx + dx + wid + 2, 3):   # crenellations
            rect(x, base - hgt - 3, x + 2, base - hgt, DUNE)
    rect(cx - 20, base - 8, cx + 21, base, DUNE)                   # the wall
    rect(cx - 20, base - 8, cx + 21, base - 6, DUNE_L)
    rect(cx - 1, base - 34, cx + 1, base - 22, POST)               # flag
    rect(cx + 1, base - 34, cx + 10, base - 28, RED)


def deco_star(cx, cy, col):
    for y in range(-5, 6):
        for x in range(-5, 6):
            d = math.hypot(x, y)
            if d > 5.4:
                continue
            a = math.atan2(y, x) + math.pi / 2
            k = (math.cos(a * 5) + 1) / 2
            if d <= 2.0 + 3.4 * k:
                put(cx + x, cy + y, col if d < 3.2 else tuple(int(v * 0.76) for v in col))


bucket(690, 470, (232, 96, 88))
bucket(1188, 386, (96, 176, 232))
bucket(322, 540, (246, 206, 74))
sandcastle(806, 520)
sandcastle(1064, 560)
for sx, sy in ((178, 300), (466, 284), (742, 296), (1128, 282), (1290, 300)):
    deco_star(sx, sy, (246, 206, 74) if (sx // 7) % 2 else (240, 150, 175))
for _ in range(50):                                  # tiny pebbles + shell bits
    x, y = rng.randrange(160, W - 40), rng.randrange(WET_BOT + 4, H - 10)
    if px[x, y][:3] in (SAND, SAND_D, SAND_L):
        put(x, y, SAND_D if rng.random() < 0.6 else WHITE_D)

# ---- the PIER --------------------------------------------------------------
PX0, PX1 = 1160, 1226
rect(PX0 - 34, 116, PX1 + 34, 172, WOOD)
for y in range(116, 172, 13):
    rect(PX0 - 34, y, PX1 + 34, y + 1, WOOD_D)
    rect(PX0 - 34, y + 1, PX1 + 34, y + 2, WOOD_L)
rect(PX0 - 34, 116, PX1 + 34, 120, WOOD_L)
rect(PX0 - 34, 168, PX1 + 34, 172, WOOD_D)
for rx in range(PX0 - 34, PX1 + 34, 14):
    rect(rx, 106, rx + 4, 118, POST)
rect(PX0 - 34, 104, PX1 + 34, 108, WOOD_L)
rect(PX0, 172, PX1, 322, WOOD)
for y in range(176, 322, 17):
    rect(PX0, y, PX1, y + 1, WOOD_D)
    rect(PX0, y + 1, PX1, y + 2, WOOD_L)
rect(PX0, 172, PX0 + 4, 322, WOOD_D)
rect(PX1 - 4, 172, PX1, 322, WOOD_D)
for pxx, pyy in ((PX0 - 36, 172), (PX1 + 30, 172), (PX0, 322), (PX1 - 8, 322)):
    rect(pxx, pyy, pxx + 8, pyy + 16, POST)
    rect(pxx, pyy, pxx + 2, pyy + 16, TRUNK_L)

# ---- the park signpost -----------------------------------------------------
shadow(80, 574, 14, 4)
rect(72, 546, 76, 572, POST)
rect(72, 546, 73, 572, TRUNK_L)
rect(56, 538, 96, 552, WOOD)
rect(56, 538, 96, 541, WOOD_L)
rect(52, 542, 58, 548, FRAME)
for x in range(62, 92, 4):
    rect(x, 543, x + 2, 546, FRAME)

im.save(os.path.join(OUT, 'beach.png'), optimize=True)
print('wrote beach.png  (%dx%d)' % (W, H))

# ============================================================================
# 🌊 THE ANIMATED WATER — two tileable overlays that DRIFT across the sea
# (CSS translates them; a 160-wide tile loops seamlessly at -160px)
TW, TH = 160, 196          # covers SEA_TOP..WET_BOT
lines = Image.new('RGBA', (TW, TH), (0, 0, 0, 0))
lp = lines.load()
lrng = random.Random(77)
for _ in range(30):
    y = lrng.randrange(4, TH - 30)
    x = lrng.randrange(0, TW)
    ln = lrng.randrange(5, 16)
    a = int(70 + 90 * (y / TH))
    for i in range(ln):
        xx = (x + i) % TW
        lp[xx, y] = (SPARK[0], SPARK[1], SPARK[2], a)
        if i % 3 == 0 and y + 1 < TH:
            lp[xx, y + 1] = (SPARK[0], SPARK[1], SPARK[2], a // 2)
lines.save(os.path.join(OUT, 'sea-lines.png'), optimize=True)
print('wrote sea-lines.png')

# the shoreline wash: 4 frames of foam creeping up and back
FW, FH, FN = 160, 18, 4
foam = Image.new('RGBA', (FW * FN, FH), (0, 0, 0, 0))
fp = foam.load()
frng = random.Random(303)
for f in range(FN):
    reach = (0, 2, 3, 1)[f]
    for x in range(FW):
        wob = math.sin((x + f * 12) / 13.0) * 1.5 + math.sin(x / 5.0) * 0.7
        base = 7 + int(wob) - reach
        for k in range(2 + reach):
            a = 235 if k == 0 else 150 - k * 34
            if a > 20:
                fp[f * FW + x, max(0, min(FH - 1, base + k))] = (SPARK[0], SPARK[1], SPARK[2], a)
        if frng.random() < 0.22:
            fp[f * FW + x, max(0, min(FH - 1, base - 1))] = (SPARK[0], SPARK[1], SPARK[2], 120)
foam.save(os.path.join(OUT, 'foam.png'), optimize=True)
print('wrote foam.png (%d frames)' % FN)

# ---- the volleyball --------------------------------------------------------
ball = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
bp = ball.load()
for y in range(16):
    for x in range(16):
        d = math.hypot(x - 7.5, y - 7.5)
        if d <= 7.5:
            band = RED if abs((x - 7.5) * 0.7 + (y - 7.5)) < 2.4 else WHITE
            if d < 5 and (x - 7.5) + (y - 7.5) < -3:
                band = (255, 255, 255) if band == WHITE else (240, 96, 92)
            bp[x, y] = (17, 17, 17, 255) if d > 6.5 else band
ball.save(os.path.join(OUT, 'ball.png'), optimize=True)
print('wrote ball.png')

# ---- the crab (14x9, facing right) -----------------------------------------
crab = Image.new('RGBA', (14, 9), (0, 0, 0, 0))
cp = crab.load()
for y in range(2, 7):
    for x in range(3, 11):
        cp[x, y] = RED
for x in range(4, 10):
    cp[x, 1] = (240, 96, 92, 255)
for x in range(3, 11):
    cp[x, 6] = RED_D
cp[5, 3] = (255, 255, 255, 255)
cp[8, 3] = (255, 255, 255, 255)
cp[5, 4] = (17, 17, 17, 255)
cp[8, 4] = (17, 17, 17, 255)
for lx in (2, 4, 9, 11):
    cp[lx, 7] = (140, 30, 28, 255)
    cp[lx, 8] = (140, 30, 28, 255)
cp[1, 1] = RED; cp[2, 0] = RED; cp[12, 1] = RED; cp[11, 0] = RED
crab.save(os.path.join(OUT, 'crab.png'), optimize=True)
print('wrote crab.png')

# ---- the seagull: 2 wing frames side by side (13x9 each) -------------------
GW, GH = 13, 9
gull = Image.new('RGBA', (GW * 2, GH), (0, 0, 0, 0))
gp = gull.load()
def gull_frame(ox, up):
    body = [(5, 5), (6, 5), (7, 5), (8, 5), (6, 4), (7, 4), (5, 6), (6, 6), (7, 6)]
    for x, y in body:
        gp[ox + x, y] = (255, 253, 245, 255)
    gp[ox + 9, 5] = (255, 253, 245, 255)          # tail
    gp[ox + 4, 4] = (255, 253, 245, 255)          # head
    gp[ox + 3, 4] = (246, 176, 60, 255)           # beak
    gp[ox + 4, 3] = (60, 58, 54, 255)             # eye
    if up:
        for i, (x, y) in enumerate(((5, 2), (6, 1), (7, 1), (8, 2))):
            gp[ox + x, y] = (255, 253, 245, 255)
            gp[ox + x, y + 1] = (222, 216, 198, 255)
    else:
        for i, (x, y) in enumerate(((5, 7), (6, 8), (7, 8), (8, 7))):
            gp[ox + x, y] = (255, 253, 245, 255)
            gp[ox + x, y - 1] = (222, 216, 198, 255)
gull_frame(0, True)
gull_frame(GW, False)
gull.save(os.path.join(OUT, 'gull.png'), optimize=True)
print('wrote gull.png (2 frames)')

# ============================================================================
# 🐚 THE SHELL STRIP — ORDER IS A CONTRACT with banana-beach.js's SHELL_IDS
S = 16
FAMILIES = [
    ('brown', (150, 96, 44), (190, 134, 74), (108, 66, 28)),
    ('grey', (150, 150, 145), (188, 188, 182), (104, 104, 100)),
    ('white', (238, 232, 214), (255, 253, 245), (190, 182, 162)),
    ('ice', (176, 224, 240), (216, 244, 252), (122, 176, 198)),
    ('pink', (240, 150, 175), (255, 194, 212), (196, 102, 132)),
    ('gold', (240, 190, 60), (255, 226, 122), (186, 136, 24)),
    ('goldblue', (110, 190, 230), (176, 228, 252), (48, 120, 168)),
]
STARS = [
    ('blue', (86, 140, 220), (140, 186, 246), (52, 96, 168)),
    ('green', (94, 184, 96), (146, 220, 148), (56, 132, 60)),
    ('purple', (168, 118, 224), (206, 168, 248), (118, 74, 168)),
    ('yellow', (246, 206, 74), (255, 232, 142), (196, 158, 30)),
]
SHELL_IDS = []
for fam, _, _, _ in FAMILIES:
    for shape in ('spiral', 'fan', 'cone'):
        SHELL_IDS.append(fam + '_' + shape)
for col, _, _, _ in STARS:
    SHELL_IDS.append('star_' + col + '_s')
    SHELL_IDS.append('star_' + col + '_b')

strip = Image.new('RGBA', (S * len(SHELL_IDS), S), (0, 0, 0, 0))
sp = strip.load()


def sput(ox, x, y, col):
    if 0 <= x < S and 0 <= y < S:
        sp[ox + x, y] = col


def draw_spiral(ox, base, light, dark):
    for y in range(2, 15):
        for x in range(2, 14):
            d = math.hypot((x - 7.5) / 5.6, (y - 8.4) / 6.0)
            if d <= 1.0:
                a = math.atan2(y - 8.4, x - 7.5)
                swirl = (a * 2.2 + d * 7.0) % 2.4 < 1.1
                sput(ox, x, y, dark if d > 0.86 else (light if swirl else base))
    for x in range(6, 10):
        sput(ox, x, 14, dark)


def draw_fan(ox, base, light, dark):
    for y in range(2, 15):
        t = 1.0 - (y - 2) / 12.0
        half = int(1.4 + 6.4 * math.sqrt(max(0.0, t)))
        for x in range(8 - half, 8 + half + 1):
            rib = (abs(x - 8) % 3 == 1)
            rim = (y <= 3 and (x % 2 == 0))
            edge = abs(x - 8) >= half
            sput(ox, x, y, dark if (edge or rim) else (light if rib else base))
    sput(ox, 7, 14, dark)
    sput(ox, 8, 14, dark)


def draw_cone(ox, base, light, dark):
    for y in range(1, 15):
        t = (y - 1) / 13.0
        half = int(0.6 + 5.4 * t)
        for x in range(8 - half, 8 + half + 1):
            band = ((y // 3) % 2 == 0)
            edge = abs(x - 8) >= half
            sput(ox, x, y, dark if edge or y == 14 else (light if band else base))


def draw_star(ox, base, light, dark, big):
    r_out = 7.2 if big else 5.0
    r_in = 3.0 if big else 2.1
    cx = cy = 7.5
    for y in range(16):
        for x in range(16):
            dx, dy = x - cx, y - cy
            d = math.hypot(dx, dy)
            if d > r_out:
                continue
            a = math.atan2(dy, dx) + math.pi / 2
            k = (math.cos(a * 5) + 1) / 2
            edge_r = r_in + (r_out - r_in) * k
            if d <= edge_r:
                sput(ox, x, y, dark if d > edge_r - 1.2 else (light if d < r_in * 0.8 else base))


for i, sid in enumerate(SHELL_IDS):
    ox = i * S
    if sid.startswith('star_'):
        col = sid.split('_')[1]
        _, b, l, d = next(s for s in STARS if s[0] == col)
        draw_star(ox, b, l, d, sid.endswith('_b'))
    else:
        fam, shape = sid.rsplit('_', 1)
        _, b, l, d = next(f for f in FAMILIES if f[0] == fam)
        {'spiral': draw_spiral, 'fan': draw_fan, 'cone': draw_cone}[shape](ox, b, l, d)

strip.save(os.path.join(OUT, 'shells.png'), optimize=True)
print('wrote shells.png (%d frames)' % len(SHELL_IDS))

im.resize((W, H), Image.NEAREST).save(os.path.join(SITE, 'tools', 'beach-contact.png'))
strip.resize((S * len(SHELL_IDS) * 3, S * 3), Image.NEAREST).save(
    os.path.join(SITE, 'tools', 'beach-shells-contact.png'))
print('wrote contact sheets')
