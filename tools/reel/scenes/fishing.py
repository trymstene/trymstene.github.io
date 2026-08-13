# -*- coding: utf-8 -*-
"""🎣 FISHING — cast, bite, catch, off the Banana Bay dock.

Every coordinate is the real game's. beach-geo.js puts the dock at x1812-1968,
y60-318 with the sea above WATER_Y 292 and PIER_MOUTH at (1890,348);
banana-beach.js FISH_SPOTS seats the east-facing chair at (1944,224) with its
bobber out at (2074,214), and startFishing() builds the rig: hand at
seat+(18,-25), rod tip 40 out and 34 up, the line HANGING off the tip down to
the float. A seated angler is frame-LOCKED (F_RIGHT = 4) and never dances — so
the honest walking motion in this clip belongs to the banana coming up the
dock behind him, at the engine's 168 px/s with a hard stop at the free chair.

  0.00 hook   — the rod cocked back over the bay
  0.05 CAST   — the rod whips, the line flies out, the float splashes down
  0.20 wait   — the float bobs, rings spread, a shoal shadow closes in on it
  0.47 BITE   — the float thrashes, gold ring, the camera snaps in
  0.63 STRIKE — flash, splash, the catch breaks the surface
  0.76 payoff — it arcs up on the line into a gold burst
"""
import math
import random

from PIL import Image, ImageDraw, ImageEnhance

from engine import (BAN_H, Cam, H, W, Walk, asset, banana, blink_fade, bob, chroma_split,
                    dance_frame, handheld, impact_ring, in_out, out_cubic, pulse, seg,
                    shake_img, sheet_cell, sparkle_burst, strip_frame, sun_rays,
                    vignette, zoom_punch)

SECS = 4.9

# ---- the dock, exactly where the game puts it -----------------------------
SEAT = (1944.0, 224.0)          # FISH_SPOTS[3].seat — the east-facing chair
BOB = (2074.0, 214.0)           # …and its bobber, out over the bay
HAND = (SEAT[0] + 18, SEAT[1] - 25)
TIP = (HAND[0] + 40, HAND[1] - 34)

# the four Ship_Bar_Chair crates (OVERLAYS ov-23..26): the plate bakes the pier
# deck OVER them, so the page redraws them on top — and so do we.
CHAIRS = [('beach/ov-23.png', 1825, 108), ('beach/ov-24.png', 1933, 108),
          ('beach/ov-25.png', 1825, 188), ('beach/ov-26.png', 1933, 188)]
# the pier-fringe sprouts (ov-5 base 452, ov-6 base 512): their ground line is
# BELOW the walker's, so the page draws them in front of him — and so do we.
FRINGE = [('beach/ov-5.png', 1911, 385), ('beach/ov-6.png', 1887, 445)]

# a neighbour crossing the sand below the dock — game speed, one hard stop, a
# beat of standing (dancing, which is what an idle banana does), then he walks
# clean out of frame left. ⚠️ he must never PAUSE at a clipped x: the camera's
# left edge lives around x1855, and a stationary half-banana at the border reads
# as two floating white gloves. So the standing beat is at x1926 and the last
# leg is one continuous move all the way off the plate's visible strip.
WALK = Walk([(1996, 410), (1926, 396), (1748, 366)], pause=0.5, start_pause=0.15)

CATCH_TILE = 8                  # fish.png atlas — clownfish, 35 tiles in a row
FISH_WH = 56.0                  # world px: a good fish beside a 104px banana
# straight up out of the water, then over and back toward the rod
LEAP = ((2074.0, 214.0), (2080.0, 112.0), (2044.0, 124.0))

CAST_A, CAST_B = 0.05, 0.19     # the cast window
BITE_A = 0.47
STRIKE = 0.625
HANG = 0.92                     # the arc is done; it swings on the line


# ---- little helpers -------------------------------------------------------
def blit(im, sprite, x, y):
    """paste top-left, tolerating off-frame coords (alpha_composite will not)"""
    x, y = int(round(x)), int(round(y))
    if x >= im.width or y >= im.height or x + sprite.width <= 0 or y + sprite.height <= 0:
        return
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ov.paste(sprite, (x, y))
    im.alpha_composite(ov)


def put_native(im, cam, sprite, wx, wy, native=1.0, anchor='topleft'):
    w = max(1, round(sprite.width * native * cam.k))
    h = max(1, round(sprite.height * native * cam.k))
    s = sprite.resize((w, h), Image.NEAREST)
    x, y = cam.tf(wx, wy)
    if anchor == 'center':
        x, y = x - w / 2, y - h / 2
    blit(im, s, x, y)


def a_banana(im, cam, frame, outfit, wx, wy, lift=0.0):
    b = banana(frame, outfit, height=max(2, round(BAN_H * cam.k)))
    x, y = cam.tf(wx, wy)
    blit(im, b, x - b.width / 2, y - b.height + lift)


def qbez(p0, p1, p2, u):
    return ((1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0],
            (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1])


def rod(d, cam, hand, tip, k, bend=0.0):
    hx, hy = cam.tf(*hand)
    tx, ty = cam.tf(*tip)
    mx, my = (hx + tx) / 2, (hy + ty) / 2 - bend * k
    pts = [qbez((hx, hy), (mx, my), (tx, ty), u / 8) for u in range(9)]
    d.line(pts, fill=(72, 44, 21, 255), width=max(2, round(3.6 * k)))
    d.line(pts, fill=(201, 145, 74, 255), width=max(1, round(1.9 * k)))


def fishline(d, cam, tip, end, k, sag=0.0):
    tx, ty = cam.tf(*tip)
    ex, ey = cam.tf(*end)
    mx, my = (tx + ex) / 2, (ty + ey) / 2 + sag * k
    pts = [qbez((tx, ty), (mx, my), (ex, ey), u / 10) for u in range(11)]
    d.line(pts, fill=(255, 255, 255, 240), width=max(1, round(1.2 * k)))


def bobber(im, sx, sy, k):
    r = max(3.0, 7.0 * k)
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    box = [sx - r, sy - r, sx + r, sy + r]
    d.ellipse(box, fill=(255, 253, 245, 255))
    d.chord(box, 180, 360, fill=(255, 85, 69, 255))
    d.ellipse(box, outline=(109, 21, 9, 255), width=max(1, round(r * 0.3)))
    im.alpha_composite(ov)


def ripples(im, sx, sy, k, phase, n=3, r0=6.0, r1=48.0, alpha=175,
            col=(228, 250, 255)):
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for j in range(n):
        u = (phase + j / n) % 1.0
        r = (r0 + (r1 - r0) * u) * k
        a = round(alpha * (1 - u) ** 1.3)
        if a <= 3:
            continue
        d.ellipse([sx - r, sy - r * 0.48, sx + r, sy + r * 0.48],
                  outline=col + (a,), width=max(1, round(2.2 * k * (1 - 0.55 * u))))
    im.alpha_composite(ov)


def ring(im, sx, sy, r, col, alpha, width, squash=0.48):
    if alpha <= 3:
        return
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    d.ellipse([sx - r, sy - r * squash, sx + r, sy + r * squash],
              outline=col + (round(alpha),), width=max(1, round(width)))
    im.alpha_composite(ov)


def glow(im, sx, sy, r, col, alpha):
    if alpha <= 2:
        return
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for s in range(5, 0, -1):
        rr = r * s / 5
        d.ellipse([sx - rr, sy - rr, sx + rr, sy + rr], fill=col + (round(alpha / 5),))
    im.alpha_composite(ov)


def spray(im, sx, sy, t01, k, seed=11, n=14, dist=78.0, fall=1.0):
    """water thrown up off the surface"""
    if t01 <= 0 or t01 >= 1:
        return
    rnd = random.Random(seed)
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)
    for _ in range(n):
        a = rnd.uniform(math.pi * 1.02, math.pi * 1.98)
        v = rnd.uniform(0.45, 1.0)
        dd = dist * k * v * out_cubic(t01)
        x = sx + math.cos(a) * dd
        y = sy + math.sin(a) * dd * 0.85 + t01 * t01 * 62 * k * fall
        r = max(1.2, (3.4 - 2.2 * t01) * k * rnd.uniform(0.65, 1.35))
        d.ellipse([x - r, y - r, x + r, y + r],
                  fill=(234, 250, 255, round(238 * (1 - t01))))
    im.alpha_composite(ov)


def shoal(im, cam, wx, wy, strip, dark=0.74, fade=0.85):
    """the page's own bh-fish: a fish-shaped SHADOW gliding under the surface.
    The CSS keeps these barely off the water's own colour — a hard black blob
    would read as a bird, not a shape below the surface."""
    s = ImageEnhance.Brightness(strip).enhance(dark)
    s.putalpha(s.getchannel('A').point(lambda a: round(a * fade)))
    put_native(im, cam, s, wx, wy, anchor='center')


# ---- the camera: one long push, snapping tighter on every hit -------------
# cy is pinned so the plate's top edge is the frame's — the bay fills more of
# the frame the tighter we get, which is the whole shape of this clip.
def camera(t):
    a = in_out(seg(t, 0.03, 0.30))          # settle after the cast
    b = in_out(seg(t, 0.42, 0.60))          # into the bite
    c = in_out(seg(t, 0.62, 0.78))          # the strike
    e = in_out(seg(t, 0.88, 1.00))          # payoff breath
    vw = (278 - 32 * a - 22 * b - 34 * c + 16 * e) - 12 * pulse(t, 0.50, 0.05)
    cx = 1972 + 12 * a + 12 * b + 10 * c - 4 * e
    return cx, vw * H / W / 2 + 10, vw


def fn(t, i):
    plate = asset('beach/beach.png')
    ts = t * SECS
    cx, cy, vw = camera(t)
    hx, hy = handheld(ts, amp=2.4)

    hit = max(pulse(t, CAST_B, 0.035) * 7,        # splashdown
              pulse(t, BITE_A + 0.02, 0.030) * 5,  # the bite jolt
              pulse(t, STRIKE, 0.050) * 22,       # THE STRIKE
              pulse(t, 0.905, 0.040) * 8)         # payoff punch

    cam = Cam(plate, cx + hx, cy + hy * 0.3, vw)
    cam.shake_amt = hit * 0.4
    im, k = cam.shot()
    d = ImageDraw.Draw(im)

    # 🐟 shoal shadows under the surface (the page's own bh-fish sheets)
    if t < STRIKE:
        su = in_out(seg(t, 0.14, 0.50))
        shoal(im, cam, 2186 - 142 * su + math.sin(ts * 2.1) * 4 * su,
              264 - 18 * su + max(0.0, t - 0.56) * 300,
              strip_frame('beach/a-fish2.png', 14, i // 2))
    shoal(im, cam, 2028 + math.sin(ts * 0.6) * 16, 44,
          strip_frame('beach/a-fish3.png', 14, i // 3), dark=0.8, fade=0.72)
    shoal(im, cam, 2088 + math.sin(ts * 0.5 + 2.2) * 14, 96,
          strip_frame('beach/a-fish1.png', 12, i // 3), dark=0.8, fade=0.72)

    # 🪑 the dock chairs the page redraws over the deck
    for path, wx, wy in CHAIRS:
        put_native(im, cam, asset(path), wx, wy)

    # ---- the hero angler: seated, frame-locked, exactly as the game does --
    strain = pulse(t, STRIKE + 0.02, 0.11)
    recoil = -6.0 * k * pulse(t, STRIKE + 0.01, 0.055)
    a_banana(im, cam, 4, {'hat': 'buckethat'}, SEAT[0] - 2 * strain, SEAT[1], lift=recoil)

    # the rod: cocked back, whipped forward on the cast, hauled up on the strike
    whip = in_out(seg(t, 0.015, 0.10))
    back = (HAND[0] - 30, HAND[1] - 43)
    tip = (back[0] + (TIP[0] - back[0]) * whip, back[1] + (TIP[1] - back[1]) * whip)
    tip = (tip[0] + 8 * strain, tip[1] - 14 * strain)
    rod(d, cam, HAND, tip, k, bend=5 + 10 * strain)

    cast = out_cubic(seg(t, CAST_A, CAST_B))
    wsx, wsy = cam.tf(*BOB)

    if t < STRIKE:
        # 🎣 THE CAST — the float flies out on a bezier and splashes down
        if t < CAST_A:
            bp = tip
        elif cast < 1:
            bp = qbez(tip, (2050, 104), BOB, cast)
        else:
            bp = (BOB[0], BOB[1] + math.sin(ts * 3.3) * 2.4)     # the 1.9s bhBob

        bt = seg(t, BITE_A, STRIKE)
        if bt > 0:                                       # 🔴 THE BITE: it thrashes
            amp = 0.5 + 2.4 * bt
            bp = (BOB[0] + math.sin(i * 1.31) * 4.4 * amp,
                  BOB[1] + abs(math.sin(i * 1.31 + 0.9)) * 5.2 * amp)

        sx, sy = cam.tf(*bp)
        if cast > 0:
            fishline(d, cam, tip, bp, k, sag=10 * (1 - cast) + 5 * cast)
        if cast >= 1:
            if bt > 0:
                ripples(im, sx, sy + 3 * k, k, (ts / (0.8 - 0.4 * bt)) % 1.0,
                        r0=6, r1=40 + 30 * bt, alpha=205)
                gold = 0.5 + 0.5 * math.sin(i * 1.31)
                ring(im, sx, sy, (12 + 7 * gold) * k, (255, 213, 74),
                     170 + 85 * gold, 3.2 * k, squash=0.78)
                pr = (ts * 2.6) % 1.0
                ring(im, sx, sy, (14 + 46 * pr) * k, (255, 213, 74),
                     190 * (1 - pr) * bt, 2.4 * k, squash=0.6)
                if bt > 0.3:
                    spray(im, sx, sy, (ts * 3.6) % 1.0, k, seed=41, n=6,
                          dist=24, fall=0.6)
            else:
                ripples(im, sx, sy + 3 * k, k, (ts / 1.5) % 1.0)
        if cast > 0:
            bobber(im, sx, sy, k)
        spl = seg(t, CAST_B - 0.015, CAST_B + 0.09)
        if 0 < spl < 1:
            spray(im, sx, sy, spl, k, seed=17, n=13, dist=52)
            ring(im, sx, sy, (10 + 62 * out_cubic(spl)) * k, (232, 250, 255),
                 210 * (1 - spl), 2.6 * k * (1 - spl))
    else:
        # ---- 🐟 THE CATCH BREAKS THE SURFACE ------------------------------
        u = seg(t, STRIKE, HANG) ** 0.7          # explode out, hang, come over
        fx, fy = qbez(*LEAP, u)
        rot = -82.0 + 60.0 * u                   # bursts out nose-up, settles hanging
        if t > HANG:                              # a damped swing on the line
            e2 = (t - HANG) * SECS
            damp = math.exp(-e2 * 0.75)
            fx += math.sin(e2 * 6.0) * 11.0 * damp
            fy += math.cos(e2 * 6.0) * 5.0 * damp
            rot += math.sin(e2 * 6.0) * 13.0 * damp

        # the water it came out of
        ripples(im, wsx, wsy + 3 * k, k, (ts / 0.55) % 1.0, r0=8, r1=76, alpha=185)
        spray(im, wsx, wsy, seg(t, STRIKE, STRIKE + 0.14), k, seed=23, n=20, dist=98)
        impact_ring(im, wsx, wsy, seg(t, STRIKE, STRIKE + 0.20), r0=8 * k,
                    r1=118 * k, col=(232, 250, 255), width=6 * k)

        fsx, fsy = cam.tf(fx, fy)
        if t > 0.76:
            sun_rays(im, fsx, fsy, ts, n=14, col=(255, 226, 110),
                     alpha=round(34 * seg(t, 0.76, 0.90)), spin=0.25)

        # the float rides the line, which runs taut from the rod tip
        bp = (tip[0] + (fx - tip[0]) * 0.58, tip[1] + (fy - tip[1]) * 0.58)
        fishline(d, cam, tip, (fx, fy), k, sag=2)
        bsx, bsy = cam.tf(*bp)
        bobber(im, bsx, bsy, k)

        glow(im, fsx, fsy, 84 * k, (255, 219, 96), 130 * seg(t, 0.72, 0.88))
        fish = sheet_cell('beach/fish.png', 35, 1, CATCH_TILE, 0)
        fh = max(4, round(FISH_WH * k))
        fish = fish.resize((fh, fh), Image.NEAREST).rotate(rot, resample=Image.NEAREST,
                                                          expand=True)
        blit(im, fish, fsx - fish.width / 2, fsy - fish.height / 2)

        spray(im, fsx, fsy, seg(t, STRIKE + 0.04, STRIKE + 0.24), k, seed=29,
              n=11, dist=40, fall=1.8)
        drip = Image.new('RGBA', im.size, (0, 0, 0, 0))
        dd = ImageDraw.Draw(drip)
        for j in range(3):
            dp = ((ts * 0.9 + j * 0.37) % 1.0)
            rr = max(1.2, 2.4 * k * (1 - dp * 0.6))
            dx = fsx + (j - 1) * 16 * k
            dy = fsy + 14 * k + dp * dp * 150 * k
            dd.ellipse([dx - rr, dy - rr, dx + rr, dy + rr],
                       fill=(234, 250, 255, round(200 * (1 - dp))))
        im.alpha_composite(drip)
        sparkle_burst(im, fsx, fsy, seg(t, 0.74, 0.95), n=16, dist=110 * k, seed=13)
        sparkle_burst(im, fsx, fsy, seg(t, 0.88, 1.0), n=11, dist=78 * k, seed=19,
                      color=(255, 253, 245, 255))

    # ---- 🚶 a neighbour walks up the dock to the free chair ---------------
    wx, wy, moving = WALK.at(ts)
    a_banana(im, cam, dance_frame(i), {'hat': 'watermelonhat'}, wx, wy,
             lift=bob(i, moving))
    for path, fx0, fy0 in FRINGE:
        put_native(im, cam, asset(path), fx0, fy0)

    # ---- the punches ------------------------------------------------------
    fl = pulse(t, STRIKE, 0.045)
    if fl > 0:
        im.alpha_composite(Image.new('RGBA', im.size, (255, 253, 245, round(140 * fl))))

    vignette(im, 58)
    im = zoom_punch(im, hit / 22)
    im = shake_img(im, hit)
    im = chroma_split(im, fl * 5)
    im = blink_fade(im, 0.5 * (1 - seg(t, 0.0, 0.03)))
    return im


SCENE = {'name': 'fishing', 'secs': SECS, 'fn': fn}
