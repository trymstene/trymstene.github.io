# One animated look: every animation, four ways, the cat beside the Basenji, at the game's 3x (27 Sep 2026),
# and the frames tools/cat/town-look.mjs puts beside the banana in the real town.
# Run: python tools/cat/preview.py (after build_sheet.py)   → tools/cat/out/cat-vs-basenji.gif + look-*.png
import os
from PIL import Image, ImageDraw
import bas
from sprite import sheet, cell, OUT

K = 3
C = 32 * K
cat = Image.open(OUT + 'Cat_Orange_16x16.png').convert('RGBA')
dog = sheet(bas.BAS)
GRASS = (58, 84, 58, 255)
# (label, sheet row, frames per direction, first column of each direction or None, ticks per frame)
ANIMS = [
    ('idle', 2, 6, (0, 6, 12, 18), 2),
    ('walk', 4, 6, (0, 6, 12, 18), 1),
    ('run', 6, 6, (0, 6, 12, 18), 1),
    ('eat', 8, 6, (0, 6, 12, 18), 2),
    ('meow / bark', 10, 3, (0, 3, 6, 9), 2),
    ('happy', 12, 6, (0,), 1),
    ('sleep', 14, 8, (0,), 2),
]
LW = 92
W = LW + 8 * C + 16
H = 26 + len(ANIMS) * C
TICKS = 48
frames = []
for t in range(TICKS):
    im = Image.new('RGBA', (W, H), (24, 26, 30, 255))
    d = ImageDraw.Draw(im)
    d.text((LW + 4, 6), 'CAT   right / up / left / down', fill=(235, 228, 242, 255))
    d.text((LW + 4 * C + 20, 6), 'BASENJI   right / up / left / down', fill=(235, 228, 242, 255))
    for r, (name, row, n, cols, tpf) in enumerate(ANIMS):
        y = 26 + r * C
        d.text((6, y + C // 2 - 6), name, fill=(235, 228, 242, 255))
        i = (t // tpf) % n
        for k, (src, x0) in enumerate(((cat, LW), (dog, LW + 4 * C + 16))):
            for j, c0 in enumerate(cols):
                tile = Image.new('RGBA', (32, 32), GRASS)
                tile.alpha_composite(cell(src, row, c0 + i, 32, 32))
                im.paste(tile.resize((C, C), Image.NEAREST), (x0 + j * C, y))
    frames.append(im.convert('RGB').quantize(colors=128, method=Image.MEDIANCUT, dither=Image.NONE))
frames[0].save(OUT + 'cat-vs-basenji.gif', save_all=True, append_images=frames[1:], duration=110, loop=0, optimize=True)
frames[0].convert('RGB').save(OUT + 'cat-vs-basenji-still.png')
print('ok', W, H)

# the frames the town look puts beside the banana, and the homestead's own dog for scale
for name, (r, c) in {'walk': (4, 2), 'down': (2, 18), 'sleep': (14, 0)}.items():
    cell(cat, r, c, 32, 32).save(OUT + 'look-%s.png' % name)
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
Image.open(os.path.join(REPO, 'public', 'assets', 'homestead', 'c-dogidle.png')).convert('RGBA').crop((0, 0, 104, 66)).save(OUT + 'look-dog.png')
