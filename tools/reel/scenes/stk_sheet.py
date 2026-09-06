# -*- coding: utf-8 -*-
"""🎟 THE SHEET — Pack 4 · Party, exactly as it prints, and six pops.

   0.03 the A5 slides up from below onto the party ground and lands
   0.30 six beats: each sticker jumps off the page as its kiss-cut self and
        settles back — the Party Hat hero last, with sparkles
   0.80 zoom punch + confetti, hold
"""
from PIL import Image

from engine import (blink_fade, confetti, impact_ring, new_frame, out_back, out_cubic,
                    pulse, seg, shake_img, sparkle_burst, sun_rays, vignette, zoom_punch)
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _stk import CELLS, HOT, HOT2, cell_center, page, page_shadow, printed_art_h, sticker

SECS = 5.0
PW = 400                         # the page's width in the 540-wide frame
CX, CY = 270, 440                # up a touch: the bottom row stays clear of the caption chrome
LAND = 0.24
POP0, GAP, POP_LEN = 0.30, 0.085, 0.28
# pop order: the Original first, the hero (Party Hat) last
ORDER = [0, 2, 3, 4, 5, 1]


def fn(t, i):
    im = new_frame(HOT)
    sun_rays(im, CX, CY - 60, t, n=16, col=HOT2, alpha=150, spin=0.3)
    u = out_back(seg(t, 0.03, LAND), 1.2)
    pcy = 1180 + (CY - 1180) * u
    tilt = -5 * (1 - u)
    pg = page(PW)
    sh = page_shadow(pg.size)
    im.alpha_composite(sh, (round(CX - sh.width / 2) + 10, round(pcy - sh.height / 2) + 18))
    if abs(tilt) > 0.05:
        r = pg.rotate(tilt, expand=True, resample=Image.BICUBIC)
        im.alpha_composite(r, (round(CX - r.width / 2), round(pcy - r.height / 2)))
    else:
        im.alpha_composite(pg, (round(CX - pg.width / 2), round(pcy - pg.height / 2)))
    art_h = printed_art_h(PW)
    for n, k in enumerate(ORDER):
        at = POP0 + n * GAP
        if t < at or t >= at + POP_LEN:
            continue
        cx, cy = cell_center(k, CX, CY, PW)
        st = sticker(CELLS[k]['slug'], art_h)
        rise = out_back(seg(t, at, at + 0.11), 1.6) * (1 - out_cubic(seg(t, at + 0.22, at + POP_LEN)))
        s = 1 + 0.32 * rise
        w2, h2 = max(1, round(st.width * s)), max(1, round(st.height * s))
        r = st.resize((w2, h2))
        rot = (-7 if k % 2 else 7) * rise
        if abs(rot) > 0.3:
            r = r.rotate(rot, expand=True, resample=Image.BICUBIC)
        im.alpha_composite(r, (round(cx - r.width / 2), round(cy - 14 * rise - r.height / 2)))
        impact_ring(im, cx, cy + 40, seg(t, at, at + 0.2), r0=8, r1=130, width=4)
        if k == 1:
            sparkle_burst(im, cx, cy, seg(t, at, at + 0.32), n=14, dist=150, seed=5)
    confetti(im, seg(t, 0.80, 1.0), n=44, seed=7)
    im = zoom_punch(im, pulse(t, 0.81, 0.09) * 0.8)
    im = shake_img(im, pulse(t, 0.81, 0.05) * 6 + pulse(t, LAND, 0.04) * 7)
    vignette(im, 70)
    im = blink_fade(im, 1 - seg(t, 0, 0.03))
    return im


SCENE = {'name': 'stk_sheet', 'secs': SECS, 'fn': fn}
