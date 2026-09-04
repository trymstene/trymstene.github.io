# -*- coding: utf-8 -*-
"""build-door-tiles.py — the four area shots on the builder's world doors.

The builder is the busiest page on the site and its doors were plain text
buttons. These are landscape crops of the existing feature art, chosen so the
SUBJECT of each area survives at ~240px wide on a phone: the house, the
dancefloor, the fountain, the beach hut.

⚠️ CROPS OF EXISTING PACK ART — nothing is drawn here. The source images are
already in the repo and already used on feature cards; this only reframes and
shrinks them, so the pack-fidelity rule is untouched.

    python tools/build-door-tiles.py
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'public', 'assets', 'world')
OUT = SRC

# (source, top of the 640x400 window, name) — the window is picked per area so
# the thing that says "this is the beach" is in frame, not the empty sand
DOORS = [
    ('feat-homestead.jpg', 20, 'door-homestead'),   # the house and its fence
    ('feat-rave.jpg', 205, 'door-rave'),            # bananas under the lights — 205 not 250, or the front banana loses its head to the top edge
    ('feat-park.jpg', 200, 'door-park'),            # the fountain — high enough that the name pill, which sits centred on the bottom seam, does not land on the banana's face
    ('feat-bay.jpg', 60, 'door-beach'),             # the beach hut and the palms
]
W, H = 480, 300   # 2x the ~240px a tile gets on a phone

for src, top, name in DOORS:
    im = Image.open(os.path.join(SRC, src)).convert('RGB')
    win = im.crop((0, top, im.width, min(im.height, top + 400)))
    # ⚠️ NEAREST, not the default bicubic: this is pixel art, and a smooth
    # resample turns a crisp banana into porridge at this size.
    out = win.resize((W, H), Image.NEAREST)
    path = os.path.join(OUT, name + '.jpg')
    out.save(path, quality=78, optimize=True)
    print('%-16s %sx%s  %.0f KB' % (name, W, H, os.path.getsize(path) / 1024))
