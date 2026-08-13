# -*- coding: utf-8 -*-
"""🍌🏪 THE BANANA STAND — coins in, hat on.

The stand's own plate (banana-stand/park.png) at the game's ×2 so every
sprite keeps its true size: the hut is the ×2 hut the park bakes, the
banana is BAN_H, a coin is its native 44px.

   0.00 the HUT slams onto the road      — poof, ring, punch
   0.00 a CUSTOMER walks up at 168px/s and HARD STOPS at the counter (1.15s)
   0.18 the KEEPER rises into the window (frame 3 — the game's keeper is done
        dancing) and stays put for the rest of the clip
   0.34 the stock lands on the sill at WORN size: the watermelon helmet, then
        the duck   — a punch on each
   0.50 three COINS arc in from his side and pile up as the game's own cluster
   0.84 THE BUY: the duck leaves the sill and is on his head — flash, chroma,
        ring, confetti; the paid coins twinkle (coins-spark)
"""
import math

from PIL import Image, ImageDraw

from engine import (BAN_H, Cam, Walk, asset, banana, blink_fade, bob, chroma_split, confetti,
                    handheld, impact_ring, in_out, out_back, poof, pulse, put_world,
                    seg, shake_img, sparkle_burst, strip_frame, vignette, world_banana,
                    zoom_punch)

import banana_render   # engine puts tools/ on sys.path — import it AFTER engine

SECS = 4.8

# ---- the world (plate px == world px) --------------------------------------
PLATE = asset('banana-stand/park.png').resize((640, 840), Image.NEAREST)

# the hut, ×2, with the dark backing behind its window cutout — exactly how
# build-park-scene.py bakes it into the park (minus its painted sign)
_HUT = asset('banana-stand/hut.png')
_BACK = Image.new('RGBA', _HUT.size, (0, 0, 0, 0))
ImageDraw.Draw(_BACK).rectangle((22, 32, 65, 55), fill=(36, 29, 51, 255))
_BACK.alpha_composite(_HUT)
HUT = _BACK

HUT_CX, HUT_BASE = 320.0, 296.0        # base on the road, below the worn apron
HUT_TOP = HUT_BASE - 172               # the ×2 hut is 176x172
WX0, WX1 = HUT_CX - 88 + 44, HUT_CX - 88 + 132   # the window cutout, ×2
WY0, WY1 = HUT_TOP + 64, HUT_TOP + 112
SILL_Y = HUT_TOP + 125                 # goods stand on the counter band
CUST = (311.0, 366.0)                  # he stops on the road, at the counter

# the stock, at the size it is when WORN (grid units -> world px on BAN_H)
ITEM_K = 13 * BAN_H / 498.0
GOODS = [('watermelonhat', -34.0, 0.34), ('duckhat', 34.0, 0.42)]

WALK = Walk([(313.0, 560.0), CUST], pause=0.4)

# the coin's own spin, minus its edge-on frame: a 7px-wide capsule blown up by
# a pushed-in camera reads as a yellow stick, not a coin
SPIN = (0, 1, 0, 5)


def item_sprite(key, k, grow=1.0):
    """the manifest's own art, rasterised crisp at screen scale"""
    w = max(8.0, banana_render.grid_w(key) * ITEM_K * k)
    h = max(8.0, banana_render.grid_h(key) * ITEM_K * k)
    spr = banana_render.svg_layer(key, w, h)
    if grow >= 0.999:
        return spr
    return spr.resize((max(1, round(spr.width * grow)),
                       max(1, round(spr.height * grow))), Image.NEAREST)


def paste_base(im, spr, cx, by):
    im.alpha_composite(spr, (round(cx - spr.width / 2), round(by - spr.height)))


def fn(t, i):
    ts = t * SECS
    pop = out_back(seg(t, -0.045, 0.12))   # already slamming down on frame one
    rise = out_back(seg(t, 0.18, 0.30))
    bought = t >= 0.84

    # 🎥 a small push in on the counter, breathing throughout
    push = in_out(seg(t, 0.10, 0.62))
    close = in_out(seg(t, 0.84, 1.0))
    vw = 242 - 84 * push - 6 * close
    hx, hy = handheld(ts, amp=1.6)
    cam = Cam(PLATE, HUT_CX + hx, 302 - 54 * push + hy, vw)

    hit = max(pulse(t, 0.045, 0.05) * 13,
              pulse(t, 0.37, 0.04) * 7, pulse(t, 0.45, 0.04) * 7,
              pulse(t, 0.845, 0.05) * 18)
    cam.shake_amt = hit * 0.25
    im, k = cam.shot()

    # the dust it kicks up — UNDER the building, so the shockwave spreads from
    # its feet instead of painting itself across the wall
    gx, gy = cam.tf(HUT_CX, HUT_BASE)
    poof(im, gx, gy + 8, seg(t, 0.0, 0.18), seed=7, big=1.0)
    impact_ring(im, gx, gy + 6, seg(t, 0.02, 0.20), r1=260)

    # 🏪 the stand itself (grows out of the ground)
    if pop > 0:
        put_world(im, cam, HUT, HUT_CX, HUT_BASE, native=2.0 * max(0.05, pop))

    # 🍌 the keeper, rising into the window and clipped by it
    if pop >= 0.999 and rise > 0:
        bx0, by0 = cam.tf(WX0, WY0)
        bx1, by1 = cam.tf(WX1, WY1)
        bw, bh = max(1, round(bx1 - bx0)), max(1, round(by1 - by0))
        band = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
        kb = banana(3, {}, height=max(4, round(112 * k)))
        kx = round((HUT_CX - WX0) * k - kb.width / 2)
        ky = round((HUT_TOP + 48 + (1 - rise) * 58 - WY0) * k)
        if ky < 0:
            kb = kb.crop((0, -ky, kb.width, kb.height))
            ky = 0
        if kx < 0:
            kb = kb.crop((-kx, 0, kb.width, kb.height))
            kx = 0
        if kb.width > 0 and kb.height > 0:
            band.alpha_composite(kb, (kx, ky))
        im.alpha_composite(band, (round(bx0), round(by0)))

    # 🧢 the stock landing on the sill (true worn size)
    for key, ox, at in GOODS:
        gp = out_back(seg(t, at, at + 0.09))
        if gp <= 0 or (bought and key == 'duckhat'):
            continue
        sx, sy = cam.tf(HUT_CX + ox, SILL_Y)
        paste_base(im, item_sprite(key, k, max(0.06, gp)), sx, sy)
        gr = seg(t, at + 0.03, at + 0.20)
        impact_ring(im, sx, sy, gr, r0=6, r1=90 * k / 3.0, width=5)

    # 🚶 the customer: walks the road at 168px/s, hard stop at the counter
    wx, wy, moving = WALK.at(ts)
    outfit = {'hat': 'duckhat'} if bought else {}
    world_banana(im, cam, i, outfit, wx, wy, lift=bob(i, moving))

    # 🪙 coins arcing over the counter from his side
    landed = 0
    cf = int(i / 4.5)
    for c in range(3):
        u = seg(t, 0.50 + c * 0.075, 0.65 + c * 0.075)
        if u <= 0:
            continue
        if u >= 1:
            landed += 1
            continue
        e = in_out(u)
        sxw = 372 + (316 - 372) * e
        syw = 344 + (243 - 344) * e - math.sin(e * math.pi) * 44
        put_world(im, cam, strip_frame('banana-stand/coin-spin.png', 6,
                                       SPIN[(cf + c) % len(SPIN)]),
                  sxw, syw, anchor='center')

    # the till on the counter: the game's own cluster, twinkling once paid
    if landed >= 3:
        pl = out_back(seg(t, 0.80, 0.87))
        cx, cy = cam.tf(HUT_CX, SILL_Y)
        pile = (strip_frame('banana-stand/coins-spark.png', 4, i // 5)
                if t > 0.88 else asset('banana-stand/coins.png'))
        pw = max(1, round(pile.width * k * max(0.06, pl)))
        ph = max(1, round(pile.height * k * max(0.06, pl)))
        paste_base(im, pile.resize((pw, ph), Image.NEAREST), cx, cy)
        impact_ring(im, cx, cy, seg(t, 0.805, 0.95), r0=8, r1=150, width=6,
                    col=(255, 225, 53))

    # ---- effects -----------------------------------------------------------
    # the stand's idle ✦ over the roof (the park spawns these all day)
    sparkle_burst(im, *cam.tf(HUT_CX + 30, HUT_TOP + 4), t01=seg(t, 0.28, 0.46),
                  n=6, dist=70, seed=3)
    sparkle_burst(im, *cam.tf(HUT_CX - 42, HUT_TOP + 10), t01=seg(t, 0.60, 0.76),
                  n=5, dist=62, seed=8)

    # 🎉 THE BUY
    bx, by = cam.tf(CUST[0], CUST[1] - BAN_H)
    fl = pulse(t, 0.842, 0.034)
    if fl > 0:
        im.alpha_composite(Image.new('RGBA', im.size, (255, 253, 245, round(138 * fl))))
    if bought:
        impact_ring(im, bx, by + 10, seg(t, 0.845, 0.99), r0=14, r1=300, width=9,
                    col=(255, 225, 53))
        sparkle_burst(im, bx, by, seg(t, 0.85, 1.14), n=18, dist=250, seed=11)
        confetti(im, seg(t, 0.85, 1.26), n=34)

    vignette(im, 60)
    im = zoom_punch(im, hit / 18)
    im = shake_img(im, hit)
    im = chroma_split(im, fl * 6)
    im = blink_fade(im, 0.62 * (1 - seg(t, 0.0, 0.03)))
    return im


SCENE = {'name': 'shops', 'secs': SECS, 'fn': fn}
