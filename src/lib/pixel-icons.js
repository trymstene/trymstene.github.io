// UI pixel icons for CLIENT SCRIPTS (rave, forge, pass…) — the same purchased
// pixelarticons Pro SVGs the <PixelArtIcon> Astro component uses, inlined as
// strings so scripts can drop them into button innerHTML. `currentColor` follows
// the host element's colour, so an icon on a dark/active button recolours itself.
//
// Only the icons in src/icons/pixelart/ are bundled (the full paid pack is
// gitignored — never redistribute it). Add an icon = copy its SVG into that dir.
const raw = import.meta.glob('../icons/pixelart/*.svg', { query: '?raw', import: 'default', eager: true });
const ICONS = {};
for (const p in raw) ICONS[p.split('/').pop().replace('.svg', '')] = raw[p];

// return an inline <svg> string for `name`, sized in px, with optional extra class
export function iconSvg(name, { size = 24, cls = '' } = {}) {
  const svg = ICONS[name];
  if (!svg) { if (typeof console !== 'undefined') console.warn('iconSvg: unknown icon', name); return ''; }
  return svg.replace('<svg ', `<svg class="pai ${cls}" width="${size}" height="${size}" shape-rendering="crispEdges" aria-hidden="true" focusable="false" `);
}

export const hasIcon = (name) => name in ICONS;
