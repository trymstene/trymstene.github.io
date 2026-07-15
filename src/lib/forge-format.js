// The Forge creation format — shared by the editor (pixel-forge.js) and every
// surface that renders forge creations (the Shelf today; the rave and the shop
// later). A creation = palette INDICES per frame (0 = transparent), base64
// per frame, sizes 32/48/64, per-frame delays. Serialized shapes:
//   v1: { v: 1, size, frames: [b64...], delays: [ms...] }
//   v2: v1 + cpal: ['#rrggbb'...] — per-creation CUSTOM colours, occupying
//       indices FORGE_PALETTE.length.. (the shared palette never changes;
//       customs travel WITH the creation so every surface renders them)
// On the Shelf it travels as params = 'forge:' + JSON.

// index 0 = transparent; 1..16 = the original curated set (the banana's own
// family); 17..32 = the v2 extension (skins, deeps, pastels, greys).
// APPEND-ONLY: indices are baked into every saved creation — never reorder,
// recolor or remove an entry.
export const FORGE_PALETTE = [
  null,
  '#111111', '#fffdf5', '#ffe135', '#f2c200',
  '#5a3618', '#e22020', '#ff4d6d', '#ff9f1c',
  '#37d67a', '#39ff14', '#4db8ff', '#6c8cff',
  '#b388ff', '#ff2ec4', '#484848', '#d9a066',
  '#ffdbac', '#c68642', '#8d5524', '#8e1600',
  '#7b1e3c', '#1d7a3c', '#0fb5ba', '#00e5ff',
  '#1e2a78', '#6a1b9a', '#ffc1e3', '#a8e6cf',
  '#d4af37', '#556b2f', '#9e9e9e', '#bdbdbd',
];
export const FORGE_RGB = FORGE_PALETTE.map((h) =>
  h ? [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] : [0, 0, 0]
);
export const FORGE_MAX_FRAMES = 16;
export const FORGE_SIZES = [32, 48, 64];
export const FORGE_CUSTOM_MAX = 32; // per-creation custom colours (33 shared + 32 custom < gifenc's 256 cap)

export const b64 = {
  enc: (u8) => btoa(String.fromCharCode(...u8)),
  dec: (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)),
};

// parse a serialized creation (raw JSON or the Shelf's 'forge:'-prefixed params)
export function forgeParse(str) {
  try {
    const d = JSON.parse(str.startsWith('forge:') ? str.slice(6) : str);
    if (!d || (d.v !== 1 && d.v !== 2) || !FORGE_SIZES.includes(d.size) || !Array.isArray(d.frames) || !d.frames.length) return null;
    const frames = d.frames.slice(0, FORGE_MAX_FRAMES).map((s) => {
      const u = b64.dec(s);
      return u.length === d.size * d.size ? u : new Uint8Array(d.size * d.size);
    });
    const cpal = d.v === 2 && Array.isArray(d.cpal)
      ? d.cpal.slice(0, FORGE_CUSTOM_MAX).filter((h) => /^#[0-9a-f]{6}$/i.test(h))
      : [];
    return {
      size: d.size,
      frames,
      delays: frames.map((_, i) => Math.min(1000, Math.max(50, (d.delays || [])[i] || 120))),
      cpal,
      palette: FORGE_PALETTE.concat(cpal),
    };
  } catch (e) { return null; }
}

// draw one frame of index data into a 2d context at an integer scale;
// pass the creation's own palette (from forgeParse) so custom colours render
export function forgeDrawFrame(ctx, frame, size, scale, alpha = 1, palette = FORGE_PALETTE) {
  ctx.globalAlpha = alpha;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = frame[y * size + x];
      if (!idx) continue;
      const col = palette[idx];
      if (!col) continue; // index beyond this palette (stale renderer) — skip, never mis-colour
      ctx.fillStyle = col;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  ctx.globalAlpha = 1;
}
