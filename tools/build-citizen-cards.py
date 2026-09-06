# -*- coding: utf-8 -*-
"""🏆 CITIZENS OF THE WEEK — the front page's frames (6 Sep 2026).

Reads the public board (worker-pass /citizen), renders each winner's banana
with the engine's Python mirror (tools/banana_render.py) and hangs it in a
picture frame: cream paper with a grain, a wooden frame, a brass plate with
the name — the employee-of-the-week frame, not a polaroid, not the supporters'
plaques (Trym, 6 Sep). Writes:

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
import sys
import urllib.request

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
API = 'https://banana-pass.trymstene.workers.dev/citizen'
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
    if banana is not None:
        # close-up: the head and shoulders fill the paper — scale so the banana is
        # 1.35x the paper's height, then show the top 68 % of it
        pw, ph = inner[2] - inner[0], inner[3] - inner[1]
        k = (ph * 1.35) / banana.height
        b = banana.resize((max(1, int(banana.width * k)), max(1, int(banana.height * k))), Image.NEAREST)
        win = Image.new('RGBA', (pw, ph - 64), (0, 0, 0, 0))
        win.alpha_composite(b, ((pw - b.width) // 2, 6))
        im.alpha_composite(win, (inner[0], inner[1]))
    else:
        f = font(26)
        msg = 'your banana here?'
        d.text(((S - 18) / 2 - f.getlength(msg) / 2, S / 2 - 40), msg, font=f, fill=(150, 130, 100, 255))
    # the brass plate: the title small, the name big
    px, py = inner[0] + 26, inner[3] - 62
    d.rounded_rectangle([px, py, inner[2] - 26, inner[3] - 14], radius=6, fill=BRASS, outline=(120, 92, 20, 255), width=3)
    f1, f2 = font(15), font(26)
    d.text((px + 14, py + 5), title.upper(), font=f1, fill=(70, 50, 10, 255))
    nm = (name or '—')[:22]
    d.text((px + 14, py + 21), nm, font=f2, fill=INK)
    return im


def render(look):
    try:
        import banana_render
        o = {'hat': (look or {}).get('hat', 'none'), 'glasses': (look or {}).get('glasses', 'none'), 'extras': (look or {}).get('extras') or {}}
        im = banana_render.render(2, o, scale=8)        # hands up: the ta-da frame
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
    for p in PLAQUES:
        w = winners.get(p)
        banana = render(w.get('look')) if w else None
        fr = frame(banana, w.get('name') if w else '', TITLES[p])
        fr.convert('RGBA').save(os.path.join(OUT_DIR, p + '.webp'), 'WEBP', quality=90, method=6)
        if w:
            out['winners'][p] = {'name': w.get('name'), 'score': w.get('score')}
    io.open(DATA, 'w', encoding='utf-8', newline='\n').write(json.dumps(out, ensure_ascii=False, indent=1) + '\n')
    print('citizens: week %s, %d plaques awarded, live leaders %s' % (out['week'], len(out['winners']), out['live']['citizen'][:3]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
