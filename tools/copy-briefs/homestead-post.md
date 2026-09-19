# The homestead — the world's post

A player's homestead has a mailbox. From 19 Sep 2026 the world writes to it: the town's own
residents send short letters when something happens on the plot. A letter is handwritten on
cream ruled paper, tilted, torn at the edges — the same sheet Nib's drawer letter is on in
chapter one — so it must READ like a hand-written note, not a notification.

**At most 140 characters each.** Short and sweet, like an old tweet: the limit is the craft.

One letter per occasion, ever, and the occasion is decided by the game, never by these words:

| key | who signs it | when it arrives |
|---|---|---|
| `welcome` | Nib, the Town Hall clerk | the plot is registered and the place is theirs |
| `movedin` | Moss, the street sweeper | the tent is up and the place looks lived in |
| `firstbeast` | Gran Fig | there is an animal on the plot now |
| `shed` | Pip, the General Store | the shed is filling up |
| `week` | Nib | a week on the plot, and the big book says so |

Each letter has `from` (their name as they would sign it) and `line` (the letter).

Also two lines for the card itself: `title` (the heading when the mailbox is opened) and
`empty` (shown when there is no post — warm, never sad, and never a promise about when
something will come).

The voice bar from the questline holds: a 13-year-old and a 50-year-old read it without a
stumble. Plain words, storyteller warmth, no bureaucrat jargon. The letter may use `{name}` for
the player and `{home}` for their homestead's name. Never a rate, never a time of day, never a
request for anything back — nobody owes the world a reply.


## `wage` — the cheque

The town now has jobs. You ask a boss, you turn up, and at the end of a week that has FINISHED a
letter arrives saying what the work came to. **This is the first thing in the whole world that
ever arrives while the player was not looking**, so it should feel like that: a thing that
happened without them, found afterwards.

It is signed by Nib, who keeps the big book and is the town's payroll desk. Write him filing
something that is already done — warm, dry, finished. Not a congratulation and not a receipt.

It MUST contain `{n}`, the coins.

⚠️ Never a rate, never a day of the week, never “per” anything, and never a promise about next
week. The town has never published a timetable and this letter is not where it starts.
