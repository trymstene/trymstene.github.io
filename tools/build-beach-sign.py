# -*- coding: utf-8 -*-
"""🏖 THE BEACH SIGN — the park's door to Banana Bay.

The park plate (build-stand-park.py) is hand-drawn pixels, not pack art, so
this sign can't be baked into it: it has to stand as its own sprite the page
can make CLICKABLE. One file in, one file out.

    21_Beach_48x48_Beach_Sign.png  ->  public/assets/banana-stand/beach-sign.png

Run: python tools/build-beach-sign.py
"""
import os

from blockify import blockify, load_pack

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SITE, 'public', 'assets', 'banana-stand')
os.makedirs(OUT, exist_ok=True)

# ⚠️ factor=1: the park displays this at roughly its native size, and the
# blockify default (4) would chunk a 48px sign down to 12px of mush. What we
# want from blockify here is only its PALETTE work — the quantise + punch +
# warm pass that makes pack art sit in our world instead of beside it.
src = load_pack('21_Beach_48x48_Beach_Sign.png')
img = blockify(src, factor=1, colors=14, sat=1.22, con=1.12, warm=0.05,
               outline=False, trim=True)
img.save(os.path.join(OUT, 'beach-sign.png'))
print('beach-sign.png', img.size)
