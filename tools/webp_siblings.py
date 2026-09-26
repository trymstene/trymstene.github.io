# -*- coding: utf-8 -*-
"""webp_siblings.py — the WebP files the pages actually show, next to the files the tools make (26 Sep 2026).

The front-page speed audit: on a throttled phone the page downloaded 1.6 MB, and 1.09 MB of it was the world strip's
four JPG slides and eight JPG feature cards, fetched right after the first paint (Chrome starts lazy images long
before they are scrolled to). The same pictures as WebP, at the size they are shown, are about 406 KB; the banana GIF
is 39 KB and the same eight frames as lossless animated WebP are 3.3 KB, pixel for pixel; a pack sticker is drawn at
462x500 and shown at most 150 px tall in the sticker band.

The exporters call these as they write their own files, so a sibling can never go stale:
    tools/reel/export_hero.py    hero-*.jpg   -> hero-*.webp             (1400x600, q78)
    tools/reel/export_stills.py  feat-*.jpg   -> feat-*.webp + -480.webp (640x800 and 480x600, q78)
    tools/build-pack-art.py      <slug>.webp  -> <slug>-sm.webp          (300 px tall, lossless)

    python tools/webp_siblings.py     # remakes every sibling from what is on disk now
"""
import glob
import os

from PIL import Image

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORLD = os.path.join(SITE, 'public', 'assets', 'world')
STICKERS = os.path.join(SITE, 'public', 'assets', 'packs', 'stickers')
BANANA = os.path.join(SITE, 'public', 'assets', 'dancing-banana-transparent.gif')
Q = dict(quality=78, method=6)
STICKER_H = 300   # the band shows a sticker at most 150 CSS px tall: 300 covers a 2x screen


def _stem(path):
    return os.path.splitext(path)[0]


def slide(im, jpg_path):
    """a world-strip slide: the same picture as WebP"""
    out = _stem(jpg_path) + '.webp'
    im.convert('RGB').save(out, 'WEBP', **Q)
    return os.path.getsize(out)


def card(im, jpg_path):
    """a feature card: 640 wide for sharp screens, 480 for the rest"""
    rgb = im.convert('RGB')
    rgb.save(_stem(jpg_path) + '.webp', 'WEBP', **Q)
    rgb.resize((480, round(rgb.height * 480 / rgb.width)), Image.LANCZOS).save(_stem(jpg_path) + '-480.webp', 'WEBP', **Q)
    return os.path.getsize(_stem(jpg_path) + '.webp') + os.path.getsize(_stem(jpg_path) + '-480.webp')


def sticker_sm(st, webp_path):
    """a pack sticker for the band: 300 px tall, lossless like its original"""
    out = _stem(webp_path) + '-sm.webp'
    w = round(st.width * STICKER_H / st.height)
    st.resize((w, STICKER_H), Image.BOX).save(out, 'WEBP', lossless=True, method=6)
    return os.path.getsize(out)


def banana():
    """the 1999 banana's eight frames as lossless animated WebP: the same pixels, the same 100 ms"""
    g = Image.open(BANANA)
    frames, durs = [], []
    for i in range(g.n_frames):
        g.seek(i)
        frames.append(g.convert('RGBA'))
        durs.append(g.info.get('duration', 100))
    out = _stem(BANANA) + '.webp'
    frames[0].save(out, 'WEBP', save_all=True, append_images=frames[1:], duration=durs, loop=0, lossless=True, method=6)
    check = Image.open(out)
    assert check.n_frames == len(frames), 'the WebP lost frames'
    for i in range(check.n_frames):
        check.seek(i)
        a, b = check.convert('RGBA'), frames[i]
        pa, pb = a.load(), b.load()
        for y in range(a.height):
            for x in range(a.width):
                if pa[x, y][3] != pb[x, y][3] or (pb[x, y][3] and pa[x, y][:3] != pb[x, y][:3]):
                    raise SystemExit('frame %d differs at %d,%d: the WebP is not the GIF' % (i, x, y))
    return os.path.getsize(out)


if __name__ == '__main__':
    total = 0
    for p in sorted(glob.glob(os.path.join(WORLD, 'hero-*.jpg'))):
        total += slide(Image.open(p), p)
    for p in sorted(glob.glob(os.path.join(WORLD, 'feat-*.jpg'))):
        total += card(Image.open(p), p)
    for p in sorted(glob.glob(os.path.join(STICKERS, '*.webp'))):
        if not p.endswith('-sm.webp'):
            total += sticker_sm(Image.open(p).convert('RGBA'), p)
    total += banana()
    print('wrote the WebP siblings: %.0f KB in all' % (total / 1024))
