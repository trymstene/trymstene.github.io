// 📚 THE PULSE DICTIONARIES — the definitions the payloads never carry.
//
// Moved verbatim out of worker-pulse's page. Every string here is written by
// hand and none of it is generated: the funnel step tooltips, the human name
// for a download surface, the ONE QUESTION each area of the world is asked,
// and which storefronts take real money.
//
//   FUNNELS   [0] custom banana line · [1] official merch · [2] the pack
//             card (drawn as one question with two answers, not a funnel)
//   DL_NAMES  longest prefix wins; a deeper path appends its slug
//   AREAS     key · name · icon · door event · the question
//   SHOPS     steps, where it stands, and `real` for real money
//
// ⚠️ CUSTOM vs OFFICIAL is told apart PURELY by event name — there is no
// product-type dimension anywhere. And the last two steps of the custom line
// are marked store-wide because Shopify fires them for both.

export const FUNNELS=[
  [['sessions','On the site',
    'A visit to trymstene.com — any page, any door. Everyone starts here.'],
   ['builder_boot','Banana danced',
    'The make-a-banana page finished loading and the banana danced on their screen — the TRUE page-load signal. Counting starts 14 Jul (new event).'],
   ['builder_start','Customized it',
    'They touched a control — a hat, a caption, surprise me… their first change to the banana. This is an INTERACTION, not a page load (it was mislabeled "Builder loaded" until 14 Jul).'],
   ['sticker_pdp_view','Product page',
    'They clicked to order their design and landed on a custom product page — tee, sticker or magnet, their banana on it.'],
   ['sticker_pdp_checkout','Hit ORDER',
    'They clicked the big ORDER button on a custom product page.'],
   ['pdp_add_to_order','Added to cart',
    'They put the design into the shared cart (custom + official ride one cart since 28 Aug) — the drawer opened to confirm.'],
   ['checkout_redirect','→ Shopify checkout',
    'Their design uploaded fine and the browser sent them off to the Shopify checkout.'],
   ['begin_checkout','Checkout started ⌁store-wide',
    'Shopify saw a checkout page actually open. Store-wide: custom products AND official merch count together here.'],
   ['purchase','PAID 💰 ⌁store-wide',
    'Shopify reported real money paid. Store-wide — and stays 0 until the Shopify→GA4 purchase link is fixed (your errand in the G&Y channel).']],
  [['sessions','On the site',
    'A visit to trymstene.com — any page, any door. Everyone starts here.'],
   ['shop_view','Browsed the shop',
    'They opened the Banana Shop front page (/shop/) and saw the product grid. Counting starts 13 Jul — the event is new.'],
   ['select_item','Picked a product',
    'They clicked a product tile in the Banana Shop (/shop/).'],
   ['view_item','Product page',
    'They opened a merch product page — mug, tee, and friends.'],
   ['transactions','Purchases 💰',
    'Completed paid orders as GA4 counts them — rides the same broken Shopify purchase link, so 0 for now.']],
  // 🎟 THE PACK CARD — the card's fourth life. Merch ask (30 Jul) →
  // world/Discord warm-up (12 Aug) → buy-me-a-coffee (27 Aug, 2 takers) →
  // a sticker pack (5 Sep): the one product nobody else has, shown at the
  // moment the free file is granted. Read it in people, never events.
  [['offer_shown','Got the pack card 🎟',
    'The download click opened the card BEFORE any file moved. Since 5 Sep it shows one of the eight sticker packs, with the other seven a tap away. The file is its no-thanks button.'],
   ['offer_pack','Tapped a pack 🎟',
    'Tapped through to a pack’s shop page. This over "Got the pack card" = the take rate — the number the card exists to learn. Sales land in Shopify, not in GA4 (the purchase link is still broken).'],
   ['offer_skip','Just took the file',
    'Pressed no-thanks and the download flowed — still a happily served visitor, and the most common answer.']]];

export const DL_NAMES=[
  ['/dancing-banana-gif-meme/','The GIF page'],
  ['/dancing-banana-wallpaper/','Wallpapers'],
  ['/dancing-banana-remixes/','Remixes'],
  ['/banana-memes/','The gallery'],
  ['/make-a-banana/','The builder'],
  ['/pixel-forge/','The Forge'],
  ['/pass/','The pass'],
  ['/nl/','🇳🇱 Dutch'], ['/es/','🇪🇸 Spanish'], ['/pt/','🇧🇷 Portuguese'],
  ['/fr/','🇫🇷 French'], ['/de/','🇩🇪 German'], ['/ru/','🇷🇺 Russian'],
];

export const AREAS=[
  {key:'rave',  name:'The rave',  icon:'🪩', door:'rave_join',
   q:'Do people STAY? — joins, and what they did once the music started'},
  {key:'park',  name:'The park',  icon:'🌳', door:'park_join',
   q:'Do they COME BACK? — gardening is the only loop that needs a return visit'},
  // ⚠️ the door is beach_join (fires once at spawn, like park_join) — NOT
  // beach_multiplayer, which only fires when two people are here AT ONCE and
  // printed "1 visit" above 197 digs when I first wired this.
  {key:'beach', name:'Banana Bay', icon:'🏖', door:'beach_join',
   q:'Do they PROGRESS? — shells, tickets, digging: collection is the hook'},
  // 🏡 the door carries via/claimed/stage; homestead_claim is the conversion
  {key:'homestead', name:'The Homestead', icon:'🏡', door:'homestead_open',
   q:'Do they SETTLE? — claim a sign, furnish, and come home again tomorrow'},
  {key:'forge', name:'Pixel Forge', icon:'🎨', door:'forge_open',
   q:'Do they FINISH and SUBMIT? — an unfinished item helps nobody'},
  {key:'stand', name:'The Banana Stand', icon:'🏪', door:'stand_counter',
   q:'Do they SPEND? — coins buy cosmetics, and the till is the proof'},
];

// 🏳 FLAGS, AND THE MACHINE THAT CANNOT DRAW THEM.
//
// Windows ships no flag-emoji font, so a flag pair falls back to the bare
// letters "NO" and the ticker then reads "no grabbed the GIF ×3". The desk is
// read on Windows, so detect it once — a supported pair renders as ONE glyph,
// an unsupported one as two letters — and bracket the code, which is not a word.
let FLAGOK = null;
function flagsDraw() {
  try {
    const g = document.createElement('canvas').getContext('2d');
    g.font = '20px sans-serif';
    return g.measureText(String.fromCodePoint(127475, 127476)).width < g.measureText(String.fromCodePoint(127475)).width * 1.7;
  } catch (e) { return true; }
}
export const flag = (cc) => {
  if (FLAGOK === null) FLAGOK = flagsDraw();
  if (!/^[A-Z]{2}$/.test(cc || '')) return FLAGOK ? '🏳' : '[??]';
  return FLAGOK
    ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0)))
    : '[' + cc + ']';
};

// a place, named once: the bracket fallback already SAYS the country code,
// so appending it again printed rows reading "[US] US".
export const place = (cc, name) => {
  const f = flag(cc);
  if (name && name !== cc) return f + ' ' + name;
  return f.charAt(0) === '[' ? f : f + ' ' + cc;
};

// 🌍 WHO IS IN THE WORLD RIGHT NOW.
//
// ⚠️ GA4's REALTIME api has no page-path dimension. `unifiedScreenName` is the
// page TITLE, so the live payload's `pages[].page` is a title too. The old page
// prefix-matched '/rave/' against it and therefore counted ZERO people in the
// world for as long as it existed — the number was never once right.
//
// So we match titles, and `page` is the built page whose <title> must still
// start with `title` — tools/check-pulse-areas.mjs fails the build otherwise.
export const WORLD_TITLES=[
  {page:'rave/',      title:'The Banana Rave'},
  {page:'park/',      title:'The Park'},
  {page:'beach/',     title:'Banana Bay'},
  {page:'homestead/', title:'The Homestead'},
];
export const inWorld=(t)=>WORLD_TITLES.some((w)=>String(t||'').startsWith(w.title));

export const SHOPS=[
  // ⚠️ stand_buy_try is NOT a step before stand_buy — it fires when someone
  // wanted an item and did not have the coins. Sequencing them printed
  // "bought: 130% of the step above". It is a SIBLING of the buy, so it hangs
  // off the side as the demand list it always was.
  {name:'The Banana Stand', where:'off the rave floor', icon:'🏪', real:false,
   steps:[['stand_counter','reached the counter'],['stand_item_view','looked at an item'],
          ['stand_buy','bought one']],
   aside:['stand_buy_try','wanted one but was short on coins']},
  {name:'Inka’s merch cart', where:'the park', icon:'🧃', real:true,
   steps:[['stand_cart_view','stepped in'],['stand_cart_click','tapped a product']]},
  {name:'The Beach Hut', where:'Banana Bay', icon:'🏖', real:true,
   steps:[['beach_hut_view','walked in'],['beach_hut_click','tapped a product']]},
  {name:'The seed shop', where:'the park garden', icon:'🍄', real:false,
   steps:[['park_seedshop','opened the seeds'],['park_plant','planted one']]},
  {name:'The LED club screen', where:'the rave', icon:'📺', real:false,
   steps:[['rave_screen_ad','clicked a house ad']]},
];
