# -*- coding: utf-8 -*-
"""🏡 THE HOMESTEAD — M0 scene art (homestead-plan, task #106).

Park-template build (build-park-scene.py is the constitution): true top-down
plate, pack art at PROP scale, colliders declared on placement and emitted
into src/scripts/homestead-geo.js. The M0 twist vs every other area:
DECOR IS NOT BAKED. Each catalog item exports as its own d-<id>.png and the
manifest src/data/decor.js is GENERATED here (footprints measured from the
actual sprites, so they can never drift).

Layout: a forest clearing. Road enters from the EAST edge (the park is that
way), through a gate in a Fence_1 rectangle. Inside: open lawn (the placement
plot), one tilled soil bed (4 slots, reuses the park's crop sprites), the
tent spot (stage 1, client-drawn). Mailbox + signpost by the gate.

Outputs:
  public/assets/homestead/homestead.png   the 1800x1100 plate
  public/assets/homestead/ov-*.png        y-sorted fixture overlays
  public/assets/homestead/d-*.png         the decor CATALOG sprites
  src/scripts/homestead-geo.js            the contract with the engine
  src/data/decor.js                       the decor manifest (generated)
Run: python tools/build-homestead-scene.py
"""
import math
import os
import random
import sys
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blockify import load_pack, blockify

PACK = os.path.expanduser(r'~\OneDrive\banana-art-pack\Modern_Exteriors_48x48')
FARM = os.path.expanduser(r'~\OneDrive\banana-art-pack\Modern_Farm_v1.2\48x48')
HAVE_PACK = os.path.isdir(PACK)
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SITE, 'public', 'assets', 'homestead')
os.makedirs(OUT, exist_ok=True)
rng = random.Random(2026)

T = 48
W, H = 1800, 1100
PROP = 0.76                      # the world's heroic-banana scale rule
BOUND = 96

# ---- GEO: the contract ----------------------------------------------------
# ⚠️ THE ROAD RUNS ALONG THE BOTTOM (Trym, 3 Aug): the pack's buildings and
# tents all FACE SOUTH, so the approach must be bottom-up — you walk PAST the
# property and turn in through the south gate, never sideways into it. The
# road crosses the whole map: east end = the park, west end = nowhere yet
# (bushes + a sawhorse, the park's own under-construction language).
ROAD_Y = 900                     # the bottom road's spine
ROAD_HW = 44
# 🌱 LAND GROWS WITH THE LADDER (Trym, 3 Aug): the tent gets a cosy corner,
# a real roof pushes the fence out, the house takes the whole clearing.
# Nested tile rects sharing the SOUTH-EAST corner and the ONE gate — growth
# only ever ADDS land, so nothing placed can be orphaned by an upgrade.
FENCE_TIERS = {1: (17, 9, 27, 16), 2: (12, 7, 27, 16), 3: (7, 5, 27, 16)}
FX0, FY0, FX1, FY1 = FENCE_TIERS[3]        # the outer property line
GATE_COLS = (23, 24)             # SOUTH-side gap → x 1104..1200 (walk up + in)
GATE_X = (GATE_COLS[0] + 1) * T  # the gap's centre ≈ 1152
FENCE_PX = (FX0 * T, FY0 * T, (FX1 + 1) * T, (FY1 + 1) * T)


def tier_plot(t):
    fx0, fy0, fx1, fy1 = FENCE_TIERS[t]
    return (fx0 * T + T, fy0 * T + T + 14, (fx1 + 1) * T - T, (fy1 + 1) * T - T)


PLOT = tier_plot(3)
TENT = (1000, 560)               # (cx, base) — INSIDE the tier-1 yard
BED_DEF = (1010, 730)            # ditto — the starter bed's home
MAILBOX_AT = (1252, 850)         # OUTSIDE the fence, on the road by the gate
SIGN_AT = (1010, 850)            # outside, on the road's north shoulder
SAWHORSE_AT = (185, 886)         # the west end goes nowhere yet
SPAWN = (W - 150, ROAD_Y)        # arrive walking in from the park side

im = Image.new('RGBA', (W, H), (86, 152, 74, 255))
px = im.load()


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


# ---- the lawn (park recipe: flat clean autotile fills, scrubbed) ----------
def tile_stats(t):
    p = t.load()
    specks = sum(1 for y in range(0, T, 2) for x in range(0, T, 2)
                 if p[x, y][0] > p[x, y][1] + 8)
    rm = lambda y: sum(p[x, y][1] for x in range(T)) / float(T)
    cm = lambda x: sum(p[x, y][1] for y in range(T)) / float(T)
    edge = abs(rm(2) - rm(T - 3)) + abs(cm(2) - cm(T - 3))
    vals = [p[x, y][1] for y in range(0, T, 3) for x in range(0, T, 3)]
    mean = sum(vals) / float(len(vals))
    tex = sum((v - mean) ** 2 for v in vals) / float(len(vals))
    return specks, edge, tex


def scrubbed(tile):
    t = tile.copy()
    p = t.load()
    greens = sorted((p[x, y] for y in range(T) for x in range(T)
                     if p[x, y][1] >= p[x, y][0] - 6 and p[x, y][1] >= p[x, y][2] - 6),
                    key=lambda c: c[0] + c[1] + c[2])
    med = greens[len(greens) // 2] if greens else (86, 152, 74, 255)
    for y in range(T):
        for x in range(T):
            r, g, b, a = p[x, y]
            if r > g + 8 or (r > 120 and g < 140):
                p[x, y] = med
    return t


GRASSES = [Image.new('RGBA', (T, T), (86, 152, 74, 255))]
if HAVE_PACK:
    cand = []
    for fam, hi in (('Grass_1', 23), ('Grass_2', 22), ('Grass_3', 22)):
        for i in range(1, hi):
            try:
                t = load_pack('ME_Singles_Terrains_and_Fences_48x48_%s_%d.png' % (fam, i)).convert('RGBA')
            except Exception:
                continue
            if t.size != (T, T):
                continue
            sp, ed, tx = tile_stats(t)
            if sp <= 4 and ed < 10:
                cand.append((tx, t))
    cand.sort(key=lambda c: -c[0])
    GRASSES = [scrubbed(t) for _, t in cand[:3]] or GRASSES

for ty in range(0, H // T + 1):
    for tx in range(0, W // T + 1):
        t = GRASSES[rng.randrange(len(GRASSES))]
        if rng.random() < 0.5:
            t = t.transpose(Image.FLIP_LEFT_RIGHT)
        im.alpha_composite(t, (tx * T, ty * T))
# soft mown lanes (wide vertical bands, barely-there) so the lawn isn't one sheet
for x in range(0, W):
    if (x // 96) % 2:
        continue
    for y in range(0, H):
        r, g, b, a = px[x, y]
        if g > r and g > b:                  # grass pixels only
            px[x, y] = (r, min(255, g + 3), b, a)

# ---- 🌿 THE LIFE PASS (the park's recipe, Trym: "no variation… very basic")
# tufts + green patches + lifted flower pixels, all OFF the tile grid so
# nothing reads as a pattern. ⚠️ Props_Grass verdict corrected: 1/2/3/8/9 are
# the clean GREEN patches the park itself scatters — 12/13 were the orange
# baked-background ones that got the family banned here.
grng = random.Random(7)
if HAVE_PACK:
    TUFT = None
    try:
        TUFT = load_pack('ME_Singles_Graveyard_48x48_Grass_Tufts.png').convert('RGBA')
        tp = TUFT.load()          # graveyard tufts are dead-grey — retint by luma
        for y in range(TUFT.height):
            for x in range(TUFT.width):
                r0, g0, b0, a0 = tp[x, y]
                if a0:
                    k = (0.3 * r0 + 0.6 * g0 + 0.1 * b0) / 120.0
                    tp[x, y] = (int(min(255, 62 * k)), int(min(255, 128 * k)),
                                int(min(255, 56 * k)), a0)
    except Exception:
        pass
    PATCHES = []
    for i in (1, 2, 3, 8, 9):
        try:
            PATCHES.append(load_pack('ME_Singles_Terrains_and_Fences_48x48_Props_Grass_%d.png' % i).convert('RGBA'))
        except Exception:
            pass
    for _ in range(45):
        if not PATCHES:
            break
        im.alpha_composite(PATCHES[grng.randrange(len(PATCHES))],
                           (grng.randrange(20, W - 60), grng.randrange(20, H - 60)))
    if TUFT:
        for _ in range(220):
            t2 = TUFT.transpose(Image.FLIP_LEFT_RIGHT) if grng.random() < 0.5 else TUFT
            im.alpha_composite(t2, (grng.randrange(10, W - 58), grng.randrange(10, H - 58)))
    FLOWER_STAMPS = []
    for i in range(1, 16):
        try:
            t = load_pack('ME_Singles_Terrains_and_Fences_48x48_Grass_Wall_1_Flowered_%d.png' % i).convert('RGBA')
        except Exception:
            continue
        p = t.load()
        st = [(x, y, p[x, y]) for y in range(t.height) for x in range(t.width)
              if p[x, y][3] and sum(p[x, y][:3]) > 330
              and not (p[x, y][1] > p[x, y][0] and p[x, y][1] > p[x, y][2])]
        if 6 < len(st) < 260:
            FLOWER_STAMPS.append(st)
    for _ in range(22):
        if not FLOWER_STAMPS:
            break
        ox, oy = grng.randrange(60, W - 100), grng.randrange(60, H - 100)
        for x, y, col in FLOWER_STAMPS[grng.randrange(len(FLOWER_STAMPS))]:
            put(ox + x, oy + y, col)

# the park's soft afternoon grade — greens lifted warm
GRASS_TARGET = (128, 186, 96)
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        if g > r - 10 and g > b:
            k = 0.30
            px[x, y] = (int(r * 0.7 + GRASS_TARGET[0] * k), int(g * 0.7 + GRASS_TARGET[1] * k),
                        int(b * 0.7 + GRASS_TARGET[2] * k), a)

# ---- 🛣 the bottom road: the park's wobble/taper/rim bake, not a flat band --
ROAD_C, ROAD_S, ROAD_RIM = (208, 178, 128), (196, 166, 116), (122, 108, 62)
_rrng = random.Random(4242)
_road_mask = bytearray(W * H)


def road_pts(pts, hw, taper=(True, True)):
    out, s = [], 0.0
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        seg = math.hypot(x1 - x0, y1 - y0)
        if seg < 1:
            continue
        nx, ny = (x1 - x0) / seg, (y1 - y0) / seg
        px_, py_ = -ny, nx
        for t in range(int(seg)):
            wob = 7.5 * math.sin(s / 88.0) + 2.4 * math.sin(s / 21.0)
            out.append([int(x0 + nx * t + px_ * wob), int(y0 + ny * t + py_ * wob),
                        px_, py_, hw])
            s += 1
    n = len(out)
    for i in range(min(44, n // 2)):
        k = 0.30 + 0.70 * (i / 44.0)
        if taper[0]:
            out[i][4] = max(4, hw * k)
        if taper[1]:
            out[n - 1 - i][4] = max(4, hw * k)
    return [tuple(p) for p in out]


def road_mask_add(spine):
    m = _road_mask
    for (cx_, cy_, _, _, hw) in spine:
        r = int(hw) + 2
        for dy in range(-r, r + 1):
            y = cy_ + dy
            if not (0 <= y < H):
                continue
            row = y * W
            for dx in range(-r, r + 1):
                x = cx_ + dx
                if not (0 <= x < W):
                    continue
                v = int(hw + 2 - math.hypot(dx, dy))
                if v > 0 and v > m[row + x]:
                    m[row + x] = 255 if v > 255 else v


road_mask_add(road_pts([(120, ROAD_Y), (620, ROAD_Y - 8), (1150, ROAD_Y + 6), (1800, ROAD_Y - 4)],
                       36, taper=(True, False)))                  # W dies in the woods, E = the park
# the turn-in flows THROUGH the gate opening and feathers out on the lawn —
# a blunt full-width end read as "a hard cut, no fading" (Trym's screenshot)
road_mask_add(road_pts([(GATE_X, FENCE_PX[3] - 70), (GATE_X - 5, (FENCE_PX[3] + ROAD_Y) // 2), (GATE_X, ROAD_Y)],
                       20, taper=(True, False)))
for y in range(H):
    row = y * W
    for x in range(W):
        v = _road_mask[row + x]
        if not v:
            continue
        if v >= 5:
            put(x, y, ROAD_S if _rrng.random() < 0.20 else ROAD_C)
        elif _rrng.random() < 0.18 * v:
            put(x, y, ROAD_RIM)

# ---- the fence: Fence_1 autotiles, classified by edge connectivity --------
COLLIDERS = []                   # (shape) rects in world px
OVERLAYS = []


# 🪵 THE WOODEN FENCE — Modern Farm's Wooden_Fence_Type_1_Brown kit (Trym:
# "the fence can be wooden"). Grammar MEASURED from post spans, and it is
# elegant: zero pixel offsets anywhere.
#   1 = left-end run (wide left post IS the corner) · 3 = right-end run
#   2/6 = mid runs · 8 = WEST vertical (post x0-20 = the left-post column)
#   4 = EAST vertical (post x24-44 = the right-post column) — verticals sit in
#   the SAME tile column as the run ends, never one column outside
#   7 = south-left junction (top nub over the left post) · 5 = south-right
#   Single_1/2 = the gate's posts
import glob as _glob


def farm_sprite(name):
    fs = _glob.glob(os.path.join(FARM, '**', name), recursive=True)
    return Image.open(fs[0]).convert('RGBA') if fs else None


def fence_kit():
    kit = {}
    for k, n in (('h', '2'), ('h2', '6'), ('endl', '1'), ('endr', '3'),
                 ('v_w', '8'), ('v_e', '4'), ('jl', '7'), ('jr', '5'),
                 ('gl', 'Single_1'), ('gr', 'Single_2')):
        kit[k] = farm_sprite('Wooden_Fence_Type_1_Brown_%s_48x48.png' % n)
    print('fence kit:', {k: ('ok' if v else 'MISSING') for k, v in kit.items()})
    return kit


# 🌱 the fence is CLIENT-DRAWN per tier now, never baked: the engine swaps
# ov-fyard<t> (north + verticals, low z) and ov-fsouth<t> (the south row,
# y-sorted so it overflows the banana) when the land grows. Colliders ride
# each tier's entry in FENCE_TIERS_OUT.
FENCE_TIERS_OUT = {}


def lay_fence_tier(kit, tier):
    fx0, fy0, fx1, fy1 = FENCE_TIERS[tier]
    yard = Image.new('RGBA', ((fx1 + 1 - fx0) * T, (fy1 - fy0) * T), (0, 0, 0, 0))
    south = Image.new('RGBA', ((fx1 + 1 - fx0) * T, T + 8), (0, 0, 0, 0))

    def stamp(tile, tx, ty):
        if not tile:
            return
        if ty == fy1:
            south.alpha_composite(tile, ((tx - fx0) * T, ty * T - (fy1 * T - 4)))
        else:
            yard.alpha_composite(tile, ((tx - fx0) * T, (ty - fy0) * T))
    # north: end pieces carry the corners themselves
    stamp(kit['endl'], fx0, fy0)
    for tx in range(fx0 + 1, fx1):
        stamp(kit['h'] if tx % 2 else kit['h2'], tx, fy0)
    stamp(kit['endr'], fx1, fy0)
    # verticals live in the SAME columns as the run ends
    for ty in range(fy0 + 1, fy1):
        stamp(kit['v_w'], fx0, ty)
        stamp(kit['v_e'], fx1, ty)
    # south: junction ends (nub where the vertical arrives) + the gate posts
    stamp(kit['jl'], fx0, fy1)
    for tx in range(fx0 + 1, fx1):
        if tx in GATE_COLS:
            continue
        if tx == GATE_COLS[0] - 1:
            stamp(kit['gl'], tx, fy1)
        elif tx == GATE_COLS[-1] + 1:
            stamp(kit['gr'], tx, fy1)
        else:
            stamp(kit['h'] if tx % 2 else kit['h2'], tx, fy1)
    stamp(kit['jr'], fx1, fy1)
    yard.save(os.path.join(OUT, 'ov-fyard%d.png' % tier), optimize=True)
    south.save(os.path.join(OUT, 'ov-fsouth%d.png' % tier), optimize=True)
    # colliders from the measured post columns
    mid = 18
    cy0, cy1 = fy0 * T + mid, fy1 * T + mid
    cols = [
        (fx0 * T, cy0, (fx1 + 1) * T, cy0 + 14),                   # north
        # ⚠️ the south band reaches BELOW the fence base (Trym ×2): stopping at
        # the band's inner edge parked the banana's feet ON the pickets when
        # approaching from the road — the outside stop line must sit past the
        # art (feet ≥ base+4) so the walker halts IN FRONT of the fence, where
        # the painter's order also draws it in front.
        (fx0 * T, cy1, GATE_COLS[0] * T, cy1 + 34),                # south L of gate
        ((GATE_COLS[-1] + 1) * T, cy1, (fx1 + 1) * T, cy1 + 34),   # south R of gate
        (fx0 * T + 2, cy0, fx0 * T + 20, cy1),                     # west posts
        (fx1 * T + 24, cy0, fx1 * T + 44, cy1),                    # east posts
    ]
    FENCE_TIERS_OUT[tier] = {
        'fence': [fx0 * T, fy0 * T, (fx1 + 1) * T, (fy1 + 1) * T],
        'plot': list(tier_plot(tier)),
        'cols': [list(map(int, c)) for c in cols],
        'yard': ['ov-fyard%d.png' % tier, fx0 * T, fy0 * T, yard.width, yard.height, fy0 * T + 32],
        'south': ['ov-fsouth%d.png' % tier, fx0 * T, fy1 * T - 4, south.width, south.height, (fy1 + 1) * T],
    }
    print('  fence tier %d: ov-fyard%d + ov-fsouth%d' % (tier, tier, tier))


if HAVE_PACK:
    _kit = fence_kit()
    if _kit['h'] and _kit['v_w']:
        for _t in (1, 2, 3):
            lay_fence_tier(_kit, _t)

# ---- 🪏 the soil CELL: dig-your-own patches (Trym: "dig your own brown
# bed-patches, not locked to that flat basic square"). One 48px tile, darker
# 2px rim — adjacent cells meet rim-to-rim and the seams read as furrows.
BED_W, BED_H = 280, 100          # legacy geometry, kept for old-save migration
soil_im = Image.new('RGBA', (T, T), (0, 0, 0, 0))
sp_ = soil_im.load()
for y in range(T):
    for x in range(T):
        edge = x < 2 or x >= T - 2 or y < 2 or y >= T - 2
        if edge:
            sp_[x, y] = (82, 62, 40, 255)
        else:
            j = rng.randrange(-8, 9)
            c = (120 + j, 90 + j, 56 + j, 255)
            if (y % 12) < 2:
                c = (98, 74, 46, 255)
            elif rng.random() < 0.04:
                c = (88, 66, 42, 255)
            sp_[x, y] = c
soil_im.save(os.path.join(OUT, 's-soil.png'), optimize=True)
print('  s-soil.png %dx%d' % (T, T))

# ---- fixtures: mailbox + signpost (baked, layered, solid) ------------------
def dedisc(img):
    img = img.convert('RGBA')
    p = img.load()
    h = img.height
    if h < 100:
        return img
    for y in range(int(h * 0.84), h):
        for x in range(img.width):
            r, g, b, a = p[x, y]
            if a and g > r + 38 and g > 108 and r < 92:
                p[x, y] = (0, 0, 0, 0)
    return img


def sprite(names, colors=28, scale=PROP):
    for n in (names if isinstance(names, (list, tuple)) else [names]):
        try:
            img = Image.open(n).convert('RGBA') if os.path.isabs(n) else load_pack(n)
            s = blockify(dedisc(img), factor=1, colors=colors)
            if scale != 1.0:
                s = s.resize((max(1, int(s.width * scale)), max(1, int(s.height * scale))),
                             Image.NEAREST)
            return s
        except Exception:
            continue
    print('  MISSING all of', names)
    return None


def fixture(names, cx, base, solid=None, sh=0.30):
    s = sprite(names)
    if s is None:
        return
    shadow(cx + s.width * 0.06, base - s.height * 0.02, s.width * sh,
           max(4, s.height * 0.055))
    box = (int(cx - s.width // 2), int(base - s.height))
    im.alpha_composite(s, box)
    fn = 'ov-%d.png' % len(OVERLAYS)
    s.save(os.path.join(OUT, fn), optimize=True)
    OVERLAYS.append((fn, box[0], box[1], s.width, s.height, int(base)))
    if solid:
        a, b2, c, d = solid
        COLLIDERS.append((cx + a, base + b2, cx + c, base + d))


if HAVE_PACK:
    fixture(['22_Post_Office_48x48_Red_Mailbox_1_Side_1.png',
             '22_Post_Office_48x48_Blue_Mailbox_1_Side_1.png',
             '22_Post_Office_48x48_Big_Blue_Mailbox.png'],
            MAILBOX_AT[0], MAILBOX_AT[1], solid=(-14, -12, 14, 2))
    fixture(['ME_Singles_Camping_48x48_Wooden_Sign_1.png',
             'ME_Singles_Camping_48x48_Sign_1.png',
             'ME_Singles_City_Props_48x48_Sign_1.png'],
            SIGN_AT[0], SIGN_AT[1], solid=(-16, -10, 16, 2))

# ---- the forest ring: the clearing's walls (open on the road side) ---------
BIG_TREES = ['ME_Singles_Camping_48x48_Tree_%d.png' % n for n in (1, 2, 3, 13, 14, 15, 16, 17, 18)]
SPECIES = [BIG_TREES[0:3], BIG_TREES[3:6], BIG_TREES[6:9]]
BUSHES = ['ME_Singles_Garden_48x48_Bush_%d.png' % n for n in (1, 2, 3, 4)]


def tree(names, cx, base):
    s = sprite(names, scale=PROP)
    if s is None:
        return
    im.alpha_composite(s, (int(cx - s.width // 2), int(base - s.height)))


if HAVE_PACK:
    # north band + a south band BELOW the road (crowns peek along the bottom)
    for y0, y1 in ((150, 60), (H + 60, H + 110)):
        x = 40
        while x < W - 60:
            fam = SPECIES[int(x / 460) % len(SPECIES)]
            tree(fam[rng.randrange(3)], x + rng.randrange(-18, 18), y0 + rng.randrange(-12, 12))
            tree(fam[rng.randrange(3)], x + 56 + rng.randrange(-18, 18), y1 + rng.randrange(-10, 10))
            if rng.random() < 0.4:
                tree(BUSHES[rng.randrange(len(BUSHES))], x + rng.randrange(0, 90),
                     max(y0, y1) + 30 + rng.randrange(-8, 8))
            x += 112
    # west band (vertical)
    y = 220
    while y < H - 120:
        fam = SPECIES[int(y / 380) % len(SPECIES)]
        tree(fam[rng.randrange(3)], 50 + rng.randrange(-14, 14), y + rng.randrange(-10, 10))
        tree(fam[rng.randrange(3)], 118 + rng.randrange(-14, 14), y + 58 + rng.randrange(-10, 10))
        y += 118

# ---- 🚧 the west end goes nowhere yet: sawhorse + bushes ------------------
def build_sawhorse():
    K = 3
    w, h = 118 * K, 66 * K
    s2 = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(s2)
    for lx in (6, 94):
        d.polygon([(lx * K, 64 * K), ((lx + 8) * K, 64 * K), ((lx + 13) * K, 18 * K),
                   ((lx + 9) * K, 18 * K)], fill=(122, 84, 46))
        d.polygon([((lx + 10) * K, 64 * K), ((lx + 18) * K, 64 * K), ((lx + 13) * K, 18 * K),
                   ((lx + 9) * K, 18 * K)], fill=(150, 104, 58))
    d.rectangle([2 * K, 14 * K, 116 * K, 34 * K], fill=(240, 214, 74))
    for i in range(-2, 12):
        x0 = (2 + i * 12) * K
        d.polygon([(x0, 34 * K), (x0 + 6 * K, 34 * K), (x0 + 14 * K, 14 * K),
                   (x0 + 8 * K, 14 * K)], fill=(34, 32, 38))
    d.rectangle([2 * K, 14 * K, 116 * K, 17 * K], fill=(252, 236, 140))
    return blockify(s2, factor=K, colors=8, alpha_thresh=0.4, sat=1.05,
                    con=1.05, warm=0.02, trim=False)


if HAVE_PACK:
    saw = build_sawhorse()
    sx, sy = SAWHORSE_AT
    shadow(sx, sy - 4, saw.width * 0.38, 7)
    im.alpha_composite(saw, (sx - saw.width // 2, sy - saw.height))
    COLLIDERS.append((sx - 44, sy - 18, sx + 44, sy + 4))
    for bx, by in ((110, 950), (150, 830), (250, 950), (95, 880)):
        tree(BUSHES[rng.randrange(len(BUSHES))], bx, by)

# (a tuft-scatter pass was tried and CUT — the Props_Grass singles carry baked
# square backgrounds and read as postage stamps on our lawn. The mow lanes +
# forest + the visitor's own decor carry the texture instead.)

# ---- 🎁 THE DECOR CATALOG — exported sprites + the GENERATED manifest ------
# (id, display name, category, price, stage gate, candidates, solid?)
DECOR_DEF = [
    # ── stage 0: the starter shelf ──
    ('sunflower', 'Sunflower', 'garden', 8, 0, ['ME_Singles_Garden_48x48_Big_Sunflower.png'], False),
    ('redflower', 'Red flower', 'garden', 8, 0, ['ME_Singles_Garden_48x48_Big_Red_Flower.png'], False),
    ('blueflower', 'Blue flower', 'garden', 8, 0, ['ME_Singles_Garden_48x48_Big_Light_Blue_Flower.png'], False),
    ('whiteflower', 'White flower', 'garden', 8, 0, ['ME_Singles_Garden_48x48_Big_White_Flower.png'], False),
    ('pinkvase', 'Pink flower vase', 'garden', 12, 0, ['ME_Singles_Garden_48x48_Big_Pink_Flower_Vase.png'], True),
    ('bluevase', 'Blue flower vase', 'garden', 12, 0, ['ME_Singles_Garden_48x48_Big_Light_Blue_Flower_Vase.png'], True),
    ('bush', 'Bush', 'nature', 6, 0, ['ME_Singles_Garden_48x48_Bush_1.png'], True),
    ('bush2', 'Round bush', 'nature', 6, 0, ['ME_Singles_Garden_48x48_Bush_5.png'], True),
    ('stump', 'Stump seat', 'nature', 6, 0, ['ME_Singles_Camping_48x48_Stump_1.png'], True),
    ('mushrooms', 'Mushroom patch', 'nature', 7, 0, ['ME_Singles_Camping_48x48_Mushrooms_1.png'], False),
    ('flowerbush', 'Flower bush', 'nature', 9, 0, ['ME_Singles_City_Props_48x48_Flower_Bush_1.png'], True),
    ('lantern', 'Camp lantern', 'lighting', 10, 0, ['ME_Singles_Camping_48x48_Lantern_1.png'], True),
    # ── stage 1: the tent is up ──
    ('bench', 'Garden bench', 'furniture', 18, 1, ['ME_Singles_Garden_48x48_Big_Bench_Horizontal.png'], True),
    ('benchv', 'Side bench', 'furniture', 18, 1, ['ME_Singles_Garden_48x48_Big_Bench_Vertical.png'], True),
    ('table', 'Picnic table', 'furniture', 22, 1, ['ME_Singles_Camping_48x48_Benched_Table_1.png'], True),
    ('chair', 'Camp chair', 'furniture', 12, 1, ['ME_Singles_Camping_48x48_Chair_1.png'], True),
    ('armchair', 'Armchair', 'furniture', 16, 1, ['ME_Singles_Camping_48x48_Armchair_1.png'], True),
    ('campfire', 'Campfire', 'lighting', 15, 1, ['ME_Singles_Camping_48x48_Campfire_1.png'], True),
    ('marshfire', 'Marshmallow fire', 'lighting', 20, 1, ['ME_Singles_Camping_48x48_Campfire_Marshmallow_1.png'], True),
    ('lantern2', 'Tall lantern', 'lighting', 14, 1, ['ME_Singles_Camping_48x48_Lantern_2.png'], True),
    ('scarecrow', 'Scarecrow', 'farm', 25, 1, [os.path.join(FARM, 'Single_Files_48x48', 'Props_and_Buildings_48x48', 'Scarecrow_48x48.png')], True),
    ('bananacrate', 'Banana crate', 'farm', 15, 1, [os.path.join(FARM, 'Single_Files_48x48', 'Fruit_Trees_48x48', 'Crate_Brown_Bananas_48x48.png')], True),
    ('flowerbush2', 'Rose bush', 'nature', 11, 1, ['ME_Singles_City_Props_48x48_Flower_Bush_4.png'], True),
    # ── stage 2: the cabin ──
    ('statue', 'Angel statue', 'display', 40, 2, ['ME_Singles_Garden_48x48_Angel_Statue_1.png'], True),
    ('statue2', 'Praying angel', 'display', 40, 2, ['ME_Singles_Garden_48x48_Angel_Statue_2.png'], True),
    ('shelf', 'Garden shelf', 'display', 30, 2, ['ME_Singles_Garden_48x48_Big_Shelf.png'], True),
    ('coop', 'Chicken coop', 'farm', 45, 2, [os.path.join(FARM, 'Single_Files_48x48', 'Props_and_Buildings_48x48', 'Chicken_Coop_48x48.png')], True),
    ('crate', 'Apple crate', 'farm', 12, 2, [os.path.join(FARM, 'Single_Files_48x48', 'Fruit_Trees_48x48', 'Crate_Brown_Apples_48x48.png')], True),
    ('sprout', 'Big sprout', 'garden', 14, 2, ['ME_Singles_Garden_48x48_Big_Sprout_1.png'], False),
    ('sproutvase', 'Sprout vase', 'garden', 16, 2, ['ME_Singles_Garden_48x48_Big_Sprout_Vase_1.png'], True),
    # ── stage 3: the house ──
    ('birdhouse', 'Little bird house', 'garden', 15, 1, ['ME_Singles_Garden_48x48_Red_Little_Bird_House.png'], True),
    ('birdhouse2', 'Big bird house', 'garden', 30, 2, ['ME_Singles_Garden_48x48_Blue_Big_Bird_House.png'], True),
    ('fountain', 'Stone fountain', 'display', 80, 3, ['ME_Singles_Garden_48x48_Fountain_1_1.png'], True),
    ('sunvase', 'Sunflower vase', 'garden', 20, 3, ['ME_Singles_Garden_48x48_Big_Sunflower_Vase.png'], True),
    ('whitevase', 'White flower vase', 'garden', 20, 3, ['ME_Singles_Garden_48x48_Big_White_Flower_Vase.png'], True),
]

# 🔎 THE CRISP RULE (Trym: "scarecrow blurry, statue crisp"): both packs'
# "48x48" art is 3×-CHUNKY — every art pixel is a 3×3 block (Farm files are
# 144px). An export scale off the 1/3 grid shears those blocks unevenly and
# bakes mud into the PNG. So decor lives ON the grid: 2/3 default (crisp, and
# a notch smaller than the old 0.76 — the lanterns' "a bit large"), 1/3 for
# the big builds. The statues keep Trym-approved 0.30 ("right size, crisp").
DECOR_DEFAULT = 2 / 3.0
DECOR_SCALE = {'statue': 0.30, 'statue2': 0.30, 'coop': 1 / 3.0,
               'fountain': 2 / 3.0, 'shelf': 2 / 3.0}

DECOR_OUT = []
if HAVE_PACK:
    for did, name, cat, price, stage, cands, solid in DECOR_DEF:
        s = sprite(cands, scale=DECOR_SCALE.get(did, DECOR_DEFAULT))
        if s is None:
            continue
        s.save(os.path.join(OUT, 'd-%s.png' % did), optimize=True)
        hw = max(10, int(s.width * 0.38))
        box = [-hw, -12, hw, 2] if solid else None
        DECOR_OUT.append((did, name, cat, price, stage, s.width, s.height, box))
        print('  d-%s.png %dx%d' % (did, s.width, s.height))
    assert len(DECOR_OUT) >= 10, 'decor catalog too thin: %d' % len(DECOR_OUT)

# ── 🏠 THE STRUCTURE STYLES ── every rung is a WARDROBE (Trym: "build the
# picker with all of them"). Each style exports ov-<key>.png; sizes are
# measured and emitted, so the engine handles any footprint. Scales normalise
# HEIGHT per rung so every option reads as the same tier.
def _rung_scale(target_h):
    def f(im):
        return min(0.6, target_h / float(im.height))
    return f


FARMB = os.path.join(FARM, 'Single_Files_48x48', 'Props_and_Buildings_48x48')
STRUCT_VARIANTS = {}
STRUCT_VARIANTS[1] = [('tent%d' % i, ['ME_Singles_Camping_48x48_Tent_%d.png' % i], PROP)
                      for i in range(1, 7)]
STRUCT_VARIANTS[2] = (
    [('mob%d' % i, ['ME_Singles_Camping_48x48_Mobile_House_Big_%d.png' % i], _rung_scale(200))
     for i in range(1, 9)]
    + [('mobm%d' % i, ['ME_Singles_Camping_48x48_Mobile_House_Medium_%d.png' % i], _rung_scale(185))
       for i in range(1, 9)]
    + [('barn', [os.path.join(FARMB, 'Barn_Small_48x48.png')], 0.52)]
    + [('hloft%s' % c.lower(), [os.path.join(FARMB, 'Front_Hayloft_%s_48x48.png' % c)], _rung_scale(210))
       for c in ('Green', 'Grey', 'Red', 'Yellow')]
)
STRUCT_VARIANTS[3] = (
    [('country', ['24_Additional_Houses_Country_House_48x48.png'], 0.42),
     ('haunted', ['24_Additional_Houses_Haunted_House_48x48.png'], _rung_scale(330)),
     ('japanese', ['24_Additional_Houses_Japanese_House_48x48.png'], _rung_scale(330))]
    + [('villa%d' % i, ['ME_Singles_Villas_48x48_Villa_%d.png' % i], _rung_scale(330))
       for i in range(1, 6)]
    + [('condoa', ['ME_Singles_Generic_Building_48x48_Condo_Example.png'], _rung_scale(340)),
       ('condo6', ['ME_Singles_Generic_Building_48x48_Condo_6_Example.png'], _rung_scale(340)),
       ('condo9', ['ME_Singles_Generic_Building_48x48_Condo_9_Example.png'], _rung_scale(320))]
)

STRUCT_SIZES = {}
STRUCT_STYLES = {}
if HAVE_PACK:
    for rung, variants in STRUCT_VARIANTS.items():
        keys = []
        for key, cands, sc in variants:
            # measure first when the scale depends on the native size
            probe = None
            for n in cands:
                try:
                    probe = Image.open(n).convert('RGBA') if os.path.isabs(n) else load_pack(n)
                    break
                except Exception:
                    continue
            if probe is None:
                print('  MISSING style', key, cands)
                continue
            scale = sc(probe) if callable(sc) else sc
            sp = sprite(cands, scale=scale)
            if sp is None:
                continue
            sp.save(os.path.join(OUT, 'ov-%s.png' % key), optimize=True)
            STRUCT_SIZES[key] = sp.size
            keys.append(key)
            print('  ov-%s.png %dx%d' % (key, sp.width, sp.height))
        STRUCT_STYLES[rung] = keys
    assert len(STRUCT_SIZES) >= 30, 'style wardrobe too thin: %d' % len(STRUCT_SIZES)
TENT_SIZE = STRUCT_SIZES.get('tent1', (0, 0))

# ---- 🐦 GARDEN BIRDS (M3) — the charm layer -------------------------------
# Trym owns the Garden Birds pack: 64x64 sheets, 4x4 grid of 16px frames.
# Grammar read off the contact sheet: row 0 = FLIGHT, row 2 = ground idle.
# Exported as 64x16 strips at native res — the engine scales via world %.
BIRDS_DIR = os.path.expanduser(r'~\OneDrive\banana-art-pack\Garden Birds_Download\Garden Birds_Download\Spritesheets')
BIRD_SPECIES = ['cardinal', 'blue jay', 'chickadee', 'red robin', 'white_dove', 'magpie']
BIRD_KEYS = []
if os.path.isdir(BIRDS_DIR):
    for sp in BIRD_SPECIES:
        try:
            sh = Image.open(os.path.join(BIRDS_DIR, 'spritesheet_%s.png' % sp)).convert('RGBA')
        except Exception:
            print('  MISSING bird', sp)
            continue
        key = sp.replace(' ', '').replace("'", '').replace('_', '')
        sh.crop((0, 0, 64, 16)).save(os.path.join(OUT, 'b-%s-f.png' % key), optimize=True)
        sh.crop((0, 32, 64, 48)).save(os.path.join(OUT, 'b-%s-g.png' % key), optimize=True)
        BIRD_KEYS.append(key)
    print('  birds:', ', '.join(BIRD_KEYS))

# ---- 🛋 INTERIORS (M4) — step inside the house ----------------------------
# Modern Interiors Home_Designs ship as layer_1 (floor/under) + layer_2
# (above): v1 composites both into ONE walkable plate — colliders keep the
# banana in the lanes, so occlusion sins stay invisible. The room lives INSIDE
# the outdoor world's coordinate space (over a shade layer) so the whole
# camera/collision/tap machinery is reused verbatim.
# Colliders + door + kitchen zones are EYEBALLED off the previews (local px,
# offset to world at emit). Stage 2 = Generic_Home_1 (top door), stage 3 =
# Japanese_Home_1 (genkan at the bottom — the shoes ARE the door).
MI = os.path.expanduser(r'~\OneDrive\banana-art-pack\moderninteriors-win\6_Home_Designs')
INTERIOR_DEF = {
    2: {
        'glob': 'Generic_Home_Designs/48x48/Generic_Home_1_*ayer_*48x48*.png',
        'img': 'in-generic.png', 'at': (564, 229),
        'spawn': (355, 165), 'exit': (325, 120, 385, 142), 'kitchen': (120, 410, 590, 545),
        'cols': [
            (0, 0, 325, 128), (385, 0, 672, 128),          # top walls, door lane open
            (0, 0, 58, 642), (614, 0, 672, 642), (0, 592, 672, 642),
            (135, 60, 335, 152), (375, 55, 565, 148),      # fireplace row · dresser+bunk
            (130, 285, 235, 368), (475, 328, 575, 378),    # sewing corner · desk
            (58, 375, 298, 405), (432, 375, 614, 405),     # the kitchen wall, lane open
            (135, 428, 288, 532), (428, 428, 578, 532),    # counters
        ],
    },
    3: {
        'glob': 'Japanese_Interiors_Home_Designs/48x48/Japanese_Home_1_*ayer_*48x48*.png',
        'img': 'in-japanese.png', 'at': (444, 229),
        'spawn': (295, 560), 'exit': (200, 596, 390, 630), 'kitchen': (45, 325, 205, 415),
        'cols': [
            (0, 0, 912, 95),                               # top walls
            (0, 0, 50, 642), (862, 0, 912, 642),
            (0, 490, 185, 642), (400, 490, 912, 642),      # bottom walls, genkan open
            (60, 30, 290, 145), (45, 95, 100, 190),        # cabinet row · zen corner
            (325, 100, 435, 180),                          # kotatsu
            (550, 60, 585, 295), (585, 282, 865, 305),     # bedroom walls
            (615, 150, 860, 235), (575, 60, 625, 100),     # beds · appliance
            (45, 195, 290, 218), (288, 196, 470, 292),     # tea-room wall · shoji row
            (95, 255, 190, 312), (52, 335, 198, 408),      # tea table · irori hearth
            (388, 336, 522, 422), (592, 388, 758, 468),    # dining · desk set
            (668, 292, 865, 342),                          # right shoji band
        ],
    },
}
INTERIORS_OUT = {}
if os.path.isdir(MI):
    for tier, spec in INTERIOR_DEF.items():
        layers = sorted(_glob.glob(os.path.join(MI, spec['glob'])))
        layers = [f for f in layers if 'preview' not in f.lower()]
        if not layers:
            print('  MISSING interior', tier, spec['glob'])
            continue
        base = Image.open(layers[0]).convert('RGBA')
        for extra in layers[1:]:
            base.alpha_composite(Image.open(extra).convert('RGBA'))
        base.save(os.path.join(OUT, spec['img']), optimize=True)
        ox, oy = spec['at']
        off = lambda r: [r[0] + ox, r[1] + oy, r[2] + ox, r[3] + oy]
        INTERIORS_OUT[tier] = {
            'img': spec['img'], 'box': [ox, oy, base.width, base.height],
            'spawn': [spec['spawn'][0] + ox, spec['spawn'][1] + oy],
            'exit': off(spec['exit']), 'kitchen': off(spec['kitchen']),
            'cols': [off(c) for c in spec['cols']],
        }
        print('  %s %dx%d (%d layers, %d colliders)' % (spec['img'], base.width, base.height, len(layers), len(spec['cols'])))

# ---- emit the contract ----------------------------------------------------
def emit():
    L = []
    L.append('// GENERATED by tools/build-homestead-scene.py — DO NOT EDIT.')
    L.append('export const WORLD = { w: %d, h: %d };' % (W, H))
    L.append('export const BOUND = %d;' % BOUND)
    L.append('export const ROAD = { y: %d, hw: %d };' % (ROAD_Y, ROAD_HW))
    L.append('export const GATE = { x: %d, y: %d };' % (GATE_X, FENCE_PX[3]))
    L.append('export const SPAWN = { x: %d, y: %d };' % SPAWN)
    L.append('export const EXIT_EAST = { x: %d, y: %d, r: 60 };' % (W - 40, ROAD_Y))
    L.append('export const FENCE = %s;' % list(FENCE_PX))
    L.append('export const PLOT = %s;' % list(PLOT))
    L.append('// 🌱 land grows with the ladder: stage 0-1 → tier 1, 2 → 2, 3 → 3')
    L.append('export const FENCE_TIERS = %s;' % __import__('json').dumps(FENCE_TIERS_OUT))
    L.append('export const BED = { w: %d, h: %d, def: { x: %d, y: %d }, slots: [[-90, -32], [-20, -32], [50, -32], [120, -32]] };' % (BED_W, BED_H, BED_DEF[0], BED_DEF[1]))
    L.append('export const TENT = { x: %d, y: %d, w: %d, h: %d, solid: [-%d, -20, %d, 4] };'
             % (TENT[0], TENT[1], TENT_SIZE[0], TENT_SIZE[1],
                max(20, TENT_SIZE[0] // 2 - 8), max(20, TENT_SIZE[0] // 2 - 8)))
    L.append('export const STRUCT_STYLES = %s;' % str(STRUCT_STYLES).replace("'", '"'))
    L.append('export const STRUCTS = { %s };' % ', '.join(
        "%s: { w: %d, h: %d }" % (k, w, h) for k, (w, h) in STRUCT_SIZES.items()))
    L.append('export const MAILBOX = { x: %d, y: %d };' % MAILBOX_AT)
    L.append('export const SIGN = { x: %d, y: %d };' % SIGN_AT)
    L.append('export const OB_RECTS = %s;' % [list(map(int, r)) for r in COLLIDERS])
    L.append('export const OVERLAYS = %s;' % [[o[0], o[1], o[2], o[3], o[4], o[5]] for o in OVERLAYS])
    L.append('export const BIRDS = %s;' % str(BIRD_KEYS).replace("'", '"'))
    L.append('export const INTERIORS = %s;' % __import__('json').dumps(INTERIORS_OUT))
    with open(os.path.join(SITE, 'src', 'scripts', 'homestead-geo.js'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(L) + '\n')
    print('wrote homestead-geo.js (%d colliders, %d overlays)' % (len(COLLIDERS), len(OVERLAYS)))

    D = []
    D.append('// GENERATED by tools/build-homestead-scene.py — DO NOT EDIT.')
    D.append('// The decor catalog: footprints measured from the exported sprites.')
    D.append('// surface: ground-only in M0; stage = house-ladder gate (0 = from the plot).')
    D.append('export const DECOR = [')
    for did, name, cat, price, stage, w, h, box in DECOR_OUT:
        D.append("  { id: '%s', name: '%s', cat: '%s', price: %d, stage: %d,"
                 " w: %d, h: %d, surface: 'ground', img: '/assets/homestead/d-%s.png', solid: %s },"
                 % (did, name, cat, price, stage, w, h, did,
                    (str(box) if box else 'null')))
    D.append('];')
    with open(os.path.join(SITE, 'src', 'data', 'decor.js'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(D) + '\n')
    print('wrote src/data/decor.js (%d items)' % len(DECOR_OUT))


emit()
im.convert('RGB').save(os.path.join(OUT, 'homestead.png'), optimize=True)
print('wrote homestead.png (%dx%d) %.0f KB'
      % (W, H, os.path.getsize(os.path.join(OUT, 'homestead.png')) / 1024.0))
