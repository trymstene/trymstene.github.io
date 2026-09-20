# Banana Town — Chapter Two: the four signatures

This is a **story**, and it is the longest writing job in the house. Every other job on the rig
writes labels and lines for a surface; this one writes a chapter of Banana World's questline.

## Where it happens

Banana Town's square. Four of its buildings are **condemned on paper** — not poor, not derelict:
a works order signed in 1999 by the same hand that wrote a name into Nib's big book and then
scratched it out. Nobody has ever taken the order off the file, so as far as the paperwork is
concerned the General Store, the Arcade, the Post Office and the Coffee Cup do not exist.

The player's job is to get each one **certified** — four signatures. That is the whole chapter.
It is not a shopping trip and nothing is bought.

## Who speaks

Three voices only, and each is a different KIND of thing:

- **`nib`** — the town clerk, behind the counter inside the Town Hall. He helped the player register
  their homestead in chapter one, and he is the same person: delighted by paperwork, warm, a
  storyteller, completely unbothered that the thing he loves is absurd. He calls the register "my
  big book". He is not a bureaucrat and never speaks like one: no *registry*, no *archive*, no
  *deed*, no *pursuant*. He would say "the big book", "the top drawer", "the yellow form".
- **`paper`** — **not a person.** This is the works order itself, nailed to the front of the
  building, and the player is reading it. It is 1999 municipal paperwork: clipped, cold, slightly
  absurd, and it never addresses anybody. Write it as printed matter. It carries no emotion and no
  instruction. One or two of these should be funny purely because of how flat they are.
- **`you`** — the player, thinking out loud. Short. Never more than a sentence. They ask the
  obvious question the player is already asking, and they are never enthusiastic on the player's
  behalf.

## The shape, and it does not vary

Ten steps. One to open the chapter, then **two per building**, then one to close it.

1. `open` — Nib, at the Town Hall counter. He explains the works order and sends the player to the
   first front. This is the step that has to make a stranger want the other nine.
2. For each of the four buildings, in this order — the **General Store**, the **Arcade**, the
   **Post Office**, the **Coffee Cup**:
   - `<key>_fault` — the player is at the building, reading the order nailed to its front, and
     **finds the fault in it**. Mostly `paper`, with `you` noticing the thing that is wrong.
     ⭐ **Each fault must be a different kind of wrong**, and the four together are the joke:
     a date that cannot exist, a building described as something it is not, a name where no name
     should be, a signature that signs for the wrong thing. Pick four and keep them distinct.
   - `<key>_sign` — back at the counter. Nib reads the fault, is thrilled by it, and signs. The
     building's boards come down. He then points at the next one — except the last, which points
     at the certificate instead.
3. `done` — Nib files the certificate. The chapter ends here.

## The rules

1. **Never say what the player gets.** No coins named, no rewards promised, no "you'll be able
   to…". The world never publishes its own numbers (the mystery rule) and a quest step that
   advertises a payout reads like a mobile game.
2. **Never an instruction in a line.** The `find` field is where "go and look at X" lives. Inside
   the dialogue, Nib may *ask* the player to do something because that is how a person talks — but
   no line is a tutorial, and nothing says "tap" or "open the card".
3. **Nobody is in danger and nothing is urgent.** No timers, no threats, no "before it's too late".
   The buildings have been shut for twenty-seven years; another afternoon will not hurt.
4. **The mystery holds.** Who signed the 1999 order is NOT answered in this chapter, and no line
   may hint that it will be answered soon. Nib does not know. The player does not find out. The
   Mayor is never seen and is barely mentioned. Chapter three is not trailed, promised or named.
5. **A 13-year-old and a 50-year-old both read it without a stumble.** Short sentences, plain
   words, warmth. This is the voice bar chapter one was written to and it has not moved.
6. **The town's own people are not in this.** The nine residents walk their own day and say their
   own things; the chapter never speaks for them and never says where one of them is standing.

## The fields, per step

### `find` — the journal chip
The one line on the little yellow note in the corner of the screen, which is also the compass:
it says **where to go next**, and it is the only place in this job where an instruction belongs.
Very short. Lower case, like every chip in this world. Names the place, never the mechanic.

### `lines` — the sheet
The dialogue, as an ordered list of `{who, text}`. Four to eight lines for a normal step; the
opening step may run to ten. Each line is one speech bubble on a 261-pixel-wide phone, so a line
over about 220 characters is too long to read in one go. Vary the length — a one-word answer
between two long ones is what makes it sound like people.

### `hint` — what comes after
Written on the same note once the talking is done, and it points at the NEXT thing. Same voice as
`find`. The last step's hint is empty: there is nothing after it.

### `note` — the receipt line (every step that pays, which is the five)
One short line on the little card that appears after a step pays out — the four signing steps and
the closing one. It names **the thing you were given, not the money**: the stamped order, the
certificate. Chapter one's receipts read "Peel's old watering can" and "the flipbook — a keepsake",
and that is the register. No verb, no sentence, no thanks, and never the coins.

## The two framing lines

- `chapter` — the eyebrow over the title card, which must read exactly as chapter one's does:
  lower case, roman numeral. Chapter one's is `chapter i`.
- `title` — the chapter's NAME, on the splash that plays once before the first line. Chapter one's
  is `what the plot?` — short, lower case, a question or a phrase, curious rather than epic. Never
  a subtitle, never a colon.
