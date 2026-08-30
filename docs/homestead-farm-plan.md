# The Homestead IS the Farm — the build plan

Design spec, 30 Aug 2026. Trym's decision: the homestead's missing loop and
the farm's planned loop are the same machinery, so **the homestead becomes the
farm**. There is no separate farm area. Supersedes docs/farm-plan.md's
location and its public/shared framing.

## 0. Verified by hand before you read it

Every load-bearing claim below was re-checked against the source:

| claim | verdict |
|---|---|
| `POST /save` does a wholesale `doc.state = this.yardSan(body.state)` | **TRUE** (worker-rave/src/index.js:2571) — so overnight counters CANNOT live in doc.state; they go on the pass ledger |
| fence is free and capped | **TRUE** — `FENCE_CAP = 120` (:428) and placing a cell is a bare `state.fence.push({i,j})` with no passSpend, so the pen ladder can never be paywalled |
| a cow pen fits without the 300-coin cabin | **TRUE** — tier-1 fence rect [816,432,1344,816] = 528x384px = 11x8 tiles (homestead-geo.js:11) vs an 18-cell pen |
| `/doors` serves QA yards | **TRUE** — /stats filters with `/^testy(-\d+)?$/` (:2601) and /doors has no filter at all, just `idx.slice(0,8)` unsorted (:2694) |
| world-tutorial.js is dead weight in the chunk | **TRUE** — 33,740 B of source, statically imported at banana-homestead.js:16, and the homestead is its ONLY consumer in the repo |

**✅ STEP 0 SHIPPED 30 Aug.** world-tutorial.js is now `import()`-ed behind an
inline read of its own two localStorage keys. Measured: the homestead chunk
went **113,163 → 88,311 B**, from 87% of budget to **68%**. Verified all three
paths in a browser: a first-timer still gets the invite and the chunk loads on
demand; **a returning player fetches it zero times**; `?bwtour` still forces
the full tour. The room for the farm now exists, with no budget raise.

# THE HOMESTEAD IS THE FARM — the build plan

**Spine: THE SMALLHOLDING.** It is the only one of the three where the reward is a living thing rather than a number, and the only one where the verb 3 users already did 87 times each *scales* the reward across five rungs instead of flipping two flags. Grafted onto it, and said where:

- **From THE ROAD OF FARMS** — take the sawhorse down and move the direct-arrival spawn to the gate; and "a hen followed you home" as the day-1 grant. *Why:* the geometry finding is the single highest-value line anyone produced and it is a two-value edit. `banana-homestead.js:1406-1407` puts 89.6% of arrivals at `x:104` walking to `x:300` inside a 520px camera (`:328 YARD_FIT`), while `GATE.x = 1152` and `TENT.x = 1000` (`homestead-geo.js:5,12`). **The majority of players have never once had their own yard on screen.**
- **From THE ROAD OF FARMS** — overnight counters live on the **pass ledger**, never in `doc.state`. *Why:* `POST /save` does `doc.state = this.yardSan(body.state)`, a wholesale replace, on every fence cell and every placement (`worker-rave/src/index.js:2566-2573`). A server-owned `animals` field inside `state` is erased by the next tap. Smallholding's own server bullet walked into this; the Road's persistence model does not.
- **From THE CRATE AT THE GATE** — the sell surface is **one card, two buttons, no tabs, no scroller**, and it lives inside the existing mailbox-shop chrome (`:1774-2159`) as a tab. *Why:* two commerce panels on a 375px screen is a funnel risk in the area whose funnel already collapses at every extra surface.
- **Fixed before build:** the pen test is a forgiving **bounding-box** check, never a flood fill (see §3).
- **Added:** a week-three rung — you name an animal and it recognises you (§7, slice 5).

---

## 1. The area, in a paragraph

You walk in from the west road, past where the barricade used to be, and your gate is right there. Inside is your smallholding: a fire that is already lit, a nest, a water trough, and two hens that followed you home the first day. The hens lay overnight. Fill the trough in the morning and they lay double tomorrow. Fence a run and you can keep a goat; fence a bigger one and there are sheep, and then a cow. What they give you — eggs, milk, wool, cheese — sells at your own gate or goes in the pantry and gets cooked on the fire. Nothing here is ever hungry, nothing decays, nothing is taken. Things ripen for you.

**Daily loop (60–90s, alone, 375×667):**

`arrive at the gate → yesterday's yield is lying in the pen: walk over it → the trough is empty this morning: one free tap → sell at the gate, or drop it in the pantry and cook → leave`

**Weekly loop:** `fence a bigger run → the pen card flips → buy the next animal → it produces something the last one couldn't`

---

## 2. What it pays

Today the area pays **10 coins for its entire lifetime** — 5 road coins × 2c, spawned once per device (`banana-homestead.js:1421-1447`) — while holding the world's biggest sinks: tent 50, cabin 300, house 900 (`:57-63`) and 102 decor rows.

| product | from | per day | sells |
|---|---|---|---|
| egg | hen | 1 (2 if the trough was filled yesterday) | 4c |
| milk | goat / cow | 1 / 2 | 6c |
| wool | sheep | every 3rd day | 12c |
| cheese | 2 milk + cheese machine | 1 | 20c |

**Animals are the sink, not just the source:** goat 35c, sheep 45c, cow 90c, cheese machine 60c — bought at the gate card, gated by pen size, not by house stage.

**Zero to first animal — there is no gap.** Two hens are **granted at claim**, on the exact pattern that already grants `{id:'campfire',lit:1}` and renders it (`:738-742`, `:2497-2508`). The claim itself becomes free (carried forward from homestead-plan step 2 — `offerClaim`'s only production call is still inside `confirmHome`, `:2366`). **First animal costs 0 coins and arrives before the first tap.**

**The ramp:** day 2 = 2 eggs = 8c (16c if fed). Day 4 ≈ 16c. **The 50-coin tent is paid for by the farm around day 4–5** — the first time in the area's history the ladder is reachable from inside it. A maxed pen (4 hens + goat + 2 sheep + cow, fed) produces ~58c of goods a day.

**The gate stall caps at 25 coins of takings per day** — one constant, diegetic ("the road's only got so many customers today"). That cap is not a throttle, it is the pipe: surplus has to become a dish, and dishes need the park.

**The kitchen, retuned.** `homestead_cook = 0 users EVER` because all seven dishes need park crops behind a 3–9 day grow and a 300-coin wheat seed (`:88-104`). Same 7 rows, same `{need, pay|fx, mins, blurb}` shape — no schema change, no card-height regression:

1. **Fried egg** — egg×2 → 10c *(cookable on day 2, no park trip)*
2. **Egg & greens** — egg×1 + radish×1 → 16c *(radish: 5 coins, **1 day**, 1★ — `park-garden.js:54`)*
3. **Creamy soup** — milk×1 + carrot×1 → 22c *(carrot 20c, 3 days, 2★)*
4. **Wildflower bouquet** — daisy×1 + sunflower×1 → 18c
5. **Cheese board** — cheese×1 → 26c
6. **Campfire stew** — tomato×2 → coins ×2, 45 min
7. **Pumpkin pie** — pumpkin×2 → XP ×2, 45 min

Cut: golden loaf (3 wheat = 900c of seed for 25c), fruit cup, tropical smoothie (1,550c of seed). Rows 1 and 5 need no star at all — animal goods never touch the seed system. Rows 2–4 are ≤2★, inside a level-1 gardener's ceiling (`pass-defs.js:98-99 GLVL_STARS=[2,3,4,5,6]`). Rows 6–7 stay 3★/4★ deliberately: the buff tier is depth.

**Every dish above the floor needs one park ingredient, and the cheapest is a 5-coin radish that finishes tomorrow.** That is the answer to the cul-de-sac (`homestead_exit` 5.7%) and it costs zero new code — the pouch pipe already runs (`banana-pass.js:399-404`) and the travel bar is already mounted at `:1245`. The cook card gets one line: *"radishes grow in the park →"*.

---

## 3. Why the fence matters now

**Your fence is a pen, and the pen decides what you can keep.**

| pen interior | holds | perimeter to build |
|---|---|---|
| none | 2 hens *(granted)* | 0 |
| ≥ 4 tiles | 4 hens | ~8 cells |
| ≥ 8 tiles | + goat | ~12 cells |
| ≥ 12 tiles | + 2 sheep | ~14 cells |
| ≥ 20 tiles | + cow | ~18 cells |

Measured: **87.3 fence pieces per user against an 18-cell cow pen.** No new behaviour is required — the reward is retroactive on labour three people already did. Fence is free (`:428`, no `passSpend`) and capped at 120, so the ladder can never be paywalled. The whole ladder fits inside the **tier-1** fence rect `[816,432,1344,816]` = 528×384px = 11×8 tiles (`homestead-geo.js:11`), so **the 300-coin cabin never gates the farm**.

**THE TEST IS A BOUNDING BOX, NOT A FLOOD FILL.** Take the animals' bounding box; if there is at least one fence cell on each of its four sides, it is a pen, and its size is the box. Bias every ambiguous case to YES. Reason: `state.fence` is a cell list, not a polygon; the fence autotile already carries two of Trym's screenshot bugs written into its comments (`:430-450`); and a false "not closed" on a fence the player believes is shut punishes *exactly* the arranger this design exists to reward, with no way to fail forward. **Plus: the enclosure tints live while the fence tool is still in hand** — closed must be *seen* during the act, not reported after.

**Digging also pays now:** an animal inside a pen adds +1 water to each adjacent soil cell overnight — strictly additive, `b.waters++` and `b.last` only moving forward, the exact shape neighbour-watering already uses (`:1698-1710`). A radish finishes early. Direct hit on the 14% harvest cliff.

**Nothing is ever mutated.** `state.items`, `state.fence`, `state.stage`, `state.style`, `state.inItems`, `state.home` stay read-only to every mechanic here. Open a fence cell and the animal simply wanders the plot until you close it again — it is never destroyed, and the card says so.

---

## 4. How a private area stays alive

The honest form of the problem: **the homestead is not dead because it is private. It is dead because it contains exactly one agent, and you cannot surprise yourself.**

Six of the park weed's nine working properties transfer into a private yard untouched: free to fix, instant, pays immediately and diegetically, blocks nothing, unbounded, latchable. Two invert.

**Property 6, "visible on arrival", inverts on geometry and is a pure fix** — the spawn move. This is worth more than any mechanic in the plan, and it is exactly how a fully-written 12-species bird collection reached zero users.

**Property 1, "somebody other than me made this", must be imported.** A resident animal is the cheapest possible import — cheaper than a visitor precisely because it *cannot fail to show up*. `homestead-plan §5`'s "not adding NPCs" is re-decided here: the surviving distinction is **talking heads (still deferred) vs silent residents (now the spine)**. Four supports:

1. The yield is **on the ground when you arrive**, authored by your hens, before any input.
2. The empty trough is **an appointment, not a wound**. Need is today's state and does not accumulate. The pack draws the trough as an Empty/Full *pair*, so empty is a neutral morning sprite, never damage.
3. **Your own build state is the second agent's input** — what you fenced decides what shows up. That is value, not a filled visual.
4. The **away-news queue** (`:1685-1727`) is built, correct, and starved: all three of its message sources need another human. "🥚 the nest is full — four eggs" is the first non-social input it has ever had. It names what is *there*, never what you missed (`worker-rave/src/index.js:115`).

**Property 7 — "your work vanishes from other people's screens" — cannot be bought back at 18 lifetime yards and I concede it.** Its exact inverse is the compensating asset and it is measured: in the homestead work *accumulates*. 262 fence pieces are still standing. Now they pay rent.

**Other players are the ceiling, never the floor.** Fix `GET /doors` because it is broken (it returns 8 rows and all 8 are Trym's QA yards — the QA predicate lives only in `/stats`, `worker-rave/src/index.js:2601`, not in `/doors`, `:2694`) but **do not ship a discovery road in front of an 18-yard world, and never draw FOR SALE plots.** Cozy games hide an empty server.

---

## 5. Absence

**Two weeks away and one night away hand back the identical screen.** Yield accrues from days-since-collected, hard-capped at **2 days' worth**. A week away = the same two mornings of eggs, not fourteen.

This is not politeness, it is the only shape the ledger can express: `passStat` refuses negative deltas at runtime and slots max-merge across devices (`banana-pass.js:406-421`), so "you lost X" is unimplementable, not merely off-doctrine. Streaks are barred by contract (`pass-defs.js:6`).

**Feeding is a bonus on a guaranteed floor, never the avoidance of a loss.** An unfed farm still pays in full; a fed one pays double the next day and turns one hen into the pack's golden variant, which is *visible*. The homestead already proved an invisible multiplier is not a reward — the cook buff multiplies silently inside `passStat`, lives in unsynced `hs-buff-v1`, and has no HUD chip.

**The mechanism, and it is the fix for the flaw the judges caught in two of the three designs:** one ledger stat, `hs_day`, holding the last credited UTC day number.

```
today = Math.floor(Date.now() / 86_400_000)
last  = passGet().stats.hs_day || 0
gap   = Math.min(today - last, 2)
if (gap > 0) { pay(gap * rate); passStat('hs_day', today - last); }
```

Monotonic, never negative, max-merge safe — a second device on the same day computes `gap = 0` and pays nothing. Seeded at claim with `passStat('hs_day', dayOf(claimedAt))`. Same arithmetic as `creditDay()` (`worker-rave/src/index.js:2092-2099`): one step per call, never a backlog, never a subtraction. **It must live on the ledger and not in `hs-v1`, or a player with a phone and a laptop collects the same morning twice, every day, forever.**

**Consequence worth stating: v1 needs ZERO worker changes for the loop.** The roster is derived from published `fence` + `items`, which `pushYard` already publishes and `yardSan` already sanitises (`:286-305`, `worker:2415-2470`), so a visitor sees your animals through the unchanged render path with no new route, no DO field, no alarm — and nothing is exposed to `/save`'s wholesale replace.

---

## 6. The budget

**Measured on the fresh build: `dist/_astro/homestead.astro_astro_type_script_index_1_lang.BXpOgyHJ.js` = 113,163 B against 130,000 (`tools/budgets.json:8`) → 16,837 B free.** Site total 1,172,201 / 1,500,000.

**No raise. Two recoveries, one in reserve.**

1. **`import()` `world-tutorial.js` — 25,157 B measured, risk ≈ 0.** Statically imported at `banana-homestead.js:16`, imported nowhere else in `src/`, so Rollup folds all 25 KB into this chunk. It is a once-ever wizard whose own gates (`world-tutorial.js:506, :638`) do not run until after its 230-line CSS template, STOPS table and finale canvas painter have all been evaluated — **every returning player downloads and parses it forever.** Both call sites are already in the post-boot tail (`:3195-3197`). Replace with an ~8-line inline read of the same two localStorage keys, then `import()`. Precedent in this exact file: `:1658 import('../lib/sticker-core.js')` → its own 19,959 B chunk; `homestead.astro:808` → `world-quest.js`, 57,718 B, its own budget line. **This is a prerequisite, not an optimisation, and it makes the page materially faster for everyone.**
2. **Delete the bird COLLECTION — ~2 KB.** `:965-1018` (`SP_TIER`/`SP_NAME`/`SP_TIERS`/`SP_W`, `pickSpecies`, `spToday`/`spAdd`, `spotBird`) plus the `.sp` branches at `:1070` and `~:2963`. Trym rejected the mechanic; its own header admits it is hand-synced with `park-birds.js`, and it writes the PARK's `pk_birds_day` and `bird_<sp>` stats from a second location. **Keep ambient birds, keep the widened `landSpot` perches, keep the birdhouse purchasable** — nothing anyone bought is removed, but the species overlay changes for 644 people, so **this is Trym's call, not an engineer's.** If he says no, the plan still fits.
3. **In reserve: regenerate `src/data/decor.js` compactly — 5–7 KB.** Generated file, 102 rows, 14,932 B minified, can't be deferred (`:702` needs it to draw). `img` is derivable from `id`, `surface:'ground'` and the repeated `solid:[-12,-12,12,2]` are defaults. Generator change plus a 3-line expander.

**Cost of the smallholding: 22 KB built, not 14.** Sized honestly against `park-critters.js` (20,257 B src ≈ 9.4 KB built for *one* wandering-animal system with no pens, no products, no panel) plus a one-keeper sell card (~3 KB, vs `park-shops.js` at 13 KB for three shops), the pen test and capacity card (~2 KB), yield pickups (~2 KB), and species/price/dish tables (~5 KB — data barely minifies).

**113,163 − 25,157 − 2,000 + 22,000 = 108,006 / 130,000 (83%),** with decor.js held in reserve for another ~6 KB. No raise, and `budgets.json`'s `_raises` procedure stays unused.

**Two things I will not pretend.** (a) *The park's ctx seam saves zero bytes.* All seven modules are STATIC imports at `banana-park.js:29-36` and land in one 126,025 B chunk. Splitting `banana-homestead.js` the same way moves nothing. Only `import()` changes a chunk boundary. (b) *Nothing measures CSS or HTML.* `check-budgets.mjs:8-9` reads only `dist/_astro/*.js`; `dist/homestead/index.html` is already 62,512 B and the pen tint, sprite classes and sell card land there ungated.

**For the record, the merge's hidden price:** a separate `/farm/` would have started at 0 B with its own ~130 KB line against 327,799 B of site headroom. Merging throws that away. The merge is still right — one set of machinery, and the building players already love becomes the input — but it costs ~130 KB and about a week of extraction no new area would have needed. No plan said so.

---

## 7. Ship order

**0. THE EXTRACTION (own PR, before a line of farm code).** `import()` `world-tutorial.js`; run `check-budgets.mjs`; confirm the chunk drops to ~88 KB. *Proves: the room exists.* Ship any farm before this and the chunk sits at ~127 KB and the first toast trips CI and blocks the deploy.

**1. THE FIRST MORNING** *(ships first, worth shipping alone)*. Sawhorse out, spawn moved to the gate, road coins re-strung on the shorter walk. Free claim. A hen follows you home on the road — a creature, not an inventory line. At claim: 2 hens, a nest, a trough, the lit campfire. Overnight eggs as walk-over pickups on `roadCoinTick`'s grammar (`:1440-1456`). The `hs_day` ledger counter. One arrival line. Latch the events (§9). **No selling, no pen, no market.** *Proves the whole thesis: does an object that appeared overnight bring a private-yard player back tomorrow?* If it doesn't, nothing downstream can save it.

**2. THE GATE CARD.** One card, two buttons — SELL / TO THE PANTRY — as a tab inside the existing mailbox-shop chrome. 25c daily takings cap. *Proves the faucet reaches the tent: `homestead_claim` and the stage-1 rate.*

**3. THE PEN.** Bounding-box test, live tint while the fence tool is in hand, the capacity card on tapping an animal (Old Peel / gardener-card grammar, only-the-next-rung), the goat. *Proves the arrangers read fence → yield.*

**4. THE KITCHEN.** Retuned 7-row dish table, PixelIcon/pack sprites replacing `CROP_EMO` and the dish emoji, the "radishes grow in the park →" line on the cook card. *Proves the outbound pipe: `homestead_exit`.*

**5. DEPTH.** Sheep, cow, cheese machine, adjacent-soil overnight watering, and **the week-three rung: name an animal and it walks toward you on arrival and idles by the fire.** *A named resident is the one property in cozy design that reliably outlives the mechanics around it, and it costs no economy tuning.*

**6. NEIGHBOURS (gated).** Fix `/doors` first — QA predicate widened to `/^(testy|trym)(-\d+)?$/`, self-exclusion, serialise the `updated` field `indexUpsert` already stores. Then a visitor may fill your trough, cloned from `visitorWater()` (`:2569-2584`) / `POST /water`. **Only ship the signpost when non-QA yards ≥ 12.**

**Ship-blocker on 1, 2 and 5:** gate every payout on `visiting` **on the pay side**. The rAF loop runs the animal tick unconditionally in a visited yard (`:3155-3159`) while `save()` (`:280`) and `pushYard` (`:287`) are no-ops — the write side is protected and the earn side is not. Without it, walking a neighbour's farm mints your coins off their hens.

**Also in slice 1:** under `prefers-reduced-motion` animals must stand **still**, not vanish — `henTick` currently pops every hen (`:906-910`); `park.astro` already ships `.pk-animal.is-still{animation:none}`. `[hidden]{display:none!important}` on every new node. And check each new sprite's native facing before writing its flip — `:936-940` is the scar from hens that walked backwards.

---

## 8. What we are NOT doing

**Dead from the separate farm plan** (`docs/farm-plan.md`): a new `/farm/` area north of the park; the park as its only door; the shared public barnyard where anyone does chores on anyone's animal; adoption as an ownership surface consulting the SID ledger; its own chunk sized at adoption +15%; the names (the Barnyard, Peel Pastures). None of it has a referent. **Also dead: §4's park radish crop** — it shipped anyway (`park-garden.js:54`), and with the farm inside the homestead it no longer served the farm.

**Forage is cut entirely, not demoted.** homestead-plan step 4 is unshipped, so this is a deletion of a plan and not of a feature. Two free faucets stacking ~22-26c of forage on top of animal yield trips homestead-plan's own guard rail against a world tuned at 5-15c per active day (`world.js:20-26`). The animals *are* the faucet, and unlike forage they are the overnight state change the whole thesis rests on.

**Not building the road of farms, the neighbour gate plots, the FOR SALE signs, or the crate board.** 18 player-claimed yards ever, 5 visits ever, and no discovery surface anywhere in the world. Sprites and code spent on a population that does not exist, and the honest fallback permanently signposts the world's emptiness on every player's arrival walk.

**Not building the day-seeded "standing order".** It is a mirrored table across two runtimes for a market opinion that depends on nothing, and it reads as decoration the moment anyone notices.

**Not building a second commerce panel.** You buy at the mailbox, you sell in a tab of the same panel.

**Not putting animals in `doc.state`.** `/save` replaces it wholesale.

**No hunger, no decay, no confiscation, no streaks, no cooldowns, no locked doors.** An animal is never lost, an open fence never kills one, and there is no state in which the game says you failed.

**Deferred, not rejected:** wool → the forge (phase 2 — `ForgeStudio` is at 53,007 / 62,000 B and a materials economy there is a second design); talking-head NPCs; honey and butchering (no pack art).

---

## 9. How we will know

**Latch first, in slice 1, and re-baseline.** `track()` at `:25` is a bare `gtag` passthrough (byte-identical to `park-util.js:4`), so every homestead number quoted anywhere is raw actions, not sessions — which is why `park_weed`'s 9.1 is interpretable and `homestead_fence`'s 87.3 is not. Add the park's per-session one-shot (`park-garden.js:1267 weedTracked`). This makes every historical ratio incomparable, which is acceptable **only** because slice 1 ships no economy — slice 1 *is* the new baseline, and the benchmark that matters (`park_weed` 9.1 latched sessions/user) only exists in latched form.

**Latch:** `homestead_egg`, `homestead_feed`, `homestead_sell`, `homestead_pen`, `homestead_cook`, `homestead_exit`, `homestead_fence`, `homestead_dig`.
**Do not latch:** `homestead_open` (the denominator), `homestead_claim` (once-ever by nature).

| event | today | must beat, day 30 |
|---|---|---|
| `homestead_egg` *(latched sessions/user)* | — | **≥ 3.0** *(park_trash 6.8, park_weed 9.1; this area has never had a return verb)* |
| `homestead_claim` / `homestead_open` | 1.6% | **≥ 15%** |
| `homestead_feed` / `homestead_egg` users | — | **≥ 40%** *(below this the trough is invisible and the fed bonus is dead copy)* |
| `homestead_sell` / `homestead_egg` users | — | **≥ 50%** |
| `homestead_pen{tiles}` reaching ≥ 8 | — | **≥ 20% of returning users** *(the fence→yield read)* |
| `homestead_cook` | **0 users EVER** | **≥ 25 users / 30d** |
| `homestead_exit` / `homestead_open` | 5.7% | **≥ 12%** *(the park-ingredient pull is its only lever)* |

**Kill criterion, decided now:** if `homestead_egg` is under **1.5 latched sessions/user** at day 30, the private-space answer failed and more animals cannot fix it — stop, and re-open the public-vs-private question rather than shipping slices 3–5 into it.

**Params to carry:** `homestead_pen{tiles}`, `homestead_sell{product,coins}`, `homestead_yield{product,days}` (so the 2-day cap can be checked against real absences), `homestead_cook{dish}`.

---

**Files this touches:** `src/scripts/banana-homestead.js` (`:16`, `:82-104`, `:428-556`, `:702`, `:738-742`, `:903-1018`, `:1245`, `:1406-1456`, `:1685-1727`, `:1774-2159`, `:2366`, `:3155-3159`, `:3195-3197`), `src/data/decor.js:28`, `src/lib/banana-pass.js:399-421`, `src/scripts/homestead-geo.js` *(generated — edit `tools/build-homestead-scene.py:34/:77/:309/:314/:591/:906`, never the geo file)*, `src/pages/homestead.astro`, `worker-rave/src/index.js:2694-2697` *(slice 6 only)*.
---

## Addendum, 30 Aug evening — two rules from Trym after seeing the expanded yard

**1. Pens are containers, not cages for one species.** A pen is never welded to
the animal in it. The player can swap what lives in a pen whenever they want —
sell the goat, keep the pen, put sheep in it. The pen's SIZE decides what it
*can* hold; the player decides what it *does* hold. No "demolish and rebuild"
step, ever — that would tax the fence work this whole design exists to reward.

**2. No artificial animal cap — the pen ladder IS the cap.** Measured 30 Aug:
40 animated animals + 53 static decor items ran at 165fps (desktop). A real
maxed farm holds ~8-10 animals (4 hens + goat + 2 sheep + cow), an order of
magnitude below any performance edge. Page WEIGHT is unaffected by animal
count (that is code size, fixed). The only caps that exist are diegetic ones
the player can see: pen size, and FENCE_CAP 120. ⚠️ Re-verify on a real phone
during slice 1 — the 165 is a desktop number; the park's ambient load is the
precedent that phones handle this fine.

**Land verdict (same session):** stage-3 plot expanded 234 → 372 tiles, now
hard against the tree line on three sides and the road on the fourth. Room for
~4-5 pens + house + decor. More means growing the WORLD from 1800×1100 — a
deliberate decision, not a tweak. Trym: "okay start, hard to say without
filling it up" — revisit after slice 3 (the pen) ships.
