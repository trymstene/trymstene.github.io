// a copy line with its holes filled — fillWords(W.sold, { n: 3, what: 'eggs', coins: 9 }); a hole with no value stays visible
export const fillWords = (t, v) => String(t || '').replace(/\{(\w+)\}/g, (m, k) => (k in v ? String(v[k]) : m));
