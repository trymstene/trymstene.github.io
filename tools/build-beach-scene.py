# -*- coding: utf-8 -*-
"""🏖 BANANA BAY — the beach scene art (banana-beach-plan, B0 "the postcard").

Generates the wide beach world, house-pixel style, camera-follow sized:
  public/assets/beach/beach.png  (760x420: sunset sky, sea, sand, boardwalk
                                  + radio shack + kiosk, pier, palms, bonfire,
                                  parasol, towels, two deck chairs, exit road)
  public/assets/beach/ball.png   (16x16 kickable beach ball)
  public/assets/beach/crab.png   (14x9 scuttler, faces right — CSS flips)
Deterministic (seeded). Contact sheet at tools/beach-contact.png (2x).
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

W, H = 760, 420
im = Image.new('RGBA', (W, H))
px = im.load()

# palette — permanent golden hour (the sunset is a CHOICE, every screenshot warm)
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
TEAL = SEA_LIGHT
CANOPY = (46, 139, 52)
CANOPY_L = (63, 168, 69)
CANOPY_D = (33, 104, 39)
TRUNK = (122, 82, 48)
STONE = (128, 126, 116)
STONE_D = (98, 96, 88)

def rect(x0, y0, x1, y1, col):
    for y in range(y0, y1):
        for x in range(x0, x1):
            if 0 <= x < W and 0 <= y < H:
                px[x, y] = col

# ---- sky bands + the half-set sun + gulls ----------------------------------
for i, (col, y0, y1) in enumerate(zip(SKY, [0, 22, 42, 58], [22, 42, 58, 70])):
    pass
for col, y0, y1 in zip(SKY, [0, 22, 42, 58], [22, 42, 58, 70]):
    rect(0, y0, W, y1, col)
for y in range(46, 71):
    for x in range(W):
        if math.hypot(x - 380, (y - 70) * 1.05) <= 24:
            px[x, y] = SUN

def gull(cx, cy, col=WHITE):
    for dx in (-3, -2, 2, 3):
        px[cx + dx, cy] = col
    px[cx - 1, cy - 1] = col
    px[cx + 1, cy - 1] = col

gull(120, 30)
gull(178, 46)
gull(556, 34)

# ---- the sea: three bands, sun glitter, sparkle dashes, foam edge ----------
rect(0, 70, W, 112, SEA_DEEP)
rect(0, 112, W, 150, SEA_MID)
rect(0, 150, W, 182, SEA_LIGHT)
for _ in range(26):  # sun glitter column
    y = rng.randrange(72, 178)
    x = 368 + rng.randrange(-14, 26)
    for i in range(rng.randrange(2, 5)):
        if 0 <= x + i < W:
            px[x + i, y] = SPARK
for _ in range(30):  # scattered sparkle
    y = rng.randrange(74, 176)
    x = rng.randrange(4, W - 8)
    for i in range(rng.randrange(2, 4)):
        px[x + i, y] = SPARK
for x in range(0, W - 2, 3):  # foam at the waterline
    if rng.random() < 0.75:
        px[x, 178 + (x // 40) % 2] = SPARK
        px[x + 1, 179] = SPARK
rect(0, 182, W, 196, WET)

# ---- dry sand with dither + shells on the wet line -------------------------
for y in range(196, H):
    for x in range(W):
        r = rng.random()
        px[x, y] = SAND_D if r < 0.08 else SAND_L if r < 0.13 else SAND
for sx in (150, 236, 348, 470, 700, 730):
    col = (244, 167, 187) if sx % 2 == 0 else WHITE
    px[sx, 188] = col
    px[sx + 1, 188] = col
    px[sx, 189] = col

# ---- the exit road back to the park (left edge) ----------------------------
for y in range(372, 406):
    for x in range(0, 46 - (y - 372) // 3):
        if rng.random() > 0.12:
            px[x, y] = SAND_L

# ---- the BOARDWALK (west): deck, radio shack, kiosk ------------------------
# ends at y368 so the park road passes UNDER it along the bottom edge
rect(0, 196, 112, 368, WOOD)
for x in range(0, 112, 14):
    rect(x, 196, x + 1, 368, WOOD_D)
rect(108, 196, 112, 368, WOOD_D)
rect(0, 196, 108, 199, WOOD_L)
rect(0, 364, 112, 368, WOOD_D)

# radio shack
rect(14, 206, 94, 272, WALL)
for x in range(20, 94, 12):
    rect(x, 220, x + 1, 272, (158, 102, 38))
rect(14, 206, 94, 220, ROOF)
rect(14, 206, 94, 209, ROOF_D)
rect(14, 217, 94, 220, ROOF_D)
rect(62, 234, 82, 272, FRAME)          # doorway
rect(24, 232, 44, 248, TEAL)           # window
for e in range(24, 44):
    px[e, 232] = FRAME; px[e, 247] = FRAME
for e in range(232, 248):
    px[24, e] = FRAME; px[43, e] = FRAME
rect(26, 254, 42, 266, (58, 36, 20))   # the speaker
for y in range(256, 265, 3):
    rect(28, y, 40, y + 1, (17, 17, 17))
rect(52, 200, 54, 208, FRAME)          # antenna
px[53, 199] = RED

# kiosk (the future shell-exchange — scenery in B0)
rect(16, 302, 98, 362, WALL)
for x in range(16, 98, 10):            # awning stripes
    rect(x, 302, x + 10, 314, RED if (x // 10) % 2 == 0 else WHITE)
rect(16, 313, 98, 315, FRAME)
rect(26, 324, 88, 346, (58, 36, 20))   # counter opening
rect(24, 344, 90, 348, FRAME)          # sill

# ---- the PIER (east): deck to a sunset platform ----------------------------
rect(572, 84, 668, 136, WOOD)
for y in range(84, 136, 12):
    rect(572, y, 668, y + 1, WOOD_D)
rect(572, 84, 668, 87, WOOD_L)
rect(572, 133, 668, 136, WOOD_D)
rect(592, 136, 648, 344, WOOD)
for y in range(140, 344, 16):
    rect(592, y, 648, y + 1, WOOD_D)
rect(592, 136, 596, 344, WOOD_D)
rect(644, 136, 648, 344, WOOD_D)
for pxx, pyy in ((574, 136), (660, 136), (592, 344), (640, 344)):
    rect(pxx, pyy, pxx + 8, pyy + 14, POST)

# ---- palms ×2 --------------------------------------------------------------
def palm(cx, base):
    for y in range(base - 44, base):
        lean = round((base - y) / 9)
        rect(cx - 3 + lean, y, cx + 3 + lean, y + 1, TRUNK)
        px[cx - 3 + lean, y] = POST
    top = (cx + round(44 / 9), base - 46)
    for ang in (-2.6, -1.9, -1.2, -0.4, 0.3, 1.0):
        for i in range(5):
            fx = top[0] + round(math.cos(ang) * (i + 1) * 5)
            fy = top[1] + round(math.sin(ang) * (i + 1) * 3) + i * (2 if abs(ang) > 1.4 else 1)
            rect(fx - 4, fy - 2, fx + 4, fy + 1, CANOPY if i < 3 else CANOPY_D)
            if i < 2:
                rect(fx - 2, fy - 3, fx + 2, fy - 2, CANOPY_L)
    rect(top[0] - 2, top[1] + 2, top[0] + 3, top[1] + 6, (150, 96, 38))  # coconuts

palm(152, 302)
palm(522, 320)

# ---- bonfire ring (unlit in B0 — it lights at posted hours later) ----------
for ang in range(8):
    a = ang / 8 * math.tau
    sx, sy = 250 + round(math.cos(a) * 15), 332 + round(math.sin(a) * 10)
    rect(sx - 2, sy - 2, sx + 3, sy + 2, STONE if ang % 2 else STONE_D)
rect(243, 328, 258, 336, (58, 44, 30))
rect(244, 330, 256, 333, POST)
rect(247, 327, 250, 337, POST)

# ---- parasol + towels ------------------------------------------------------
rect(450, 300, 454, 340, POST)
for y in range(286, 304):
    half = round((y - 284) * 1.6)
    for x in range(452 - half, 452 + half):
        if 0 <= x < W:
            px[x, y] = RED if ((x - 452) // 8) % 2 == 0 else WHITE
px[452, 284] = FRAME
rect(292, 372, 320, 388, TEAL)
rect(292, 372, 320, 374, SEA_MID)
rect(292, 386, 320, 388, SEA_MID)
rect(472, 344, 502, 360, (240, 153, 123))
rect(472, 344, 502, 346, (216, 90, 60))
rect(472, 358, 502, 360, (216, 90, 60))

# ---- two deck chairs (sittable) --------------------------------------------
def chair(x0, y0, c1, c2):
    rect(x0, y0, x0 + 38, y0 + 10, WOOD_D)              # backrest frame
    for i, x in enumerate(range(x0 + 2, x0 + 36, 6)):
        rect(x, y0 + 1, x + 6, y0 + 9, c1 if i % 2 == 0 else c2)
    for i, x in enumerate(range(x0 + 2, x0 + 36, 6)):   # seat
        rect(x, y0 + 10, x + 6, y0 + 24, c2 if i % 2 == 0 else c1)
    rect(x0, y0 + 10, x0 + 2, y0 + 30, WOOD_D)
    rect(x0 + 36, y0 + 10, x0 + 38, y0 + 30, WOOD_D)
    rect(x0, y0 + 24, x0 + 38, y0 + 26, WOOD)

chair(340, 324, (255, 225, 53), WHITE)
chair(392, 342, TEAL, WHITE)

# ---- the park signpost by the exit road ------------------------------------
rect(48, 366, 51, 384, POST)
rect(38, 362, 62, 372, WOOD)
rect(38, 362, 62, 364, WOOD_L)
rect(38, 366, 40, 369, FRAME)  # arrow nub pointing left
rect(41, 365, 58, 370, WOOD)
for x in range(43, 57, 3):
    rect(x, 367, x + 2, 368, FRAME)

im.save(os.path.join(OUT, 'beach.png'), optimize=True)
print('wrote beach.png')

# ---- the ball (16x16) ------------------------------------------------------
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
cp[1, 1] = RED; cp[2, 0] = RED; cp[12, 1] = RED; cp[11, 0] = RED  # claws
crab.save(os.path.join(OUT, 'crab.png'), optimize=True)
print('wrote crab.png')

# ---- contact sheet ---------------------------------------------------------
K = 2
sheet = im.resize((W * K, H * K), Image.NEAREST)
sheet.save(os.path.join(SITE, 'tools', 'beach-contact.png'))
print('wrote tools/beach-contact.png')
