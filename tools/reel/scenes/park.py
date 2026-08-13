# -*- coding: utf-8 -*-
"""🌳 THE PARK — the cozy garden, sold in four and a half seconds.

Shot on the real park plate, over the WEST bed cluster (park-geo PLOTS bed 6
+ bed 7, ditches at x 620/680/758/818). Beat structure:
   0.00 a bird crosses, a chicken pecks, a rabbit hops — the place is alive
   0.00 the banana WALKS in off the road (Walk: 168px/s, two legs, hard stop)
   0.39 it arrives beside the thirsty bed — dust, ring, small punch
   0.42 it waters — droplets fall, the soil goes dark wet, splash specks
   0.61 the wilted flowers SPRING UP — heal glow, sparkles, ring, punch
   0.70 butterflies come out (phase-4 life), a bird glides down and lands
   0.80 the camera eases back off the bed
"""
import math
import random

from PIL import Image, ImageDraw, ImageEnhance

from engine import (Cam, Walk, asset, blink_fade, chroma_split, handheld, impact_ring,
                    in_out, out_cubic, poof, pulse, put_world, seg, shake_img, sheet_cell,
                    sparkle_burst, strip_frame, vignette, world_banana, zoom_punch)

SECS = 4.6

# ---- the stage, in park-geo world px ---------------------------------------
PLOT_A = (620, 698)         # the two plots of the first ditch of bed 6
PLOT_B = (620, 736)
STAND = (566, 742)          # the banana's spot, clear of every bed collider

# beats, in seconds
T_ARRIVE = 1.80
T_W0, T_W1 = 1.95, 2.92     # the watering
T_WET = 2.32                # the soil turns
T_HEAL = (2.80, 2.92)       # the two flowers spring up

tA, tB = T_HEAL[0] / SECS, T_HEAL[1] / SECS

# the plate's own dressing: neighbouring plots, already tended
STATIC = [
    # (sprite, plot x, plot y, wet?)
    ('c-tomato-3.png', 680, 698, 1),
    ('c-tomato-2.png', 680, 736, 1),
    ('c-pumpkin-3.png', 758, 698, 1),
    ('g-sprout2.png', 758, 736, 0),
    ('g-sprout1.png', 818, 698, 0),
    ('g-sprout2.png', 620, 806, 1),
    ('c-wheat-3.png', 680, 806, 1),
    ('g-daisy.png', 758, 806, 1),
]
# 🌼 border flowers on the generator's real BORDER_SPOTS
BORDER = [('b-marigold.png', 582, 638), ('b-poppy.png', 762, 605),
          ('b-bluebell.png', 660, 508)]

# 🦋 the meadow butterflies, rebuilt from park-critters.js BFLY + bflySvg
BFLY_DARK = (58, 43, 24)
BF_F1 = [(0, 0, 3, 3, 'a'), (1, 3, 2, 2, 'b'), (1, 1, 1, 1, 'b'),
         (7, 0, 3, 3, 'a'), (7, 3, 2, 2, 'b'), (8, 1, 1, 1, 'b'),
         (3, 0, 1, 1, 'd'), (6, 0, 1, 1, 'd'), (4, 1, 2, 5, 'd')]
BF_F2 = [(2, 0, 2, 4, 'a'), (2, 3, 2, 1, 'b'), (6, 0, 2, 4, 'a'),
         (6, 3, 2, 1, 'b'), (4, 1, 2, 5, 'd')]
BF_KIND = [((255, 225, 53), (201, 154, 30)), ((125, 185, 255), (58, 111, 214))]

_MEM = {}


def bfly(kind, frame):
    key = ('bf', kind, frame)
    if key not in _MEM:
        a, b = BF_KIND[kind]
        im = Image.new('RGBA', (10, 8), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        for x, y, w, h, c in (BF_F1 if frame else BF_F2):
            col = a if c == 'a' else b if c == 'b' else BFLY_DARK
            d.rectangle([x, y, x + w - 1, y + h - 1], fill=col + (255,))
        _MEM[key] = im
    return _MEM[key]


def thirsty(path, amt):
    """the game's .bwq-thirsty look: saturate(0.3) brightness(0.85)"""
    q = round(amt * 8) / 8.0
    key = ('dry', path, q)
    if key not in _MEM:
        spr = asset(path)
        rgb = ImageEnhance.Color(spr.convert('RGB')).enhance(1 - 0.55 * q)
        rgb = ImageEnhance.Brightness(rgb).enhance(1 - 0.13 * q)
        out = rgb.convert('RGBA')
        out.putalpha(spr.getchannel('A'))
        _MEM[key] = out
    return _MEM[key]


def glow(im, cx, cy, r, a, col=(255, 235, 120)):
    if a <= 0 or r <= 1:
        return
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    n = 7
    for k in range(n, 0, -1):
        rr = r * k / n
        d.ellipse([cx - rr, cy - rr * 0.92, cx + rr, cy + rr * 0.92],
                  fill=col + (max(1, round(a / n)),))
    im.alpha_composite(ov)


def soil(im, cam, wx, wy, wet):
    """pk-soil: 39x25 world px, CENTRED on (plot x, plot y + 12)"""
    put_world(im, cam, asset('park/g-soil-%s.png' % ('wet' if wet else 'dry')),
              wx, wy + 12, anchor='center')


def water_drops(im, cam, ts, on):
    """the stream off the banana's hands onto the ditch"""
    if on <= 0:
        return
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    rnd = random.Random(41)
    k = cam.k
    for n in range(16):
        jx, jy, sp = rnd.uniform(-1, 1), rnd.random(), rnd.uniform(0.9, 1.2)
        u = ((ts * 2.05 * sp) + n * 0.0625) % 1.0
        wx = (600 + jx * 4) + ((617 + jx * 14) - (600 + jx * 4)) * u
        wy = 682 + (708 + jy * 48 - 682) * (u * u * 0.7 + u * 0.3)
        sx, sy = cam.tf(wx, wy)
        w = max(2, round(3.0 * k))
        h = max(3, round(5.6 * k))
        col = (191, 232, 255) if n % 3 else (232, 247, 255)
        d.rectangle([sx - w / 2, sy - h / 2, sx + w / 2, sy + h / 2],
                    fill=col + (round(240 * on),))
    im.alpha_composite(ov)


def splash(im, cam, ts, on):
    """pk-splash: three specks kicked up off the wet soil"""
    if on <= 0:
        return
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    k = cam.k
    for n in range(3):
        u = (ts * 3.6 + n * 0.31) % 1.0
        lift = math.sin(math.pi * min(1.0, u * 1.4)) * 17
        sx, sy = cam.tf(620 + (n - 1) * 10, 716 - lift)
        s = max(2, round((5 if n == 1 else 4) * k))
        a = round(235 * on * (1 - u * u))
        d.rectangle([sx - s / 2, sy - s / 2, sx + s / 2, sy + s / 2],
                    fill=((232, 247, 255) if n == 1 else (191, 232, 255)) + (a,))
    im.alpha_composite(ov)


def bird(im, cam, i, sp, p, a, b, alt0, alt1, peak, sit=False):
    """a Garden-Birds 4x4 sheet: row 0 = the 4-frame flap, row 2 = the sit"""
    if p <= 0:
        return
    p = min(1.0, p)
    x = a[0] + (b[0] - a[0]) * p
    y = a[1] + (b[1] - a[1]) * p
    alt = alt0 + (alt1 - alt0) * p + math.sin(math.pi * p) * peak
    path = 'park/bird-%s.png' % sp
    if sit and p >= 1:
        cell = sheet_cell(path, 4, 4, (i // 18) % 4, 2)
        alt = 0
    else:
        cell = sheet_cell(path, 4, 4, i % 4, 0)
    if alt > 5:                       # the airborne shadow (pk-gbshad)
        ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        sx, sy = cam.tf(x, y)
        rx, ry = 10 * cam.k, 3.4 * cam.k
        d.ellipse([sx - rx, sy - ry, sx + rx, sy + ry],
                  fill=(24, 42, 20, round(255 * max(0.07, 0.3 - alt / 340))))
        im.alpha_composite(ov)
    put_world(im, cam, cell, x, y - alt, flip=b[0] > a[0])


def fn(t, i):
    ts = t * SECS
    plate = asset('park/park.png').copy()

    # ---- the bed as the game leaves it: tended neighbours, roadside flowers
    for name, px, py, wet in STATIC:
        s = asset('park/g-soil-%s.png' % ('wet' if wet else 'dry'))
        plate.alpha_composite(s, (round(px - s.width / 2), round(py + 12 - s.height / 2)))
        spr = asset('park/' + name)
        plate.alpha_composite(spr, (round(px - spr.width / 2), round(py + 10 - spr.height)))
    for name, bx, by in BORDER:
        spr = asset('park/' + name)
        plate.alpha_composite(spr, (round(bx - spr.width / 2), round(by - 12 - spr.height)))

    # ---- 🚶 GAMEPLAY MOTION: off the road, two legs, a hard stop -----------
    walk = Walk([(748, 596), (644, 664), STAND], pause=0.34, start_pause=0.06)
    wx, wy, moving = walk.at(ts)

    # 🐔 a chicken wanders the alley between the two bed rows (46 px/s, the
    # animals' real speed), 🐇 a rabbit crosses the grass below
    chick = Walk([(604, 898), (548, 890), (512, 904)], pause=0.85, speed=46, start_pause=0.1)
    cx_, cy_, cmov = chick.at(ts)
    rab = Walk([(768, 936), (708, 926), (664, 940)], pause=1.05, speed=46, start_pause=0.55)
    rx_, ry_, rmov = rab.at(ts)

    # ---- 🎥 slow push onto the bed, then a small ease back -----------------
    push = in_out(seg(t, 0.05, 0.62))
    pull = in_out(seg(t, 0.80, 1.0))
    vw = 500 - 165 * push + 38 * pull            # <= 610 always
    hx, hy = handheld(ts, amp=2.2)
    cam = Cam(plate, 700 - 88 * push + 12 * pull + hx,
              646 + 106 * push - 15 * pull + hy, vw)

    hit = max(pulse(t, T_ARRIVE / SECS, 0.035) * 7.5, pulse(t, tA, 0.05) * 20)
    cam.shake_amt = hit * 0.5
    im, k = cam.shot()

    # ---- the two thirsty plots ---------------------------------------------
    wet = ts >= T_WET
    soil(im, cam, PLOT_A[0], PLOT_A[1], wet)
    soil(im, cam, PLOT_B[0], PLOT_B[1], wet)

    def flower(name, plot, at):
        p = seg(ts, at, at + 0.55)
        dry = 1.0 - out_cubic(seg(ts, at, at + 0.16))
        spr = thirsty('park/' + name, dry)
        n = 1.0 + 0.34 * math.sin(math.pi * min(1.0, p * 1.55)) * (1 - p) if 0 < p < 1 else 1.0
        lift = 7 * math.sin(math.pi * min(1.0, p * 1.3)) if 0 < p < 1 else 0.0
        put_world(im, cam, spr, plot[0], plot[1] + 10 - lift, native=n)
        if 0 < p < 1:
            gx, gy = cam.tf(plot[0], plot[1] - 6)
            glow(im, gx, gy, 62 * k * (0.5 + p), round(150 * (1 - p) ** 0.6))

    flower('g-sunflower.png', PLOT_A, T_HEAL[0])
    world_banana(im, cam, i, {'hat': 'sombrero', 'extras': ['daisypin']}, wx, wy,
                 flip=moving, lift=-abs(math.sin(i * 0.5)) * 3 if moving else 0)
    flower('g-daisy.png', PLOT_B, T_HEAL[1])

    # ---- the park's own life ------------------------------------------------
    ch = strip_frame('park/a-chicken1.png', 6, int(ts * 8) if cmov else 0)
    put_world(im, cam, ch, cx_, cy_, flip=True)
    rb = strip_frame('park/a-rabbit.png', 6, int(ts * 8) if rmov else 0)
    put_world(im, cam, rb, rx_, ry_ + 19, flip=not rmov)

    bird(im, cam, i, 'red-robin', seg(t, 0.0, 0.46), (446, 646), (918, 604), 148, 128, 34)
    bird(im, cam, i, 'blue-jay', seg(t, 0.66, 0.90), (906, 690), (704, 666), 176, 0, 26, sit=True)

    # ---- 💧 the watering ----------------------------------------------------
    won = min(1.0, seg(ts, T_W0, T_W0 + 0.12), 1 - seg(ts, T_W1 - 0.18, T_W1))
    water_drops(im, cam, ts, won)
    splash(im, cam, ts, min(won, seg(ts, T_WET - 0.1, T_WET + 0.05)))

    # ---- the punches --------------------------------------------------------
    ax, ay = cam.tf(STAND[0], STAND[1])
    poof(im, ax, ay, seg(ts, T_ARRIVE - 0.02, T_ARRIVE + 0.34), seed=6, big=0.55)
    impact_ring(im, ax, ay, seg(ts, T_ARRIVE, T_ARRIVE + 0.38), r0=6, r1=120, width=5)

    bx, by = cam.tf(PLOT_A[0], PLOT_A[1] + 8)
    impact_ring(im, bx, by, seg(t, tA, tA + 0.16), r0=8, r1=185, width=8, col=(255, 225, 53))
    fl = pulse(t, tA + 0.01, 0.04)
    if fl > 0:
        im.alpha_composite(Image.new('RGBA', im.size, (255, 253, 245, round(92 * fl))))
    hx2, hy2 = cam.tf(PLOT_A[0], PLOT_A[1] - 24)
    sparkle_burst(im, hx2, hy2, seg(t, tA, tA + 0.22), n=16, dist=170, seed=3)
    sparkle_burst(im, *cam.tf(PLOT_B[0], PLOT_B[1] - 14), t01=seg(t, tB, tB + 0.22),
                  n=12, dist=130, seed=8)
    sparkle_burst(im, hx2, hy2 + 16, seg(t, 0.78, 1.0), n=14, dist=230, seed=11)

    # ---- 🦋 phase-4 life: a bloomed bed brings the butterflies out ----------
    bp = seg(t, 0.70, 0.86)
    if bp > 0:
        for n2, (kx, ky, kind) in enumerate([(654, 636, 0), (698, 674, 1)]):
            ph = ts * 1.7 + n2 * 2.1
            fx = kx - 46 * (1 - out_cubic(bp)) * (1 if n2 else -1) + math.sin(ph) * 13
            fy = ky - 26 * out_cubic(bp) + math.cos(ph * 1.3) * 9
            put_world(im, cam, bfly(kind, int(ts / 0.16) % 2), fx, fy,
                      native=2.35, anchor='center', flip=math.sin(ph) < 0)

    vignette(im, 54)
    im = zoom_punch(im, hit / 20)
    im = shake_img(im, hit)
    im = chroma_split(im, fl * 3.5)
    im = blink_fade(im, 0.8 * (1 - seg(t, 0.0, 0.03)))
    return im


SCENE = {'name': 'park', 'secs': SECS, 'fn': fn}
