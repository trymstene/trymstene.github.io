# -*- coding: utf-8 -*-
"""Recover the Dancing Banana's TRUE pixel grid from the HD remaster.

`public/assets/dancing-banana-hd.gif` is 2000x2000, 8 frames — but its blocks
measure ~52.3px, alternating 52/53. The remaster was fitted to a round 2000,
not scaled by an integer, so the file itself carries uneven pixels. Anything
that rescales it inherits them: that is the "fat arms and legs" defect.

So: sample each logical cell once, rebuild the sprite at its native block size
(a small indexed image), and let callers NEAREST-scale that by whatever integer
they need. Crisp at any print size, edges exactly where Trym drew them.

    from banana_grid import frames, GRID
    fs = frames()            # 8 RGBA images at native grid size
    big = fs[0].resize((w*24, h*24), Image.NEAREST)

Run directly to verify the recovered grid against the master.
"""
import os
import sys

from PIL import Image

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HD = os.path.join(REPO, 'public', 'assets', 'dancing-banana-hd.gif')


def _sheet():
    """The 8 frames at full 2000px, cropped to the UNION bbox so they stay in
    register with each other (per-frame bboxes would make the banana jitter)."""
    im = Image.open(HD)
    raw = []
    for i in range(im.n_frames):
        im.seek(i)
        raw.append(im.convert('RGBA'))
    box = None
    for f in raw:
        b = f.getbbox()
        box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]),
                                     max(box[2], b[2]), max(box[3], b[3]))
    return [f.crop(box) for f in raw]


def _best_grid(img, lo=12, hi=48):
    """The cell count whose centre-sampled reconstruction best matches the
    master. Scores every candidate instead of trusting a measured run length —
    a single stray run would otherwise pick the wrong grid silently."""
    best, best_err = None, None
    for cols in range(lo, hi + 1):
        rows = max(1, round(cols * img.height / img.width))
        small = _sample(img, cols, rows)
        back = small.resize(img.size, Image.NEAREST)
        err = _diff(img, back)
        if best_err is None or err < best_err:
            best, best_err = (cols, rows), err
    return best, best_err


def _sample(img, cols, rows):
    """One sample per logical cell, taken at the cell's CENTRE — averaging
    would blend neighbouring pixels across the block seams."""
    px = img.load()
    out = Image.new('RGBA', (cols, rows), (0, 0, 0, 0))
    op = out.load()
    for r in range(rows):
        y = min(img.height - 1, int((r + 0.5) * img.height / rows))
        for c in range(cols):
            x = min(img.width - 1, int((c + 0.5) * img.width / cols))
            op[c, r] = px[x, y]
    return out


def _diff(a, b):
    pa, pb = a.load(), b.load()
    tot = 0
    for y in range(0, a.height, 3):          # every 3rd row is plenty at 1500px
        for x in range(0, a.width, 3):
            r1, g1, b1, a1 = pa[x, y]
            r2, g2, b2, a2 = pb[x, y]
            tot += abs(r1 - r2) + abs(g1 - g2) + abs(b1 - b2) + abs(a1 - a2)
    return tot / ((a.width // 3 + 1) * (a.height // 3 + 1))


_cache = None
GRID = None


def frames():
    """8 RGBA frames at the recovered native grid size."""
    global _cache, GRID
    if _cache is None:
        big = _sheet()
        (cols, rows), _ = _best_grid(big[0])
        GRID = (cols, rows)
        _cache = [_sample(f, cols, rows) for f in big]
    return _cache


if __name__ == '__main__':
    o = lambda s: sys.stdout.buffer.write((s + '\n').encode('utf-8', 'replace'))
    big = _sheet()
    o('master frames: %d, union bbox %dx%d' % (len(big), big[0].width, big[0].height))
    for cols in range(18, 26):
        rows = max(1, round(cols * big[0].height / big[0].width))
        err = _diff(big[0], _sample(big[0], cols, rows).resize(big[0].size, Image.NEAREST))
        o('   %2dx%-2d  err %7.2f' % (cols, rows, err))
    fs = frames()
    o('RECOVERED GRID: %dx%d  (block ~%.2fpx)' % (GRID[0], GRID[1], big[0].width / GRID[0]))
    strip = Image.new('RGBA', (GRID[0] * 8 * 12, GRID[1] * 12), (0, 0, 0, 0))
    for i, f in enumerate(fs):
        strip.alpha_composite(f.resize((GRID[0] * 12, GRID[1] * 12), Image.NEAREST), (i * GRID[0] * 12, 0))
    p = os.path.join(os.environ.get('TEMP', '.'), 'banana-grid-check.png')
    strip.save(p)
    o('wrote %s' % p)
