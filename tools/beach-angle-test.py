# -*- coding: utf-8 -*-
"""THE ANGLE TEST — does our flat front-facing banana work standing on the
pack's TOP-DOWN terrain among its 3/4 objects?

Renders the same scene twice: pack art at native scale (factor 1) and
chunkier (factor 2), with our banana at its real 56px in both.
"""
import os
import sys
from PIL import Image, ImageDraw

sys.path.insert(0, r'C:\Web Development\trymstene.com\tools')
from blockify import load_pack, blockify

PACK = os.path.expanduser(r'~\OneDrive\banana-art-pack\Modern_Exteriors_48x48')
SEA = os.path.join(PACK, 'Animated_48x48', 'Animated_Terrains_48x48', 'Sea_Water_Tileset_48x48.png')
BANANA = r'C:\Web Development\trymstene.com\public\assets\banana-dance.png'
T = 48
tiles = Image.open(SEA).convert('RGBA')


def tile(c, r):
    return tiles.crop((c * T, r * T, (c + 1) * T, (r + 1) * T))


SAND = tile(5, 1)
WATER = tile(1, 1)
SHORE = tile(1, 0).transpose(Image.FLIP_TOP_BOTTOM)   # water above, sand below

# our banana, frame 0, at its real world size
sheet = Image.open(BANANA).convert('RGBA')
fw = sheet.width // 8
ban = sheet.crop((0, 0, fw, sheet.height))
bb = ban.getbbox()
ban = ban.crop(bb)
BAN_H = 56
ban = ban.resize((max(1, round(ban.width * BAN_H / ban.height)), BAN_H), Image.NEAREST)


def scene(factor, label):
    COLS, ROWS = 20, 12
    tw = T // factor
    W, H = COLS * tw, ROWS * tw
    im = Image.new('RGBA', (W, H), (60, 140, 170, 255))
    st = SAND.resize((tw, tw), Image.NEAREST)
    wt = WATER.resize((tw, tw), Image.NEAREST)
    sh = SHORE.resize((tw, tw), Image.NEAREST)
    SHORE_ROW = 3
    for r in range(ROWS):
        for c in range(COLS):
            t = wt if r < SHORE_ROW else (sh if r == SHORE_ROW else st)
            im.alpha_composite(t, (c * tw, r * tw))

    def put(name, cx, base, f=None, colors=8, warm=0.2):
        s = blockify(load_pack(name), factor=(f or factor), colors=colors,
                     warm=warm, sat=1.15, con=1.1)
        # contact shadow
        d = ImageDraw.Draw(im, 'RGBA')
        d.ellipse([cx - s.width * 0.34, base - s.height * 0.06,
                   cx + s.width * 0.34, base + s.height * 0.06], fill=(60, 40, 20, 60))
        im.alpha_composite(s, (int(cx - s.width // 2), int(base - s.height)))

    put('21_Beach_48x48_Palm_Tree.png', int(W * 0.14), int(H * 0.62))
    put('21_Beach_48x48_Yellow_Beach_Umbrella_Opened.png', int(W * 0.35), int(H * 0.78))
    put('ME_Singles_Swimming_Pool_48x48_Sunbed_1.png', int(W * 0.55), int(H * 0.80))
    put('21_Beach_48x48_Ship_Bar.png', int(W * 0.80), int(H * 0.66))
    put('21_Beach_48x48_Sand_Castle_1_Vers_1.png', int(W * 0.30), int(H * 0.94))
    put('21_Beach_48x48_Big_Sprout_Vers_1.png', int(W * 0.66), int(H * 0.42))

    # THE BANANA — flat, front-facing, with a contact shadow so it isn't floating
    for bx, by in ((int(W * 0.44), int(H * 0.70)), (int(W * 0.72), int(H * 0.88))):
        d = ImageDraw.Draw(im, 'RGBA')
        d.ellipse([bx - 17, by - 5, bx + 17, by + 5], fill=(60, 40, 20, 70))
        im.alpha_composite(ban, (bx - ban.width // 2, by - BAN_H))

    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 128, 16], fill=(20, 16, 26, 230))
    d.text((5, 4), label, fill=(255, 220, 120))
    return im


a = scene(1, 'pack NATIVE (48px tiles)')
b = scene(2, 'pack CHUNKY (24px tiles)')
K = 2
a = a.resize((a.width * K, a.height * K), Image.NEAREST)
b = b.resize((b.width * K, b.height * K), Image.NEAREST)
out = Image.new('RGBA', (max(a.width, b.width), a.height + b.height + 12), (24, 20, 30, 255))
out.alpha_composite(a, (0, 0))
out.alpha_composite(b, (0, a.height + 12))
p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'angle-test.png')
out.save(p)
print('wrote', p, out.size, '| banana', ban.size)
