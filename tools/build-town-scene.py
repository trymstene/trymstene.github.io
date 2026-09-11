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
  public/assets/town/a-fountain-N.png  the fountain, one file per frame
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
# the thin lanes, one tile wide and tile-aligned: the mini-areas' roads (Trym, 11 Sep evening:
# "tiny park sections with small objects and more thin cobble-roads")
ORCH_PATH = (768, 288, 816, 576)     # north off Hall St into the orchard
MAIL_PATH = (1392, 336, 1440, 576)   # north off Hall St to the mailbox row
BUS_ROAD = (1920, 0, 1968, 576)      # the east lane runs on north, out of town: the bus stop, The Cut later
EAST_PATH = (1536, 672, 1920, 720)   # behind the print shop and the cup: the Row
WEST_PATH = (336, 672, 672, 720)     # behind the store: the stand and the beds
TERRACE = (1584, 1152, 1920, 1248)  # a small cobbled patch below High St by the cafe: the terrace (Trym's pick)
STREETS = [HALL_ST, HIGH_ST, SQUARE, WEST_LN, EAST_LN, MAIN_ST, ORCH_PATH, MAIL_PATH, BUS_ROAD, EAST_PATH, WEST_PATH, TERRACE]
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

# ---- the paving: a TILE MAP wearing the pack's own grass-edge autotile (Trym, 11 Sep) ---
# Family 1 of the Godot autotile sheet (rows 1-4) is the pack's dirt path with ORGANIC
# grass lips on every edge and corner, in the SAME green as the world's grass tiles
# (family 4, the graveyard's dull green, showed as a band). Its flat fill is cut away so
# the grey cobbles show through: cobbles, with the pack's own art where stone meets grass.
# The hand-drawn 12px bites and the ruler rim are gone with it — a laid square meets
# the lawn the way the pack draws it, never as a straight line.
TC, TR = W // T + 1, H // T + 1
paved_t = [[False] * TC for _ in range(TR)]
THIN = set()   # tiles of the one-tile lanes: no bumps, a lane stays a lane
for (x0, y0, x1, y1) in STREETS:
    thin = (x1 - x0) <= T or (y1 - y0) <= T
    for r in range(TR):
        for c in range(TC):
            if x0 <= c * T + T // 2 < x1 and y0 <= r * T + T // 2 < y1:
                paved_t[r][c] = True
                if thin:
                    THIN.add((r, c))


def pav(r, c):
    return 0 <= r < TR and 0 <= c < TC and paved_t[r][c]


# a few one-tile bumps along the long edges (never two side by side, never a bite —
# a bite narrows a two-tile street), so no edge runs dead straight for a whole block
erng = random.Random(31)
bumps = []
for r in range(TR):
    for c in range(TC):
        if not pav(r, c) or (r, c) in THIN:
            continue
        for (dr, dc) in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            rr, cc = r + dr, c + dc
            if pav(rr, cc) or not (0 <= rr < TR and 0 <= cc < TC):
                continue
            if erng.random() < 0.14 and not any(abs(br - rr) + abs(bc - cc) == 1 for br, bc in bumps):
                bumps.append((rr, cc))
for br, bc in bumps:
    paved_t[br][bc] = True

FAM = Image.open(os.path.join(PACK, 'Autotiles_48x48', 'Godot_Autotiles_48x48.png')).convert('RGBA').crop((0, 0, 12 * T, 4 * T))


def _grass(p):
    return p[3] >= 128 and p[1] > p[0] + 8 and p[1] > p[2] + 8


def _stone(p):
    return p[3] >= 128 and not _grass(p) and (0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]) >= 95


# every family tile is indexed by what its border pixels say (stone or grass at the four
# edge midpoints and four corners) — 47 tiles, 47 distinct signatures, no layout table
PROBES = (('N', 24, 0), ('S', 24, 47), ('W', 0, 24), ('E', 47, 24), ('NW', 0, 0), ('NE', 47, 0), ('SW', 0, 47), ('SE', 47, 47))
FAMO = {}
for fr in range(4):
    for fc in range(12):
        ft = FAM.crop((fc * T, fr * T, (fc + 1) * T, (fr + 1) * T))
        if ft.getbbox() is None:
            continue
        fp = ft.load()
        sig = tuple(k for k, x, y in PROBES if _stone(fp[x, y]))
        # cut the flat fill away: the grass lips and their dark outline stay, cobbles show through
        for y in range(T):
            for x in range(T):
                if _stone(fp[x, y]):
                    fp[x, y] = (0, 0, 0, 0)
        FAMO[sig] = ft
assert len(FAMO) == 47, len(FAMO)

# grey cobbles only: Others_1 and Others_2 (Others_3 is the TAN one — Trym, 11 Sep)
COBS = [load_pack('ME_Singles_Terrains_and_Fences_48x48_Others_%d.png' % i).convert('RGBA') for i in (1, 2)]
crng = random.Random(5)
mask = Image.new('L', (W, H), 0)
md = ImageDraw.Draw(mask)
for r in range(TR):
    for c in range(TC):
        if not pav(r, c):
            continue
        t = COBS[crng.randrange(len(COBS))]
        k = crng.randrange(4)
        t = t.transpose(Image.ROTATE_90) if k == 1 else t.transpose(Image.ROTATE_180) if k == 2 else t.transpose(Image.FLIP_LEFT_RIGHT) if k == 3 else t
        im.alpha_composite(t, (c * T, r * T))
        md.rectangle([c * T, r * T, c * T + T - 1, r * T + T - 1], fill=255)
        n_, s_, w_, e_ = pav(r - 1, c), pav(r + 1, c), pav(r, c - 1), pav(r, c + 1)
        sig = []
        if n_: sig.append('N')
        if s_: sig.append('S')
        if w_: sig.append('W')
        if e_: sig.append('E')
        if n_ and w_ and pav(r - 1, c - 1): sig.append('NW')
        if n_ and e_ and pav(r - 1, c + 1): sig.append('NE')
        if s_ and w_ and pav(r + 1, c - 1): sig.append('SW')
        if s_ and e_ and pav(r + 1, c + 1): sig.append('SE')
        if len(sig) < 8:
            ov = FAMO.get(tuple(sig))
            if ov is None:
                raise SystemExit('no autotile for %r at tile %d,%d' % (sig, r, c))
            im.alpha_composite(ov, (c * T, r * T))
mp = mask.load()
px = im.load()


def paved(x, y):
    return 0 <= x < W and 0 <= y < H and mp[x, y] > 0

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


def foot(w, h_solid=18):
    """a building's footprint, relative to (cx, base): tight at the sides, and DEEP — up to the line
    where the front face meets the roof, so a building is a block you walk around, never a sheet
    you slip behind from its own doorstep (Trym, 11 Sep: "thin as a paper"). Per building:
    hall 143 (its lower block; the tower is sky), Bunch 200, post office 273, the two shops 180/184."""
    return ('rect', -int(w * PROP // 2) + 8, -h_solid, int(w * PROP // 2) - 8, 4)


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
strip = blockify(sheet, factor=1, colors=28, warm=0.0, sat=1.0, con=1.0, trim=False)   # one palette for all six
sw, shh = int(fw * PROP), int(sheet.height * PROP)
# ⚠️ six FRAME FILES, each cropped at the SOURCE size and resized ON ITS OWN. Resizing the
# whole strip as one image drifted the basin a pixel across the six frames (the
# resampler's phase walks along the strip; measured: the built frames' left edge went
# 17, 16, 16, 16, 16, 15 while the source's was 21 in all six) — that was the nudge Trym
# saw, twice. Same crop, same resize, same pixels: the basin cannot move.
for i in range(n):
    fr = strip.crop((i * fw, 0, (i + 1) * fw, sheet.height)).resize((sw, shh), Image.NEAREST)
    fr.save(os.path.join(OUT, 'a-fountain-%d.png' % i), optimize=True)
FX, FBASE = 1100, 900
shadow(FX, FBASE - 6, sw * 0.5, 12)
FOUNTAIN = [FX, FBASE, sw, shh, n]

# ---- 🎞 any other animated prop, the fountain's way: one palette for the strip, then each frame
# cropped at the source size and resized on its own; the files are a-<key>-<i>.png and the
# contract's ANIMS says where they stand and how fast they turn
ANIMS = []


def anim_prop(key, sheet_name, frames, fw, fh, cx, base, solid=None, period=0.8, sh=0.0):
    sh_ = Image.open(os.path.join(ANIM, sheet_name)).convert('RGBA')
    sub = Image.new('RGBA', (fw * len(frames), fh), (0, 0, 0, 0))
    for k, i in enumerate(frames):
        sub.alpha_composite(sh_.crop((i * fw, 0, (i + 1) * fw, fh)), (k * fw, 0))
    sub = blockify(sub, factor=1, colors=28, warm=0.0, sat=1.0, con=1.0, trim=False)
    w2, h2 = int(fw * PROP), int(fh * PROP)
    for k in range(len(frames)):
        sub.crop((k * fw, 0, (k + 1) * fw, fh)).resize((w2, h2), Image.NEAREST).save(os.path.join(OUT, 'a-%s-%d.png' % (key, k)), optimize=True)
    if sh:
        shadow(cx, base - 4, w2 * sh, 8)
    ANIMS.append([key, int(cx), int(base), w2, h2, len(frames), period])
    if solid:
        COLLIDERS.append((key, solid, int(cx), int(base)))
# ⛔ nobody walks INTO the fountain's picture: a banana whose feet are behind the basin
# (y < FBASE) is drawn under it, so its body must clear the silhouette by its own half
# width (~40 px). Two circles trace that: the bowl (half-width 72 at y 814-838) and the
# tower above it (Trym, 11 Sep: "the fountain overflows my banana").
# (a first pass used +40 px and Trym found it wide: colliders stay TIGHT, +20 here, ~0 on props)
COLLIDERS.append(('fountain', ('circle', 92), FX, FBASE - 48))
# the tower is a cone, not a ball: a small circle at its tip keeps the lane between the
# statue and the fountain open (Trym: "I cant seem to walk here")
COLLIDERS.append(('fountain-top', ('circle', 38), FX, FBASE - 108))   # hugs the tower where it widens; the ground above the tip is free (Trym, 11 Sep)

# ---- THE TOWN --------------------------------------------------------------------
SPOTS, NPCS = {}, []

# the north row, doors on Hall Street: the residence · the town hall · the post office
place('ME_Singles_Generic_Building_48x48_Condo_3_45.png', 480, 560, solid=foot(288, 200), sh=0.45)
SPOTS['condo'] = (480, 560)
place('ME_Singles_School_48x48_Clock_Tower_1.png', 1100, 560, solid=foot(384, 143), sh=0.45)
SPOTS['hall'] = (1100, 560)
NPCS.append(('nib', 1140, 586, 'Nib'))
place('22_Post_Office_48x48_Building_1.png', 1700, 560, solid=foot(384, 273), sh=0.45)
SPOTS['post'] = (1700, 560)
NPCS.append(('stamp', 1750, 586, 'Stamp'))
try_place(['22_Post_Office_48x48_Big_Blue_Mailbox.png'], 1830, 592, solid=('rect', -12, -10, 12, 4))
NPCS.append(('moss', 700, 640, 'Moss'))

# the south row, doors on High Street: the general store (+ the bank, an ATM) · the print shop · the café
place('ME_Singles_Shopping_Center_and_Markets_48x48_Market_Small_1.png', 480, 1040, solid=foot(240, 180), sh=0.45)
SPOTS['store'] = (480, 1040)
NPCS.append(('pip', 530, 1066, 'Pip'))
try_place(['ME_Singles_City_Props_48x48_ATM_1.png'], 620, 1040, solid=('rect', -24, -40, 24, 4))
SPOTS['bank'] = (620, 1040)
place('ME_Singles_Shopping_Center_and_Markets_48x48_Market_Small_7.png', 1620, 1040, solid=foot(240, 184), sh=0.45)
SPOTS['print'] = (1620, 1040)
try_place(['ME_Singles_City_Props_48x48_Kiosk_Coffee_Cup.png'], 1830, 1040, scale=PROP * 0.8, solid=('rect', -54, -150, 54, 4), sh=0.45)
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
place('FARM:Market_Stand_Yellow_Big_48x48.png', 800, 780, solid=('rect', -80, -24, 80, 4), sh=0.5)
SPOTS['exchange'] = (800, 780)
NPCS.append(('figjr', 800, 800, 'Fig Jr.'))
place('FARM:Market_Stand_Yellow_Big_48x48.png', 1400, 780, flip=True, solid=('rect', -80, -24, 80, 4), sh=0.5)
SPOTS['wheel'] = (1400, 780)
NPCS.append(('spinner', 1400, 800, 'Spinner'))
_cache[('__board', 1, 28, 0.0, 1.0, 1.0)] = build_noticeboard()
place('__board', 740, 990, scale=1.0, solid=('rect', -48, -12, 48, 4), sh=0.5)
SPOTS['board'] = (740, 990)
try_place(['ME_Singles_Vehicles_48x48_Fruit_Flowers_Cart_2.png'], 1460, 1010, solid=('rect', -36, -16, 36, 4), sh=0.45)
SPOTS['cart'] = (1460, 1010)
# (the putto that stood on the door-to-fountain axis is gone — Trym, 11 Sep: "remove the statue in the town centre")
for (bx, by) in ((960, 1036), (1240, 1036)):
    try_place(['ME_Singles_Garden_48x48_Big_Bench_Horizontal.png'], bx, by, solid=('rect', -50, -8, 50, 4), sh=0.4)   # flat and minimal in the centre (Trym), wooden in the outer parts
NPCS.append(('dot', 1010, 1120, 'Dot'))
# decor, which may sit tight: lamps at the corners, a hydrant, a bin, a bear, bushes, a phone booth
for (lx, ly) in ((690, 690), (1510, 690), (690, 1030), (1510, 1030), (300, 600), (1980, 600), (300, 1100), (1980, 1100)):
    # the arm hangs over the street, never into a building: the sprite's arm points right, so the east-side lamps are mirrored (Trym)
    try_place(['ME_Singles_City_Props_48x48_Street_Lamp_1.png'], lx, ly, shade=False, solid=('circle', 7), flip=(lx > 1100))
try_place(['ME_Singles_City_Props_48x48_Phone_Booth_1.png'], 690, 560, solid=('rect', -28, -70, 28, 4))   # on the Bunch's corner by the orchard lane (Trym: "move the red telephone kiosk to the empty space")
try_place(['ME_Singles_City_Props_48x48_Hydrant_1.png'], 360, 1044, shade=False, solid=('circle', 7))   # on the kerb beside the store, not in the road (Trym)
try_place(['ME_Singles_City_Props_48x48_Small_Closed_Trash_Can.png'], 662, 1040, shade=False, solid=('circle', 7))   # at the kerb between the ATM and the lamp, not in the road (Trym)
try_place(['ME_Singles_Garden_48x48_Flowers_Bench_Horizontal.png'], 960, 640, shade=False)
try_place(['ME_Singles_Garden_48x48_Flowers_Bench_Horizontal.png'], 1240, 640, shade=False)
for (bx, by) in ((380, 960), (1900, 960), (620, 1200), (1580, 1200)):
    try_place(['ME_Singles_Garden_48x48_Bush_18.png'], bx, by, shade=False, solid=('circle', 12))

# ---- Trym's picks from the pack preview (11 Sep night): trees that stand on a square of grass
# in the pavement, framing the fountain's north side and the park road's mouth; dumpsters in
# the works yard and by the back lane behind the café
for (tx, ty, tn) in ((980, 760, 13), (1220, 760, 13), (1260, 1148, 13)):   # Tree_13, the tan stone kerb — not the white-framed ones (Trym)
    try_place(['ME_Singles_City_Props_48x48_Tree_%d.png' % tn], tx, ty, shade=False, solid=('rect', -30, -22, 30, 4))
try_place(['ME_Singles_City_Props_48x48_Dumpster_4.png'], 200, 330, solid=('rect', -36, -20, 36, 4), sh=0.4)
try_place(['ME_Singles_City_Props_48x48_Dumpster_1.png'], 2070, 1130, solid=('rect', -36, -20, 36, 4), sh=0.4)
# the info point at the gate, west of the park road: the map of the town (Trym: "theres also info kiosks")
try_place(['ME_Singles_City_Props_48x48_Kiosk_Infopoint_1.png'], 900, 1226, solid=('rect', -80, -120, 80, 4), sh=0.45)
SPOTS['info'] = (900, 1226)
# the terrace by the cafe: the pack's small fountain (animated), two sideways benches, two small bins (Trym's pick)
anim_prop('smallfount', 'Fountain_48x48 - Copia.png', [0, 1, 2, 3, 4, 5, 6, 7], 96, 144, 1770, 1240, solid=('rect', -30, -26, 30, 4), period=1.2, sh=0.5)
# the benches face the fountain (6 on the left looks right, 5 on the right looks left) with air between (Trym)
try_place(['ME_Singles_City_Props_48x48_Bench_6.png'], 1670, 1236, solid=('rect', -12, -50, 12, 4), sh=0.3)
try_place(['ME_Singles_City_Props_48x48_Bench_5.png'], 1870, 1236, solid=('rect', -12, -50, 12, 4), sh=0.3)
for bx in (1610, 1912):   # the small bins at the patch's street corners, outside the benches
    try_place(['ME_Singles_City_Props_48x48_Small_Closed_Trash_Can.png'], bx, 1170, shade=False, solid=('circle', 7))
SPOTS['terrace'] = (1770, 1240)

# ---- the mini-areas (Trym, 11 Sep evening: "see these mini-areas and develop a purpose for them") ----
# Second pass, after Trym's look: an object stands where it would stand in a real cosy town. No row of
# mailboxes on a lawn, no two lamps side by side, no lone topiary bear on the cobbles.
# A · THE ORCHARD, between the Bunch and the hall: a lane up from Hall St, three apple trees with apples
#     under them, the residents' washing line on the Bunch's side, a table under the trees, and the
#     lemonade stand where a kid from the Bunch would set it up: at the lane, by the street
for (tx, ty, tn) in ((690, 330, 16), (900, 330, 17), (790, 215, 18)):
    try_place(['ME_Singles_Camping_48x48_Tree_%d.png' % tn], tx, ty, shade=False, solid=('rect', -12, -26, 12, 2))   # = TRUNK, defined below
for (ax, ay, an) in ((650, 352, 1), (925, 350, 2), (760, 240, 3), (860, 372, 1)):
    try_place(['ME_Singles_Camping_48x48_Apples_%d.png' % an], ax, ay, shade=False)
try_place(['ME_Singles_City_Props_48x48_Hanging_Clothes_6.png'], 680, 395, shade=False, solid=('rect', -60, -6, 60, 4))   # hung higher up the lawn, the booth stands below it
try_place(['ME_Singles_Camping_48x48_Benched_Table_1.png'], 890, 420, solid=('rect', -36, -14, 36, 4), sh=0.35)
try_place(['ME_Singles_Villas_48x48_Lemonade_Stand_2.png'], 890, 545, solid=('rect', -36, -16, 36, 4), sh=0.35)
SPOTS['orchard'] = (792, 300)
SPOTS['stand'] = (890, 545)
# B · THE MONUMENT, between the hall and the post office: a lane up to a statue on the lawn, two potted
#     bushes flanking it, a drinking fountain and a bench by the lane — the civic garden
try_place(['ME_Singles_Garden_48x48_Grey_Statue.png'], 1416, 330, solid=('rect', -30, -16, 30, 4), sh=0.4)
for px_ in (1350, 1482):
    try_place(['ME_Singles_Garden_48x48_Bush_Potted_3.png'], px_, 340, shade=False, solid=('rect', -12, -8, 12, 4))
anim_prop('drink', 'Drinking_Fountain_1_loop_3-6_48x48.png', [2, 3, 4, 5], 96, 144, 1330, 470, solid=('rect', -14, -10, 14, 4), period=0.8)   # the water loop: 8 frames of 96 px (not 48 — the first cut split the fountain in halves), frames 3-6 loop
try_place(['ME_Singles_City_Props_48x48_Bench_2.png'], 1500, 470, solid=('rect', -36, -10, 36, 4), sh=0.35)
SPOTS['monument'] = (1416, 330)
# C · THE BUS STOP, the north-east corner: the east lane runs north out of town, a shelter beside it, nothing else
try_place(['ME_Singles_Vehicles_48x48_Bus_Stop_1.png'], 2060, 330, solid=('rect', -84, -24, 84, 4), sh=0.4)
SPOTS['bus'] = (2060, 330)
SPOTS['cut'] = (1944, 90)
# D · THE CAFE GARDEN, the strip behind the print shop and the cup: two benches facing the lane, potted
#     bushes and a flower bed between — the café's seating, one lane from the square
for bx in (1600, 1860):
    try_place(['ME_Singles_City_Props_48x48_Bench_2.png'], bx, 758, solid=('rect', -36, -10, 36, 4), sh=0.35)
for px_ in (1672, 1788):
    try_place(['ME_Singles_Garden_48x48_Bush_Potted_3.png'], px_, 754, shade=False, solid=('rect', -12, -8, 12, 4))
try_place(['ME_Singles_City_Props_48x48_Flower_Bush_1.png'], 1730, 752, shade=False, solid=('rect', -36, -8, 36, 4))
SPOTS['garden_e'] = (1730, 640)
# E · GRAN FIG'S GARDEN, the strip behind the store, under the Bunch: her flower beds, a bench, a potted bush
try_place(['ME_Singles_Garden_48x48_Bush_Potted_3.png'], 372, 754, shade=False, solid=('rect', -12, -8, 12, 4))
for fx in (440, 530):
    try_place(['ME_Singles_City_Props_48x48_Flower_Bush_3.png'], fx, 752, shade=False, solid=('rect', -36, -8, 36, 4))
try_place(['ME_Singles_City_Props_48x48_Bench_2.png'], 610, 758, solid=('rect', -36, -10, 36, 4), sh=0.35)
SPOTS['garden_w'] = (500, 640)

# the treeline: the park's camping trees, the town's walls
BIG_TREES = ['ME_Singles_Camping_48x48_Tree_%d.png' % n for n in (1, 2, 3, 13, 14, 15, 16, 17, 18)]
SMALLS = ['ME_Singles_City_Props_48x48_Bush_%d.png' % n for n in (1, 2, 3)]
TRUNK = ('rect', -12, -26, 12, 2)


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


treeline([(60, 30, 1880, 70), (2050, 30, 2160, 70), (20, 560, 60, 1290), (2140, 420, 2190, 1290), (300, 1290, 780, 1300),
          (1200, 1290, 1500, 1300), (2000, 1290, 2150, 1300)])   # a gap in the south trees for the terrace   # the edges only: the groves gave way to the mini-areas, the top opens for the bus road
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
     'export const ANIMS = %s;' % [list(a) for a in ANIMS],
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
