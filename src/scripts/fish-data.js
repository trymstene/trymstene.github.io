// ⚠️⚠️ GENERATED FILE — DO NOT EDIT BY HAND. ⚠️⚠️
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
// `i` indexes the atlas: 35 tiles in one row, so frame i sits at
// background-position-x: i/(n-1) × 100%  (same maths as every strip here).
export const FISH_TILES = 35;

// tier → odds + how the catch is dressed. Weight is PER SPECIES.
export const TIERS = {
  common:    { w: 100, label: 'common',    color: '#cfd8e3', stars: 1 },
  uncommon:  { w: 42, label: 'uncommon',  color: '#6ee7a0', stars: 2 },
  rare:      { w: 15, label: 'RARE',      color: '#5cc8ff', stars: 3 },
  legendary: { w: 6, label: 'LEGENDARY', color: '#ffd54a', stars: 4 },
};

export const FISH = [
  { id: 'anchovy', name: 'Anchovy', tier: 'common', cm: [8, 18], i: 0 },
  { id: 'goby', name: 'Goby', tier: 'common', cm: [5, 12], i: 1 },
  { id: 'shrimp', name: 'Shrimp', tier: 'common', cm: [3, 9], i: 2 },
  { id: 'starfish', name: 'Starfish', tier: 'common', cm: [10, 28], i: 3 },
  { id: 'flounder', name: 'Flounder', tier: 'common', cm: [25, 55], i: 4 },
  { id: 'crab_blue', name: 'Blue Crab', tier: 'common', cm: [8, 20], i: 5 },
  { id: 'jellyfish', name: 'Jellyfish', tier: 'common', cm: [12, 35], i: 6 },
  { id: 'surgeonfish', name: 'Surgeonfish', tier: 'common', cm: [15, 30], i: 7 },
  { id: 'clownfish', name: 'Clownfish', tier: 'uncommon', cm: [6, 12], i: 8 },
  { id: 'yellow_tang', name: 'Yellow Tang', tier: 'uncommon', cm: [12, 20], i: 9 },
  { id: 'purple_tang', name: 'Purple Tang', tier: 'uncommon', cm: [15, 25], i: 10 },
  { id: 'blue_angelfish', name: 'Blue Angelfish', tier: 'uncommon', cm: [20, 38], i: 11 },
  { id: 'pufferfish', name: 'Pufferfish', tier: 'uncommon', cm: [15, 40], i: 12 },
  { id: 'crab_dungeness', name: 'Dungeness Crab', tier: 'uncommon', cm: [15, 25], i: 13 },
  { id: 'seahorse', name: 'Seahorse', tier: 'uncommon', cm: [4, 15], i: 14 },
  { id: 'tuna', name: 'Tuna', tier: 'uncommon', cm: [60, 200], i: 15 },
  { id: 'blue_groper', name: 'Blue Groper', tier: 'rare', cm: [40, 90], i: 16 },
  { id: 'napoleon_wrasse', name: 'Napoleon Wrasse', tier: 'rare', cm: [60, 180], i: 17 },
  { id: 'moray_eel', name: 'Moray Eel', tier: 'rare', cm: [60, 150], i: 18 },
  { id: 'ribbon_eel', name: 'Ribbon Eel', tier: 'rare', cm: [65, 120], i: 19 },
  { id: 'stingray', name: 'Stingray', tier: 'rare', cm: [50, 160], i: 20 },
  { id: 'crab_king', name: 'King Crab', tier: 'rare', cm: [40, 90], i: 21 },
  { id: 'upside_down_jelly', name: 'Upside-Down Jellyfish', tier: 'rare', cm: [15, 30], i: 22 },
  { id: 'great_white', name: 'Great White Shark', tier: 'legendary', cm: [300, 600], i: 23 },
  { id: 'anglerfish', name: 'Anglerfish', tier: 'legendary', cm: [20, 100], i: 24 },
];

export const TREASURE = [
  { id: 'pearl', name: 'Pearl', kind: 'treasure', i: 25 },
  { id: 'coral', name: 'Coral', kind: 'treasure', i: 26 },
  { id: 'sand_dollar', name: 'Sand Dollar', kind: 'treasure', i: 27 },
  { id: 'seashell', name: 'Seashell', kind: 'treasure', i: 28 },
  { id: 'bottle', name: 'Old Bottle', kind: 'junk', i: 29 },
  { id: 'rusty_can', name: 'Rusty Can', kind: 'junk', i: 30 },
  { id: 'apple_core', name: 'Apple Core', kind: 'junk', i: 31 },
  { id: 'seaweed', name: 'Seaweed', kind: 'junk', i: 32 },
  { id: 'worm', name: 'Soggy Worm', kind: 'junk', i: 33 },
  { id: 'lure', name: 'Lost Lure', kind: 'junk', i: 34 },
];
