# The Barnyard — farm & animals expansion

Design spec, 30 Aug 2026. Written after measuring whether the park is really the
world's glue (it is, with a correction) and after auditing what the Modern Farm
pack can actually draw (a lot, with three gaps).

---

## 1. What the data says

Trym's hypothesis: *the park is the best glue in Banana World.* GA4, 90 days.

**Right about the mechanic. Half right about the area.**

### The park is a return destination

| signal | park | best other | rave |
|---|---|---|---|
| returning sessions vs new landings | 40 ret / 36 new | beach 33 / 11 | 180 / 7075 |
| sessions per user, deepest loop verb | seedshop 9.6 · weed 9.1 · water 5.6 | — | levelup 3.7 |
| destination after the rave | #2 (247 views) | builder 333 | — |

Only the park and the beach are places people *land on* about as often as they
discover. Everything else is a one-way trip.

### But the park does not hold a single visit best

Organic sessions, seconds held: **forge 231s · rave 206s · beach 193s · park
111s · builder 97s · homestead 49s.** The park is mid-pack for one visit. Its
advantage is entirely *across days* — which is exactly what glue means, but it
means the park is not the thing to copy wholesale.

### The finding that actually matters

The park's funnel converts beautifully until the moment it asks you to wait.

```
park_join   133 users
  -> seedshop  35   (26%)
  -> plant     22   (63%)
  -> water     21   (95%)   <- almost everyone who plants comes back to water
  -> harvest    3   (14%)   <- three people in ninety days
```

95% of planters return to water. **14% ever see a harvest.** Park crops take
3–9 days; the median park session is 111 seconds. The loop cannot close.

The homestead is the same failure, terminal: **644 people opened it in 28 days.
One watered. One harvested. Zero cooked.** The whole produce → kitchen → buff
spine has been reached by one person, because its seeds come from a park
harvest three people have ever completed.

### What the glue actually is

The park's *highest* return verbs are not your own crop. They are
**`park_weed` (9.1 sessions/user)** and **`park_trash` (6.8)** — chores the
world generated while you were away. People come back because something
happened without them.

> **The glue is not the park. It is overnight state change plus a chore.
> The park is the only place currently running one, at a cadence too slow to
> close.**

That is the farm's brief.

---

## 2. What the pack can draw

`~/OneDrive/banana-art-pack/Modern_Farm_v1.2` — 48×48, same scale as the park.

**Animals (9 species, 73 sheets):** chickens & roosters (15, incl. chick and a
*golden* variant), sheep (13), dogs (10), rabbits (9), cows (7, incl. calves),
pigs (7), donkeys (6), ducks (6), goats (6). Multi-row sheets — the cow is
72×12 cells, so idle/walk/eat/sleep in four directions is there.

**Products:** egg, milk bucket, cheese, wool in **four colours**, grain bag,
coffee, baguette, croissant. Tools: watering can, bucket, **shears**, axe,
shovel, rod.

**Buildings & props (283):** chicken coop + railings, henhouse, small barn,
silos, stable, doghouse, **market stand in 5 colours + register + scale +
signs**, scarecrow, **well (usable, with empty/full bucket)**, **drinking
troughs in empty/full pairs**, tractor, sprinkler.

**Animated:** barn/coop/silo doors, **cheese machine**, sprinkler, **banana
fruit tree in unripe/ripe/fruitless with a shake**, falling leaves, and a
**rare-crop glitter** VFX.

**Crops:** 19 growth ladders, every one with a **rare variant**.

Three gaps, all decided rather than worked around:
- **No honey or beehive.** Cut bees.
- **Meat sprites exist. We are not using them.** Cozy game, no butchering.
- **No egg-in-nest prop.** The egg is a pickup drawn on the coop floor.

Two things worth noticing: the trough's **empty/full pair is the feed mechanic,
already drawn**, and the **market stand with register and scale is the selling
mechanic, already drawn**. The farm's two core verbs cost no new art.

---

## 3. The design

### The one rule

> **The park is growth. The farm is care.**
> A park plant pays in 3–9 days. A farm animal pays **tomorrow**.

That is the farm's entire mechanical identity, and it is the direct answer to
the harvest cliff. It gives the world its first loop that closes overnight.

### It is shared, not personal

The homestead is private and dead: you arrive and it is exactly as you left it,
so nothing happened, so there is no reason to come. The park is public and
sticky, and its best verbs are cleaning up after other people.

So: **you adopt an animal, and it lives in a public barnyard.** It is yours —
you name it, it carries your tag — but everyone sees it, and **anyone can do its
chores.** That reuses the neighbour-watering behaviour the park already proves,
and it means a new player walks into a barnyard that is already *full*, instead
of one they have to fill themselves before it looks like anything.

### The loop

```
rave floor drops coins  ->  adopt a chick at the coop  ->  it is hungry
   ->  fill the trough (free, from the well)  ->  leave
   ->  NEXT DAY: an egg on the coop floor  ->  pick it up
   ->  sell it at the market stand, or carry it to the kitchen
```

First reward inside 24 hours, from a first session that costs one thing you
already have. No park harvest anywhere in the chain — that gate is what killed
the homestead, and the farm must not inherit it.

### Where each product goes

Every animal product leaves the farm for a *different* area. This is what makes
the farm connective tissue rather than another cul-de-sac.

| product | from | goes to | why |
|---|---|---|---|
| **egg** | chicken, daily | **market stand** → bananacoins | the reliable faucet; funds seeds and adoptions |
| **wool** | sheep, ~3 days, shears | **the forge** | 4 colours = a crafting material for knitted wearables; the forge holds attention longest (231s) and already ships items into the world |
| **milk** | cow, daily | **the kitchen** | gives the homestead's dead dish spine an ingredient that does **not** come from a park harvest — this is how the kitchen gets resurrected |
| **cheese** | milk + cheese machine | kitchen, high value | the deep item, for players who stayed |

### Chores are the glue, so chores must be generated

Overnight, without the player: troughs empty, the coop needs raking, a sheep
wanders through a fence, a rare-glitter crop shows up in the field. These are
the `park_weed` equivalent — the reason to open the tab. **Anyone may do any of
them, on anyone's animal.**

Missing days must not punish. Generous-faucet doctrine: an unfed animal stops
producing and looks sad. It never dies, and one feed restores it.

### Two mechanics unique to the farm

1. **The rooster call.** Your farm's chores landing on the World HUD from *any*
   area — the only cross-area "something is ready" signal in the world. This is
   the highest-leverage item on the page: it turns the farm from a place you
   have to remember into a place that reminds you.
2. **The dog.** Adopt one and it follows your banana between areas — drawn
   walking in four directions in the pack. Purely cosmetic, no economy, and
   probably the most-wanted thing here.

---

## 4. Ship order

The park has 13 seeds, five health phases, weather, weeds, eggs, compost, beds,
an NPC and postcards — and **three people have harvested.** The lesson is not
"build less". It is **prove the loop closes before widening it.**

**Phase 1 — chickens only.** Coop, trough, market stand, one species, the egg,
adopt/feed/collect/sell. Nothing else. Ship it, then read `farm_egg` sessions
per user. If it does not beat `park_water`'s 5.6, the loop is wrong and no
amount of cows will fix it.

**Phase 2 — sheep → wool → forge.** The first cross-area pipe.

**Phase 3 — cows → milk → cheese → kitchen.** Resurrects the homestead spine.

**Phase 4 — the dog, the rooster call, and ducks/goats/pigs/rabbits/donkeys as
cosmetic variety.**

### One small park fix that belongs in phase 1

The park's fastest crop is the 3-day carrot. The pack has **radish** growth
stages, seed bag, pickup and rare variant. **Add radish: 1 day, 1 star,
5 coins.** It gives the park a same-tomorrow close for the first time, and it is
the cheapest available lift on that 14% harvest number. Build the farm on a park
that can finish a crop.

---

## 5. Engineering constraints

- **Door:** the park's south/east/west are rave/beach/homestead. **North is
  free** — the farm goes north of the park, and the park is the only way in.
  Deliberate: it inherits the world's most-returning audience.
- **JS budget:** a new surface needs a line in `tools/budgets.json`. The park is
  at 135000 and near its ceiling; the farm gets its own chunk, sized at adoption
  +15% like the rest. Rooms-as-data, per `banana-world-engineering`.
- **Ownership:** adoption is an ownership surface, so it must consult the SID
  ledger (`park-2-engineering`, identity doctrine) — `worldOwner()`, not
  `worldSid()`, or animals vanish across devices.
- **Chips:** any farm HUD chip is area-local (economy-hud-plan), ≤2KB, and the
  ladder table lives in `pass-defs.js`.
- **Art:** pack-fidelity doctrine — Modern Farm sprites only, no self-drawn
  props, minimal colour processing. Scene built the way `build-park-scene.py`
  builds the park.
- **Instrumentation:** the park's verbs latch once per session, which is the
  only reason this analysis was possible. **Do the same** — `farm_adopt`,
  `farm_feed`, `farm_egg`, `farm_sell`, `farm_chore` — or the next question will
  be unanswerable too.

## 6. Name

`/farm/` for the URL either way. For the place: **the Barnyard** (plain, sits
beside "the park"), *Peel Pastures* (alliterative, collides with Old Peel), or
*the Bunch Barnyard* (collides with the hub name lean). Recommend **the
Barnyard**.
