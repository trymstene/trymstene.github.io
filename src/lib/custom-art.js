// 🎁 A COMMUNITY PIECE'S ART (outfit.c), for the town (2 Oct 2026): its square drew nobody's Forge pieces, yours included,
// while its clothes shop and the other areas did (design library §54). The catalog that holds the art is fetched in its own
// lazy chunk (src/lib/drops.js) only when somebody on the square wears a piece. undefined until it has loaded; `onReady`
// redraws then — pass it where an outfit is set, never from a per-frame draw.
// ⚠️ The lazy import is DESTRUCTURED: one that kept the whole module (`m.catCustom`) made the bundle keep every export of
// drops.js that tree-shaking had dropped — 3.6 KB for two functions.
let resolve = null, ask = null;
export function customArt(c, onReady) {
  if (!c) return undefined;
  if (resolve) return resolve(c);
  if (!ask) ask = import('./drops.js').then(({ loadCatalog, catCustom }) => loadCatalog().then(() => { resolve = catCustom; })).catch(() => { ask = null; });
  if (onReady) ask.then(() => { if (resolve) onReady(); });
  return undefined;
}
