# -*- coding: utf-8 -*-
"""Bake the beach LED-ad HERO backdrop for the rave club screen.

A wide club-screen banner: a darkened golden-hour beach (sea + shore + palms,
away from the busy market) with a BIG banana in shades leaning cool into the
camera on the right — the share-card energy, sized for a wide LED screen. The
left stays dark and open so the club screen's own sunset headline reads on top.

The banana is composited by REUSING build-og-cards.py's engine-exact renderer
(same anchors/accessory math as banana-engine.js), so it can never drift.

Run: python tools/build-beach-led-ad.py
"""
import importlib.util
import os
from PIL import Image, ImageEnhance, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
SRC = os.path.join(SITE, 'public', 'assets', 'beach', 'beach.png')
OUT = os.path.join(SITE, 'public', 'assets', 'beach', 'rave-ad-bg.png')

# reuse the OG card banana compositor (front pose + shades = cool into camera)
spec = importlib.util.spec_from_file_location('ogcards', os.path.join(HERE, 'build-og-cards.py'))
og = importlib.util.module_from_spec(spec)
spec.loader.exec_module(og)

W, H = 1320, 370

# ---- the beach background ----
plate = Image.open(SRC).convert('RGB')
bg = plate.crop((200, 30, 1720, 650)).resize((W, H), Image.LANCZOS)  # sea+shore+palms+court
bg = ImageEnhance.Color(bg).enhance(1.1)
bg = ImageEnhance.Brightness(bg).enhance(0.5)                        # darken so text pops
bg = Image.blend(bg, Image.new('RGB', (W, H), (58, 34, 20)), 0.16)  # warm golden haze
bg = bg.convert('RGBA')

# darken the LEFT (where the headline goes) with a horizontal gradient
shade = Image.new('L', (W, 1))
for x in range(W):
    t = x / W                       # 0 left → 1 right
    shade.putpixel((x, 0), int(150 * (1 - t) ** 1.4))  # up to ~150 alpha dark on the far left
shade = shade.resize((W, H))
bg = Image.alpha_composite(bg, Image.merge('RGBA', (
    Image.new('L', (W, H), 12), Image.new('L', (W, H), 8), Image.new('L', (W, H), 20), shade)))

# ---- a warm sun glow behind the banana (upper right) ----
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gcx, gcy, gr = 1040, 150, 300
gd.ellipse([gcx - gr, gcy - gr, gcx + gr, gcy + gr], fill=(255, 196, 110, 90))
glow = glow.filter(ImageFilter.GaussianBlur(70))
bg = Image.alpha_composite(bg, glow)

# ---- the hero banana: front pose + shades, big, leaning in ----
banana = og.render_banana(2, glasses='shades')     # RGBA 469x498, engine-exact
banana = banana.crop(banana.getbbox())
th = 430                                            # taller than the canvas → a hero crop
tw = round(banana.width * th / banana.height)
banana = banana.resize((tw, th), Image.LANCZOS)
banana = banana.rotate(7, expand=True, resample=Image.BICUBIC)  # lean cool
# anchor the FACE high and to the right; feet run off the bottom
cx, cy = 1055, 235
bg.alpha_composite(banana, (round(cx - banana.width / 2), round(cy - banana.height / 2)))

bg.convert('RGB').save(OUT, optimize=True)
print('wrote', os.path.relpath(OUT, SITE), (W, H), str(round(os.path.getsize(OUT) / 1024)) + 'KB')
