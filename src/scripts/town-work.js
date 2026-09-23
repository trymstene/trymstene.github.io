// 💼 TOWN WORK — taking a job, and turning up to it (19 Sep 2026, docs/town-jobs-plan.md §3).
//
// A lazy chunk: nothing here loads until the town has stood up, and nothing in it runs for a player
// who never asks anyone for a job. The server half is worker-pass (/job/take, /job/chore, /job/pay)
// and it is the authority on every coin; this file is the world's side of the same conversation.
//
// ⭐ YOU ASK THE WAY YOU ASK ANYTHING ELSE. Three residents can hire you — Pip at the general store,
// Spinner at the arcade, Bean at the Coffee Cup — and the question sits on their dialogue card
// beside the two they already answer. No new card, no new button, no shop-window UI: the world
// already had a way to ask somebody something, and this is it (memory: reuse-world-ui-grammar).
//
// ⚠️ THE DIALOGUE TYPES A STRING, NOT A PROMISE. world-dialogue.js does `typeof t.a === 'function'
// ? t.a() : t.a` and types the result, so an answer cannot wait for a fetch. That is why there is a
// MIRROR of the job state on the device: it picks the sentence, the request goes out behind it, and
// the server's answer corrects the mirror. The mirror never decides money — it only decides which
// of four already-approved lines the boss says.
import { passPost } from '../lib/banana-pass.js';
import { rowsOf, payOf, shareOf, LADDER, DAY_XP, rankOf, xpFor, COUNTS_AS, dayCap, MEMENTO, ranksOf } from '../data/town/jobs.js';
import { grantToShed } from '../lib/homestead-inventory.js';   // 📜 a boss's memento goes to your homestead's shed   // 💼 the one arithmetic the cheque uses (22 Sep 2026), 🪜 and the ladder's (23 Sep)

const MIRROR = 'tw-job-v1';
// which resident runs which building, and the prop key their work is at
const BOSS = { pip: 'store', spinner: 'condo', bean: 'cafe', stamp: 'post', figjr: 'stand' };   // ✉️ Stamp hires at the post office, 🍋 Fig Jr. at the lemonade stand (22 Sep 2026)
// 🍋 a workplace with no PROPS entry (the stand is baked scenery with a spot): where turning up is measured from
const MARKS = { stand: { x: 890, y: 545 } };
const markOf = (PROPS, at) => { const p = PROPS && PROPS[at]; if (p) return { x: p.x + p.w / 2, y: p.base }; return MARKS[at] || null; };
const NEAR = 120;   // how close to your own workplace counts as turning up, in world px

const readJob = () => { try { return JSON.parse(localStorage.getItem(MIRROR) || 'null') || {}; } catch (e) { return {}; } };
const writeJob = (j) => { try { localStorage.setItem(MIRROR, JSON.stringify(j)); } catch (e) {} };
// ⚠️ A LINK IS NOT A KEPT PASS. An anonymous pass is real and syncing and has a credId and a token
// like any other — its id just starts with 'a:' (world-hud.js saveAtRisk uses the same test for the
// "not saved" pill). Testing for the link alone made Bean type "Gladly" at a phone the server was
// about to refuse with , and the optimistic mirror below then answered "already" forever after.
const hasPass = () => { try { const l = JSON.parse(localStorage.getItem('pass-link') || 'null'); return !!(l && l.credId && l.token && !String(l.credId).startsWith('a:')); } catch (e) { return false; } };
const KEEP_HREF = '/pass/?keep';

export function bootTownWork(ctx) {
  const { pos, PROPS, say, track, copy } = ctx;
  const W = () => copy() || {};
  let job = readJob();
  // 🪜 THE LADDER'S WORDS — the ranks' titles and each boss's promotion line (src/data/copy/town-staff.json, the staff
  // card's own file). Loaded only for somebody who holds a job: a visitor who never asks a boss downloads none of it.
  let LW = null, lwP = null;
  const loadWords = () => { if (!lwP) lwP = import('../data/copy/town-staff.json').then((m) => { LW = m.default || m; notify(); return LW; }).catch(() => { lwP = null; return null; }); return lwP; };
  const titleOf = (at, rank) => (((LW && LW.ranks) || {})[at] || [])[Math.max(1, rank | 0) - 1] || '';
  let toldDay = '';   // the day we last said the quiet line, so it is said once
  const todayKey = () => new Date().toISOString().slice(0, 10);
  // 💼 the duties chip listens (town-duties.js): every landing, take or QA set says so
  const listeners = [];
  const notify = () => { for (const fn of listeners) { try { fn(); } catch (e) {} } };

  // the server's answer is the truth; the mirror follows it. ⚠️ `up`, `hm` and `told` are the
  // DEVICE's own (turned up today, the chip folded, what the chip has said) and ride along untouched.
  function land(res) {
    if (!res || res.error) return res;
    if (res.job) {
      const was = job.at || '';
      const l = res.job.lad;
      job = { ...job, at: res.job.at || '', week: res.job.week || '', days: res.job.days | 0, pay: res.job.pay | 0, sofar: res.job.sofar | 0, owed: res.job.owed | 0,
        duties: Array.isArray(res.job.duties) ? res.job.duties : [], share: +res.job.share || 0, nudge: !!res.job.nudge, fired: res.job.fired || null,
        // 🪜 the ladder at the job you hold: XP, the rank your boss has told you, today's XP (worker-pass ladderOf)
        lad: l && typeof l === 'object' ? { xp: l.xp | 0, rank: Math.max(1, l.rank | 0), today: l.today | 0, d: todayKey(),
          warn: !!l.warn, talk: l.talk || '', last: l.last || null } : null };   // ↕ the weekly review: warned, the boss's word waiting, last week
      if (was !== job.at) job.up = '';
      // 💼 a job that is gone is REMEMBERED for a while: the homestead still asks for the payslip it owes
      if (was && !job.at) { job.was = was; job.wasT = Date.now(); }
      writeJob(job);
      if (job.at) loadWords();
    }
    notify();
    return res;
  }
  // the job as it stands, marking nothing — on boot, so the chip can speak before you turn up
  // (and once a day for a job you no longer hold, so the sack still reaches the note)
  function view() { if (!job.at && !job.fired) return; passPost('/job/view', {}).then(land); }
  view();
  if (job.at) loadWords();
  // 💼 A CHORE, BY KIND (docs/town-jobs-plan.md §12): the town says "swept", "fixed", "restocked" as it
  // happens. The mirror moves at once (the chip must answer the broom in the same beat), the server's
  // count replaces it when the answer lands — the same optimism a take has, corrected the same way.
  // 🪜 AND IT EARNS WORK XP (23 Sep 2026): `g` is the cup's grade, a round's points, or a counter's whole shift as a list of
  // grades. The mirror adds what the server will (the verb's worth, the day's ten, up to the day's cap), so the note and
  // the receipt move with the broom; the server's answer is the truth. Returns the XP the mirror predicted.
  function chore(kind, g) {
    if (!job.at) return Promise.resolve(null);
    const rows = Array.isArray(job.duties) && job.duties.length ? job.duties : rowsOf(job.at, {});
    const done = {}; for (const r of rows) done[r.kind] = r.done | 0;
    const dk = COUNTS_AS[kind] || kind;   // 🧺 a basket is a customer served, as the server counts it
    if (dk in done) done[dk] = done[dk] + 1;
    const lad = ladder(), fresh = job.up !== todayKey();
    let add = fresh ? DAY_XP : 0;
    for (const x of Array.isArray(g) ? g : [g]) add += xpFor(job.at, kind, x);
    const got = Math.max(0, Math.min(add, dayCap(job.at, lad.rank) - lad.today));   // 🔓 the rank's day
    job = { ...job, duties: rowsOf(job.at, done), share: shareOf(job.at, done), sofar: payOf(job.at, done, lad.rank), up: todayKey(),
      lad: { ...(job.lad || {}), xp: lad.xp + got, rank: lad.rank, today: lad.today + got, d: todayKey() } };
    writeJob(job); notify();
    const p = passPost('/job/chore', g == null ? { kind } : { kind, g }).then(land);
    p.got = got;
    return p;
  }
  // 🪜 the ladder at the job you hold, as the mirror knows it: today's XP resets with the day
  function ladder() {
    const l = job.lad || {};
    const xp = l.xp | 0, rank = Math.max(1, l.rank | 0), today = l.d === todayKey() ? (l.today | 0) : 0;
    return { at: job.at || '', xp, rank, today, earned: job.at ? rankOf(job.at, xp) : 0, news: !!job.at && rankOf(job.at, xp) > rank,
      warn: !!l.warn, talk: l.talk || '', last: l.last || null };
  }

  // ---- the question on a boss's card ------------------------------------------------------
  // ⚠️ returns a plain {q, a} or null — the shape world-dialogue.js already takes, so the card that
  // opens is the same card every resident has always had.
  function topicFor(key) {
    const at = BOSS[key];
    if (!at) return null;
    const w = W();
    if (!w.ask) return null;   // the words are still on their way: no half-built question
    let asked = '';   // what the last answer was, so the card knows whether to leave a door open
    return {
      q: w.ask,
      // ⭐ THE DEAD END, ANSWERED. "You need a kept pass" with nothing to tap is where a newcomer puts
      // the phone down — so the answer that says no also opens the world's own save door, the same
      // /pass/?keep the HUD's "not saved" pill opens.
      cta: () => (asked === 'keep' && w.keepCta ? { href: KEEP_HREF, label: w.keepCta } : null),
      // 💼 THE MOMENT YOU ARE HIRED (Trym, 22 Sep: "the dialogue window should close … then splash"): on a yes the
      // boss's card closes itself after their line, and then the world celebrates — only if the job is still
      // yours by then (a take the server refused has already been rolled back)
      after: () => (asked === 'took' && typeof ctx.hired === 'function' ? () => { if (job.at === at) ctx.hired(at); } : null),
      a: () => {
        // ⭐ answered from what this device already knows, because the card types a string NOW.
        // The only answer the server could still overturn is `keep`, and that one the device can
        // tell on its own: no kept pass, no link.
        if (!hasPass()) { asked = 'keep'; track('town_job', { at, r: 'keep' }); return w.keep || ''; }
        asked = '';
        if (job.at === at) { track('town_job', { at, r: 'already' }); return w.already || '';
        }
        // 💼 ONE JOB AT A TIME, SAID OUT LOUD (Trym, 22 Sep: "there should be a message saying that i need to quit my
        // job at <place> if i try to get a job somewhere else"). Asking a second boss used to move you with the
        // `moved` line; now the boss says you are somebody else's, names the place, and nothing changes — the way
        // out is your own boss's card (the quit topic below).
        if (job.at && job.at !== at) { track('town_job', { at, r: 'busy' }); return (w.busy || '').replace('{where}', nameOf(job.at)); }
        const before = job.at || '';   // what to put back if the server refuses the take
        const line = (w.hired || '').replace('{where}', nameOf(at));
        asked = 'took';
        track('town_job', { at, r: 'took' });
        passPost('/job/take', { at }).then((res) => {
          land(res);
          if (res && res.ref) { job = { ...job, ref: res.ref }; writeJob(job); }   // 📜 a reference started you higher: the hire says so
          // the one case the device could not know: a link that is still an unkept pass
          // ⚠️ AND THE OPTIMISM IS ROLLED BACK. Without this the mirror kept a job the server refused,
          // so every later ask answered 'already' about work nobody had given you.
          if (res && res.error === 'keep') { job = { ...job, at: before }; writeJob(job); if (w.keep) say(w.keep); }
        });
        // optimistic, and honestly so: if the server refuses, the line above corrects it
        job = { ...job, at, up: '', lad: null };   // 🪜 a new workplace's ladder comes back with the server's answer
        loadWords();
        writeJob(job);
        notify();
        return line;
      },
    };
  }
  // 💼 LEAVING, at your own asking: a second topic on your OWN boss's card, only while you hold the job. The mirror
  // lets go at once (the card types a string now), the server confirms with an empty take.
  function quitFor(key) {
    const at = BOSS[key];
    const w = W();
    if (!at || !w.quit || !w.quitDone || job.at !== at) return null;
    return {
      q: w.quit,
      a: () => {
        if (job.at !== at) return w.already ? '' : '';
        track('town_job', { at, r: 'quit' });
        passPost('/job/take', { at: '' }).then(land);
        job = { ...job, at: '', was: at, wasT: Date.now(), up: '', duties: [], share: 0, sofar: 0, nudge: false };
        writeJob(job);
        notify();
        return w.quitDone || '';
      },
    };
  }
  // 🪜 THE BOSS HAS NEWS (23 Sep 2026; Trym: promotion happens AT THE BOSS). XP past the next rank's line puts this topic
  // FIRST on your own boss's card. The boss tells you in their own words, the card closes itself, and then PROMOTED goes up
  // over the square — the hire's own order (world-dialogue.js `after`). The rank is the one the XP has earned, however
  // many lines you crossed while you stayed away; /job/promote makes it yours on the server, and its answer corrects this.
  function promoFor(key) {
    const at = BOSS[key], l = ladder(), w = W();
    const line = LW && LW.promo && LW.promo[key];
    if (!at || job.at !== at || !l.news || !line || !LW.promoQ) return null;
    let told = 0;
    return {
      news: true,   // banana-town puts it first on the card
      q: LW.promoQ,
      after: () => (told && typeof ctx.promoted === 'function' ? () => { if (job.at === at) ctx.promoted(at, told); } : null),
      a: () => {
        const n = ladder();
        if (!n.news) return w.already || '';
        told = n.earned;
        track('town_promo', { at, rank: told });
        passPost('/job/promote', { at }).then(land);
        job = { ...job, lad: { ...(job.lad || {}), xp: n.xp, rank: told, today: n.today, d: todayKey() } };
        writeJob(job); notify();
        return line.replace('{title}', titleOf(at, told));
      },
    };
  }
  // ↕ THE BOSS HAS A WORD (23 Sep 2026, the weekly review): a poor week under your rank's line left a WARNING for the boss to
  // say, or — the second time — a DEMOTION. The rank has already moved on the server (nobody dodges a demotion by staying
  // away from the boss); this is you hearing it, in the boss's own words, and /job/promote clears it.
  function wordFor(key) {
    const at = BOSS[key], l = ladder();
    if (!at || job.at !== at || !l.talk || !LW || !LW.wordQ || !((LW[l.talk] || {})[key])) return null;
    return {
      news: true,
      q: LW.wordQ,
      a: () => {
        const n = ladder(), k = n.talk;
        const line = k && (LW[k] || {})[key];
        if (!line) return W().already || '';
        track(k === 'demoted' ? 'town_demote' : 'town_warn', { at, rank: n.rank });
        passPost('/job/promote', { at }).then(land);
        job = { ...job, lad: { ...(job.lad || {}), talk: '' } };
        writeJob(job); notify();
        return line.replace('{title}', titleOf(at, k === 'warn' ? n.rank - 1 : n.rank));   // a warning names the rank you would drop to
      },
    };
  }
  // every topic a boss's card carries for you: the news first (a promotion, or the boss's word), the job question, and the way out
  const topicsFor = (key) => [promoFor(key) || wordFor(key), topicFor(key), quitFor(key)].filter(Boolean);
  // ⚠️ the building's name comes from the RIG, not from the sign plank: the planks shout (“ARCADE”)
  // and two of the three are empty because the sprite carries its own sign. work.at holds the three
  // names written to sit inside a sentence, article and all.
  const nameOf = (at) => ((W().at || {})[at] || at);

  // ---- turning up ---------------------------------------------------------------------------
  // ⚠️ THE DAY IS THE SERVER'S TO COUNT. This only notices that you are at your own workplace and
  // says so; /job/chore decides whether that is a new day, and a second call on the same day is the
  // same day however many times it is made. The mirror's `days` comes back from the answer.
  let askAt = 0;
  function tick(now) {
    if (!job.at || now - askAt < 4000) return;
    const m = markOf(PROPS, job.at);
    if (!m) return;
    if (Math.hypot(pos.x - m.x, pos.y - m.y) > NEAR) return;
    askAt = now;
    const day = new Date().toISOString().slice(0, 10);
    if (toldDay === day) return;
    passPost('/job/chore', {}).then((res) => {
      if (res && !res.error) { job.up = day; writeJob(job); }   // 💼 turned up today: the chip turns from the duty to the wage
      land(res);
      if (res && res.error) return;
      toldDay = day;
      const w = W();
      if (w.day) say(w.day);
    });
  }

  return {
    tick,
    topicFor, topicsFor,
    seam: {
      job: () => ({ ...job }),
      bosses: () => ({ ...BOSS }),
      // ⚠️ the walk's door: it cannot keep a pass, so it drives the module rather than the server
      set: (j) => { job = { at: '', week: '', days: 0, pay: 0, sofar: 0, owed: 0, up: '', duties: [], share: 0, nudge: false, fired: null, ...(j || {}) }; if (job.at && !(job.duties || []).length) job.duties = rowsOf(job.at, {}); writeJob(job); notify(); if (job.at) loadWords(); },
      // 💼 for the work note: the mirror as one plain object, plus whether you have turned up today
      state: () => ({ at: job.at || '', days: job.days | 0, pay: job.pay | 0, sofar: job.sofar | 0, owed: job.owed | 0, turnedUp: !!job.at && job.up === todayKey(),
        duties: Array.isArray(job.duties) ? job.duties : [], share: +job.share || 0, nudge: !!job.nudge, fired: job.fired || null, lad: ladder() }),
      // 🪜 the ladder: where you stand, the words it is told in (null until they land), and a title by rank
      ladder, words: () => LW, title: titleOf, wordsReady: loadWords,
      // ⚠️ the walk's door to the ladder: XP and a told rank, as the server would have answered them
      // 📜 THE MEMENTO at a workplace's top rank: into the homestead's shed ONCE (tw-memento-v1), and the line that says so — or,
      // with the shed full, the line that says it waits, and it is tried again the next time the town asks
      memento: (at) => {
        const id = MEMENTO[at]; if (!id || !LW) return '';   // no words yet: nothing is given without its line
        let given = {}; try { given = JSON.parse(localStorage.getItem('tw-memento-v1') || '{}') || {}; } catch (e) {}
        if (given[at]) return '';
        if (!grantToShed(id)) return ((LW || {}).mementoFull) || '';
        given[at] = 1; try { localStorage.setItem('tw-memento-v1', JSON.stringify(given)); } catch (e) {}
        return (((LW || {}).memento) || {})[at] || '';
      },
      mementoDue: () => { const l = ladder(); if (!job.at || !MEMENTO[job.at] || l.rank < ranksOf(job.at)) return false; try { return !(JSON.parse(localStorage.getItem('tw-memento-v1') || '{}') || {})[job.at]; } catch (e) { return true; } },
      setLad: (l) => { job = { ...job, lad: { xp: (l && l.xp) | 0, rank: Math.max(1, (l && l.rank) | 0), today: (l && l.today) | 0, d: todayKey(), warn: !!(l && l.warn), talk: (l && l.talk) || '', last: (l && l.last) || null } }; writeJob(job); notify(); return ladder(); },
      word: (key) => { const t = wordFor(key); return t ? { q: t.q, a: t.a() } : null; },
      promote: (key) => { const t = promoFor(key); return t ? { q: t.q, a: t.a() } : null; },
      turnUp: () => { job.up = todayKey(); job.days = (job.days | 0) + 1; writeJob(job); notify(); },   // QA: the day counted
      chore,
      onChange: (fn) => { if (typeof fn === 'function') listeners.push(fn); },
      folded: () => !!job.hm, fold: (v) => { job.hm = v ? 1 : 0; writeJob(job); },
      told: () => job.told || '', tell: (k) => { job.told = k; writeJob(job); },
      view,
      ask: (key) => { const t = topicFor(key); return t ? { q: t.q, a: t.a() } : null; },
      quit: (key) => { const t = quitFor(key); return t ? { q: t.q, a: t.a() } : null; },
      near: () => { const m = job.at && markOf(PROPS, job.at); return !!m && Math.hypot(pos.x - m.x, pos.y - m.y) <= NEAR; },
    },
  };
}
