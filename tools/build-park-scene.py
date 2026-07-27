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


def cleanest(names, keep=3):
    """the tiles with the FEWEST non-green speck pixels — round 3 tiled ONE
    debris-bearing grass tile and the park grew a grid of 'dog turds' (Trym).
    Mixing the cleanest few + random flips kills both the specks and the
    repeat pattern."""
    scored = []
    for n in names:
        try:
            t = load_pack(n).convert('RGBA')
        except Exception:
            continue
        if t.size != (T, T):
            continue
        p = t.load()
        specks = sum(1 for y in range(T) for x in range(T)
                     if p[x, y][3] and (p[x, y][0] > p[x, y][1] + 14 or p[x, y][0] > 120))
        scored.append((specks, n, t))
    scored.sort(key=lambda s: s[0])
    return [s[2] for s in scored[:keep]]


def scrubbed(tile):
    """⚠️ round 4's 'cleanest' picker chose EDGE tiles (fewest specks, but an
    arch gradient — the lawn tiled into rows of humps). The right base is the
    FLAT tile (most_uniform), with its baked debris specks ERASED: every
    non-green pixel becomes the tile's median green."""
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


def tile_stats(t):
    """(specks, edge, texture): red-speck count, top/bottom+left/right mean
    drift (high = an autotile EDGE tile — those tiled into arch rows in round
    4), and inner variance (the actual blade detail we WANT)."""
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


if HAVE_PACK:
    # ⚠️ contact-sheet study (round 8): the pack's REAL lawn texture is the
    # Grass_Wall_1 family — dense leafy blades, zero debris. The Grass_1..4
    # families are grass-vs-dirt AUTOTILES whose only full-grass members are
    # the flat fills that read "very simple" (Trym). Flowered variants of the
    # same texture become sparse accents.
    def fam_tiles(fam, hi):
        out = []
        for i in range(1, hi):
            try:                                       # GARDEN singles, not
                t = load_pack('ME_Singles_Garden_48x48_%s_%d.png' % (fam, i)).convert('RGBA')
            except Exception:                          # Terrains_and_Fences
                continue
            if t.size == (T, T):
                sp, ed, tx = tile_stats(t)
                out.append((ed, t))
        return out

    # ⚠️ the Grass_Wall/Flowered families are ALL hedge-wall pieces (shadow
    # columns, burrow holes — they striped then polka-dotted the lawn). The
    # pack's OWN scenes build lawns as flat base + scattered life, so: flat
    # clean base + Grass_Tufts + Props_Grass patches + lifted flower pixels.
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
    GRASSES = [scrubbed(t) for _, t in cand[:3]] or [Image.new('RGBA', (T, T), (86, 152, 74, 255))]
    FLOWER_STAMPS = []
    for ed, t in fam_tiles('Grass_Wall_1_Flowered', 15):
        p = t.load()
        st = [(x, y, p[x, y]) for y in range(T) for x in range(T)
              if p[x, y][3] and sum(p[x, y][:3]) > 330
              and not (p[x, y][1] > p[x, y][0] and p[x, y][1] > p[x, y][2])]
        if 6 < len(st) < 260:
            FLOWER_STAMPS.append(st)
    print('grass: %d flat base, %d flower stamps' % (len(GRASSES), len(FLOWER_STAMPS)))
    WATER_T = most_uniform(['ME_Singles_Terrains_and_Fences_48x48_Deep_Water_1_%d.png' % i
                            for i in range(1, 20)])
    grng = random.Random(7)
    for r in range(0, H // T + 1):
        for c in range(0, W // T + 1):
            t = GRASSES[grng.randrange(len(GRASSES))]
            if grng.random() < 0.5:
                t = t.transpose(Image.FLIP_LEFT_RIGHT)
            im.alpha_composite(t, (c * T, r * T))
    # the LIFE pass, all off the tile grid so nothing reads as a pattern:
    # tufts everywhere, soft green patches, loose flower clusters
    try:
        TUFT = load_pack('ME_Singles_Graveyard_48x48_Grass_Tufts.png').convert('RGBA')
        tp = TUFT.load()          # graveyard tufts are dead-grey — retint to
        for y in range(TUFT.height):                    # lawn greens by luma
            for x in range(TUFT.width):
                r0, g0, b0, a0 = tp[x, y]
                if a0:
                    k = (0.3 * r0 + 0.6 * g0 + 0.1 * b0) / 120.0
                    tp[x, y] = (int(min(255, 62 * k)), int(min(255, 128 * k)),
                                int(min(255, 56 * k)), a0)
    except Exception:
        TUFT = None
    PATCHES = []
    for i in (1, 2, 3, 8, 9):      # green patches ONLY — 12/13 are orange
        try:
            PATCHES.append(load_pack('ME_Singles_Terrains_and_Fences_48x48_Props_Grass_%d.png' % i).convert('RGBA'))
        except Exception:
            pass
    for _ in range(70):
        if not PATCHES:
            break
        pt = PATCHES[grng.randrange(len(PATCHES))]
        im.alpha_composite(pt, (grng.randrange(20, W - 60), grng.randrange(20, H - 60)))
    if TUFT:
        for _ in range(340):
            t2 = TUFT.transpose(Image.FLIP_LEFT_RIGHT) if grng.random() < 0.5 else TUFT
            im.alpha_composite(t2, (grng.randrange(10, W - 58), grng.randrange(10, H - 58)))
    for _ in range(34):
        ox, oy = grng.randrange(60, W - 100), grng.randrange(60, H - 100)
        for x, y, col in FLOWER_STAMPS[grng.randrange(len(FLOWER_STAMPS))] if FLOWER_STAMPS else []:
            put(ox + x, oy + y, col)
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

# ---- 🛣 THE PARK PATHS: the beach's curvy road system, dirt palette --------
# Trym on the straight cross (round 6): "very symmetric, systemic, square and
# boring — i want it more natural, curvy paths, room to make every meter a bit
# interesting". Ported from build-beach-scene.py: arc-length wobble (verticals
# wander as much as horizontals), per-end taper, and ONE unioned mask so
# junctions blend seamlessly instead of stamping shoulders across each other.
ROAD = (208, 178, 128)
ROAD_S = (196, 166, 116)
ROAD_RIM = (122, 108, 62)
ROAD_TAPER = 44
ROAD_SPINE = []
_rrng = random.Random(4242)
_road_mask = None
_road_box = [W, H, 0, 0]


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
    for i in range(min(ROAD_TAPER, n // 2)):
        k = 0.30 + 0.70 * (i / float(ROAD_TAPER))
        if taper[0]:
            out[i][4] = max(4, hw * k)
        if taper[1]:
            out[n - 1 - i][4] = max(4, hw * k)
    return [tuple(p) for p in out]


def road_mask_add(spine):
    global _road_mask
    if _road_mask is None:
        _road_mask = bytearray(W * H)
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
        _road_box[0] = min(_road_box[0], max(0, cx_ - r))
        _road_box[1] = min(_road_box[1], max(0, cy_ - r))
        _road_box[2] = max(_road_box[2], min(W, cx_ + r + 1))
        _road_box[3] = max(_road_box[3], min(H, cy_ + r + 1))
    ROAD_SPINE.extend(spine)


def road_bake():
    m = _road_mask
    x0, y0, x1, y1 = _road_box
    for y in range(y0, y1):
        row = y * W
        for x in range(x0, x1):
            v = m[row + x]
            if not v:
                continue
            if v >= 5:
                put(x, y, ROAD_S if _rrng.random() < 0.20 else ROAD)
            elif _rrng.random() < 0.18 * v:
                put(x, y, ROAD_RIM)


# the network: every lane bends, junction ends start INSIDE the plaza
# (taper=False there) so they merge with the paved circle, stub + spur ends
# peter out (taper=True).
HW = 30                        # main lanes ~60px wide (the old slab was 88)
road_mask_add(road_pts([(1380, 640), (1305, 800), (1410, 930), (1380, 1100)],
                       HW, taper=(False, False)))               # S → the rave
road_mask_add(road_pts([(1560, 590), (1800, 660), (2080, 545), (2380, 625),
                        (2760, 570)], HW, taper=(False, False)))  # E → the beach
road_mask_add(road_pts([(1200, 580), (980, 625), (750, 545), (520, 605),
                        (330, 565)], HW, taper=(False, True)))    # W stub 🚧
road_mask_add(road_pts([(1385, 430), (1335, 310), (1420, 215), (1400, 140)],
                       HW, taper=(False, True)))                  # N stub 🚧
# little spurs — the "every meter interesting" walks
road_mask_add(road_pts([(905, 610), (790, 500), (735, 450)],
                       18, taper=(False, True)))                  # → pond bank
road_mask_add(road_pts([(1330, 830), (1120, 862), (940, 825)],
                       18, taper=(False, True)))                  # → playground
road_mask_add(road_pts([(2085, 560), (2150, 700), (2255, 775)],
                       18, taper=(False, True)))                  # → the meadow
road_bake()

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
# ⚠️ NO entry aprons: the circle OVERFLOWS the roads (Trym round 8 — the
# apron re-paint made lanes "stop weird in the middle of the circle"). Lanes
# start inside the ellipse and the plaza, painted after road_bake, buries
# them; each path now dies cleanly at the rim.

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


# ---- 🦆 the duck pond: the pack's OWN grass→water autotiles ----------------
# ⚠️ round 3 filled an ellipse with a flat water tile + a drawn mud ring — a
# navy slab. The Grass_Water_1_N family (91 singles) IS the transition art;
# each tile is auto-classified by sampling its edge midpoints (blue = water),
# then the pond is laid on the TILE GRID: a cell gets the tile whose water
# sides face its in-pond neighbours. Trym's reference shots, done properly.
pcx, pcy, prx, pry = POND
if HAVE_PACK:
    # ⚠️ TWO auto-classification attempts at the Grass_Water autotiles failed
    # (rounds 4-5: staircase edges, dirt-bank strays) — the family's layout
    # needs a proper contact-sheet study before it can be mapped (TODO, own
    # session). Until then: pack water FILL + a hand-finished bank in the
    # reference shots' language — dark under-lip, then a scalloped GRASS
    # overhang so the lawn hangs over the water like the pack's own ponds.
    wp = WATER_T.load()
    for y in range(pcy - pry, pcy + pry):
        for x in range(pcx - prx, pcx + prx):
            if ((x - pcx) / float(prx)) ** 2 + ((y - pcy) / float(pry)) ** 2 <= 1.0:
                put(x, y, wp[x % T, y % T])
    for ang in range(0, 4200):
        a = ang / 4200.0 * 2 * math.pi
        scal = 1.0 + 0.018 * math.sin(a * 14) + 0.010 * math.sin(a * 5)
        for rr, col in ((0.955, (38, 84, 118)), (0.985, (30, 68, 98))):
            x = int(pcx + math.cos(a) * prx * rr * scal)
            y = int(pcy + math.sin(a) * pry * rr * scal)
            put(x, y, col)
            put(x + 1, y, col)
            put(x, y + 1, col)
        for rr, col in ((1.005, (56, 118, 54)), (1.03, (74, 138, 66)), (1.055, (96, 158, 78))):
            x = int(pcx + math.cos(a) * prx * rr * scal)
            y = int(pcy + math.sin(a) * pry * rr * scal)
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
# ⚠️ Round-3 sin (Trym): "the same 5-10 sprites plastered around". The pack has
# 100+ trees — the border is now built like his reference shots: SPECIES
# CLUSTERS (a stretch of one family reads as a wood, a shuffle reads as a
# screensaver), TWO ROWS with y-offset for depth, and small bushes filling the
# gaps at the feet of the big trees. Greens only: 4/5/6 are the autumn set.
BIG_TREES = ['ME_Singles_Camping_48x48_Tree_%d.png' % n for n in (1, 2, 3, 13, 14, 15, 16, 17, 18)]
SPECIES = [BIG_TREES[0:3], BIG_TREES[3:6], BIG_TREES[6:9]]
SMALLS = ['ME_Singles_Camping_48x48_Bush_%d.png' % n for n in (1, 2, 3, 4)] \
    + ['ME_Singles_City_Props_48x48_Bush_%d.png' % n for n in (1, 2, 3)]


def treeline(x0, x1, y, step=104, jitter=22):
    """two staggered rows of ONE species per ~500px stretch + bushes at the feet"""
    x = x0
    while x < x1:
        fam = SPECIES[int(x / 500) % len(SPECIES)]
        try_place(fam[rng.randrange(len(fam))], x + rng.randrange(-jitter, jitter),
                  y - 26 + rng.randrange(-10, 10), shade=False)          # back row
        try_place(fam[rng.randrange(len(fam))], x + step // 2 + rng.randrange(-jitter, jitter),
                  y + 18 + rng.randrange(-8, 8), shade=False)            # front row
        if rng.random() < 0.5:
            try_place(SMALLS[rng.randrange(len(SMALLS))], x + rng.randrange(0, step),
                      y + 44 + rng.randrange(-6, 10), shade=False, scale=PROP * 0.85)
        x += step


# ⚠️ NO BORDER TREE WALLS (Trym, round 7: "remove the trees around the map,
# it looks weird to frame everything in like that for now") — the world edge
# is the engine's BOUND clamp, not a visual fence. treeline() is kept for
# possible partial hedges later.
if HAVE_PACK:
    # inner clumps — one species each, y-sorted + trunk-solid
    for ci, (cx_, cy_) in enumerate(((240, 620), (1060, 260), (1200, 940),
                                     (1660, 180), (2560, 950), (900, 470))):
        fam = SPECIES[ci % len(SPECIES)]
        for i in range(3):
            try_place(fam[rng.randrange(len(fam))],
                      cx_ + rng.randrange(-70, 70), cy_ + rng.randrange(-40, 40),
                      solid=TRUNK, layer=True)
    # 🍄 the forest floor: mushrooms + stumps at the FEET of the tree clumps
    # (with the border walls cut, edge placement would float on open lawn)
    CLUMPS = ((240, 620), (1060, 260), (1200, 940), (1660, 180), (2560, 950), (900, 470))
    for _ in range(12):
        cx_, cy_ = CLUMPS[rng.randrange(len(CLUMPS))]
        try_place(['ME_Singles_Camping_48x48_Mushrooms_%d.png' % rng.randrange(1, 6)],
                  cx_ + rng.randrange(-130, 130), cy_ + rng.randrange(40, 110),
                  shade=False, scale=PROP * 0.85)
    for _ in range(4):
        cx_, cy_ = CLUMPS[rng.randrange(len(CLUMPS))]
        try_place(['ME_Singles_Camping_48x48_Stump_%d.png' % rng.randrange(1, 3)],
                  cx_ + rng.randrange(-160, 160), cy_ + rng.randrange(60, 130),
                  solid=ROCK_BOX, scale=PROP * 0.9)
    # a couple of worn dirt patches breaking the lawn up — ⚠️ on OPEN LAWN
    # only (round 4 smeared one across the plaza's rim)
    for dcx, dcy, drx, dry_ in ((980, 330, 64, 36), (2380, 780, 70, 40), (520, 1010, 60, 34)):
        for y in range(dcy - dry_, dcy + dry_):
            for x in range(dcx - drx, dcx + drx):
                dd = ((x - dcx) / float(drx)) ** 2 + ((y - dcy) / float(dry_)) ** 2
                if dd <= 1.0 and rng.random() < (1.1 - dd):
                    put(x, y, (172, 142, 96) if (x * 3 + y * 7) % 9 else (152, 124, 82))

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
        # base at CY + ~14% of height puts the BASIN's centre on the plaza's
        # centre (0.42 hung the whole statue low — Trym round 8)
        fx, fbase = CX, CY + int(strip.height * 0.14)
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
    # carts sit just off the beach road's north shoulder, following its dips
    # (the road curves now — placement tracks the waypoints, not MARKET_Y)
    MARKET['stand'] = (1975, 528)
    try_place(['ME_Singles_Vehicles_48x48_Street_Food_Cart_1.png',
               'ME_Singles_Vehicles_48x48_Street_Food_Cart_2.png'],
              1975, 528, solid=CART_BOX, layer=True, colors=14)
    # 🧃 THE MERCH CART — the whole point of Park 2.0
    MARKET['cart'] = (2300, 545)
    try_place(['ME_Singles_Vehicles_48x48_Fruit_Flowers_Cart_1.png',
               'ME_Singles_Vehicles_48x48_Fruit_Flowers_Cart_2.png'],
              2300, 545, solid=CART_BOX, layer=True, colors=14)

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

# roadside tufts: little blossom clusters hugging the path shoulders, so the
# walk itself has things to look at (Trym: "every meter a bit interesting")
for i in range(0, len(ROAD_SPINE), 120):
    sx_, sy_, px_, py_, hw = ROAD_SPINE[i]
    if wrng.random() < 0.45:
        continue
    side = 1 if wrng.random() < 0.5 else -1
    off = hw + wrng.randrange(10, 26)
    bx_, by_ = int(sx_ + px_ * off * side), int(sy_ + py_ * off * side)
    if BOUND + 40 < bx_ < W - BOUND - 40 and BOUND + 60 < by_ < H - BOUND - 40:
        col = BLOOM[wrng.randrange(len(BLOOM))]
        for _ in range(wrng.randrange(2, 5)):
            blossom(bx_ + wrng.randrange(-14, 14), by_ + wrng.randrange(-9, 9), col)

# ---- lamps, benches, rocks, signs -----------------------------------------
# ⚠️ SIX lamps, placed like a park department would: the plaza's four corners
# + one per shopping/playing corner. Round 3 scattered ~20 and the centre
# read as a lamp warehouse (Trym).
# ⚠️ LAMPS CUT (rounds 3-6): Street_Lamp_48x48.png is a variant SHEET whose
# layout defeated both naive pastes and column slicing (boulevards, then
# fragments). Re-add only after a real contact-sheet study of the file.
if HAVE_PACK:
    # benches live at the bends — a seat wherever the path turns and the view
    # changes. ⚠️ NONE inside the plaza: the log benches read as tree stumps
    # on the pavement (Trym round 8).
    for bx, by, fl in ((768, 502, False), (1822, 618, True), (1285, 862, False)):
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
    for sx, sy in ((332, 584), (1414, 236)):     # ON the stub ends' new curves
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
