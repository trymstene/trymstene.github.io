# -*- coding: utf-8 -*-
"""build-pack-art.py - the pictures that SELL the sticker packs.

A sheet with six bananas in a grid is what the buyer receives; it is not what
makes them want it (Trym, 5 Sep: "rotate and animate each sticker, or create a
fun spread with all the stickers overlapping eachother"). So, per pack:

  public/assets/packs/pack-N-spread.webp    1200x1200  six stickers on banana paper,
                                            the pack's named sticker front and
                                            centre, EVERY face visible
  public/assets/packs/pack-N-card.webp       600x600   the same, for grids
  public/assets/packs/pack-N-sheet.webp     1200x1700  the A5 exactly as it prints
  public/assets/packs/stickers/<slug>.webp  one kiss-cut sticker on transparency,
                                            for the pages to lay out and animate
  public/assets/packs/series-1-strip.webp   1600x640   the eight heroes, one banner
  public/assets/og/sticker-packs.png        1200x630   the same for link previews
  print-files/sticker-packs/mockups/*.png   the spreads as PNG for Shopify
  src/data/pack-art.json                    what exists, for the site to import

    python tools/build-pack-art.py

Art comes from the same renderers as the print files (build-sticker-packs.py),
so what is shown is what is printed. Resampling is NEAREST only.
"""
import os, sys, json, random, re
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import importlib.util as _ilu
_spec = _ilu.spec_from_file_location('build_sticker_packs', os.path.join(HERE, 'build-sticker-packs.py'))
BSP = _ilu.module_from_spec(_spec); _spec.loader.exec_module(BSP)   # PACKS, art_for

ROOT = os.path.join(HERE, '..')
OUT = os.path.join(ROOT, 'public', 'assets', 'packs')
STK = os.path.join(OUT, 'stickers')
MOCK = os.path.join(ROOT, 'print-files', 'sticker-packs', 'mockups')
OG = os.path.join(ROOT, 'public', 'assets', 'og')
YELLOW = (255, 225, 53, 255)
INK = (17, 17, 17, 255)
WHITE = (255, 255, 255, 255)
PAPER = (250, 246, 238, 255)
PRICE = 9.99
WEBP = dict(lossless=True, quality=100, method=6)


def font(px):
    try: return ImageFont.truetype(os.path.join(HERE, 'ArchivoBlack.ttf'), px)
    except Exception: return ImageFont.load_default()


def slug(label):
    return re.sub('-+', '-', re.sub('[^a-z0-9]+', '-', label.lower())).strip('-')


def fit(a, T):
    """Scale art so a banana-shaped sticker is T tall. A captioned SQUARE is a
    solid block of colour and would dwarf a banana at the same height, so the
    opaque share of the box pulls its size down (a full square lands at ~78%)."""
    solid = a.getchannel('A').point(lambda v: 255 if v > 40 else 0).histogram()[255]
    opaque = solid / float(a.width * a.height)
    k = min(1.0, max(0.72, (opaque / 0.36) ** -0.25))
    f = T * k / a.height
    return a.resize((max(1, int(a.width * f)), max(1, int(a.height * f))), Image.NEAREST), k


def kiss_cut(art, border, shadow=True):
    """A real sticker: the art on its white kiss-cut backing (the alpha grown by
    `border` px) with a soft shadow. Returns RGBA, a little bigger than the art."""
    pad = border * 2 + (16 if shadow else 0)
    W, H = art.width + pad * 2, art.height + pad * 2
    a = Image.new('L', (W, H), 0)
    a.paste(art.getchannel('A'), (pad, pad))
    grown = a.filter(ImageFilter.MaxFilter(border * 2 + 1))
    backing = Image.new('RGBA', (W, H), (255, 255, 255, 0))
    backing.putalpha(grown)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    if shadow:
        sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        sh.putalpha(grown.point(lambda v: int(v * 0.30)))
        out.alpha_composite(sh.filter(ImageFilter.GaussianBlur(9)), (6, 10))
    out.alpha_composite(backing)
    out.alpha_composite(art, (pad, pad))
    return out


def pill(text, px=44, fill=INK, ink=YELLOW, tilt=-4):
    f = font(px)
    tw = int(f.getlength(text))
    im = Image.new('RGBA', (tw + px, px + px // 2 + 10), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, im.width - 1, im.height - 1], fill=fill, outline=INK, width=4)
    d.text((px // 2, px // 4), text, font=f, fill=ink)
    return im.rotate(tilt, expand=True, resample=Image.BICUBIC)


def place(im, st, cx, cy):
    im.alpha_composite(st, (int(cx - st.width / 2), int(cy - st.height / 2)))


# 6 seats, a group photo: the Original peeks over the hero's shoulder, two
# stand behind, two stand beside, the pack's named sticker is front and centre
# and drawn last. Faces sit in the top third of every sticker, and no seat's
# top third is under another sticker - checked by eye on every pack, 5 Sep.
SEATS = [  # (index in the pack, x, y, height share, max tilt, jitter)
    (2, 0.18, 0.41, 0.36, 12, 16),   # back left
    (3, 0.82, 0.41, 0.36, 12, 16),   # back right
    (0, 0.50, 0.37, 0.36, 8, 12),    # the Original, behind the hero
    (4, 0.19, 0.73, 0.38, 10, 12),   # front left
    (5, 0.81, 0.73, 0.38, 10, 12),   # front right
    (1, 0.50, 0.68, 0.52, 5, 8),     # THE HERO
]


def spread(pack, cells, size=1200):
    rnd = random.Random(100 + int(pack))
    im = Image.new('RGBA', (size, size), YELLOW)
    arts = [BSP.art_for(c, 1)[0] for c in cells]
    for idx, fx, fy, share, tilt, jit in SEATS:
        a, k = fit(arts[idx], size * share)
        # a captioned square tilts less: its bottom line of text is what a
        # neighbour in front would cover first
        tilt = tilt * (0.6 if k < 0.9 else 1.0)
        st = kiss_cut(a, border=12).rotate(rnd.uniform(-tilt, tilt), expand=True, resample=Image.BICUBIC)
        place(im, st, size * fx + rnd.uniform(-jit, jit), size * fy + rnd.uniform(-jit, jit) * 0.7)
    im.alpha_composite(pill('PACK %s' % pack, px=52), (44, 40))
    six = pill('6 STICKERS', px=32, fill=WHITE, ink=INK, tilt=4)
    im.alpha_composite(six, (size - six.width - 40, 44))
    return im


def sheet_on_white(pack):
    p = os.path.join(ROOT, 'print-files', 'sticker-packs', 'pack-%s-print.png' % pack)
    art = Image.open(p).convert('RGBA')
    W, H = 1200, 1700
    im = Image.new('RGBA', (W, H), PAPER)
    sw = 1000; sh = int(sw * art.height / art.width)
    a = art.resize((sw, sh), Image.NEAREST)
    shadow = Image.new('RGBA', (sw + 60, sh + 60), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle([30, 30, sw + 30, sh + 30], fill=(0, 0, 0, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    x, y = (W - sw) // 2, (H - sh) // 2
    im.alpha_composite(shadow, (x - 22, y - 16))
    page = Image.new('RGBA', (sw, sh), WHITE)
    page.alpha_composite(a)
    im.alpha_composite(page, (x, y))
    ImageDraw.Draw(im).rectangle([x, y, x + sw - 1, y + sh - 1], outline=(0, 0, 0, 40), width=1)
    return im


def heroes():
    return [(BSP.PACKS[k][1], k) for k in sorted(BSP.PACKS, key=int)]


def strip(size=(1600, 640), labels=True):
    """All eight heroes tumbling across a banner, biggest in the middle. Labels
    sit at the top so nobody's feet are under a pill; the outer seats keep
    clear of the edges."""
    W, H = size
    rnd = random.Random(2026)
    im = Image.new('RGBA', (W, H), YELLOW)
    hs = heroes(); n = len(hs)
    for i, (cell, pack) in enumerate(hs):
        mid = abs(i - (n - 1) / 2) / ((n - 1) / 2)          # 0 centre .. 1 edge
        a, _ = fit(BSP.art_for(cell, 1)[0], H * (0.60 - 0.20 * mid))
        st = kiss_cut(a, border=10).rotate(rnd.uniform(-16, 16), expand=True, resample=Image.BICUBIC)
        cx = W * (0.10 + 0.80 * i / (n - 1)) + rnd.uniform(-10, 10)
        cy = H * 0.58 + rnd.uniform(-24, 24) + (22 if i % 2 else -22)
        place(im, st, cx, cy)
    if labels:
        im.alpha_composite(pill('SERIES 1  8 PACKS  48 STICKERS', px=int(H * 0.06)), (int(W * 0.025), int(H * 0.05)))
        pr = pill('$%.2f A PACK' % PRICE, px=int(H * 0.06), fill=WHITE, ink=INK, tilt=3)
        im.alpha_composite(pr, (W - pr.width - int(W * 0.025), int(H * 0.05)))
    return im


def save_webp(im, path, lossy=False):
    # the soft shadows and rotated edges defeat lossless (215 KB a spread);
    # q88 is indistinguishable at 1200 and half the weight. Flat sheets and the
    # transparent cut-outs stay lossless, where it is both smaller and exact.
    im.save(path, 'WEBP', **(dict(quality=88, method=6) if lossy else WEBP))
    return os.path.getsize(path)


def main():
    for d in (OUT, STK, MOCK, OG): os.makedirs(d, exist_ok=True)
    manifest = {'price': PRICE, 'packs': {}}
    done = {}
    total = 0
    for pack in sorted(BSP.PACKS, key=int):
        cells = BSP.PACKS[pack]
        sp = spread(pack, cells)
        sp.convert('RGB').save(os.path.join(MOCK, 'pack-%s-spread.png' % pack), optimize=True)
        total += save_webp(sp.convert('RGB'), os.path.join(OUT, 'pack-%s-spread.webp' % pack), lossy=True)
        total += save_webp(sp.convert('RGB').resize((600, 600), Image.BOX), os.path.join(OUT, 'pack-%s-card.webp' % pack), lossy=True)
        total += save_webp(sheet_on_white(pack).convert('RGB'), os.path.join(OUT, 'pack-%s-sheet.webp' % pack))
        entries = []
        for i, cell in enumerate(cells):
            a, label = BSP.art_for(cell, 1)
            # gallery titles end in " Banana" ("Viking Banana"); on a pack it is the
            # sticker's name, and every sticker is a banana
            label = label[:-7] if label.endswith(' Banana') else label
            s = slug(label)
            key = json.dumps(cell, sort_keys=True) if isinstance(cell, dict) else cell
            if s in done and done[s][2] != key:
                raise SystemExit('two different stickers share the slug %r' % s)
            if s not in done:
                st = kiss_cut(fit(a, 420)[0], border=12)
                total += save_webp(st, os.path.join(STK, s + '.webp'))
                done[s] = (st.width, st.height, key)
            w, h, _ = done[s]
            entries.append({'name': label, 'slug': s, 'w': w, 'h': h, 'hero': i == 1})
        manifest['packs'][pack] = entries
        print('  pack %s: spread + card + sheet' % pack)
    total += save_webp(strip().convert('RGB'), os.path.join(OUT, 'series-1-strip.webp'), lossy=True)
    strip((1200, 630)).convert('RGB').save(os.path.join(OG, 'sticker-packs.png'), optimize=True)
    with open(os.path.join(ROOT, 'src', 'data', 'pack-art.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)
    print('  %d stickers cut out, %.0f KB of webp for the site' % (len(done), total / 1024))


if __name__ == '__main__':
    main()
