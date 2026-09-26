// 🧵 THE TWO SMALL SHEETS, INLINED (26 Sep 2026, the front-page speed audit). public/css/fonts.css (the @font-face
// table, 0.9 KB gzipped) and public/css/paper.css (the paper notes, 1.4 KB) were two more render-blocking requests on
// every page for 2.3 KB. BaseLayout writes them into the <head>, minified once per build here; the files stay in
// public/ as the source (tools/check-names.mjs reads fonts.css) and for anything that links them directly.
import { transform } from 'esbuild';
import fonts from '../../public/css/fonts.css?raw';
import paper from '../../public/css/paper.css?raw';

export const INLINE_CSS = (await transform(fonts + '\n' + paper, { loader: 'css', minify: true, legalComments: 'none' })).code;
