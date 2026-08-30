# The Homestead — why it is dead, and the fix

Design spec, 30 Aug 2026. Produced by a 14-agent audit and then verified
line by line by hand — every claim below was re-checked against the source
before it was written down. Trym's instruction: give the Homestead and
Cooking real love BEFORE building the farm.

# Homestead — the fix

**One correction to the brief before anything else:** homestead/park/beach verbs do **not** latch once per session. `track()` at `src/scripts/banana-homestead.js:25` is a bare `gtag` passthrough with no guard, byte-identical to `src/scripts/park-util.js:4` and `banana-beach.js:51`. Only the three arrival events fire once per page load (`homestead_open` at `:1393`). So `homestead_fence` = 262 events / 3 users is 87 real placements each, and every ratio below is **users(event) ÷ users(homestead_open)**, not sessions-per-user.

---

## 1. What is actually wrong

Ranked. The first four are outright bugs — code that cannot execute, or that destroys its own reward. They come first because fixing them is a bug pass, not a redesign.

**B1 — The phone is hard-locked for every new player by a gate whose trigger does not exist.**
`banana-homestead.js:1226` refuses to open the shop unless `state.claimedAt`, toasting "walk in through the gate first". Nothing sets `claimedAt` on a gate crossing: `GATE` is imported at `:19` and referenced nowhere else in 3191 lines; `homestead-geo.js:5` defines it and nothing consumes it. `offerClaim()` (`:1709`) has exactly **one** call site — `:2337`, inside `confirmHome()` *after* the 50-coin tent is bought. → phone permanently disabled. `homestead_phone` = 29 of 644 users (4.5%).

**B2 — The kitchen's designed entrance is dead code.**
`:2695` gates it on `if (I.kitchen && …)`. `grep -c kitchen src/scripts/homestead-geo.js` returns **0** — verified: INTERIORS tiers "1"/"2"/"3" carry only `img/box/spawn/exit/cols`. Same dead guard repeated at `:779`. Only live door to `openCook()` is the stove chip at `:2712-2716`: tent 50 + cabin 300 + stove 42 (`src/data/decor.js:37`, `stage: 2`) + a 45-minute van (`:1759`) + indoor placement. `homestead_cook` = **0 users, ever**.

**B3 — The only free faucet burns its flag at spawn, before a single coin is collected.**
`:1411-1412` — `if (localStorage.getItem('hs-roadcoins-v1')) return; localStorage.setItem(…,'1');` runs *before* the coins are placed (`:1429`). One reload, one back-nav, one bounce-and-return and the area's entire free reward is gone forever. Verified in source.

**B4 — The cook panel overflows a phone and cannot be scrolled.**
`homestead.astro:606` `.hs-cooklist { display: grid; gap: 0.5rem; }` — no `max-height`, no `overflow`. Same for `.hs-pantry` at `:600`. Every sibling list has a scroller: `.hs-seedlist:181`, `.hs-list:399`, `.hs-guestlist:577`. `body.hs-lock { overflow: hidden }` (`:326`) kills page scroll too. Measured: **834px card in a 667px viewport, 183px clipped, scrollableBy 0** — two dishes unreachable at 375×667, three at 360×640. Clears Trym's 393×852 by 2px, which is why it was never seen. Biggest contributor: `renderCook()` at `:1521-1526` emits **14 unconditional `× 0` chips** (138px of noise), including radish, which no dish consumes.

Then the design failures:

**D1 — Nothing interactive is on screen at spawn.** Direct arrival (89.6% of traffic, no `?park`/`?world`) spawns at `x:104`, walks to `x:300` (`:1391-1392`). Fire? none. Tent at `TENT.x = 1000`, sign 1010, mailbox 1252, plot 816-1344 (`homestead-geo.js:12-17`). Camera clamps to `YARD_FIT = 520` world px (`:327-334`) → visible span x 0-520. The nearest object is ~400 world px past the right edge. `OVERLAYS = []` (geo `:19`) vs the park's 23. No birds (`landSpot()` returns null with `items: []`, `:1030-1047` — `homestead_bird` has **never fired**). No hens (coop is 45c, stage 2).

**D2 — Ownership, the entire fantasy, is behind a 50-coin paywall the area cannot fund.** `TENT_PRICE = 50` (`:104`); the shop's stage-0 branch renders one disabled card, `need 50 — you have 0` (`:1879-1880`), and says out loud "bananacoins come from playing — the rave, park and bay all pay" (`:1874`). The homestead has no coin window at all (`grep COIN_PERIOD` → hits `banana-beach.js:1073`, `banana-park.js:873`, nothing here). Result: **10 of 644 claimed (1.55%)**; paid 1.0%, organic 9.5-10%.

**D3 — The homestead cannot make its own raw material, and no dish is craftable at level 1.** `seedGain()` has one caller in the repo: `park-garden.js:1696`, the park harvest. `park_harvest` = 3 users / 90d. The seed panel refuses to open empty (`:2566`). And every one of the 7 dishes needs a 3★+ seed while a fresh gardener caps at 2★ (`pass-defs.js:98-99`, enforced `park-garden.js:1524`) — level 1 can buy only radish 1★, daisy 1★, sunflower/carrot/strawberry 2★ (verified `park-garden.js:54-67`). **Zero dishes reachable.** One user opened the kitchen six times and cooked zero — they were looking at seven permanently disabled buttons.

**D4 — The dish economy is 20-100× underwater.** Golden loaf = wheat×3 = 900 coins of seed (`park-garden.js:52`, wheat 300) + 3×6-day park grows + 3×3-day home grows → pays 25. Smoothie = grape 400 + pineapple 500 + prickly 650 = 1550 coins → pays 65. World tuning is 5-15 coins per *active day* (`src/lib/world.js:22-24`). And the buff is invisible: it multiplies silently inside `passStat` (`banana-pass.js:408-411`), lives in unsynced `hs-buff-v1`, has no HUD chip.

**D5 — The measured desire is NESTING, not farming.** Per-user volumes: fence 262/3 = **87 each**, dig 155/3 = 52, buy 58/3 = 19, place 58/3 = 19, move 62/3 = 21 — the highest per-capita engagement on the site. Against plant 15/1 and cook 0/0. Three people placed 262 fence pieces. The code spends its whole gating budget on a 10-day crop chain that loses money.

---

## 2. The fix

**Spine: "the fire is already lit."** A campfire burning on the lawn at second zero, free wild produce you pick up by walking, and a claim that is free and lands *after* you've done something. The farm becomes the second week's upgrade, not the first minute's wall.

**Two grafts, stated plainly:**

- **From ONE POT:** the fire is a **granted decor item**, not a scene fixture. `homestead-geo.js:1` is literally `// GENERATED by tools/build-homestead-scene.py — DO NOT EDIT` — adding a `FIRE` constant there means editing the Python generator or losing it on the next rebuild (exactly how the baked kitchen zones were lost, `build-homestead-scene.py:1013`). Pushing `{ id:'campfire', lit:1 }` into `state.items` at claim uses the **existing** lit-campfire render (`banana-homestead.js:738-742`, verified: swaps to `campfire-lit.gif`, doubles height, adds a warm drop-shadow) and the **existing** chip (`:2497-2508`). Zero new render paths, zero generator risk. Also from ONE POT: cut CROPS/DISHES to a legible size and un-gate the shop.
- **From THE ROAD:** the claim copy's honesty ("the sign says who lives down this road"), the `/doors` neighbour card (`worker-rave/src/index.js:2694` — already shipped, zero clients) as the **return trigger**, and paying rep+coins for watering a neighbour's beds. All of it is step 6, deliberately last: it needs claims to be cheap before it has anything to list.

**Rejected from ONE POT:** deleting the bed system. It destroys the one power user's 15 plants / 36 waters, and once forage exists the beds cost nothing to keep — they become the *second* session's depth instead of the first session's wall.

### First session — new visitor, Facebook click, 375×667, 0 coins

**0:00 — the frame.** Direct arrival spawns on the road in front of the yard at `{ x: state.home.x - 40, y: ROAD.y }` ≈ x 960 instead of x 104 (`:1391-1392`). At 375 wide the 520-world-px window covers x ≈ 700-1220: the ghost tent (930-1070), the sign (1010), the mailbox (1252 just off), and the road trail. The `?park`/`?world` east door keeps its spawn but its `tgt` moves from `W-260` to x 1300 so it walks *into* the plot.

**0:02 — motion before input.** The auto-walk carries the banana over the first welcome coin, now strung at x 900/960/1020 instead of 400-800. `+2` floats. Paid before touching the screen. The `hs-roadcoins` flag now writes when the **last** coin is collected (B3).

**0:08 — the claim, free, earned.** The first coin collected fires `offerClaim()` (`:1709`) — with a 20s fallback timer for a player who doesn't move. "This clearing is yours." Name it → the sign plank paints (`refreshSign()`, `:553`), `homestead_claim` fires, the slug mints (`:1733`), the presence room opens (`:3011`) so the `crowd` chip (`:1202`) stops being a counter guaranteed to read empty, and `yardBoot()` (`:1655`, returns immediately without `claimedAt`) becomes reachable. **No coins involved.** `offerClaim`'s call inside `confirmHome` (`:2337`) stays as a fallback.

**0:10 — the fire.** The claim handler pushes one free `{ id:'campfire', lit:1, x, y }` near `state.home`. It draws through `:738-742` — animated gif, warm glow, already shipped art (`public/assets/homestead/campfire-lit.gif`, verified present). The hint line is restructured, not lengthened: `tap to walk · arrow keys / WASD work too` → **`tap to walk · tap the fire to cook`** (44 → 33 chars).

**0:15 — the first free verb.** Four ripe crops are already lying on the grass (pre-spawned before the player moved — the beach's `for (let n=0;n<5;n++) spawnShell()`, `banana-beach.js:997`). Walking within 34px picks one up — no tap, no tool, no cost. This reuses `roadCoinTick()` (`:1440-1456`) generalised: same proximity test, same remove/splice/float/toast/track shape. Art is `/assets/park/c-<id>-4.png`, the exact sprites this file already paints at `:893` (verified `c-radish-4.png`, `c-carrot-4.png`, `c-strawberry-4.png` all present). First-pickup toast: **"wild radish — the fire cooks what you find"**.

**0:30 — three ingredients.** Up to 4 on the lawn at once, one more every ~45s while you're standing there, capped at 6 picked per `dayStr()` — the cap lives in `state` (hs-v1), not a localStorage flag. Spawn points come from `landSpot()` (`:1030-1039`), lifted out of the bird IIFE so birds and produce share one picker — which means **buying decor visibly raises tomorrow's yield**.

**0:45 — cook.** Tap the fire. The campfire chip (`:2497-2508`) now carries a `cook` button alongside light/put-out; tapping the fire from further away walks you there first (the mailbox/sign pattern, `:2860-2888`). The cook card opens with **three** pantry tiles (real sprites, not `CROP_EMO`) and **three** forage dishes. Garden salad — carrot×2 + radish×1 — has an **enabled** button. Card height ~340px. Tap → **+12 bananacoins**, `homestead_cook` fires for the first user in the site's history, 45 seconds in.

**1:00 — the shop opens on things you can afford.** The phone button works (B1 deleted). `renderShop()`'s stage-0 single-offer branch (`:1866-1886`) is deleted, so the catalog is the catalog. Verified affordable at stage 0 today: bush 6, round bush 6, stump seat 6 (`sit:'s'`), mushroom patch 7, sunflower 8, red/blue/white flower 8, flower bush 9, pink vase 12 (`src/data/decor.js:5-15`). Buy the stump, place it — `SHIP_MIN` for garden is already 0 (`:1758`), no van.

**1:15 — a bird lands on it.** `landSpot()` returns null on an empty yard, which is why `homestead_bird` has never fired once. The first prop you own switches the ambient life on. That is the payoff for nesting, and it is already written.

**1:30 — the ask, honest.** The tent card now reads against a real balance: 50 coins, "you have 22". Two more forage days, or one rave visit. The exit strip east reads "keep walking → back to the park". The player leaves with a named plot, a fire, coins, a pantry, a bought prop, and a lawn that restocks tomorrow.

---

## 3. Cooking specifically

**What a dish costs — one rule: free ingredients pay coins, bought park seeds pay buffs.**
Same 7 rows, same `{ need, pay|fx, mins, blurb }` shape at `:88-104`. Only values change.

| tier | dish | needs | pays |
|---|---|---|---|
| forage (day one) | Garden salad | carrot×2, radish×1 | 12 coins |
| forage | Berry crumble | strawberry×2, carrot×1 | 10 coins |
| forage | Wildflower bouquet | daisy×1, sunflower×1 | 14 coins |
| farm | Campfire stew | tomato×2 | double coins, 45 min |
| farm | Pumpkin pie | pumpkin×2 | double XP, 45 min |
| farm | Golden loaf | wheat×2, corn×1 | double coins, 90 min |
| farm | Tropical smoothie | grape, pineapple, watermelon | double XP, 180 min |

Nobody is ever asked to spend a 300-coin wheat seed to bake a 25-coin loaf again. Coins only ever come from ingredients that cost nothing; the expensive seeds buy the one thing coins cannot — a world-wide multiplier. **Radish, which today is in `CROPS:68` and `CROP_EMO:82` and consumed by no dish at all, becomes the first ingredient anyone ever cooks.** Every forage crop is ≤2★, so it is inside a fresh gardener's ceiling by construction (`pass-defs.js:98-99`).

**Where ingredients come from.** Two pipes, deliberately separate:
- **Forage** — free, local, daily, **produce only, never seeds**. `seedGain()` stays untouched with exactly one caller (`park-garden.js:1696`), so the park's seed economy is not cannibalised, and the seed sheet keeps its ONE PLACE sentence (`:2563-2567`) — the forage toast must not repeat it.
- **The beds** — kept, unchanged. They are how you get the 3★+ crops the buff dishes need. The park stays the garden; the homestead's beds stay the pantry's second gear.

**How a player hears the word "cook" before standing in a kitchen.** Today the word is spoken **nowhere in the world outside the modal** — a grep of `src/` and `worker-*/src/` for cook|kitchen|dish|pantry|recipe returns only code comments and the private analytics dictionary. Five places, in the order a new player meets them, none of them adding a sentence:

1. **The hint line, second zero** — `tap to walk · tap the fire to cook` (`homestead.astro:627`). Shorter than what it replaces.
2. **The fire itself, on screen at second zero** — an animated, glowing object with a `cook` button on its chip (`:2497-2508`). The verb is on the object.
3. **The first pickup toast** — "wild radish — the fire cooks what you find" (~15s).
4. **The harvest toast, ungated** — `:2615` currently reads "into the pantry — a real roof comes with a stove 🍳" *and is gated to `stage < 2`*, so it is silent for exactly the players who could act on it. Becomes "into the pantry — the fire is waiting", no stage gate.
5. **The world tour** — `world-tutorial.js:306-308` says "your home. pitch the tent, put your name on the sign, build it up." One word swap: "…put your name on the sign, cook on the fire." No length added.

---

## 4. Ship order

**Step 1 — the bug pass. SHIP TODAY.** ~1 hour, no design risk, worth shipping alone.
- Delete the phone's `claimedAt` gate and its impossible toast (`:1224-1228`), and the unused `GATE` import (`:19`). → the shop opens for 634 users who cannot reach it.
- Delete both dead `I.kitchen` branches (`:779`, `:2695-2699`).
- Move the `hs-roadcoins-v1` write from spawn to last-coin-collected (`:1411-1412`).
- `.hs-cooklist` (`homestead.astro:606`) and `.hs-pantry` (`:600`) get `max-height: min(46vh, 380px); overflow-y: auto`, copied from `.hs-seedlist:181`.
- `renderCook()` (`:1521-1526`) renders **only non-zero** pantry chips. Kills 138px of `× 0`.
- Move the action-bar `title=` explanations (`homestead.astro:650-651`) into visible/aria labels.

**Step 2 — spawn in the clearing, claim is free.** `pos`/`tgt` at `:1390-1392`; road coins to x 900/960/1020; `offerClaim()` fires on first coin with a 20s fallback; `confirmHome`'s call stays as fallback. Ships alone: `homestead_claim` should move on this step by itself.

**Step 3 — the fire.** Grant `{id:'campfire',lit:1}` in the claim handler (`:1728-1733`) + a one-time migration for the 10 existing claimants; add `cook` to the campfire chip; near-or-walk tap on the fire; hint line + tour word swap. Now `homestead_cook` is *possible*. Ships alone.

**Step 4 — wild produce + the retuned dish table + un-gate the shop.** The forage tick beside `:1404-1456`; `landSpot()` lifted out of the bird IIFE; `DISHES` retune (`:88-104`); delete `renderShop()`'s stage-0 branch (`:1866-1886`) and `openShop`'s tab rewrite (`:2098`); crop sprites replace `CROP_EMO` in pantry tiles, the `needTxt` line (`:1539`) and the seed rows (`:2578`). New event `homestead_forage`. This is the step that makes the loop close. Ships alone.

**Step 5 — give the buff a face.** A `buff` chip type in `src/lib/world-hud.js:93-154` reading `buffGet()` (`banana-pass.js:383-392`), mounted wherever the HUD mounts. ⚠️ `park.astro` is at 125,534 / 135,000 B (93%) — the chip must measure **≤2KB built** under `tools/check-budgets.mjs`, or it rides the existing `setSlot` escape hatch with no new CSS. Never a drive-by budget raise (`tools/budgets.json:3`). **If it will not fit in 2KB, delete the buff instead** — an invisible world-wide multiplier is not a reward, and the forage dishes pay coins.

**Step 6 — THE ROAD (the return trigger).** `openRoad()` renders the already-shipped `GET /doors` (`worker-rave/src/index.js:2694`, zero clients today) into the existing `.hs-guestlist` (`homestead.astro:577` — already has a scroller). Neighbour watering pays rep+coins through `passStat` with a per-device daily cap. Gate this on step 2-4 landing: it needs claims to be cheap before the list has anything on it, and it must be honest when the road is short ("you'd be the third house on this road") — never fabricate neighbours.

---

## 5. What we are NOT doing

- **Not adding FIRE/FORAGE_SPOTS to `homestead-geo.js`.** It is generated (`homestead-geo.js:1`); a hand edit is silently reverted on the next scene rebuild, taking the kitchen door with it. The fire is a granted item.
- **Not deleting the bed system.** It destroys the one real farmer's state (15 plants / 36 waters / 6 harvests), and once forage exists the beds are free depth, not a wall. They stay as the source of 3★+ buff ingredients.
- **Not touching the park.** `park.astro` has 9,466 B of headroom (93%) and the seed pipe (`park-garden.js:1696`) is load-bearing. No starter seed pouch, no seed reprice, no park garden changes. Forage drops **produce, never seeds**, and only the ≤2★ set, so the park's grow loop keeps its monopoly on everything expensive.
- **Not building a kitchen room, a stove requirement, or new interior geometry.** The fire is the kitchen; the stove stays as the indoor upgrade.
- **Not building the gift/mailbox-delivery system yet.** It is an inbound surface on someone else's private space and needs its own per-visitor caps and abuse review. Revisit after step 6 measures.
- **Not adding NPCs to the homestead.** Nib is already here from the questline (`world-quest.js:151-153`, at world 432,913). One more talking head is surface without value until the loop closes.
- **Not touching ads, landing pages or traffic.** The same Paid Social channel holds 198.1s in the park and 231.7s at the beach. The page is what differs.
- **Not commissioning art.** Every sprite this plan uses ships today: `campfire-lit.gif`, `d-campfire.png`, `/assets/park/c-*-4.png` (all 14).
- **Not raising a JS budget.** Homestead has 16,883 B headroom (113,117 / 130,000). The estimated add is ~3.5KB and most of step 1 and 4 is deletion.

---

## 6. How we will know it worked

Ratios are **users(event) ÷ users(homestead_open)** — verified above that nothing latches. Read against organic and a *fresh* ad flight, never against the 13-16 Aug burst (599 of 644 lifetime users landed in four days).

| event | instrument | today | must beat |
|---|---|---|---|
| `homestead_claim` | exists, `:1733` | 1.55% (10/644) | **≥ 35%** |
| `homestead_forage` **(new)** `{crop}` | forage tick | — | **≥ 45%** of arrivals |
| `homestead_phone` | exists, `:2103` | 4.5% (29/644) | **≥ 25%** |
| `homestead_kitchen` | exists, `:1566` | 0.16% (1/644) | **≥ 18%** |
| `homestead_cook` | exists, `:1558` | **0 users ever** | **> 0 within 24h of step 4; ≥ 10%** |
| `homestead_buy` | exists | 0.47% (3/644) | **≥ 8%** |
| `homestead_bird` | exists, `:1011` | **0 events ever** | **> 0** (proves decor is being placed) |
| `homestead_fire_light` **(new)** | campfire chip | — | directional only |
| `homestead_road` / `_road_go` **(new)** | step 6 only | — | set after step 4 lands |

Page metrics, `/homestead/` as landing, Paid Social:
- avg engagement **8.7s → ≥ 40s**
- pages/session **1.24 → ≥ 2.0**
- bounce **52.2% → ≤ 40%**
- `homestead_exit` **5.7% → ≥ 20%** (the world should keep them)

**Guard rails — if these move the wrong way, forage is cannibalising the park:**
- `park_seedshop` and `park_plant` per-arrival must not fall vs the fortnight before ship (today 30.6% / 16.2% of `park_join` users).
- Coin faucet: 6 forage picks ≈ 2 dishes ≈ 22-26 coins/day against a world tuned at 5-15/active day (`world.js:22-24`). Deliberate — the homestead is the only walkable area with no coin window and a 50-coin gate — but if it reads hot, **cut the daily forage cap to 4** (one constant) before touching dish pay (seven values).

**Before presenting any of this:** player-walk the built site at **375×667 and 360×640** with raw touchscreen taps, not `locator.click` — spawn frame, first walk-over, the claim card, the cook card at full pantry, the shop, placement, and where the action bar actually lands under a `max(240px, min(74vh, 580px))` stage (`homestead.astro:38-39`). This page is listed UNAUDITED for the below-fold trap and its cook card just proved it. Then `tools/check-budgets.mjs` and `tools/check-design.mjs`.