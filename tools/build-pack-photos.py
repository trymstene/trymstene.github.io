"""The sticker packs' PRODUCT PHOTOS for the web, from Trym's originals in tools/pack-photos/.

Trym, 18 Sep 2026: the photos are of pack #4 (Party), added to EVERY pack's pictures so a buyer sees the
real printed thing — so each carries a stamp saying it is a real product photo of a printed pack, for
finish and size, and not necessarily the pack they are looking at. The stamp's words come from the copy
rig (src/data/copy/pack-photos.json), never from here.

    python tools/build-pack-photos.py

Writes public/assets/packs/photos/packs-photo-<n>.jpg (1600 px wide, JPEG 85), one per original, in
the order of PHOTOS below. The originals stay in tools/pack-photos/ and never ship.
"""
import io, json, os
from PIL import Image, ImageDraw, ImageFont, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(HERE, 'pack-photos')
OUT = os.path.join(ROOT, 'public', 'assets', 'packs', 'photos')
COPY = os.path.join(ROOT, 'src', 'data', 'copy', 'pack-photos.json')
# the originals, in the order they show on a pack's page; the coin photo carries its own second line
PHOTOS = [('pack-4-sleeve.jpeg', False), ('pack-4-sheet.jpeg', False), ('pack-4-coin.jpeg', True)]
W = 1600


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


def main():
    words = json.load(io.open(COPY, encoding='utf-8'))
    line, coin = words['stamp'], words.get('coin', '')
    os.makedirs(OUT, exist_ok=True)
    for i, (name, has_coin) in enumerate(PHOTOS, 1):
        im = Image.open(os.path.join(SRC, name))
        im = ImageOps.exif_transpose(im).convert('RGB')
        im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
        px = 34
        st = stamp(line, px)
        while st.width > W * 0.92 and px > 22:   # a long line shrinks until the sticker fits the photo
            px -= 2; st = stamp(line, px)
        im.paste(st, (28, 28), st)
        if has_coin and coin:
            c = stamp(coin, 28, angle=2.5)
            im.paste(c, (W - c.width - 28, im.height - c.height - 28), c)
        out = os.path.join(OUT, 'packs-photo-%d.jpg' % i)
        im.save(out, 'JPEG', quality=85, optimize=True, progressive=True)
        print('  %s  %dx%d  %d KB' % (os.path.relpath(out, ROOT), im.width, im.height, os.path.getsize(out) // 1024))


if __name__ == '__main__':
    main()
