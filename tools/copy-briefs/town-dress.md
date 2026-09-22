# Banana Town — the clothes shop, and the dressing room behind it

There is a small shop on the north-west corner of Banana Town's square, between the road out of town
and the Arcade. Cream stonework, a red-and-white striped awning, a bay window with the light on. A
plank over the door says CLOTHES.

It is the ONE place in Banana World that is not a workplace, not a shop you buy from and not a game.
You tap it and a card opens: your own banana, standing in a lit changing room between two tall
mirrors, and three rails of things to put on it. You pick, it changes, that is the whole of it.
Nothing is bought, nothing is sold, nothing is won, nothing is lost. There is no Save button either —
what your banana wears is what your banana wears, everywhere in this world, the moment you pick it.

## What the player is actually doing

Standing in front of a mirror trying hats on. That is the feeling to write for: unhurried, private,
faintly pleased. It is the only room in the town with no clock in it.

Three rails, one per kind of thing: what goes on the head, what goes over the eyes, and what is
carried or worn besides. Some things on the rails are dimmed and carry a small padlock — those are
not for sale and never will be: they are caught, out in the world, at the rave or the pier or the
park garden. Tapping one takes you there.

## The rules this job lives under

1. **NOTHING IS SOLD HERE.** No price, no coins, no "get", no "unlock", no "buy". The shop is a
   mirror and a rail. A word that smells of a till breaks it.
2. **Never instruct.** No "tap to change", no "choose your outfit", no arrows. A rail of clothes in
   front of a mirror is the instruction.
3. **Never a rate, never a clock, never a count.** The mystery rule: this world does not publish its
   numbers. Not "42 items", not "3 of 5 unlocked".
4. **It is the PLACE talking, not a shopkeeper.** Nobody works here and nobody greets you. There is
   no NPC in this card, so no line may be written in anybody's voice.
5. **Short.** This card is 261 pixels wide on the narrowest phone we support, and most of it is taken
   by the mirror and the rails. Every string here has to sit on one or two lines at that width, and
   a label has to sit on one line inside a rail's heading.

## The fields

### The card

`title` is the heading at the top of the card. Two or three words — a NAME for the room, not a
sentence, and not the word on the plank outside (that already says CLOTHES). It is what you would
call the little room with the mirrors in it.

`line` is the single small line under the rails, and it is the only prose on the card. One sentence.
It notices the ROOM or the moment — the lamp, the mirrors, the quiet, the fact that nobody is
waiting for you — and never the player's taste, never their outfit, and never what they should do
next. ⚠️ it must not welcome anybody: nobody works here.

`alt` is the description read out to somebody who cannot see the mirror — one plain sentence
describing what is drawn there: a banana standing in a lit changing room between two mirrors. Plain
and useful, not atmospheric; this one is a label, not copy.

### The three rails

`rails.hat`, `rails.glasses`, `rails.extras` — the small heading over each rail. ONE OR TWO WORDS,
the way a shop labels a rail or a drawer, and they are set in capitals by the stylesheet so they read
as labels rather than as sentences. They must be plainly different from each other at a glance.

- `rails.hat` — things that go on the head: hats, caps, helmets, a crown, a fishbowl.
- `rails.glasses` — things that go over the eyes: shades, a monocle, reading glasses.
- `rails.extras` — everything else a banana can wear or carry: things in the hand, on the back, on
  the feet. It is the widest of the three, so its word has to cover a lot without being vague — not
  "Other", and not "Items".

### The locked ones

`locked` is what a dimmed, padlocked garment says when you rest on it. It MUST contain `{where}`,
where the game puts the place it is caught — "the rave", "the pier", "the park garden". ⚠️ it is an
INVITATION, never a refusal: the thing is on the rail precisely so you learn it exists and where it
lives. So it is about the PLACE and what happens there, never about not being allowed. Short — it
sits in a tooltip on a 44-pixel chip. No "locked", no "unlock", no "you can't".


## ⭐ A place answers plainly (22 Sep 2026)

Trym, tapping the lemonade stand and reading "Fig Jr.'s lemonade table is open beneath the striped
awning on Hall Street": *"i dont understand any of this text, i dont understand what its trying to
say? clear and concrete messages like this please."* So every line that a PLACE answers with — a
front's line, a card's first line, a room's line, a shut front's reason — is a signpost, not a
moment, and it answers two questions in plain words, in this order: **what is this** (name the place
and who runs it) and **what can I do here** (or that there is nothing to do here yet). No scenery,
no metaphor, no weather, no riddle. Two plain sentences beat one pretty one. A gate now refuses a
place line that names neither the place nor a thing a player can do (docs/voice.md).
