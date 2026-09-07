# -*- coding: utf-8 -*-
"""🏘️ BANANA TOWN — the town centre plate (town-centre-plan, 7 Sep 2026).

Park-template build (build-park-scene.py is the constitution): a true top-down
plate, pack art at PROP scale, colliders declared on the placement and emitted
into src/scripts/town-geo.js.

THE REGISTER (decided from the sprites, not the filenames — see the contact
sheets in the town plan): a BRICK OLD TOWN ON COBBLES. The buildings are small
and every one has a door that opens onto a street: the red-brick clock tower is
the town hall, a two-floor brick house is the residence with windows for real
players, small STORE fronts with striped awnings are the general store and the
print shop, the real post office building is the post office, a kiosk shaped
like a takeaway cup is the café. The bank is an ATM. Streets are grey cobbles
with organic edges: a street along the north row, a street along the south
row, two lanes joining them, the square in the middle and the main street
south to the park (Trym, 7 Sep: "more streets and smaller buildings, more
flooring to walk around, NPCs placed with purpose, transitions to grass").

Outputs:
  public/assets/town/town.png        2200x1300 world plate (ground + shadows)
  public/assets/town/ov-*.png        y-sorted overlay props (everything that stands)
  public/assets/town/a-fountain.png  the fountain, an animated strip
  src/scripts/town-geo.js            ⚠️ THE CONTRACT with the town engine
Run: python tools/build-town-scene.py
"""
import os
import random
import sys
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blockify import load_pack, blockify

PACK = os.path.expanduser(r'~\OneDrive\banana-art-pack\Modern_Exteriors_48x48')
FARM = os.path.expanduser(r'~\OneDrive\banana-art-pack\Modern_Farm_v1.2\48x48\Single_Files_48x48\0_Complete_Tileset_48x48')
ANIM = os.path.expanduser(r'~\OneDrive\banana-art-pack\Modern_Exteriors_48x48\Animated_48x48\Animated_sheets_48x48')
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SITE, 'public', 'assets', 'town')
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.startswith('ov-'):
        os.remove(os.path.join(OUT, f))
rng = random.Random(1999)

T = 48
W, H = 2200, 1300
PROP = 0.76                  # the beach's heroic-banana scale rule, park's too
BOUND = 60

# ---- the streets: every door opens onto one -------------------------------------
HALL_ST = (260, 560, 2020, 660)      # along the north row's doors
HIGH_ST = (260, 1040, 2020, 1140)    # along the south row's doors
SQUARE = (660, 660, 1540, 1040)
WEST_LN = (260, 560, 340, 1140)
EAST_LN = (1940, 560, 2020, 1140)
MAIN_ST = (1040, 1140, 1160, H)      # south, to the park
STREETS = [HALL_ST, HIGH_ST, SQUARE, WEST_LN, EAST_LN, MAIN_ST]
SPAWN = (1100, 1230)

im = Image.new('RGBA', (W, H), (86, 152, 74, 255))
px = im.load()


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


# ---- the ground: the park's lawn recipe -------------------------------------------
def luma_spread(t):
    p = t.load()
    vals = [0.3 * p[x, y][0] + 0.6 * p[x, y][1] + 0.1 * p[x, y][2] for y in range(T) for x in range(T) if p[x, y][3]]
    if not vals:
        return 999
    m = sum(vals) / len(vals)
    return (sum((v - m) ** 2 for v in vals) / len(vals)) ** 0.5


cand = []
for fam, hi in (('Grass_1', 23), ('Grass_2', 22), ('Grass_3', 22)):
    for i in range(1, hi):
        try:
            t = load_pack('ME_Singles_Terrains_and_Fences_48x48_%s_%d.png' % (fam, i)).convert('RGBA')
        except Exception:
            continue
        if t.size == (T, T):
            pp = t.load()
            cols = [pp[x, y] for y in range(T) for x in range(T) if pp[x, y][3]]
            mr, mg, mb = (sum(c[i] for c in cols) / len(cols) for i in range(3))
            if mg > mr + 12 and mg > mb + 20:          # green tiles only — the dirt ones are more uniform
                cand.append((luma_spread(t), t))
cand.sort(key=lambda c: c[0])
GRASSES = [t for _, t in cand[:3]] or [Image.new('RGBA', (T, T), (86, 152, 74, 255))]
grng = random.Random(7)
for r in range(0, H // T + 1):
    for c in range(0, W // T + 1):
        t = GRASSES[grng.randrange(len(GRASSES))]
        if grng.random() < 0.5:
            t = t.transpose(Image.FLIP_LEFT_RIGHT)
        im.alpha_composite(t, (c * T, r * T))
try:
    TUFT = load_pack('ME_Singles_Graveyard_48x48_Grass_Tufts.png').convert('RGBA')
    tp = TUFT.load()
    for y in range(TUFT.height):
        for x in range(TUFT.width):
            r0, g0, b0, a0 = tp[x, y]
            if a0:
                k = (0.3 * r0 + 0.6 * g0 + 0.1 * b0) / 120.0
                tp[x, y] = (int(min(255, 62 * k)), int(min(255, 128 * k)), int(min(255, 56 * k)), a0)
except Exception:
    TUFT = None
PATCHES = []
for i in (1, 2, 3, 8, 9):
    try:
        PATCHES.append(load_pack('ME_Singles_Terrains_and_Fences_48x48_Props_Grass_%d.png' % i).convert('RGBA'))
    except Exception:
        pass

# ---- the paving mask: the streets' union with an organic, cobble-bitten edge ------
mask = Image.new('L', (W, H), 0)
md = ImageDraw.Draw(mask)
for (x0, y0, x1, y1) in STREETS:
    md.rectangle([x0, y0, x1 - 1, y1 - 1], fill=255)
# bites and bumps along every edge, in 12px blocks, so the stone meets the grass
# the way a laid square does, never as a ruler line
erng = random.Random(31)
B = 12
for (x0, y0, x1, y1) in STREETS:
    for x in range(x0, x1, B):
        for (ey, out) in ((y0, -1), (y1, +1)):
            r = erng.random()
            if r < 0.28:      # a bump outward
                md.rectangle([x, ey + (out * B if out < 0 else 0), x + B - 1, ey + (0 if out < 0 else out * B) - 1], fill=255)
            elif r < 0.42:    # a bite inward
                md.rectangle([x, ey + (0 if out < 0 else -B), x + B - 1, ey + (B if out < 0 else 0) - 1], fill=0)
    for y in range(y0, y1, B):
        for (ex, out) in ((x0, -1), (x1, +1)):
            r = erng.random()
            if r < 0.28:
                md.rectangle([ex + (out * B if out < 0 else 0), y, ex + (0 if out < 0 else out * B) - 1, y + B - 1], fill=255)
            elif r < 0.42:
                md.rectangle([ex + (0 if out < 0 else -B), y, ex + (B if out < 0 else 0) - 1, y + B - 1], fill=0)
# the square and the streets are one surface: refill their true rectangles so a
# bite never cuts a street in two where two rectangles meet
for (x0, y0, x1, y1) in STREETS:
    md.rectangle([x0 + B, y0 + B, x1 - B - 1, y1 - B - 1], fill=255)
mp = mask.load()


def paved(x, y):
    return 0 <= x < W and 0 <= y < H and mp[x, y] > 0


# grey cobbles only (Others_1 + Others_3); the tan ones stay in the drawer
COBS = [load_pack('ME_Singles_Terrains_and_Fences_48x48_Others_%d.png' % i).convert('RGBA') for i in (1, 3)]
cob = Image.new('RGBA', (W, H), (0, 0, 0, 0))
crng = random.Random(5)
for r in range(0, H // T + 1):
    for c in range(0, W // T + 1):
        t = COBS[crng.randrange(len(COBS))]
        k = crng.randrange(4)
        t = t.transpose(Image.ROTATE_90) if k == 1 else t.transpose(Image.ROTATE_180) if k == 2 else t.transpose(Image.FLIP_LEFT_RIGHT) if k == 3 else t
        cob.alpha_composite(t, (c * T, r * T))
im.paste(cob, (0, 0), mask)
# the rim: a two-pixel darker seam where stone meets grass, following the bites
rim = (92, 82, 58, 255)
for y in range(1, H - 1):
    row = [mp[x, y] for x in range(W)]
    for x in range(1, W - 1):
        if row[x] and (not row[x - 1] or not row[x + 1] or not mp[x, y - 1] or not mp[x, y + 1]):
            px[x, y] = rim
            px[x, y + 1] = rim if mp[x, y + 1] else px[x, y + 1]

# the lawn's life, off the stone
for _ in range(70):
    if not PATCHES:
        break
    x, y = grng.randrange(20, W - 60), grng.randrange(20, H - 60)
    if paved(x + 24, y + 24):
        continue
    im.alpha_composite(PATCHES[grng.randrange(len(PATCHES))], (x, y))
if TUFT:
    for _ in range(360):
        x, y = grng.randrange(10, W - 58), grng.randrange(10, H - 58)
        if paved(x + 24, y + 24):
            continue
        t2 = TUFT.transpose(Image.FLIP_LEFT_RIGHT) if grng.random() < 0.5 else TUFT
        im.alpha_composite(t2, (x, y))
    # and a few tufts leaning over the stone's edge — the transition (Trym)
    n = 0
    while n < 160:
        x, y = grng.randrange(10, W - 58), grng.randrange(10, H - 58)
        cx, cy = x + 24, y + 30
        if paved(cx, cy) and not paved(cx, cy + 22) or (not paved(cx, cy) and paved(cx, cy - 22)):
            im.alpha_composite(TUFT, (x, y)); n += 1
        elif paved(cx, cy) and (not paved(cx - 22, cy) or not paved(cx + 22, cy)):
            im.alpha_composite(TUFT, (x, y)); n += 1
        else:
            n += 0.02

GRASS_TARGET = (128, 186, 96)
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        if g > r - 10 and g > b:
            k = 0.30
            px[x, y] = (int(r * (1 - k) + GRASS_TARGET[0] * k), int(g * (1 - k) + GRASS_TARGET[1] * k),
                        int(b * (1 - k) + GRASS_TARGET[2] * k), a)

# ---- props: the park's place(), no sad twin ---------------------------------------
_cache = {}
PLACED, COLLIDERS, OVERLAYS = [], [], []


def load_any(name):
    if name.startswith('FARM:'):
        return Image.open(os.path.join(FARM, name[5:])).convert('RGBA')
    return load_pack(name)


def place(name, cx, base, factor=1, colors=28, warm=0.0, sat=1.0, con=1.0, flip=False,
          shade=True, sh=0.30, scale=PROP, solid=None, layer=True, img=None):
    key = (name, factor, colors, warm, sat, con)
    if key not in _cache:
        src = img if img is not None else load_any(name)
        _cache[key] = blockify(src, factor=factor, colors=colors, warm=warm, sat=sat, con=con)
    s = _cache[key]
    if scale != 1.0:
        s = s.resize((max(1, int(s.width * scale)), max(1, int(s.height * scale))), Image.NEAREST)
    if flip:
        s = s.transpose(Image.FLIP_LEFT_RIGHT)
    if shade:
        shadow(cx + s.width * 0.06, base - s.height * 0.02, s.width * sh, max(4, s.height * 0.055))
    box = (int(cx - s.width // 2), int(base - s.height), int(cx - s.width // 2) + s.width, int(base))
    if layer:
        fn = 'ov-%d.png' % len(OVERLAYS)
        s.save(os.path.join(OUT, fn), optimize=True)
        OVERLAYS.append((fn, box[0], box[1], s.width, s.height, int(base)))
    else:
        im.alpha_composite(s, box[:2])
    PLACED.append((name, box))
    if solid:
        COLLIDERS.append((name, solid, int(cx), int(base)))
    return s.size


def try_place(names, cx, base, **kw):
    last = None
    for n in names if isinstance(names, (list, tuple)) else [names]:
        try:
            return place(n, cx, base, **kw)
        except Exception as e:
            last = e
    print('  ! none of', names, last)
    return None


def foot(w, h_solid=22):
    """a thin solid band at a building's feet, relative to (cx, base)"""
    return ('rect', -int(w * PROP // 2) + 6, -h_solid, int(w * PROP // 2) - 6, 4)


# ---- the notice board: our own drawn board, the supporters' board's big cousin ----
def build_noticeboard(w=130, ph=84, legh=40, K=3):
    WOOD_, LIT_, GRAIN_, DARK_ = (146, 102, 56), (178, 128, 72), (120, 83, 44), (104, 71, 38)
    INK_ = (52, 36, 21)
    PAPERS = [(34, 26, -5, (247, 240, 214), (214, 203, 176)), (26, 20, 6, (238, 231, 208), (206, 196, 170)),
              (30, 22, -3, (250, 243, 222), (219, 208, 182)), (24, 18, 7, (236, 224, 200), (203, 191, 164)),
              (28, 20, -7, (245, 236, 210), (212, 200, 174))]

    def note(pw, ph2, tilt, col, shade):
        n = Image.new('RGBA', (pw * K, ph2 * K), (0, 0, 0, 0))
        nd = ImageDraw.Draw(n)
        nd.rectangle([0, 0, pw * K - 1, ph2 * K - 1], fill=shade)
        nd.rectangle([0, 0, pw * K - K - 1, ph2 * K - K - 1], fill=col)
        for i, ly in enumerate(range(6, ph2 - 4, 4)):
            x2 = (5 + (pw - 12) * (0.9 if i % 3 == 0 else 0.62 if i % 3 == 1 else 0.75)) * K
            nd.rectangle([4 * K, ly * K, x2, ly * K + K - 1], fill=shade)
        nd.rectangle([(pw // 2 - 1) * K, 0, (pw // 2) * K + K - 1, 2 * K - 1], fill=(74, 48, 30))
        return n.rotate(tilt, expand=True, resample=Image.NEAREST)

    W2, H2 = w * K, (ph + legh) * K
    s = Image.new('RGBA', (W2, H2), (0, 0, 0, 0))
    dd = ImageDraw.Draw(s)
    lw, lx1, lx2 = 8 * K, 18 * K, (w - 26) * K
    for lx in (lx1, lx2):
        dd.rectangle([lx, (ph - 6) * K, lx + lw - 1, H2 - 1], fill=INK_)
        dd.rectangle([lx + K, (ph - 6) * K + K, lx + lw - K - 1, H2 - K - 1], fill=WOOD_)
        dd.rectangle([lx + K, (ph - 6) * K + K, lx + 2 * K - 1, H2 - K - 1], fill=LIT_)
    dd.rectangle([0, 0, W2 - 1, ph * K - 1], fill=INK_)
    dd.rectangle([K, K, W2 - K - 1, ph * K - K - 1], fill=WOOD_)
    dd.rectangle([K, K, W2 - K - 1, 6 * K - 1], fill=LIT_)
    dd.rectangle([K, (ph - 7) * K, W2 - K - 1, ph * K - K - 1], fill=DARK_)
    for gy in (26, 52):
        dd.rectangle([K, gy * K, W2 - K - 1, gy * K + K - 1], fill=GRAIN_)
    for pxx in (7, w - 9):
        for pyy in (10, ph - 13):
            dd.rectangle([pxx * K, pyy * K, pxx * K + K - 1, pyy * K + K - 1], fill=INK_)
    for (pxx, pyy), spec in zip([(10, 12), (52, 14), (92, 11), (26, 46), (66, 48)], PAPERS):
        pim = note(*spec)
        sh2 = Image.new('RGBA', pim.size, (0, 0, 0, 0))
        sh2.paste((0, 0, 0, 60), (0, 0), pim.split()[3])
        s.alpha_composite(sh2, (pxx * K + K, pyy * K + K))
        s.alpha_composite(pim, (pxx * K, pyy * K))
    return blockify(s, factor=K, colors=14, alpha_thresh=0.4, trim=False)


# ---- ⛲ the fountain: the pack's six-frame garden fountain, one strip ------------------
FOUNTAIN = []
sheet = Image.open(os.path.join(ANIM, 'Garden_Fountain_6_48x48.png')).convert('RGBA')   # the grey one: the cobbles are grey
n = 6
fw = sheet.width // n
strip = blockify(sheet, factor=1, colors=28, warm=0.0, sat=1.0, con=1.0, trim=False)
sw, shh = int(fw * PROP), int(sheet.height * PROP)
strip = strip.resize((sw * n, shh), Image.NEAREST)
strip.save(os.path.join(OUT, 'a-fountain.png'), optimize=True)
FX, FBASE = 1100, 900
shadow(FX, FBASE - 6, sw * 0.5, 12)
FOUNTAIN = [FX, FBASE, sw, shh, n]
COLLIDERS.append(('fountain', ('circle', int(sw * 0.38)), FX, FBASE - 10))

# ---- THE TOWN --------------------------------------------------------------------
SPOTS, NPCS = {}, []

# the north row, doors on Hall Street: the residence · the town hall · the post office
place('ME_Singles_Generic_Building_48x48_Condo_3_45.png', 480, 560, solid=foot(288), sh=0.45)
SPOTS['condo'] = (480, 560)
place('ME_Singles_School_48x48_Clock_Tower_1.png', 1100, 560, solid=foot(384), sh=0.45)
SPOTS['hall'] = (1100, 560)
NPCS.append(('nib', 1140, 586, 'Nib'))
place('22_Post_Office_48x48_Building_1.png', 1700, 560, solid=foot(384), sh=0.45)
SPOTS['post'] = (1700, 560)
NPCS.append(('stamp', 1750, 586, 'Stamp'))
try_place(['22_Post_Office_48x48_Big_Blue_Mailbox.png'], 1830, 592, solid=('rect', -12, -10, 12, 4))
NPCS.append(('moss', 700, 640, 'Moss'))

# the south row, doors on High Street: the general store (+ the bank, an ATM) · the print shop · the café
place('ME_Singles_Shopping_Center_and_Markets_48x48_Market_Small_1.png', 480, 1040, solid=foot(240), sh=0.45)
SPOTS['store'] = (480, 1040)
NPCS.append(('pip', 530, 1066, 'Pip'))
try_place(['ME_Singles_City_Props_48x48_ATM_1.png'], 620, 1040, solid=('rect', -26, -12, 26, 4))
SPOTS['bank'] = (620, 1040)
place('ME_Singles_Shopping_Center_and_Markets_48x48_Market_Small_7.png', 1620, 1040, solid=foot(240), sh=0.45)
SPOTS['print'] = (1620, 1040)
try_place(['ME_Singles_City_Props_48x48_Kiosk_Coffee_Cup.png'], 1830, 1040, scale=PROP * 0.8, solid=('rect', -60, -26, 60, 4), sh=0.45)
SPOTS['cafe'] = (1830, 1040)
NPCS.append(('bean', 1780, 1066, 'Bean'))

# the worksite lot, north-west: the office and the arcade, later
for i, x in enumerate(range(70, 250, 36)):
    try_place(['ME_Singles_Worksite_48x48_Fence_1_%d.png' % (1 + i % 3)], x, 250, shade=False, solid=('rect', -18, -12, 18, 2))
    try_place(['ME_Singles_Worksite_48x48_Fence_1_%d.png' % (1 + (i + 1) % 3)], x, 470, shade=False, solid=('rect', -18, -12, 18, 2))
try_place(['ME_Singles_Worksite_48x48_Stacked_Material_1.png'], 150, 380, sh=0.4)
try_place(['ME_Singles_Worksite_48x48_Sign_2.png'], 90, 440, shade=False)
try_place(['ME_Singles_Worksite_48x48_Cone_1.png'], 210, 430, shade=False)
SPOTS['lot'] = (160, 470)

# the square: three stalls with room between them, the board, the statue on the axis
place('FARM:Market_Stand_Yellow_Big_48x48.png', 800, 780, solid=('rect', -84, -30, 84, 4), sh=0.5)
SPOTS['exchange'] = (800, 780)
NPCS.append(('figjr', 800, 800, 'Fig Jr.'))
place('FARM:Market_Stand_Yellow_Big_48x48.png', 1400, 780, flip=True, solid=('rect', -84, -30, 84, 4), sh=0.5)
SPOTS['wheel'] = (1400, 780)
NPCS.append(('spinner', 1400, 800, 'Spinner'))
_cache[('__board', 1, 28, 0.0, 1.0, 1.0)] = build_noticeboard()
place('__board', 740, 990, scale=1.0, solid=('rect', -60, -14, 60, 4), sh=0.5)
SPOTS['board'] = (740, 990)
try_place(['ME_Singles_Vehicles_48x48_Fruit_Flowers_Cart_2.png'], 1460, 1010, solid=('rect', -40, -20, 40, 4), sh=0.45)
SPOTS['cart'] = (1460, 1010)
try_place(['ME_Singles_Garden_48x48_Statue_Putto_1.png'], 1100, 700, solid=('rect', -22, -12, 22, 4))
SPOTS['plinth'] = (1100, 700)
for (bx, by) in ((960, 1036), (1240, 1036)):
    try_place(['ME_Singles_City_Props_48x48_Bench_2.png'], bx, by, solid=('rect', -50, -14, 50, 4), sh=0.4)
NPCS.append(('dot', 1010, 1120, 'Dot'))
# decor, which may sit tight: lamps at the corners, a hydrant, a bin, a bear, bushes, a phone booth
for (lx, ly) in ((690, 690), (1510, 690), (690, 1030), (1510, 1030), (300, 600), (1980, 600), (300, 1100), (1980, 1100)):
    try_place(['ME_Singles_City_Props_48x48_Street_Lamp_1.png'], lx, ly, shade=False, solid=('circle', 8))
try_place(['ME_Singles_City_Props_48x48_Phone_Booth_1.png'], 1330, 660, solid=('rect', -30, -14, 30, 4))
try_place(['ME_Singles_Garden_48x48_Grass_Statue_7.png'], 1230, 760, solid=('rect', -22, -14, 22, 4))
try_place(['ME_Singles_City_Props_48x48_Hydrant_1.png'], 1180, 1120, shade=False, solid=('circle', 8))
try_place(['ME_Singles_City_Props_48x48_Small_Closed_Trash_Can.png'], 700, 1120, shade=False, solid=('circle', 8))
try_place(['ME_Singles_Garden_48x48_Flowers_Bench_Horizontal.png'], 960, 640, shade=False)
try_place(['ME_Singles_Garden_48x48_Flowers_Bench_Horizontal.png'], 1240, 640, shade=False)
for (bx, by) in ((380, 700), (1900, 700), (380, 960), (1900, 960), (620, 1200), (1580, 1200)):
    try_place(['ME_Singles_Garden_48x48_Bush_18.png'], bx, by, shade=False, solid=('circle', 14))

# the treeline: the park's camping trees, the town's walls
BIG_TREES = ['ME_Singles_Camping_48x48_Tree_%d.png' % n for n in (1, 2, 3, 13, 14, 15, 16, 17, 18)]
SMALLS = ['ME_Singles_City_Props_48x48_Bush_%d.png' % n for n in (1, 2, 3)]
TRUNK = ('rect', -13, -36, 13, 0)


def treeline(pts, step=104, jitter=22):
    for (x0, y0, x1, y1) in pts:
        if x1 - x0 > y1 - y0:
            x = x0
            while x < x1:
                try_place(BIG_TREES[rng.randrange(len(BIG_TREES))], x + rng.randrange(-jitter, jitter),
                          y0 + rng.randrange(0, max(1, y1 - y0)), shade=False, solid=TRUNK)
                x += step
        else:
            y = y0
            while y < y1:
                try_place(BIG_TREES[rng.randrange(len(BIG_TREES))], x0 + rng.randrange(0, max(1, x1 - x0)),
                          y + rng.randrange(-jitter, jitter), shade=False, solid=TRUNK)
                y += step


treeline([(60, 30, 2160, 70), (20, 560, 60, 1290), (2140, 200, 2190, 1290), (300, 1290, 1000, 1300),
          (1200, 1290, 1720, 1300), (1900, 1290, 2150, 1300), (1900, 130, 2100, 500), (700, 150, 960, 240), (1260, 150, 1520, 240),
          (640, 300, 900, 400), (1290, 300, 1500, 400)])   # the groves between the north row's buildings
for _ in range(16):
    try_place(SMALLS[rng.randrange(len(SMALLS))], rng.randrange(1860, 2140), rng.randrange(1150, 1260), shade=False, scale=PROP * 0.85)
for _ in range(10):
    try_place(SMALLS[rng.randrange(len(SMALLS))], rng.randrange(80, 240), rng.randrange(1150, 1260), shade=False, scale=PROP * 0.85)

im.save(os.path.join(OUT, 'town.png'), optimize=True)
print('wrote town.png %dx%d, %d overlays, %d colliders' % (W, H, len(OVERLAYS), len(COLLIDERS)))

# ---- the contract ----------------------------------------------------------------
L = ['// GENERATED by tools/build-town-scene.py — DO NOT EDIT.',
     '// Every collider here was declared on the place() call that drew its prop.',
     'export const WORLD = { w: %d, h: %d };' % (W, H),
     'export const BOUND = %d;' % BOUND,
     'export const SPAWN = { x: %d, y: %d };' % SPAWN,
     'export const DOORS = { south: { x: %d, y: %d } };' % (1100, H - 30),
     'export const STREETS = %s;' % [list(s) for s in STREETS],
     'export const FOUNTAIN = %s;' % list(FOUNTAIN),
     'export const OVERLAYS = %s;' % [list(o) for o in OVERLAYS],
     'export const SPOTS = { %s };' % ', '.join('%s: { x: %d, y: %d }' % (k, v[0], v[1]) for k, v in SPOTS.items()),
     'export const NPCS = %s;' % [[n[0], n[1], n[2], n[3]] for n in NPCS]]
rects, circles = [], []
for name, solid, cx, base in COLLIDERS:
    if solid[0] == 'rect':
        rects.append([cx + solid[1], base + solid[2], cx + solid[3], base + solid[4]])
    else:
        circles.append([cx, base, solid[1]])
L.append('export const OB_RECTS = %s;' % rects)
L.append('export const OB_CIRCLES = %s;' % circles)
with open(os.path.join(SITE, 'src', 'scripts', 'town-geo.js'), 'w', encoding='utf-8', newline='\n') as f:
    f.write('\n'.join(L).replace("'", '"') + '\n')
print('wrote town-geo.js (%d rects, %d circles, %d spots, %d npcs)' % (len(rects), len(circles), len(SPOTS), len(NPCS)))

# ---- a preview for the eye: plate + overlays in draw order + the people ----------
prev = im.copy()
layers = [(y + h, Image.open(os.path.join(OUT, fn)).convert('RGBA'), (x, y)) for fn, x, y, w, h, base in OVERLAYS]
layers.append((FBASE, strip.crop((0, 0, sw, shh)), (FX - sw // 2, FBASE - shh)))
for base, img_, at in sorted(layers, key=lambda o: o[0]):
    prev.alpha_composite(img_, at)
pd = ImageDraw.Draw(prev)
for key, x, y, label in NPCS:
    pd.ellipse([x - 14, y - 40, x + 14, y - 4], fill=(255, 225, 53, 255), outline=(0, 0, 0, 255), width=3)
    pd.text((x - 4 * len(label), y + 2), label, fill=(255, 255, 255, 255))
SCR = os.path.join(os.path.expanduser('~'), 'AppData', 'Local', 'Temp', 'claude', 'C--Web-Development-trymstene-com',
                   'aef8f8b4-6bdc-40b9-830c-496f96a6f745', 'scratchpad', 'shots-town')
os.makedirs(SCR, exist_ok=True)
prev.convert('RGB').save(os.path.join(SCR, 'town-preview.png'), optimize=True)
print('preview written')
