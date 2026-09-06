# -*- coding: utf-8 -*-
"""🎟 THE STICKER POST (1080x1350, Instagram feed): Pack 4 · Party as it prints,
on the party ground, the dancing banana presenting it. Two files: `-clean`
(no words, for copy in post) and the one with the headline, the price and the
shop address in the site's own face (Archivo Black).

    python export_stickers_post.py
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'scenes'))
from engine import sun_rays  # noqa: E402
from _stk import HOT, HOT2, INK, YELLOW, hero, page, page_shadow  # noqa: E402

OUT = os.path.join(HERE, 'out')
W, H = 1080, 1350
FONT = os.path.join(os.path.dirname(HERE), 'ArchivoBlack.ttf')


def font(px):
    return ImageFont.truetype(FONT, px)


def base():
    im = Image.new('RGBA', (W, H), HOT)
    sun_rays(im, 560, 700, 0.0, n=18, col=HOT2, alpha=150, spin=0.0)
    pg = page(620).rotate(-5, expand=True, resample=Image.BICUBIC)
    sh = page_shadow(pg.size, blur=18, alpha=90)
    cx, cy = 600, 745
    im.alpha_composite(sh, (round(cx - sh.width / 2) + 16, round(cy - sh.height / 2) + 26))
    im.alpha_composite(pg, (round(cx - pg.width / 2), round(cy - pg.height / 2)))
    b = hero(2, 340)   # the ta-da frame, hands up
    im.alpha_composite(b, (150 - b.width // 2, H - 30 - b.height))
    return im


def pill(text, px, fill, ink, tilt):
    f = font(px)
    tw = f.getlength(text)
    pad = round(px * 0.55)
    im = Image.new('RGBA', (round(tw + pad * 2), round(px * 1.55)), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=round(px * 0.5), fill=fill)
    d.text((pad, round(px * 0.22)), text, font=f, fill=ink)
    return im.rotate(tilt, expand=True, resample=Image.BICUBIC)


def with_words(im):
    d = ImageDraw.Draw(im)
    f = font(96)
    for k, line in enumerate(['Official Banana', 'sticker pack']):
        tw = f.getlength(line)
        d.text(((W - tw) / 2, 84 + k * 104), line, font=f, fill=INK)
    p = pill('$9.99 · 6 stickers', 54, INK, YELLOW, -4)
    im.alpha_composite(p, (W - p.width - 60, 1160))
    f2 = font(36)
    url = 'trymstene.com/shop'
    d = ImageDraw.Draw(im)
    d.text((W - f2.getlength(url) - 72, 1298), url, font=f2, fill=INK)
    return im


if __name__ == '__main__':
    clean = base()
    clean.convert('RGB').save(os.path.join(OUT, 'stickers-post-1080x1350-clean.png'))
    with_words(base()).convert('RGB').save(os.path.join(OUT, 'stickers-post-1080x1350.png'))
    print('wrote out/stickers-post-1080x1350.png and -clean.png')
