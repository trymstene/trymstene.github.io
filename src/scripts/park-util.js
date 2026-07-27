// 🌳 shared helpers for the park's modules (banana-park.js + park-*.js).
// Everything here is statically imported by the park only → one page bundle.

export function track(name, params) { if (window.gtag) window.gtag('event', name, params || {}); }

// ?parktest = the QA hook (same family as ?beachtest / ?cointest): all five
// P3 features force-spawn near the plaza spawn, timers ignored.
export const PARK_TEST = typeof location !== 'undefined' && /[?&]parktest(?:=|&|$)/.test(location.search);

export const R = (x, y, w, h, f) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + f + '"/>';
export const SVG = (vb, body) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vb + '" shape-rendering="crispEdges">' + body + '</svg>';

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// 🍂 THE FIVE BLOOM PHASES — 0 dead … 4 perfect. Band starts, shared by the
// chassis (phaseFor hysteresis, banana-park.js) and the health bar's ticks
// (park-garden.js).
export const PHASE_STARTS = [0, 20, 40, 60, 80];
