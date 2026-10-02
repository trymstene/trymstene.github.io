// 🪪 PROTECTED NAMES (2 Oct 2026). Trym, after a stranger walked past his homestead as "Trym Stene": *"add protection on my
// name, its a bit silly if players thats using my name is sent letters and stuff"*.
//
// A short list of names that belong to ONE pass each: the banana guy's own, and the names that speak for the house. Matched
// on a SKELETON — the letters left once case, spaces, punctuation, accents and the usual stand-ins are folded away (0→o,
// 1→i, 5→s, rn→m …) — so "Tryrn 5tene" and "TRYM_STENE" are "Trym Stene". The banana guy's names are protected wherever
// they sit inside a name ("Real Trym Stene"); the house's words only as the whole name, so "Badminton" is never "admin".
//
// ⭐ ONE FILE, FOUR READERS: the pass page and the homestead (to say no while you type), worker-pass (which clears a name a
// pass may not carry, and hands the one pass that may a signed NAME TOKEN) and worker-rave (whose rooms, address book,
// signs and guestbooks let a protected name through only beside that token). Who may carry one is the pass worker's word,
// never this file's.
// ⚠️ plain "Trym" is NOT protected: it is a Norwegian first name, and other Tryms play here.
const INSIDE = ['trym stene', 'dj sentry'];
const WHOLE = ['the banana guy', 'banana hq', 'bananabot', 'banana bot', 'old peel',
  'admin', 'administrator', 'moderator', 'mod', 'staff', 'official', 'support', 'system'];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's' };
const MARKS = /[\u0300-\u036f]/g;
// the letters a name is made of, once everything that only DRESSES them is folded away
export function nameSkeleton(s) {
  let b = String(s || '');
  try { b = b.normalize('NFKD').replace(MARKS, ''); } catch (e) {}   // unfolded FIRST: a letter in a fancy font has no lower case of its own
  b = b.toLowerCase().replace(/[0134578@$]/g, (c) => LEET[c] || c).replace(/[^a-z]/g, '');
  return b.replace(/rn/g, 'm').replace(/vv/g, 'w').replace(/l/g, 'i');
}
const IN = INSIDE.map(nameSkeleton), WH = new Set(WHOLE.map(nameSkeleton));
export function isProtectedName(s) {
  const k = nameSkeleton(s);
  return !!k && (WH.has(k) || IN.some((p) => k.includes(p)));
}
