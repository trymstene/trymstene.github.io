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
# fence rectangle on the TILE GRID (tiles, inclusive): the yard
FX0, FY0, FX1, FY1 = 7, 5, 27, 16          # px 336..1344 x 240..816
GATE_COLS = (23, 24)             # SOUTH-side gap → x 1104..1200 (walk up + in)
GATE_X = (GATE_COLS[0] + 1) * T  # the gap's centre ≈ 1152
FENCE_PX = (FX0 * T, FY0 * T, (FX1 + 1) * T, (FY1 + 1) * T)
PLOT = (FX0 * T + T, FY0 * T + T + 14, (FX1 + 1) * T - T, (FY1 + 1) * T - T)
BED = (470, 600, 750, 700)       # tilled soil rect (x0,y0,x1,y1)
BED_SLOTS = [(520, 668), (590, 668), (660, 668), (730, 668)]
TENT = (760, 430)                # (cx, base) — stage 1, client-drawn, faces south
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

# ---- the bottom road: full width, dying into the woods at the west end ----
for y in range(ROAD_Y - ROAD_HW, ROAD_Y + ROAD_HW):
    for x in range(120, W):
        hw = ROAD_HW if x > 340 else max(4, ROAD_HW * (x - 120) / 220.0)
        d = abs(y - ROAD_Y) / float(hw)
        if d > 1.0:
            continue
        if d > 0.82 and rng.random() < (d - 0.82) * 5:
            continue
        put(x, y, (172, 142, 96) if (x * 3 + y * 7) % 9 else (152, 124, 82))
# the turn-in: a short path from the road up through the gate
for y in range(FENCE_PX[3] - 8, ROAD_Y - ROAD_HW + 12):
    for x in range(GATE_X - 34, GATE_X + 34):
        d = abs(x - GATE_X) / 34.0
        if d > 0.82 and rng.random() < (d - 0.82) * 5:
            continue
        put(x, y, (172, 142, 96) if (x * 3 + y * 7) % 9 else (152, 124, 82))

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


def lay_fence():
    kit = fence_kit()
    if not kit['h'] or not kit['v_w']:
        print('  no fence tiles — fence skipped')
        return

    def stamp(tile, tx, ty):
        if tile:
            im.alpha_composite(tile, (tx * T, ty * T))
    # north: end pieces carry the corners themselves
    stamp(kit['endl'], FX0, FY0)
    for tx in range(FX0 + 1, FX1):
        stamp(kit['h'] if tx % 2 else kit['h2'], tx, FY0)
    stamp(kit['endr'], FX1, FY0)
    # verticals live in the SAME columns as the run ends
    for ty in range(FY0 + 1, FY1):
        stamp(kit['v_w'], FX0, ty)
        stamp(kit['v_e'], FX1, ty)
    # south: junction ends (nub where the vertical arrives) + the gate posts
    stamp(kit['jl'], FX0, FY1)
    for tx in range(FX0 + 1, FX1):
        if tx in GATE_COLS:
            continue
        if tx == GATE_COLS[0] - 1:
            stamp(kit['gl'], tx, FY1)
        elif tx == GATE_COLS[-1] + 1:
            stamp(kit['gr'], tx, FY1)
        else:
            stamp(kit['h'] if tx % 2 else kit['h2'], tx, FY1)
    stamp(kit['jr'], FX1, FY1)
    # colliders from the measured post columns
    mid = 18
    fy0, fy1 = FY0 * T + mid, FY1 * T + mid
    COLLIDERS.append((FX0 * T, fy0, (FX1 + 1) * T, fy0 + 14))                  # north
    COLLIDERS.append((FX0 * T, fy1, GATE_COLS[0] * T, fy1 + 14))               # south L of gate
    COLLIDERS.append(((GATE_COLS[-1] + 1) * T, fy1, (FX1 + 1) * T, fy1 + 14))  # south R of gate
    COLLIDERS.append((FX0 * T + 2, fy0, FX0 * T + 20, fy1))                    # west posts
    COLLIDERS.append((FX1 * T + 24, fy0, FX1 * T + 44, fy1))                   # east posts


if HAVE_PACK:
    lay_fence()

# ---- the tilled bed: soil field + thin furrow LINES + clods ---------------
for y in range(BED[1], BED[3]):
    for x in range(BED[0], BED[2]):
        edge = x < BED[0] + 5 or x >= BED[2] - 5 or y < BED[1] + 5 or y >= BED[3] - 5
        if edge:
            put(x, y, (82, 62, 40))
        else:
            j = rng.randrange(-8, 9)
            c = (120 + j, 90 + j, 56 + j)
            if ((x - BED[0]) % 14) < 2:           # a thin furrow line every 14px
                c = (98, 74, 46)
            elif rng.random() < 0.04:
                c = (88, 66, 42)                  # the odd clod
            put(x, y, c)

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
    ('fountain', 'Stone fountain', 'display', 80, 3, ['ME_Singles_Garden_48x48_Fountain_1_1.png'], True),
    ('sunvase', 'Sunflower vase', 'garden', 20, 3, ['ME_Singles_Garden_48x48_Big_Sunflower_Vase.png'], True),
    ('whitevase', 'White flower vase', 'garden', 20, 3, ['ME_Singles_Garden_48x48_Big_White_Flower_Vase.png'], True),
]

# the Angel statue is monument-sized at PROP (174px wide) — a lawn ornament,
# not a cathedral piece, so it gets its own scale
DECOR_SCALE = {'statue': 0.30, 'statue2': 0.30, 'coop': 0.42, 'fountain': 0.60, 'shelf': 0.55}

DECOR_OUT = []
if HAVE_PACK:
    for did, name, cat, price, stage, cands, solid in DECOR_DEF:
        s = sprite(cands, scale=DECOR_SCALE.get(did, PROP))
        if s is None:
            continue
        s.save(os.path.join(OUT, 'd-%s.png' % did), optimize=True)
        hw = max(10, int(s.width * 0.38))
        box = [-hw, -12, hw, 2] if solid else None
        DECOR_OUT.append((did, name, cat, price, stage, s.width, s.height, box))
        print('  d-%s.png %dx%d' % (did, s.width, s.height))
    assert len(DECOR_OUT) >= 10, 'decor catalog too thin: %d' % len(DECOR_OUT)

# ── 🏠 THE STRUCTURE LADDER — tent → cabin → house, client-drawn at TENT ──
# (key, candidates, scale). The Country House is 864x768 native — the ladder's
# scales are chosen so each rung visibly DWARFS the one before.
STRUCT_DEF = [
    ('tent', ['ME_Singles_Camping_48x48_Tent_1.png'], PROP),
    ('cabin', [os.path.join(FARM, 'Single_Files_48x48', 'Props_and_Buildings_48x48', 'Barn_Small_48x48.png')], 0.52),
    ('house', ['24_Additional_Houses_Country_House_48x48.png'], 0.42),
]
STRUCT_SIZES = {}
if HAVE_PACK:
    for key, cands, sc in STRUCT_DEF:
        sp = sprite(cands, scale=sc)
        if sp is None:
            continue
        sp.save(os.path.join(OUT, 'ov-%s.png' % key), optimize=True)
        STRUCT_SIZES[key] = sp.size
        print('  ov-%s.png %dx%d' % (key, sp.width, sp.height))
TENT_SIZE = STRUCT_SIZES.get('tent', (0, 0))

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
    L.append('export const BED = { rect: %s, slots: %s };' % (list(BED), [list(s) for s in BED_SLOTS]))
    L.append('export const TENT = { x: %d, y: %d, w: %d, h: %d, solid: [-%d, -20, %d, 4] };'
             % (TENT[0], TENT[1], TENT_SIZE[0], TENT_SIZE[1],
                max(20, TENT_SIZE[0] // 2 - 8), max(20, TENT_SIZE[0] // 2 - 8)))
    L.append('export const STRUCTS = { %s };' % ', '.join(
        "%s: { w: %d, h: %d }" % (k, w, h) for k, (w, h) in STRUCT_SIZES.items()))
    L.append('export const MAILBOX = { x: %d, y: %d };' % MAILBOX_AT)
    L.append('export const SIGN = { x: %d, y: %d };' % SIGN_AT)
    L.append('export const OB_RECTS = %s;' % [list(map(int, r)) for r in COLLIDERS])
    L.append('export const OVERLAYS = %s;' % [[o[0], o[1], o[2], o[3], o[4], o[5]] for o in OVERLAYS])
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
