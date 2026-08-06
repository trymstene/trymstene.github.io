# -*- coding: utf-8 -*-
"""🌍 BANANA WORLD TOUR THUMBS — the tutorial wizard's postcards.

Crops each area's REAL plate (park/beach/homestead) plus a checked-in rave
screenshot (tools/tour-src/rave-shot.png — the rave is DOM, it has no plate)
into small JPG postcards the wizard shows. Showing is telling (Trym): these
are the world as it actually renders, not illustrations.

Run after any plate regeneration that changes an area's look.
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
OUT = os.path.join(SITE, 'public', 'assets', 'world')
os.makedirs(OUT, exist_ok=True)

TW, TH = 420, 264   # the postcard: wide-ish, small enough to load in a blink


def postcard(img, box, name):
    c = img.crop(box).convert('RGB')
    c = c.resize((TW, TH), Image.LANCZOS)
    c.save(os.path.join(OUT, name), quality=82, optimize=True)
    print('  %s %dx%d' % (name, TW, TH))


# 🌳 the park — the plaza, the fountain, the garden edge
park = Image.open(os.path.join(SITE, 'public', 'assets', 'park', 'park.png'))
postcard(park, (980, 300, 1980, 930), 'tour-park.jpg')

# 🏖 banana bay — surf, sand, the bar end
beach = Image.open(os.path.join(SITE, 'public', 'assets', 'beach', 'beach.png'))
postcard(beach, (520, 180, 1520, 810), 'tour-beach.jpg')

# 🪩 the rave — the checked-in screenshot (LED + floor + Barty's bar)
rave = Image.open(os.path.join(HERE, 'tour-src', 'rave-shot.png'))
postcard(rave, (260, 190, 1260, 820), 'tour-rave.jpg')

# 🏡 the homestead — the plate with a tent, sign and mailbox composited on
# (the plate ships bare; the wizard's postcard shows a HOME, not a lawn)
hs_dir = os.path.join(SITE, 'public', 'assets', 'homestead')
home = Image.open(os.path.join(hs_dir, 'homestead.png')).convert('RGBA')
tent = Image.open(os.path.join(hs_dir, 'ov-tent1.png')).convert('RGBA')
sign = Image.open(os.path.join(hs_dir, 'm-psign1.png')).convert('RGBA')
mail = Image.open(os.path.join(hs_dir, 'm-mail.png')).convert('RGBA')
home.alpha_composite(tent, (1056 - tent.width // 2, 576 - tent.height))
home.alpha_composite(sign, (1010 - sign.width // 2, 850 - sign.height))
home.alpha_composite(mail, (1252 - mail.width // 2, 850 - mail.height))
postcard(home, (700, 300, 1700, 930), 'tour-home.jpg')

print('world tour postcards done')
