# -*- coding: utf-8 -*-
"""Round 3 — F narrowed to a real door ratio (8 wide in a 16 frame).
⚠️ Judged at EXACT integer multiples: 16px art shown at 22px is a non-integer
scale, which makes some pixel rows 1px and others 2px. Ship it at 16 or 32."""
import os
from PIL import Image

SP = os.environ.get('SPDIR', '.')
PAL = {'.': None, 'D': (58, 41, 24), 'B': (138, 90, 43), 'L': (166, 113, 58),
       'S': (95, 61, 28), 'K': (255, 225, 53)}

# I — two panels, narrow
I = [
    '................',
    '....DDDDDDDD....',
    '....DBBBBBBD....',
    '....DBSSSSBD....',
    '....DBSLLSBD....',
    '....DBSLLSBD....',
    '....DBSSSSBD....',
    '....DBBBBBBD....',
    '....DBBBBKBD....',
    '....DBBBBBBD....',
    '....DBSSSSBD....',
    '....DBSLLSBD....',
    '....DBSLLSBD....',
    '....DBSSSSBD....',
    '....DBBBBBBD....',
    '....DDDDDDDD....',
]
# J — one tall panel, narrow (fewer details survive small)
J = [
    '................',
    '....DDDDDDDD....',
    '....DBBBBBBD....',
    '....DBSSSSBD....',
    '....DBSLLSBD....',
    '....DBSLLSBD....',
    '....DBSLLSBD....',
    '....DBSLLSBD....',
    '....DBSLLSBD....',
    '....DBSSSSBD....',
    '....DBBBBBBD....',
    '....DBBBBKBD....',
    '....DBBBBBBD....',
    '....DBBBBBBD....',
    '....DBBBBBBD....',
    '....DDDDDDDD....',
]
# K — no panel at all: slab, knob, and a frame it sits in (max clarity)
K = [
    '................',
    '...DDDDDDDDDD...',
    '...DSSSSSSSSD...',
    '...DSDDDDDDSD...',
    '...DSDBBBBDSD...',
    '...DSDBBBBDSD...',
    '...DSDBBBBDSD...',
    '...DSDBBBBDSD...',
    '...DSDBBBKDSD...',
    '...DSDBBBBDSD...',
    '...DSDBBBBDSD...',
    '...DSDBBBBDSD...',
    '...DSDBBBBDSD...',
    '...DSDBBBBDSD...',
    '...DSDDDDDDSD...',
    '...DDDDDDDDDD...',
]
# L — two panels + a doorstep, the fullest version that still reads
L = [
    '................',
    '....DDDDDDDD....',
    '....DBBBBBBD....',
    '....DBSSSSBD....',
    '....DBSLLSBD....',
    '....DBSSSSBD....',
    '....DBBBBBBD....',
    '....DBBBBKBD....',
    '....DBBBBBBD....',
    '....DBSSSSBD....',
    '....DBSLLSBD....',
    '....DBSLLSBD....',
    '....DBSSSSBD....',
    '....DBBBBBBD....',
    '....DDDDDDDD....',
    '...SSSSSSSSSS...',
]
CANDS = [('I two panels', I), ('J one panel', J), ('K slab+frame', K), ('L panels+step', L)]


def render(grid, scale=1):
    im = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(grid):
        for x, ch in enumerate(row):
            c = PAL[ch]
            if c:
                im.putpixel((x, y), c + (255,))
    return im.resize((16 * scale, 16 * scale), Image.NEAREST) if scale > 1 else im


if __name__ == '__main__':
    S, W = 11, 16 * 11 + 16
    sheet = Image.new('RGBA', (len(CANDS) * W + 16, 16 * S + 80), (28, 24, 20, 255))
    for i, (name, g) in enumerate(CANDS):
        x = 16 + i * W
        sheet.alpha_composite(render(g, S), (x, 14))
        sheet.alpha_composite(render(g, 2), (x, 16 * S + 26))          # 32px = as shipped
        sheet.alpha_composite(render(g, 1), (x + 44, 16 * S + 34))     # 16px = the small read
        print(name)
    sheet.convert('RGB').save(os.path.join(SP, 'door3.png'))
    print('wrote door3.png — big, then exact 32px and 16px')
