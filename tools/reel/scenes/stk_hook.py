# -*- coding: utf-8 -*-
"""🎟 THE HOOK — the banana everyone knows becomes a sticker.

   0.00 the dancing banana, big, at the site's own 10fps, yellow rays behind
   0.52 FLASH — it is its own kiss-cut sticker now, tilted, sparkles
   0.62 hold, a lazy sway: the sticker IS the banana, one to one
"""
import math

from PIL import Image

from engine import (H, W, blink_fade, flash, handheld, impact_ring, new_frame, out_back,
                    pulse, seg, shake_img, sparkle_burst, sun_rays, vignette, dance_frame)
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _stk import INK, YELLOW, hero, sticker

SECS = 4.5
FLIP = 0.52
CX, CY = 270, 470
HERO_H = 560


def fn(t, i):
    im = new_frame(INK)
    sun_rays(im, CX, CY - 40, t, n=14, col=YELLOW, alpha=60, spin=0.5)
    dx, dy = handheld(t, 2.5, 1.0)
    if t < FLIP:
        b = hero(dance_frame(i), HERO_H)
        im.alpha_composite(b, (round(CX + dx - b.width / 2), round(CY + 300 + dy - b.height)))
    else:
        u = seg(t, FLIP, FLIP + 0.10)
        st = sticker('the-original', HERO_H)   # one to one with the banana it replaces
        s = max(0.05, 0.55 + 0.45 * out_back(u))
        rot = -6 + 2.5 * math.sin(t * 7)
        w2, h2 = max(1, round(st.width * s)), max(1, round(st.height * s))
        r = st.resize((w2, h2)).rotate(rot, expand=True, resample=Image.BICUBIC)
        im.alpha_composite(r, (round(CX + dx - r.width / 2), round(CY + 10 + dy - r.height / 2)))
        sparkle_burst(im, CX, CY, seg(t, FLIP, FLIP + 0.35), n=16, dist=210, seed=4)
    impact_ring(im, CX, CY, seg(t, FLIP, FLIP + 0.22), r0=30, r1=340)
    im = flash(im, pulse(t, FLIP, 0.035) * 0.9)
    im = shake_img(im, pulse(t, FLIP + 0.02, 0.06) * 9)
    vignette(im, 80)
    im = blink_fade(im, 1 - seg(t, 0, 0.03))
    return im


SCENE = {'name': 'stk_hook', 'secs': SECS, 'fn': fn}
