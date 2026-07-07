# -*- coding: utf-8 -*-
"""THE MENU sprites — 10 conveyor items + 8 counter drinks + the smoke poof,
authored as ASCII pixel maps on the banana's own chunkiness (12-16 unit
grids, 1px outlines, 2-3 shades + glint per sprite — the floor-items.py
doctrine). Preview: one labelled grid on the real floor colour at 6x.
Emit: crispEdges rect SVGs (1 unit = 1 svg px) to floor-items-2-svg.txt.

Run: python tools/floor-items-2.py
"""
import os
from PIL import Image, ImageDraw

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PNG = os.path.join(SITE, 'tools', 'floor-items-2-preview.png')
OUT_SVG = os.path.join(SITE, 'tools', 'floor-items-2-svg.txt')

K = '#1e182c'   # house outline
W = '#fffdf5'   # white

SPRITES = {
    # ---- conveyor items ----
    'shard': dict(pal={'K': K, 'S': '#c8d8e8', 'D': '#8898b8', 'W': '#ffffff', 'C': '#78ebff'}, rows=[
        '.....C......',
        '....KK......',
        '...KSWK.....',
        '...KSSWK....',
        '..KSWSSK..C.',
        '..KSSDSWK...',
        '.KSWSDSSK...',
        '.KSSSDSSWK..',
        'KSWSSDDSSK..',
        'KKKKKKKKKK..',
        'C...........',
        '............',
    ]),
    'cone': dict(pal={'K': K, 'O': '#ff8c28', 'D': '#c85f10', 'W': W}, rows=[
        '.....KK.....',
        '....KOOK....',
        '....KODK....',
        '...KOODK....',
        '...KWWWWK...',
        '..KWWWWWK...',
        '..KOOODDK...',
        '.KOOOODDK...',
        '.KOOOODDDK..',
        'KKKKKKKKKKK.',
        'KDDDDDDDDDK.',
        '.KKKKKKKKK..',
    ]),
    'popper': dict(pal={'K': K, 'G': '#ffd23f', 'D': '#c88f10', 'R': '#ff4d9d', 'C': '#78ebff', 'W': W}, rows=[
        'R..C..R...',
        '.R.W.C....',
        '..RRC.....',
        '..KKK.....',
        '.KGGDK....',
        '.KGGDK....',
        '..KGGDK...',
        '..KGGDK...',
        '...KGDK...',
        '...KGGDK..',
        '....KGDK..',
        '....KGGDK.',
        '.....KKK..',
        '..........',
    ]),
    'remote': dict(pal={'K': K, 'G': '#8890a8', 'D': '#5a6078', 'R': '#e83b3b', 'W': W, 'C': '#78ebff'}, rows=[
        '...KK.....',
        '...KCK....',
        '..KKKK....',
        '.KGGGDK...',
        '.KGRRGDK..',
        '.KGRRGDK..',
        '.KGGGGDK..',
        '.KGWWGDK..',
        '.KGGGGDK..',
        '.KGWWGDK..',
        '.KGGGGDK..',
        '.KDDDDDK..',
        '..KKKKK...',
        '..........',
    ]),
    'kazoo': dict(pal={'K': K, 'G': '#ffd23f', 'D': '#c88f10', 'P': '#ff4d9d', 'W': W}, rows=[
        '....KKK.......',
        '...KPPPK......',
        'KKKKPWPKKKK...',
        'KGGGPPPGGGDK..',
        'KGGGGGGGGGDDK.',
        '.KGGGGGGGDDK..',
        '..KKKKKKKKK...',
        '..............',
    ]),
    'glitter': dict(pal={'K': K, 'P': '#b388ff', 'D': '#7a55c8', 'G': '#ffd23f', 'W': W}, rows=[
        '......KG....',
        '.....KWK....',
        'G...KK......',
        '...KPPK..G..',
        '..KPWPPK....',
        '.KPWPPPDK...',
        '.KPPPGPDK...',
        '.KPPGPPDK.G.',
        '.KPPPPDDK...',
        '..KPPDDK....',
        'G..KKKK.....',
        '............',
    ]),
    'phone': dict(pal={'K': K, 'B': '#3a3f58', 'S': '#78ebff', 'D': '#252a40', 'W': '#ffffff'}, rows=[
        '..W..W....',
        '.W.WW.....',
        '..WKKW....',
        '..KBBK....',
        '.KBSSBK...',
        '.KBSSBK...',
        '.KBSSBK...',
        '.KBSSBK...',
        '.KBSSBK...',
        '.KBDDBK...',
        '.KBWBBK...',
        '..KKKK....',
        '..........',
        '..........',
    ]),
    'cube': dict(pal={'K': '#4db8ff', 'C': ('#78ebff', 0.55), 'I': ('#b9f4ff', 0.75), 'W': '#ffffff'}, rows=[
        '.KKKKKKKK...',
        'KWIIIIIICK..',
        'KIWIIICCCK..',
        'KIIICCCCCK..',
        'KIICCCCCCK..',
        'KICCCCCCIK..',
        'KICCCCCIIK..',
        'KCCCCCIIWK..',
        'KCCCCIIIIK..',
        '.KKKKKKKK...',
        '............',
        '............',
    ]),
    'pizzabox': dict(pal={'K': K, 'T': '#dea85c', 'D': '#b47c3c', 'R': '#c82828', 'W': W, 'Y': '#ffe135'}, rows=[
        '..KKKKKKKKKKK...',
        '.KTTTTTTTTTTTK..',
        'KTTRYRTTTRYRTTK.',
        'KTTYRYTTTYRYTTK.',
        'KTTTTTTTTTTTTDK.',
        'KTDDDDDDDDDDDDK.',
        '.KKKKKKKKKKKKK..',
        '................',
    ]),
    'wand': dict(pal={'K': K, 'P': '#ff4d9d', 'C': '#78ebff', 'I': ('#b9f4ff', 0.6), 'W': '#ffffff'}, rows=[
        '..CCC.....',
        '.CIIWC....',
        '.CIIIC....',
        '.CIIIC....',
        '..CCC.....',
        '...KK.....',
        '..KCCK....',
        '.KC..CK...',
        '.KC..CK...',
        '..KCCK....',
        '...KPK....',
        '...KPK....',
        '...KPK....',
        '...KPK....',
        '....K.....',
        '..........',
    ]),
    # ---- Barty's specials (counter drinks) ----
    'espresso': dict(pal={'K': K, 'B': '#5a3a1e', 'D': '#2e1a0a', 'L': '#b8874a', 'W': W, 'G': '#ffd23f'}, rows=[
        'KKKKKKKKK.',
        '.KLLDLLK..',
        '.KWBBBBK..',
        '..KBBDK...',
        '...KBK....',
        '....K.....',
        '....K.....',
        '...KKK....',
        '..KGGGK...',
        '..........',
    ]),
    'lagoon': dict(pal={'K': K, 'C': '#4db8ff', 'L': '#78ebff', 'W': W, 'R': '#ff4d9d'}, rows=[
        '....R.....',
        '....R.....',
        '.KKKRKK...',
        '.KLLRLK...',
        '.KCLRCK...',
        '.KCCCCK...',
        '.KCCCCK...',
        '.KCCCCK...',
        '..KKKK....',
        '..........',
    ]),
    'colada': dict(pal={'K': K, 'C': '#fff6c8', 'Y': '#ffe135', 'G': '#58c05c', 'R': '#e83b3b', 'W': W}, rows=[
        '.....GG...',
        '..R.GG....',
        '.KRKYK....',
        '.KKCCKK...',
        'KCWCCCCK..',
        'KCCCCCCK..',
        'KCCCCCCK..',
        '.KCCCCK...',
        '..KKKK....',
        '..KKKK....',
        '..........',
    ]),
    'margarita': dict(pal={'K': K, 'G': '#8ce858', 'D': '#4ea828', 'W': '#ffffff', 'L': '#d8f890'}, rows=[
        'WKWKWKWKW.',
        'KGGGGGGGK.',
        '.KGGLGGK..',
        '..KGGGK...',
        '...KGK....',
        '....K.....',
        '....K.....',
        '...KKK....',
        '..KWWWK...',
        '..........',
    ]),
    'champagne': dict(pal={'K': K, 'G': '#ffd23f', 'L': '#fff6c8', 'W': '#ffffff'}, rows=[
        '...W......',
        '..W.W.....',
        '.KKLKK....',
        '.KLGWK....',
        '.KGGGK....',
        '.KGGGK....',
        '..KGK.....',
        '...K......',
        '...K......',
        '..KKK.....',
        '..........',
    ]),
    'milkshake': dict(pal={'K': K, 'P': '#ff9ec8', 'C': '#fff6c8', 'R': '#e83b3b', 'W': W}, rows=[
        '....KR....',
        '...KWK....',
        '..KCWCK...',
        '.KCWCCCK..',
        '.KKKKKKK..',
        '.KPPCPPK..',
        '.KPCPPPK..',
        '.KPPPPKK..',
        '..KPPPK...',
        '..KKKKK...',
        '..........',
    ]),
    'jellyshot': dict(pal={'K': K, 'P': '#ff4d9d', 'D': '#c62c74', 'W': '#ffffff'}, rows=[
        '.KKKKKK...',
        '.KWPPPK...',
        '.KPPDPK...',
        '.KPDPPK...',
        '.KDDDDK...',
        '..KKKK....',
        '..........',
    ]),
    'water': dict(pal={'K': '#8898b8', 'C': ('#b9f4ff', 0.5), 'W': '#ffffff'}, rows=[
        '.K....K...',
        '.KWCCCK...',
        '.KCCCCK...',
        '.KCCCCK...',
        '.KCCCCK...',
        '.KCCCWK...',
        '..KKKK....',
        '..........',
    ]),
    # ---- the guide's mystery card icon ----
    'mystery': dict(pal={'K': K, 'Y': '#ffe135', 'D': '#c88f10'}, rows=[
        '..KKKK....',
        '.KYYYYK...',
        'KYYKKYYK..',
        'KYDK.KYYK.',
        '.KK..KYYK.',
        '....KYYK..',
        '...KYYK...',
        '...KYDK...',
        '....KK....',
        '...KYYK...',
        '...KYDK...',
        '....KK....',
    ]),
    # ---- the smoke poof (3 frames, side by side use) ----
    'poof1': dict(pal={'G': '#8890a8', 'L': '#b8bcd0', 'W': '#e8eaf2'}, rows=[
        '............',
        '....LL......',
        '...LWWL.....',
        '...GWWG.....',
        '....GG......',
        '............',
    ]),
    'poof2': dict(pal={'G': '#8890a8', 'L': '#b8bcd0', 'W': '#e8eaf2'}, rows=[
        '..LL...L....',
        '.LWWL.LGL...',
        'LGWWWLGWG...',
        '.GWWGWWWG...',
        '..GGLWWG....',
        '....GGG.....',
    ]),
    'poof3': dict(pal={'G': ('#8890a8', 0.6), 'L': ('#b8bcd0', 0.6)}, rows=[
        'GL...L...G..',
        'L.G.L.L.....',
        '...L...G.L..',
        'G..L.G......',
        '..G....L..G.',
        '............',
    ]),
}


def hex_rgba(v):
    if isinstance(v, tuple):
        h, a = v
        return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (int(a * 255),)
    return tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) + (255,)


def render(name, spec, scale):
    rows = spec['rows']
    w, h = len(rows[0]), len(rows)
    im = Image.new('RGBA', (w * scale, h * scale), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.':
                col = hex_rgba(spec['pal'][ch])
                d.rectangle([x * scale, y * scale, (x + 1) * scale - 1, (y + 1) * scale - 1], fill=col)
    return im


def svg_of(name, spec):
    rows = spec['rows']
    w, h = len(rows[0]), len(rows)
    parts = []
    for y, row in enumerate(rows):
        x = 0
        while x < w:
            ch = row[x]
            if ch == '.':
                x += 1
                continue
            run = 1
            while x + run < w and row[x + run] == ch:
                run += 1
            v = spec['pal'][ch]
            if isinstance(v, tuple):
                parts.append('<rect x="%d" y="%d" width="%d" height="1" fill="%s" opacity="%s"/>' % (x, y, run, v[0], v[1]))
            else:
                parts.append('<rect x="%d" y="%d" width="%d" height="1" fill="%s"/>' % (x, y, run, v))
            x += run
    return '<svg viewBox="0 0 %d %d" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">%s</svg>' % (w, h, ''.join(parts))


# checks: every row same width, every char in palette
for name, spec in SPRITES.items():
    ws = {len(r) for r in spec['rows']}
    assert len(ws) == 1, '%s ragged rows %s' % (name, ws)
    chars = {c for r in spec['rows'] for c in r} - {'.'}
    missing = chars - set(spec['pal'])
    assert not missing, '%s missing colours %s' % (name, missing)

# preview grid at 6x on the floor colour
SC = 6
cols = 5
cell = 120
names = list(SPRITES)
rows_n = (len(names) + cols - 1) // cols
grid = Image.new('RGB', (cols * cell, rows_n * (cell + 16)), '#161022')
d = ImageDraw.Draw(grid)
for i, name in enumerate(names):
    im = render(name, SPRITES[name], SC)
    cx = (i % cols) * cell + (cell - im.width) // 2
    cy = (i // cols) * (cell + 16) + (cell - im.height) // 2
    grid.paste(im, (cx, cy), im)
    d.text(((i % cols) * cell + 6, (i // cols) * (cell + 16) + cell - 2), name, fill='#ffe135')
grid.save(OUT_PNG)

with open(OUT_SVG, 'w', encoding='utf-8') as f:
    for name in names:
        f.write(name + '\n' + svg_of(name, SPRITES[name]) + '\n\n')

# the guide's mystery icon as a PNG thumb (the field-guide teaser card)
render('mystery', SPRITES['mystery'], 6).save(
    os.path.join(SITE, 'public', 'assets', 'rave-guide', 'mystery.png'), optimize=True)

# the traffic cone also becomes an ENGINE extra (worn on the head, vinyl
# pattern) — engine SVGs use 10 svg-px per grid unit, so emit a x10 variant
def svg_x10(spec):
    rows = spec['rows']
    w, h = len(rows[0]), len(rows)
    parts = []
    for y, row in enumerate(rows):
        x = 0
        while x < w:
            ch = row[x]
            if ch == '.':
                x += 1
                continue
            run = 1
            while x + run < w and row[x + run] == ch:
                run += 1
            v = spec['pal'][ch]
            col = v[0] if isinstance(v, tuple) else v
            parts.append('<rect x="%d" y="%d" width="%d" height="%d" fill="%s"/>' % (x * 10, y * 10, run * 10, 10, col))
            x += run
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" shape-rendering="crispEdges">%s</svg>' % (w * 10, h * 10, w * 10, h * 10, ''.join(parts))

with open(OUT_SVG, 'a', encoding='utf-8') as f:
    f.write('cone-ENGINE-x10\n' + svg_x10(SPRITES['cone']) + '\n')
print('preview:', os.path.relpath(OUT_PNG, SITE), '| svgs:', os.path.relpath(OUT_SVG, SITE))
