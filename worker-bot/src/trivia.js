// ❓ BANANA TRIVIA (Trym, 1 Oct 2026: "add the weekly poll and trivia"). /trivia puts one question on the board with
// four buttons; anybody may answer once, privately told right or wrong (and why), while the card counts who answered.
// The questions are written facts a player can see for themselves (src/data/copy/bananabot.json `trivia.questions`,
// the first answer always the right one — the buttons are shuffled when a question is asked).
import W from '../../src/data/copy/bananabot.json' with { type: 'json' };
import { YELLOW, fill } from './commands.js';

const Q = () => W.trivia.questions || [];
const RECENT = 12;      // a question is not asked again until this many others have been
const KEEP = 150;       // rounds kept for late answers; the oldest are let go

/** A fresh round: which question, in which button order. Pure, so the order can be tested. */
export function newRound(recent, rand = Math.random) {
  const all = Q();
  const fresh = all.map((_, i) => i).filter((i) => !recent.includes(i));
  const pool = fresh.length ? fresh : all.map((_, i) => i);
  const q = pool[Math.floor(rand() * pool.length)];
  const order = all[q].a.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return { q, order, answered: {}, n: 0, right: 0 };
}

/** The question card: the question, four buttons, and the tally once anybody has answered. */
export function card(id, round) {
  const item = Q()[round.q];
  return {
    embeds: [{
      color: YELLOW, title: W.trivia.title, description: item.q,
      ...(round.n ? { footer: { text: fill(W.trivia.tally, { n: round.n, right: round.right }) } } : {}),
    }],
    components: [{ type: 1, components: round.order.map((ai, k) => ({ type: 2, style: 2, label: String(item.a[ai]).slice(0, 80), custom_id: 'tv:' + id + ':' + k })) }],
  };
}

/** What an answer did: { line, right } for the one who pressed, or { again } / { gone }. Mutates the round. */
export function answer(round, user, k) {
  if (!round) return { gone: true };
  if (round.answered[user] != null) return { again: true };
  const item = Q()[round.q];
  if (!item || round.order[k] == null) return { gone: true };
  const ok = round.order[k] === 0;
  round.answered[user] = k;
  round.n += 1;
  if (ok) round.right += 1;
  return { right: ok, line: ok ? fill(W.trivia.right, { fact: item.fact }) : fill(W.trivia.wrong, { answer: item.a[0], fact: item.fact }) };
}

export const TRIVIA = { RECENT, KEEP };
