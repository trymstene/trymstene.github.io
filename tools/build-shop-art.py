# -*- coding: utf-8 -*-
"""🎨 THE OFFICIAL LINE'S PRINT FILES — one design system, every product.

Trym culled the v2 treatment sheet down to four: 1 (ONE INK, whole),
5 (FILLED 3x3), 6 (FILLED 4x4 tilted) and 7 (FILLED, one ink). Those four
cover the whole slate, because the FILLED ones ARE repeat patterns and the
slate's cut-sew products (tote, beanie, phone case) want exactly that.

    garments  -> ONE INK       one banana, chest scale, garment shows through
    paper     -> FILLED 3x3    nine whole bananas, every face readable
    all-over  -> SEAMLESS      the 4x4 tilt as a true wrapping tile
    dark tees -> ONE INK white the same mark, inverted

⚠️ SOURCE: tools/banana-grid.py, never the .gif directly and never a
derivative. It recovers the master's true 33x35 pixel grid, so every size
here is an exact NEAREST multiple — edges land where Trym drew them.
The "fat arms and legs" defect was a 1.2x rescale of a 500px derivative.

    python tools/build-shop-art.py          write print-files/ + the sheet

Output is gitignored: these are upload files for Printful, not site assets.
"""
import importlib.util
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, 'print-files')

_spec = importlib.util.spec_from_file_location('banana_grid', os.path.join(HERE, 'banana-grid.py'))
bg = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bg)

INK = (17, 17, 17, 255)
WHITE = (255, 255, 255, 255)
o = lambda s: sys.stdout.buffer.write((s + '\n').encode('utf-8', 'replace'))


# ---- primitives -----------------------------------------------------------

def sprite(i, px):
    """Frame `i` blown up so one logical pixel is `px` wide. NEAREST only."""
    f = bg.frames()[i]
    return f.resize((f.width * px, f.height * px), Image.NEAREST)


def trim(img):
    b = img.getbbox()
    return img.crop(b) if b else img


def one_ink(art, ink=INK):
    """Single colour, garment showing through. Threshold on LUMINANCE — going
    by alpha alone floods the eyes and the highlight and the mark stops
    reading as a banana (the v1 halftone mistake, same root cause)."""
    out = Image.new('RGBA', art.size, (0, 0, 0, 0))
    px, op = art.load(), out.load()
    for y in range(art.height):
        for x in range(art.width):
            r, g, b, a = px[x, y]
            if a > 90 and (0.299 * r + 0.587 * g + 0.114 * b) < 170:
                op[x, y] = ink
    return out


def fit(art, w, h, scale=0.92):
    """Centre `art` in a w*h transparent canvas at `scale` of the short side.
    Never crops: the head and the arms are the character (Trym's rule)."""
    c = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    k = min(w * scale / art.width, h * scale / art.height)
    a = art.resize((max(1, int(art.width * k)), max(1, int(art.height * k))), Image.LANCZOS)
    c.alpha_composite(a, ((w - a.width) // 2, (h - a.height) // 2))
    return c


def grid(w, h, cols, rows, px=20, mono=None, rot=0, scale=0.82):
    """cols*rows WHOLE bananas, one dance frame per cell."""
    c = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    cw, ch = w / cols, h / rows
    for r in range(rows):
        for k in range(cols):
            a = trim(sprite((r * cols + k) % 8, px))
            if rot:
                a = a.rotate(rot, expand=True, resample=Image.NEAREST)
            if mono:
                a = one_ink(a, mono)
            f = min(cw * scale / a.width, ch * scale / a.height)
            a = a.resize((max(1, int(a.width * f)), max(1, int(a.height * f))), Image.LANCZOS)
            c.alpha_composite(a, (int(k * cw + (cw - a.width) / 2), int(r * ch + (ch - a.height) / 2)))
    return c


def fill(w, h, t):
    """Repeat a SQUARE seamless tile across a w*h canvas. Cropping one big tile
    instead (the first phone case) leaves the off-aspect side half empty."""
    c = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for y in range(0, h, t.height):
        for x in range(0, w, t.width):
            c.alpha_composite(t, (x, y))
    return c


def tile(size, cols=4, px=20, rot=-12, scale=0.80):
    """A SEAMLESS half-drop repeat — the 4x4 tilt made to actually wrap.

    All-over products print across seams and around a whole bag, so a fixed
    composition shows its edges. Each banana is drawn at its wrapped position
    too, so the tile butts against copies of itself invisibly. The half-drop
    (every other column pushed down half a cell) breaks the grid into a
    scatter — a straight lattice reads as wallpaper, not as a crowd."""
    c = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    cell = size / cols
    n = 0
    for r in range(cols + 1):
        for k in range(cols):
            a = trim(sprite(n % 8, px))
            n += 1
            a = a.rotate(rot + (n % 3 - 1) * 7, expand=True, resample=Image.NEAREST)
            f = cell * scale / max(a.width, a.height)
            a = a.resize((max(1, int(a.width * f)), max(1, int(a.height * f))), Image.LANCZOS)
            x = k * cell + (cell - a.width) / 2
            y = r * cell + (cell - a.height) / 2 - (cell / 2 if k % 2 else 0)
            for dx in (0, -size, size):          # wrap on both axes so the
                for dy in (0, -size, size):      # seams carry the pattern
                    px_, py_ = int(x + dx), int(y + dy)
                    if -a.width < px_ < size and -a.height < py_ < size:
                        c.alpha_composite(a, (px_, py_))
    return c


# ---- the slate's print files ---------------------------------------------
# (name, W, H, builder) — sizes are Printful print specs at 300 DPI unless
# noted. Pixel art needs no more; posters run at 150 to keep the files sane.

FILES = [
    # THE GARMENT FILE. Full colour, one file, every colourway — that is what
    # the live line already prints and the yellow is the whole point. The
    # one-ink pair below is a fallback that has never shipped on a garment;
    # keep it for embroidery/patch work, not for DTG.
    ('tee-colour',            3600, 3600, lambda w, h: fit(trim(sprite(2, 40)), w, h, 0.86)),
    ('tee-oneink-black',      3600, 3600, lambda w, h: fit(one_ink(sprite(2, 40)), w, h, 0.86)),
    ('tee-oneink-white',      3600, 3600, lambda w, h: fit(one_ink(sprite(2, 40), WHITE), w, h, 0.86)),
    ('tee-filled-3x3',        3600, 3600, lambda w, h: grid(w, h, 3, 3, px=26)),
    ('sticker-4in-hero',      1275, 1275, lambda w, h: fit(trim(sprite(2, 30)), w, h, 0.88)),
    ('sticker-4in-oneink',    1275, 1275, lambda w, h: fit(one_ink(sprite(2, 30)), w, h, 0.88)),
    ('stickersheet-a5',       1749, 2481, lambda w, h: grid(w, h, 3, 4, px=18)),
    # THREE big frames around the mug, not six small ones — the wrap is only
    # 3.85in tall, so six across left the dance reading as a tiny border
    ('mug-11oz-wrap',         2475, 1155, lambda w, h: grid(w, h, 3, 1, px=22, scale=0.94)),
    ('notepad-5x6',           1650, 1800, lambda w, h: grid(w, h, 3, 3, px=16)),
    ('poster-18x24',          2700, 3600, lambda w, h: grid(w, h, 3, 4, px=26)),
    ('buttons-2in',            825,  825, lambda w, h: fit(trim(sprite(4, 20)), w, h, 0.82)),
    # a 2-column tile half-drops into obvious vertical stripes — 3 reads as a
    # scatter. The tile needn't divide the canvas: a seamless one crops anywhere
    ('case-iphone',           1800, 3600, lambda w, h: fill(w, h, tile(1200, cols=3, px=20))),
    ('allover-tile-seamless', 3000, 3000, lambda w, h: tile(w, cols=5, px=24)),
    ('allover-tile-oneink',   3000, 3000, lambda w, h: one_ink(tile(w, cols=5, px=24), WHITE)),
]


def font(sz, bold=False):
    try:
        return ImageFont.truetype(r'C:\Windows\Fonts\segoeuib.ttf' if bold
                                  else r'C:\Windows\Fonts\segoeui.ttf', sz)
    except Exception:
        return ImageFont.load_default()


def sheet(made):
    """One labelled contact sheet — the whole line at a glance, for the cull.
    Checkerboard behind every cell so transparency is unmistakable (a white
    card would hide a design that accidentally printed white-on-white)."""
    COLS, CELL, PAD, CAP, HEAD = 5, 380, 20, 54, 96
    rows = (len(made) + COLS - 1) // COLS
    W = COLS * (CELL + PAD) + PAD
    H = HEAD + rows * (CELL + CAP + PAD) + PAD
    sh = Image.new('RGB', (W, H), (24, 22, 18))
    d = ImageDraw.Draw(sh)
    d.text((PAD, 20), 'OFFICIAL LINE — PRINT FILES', fill=(255, 225, 53), font=font(30, True))
    d.text((PAD, 56), 'Four approved treatments across the slate. Checkerboard = transparent.',
           fill=(190, 185, 170), font=font(16))

    for i, (name, art) in enumerate(made):
        cx = PAD + (i % COLS) * (CELL + PAD)
        cy = HEAD + (i // COLS) * (CELL + CAP + PAD)
        card = Image.new('RGB', (CELL, CELL), (238, 238, 238))
        cd = ImageDraw.Draw(card)
        for yy in range(0, CELL, 24):            # checkerboard
            for xx in range(0, CELL, 24):
                if (xx // 24 + yy // 24) % 2:
                    cd.rectangle([xx, yy, xx + 23, yy + 23], fill=(214, 214, 214))
        k = min((CELL - 16) / art.width, (CELL - 16) / art.height)
        thumb = art.resize((max(1, int(art.width * k)), max(1, int(art.height * k))), Image.LANCZOS)
        card.paste(thumb, ((CELL - thumb.width) // 2, (CELL - thumb.height) // 2), thumb)
        sh.paste(card, (cx, cy))
        d.rectangle([cx, cy, cx + CELL, cy + CELL], outline=(70, 66, 58))
        d.text((cx + 2, cy + CELL + 8), name, fill=(255, 225, 53), font=font(16, True))
        d.text((cx + 2, cy + CELL + 30), '%d x %d px' % (art.width, art.height),
               fill=(178, 173, 158), font=font(14))
    return sh


def seam_check(t):
    """Is the tile really seamless? Compare the wrap seam (last column against
    first) with ordinary interior column pairs. A fixed composition scores far
    worse at the seam than inside; a wrapping one scores the same."""
    px = t.load()
    def pair(a, b):
        d = 0
        for y in range(0, t.height, 2):
            for i in range(4):
                d += abs(px[a, y][i] - px[b, y][i])
        return d / (t.height / 2)
    seam = pair(t.width - 1, 0)
    inner = sorted(pair(x, x + 1) for x in range(t.width // 4, t.width - 1, t.width // 9))
    med = inner[len(inner) // 2]
    return seam, med


def main():
    os.makedirs(OUT, exist_ok=True)
    bg.frames()
    o('grid recovered: %dx%d per frame' % bg.GRID)
    s, m = seam_check(tile(900, cols=2, px=18))
    o('tile seam %.1f vs interior median %.1f  -> %s' %
      (s, m, 'seamless' if s <= max(m * 2.5, 12) else '!! VISIBLE SEAM'))
    made = []
    for name, w, h, build in FILES:
        art = build(w, h)
        p = os.path.join(OUT, name + '.png')
        art.save(p)
        made.append((name, art))
        o('  %-24s %5dx%-5d %7.0f KB' % (name, art.width, art.height, os.path.getsize(p) / 1024))
    sp = os.path.join(OUT, '_SHEET.png')
    sheet(made).save(sp)
    o('sheet: %s' % sp)


main()
