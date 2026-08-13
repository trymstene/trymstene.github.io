# -*- coding: utf-8 -*-
"""🏡 THE HOMESTEAD — build an empty plot into a home in five seconds.

⭐ THE REFERENCE SCENE. Beat structure, honest scale, camera doing the work:
   0.00 tight on bare land, camera breathing
   0.08 TENT slams in       — poof + ring + zoom punch + shake
   0.20 fence builds        — camera drifts right as it grows
   0.34 decor lands x4      — each a small punch, camera easing back
   0.58 a NEIGHBOUR WALKS IN (Walk: 168px/s, arrives, stops, stands)
   0.74 the HOUSE lands     — flash, chroma, big shake, ring
   0.88 pull back + confetti to the full yard
"""
import math

from PIL import Image, ImageDraw

from engine import (BAN_H, Cam, Walk, asset, blink_fade, chroma_split, confetti, dance_frame,
                    handheld, impact_ring, out_back, out_cubic, paste_center, poof, pulse,
                    put_world, scaled, seg, shake_img, sparkle_burst, vignette, world_banana,
                    zoom_punch, banana, in_out)

SECS = 5.0
PX, PY = 1050, 560          # the plot, in homestead-plate world coords


def fn(t, i):
    plate = asset('homestead/homestead.png').copy()
    layer = Image.new('RGBA', plate.size, (0, 0, 0, 0))
    house_t = seg(t, 0.74, 0.86)

    # ⛺ the tent (until the house replaces it)
    tp = out_back(seg(t, 0.08, 0.18))
    if tp > 0 and house_t <= 0:
        tent = asset('homestead/ov-tent1.png')
        paste_center(layer, tent, PX, PY - tent.height * 0.28, scale=max(0.05, tp))

    # 🪵 the fence, built left to right
    fs = seg(t, 0.20, 0.34)
    if fs > 0:
        yard = asset('homestead/ov-fyard1.png')
        south = asset('homestead/ov-fsouth1.png')
        fx, fy = PX - yard.width / 2, PY - 190
        cw = max(2, round(yard.width * out_cubic(fs)))
        layer.alpha_composite(yard.crop((0, 0, cw, yard.height)), (round(fx), round(fy)))
        layer.alpha_composite(south.crop((0, 0, cw, south.height)), (round(fx), round(fy + 332)))

    # 🛋 decor, landing one at a time (native sizes — the honest law)
    DECOR = [('homestead/d-bench.png', -150, 108, 0.36),
             ('homestead/d-fountain.gif', 152, 84, 0.44),
             ('homestead/d-birdhouse.png', -196, -38, 0.51),
             ('homestead/m-mail.png', 206, 128, 0.58)]
    for path, ox, oy, at in DECOR:
        p = out_back(seg(t, at, at + 0.08))
        if p > 0:
            spr = asset(path)
            paste_center(layer, spr, PX + ox, PY + oy - spr.height / 2, scale=max(0.05, p))
    for k, (ox, oy) in enumerate([(-104, 150), (-42, 170), (42, 160), (112, 174)]):
        p = out_back(seg(t, 0.62 + k * 0.02, 0.68 + k * 0.02))
        if p > 0:
            paste_center(layer, scaled('park/b-marigold.png', 1.4), PX + ox, PY + oy, scale=max(0.05, p))

    # 🏠 the house
    if house_t > 0:
        house = asset('homestead/ov-country.png')
        paste_center(layer, house, PX, PY - house.height * 0.3, scale=max(0.05, out_back(house_t)))

    plate.alpha_composite(layer)

    # 🚶 a neighbour walks up the road and stops at the gate (GAMEPLAY motion)
    walk = Walk([(PX + 470, PY + 300), (PX + 180, PY + 300), (PX + 150, PY + 232)],
                pause=0.5, start_pause=0.4)
    wx, wy, moving = walk.at(max(0.0, t * SECS - 2.7))

    # 🎥 the camera: tight → drifting → pulled back, with a breath throughout
    push = in_out(seg(t, 0.16, 0.42))
    pull = in_out(seg(t, 0.72, 1.0))
    vw = 330 + push * 150 + pull * 130          # <=610: vh must stay inside the 1100-tall plate
    drift = math.sin(t * 2.4) * 26 * (1 - pull)
    hx, hy = handheld(t * SECS, amp=2.4)
    cam = Cam(plate, PX + drift + hx, PY + 30 - pull * 40 + hy, vw)

    # the punches: tent, house
    hit = max(pulse(t, 0.10, 0.05) * 12, pulse(t, 0.755, 0.05) * 20)
    cam.shake_amt = hit * 0.6
    im, k = cam.shot()

    if t > 2.7 / SECS:
        world_banana(im, cam, i, {'hat': 'crown'}, wx, wy,
                     flip=True, lift=-abs(math.sin(i * 0.5)) * 3 if moving else 0)

    # dust under each landing
    sx, sy = cam.tf(PX, PY - 20)
    poof(im, sx, sy, seg(t, 0.08, 0.24), seed=4, big=1.0)
    poof(im, sx, sy, seg(t, 0.74, 0.90), seed=9, big=1.5)
    impact_ring(im, sx, sy, seg(t, 0.10, 0.26), r1=170)
    impact_ring(im, sx, sy, seg(t, 0.755, 0.95), r1=300, width=9, col=(255, 225, 53))

    # the house payoff: flash, sparkle, confetti
    fl = pulse(t, 0.76, 0.045)
    if fl > 0:
        im.alpha_composite(Image.new('RGBA', im.size, (255, 253, 245, round(150 * fl))))
    sparkle_burst(im, sx, sy - 120, seg(t, 0.86, 1.0), n=18, dist=250, seed=5)
    if t > 0.88:
        confetti(im, (t - 0.88) / 0.12, n=34)

    vignette(im, 58)
    im = zoom_punch(im, hit / 20)
    im = shake_img(im, hit)
    im = chroma_split(im, fl * 6)
    # a blink into and out of the clip so it cuts clean in the edit
    im = blink_fade(im, 1 - seg(t, 0.0, 0.03))
    return im


SCENE = {'name': 'homestead', 'secs': SECS, 'fn': fn}
