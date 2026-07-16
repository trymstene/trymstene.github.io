# -*- coding: utf-8 -*-
"""THE BANANA GALLERY pipeline — scan, classify, merge, posterize.

Reads public/assets/gallery-bananas/*.gif and maintains src/data/gallery.json.
NON-DESTRUCTIVE: existing entries keep every hand-curated field (title,
caption, description, tags, added); only measured facts (w, h, frames, kind,
file, kb) are refreshed. New files get sane defaults derived from the
filename and land at the END of the list flagged "curate": true so they're
easy to find and write up.

Classification (Trym's rule, the Giphy/Tenor split):
  transparent background -> STICKER   ·   solid background -> GIF

Also writes a static first-frame poster PNG per item to
public/assets/gallery-posters/<id>.png (og:image + fast grid placeholders),
and with --sheet a labeled contact sheet to the scratchpad for review.

Run: python tools/build-gallery.py [--sheet]
"""
import json, os, re, sys, datetime

from PIL import Image, ImageDraw

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(SITE, 'public', 'assets', 'gallery-bananas')
POSTER_DIR = os.path.join(SITE, 'public', 'assets', 'gallery-posters')
OUT = os.path.join(SITE, 'src', 'data', 'gallery.json')

# slugs reserved by the gallery's own routes — an item may never claim these.
# Tag slugs are reserved too (a 'monday' ITEM once silently lost its page to
# the 'monday' TAG page): parsed live from gallery-tags.js so the lists can't
# drift. Rename the source FILE on collision (the id derives from it).
RESERVED = {'stickers', 'gifs', 'tags', 'submit', 'search'}


def reserved_tags():
    path = os.path.join(SITE, 'src', 'data', 'gallery-tags.js')
    with open(path, encoding='utf-8') as f:
        src = f.read()
    return set(re.findall(r'^\s{2}([a-z0-9-]+):\s*\{', src, re.M))


def item_id(fname):
    s = re.sub(r'\.gif$', '', fname)
    s = re.sub(r'-trymstene\.com$', '', s)
    s = re.sub(r'^dancing-banana-', '', s)
    s = re.sub(r'^meme-', '', s)
    return s


def classify(im):
    """sticker if the first frame actually renders transparent pixels."""
    frame = im.convert('RGBA')
    alpha = frame.getchannel('A')
    lo, hi = alpha.getextrema()
    return 'sticker' if lo == 0 else 'gif'


def measure(path):
    with Image.open(path) as im:
        w, h = im.size
        frames = getattr(im, 'n_frames', 1)
        kind = classify(im)
        poster = im.convert('RGBA').copy()
    return w, h, frames, kind, poster


def main():
    files = sorted(f for f in os.listdir(SRC_DIR) if f.endswith('.gif'))
    if not files:
        sys.exit('no gifs in ' + SRC_DIR)
    reserved = RESERVED | reserved_tags()

    old = []
    if os.path.exists(OUT):
        with open(OUT, encoding='utf-8') as f:
            old = json.load(f)
    by_id = {e['id']: e for e in old}

    os.makedirs(POSTER_DIR, exist_ok=True)
    today = datetime.date.today().isoformat()
    items, posters = [], {}

    for fname in files:
        iid = item_id(fname)
        if iid in reserved:
            sys.exit('item id collides with a reserved route (rename the file): ' + iid)
        w, h, frames, kind, poster = measure(os.path.join(SRC_DIR, fname))
        kb = round(os.path.getsize(os.path.join(SRC_DIR, fname)) / 1024)
        posters[iid] = poster
        poster.save(os.path.join(POSTER_DIR, iid + '.png'))

        e = by_id.get(iid, {
            'id': iid,
            'title': iid.replace('-', ' ').title(),
            'caption': '',
            'description': '',
            'tags': [],
            'added': today,
            'curate': True,
        })
        # measured facts always refresh; curated words never touched
        e.update({'file': fname, 'w': w, 'h': h, 'frames': frames,
                  'kind': kind, 'kb': kb})
        items.append(e)

    # keep curated order for existing ids (old list order), new ones appended
    order = {e['id']: i for i, e in enumerate(old)}
    items.sort(key=lambda e: (order.get(e['id'], 9999), e['id']))

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(items, f, indent=2, ensure_ascii=False)
        f.write('\n')

    n_new = sum(1 for e in items if e.get('curate'))
    print(f"{len(items)} items -> gallery.json  ({n_new} awaiting curation)")
    for e in items:
        flag = ' *NEW*' if e.get('curate') else ''
        print(f"  {e['kind']:7s} {e['w']}x{e['h']} f{e['frames']:<3} {e['id']}{flag}")

    if '--sheet' in sys.argv:
        cols, cell, cap = 5, 220, 34
        rows = (len(items) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * cell, rows * (cell + cap)), (34, 30, 44))
        d = ImageDraw.Draw(sheet)
        for i, e in enumerate(items):
            p = posters[e['id']].copy()
            p.thumbnail((cell - 16, cell - 16), Image.NEAREST)
            x, y = (i % cols) * cell, (i // cols) * (cell + cap)
            # checkerboard behind stickers so transparency is visible
            if e['kind'] == 'sticker':
                for cy in range(0, cell, 20):
                    for cx in range(0, cell, 20):
                        if (cx // 20 + cy // 20) % 2 == 0:
                            d.rectangle([x + cx, y + cy, x + cx + 19, y + cy + 19],
                                        fill=(48, 44, 60))
            sheet.paste(p, (x + (cell - p.width) // 2, y + (cell - p.height) // 2), p)
            d.text((x + 8, y + cell + 6), f"{e['id']} [{e['kind']}]", fill=(255, 225, 53))
        out = os.path.join(os.environ.get('SHEET_DIR', SITE), 'gallery-contact-sheet.png')
        sheet.save(out)
        print('contact sheet ->', out)


if __name__ == '__main__':
    main()
