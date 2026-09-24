// ✂️ CSS WRITTEN INSIDE A SCRIPT SHIPPED ITS COMMENTS (24 Sep 2026, the budget trim). The minifier never looks inside a
// string, so the prose explaining each rule rode every visit — ~14 KB of it, most in world-quest's. At BUILD time
// (astro.config.mjs) each `const CSS = \`…\`` and `.textContent = \`…\`` loses its comments and its indentation; the
// source keeps both, because design-canon.js and tools/check-design.mjs read it as written. A literal with ${…} in
// it is left alone. tests/css-strings.spec.mjs proves every one parses to the very same rules in a real browser.
const OPEN = /(?:const CSS|\.textContent) = `\r?\n/g;

// [start, end) of each such literal's body in `code` — the part between the opening line break and the closing backtick
export function cssStrings(code) {
  const out = [];
  for (const m of code.matchAll(OPEN)) {
    const a = m.index + m[0].length;
    if (out.length && a < out[out.length - 1][1]) continue;
    let i = a, ok = true;
    for (; i < code.length; i++) {
      const c = code[i];
      if (c === '\\') { i++; continue; }
      if (c === '`') break;
      if (c === '$' && code[i + 1] === '{') { ok = false; break; }
    }
    if (ok && i < code.length) out.push([a, i]);
  }
  return out;
}

export const stripCss = (body) => body.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n') + '\n';

export function stripCssStrings(code) {
  let out = '', last = 0;
  for (const [a, b] of cssStrings(code)) { out += code.slice(last, a) + stripCss(code.slice(a, b)); last = b; }
  return out + code.slice(last);
}
