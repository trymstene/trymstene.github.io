"""🐟 THE FISH ATLAS — bakes the Pixel Gnome Fishing Pack into ONE game asset.

⚠️ LICENCE, READ FIRST. The pack is PURCHASED and its terms say: "You cannot
resell, repackage, or redistribute the asset, even if modified." This repo is
public and deploys straight to the live site, so the raw pack is gitignored and
must never be committed. What ships is public/assets/beach/fish.png — a derived
atlas holding ONLY the species this game actually uses, which is ordinary game
usage, not redistribution. Same doctrine as the pixelarticons Pro pack.

🌍 BIOME SPLIT (Trym's call): the pack ships SALT WATER, FRESH WATER and MISC.
Banana Bay is tropical, so ONLY Salt Water + Misc are baked here. The 15 FRESH
WATER species (Bass, Carp, Catfish, Trout, Salmon, Perch, Bluegill, Goldfish,
Guppy, Arowana, Neon Tetra, Tadpole, Mussel, Angelfish, Silverjaw Minnow) are
deliberately LEFT OUT and reserved for the future forest/farm world — the same
loop can be re-pointed at them by adding a second atlas.

Run:  python tools/build-fish-atlas.py
"""
import os
from PIL import Image

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(SITE, 'public', 'assets', 'Pixel Gnome Fishing Pack',
                    'Pixel Gnome Fishing Pack')
OUT = os.path.join(SITE, 'public', 'assets', 'beach')
T = 16

# ---- 🎣 THE CATCH TABLE ----------------------------------------------------
# tier drives BOTH the odds and how the catch is presented. Weights are per
# SPECIES, so a tier's real share is weight × how many species sit in it:
#   common 8×100=800 (64%) · uncommon 8×42=336 (27%) · rare 7×13=91 (7%)
#   · legendary 2×4=8 (0.6%, ~1 in 155 casts)
# That is the classic collector curve: the first half of the ledger fills fast
# and cheap, the tail is a genuine chase — which is the part that hooks.
# cm = [min, max] length. Every catch rolls a size inside it and the ledger
# keeps your PERSONAL BEST, so a species you already own is still worth casting
# for. A second collectible axis costs almost nothing and doubles the pull.
FISH = [
    # id,                    display,                tier,        cm
    ('anchovy',              'Anchovy',              'common',    (8, 18)),
    ('goby',                 'Goby',                 'common',    (5, 12)),
    ('shrimp',               'Shrimp',               'common',    (3, 9)),
    ('starfish',             'Starfish',             'common',    (10, 28)),
    ('flounder',             'Flounder',             'common',    (25, 55)),
    ('crab_blue',            'Blue Crab',            'common',    (8, 20)),
    ('jellyfish',            'Jellyfish',            'common',    (12, 35)),
    ('surgeonfish',          'Surgeonfish',          'common',    (15, 30)),

    ('clownfish',            'Clownfish',            'uncommon',  (6, 12)),
    ('yellow_tang',          'Yellow Tang',          'uncommon',  (12, 20)),
    ('purple_tang',          'Purple Tang',          'uncommon',  (15, 25)),
    ('blue_angelfish',       'Blue Angelfish',       'uncommon',  (20, 38)),
    ('pufferfish',           'Pufferfish',           'uncommon',  (15, 40)),
    ('crab_dungeness',       'Dungeness Crab',       'uncommon',  (15, 25)),
    ('seahorse',             'Seahorse',             'uncommon',  (4, 15)),
    ('tuna',                 'Tuna',                 'uncommon',  (60, 200)),

    ('blue_groper',          'Blue Groper',          'rare',      (40, 90)),
    ('napoleon_wrasse',      'Napoleon Wrasse',      'rare',      (60, 180)),
    ('moray_eel',            'Moray Eel',            'rare',      (60, 150)),
    ('ribbon_eel',           'Ribbon Eel',           'rare',      (65, 120)),
    ('stingray',             'Stingray',             'rare',      (50, 160)),
    ('crab_king',            'King Crab',            'rare',      (40, 90)),
    ('upside_down_jelly',    'Upside-Down Jellyfish', 'rare',     (15, 30)),

    ('great_white',          'Great White Shark',    'legendary', (300, 600)),
    ('anglerfish',           'Anglerfish',           'legendary', (20, 100)),
]

# the pack filename each id maps to, inside Salt Water/
FISH_FILE = {
    'anchovy': 'Anchovy', 'goby': 'Goby', 'shrimp': 'Shrimp', 'starfish': 'Starfish',
    'flounder': 'Flounder', 'crab_blue': 'Crab - Blue', 'jellyfish': 'Jellyfish',
    'surgeonfish': 'Surgeonfish', 'clownfish': 'Clownfish', 'yellow_tang': 'Yellow Tang',
    'purple_tang': 'Purple Tang', 'blue_angelfish': 'Blue Angelfish',
    'pufferfish': 'Pufferfish', 'crab_dungeness': 'Crab - Dungeness',
    'seahorse': 'Seahorse', 'tuna': 'Tuna', 'blue_groper': 'Blue Groper',
    'napoleon_wrasse': 'Napoleon Wrasse', 'moray_eel': 'Moray Eel',
    'ribbon_eel': 'Ribbon Eel', 'stingray': 'Stingray', 'crab_king': 'Crab - King',
    'upside_down_jelly': 'Upside Down Jellyfish', 'great_white': 'Great White Shark',
    'anglerfish': 'Anglerfish',
}

# ---- 🪸 NOT-FISH: treasure pays, junk is the joke --------------------------
# A dead cast that gives NOTHING is punishing; a dead cast that gives a laugh is
# texture. So junk always says something funny and costs the player nothing.
TREASURE = [
    ('pearl',       'Pearl',       'treasure', 'Pearl'),
    ('coral',       'Coral',       'treasure', 'Coral'),
    ('sand_dollar', 'Sand Dollar', 'treasure', 'Sand Dollar'),
    ('seashell',    'Seashell',    'treasure', 'Seashell'),
    ('bottle',      'Old Bottle',  'junk',     'Bottle'),
    ('rusty_can',   'Rusty Can',   'junk',     'Rusty Can'),
    ('apple_core',  'Apple Core',  'junk',     'Apple Core'),
    ('seaweed',     'Seaweed',     'junk',     'Seaweed'),
    ('worm',        'Soggy Worm',  'junk',     'Worm'),
    ('lure',        'Lost Lure',   'junk',     'Lure'),
]

# ⚠️ tuned for a WEB session, not a 100-hour farming sim: a legendary has to be
# reachable inside one dedicated sitting or it stops being a chase and starts
# being a wall. These land ~1-in-104 casts for *a* legendary. banana-beach.js
# adds bad-luck protection on top (see FISH_PITY) so dry streaks self-correct.
WEIGHT = {'common': 100, 'uncommon': 42, 'rare': 15, 'legendary': 6}


def load(folder, name):
    p = os.path.join(PACK, folder, name + '.png')
    if not os.path.isfile(p):
        raise SystemExit('MISSING sprite: %s' % p)
    return Image.open(p).convert('RGBA')


def main():
    if not os.path.isdir(PACK):
        raise SystemExit('Pack not found at %s\n(it is gitignored — keep it local)' % PACK)
    tiles = [load('Salt Water', FISH_FILE[f[0]]) for f in FISH]
    tiles += [load('Misc', t[3]) for t in TREASURE]
    n = len(tiles)
    atlas = Image.new('RGBA', (T * n, T), (0, 0, 0, 0))
    for i, im in enumerate(tiles):
        if im.size != (T, T):
            im = im.resize((T, T), Image.NEAREST)
        atlas.alpha_composite(im, (i * T, 0))
    atlas.save(os.path.join(OUT, 'fish.png'), optimize=True)
    print('wrote fish.png  %d tiles (%d fish + %d misc)  %dx%d'
          % (n, len(FISH), len(TREASURE), atlas.width, atlas.height))

    rows = []
    for i, (fid, disp, tier, cm) in enumerate(FISH):
        rows.append("  { id: '%s', name: '%s', tier: '%s', cm: [%d, %d], i: %d },"
                    % (fid, disp, tier, cm[0], cm[1], i))
    trows = []
    for j, (tid, disp, kind, _f) in enumerate(TREASURE):
        trows.append("  { id: '%s', name: '%s', kind: '%s', i: %d },"
                     % (tid, disp, kind, len(FISH) + j))

    js = '''// ⚠️⚠️ GENERATED FILE — DO NOT EDIT BY HAND. ⚠️⚠️
// Written by tools/build-fish-atlas.py. Re-run it after changing the table:
//     python tools/build-fish-atlas.py
//
// The art is the PURCHASED Pixel Gnome Fishing Pack, baked down to
// public/assets/beach/fish.png — only the species we use. The raw pack is
// gitignored (its licence forbids redistributing it, even modified).
//
// 🌍 Banana Bay is TROPICAL, so this is the pack's SALT WATER set. The 15 FRESH
// WATER species are deliberately held back for the future forest/farm world.
//
// `i` indexes the atlas: %d tiles in one row, so frame i sits at
// background-position-x: i/(n-1) × 100%%  (same maths as every strip here).
export const FISH_TILES = %d;

// tier → odds + how the catch is dressed. Weight is PER SPECIES.
export const TIERS = {
  common:    { w: %d, label: 'common',    color: '#cfd8e3', stars: 1 },
  uncommon:  { w: %d, label: 'uncommon',  color: '#6ee7a0', stars: 2 },
  rare:      { w: %d, label: 'RARE',      color: '#5cc8ff', stars: 3 },
  legendary: { w: %d, label: 'LEGENDARY', color: '#ffd54a', stars: 4 },
};

export const FISH = [
%s
];

export const TREASURE = [
%s
];
''' % (n, n, WEIGHT['common'], WEIGHT['uncommon'], WEIGHT['rare'],
       WEIGHT['legendary'], '\n'.join(rows), '\n'.join(trows))
    p = os.path.join(SITE, 'src', 'scripts', 'fish-data.js')
    with open(p, 'w', encoding='utf-8') as f:
        f.write(js)
    print('wrote src/scripts/fish-data.js')

    tot = sum(WEIGHT[f[2]] for f in FISH)
    for t in ('common', 'uncommon', 'rare', 'legendary'):
        k = [f for f in FISH if f[2] == t]
        share = 100.0 * len(k) * WEIGHT[t] / tot
        print('  %-10s %2d species  %5.1f%% of fish catches  (1 in %.0f per species)'
              % (t, len(k), share, tot / float(WEIGHT[t])))


if __name__ == '__main__':
    main()
