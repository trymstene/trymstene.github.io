# -*- coding: utf-8 -*-
"""The Homestead LEVEL PLANNER — a design table, not a game screen.

Reads the REAL manifests (src/data/decor.js + src/scripts/homestead-geo.js)
and the exported art, and emits ONE self-contained HTML page: the house
ladder side by side, every style, and the full decor availability matrix.
Plan on paper first (Trym), then change the generator — never the reverse.

Usage:  python tools/build-homestead-planner.py [out.html]
"""
import base64
import io
import json
import os
import re
import sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(SITE, 'public', 'assets', 'homestead')

# ---- the truth: parse the generated manifests ------------------------------
decor_src = io.open(os.path.join(SITE, 'src', 'data', 'decor.js'), encoding='utf-8').read()
ITEMS = []
for m in re.finditer(r"\{ id: '([^']+)', name: '([^']+)', cat: '([^']+)', price: (\d+), stage: (\d+),"
                     r" w: (\d+), h: (\d+), surface: '([^']+)'", decor_src):
    ITEMS.append({'id': m.group(1), 'name': m.group(2), 'cat': m.group(3),
                  'price': int(m.group(4)), 'stage': int(m.group(5)),
                  'w': int(m.group(6)), 'h': int(m.group(7)), 'surface': m.group(8)})

geo_src = io.open(os.path.join(SITE, 'src', 'scripts', 'homestead-geo.js'), encoding='utf-8').read()
def geo_json(name):
    m = re.search(r'export const %s = (.+);' % name, geo_src)
    s = re.sub(r'([{,]\s*)(\d+):', r'\1"\2":', m.group(1))   # bare int keys → JSON
    return json.loads(s)
FENCE_TIERS = geo_json('FENCE_TIERS')
STRUCT_STYLES = geo_json('STRUCT_STYLES')
INTERIORS = geo_json('INTERIORS')

# ---- engine constants mirrored (update if the engine changes) --------------
CAPS = [12, 28, 42, 56]
INCAP = {1: 6, 2: 12, 3: 16}
SHIP_MIN = {'garden': 0, 'nature': 0, 'farm': 0, 'fun': 0, 'community': 0,
            'lighting': 30, 'furniture': 60, 'display': 240,
            'kitchen': 45, 'living': 45, 'bedroom': 45, 'bathroom': 45, 'hallway': 45, 'music': 45}
INDOOR = {'kitchen', 'living', 'bedroom', 'bathroom', 'hallway', 'music'}
LADDER = [
    {'tier': 1, 'icon': '⛺', 'name': 'The tent', 'price': 50, 'style': 'tent1', 'room': 'in-tent.png'},
    {'tier': 2, 'icon': '🛖', 'name': 'A real roof', 'price': 250, 'style': 'mobm3', 'room': 'in-wood2.png'},
    {'tier': 3, 'icon': '🏠', 'name': 'The house', 'price': 600, 'style': 'country', 'room': 'in-wood3.png'},
]
CAT_META = [
    ('garden', '🌼 Garden'), ('nature', '🌿 Nature'), ('farm', '🌾 Farm'),
    ('fun', '🎈 Fun'), ('lighting', '🏮 Lighting'), ('furniture', '🪑 Furniture'),
    ('display', '🏆 Display'),
    ('kitchen', '🍳 Kitchen'), ('living', '🛋 Living room'), ('bedroom', '🛏 Bedroom'),
    ('bathroom', '🛁 Bathroom'), ('hallway', '🚪 Hallway'), ('music', '🎸 Music'),
]

def b64(fn, missing_ok=False):
    p = os.path.join(ASSETS, fn)
    if not os.path.isfile(p):
        if missing_ok:
            return None
        raise SystemExit('missing asset: ' + fn)
    mime = 'image/gif' if fn.endswith('.gif') else 'image/png'
    return 'data:%s;base64,' % mime + base64.b64encode(open(p, 'rb').read()).decode()

COIN = b64('coin16.png')
def coin(n):
    return '<span class="price">%d <img class="coin" src="%s" alt="c"></span>' % (n, COIN)

def ship(cat):
    m = SHIP_MIN.get(cat, 0)
    if not m:
        return '<span class="ship now">instant</span>'
    return '<span class="ship van">🚚 %s</span>' % ('%dh' % (m // 60) if m % 60 == 0 and m >= 60 else '%dm' % m)

def cells(t):
    f = FENCE_TIERS[str(t)]['fence']
    return ((f[2] - f[0]) // 48, (f[3] - f[1]) // 48)

# ---- build the page --------------------------------------------------------
H = []
H.append('<meta charset="utf-8">')
H.append('<title>Homestead level planner</title>')
H.append('''<style>
:root { --bg:#fffdf5; --ink:#1a1408; --line:#e7e0cc; --card:#ffffff; --accent:#ffe135;
  --dim:#7a7362; --lock:#b9b19a; --ok:#3f7d33; }
@media (prefers-color-scheme: dark) { :root { --bg:#191610; --ink:#f2ecdd; --line:#332e22;
  --card:#211d14; --dim:#9b937f; --lock:#6b6350; } }
:root[data-theme="dark"] { --bg:#191610; --ink:#f2ecdd; --line:#332e22; --card:#211d14; --dim:#9b937f; --lock:#6b6350; }
:root[data-theme="light"] { --bg:#fffdf5; --ink:#1a1408; --line:#e7e0cc; --card:#ffffff; --dim:#7a7362; --lock:#b9b19a; }
body { background:var(--bg); color:var(--ink); font:15px/1.55 system-ui, sans-serif; margin:0; padding:2rem 1rem 4rem; }
.wrap { max-width:1060px; margin:0 auto; }
h1 { font-size:1.7rem; margin:0 0 .2rem; letter-spacing:-.01em; }
.sub { color:var(--dim); margin:0 0 2rem; max-width:64ch; }
h2 { font-size:1.12rem; margin:2.6rem 0 .8rem; padding-top:1.2rem; border-top:1px solid var(--line); }
table { border-collapse:collapse; width:100%; font-variant-numeric:tabular-nums; }
.scroll { overflow-x:auto; }
th, td { padding:.45rem .6rem; text-align:left; border-bottom:1px solid var(--line); vertical-align:middle; }
th { font-size:.72rem; text-transform:uppercase; letter-spacing:.06em; color:var(--dim); font-weight:600; }
td.num, th.num { text-align:right; }
td.mid, th.mid { text-align:center; }
img.px { image-rendering:pixelated; }
.coin { width:14px; height:14px; image-rendering:pixelated; vertical-align:-2px; }
.price { white-space:nowrap; font-weight:600; }
.ship { font-size:.74rem; white-space:nowrap; }
.ship.now { color:var(--ok); }
.ship.van { color:var(--dim); }
.ladder { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; }
.rung { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:1rem; }
.rung h3 { margin:.1rem 0 .6rem; font-size:1rem; }
.rung .art { height:150px; display:grid; place-items:center; margin-bottom:.6rem; }
.rung .art img { max-height:150px; max-width:100%; }
.rung dl { margin:0; display:grid; grid-template-columns:auto 1fr; gap:.15rem .6rem; font-size:.83rem; }
.rung dt { color:var(--dim); }
.rung dd { margin:0; text-align:right; font-weight:600; }
.roomrow { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; align-items:end; }
.roomrow figure { margin:0; text-align:center; }
.roomrow img { max-width:100%; border:1px solid var(--line); border-radius:6px; }
.roomrow figcaption { font-size:.78rem; color:var(--dim); margin-top:.3rem; }
.styles { display:flex; flex-wrap:wrap; gap:6px; }
.styles .s { background:var(--card); border:1px solid var(--line); border-radius:6px;
  width:74px; height:64px; display:grid; place-items:center; }
.styles img { max-width:66px; max-height:56px; }
.cat td.cat { font-weight:700; padding-top:1.1rem; border-bottom:2px solid var(--ink); }
.sprite { width:54px; text-align:center; }
.sprite img { max-width:48px; max-height:52px; }
.yes { color:var(--ok); font-weight:700; }
.lock { color:var(--lock); }
.foot { color:var(--dim); font-size:.8rem; margin-top:2.4rem; max-width:70ch; }
.tag { display:inline-block; background:var(--accent); color:#1a1408; border-radius:5px;
  padding:.05rem .45rem; font-size:.72rem; font-weight:700; }
</style>''')

H.append('<div class="wrap">')
H.append('<h1>🏡 Homestead level planner</h1>')
H.append('<p class="sub">Generated straight from the live manifests (decor.js + homestead-geo.js) — '
         'what every house level owns, wears and can buy. Change the plan here first; '
         'then change the generator.</p>')

# ---- the ladder ------------------------------------------------------------
H.append('<h2>The ladder</h2><div class="ladder">')
for L in LADDER:
    t = L['tier']
    cw, ch = cells(t)
    styles = STRUCT_STYLES[str(t)]
    box = INTERIORS[str(t)]['box']
    H.append('<div class="rung"><h3>%s %s · %s</h3>' % (L['icon'], L['name'], coin(L['price'])))
    H.append('<div class="art"><img class="px" src="%s" alt=""></div>' % b64('ov-%s.png' % L['style']))
    H.append('<dl>')
    H.append('<dt>Land (deed)</dt><dd>%d × %d cells</dd>' % (cw, ch))
    H.append('<dt>Yard decor spots</dt><dd>%d</dd>' % CAPS[t])
    H.append('<dt>Room</dt><dd>%d × %d px</dd>' % (box[2], box[3]))
    H.append('<dt>Room spots</dt><dd>%d</dd>' % INCAP[t])
    H.append('<dt>Looks to wear</dt><dd>%d</dd>' % len(styles))
    H.append('</dl></div>')
H.append('</div>')

# ---- the rooms -------------------------------------------------------------
H.append('<h2>The rooms (empty shells you furnish)</h2><div class="roomrow">')
for L in LADDER:
    box = INTERIORS[str(L['tier'])]['box']
    H.append('<figure><img class="px" src="%s" alt=""><figcaption>%s %s — %d×%d, %d spots</figcaption></figure>'
             % (b64(L['room']), L['icon'], L['name'], box[2], box[3], INCAP[L['tier']]))
H.append('</div>')

# ---- the wardrobes ---------------------------------------------------------
H.append('<h2>The wardrobe — every look per rung</h2>')
for L in LADDER:
    styles = STRUCT_STYLES[str(L['tier'])]
    H.append('<p><b>%s %s</b> <span class="tag">%d looks</span> '
             '<span style="color:var(--dim);font-size:.8rem">(a higher rung keeps wearing everything below)</span></p>'
             % (L['icon'], L['name'], len(styles)))
    H.append('<div class="styles">')
    for k in styles:
        src = b64('ov-%s.png' % k, missing_ok=True)
        if src:
            H.append('<div class="s"><img class="px" src="%s" title="%s" alt="%s"></div>' % (src, k, k))
    H.append('</div>')

# ---- the decor matrix ------------------------------------------------------
H.append('<h2>Decor availability — the comparison table</h2>')
H.append('<div class="scroll"><table>')
H.append('<tr><th></th><th>Piece</th><th class="num">Price</th><th>Delivery</th>'
         '<th class="mid">⛺</th><th class="mid">🛖</th><th class="mid">🏠</th><th>Where</th></tr>')
for cat, label in CAT_META:
    rows = [d for d in ITEMS if d['cat'] == cat]
    if not rows:
        continue
    H.append('<tr class="cat"><td class="cat" colspan="8">%s · %d pieces</td></tr>' % (label, len(rows)))
    for d in sorted(rows, key=lambda x: (x['stage'], x['price'])):
        marks = ''.join(
            '<td class="mid">%s</td>' % ('<span class="yes">✓</span>' if t >= d['stage']
                                         else '<span class="lock">🔒 %s</span>' % ['', 'tent', 'cabin', 'house'][d['stage']])
            for t in (1, 2, 3))
        H.append('<tr><td class="sprite"><img class="px" src="%s" alt=""></td>'
                 '<td>%s</td><td class="num">%s</td><td>%s</td>%s<td>%s</td></tr>'
                 % ((b64('d-%s.png' % d['id'], missing_ok=True) or b64('d-%s.gif' % d['id'])), d['name'], coin(d['price']), ship(d['cat']),
                    marks, '🛋 room' if d['cat'] in INDOOR else '🌳 yard'))
H.append('</table></div>')

H.append('<p class="foot">Community pieces (forge-made, 20 %s each, instant) join the yard shelves at every '
         'level once approved at HQ. Selling returns half the price, rounded down; trophies and forge pieces '
         'are keepsakes and never sell. Deliveries: commons instant · interior 45m · lighting 30m · '
         'furniture 1h · display 4h.</p>' % ('<img class="coin" src="%s" alt="c">' % COIN))
H.append('</div>')

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SITE, 'tools', 'homestead-planner.html')
io.open(out, 'w', encoding='utf-8').write('\n'.join(H))
print('wrote %s (%d items, %d styles)' % (out, len(ITEMS), sum(len(v) for v in STRUCT_STYLES.values())))
