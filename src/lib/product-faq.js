// ❓ THE QUESTIONS A PRINT-ON-DEMAND BUYER ASKS BEFORE PAYING.
//
// One module, two shops. The official line (/shop/<handle>/) and the custom
// builder products (/make-a-banana/<product>/) sell the same way — printed to
// order, shipped worldwide, no size swaps — so the delivery and returns answers
// must be worded once. Two copies would drift the day one of them is edited,
// and a shop that answers "can I return it" two different ways is worse than
// one that does not answer at all.
//
// ⚠️ EVERY ANSWER IS BUILT FROM THE PRODUCT'S OWN DATA — its colours, its
// sizes, whether it has a size guide. Nothing here is a generic block pasted
// onto every page, so an answer cannot outlive the fact behind it.
//
// The returns wording comes from Printful's actual policy, read on 8 Aug:
// misprinted/damaged/defective and lost-in-transit are covered within 30 days
// at their expense; buyer's remorse and size exchanges are explicitly NOT, and
// are "to be offered at your expense and discretion". Trym offers neither.

const list = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0]);

const DELIVERY = {
  q: 'How long will it take to arrive?',
  a: 'It is printed to order, which takes 2–5 business days, and then the carrier time to you on '
    + 'top. Shipping is calculated at checkout, so you see the exact cost before you pay.',
};
const DAMAGED = {
  q: 'What if it arrives damaged or misprinted?',
  a: 'It gets replaced free. Report it within 30 days of delivery and a new one is sent at our '
    + 'cost — the same goes for a parcel lost in transit.',
};
const SHIPS = { q: 'Where do you ship to?', a: 'Worldwide, from the print facility closest to you.' };

const sizeQ = (sizes, hasGuide) => ({
  q: 'What sizes are available, and how do they fit?',
  a: `${list(sizes)}.` + (hasGuide
    ? ' The size guide on this page has the real measurements in inches and centimetres — worth a '
      + 'look, because sizes are not exchangeable.'
    : ''),
});

/** The official line: stock designs, drawn by Trym, in fixed colourways. */
export function officialFaqs({ title, colors = [], sizes = [], hasSizeGuide = false }) {
  const short = (title || '').replace(/^DANCING BANANA OFFICIAL™?\s*/i, '');
  return [
    {
      q: 'Is this official Dancing Banana merch?',
      a: 'Yes. Trym Stene drew the original dancing banana in 1999, and this shop is his — every '
        + 'design is printed and posted by the person who made the character.',
    },
    DELIVERY,
    ...(colors.length > 1 ? [{
      q: `What colours does the ${short} come in?`,
      a: `${colors.length} colours: ${list(colors)}.`,
    }] : []),
    ...(sizes.length ? [sizeQ(sizes, hasSizeGuide)] : []),
    DAMAGED,
    {
      q: 'Can I return it or swap the size?',
      a: 'No — every item is made to order, so there are no returns for a change of mind or a wrong '
        + 'size. That is why the size guide matters. Damaged, misprinted and defective items are '
        + 'always covered.',
    },
    SHIPS,
  ];
}

/** The builder products: the customer's OWN banana, so the answers change —
 *  what gets printed is theirs, which is also why returns are firmer here. */
export function customFaqs({ name, sizes = [], hasSizeGuide = false }) {
  const lc = (name || 'item').toLowerCase();
  return [
    {
      q: `Is the ${lc} printed with the exact banana I made?`,
      a: 'Yes. The preview on this page is the artwork that goes to print — the same pose, outfit '
        + 'and colours you chose in the builder, exported at full print resolution.',
    },
    DELIVERY,
    ...(sizes.length ? [sizeQ(sizes, hasSizeGuide)] : []),
    {
      q: 'Will the pixels look blurry when printed?',
      a: 'No. The banana is pixel art, and it is sent to print as crisp squares at print size — '
        + 'the edges stay sharp instead of being smoothed into mush.',
    },
    DAMAGED,
    {
      q: 'Can I return it if I change my mind?',
      a: 'No — it is made to your design, so nothing else about it is resellable and there are no '
        + 'returns for a change of mind or a wrong size. Check the preview and the size guide '
        + 'before you order. Anything that arrives damaged or misprinted is always replaced free.',
    },
    {
      q: 'Is this really made by the creator of the dancing banana?',
      a: 'Yes. Trym Stene drew the original in 1999 — the builder puts his character in your hands, '
        + 'and the order comes from him.',
    },
    SHIPS,
  ];
}

/** schema.org FAQPage for a question list. */
export const faqSchema = (faqs) => ({
  '@context': 'https://schema.org/',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
});
