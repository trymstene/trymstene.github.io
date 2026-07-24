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
# extended right (was 2400) to give the pier bazaar room for two rows of
# stalls + wagons + walking space (Trym: "extend the pier more to the right").
# Extending RIGHT is safe: nothing shifts, we just add sand on the far side.
W, H = 2760, 1100
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
BONFIRE = (215, 655, 48)   # the ring's walk collider (tuned; the art is an
                           # ellipse, but a circle is what feels right here).
                           # 24 Jul: moved AGAIN — up above the welcome arch, on
                           # its own, because the old nook was a mess: a palm
                           # grew straight through the ring and the chairs faced
                           # nowhere. Nothing else is placed inside this circle.
                           # ⚠️ r48, NOT the old 74: with chairs pulled up close,
                           # a 74 circle reached PAST them and wedged the banana
                           # against an invisible wall when walking between the
                           # two lower seats. Keep this near the stone ring's own
                           # size (rx62 × ry40) or the seating becomes unusable.
BAR_NOTICE = 104      # how close you get before the Captain greets you
NET_SOLID_H = 10      # half-thickness of the net's WALK collider. The banana
                      # covers at most 8.4px per step (SPEED 168 × the 0.05s
                      # dt cap), so 20px total can never be tunnelled through.
# The mesh band's rows inside the net sprite (verified by bboxing it): the
# pack hangs the mesh from the top of the poles with a real GAP beneath, just
# like a actual volleyball net. Emitted as heights above the base line so the
# ball's physics can use the net that's actually DRAWN — it used to need only
# z > 18 to "clear" a 133px net, which is why shots sailed straight through
# the mesh and still counted.
NET_MESH_ROWS = (6, 63)

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
# the lighthouse stands on the open shore above the volleyball court. It USED
# to sit at the bottom-left entrance, but the WELCOME ARCH greets you there now
# (built in banana-beach.js), so the lighthouse moved to a clean stretch of
# coast where it reads as a scenic landmark instead of fighting the arch.
LIGHT = (1050, 120)
# 🎡 THE PIER BAZAAR — a big WALKABLE wooden deck on the far right, opposite
# the bottom-left entrance. ⚠️ NOT a collider any more: you walk ON it, among
# two rows of stalls and food/fruit wagons, with clear aisles (Trym: "space
# between the rows… so bananas can walk around freely with a sense of space").
# Each stall/wagon is its own collider; the deck itself is open floor.
BOARDWALK = (1980, 2720, 330, 1012)

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
               dekey=None, colors=10, warm=0.08, keytol=26, outline=True):
    """extract `frames` tiles from `row` of a pack sheet → our-style strip.
    dekey = a background colour to knock out (the water sprites are baked on
    an opaque water square, which we don't want over our own sea).
    ⚠️ keytol matters: the FISH sheets are drawn ENTIRELY in shades of their own
    water — every fish colour sits within ~19 of the background — so the default
    26 erases the fish along with the sea. They need keytol≈8.
    outline=False for the fish too: an ink line round a shadow under the surface
    reads as a sticker, not a shadow."""
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
                    if a and abs(r - dekey[0]) < keytol and abs(g - dekey[1]) < keytol and abs(b - dekey[2]) < keytol:
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
                   trim=False, outline=outline)
    # _outline() pads the strip by 1px; crop it back so every frame stays
    # EXACTLY tw wide. With outline=False there is no pad to crop.
    if outline:
        out = out.crop((1, 1, 1 + tw * n, 1 + th))
    out.save(os.path.join(OUT, out_name), optimize=True)
    print('  %s -> %s (%d frames)' % (name[:38], out_name, n))
    return n


# ---- 🎡 THE MIDWAY STALLS -------------------------------------------------
# ⚠️ DRAWN, and for once that is NOT a retreat — the pack simply has no midway.
# Checked before deciding (scratchpad stall_sheet.py): its "Market_Big" sprites
# are two-storey CITY SHOPFRONTS (brick, upper floors, doors) that would read as
# a high street dropped on a beach, and the Kiosk_*_Shutter files are mid-shutter
# animation frames. Only the camping tents come close. A stall is a canopy, two
# posts, a counter and a sign — pure geometry, which generates cleanly and makes
# Trym's plan literal: ONE stall, a HUE per pitch, the sign hung in the DOM.
STALL_W, STALL_H = 156, 132
STALL_HUES = [(206, 62, 58), (44, 150, 152), (146, 92, 190), (232, 150, 44)]


def build_stall(hue):
    """draw at 3× and blockify down — the same road every other prop takes,
    which buys our chunk and the 1px ink outline for free"""
    K = 3
    w, h = STALL_W * K, STALL_H * K
    s = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(s)
    cream = (246, 236, 208)
    # the dark of the booth, so the canopy reads as shelter OVER something
    d.rectangle([13 * K, 40 * K, w - 14 * K, h - 24 * K], fill=(62, 46, 40))
    for sy in (56, 76):                       # shelves of unseen prizes
        d.rectangle([21 * K, sy * K, w - 22 * K, (sy + 7) * K], fill=(98, 74, 54))
    for pxl in (9, STALL_W - 18):             # posts, lit from the upper left
        d.rectangle([pxl * K, 34 * K, (pxl + 9) * K, h - 6 * K], fill=(150, 104, 58))
        d.rectangle([pxl * K, 34 * K, (pxl + 3) * K, h - 6 * K], fill=(190, 144, 88))
    # ⭐ the canopy: stripes + a SCALLOPED hem. The scallop is the thing that
    # says fairground — a straight-edged awning reads as a bus shelter.
    for x in range(2 * K, w - 2 * K):
        col = hue if (((x // K) // 13) % 2 == 0) else cream
        hem = 34 + 7 * math.sin(math.pi * (((x // K) - 2) % 26) / 26.0)
        for y in range(6 * K, int(hem * K)):
            s.putpixel((x, y), col + (255,))
        for y in range(max(6 * K, int(hem * K) - 2 * K), int(hem * K)):
            s.putpixel((x, y), (int(col[0] * 0.72), int(col[1] * 0.72), int(col[2] * 0.72), 255))
    # ⚠️ NO desk here — the desk is a SEPARATE sprite (build_desk) drawn on its
    # own layer IN FRONT of the vendor banana, so the vendor reads as standing
    # BEHIND it. Baked into this back sprite it would sit behind the vendor.
    return blockify(s, factor=K, colors=14, alpha_thresh=0.4, sat=1.08, con=1.05,
                    warm=0.05, trim=False)


def build_desk():
    """🪵 the vendor's desk — a standalone wooden counter, drawn ABOVE the
    vendor banana so it overlaps their lower body (they stand behind it), like
    the banana stand keeper's desk. One sprite, reused by every stall (the
    hue only lives in the canopy)."""
    K = 3
    dw, dh = (STALL_W + 8), 48
    s = Image.new('RGBA', (dw * K, dh * K), (0, 0, 0, 0))
    d = ImageDraw.Draw(s)
    d.rectangle([0, 0, dw * K, dh * K], fill=(162, 114, 62))              # body
    d.rectangle([0, 0, dw * K, 7 * K], fill=(210, 162, 100))            # lit top
    d.rectangle([0, (dh - 7) * K, dw * K, dh * K], fill=(112, 74, 42))   # shadow foot
    for pxl in range(14, dw - 10, 24):                                   # plank seams
        d.rectangle([pxl * K, 10 * K, (pxl + 1) * K, (dh - 8) * K], fill=(132, 90, 50))
    return blockify(s, factor=K, colors=10, alpha_thresh=0.4, sat=1.06,
                    con=1.05, warm=0.05, trim=False)


def build_grabber():
    """🕹 THE GRABBER — the midway's one landmark, at the seaward end of the
    pier so reaching it is a small pilgrimage. Glass cabinet, prizes you can
    SEE before you can afford them (the whole reason it beat a lottery), and a
    claw parked over them."""
    K = 3
    w, h = 92 * K, 150 * K
    s = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(s)
    BODY, LIT, DRK = (208, 66, 72), (238, 118, 120), (150, 38, 48)
    d.rectangle([0, 22 * K, w, h - 4 * K], fill=BODY)          # cabinet
    d.rectangle([0, 22 * K, 6 * K, h - 4 * K], fill=LIT)
    d.rectangle([w - 7 * K, 22 * K, w, h - 4 * K], fill=DRK)
    d.rectangle([0, h - 16 * K, w, h - 4 * K], fill=DRK)       # plinth
    d.rectangle([2 * K, 4 * K, w - 3 * K, 22 * K], fill=(252, 206, 70))   # marquee
    d.rectangle([2 * K, 4 * K, w - 3 * K, 9 * K], fill=(255, 232, 138))
    # the glass, and the prizes behind it
    d.rectangle([8 * K, 30 * K, w - 9 * K, h - 22 * K], fill=(58, 84, 104))
    for i, (px_, py_, c) in enumerate([
            (16, 108, (250, 206, 62)), (40, 116, (232, 96, 96)),
            (62, 106, (120, 190, 232)), (28, 96, (168, 128, 220)),
            (52, 92, (250, 206, 62))]):
        d.ellipse([px_ * K, py_ * K, (px_ + 16) * K, (py_ + 14) * K], fill=c)
    d.rectangle([8 * K, 30 * K, w - 9 * K, 40 * K], fill=(96, 130, 152))  # glare
    # the claw, parked
    d.rectangle([44 * K, 34 * K, 48 * K, 58 * K], fill=(198, 198, 206))
    for dx in (-10, 6):
        d.polygon([((46 + dx) * K, 58 * K), ((46 + dx + 4) * K, 58 * K),
                   ((46 + dx + (0 if dx < 0 else 4)) * K, 72 * K)], fill=(170, 170, 182))
    return blockify(s, factor=K, colors=14, alpha_thresh=0.4, sat=1.1, con=1.06,
                    warm=0.04, trim=False)


# ---- the object layer: pack art at NATIVE scale ---------------------------
_cache = {}
PLACED = []                  # every prop's footprint, for audit_court()
COLLIDERS = []               # (name, shape, cx, base) — emitted by emit_geo()
NET_SPRITE = []              # [x, y, w, h] of net.png in world coords
OVERLAYS = []                # (file, x, y, w, h, base) — y-sorted prop layer
UMBRELLAS = []               # clickable parasols — open/closed, NOT baked
BEACON = []                  # [x, y] of the lighthouse lamp — the page pulses it
PIER_SPRITE = []             # [x, y, w, h] of pier.png — a floor above the sea
STALLS = []                  # (cx, base) of each midway stall, emitted for the page
GRABBER = []                 # [cx, base] of the claw machine on the pier




# Props render at 76% of the pack's native size: at 1:1 the pack's own
# character scale made our banana look like a doll among the furniture, and the
# banana is the star of this site (Trym: "everything is huge, the banana is
# very tiny"). Slightly heroic proportions beat technically-correct ones.
PROP = 0.76


def sand_tint(im, lo=(170, 140, 94), hi=(228, 208, 162), ink=(112, 84, 52)):
    """🏰 RECOLOUR ONTO A SAND RAMP.
    ⚠️ The pack draws its sandcastles bright ORANGE — measured main colour
    (225,109,50) against our pale cream sand (250,226,170): about 120 short on
    BOTH green and blue. Desaturating cannot fix that (sat 0.62 still lands on
    (183,121,90), just muddier) because the SOURCE is orange, not over-saturated.
    So we remap LUMINANCE onto a beige ramp: identical shading, sand colour.
    ⚠️ The OUTLINE is recoloured too, to a dark warm brown — NOT left as the
    pack's near-black ink (Trym: "the outline can be a bit darker than that
    again, not black outline"). Black reads as a sticker cut out of the beach;
    a brown a couple of stops below the body reads as wet, packed sand."""
    im = im.copy()
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if not a:
                continue
            lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
            if lum < 0.20:                      # the ink line → dark sand-brown
                px[x, y] = (ink[0], ink[1], ink[2], a)
                continue
            t = (lum - 0.20) / 0.80
            t = 0.0 if t < 0 else (1.0 if t > 1 else t)
            px[x, y] = (int(lo[0] + (hi[0] - lo[0]) * t),
                        int(lo[1] + (hi[1] - lo[1]) * t),
                        int(lo[2] + (hi[2] - lo[2]) * t), a)
    return im


def place(name, cx, base, factor=1, colors=10, warm=0.08, sat=1.1, con=1.05,
          flip=False, shade=True, sh=0.30, scale=PROP, solid=None, layer=False,
          tint=None):
    key = (name, factor, colors, warm, sat, con)
    if key not in _cache:
        _cache[key] = blockify(load_pack(name), factor=factor, colors=colors,
                               warm=warm, sat=sat, con=con)
    s = _cache[key]
    # ⚠️ tint AFTER the cache and on a COPY — mutating in place would poison the
    # cached sprite for every later placement of the same file.
    if tint:
        s = tint(s)
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
    # ⭐ layer=True ALSO exports the sprite for the page to redraw on a
    # y-sorted layer. A prop baked only into the plate can never draw in front
    # of anything, so you walked over palm crowns and through the lighthouse.
    # Its BASE is what sorts — you pass in front of a trunk's roots and behind
    # its canopy, which is the whole point. (Same fix as the net, generalised.)
    if layer:
        fn = 'ov-%d.png' % len(OVERLAYS)
        s.save(os.path.join(OUT, fn), optimize=True)
        OVERLAYS.append((fn, box[0], box[1], s.width, s.height, int(base)))
    # ⚠️ THE COLLIDER IS DECLARED HERE, ON THE PLACEMENT. It used to live in a
    # hand-kept list in banana-beach.js, and it drifted the moment a prop
    # moved: shifting the parasols for the bigger court left one invisible
    # pole standing ON the volleyball court and another where no umbrella had
    # been for two commits. A collider that isn't attached to its prop is a
    # bug waiting for the next nudge.
    if solid:
        COLLIDERS.append((name, solid, int(cx), int(base)))
    return s.size


def umbrella(color, cx, base):
    """🏖 A CLICKABLE parasol. Unlike place(), it does NOT composite into the
    plate — a baked-in open umbrella would show THROUGH when the page folds it
    shut — and it bakes NO contact shadow, because its ground shadow is a DOM
    element the page fades in/out with the open/closed state. It just exports
    an OPEN and a CLOSED sprite and records geometry + a pole collider.
    The pole sits at each sprite's bottom-centre, so the page anchors both
    states there and the folded one stands on the same spot."""
    def prep(state):
        name = '21_Beach_48x48_%s_Beach_Umbrella_%s.png' % (color.capitalize(), state)
        s = blockify(load_pack(name), factor=1, colors=10, warm=0.08, sat=1.1, con=1.05)
        return s.resize((max(1, int(s.width * PROP)), max(1, int(s.height * PROP))),
                        Image.NEAREST)
    op, cl = prep('Opened'), prep('Closed')
    fn_o, fn_c = 'umb-%s-open.png' % color, 'umb-%s-closed.png' % color
    op.save(os.path.join(OUT, fn_o), optimize=True)
    cl.save(os.path.join(OUT, fn_c), optimize=True)
    x, y = int(cx - op.width // 2), int(base - op.height)
    COLLIDERS.append(('%s parasol pole' % color, POLE, int(cx), int(base)))
    UMBRELLAS.append((color, fn_o, fn_c, x, y, op.width, op.height,
                      cl.width, cl.height, int(base)))


def net_span():
    """the net's x extent — posts included, which is WIDER than the court"""
    cx0, _, cx1, _ = COURT
    w = 96 + NET_MIDS * T + 96
    x0 = (cx0 + cx1) // 2 - w // 2
    return x0, x0 + w


# ⛏ THE DIG SITES — mirrored from banana-beach.js DIG_SITES so we can AUDIT
# them. A patch is a z-index:2 overlay drawn OVER the plate, so any prop baked
# into the plate underneath it gets covered — which reads backwards (the sand
# patch is part of the beach; the towel lying on it should be on top).
# ⚠️ An earlier in-browser check compared patches only against DOM overlays and
# so missed every BAKED prop — exactly the ones that show the fault.
DIG_SITES = [(1330, 900), (340, 870), (560, 700), (620, 966), (1244, 662),
             (1430, 640), (1620, 950), (902, 1066), (1150, 1066)]
PATCH_W, PATCH_H = 156, 104


def audit_digs():
    """warn when a dig patch lands on top of a prop's footprint"""
    hits = 0
    for (dx, dy) in DIG_SITES:
        px0, py0 = dx - PATCH_W // 2, dy - PATCH_H // 2
        px1, py1 = dx + PATCH_W // 2, dy + PATCH_H // 2
        for name, box in PLACED:
            bx0, by0, bx1, by1 = box
            if bx0 < px1 and bx1 > px0 and by0 < py1 and by1 > py0:
                ov = (min(px1, bx1) - max(px0, bx0)) * (min(py1, by1) - max(py0, by0))
                if ov > 900:                       # ignore a few stray pixels
                    print('  ⚠️  DIG PATCH (%d,%d) covers %s  (%d px overlap)'
                          % (dx, dy, name.split('_48x48_')[-1].replace('.png', ''), ov))
                    hits += 1
    print('  dig-patch audit: %d prop conflict(s)' % hits)


def emit_geo():
    """🔧 CODEGEN: write src/scripts/beach-geo.js — the ONE source of the
    beach's collision geometry. banana-beach.js imports this and keeps no
    hand-copied coordinates, so a prop and its collider can no longer drift
    apart. Same treatment the worker allowlists got (task #64)."""
    def short(n):
        return n.split('_48x48_')[-1].replace('.png', '').replace('_', ' ').lower()

    rects, circles, chairs = [], [], []
    # ⚠️ the pier deck is NOT emitted as a collider — it's WALKABLE now. Only
    # the stalls and wagons on it block (via COLLIDERS below).
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
// NET.y is the line the net STANDS on — what you collide with. sprite* is
// where net.png is drawn: it rises ~138px ABOVE that line, which is why the
// page must depth-sort against it.
// topZ / gapZ are the MESH band's height above the base line. The ball must
// clear topZ; below gapZ it passes under the net through the gap the art
// actually shows; in between it hits the mesh.
export const NET = { y: %d, x0: %d, x1: %d,
  spriteX: %d, spriteY: %d, spriteW: %d, spriteH: %d,
  topZ: %d, gapZ: %d };
export const BAR = { x: %d, y: %d, r: %d };
// 🔥 the fire circle's centre — the page stands an animated flame here and
// pools warm light around it. Its walk collider is in OB_CIRCLES as usual.
export const BONFIRE = { x: %d, y: %d };

export const OB_RECTS = [
%s
];

export const OB_CIRCLES = [
%s
];

export const CHAIRS = [
%s
];

// ⭐ Y-SORTED PROP LAYER. Each of these is ALSO baked into the plate; the page
// redraws it on top and sorts it against everything that walks by comparing
// `base` (the prop's ground line) to the walker's y. That's what lets you pass
// in FRONT of a palm's roots and BEHIND its canopy. A prop baked only into the
// plate can never draw in front of anything.
export const OVERLAYS = [
%s
];

// ⛱ CLICKABLE PARASOLS. NOT baked into the plate (a baked open one would show
// through a folded one), NO baked shadow (the page fades a DOM shadow with the
// state). Both sprites share a bottom-centre pole, so the page anchors there;
// `w/h` size the OPEN box, `cw/ch` the folded sprite drawn at the same scale.
export const UMBRELLAS = [
%s
];

// the dock: drawn ABOVE the animated sea but BELOW anything that walks, because
// a floor must never occlude someone standing on it.
export const PIER_SPRITE = { x: %d, y: %d, w: %d, h: %d };

// 🎡 the midway. Each entry is where a stall's COUNTER is — the page hangs a
// sign above it and opens that stall's view when you tap it.
export const STALLS = [
%s
];

// 🕹 the claw machine at the seaward end of the pier — the midway's one
// landmark and the only place tickets buy the grand prize.
export const GRABBER = { x: %d, y: %d };
''' % (W, H, WATER_LINE,
       px0, px1, py0,
       px0, px1, py0, PLATFORM_BOT,
       PIER_MOUTH[0], PIER_MOUTH[1],
       COURT[0], COURT[1], COURT[2], COURT[3],
       NET_BASE, nx0, nx1,
       NET_SPRITE[0], NET_SPRITE[1], NET_SPRITE[2], NET_SPRITE[3],
       NET_BASE - (NET_SPRITE[1] + NET_MESH_ROWS[0]),
       NET_BASE - (NET_SPRITE[1] + NET_MESH_ROWS[1]),
       BAR[0], BAR[1] + 140, BAR_NOTICE,
       BONFIRE[0], BONFIRE[1],
       rows(rects), rows(circles),
       '\n'.join('  { rect: [%s], seat: { x: %d, y: %d } },   // %s'
                 % (', '.join(str(v) for v in c[0]), c[1][0], c[1][1], c[2])
                 for c in chairs),
       '\n'.join("  { src: '%s', x: %d, y: %d, w: %d, h: %d, base: %d },"
                 % o for o in OVERLAYS),
       '\n'.join(("  { color: '%s', open: '%s', closed: '%s', x: %d, y: %d,"
                  " w: %d, h: %d, cw: %d, ch: %d, base: %d },") % u
                 for u in UMBRELLAS),
       PIER_SPRITE[0], PIER_SPRITE[1], PIER_SPRITE[2], PIER_SPRITE[3],
       '\n'.join('  { x: %d, y: %d },' % s for s in STALLS),
       GRABBER[0], GRABBER[1])
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

    # 🌴 PALMS — 24 Jul: placed in symmetric PAIRS that frame the three shore
    # sun-stations, plus a couple of lower accents. A resort skyline, not a
    # scatter. (Flip alternates so a pair leans away from its station's centre.)
    for cx, base, fl in ((170, 500, False), (600, 508, True),      # frame left station
                         (720, 506, False), (1118, 506, True),     # frame centre station
                         (1236, 500, False), (1560, 508, True),    # frame right station
                         (470, 1082, False), (1480, 1060, True)):  # lower accents
        place('21_Beach_48x48_Palm_Tree.png', cx, base, flip=fl, sh=0.26, solid=TRUNK,
              layer=True)
    # 🌿 BUSHES fringing the pier bazaar — a little green spilling over the seam
    # where the wooden deck meets the sand, softening that hard edge (Trym's ask).
    for cx, base in ((1966, 402), (1972, 524), (1960, 660), (1972, 800),
                     (1964, 940), (2160, 1006), (2420, 1010), (2660, 1006)):
        place('21_Beach_48x48_Big_Sprout_Vers_1.png', cx, base, shade=False, layer=True)

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
          solid=WRECK, layer=True)
    for i, sx in enumerate((BAR[0] - 150, BAR[0] - 50, BAR[0] + 50, BAR[0] + 150)):
        place('21_Beach_48x48_Ship_Bar_Chair_%d.png' % (1 + i % 2), sx, BAR[1] + 200)

    # (🗼 the lighthouse was removed 24 Jul — Trym: "its in the way". Its beacon
    #  glow and the BEACON export went with it.)

    # ⛱ furniture
    # ⛱ CLICKABLE parasols — open/close on tap, ground shadow toggles with them.
    # Exported as sprites (NOT baked), rendered + made interactive by the page.
    # ─── ⛱ THE TANNING ROW: three sun-stations facing the sea ────────────────
    # Each station = a parasol (folds on tap) + a pair of loungers + a towel,
    # sat under the framing palms above. Left / centre / right along the shore.
    umbrella('green', 360, 452)
    umbrella('yellow', 918, 452)
    umbrella('blue', 1398, 458)
    for i, (x0, y0) in enumerate(((250, 486), (470, 486),      # left station beds
                                  (810, 486), (1026, 486),     # centre station beds
                                  (1288, 492), (1508, 492))):  # right station beds
        place('ME_Singles_Swimming_Pool_48x48_Sunbed_%d.png' % (1 + (i % 3) * 4),
              x0, y0, solid=SUNBED)
    place('21_Beach_48x48_Multicolor_Beach_Towel_1.png', 360, 516, shade=False)
    place('21_Beach_48x48_Blue_Beach_Towel_1.png', 918, 516, shade=False)
    place('21_Beach_48x48_Yellow_Beach_Towel_2.png', 1398, 522, shade=False)

    # ─── 🪣 THE WATERLINE: toys at the wet sand, floats + rocks IN the sea ────
    # ⚠️ Anything IN the water (y<288) must be layer=True — the animated sea
    # overlay is opaque and paints over the baked plate, so a baked float there
    # is invisible in-game. Overlays sit ABOVE the sea and show.
    for cx, base in ((700, 322), (1150, 320), (1520, 322)):
        place('21_Beach_48x48_Small_Red_Bucket_1.png', cx, base, shade=False, layer=True)
    # 🏰 tinted to OUR sand — the pack's castles are orange (see sand_tint)
    place('21_Beach_48x48_Sand_Castle_1_Vers_1.png', 840, 336, shade=False,
          layer=True, tint=sand_tint)
    place('21_Beach_48x48_Sand_Castle_2_Vers_1.png', 1300, 340, shade=False,
          layer=True, tint=sand_tint)
    place('21_Beach_48x48_Red_Float.png', 520, 208, shade=False, layer=True)     # in the sea
    place('21_Beach_48x48_Green_Float.png', 1120, 182, shade=False, layer=True)  # in the sea
    for cx, base in ((300, 236), (1360, 176), (2360, 214), (780, 150)):
        place('21_Beach_48x48_Medium_Sea_Rock_1_Vers_1.png', cx, base, shade=False, layer=True)
    for cx, base in ((470, 330), (1600, 332)):
        place('21_Beach_48x48_Yellow_Big_Starfish.png', cx, base, shade=False)
    place('21_Beach_48x48_Purple_Small_Starfish.png', 1000, 334, shade=False)

    # 🎣 FOUR FISHING CHAIRS on the dock — two rows of two, each pair facing
    # OUT over its own side of the water so the lines never cross. Sit to cast.
    # ⚠️ seats + bobbers are hard-matched in banana-beach.js FISH_SPOTS — move
    # one, move both. Kept in the DEEP half of the dock (y<240) so every bobber
    # lands in open water rather than in the shore foam.
    for cy in (132, 212):
        place('21_Beach_48x48_Ship_Bar_Chair_1.png', 1836, cy, layer=True)
        place('21_Beach_48x48_Ship_Bar_Chair_2.png', 1944, cy, flip=True, layer=True)

    # ─── 🔥 THE FIRE CIRCLE, above the welcome arch ──────────────────────────
    # FOUR chairs, two a side, all TURNED IN (the right pair is flipped) so the
    # ring reads as somewhere people sit together of an evening. Nothing is
    # placed inside the circle — the old nook failed because a palm grew through
    # it. Vegetation and a blanket sit OUTSIDE the seating, framing it.
    # ⚠️ NOT Ship_Bar_Chair — that sprite is a little orange CRATE, which is why
    # the first pass read as four boxes. Camping Chair_9..14 are SIDE-VIEW
    # chairs (backrest one side, seat the other), so unflipped they seat someone
    # facing RIGHT. Left of the fire they go as-is, right of it they flip — so
    # all four sitters look INTO the flames. Four different colours, on purpose.
    fx, fy = BONFIRE[0], BONFIRE[1]
    for cy, lch, rch in ((fy - 22, 'Chair_9', 'Chair_12'),
                         (fy + 48, 'Chair_11', 'Chair_10')):
        place('ME_Singles_Camping_48x48_%s.png' % lch, fx - 88, cy, layer=True)
        place('ME_Singles_Camping_48x48_%s.png' % rch, fx + 88, cy, flip=True, layer=True)
    place('21_Beach_48x48_Grey_Beach_Towel_1.png', fx + 4, fy + 112, shade=False)
    place('21_Beach_48x48_Small_Red_Bucket_1.png', fx - 96, fy + 96, shade=False, layer=True)
    for vx, vy in ((fx - 128, fy + 40), (fx + 132, fy - 44), (fx + 20, fy - 84)):
        place('21_Beach_48x48_Big_Sprout_Vers_1.png', vx, vy, shade=False, layer=True)

    # 🎡 THE PIER BAZAAR — a WALKABLE deck (BOARDWALK isn't a collider now). Two
    # rows of game stalls with a wide central aisle, food/fruit WAGONS between
    # them, and café tables so it reads as a market you wander through. Each
    # stall and wagon is its own collider; the aisles stay clear.
    def midway_overlay(spr, cx, base, sh=0.34, solid=None, zbase=None):
        box = (int(cx - spr.width // 2), int(base - spr.height))
        if sh > 0:
            shadow(cx, base - 4, spr.width * sh, 9, 52)
        im.alpha_composite(spr, box)
        fn = 'ov-%d.png' % len(OVERLAYS)
        spr.save(os.path.join(OUT, fn), optimize=True)
        # zbase overrides the y-sort key — the desk uses base+3 so it lands
        # ABOVE the vendor canvas (which the page draws at z = stall base + 1).
        OVERLAYS.append((fn, box[0], box[1], spr.width, spr.height,
                         int(zbase if zbase is not None else base)))
        PLACED.append(('midway', (box[0], box[1], box[0] + spr.width, int(base))))
        if solid:                     # walkable deck → props must block
            COLLIDERS.append(('midway', solid, int(cx), int(base)))

    # 🎮 four game stalls in TWO ROWS, aisle between. You stand just below a
    # counter (on the walkable deck) to play.
    STALL_POS = [(2140, 500), (2430, 500),      # top row
                 (2140, 940), (2430, 940)]      # bottom row
    desk = build_desk()
    for (cx, base), hue in zip(STALL_POS, STALL_HUES):
        st = build_stall(hue)
        midway_overlay(st, cx, base, solid=('rect', -46, -22, 46, 6))
        STALLS.append((cx, base))
        # the desk, drawn OVER the vendor (zbase = base+3 > the vendor's base+1)
        midway_overlay(desk, cx, base + 4, sh=0, zbase=base + 3)

    # 🕹 the grabber — the grand-prize claw at the deck's FAR (right) end, the
    # destination you walk the pier toward.
    gr = build_grabber()
    GRABBER.extend([2648, 700])
    midway_overlay(gr, GRABBER[0], GRABBER[1], sh=0.36, solid=('rect', -40, -28, 40, 4))

    # 🍎🌭 the pack's food & fruit WAGONS, between the rows and along the aisle.
    for name, cx, base, sc in (
            ('Fruit_Flowers_Cart_2', 2290, 466, 0.82),
            ('Fruit_Flowers_Cart_3', 2610, 486, 0.82),
            ('Street_Food_Cart_5', 2290, 910, 0.92),     # burger + chef
            ('Street_Food_Cart_2', 2020, 726, 0.92),     # a wok stall
            ('Fruit_Flowers_Cart_2', 2560, 930, 0.72)):
        place('ME_Singles_Vehicles_48x48_%s.png' % name, cx, base, colors=28,
              sh=0.3, solid=('rect', -44, -24, 44, 0), layer=True, scale=sc)
    # café tables + a chair down the aisle, so the walking space isn't barren
    for name, cx, base in (('Street_Food_Table_2', 2360, 690),
                           ('Street_Food_Table_4', 2500, 728),
                           ('Street_Food_Chair_1', 2318, 704)):
        place('ME_Singles_Vehicles_48x48_%s.png' % name, cx, base, colors=20,
              sh=0.22, solid=('circle', 13), layer=True, scale=0.82)
    print('  wrote the PIER BAZAAR (2 rows x %d stalls + grabber + wagons)'
          % (len(STALL_POS) // 2))

    audit_court()
    audit_digs()

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
    # ⚠️ THE DOCK HAS TO OUTRANK THE SEA. The animated water layers are OPAQUE
    # and cover the world's top 288px — and the pier runs from y 60 to 306, so
    # the water was being painted straight over the dock (Trym: "the water
    # sprites are overflowing the dock"). Export the deck as its own sprite and
    # the page redraws it ABOVE the sea but BELOW anything that walks, because
    # a dock is a FLOOR, not a wall — it must never occlude a banana standing
    # on it. Cropped off the finished plate, so the water it carries at its
    # edges is identical to what sits underneath.
    PIER_SPRITE.extend([px0 - 8, py0, (px1 + 8) - (px0 - 8), (py1 + 12) - py0])
    im.crop((px0 - 8, py0, px1 + 8, py1 + 12)).save(
        os.path.join(OUT, 'pier.png'), optimize=True)
    # ⚠️ emit LAST — it needs NET_SPRITE, every OVERLAY and PIER_SPRITE, and
    # the pier is drawn after the props. Emitting earlier read an empty list.
    emit_geo()

    # 🔥 the bonfire ring — hand-drawn stones; the pack's sea rocks carry a
    # foam collar, so a ring of them read as a ring of bubbles on dry sand.
    # 24 Jul: moved to a sheltered nook (fcx,fcy) below the wreck, dressed with
    # deck chairs + a blanket + a palm (placed in the furniture block). ⚠️ keep
    # BONFIRE (the collider) at this same centre.
    fcx, fcy = BONFIRE[0], BONFIRE[1]
    shadow(fcx + 6, fcy + 6, 74, 46, 40)
    for a in range(11):
        ang = a / 11.0 * math.tau
        sx, sy = fcx + int(math.cos(ang) * 62), fcy + int(math.sin(ang) * 40)
        for yy in range(sy - 9, sy + 10):
            for xx in range(sx - 12, sx + 13):
                d = math.hypot((xx - sx) / 12.0, (yy - sy) / 9.0)
                if d <= 1.0:
                    lit = (yy - sy) < -3 and (xx - sx) < 3
                    put(xx, yy, (108, 104, 96) if d > 0.86 else
                        ((186, 182, 168) if lit else (146, 142, 130)))
    for i in range(5):                       # charred logs in the middle
        ang = i / 5.0 * math.tau
        rect(fcx + math.cos(ang) * 20 - 5, fcy + math.sin(ang) * 12 - 4,
             fcx + math.cos(ang) * 20 + 6, fcy + math.sin(ang) * 12 + 5, (74, 52, 32))
    rect(fcx - 16, fcy - 8, fcx + 18, fcy + 8, (52, 38, 24))

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
    # 🐟 SHOALS UNDER THE SURFACE. These sheets are NOT fish sprites — they are
    # fish-shaped SHADOWS painted in slightly darker shades of their own water,
    # so they need their own (darker) key and a TIGHT tolerance, or the dekey
    # eats the fish too. No outline: a shadow under water has no ink line.
    # 🔥 THE BONFIRE'S FLAME — the pack's own 6-frame campfire, 48×96 per frame
    # (it is TWO tiles tall because the fire rises out of its ring). Trym asked
    # for "a glowing fire, medium sized, fit for a beach evening" — the sprite
    # gives the flame, the page adds the warm light pooling around it.
    anim_strip('Campfire_48x48.png', 'a-fire.png', frames=6, tw=48, th=96,
               colors=12, warm=0.10)
    FISH_KEY = (60, 163, 178)
    anim_strip('Fishes_1_48x48gif.png', 'a-fish1.png', frames=12, dekey=FISH_KEY,
               keytol=8, outline=False, colors=5, warm=0.0)
    anim_strip('Fishes_2_48x48.png', 'a-fish2.png', frames=14, dekey=FISH_KEY,
               keytol=8, outline=False, colors=5, warm=0.0)
    anim_strip('Fishes_3_48x48.png', 'a-fish3.png', frames=14, dekey=FISH_KEY,
               keytol=8, outline=False, colors=5, warm=0.0)

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
# ---- 🦆 HOOK-A-DUCK: the ducks -------------------------------------------
# Drawn, obviously — no pack has rubber ducks. Two frames so they bob.
def build_duck(bob):
    K = 3
    w, h = 30 * K, 26 * K
    s = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(s)
    o = bob * K                                  # the whole duck rides up/down
    BODY, LIT, SHD = (250, 206, 62), (255, 232, 132), (206, 156, 30)
    d.ellipse([4 * K, (11 * K) + o, 25 * K, (22 * K) + o], fill=BODY)
    d.ellipse([4 * K, (11 * K) + o, 18 * K, (17 * K) + o], fill=LIT)
    d.ellipse([6 * K, (18 * K) + o, 24 * K, (22 * K) + o], fill=SHD)
    d.ellipse([15 * K, (4 * K) + o, 27 * K, (15 * K) + o], fill=BODY)   # head
    d.ellipse([15 * K, (4 * K) + o, 23 * K, (10 * K) + o], fill=LIT)
    d.polygon([(26 * K, (8 * K) + o), (30 * K - 2, (10 * K) + o),
               (26 * K, (12 * K) + o)], fill=(240, 138, 40))            # beak
    d.ellipse([21 * K, (7 * K) + o, 24 * K, (10 * K) + o], fill=(28, 22, 20))
    return blockify(s, factor=K, colors=8, alpha_thresh=0.42, sat=1.12,
                    con=1.06, trim=False)


_duck = Image.new('RGBA', (30 * 2 + 4, 26 + 2), (0, 0, 0, 0))
for i, bob in enumerate((0, 2)):
    _duck.alpha_composite(build_duck(bob), (i * (30 + 2), 0))
_duck.save(os.path.join(OUT, 'duck.png'), optimize=True)
print('wrote duck.png (2 bob frames)')

# ---- ⛏ THE DIG: a churned patch and a dug hole ----------------------------
# Both are drawn, not baked into the plate: the patches are DATE-SEEDED at
# runtime, so the page places them itself. The patch is deliberately soft and
# irregular — a hard-edged rectangle of darker sand reads as a UI element,
# not as somewhere the tide turned the sand over.
_dg = random.Random(4242)
patch = Image.new('RGBA', (156, 104), (0, 0, 0, 0))
pp = patch.load()
for y in range(104):
    for x in range(156):
        # an ellipse with a wobbling edge, so no two lobes look machined
        wob = (math.sin(x * 0.11) * 0.05 + math.sin(y * 0.17 + 1.3) * 0.05)
        d = ((x - 78) / 76.0) ** 2 + ((y - 52) / 50.0) ** 2
        if d > 1.0 + wob:
            continue
        edge = d > 0.74 + wob
        r = _dg.random()
        if edge and r < 0.42:
            continue                       # ragged rim, never a clean outline
        # churned sand: the same family as the plate's sand, a touch darker
        # and mottled, with occasional turned-over clumps
        # ⚠️ MUST BE CLEARLY DARKER THAN THE SAND. The first pass used tones
        # within a few values of the plate's sand and the patches were
        # invisible — you can't hunt for something you can't see.
        if r < 0.14:
            c = (186, 152, 100, 240)       # a clod turned up from underneath
        elif r < 0.38:
            c = (206, 176, 122, 232)
        else:
            c = (220, 192, 140, 222)
        pp[x, y] = c
patch.save(os.path.join(OUT, 'dig-patch.png'), optimize=True)

# ---- the hole you leave behind --------------------------------------------
# ⚠️ DRAWN, NOT PACK ART. The pack's "little pile of dirt" is a SHOVEL stuck
# in a mound, so a dug-out patch read as fourteen planted shovels rather than
# fourteen holes. A hole is a dark bowl with a bright rim and a little spoil
# beside it — ten lines, and it actually reads as a hole.
hole = Image.new('RGBA', (22, 16), (0, 0, 0, 0))
hp = hole.load()
for y in range(16):
    for x in range(22):
        d = ((x - 10.5) / 9.5) ** 2 + ((y - 8.0) / 6.0) ** 2
        if d > 1.0:
            continue
        if d > 0.72:
            hp[x, y] = (214, 182, 126, 255) if y < 8 else (250, 232, 190, 255)
        elif d > 0.34:
            hp[x, y] = (150, 116, 70, 255)
        else:
            hp[x, y] = (104, 76, 44, 255)          # the dark of the hole
for sx, sy in ((1, 11), (2, 12), (19, 10), (20, 11), (3, 3), (18, 3)):
    hp[sx, sy] = (226, 198, 146, 255)              # spoil flicked out
hole.save(os.path.join(OUT, 'dig-hole.png'), optimize=True)
print('wrote dig-patch.png + dig-hole.png')

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
