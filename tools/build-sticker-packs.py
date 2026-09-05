# -*- coding: utf-8 -*-
"""build-sticker-packs.py — Series 1 sticker sheets: preview for QA, print files after.

Four A5 kiss-cut sheets, 3x4, twelve stickers each. Every sticker is the
HANDS-UP pose (engine frame 2) and slot 1 on every sheet is the original 1999
banana (Trym's rule: each pack carries the original). Costume stickers render
from the wardrobe at print resolution via banana_render; captioned squares
take frame 2 of their gallery GIF.

    python tools/build-sticker-packs.py --preview   # labelled sheets to the scratchpad, for Trym to QA
    python tools/build-sticker-packs.py --print     # 1749x2481 @300dpi unlabelled print files

⚠️ PACKS ARE DECIDED BY LOOKING, NOT BY DESCRIPTION. On 5 Sep three Giphy
thumbnails were misread in a row (an arrow that was a pigeon, gloves that were
an arrow). The --preview output exists so the assignment below is approved
from rendered art, never from a guess about what a small picture shows.
"""
import argparse, io, json, os, sys
from urllib.parse import parse_qs

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import banana_render as br
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(HERE, '..')
GAL = json.load(io.open(os.path.join(ROOT, 'src', 'data', 'gallery.json'), encoding='utf-8'))
# gallery titles carry a trailing ' Banana' on some costumes ('Sombrero Banana');
# the pack lists name them bare, so the lookup accepts either form
def _key(t): return t.replace(' Banana', '').strip().lower()
BY_TITLE = {_key(e['title']): e for e in GAL}
# gallery files are split across folders (giphy-stickers/ holds the costumes,
# the captioned memes sit elsewhere under assets) -- index the tree once
ASSETS = os.path.join(ROOT, 'public', 'assets')
FILES = {f: os.path.join(r, f) for r, _, fs in os.walk(ASSETS) for f in fs if f.endswith('.gif')}
POSE = 2                       # hands straight up — the ta-da frame
W, H = 1749, 2481              # A5 at 300 DPI, Printful's sheet
COLS, ROWS = 3, 4

# A cell is either a gallery title (looked up), a raw outfit dict for a
# wardrobe-only design, or ORIGINAL.
ORIGINAL = {'_label': 'The Original', 'hat': 'none', 'glasses': 'none', 'extras': []}
def outfit(label, **o):
    return {'_label': label, 'hat': o.get('hat', 'none'), 'glasses': o.get('glasses', 'none'), 'extras': o.get('extras', [])}

PACKS = {
    'A': [ORIGINAL, 'Bird Friend', outfit('Bow Tie', extras=['bowtie']), 'Arrow Through the Head',
          'Who, Me?', 'Rubber Chicken', 'Propeller Beanie', outfit('Shades', glasses='shades'),
          'Googly Eyes', 'Sombrero', 'Cozy Scarf', '3D Glasses'],
    'B': [ORIGINAL, 'Court Jester', outfit('Party Hat', hat='party'), outfit('Crown', hat='crown'),
          outfit('Glowstick', glasses='shades', extras=['glowstick']), 'Too Cool', 'Winner Winner',
          'Little Devil', 'Boombox', 'Bunch of Balloons', 'Clown Shoes', 'Fishbowl Head'],
    'C': [ORIGINAL, outfit('Cowboy', hat='cowboy'), outfit('Top Hat & Monocle', hat='tophat', glasses='monocle'),
          "Something's Fishy", 'Captain', 'Eyepatch', 'Viking', 'Cone of Shame', 'Spa Day',
          'Banana Rights', 'We Did It, Grad', 'Good Egg'],
    'D': [ORIGINAL, 'Rent Is Due, Dance Is Free', 'Bills? Bananas.', 'Born to Dance, Forced to Work',
          'My Last Braincell', 'Everything Is Content', 'Dance First, Think Later',
          'Emotional Support Banana', 'Monday Again. How. Why.', 'Not Thriving, But Vibing',
          'This Is Fine', '100% Ripe'],
}
NOT_PLACED = ['But First, Coffee', 'Touched Grass, It Was Mid', 'On Mute, On Purpose',
              'Me After One Coffee', 'Quiet Quitting, Loud Dancing']


def gallery_outfit(params):
    q = parse_qs(params)
    return {'hat': q.get('h', ['none'])[0], 'glasses': q.get('g', ['none'])[0],
            'extras': [e for e in q.get('ex', [''])[0].split('.') if e]}


def art_for(cell, scale):
    """RGBA art for one cell + its label. Costumes render; squares come from the GIF."""
    if isinstance(cell, dict):
        im = br.render(POSE, cell, scale=scale); return im.crop(im.getbbox()), cell['_label']
    e = BY_TITLE[_key(cell)]
    if e['kind'] == 'sticker':
        im = br.render(POSE, gallery_outfit(e['params']), scale=scale); return im.crop(im.getbbox()), e['title']
    g = Image.open(FILES[e['file']])
    g.seek(min(POSE, getattr(g, 'n_frames', 1) - 1))
    return g.convert('RGBA'), e['title']


def sheet(pack, cells, preview):
    S = 0.5 if preview else 1.0
    w, h = int(W * S), int(H * S)
    cw, ch = w / COLS, h / ROWS
    # ⚠️ the preview header gets its OWN strip above the grid. Drawn over row 1
    # it hid the tops of every tall hat -- the jester and the party hat lost
    # their peaks -- which is precisely the misjudgement the preview exists to
    # prevent. The print file has no header and no offset.
    top = 48 if preview else 0
    # ⚠️ 0.64 cm between cut lines is Printful's minimum: 76 px at 300 DPI.
    # 0.80 of the cell leaves ~110 px on the tightest axis, comfortably over it.
    fill = 0.80 if not preview else 0.72
    canvas = Image.new('RGBA', (w, h + top), (255, 255, 255, 255))
    dr = ImageDraw.Draw(canvas)
    try: font = ImageFont.truetype(os.path.join(HERE, 'ArchivoBlack.ttf'), 22 if preview else 1)
    except Exception: font = ImageFont.load_default()
    for i, cell in enumerate(cells):
        art, label = art_for(cell, scale=8 if not preview else 4)
        k = min(cw * fill / art.width, ch * fill / art.height)
        art = art.resize((max(1, int(art.width * k)), max(1, int(art.height * k))), Image.NEAREST)
        x0, y0 = int((i % COLS) * cw), top + int((i // COLS) * ch)
        canvas.alpha_composite(art, (x0 + int((cw - art.width) / 2), y0 + int((ch * (0.88 if preview else 1) - art.height) / 2)))
        if preview:
            dr.rectangle([x0 + 2, y0 + 2, x0 + cw - 2, y0 + ch - 2], outline=(200, 200, 200, 255), width=1)
            dr.text((x0 + 10, y0 + ch - 34), '%d. %s' % (i + 1, label.replace(' Banana', '')[:24]), fill=(17, 17, 17, 255), font=font)
    if preview:
        dr.rectangle([0, 0, w, 44], fill=(255, 225, 53, 255))
        dr.text((14, 8), 'PACK %s  ·  preview, not print  ·  hands-up pose  ·  12 stickers' % pack,
                fill=(17, 17, 17, 255), font=font)
    return canvas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--preview', action='store_true')
    ap.add_argument('--print', dest='prnt', action='store_true')
    ap.add_argument('--out', default=os.path.join(ROOT, 'print-files', 'sticker-packs'))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for pack, cells in PACKS.items():
        assert len(cells) == COLS * ROWS, pack
        img = sheet(pack, cells, preview=a.preview)
        name = 'pack-%s-%s.png' % (pack, 'preview' if a.preview else 'print')
        img.convert('RGB').save(os.path.join(a.out, name), dpi=(300, 300))
        print('  wrote', name, '%dx%d' % img.size)
    print('  not placed in Series 1:', ' · '.join(NOT_PLACED))


if __name__ == '__main__':
    main()
