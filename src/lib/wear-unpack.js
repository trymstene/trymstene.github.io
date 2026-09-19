// 🎨 THE ART DECODER — the exact twin of unpack() in tools/build-wearart.py (19 Sep 2026).
//
// Every wearable used to sit right here as an inline SVG string: a grid of <rect> elements, one per
// 10-px cell, with x/y/width/height/fill spelled out every time. 103 of them came to 195 804 B, which
// was 86% of this file and about 15% of everything a player downloads — on the file that the park, the
// beach, the homestead, the rave, the builder, the inbox and the quest all import. It ships as 17 KB
// now. The readable art is tools/wearart-source.js (outside src/, so never bundled); the packed form
// is src/data/wearart.js; `python tools/build-wearart.py` turns one into the other.
//
// ⭐ THIS REPRODUCES THE SOURCE STRING BYTE FOR BYTE — not "looks the same", identical. That is the
// only reason a change this wide is safe, and it is not taken on trust: the packer asserts it for
// every wearable before it writes, and tools/check-wearart.mjs runs THIS decoder against the source
// on every build. A moved pixel is a red build.
//
// ⚠️ The cell alphabet contains no hex digit on purpose — a run is `X*n` with n in hex, so a cell
// that could also be a hex digit would make `X*3a` ambiguous. Keep the two disjoint.
const ART_A = 'ghijklmnopqrstuvwxyzGHIJKLMNOPQRSTUVWXYZ';
const ART_HEAD = [
  (w, h) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" shape-rendering="crispEdges">',
  (w, h) => '<svg viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">',
  (w, h) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges">',
];
export function unpackArt(p) {
  const hi = p[0], gw = p[1], gh = p[2], pal = p[3], cells = p[4];
  let flat = '';
  for (let i = 0; i < cells.length;) {
    const ch = cells.charAt(i);
    if (cells.charAt(i + 1) === '*') {
      let j = i + 2;
      while (j < cells.length && '0123456789abcdef'.indexOf(cells.charAt(j)) >= 0) j++;
      flat += ch.repeat(parseInt(cells.slice(i + 2, j), 16));
      i = j;
    } else { flat += ch; i++; }
  }
  let out = '';
  for (let ry = 0; ry < gh; ry++) {
    for (let rx = 0; rx < gw;) {
      const at = flat.charAt(ry * gw + rx), c = ART_A.indexOf(at);
      if (c === 0) { rx++; continue; }
      let run = 1;
      while (rx + run < gw && flat.charAt(ry * gw + rx + run) === at) run++;
      out += '<rect x="' + rx * 10 + '" y="' + ry * 10 + '" width="' + run * 10 + '" height="10" fill="#' + pal.slice((c - 1) * 6, c * 6) + '"/>';
      rx += run;
    }
  }
  return ART_HEAD[hi](gw * 10, gh * 10) + out + '</svg>';
}
