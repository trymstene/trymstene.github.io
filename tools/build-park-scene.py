# -*- coding: utf-8 -*-
"""🌳 PARK 2.0 — the park scene art (park-2-plan).

Beach-template build (build-beach-scene.py is the constitution): true top-down
map, pack art at PROP scale, colliders declared ON the placement and emitted
into src/scripts/park-geo.js. The forest replaces the ocean as the world's
walls. Zones (Trym's approved v2 zoning, 28 Jul): crossroads plaza + fountain
centre · duck pond NW · MARKET ROW lining the north side of the beach road
(storefronts face the walk) · meadow SE · playground SW · road stubs W + N
with construction signs.

Outputs:
  public/assets/park/park.png        2760x1100 world plate
  public/assets/park/ov-*.png        y-sorted overlay props
  public/assets/park/a-fountain.png  the plaza fountain, animated strip
  public/assets/park/a-swing.png     park swing, 2-frame strip
  public/assets/park/a-spring.png    spring rider, 2-frame strip
  src/scripts/park-geo.js            ⚠️ THE CONTRACT with the park engine
Run: python tools/build-park-scene.py
"""
import math
import os
import random
import sys
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blockify import load_pack, blockify

PACK = os.path.expanduser(r'~\OneDrive\banana-art-pack\Modern_Exteriors_48x48')
HAVE_PACK = os.path.isdir(PACK)
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SITE, 'public', 'assets', 'park')
os.makedirs(OUT, exist_ok=True)
rng = random.Random(1999)

T = 48
W, H = 2760, 1100            # the beach frame, exactly
PROP = 0.76                  # the beach's heroic-banana scale rule

# ---- GEO: the contract with the park engine -------------------------------
CX, CY = 1380, 560           # the crossroads plaza centre
ROAD_W = 88
PLAZA_RX, PLAZA_RY = 250, 195
BOUND = 96                   # walkable inset — the treeline is the wall
POND = (555, 315, 265, 150)  # cx, cy, rx, ry (NW)
MARKET_Y = 430               # the row's ground line (storefronts face the road)
MEADOW = (1860, 640, 2500, 940)
PLAY = (360, 640, 1000, 960)

im = Image.new('RGBA', (W, H), (86, 152, 74, 255))
px = im.load()
INK = (17, 17, 17)


def rect(x0, y0, x1, y1, col):
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            if 0 <= x < W and 0 <= y < H:
                px[x, y] = col if len(col) == 4 else col + (255,)


def put(x, y, col):
    if 0 <= x < W and 0 <= y < H:
        px[x, y] = col if len(col) == 4 else col + (255,)


def shadow(cx, cy, rx, ry, a=64):
    for y in range(int(cy - ry), int(cy + ry + 1)):
        for x in range(int(cx - rx), int(cx + rx + 1)):
            if not (0 <= x < W and 0 <= y < H):
                continue
            d = ((x - cx) / float(rx)) ** 2 + ((y - cy) / float(ry)) ** 2
            if d <= 1.0:
                r, g, b, _ = px[x, y]
                k = a / 255.0 * (1.0 - d * 0.45)
                px[x, y] = (int(r * (1 - k) + 24 * k), int(g * (1 - k) + 34 * k),
                            int(b * (1 - k) + 18 * k), 255)


# ---- the terrain: the pack's grass ----------------------------------------
def most_uniform(names):
    """pick the FULL-FILL tile out of an autotile family: the one whose pixels
    vary least (edge tiles carry the water/border transition)"""
    best, best_v = None, 1e9
    for n in names:
        try:
            t = load_pack(n).convert('RGBA')
        except Exception:
            continue
        p = t.load()
        cols = [p[x, y][:3] for y in range(0, t.height, 6) for x in range(0, t.width, 6)]
        mean = [sum(c[i] for c in cols) / len(cols) for i in range(3)]
        v = sum((c[i] - mean[i]) ** 2 for c in cols for i in range(3))
        if v < best_v:
            best, best_v = t, v
    return best


if HAVE_PACK:
    GRASS_T = most_uniform(['ME_Singles_Terrains_and_Fences_48x48_Grass_1_%d.png' % i
                            for i in range(1, 20)])
    WATER_T = most_uniform(['ME_Singles_Terrains_and_Fences_48x48_Deep_Water_1_%d.png' % i
                            for i in range(1, 20)])
    for r in range(0, H // T + 1):
        for c in range(0, W // T + 1):
            im.alpha_composite(GRASS_T, (c * T, r * T))
else:
    rect(0, 0, W, H, (86, 152, 74))

# a soft afternoon grade — greens lifted warm, colour-keyed like the beach's
GRASS_TARGET = (128, 186, 96)
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        if g > r - 10 and g > b:                 # grassy → lift toward warm green
            k = 0.30
            px[x, y] = (int(r * (1 - k) + GRASS_TARGET[0] * k),
                        int(g * (1 - k) + GRASS_TARGET[1] * k),
                        int(b * (1 - k) + GRASS_TARGET[2] * k), a)

# ---- 🛣 THE PARK PATHS: packed dirt on grass (the beach's procedural road
# doctrine — tone, TEXTURE-replacement, dark shoulder, taper) ----------------
ROAD = (208, 178, 128)
ROAD_S = (196, 166, 116)
ROAD_RIM = (122, 108, 62)


def lane(x0, y0, x1, y1, taper_ends=()):
    """an axis-aligned dirt lane with speckle + shoulders; taper_ends lists
    'x0'/'x1'/'y0'/'y1' edges that thin out (the construction stubs)"""
    for y in range(int(y0), int(y1)):
        for x in range(int(x0), int(x1)):
            if not (0 <= x < W and 0 <= y < H):
                continue
            k = 1.0
            if 'x0' in taper_ends:
                k = min(k, (x - x0) / 44.0)
            if 'x1' in taper_ends:
                k = min(k, (x1 - x) / 44.0)
            if 'y0' in taper_ends:
                k = min(k, (y - y0) / 44.0)
            if 'y1' in taper_ends:
                k = min(k, (y1 - y) / 44.0)
            if k <= 0 or rng.random() > k:
                continue
            put(x, y, ROAD_S if (x * 7 + y * 13) % 11 == 0 else ROAD)
    # shoulders on the long axis
    horiz = (x1 - x0) > (y1 - y0)
    for t in range(int(x0 if horiz else y0), int(x1 if horiz else y1)):
        if rng.random() < 0.72:
            if horiz:
                put(t, int(y0) - 1, ROAD_RIM)
                put(t, int(y1), ROAD_RIM)
            else:
                put(int(x0) - 1, t, ROAD_RIM)
                put(int(x1), t, ROAD_RIM)


lane(CX - ROAD_W // 2, CY, CX + ROAD_W // 2, H)                    # S → the rave
lane(CX, CY - ROAD_W // 2, W, CY + ROAD_W // 2)                    # E → the beach
lane(BOUND + 40, CY - ROAD_W // 2, CX, CY + ROAD_W // 2, ('x0',))  # W stub 🚧
lane(CX - ROAD_W // 2, BOUND + 20, CX + ROAD_W // 2, CY, ('y0',))  # N stub 🚧

# ---- ⛲ the plaza: warm sandstone flags over the crossroads ----------------
# ⚠️ NOT a two-tone checker — at 24px checks it read as a PNG transparency
# checkerboard (round-1 plate). Flagstones = one warm fill, thin JOINT lines
# on a 30px grid, per-flag tone jitter, a darker ring, and road-coloured entry
# aprons at the four compass points so the lanes flow INTO the circle.
PAVE, PAVE_J, PAVE_RING = (216, 199, 164), (178, 160, 126), (160, 146, 114)
frng = random.Random(44)
flag_tone = {}
for y in range(CY - PLAZA_RY, CY + PLAZA_RY):
    for x in range(CX - PLAZA_RX, CX + PLAZA_RX):
        d = ((x - CX) / float(PLAZA_RX)) ** 2 + ((y - CY) / float(PLAZA_RY)) ** 2
        if d > 1.0:
            continue
        if d > 0.92:
            put(x, y, PAVE_RING)
            continue
        fk = (x // 30, y // 30)
        if fk not in flag_tone:
            j = frng.randrange(-8, 9)
            flag_tone[fk] = (PAVE[0] + j, PAVE[1] + j, PAVE[2] + j)
        put(x, y, PAVE_J if (x % 30 < 2 or y % 30 < 2) else flag_tone[fk])
for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):        # the entry aprons
    for k in range(60):
        ex = CX + dx * (PLAZA_RX - k) if dx else 0
        ey = CY + dy * (PLAZA_RY - k) if dy else 0
        for t in range(-ROAD_W // 2, ROAD_W // 2):
            x = (ex if dx else CX + t)
            y = (ey if dy else CY + t)
            if dx:
                y = CY + t
            if ((x - CX) / float(PLAZA_RX)) ** 2 + ((y - CY) / float(PLAZA_RY)) ** 2 <= 1.0:
                put(x, y, ROAD_S if (x * 7 + y * 13) % 11 == 0 else ROAD)

# ---- the object layer -----------------------------------------------------
_cache = {}
PLACED = []
COLLIDERS = []
OVERLAYS = []
SWINGS = []
SIGNS = []
MARKET = {}

TRUNK = ('rect', -13, -36, 13, 0)
BASIN = ('circle', 60)
CART_BOX = ('rect', -70, -46, 70, 6)
BENCH_BOX = ('rect', -34, -18, 34, 4)
TABLE_BOX = ('rect', -44, -30, 44, 6)
SWING_BOX = ('rect', -52, -20, 52, 6)
ROCK_BOX = ('circle', 20)


def place(name, cx, base, factor=1, colors=10, warm=0.06, sat=1.08, con=1.05,
          flip=False, shade=True, sh=0.30, scale=PROP, solid=None, layer=False):
    key = (name, factor, colors, warm, sat, con)
    if key not in _cache:
        _cache[key] = blockify(load_pack(name), factor=factor, colors=colors,
                               warm=warm, sat=sat, con=con)
    s = _cache[key]
    if scale != 1.0:
        s = s.resize((max(1, int(s.width * scale)), max(1, int(s.height * scale))),
                     Image.NEAREST)
    if flip:
        s = s.transpose(Image.FLIP_LEFT_RIGHT)
    if shade:
        shadow(cx + s.width * 0.06, base - s.height * 0.02,
               s.width * sh, max(4, s.height * 0.055))
    box = (int(cx - s.width // 2), int(base - s.height),
           int(cx - s.width // 2) + s.width, int(base))
    im.alpha_composite(s, box[:2])
    PLACED.append((name, box))
    if layer:
        fn = 'ov-%d.png' % len(OVERLAYS)
        s.save(os.path.join(OUT, fn), optimize=True)
        OVERLAYS.append((fn, box[0], box[1], s.width, s.height, int(base)))
    if solid:
        COLLIDERS.append((name, solid, int(cx), int(base)))
    return s.size


def try_place(names, cx, base, **kw):
    """first sprite that exists wins — pack filenames drift between versions"""
    for n in names if isinstance(names, (list, tuple)) else [names]:
        try:
            return place(n, cx, base, **kw)
        except Exception:
            continue
    print('  MISSING all of', names)
    return (0, 0)


# ---- 🦆 the duck pond ------------------------------------------------------
pcx, pcy, prx, pry = POND
if HAVE_PACK:
    for y in range(pcy - pry, pcy + pry):
        for x in range(pcx - prx, pcx + prx):
            d = ((x - pcx) / float(prx)) ** 2 + ((y - pcy) / float(pry)) ** 2
            if d <= 1.0:
                t = WATER_T.load()[(x % T), (y % T)]
                put(x, y, t)
# the shore: a dark packed-mud ring, then a lighter lip — procedural, the
# road-shoulder trick bent into an ellipse
for ang in range(0, 3600):
    a = ang / 3600.0 * 2 * math.pi
    for rr, col in ((1.0, (96, 86, 52)), (1.03, (146, 128, 78)), (1.06, (170, 152, 96))):
        x = int(pcx + math.cos(a) * prx * rr)
        y = int(pcy + math.sin(a) * pry * rr)
        put(x, y, col)
        put(x + 1, y, col)
# ripples + lily pads, so the pond isn't a navy slab
prng = random.Random(88)
for _ in range(60):
    a = prng.random() * 2 * math.pi
    rr = prng.random() * 0.86
    x = int(pcx + math.cos(a) * prx * rr)
    y = int(pcy + math.sin(a) * pry * rr)
    for i in range(prng.randrange(4, 9)):
        put(x + i, y, (96, 152, 196))
for lx, ly in ((pcx - 120, pcy - 40), (pcx + 90, pcy + 55), (pcx + 40, pcy - 80)):
    for yy in range(-5, 6):
        for xx in range(-9, 10):
            if (xx / 9.0) ** 2 + (yy / 5.0) ** 2 <= 1.0 and not (xx > 4 and abs(yy) < 2):
                put(lx + xx, ly + yy, (74, 142, 62) if (xx + yy) % 3 else (94, 168, 78))

# ---- 🌲 the forest: the world's walls -------------------------------------
# ⚠️ GREEN trees only — Tree_4/5/6 are the pack's AUTUMN set and the round-1
# borders came out orange (survey: 1-3 + 13-18 are the tall 192px greens)
TREES = ['ME_Singles_Camping_48x48_Tree_%d.png' % n for n in (1, 2, 3, 13, 14, 15, 16, 17, 18)]


def treeline(x0, x1, y, step=104, jitter=26, big=True):
    x = x0
    while x < x1:
        n = TREES[rng.randrange(len(TREES))]
        try_place(n, x + rng.randrange(-jitter, jitter),
                  y + rng.randrange(-jitter, jitter),
                  scale=PROP if big else PROP * 0.8, shade=False)
        x += step


if HAVE_PACK:
    treeline(40, W - 20, 66, step=96)                      # north wall (dense)
    treeline(40, W - 20, 34, step=110)
    treeline(30, W - 20, H - 24, step=100)                 # south wall
    treeline(60, CX - 90, H - 62, step=118)                # (gap at the rave road)
    treeline(CX + 90, W - 40, H - 62, step=118)
    for y in range(140, H - 60, 96):                       # west + east walls
        if not (CY - 110 < y < CY + 60):                   # gaps at the road doors
            try_place(TREES[rng.randrange(len(TREES))], 44 + rng.randrange(-18, 18), y, shade=False)
            try_place(TREES[rng.randrange(len(TREES))], W - 46 + rng.randrange(-16, 16), y, shade=False)
    # inner clumps — these are IN the playfield, so they y-sort and collide
    for cx_, cy_ in ((240, 620), (1060, 260), (1200, 940), (1660, 180),
                     (2560, 950), (900, 470)):
        for i in range(3):
            try_place(TREES[rng.randrange(len(TREES))],
                      cx_ + rng.randrange(-70, 70), cy_ + rng.randrange(-40, 40),
                      solid=TRUNK, layer=True)

# ---- ⛲ the fountain (animated → strip; frame 0 baked) ---------------------
def sheet_frames(img):
    for n in (8, 6, 4, 3, 2):
        if img.width % n == 0 and 0.4 <= (img.width / n) / img.height <= 1.6:
            return n
    return 1


FOUNTAIN = []
if HAVE_PACK:
    try:
        # Garden_Fountain_3: 864x288 = SIX frames of 144x288 (a tall statue
        # fountain). ⚠️ Round 2 sliced it as 3x288 and the plaza got TWO
        # fountains standing side by side — one "frame" held two of them.
        sheet = load_pack('Garden_Fountain_3_48x48.png').convert('RGBA')
        n = 6
        fw = sheet.width // n
        strip = blockify(sheet, factor=1, colors=14, warm=0.04, sat=1.06,
                         con=1.05, trim=False, outline=True)
        strip = strip.crop((1, 1, 1 + sheet.width, 1 + sheet.height))
        sw = int(fw * PROP)
        strip = strip.resize((sw * n, int(sheet.height * PROP)), Image.NEAREST)
        strip.save(os.path.join(OUT, 'a-fountain.png'), optimize=True)
        f0 = strip.crop((0, 0, sw, strip.height))
        fx, fbase = CX, CY + int(strip.height * 0.42)
        shadow(fx, fbase - 6, sw * 0.42, 10)
        im.alpha_composite(f0, (fx - sw // 2, fbase - strip.height))
        COLLIDERS.append(('fountain', ('circle', int(sw * 0.36)), fx, fbase - 20))
        FOUNTAIN = [fx, fbase, sw, strip.height, n]
        print('fountain: %d frames of %dpx' % (n, fw))
    except Exception as e:
        print('  fountain failed:', e)

# ---- 🧃 THE MARKET ROW (storefronts face the beach road) -------------------
if HAVE_PACK:
    # the banana stand's future storefront spot — held by the biggest cart for
    # now (the stand building upgrade is its own later step)
    MARKET['stand'] = (1980, MARKET_Y + 60)
    try_place(['ME_Singles_Vehicles_48x48_Street_Food_Cart_1.png',
               'ME_Singles_Vehicles_48x48_Street_Food_Cart_2.png'],
              1980, MARKET_Y + 60, solid=CART_BOX, layer=True, colors=14)
    # 🧃 THE MERCH CART — the whole point of Park 2.0
    MARKET['cart'] = (2290, MARKET_Y + 52)
    try_place(['ME_Singles_Vehicles_48x48_Fruit_Flowers_Cart_1.png',
               'ME_Singles_Vehicles_48x48_Fruit_Flowers_Cart_2.png'],
              2290, MARKET_Y + 52, solid=CART_BOX, layer=True, colors=14)

# ---- 🛝 the playground -----------------------------------------------------
def sheet_strip(name, out_name, fw, fh=96):
    """⚠️ the playground files are each a FULL ANIMATION SHEET (Park_Swing_1 is
    1152x96 = 12 frames of 96) — round 1 pasted a whole sheet as one 'sprite'
    and the plate grew a garland. Slice, blockify ONCE, bake frame 0."""
    try:
        sheet = load_pack(name).convert('RGBA')
        n = sheet.width // fw
        s = blockify(sheet, factor=1, colors=12, warm=0.05, sat=1.08, con=1.05,
                     trim=False, outline=True)
        s = s.crop((1, 1, 1 + sheet.width, 1 + sheet.height))
        s = s.resize((int(fw * PROP) * n, int(sheet.height * PROP)), Image.NEAREST)
        s.save(os.path.join(OUT, out_name), optimize=True)
        print('  %s: %d frames' % (out_name, n))
        return s.crop((0, 0, s.width // n, s.height))
    except Exception as e:
        print('  strip failed', name, e)
        return None


if HAVE_PACK:
    sw0 = sheet_strip('Park_Swing_48x48_1.png', 'a-swing.png', 96)
    if sw0:
        for sx, sy in ((560, 800), (770, 800)):
            shadow(sx, sy - 4, sw0.width * 0.4, 8)
            im.alpha_composite(sw0, (sx - sw0.width // 2, sy - sw0.height))
            COLLIDERS.append(('swing', SWING_BOX, sx, sy))
            SWINGS.append((sx, sy, sw0.width, sw0.height))
    sp0 = sheet_strip('Spring_Swing_48x48_1.png', 'a-spring.png', 96)
    if sp0:
        for sx, sy in ((520, 920), (830, 910)):
            shadow(sx, sy - 3, sp0.width * 0.45, 6)
            im.alpha_composite(sp0, (sx - sp0.width // 2, sy - sp0.height))
            COLLIDERS.append(('spring', ('circle', 18), sx, sy))
            SWINGS.append((sx, sy, sp0.width, sp0.height))
    # picnic corner: benched tables between the swings and the meadow
    for tx, ty in ((1120, 760), (1000, 900)):
        try_place(['ME_Singles_Camping_48x48_Benched_Table_1.png',
                   'ME_Singles_Camping_48x48_Benched_Table_2.png'],
                  tx, ty, solid=TABLE_BOX, layer=True)

# ---- 🌼 the meadow: WILDFLOWERS, not city planters -------------------------
# ⚠️ round 1 scattered the City_Props Flowers_N — those are FRAMED PLANTER
# BEDS and the meadow read as a garden centre. Wildflowers are procedural:
# little 2-3px blossoms on a stem shadow, in drifts, plus a few flower BUSHES
# (the round ones) for body. Planters can return beside the shops someday.
mx0, my0, mx1, my1 = MEADOW
BLOOM = [(255, 158, 196), (255, 224, 92), (250, 250, 245), (188, 150, 244), (255, 140, 92)]
wrng = random.Random(1312)
# ⚠️ NO pack flowers at all in the meadow — Flowers_N AND Flower_Bush_N are
# both FRAMED PLANTER BOXES (round 2 still had grey beds in the grass).
# Wildflowers are drawn: a 3px blossom on a stem, in dense drifts.
def blossom(bx, by, col):
    put(bx, by + 3, (44, 88, 40))                      # stem
    put(bx, by + 2, (56, 108, 48))
    for ox in (-1, 0, 1):                              # petals: a plus-shape
        put(bx + ox, by, col)
    put(bx, by - 1, col)
    put(bx, by + 1, col)
    put(bx, by, (255, 253, 245))                       # the glint heart


for _ in range(44):                                    # drifts, not confetti
    dx_, dy_ = wrng.randrange(mx0, mx1), wrng.randrange(my0, my1)
    col = BLOOM[wrng.randrange(len(BLOOM))]
    for _ in range(wrng.randrange(6, 14)):
        blossom(dx_ + wrng.randrange(-52, 52), dy_ + wrng.randrange(-34, 34), col)
for _ in range(16):                                    # strays past the edge
    blossom(wrng.randrange(1480, mx0), wrng.randrange(680, 990),
            BLOOM[wrng.randrange(len(BLOOM))])

# ---- lamps, benches, rocks, signs -----------------------------------------
if HAVE_PACK:
    for lx, ly in ((CX - 210, CY - 150), (CX + 210, CY - 150),
                   (CX - 210, CY + 175), (CX + 210, CY + 175),
                   (1700, CY - 70), (2350, CY - 70), (CX - 60, 260), (CX + 70, 860)):
        try_place(['Street_Lamp_48x48.png', 'Street_Lamp_2_48x48.png'], lx, ly,
                  solid=('circle', 10), layer=True)
    for bx, by, fl in ((CX - 130, CY - 60, False), (CX + 130, CY - 60, True),
                       (880, 350, False), (1640, 820, True)):
        try_place(['ME_Singles_Camping_48x48_Cut_Wood_Bench_1.png',
                   'ME_Singles_Camping_48x48_Cut_Wood_Bench_2.png'],
                  bx, by, flip=fl, solid=BENCH_BOX)
    for rx_, ry_ in ((360, 540), (2600, 300), (1520, 240), (700, 1010)):
        try_place(['ME_Singles_Camping_48x48_Rock_%d.png' % rng.randrange(1, 9)],
                  rx_, ry_, solid=ROCK_BOX, scale=PROP * 0.8)
    # 🚧 the construction stubs — a DRAWN sawhorse barrier, striped like real
    # roadworks. ⚠️ NOT the pack's Signboards: they literally read "Camping"
    # (round-1 plate had the park advertising a campsite in three places).
    def build_sawhorse():
        K = 3
        w, h = 118 * K, 66 * K
        s = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(s)
        for lx in (6, 94):                                     # the A-legs
            d.polygon([(lx * K, 64 * K), ((lx + 8) * K, 64 * K), ((lx + 13) * K, 18 * K),
                       ((lx + 9) * K, 18 * K)], fill=(122, 84, 46))
            d.polygon([((lx + 10) * K, 64 * K), ((lx + 18) * K, 64 * K), ((lx + 13) * K, 18 * K),
                       ((lx + 9) * K, 18 * K)], fill=(150, 104, 58))
        d.rectangle([2 * K, 14 * K, 116 * K, 34 * K], fill=(240, 214, 74))   # the plank
        for i in range(-2, 12):                                # hazard stripes
            x0 = (2 + i * 12) * K
            d.polygon([(x0, 34 * K), (x0 + 6 * K, 34 * K), (x0 + 14 * K, 14 * K),
                       (x0 + 8 * K, 14 * K)], fill=(34, 32, 38))
        d.rectangle([2 * K, 14 * K, 116 * K, 17 * K], fill=(252, 236, 140))  # lit top
        return blockify(s, factor=K, colors=8, alpha_thresh=0.4, sat=1.05,
                        con=1.05, warm=0.02, trim=False)

    saw = build_sawhorse()
    for sx, sy in ((BOUND + 120, CY - 4), (CX + 2, BOUND + 122)):
        shadow(sx, sy - 4, saw.width * 0.38, 7)
        im.alpha_composite(saw, (sx - saw.width // 2, sy - saw.height))
        COLLIDERS.append(('sawhorse', ('rect', -44, -18, 44, 4), sx, sy))
        SIGNS.append((sx, sy))

# ---- emit the contract ----------------------------------------------------
def emit_geo():
    ob_rects, ob_circles = [], []
    for name, shape, cx, base in COLLIDERS:
        if shape[0] == 'rect':
            _, a, b, c, d = shape
            ob_rects.append((cx + a, base + b, cx + c, base + d))
        elif shape[0] == 'circle':
            ob_circles.append((cx, base, shape[1]))
    L = []
    L.append('// GENERATED by tools/build-park-scene.py — DO NOT EDIT.')
    L.append('// Every collider here was declared on the place() call that drew its prop.')
    L.append('export const WORLD = { w: %d, h: %d };' % (W, H))
    L.append('export const BOUND = %d;' % BOUND)
    L.append('export const PLAZA = { x: %d, y: %d, rx: %d, ry: %d };' % (CX, CY, PLAZA_RX, PLAZA_RY))
    L.append('export const ROAD_W = %d;' % ROAD_W)
    L.append('export const POND = { x: %d, y: %d, rx: %d, ry: %d };' % POND)
    L.append('export const FOUNTAIN = %s;' % (list(FOUNTAIN) or 'null'))
    L.append('export const MARKET = %s;' % ('{ stand: %s, cart: %s }' %
             (list(MARKET.get('stand', ())), list(MARKET.get('cart', ())))))
    L.append('export const SWINGS = %s;' % [list(s) for s in SWINGS])
    L.append('export const SIGNS = %s;' % [list(s) for s in SIGNS])
    L.append('export const MEADOW = %s;' % list(MEADOW))
    L.append('export const DOORS = { south: { x: %d, y: %d }, east: { x: %d, y: %d } };'
             % (CX, H - 40, W - 60, CY))
    L.append('export const OB_RECTS = %s;' % [list(r) for r in ob_rects])
    L.append('export const OB_CIRCLES = %s;' % [list(c) for c in ob_circles])
    L.append('export const OVERLAYS = %s;' % [[o[0], o[1], o[2], o[3], o[4], o[5]] for o in OVERLAYS])
    path = os.path.join(SITE, 'src', 'scripts', 'park-geo.js')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(L) + '\n')
    print('wrote park-geo.js  (%d rects, %d circles, %d overlays)'
          % (len(ob_rects), len(ob_circles), len(OVERLAYS)))


emit_geo()
im.convert('RGB').save(os.path.join(OUT, 'park.png'), optimize=True)
print('wrote park.png (%dx%d) %.0f KB' % (W, H, os.path.getsize(os.path.join(OUT, 'park.png')) / 1024.0))
