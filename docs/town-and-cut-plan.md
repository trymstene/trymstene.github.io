# Banana Town & The Cut — the plan

Design spec, 30 Aug 2026. 13-agent design pass against a measured art
inventory, then hand-verified. Sits AFTER the homestead/cooking fix and the
farm in the build order.

## 0. Two corrections made after the agents reported

**The ore rocks are real — an earlier claim of mine that no mineral art exists
was wrong.** `Rock_{Small,Medium,Big}[_{Bronze,Silver,Gold,Blue,REd}_Stone]`,
nine files, 96x96, in Modern_Farm Props_and_Buildings. Verified by eye: grey
rock with faceted metal and crystal set into it, rarity reading from silhouette
and colour. The earlier grep searched ore/gem/crystal/mineral and these are
named Rock_*_<Metal>_Stone, so nothing matched.

**No rock cave exists, and that half stands.** cave/cavern/mineshaft/dungeon/
quarry/pickaxe all return zero. `14_Basement` is a furnished lounge (sofas,
coffee tables, cushions); `underground` is car parking; `tunnel` is subway.

**The laser data the plan asks for in section 8 is now in — see below.**
`rave_zap` 512 users (8.0% of 6403 ravers, 3.4 hits each); `rave_dodge` **241
users, 3.8%**. The plan's own decision rule was "if ~6% ever record a dodge,
Cut v1a is the whole area". Measured 3.8%, so **the answer is Cut v1a: build
the ore/cast pipe, hold the ghosts.** Corroborating: `park_stormnote` = **2
users in 90 days** — the entire storm system, lightning and bed-ruin included,
has been witnessed by two people.

# Banana Town & The Cut — the plan

*Written against a measured art inventory and a measured budget. Every number below was checked in the repo on 30 Aug, not assumed.*

---

## 1. The art verdict — read this first

**The Stardew rock mine cannot be drawn. There is no cave, cavern, mineshaft, cliff, dungeon or underground-interior art in any pack we own** — a grep across the full 101,571-file index returns zero for every one of those words. "Mine" only matches landmines in a military tileset. If you want a descent into rock floors, that is a pack purchase, and it is the only thing in this plan that is.

**But the brief's other premise was wrong, and this is the good news: ore nodes with visible embedded gems already exist, as a complete tiered set.**

`~/OneDrive/banana-art-pack/Modern_Farm_v1.2/48x48/Single_Files_48x48/Props_and_Buildings_48x48/` — nine files, every one 96×96:

- `Rock_Small_48x48.png`, `Rock_Medium_48x48.png`, `Rock_Big_48x48.png` (plain grey)
- `Rock_Small_Bronze_Stone_48x48.png`, `Rock_Small_Silver_Stone_48x48.png`, `Rock_Medium_Silver_Stone_48x48.png`, `Rock_Medium_Gold_Stone_48x48.png`, `Rock_Big_Blue_Stone_48x48.png`, `Rock_Big_REd_Stone_48x48.png` (the pack's own typo — keep it)

Grey rock clusters with faceted gems set into them. Rarity reads from **silhouette** before colour. That is a five-tier mineral ladder, owned, today.

**So the choice is not "mine or no mine". It is: an above-ground open-cast pit, buildable now, or a rock cave that needs a pack.** My recommendation is the pit, and everything below assumes it. The one thing the pit gives up versus Stardew is *depth* — and the measured data says depth is worthless here anyway (the rave's deepest verbs reach ~6% of arrivals; three people have completed a park harvest in ninety days).

What else the pit needs, and where it comes from — all owned:

| Need | Source |
|---|---|
| Pit walls / terraces | `ME_Singles_Terrains_and_Fences_48x48_Wall_1/2/3_*` autotiles + `Mound_1_*` / `Mound_2_*` |
| The building on the rim | `24_Additional_Houses_Haunted_House_48x48.png` (912×1056, already dusk-painted) + its 16-piece fence kit incl. `_Pass` walkable gaps + `_Sign_2_Danger` |
| The enemy | `Ghost_1_walk_48x48.png` (1536×144 = 4 dirs × 8 frames, shadow baked in), `_angry_walk`, `_idle`, `_angry_idle`. Exactly calm/angry × 4 facings. `Ghost_2` is a free variant. |
| The heat meter | `moderninteriors-win/4_User_Interface_Elements/UI_48x48.png` — ships an 8-step green→red arc badge. A ready-made danger meter. |
| Good-hit VFX | `Modern_Farm_vfx_Rare_Crop_Glitter_48x48.png` (384×48, 8 frames) |
| The dark | **No art at all.** `src/scripts/park-weather.js` builds four CSS-only composited elements; `.pk-wx__scrim` at ~0.55 in a colder hue is the whole mood, zero rAF cost, reduced-motion already handled. |
| The town | Massively over-supplied: `5_Floor_Modular_Building_Singles_48x48/` named storefronts (Bakery, Ice_Cream_Shop, Music_Store, Shop — each ~336×240 with an illustrated hanging sign), `Terraced_House_1-6`, `9_Shopping_Center_and_Markets` Market_Small/Medium/Big, `2_City_Terrains` sidewalks. |

Two art warnings for whoever writes the compositors:

- **Filename trap:** every file in `5_Floor_Modular_Building_Singles_48x48/` contains "Modular" inside `Floor_Modular_Building`. A naive "Modular not in name" filter matches nothing. Match `Ground_Floor_<name>_<digits>.png`.
- **Don't glob blind:** `Ground_Floor_Gun_Store_1`, `25_Shooting_Range` and `18_Jail` sit in the same folders. So do the Halloween set's blood decals and pentagram sigils and the graveyard set's crosses and coffins. All trivially avoidable — the clean subset (stones, dirt, mounds, dead trees, crows, mushrooms, lanterns, fences, pumpkins) is large enough to build both areas.

**No pack purchase is required for either area in this plan.**

---

## 2. The threat area — THE CUT

**Spine: the open-cast pit** (grafted from *The Cut*), because it needs one flat scene plate instead of two and no art we don't own.
**Grafted in from *The Cellar*:** ore-as-paint — the reward *leaves the area* and gets seen by other people. That is the whole reason to build this.
**Grafted in from *The Old Lot*:** the hazard is aimed at **a place, not a person**. This is the single most important design decision here.
**Grafted in from both judges:** the strike **roots you**, so the enemy is a decision instead of a footrace you always win.

### The place

A stepped pit behind a boarded-up old house, reached by walking north out of the park past the Banana Stand. One phone-screen of pit — no minimap, no getting lost. Permanent dusk from the park's scrim. Lanterns pool light down the ramp. A market stall on the rim is **GRIT's assay stall** — an engine banana on a locked frame who buys your pocket and casts your gear.

### The loop

```
arrive on the rim → free SPOIL on the ramp (overnight, shared, one tap each,
zero risk) → step down a shelf → tap an ore rock → each strike ROOTS you ~1.0s
and raises the pit's HEAT one step → at amber a ghost wakes and walks toward
THE ROCK YOU ARE HITTING → decide: third swing, or step away → touched: your
POCKET scatters as scoopable crescents, heat resets, ghost sinks → walk up to
GRIT → he banks the pocket and casts a wearable you already own in bronze /
silver / gold → wear it into the rave where forty people see it → come back
tomorrow: fresh spoil fell, the seam moved, and someone's dropped lantern is
lying where they got scattered yesterday
```

### The enemy, precisely

The engine cannot support a chase. Measured: `world-steer.js:23` needs a 200 ms held finger before the leash arms, there is no dash, no aim in the walking layer, and realistic time-to-first-dodge on a phone is ~500 ms. A ghost fast enough to catch you is unfair; one slower than you is decoration. Both judges killed a chaser, correctly.

So the ghost **converges on the noise**, not on you:

- A strike is a **1.0 s rooted commit**, cancellable by tapping the ground (you forfeit the swing, not the rock's progress).
- Striking raises **HEAT** — the pit's own meter, drawn with the pack's 8-step green→red arc. It decays whenever you are not striking.
- Green: the ghost sleeps at the back wall. Amber: one `Ghost_1` wakes and walks toward the rock you last struck. Red: `Ghost_1_angry_walk`, faster, and a second one wakes.
- It reaches the rock, not you. Standing off the rock is safe, always, with no reflex required. **Counterplay is walking, which is the only verb this engine has.**
- The decision is therefore concrete and arrives every ~3 seconds: *start the third swing with it eight paces out, or step off and let it settle.*

This is a genuine risk/reward mechanic on a 500 ms one-thumb input model, and it is the honest version of Trym's ask — enemies are present and attacking while you mine, you just fight them with your feet.

### What is risked, and why that is fair

**Only the POCKET** — ore broken this run and not yet handed to GRIT. Nothing else, ever.

The pocket is a plain session object, structurally identical to `tonight` in `banana-rave.js:2158`. It never touches the pass. A ghost touch runs the laser's shipped line verbatim — `const loss = Math.min(pocket, hitFor)` (`banana-rave.js:1821`) — and ~60% of it lands on the floor as re-scoopable crescents for six seconds, with 1600 ms of i-frames.

Six reasons this is fair in a world that has never taken anything away:

1. **It caps at what you carry.** A first-timer with an empty pocket loses exactly zero and gets a comedy "SPOOKED!" float. Newcomers cannot be hurt.
2. **You watch it happen**, in front of you, on the floor, where you can go and get it back. The only loss players accept is one they saw.
3. **Nothing you own is touched.** No coins, no rep, no wearables, no shelf, no banked ore. `passStat` refuses negative deltas at the API boundary (`banana-pass.js:415`) and `pass-defs.js` records the no-decay rule in your own words — this design never asks it to bend.
4. **It auto-banks on every exit path** — `visibilitychange→hidden`, `pagehide`, back button, travel door, HUD. A phone call cannot cost a run. This is the beach's banked-not-binned doctrine (`banana-beach.js:2706-2711`) at its strongest reading.
5. **It is never persisted.** Session-only, always auto-deposited. That kills the cross-device ambiguity the research flagged: there is no such thing as an abandoned run.
6. **You chose it, one tap at a time, with a red arc on screen.** And the free spoil on the ramp means a whole session can be played at zero risk.

The world has already shipped loss twice — the park storm (`stormWreck()` rots 50% of planted beds and clears every birdhouse) and the rave laser. This is the laser's model, in a room built around it.

### First 90 seconds, on a 360-wide phone

- **0:00** — Arrive on the rim from the park's north gate. One screen: a fenced yard, a boarded-up house, and a stepped pit falling away behind it. Cold blue scrim. Two other bananas are visible on the ramp — the entrance is public, because private space is dead space.
- **0:03** — The ⛏ action button is already on screen (the beach's `.bh-actions` sibling-of-view pattern, so overlays can't bury it). Loose spoil sits three steps ahead. No modal, no tutorial.
- **0:06** — Tap the ground, walk, tap ⛏. *"a chunk of bronze."* Pocket: 1. **First payout at six seconds with zero risk taken** — the property that converts 53% of beach arrivals into digging.
- **0:12–0:35** — Four more spoil piles down the ramp. Pocket 6. The heat arc has not moved; spoil is free. A 40-second visitor's session is already complete.
- **0:38** — Shelf one. A small bronze-flecked boulder. Tap ⛏: the banana roots, swings, the rock drops a size (`Rock_Small_Bronze` → grey), +2, and the arc ticks one green step.
- **0:44** — Second strike. Two steps. Across the pit a ghost stops, turns, and its face goes angry (`Ghost_1_angry_idle`, a real stationary tell — the laser's `LZ_WARN = 1.25`). It starts walking toward the rock.
- **0:50** — Third strike. Glitter fires, +3, the rock pops. You step off. The ghost arrives at an empty rock, hangs, and sinks. **You beat it by walking, on purpose.**
- **1:05** — Shelf two, a silver rock. +4, +6. Arc amber. Pocket 18. The whole game is this beat.
- **1:20** — Walk up to GRIT's stall. Button reads **"hand over the 18"** — the beach's own word for banking. Banked.
- **1:28** — His cast panel: your crown, rendered live in bronze on your actual banana. 12 bronze. Tap CAST.
- **1:35** — You are wearing a bronze crown. The travel door is right there and the rave is one tap away.

Ninety seconds, one complete loop, one real decision, one thing you kept, and a reason to be seen wearing it.

### The overnight chore — non-negotiable

The park's two highest-return verbs are weeding (9.1 sessions/user) and trash (6.8) because the *world* made them while you were away. The Cut ships the same shape or it dies:

- **Fresh spoil** falls on the ramp every night — 4-8 grey rocks, one tap, no heat, no ghost. The free requires-nothing opener that makes a 40-second visit worth having.
- **The seam moves** — daily re-roll off the same splitmix32 the daily banana uses, and veins **deplete for everyone** via a shared Durable Object. Someone else got the gold one before you today.
- **Dropped lanterns.** Where a player got scattered yesterday, their lantern is on the floor **with their name on it**. Pick it up for +2 rep and it goes out. A chore another player authored, built from the ~60 lantern files we already own.

---

## 3. Minerals: the sink

**Ore is not a currency. Ore is paint.** That is the direct answer to "the minerals need to add value to the risk" — the value is a *look other people can see*, not a number in a HUD.

At GRIT's stall you bring ore and a wearable you already own, and it comes back cast in metal. Your crown in gold. Your viking helm in silver. Your medal in bronze.

**I verified this is cheap, and the way to make it cheap is specific.** The naive version — an `o.cast` field on the outfit — is a trap: `worker-rave/src/index.js:438` `sanitizeOutfit` rebuilds the relayed outfit from `HAT_IDS` / `SHADE_IDS` / `EXTRA_IDS` only, so `o.cast` is silently stripped and **nobody else ever sees the gold crown**, which is the entire payoff. It would then also need teaching to the shelf, drops, the wardrobe, the PDP renders and `tools/banana_render.py`.

**The cast must be a new wearable ID, with derived art.** Then:

- The worker allowlist is **generated** — `worker-rave/src/index.js:27` is bracketed by `ALLOWLISTS-START/END … GENERATED by tools/build-worker-allowlists.mjs from src/data/wearables.js`. Rerun, deploy, done. Free.
- The shelf, drops, the wardrobe, My Pass and the PDPs all read the manifest. Free.
- `tools/banana_render.py` regexes the art out of the engine (`SVGS = dict(re.findall(r"(\w+): '(<svg[^']+</svg>)'", ENGINE))`) and imports the manifest via node — so it needs ~15 lines to apply the same ramp. That is the only mirror that costs anything.

**And the art must be derived, not drawn.** Measured: the engine holds 102 inline SVGs totalling 195,771 bytes out of a 206,886-byte built chunk against a 240,000 budget. Hand-drawing metal variants costs real money — `tophatsilver` is 4,980 bytes and `tophatgold` is 4,395, both hand-authored for the supporter tiers. Twenty-four hand-drawn casts would blow the engine budget on their own.

So: a manifest entry `{ id:'crowngold', art:'crown', cast:'gold', earned:'cut' }`, and a ~40-line ramp that luminance-ranks the non-outline `fill="#rrggbb"` values in the source SVG onto a three-tone ore ramp before `imgFor()` rasterises it. `imgFor` already caches by the SVG string itself (`banana-engine.js:303`), so a cast caches like any other art. **Cost: ~120 bytes per cast in the manifest, one ramp table, no new sprite, no `ctx.filter`** (Safari silently ignores it — that already cost one iOS bug).

Pack fidelity is untouched: world scene art stays 100% pack, and the recolour only ever touches wearables we drew ourselves.

**⚠️ Exclude the top hat from the castable list.** A gold-cast top hat would be visually indistinguishable from `tophatgold`, which is the $15 supporter tier. Casting must never fake member gear.

**Three ores in v1, not five.** Bronze / silver / gold, mapped to `Rock_Small_Bronze_Stone`, `Rock_Medium_Silver_Stone`, `Rock_Medium_Gold_Stone`. Six ledger slots (`ore_<kind>` / `ore_<kind>_spent`, balance derived by subtraction exactly like `ticketBal()` at `banana-beach.js:2349` — no new formula owner, no decrements). `Rock_Big_Blue_Stone` and `Rock_Big_REd_Stone` are already on disk and are the first expansion, so the ladder grows with zero art work.

**Ore never leaves the Cut.** Earned there, spent there — so it is an area-local chip under the JELLY/gardener rule, not a fourth world-wide currency. **The cast wearable is what leaves.**

Pricing, built around "depth is not reached": a bronze cast costs 12 bronze and is reachable on visit one from the free spoil, in under two minutes. Silver 20, gold 32. **Depth changes which ore is on the floor, never how good it is.** You come back because you haven't got the gold one, not because the good stuff is at the bottom.

Second sink, free and public: **THE RIM BOARD** — everyone who cast today, their banana rendered in its finish, newest first. Reuses the supporter park board furniture shipped in `c0128781`. Public, not on the pass, because the homestead's 644 opens / 0 cooks proves a private display case is a dead one.

**And the honest answer to your question about order: yes, the sink has to exist before the source is worth building.** A cast wearable seen at the rave is the reward. Which is one of two reasons the town goes first — see §6.

---

## 4. Banana Town

**Spine: the square that remembers.** Grafted in: the area registry and the signpost from the crossroads design; the once-per-thing-per-day cap from the market design. Cut entirely: the chassis extraction, player-typed text, and the price economy.

### Why it is not a sixth storefront

The repo audit is blunt: **every shopkeeper archetype a town would ship already exists and is staffed.** General store = the Banana Stand. Merch = Inka's kiosk *and* Palma's hut *and* /shop/. Furniture = the homestead phone (102 items, delivery van, resale). Seeds = the park garden's 16-seed ladder. Tavern = Barty. Appraisers = Sabreface, Shelly, Gil. Prize counter = the pier. Fast travel = `world-travel.js`. A town built as "the place with the shops" would be the sixth storefront and the tenth shopkeeper.

**So Banana Town sells nothing. Every door is shut and stays shut.** That is the structural guarantee, and it means the 5,296 interior sprites are not needed for this build.

What the town uniquely owns is the thing the audit proves is **totally absent**: no NPC anywhere in this world remembers anyone. There is no relational state in the entire pass keyspace. That gap is the town.

### The mechanic that makes it sustainable for one developer

`src/lib/town-facts.js` — **dialogue as a pure function of state that already exists on disk.** One function returns `{ rank, level, awayDays, daysSeen, lastArea, wearingHat, hatId, gardenerLvl, tickets, patches, member, parkBloom, raveCrowd }`. Every field is already there: `rep` + `levelFor`/`rankFor` (`pass-defs.js`), the pass's `days` array (`banana-pass.js:464-474`, union-merged across devices, 400 days deep — that gives "how long since you were here" for free), `bb-last` for the current outfit, `GET /park-garden` for live bloom.

**Zero new persistence. ~40 authored lines produce infinite occasions.** That is the exact inverse of Stardew's per-heart hand-authored treadmill, and it is the only reason three characters can stay fresh under one writer.

### The loop

```
arrive (square changed overnight: fresh leaves, new faces, three new WANTS) →
a resident greets you at the rung of the name ladder you've earned and cites
something you actually did somewhere else → sweep the leaves (requires nothing,
pays immediately) → show a resident the thing they want to see today → they
thank you BY NAME and the square gains bodies for everyone standing in it →
leave the town warmer than you found it
```

**THE NAME LADDER** is the only status in this world you cannot buy. Residents call you, in order: nothing → "friend" → your actual name (`myName()`, `banana-id.js`) → your name plus something you did. It never decays; `met_<npc>` is a monotonic counter. The naming moment fires **after** the deed, never before, so "not now" costs nothing.

**THE WANTS** — three residents each want to *see* one thing today, date-seeded so everyone shares them: somebody in a hat, somebody carrying a fish, somebody with a garden badge, somebody at Regular rank. Showing pays coins + rep, **once per want per day**. This is the market design's best mechanic — a per-day, per-thing cap makes *variety* the only way to earn more — with no market, no prices, no tuning treadmill and no new currency. If you haven't got it, the resident says where it is, and the travel door is right there. **That is the first reason this world has ever given anyone to walk from one room to another.**

**THE WINDOW ROW** — five house windows hold five real players' bananas, claimed free, recycled on market day (claim recycling, the birdhouse doctrine at `worker-rave/src/index.js:2152`). **Outfits only, no text.** Outfits are already moderated by the generated allowlist, so this ships with zero free-text surface and zero moderation obligation — which is the one ongoing cost a solo dev cannot pause.

**MARKET DAY, Saturday** — wall-clock, no server tick. Stalls up, residents stand somewhere else, wants pay double, windows turn over. The one mechanic in the world that gives somebody a reason to open a URL on a named day. It's pure data (one `getUTCDay` lookup), so it can ship dark and be switched on after there's a baseline.

### The cast: three, plus a crowd

Old Peel is **14,951 bytes for one NPC** (`src/scripts/park-npc.js`). Twelve of those is arithmetically impossible. So: **three residents at real depth** — MOSS (sweeps, the first hand-off), DOT (the kid on the kerb who wants to see things), GRAN FIG (the window box, notices where you came from) — plus scheduled, walking, non-talking townsfolk who make the square feel inhabited. Each speaking resident is ~2.5 KB of data (they have no five-phase health bands and no three weather sets, which is where Peel's bulk lives).

**All of them are bananas.** The 2,608 Modern Interiors human sprites stay unused for characters. `world-quest.js:19` records your own verdict on weak NPC presence — *"theres no banana NPC greeting me — a floating ! is not a character"* — and that is an argument for more banana, not for humans. Every DRAW object goes through the dev-only `checkDraw()` guard (`banana-beach.js:147-175`); the ID guard silently draws nothing for an unknown id and that cost the beach three bugs.

---

## 5. How they connect

**Doors.** Add `src/data/world-areas.js` — one row per area `{ key, name, icon, route, countPath, spawnParam, gate }` — and refactor `world-travel.js` (which today hardcodes AREAS/ORDER/hrefFor at lines 16-27) to build from it. The homepage and the town's signpost read the same file. **A new area then joins travel, the signpost, the homepage and the live headcount by appending one row.** Do this before either area exists, since two are queued. (Note: the travel card currently uses OS emoji for its area rows — a pre-existing icon-doctrine violation. Don't propagate it into the signpost.)

Walked roads: park → town (west road), park → the Cut (north road past the Banana Stand), town → everywhere via the signpost. The town **is** the hub — "The Bunch" folds into this rather than shipping alongside it.

**Currencies.** Unchanged. Bananacoins world-wide, tickets beach-local, JELLY rave-local, rep world-wide-and-undecrementable. The town mints nothing new (its coins come from the shared world clock that already runs in every room). The Cut adds **ore, which is area-local** — earned and spent inside the fence. No fourth ladder.

**What flows in and out:**

| Area | Sends into town / the Cut | Gets back |
|---|---|---|
| **Park** | the north and west roads; Old Peel is the first errand destination | a coin sink for the 16-seed ladder; the seam's overnight-chore pattern proven a second time |
| **Beach** | fish and shells become *things to show* — Dot's wants point at the pier | the beach becomes somewhere with a reason to go, not just a place |
| **Rave** | the crowd that sees a gold-cast crown; the exit door re-points to the town | its wearables become castable, so the shelf gets a second life |
| **Forge** | wearables you own are the input to a cast | the longest-session surface in the world gets a new reason to exist |
| **Farm / homestead** (once fixed) | dishes and produce become things residents want to see | its output finally has an audience outside your own yard |
| **Banana Stand** | untouched — casting happens at GRIT's stall, not in `park-shops.js` | its 13 items become castable, which is a 3× multiplier on a shelf that has never restocked |

That last row matters: casting **does not cannibalise the stand**, it makes buying from it worth more.

---

## 6. Order of work

**Your order stands: homestead + cooking fix → farm / chickens → then these two.** Nothing here should jump that queue. The homestead is 644 opens / 1 water / 0 cooks; fixing a dead area beats opening two new ones.

Then: **town first, the Cut second.** Four reasons.

1. The town needs **no tone decision from you, no enemy, no pack purchase, and one flat scene plate.** The Cut needs a yes on the haunted register before a line is written, and has no second art path if the answer is no.
2. **The sink should exist before the source.** Shipping the Cut first means a risk loop whose reward is a number — the diegetic-faucet violation the doctrine exists to prevent.
3. The town's wants give the beach and the park a pull *immediately*, with no new economy.
4. **Budget.** Measured today: `1,172,019 / 1,500,000 built JS = 78%`, so **327,981 bytes free**. The park's *entire* area — chassis, garden, shops, NPC, critters, birds, weather, fountain, share, geo — is 126,025. Two park-scale areas is 252 K and leaves ~76 K forever. So: **town at 95,000, the Cut at 110,000**, leaving ~123 K. One of them ships smaller than the park, deliberately, and it should be the town, which has no garden, no weather, no shop UI and no builder.

**Prerequisite, before either:** extract the NPC dialogue card into `src/lib/world-npc.js` on the `world-hud.js` / `world-travel.js` precedent — one injected `<style>`, one JS owner. There are already **three forks**: `park.astro:1019-1061` + `:1789-1801`, `beach.astro:853-872`, and `world-quest.js:556` (whose own comment admits it is copying "the park's NPC-card grammar"). Both new areas would be forks four and five. It is also a **down payment**: it pays bytes back into `park.astro` (measured 126,025 / 135,000, **93%**) and `beach.astro` before either new area spends any. Do it as its own commit, and player-walk all three areas on the built site before moving on.

Same argument, smaller, for the scrim: pull `.pk-wx__scrim` / `.pk-wx__flash` out of `park.astro`'s inline CSS into `src/lib/world-dark.js` so the Cut is the second consumer, not copy two.

### Smallest slice of each that is worth shipping alone

**Town v1a — "the square that knows your name."** The square, three residents on the extracted card, `town-facts.js`, the name ladder, and sweeping leaves. No wants, no windows, no market day. It is a complete, warm, 90-second experience that works with zero other changes anywhere in the world, and it tells you within two weeks whether NPC memory is the retention lever the audit says it is.

**Cut v1a — "the quiet quarry."** The rim, the ramp, the free overnight spoil, ore banking at GRIT's stall, and **one cast finish (bronze)**. No heat, no ghosts, no risk at all. It proves the ore → cast → rave pipe — the part that carries the value — before you spend a line on the part that carries the danger. **Then ship heat and ghosts as v1b**, informed by data you should pull first (below).

---

## 7. What we are NOT doing

- **No descent, no floors, no elevator, no depth counter.** There is no cave art. The haunted house's `Basement_Door_Open_1/2` frames are the most tempting thing in the inventory and they are a trap — opening that door requires a pack purchase. Keep it shut in v1 and say so in the code comment, or somebody will open it.
- **No real-time combat, no HP, no weapons, no health bar.** No hit detection exists anywhere in the codebase, there is one animated hostile and zero weapon sprites, and a 500 ms one-thumb input model cannot support it. Stardew's combat is mostly a *time tax* anyway; we ship the tax.
- **No chase.** The ghost converges on the rock, not the player. A chaser is either harmless or unfair with nothing in between.
- **No human NPCs**, despite 2,608 pre-animated sprites being the single biggest unused asset we own. They would be the first non-banana inhabitants of Banana World and would make the bananas the odd ones out in their own world.
- **No shop in Banana Town.** No prices, no tile grid, no buy button, no interiors. Every door shut. This rule is permanent and the only defence is writing it where the next person building here will read it.
- **No price economy, no consignment table, no player-to-player trade.** A self-correcting market is a permanent tuning job for a person who has already retuned the coin supply twice, and a consignment table at this concurrency would sit empty — whose own proposed fix was seeding it with fake listings.
- **No player-typed text anywhere.** `family-filter.js` catches words, not intent, and a moderation queue cannot be switched off.
- **No fourth world-wide currency.** Ore is area-local. The town mints nothing.
- **No ore → coin conversion.** That turns the pit into a coin faucet and inflates the Banana Stand's balanced 13 prices.
- **No friendship hearts, gift preferences, or heart-gated cutscenes.** Ten gifts across ten levels against a 111-second median session pays off for approximately nobody, and decay-on-neglect is a direct doctrine violation.
- **No cooldowns or energy.** The world has never once locked a door and told someone to come back later. Caps are invisible; cooldowns are a closed door with a timer.
- **No wagering, and no destruction of anything a player bought.** The Old Lot's named lantern posts being knocked down by a blackout would be the first confiscation of a purchased good in this world's history, and it would punish you for other people's absence.
- **No collective nightly failure state.** The park's crowd chip regularly reads 1. Any mechanic whose bad outcome makes the area *worse for a cold first-time arrival* is exactly backwards.

---

## 8. Open decisions for Trym

**1. Tone: does a haunted register belong in Banana World?**
*Either* the Cut is a boarded-up old house with ghosts, dead trees, crows, lanterns and dirt — *or* there is no threat area without buying a cave/dungeon pack. There is no third path; pack fidelity forbids drawing our way out.
**Recommendation: yes, dialled down.** Every cross, grave, coffin, chapel, blood decal and pentagram is cut — both source sets are large enough to build from the clean subset. Never call it a graveyard; it is a pit behind a house that got left. But this is a register shift in a world whose other four areas are a rave, a park, a beach and a farmyard, and it is your call alone.

**2. Pull the laser data before building the ghosts.**
`rave_zap` and `rave_dodge` have been firing with `loss` and `kind` params since 23 Aug (`banana-rave.js:1834, 1956`), and `park_stormnote` has three weeks of data. *Either* the numbers say players engage with the world's one shipped hazard — build the heat and the ghosts — *or* ~6% ever record a dodge, in which case **Cut v1a is the whole area** and the threat premise was depth nobody reaches.
**Recommendation: pull it before v1b. It is the cheapest possible way to avoid building the wrong thing.**

**3. Is /town/ the hub?**
*Either* the town square **is** the walkable plaza (`banana-world-hub-plan.md` folds into this, /banana-world/ redirects to /town/) *or* they are two structures and you build the same thing twice.
**Recommendation: /town/ is the hub.** The signpost is the area registry made physical. Decide before `town.astro` exists, not after.

**4. Which castable list, and does casting hold the line against member gear?**
*Either* a curated ~8-item castable list with a dev-time luminance-spread check *or* everything in the closet, and half the casts look like a grey hat because near-monochrome art has no spread to remap.
**Recommendation: curated 8, and the top hat is excluded** — a gold-cast top hat is indistinguishable from `tophatgold`, the $15 supporter tier. Casting must never fake member gear.

**5. Which area ships smaller?**
Measured: 327,981 bytes free; the park's whole area is 126,025.
**Recommendation: town at 95,000, Cut at 110,000.** The town has no garden, no weather, no shop UI and no builder, so it is the one that can shrink. Both raises belong in their PR descriptions, per the budgets file's own `_doc`.

**6. Does the NPC-card extraction happen first, on its own commit?**
*Either* pay the debt now — one commit, one player-walk of park + beach + questline — *or* ship forks four and five and the pattern is unfixable.
**Recommendation: extract first.** Three surfaces already carry it, it pays bytes back into `park.astro` at 93%, and both of these areas independently need it.

**7. Does the town's errand system stay in-town in v1?**
*Either* the wants are all satisfied by showing something you already carry (in-town, testable alone) *or* they are parcels delivered to NPCs in four other live areas — which makes v1 a cross-area feature with four regression surfaces and a permanent per-area writing treadmill.
**Recommendation: in-town wants for v1.** One errand destination (Old Peel, who already has a topic deck) lands later as one row plus one line, not a new system.