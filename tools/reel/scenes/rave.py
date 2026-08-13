# -*- coding: utf-8 -*-
"""🪩 THE BANANA RAVE — one song, one beat, everybody in sync.

Dancing IS the gameplay here, so nobody walks: the crowd holds the floor and
dances on the engine's real 10fps cycle (dance_frame(i) for EVERY banana —
perfect sync is the club's actual headline feature). Bigness comes from the
camera alone; the club is rebuilt from the real /rave/ page:

   floor      96px checker tiles (#161022 / #1d1530 → #2a1650 / #451d66 on the drop)
   beams      yellow rgba(255,225,53) sweeping ±26°, hot pink + frantic on the drop
   booth      #17121f wall, the LED screen, the desk, two speakers, the DJ
   pyro       the page's own two-frame pixel flames, parsed out of rave.astro
   floor kit  jelly rain, bananacoins, the lost vinyl, the golden banana
   blackout   the real power-cut quest: club dark, breaker box lit top-right

Beats: 0.00 close on the crowd · 0.22 pull back, the club revealed ·
       0.50 THE DROP (pyro, hot beams, purple floor, speed lines) ·
       0.78 the power cuts · 0.87 lights SLAM back — confetti payoff.
"""
import math
import os
import random
import re

from PIL import Image, ImageChops, ImageDraw, ImageFilter

import engine
from engine import (H, W, asset, banana, blink_fade, chroma_split, clamp01, confetti, dance_frame,
                    flicker, impact_ring, in_out, new_frame, pulse, seg, shake_img,
                    sparkle_burst, speed_lines, strip_frame, vignette, zoom_punch)

SECS = 4.9

# ---- the real palette (rave.astro) ---------------------------------------
NANA, HOT, COOL, OK_, PURPLE = ((255, 225, 53), (255, 93, 143), (94, 200, 224),
                                (94, 224, 138), (201, 156, 255))
NIGHT = (13, 11, 20)          # #0d0b14
BOOTH = (23, 18, 31)          # #17121f
DESK = (36, 26, 56)           # #241a38
DESK_HI = (47, 34, 80)        # #2f2250
CONE = (42, 22, 80)           # #2a1650
CONE_HI = (179, 136, 255)     # #b388ff
GREEN = (55, 214, 122)        # #37d67a
FLOOR_A, FLOOR_B = (22, 16, 34), (29, 21, 48)          # #161022 / #1d1530
DROP_A, DROP_B = (42, 22, 80), (69, 29, 102)           # #2a1650 / #451d66

CELL = 48            # the conic checker cell (96px tile = 2x2 cells)
STAGE_Y = 0.0        # world y of the stage front edge; floor runs downward
BOOTH_H = 164.0

DROP_AT = 0.50       # when the drop lands (scene t)


# ---- the page's own pyro flames ------------------------------------------
def _flames():
    """the two-frame pixel fountain, parsed straight out of rave.astro"""
    out = []
    try:
        src = open(os.path.join(engine.SITE, 'src', 'pages', 'rave.astro'), encoding='utf-8').read()
        for body in re.findall(r'<svg class="rv-pyro__[ab]"[^>]*>(.*?)</svg>', src)[:2]:
            im = Image.new('RGBA', (9, 16), (0, 0, 0, 0))
            d = ImageDraw.Draw(im)
            for m in re.finditer(r'<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="#(\w{6})"', body):
                x, y, w, h = (int(m.group(j)) for j in range(1, 5))
                c = m.group(5)
                d.rectangle([x, y, x + w - 1, y + h - 1],
                            fill=tuple(int(c[j:j + 2], 16) for j in (0, 2, 4)) + (255,))
            out.append(im)
    except Exception:
        out = []
    return out


FLAME = _flames()

# ---- the floor, cast ------------------------------------------------------
# (world x, feet y, banana height) — three depth rows, 98..112 (a 14% spread)
CROWD = [(-155, 205, 98, {'glasses': 'shades'}, False),
         (10, 215, 98, {'hat': 'backwardscap'}, True),
         (172, 200, 100, {'glasses': 'hearts'}, False),
         (-215, 360, 105, {'extras': ['goldchain']}, False),
         (-55, 368, 105, {'extras': ['glowstick']}, False),
         (112, 355, 106, {'glasses': 'nerd'}, True),
         (-130, 512, 112, {'glasses': 'threed'}, False),
         (62, 520, 112, {'hat': 'crown'}, True)]

_R = random.Random(7)
PELLETS = [(_R.uniform(-250, 250), _R.uniform(0, 1), _R.uniform(0.55, 1.0)) for _ in range(9)]
RESTING = [(-95, 285), (55, 300), (-20, 455), (185, 480), (-198, 440)]


# ---- little helpers -------------------------------------------------------
def dim(col, f):
    return (round(col[0] * f), round(col[1] * f), round(col[2] * f))


def blit(im, spr, sx, sy, wh, k, flip=False, anchor='bottom', glow=None):
    """a sprite at a TRUE world height, scaled only by the camera"""
    h = max(2, round(wh * k))
    w = max(2, round(spr.width * (wh / spr.height) * k))
    s = spr.resize((w, h), Image.NEAREST)
    if flip:
        s = s.transpose(Image.FLIP_LEFT_RIGHT)
    oy = h if anchor == 'bottom' else h / 2
    x, y = round(sx - w / 2), round(sy - oy)
    if glow:
        col, rad = glow
        pad = rad * 3
        g = Image.new('RGBA', (w + pad * 2, h + pad * 2), col + (0,))
        g.putalpha(Image.new('L', g.size, 0))
        a = s.getchannel('A').point(lambda p: 255 if p > 40 else 0)
        ga = Image.new('L', g.size, 0)
        ga.paste(a, (pad, pad))
        g.putalpha(ga.filter(ImageFilter.GaussianBlur(rad)).point(lambda p: min(255, round(p * 1.7))))
        im.alpha_composite(g, (x - pad, y - pad))
    im.alpha_composite(s, (x, y))


def crowd_banana(im, i, outfit, sx, sy, wh, k, flip=False, glow=None):
    b = banana(dance_frame(i), outfit, height=max(4, round(wh * k)))
    if flip:
        b = b.transpose(Image.FLIP_LEFT_RIGHT)
    x, y = round(sx - b.width / 2), round(sy - b.height)
    if glow:
        col, rad = glow
        pad = rad * 3
        ga = Image.new('L', (b.width + pad * 2, b.height + pad * 2), 0)
        ga.paste(b.getchannel('A').point(lambda p: 255 if p > 40 else 0), (pad, pad))
        g = Image.new('RGBA', ga.size, col + (0,))
        g.putalpha(ga.filter(ImageFilter.GaussianBlur(rad)).point(lambda p: min(255, round(p * 1.6))))
        im.alpha_composite(g, (x - pad, y - pad))
    im.alpha_composite(b, (x, y))


def _fade(top, bottom):
    """alpha ramp anchored to the RIG, not the frame — a beam always burns
    brightest where it leaves the truss and dies before it crosses the floor"""
    g = Image.new('L', (1, H))
    px = g.load()
    span = max(1.0, bottom - top)
    for y in range(H):
        u = (y - top) / span
        px[0, y] = 255 if u < 0 else (round(255 * (1 - u) ** 1.6) if u < 1 else 0)
    return g.resize((W, H))


# ---- the club ------------------------------------------------------------
def draw_floor(im, tf, k, camx, camy, dropped):
    a = DROP_A if dropped else FLOOR_A
    b = DROP_B if dropped else FLOOR_B
    d = ImageDraw.Draw(im)
    top = tf(0, STAGE_Y)[1]
    if top < H:
        d.rectangle([0, max(0, top), W, H], fill=a + (255,))
    x0w, x1w = camx - (W / 2) / k, camx + (W / 2) / k
    y1w = camy + (H / 2) / k
    j0 = 0
    j1 = int(y1w // CELL) + 1
    i0, i1 = int(math.floor(x0w / CELL)) - 1, int(math.ceil(x1w / CELL)) + 1
    for j in range(j0, j1 + 1):
        for ii in range(i0, i1 + 1):
            if (ii + j) % 2:
                continue
            sx0, sy0 = tf(ii * CELL, j * CELL)
            d.rectangle([round(sx0), round(sy0), round(sx0 + CELL * k), round(sy0 + CELL * k)],
                        fill=b + (255,))


def led_wall(im, tf, k, ts, i, power):
    x0, y0 = tf(-330, -156)
    x1, y1 = tf(330, -38)
    if y1 <= 0:
        return
    bw, bh = max(2, round(x1 - x0)), max(2, round(y1 - y0))
    panel = Image.new('RGBA', (bw, bh), (20, 14, 33, 255))
    d = ImageDraw.Draw(panel)
    if power > 0.5:
        for y in range(bh):                      # the wall's radial-ish falloff
            u = y / max(1, bh - 1)
            c = (round(36 - 26 * u), round(26 - 19 * u), round(56 - 41 * u))
            d.line([0, y, bw, y], fill=c + (255,))
        wash = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
        wd = ImageDraw.Draw(wash)
        cols = [COOL, HOT, NANA]          # the wall's own 115° wash, cyan→pink→yellow
        band = bw * 0.30
        off = (ts * 210) % (band * len(cols))
        for n in range(-1, int(bw / band) + len(cols) + 1):
            c = cols[n % len(cols)]
            bx = n * band - off
            wd.polygon([(bx, 0), (bx + band, 0), (bx + band - bh * 0.9, bh), (bx - bh * 0.9, bh)],
                       fill=c + (78,))
        wash = wash.filter(ImageFilter.GaussianBlur(max(1, bw * 0.010)))
        panel.alpha_composite(wash)
        d = ImageDraw.Draw(panel)
        step = max(3, round(6 * k))                      # the LED pixel grid
        for y in range(0, bh, step):
            d.line([0, y, bw, y], fill=(10, 8, 16, 80))
        for x in range(0, bw, step):
            d.line([x, 0, x, bh], fill=(10, 8, 16, 55))
    else:
        rnd = random.Random(4400 + i)                    # power cut: the wall to static
        nw, nh = 46, 18
        n = Image.new('L', (nw, nh))
        n.putdata([rnd.randrange(0, 105) for _ in range(nw * nh)])
        if i % 5 == 0:
            n = n.point(lambda p: min(255, p * 3))
        panel = Image.merge('RGBA', (n, n, n.point(lambda p: min(255, round(p * 1.3))),
                                     Image.new('L', (nw, nh), 255))).resize((bw, bh), Image.NEAREST)
        d = ImageDraw.Draw(panel)
    d.rectangle([0, 0, bw - 1, bh - 1], outline=DESK_HI + (255,), width=max(2, round(3 * k)))
    im.alpha_composite(panel, (round(x0), round(y0)))


def beams(im, tf, k, sweep, power, dropped):
    if power <= 0.02:
        return
    col = (255, 77, 109) if dropped else NANA
    base = (62 if dropped else 34) * power
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for n, bx in enumerate((-235, -80, 80, 235)):
        ang = math.radians(26 * math.sin(sweep * math.tau + n * 1.9))
        ax, ay = bx, -172.0
        ex, ey = ax + math.sin(ang) * 1200, ay + math.cos(ang) * 1200
        px, py = math.cos(ang), -math.sin(ang)
        pts = [(ax - px * 10, ay - py * 10), (ax + px * 10, ay + py * 10),
               (ex + px * 58, ey + py * 58), (ex - px * 58, ey - py * 58)]
        d.polygon([tf(x, y) for x, y in pts], fill=col + (round(base),))
    ov = ov.filter(ImageFilter.GaussianBlur(5))          # light has soft edges
    ov.putalpha(ImageChops.multiply(ov.getchannel('A'), _fade(tf(0, -172)[1], tf(0, 950)[1])))
    im.alpha_composite(ov)


def speaker(im, tf, k, wx, ts, f):
    u = 50.0 * k / 12.0
    cx, base = tf(wx, STAGE_Y)
    x0, y0 = cx - 6 * u, base - 16 * u
    d = ImageDraw.Draw(im)
    d.rectangle([x0, y0, x0 + 12 * u, y0 + 16 * u], fill=dim(DESK, f) + (255,))
    d.rectangle([x0 + u, y0 + u, x0 + 11 * u, y0 + 15 * u], fill=dim(NIGHT, f) + (255,))
    for n, cy in ((0, 5), (1, 12)):
        s = 0.82 + 0.30 * (0.5 + 0.5 * math.sin((ts / 0.46 + n * 0.5 + wx * 0.002) * math.tau))
        r = 3 * u * s
        d.ellipse([x0 + 6 * u - r, y0 + cy * u - r, x0 + 6 * u + r, y0 + cy * u + r],
                  fill=dim(CONE, f) + (255,))
        r2 = 1.2 * u * s
        d.ellipse([x0 + 6 * u - r2, y0 + cy * u - r2, x0 + 6 * u + r2, y0 + cy * u + r2],
                  fill=dim(CONE_HI, f) + (255,))


def desk(im, tf, k, f):
    x0, y0 = tf(-75, -40)
    x1, y1 = tf(75, STAGE_Y)
    d = ImageDraw.Draw(im)
    d.rectangle([x0, y0, x1, y1], fill=dim(DESK, f) + (255,), outline=dim(NIGHT, f) + (255,),
                width=max(1, round(3 * k)))
    d.rectangle([x0 + 3 * k, y0 + 3 * k, x1 - 3 * k, y0 + 7 * k], fill=dim(DESK_HI, f) + (255,))
    for sx in (x0 + 9 * k, x1 - 15 * k):
        d.rectangle([sx, y0 + 8 * k, sx + 6 * k, y0 + 14 * k], fill=dim(CONE_HI, f) + (255,))
        d.rectangle([sx, y0 + 18 * k, sx + 6 * k, y0 + 24 * k], fill=dim(GREEN, f) + (255,))


def pyro(im, tf, k, ts, on):
    if not FLAME or on <= 0:
        return
    fr = FLAME[int(ts / 0.13) % 2]
    sq = (0.35, 0.62, 1.0, 0.8)[int(ts / 0.125) % 4]
    for wx in (-172, 172, -290, 290):
        sx, sy = tf(wx, STAGE_Y + 2)
        blit(im, fr, sx, sy, 60 * sq * on, k)


# ---- the scene -----------------------------------------------------------
def fn(t, i):
    ts = t * SECS
    dropped = t >= DROP_AT

    # 🎥 in the crowd → pull back, the club revealed → push on the drop → payoff
    creep = in_out(seg(t, 0.0, 0.20))
    k, camy = 1.50 - 0.05 * creep, 356.0 - 6.0 * creep
    p1 = in_out(seg(t, 0.20, 0.46))
    k += (1.15 - 1.45) * p1
    camy += (232 - 350) * p1
    p2 = in_out(seg(t, 0.50, 0.70))
    k += (1.34 - 1.15) * p2
    camy += (215 - 232) * p2
    p3 = in_out(seg(t, 0.865, 0.98))
    k += (1.12 - 1.34) * p3
    camy += (238 - 215) * p3
    camx = math.sin(ts * 0.9) * 12

    def tf(wx, wy):
        return (W / 2 + (wx - camx) * k, H / 2 + (wy - camy) * k)

    # 💡 the power-cut quest: lights die, the breaker is the only thing lit
    power = clamp01(1 - seg(t, 0.775, 0.805) + seg(t, 0.862, 0.878))
    dark = 1 - power
    stage_f = 0.22 + 0.78 * power

    im = new_frame(NIGHT + (255,))
    d = ImageDraw.Draw(im)

    # the booth wall + its 4px front edge
    by0, by1 = tf(0, -BOOTH_H)[1], tf(0, STAGE_Y)[1]
    if by1 > 0:
        d.rectangle([0, min(0, by0), W, by1], fill=dim(BOOTH, 0.35 + 0.65 * power) + (255,))
    led_wall(im, tf, k, ts, i, power)
    if by1 > 0:
        d.rectangle([0, by1 - 4 * k, W, by1], fill=NIGHT + (255,))

    draw_floor(im, tf, k, camx, camy, dropped)

    sweep = ts / 3.4 + max(0.0, ts - DROP_AT * SECS) * (1 / 0.62 - 1 / 3.4)
    beams(im, tf, k, sweep, power, dropped)

    # 🎛 the stage: tonight's DJ on the podium, speakers, desk
    crowd_banana(im, i, {'hat': 'djheadphones'}, *tf(0, -6), 88, k,
                 glow=(NANA, 8) if power > 0.5 else None)
    speaker(im, tf, k, -134, ts, stage_f)
    speaker(im, tf, k, 134, ts, stage_f)
    desk(im, tf, k, stage_f)
    pyro(im, tf, k, ts, power if dropped else 0.0)

    # 🍬 jelly rains from the rig (behind the crowd)
    jelly = asset('rave-guide/jelly.png')
    for n, (jx, ph, sp) in enumerate(PELLETS):
        fall = ((ts * 210 * sp + ph * 700) % 700) - 130
        sx, sy = tf(jx, fall)
        if -40 < sy < H + 40:
            blit(im, jelly, sx, sy, 15, k, anchor='mid')
    for rx, ry in RESTING:
        wob = 15 + math.sin(ts * 7 + rx) * 1.2
        blit(im, jelly, *tf(rx, ry), wob, k)

    # 🪙 the floor kit: a spinning bananacoin, a pile, the lost vinyl
    blit(im, strip_frame('banana-stand/coin-spin.png', 6, int(i / 4.5)), *tf(-92, 566), 44, k)
    blit(im, strip_frame('banana-stand/stack-spark.png', 4, int(i / 7)), *tf(170, 556), 43, k)
    blit(im, asset('rave-guide/vinyl.png'), *tf(95, 118), 34, k)     # the DJ's lost record

    # 🎧 tonight's drop drifts across the room — catch it and it's yours forever
    gp = seg(t, 0.24, 0.99)
    if 0 < gp < 1 and power > 0.5:
        blit(im, asset('rave-guide/gift.png'), *tf(-255 + gp * 440, 62 + math.sin(ts * 3.4) * 6),
             43, k, anchor='mid', glow=((34, 211, 238), 7))

    # 🕺 the crowd — one dance_frame for everybody: the club's whole point
    for n, (wx, wy, hh, fit, flip) in enumerate(CROWD):
        sx, sy = tf(wx, wy)
        if sx < -140 or sx > W + 140:
            continue
        crowd_banana(im, i, fit, sx, sy, hh, k, flip=flip,
                     glow=(NANA, 6) if n == 5 and power > 0.5 else None)

    # the golden banana, waiting on the boards
    blit(im, asset('rave-guide/goldbanana.png'), *tf(165, 432), 49, k)

    # a few pellets fall in FRONT of the floor for depth
    for jx, ph, sp in PELLETS[:3]:
        fall = ((ts * 260 * sp + ph * 640) % 640) - 60
        sx, sy = tf(jx * 0.7, fall)
        blit(im, jelly, sx, sy, 21, k, anchor='mid')

    # ---- the light show ---------------------------------------------------
    wash = (HOT, NANA, PURPLE, COOL, HOT, NANA, PURPLE, OK_)[int(ts / 0.4) % 8]
    im.alpha_composite(Image.new('RGBA', (W, H), wash + (round((26 + 16 * (1 if dropped else 0)) * power),)))

    if dropped and power > 0.5:
        speed_lines(im, seg(t, DROP_AT, 0.585), n=22, seed=31, col=(255, 253, 245), horizontal=False)

    # the strobe: three hits, each a flash + a punch
    hit = max(pulse(t, 0.055, 0.030) * 0.8, pulse(t, 0.30, 0.026) * 0.38,
              pulse(t, DROP_AT, 0.034), pulse(t, 0.885, 0.040))
    beat = max(0.0, math.sin(ts / 0.4 * math.pi)) ** 8 * (0.5 if dropped else 0.4) * power
    im.alpha_composite(Image.new('RGBA', (W, H), (255, 253, 245, round(130 * hit + 28 * beat))))

    # 🔌 THE POWER CUT — the whole club goes down, the breaker stays lit
    if dark > 0.02:
        im.alpha_composite(Image.new('RGBA', (W, H), (5, 4, 10, round(212 * dark))))
        bx, by = tf(152, 92)
        zap = pulse(t, 0.845, 0.02)
        blit(im, asset('rave-guide/breaker.png'), bx, by, 40, k,
             anchor='mid', glow=(NANA, 9))
        if zap > 0:
            im.alpha_composite(Image.new('RGBA', (W, H), (255, 253, 245, round(120 * zap))))
        sparkle_burst(im, bx, by - 24 * k, seg(t, 0.82, 0.87), n=7, dist=70, seed=12)

    # 🎉 lights SLAM back: ring off the stage, sparks, confetti
    sx0, sy0 = tf(0, STAGE_Y + 10)
    impact_ring(im, sx0, sy0, seg(t, 0.878, 0.955), r0=30, r1=340, width=12, col=NANA)
    sparkle_burst(im, sx0, sy0 + 90, seg(t, 0.885, 1.0), n=22, dist=300, seed=5)
    if t > 0.885:
        confetti(im, (t - 0.885) / 0.115, n=42, seed=19)

    impact_ring(im, *tf(0, STAGE_Y + 6), seg(t, DROP_AT, DROP_AT + 0.085), r0=20, r1=330,
                width=10, col=HOT)

    vignette(im, 96)
    im = flicker(im, ts, hz=6.2, depth=0.05)
    im = zoom_punch(im, hit * 0.9)
    im = shake_img(im, hit * 13 + (2.5 if dropped and power > 0.5 else 0))
    im = chroma_split(im, hit * 5)
    im = blink_fade(im, 0.9 * (1 - seg(t, 0.0, 0.032)))
    return im


SCENE = {'name': 'rave', 'secs': SECS, 'fn': fn}
