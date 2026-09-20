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

`refused` is what the writer sees when the filter stops it. See rule 2: kind, final, and completely
uninformative. It names no rule, no word and no reason, and it does not suggest what to change. It
must not sound like an accusation — most people who see this typed something ordinary.
