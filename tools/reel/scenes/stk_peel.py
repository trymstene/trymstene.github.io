# -*- coding: utf-8 -*-
"""🎟 THE PEEL — the payoff: one sticker comes off the sheet and fills the frame.

   0.03 camera pushes in on the page until the Party Hat cell sits centre
   0.34 the sticker lifts off the paper: rises, tilts, its shadow grows
   0.62 it flies to the camera and lands big — ring, confetti
   0.80 hold: the one you peel off, ready for the line in post
"""
from PIL import Image, ImageDraw, ImageFilter

from engine import (blink_fade, confetti, impact_ring, in_out, new_frame, out_back, out_cubic,
                    pulse, seg, shake_img, sun_rays, vignette, zoom_punch)
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _stk import HOT, HOT2, cell_center, page, page_shadow, printed_art_h, sticker

SECS = 4.5
PW0 = 400
ZOOM = 2.15
CX, CY = 270, 470
HERO_K = 1                       # the Party Hat cell
TARGET = (270, 430)              # where the cell ends up after the push


def fn(t, i):
    im = new_frame(HOT)
    sun_rays(im, CX, CY - 60, t, n=16, col=HOT2, alpha=150, spin=0.3)
    u = in_out(seg(t, 0.03, 0.32))
    width = round(PW0 * (1 + (ZOOM - 1) * u))
    pg = page(width)
    # the page's centre so that the hero cell drifts from its place to TARGET
    ph = pg.height
    cellx = (HERO_K % 2 + 0.5) / 2 * width - width / 2
    celly = (HERO_K // 2 + 0.5) / 3 * ph - ph / 2
    pcx = CX * (1 - u) + (TARGET[0] - cellx) * u
    pcy = CY * (1 - u) + (TARGET[1] - celly) * u
    sh = page_shadow(pg.size)
    im.alpha_composite(sh, (round(pcx - sh.width / 2) + 10, round(pcy - sh.height / 2) + 18))
    im.alpha_composite(pg, (round(pcx - pg.width / 2), round(pcy - pg.height / 2)))
    # the sticker: lift, then fly
    v = out_cubic(seg(t, 0.34, 0.62))
    w = seg(t, 0.62, 0.80)
    if v > 0:
        art_h = printed_art_h(width)
        st = sticker('party-hat', art_h)
        sx, sy = cell_center(HERO_K, pcx, pcy, width)
        lift = v
        s = 1 + 0.14 * lift + 0.78 * out_back(w, 1.0)   # lands ~620 px tall: hat and feet stay in frame
        rot = -12 * lift + 8 * w
        x = sx + 8 * lift + (CX - sx - 8 * lift) * in_out(w)
        y = sy - 46 * lift + (CY - sy + 46 * lift) * in_out(w)
        # the shadow that says "off the paper"
        if w < 1:
            ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
            sw, shh = st.width * s * 0.9, st.height * s * 0.9
            ImageDraw.Draw(ov).ellipse([x - sw / 2 + 14 * lift, y + 10 + 30 * lift - shh * 0.18,
                                        x + sw / 2 + 14 * lift, y + 10 + 30 * lift + shh * 0.18],
                                       fill=(0, 0, 0, round(70 * lift * (1 - w))))
            im.alpha_composite(ov.filter(ImageFilter.GaussianBlur(8)))
        r = st.resize((max(1, round(st.width * s)), max(1, round(st.height * s))))
        if abs(rot) > 0.3:
            r = r.rotate(rot, expand=True, resample=Image.BICUBIC)
        im.alpha_composite(r, (round(x - r.width / 2), round(y - r.height / 2)))
    impact_ring(im, CX, CY, seg(t, 0.80, 1.0), r0=40, r1=420, width=8)
    confetti(im, seg(t, 0.80, 1.0), n=40, seed=11)
    im = zoom_punch(im, pulse(t, 0.81, 0.08) * 0.9)
    im = shake_img(im, pulse(t, 0.81, 0.05) * 8)
    vignette(im, 70)
    im = blink_fade(im, 1 - seg(t, 0, 0.03))
    return im


SCENE = {'name': 'stk_peel', 'secs': SECS, 'fn': fn}
