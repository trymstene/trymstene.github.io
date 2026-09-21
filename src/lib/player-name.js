// 🔤 THE ONE RULE FOR A NAME A PLAYER CHOSE (21 Sep 2026).
//
// Trym, after the address book showed its first real stranger — "𝐃𝐉𝐂𝐎𝐎𝐊𝐈𝐄", in mathematical bold:
//   *"fix the name so it renders in the pixel font — we cant support all kinds of ascii symbols and
//   weird charsets — we should probably write that in as a rule everywhere so we avoid things
//   breaking because users and kids format their usernames / pass names in crazy ways"*
//
// ⭐ THE RULE IS NOT ARBITRARY: IT IS THE FONT'S OWN MANIFEST. public/css/fonts.css self-hosts
// Archivo Black and Nunito as **latin + latin-ext only**, and every @font-face there declares its
// unicode-range. A character outside those ranges is not "disallowed by policy" — the browser
// genuinely has no glyph for it and silently falls back to the system font, which in a pixel world
// reads as a broken name rather than a stylish one. So the allowed set below IS that range.
//
// ⭐ AND IT FOLDS RATHER THAN REFUSES, which is the whole difference between this and a blocklist.
// NFKC maps every formatting stunt back to the letters underneath — 𝐃𝐉𝐂𝐎𝐎𝐊𝐈𝐄 → DJCOOKIE,
// Ｆｕｌｌｗｉｄｔｈ → Fullwidth, ⓒⓘⓡⓒⓛⓔⓓ → circled, 𝓈𝒸𝓇𝒾𝓅𝓉 → script — so the player KEEPS the name they
// chose, in a form the world can draw. It is the composed form (NFKC, not NFKD) on purpose: NFKD
// would split "Renée" into an e and a floating accent and the next step would eat it.
//
// ⚠️ IT IS NOT A MODERATION FILTER. Nothing here judges what a name says; that is `dirty()` and the
// strike list in worker-rave, and they run beside this, not instead of it.

export const NAME_MAX = 24;

// 🎨 what the shipped fonts can actually draw, from their own unicode-range in public/css/fonts.css:
//   U+0020–007E  the printable ASCII a keyboard makes
//   U+00A0–00FF  Latin-1: é ø ñ å ü ç — the accents this world's players actually have
//   U+0100–024F  Latin Extended-A and B: ā ć ę ł ő š ż and the rest of Latin Europe
// Everything else — emoji, CJK, Cyrillic, Greek, the mathematical alphabets, zero-widths and the
// bidi overrides up in U+200x — has no glyph here and is dropped.
// ⚠️ IF THE FONTS EVER GAIN A SUBSET, THIS WIDENS WITH THEM AND NOT BEFORE.
const DRAWABLE = /[ -~ -ÿĀ-ɏ]/;
// the zalgo stack: marks that survived NFKC because nothing could compose them
const MARKS = /[̀-ͯ᪰-᫿⃐-⃰︠-︯]/g;

/**
 * Fold a player-chosen name into something the world can draw.
 * Returns '' when nothing survives — the caller decides what to show instead, because the right
 * fallback differs by surface (a house name, an address, "a banana").
 */
export function cleanName(raw, max = NAME_MAX) {
  let s = String(raw == null ? '' : raw);
  try { s = s.normalize('NFKC'); } catch (e) { /* an engine without ICU keeps the raw string */ }
  s = s.replace(MARKS, '');
  // keep only what the fonts carry, then tidy the spacing the strip may have left behind
  s = s.split('').filter((c) => DRAWABLE.test(c)).join('');
  s = s.replace(/\s+/g, ' ').trim().slice(0, max).trim();
  // ⚠️ a name that is ONLY punctuation is not a name — "•••" and "___" read as a broken row rather
  // than as a person, and they are the other half of the same stunt.
  if (!/[a-zA-Z0-9À-ɏ]/.test(s)) return '';
  return s;
}

/** true when a name would survive unchanged — for a gate or a test, never for a refusal. */
export const nameIsDrawable = (raw) => cleanName(raw) === String(raw == null ? '' : raw).trim();
