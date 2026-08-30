# The Homestead's returning mechanic — THE YARD LIST

Design spec, 30 Aug 2026. Answers Trym's question: "theres nothing there to
'play' - you just build and thats it - wheres the game".

## 0. Verified before you read it — and one correction to the plan below

**The collection game already exists in the file.** Verified at
`src/scripts/banana-homestead.js:969-1010`: twelve named species in four
rarity tiers (`SP_TIER`), display names (`SP_NAME`), a rep ladder of 1/2/4/8
on weights [1, .45, .16, .05], a per-day sighting list keyed `pk_birds_day`
that is **shared with the park** ("one birdwatching life, two places"), a
permanent per-species collection stat (`passStat('bird_'+sp)`), and a spawner
that deliberately lands birds on props the player placed. I drove it with the
`__hsBird` QA hook and it works beautifully — house finch, cardinal, white
dove, crow, magpie, chickadee, standing on the furniture. `homestead_bird`
has fired **zero times in 90 days**.

**⚠️ CORRECTION TO SECTION 6 BELOW.** The plan says the `landSpot` fix alone
makes `homestead_bird` fire and should ship regardless. It does not, and I
verified why: `spotBird` is only reachable from `:2952`, which begins
`if (!b.sp || b.mode === 'out') continue` — **only SPECIES birds are
spottable**, and a bird only gets `.sp` when `feedFresh() && houses.length`
(`:1058`). So the real gate is arithmetic:

| step | cost |
|---|---|
| tent (stage 0 -> 1) | 50 coins |
| birdhouse (`decor.js:32`, stage 1) | 15 coins |
| fill it (`FEED_COST`) | 5 coins |
| **total** | **70 coins** |

…against a homestead lifetime faucet of **10 coins** (5 road coins x 2c,
`:1436`). The collection is unreachable without earning 70 coins somewhere
else first. **The faucet (step 3) outranks `landSpot` (step 2) in the real
ship order.**

**✅ SHIPPED 30 Aug:** the `landSpot` widening — perches now include your roof,
the mailbox, the sign, fence posts and dug beds, so a bare claimed yard gets
ambient birds. Verified: 7 birds on a yard owning **zero** items, where the
old code returned null and spawned nothing. That is ambience, not the
collection — the 70-coin wall is still there and needs Trym's call.

# THE HOMESTEAD'S RETURNING MECHANIC — THE YARD LIST

## 1. The answer

**The game is who turns up.** The returning mechanic is a daily roster of animals that your yard attracts on its own — and *who comes is a pure function of what you built*. A long fence brings a goat. A lit campfire brings a dog. Water or six dug cells brings ducks. A coop brings hens that leave eggs on the ground overnight. You don't order them and you can't summon them; you can only change the conditions, which means the fence, the flowers and the lantern stop being ornament and become the **only input channel to the game**. You come back not to add furniture but to find out who showed up.

This is not a design to invent. It is a design to *switch on*. A complete Neko-Atsume core is already written in the file and has fired **zero times in 90 days**: twelve named species with rarity tiers (`SP_TIER`/`SP_NAME` `src/scripts/banana-homestead.js:970-976`), a rep ladder of 1/2/4/8 on weights `[1, .45, .16, .05]` (`:977-979`), a per-day sighting list that already resets daily and is shared with the park (`spDay`/`spAdd`, `:986-1000`), a permanent per-species collection stat (`passStat('bird_'+sp)`, `:1006`) and a spawner that deliberately lands visitors **on the player's own placed props** (`landSpot`, `:1028-1042`). It is unreachable because of one predicate: `const pool = …state.items; if (!pool.length) return null;` (`:1030-1031`) — a new yard owns nothing, so `makeBird` bails (`:1044-1045`) and nobody has ever seen it. The reward for furnishing is gated behind furnishing.

**The daily loop:**

open → 2-5 animals are already standing on props you placed (generated on arrival from the day + your yard, so it can never be missed) → arrival line says *what changed* ("🐾 3 visitors — the goat is new") → walk the circuit, each is a sighting: +rep by rarity, a permanent row on the Yard List → walk over the traces yesterday's visitors left (egg under the coop, feather by the birdhouse, wool on the fence) → coins + pantry → the List names one animal you've never seen and what it wants ("🐐 goat — likes a long fence: 12 of 20") → you build that one thing → close. Tomorrow: different cast, and what you built changed it.

90 seconds, no cards, no taps beyond one.

## 2. Why this and not the others

**WINDFALL (the sky delivers).** Cheapest to build and it contains the single best line in the whole submission — rain watering your beds for free, the park's own `worker-rave/src/index.js:1228` pattern pointed at the homestead's only day-gated verb (`:2635-2641`). But judged on "would you open the tab tomorrow", it fails on novelty: the content never changes *identity*. Day 12 is the same leaves, the same puddles, the same mushroom in a different spot. Weather is on screen 7.3% of the time (`src/lib/world.js:195-200`), so ~92% of arrivals meet a clear sky and the loop is carried by its own patch — a "guaranteed dry-day drift" — which severs it from the weather it's named after and leaves a generic loot scatter with a skin. And in a private yard, a scatter is *your* mess: the park's weed works because nobody made it and clearing it is a gift to a commons the homestead does not have. **Grafted in anyway:** rain-waters-beds, and the inverted morning-after note. Both are a handful of lines against a clock that is already pure.

**CALLERS AT THE GATE.** The highest emotional ceiling — someone reacting to the specific thing you built — and the time-shifted walk piggybacked on `POST /news` is genuinely clever. It is the wrong design *this year* for two reasons. First, it doesn't need players online, it needs players to **exist**: 10 users have ever fired `homestead_claim`, so the index it draws from is nearly empty and every caller is Old Peel or the delivery driver — an NPC line bank of ~8 asks, exhausted by day three, and the highest ongoing content cost available to a solo dev. Second, it renders a real named player's banana and puts words in their mouth that they did not write, four metres from the guestbook, which is the area's one authentic social artefact. That hazard is the rendering, not the storage, and you can't fix it later. **Grafted in:** the `/doors` client (`worker-rave/src/index.js:2694` — verified zero callers anywhere in the repo), and the delivery van arriving as a person instead of a toast.

**THE HOUSE HAS AN OPINION.** The truest answer to the literal words "except ordering more furniture" — a wish answerable by *moving* something you own or by free fence (`:2830-2846` charges nothing, which is exactly why fence is the most-used verb on the site). Two things sink it as a spine. The design confesses the first: a score computed from static state does not change overnight, so `snugScore` alone makes day 2 byte-identical to day 1 — a badge, not a game. The second is worse: wishes are drawn from unclaimed score terms, and terms flip true **permanently**. Somewhere to sit, a light, a fence run, something indoors — satisfied once each. That's a week of content, after which the generator repeats, nags, or walks straight into "order more furniture". **Grafted in — and this is the best salvage in the set:** `snugScore` is a far better *attraction formula* than a displayed rank. It feeds the roster width and the rarity roll. Arrangement quality becomes how much life shows up, not a bar.

## 3. What is at stake

**A genuine threat is wrong here, and the ledger agrees before the doctrine does.** `src/lib/banana-pass.js:415-421` refuses a negative delta at runtime with a console warning, and slots are max-merged across devices so even a successful decrement is undone by the next sync. `src/lib/pass-defs.js:60-62` records non-decay as your core rule; `:6` bars streaks by contract. "You lost X" is not off-doctrine, it is unimplementable without rewriting the ledger.

What Trym is actually asking for is not punishment — it's **"something is happening whether I am here or not."** The park proves it: its two best verbs are `park_weed` (9.1 sessions/user) and `park_trash` (6.8), and neither punishes anybody. They are work the world generated while you were away. Your own worker comment says it outright: *"a storm makes chores rather than damage — and chores are the park's actual game"* (`worker-rave/src/index.js:115`).

So the three honest stakes here, in descending strength:

1. **An appointment, not a wound.** A species pays rep once per day, gated by machinery that already exists (`spAdd`/`pk_birds_day`, `:986-1000`). If you don't come, nothing is taken — a specific cast standing in your specific yard simply only existed today.
2. **A gift that accrues and stops.** Traces cap at 3. A fortnight away and one night away hand back the same full yard. AC gets this wrong (9 days away = 9 days of weeds); Neko Atsume gets it right, and absence is the *precondition* for the reward rather than the thing punished.
3. **A list with gaps, each naming its own cure.** 4 of 22, and every unseen row is a sentence you can act on. Zeigarnik pull at zero cost, and it never grades you down.

**The hard line, testable:** the world may ADD to the ground and the sky, and may NEVER mutate an object. `state.items`, `state.fence`, `state.stage`, `state.style`, `state.inItems`, `state.home` (`:107-139`) are read-only to every mechanic in this design.

## 4. The first week, on a 375×667 phone

**Day 1 (fresh, stage 0, owns nothing).** Claims the plot, walks the road coins (`:1436`, 10 coins). Two visitors are *already there* — a rabbit by the sign, a chickadee on the mailbox. Only possible because `landSpot`'s pool now includes fixtures a claim always has. Walks over: "🐇 a rabbit — common +1". The Yard List opens at 2 of 22 and says one thing: "rabbits came for the wildflowers · 🦆 ducks want water". **The hook: something was here and I didn't put it there.**

**Day 2.** Three visitors, one new. The rabbit left a trace — walk-over, +2 coins. List 4 of 22. Under *not yet seen*: "🐐 goat — likes a long fence (you have 0 of 20)." **This is the moment the fence becomes a game input**, and it lands on the verb these users already do 87 times.

**Day 3.** He fences. Twenty cells is a couple of minutes of the thing he already loves and it costs nothing. Next open: **a goat is leaning on his fence.** +4 rep, "rare", new row. That sentence is the whole design, and it cost one predicate.

**Day 7.** Traces have paid for a birdhouse (15c) and a feeder fill (5c). Feeder-fresh days pull the park's 12 species (already coded, `:1055-1060`) which write `pk_birds_day` — so homestead sightings count on the **park postcard and the pass bird collection**. One birdwatching life, two areas, zero new code. The coop (45c) is now reachable, and eggs fill the pantry in a single visit — the first time in the area's history the kitchen (`homestead_cook`: 0 forever) has anything behind it, because the alternative was a 4-watered-day crop (`cropStage`, `:845`) against a 2-minute median session.

## 5. Why the building matters more now

Three people got in and placed **87.3 fence pieces, 51.7 digs, 20.7 moves, 19.3 places** each — and cooked **zero** dishes. That is an *arranger* profile, and the file currently spends its gating budget on a 10-day crop chain. Pointing a farming loop at arrangers is the mismatch already in the code.

In every game where decorating actually matters — Neko Atsume, Terraria housing, the Sims' Environment score, AC's Happy Home Academy — **arrangement is the input variable**, not decoration around a yield system that ignores it. In Stardew a beautiful farm and an ugly one produce identical crops. This design makes the homestead the first kind. The fence isn't scenery any more; it is the reason the goat is here. The lantern is why the dog came. `snugScore` (grafted from angle D) reads variety, seat-with-focal-point, contiguous fence runs of 4+, lit lighting, planted cells — every term capped so a lazy formula can never say "buy 56 bushes" — and it sets **how many** visitors come and how deep the rarity roll goes. Yesterday's 87 fence pieces are now literally the rate at which life shows up.

And it's free multiplayer content: the roster derives from fields already in the published snapshot (`pushYard`, `:286-305`, sanitised at `worker-rave/src/index.js:2415-2470`), so a neighbour walking your yard sees **your** animals with no new route, no alarm, no DO.

## 6. Ship order

**1 — THE TRACK LATCH. Ship this first.** `track()` at `:25` is a bare gtag passthrough with no per-session guard, unlike `park_weed`/`park_trash` which both latch (`park-garden.js:1194`, `:1267`). Copy the one-shot guard. **What it alone proves:** nothing — and that is the point. Without it every number below is uninterpretable and the comparison against 9.1 sessions/user is meaningless. It is the measurement prerequisite, not a nicety. ~20 lines.

**2 — THE LANDSPOT FIX.** Widen the pool from `state.items` to `[items, home, mailbox, sign, fence posts, soil cells]` (`:1030-1042`), and soften the 80px flee bail at `:1104` into a hop-away — under this design walking up *is* the loop. **Proves:** whether a fully-written payoff, invisible to 644 arrivals for 90 days, moves anything on its own. `homestead_bird` goes from 0 to non-zero or the whole thesis is wrong. One line of real change; ship it today regardless of everything else.

**3 — TRACES (the coin faucet).** Yesterday's roster leaves 0-3 objects, walk-over pickup on the park's exact grammar (`park-garden.js:1171-1178`: *"an egg is a FIND, not a chore"*), +1 rep with the ~8% roll for 1-3 coins (`:1257-1264`), edibles into `state.pantry`. Hard cap 3. Art already ships: `public/assets/park/e-egg.png`, `e-eggold.png`. **Proves the economy is unblocked.** Today the entire lifetime faucet is the 10-coin welcome trail (`:1436`) against a 50-coin tent, and `renderShop` hard-gates stage 0 to the tent card (`:1885-1904`). *No version of any of these loops bootstraps without this.*

**4 — THE ROSTER (the spine).** `rosterFor(day, state)`: species pool filtered by a ~10-line LIKES predicate table against fields that already exist (coop→hen/rooster, fountain or 6+ soil→duck, garden-cat item→rabbit, `it.lit` campfire (`:2514-2526`)→dog, `fence.length ≥ 20/40/70/90`→goat/sheep/cow/donkey), sized by `snugScore`, capped at 5, seeded by `seedRand(dayHash ^ slugHash)` (`src/lib/world.js:9`) so it's identical on refresh and for a visitor. Drive it **on top of** `henTick` (`:903-957`) — do not refactor that yet. Six species cost **zero new files**: `a-chicken1/2`, `a-rooster`, `a-duck1/2`, `a-rabbit` all ship in `public/assets/park/` today.

**5 — THE ARRIVAL LINE.** Says what *changed*, never what broke. This is not polish — it is the mechanic. Reuses the news toast queue at `:1699-1713` which fires zero times today because all three of its message sources need another human.

**6 — RAIN WATERS YOUR BEDS** (grafted from Windfall). `weatherBetween` over the missed window sets `b.last` and adds a water on every unripe cell — the park's `worker-rave/src/index.js:1228` line. The homestead's only day-gated verb stops being a thing you can miss; absence gets narrated as "the sky looked after it".

**7 — THE YARD LIST card.** 22 rows; seen ones read from the existing `passStat('bird_'+sp)` ledger, unseen ones show one actionable want. World stat-block grammar, only-the-next-rung, PixelIcon not OS emoji, reached from the mailbox tap that already opens a chip (`:2877-2901`) and currently says "nothing on the way" 99% of the time.

**8 — THE ROAD** (grafted from Callers). Render `GET /doors` into the `.hs-guestlist` scroller (CSS at `homestead.astro:588`, markup node `:714` — it already has max-height and overflow-y). Honest when short: "you'd be the third house on this road." It is the only surface in the world that reveals other yards exist, and the only real answer to *94% never walk out of the area*.

**9 — FOUR NEW STRIPS + `visitorTick`.** Goat, sheep, pig, dog via `farm_strip()` (`tools/build-park-scene.py:1291-1302`); all nine Modern Farm species are on disk in the pack we own. *Then* fold `henTick` into a roster tick. Deferred deliberately: `:936-940` documents that copying between two sprite sets with opposite native facing already shipped backwards-walking animals once.

## 7. What we are NOT doing

- **No fence, structure or decor decay, and no break-and-repair.** It would mutate player-authored state and be the world's first confiscation. A repair button is an admission that damage happened to work someone did. 262 fence pieces from 3 people is the highest per-capita engagement on the site; a mechanic that damages it is a tax on the only thing anyone here has ever loved.
- **No streak.** Barred by `pass-defs.js:6` and `:60-62`, and structurally a punish-absence device. The legal shape is `passVisit()`'s day list (`banana-pass.js:466-476`) — a count of days that happened, which a gap cannot un-happen.
- **No multi-day crops as the reason to return.** Park crops take 3-9 days; 3 users have ever harvested one. The homestead's beds need 4 calendar days minimum. The beds stay as second-week depth. **Any new loop closes inside one visit.**
- **No litter sprites on private land** (`t-litter1-3.png` explicitly rejected). Litter reads as neglect in your own yard.
- **No `snug` HUD rank and no publishing it to `/doors`.** A rank visible to neighbours is a leaderboard wearing a hat. `snugScore` stays an invisible attraction formula.
- **No caller NPCs speaking under real players' names.** Held until there is a population, and even then the words must be visibly the world's, never theirs.
- **No `initWeather(ctx)` import.** It destructures `ctx.puddleSpots`/`ctx.critters`/`ctx.birds`/`ctx.phase()`/`ctx.npc.oldPhasePoke` and mounts into `#pkView`. Only the bed-watering line is grafted.
- **No doorstep *and* traces.** Same faucet. Traces win because they are produced by named characters.

**Three traps to pre-flight**, all previously bitten in this codebase: (a) `henTick` pops every hen under `prefers-reduced-motion` (`:907`) and `birdTick` no-ops (`:1025`) — visitors must stand **still**, not cease to exist; `park.astro:869` already ships `.pk-animal.is-still { animation: none; }`. (b) The `[hidden]{display:none!important}` guard must cover every new node. (c) **`save()` is already a visitor no-op (`:280`) and `pushYard` bails when visiting (`:287`), but the rAF loop runs `birdTick`/`henTick` unconditionally in a visited yard (`:3140-3142`)** — every new sighting and pickup must be gated on `visiting` **on the pay side**, or walking a neighbour's yard mints rep and coins off their props.

## 8. How we will know

Ratios are `users(event) / users(homestead_open)`, today **644**. Homestead events do not latch today — step 1 fixes that, so from ship day forward we also get sessions/user.

| Event | Today | Must beat | Why that number |
|---|---|---|---|
| `homestead_bird` (any sighting) | **0 users, ever** | **40% = 258 users** | Fires on the first open with no purchase and no claim. If it can't clear 40%, `landSpot` was not the blocker and the thesis is wrong. |
| `homestead_visitor` sessions/user (latched) | n/a | **≥3.0 by week 4** | `park_trash` is 6.8, `park_weed` 9.1. 3.0 is "genuinely returning"; below 2.0 it is ambience. **This is the headline number.** |
| `homestead_trace` (pickup) | n/a | **25% = 161 users** | The faucet. Below this, nobody reaches the 50-coin tent and nothing downstream can happen. |
| `homestead_list` (opened) | n/a | **15% = 97 users** | The unfinished-collection pull. If nobody opens it, the gaps aren't pulling and the want-lines are wasted copy. |
| `homestead_buy` | 3 users (0.5%) | **must RISE, floor 3% = 19** | The kill-switch on faucet width. Traces are meant to *fund* the shop, not replace it. If this falls, the drop table is too generous. |
| `homestead_claim` | 10 users (1.6%) | **5% = 32 users** | Visitors on the unclaimed plot are the new claim pitch. |
| `homestead_visit` (walking a neighbour) | 5 users (0.8%) | **30 users** after the `/doors` road ships | The only measure of whether the 94%-never-leave number moves. |
| `homestead_cook` | **0, ever** | **≥5 users** | Any non-zero value is historic and proves eggs made the pantry fillable in one visit. |
| Distinct days per claimed user | unmeasured | **median ≥2** | The single honest test of "returning". One day is a toy. |

Read at day 14 and day 30. The two that decide whether this shipped a game or a decoration are **sessions/user ≥3.0** and **`homestead_buy` not falling**.