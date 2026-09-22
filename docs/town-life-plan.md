# Town Life — the plan, and what was built

Trym's brief, 14 Sep 2026, in one line: *the town should feel like a living community
that changes over time, needs occasional attention, rewards caring, has a curse
underneath, and stays worth revisiting indefinitely — even with no storyline.*

This document records the DECISIONS, not the brief. The brief is the source; this is
what was chosen and why, so a later session cannot drift from it. §11 is what stands in
the code after the build the same day; where it differs from §1–§10, §11 wins.

---

## 0. One reversal of the 6 Sep plan, made on purpose

`docs/town-and-cut-plan.md §4` said *"Banana Town sells nothing. Every door is shut
and stays shut."* That was the right call against a sixth wearables storefront.
Trym's 14 Sep brief reverses it for one category: **the town sells things for the
player's HOMESTEAD** — furniture, decorations, household objects, plants, collectibles.
Never wearables (that rule stands). The homestead phone already sells 100+ decor
items; the town does not replace that, it becomes a second *source* with stock that
depends on the town's condition and rotates, so the two never carry the same shelf.

What the 6 Sep plan got right and this keeps: the name ladder (built, nine residents),
dialogue as a function of state that already exists (`town-facts`), the Wants (a
resident wants to *see* something today), market day as a wall-clock rhythm, the
"once per thing per day" cap, and the flat budget.

---

## 1. The shape, in one picture

```
      ┌──────────────── SHARED, ON THE WORKER ────────────────┐
      │  TOWN LIFE  0–100, drifts toward a set point, charged  │
      │  by storms and Curse Nights, raised by contributions   │
      └───────────────┬────────────────────────────────────────┘
                      │ read on join, polled
      ┌───────────────▼────────────────────────────────────────┐
      │  CONDITION (client, data)  band → how the town LOOKS:  │
      │  lamps lit, windows glowing, shutters open, litter,     │
      │  decorations, residents outside, visitors               │
      └───────────────┬────────────────────────────────────────┘
                      │
   ┌──────────────────┼───────────────────┬──────────────────────┐
   ▼                  ▼                   ▼                      ▼
 PROBLEMS          SHOPS               TODAY                 THE CURSE
 per player,       stock by band,      seeded events:        a shared clock
 seeded by day,    rotating daily,     merchant, odd NPC,    like the weather;
 fixed by a tap    a merchant,         closed shop, strange  ghosts, cursed
 → contribution    a curse vendor      object                objects, a door
   ▲                                                            │
   └──────────── STORY HOOKS: force a night, add a ghost, ──────┘
                 plant an object, close a shop, nudge life
```

Every box is its own module and its own data table. None of them import each other's
internals; they read Town Life and the day seed, and they call `track`.

---

## 2. Town Life is an equilibrium, not a bar

**Range 0–100. Five bands.** The notice board's word for each is copy (the `town-life`
job); the keys are fixed.

| band | range | the town reads as |
|---|---|---|
| Abandoned | 0–14 | dark, shut, empty, the odd ghost in daylight |
| Struggling | 15–39 | half the lamps out, shutters down, litter, few people |
| Recovering | 40–64 | mostly fine, a few things wrong, everyone about |
| Lively | 65–84 | lit, open, decorated, visitors |
| Thriving | 85–100 | everything, plus the merchant, the rare stock, the crowd |

**It drifts toward a SET POINT of 42, inside Recovering, from both directions.**
That single choice is what makes decline generate gameplay instead of obligation:

- A Thriving town left alone slides back toward Recovering over about two days. Prosperity
  has to be kept up, so there is always something to do.
- An Abandoned town left alone climbs back toward Recovering by itself in about a day and
  a half. **Absence is never punished.** The residents keep the lights on without you;
  they just cannot make it thrive without you.
- The set point sits where the most gameplay lives: a few problems, most shops open, the
  good stock still locked.

**Rates** (the worker owns them; the client never computes Town Life):

| force | effect |
|---|---|
| drift, above the set point | −0.6 per hour |
| drift, below the set point | +1.0 per hour (recovery is faster than decay, deliberately) |
| heavy rain | −1 per event |
| storm | −4 per event |
| Curse Night | creep −10, deep −18 (a hush charges nothing); never below 5 |
| a player's contribution | +2.0, and **each player can move Town Life by at most +24 per real day** (1.2 / 10 until 15 Sep) |

The per-player daily cap is the multiplayer rule that matters most. One tireless player
cannot carry the town to Thriving alone and keep it there; ten ordinary players can. Past
the cap a fix still pays its coins and rep and still clears the problem — the cap is
invisible to the person doing the fixing. The town can only absorb so much care from one
banana in a day.

**Charged lazily, like the park.** The worker walks the weather clock and the curse clock
for the gap since its last read, in time order with the drift between events, so a storm
nobody was present for still lands and a night thirty hours ago has had its thirty hours
of recovery since. The walk is clamped to two days; a fresh room charges nothing.

---

## 3. Problems are per player. Contributions are pooled.

The park's chores are shared: one player can pull every weed. Trym's brief forbids that
shape for the town — *one highly active player permanently fixes everything; new players
arrive and have nothing left to do.*

So a problem is **yours**: the set you see today is seeded by (you, the day, the band).
Reloading does not reroll it. Tomorrow is a new set. Another player standing next to you
sees their own broken lamp, on the same lamp post or a different one. What you both see
in common is the CONDITION — the band — and what your fixes both feed is the shared
Town Life. Nobody can exhaust the town, nobody can wreck it, and nobody waits for anyone.

How many: Abandoned 9 · Struggling 7 · Recovering 5 · Lively 3 · Thriving 2. Never zero.
A perfect town still has two things wrong with it, because a town with nothing to do is
a picture. **And a kiosk shut by the day's events is always one of them** — a closed door
with no way to open it is the one thing this design forbids.

The library of problem TYPES is data (`src/data/town/problems.js`). Each row says which
anchors it can attach to, what it pays, which band and weather it belongs to. Adding a
problem type is adding a row.

---

## 4. The town shows its condition; nobody reads a number

**Amended 14 Sep, evening, after Trym played it:** *"repairing doesn't really give any
satisfaction, i just go pick stuff up that disappear — but then what?"* and *"i don't as a
player understand when nightfall is."* — and then, on my first answer (a meter under the
HUD strip): *"no, im talking about the same health bar like in the park … make it the
same."* So the town has THE PARK'S HEALTH BAR, to the pixel: bottom-docked, a face and a
palette per band, the fill is the town's number with the % riding it, the (i) cap; tap it
and the park's health card opens — the band's name, the big %, one continuous bar with the
five bands as zones (ticks at 15/40/65/85, a glyph per band, tap a zone to read that band's
line), today's tally, and ten pips for your own share of today (gold at ten). A NIGHTFALL
CLOCK in the HUD's slot (sun or moon, m:ss until the other). A fix is a MOMENT (the lamp
flashes on, the shutter rolls up, the crows flap off); a band change is an EVENT (the new
name and what it brings); tomorrow's stall parks its cart at the bus stop today. So the
number IS read now, the park's way — the rule below is superseded by Trym's call.


The band drives a **condition table** (`src/data/town/condition.js`): how many lamps are
dark or stutter at night, the share of windows that stay dark, which kiosks have their
shutter down, the litter level, the square's bin, the fountain, the share of residents
who stay in, crows, visitors, lanterns. Problems overlay on that. A player walking in
should know the band from the square.

There is no Town Life meter on the HUD. The notice board carries the town's own word for
it and today's tally, and that is the only place the state is named.

---

## 5. Shops sell to the homestead, and stock follows the town

Pip's general store is the outlet. Stock is drawn from pools of the existing DECOR
catalogue (`src/data/town/stock.js`): `basic` from Struggling, `common` from Recovering,
`good` from Lively, `rare` at Thriving; an Abandoned store is shut and Pip stays in. A
**daily seeded rotation** picks a shelf from the pools the band unlocks, so a Thriving
Tuesday is not a Thriving Wednesday.

A **travelling stall** appears on seeded days from Lively up, with a pool nobody else
carries, at a markup. A **night vendor** appears only on deep Curse Nights, with a short
cheap shelf, and buys cursed objects back. Buying uses the homestead's existing coin
charge and lands the item in the homestead's existing shed or on its van
(`src/lib/homestead-inventory.js` — the homestead's own buy uses the same door). The town
mints no currency and invents no second inventory.

**The seven Japanese-interior sprites on disk stay unused.** Trym culled that set from
the homestead shelf himself ("all western"); selling it in the town would reverse that
by the back door. The rare pool is the catalogue's own statement pieces.

---

## 6. Today

A small seeded set of things that are simply happening (`src/data/town/today.js`): the
stall, a resident standing somewhere they never stand for one beat, a kiosk closed for a
reason (fixing it reopens it), a strange object in an alley by daylight, crows, a small
ghost in daylight when the town is low. Weighted by band. Two to four per day. Combined
with the real weather and the real band, two visits rarely resolve into the same sequence.

---

## 7. The Curse

**A clock, like the weather.** `curseAt(t)` in `src/lib/world.js` is a pure function of
time, seeded per day, identical on every client and on the worker, never a fetch, never
published. Three tiers — hush 12%, creep 9%, deep 3% of days, one night at most, inside
18:00–23:30 UTC — about 1.7 nights a week. A story chapter can force one for its holder.

**During a Curse Night:** the sky goes dark whatever the town clock says, the storm falls
(creep: heavy rain), the residents go indoors and their windows go dark, both kiosks'
shutters drop, candles stand at the doors, ghosts appear, cursed objects lie on the
ground, and on a deep night the vendor's stall opens at the monument. Town Life takes the
hit on the worker's walk, so the morning after has more to fix. A hush is cosmetic: dusk,
a drifting ghost, a wisp at the statue, nothing charged.

**Ghosts are curiosity, not danger.** Measured 30 Aug: 3.8% of players ever dodge the
world's one hazard. So nothing chases you and nothing hurts. A ghost's behaviour is a row
(`src/data/town/ghosts.js`): `drift` (wanders, fades when you get close), `sit` (on a
bench, a line when tapped), `lead` (walks toward something, then is gone — and the
something is a cursed object), `knock` (stands at the hall door that does not open),
`repeat` (waves by the fountain, over and over), `wisp` (rises over the statue and is
gone). Friendly sprites; the graveyard-literal set (crosses, coffins, blood) is cut.

**Cursed objects reuse ordinary sprites** (`src/data/town/objects.js`): a DECOR row with a
rarity, where it can appear, and a cosmetic effect (it hums, it flickers, it faces the
other way). The ledger of what a player has found lives on the pass (`cur_<id>`, a counter
that travels). Found, the object goes home as the ordinary thing; the night vendor buys
one back at a bounty. **Every word of that text comes through the copy rig.**

**The ghosts' damage is charged (21 Sep 2026).** Trym sat by the fountain through a night: *"the
town health didnt decrease a single percent while ghosts had fun for the whole night … doesnt feel
very scary then."* That night was the town's own — one every twelve minutes, cosmetic by design —
and only Curse Nights charged the meter; since 20 Sep every night has ghosts, so it looked like one.
Now each lamp a ghost puts out and each bin it tips costs the town **one point**, reported by the
client that watched it (`/life/dark`), and relighting it pays two back — a night's damage is exactly
the work the morning has in it. Bounded by the night, not the person (Trym, after a second night:
*"up to 10% off the town meter a night until its atleast 60% minimum, and cursed nights can bring it
further down"*): **ten points a night, shared** however many watched it, ten per report at most,
taken only while ghosts are out (the town's night, `townNightAt` in the shared clock, or a Curse
Night), and **never below 60** on a plain night — under a Curse Night the ghosts may go on down to
the town's own floor. A `−1` rises where the ghost rests, so the cost is seen at the moment it
happens. Pulse: `town_dark`.

**Both feelings at once.** A Curse Night costs the town, so the morning after needs you.
It also carries the only route to the vendor's shelf and the objects. A healthy town is
desirable; disruption is where the good things are.

---

## 8. Story sits on top, and only calls in

`room.story` is the whole surface a chapter gets:

```
forceCurse({ tier, mins })   a chapter's own night          endCurse()
addGhost(def)                one more ghost tonight
plantObject(id, at)          a specific object in a specific place
closeShop(key)               shut for story reasons
nudgeLife(delta)             the story moves the town — for the holder
```

⚠️ **All of it is local to the player in the chapter.** The questline's ONE RULE
(`world-quest.js`) is that a chapter never touches shared state; a forced night here is
this player's night, and `nudgeLife` moves the band this player sees, never the room.
Nothing in Town Life, the shops, the events or the curse knows a chapter exists.

---

## 9. What is data, and where

| table | drives | file |
|---|---|---|
| bands, set point, rates, caps | Town Life | `worker-rave/src/index.js` (the `TOWN_*` constants above `TownRoom`) |
| the curse clock | the nights | `src/lib/world.js` CLOCK block → generated into the worker |
| bands, hysteresis, condition by band, problem counts, the sky | the look | `src/data/town/condition.js` |
| problem types and anchors | what can be wrong and how it is fixed | `src/data/town/problems.js` |
| stock pools, the shelf per band, the stall, the vendor | the shops | `src/data/town/stock.js` |
| today's event types, the odd spots | the day's oddities | `src/data/town/today.js` |
| ghost behaviours, per tier | the night | `src/data/town/ghosts.js` |
| cursed objects, where they lie, rarity, bounty | the collection | `src/data/town/objects.js` + copy |
| state sprites and their sizes | the look | `tools/build-town-scene.py` → `public/assets/town/s-*.png`, `STATE` in `town-geo.js` |

Adding a shop, a problem, a ghost or an object is a row. Adding a chapter is a call.

---

## 10. What this costs, and the honest limits

- **Budget.** `town-room.js` is its own lazy chunk, 48 000 (27 385 built); the town's own
  script grew to 63 754 of 70 000 with the seams.
- **Copy.** One job, `town-life`: the board's word per band, Pip's counter, the stall, the
  vendor, the ghosts, the closed-today notes, the cursed objects' names. Drafted 14 Sep,
  on Trym's desk. The town runs wordless until it is approved (`import.meta.glob`).
- **Art.** Nothing bespoke. The lit lamp (the pack's own animated halo, on the same lamp),
  the kiosk shutters, the full bin, the dry fountain, piles, tags, crows, candles,
  lanterns, the friendly and graveyard ghosts all exist in the pack.
- **Not built:** the window row (five real players in windows), market-day stalls, the
  story chapter itself, a Pulse ledger tile for the room's number.

---

## 11. As built, 14 Sep 2026 — the seams and the order of things

- **TownRoom** in `worker-rave/src/index.js` (binding `TOWN`, migration `v5`,
  `idFromName('the-town')`); routes `GET /town-life?pass=&alt=&wt=` and `POST /town-life/fix`
  (the park's pass/alt/token gate); `POST /town-life/set { key: LAUNCH_KEY, life }` for a
  launch or a story beat by hand. Payload: `{ life, band, set, stormAt, curseAt, curse,
  cap: {used, max}, today: {fixes, people}, at }` — always the full payload, `err` inside it.
- **worker-pass** `RULES.town = { fix: {max 12, day 120}, object: {max 80, day 240}, qa }`;
  `areaOf()` in `banana-pass.js` names `/town`.
- **Client** `src/scripts/town-room.js` `bootTownLife(ctx)` → `{ tick, at, tap, openFor,
  seam, story }`; `banana-town.js` hands it `PROPS` (keyed overlays: the lamps `lamp0–7`,
  `bin`, `cafe`, `info`, the shopfronts, `board`, `statue`, `cart`, `bus`…), the loop, the
  taps, the cards. `town-life.js` gained `setKeep / setGlow / setOverride / setLitter /
  beat / homeOf` and `LITTER_MORE`.
- **QA**: `?towntest` runs the room's arithmetic in memory; `window.__town.room` is the seam
  (`set(v)`, `curse('deep'|'none')`, `fix(id)`, `problems()`, `lamps()`, `shelf()`, `rich()`…).
  `tests/town-life.spec.mjs` walks four scenes and writes whole-town overviews to
  `test-results/town-*-all.png`.
- **QA, the day** (22 Sep 2026): `?towntest` walks a PLAIN day — none of the date's own draw (a closed front, the merchant, an odd spot, crows, a day ghost), because four walks fell over the morning the draw shut the store. A walk that wants the day's events pins them: `window.__town.room.today(['closed'], 'cafe')` re-stages the day (the second argument names the shut front); without arguments it only reads.
- **Deploy order** (Trym runs wrangler): worker-rave, then worker-pass, then worker-pulse.
  Until worker-rave is live the town reads no life and stands as it always did.
- **Garbage (15 Sep):** the two dumpsters (`dump0` the works yard, open and empty by nature;
  `dump1` behind the café, closed) and the three street bins (`bin` at the kerb, `bin1`/`bin2`
  on the terrace) are keyed props. A full one is the pack's own full sprite over the prop
  (`dumpfull`/`dumpfulls`/`binfull`) with bags and a box standing beside a dumpster and a
  pizza box or a bottle bag beside a bin; how many are full is the band's `bins`/`dumps`
  count in `condition.js`, and a full one is a `bin`/`dumpster` problem. Fixed = the rubbish
  puffs away, the lid comes down (`dumpclose`, the pack's frames) and it stands closed and
  empty for the day.
- **15 Sep, the second round:** a container fixed is a CLEAN-UP (the litter problems and flyers within
  170 px go with it, paid like any fix); a cursed object stands in a dark purple fire (the pack's
  `Flame_1`/`Flame_2` tinted by CSS hue, an aura on the ground, a small lick in front) and every
  `WHERE` spot is measured clear of every prop box — the walk gates it (the first spots sat under the
  dumpsters, the square benches, the garden boxes, a tree and the info kiosk); a story hook plants the
  object it names (it drew a random one before); the planks follow the world's scale (`--ws`) with a
  floor, so a phone's stall signs fit their stalls; `board.people` redrafted as "Players who fixed today".
- **15 Sep, the night, as decided with Trym:** EVERY night has ghosts (three on a plain night, more on a
  Curse Night, all eight on a deep one); the friendly ghost roams the town waypoint to waypoint (`ROAM`,
  measured free) facing where it goes, keeps away from bananas (yours, the residents', other players' once
  the town draws them — `ctx.others()`), fades if you walk into it, and at rest makes MISCHIEF: it snuffs
  a lit lamp near it, tips an empty bin or dumpster, or drops litter where it hovers — each a problem of
  yours, paid like any other, at most four per ghost per night. Ghosts are never a threat to the player
  (3.8% of players ever dodge the world's one hazard); the threat is to the square. Walk-over picks up
  everything but a lamp. The night scrims are a step darker.
- **15 Sep, the night that matters (Trym's play):** roamers at 58/50 px/s, ×1.7 when chased, a mess at every
  rest (cap six a night); EVERY night lays one cursed thing out (a creeping night two, a deep one three),
  dawn takes the untaken; the ten cursed objects are SMALL things that read cursed (teddy, backpack, urn,
  toy robot, mirror, clock, plus the lantern, the campfire, the redcaps, the table lantern) — six new names
  drafted through the rig, awaiting Trym; the board's lamp row is the REAL eight lamps (lit / stuttering /
  dark), never a band gauge; `TOWN_FIX 2.0`, `TOWN_FIX_CAP 24` (was 1.2 / 10: a day of fixing barely showed).
  The copy gate learned `redraft: '<why>'` — the approved words may lag the code while the rig's draft on
  the desk passes every rule; the flag must be dropped the day the draft is approved.
- **Tuning left as designed:** the numbers in §2 and §7. Change them in one place each (the
  worker's `TOWN_*` block; `CURSE_TIERS` in world.js, then `node tools/build-worker-allowlists.mjs`).
