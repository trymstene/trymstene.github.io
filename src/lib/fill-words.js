// a copy line with its holes filled — fillWords(W.sold, { n: 3, what: 'eggs', coins: 9 }); a hole with no value stays visible
// ⚠️ a value that ends a sentence itself ("Fig Jr.") swallows the line's own full stop after it: "Delivered to {who}."
// printed "Delivered to Fig Jr.." (found filming the town trailer, 1 Oct 2026)
export const fillWords = (t, v) => String(t || '').replace(/\{(\w+)\}(\.?)/g, (m, k, dot) => {
  if (!(k in v)) return m;
  const s = String(v[k]);
  return s + (dot && s.endsWith('.') ? '' : dot);
});
