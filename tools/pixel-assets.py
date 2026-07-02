# Pixel-art accessory designer for the dancing banana.
# Authors assets as ASCII maps on the banana's own 13px grid, composites them
# onto real dance frames for visual verification, and emits SVG rect-grids.
#
#   python tools/pixel-assets.py out.png          -> verification contact sheet
#   python tools/pixel-assets.py out.png --svg    -> also print SVG strings
from PIL import Image, ImageSequence, ImageDraw

UNIT = 13  # banana pixel size in source px

PALETTE = {
    'K': (17, 17, 17, 255),      # black
    'G': (72, 72, 72, 255),      # dark grey shine
    'W': (255, 255, 255, 255),   # white
    'R': (226, 32, 32, 255),     # red
    'Y': (242, 194, 0, 255),     # gold
    'O': (196, 154, 0, 255),     # darker gold shade
    'P': (255, 77, 109, 255),    # hot pink
    'C': (77, 184, 255, 255),    # cone blue
    'B': (138, 90, 43, 255),     # cowboy brown
    'D': (90, 54, 24, 255),      # dark brown / knot
    '.': None,
}

# assets in this set get an automatic 1-unit black outline (like the sprite
# itself has) so they stay visible on ANY background colour
OUTLINED = {'crown', 'party', 'cowboy', 'bowtie', 'heartsFront', 'heartsSide', 'visorFront', 'visorSide'}

ASSETS = {
    # ---- shades: one style, two views (classic pixel "deal with it") ----
    'shadesFront': '''
KKKKKKKKKKKKKKK
.KWWKKK.KWWKKK.
.KKKKKK.KKKKKK.
.KKKKKK.KKKKKK.
..KKKK...KKKK..
''',
    'shadesSide': '''
KKKKKKKKKKKKK
KWWKKKKK.....
KKKKKKKK.....
KKKKKKKK.....
.KKKKKK......
''',
    # ---- hats ----
    'tophat': '''
..KKKKKKKK..
..KGKKKKKK..
..KGKKKKKK..
..KGKKKKKK..
..KRRRRRRK..
..KKKKKKKK..
KKKKKKKKKKKK
KKKKKKKKKKKK
''',
    'crown': '''
Y....Y....Y
YY..YYY..YY
YYY.YYY.YYY
YYYYYRYYYYY
YYYYYYYYYYY
OOOOOOOOOOO
''',
    'party': '''
....YY....
...YYYY...
....CC....
...CCCC...
...CWCC...
..CCCCCC..
..CCWCCC..
.CCCCCCWC.
.CCCCCCCC.
CCCCCCCCCC
''',
    'cowboy': '''
.....BBBB.....
....BBBBBB....
....BBBBBB....
....DDDDDD....
BB..BBBBBB..BB
.BBBBBBBBBBBB.
..BBBBBBBBBB..
''',
    # ---- more shade styles (front + side views like the deal-with-its) ----
    'heartsFront': '''
PP.PP.PP.PP
PWPPPPPPWPP
.PPP...PPP.
..P.....P..
''',
    'heartsSide': '''
PPP.PPP....
PWPPPPPPPPP
PPPPPPP....
.PPPPP.....
..PPP......
...P.......
''',
    'visorFront': '''
CCCCCCCCCCCCC
CWWCCCCCCCCCC
CCCCCCCCCCCCC
''',
    'visorSide': '''
CCCCCCCCC
CWWCCCCCC
CCCCCCCCC
''',
    # ---- extras ----
    'mustacheFront': '''
DDDD.DDDD
DDDDDDDDD
.DD...DD.
''',
    'mustacheSide': '''
DDDDD.
DDDDDD
.DD...
''',
    'bowtie': '''
RR...RR
RRRDRRR
RR...RR
''',
}

def parse(m):
    rows = [r for r in m.strip('\n').split('\n')]
    w = max(len(r) for r in rows)
    return [r.ljust(w, '.') for r in rows]

def add_outline(rows):
    w, h = len(rows[0]), len(rows)
    grid = [['.'] * (w + 2) for _ in range(h + 2)]
    for y in range(h):
        for x in range(w):
            if rows[y][x] != '.': grid[y + 1][x + 1] = rows[y][x]
    out = [row[:] for row in grid]
    for y in range(h + 2):
        for x in range(w + 2):
            if grid[y][x] == '.':
                for dy, dx in ((0,1),(0,-1),(1,0),(-1,0)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h + 2 and 0 <= nx < w + 2 and grid[ny][nx] not in ('.', 'K'):
                        out[y][x] = 'K'; break
    return [''.join(r) for r in out]

def grid_of(name):
    rows = parse(ASSETS[name])
    if name in OUTLINED: rows = add_outline(rows)
    return rows

def render(name, unit=UNIT):
    rows = grid_of(name)
    w, h = len(rows[0]), len(rows)
    img = Image.new('RGBA', (w*unit, h*unit), (0,0,0,0))
    d = ImageDraw.Draw(img)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            c = PALETTE.get(ch)
            if c: d.rectangle([x*unit, y*unit, (x+1)*unit-1, (y+1)*unit-1], fill=c)
    return img

def svg(name):
    rows = grid_of(name)
    w, h = len(rows[0]), len(rows)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w*10} {h*10}" width="{w*10}" height="{h*10}" shape-rendering="crispEdges">']
    for y, row in enumerate(rows):
        x = 0
        while x < len(row):
            ch = row[x]
            if ch == '.': x += 1; continue
            x0 = x
            while x < len(row) and row[x] == ch: x += 1
            c = PALETTE[ch]
            hexc = '#%02x%02x%02x' % c[:3]
            parts.append(f'<rect x="{x0*10}" y="{y*10}" width="{(x-x0)*10}" height="10" fill="{hexc}"/>')
    parts.append('</svg>')
    return ''.join(parts)

# ---- verification: composite onto real frames ----
if __name__ == '__main__':
    import sys
    im = Image.open('C:/Web Development/trymstene.com/public/assets/dancing-banana-transparent.gif')
    frames = [f.convert('RGBA') for f in ImageSequence.Iterator(im)]
    FR = {0: (232,222,256,85,'right'), 1: (232,192,256,57,'right'), 2: (234,135,242,0,'front'),
          3: (232,156,212,28,'front'), 4: (236,222,212,85,'left'), 5: (236,192,212,57,'left')}
    # placement (kept in sync with banana-builder.js):
    HAT_OVERLAP_FRONT, HAT_OVERLAP_SIDE, HAT_SHIFT_SIDE = 5.8, 5.8, 2.0
    OUTLINE_SEAT = -1.0   # outlined hats: their bottom row is outline, not body
    SH_DY = -0.5          # shades ride slightly high to fully cover the eye whites
    MU_DY, MU_SIDE_DX = 3.6, -1.2
    BT_DY, BT_SIDE_DX = 6.0, -1.0
    combos = [(0,'tophat','shades'),(3,'tophat','hearts'),(4,'cowboy','visor'),(0,'crown','hearts'),
              (3,'crown','visor'),(4,'party','shades'),(1,'cowboy','hearts'),(3,'party','shades')]
    W,H = im.size
    SHADE_ART = {'shades': ('shadesFront','shadesSide'), 'hearts': ('heartsFront','heartsSide'), 'visor': ('visorFront','visorSide')}
    cells = []
    for fi, hat, shade in combos:
        bg = Image.new('RGBA',(W,H),(255,0,255,255)); bg.alpha_composite(frames[fi])
        ecx,ecy,hcx,tipy,face = FR[fi]
        side = face != 'front'
        # shades
        sh = render(SHADE_ART[shade][1 if side else 0])
        if face=='left': sh = sh.transpose(Image.FLIP_LEFT_RIGHT)
        bg.alpha_composite(sh, (ecx - sh.width//2, int(ecy + SH_DY*UNIT) - sh.height//2))
        # moustache
        mu = render('mustacheFront' if not side else 'mustacheSide')
        mdx = 0 if not side else int(MU_SIDE_DX*UNIT) * (1 if face!='left' else -1)
        if face=='left': mu = mu.transpose(Image.FLIP_LEFT_RIGHT)
        bg.alpha_composite(mu, (ecx + mdx - mu.width//2, int(ecy + MU_DY*UNIT) - mu.height//2))
        # bow tie
        bt = render('bowtie')
        bdx = 0 if not side else int(BT_SIDE_DX*UNIT) * (1 if face!='left' else -1)
        bg.alpha_composite(bt, (ecx + bdx - bt.width//2, int(ecy + BT_DY*UNIT) - bt.height//2))
        # hat
        ht = render(hat)
        shift = 0 if not side else (-int(HAT_SHIFT_SIDE*UNIT) if face=='right' else int(HAT_SHIFT_SIDE*UNIT))
        seat = (HAT_OVERLAP_FRONT if not side else HAT_OVERLAP_SIDE) + (OUTLINE_SEAT if hat in OUTLINED else 0)
        bg.alpha_composite(ht, (hcx + shift - ht.width//2, tipy + int(seat*UNIT) - ht.height))
        cells.append(bg.convert('RGB'))

    if '--zoom' in sys.argv:
        # close-up crops of the head/face region for pixel-level seating checks
        CW, CH = 320, 400
        sheet = Image.new('RGB',(CW*4, CH*2),(255,0,255))
        for j,((fi, hat, shade), cell) in enumerate(zip(combos, cells)):
            hcx, tipy = FR[fi][2], FR[fi][3]
            box = (hcx-CW//2, max(0,tipy-150), hcx+CW//2, max(0,tipy-150)+CH)
            sheet.paste(cell.crop(box), ((j%4)*CW, (j//4)*CH))
    else:
        sheet = Image.new('RGB',(W*4,H*2),(255,0,255))
        for j, cell in enumerate(cells):
            sheet.paste(cell, ((j%4)*W, (j//4)*H))
        sheet.thumbnail((1600,900))
    out = sys.argv[1] if len(sys.argv)>1 else 'pixel_assets_check.png'
    sheet.save(out)
    print('saved', out)
    if '--svg' in sys.argv:
        for n in ASSETS: print(n, '=', repr(svg(n)), '\n')
