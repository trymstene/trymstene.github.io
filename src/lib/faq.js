// ❓ ONE LIST FOR A PAGE'S QUESTIONS (25 Sep 2026) — a page's questions are drawn on it (src/components/AreaFaq.astro,
// or the page's own FAQ look through src/components/CopyLine.astro) and handed to the search engines as its FAQPage from
// the SAME array, so the two cannot drift. They had, on every page that kept two copies: the rave's markup asked six
// questions the page never showed, the bay's were not on screen at all, and the GIF page's markup still credited the
// Flash to the band. tools/check-structured-data.mjs holds every page to it.
//
// A copy line may carry a little markup, drawn on the page and dropped from the FAQPage:
//   [words](/path/) or [words](#anchor)   a link to a page of this site, or to a place on this page
//   **words**                             bold
//   *words*                               italic (a title: *Family Guy*)
// Nothing else — the copy gate refuses a link that leaves the site.
export const LINK = /\[([^\]]+)\]\(((?:\/|#)[^)\s]*)\)/g;
const TOKEN = /\[([^\]]+)\]\(((?:\/|#)[^)\s]*)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;

/** A copy line as its pieces: { text }, { text, href }, { text, b: true } or { text, i: true }. */
export function parts(s) {
  const str = String(s), out = [];
  let at = 0;
  for (const m of str.matchAll(TOKEN)) {
    if (m.index > at) out.push({ text: str.slice(at, m.index) });
    if (m[1] != null) out.push({ text: m[1], href: m[2] });
    else if (m[3] != null) out.push({ text: m[3], b: true });
    else out.push({ text: m[4], i: true });
    at = m.index + m[0].length;
  }
  if (at < str.length) out.push({ text: str.slice(at) });
  return out;
}
export const linkParts = parts;   // the name the area guides used first

/** The words a reader sees, with the markup gone. */
export const plain = (s) => parts(s).map((p) => p.text).join('');

/** The FAQPage for a list of { q, a }. */
export function faqLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({ '@type': 'Question', name: plain(it.q), acceptedAnswer: { '@type': 'Answer', text: plain(it.a) } })),
  };
}
