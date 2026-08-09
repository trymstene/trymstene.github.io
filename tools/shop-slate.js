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

// Every DTG garment carries the SAME mark: the full-colour 1999 sprite, ONE
// file, on every colourway. That is what the live line already does — the
// maroon tee, the green hoodie, the black fitted tee and the white crop top all
// print the identical colour banana, and the yellow is the whole point.
// ⚠️ The one-ink outline files (tee-oneink-black/white) are NOT for garments.
// They were built as a fallback and they make the shop look like a blank with a
// logo slapped on it — the exact thing the crop-top bar rules out.
const DTG_PLACE = 'front centre, 12″ wide, top edge ~3″ below the collar — the colour sprite, same file on every colourway';

// 🏷 THE OFFICIAL STAMP — every garment, by default. Trym, 8 Aug: he wanted the
// clothing to "feel official rather than products bought at RedBubble", and
// worried a second print would just make every shirt dearer. It would: a BACK
// print is +$5.95. The neck label is +$0.99, which the rule turns into a flat
// +$1.00 on the shelf across all seven garments — and it is what a real
// clothing brand actually does, inside the collar, not competing with the art.
// `label-tag` and `label-stamp` exist in print-files/motifs/ as alternates.
export const LABEL = { art: 'label-stack', cost: 0.99, placement: 'label_inside' };
// what a size ACTUALLY costs us — never read `sizes[i][1]` for pricing.
// `labelCost: 0` = the label is FREE on that product (all-over print garments
// are cut-and-sewn, so the label prints in the same pass).
export const costOf = (p, blank) =>
  blank + (p.label ? (p.labelCost != null ? p.labelCost : LABEL.cost) : 0);

// tier: the colour set this product is restricted to, and what it costs.
// Pinning is a CONVENIENCE, not a safety net — Shopify prices per variant, so
// keeping every colour is fine as long as each one is priced off its own blank
// (the live tee already does this: its $20.99 top is the premium-colour 5XL).
// One tier just means fewer distinct prices to set by hand, and fewer chances
// to miss a row. sizes: [label, blankCost] — each row priced off ITS OWN blank.
export const SLATE = [
  // ---- under $10: the impulse rung the shop has never had -----------------
  { key: 'sticker', name: 'Kiss-cut sticker', catalog: 358, tech: 'digital', live: true,
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
    tech: 'DTG', label: true, live: true, dearest: true,
    tier: 'all 35, both tiers, already priced per variant — leave it alone',
    art: '(already has its design)', place: 'no change',
    sizes: [['S–XL', 7.5], ['2XL', 8.95], ['3XL', 10.5], ['4XL', 11.95], ['5XL', 13.5],
            ['5XL premium colours', 17.25]] },
  { key: 'teew', name: "Women's tee", catalog: 849, blankModel: 'Gildan 64000L',
    tech: 'DTG', label: true, tier: 'Azalea, Black, Navy, Red, Royal, RS Sport Grey, White — ⛔ drop Purple (it only exists in L) and Irish Green (its M and 2XL cost more than every other colour)',
    art: 'tee-colour', place: DTG_PLACE,
    sizes: [['S–XL', 7.5], ['2XL', 8.95]] },
  // ---- 👗 THE APPAREL LINE (Trym, 8 Aug: "some more clothing, women and
  // men-clothing"). Chosen to fill GAPS, not to add garments: the shop had an
  // entry tee, a men's fitted tee, a crop top and a hoodie — so no women's cut
  // at the entry price, nothing long-sleeved, and nothing between a tee and a
  // hoodie. Skipped on purpose: the AS Colour crop tee and Mali tee (both
  // $21.99, same slot as the crop top already live) and the Bella+Canvas
  // cropped hoodie ($44.99 — its blank alone is $40.95).
  // ⚠️ Black and White are DELIBERATELY dropped from this one. They are the
  // only two colours Bella+Canvas charges $16.95 for; every other colour is
  // $13.69 flat across S–3XL. Keeping them would drag the whole product to
  // $19.99 — dropping them buys a $16.99 boxy tee with ONE price in every size.
  { key: 'teew_relaxed', name: "Women's relaxed tee (boxy)", catalog: 360, blankModel: 'Bella+Canvas 6400',
    tech: 'DTG', label: true, tier: 'Light Violet, Maroon, Mauve, Military Green, Natural, Sage, Vintage White, Heather Deep Teal, Heather Navy, Heather True Royal (10 of 22 — the flat-cost set)',
    art: 'tee-colour', place: DTG_PLACE,
    sizes: [['S–3XL, every size', 13.69]] },
  // ⚠️ #956, NOT the Bella+Canvas 3501 (#356) this row originally specced.
  // Trym picked the Cotton Heritage heavyweight when he built it on 8 Aug, and
  // the slate has to name the blank that is actually LIVE — the colour-hex
  // codegen walks these catalog ids, so a stale one leaves real colourways
  // (Agave, Harbor Blue, Carbon Grey) rendering as grey dots in the shop.
  { key: 'longsleeve', name: "Men's heavyweight long sleeve", catalog: 956, blankModel: 'Cotton Heritage MC1186',
    tech: 'DTG', label: true, live: true, tier: 'all 5 — Agave, Black, Carbon Grey, Harbor Blue, White (one flat cost tier)',
    art: 'tee-colour', place: DTG_PLACE,
    sizes: [['S–XL', 15.95], ['2XL', 17.95], ['3XL', 19.95]] },
  { key: 'tank', name: 'Unisex tank top', catalog: 248, blankModel: 'Bella+Canvas 3480',
    tech: 'DTG', label: true, tier: 'Black, Navy, Red, True Royal, White — ⛔ drop Athletic Heather ($14.23 in every size, alone)',
    art: 'tee-colour', place: 'front centre, 10″ wide — a tank has a narrower panel than a tee',
    sizes: [['XS', 14.23], ['S–XL', 13.95], ['2XL', 15.5]] },
  // ---- LIVE garments, added to the slate 8 Aug so the neck label reaches the
  // whole wardrobe. They were never slate rows because they came back from the
  // archive, but "official stamp on clothing BY DEFAULT" means these too.
  { key: 'teem', name: "Men's fitted tee", catalog: 108, blankModel: 'Next Level 3600',
    tech: 'DTG', label: true, live: true, dearest: true,
    tier: 'all 8 — priced off the dearest tier; Desert Pink and Light Blue cost 67¢ less and simply keep more',
    art: 'tee-colour', place: DTG_PLACE,
    sizes: [['XS–XL', 17.25], ['2XL', 18.75], ['3XL', 20.58]] },
  // ⭐ the label is FREE here: an all-over print garment is cut-and-sewn, so
  // Printful prints the label in the same pass (`additional_price: null`).
  // No price change at all — it just becomes official.
  { key: 'croptop', name: 'Crop top (all-over print)', catalog: 200,
    tech: 'cut-sew', label: true, labelCost: 0, live: true, tier: 'white only',
    art: '(already has its design)', place: 'no change',
    sizes: [['XS–XL', 19.25]] },

  { key: 'buttons', name: 'Buttons, set of 5', catalog: 660, tech: 'digital',
    art: 'buttons-2in', place: 'one banana per button, centred',
    sizes: [['1.25″', 7.58], ['2.25″', 8.5]] },
  // 8″×10″ found by --verify: it lands at $9.99 and keeps MORE ($2.45) than the
  // 11″×14″ it replaces ($2.09). A poster under $10 is a better bottom rung.
  { key: 'poster', name: 'Poster (matte)', catalog: 1, tech: 'digital',
    art: 'poster-18x24', place: 'full bleed — the same file scales to all three sizes',
    sizes: [['8″×10″', 6.95], ['12″×18″', 11.75], ['18″×24″', 13.5]] },
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
  // ⛔ DROPPED — the tote already in the shop wins on both sides: a $10.50
  // blank against this one's $16.75, so it sells at $14.99 not $19.99 AND
  // keeps $3.76 not $2.36. Always check the archive before adding a category.
  // 4XL/5XL exist on only 6 of these colours — Black, Charcoal, Graphite
  // Heather, Orange, Sport Grey, White. On the rest the ladder stops at 3XL.
  { key: 'crew', name: 'Crewneck sweatshirt', catalog: 145, blankModel: 'Gildan 18000',
    tech: 'DTG', label: true, tier: '$16.95 colours (18 of 25) — drop Ash, Dark Chocolate, Gold, Heather Deep Royal, Heliconia, Irish Green, Purple',
    art: 'tee-colour', place: DTG_PLACE,
    sizes: [['S–XL', 16.95], ['2XL', 18.5], ['3XL', 19.95], ['4XL', 21.5], ['5XL', 22.95]] },
  { key: 'hoodie', name: 'Hoodie', catalog: 146, blankModel: 'Gildan 18500', live: true,
    tech: 'DTG', label: true, tier: 'all 26 colours (the two tiers are 6¢ apart — price off the higher)',
    art: 'tee-colour', place: DTG_PLACE,
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
    // a LIVE product with a label still needs a visit — that is the whole point
    // of "by default". Only the untouched ones get waved through.
    if (p.live && !p.label) { L.push(`### ~~${p.name}~~ — already live, no change`, ''); continue; }
    if (p.live) {
      const free = costOf(p, 0) === 0;
      L.push(`### ✏️ ${p.name} — ALREADY LIVE, edit it`, '',
        `- **Printful catalog** #${p.catalog}${p.blankModel ? ` (${p.blankModel})` : ''} · ${p.tech}`,
        `- 🏷 Add the \`${LABEL.placement}\` placement with \`motifs/${LABEL.art}-black.png\` (\`-white\` on dark colourways)`,
        free
          ? '- 💚 **The label is free on this one** — cut-sew prints it in the same pass. **No price change.**'
          : '- Then reprice in Shopify — the label is +$0.99, which is +$1.00 on the shelf:');
      if (!free) {
        L.push('', '| Size | Was | Now |', '|---|---|---|');
        for (const [label, blank] of p.sizes) {
          L.push(`| ${label} | $${priceFor(blank).toFixed(2)} | **$${priceFor(costOf(p, blank)).toFixed(2)}** |`);
        }
      }
      L.push('');
      continue;
    }
    n += 1;
    L.push(`### ${n}. ${p.name}`, '',
      `- **Printful catalog** #${p.catalog}${p.blankModel ? ` (${p.blankModel})` : ''} · ${p.tech}`,
      `- **Artwork** ${p.art.split(' + ').map((a) => `\`${a}.png\``).join(' + ')}`,
      `- **Placement** ${p.place}`);
    if (p.tier) L.push(`- **Colours** ${p.tier}`);
    if (p.label) {
      L.push(`- 🏷 **Neck label** add the \`${LABEL.placement}\` placement and drop \`motifs/${LABEL.art}-black.png\` on it`,
        '  (use `-white.png` on the dark colourways). +$0.99 — already in the prices below.');
    }
    L.push('', '| Size | Cost | Price | You keep |', '|---|---|---|---|');
    for (const [label, blank] of p.sizes) {
      const cost = costOf(p, blank);
      const price = priceFor(cost);
      const shown = p.label ? `$${blank.toFixed(2)} + $${LABEL.cost.toFixed(2)}` : `$${blank.toFixed(2)}`;
      L.push(`| ${label} | ${shown} | **$${price.toFixed(2)}** | $${marginAt(price, cost).toFixed(2)} |`);
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

// --verify: re-fetch every blank from Printful's public catalog and flag drift.
// This existed only in the header comment until 8 Aug, when it turned out the
// relaxed tee and the tank had both moved a whole price rung under us — the
// relaxed tee was specced at $19.99 off a $16.95 blank while 16 of its 22
// colours had dropped to $13.69, a $3.00 gap on every sale. Costs move; a
// hand-written slate can only stay honest if something re-reads the source.
async function verify() {
  let drift = 0;
  for (const p of SLATE) {
    const j = await (await fetch(`https://api.printful.com/products/${p.catalog}`)).json();
    if (!j.result || !j.result.variants) { console.log(`⚠️  #${p.catalog} ${p.name} — catalog fetch failed`); continue; }
    const costs = j.result.variants.map((v) => +v.price);
    const live = [...new Set(costs)].sort((a, b) => a - b);
    const declared = p.sizes.map(([, b]) => b);
    // a declared cost that no longer exists anywhere in the catalog is stale
    const stale = declared.filter((b) => !live.some((c) => Math.abs(c - b) < 0.005));
    // the catalog's floor vs the slate's floor — the gap is money left behind
    const gap = Math.min(...declared) - live[0];
    // `dearest` = we deliberately price the WHOLE product off its priciest
    // colour tier, so a cheaper colour existing is the plan, not drift. Without
    // this the fitted tee cried wolf every run over a 67¢ spread it declares.
    const bad = stale.length || (gap > 0.5 && !p.dearest);
    if (bad) drift += 1;
    console.log(`${bad ? '❌' : '✅'} ${p.name}  #${p.catalog}`);
    console.log(`     catalog $${live[0].toFixed(2)}–$${live[live.length - 1].toFixed(2)} · slate $${Math.min(...declared).toFixed(2)}–$${Math.max(...declared).toFixed(2)}`);
    if (stale.length) console.log(`     ⚠️  no variant costs ${stale.map((b) => '$' + b.toFixed(2)).join(', ')} any more`);
    // both sides go through costOf, or a labelled garment looks like it drifted
    if (gap > 0.5 && p.dearest) console.log(`     ℹ️  cheapest colour is $${gap.toFixed(2)} lower — priced off the dearest tier on purpose, that colour just keeps more`);
    else if (gap > 0.5) console.log(`     ⚠️  cheapest colour is $${gap.toFixed(2)} under the slate's floor → could sell at $${priceFor(costOf(p, live[0])).toFixed(2)} not $${priceFor(costOf(p, Math.min(...declared))).toFixed(2)}`);
  }
  console.log(`\n${drift ? `${drift} product(s) drifted — re-read the colour tiers before clicking` : 'no drift'}`);
}

if (process.argv[1] && process.argv[1].endsWith('shop-slate.js')) {
  if (process.argv.includes('--verify')) {
    await verify();
  } else if (process.argv.includes('--list')) {
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
      if (p.label) console.log(`        🏷 ${LABEL.art} in ${LABEL.placement} (+$${costOf(p, 0).toFixed(2)})`);
      for (const [label, blank] of p.sizes) {
        const cost = costOf(p, blank);
        const price = priceFor(cost);
        low = Math.min(low, price); high = Math.max(high, price);
        console.log(`        ${pad(label, 14)} cost $${pad(cost.toFixed(2), 7)} → $${pad(price.toFixed(2), 7)} keeps $${marginAt(price, cost).toFixed(2)}`);
      }
    }
    console.log(`\n${SLATE.length} products · $${low.toFixed(2)} – $${high.toFixed(2)}`);
  }
}
