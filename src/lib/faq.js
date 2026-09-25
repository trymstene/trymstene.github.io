// ❓ ONE LIST FOR A PAGE'S QUESTIONS (25 Sep 2026) — the questions under an area's frame are drawn on the page
// (src/components/AreaFaq.astro) and handed to the search engines as its FAQPage from the SAME array, so the two
// cannot drift. They had: the rave's markup asked six questions the page never showed, the park's answers were other
// answers, and the bay's questions were nowhere on screen at all. tools/check-structured-data.mjs holds every page to it.
//
// A line may carry a link to another page of the site as [words](/path/): the page draws a link, the FAQPage gets the
// words. Only a path on this site — the copy gate refuses anything else.
export const LINK = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;

/** A copy line as its pieces: plain text, and { text, href } for each link. */
export function linkParts(s) {
  const out = [];
  let i = 0;
  for (const m of String(s).matchAll(LINK)) {
    if (m.index > i) out.push({ text: s.slice(i, m.index) });
    out.push({ text: m[1], href: m[2] });
    i = m.index + m[0].length;
  }
  if (i < String(s).length) out.push({ text: String(s).slice(i) });
  return out;
}

/** The words a reader sees, with the link markup gone. */
export const plain = (s) => String(s).replace(LINK, '$1');

/** The FAQPage for a list of { q, a }. */
export function faqLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({ '@type': 'Question', name: plain(it.q), acceptedAnswer: { '@type': 'Answer', text: plain(it.a) } })),
  };
}
