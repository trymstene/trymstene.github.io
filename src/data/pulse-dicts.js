// 📚 THE PULSE DICTIONARIES — the definitions the payloads never carry.
//
// Moved verbatim out of worker-pulse's page. Every string here is written by
// hand and none of it is generated: the funnel step tooltips, the human name
// for a download surface, the ONE QUESTION each area of the world is asked,
// and which storefronts take real money.
//
//   FUNNELS   [0] custom banana line · [1] official merch · [2] the support
//             ask (defined but never rendered in the old page)
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
  // ☕ THE SUPPORT TEST — the card's third life. Merch ask (30 Jul) →
  // world/Discord warm-up (12 Aug) → an honest buy-me-a-coffee ask (27 Aug):
  // "I make nothing on the banana." One message, $5 (= the BMAC coffee
  // price), on EVERY download surface incl. the gallery (first wired 27 Aug).
  // The question this funnel answers: will this audience pay ANYTHING?
  // Clicks land on our own /pay/tip — the MONEY shows in Polar, not
  // here; this measures willingness. Read it in people, never events.
  [['offer_shown','Got the support card ☕',
    'The download click opened the card BEFORE any file moved. Since 27 Aug it makes one honest ask: "I make nothing on the banana — buy me a coffee, $5." The file is its no-thanks button.'],
   ['offer_support','Clicked buy-me-a-coffee 💛',
    'Tapped a tip amount through to our own checkout. This over "Got the support card" = the willingness rate — the number the whole test exists to learn. Actual money lands in Polar, not in GA4.'],
   ['offer_skip','Just took the file',
    'Pressed no-thanks and the download flowed — still a happily served visitor, and the answer the test expects most often.']]];

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
  {key:'rave',  name:'The rave',  icon:'🩩', door:'rave_join',
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
