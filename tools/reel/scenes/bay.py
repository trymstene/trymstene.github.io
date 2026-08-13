# -*- coding: utf-8 -*-
"""🏖 BANANA BAY — the shore, the rally, the spike.

Shot on the real beach plate (2760x1100) with the bay's own geometry
(beach-geo.js): waterline 292, the volleyball court 690..1170 / 532..1012,
the net standing on y 844, Sandy's home (930, 946), the tide coin's surf-line
strip (y 295..304).

  0.00 HOOK   the sea — the page's own sea tiles flipping, foam at the surf
              line, the lagoon float ball, a fish shadow, gulls, a crab.
              A volleyball is already in the air: the rally is in progress.
  0.08 TILT   the camera drops down the beach onto the court
  0.17 BUMP   you send it over the real net
  0.36 DIG    Sandy lobs it back, high
  0.55 SPIKE  ⚡ flat and fast, straight at the camera — speed lines, push in
  0.66 HIT    it lands: flash, rings, a burst of sand, zoom punch, chroma
  0.70 REVEAL the camera pulls all the way back over the bay while a wave
              washes the surf line and leaves a bananacoin glinting behind it
"""
import math
import random

from PIL import Image, ImageDraw, ImageEnhance

from engine import (Cam, asset, blink_fade, chroma_split, clamp01, handheld, impact_ring, in_out,
                    out_cubic, pulse, put_world, seg, shake_img, sparkle_burst, speed_lines,
                    strip_frame, vignette, world_banana, zoom_punch)

SECS = 4.9

# ---- the bay, in plate world px (beach-geo.js) ----------------------------
FAR = (884, 668)          # you, on the far half of COURT (690,532)-(1170,1012)
NEAR = (930, 946)         # Sandy — SANDY_HOME
COIN = (1012, 302)        # the tide coin's wet-sand strip
DRAW_X0, DRAW_X1 = 592, 1264   # the widest band the camera ever sees

YOU = {'hat': 'sombrero'}
SANDY = {'glasses': 'shades'}   # 'shades', never a visor

# ---- 🏐 the rally: (t0, t1, from, to, apex, hitter) -----------------------
# z(u) = 4·apex·u·(1−u) — the bay's own projectile maths (banana-beach.js)
RALLY = [
    (-0.75, 0.85, (1092, 942), (884, 668), 248, None),   # already in play
    (0.85, 1.76, (884, 668), (958, 928), 246, 'far'),    # you bump it over
    (1.76, 2.72, (958, 928), (884, 676), 278, 'near'),   # Sandy lobs it back
    (2.72, 3.22, (884, 676), (1040, 962), 70, 'far'),    # ⚡ THE SPIKE
    (3.22, 3.56, (1040, 962), (1090, 986), 36, None),    # and it bounces
    (3.56, 3.78, (1090, 986), (1116, 994), 13, None),
]
LAND = 3.22
LAND_AT = (1040, 962)
HITS = [s[0] for s in RALLY if s[5]]


def ball_at(ts):
    """(x, y, z, travelled) — the ball's honest arc at scene-second ts"""
    trav = 0.0
    for t0, t1, a, b, apex, _h in RALLY:
        span = math.hypot(b[0] - a[0], b[1] - a[1]) + apex * 2.2
        if ts <= t1:
            u = clamp01((ts - t0) / (t1 - t0))
            return (a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u,
                    4 * apex * u * (1 - u), trav + span * u)
        trav += span
    p = RALLY[-1][3]
    return p[0], p[1], 0.0, trav


CHEER = {'far': [(3.34, 22), (3.62, 16), (3.88, 11)],   # you won the point
         'near': [(LAND - 0.14, 15)]}                    # Sandy lunges for it


def hop(ts, who):
    """the hitter's little jump — up on contact, down again"""
    best = 0.0
    for t0, _t1, _a, _b, _apex, h in RALLY:
        if h != who:
            continue
        u = (ts - t0) / 0.32
        if 0 <= u <= 1:
            best = max(best, math.sin(u * math.pi) * 19)
    for t0, amp in CHEER[who]:
        u = (ts - t0) / 0.26
        if 0 <= u <= 1:
            best = max(best, math.sin(u * math.pi) * amp)
    return best


# ---- small helpers --------------------------------------------------------
def blit(layer, spr, wx, wy, anchor='bottom', flip=False, native=1.0, alpha=255):
    if flip:
        spr = spr.transpose(Image.FLIP_LEFT_RIGHT)
    if native != 1.0:
        spr = spr.resize((max(1, round(spr.width * native)),
                          max(1, round(spr.height * native))), Image.NEAREST)
    if alpha < 255:
        spr = spr.copy()
        spr.putalpha(spr.getchannel('A').point(lambda p: p * alpha // 255))
    x = round(wx - spr.width / 2)
    y = round(wy - (spr.height if anchor == 'bottom' else spr.height / 2))
    if x < 0 or y < 0:
        return
    layer.alpha_composite(spr, (x, y))


def soft_oval(w, h, col):
    """a tiny radial blob, drawn locally so it composites instead of replacing"""
    w, h = max(2, round(w)), max(2, round(h))
    t = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(t)
    r, g, b, a = col
    # ⚠️ WIDEST FIRST. ImageDraw REPLACES alpha, so a small bright core drawn
    # first is wiped out by the faint halo drawn over it.
    for k in range(5, 0, -1):
        f = k / 5
        d.ellipse([w / 2 * (1 - f), h / 2 * (1 - f), w / 2 * (1 + f), h / 2 * (1 + f)],
                  fill=(r, g, b, round(a * (1 - f * 0.86) ** 1.3)))
    return t


def sand_burst(im, cx, cy, t01, seed=6):
    """the sand a landing kicks up — warm, not smoke"""
    if t01 <= 0 or t01 >= 1:
        return
    rnd = random.Random(seed)
    for k in range(18):
        a = rnd.uniform(0, math.tau)
        d = 215 * out_cubic(t01) * (0.25 + 0.85 * rnd.random())
        r = (10 + 13 * rnd.random()) * (1 + 0.5 * t01)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d * 0.42
        col = (255, 250, 232) if k % 3 else (196, 148, 88)
        blob = soft_oval(r * 2.2, r * 1.6, col + (round(245 * (1 - t01) ** 1.25),))
        px, py = round(x - blob.width / 2), round(y - blob.height / 2)
        if px < 0 or py < 0 or px > im.width or py > im.height:
            continue
        im.alpha_composite(blob, (px, py))


_FISH = {}


def fish_shadow(idx):
    """the pack's fish sheet, darkened the way the bay darkens it"""
    if idx not in _FISH:
        f = strip_frame('beach/a-fish2.png', 14, idx)
        f = ImageEnhance.Color(ImageEnhance.Brightness(f).enhance(0.78)).enhance(1.2)
        _FISH[idx] = f
    return _FISH[idx]


# ---- the world layer ------------------------------------------------------
def dress(plate, ts, i):
    # 🌊 THE LIVING SEA — the four sea tiles the page flips at 0.18s each,
    # laid back over the band they were baked from (y 0..288)
    sea = asset('beach/sea-f%d.png' % (int(i / 5.4) % 4))
    for x in range(DRAW_X0 - DRAW_X0 % 48, DRAW_X1, 48):
        plate.alpha_composite(sea, (x, 0))

    # 🫧 foam at the surf line — the strip tiled, each tile on its own phase
    foam = asset('beach/foam.png')
    fw = foam.width // 6
    sway = math.sin(ts * 1.7) * 5
    for n, x in enumerate(range(DRAW_X0, DRAW_X1, fw)):
        fr = (int(i / 3.6) + n * 2) % 6
        blit(plate, foam.crop((fr * fw, 0, (fr + 1) * fw, foam.height)),
             x + fw / 2 + sway, 284 + math.sin(ts * 2.1 + n) * 2, alpha=215)

    # 🐟 a fish shadow gliding under the surface (the bay's ambient shoal)
    blit(plate, fish_shadow(int(ts * 8.24) % 14),
         780 + math.sin(ts * 0.5) * 16, 212, anchor='center')

    # 🏐🌊 the lagoon float ball — it bobs on its own six frames
    blit(plate, strip_frame('beach/a-floatball.png', 6, int(i / 4.3)),
         900, 242, native=0.604)

    # 🕊 two gulls on the wet sand — each takes one short hop
    for gx, gy, t0 in ((744, 306, 0.55), (1096, 314, 1.35)):
        u = (ts - t0) / 0.42
        lift = slide = 0.0
        if 0 <= u <= 1:
            lift, slide = math.sin(u * math.pi) * 9, u * 13
        blit(plate, strip_frame('beach/a-gull.png', 3, int(i / 6)), gx + slide, gy - lift)

    # 🦀 a crab: short darts, long stillnesses, legs that stop when it stops
    legs = [(0.45, 2.25, (768, 338), (824, 350)), (3.20, 4.60, (824, 350), (792, 368))]
    cx, cy, moving, walked = 768.0, 338.0, False, 0.0
    for t0, t1, a, b in legs:
        if ts >= t1:
            cx, cy = b
            walked += t1 - t0
        elif ts > t0:
            u = (ts - t0) / (t1 - t0)
            cx, cy = a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
            moving, walked = True, walked + (ts - t0)
            break
        else:
            cx, cy = a
            break
    blit(plate, strip_frame('beach/a-crab.png', 10, int(walked * 13.33) if moving else 0),
         cx, cy, native=0.8625, flip=(ts < 3.2))

    # 🪙 THE TIDE COIN — a wave washes the surf line and leaves it behind
    wu = (ts - 3.85) / 0.62
    if 0 < wu < 1:
        wy = 268 + 44 * (1 - (2 * wu - 1) ** 2)
        a = round(215 * math.sin(wu * math.pi))
        # a sheet of water, then the bright foam edge riding on its front
        blit(plate, soft_oval(272, 52, (118, 196, 226, a)), COIN[0], wy - 8, anchor='center')
        blit(plate, soft_oval(196, 30, (232, 250, 255, min(255, a + 30))),
             COIN[0], wy - 2, anchor='center')
        for n in range(4):
            fr = (int(i / 3.0) + n * 3) % 6
            blit(plate, foam.crop((fr * fw, 0, (fr + 1) * fw, foam.height)),
                 COIN[0] + (n - 1.5) * (fw - 16), wy + 12, alpha=min(255, a + 40))
    if ts > 4.22:
        glow = 0.55 + 0.45 * math.sin(ts * 9.0)
        blit(plate, soft_oval(100, 76, (255, 228, 104, round(48 + 46 * glow))),
             COIN[0], COIN[1], anchor='center')
        blit(plate, strip_frame('banana-stand/coins-spark.png', 4, int(i / 6)),
             COIN[0], COIN[1], anchor='center')

    # 🏐 the volleyball's ground shadow (the ball itself rides on top later)
    bx, by, bz, _tr = ball_at(ts)
    sh = 1.0 - clamp01(bz / 300) * 0.55
    blit(plate, soft_oval(32 * sh, 16 * sh, (0, 0, 0, round(64 * sh))),
         bx, by + 3, anchor='center')


# ---- the shot -------------------------------------------------------------
def fn(t, i):
    ts = t * SECS
    plate = asset('beach/beach.png').copy()
    dress(plate, ts, i)
    bx, by, bz, trav = ball_at(ts)

    # 🎥 sea → sand → court, a push onto the arc, then all the way back out
    # ⚠️ the crane-down has to LAND by 0.29 — any slower and Sandy is still a
    # head poking up from the bottom edge while the rally is already running
    tilt = in_out(seg(t, 0.09, 0.29))
    creep = in_out(seg(t, 0.29, 0.52))                   # the rally never sits still
    push = in_out(seg(t, 0.52, 0.655))
    pull = in_out(seg(t, 0.675, 0.94))
    vw = 442 + 28 * tilt - 22 * creep - 52 * push + 164 * pull   # 442→470→448→396→560
    cy = 396 + 298 * tilt + 30 * push - 104 * in_out(seg(t, 0.685, 1.0))
    # ⚠️ the court is 480 wide and the net's poles sit at 665 and 1195: hold the
    # camera on 928±4 and a 470 view lands exactly between them, uncut.
    cx = min(932.0, 928 + (bx - 928) * 0.14 * tilt)
    hx, hy = handheld(ts, amp=2.6)

    # the punches: every contact taps, the landing hits
    tap = max(pulse(t, h / SECS, 0.035) for h in HITS) * 5.0
    smash = pulse(t, LAND / SECS, 0.05) * 18
    cam = Cam(plate, cx + hx, cy + hy, vw)
    cam.shake_amt = max(tap, smash) * 0.5
    im, _k = cam.shot()

    # 🍌 the two players — planted on their spots, bouncing when they hit
    world_banana(im, cam, i, YOU, FAR[0], FAR[1], lift=-hop(ts, 'far'))
    world_banana(im, cam, i, SANDY, NEAR[0], NEAR[1], flip=True, lift=-hop(ts, 'near'))

    # 🏐 the ball, spinning with its own travel, popping on every contact
    pop = 1.0
    for h in HITS:
        u = (ts - h) / 0.18
        if 0 <= u <= 1:
            pop = max(pop, 1 + 0.38 * (1 - u))
    put_world(im, cam, strip_frame('beach/volleyball.png', 8, int(trav / 22)),
              bx, by - bz, native=1.164 * pop, anchor='center')

    # ⚡ the spike streaks down the frame as the ball comes at the camera
    speed_lines(im, seg(t, 2.80 / SECS, LAND / SECS), n=13, seed=7, horizontal=False)

    # 💥 the landing
    lx, ly = cam.tf(*LAND_AT)
    sand_burst(im, lx, ly, seg(t, LAND / SECS, (LAND + 0.52) / SECS))
    for _ in range(2):        # doubled, so the shockwave actually reads on sand
        impact_ring(im, lx, ly, seg(t, LAND / SECS, (LAND + 0.36) / SECS),
                    r1=230, width=12, col=(255, 253, 245))
    fl = pulse(t, LAND / SECS, 0.026)
    if fl > 0:
        im.alpha_composite(Image.new('RGBA', im.size, (255, 253, 245, round(98 * fl))))

    # 🪙 the coin the tide left, glinting
    gx, gy = cam.tf(*COIN)
    sparkle_burst(im, gx, gy, seg(t, 4.26 / SECS, 4.78 / SECS), n=16, dist=155, seed=4)
    sparkle_burst(im, gx, gy, seg(t, 4.50 / SECS, 5.24 / SECS), n=13, dist=110, seed=9)

    vignette(im, 52)
    # ⚠️ SHAKE FIRST. zoom_punch crops back to frame size, so a shake applied
    # after it slides black bars in from the edges — the zoom has to eat them.
    im = shake_img(im, max(tap, smash))
    im = zoom_punch(im, max(smash / 18, tap / 16))
    im = chroma_split(im, pulse(t, LAND / SECS, 0.018) * 6)
    im = blink_fade(im, (1 - seg(t, 0.0, 0.035)) * 0.8)
    return im


SCENE = {'name': 'bay', 'secs': SECS, 'fn': fn}
