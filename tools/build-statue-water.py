# -*- coding: utf-8 -*-
"""⛲ THE STATUE'S WATER — public/assets/town/a-statuewater.png (27 Sep 2026).

The statue on the town's monument lawn is the park's fountain statue, grey and dry (Trym: "its the same statue as
the park, but it has no running water, its like it stopped working in the town - while its running and works in the
park"). Chapter two lets it run for one player on one night (world-quest.js nightFx), so this lifts the WATER out of
the pack's own running fountain and lays it over the town's dry statue, pixel for pixel:

  · the pack's Garden_Fountain_3 is the same statue, running: six frames of 144 x 288
  · its Turn_Off sheet's last frame is the same statue, dry — so what differs between the two is the water
  · the town's statue is the pack's Grey_Statue single, the same drawing 3 px higher in its cell, run through
    blockify (trimmed to its box, a 1 px outline around it) and scaled by 0.76 (tools/build-town-scene.py PROP),
    which is how ov-51.png comes out 110 x 206 — so the water goes through the same crop, border and scale

Out: one strip of six 110 x 206 frames, played by CSS (.bwq-water). Pack art only; nothing here is drawn by hand.
Run: python tools/build-statue-water.py   (writes the strip, and a preview to LOOK at in the system temp folder)
"""
import os
import tempfile
from PIL import Image, ImageChops

PACK = os.path.expanduser(r'~\OneDrive\banana-art-pack\Modern_Exteriors_48x48')
ANIM = os.path.join(PACK, 'Animated_48x48', 'Animated_sheets_48x48')
GREY = os.path.join(PACK, 'ME_Theme_Sorter_48x48', '17_Garden_Singles_48x48', 'ME_Singles_Garden_48x48_Grey_Statue.png')
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'public', 'assets', 'town', 'a-statuewater.png')
PROP = 0.76
FW, FH = 144, 288

on = Image.open(os.path.join(ANIM, 'Garden_Fountain_3_48x48.png')).convert('RGBA')
off = Image.open(os.path.join(ANIM, 'Garden_Fountain_3_Turn_Off_48x48.png')).convert('RGBA')
grey = Image.open(GREY).convert('RGBA')
dry = off.crop(((off.width // FW - 1) * FW, 0, off.width // FW * FW, FH))   # the turn-off's last frame: dry

# ⚠️ the same drawing, placed differently in its cell: find the shift rather than trust a number
gb, db = grey.getbbox(), dry.getbbox()
dy = db[1] - gb[1]
assert db[0] == gb[0] and db[2] == gb[2] and (db[3] - db[1]) == (gb[3] - gb[1]), (gb, db)

frames = []
for i in range(on.width // FW):
    fr = on.crop((i * FW, 0, (i + 1) * FW, FH))
    diff = ImageChops.difference(fr, dry).convert('L').point(lambda v: 255 if v > 24 else 0)
    water = Image.new('RGBA', fr.size, (0, 0, 0, 0))
    water.paste(fr, (0, 0), diff)
    # into the grey statue's own box: its trim, then blockify's 1 px border, then the town's scale
    box = water.crop((db[0], db[1], db[2], db[3]))
    pad = Image.new('RGBA', (box.width + 2, box.height + 2), (0, 0, 0, 0))
    pad.paste(box, (1, 1))
    frames.append(pad.resize((int(pad.width * PROP), int(pad.height * PROP)), Image.NEAREST))

w, h = frames[0].size
strip = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
for i, f in enumerate(frames):
    strip.paste(f, (i * w, 0))
strip.save(OUT, optimize=True)
print('a-statuewater.png', strip.size, 'frames', len(frames), 'shift', dy)

# 🔍 the proof: the town's own overlay with the first frame on it, blown up, to LOOK at
ov = Image.open(os.path.join(ROOT, 'public', 'assets', 'town', 'ov-51.png')).convert('RGBA')
assert ov.size == (w, h), ('the town statue is ' + str(ov.size) + ', the water ' + str((w, h)))
prev = Image.new('RGBA', (w * 3 + 20, h), (58, 58, 72, 255))
prev.alpha_composite(ov, (0, 0))
lit = ov.copy()
lit.alpha_composite(frames[0])
prev.alpha_composite(lit, (w + 10, 0))
lit2 = ov.copy()
lit2.alpha_composite(frames[3])
prev.alpha_composite(lit2, (2 * w + 20, 0))
shot = os.path.join(tempfile.gettempdir(), 'statue-water-preview.png')
prev.resize((prev.width * 3, prev.height * 3), Image.NEAREST).save(shot)
print('preview', shot)
