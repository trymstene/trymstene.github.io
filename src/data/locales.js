// 🌍 The language pages — the registry (src/data/locale-codes.js) with each language's words attached, for
// src/pages/[locale].astro and the sitemap. The words live in src/data/copy/locale-<code>.json under one rulebook
// (tools/copy-jobs.mjs `localeJob`, gated by tools/check-copy.mjs); nothing here holds a sentence.
//
// Each page is differentiated beyond translation (anti-duplicate, anti-cannibalization): its own search words in the
// title and h1, a self-referencing canonical (the layout), og:locale, where people in that language remember the banana
// from, and a native-name FAQ ("what is it called in <language>").
import { LOCALES } from './locale-codes.js';

const WORDS = import.meta.glob('./copy/locale-*.json', { eager: true, import: 'default' });

export const locales = LOCALES.map((l) => {
  const words = WORDS[`./copy/locale-${l.code}.json`];
  if (!words) throw new Error(`/${l.code}/ has no words: write src/data/copy/locale-${l.code}.json (tools/copy-jobs.mjs has its rules)`);
  return { ...l, words };
});
const orphans = Object.keys(WORDS).filter((p) => !LOCALES.some((l) => p === `./copy/locale-${l.code}.json`));
if (orphans.length) throw new Error(`words with no page: ${orphans.join(', ')} — add the language to src/data/locale-codes.js`);
