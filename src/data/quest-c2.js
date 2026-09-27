// 👻 RETURN TO SENDER — CHAPTER TWO: GHOST WRITER (27 Sep 2026).
//
// Trym: "after finishing chapter 1, you can get a quest-letter in your mailbox at the Homestead - that letter must be a
// different color than other letters - blue maybe … And thats where Nib calls for you to come visit the town … the chapter
// 2 must be spooky, have some twists, have some emotional stuff, and have a cliffhanger at the end". The plan and his seven
// calls (one night; The Four Signatures retired): https://claude.ai/artifact/UcpojNEagJABU6qU5kgAc9
//
// ⭐ MECHANICS ONLY, NOT ONE WORD. `say` is a key into src/data/copy/quest-c2.json (the notes, the receipts, the scenes and
// what is printed on the props); world-quest.js loadC2() joins the two. The two letters are the mailbox's own words
// (homestead-post.json letters.questblue / questblack). tools/check-quest-c2.mjs holds this file and the words equal.
//
// ⭐ IT OPENS AT HOME AND IT ENDS AT HOME. The blue letter is delivered once chapter one is done (banana-homestead.js
// POST_WHEN reads bwq-c1); the black one once this chapter reaches the step that waits for it (`mail`, which advance()
// writes into bwq-c2 as the step opens).
//
// ⚠️ THE TOWN DRAWS ITS OWN PEOPLE. A scene's resident is held at a place of their own while it is open (`station`, read
// off window.bwqTalk by banana-town.js and town-room.js), and the ! rides over their head wherever they walk (`follow`).
// Nothing here is shared state: the ghost, the ink, the lit window and the running statue are drawn for this player only.

// ---- where things are, in the town's world px (2200 × 1300; tools/build-town-scene.py)
// the statue on its base between the town hall and the post office (placed at 1416, base 330)
export const STATUE = { x: 1416, y: 214, base: 330 };
// the ink's way out of the hall's door, east along Hall Street and up the monument lane to the statue's foot
// (town-life.js ST.monument is 1416, 372: where a banana stands to look at it)
export const DRIPS = [[1100, 606], [1150, 616], [1204, 610], [1258, 618], [1312, 612], [1362, 606], [1402, 590],
  [1418, 548], [1412, 506], [1420, 464], [1414, 424], [1416, 384]];
// 👻 the last night's things (quest-c2-fx.js night): the Ghost Writer at the hall's door (town-life.js HOME.hall is 1100, 590),
// on its west side so Nib, held at the hall (ST.hall 1140, 590), is beside it and not inside it; the light in the Mayor's
// window (town-life.js MAYOR, on the hall's base line 560), and the statue's water
// laid over the statue's own box (ov-51: 1361, 124, 110 × 206, standing on 330) — off until the name is whole
export const NIGHT = { ghost: { x: 1070, y: 582 }, glow: { x: 1098, y: 468, base: 560 }, water: { x: 1361, y: 124, base: 330 } };

/**
 * The chapter, as steps. Every field is a mechanic or a key — never a word:
 *   id      — the step's name, its GA4 event (quest_step_<id>) and the receipt the pay is held against (qpay_<id>)
 *   area    — where it is played: 'homestead' (the mailbox) or 'town'
 *   kind    — 'letter' (a letter read at home), 'talk' (a scene), 'trail' (the ink, walked)
 *   say     — THE COPY KEY
 *   mail    — the letter a step waits on (homestead-post.json letters.<mail>)
 *   splash  — the chapter's title plays once this letter is read
 *   who     — whose scene: a resident, or 'monument' (the statue; the town hands a tap on it to the scene)
 *   station — where that resident waits while the scene is open (town-life.js ST)
 *   follow  — the ! rides over this resident's head
 *   at      — a fixed ! for a scene with nobody in it (world px, and the base it stands on)
 *   turnin  — the ? instead of the !: you are going back to somebody
 *   night   — the scene only opens once the square is dark
 *   fx      — what the dark brings for this player (NIGHT above), and takes away in the scene's `dark` moment
 *   auto    — the scene opens by itself when the step before it ends right there
 *   keep    — the receipt shows this prop, drawn: a keepsake
 *   gift    — …or this picture: a thing handed over that the scene never shows (Nib's spare lantern)
 *   pay     — bananacoins, once per player (the pass receipt), never once per device
 */
export const STEPS = [
  { id: 'c2_letter', area: 'homestead', kind: 'letter', mail: 'questblue', splash: 1, say: 'letter' },
  { id: 'c2_page', area: 'town', kind: 'talk', who: 'nib', station: 'hall', follow: 'nib', say: 'page', pay: 10, gift: '/assets/homestead/d-tlantern.png' },
  { id: 'c2_drips', area: 'town', kind: 'trail', path: DRIPS, say: 'drips' },
  { id: 'c2_statue', area: 'town', kind: 'talk', who: 'monument', at: STATUE, auto: 1, say: 'statue' },
  { id: 'c2_granfig', area: 'town', kind: 'talk', who: 'granfig', station: 'garden_w', follow: 'granfig', say: 'granfig', pay: 15 },
  { id: 'c2_stamp', area: 'town', kind: 'talk', who: 'stamp', station: 'post', follow: 'stamp', say: 'stamp', pay: 20, keep: 'plaque' },
  { id: 'c2_moss', area: 'town', kind: 'talk', who: 'moss', station: 'square', follow: 'moss', say: 'moss', pay: 20, keep: 'flyer' },
  { id: 'c2_taptap', area: 'town', kind: 'talk', who: 'nib', station: 'hall', follow: 'nib', turnin: 1, say: 'taptap' },
  { id: 'c2_notes', area: 'town', kind: 'talk', who: 'nib', station: 'hall', follow: 'nib', turnin: 1, say: 'notes', pay: 15, keep: 'note' },
  { id: 'c2_night', area: 'town', kind: 'talk', who: 'nib', station: 'hall', follow: 'nib', turnin: 1, night: 1, fx: NIGHT, say: 'night' },
  { id: 'c2_black', area: 'homestead', kind: 'letter', mail: 'questblack', say: 'black', pay: 50 },
];
