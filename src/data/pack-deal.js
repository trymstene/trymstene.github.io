// 🎟 THE PACK PRICES AND THE SET DEAL — one truth for every surface that names
// them, including the nav's cart drawer, which is loaded on every page and must
// stay tiny: this file imports nothing (sticker-packs.js re-exports it and
// asserts the art manifest agrees).
//
// The deal itself lives in Shopify as an automatic discount — $9.93 off once
// eight different packs are in the cart — so the cart is the judge; these
// numbers only let the pages promise what the cart will do.
export const PACK_PRICE = 9.99;
export const SET_SIZE = 8;
export const SET_PRICE = 69.99;
// the Shopify handles as created on 5 Sep 2026
export const packHandle = (n) => `dancing-banana-official-sticker-pack-${n}`;
// which pack a handle is (0 = not a pack). Shopify builds the handle from the
// title, so the site keys on the tail and survives a brand prefix in front.
export function packNumber(handle) {
  const m = /sticker-pack-(\d+)/.exec(handle || '');
  return m ? +m[1] : 0;
}
