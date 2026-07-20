// WEAR RENDER — turn a saved/submitted wearable payload into the engine's
// `custom` channel, so ANY surface can draw a banana wearing a forge-made item:
//   drawComposite(ctx, size, frame, { ...outfit, custom: wearToCustom(wear) })
// The payload is the shelf/catalog `wear` object {forge, anchor, hand, ox, oy,
// scale} (or the 'wear:'-prefixed params string). Art is reconstructed with the
// SAME trimmed forgeGridToSVG the Items Workshop used when capturing the
// offsets — placement agrees by construction. CLIENT-ONLY.
import { forgeParse, forgeGridToSVG } from './forge-format.js';

export function wearToCustom(wear) {
  try {
    const d = typeof wear === 'string' ? JSON.parse(wear.replace(/^wear:/, '')) : wear;
    if (!d || !d.forge) return null;
    const f = forgeParse(d.forge);
    if (!f) return null;
    const out = forgeGridToSVG(f.frames[0], f.w, f.h, f.palette);
    if (!out) return null;
    return { art: out.svg, anchor: d.anchor, hand: d.hand || undefined, ox: d.ox || 0, oy: d.oy || 0, scale: d.scale || 1 };
  } catch (e) { return null; }
}
