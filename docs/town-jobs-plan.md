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
another boss, which makes it a decision rather than an income stream. (**TRYM**: he asked "what
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

Pip's existing shelf card **stays tappable at the door** — the room is a gain, never a toll, and
no shopper is charged a walk for something that already shipped.

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
    **Still to come in this group:** the store's restock chore and the café counter.
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
