# 🚪 ROOM BUILDER — the ONE way this world makes an indoor room (19 Sep 2026).
#
# The arcade (tools/build-town-scene.py) and the wooden homes (tools/build-homestead-scene.py)
# were each carrying their own copy of the same twelve lines, and the general store is the third
# room that wants them. A room in Banana World is always the same four moves:
#
#   1. a Room_Builder FLOOR tile, laid edge to edge over the whole plate
#   2. ONE Room_Builder WALL segment (48 × 96) repeated across the top — the wall band
#   3. a flat FRAME painted round the edge, with a gap at the bottom middle for the door
#   4. a CONTRACT the client reads: box, spawn, exit, the five wall colliders, and whatever
#      the room's own furniture adds
#
# ⚠️ EVERY NUMBER HERE IS LOAD-BEARING and was measured against art already shipped. FRAME 14,
# the door's 60/61 asymmetry, the spawn at 56 above the floor and the exit strip 18 deep are what
# in-arcade.png, in-wood2.png and in-wood3.png are built from today — the refactor that created
# this file is proven by those three staying byte-identical. Change one and you are re-cutting
# three rooms, so measure first and look at the plate.
#
# Pack fidelity (docs/design-library.md): every pixel in a room comes from Modern Interiors. The
# frame is the one exception and it is not art — it is the dark edge the plate floats on.
import os
from PIL import Image, ImageDraw

FRAME = 14        # the flat edge painted round the plate
DOOR_HALF = 60    # half the doorway at the bottom middle (the left edge stops a pixel sooner)
SPAWN_UP = 56     # where a banana lands when it walks in, above the floor's bottom edge
EXIT_DEEP = 18    # how deep the strip at the door is that takes you back out
EXIT_HALF = 46    # and how wide


def sheets(rbd):
    """the two Room_Builder sheets a room is cut from"""
    return (Image.open(os.path.join(rbd, 'Room_Builder_Floors_48x48.png')).convert('RGBA'),
            Image.open(os.path.join(rbd, 'Room_Builder_Walls_48x48.png')).convert('RGBA'))


def tiles(floors, walls, fx, fy, wx, wy):
    """one 48×48 floor tile and one 48×96 wall segment, by their place on the sheets"""
    return (floors.crop((fx, fy, fx + 48, fy + 48)), walls.crop((wx, wy, wx + 48, wy + 96)))


def single(folder, n, glob=None, re=None):
    """a Theme_Sorter single by its number — the pack names them `..._<n>.png`"""
    import glob as _g
    import re as _r
    fs = [f for f in _g.glob(os.path.join(folder, '*.png')) if _r.search(r'_%d\.png$' % n, f)]
    return Image.open(fs[0]).convert('RGBA')


def darkest(sheet, tw, th, step=48):
    """the darkest low-chroma tile on a builder sheet — for a room that wants to be dim.

    Reads every fourth pixel (the sheets are big and this runs on every build), skips anything
    with a transparent pixel in it, and scores lum + 2×chroma so a dark BROWN beats a dark blue.
    """
    best, bk = None, 1e9
    px = sheet.load()
    for y in range(0, sheet.height - th + 1, step):
        for x in range(0, sheet.width - tw + 1, step):
            t = sheet.crop((x, y, x + tw, y + th))
            if t.getbbox() is None or min(t.getchannel('A').getextrema()) < 250:
                continue
            r = g = b = 0
            for yy in range(y, y + th, 4):
                for xx in range(x, x + tw, 4):
                    p = px[xx, yy]; r += p[0]; g += p[1]; b += p[2]
            n = ((th + 3) // 4) * ((tw + 3) // 4)
            r, g, b = r / n, g / n, b / n
            lum = 0.3 * r + 0.59 * g + 0.11 * b
            chroma = max(r, g, b) - min(r, g, b)
            k = lum + chroma * 2
            if 36 < lum < 110 and k < bk:
                bk, best = k, (x, y)
    return best


def shell(tw, th, ftile, wseg, frame_rgb, fscale=1):
    """floor, wall band and frame. Returns (room image, width, height, centre x)."""
    wp, hp = tw * 48, th * 48
    room = Image.new('RGBA', (wp, hp), (0, 0, 0, 0))
    step = 48 * fscale
    ft = ftile if fscale == 1 else ftile.resize((step, step), Image.NEAREST)
    for j in range(0, hp, step):
        for i in range(0, wp, step):
            room.alpha_composite(ft, (i, j))
    for i in range(tw):
        room.alpha_composite(wseg, (i * 48, 0))
    dr = ImageDraw.Draw(room)
    cx = wp // 2
    dr.rectangle([0, 0, FRAME - 1, hp - 1], fill=frame_rgb)
    dr.rectangle([wp - FRAME, 0, wp - 1, hp - 1], fill=frame_rgb)
    dr.rectangle([0, hp - FRAME, cx - DOOR_HALF - 1, hp - 1], fill=frame_rgb)
    dr.rectangle([cx + DOOR_HALF, hp - FRAME, wp - 1, hp - 1], fill=frame_rgb)
    return room, wp, hp, cx


def contract(img, at, wp, hp, cx, extra_cols=(), spots=None):
    """what the client needs to walk the room: where it floats, where you land, where you leave.

    `extra_cols` and `spots` come in RELATIVE to the plate and are moved into world coordinates
    here, so a room's furniture table never has to know where its plate ended up.
    """
    ox, oy = at
    out = {
        'img': img, 'box': [ox, oy, wp, hp],
        'spawn': [ox + cx, oy + hp - SPAWN_UP],
        'exit': [ox + cx - EXIT_HALF, oy + hp - EXIT_DEEP, ox + cx + EXIT_HALF, oy + hp],
        'cols': [
            [ox, oy, ox + wp, oy + 100],                                  # the wall band
            [ox, oy, ox + FRAME, oy + hp],                                # left edge
            [ox + wp - FRAME, oy, ox + wp, oy + hp],                      # right edge
            [ox, oy + hp - FRAME, ox + cx - DOOR_HALF, oy + hp],          # bottom, left of the door
            [ox + cx + DOOR_HALF, oy + hp - FRAME, ox + wp, oy + hp],     # bottom, right of the door
        ] + [[ox + a, oy + b, ox + c, oy + d] for a, b, c, d in extra_cols],
    }
    if spots is not None:
        out['spots'] = [[k, ox + a, oy + b, ox + c, oy + d] for k, a, b, c, d in spots]
    return out
