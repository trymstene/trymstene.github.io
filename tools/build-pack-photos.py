"""The sticker packs' PRODUCT PHOTOS for the web, from Trym's originals in tools/pack-photos/.

Trym, 18 Sep 2026: the photos are of pack #4 (Party), added to EVERY pack's pictures so a buyer sees the
real printed thing — so each carries a stamp saying it is a real product photo of a printed pack, for
finish and size, and not necessarily the pack they are looking at. The stamp's words come from the copy
rig (src/data/copy/pack-photos.json), never from here.

    python tools/build-pack-photos.py

Writes two SQUARE sets (1200 px, JPEG 85 — the product frame is square, a 4:3 photo left white bands):
  public/assets/packs/photos/packs-photo-<n>.jpg   stamped "not this pack" — shown on every other pack's page
  public/assets/packs/photos/pack-4-photo-<n>.jpg  stamped as the pack's own — shown on the Party pack's page
one per original, in the order of PHOTOS below. The originals stay in tools/pack-photos/ and never ship.
"""
import io, json, os
from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, 'pack-photos')
OUT = os.path.join(ROOT, 'public', 'assets', 'packs', 'photos')
COPY = os.path.join(ROOT, 'src', 'data', 'copy', 'pack-photos.json')
# the originals, in the order they show on a pack's page; the coin photo carries its own second line; the third
# number nudges the square crop's centre (a share of the width, + = right) so the sheet's corner is never cut
PHOTOS = [('pack-4-sleeve.jpeg', False, 0.0), ('pack-4-sheet.jpeg', False, -0.02), ('pack-4-coin.jpeg', True, -0.04)]
W = 1200


def font(px):
    try:
        return ImageFont.truetype(os.path.join(HERE, 'ArchivoBlack.ttf'), px)
    except Exception:
        return ImageFont.load_default()


def stamp(text, px, pad=18, angle=-3.0):
    """A yellow sticker with black type, the site's plank look, rotated a touch."""
    f = font(px)
    tmp = ImageDraw.Draw(Image.new('RGBA', (10, 10)))
    x0, y0, x1, y1 = tmp.textbbox((0, 0), text, font=f)
    tw, th = x1 - x0, y1 - y0
    bw, bh = tw + pad * 2, th + pad * 2
    s = Image.new('RGBA', (bw + 12, bh + 12), (0, 0, 0, 0))
    d = ImageDraw.Draw(s)
    d.rectangle((6, 8, 6 + bw, 8 + bh), fill=(0, 0, 0, 110))                     # the drop shadow
    d.rectangle((0, 0, bw, bh), fill=(255, 225, 53, 255), outline=(20, 18, 8, 255), width=4)
    d.text((pad - x0, pad - y0), text, font=f, fill=(20, 18, 8, 255))
    return s.rotate(angle, expand=True, resample=Image.BICUBIC)


def square(im, nudge):
    """The centre square of a landscape photo, its centre nudged by a share of the width."""
    side = min(im.size)
    x0 = (im.width - side) // 2 + round(nudge * im.width)
    x0 = max(0, min(im.width - side, x0))
    y0 = (im.height - side) // 2
    return im.crop((x0, y0, x0 + side, y0 + side))


def bake(im, line, coin_line):
    im = im.copy()
    px = 30
    st = stamp(line, px)
    while st.width > W * 0.92 and px > 20:   # a long line shrinks until the sticker fits the photo
        px -= 2; st = stamp(line, px)
    im.paste(st, (24, 24), st)
    if coin_line:
        c = stamp(coin_line, 26, angle=2.5)
        im.paste(c, (W - c.width - 24, im.height - c.height - 24), c)
    return im


def main():
    words = json.load(io.open(COPY, encoding='utf-8'))
    coin = words.get('coin', '')
    os.makedirs(OUT, exist_ok=True)
    for i, (name, has_coin, nudge) in enumerate(PHOTOS, 1):
        im = Image.open(os.path.join(SRC, name))
        im = ImageOps.exif_transpose(im).convert('RGB')
        im = square(im, nudge).resize((W, W), Image.LANCZOS)
        for prefix, line in (('packs-photo', words['stamp']), ('pack-4-photo', words.get('stampOwn') or words['stamp'])):
            out = os.path.join(OUT, '%s-%d.jpg' % (prefix, i))
            bake(im, line, coin if has_coin else '').save(out, 'JPEG', quality=85, optimize=True, progressive=True)
            print('  %s  %dx%d  %d KB' % (os.path.relpath(out, ROOT), W, W, os.path.getsize(out) // 1024))


if __name__ == '__main__':
    main()
