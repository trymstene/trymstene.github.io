// ── THE WRITER ────────────────────────────────────────────────────────────
// Trym, 3 Sep 2026: "it seems the analysis is just the same each time with new
// numbers - not a unique report based on whats actually happened... it needs to
// actually read through the data and reflect on it objectively each time i open
// it based on the new data, cause right now it feels extremely static."
//
// He is right, and no number of extra rules fixes it. A rule engine emits a
// fixed set of sentences; add fifty more and it is a bigger fixed set. The only
// thing that reads evidence and reaches a fresh judgement is something that
// actually reads.
//
// So the work is split:
//   evidence.js  computes every fact, its baseline, its significance and how
//                many days running it has been true. DETERMINISTIC.
//   this file    hands that pack to Claude and asks for the judgement.
//
// ⚠️ THE GROUNDING RULE, and it is absolute: THE MODEL MAY NOT DO ARITHMETIC.
// Every number that may appear in the report is precomputed into the pack, and
// anything it writes that is not in the pack fails validation and the whole
// report is thrown away in favour of the deterministic one. A dashboard that
// lies once is never trusted again, and Trym makes decisions off this.
//
// ⚠️ IT MUST STILL BE ALLOWED TO SAY NOTHING HAPPENED. The horoscope rule
// outlived the rewrite — it is in the system prompt, and a quiet day is a
// legitimate, correct answer.
//
// Off unless ANTHROPIC_KEY is set. No key = null = the deterministic report.

const API = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-5';

const SYSTEM = `You are the analyst for Banana World — a one-person site (trymstene.com)
that gives away dancing-banana GIFs and is trying to turn that audience into a small
game world with paying supporters. You write ONE short report each morning, for Trym,
who built all of it and reads this before deciding what to work on.

He is a lead SEO/CRO specialist. He can read a number off a chart. What he cannot get
from a chart is JUDGEMENT, so every sentence must say something the number alone does
not. Restating a figure the dashboard already shows, with no verdict attached, is the
one failure that matters.

THE RULES, in order of importance:

1. NEVER WRITE A NUMBER THAT IS NOT IN THE EVIDENCE. Every figure you may use is in
   the pack, already computed — counts, baselines, percentages, differences, all of it.
   You may not add, subtract, divide, round or estimate. If you want a number that is
   not there, write the sentence without it. This is checked mechanically and a report
   containing an invented number is discarded.

2. YOU ARE ALLOWED TO SAY NOTHING HAPPENED, and on most days that is the truth. A
   report that finds a story every single day is a horoscope. Silence on ordinary days
   is exactly what makes a loud day worth reading. If the evidence is flat, say so
   plainly in two sentences and stop.

3. SAY WHEN A SAMPLE IS TOO SMALL. Every fact carries "n". Below about 40 a percentage
   is noise wearing a suit; say "three people" not "60%".

4. DO NOT LEAD WITH SOMETHING YOU LED WITH YESTERDAY. Facts carry "daysRunning". A
   fact on its fourth day is not news — mention it in a clause, at most, and lead with
   what is actually new. This is the single most important thing: he has been reading
   the same opening sentence for days and stopped believing the report.

5. CONNECT FACTS. The value you add over the dashboard is noticing that two numbers
   together mean something neither means alone — traffic down but engagement up, one
   country carrying an entire event count, downloads flat while sessions halved. Look
   for those. If you find none, do not manufacture one.

6. WRITE LIKE A PERSON WHO HAS READ IT. Plain British English, no dashboard jargon, no
   bullet-point voice, no "key takeaways", no praise, no filler. Short sentences.

7. RECOMMEND AT MOST TWO THINGS, and only where the evidence actually supports them.
   Zero is a fine answer. "Do nothing today" is a fine answer. Never recommend
   something the evidence cannot back.

Return JSON only, matching exactly:
{
  "verdict": "notable" | "quiet" | "thin" | "no-baseline",
  "headline": "one sentence, under 80 characters, no trailing full stop needed",
  "body": ["1 to 3 short paragraphs setting up what the day was"],
  "reads": [{ "icon": "one emoji", "text": "one finding, one to three sentences" }],
  "recs": ["at most two, each a concrete thing to do and why"],
  "confidence": "one clause on how much to trust this, given the sample"
}
Between zero and four reads. On a quiet day, zero or one.`;

// ── the grounding check ───────────────────────────────────────────────────
// Pull every number out of the prose and demand each one be in the pack.
// ⚠️ years, ordinals in dates and the small counting words are not evidence and
// are allowed through; anything else must have been given to the model.
const SAFE = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '24', '30', '100', '2026']);

function numsIn(s) {
  return String(s || '').match(/-?\d[\d,._]*\d|-?\d/g) || [];
}
const norm = (n) => String(n).replace(/[,_\s]/g, '').replace(/\.0+$/, '').replace(/^-/, '');

// every number anywhere in the pack, at any depth
function allowedNumbers(pack) {
  const out = new Set(SAFE);
  const walk = (v) => {
    if (v == null) return;
    if (typeof v === 'number') { out.add(norm(Math.round(v))); out.add(norm(v)); return; }
    if (typeof v === 'string') { numsIn(v).forEach((n) => out.add(norm(n))); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(pack);
  return out;
}

export function ungrounded(report, pack) {
  const ok = allowedNumbers(pack);
  const text = [report.headline, ...(report.body || []),
    ...(report.reads || []).map((r) => r && r.text),
    ...(report.recs || []).map((r) => (typeof r === 'string' ? r : r && r.text)),
    report.confidence].filter(Boolean).join(' \n ');
  const bad = [];
  for (const n of numsIn(text)) if (!ok.has(norm(n))) bad.push(n);
  return bad;
}

// ── the call ──────────────────────────────────────────────────────────────
export async function writeReport(env, pack) {
  if (!env.ANTHROPIC_KEY) return null;
  const model = env.ANALYST_MODEL || DEFAULT_MODEL;
  let r;
  try {
    r = await fetch(API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1600,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: 'Here is yesterday (' + pack.niceDate + ') and the week behind it.\n\n'
            + JSON.stringify(pack, null, 1)
            + '\n\nWrite the report. JSON only, no preamble, no code fence.',
        }],
      }),
    });
  } catch (e) {
    return { __err: 'writer unreachable: ' + String(e.message || e).slice(0, 120) };
  }
  if (!r.ok) {
    return { __err: 'writer ' + r.status + ': ' + (await r.text()).slice(0, 160) };
  }
  const j = await r.json();
  const raw = ((j.content || []).find((c) => c.type === 'text') || {}).text || '';
  // it is told not to fence, but a fence is the one thing models add anyway
  const body = raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  let out;
  try { out = JSON.parse(body); } catch (e) {
    return { __err: 'writer returned something that is not JSON' };
  }
  const bad = ungrounded(out, pack);
  if (bad.length) {
    // ⚠️ NOT a warning on the page — a discard. A number he cannot trust is
    // worse than no report, because he makes decisions off this.
    return { __err: 'writer invented numbers (' + bad.slice(0, 6).join(', ') + ')' };
  }
  out.reads = (out.reads || []).slice(0, 4)
    .filter((x) => x && x.text)
    .map((x) => ({ icon: x.icon || '·', text: String(x.text) }));
  out.recs = (out.recs || []).slice(0, 2)
    .map((x) => (typeof x === 'string' ? { text: x, because: '' } : x))
    .filter((x) => x && x.text);
  out.body = (out.body || []).slice(0, 3).map(String);
  out.written = model;
  return out;
}
