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

const MIRROR = 'tw-job-v1';
// which resident runs which building, and the prop key their work is at
const BOSS = { pip: 'store', spinner: 'condo', bean: 'cafe' };
const NEAR = 120;   // how close to your own workplace counts as turning up, in world px

const readJob = () => { try { return JSON.parse(localStorage.getItem(MIRROR) || 'null') || {}; } catch (e) { return {}; } };
const writeJob = (j) => { try { localStorage.setItem(MIRROR, JSON.stringify(j)); } catch (e) {} };
const hasPass = () => { try { const l = JSON.parse(localStorage.getItem('pass-link') || 'null'); return !!(l && l.credId && l.token); } catch (e) { return false; } };

export function bootTownWork(ctx) {
  const { pos, PROPS, say, track, copy } = ctx;
  const W = () => copy() || {};
  let job = readJob();
  let toldDay = '';   // the day we last said the quiet line, so it is said once

  // the server's answer is the truth; the mirror follows it
  function land(res) {
    if (!res || res.error) return res;
    if (res.job) { job = { at: res.job.at || '', week: res.job.week || '', days: res.job.days | 0 }; writeJob(job); }
    return res;
  }

  // ---- the question on a boss's card ------------------------------------------------------
  // ⚠️ returns a plain {q, a} or null — the shape world-dialogue.js already takes, so the card that
  // opens is the same card every resident has always had.
  function topicFor(key) {
    const at = BOSS[key];
    if (!at) return null;
    const w = W();
    if (!w.ask) return null;   // the words are still on their way: no half-built question
    return {
      q: w.ask,
      a: () => {
        // ⭐ answered from what this device already knows, because the card types a string NOW.
        // The only answer the server could still overturn is `keep`, and that one the device can
        // tell on its own: no kept pass, no link.
        if (!hasPass()) { track('town_job', { at, r: 'keep' }); return w.keep || ''; }
        if (job.at === at) { track('town_job', { at, r: 'already' }); return w.already || '';
        }
        const line = (job.at ? (w.moved || '') : (w.hired || '')).replace('{where}', nameOf(at));
        track('town_job', { at, r: job.at ? 'moved' : 'took' });
        passPost('/job/take', { at }).then((res) => {
          land(res);
          // the one case the device could not know: a link that is still an unkept pass
          if (res && res.error === 'keep' && w.keep) say(w.keep);
        });
        // optimistic, and honestly so: if the server refuses, the line above corrects it
        job = { ...job, at };
        writeJob(job);
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
    const p = PROPS[job.at];
    if (!p) return;
    const cx = p.x + p.w / 2;
    if (Math.hypot(pos.x - cx, pos.y - p.base) > NEAR) return;
    askAt = now;
    const day = new Date().toISOString().slice(0, 10);
    if (toldDay === day) return;
    passPost('/job/chore', {}).then((res) => {
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
      set: (j) => { job = { at: '', week: '', days: 0, ...(j || {}) }; writeJob(job); },
      ask: (key) => { const t = topicFor(key); return t ? { q: t.q, a: t.a() } : null; },
      near: () => { const p = job.at && PROPS[job.at]; return !!p && Math.hypot(pos.x - (p.x + p.w / 2), pos.y - p.base) <= NEAR; },
    },
  };
}
