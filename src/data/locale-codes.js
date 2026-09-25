// 🌍 THE LANGUAGE PAGES' REGISTRY — one row per language page (/nl/, /ja/ …), and everything that lists the languages
// reads it: the pages (src/data/locales.js adds each language's words), the hreflang mesh, the language switch, the
// sitemap and the copy gate (tools/copy-jobs.mjs, one rulebook for every language). No JSON imports here, so the Node
// tools can read it too. A new language = a row here + src/data/copy/locales/<code>.json.
//
// 25 Sep 2026, Trym: "upgrade all international pages, and add more big languages that probably searches for the banana".
// it, pl, ja and ko came in on real search demand in their own words (DataForSEO, Sep 2026): ダンシングバナナ, バナナ ミーム,
// 춤추는 바나나, meme banana, banana che balla, banan meme, tańczący banan.
export const LOCALES = [
  { code: 'nl', name: 'Nederlands', og: 'nl_NL' },
  { code: 'es', name: 'Español', og: 'es_ES' },
  { code: 'pt', name: 'Português', og: 'pt_BR' },
  { code: 'fr', name: 'Français', og: 'fr_FR' },
  { code: 'de', name: 'Deutsch', og: 'de_DE' },
  { code: 'it', name: 'Italiano', og: 'it_IT' },
  { code: 'pl', name: 'Polski', og: 'pl_PL' },
  { code: 'ru', name: 'Русский', og: 'ru_RU' },
  { code: 'ja', name: '日本語', og: 'ja_JP' },
  { code: 'ko', name: '한국어', og: 'ko_KR' },
];

// the English GIF page first: it is the hub the language pages hang off, and hreflang's x-default
export const LANG_LINKS = [
  { code: 'en', href: '/dancing-banana-gif-meme/', name: 'English' },
  ...LOCALES.map((l) => ({ code: l.code, href: `/${l.code}/`, name: l.name })),
];
