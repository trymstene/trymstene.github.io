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

### The payslip (22 Sep 2026)

The cheque letter now looks like what it is: a **payslip** on kraft-brown paper with a rubber stamp
and the figures printed under Nib's line. Three more things in `wage`, none of them prose:

- `stamp` — the word on the rubber stamp, in capitals, one word, at most 8 letters: what a clerk
  stamps on a slip that has been settled (the plain English word for it).
- `slip` — the one printed line of figures, under the letter: it MUST contain `{days}` (the days
  worked that week) and `{rate}` (the wage for a full week) exactly once each, and nothing else that
  is a number. Something like the days first, then the rate. Under 60 characters, lower case.
  ⚠️ This is the ONE place the world prints a rate, because a payslip that hides its rate is not a
  payslip; Nib's `line` above it still never mentions one.
- `at` — the three workplaces as they are printed on a payslip, lower case, with their article, at
  most 24 characters each: `store` (the General Store), `condo` (the Arcade), `post` (the Post Office).

### The week's work on the slip, and the boss's letters (22 Sep 2026)

A payslip job has **the week's work** — duties with weekly targets (the arcade: the floor swept, machines
fixed; the store: the shelf restocked, turning up). The cheque is the full rate scaled by how much of it
got done, and the slip prints the counts so the reason is on the paper.

- `wage.slip` is now the **share line** under the counts: it MUST contain `{pct}` (the share of the
  week's work done, as a percentage the game prints, e.g. 50) and `{rate}` (the wage for a full week)
  exactly once each, and no other number. Lower case, under 60 characters. Something like: the share
  first, then the rate it is a share of. (The days are no longer on this line; the counts above it say
  what was done.)
- `bosses.nudge.condo` / `bosses.nudge.store` — a letter from the boss (Spinner at the arcade, Pip at
  the store) when Thursday has come and nothing has been done that week: is the player coming in?
  Warm, dry, a little pointed, never a threat, never a number, at most 140 characters. It may use
  `{home}`.
- `bosses.fired.condo` / `bosses.fired.store` — the letter that comes with the last payslip when two
  finished weeks had nothing done: the boss has taken the player off the book; the door is open if they
  ask again. Never cruel, never a lecture, never a number, at most 140 characters.

Each boss letter has `from` (their name as they sign it: Spinner, Pip) and `line`.



### Stamp's letters (22 Sep 2026)

The post office is a payslip job now — a round of sorting at the counter is its duty — so Stamp, the
postmaster, writes the same two letters Spinner and Pip do: `bosses.nudge.post` and
`bosses.fired.post`, each with `from` (Stamp) and `line`, under the same rules. The nudge comes
when Thursday has come and nothing has been done that week (the pile on the counter is his
subject); the goodbye comes with the last payslip after two finished weeks with nothing done. Warm,
dry, never a number, at most 140 characters, and the door is open if they ask again.
