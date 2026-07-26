// ⚠️⚠️ GENERATED FILE — DO NOT EDIT BY HAND. ⚠️⚠️
// Written by tools/build-shell-atlas.py. Re-run after changing the table:
//     python tools/build-shell-atlas.py
//
// Art = the PURCHASED ShoreThings pack, baked to public/assets/beach/shells.png
// (only the species we use). The raw pack is gitignored — its licence forbids
// redistributing it "as is OR transformed".
//
// `i` indexes the atlas: 24 tiles in one row, so tile i sits at
// background-position-x: i/(n-1) x 100%.
export const SHELL_TILES = 24;

// tier -> odds + dressing. Shells wash up CONTINUOUSLY and each pays world XP;
// the tail is STEEP (a ~month-long set) so the grails stay grails.
export const SHELL_TIERS = {
  common:    { w: 240, label: 'common',    color: '#cfd8e3', stars: 1 },
  uncommon:  { w: 80, label: 'uncommon',  color: '#6ee7a0', stars: 2 },
  rare:      { w: 18, label: 'RARE',      color: '#5cc8ff', stars: 3 },
  legendary: { w: 2, label: 'LEGENDARY', color: '#ffd54a', stars: 4 },
};

export const SHELLS = [
  { id: 'periwinkle', name: 'Periwinkle', tier: 'common', i: 0 },
  { id: 'coquinas', name: 'Coquinas', tier: 'common', i: 1 },
  { id: 'mussel', name: 'Mussel', tier: 'common', i: 2 },
  { id: 'clam', name: 'Clam', tier: 'common', i: 3 },
  { id: 'oyster', name: 'Oyster', tier: 'common', i: 4 },
  { id: 'slipper', name: 'Slipper Shell', tier: 'uncommon', i: 5 },
  { id: 'scallop', name: 'Scallop', tier: 'uncommon', i: 6 },
  { id: 'whelk', name: 'Whelk', tier: 'uncommon', i: 7 },
  { id: 'auger', name: 'Auger', tier: 'uncommon', i: 8 },
  { id: 'comrie', name: 'Comrie', tier: 'uncommon', i: 9 },
  { id: 'sundial', name: 'Sundial', tier: 'uncommon', i: 10 },
  { id: 'sharkeye', name: 'Shark Eye', tier: 'rare', i: 11 },
  { id: 'tulip', name: 'Tulip Shell', tier: 'rare', i: 12 },
  { id: 'angelwing', name: 'Angel Wing', tier: 'rare', i: 13 },
  { id: 'murex', name: 'Murex', tier: 'rare', i: 14 },
  { id: 'kina', name: 'Kina Urchin', tier: 'rare', i: 15 },
  { id: 'conch', name: 'Conch', tier: 'legendary', i: 16 },
  { id: 'triton', name: 'Triton', tier: 'legendary', i: 17 },
  { id: 'paua', name: 'Paua', tier: 'legendary', i: 18 },
  { id: 'nautilus', name: 'Nautilus', tier: 'legendary', i: 19 },
  { id: 'junonia', name: 'Junonia', tier: 'legendary', i: 20 },
  { id: 'star_common', name: 'Common Starfish', tier: 'uncommon', i: 21 },
  { id: 'star_blue', name: 'Blue Starfish', tier: 'rare', i: 22 },
  { id: 'star_astro', name: 'Astropecten', tier: 'rare', i: 23 },
];
