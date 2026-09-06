# -*- coding: utf-8 -*-
"""🎟 EIGHT PACKS — the cards slam in and fan out, Party on top.

   0.06 eight pack cards, one every 0.07: each flies up from below and lands
        in the fan with a ring and a shove (whoosh lines under it all)
   0.74 the last one (Party) lands — punch, sparkles
   0.80 hold on the hand of cards
"""
from PIL import Image

from engine import (blink_fade, impact_ring, new_frame, out_back, out_cubic, pulse, seg,
                    shake_img, sparkle_burst, speed_lines, sun_rays, vignette, zoom_punch)
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _stk import INK, YELLOW, card

SECS = 4.5
ORDER = [1, 2, 3, 5, 6, 7, 8, 4]     # Party lands last, on top
CW = 290
CX, CY = 270, 470
T0, GAP, FLY = 0.06, 0.07, 0.15


def fn(t, i):
    im = new_frame(INK)
    sun_rays(im, CX, CY - 20, t, n=12, col=YELLOW, alpha=55, spin=0.4)
    speed_lines(im, seg(t, 0.02, 0.66), n=12, seed=3, horizontal=False)
    last_at = T0 + (len(ORDER) - 1) * GAP
    for k, n in enumerate(ORDER):
        at = T0 + k * GAP
        u = seg(t, at, at + FLY)
        if u <= 0:
            continue
        c = card(n, CW)
        ang = -17 + k * 4.8
        seat_x = CX + (k - 3.5) * 16
        seat_y = CY + abs(k - 3.5) * 5
        y = seat_y + (1 - out_back(u, 1.3)) * 760
        r = c.rotate(ang * out_cubic(u), expand=True, resample=Image.BICUBIC)
        im.alpha_composite(r, (round(seat_x - r.width / 2), round(y - r.height / 2)))
        impact_ring(im, seat_x, seat_y + 130, seg(t, at + 0.09, at + 0.30), r0=20, r1=210, width=5)
    sparkle_burst(im, CX, CY - 20, seg(t, last_at + 0.08, last_at + 0.42), n=18, dist=260, seed=9)
    im = zoom_punch(im, pulse(t, last_at + 0.12, 0.08) * 0.9)
    im = shake_img(im, pulse(t, last_at + 0.12, 0.05) * 8)
    vignette(im, 90)
    im = blink_fade(im, 1 - seg(t, 0, 0.03))
    return im


SCENE = {'name': 'stk_packs', 'secs': SECS, 'fn': fn}
