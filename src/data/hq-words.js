// 📖 THE HQ DICTIONARY — every code a worker sends to Banana HQ, in plain words.
//
// 22 Sep 2026, Trym: "something called qa is at the top of the list - i dont understand what that
// is … theres a lot of things vaguely named". A worker speaks in keys (`wish`, `deny`, `src`) because
// a key is what a rule table needs; the desk speaks to a reader with coffee. Nothing a worker sends
// reaches the screen without passing through here, and a key this file has never met is humanised
// and marked, so it gets a name next time instead of hiding as a word.
//
//   FAUCET   the source tag `s` on a coins_earned row — the RULES table in worker-pass, by name
//   AREA     the area tag `a` — areaOf() in banana-pass.js, plus the places the desk lists
//   REFUSAL  the reason `r` on a refused row — ruleGate / refundGate / tapeIn in worker-pass
//   SOURCE   the chip every section wears: where a number comes from, in one word

export const FAUCET = {
  road: 'the welcome road', stall: 'the farm stall', shed: 'the shed, sold back', dish: 'cooked dishes',
  knit: 'the tailor', rehome: 'animals sold back', quest: 'the questline', window: 'the coin window',
  bottle: 'drift bottles', fishing: 'fishing', dig: 'digging at the bay', wish: 'the wishing fountain',
  weed: 'pulled weeds', egg: 'eggs in the park', fix: 'town fixes', object: 'cursed objects handed in',
  tips: 'café tips', spot: 'the spotlight', floorquest: 'floor quests', job: 'the weekly cheque',
  qa: 'test tabs (not play)', unnamed: 'no source named',
};
export const AREA = {
  rave: 'the rave', park: 'the park', beach: 'Banana Bay', forge: 'the forge', homestead: 'the homestead',
  builder: 'the builder', pass: 'the pass page', town: 'Banana Town', site: 'the site', unknown: 'unknown place',
  stand: 'the Banana Stand', arcade: 'the arcade', post: 'the post office', qa: 'test tabs (not play)',
};
export const REFUSAL = {
  area: 'a place not allowed to pay', src: 'no source named', deny: 'a test grant', max: 'one grant over its cap',
  day: 'the daily cap', total: 'the lifetime cap', funds: 'not enough coins', owned: 'already owned',
  price: 'under the price', item: 'an unknown item',
};
export const SOURCE = {
  live: 'LIVE', goog: 'GOOGLE', serv: 'SERVER', mail: 'INBOX', shop: 'SHOPIFY', git: 'GITHUB',
};
// the plain name, or the key made readable and flagged so it gets a real one
export const word = (dict, k) => {
  const s = String(k == null ? '' : k);
  if (dict[s]) return dict[s];
  return (s.replace(/[_-]+/g, ' ').trim() || '?') + ' · no name yet';
};
export const faucet = (k) => word(FAUCET, k);
export const area = (k) => word(AREA, k);
export const refusal = (k) => word(REFUSAL, k);
// the windows the Google floors can show, as a reader says them
export const WINDOW_WORDS = { today: 'today', yesterday: 'yesterday', '6daysAgo': 'last 7 days', '27daysAgo': 'last 28 days' };
export const windowWord = (from, to) => (to === 'today' && from === 'today') ? 'today'
  : (from === 'yesterday' && to === 'yesterday') ? 'yesterday'
    : WINDOW_WORDS[from] || (from + ' → ' + to);
