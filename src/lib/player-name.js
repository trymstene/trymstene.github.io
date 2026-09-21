// 🔤 THE ONE RULE FOR A NAME A PLAYER CHOSE (21 Sep 2026).
//
// Trym, after the address book showed its first real stranger — "𝐃𝐉𝐂𝐎𝐎𝐊𝐈𝐄", in mathematical bold:
//   *"fix the name so it renders in the pixel font — we cant support all kinds of ascii symbols and
//   weird charsets — we should probably write that in as a rule everywhere so we avoid things
//   breaking because users and kids format their usernames / pass names in crazy ways"*
// …and then, when the first version dropped Cyrillic, Greek and Japanese outright:
//   *"fallback font is fine, let them render"*
//
// ⭐ SO THE LINE IS NOT "CAN OUR FONT DRAW IT" — IT IS "IS IT A CHARACTER AT ALL".
// A Russian, Greek or Japanese name is a real name and renders in whatever the browser has; that is
// a fallback font, not a bug. What is refused is the stuff that is not writing: invisible
// characters, direction overrides that reorder the text AROUND the name, and mark stacks that climb
// out of their line. Those break the surface rather than merely looking different on it.
//
// ⭐ AND IT FOLDS RATHER THAN REFUSES, which is the whole difference between this and a blocklist.
// NFKC maps every formatting stunt back to the letters underneath — 𝐃𝐉𝐂𝐎𝐎𝐊𝐈𝐄 → DJCOOKIE,
// Ｆｕｌｌｗｉｄｔｈ → Fullwidth, ⓒⓘⓡⓒⓛⓔⓓ → circled, 𝓈𝒸𝓇𝒾𝓅𝓉 → script — so the player KEEPS the name they
// chose, in a form that reads. It is the composed form (NFKC, not NFKD) on purpose: NFKD would split
// "Renée" into an e and a floating accent and the mark step below would eat it.
//
// ⚠️ IT IS NOT A MODERATION FILTER. Nothing here judges what a name says; that is `dirty()` and the
// strike list in worker-rave, and they run beside this, not instead of it.
//
// ⚠️ A NAME OF UNKNOWN DIRECTION IS ISOLATED WHERE IT IS SHOWN, not here. Stripping the bidi
// controls stops a name reordering the row it sits in; `unicode-bidi: isolate` on the element is
// what keeps a right-to-left name from dragging the punctuation around it. Both halves are needed.

export const NAME_MAX = 24;

// ⛔ what is not writing, and is stripped:
//   0000–001F, 007F–009F  the control codes
//   200B, 200E, 200F, FEFF  invisibles and the bare direction marks
//   202A–202E, 2066–2069  the bidi embeddings and OVERRIDES — an RLO reverses the rest of the line,
//                         including text that is not the name, which is the one real layout attack here
//   2028, 2029            line and paragraph separators
// ⚠️ 200C and 200D (the zero-width non-joiner and joiner) are KEPT: they are load-bearing in Arabic
// and Indic scripts, and they are what holds a family emoji together.
const UNSAFE = new RegExp('[\u0000-\u001F\u007F-\u009F\u200B\u200E\u200F'
  + '\u202A-\u202E\u2028\u2029\u2066-\u2069\uFEFF]', 'g');
// combining marks — real in Devanagari, Thai, Hebrew and Arabic, and the whole of zalgo when stacked
const MARK = new RegExp('[\u0300-\u036F\u0483-\u0489\u1AB0-\u1AFF'
  + '\u1DC0-\u1DFF\u20D0-\u20F0\uFE20-\uFE2F]');

/**
 * Fold a player-chosen name into something safe to show.
 * Returns '' when nothing readable survives — the caller decides the fallback, because the right
 * one differs by surface (a house name, an address, "a banana").
 */
export function cleanName(raw, max = NAME_MAX) {
  let s = String(raw == null ? '' : raw);
  try { s = s.normalize('NFKC'); } catch (e) { /* an engine without ICU keeps the raw string */ }
  s = s.replace(UNSAFE, '');
  // ⚠️ ZALGO IS A RUN LENGTH, NOT A CHARACTER. Dropping every combining mark would break real names
  // in half the world's scripts; a stack of nine climbs out of the row and over the line above it.
  // Two in a row is more than any script needs and less than any stunt wants.
  let run = 0;
  s = s.split('').filter((c) => {
    if (!MARK.test(c)) { run = 0; return true; }
    run += 1;
    return run <= 2;
  }).join('');
  s = s.replace(/\s+/g, ' ').trim().slice(0, max).trim();
  // ⚠️ a name that is ONLY punctuation is not a name — "•••" and "___" read as a broken row rather
  // than as a person. \p{L}\p{N} so this asks "is there a letter or a number in any script at all",
  // not "is there a Latin one" — the first version of this rejected every Japanese name outright.
  try { if (!/[\p{L}\p{N}]/u.test(s)) return ''; } catch (e) { if (!/[a-zA-Z0-9]/.test(s)) return ''; }
  return s;
}

/** true when a name would survive unchanged — for a gate or a test, never for a refusal. */
export const nameIsClean = (raw) => cleanName(raw) === String(raw == null ? '' : raw).trim();
