# Banana Town — the information kiosk, and what it hands you

The info kiosk stands at the south gate of Banana Town's square, where the road down to the Park
begins. It is an octagonal grey booth with a round [i] sign over its counter, and there is always
somebody in it when it is open.

Tap it and a card opens: a rack of **maps**. One for each place in Banana World — the town itself,
the Park, Banana Bay, and your own homestead — and one thing that is not a map at all, a flyer for
tonight at the Banana Rave. Tap a map and it fills the card; you can drag it about and pinch into it.

This job is every word on that card.

## What the kiosk is, and is not

1. **It is a rack of maps, not a guide.** Nobody in this world publishes its timetables, its odds or
   its rules (the mystery rule), and the kiosk does not either. A map says what is THERE. It never
   says what to do, never promises a reward, and never explains a mechanic.
2. **Nobody works here.** You cannot take a shift at the kiosk. The banana in the window is the
   kiosk being open, the way a lit window is a house being awake — it has no name and never speaks.
   So no line here may be in anybody's voice: nothing greets the player, nothing thanks them, nothing
   says "we". This is printed matter.
3. **Short.** The card is 261 pixels wide on the narrowest phone the house supports, and the tiles
   sit two to a row. Every line here has to survive that, and every button label sits on ONE line —
   buttons in this world never wrap.
4. **Never second person where a label will do.** A map rack does not address anybody.

## The fields

### The card

`title` is the heading: a NAME for the rack of maps, two or three words. It is what you would call
the thing, not what it does.

`line` is the one small line under the tiles, and the only prose on the first screen. It notices the
kiosk or the paper — the rack, the fold marks, the pin holes, the counter — and never instructs.
⚠️ it may not say "tap", may not say "zoom", and may not list what the maps are: the tiles do that,
and they are pictures of the places.

`back` is the button that goes from an open map back to the rack. A verb first, one or two words,
one line.

`shut` is what stands in for the maps when the kiosk is closed, which happens when the town is at
its lowest. Ordinary and temporary — the shutter is down. Not an error, not an apology, and it may
not blame the player for the state of the town.

### The four places

Each one has a `name` and a `line`.

`name` is what the kiosk prints under the map. Two or three words, the way a map is titled. ⚠️ these
are places that already have names in this world and the names are NOT yours to change: Banana Town,
the Park, Banana Bay, the homestead. Title them, do not rename them.

`line` is one short line under the name: what the place IS, in the flattest, most useful way a map
caption can put it. Not an advertisement and not a tour — the kind of sentence printed under a town
plan. What you would see if you went. One line each, and the four of them must not rhyme with each
other or share a construction.

- **town** — Banana Town itself: a brick old town on cobbles, a square with a clock tower, shops
  round it, a post office, a café, an arcade, a notice board, a fountain.
- **park** — the Park: lawns and paths round a fountain, garden beds you can plant, a pond, a
  mushroom shop, a notice board, benches.
- **bay** — Banana Bay: a beach with a pier, a beach hut, volleyball, a wrecked ship of a bar, and a
  boardwalk of market stalls.
- **homestead** — your own land: a fenced plot on the road, a gate, a mailbox, and whatever you have
  built on it. ⚠️ this is the ONLY one that is the player's own, and the map is of the LAND rather
  than of anybody's farm — every homestead is different. The line must be true for an empty plot on
  the first day and for a full farm a year later.

### The flyer

Not a map: a poster for tonight at the Banana Rave, pinned up in the same rack. The Rave is a real
place in this world — a dark club with a DJ, a bar with a bartender called Barty, beams, a floor
full of real visitors dancing, records that go missing, a breaker box that trips.

`rave.name` is the big name at the top of the poster. Two or three words. It is the NIGHT's name or
the club's — a thing you would see on a flyer, in capitals, above everything else.

`rave.tonight` is the small word or two over the name, the way a flyer says when it is. ⚠️ it must
survive being true every single day, because this poster is up every day — so nothing dated, no day
of the week, no hour.

`rave.bill` is three acts, one string each: the line-up. Banana names or act names, the way a flyer
prints a bill — one to a line, short enough for a phone. The first is the headliner. ⚠️ keep them
the right side of a real-world DJ's name; these are bananas.

`rave.lines` is two short lines of what is on down there. Between them they should carry: the music
and the floor, and the things a night gets you — gear you can wear and coins. ⚠️ no number, no
price, no rate, no odds. A flyer boasts; it does not quote a rate card.

`rave.door` is the one small line at the bottom, the way a flyer prints the door: where it is and
that everybody is welcome. Never a time, never a price, never "free" as a promise of value.


## ⭐ A place answers plainly (22 Sep 2026)

Trym, tapping the lemonade stand and reading "Fig Jr.'s lemonade table is open beneath the striped
awning on Hall Street": *"i dont understand any of this text, i dont understand what its trying to
say? clear and concrete messages like this please."* So every line that a PLACE answers with — a
front's line, a card's first line, a room's line, a shut front's reason — is a signpost, not a
moment, and it answers two questions in plain words, in this order: **what is this** (name the place
and who runs it) and **what can I do here** (or that there is nothing to do here yet). No scenery,
no metaphor, no weather, no riddle. Two plain sentences beat one pretty one. A gate now refuses a
place line that names neither the place nor a thing a player can do (docs/voice.md).
