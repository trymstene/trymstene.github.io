// ── THE ANALYST ───────────────────────────────────────────────────────────
// Trym, 1 Aug 2026: "a voice to explain what the analyst see, and what it
// means so far, thoughts about what we should add, or remove — reflections
// basically based on hard facts."
//
// He is a Lead SEO/CRO specialist. He can read a number off a chart. What a
// chart cannot give him is JUDGEMENT, so every line here must say something
// the number alone does not. Restating a figure the dashboard already shows,
// without a verdict attached, is the one failure mode.
//
// ⚠️ THE HOROSCOPE RULE. This must be allowed to say "nothing happened" and
// "that sample is too small to call". An analyst who finds a story every
// single day is not an analyst. Silence on ordinary days is exactly what
// makes the loud days worth reading.
//
// Pure functions only — no fetch, no env. index.js gathers the numbers.

// ── statistics ────────────────────────────────────────────────────────────
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

function sd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1));
}

// how many standard deviations from the baseline. ⚠️ a floor on sd stops a
// freakishly steady week from turning a one-session wobble into a z of 40.
function zed(cur, base) {
  if (base.length < 3) return 0;
  const s = Math.max(sd(base), Math.max(1, mean(base) * 0.08));
  return (cur - mean(base)) / s;
}

const pct = (cur, base) => (base ? Math.round(((cur - base) / base) * 100) : (cur ? null : 0));
const rate = (n, d) => (d ? n / d : 0);
const r1 = (x) => Math.round(x * 10) / 10;

// "up 40%" / "down a third" — plain words beat ±40% in a sentence
function moveWord(p) {
  const a = Math.abs(p);
  const dir = p > 0 ? 'up' : 'down';
  if (a >= 200) return dir === 'up' ? 'more than tripled' : 'collapsed';
  if (a >= 100) return dir === 'up' ? 'more than doubled' : 'fell by half or more';
  if (a >= 60) return dir + ' by well over half';
  if (a >= 40) return dir + ' sharply';
  return dir + ' ' + a + '%';
}

// ── the sample-size gate ──────────────────────────────────────────────────
// Rates on tiny numbers are noise wearing a suit. 3 clicks out of 5 is not a
// 60% conversion rate, it is three clicks. These thresholds are the honesty.
const MIN_RATE_N = 40;   // below this, do not narrate a percentage
const MIN_STEP_N = 20;   // below this, do not narrate a funnel step

// ── a READ ────────────────────────────────────────────────────────────────
// weight drives the order and whether it survives the cut. 3 = drop what you
// are doing, 2 = worth knowing, 1 = colour.
//
// ⚠️ WEIGHT 1 IS FOR GOOD NEWS TOO. A number behaving exactly as it should is
// not news, and weighting it 2 makes a flat day announce itself as notable —
// which is precisely the horoscope this is built to avoid. Only a number that
// wants a DECISION earns 2 or more.
const read = (weight, icon, text) => ({ weight, icon, text });

/**
 * @param {object} d the numbers, gathered by index.js
 *   d.days       [{d,sessions,users,newUsers,eng,revenue,tx}] oldest→newest,
 *                the LAST entry being yesterday
 *   d.events     { name: [8 daily counts, oldest→newest] }
 *   d.campaigns  [{name, sessions, engaged, secs}] for yesterday
 *   d.sources    [{source, medium, sessions, engaged}] for yesterday
 *   d.gsc        {clicks, impressions, position} | null
 *   d.gscBase    {clicks, impressions, position} | null  (daily average)
 *   d.offers     { shown:[8], click:[8] } already inside d.events, kept for clarity
 */
export function analyse(d) {
  const days = d.days || [];
  const today = days[days.length - 1];
  const base = days.slice(0, -1);
  if (!today || base.length < 3) {
    return {
      verdict: 'no-baseline',
      headline: 'Not enough history yet.',
      body: ['I need about a week of days behind yesterday before I can tell '
        + 'you whether a number is unusual. Give it a few more days.'],
      reads: [], recs: [], confidence: 'no baseline',
    };
  }

  const S = today.sessions;
  const baseS = base.map((x) => x.sessions);

  // ── 🔑 THE REGIME CHECK, before anything else ───────────────────────────
  // A seven-day mean is the wrong yardstick across a LEVEL CHANGE. When an ad
  // flight ends, every day afterwards reads as "down 80% on the week" — which
  // is true, useless, and repeats itself for a week. Worse, the real story
  // (the site moved to a new level and stayed there) never gets told.
  //
  // So: compare the three days before yesterday against the four before them.
  // If they are different worlds, judge yesterday against the world it is
  // actually in, and report the SHIFT separately as its own finding.
  const recent3 = baseS.slice(-3);
  const early4 = baseS.slice(0, 4);
  const shiftPct = pct(mean(recent3), mean(early4));
  const regime = recent3.length === 3 && early4.length >= 3
    && shiftPct !== null && Math.abs(shiftPct) >= 35;

  const cmpBase = regime ? recent3 : baseS;
  const avgS = mean(cmpBase);
  const zS = zed(S, cmpBase);
  const pS = pct(S, avgS);
  // the day the level changed, for naming it out loud
  const breakDay = regime && base[base.length - 3]
    ? new Date(String(base[base.length - 3].d).replace(/(\d{4})(\d\d)(\d\d)/, '$1-$2-$3')
      + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;

  // an event's yesterday, and its baseline daily average
  const ev = (n) => { const a = d.events[n]; return a ? (a[a.length - 1] || 0) : 0; };
  // any sentence that says PEOPLE must count people — 6 shop views can be 2
  // humans (Trym, 24 Aug). Falls back to event counts for old-shape callers.
  const evUArr = (n) => (d.eventUsers || {})[n] || d.events[n] || [];
  const evU = (n) => { const a = evUArr(n); return a.length ? (a[a.length - 1] || 0) : 0; };
  const evBase = (n) => { const a = d.events[n]; return a ? mean(a.slice(0, -1)) : 0; };
  const evZ = (n) => { const a = d.events[n]; return a ? zed(a[a.length - 1] || 0, a.slice(0, -1)) : 0; };

  const reads = [];
  const recs = [];
  const rec = (text, because) => { if (recs.length < 3) recs.push({ text, because }); };

  // ── is the sample even big enough to talk about rates? ──────────────────
  const thin = S < MIN_RATE_N;
  const confidence = thin
    ? 'thin — ' + S + ' sessions is too few to read percentages off, so I am '
      + 'sticking to counts'
    : (S < 150 ? 'moderate — ' + S + ' sessions, enough for direction, not for '
      + 'small differences' : 'good — ' + S + ' sessions');

  // ── 0. the level change itself ──────────────────────────────────
  if (regime) {
    reads.push(read(3, shiftPct > 0 ? '🚀' : '📉',
      'The site has moved to a different level. The last three days average '
      + Math.round(mean(recent3)) + ' sessions against ' + Math.round(mean(early4))
      + ' earlier in the week' + (breakDay ? ', with the step around ' + breakDay : '')
      + '. That is not a bad day, it is a new baseline'
      + (shiftPct < 0 ? ' — and the likeliest cause is something that WAS driving '
        + 'traffic and has stopped.' : '.')));
    if (shiftPct < 0) {
      rec('Decide whether the old level was bought or earned. If it was the ad, '
        + Math.round(mean(recent3)) + ' a day is the honest organic number to build '
        + 'CRO against — optimising against the inflated week will mislead you.',
      Math.round(mean(early4)) + ' → ' + Math.round(mean(recent3)) + ' sessions a day');
    }
  }

  // ── 1. traffic ──────────────────────────────────────────────────────────
  if (Math.abs(zS) >= 2 && Math.abs(pS) >= 25) {
    reads.push(read(zS > 0 ? 3 : 2, zS > 0 ? '📈' : '📉',
      'Traffic ' + moveWord(pS) + ' — ' + S + ' sessions against '
      + Math.round(avgS) + ' a day '
      + (regime ? 'over the last three days' : 'across the week')
      + '. That is outside the normal wobble, not a quiet Tuesday.'));
  }

  // ── 2. engagement, and the trap of celebrating volume ───────────────────
  const E = today.eng;
  const avgE = mean(base.map((x) => x.eng));
  const pE = avgE ? Math.round((E - avgE) * 100) : 0; // percentage POINTS
  if (!thin && Math.abs(pE) >= 6) {
    if (pS !== null && pS >= 25 && pE <= -6) {
      reads.push(read(3, '⚠️',
        'More people, and a worse crowd: sessions ' + moveWord(pS) + ' while '
        + 'engagement fell ' + Math.abs(pE) + ' points to ' + Math.round(E * 100)
        + '%. Extra volume that engages less than usual is the signature of '
        + 'the wrong audience, not a win.'));
      rec('Do not read the traffic spike as success until engagement recovers '
        + '— check which source brought it and whether that source is worth keeping.',
      'sessions ' + (pS > 0 ? '+' : '') + pS + '% but engagement ' + pE + 'pts');
    } else {
      reads.push(read(2, pE > 0 ? '🔥' : '💤',
        'Engagement ' + (pE > 0 ? 'up' : 'down') + ' ' + Math.abs(pE)
        + ' points at ' + Math.round(E * 100) + '%, against '
        + Math.round(avgE * 100) + '% for the week. '
        + (pE > 0 ? 'Whoever came yesterday wanted to be here.'
          : 'People arrived and left again faster than usual.')));
    }
  }

  // ── 3. the campaign — the flight that is live RIGHT NOW ─────────────────
  // ⚠️ GA4 puts its own placeholders in this dimension — (direct), (organic),
  // (referral), (not set). Anything bracketed is filler, not a flight.
  const camps = (d.campaigns || []).filter((c) => c.name && c.sessions > 0
    && !/^\(.*\)$/.test(c.name));
  const paid = camps.sort((a, b) => b.sessions - a.sessions)[0];
  if (paid) {
    const cEng = Math.round(rate(paid.engaged, paid.sessions) * 100);
    const cSecs = Math.round(rate(paid.secs, paid.sessions));
    const siteEng = Math.round(E * 100);
    if (paid.sessions < MIN_STEP_N) {
      reads.push(read(1, '📣',
        paid.name + ' brought ' + paid.sessions + ' sessions. Too few to judge '
        + 'the creative on — give it a couple more days before reading anything '
        + 'into the quality numbers.'));
    } else {
      const gap = cEng - siteEng;
      reads.push(read(Math.abs(gap) >= 8 ? 2 : 1, '📣',
        paid.name + ': ' + paid.sessions + ' sessions, ' + cEng + '% engaged, '
        + cSecs + 's average. ' + (
          gap >= 8 ? 'That is ' + gap + ' points better than the site as a whole '
            + '— the ad is bringing people who actually want the thing.'
            : gap <= -8 ? 'That is ' + Math.abs(gap) + ' points worse than the site '
              + 'average — the ad is selling something the landing page is not '
              + 'delivering.'
              : 'Broadly in line with everyone else, which for paid traffic is a '
                + 'decent result rather than a dull one.')));
      if (cSecs < 20 && cEng >= 40) {
        reads.push(read(2, '🕐',
          'A tension worth watching on ' + paid.name + ': engagement is fine but '
          + 'dwell is only ' + cSecs + 's. They are doing one thing and leaving. '
          + 'That is a landing-page depth problem, not a targeting problem.'));
        rec('Give ' + paid.name + ' somewhere obvious to go SECOND — one clear '
          + 'next door on the landing page, not a menu.',
        cSecs + 's average dwell at ' + cEng + '% engaged');
      }
    }
  }

  // ── 4. the funnel, only where the denominator earns a percentage ────────
  const made = evU('builder_start');
  const pdp = evU('sticker_pdp_view');
  const co = evU('checkout_redirect');
  if (made >= MIN_STEP_N) {
    const cr = rate(pdp, made);
    const crBase = rate(mean(evUArr('sticker_pdp_view').slice(0, -1)),
      mean(evUArr('builder_start').slice(0, -1)));
    if (pdp === 0) {
      reads.push(read(3, '🚧',
        made + ' people dressed a banana and not one of them reached a product '
        + 'page. The making works; the asking does not.'));
      rec('The step from finished banana to product page is where the money '
        + 'stops — that single handoff is worth more attention than any new feature.',
      made + ' built, 0 product pages');
    } else if (pdp >= 5 && crBase && Math.abs(cr - crBase) >= 0.05) {
      reads.push(read(2, cr > crBase ? '🛍' : '🧊',
        'Builder → product page ran at ' + Math.round(cr * 100) + '% against '
        + Math.round(crBase * 100) + '% for the week' + (cr > crBase
          ? ' — the handoff is working better than usual, worth knowing what changed.'
          : ' — fewer finished bananas turned into a shop visit than normal.')));
    }
  }
  if (co > 0 && today.tx === 0) {
    reads.push(read(1, '🚪',
      co + ' ' + (co === 1 ? 'person' : 'people') + ' reached Shopify and nobody '
      + 'paid. At this volume that is unremarkable, but it is the step to watch '
      + 'once the numbers grow.'));
  }

  // ── 5. the download card — the WARM-UP surface (pivoted 12 Aug: it stopped
  // selling merch and now invites people into Banana World or the Discord;
  // offer_click is the retired merch CTA, counted only so old windows stay
  // honest) ────────────────────────────────────────────────────────────────
  const oShown = ev('offer_shown');
  const oWorld = ev('offer_world');
  const oDisc = ev('offer_discord');
  const oWarm = oWorld + oDisc + ev('offer_click');
  if (oShown >= MIN_STEP_N) {
    const ctr = Math.round(rate(oWarm, oShown) * 100);
    if (oWarm === 0) {
      reads.push(read(3, '🎯',
        'The download card appeared ' + oShown + ' times and nobody chose the '
        + 'world or the Discord. The placement is right — that is the moment '
        + 'the wish is granted — so the problem is the copy: rotate harder, or '
        + 'the invitation itself is not landing.'));
      rec('Check which variants are showing (the cards rotate 8 voices) and '
        + 'rewrite the weakest before adding surfaces. ' + oShown
        + ' cards with no takers is a copy answer, not a reach answer.',
      oShown + ' shown, 0 warmed');
    } else {
      reads.push(read(1, '🎯',
        'The download card warmed ' + ctr + '% (' + oWarm + ' of ' + oShown
        + ' — ' + oWorld + ' to the world, ' + oDisc + ' to the Discord). '
        + (ctr >= 8
          ? 'That is a healthy rate for an interruption people did not ask for.'
          : 'Low, but these are file-grabbers being offered a place to stay — '
            + 'every warm one is a person the old merch card never got.')));
    }
  } else if (oShown > 0) {
    reads.push(read(1, '🎯',
      'The download card showed ' + oShown + ' times' + (oWarm ? ' and warmed '
        + oWarm + ' visitor' + (oWarm > 1 ? 's' : '')
        + ' toward the world or the Discord' : '')
      + '. Not enough yet to judge — check back when it has a few hundred '
      + 'behind it.'));
  }

  // ── 6. money ────────────────────────────────────────────────────────────
  if (today.tx > 0) {
    reads.push(read(3, '💰',
      today.tx + ' purchase' + (today.tx > 1 ? 's' : '') + ' — '
      + Math.round(today.revenue) + ' kr. Open Shopify and check whose it is '
      + 'before celebrating; every order so far has been one of your own tests.'));
  }

  // ── 7. the volume channel ───────────────────────────────────────────────
  const gifs = ev('gif_download');
  const zGif = evZ('gif_download');
  if (Math.abs(zGif) >= 2.2 && gifs >= 10) {
    reads.push(read(2, '🎬',
      'GIF downloads ' + moveWord(pct(gifs, evBase('gif_download'))) + ' to '
      + gifs + '. That is the awareness channel moving, and it moves before '
      + 'everything else does.'));
  }

  // ── 8. search ───────────────────────────────────────────────────────────
  if (d.gsc && d.gscBase && d.gscBase.impressions >= 50) {
    const pi = pct(d.gsc.impressions, d.gscBase.impressions);
    const dp = r1(d.gscBase.position - d.gsc.position); // + = improved
    if (Math.abs(dp) >= 0.6) {
      reads.push(read(2, '🔎',
        'Average Google position moved ' + (dp > 0 ? 'up ' : 'down ')
        + Math.abs(dp) + ' to ' + r1(d.gsc.position) + '. '
        + (dp > 0 ? 'Rankings drift slowly, so a move this size in a day is '
          + 'usually a handful of queries changing, not the whole site.'
          : 'Worth a look at which queries slipped before assuming the worst.')));
    } else if (pi !== null && Math.abs(pi) >= 40) {
      reads.push(read(1, '🔎',
        'Search impressions ' + moveWord(pi) + ' at the same average position — '
        + 'demand moved, not your rankings.'));
    }
  }

  // ── 9. the world ────────────────────────────────────────────────────────
  const worlds = [['rave_join', 'the rave'], ['park_join', 'the park'],
    ['beach_join', 'the bay'], ['homestead_open', 'the homestead']];
  const wUp = worlds.map(([n, label]) => ({ label, n: ev(n), z: evZ(n) }))
    .filter((x) => x.n >= 15 && Math.abs(x.z) >= 2.2);
  if (wUp.length) {
    const w = wUp.sort((a, b) => Math.abs(b.z) - Math.abs(a.z))[0];
    reads.push(read(1, w.z > 0 ? '🌍' : '🌑',
      'Visits to ' + w.label + ' were ' + (w.z > 0 ? 'well above' : 'well below')
      + ' the weekly rhythm (' + w.n + '). '
      + (w.z > 0 ? 'Somebody sent people there, or the door got easier to find.'
        : '')));
  }

  // ── the verdict ─────────────────────────────────────────────────────────
  reads.sort((a, b) => b.weight - a.weight);
  const loud = reads.filter((r) => r.weight >= 2);
  const kept = reads.slice(0, 5);

  let verdict; let headline; const body = [];

  if (thin && !loud.length) {
    verdict = 'thin';
    headline = 'Too quiet to read.';
    body.push('Yesterday brought ' + S + ' sessions. At that size almost any '
      + 'percentage I could quote would be an accident of small numbers, so I '
      + 'am not going to quote one. Nothing broke; there is simply nothing here '
      + 'to conclude.');
  } else if (!loud.length) {
    verdict = 'quiet';
    headline = 'A normal day. Nothing needs you.';
    body.push('Yesterday looked like the week around it — ' + S + ' sessions '
      + 'against a ' + Math.round(avgS) + '-a-day average, engagement at '
      + Math.round(E * 100) + '%. I went looking for something outside the '
      + 'normal range and did not find it.');
    body.push('That is worth saying plainly rather than dressing up: a steady '
      + 'day is information too, and it means the levers that would move things '
      + 'are the ones you choose to pull, not ones the data is pointing at.');
  } else {
    verdict = 'notable';
    const first = loud[0].text;
    const cut = Math.min(...[first.indexOf(' — '), first.indexOf('. ')]
      .filter((i) => i > 0).concat([first.length]));
    headline = first.slice(0, cut).replace(/[.:]$/, '') + '.';
    body.push('Yesterday: ' + S + ' sessions' + (pS === null ? ''
      : ' (' + (pS >= 0 ? '+' : '') + pS + '% on '
        + (regime ? 'the last three days' : 'the weekly average') + ')') + ', '
      + Math.round(E * 100) + '% engaged'
      + (today.tx ? ', ' + today.tx + ' purchase' + (today.tx > 1 ? 's' : '') : '')
      + '. Here is what actually stands out.');
  }

  // ── recommendations of last resort ──────────────────────────────────────
  // ⚠️ these fire on STRUCTURE, not on anomalies — so a quiet day still ends
  // with something honest to do, without inventing a story to justify it.
  if (recs.length < 2) {
    if (made >= MIN_STEP_N && pdp > 0 && rate(pdp, made) < 0.08) {
      rec('The builder→shop step is running under 8%. That one handoff caps '
        + 'every sales number downstream of it, so it is the highest-leverage '
        + 'thing on the site.', Math.round(rate(pdp, made) * 100) + '% builder→PDP');
    }
    if (gifs >= 20 && oShown < gifs * 0.3) {
      rec('Only ' + oShown + ' of ' + gifs + ' downloads got shown an offer. '
        + 'The card is capped at one per visit by design, but it is worth '
        + 'checking the remaining download surfaces are actually wired.',
      gifs + ' downloads, ' + oShown + ' offers shown');
    }
    if (!thin && S > avgS * 1.2 && today.tx === 0 && co === 0) {
      rec('A busier-than-usual day that produced no checkout at all. Traffic is '
        + 'not the constraint right now — the last click is.',
      S + ' sessions, 0 checkouts');
    }
  }

  return { verdict, headline, body, reads: kept, recs, confidence, sessions: S,
    avgSessions: Math.round(avgS), regime, shiftPct, breakDay };
}
