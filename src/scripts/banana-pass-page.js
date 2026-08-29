// THE CARD — client side of /pass/: draws the signature banana (from bb-last,
// dancing on the shared wall clock), lights earned patches, fills the numbers
// and hosts the Shelf in its true home. CLIENT-ONLY.
// ⚠️ THE PAGE IS THE CARD, THEN THE PILES, THEN THE ACCOUNT. Anything a player
// does once ever (log in, link a device, log out, join the list) lives below
// the things they came for — see docs/pass-redesign-spec.md.
import { drawComposite, assetsReady, NFRAMES, BASE_CYCLE_S, outfitParams, EXTRA_DEFS } from '../lib/banana-engine.js';
import { offerCard, myOutfit } from '../lib/make-it-real.js';
import { renderShelf, shelfList } from '../lib/banana-shelf.js';
import { passGet, passVisit, passToast, passPush, passNotices, passNoticesMarkRead, coinsNow, checkGalleryVerdicts, checkCatalogVerdicts, checkTrymReplies, PASS_API } from '../lib/banana-pass.js';
import { PATCHES, GEAR, rankFor, levelFor } from '../lib/pass-defs.js';
import { MANAGE } from '../data/pay-rail.js';
import { passkeysSupported, linked, savePass, restorePass, pullLatest,
  startLink, finishLink, mailSignin, mailUse, logout,
  newsJoin, newsConfirm } from '../lib/pass-sync.js';
import { captionsClean } from '../lib/sticker-core.js';
import { iconSvg } from '../lib/pixel-icons.js';
import { wearToCustom } from '../lib/wear-render.js';

// 🎁 community catalog (the ownership stack) — owned items show in GEAR and
// can be worn; the manifest is public + cached, fetched once per page
let CATALOG = [];
const CAT_CUSTOM = {};
const catCustomP = (ids) => {
  // 🧢 `ids` is ONE id or a COMMA LIST — a banana can wear several community
  // items since 2 Aug (a visitor wrote in asking for three). Returns an ARRAY;
  // the engine draws them in order.
  // ⚠️ THERE ARE FIVE COPIES OF THIS RESOLVER. Every one must understand the
  // comma form — one that cannot would leave that player wearing NOTHING in
  // that area, which is worse than the single-item limit it replaced.
  const one = (id) => {
    if (id in CAT_CUSTOM) return CAT_CUSTOM[id] || undefined;   // ⚠️ never cache a MISS (P4-D)
    const it = CATALOG.find((x) => x.id === id);
    if (!it || it.kind === 'decor') return undefined;   // decor = homestead goods, never worn
    CAT_CUSTOM[id] = wearToCustom(it.wear);
    return CAT_CUSTOM[id] || undefined;
  };
  const out = String(ids || '').split(',').map((t) => t.trim()).filter(Boolean)
    .map(one).filter(Boolean);
  return out.length ? out : undefined;

};
const catOwnedP = () => {
  try {
    const m = JSON.parse(localStorage.getItem('cat-own-v1') || '{}') || {};
    // synced own_c_<id> pass stats count too (a catch on another device)
    const stats = (JSON.parse(localStorage.getItem('pass-v1') || '{}').stats) || {};
    for (const k of Object.keys(stats)) {
      if (k.startsWith('own_c_') && stats[k] > 0 && !m[k.slice(4)]) m[k.slice(4)] = 1;
    }
    return m;
  } catch (e) { return {}; }
};
const catalogReady = fetch('https://banana-share.trymstene.workers.dev/catalog/items.json')
  .then((r) => (r.ok ? r.json() : []))
  .then((items) => { if (Array.isArray(items)) CATALOG = items; })
  .catch(() => {});

const el = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ⚠️ EVERY MODULE CONST BELONGS ABOVE init() — it runs at module-eval time and
// a const declared under it is still in the temporal dead zone (TDZ).

// ⏱ no fetch on this page may wedge the dashboard: a cold worker or a phone
// that just lost signal has to lose the race, not the page.
const PULL_MS = 7000;      // the account pull — a background refresh, keep it short
const LANDING_MS = 12000;  // spending a magic link — worth waiting a bit longer for
// 📡 the three states of the keep row's summary. It is the SUMMARY on purpose:
// magic-link feedback and the offline apology can never hide in a shut drawer.
// ⚠️ SAY THE STATE, NOT THE MECHANISM (Trym): "Saved to your email" left a
// player asking what was saved, and where — they arrive expecting the account
// / login / my-page words the rest of the web taught them. The row says
// whether they are logged in; the drawer explains how it works.
// ⚠️ we cannot print the address: the site stores NO emails, only a hash.
const LINE_IN = 'Logged in — your progress is saved';
const LINE_WAIT = 'Signing you in…';
const LINE_COLD = 'Not connected — showing what is saved on this device';
const LINE_OUT = 'Not logged in — nothing is saved off this device yet';
const TAB_KEY = 'ps-tab-v1';
const NEWS_KEY = 'ps-news-v1';
// old bookmarks still land somewhere sensible (nothing in the world links a
// pass hash, but seven tabs were live for months)
const ALIAS = { overview: 'made', bananas: 'made', items: 'made', emotes: 'made', badges: 'earned', gear: 'earned', stats: 'numbers' };

// 💛 YOUR SUPPORT — read straight from the local grant ('bb-member', the same
// person-scoped record the hats read), so it works offline and needs no call.
// Shown only while a grant is live; the way to cancel sits right in it, because
// a subscription whose exit is hard to find is a trap.
const SUP_TIERS = {
  'sup-t1': { name: 'Friend of the Banana', hat: 'blue', price: 5 },
  'sup-t2': { name: 'Patron of the Park', hat: 'silver', price: 10 },
  'sup-t3': { name: 'Legend of Banana World', hat: 'gold', price: 15 },
};
function paintSupport() {
  const box = document.getElementById('psSup');
  if (!box) return;
  let g = null;
  try { g = JSON.parse(localStorage.getItem('bb-member') || 'null'); } catch (e) {}
  const t = g && SUP_TIERS[g.t];
  // the 72h grace the hats honour — a lapsed member still sees the block while
  // the hat is still on, so the state on screen matches the state on the banana
  if (!t || !(+g.until + 72 * 3600 * 1000 > Date.now())) { box.hidden = true; return; }
  SUP.tier = t;
  SUP.until = +g.until;
  document.getElementById('psSupTier').textContent = t.name;
  document.getElementById('psSupHat').src = '/assets/supporters/hat-' + t.hat + '.png';
  document.getElementById('psSupHat').alt = 'the ' + t.name + ' hat';
  supPaintMeta();
  box.hidden = false;
  supWire();
  supStatus();
}

// 🚪 THE WAY OUT LIVES HERE, not on someone else's domain. The local grant
// paints instantly; the worker then tells us the truth from Polar (is it
// already ending? when?) and the card catches up. ⚠️ NOTHING about the
// subscription is written locally — the webhook owns the grant, and a cancel
// does not shorten it: you keep the hat for the month you paid for.
const SUP = { tier: null, until: 0, ending: false, endsAt: 0, known: null, busy: false, wired: false };
const supDate = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

function supPaintMeta() {
  const t = SUP.tier;
  if (!t) return;
  const end = SUP.endsAt || SUP.until;
  const meta = document.getElementById('psSupMeta');
  const box = document.getElementById('psSup');
  const btn = document.getElementById('psSupCancel');
  box.classList.toggle('ps-sup--ending', SUP.ending);
  if (SUP.until < Date.now()) {
    meta.textContent = 'Ended ' + supDate(SUP.until) + ' — the hat comes off shortly. Thank you for the time you kept the lights on.';
    document.getElementById('psSupActs').hidden = true;
    return;
  }
  meta.textContent = SUP.ending
    ? 'Ending ' + supDate(end) + '. Nothing more will be charged, and your hat stays on until then.'
    : '$' + t.price + ' a month · renews ' + supDate(end) + '. Your hat and glow are on your banana everywhere, and your name is on the board in the park.';
  btn.textContent = SUP.ending ? 'Keep my membership' : 'Cancel membership';
  // known === false: the membership predates us recording which Polar
  // subscription it is, so we cannot honestly offer the button — say where the
  // door is instead of pretending to be it
  btn.hidden = SUP.known === false;
  const port = document.getElementById('psSupPortal');
  port.textContent = SUP.known === false ? 'Manage or cancel on Polar →' : 'Card & receipts →';
  // when we cannot see which subscription is theirs, say so — "you have no
  // membership" would be a lie, and it is the sentence that earns an angry email
  const miss = document.getElementById('psSupMiss');
  miss.hidden = SUP.known !== false;
}

function supWire() {
  if (SUP.wired) return;
  SUP.wired = true;
  const ask = document.getElementById('psSupAsk');
  const note = document.getElementById('psSupNote');
  const say = (msg) => { note.textContent = msg; note.hidden = !msg; };

  document.getElementById('psSupCancel').addEventListener('click', () => {
    if (SUP.ending) { supDo('keep'); return; }        // changing your mind needs no confirming
    document.getElementById('psSupAskT').textContent =
      'You keep the ' + SUP.tier.hat.replace(/^./, (c) => c.toUpperCase()) + ' Top Hat until '
      + supDate(SUP.endsAt || SUP.until) + ', then it comes off. Nothing more is charged, and you can start again any time.';
    ask.hidden = false;
    document.getElementById('psSupActs').hidden = true;
    say('');
  });
  document.getElementById('psSupNo').addEventListener('click', () => {
    ask.hidden = true;
    document.getElementById('psSupActs').hidden = false;
  });
  document.getElementById('psSupYes').addEventListener('click', () => {
    const why = document.getElementById('psSupWhy').value;
    supDo('cancel', why ? { reason: why } : {});
  });
}

async function supCall(act, extra = {}) {
  const link = linked();
  if (!link || !link.credId || !link.token) return null;
  const r = await fetch(PASS_API + '/pay/manage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ act, credId: link.credId, token: link.token, ...extra }),
  });
  return r.ok ? r.json() : null;
}

function supTake(d) {
  if (!d || d.known === false) { SUP.known = false; return; }
  SUP.known = true;
  SUP.ending = !!d.ending;
  const e = Date.parse(d.endsAt || '');
  if (e) SUP.endsAt = e;
  supPaintMeta();
}

// the quiet read on open — a member who has already cancelled elsewhere must
// not be shown a Cancel button
async function supStatus() {
  const port = document.getElementById('psSupPortal');
  port.href = MANAGE;                                  // the honest fallback, always live
  port.target = '_blank';
  try { supTake(await supCall('status')); } catch (e) { SUP.known = false; }
  supPaintMeta();
}

async function supDo(act, extra = {}) {
  if (SUP.busy) return;                                // a double-tap must not send two cancels
  SUP.busy = true;
  const btn = document.getElementById('psSupCancel');
  const yes = document.getElementById('psSupYes');
  const note = document.getElementById('psSupNote');
  const say = (m) => { note.textContent = m; note.hidden = !m; };
  yes.disabled = btn.disabled = true;
  say(act === 'cancel' ? 'Cancelling…' : 'One moment…');
  try {
    const d = await supCall(act, extra);
    if (d && d.ok) {
      supTake(d);
      document.getElementById('psSupAsk').hidden = true;
      document.getElementById('psSupActs').hidden = false;
      // the line above already carries the date — this only has to say it landed
      say(act === 'cancel' ? 'Cancelled. Thank you for the months you gave.' : 'Still a member. Nothing changed.');
    } else {
      document.getElementById('psSupActs').hidden = false;
      say('That did not go through, and nothing was changed. Try again in a moment, or use the Polar link below.');
    }
  } catch (e) {
    say('That did not go through. Nothing was changed.');
  }
  yes.disabled = btn.disabled = false;
  SUP.busy = false;
}

// 🧾 the page state lives here because paint() runs TWICE — once from this
// device before any network, again when the account lands — while the gear
// toggles, the dancing card and the share card all read it live.
let PASS = null;
const OUTFIT = { hat: 'none', glasses: 'none', extras: {}, effect: 'none', c: undefined };
let SHARE_EXTRA = null;
let lastIdx = -1;          // the signature banana's frame; -1 forces a redraw
let syncWired = false;
let offerShown = false;
let HAVE = false;          // anything made, earned or counted — !HAVE IS the zero state
let madeKind = '';         // the Made pane's filter ('' = everything)
let selectTab = null;      // set by initTabs(); paint() re-applies the pane on a repaint

// 🧢 THE EQUIPPED SET. `c` is a COMMA LIST (a lone id is a one-item list) —
// the same shape the builder, the rooms and the sync blob all speak.
// ⚠️ Never test it with `===`: with two items on, equality lights NEITHER tile
// and "wear it" would REPLACE the whole look with one piece.
const cList = () => String(OUTFIT.c || '').split(',').map((t) => t.trim()).filter(Boolean);
// ⚠️ ONE ITEM PER SPOT — the builder's rule, so the closet cannot assemble a
// loadout the builder would refuse.

const setLine = (t) => { el('psSyncNote').textContent = t; };
const subsPending = (k) => {
  try {
    return (JSON.parse(localStorage.getItem(k) || '[]') || [])
      .filter((s) => s.status === 'pending' && Date.now() - s.at < 30 * 86400000).length;
  } catch (e) { return 0; }
};

function withTimeout(p, ms) {
  let t;
  return Promise.race([
    Promise.resolve(p).finally(() => clearTimeout(t)),
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), ms); }),
  ]);
}

if (el('psSig')) init();

// same naming as the rave's endurance board — your outfit IS your name
// (duplicated from banana-rave.js on purpose: the rave build must stay lean)
function autoName(o) {
  const adj = (o.extras && o.extras.goldbanana ? 'Golden' : null) // the trophy outranks everything
    || (o.extras && o.extras.glowstick ? 'Glowing' : null)
    || { shades: 'Cool', hearts: 'Lovestruck', visor: 'Sporty' }[o.glasses]
    || { disco: 'Disco', sparkle: 'Sparkly', confetti: 'Party' }[o.effect]
    || (o.extras && o.extras.mustache ? 'Distinguished' : 'Fresh');
  const noun = { cowboy: 'Cowboy', crown: 'Royal', tophat: 'Fancy', party: 'Birthday' }[o.hat]
    || (o.extras && o.extras.bowtie ? 'Dapper' : 'Dancing');
  return adj + ' ' + noun + ' Banana';
}

function signatureOutfit() {
  try {
    const saved = JSON.parse(localStorage.getItem('bb-last') || 'null');
    if (saved && typeof saved === 'object') {
      return { hat: saved.hat || 'none', glasses: saved.glasses || 'none', extras: saved.extras || {}, effect: saved.effect || 'none', c: saved.c || undefined };
    }
  } catch (e) {}
  return { hat: 'none', glasses: 'none', extras: {}, effect: 'none' };
}

// refresh OUTFIT IN PLACE — the RAF loop, the closet and the share card all
// hold this exact object, so a repaint may never swap it for a new one
function loadOutfit() {
  Object.assign(OUTFIT, { c: undefined }, signatureOutfit());
}

// ---- THE PAGE, IN TWO PASSES -------------------------------------------
// ⚠️ LOCAL FIRST, NETWORK SECOND. The dashboard used to be built inside one
// linear await chain behind two un-timed fetches: while they flew the tab bar
// sat dead over blank panes, and if either threw it never built at all.
// paint() reads only this device, so the page is whole and clickable before a
// byte of network — refresh() can then only ever IMPROVE it.
// ⚠️ paint() FIRST: initTabs() and initSync() both read HAVE, which is the
// difference between a zero state and a dashboard.
async function init() {
  passVisit();
  if (window.gtag) window.gtag('event', 'pass_view');
  const landing = takeLanding();   // ?in= leaves the URL NOW; SPENDING it waits
  paint();
  initTabs();
  initSync();
  initShare();
  initChips();
  startSignature();
  // ⚠️ the shared shelf re-renders itself after a delete, so the tile dressing
  // is hung off the host rather than off one render call
  new MutationObserver(dressTiles).observe(el('psMade'), { childList: true });
  if (landing && landing.kind === 'in') setLine(LINE_WAIT);
  setTimeout(passNoticesMarkRead, 1800); // seen = read (the unread highlight gets its moment)
  catalogReady.then(renderGear);         // the catalog landed — repaint the whole closet
  await refresh(landing);
}

// — the network pass: spend a magic link, pull the account, repaint what moved —
async function refresh(landing) {
  // 📯 verdicts on your gallery/catalog submissions — no account needed, never blocking
  checkGalleryVerdicts({ force: true }).then(renderNews);
  checkCatalogVerdicts({ force: true }).then(renderNews);
  checkTrymReplies({ force: true }).then(renderNews);   // 💬 Message from Trym
  if (!landing && !linked()) return;   // nothing to reach — the local page IS the page
  let cold = false;
  if (landing) {
    try {
      await withTimeout(runLanding(landing), LANDING_MS);
    } catch (e) {
      const slow = e && e.message === 'timeout';
      if (slow) cold = true;           // an expired link is not an unreachable club
      passToast('⚠️ <b>' + esc(slow
        ? 'We couldn’t reach the club just now — try that link again in a moment.'
        : (e && e.message) || 'That link didn’t work.') + '</b>');
    }
  }
  if (linked()) {
    const ok = await withTimeout(pullLatest(), PULL_MS).catch(() => false);
    if (!ok) cold = true;
  }
  // ⚠️ the repaint runs LAST and cannot be allowed to throw: the page is
  // already whole, so a bad blob must cost the refresh, never the dashboard.
  try {
    paint();    // the pull rewrites bb-last, the stats and the shelf
    initSync(); // a magic-link login flips the keep row from "log in" to "saved"
  } catch (e) { cold = true; }
  netNote(cold);
}

// 📡 an unreachable account is SAID OUT LOUD, on the row that owns sync status.
// The page is honest either way — it is drawn from this device — but quietly
// showing yesterday's numbers behind a spinner-less blank reads as broken.
function netNote(cold) {
  if (cold) setLine(LINE_COLD);
  else if (el('psSyncNote').textContent === LINE_WAIT) setLine(linked() ? LINE_IN : LINE_OUT);
}

// ⚠️ paint() RUNS TWICE — once from localStorage, once when the account lands —
// so every block below REPLACES what it drew and never appends to it.
function paint() {
  paintSupport();
  PASS = passGet();
  loadOutfit();
  const patches = PASS.patches || {};
  const days = PASS.days || [];
  const S = PASS.stats || {};

  renderName();
  wireName();
  const created = PASS.created || Date.now();
  el('psSince').textContent = 'member since ' + new Date(created).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  // the official furniture: serial + barcode, same seeded pattern as the
  // share-card PNG (a real document keeps its number)
  el('psSerial').textContent = 'Nº ' + created.toString(36).toUpperCase();
  drawBarcode(el('psBarcode'), created);

  // — your standing at the club, ON the card. ⚠️ no bar and no rep number until
  //   rep exists: 0 / 195 is a scoreboard shown to somebody who hasn't played. —
  const rep = S.rep || 0;
  const lv = levelFor(rep);
  const rk = rankFor(lv.level);
  el('psRank').innerHTML = '<span class="ps-rankchip">' + (rep ? 'LVL ' + lv.level + ' · ' : '') + rk.title.toUpperCase() + '</span>'
    + (rep ? '<span class="ps-rankbar"><i style="width:' + Math.round((lv.into / lv.need) * 100) + '%"></i></span>'
      + '<span class="ps-ranknote">' + lv.into + ' / ' + lv.need + ' rep — what you get for showing up</span>' : '');

  // — patches: light the earned, pin the first few to the card —
  // ⚠️ clear first: on the repaint these classes and tiles are already there
  document.querySelectorAll('.ps-patch--earned').forEach((c) => c.classList.remove('ps-patch--earned'));
  const earned = PATCHES.filter((d) => patches[d.id]);
  earned.forEach((d) => {
    const cell = document.querySelector('.ps-patch[data-patch="' + d.id + '"]');
    if (!cell) return;
    cell.classList.add('ps-patch--earned');
    cell.querySelector('.ps-patch__date').textContent = new Date(patches[d.id]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  });
  const strip = el('psCardPatches');
  strip.replaceChildren();
  earned.slice(0, 6).forEach((d) => {
    const src = document.querySelector('.ps-patch[data-patch="' + d.id + '"] svg');
    if (src) strip.appendChild(src.cloneNode(true));
  });
  // the rest as one ink chip, like the shared PNG — a count beats a cut-off row
  if (earned.length > 6) {
    const more = document.createElement('span');
    more.className = 'ps-card__more';
    more.textContent = '+' + (earned.length - 6);
    strip.appendChild(more);
  }
  strip.hidden = !earned.length;   // an empty band says nothing; a door says it better
  el('psBadgeLabel').hidden = !earned.length;
  el('psBadgeH').textContent = 'Badges ' + earned.length + '/' + PATCHES.length;

  const all = shelfList();
  const kinds = { banana: 0, wearable: 0, emoji: 0 };
  all.forEach((c) => { if (c.kind in kinds) kinds[c.kind]++; });

  // — THE NUMBERS. Tiles, labels and earn-hints are server-rendered; this only
  //   fills them in and dims the zeros (the badge pane's own pattern — a zero
  //   keeps its tile and says how to move it). `data-free` counts are ones
  //   everybody has, so they never unlock the tab on their own. —
  const NUM = { level: lv.level, coins: coinsNow(), badges: earned.length, days: days.length,
    items: kinds.wearable, builds: S.builds || kinds.banana, forges: S.forges || kinds.emoji };
  let any = false;
  document.querySelectorAll('.ps-stat').forEach((t) => {
    const k = t.dataset.stat;
    const n = (k in NUM ? NUM[k] : S[k]) || 0;
    t.firstElementChild.textContent = n;
    t.classList.toggle('ps-stat--zero', !n);
    if (n && !t.dataset.free) any = true;
  });

  // — ⚠️ THE ZERO STATE HAS NO NAVIGATION. Nothing made, nothing earned, nothing
  //   counted = three doors in the pane slot and not one tile of nothing. —
  HAVE = !!(all.length || earned.length || any);
  el('psNav').hidden = !HAVE;
  el('psZero').hidden = HAVE;
  el('psSigSlot').hidden = HAVE;   // a dashed frame beats a banana they never made
  el('psSig').hidden = !HAVE;
  el('psDoorMake').hidden = !HAVE; // down there the pane doors ARE the exits
  el('tab-numbers').hidden = !any;
  if (!HAVE) document.querySelectorAll('.ps-pane').forEach((p) => { p.hidden = true; });
  else if (selectTab) selectTab();

  // — MADE: chips only when two kinds are actually non-empty; with one kind the
  //   heading carries the count and the row never costs a line. —
  let n2 = 0;
  document.querySelectorAll('#psMadeChips .ps-chip').forEach((c) => {
    const k = c.dataset.kind;
    if (!k) return;
    c.hidden = !kinds[k];
    if (kinds[k]) n2++;
  });
  el('psMadeChips').hidden = n2 < 2;
  if (n2 < 2) madeKind = n2 ? Object.keys(kinds).find((k) => kinds[k]) : '';
  renderMade();

  // 🛍 the offer, at the foot of MADE — you have just looked at everything you
  // made, the one moment on this page where "have one for real" continues the
  // thought instead of interrupting it. ⚠️ MADE BY YOU IS A CLAIM: only a
  // banana this device actually built may wear it, and a card that cannot make
  // the claim shows the classic banana bare instead of borrowing someone's.
  const fit = myOutfit();
  const mount = el('psOffer');
  mount.replaceChildren();   // ⚠️ a repaint must REPLACE this card, not stack a second one
  if (fit.made || kinds.banana) {
    mount.appendChild(offerCard({
      kicker: 'Make it real',
      head: 'Take your banana off the screen',
      cta: 'See it as a sticker →',
      href: '/make-a-banana/sticker/?' + outfitParams(fit).toString(),
      outfit: fit,
      bare: !fit.made,
      flag: fit.made ? 'MADE BY YOU' : '',
      onGo: () => { if (window.gtag) window.gtag('event', 'offer_click', { from: 'pass_made' }); },
    }));
    if (window.gtag && !offerShown) { offerShown = true; window.gtag('event', 'offer_shown', { from: 'pass_made' }); }
  }

  renderNews();
  renderGear();

  const proud = [...document.querySelectorAll('.ps-stat:not(.ps-stat--zero):not([data-noshare])')].slice(0, 3)
    .map((t) => [+t.firstElementChild.textContent, t.children[1].textContent]);
  SHARE_EXTRA = { rankLine: 'LVL ' + lv.level + ' · ' + rk.title.toUpperCase(), stats: proud };
  // ⚠️ the same line the shared PNG prints — the card on screen IS the keepsake,
  // so what it says and what people pass around must not diverge
  const sline = el('psCardStats');
  // each stat is one unbreakable unit — wrapping mid-item put "4" on one line
  // and "BADGES EARNED" on the next, which reads as two different numbers
  sline.replaceChildren();
  proud.forEach(([n, l], i) => {
    if (i) sline.appendChild(document.createTextNode('  ·  '));
    const u = document.createElement('span');
    u.textContent = n + ' ' + (n === 1 ? l.replace(/s/, '') : l);
    sline.appendChild(u);
  });
  sline.hidden = !proud.length;

  lastIdx = -1;                        // the signature banana redraws on its next frame
  assetsReady().then(bakeAvatar);
}

// — ONE MIXED-KIND SHELF, newest first, each tile routed to its own tool —
function renderMade() {
  const chips = [...document.querySelectorAll('#psMadeChips .ps-chip')];
  const on = chips.find((c) => c.dataset.kind === madeKind) || chips[0];
  chips.forEach((c) => c.setAttribute('aria-pressed', String(c === on)));
  const n = shelfList().filter((c) => !madeKind || c.kind === madeKind).length;
  el('psMadeH').textContent = on.dataset.h + ' ' + n;
  renderShelf(el('psMade'), {
    kinds: madeKind ? [madeKind] : undefined,
    onPick: (c) => {
      location.href = c.kind === 'banana' ? '/make-a-banana/?' + c.params
        : (c.kind === 'wearable' ? '/forge/items/?shelf=' : '/forge/?shelf=') + c.id;
    },
  });
}

// 🛍 THE ASK AT THE LAST CLICK, ON THE ITEM. The shared shelf ships a bare 🏷
// glyph; here it becomes a labelled 44px button in the tile's foot. Re-dressed
// from outside so banana-shelf.js — rendered by four other surfaces — is
// untouched ([[cro-placement-doctrine]]).
function dressTiles() {
  el('psMade').querySelectorAll('.shelf-tag').forEach((t) => {
    if (!t.firstElementChild) t.innerHTML = iconSvg('sticker', { size: 13 }) + 'Make it real';
  });
}

// — the card: YOUR name if you wrote one, the outfit-name otherwise —
// ✏️ free text is fine HERE (Trym: the premium feel of a real pass): it
// renders only on this device + the PNG the user shares themselves — no
// site surface hosts it, so no moderation burden. The rave keeps its
// outfit-names; the no-free-text-on-the-floor doctrine is untouched.
function customName() { try { return (localStorage.getItem('ps-name-v1') || '').trim().slice(0, 24); } catch (e) { return ''; } }
function renderName() {
  if (el('psNameInput')) return; // mid-edit — a repaint must not eat the field
  el('psName').textContent = customName() || autoName(OUTFIT);
}
function wireName() {
  const btn = el('psNameEdit');
  if (!btn) return;
  btn.onclick = () => {   // assignment, so a repaint replaces rather than stacks
    if (el('psNameInput')) return;
    const inp = document.createElement('input');
    inp.id = 'psNameInput';
    inp.maxLength = 24;
    inp.value = customName();
    inp.placeholder = autoName(OUTFIT);
    inp.setAttribute('aria-label', 'Your name on the pass');
    el('psName').replaceChildren(inp);
    inp.focus();
    let closed = false;
    const done = (save) => {
      if (closed) return;
      if (save) {
        const v = inp.value.trim().slice(0, 24);
        if (v && !captionsClean({ top: v })) {
          passToast('Let’s keep it family friendly 🍌 — try another name');
          inp.focus();
          return;
        }
        try { if (v) localStorage.setItem('ps-name-v1', v); else localStorage.removeItem('ps-name-v1'); } catch (e) {}
        passPush(); // the name rides the sync blob to your other devices
        if (v && v !== autoName(OUTFIT)) passToast('🎫 <b>' + v.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</b> — it’s officially your pass now.');
      }
      closed = true;
      inp.remove();     // renderName() steps aside while the field is open
      renderName();
    };
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done(true);
      if (e.key === 'Escape') done(false);
    });
    inp.addEventListener('blur', () => done(true));
  };
}

// — THE GEAR ROW: earned wearables, toggled straight onto the banana.
// bb-last is the toggle target (the rave, stickers and share cards all read
// it) and it rides the sync blob — so gear follows you across devices. —
function gearEarned(def) {
  const pass = PASS || {};
  if (def.stat) return ((pass.stats || {})[def.stat] || 0) > 0; // 🍌 the pier plush: prize_plush
  if (def.flag) { try { return localStorage.getItem(def.flag) === '1'; } catch (e) { return false; } }
  if (def.patch) return !!(pass.patches || {})[def.patch];
  return false;
}
// ⚠⚠ renderGear() OWNS #psGear ENTIRELY — it wipes the host, so anything
// rendered into that host by SOMEBODY ELSE is destroyed the next time any
// gear is toggled and never comes back.
// That was the bug Trym hit (1 Aug): the community items were appended by a
// separate one-shot `catalogReady.then(...)` block, so clicking "wear it" on
// the Glowstick made Wolf Tail, Pink shoes and Cute pink bow vanish — while
// the tab counter still said 6, because the count was right and the DOM was
// not. A refresh "fixed" it because the one-shot block ran again.
// ⚠️ So BOTH lists are rendered here. If a third source of gear ever appears,
// it renders HERE too — never by appending to the host from outside.
// (earned-first is CSS `order`, not a sort — see .ps-gear__item in pass.astro)
function renderGear() {
  const host = el('psGear');
  if (!host || !PASS) return;
  host.innerHTML = '';
  GEAR.forEach((def) => {
    const earned = gearEarned(def);
    // a gear slot is an extras id OR a head slot (hat/glasses)
    const isWorn = () => def.extra ? !!OUTFIT.extras[def.extra]
      : def.hat ? OUTFIT.hat === def.hat
      : def.glasses ? OUTFIT.glasses === def.glasses : false;
    const wearing = earned && isWorn();
    const cell = document.createElement('div');
    cell.className = 'ps-gear__item' + (earned ? ' ps-gear__item--earned' : '');
    const cv = document.createElement('canvas');
    cv.width = cv.height = 168;
    cell.appendChild(cv);
    const h = document.createElement('h3');
    h.textContent = def.title;
    cell.appendChild(h);
    const p = document.createElement('p');
    p.textContent = def.hint;
    cell.appendChild(p);
    if (def.by) { // creator credit rides the item — "by Barty"
      const by = document.createElement('span');
      by.className = 'ps-gear__by';
      by.textContent = 'by ' + def.by;
      cell.appendChild(by);
    }
    if (earned) {
      // 🚪 DRESSING HAPPENS IN THE BUILDER (Trym): the closet shows the
      // trophies and what's on; the builder is the one place outfits change.
      // ?wear= pre-selects the item so the door lands you mid-dressing.
      const wid = def.hat || def.glasses || def.extra || '';
      const a = document.createElement('a');
      a.className = 'ps-gear__btn' + (wearing ? ' on' : '');
      a.href = '/make-a-banana/' + (wid && !wearing ? '?wear=' + encodeURIComponent(wid) : '');
      a.textContent = wearing ? '✓ wearing it' : 'dress it →';
      cell.appendChild(a);
    }
    host.appendChild(cell);
    // a banana MODELS each item (frame 2, the classic pose); unearned slots
    // go grayscale via CSS — the closet doubles as the feature map
    assetsReady().then(() => {
      drawComposite(cv.getContext('2d'), 168, 2, {
        bg: 'transparent', captions: false,
        hat: def.hat || 'none', glasses: def.glasses || 'none',
        extras: def.extra ? { [def.extra]: true } : {}, top: '', bottom: '', effect: 'none',
      });
    });
  });
  renderMine(host);
  const own = ownedCatalog().length;
  el('psGearH').textContent = 'Gear ' + (GEAR.filter(gearEarned).length + own) + '/' + (GEAR.length + own);
}

// 🎁 owned COMMUNITY items join the closet — caught at the rave, made by
// ravers, the maker's credit riding each one. Read-only here: the builder is
// where dressing happens (the ?wear= door on each tile).
// Empty until the catalog fetch lands; renderGear() runs again when it does.
function ownedCatalog() {
  const own = catOwnedP();
  // decor kind = homestead goods (forge decor plan) — never closet wearables
  return CATALOG.filter((it) => own[it.id] && it.kind !== 'decor');
}
function renderMine(host) {
  ownedCatalog().forEach((it) => {
    const cell = document.createElement('div');
    cell.className = 'ps-gear__item ps-gear__item--earned';
    const cv = document.createElement('canvas');
    cv.width = cv.height = 168;
    cell.appendChild(cv);
    const h = document.createElement('h3');
    h.textContent = it.title || 'community item';
    cell.appendChild(h);
    const p = document.createElement('p');
    p.textContent = 'Caught on the dance floor — a raver made this.';
    cell.appendChild(p);
    if (it.by) {
      const by = document.createElement('span');
      by.className = 'ps-gear__by';
      by.textContent = 'by ' + it.by;
      cell.appendChild(by);
    }
    // ⚠️ MEMBERSHIP, not equality — a two-item look must light both tiles.
    // 🚪 Dressing happens in the BUILDER (as manifest gear above): the
    // ?wear= door carries the exclusion rules, so this page keeps none.
    const wearing = cList().includes(it.id);
    const a = document.createElement('a');
    a.className = 'ps-gear__btn' + (wearing ? ' on' : '');
    a.href = '/make-a-banana/' + (wearing ? '' : '?wear=' + encodeURIComponent(it.id));
    a.textContent = wearing ? '✓ wearing it' : 'dress it →';
    cell.appendChild(a);
    host.appendChild(cell);
    assetsReady().then(() => {
      // the item's svg Image decodes async and drawAcc skips until it's
      // ready — re-draw a couple of beats later so the first paint of a
      // one-shot canvas never misses the item
      const draw = () => drawComposite(cv.getContext('2d'), 168, 2, {
        bg: 'transparent', captions: false, hat: 'none', glasses: 'none',
        extras: {}, top: '', bottom: '', effect: 'none', custom: catCustomP(it.id),
      });
      draw();
      setTimeout(draw, 500);
      setTimeout(draw, 1600);
    });
  });
}

// — the signature banana dances on the shared clock. Wired ONCE; paint() nudges
//   it with lastIdx = -1 whenever the outfit underneath it moves. —
function startSignature() {
  const cv = el('psSig');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tick() {
    const cycleMs = BASE_CYCLE_S * 1000;
    const idx = reduced ? 2 : Math.floor((Date.now() % cycleMs) / (cycleMs / NFRAMES));
    if (idx !== lastIdx) {
      lastIdx = idx;
      drawComposite(ctx, 200, idx, {
        bg: 'transparent', captions: false,
        hat: OUTFIT.hat, glasses: OUTFIT.glasses, extras: OUTFIT.extras, top: '', bottom: '',
        effect: OUTFIT.effect,
        custom: OUTFIT.c ? catCustomP(OUTFIT.c) : undefined, // worn community items ride along
      });
    }
    requestAnimationFrame(tick);
  }
  assetsReady().then(() => requestAnimationFrame(tick));
}

// 🪪 bake a 48px still for the TOPNAV. The nav is on every page and must
// never load the compositor (see the Forge split, 1 Aug) — so the avatar is
// drawn HERE, where the engine is already running, and merely displayed there.
function bakeAvatar() {
  try {
    const a = document.createElement('canvas');
    a.width = 48; a.height = 48;
    drawComposite(a.getContext('2d'), 48, 2, {
      bg: 'transparent', captions: false,
      hat: OUTFIT.hat, glasses: OUTFIT.glasses, extras: OUTFIT.extras,
      top: '', bottom: '', effect: 'none',   // no effect: it must read at 22px
      custom: OUTFIT.c ? catCustomP(OUTFIT.c) : undefined,
    });
    localStorage.setItem('ps-avatar-v1', a.toDataURL('image/png'));
  } catch (e) { /* quota or a tainted canvas — the nav just stays generic */ }
}

// ---- THE SUBNAV ---------------------------------------------------------
// Three tabs — Made · Earned · Numbers — ARIA tab pattern, arrow keys, #hash.
// The default is the pane you used LAST: replacing one wrong default with
// another charges the 100th visit for first-visit clarity. Canvases render
// regardless of which panel is hidden, so nothing needs lazy re-drawing.
function initTabs() {
  const tabs = [...document.querySelectorAll('.ps-tab')];
  if (!tabs.length) return;
  let cur = '';

  function select(name, focus) {
    cur = tabs.some((t) => t.dataset.tab === name && !t.hidden) ? name : 'made';
    tabs.forEach((t) => {
      const on = t.dataset.tab === cur;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      const p = el('panel-' + t.dataset.tab);
      if (p) p.hidden = !on;
      if (on && focus) t.focus();
    });
    try { localStorage.setItem(TAB_KEY, cur); } catch (e) {}
    try { history.replaceState(null, '', '#' + cur); } catch (e) {}
    if (window.gtag) window.gtag('event', 'pass_tab', { tab: cur });
  }
  selectTab = () => select(cur || firstTab());

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      let j = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = tabs.length - 1;
      if (j !== null) { e.preventDefault(); select(tabs[j].dataset.tab, true); }
    });
  });
  if (!el('psNav').hidden) selectTab();
}

// hash → the tab you used last → what the nav dot was counting → made.
// ⚠️ main.js clears pass-seen-v1 before this module runs, so the badge half of
// the dot is already spent; unread notices are what is left of it.
function firstTab() {
  const h = (location.hash || '').slice(1);
  let last = '';
  try { last = localStorage.getItem(TAB_KEY) || ''; } catch (e) {}
  return ALIAS[h] || h || last || (passNotices().some((n) => !n.read) ? 'earned' : 'made');
}

// filter chips — ONE delegated handler for both rows. A `data-blk` chip shows
// its own block (Gear · Badges); a `data-kind` chip filters the shelf.
function initChips() {
  document.addEventListener('click', (ev) => {
    if (!ev.target.closest) return;
    // a notice is clamped to two lines; the whole card opens the rest
    const n = ev.target.closest('.ps-notice');
    if (n) { if (!ev.target.closest('a')) n.classList.toggle('ps-notice--open'); return; }
    const c = ev.target.closest('.ps-chip');
    if (!c) return;
    const row = [...c.parentNode.children];
    row.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    if (c.dataset.blk) row.forEach((x) => { el(x.dataset.blk).hidden = x !== c; });
    else { madeKind = c.dataset.kind; renderMade(); }
  });
}

// ---- the on-page barcode: same seeded pattern family as the share card ----
function drawBarcode(cv, seed) {
  if (!cv) return;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = cssVar('--ink', '#111111');
  let s = (seed % 2147483647) >>> 0 || 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  let x = 0;
  while (x < cv.width - 4) {
    const w = 2 + Math.floor(rnd() * 5);
    if (rnd() > 0.42) ctx.fillRect(x, 0, w, cv.height);
    x += w + 2;
  }
}

// ---- 📯 NEWS FOR YOU, and the ask at its foot ----------------------------
// Verdicts on things YOU made, never system chatter. Renders only when there
// is something to say (anti-fatigue).
function renderNews() {
  const sec = el('psNewsSec');
  if (!sec) return;
  const list = passNotices();
  const pend = subsPending('gal-subs-v1'), catPend = subsPending('cat-subs-v1');
  const news = list.length || pend || catPend;
  // ⚠️ ALL UNREAD + the two most recent read. passNoticesMarkRead() marks the
  // whole store read a beat later, so a render capped below the unread count
  // would make notices 3..N permanently unreachable — and a verdict on
  // something you made would vanish having never been seen.
  let k = 0;
  const fmt = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  el('psNewsH').hidden = !news;
  el('psNotices').innerHTML =
    (pend ? '<p class="ps-pendingline">' + pend + (pend === 1 ? ' banana is' : ' bananas are')
      + ' with the banana guy for review — the verdict usually lands within 48 hours.</p>' : '')
    + (catPend ? '<p class="ps-pendingline">' + catPend + (catPend === 1 ? ' item is' : ' items are')
      + ' with the club for review — approved pieces go on sale with your name on them.</p>' : '')
    + list.filter((n) => !n.read || ++k <= 2)
      .map((n) => '<div class="ps-notice' + (n.read ? '' : ' ps-notice--unread') + '">'
        + '<span class="ps-notice__icon">' + n.icon + '</span>'
        + '<div class="ps-notice__main"><div class="ps-notice__body">' + n.text
        + (n.link ? ' <a href="' + n.link + '">→</a>' : '') + '</div></div>'
        + '<span class="ps-notice__side"><span class="ps-notice__date">' + fmt(n.at) + '</span></span></div>').join('');
  // 📣 the ask is EARNED by the strip above it: never the first thing a
  // newcomer with nothing meets, never shown to somebody already on the list,
  // and nowhere near the login — consent stays unbundled.
  let sub = false;
  try { sub = localStorage.getItem(NEWS_KEY) === '1'; } catch (e) {}
  el('psAsk').hidden = sub || !(news || HAVE);
  sec.hidden = !news && el('psAsk').hidden;
}

// ---- share my card: the membership card as a 1200×630 PNG ---------------
// (OG dimensions on purpose — it looks right posted anywhere). V2 (Trym's
// brief): OFFICIAL and YELLOW — the website's paper/ink/banana identity, not
// the rave's dark dancefloor. Sunburst + confetti behind a BIG tilted banana,
// ink header strip, rank chip, badge tiles, serial + pixel barcode, red
// OFFICIAL stamp. Revealed in our own modal (the OS share sheet is previewless
// on Windows — demoted to an opt-in button, the rave-card pattern).
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

// deterministic per-pass scatter (confetti + barcode) — same card every render
function seededRand(seed) {
  let s = (seed % 2147483647) >>> 0 || 7;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function svgToImage(svg, px) {
  return new Promise((resolve) => {
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', px);
    clone.setAttribute('height', px);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  });
}

async function composeCard(outfit, pass, extra) {
  await assetsReady();
  await document.fonts.ready;
  await document.fonts.load('64px "Archivo Black"').catch(() => {});
  await document.fonts.load('800 26px "Space Grotesk"').catch(() => {});
  const ink = cssVar('--ink', '#111111');
  const paper = cssVar('--paper', '#faf6ee');
  const banana = cssVar('--banana', '#ffd93d');
  const white = '#fffdf5';
  const red = '#e22020';

  const cv = document.createElement('canvas');
  cv.width = 1200; cv.height = 630;
  const ctx = cv.getContext('2d');

  // the paper page + a whisper of halftone dots in two corners
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, 1200, 630);
  ctx.fillStyle = 'rgba(17,17,17,0.09)';
  for (let i = 0; i < 60; i++) {
    const gx = i % 12, gy = (i / 12) | 0;
    ctx.beginPath(); ctx.arc(22 + gx * 24, 22 + gy * 24, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(1178 - gx * 24, 608 - gy * 24, 3, 0, Math.PI * 2); ctx.fill();
  }

  // THE CARD: hard ink shadow, banana-yellow face, thick ink frame
  const CX = 56, CY = 62, CW = 1074, CH = 486;
  ctx.fillStyle = ink;
  ctx.fillRect(CX + 16, CY + 16, CW, CH);
  ctx.fillStyle = banana;
  ctx.fillRect(CX, CY, CW, CH);
  ctx.strokeStyle = ink; ctx.lineWidth = 8;
  ctx.strokeRect(CX + 4, CY + 4, CW - 8, CH - 8);

  // header strip + a punched lanyard hole (it's a PASS)
  ctx.fillStyle = ink;
  ctx.fillRect(CX + 8, CY + 8, CW - 16, 60);
  ctx.fillStyle = banana;
  ctx.font = '800 25px "Space Grotesk", sans-serif';
  try { ctx.letterSpacing = '5px'; } catch (e) {}
  ctx.fillText('★ BANANA WORLD · OFFICIAL MEMBERSHIP PASS', CX + 34, CY + 48);
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  ctx.beginPath(); ctx.arc(CX + CW - 46, CY + 38, 12, 0, Math.PI * 2);
  ctx.fillStyle = paper; ctx.fill();
  ctx.strokeStyle = banana; ctx.lineWidth = 4; ctx.stroke();

  // sunburst rays + confetti behind the banana — clipped inside the frame
  const rnd = seededRand(pass.created || 7);
  ctx.save();
  ctx.beginPath(); ctx.rect(CX + 12, CY + 68, CW - 24, CH - 80); ctx.clip();
  ctx.save();
  ctx.translate(918, 316);
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.fillStyle = 'rgba(255,253,245,0.5)';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-44, -560); ctx.lineTo(44, -560); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  const CONF = [ink, red, '#2f7fd1', white];
  for (let i = 0; i < 22; i++) {
    ctx.fillStyle = CONF[i % 4];
    ctx.globalAlpha = 0.4 + (i % 4) * 0.12;
    ctx.fillRect(660 + Math.floor(rnd() * 46) * 10, CY + 84 + Math.floor(rnd() * ((CH - 140) / 10)) * 10, 9, 9);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // THE BANANA — big, tilted the friendly way (+8°, mirroring the rave card's
  // lean), hat poking OVER the frame onto the paper, feet on the bottom frame
  const bcv = document.createElement('canvas');
  bcv.width = bcv.height = 1024;
  drawComposite(bcv.getContext('2d'), 1024, 2, {
    bg: 'transparent', captions: false, top: '', bottom: '',
    hat: outfit.hat, glasses: outfit.glasses, extras: outfit.extras, effect: outfit.effect,
  });
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(918, 296);
  ctx.rotate(8 * Math.PI / 180);
  ctx.drawImage(bcv, -260, -260, 520, 520);
  ctx.restore();

  // red rubber stamp across the banana's feet — passport energy
  ctx.save();
  ctx.translate(884, 498);
  ctx.rotate(-8 * Math.PI / 180);
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = red;
  ctx.lineWidth = 6;
  ctx.strokeRect(-142, -44, 284, 88);
  ctx.lineWidth = 3;
  ctx.strokeRect(-132, -34, 264, 68);
  ctx.fillStyle = red;
  ctx.font = '800 40px "Archivo Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OFFICIAL', 0, 14);
  ctx.restore();
  ctx.textAlign = 'left';

  // LEFT COLUMN — the member
  const tx = CX + 44;
  const name = el('psName').textContent;
  ctx.fillStyle = ink;
  let px = 62;
  do { ctx.font = px + 'px "Archivo Black", sans-serif'; px -= 2; }
  while (ctx.measureText(name).width > 520 && px > 28);
  ctx.fillText(name, tx, CY + 148);

  ctx.font = '700 22px "Space Grotesk", sans-serif';
  ctx.globalAlpha = 0.8;
  ctx.fillText(el('psSince').textContent.toUpperCase(), tx, CY + 188);
  ctx.globalAlpha = 1;

  // the rank chip — ink slab, yellow type
  if (extra && extra.rankLine) {
    ctx.font = '800 25px "Space Grotesk", sans-serif';
    const w = ctx.measureText(extra.rankLine).width;
    ctx.fillStyle = ink;
    ctx.fillRect(tx - 2, CY + 212, w + 34, 46);
    ctx.fillStyle = banana;
    ctx.fillText(extra.rankLine, tx + 15, CY + 244);
  }

  // badges — white tiles with hard shadows, off the page's own pixel icons
  const svgs = [...document.querySelectorAll('.ps-patch--earned svg')];
  const shown = svgs.slice(0, 6);
  const icons = (await Promise.all(shown.map((s) => svgToImage(s, 44)))).filter(Boolean);
  const byRow = CY + 292;
  ctx.fillStyle = ink;
  ctx.font = '800 17px "Space Grotesk", sans-serif';
  try { ctx.letterSpacing = '3px'; } catch (e) {}
  ctx.fillText('BADGES', tx, byRow - 10);
  try { ctx.letterSpacing = '0px'; } catch (e) {}
  icons.forEach((img, i) => {
    const x = tx + i * 74;
    ctx.fillStyle = ink; ctx.fillRect(x + 4, byRow + 4, 62, 62);
    ctx.fillStyle = white; ctx.fillRect(x, byRow, 62, 62);
    ctx.strokeStyle = ink; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, byRow + 1.5, 59, 59);
    ctx.drawImage(img, x + 9, byRow + 9, 44, 44);
  });
  if (svgs.length > icons.length) {
    const x = tx + icons.length * 74;
    ctx.fillStyle = ink; ctx.fillRect(x, byRow, 62, 62);
    ctx.fillStyle = banana;
    ctx.font = '800 24px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('+' + (svgs.length - icons.length), x + 31, byRow + 40);
    ctx.textAlign = 'left';
  }
  if (!svgs.length) {
    ctx.globalAlpha = 0.7;
    ctx.font = '700 21px "Space Grotesk", sans-serif';
    ctx.fillText('none yet — the floor awaits', tx, byRow + 38);
    ctx.globalAlpha = 1;
  }

  // gentle stats, one proud line (auto-shrinks; never runs under the banana)
  const stats = (extra && extra.stats) || [];
  if (stats.length) {
    // "1 DAYS ON THE PASS" is not official-document grade — drop the first
    // plural s when the count is 1 (works for every label in the stats list)
    const line = stats.map(([n, l]) => n + ' ' + (n === 1 ? l.replace(/s\b/, '') : l).toUpperCase()).join('  ·  ');
    let sp = 21;
    do { ctx.font = '800 ' + sp + 'px "Space Grotesk", sans-serif'; sp -= 1; }
    while (ctx.measureText(line).width > 530 && sp > 14);
    ctx.fillStyle = ink;
    ctx.fillText(line, tx, CY + 404);
  }

  // serial + pixel barcode — the official furniture
  const serial = 'Nº ' + (pass.created || 0).toString(36).toUpperCase();
  const bcy = CY + CH - 68;
  let bxx = tx;
  ctx.fillStyle = ink;
  while (bxx < tx + 236) {
    const w = 3 + Math.floor(rnd() * 7);
    if (rnd() > 0.42) ctx.fillRect(bxx, bcy, w, 40);
    bxx += w + 3;
  }
  ctx.font = '800 20px "Space Grotesk", sans-serif';
  ctx.fillText(serial, tx + 254, bcy + 28);

  // the caption lives on the PAPER, under the card — museum-label style
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.75;
  ctx.font = '800 21px "Archivo Black", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('get yours: trymstene.com/pass', 1144, 610);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;

  return cv;
}

// the reveal is OUR modal, not the OS dialog (previewless on Windows — the
// rave card set the pattern); the system sheet stays as an opt-in button
const FILE_NAME = 'my-banana-pass-trymstene.com.png';
function openShareModal(cv) {
  const modal = el('psShareModal');
  el('psShareSlot').replaceChildren(cv);
  modal.hidden = false;
  el('psShareSys').hidden = !navigator.canShare;
  const toBlob = () => new Promise((r) => cv.toBlob(r, 'image/png'));
  el('psShareDl').onclick = async () => {
    const blob = await toBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = FILE_NAME;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    if (window.gtag) window.gtag('event', 'pass_share', { method: 'download' });
  };
  el('psShareCopy').onclick = async () => {
    try {
      const blob = await toBlob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      el('psShareCopy').innerHTML = iconSvg('check', { size: 18 }) + ' Copied — paste it anywhere';
      if (window.gtag) window.gtag('event', 'pass_share', { method: 'copy' });
    } catch (e) {
      el('psShareCopy').textContent = 'Copy blocked — use download';
    }
    setTimeout(() => { el('psShareCopy').innerHTML = iconSvg('copy', { size: 18 }) + ' Copy image'; }, 2500);
  };
  el('psShareSys').onclick = async () => {
    const blob = await toBlob();
    const file = new File([blob], FILE_NAME, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'My Banana Pass' });
        if (window.gtag) window.gtag('event', 'pass_share', { method: 'share' });
      } catch (e) { /* user closed the sheet */ }
    }
  };
}

// ⚠️ no arguments: the card is composed at CLICK time from the module state, so
// a pull that lands after this was wired still shares the fresh pass.
function initShare() {
  const btn = el('psShareCard');
  if (!btn) return;
  // 🎫 THE CARD IS THE BUTTON for its own full-size version — one "big pass" in
  // the product, reached two ways.
  // ⚠️ not a <button> wrapper: the name pencil and the empty-slot door live
  // inside the card, and a button inside a button is invalid and unclickable.
  el('psCard').addEventListener('click', (ev) => {
    if (ev.target.closest('#psNameEdit,#psNameInput,#psSigSlot,#psShareCard')) return;
    btn.click();
  });
  const closeShare = () => { el('psShareModal').hidden = true; };
  el('psShareClose').addEventListener('click', closeShare);
  el('psShareModal').addEventListener('click', (e) => { if (e.target === el('psShareModal')) closeShare(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el('psShareModal').hidden) closeShare(); });
  let busy = false;
  btn.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    const was = btn.innerHTML;
    btn.innerHTML = was.replace('tap to share', 'opening…');
    try {
      const cv = await composeCard(OUTFIT, PASS || passGet(), SHARE_EXTRA);
      openShareModal(cv);
      if (window.gtag) window.gtag('event', 'pass_share', { method: 'open' });
    } catch (e) {
      passToast('That didn’t work — try again in a moment.');
    }
    btn.innerHTML = was;
    busy = false;
  });
}

// ---- 🔗 device linking: a code out one side, a code in the other --------
function wireLink(note) {
  const startBtn = el('psLinkStart');
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      startBtn.disabled = true;
      try {
        const { code, mins } = await startLink();
        el('psLinkCodeVal').textContent = code;
        el('psLinkCodeHint').textContent = 'type this on the other device — good for ' + mins + ' min, once';
        el('psLinkCode').hidden = false;
      } catch (e) {
        note.textContent = 'Could not make a code — try again in a moment.';
      }
      startBtn.disabled = false;
    });
  }
  const go = el('psCodeGo'), inp = el('psCodeIn');
  if (!go || !inp) return;
  const run = async () => {
    const code = inp.value.trim();
    if (code.length < 6) { note.textContent = 'That code looks too short.'; return; }
    go.disabled = true;
    note.textContent = 'Your device will ask to confirm — that is this device’s own passkey…';
    try {
      await finishLink(code);
      passToast('🔗 <b>DEVICE LINKED</b><br>Same pass, both devices.');
      setTimeout(() => location.reload(), 1200);
    } catch (e) {
      note.textContent = e && e.name === 'NotAllowedError'
        ? 'No worries — nothing happened.'
        : (e && e.message) || 'Could not link this device.';
      go.disabled = false;
    }
  };
  go.addEventListener('click', run);
  inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') run(); });
}

// ---- THE KEEP ROW (the account) -----------------------------------------
// ⚠️ EMAIL IS THE ONLY THING ANYONE HAS TO UNDERSTAND. One drawer, one form,
// one set of listeners, two densities: logged in it collapses to a single quiet
// row whose summary is the sync line; logged out it opens itself only when
// there is something worth keeping — an email demand before the shelf has
// anything on it is a demand, not an offer.
// Passkeys live behind "Other ways in" for people who want the shortcut.
function initSync() {
  const keep = el('psKeep');
  if (!keep) return;
  const note = el('psSyncNote');
  const byMail = () => {
    const l = linked();
    return !!(l && String(l.credId || '').startsWith('m:'));
  };
  // ⚠️ initSync() RUNS AGAIN after the network pass — a magic-link login flips
  // the row from "log in" to "saved". Listeners are wired ONCE; a second set
  // would send two login mails per click.
  if (!syncWired) {
    syncWired = true;
    wireLink(note);
    wireMail(note);
    wireNews();
    // ⚠️ logging out drops the CREDENTIAL, not the save file — see logout().
    el('psLogout').addEventListener('click', () => {
      logout();
      passToast('👋 <b>LOGGED OUT</b><br>Your bananas stay on this device — your garden and your home wait on your account until you log back in.');
      setTimeout(() => location.reload(), 900);
    });
    if (passkeysSupported()) {
      el('psSave').addEventListener('click', async () => {
        note.textContent = 'Your device will ask to confirm — that’s the passkey being made…';
        try {
          await savePass();
          initSync();   // the row is linked now — same path, no reload
          passToast('🔐 <b>SET UP</b> — Face ID or your fingerprint logs you in on this device now.');
        } catch (e) {
          note.textContent = e && e.name === 'NotAllowedError'
            ? 'No worries — nothing was saved. Try again whenever you like.'
            : 'That didn’t work — try again in a moment.';
        }
      });
      el('psRestore').addEventListener('click', async () => {
        note.textContent = 'Pick the banana-world passkey on your device…';
        try {
          await restorePass();
          passToast('🎫 <b>WELCOME BACK</b><br>You’re logged in on this device now.');
          setTimeout(() => location.reload(), 1200); // redraw the card with the merged world
        } catch (e) {
          note.textContent = e && e.name === 'NotAllowedError'
            ? 'No worries — nothing happened.'
            : 'No passkey here yet — use your email instead and it works anywhere.';
        }
      });
    }
  }
  // the passkey shortcut only exists where the browser has one, and only while
  // you are OUT
  el('psAlt').hidden = !(passkeysSupported() && !linked());
  if (!linked()) {
    keep.open = HAVE;
    note.textContent = HAVE ? 'Log in to keep ' + el('psName').textContent + ' — email only, no password' : LINE_OUT;
    return;
  }
  keep.open = false;
  note.textContent = LINE_IN;
  el('psPerks').hidden = true;
  el('psMailForm').hidden = byMail();   // an address is already on file
  el('psLink').hidden = false;
  el('psOut').hidden = false;
  if (byMail()) return;
  // 🪪 logged in by PASSKEY = no address on file yet, so offer one here. This is
  // the same field and the same link as signing in — clicking it ATTACHES the
  // address to this pass rather than starting a second one.
  // ⚠️ THE FIELD MEANS SOMETHING ELSE WHEN SOMEONE IS SIGNED IN: a second
  // person typing theirs on a shared tablet joins THIS pass instead of opening
  // their own, so they are told before they type.
  const whose = el('psMailWhose');
  let who = ''; try { who = (localStorage.getItem('ps-name-v1') || '').slice(0, 24); } catch (e) {}
  whose.innerHTML = 'You’re logged in' + (who ? ' as <b>' + who.replace(/[<>&]/g, '') + '</b>' : '')
    + '. This adds an email to <b>this</b> pass — if the banana on screen isn’t yours, log out first so you get your own.';
  whose.hidden = false;
  el('psMailGo').textContent = 'Add my email';
}

// ---- ✉️ email login: one field, one button -----------------------------
function wireMail(note) {
  const form = el('psMailForm');
  if (!form) return;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const go = el('psMailGo');
    const email = (el('psMailIn').value || '').trim();
    if (!email) return;
    go.disabled = true;
    note.textContent = 'Sending…';
    try {
      await mailSignin(email);
      // ⚠️ NEVER "we found your account" / "that address is new" — /mail/signin
      // deliberately answers the same either way so it cannot be used to test
      // whether somebody is a member. The inbox is the only channel that knows.
      // ⚠️ EVERY other way in goes away once the link is sent — the only next
      // action is "open your inbox", so nothing else should be on screen.
      form.hidden = true;
      el('psAlt').hidden = true;
      el('psPerks').hidden = true;
      const claim = el('psKeepClaim');
      claim.innerHTML = 'We sent a link to <b>' + esc(email) + '</b> — click it and '
        + (el('psMailWhose').hidden ? 'you’re in.' : 'it’s on your pass.')
        + ' The link works once, for 15 minutes. Not there? Check spam.';
      claim.hidden = false;
      note.textContent = 'Check your inbox';
    } catch (e) {
      note.textContent = (e && e.message) || 'Couldn’t send that — try again in a moment.';
      go.disabled = false;
    }
  });
}

// 📣 the news opt-in: ask, then let the inbox prove it
function wireNews() {
  const form = el('psAskForm');
  if (!form) return;
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const go = el('psNewsGo'), note = el('psNewsNote');
    const email = (el('psNewsIn').value || '').trim();
    if (!email) return;
    go.disabled = true;
    note.textContent = 'Sending…';
    try {
      await newsJoin(email);
      // ⚠️ "check your inbox", never "you're subscribed" — nobody is on the
      // list until the click, and saying otherwise would be the lie that makes
      // the double opt-in pointless
      el('psAskMail').hidden = true;
      el('psAskLead').innerHTML = '<b>One more click.</b>';
      note.textContent = 'Confirm it from the mail we just sent to ' + esc(email)
        + ' — until you do, you are not on any list.';
    } catch (e) {
      note.textContent = (e && e.message) || 'Couldn’t send that — try again in a moment.';
      go.disabled = false;
    }
  });
}

// 🔗 the magic link lands here as /pass/?in=<ticket>
// ⚠️ STRIP IT FROM THE URL IMMEDIATELY — and SYNCHRONOUSLY, before anything can
// await. It is a bearer credential: left in the address bar it rides into
// history, referrers and screenshots, and it is single-use, so a reload would
// spend it and look like a failure. SPENDING it is runLanding()'s job, off the
// critical path, so a slow worker can never hold the dashboard hostage.
function takeLanding() {
  const q = new URLSearchParams(location.search);
  // 📣 the news confirmation lands here too — same strip-it-from-the-URL rule
  const news = q.get('news'), t = q.get('in');
  if (!news && !t) return null;
  history.replaceState(null, '', location.pathname + location.hash);
  return news ? { kind: 'news', t: news } : { kind: 'in', t };
}

// ⚠️ throws on failure — refuse to swallow it: refresh() owns the apology.
async function runLanding(l) {
  if (l.kind === 'news') {
    await newsConfirm(l.t);
    try { localStorage.setItem(NEWS_KEY, '1'); } catch (e) {}   // the ask has been answered
    passToast('📣 <b>YOU’RE ON THE LIST</b><br>You’ll hear when the world gets bigger.');
    return;
  }
  const { attached } = await mailUse(l.t);
  passPush();                    // this device's world joins the account
  // 🎫 THE ROUND TRIP HAS TO PAY OFF: they left the site, opened a mail and came
  // back — the card stamps itself so the login is something you can SEE.
  el('psCard').classList.add('ps-card--stamped');
  passToast(attached
    ? '✉️ <b>EMAIL ADDED</b><br>You can log in with it on any device now.'
    : '🎫 <b>LOGGED IN</b><br>Welcome to Banana World.');
}
