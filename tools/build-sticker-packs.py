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
# 2x3, not 3x4 (Trym, 5 Sep): the sheet costs the same at any count, so the
# count is an OFFER decision. Six gives a 5.6 cm sticker instead of 3.9 --
# a laptop sticker, not an emoji -- and eight packs for the catalogue instead
# of four, so the collect-them-all pull has twice the reach.
COLS, ROWS = 2, 3

# A cell is either a gallery title (looked up), a raw outfit dict for a
# wardrobe-only design, or ORIGINAL.
ORIGINAL = {'_label': 'The Original', 'hat': 'none', 'glasses': 'none', 'extras': []}
def catalog(label, *ids):
    """A cell made of COMMUNITY items from the live catalog, by id."""
    return {'_label': label, '_catalog': list(ids)}

# --- the community-item channel, ported from the engine's `custom` branch ---
# A catalog item stores its pixels in the Forge format: a palette-index grid,
# base64 per frame, 33 shared colours + optional custom ones. The engine draws
# frame 0's PAINTED BOX (trimmed to non-transparent cells) with its top-left at
# the anchor point for the item's slot plus the (ox, oy) offset captured when
# it was drawn, both in sprite units, scaled by `scale`. Mirrored here exactly:
#   cw = bw*unit*s, ch = bh*unit*s, px = anchor.x*S + ox*unit, py = anchor.y*S + oy*unit
import base64, json as _json, urllib.request
FORGE_PALETTE = [None, '#111111', '#fffdf5', '#ffe135', '#f2c200', '#5a3618', '#e22020', '#ff4d6d',
    '#ff9f1c', '#37d67a', '#39ff14', '#4db8ff', '#6c8cff', '#b388ff', '#ff2ec4', '#484848', '#d9a066',
    '#ffdbac', '#c68642', '#8d5524', '#8e1600', '#7b1e3c', '#1d7a3c', '#0fb5ba', '#00e5ff', '#1e2a78',
    '#6a1b9a', '#ffc1e3', '#a8e6cf', '#d4af37', '#556b2f', '#9e9e9e', '#bdbdbd']
_CATALOG = None
def catalog_item(cid):
    global _CATALOG
    if _CATALOG is None:
        # ⚠️ a bare urllib User-Agent gets a 403 from the edge; curl and browsers do not
        req = urllib.request.Request('https://share.trymstene.com/catalog/items.json',
                                     headers={'User-Agent': 'trymstene-tools/1.0 (build-sticker-packs)'})
        _CATALOG = {x['id']: x for x in _json.load(urllib.request.urlopen(req))}
    return _CATALOG[cid]

def forge_art(forge):
    """frame 0 of a forge string -> (RGBA image of the painted box, bw, bh) in CELLS"""
    d = _json.loads(forge[6:] if forge.startswith('forge:') else forge)
    w, h = (d['w'], d['h']) if d.get('v') == 3 else (d['size'], d['size'])
    pal = FORGE_PALETTE + [c for c in (d.get('cpal') or []) if isinstance(c, str)]
    g = base64.b64decode(d['frames'][0])
    cells = [(x, y, pal[g[y * w + x]]) for y in range(h) for x in range(w) if g[y * w + x] and g[y * w + x] < len(pal) and pal[g[y * w + x]]]
    if not cells: return None, 0, 0
    x0, x1 = min(c[0] for c in cells), max(c[0] for c in cells)
    y0, y1 = min(c[1] for c in cells), max(c[1] for c in cells)
    bw, bh = x1 - x0 + 1, y1 - y0 + 1
    im = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
    for x, y, col in cells:
        im.putpixel((x - x0, y - y0), tuple(int(col[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    return im, bw, bh

def wear_anchor(idx, kind, hand=None):
    F = br.FRAMES[idx]
    if kind == 'face': return F['eyeCx'], F['eyeCy']
    if kind in ('chest', 'body'): return F['btCx'], F['eyeCy']
    if kind == 'feet': fx = F.get('feetX') or [br.FEET_CX - 71, br.FEET_CX + 71]; return (fx[0] + fx[1]) / 2, br.FEET_BOTTOM
    if kind == 'hand': hnd = F['hands'][0 if hand == 'left' else 1]; return hnd[0], hnd[1]
    return F['hatCx'], F['tipY']

def render_catalog(idx, ids, scale):
    """the dressed banana + community items, same canvas/pad as banana_render"""
    im = br.render(idx, {}, scale=scale)
    S = scale; unit = br.PX * S; pad = br.pad_for(scale)
    for cid in ids:
        wear = catalog_item(cid)['wear']
        art, bw, bh = forge_art(wear['forge'])
        if art is None: continue
        s_ = wear.get('scale') or 1
        cw, ch = max(1, int(round(bw * unit * s_))), max(1, int(round(bh * unit * s_)))
        ax, ay = wear_anchor(idx, wear.get('anchor'), wear.get('hand'))
        px = pad + ax * S + (wear.get('ox') or 0) * unit
        py = pad + ay * S + (wear.get('oy') or 0) * unit
        im.alpha_composite(art.resize((cw, ch), Image.NEAREST), (int(round(px)), int(round(py))))
    return im

def outfit(label, **o):
    return {'_label': label, 'hat': o.get('hat', 'none'), 'glasses': o.get('glasses', 'none'), 'extras': o.get('extras', [])}

PACKS = {
    # one Giphy top-8 hero per pack, split pairs never share a sheet
    # (Captain/Eyepatch, Fishy/Fishbowl, Shades/Too Cool, the two coffees)
    '1': [ORIGINAL, 'Bird Friend', 'Rubber Chicken', 'Googly Eyes', outfit('Shades', glasses='shades'), 'Cozy Scarf'],
    '2': [ORIGINAL, 'Court Jester', 'Too Cool', 'Bunch of Balloons', 'Clown Shoes', 'Spa Day'],
    '3': [ORIGINAL, outfit('Bow Tie', extras=['bowtie']), 'Propeller Beanie', '3D Glasses', 'Good Egg', 'Cone of Shame'],
    # Boombox WITHOUT the deal-with-it shades the gallery version wears (Trym, 5 Sep)
    '4': [ORIGINAL, outfit('Party Hat', hat='party'), 'Winner Winner', outfit('Boombox', extras=['boombox']), 'Banana Rights', 'We Did It, Grad'],
    # the Glowstick banana wears shades too, so a shades-only banana beside it read as a
    # duplicate (Trym) -- Sombrero comes in from pack 1, Shades goes there
    '5': [ORIGINAL, outfit('Glowstick', glasses='shades', extras=['glowstick']), 'Sombrero',
          'Little Devil', 'Fishbowl Head', 'Viking'],
    '6': [ORIGINAL, outfit('Crown', hat='crown'), outfit('Cowboy', hat='cowboy'),
          outfit('Top Hat & Monocle', hat='tophat', glasses='monocle'), 'Captain', 'But First, Coffee'],
    '7': [ORIGINAL, 'Arrow Through the Head', 'Who, Me?', "Something's Fishy", 'Eyepatch',
          catalog('Pink Bow & Shoes', 'c_3e2d0938cb', 'c_3005fcb9e3')],   # by Tulip: Cute pink bow + Pink shoes
    '8': [ORIGINAL, 'Rent Is Due, Dance Is Free', 'Bills? Bananas.', 'Born to Dance, Forced to Work',
          'This Is Fine', '100% Ripe'],
}
NOT_PLACED = ['My Last Braincell', 'Everything Is Content', 'Dance First, Think Later',
              'Emotional Support Banana', 'Touched Grass, It Was Mid', 'Monday Again. How. Why.',
              'Not Thriving, But Vibing', 'On Mute, On Purpose', 'Me After One Coffee',
              'Quiet Quitting, Loud Dancing']


def gallery_outfit(params):
    q = parse_qs(params)
    return {'hat': q.get('h', ['none'])[0], 'glasses': q.get('g', ['none'])[0],
            'extras': [e for e in q.get('ex', [''])[0].split('.') if e]}


def art_for(cell, scale):
    """RGBA art for one cell + its label. Costumes render; squares come from the GIF."""
    if isinstance(cell, dict) and cell.get('_catalog'):
        im = render_catalog(POSE, cell['_catalog'], scale); return im.crop(im.getbbox()), cell['_label']
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
    # ⚠️ TRANSPARENT FOR PRINT. Printful's kiss-cut runs around the edge of
    # every non-transparent island, so a white background would make the whole
    # sheet ONE sticker. White only in the preview, where it stands for the paper.
    canvas = Image.new('RGBA', (w, h + top), (255, 255, 255, 255) if preview else (0, 0, 0, 0))
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
            dr.text((x0 + 10, y0 + ch - 34), '%d. %s' % (i + 1, (label[:-7] if label.endswith(' Banana') else label)[:26]), fill=(17, 17, 17, 255), font=font)
    if preview:
        dr.rectangle([0, 0, w, 44], fill=(255, 225, 53, 255))
        dr.text((14, 8), 'PACK %s  ·  preview, not print  ·  hands-up pose  ·  6 stickers' % pack,
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
        (img.convert('RGB') if a.preview else img).save(os.path.join(a.out, name), dpi=(300, 300))
        print('  wrote', name, '%dx%d' % img.size)
    print('  not placed in Series 1:', ' · '.join(NOT_PLACED))


if __name__ == '__main__':
    main()
