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
# tier 3 runs EAST past the shared corner too — the top rung owns the WHOLE
# clearing (Trym: "i cant move my level 3 house here"); tiers 1-2 stay nested
FENCE_TIERS = {1: (17, 9, 27, 16), 2: (12, 7, 27, 16), 3: (7, 5, 34, 16)}
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
        # 🪵 PLAYER-BUILT FENCES — the BROWN LOG fence, cropped from the
        # pack's own composed sheet (2_Fences_48x48): true top-down verticals
        # (rails drawn downward), corners = full-height end posts the columns
        # run through. Tile coords read off the assembly (Trym's promo fence).
        _fsheet = Image.open(os.path.join(FARM, '2_Fences_48x48.png')).convert('RGBA')
        _FT = {'endl': (18, 11), 'endr': (24, 11), 'jl': (18, 11), 'jr': (24, 11),
               'h': (19, 11), 'h2': (22, 11), 'vw': (24, 13), 've': (21, 13),
               'vu': (18, 12), 'vb': (24, 14), 'gl': (25, 11), 'gr': (25, 11)}
        for _k, (_tx, _ty) in _FT.items():
            _fsheet.crop((_tx * T, _ty * T, _tx * T + T, _ty * T + T)).save(
                os.path.join(OUT, 'f-%s.png' % _k), optimize=True)
        print('  fence kit tiles (brown log): %d' % len(_FT))

# ---- 🪏 ORGANIC SOIL — the promo's terrain autotile (Trym: "we should
# use these, looks way more organic"). The Godot sheet stacks 14 terrains of
# 12x4 tiles; we pick the tilled-dirt block and EDGE-CLASSIFY its 48 tiles
# (green fringe on a side = that side is an outer edge) to map our 16
# neighbour masks. Engine keys unchanged — only the art swaps.
BED_W, BED_H = 280, 100          # legacy geometry, kept for old-save migration
SOIL_BLOCK = 8                   # the dark tilled field from the pack promo
_auto = os.path.join(FARM, 'Autotiles_48x48', 'Autotiles_Godot_48x48.png')
if os.path.isfile(_auto):
    _sheet = Image.open(_auto).convert('RGBA')

    def _tile(cx2, cy2):
        return _sheet.crop((cx2 * T, SOIL_BLOCK * 4 * T + cy2 * T, cx2 * T + T, SOIL_BLOCK * 4 * T + cy2 * T + T))

    def _edges(t):
        """True per side = OUTER edge (fringe/transparent), False = connected."""
        pt = t.load()
        out = []
        for side in range(4):
            greenish = 0
            for a in range(0, T, 2):
                for b in range(0, 8, 2):
                    x, y = ((a, b), (a, T - 1 - b), (b, a), (T - 1 - b, a))[side]
                    r0, g0, b0, a0 = pt[x, y]
                    if a0 < 128 or (g0 > r0 + 12 and g0 > b0 + 12):
                        greenish += 1
            out.append(greenish > 22)
        return out   # [N, S, W, E]

    _tiles = []
    for _cy in range(4):
        for _cx in range(12):
            _t = _tile(_cx, _cy)
            if _t.getextrema()[3][1] == 0:
                continue
            _n, _s2, _w2, _e2 = _edges(_t)
            _tiles.append((_n, _s2, _w2, _e2, _t))
    # our 16 keys: rows u/m/b × cols l/c(m)/r + strips + iso
    def _want(key):
        # (N-open, S-open, W-open, E-open) per key — open = fringe side
        table = {
            'iso': (1, 1, 1, 1), 'hl': (1, 1, 1, 0), 'hm': (1, 1, 0, 0), 'hr': (1, 1, 0, 1),
            'vu': (1, 0, 1, 1), 'vm': (0, 0, 1, 1), 'vb': (0, 1, 1, 1),
            'ul': (1, 0, 1, 0), 'um': (1, 0, 0, 0), 'ur': (1, 0, 0, 1),
            'ml': (0, 0, 1, 0), 'mc': (0, 0, 0, 0), 'mr': (0, 0, 0, 1),
            'bl': (0, 1, 1, 0), 'bm': (0, 1, 0, 0), 'br': (0, 1, 0, 1),
        }
        return table[key]
    _found = 0
    for _key in ('iso', 'hl', 'hm', 'hr', 'vu', 'vm', 'vb', 'ul', 'um', 'ur', 'ml', 'mc', 'mr', 'bl', 'bm', 'br'):
        _wn, _ws, _ww, _we = _want(_key)
        for _n, _s2, _w2, _e2, _t in _tiles:
            if (_n, _s2, _w2, _e2) == (bool(_wn), bool(_ws), bool(_ww), bool(_we)):
                _tw = _t.copy()
                _pw = _tw.load()
                for _y2 in range(T):
                    for _x2 in range(T):
                        _r2, _g2, _b2, _a2 = _pw[_x2, _y2]
                        if _a2 and _g2 > _r2 - 10 and _g2 > _b2:
                            _pw[_x2, _y2] = (int(_r2 * 0.7 + GRASS_TARGET[0] * 0.3),
                                             int(_g2 * 0.7 + GRASS_TARGET[1] * 0.3),
                                             int(_b2 * 0.7 + GRASS_TARGET[2] * 0.3), _a2)
                _tw.save(os.path.join(OUT, 's-%s.png' % _key), optimize=True)
                _found += 1
                break
        else:
            print('  SOIL MISSING mask', _key)
    # the template has no 1-tall/1-wide strips — compose them from edge halves
    def _compose(dst, a_key, b_key, vertical):
        A = Image.open(os.path.join(OUT, 's-%s.png' % a_key)).convert('RGBA')
        B = Image.open(os.path.join(OUT, 's-%s.png' % b_key)).convert('RGBA')
        out2 = Image.new('RGBA', (T, T), (0, 0, 0, 0))
        if vertical:   # top half of A over bottom half of B
            out2.paste(A.crop((0, 0, T, T // 2)), (0, 0))
            out2.paste(B.crop((0, T // 2, T, T)), (0, T // 2))
        else:          # left half of A beside right half of B
            out2.paste(A.crop((0, 0, T // 2, T)), (0, 0))
            out2.paste(B.crop((T // 2, 0, T, T)), (T // 2, 0))
        out2.save(os.path.join(OUT, 's-%s.png' % dst), optimize=True)
    for _dst, _a, _b, _v in (('hl', 'ul', 'bl', True), ('hm', 'um', 'bm', True),
                             ('hr', 'ur', 'br', True), ('vm', 'ml', 'mr', False)):
        try:
            _compose(_dst, _a, _b, _v)
            _found += 1
        except Exception as _e:
            print('  SOIL compose failed', _dst, _e)
    print('  organic soil pieces: %d/16 (block %d)' % (_found, SOIL_BLOCK))

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


# 📬🪧 the mailbox + sign are PLACEABLE now (Trym: "place the sign and
# mailbox where you want it") — exported as movers, defaults at the old spots
FIX_SIZES = {}
if HAVE_PACK:
    for fid, cands in (('mail', ['22_Post_Office_48x48_Red_Mailbox_1_Side_1.png',
                                 '22_Post_Office_48x48_Blue_Mailbox_1_Side_1.png']),
                       ('sign', ['ME_Singles_Camping_48x48_Wooden_Sign_1.png',
                                 'ME_Singles_Camping_48x48_Sign_1.png'])):
        sp2 = sprite(cands)
        if sp2 is not None:
            sp2.save(os.path.join(OUT, 'm-%s.png' % fid), optimize=True)
            FIX_SIZES[fid] = sp2.size
            print('  m-%s.png %dx%d' % (fid, sp2.width, sp2.height))

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
DECOR_SCALE = {'statue': 0.30, 'statue2': 0.30, 'coop': 0.43, 'crate': 0.55, 'fountain': 2 / 3.0}

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

# 🛋 M4.5 THE INDOOR CATALOG — Modern Interiors Theme_Sorter singles,
# chosen off the contact sheets (living room + bedroom). All stage 1: even the
# tent deserves furnishing. cat 'interior' -> surface 'floor' in the manifest.
TS = os.path.expanduser(r'~\OneDrive\banana-art-pack\moderninteriors-win\1_Interiors\48x48\Theme_Sorter_Singles_48x48')
LIV = ('2_Living_Room_Singles_48x48', 'Living_Room_Singles_48x48')
BEDS = ('4_Bedroom_Singles_48x48', 'Bedroom_Singles_48x48')
KIT = ('12_Kitchen_Singles_48x48', 'Kitchen_Singles_48x48')
JAP = ('20_Japanese_Interiors_48x48', 'Japanese_Interiors_Singles_48x48')
MUS = ('6_Music_and_Sport_48x48', 'Music_and_Sport_Singles_48x48')


def _ts(theme, n):
    return os.path.join(TS, theme[0], '%s_%d.png' % (theme[1], n))


BATH = ('3_Bathroom_Singles_48x48', 'Bathroom_Singles_48x48')
BASE = ('14_Basement_Singles_48x48', 'Basement_Singles_48x48')

# ⚠️ STANDING RULE (Trym): Theme_Sorter singles bake their theme FLOOR inside
# the furniture silhouette (under/between legs). Strip the measured floor
# palette before export or pieces carry a wrong-colour plinth onto our floors.
FLOOR_PALETTE = [
    ((0xa7, 0x97, 0x96), 14),   # mauve floor (living/bedroom/music)
    ((0xb3, 0x9a, 0x98), 14),   # mauve, lit row
    ((0xb4, 0x9c, 0x99), 14),   # mauve, lit row 2
    ((0x6b, 0x50, 0x52), 10),   # mauve floor shadow
    ((0x9c, 0x78, 0x6b), 8),    # warm floor under beds
    ((0xf1, 0xce, 0x8e), 10),   # bathroom cream tile
    ((0xe0, 0xb8, 0x70), 8),    # bathroom tile shading
    ((0xda, 0xa4, 0x63), 8),    # bathroom tile shadow
]


def indoor_sprite(path, scale, strip=True, overlap=0):
    # overlap: closed-ended modules (counters) merge their butted borders into
    # one divider; open-ended rug columns need exact abutment (overlap 0).
    try:
        if isinstance(path, tuple) and path and path[0] == 'crop':
            img = Image.open(path[1]).convert('RGBA').crop(path[2])
            img = img.crop(img.getbbox())
        elif isinstance(path, (list, tuple)):
            parts = [Image.open(p2).convert('RGBA') for p2 in path]
            # crop phantom canvas padding (no-op for rug columns — their
            # pattern fills the canvas edge); overlap then merges borders
            parts = [p2.crop(p2.getbbox()) for p2 in parts]
            img = Image.new('RGBA', (sum(p2.width for p2 in parts) - overlap * (len(parts) - 1),
                                     max(p2.height for p2 in parts)), (0, 0, 0, 0))
            x = 0
            for p2 in parts:
                img.paste(p2, (x, img.height - p2.height), p2)
                x += p2.width - overlap
        else:
            img = Image.open(path).convert('RGBA')
    except Exception:
        print('  MISSING', path)
        return None
    # Trym round 2: raw colour-matching cut holes in furniture that shares the
    # floor tones (piano lid, clock face). The floor patch always touches the
    # BOTTOM of the sprite — so FLOOD from the bottom edge (and from silhouette
    # edges in the lower half) through matching pixels; embedded look-alike
    # pixels higher up stay.
    if strip:
        px = img.load()
        W2, H2 = img.width, img.height
        def is_floor(x, y):
            r, g, b, a = px[x, y]
            if not a:
                return False
            for (cr, cg, cb), tol in FLOOR_PALETTE:
                if abs(r - cr) <= tol and abs(g - cg) <= tol and abs(b - cb) <= tol:
                    return True
            return False
        seen = set()
        stack = []
        for x in range(W2):
            for y in (H2 - 1, H2 - 2):
                if y >= 0 and is_floor(x, y):
                    stack.append((x, y))
        for y in range(H2 // 2, H2):
            for x in range(W2):
                if not is_floor(x, y):
                    continue
                for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                    if 0 <= nx < W2 and 0 <= ny < H2 and px[nx, ny][3] == 0:
                        stack.append((x, y))
                        break
        while stack:
            x, y = stack.pop()
            if (x, y) in seen or not is_floor(x, y):
                continue
            seen.add((x, y))
            for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if 0 <= nx < W2 and 0 <= ny < H2 and (nx, ny) not in seen:
                    stack.append((nx, ny))
        for x, y in seen:
            px[x, y] = (0, 0, 0, 0)
    if scale != 1.0:
        img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.NEAREST)
    return img
def compose_on(base_img, parts):
    # paste native-resolution accessories with their BASE at `by` on the
    # counter top — the pack's own showcase grammar (no fractional scaling).
    head = 0
    for pt, px_, by in parts:
        head = max(head, pt.height - by)
    cv = Image.new('RGBA', (base_img.width, base_img.height + head), (0, 0, 0, 0))
    cv.paste(base_img, (0, head), base_img)
    for pt, px_, by in parts:
        cv.paste(pt, (px_, head + by - pt.height), pt)
    return cv


# (id, name, cat, price, stage, file) — room-type shelves, all western.
# stage: 1 = tent up, 2 = cabin up, 3 = house only (the balance lever).
INDOOR_DEF = [
    # 🍳 kitchen
    ('stove', 'The stove', 'kitchen', 42, 2, _ts(KIT, 150)),
    ('coffeemk', 'Coffee counter', 'kitchen', 26, 2, [_ts(KIT, 121)] * 3),
    ('dinchair', 'Dining chair', 'kitchen', 10, 2, _ts(KIT, 284)),
    ('dinchair2', 'Dining chair (right)', 'kitchen', 10, 2, _ts(KIT, 280)),
    ('dinchair3', 'Dining chair (away)', 'kitchen', 10, 2, _ts(KIT, 279)),
    ('fridge', 'The fridge', 'kitchen', 32, 2, _ts(KIT, 161)),
    ('kcounter', 'Kitchen counter', 'kitchen', 18, 2, [_ts(KIT, 121)] * 3),
    ('stockcounter', 'Stocked counter', 'kitchen', 30, 2, [_ts(KIT, 121)] * 3),
    ('dinette', 'Small table', 'kitchen', 20, 2, _ts(KIT, 272)),
    ('famtable', 'Family table', 'kitchen', 44, 3, _ts(KIT, 310)),
    # 🛋 living room
    ('teatable', 'Gilded table', 'living', 20, 2, _ts(LIV, 3)),
    ('readlamp', 'Reading lamp', 'living', 14, 2, _ts(LIV, 86)),
    ('pottedplant', 'Potted plant', 'living', 8, 1, _ts(LIV, 16)),
    ('starryrug', 'Round rug', 'living', 10, 2, _ts(BEDS, 386)),
    ('greyrug', 'Grey rug', 'living', 12, 2, [_ts(BEDS, 357), _ts(BEDS, 358), _ts(BEDS, 359)]),
    ('ovalrug', 'Oval rug', 'living', 14, 2, [_ts(BEDS, 360), _ts(BEDS, 361), _ts(BEDS, 362)]),
    ('orangerug', 'Orange rug', 'living', 12, 2, [_ts(BEDS, 366), _ts(BEDS, 367), _ts(BEDS, 368)]),
    ('whitemat', 'White mat', 'living', 10, 2, [_ts(BEDS, 375), _ts(BEDS, 377)]),
    ('whiteoval', 'White oval rug', 'living', 14, 2, [_ts(BEDS, 378), _ts(BEDS, 379), _ts(BEDS, 380)]),
    ('longrug', 'Parlor rug', 'living', 14, 2, _ts(BEDS, 384)),
    ('dressercurio', 'Curio dresser', 'living', 30, 2, _ts(LIV, 56)),
    ('bigcabinet', 'Grand cabinet', 'living', 44, 3, _ts(LIV, 103)),
    ('tvset', 'Home cinema', 'living', 50, 3,
     ('crop', os.path.join(TS, '..', 'Theme_Sorter_48x48', '14_Basement_48x48.png'), (330, 2270, 505, 2400))),
    ('tvback', 'Telly (back)', 'living', 44, 3, [_ts(BASE, 160), _ts(BASE, 161), _ts(BASE, 162)]),
    ('whitechair', 'White armchair', 'living', 22, 3, _ts(BASE, 203)),
    ('bigcouch', 'Big couch', 'living', 56, 3,
     ('crop', os.path.join(TS, '..', 'Theme_Sorter_48x48', '14_Basement_48x48.png'), (290, 10, 428, 95))),
    ('sofa', 'Navy sofa', 'living', 30, 2, _ts(LIV, 6)),
    ('navychair', 'Navy armchair', 'living', 18, 2, _ts(LIV, 7)),
    ('telly', 'The telly', 'living', 40, 2, [_ts(BASE, 157), _ts(BASE, 158), _ts(BASE, 159)]),
    ('furnace', 'Old furnace', 'living', 26, 2, _ts(LIV, 113)),
    ('parlorplant', 'Parlor tree', 'living', 12, 3, _ts(LIV, 13)),
    # 🛏 bedroom
    ('cozybed', 'Cozy bed', 'bedroom', 36, 2, _ts(BEDS, 150)),
    ('nightstand', 'Nightstand', 'bedroom', 12, 2, _ts(LIV, 63)),
    ('dresser', 'Chest of drawers', 'bedroom', 22, 2, _ts(LIV, 51)),
    ('teddy', 'Teddy bear', 'bedroom', 10, 1, _ts(BEDS, 302)),
    ('bunnyplush', 'Bunny plush', 'bedroom', 12, 1, _ts(BEDS, 305)),
    ('whaleplush', 'Whale plush', 'bedroom', 14, 2, _ts(BEDS, 390)),
    ('robottoy', 'Toy robot', 'bedroom', 20, 2, _ts(BEDS, 509)),
    ('dresserlamp', 'Dresser + lamp', 'bedroom', 30, 2, _ts(LIV, 58)),
    ('bunkbed', 'Bunk bed', 'bedroom', 44, 2, _ts(BEDS, 126)),
    ('vanity', 'Vanity table', 'bedroom', 24, 2, _ts(LIV, 21)),
    ('deskset', 'Writing desk', 'bedroom', 22, 2, _ts(LIV, 26)),
    ('wardrobe', 'Wardrobe', 'bedroom', 38, 3, _ts(LIV, 37)),
    # 🛁 bathroom
    ('bathmat', 'Bath mat', 'bathroom', 8, 2, _ts(BATH, 77)),
    ('toilet', 'The toilet', 'bathroom', 20, 2, _ts(BATH, 21)),
    ('bvanity', 'Wash stand', 'bathroom', 28, 2, _ts(BATH, 5)),
    ('floormirror', 'Standing mirror', 'bathroom', 16, 2, _ts(BATH, 66)),
    ('towelrack', 'Towel rack', 'bathroom', 10, 2, _ts(BATH, 133)),
    ('washer', 'Washing machine', 'bathroom', 34, 2, _ts(BATH, 87)),
    ('bathtub', 'Bathtub', 'bathroom', 46, 3, _ts(BATH, 157)),
    # 🚪 hallway
    ('hallchair', 'Hall chair', 'hallway', 10, 2, _ts(LIV, 92)),
    ('hallshelf', 'Hall shelf', 'hallway', 14, 2, _ts(LIV, 45)),
    ('wcabinet', 'Wood cabinet', 'hallway', 26, 2, _ts(LIV, 39)),
    ('gclock', 'Grandfather clock', 'hallway', 34, 3, _ts(LIV, 89)),
    ('displaycab', 'Display cabinet', 'hallway', 30, 3, _ts(LIV, 91)),
    # 🎸 music
    ('micstand', 'Mic stand', 'music', 12, 2, _ts(MUS, 64)),
    ('pooltable', 'Pool table', 'music', 60, 3, _ts(BASE, 244)),   # + racked balls
    ('bluepool', 'Blue pool table', 'music', 60, 3, _ts(BASE, 245)),
    ('pingpong', 'Ping pong table', 'music', 55, 3, _ts(BASE, 241)),
    ('pingpong2', 'Green ping pong', 'music', 55, 3, _ts(BASE, 243)),
    ('arcade', 'Arcade cabinet', 'music', 40, 3, _ts(BASE, 219)),
    ('pinball', 'Pinball machine', 'music', 44, 3, _ts(BASE, 222)),
    ('unicycle', 'Unicycle', 'music', 16, 2, _ts(MUS, 61)),
    ('eguitar', 'Electric guitar', 'music', 24, 1, _ts(MUS, 55)),
    ('theamp', 'The amp', 'music', 20, 2, _ts(MUS, 43)),
    ('drumkit', 'Drum kit', 'music', 38, 3, [_ts(MUS, 41), _ts(MUS, 42)]),
    ('gpiano', 'Grand piano', 'music', 60, 3, _ts(MUS, 31)),
]
INDOOR_CATS = ['kitchen', 'living', 'bedroom', 'bathroom', 'hallway', 'music']
RUG_IDS = {'bathmat', 'starryrug', 'longrug', 'greyrug', 'ovalrug', 'orangerug', 'whitemat', 'whiteoval'}
SIT_DIRS = {'dinchair': 'l', 'dinchair2': 'r', 'dinchair3': 's', 'hallchair': 's',
            'navychair': 's', 'whitechair': 's', 'sofa': 's', 'bigcouch': 's',
            'bench': 's', 'benchv': 's', 'armchair': 's', 'chair': 's', 'stump': 's'}
# counters render at 1.0 (they must READ as work surfaces — Trym: "the kitchen
# counter must be larger"); rugs render big because the banana walks over them.
IN_SCALE = {'kcounter': 1.0, 'coffeemk': 1.0, 'stockcounter': 1.0,
            'starryrug': 4 / 3.0, 'longrug': 1.5, 'greyrug': 1.0, 'ovalrug': 1.0,
            'orangerug': 1.0, 'whitemat': 1.0, 'whiteoval': 1.0}
# accessory parts baked onto the K121 counter (native px, base-line y, x)
IN_COMPOSE = {
    'coffeemk': [(_ts(KIT, 185), 44, 30)],
    'stockcounter': [(_ts(LIV, 49), 22, 30), (_ts(KIT, 172), 168, 24)],
    'telly': [(_ts(BASE, 164), 14, 26)],
    'tvback': [(_ts(BASE, 163), 14, 26)],
    'pooltable': [(_ts(BASE, 74), 32, 95)],
    'bluepool': [(_ts(BASE, 73), 24, 125), (_ts(BASE, 75), 32, 65)],
    'pingpong': [(_ts(BASE, 67), 20, 125), (('crop', _ts(BASE, 67), (18, 0, 64, 48)), 44, 50)],
    'pingpong2': [(_ts(BASE, 67), 34, 127), (('crop', _ts(BASE, 67), (18, 0, 64, 48)), 20, 52)],
}
if HAVE_PACK:
    NO_STRIP = RUG_IDS
    IN_OVERLAP = {'kcounter': 3, 'coffeemk': 3, 'stockcounter': 3}
    HENS = os.path.expanduser('~/OneDrive/banana-art-pack/Modern_Farm_v1.2/48x48/Animals_48x48/Chickens_and_Roosters_48x48')
    for hi, hname in enumerate(['Chicken_Brown_48x48.png', 'Chicken_White_48x48.png', 'Chicken_Golden_48x48.png']):
        hsheet = Image.open(os.path.join(HENS, hname)).convert('RGBA')
        strip = hsheet.crop((0, 48, 192, 96)).resize((128, 32), Image.NEAREST)
        strip.save(os.path.join(OUT, 'c-hen%d.png' % hi), optimize=True)
    print('  c-hen0..2.png (coop chickens)')
    import shutil
    ANIM = os.path.expanduser('~/OneDrive/banana-art-pack/Modern_Exteriors_48x48/Animated_48x48/Animated_gifs_48x48')
    shutil.copy(os.path.join(ANIM, 'Campfire_48x48.gif'), os.path.join(OUT, 'campfire-lit.gif'))
    shutil.copy(os.path.join(ANIM, 'Garden_Fountain_1_48x48.gif'), os.path.join(OUT, 'd-fountain.gif'))
    for did, name, cat, price, stage, path in INDOOR_DEF:
        sc = IN_SCALE.get(did, DECOR_DEFAULT)
        s = indoor_sprite(path, 1.0, strip=did not in NO_STRIP, overlap=IN_OVERLAP.get(did, 0))
        if s is None:
            continue
        parts = []
        for ppath, px_, by in IN_COMPOSE.get(did, []):
            pt = indoor_sprite(ppath, 1.0)
            if pt is not None:
                parts.append((pt, px_, by))
        if parts:
            s = compose_on(s, parts)
        if sc != 1.0:
            s = s.resize((max(1, int(s.width * sc)), max(1, int(s.height * sc))), Image.NEAREST)
        s.save(os.path.join(OUT, 'd-%s.png' % did), optimize=True)
        DECOR_OUT.append((did, name, cat, price, stage, s.width, s.height, None))
        print('  d-%s.png %dx%d (%s s%d)' % (did, s.width, s.height, cat, stage))

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
# ⛺ Trym's cull (planner round 1): the three A-frames only — blue/green/sand
STRUCT_VARIANTS[1] = [('tent%d' % i, ['ME_Singles_Camping_48x48_Tent_%d.png' % i], PROP)
                      for i in range(1, 4)]
# 🛖 Trym's cull: one trailer without a porch, one with (planner circles)
STRUCT_VARIANTS[2] = [
    ('mobm3', ['ME_Singles_Camping_48x48_Mobile_House_Medium_3.png'], _rung_scale(185)),
    ('mobm7', ['ME_Singles_Camping_48x48_Mobile_House_Medium_7.png'], _rung_scale(185)),
]
# 🏠 Trym's cull: ONE house — the country chalet (planner image 5)
STRUCT_VARIANTS[3] = [
    ('country', ['24_Additional_Houses_Country_House_48x48.png'], 0.42),
]

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
    assert len(STRUCT_SIZES) >= 6, 'style wardrobe too thin: %d' % len(STRUCT_SIZES)
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
# Modern Interiors Home_Designs ship as layer_1 (floor/walls — the EMPTY
# shell) + layer_2 (all the furniture). M4.5 made rooms furnishable, so the
# showroom layer_2 RETIRED (Trym: "my regular user gets a house thats fully
# decorated") — rooms are empty shells the player fills; colliders are WALLS
# only, and the kitchen zones went with the baked counters: the placed STOVE
# item is the kitchen everywhere. The room lives INSIDE the outdoor world's
# coordinate space (over a shade layer) so camera/collision/taps are reused.
# Wall colliders are EYEBALLED off the layer_1 renders (local px, offset at
# emit). Stage 2 = Generic_Home_1 (top door), stage 3 = Japanese_Home_1
# (genkan at the bottom — the stone entry IS the door).
MI_RETIRED = None  # Home_Designs retired — wooden rooms below
'''
MI = os.path.expanduser(r'~\OneDrive\banana-art-pack\moderninteriors-win\6_Home_Designs')
INTERIOR_DEF = {
    2: {
        'glob': 'Generic_Home_Designs/48x48/Generic_Home_1_*ayer_*48x48*.png',
        'img': 'in-generic.png', 'at': (564, 229),
        'spawn': (355, 165), 'exit': (325, 120, 385, 142),
        'cols': [
            (0, 0, 325, 128), (385, 0, 672, 128),          # top walls, door lane open
            (0, 0, 58, 642), (614, 0, 672, 642), (0, 592, 672, 642),
            (58, 375, 298, 405), (432, 375, 614, 405),     # the room wall, lane open
        ],
    },
    3: {
        'glob': 'Japanese_Interiors_Home_Designs/48x48/Japanese_Home_1_*ayer_*48x48*.png',
        'img': 'in-japanese.png', 'at': (444, 229),
        'spawn': (295, 560), 'exit': (200, 596, 390, 630),
        'cols': [
            (0, 0, 912, 95),                               # top walls
            (0, 0, 50, 642), (862, 0, 912, 642),
            (0, 490, 185, 642), (400, 490, 912, 642),      # bottom walls, genkan open
            (45, 195, 290, 270),                           # mid-left slate wall
            (528, 55, 572, 140),                           # top-centre pillar
            (480, 195, 532, 285),                          # centre slate wall
            (535, 300, 668, 382),                          # mid-right slate wall
        ],
    },
}
INTERIORS_OUT = {}
if os.path.isdir(MI):
    for tier, spec in INTERIOR_DEF.items():
        layers = sorted(_glob.glob(os.path.join(MI, spec['glob'])))
        # layer_1 ONLY — the empty shell; layer_2 was the baked showroom
        layers = [f for f in layers if 'layer_1' in f.lower()]
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
            'exit': off(spec['exit']),
            'cols': [off(c) for c in spec['cols']],
        }
        if 'kitchen' in spec:
            INTERIORS_OUT[tier]['kitchen'] = off(spec['kitchen'])
        print('  %s %dx%d (%d layers, %d colliders)' % (spec['img'], base.width, base.height, len(layers), len(spec['cols'])))
'''

# ONE wooden interior language for every rung (Trym: "just have wooden
# interior and homes for all level houses and make that good") — rooms are
# COMPOSED from Room_Builder tiles: F(48,576) gold plank floor + W(912,576)
# brown plank wall face, sized per tier, door at the BOTTOM like every other
# building. No player walls (furniture + rugs do the zoning).
RB = os.path.expanduser(r'~\OneDrive\banana-art-pack\moderninteriors-win\1_Interiors\48x48\Room_Builder_subfiles_48x48')
INTERIORS_OUT = {}
if os.path.isdir(RB):
    _fl = Image.open(os.path.join(RB, 'Room_Builder_Floors_48x48.png')).convert('RGBA')
    _wa = Image.open(os.path.join(RB, 'Room_Builder_Walls_48x48.png')).convert('RGBA')
    def room_tiles(fx, fy, wx2, wy2):
        return (_fl.crop((fx, fy, fx + 48, fy + 48)),
                _wa.crop((wx2, wy2, wx2 + 48, wy2 + 96)))

    def build_wood_room(tier, tw, th, at, FTILE, WSEG, fscale=1):
        Wp, Hp = tw * 48, th * 48
        room = Image.new('RGBA', (Wp, Hp), (0, 0, 0, 0))
        step = 48 * fscale
        ft = FTILE if fscale == 1 else FTILE.resize((step, step), Image.NEAREST)
        for j in range(0, Hp, step):
            for i in range(0, Wp, step):
                room.alpha_composite(ft, (i, j))
        for i in range(tw):
            room.alpha_composite(WSEG, (i * 48, 0))
        dr2 = ImageDraw.Draw(room)
        FR = (46, 34, 22, 255)
        FRAME = 14
        cx = Wp // 2
        dr2.rectangle([0, 0, FRAME - 1, Hp - 1], fill=FR)
        dr2.rectangle([Wp - FRAME, 0, Wp - 1, Hp - 1], fill=FR)
        dr2.rectangle([0, Hp - FRAME, cx - 61, Hp - 1], fill=FR)
        dr2.rectangle([cx + 60, Hp - FRAME, Wp - 1, Hp - 1], fill=FR)
        img = 'in-wood%d.png' % tier
        room.save(os.path.join(OUT, img), optimize=True)
        ox, oy = at
        INTERIORS_OUT[tier] = {
            'img': img, 'box': [ox, oy, Wp, Hp],
            'spawn': [ox + cx, oy + Hp - 56],
            'exit': [ox + cx - 46, oy + Hp - 18, ox + cx + 46, oy + Hp],
            'cols': [
                [ox, oy, ox + Wp, oy + 100],
                [ox, oy, ox + FRAME, oy + Hp],
                [ox + Wp - FRAME, oy, ox + Wp, oy + Hp],
                [ox, oy + Hp - FRAME, ox + cx - 60, oy + Hp],
                [ox + cx + 60, oy + Hp - FRAME, ox + Wp, oy + Hp],
            ],
        }
        print('  %s %dx%d (wood room)' % (img, Wp, Hp))

    # 🎼 level 2 = the music-room look: pale diagonal planks + grey wall (Trym img 2)
    build_wood_room(2, 7, 6, (732, 372), *room_tiles(48, 1488, 48, 192))
    # 🏨 level 3 = house 2's floor (Trym: "just reuse") + warm wood wall
    build_wood_room(3, 13, 9, (588, 332), *room_tiles(48, 1488, 48, 1056))


# ---- 🍌 THE BANANA PHONE — drawn UI art (Trym commissioned: "needs to be
# created") — a 22px banana-phone icon for the action bar. UI chrome is ours;
# pack fidelity applies to world scenes.
def build_phone_icon():
    ph = Image.new('RGBA', (22, 22), (0, 0, 0, 0))
    pp = ph.load()
    BODY = (255, 225, 53, 255)
    EDGE = (26, 20, 8, 255)
    SCREEN = (42, 36, 56, 255)
    GLOW = (140, 220, 130, 255)
    STALK = (122, 84, 46, 255)
    for y in range(2, 21):
        for x in range(5, 17):
            corner = (y in (2, 20) and x in (5, 16))
            if corner:
                continue
            if x in (5, 16) or y in (2, 20):
                pp[x, y] = EDGE
            else:
                pp[x, y] = BODY
    for y in range(5, 15):
        for x in range(7, 15):
            pp[x, y] = SCREEN
    # a tiny banana on screen
    for x, y in ((9, 8), (10, 9), (11, 10), (12, 10), (13, 9)):
        pp[x, y] = BODY
    pp[9, 7] = STALK
    # signal dot + home button
    pp[8, 17] = EDGE; pp[9, 17] = EDGE; pp[12, 17] = GLOW; pp[13, 17] = GLOW
    # the stalk nub on top — it IS a banana
    pp[10, 1] = STALK; pp[11, 1] = STALK; pp[10, 0] = STALK
    ph.save(os.path.join(OUT, 'phone.png'), optimize=True)
    print('  phone.png 22x22')


build_phone_icon()

# ---- ⛺ INSIDE THE TENT (Trym: "whats the point to make a tent if not?") —
# the humblest rung deserves the first "inside" moment. A tiny canvas room:
# drawn tent-fabric walls, groundsheet floor, the pack's own sleeping bag,
# backpack and lantern. One generic interior for all six tent colours (v1).
TENT_W, TENT_H = 240, 192
tent_room = Image.new('RGBA', (TENT_W, TENT_H), (0, 0, 0, 0))
tp2 = tent_room.load()
C_FLOOR = (176, 138, 92, 255)
C_FLOORD = (158, 122, 78, 255)
trng = random.Random(7)
for y in range(TENT_H):
    for x in range(TENT_W):
        j = trng.randrange(-6, 7)
        c = (C_FLOOR[0] + j, C_FLOOR[1] + j, C_FLOOR[2] + j, 255)
        if (y % 16) < 2:
            c = C_FLOORD
        tp2[x, y] = c
for prop_name, px2, py2, sc in (('ME_Singles_Camping_48x48_Sleeping_Bag_1.png', 52, 74, 2 / 3.0),
                                ('ME_Singles_Camping_48x48_Backpack_1.png', 192, 76, 2 / 3.0),
                                ('ME_Singles_Camping_48x48_Lantern_1.png', 154, 84, 2 / 3.0)):
    try:
        sp3 = sprite([prop_name], scale=sc)
        if sp3 is not None:
            tent_room.alpha_composite(sp3, (px2 - sp3.width // 2, py2))
    except Exception as e:
        print('  tent prop failed', prop_name, e)
tent_room.save(os.path.join(OUT, 'in-tent.png'), optimize=True)
print('  in-tent.png %dx%d' % (TENT_W, TENT_H))
TENT_AT = (780, 408)
INTERIORS_OUT[1] = {
    'img': 'in-tent.png', 'box': [TENT_AT[0], TENT_AT[1], TENT_W, TENT_H],
    'spawn': [TENT_AT[0] + 120, TENT_AT[1] + 148],
    'exit': [TENT_AT[0] + 78, TENT_AT[1] + TENT_H - 22, TENT_AT[0] + 162, TENT_AT[1] + TENT_H - 2],
    'cols': [[TENT_AT[0] + a, TENT_AT[1] + b, TENT_AT[0] + c, TENT_AT[1] + d] for a, b, c, d in (
        (0, 0, TENT_W, 16), (0, 0, 16, TENT_H), (TENT_W - 16, 0, TENT_W, TENT_H),
        (0, TENT_H - 16, 74, TENT_H), (166, TENT_H - 16, TENT_W, TENT_H),
        (30, 72, 88, 128), (146, 74, 214, 120),
    )],
}

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
    mw, mh = FIX_SIZES.get('mail', (35, 42))
    sw2, sh2 = FIX_SIZES.get('sign', (31, 31))
    L.append('export const MAILBOX = { x: %d, y: %d, w: %d, h: %d };' % (MAILBOX_AT[0], MAILBOX_AT[1], mw, mh))
    L.append('export const SIGN = { x: %d, y: %d, w: %d, h: %d };' % (SIGN_AT[0], SIGN_AT[1], sw2, sh2))
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
        if did == 'fountain':
            w, h = 64, 96
        D.append("  { id: '%s', name: '%s', cat: '%s', price: %d, stage: %d,"
                 " w: %d, h: %d, surface: '%s',%s%s img: '/assets/homestead/d-%s.%s', solid: %s },"
                 % (did, name, cat, price, stage, w, h,
                    ('floor' if cat in ('kitchen', 'living', 'bedroom', 'bathroom', 'hallway', 'music') else 'ground'),
                    (' rug: 1,' if did in RUG_IDS else ''),
                    ((" sit: '%s'," % SIT_DIRS[did]) if did in SIT_DIRS else ''), did,
                    ('gif' if did == 'fountain' else 'png'),
                    (str(box) if box else 'null')))
    D.append('];')
    with open(os.path.join(SITE, 'src', 'data', 'decor.js'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(D) + '\n')
    print('wrote src/data/decor.js (%d items)' % len(DECOR_OUT))


emit()
im.convert('RGB').save(os.path.join(OUT, 'homestead.png'), optimize=True)
print('wrote homestead.png (%dx%d) %.0f KB'
      % (W, H, os.path.getsize(os.path.join(OUT, 'homestead.png')) / 1024.0))
