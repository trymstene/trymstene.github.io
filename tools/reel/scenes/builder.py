# -*- coding: utf-8 -*-
"""🍌 MAKE YOUR OWN BANANA — the builder, as a seven-look smash cut.

The builder's stage IS a flat banana-yellow square with one banana on it, so
that is the whole set: no plate, no invented props. The selling happens in the
CUTS — every 0.6s the outfit changes and the camera changes with it.

   0.00 HOOK   plain banana, wide                (nothing on it yet)
   0.82 SWAP   party + hearts + bow tie          dutch tilt, medium
   1.46 SWAP   fishbowl + 3D glasses             EXTREME face close-up
   2.10 SWAP   sombrero + monocle + moustache    low, big, cropped by the bottom
   2.74 SWAP   DJ cans + shades + boombox        dutch the other way
   3.38 SWAP   viking + deal-with-it + chain     pulled wide, off-centre
   3.95 PAYOFF crown + dwi + chain + boombox     the boldest look, confetti

Every swap is a real cut: a 2-frame dip to black, a 1-frame white flash, a
zoom punch, chroma fringe and a sparkle burst off the head.

⚠️ SCALE: engine.banana() normalises INK height, so a pose with the arms up
(tipY 0) would otherwise render the body ~17% smaller than a pose with the
arms down. Here every sprite is placed off the engine's own 469x498 body
canvas (banana_render's anchors), so the banana keeps ONE honest size through
the whole dance and only the pose moves.
"""
import math

from PIL import Image, ImageDraw, ImageFilter

from engine import (H, W, banana, blink_fade, chroma_split, clamp01, confetti, dance_frame,
                    flash, impact_ring, new_frame, out_back, out_cubic, seg, shake_img,
                    sparkle_burst, speed_lines, sun_rays, vignette, zoom_punch)

import banana_render as BR   # the engine's own mirror (engine put tools/ on the path)

SECS = 5.0

FIELD = (255, 225, 53, 255)          # --banana, the builder stage colour
PAD = round(BR.FW * 0.55)            # banana_render's canvas margin at scale 1
FEET = (BR.FEET_CX, BR.FEET_BOTTOM)

# at, outfit, body px (the height of the engine's 498-tall body canvas),
# anchor ('feet' | 'eyes' | a body-canvas point), where it sits on screen, tilt.
# ⚠️ a dutch look pivots on MID-BODY, never the feet — pinning the feet swings
# the head a whole body-width sideways and the framing falls apart.
MID = (BR.FEET_CX, 300)
LOOKS = [
    dict(at=0.00, body=640, anchor='feet', pos=(270, 812), tilt=0,
         outfit={}),
    dict(at=0.82, body=660, anchor=MID, pos=(266, 556), tilt=-8,
         outfit={'hat': 'party', 'glasses': 'hearts', 'extras': ['bowtie']}),
    dict(at=1.46, body=930, anchor='eyes', pos=(266, 545), tilt=-3,
         outfit={'hat': 'fishbowl', 'glasses': 'threed'}),
    dict(at=2.10, body=850, anchor='feet', pos=(262, 1095), tilt=0,
         outfit={'hat': 'sombrero', 'glasses': 'monocle', 'extras': ['mustache']}),
    # the boombox rides the LEFT glove, which swings to canvas x=45 on the
    # arms-wide poses — these two looks sit right of centre to keep it in frame
    dict(at=2.74, body=650, anchor=MID, pos=(316, 574), tilt=7,
         outfit={'hat': 'djheadphones', 'glasses': 'shades', 'extras': ['boombox']}),
    dict(at=3.38, body=570, anchor='feet', pos=(276, 792), tilt=0,
         outfit={'hat': 'viking', 'glasses': 'dwi', 'extras': ['goldchain']}),
    # ⚠️ the payoff size is capped by the DWI shades: 28 grid units = 364 of the
    # 469-wide body canvas, so past ~body 660 (plus the push) they clip the
    # frame edges and read as a broken sprite instead of a wide grin.
    dict(at=3.95, body=630, anchor='feet', pos=(286, 846), tilt=0,
         outfit={'hat': 'crown', 'glasses': 'dwi', 'extras': ['goldchain', 'boombox']}),
]

_BB, _GLOW = {}, None


def _bbox(f, outfit):
    """the dressed frame's ink box in banana_render's own scale-1 canvas"""
    key = (f, str(sorted(outfit.items())))
    if key not in _BB:
        _BB[key] = BR.render(f, outfit, scale=1).getbbox()
    return _BB[key]


def place(im, i, outfit, body, anchor, screen, tilt=0.0):
    """paste the dressed banana so `anchor` (a body-canvas point) lands on `screen`"""
    f = dance_frame(i)
    x0, y0, x1, y1 = _bbox(f, outfit)
    b = banana(f, outfit, height=max(2, int(round((y1 - y0) * body / BR.FH))))
    sx, sy = b.width / float(x1 - x0), b.height / float(y1 - y0)
    if anchor == 'eyes':
        ap = (BR.FRAMES[f]['eyeCx'], BR.FRAMES[f]['eyeCy'])
    elif anchor == 'feet':
        ap = FEET
    else:
        ap = anchor
    ax, ay = (PAD + ap[0] - x0) * sx, (PAD + ap[1] - y0) * sy
    if tilt:
        vx, vy = ax - b.width / 2.0, ay - b.height / 2.0
        th = math.radians(tilt)
        rx = vx * math.cos(th) + vy * math.sin(th)
        ry = -vx * math.sin(th) + vy * math.cos(th)
        b = b.rotate(tilt, expand=True, resample=Image.NEAREST)
        px, py = screen[0] - rx - b.width / 2.0, screen[1] - ry - b.height / 2.0
    else:
        px, py = screen[0] - ax, screen[1] - ay
    im.alpha_composite(b, (int(round(px)), int(round(py))))


def _glow():
    global _GLOW
    if _GLOW is None:
        m = Image.new('L', (W // 4, H // 4), 0)
        d = ImageDraw.Draw(m)
        d.ellipse([W / 4 * 0.06, H / 4 * 0.10, W / 4 * 0.94, H / 4 * 0.70], fill=150)
        m = m.resize((W, H)).filter(ImageFilter.GaussianBlur(64))
        ov = Image.new('RGBA', (W, H), (255, 252, 220, 255))
        ov.putalpha(m)
        _GLOW = ov
    return _GLOW


def stage(ts):
    im = new_frame(FIELD)
    im.alpha_composite(_glow())
    sun_rays(im, 270, 396, ts, n=16, col=(255, 249, 203), alpha=92, spin=0.20)
    return im


def fn(t, i):
    ts = t * SECS
    k = 0
    for n, L in enumerate(LOOKS):
        if ts >= L['at'] - 1e-6:
            k = n
    L = LOOKS[k]
    nxt = LOOKS[k + 1]['at'] if k + 1 < len(LOOKS) else SECS
    p = clamp01((ts - L['at']) / max(1e-6, nxt - L['at']))
    d = ts - L['at']

    # the swap: a scale pop on the sprite, then a slow push through the look
    pop = 0.92 + 0.08 * out_back(clamp01(d / 0.17)) if k else 1.0
    body = L['body'] * pop * (1.0 + 0.045 * out_cubic(p))
    hx, hy = math.sin(ts * 2.3 + k) * 4.0, math.cos(ts * 1.8 + k * 1.7) * 3.4
    pos = (L['pos'][0] + hx, L['pos'][1] + hy)

    im = stage(ts)
    place(im, i, L['outfit'], body, L['anchor'], pos, tilt=L['tilt'])

    # ---- the hit -----------------------------------------------------------
    punch = max(0.0, 1 - d / 0.18) if k else 0.0
    fl = max(0.0, 1 - d / 0.055) if k else 0.0
    if L['anchor'] == 'eyes':
        head = pos
    elif L['anchor'] == 'feet':
        head = (pos[0], pos[1] - body * 0.60)
    else:
        head = (pos[0], pos[1] - body * (L['anchor'][1] - 175) / BR.FH)
    if k:
        sparkle_burst(im, head[0], head[1], seg(ts, L['at'], L['at'] + 0.34),
                      n=16, dist=190 + 40 * k, seed=7 + k)
    if k in (2, 3):
        speed_lines(im, seg(ts, L['at'], L['at'] + 0.20), n=16, seed=11 + k,
                    horizontal=(k == 2))
    if k == len(LOOKS) - 1:
        # starts already wider than the shades, so it reads as a shockwave
        # leaving the frame and never as a hoop drawn across the face
        impact_ring(im, head[0], head[1] + body * 0.16, seg(ts, L['at'], L['at'] + 0.34),
                    r0=190, r1=620, width=12, col=(255, 253, 245))
        sparkle_burst(im, head[0], head[1], seg(ts, L['at'] + 0.30, L['at'] + 0.95),
                      n=20, dist=300, seed=31)
        confetti(im, seg(ts, L['at'] + 0.04, L['at'] + 1.75), n=44)

    vignette(im, 52)
    im = zoom_punch(im, punch)
    im = shake_img(im, punch * 9)
    im = chroma_split(im, punch * 7)
    im = flash(im, fl * 0.92)
    # the tiny blink: dip just BEFORE the next cut, so the swap reads as a cut
    im = blink_fade(im, 0.5 * clamp01(1 - (nxt - ts) / 0.06) if k + 1 < len(LOOKS) else 0.0)
    im = blink_fade(im, 1 - seg(t, 0.0, 0.03))
    return im


SCENE = {'name': 'builder', 'secs': SECS, 'fn': fn}
