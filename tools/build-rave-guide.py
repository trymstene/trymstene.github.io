# -*- coding: utf-8 -*-
"""Rave guide thumbnails — rasterise the ACTUAL in-game sprites for the
"what's on the floor" guide on /rave/. Art is parsed straight out of
banana-rave.js + banana-engine.js (the build-og-cards trick), so the guide
can never drift from the game. Rerun after changing any floor sprite.

Run: python tools/build-rave-guide.py
"""
import importlib.util
import os
import re
from PIL import Image, ImageDraw

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SITE, 'public', 'assets', 'rave-guide')

spec = importlib.util.spec_from_file_location('ogc', os.path.join(SITE, 'tools', 'build-og-cards.py'))
ogc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ogc)

RAVE = open(os.path.join(SITE, 'src', 'scripts', 'banana-rave.js'), encoding='utf-8').read()
RAVE_SVGS = dict(re.findall(r"const (\w+)_SVG = '(<svg[^']+</svg>)'", RAVE))
# the R4.5 conveyor items live as KEYED entries (Object.assign(ITEM_SVGS, {...}))
KEYED_SVGS = dict(re.findall(r"^\s+(\w+): '(<svg[^']+</svg>)',?$", RAVE, re.M))


def raster(svg, target_h=72):
    vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', svg)
    vw, vh = int(vb.group(1)), int(vb.group(2))
    k = max(1, round(target_h / vh))
    im = Image.new('RGBA', (vw * k, vh * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # honour per-rect opacity — the glowstick's halo flanks are 0.2/0.4 alpha
    # and rendered solid they turned the thin stick into a fat blob (Trym)
    for r in re.finditer(r'<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="([^"]+)"(?: opacity="([\d.]+)")?', svg):
        x, y, w, h = (int(r.group(i)) for i in range(1, 5))
        col = r.group(5)
        alpha = int(float(r.group(6) or 1) * 255)
        rgb = tuple(int(col[i:i + 2], 16) for i in (1, 3, 5))
        d.rectangle([x * k, y * k, (x + w) * k - 1, (y + h) * k - 1], fill=rgb + (alpha,))
    return im


os.makedirs(OUT, exist_ok=True)

# floor items from banana-rave.js (grid = 1 unit per px)
for name, key in [('jelly', 'JELLY'), ('candy', 'CANDY'), ('pizza', 'PIZZA'),
                  ('balloon', 'BALLOON'), ('sauce', 'SAUCE'), ('cable', 'ZAP'),
                  ('fizz', 'FIZZ'), ('peel', 'PEEL'), ('puddle', 'PUDDLE'),
                  ('monkey', 'MONKEY'), ('stool', 'STOOL')]:
    raster(RAVE_SVGS[key]).save(os.path.join(OUT, name + '.png'), optimize=True)
    print('wrote', name + '.png')

# the R4.5 six (keyed entries) — the new power-up generation
for name in ['boots', 'gel', 'sparkler', 'magnet', 'vhs', 'star']:
    raster(KEYED_SVGS[name]).save(os.path.join(OUT, name + '.png'), optimize=True)
    print('wrote', name + '.png')

# engine accessories/props (grid = 10 svg-px per unit — raster handles it,
# it just scales the viewBox)
for name in ['vinyl', 'goldbanana', 'broom', 'glowstick', 'beer']:
    raster(ogc.SVGS[name], target_h=120).save(os.path.join(OUT, name + '.png'), optimize=True)
    print('wrote', name + '.png')

# tonight's drop card — the DJ headphones stand in for whatever item is
# floating tonight (curated or community-made, the card explains both)
raster(ogc.SVGS['djheadphones'], target_h=100).save(os.path.join(OUT, 'gift.png'), optimize=True)
print('wrote gift.png')

# Barty: frame 4 (left-facing) + bow tie + moustache, engine-exact
barty = ogc.render_banana(4, bowtie=True)
F = ogc.FRAMES[4]
unit = ogc.PX
vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', ogc.SVGS['mustacheSide'])
mw, mh = int(vb.group(1)) / 10 * unit, int(vb.group(2)) / 10 * unit
mx = F['eyeCx'] + (-1) * (-1.2) * unit   # face 'left': mirror = -1, sideDx = -1.2
my = F['eyeCy'] + 4.0 * unit
layer = Image.new('RGBA', (round(mw), round(mh)), (0, 0, 0, 0))
d = ImageDraw.Draw(layer)
sx, sy = layer.width / int(vb.group(1)), layer.height / int(vb.group(2))
for r in re.finditer(r'<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="([^"]+)"', ogc.SVGS['mustacheSide']):
    x, y, w, h = (int(r.group(i)) for i in range(1, 5))
    d.rectangle([round(x * sx), round(y * sy), round((x + w) * sx) - 1, round((y + h) * sy) - 1], fill=r.group(5))
layer = layer.transpose(Image.FLIP_LEFT_RIGHT)  # face 'left' flips face extras
barty.paste(layer, (round(mx - mw / 2), round(my - mh / 2)), layer)
bb = barty.getbbox()
barty.crop(bb).save(os.path.join(OUT, 'barty.png'), optimize=True)
print('wrote barty.png')
