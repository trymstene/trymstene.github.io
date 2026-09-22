# Banana Town — the post office, and the letters inside it

The post office is the big grey building on the north side of Banana Town's square, with a blue
mailbox by its door and Stamp standing outside. It is where a banana's post lives: letters other
players have written to you, and the ones you write back.

This is the first thing in Banana World where one player's words reach another player. That fact
shapes every line in this job.

## What the player is actually doing

They tap the building and a card opens: their own mailbox. A short stack of letters, newest first,
each one a piece of paper with who it came from and what it says. Tapping one opens it. Under an
open letter there are two things they can do — write back, or report it.

Writing back is a sheet of paper and a button. There is no address to fill in: you are answering
somebody who wrote to you, so the game already knows where it goes.

## The five rules this job lives under

1. **NOBODY IS ON DUTY.** Stamp stands outside and has his own card; the mailbox card has no
   clerk, no greeting and no voice. It is a place, not a person.
2. **A REFUSAL NEVER SAYS WHY.** When the filter stops a letter, the writer is told it did not go
   and nothing else. A precise reason — "no web addresses" — is a lesson in how to get round the
   filter on the next attempt. ⚠️ this is the hardest line in the job: it has to be kind, final, and
   completely uninformative, and it must not imply the writer did something wicked, because most
   refusals will be somebody innocent who typed a shop's name.
3. **Never a rate, never a clock, never a count of anything the game controls.** No "3 of 12 letters
   today", no "you may send 12 a day", no "expires in 30 days". The mystery rule: this world does
   not publish its timetables. A count of the letters in your own box is fine — that is yours, not
   ours.
4. **Reporting is a normal thing to do, not an accusation.** Anyone might report anything; the
   button and its confirmation are matter-of-fact and brief. Never "are you sure", never "this user
   will be punished", never anything that makes the reader feel they have started something.
5. **Short.** This card is 261 pixels wide on the narrowest phone the house supports. Every line
   here sits in that, and every button label sits on ONE line inside it — buttons in this world
   never wrap.

## The fields

### The building

`front` is what the post office says when a player taps it. ⚠️ it replaces a hand-written line that
ended "Not built yet.", which is no longer true: there is a mailbox in there with post in it. So:
what the building IS, and that your post is inside. It must not instruct ("tap to open"), must not
promise anything that is not there, and must not mention postcards — those are not built.

### The mailbox

`title` is the heading on the card. Two or three words, a NAME for the thing — what you would call
the place your letters sit.

`empty` is the whole of the card when there is no post at all. One or two short lines. ⚠️ an empty
mailbox is the state MOST players will see for a long time, so this is the single most-read string
in the job: it has to be a pleasant place to land rather than a failure. It may not promise that
post is coming, and it may not tell anybody to go and write one.

`noaddress` is the whole of the card for a player who has **no address yet**. A mailbox in this world
is keyed to your homestead's sign name — the one on your fence — so a player who has never claimed a
yard has nowhere for a letter to land. ⚠️ THIS IS NOT THE SAME AS THE COUNTER BEING CLOSED, and it used
to print that line, which is a lie: the post office is fine, the player has no door for it to reach.
⭐ IT IS A DOOR, NOT A REFUSAL — the same rule as a locked garment on the dressing room's rail. It says
plainly that post goes to a house and that the player has not put a name on one, and it names the
homestead as the place that fixes it. It may not instruct ("go and claim one"), may not promise post is
waiting, and may not make the player feel they have done something wrong: most people reading this
simply have not been to the homestead yet.

`shut` replaces the letters when the post is not running at all. It is a temporary, ordinary thing —
the counter is closed, come back — and it is not an error and not an apology. Never "server", never
"down", never "error", never a time.

`from` is the small label over who a letter came from. One or two words, and it MUST contain
`{who}` — the game puts the sender's name there.

`threads` is the small heading over the older post, under the new envelopes. Under it sits one row
per person you have letters from — not one row per letter — so a mailbox with sixty letters from
eight people is eight rows rather than sixty. One or two words, the way you would label a drawer of
kept correspondence. It is set in capitals by the stylesheet.

`back` is the button that goes back up a level — from an open letter to the list, or from one
person's letters to the mailbox. A verb first, one or two words, one line, and it has to make sense
in BOTH of those places.

### An open letter

`report` is the button under an open letter that reports it. A verb first, two or three words, and
plain: this is a normal thing a person might do.

`reported` is the one line the world says after they tap it. The letter is gone from their box and
somebody will read it. Matter-of-fact and brief — it must not thank them, must not praise them, and
must not say what will happen to the sender, because we do not know yet.

`reply` is the button that opens the sheet to write back. A verb first, two or three words.

### Writing back

`sheet` is the one small line at the top of the writing sheet, above the paper. It says who the
letter is going to and MUST contain `{who}`. Nothing else — no instruction, no encouragement, no
word count.

`send` is the button that sends it. A verb first, one or two words, and it must sit on one line.

`sent` is the world's line once a letter has gone. Quiet and done — the feeling of a letter dropping
into a box, not a receipt. Never "successfully", never "delivered".

## The postcard

A postcard is the other thing the post office sends, and it is a different animal from a letter: it
is a PICTURE, a PICKED line and a stamp. The picture is one of three places with the sender's own
banana standing in it — the park's fountain, your own gate on the road, or the rave. Nothing on it is
typed. The sender chooses a place and chooses a line off a rack; the receiver's own game draws it.

⭐ THAT IS WHY THE DECK MATTERS MORE THAN ANY OTHER FIELD IN THIS JOB. It is the entire vocabulary
of every postcard anybody will ever send, forever. Eight lines have to cover "thinking of you",
"come and see this", "I was here", and the small dry ones — and every one of them has to work under
ALL THREE pictures, because the sender picks them separately and will pick the funny combination on
purpose.

`card.title` is the heading on the sheet where you make one. Two or three words, a NAME for the
thing you are making, not an instruction.

`card.places` is the three place names under the three pictures — `park`, `home`, `rave`. One or two
words each, the way a postcard prints the place at the bottom of the picture. ⚠️ these are PLACES
this world already names: the Park, your own homestead, the Banana Rave. Title them, do not rename
them. `home` is the player's own, which the word may acknowledge.

`card.lines` is the deck: EXACTLY EIGHT, one per line, and the sender picks one.
  · Each one is a whole postcard's worth of words — short, the way you write on the back of a card
    with somebody standing behind you in the queue.
  · ⚠️ EVERY LINE MUST WORK UNDER EVERY PICTURE. "Wish you were here" works at the park, at a gate
    and at a rave. "The flowers are out" only works at one, and picked at the rave it reads as a
    mistake rather than as a joke.
  · ⚠️ NOBODY IS NAMED and nothing is asked. There is no reply box on a postcard, so a line that
    asks a question is a question that can never be answered.
  · They must not sound like eight ways of saying one thing: some warm, some dry, one or two that
    are funny because they are so flat.
  · No emoji, and nothing that needs a name, a number or a date to make sense.

`card.send` is the button that sends it. A verb first, one or two words, ONE line.

`card.sent` is the world's line once it has gone — the feeling of a card dropping in, not a receipt.
It may not repeat the letter's own `sent` line word for word: two different things happened.

`card.got` is the small label over a postcard in your mailbox, saying who it is from. It MUST contain
`{who}`. ⚠️ it is NOT the letter's `from` label: a letter is from somebody, a postcard was SENT by
somebody from somewhere, and the line may notice the difference.

`refused` is what the writer sees when the filter stops it. See rule 2: kind, final, and completely
uninformative. It names no rule, no word and no reason, and it does not suggest what to change. It
must not sound like an accusation — most people who see this typed something ordinary.

---

## 📇 The address book — how a FIRST letter gets written (21 Sep 2026)

Until now the post office was **reply-only**: "Write back" hangs off a letter you already have, and
nothing in Banana World ever wrote the first one. A new player opened the mailbox, read that there
was nothing in it, and had no way to send anything to anybody. Trym, 21 Sep: *"i must be able to
actually send a letter for the first time… Other users in banana world shouldnt have to run code in
their console the first time they send a letter?"*

So there is now a button at the bottom of the mailbox that opens **the address book**: a searchable
list of everyone who has a Pass and a Homestead and still plays, one row each — their banana drawn
small, their name, and the name of their house under it. You tap a person and the writing sheet
opens addressed to them.

**What the words here must and must not do:**

1. **It is a book of PEOPLE, not a feature.** Nothing in these five lines may sound like a system:
   no *directory*, no *users*, no *results*, no *search results*, no *profiles*, no *database*.
   These are neighbours with houses.
2. **Never explain the rule.** Who is in the book (a Pass, a Homestead, somebody who has been about
   lately) is the world's business, not the player's — the mystery rule. No line may say why
   somebody is or is not listed, and no line may name a number of people.
3. **Two different emptinesses, two different lines.** `empty` is *nobody is in the book* — a small
   world on a quiet day, and it must not read as a fault or as a sadness. `none` is *your search
   found nobody*, which is about the word they typed. They may not share a sentence.
4. **Nothing is owed and nobody is waiting.** No line may suggest that somebody wants post, that
   writing is a kindness the player ought to perform, or that anyone will reply.

---

## ✉️ The sorting round — the post office's own job (22 Sep 2026)

Stamp hires now, the way Pip, Spinner and Bean do (`town-life` `work.ask`). The duty is **a round
of sorting** at the counter. The mailbox card carries one more button for the post office's own
staff; your banana walks to the counter, and a tray rises from the bottom of the screen — the
café's tray, with a different deck on it. Cards slide onto the counter one at a time, each with one
of four postmarks (a flower for the park, a fish for Banana Bay, a house for the homesteads, a note
of music for the Banana Rave — pixel stamps, no words), and four pigeonholes behind the counter
wear the same marks. You tap the right hole. Sorted fresh, a card is right; the right hole after a
while is late; the wrong hole, or nobody at all, is wrong. Twelve cards or two minutes, then the
counter hands you a receipt — and a round where enough of the pile went where it was going is on
the week's sheet (the work note says *post sorted 1/3*), paid on the weekly payslip like the
store. It never touches a real letter: delivery is instant, the sort is theatre.

**The fields** (`round.*`):

- `start` — the button on the mailbox card, staff only. A verb first, two or three words, one line.
- `on` / `off` — the town's toast as a round begins, and when one ends because you walked away or
  stepped into a shop. They notice; they never instruct (no "tap", "match", "sort the…") and
  carry no number.
- `far` — the toast when the round is asked for but the banana is not at the counter (the walk from
  the card stopped short): the counter is a step away and waits. Notices, never instructs, no number.
- `holes.park` / `holes.beach` / `holes.home` / `holes.rave` — the four places' names as the post
  office writes them on a pigeonhole, read out to somebody who cannot see the stamp. One or two
  words, titled: the park, Banana Bay, the homesteads (everybody's own plot), the Banana Rave.
- `receipt.title` — a name for the paper the counter hands you. `receipt.take` — the result line:
  MUST contain `{n}` (cards that went straight to the right hole) and `{of}` (the pile) exactly
  once each, and no other number. `receipt.counted` — enough went right: this round is on the
  week's sheet, Stamp has it down. `receipt.short` — too little went right: this round is not on
  the sheet, and the counter is there again in a moment; never cruel. `receipt.back` — the one
  button that puts it away.

**The rules the round lives under:** no numbers in the prose (the game prints the round's figures);
never a question; never a control named; never "reward", "bonus" or "prize" — a wage is a wage.
