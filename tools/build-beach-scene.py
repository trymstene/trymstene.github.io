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
  public/assets/beach/volleyball.png  8-frame spin strip (28px frames)
  public/assets/beach/a-crab.png      10-frame walk strip (96px frames)
  public/assets/beach/shells.png      29-frame collection strip
⚠️ GEOMETRY IS A CONTRACT with src/scripts/banana-beach.js — see GEO below.
Run: python tools/build-beach-scene.py
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
OUT = os.path.join(SITE, 'public', 'assets', 'beach')
os.makedirs(OUT, exist_ok=True)
rng = random.Random(1999)

T = 48                       # the pack's tile — our world unit now
W, H = 2400, 1100
# ---- GEO: the contract with banana-beach.js -------------------------------
WATER_BOT = 260              # sea above this
SHORE_BOT = 306              # shoreline band ends (walkable wet sand below)
# ⚠️ COURT must stay a whole number of T tiles (now 10 × 10) — the line tiles
# are laid on a grid and a partial tile crops a corner piece in half.
# Two rules set these numbers, both from Trym's field read (22 Jul):
#   · WIDTH: the side lines have to run UNDER the net poles. The net is 528
#     wide and its posts sit ~26px inside each end, so a 480-wide court centred
#     on the same axis puts each 12px line right beneath a pole.
#   · HEIGHT: balance the court around the NET AS DRAWN, not around its ground
#     line. The mesh rises 132px above the posts' feet, so measuring from
#     NET_BASE left a sliver above the net and a field below it — "theres more
#     space in the court on the downside, than the upside". Top line moved up
#     so the gaps above the mesh and below the feet match.
COURT = (690, 532, 1170, 1012)
NET_BASE = 844                   # y where the net's posts meet the sand
NET_MIDS = 7                     # mesh tiles between the two post pieces

# ---- 🧭 GAMEPLAY LINES: tuned, not derived from the art -------------------
# Everything in this block plus every collider below is EMITTED into
# src/scripts/beach-geo.js at the end of the build. banana-beach.js imports
# that and holds no hand-copied coordinates of its own — see emit_geo().
WATER_LINE = 292      # bananas can't swim past this (the art's shore is 306)
PLATFORM_BOT = 308    # you may stand on the pier's platform down to here
PIER_MOUTH = (1890, 348)   # land↔pier routes via this waypoint
BONFIRE = (560, 640, 80)   # the ring's walk collider (tuned; the art is an
                           # ellipse, but a circle is what feels right here)
BAR_NOTICE = 104      # how close you get before the Captain greets you
NET_SOLID_H = 10      # half-thickness of the net's WALK collider. The banana
                      # covers at most 8.4px per step (SPEED 168 × the 0.05s
                      # dt cap), so 20px total can never be tunnelled through.

# ---- collider shapes, in coordinates LOCAL to a place()'s (cx, base) ------
# Top-down blocking is the BASE of an object, never its full height: you walk
# BEHIND a palm's crown and a lighthouse's tower.
TRUNK = ('rect', -13, -36, 13, 0)          # a palm's trunk
POLE = ('circle', 13)                      # a parasol's pole
WRECK = ('rect', -120, -102, 122, 8)       # Captain Split's hull
TOWER = ('rect', -58, -84, 60, 8)          # the lighthouse's base
SUNBED = ('chair', -34, -48, 36, 6, -4)    # rect + where you sit
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

    # ⚠️ THE SHORE TILE IS (1,3), UNFLIPPED. It is the blob's bottom edge:
    # water, a light foam rim, then sand — seamless when tiled, and exactly the
    # transition LimeZu's own screenshots show. I had been FLIPPING tile (1,0),
    # which is a sand-water-SAND tile, so flipping it produced a hard line
    # against the deep water and a pale band with no rim on the sand side.
    # ⚠️ The sheet is 72 cols = FOUR ANIMATION FRAMES of 18 columns (verified by
    # diffing tile 0,0 against tile 18,0). frame(f) offsets by f * 18.
    FRAMES, FCOLS = 4, 18

    def frame_tile(c, r, f):
        return seatile(c + f * FCOLS, r)

    SAND_T = seatile(5, 1)
    WATER_T = frame_tile(1, 1, 0)
    SHORE_T = frame_tile(1, 3, 0)
    # ⚠️ EXACTLY ONE shore row. The old condition (`SHORE_T if y < SHORE_BOT`)
    # made every row from 240 to 336 a shore tile, so TWO stacked shore tiles
    # drew two sand edges with water between them — Trym: "doubled sand-edge
    # with water in the middle, its a mess". A tile row is 48px; pick the row.
    SHORE_ROW_Y = 240
    for r in range(0, H // T + 1):
        for c in range(0, W // T + 1):
            y = r * T
            t = WATER_T if y < SHORE_ROW_Y else (SHORE_T if y == SHORE_ROW_Y else SAND_T)
            im.alpha_composite(t, (c * T, y))
    # (no seam-dither needed: the shore tile's water and the open-water tile
    # come from the SAME animation frame, so they match exactly. The line that
    # used to be here was the colour grade's y-cutoff, now fixed above.)
else:
    rect(0, 0, W, WATER_BOT, (63, 160, 189))
    rect(0, WATER_BOT, W, H, (236, 217, 168))

# a warm golden-hour grade over the whole map — the sunset survives as LIGHT,
# not as a literal sky (there is no sky in a top-down world)
# Trym: the sand went "deep and red" — the pack's sand is a saturated orange
# and my warm grade pushed it further. Blend the ground toward a BRIGHT cream
# (our own sand colour) and leave the water alone but lift it slightly.
# ⚠️ Grade by PIXEL COLOUR, never by y position. The first version keyed off
# `y > WATER_BOT - 30`, so it creamed the WATER for 30px above the shore and
# left a hard light-blue line where the grade switched on — the exact line
# Trym kept seeing. Sand is red-dominant, water is blue-dominant; test that.
SAND_TARGET = (252, 234, 190)


def grade(p, w, h):
    for y in range(h):
        for x in range(w):
            r, g, b, a = p[x, y]
            if not a:
                continue
            if r > b + 18:                       # sandy → lift toward cream
                k = 0.42
                r = int(r * (1 - k) + SAND_TARGET[0] * k)
                g = int(g * (1 - k) + SAND_TARGET[1] * k)
                b = int(b * (1 - k) + SAND_TARGET[2] * k)
            else:                                # watery → a small warm lift
                r = min(255, int(r * 1.04)); g = min(255, int(g * 1.03))
            p[x, y] = (min(255, r), min(255, g), min(255, b), a)


grade(px, W, H)

# glitter scattered on the open water (no sun disc — nothing to reflect in a
# top-down view; it's just sparkle on the swell)
for _ in range(700):
    x, y = rng.randrange(0, W), rng.randrange(6, WATER_BOT - 14)
    for i in range(rng.randrange(2, 6)):
        put(x + i, y, SPARK)

# ---- animation strips: pull a row out of a pack sheet and re-emit it as a
# horizontal strip we can step through in CSS (same trick as the rave's poof)
ANIM = os.path.join(PACK, 'Animated_48x48', 'Animated_sheets_48x48')


def anim_find(name):
    for dp, _, fns in os.walk(ANIM):
        if name in fns:
            return os.path.join(dp, name)
    return None


def anim_strip(name, out_name, row=0, frames=None, tw=T, th=T, scale=1.0,
               dekey=None, colors=10, warm=0.08):
    """extract `frames` tiles from `row` of a pack sheet → our-style strip.
    dekey = a background colour to knock out (the water sprites are baked on
    an opaque water square, which we don't want over our own sea)."""
    p = anim_find(name)
    if not p:
        print('  MISSING', name)
        return 0
    sh = Image.open(p).convert('RGBA')
    n = frames or (sh.width // tw)
    raw = Image.new('RGBA', (tw * n, th), (0, 0, 0, 0))
    for i in range(n):
        cell = sh.crop((i * tw, row * th, (i + 1) * tw, (row + 1) * th))
        if dekey is not None:
            cp = cell.load()
            for y in range(cell.height):
                for x in range(cell.width):
                    r, g, b, a = cp[x, y]
                    if a and abs(r - dekey[0]) < 26 and abs(g - dekey[1]) < 26 and abs(b - dekey[2]) < 26:
                        cp[x, y] = (0, 0, 0, 0)
        raw.alpha_composite(cell, (i * tw, 0))
    # ⚠️ Blockify the WHOLE STRIP, once, with trim=False. Two rules an
    # animation strip must obey, both of which I broke:
    #   1. never trim a frame to its own bbox — a walk cycle's silhouette
    #      changes every frame, so re-centring each one makes the sprite creep
    #      around inside its own element while the element walks (exactly the
    #      "sliding to the left" Trym saw on the crabs);
    #   2. never outline frames individually — the 1px pad would shove every
    #      frame off the grid. Outline the strip and crop the pad back off, so
    #      each frame stays EXACTLY tw wide.
    out = blockify(raw, factor=1, colors=colors, warm=warm, sat=1.1, con=1.05,
                   trim=False).crop((1, 1, 1 + tw * n, 1 + th))
    out.save(os.path.join(OUT, out_name), optimize=True)
    print('  %s -> %s (%d frames)' % (name[:38], out_name, n))
    return n


# ---- the object layer: pack art at NATIVE scale ---------------------------
_cache = {}
PLACED = []                  # every prop's footprint, for audit_court()
COLLIDERS = []               # (name, shape, cx, base) — emitted by emit_geo()
NET_SPRITE = []              # [x, y, w, h] of net.png in world coords




# Props render at 76% of the pack's native size: at 1:1 the pack's own
# character scale made our banana look like a doll among the furniture, and the
# banana is the star of this site (Trym: "everything is huge, the banana is
# very tiny"). Slightly heroic proportions beat technically-correct ones.
PROP = 0.76


def place(name, cx, base, factor=1, colors=10, warm=0.08, sat=1.1, con=1.05,
          flip=False, shade=True, sh=0.30, scale=PROP, solid=None):
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
    # ⚠️ THE COLLIDER IS DECLARED HERE, ON THE PLACEMENT. It used to live in a
    # hand-kept list in banana-beach.js, and it drifted the moment a prop
    # moved: shifting the parasols for the bigger court left one invisible
    # pole standing ON the volleyball court and another where no umbrella had
    # been for two commits. A collider that isn't attached to its prop is a
    # bug waiting for the next nudge.
    if solid:
        COLLIDERS.append((name, solid, int(cx), int(base)))
    return s.size


def net_span():
    """the net's x extent — posts included, which is WIDER than the court"""
    cx0, _, cx1, _ = COURT
    w = 96 + NET_MIDS * T + 96
    x0 = (cx0 + cx1) // 2 - w // 2
    return x0, x0 + w


def emit_geo():
    """🔧 CODEGEN: write src/scripts/beach-geo.js — the ONE source of the
    beach's collision geometry. banana-beach.js imports this and keeps no
    hand-copied coordinates, so a prop and its collider can no longer drift
    apart. Same treatment the worker allowlists got (task #64)."""
    def short(n):
        return n.split('_48x48_')[-1].replace('.png', '').replace('_', ' ').lower()

    rects, circles, chairs = [], [], []
    bw0, bw1, by0, by1 = BOARDWALK
    rects.append(([bw0, by0, bw1, by1], 'the boardwalk deck'))
    for name, shape, cx, base in COLLIDERS:
        if shape[0] == 'rect':
            rects.append(([cx + shape[1], base + shape[2],
                           cx + shape[3], base + shape[4]], short(name)))
        elif shape[0] == 'circle':
            circles.append(([cx, base, shape[1]], short(name)))
        elif shape[0] == 'chair':
            chairs.append(([cx + shape[1], base + shape[2],
                            cx + shape[3], base + shape[4]],
                           [cx, base + shape[5]], short(name)))
    nx0, nx1 = net_span()
    rects.append(([nx0, NET_BASE - NET_SOLID_H, nx1, NET_BASE + NET_SOLID_H],
                  'THE NET — solid; you go AROUND the poles'))
    circles.append((list(BONFIRE), 'the bonfire ring'))

    def rows(items):
        return '\n'.join('  [%s],%s' % (', '.join(str(v) for v in it[0]),
                                        '   // ' + it[1] if it[1] else '')
                         for it in items)
    px0, px1, py0, py1 = PIER
    out = '''// ⚠️⚠️ GENERATED FILE — DO NOT EDIT BY HAND. ⚠️⚠️
// Written by tools/build-beach-scene.py. Re-run it after moving anything:
//     python tools/build-beach-scene.py
//
// WHY THIS EXISTS: these numbers used to be hand-copied into
// banana-beach.js beside a "keep in sync" comment, and they drifted the
// first time a prop moved — shifting the parasols for the bigger volleyball
// court left one invisible pole standing ON the court and another where no
// umbrella had been for two commits. Colliders are now declared on the
// place() call that draws the prop, so the art and the collision are one
// edit. Top-down blocking is always the BASE of an object, never its full
// height: you walk BEHIND a palm's crown and a lighthouse's tower.
export const WORLD = { w: %d, h: %d };
export const WATER_Y = %d;               // bananas famously can't swim
export const PIER = { x0: %d, x1: %d, y0: %d };
export const PLATFORM = { x0: %d, x1: %d, y0: %d, y1: %d };
export const PIER_MOUTH = { x: %d, y: %d };
export const COURT = { x0: %d, y0: %d, x1: %d, y1: %d };
// NET.y is the line the net STANDS on — what you collide with and what the
// ball must clear. sprite* is where net.png is drawn: it rises ~138px ABOVE
// that line, which is why the page must depth-sort against it.
export const NET = { y: %d, x0: %d, x1: %d,
  spriteX: %d, spriteY: %d, spriteW: %d, spriteH: %d };
export const BAR = { x: %d, y: %d, r: %d };

export const OB_RECTS = [
%s
];

export const OB_CIRCLES = [
%s
];

export const CHAIRS = [
%s
];
''' % (W, H, WATER_LINE,
       px0, px1, py0,
       px0, px1, py0, PLATFORM_BOT,
       PIER_MOUTH[0], PIER_MOUTH[1],
       COURT[0], COURT[1], COURT[2], COURT[3],
       NET_BASE, nx0, nx1,
       NET_SPRITE[0], NET_SPRITE[1], NET_SPRITE[2], NET_SPRITE[3],
       BAR[0], BAR[1] + 140, BAR_NOTICE,
       rows(rects), rows(circles),
       '\n'.join('  { rect: [%s], seat: { x: %d, y: %d } },   // %s'
                 % (', '.join(str(v) for v in c[0]), c[1][0], c[1][1], c[2])
                 for c in chairs))
    p = os.path.join(SITE, 'src', 'scripts', 'beach-geo.js')
    with open(p, 'w', encoding='utf-8') as f:
        f.write(out)
    print('  wrote src/scripts/beach-geo.js (%d rects, %d circles, %d chairs)'
          % (len(rects), len(circles), len(chairs)))


def audit_court():
    """⚠️ Nothing may sit on the volleyball court — neither art NOR collision.
    A sandcastle and a parasol once landed on the boundary lines and read as
    broken art; separately an invisible parasol POLE was left standing on the
    court after its umbrella moved, which you could walk into mid-rally. The
    second one is worse, because there's nothing to see. Check both, every
    build, instead of eyeballing screenshots."""
    cx0, cy0, cx1, cy1 = COURT
    hits = 0
    for name, (x0, y0, x1, y1) in PLACED:
        if x0 < cx1 and x1 > cx0 and y0 < cy1 and y1 > cy0:
            print('  ⚠️  ART ON THE COURT: %s at %s' % (name, (x0, y0, x1, y1)))
            hits += 1
    for name, shape, cx, base in COLLIDERS:
        if shape[0] == 'circle':
            near = (max(cx0, min(cx, cx1)), max(cy0, min(base, cy1)))
            on = math.hypot(cx - near[0], base - near[1]) < shape[1]
        else:
            x0, y0 = cx + shape[1], base + shape[2]
            x1, y1 = cx + shape[3], base + shape[4]
            on = x0 < cx1 and x1 > cx0 and y0 < cy1 and y1 > cy0
        if on:
            print('  ⚠️  COLLIDER ON THE COURT: %s at (%d, %d)' % (name, cx, base))
            hits += 1
    if hits:
        print('  ⚠️  %d obstruction(s) on the court — move them or the rally '
              'breaks on something invisible.' % hits)


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
                         (1330, 1040, True), (2010, 900, False), (600, 528, True),
                         (2290, 640, False)):
        place('21_Beach_48x48_Palm_Tree.png', cx, base, flip=fl, sh=0.26, solid=TRUNK)
    for cx, base in ((430, 372), (900, 366), (1600, 380), (2120, 372), (660, 362)):
        place('21_Beach_48x48_Big_Sprout_Vers_1.png', cx, base, shade=False)

    # 🏐 the volleyball court, built from the pack's own pieces.
    # ⚠️ The net runs HORIZONTALLY (Left post + Middle × n + Right post) — I
    # first stacked the modular pieces vertically and got a chain-link tower.
    # ⚠️ The pack's field lines are RED-ORANGE by design — that is not a bug,
    # it's exactly what LimeZu's own beach screenshot shows.
    cx0, cy0, cx1, cy1 = COURT
    LN = '21_Beach_48x48_Beach_Volley_Field_Line_%s.png'
    NT = '21_Beach_48x48_Beach_Volley_Net_%s.png'

    # THE LINES — a plain corner/edge tile set on a TOP-LEFT grid. My earlier
    # attempt bottom-anchored them, which stepped every tile by its own sprite
    # height and made the boundary zig-zag like a fence. They only ever wanted
    # to be laid on the grid.  No ink outline: these are ground markings, and
    # outlining thin cream lines turns the whole court black.
    cols, rows = (cx1 - cx0) // T, (cy1 - cy0) // T
    court = Image.new('RGBA', (cols * T, rows * T), (0, 0, 0, 0))
    for r in range(rows):
        for c in range(cols):
            if r == 0:
                n = 'Left_Up' if c == 0 else 'Right_Up' if c == cols - 1 else 'Middle_Up_Modular'
            elif r == rows - 1:
                n = 'Left_Down' if c == 0 else 'Right_Down' if c == cols - 1 else 'Middle_Down_Modular'
            elif c == 0:
                n = 'Left_Middle_Modular'
            elif c == cols - 1:
                n = 'Middle_Right_Modular'
            else:
                continue
            court.alpha_composite(load_pack(LN % n), (c * T, r * T))
    im.alpha_composite(blockify(court, factor=1, colors=8, warm=0.06,
                                sat=1.1, con=1.05, outline=False, trim=False),
                       (cx0, cy0))

    # THE NET — the pack's own three pieces, TOP-ALIGNED on the same grid.
    #   Net_Left  (2 tiles wide): post in its LEFT tile, mesh in its RIGHT
    #   Net_Middle_Modular (1 tile): mesh
    #   Net_Right (2 tiles wide): mesh in its LEFT tile, post in its RIGHT
    # All three carry their mesh band at the SAME sprite y (6..63), so sharing
    # a TOP edge lines them up perfectly. Bottom-anchoring them — a 144px post
    # sprite against a 96px mesh sprite — is what hung those floating net
    # squares beside the real net and made me give up and draw it by hand.
    # ⚠️ Composed at native size and blockified ONCE: outlining each tile
    # separately would ink a vertical bar down every seam in the mesh.
    net = Image.new('RGBA', (96 + NET_MIDS * T + 96, 144), (0, 0, 0, 0))
    net.alpha_composite(load_pack(NT % 'Left'), (0, 0))
    for i in range(NET_MIDS):
        net.alpha_composite(load_pack(NT % 'Middle_Modular'), (96 + i * T, 0))
    net.alpha_composite(load_pack(NT % 'Right'), (96 + NET_MIDS * T, 0))
    net = blockify(net, factor=1, colors=12, warm=0.06, sat=1.12, con=1.06,
                   trim=False)
    # no contact shadow here: the pack draws the posts' own cast shadows into
    # the sprites, and an ellipse under the net just reads as a dirty smudge.
    NET_LEFT_X = (cx0 + cx1) // 2 - (96 + NET_MIDS * T + 96) // 2
    im.alpha_composite(net, (NET_LEFT_X - 1, NET_BASE - 138 - 1))
    # ⚠️ AND AGAIN AS ITS OWN LAYER. The net is a WALL standing on the sand at
    # NET_BASE, drawn rising UP the screen — its mesh sits ~75px above the line
    # you actually collide with. Baked into the plate it can only ever draw
    # BEHIND the banana, so you appear to walk straight through the net and
    # then stop dead at nothing (Trym drew exactly that line on a screenshot).
    # The page re-draws this sprite on its own layer and flips the banana in
    # front of / behind it by comparing feet to NET_BASE, which is what makes
    # a top-down wall read as a wall. Kept in the plate too, so the scene is
    # still correct with no JS — the overlay lands on identical pixels.
    net.save(os.path.join(OUT, 'net.png'), optimize=True)
    NET_SPRITE.extend([NET_LEFT_X - 1, NET_BASE - 138 - 1, net.width, net.height])

    # 🚢 Captain Split's wreck
    place('21_Beach_48x48_Ship_Bar.png', BAR[0], BAR[1] + 120, colors=12, sh=0.34,
          solid=WRECK)
    for i, sx in enumerate((BAR[0] - 150, BAR[0] - 50, BAR[0] + 50, BAR[0] + 150)):
        place('21_Beach_48x48_Ship_Bar_Chair_%d.png' % (1 + i % 2), sx, BAR[1] + 200)

    # 🗼 the lighthouse — factor 2, or it would eat half the map
    place('21_Beach_48x48_Example_Lighthouse.png', LIGHT[0], LIGHT[1] + 300,
          factor=2, colors=12, sh=0.24, solid=TOWER)

    # ⛱ furniture
    place('21_Beach_48x48_Yellow_Beach_Umbrella_Opened.png', 1265, 548, solid=POLE)
    place('21_Beach_48x48_Blue_Beach_Umbrella_Opened.png', 430, 1020, solid=POLE)
    place('21_Beach_48x48_Green_Beach_Umbrella_Opened.png', 2050, 560, solid=POLE)
    for i, (x0, y0) in enumerate(((1240, 640), (1330, 700), (400, 760))):
        place('ME_Singles_Swimming_Pool_48x48_Sunbed_%d.png' % (1 + i * 4), x0, y0,
              solid=SUNBED)
    place('21_Beach_48x48_Blue_Beach_Towel_1.png', 1450, 780, shade=False)
    place('21_Beach_48x48_Multicolor_Beach_Towel_1.png', 520, 1074, shade=False)
    place('21_Beach_48x48_Yellow_Beach_Towel_2.png', 1900, 800, shade=False)
    place('21_Beach_48x48_Red_Float.png', 2240, 380)
    place('21_Beach_48x48_Green_Float.png', 300, 1020)
    for cx, base in ((1600, 900), (860, 1080), (2130, 1020)):
        place('21_Beach_48x48_Small_Red_Bucket_1.png', cx, base)
    place('21_Beach_48x48_Sand_Castle_1_Vers_1.png', 1420, 1070)  # off the court
    place('21_Beach_48x48_Sand_Castle_2_Vers_1.png', 1780, 1010)
    for cx, base in ((480, 330), (1120, 336), (1750, 330), (2260, 334)):
        place('21_Beach_48x48_Yellow_Big_Starfish.png', cx, base, shade=False)
    for cx, base in ((820, 334), (1400, 330)):
        place('21_Beach_48x48_Purple_Small_Starfish.png', cx, base, shade=False)
    for cx, base in ((150, 200), (1300, 170), (2350, 230), (600, 120)):
        place('21_Beach_48x48_Medium_Sea_Rock_1_Vers_1.png', cx, base, shade=False)
    audit_court()
    emit_geo()

    # 🛟 THE PIER — it used to be a featureless brown slab and read as a
    # mystery object ("what's this brown thing at the beach?"). Now it has
    # cross planks, dark rails down both sides, and posts standing in the
    # water, so it reads as a jetty from above.
    px0, px1, py0, py1 = PIER
    for y in range(py0, py1):
        for x in range(px0, px1):
            board = (y // 11) % 2 == 0
            put(x, y, (176, 122, 62) if board else (158, 106, 50))
        if (y % 11) == 0:                              # the gap between boards
            rect(px0, y, px1, y + 2, (116, 72, 32))
    rect(px0, py0, px0 + 7, py1, (108, 66, 28))        # rails
    rect(px1 - 7, py0, px1, py1, (108, 66, 28))
    rect(px0 + 7, py0, px0 + 10, py1, (196, 142, 78))  # lit inner edge
    for py in range(py0 + 14, py1 - 10, 46):           # posts, both sides
        for side in (px0 + 1, px1 - 12):
            rect(side, py, side + 11, py + 13, (86, 52, 22))
            rect(side, py, side + 4, py + 13, (128, 82, 38))
    rect(px0 - 6, py1 - 8, px1 + 6, py1, (108, 66, 28))  # the landing kerb

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

# ---- ANIMATED PROPS: the pack animates far more than I'd been using -------
# The water sprites are baked onto an opaque water square, so their background
# is knocked out (dekey) before they're laid over our own sea.
if HAVE_PACK:
    print('animation strips:')
    WATER_KEY = (86, 178, 199)
    # ⚠️ NOT every animated sheet is one tile per frame. The crab sheet is
    # 960×192 = 10 frames of NINETY-SIX px (2 tiles) × 4 rows. Slicing it at 48
    # cut every crab in half and put the halves in neighbouring frames, so the
    # thing appeared to slide sideways as it played. Check the sheet's real
    # frame width (bbox the candidate grids) before adding any new strip.
    anim_strip('Crabs_48x48.png', 'a-crab.png', row=0, frames=10, tw=96)
    anim_strip('Beach_Seagull_Idle_Left_48x48.png', 'a-gull.png', row=0, frames=6)
    anim_strip('Buoy_1_48x48.png', 'a-buoy.png', frames=8, dekey=WATER_KEY)
    anim_strip('Floating_Separation_Buoys_1_48x48.png', 'a-ropebuoy.png',
               frames=8, dekey=WATER_KEY)
    anim_strip('Beach_Floating_Rock_1_48x48.png', 'a-rock.png', frames=8, dekey=WATER_KEY)
    anim_strip('Floating_Ball_1_48x48.png', 'a-floatball.png', frames=6, dekey=WATER_KEY)

im = im.convert('RGB')
im.save(os.path.join(OUT, 'beach.png'), optimize=True)
print('wrote beach.png (%dx%d) %.0f KB' % (W, H,
      os.path.getsize(os.path.join(OUT, 'beach.png')) / 1024.0))

# ============================================================================
# 🌊 THE REAL ANIMATED WATER: the pack's own 4 frames, baked into 4 tileable
# column strips (48 wide x the whole water+shore band). The page stacks them
# and steps their opacity — the established flip-book pattern in this codebase.
SEA_BAND = 288                      # water rows 0..240 + the ONE shore row
if HAVE_PACK:
    for f in range(4):
        strip_f = Image.new('RGBA', (T, SEA_BAND), (0, 0, 0, 0))
        for y in range(0, SEA_BAND, T):
            t = frame_tile(1, 3, f) if y == 240 else frame_tile(1, 1, f)
            strip_f.alpha_composite(t, (0, y))
        # the SAME colour-keyed grade as the plate, so the animated layer can
        # never seam against the baked art underneath it
        grade(strip_f.load(), T, SEA_BAND)
        strip_f.save(os.path.join(OUT, 'sea-f%d.png' % f), optimize=True)
    print('wrote sea-f0..3.png (the pack\'s own water animation)')

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

# ---- 🏐 THE VOLLEYBALL: an 8-frame SPIN strip -----------------------------
# The pack has a lovely beach ball (ME_Singles_Camping_48x48_Ball_1) but NO
# spin animation, and rotating it is a dead end: it's drawn as a squashed
# ellipse, so turning it makes the silhouette wobble, and its fine interior
# detail turns to speckle once quantised down to 28px. A ball that never
# spins reads as a dead prop, so instead we take the pack's PALETTE (sampled
# straight off that sprite) and draw the panels ourselves — crisp wedges that
# rotate cleanly, in the pack's own colours so it still belongs to the set.
# ⚠️ Same strip discipline as anim_strip(): lay the frames out at working
# resolution, blockify the WHOLE strip ONCE (one shared quantised palette,
# no per-frame outline pad), then crop the pad so frames stay exactly BALL_D
# apart. See the frame-stepping note in beach.astro for why that matters.
BALL_D, BALL_S, BALL_N = 28, 8, 8
B_RED, B_WHT, B_BLU = (203, 42, 42), (235, 228, 242), (66, 128, 221)
BALL_PANELS = [B_RED, B_WHT, B_BLU, B_WHT, B_RED, B_BLU]


def ball_frame(a0):
    n = BALL_D * BALL_S
    f = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(f)
    box = (2, 2, n - 3, n - 3)
    step = 360.0 / len(BALL_PANELS)
    for i, c in enumerate(BALL_PANELS):
        d.pieslice(box, a0 + i * step, a0 + (i + 1) * step, fill=c + (255,))
    r = n // 2
    sh = Image.new('RGBA', (n, n), (0, 0, 0, 0))          # light from upper-left
    ImageDraw.Draw(sh).ellipse((r * 0.5, r * 0.5, n - 3, n - 3), fill=(38, 26, 66, 74))
    f.alpha_composite(sh)
    hl = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    ImageDraw.Draw(hl).ellipse((r * 0.36, r * 0.28, r * 0.72, r * 0.60), fill=(255, 255, 255, 80))
    f.alpha_composite(hl)
    m = Image.new('L', (n, n), 0)                          # a CONSTANT circle:
    ImageDraw.Draw(m).ellipse(box, fill=255)               # only the pattern turns
    f.putalpha(Image.composite(f.getchannel('A'), Image.new('L', (n, n), 0), m))
    return f


_bn = BALL_D * BALL_S
_braw = Image.new('RGBA', (_bn * BALL_N, _bn), (0, 0, 0, 0))
for i in range(BALL_N):
    _braw.alpha_composite(ball_frame(-360.0 * i / BALL_N), (i * _bn, 0))
ball = blockify(_braw, factor=BALL_S, colors=10, alpha_thresh=0.45, sat=1.2,
                con=1.08, trim=False).crop((1, 1, 1 + BALL_D * BALL_N, 1 + BALL_D))
ball.save(os.path.join(OUT, 'volleyball.png'), optimize=True)
print('wrote volleyball.png (%d spin frames, %dpx)' % (BALL_N, BALL_D))
RED, RED_D = (216, 60, 56), (168, 38, 36)

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
