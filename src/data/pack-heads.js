// 🎟 THE DOWNLOAD CARD'S HEADLINES — one per card, drawn at random, each one
// measured. Trym, 6 Sep 2026: "the headline is what's read. And the price.
// Rotate the different messages on popups - and then we track them to see if
// any of them works better than others."
//
// The key becomes the GA4 item list name (`card_<key>`) on the card's
// view_item_list / select_item, which is a dimension the Data API will pair
// with viewed-in-list and clicked-in-list — so Pulse prints shown → tapped per
// headline. (A custom `variant` param would need a registered dimension.)
// ⚠️ Add a line = add a key. Never rename a key: its history dies with it.
// Shared by src/lib/make-it-real.js (the card) and src/scripts/pulse-rooms.js
// (the desk), so the desk always knows the words behind a key.
export const PACK_HEADS = [
  { key: 'official', text: 'Official Banana sticker pack' },
  { key: 'get', text: 'Get the official Banana stickers' },
  { key: 'unique', text: 'Unique Banana stickers for your laptop' },
  { key: 'only', text: 'Only here: official Banana stickers' },
  { key: 'name', text: 'The dancing banana sticker pack' },
];
export const CARD_LIST = 'card_';   // item_list_name prefix
export const headText = (key) => { const h = PACK_HEADS.find((x) => x.key === key); return h ? h.text : ''; };
