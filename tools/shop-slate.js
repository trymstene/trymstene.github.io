// THE SHOP SLATE — the official line, priced by the one rule.
//
//   price = (MIN_MARGIN + blank + 0.30) / 0.971   → rounded UP to .99
//   (2.9% + $0.30 Shopify Payments; shipping is CHARGED at checkout, never baked in)
//
// Every product is pinned to ONE colour-cost tier, so a single price per size
// can never turn into a loss on a pricier colourway — that is the 5XL lesson
// from the first tee, which shipped flat at $19.99 over blanks up to $17.55.
//
// Blank costs are live Printful public-catalog prices (no auth needed):
//   node tools/shop-slate.js            print the slate
//   node tools/shop-slate.js --verify   re-fetch every blank and flag drift
//
// Products are created BY HAND in Printful's UI — its sync endpoints return
// 400 "applies only to Manual Order / API platform" for a Shopify-platform
// store. This file is the click-list; the site picks products up at build.

export const MIN_MARGIN = 2.0;
const FEE_PCT = 0.029, FEE_FLAT = 0.3;

// the next .99 STRICTLY above raw — `ceil(raw) - 0.01` lands a cent UNDER the
// floor whenever raw is exactly a whole dollar
export const priceFor = (blank, margin = MIN_MARGIN) =>
  Math.round((Math.ceil(raw(blank, margin) + 0.01) - 0.01) * 100) / 100;
const raw = (blank, margin) => (margin + blank + FEE_FLAT) / (1 - FEE_PCT);
export const marginAt = (price, blank) => price * (1 - FEE_PCT) - FEE_FLAT - blank;

// Every DTG garment carries the SAME mark, in two inks — black on light
// colours, white on dark. Printful groups colours in the design step, so it is
// one product with two file swaps, not two products.
const DTG_PLACE = 'front centre, 12″ wide, top edge ~3″ below the collar — black ink on light colours, white on dark';

// tier: the colour set this product is restricted to, and what it costs.
// Pinning is a CONVENIENCE, not a safety net — Shopify prices per variant, so
// keeping every colour is fine as long as each one is priced off its own blank
// (the live tee already does this: its $20.99 top is the premium-colour 5XL).
// One tier just means fewer distinct prices to set by hand, and fewer chances
// to miss a row. sizes: [label, blankCost] — each row priced off ITS OWN blank.
export const SLATE = [
  // ---- under $10: the impulse rung the shop has never had -----------------
  { key: 'sticker', name: 'Kiss-cut sticker', catalog: 358, tech: 'digital',
    art: 'sticker-4in-hero', place: 'fill the square, ~88% — the classic in colour',
    sizes: [['3″×3″', 2.5], ['4″×4″', 2.5], ['5.5″×5.5″', 2.75]] },
  { key: 'holo', name: 'Holographic sticker', catalog: 673, tech: 'digital',
    art: 'sticker-4in-hero', place: 'same file — the foil does the work',
    sizes: [['3″×3″', 4.75], ['4″×4″', 4.95], ['5.5″×5.5″', 5.25]] },
  { key: 'stickersheet', name: 'Sticker sheet', catalog: 505, tech: 'digital',
    art: 'stickersheet-a5', place: '12 cut-apart bananas, one per dance frame',
    sizes: [['5.8″×8.3″', 5.25]] },
  { key: 'mug', name: 'Mug (white glossy, 11 oz)', catalog: 19, tech: 'sublimation',
    art: 'mug-11oz-wrap', place: 'full wrap — three big frames, evenly spaced',
    sizes: [['11 oz', 6.5], ['15 oz', 8.75]] },
  { key: 'notepad', name: 'Notepad', catalog: 786, tech: 'digital',
    art: 'notepad-5x6', place: 'cover, full bleed',
    sizes: [['5.5″×6″', 6.63]] },

  // ---- $10–$20 ------------------------------------------------------------
  { key: 'tee', name: 'Unisex classic tee', catalog: 438, blankModel: 'Gildan 5000',
    tech: 'DTG', live: true, tier: 'all 35, both tiers, already priced per variant — leave it alone',
    art: '(already has its design)', place: 'no change',
    sizes: [['S–XL', 7.5], ['2XL', 8.95], ['3XL', 10.5], ['4XL', 11.95], ['5XL', 13.5],
            ['5XL premium colours', 17.25]] },
  { key: 'teew', name: "Women's tee", catalog: 849, blankModel: 'Gildan 64000L',
    tech: 'DTG', tier: '$7.50 colours (7 of 9) — drop Irish Green',
    art: 'tee-oneink-black + tee-oneink-white', place: DTG_PLACE,
    sizes: [['S–XL', 7.5], ['2XL', 8.95]] },
  { key: 'buttons', name: 'Buttons, set of 5', catalog: 660, tech: 'digital',
    art: 'buttons-2in', place: 'one banana per button, centred',
    sizes: [['1.25″', 7.58], ['2.25″', 8.5]] },
  { key: 'poster', name: 'Poster (matte)', catalog: 1, tech: 'digital',
    art: 'poster-18x24', place: 'full bleed — the same file scales to all three sizes',
    sizes: [['11″×14″', 9.25], ['12″×18″', 11.75], ['18″×24″', 13.5]] },
  { key: 'case', name: 'iPhone case (clear)', catalog: 181, tech: 'UV',
    art: 'case-iphone', place: 'full bleed, pattern runs off every edge',
    sizes: [['all 31 models', 11.25]] },

  // ---- $18+: the pieces that make it look like a real front ---------------
  // Caps are their own round: every Printful cap is EMBROIDERY-only, which
  // needs a chunky ≤6-thread-colour mark — the sprite's 1px detail will not
  // stitch. The all-over beanie is cut-sew, so it takes the tile as-is.
  { key: 'beanie', name: 'Beanie (all-over print)', catalog: 458, tech: 'cut-sew',
    art: 'allover-tile-seamless', place: "Printful's template, repeat mode — the tile wraps",
    sizes: [['S/M/L', 15.5]] },
  { key: 'tote', name: 'Tote bag (all-over print)', catalog: 84, tech: 'cut-sew',
    art: 'allover-tile-seamless', place: "Printful's template, repeat mode — both faces",
    sizes: [['15″×15″', 16.75]] },
  { key: 'crew', name: 'Crewneck sweatshirt', catalog: 145, blankModel: 'Gildan 18000',
    tech: 'DTG', tier: '$16.95 colours (18 of 25) — drop Ash, Dark Chocolate, Gold, Heather Deep Royal, Heliconia, Irish Green, Purple',
    art: 'tee-oneink-black + tee-oneink-white', place: DTG_PLACE,
    sizes: [['S–XL', 16.95], ['2XL', 18.5], ['3XL', 19.95], ['4XL', 21.5], ['5XL', 22.95]] },
  { key: 'hoodie', name: 'Hoodie', catalog: 146, blankModel: 'Gildan 18500',
    tech: 'DTG', tier: 'all 26 colours (the two tiers are 6¢ apart — price off the higher)',
    art: 'tee-oneink-black + tee-oneink-white', place: DTG_PLACE,
    sizes: [['S–XL', 22.25], ['2XL', 24.19], ['3XL', 26.19], ['4XL', 28.19], ['5XL', 30.19]] },
];

// The enamel mug already live at $14.99 (blank $12.25) stays as the premium
// camp mug — the glossy at $9.99 is the everyday one. Two rungs, one category.

// The click-list: what to open in Printful, which art to drop on it, and the
// exact price for every size. Written next to the art so one folder is all
// that's needed at the keyboard.
function clickList() {
  const L = ['# The official line — Printful click-list', '',
    'Generated by `node tools/shop-slate.js --list`. Art files sit beside this',
    'file; regenerate them with `python tools/build-shop-art.py`.', '',
    '**Shipping is charged at checkout — never bake it into a price.**',
    'Every row keeps at least $2.00 after Shopify\'s 2.9% + $0.30.', ''];
  let n = 0;
  for (const p of SLATE) {
    if (p.live) { L.push(`### ~~${p.name}~~ — already live, no change`, ''); continue; }
    n += 1;
    L.push(`### ${n}. ${p.name}`, '',
      `- **Printful catalog** #${p.catalog}${p.blankModel ? ` (${p.blankModel})` : ''} · ${p.tech}`,
      `- **Artwork** ${p.art.split(' + ').map((a) => `\`${a}.png\``).join(' + ')}`,
      `- **Placement** ${p.place}`);
    if (p.tier) L.push(`- **Colours** ${p.tier}`);
    L.push('', '| Size | Blank | Price | You keep |', '|---|---|---|---|');
    for (const [label, blank] of p.sizes) {
      const price = priceFor(blank);
      L.push(`| ${label} | $${blank.toFixed(2)} | **$${price.toFixed(2)}** | $${marginAt(price, blank).toFixed(2)} |`);
    }
    L.push('');
  }
  L.push('---', '',
    'After each product is published to the **Headless** sales channel, the next',
    'site build picks it up on its own — no code change. That was proven on',
    '7 Aug when five retired products left the shop, sitemap and PLP by themselves.', '',
    '⏭ **Caps and cuffed beanies are a later round**: every Printful cap is',
    'embroidery-only and needs a chunky ≤6-thread-colour mark — the sprite\'s',
    '1px detail will not stitch. That mark would be reusable (patches, pins).', '');
  return L.join('\n');
}

if (process.argv[1] && process.argv[1].endsWith('shop-slate.js')) {
  if (process.argv.includes('--list')) {
    const fs = await import('node:fs');
    const path = new URL('../print-files/CLICK-LIST.md', import.meta.url);
    fs.mkdirSync(new URL('../print-files/', import.meta.url), { recursive: true });
    fs.writeFileSync(path, clickList());
    console.log('wrote ' + path.pathname.slice(1));
  } else {
    const pad = (s, n) => String(s).padEnd(n);
    let low = Infinity, high = 0;
    for (const p of SLATE) {
      console.log(`\n${p.live ? '● LIVE ' : '○ NEW  '}${p.name}   catalog #${p.catalog}  (${p.tech})`);
      if (p.tier) console.log(`        colours: ${p.tier}`);
      for (const [label, blank] of p.sizes) {
        const price = priceFor(blank);
        low = Math.min(low, price); high = Math.max(high, price);
        console.log(`        ${pad(label, 14)} blank $${pad(blank.toFixed(2), 7)} → $${pad(price.toFixed(2), 7)} keeps $${marginAt(price, blank).toFixed(2)}`);
      }
    }
    console.log(`\n${SLATE.length} products · $${low.toFixed(2)} – $${high.toFixed(2)}`);
  }
}
