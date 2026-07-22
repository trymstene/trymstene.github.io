# -*- coding: utf-8 -*-
"""🏖 BANANA BAY — the beach scene art (banana-beach-plan).

B1 "THE RESORT": the bay grew to 1400x620 (≈4x B0) and gained a volleyball
court, Captain Split's shipwreck bar, a lighthouse and dunes. Generates:
  public/assets/beach/beach.png   (1400x620 world plate)
  public/assets/beach/ball.png    (16x16 volleyball)
  public/assets/beach/crab.png    (14x9 scuttler, faces right)
  public/assets/beach/shells.png  (29-frame sprite strip, 16x16 each — the
                                   collection: 7 colour families x 3 shapes
                                   + starfish 4 colours x 2 sizes)
Deterministic (seeded). Contact sheet at tools/beach-contact.png.
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
SEA_TOP, SEA_BOT = 100, 262     # the water band
WET_BOT = 290                   # wet sand ends, dry sand begins
im = Image.new('RGBA', (W, H))
px = im.load()

# palette — permanent golden hour (the sunset is a CHOICE: every screenshot warm)
SKY = [(92, 42, 82), (163, 59, 52), (217, 106, 47), (240, 168, 60)]
SUN = (255, 216, 61)
SEA_DEEP = (31, 111, 143)
SEA_MID = (43, 135, 168)
SEA_LIGHT = (63, 160, 189)
SPARK = (232, 246, 250)
WET = (217, 185, 138)
SAND = (236, 217, 168)
SAND_D = (220, 193, 136)
SAND_L = (244, 228, 184)
DUNE = (228, 206, 152)
DUNE_L = (246, 231, 187)
WOOD = (160, 106, 51)
WOOD_D = (125, 79, 34)
WOOD_L = (183, 126, 64)
FRAME = (74, 44, 18)
POST = (95, 61, 28)
ROOF = (208, 73, 27)
ROOF_D = (154, 50, 16)
WALL = (179, 118, 47)
RED = (216, 60, 56)
WHITE = (255, 253, 245)
TEAL = (63, 160, 189)
CANOPY = (46, 139, 52)
CANOPY_L = (63, 168, 69)
CANOPY_D = (33, 104, 39)
TRUNK = (122, 82, 48)
STONE = (128, 126, 116)
STONE_D = (98, 96, 88)
INK = (17, 17, 17)
NET = (238, 234, 220)


def rect(x0, y0, x1, y1, col, im_px=None, bw=None, bh=None):
    p = im_px or px
    ww = bw or W
    hh = bh or H
    for y in range(y0, y1):
        for x in range(x0, x1):
            if 0 <= x < ww and 0 <= y < hh:
                p[x, y] = col


# ---- sky bands + the half-set sun + gulls ----------------------------------
for col, y0, y1 in zip(SKY, [0, 32, 60, 82], [32, 60, 82, SEA_TOP]):
    rect(0, y0, W, y1, col)
for y in range(66, SEA_TOP + 1):
    for x in range(W):
        if math.hypot(x - 700, (y - SEA_TOP) * 1.05) <= 34:
            px[x, y] = SUN


def gull(cx, cy, col=WHITE):
    for dx in (-4, -3, 3, 4):
        px[cx + dx, cy] = col
    for dx in (-2, 2):
        px[cx + dx, cy - 1] = col


for gx, gy in ((210, 44), (320, 66), (980, 40), (1120, 58), (620, 30)):
    gull(gx, gy)

# ---- the sea: three bands, sun glitter, sparkle dashes, foam edge ----------
rect(0, SEA_TOP, W, 160, SEA_DEEP)
rect(0, 160, W, 215, SEA_MID)
rect(0, 215, W, SEA_BOT, SEA_LIGHT)
for _ in range(46):  # sun glitter column under the sun
    y = rng.randrange(SEA_TOP + 4, SEA_BOT - 4)
    x = 684 + rng.randrange(-18, 34)
    for i in range(rng.randrange(2, 6)):
        if 0 <= x + i < W:
            px[x + i, y] = SPARK
for _ in range(70):  # scattered sparkle
    y = rng.randrange(SEA_TOP + 4, SEA_BOT - 4)
    x = rng.randrange(4, W - 8)
    for i in range(rng.randrange(2, 4)):
        px[x + i, y] = SPARK

# sea rocks poking out of the shallows
def sea_rock(cx, cy, r):
    for y in range(cy - r, cy + r + 1):
        for x in range(cx - r * 2, cx + r * 2 + 1):
            if 0 <= x < W and 0 <= y < H:
                d = math.hypot((x - cx) / 2.0, y - cy)
                if d <= r:
                    px[x, y] = STONE_D if d > r - 1.4 or y > cy + r * 0.4 else STONE
    for i in range(r):  # foam collar
        if 0 <= cx - r * 2 - 1 + i < W:
            px[cx - r * 2 - 1 + i, cy + r] = SPARK
            px[cx + r * 2 - i, cy + r] = SPARK


sea_rock(240, 236, 9)
sea_rock(1046, 224, 7)
sea_rock(1330, 244, 11)

for x in range(0, W - 2, 3):  # foam at the waterline
    if rng.random() < 0.78:
        px[x, SEA_BOT + (x // 44) % 2] = SPARK
        px[x + 1, SEA_BOT + 1] = SPARK
rect(0, SEA_BOT + 2, W, WET_BOT, WET)

# ---- dry sand with dither --------------------------------------------------
for y in range(WET_BOT, H):
    for x in range(W):
        r = rng.random()
        px[x, y] = SAND_D if r < 0.08 else SAND_L if r < 0.13 else SAND


# ---- dunes: soft raised mounds along the back edge -------------------------
def dune(cx, cy, rx, ry):
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            if not (0 <= x < W and 0 <= y < H):
                continue
            d = math.hypot((x - cx) / rx, (y - cy) / ry)
            if d <= 1.0:
                px[x, y] = DUNE_L if (y - cy) < -ry * 0.25 else DUNE
            elif d <= 1.06:
                px[x, y] = SAND_D


dune(300, 316, 76, 20)
dune(560, 322, 60, 16)
dune(980, 314, 88, 22)
dune(1240, 330, 62, 18)

# ---- the exit road back to the park (bottom-left) --------------------------
for y in range(536, 604):
    for x in range(0, 74 - (y - 536) // 4):
        if rng.random() > 0.12:
            px[x, y] = SAND_L

# ---- the BOARDWALK (west): deck + radio shack ------------------------------
rect(0, WET_BOT, 150, 528, WOOD)
for x in range(0, 150, 16):
    rect(x, WET_BOT, x + 1, 528, WOOD_D)
rect(146, WET_BOT, 150, 528, WOOD_D)
rect(0, WET_BOT, 146, WET_BOT + 3, WOOD_L)
rect(0, 524, 150, 528, WOOD_D)

# radio shack
rect(18, 304, 122, 388, WALL)
for x in range(26, 122, 14):
    rect(x, 322, x + 1, 388, (158, 102, 38))
rect(18, 304, 122, 322, ROOF)
rect(18, 304, 122, 308, ROOF_D)
rect(18, 318, 122, 322, ROOF_D)
rect(82, 342, 108, 388, FRAME)          # doorway
rect(30, 338, 60, 358, TEAL)            # window
for e in range(30, 60):
    px[e, 338] = FRAME
    px[e, 357] = FRAME
for e in range(338, 358):
    px[30, e] = FRAME
    px[59, e] = FRAME
rect(32, 366, 56, 382, (58, 36, 20))    # the speaker
for y in range(369, 381, 4):
    rect(35, y, 53, y + 1, INK)
rect(66, 296, 69, 306, FRAME)           # antenna
px[67, 294] = RED
px[68, 294] = RED

# ---- 🏐 THE VOLLEYBALL COURT (the fidget loop's home) ----------------------
CX0, CY0, CX1, CY1 = 400, 404, 764, 584
NET_X = 582
for x in range(CX0, CX1):               # court boundary lines
    px[x, CY0] = WHITE
    px[x, CY0 + 1] = SAND_D
    px[x, CY1] = WHITE
    px[x, CY1 - 1] = SAND_D
for y in range(CY0, CY1):
    px[CX0, y] = WHITE
    px[CX1 - 1, y] = WHITE
# the net: two posts + a proper mesh band standing across the court. Drawn
# WIDE (a top-down net still needs to read as a net) with a dark shadow strip
# on its east side so it looks like it stands UP off the sand.
rect(NET_X - 4, CY0 - 30, NET_X + 4, CY0 + 4, POST)
rect(NET_X - 4, CY1 - 4, NET_X + 4, CY1 + 28, POST)
rect(NET_X - 5, CY0 - 34, NET_X + 5, CY0 - 26, WOOD_D)      # post caps
rect(NET_X - 5, CY1 + 24, NET_X + 5, CY1 + 32, WOOD_D)
rect(NET_X - 5, CY0 - 26, NET_X + 5, CY1 + 24, NET)          # the mesh band
for y in range(CY0 - 26, CY1 + 24, 6):                       # mesh holes
    rect(NET_X - 3, y, NET_X + 3, y + 3, (206, 202, 190))
rect(NET_X - 7, CY0 - 30, NET_X + 7, CY0 - 26, WHITE)        # top tape
rect(NET_X - 7, CY1 + 24, NET_X + 7, CY1 + 28, WHITE)
rect(NET_X + 5, CY0 - 26, NET_X + 9, CY1 + 24, SAND_D)       # cast shadow

# ---- 🚢 CAPTAIN SPLIT'S SHIPWRECK BAR --------------------------------------
# a wrecked hull half-buried in the sand, planked over into a bar
HX, HY = 862, 330
HULL = (122, 78, 38)
HULL_D = (92, 56, 24)
HULL_L = (150, 100, 52)
for y in range(HY, HY + 84):                       # hull: curved belly
    t = (y - HY) / 84.0
    half = int(112 * math.sin(math.pi * (0.22 + 0.78 * t)) * 0.9)
    for x in range(HX + 112 - half, HX + 112 + half):
        if 0 <= x < W:
            edge = x <= HX + 112 - half + 2 or x >= HX + 112 + half - 3
            px[x, y] = HULL_D if edge or y > HY + 78 else (HULL_L if (y - HY) % 12 < 2 else HULL)
rect(HX + 40, HY - 46, HX + 48, HY + 6, POST)      # broken mast
rect(HX + 20, HY - 46, HX + 92, HY - 38, (226, 220, 200))  # torn sail
for i in range(6):
    rect(HX + 24 + i * 12, HY - 38, HX + 30 + i * 12, HY - 30 + i % 3 * 4, (226, 220, 200))
rect(HX + 34, HY - 56, HX + 54, HY - 46, RED)      # a wee flag
rect(HX + 30, HY + 30, HX + 194, HY + 44, WOOD_L)  # the bar counter plank
rect(HX + 30, HY + 30, HX + 194, HY + 33, (200, 148, 84))
rect(HX + 30, HY + 44, HX + 194, HY + 48, WOOD_D)
for sx in range(HX + 44, HX + 190, 36):            # stools
    rect(sx, HY + 54, sx + 18, HY + 60, WOOD)
    rect(sx + 6, HY + 60, sx + 12, HY + 74, WOOD_D)
# bottles on the counter
for i, col in enumerate([(94, 168, 88), (196, 88, 60), (86, 128, 196), (222, 186, 74)]):
    bx = HX + 52 + i * 34
    rect(bx, HY + 18, bx + 7, HY + 30, col)
    rect(bx + 2, HY + 13, bx + 5, HY + 18, col)
    px[bx + 2, HY + 11] = WHITE
# a hanging lantern
rect(HX + 168, HY - 14, HX + 172, HY + 2, POST)
rect(HX + 162, HY + 2, HX + 178, HY + 16, (240, 196, 92))
rect(HX + 162, HY + 2, HX + 178, HY + 5, (196, 148, 60))

# ---- 🗼 THE LIGHTHOUSE (far-east landmark on a rocky headland) -------------
LCX, LBASE = 1306, 356          # tower centre x, where it meets the rock
for y in range(LBASE - 26, LBASE + 26):            # the headland: a rocky mound
    for x in range(LCX - 76, LCX + 77):
        if not (0 <= x < W):
            continue
        d = math.hypot((x - LCX) / 74.0, (y - (LBASE + 6)) / 30.0)
        if d <= 1.0:
            top = (y - (LBASE + 6)) < -12 and abs(x - LCX) < 46
            px[x, y] = STONE_D if d > 0.9 else ((160, 158, 148) if top else (STONE if (x * 3 + y) % 5 else STONE_D))
for y in range(LBASE - 128, LBASE - 26):           # tower, red/white bands
    t = (y - (LBASE - 128)) / 102.0
    hw = int(15 + 10 * t)
    band = ((y - (LBASE - 128)) // 20) % 2 == 0
    for x in range(LCX - hw, LCX + hw):
        if 0 <= x < W:
            edge = abs(x - LCX) > hw - 3
            base_col = (176, 44, 40) if band else WHITE
            px[x, y] = ((140, 32, 30) if band else (214, 208, 190)) if edge else base_col
rect(LCX - 26, LBASE - 138, LCX + 26, LBASE - 128, (86, 84, 78))   # gallery deck
for x in range(LCX - 24, LCX + 24, 6):                              # railing
    rect(x, LBASE - 146, x + 2, LBASE - 138, (72, 70, 64))
rect(LCX - 16, LBASE - 172, LCX + 16, LBASE - 146, (250, 236, 170))  # lamp room
rect(LCX - 16, LBASE - 172, LCX + 16, LBASE - 168, (86, 84, 78))
rect(LCX - 9, LBASE - 164, LCX + 9, LBASE - 152, (255, 252, 224))
rect(LCX - 7, LBASE - 182, LCX + 7, LBASE - 172, (176, 44, 40))      # the cap
for i in range(4):                                  # the beam, sweeping west
    rect(LCX - 30 - i * 30, LBASE - 164 + i * 2, LCX - 16 - i * 26, LBASE - 154 - i, (255, 246, 200))
rect(LCX - 8, LBASE - 56, LCX + 8, LBASE - 26, FRAME)   # the door
rect(LCX - 6, LBASE - 52, LCX + 6, LBASE - 28, (52, 30, 12))


# ---- palms ------------------------------------------------------------------
def palm(cx, base, size=1.0):
    h = int(56 * size)
    for y in range(base - h, base):
        lean = round((base - y) / 9)
        rect(cx - 3 + lean, y, cx + 4 + lean, y + 1, TRUNK)
        px[cx - 3 + lean, y] = POST
    top = (cx + round(h / 9), base - h - 2)
    for ang in (-2.6, -1.9, -1.2, -0.4, 0.3, 1.0):
        for i in range(6):
            fx = top[0] + round(math.cos(ang) * (i + 1) * 6 * size)
            fy = top[1] + round(math.sin(ang) * (i + 1) * 3 * size) + i * (2 if abs(ang) > 1.4 else 1)
            rect(fx - 5, fy - 2, fx + 5, fy + 2, CANOPY if i < 4 else CANOPY_D)
            if i < 2:
                rect(fx - 3, fy - 4, fx + 3, fy - 2, CANOPY_L)
    rect(top[0] - 3, top[1] + 3, top[0] + 4, top[1] + 8, (150, 96, 38))  # coconuts


palm(214, 392)
palm(346, 470, 0.85)
palm(818, 300, 1.1)
palm(1122, 386)
palm(1330, 470, 0.9)

# ---- bonfire ring (unlit in B1 — lights at posted hours later) -------------
for ang in range(9):
    a = ang / 9 * math.tau
    sx, sy = 262 + round(math.cos(a) * 19), 494 + round(math.sin(a) * 12)
    rect(sx - 3, sy - 2, sx + 4, sy + 3, STONE if ang % 2 else STONE_D)
rect(252, 488, 272, 498, (58, 44, 30))
rect(253, 490, 271, 494, POST)
rect(258, 484, 262, 500, POST)

# ---- parasol + towels + deck chairs ----------------------------------------
rect(972, 430, 978, 480, POST)
for y in range(410, 434):
    half = round((y - 408) * 1.9)
    for x in range(975 - half, 975 + half):
        if 0 <= x < W:
            px[x, y] = RED if ((x - 975) // 10) % 2 == 0 else WHITE
px[975, 407] = FRAME
rect(1016, 464, 1056, 486, TEAL)
rect(1016, 464, 1056, 467, SEA_MID)
rect(1016, 483, 1056, 486, SEA_MID)
rect(232, 556, 274, 578, (240, 153, 123))
rect(232, 556, 274, 559, (216, 90, 60))
rect(232, 575, 274, 578, (216, 90, 60))


def chair(x0, y0, c1, c2):
    rect(x0, y0, x0 + 44, y0 + 12, WOOD_D)
    for i, x in enumerate(range(x0 + 2, x0 + 42, 7)):
        rect(x, y0 + 1, x + 7, y0 + 11, c1 if i % 2 == 0 else c2)
    for i, x in enumerate(range(x0 + 2, x0 + 42, 7)):
        rect(x, y0 + 12, x + 7, y0 + 28, c2 if i % 2 == 0 else c1)
    rect(x0, y0 + 12, x0 + 2, y0 + 34, WOOD_D)
    rect(x0 + 42, y0 + 12, x0 + 44, y0 + 34, WOOD_D)
    rect(x0, y0 + 28, x0 + 44, y0 + 30, WOOD)


chair(1092, 424, (255, 225, 53), WHITE)
chair(1150, 452, TEAL, WHITE)
chair(158, 460, (244, 137, 178), WHITE)

# ---- the PIER (east): deck out over the water ------------------------------
PX0, PX1 = 1160, 1226
rect(PX0 - 34, 116, PX1 + 34, 172, WOOD)
for y in range(116, 172, 13):
    rect(PX0 - 34, y, PX1 + 34, y + 1, WOOD_D)
rect(PX0 - 34, 116, PX1 + 34, 120, WOOD_L)
rect(PX0 - 34, 168, PX1 + 34, 172, WOOD_D)
for rx in range(PX0 - 34, PX1 + 34, 14):            # platform railing posts
    rect(rx, 106, rx + 4, 118, POST)
rect(PX0 - 34, 104, PX1 + 34, 108, WOOD_L)
rect(PX0, 172, PX1, 322, WOOD)
for y in range(176, 322, 17):
    rect(PX0, y, PX1, y + 1, WOOD_D)
rect(PX0, 172, PX0 + 4, 322, WOOD_D)
rect(PX1 - 4, 172, PX1, 322, WOOD_D)
for pxx, pyy in ((PX0 - 36, 172), (PX1 + 30, 172), (PX0, 322), (PX1 - 8, 322)):
    rect(pxx, pyy, pxx + 8, pyy + 16, POST)

# ---- the park signpost by the exit road ------------------------------------
rect(72, 546, 76, 572, POST)
rect(56, 538, 96, 552, WOOD)
rect(56, 538, 96, 541, WOOD_L)
rect(52, 542, 58, 548, FRAME)
for x in range(62, 92, 4):
    rect(x, 543, x + 2, 546, FRAME)

im.save(os.path.join(OUT, 'beach.png'), optimize=True)
print('wrote beach.png  (%dx%d)' % (W, H))

# ---- the volleyball (16x16) ------------------------------------------------
ball = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
bp = ball.load()
for y in range(16):
    for x in range(16):
        d = math.hypot(x - 7.5, y - 7.5)
        if d <= 7.5:
            band = RED if abs((x - 7.5) * 0.7 + (y - 7.5)) < 2.4 else WHITE
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
    cp[x, 1] = (176, 40, 38, 255)
cp[5, 3] = (255, 255, 255, 255)
cp[8, 3] = (255, 255, 255, 255)
cp[5, 4] = (17, 17, 17, 255)
cp[8, 4] = (17, 17, 17, 255)
for lx in (2, 4, 9, 11):
    cp[lx, 7] = (140, 30, 28, 255)
    cp[lx, 8] = (140, 30, 28, 255)
cp[1, 1] = RED
cp[2, 0] = RED
cp[12, 1] = RED
cp[11, 0] = RED
crab.save(os.path.join(OUT, 'crab.png'), optimize=True)
print('wrote crab.png')

# ============================================================================
# 🐚 THE SHELL STRIP — the 29-slot collection.
# 7 colour families x 3 shapes (spiral / fan / cone) = 21, then starfish in
# 4 colours x small+big = 8. ORDER IS THE CONTRACT: banana-beach.js indexes
# this strip by the same list (SHELL_IDS) — never reorder, only append.
S = 16
FAMILIES = [                       # id, base, light, dark
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
    """a scallop: hinge at the BOTTOM, fanning WIDE at the top with a
    scalloped rim — the silhouette that tells it apart from the cone."""
    for y in range(2, 15):
        t = 1.0 - (y - 2) / 12.0                 # widest at the top
        half = int(1.4 + 6.4 * math.sqrt(max(0.0, t)))
        for x in range(8 - half, 8 + half + 1):
            rib = (abs(x - 8) % 3 == 1)
            rim = (y <= 3 and (x % 2 == 0))       # the scalloped edge
            edge = abs(x - 8) >= half
            sput(ox, x, y, dark if (edge or rim) else (light if rib else base))
    sput(ox, 7, 14, dark)                        # the hinge
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
            k = (math.cos(a * 5) + 1) / 2          # 5 arms
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
print('SHELL_IDS =', SHELL_IDS)

# ---- contact sheet ---------------------------------------------------------
sheet = im.resize((W, H), Image.NEAREST)
sheet.save(os.path.join(SITE, 'tools', 'beach-contact.png'))
shelf = strip.resize((S * len(SHELL_IDS) * 3, S * 3), Image.NEAREST)
shelf.save(os.path.join(SITE, 'tools', 'beach-shells-contact.png'))
print('wrote tools/beach-contact.png + beach-shells-contact.png')
