# -*- coding: utf-8 -*-
"""🎪 THE PIER STALLS — three midway games, three wins, three hard cuts.

The beach's midway (beach-geo STALLS) opens its games as a PANEL over the live
world — "the beach is still there behind you" (banana-beach.js). So every beat
here is exactly that: the real plate cropped tight on the real booth, scrimmed
the way the game scrims it, with the stall's play surface over it in the
stall's own colours. Same frame, different game — the midway's own doctrine.

  0.00-0.33  🦆 HOOK-A-DUCK   ducks bob → the hook drops → one lifts, tickets
  0.34-0.66  🦀 WHACK-A-CRAB  crabs pop → the tap lands → BONK, stars, tickets
  0.67-1.00  🥥 COCONUT HUT   aim arc → the ball lobs → a coconut flies, confetti

No banana walks here on purpose (law 1): these are counter close-ups, so the
motion is the games. The one banana is the Coconut Hut's KEEPER, held on frame
4 behind his desk — the exact frame drawCocoVendor picks, and for its reason:
any other frame throws a hand up into the play area, and cycling them makes the
bbox (and so his size) jump every 100ms.

⚠️ PIL trap that cost a pass: ImageDraw REPLACES alpha, it does not blend. A
translucent fill drawn straight onto an RGBA layer punches a hole in it. Every
translucent mark here goes through _ov()/alpha_composite; everything drawn
directly is fully opaque.
"""
import math
import random

from PIL import Image, ImageDraw, ImageFilter

from engine import (Cam, asset, banana, blink_fade, chroma_split, clamp01, confetti, handheld,
                    impact_ring, in_out, out_back, out_cubic, poof, pulse, seg, shake_img,
                    sparkle_burst, strip_frame, vignette, zoom_punch)

SECS = 4.8

# ── the booth card (screen px) ────────────────────────────────────────────────
CX0, CY0, CX1, CY1 = 34, 176, 506, 824
BRD, AWN, DESK = 5, 48, 58
SX0, SY0, SX1, SY1 = CX0, CY0 + AWN + 4, CX1, CY1 - DESK
SW, SH = SX1 - SX0, SY1 - SY0

CARD_BG = (23, 18, 31, 255)                       # .bh-card #17121f
AWN_A, AWN_B = (226, 59, 59, 255), (253, 246, 230, 255)
DESK_A, DESK_B, DESK_TOP = (58, 43, 24, 255), (44, 33, 19, 255), (74, 56, 32, 255)
BLACK = (0, 0, 0, 255)
GOLD = (255, 225, 53)

BEAT_CAM = [(2140, 556), (2430, 556), (2140, 838)]   # the three real counters
BEATS = ((0.0, 0.335), (0.335, 0.665), (0.665, 1.0))

# 3x2 cells — the pond and the crab holes share this grid
COLS = [SX0 + 26 + 70 + k * 140 for k in range(3)]
ROWS = [SY0 + 34 + 117 + r * 235 for r in range(2)]
CELLS = [(COLS[k % 3], ROWS[k // 3]) for k in range(6)]
DUCK_HERO, CRAB_HERO = 4, 4

# the hut's pitch, straight out of cocoBuild()
RAIL_Y = [SY0 + round(SH * 0.19), SY0 + round(SH * 0.36)]
COCOS = [(0, 0.22), (1, 0.42), (0, 0.70), (1, 0.90)]
BALL_X, BALL_Y = SX0 + round(SW * 0.63), SY0 + round(SH * 0.76)
COCO_HERO = 0
LAUNCH, LAND = 0.34, 0.54

# COCO_SVG / CBALL_SVG — the hut's own 12² and 10² pixel art
COCO_PX = [(3, 0, 6, 1, '5a3a1c'), (2, 1, 8, 1, '6b4a2b'), (1, 2, 10, 2, '6b4a2b'),
           (0, 4, 12, 4, '6b4a2b'), (1, 8, 10, 2, '5a3a1c'), (2, 10, 8, 1, '4a3018'),
           (3, 11, 6, 1, '4a3018'), (2, 2, 3, 2, '7d5836'), (4, 5, 1, 1, '2a1a0c'),
           (7, 5, 1, 1, '2a1a0c'), (5, 7, 2, 1, '2a1a0c')]
BALL_PX = [(3, 0, 4, 1, 'b89a5e'), (1, 1, 8, 1, 'd8c090'), (0, 2, 10, 6, 'd8c090'),
           (1, 8, 8, 1, 'b89a5e'), (3, 9, 4, 1, 'b89a5e'), (2, 2, 3, 2, 'efdcae'),
           (6, 5, 2, 2, 'a5854a')]

_C = {}


# ── makers ────────────────────────────────────────────────────────────────────
def _ov(size):
    im = Image.new('RGBA', size, (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def _hex(h):
    return tuple(int(h[j:j + 2], 16) for j in (0, 2, 4)) + (255,)


def _pixart(px, side, out, tag):
    key = ('px', tag, out)
    if key not in _C:
        im = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        for x, y, w, h, c in px:
            d.rectangle([x, y, x + w - 1, y + h - 1], fill=_hex(c))
        _C[key] = _outline(im.resize((out, out), Image.NEAREST), 3)
    return _C[key]


def _outline(spr, w=3):
    """a hard black keyline — the hut's wood-on-wood needs it to read"""
    out = Image.new('RGBA', (spr.width + w * 2, spr.height + w * 2), (0, 0, 0, 0))
    sil = Image.new('RGBA', spr.size, BLACK)
    sil.putalpha(spr.getchannel('A'))
    for dx in range(-w, w + 1):
        for dy in range(-w, w + 1):
            if dx * dx + dy * dy <= w * w:
                out.alpha_composite(sil, (w + dx, w + dy))
    out.alpha_composite(spr, (w, w))
    return out


def _vgrad(w, h, top, bot, key):
    if key not in _C:
        im = Image.new('RGBA', (w, h))
        d = ImageDraw.Draw(im)
        for y in range(h):
            f = y / max(1, h - 1)
            d.line([0, y, w, y],
                   fill=tuple(round(a + (b - a) * f) for a, b in zip(top, bot)) + (255,))
        _C[key] = im
    return _C[key]


def _pond_glow():
    """.bh-pond's radial: light pooling at the top-centre of the water"""
    if 'pondglow' not in _C:
        m = Image.new('L', (SW, SH), 0)
        dm = ImageDraw.Draw(m)
        for n in range(14):
            f = n / 13.0
            rw, rh = SW * (1.15 - f * 0.85), SH * (0.95 - f * 0.72)
            dm.ellipse([SW / 2 - rw, -SH * 0.16 - rh, SW / 2 + rw, -SH * 0.16 + rh],
                       fill=round(10 + n * 5))
        g = Image.new('RGBA', (SW, SH), (128, 214, 226, 255))
        g.putalpha(m.filter(ImageFilter.GaussianBlur(34)))
        _C['pondglow'] = g
    return _C['pondglow']


def _sprite(path, n, idx, scale, trim=True):
    key = ('sp', path, idx % n, scale)
    if key not in _C:
        s = strip_frame(path, n, idx)
        if trim:
            s = s.crop(s.getbbox())
        _C[key] = s.resize((max(1, round(s.width * scale)), max(1, round(s.height * scale))),
                           Image.NEAREST)
    return _C[key]


def blit(im, spr, cx, cy, rot=0.0, alpha=1.0, sy=1.0):
    if alpha <= 0.02:
        return
    s = spr
    if sy != 1.0:
        s = s.resize((s.width, max(1, round(s.height * sy))), Image.NEAREST)
    if rot:
        s = s.rotate(rot, expand=True, resample=Image.NEAREST)
    if alpha < 1.0:
        s = s.copy()
        s.putalpha(s.getchannel('A').point(lambda p: round(p * alpha)))
    im.alpha_composite(s, (round(cx - s.width / 2), round(cy - s.height / 2)))


# ── the booth shell ───────────────────────────────────────────────────────────
def booth(im, stage):
    d = ImageDraw.Draw(im)
    d.rectangle([CX0 + 9, CY0 + 9, CX1 + 9 + BRD, CY1 + 9 + BRD], fill=BLACK)
    d.rectangle([CX0 - BRD, CY0 - BRD, CX1 + BRD, CY1 + BRD], fill=BLACK)
    d.rectangle([CX0, CY0, CX1, CY1], fill=CARD_BG)
    for k in range(11):                                   # the striped awning
        x0 = CX0 + (CX1 - CX0) * k / 11.0
        x1 = CX0 + (CX1 - CX0) * (k + 1) / 11.0
        d.rectangle([x0, CY0, x1, CY0 + AWN], fill=AWN_A if k % 2 == 0 else AWN_B)
    d.rectangle([CX0, CY0 + AWN, CX1, CY0 + AWN + 3], fill=BLACK)
    im.alpha_composite(stage, (SX0, SY0))
    d.rectangle([SX0, SY0, SX1 - 1, SY1 - 1], outline=BLACK, width=4)
    d.rectangle([CX0, SY1, CX1, CY1], fill=DESK_A)        # the counter
    x = CX0
    while x + 26 < CX1:
        d.rectangle([x + 26, SY1, min(CX1, x + 51), CY1], fill=DESK_B)
        x += 52
    d.rectangle([CX0, SY1, CX1, SY1 + 5], fill=DESK_TOP)
    d.rectangle([CX0, SY1 + 6, CX1, SY1 + 9], fill=(26, 19, 11, 255))


def ticket_badge(im, pop):
    tk = _sprite('banana-stand/ticket.png', 1, 0, 0.62, trim=False)
    cx, cy = CX1 - 78, SY1 + DESK // 2 + 4
    d = ImageDraw.Draw(im)
    d.rectangle([cx - 58, cy - 27, cx + 58, cy + 27], fill=BLACK)
    d.rectangle([cx - 55, cy - 24, cx + 55, cy + 24], fill=(20, 15, 27, 255))
    if pop > 0:
        ov, od = _ov(im.size)
        od.rectangle([cx - 55, cy - 24, cx + 55, cy + 24], fill=GOLD + (round(120 * pop),))
        im.alpha_composite(ov)
    blit(im, tk, cx, cy, rot=-4 * pop, sy=1.0 + 0.16 * pop)


def ticket_burst(im, cx, cy, p, n=4, seed=1, hold=False):
    """the payout: the stand's own ticket sprite, fanning out of the win"""
    if p <= 0 or p >= 1:
        return
    tk = _sprite('banana-stand/ticket.png', 1, 0, 0.72, trim=False)
    rnd = random.Random(seed)
    for k in range(n):
        a = -math.pi / 2 + (k - (n - 1) / 2.0) * 0.66 + rnd.uniform(-0.07, 0.07)
        dist = (168 + rnd.uniform(0, 82)) * out_cubic(clamp01(p * 2.1))
        x = cx + math.cos(a) * dist
        y = cy + math.sin(a) * dist + 120 * p * p
        # they FADE UP as they leave, or the whole fan piles on the win itself
        blit(im, tk, x, y, rot=math.sin(p * 5 + k * 2.1) * 14 + (k - 1.5) * 9,
             alpha=clamp01(p * 8.0) * (1.0 if hold else clamp01((1 - p) * 7.0)))


def tap_ring(im, cx, cy, p, col=(255, 253, 245)):
    """a tap landing: rings closing IN — the opposite of an impact ring"""
    if p <= 0 or p >= 1:
        return
    ov, d = _ov(im.size)
    for o in (0.0, 0.28):
        q = clamp01((p - o) / (1 - o))
        r = 140 * (1 - out_cubic(q)) + 14
        d.ellipse([cx - r, cy - r, cx + r, cy + r],
                  outline=col + (round(230 * (1 - q * q)),), width=max(1, round(7 * (1 - q))))
    im.alpha_composite(ov)


# ── 🦆 BEAT ONE — HOOK-A-DUCK ─────────────────────────────────────────────────
def stage_duck(u, i):
    st = _vgrad(SW, SH, (71, 160, 179), (27, 84, 104), 'pond').copy()
    st.alpha_composite(_pond_glow())
    ov, d = _ov((SW, SH))
    off = (u * 92) % 30                                   # .bh-pond::before, 114deg
    x = -SH
    while x < SW + SH:
        d.line([x + off, 0, x + off + SH * 0.48, SH], fill=(255, 255, 255, 13), width=2)
        x += 30
    d.rectangle([0, SH - 34, SW, SH], fill=(0, 0, 0, 46))

    hooked = seg(u, 0.42, 0.60)
    for k, (cx, cy) in enumerate(CELLS):
        px, py = cx - SX0, cy - SY0
        hero, fl = k == DUCK_HERO, math.sin(u * 6.4 + k * 0.9)
        a = 1.0 - (0.45 * hooked if (hooked > 0 and not hero) else 0.0)
        ry = py + 40
        if hero and hooked > 0:                           # the splash it leaves behind
            for w in (0.0, 0.34):
                q = clamp01((hooked - w) / (1 - w))
                sw = 40 + 180 * q
                d.ellipse([px - sw, ry - 10 - q * 5, px + sw, ry + 10 + q * 5],
                          outline=(232, 250, 255, round(215 * (1 - q))), width=max(1, round(6 - q * 4)))
        else:
            rw = 46 + fl * 6
            d.ellipse([px - rw, ry - 9, px + rw, ry + 9], fill=(255, 255, 255, round(46 * a)))
            d.ellipse([px - rw * 0.55, ry - 4, px + rw * 0.55, ry + 4],
                      fill=(235, 250, 255, round(80 * a)))
    st.alpha_composite(ov)

    # 🪝 the line drops BEHIND the ducks it passes, the hook itself in front
    hx, hy = CELLS[DUCK_HERO][0] - SX0, CELLS[DUCK_HERO][1] - SY0
    drop = out_cubic(seg(u, 0.18, 0.42))
    lift = 96 * out_back(hooked)
    ytip = (hy - 46) * drop - lift
    if drop > 0:
        d2 = ImageDraw.Draw(st)
        d2.rectangle([hx + 11, 0, hx + 22, ytip + 4], fill=BLACK)
        d2.rectangle([hx + 14, 0, hx + 19, ytip], fill=(230, 230, 242, 255))

    for k, (cx, cy) in enumerate(CELLS):                  # the ducks, over the water
        px, py = cx - SX0, cy - SY0
        hero, fl = k == DUCK_HERO, math.sin(u * 6.4 + k * 0.9)
        lift2, rot = fl * 5.0, fl * 4.0
        a = 1.0 - (0.45 * hooked if (hooked > 0 and not hero) else 0.0)
        if hero:
            lift2 = fl * 5.0 - 96 * out_back(hooked)
            rot = fl * 4.0 * (1 - hooked) - 10 * math.sin(hooked * 6.3) * (1 - hooked)
        blit(st, _sprite('beach/duck.png', 2, (i // 5 + k) % 2, 3.4), px, py + lift2,
             rot=rot, alpha=a)

    if drop > 0:
        d3 = ImageDraw.Draw(st)
        d3.arc([hx + 1, ytip - 16, hx + 33, ytip + 16], 340, 200, fill=BLACK, width=10)
        d3.arc([hx + 3, ytip - 14, hx + 31, ytip + 14], 340, 200,
               fill=(208, 208, 224, 255), width=5)
    return st


def beat_duck(im, u, i):
    hx, hy = CELLS[DUCK_HERO]
    tap_ring(im, hx, hy - 6, seg(u, 0.02, 0.17))          # you pick your duck first
    sparkle_burst(im, hx, hy - 60, seg(u, 0.46, 0.92), n=16, dist=200, seed=21)
    ticket_burst(im, hx, hy - 78, seg(u, 0.50, 1.0), n=4, seed=7)
    return pulse(u, 0.44, 0.05)


# ── 🦀 BEAT TWO — WHACK-A-CRAB ────────────────────────────────────────────────
POPS = [(0, 0.02, 0.30), (5, 0.06, 0.34), (2, 0.16, 0.44), (3, 0.24, 0.54), (1, 0.32, 0.60),
        (0, 0.62, 0.92), (5, 0.70, 0.97), (2, 0.78, 0.99), (3, 0.84, 0.99)]


def stage_crab(u, i):
    st = _vgrad(SW, SH, (216, 180, 120), (198, 154, 88), 'sand').copy()
    d = ImageDraw.Draw(st)
    holes = []
    for cx, cy in CELLS:
        px, py = cx - SX0, cy - SY0 + 52
        d.ellipse([px - 56, py - 20, px + 56, py + 20], fill=(42, 28, 13, 255))
        d.ellipse([px - 46, py - 13, px + 46, py + 13], fill=(58, 40, 20, 255))
        holes.append((px, py))
    ov, od = _ov((SW, SH))
    for px, py in holes:
        od.arc([px - 56, py - 24, px + 56, py + 16], 200, 340, fill=(255, 244, 214, 95), width=3)
    st.alpha_composite(ov)

    ups = {k: 0.0 for k in range(6)}
    for k, a, b in POPS:
        ups[k] = max(ups[k], min(out_back(seg(u, a, a + 0.07)),
                                 1 - out_cubic(seg(u, b, b + 0.06))))
    bonk = seg(u, 0.50, 0.66)
    ups[CRAB_HERO] = max(0.0, out_back(seg(u, 0.28, 0.39)) - bonk * 1.2)

    for k, (px, py) in enumerate(holes):
        up = clamp01(ups[k])
        if up <= 0.01:
            continue
        squash = 1.0 - 0.42 * bonk if k == CRAB_HERO else 1.0
        spr = _sprite('beach/a-crab.png', 10, i // 3 + k, 2.5)
        cw, ch = spr.width, max(2, round(spr.height * squash))
        top = py + 10 - ch * up
        keep = max(0, min(ch, round(py + 12 - top)))
        if keep <= 2:
            continue
        st.alpha_composite(spr.resize((cw, ch), Image.NEAREST).crop((0, 0, cw, keep)),
                           (round(px - cw / 2), round(top)))

    for px, py in holes:                                  # the near lip, over the crab
        d.chord([px - 56, py - 20, px + 56, py + 20], 0, 180, fill=(42, 28, 13, 255))
        d.chord([px - 46, py - 13, px + 46, py + 13], 0, 180, fill=(58, 40, 20, 255))
    ov2, od2 = _ov((SW, SH))
    od2.rectangle([0, 0, SW - 1, SH - 1], outline=(120, 80, 30, 110), width=4)
    st.alpha_composite(ov2)
    return st


def beat_crab(im, u, i):
    hx, hy = CELLS[CRAB_HERO][0], CELLS[CRAB_HERO][1] + 6
    tap_ring(im, hx, hy, seg(u, 0.34, 0.52))
    impact_ring(im, hx, hy + 30, seg(u, 0.50, 0.74), r0=12, r1=215, col=(255, 236, 160), width=9)
    poof(im, hx, hy + 34, seg(u, 0.50, 0.76), seed=6, big=0.9)
    sparkle_burst(im, hx, hy, seg(u, 0.51, 0.90), n=18, dist=215, seed=33,
                  color=(255, 253, 245, 255))
    ticket_burst(im, hx, hy - 44, seg(u, 0.53, 1.0), n=4, seed=4)
    return pulse(u, 0.52, 0.05)


# ── 🥥 BEAT THREE — COCONUT HUT ───────────────────────────────────────────────
def coco_x(idx, u):
    """the coconuts roam their shelf, the way cocoBuild sets them wandering"""
    return SX0 + SW * COCOS[idx][1] + math.sin(u * 2.3 + idx * 1.7) * 46


def arc_at(p):
    """the lob: up out of the pitch, over, and down onto the hero coconut"""
    x1 = coco_x(COCO_HERO, LAND)
    y1 = RAIL_Y[COCOS[COCO_HERO][0]] - 22
    return (BALL_X + (x1 - BALL_X) * p, BALL_Y + (y1 - BALL_Y) * p - 172 * 4 * p * (1 - p))


def stage_coco(u, i):
    st = Image.new('RGBA', (SW, SH), (0, 0, 0, 0))
    d = ImageDraw.Draw(st)
    x = 0                                                 # the plank back wall
    while x < SW:
        d.rectangle([x, 0, x + 25, SH], fill=(107, 86, 23, 255))
        d.rectangle([x + 26, 0, x + 29, SH], fill=(74, 58, 13, 255))
        d.rectangle([x + 30, 0, x + 55, SH], fill=(99, 80, 15, 255))
        d.rectangle([x + 56, 0, x + 59, SH], fill=(74, 58, 13, 255))
        x += 60
    ov, od = _ov((SW, SH))
    od.rectangle([0, 0, SW, SH * 0.34], fill=(0, 0, 0, 42))
    st.alpha_composite(ov)
    # 🥥 the keeper, big and far left behind his counter. Frame 4 with a white
    # backwards cap and no glasses, held still — drawCocoVendor picks exactly
    # that frame because any raised hand pokes into the play area.
    kb = banana(4, {'hat': 'backwardscap'}, height=352)
    st.alpha_composite(kb.crop((0, 0, kb.width, min(kb.height, 206))),
                       (round(SW * 0.17 - kb.width / 2), SH - 206))
    for ry in RAIL_Y:                                     # the two shelves
        y = ry - SY0
        d.rectangle([12, y - 3, SW - 12, y + 13], fill=BLACK)
        d.rectangle([15, y, SW - 15, y + 10], fill=(88, 66, 38, 255))
        d.rectangle([15, y, SW - 15, y + 3], fill=(122, 90, 46, 255))
        d.rectangle([15, y + 14, SW - 15, y + 18], fill=(38, 28, 14, 255))

    # ⬇ everything that PLAYS lives inside the pitch, so it can never sail out
    # over the awning — the stage is the clip.
    coco = _pixart(COCO_PX, 12, 54, 'coco')
    ball = _pixart(BALL_PX, 10, 58, 'ball')
    knock = seg(u, LAND, 1.0)
    for k in range(len(COCOS)):
        cx, cy = coco_x(k, u) - SX0, RAIL_Y[COCOS[k][0]] - 22 - SY0
        if k == COCO_HERO and knock > 0:                  # knocked clean off its post
            blit(st, coco, cx - 150 * knock, cy - 380 * knock + 980 * knock * knock,
                 rot=-knock * 600, alpha=clamp01(2.2 - knock * 1.8))
        else:
            blit(st, coco, cx, cy)

    show = seg(u, 0.03, 0.18) * (1 - seg(u, LAUNCH - 0.05, LAUNCH))   # the drag-aim guide
    if show > 0:
        for k in range(18):
            p = (k + 1) / 19.0
            if p > show:
                break
            ax, ay = arc_at(p)
            ax, ay = ax - SX0, ay - SY0
            d.ellipse([ax - 7, ay - 7, ax + 7, ay + 7], fill=BLACK)
            d.ellipse([ax - 5, ay - 5, ax + 5, ay + 5], fill=GOLD + (255,))

    fp = seg(u, LAUNCH, LAND)
    if fp <= 0:
        blit(st, ball, BALL_X - SX0, BALL_Y - SY0 + math.sin(u * 5) * 3)
    elif fp < 1:
        for tr, ta in ((0.075, 0.16), (0.035, 0.32)):
            tx, ty = arc_at(max(0.0, fp - tr))
            blit(st, ball, tx - SX0, ty - SY0, alpha=ta, rot=-(fp - tr) * 340)
        bx, by = arc_at(fp)
        blit(st, ball, bx - SX0, by - SY0, rot=-fp * 340)
    else:                                                 # it drops on past the shelf
        pp = seg(u, LAND, LAND + 0.34)
        bx, by = arc_at(1.0)
        blit(st, ball, bx - SX0 - 150 * pp, by - SY0 + 700 * pp * pp, rot=-340 - pp * 300,
             alpha=clamp01(1.6 - pp * 2))
    return st


def beat_coco(im, u, i):
    hx, hy = arc_at(1.0)
    impact_ring(im, hx, hy, seg(u, LAND, LAND + 0.22), r0=10, r1=250, col=GOLD, width=11)
    poof(im, hx, hy, seg(u, LAND, LAND + 0.24), seed=15, big=0.6)
    sparkle_burst(im, hx, hy, seg(u, LAND, LAND + 0.42), n=20, dist=240, seed=8)
    ticket_burst(im, hx + 34, hy + 110, seg(u, LAND + 0.02, 1.08), n=4, seed=2, hold=True)
    return pulse(u, LAND + 0.01, 0.05)


# ── the clip ──────────────────────────────────────────────────────────────────
def fn(t, i):
    b = 0 if t < BEATS[0][1] else (1 if t < BEATS[1][1] else 2)
    a0, a1 = BEATS[b]
    u = clamp01((t - a0) / (a1 - a0))

    # 🎥 the real booth behind the counter, pushing in through the beat
    cx, cy = BEAT_CAM[b]
    dx, dy = handheld(t * SECS + b * 3.0, amp=3.2)
    vw = 566 - 46 * in_out(u) + (54 * in_out(seg(u, 0.52, 1.0)) if b == 2 else 0)
    cam = Cam(asset('beach/beach.png'), cx + dx, cy + dy, vw)
    im, k = cam.shot()
    im.alpha_composite(Image.new('RGBA', im.size, (0, 0, 0, 120)))   # the panel scrim

    booth(im, (stage_duck, stage_crab, stage_coco)[b](u, i))
    hit = (beat_duck, beat_crab, beat_coco)[b](im, u, i)

    win = (0.44, 0.52, LAND + 0.01)[b]
    ticket_badge(im, pulse(u, win + 0.12, 0.34))
    fl = pulse(u, win, 0.045)
    if fl > 0:
        im.alpha_composite(Image.new('RGBA', im.size, (255, 253, 245, round(120 * fl))))
    if b == 2 and u > 0.58:                                # 🎉 the payoff
        confetti(im, (u - 0.58) / 0.42, n=44)

    vignette(im, 66)
    im = zoom_punch(im, hit)
    im = shake_img(im, hit * 15)
    im = chroma_split(im, fl * 7)
    # hard cuts between the three stalls, and a blink into the clip
    im = blink_fade(im, max(pulse(t, BEATS[0][1], 0.030), pulse(t, BEATS[1][1], 0.030),
                            0.62 * (1 - seg(t, 0.0, 0.028))))
    return im


SCENE = {'name': 'stalls', 'secs': SECS, 'fn': fn}
