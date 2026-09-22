# Banana Town — the lemonade stand

The lemonade stand is a small stall on Hall Street in Banana Town, north of the fountain, and Fig Jr.
runs it — a kid from the Bunch who was handed the stand when he could carry a jug. A player who has
asked Fig Jr. for a job can step behind the table and work it: townsbananas come up to the front of
the stand, you make each glass, and you are paid in tips when you step away. This job is the words for
that counter and nothing else — Fig Jr.'s own character, the hiring, and the town's toasts about the
square are all written already, elsewhere.

It is the Coffee Cup's counter with a lemonade deck on it, and the same five rules hold.

## What the player is actually doing

They tap the stand and their banana walks up and steps round the back of the table — feet behind the
counter, face in the gap under the awning. A tray rises from the bottom of the screen; the square is
still there above it, the customers, the street lamps, the mess. A customer's order shows on the tray
as PICTURES, never words: a lemon, a mint leaf, a splash of pink, ice. They make it with three
one-thumb gestures: hold and let go to squeeze the lemon, tap three times on the pulse to drop the
ice, stop a sweeping needle to pour the water to the line. The glass comes out **perfect**, **fine**
or **wrong** — the worst of the three gestures is the glass. Then the next customer steps up.

They can walk away at any moment. There are no shift times and nothing to be late for. Walking away
IS clocking out, and that is when the receipt appears and the tips are paid.

## The five rules this job lives under

1. **🤫 THE QUIET RULE. No banana in this world ever wears a speech bubble.** Not a customer, not Fig
   Jr., not the one who gives up and walks off. Everything here is the town's own toast (the world's
   voice, a strip at the top of the screen while the tray is up) or a card. When a field says "the
   town's toast", it means a line the WORLD says about what just happened — never a line a banana
   says out loud.
2. **Never a rate, never a clock.** No "per glass", no "every twenty seconds", no "4 coins each". A
   total in coins on the receipt is fine. A rate is not.
3. **The reward is not the point of the sentence.** A perfect glass is noticed, not celebrated; a
   wrong one costs the sale and nothing else, so there is no scolding and no correction anywhere.
4. **The customer's body does the acting.** They fidget, they turn their back, they walk off. The
   words never describe what their face is doing.
5. **Never instruct.** No "now squeeze the lemon", no arrows, no tutorial voice.

**It is not the café, and the words must not be the café's.** No propeller, no apron, no cups on a
shelf, no rope: this is a table with a jug on it, a sign that says LEMONADE, a striped awning, lemons,
ice, a lane, the sun. A glass, not a cup. Fig Jr. is a kid — the stand has his cheer about it, but he
never speaks here.

## The fields

### Stepping behind the counter, and stepping away

`on` is said as the banana steps round the back of the table and the tray rises. The feeling of the
stand opening for the afternoon — not an instruction and not a greeting to anybody.

`off` is said as they step away, just before the receipt opens. The stand is quiet for now.

### The receipt

A card, the moment the shift ends. `receipt.title` is its heading, two or three words, a NAME for the
paper. `receipt.take` is the one measured line that names what the tips came to; it MUST contain
`{n}`, where the game puts the number of coins. `receipt.line` is the single line under it — the
stand as you left it, the jug, the lane. `receipt.none` replaces the take when the shift served
nothing at all: contented, never a telling-off. `receipt.capped` replaces the take when glasses WENT
OUT but the day's tips were already spent — the work happened and the coins did not; not a refusal,
never a number, never a cap, never "come back tomorrow" as an instruction. `receipt.best` is one line
under the take, shown only when at least one glass came out RIGHT, and it NAMES that drink: it MUST
contain `{drink}`. `receipt.back` is the button that closes the card: a verb first, short enough
never to wrap.

### The front of the stand, to somebody who does not work there

`front` is what the stand says when a player who has NOT been hired taps it. ⚠️ it replaces a
hand-written line that ended "Not built yet." and is no longer true: the stand is open, Fig Jr. is
behind it. So this line is what the place IS and that the counter belongs to somebody — the way you
would describe a stall you walk past every day. It does not instruct, it does not name a price, and
it does not say how to get a job: Fig Jr.'s own card is where that is asked for.

### A quiet stand

`idle` is the small line on the tray when you are behind the counter and there is nobody at the front
yet. It is the ONLY thing on an otherwise empty tray, so it tells the player the stand is open and
simply quiet, rather than broken. Never a wait time, never "soon", never an instruction.

### The button on the tray

The tray has exactly one button and the thumb lives on it. What it says changes with the station:
`go.squeeze` while the lemon is held and let go, `go.ice` for the three taps on the pulse, `go.pour`
while the needle sweeps the glass to its line. One word each, the THING BEING DONE — a label on a
control, not an instruction. Short enough never to wrap on a 360-wide phone. ⚠️ the drink's NAME
must not appear here.

### The glasses

Three decks of three or four lines each, one picked per glass, so a long shift does not repeat. These
are the town's toast. `cup.perfect` — it came out right; notice the GLASS, or the customer taking it,
never praise the player. `cup.fine` — good enough, and off it goes; approving, never a correction.
`cup.wrong` — not a good glass, and it costs the sale and nothing else; no blame, no number, no
advice.

### The one who gives up

`left` is the town's toast when somebody has waited too long at the front, turns their back and walks
off. ⚠️ **They have no name.** The customers are bananas visiting the square, strangers off the road:
"somebody", "the one at the back", or the front of the stand going quiet. A small sadness, never a
failure notice, never how long they waited.

### The drinks

`drinks.still`, `drinks.minty`, `drinks.pink` — the three the stand pours: plain lemonade over ice;
lemonade with a mint leaf; pink lemonade. NAMES, one or two words, for the receipt only. They should
sound like a kid's stand in this town rather than like a menu — nobody here says "artisanal".
