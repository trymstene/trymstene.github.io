# Banana Town — the Coffee Cup's counter

The Coffee Cup is a kiosk on the square in Banana Town, and Bean runs it. A player who has asked
Bean for a job can step behind the counter and work it: townsbananas come to a rope along the lane,
you make each cup, and you are paid in tips when you step away. This job is the words for that
counter and nothing else — Bean's own character, the hiring, and the café's closed-up front are all
written already, elsewhere.

## What the player is actually doing

They tap the counter and their banana walks behind it. A tray rises from the bottom of the screen —
the square is still there above it, the queue, the street lamps, the mess. A customer's order shows
on the tray as PICTURES, never words: a bean, a splash of milk, a cap of foam. They make it with
three one-thumb gestures: stop a sweeping needle on the grinder, hold and release the pour, tap
three times on the milk's pulse. The cup comes out **perfect**, **fine** or **wrong** — the worst of
the three gestures is the cup. Then the next customer steps up.

They can walk away at any moment. There are no shift times and nothing to be late for. Walking away
IS clocking out, and that is when the receipt appears and the tips are paid.

## The five rules this job lives under

1. **🤫 THE QUIET RULE. No banana in this world ever wears a speech bubble.** Not a customer, not a
   resident, not the one who gives up and walks off. Everything here is either the town's own toast
   (a yellow strip at the bottom of the screen, the world's voice) or a card. When a field says
   "the town's toast", it means a line the WORLD says about what just happened — never a line a
   banana says out loud.
2. **Never a rate, never a clock.** No "per cup", no "every twenty seconds", no "a two-minute
   shift", no "4 coins each". The mystery rule: this world never publishes its timetables or its
   rates. A total in coins on the receipt is fine. A rate is not.
3. **The reward is not the point of the sentence.** A perfect cup is noticed, not celebrated; a
   wrong one costs the sale and nothing else, so there is no scolding and no correction anywhere.
   Nobody is told to try harder.
4. **The customer's body does the acting.** They fidget, they turn their back, they walk off. The
   words never describe what their face is doing — the screen already shows it.
5. **Never instruct.** No "now tap the grinder", no arrows, no tutorial voice. A shelf with nothing
   on it, a rope with somebody standing at it and a tray that just rose are the instructions.

## The fields

### Stepping behind the counter, and stepping away

`on` is said as the banana gets behind the counter and the tray rises. It is the feeling of
starting a shift — the apron going on — not an instruction and not a greeting to anybody.

`off` is said as they step away, just before the receipt opens. The work is over for now.

### The receipt

A card, the moment the shift ends. `receipt.title` is its heading, two or three words.
`receipt.take` is the one measured line that names what the tips came to; it MUST contain `{n}`,
where the game puts the number of coins. `receipt.line` is the single line under it — the terrace
as you left it, the cups that are still warm, the quiet after. `receipt.none` replaces the take when
the shift served nothing at all: contented, never a telling-off, because standing behind a counter
on a slow afternoon is a perfectly good thing to have done. `receipt.back` is the button that closes
the card: a verb first, and short enough that it can never wrap onto two lines.

### The cups

Three decks of three or four lines each, one picked at random per cup, so a long shift does not
repeat. These are the town's toast.

`cup.perfect` — the cup came out right. Notice the CUP, or the customer taking it, rather than
praising the player. Warm, brief, a little pleased with itself.

`cup.fine` — good enough, and out it goes. One notch down from perfect: approving, never a
correction, never a hint about what would have been better.

`cup.wrong` — it is not a good cup, and they take it anyway or they do not. It costs the sale and
nothing else. No blame, no number, no advice. This world is fond of the people in it.

### The one who gives up

`left` is the town's toast when somebody has waited too long, turns their back and walks off. It
MUST contain `{who}`, where the game puts that banana's name. It is a small sadness, not a failure
notice, and it never says how long they waited or what it cost.

### Bean's counter, on Bean's own card

`ask` is the question the PLAYER presses on Bean's dialogue card to ask about working the counter.
It is the player's voice, not Bean's, it ends in a question mark, and it sits beside the questions
that are already there — so it is about the same length and pitch as "Any work going?".

`bean` is Bean's answer: what the counter is, and that you stand behind it to work it. Bean reads
fortunes in coffee grounds and is not entirely joking about it; that habit is theirs to use here if
it helps. Bean never explains the gestures and never gives a number.

### The drinks

`drinks.short`, `drinks.tall`, `drinks.double` — the three the shop sells. These are NAMES, one or
two words, and they appear on the receipt and nowhere else: the ticket on the tray is pictures. They
should sound like this town rather than like a chain — nobody here says "grande".
