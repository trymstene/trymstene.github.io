// ── THE ANALYST ───────────────────────────────────────────────────────────
// Trym, 1 Aug 2026: "a voice to explain what the analyst see, and what it
// means so far, thoughts about what we should add, or remove — reflections
// basically based on hard facts."
//
// Trym, 3 Sep 2026, after reading it for a month: "it never feels like the
// analyst actually checks the data and analyses it day by day - it seems the
// analysis is just the same each time with new numbers... it's basically said
// the same with 300 visits from an ad a day, to when it's 42 visits organically."
//
// He was right, for two separate reasons, and both are fixed here:
//
//   1. THE LEVEL CHECK FIRED ALMOST EVERY DAY and carried the top weight, so
//      the report literally opened with "The site has moved to a different
//      level" every morning. The test compared two short windows at 35% on a
//      site whose daily traffic swings by more than that on its own. It is now
//      a three-part test in evidence.js and it stays quiet on ordinary weeks.
//
//   2. NOTHING KNEW WHAT IT HAD ALREADY SAID. Every fact now carries
//      daysRunning, and a finding on its second morning cannot lead again. That
//      one rule is what stops the report repeating itself.
//
// ⚠️ THE HOROSCOPE RULE, kept and strengthened. This must be allowed to say
// "nothing happened" and "that sample is too small to call". An analyst who
// finds a story every single day is not an analyst.
//
// ⚠️ THE SHAPE OF THE REPORT VARIES. A level-change morning, a money morning
// and a quiet morning are different documents, not one document with different
// numbers in it. See shapeOf().
//
// Pure functions — no fetch, no env. index.js gathers; writer.js may narrate.

import { buildPack, MIN_RATE_N, moveWord, rate } from './evidence.js';

const byLoudness = (a, b) => (b.sig - a.sig) || (Math.abs(b.z || 0) - Math.abs(a.z || 0));

// ── THE SHAPE ─────────────────────────────────────────────────────────────
// What KIND of morning is this? The answer changes what the report is, not
// just what it says.
function shapeOf(pack) {
  const f = (id) => pack.facts.find((x) => x.id === id);
  if (f('blackout')) return 'blackout';
  if (f('money') && f('money').value > 0) return 'money';
  const level = f('level');
  if (level && level.daysRunning <= 1) return 'level';
  const fresh = pack.facts.filter((x) => x.sig >= 2 && x.daysRunning <= 1);
  if (fresh.length) return 'break';
  if (pack.sampleIsThin) return 'thin';
  // ⚠️ NOT "quiet". A day inside a level the site only just moved to is an
  // ordinary day, but saying "nothing needs you" under a headline that halved
  // the traffic reads as a report that has not looked at itself.
  if (level) return 'settled';
  return 'quiet';
}

// ── CROSS-FACTS ───────────────────────────────────────────────────────────
// The whole value over the dashboard: noticing that two numbers together mean
// something neither means alone. These are the only sentences here that are not
// a restatement of one row, so they are worth more than the rest of the file.
function crossFacts(pack) {
  const out = [];
  const f = (id) => pack.facts.find((x) => x.id === id);
  const S = f('sessions'), E = f('engagement'), D = f('downloads');

  // fewer people, better people — the ad was the low-quality half
  if (S && E && S.deltaPct != null && S.deltaPct <= -25 && E.value - E.base >= 5) {
    out.push({ icon: '⚖️', text: 'Traffic ' + moveWord(S.deltaPct) + ' but engagement went UP, '
      + E.value + '% against ' + E.base + '%. Whatever left was the half that was not '
      + 'interested — the people still arriving are a better audience than the week average '
      + 'suggested.' });
  }
  // more people, worse people — the signature of the wrong audience
  if (S && E && S.deltaPct != null && S.deltaPct >= 25 && E.base - E.value >= 5) {
    out.push({ icon: '⚠️', text: 'More people and a worse crowd: sessions ' + moveWord(S.deltaPct)
      + ' while engagement fell to ' + E.value + '% from ' + E.base + '%. Extra volume that '
      + 'engages less than usual is the wrong audience, not a win.' });
  }
  // the awareness channel held while the site moved — so the GIF audience is
  // structural and the swing was bought
  if (S && D && S.deltaPct != null && Math.abs(S.deltaPct) >= 30
    && D.deltaPct != null && Math.abs(D.deltaPct) <= 15) {
    out.push({ icon: '🎬', text: 'Sessions ' + moveWord(S.deltaPct) + ' but GIF downloads barely '
      + 'moved (' + D.value + ' against ' + D.base + '). The file-grabbers are the steady part '
      + 'of this business; the swing came from somewhere else.' });
  }
  // a busy day that produced no checkout at all
  const money = f('money'), worst = f('funnel:worst');
  if (money && money.value === 0 && S && S.value > pack.baselineSessions * 1.2 && worst) {
    out.push({ icon: '🚪', text: 'A busier day than usual that produced no checkout at all. '
      + 'Traffic is not the constraint right now — ' + worst.because + ' is.' });
  }
  return out;
}

// ── the deterministic report ──────────────────────────────────────────────
// This is what he reads when there is no writer key set, and it is also the
// fallback whenever the writer is unreachable or invents a number. It has to
// stand on its own.
function narrate(pack) {
  const shape = shapeOf(pack);
  const f = (id) => pack.facts.find((x) => x.id === id);
  const S = pack.sessions;
  const body = [];
  const reads = [];
  const recs = [];
  const rec = (text, because) => { if (recs.length < 2) recs.push({ text, because }); };

  const loud = pack.facts.filter((x) => x.sig >= 2).sort(byLoudness);
  const fresh = loud.filter((x) => x.daysRunning <= 1);
  const ongoing = loud.filter((x) => x.daysRunning >= 2);

  let verdict = 'notable';
  let headline = '';

  // ⚠️ ONGOING FINDINGS GET ONE CLAUSE, NEVER THE HEADLINE. This is the rule
  // that answers Trym's actual complaint.
  // (a fact the body already narrates is not repeated here — the settled shape
  // opens with the level, so the level must not also appear in this line)
  const narrated = new Set(shape === 'settled' || shape === 'level' ? ['level']
    : shape === 'money' ? ['money'] : []);
  const still = ongoing.filter((x) => !narrated.has(x.id));
  const stillLine = still.length
    ? 'Still true from previous mornings, and I will not lead with them again: '
      + still.map((x) => x.label + ' (' + x.because + ', day ' + x.daysRunning + ')').join('; ') + '.'
    : null;

  if (shape === 'blackout') {
    verdict = 'notable';
    headline = 'Yesterday recorded no sessions at all.';
    body.push(f('blackout').say);
    rec('Load the site yourself and watch the live pulse for your own hit. If nothing '
      + 'arrives, the measurement broke rather than the traffic — and every baseline on '
      + 'this page is wrong until it is fixed.', f('blackout').because);
  } else if (shape === 'money') {
    verdict = 'notable';
    const m = f('money');
    headline = m.value + ' purchase' + (m.value > 1 ? 's' : '') + ' yesterday.';
    body.push(m.say);
    body.push('Everything else, for context: ' + S + ' sessions, '
      + f('engagement').value + '% engaged.');
  } else if (shape === 'level') {
    verdict = 'notable';
    const L = f('level');
    headline = 'The site has settled at a new level, about ' + L.value + ' sessions a day.';
    body.push(L.say + ' That is not a bad day, it is a different baseline'
      + (L.deltaPct < 0 ? ' — and the likeliest cause is something that WAS driving traffic '
        + 'and has stopped.' : '.'));
    body.push('Everything below is judged against the new level, not the old one.');
    if (L.deltaPct < 0) {
      rec('Decide whether the old level was bought or earned. If it was the ad, ' + L.value
        + ' a day is the honest organic number to build against — optimising against the '
        + 'inflated week will mislead you.', L.because);
    }
  } else if (shape === 'break') {
    verdict = 'notable';
    const lead = fresh[0];
    headline = lead.say.split('. ')[0].replace(/[.:]$/, '') + '.';
    body.push('Yesterday: ' + S + ' sessions'
      + (f('sessions') && f('sessions').deltaPctText ? ' (' + f('sessions').deltaPctText
        + ' on the usual ' + pack.baselineSessions + ')' : '')
      + ', ' + f('engagement').value + '% engaged. One thing moved that had not been moving.');
  } else if (shape === 'settled') {
    verdict = 'quiet';
    const L = f('level');
    headline = 'Settling in at the new level. Nothing new today.';
    body.push('The site is running at about ' + L.value + ' sessions a day now, and '
      + 'yesterday was an ordinary day INSIDE that — ' + S + ' sessions, '
      + f('engagement').value + '% engaged. I said the level had moved on a previous '
      + 'morning and I am not going to lead with it again.');
    body.push('Judged against the level it is actually in rather than the week it left, '
      + 'nothing yesterday was outside the normal range.');
  } else if (shape === 'thin') {
    verdict = 'thin';
    headline = 'Too quiet to read.';
    body.push('Yesterday brought ' + S + ' sessions. At that size almost any percentage I '
      + 'could quote would be an accident of small numbers, so I am not going to quote one. '
      + 'Nothing broke; there is simply nothing here to conclude.');
  } else {
    verdict = 'quiet';
    headline = 'A normal day. Nothing needs you.';
    body.push('Yesterday looked like the week around it — ' + S + ' sessions against a usual '
      + pack.baselineSessions + ', engagement at ' + f('engagement').value + '%. I went '
      + 'looking for something outside the normal range and did not find it.');
    body.push('That is worth saying plainly rather than dressing up: a steady day is '
      + 'information too, and it means the levers that would move things are the ones you '
      + 'choose to pull, not ones the data is pointing at.');
  }

  if (stillLine && shape !== 'blackout') body.push(stillLine);

  // the findings: fresh loud ones first, then the cross-facts, then colour
  fresh.filter((x) => x.id !== 'level' && x.id !== 'money' && x.id !== 'blackout')
    .slice(0, 3).forEach((x) => reads.push({ icon: iconFor(x), text: x.say }));
  crossFacts(pack).forEach((c) => { if (reads.length < 4) reads.push(c); });
  if (reads.length < 3) {
    pack.facts.filter((x) => x.sig === 1 && x.daysRunning <= 1)
      .sort(byLoudness).slice(0, 3 - reads.length)
      .forEach((x) => reads.push({ icon: iconFor(x), text: x.say }));
  }

  // ── recommendations, on STRUCTURE not on anomalies ──────────────────────
  // ⚠️ so a quiet day still ends with something honest to do, without
  // inventing a story to justify it. Two at most, and zero is allowed.
  const worst = f('funnel:worst');
  if (worst && worst.value <= 12 && worst.n >= 20) {
    rec('The narrowest step is ' + worst.because + '. That one handoff caps every number '
      + 'downstream of it, so it is the highest-leverage thing on the site.', worst.because);
  }
  const offer = f('offer');
  if (offer && offer.value === 0 && offer.n >= 20) {
    rec('The download card was shown ' + offer.n + ' times and nobody took any of its doors. '
      + 'The placement is right — that is the moment the wish is granted — so rotate the copy '
      + 'before adding surfaces.', offer.because);
  }

  return {
    verdict, headline, body, reads, recs,
    confidence: pack.sampleIsThin
      ? 'thin — ' + S + ' sessions is too few to read percentages off, so I am sticking to counts'
      : (S < 150 ? 'moderate — ' + S + ' sessions, enough for direction, not for small differences'
        : 'good — ' + S + ' sessions'),
    shape,
  };
}

function iconFor(x) {
  const up = (x.deltaPct || x.z || 0) > 0;
  if (x.id === 'newcomers') return '🆕';
  if (x.id === 'offer') return '🎯';
  return ({ traffic: up ? '📈' : '📉', quality: up ? '🔥' : '💤', source: '📣',
    funnel: '🛍', downloads: '🎬', world: '🌍', search: '🔎', money: '💰' })[x.area] || '·';
}

/**
 * The public entry. index.js gathers the numbers and calls this.
 * Returns the deterministic report plus the evidence pack, so index.js can hand
 * the pack to the writer without recomputing it.
 */
export function analyse(d) {
  const pack = buildPack(d);
  if (!pack) {
    return {
      verdict: 'no-baseline',
      headline: 'Not enough history yet.',
      body: ['I need about a week of days behind yesterday before I can tell you whether '
        + 'a number is unusual. Give it a few more days.'],
      reads: [], recs: [], confidence: 'no baseline', pack: null,
    };
  }
  const out = narrate(pack);
  return {
    ...out,
    sessions: pack.sessions,
    avgSessions: pack.baselineSessions,
    factsSeen: pack.counts.facts,
    factsNew: pack.counts.newToday,
    pack,
  };
}

export { MIN_RATE_N, rate };
