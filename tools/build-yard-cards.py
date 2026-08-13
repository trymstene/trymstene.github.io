# -*- coding: utf-8 -*-
"""🏡 YARD CARDS — real community homesteads as frontpage screenshots.

Fetches the neighbourhood census (QA yards excluded server-side), renders
each real yard from its PUBLIC snapshot — plate crop + structure + items +
soil, the same sprites the game uses — and writes:

    public/assets/world/yard-<slug>.jpg     640x480 card
    src/data/yard-cards.json                [{slug,name,stage}] for the page

Re-run after notable yard changes (it is a snapshot, like the plates).
"""
import io
import json
import os
import re
import urllib.request

from PIL import Image

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(SITE, 'public', 'assets')
API = 'https://banana-rave.trymstene.workers.dev'


def get(url):
    req = urllib.request.Request(url, headers={'Origin': 'https://trymstene.com', 'User-Agent': 'Mozilla/5.0 (yard-cards build)'})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode('utf-8'))


def sprite(path):
    return Image.open(os.path.join(ASSETS, path)).convert('RGBA')


# decor manifest: id -> {img, w, h} regexed from the game's own data
DECOR_SRC = io.open(os.path.join(SITE, 'src', 'data', 'decor.js'), encoding='utf-8').read()
DEX = {}
for m in re.finditer(r"\{ id: '([a-z0-9]+)',.*?w: (\d+), h: (\d+),.*?img: '([^']+)'", DECOR_SRC):
    DEX[m.group(1)] = { 'w': int(m.group(2)), 'h': int(m.group(3)), 'img': m.group(4) }

STRUCTS = { 1: 'ov-tent1.png', 2: 'ov-mobm3.png', 3: 'ov-country.png' }

plate = sprite('homestead/homestead.png')

stats = get(API + '/yards/stats')
cards = []
for entry in stats.get('list', []):
    if entry.get('qa'):
        continue
    slug = entry['slug']
    try:
        doc = get(API + '/yards/yard?slug=' + slug)
    except Exception as e:
        print('skip', slug, e)
        continue
    im = plate.copy()
    home = doc.get('home') or { 'x': 1000, 'y': 560 }
    # soil
    try:
        soil_t = sprite('park/g-soil-wet.png')
        for c in (doc.get('soil') or [])[:40]:
            im.alpha_composite(soil_t, (c['i'] * 48 + 4, c['j'] * 48 + 12))
    except Exception:
        pass
    # layered draw: items + structure sorted by y (painter's algorithm)
    layers = []
    for it in (doc.get('items') or [])[:60]:
        d = DEX.get(it.get('id'))
        if d:
            layers.append((it['y'], d['img'], it['x'] - d['w'] / 2, it['y'] - d['h'], d['w'], d['h']))
    st = STRUCTS.get(doc.get('stage') or 1)
    look = doc.get('look') or (doc.get('style') or {}).get(str(doc.get('stage') or 1)) or ''
    if look and os.path.exists(os.path.join(ASSETS, 'homestead', 'ov-' + look + '.png')):
        st = 'ov-' + look + '.png'
    if st:
        try:
            sp = sprite('homestead/' + st)
            layers.append((home['y'], 'homestead/' + st, home['x'] - sp.width / 2, home['y'] - sp.height, sp.width, sp.height))
        except Exception:
            pass
    layers.sort(key=lambda l: l[0])
    for y, img, x, ty, w, h in layers:
        try:
            sp = sprite(img.lstrip('/').replace('assets/', '', 1) if img.startswith('/assets/') else img)
            if (sp.width, sp.height) != (round(w), round(h)):
                sp = sp.resize((max(1, round(w)), max(1, round(h))), Image.NEAREST)
            im.alpha_composite(sp, (round(x), round(ty)))
        except Exception:
            pass
    # camera: 4:3 crop centred on the home
    cw, ch = 880, 660
    x0 = max(0, min(plate.width - cw, home['x'] - cw / 2))
    y0 = max(0, min(plate.height - ch, home['y'] - ch * 0.58))
    card = im.crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch))).convert('RGB')
    card = card.resize((640, 480), Image.LANCZOS)
    card.save(os.path.join(ASSETS, 'world', 'yard-' + slug + '.jpg'), quality=84)
    cards.append({ 'slug': slug, 'name': entry['name'], 'stage': entry['stage'] })
    print(('yard-' + slug + '.jpg ' + entry['name']).encode('ascii', 'replace').decode())

with io.open(os.path.join(SITE, 'src', 'data', 'yard-cards.json'), 'w', encoding='utf-8') as f:
    json.dump(cards, f, ensure_ascii=False, indent=1)
print('manifest:', len(cards), 'yards')
