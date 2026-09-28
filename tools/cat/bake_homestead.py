# The cat's strips for the homestead (28 Sep 2026), baked like the dog's (public/assets/homestead/c-dog*.png):
# ONLY the frames the yard uses, never the sheet (tools/cat/out/ stays gitignored — this repo is public).
# Trym, 28 Sep 2026: "add that to the farm/homestead? in the same way you can get a dog … the cat can also lie
# down and stuff". The right-facing side rows (the engine mirrors her for the left), the front-facing purr and
# the sleep row, every frame cut to ONE shared box — bottom-aligned on her feet and centred on her body — so a
# strip swap never moves her feet and a turn never moves her sideways. 48-scale like the other animals (x3).
# Run: python tools/cat/bake_homestead.py          (--info prints the boxes and writes nothing)
import os
import sys
from PIL import Image
import bas
import side
import updown
import sleep

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(REPO, 'public', 'assets', 'homestead')
K = 3
img = bas.to_image
STRIPS = {
    'c-catidle.png': [img(side.cat_side('idle', i)) for i in range(6)],
    'c-cat.png': [img(side.cat_side('walk', i)) for i in range(6)],
    'c-catrun.png': [img(side.cat_side('run', i)) for i in range(6)],
    'c-cateat.png': [img(side.cat_side('eat', i)) for i in range(6)],
    'c-catmeow.png': [img(side.cat_side('bark', i)) for i in range(3)],
    'c-cathappy.png': [img(updown.cat_down('happy', i)) for i in range(6)],
    'c-catsleep.png': [img(sleep.cat_sleep(i)) for i in range(8)],
}


def solid_box(im):
    """the bbox of the opaque pixels (the shadow's half-alpha pixels count as ground, not body)"""
    a = im.getchannel('A').point(lambda v: 255 if v == 255 else 0)
    return a.getbbox()


# her body's centre column: the middle of the standing frames' opaque pixels
stand = [solid_box(f) for f in STRIPS['c-catidle.png'] + STRIPS['c-cat.png']]
cx2 = sum(b[0] + b[2] for b in stand) / len(stand)   # twice the centre, to stay in whole numbers
boxes = [f.getbbox() for fs in STRIPS.values() for f in fs]
x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
half = max(cx2 / 2 - x0, x1 - cx2 / 2)
bx0 = int(round(cx2 / 2 - half))
bx1 = int(round(cx2 / 2 + half))
BW, BH = bx1 - bx0, y1 - y0

if '--info' in sys.argv:
    print('union', (x0, y0, x1, y1), 'body centre', cx2 / 2, 'box', (bx0, y0, bx1, y1), 'frame', BW, 'x', BH)
    for nm, fs in STRIPS.items():
        bb = [f.getbbox() for f in fs]
        feet = [solid_box(f)[3] for f in fs]
        print(' %-15s %d frames  x %s  feet %s' % (nm, len(fs), [(b[0], b[2]) for b in bb], feet))
    sys.exit(0)

# the Banana Phone's rows, her card, the family tree and the kitchen tiles draw an animal as frame 0 of a
# FOUR-frame strip (background-size 400%): her own thumb strip is four of her idle beats
STRIPS['c-catthumb.png'] = [STRIPS['c-catidle.png'][k] for k in (0, 2, 3, 5)]

for nm, fs in STRIPS.items():
    st = Image.new('RGBA', (BW * len(fs), BH), (0, 0, 0, 0))
    for i, f in enumerate(fs):
        st.alpha_composite(f.crop((bx0, y0, bx1, y1)), (i * BW, 0))
    st = st.resize((st.width * K, st.height * K), Image.NEAREST)
    st.save(os.path.join(OUT, nm), optimize=True)
    print('  %s %dx%d (%d frames of %dx%d)' % (nm, st.width, st.height, len(fs), BW * K, BH * K))
