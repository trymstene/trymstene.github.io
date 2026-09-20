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
  public/assets/town/s-<key>-N.png   the STATE sprites the condition system swaps in (Town Life)
  src/scripts/town-geo.js            ⚠️ THE CONTRACT with the town engine
Run: python tools/build-town-scene.py
"""
import os
import random
import sys
from PIL import Image, ImageChops, ImageDraw

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
HALL_ST = (156, 560, 2020, 660)      # along the north row's doors — west to 156 since the clothes shop joined it
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
# 🛋️ SOMEWHERE TO SIT, declared where the prop is chosen — the only place that knows. A visitor
# sitting down needs two things the key alone cannot give: WHICH props are seats (the square has
# flower-box "benches" that are planters, and a banana sat on one vanishes behind the petals) and
# WHICH WAY a sitter faces (the terrace pair face the fountain, not the middle of the map). `face` is
# 'l' or 'r' as the player SEES it; town-folk.js turns that into the engine's inverted frame numbers.
SEATS = []


def seat(key, cx, base, face=None):
    SEATS.append([key, int(cx), int(base), face or ('r' if cx < 1100 else 'l')])


def load_any(name):
    if name.startswith('FARM:'):
        return Image.open(os.path.join(FARM, name[5:])).convert('RGBA')
    return load_pack(name)


def place(name, cx, base, factor=1, colors=28, warm=0.0, sat=1.0, con=1.0, flip=False,
          shade=True, sh=0.30, scale=PROP, solid=None, layer=True, img=None, key=None):
    # `key` names the prop for the town's condition system (town-room.js): a keyed overlay
    # can be swapped, hidden or marked at runtime; an unkeyed one is scenery
    ck = (name, factor, colors, warm, sat, con)   # the blockify cache key (NOT the prop's `key`)
    if ck not in _cache:
        src = img if img is not None else load_any(name)
        _cache[ck] = blockify(src, factor=factor, colors=colors, warm=warm, sat=sat, con=con)
    s = _cache[ck]
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
        OVERLAYS.append((fn, box[0], box[1], s.width, s.height, int(base), key or ''))
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
place('ME_Singles_Generic_Building_48x48_Condo_3_45.png', 480, 560, solid=foot(288, 200), sh=0.45, key='condo')   # 🕹 THE ARCADE (was The Bunch — Trym, 11 Sep night)
SPOTS['condo'] = (480, 560)
place('ME_Singles_School_48x48_Clock_Tower_1.png', 1100, 560, solid=foot(384, 143), sh=0.45, key='hall')
SPOTS['hall'] = (1100, 560)
NPCS.append(('nib', 1140, 586, 'Nib'))
place('22_Post_Office_48x48_Building_1.png', 1700, 560, solid=foot(384, 273), sh=0.45, key='post')
SPOTS['post'] = (1700, 560)
NPCS.append(('stamp', 1750, 586, 'Stamp'))
try_place(['22_Post_Office_48x48_Big_Blue_Mailbox.png'], 1830, 592, solid=('rect', -12, -10, 12, 4))
NPCS.append(('moss', 700, 640, 'Moss'))

# the south row, doors on High Street: the general store (+ the bank, an ATM) · the print shop · the café
place('ME_Singles_Shopping_Center_and_Markets_48x48_Market_Small_1.png', 480, 1040, solid=foot(240, 180), sh=0.45, key='store')
SPOTS['store'] = (480, 1040)
NPCS.append(('pip', 530, 1066, 'Pip'))
try_place(['ME_Singles_City_Props_48x48_ATM_1.png'], 620, 1040, solid=('rect', -24, -40, 24, 4))
SPOTS['bank'] = (620, 1040)
place('ME_Singles_Shopping_Center_and_Markets_48x48_Market_Small_7.png', 1620, 1040, solid=foot(240, 184), sh=0.45, key='print')
SPOTS['print'] = (1620, 1040)
try_place(['ME_Singles_City_Props_48x48_Kiosk_Coffee_Cup.png'], 1830, 1040, scale=PROP * 0.8, solid=('rect', -54, -150, 54, 4), sh=0.45, key='cafe')
SPOTS['cafe'] = (1830, 1040)
# ☕ THE SERVING WINDOW — where a banana STANDS WHILE IT WORKS (Trym, 19 Sep: "the banana can be
# inside of that window … let the coffee cup sprite overflow the banana"). The pack ships the same
# kiosk twice, once empty and once with its own barista in the hatch, so the window is not guessed:
# it is the DIFFERENCE between them, measured after the very same blockify and scale this prop went
# through, which is the only reason it cannot drift when the prop's scale or palette changes.
_cv = OVERLAYS[-1]
assert _cv[6] == 'cafe', 'the café must be the overlay just placed'
# ⚠️ BOTH PAIRS LIE, IN OPPOSITE DIRECTIONS, and both were measured before this line was written:
#   · blockify with NO threshold quantises to a palette per image, so two sprites that differ in one
#     corner come back differing almost everywhere — the bbox was the whole kiosk (a 246 px "barista").
#   · the RAW pair diffs cleanly, but it catches the coffee machine's lit screen as well as the
#     barista, and the box comes out 111 px wide with its centre 20 px left of the hatch's.
# So: blockify BOTH through the very pipeline the prop went through, and threshold the difference. The
# palette shift is small everywhere and enormous where a banana-sized character was added, so the
# survivor is the barista alone. It lands where the eye puts it on the built square, which is the test.
_ka = blockify(load_pack('ME_Singles_City_Props_48x48_Kiosk_Coffee_Cup.png'), factor=1, colors=28, warm=0.0, sat=1.0, con=1.0)
_kb = blockify(load_pack('ME_Singles_City_Props_48x48_Kiosk_Coffee_Cup_Example.png'), factor=1, colors=28, warm=0.0, sat=1.0, con=1.0)
assert _ka.size == _kb.size, 'the two kiosks must trim alike or the difference is meaningless'
_dw = ImageChops.difference(_ka.convert('RGB'), _kb.convert('RGB')).point(lambda v: 255 if v > 70 else 0).convert('L').getbbox()
_kx, _ky = _cv[3] / float(_ka.width), _cv[4] / float(_ka.height)
# [centre x, the floor its feet stand on, the pack barista's own visible height] — all in world px
CAFE_WIN = [int(round(_cv[1] + ((_dw[0] + _dw[2]) / 2.0) * _kx)),
            int(round(_cv[2] + _dw[3] * _ky)),
            int(round((_dw[3] - _dw[1]) * _ky))]
# ✂️ AND THE OPENING ITSELF, so the kiosk can OVERFLOW the banana rather than the banana overflow the
# kiosk (Trym's words). Without this a viking helmet's horns run straight up the COFFEE AND TEA sign —
# seen, not guessed. It is flood-filled from the hatch's middle through the dark interior, bounded to
# the hatch's own rows so the fill cannot escape through the sign's dark letters, which it does.
_ov = Image.open(os.path.join(OUT, _cv[0])).convert('RGBA')
_op = _ov.load()
_y0b, _y1b = int(round((_dw[3] - _dw[1] * 0) * _ky)) - 30, int(round(_dw[3] * _ky)) + 4
_seen, _stack, _bx = set(), [(CAFE_WIN[0] - _cv[1], CAFE_WIN[1] - _cv[2] - 14)], [9999, 9999, 0, 0]
while _stack:
    _x, _y = _stack.pop()
    if (_x, _y) in _seen or not (0 <= _x < _ov.width and _y0b <= _y <= _y1b):
        continue
    _r, _g, _b, _a = _op[_x, _y]
    if _a < 8 or (0.299 * _r + 0.587 * _g + 0.114 * _b) >= 100:
        continue
    _seen.add((_x, _y))
    _bx[0] = min(_bx[0], _x); _bx[1] = min(_bx[1], _y); _bx[2] = max(_bx[2], _x); _bx[3] = max(_bx[3], _y)
    _stack += [(_x + 1, _y), (_x - 1, _y), (_x, _y + 1), (_x, _y - 1)]
# […, x0, y0, x1, y1] — the opening in world px, with a pixel of slack so the arch's own rim is not a hairline
CAFE_WIN += [_cv[1] + _bx[0] - 2, _cv[2] + _bx[1] - 2, _cv[1] + _bx[2] + 3, _cv[2] + _bx[3] + 3]
print('  cafe window: centre x %d, floor y %d, barista %d px; the opening x %d..%d y %d..%d' % (CAFE_WIN[0], CAFE_WIN[1], CAFE_WIN[2], CAFE_WIN[3], CAFE_WIN[5], CAFE_WIN[4], CAFE_WIN[6]))
NPCS.append(('bean', 1780, 1066, 'Bean'))

# 👕 THE CLOTHES SHOP, north-west — where the worksite hoarding stood (Trym, 20 Sep, marked on the
# map: "we need to add another building to the town thats just says CLOTHES"). It is a DRESSING ROOM and
# nothing else: no job, no boss, no counter — you tap it and change what your banana is wearing.
#
# ⚠️ MARKET_SMALL_11, and the number is a choice. The pack has no clothes shop: all twelve Market_Small
# fronts are the same shell in different colourways, which is why this one wears a CLOTHES plank the way
# the print shop wears STICKERS. #1 is the general store (green and pink) and #7 is the print shop (blue
# and orange), so a third shop from either of those families would read as one of them at a glance. #11
# is the cream-and-red one, and it is the only free front with a BAY window — a display window is what a
# clothes shop has.
place('ME_Singles_Shopping_Center_and_Markets_48x48_Market_Small_11.png', 190, 560,
      solid=foot(240, 180), sh=0.45, key='clothes')
SPOTS['clothes'] = (190, 560)

# the square: three stalls with room between them, the board, the statue on the axis
place('FARM:Market_Stand_Yellow_Big_48x48.png', 800, 780, solid=('rect', -80, -24, 80, 4), sh=0.5, key='exchange')
SPOTS['exchange'] = (800, 780)
NPCS.append(('figjr', 800, 800, 'Fig Jr.'))
place('FARM:Market_Stand_Yellow_Big_48x48.png', 1400, 780, flip=True, solid=('rect', -80, -24, 80, 4), sh=0.5, key='wheel')
SPOTS['wheel'] = (1400, 780)
NPCS.append(('spinner', 1400, 800, 'Spinner'))
_cache[('__board', 1, 28, 0.0, 1.0, 1.0)] = build_noticeboard()
place('__board', 800, 990, scale=1.0, solid=('rect', -48, -12, 48, 4), sh=0.5, key='board')   # 800: clear of the lamp at 690 (Trym, 14 Sep: "cramped into a street light")
SPOTS['board'] = (800, 990)
try_place(['ME_Singles_Vehicles_48x48_Fruit_Flowers_Cart_2.png'], 1460, 1010, solid=('rect', -36, -16, 36, 4), sh=0.45, key='cart')
SPOTS['cart'] = (1460, 1010)
# (the putto that stood on the door-to-fountain axis is gone — Trym, 11 Sep: "remove the statue in the town centre")
for bi, (bx, by) in enumerate(((960, 1036), (1240, 1036))):
    try_place(['ME_Singles_Garden_48x48_Big_Bench_Horizontal.png'], bx, by, solid=('rect', -50, -8, 50, 4), sh=0.4, key='benchsq%d' % bi)   # flat and minimal in the centre (Trym), wooden in the outer parts
    seat('benchsq%d' % bi, bx, by)
NPCS.append(('dot', 1010, 1120, 'Dot'))
# decor, which may sit tight: lamps at the corners, a hydrant, a bin, a bear, bushes, a phone booth
for li, (lx, ly) in enumerate(((690, 690), (1510, 690), (690, 1030), (1510, 1030), (300, 600), (1980, 600), (300, 1100), (1980, 1100))):
    # the arm hangs over the street, never into a building: the sprite's arm points right, so the east-side lamps are mirrored (Trym)
    try_place(['ME_Singles_City_Props_48x48_Street_Lamp_1.png'], lx, ly, shade=False, solid=('circle', 7), flip=(lx > 1100), key='lamp%d' % li)
try_place(['ME_Singles_City_Props_48x48_Phone_Booth_1.png'], 690, 560, solid=('rect', -28, -70, 28, 4), key='phone')   # on the Bunch's corner by the orchard lane (Trym: "move the red telephone kiosk to the empty space")
try_place(['ME_Singles_City_Props_48x48_Hydrant_1.png'], 360, 1044, shade=False, solid=('circle', 7), key='hydrant')   # on the kerb beside the store, not in the road (Trym)
try_place(['ME_Singles_City_Props_48x48_Small_Closed_Trash_Can.png'], 662, 1040, shade=False, solid=('circle', 7), key='bin')   # at the kerb between the ATM and the lamp, not in the road (Trym)
try_place(['ME_Singles_Garden_48x48_Flowers_Bench_Horizontal.png'], 960, 640, shade=False, key='benchh0')
try_place(['ME_Singles_Garden_48x48_Flowers_Bench_Horizontal.png'], 1240, 640, shade=False, key='benchh1')
for (bx, by) in ((380, 960), (1900, 960), (620, 1200), (1580, 1200)):
    try_place(['ME_Singles_Garden_48x48_Bush_18.png'], bx, by, shade=False, solid=('circle', 12))

# ---- Trym's picks from the pack preview (11 Sep night): trees that stand on a square of grass
# in the pavement, framing the fountain's north side and the park road's mouth; dumpsters in
# the works yard and by the back lane behind the café
for (tx, ty, tn) in ((980, 760, 13), (1220, 760, 13), (1260, 1148, 13)):   # Tree_13, the tan stone kerb — not the white-framed ones (Trym)
    try_place(['ME_Singles_City_Props_48x48_Tree_%d.png' % tn], tx, ty, shade=False, solid=('rect', -30, -22, 30, 4))
# ⚠️ MOVED, NEVER DELETED (20 Sep): it stood at 200,330 in the works yard, which is inside the clothes
# shop's sprite now. dump0 is one of the two `dumps` anchors in src/data/town/problems.js, it has its own
# full/closed art in town-room.js, and a missing anchor is a problem type that can never be drawn.
try_place(['ME_Singles_City_Props_48x48_Dumpster_4.png'], 96, 706, solid=('rect', -36, -20, 36, 4), sh=0.4, key='dump0')   # west of the clothes shop: open and empty by default
try_place(['ME_Singles_City_Props_48x48_Dumpster_1.png'], 2070, 1130, solid=('rect', -36, -20, 36, 4), sh=0.4, key='dump1')   # behind the café: closed
# the info point at the gate, west of the park road: the map of the town (Trym: "theres also info kiosks")
try_place(['ME_Singles_City_Props_48x48_Kiosk_Infopoint_1.png'], 900, 1226, solid=('rect', -80, -120, 80, 4), sh=0.45, key='info')
SPOTS['info'] = (900, 1226)
# ℹ️ SOMEBODY IS IN THERE. Trym, 20 Sep: "if we can make a banana sit inside the kiosk sprite-wise
# aswell that would be cool — must be implemented like we did with the coffee shop, half upper
# body-banana that sits inside the info kiosk in locked hands-up-frame, same size on the kiosk-banana
# as for the coffee shop-banana."
#
# ⚠️ AND IT CANNOT BE MEASURED THE CAFÉ'S WAY. The coffee kiosk ships TWICE in the pack — once empty
# and once with its own barista leaning out — so its hatch is the DIFFERENCE between two sprites and
# nothing was guessed. The infopoint ships once. So the window is stated here as a fraction of the
# PLACED overlay, read off a 5× render of the very file this line exports (scratchpad/ov37-win.png):
# the dark counter recess under the [i] sign, x 30..140 and y 116..158 of a 172×211 prop. Fractions,
# not pixels, so a change to PROP or to the kiosk's own 0.76 moves the window with the kiosk.
#
# ⚠️ A RECTANGLE, NOT THE CAFÉ'S ELLIPSE. The coffee hatch is an arch and a box clip decapitates the
# banana; this recess is a square-cut counter, and its straight lower edge is exactly the thing that
# makes the attendant read as half a banana leaning on a counter rather than a banana in a hole.
_iv = OVERLAYS[-1]
assert _iv[6] == 'info', 'the kiosk must be the overlay just placed'
INFO_WIN = [int(round(_iv[1] + 0.494 * _iv[3])), 0,
            int(round(_iv[1] + 0.174 * _iv[3])), int(round(_iv[2] + 0.550 * _iv[4])),
            int(round(_iv[1] + 0.814 * _iv[3])), int(round(_iv[2] + 0.749 * _iv[4]))]
INFO_WIN[1] = INFO_WIN[3]   # the crown sits at the window's own top, the same rule the café uses
print('  info kiosk window: centre x %d, top y %d; the opening x %d..%d y %d..%d'
      % (INFO_WIN[0], INFO_WIN[1], INFO_WIN[2], INFO_WIN[4], INFO_WIN[3], INFO_WIN[5]))
# the terrace by the cafe: the pack's small fountain (animated), two sideways benches, two small bins (Trym's pick)
anim_prop('smallfount', 'Fountain_48x48 - Copia.png', [0, 1, 2, 3, 4, 5, 6, 7], 96, 144, 1770, 1240, solid=('rect', -30, -26, 30, 4), period=1.2, sh=0.5)
# the benches face the fountain (6 on the left looks right, 5 on the right looks left) with air between (Trym)
try_place(['ME_Singles_City_Props_48x48_Bench_6.png'], 1670, 1236, solid=('rect', -12, -50, 12, 4), sh=0.3, key='bencht0')
seat('bencht0', 1670, 1236, 'r')   # Bench_6 looks right, and the terrace fountain is to its right
try_place(['ME_Singles_City_Props_48x48_Bench_5.png'], 1870, 1236, solid=('rect', -12, -50, 12, 4), sh=0.3, key='bencht1')
seat('bencht1', 1870, 1236, 'l')   # Bench_5 looks left, at the same fountain
for bi, bx in enumerate((1610, 1912)):   # the small bins at the patch's street corners, outside the benches
    try_place(['ME_Singles_City_Props_48x48_Small_Closed_Trash_Can.png'], bx, 1170, shade=False, solid=('circle', 7), key='bin%d' % (bi + 1))
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
try_place(['ME_Singles_Garden_48x48_Grey_Statue.png'], 1416, 330, solid=('rect', -30, -16, 30, 4), sh=0.4, key='statue')
for px_ in (1350, 1482):
    try_place(['ME_Singles_Garden_48x48_Bush_Potted_3.png'], px_, 340, shade=False, solid=('rect', -12, -8, 12, 4))
anim_prop('drink', 'Drinking_Fountain_1_loop_3-6_48x48.png', [2, 3, 4, 5], 96, 144, 1330, 470, solid=('rect', -14, -10, 14, 4), period=0.8)   # the water loop: 8 frames of 96 px (not 48 — the first cut split the fountain in halves), frames 3-6 loop
try_place(['ME_Singles_City_Props_48x48_Bench_2.png'], 1500, 470, solid=('rect', -36, -10, 36, 4), sh=0.35, key='benchm')
seat('benchm', 1500, 470)
SPOTS['monument'] = (1416, 330)
# C · THE BUS STOP, the north-east corner: the east lane runs north out of town, a shelter beside it, nothing else
try_place(['ME_Singles_Vehicles_48x48_Bus_Stop_1.png'], 2060, 330, solid=('rect', -84, -24, 84, 4), sh=0.4, key='bus')
SPOTS['bus'] = (2060, 330)
SPOTS['cut'] = (1944, 90)
# D · THE CAFE GARDEN, the strip behind the print shop and the cup: two benches facing the lane, potted
#     bushes and a flower bed between — the café's seating, one lane from the square
for bi, bx in enumerate((1600, 1860)):
    try_place(['ME_Singles_City_Props_48x48_Bench_2.png'], bx, 758, solid=('rect', -36, -10, 36, 4), sh=0.35, key='benchc%d' % bi)
    seat('benchc%d' % bi, bx, 758)
for px_ in (1672, 1788):
    try_place(['ME_Singles_Garden_48x48_Bush_Potted_3.png'], px_, 754, shade=False, solid=('rect', -12, -8, 12, 4))
try_place(['ME_Singles_City_Props_48x48_Flower_Bush_1.png'], 1730, 752, shade=False, solid=('rect', -36, -8, 36, 4))
SPOTS['garden_e'] = (1730, 640)
# E · GRAN FIG'S GARDEN, the strip behind the store, under the Bunch: her flower beds, a bench, a potted bush
try_place(['ME_Singles_Garden_48x48_Bush_Potted_3.png'], 372, 754, shade=False, solid=('rect', -12, -8, 12, 4))
for fx in (440, 530):
    try_place(['ME_Singles_City_Props_48x48_Flower_Bush_3.png'], fx, 752, shade=False, solid=('rect', -36, -8, 36, 4))
try_place(['ME_Singles_City_Props_48x48_Bench_2.png'], 610, 758, solid=('rect', -36, -10, 36, 4), sh=0.35, key='benchg')
seat('benchg', 610, 758)
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


# ---- 🗞 the litter: the pack's paper flyers, blockified at the town's PROP scale like any prop,
# but exported as loose files — the life system (town-life.js) puts six of them on the streets at
# dawn, Moss sweeps them, the player may pick one up
def export_prop(name, out_name, scale=PROP):
    s = blockify(load_pack(name), factor=1, colors=28, warm=0.0, sat=1.0, con=1.0)
    s = s.resize((max(1, int(s.width * scale)), max(1, int(s.height * scale))), Image.NEAREST)
    s.save(os.path.join(OUT, out_name), optimize=True)
    return s.size


for i in (1, 2):
    try:
        print('  litter-%d.png' % i, export_prop('ME_Singles_Generic_Building_48x48_Condo_8_Flyer_%d.png' % i, 'litter-%d.png' % i))
    except Exception as e:
        print('  ! litter', i, e)

# ---- 🏘️ THE STATES (Town Life, 14 Sep 2026): what a prop looks like when something is wrong
# with it, or when the town is thriving, or on a Curse Night. Loose files like the litter,
# never placed here — town-room.js puts them on the map from the condition tables, keyed by
# the prop's `key`. Frames the fountain's way: one palette for the strip, each frame cropped
# at the source size and resized on its own. STATE says how big each one is, so the client
# can position a sprite before it has loaded.
STATE = {}
for f in os.listdir(OUT):
    if f.startswith('s-'):
        os.remove(os.path.join(OUT, f))


def export_frames(key, sheet_name, cols, fw, fh, row=0, scale=PROP, soft=False):
    sh_ = Image.open(os.path.join(ANIM, sheet_name)).convert('RGBA')
    sub = Image.new('RGBA', (fw * len(cols), fh), (0, 0, 0, 0))
    for k, i in enumerate(cols):
        sub.alpha_composite(sh_.crop((i * fw, row * fh, (i + 1) * fw, (row + 1) * fh)), (k * fw, 0))
    # ⚠️ LIGHT AND GHOSTS ARE SOFT. blockify thresholds alpha into a hard silhouette (by
    # design, for props) — which deletes a lamp's halo, a lantern's glow and a ghost's fade
    # outright (14 Sep: the lamps lit at night and nothing showed). Those keep their alpha.
    if not soft:
        sub = blockify(sub, factor=1, colors=28, warm=0.0, sat=1.0, con=1.0, trim=False)
    # ⚠️ A GUESSED CELL WIDTH LOOKS LEGAL AND RENDERS AS A GLITCH. `lantern` shipped as 96 wide because
    # 576 ÷ 96 = 6 divides evenly — and two of those six frames held no lantern at all while the rest sat
    # half a cell apart. Nothing caught it for weeks; it was found by eye, in the game, at night.
    # An animation's subject does not teleport between frames: every frame must HAVE something in it, and
    # its opaque box must stay put. (Deliberately generous — a third of a cell — so real motion passes:
    # a crow's wings and a rolling shutter both move plenty inside this.)
    boxes = [sub.crop((k * fw, 0, (k + 1) * fw, fh)).getbbox() for k in range(len(cols))]
    # ⚠️ A TRAILING EMPTY FRAME IS A FADE-OUT, not a slicing error: `driftgone` is a ghost dissolving and
    # its last frame is meant to be nothing at all. What is never legitimate is an empty frame with a full
    # one after it — that is a cell boundary in the wrong place, which is exactly what `lantern` had.
    empty = [k for k, b in enumerate(boxes) if not b and any(boxes[j] for j in range(k + 1, len(boxes)))]
    if empty:
        raise SystemExit('  ❌ %s: frame(s) %s are EMPTY at a cell width of %d — the sheet is %dpx wide, so '
                         'the cell is probably %d. A frame with nothing in it means the slicing is wrong.'
                         % (key, empty, fw, sh_.size[0], sh_.size[0] // max(1, len(cols))))
    # ⚠️ AND NO DRIFT CHECK. The obvious second rule — "the subject must not move far between frames" —
    # was tried and is wrong: `drift` is a wisp that genuinely travels 177px up its own cell, which is the
    # entire animation. The interior empty frame is the honest signal and it is the one that caught this.
    w2, h2 = int(fw * scale), int(fh * scale)
    for k in range(len(cols)):
        sub.crop((k * fw, 0, (k + 1) * fw, fh)).resize((w2, h2), Image.NEAREST).save(os.path.join(OUT, 's-%s-%d.png' % (key, k)), optimize=True)
    STATE[key] = [w2, h2, len(cols)]
    print('  s-%s-*.png %dx%d x%d' % (key, w2, h2, len(cols)))


def export_still(key, name, scale=PROP):
    w, h = export_prop(name, 's-%s-0.png' % key, scale=scale)
    STATE[key] = [w, h, 1]
    print('  s-%s-0.png %dx%d' % (key, w, h))


for key, args in (
    ('lamp', ('Street_Lamp_48x48.png', [0, 1, 2, 3], 240, 240, 0, PROP, True)),            # the SAME lamp, lit: four frames of a pulsing halo (240 wide — the halo is the frame)
    ('ghost', ('Ghost_Friendly_48x48.png', list(range(0, 8)), 96, 96, 1)),   # the friendly ghost, floating, facing right (row 1: eight frames a facing)
    ('ghostf', ('Ghost_Friendly_48x48.png', list(range(24, 32)), 96, 96, 1)),  # …facing front
    ('ghost4', ('Ghost_Friendly_48x48.png', list(range(0, 32)), 96, 96, 1)),
    ('ghostform', ('Ghost_Friendly_48x48.png', [0, 1, 2, 3], 96, 96, 0)),   # row 0: the ghost FORMING — played backwards it un-forms: a catch (Trym, 15 Sep)
    ('driftgone', ('Graveyard_Ghosts_2_48x48.png', list(range(9, 17)), 96, 192, 0, PROP, True)),   # the tall grey one flying up and scattering: its catch   # all four facings in one stack for a ROAMER: right 0-7, back 8-15, left 16-23, front 24-31
    ('ghostw', ('Ghost_Friendly_48x48.png', list(range(8, 16)), 96, 96, 2)),   # …waving at you (row 2's "interact")
    ('drift', ('Graveyard_Ghosts_2_48x48.png', list(range(1, 16)), 96, 192, 0, PROP, True)),  # the tall grey one that fades in and out
    ('wisp', ('Graveyard_Ghosts_1_48x48.png', list(range(0, 6)), 96, 96, 0, PROP, True)),     # a small one rising and gone
    ('crow', ('Crow_idle_Down_48x48.png', [0, 1, 2], 96, 96, 0, PROP * 0.55)),   # a pair of birds at a bird's size, not a banana's (Trym, 14 Sep: "crows look too big")
    ('candle', ('Graveyard_Candle_Standing_48x48.png', [0, 1, 2, 3], 48, 144, 0, PROP, True)),
    ('flame', ('Flame_1_48x48.png', [0, 1, 2, 3, 4], 48, 48, 0, PROP * 1.8, True)),   # the pack's low flame, tinted purple in CSS: what a cursed object stands in (Trym, 15 Sep)
    ('spark', ('Flame_2_48x48.png', [0, 1, 2, 3, 4], 48, 48, 0, PROP * 1.4, True)),   # ...and its sparks, in front of it
    ('fountainoff', ('Garden_Fountain_6_Turn_Off_48x48.png', [9], 192, 240)),   # the last frame of the turn-off: dry
    ('rollcafe', ('Kiosk_Coffee_Cup_Shutter_48x48.png', list(range(20)), 192, 96, 0, PROP * 0.8)),   # the cup's shutter coming down; played backwards it rises
    ('rollinfo', ('Kiosk_Information_Shutter_48x48.png', list(range(16)), 144, 96)),
    ('flap', ('Crow_Flap_Left_48x48.png', list(range(6)), 96, 96, 0, PROP * 0.55)),   # the pair taking off
    ('dumpclose', ('Dumpster_empty_48x48.png', [6, 7, 8, 9, 10, 11], 96, 144)),   # the lid coming down over an emptied dumpster
):
    try:
        export_frames(key, *args)
    except Exception as e:
        print('  ! state', key, e)
# 🔦 the lit lamp must sit EXACTLY on the placed one: the frame is the halo's box, the lamp
# body inside it is the static sprite's body. Measure both and record where the frame's
# top-left lands relative to the placed overlay's top-left (dx for the west lamps, dxf for
# the mirrored east ones), so the client can lay the halo over the lamp it already has.
try:
    _st = blockify(load_pack('ME_Singles_City_Props_48x48_Street_Lamp_1.png'), factor=1, colors=28, warm=0.0, sat=1.0, con=1.0)
    _sb = _st.getchannel('A').getbbox()                      # the body inside the trimmed sprite (a 1px margin)
    _fr = Image.open(os.path.join(ANIM, 'Street_Lamp_48x48.png')).convert('RGBA').crop((0, 0, 240, 240))
    _fb = _fr.point(lambda v: 255 if v >= 250 else 0, 'L') if False else Image.eval(_fr.getchannel('A'), lambda v: 255 if v >= 250 else 0).getbbox()   # the opaque body, not the halo
    _bw = _fb[2] - _fb[0]
    _dx = int(round((_sb[0] - _fb[0]) * PROP))
    _dy = int(round((_sb[1] - _fb[1]) * PROP))
    _dxf = int(round(((_st.width - _sb[0] - _bw) - (240 - _fb[2])) * PROP))
    STATE['lamp'] = STATE['lamp'][:3] + [_dx, _dy, _dxf]
    print('  lamp halo offsets dx %d dy %d dxf %d (body %dx%d in frame, %dx%d placed)' % (_dx, _dy, _dxf, _bw, _fb[3] - _fb[1], _sb[2] - _sb[0], _sb[3] - _sb[1]))
except Exception as e:
    print('  ! lamp offsets', e)
# 🍂 THE PARK'S LEAF, GIVEN ITS OWN BOX HERE. The autumn-leaves problem borrowed `trash1`'s
# dimensions and swapped the image over it — a 42×22 leaf stretched into a 19×17 square, which is
# why the leaves have always looked like crumpled foil. It is the park's own art (no second copy of
# the drawing: the file is what the park ships), declared so the town can size it correctly.
try:
    _leaf = Image.open(os.path.join(SITE, 'public', 'assets', 'park', 'l-leaf1.png')).convert('RGBA')
    _leaf.save(os.path.join(OUT, 's-leaf-0.png'), optimize=True)
    STATE['leaf'] = [_leaf.width, _leaf.height, 1]
    print('  s-leaf-0.png %dx%d (the park own leaf)' % _leaf.size)
except Exception as e:
    print('  ! leaf', e)

for key, name, sc in (
    ('shutcafe', 'ME_Singles_City_Props_48x48_Kiosk_Coffee_Cup_Shutter_Closed.png', PROP * 0.8),   # the cup kiosk stands at 0.8, so does its shutter
    ('shutinfo', 'ME_Singles_City_Props_48x48_Kiosk_Infopoint_Shutter_Closed.png', PROP),
    ('binfull', 'ME_Singles_City_Props_48x48_Small_Full_Trash_Can.png', PROP),
    # 🗑️ LITTER HAS TO LOOK LIKE LITTER, and grey on grey cobbles does not. Trym, 20 Sep: "i cant
    # quite seem to understand what these sprites are — they are supposed to be litter, but they dont
    # look like litter, small grey things — maybe we can reuse or find more garbage sprites." He is
    # right and it was two sprites doing it: Small_Trash_Pile_1 is a mound of plain grey-purple lumps
    # that reads as a pile of ROCKS, and Paper_Trash is a 19×17 white-grey ball that on a grey square
    # is nothing at all. The pack has better and there is no reason to have used these — so the heap
    # is now the one with a red can and a blue carton showing in it, and the small pieces are things
    # you can NAME at a glance: a juice carton, a pizza box, a red can, a blue can, a milk carton, a
    # flattened box, a scatter of cans and wrappers. Eight kinds instead of four, none of them grey.
    ('pile', 'ME_Singles_City_Props_48x48_Small_Trash_Pile_2.png', PROP),
    ('trash1', 'ME_Singles_City_Props_48x48_Orange_Juice_Trash.png', PROP),
    ('trash2', 'ME_Singles_City_Props_48x48_Pizza_Trash.png', PROP),
    ('trash3', 'ME_Singles_City_Props_48x48_Blue_Can_Trash.png', PROP),
    ('trash4', 'ME_Singles_City_Props_48x48_Red_Can_Trash.png', PROP),
    ('trash5', 'ME_Singles_City_Props_48x48_Milk_Trash_1.png', PROP),
    ('trash6', 'ME_Singles_City_Props_48x48_Cardboard_Trash_4.png', PROP),
    ('trash7', 'ME_Singles_City_Props_48x48_Trash_4.png', PROP),
    ('graffiti1', 'ME_Singles_Garage_Sales_48x48_Graffiti_1.png', PROP),
    ('graffiti2', 'ME_Singles_Garage_Sales_48x48_Graffiti_2.png', PROP),
    ('cartp', 'ME_Singles_Vehicles_48x48_Fruit_Flowers_Cart_2.png', PROP),   # tomorrow's stall, parked at the bus stop today
    ('dumpfull', 'ME_Singles_City_Props_48x48_Dumpster_5.png', PROP),    # a dumpster open and full of bags
    ('dumpfulls', 'ME_Singles_City_Props_48x48_Dumpster_6.png', PROP),   # …the smeared one, for the works yard
    ('dumpclosed', 'ME_Singles_City_Props_48x48_Dumpster_2.png', PROP),  # closed, smeared: the works-yard dumpster after a fix
    ('bag1', 'ME_Singles_Subway_and_Train_Station_48x48_Plastic_Bag_1.png', PROP),   # what stands beside a full container (Trym, 15 Sep)
    ('bag2', 'ME_Singles_Subway_and_Train_Station_48x48_Plastic_Bag_2.png', PROP),
    ('bag3', 'ME_Singles_Subway_and_Train_Station_48x48_Plastic_Bag_Bottles.png', PROP),
    ('box1', 'ME_Singles_City_Props_48x48_Box_Trash_1.png', PROP),
    # ✉️ THE POST'S TWO ENVELOPES, and they are UI art rather than world art — the mailbox card draws
    # them, nothing in the square does. Exported at 2× (a 24 px envelope becomes 48) because a card row
    # is read at arm's length on a phone, not across a square, and PROP's 0.76 would give 18 px.
    # ⚠️ Letter_2 is the one with the RED WAX SEAL and it means UNREAD; Letter_1 is the plain one and
    # means opened. That is the whole of the state, and it is in the art rather than in a badge.
    ('letterseal', '22_Post_Office_48x48_Letter_2.png', 2.0),
    ('letteropen', '22_Post_Office_48x48_Letter_1.png', 2.0),
):
    try:
        export_still(key, name, sc)
    except Exception as e:
        print('  ! state', key, e)

# ---- the contract ----------------------------------------------------------------
# ---- 🕹 THE ARCADE (Trym, 11 Sep night): The Bunch's door opens on a room. Built the homestead's
# way — Room_Builder floor + wall band at 48-px tiles, the pack's furniture at 1:1, the plate floats
# over a shade in the same world; the contract carries box/spawn/exit/cols/spots.
# The shell — floor, wall band, frame — and the contract are tools/room_builder.py: the arcade,
# the wooden homes and the store are all the same four moves, and were three copies until 19 Sep.
import sys as _sys; _sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # run me from anywhere
import room_builder as RB
MI48 = os.path.expanduser('~/OneDrive/banana-art-pack/moderninteriors-win/1_Interiors/48x48')
RBD = os.path.join(MI48, 'Room_Builder_subfiles_48x48')
BASEMENT = os.path.join(MI48, 'Theme_Sorter_Singles_48x48', '14_Basement_Singles_48x48')
ARCADE = None


if os.path.isdir(RBD) and os.path.isdir(BASEMENT):
    _fl, _wa = RB.sheets(RBD)
    fx, fy = RB.darkest(_fl, 48, 48)      # an arcade is DIM: the darkest low-chroma tile on each sheet
    wx, wy = RB.darkest(_wa, 48, 96)
    print('  arcade floor tile at', (fx, fy), 'wall at', (wx, wy))
    FT, WS = RB.tiles(_fl, _wa, fx, fy, wx, wy)
    # the furniture, at 1:1: (single number, x, base y, collider rect rel. to (x, base) or None, spot key)
    # back wall: five cabinets face the room; side walls: cabinets seen from the side; a counter with
    # the TV and the consoles by the door, two stools at it
    FURN = [
        # the back wall: five cabinets pushed BACK INTO the wall band (Trym, 12 Sep: "further up / back into the
        # wall") — base 172 puts their top half over the wall; the collider runs up to the wall band (y 96) so a
        # banana can never stand between a cabinet and the wall and draw over it
        (218, 24, 172, (0, -76, 48, 0), 'g1'), (219, 88, 172, (0, -76, 48, 0), 'g2'), (218, 152, 172, (0, -76, 48, 0), 'g3'),
        (219, 216, 172, (0, -76, 48, 0), 'g4'), (218, 280, 172, (0, -76, 48, 0), 'g5'),
        # the counter is a PAIR in the pack: 194 = the drinks and the shelf, 195 = the TV and the consoles; one half
        # alone looks sawn off (Trym: "cut in half") — both, edge to edge, against the wall; two bar stools in front
        (194, 366, 172, (0, -76, 96, 0), 'counter'), (195, 462, 172, (0, -76, 96, 0), 'counter'),
        (151, 404, 236, (0, -10, 32, 0), None), (155, 484, 236, (0, -10, 32, 0), None),
        # the side walls: two cabinets seen from the side on each, below the back row so nothing cuts anything
        (221, 16, 330, (0, -40, 64, 0), 'g6'), (221, 16, 402, (0, -40, 64, 0), 'g7'),
        (223, 496, 330, (0, -40, 64, 0), 'g8'), (223, 496, 402, (0, -40, 64, 0), 'g9'),
    ]
    room, RW, RH, rcx = RB.shell(12, 9, FT, WS, (24, 20, 30, 255))
    rcols, rspots = [], []
    for n, x, base, col, key in FURN:
        im_ = RB.single(BASEMENT, n)
        room.alpha_composite(im_, (x, base - im_.height))
        if col:
            rcols.append([x + col[0], base + col[1], x + col[2], base + col[3]])
        if key:
            rspots.append([key, x, base - im_.height, x + im_.width, base])
    room.save(os.path.join(OUT, 'in-arcade.png'), optimize=True)
    AX, AY = 300, 120   # where the plate floats in world coordinates (over the town's north-west)
    ARCADE = RB.contract('in-arcade.png', (AX, AY), RW, RH, rcx, rcols, rspots)
    print('  in-arcade.png %dx%d, %d cols, %d spots' % (RW, RH, len(ARCADE['cols']), len(ARCADE['spots'])))
else:
    print('  ! interiors pack not found — no arcade room')

# ---- 🏪 PIP'S GENERAL STORE (docs/town-jobs-plan.md §4) ------------------------------------
# ⭐ BAKED AT ITS EMPTIEST, on purpose. Every shelf, crate and table in this plate is BARE; the
# stocked faces are sprites the client draws over the named spots, by band. So HOW FULL THE SHOP
# LOOKS IS THE TOWN'S HEALTH, with no new state and no number anywhere on screen — and the restock
# chore has somewhere to land: carry a crate, the bare face fills, the till has that row on it.
#
# ⚠️ TWO TRAPS, both paid for once already:
#   · the grocery singles BAKE THEIR THEME FLOOR into the silhouette (a grey-mauve plinth under
#     the legs) — RB.strip_floor floods it out, the same palette the homestead's decor uses.
#   · a Room_Builder wall segment only tiles cleanly in CERTAIN columns; the capped variants carry
#     a dark edge and the wall band comes out striped every 48 px. The seamless columns are
#     48, 144, 240, 384, 576, 672, 768, 912, 1104, 1200, 1296 and 1440 — measured, not guessed.
#
# The look is a red-and-cream checker floor under a tan brick wall: a village shop in a brick old
# town, not another wooden room. Two alternates were baked and looked at — deep red and gold
# (wall 1440,96) and all wood (floor 0,576 + wall 912,0) — and either is a one-line swap.
GROC = os.path.join(MI48, 'Theme_Sorter_Singles_48x48', '16_Grocery_Store_Singles_48x48')
STORE = None
if os.path.isdir(RBD) and os.path.isdir(GROC):
    # 📦 one spot, one sprite. A stack drawn as two SFURN rows would glow only half of itself when
    # the restock chore lights it, because the invitation lays one copy of one single over one spot.
    # So the two crates are composited into a single piece here, sat on each other with a two-pixel
    # overlap so the lower one's rim reads as carrying the upper.
    def spiece(n):
        if not isinstance(n, tuple):
            return RB.strip_floor(RB.single(GROC, n))
        bot, top = (RB.strip_floor(RB.single(GROC, k)) for k in n)
        bb, tb = bot.getbbox(), top.getbbox()
        dy = bb[1] - tb[3] + 2
        out = Image.new('RGBA', (bot.width, bot.height + max(0, -dy)), (0, 0, 0, 0))
        out.alpha_composite(bot, (0, out.height - bot.height))
        out.alpha_composite(top, (0, out.height - bot.height + dy))
        return out

    STACK = (356, 359)   # the pack's bare wooden crate, with its shallow cousin on top

    # (single, x, base y, collider rel. to (x, base) or None, the spot key stock hangs on)
    SFURN = [
        # the back wall: one flush run of bare shelving, pushed up into the wall band like the
        # arcade's cabinets, so its top half reads as standing against the wall
        (406, 28, 176, (0, -76, 48, 0), 'sh1'), (407, 76, 176, (0, -76, 48, 0), 'sh2'),
        (408, 124, 176, (0, -76, 48, 0), 'sh3'), (406, 172, 176, (0, -76, 48, 0), 'sh4'),
        (407, 220, 176, (0, -76, 48, 0), 'sh5'),
        # the counter, right of the run and against the same wall — Pip stands behind it
        (378, 330, 190, (0, -58, 96, 0), 'till'), (379, 426, 190, (0, -58, 48, 0), None),
        # the floor: a crate stack at each side wall with a bare market table beside it, leaving a
        # clear aisle from the door straight up to the counter (the doorway is the bottom middle)
        #
        # ⚠️ A CRATE IS A CRATE AND A SHELF IS A SHELF — singles 201 and 205 stood here first, chosen
        # off their numbers as "crate stacks", and they are nothing of the sort: they are the pack's
        # tall BAKERY RACKS, two bare beige boards in a dark frame. Trym, 20 Sep: "theres two sprites
        # in the store of something thats supposed to be shelves, but the sprites are cut in half —
        # not sure the sprites are shelves either, looks like cut half couches." He is right twice
        # over: the thing reads as furniture sliced through the middle, and a second run of shelving
        # on the floor made the shop's one real shelf run mean nothing. A crate stack has to be
        # crates, so it is now the pack's own wooden crate with a shallow one set on top of it.
        (STACK, 18, 336, (8, -34, 88, 0), 'cr1'), (421, 120, 336, (0, -46, 96, 0), 'tbl1'),
        (426, 312, 344, (0, -56, 96, 0), 'tbl2'), (STACK, 414, 336, (8, -34, 88, 0), 'cr2'),
    ]
    _sfl, _swa = RB.sheets(RBD)
    SFT, SWS = RB.tiles(_sfl, _swa, 384, 96, 576, 96)
    sroom, SW, SH_, scx = RB.shell(11, 8, SFT, SWS, (58, 40, 30, 255))
    scols, sspots = [], []
    for n, x, base, col, key in SFURN:
        im_ = spiece(n)
        sroom.alpha_composite(im_, (x, base - im_.height))
        if col:
            scols.append([x + col[0], base + col[1], x + col[2], base + col[3]])
        if key:
            sspots.append([key, x, base - im_.height, x + im_.width, base])
    # 🧺 THE STOCKED FACES. The pack carries the very same units WITH GOODS ON THEM — 403/404/405 are
    # 406/407/408 filled, 423 is 421 filled, 428 is 426 filled — so a full shop is the same shop, not a
    # different one. They export as ordinary town state sprites and the client lays them over the bare
    # plate, one per thing on Pip's shelf today. That is docs/town-jobs-plan.md §4 exactly: HOW FULL THE
    # SHOP LOOKS IS THE TOWN'S HEALTH, with no new state and no number anywhere on screen.
    # ⚠️ 1:1, never PROP-scaled: the room's plate is baked at the pack's own 48 px and so is everything on it.
    SFULL = [('sh1', 403, 28, 176), ('sh2', 404, 76, 176), ('sh3', 405, 124, 176),
             ('sh4', 403, 172, 176), ('sh5', 404, 220, 176),
             ('tbl1', 423, 120, 336), ('tbl2', 428, 312, 344)]
    sfull = []
    for skey, n, x, base in SFULL:
        im_ = spiece(n)
        fk = 'full' + skey
        im_.save(os.path.join(OUT, 's-%s-0.png' % fk), optimize=True)
        STATE[fk] = [im_.width, im_.height, 1]
        sfull.append([skey, fk, x + im_.width // 2, base])   # the client adds the plate's own origin
    # ✨ THE INVITATION. A baked plate cannot glow, so every piece the restock chore touches is
    # exported a SECOND time as a state sprite that lands exactly over its own painted self — same
    # single, same pixel, nothing moved — and the room glows THAT. The trick the shutters and the full
    # bins have always used; here it lets the chore explain itself with no words at all: the crate
    # stacks glow while your hands are empty, and the bare face glows while you are carrying one.
    SOVER = ['cr1', 'cr2', 'sh1', 'sh2', 'sh3', 'sh4', 'sh5', 'tbl1', 'tbl2']
    sover = {}
    for n, x, base, col, key in SFURN:
        if key not in SOVER:
            continue
        im_ = spiece(n)
        ok_ = 'over' + key
        im_.save(os.path.join(OUT, 's-%s-0.png' % ok_), optimize=True)
        STATE[ok_] = [im_.width, im_.height, 1]
        sover[key] = [ok_, x + im_.width // 2, base]
    # 📦 the crate a restocking banana carries: the pack's own wooden crate of goods, exported as a
    # state sprite so the room can hang it on the player while they walk it to a bare shelf.
    _cr = RB.strip_floor(RB.single(GROC, 357))
    _cr.save(os.path.join(OUT, 's-crate-0.png'), optimize=True)
    STATE['crate'] = [_cr.width, _cr.height, 1]
    sroom.save(os.path.join(OUT, 'in-store.png'), optimize=True)
    SX, SY = 300, 620   # the plate floats over the town's west, clear of the arcade's
    STORE = RB.contract('in-store.png', (SX, SY), SW, SH_, scx, scols, sspots)
    STORE['full'] = [[k, fk, SX + cx, SY + b] for k, fk, cx, b in sfull]   # spot key, sprite key, centre x, foot y
    STORE['over'] = {k: [ok_, SX + cx, SY + b] for k, (ok_, cx, b) in sover.items()}   # spot key → a glowable copy of the plate's own piece
    print('  in-store.png %dx%d, %d cols, %d spots' % (SW, SH_, len(STORE['cols']), len(STORE['spots'])))
else:
    print('  ! interiors pack not found — no store room')


# ---- 🚧 THE PLAYER'S OWN LOCK: a worksite hoarding (docs/town-jobs-plan.md §1) --------------
# ⭐ TWO LOCKS, AND THEY MUST NOT LOOK ALIKE. The TOWN's lock is the yellow-black hazard belt, the
# dark front and the red CLOSED sign: the square is having a bad day and hands will fix it. YOUR
# lock is this — a red worksite fence across the front and a signpost to tap: the building is not
# built for you yet, and the STORY opens it. A player must never have to read a card to tell which
# one they are looking at, so nothing here borrows a colour or a shape from the tape.
#
# ⚠️ THE FENCE FAMILY IS A TRIPLE, not a pool of interchangeable middles: `_1` is the left end,
# `_2` the middle, `_3` the right end. Treating them as a pool leaves post-shaped gaps wherever two
# ends land side by side — which is exactly what the first composition did.
#
# One still per front, baked at that front's EXACT drawn width so it can never be a stretched
# fence: the store is 183 world px, the café 158, the post office 293. Composed at the pack's own
# 48-px scale and brought down by PROP, the same as every other prop on the plate.
WORKSITE = os.path.expanduser('~/OneDrive/banana-art-pack/Modern_Exteriors_48x48/ME_Theme_Sorter_48x48/8_Worksite_Singles_48x48')
# key → (family, the one dressing prop beside it). ⚠️ `condo` IS NEVER HERE: five shipped games
# must answer on a stranger's worst day, and the post office's mail never stops once it is open.
# tools/check-design.mjs greps for that rather than trusting this comment.
HOARD_FRONTS = [('store', 1, 'Stacked_Material_1'), ('cafe', 2, 'Cone_2'), ('post', 1, 'Stacked_Material_6')]
HOARD = {}
if os.path.isdir(WORKSITE):
    def _ws(n):
        return Image.open(os.path.join(WORKSITE, 'ME_Singles_Worksite_48x48_%s.png' % n)).convert('RGBA')

    def _fence(native_w, fam):
        cv = Image.new('RGBA', (native_w, 96), (0, 0, 0, 0))
        mid = _ws('Fence_%d_2' % fam)
        x = 0
        while x < native_w:
            cv.alpha_composite(mid.crop((0, 0, min(48, native_w - x), 96)), (x, 0))
            x += 48
        cv.alpha_composite(_ws('Fence_%d_1' % fam), (0, 0))
        cv.alpha_composite(_ws('Fence_%d_3' % fam), (native_w - 48, 0))
        return cv

    for key, fam, dress in HOARD_FRONTS:
        ov = next((o for o in OVERLAYS if len(o) > 6 and o[6] == key), None)
        if not ov:
            print('  ! no overlay for', key)
            continue
        ox, oy, ow, oh = ov[1], ov[2], ov[3], ov[4]
        native = max(96, int(round(ow / PROP)))
        im_ = blockify(_fence(native, fam), factor=1, colors=28, warm=0.0, sat=1.0, con=1.0)
        im_ = im_.resize((ow, max(1, int(round(96 * PROP)))), Image.NEAREST)
        fk = 'hoard' + key
        im_.save(os.path.join(OUT, 's-%s-0.png' % fk), optimize=True)
        STATE[fk] = [im_.width, im_.height, 1]
        HOARD[key] = {'art': fk, 'cx': ox + ow // 2, 'base': oy + oh}
    # the signpost is ONE sprite shared by every hoarded front — it is the tap target, and the plan
    # asks for no name plank over a locked door, so this is the only thing that speaks there
    sg = blockify(_ws('Sign_2'), factor=1, colors=28, warm=0.0, sat=1.0, con=1.0)
    sg = sg.resize((int(round(48 * PROP)), int(round(144 * PROP))), Image.NEAREST)
    sg.save(os.path.join(OUT, 's-hoardsign-0.png'), optimize=True)
    STATE['hoardsign'] = [sg.width, sg.height, 1]
    print('  hoardings: %s + s-hoardsign-0.png' % ', '.join('s-hoard%s-0.png %dx%d' % (k, STATE['hoard' + k][0], STATE['hoard' + k][1]) for k in HOARD))
else:
    print('  ! worksite art not found — no hoardings')

L = ['// GENERATED by tools/build-town-scene.py — DO NOT EDIT.',
     '// Every collider here was declared on the place() call that drew its prop.',
     'export const WORLD = { w: %d, h: %d };' % (W, H),
     'export const BOUND = %d;' % BOUND,
     'export const SPAWN = { x: %d, y: %d };' % SPAWN,
     'export const DOORS = { south: { x: %d, y: %d } };' % (1100, H - 30),
     'export const STREETS = %s;' % [list(s) for s in STREETS],
     'export const FOUNTAIN = %s;' % list(FOUNTAIN),
     'export const ANIMS = %s;' % [list(a) for a in ANIMS],
     'export const STATE = %s;' % __import__('json').dumps(STATE),
     "// 🚧 the player's own lock: a worksite hoarding per front the story opens, plus the signpost that says how far along you are",
     'export const HOARD = %s;' % __import__('json').dumps(HOARD),
     'export const ARCADE = %s;' % __import__('json').dumps(ARCADE),
     "// 🏪 the general store, baked at its emptiest — stock is drawn over these spots by band",
     "// 🛋️ where a banana can sit down, and which way it looks when it does — [key, x, foot, 'l'|'r']",
     'export const SEATS = %s;' % __import__('json').dumps(SEATS),
     'export const STORE = %s;' % __import__('json').dumps(STORE),
     "// ☕ the Coffee Cup's serving window: [centre x, the floor its feet stand on, the pack's own barista's height],",
     "// measured as the DIFFERENCE between the pack's empty kiosk and the pack's kiosk-with-a-barista, after the very",
     "// same blockify and scale the prop itself went through. A banana at work stands here, and the kiosk draws over it.",
     'export const CAFE_WIN = %s;' % list(CAFE_WIN),
     'export const INFO_WIN = %s;' % list(INFO_WIN),
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
layers = [(y + h, Image.open(os.path.join(OUT, fn)).convert('RGBA'), (x, y)) for fn, x, y, w, h, base, _k in OVERLAYS]
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
