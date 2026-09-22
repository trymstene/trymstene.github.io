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
import { rowsOf, payOf, shareOf } from '../data/town/jobs.js';   // 💼 the one arithmetic the cheque uses (22 Sep 2026)

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
      job = { ...job, at: res.job.at || '', week: res.job.week || '', days: res.job.days | 0, pay: res.job.pay | 0, sofar: res.job.sofar | 0, owed: res.job.owed | 0,
        duties: Array.isArray(res.job.duties) ? res.job.duties : [], share: +res.job.share || 0, nudge: !!res.job.nudge, fired: res.job.fired || null };
      if (was !== job.at) job.up = '';
      writeJob(job);
    }
    notify();
    return res;
  }
  // the job as it stands, marking nothing — on boot, so the chip can speak before you turn up
  // (and once a day for a job you no longer hold, so the sack still reaches the note)
  function view() { if (!job.at && !job.fired) return; passPost('/job/view', {}).then(land); }
  view();
  // 💼 A CHORE, BY KIND (docs/town-jobs-plan.md §12): the town says "swept", "fixed", "restocked" as it
  // happens. The mirror moves at once (the chip must answer the broom in the same beat), the server's
  // count replaces it when the answer lands — the same optimism a take has, corrected the same way.
  function chore(kind) {
    if (!job.at) return Promise.resolve(null);
    const rows = Array.isArray(job.duties) && job.duties.length ? job.duties : rowsOf(job.at, {});
    const done = {}; for (const r of rows) done[r.kind] = r.done | 0;
    if (kind in done) done[kind] = done[kind] + 1;
    job = { ...job, duties: rowsOf(job.at, done), share: shareOf(job.at, done), sofar: payOf(job.at, done), up: todayKey() };
    writeJob(job); notify();
    return passPost('/job/chore', { kind }).then(land);
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
      a: () => {
        // ⭐ answered from what this device already knows, because the card types a string NOW.
        // The only answer the server could still overturn is `keep`, and that one the device can
        // tell on its own: no kept pass, no link.
        if (!hasPass()) { asked = 'keep'; track('town_job', { at, r: 'keep' }); return w.keep || ''; }
        asked = '';
        if (job.at === at) { track('town_job', { at, r: 'already' }); return w.already || '';
        }
        const before = job.at || '';   // what to put back if the server refuses the take
        const line = (job.at ? (w.moved || '') : (w.hired || '')).replace('{where}', nameOf(at));
        track('town_job', { at, r: job.at ? 'moved' : 'took' });
        passPost('/job/take', { at }).then((res) => {
          land(res);
          // the one case the device could not know: a link that is still an unkept pass
          // ⚠️ AND THE OPTIMISM IS ROLLED BACK. Without this the mirror kept a job the server refused,
          // so every later ask answered 'already' about work nobody had given you.
          if (res && res.error === 'keep') { job = { ...job, at: before }; writeJob(job); if (w.keep) say(w.keep); }
        });
        // optimistic, and honestly so: if the server refuses, the line above corrects it
        job = { ...job, at, up: '' };
        writeJob(job);
        notify();
        return line;
      },
    };
  }
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
    topicFor,
    seam: {
      job: () => ({ ...job }),
      bosses: () => ({ ...BOSS }),
      // ⚠️ the walk's door: it cannot keep a pass, so it drives the module rather than the server
      set: (j) => { job = { at: '', week: '', days: 0, pay: 0, sofar: 0, owed: 0, up: '', duties: [], share: 0, nudge: false, fired: null, ...(j || {}) }; if (job.at && !(job.duties || []).length) job.duties = rowsOf(job.at, {}); writeJob(job); notify(); },
      // 💼 for the work note: the mirror as one plain object, plus whether you have turned up today
      state: () => ({ at: job.at || '', days: job.days | 0, pay: job.pay | 0, sofar: job.sofar | 0, owed: job.owed | 0, turnedUp: !!job.at && job.up === todayKey(),
        duties: Array.isArray(job.duties) ? job.duties : [], share: +job.share || 0, nudge: !!job.nudge, fired: job.fired || null }),
      turnUp: () => { job.up = todayKey(); job.days = (job.days | 0) + 1; writeJob(job); notify(); },   // QA: the day counted
      chore,
      onChange: (fn) => { if (typeof fn === 'function') listeners.push(fn); },
      folded: () => !!job.hm, fold: (v) => { job.hm = v ? 1 : 0; writeJob(job); },
      told: () => job.told || '', tell: (k) => { job.told = k; writeJob(job); },
      view,
      ask: (key) => { const t = topicFor(key); return t ? { q: t.q, a: t.a() } : null; },
      near: () => { const m = job.at && markOf(PROPS, job.at); return !!m && Math.hypot(pos.x - m.x, pos.y - m.y) <= NEAR; },
    },
  };
}
