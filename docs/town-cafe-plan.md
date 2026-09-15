# The Coffee Cup as a workplace — the plan (15 Sep 2026)

Trym's ask, 15 Sep: *"a gated mechanic where you can get a job in the coffee shop and make
coffee for townsfolk — but that comes after doing a quest that unlocks the coffee shop as a
workplace — maybe you buy it to start a business there for a gold price, so that part should be
planned — but until we are ready with the plans we can hang a big red FOR SALE sign on the
building."*

The sign hangs now (`forSale` in `src/data/copy/town-life.json`, drawn by `town-room.js`).
Nothing below is built. Three lenses first, then the list.

## 1. The player's lens — what it feels like

The first JOB in Banana World. You own the Coffee Cup and you work it in shifts:

- A shift is one town beat long (two real minutes). You stand at the counter; residents and
  visitors come up one at a time with an order (three drinks, told by the cup they hold);
  you make it by tapping the three things in the right order (beans, milk, cup — the
  homestead kitchen's tap grammar, not a new UI); you serve; coins and rep land; a tip when
  you were quick. A wrong drink costs the ingredient, never more.
- Who comes is the town's own people, and they order in character (Nib wants it recorded,
  Spinner wants it fast, Gran Fig wants it the way it was) — the personas do the work, the
  copy job writes the order lines.
- Only when the café is OPEN: a low town keeps its shutter down (the Town Life rule), a
  Curse Night shuts it, and a shift never runs at night.
- The prize is money and standing, and the café itself: a plank with your name over the
  door while you own it, and the window lit when you are on shift.

## 2. The economy's lens

- The café is the town's first SINK for the pass's coins: a one-time price to buy it (Trym
  names the number; the plan assumes coins, not a new currency — a new currency is a whole
  system). Suggested order of magnitude: a week of good play, not a day.
- Earnings are a faucet with a cap, like every faucet (`RULES.town.job` on worker-pass,
  server-side): a shift pays at most a set sum, two shifts a day count. Tips are rep, not
  coins. So the café repays itself over weeks and never prints money.
- It only earns while the town is well: shut kiosk = no shift. That ties the job to the
  fixing loop instead of replacing it.

## 3. The multiplayer lens

- Ownership is PER PLAYER, like the homestead: everyone can own "their" Coffee Cup; the town
  shows one café and one plank (yours, when you look). Nobody blocks anybody, nobody is
  punished for absence, no griefing surface.
- The orders are seeded per player and day, so two players on a shift at once do not fight
  over the same customer.
- The sale and the ownership live on the pass (`cafe_owner`, a stat that travels), never on
  the device.

## 4. The gate — the quest that unlocks it

A short chapter with Bean (the barista), the questline's ONE RULE kept (local to the holder):

1. Bean's ask: the coffee propeller needs a new bolt (the "closed today" line already says
   so) — fetch it from Pip's counter.
2. Beans from the travelling stall, the next day it is in the square (a wait, not a grind).
3. A first round served with Bean at the counter (the shift loop, once, as the tutorial).
4. Bean offers the sale; the price is on the FOR SALE sign from that day. Buy → the sign
   comes down, the plank goes up.

## 5. What is what — the build list, in order

1. **The sign** — `forSale` words, drawn on the café. *Done 15 Sep.*
2. **Copy job `town-cafe`** — Bean's four beats of the chapter, the three drinks' names, the
   order lines per resident, the sale line, the shift's start/end lines. Brief + fields +
   `/dev/copy` like every job.
3. **worker-pass** — `RULES.town.job` (per shift max, per day max) and the `cafe_owner` stat.
4. **The shift card** — reuse the homestead kitchen card grammar (one card, taps in order,
   the same buttons); no new UI family.
5. **The ownership plank and the lit window** — `town-room.js`, a prop state like the shutters.
6. **Pulse** — `town_shift`, `town_cafe_buy` (labels, explainers, lenses, the stub walk).
7. **The walk** — buy, one shift, the cap, a shut café refuses.

## 6. Open questions for Trym

- The price, and whether "gold" means coins (recommended) or something new.
- Two shifts a day, or one?
- Should other players' bananas appear in the queue as customers once the town has its room?
