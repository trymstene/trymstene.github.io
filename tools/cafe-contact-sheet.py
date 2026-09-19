# -*- coding: utf-8 -*-
# ☕ THE CAFÉ FURNITURE CONTACT SHEET — for Trym's eye, before anything is baked.
#
# docs/town-cafe-plan.md §4 names four things the counter needs in the square: the rope lane, the
# A-board at its mouth, the terrace sets, and the counter itself. Modern Exteriors has NO matched
# café set — the pack-fidelity rule says use the pack or ask, never draw one (memory:
# pack-fidelity-doctrine) — so the look is a MIX, and a mix is a choice somebody has to make by
# looking. This renders every candidate at the town's own prop scale, through the town's own
# blockify, on the town's own cobbles, so what is judged is what would be baked.
#
# Run: python tools/cafe-contact-sheet.py   → test-results/cafe-sheet.png
#
# ⚠️ It writes NOTHING into public/ or src/. Nothing is baked until Trym has picked.
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from blockify import load_pack, blockify   # noqa: E402

PACK = os.path.expanduser(r'~\OneDrive\banana-art-pack\Modern_Exteriors_48x48')
SINGLES = os.path.join(PACK, 'Modern_Exteriors_Complete_Singles_48x48')
THEME = os.path.join(PACK, 'ME_Theme_Sorter_48x48')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'test-results')
PROP = 0.76        # the town's own prop scale (build-town-scene.py:49)
CELL = 190         # one cell of the sheet, in sheet pixels
COLS = 5

# The candidates, grouped the way the decision is actually made. A name is a file stem under
# Modern_Exteriors_Complete_Singles_48x48 unless it carries a theme folder prefix.
GROUPS = [
    ('THE COUNTER — something to stand BEHIND. The kiosk in the square is a solid block today.', [
        ('ME_Singles_City_Props_48x48_Kiosk_Coffee_Cup_Hollow_1', 'kiosk, HOLLOW 1'),
        ('ME_Singles_City_Props_48x48_Kiosk_Coffee_Cup_Hollow_2', 'kiosk, HOLLOW 2'),
        ('ME_Singles_Vehicles_48x48_Street_Food_Cart_1', 'street-food cart 1'),
        ('ME_Singles_Vehicles_48x48_Street_Food_Cart_3', 'street-food cart 3'),
        ('ME_Singles_Vehicles_48x48_Street_Food_Cart_5', 'street-food cart 5'),
        ('ME_Singles_Vehicles_48x48_Street_Food_Cart_2', 'street-food cart 2'),
        ('ME_Singles_Vehicles_48x48_Street_Food_Cart_4', 'street-food cart 4'),
        ('ME_Singles_Vehicles_48x48_Street_Food_Cart_6', 'street-food cart 6'),
        ('ME_Singles_City_Props_48x48_Kiosk_Coffee_Cup', 'the one standing today'),
        ('ME_Singles_City_Props_48x48_Kiosk_Coffee_Cup_Example', "the pack's own arrangement"),
    ]),
    ('THE ROPE — ⚠️ the modular posts are a TRIPLE (left, middle, right), like the fence', [
        ('ME_Singles_City_Props_48x48_Pedestrian_Barrier_Post_Modular_1_Left', 'modular 1 — left'),
        ('ME_Singles_City_Props_48x48_Pedestrian_Barrier_Post_Modular_1_Middle', 'modular 1 — middle'),
        ('ME_Singles_City_Props_48x48_Pedestrian_Barrier_Post_Modular_1_Right', 'modular 1 — right'),
        ('ME_Singles_City_Props_48x48_Pedestrian_Barrier_Post_Modular_2_Middle', 'modular 2 — middle'),
        ('ME_Singles_City_Props_48x48_Pedestrian_Barrier_Post_1', 'a single post'),
    ]),
    ('THE TERRACE — where a served banana sits and sips. It IS the score you read from the square.', [
        ('ME_Singles_Vehicles_48x48_Street_Food_Table_1', 'street-food table 1'),
        ('ME_Singles_Vehicles_48x48_Street_Food_Table_4', 'street-food table 4'),
        ('ME_Singles_Vehicles_48x48_Street_Food_Table_6', 'street-food table 6'),
        ('ME_Singles_Vehicles_48x48_Street_Food_Table_9', 'street-food table 9'),
        ('ME_Singles_Vehicles_48x48_Street_Food_Chair_1', 'street-food chair'),
        ('ME_Singles_Vehicles_48x48_Street_Food_Table_2', 'street-food table 2'),
        ('ME_Singles_Vehicles_48x48_Street_Food_Table_7', 'street-food table 7'),
        ('ME_Singles_Vehicles_48x48_Street_Food_Table_10', 'street-food table 10'),
        ('ME_Singles_Camping_48x48_Benched_Table_1', 'picnic table 1'),
        ('ME_Singles_City_Props_48x48_Bench_3', 'the square’s own bench 3'),
    ]),
    ('THE A-BOARD — at the rope’s mouth, and the thing that opens the rota', [
        ('ME_Singles_Vehicles_48x48_Street_Food_Sign_1', 'street-food sign 1'),
        ('ME_Singles_Vehicles_48x48_Street_Food_Sign_2', 'street-food sign 2'),
        ('ME_Singles_City_Props_48x48_Billboard_1', 'billboard 1 (motorway-sized)'),
        ('9_Shopping_Center_and_Markets_Singles_48x48/ME_Singles_Shopping_Center_and_Markets_48x48_Mall_Signboard_1', 'mall signboard 1'),
        ('ME_Singles_City_Props_48x48_Danger_Sign_1', 'a danger sign, for scale'),
    ]),
]


def find(name):
    """A stem, or 'theme_folder/stem'. Returns a path or None — a missing candidate is reported,
    never invented."""
    if '/' in name:
        folder, stem = name.split('/', 1)
        p = os.path.join(THEME, folder, stem + '.png')
        return p if os.path.isfile(p) else None
    p = os.path.join(SINGLES, name + '.png')
    return p if os.path.isfile(p) else None


def cobbles():
    """A tile of the town's own ground, so nothing is judged against a checkerboard."""
    town = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'assets', 'town', 'town.png')
    im = Image.open(town).convert('RGBA')
    return im.crop((1560, 1100, 1560 + CELL, 1100 + CELL))


def main():
    os.makedirs(OUT, exist_ok=True)
    ground = cobbles()
    rows = sum((len(items) + COLS - 1) // COLS for _, items in GROUPS)
    sheet = Image.new('RGBA', (COLS * CELL, rows * CELL + len(GROUPS) * 34 + 8), (20, 16, 10, 255))
    d = ImageDraw.Draw(sheet)
    y = 0
    missing = []
    for title, items in GROUPS:
        d.rectangle([0, y, sheet.width, y + 30], fill=(255, 225, 53, 255))
        d.text((8, y + 9), title, fill=(20, 16, 10, 255))
        y += 34
        for i, (name, label) in enumerate(items):
            col, row = i % COLS, i // COLS
            x0, y0 = col * CELL, y + row * CELL
            sheet.alpha_composite(ground, (x0, y0))
            p = find(name)
            if not p:
                missing.append(name)
                d.text((x0 + 8, y0 + 8), 'NOT IN THE PACK', fill=(255, 90, 90, 255))
                d.text((x0 + 8, y0 + 24), label, fill=(255, 255, 255, 255))
                continue
            src = Image.open(p).convert('RGBA')
            art = blockify(src, factor=1, colors=28, warm=0.0, sat=1.0, con=1.0)
            w = max(1, int(art.width * PROP))
            h = max(1, int(art.height * PROP))
            art = art.resize((w, h), Image.NEAREST)
            # stood on the ground line, the way place() stands a prop
            sheet.alpha_composite(art, (x0 + (CELL - w) // 2, y0 + CELL - 26 - h))
            d.rectangle([x0, y0 + CELL - 22, x0 + CELL, y0 + CELL], fill=(20, 16, 10, 235))
            d.text((x0 + 6, y0 + CELL - 17), '%s  (%d×%d)' % (label, src.width, src.height), fill=(255, 253, 245, 255))
            d.rectangle([x0, y0, x0 + CELL - 1, y0 + CELL - 1], outline=(0, 0, 0, 255))
        y += ((len(items) + COLS - 1) // COLS) * CELL
    out = os.path.join(OUT, 'cafe-sheet.png')
    sheet.convert('RGB').save(out, optimize=True)
    print('wrote %s  (%d×%d)' % (out, sheet.width, sheet.height))
    if missing:
        print('NOT IN THE PACK, and nobody draws one:')
        for m in missing:
            print('  -', m)


if __name__ == '__main__':
    main()
