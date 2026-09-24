# Banana Town — the jobs, the restoration, and the post (19 Sep 2026)

Trym's ask, 19 Sep: *"we buy the coffee shop is the wrong wording here — we unlock it after
completing chapter 2 quest, the chapter 2 quest lands with the general shop, the arcade, the
post office, and the coffee shop being fully restored and functional. Step by step. Which means
they all need a closed down, under construction tape visually over them when you enter the town.
And that also follows the Town Health meter. The worse the health meter, the more buildings
closed — and workplaces. … what if you can work several places … The Post office — not sure what
we should do here … maybe it can be well gated and maybe we can monitor it closely … Social
layers are important today, and maybe the risk is better to take to give Banana World more
emotional depth, than to have the world too generic and 'mini-gamey'."*

How this was made: four researchers read the code and the packs, five designers took a lens each,
two judges merged them, two critics tore the merge apart (one against Trym's message sentence by
sentence, one an adversarial safety review of player mail). **Nothing here is built.** Decisions
marked **TRYM** are his. This supersedes the buying in `docs/town-cafe-plan.md` §1/§6; everything
else in that plan survives.

---

## 0. The three things to read first

1. **The fiction that makes it all one thing.** Banana Town is not poor, it is **condemned on
   paper**: a works order signed in 1999 by the same hand that wrote a name into Nib's big book
   and scratched it out (chapter 1's ending). Chapter 2 is not a shopping trip, it is **four
   signatures** — you get one building certified at a time, and the boards come down.
2. **The rule that stops the shared town and the private story fighting** (Trym, 19 Sep:
   *"the town meter is more like 'the healthier the town, the more services becomes available'
   … while for the solo player state, they need to unlock the different businesses"*):
   > ### ⭐ THE SHUTTER IS THE TOWN'S. THE KEY IS YOURS.
   > **Hazard tape, a dark front and the red sign** mean the town's health has not opened this
   > service **yet today** — shared, the same for everyone, reversible, always paired with a
   > problem you can fix. **A locked front with no name plank** means **you** have not unlocked
   > this business — personal, one-way, written only on your own pass, opened by the questline.
   > Two different looks, two different actions: *go fix the town* against *go play the story*.
   The chapter never writes a byte of shared state (the questline's ONE RULE holds), and the
   band keeps full authority over the tape forever.
3. **The tension, and how it was resolved.** Trym's warning — *not too generic and 'mini-gamey'*
   — was the thing this plan was most at risk of failing: a cup minigame, a restock chore and a
   floor chore, with the one part that is not a minigame pushed to the end. **19 Sep settled it:
   players write real letters to each other** (§6), and the world's own post ships first, before
   a single job. The chores are the town's texture; the post is the point.

---

## 1. The two locks — what a player sees

### The town's lock: the healthier the town, the more services open
This is not a new system — **it is how the town already works**, and Trym's framing is the
honest description of it. Pip's shelf grows with the band (`stock.js`: nothing at Abandoned,
the basics at Struggling, then common, then good, then the rare row at Thriving); the
travelling stall only comes from Lively up; lanterns and visitors arrive at Lively and
Thriving. **This plan extends the same ladder to the shopfronts themselves.** Keep the town
clean, lit and repaired, fend off the curses, and the services open; let it slide and they
close. Like the park.

- **The look:** the belt of hazard tape, the dark front and the little red CLOSED sign already
  built for the two kiosks on 15–18 Sep. `barricade()` sizes the belt off the prop's own width,
  so it already scales to a 183 px shopfront: **zero new art**.
- **The action it teaches:** tapping it opens a card that says the town is having a bad day, what
  is wrong right now, and that fixing things reopens it — with the health bar one tap away. Never
  a date, never a rate.

### Your lock: a business you have not unlocked yet
- **The look:** worksite hoarding composed from the pack's fence panels into one baked still per
  shopfront at its exact drawn width (the works yard already uses
  `ME_Singles_Worksite_48x48_Fence_*`), a signpost as the tap target, one dressing prop, and
  **no name plank over the door**. Deliberately nothing like the tape.
- **The action it teaches:** tapping the signpost opens the chapter card, which must say three
  things — *what this building will be*, *that the story opens it*, and **how far along you
  are** ("the second of four signatures"). Trym, 19 Sep: *"the buildings must show clear visual
  indications on what you are missing"*. A sign that only says no is a dead end; this one is a
  quest hook.

### ⭐ The precedence rule: one building, one state, always the one you can act on
A front can be both locked and health-shut at once. **Your lock always wins the display.** If
you have not unlocked the store, the town's mood there is irrelevant to you: you could not use
it either way, and the useful thing to tell you is *how to unlock it*. Once you unlock it, the
town's lock takes over and the front joins the shared weather like every other shop. So every
building shows exactly one state, and it is always the one whose action is available to you now.

**What the town's lock closes at which band** is one table in `src/data/town/condition.js`
(`LOOK[band].shut`):

| Band | Shut fronts |
|---|---|
| Abandoned | at most **three** |
| Struggling | at most **two** |
| Recovering | one (today's event only) |
| Lively / Thriving | none |

⚠️ **The arcade never closes** and the post office never band-shuts once restored. Five shipped
games must answer on a stranger's worst day, and the mail must never stop. This goes into
`tools/check-design.mjs` as a grep, not a paragraph: `condo` must never appear in `CLOSABLE` or
`HOARDABLE`.

⚠️ **The forbidden case stays forbidden:** a closed door with no way to open it, and it now
covers both locks — the taped one always carries a problem you can fix, the locked one always
carries a signpost that says which step of the story opens it. Every band-shut building is
guaranteed one of your fixable problems (the force loop's source changes from `todayShut` to
`cond.shut`), and `PROBLEM_COUNT.abandoned` goes 9 → 11 so shutters do not crowd the lamps off
the list.

⚠️ **The one feel-risk:** unlocking the store and then finding it taped the next morning reads as
a takeaway. The mitigations are that a health-shut front is always short, always explained and
always fixable in minutes, and that (**TRYM**) a job-holder may be allowed through their own
workplace's tape.

**How bleak Abandoned is, is Trym's thumb, not an argument.** Before any of this is argued,
bake five screenshots at 393 px, one per band, and let him overrule the table. (**TRYM**)

### ⚠️ Can one player raise the town alone? Not with today's numbers.
Trym, 19 Sep: *"as long as one solo user can choose to clean up the whole town by themselves,
and then increase the town health, and then unlock the buildings — it doesn't feel gated to me"*.
Agreed, and it is the right contract. **Today it is arithmetically impossible**, and the reason
is a design decision nobody has revisited: **the healthier the town gets, the less there is to
do.** `PROBLEM_COUNT` is 9 / 7 / 5 / 3 / 2 by band, while the drift above the set point is a
flat 0.6 an hour = **14.4 a day**.

| Band | Your problems | What you can give a day | Net, alone |
|---|---|---|---|
| Struggling | 7 | 14.0 | −0.4 |
| Recovering | 5 | 10.0 | **−4.4** |
| Lively | 3 | 6.0 | −8.4 |
| Thriving | 2 | 4.0 | −10.4 |

So one player fixing everything they can find, every day, still watches the town sink back to
the set point. It is a multiplayer machine: eight people each doing five things hold it up
easily. One person cannot, however hard they try, and "however hard they try" is exactly the
player Trym is describing.

**The fix is not the cap** (24 a day is already 12 fixes and nobody reaches it) — **it is the
supply.** Give a player about **ten to twelve tap-sized things a day at every band**, and the
climb works:

| Things a day | Net, alone | Recovering → Thriving |
|---|---|---|
| 8 | +1.6 | 27 days (too slow) |
| **10** | **+5.6** | **8 days** |
| **12** | **+9.6** | **4 days** |
| holding Thriving | — | 8 things a day, about ten minutes |

⭐ **And the supply should change in NATURE, not just in number.** A Thriving town with twelve
broken lamps is a lie. At low bands the work is **repair** (dark lamps, litter, tags, a dry
fountain, tipped bins); at high bands it becomes **upkeep** — water the planters, sweep the
terrace, polish the fountain, clear the tables, change the notices. Same tap-sized loop, same
walk-over, same burst, different fiction. This also fixes a flaw the town has today that has
nothing to do with jobs: **at its best state the square is the most boring**, with two things
to do.

**The resulting contract, which is what the game should actually promise:** about a week of
daily care brings the town to its best; about ten minutes a day holds it; leave it alone for a
few days and it slides back toward the middle. Nobody is required, nobody is punished, and one
person who cares can do it all. (**TRYM**: the numbers. My recommendation is a floor of ten,
which is eight days solo and much faster with company.)

### ⭐ Repeatability: something to do at any hour of a real day
Trym, 19 Sep: *"i want this to have high repeatability play throughout a normal 24h human day,
which means theres always something to do in the town"*. That is a requirement, and one thing in
the town works against it today: **your problems are one batch, seeded once per UTC day.** Clear
them at eight in the morning and the square is done until midnight. The night already solves this
for itself (a roaming ghost makes up to six new messes an evening, and every night lays out
cursed things) — **the day needs the same treatment.**

**The refill model: waves, not a batch.** The day's allowance is the same ten or twelve things,
but it is released in waves through the real day, with a ceiling of about six open at once. Seed
by `(player, day, wave)` where a wave turns over every few hours, so it stays deterministic — a
reload never rerolls, and two players never share a problem, exactly as today. Then:

- someone who plays once finds a full square of work;
- someone who drops in three times finds something each time;
- nobody can clear the town at breakfast and find it dead at bedtime.

**What fills each part of a real day** (most of it already exists):

| When | What is there |
|---|---|
| Morning | the night's mess: what the ghosts tipped, snuffed and dropped, plus the day's first wave |
| Through the day | the waves refilling; a job you can clock into whenever you are there |
| Evening | the nightfall clock, the omens when a Curse Night is charging |
| Night | ghosts every night, their mischief, cursed things appearing through the dark, the night shift |
| A Curse Night | more ghosts, the queue-jumper, cursed customers, the night vendor |

**⚠️ The caps bound the METER and the COINS, never the availability of work.** Past the daily cap
the square still gives you things to do and still says thank you; what stops is the town moving
and the coins landing. The copy never names a rate or a ceiling (the mystery rule), and the world
must never read as switched off.

**⚠️ Available, never demanded.** High repeatability is one step from a chore treadmill, and the
town's founding rule is that nobody is punished for absence. The town decays slowly and
forgivingly, the bar is a shared thing and never a personal streak, and there is no daily-login
anything. If a session ever opens with a list of duties, that is the failure.

**What Pulse must answer** (a tile, not a hunch): are fixes spread across the hours of the day or
bunched at one, does anybody reach the daily cap, and does a returning player find work on their
second visit of the same day.

### The bar must be the roadmap
Trym: *"even in the town health progress bar that the progress bar shows the different steps —
it must be well explained"*. The health card already draws five zones with the band's name and
its promise. What it must add:
- **What each step OPENS**, named as services, not atmosphere: the basics on Pip's counter, then
  the common goods, then the travelling stall and the lanterns, then the rare row. A player
  should read the bar and know what they are working toward.
- **Where you are, and what the next step opens** — already there, keep it.
- ⚠️ **One line separating the two locks**, or the bar will be blamed for something it does not
  control: a business you have not unlocked yet is not the town's mood, and its own signpost
  says so. Without that line, a player at Thriving stares at a boarded front and thinks the bar
  lied to them.

---

## 2. Chapter 2 — the four signatures

Four sub-chapters, each independently green, each one session, in this order:
**the General Store → the Arcade → the Post Office → the Coffee Cup.**

Each building is two steps: find the fault in the paper, then get it signed. The boards drop
behind the base line, the cone flies off, the plank falls in from above, the dark comes off the
front, and the resident walks out of their own doorway to their station. A certificate is pinned
on the Square Report — worded as **your** certificate being filed, never as town news, because
that board's tallies are genuinely shared.

**What the engine needs:** `AREAS.town` in `src/lib/world-quest.js` (with `inside()` gating so
the chip and marks hide in a room), a new `src/data/quest-c2.js` holding mechanics and a **copy
key per step and not one line of prose**, `bwq-c2` declared in `tools/storage-keys.mjs`, and the
second forward-only merge branch in **both** `worker-pass` and `banana-pass.js` (the comment
there says change both or neither).

**A player who never finishes chapter 2** still gets the whole square, the arcade and its five
games, Pip's shelf card at the hatch, the Exchange, the Wheel, the problems, the residents, the
ghosts and the Square Report. The hoardings must read as *a place with a story* and never as a
dead end.

✅ **MEASURED, 21 Sep 2026 — and the answer changed the build.** GA4, from 1 June:

| | people |
|---|---|
| met the questline (`quest_boot`) | **4 400** |
| started it — the title splash, once per player (`quest_intro`) | **116** |
| cleared at least one step (`quest_step`) | **76** |
| steps cleared in total | **409** |

Sixteen steps a finisher, so at most **22 people have ever finished chapter 1** — half a percent of
everyone who met it. (A bound, not a count: `id` is not a registered GA4 custom dimension, so
`quest_step`'s own parameter cannot be queried at all. **That is fixed forward**: each chapter now
fires `quest_c1_done` / `quest_c2_done`, and an event NAME always reads, so from today the number
is one query with nothing to configure.)

So the plan's own recommendation applies: **gate less behind the chapter.** Chapter 2 is built
town-only and asks nothing of chapter 1 — the fiction still joins them (the works order is signed
by the hand that scratched a name out of Nib's book) but the lock does not. And `HOARD_ON` stays
**false**: chapter 2 now exists to open the fronts, which was condition 1, but boarding three
shopfronts for 99.5% of visitors is the outcome this plan forbids, and flipping it is Trym's call
by name. `tools/check-quest-c2.mjs` fails if it changes without one.

---

## 3. The four jobs

You take a job by walking up to a boss and asking. **One job at a time** — changing is a walk to
another boss, which makes it a decision rather than an income stream. **(22 Sep 2026: the boss SAYS so.)** Asking a second
boss while you hold a job no longer moves you — the boss answers that you would have to leave your place
first (`work.busy`, naming it), and the way out is your own boss's card: `work.quit` is your question there
while the job is yours, `work.quitDone` the goodbye with the door left open. Trym asked whether several jobs
should be allowed instead; one at a time stands — the payslips and the work note would stack, and changing
is meant to be a decision. (**TRYM**: he asked "what
if you can work several places"; both judges resolved to one. Several at once with smaller sums
is the alternative.)

| Where | Boss | Rhythm | Pays |
|---|---|---|---|
| **The Coffee Cup** | Bean | Manual: clock in by stepping behind the counter, serve cups (the three-gesture minigame from the café plan) | Tips per cup, graded, at clock-out |
| **The General Store** | Pip | Mostly passive + the restock chore | The bigger weekly cheque |
| **The Arcade** | Spinner | Mostly passive + the floor and the dead cabinets | The smaller weekly cheque |
| **The Post Office** | Stamp | ⚠️ under review — post is delivered instantly, so there is no round to pay for (see §6) | — |

**The weekly cheque is DERIVED, never accrued.** No cron, no bank: the pass worker's existing
weekly lap pays only for a week your attendance actually covers, walking back at most
`PAY_BACK = 2` weeks. Three weeks away owes you nothing and loses you nothing, which is the
absence doctrine held exactly. It needs a **kept pass** (the Citizens precedent), which closes
the anonymous-mint farming hole and must read as an invitation to keep the pass, never a
punishment. Attendance is client-written, so say the bound out loud in the commit instead of
calling it proof.

**It arrives as a letter in the homestead mailbox** — a flag up on the fixture you can already
move, the letter opening in the shared dialogue card. That is the first thing in the world that
ever arrives while you were not looking.

**The chore pays in the room, not in coins.** A restocked face is on tomorrow's shelf and on the
till in front of you; a swept arcade floor is a lit room. Coins come only on the cheque. This
deletes a faucet, removes an inflation path, and answers "a collection you fill is not value".
(**TRYM**: the alternative is a small per-chore coin under a weekly cap.)

**⭐ The one number that makes the shared meter personal:** a shutter problem **on the building
you work in pays double**. The first time the town's condition has ever been about one player.

**Nib and the Mayor** (Trym's aside): Nib is the payroll desk — he files your certificate and
your first cheque, which is a *rail*, not a job. The Mayor is the one banana who cannot hire
you: unseen is the whole point, and he is chapter 3's destination. (**TRYM** may overrule.)

---

## 4. The general store interior — the best idea in the set

The arcade proves the town can have a room (`in-arcade.png`, 12×9 tiles at 576×432, entered
through `openFor('condo')`). The store gets the second one, cribbed from the homestead's
`INTERIORS` shape which already ships exactly this: the `inside` boolean becomes an `inRoom`
key with a `ROOMS` table.

✅ **Built 19 Sep.** The plate is baked empty and the stocked faces are sprites over it: the pack's
very same shelf and table units WITH GOODS ON THEM (403/404/405 are 406/407/408 filled, 423 is 421,
428 is 426), so a full shop is the same shop rather than a different one. One face per thing on
Pip's shelf today, read from the same `shelfFor()` the card reads — nothing at Abandoned, three at
Struggling, five, six, seven. No new state, no number on screen.

✅ **The restock chore, 19 Sep.** It is the whole sentence below, built: tap a crate stack and the
banana WALKS there before it lifts anything (`ctx.then`, the town's own walk-then-act grammar — a
crate appearing over your head from across the room reads as a bug); carrying it the banana walks
at 0.62 speed; the next bare face fills and `shelfFor()` grows by one, so the till ten steps away
has that row on it before you leave. `tw-restock-v1` is a per-day count on the device: tomorrow the
shop is the town's again. **It pays nothing in coins** — the reward is the shelf.

⭐ **The invitation is the whole instruction.** Empty hands: the two crate stacks glow. Carrying a
crate: the bare face glows instead. Not an arrow, not a tutorial, not a word — and it only shines
for somebody who can answer it (you work here, and there is a face left), so it is never a tease.
The glow is the town's own `is-todo`, and the glowing thing is the SAME single the plate already
painted laid exactly over itself (`STORE.over`), because a baked plate cannot glow.

**⭐ Bake the plate at its EMPTIEST.** The shelves in the baked room are bare, and the stocked
faces are sprites drawn over it by band. So **how full the shop looks IS the town's health**,
with no new state and no number on screen. The restock chore is: carry a crate, the banana slows,
the bare face fills, and the till ten steps away has that row on it before you leave.

~~Pip's existing shelf card **stays tappable at the door** — the room is a gain, never a toll, and
no shopper is charged a walk for something that already shipped.~~ **Reversed by Trym, 23 Sep 2026:**
*"for the general store - right now when you click on the building, you get a popup with all the goods you can buy
and a 'enter the store' button at the bottom of the popup - so this needs to move to inside the store instead since you
can walk inside that store before anything happens, the same goes for the arcade really"*. A building with an inside
is a door: a tap walks you in, and the shelf is on the counter inside (design library §22).

⚠️ Two traps already found by the research, both of which would have cost a session:
- The `is-inside` CSS hide lists hide `.tw-state`, `.tw-mark` and `.tw-glow`, so **every sprite
  inside a room renders invisible** with nothing visibly wrong. Both lists need `:not(.is-in)`
  first.
- The grocery theme bakes its floor into every silhouette; the homestead builder has a palette
  stripper and the town builder does not. Lift both builders' room code into one
  `tools/room_builder.py` and prove no regression by asserting `in-arcade.png` rebuilds
  byte-identical at 14 408 B.

**The post office gets no interior** — Modern Interiors has no post-office theme (checked).
Stamp's counter goes on the front, like the Exchange and the Wheel.

---

## 5. The money

- New faucets on worker-pass, **deployed before any client names them** (an unknown `src` is
  refused): `RULES.town.tips` (the café) and `RULES.homestead.wage` (the cheque — the mailbox is at the homestead and `areaOf()` reads the
  path). Plus `JOB_PAY`, `PAY_BACK = 2`, and `POST /job/take`, `/job/chore`, `/job/pay`.
- Rough weekly shape: the store's cheque around 90, the arcade's around 60, the café's tips
  2–6 a cup. Post pays nothing, which is why it cannot inflate anything. **Every number is Trym's thumb; the mechanism is not.** (**TRYM**)
- ⚠️ **Four faucets in, one designed sink out.** Removing the café's purchase deletes the town's
  only designed coin sink on the same day this adds four faucets. Either the café still costs
  something (a signing fee you sign for, which fits the fiction better than a purchase), or name
  the replacement sink. (**TRYM**)
- Nothing ever rides along with mail: **no coins, no items, ever.** Write it into the design
  library as a rule, because "somebody sent me twenty coins" will be proposed again by someone
  who has not priced alt-funnelling.

---

## 6. The post office and the social layer

Trym is right that Banana World is missing a social layer and that the risk may be worth taking.
The plan splits it into three, and only the first is inside chapter 2.

### ⭐ What makes it fun, and what would make it a drag
Trym, 19 Sep: *"how shall we solve the social layer — so its fun, and not a drag"*. Four things
make a small game's social feature a drag, and the design is built to dodge each one:

| The drag | The dodge |
|---|---|
| **Obligation** — unread counts, "they are waiting", streaks | Nothing is ever owed. No unread badge, no reply prompt, no streak. A card arrives, it is nice, it expires quietly in 30 days. |
| **Emptiness** — you write into a void at eight players | **The residents write too.** Nib, Moss, Bean and Stamp post to you: a thank-you after a good week, a note after a Curse Night. The mailbox is never dead, even on a Tuesday when nobody else is on. This is the load-bearing beam, not a flourish. |
| **Friction** — typing a message on a phone inside a pixel game is work | **Sending is a gesture, not a composition.** Four taps at the counter: a picture, a line you pick, your stamp, a house. Ten seconds. |
| **Dread (Trym's own)** — a queue he must read forever | Picked lines mean **nothing to read**. The ongoing cost is reports only, and a kill switch reachable from his phone. |

**And three things make it actually good:**
1. **It arrives in the world, not in a UI.** The flag on your homestead mailbox is up. You walk
   over. The card opens as a card. There is no inbox screen anywhere — an inbox is a webpage.
2. **It is recognition, not small talk.** The deck's lines are keyed to things the world already
   knows and can verify: you fixed the square, your yard looks good, you worked the counter, the
   curse took your lamps last night. A card that names what you *did* is worth ten that say
   hello — and it needs no typing, because the fact comes from the server.
3. **Giving is the good half.** Sending costs you nothing and expects nothing back. The best
   version of this at ten players is not a conversation, it is a world where small kindnesses
   land unannounced.

**What may ride along: nothing with a price.** No coins, no shop items — that is alt-farming.
But a **keepsake with no market value** is safe and is the whole point: a pressed flower, a
snapshot of your yard, a picture of the square the night you fixed it. Priceless instead of
valuable, so there is nothing to farm and everything to keep.

**And it is a person, not a system:** a letter is in somebody's handwriting-shaped paper with
their house name on it. That is the difference between a notification and a neighbour.

### ⚠️ Delivery is INSTANT. A player never carries another player's post.
Trym, 19 Sep: *"if players have to deliver things manually, that is too much of a drag that its
ever going to be used, in a world with instant messaging"*. He is right and it kills the round
as a delivery mechanic: a card that waits for some other player to walk a shift arrives days
late or never, and at ten players that is most cards. **A card lands in the recipient's mailbox
the moment it is sent.** Nothing waits on a carrier, a shift, a cron or a queue.

The post office is therefore **a place, not a depot**: the counter where you write one, Stamp
behind it, the pigeonholes, the town's postmarks on the wall. If it carries a paid job at all,
that job must never gate a single card. (**TRYM**: it may honestly be the one building whose
value is the social layer itself rather than a wage — three jobs and a post office.)

### ⭐ The differentiator: a card is an OBJECT, not a message
This is the answer to *"in a world with instant messaging"*. Discord is better than us at
messages and always will be. It cannot do this:

- A card that arrives is **a thing you keep**. The intent is to pin it on the wall of your home
  through the décor system that already places objects in a yard a visitor walks through.
  ⚠️ **Not in v1** — yard items ride the wholesale save replace and all three mirrors, which is
  the likeliest session-eater in this whole plan. v1 keeps letters in the mailbox.
- So a wall of cards is **who thought of you**, on display, permanently. A loved yard looks
  loved, which no notification can do.
- And sending is **giving someone décor with your name on it**, which is worth more than a
  message that scrolls away.
- Keep, or let it expire. Nothing is owed, nothing is archived, no inbox exists.

### ⭐ THE LETTER (Trym's decision, 19 Sep — this replaces the earlier "no free text")
> *"you can write a postcard or letter, the font is the same font we used for quest-letters …
> you can only send letters through the Homestead … there should be a character-cap, so letters
> are short and sweet. Just like … twitters old 140 character cap … needless to say we need some
> monitoring on letters written and sent so we can avoid or filter out profanity if it occurs."*

**What it is.** A hundred and forty characters, handwritten on the world's own paper, written and
posted **at your homestead mailbox** — the fixture already exists, is already a collider, already
movable, and already has an open action with nothing behind it. One tap, no writing desk to
unlock, no new furniture. Delivery is instant.

**Why it can only be written at home:** a homestead now comes from finishing chapter 1, so the
whole social layer inherits that gate for free, without one extra rule.

**The paper.** `.bwq-paper` from the quest — cream, ruled every 25 px, torn top and bottom edges
by clip-path, tilted, and it unfolds when it opens. It wears **Caveat 600** and its line-height
is the rule spacing, so the handwriting sits on the lines (**done 19 Sep**, commit `6e6775fa`).
⚠️ It is scoped `.bwq-dlg .bwq-paper` today: lift it into `public/css/paper.css` as the world's
paper layer, the way dialogue was lifted, with its own design-library section and grep.

⚠️ **Never put the tilt and the torn clip-path on the element holding the caret.** iOS draws a
caret a pixel or two out inside a rotated, clipped box, and the clip eats the last line as the
box grows. **Tilt and tear the wrapper; the textarea sits upright inside it**, at 16 px or larger
or iOS zooms the page. Reuse the fixed-veil card shape so the keyboard shrinks around it rather
than shoving the world, and reuse the `visualViewport` handling that already exists in the
homestead, the rave and world-travel rather than inventing it.

**The cap buys craft, not safety.** Say so plainly: 140 characters fits a Discord invite, a phone
number, an address, or something cruel. Twitter's 140 hosted every abuse shape there is. The cap
is there because short is sweet, the rows stay tiny, and a human can skim a screen of them. **One
cap number in one file**, read by the input, the server and the copy job's limit, with a grep —
the guestbook's 80-on-the-client-90-on-the-server is the precedent for getting this wrong.

### ⭐ The rail that actually holds: you receive from houses you have ACCEPTED
A block keyed to a person is defeated in about a minute: a fresh anonymous pass mints a fresh
slug with one request. **So the real control is on the receiving side.** A letter from a house
you have never accepted arrives as a **knock** — the house's name and a stamp, no text — and you
accept the house once. A blocked person's new pass lands as another knock, which is litter, not
harm. Everything else (a block list, caps) is convenience on top of that.

⚠️ **Key the mailbox by SLUG, not by pass id.** A pass id changes the moment a player logs in,
and a box keyed to it loses their post; homesteads are addressed by slug and aliases already
resolve to an owner.

### The monitoring, sized for one person with a phone
| At | What happens |
|---|---|
| **Typing** | the shared family filter runs on the client, and the send is refused before it leaves |
| **The server** | the same filter again (the client is never the gate), plus a **contact-shape refusal**: a URL, a bare domain, an email, an @handle or a long run of digits is refused outright |
| **Platform words** | "discord", "roblox" and friends **flag**, never refuse — the site links its own Discord from `/community/`, and refusing the word refuses innocent letters |
| **Refusals** | kept in a quarantine row, because the refusal table is the only place anyone ever learns what players tried |
| **Reports** | the report button removes the letter for the recipient **in the same tap** and posts a row into the contact inbox Trym already opens on his phone. No new desk in v1. |
| **The switch** | `POST_OFF` on the worker, **deployed shut and proven to refuse before the client is built**, so the channel can be turned off from a phone without a deploy |
| **Caps** | per sender per day, and per pair per week |

**Post-moderation, not a queue**, and the reason is the one that has always been true: a
pre-read queue dies the week Trym is away, 200 letters back up, and the backlog gets
bulk-approved, which is worse than no queue. The honest trade is that a bad letter can be seen
once before it is removed. A holding switch for first contact is **built and left off**, so it is
a toggle if the refusal table ever turns ugly.

### THE POSTCARD — at the post office, with your own banana in the picture
A picture, a **picked** line, a stamp. The picture is your own banana composited live over a
baked template (the park share card already does exactly this), stored as a **recipe, not an
image** — which is what keeps it inside the $0 model.

- ⚠️ **Three templates in v1, not six.** Each is a tuning loop plus a copy field, and looking at
  six until they are funny is a session by itself. Park, your own doorstep drawn from your
  homestead's stage, and the rave card that cannot be photographed.
- ⚠️ **PNG-8, cropped native and scaled ×2 with nearest**, not JPEG at 1200×800: the area plates
  are 2200–2760 px wide, so a postcard crop is about 600×400 native and the JPEG estimate was an
  upscale that rings on hard pixel edges. 20–60 KB each, sharper and smaller.
- The line is **picked from the rig's deck**, never typed, so the postcard survives a letters
  shutdown and has no moderation surface of its own.

### What ships in which order
1. **The world's own post first**: the mailbox flag, the letter card, the residents' notes and
   the weekly pay-cheque. Same rail, no recipients, and it answers whether anyone enjoys finding
   post at all.
2. **Letters v1** — about **seven sessions**: the paper layer, the mailbox room keyed by slug,
   the filters and the contact-shape refusal, accept-a-house, the caps, the kill switch shut
   first, the report into the existing inbox, one lazy chunk, the copy job, the two page
   corrections, Pulse, and a walk at 360 / 375 / 390 / 393 with raw taps — **plus Trym typing one
   letter on his own phone**, because no test can raise a real keyboard.
3. **Postcards v2** — about **four and a half sessions**.

⚠️ **Cut from v1 on purpose:** pinning a letter on your wall (it means yard items through the
wholesale save replace and all three mirrors, the likeliest session-eater), the HQ post desk,
per-recipient settings beyond one off switch, and sender-side delete.

### Before the first letter is sent
1. `POST_OFF` deployed and proven to refuse.
2. The report path lands somewhere Trym opens, and removes the letter in the same tap.
3. Accept-a-house: an unaccepted sender cannot put text in anyone's box.
4. Server-side filter, contact-shape refusal, output stripping, caps, quarantine.
5. One cap number, one file, one grep.
6. `/privacy/` amended — it says the pass never leaves your device, which is false the first time
   a letter is delivered — and `/community/` gains the two powers the report actually has.
7. Both storage keys declared, and the chunk's budget agreed against the town-work slot (⚠️ the
   build order already spends the free total there; one chunk, one number, decided first).
8. Pulse reads `post_send`, `post_refused` (by reason), `post_read`, `post_report`.

## 7. The build order

Grouped; each line is roughly a session. **The store slice alone (server + data + room + chore +
one chapter step + copy + walk) is 6–8 sessions and is the honest first ask.**

**Before anything**
1. Measure chapter-1 completion in Pulse. It decides whether this plan is for everyone or for nobody.
2. Fix and deploy the three worker-rave defects (§9). Ships whether or not anything else does.

**The closed town** — ✅ **built 19 Sep 2026**, both halves
3. ✅ `CLOSABLE` widened to every shopfront and the store joined the band ladder, so a shut front
   now matches the empty shelf the data always had. Abandoned 3, Struggling 1, none above.
4. ✅ Four edits in `town-room.js`; it came out at 52 205 B of 56 000 (93%). `SHUT_STILL` means a
   front with no shutter art is still closable — the dark front, the tape and the red sign do it.
5. ✅ Three greps in `check-design.mjs`, each proven to fail when its rule is broken: the arcade and
   the post office never shut; a band may only shut a `CLOSABLE` key; every closable front keeps
   its keeper indoors.
6. ✅ Shot at 393 px. **The one still owed to Trym's thumb is his own look at them.**
6c. ✅ **YOUR LOCK, 19 Sep — and it ships OFF.** A worksite fence baked per front at its exact drawn
   width (store 183, café 158, post 293) from the pack's own `Worksite_Fence` triples, a signpost
   as the tap target, and no name plank. The card says the three things §1 asks for: what the
   building will be, that the STORY opens it, and how far along you are. Precedence is real and
   walked: a hoarded front wears no tape and hands out no shutter, and the moment the story opens
   it the town's lock takes over. `condo` in `HOARDABLE` is a red build.
   ⚠️ **`HOARD_ON = false` and must stay false** until chapter 2 exists to open these fronts AND
   somebody has read question 1 below. Flipping it early boards up the store, the post office and
   the café for every player who never finished chapter 1 — which this plan forbids in §2. The
   system is built, gated and walked; the switch is one line in `src/data/town/locks.js`, and it
   is Trym's.

6b. ✅ **A shut door says WHY, and the two whys are different copy.** `closed` is a one-day fault
   with a name and somebody will see to it; the new `lowShut` is a town too low to keep its fronts
   open, and every line of it says the square is the reason and hands are what bring it back —
   never a number, never a rate, which the walk asserts. This is Trym's "it must be well
   explained", and without it a player tapping a band-dark shopfront was told a bolt needed
   tightening.

**The day's work** — ✅ **built 19 Sep 2026**, and it answers Q7–Q9 below
3b. ✅ `PROBLEM_COUNT` (9→2 by band) became `PROBLEM_OPEN = 6` and `WAVES = 4`: six of your own
   things at a time, a fresh set about every six hours, the same at every band. What changes with
   the band is the KIND of work, not the amount.
3c. ✅ The draw loop counts what it PLACES, not what it draws — a pick that landed on something you
   had already fixed used to spend one of the six anyway, so the more you did the less you got.
3d. ✅ The walk turns a wave by hand (`room.nextWave()`) and proves fresh work arrives, six stay
   six, and nothing you fixed is ever handed back.

**The rooms**
7. ✅ **Done 19 Sep.** `tools/room_builder.py` holds the four moves every room is made of — the
   floor laid edge to edge, one wall band, the frame with its doorway, and the contract the client
   walks. Proven the only way it can be: both scene builders re-run and `in-arcade.png`,
   `in-wood2.png`, `in-wood3.png` and both geo files came back **byte-identical**. The store's
   room is now a table of furniture and two tile coordinates, not a third copy of the shell.
8. ✅ **Done 19 Sep.** `in-store.png` is baked at 11×8 tiles (528×384): a flush run of five bare
   shelves on the back wall, the counter beside them, and a crate stack and bare market table at
   each side wall with a clear aisle from the door to the till. Ten named spots (`sh1`–`sh5`,
   `till`, `cr1`, `cr2`, `tbl1`, `tbl2`) are what the stock hangs on. **Three colourways were
   baked and looked at; Trym picks.** Shipped: red-and-cream checker floor under tan brick.
   Alternates, one line each: deep red and gold (wall 1440,96), all wood (floor 0,576 + wall 912,0).
9. ✅ **Done 19 Sep.** `inside` is a room KEY and `ROOMS = { condo, store }` is the table; one plate is
   re-dressed per room (it used to bake the first room's box and picture in for ever). The arcade walk
   was written and landed green BEFORE the refactor, and did not notice it.
10. ✅ **Done 19 Sep.** Both hide lists exempt the room's own things, design-library §22 is written
   with the z-band and the early-return measured on the real page, and the gate fails any `.is-inside`
   list that exempts nothing (proven to bite). ⚠️ **`town-room.js` is now at 96%, ~2.2 KB free** — the
   next slice that touches it moves the look into a new chunk rather than shaving.
10b. ✅ **Done 19 Sep, and that is what happened.** The four cards — Pip's shelf, the travelling stall,
   the night vendor and the notice board — are `src/scripts/town-shop.js`, a lazy chunk. **town-room
   came back to 49 238 B, 88%**, and the new chunk is 6 218 B of its 9 000. ⚠️ Four ctx members are
   GETTERS because town-room reassigns `L`, `band`, `problems` and `curse`; a value passed once
   freezes the notice board. `shelfFor` and the `merchant`/`vendor` bodies stayed behind on purpose.
   ⚠️ **The player total is now 1 384 798 B of 1 420 000 (98%)** — a split costs a second module's
   boilerplate, about 1.7 KB. That ceiling is the next one to argue about, not town-room's.

**The jobs**
11. ✅ **Written 19 Sep, awaiting Trym's deploy.** `POST /job/take`, `/job/chore`, `/job/pay` plus
   `JOB_PAY = { store: 90, condo: 60, cafe: 0 }` and `PAY_BACK = 2`, and `RULES.town.tips` for the
   café. Proven by `worker-pass/test/jobs.test.mjs` (22 assertions, a faked clock so a week passes
   in a millisecond) rather than by curl: one job at a time, a kept pass required, a day is a day,
   whole finished weeks only, at most two weeks back, paid once.
   ⚠️ **Two deviations from §5, both deliberate.** There is NO `RULES.homestead.wage` faucet: the
   cheque is paid SERVER-SIDE into the ledger slot `job`, so there is nothing for a client to name
   or forge — adding a wage faucet nothing legitimately uses would be free coins for anyone who
   posts the event. And a week's days pay at the job they were WORKED at, not the one you hold on
   payday, because that is the only honest answer when somebody changes employer mid-week.
   The bound, said out loud: attendance is client-written, so a device that lies can reach at most
   `JOB_PAY × (PAY_BACK + 1)` per person ever — 270 coins at the store — all of it in a named
   ledger slot the desk can see. Also closed a gap found on the way: the town's `fix` and `object`
   faucets had never been tested at all.
12. ✅ **Slice one done 19 Sep: you can be hired, and turning up is noticed.**
    `src/scripts/town-work.js` is the chunk (1 630 B of its 40 000, loaded after the square stands).
    ⭐ **Asking is a QUESTION ON THE BOSS'S OWN CARD**, beside the two every resident already
    answers — no new card, no new button. Pip, Spinner and Bean can each be asked; a resident who
    runs nothing cannot. One job at a time, and taking another names the one you chose.
    ⚠️ **world-dialogue types a STRING, never a promise**, so the answer is picked from a device-side
    MIRROR (`tw-job-v1`) while the request goes out behind it. The mirror only decides which of four
    approved lines is said; worker-pass decides the job and every coin. The one answer a device
    cannot know — a link that is still an unkept pass — is corrected by the server and said after.
    Turning up at your own workplace calls `/job/chore`; the day is the server's to count.
12b. ✅ **The cheque, 19 Sep.** `/job/pay` is called from the homestead and its answer becomes a
    letter on the world's own paper, signed by Nib, carrying the coins — **the first thing in this
    world that ever arrives while the player was not looking.** The coins are already theirs by the
    time it lands: the letter is the telling, not the asking.
    ⚠️ **A player who has never held a job never makes the request**, guarded by the town's own
    `tw-job-v1` mirror, and the walk asserts that with a kept pass on the device so the guard being
    tested is the right one. The week is in the letter's id, so the same answer seen twice is still
    one letter, and the server marks a week paid regardless — a lost letter never costs coins.
    **Still to come in this group:** the store's restock chore and the café counter. *(Both built since: the
    restock chore 19 Sep, d8ca2d52; the café counter 20 Sep, ea5c8f2f.)*
13. The copy jobs (`town-restore`, `town-work`) through the rig, the gate, the approve.

**Chapter 2**
14. The engine opened onto the town, `quest-c2`, both merge branches.
15. Store steps; then the pay rail end to end (⚠️ `state.mail[]` must be added to the yard body
    and **all three** save mirrors in one commit or the wholesale replace eats it silently).
16. Arcade steps. Then **STOP AND LOOK**: if Pulse says nobody took a job, the post office and
    the café are both wrong and the next session is about why. This gate is the most valuable
    step in the plan and the easiest to skip.
17. Post office steps: the counter, the card, instant delivery.
18. Café: rewrite `docs/town-cafe-plan.md` §1/§6 to the certificate, ship the **bench prototype**
    of the counter, let Trym's thumb pick, then the gestures.
19. Pulse readers, the stub walk, the town walk at 393 px.

**The post** (§6 has the full checklist; each line is roughly a session)
20. The world's own post first: the mailbox flag, the letter card, the residents' notes, the
    pay-cheque. No recipients, so no risk, and it answers whether anyone likes finding post.
21. `POST_OFF` deployed **shut** and proven to refuse, before a line of client code.
22. The paper layer (`public/css/paper.css`) with its design-library section and grep.
23. The mailbox room keyed by slug: the filters, the contact-shape refusal, accept-a-house, the
    caps, the quarantine, the report into the existing contact inbox.
24. One lazy chunk: write, send, read, report. ⚠️ **One chunk, one budget number, agreed against
    item 12's slot before the first line** — the free total is already spent there.
25. The `post` copy job; `/community/` and `/privacy/` corrected in the commit that opens it.
26. Pulse + the walk at 360/375/390/393 with raw taps, **plus Trym typing one letter on his own
    phone** — no test can raise a real keyboard.
27. Postcards: the post office counter, three templates looked at until they are funny, the
    picker, the copy. About four and a half sessions.

**Honest total: about 30 sessions with the post. This is a quarter and a bit, not a feature.**

---

## 8. Every open question, with a recommendation

Consolidated 19 Sep after the letter decision. **Blocking** means a build cannot start without
it; the rest can be answered as each piece is reached. My recommendation is on every line, so a
silent yes is a workable plan.

### Blocking — answer before any of this is built
| # | Question | Recommendation |
|---|---|---|
| 1 | **How many players finish chapter 1?** The whole town now sits behind it, and the number is in Pulse today. | ✅ **MEASURED 21 Sep 2026, and it is small — so chapter 2 gates nothing.** See below. |
| 2 | **What ships first — the town's jobs, or the post?** | **The world's own post**: the mailbox flag, the letter card, the residents' notes. One or two sessions, no recipients, no risk, and it answers whether anyone enjoys finding post before thirty sessions are spent. |
| 3 | **The budget.** The build order already spends the free total on one 40 KB town chunk; the post wants its own. | Decide the `totalBudget` raise up front, in `_raises`, not in the pull request. |

### The town's two locks and its work
| # | Question | Recommendation |
|---|---|---|
| 4 | **How bleak is Abandoned** — three shut fronts or five? | ✅ **Three, built.** The screenshots say three dark taped fronts plus five dead lamps and a dry fountain is already bleak; five would leave a stranger nowhere to go. |
| 5 | **Is the sticker shop ever taped?** | Never. It is the one front that leads to real money. |
| 6 | **Does the locked signpost show progress** ("the second of four signatures")? | Yes. A sign that only says no is a dead end. |
| 7 | **The solo climb**: ten tap-sized things a day, or twelve? | ✅ **Twelve, built.** Six open × four waves puts 24 within reach, and the pass counts 12 of them (TOWN_FIX_CAP 24 ÷ TOWN_FIX 2.0). That is +24 a day against −14.4 of decay: the set point to Thriving in four or five days alone. |
| 8 | **Does the work change from repair to upkeep** as the town improves? | ✅ **Yes, built** — and it needed no new data. Litter and crows were already a player's OWN problems and never the shared look, so a Thriving square still reads pristine to everyone walking through while each player finds six small things. The walk asserts nothing at Thriving is a lamp, a tag or a dry fountain. |
| 9 | **The refill rhythm**: how many waves a day, how many things open at once? | ✅ **Six open, four waves, built.** Seeded by (player, day, band, wave). Nothing accumulates while you are away: you always walk in to six, never to a backlog. |

### The jobs
| # | Question | Recommendation |
|---|---|---|
| 10 | **One job at a time, or several at once?** (His words said several; both judges said one.) | One. It keeps the weekly total honest and makes changing jobs a real decision. |
| 11 | **"Monthly pay-check" or weekly?** He wrote both. | Weekly. Monthly means a first cheque up to thirty days after taking the job. |
| 12 | **Do the arcade's machines actually break?** | Yes, but a faulted cabinet must never refuse to play — one annoyed player is a tenth of the population. |
| 13 | **May a job-holder walk through their own workplace's tape?** | No. A staff gap quietly reverses "the worse the meter, the more workplaces closed". |
| 14 | **Do chores pay coins, or pay in the room?** | In the room: a restocked face is on tomorrow's shelf. Coins come on the cheque. |
| 15 | **Does the café still cost something**, now that it is signed for rather than bought? | A signing fee, which fits the fiction and keeps the town's only designed coin sink. Otherwise name the replacement sink. |
| 16 | **Is the post office a workplace at all**, now that nothing needs carrying? | No. Three jobs and a post office is the honest answer. |
| 17 | **Nib and the Mayor as employers?** | Nib is the payroll desk (a rail, not a job). The Mayor stays unseen — he is chapter 3. |
| 18 | **The numbers**: the two cheques, the tips, the chore caps. | The plan's guesses are about 90 and 60 a week and 2–6 a cup; the mechanism is right whatever the numbers. |

### The post
| # | Question | Recommendation |
|---|---|---|
| 19 | **Pre-read every letter, or not?** | No queue — it dies the week you are away and the backlog gets bulk-approved. Build the hold-first-contact switch and leave it **off**. |
| 20 | **Does accept-a-house gate letters as well as postcards?** | Yes. It is the only control a fresh anonymous pass cannot walk around. |
| 21 | **Does `/community/` state 13+ for sending?** | Yes, one line, no birthdate collected. |
| 22 | **Postcards: a picked line, or free text on the back?** | Picked. The picture then survives a letters shutdown and carries no moderation surface. |
| 23 | **Does deleting your pass wipe letters already sitting in other people's boxes?** | Not in v1. Say plainly on `/privacy/` that sent letters sit in other boxes until newer ones push them out. |
| 24 | **Does a stamp cost a coin?** | Free in v1. A price on a gesture nobody has tried yet is a reason not to try it. |
| 25 | **Pinning a letter on your wall — v1 or later?** | Later. Yard items ride the wholesale save replace and all three mirrors; it is the likeliest session-eater here. |
| 26 | **The cap: 140 characters?** | Yes — and write down that it buys craft, not safety. 140 characters fits a phone number or something cruel. |

## 9. ✅ Three live holes — fixed and deployed 19 Sep 2026

Found while researching the safety of player mail, and closed the same day (commit `5803fe41`,
deployed by Trym):

1. **A claimed homestead name skipped the family filter.** It now runs through `sanitizeName()`
   server-side, as do all five visitor-name writes (guestbook, visit, water, hug, feed).
2. **Guestbook text never met `dirty()`.** It does now, and a refused note says why.
3. **A wrong world token slipped through** by setting the person id equal to the device id. A bad
   proof is now a 401 on any POST. ⚠️ Still true by design: an **anonymous id cannot be proven**,
   so it is mintable — which is exactly why §6's accept-a-house rail, not a block list, is what
   holds.

---

## 10. Risks to say out loud

- **The plan is a jobs plan with a social layer appended; the message was a social plan with jobs
  as the frame.** That mismatch is the single most important thing for Trym to rule on.
- At 8–10 daily players, a social feature's failure mode is **emptiness, not abuse**. The
  residents writing back is the mitigation and must not be cut.
- Gating the town behind chapter 2 makes a hidden prototype **more** hidden.
- `town-room.js` is at 92.7% of its budget and the player total at 97%: one 40 KB chunk fits,
  two do not.
- The weekly cheque rides client-written attendance, bounded to two envelopes.
- The town is a multiplayer machine today: alone, the health bar cannot be raised past the set
  point at all. Fixing that is a prerequisite for this plan's unlock story, not a polish item.
- Jobs currently never touch the town's best content (ghosts, Curse Nights, cursed objects), and
  working does not feed Citizens of the Week — the cheapest emotional payoff available and
  nobody proposed it. Worth adding.
- The guestbook already lets players leave text on each other's yards, unfiltered. **The risky
  social layer already exists; it is just unloved.**


---

## 11. Jobs 2.0 — duties, payslips, tips, the lemonade stand and the post office job (21 Sep 2026)

Trym, late on the 21st, after the town became the front door: *"there should also be notifications
similar to the quest notifications … if you have duties regarding your job … the post office or your
mailbox at the homestead sends you the paycheck, and the paycheck should have a different color paper
or look or envelope style … a collected amount of pay so far with a counter until payday … The coffee
shop is just for tips. While store, arcade, post office are for paydays with payslips the coffee shop
and lemonade stand is for tips."* And: *"The lemonade stand should also have something - maybe you can
work selling lemonade - and also, the post office job - we need a plan for that aswell, some sort of
simple minigame."*

### 11.0 What is what, today
| Thing | State |
|---|---|
| Taking a job (Bean, Pip, Spinner) | ✅ built — one job at a time, kept pass required (§3) |
| Turning up counts a day | ✅ built — `/job/chore` on the client's proximity tick, a quiet line once a day |
| The weekly cheque | ✅ built — derived on the pass worker (`JOB_PAY × share` of the week's work since 22 Sep — §12.1; walks back 2 weeks), lands as a letter in the homestead mailbox; ✅ 22 Sep: drawn as a PAYSLIP — kraft paper, a red stamp, the workplace, the days at the rate, the total (§11.3) |
| The store's restock chore | ✅ built (the crate, the till row) |
| The arcade's chore | ✅ 22 Sep: three pieces of litter and one dark cabinet a day, for the arcade's own staff; sweeping and repairing count on the week's sheet (§12.2) |
| The café | ✅ tips per cup, at clock-out; ✅ 21 Sep: the window is the tap target, `+n` per cup, the tray counts the shift |
| The lemonade stand (Fig Jr.) | ✅ 22 Sep: a tips job on the café's tray with a lemonade deck (§11.5); Fig Jr. hires, the queue on Hall Street, a glass in the customer's hand |
| The post office job (Stamp) | ✅ 22 Sep: a round of sorting at the counter, on the café's tray (§11.4); 75 a week by payslip, `sort 3 · days 3` (§12.1) |
| Duty notifications | ✅ 22 Sep: the duties chip (`src/scripts/town-duties.js`, words `town-duties`) — the quest chip's sibling in the town's paper, under the quest chip when both are up |
| Wage so far / payday countdown | ✅ 22 Sep: on the chip once you have turned up — `sofar` from the pass worker's `jobView` (the cheque's formula), payday counted to Monday; `owed` says "your payslip is in the letterbox" (`POST /job/view`, read-only) |

### 11.1 The two kinds of work — Trym's split, written down
- **Payslip jobs**: the General Store, the Arcade, the Post Office. Passive attendance + one daily
  duty each. Paid **once a week, Monday, by payslip in the mailbox**. Between paydays the player
  sees **wage so far** and **days to payday**.
- **Tip jobs**: the Coffee Cup, the Lemonade Stand. Paid **per cup, at clock-out**, and every cup
  shows its tip the moment it is poured. No payslip, no payday, no accrual.
- One job at a time still (§3). Changing is a walk to another boss.

### 11.2 The duties chip — the quest chip's sibling, in the job's colour
A second journal chip, mounted exactly where the quest's `.bwq-hint` sits (design library: one
grammar, one template), **in a work colour** (the town's brown-and-cream paper instead of the quest's
yellow, a briefcase pixel icon instead of the `!`). It shows ONE line: today's duty at your workplace,
or, once done, the wage line. It folds like the quest chip and remembers folding.
- Store: *restock the shelf* → done when the crate lands on the till.
- Arcade: *sweep the floor* (the litter inside the arcade room) and *wake a dead cabinet* (a
  tap-and-hold repair on a dark cabinet, like a streetlight) → done when the room is lit. **This is
  the arcade's missing chore.**
- Post Office: *sort the post* — the round in 9.4 → done when a round is played.
- Café / Lemonade: *clock in at the window* → the chip shows the shift's tips while you work.
- Words: a new copy job `town-duties` (one line per duty per job, one "done" line each, the wage
  line with `{coins}` and `{days}` placeholders). Never a number in the prose; the numbers are
  rendered by the chip from the pass worker's job view.
- The same chip is the **compass** when you are not in the town: *your shift at the General Store*.
- Pulse: `town_duty` (job, done) beside `town_chore`.

### 11.3 Wage so far, payday, the payslip
- **Wage so far** = `round(JOB_PAY × days_this_week ÷ 7)` — the cheque's own formula, so the chip
  never promises a coin the worker will not pay. **Payday** = Monday 00:00 UTC; the chip counts days.
  Both come back on the existing `/job/*` answers (`jobView` gains `sofar` and `payday`).
- **The payslip** is the wage letter that already lands in the mailbox (`wage:<week>:<job>`), dressed
  as a payslip: a **brown window envelope** in the mailbox list (its own sprite, beside the white
  letters), a ruled paper inside — job · days worked · rate · total — stamped PAID. The words stay
  the rig's (`homestead-post` `wage`); only the paper and the envelope change. ⚠️ the mailbox flag
  already goes up on delivery; a payslip should also be **announced in the town** the first time you
  are there after payday: the duties chip says *your payslip is in the mailbox* — the second thing in
  this world that ever happened while you were away, and the first one that pays.
- The HUD's coin chip is unchanged: wages land as coins only when the payslip is opened (as today).

### 11.4 The post office job — sorting the post (a payslip job) — ✅ BUILT 22 Sep 2026
Stamp hires you at his counter, the way the others do. The duty is a **round of sorting**: cards
slide onto the counter one at a time, each with one of the world's four postmarks (the Park's leaf,
the Bay's shell, the Homestead's gate, the Town's fountain — pixel stamps, no words), and four
pigeonholes stand behind the counter; you tap the right hole. Two minutes, or until the pile is
done. Grades like the café's (right / late / wrong), a receipt at the end — and the round counts as
**the day's attendance**, nothing else. It never touches a real letter (§6: delivery is instant; the
sort is theatre), and it pays on the weekly payslip like the store. Machinery: the counter tray
already exists (`mountCounter`, written form-blind — §8 of the café plan); a sort round is a second
deck on the same tray, not a second tray. Words: `town-post` gains the round's lines (hired, clock-in,
the three grades, the receipt).

**As built (22 Sep 2026), and where it differs from the paragraph above:**
- Stamp hires on his card like the other three (`BOSS.stamp = 'post'`), and the round is reached from the
  **mailbox card**: the post office has no serving hatch, so its own staff find one more button at the foot of
  the mailbox (`round.start`), the card closes, the banana walks to the counter's mark and the tray rises on
  ARRIVAL — the cabinets' rule, never over a walk. A stranger's mailbox has no button.
- The round counts as the duty `sort` on the week's sheet (`DUTIES.post = sort 3 · days 3`, §12), not as
  attendance: turning up is counted by the same mark as everywhere else. A round counts when at least
  **half the pile** went to its own hole, late or not; the receipt says which it was (`round.receipt.counted`
  / `.short`). The rate is **75** a week (`JOB_PAY.post`), between the arcade's 60 and the store's 90.
- The four postmarks are the bundled pixel icons the world already owns — a flower for the park, a fish
  for the bay, a house for the homesteads, a note of music for the rave — because the pack has no leaf,
  shell, gate or fountain stamp and nothing is hand-drawn (pack fidelity). The post goes OUT to the four
  other places; the town is where you are standing.
- The numbers: a pile of 12 (three of each mark), 4.2 s fresh, 9 s and an unsorted card leaves as wrong,
  two minutes a round. Right / late / wrong per card go to Pulse as `town_sort`, the round as `town_shift`.
- Machinery: `src/scripts/town-sort.js` (its own lazy chunk, 14 000 B budget) — the round form-blind above
  `mountSorter`, the deck on the café's `.tw-cup` box below it. Walk: `tests/town-sort.spec.mjs`.
- **The finish and the notice (Trym, later the same day: "something pleasing for finishing the sorting … it feels
  good to finish a day's job"; "a small one-time notice by the sorting buttons"):** a mark pops as it lands and
  the hole answers in the grade's colour; the last card sets the tally waving along its length before the tray
  goes down; the receipt's marks arrive one by one, the counter bursts (twice for a round that made the sheet),
  and a counted receipt gets the counter's own rubber stamp slammed across it (`round.stamp`, SORTED — the
  payslip's PAID has a sibling). The work note's counts line pops when a number moves. The first round on a
  device carries `round.hint` under the holes ("Each card belongs in the hole with its matching stamp."), then
  never again (`tw-sort-v1`). And a toast raised above a tray lives seven seconds instead of four: the eyes are
  at the bottom while it stands at the top.

### 11.5 The lemonade stand — a tips job — ✅ BUILT 22 Sep 2026
Fig Jr. hires you at the stand (a fourth boss). Same tray, a **lemonade deck**: squeeze (a hold),
ice (taps), pour (the needle) — three gestures, no words. Visitors queue at the stand's front the way
they queue at the café rope; a served visitor walks off with a **lemonade cup** in hand (one new held
item, the jug's sibling in `townwear.js`). Tips per cup, `+n` as it pours, the shift's count on the
tray, paid at clock-out through `town/tips`. Fig Jr. steps to the orchard while you work it, as Bean
takes his terrace.

**As built (22 Sep 2026):** the café's counter became a configurable engine (`bootTownCafe(ctx, cfg)`: the
deck, the rope, the words, the held item, the mark, the way of standing behind the counter — the café's own
are the defaults), and `src/scripts/town-lemon.js` is the configuration: `LEMON_DECK` = squeeze (a hold) · ice
(three taps) · pour (a needle), the café's measured windows under new names, dressed by `[data-deck="lemon"]`
in the tray's stylesheet; the rope on Hall Street in front of the table (`[890,598],[989,598]`); the vendor
DRAWN in front of the stall and clipped at the table's top edge (the café's window recipe with the stall's own
geometry: the board 453–483, a twelve-pixel gap, the table 496–542 — a banana merely walked behind the sprite
showed a sliver; Trym: "anchored lower with at least half a banana") while your own banana on the cobbles is
hidden; the mark is the table's front, where the walk from a tap stops; `lemoncup` (townwear.js, the jug's sibling, the mug's hand) in a served
customer's hand; Fig Jr. steps to the orchard while the stand is worked (`standOn` → `overrideFor`). Tips through
`town:tips` as the café; `JOB_PAY.stand = 0`, `BOSS.figjr`; the work note's tips branch is generic now
(`duty.stand` / `standDone`). Words: the `town-lemon` copy job (the café's fields, re-noted for a stall and a
glass, with a gate that refuses the café's words). Walk: `tests/town-lemon.spec.mjs`.

### 11.5b Working holds the banana; the boss steps aside; a place answers plainly (22 Sep 2026, evening)

Three of Trym's calls after playing the stand, each now a rule:

- **🔒 Working holds the banana.** "i can still move in the background while pressing the work-tasks … movement
  should be locked … better to lock it and have a button for leave work." While a shift (café, stand) or a
  sorting round is on, a tap on the world does not walk and a key does not move (`working()` in banana-town.js);
  the tray's strip carries the one way out, a **Leave work** button (`leave` in town-cafe / town-lemon,
  `round.leave` in town-post — the rig's word), which clocks out and opens the receipt. The geography rule
  (off the mark it folds, far away it ends) stays underneath as the safety net for a banana moved by other means.
- **🧍 The boss steps aside.** "their default position while you work at their workplace should be a bit away
  from the workplace so they dont distort the queue that lines up or is in the way visually" — `ASIDE` in
  town-room.js: Bean → the terrace, Fig Jr. → the phone box (a new `booth` station on Hall Street), Stamp → the
  monument lane, Pip → the bank's step, Spinner → the fruit cart, for as long as the shift, the round or your
  time in their room lasts (`workingAt()`), and back to their own day after.
- **The vendor at the stand is chest-up**, like the café's window banana ("anchor my banana a little lower, you
  can see that the banana is cut in half"): FLOOR 536, DRAWN 66.
- **📣 A place answers plainly** (docs/voice.md): every line a place answers with is a signpost — what this is,
  what you can do here. Rewritten through the rig for the café, the stand, the post office, the map counter,
  the clothes shop, Pip's shelf, the two rooms, every shut front, and the places that still answered from code
  (the hall, the bank, the print shop, the Wheel's and the Exchange's cards, an old cabinet — the new `town-fronts`
  job). A gate (`plainPlace`) refuses a place line that names neither the place nor a thing a player can do.

### 11.6 Build order, and why
1. **The duties chip + wage/payday** (9.2, 9.3 chip half) — the smallest change that makes every
   payslip job legible; needs `jobView` on the worker, one copy job, one chip.
2. **The payslip envelope and paper** (9.3) — cosmetic on an existing rail; a day.
3. **The arcade's chore** (9.2) — it is the one job you can hold today with nothing to do.
4. **The post office round** (9.4) — a deck on the tray + `JOB_PAY.post` + the postmark art.
5. **The lemonade stand** (9.5) — a deck on the tray + a boss + a cup.

### 11.7 Still Trym's to call
- ~~The post office's weekly rate~~ ✅ **Settled as built, Trym 22 Sep:** 75 a week (the store's 90, the arcade's 60).
- Whether a tip job's clock-out toast should name the total (words) or just show the coins (numbers).
- The arcade's chore pay: nothing beyond the cheque (§3's rule), or a small per-chore coin.
- Whether the duties chip may sit on screen in the other areas as the compass, or only in the town.


---

## 12. The week's work — duties, the scaled cheque, the boss's letters, the sack (22 Sep 2026)

Trym, 22 Sep: *"it should probably have some variance in pay depending of how often the user has swept
floors and fixed broken machines … the user gets the reasoning in the payslip why the pay is lower this
time if they havent done much. after a while they should get fired if they fail to do anything in a week
or something … optional quest-notifications in a different color letting users know that they have
work-stuff to forfill and a time-span they have to fix it … Arcade: Swept floor 0/3, fixed Arcade machine
0/3 … maybe even letters from the boss asking if they are coming for work … this system can probably be
replicated for all places with payslip-jobs."*

### 12.1 The system, in one table
| | |
|---|---|
| **The week's work** | per payslip job, a short list of duties with weekly targets — `src/data/town/jobs.js` `DUTIES`: the Arcade `sweep 3 · fix 3`, the General Store `restock 3 · days 3`, the Post Office `sort 3 · days 3` (a round of sorting, §11.4). ONE source for the pass worker and the town. |
| **The cheque** | `payOf(at, done) = round(JOB_PAY[at] × share)`, `share` = targets met ÷ targets, each duty capped at its target. Nothing done, nothing paid. The old "days ÷ 7" is gone. |
| **The reasoning on the slip** | the paid row carries the counts (`duties`) and `share`; the payslip prints them under Nib's line — *floor swept 1/3 · machines fixed 0/3 · 17% of the full week at 60 · 10*. |
| **The work note** | the quest chip's sibling in the town's paper: the counts line (*the arcade · floor swept 1/3 · machines fixed 0/3*) and under it the wage so far + days to payday, or *done*, or the boss's nudge (amber), or the sack (grey), or *your payslip is in the letterbox*. Folds; sits under the quest chip. |
| **The boss writes** | Thursday on (`NUDGE_DAY = 3`, Monday = 0) with nothing done → `nudge` on the job view → a letter in the homestead mailbox (`nudge:<week>:<at>`, Spinner or Pip) and the amber line on the note. |
| **The sack** | `FIRE_WEEKS = 2` finished weeks with nothing done, while still holding the job → `/job/pay` sets `fired`, clears the job; the last payslip's row says `fired`; a letter (`fired:<week>:<at>`) and the grey line on the note for three days. Asking the boss again rehires (`/job/take` clears it). |
| **Counting a chore** | `POST /job/chore { kind }` — the town says *swept* / *fixed* / *restocked* as it happens; the week counts up to the target and no further (the ceiling a forged client can reach is still one week's rate). `days` is counted server-side from attendance. The mirror (`tw-job-v1`) moves in the same beat; the server's count replaces it. |
| **Reading it** | `POST /job/view` (read-only) on town entry; `/job/chore` and `/job/take` answer with the same view; `/job/pay` carries it too, so the homestead can write the boss's letters. |

### 12.2 The arcade's chores (the first job with real work)
- **The floor:** three pieces of litter a day on the arcade floor (`ARC_LITTER` spots, off every collider),
  drawn for the arcade's own staff only (`tw-arcade-v1` remembers today's swept pieces on this device).
  Walking onto one sweeps it — the square's litter rule — and counts `sweep`.
- **A dark cabinet:** one of the nine a day (seeded by the day), drawn dark (`.tw-dead`) with the repair
  icon. Tapping it is a **repair** (the streetlight's hold, 3.2 s, on the room's own plate), not a game;
  woken, it counts `fix`. A customer never sees a dark cabinet: an arcade that looks broken to a customer
  is a different feature.
- The store's `restock` counts each crate that lands on the till (`restockAdd`), `days` counts itself.

### 12.3 From the player's side
Hired at the arcade, you see the note: *the arcade · floor swept 0/3 · machines fixed 0/3* / *the week's
wage is 0; payday is Monday, 5 days away*. You step in: three bits of rubbish, one dead cabinet. Each
one you clear moves the note the same second. Do the lot and the note says the week's work is done; do
nothing until Thursday and it turns amber with Spinner's line, and his letter is in your letterbox. Payday:
the slip prints exactly what you did and what it came to. Two dead weeks and the slip comes with his
goodbye — and the arcade door still opens when you ask.

### 12.4 Still Trym's to call
- The targets (three and three) and whether `days` should count at the arcade too.
- Whether a boss's nudge should also toast in the square the first time it is seen.
- ~~The store's second duty~~ ✅ **Settled as built, Trym 22 Sep:** the restock chore and `days`.

## 13. The mailbox: two drawers, the knock, the owner's key, the residents who notice (22 Sep 2026)

Trym: *"go ahead with the knock rail and the residents' letters. But make sure it looks great visually in
the mailbox when you have lots of letters so its not all in a long list, maybe a 'read' or 'archive' minitab
for old letters, so you always see the fresh letters youve received from anyone, users and residents"*.

### 13.1 What is what
| Piece | What it does | Where |
|---|---|---|
| **Two drawers** | **Fresh**: the knocks, then every unopened thing as a tile (envelopes, kraft payslips, postcard pictures). **Kept**: opened postcards as a strip, opened letters as one row per person with a count. The box always opens on Fresh; the drawer is the one scroller, so the card never outgrows a phone and *Write a letter* stays put. | `src/scripts/town-post.js`, `public/css/town-post.css` |
| **One mailbox at home** | The homestead's cream card is gone. Its mailbox opens the same card, and the world's own notes (Nib's book, the payslips, the bosses) ride in as `local` rows beside other players' letters. They stay in the yard and never wait on the post room — offline they still show; only the write door waits. | `src/scripts/banana-homestead.js` (`worldRow`, `local`) |
| **The flag** | The mailbox flag rises for the world's notes AND for the post room: one light `POST /post/box {peek:1}` on arrival, on closing the card and every five minutes → `{unread, knocks}`. | `peekPost()` |
| **⭐ The knock** | A house the box has never had post from knocks: `/box` shows who and when, never a word of what (`knock:1`, text withheld server-side). *Let in* (`/accept`) turns every knock from that house into letters and lets later post straight in. *Turn away* (`/away`) drops its knocks, and what it sends later is quietly dropped while the sender is told it went. Writing TO a house lets it in (`/sent`, router-only) and un-turns it away. Twelve knocks at most, one row per house. Senders with earlier letters count as known. | `worker-rave` PostRoom |
| **⭐ The owner's key** | Every mailbox path but a send now proves that the caller's own house IS the box (world token → YardRoom `/whoami` → slug must equal the box). Before this, `/post/box?slug=` read anybody's letters — a slug is the sign on the fence and the address book publishes it. | `worker-rave` router, `tools/check-post-rail.mjs` §7 |
| **The residents notice** | Beside the welcome: a first letter out (`first`, new boxes only), a cabin and a house going up (`cabin`/`house`, baselined on the first look so nobody is written to about the past), the square put right today (`fixed`, from TownRoom `/fixes`), the morning after a Curse Night (`curse`, from the pure curse clock). One an hour at most. Nib, Stamp, Moss and Bean write them; the words are the rig's. | `factNote()`, `src/data/copy/town-notes.json` |
| **Pulse** | `post_note` (at, note), `post_knock` (n), `post_accept`, `post_away`, `post_folk` (open/pick), labelled and explained; the post office card reads them by prefix. | `src/data/pulse-events.js` |

### 13.2 Proven by
`worker-rave/test/post-room.test.mjs` (knock, accept, away, cap, facts — 58 checks), `tools/check-post-rail.mjs`
(the owner line, knock rows reduced to who/when), and the walks: `tests/town-post.spec.mjs` (a boxful in two
drawers at 360 and 393, the knock let in and turned away with real taps), `tests/homestead-letters.spec.mjs`
(residents and the world in one Fresh drawer; offline the notes still show), `homestead-post`, `homestead-payslip`.

### 13.3 Still Trym's to call
- Whether a knock should also raise the flag on the HQ Mail floor (today it is a Pulse count only).
- Whether Kept should ever thin itself (it holds what the box holds: 60 letters, 30 days).

## 14. The jobs audit, and the foundations fixed before any ladder (22 Sep 2026)

Trym: *"if we havent finished on quality stuff for all jobs we should probably fix that first, just to land
that the jobs work well gameplay-wise"*. A read-only audit of all five jobs (code + the built site + the pass
worker in-process) found three problems under every job and several per workplace. What was fixed:

| Found | Fixed |
|---|---|
| ⚠️ **Every sync push erased the job on the server** — it lived at `blob.pass.job` and `mergeBlob()` rebuilds `pass` from a fixed list. From 19 Sep no week was ever recorded and no cheque could be paid. | The job lives on the record beside the wallet (`jobRec`), an old blob's job moves over once; `jobs.test.mjs` §9–10 (fail on the old code, pass on the new). |
| ⚠️ **A café/stand shift over 12 coins was refused whole** (the tips rule is per EVENT; the buff doubles after the check) while the receipt said it was paid. | The till pays in pieces the rule accepts and counts the day's room in coins that LAND; `tests/town-cafe.spec.mjs` proves a 40-coin shift, buffed and not. |
| ⚠️ **Payday mostly could not arrive**: only while the phone held a job right now, and it stopped at a zero total before the boss's letters. A second phone never learned the job. | `wageCheck` asks while a job is held or was left within the payable weeks (`was`/`wasT`), posts zero weeks (their own words: `wage.none`, stamp `wage.void` = NIL) and the letters, skips tips jobs; every push ack carries `{job: {at, fired}}` and `banana-pass.js jobHint` fills a phone that lacked it. |
| The work note was hidden inside every room. | It stays up inside YOUR workplace (`.is-here`), still hidden in others. |
| At Thriving the store had no bare face — the restock duty was impossible in the town it rewards. | The staff's screen always leaves two faces for the day's delivery (`STAFF_FACES`). |
| The sorting round hung off a mailbox that needs an address and a working post room. | The round's button is there for staff in every mailbox state; a late box answer can no longer reopen a closed card. |
| A hire was a typed line in a card that stayed open. | §27 of the design library: the boss's yes, the card closes itself, THEN "HIRED" over the square, a burst, and one line on where the work is (`work.moment`, `work.momentLine`, `work.start.*`). |
| No workflow ran any worker's tests (jobs.test.mjs had sat at 5 failures). | `tools/run-worker-tests.mjs` in CI (22 files, 612 checks) — it caught a real post-room race on its first run. |

**Still open, and going into the ladder plan rather than being patched:** the arcade's sweep target is met on
day one while fixing needs three days; the arcade and the store have no end-of-day moment; the stand and café
are the only jobs with skill yet pay the most (up to 120 a day against 60–90 a week); a quit has no
confirmation and does not name pay owed; the round's receipt says "on the sheet" at 3/3.

## 15. The ladder, slice 1: work XP, ranks, promotion at the boss, one pay scale (23 Sep 2026)

The plan: https://claude.ai/artifact/BN3XdtMec5Q4BkvVh7FBht. Trym's four calls for slice 1, all as recommended:
**any boss hires** (no gate; references come later) · **ranks 3·4·5·5·6** (stand · café · arcade · store · post) ·
**one pay scale** · **promotion at the boss**. Decisions 5–7 (mementos, which skill first, the post office carrying
real post) belong to later slices and are still his.

| Workplace | Ranks (titles) | XP a day | Ranks begin at | A full week at rank 1 → top |
|---|---|---|---|---|
| Lemonade stand | Lemonade seller · Senior squeezer · Deputy manager | 60 | 0 · 200 · 600 | 60 → 86 (tips: 12 → 17 a day) |
| Coffee Cup | Barista · Senior barista · Head barista · Café keyholder | 80 | 0 · 250 · 750 · 1500 | 90 → 156 (tips: 18 → 31 a day) |
| Arcade | Arcade attendant · Cabinet tech · Cabinet keeper · Floor manager · Night manager | 100 | 0 · 300 · 900 · 1800 · 3000 | 120 → 249 |
| General store | Shop assistant · Counter clerk · Window dresser · Stock buyer · Deputy storekeeper | 100 | same | 150 → 311 |
| Post office | Post sorter · Senior sorter · Parcel clerk · Postal clerk · Letter carrier · Deputy postmaster | 120 | 0 · 350 · 1000 · 2000 · 3400 · 5200 | 180 → 448 |

- **One source:** `src/data/town/jobs.js` — `LADDER`, `RISE` (a fifth more a rank), `XP` (a glass 0/2/4, a cup 0/3/6,
  litter 15, a cabinet 45, a crate 45, a round its points: `roundXp` = 5 a card fresh, 2 late, at most 60), `DAY_XP`
  10 for turning up, `rankOf`, `xpAt`, `weekPay`, `tipsCap` (a fifth of the rank's full week a day), `payOf(at, done, rank)`.
  `JOB_PAY` is rank 1 of the same scale (arcade 60 → 120, store 90 → 150, post 75 → 180; the stand's tips 120 → 12 a day).
- **Server (worker-pass):** on the record, never the blob — `j.xp[at]` (never lost), `j.rk[at]` (the rank the boss has
  TOLD you), `j.xd` (today's XP per workplace, for the cap). `/job/chore {kind, g}` adds the verb's XP (+ the day's ten
  the first time you turn up) up to the day's cap; a counter reports its whole shift at clock-out as ONE chore with a
  list of grades. `/job/view` carries `lad {xp, rank, today, news}`. **`POST /job/promote {at}`** makes the earned rank
  yours (409 `not yours` at another boss; `promoted: null` when there is nothing to tell). A cheque pays the rank the
  week was worked at (`r` on the week's sheet). `RULES.town.tips.day` is a FUNCTION now: `tipsDay(home)` = the higher
  of the two tips jobs' caps at the rank you were told. ⚠️ XP is client-reported like the chores: the day's cap is the bound.
- **The ceremony:** XP past the line is NEWS — the work note turns GREEN (the quest's note is yellow, the pager amber)
  and names the boss; the staff card shows the same line over the XP. On the boss's card the news is the FIRST question
  ("You wanted to see me?"); the boss says it in their own words (`town-staff.json promo.*`), the card closes itself,
  then PROMOTED + "Now {title} at {where}" (design library §27, the hire's order). Not coming by: the boss's letter in
  the homestead mailbox, once per rank (`news:<rank>:<at>`, `homestead-post.json bosses.news.*`) — it only asks you over.
- **Where it shows:** the staff card (title by rank, pips, XP against the next line, today against the cap, what the
  next rank brings); the work note (your title leads it, a thin XP bar along its foot, the rank's tips cap); the café's,
  the stand's and the round's receipts ("Work XP earned", a bar).
- **The till moved** from town-room.js's context into town-cafe.js (the room chunk was at its cap), and a tip is 0/1/2
  a cup now with no quick bonus: the day's tips fill in a handful of good cups, and the cups after that earn XP alone.
- **Pulse:** `town_promo` {at, rank}; `town_duty` kind `news`.
- **Proof:** worker-pass/test/jobs.test.mjs §11–12 (XP, the cap, forged grades, news, promote, tips cap by rank, a
  week paid at its rank), tests/jobs-maths.spec.mjs (the table), tests/town-ladder.spec.mjs (the card, the news, the
  promotion at Bean in order, at 360 and 393), town-cafe (18 a day at rank 1, XP on the receipt), town-sort (the
  round's XP), homestead-payslip (the boss's letter).
- ⚠️ **Deviation from the plan, said out loud:** the arcade and the store have no end-of-shift receipt. They are
  on-call jobs with no shift to end; their XP shows on the note's bar as it happens and on the card's "today" line.
- **Next:** slice 2 (a skill for the middle rungs — decision 6 is Trym's), then the unlocks rank by rank, then the
  social top (references, mementos, staff of the week).

## 16. The weekly review: demotion, and a firing that starts you over (23 Sep 2026)

Trym: *"you should also be able to be demoted, or fired … if you do the job very bad, or if you never show up, you will
get fired … if you want to be great and stay great you must do a good job (and get more pay)"* — and *"if you get fired,
you shouldnt loose a rank, you should loose your job, and have to start over"*. Agreed with one line drawn: **bad work
can cost you, time away without a job can't**, and quitting properly keeps your standing.

- **The review** (`src/data/town/jobs.js reviewOf`, run by worker-pass `jobReview` on every `/job/*` call, each finished
  week once, oldest first, only for the job you hold):
  - **full** — every duty met, or three good days at a counter (≥10 cups, four in five fine or better): a day's XP extra.
  - **poor** — under half the duties, or more than half the cups spoiled: a day's XP taken back (never below nothing).
  - **empty** — nothing done, or never came (a week with no visit counts too, from the week you were hired).
  - **ok** — anything else: nothing moves.
- **Warning, then demotion:** a poor week that leaves your XP under your rank's line brings a warning; the next poor
  week there costs one rank (never below the first), and the pay and tips cap follow at once. Climbing back over the
  line lifts the warning. Both are said IN PERSON — the note turns the nudge's colour ("Bean wants a word with you"), the
  boss's card asks "You wanted a word?" first — but the rank has already moved on the server: nobody dodges a demotion
  by avoiding the boss. No big moment for it.
- **Fired = start over:** two empty weeks and the boss lets you go; that workplace's XP goes to nothing, its rank to the
  first, its warning away. Your other workplaces keep everything. The counters can be nudged and let go now too.
- **Quitting keeps your standing:** with no job, nothing is reviewed; take the job back and your rank and XP are there.
- **Shows on:** the staff card (the word, the warning, "Last week was poor: 80 work XP taken back", and while under the
  line the bar is the amber climb back over it), the note, the payslip (a review row, "Your boss wants a word about it",
  "You were moved down a rank"), the homestead's fired and nudge letters (all five bosses).
- **Words:** `town-staff.json` wordQ/word/warn/demoted/warnCard/last; `town-duties.json` nudge/fired for all five;
  `homestead-post.json` bosses.nudge/fired for all five, wage.review/warned/demoted.
- **Pulse:** `town_warn`, `town_demote` (heard at the boss); `town_duty` kind `word`.
- **Proof:** worker-pass/test/jobs.test.mjs §13–17; tests/jobs-maths.spec.mjs (reviewOf); tests/town-ladder.spec.mjs
  (a warning, then a demotion, at Bean); tests/homestead-payslip.spec.mjs (the slip's review rows).

## 17. The arcade's repair game — the ladder's slice 2, first skill (23 Sep 2026)

Trym: *"build the arcade repair game next"* (decision 6 of the ladder plan). A dark cabinet used to be a 3.2-second hold
at its front; now it is the arcade's own skill, played on the counter's tray (`src/scripts/town-repair.js`, its own lazy
chunk, `ARCADE_DECK` on `town-cafe.js mountCounter` — the café's thumb-measured windows, renamed as the stand's were):
- **unscrew** — stop the needle in the screw's slot (a tap); **solder** — hold the iron, let go in the band (a hold);
  **power** — three presses on the switch's pulse (taps). The repair's grade is its WORST step, as a cup's is.
- **Spoiled** (grade 0): it sparks, the cabinet stays dark, nothing counts, and the next go is on the tray at once.
  **Fine**: the cabinet wakes, 30 work XP. **Perfect**: it wakes, 45 (`XP.condo.fix = [0, 30, 45]`; a fix reported with
  no grade, from an older page, still earns 45).
- While the tray is up the banana is held (banana-town `working()`); **Leave it** stops, and the cabinet stays dark. The
  tray stands down for the pocket like the counters. The room still owns the cabinet: `cabinetRepair` hands it to the
  game (`ctx.repair`), and `cabinetFixed(key, g)` wakes it and reports the chore with its grade.
- Words: `src/data/copy/town-repair.json` (gesture-labelled buttons, held to the copy gate's `gestureLabels`).
- Pulse: `town_chore` kind `spark` (a spoiled go) and `g` on a fix.
- Proof: tests/town-arcade-chores.spec.mjs plays the repair through the tray's own seam (perfect, and a spark then a
  retry, and Leave it); tests/jobs-maths.spec.mjs (XP by grade).
- Still to come in slice 2: litter through the week (today all three pieces arrive on day one), the store's customer
  requests. The ladder's R2 unlock for the arcade (a perfect repair lights the cabinet with a streak) is slice 3.

## 18. Litter through the week (23 Sep 2026)

Trym: *"do the litter through the week next"*. A sweep call used to put all three pieces of litter on the arcade floor at
once, so the week's target of three was met on the first call day and the rest of the week's litter counted for nothing.
A sweep call now brings **one piece**, on whichever of the three floor spots the day picks (`town-room.js arcadeShow`,
`work-calls.js NEEDS.sweep = 1`). Calls come six days in seven, so the week's three are swept over three call days — the
arcade's week asks for three visits, not one. One piece is a day's sweeping, so it is worth **45 work XP** (was 15 a piece),
and a full arcade day is still 100: ten for turning up, the day's piece, and a perfect repair. Walks: town-arcade-chores,
town-calls, town-staff, town-ladder; tests/jobs-maths.spec.mjs.

## 19. The store's customers — the ladder's slice 2, second skill (23 Sep 2026)

Trym: *"do the store's customer requests next"*. The store's week was a crate to a bare shelf and **days turned up** — the
ladder plan's "a job with no skill in it". The days duty is gone; the store's week is **3 crates + 3 customers served**
(`jobs.js DUTIES.store`). A new call, **serve** (`work-calls.js`: five days a week, 2–6 minutes into the first visit,
answered by **two** customers served), brings customers into the store while its staff are inside (`town-serve.js`, a
chunk loaded on entering the store with the store job).

- A customer walks from the door to the till. The ticket tray (the café's `.tw-cup` family, rising from the action bar)
  shows the thing they want — the till's own picture and name — and their **patience** (24 s) as a bar that goes amber
  past the quick share (45 %).
- While somebody waits, every stocked face wears a **ticket**: the picture of what is on it (the room's `shelfFor`, in the
  order the faces fill). A tap on a face walks there: the right one is picked up (drawn over the banana's head), the
  wrong one says so. A tap on the till walks to it and hands the thing over.
- Handed over inside 45 % of the wait: **perfect** (grade 2, 15 XP); later: **fine** (grade 1, 10 XP). Left too long:
  the customer gives up and goes, and nothing counts. **Not now** turns the customer away and no one else comes while
  you stay inside; walking back in brings them again.
- A face filled is worth **30 XP** now (was 45), so a full store day is still 100: ten for turning up, the delivery's two
  faces and the day's two customers served perfectly.
- The pass worker records a `serve` chore with its grade, like the arcade's `fix`. Pulse hears `town_chore` kinds
  `serve`, `miss` (gave up) and `away` (turned away). The day's count is `tw-serve-v1`, read by the calls as the room's
  own record.

Walks: tests/town-serve.spec.mjs (the whole beat with real taps, the late customer, Not now, the call answered; the
tray, tickets and customer on a 360 phone); tests/jobs-maths.spec.mjs; worker-pass/test/jobs.test.mjs (the store's
sections serve customers now).

## 20. The unlocks, rank 2 — the ladder's slice 3 (23 Sep 2026)

Trym: *"yes build it all"* — every workplace's second rank gives a new thing to DO, not only a bigger number
(`jobs.js UNLOCKS`, `unlocked(at, key, rank)`; the town reads the rank from the job mirror). The staff card names what
the next rank brings (`town-staff.json unlock`), and the promotion says it once PROMOTED has gone up.

- **Lemonade stand — big glass.** Some orders (about one in three) are a big glass: the ticket's pictures come bigger,
  the squeeze is held longer (`LEMON_DECK.big`: 2600 ms instead of 1700), and it tips twice and counts as two glasses
  of work. The first of a shift is announced.
- **Coffee Cup — the rush.** Once a day, after two cups with the rope clear, the customers stop leaving gaps: four
  in a row, and serving every one earns a bonus (`XP.cafe.rush` 15, on the receipt too). ⚠️ Two changes from the plan:
  the plan said "three at once" but the rope holds two, because a third customer stands off every phone's screen, so
  the rush is a stream you can see. And "at the same moment for everyone" would be met by almost nobody at ten
  players a day, so it comes during your own shift.
- **Arcade — the streak.** A perfect repair lights its cabinet gold for the rest of the day (`tw-arcade-v1 lit`, drawn
  by `town-room.js cabBox`), and perfect repairs in a row are counted and said (`tw-streak-v1`); a fine repair or a
  spark starts the count over.
- **General store — the basket.** About one customer in two wants two things: both pictures on the ticket, the first
  over your head and the second stacked on it, one till for both (half an order is not handed over), a longer wait
  (36 s), and half again a customer's XP (`XP.store.basket`). The pass worker counts a basket as a customer served
  (`COUNTS_AS`).
- **Post office — the fifth postmark.** The town's own post (a bell) joins the four, three cards of each (15), and the
  pile comes faster (fresh 3.4 s, gone 7.5 s). ⚠️ The tally moved to its own row under the pigeonholes and the pile
  fans like a deck: fifteen of each in one strip needed ~560 px of a 360 phone's ~310 and pushed every hole out of the
  150 px tray.

On-call jobs level up by reaching further into the world, counter jobs by new orders on the tray (Trym's two types).
The store's later ranks (the front shelf, the van order) are menu choices with nothing felt, and get rethought when
players near rank 3. Walks: tests/town-unlocks.spec.mjs (all five, at rank 2, and the first rank's card naming each),
tests/jobs-maths.spec.mjs, tests/town-ladder.spec.mjs (the promotion says the café's rush), worker-pass jobs.test.mjs §18.

## 21. The unlocks, rank 3 — and a day that holds more (24 Sep 2026)

Built the same night as rank 2, with the two-types frame (counter jobs level up by new orders on the tray, on-call jobs by
reaching further into the world) and the question "does it change what you do, or only a menu?":

- **Lemonade stand — the jug.** When nobody is waiting the tray offers the jug ("Hold to fill jug"); filled, the next
  three glasses skip the squeeze (`cup.order`). A customer who reaches the front first always wins: an untouched jug
  offer steps aside. The quiet moments between customers get something to do, and it pays in the busy ones.
- **Coffee Cup — special orders.** Some orders add a fourth step, syrup (the grinder's needle on a narrower band), with
  an amber drop on the ticket, and tip one more.
- **Arcade — the square's lamps.** A street lamp put right on the square counts as one of Spinner's repairs: work XP and
  the week's repair duty (`COUNTS_AS.lamp = 'fix'`). Hooked on the room's own `town_fix` report in banana-town.js, since
  the room file is at its size cap.
- **General store — home delivery.** A `deliver` call three days a week (work-calls.js, held back until the rank): a
  parcel on the store's floor, walked onto to pick up, carried (a little slower) across the square to a resident's
  workplace door under a bouncing marker. Its own lazy chunk, town-deliver.js.
- **Post office — parcels.** Three cards of a rank-3 round are parcels (kraft and string): sorted into the right hole,
  they go on the scale, a needle swings across the card and one tap stops it — in the band right, anywhere else or left
  there late.
- **⚠️ The day's cap rises with the rank** (`jobs.js dayCap`, CAP_RISE 0.15). The cap was exactly one full day of a
  workplace's duties, so every unlock that earns work XP (the rush, a delivery, a lamp) counted for nothing on a normal
  day. A rank's day now holds 15% more per rank climbed (the café's 80 is 92 at rank 2; the store's 100 is 130 at rank 3),
  on the server (xpAdd), the client's mirror and the staff card.
- ⚠️ The arcade's plan had "free runs" at rank 4: the cabinets are already free to play ("No coins move"), so that perk
  gives nothing and is dropped. The store's "front shelf" and "van order" were menu choices; the rank-4/5 unlocks are
  still to come and get the same test.

Walks: tests/town-unlocks.spec.mjs (all eleven unlocks so far), tests/jobs-maths.spec.mjs (dayCap), worker-pass §19.

## 22. Rank 4, the store's rank 5, and the ladder's top: references and mementos (24 Sep 2026)

- **Coffee Cup rank 4 (the top) — keys to the café.** A shift of five or more cups ends with the nearest mess on the square
  by the café put right (the room's own fix: the town's health rises, and it pays like a fix). The tidy waits until the
  receipt card has closed (§27 of the design library: the moment comes after the card), then the burst is seen on the square.
- **Arcade rank 4 — the square's litter.** Litter picked up off the square counts as the arcade's sweeping (the lamps'
  twin at rank 3; `COUNTS_AS.litter = 'sweep'`). Both lines are said once a day (§30).
- **Store rank 4 — two parcels.** A delivery day brings two parcels for two different doors: one pickup, two markers,
  either order; the first delivery says whose the other is. The day's call is answered when both are at their doors.
- **Store rank 5 (the top) — keyholder.** Pip's own shelf sells to the keyholder at the staff price (a fifth off), and the
  row says "staff price" where the price is read. The stall and the night vendor are not Pip's.
- **The top: a reference.** The top rank at a workplace starts you at the second rank of the next rung up
  (`jobs.js RUNGS`: stand → café → arcade → store → post office) — the first time you join it, not two rungs up. The
  staff card at the top rank names it; the hire says whose reference counted.
- **The top: a memento.** Promoted to a workplace's top rank, the boss gives a piece for your homestead from the pack's own
  art (`jobs.js MEMENTO`: an apple crate, a coffee counter, an arcade cabinet, a display cabinet, a grandfather clock) —
  into the shed once, said a beat after the rank's new thing; with the shed full it waits, and is given on a later visit.
  ⚠️ Whether it was given is the PASS WORKER's record (24 Sep 2026, the code review): a shed piece can be sold back, so a
  device-local "given" let a second device or a cleared browser take it again. Owed (`lad.mem` 1) at the promotion to the
  top, handed over once by `/job/memento` (2), and only its `given` puts the piece in the shed.

Walks: tests/town-unlocks.spec.mjs; worker-pass jobs.test.mjs §19–20.

## 23. The post office's top: registered post, the round, the morning mail bus (24 Sep 2026)

The plan's rank 4 ("your stamp mark on postcards") and rank 6 ("letters sent while you are on shift say who carried
them") both needed the POST server to know who is on shift — a registry held by another worker, for a feature nobody
reaches for two months. Re-scoped to the ladder's own pattern (the counter gets new orders; the top reaches the square):

- **Rank 4 — registered post.** Some cards carry a red seal: sorted into the right hole while fresh they count twice (a
  registered letter on time); sorted late they count wrong. Said once, the first time a sealed card comes up.
- **Rank 5 — the round.** A round of sorting that counts hands you a satchel of three letters for three residents' doors
  (once the receipt is closed, §27); the markers are over the doors; each letter is XP (`XP.post.letter`).
- **Rank 6 (the top of the whole ladder) — the morning post.** In the town's morning (the beat when Stamp waits at the bus
  stop) the mail bus leaves a bag at the stop; the deputy postmaster carries it to the post office — the town's post comes
  in through you. Said once, the first time the bag is there.

The store's parcels, the round and the mail bag share one carry engine (town-deliver.js RUNS: parcel, round, bus). Walks:
tests/town-unlocks.spec.mjs.

## 24. The arcade's top, the review's fairness, and the words (24 Sep 2026)

- **Arcade rank 5 (the top) — the night shift.** The night manager's reach is the square after dark: a ghost caught there
  (walked into) is one of Spinner's repairs (`COUNTS_AS.ghost = 'fix'`, 20 work XP), said once a day like the lamps. The
  jobs now touch the town's best content. Every rank from the second at every workplace now gives a new thing to do.
- **The weekly review judges only a week that could be passed** (the code review): never a week before
  `REVIEW_FROM` (2026-W40 — the arcade's chores were only reported from 22 Sep and the store's week changed on 23 Sep), and
  never a week you joined after its Monday. The store's weeks up to W39 pay days turned up as customers served, so a week of
  turning up under the old duties still pays what it earned.
- **A promotion overtakes a waiting word**: a warning still to be said is cleared, not said after the good news.
- **The words** (the copy review, design library §30.1): a cup speaks when it tells you something; the day's last tip is
  said once; receipts say the result; the nudge says the stake (two empty weeks and the job is gone); the first line after
  HIRED names the button that starts the work. Ranks 3 and 4 renamed where the title named the wrong thing: the store's
  rank 3 is the Delivery clerk, the post office's rank 4 the Registry clerk.

Walks: tests/town-unlocks.spec.mjs (the night shift), tests/town-cafe.spec.mjs (the counter speaks at its moment);
worker-pass jobs.test.mjs §21–24.

### 24.1 The second review (24 Sep 2026, 4a7c83ae)

- The first review code (live a few hours on 23 Sep) judged weeks before REVIEW_FROM: its strikes (`j.zero`) and warnings
  are undone once per record (`j.rf`), and a workplace already at its top rank is owed its memento.
- The Thursday nudge and the review judge by one rule (`judged`): from REVIEW_FROM, and only a week you FIRST joined that
  workplace by its Monday (`j.first[at]`) — quitting and asking again mid-week buys no week off.
- The night shift counts each ghost once a day (`tw-ghost-v1`); a caught ghost forms again and is not a second repair.
- Registered post's double is its own chore (`reg`, 5 a sealed card, `XP.post.reg` 15), outside the round's cap of 60.
- The memento goes into the shed first and back out if the pass worker says it was given elsewhere.
- A hire in flight: the turn-up chore waits, and a 409 'no job' cannot undo it on the device.

## 25. Staff of the week — the logic (24 Sep 2026; the visuals come later)

Trym: *"we can build the logic for staff for the week, but implement it visually later, i think it makes the most sense
to display it in the town or by the actual shops, and not in the park."*

- **One per workplace**, crowned on the first lap after a week ends — the citizens' own lap (worker-pass `rollupTick`), so
  every pass is scored alike. Files: `staff/live.json` (this week's top three per workplace, every lap),
  `staff/final-<week>.json` and `staff/latest.json`; public route `GET /staff` → `{ live, last }` (names, tags, looks and
  the week's work — never a key).
- **Score**: the WORK XP earned at that workplace that week (`dn.xp` on the week's sheet, counted from 24 Sep; bounded every
  day by the rank's day cap, so turning up often beats one grind), then days turned up, then the rank.
- **A real week only**: the review's verdict full or ok, and at least a day's work (`LADDER[at].day`). A named, kept pass;
  never a QA home. No four-week rest (unlike the citizens): the one banana who keeps the stand going IS its staff, and the
  plaque counts the weeks (`weeks`). The first week that can be crowned is `STAFF_FROM` = 2026-W40 (crowned Mon 5 Oct).
- **On the record**: `j.sotw` [{week, at}], server-owned; the job view says `sotw: { last, weeks }` for the job you hold,
  and the town's mirror keeps it (`work.seam.state().sotw`).
- **To build with the visuals** (Trym's call on the look): a plaque by each shop (the week's name and banana, from
  `/staff`), the boss's line to last week's winner (the `sotw.last` moment, like the promotion), and HQ's read of it.
- ✅ **Built 24 Sep: the telling** (no new art — the promotion's grammar). While a crown waits to be told, the work note
  and the staff card say the boss has news (`news.*`); the boss's card leads with `promoQ`, the boss says `sotw.<boss>`,
  the card closes by itself, then STAFF OF THE WEEK goes up (`sotwMoment`, `sotwLine` / `sotwAgain` with the count). Told
  once a crown per device (`tw-sotw-v1` = the week it was told in). The staff card keeps the count (`sotwCard` /
  `sotwCardOne`). town-work `sotwFor`, banana-town `crownedMoment`; walk: tests/town-sotw.spec.mjs. Still Trym's: the
  plaque's look, and whether HQ reads the crowns.

Proof: worker-pass/test/staff.test.mjs (13), jobs.test.mjs §27.
