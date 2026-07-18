// THE BANANA PASS — patch catalog. Players read "badge" everywhere; the code,
// ids, storage and GA events keep saying patch (the JELLY naming precedent).
// PURE DATA (safe for Astro frontmatter):
// the Card server-renders every patch as a dark slot with its hint; the client
// lights up the earned ones from localStorage. Patches are MOMENTS, not
// metrics: one-time, never expire, no streaks, no leaderboards.
//
// icon: a PixelIcon name (the site's icon language). Adding a patch here is
// enough — earning happens wherever the moment lives via passPatch(id).
export const PATCHES = [
  { id: 'maker',     icon: 'palette',  title: 'Maker',          hint: 'Take your first banana home from the workshop.' },
  { id: 'chaos',     icon: 'dice',     title: 'Agent of Chaos', hint: 'Let the dice dress the banana.' },
  { id: 'emoji',     icon: 'chat',     title: 'Chat Weapon',    hint: 'Download a chat-sized emoji GIF.' },
  { id: 'spreader',  icon: 'link',     title: 'Spreader',       hint: 'Share a banana with the world.' },
  { id: 'smith',     icon: 'bolt',     title: 'Pixel Smith',    hint: 'Forge an emoji from raw pixels.' },
  { id: 'exhibitor', icon: 'note',     title: 'Exhibitor',      hint: 'Submit a piece to the banana wall.' },
  { id: 'raver',     icon: 'sparkle',  title: 'First Night',    hint: 'Step onto the dance floor.' },
  { id: 'survivor',  icon: 'globe',    title: '30-Min Survivor',hint: 'Outlast 30 minutes at the rave. Glowstick included.' },
  { id: 'round',     icon: 'coffee',   title: 'First Round',    hint: 'Be first to the bar when Barty calls happy hour.' },
  { id: 'courier',   icon: 'floppy',   title: 'The Courier',    hint: 'Run a lost record to the DJ.' },
  { id: 'spotlight', icon: 'heart',    title: 'In the Light',   hint: 'Be standing in the spotlight when it lands.' },
  { id: 'regular',   icon: 'burger',   title: 'The Regular',    hint: 'Show up on five different days.' },
  { id: 'patron',    icon: 'tag',      title: 'Sticker Patron', hint: 'Your banana, on real vinyl.' },
  { id: 'golden',    icon: 'sparkle',  title: 'The Golden One', hint: 'Once in a golden while, something rare hits the floor. Be there.' },
  { id: 'chain',     icon: 'link',     title: 'Chain Chaser',   hint: 'Keep a ten-pickup chain alive on the dance floor.' },
  { id: 'hype',      icon: 'bolt',     title: 'Full of Jelly',  hint: 'Fill the JELLY meter and drop the floor yourself.' },
  { id: 'night1',    icon: 'coffee',   title: 'The First Shift',hint: "Work Barty's welcome-night jobs, start to finish." },
  { id: 'og',        icon: 'banana',   title: 'OG',             hint: 'Was here before the world arrived.' },
  { id: 'collector', icon: 'sparkle',  title: 'Collector',      hint: 'Catch a wearable drop on the dance floor.' },
];

// THE GEAR ROW — earned wearables, the pass's closet. `extra` is the engine
// extras id it toggles on your banana (bb-last); proof of earning is either a
// localStorage `flag` or a minted pass `patch`. PURE DATA.
// a gear slot is `extra` (an extras id) OR `hat`/`glasses` (a head slot). `by`
// credits the maker when the item is a community/booth drop.
export const GEAR = [
  { id: 'glowstick', extra: 'glowstick', flag: 'rv-glowstick',
    title: 'The Glowstick', hint: 'Survive 30 minutes on the dance floor — yours forever.' },
  { id: 'goldbanana', extra: 'goldbanana', patch: 'golden',
    title: 'The Golden Banana', hint: 'Catch the rarest thing that ever hits the floor. Hold it forever.' },
  { id: 'djheadphones', hat: 'djheadphones', flag: 'rv-djheadphones', by: 'Barty',
    title: 'DJ Headphones', hint: 'Catch them on the dance floor at the rave — straight from Barty’s booth.' },
];

// visitors before this date mint the OG patch automatically (set it to the
// real launch day when the launch happens)
export const OG_CUTOFF = '2026-08-01';

// ---- REP & RANKS (THE WHY BUILD, 12 Jul) ----
// Everything you DO at the rave pays REP; REP climbs club RANKS. Ranks never
// decay (no-punishing doctrine — Trym's core rule) and rank-ups will pay
// wearable drops + privileges via the ownership stack, never music drops.
// rep rides pass-v1.stats.rep → syncs cross-device (stats merge = max).
// Thresholds: an active ~20-min night ≈ 150–300 rep — second rank on night
// one, The Regular after a handful of real nights, the top is a journey.
// LEVELS 1–99 (Trym: "a visible progress bar you always need to fill is
// extremely powerful — titles at brackets"). The curve front-loads the hook:
// a first real night (~200 rep) reaches ~level 5 with several level-ups;
// 99 is a legend's journey (~25k rep). levelFor returns {level, into, need}
// so every surface can draw the same bar.
// CALIBRATED against real play (Trym: 30 min → level 34 on the first curve;
// the floor pays ~145 rep/min now that jelly never stops): first level in a
// minute, ~level 5 by minute 8 (first-night title ✓), ON THE LIST → THE
// REGULAR ≈ 1.3h, VIP ≈ 4h, LEGEND ≈ 11h, 99 ≈ 34 hours of actual dancing.
export const levelStep = (n) => 150 + n * 45; // rep to go from level n → n+1
export const levelFor = (rep) => {
  let n = 1, c = 0;
  while (n < 99 && rep >= c + levelStep(n)) { c += levelStep(n); n++; }
  return { level: n, into: Math.max(0, rep - c), need: levelStep(n) };
};
// title BRACKETS by level — flavor milestones, not a ladder of 99 names
export const RANKS = [
  { id: 'peel',    title: 'Fresh Peel',           at: 1 },
  { id: 'list',    title: 'On the List',          at: 5 },
  { id: 'face',    title: 'Face at the Door',     at: 10 },
  { id: 'regular', title: 'The Regular',          at: 20 },
  { id: 'vip',     title: 'VIP',                  at: 35 },
  { id: 'legend',  title: 'Legend of the Floor',  at: 60 },
  { id: 'staff',   title: 'Practically Staff',    at: 90 },
];
export const rankFor = (level) => { let r = RANKS[0]; for (const k of RANKS) { if (level >= k.at) r = k; } return r; };
export const nextRank = (level) => RANKS.find((k) => k.at > level) || null;
