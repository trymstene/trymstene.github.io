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
3. **The honest tension.** Trym's warning — *not too generic and 'mini-gamey'* — is the thing
   this plan is most at risk of failing. It adds a cup minigame, a restock chore, a floor chore
   and a delivery round, and it defers the one part that is not a minigame: players writing to
   players. See §6 and the decision in §8 about bringing the postcard forward.

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

⚠️ **Measure first.** Chapter 2 sits behind chapter 1's sixteen steps. **What fraction of
players finish chapter 1 is measurable from Pulse today and unknown.** If it is small, this plan
boards up the town for almost everyone. Do that measurement before step 1. (**TRYM**)

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
| **The Post Office** | Stamp | The round: carry the world's mail to real players' yards | Per round, and **never coins** (see §6) |

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
  refused): `RULES.town.tips` (the café), `RULES.town.round` (the post round),
  `RULES.homestead.wage` (the cheque — the mailbox is at the homestead and `areaOf()` reads the
  path). Plus `JOB_PAY`, `PAY_BACK = 2`, and `POST /job/take`, `/job/chore`, `/job/pay`.
- Rough weekly shape: the store's cheque around 90, the arcade's around 60, the café's tips
  2–6 a cup, the round about 12. **Every number is Trym's thumb; the mechanism is not.** (**TRYM**)
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

### A — In chapter 2: the round (zero player-authored text)
You take Stamp's bag and walk a round to **three real players' real yards**, read off the doors
feed. Tomorrow, three strangers find something in their homestead mailbox that somebody's hands
put there. The letters are the **world's own** rig-written mail with a `{name}` slot. **The
residents always write back the next morning** — this is load-bearing, not a bonus: at eight
players online it is what stops the post office being a ghost.

### B — Its own project, after: the postcard
Four indices and a stamp: a picture, a line you **pick** from ~48 rig-written lines across six
moods, and your house name. **There is no text field, so there is nothing to moderate** — the
copy rule (GPT writes the words) becomes the safety mechanism itself. Addressed to houses, not
people. A card from a house you have never accepted arrives as a **knock** (a name and a stamp,
nothing else) and you accept the house once. Block sits on the closed view before anything is
opened; report auto-blocks. A pair cap of about three a week. A single POST behind a launch key
turns the whole channel off **from Trym's phone, without a deploy**.

**Before one card is sent, all four of these must exist** (none do today):
1. The three live worker-rave defects fixed (see §9).
2. A **report queue** — there is none anywhere in the repo, while `/community/` promises "anything
   reported is read by me, Trym".
3. The kill switch.
4. `/privacy/` corrected — it currently says the pass never leaves your device, which becomes
   untrue the first time anything is delivered.

### C — Free-typed letters: a different product, not a later phase
The adversarial review's verdict, and I agree with it: at 30–80 letters a week, pre-reading is
10–15 minutes **every day forever**, and **the week Trym is away it dies** — 200–500 letters
queue, delivery stops, and the backlog gets bulk-approved, which is worse than no queue at all.
The unavailability, not the abuse, is what kills it. If it ever ships it is mutual-consent
pen-pal between two players who have each accepted three of the other's cards, after B has run
eight weeks with fewer than three upheld reports, with an age statement and real legal advice.

---

## 7. The build order

Grouped; each line is roughly a session. **The store slice alone (server + data + room + chore +
one chapter step + copy + walk) is 6–8 sessions and is the honest first ask.**

**Before anything**
1. Measure chapter-1 completion in Pulse. It decides whether this plan is for everyone or for nobody.
2. Fix and deploy the three worker-rave defects (§9). Ships whether or not anything else does.

**The closed town**
3. Data only: `src/data/town/restore.js`, `CLOSABLE` widened, the band ladder, `PROBLEM_COUNT`.
4. Five surgical edits in `town-room.js` — ⚠️ it has **4 068 bytes left**; if it tips red, move
   the look into the new chunk, never shave.
5. Three greps in `check-design.mjs` before the features exist.
6. Five band screenshots at 393 px. **Trym's thumb.**

**The rooms**
7. `tools/room_builder.py` lifted out of both scene builders; `in-arcade.png` byte-identical.
8. Bake `in-store.png` at its emptiest; look at it before a line of client code.
9. `inRoom` refactor in `banana-town.js`; walk the arcade first and prove nothing changed.
10. The CSS `:not(.is-in)` fix and a design-library section "A ROOM IS ONE SCREEN".

**The jobs**
11. worker-pass: the rules, `JOB_PAY`, the routes; curl all three and paste the answers.
12. `src/scripts/town-work.js` — **one** new lazy chunk at 40 000 (it fits the 41 392 bytes the
    budgets have free; three chunks do not).
13. The copy jobs (`town-restore`, `town-work`) through the rig, the gate, the approve.

**Chapter 2**
14. The engine opened onto the town, `quest-c2`, both merge branches.
15. Store steps; then the pay rail end to end (⚠️ `state.mail[]` must be added to the yard body
    and **all three** save mirrors in one commit or the wholesale replace eats it silently).
16. Arcade steps. Then **STOP AND LOOK**: if Pulse says nobody took a job, the post office and
    the café are both wrong and the next session is about why. This gate is the most valuable
    step in the plan and the easiest to skip.
17. Post office steps and the round.
18. Café: rewrite `docs/town-cafe-plan.md` §1/§6 to the certificate, ship the **bench prototype**
    of the counter, let Trym's thumb pick, then the gestures.
19. Pulse readers, the stub walk, the town walk at 393 px.

**Then, as its own plan**
20. The postcard, gated on its four prerequisites.

**Honest total: 20–28 sessions. This is a quarter, not a feature.**

---

## 8. Decisions only Trym can make

- **Measure chapter 1's completion first?** (Strong recommendation: yes.)
- **One job at a time, or several at once with smaller sums?** (His words say several; both
  judges say one.)
- **"Monthly pay-check" or "each week"?** He wrote both. Monthly means a first cheque up to 30
  days after taking the job.
- **Do the machines actually break**, or is the arcade job the cheque plus the floor?
- **Does a job-holder walk through the tape** (a staff gap), or does a shut workplace mean no
  work that day? A staff gap quietly reverses "the worse the meter, the more workplaces closed".
- **Does the café still cost something**, and if not, what replaces the sink?
- **How bleak is Abandoned** — three shut fronts or five? Decide from the five screenshots.
- **Is the sticker shop (`print`) ever taped?** It is the one front that leads to real money.
- **Does the locked signpost show progress** ("two of four signatures"), or only the next step?
- **May a job-holder walk through their own workplace's tape?** (Same question as the staff gap,
  now that the two locks are separate.)
- **The numbers**: the two cheques, the tips, the round, the chore caps.
- **Chores pay in the room, or a small coin?**
- **Nib**: payroll desk only, or a job. **The Mayor**: unemployable, or the last boss.
- **Does the postcard come forward?** If the social layer is what he actually wants, items 3–19
  are a 15-session detour in front of it.

---

## 9. ⚠️ Three live holes, independent of this plan

Found while researching the safety of player mail. All three are live in `worker-rave` today:

1. **A claimed homestead name skips the family filter.** `/claim` never runs the name through
   `sanitizeName()`, and that name is the most public player-chosen string in the world.
2. **Guestbook text never sees `dirty()`** — the filter is compiled into the same file.
3. **The world-token gate is defeated by a fresh random id** (`pass === alt` skips the check),
   which defeats every per-day cap in that worker.

These want fixing whether or not one letter ever moves, and the fix is one session plus a deploy.

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
- Jobs currently never touch the town's best content (ghosts, Curse Nights, cursed objects), and
  working does not feed Citizens of the Week — the cheapest emotional payoff available and
  nobody proposed it. Worth adding.
- The guestbook already lets players leave text on each other's yards, unfiltered. **The risky
  social layer already exists; it is just unloved.**
