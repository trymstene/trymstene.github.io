# -*- coding: utf-8 -*-
"""build-hero-dancers.py — the backup dancers on the homepage hero (26 Sep 2026).

Trym: "the dancing banana in a big white space … a bit stiff and boring". The hero's big banana dances with a crew
either side, each in an outfit from the builder, on the same beat.

⭐ THE BUILDER'S OWN RENDER, RESIZED ONCE. Trym, on the first version: "they contain many pixel errors and looks a bit
broken in the details … Better to take the pure exports and resizing them." That version sampled each frame back onto
the banana's 13 px art grid, and a hat does not sit on that grid (the builder places it by its anchor, to the pixel),
so every hat lost cells. Now each frame is tools/banana_render.py at the builder's native size — the Python mirror of
drawComposite that the print-parity rig holds to the builder — cropped on whole art cells and resized ONCE with an
area filter to exactly 6 px an art pixel (design library §6: crop each frame at the source size, resize it on its own).
The page shows 2 or 3 CSS px an art pixel, which is one file pixel per device pixel on a 3x phone and a 2x laptop.

    python tools/build-hero-dancers.py     # public/assets/hero/dancer-<name>.webp + src/data/hero-dancers.json

One strip per outfit, eight frames across, so a phone (two dancers) downloads two strips and never the other six.
"""
import json
import math
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import banana_render as br  # noqa: E402

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SITE, 'public', 'assets', 'hero')
META = os.path.join(SITE, 'src', 'data', 'hero-dancers.json')
CELL = br.PX          # 13 px an art pixel in the builder's space
FILE_PX = 6           # file pixels an art pixel: 2 CSS px at 3x, 3 CSS px at 2x

# the crew, nearest the banana first on each side (the page's CREW_L / CREW_R index this list)
CREW = [
    ('party', dict(hat='party', glasses='hearts')),
    ('sombrero', dict(hat='sombrero')),
    ('duck', dict(hat='duckhat')),
    ('viking', dict(hat='viking')),
    ('crown', dict(hat='crown', glasses='shades')),
    ('cowboy', dict(hat='cowboy')),
    ('prop', dict(hat='beanieprop', glasses='nerd')),
    ('tophat', dict(hat='tophat', glasses='monocle')),
]


def grid_offset():
    """where the banana sheet's 13 px art cells start inside a frame"""
    sheet = br.sheet()
    px = sheet.load()
    xs = [x for x in range(br.FW) if any(px[x, y][3] > 0 for y in range(0, br.FH, 2))]
    ys = [y for y in range(br.FH) if any(px[x, y][3] > 0 for x in range(0, br.FW, 2))]
    return xs[0] % CELL, ys[0] % CELL


if __name__ == '__main__':
    pad = br.pad_for(1)
    frames = {name: [br.render(i, outfit, scale=1) for i in range(br.NFRAMES)] for name, outfit in CREW}
    # ONE box for every frame of every outfit, so the feet stand on one line and nothing slides between frames
    boxes = [im.getbbox() for fs in frames.values() for im in fs]
    left, top = min(b[0] for b in boxes), min(b[1] for b in boxes)
    right, bottom = max(b[2] for b in boxes), max(b[3] for b in boxes)
    # snapped outward onto the banana's own grid: every art cell of the banana lands on whole file pixels
    ox, oy = grid_offset()
    gx, gy = (pad + ox) % CELL, (pad + oy) % CELL
    x0 = gx + CELL * math.floor((left - gx) / CELL)
    y0 = gy + CELL * math.floor((top - gy) / CELL)
    cols = math.ceil((right - x0) / CELL)
    rows = math.ceil((bottom - y0) / CELL)
    if cols % 2:
        cols += 1                        # an even width keeps the crew box centred on whole pixels
    fw, fh = cols * FILE_PX, rows * FILE_PX
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for name, _ in CREW:
        strip = Image.new('RGBA', (fw * br.NFRAMES, fh), (0, 0, 0, 0))
        for i, im in enumerate(frames[name]):
            crop = im.crop((x0, y0, x0 + cols * CELL, y0 + rows * CELL))
            strip.paste(crop.resize((fw, fh), Image.Resampling.BOX), (i * fw, 0))
        path = os.path.join(OUT, 'dancer-%s.webp' % name)
        strip.save(path, 'WEBP', lossless=True, method=6)
        total += os.path.getsize(path)
        print('%-9s %dx%d  %.1f KB' % (name, strip.width, strip.height, os.path.getsize(path) / 1024))
    with open(META, 'w', encoding='utf-8') as f:
        json.dump({'cols': cols, 'rows': rows, 'filePx': FILE_PX, 'frames': br.NFRAMES, 'crew': [n for n, _ in CREW]}, f, indent=2)
        f.write('\n')
    print('frame %d x %d art px (%d x %d file px), %d strips, %.1f KB in all; wrote %s' % (
        cols, rows, fw, fh, len(CREW), total / 1024, os.path.relpath(META, SITE)))
