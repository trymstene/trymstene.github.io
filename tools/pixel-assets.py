# Pixel-art accessory designer for the dancing banana.
# Authors assets as ASCII maps on the banana's own 13px grid, composites them
# onto real dance frames for visual verification, and emits SVG rect-grids.
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
    '.': None,
}

ASSETS = {
    # ---- shades: one style, two views (classic pixel "deal with it") ----
    'shadesFront': '''
KKKKKKKKKKKKKKK
.KWWKKK.KWWKKK.
.KKKKKK.KKKKKK.
..KKKK...KKKK..
''',
    'shadesSide': '''
KKKKKKKKKKKKK
KWWKKKKK.....
KKKKKKKK.....
.KKKKKK......
''',
    # ---- hats ----
    'tophat': '''
..KKKKKK..
..KGKKKK..
..KGKKKK..
..KRRRRK..
..KKKKKK..
KKKKKKKKKK
''',
    'crown': '''
Y....Y....Y
YY...YY...Y
YY..YYY..YY
YYYYYYYYYYY
YYYYYRYYYYY
YYYYYYYYYYY
OOOOOOOOOOO
''',
    'party': '''
....WW....
...WWWW...
...WWWW...
....PP....
...PPPP...
...PWPP...
..PPPPPP..
..PPPWPP..
.PPPPPPPP.
.PPPPPPWP.
PPPPPPPPPP
''',
}

def parse(m):
    rows = [r for r in m.strip('\n').split('\n')]
    w = max(len(r) for r in rows)
    return [r.ljust(w, '.') for r in rows], w, len(rows)

def render(name, unit=UNIT):
    rows, w, h = parse(ASSETS[name])
    img = Image.new('RGBA', (w*unit, h*unit), (0,0,0,0))
    d = ImageDraw.Draw(img)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            c = PALETTE.get(ch)
            if c: d.rectangle([x*unit, y*unit, (x+1)*unit-1, (y+1)*unit-1], fill=c)
    return img

def svg(name):
    rows, w, h = parse(ASSETS[name])
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

# ---- verification: composite onto frames 0 (side-right), 2 (front), 4 (side-left) ----
if __name__ == '__main__':
    import sys
    im = Image.open('C:/Web Development/trymstene.com/public/assets/dancing-banana-transparent.gif')
    frames = [f.convert('RGBA') for f in ImageSequence.Iterator(im)]
    FR = {0: (232,222,256,85,'right'), 1: (232,192,256,57,'right'), 2: (234,135,242,0,'front'), 3: (232,156,212,28,'front'), 4: (236,222,212,85,'left'), 5: (236,192,212,57,'left')}
    combos = [(0,'tophat'),(3,'tophat'),(4,'tophat'),(0,'crown'),(3,'crown'),(4,'party'),(1,'party'),(5,'crown')]
    W,H = im.size
    sheet = Image.new('RGB',(W*4,H*2),(255,0,255))
    for j,(fi, hat) in enumerate(combos):
        bg = Image.new('RGBA',(W,H),(255,0,255,255)); bg.alpha_composite(frames[fi])
        ecx,ecy,hcx,tipy,face = FR[fi]
        # shades
        sh = render('shadesFront' if face=='front' else 'shadesSide')
        if face=='left': sh = sh.transpose(Image.FLIP_LEFT_RIGHT)
        bg.alpha_composite(sh, (ecx - sh.width//2, ecy - sh.height//2))
        # hat: on lean frames, shift toward the face + bite deeper so it sits ON
        # the head mass, not balanced on the very peak of the tip
        ht = render(hat)
        shift = 0 if face=='front' else (-int(1.5*UNIT) if face=='right' else int(1.5*UNIT))
        overlap = int(1.6*UNIT) if face=='front' else int(2.4*UNIT)
        bg.alpha_composite(ht, (hcx + shift - ht.width//2, tipy + overlap - ht.height))
        sheet.paste(bg.convert('RGB'), ((j%4)*W, (j//4)*H))
    sheet.thumbnail((1600,900))
    out = sys.argv[1] if len(sys.argv)>1 else 'pixel_assets_check.png'
    sheet.save(out)
    print('saved', out)
    if '--svg' in sys.argv:
        for n in ASSETS: print(n, '=', repr(svg(n)), '\n')
