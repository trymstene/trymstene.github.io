# -*- coding: utf-8 -*-
"""Feature stills for the frontpage — one hero frame per reel scene,
cropped 4:5 portrait, saved as tuned JPGs into public/assets/world/."""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import reel  # noqa: E402

SITE = os.path.dirname(os.path.dirname(HERE))
DST = os.path.join(SITE, 'public', 'assets', 'world')

# scene -> the moment that sells it (t in 0..1)
PICKS = {
    'builder': 0.42, 'rave': 0.5, 'park': 0.55, 'bay': 0.5,
    'homestead': 0.97, 'items': 0.62, 'quest': 0.46, 'pass': 0.85,
    'shops': 0.85, 'stalls': 0.75, 'treasure': 0.9, 'fishing': 0.78,
    'tending': 0.5,
}

for name, t in PICKS.items():
    fn, secs = reel.SCENES[name]
    n = round(secs * reel.FPS)
    i = round(t * (n - 1))
    im = fn(i / (n - 1), i).convert('RGB')          # 540x960
    # 4:5 crop, biased to the upper-middle where the action is
    w = 540
    h = round(w * 5 / 4)
    top = max(0, min(960 - h, round(960 * 0.22)))
    im = im.crop((0, top, w, top + h))
    im = im.resize((640, 800), Image.LANCZOS)
    im.save(os.path.join(DST, 'feat-%s.jpg' % name), quality=84)
    print('feat-%s.jpg' % name)
