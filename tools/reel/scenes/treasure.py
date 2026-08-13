# -*- coding: utf-8 -*-
"""🗺 TREASURE HUNT — Captain Sabreface's daily buried treasure, in 5 seconds.

The real mechanic (src/scripts/banana-beach.js): a date-seeded X is buried in
the bay, you turn up the five torn slices of the Captain's chart, the marker
appears, then you walk there and ⛏ DIG at your feet until the sand gives.

   0.00  BEAT 1 — THE CHART. Full-bleed parchment in the game map's own
         palette (parchment, sea band, dashed court, pier + boathouse blocks,
         palm dots, the dashed trail) torn into its five pieces. A bold red
         circle draws itself onto the spot. Camera pushes in. NO glyphs.
   0.30  blink cut
   0.30  BEAT 2 — THE SAND. The pirate banana (tricorn + eyepatch, exactly the
         Captain's draw) walks in at the engine's 168px/s, HARD STOPS, then
         digs four times on the game's 420ms cadence: the squash the game
         animates, sand flying, a hole per dig, the spoil mound growing, and
         the camera thumping in tighter on every strike.
   0.73  BEAT 3 — THE STRIKE. Flash, ring, chroma. The chest (144x108, TRUE
         native size) rises out of the hole behind a golden glow, coins burst
         out on the real 6-frame spin, sparkles, camera pushed all the way in.
"""
import math
import random

from PIL import Image, ImageDraw

from engine import (BAN_H, Cam, W, H, Walk, asset, banana, blink_fade, chroma_split, clamp01,
                    dance_frame, handheld, impact_ring, in_out, out_back, out_cubic, poof, pulse,
                    put_world, seg, shake_img, sparkle_burst, speed_lines, strip_frame, sun_rays,
                    vignette, world_banana, zoom_punch)

SECS = 5.0
CUT = 0.30                       # the blink cut from chart to sand

# ---- the bay, in beach-geo.js world coordinates ---------------------------
WORLD_W, WORLD_H = 2760, 1100
WATER_Y = 292
COURT = (690, 532, 1170, 1012)
BAR = (1700, 760)                # the boathouse — Sabreface's desk
PIER = (1812, 0, 1968, 320)
PALMS = [(120, 542), (196, 494), (1560, 458), (1636, 494), (1418, 838)]
HUT = (1390, 492)
BONFIRE = (215, 655)

DIG_X, DIG_Y = 500, 748          # where the banana stands and digs
SPOT_X, SPOT_Y = 596, 772        # the struck hole / where the chest comes up
MOUND = (516, 806)               # the spoil pile beside the hole

PIRATE = {'hat': 'tricorn', 'glasses': 'eyepatch'}

# ---- the dig beat's clock (seconds) ---------------------------------------
WALK_T0 = 1.46
DIGS = [2.36, 2.78, 3.20, 3.62]  # the game's 420ms dig cooldown
STRIKE = DIGS[-1]
STRIKE_T = STRIKE / SECS
DIG_OFF = [(58, 22), (28, 6), (80, 4), (96, 24)]

_S = {}


# ===========================================================================
# BEAT 1 — the pirate chart
# ===========================================================================
MARG_L, MARG_T = 90, 70
SH_W, SH_H = WORLD_W + 180, WORLD_H + MARG_T + 330      # 2940 x 1500
CIRC_SX, CIRC_SY = SPOT_X + MARG_L, SPOT_Y + MARG_T
CIRC_R = 150

PARCH = (231, 205, 145, 255)
SEA = (99, 182, 212, 255)
SEA_HI = (146, 212, 232, 255)
INK = (122, 59, 18, 255)
INK_L = (156, 106, 52, 255)
SEAM = (150, 125, 80, 255)


def _dash(d, pts, dash, gap, fill, width):
    for a, b in zip(pts, pts[1:]):
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L < 1:
            continue
        ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
        s = 0.0
        while s < L:
            e = min(L, s + dash)
            d.line([a[0] + ux * s, a[1] + uy * s, a[0] + ux * e, a[1] + uy * e],
                   fill=fill, width=width)
            s = e + gap


def _compass(d, cx, cy, r):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=INK, width=9)
    d.ellipse([cx - r * 0.7, cy - r * 0.7, cx + r * 0.7, cy + r * 0.7], outline=INK_L, width=5)
    for k in range(4):
        a = k * math.pi / 2 + math.pi / 4
        tip = (cx + math.cos(a) * r * 0.66, cy + math.sin(a) * r * 0.66)
        l = (cx + math.cos(a + math.pi / 2) * r * 0.15, cy + math.sin(a + math.pi / 2) * r * 0.15)
        rr = (cx + math.cos(a - math.pi / 2) * r * 0.15, cy + math.sin(a - math.pi / 2) * r * 0.15)
        d.polygon([tip, l, rr], fill=INK_L)
    for k in range(4):
        a = k * math.pi / 2 - math.pi / 2
        tip = (cx + math.cos(a) * r * 1.06, cy + math.sin(a) * r * 1.06)
        l = (cx + math.cos(a + math.pi / 2) * r * 0.22, cy + math.sin(a + math.pi / 2) * r * 0.22)
        rr = (cx + math.cos(a - math.pi / 2) * r * 0.22, cy + math.sin(a - math.pi / 2) * r * 0.22)
        d.polygon([tip, l, rr], fill=(168, 44, 30, 255) if k == 0 else INK)


def _scalebar(d, x, y, seg_w, n):
    for k in range(n):
        x0 = x + k * seg_w
        d.rectangle([x0, y, x0 + seg_w, y + 26], fill=INK if k % 2 == 0 else PARCH, outline=INK, width=5)
    d.rectangle([x - 6, y - 16, x + 6, y + 42], fill=INK)
    d.rectangle([x + n * seg_w - 6, y - 16, x + n * seg_w + 6, y + 42], fill=INK)


def sheet():
    """the chart, drawn ONCE at native sheet resolution"""
    if 'sheet' in _S:
        return _S['sheet']
    sh = Image.new('RGBA', (SH_W, SH_H), PARCH)
    d = ImageDraw.Draw(sh)
    rnd = random.Random(1907)
    sea_b = MARG_T + WATER_Y

    # 🟦 the sea band, with swell hatching and a ragged shoreline
    d.rectangle([0, 0, SH_W, sea_b], fill=SEA)
    for k in range(11):
        y = 26 + k * 26
        x = rnd.randrange(0, SH_W - 500)
        _dash(d, [(x, y), (x + rnd.randint(220, 460), y)], 30, 34, SEA_HI, 8)
    shore = []
    for x in range(-20, SH_W + 40, 60):
        shore.append((x, sea_b + 10 * math.sin(x * 0.008) + rnd.randint(-6, 6)))
    d.line(shore, fill=(58, 132, 162, 255), width=11, joint='curve')

    # 🏐 the court — the game draws it dashed
    cx0, cy0 = COURT[0] + MARG_L, COURT[1] + MARG_T
    cx1, cy1 = COURT[2] + MARG_L, COURT[3] + MARG_T
    _dash(d, [(cx0, cy0), (cx1, cy0), (cx1, cy1), (cx0, cy1), (cx0, cy0)], 28, 18,
          (185, 112, 47, 255), 10)

    # 🪵 pier · 🏚 boathouse · 🏖 the hut — solid landmark blocks
    d.rectangle([PIER[0] + MARG_L, 0, PIER[2] + MARG_L, PIER[3] + MARG_T], fill=(138, 90, 43, 255))
    d.rectangle([BAR[0] - 62 + MARG_L, BAR[1] - 42 + MARG_T,
                 BAR[0] + 62 + MARG_L, BAR[1] + 42 + MARG_T], fill=(122, 74, 33, 255))
    d.rectangle([HUT[0] - 46 + MARG_L, HUT[1] - 34 + MARG_T,
                 HUT[0] + 46 + MARG_L, HUT[1] + 34 + MARG_T], fill=(122, 74, 33, 255))

    # 🔥 the fire ring
    bx, by = BONFIRE[0] + MARG_L, BONFIRE[1] + MARG_T
    d.ellipse([bx - 34, by - 34, bx + 34, by + 34], outline=(168, 84, 34, 255), width=9)
    d.ellipse([bx - 11, by - 11, bx + 11, by + 11], fill=(168, 84, 34, 255))

    # 🌴 the palms
    for px, py in PALMS:
        x, y = px + MARG_L, py + MARG_T
        d.ellipse([x - 19, y - 19, x + 19, y + 19], fill=(63, 125, 58, 255))
        d.rectangle([x - 4, y + 14, x + 4, y + 34], fill=(96, 68, 32, 255))

    # 〜 the sand tracks of the bay, as the chart scratches them
    _dash(d, [(150 + MARG_L, 1040 + MARG_T), (330 + MARG_L, 800 + MARG_T),
              (470 + MARG_L, 690 + MARG_T), (700 + MARG_L, 560 + MARG_T),
              (980 + MARG_L, 470 + MARG_T)], 34, 26, INK_L, 8)
    _dash(d, [(560 + MARG_L, 640 + MARG_T), (900 + MARG_L, 620 + MARG_T),
              (1240 + MARG_L, 700 + MARG_T), (1560 + MARG_L, 720 + MARG_T)], 34, 26, INK_L, 8)

    # 🏜 dune hatching so the sand isn't a blank
    for _ in range(320):
        x = rnd.randrange(40, SH_W - 40)
        y = rnd.randrange(sea_b + 60, MARG_T + WORLD_H - 30)
        if abs(x - CIRC_SX) < 250 and abs(y - CIRC_SY) < 210:
            continue
        w = rnd.randint(20, 44)
        d.arc([x - w, y - 14, x + w, y + 14], 200, 340, fill=INK_L, width=4)

    # 〰 the trail from the boathouse to the spot
    _dash(d, [(BAR[0] + MARG_L, BAR[1] + MARG_T),
              (1180 + MARG_L, 560 + MARG_T),
              (860 + MARG_L, 700 + MARG_T),
              (CIRC_SX, CIRC_SY)], 32, 24, INK, 11)

    # 🧭 the chart's furniture, down in the blank margin (no glyphs anywhere)
    _compass(d, 330 + MARG_L, 1250 + MARG_T, 118)
    _scalebar(d, 1080 + MARG_L, 1250 + MARG_T, 96, 6)
    for k in range(7):
        y = 1120 + MARG_T + k * 4
        _dash(d, [(1900 + MARG_L, y + 40 * k), (2600 + MARG_L, y + 40 * k)], 40, 34, INK_L, 6)

    # 🍂 parchment grain (opaque — ImageDraw writes raw pixels on RGBA)
    for _ in range(9000):
        x, y = rnd.randrange(SH_W), rnd.randrange(SH_H)
        if y < sea_b:
            continue
        r = rnd.choice([3, 4, 5, 7])
        c = rnd.choice([(219, 191, 130), (241, 219, 168), (206, 176, 120), (226, 198, 138)])
        d.rectangle([x, y, x + r, y + r], fill=c + (255,))
    for _ in range(11):                       # age stains
        x, y = rnd.randrange(SH_W), rnd.randrange(sea_b, SH_H)
        r = rnd.randint(50, 120)
        d.ellipse([x - r, y - r * 0.7, x + r, y + r * 0.7], outline=(220, 194, 138, 255), width=6)

    # ✂ the five torn pieces — the seams the game cuts the map into
    for k in range(1, 5):
        x = round(k * SH_W / 5)
        for y in range(0, SH_H, 16):
            j = rnd.randint(-9, 9)
            d.rectangle([x + j - 5, y, x + j + 4, y + 16], fill=SEAM)
            d.rectangle([x + j + 5, y, x + j + 12, y + 16], fill=(243, 222, 176, 255))

    d.rectangle([0, 0, SH_W - 1, SH_H - 1], outline=(90, 62, 26, 255), width=16)
    _S['sheet'] = sh
    return sh


def draw_circle(im, cx, cy, r, prog, lw, col=(196, 36, 26)):
    """the bold red ring, drawn on by hand"""
    if prog <= 0:
        return
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    a0, span, n = -2.42, 6.95, 96
    m = max(2, int(n * prog))
    pts = []
    for k in range(m + 1):
        a = a0 + span * prog * (k / m)
        rr = r * (1 + 0.055 * math.sin(a * 3.0 + 1.2) + 0.028 * math.sin(a * 5.4))
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.94))
    d.line(pts, fill=col + (255,), width=lw, joint='curve')
    im.alpha_composite(ov)


def glow(im, cx, cy, r, a, col=(255, 206, 92), squash=0.88):
    if a <= 0 or r <= 1:
        return
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    n = 14
    step = max(1, round(a / n))
    for k in range(n, 0, -1):
        rr = r * k / n
        d.ellipse([cx - rr, cy - rr * squash, cx + rr, cy + rr * squash], fill=col + (step,))
    im.alpha_composite(ov)


def beat_chart(t, i):
    p = in_out(seg(t, 0.02, CUT))
    s = 0.645 + 0.16 * p
    hx, hy = handheld(t * SECS, amp=2.6, seed=1.4)
    tx = 300 - 26 * p + hx
    ty = 528 - 58 * p + hy

    fx0 = max(W - SH_W * s, min(0.0, tx - CIRC_SX * s))
    fy0 = max(H - SH_H * s, min(0.0, ty - CIRC_SY * s))

    box = (round(-fx0 / s), round(-fy0 / s), round((W - fx0) / s), round((H - fy0) / s))
    im = sheet().crop(box).resize((W, H), Image.NEAREST)

    ccx, ccy = fx0 + CIRC_SX * s, fy0 + CIRC_SY * s
    glow(im, ccx, ccy, 320 * s, round(34 + 40 * p), col=(255, 228, 156), squash=1.0)

    prog = out_cubic(seg(t, 0.085, 0.245))
    lw = max(3, round(16 * s))
    if prog > 0.98:
        hit = pulse(t, 0.255, 0.05)
        draw_circle(im, ccx, ccy, CIRC_R * s * (1 + 0.11 * hit), 1.0,
                    max(2, round(lw * 0.62)), col=(228, 78, 54))
    draw_circle(im, ccx, ccy, CIRC_R * s, prog, lw)

    sparkle_burst(im, ccx, ccy, seg(t, 0.245, 0.30), n=13, dist=210, seed=21,
                  color=(255, 118, 74, 255))
    vignette(im, 104)

    hit = pulse(t, 0.255, 0.045)
    im = zoom_punch(im, hit * 0.85)
    im = shake_img(im, hit * 9)
    im = chroma_split(im, hit * 6)
    return im


# ===========================================================================
# BEAT 2/3 — the sand
# ===========================================================================
_RC = random.Random(4041)
COIN_G = 940.0
# a fountain with PLANNED landings — every coin is aimed at its own patch of
# sand around the lid, so nine 44px coins never pile into one gold smear.
COIN_REST = [(-140, 18), (2, 20), (-84, 26), (56, 30),
             (-40, 48), (30, 54), (-112, 58), (-62, 78)]
COINS = []
for _k, (_rx, _dy) in enumerate(COIN_REST):
    _vy = -_RC.uniform(250, 355)
    _ox = _RC.uniform(-22, 24)
    _land = (-_vy + math.sqrt(_vy * _vy + 4 * COIN_G * (_dy + 92))) / (2 * COIN_G)
    COINS.append(((_rx - _ox) / _land, _vy, _ox, _dy, _land,
                  _RC.randrange(6), _RC.uniform(0, 0.24)))

SAND_L = (240, 212, 158, 255)
SAND_M = (223, 189, 134, 255)
SAND_D = (198, 163, 110, 255)
FLY = [(255, 246, 222, 255), (246, 220, 168, 255), (203, 165, 108, 255), (176, 138, 88, 255)]

WALK = Walk([(392, 794), (DIG_X, DIG_Y)], pause=2.0, start_pause=0.0)


def squash_at(ts):
    """the game's own dig animation — scaleY down, then ease back over 260ms"""
    sq = 1.0
    for d0 in DIGS:
        u = (ts - d0) / 0.26
        if 0.0 <= u <= 1.0:
            sq = min(sq, 0.80 + 0.20 * out_cubic(u))
    return sq


def dig_banana(im, cam, i, wx, wy, sq):
    b = banana(dance_frame(i), PIRATE, height=max(2, round(BAN_H * cam.k)))
    if sq < 0.999:
        nh = max(2, round(b.height * sq))
        nw = max(2, round(b.width * (1 + (1 - sq) * 0.5)))
        b = b.resize((nw, nh), Image.NEAREST)
    x, y = cam.tf(wx, wy)
    im.alpha_composite(b, (round(x - b.width / 2), round(y - b.height)))


def hole(plate, x, y, grow=1.0):
    if grow <= 0.02:
        return
    spr = asset('beach/dig-hole.png')          # 22x16, the page sizes it to ~25 world px
    w = max(3, round(spr.width * 1.16 * grow))
    h = max(2, round(spr.height * 1.16 * grow))
    plate.alpha_composite(spr.resize((w, h), Image.NEAREST), (round(x - w / 2), round(y - h * 0.6)))


def mound(plate, x, y, grow):
    if grow <= 0:
        return
    d = ImageDraw.Draw(plate)
    w = 34 + 46 * grow
    h = 8 + 20 * grow
    d.ellipse([x - w * 0.68, y - h * 0.40, x + w * 0.68, y + h * 0.40], fill=SAND_D)
    d.ellipse([x - w * 0.5, y - h * 1.05, x + w * 0.5, y + h * 0.18], fill=SAND_M)
    d.ellipse([x - w * 0.30, y - h * 1.45, x + w * 0.18, y - h * 0.28], fill=SAND_L)


def sand_fly(im, cam, hx, hy, u, seed):
    if u <= 0 or u >= 1:
        return
    rnd = random.Random(seed)
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for _ in range(18):
        a = math.radians(rnd.uniform(196, 344))
        sp = rnd.uniform(150, 360)
        size = rnd.uniform(3.4, 7.2)
        col = rnd.choice(FLY)
        tt = u * 0.44
        wx = hx + math.cos(a) * sp * tt
        wy = hy + math.sin(a) * sp * tt + 980 * tt * tt
        sx, sy = cam.tf(wx, wy)
        r = max(1.5, size * cam.k * 0.5)
        d.rectangle([sx - r, sy - r, sx + r, sy + r], fill=col[:3] + (round(255 * (1 - u * u)),))
    im.alpha_composite(ov)


def put_chest(im, cam, wx, wy, reveal, lift):
    spr = asset('banana-stand/chest.png')      # 144x108 — TRUE native size
    w = max(4, round(spr.width * cam.k))
    h = max(4, round(spr.height * cam.k))
    s = spr.resize((w, h), Image.NEAREST)
    vis = max(1, round(h * clamp01(reveal)))
    x, y = cam.tf(wx, wy)
    im.alpha_composite(s.crop((0, 0, w, vis)), (round(x - w / 2), round(y - vis - lift * cam.k)))


def fly_coins(im, cam, ts, t0):
    u0 = ts - t0
    if u0 <= 0:
        return
    for vx, vy, ox, dy, land, f0, delay in COINS:
        u = u0 - delay
        if u <= 0:
            continue
        down = u >= land
        y = SPOT_Y + dy if down else SPOT_Y - 92 + vy * u + COIN_G * u * u
        wx = SPOT_X + ox + vx * min(u, land)
        fr = (0 if f0 % 2 else 5) if down else int(u * 15 + f0) % 6
        put_world(im, cam, strip_frame('banana-stand/coin-spin.png', 6, fr),
                  wx, y, native=1.0, anchor='center')


def beat_sand(t, i):
    ts = t * SECS
    plate = asset('beach/beach.png').copy()
    nd = sum(1 for d0 in DIGS if ts >= d0)

    # ⛏ the hunt's older holes — this banana has been working the bay a while
    for hx0, hy0 in [(430, 822), (612, 700), (546, 830), (372, 706), (664, 792)]:
        hole(plate, hx0, hy0)

    if ts >= STRIKE:                                   # the sand the chest breaks open
        d = ImageDraw.Draw(plate)
        g = out_cubic(min(1.0, (ts - STRIKE) / 0.30))
        d.ellipse([SPOT_X - 64 * g, SPOT_Y - 17 * g, SPOT_X + 64 * g, SPOT_Y + 17 * g], fill=SAND_D)
        d.ellipse([SPOT_X - 44 * g, SPOT_Y - 12 * g, SPOT_X + 44 * g, SPOT_Y + 12 * g],
                  fill=(148, 112, 66, 255))
    for k, d0 in enumerate(DIGS):
        if ts >= d0:
            ox, oy = DIG_OFF[k]
            hole(plate, DIG_X + ox, DIG_Y + oy, out_cubic(min(1.0, (ts - d0) / 0.18)))
    mound(plate, MOUND[0], MOUND[1], min(1.0, nd / 4.0))

    # 🎥 the camera: wide on the walk, tightening with every dig, hard in on the find
    tight = in_out(seg(t, 0.44, 0.72))
    push = in_out(seg(t, 0.70, 0.92))
    hx, hy = handheld(ts, amp=2.2, seed=0.6)
    vw = 312 - 34 * tight - 20 * push
    # ⚠️ the right edge must stay clear of the court's painted line at x=690
    cam = Cam(plate, 508 + 34 * tight + 10 * push + hx, 726 - 8 * tight + 24 * push + hy, vw)

    thump = 0.0
    for k, d0 in enumerate(DIGS):
        thump = max(thump, pulse(t, d0 / SECS, 0.022) * (7 + 3 * k))
    thump = max(thump, pulse(t, STRIKE_T, 0.05) * 22)
    cam.shake_amt = thump * 0.55
    im, _ = cam.shot()

    # ✨ the golden light coming up out of the hole
    gl = out_cubic(seg(t, 0.732, 0.90))
    if gl > 0:
        gx, gy = cam.tf(SPOT_X, SPOT_Y - 56)
        sun_rays(im, gx, gy, ts, n=18, col=(255, 226, 128), alpha=round(48 * gl), spin=0.35)
        glow(im, gx, gy, 300 * gl, round(190 * gl))

    # 🚶 the pirate: the game's 168px/s, a hard stop, then the dig
    wx, wy, moving = WALK.at(ts - WALK_T0)
    if moving:
        world_banana(im, cam, i, PIRATE, wx, wy, lift=-abs(math.sin(i * 0.5)) * 3)
    else:
        dig_banana(im, cam, i, wx, wy, squash_at(ts))

    # 🧰 the chest, rising out of the struck hole at TRUE size
    rev = out_cubic(seg(t, 0.732, 0.832))
    if rev > 0:
        hop = out_back(seg(t, 0.832, 0.91)) * 9 * (1 - seg(t, 0.91, 1.0) * 0.5)
        put_chest(im, cam, SPOT_X, SPOT_Y, rev, hop)

    # 💥 sand off every dig
    for k2, d0 in enumerate(DIGS):
        ox, oy = DIG_OFF[k2]
        px, py = cam.tf(DIG_X + ox, DIG_Y + oy)
        poof(im, px, py, (ts - d0) / 0.42, seed=51 + k2 * 5, big=0.52 * cam.k)
        sand_fly(im, cam, DIG_X + ox, DIG_Y + oy, (ts - d0) / 0.40, seed=31 + k2 * 7)

    sx, sy = cam.tf(SPOT_X, SPOT_Y)
    impact_ring(im, sx, sy, seg(t, STRIKE_T, STRIKE_T + 0.09), r1=210, width=8)
    impact_ring(im, sx, sy, seg(t, 0.744, 0.87), r1=300, width=9, col=(255, 214, 74))
    impact_ring(im, sx, sy, seg(t, 0.828, 0.95), r1=340, width=10, col=(255, 236, 150))
    fly_coins(im, cam, ts, STRIKE + 0.30)
    sparkle_burst(im, sx, sy - 130, seg(t, 0.752, 0.90), n=20, dist=230, seed=8)
    sparkle_burst(im, sx, sy - 80, seg(t, 0.90, 1.22), n=16, dist=300, seed=15)

    speed_lines(im, seg(t, STRIKE_T - 0.004, STRIKE_T + 0.042), n=16, seed=6, horizontal=False)
    fl = pulse(t, STRIKE_T + 0.004, 0.018)
    if fl > 0:
        im.alpha_composite(Image.new('RGBA', im.size, (255, 248, 214, round(160 * fl))))

    vignette(im, 64)
    im = zoom_punch(im, thump / 22)
    im = shake_img(im, thump)
    im = chroma_split(im, fl * 4)
    return im


# ===========================================================================
def fn(t, i):
    im = beat_chart(t, i) if t < CUT else beat_sand(t, i)
    im = blink_fade(im, pulse(t, CUT, 0.014))              # the hard cut
    im = blink_fade(im, 0.72 * (1 - seg(t, 0.0, 0.035)))   # clean in
    return im


SCENE = {'name': 'treasure', 'secs': SECS, 'fn': fn}
