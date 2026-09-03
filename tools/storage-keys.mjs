// 🗄 EVERY KEY BANANA WORLD WRITES TO A PLAYER'S DEVICE, and whether it
// follows them. Enforced by tools/check-storage.mjs — add a key, declare it.
//
//   travels: 'pass'    its content rides the pass blob (and so must be wiped
//                      when somebody else signs in — the gate checks that)
//            'yard'    it rides the homestead yard doc, keyed to the pass
//            'server'  the truth is server-side under the player's identity;
//                      what sits here is a cache or a credential
//            'no'      deliberately this device only — say why in `why`
//
// `why` is the point of the file. A key that stays on one device is a fine
// decision and a terrible accident, and a year later nobody can tell which one
// it was. Write the reason down while you still know it.
export const KEYS = {
  // ---- the pass itself: what a player earns, owns, makes and is called ----
  'pass-v1': { travels: 'pass', why: 'the ledger — coins, rep, jelly, badges, every own_* and knit_*' },
  'pass-ev-v1': { travels: 'pass', why: 'the outbox of ledger events waiting to reach the server' },
  'pass-best-v1': { travels: 'pass', why: 'personal bests; merged by MAX, never summed like a counter' },
  'shelf-v1': { travels: 'pass', why: 'the forge shelf — everything this player has made' },
  'shelf-del-v1': { travels: 'pass', why: 'its tombstones, so a delete propagates instead of being resurrected' },
  'bb-last': { travels: 'pass', why: 'the outfit the banana is wearing' },
  'bb-at': { travels: 'pass', why: 'the outfit change-clock that decides which device edited last' },
  'bb-seen': { travels: 'pass', why: 'the other half of that clock: the value this device has witnessed' },
  'ps-name-v1': { travels: 'pass', why: 'the player name' },
  'ps-name-at': { travels: 'pass', why: 'the name change-clock' },
  'ps-name-seen': { travels: 'pass', why: 'the name this device has witnessed' },
  'rv-glowstick': { travels: 'pass', why: 'a wearable earned at the rave' },
  'bb-member': { travels: 'pass', why: 'the supporter grant; only a signed webhook can create one' },
  'bb-mtok': { travels: 'pass', why: 'the signed token that makes a supporter hat visible to others' },
  'bwq-c1': { travels: 'pass', why: 'the questline chapter — step level, forward only' },

  // ---- the homestead, which lives in its own server doc ----
  'hs-v1': { travels: 'yard', why: 'the homestead: the yard, pen, family tree, pantry, produce and shed all publish; what stays is sync bookkeeping (pubUpdated, pubMarks, dirty)' },
  'hs-v1-prev': { travels: 'no', why: 'a one-time stash of the local yard from before a published one was adopted' },
  'hs-pull': { travels: 'no', why: 'a session guard against re-adopting the same pull twice' },

  // ---- identity and the server's own answers, cached ----
  'pass-link': { travels: 'no', why: 'THIS device\'s credential. It must not travel; the pass it names is what does' },
  'world-gid': { travels: 'server', why: 'the world id the pass hands out, cached for the world workers' },
  'world-wt': { travels: 'server', why: 'the signed write token, minted server-side on every pull' },
  'park-sid': { travels: 'no', why: 'this browser\'s connection id — a device, never a person' },
  'pass-pull-at': { travels: 'no', why: 'when this tab last pulled, so a focus does not re-pull every second' },
  'pass-wallet-v1': { travels: 'server', why: 'a cache of the server wallet; the balance itself is the server\'s' },
  'pass-rules-v1': { travels: 'server', why: 'a cache of the caps this person has used; the rules are enforced server-side' },
  'pass-nak-v1': { travels: 'no', why: 'the refusals THIS device has already put right, so it does not act twice' },
  'anon-try-at': { travels: 'no', why: 'a backoff clock for minting an anonymous pass when the worker is down' },

  // ---- the day's counters. The real cap is a server rule, per person; these
  // only stop a device asking for something the server would refuse anyway ----
  'bc-win': { travels: 'no', why: 'the hourly coin window; the rule that matters is server-side' },
  'hs-stall-v1': { travels: 'no', why: 'the stall\'s daily sale count; capped per person on the server' },
  'hs-roadcoins-v1': { travels: 'no', why: 'the roadside coin faucet\'s day counter; capped per person on the server' },
  'bh-fishcoins-v1': { travels: 'no', why: 'the fishing day counter; capped per person on the server' },
  'rv-fq-slot': { travels: 'no', why: 'which half-hour floor-quest slot this device has played' },
  'pk-seed-voucher': { travels: 'no', why: 'a one-shot free seed from the fountain' },
  'hs-buff-v1': { travels: 'no', why: 'the stew buff, a short timer; it expires long before it would matter elsewhere' },
  'bh-rally-best': { travels: 'no', why: 'the old per-device volleyball best; read once and removed, the record now lives in pass-best-v1' },

  // ---- mirrors of things the pass already carries ----
  'cat-own-v1': { travels: 'no', why: 'a cache of community items owned; the ownership itself is own_c_* on the pass' },
  'ps-avatar-v1': { travels: 'no', why: 'a rendered picture of the outfit for the nav; it redraws from the outfit, which travels' },
  'cat-subs-v1': { travels: 'no', why: 'items submitted from this device, to spot when one is approved' },
  'gal-subs-v1': { travels: 'no', why: 'bananas submitted to the gallery from this device' },
  'cat-check-at': { travels: 'no', why: 'when this device last asked the catalog about its submissions' },
  'gal-check-at': { travels: 'no', why: 'when this device last asked the gallery about its submissions' },
  'bm-reply-check-at': { travels: 'no', why: 'when this device last asked HQ for a reply' },
  'bm-mailed-v1': { travels: 'no', why: 'what this device has sent HQ, to match a reply to it' },
  'bm-reply-legacy-v1': { travels: 'no', why: 'replies from before the mail rail; kept so old threads still read' },
  'ps-notices-v1': { travels: 'no', why: 'the notices timeline; each notice regenerates from server state on a new device' },
  'ps-news-v1': { travels: 'no', why: 'which world news this device has read' },

  // ---- votes: the count is the server's, this only stops a second vote ----
  'gal-votes': { travels: 'no', why: 'which gallery bananas this device voted on; the tally is the server\'s' },
  'rmx-votes': { travels: 'no', why: 'which remixes this device voted on; the tally is the server\'s' },
  'rmx-synced': { travels: 'no', why: 'whether this device has pushed its remix votes up' },

  // ---- work in progress, settings and one-shots ----
  'forge-draft': { travels: 'no', why: 'an unsaved drawing; saving it puts it on the shelf, which travels' },
  'custom-cart-v1': { travels: 'no', why: 'the shopping cart; a checkout belongs to the browser that started it' },
  'cookie-consent-v1': { travels: 'no', why: 'consent is given by a person on a device and cannot be inherited' },
  'ps-tab-v1': { travels: 'no', why: 'which My Pass tab was last open' },
  'bb-homebar-x': { travels: 'no', why: 'where the builder\'s home bar was dragged' },
  'hs-tree-folds': { travels: 'no', why: 'which branches of the family tree are folded shut' },
  'rv-sound': { travels: 'no', why: 'whether the rave plays sound; a setting for these speakers' },
  'ps-name-asked-v1': { travels: 'no', why: 'the name has been asked for once on this device' },
  'rv-tour-v1': { travels: 'no', why: 'the rave tour has played here' },
  'rv-hello': { travels: 'no', why: 'the rave greeting has played here' },
  'rv-lz': { travels: 'no', why: 'the laser intro has played here' },
  'rv-real5': { travels: 'no', why: 'a one-shot rave beat' },
  'rv-realwave': { travels: 'no', why: 'a one-shot rave beat' },
  'rv-nudged': { travels: 'no', why: 'the rave nudge has shown here' },
  'bw-tour-v1': { travels: 'no', why: 'the world tour has played here' },
  'bw-tour-inv': { travels: 'no', why: 'the world tour invite has shown here' },
  'inbox-read-v1': { travels: 'no', why: 'which HQ inbox threads are read (Trym\'s desk)' },
  'pk_birds_day': { travels: 'no', why: 'the park bird flock, seeded per day for this device' },
  'pk_bfly': { travels: 'no', why: 'the park butterfly state for this device' },
  'fk-t': { travels: 'no', why: 'a shop page timing marker' },
  'tt-internal': { travels: 'no', why: 'marks Trym\'s own traffic so it is kept out of the numbers' },
  'dw-bg': { travels: 'no', why: 'the wearables dev bench background' },

  // ---- QA and admin. Never a player's ----
  'pass-wallet-off': { travels: 'no', why: 'a QA switch that ignores the server wallet; session-scoped on purpose' },
  'bwq-dev': { travels: 'no', why: 'a QA switch for the questline' },
  'inbox-token': { travels: 'no', why: 'Trym\'s HQ credential' },
  'gallery-key': { travels: 'no', why: 'Trym\'s gallery credential' },
  'pass-admin-key-v1': { travels: 'no', why: 'Trym\'s pass admin credential' },
  'bmDevRecent': { travels: 'no', why: 'a recent-devices note on the HQ desk' },
};

// A key assembled at runtime is fine when the thing that assembles it is
// named here. Anything else fails: a computed key is exactly where a piece of
// somebody's progress goes quiet.
export const ALLOW_DYNAMIC = [
  { file: 'src/lib/banana-pass.js', arg: 'seenKey', why: 'stampClock(seenKey, atKey) — the four call sites pass literals, declared above' },
  { file: 'src/lib/banana-pass.js', arg: 'atKey', why: 'the other half of stampClock' },
  { file: 'src/lib/banana-pass.js', arg: 'k', why: 'a loop clearing a list of keys already declared above' },
  { file: 'src/lib/pass-sync.js', arg: 'k', why: 'wipeWorld() walks WORLD_KEYS, every one of them declared above' },
  { file: 'src/scripts/banana-pass-page.js', arg: 'k', why: 'a loop over the same declared keys' },
  { file: 'src/lib/drops.js', arg: 'drop.flag', why: 'each rave drop names its own claim flag in DROPS; ownership rides own_<id> on the pass and runDropBridge keeps the flag in step' },
  { file: 'src/lib/drops.js', arg: 'd.flag', why: 'the same DROPS table' },
  { file: 'src/scripts/banana-rave.js', arg: 'd.flag', why: 'the same DROPS table' },
  { file: 'src/scripts/banana-rave.js', arg: 'DROP.flag', why: 'the same DROPS table' },
  { file: 'src/scripts/banana-builder.js', arg: 'd.flag', why: 'the same DROPS table' },
  { file: 'src/scripts/park-shops.js', arg: 'd.flag', why: 'the same DROPS table' },
  { file: 'src/scripts/park-shops.js', arg: 'item.flag', why: 'the same DROPS table' },
  { file: 'src/scripts/sticker-pdp.js', arg: 'd.flag', why: 'the same DROPS table' },
  { file: 'src/scripts/banana-pass-page.js', arg: 'def.flag', why: 'the same DROPS table' },
  { file: 'src/scripts/banana-beach.js', arg: 'TR_KEY', why: "'bh-treasure-' + day: one dig per day, a day counter like the rest" },
  { file: 'src/scripts/banana-beach.js', arg: 'MAP_KEY', why: "'bh-mappieces-' + day: the day's map pieces" },
  { file: 'src/scripts/banana-homestead.js', arg: 'wkey', why: "'hs-wd:' + slug: whether this device watered a given yard today" },
];
