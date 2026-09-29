# -*- coding: utf-8 -*-
"""🏆 CITIZENS OF THE WEEK — the front page's frames (6 Sep 2026).

Reads the public board (worker-pass /citizen), renders each winner's banana
with the engine's Python mirror (tools/banana_render.py) and hangs it in a
picture frame: cream paper with a grain, a wooden frame — the
employee-of-the-week frame, not a polaroid, not the supporters' plaques
(Trym, 6 Sep).

🏅 29 Sep 2026, Trym: "the tiny name-badge-signs are a bit small and tight … it
doesnt look like their wearables are showing in the pictures of them … they are
all clean bananas". Two fixes here:
  · the BRASS PLATE is no longer baked in. Its 15-px title read at 6 px on a
    197-px frame; the front page lays a real-text plate on the frame's bottom
    rail (src/styles/citizen-plate.css, the park's card wears the same one), so
    the portrait window stops above where it sits.
  · the WHOLE OUTFIT: the site stores extras as {id: on/off}, so a switched-off
    wool scarf still reached the renderer, which had no knitwear art and threw —
    and the bake fell back to a bare banana for all but one winner. The mirror
    now reads every art pack the engine does, draws only what is on, leaves a
    piece it cannot draw off rather than the whole outfit (lenient), shows
    member hats (a weekly frame is not print), and hangs the winner's own
    catalog items on it (the look's `c`, through wear-render.js, as the site does).
Writes:

    public/assets/citizen/<plaque>.webp   citizen, gardener, neighbour, farmer, raver
    src/data/citizen.json                 { week, winners, unkept, live, at }

Runs in the deploy workflow before the build (daily + on push) and by hand.
Fail-soft: an unreachable board keeps the committed json and pictures.

    python tools/build-citizen-cards.py
"""
import io
import json
import os
import random
import subprocess
import sys
import urllib.request

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
os.environ.setdefault('BANANA_RENDER_MEMBER', '1')   # a member's hat is on their banana in the world; a weekly frame shows it
API = 'https://banana-pass.trymstene.workers.dev/citizen'
CATALOG = 'https://banana-share.trymstene.workers.dev/catalog/items.json'
OUT_DIR = os.path.join(ROOT, 'public', 'assets', 'citizen')
DATA = os.path.join(ROOT, 'src', 'data', 'citizen.json')
PLAQUES = ['citizen', 'gardener', 'neighbour', 'farmer', 'raver']
TITLES = {'citizen': 'Citizen of the week', 'gardener': 'Gardener', 'neighbour': 'Neighbour',
          'farmer': 'Farmer', 'raver': 'Raver'}
S = 480                                  # the frame's outer size
WOOD, WOOD2, PAPER, INK, BRASS = (94, 58, 30, 255), (150, 98, 52, 255), (245, 236, 214, 255), (17, 17, 17, 255), (201, 162, 39, 255)


def font(px):
    try: return ImageFont.truetype(os.path.join(HERE, 'ArchivoBlack.ttf'), px)
    except Exception: return ImageFont.load_default()


def paper(w, h, seed=3):
    im = Image.new('RGBA', (w, h), PAPER)
    d = ImageDraw.Draw(im)
    rnd = random.Random(seed)
    for _ in range(w * h // 18):                      # the grain: sparse, faint, warm
        x, y = rnd.randrange(w), rnd.randrange(h)
        d.point((x, y), fill=(210, 196, 166, 255) if rnd.random() < 0.7 else (255, 250, 238, 255))
    return im


def frame(banana, name, title):
    """the banana's head and shoulders on paper, in a wooden frame, a brass plate below"""
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # the shadow the frame throws on the wall
    d.rectangle([14, 16, S - 4, S - 2], fill=(0, 0, 0, 70))
    d.rectangle([0, 0, S - 18, S - 18], fill=WOOD)
    d.rectangle([12, 12, S - 30, S - 30], outline=WOOD2, width=4)
    inner = (28, 28, S - 46, S - 46)
    pg = paper(inner[2] - inner[0], inner[3] - inner[1])
    im.alpha_composite(pg, (inner[0], inner[1]))
    d.rectangle(inner, outline=(120, 96, 60, 255), width=2)
    # the page's plate covers the paper's bottom ~22 % (and the rail under it): the portrait lives in the window above
    pw, ph = inner[2] - inner[0], inner[3] - inner[1]
    wh = ph - 92
    if banana is not None:
        # the top of the banana, hat to hips, as big as the window lets it be — and never wider than the paper, so what the
        # winner holds out (a balloon dog, the plush) is in the picture instead of cut by the frame
        k = min((pw * 0.94) / banana.width, (wh - 10) / (banana.height * 0.64))
        b = banana.resize((max(1, int(banana.width * k)), max(1, int(banana.height * k))), Image.NEAREST)
        win = Image.new('RGBA', (pw, wh), (0, 0, 0, 0))
        win.alpha_composite(b, ((pw - b.width) // 2, 10))
        im.alpha_composite(win, (inner[0], inner[1]))
    else:
        f = font(34)
        msg = 'your banana here?'
        d.text((inner[0] + pw / 2 - f.getlength(msg) / 2, inner[1] + wh / 2 - 20), msg, font=f, fill=(150, 130, 100, 255))
    return im


def customs(looks):
    """The winners' own catalog items as the engine's `custom` payloads, {id: payload}. Converted by wear-render.js
    wearToCustom in node — the art and its placement are the site's own. Homestead decor is never worn (the site's
    catCustom skips it too). Fail-soft: no catalog, no community items, and the rest of the outfit still shows."""
    ids = sorted({t.strip() for lk in looks for t in str((lk or {}).get('c') or '').split(',') if t.strip()})
    if not ids:
        return {}
    try:
        with urllib.request.urlopen(urllib.request.Request(CATALOG, headers={'User-Agent': 'Mozilla/5.0 (banana-citizen-bake)', 'Origin': 'https://trymstene.com'}), timeout=20) as r:
            items = json.loads(r.read().decode('utf-8'))
    except Exception as e:
        print('  catalog unreachable, no community items:', e)
        return {}
    wears = {it['id']: it['wear'] for it in items if isinstance(it, dict) and it.get('id') in ids
             and it.get('kind') != 'decor' and it.get('wear')}
    if not wears:
        return {}
    js = ("import { wearToCustom } from './src/lib/wear-render.js';"
          "let s = ''; process.stdin.on('data', (d) => { s += d; }).on('end', () => {"
          " const w = JSON.parse(s), out = {};"
          " for (const id in w) { const c = wearToCustom(w[id]); if (c) out[id] = c; }"
          " process.stdout.write(JSON.stringify(out)); });")
    try:
        r = subprocess.run(['node', '--input-type=module', '-e', js], cwd=ROOT, input=json.dumps(wears),
                           capture_output=True, text=True, check=True, timeout=60)
        return json.loads(r.stdout)
    except Exception as e:
        print('  community items did not convert:', e)
        return {}


def render(look, cmap=None):
    try:
        import banana_render
        lk = look or {}
        o = {'hat': lk.get('hat', 'none'), 'glasses': lk.get('glasses', 'none'), 'extras': lk.get('extras') or {},
             'custom': [cmap[t.strip()] for t in str(lk.get('c') or '').split(',') if t.strip() in (cmap or {})]}
        im = banana_render.render(2, o, scale=8, lenient=True)        # hands up: the ta-da frame
        return im.crop(im.getbbox())
    except Exception as e:
        print('  render failed for', look, e)
        try:
            import banana_render
            im = banana_render.render(2, {}, scale=8)
            return im.crop(im.getbbox())
        except Exception:
            return None


def main():
    try:
        with urllib.request.urlopen(urllib.request.Request(API, headers={'User-Agent': 'Mozilla/5.0 (banana-citizen-bake)', 'Origin': 'https://trymstene.com'}), timeout=20) as r:
            board = json.loads(r.read().decode('utf-8'))
    except Exception as e:
        print('board unreachable, keeping what is committed:', e)
        return 0
    last = board.get('last') or {}
    live = board.get('live') or {}
    winners = last.get('winners') or {}
    os.makedirs(OUT_DIR, exist_ok=True)
    out = {'week': last.get('week'), 'at': last.get('at'), 'winners': {}, 'unkept': last.get('unkept') or {},
           'live': {'week': live.get('week'), 'ends': live.get('to'),
                    'plaques': {p: [x.get('name') for x in (live.get('plaques') or {}).get(p, [])] for p in PLAQUES if p != 'citizen'},
                    'citizen': [x.get('name') for x in live.get('citizen') or []]}}
    cmap = customs([w.get('look') for w in winners.values() if w])
    for p in PLAQUES:
        w = winners.get(p)
        banana = render(w.get('look'), cmap) if w else None
        fr = frame(banana, w.get('name') if w else '', TITLES[p])
        fr.convert('RGBA').save(os.path.join(OUT_DIR, p + '.webp'), 'WEBP', quality=90, method=6)
        if w:
            out['winners'][p] = {'name': w.get('name'), 'score': w.get('score')}
    io.open(DATA, 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
    print('citizens: week %s, %d plaques awarded, live leaders %s' % (out['week'], len(out['winners']), out['live']['citizen'][:3]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
