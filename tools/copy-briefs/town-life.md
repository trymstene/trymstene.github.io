# The job — the words Banana Town's LIFE needs

The town has a condition now. A shared number nobody sees drifts up and down with storms,
Curse Nights and the care of whoever comes by, and the town shows it: lamps lit or dark,
shutters up or down, litter, crows, a dry fountain, visitors, lanterns. Players put small
things right, buy things for their homestead at Pip's counter, meet a travelling stall on a
good day, and on a Curse Night walk into a dark square with ghosts in it, cursed objects on
the ground and a vendor who only trades at night.

The systems run without a single word. These are the few words they need, and they appear
in exactly the places below. Everything else in the town is silent by design.

## The five bands — the notice board's word for the town

The board is the ONE place the town's state is named. Five bands, keys fixed, worst first:
`abandoned`, `struggling`, `recovering`, `lively`, `thriving`. For each:

- `name` — the PLAIN word for the state, capitalised, exactly these five in order: Abandoned,
  Struggling, Recovering, Lively, Thriving. (The evocative names were bad copy — Trym, 15 Sep:
  a newcomer must read the state at once.)

- `brings` — what this state BRINGS, written as the promise the board makes for the state
  above the town's: what it opens, lights or fills (the shutters up, the lamps lit, the
  lanterns, the visitors, the rare shelf, the travelling stall). A fragment of a few words,
  no number.

Worst band: the lamps are out, the kiosks are shut, there is rubbish and there are crows,
the fountain is dry. Best band: everything lit and open, lanterns at the stalls, visitors
in the square, a travelling stall some days.

## Pip's counter — the General Store

Pip sells things for the player's HOMESTEAD: flowers, bushes, benches, lanterns, a statue on
a good day. The shelf is drawn from the homestead's own catalogue and changes every day
with how the town is doing. Coins (the game's own, never money). A piece lands in the shed
at home, or goes on the van and arrives later.

- `greet` — the line at the top of the shelf. Pip's voice (see the character bible: the
  uncle's note, *everything is the last one*). One breath.
- `shut` — the line shown INSTEAD of the shelf when the town is so far down that the store
  is shut and Pip is indoors. Not an apology; it should make a player want to fix things.
- `needs` — a short note on a row the player cannot buy yet because their house is not big
  enough for it. The game already shows a lock; this says why in four or five words.
- `van` — a short note on a row that arrives by van rather than at once. Three or four words.
- `sold` — three to five lines said when somebody buys. MUST contain `{item}` — the game
  puts the thing's name there, in lowercase.

## The notice board

- `title` — the board's heading, one or two words.
- `intro` — the FIRST notice, pinned above everything, for a banana who has just walked in and
  knows nothing (Trym, 15 Sep: "players haven't understood what the town's about yet"): this
  square is shared by every player; things here break; you fix one by walking up to it;
  every fix lifts the square for everyone. Two short sentences at most.
- `todo` — the small heading over the list of what wants doing today (the game writes the
  list itself from `things`, below). Two or three words.
- `nothing` — shown instead of that list when the player has fixed everything on it today.
  One short line; tomorrow brings more.
- `fixes` — the label under the first number: how many things were put right in the town
  today, by everyone. Two to four words, no number in the label.
- `people` — the label under the second number: how many different bananas did that today.
- `found` — the label under the third number: cursed objects this player has found, out
  of all of them. Two to four words.
- `next` — the one or two words before the next state's name on the bar under the five
  lamps, like a signpost.
- `health` — the label over the big number on the health card: what the number is, the
  way the park's card says "park health". Two words; Trym's own word for it is "town health".
- `curse` — ONE sentence, the standing notice on an ordinary day: some nights the square is
  cursed — the lamps go dark, the kiosks shut, ghosts wander and undo things. Never when.
- `omen` — pinned when a night is coming: the signs a player can see right now (crows on
  every perch, a ghost by daylight, the sky wrong at the edges). A warning, not a time.
- `night` — pinned while a Curse Night is on: keep to the lit lamps, the night stall
  trades, what lies about may be taken.
- `after` — pinned the morning after: what the night cost the square, and that today
  needs hands.

## What wants doing — `things`

The board lists the player's own open list in plain words, built by the game from these:
for each kind, `[one, many]` — the singular with its article ("a dark lamp"), the plural
with `{n}` ("{n} dark lamps"). Words a newcomer sees at once; nothing clever.

- `lamp` — a dark street lamp
- `litter` — rubbish on the cobbles
- `bin` — a street bin overflowing
- `dumpster` — a dumpster open and full
- `graffiti` — a tag on a shopfront
- `fountain` — the fountain run dry
- `shutter` — a kiosk with its shutter down
- `crows` — crows on a bench or a roof
- `leaves` — leaves the storm left

## The sign on a shut kiosk — `shutSign`

One word, on a little red square hung in a shut kiosk's window: the word a shop hangs on its
door when it is not open. Nothing else.

## The sign on the Coffee Cup — `forSale`

The café is for sale until the day it can be bought (docs/town-cafe-plan.md). A big red sign
hangs on it: two words, the way a shop window says it. Nothing else.

## The travelling stall

A stranger with a stall, in the square on good days only, with pieces Pip never carries at
a higher price. Not a resident: no persona sheet, no name a player will learn — give them a
name for the card that reads as a trade, not a person (the way a stall is named).

- `name` — the card's heading.
- `greet` — one line at the top of the shelf.
- `lines` — three to five lines said on a sale (`{item}` allowed, not required).

## The night vendor

Only on a Curse Night, at the monument, in the dark. Trades a short shelf cheaply and BUYS
cursed objects back. Odd, unhurried, at home in the dark; never frightening, never a
villain. Nobody knows where they go in the morning and the vendor does not say.

- `name` — the card's heading.
- `greet` — one line at the top.
- `bought` — said when the vendor buys a cursed object from the player. MUST contain
  `{item}`.
- `lines` — three to five lines said on a sale (`{item}` allowed, not required).

## The ghosts

On a Curse Night ghosts drift about the square. They are curiosity, never danger: one sits
on a bench and will say something if you walk up and tap it. Write `ghosts`: four to six
lines a ghost might say. Small, odd, a little sad or a little funny, never a threat, never
a riddle for the player to solve, never a question expecting an answer. A ghost may mention
the fountain, the statue with no plaque, the bench, the lamps — things in the square.

## Closed today

Some days a front is shut for a reason, and a player who taps its door reads why. One line each,
the way a note taped to a door reads: ordinary, specific, sometimes funny. Fixing whatever it is
reopens it, so the reason has to be something a person could put right.

⚠️ **EXACTLY THREE FRONTS IN THIS TOWN CAN SHUT, and a reason hangs on ITS OWN front and no
other.** This used to be one flat deck of six lines picked by the day, and a player who tapped the
general store was told the coffee propeller needed a bolt — while two of the six named buildings
that can never shut at all. Write three separate decks of three or four lines:

- `closed.cafe` — **the Coffee Cup**, Bean's coffee kiosk. Faults a coffee kiosk has: the machine,
  the propeller, the beans, the water, the little hatch.
- `closed.info` — **the info point**, Dot's map-and-noticeboard kiosk. Its own faults: the map, the
  glass, the leaflets, the light inside it.
- `closed.store` — **the general store**, Pip's shop, which sells fireworks, lures and duck bread.
  Its own faults: a delivery, the till, a shelf, the cellar.

**Never name the arcade and never name the post office.** Those two can never shut — the arcade
because five shipped games must answer on a stranger's worst day, and the post office because the
mail never stops. A line that names them is a lie on a door.

## The cursed objects

Ten ordinary things that turn up on the ground on a Curse Night, each slightly wrong. The
player takes one home, where it is the ordinary object again. Ids FIXED; write for each:

- `name` — two or three words, the name it would have in a collection. Not the decor's
  plain name (that is `lantern2` = a tall lantern, and the name should be more than that).
- `desc` — one line: what is wrong with it. Cosmetic, specific, a little unsettling and a
  little funny, never harmful.

| id | the ordinary thing | what it does on the ground |
|---|---|---|
Each `desc` is read in a player's collection, and it must SHOUT the curse: what the thing
does that no ordinary one does, said outright and exaggerated, clear at first read — never a
hint or a half-said mood (Trym, 15 Sep, on “always turned toward the road home, even after
being moved”: “what does this copy even mean?”). Funny is welcome; harmful never.

| `humlantern` | a tall camping lantern | it hums |
| `coldfire` | a campfire | it flickers, but gives no warmth |
| `stillbear` | a teddy bear, left on the cobbles | it is always turned toward the road home |
| `lostpack` | a backpack | it is full, and nobody dropped it |
| `coldurn` | a white vase | the flowers in it never wilt, and nobody put them there |
| `redcap` | a patch of mushrooms | they flicker |
| `tinwalker` | a wind-up toy robot | it is somewhere else each time you look |
| `emptymirror` | a standing mirror | it shows the square, without you in it |
| `stoppedclock` | a grandfather clock | it stopped at an hour the town does not have |
| `lastlamp` | a camp lantern | it hums, and stays lit |

## `lowShut` — a door the TOWN closed

`closed` is a one-day fault with a name: a bolt, a split hose, a stuck scale. Somebody will
see to it. **`lowShut` is the other thing entirely**, and since 19 Sep it is what a player
meets most: when Town Health is on the floor the square cannot keep its shopfronts open at
all, and the café, the info point and the general store stand dark behind tape.

Three or four lines. Each one has to do a job the game has nowhere else to do it:

- say the reason is the SQUARE, not this one shop — nothing here is anybody's fault
- say it comes back, and that hands are what bring it back. A player who fixes things in
  the square lifts the town for everybody, and the doors open again
- never a number, never a rate, never how long, never a question. The town does not publish
  a timetable and never has

Write them as the door speaks, or as a passer-by would say it. Not a system message, and not
an apology either — this town has been through worse.

## `rooms` — stepping through a door

The town has interiors now: the Arcade, and Pip's general store. A room is ONE SCREEN — the
square goes dark behind it and the room's own plate floats where the building stands.

⚠️ **THE LINE IS THE PLACE TALKING, NOT A HELP STRING.** Both of these used to end with the same
seven words about walking back onto the doorway, which made them the only tutorial voice left in
the town — and the doorway is a LIT FLOOR TILE at the bottom middle of the room that already says
it. So do not explain how to leave, and do not mention the doorway at all.

Write what it is like to be standing in there, in the room's own way. `rooms.condo` is the arcade:
cabinets along one wall, a prize board, coins going in. `rooms.store` is Pip's shop: the counter,
and shelves that are bare or full depending on how the town is doing. **The two must not share a
clause, a rhythm or an ending** — two rooms saying one sentence is a help string. One sentence
each, or two short ones.

`rooms.in` is different: it is a BUTTON on Pip's shelf card, out on the street, and it is what
takes a shopper inside. A verb first, two or three words, no full stop. Buttons in this world
never wrap on a phone, so it has to be short.

The shelf stays on the card at the door either way — the room is something you may do, never
something you must do to shop.

## `locks` — a building the story has not opened yet

The town has TWO kinds of closed door and a player must be able to tell them apart at a glance,
without reading anything.

`closed` and `lowShut` are the TOWN'S lock: a shut shopfront behind hazard tape, because the
square is having a bad day. Hands fix it.

`locks` is YOUR lock, and it is a different thing entirely: a red worksite fence across the
front and a signpost to tap. **The building is not built for you yet, and the story opens it.**
It is not broken, nobody is at fault, and no amount of tidying the square will change it.

Five lines:

- `store`, `post`, `cafe` — **what that building will be**, one line each, said at a boarded
  front. Not what it is now; it is a worksite. Make it worth waiting for. The general store is
  Pip's; the post office is where letters and postcards go; the Coffee Cup is a café you can
  work in one day.
- `story` — the one line that says the STORY opens this, not the town's health and not money.
  This is the difference between a sign that says no and a sign that says *soon*, so write the
  second one.
- `step` — how far along the player is, and it MUST hold `{n}` and `{of}` (a number and a
  number, as in 2 and 4). A locked door that only refuses is a dead end; this line is the half
  that makes it a hook.

## `work` — asking a boss for a job

Three residents can hire you: Pip at the general store, Spinner at the arcade, Bean at the Coffee
Cup. You ask the way you ask them anything else — you walk up, you tap, and the question is on
their card beside the two they already answer. `work.ask` is that question, and it is in the
PLAYER'S voice.

`work.at` is the three buildings' names as they fit INSIDE a sentence — they are dropped into
`{where}` in `hired` and `moved`, so “Gladly, {where} could use your hands” has to read as one
line. Not the sign planks, which shout, and not a key.

⚠️ **`{where}` IS LOWERCASE AND CARRIES ITS OWN ARTICLE, so it may never start a sentence.**
“Gladly. {where} could use your hands.” shipped, and for two of the three bosses it printed a
sentence beginning with a small letter — “Gladly. the Arcade could use your hands.” Keep the
holder inside a clause: a comma, a dash, anything but a full stop in front of it.

**One job at a time.** Taking a second is leaving the first, which is why `moved` exists and why
it must read as a decision the player made rather than a rule they broke.

**`keep` is the delicate one.** Wages need a kept pass, because a pass that can be minted again in
one tap is not a person. The line must be an INVITATION — here is a thing you could keep — and
never a punishment, never a rule quoted at somebody, and never in jargon: this world has no
“accounts” and nobody is “anonymous”, they just have not kept their pass yet.

`work.keepCta` is the BUTTON that appears under that answer, and it is the whole of why the answer
is no longer a dead end: it opens the page where a pass is kept. A “no” with nothing to tap is
where a newcomer puts the phone down. A verb first, two to four words, no full stop, short enough
that it can never wrap on a narrow phone. It is the player's own next step — not an instruction
from Pip, Spinner or Bean.

### The restock chore

Working at the general store is mostly quiet, with one thing to do: a stack of crates by the wall,
a run of shelves with nothing on them, and a slow walk between the two. **The reward is the shelf.**
The face fills, and the row is on the till ten steps away before you leave. No coins change hands
for it — the cheque is a separate thing that arrives later — so `stocked` must never mention money
or a number.

`crate` is the lift. The banana walks slower while carrying, and that weight is the whole feel of
the chore, so let the line be about picking something heavy up. Do NOT instruct: no “now carry it
to the shelf” and no arrows. A shelf with nothing on it says that by itself.

`full` is for a shop already stocked to the last face. It is contented, not a refusal — being told
the work is done is a nice thing.

`day` is said at most once a day, when turning up at your own workplace is noticed. It should feel
like being seen, not like a notification.

Nothing here mentions money, a rate, a day of the week or a number. What the week pays is the
cheque's business, and the cheque is a letter that arrives later.

## How this reads

Everything in the voice guide holds. The board is the town's voice; Pip, the stall, the
vendor and the ghosts have their own. Never a rate, never an interval, never a number in a
spoken line; never an emoji; a curly apostrophe. Nothing here asks the player a question.

## Return

`bands` (five, in the order above), `store`, `board`, `merchant`, `vendor`, `ghosts`,
`closed`, `lowShut`, `rooms`, `locks`, `work`, `objects` (ten, ids as above, in that order).
