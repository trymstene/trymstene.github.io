# The Coffee Cup as a workplace — the plan (18 Sep 2026)

Trym's ask, 18 Sep: *"the user / users can get a job at the coffee shop, if they buy it as a
business in the town — how will this look — and also, what can we do if it's a shared working
place amongst all players — like a real workplace? Shift-solution? … this will only be fun if
the actual work you do in the shop is fun, like a minigame and/or serving townsbananas showing
up at a line by the store … also just fun if it collides with the cursed night where you have
bananas wanting coffee in a line but at the same time you have to run out to handle all the
ghosts, and bananas in line are complaining … based on how you do in the coffee making game
the more rewards you get … fun is the main focus, and also that it looks visually and feels
like a game, not a webpage."*

How this plan was made: four designs through four lenses (the game loop, the shared
workplace, the Curse Night collision, the visuals), two judges, one critic, all against the
packs and the code as they are. What follows is the merged design. **Nothing here is built**
except the FOR SALE sign. Decisions marked **TRYM** are his.

## 0. The honest answers first

- **Is it worth planning?** Yes, if one thing is true: the two minutes at the counter are fun
  on a phone. Everything else (the sale, the shifts, the night) hangs on that, and nobody has
  thumbed it yet. So the first build is not a worker or a copy job: it is a one-evening
  **bench prototype of the counter** at 393 px, day and night scrim, in both candidate forms
  (see §4), screenshotted and played. That decides whether the rest gets built.
- **"A shared workplace"** at a daily core of eight to ten players, spread over a day, means
  that most shifts have one barista. v1's "shared" is therefore three real things: the same
  clock for everyone (the rush is the same two minutes for every player), a rota log of who
  worked today and whose shift was best, and every shift lifting the shared Town Life. Seeing
  a colleague at the counter needs the town's presence room, which does not exist; that is
  Stage 2 and nothing in v1 may lean on it.
- **"Meet up at a certain time"** is dissolved rather than solved: a shift comes every twelve
  minutes, so no minute is ever more than twelve away from one, and the mystery rule forbids
  publishing a timetable. If Trym wants a real appointment, one shift a day must be a rarer,
  real-clock event (**TRYM**). The plan below assumes no appointment and no booking rota
  (both judges dropped "pins": a booking sheet is a webpage).
- **The cost** is the largest town feature yet: two workers, the generator, a copy job, a new
  chunk, a quest chapter, Pulse, a walk. Many sessions, in small green commits. And the town
  is hidden (noindex, unlinked), so it ships where nobody is until /town opens (**TRYM**).

## 1. What it is

You buy the Coffee Cup and it becomes YOUR kiosk, the way the homestead is yours: ownership
on the pass (`own_cafe`, granted by the pass worker on the proven spend, never a client claim).
Everyone can own theirs; the square shows one café and, when you look, your plank. A shift is
one town beat, two real minutes, on the shared clock: dawn, morning and afternoon for anyone
who holds the deed; night, and every Curse Night, for owners only (the 15 Sep line "a shift
never runs at night" is reversed on purpose: the night shift is the one worth having).

**The loop, moment to moment**
1. The kiosk under the red FOR SALE sign: tap it, Bean's card opens with a buy topic; the sale
   card says one thing (headline, the price, one line, two equal buttons).
2. Buy: a burst on the kiosk, the sign flips to SOLD (tilted the other way, a striped ribbon)
   until the next town dawn; then a wooden plank with your pass name hangs over the door, the
   shutter rolls up, the cup on the roof steams while you are open, the window glows on shift.
3. Tap your kiosk in a working beat: your banana walks to the counter mark; the HUD's own
   clock (sun or moon, m:ss) is the shift clock; a queue forms at the rope on the lane.
4. A customer steps to the counter holding the mug they want; the ticket shows the order as
   pictures (bean, milk, foam, cup), no words.
5. You make it with three one-thumb gestures: **stop the needle** on the grinder (beans),
   **hold and release the pour** into the band (water), **tap three times on the pulse**
   (milk). Grade = the worst station: PERFECT, FINE or WRONG. A wrong cup costs nothing but
   the sale. The zones tighten as the shift goes on.
6. Serve: the customer's mug fills, a coin float, and they walk to a terrace chair and sit
   sipping until the beat ends. **The terrace is the score you read from the square.**
7. Patience is the shadow under each body: green, amber at half (the fidget doubles), red at
   a fifth: they turn their back, walk off past the rope, and drop a cup on the cobbles that is
   a litter problem of yours, paid like any fix. Failure feeds the fixing loop.
8. The beat ends: the receipt card (a measured headline, the take; one line; a miniature of the
   terrace as you left it; the barista board under it; two equal buttons). Coins land once
   through the pass, capped; tips are rep.

## 2. The shared workplace

- Shifts run on the shared wall clock (the town day is `Date.now() % 720000`), so the morning
  rush is the same two minutes for everyone and needs no gate, no roster, no server.
- A shift is joinable mid-beat with pre-aged patience; the queue is seeded per player, day and
  beat, so a reload never rerolls and two players never fight over a customer.
- The shift is a MODE OF THE TOWN, not of a card: its state lives in the chunk (one declared
  storage key), survives a close, a reload and a walk outside until the beat ends. This is the
  decision the Curse Night collision depends on.
- Shared state in v1: one `POST /life/shift` on the TownRoom at the shift's end (the `/fix`
  gate, +2 Town Life under the +24 per-person cap, a name in today's rota) and `cafe { cups,
  people, best }` on the room's read. The A-board at the rope's mouth opens the rota card: who
  worked today, the best shift and its name. A log, never a booking.
- Stage 2, when the town has its presence room: a second banana at the other station, Bean at
  the milk station taking every second ticket, colleagues walking in. Not v1.
- Griefing surfaces: none. No shared till, no claims, no slots, no other player's customers.

## 3. The night shift — the collision

Every plain night (the last two minutes of every twelve-minute day) is a night shift, so the
scene is rehearsed daily; the Curse tiers are its difficulty ladder.

- The ghosts' existing mischief (a snuffed lamp, a tipped bin, dropped litter) lands on the
  terrace and the lane through a small set of café waypoints for the roamers.
- **The lamp rule:** a dark lamp near the line drains patience faster, and every dark lamp is
  always one of your problems (the 18 Sep rule), so "run out and relight it" is a real move.
- **The queue-jumper:** on creeping and deep nights a ghost stands in the line; nobody behind it
  advances until you leave the counter and walk into it (it un-forms as ghosts do now, and
  dares back a few seconds later). The forcing move that makes the choice real.
- The choice every ten seconds: serve the next cup, or run out (catch the ghost, relight the
  lamp, pick up the mess). Both pay something; neither is free of the other's cost.
- **Complaining:** the body does the acting (the shadow's colour, the doubled fidget, the turned
  back, the walk-off, the dropped cup) and one world toast names the leaver. No bubbles, no
  running commentary: the Quiet Rule holds. An exception for queue bodies is a design-library
  change only Trym makes (**TRYM**).
- **Cursed customers** (one in five on a creeping night, one in three on a deep one) order the
  Dark, whose gauge wears the curse's own mirror and blink. A PERFECT Dark leaves a cursed
  object at their feet (one a shift, inside the night's cap) for the night vendor.
- The chapter's finale forces one deep night for its holder, local to them (the ONE RULE), so
  every owner gets the scene the day they buy, whatever the real clock says.
- The morning after is the town's own: the night still costs Town Life on the worker's walk,
  and the mess the shift's ghosts made is on your list.

## 4. How it looks

**In the square:** the rope lane along the café's lane edge baked from the pack's pedestrian
barrier posts; the pack's street-food A-board at its mouth; table-and-chair sets on the
terrace with sit marks; customers as the town's own bodies wearing the residents' hats and
Bean's mug; a served banana carrying a full mug to a chair; the roof cup steaming (a soft
export of the incense column, never blockified) and the window lit while a shift runs; FOR
SALE, then SOLD with a ribbon, then the wooden plank with your name, all three asserted by the
walk so the progression can never regress silently. At night: the town's own dark, two candles
either side of the counter, the queue lit by the nearest lamp's halo, the mischief where the
counter can see it.

**The counter itself** is the one open design question, and the bench prototype decides it:
- **The tray** (the visuals lens): rises from the action bar's edge while your banana stands on
  the counter mark, full width, the ticket strip on its plank header and the gauge under it;
  the square stays visible; step off the mark and it folds, the counter customer keeps its
  ticket; step back and it rises. Answers "a game, not a webpage" literally; the collision is
  in view. Risk: a new tile family under a 393 px view whose bottom the action bar owns.
- **The cabinet card** (the arcade's grammar: one card, the canvas, the board under the screen):
  built, tested, controls timing on one canvas, the panel already owns the pointer. Risk: the
  most webpage-like element the town has, and the chaos happens behind it (a shake and a glyph
  say "look outside").
- **Recommendation:** prototype both on the bench page at 393 px, day and night scrim, and let
  Trym's thumb pick (**TRYM**). Whichever loses is the named fallback.

**Tickets are pictures**, never text; **patience is the body**, never a bubble; **PixelIcons
and pack sprites only**. The pack has no apron, barista or coffee icon: the prize wearable is a
palette swap of Bean's beanie hat that Trym approves as a strip, or nothing in v1.

## 5. Rewards and the economy

- Pay per cup by grade (PERFECT 4 / FINE 2 / WRONG 0), the owner +1 on a PERFECT, tips as rep
  when served past half patience, no night rate; paid once at the shift's end as one ledger
  event under a new `RULES.town.shift` row on worker-pass (about max 60 a shift, 150 to 180 a
  day; the numbers are Trym's), deployed before the client names the faucet.
- The price: a week of good play, in coins, not a new currency (**TRYM** names it). Whether
  owning earns anything while you are not working: v1 says no (a plank, a cut, the night key);
  a passive side is a separate decision (**TRYM**).
- The barista board in a `CAFE_GAMES` table sharing the arcade's score handler but kept out of
  the Arcade Trophy's loop (which would otherwise require a shift for the trophy).
- Drinks: Short, Tall and Double open from the start, plus the Dark that only cursed customers
  order. Regulars: one rung, a resident served PERFECT five times becomes a regular (front of
  the queue, a double tip), one copy field each; more rungs later.
- Each shift posts +2 Town Life under the +24 cap: working the café heals the town the way
  fixing does.

## 6. The gate — the chapter with Bean

1. The coffee propeller needs a bolt: fetch it from Pip's counter.
2. Beans from the travelling stall, the next day it is in the square (a wait, not a grind).
3. A first round served with Bean at the counter: the shift loop once, as the tutorial.
4. Bean offers the sale; buy, and the finale forces the holder's one deep night shift.

Buying gates the day shifts (Trym's sentence). If Pulse shows the wall stalls players against
chapter completions, flip to employee-first with the deed as the upgrade: no rebuild.

## 7. The build list, in order (twelve small green commits)

1. The bench prototype of the counter, both forms, 393 px, day and night. **Trym picks.**
2. worker-pass: `RULES.town.shift`, `CAFE_GAMES`, `OWN_PRICES.cafe`.
3. worker-rave: `POST /life/shift` on the TownRoom (the `/fix` gate, +2 under the cap, the
   rota), `cafe` on the read.
4. build-town-scene.py: the rope posts, the A-board, the terrace sets, the steam (a contact
   sheet for Trym's eye first), geo regen.
5. The copy job `town-cafe`: Bean's four beats, the sale, the drinks, the receipt, the leaver
   line, the rota labels, the night line without a time; `residents[].order` in town-npcs.
6. `src/scripts/town-cafe.js`, its own lazy chunk (its own 50 KB budget row): the sale card,
   the shift state, the queue bodies, the counter.
7. The minigame on the chosen form, the mountBoard lift from town-games.js.
8. The seams in town-room.js (under 1 KB: `openFor('cafe')` imports the chunk, the roamers'
   café waypoints, the clock yielding the slot, the one `cafeOpenForMe()` predicate at the
   shutters, the shutter-problem seeding and Bean's keep).
9. The ghosts' queue-jumper row and the Dark's cursed object.
10. The quest chapter (`AREAS.town`, the four beats, the forced night).
11. Pulse: `town_shift`, `town_cafe_buy` (labels, explainers, lenses, the stub walk).
12. `tests/town-cafe.spec.mjs` at 393 with a CPU-throttled perfect cup, and the docs.

## 8. Decisions only Trym can make

- The counter: tray or card, after the bench prototype.
- Buying gates the job, or employee-first with the deed as the upgrade.
- The price in coins, and whether owning earns anything passively.
- Complaining: keep the Quiet Rule, or an emote exception for queue bodies.
- Owners open at night and on Curse Nights (reversing the 15 Sep line).
- Paid shifts a day (two or three) and the pay shape (by grade, tips as rep).
- The appointment: every-twelve-minutes rush only, or one rarer real-clock shift a day.
- Art: the beanie palette-swap prize, the mug tints, the eye-picked cup sprites, or ship
  without them.
- Build now into a hidden town, or after /town opens.

## 9. Risks to say out loud

- Fun is unmeasured until the prototype is thumbed; four designers scoring it is not a thumb.
- Co-presence will be rare at this player count; the shared workplace is mostly a log.
- The presence room does not exist; Stage 2 is its own project.
- town-room.js is at 92% of its budget: the seam must stay small, the chunk under 50 KB.
- Timing windows on throttled phones and the hold gesture; a CPU-throttled perfect cup must
  be reachable, and the walk must prove it.
- The copy job is the biggest the town has run; the words load after the square stands.
- Curse Nights are rare; most night shifts are plain, which is why the chapter forces one.
