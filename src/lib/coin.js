// 🪙 THE BANANACOIN IS OURS (28 Sep 2026; design library §45). Trym, once for the homestead's prices ("the REAL bananacoin,
// never the stock emoji") and again on the Banana Phone: "The «Sell goods» on Banana Phone shows a moon emoji - we do have
// our own Banana Coin symbol / icon". An iPhone draws the stock 🪙 as a grey disc. So a line may still SAY 🪙 — it is how a
// toast or a float writes its coin — and every surface that writes a line draws each one as the Banana Stand's gold coin.
// tools/check-design.mjs holds the rest of the rule: no 🪙 in a page's markup, and every world toast and float goes through here.
export const COIN_SRC = '/assets/banana-stand/coin.png';
// the 44-px stand coin, smooth-downscaled to the line it sits in (pixelated at text size, it ate the emboss)
const FIT = 'width:auto;height:1.1em;vertical-align:-0.2em';
export const coinImg = (alt) => '<img src="' + COIN_SRC + '" width="14" height="14" alt="' + (alt || '') + '" style="' + FIT + '">';
// a line into an element as TEXT, each 🪙 drawn as the coin. ⚠️ never innerHTML: a line can carry a player's words
export function coinText(el, s) {
  const parts = String(s == null ? '' : s).split('🪙');
  el.textContent = parts[0];
  for (let i = 1; i < parts.length; i++) {
    const img = document.createElement('img');
    img.src = COIN_SRC; img.width = img.height = 14; img.alt = 'bananacoins'; img.style.cssText = FIT;
    el.append(img, parts[i]);
  }
}
// …and inside markup the code builds itself (internal strings only)
export const coinHtml = (s) => String(s).split('🪙').join(coinImg('bananacoins'));
