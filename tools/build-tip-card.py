#!/usr/bin/env python3
"""☕ THE TIP CHECKOUT CARD — the one image on Polar's checkout page.

Polar's checkout is whatever the product carries; with no media it is a wall
of grey and a card form. This is the picture that goes there: the hands-up
banana from the OG share cards, on a sunburst rather than a flat field, with
its coffee tilted into the front of the frame and a thank-you where the share
cards put their kicker.

Shares the OG cards' render_banana() so the banana is the SAME banana, drawn
by the same engine-exact math, not a crop of a screenshot.

    python tools/build-tip-card.py

⚠️ MEASURED ON THE LIVE CHECKOUT: Polar renders product media as a 24px
THUMBNAIL beside the product name, not as a hero image. The full card is
therefore for our own surfaces; `--thumb` writes the version that survives
being 24 pixels wide — no text, no sunburst, just a banana that still reads
as a banana at the size of a favicon.

Writes tools/out/tip-card.png (1000x1000) and tools/out/tip-thumb.png (512).
    POLAR_TOKEN=... node tools/polar-media.mjs <productId> tools/out/tip-thumb.png
"""
import importlib.util
import math
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'out')

# borrow the OG cards' banana renderer rather than re-deriving the anchors
spec = importlib.util.spec_from_file_location('ogc', os.path.join(HERE, 'build-og-cards.py'))
ogc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ogc)

S = 1000                      # square: the checkout panel is portrait-ish
BANANA = '#ffe135'
DEEP = '#f5c400'
INK = '#111111'
PINK = '#ff5a8a'


def sunburst(im):
    """⚠️ RAYS FROM A POINT, NOT STRIPES ACROSS THE CANVAS. Parallel bands read
    as a deckchair; rays converging behind the banana read as sunshine and put
    the eye on the thing standing in front of them."""
    d = ImageDraw.Draw(im)
    cx, cy = S * 0.5, S * 0.62         # behind the banana's chest
    R = S * 1.6
    rays = 16
    for i in range(rays):
        if i % 2:
            continue
        a0 = (i / rays) * 2 * math.pi
        a1 = ((i + 1) / rays) * 2 * math.pi
        d.polygon([(cx, cy),
                   (cx + R * math.cos(a0), cy + R * math.sin(a0)),
                   (cx + R * math.cos(a1), cy + R * math.sin(a1))], fill=DEEP)


def mug():
    """the cup out of the coffee poster, kept as its own object so it can be
    tilted independently of the banana"""
    src = Image.open(os.path.join(SITE, 'public', 'assets', 'gallery-posters', 'coffee.png')).convert('RGBA')
    # the mug sits left of the banana; crop generously, then trim to its ink
    # ⚠️ crop BELOW the poster's own steam — it is drawn separately here, and
    # two sets of steam at two scales reads as confetti
    cut = src.crop((112, 296, 212, 366))
    return cut.crop(cut.getbbox())


def main():
    os.makedirs(OUT, exist_ok=True)
    im = Image.new('RGBA', (S, S), BANANA)
    sunburst(im)

    # the banana, hands up — pose 2, the one the share cards use
    b = ogc.render_banana(2)
    b = b.crop(b.getbbox())
    bh = int(S * 0.60)
    bw = round(b.width * bh / b.height)
    b = b.resize((bw, bh), Image.NEAREST)
    bx, by = (S - bw) // 2, int(S * 0.30)
    im.alpha_composite(b, (bx, by))

    # ☕ the cup, tilted, IN FRONT and overlapping — depth from one object
    # crossing another, which is the whole reason it is not just a sticker
    m = mug()
    mh = int(S * 0.125)
    mw = round(m.width * mh / m.height)
    m = m.resize((mw, mh), Image.NEAREST)
    # ⚠️ NEAREST on the rotate too. BICUBIC feathers every edge, and a soft
    # mug in front of a hard-edged banana looks like a mistake, not depth.
    m = m.rotate(-9, resample=Image.NEAREST, expand=True)
    im.alpha_composite(m, (int(S * 0.175), int(S * 0.735)))

    # steam, drifting off the cup
    d = ImageDraw.Draw(im)
    for x, y, w, h in [(0.232, 0.700, 0.015, 0.015), (0.262, 0.672, 0.015, 0.015),
                       (0.238, 0.645, 0.015, 0.015), (0.272, 0.620, 0.015, 0.015)]:
        d.rectangle([S * x, S * y, S * (x + w), S * (y + h)], fill='#ffffff')

    # the thank-you, where the share cards put their kicker
    # ⚠️ the site ships woff2, which PIL cannot read — the share cards keep a
    # TTF beside them for exactly this, and it is the same typeface
    font = ImageFont.truetype(os.path.join(HERE, 'ArchivoBlack.ttf'), 92)
    text = 'THANK YOU'
    tb = d.textbbox((0, 0), text, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    pad = 26
    tx, ty = (S - tw) // 2, int(S * 0.085)
    d.rectangle([tx - pad, ty - pad + 4, tx + tw + pad, ty + th + pad], fill=PINK, outline=INK, width=6)
    d.text((tx - tb[0], ty - tb[1]), text, font=font, fill='#ffffff')

    # the frame, last, over everything — the site's own edge
    for i in range(14):
        d.rectangle([i, i, S - 1 - i, S - 1 - i], outline=INK)

    p = os.path.join(OUT, 'tip-card.png')
    im.convert('RGB').save(p)
    print('wrote', p, im.size)


def thumb():
    """⚠️ 24 PIXELS IS THE BRIEF. At that size a sunburst is noise, text is a
    smudge and a full-body banana is a yellow smear — so this is the FACE,
    cropped close and filling the frame, which still reads at any size."""
    T = 512
    im = Image.new('RGBA', (T, T), BANANA)
    b = ogc.render_banana(2)
    b = b.crop(b.getbbox())
    # ⚠️ CROP PAST THE ARMS. They span three times the body's width, so keeping
    # them forces the whole banana down to a speck to fit — at 24px the face is
    # the only part that carries any information at all.
    b = b.crop((int(b.width * 0.30), 0, int(b.width * 0.70), int(b.height * 0.46)))
    b = b.crop(b.getbbox())
    h = int(T * 0.86)
    w = round(b.width * h / b.height)
    if w > T * 0.86:
        w = int(T * 0.86); h = round(b.height * w / b.width)
    b = b.resize((w, h), Image.NEAREST)
    im.alpha_composite(b, ((T - w) // 2, (T - h) // 2))
    d = ImageDraw.Draw(im)
    for i in range(12):
        d.rectangle([i, i, T - 1 - i, T - 1 - i], outline=INK)
    p = os.path.join(OUT, 'tip-thumb.png')
    im.convert('RGB').save(p)
    print('wrote', p, im.size)


if __name__ == '__main__':
    main()
    thumb()
