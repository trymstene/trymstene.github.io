// The Forge creation format — shared by the editor (pixel-forge.js) and every
// surface that renders forge creations (the Shelf today; the rave and the shop
// later). A creation = palette INDICES per frame (0 = transparent), base64
// per frame, sizes 32/48/64, per-frame delays. Serialized shape:
//   { v: 1, size, frames: [b64...], delays: [ms...] }
// On the Shelf it travels as params = 'forge:' + JSON.

// index 0 = transparent; 1..16 = the curated palette (the banana's own family)
export const FORGE_PALETTE = [
  null,
  '#111111', '#fffdf5', '#ffe135', '#f2c200',
  '#5a3618', '#e22020', '#ff4d6d', '#ff9f1c',
  '#37d67a', '#39ff14', '#4db8ff', '#6c8cff',
  '#b388ff', '#ff2ec4', '#484848', '#d9a066',
];
export const FORGE_RGB = FORGE_PALETTE.map((h) =>
  h ? [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] : [0, 0, 0]
);
export const FORGE_MAX_FRAMES = 16;
export const FORGE_SIZES = [32, 48, 64];

export const b64 = {
  enc: (u8) => btoa(String.fromCharCode(...u8)),
  dec: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

// parse a serialized creation (raw JSON or the Shelf's 'forge:'-prefixed params)
export function forgeParse(str) {
  try {
    const d = JSON.parse(str.startsWith('forge:') ? str.slice(6) : str);
    if (!d || d.v !== 1 || !FORGE_SIZES.includes(d.size) || !Array.isArray(d.frames) || !d.frames.length) return null;
    const frames = d.frames.slice(0, FORGE_MAX_FRAMES).map((s) => {
      const u = b64.dec(s);
      return u.length === d.size * d.size ? u : new Uint8Array(d.size * d.size);
    });
    return {
      size: d.size,
      frames,
      delays: frames.map((_, i) => Math.min(1000, Math.max(50, (d.delays || [])[i] || 120))),
    };
  } catch (e) { return null; }
}

// draw one frame of index data into a 2d context at an integer scale
export function forgeDrawFrame(ctx, frame, size, scale, alpha = 1) {
  ctx.globalAlpha = alpha;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = frame[y * size + x];
      if (!idx) continue;
      ctx.fillStyle = FORGE_PALETTE[idx];
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  ctx.globalAlpha = 1;
}
