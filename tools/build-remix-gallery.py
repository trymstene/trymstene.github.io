# -*- coding: utf-8 -*-
"""Community remix gallery pipeline.

public/assets/dancing-banana-community-remixes/ holds ~292 community GIFs
(the authentic emoticon-era files, mostly 33x35). This script:
  1. dedupes exact duplicates (md5) — the ' (1)' Windows copies
  2. sanitises filenames in place (lowercase, dashes, no spaces/parens)
  3. auto-categorises from the names: banana / characters / food / wild
  4. writes a static first-frame thumb per GIF (public/assets/remix-thumbs/)
     so the gallery never has to animate 292 GIFs at once
  5. emits src/data/remixes.json for the gallery page

Run: python tools/build-remix-gallery.py [--write]
"""
import hashlib
import json
import os
import re
import sys
from PIL import Image

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(SITE, 'public', 'assets', 'dancing-banana-community-remixes')
THUMBS = os.path.join(SITE, 'public', 'assets', 'remix-thumbs')
DATA = os.path.join(SITE, 'src', 'data', 'remixes.json')

FOOD = {'apple', 'orange', 'mango', 'carrot', 'grape', 'jalapeno', 'pepper',
        'pickle', 'taco', 'peanut', 'tomato', 'legume', 'grapes'}
CHARACTERS = {'mario', 'luigi', 'yoshi', 'peach', 'sonic', 'pichu', 'batman',
              'homer', 'homersimpson', 'mrburns', 'nelson', 'otto', 'oswald',
              'bender', 'fry', 'brian', 'chuck', 'norris', 'master', 'chief',
              'link', 'ichigo', 'mlpony', 'game', 'watch', 'ronald', 'mcdonald',
              'radiohead', 'phelps', 'bunchie', 'bowser', 'babymario', 'goofy',
              'mickeymouse', 'palkia', 'superman', 'hornet'}


def sanitise(base):
    s = base.lower()
    s = re.sub(r'\s*\((\d+)\)\s*$', r'-\1', s)   # "name (1)" -> "name-1"
    s = re.sub(r'[_\s]+', '-', s)
    s = re.sub(r'[^a-z0-9-]', '', s)
    s = re.sub(r'-{2,}', '-', s).strip('-')
    return s


def categorise(slug):
    # substring match: the era fused words ('appledance', 'mariodance')
    if 'banana' in slug:
        return 'banana'
    if any(k in slug for k in FOOD):
        return 'food'
    if any(k in slug for k in CHARACTERS):
        return 'characters'
    return 'wild'


STOP = {'banana', 'bananadance', 'dance', 'dancing', 'pbj', 'pbjdance',
        'pbjtime', 'pbs', 'time', 'gif'}


def prettify(slug):
    words = []
    for w in slug.split('-'):
        w = re.sub(r'dance$', '', w)   # the era fused 'dance' onto names
        if w and w not in STOP and not w.isdigit():
            words.append(w)
    if not words:
        return 'The classic'
    return ' '.join(words).capitalize()


def main(write):
    files = sorted(f for f in os.listdir(SRC) if f.lower().endswith('.gif'))
    # 1. dedupe by content hash — keep the shortest (original) name
    by_hash = {}
    for f in files:
        h = hashlib.md5(open(os.path.join(SRC, f), 'rb').read()).hexdigest()
        by_hash.setdefault(h, []).append(f)
    keep, drop = [], []
    for h, group in by_hash.items():
        group.sort(key=lambda f: (len(f), f))
        keep.append(group[0])
        drop.extend(group[1:])
    print('%d files, %d unique, dropping %d duplicates' % (len(files), len(keep), len(drop)))
    for f in drop:
        print('  dup:', f)
        if write:
            os.remove(os.path.join(SRC, f))

    # 2-5. rename, categorise, thumb, collect
    if write:
        os.makedirs(THUMBS, exist_ok=True)
    items = []
    seen = set()
    for f in sorted(keep):
        slug = sanitise(os.path.splitext(f)[0])
        while slug in seen:
            slug += '-x'
        seen.add(slug)
        new_name = slug + '.gif'
        p = os.path.join(SRC, f)
        if new_name != f:
            if write:
                os.rename(p, os.path.join(SRC, new_name))
            p = os.path.join(SRC, new_name) if write else p
        im = Image.open(p)
        w, h = im.size
        frames = getattr(im, 'n_frames', 1)
        if write:
            im.seek(0)
            im.convert('RGBA').save(os.path.join(THUMBS, slug + '.png'), optimize=True)
        items.append(dict(id=slug, title=prettify(slug), cat=categorise(slug),
                          w=w, h=h, frames=frames))
    from collections import Counter
    print('categories:', Counter(i['cat'] for i in items))
    if write:
        os.makedirs(os.path.dirname(DATA), exist_ok=True)
        with open(DATA, 'w', encoding='utf-8') as fp:
            json.dump(items, fp, ensure_ascii=False, separators=(',', ':'))
        print('wrote', os.path.relpath(DATA, SITE), 'with', len(items), 'items')


if __name__ == '__main__':
    main('--write' in sys.argv)
