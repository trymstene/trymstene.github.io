# The job — the three voices of the Park

The Park is the green heart of Banana World, and the only area that can be in a bad way. It has
**health**: players pull weeds, pick up litter, plant seeds and water what other people planted, and
the whole park visibly recovers or slides back. Everything below turns on that.

Three bananas speak here. They already exist. Their names and jobs are fixed; the words are yours.

---

## The scene

A wide green park with a paved plaza and a fountain at one end. A pond with ducks. Winding paths, big
trees, benches. A community garden of planting beds that anyone can sow and anyone can water, so a
flower you find blooming was probably planted by a stranger. Weeds and dropped litter appear over time
and anybody can clear them. Birds land, butterflies come out when the weather is fair, squirrels only
turn up when the park is nearly well again. Weather runs to real storms. There are two wooden boards
by the path: one for supporters, one for the citizens of the week.

Two small places of business: **Inka's print shop**, a little mushroom-shaped house where the things on
the wall are real, printed and posted for real money, and **the stand**, where bananacoins earned in the
world buy hats and gear to wear.

Old Peel sits on a bench near his own flowerbed: a daisy, a sunflower and one midnight tulip, which he
waters before sunrise and has never missed a morning.

## The five bands

The park is always in one of five states, and Old Peel's lines come in five versions to match. They
must read as **one man watching one place over a long time**, not five different moods:

| Band | The park |
|---|---|
| 0 | neglected — weeds, litter, bare soil, nobody has come in a while |
| 1 | coming back — the first green, somebody has started |
| 2 | half herself — green in patches |
| 3 | nearly there — blooming, a few gaps left |
| 4 | perfect — the park at its best |

He calls the park **she** and **her**. That is his, and it stays.

## How it sounds here

All three speak in **lowercase**, warm and lean. This is the quiet end of Banana World: the town is
brisk, the park is slow. Nobody lectures the player and nobody sells hard.

Old Peel is the old groundskeeper who kept this park for forty years and now just sits. Gentle,
unhurried, proud of the place without claiming it. He had a wife; she loved the butterflies and said
they were flowers that got restless. He mentions her rarely and never heavily. He is glad of company
and says so plainly. He never instructs — when he tells you what helps, it sounds like an old man
thinking out loud, not a task list.

Inka runs the print shop. Straightforward, friendly, quietly proud that her wall is the one real thing
in a world of coins. Never pushy about money, and never apologetic about it either.

The stand keeper sells the gear. Dry, quick, a bit of a showman about other people's taste.

---

## What each line is for

**Old Peel**

- `greet` — the first thing he says when his card opens. An invitation to sit, not a menu.
- `bench` — what he mutters to himself from the bench, when nobody has tapped him. **Five groups, one
  per band, worst park first, three or four lines each.** Nobody is listening, so these are half
  thoughts: what he sees today, what he remembers, what he hopes. At band 0 he is not bitter, he is
  patient. At band 4 he is quietly delighted.
- `topics` — five buttons, and **the ids are fixed**:
  - `park` — the player asks what happened to the park. `byPhase`, five versions: the same answer at
    each band, the story of a place that fell away and is coming back.
  - `help` — the player asks what they can do. `byPhase`, five versions: what is worth doing right
    now, in this state. Weeds and litter when it is bad, planting and watering as it improves, and at
    band 4 there is nothing left to do but enjoy it, and he says so.
  - `lore` — the player asks about him. `seq`, three or four beats walked one tap at a time: forty
    years keeping the park, the picnic here with his wife, and now somebody else's turn — maybe yours.
    Each beat must land on its own and still pull to the next.
  - `shop` — the player asks about the mushroom house. One `line`: Inka's print shop, the one place
    where things are real, and he thinks well of her.
  - `bye` — the player says goodbye. `byPhase`, five versions, and this one closes the card. Send them
    off with something small and warm that fits the state of the park.
  - Every topic's `q` is **the player's own voice on a button**: short, lowercase, plain. The wit is
    his answer, never the question.
- `bed` — three lines about his own flowerbed. Proud, gentle, look-do-not-touch.

**Inka**

- `greet` — the print shop in one line: the wall is real, printed and posted.
- `lines` — four things she says while you browse. Warm, never a sales pitch. One of them may be about
  where the stickers end up.

**The stand keeper**

- `greet` — the stand, opening. Coins buy what is on the wall.
- `sold` — three lines for the moment somebody buys. **Each must contain `{item}`**, which the game
  replaces with the thing they bought. Dry and quick.

---

## Return

All three, with every field above. `old peel`, `inka` and `the stand keeper` keep their names exactly.
