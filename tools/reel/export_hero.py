# -*- coding: utf-8 -*-
"""HONEST hero shots for the frontpage — real plate crops at TRUE game scale.

The reel stills are cinematic close-ups (giant chest, poster bananas) and
read as broken sprite sizing when used as world promo (Trym). These are the
opposite: the actual plates, sprites at their in-game sizes, wide 21:9-ish
crops. Output: public/assets/world/hero-*.jpg (1400x600).
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import reel  # noqa: E402  (asset/banana helpers + caches)

SITE = os.path.dirname(os.path.dirname(HERE))
DST = os.path.join(SITE, 'public', 'assets', 'world')

BAN_H = 104   # the banana's true in-world height on the plates


def crop_wide(plate, cx, cy, vw=1400, vh=600):
    x0 = max(0, min(plate.width - vw, cx - vw // 2))
    y0 = max(0, min(plate.height - vh, cy - vh // 2))
    return plate.crop((round(x0), round(y0), round(x0 + vw), round(y0 + vh))), x0, y0


def put(im, sprite, x, y, x0, y0):
    """paste bottom-centred at world coords (x, y)"""
    im.alpha_composite(sprite, (round(x - x0 - sprite.width / 2), round(y - y0 - sprite.height)))


def save(im, name):
    im.convert('RGB').save(os.path.join(DST, name), quality=86)
    print(name)


# ── the park plaza: three bananas at true scale, critters, birds ──
plate = reel.asset('park/park.png').copy()
im, x0, y0 = crop_wide(plate, 1400, 560)
put(im, reel.banana(2, {'hat': 'cowboy'}, BAN_H), 1300, 640, x0, y0)
put(im, reel.banana(5, {'glasses': 'shades'}, BAN_H), 1490, 600, x0, y0)
put(im, reel.banana(0, {'hat': 'party'}, BAN_H), 1180, 700, x0, y0)
chick = reel.strip_frame('park/a-chicken1.png', 6, 1)
put(im, chick, 1560, 700, x0, y0)
rab = reel.strip_frame('park/a-rabbit.png', 6, 0)
put(im, rab, 1050, 760, x0, y0)
save(im, 'hero-park.jpg')

# ── the bay shoreline: snorkel banana, crab, native coins ──
plate = reel.asset('beach/beach.png').copy()
im, x0, y0 = crop_wide(plate, 1000, 520)
put(im, reel.banana(3, {'glasses': 'snorkelmask'}, BAN_H), 900, 620, x0, y0)
put(im, reel.banana(6, {'hat': 'buckethat'}, BAN_H), 1250, 560, x0, y0)
crab = reel.strip_frame('beach/a-crab.png', 20, 2)
put(im, crab, 1080, 660, x0, y0)
coin = reel.strip_frame('banana-stand/coin-spin.png', 6, 0)
put(im, coin, 780, 640, x0, y0)
put(im, coin, 1340, 690, x0, y0)
save(im, 'hero-bay.jpg')

# ── the homestead gate: Nib waits with the mark, a resident walks up ──
plate = reel.asset('homestead/homestead.png').copy()
im, x0, y0 = crop_wide(plate, 1000, 700, 1400, 600)
tent = reel.asset('homestead/ov-tent1.png')
put(im, tent, 1000, 560, x0, y0)
put(im, reel.banana(0, {'hat': 'tophat', 'glasses': 'potter', 'extras': ['necktie']}, BAN_H), 1180, 880, x0, y0)
put(im, reel.banana(4, {'hat': 'backwardscap'}, BAN_H), 1020, 900, x0, y0)
# the golden ! over Nib — glow BLENDED on an overlay (ImageDraw replaces
# pixels, it never alpha-blends), the mark drawn at 2x chip scale
from PIL import ImageDraw  # noqa: E402
ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
d = ImageDraw.Draw(ov)
mx, my = 1180 - x0, 880 - y0 - BAN_H - 44
d.ellipse([mx - 30, my - 34, mx + 30, my + 26], fill=(255, 210, 63, 90))
u = 2.6
for (rx, ry, rw, rh, col) in [(-3, -22, 6, 10, (17, 17, 17, 255)), (-3, -8, 6, 5, (17, 17, 17, 255)),
                              (-2, -21, 4, 8, (255, 210, 63, 255)), (-2, -7, 4, 3, (255, 210, 63, 255)),
                              (-2, -21, 2, 8, (255, 243, 168, 255))]:
    d.rectangle([mx + rx * u, my + ry * u, mx + (rx + rw) * u, my + (ry + rh) * u], fill=col)
im.alpha_composite(ov)
save(im, 'hero-quest.jpg')

# ── a real neighbourhood yard: Jade's house with visitors ──
card_src = os.path.join(DST, 'yard-jade-green-banana-3.jpg')
if os.path.exists(card_src):
    base = Image.open(card_src).convert('RGBA')          # 640x480 render
    big = base.resize((1280, 960), Image.LANCZOS)
    im = big.crop((160, 180, 1280, 180 + 480)).resize((1400, 600), Image.LANCZOS)
    # two visitors at matching scale (the card is ~0.73x world, x2 = 1.45x)
    v1 = reel.banana(1, {'hat': 'crown'}, round(BAN_H * 1.45))
    v2 = reel.banana(5, None, round(BAN_H * 1.45))
    im.alpha_composite(v1, (350, 330))
    im.alpha_composite(v2, (950, 380))
    save(im, 'hero-home.jpg')
