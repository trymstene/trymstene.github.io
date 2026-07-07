# -*- coding: utf-8 -*-
"""OG card generator — rebuilds public/assets/og/*.png from the clean sheet.

The banana layer is composed EXACTLY like banana-engine.js drawComposite:
the SVG accessory art, FRAMES anchors and placement constants are parsed
out of src/lib/banana-engine.js at run time, so this can never drift from
the engine. Cards are composed per the original design (yellow card, black
border, pink chip, Archivo Black headline, url, banana right).

Run: python tools/build-og-cards.py [--write]
"""
import os
import re
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENGINE = open(os.path.join(SITE, 'src', 'lib', 'banana-engine.js'), encoding='utf-8').read()
OG = os.path.join(SITE, 'public', 'assets', 'og')
FONT = os.path.join(SITE, 'tools', 'ArchivoBlack.ttf')
FW, FH, PX = 469, 498, 13
HAT_OVERLAP, SH_DY = 7.3, -0.5

# ---- parse the engine ----
SVGS = dict(re.findall(r"(\w+): '(<svg[^']+</svg>)'", ENGINE))
FRAMES = []
for m in re.finditer(r'\{ eyeCx: (\d+), eyeCy: (\d+), hatCx: (\d+), btCx: (\d+), '
                     r"tipY: (\d+),\s+face: '(\w+)'", ENGINE):
    FRAMES.append(dict(eyeCx=int(m.group(1)), eyeCy=int(m.group(2)),
                       hatCx=int(m.group(3)), btCx=int(m.group(4)),
                       tipY=int(m.group(5)), face=m.group(6)))
assert len(FRAMES) == 8, 'anchor parse drifted: %d frames' % len(FRAMES)

HATS = {m.group(1): dict(art=m.group(2), seat=int(m.group(3)))
        for m in re.finditer(r"id: '(\w+)',\s+label: '[^']+',\s+art: '(\w+)',\s+seat: (-?\d+)", ENGINE)}
SHADES = {m.group(1): dict(front=m.group(2), side=m.group(3))
          for m in re.finditer(r"id: '(\w+)',\s+label: '[^']+',\s+front: '(\w+)',\s+side: '(\w+)'", ENGINE)}


def svg_layer(key, out_w, out_h, flip=False):
    """rasterise a rect-grid SVG string to an RGBA image of out_w x out_h."""
    svg = SVGS[key]
    vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', svg)
    vw, vh = int(vb.group(1)), int(vb.group(2))
    im = Image.new('RGBA', (out_w, out_h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    sx, sy = out_w / vw, out_h / vh
    for r in re.finditer(r'<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="([^"]+)"', svg):
        x, y, w, h = (int(r.group(i)) for i in range(1, 5))
        d.rectangle([round(x * sx), round(y * sy),
                     round((x + w) * sx) - 1, round((y + h) * sy) - 1], fill=r.group(5))
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    return im


def render_banana(idx, hat=None, glasses=None, bowtie=False):
    """one sheet frame + accessories at native 469x498, engine-exact math."""
    sheet = Image.open(os.path.join(SITE, 'public', 'assets', 'banana-dance.png')).convert('RGBA')
    frame = sheet.crop((idx * FW, 0, (idx + 1) * FW, FH))
    F = FRAMES[idx]
    side = F['face'] != 'front'
    unit = PX  # scale = 1 at native frame size

    def paste(key, cx_left, top, flip=False):
        vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', SVGS[key])
        gw, gh = int(vb.group(1)) / 10 * unit, int(vb.group(2)) / 10 * unit
        layer = svg_layer(key, round(gw), round(gh), flip)
        frame.paste(layer, (round(cx_left), round(top)), layer)
        return gw, gh

    if hat:
        hd = HATS[hat]
        key = hd['art']
        vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', SVGS[key])
        hw, hh = int(vb.group(1)) / 10 * unit, int(vb.group(2)) / 10 * unit
        h_bottom = F['tipY'] + (HAT_OVERLAP + hd['seat']) * unit
        paste(key, F['hatCx'] - hw / 2, h_bottom - hh)
    if glasses:
        sd = SHADES[glasses]
        key = sd['side'] if side else sd['front']
        vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', SVGS[key])
        gw, gh = int(vb.group(1)) / 10 * unit, int(vb.group(2)) / 10 * unit
        gy = F['eyeCy'] + SH_DY * PX
        paste(key, F['eyeCx'] - gw / 2, gy - gh / 2, flip=(F['face'] == 'left'))
    if bowtie:
        key = 'bowtie'
        vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', SVGS[key])
        bw, bh = int(vb.group(1)) / 10 * unit, int(vb.group(2)) / 10 * unit
        by = F['eyeCy'] + 9.5 * PX
        paste(key, F['btCx'] - bw / 2, by - bh / 2)
    return frame


CARDS = {
    'default':  dict(chip='THE ORIGINAL · SINCE 1999', title=['The Dancing', 'Banana'], pose=2),
    'gif':      dict(chip='FREE DOWNLOAD', title=['The Original', 'Dancing Banana GIF'], pose=2),
    'emoji':    dict(chip='DISCORD · SLACK · TWITCH', title=['Dancing Banana', 'Emoji'], pose=2),
    'pbjt':     dict(chip="IT'S THAT SONG", title=['Peanut Butter', 'Jelly Time'], pose=2),
    'license':  dict(chip='FROM THE CREATOR', title=['License the', 'Dancing Banana'], pose=2),
    'projects': dict(chip='BY TRYM STENE', title=['Projects'], pose=2),
    'builder':  dict(chip='FREE BANANA TOY', title=['Make Your Own', 'Dancing Banana'], pose=2,
                     hat='party', glasses='hearts'),
    'shop':     dict(chip='OFFICIAL MERCH', title=['Dancing Banana', 'Shop'], pose=4,
                     hat='cowboy', bowtie=True),
}

BG, INK, PINK, PAPER = (255, 221, 40), (17, 17, 17), (255, 84, 112), (255, 253, 245)


def build(name, spec, write):
    W, H = 1200, 630
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.rectangle([20, 20, W - 21, H - 21], outline=(0, 0, 0), width=10)
    f_chip = ImageFont.truetype(FONT, 30)
    f_title = ImageFont.truetype(FONT, 66)
    f_url = ImageFont.truetype(FONT, 32)
    # pink chip
    tw = d.textlength(spec['chip'], font=f_chip)
    d.rectangle([66, 106, 66 + tw + 36, 162], fill=PINK, outline=(0, 0, 0), width=4)
    d.text((84, 118), spec['chip'], font=f_chip, fill=PAPER)
    # headline
    y = 218
    for line in spec['title']:
        d.text((84, y), line, font=f_title, fill=INK)
        y += 92
    d.text((84, 508), 'trymstene.com', font=f_url, fill=INK)
    # banana on the right, feet ~y 525
    b = render_banana(spec['pose'], hat=spec.get('hat'), glasses=spec.get('glasses'),
                      bowtie=spec.get('bowtie', False))
    bb = b.getbbox()
    content = b.crop(bb)
    th = 430
    tw2 = round(content.width * th / content.height)
    content = content.resize((tw2, th), Image.NEAREST)
    im.paste(content, (910 - tw2 // 2, 525 - th), content)
    out = os.path.join(OG, name + '.png')
    if write:
        im.save(out, optimize=True)
    print(('wrote ' if write else 'DRY: ') + os.path.relpath(out, SITE))


if __name__ == '__main__':
    write = '--write' in sys.argv
    for name, spec in CARDS.items():
        build(name, spec, write)
