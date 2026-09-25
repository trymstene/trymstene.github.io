# -*- coding: utf-8 -*-
"""build-hero-dancers.py — the backup dancers on the homepage hero (26 Sep 2026).

Trym: "the dancing banana in a big white space … a bit stiff and boring". The hero's big banana now dances with a
crew either side, each in an outfit from the builder, on the same beat. This renders them: every outfit's eight
dance frames, composed EXACTLY like the builder (tools/build-og-cards.py's engine-parsed math: the same sheet,
anchors and wearable art), then sampled back onto the art's own pixel grid — one art pixel = one image pixel — so
the page shows them at a whole 2x or 3x and they stay crisp (design library §6).

    python tools/build-hero-dancers.py          # writes public/assets/hero/dancers.png

One sheet, one request: a row per outfit (ROWS below, in order), eight frames across. The page steps
background-position-x through a row with steps(8) and picks the row with background-position-y.
"""
import importlib.util
import os
import re
from PIL import Image

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('og', os.path.join(SITE, 'tools', 'build-og-cards.py'))
og = importlib.util.module_from_spec(spec)
spec.loader.exec_module(og)
FW, FH, PX = og.FW, og.FH, og.PX
PAD = PX * 14   # room above the head for the tallest hat, a whole number of art pixels
OUT = os.path.join(SITE, 'public', 'assets', 'hero', 'dancers.png')

# the crew, in sheet order (the page's CREW list in src/pages/index.astro names these rows)
ROWS = [
    ('party', dict(hat='party', glasses='hearts')),
    ('sombrero', dict(hat='sombrero')),
    ('duck', dict(hat='duckhat')),
    ('viking', dict(hat='viking')),
    ('crown', dict(hat='crown', glasses='shades')),
    ('cowboy', dict(hat='cowboy')),
    ('prop', dict(hat='beanieprop', glasses='nerd')),
    ('tophat', dict(hat='tophat', glasses='monocle')),
]


def vbox(key):
    vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', og.SVGS[key])
    return int(vb.group(1)) / 10 * PX, int(vb.group(2)) / 10 * PX


def frame(idx, hat=None, glasses=None):
    sheet = Image.open(os.path.join(SITE, 'public', 'assets', 'banana-dance.png')).convert('RGBA')
    fr = Image.new('RGBA', (FW, FH + PAD), (0, 0, 0, 0))
    fr.paste(sheet.crop((idx * FW, 0, (idx + 1) * FW, FH)), (0, PAD))
    F = og.FRAMES[idx]

    def paste(key, left, top, flip=False):
        w, h = vbox(key)
        layer = og.svg_layer(key, round(w), round(h), flip)
        fr.paste(layer, (round(left), round(top) + PAD), layer)

    if hat:
        hd = og.HATS[hat]
        w, h = vbox(hd['art'])
        paste(hd['art'], F['hatCx'] - w / 2, F['tipY'] + (og.HAT_OVERLAP + hd['seat']) * PX - h)
    if glasses:
        sd = og.SHADES[glasses]
        key = sd['side'] if F['face'] != 'front' else sd['front']
        w, h = vbox(key)
        paste(key, F['eyeCx'] - w / 2, F['eyeCy'] + og.SH_DY * PX - h / 2, flip=(F['face'] == 'left'))
    return fr


def grid():
    """where the sheet's 13 px art squares start"""
    sheet = Image.open(os.path.join(SITE, 'public', 'assets', 'banana-dance.png')).convert('RGBA')
    px = sheet.load()
    w, h = sheet.size
    xs = [x for x in range(FW) if any(px[x, y][3] > 0 for y in range(0, h, 3))]
    ys = [y for y in range(h) if any(px[x, y][3] > 0 for x in range(0, FW, 3))]
    return xs[0] % PX, ys[0] % PX


OX, OY = grid()


def to_art(fr):
    cols, rows = (FW - OX) // PX, (FH + PAD - OY) // PX
    out = Image.new('RGBA', (cols, rows), (0, 0, 0, 0))
    src, dst = fr.load(), out.load()
    for r in range(rows):
        for c in range(cols):
            dst[c, r] = src[OX + c * PX + PX // 2, OY + r * PX + PX // 2]
    return out


if __name__ == '__main__':
    strips = []
    for name, o in ROWS:
        frames = [to_art(frame(i, **o)) for i in range(8)]
        strips.append(frames)
    w, h = strips[0][0].size
    sheet = Image.new('RGBA', (w * 8, h * len(ROWS)), (0, 0, 0, 0))
    for r, frames in enumerate(strips):
        for i, f in enumerate(frames):
            sheet.paste(f, (i * w, r * h))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sheet.save(OUT, optimize=True)
    print('wrote %s — %d outfits, frame %dx%d, sheet %dx%d, %.1f KB' % (os.path.relpath(OUT, SITE), len(ROWS), w, h, *sheet.size, os.path.getsize(OUT) / 1024))
