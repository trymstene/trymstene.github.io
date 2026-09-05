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
import os, sys, json, math, random, re
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
DEEP = (245, 196, 0, 255)            # the sunburst ray on banana yellow (tip card, pass)
HOT, HOT2 = (255, 77, 109, 255), (255, 122, 149, 255)
SKY, SKY2 = (127, 208, 245, 255), (166, 224, 250, 255)
CREAM2 = (255, 243, 176, 255)
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


def pill(text, px=44, fill=INK, ink=YELLOW, tilt=-4, outline=INK):
    f = font(px)
    tw = int(f.getlength(text))
    im = Image.new('RGBA', (tw + px, px + px // 2 + 10), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, im.width - 1, im.height - 1], fill=fill, outline=outline, width=4)
    d.text((px // 2, px // 4), text, font=f, fill=ink)
    return im.rotate(tilt, expand=True, resample=Image.BICUBIC)


def place(im, st, cx, cy):
    im.alpha_composite(st, (int(cx - st.width / 2), int(cy - st.height / 2)))


# ---- the grounds: eight moods, so eight packs never read as one -------------
# Trym, 5 Sep: "if all is yellow and looks the same, the stickers look the same
# when you throw fast glances at them". The painted ones follow the areas' own
# share cards (park-share.js, shareBeach, the rave card) and colours sampled
# from the world art; the sunbursts are the pass's rays in four colours.

def vgrad(w, h, c0, c1):
    mask = Image.linear_gradient('L').resize((w, h), Image.BILINEAR)
    return Image.composite(Image.new('RGBA', (w, h), c1), Image.new('RGBA', (w, h), c0), mask)


def rays(im, cx, cy, colour, n=16, spin=0.0):
    """Alternating wedges from a point - rays, never stripes (tip-card rule) -
    drawn at 2x and boxed down so the edges are smooth."""
    W, H = im.size
    lay = Image.new('RGBA', (W * 2, H * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    R = max(W, H) * 3.2
    for i in range(0, n, 2):
        a0 = spin + i / n * 2 * math.pi
        a1 = spin + (i + 1) / n * 2 * math.pi
        d.polygon([(cx * 2, cy * 2),
                   (cx * 2 + R * math.cos(a0), cy * 2 + R * math.sin(a0)),
                   (cx * 2 + R * math.cos(a1), cy * 2 + R * math.sin(a1))], fill=colour)
    im.alpha_composite(lay.resize((W, H), Image.BOX))


def glow(im, cx, cy, r, colour):
    """a soft round light, colour's alpha at the centre fading out by r"""
    r = int(r)
    mask = Image.radial_gradient('L').resize((r * 2, r * 2), Image.BILINEAR)
    mask = mask.point(lambda v: (255 - v) * colour[3] // 255)
    spot = Image.new('RGBA', (r * 2, r * 2), colour[:3] + (255,))
    spot.putalpha(mask)
    lay = Image.new('RGBA', im.size, (0, 0, 0, 0))
    lay.alpha_composite(spot, (int(cx - r), int(cy - r)))
    im.alpha_composite(lay)


def burst(base, ray, w, h, cx=0.5, cy=0.62):
    im = Image.new('RGBA', (w, h), base)
    rays(im, w * cx, h * cy, ray)
    return im


def flowers(d, x, y, col, s):
    k = s / 1200
    for dx, dy in ((0, 0), (-34, 18), (30, 22)):
        px, py = x + dx * k, y + dy * k
        d.rectangle([px - 2 * k, py, px + 2 * k, py + 16 * k], fill=(44, 107, 44, 255))
        d.ellipse([px - 11 * k, py - 11 * k, px + 11 * k, py + 11 * k], fill=col)
        d.ellipse([px - 4 * k, py - 4 * k, px + 4 * k, py + 4 * k], fill=(255, 253, 240, 255))


def paint_park(s):
    """the park's share card: lawn, the woods along the top, sun, flower clusters"""
    im = vgrad(s, s, (184, 212, 120, 255), (134, 174, 82, 255))
    im.alpha_composite(vgrad(s, int(s * 0.30), (47, 143, 69, 255), (84, 184, 106, 255)), (0, 0))
    d = ImageDraw.Draw(im)
    for i in range(-1, 14):
        x = i * s / 12 + (s / 24 if i % 2 else 0)
        d.ellipse([x - s * 0.06, s * 0.30 - s * 0.07, x + s * 0.06, s * 0.30 + s * 0.05], fill=(31, 92, 46, 255))
    rays(im, s * 0.78, s * 0.08, (255, 250, 205, 28), n=18)
    for fx, fy, col in ((0.34, 0.50, (255, 214, 232, 255)), (0.72, 0.72, (255, 225, 53, 255)),
                        (0.46, 0.86, (255, 253, 245, 255)), (0.10, 0.70, (255, 225, 53, 255)),
                        (0.90, 0.50, (255, 214, 232, 255))):
        flowers(d, fx * s, fy * s, col, s)
    return im


def paint_bay(s):
    """Banana Bay's postcard: sea along the top, sand, the sun and its rays"""
    im = vgrad(s, s, (242, 215, 155, 255), (230, 190, 124, 255))
    im.alpha_composite(vgrad(s, int(s * 0.34), (47, 143, 168, 255), (84, 182, 200, 255)), (0, 0))
    rays(im, s * 0.80, s * 0.14, (255, 236, 150, 44), n=20)
    glow(im, s * 0.80, s * 0.14, s * 0.30, (255, 236, 150, 190))
    d = ImageDraw.Draw(im)
    foam = [(x, s * 0.34 + math.sin(x / s * 2 * math.pi * 5) * s * 0.006) for x in range(0, s + 1, 8)]
    d.line(foam, fill=(255, 255, 255, 130), width=max(3, int(s * 0.008)))
    r = s * 0.06
    d.ellipse([s * 0.80 - r, s * 0.14 - r, s * 0.80 + r, s * 0.14 + r], fill=(255, 232, 154, 255))
    return im


def paint_rave(s):
    """the rave's card: the jelly floor, three spotlights, the yellow glow, sparkles"""
    im = Image.new('RGBA', (s, s), (22, 18, 31, 255))
    d = ImageDraw.Draw(im)
    cell = s // 10
    for yy in range(0, s, cell):
        for xx in range(0, s, cell):
            if (xx // cell + yy // cell) % 2:
                d.rectangle([xx, yy, xx + cell - 1, yy + cell - 1], fill=(28, 22, 40, 255))
    lay = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    for x0, x1, col in ((0.12, 0.62, (255, 77, 160, 60)), (0.50, 0.28, (80, 220, 200, 48)), (0.88, 0.46, (170, 90, 255, 56))):
        ld.polygon([(s * x0 - s * 0.05, -10), (s * x0 + s * 0.05, -10),
                    (s * x1 + s * 0.24, s + 10), (s * x1 - s * 0.24, s + 10)], fill=col)
    im.alpha_composite(lay)
    glow(im, s * 0.5, s * 0.74, s * 0.55, (255, 225, 53, 72))
    rnd = random.Random(5)
    for _ in range(14):
        x, y, k = rnd.randrange(s), rnd.randrange(int(s * 0.6)), rnd.choice((3, 4, 6))
        d.rectangle([x - k, y - 1, x + k, y + 1], fill=(255, 255, 255, 230))
        d.rectangle([x - 1, y - k, x + 1, y + k], fill=(255, 255, 255, 230))
    return im


def paint_meadow(s):
    """the homestead's meadow (grass #59a057 and path #ccaf7d sampled from the
    world art): light patches, tufts, the dirt path across the bottom, blooms"""
    im = Image.new('RGBA', (s, s), (89, 160, 87, 255))
    d = ImageDraw.Draw(im)
    rnd = random.Random(3)
    for _ in range(26):
        x, y, r = rnd.randrange(s), rnd.randrange(s), rnd.randrange(int(s * 0.03), int(s * 0.07))
        d.ellipse([x - r, y - r, x + r, y + r], fill=(101, 175, 96, 255))
    k = max(2, s // 300)
    for _ in range(140):
        x, y = rnd.randrange(s), rnd.randrange(s)
        d.line([(x - 2 * k, y - 2 * k), (x, y), (x + 2 * k, y - 2 * k)], fill=(56, 118, 60, 255), width=k)
    top = [(x, s * 0.80 + math.sin(x / s * 2 * math.pi * 1.5) * s * 0.02) for x in range(0, s + 1, 10)]
    bot = [(x, s * 0.92 + math.sin(x / s * 2 * math.pi * 1.5 + 1) * s * 0.02) for x in range(s, -1, -10)]
    d.polygon(top + bot, fill=(204, 175, 125, 255))
    for _ in range(9):
        x, y, r = rnd.randrange(s), rnd.randrange(int(s * 0.76)), 3 * k
        d.ellipse([x - r, y - r, x + r, y + r], fill=(224, 138, 74, 255))
    return im


MOODS = {
    '1': paint_park,                                   # Bird Friend and friends - the park
    '2': lambda s: burst(YELLOW, DEEP, s, s),          # the pass's sunburst
    '3': paint_meadow,                                 # the homestead's meadow
    '4': lambda s: burst(HOT, HOT2, s, s),             # the party pack
    '5': paint_rave,                                   # the glowstick pack - the rave
    '6': paint_bay,                                    # the Captain - Banana Bay
    '7': lambda s: burst(SKY, SKY2, s, s),
    '8': lambda s: burst(PAPER, CREAM2, s, s),         # calm ground under five coloured squares
}
# the name pill needs an edge the ground does not have
PILL = {'5': dict(fill=YELLOW, ink=INK, outline=INK)}


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
    im = MOODS[pack](size)
    arts = [BSP.art_for(c, 1)[0] for c in cells]
    for idx, fx, fy, share, tilt, jit in SEATS:
        a, k = fit(arts[idx], size * share)
        # a captioned square tilts less: its bottom line of text is what a
        # neighbour in front would cover first
        tilt = tilt * (0.6 if k < 0.9 else 1.0)
        st = kiss_cut(a, border=12).rotate(rnd.uniform(-tilt, tilt), expand=True, resample=Image.BICUBIC)
        place(im, st, size * fx + rnd.uniform(-jit, jit), size * fy + rnd.uniform(-jit, jit) * 0.7)
    im.alpha_composite(pill('PACK %s' % pack, px=52, **PILL.get(pack, {})), (44, 40))
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
    im = burst(YELLOW, DEEP, W, H, cx=0.5, cy=0.72)
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
