// 🏡 THE FRONT PAGE'S HOMESTEADS: WHICH yards, and in what order today. tools/build-yard-cards.mjs takes the photos;
// this is the pick alone, pure, so tests/home-yards.spec.mjs can hold its rules. Design library §50.
import { cleanName } from '../src/lib/player-name.js';

export const ACTIVE_DAYS = 14;              // saved within two weeks
export const CAME_BACK = 12 * 3600e3;       // …and saved again at least 12 h after it was made: one sitting is not a homestead yet
export const FURNISHED = 10;                // enough in it to be worth a photo (stage 1, two animals and two things is 12)
export const QA = /^(testy|trym|proofy|qa-)/;   // the walks' yards, the proof's, and Trym's own: not "built by visitors like you"

// FNV-1a into a splitmix32 finish: a steady number in (0, 1) for a (day, yard) pair
export function rand(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  let z = (h + 0x9e3779b9) | 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
  z ^= z >>> 16;
  return ((z >>> 0) + 0.5) / 4294967296;
}

const len = (x) => (Array.isArray(x) ? x.length : 0);
// what is in a yard, from its public doc: the house's stage, things, animals, crops, dug soil, fences
export function furnished(d) {
  const crops = (d.soil || []).filter((c) => c && c.crop).length;
  return 4 * (d.stage || 0) + Math.min(len(d.items), 40) + 3 * Math.min(len(d.animals), 12)
    + 2 * Math.min(crops, 12) + Math.min(len(d.soil), 24) / 2 + Math.min(len(d.fence), 72) / 6;
}
// a save in the last two days counts in full, then it fades to a third over the next fortnight
export const recency = (at, now) => { const days = (now - at) / 864e5; return days <= 2 ? 1 : Math.max(0.35, 1 - (days - 2) / 18); };

// the name as the page prints it: the one name rule, and the default "<name>'s Homestead" made whole again where the
// yard's 24-letter cap cut it mid-word ("KiwiRainbowRain's Homest")
export function shown(raw) {
  let s = cleanName(raw || '', 40);
  if (String(raw || '').length >= 23) s = s.replace(/(['’]s) Homes(?:t|te|tea)?$/i, '$1 Homestead');
  return s.replace(/'/g, '’');
}

// the census rows worth fetching a doc for
export function activeRows(list, now) {
  return (list || []).filter((e) => e && e.slug && !e.qa && !QA.test(e.slug)
    && (e.stage || 0) >= 1 && now - (e.updated || 0) < ACTIVE_DAYS * 864e5
    && (e.updated || 0) - (e.created || 0) >= CAME_BACK);
}

// [{ e: census row, d: public doc }] → today's order: one yard per owner (the fuller one), then a weighted shuffle
// seeded by the day (Efraimidis–Spirakis: key = u^(1/weight)), so the liveliest come up most days and every one in turn
export function dayOrder(rows, day, now) {
  const byOwner = new Map();
  for (const x of rows) {
    const stuff = furnished(x.d);
    const k = x.e.owner || x.e.slug;
    if (!byOwner.has(k) || byOwner.get(k).stuff < stuff) byOwner.set(k, { ...x, stuff });
  }
  return [...byOwner.values()].map((x) => ({
    slug: x.e.slug, raw: x.d.name || x.e.name || '', name: shown(x.d.name || x.e.name) || 'A homestead',
    stage: x.d.stage || x.e.stage || 1, stuff: x.stuff,
    key: rand(day + ':' + x.e.slug) ** (1 / Math.max(0.5, x.stuff * recency(x.e.updated, now))),
  })).sort((a, b) => b.key - a.key);
}

// the pills: the rest of the order, one per name (three "My Homestead" pills read as a bug)
export function morePills(order, featured, max) {
  const names = new Set(featured.map((f) => f.name.toLowerCase()));
  const out = [];
  for (const y of order) {
    if (out.length >= max) break;
    if (featured.some((f) => f.slug === y.slug) || names.has(y.name.toLowerCase())) continue;
    names.add(y.name.toLowerCase());
    out.push({ slug: y.slug, name: y.name });
  }
  return out;
}
