# -*- coding: utf-8 -*-
"""🏖 BANANA BAY — the beach scene art (banana-beach-plan).

B2 "TOP-DOWN REBUILD" (22 Jul). The bay used to be drawn with a sky and a
horizon — a SIDE view — while every pack sprite and the whole terrain tileset
is TOP-DOWN. Two projections in one picture is why it read as pasted together.
It's now a true top-down map, like the park: no sky, the sea is an area at the
top of the MAP, and pack art runs at its NATIVE 48px scale so a palm towers
over a banana the way it should. Our banana stays a flat front-facing sprite
with a contact shadow — the Stardew/RPG-Maker convention, verified in
tools/beach-angle-test.png.

Outputs:
  public/assets/beach/beach.png      2400x1100 world plate
  public/assets/beach/sea-lines.png  tileable drift overlay for the water
  public/assets/beach/foam.png       4-frame shoreline wash
  public/assets/beach/ball.png / crab.png / gull.png / shells.png
⚠️ GEOMETRY IS A CONTRACT with src/scripts/banana-beach.js — see GEO below.
Run: python tools/build-beach-scene.py
"""
import math
import os
import random
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blockify import load_pack, blockify

PACK = os.path.expanduser(r'~\OneDrive\banana-art-pack\Modern_Exteriors_48x48')
HAVE_PACK = os.path.isdir(PACK)
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SITE, 'public', 'assets', 'beach')
os.makedirs(OUT, exist_ok=True)
rng = random.Random(1999)

T = 48                       # the pack's tile — our world unit now
W, H = 2400, 1100
# ---- GEO: the contract with banana-beach.js -------------------------------
WATER_BOT = 260              # sea above this
SHORE_BOT = 306              # shoreline band ends (walkable wet sand below)
COURT = (640, 680, 1240, 1000)
NET_X = 940
BAR = (1700, 620)            # the wreck's centre / where the Captain stands
PIER = (1820, 1960, 60, 306)  # x0, x1, y_top, y_bottom
LIGHT = (2180, 470)
BOARDWALK = (0, 250, 306, 980)

im = Image.new('RGBA', (W, H), (54, 132, 158, 255))
px = im.load()

SAND_TINT = (250, 226, 170)
SPARK = (232, 246, 250)
INK = (17, 17, 17)
WHITE = (255, 253, 245)
SHADE = (198, 168, 116)


def rect(x0, y0, x1, y1, col):
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            if 0 <= x < W and 0 <= y < H:
                px[x, y] = col


def put(x, y, col):
    if 0 <= x < W and 0 <= y < H:
        px[x, y] = col


def shadow(cx, cy, rx, ry, a=64):
    """the contact shadow that makes a flat sprite sit ON the ground"""
    for y in range(int(cy - ry), int(cy + ry + 1)):
        for x in range(int(cx - rx), int(cx + rx + 1)):
            if not (0 <= x < W and 0 <= y < H):
                continue
            d = ((x - cx) / float(rx)) ** 2 + ((y - cy) / float(ry)) ** 2
            if d <= 1.0:
                r, g, b, _ = px[x, y]
                k = a / 255.0 * (1.0 - d * 0.45)
                px[x, y] = (int(r * (1 - k) + 44 * k), int(g * (1 - k) + 30 * k),
                            int(b * (1 - k) + 16 * k), 255)


# ---- the terrain: real pack tiles -----------------------------------------
if HAVE_PACK:
    sea = Image.open(os.path.join(PACK, 'Animated_48x48', 'Animated_Terrains_48x48',
                                  'Sea_Water_Tileset_48x48.png')).convert('RGBA')

    def seatile(c, r):
        return sea.crop((c * T, r * T, (c + 1) * T, (r + 1) * T))

    SAND_T = seatile(5, 1)                                  # pure sand
    WATER_T = seatile(1, 1)                                 # open water
    SHORE_T = seatile(1, 0).transpose(Image.FLIP_TOP_BOTTOM)  # water above, sand below
    for r in range(0, H // T + 1):
        for c in range(0, W // T + 1):
            y = r * T
            t = WATER_T if y + T <= WATER_BOT else (SHORE_T if y < SHORE_BOT else SAND_T)
            im.alpha_composite(t, (c * T, y))
else:
    rect(0, 0, W, WATER_BOT, (63, 160, 189))
    rect(0, WATER_BOT, W, H, (236, 217, 168))

# a warm golden-hour grade over the whole map — the sunset survives as LIGHT,
# not as a literal sky (there is no sky in a top-down world)
for y in range(H):
    warm = 1.0 - (y / float(H)) * 0.25
    for x in range(W):
        r, g, b, a = px[x, y]
        px[x, y] = (min(255, int(r * (1.0 + 0.045 * warm))),
                    min(255, int(g * (1.0 + 0.012 * warm))),
                    int(b * (1.0 - 0.055 * warm)), a)

# glitter scattered on the open water (no sun disc — nothing to reflect in a
# top-down view; it's just sparkle on the swell)
for _ in range(700):
    x, y = rng.randrange(0, W), rng.randrange(6, WATER_BOT - 14)
    for i in range(rng.randrange(2, 6)):
        put(x + i, y, SPARK)

# ---- the object layer: pack art at NATIVE scale ---------------------------
_cache = {}


def place(name, cx, base, factor=1, colors=10, warm=0.16, sat=1.12, con=1.06,
          flip=False, shade=True, sh=0.30):
    key = (name, factor, colors, warm, sat, con)
    if key not in _cache:
        _cache[key] = blockify(load_pack(name), factor=factor, colors=colors,
                               warm=warm, sat=sat, con=con)
    s = _cache[key]
    if flip:
        s = s.transpose(Image.FLIP_LEFT_RIGHT)
    if shade:
        shadow(cx + s.width * 0.06, base - s.height * 0.02,
               s.width * sh, max(4, s.height * 0.055))
    im.alpha_composite(s, (int(cx - s.width // 2), int(base - s.height)))
    return s.size


if HAVE_PACK:
    # 🛶 the boardwalk deck, laid from pack wood-floor tiles is overkill —
    # a plain plank deck reads fine from above and stays cheap
    bw0, bw1, by0, by1 = BOARDWALK
    for y in range(by0, by1):
        for x in range(bw0, bw1):
            plank = (y // 14) % 2 == 0
            edge = (y % 14) < 2
            base = (172, 118, 60) if plank else (156, 104, 50)
            put(x, y, (120, 76, 34) if edge else base)
    rect(bw1 - 5, by0, bw1, by1, (110, 68, 30))
    rect(bw0, by1 - 5, bw1, by1, (110, 68, 30))

    # 🌴 palms — native scale, so they tower over a 56px banana
    for cx, base, fl in ((330, 470, False), (520, 900, True), (1500, 520, False),
                         (1330, 1040, True), (2010, 900, False), (760, 560, True),
                         (2290, 640, False)):
        place('21_Beach_48x48_Palm_Tree.png', cx, base, flip=fl, sh=0.26)
    for cx, base in ((430, 372), (900, 366), (1600, 380), (2120, 372), (660, 362)):
        place('21_Beach_48x48_Big_Sprout_Vers_1.png', cx, base, shade=False)

    # 🏐 the volleyball court: real pack net + field lines
    cx0, cy0, cx1, cy1 = COURT
    # the pack's modular net pieces are whole-tile panels — stacked they made
    # a chain-link tower. A slim hand-drawn net reads correctly from above.
    shadow(NET_X + 14, cy0 - 6, 22, 12, 50)
    shadow(NET_X + 14, cy1 + 30, 22, 12, 50)
    rect(NET_X - 5, cy0 - 34, NET_X + 5, cy0 + 6, (120, 76, 34))
    rect(NET_X - 5, cy0 - 34, NET_X - 2, cy0 + 6, (176, 122, 64))
    rect(NET_X - 5, cy1 - 6, NET_X + 5, cy1 + 34, (120, 76, 34))
    rect(NET_X - 5, cy1 - 6, NET_X - 2, cy1 + 34, (176, 122, 64))
    rect(NET_X - 6, cy0 - 28, NET_X + 6, cy1 + 28, (242, 238, 226))
    for y in range(cy0 - 28, cy1 + 28, 7):
        rect(NET_X - 4, y, NET_X + 4, y + 3, (206, 200, 186))
    rect(NET_X - 8, cy0 - 34, NET_X + 8, cy0 - 28, WHITE)
    rect(NET_X - 8, cy1 + 28, NET_X + 8, cy1 + 34, WHITE)
    rect(NET_X + 6, cy0 - 28, NET_X + 11, cy1 + 28, SHADE)
    # the pack's field-line tiles came out as solid orange planks against our
    # warmer sand — a plain scuffed white line reads better from above anyway
    for x in range(cx0, cx1):
        for yy in (cy0, cy1):
            if (x // 5) % 6 != 5:
                put(x, yy, WHITE); put(x, yy + 1, (236, 230, 210))
    for y in range(cy0, cy1):
        for xx in (cx0, cx1 - 2):
            if (y // 5) % 6 != 5:
                put(xx, y, WHITE); put(xx + 1, y, (236, 230, 210))

    # 🚢 Captain Split's wreck
    place('21_Beach_48x48_Ship_Bar.png', BAR[0], BAR[1] + 120, colors=12, sh=0.34)
    for i, sx in enumerate((BAR[0] - 150, BAR[0] - 50, BAR[0] + 50, BAR[0] + 150)):
        place('21_Beach_48x48_Ship_Bar_Chair_%d.png' % (1 + i % 2), sx, BAR[1] + 200)

    # 🗼 the lighthouse — factor 2, or it would eat half the map
    place('21_Beach_48x48_Example_Lighthouse.png', LIGHT[0], LIGHT[1] + 300,
          factor=2, colors=12, sh=0.24)

    # ⛱ furniture
    place('21_Beach_48x48_Yellow_Beach_Umbrella_Opened.png', 1180, 560)
    place('21_Beach_48x48_Blue_Beach_Umbrella_Opened.png', 700, 1010)
    place('21_Beach_48x48_Green_Beach_Umbrella_Opened.png', 2050, 560)
    for i, (x0, y0) in enumerate(((1240, 640), (1330, 700), (400, 760))):
        place('ME_Singles_Swimming_Pool_48x48_Sunbed_%d.png' % (1 + i * 4), x0, y0)
    place('21_Beach_48x48_Blue_Beach_Towel_1.png', 1450, 780, shade=False)
    place('21_Beach_48x48_Multicolor_Beach_Towel_1.png', 620, 1060, shade=False)
    place('21_Beach_48x48_Yellow_Beach_Towel_2.png', 1900, 800, shade=False)
    place('21_Beach_48x48_Red_Float.png', 2240, 380)
    place('21_Beach_48x48_Green_Float.png', 300, 1020)
    for cx, base in ((1600, 900), (860, 1080), (2130, 1020)):
        place('21_Beach_48x48_Small_Red_Bucket_1.png', cx, base)
    place('21_Beach_48x48_Sand_Castle_1_Vers_1.png', 1050, 1080)
    place('21_Beach_48x48_Sand_Castle_2_Vers_1.png', 1780, 1010)
    for cx, base in ((480, 330), (1120, 336), (1750, 330), (2260, 334)):
        place('21_Beach_48x48_Yellow_Big_Starfish.png', cx, base, shade=False)
    for cx, base in ((820, 334), (1400, 330)):
        place('21_Beach_48x48_Purple_Small_Starfish.png', cx, base, shade=False)
    for cx, base in ((150, 200), (1300, 170), (2350, 230), (600, 120)):
        place('21_Beach_48x48_Medium_Sea_Rock_1_Vers_1.png', cx, base, shade=False)

    # 🛟 the pier, planked out over the water
    px0, px1, py0, py1 = PIER
    for y in range(py0, py1):
        for x in range(px0, px1):
            plank = (y // 16) % 2 == 0
            edge = (y % 16) < 2 or x < px0 + 5 or x > px1 - 6
            put(x, y, (110, 68, 30) if edge else ((172, 118, 60) if plank else (156, 104, 50)))

    # 🔥 the bonfire ring — hand-drawn stones; the pack's sea rocks carry a
    # foam collar, so a ring of them read as a ring of bubbles on dry sand
    shadow(566, 646, 74, 46, 40)
    for a in range(11):
        ang = a / 11.0 * math.tau
        sx, sy = 560 + int(math.cos(ang) * 62), 640 + int(math.sin(ang) * 40)
        for yy in range(sy - 9, sy + 10):
            for xx in range(sx - 12, sx + 13):
                d = math.hypot((xx - sx) / 12.0, (yy - sy) / 9.0)
                if d <= 1.0:
                    lit = (yy - sy) < -3 and (xx - sx) < 3
                    put(xx, yy, (108, 104, 96) if d > 0.86 else
                        ((186, 182, 168) if lit else (146, 142, 130)))
    for i in range(5):                       # charred logs in the middle
        ang = i / 5.0 * math.tau
        rect(560 + math.cos(ang) * 20 - 5, 640 + math.sin(ang) * 12 - 4,
             560 + math.cos(ang) * 20 + 6, 640 + math.sin(ang) * 12 + 5, (74, 52, 32))
    rect(544, 632, 578, 648, (52, 38, 24))

# ---- the road home, worn into the sand (bottom-left) ----------------------
for y in range(H - 150, H):
    for x in range(0, 150 - (H - y) // 3):
        r, g, b, a = px[x, y]
        put(x, y, (min(255, r + 12), min(255, g + 10), min(255, b + 6), a))

im = im.convert('RGB')
im.save(os.path.join(OUT, 'beach.png'), optimize=True)
print('wrote beach.png (%dx%d) %.0f KB' % (W, H,
      os.path.getsize(os.path.join(OUT, 'beach.png')) / 1024.0))

# ============================================================================
# 🌊 the drifting water overlay + the shoreline wash
TW, TH = 192, WATER_BOT + 40
lines = Image.new('RGBA', (TW, TH), (0, 0, 0, 0))
lp = lines.load()
lrng = random.Random(77)
for _ in range(34):
    y = lrng.randrange(4, TH - 24)
    x = lrng.randrange(0, TW)
    ln = lrng.randrange(6, 20)
    a = int(60 + 80 * (y / float(TH)))
    for i in range(ln):
        lp[(x + i) % TW, y] = (SPARK[0], SPARK[1], SPARK[2], a)
        if i % 3 == 0 and y + 1 < TH:
            lp[(x + i) % TW, y + 1] = (SPARK[0], SPARK[1], SPARK[2], a // 2)
lines.save(os.path.join(OUT, 'sea-lines.png'), optimize=True)
print('wrote sea-lines.png')

FW, FH, FN = 192, 26, 4
foam = Image.new('RGBA', (FW * FN, FH), (0, 0, 0, 0))
fp = foam.load()
frng = random.Random(303)
for f in range(FN):
    reach = (0, 3, 5, 2)[f]
    for x in range(FW):
        wob = math.sin((x + f * 14) / 17.0) * 2.2 + math.sin(x / 6.0) * 1.0
        base = 10 + int(wob) - reach
        for k in range(2 + reach):
            a = 225 if k == 0 else 150 - k * 26
            if a > 20:
                fp[f * FW + x, max(0, min(FH - 1, base + k))] = (SPARK[0], SPARK[1], SPARK[2], a)
        if frng.random() < 0.2:
            fp[f * FW + x, max(0, min(FH - 1, base - 1))] = (SPARK[0], SPARK[1], SPARK[2], 110)
foam.save(os.path.join(OUT, 'foam.png'), optimize=True)
print('wrote foam.png')

# ---- the volleyball, the crab, the gull -----------------------------------
RED, RED_D = (216, 60, 56), (168, 38, 36)
ball = Image.new('RGBA', (18, 18), (0, 0, 0, 0))
bp = ball.load()
for y in range(18):
    for x in range(18):
        d = math.hypot(x - 8.5, y - 8.5)
        if d <= 8.5:
            band = RED if abs((x - 8.5) * 0.7 + (y - 8.5)) < 2.7 else WHITE
            if d < 5.5 and (x - 8.5) + (y - 8.5) < -3:
                band = (255, 255, 255) if band == WHITE else (240, 96, 92)
            bp[x, y] = (17, 17, 17, 255) if d > 7.4 else band
ball.save(os.path.join(OUT, 'ball.png'), optimize=True)

if HAVE_PACK:
    crab = blockify(load_pack('21_Beach_48x48_Small_Red_Bucket_1.png'), factor=4, colors=4)
crab = Image.new('RGBA', (14, 9), (0, 0, 0, 0))
cp = crab.load()
for y in range(2, 7):
    for x in range(3, 11):
        cp[x, y] = RED
for x in range(4, 10):
    cp[x, 1] = (240, 96, 92, 255)
for x in range(3, 11):
    cp[x, 6] = RED_D
cp[5, 3] = (255, 255, 255, 255); cp[8, 3] = (255, 255, 255, 255)
cp[5, 4] = (17, 17, 17, 255); cp[8, 4] = (17, 17, 17, 255)
for lx in (2, 4, 9, 11):
    cp[lx, 7] = (140, 30, 28, 255); cp[lx, 8] = (140, 30, 28, 255)
cp[1, 1] = RED; cp[2, 0] = RED; cp[12, 1] = RED; cp[11, 0] = RED
crab.save(os.path.join(OUT, 'crab.png'), optimize=True)

GW, GH = 13, 9
gull = Image.new('RGBA', (GW * 2, GH), (0, 0, 0, 0))
gp = gull.load()


def gull_frame(ox, up):
    for x, y in ((5, 5), (6, 5), (7, 5), (8, 5), (6, 4), (7, 4), (5, 6), (6, 6), (7, 6)):
        gp[ox + x, y] = (255, 253, 245, 255)
    gp[ox + 9, 5] = (255, 253, 245, 255)
    gp[ox + 4, 4] = (255, 253, 245, 255)
    gp[ox + 3, 4] = (246, 176, 60, 255)
    gp[ox + 4, 3] = (60, 58, 54, 255)
    ys = ((5, 2), (6, 1), (7, 1), (8, 2)) if up else ((5, 7), (6, 8), (7, 8), (8, 7))
    for x, y in ys:
        gp[ox + x, y] = (255, 253, 245, 255)
        gp[ox + x, y + (1 if up else -1)] = (222, 216, 198, 255)


gull_frame(0, True)
gull_frame(GW, False)
gull.save(os.path.join(OUT, 'gull.png'), optimize=True)
print('wrote ball / crab / gull')

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
    sput(ox, 7, 14, dark); sput(ox, 8, 14, dark)


def draw_cone(ox, base, light, dark):
    for y in range(1, 15):
        t = (y - 1) / 13.0
        half = int(0.6 + 5.4 * t)
        for x in range(8 - half, 8 + half + 1):
            band = ((y // 3) % 2 == 0)
            edge = abs(x - 8) >= half
            sput(ox, x, y, dark if edge or y == 14 else (light if band else base))


def draw_star(ox, base, light, dark, big):
    r_out, r_in = (7.2, 3.0) if big else (5.0, 2.1)
    for y in range(16):
        for x in range(16):
            dx, dy = x - 7.5, y - 7.5
            d = math.hypot(dx, dy)
            if d > r_out:
                continue
            a = math.atan2(dy, dx) + math.pi / 2
            edge_r = r_in + (r_out - r_in) * (math.cos(a * 5) + 1) / 2
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

im.resize((W // 2, H // 2), Image.NEAREST).save(os.path.join(SITE, 'tools', 'beach-contact.png'))
print('wrote tools/beach-contact.png')
