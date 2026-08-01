// 📐 THE BANANA'S GEOMETRY — seven numbers, no assets.
//
// Split out of banana-engine.js on 1 Aug 2026 so a surface can know the
// banana's PROPORTIONS without loading its sprite sheets. The Forge needs
// exactly this: its item grid is derived from the frame height, but the
// emoji half of the tool must never pull in the compositor.
//
// ⚠️ banana-engine.js imports and re-exports every one of these, so its own
// consumers are untouched — there is still one source of truth, it just
// lives one file further down.
export const FW = 469, FH = 498, NFRAMES = 8;
export const BASE_CYCLE_S = 0.8;   // 8 frames × 100ms = the original GIF timing
export const PX = 13;
export const FRAME_H_FRAC = 0.66, FRAME_TOP_FRAC = 0.20;
