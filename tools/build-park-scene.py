# -*- coding: utf-8 -*-
"""🌳 PARK 2.0 — the park scene art (park-2-plan).

Beach-template build (build-beach-scene.py is the constitution): true top-down
map, pack art at PROP scale, colliders declared ON the placement and emitted
into src/scripts/park-geo.js. The forest replaces the ocean as the world's
walls. Zones (Trym's approved v2 zoning, 28 Jul): crossroads plaza + fountain
centre · duck pond NW · THE BANANA STAND capping the north road · the merch
kiosk on the beach road · meadow SE · playground SW · road stub W with a
construction sign.

Outputs:
  public/assets/park/park.png        2760x1100 world plate (lush — phase 4)
  public/assets/park/park-mid.png    patchy half-recovered twin (phases 2-3)
  public/assets/park/park-sad.png    autumn/neglect twin (phases 0-1)
  public/assets/park/ov-*.png        y-sorted overlay props (+ ov-sad twins)
  public/assets/park/a-fountain.png  the plaza fountain, animated strip
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


# 🍂 W1b/W1c: the twin plates. im2 (sad) and im3 (mid, patchy half-recovered)
# exist from the fork point on (after the ground+pond are painted); everything
# placed later writes ALL canvases from the SAME placement pass, so the
# geometry contract is identical by construction. The mid plate keeps the lush
# sprite art — only its GROUND is graded; trees are client overlays anyway.
im2, px2 = None, None
im3, px3 = None, None
SKIP_MID = [False]     # a flower cluster the mid plate goes without


def drab_col(col):
    """one pixel toward neglect: desaturate, then brown the greens/blues"""
    r, g, b = col[0], col[1], col[2]
    grey = (r * 30 + g * 59 + b * 11) // 100
    k = 0.35
    r = int(r * (1 - k) + grey * k)
    g = int((g * (1 - k) + grey * k) * 0.94)
    b = int((b * (1 - k) + grey * k) * 0.86)
    return (r, g, b) + tuple(col[3:])


def drab(img):
    """the sad grade for a placed sprite — same dims, outlines survive"""
    s = img.copy()
    p = s.load()
    for y in range(s.height):
        for x in range(s.width):
            c = p[x, y]
            if c[3]:
                p[x, y] = drab_col(c)
    return s


def put(x, y, col):
    if 0 <= x < W and 0 <= y < H:
        c = col if len(col) == 4 else col + (255,)
        px[x, y] = c
        if px2 is not None:
            px2[x, y] = drab_col(c)
        if px3 is not None and not SKIP_MID[0]:
            px3[x, y] = c


def shadow(cx, cy, rx, ry, a=64):
    for p in [q for q in (px, px2, px3) if q is not None]:
        for y in range(int(cy - ry), int(cy + ry + 1)):
            for x in range(int(cx - rx), int(cx + rx + 1)):
                if not (0 <= x < W and 0 <= y < H):
                    continue
                d = ((x - cx) / float(rx)) ** 2 + ((y - cy) / float(ry)) ** 2
                if d <= 1.0:
                    r, g, b, _ = p[x, y]
                    k = a / 255.0 * (1.0 - d * 0.45)
                    p[x, y] = (int(r * (1 - k) + 24 * k), int(g * (1 - k) + 34 * k),
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


FLOWER_UNDO = []       # [(x, y, under-colour, stamped-colour), ...] per cluster
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
    # each cluster remembers what it painted over — the mid plate (W1c) drops
    # most of them ("most flowers gone") by restoring the lawn underneath
    for _ in range(34):
        ox, oy = grng.randrange(60, W - 100), grng.randrange(60, H - 100)
        undo = []
        for x, y, col in FLOWER_STAMPS[grng.randrange(len(FLOWER_STAMPS))] if FLOWER_STAMPS else []:
            if 0 <= ox + x < W and 0 <= oy + y < H:
                c = col if len(col) == 4 else col + (255,)
                undo.append((ox + x, oy + y, px[ox + x, oy + y], c))
            put(ox + x, oy + y, col)
        FLOWER_UNDO.append(undo)
else:
    rect(0, 0, W, H, (86, 152, 74))

# a soft afternoon grade — greens lifted warm, colour-keyed like the beach's
GRASS_TARGET = (128, 186, 96)


def warmgrade(c):
    """the exact per-pixel grade below, as a function — the mid fork replays
    it on the flower-undo colours so restored lawn matches its surroundings"""
    r, g, b, a = c
    if g > r - 10 and g > b:                     # grassy → lift toward warm green
        k = 0.30
        return (int(r * (1 - k) + GRASS_TARGET[0] * k),
                int(g * (1 - k) + GRASS_TARGET[1] * k),
                int(b * (1 - k) + GRASS_TARGET[2] * k), a)
    return c


for y in range(H):
    for x in range(W):
        px[x, y] = warmgrade(px[x, y])

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


def on_road(x, y, r=26):
    """decor guard (Trym r12: stumps sat on the pond spur) — any road-mask
    ink within r of the sprite's base? Coarse 6px stride is plenty."""
    if _road_mask is None:
        return False
    for yy in range(max(0, int(y) - r), min(H, int(y) + r + 1), 6):
        row = yy * W
        for xx in range(max(0, int(x) - r), min(W, int(x) + r + 1), 6):
            if _road_mask[row + xx]:
                return True
    return False


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
                       HW, taper=(False, True)))                  # N → the stand
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
TREE_OVS = []          # tree overlays — client greens them one by one (W1c)
SIGNS = []
ROAD_SIGN = None                # 🧭 the waypost at the east road's end
MARKET = {}

TRUNK = ('rect', -13, -36, 13, 0)
BASIN = ('circle', 60)
STAND_BOX = ('rect', -84, -56, 84, 6)   # the ×2 hut's footprint (176×172)
SHOP_BOX = ('rect', -100, -58, 100, 6)
BENCH_BOX = ('rect', -34, -18, 34, 4)
OLD_BENCH = (1583, 722)      # Old Peel's bench — just off the plaza's SE rim
TABLE_BOX = ('rect', -44, -30, 44, 6)
ROCK_BOX = ('circle', 20)


def dedisc(img):
    """strip the pack's baked-in grass mound under trees/bushes/props — its
    green never matches our lawn, so every tree stood on an off-shade disc
    (Trym round 9). Bottom band only; greens go transparent, trunk browns and
    outlines survive (mound greens all have g > r+30)."""
    img = img.convert('RGBA')
    p = img.load()
    h = img.height
    if h < 100:            # bushes/mushrooms ARE green to the ground —
        return img         # de-mounding them leaves grey husks
    y0 = int(h * 0.84)     # 0.74/0.80 nibbled the low-crowned species
    for y in range(y0, h):
        for x in range(img.width):
            r, g, b, a = p[x, y]
            # BRIGHT lawn greens only — g>r+30 alone also ate the mossy
            # trunks of the purple-shadow species (Trym round 9b)
            if a and g > r + 38 and g > 108 and r < 92:
                p[x, y] = (0, 0, 0, 0)
    return img


# 🍂 green tree → its autumn twin (contact-sheet: Camping 1-3 ↔ 4-6, 13-18 ↔
# 19-24). Everything WITHOUT a twin gets the drab() grade instead.
SAD_TREE = {1: 4, 2: 5, 3: 6, 13: 19, 14: 20, 15: 21, 16: 22, 17: 23, 18: 24}
SAD_SUBS = {'ME_Singles_Camping_48x48_Tree_%d.png' % g:
            'ME_Singles_Camping_48x48_Tree_%d.png' % a for g, a in SAD_TREE.items()}


def place(name, cx, base, factor=1, colors=28, warm=0.0, sat=1.0, con=1.0,
          flip=False, shade=True, sh=0.30, scale=PROP, solid=None, layer=False):
    key = (name, factor, colors, warm, sat, con)
    if key not in _cache:
        _cache[key] = blockify(dedisc(load_pack(name)), factor=factor, colors=colors,
                               warm=warm, sat=sat, con=con)
    s = _cache[key]
    if scale != 1.0:
        s = s.resize((max(1, int(s.width * scale)), max(1, int(s.height * scale))),
                     Image.NEAREST)
    if flip:
        s = s.transpose(Image.FLIP_LEFT_RIGHT)
    # the sad twin: autumn art where a twin exists (forced to the SAME dims so
    # the one geometry serves both plates), the drab grade everywhere else
    s2 = None
    if im2 is not None:
        if name in SAD_SUBS:
            k2 = (SAD_SUBS[name], factor, colors, warm, sat, con)
            if k2 not in _cache:
                _cache[k2] = blockify(dedisc(load_pack(SAD_SUBS[name])), factor=factor,
                                      colors=colors, warm=warm, sat=sat, con=con)
            s2 = _cache[k2].resize(s.size, Image.NEAREST)
            if flip:
                s2 = s2.transpose(Image.FLIP_LEFT_RIGHT)
        else:
            s2 = drab(s)
        assert s2.size == s.size   # the contract: one box, two arts
    if shade:
        shadow(cx + s.width * 0.06, base - s.height * 0.02,
               s.width * sh, max(4, s.height * 0.055))
    box = (int(cx - s.width // 2), int(base - s.height),
           int(cx - s.width // 2) + s.width, int(base))
    im.alpha_composite(s, box[:2])
    if s2 is not None:
        im2.alpha_composite(s2, box[:2])
    if im3 is not None:
        im3.alpha_composite(s, box[:2])    # the mid plate keeps lush props
    PLACED.append((name, box))
    if layer:
        fn = 'ov-%d.png' % len(OVERLAYS)
        s.save(os.path.join(OUT, fn), optimize=True)
        if s2 is not None:
            s2.save(os.path.join(OUT, 'ov-sad-%d.png' % len(OVERLAYS)), optimize=True)
        if name in SAD_SUBS:
            TREE_OVS.append(len(OVERLAYS))
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
    # ✅ contact-sheet study (round 10): Grass_Water_1 is 23 tiles, NOT 91.
    # Soft grass-overhang pieces (1-4, 12-18) cover shores where grass is
    # north/beside the water; the DIRT-CLIFF pieces (5-8) are not strays —
    # they ARE the south-facing shores (grass below water shows its bank
    # face, exactly like the pack's reference ponds). Corner-sample at (2,2)
    # etc. — midpoints missed the small notches and broke rounds 4-5.
    # 19/20 (diagonal bank corners) take the cliff→side handoff keys, NOT
    # 5/7 — the straight-cliff pair stepped the side edges inward (Trym r11)
    CLEAN_GW = (22, 2, 4, 6, 8, 1, 3, 19, 20, 15, 17, 18, 21, 23)
    # the family's own grass base (sampled off its full-grass tile 23)
    _t23 = load_pack('ME_Singles_Terrains_and_Fences_48x48_Grass_Water_1_23.png').convert('RGBA')
    _cnt = {}
    for _yy in range(T):
        for _xx in range(T):
            _c = _t23.load()[_xx, _yy]
            if _c[3]:
                _cnt[_c[:3]] = _cnt.get(_c[:3], 0) + 1
    GW_BASE = max(_cnt, key=_cnt.get)
    gw = {}
    for i in CLEAN_GW:
        try:
            t = load_pack('ME_Singles_Terrains_and_Fences_48x48_Grass_Water_1_%d.png' % i).convert('RGBA')
        except Exception:
            continue
        p = t.load()

        def wat(xx, yy, p=p):
            r, g, b, a = p[xx, yy]
            return a > 0 and b > g + 6
        key = (wat(2, 2), wat(45, 2), wat(45, 45), wat(2, 45))   # NW NE SE SW
        gw.setdefault(key, t)
    FULL_W = gw.get((True, True, True, True), WATER_T)
    FULL_G = gw.get((False, False, False, False))

    def in_pond(x_, y_):
        # squircle, not ellipse — round tips at 48px cells grew one-cell
        # water fingers; exponent 2.6 keeps the ends two cells tall
        return (abs(x_ - pcx) / float(prx)) ** 2.6 + (abs(y_ - pcy) / float(pry)) ** 2.6 <= 1.0

    missing = set()
    c0, c1 = (pcx - prx) // T - 1, (pcx + prx) // T + 1
    r0, r1 = (pcy - pry) // T - 1, (pcy + pry) // T + 1
    for r in range(r0, r1 + 1):
        for c in range(c0, c1 + 1):
            x0, y0 = c * T, r * T
            key = (in_pond(x0, y0), in_pond(x0 + T, y0),
                   in_pond(x0 + T, y0 + T), in_pond(x0, y0 + T))
            if not any(key):
                continue
            t = gw.get(key)
            if t is None:
                missing.add(key)
                t = FULL_W if sum(key) >= 3 else FULL_G
            if t is None:
                continue
            if not all(key):
                # dry-grass pixels take the plate's OWN lawn beneath — any
                # fixed re-tint left a faint tile-grid halo around the shore
                t = t.copy()
                tp = t.load()
                for yy in range(T):
                    for xx in range(T):
                        r0, g0, b0, a0 = tp[xx, yy]
                        if (a0 and not (b0 > g0 + 6) and g0 >= r0 and g0 >= b0
                                and r0 + g0 + b0 > 170
                                and 0 <= x0 + xx < W and 0 <= y0 + yy < H):
                            tp[xx, yy] = px[x0 + xx, y0 + yy]
            im.alpha_composite(t, (x0, y0))
    if missing:
        print('  pond: no tile for keys', sorted(missing))
    # the tiles' grass ring went down AFTER the lawn's life pass, so it reads
    # as a flat halo — re-scatter tufts + flowers onto the dry shore band
    srng = random.Random(31)
    for _ in range(90):
        sx_ = srng.randrange(pcx - prx - 60, pcx + prx + 60)
        sy_ = srng.randrange(pcy - pry - 60, pcy + pry + 60)
        d_ = (abs(sx_ - pcx) / float(prx)) ** 2.6 + (abs(sy_ - pcy) / float(pry)) ** 2.6
        if not (1.06 < d_ < 1.9):
            continue
        if TUFT and srng.random() < 0.75:
            im.alpha_composite(TUFT, (sx_ - 24, sy_ - 24))
        elif FLOWER_STAMPS:
            for fx_, fy_, col in FLOWER_STAMPS[srng.randrange(len(FLOWER_STAMPS))]:
                put(sx_ - 24 + fx_, sy_ - 24 + fy_, col)
# ripples + lily pads, so the pond isn't a navy slab
prng = random.Random(88)
for _ in range(60):
    a = prng.random() * 2 * math.pi
    rr = prng.random() * 0.86
    x = int(pcx + math.cos(a) * prx * rr)
    y = int(pcy + math.sin(a) * pry * rr)
    for i in range(prng.randrange(4, 9)):
        put(x + i, y, (96, 152, 196))
LILY = ((pcx - 120, pcy - 40), (pcx + 90, pcy + 55), (pcx + 40, pcy - 80))
for lx, ly in LILY:
    for yy in range(-5, 6):
        for xx in range(-9, 10):
            if (xx / 9.0) ** 2 + (yy / 5.0) ** 2 <= 1.0 and not (xx > 4 and abs(yy) < 2):
                put(lx + xx, ly + yy, (74, 142, 62) if (xx + yy) % 3 else (94, 168, 78))

# ---- 🍂 THE FORK: the sad twin's ground -----------------------------------
# The ground (lawn+roads+plaza+pond) is done — copy it and grade it toward
# neglect: lawn to dry yellow-brown, pond to murk, pavements barely touched.
# Everything placed after this line lands on BOTH canvases (put/shadow/place),
# so park.png and park-sad.png share one placement pass = one geometry.
DRY_LAWN = (176, 148, 80)
MURK = (86, 104, 92)
im2 = im.copy()
px2 = im2.load()
for y in range(H):
    for x in range(W):
        r, g, b, a = px2[x, y]
        if b > g + 6:                              # pond water → murk
            px2[x, y] = (int(r * 0.5 + MURK[0] * 0.5), int(g * 0.5 + MURK[1] * 0.5),
                         int(b * 0.5 + MURK[2] * 0.5), a)
        elif g > r - 10 and g >= b:                # lawn → dry straw
            k = 0.72
            px2[x, y] = (int(r * (1 - k) + DRY_LAWN[0] * k), int(g * (1 - k) + DRY_LAWN[1] * k),
                         int(b * (1 - k) + DRY_LAWN[2] * k), a)
        else:                                      # roads/plaza: a light fade
            gr = (r * 30 + g * 59 + b * 11) // 100
            px2[x, y] = (int(r * 0.92 + gr * 0.08), int(g * 0.92 + gr * 0.08),
                         int(b * 0.92 + gr * 0.08), a)
# neglect shows in the ground itself: extra bare-dirt blotches, sad plate only
_srng = random.Random(99)
for _ in range(9):
    dcx, dcy = _srng.randrange(200, W - 200), _srng.randrange(200, H - 200)
    if ((dcx - CX) / float(PLAZA_RX)) ** 2 + ((dcy - CY) / float(PLAZA_RY)) ** 2 < 1.4:
        continue
    if ((dcx - pcx) / float(prx)) ** 2 + ((dcy - pcy) / float(pry)) ** 2 < 1.4:
        continue
    drx, dry_ = _srng.randrange(34, 66), _srng.randrange(20, 38)
    for y in range(dcy - dry_, dcy + dry_):
        for x in range(dcx - drx, dcx + drx):
            dd = ((x - dcx) / float(drx)) ** 2 + ((y - dcy) / float(dry_)) ** 2
            if dd <= 1.0 and _srng.random() < (1.0 - dd) and 0 <= x < W and 0 <= y < H:
                px2[x, y] = (162, 132, 88, 255) if (x * 3 + y * 7) % 9 else (142, 114, 76, 255)

# ---- 🌾 THE MID FORK (W1c): the patchy half-recovered ground ---------------
# Phases 2-3's plate: lawn ~48% toward straw with irregular blotches pushed
# further, pond murky-ish, hard surfaces untouched, nearly all of the lawn's
# flower clusters gone. Sprites placed after the forks land on this canvas
# in their LUSH art (put/shadow/place all write im3) — the recovering park's
# props look fine, it's the ground that's still catching up. (Trym round 12:
# the first cut read too healthy — pushed everything a step sadder, still
# clearly better than the sad plate.)
im3 = im.copy()
px3 = im3.load()
mrng = random.Random(555)
for undo in FLOWER_UNDO:
    if mrng.random() < 0.85:                   # this cluster never came back
        for x, y, old, new in undo:
            # only where the stamp actually survived (roads/plaza/pond may
            # have buried it after) — warmgrade replays the afternoon pass
            if px3[x, y] == warmgrade(new):
                px3[x, y] = warmgrade(old)
for y in range(H):
    for x in range(W):
        r, g, b, a = px3[x, y]
        if b > g + 6:                              # pond water → a light murk
            k = 0.32
            px3[x, y] = (int(r * (1 - k) + MURK[0] * k), int(g * (1 - k) + MURK[1] * k),
                         int(b * (1 - k) + MURK[2] * k), a)
        elif g > r - 10 and g >= b:                # lawn → halfway to straw
            k = 0.48
            px3[x, y] = (int(r * (1 - k) + DRY_LAWN[0] * k), int(g * (1 - k) + DRY_LAWN[1] * k),
                         int(b * (1 - k) + DRY_LAWN[2] * k), a)
# irregular straw blotches — the patchiness that says "half-recovered"
brng = random.Random(313)
for _ in range(21):
    bcx, bcy = brng.randrange(160, W - 160), brng.randrange(140, H - 140)
    brx, bry = brng.randrange(50, 110), brng.randrange(30, 60)
    if ((bcx - CX) / float(PLAZA_RX)) ** 2 + ((bcy - CY) / float(PLAZA_RY)) ** 2 < 1.4:
        continue
    if ((bcx - pcx) / float(prx)) ** 2 + ((bcy - pcy) / float(pry)) ** 2 < 1.4:
        continue
    for y in range(bcy - bry, bcy + bry):
        for x in range(bcx - brx, bcx + brx):
            dd = ((x - bcx) / float(brx)) ** 2 + ((y - bcy) / float(bry)) ** 2
            if dd <= 1.0 and brng.random() < (1.0 - dd) * 0.9 and 0 <= x < W and 0 <= y < H:
                r, g, b, a = px3[x, y]
                if g > r - 24 and g >= b:          # lawn-ish (already part-straw)
                    k = 0.5
                    px3[x, y] = (int(r * (1 - k) + DRY_LAWN[0] * k),
                                 int(g * (1 - k) + DRY_LAWN[1] * k),
                                 int(b * (1 - k) + DRY_LAWN[2] * k), a)

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
    # ⚠️ rng draws stay in the original order and count (skip, never re-roll)
    # so every placement after this loop keeps its seat
    for _ in range(12):
        cx_, cy_ = CLUMPS[rng.randrange(len(CLUMPS))]
        name = 'ME_Singles_Camping_48x48_Mushrooms_%d.png' % rng.randrange(1, 6)
        px_ = cx_ + rng.randrange(-130, 130)
        py_ = cy_ + rng.randrange(40, 110)
        if on_road(px_, py_):
            continue
        try_place([name], px_, py_, shade=False, scale=PROP * 0.85)
    for _ in range(4):
        cx_, cy_ = CLUMPS[rng.randrange(len(CLUMPS))]
        name = 'ME_Singles_Camping_48x48_Stump_%d.png' % rng.randrange(1, 3)
        px_ = cx_ + rng.randrange(-160, 160)
        py_ = cy_ + rng.randrange(60, 130)
        if on_road(px_, py_):
            continue
        try_place([name], px_, py_, solid=ROCK_BOX, scale=PROP * 0.9)
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
        strip = blockify(sheet, factor=1, colors=28, warm=0.0, sat=1.0,
                         con=1.0, trim=False, outline=True)
        strip = strip.crop((1, 1, 1 + sheet.width, 1 + sheet.height))
        sw = int(fw * PROP)
        strip = strip.resize((sw * n, int(sheet.height * PROP)), Image.NEAREST)
        strip.save(os.path.join(OUT, 'a-fountain.png'), optimize=True)
        f0 = strip.crop((0, 0, sw, strip.height))
        # 💀 the DEAD fountain (Trym): the pack's Turn_Off sheet's LAST frame
        # — jet gone, basin dry. Client swaps to it at phases 0-1; the sad
        # plate bakes it too (dead monument in a dead park).
        offsheet = load_pack('Garden_Fountain_3_Turn_Off_48x48.png').convert('RGBA')
        ostrip = blockify(offsheet, factor=1, colors=28, warm=0.0, sat=1.0,
                          con=1.0, trim=False, outline=True)
        ostrip = ostrip.crop((1, 1, 1 + offsheet.width, 1 + offsheet.height))
        nf = offsheet.width // fw
        ostrip = ostrip.resize((sw * nf, int(offsheet.height * PROP)), Image.NEAREST)
        foff = ostrip.crop((sw * (nf - 1), 0, sw * nf, ostrip.height))
        foff.save(os.path.join(OUT, 'a-fountain-off.png'), optimize=True)
        # base at CY + ~14% of height puts the BASIN's centre on the plaza's
        # centre (0.42 hung the whole statue low — Trym round 8)
        fx, fbase = CX, CY + int(strip.height * 0.14)
        shadow(fx, fbase - 6, sw * 0.42, 10)
        im.alpha_composite(f0, (fx - sw // 2, fbase - strip.height))
        im2.alpha_composite(drab(foff), (fx - sw // 2, fbase - strip.height))
        im3.alpha_composite(f0, (fx - sw // 2, fbase - strip.height))
        COLLIDERS.append(('fountain', ('circle', int(sw * 0.36)), fx, fbase - 20))
        FOUNTAIN = [fx, fbase, sw, strip.height, n]
        print('fountain: %d frames of %dpx' % (n, fw))
    except Exception as e:
        print('  fountain failed:', e)

# ---- 🧃 THE MARKET ROW (storefronts face the beach road) -------------------
if HAVE_PACK:
    # 🍌🏪 THE ORIGINAL STAND HUT — our own art from the old /park/ page
    # (Trym: "the exact version"), NOT a pack sprite. Pre-seeded into _cache
    # untouched (no blockify/dedisc — it is already on-palette pixel art),
    # ×2 NEAREST so the chunky pixels stay true next to the heroic banana;
    # a dark inner rect backs the window cutout (the old page's DOM div).
    # CAPS the north road (Trym): the road runs into its front, the last leg
    # (1420,215 → 1400,140) tucks behind the ×2 hut (spans y 43-215), so no
    # lane pokes past; the client's sparkle/tap/keeper-window all key off
    # MARKET.stand, so this tuple is the ONE knob
    MARKET['stand'] = (1408, 215)
    try:
        hut = Image.open(os.path.join(SITE, 'public', 'assets', 'banana-stand',
                                      'hut.png')).convert('RGBA')
        back = Image.new('RGBA', hut.size, (0, 0, 0, 0))
        ImageDraw.Draw(back).rectangle(
            (int(hut.width * 0.22), int(hut.height * 0.35),
             int(hut.width * 0.78), int(hut.height * 0.66)), fill=(36, 29, 51, 255))
        back.alpha_composite(hut)
        # 🪧 THE BANANA STAND PLANK — the old /banana-stand/ page hung this over
        # the hut as a DOM <span> (.bs-stand__sign), so the flip to a baked map
        # dropped it silently: the art itself never had one. Painted back on
        # here in the hut's OWN three colours, before the ×2, so the lettering
        # doubles with everything else and stays on the pixel grid.
        # ⚠️ NOT rotated. The original tilted -3deg as scalable CSS text; three
        # degrees on a 10px-tall plank is stair-stepping, not charm.
        # ⚠️ THE 'N' IS THE CORNER FORM ON PURPOSE — at 3px wide the obvious
        # N ('#.#','###','###') reads as an M and the word came out "BAMAMA".
        SF = {'B': ('##.', '#.#', '##.', '#.#', '##.'), 'A': ('.#.', '#.#', '###', '#.#', '#.#'),
              'N': ('##.', '#.#', '#.#', '#.#', '#.#'), 'S': ('###', '#..', '###', '..#', '###'),
              'T': ('###', '.#.', '.#.', '.#.', '.#.'), 'D': ('##.', '#.#', '#.#', '#.#', '##.'),
              ' ': ('...', '...', '...', '...', '...')}
        txt, spad = 'BANANA STAND', 3
        sw_, sh_ = len(txt) * 4 - 1 + spad * 2, 5 + spad * 2 - 1
        sign = Image.new('RGBA', (sw_, sh_), (0, 0, 0, 0))
        ImageDraw.Draw(sign).rectangle((0, 0, sw_ - 1, sh_ - 1),
                                       fill=(138, 90, 43, 255), outline=(58, 41, 24, 255))
        for li, ch in enumerate(txt):
            for ry, rw in enumerate(SF[ch]):
                for rx, on in enumerate(rw):
                    if on == '#':
                        sign.putpixel((spad + li * 4 + rx, (sh_ - 5) // 2 + ry), (255, 225, 53, 255))
        back.alpha_composite(sign, ((back.width - sw_) // 2, 16))   # on the roof face, above the eaves
        hut = back.resize((hut.width * 2, hut.height * 2), Image.NEAREST)
        _cache[('bs-hut', 1, 28, 0.0, 1.0, 1.0)] = hut
        place('bs-hut', MARKET['stand'][0], MARKET['stand'][1],
              solid=STAND_BOX, layer=True, colors=28, scale=1.0)
        print('  stand hut placed (%dx%d)' % hut.size)
    except Exception as e:
        print('  stand hut failed', e)
    # 🧃 THE MERCH SHOP — the whole point of Park 2.0. Not a cart: a TINY SHOP
    # HOUSE (Trym) — the pack's Mushroom Kiosk, a round shop hut with a real
    # window. The food-branded kiosks (coffee cup / ice-cream cone) stay out.
    # 🪧 + a tilted SHOP sign perched on the cap (Trym): the farm pack's blank
    # Sign_1 board, lettered in the plank style (cream caps, dark outline).
    # Composed into the kiosk's _cache entry pre-place, so the plates, the
    # drab twin and the overlay all ride place()'s one path — ONE image.
    MARKET['cart'] = (2300, 545)
    try:
        kname = 'ME_Singles_City_Props_48x48_Kiosk_Mushroom_1.png'
        kkey = (kname, 1, 28, 0.0, 1.0, 1.0)
        kk = blockify(dedisc(load_pack(kname)), factor=1, colors=28, warm=0.0, sat=1.0, con=1.0)
        sgp = os.path.expanduser(r'~\OneDrive\banana-art-pack\Modern_Farm_v1.2\48x48'
                                 r'\Single_Files_48x48\0_Complete_Tileset_48x48\Sign_1_48x48.png')
        sg = blockify(Image.open(sgp).convert('RGBA'), factor=1, colors=28, warm=0.0, sat=1.0, con=1.0)
        SIGN_FONT = {'S': ('###', '#..', '###', '..#', '###'), 'H': ('#.#', '#.#', '###', '#.#', '#.#'),
                     'O': ('###', '#.#', '#.#', '#.#', '###'), 'P': ('###', '#.#', '###', '#..', '#..')}
        sgd = ImageDraw.Draw(sg)
        bs = 2
        tx0 = (sg.width - (len('SHOP') * 4 * bs - bs)) // 2
        ty0 = 9
        for pass_col, off in (((58, 41, 24, 255), 1), ((255, 230, 168, 255), 0)):
            for li, ch in enumerate('SHOP'):
                for ry, rows in enumerate(SIGN_FONT[ch]):
                    for rx, on in enumerate(rows):
                        if on != '#':
                            continue
                        x0 = tx0 + li * 4 * bs + rx * bs
                        y0 = ty0 + ry * bs
                        sgd.rectangle((x0 - off, y0 - off, x0 + bs - 1 + off, y0 + bs - 1 + off),
                                      fill=pass_col)
        sg = sg.resize((int(sg.width * 1.5), int(sg.height * 1.5)), Image.NEAREST)
        sg = sg.rotate(-10, resample=Image.NEAREST, expand=True)
        pad = int(sg.height * 0.62)
        comp = Image.new('RGBA', (kk.width, kk.height + pad), (0, 0, 0, 0))
        comp.alpha_composite(kk, (0, pad))
        comp.alpha_composite(sg, (int(kk.width * 0.52), 0))
        _cache[kkey] = comp
        print('  kiosk SHOP sign composed (%dx%d)' % comp.size)
    except Exception as e:
        print('  kiosk sign failed', e)
    try_place(['ME_Singles_City_Props_48x48_Kiosk_Mushroom_1.png'],
              2300, 545, solid=SHOP_BOX, layer=True, colors=28)

# ---- 🌱 THE GARDEN (P3b/W3) — soil beds, 4 slots each ----------------------
# The bed is the graveyard family's Dirt_Ditch_1 — a 3×3-tile patch of dug
# earth with torn-grass edges (no farm/planter family exists in the pack; the
# only true turned-soil rectangle lives here). Slots are marked with the
# Terrains Props_Dirt speckles so each reads as its own patch. Baked, solid,
# NOT layered — the growing plants are client overlays and must draw on top.
# ⚠️ TUPLE ORDER IS THE SLOT CONTRACT — new beds APPEND, never insert.
# v1 pairs (LIVE production slots): site A (meadow) 0-7 · site B (playground)
# 8-15 · site C (NE, the lawn the stand freed) 16-23. v2 pairs (the 31 Jul
# doubling — each site gains a second pair beside its first): A2 24-31 south
# of A · B2 32-39 south of B · C2 40-47 north of C. Site D (same pass): a
# FOURTH site of two pairs on the pond's SE bank lawn, south of the W road,
# slots 48-63.
# 🌱 the six expansion sites live at MODULE scope — build_weed_grid()
# rejects them too, and it runs whether or not the pack is present.
# ⚠️ EVERY ONE OF THESE WAS MOVED after the first review plate: the free-lawn
# scan alone is NOT enough. It passed a bed straight through the mushroom SHOP
# and clipped the north tree line, because WEED_GRID only says "no weed here" —
# it does not know about overlay ART, which is drawn from a base line and hangs
# far above it (a canopy is 147x110 over a 26px trunk). Positions are now
# checked against OB_RECTS + the overlay BOXES + every live slot + the world
# border, with 60-90px of walking room between footprints.
GROW_SITES = ((1790, 170), (2110, 170), (2420, 170),   # the north strip, above the trees
              (1870, 780), (1550, 830))                # the lawn west of sites A/A2
PLOTS = []
if HAVE_PACK:
    # each bed = TWO ditches side by side (the ditch soil is ~52px wide — one
    # slot column each, two rows), so every slot sits ON dug earth
    BEDS = ((2270, 862), (2408, 862), (288, 862), (426, 862),
            (1980, 500), (2118, 500),                    # ← the v1 contract
            (2200, 970), (2338, 970), (288, 970), (426, 970),
            (1960, 390), (2098, 390),                    # ← v2 appends only
            (650, 760), (788, 760), (650, 868), (788, 868))   # ← site D
    # 🌱 EXPANSION SITES (29 Jul) — six more 8-slot sites, slots 64-111.
    # ⭐ They ship in the geo FROM DAY ONE and the ParkRoom decides which beds
    # are OPEN; a closed bed is never plantable and never rendered. That is what
    # keeps the never-reindex contract intact — growing the garden unlocks
    # indices that already exist instead of appending new ones later, so no
    # stored slot can ever shift under a live plant.
    # Positions scanned against WEED_GRID (the generator's own free-lawn list,
    # which already rejects roads / beds / plaza / pond / colliders), each with
    # a clear 250x110 footprint, 80px of walking room between footprints and
    # from every existing slot. Trym's constraint: nothing on the fountain or
    # its surrounds — the open ground is the TOP RIGHT and the BOTTOM RIGHT,
    # left of the existing boxes. The meadow is grazing, not a keep-out.
    for gx, gb in BEDS:
        for sx in (gx - 30, gx + 30):
            place('ME_Singles_Graveyard_48x48_Dirt_Ditch_1.png', sx, gb,
                  solid=('rect', -28, -50, 28, 4), colors=28, sh=0.36)
            for sy in (gb - 62, gb - 24):
                place('ME_Singles_Terrains_and_Fences_48x48_Props_Dirt_1.png',
                      sx, sy + 12, shade=False, scale=PROP * 0.9)
                PLOTS.append((sx, sy))
    # the never-reindex assertion: slots 0-23 hold LIVE plants in production —
    # their coordinates and order are frozen forever
    assert PLOTS[:24] == [
        (2240, 800), (2240, 838), (2300, 800), (2300, 838),
        (2378, 800), (2378, 838), (2438, 800), (2438, 838),
        (258, 800), (258, 838), (318, 800), (318, 838),
        (396, 800), (396, 838), (456, 800), (456, 838),
        (1950, 438), (1950, 476), (2010, 438), (2010, 476),
        (2088, 438), (2088, 476), (2148, 438), (2148, 476)], 'v1 slots moved!'
    # ⚠️ NOT BAKED, and that is the whole point: an UNOPENED bed has to be
    # plain lawn you walk over, so the expansion sites are CLIENT art — the
    # ditch sprite (g-bed.png) and its collider are laid down only while the
    # bed is open, and lifted again when it grows over. Baking them would put
    # six permanent dirt rectangles in the park that nobody can plant in.
    # Same tuple order rule as above: two ditch pairs per site, so the slots
    # still group in clean eights.
    GROW_DITCHES = []
    for X, Y in GROW_SITES:
        for gx in (X + 30, X + 168):
            for sx in (gx - 30, gx + 30):
                GROW_DITCHES.append((sx, Y + 62))     # x, BASE — as place() takes it
                for sy in (Y, Y + 38):
                    PLOTS.append((sx, sy))
    # ⚠️ the v2 doubling is live too — slots 24-63 hold real plants
    assert PLOTS[63] == (818, 844), 'v2 slots moved!'
    assert len(GROW_DITCHES) == len(GROW_SITES) * 4
    assert len(PLOTS) == 64 + len(GROW_SITES) * 8, 'PLOTS drifted: %d' % len(PLOTS)
    # every site is exactly 8 slots, so BEDS groups PLOTS in eights
    assert len(PLOTS) % 8 == 0
    # 🌼 the growth-stage sprites the client lays over the slots — pack art,
    # same neutral processing as every prop, saved at PROP scale
    # 🛏 the bed itself, for the beds the client lays down (see GROW_DITCHES).
    # Same file and the same processing as the baked ones, so an opened bed is
    # pixel-identical to one that was always there.
    try:
        _b = blockify(dedisc(load_pack('ME_Singles_Graveyard_48x48_Dirt_Ditch_1.png')),
                      factor=1, colors=28, warm=0.0, sat=1.0, con=1.0)
        _b = _b.resize((max(1, int(_b.width * PROP)), max(1, int(_b.height * PROP))), Image.NEAREST)
        _b.save(os.path.join(OUT, 'g-bed.png'), optimize=True)
        print('  g-bed.png: %dx%d (the client lays these for opened beds)' % (_b.width, _b.height))
    except Exception as e:
        print('  bed sprite failed', e)
    for src, out in (('ME_Singles_Garden_48x48_Medium_Sprout_2.png', 'g-sprout1.png'),
                     ('ME_Singles_Garden_48x48_Big_Sprout_2.png', 'g-sprout2.png'),
                     ('ME_Singles_Garden_48x48_Medium_White_Flower.png', 'g-daisy.png'),
                     ('ME_Singles_Garden_48x48_Medium_Sunflower.png', 'g-sunflower.png'),
                     ('ME_Singles_Garden_48x48_Medium_Light_Blue_Flower.png', 'g-tulip.png')):
        try:
            s = blockify(load_pack(src), factor=1, colors=28, warm=0.0, sat=1.0, con=1.0)
            s = s.resize((max(1, int(s.width * PROP)), max(1, int(s.height * PROP))), Image.NEAREST)
            s.save(os.path.join(OUT, out), optimize=True)
            print('  %s: %dx%d' % (out, s.width, s.height))
        except Exception as e:
            print('  garden sprite failed', src, e)
    # 💧 wet/dry soil patches — the farm pack only has square Soil_Wet fill
    # tiles (wrong palette + shape for the ditch), so both states derive from
    # the ditch's OWN soil pixels: same texture, wet = darker/cooler, dry =
    # lighter/warmer. Same ragged ellipse mask on both so the flip never
    # changes shape. Client lays one per PLANTED slot; empty soil = the plate.
    # ⚠️ locals here must NOT shadow the plate globals (px/px2/px3) — an
    # earlier draft bound px2 to the patch and broke every later plate write
    try:
        sdd = load_pack('ME_Singles_Graveyard_48x48_Dirt_Ditch_1.png').convert('RGBA')
        scw, sch = 52, 34
        sbase = sdd.crop(((sdd.width - scw) // 2, (sdd.height - sch) // 2,
                          (sdd.width + scw) // 2, (sdd.height + sch) // 2))
        for sout, smul in (('g-soil-wet.png', (0.66, 0.68, 0.78)),
                           ('g-soil-dry.png', (1.24, 1.14, 0.94))):
            srng2 = random.Random(77)
            simg = sbase.copy()
            spx = simg.load()
            for sy_ in range(sch):
                for sx_ in range(scw):
                    r0, g0, b0, a0 = spx[sx_, sy_]
                    sdist = ((sx_ - scw / 2) / (scw / 2)) ** 2 + ((sy_ - sch / 2) / (sch / 2)) ** 2
                    if not a0 or sdist > 1.0 - srng2.random() * 0.24:
                        spx[sx_, sy_] = (0, 0, 0, 0)
                        continue
                    spx[sx_, sy_] = (min(255, int(r0 * smul[0])), min(255, int(g0 * smul[1])),
                                     min(255, int(b0 * smul[2])), a0)
            simg = simg.resize((max(1, int(scw * PROP)), max(1, int(sch * PROP))), Image.NEAREST)
            simg.save(os.path.join(OUT, sout), optimize=True)
            print('  %s: %dx%d' % (sout, simg.width, simg.height))
    except Exception as e:
        print('  soil patch failed', e)
    # 🪓 DIRT CLODS — the flying earth of a dig. Sampled from the ditch's OWN
    # soil so the burst is the same dirt as the bed, at the same 28 colours;
    # 3 clod shapes on one strip, the client picks per particle.
    try:
        cw = 10
        clods = Image.new('RGBA', (cw * 3, cw), (0, 0, 0, 0))
        crng = random.Random(404)
        src = sbase.resize((cw * 3, cw), Image.NEAREST)
        spx2, cpx = src.load(), clods.load()
        for ci in range(3):
            for yy in range(cw):
                for xx in range(cw):
                    d2 = ((xx - cw / 2 + 0.5) / (cw / 2)) ** 2 + ((yy - cw / 2 + 0.5) / (cw / 2)) ** 2
                    if d2 > 0.7 + crng.random() * 0.5:
                        continue
                    r0, g0, b0, a0 = spx2[ci * cw + xx, yy]
                    if not a0:
                        continue
                    cpx[ci * cw + xx, yy] = (int(r0 * 0.9), int(g0 * 0.86), int(b0 * 0.8), 255)
        clods = clods.resize((int(cw * 3 * PROP), int(cw * PROP)), Image.NEAREST)
        clods.save(os.path.join(OUT, 'g-clod.png'), optimize=True)
        print('  g-clod.png: %dx%d (3 clods, cut from the ditch soil)' % clods.size)
    except Exception as e:
        print('  clod strip failed', e)
    # 🌼 ROADSIDE BORDER FLOWERS — the pack's Small_* flower singles: one
    # stage, no watering, four colour kinds the client plants on BORDER_SPOTS
    # (⚠️ ids must match BORDER_FLOWERS in park-garden.js + BORDER_KINDS in
    # worker-rave/src/index.js)
    for src, out in (('ME_Singles_Garden_48x48_Small_Yellow_Flower.png', 'b-marigold.png'),
                     ('ME_Singles_Garden_48x48_Small_Red_Flower.png', 'b-poppy.png'),
                     ('ME_Singles_Garden_48x48_Small_Light_Blue_Flower.png', 'b-bluebell.png'),
                     ('ME_Singles_Garden_48x48_Small_Pink_Flower.png', 'b-primrose.png')):
        try:
            s = blockify(load_pack(src), factor=1, colors=28, warm=0.0, sat=1.0, con=1.0)
            s = s.resize((max(1, int(s.width * PROP)), max(1, int(s.height * PROP))), Image.NEAREST)
            s.save(os.path.join(OUT, out), optimize=True)
            print('  %s: %dx%d' % (out, s.width, s.height))
        except Exception as e:
            print('  border flower failed', src, e)

# ---- 🌿 W1 WEEDS — the entropy sprite (Modern Farm pack, native 48px) ------
# Trym's call: Crop_Grain_ROTTEN — the grey-brown withered bush beside the
# golden ripe grain. Variant 2 is the SAME sprite mirrored (placement variety).
# ⚠️ the golden Crop_Grain_Ripe stays reserved — it may become a W3 crop.
FARM = os.path.expanduser(r'~\OneDrive\banana-art-pack\Modern_Farm_v1.2\48x48')
if os.path.isdir(FARM):
    import glob as _glob
    try:
        f = _glob.glob(os.path.join(FARM, '**', 'Crop_Grain_Rotten_48x48.png'), recursive=True)[0]
        s = blockify(Image.open(f).convert('RGBA'), factor=1, colors=28,
                     warm=0.0, sat=1.0, con=1.0)
        s = s.resize((max(1, int(s.width * PROP)), max(1, int(s.height * PROP))), Image.NEAREST)
        s.save(os.path.join(OUT, 'w-weed1.png'), optimize=True)
        s.transpose(Image.FLIP_LEFT_RIGHT).save(os.path.join(OUT, 'w-weed2.png'), optimize=True)
        print('  w-weed1/2.png: %dx%d (Crop_Grain_Rotten)' % (s.width, s.height))
    except Exception as e:
        print('  weed sprite failed', e)

# ---- 🗑 LITTER PICKUPS — the city pack's own small trash pieces ------------
# Crumpled paper / crushed milk carton / juice box (16-22px world after
# scale). Walk-over pickups on the weed grid: client sprites only, no
# placement, no geometry.
if HAVE_PACK:
    for src, out, sc in (('ME_Singles_City_Props_48x48_Paper_Trash.png', 't-litter1.png', PROP),
                         ('ME_Singles_City_Props_48x48_Milk_Trash_1.png', 't-litter2.png', PROP * 0.72),
                         ('ME_Singles_City_Props_48x48_Orange_Juice_Trash.png', 't-litter3.png', PROP * 0.72)):
        try:
            s = blockify(load_pack(src), factor=1, colors=28, warm=0.0, sat=1.0, con=1.0)
            s = s.resize((max(1, int(s.width * sc)), max(1, int(s.height * sc))), Image.NEAREST)
            s.save(os.path.join(OUT, out), optimize=True)
            print('  %s: %dx%d' % (out, s.width, s.height))
        except Exception as e:
            print('  litter sprite failed', src, e)

# ---- 🌾 W3 CROP STAGES — farm-pack growth sheets, baked per stage ----------
# Sheet grammar: 7 cols of 48px — col 0 sprout, 1-3 growing, 4-6 ripe; the
# art fills the TOP HALF (a numbers band sits below). Four stages baked per
# crop (cols 0/1/3/5) → c-<id>-1..4.png; client overlays only, no geometry.
if os.path.isdir(FARM):
    import glob as _glob
    for cid, cropsheet in (('tomato', 'Tomato_Growth_Stages_48x48.png'),
                           ('pumpkin', 'Pumpkin_Growth_Stages_48x48.png'),
                           ('wheat', 'Wheat_Growth_Stages_48x48.png')):
        try:
            f = _glob.glob(os.path.join(FARM, '**', cropsheet), recursive=True)[0]
            sheet = Image.open(f).convert('RGBA')
            arth = sheet.height // 2
            for n, col in enumerate((0, 1, 3, 5), 1):
                cell = sheet.crop((col * 48, 0, col * 48 + 48, arth))
                s = blockify(cell, factor=1, colors=28, warm=0.0, sat=1.0, con=1.0)
                s = s.resize((max(1, int(s.width * PROP)), max(1, int(s.height * PROP))), Image.NEAREST)
                s.save(os.path.join(OUT, 'c-%s-%d.png' % (cid, n)), optimize=True)
                print('  c-%s-%d.png: %dx%d' % (cid, n, s.width, s.height))
        except Exception as e:
            print('  crop stages failed', cid, e)

# ---- 🥀 THE RUINED PLANT — one sprite for every dead plant --------------
# A storm ruins half the beds, and the farm pack ships exactly one Rotten per
# crop with NO growth phases — so one universal corpse is both what the art
# supports and what Trym picked (strawberry). "Dead is dead" reads fine, and it
# means the client needs a single lookup rather than a rot sprite per stage.
# (Per-crop rot stays free if we ever want it: Tomato/Pumpkin/Grain all exist.)
if os.path.isdir(FARM):
    try:
        import glob as _g2
        f = _g2.glob(os.path.join(FARM, '**', 'Crop_Strawberry_Rotten_48x48.png'), recursive=True)[0]
        s_rot = blockify(Image.open(f).convert('RGBA'), factor=1, colors=28,
                         warm=0.0, sat=1.0, con=1.0)
        s_rot = s_rot.resize((max(1, int(s_rot.width * PROP)),
                              max(1, int(s_rot.height * PROP))), Image.NEAREST)
        s_rot.save(os.path.join(OUT, 'g-rot.png'), optimize=True)
        print('  g-rot.png: %dx%d (one corpse for every plant)' % s_rot.size)
    except Exception as e:
        print('  rot sprite failed', e)

# ---- 🐔 W2 ANIMALS — farm-pack wanderers (client-side, no placement) -------
# Each sheet's SIDE walk cycle = the walk band's first 6 contiguous frames,
# facing RIGHT (client flips by direction; frame 0 doubles as the standing
# pose). Chicken sheets are 48-tall rows; rooster/duck/rabbit are 96-tall
# bands (head overhangs the upper row). Sliced from the band, blockified
# once (trim=False — the animation-frame rule), saved at PROP scale.
if os.path.isdir(FARM):
    import glob as _glob

    def farm_strip(fname, out_name, band_y, cell_w, cell_h, scale=1.0):
        try:
            f = _glob.glob(os.path.join(FARM, 'Animals_48x48', '**', fname), recursive=True)[0]
            band = Image.open(f).convert('RGBA').crop((0, band_y, cell_w * 6, band_y + cell_h))
            s = blockify(band, factor=1, colors=28, warm=0.0, sat=1.0, con=1.0,
                         trim=False, outline=True)
            s = s.crop((1, 1, 1 + band.width, 1 + band.height))
            s = s.resize((int(cell_w * PROP * scale) * 6, int(cell_h * PROP * scale)), Image.NEAREST)
            s.save(os.path.join(OUT, out_name), optimize=True)
            print('  %s: 6f %dx%d' % (out_name, s.width // 6, s.height))
        except Exception as e:
            print('  animal strip failed', fname, e)

    # chickens/roosters = 48-wide cells; ducks/rabbits = 96-wide cells.
    # Ducks at 0.85 (Trym: they read big next to the world) — the client's
    # duck box/CSS width shrink with them, keep in sync.
    farm_strip('Chicken_Brown_48x48.png', 'a-chicken1.png', 48, 48, 48)
    farm_strip('Chicken_White_48x48.png', 'a-chicken2.png', 48, 48, 48)
    farm_strip('Rooster_Brown_48x48.png', 'a-rooster.png', 96, 48, 96)
    farm_strip('Duck_Green_Head_48x48.png', 'a-duck1.png', 96, 96, 96, scale=0.85)
    farm_strip('Duck_White_48x48.png', 'a-duck2.png', 96, 96, 96, scale=0.85)
    farm_strip('Rabbit_Brown_48x48.png', 'a-rabbit.png', 96, 96, 96)

    # 🥚 the egg pickups (trim=True — single sprites, tight box)
    for fname, out_name in (('Egg_White_48x48.png', 'e-egg.png'),
                            ('Egg_Golden_48x48.png', 'e-eggold.png')):
        try:
            f = _glob.glob(os.path.join(FARM, '**', fname), recursive=True)[0]
            s = blockify(Image.open(f).convert('RGBA'), factor=1, colors=28,
                         warm=0.0, sat=1.0, con=1.0)
            s = s.resize((max(1, int(s.width * PROP)), max(1, int(s.height * PROP))), Image.NEAREST)
            s.save(os.path.join(OUT, out_name), optimize=True)
            print('  %s: %dx%d' % (out_name, s.width, s.height))
        except Exception as e:
            print('  egg sprite failed', fname, e)

# ---- 🛝 the playground -----------------------------------------------------
if HAVE_PACK:
    # (the swings + spring riders were CUT — Trym: "they glitch". The SW lawn
    # stays open; future playground content is its own design conversation.)
    # picnic corner: benched tables between the playground lawn and the meadow
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


# SKIP_MID: most clusters sit the mid plate out ("most flowers gone" — W1c);
# mrng is its own stream so the lush plate's wrng layout never shifts
for _ in range(44):                                    # drifts, not confetti
    dx_, dy_ = wrng.randrange(mx0, mx1), wrng.randrange(my0, my1)
    col = BLOOM[wrng.randrange(len(BLOOM))]
    SKIP_MID[0] = mrng.random() < 0.72
    for _ in range(wrng.randrange(6, 14)):
        blossom(dx_ + wrng.randrange(-52, 52), dy_ + wrng.randrange(-34, 34), col)
for _ in range(16):                                    # strays past the edge
    SKIP_MID[0] = mrng.random() < 0.72
    blossom(wrng.randrange(1480, mx0), wrng.randrange(680, 990),
            BLOOM[wrng.randrange(len(BLOOM))])
SKIP_MID[0] = False

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
        SKIP_MID[0] = mrng.random() < 0.72
        for _ in range(wrng.randrange(2, 5)):
            blossom(bx_ + wrng.randrange(-14, 14), by_ + wrng.randrange(-9, 9), col)
SKIP_MID[0] = False

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
    # on the pavement (Trym round 8). The 4th = OLD PEEL's bench, just off
    # the plaza's SE rim looking at the fountain (the NPC overlay sits here —
    # OLDBENCH rides the geo contract).
    for bx, by, fl in ((768, 502, False), (1822, 618, True), (1285, 862, False),
                       (OLD_BENCH[0], OLD_BENCH[1], False)):
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
    # (the north sawhorse fell 30 Jul — that road now leads TO the stand)
    for sx, sy in ((332, 584),):                 # ON the west stub's end curve
        shadow(sx, sy - 4, saw.width * 0.38, 7)
        im.alpha_composite(saw, (sx - saw.width // 2, sy - saw.height))
        im2.alpha_composite(drab(saw), (sx - saw.width // 2, sy - saw.height))
        im3.alpha_composite(saw, (sx - saw.width // 2, sy - saw.height))
        COLLIDERS.append(('sawhorse', ('rect', -44, -18, 44, 4), sx, sy))
        SIGNS.append((sx, sy))

    # 🧭 THE WAY TO THE BAY — the east road ran off the map saying nothing, so
    # a waypost stands beside it (Trym, 30 Jul: "we need a sign to the beach by
    # the end of the road to the right"). The pack's Camping Sign_7: two BLANK
    # arrow planks — the only sign family in the set that isn't pre-lettered
    # "Camping" (Signboard_1/2 literally are, which is why the west stub got a
    # drawn sawhorse instead). Unflipped it points RIGHT, which is the way out.
    # ⚠️ the LETTERING is a DOM plank (banana-park.js), not baked pixels: a
    # 48px board cannot carry "Banana Bay" legibly at this scale, and the bay
    # already labels its stalls exactly this way. The arrow carries direction,
    # the plank carries the name.
    # NORTH of the road (its own shoulder, clear of the door trigger at 2700)
    # so a walker heading east passes it rather than bumps it.
    ROAD_SIGN = (2586, 516)

    # 🪧 THE POLE — DRAWN, not pack art (Trym: "this looks very weird … just
    # generate a thin pole as the post for both signs"). The pack's Camping
    # Sign_7 was a fat stack of arrow planks, and with a DOM plank hanging over
    # it the whole thing read as two signs stacked on each other. A signpost is
    # a plank on a pole; the plank is the DOM one, so all the art owes us is
    # the pole. Same drawn-prop route the west stub's sawhorse already takes
    # when the pack has nothing honest to offer.
    # Seeded into _cache under its own name so it rides place()'s ONE path —
    # plate, drab/sad twin, mid plate, y-sorted overlay and collider.
    def build_pole(h=62, w=6):
        K = 3
        s = Image.new('RGBA', (w * K, h * K), (0, 0, 0, 0))
        d = ImageDraw.Draw(s)
        d.rectangle([0, 0, w * K - 1, h * K - 1], fill=(52, 36, 21))            # outline
        d.rectangle([K, K, (w - 1) * K - 1, h * K - K - 1], fill=(124, 86, 47))  # wood
        d.rectangle([K, K, 2 * K - 1, h * K - K - 1], fill=(154, 108, 60))       # lit edge
        for gy in range(7, h - 5, 11):                                           # grain
            d.rectangle([2 * K, gy * K, (w - 2) * K - 1, gy * K + K - 1],
                        fill=(99, 68, 37))
        return blockify(s, factor=K, colors=6, alpha_thresh=0.4, trim=False)
    _POLE = '__waypost_pole.png'
    _cache[(_POLE, 1, 28, 0.0, 1.0, 1.0)] = build_pole()
    place(_POLE, ROAD_SIGN[0], ROAD_SIGN[1], scale=1.0, sh=0.9,
          layer=True, solid=('circle', 8))


# ---- 🌦 THE RAIN TILE --------------------------------------------------
# ONE seamless tile, scrolled by CSS transform, is the whole rain engine: no
# canvas, no element per drop, nothing for the rAF loop to do. Two copies at
# different speeds and opacities give parallax; the storm just tilts and speeds
# them up. Drawn rather than packed — rain is FX, not scenery (the same call as
# the algae ellipses and the sawhorse), and a tile has to wrap perfectly, which
# hand-placed pack art cannot.
# ⚠️ SEAMLESS BY CONSTRUCTION: every streak that runs off an edge is drawn a
# second time shifted by exactly one tile, so the wrap is invisible at any
# offset. The tile is SQUARE and the streak angle divides it evenly, so the same
# image tiles diagonally without a seam.
def build_rain(px=256, n=26, seed=4242, length=74, slant=26, alpha=120, width=1):
    """Long, sparse, EVEN diagonal stripes — the Stardew read (Trym's ref shot).

    ⚠️ REWRITTEN 31 Jul. The first tile drew 110-190 short strokes at random
    lengths and jitter, which from a distance is NOISE — a grey static wash
    rather than rain. Real pixel rain is a handful of LONG, THIN, EVENLY
    ANGLED lines with plenty of dark between them; the eye reads the gaps as
    much as the strokes. So: a quarter of the count, three times the length,
    ONE angle for every stroke, and no width jitter.
    """
    import random as _r
    rr = _r.Random(seed)
    t = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(t)
    for _ in range(n):
        x = rr.randrange(px)
        y = rr.randrange(px)
        a = alpha + rr.randrange(-25, 26)      # only the BRIGHTNESS varies
        col = (198, 222, 248, max(55, min(210, a)))
        # every stroke on the SAME diagonal, drawn nine times (self + the eight
        # neighbours) so whatever runs off an edge arrives on the opposite one
        for dx, dy in ((0, 0), (-px, 0), (px, 0), (0, -px), (0, px),
                       (-px, -px), (px, -px), (-px, px), (px, px)):
            d.line([(x + dx, y + dy), (x + dx + slant, y + dy + length)],
                   fill=col, width=width)
    return t.crop((0, 0, px, px))


if True:
    _rain = build_rain()
    _rain.save(os.path.join(OUT, 'rain.png'), optimize=True)
    # the storm sheet is the same field, denser and more slanted (wind)
    # the storm sheet: same clean lines, just more of them and steeper
    build_rain(n=54, seed=99, length=92, slant=40, alpha=150).save(
        os.path.join(OUT, 'rain-hard.png'), optimize=True)
    print('  rain.png + rain-hard.png (seamless %dx%d tiles)' % _rain.size)

# ---- 🌼 BORDER_SPOTS — roadside single-flower micro-spots (31 Jul) ---------
# ~24 spots on the road shoulders, picked off ROAD_SPINE like the blossom
# tufts but SPACED (120px+) and emitted into the geo contract: the community
# plants single 3-coin flowers here (server list rides the garden DO). A
# small bare-soil dot is baked per spot so an empty one reads as plantable.
# Runs AFTER every collider is declared (benches/rocks/sawhorse included).
BORDER_SPOTS = []
BORDER_POT = BORDER_POT_SAD = None
if HAVE_PACK:
    bsr = random.Random(2727)
    # the empty planter: the pack's sprout vase with its plant cropped off
    try:
        _v = load_pack('ME_Singles_Garden_48x48_Big_Sprout_Vase_2.png').convert('RGBA')
        _pot = _v.crop((0, 64, 48, 96))
        _pp = _pot.load()
        for _y in range(_pot.height):          # scrub the last leaf specks
            for _x in range(_pot.width):
                _r, _g, _b, _a = _pp[_x, _y]
                if _a and _g > _r + 10:
                    _pp[_x, _y] = (92, 62, 38, _a)
        _pot = _pot.crop(_pot.getbbox())
        BORDER_POT = _pot.resize((int(_pot.width * PROP * 0.78),
                                  int(_pot.height * PROP * 0.78)), Image.NEAREST)
        BORDER_POT_SAD = drab(BORDER_POT)
    except Exception as e:
        print('  border pot failed:', e)

    def border_clear(x, y):
        if not (BOUND + 30 < x < W - BOUND - 30 and BOUND + 40 < y < H - BOUND - 30):
            return False
        # r=10: only reject a spot sitting ON road ink — shoulder spots HUG
        # the lane (r=20 saw the lane edge from every shoulder and killed all)
        if on_road(x, y, 10):
            return False
        ex, ey = (x - CX) / (PLAZA_RX + 30.0), (y - CY) / (PLAZA_RY + 30.0)
        if ex * ex + ey * ey < 1:
            return False
        ex, ey = (x - pcx) / (prx + 40.0), (y - pcy) / (pry + 40.0)
        if ex * ex + ey * ey < 1:
            return False
        for _n, shape, ccx, cby in COLLIDERS:
            if shape[0] == 'circle':
                if (x - ccx) ** 2 + (y - cby) ** 2 < (shape[1] + 24) ** 2:
                    return False
            else:
                _, a, b2, c2, d2 = shape
                if ccx + a - 24 <= x <= ccx + c2 + 24 and cby + b2 - 24 <= y <= cby + d2 + 24:
                    return False
        # ⚠️ THE CORE 64 ONLY. BORDER_SPOTS is a LIVE CONTRACT — the server
        # stores each roadside flower by its spot INDEX, so a spot that moves
        # teleports somebody's named flower to a different roadside. Testing
        # against the expansion plots as well pushed spots 0/2/3 (the loop
        # rejects one and then picks a different one downstream) and re-baked
        # their pots into the plate. The expansion sites are checked against
        # BORDER_SPOTS from the other side instead, where nothing is at stake.
        for sx_, sy_ in PLOTS[:64]:
            if abs(x - sx_) < 60 and abs(y - sy_) < 60:
                return False
        return True

    for i in range(0, len(ROAD_SPINE), 36):
        if len(BORDER_SPOTS) >= 26:
            break
        sx_, sy_, pxn, pyn, hw = ROAD_SPINE[i]
        side = 1 if (i // 36) % 2 == 0 else -1
        off = hw + 18 + bsr.randrange(0, 10)
        bx_, by_ = int(sx_ + pxn * off * side), int(sy_ + pyn * off * side)
        if not border_clear(bx_, by_):
            continue
        if any((bx_ - qx) ** 2 + (by_ - qy) ** 2 < 120 * 120 for qx, qy in BORDER_SPOTS):
            continue
        BORDER_SPOTS.append((bx_, by_))
        # ⚠️ was a faint bare-soil dot — Trym couldn't tell it was plantable
        # ("not intuitive enough"). Now an EMPTY TERRACOTTA POT: the pack's
        # Big_Sprout_Vase cropped to its pot (the plant above y=64 discarded,
        # stray greens scrubbed to soil) — a pot with visible earth reads
        # "put something in me" at a glance.
        if BORDER_POT is not None:
            shadow(bx_, by_ + 2, BORDER_POT.width * 0.42, 5)
            im.alpha_composite(BORDER_POT, (bx_ - BORDER_POT.width // 2,
                                            by_ - BORDER_POT.height + 4))
            im2.alpha_composite(BORDER_POT_SAD, (bx_ - BORDER_POT.width // 2,
                                                 by_ - BORDER_POT.height + 4))
            im3.alpha_composite(BORDER_POT, (bx_ - BORDER_POT.width // 2,
                                             by_ - BORDER_POT.height + 4))
    assert 18 <= len(BORDER_SPOTS) <= 26, 'border spots drifted: %d' % len(BORDER_SPOTS)
    print('border spots: %d' % len(BORDER_SPOTS))

# ---- 🫧 ALGAE_SPOTS — the weed lattice ON the pond surface -----------------
# Scum patches spawn on these (server list rides the garden DO, ~half the
# weed beat). Inset from the lip so a patch never touches the shore tiles;
# the lily pads stay clear. Water-surface FX, nothing baked here.
ALGAE_SPOTS = []
for gy in range(pcy - pry + 36, pcy + pry - 35, 40):
    for gx in range(pcx - prx + 44, pcx + prx - 43, 46):
        if (abs(gx - pcx) / float(prx - 48)) ** 2.6 + (abs(gy - pcy) / float(pry - 40)) ** 2.6 > 1.0:
            continue
        if any((gx - lx) ** 2 + (gy - ly) ** 2 < 36 ** 2 for lx, ly in LILY):
            continue
        ALGAE_SPOTS.append((gx, gy))
assert 20 <= len(ALGAE_SPOTS) <= 44, 'algae lattice drifted: %d' % len(ALGAE_SPOTS)
print('algae spots: %d' % len(ALGAE_SPOTS))

# ---- 🍂 LEAF PILE — the sad-phase rake pickup ------------------------------
# ⚠️ neither pack has a leaf-pile prop (searched Leaf/Leaves/Pile in the
# Exteriors themes + the farm pack — only clover groups and falling-leaf
# vfx). DRAWN mound, but in the AUTUMN TREES' OWN palette: colours sampled
# from the Camping autumn twins so the pile matches the wilted park exactly.
if HAVE_PACK:
    try:
        at = load_pack('ME_Singles_Camping_48x48_Tree_19.png').convert('RGBA')
        ap = at.load()
        from collections import Counter
        acnt = Counter()
        for y in range(at.height):
            for x in range(at.width):
                c = ap[x, y]
                # crown leaves only: warm autumn colours, no trunk darks
                if c[3] and c[0] > c[1] and c[0] > 90 and c[0] + c[1] + c[2] > 220:
                    acnt[c[:3]] += 1
        APAL = [c for c, _ in acnt.most_common(5)] or [(196, 120, 52)]
        lrng = random.Random(1717)
        lw, lh = 42, 22
        leaf = Image.new('RGBA', (lw, lh), (0, 0, 0, 0))
        lp = leaf.load()
        for y in range(lh):
            for x in range(0, lw, 2):
                dd = ((x - lw / 2) / (lw / 2 - 1.0)) ** 2 + ((y - (lh - 3)) / float(lh - 4)) ** 2
                if dd <= 1.0 and lrng.random() < (1.18 - dd):
                    col = APAL[lrng.randrange(len(APAL))]
                    for ox in (0, 1):   # 2px blocks — the banana-density grid
                        if x + ox < lw:
                            lp[x + ox, y] = col + (255,)
        # a few stray leaves flicked off the top of the mound
        for _ in range(5):
            sx_, sy_ = lrng.randrange(6, lw - 7), lrng.randrange(0, 6)
            col = APAL[lrng.randrange(len(APAL))]
            lp[sx_, sy_] = col + (255,)
            lp[sx_ + 1, sy_] = col + (255,)
        leaf = blockify(leaf, factor=1, colors=8, warm=0.0, sat=1.0, con=1.0)
        leaf.save(os.path.join(OUT, 'l-leaf1.png'), optimize=True)
        leaf.transpose(Image.FLIP_LEFT_RIGHT).save(os.path.join(OUT, 'l-leaf2.png'), optimize=True)
        print('  l-leaf1/2.png: %dx%d (drawn, autumn-tree palette)' % leaf.size)
    except Exception as e:
        print('  leaf pile failed', e)

# ---- 🐦 BIRDHOUSES — 4 bare posts baked, houses are client overlays --------
# The pack's Garden bird houses (48x96: house y0-51, pole y52-71, base
# y72-95). The bare post = the pole+base rows with their own outline; the
# built overlay = the FULL sprite at the same box, so it covers the baked
# post exactly. Four colours, one per post (client picks by spot index).
BIRD_SPOTS = []
if HAVE_PACK:
    try:
        for ci, colr in enumerate(('Red', 'Blue', 'Brown', 'Pink')):
            s = blockify(load_pack('ME_Singles_Garden_48x48_%s_Little_Bird_House.png' % colr),
                         factor=1, colors=28, warm=0.0, sat=1.0, con=1.0,
                         trim=False, outline=True)
            s = s.crop((1, 1, 49, 97))
            s = s.resize((max(1, int(48 * PROP)), max(1, int(96 * PROP))), Image.NEAREST)
            s.save(os.path.join(OUT, 'bh-house-%d.png' % (ci + 1)), optimize=True)
            print('  bh-house-%d.png: %dx%d' % (ci + 1, s.width, s.height))
        post = load_pack('ME_Singles_Garden_48x48_Red_Little_Bird_House.png').crop((0, 52, 48, 96))
        post = blockify(post, factor=1, colors=14, warm=0.0, sat=1.0, con=1.0,
                        trim=False, outline=True).crop((1, 1, 49, 45))
        _cache[('bh-post', 1, 28, 0.0, 1.0, 1.0)] = post
    except Exception as e:
        print('  birdhouse sprites failed', e)

    def post_clear(x, y, why=None):
        """a post must sit off roads/plaza/pond, clear of colliders, plots,
        border spots — and its future HOUSE overlay must not hide behind a
        tree crown (checked against the PLACED boxes, which are exact)."""
        def no(reason):
            if why is not None:
                why.append('(%d,%d) %s' % (x, y, reason))
            return False
        if on_road(x, y, 26):
            return no('road')
        ex, ey = (x - CX) / (PLAZA_RX + 40.0), (y - CY) / (PLAZA_RY + 40.0)
        if ex * ex + ey * ey < 1:
            return no('plaza')
        ex, ey = (x - pcx) / (prx + 50.0), (y - pcy) / (pry + 50.0)
        if ex * ex + ey * ey < 1:
            return no('pond')
        for _n, shape, ccx, cby in COLLIDERS:
            if shape[0] == 'circle':
                if (x - ccx) ** 2 + (y - cby) ** 2 < (shape[1] + 26) ** 2:
                    return no('collider %s' % _n)
            else:
                _, a, b2, c2, d2 = shape
                if ccx + a - 26 <= x <= ccx + c2 + 26 and cby + b2 - 26 <= y <= cby + d2 + 26:
                    return no('collider %s' % _n)
        for sx_, sy_ in PLOTS:
            if abs(x - sx_) < 60 and abs(y - sy_) < 60:
                return no('plot')
        for qx, qy in BORDER_SPOTS:
            if (x - qx) ** 2 + (y - qy) ** 2 < 46 ** 2:
                return no('border spot')
        # the house overlay box (x±19, y-74..y): a tree crown over it would
        # bury the built house (trees layer above the plate)
        hx0, hy0, hx1, hy1 = x - 19, y - 74, x + 19, y
        for name, (bx0, by0, bx1, by1) in PLACED:
            if 'Tree_' in name and bx0 < hx1 and bx1 > hx0 and by0 < hy1 and by1 > hy0:
                return no('tree box %s (%d,%d,%d,%d)' % (name, bx0, by0, bx1, by1))
        return True

    # near the tree clumps, visible from the paths — each post walks a short
    # candidate spiral from its wanted seat until post_clear passes (trees are
    # deterministic, so the resolved coords are stable run to run)
    for wx_, wy_ in ((1060, 390), (1548, 302), (1076, 1000), (2470, 706)):
        seat = None
        for ox, oy in ((0, 0), (18, 0), (-18, 0), (0, 18), (0, -18), (26, 14),
                       (-26, 14), (26, -14), (-26, -14), (40, 0), (-40, 0),
                       (0, 34), (52, 20), (-52, 20), (64, 0), (0, -40), (64, 30),
                       (78, -28), (96, -8), (96, 12), (-96, 0), (-80, -30),
                       (110, -10), (0, -60), (30, -60), (-30, -60), (110, 20)):
            why = []
            if post_clear(wx_ + ox, wy_ + oy, why):
                seat = (wx_ + ox, wy_ + oy)
                break
            print('  post cand rejected: %s' % why[0])
        assert seat, 'no clear seat for bird post near (%d,%d)' % (wx_, wy_)
        place('bh-post', seat[0], seat[1], solid=('circle', 12), sh=0.2)
        BIRD_SPOTS.append(seat)
    assert len(BIRD_SPOTS) == 4
    print('bird posts: %s' % BIRD_SPOTS)

# ---- 🐦 THE BIRDS — the Garden Birds pack ----------------------------------
# One 64x64 sheet per species = a 4x4 grid of 16x16 frames, EVERY FRAME
# FACING LEFT (the client flips by CSS whenever a bird moves right).
# ⭐ VERIFIED row map (frame bboxes + hashes, not guesswork):
#   row 0 — FLY: a 4-frame flap, f1 == f3 (the ping-pong mid-stroke)
#   row 1 — TAKEOFF: idle → crouch → wings spread → wings up (f4 == the idle
#           pose that opens rows 2 and 3); exported but unused so far
#   row 2 — PECK/FEED: the body lowers frame by frame and holds down (f10 ==
#           f11), then snaps back up — the park's "sit and forage" idle
#   row 3 — WALK/HOP: idle, step, idle, other step (f12 == f14 == the idle)
# Exported WHOLE at NEAREST x2 (16px art -> 32px, small beside the ~99px
# banana) with NO blockify: this pack is already tight, low-colour and
# outlined, and the park's usual quantise+outline pass only muddies it.
# The client picks a row with background-position-y and steps() the columns.
BIRDS_PACK = os.path.expanduser(r'~\OneDrive\banana-art-pack\Garden Birds_Download'
                                r'\Garden Birds_Download\Spritesheets')
BIRD_SPECIES = []
if os.path.isdir(BIRDS_PACK):
    for fname in sorted(os.listdir(BIRDS_PACK)):
        if not fname.startswith('spritesheet_') or not fname.endswith('.png'):
            continue          # (the combined 'Spritesheet.png' is skipped)
        slug = fname[12:-4].replace('_', '-').replace(' ', '-').replace("'", '')
        s = Image.open(os.path.join(BIRDS_PACK, fname)).convert('RGBA')
        assert s.size == (64, 64), '%s is %s — not a 4x4 grid of 16px frames' % (fname, s.size)
        s.resize((128, 128), Image.NEAREST).save(
            os.path.join(OUT, 'bird-%s.png' % slug), optimize=True)
        BIRD_SPECIES.append(slug)
    assert len(BIRD_SPECIES) == 12, 'expected 12 bird species, got %d' % len(BIRD_SPECIES)
    print('birds: %d species (128x128, 4x4 @ x2) %s' % (len(BIRD_SPECIES), BIRD_SPECIES))

# ---- 🌿 WEED_GRID — the organism board (Weeds 2.0) -------------------------
# Every lawn point a weed may claim: a 48px lattice rejecting roads (24px
# clearance), colliders (+16px), the garden-bed zones, plaza + pond (+margin)
# and the world border. The server grows weed patches across it.
def build_weed_grid():
    BED_ZONES = ((200, 750, 520, 1005),      # sites B + B2 (SW, two bed rows)
                 (2100, 750, 2500, 1005),    # sites A + A2 (meadow, two rows)
                 (1870, 275, 2210, 520),     # sites C + C2 (NE, two rows)
                 (560, 640, 880, 900))       # site D (pond bank, two rows)
    # 🌱 the six expansion sites, derived from the same coordinates so the
    # zones can never drift out of step with the beds themselves
    BED_ZONES = BED_ZONES + tuple(
        (X - 46, Y - 76, X + 244, Y + 70) for X, Y in GROW_SITES)

    def ok(x, y):
        if on_road(x, y, 24):
            return False
        ex, ey = (x - CX) / (PLAZA_RX + 40.0), (y - CY) / (PLAZA_RY + 40.0)
        if ex * ex + ey * ey < 1:
            return False
        ex, ey = (x - pcx) / (prx + 50.0), (y - pcy) / (pry + 50.0)
        if ex * ex + ey * ey < 1:
            return False
        for bx0, by0, bx1, by1 in BED_ZONES:
            if bx0 <= x <= bx1 and by0 <= y <= by1:
                return False
        for qx, qy in BORDER_SPOTS:              # a weed on a flower spot
            if (x - qx) ** 2 + (y - qy) ** 2 < 40 * 40:   # would read broken
                return False
        for _n, shape, cx, base in COLLIDERS:
            if shape[0] == 'circle':
                if (x - cx) ** 2 + (y - base) ** 2 < (shape[1] + 16) ** 2:
                    return False
            else:
                _, a, b, c, d = shape
                if cx + a - 16 <= x <= cx + c + 16 and base + b - 16 <= y <= base + d + 16:
                    return False
        return True

    grid = [(x, y) for y in range(BOUND + 24, H - BOUND - 23, 48)
            for x in range(BOUND + 24, W - BOUND - 23, 48) if ok(x, y)]
    # sanity: the construction IS the mask check — re-assert a sample anyway
    for gx, gy in grid[::17]:
        assert not on_road(gx, gy, 24) and ok(gx, gy)
    assert 300 <= len(grid) <= 900, 'weed grid count drifted: %d' % len(grid)
    return grid


# ---- emit the contract ----------------------------------------------------
def emit_geo():
    ob_rects, ob_circles = [], []
    for name, shape, cx, base in COLLIDERS:
        if shape[0] == 'rect':
            _, a, b, c, d = shape
            ob_rects.append((cx + a, base + b, cx + c, base + d))
        elif shape[0] == 'circle':
            ob_circles.append((cx, base, shape[1]))
    weed_grid = build_weed_grid()
    grid_js = '[%s]' % ','.join('[%d,%d]' % p for p in weed_grid)
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
    L.append('export const SIGNS = %s;' % [list(s) for s in SIGNS])
    L.append('export const ROAD_SIGN = %s;'
             % ('{ x: %d, y: %d }' % ROAD_SIGN if ROAD_SIGN else 'null'))
    L.append('export const OLDBENCH = %s;' % list(OLD_BENCH))
    L.append('export const MEADOW = %s;' % list(MEADOW))
    L.append('export const PLOTS = %s;' % [list(p) for p in PLOTS])
    # 🌱 which slots make up each BED, and how many of those beds are CORE.
    # The core beds are always open; the rest are the ones the park breaks open
    # when it fills and lets grow over when they sit empty (see park-beds-plan).
    L.append('export const BEDS = %s;'
             % [list(range(i, i + 8)) for i in range(0, len(PLOTS), 8)])
    L.append('export const CORE_BEDS = %d;' % (64 // 8))
    # the four ditch sprites of each EXPANSION bed (x, base), in bed order from
    # CORE_BEDS on, plus the collider every ditch carries. The client draws and
    # blocks these only while the bed is open — nothing here is in the plate.
    L.append('export const GROW_DITCHES = %s;'
             % [[list(d) for d in GROW_DITCHES[i:i + 4]] for i in range(0, len(GROW_DITCHES), 4)])
    L.append('export const BED_SOLID = [-28, -50, 28, 4];')
    L.append('export const BORDER_SPOTS = %s;' % [list(p) for p in BORDER_SPOTS])
    L.append('export const ALGAE_SPOTS = %s;' % [list(p) for p in ALGAE_SPOTS])
    L.append('export const BIRD_SPOTS = %s;' % [list(p) for p in BIRD_SPOTS])
    # the species the client may pick from = exactly the sheets exported above
    L.append('export const BIRD_SPECIES = [%s];'
             % ','.join("'%s'" % s for s in BIRD_SPECIES))
    L.append('export const DOORS = { south: { x: %d, y: %d }, east: { x: %d, y: %d } };'
             % (CX, H - 40, W - 60, CY))
    L.append('export const OB_RECTS = %s;' % [list(r) for r in ob_rects])
    L.append('export const OB_CIRCLES = %s;' % [list(c) for c in ob_circles])
    L.append('export const OVERLAYS = %s;' % [[o[0], o[1], o[2], o[3], o[4], o[5]] for o in OVERLAYS])
    L.append('export const TREE_OVS = %s;' % list(TREE_OVS))
    L.append('export const WEED_GRID = %s;' % grid_js)
    path = os.path.join(SITE, 'src', 'scripts', 'park-geo.js')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(L) + '\n')
    # the worker's copy — same array, its own module (wrangler bundles it)
    wpath = os.path.join(SITE, 'worker-rave', 'src', 'park-weed-grid.js')
    with open(wpath, 'w', encoding='utf-8') as f:
        f.write('// GENERATED by tools/build-park-scene.py — the park weed lattice.\n'
                '// DO NOT EDIT (twin of WEED_GRID in src/scripts/park-geo.js).\n'
                'export const WEED_GRID = %s;\n'
                'export const BORDER_SPOTS_N = %d;\n'
                'export const ALGAE_SPOTS = %s;\n'
                'export const BIRD_SPOTS_N = %d;\n'
                % (grid_js, len(BORDER_SPOTS),
                   '[%s]' % ','.join('[%d,%d]' % p for p in ALGAE_SPOTS), len(BIRD_SPOTS)))
    print('wrote park-geo.js  (%d rects, %d circles, %d overlays, %d weed-grid pts, %d border spots, %d algae, %d bird posts)'
          % (len(ob_rects), len(ob_circles), len(OVERLAYS), len(weed_grid), len(BORDER_SPOTS),
             len(ALGAE_SPOTS), len(BIRD_SPOTS)))


emit_geo()
# the geometry invariant: three plates, ONE placement pass, one canvas box
assert im2 is None or im2.size == im.size
assert im3 is None or im3.size == im.size
im.convert('RGB').save(os.path.join(OUT, 'park.png'), optimize=True)
print('wrote park.png (%dx%d) %.0f KB' % (W, H, os.path.getsize(os.path.join(OUT, 'park.png')) / 1024.0))
if im2 is not None:
    im2.convert('RGB').save(os.path.join(OUT, 'park-sad.png'), optimize=True)
    print('wrote park-sad.png %.0f KB + %d ov-sad overlays'
          % (os.path.getsize(os.path.join(OUT, 'park-sad.png')) / 1024.0, len(OVERLAYS)))
if im3 is not None:
    im3.convert('RGB').save(os.path.join(OUT, 'park-mid.png'), optimize=True)
    print('wrote park-mid.png %.0f KB (%d tree overlays marked)'
          % (os.path.getsize(os.path.join(OUT, 'park-mid.png')) / 1024.0, len(TREE_OVS)))
