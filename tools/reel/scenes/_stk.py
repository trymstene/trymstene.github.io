# -*- coding: utf-8 -*-
"""🎟 shared bits for the sticker-pack clips (stk_*): the A5 page exactly as it
prints, the kiss-cut stickers at their printed size, Pack 4's party ground.
Honest scale: the page is the real print file (1749x2481 = A5 at 300 DPI), a
sticker's art on the page is 0.80 of its cell (build-sticker-packs.py), and
the popped sticker is the site's own kiss-cut cut-out at that same size."""
import json
import os

from PIL import Image, ImageDraw, ImageFilter

from engine import ASSETS, SITE, banana  # noqa: F401
import banana_render

PACK = 4
PACKS_DIR = os.path.join(ASSETS, 'packs')
PRINT = os.path.join(SITE, 'print-files', 'sticker-packs', 'pack-%d-print.png' % PACK)
ART = json.load(open(os.path.join(SITE, 'src', 'data', 'pack-art.json'), encoding='utf-8'))
CELLS = ART['packs'][str(PACK)]            # [{name, slug, w, h, hero}] in sheet order
COLS, ROWS = 2, 3
PW_PRINT, PH_PRINT = 1749, 2481
FILL = 0.80

HOT, HOT2 = (255, 77, 109, 255), (255, 122, 149)
INK = (17, 17, 17, 255)
YELLOW = (255, 225, 53)
PAPER = (250, 246, 238, 255)

_C = {}


def page(width):
    """the A5 as it prints: white paper, the print file on it, a hairline edge"""
    key = ('page', width)
    if key not in _C:
        h = round(width * PH_PRINT / PW_PRINT)
        art = Image.open(PRINT).convert('RGBA').resize((width, h), Image.LANCZOS)
        pg = Image.new('RGBA', (width, h), (255, 255, 255, 255))
        pg.alpha_composite(art)
        ImageDraw.Draw(pg).rectangle([0, 0, width - 1, h - 1], outline=(0, 0, 0, 50), width=1)
        _C[key] = pg
    return _C[key]


def page_shadow(size, blur=10, alpha=80):
    key = ('shadow', size, blur, alpha)
    if key not in _C:
        w, h = size
        pad = blur * 3
        sh = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rectangle([pad, pad, pad + w, pad + h], fill=(0, 0, 0, alpha))
        _C[key] = sh.filter(ImageFilter.GaussianBlur(blur))
    return _C[key]


def cell_center(k, pcx, pcy, width):
    """sticker k's centre in the frame, for a page of `width` centred at (pcx, pcy)"""
    h = width * PH_PRINT / PW_PRINT
    cw, ch = width / COLS, h / ROWS
    return (pcx - width / 2 + (k % COLS + 0.5) * cw, pcy - h / 2 + (k // COLS + 0.5) * ch)


def printed_art_h(width):
    """the art height on a page of `width` (all six Pack 4 stickers are height-limited)"""
    return FILL * (width * PH_PRINT / PW_PRINT) / ROWS


def sticker(slug, art_h):
    """the site's kiss-cut cut-out (public/assets/packs/stickers/<slug>.webp — the art
    fitted to 420 px on its white backing with a soft shadow), scaled so its ART is art_h tall"""
    key = ('stk', slug, round(art_h))
    if key not in _C:
        im = Image.open(os.path.join(PACKS_DIR, 'stickers', slug + '.webp')).convert('RGBA')
        c = next(x for x in CELLS if x['slug'] == slug)
        fitted_h = 420 * c['h'] / max(c['w'], c['h'])
        k = art_h / fitted_h
        _C[key] = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
    return _C[key]


def card(n, width):
    key = ('card', n, width)
    if key not in _C:
        im = Image.open(os.path.join(PACKS_DIR, 'pack-%d-card.webp' % n)).convert('RGBA')
        _C[key] = im.resize((width, width), Image.LANCZOS)
    return _C[key]


# a constant scale for the hero, so the banana never pulses in size between
# dance frames (the frames' own bboxes differ by ~18% — see scenes/items.py)
_NAT = None


def hero(frame, height):
    """the bare dancing banana, `height` = the tallest frame's ink height; anchored per frame"""
    global _NAT
    if _NAT is None:
        _NAT = [banana_render.render(f, {}, scale=1).getbbox() for f in range(8)]
    key = ('hero', frame % 8, height)
    if key not in _C:
        im = banana_render.render(frame % 8, {}, scale=1)
        bb = _NAT[frame % 8]
        im = im.crop(bb)
        k = height / max(b[3] - b[1] for b in _NAT)
        _C[key] = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.NEAREST)
    return _C[key]
