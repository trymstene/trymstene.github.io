// 🏘️ TOWN LIFE — the residents' days (12 Sep 2026).
//
// A town day is twelve real minutes, six beats of two, read off the wall clock
// so everyone sees the same town. Every resident has a station per beat and
// WALKS between them along the lanes (a small node graph laid on STREETS'
// centrelines, Dijkstra per leg). At a station the act decides what they do:
// Moss sweeps the flyers off the street, the Figs water the beds, the rest
// stand at their counter, read the board, or sit out the noon on a bench with
// ⭐ THE TOWN IS QUIET (Trym, 12 Sep: "you dont see speechbubbles yapping away in stardew valley …
// with lots of npcs yapping away at the same time it gets chaotic and just noisy … theres no speech
// bubbles, but npcs stand next to eachother when they talk — when you go up to them and click them, a
// dialogue window opens"). So: NOTHING a resident says appears over their head, ever. They work in
// silence; two of them at one place stand FACING EACH OTHER, and that is how you see they are talking.
// You hear one only by walking up and tapping: then a dialogue card opens with their portrait, and the
// line depends on how often you two have met (the ladder, a pass stat). At night they go home: the
// element hides and a warm window glows. The Mayor is never seen; a light in the hall's upper window
// in the evening is all of him.
import { drawComposite } from '../lib/banana-engine.js';
import { poofInto } from '../lib/world.js';
import { passStat, passRaw, statTotal } from '../lib/banana-pass.js';

// ---- the clock
const DAY_MS = 720000, HOUR_MS = 30000;   // a town day is twelve real minutes: six beats of two
const BEATS = ['dawn', 'morning', 'noon', 'afternoon', 'evening', 'night'];
let setHour = null, setAt = 0;   // QA: a pinned hour that keeps running from the moment it was set
const townMs = () => setHour == null ? Date.now() % DAY_MS : (setHour * HOUR_MS + (performance.now() - setAt)) % DAY_MS;
const hourNow = () => townMs() / HOUR_MS;
const beatOf = (h) => Math.floor(h / 4) % 6;

// ---- the bible: who they are, where they stand, what they say (writers' room, 12 Sep 2026)
// day: six beats of [place, act, face, lines]; hi: what they say to you at ladder rung 0-4; tap: the fallback line
const R = [
  { key: 'nib', name: 'Nib', hat: 'tophat', glasses: 'potter', tool: '', home: 'hall', role: "Town Hall clerk: keeps the big book, answers the Mayor's notes, stamps things so they are real.",
    day: [
      ['monument', 'stand', 'front', ["Good morning. Nobody knows who you are. I am working on it.", "A statue with no plaque. It is an open case. I keep it open.", "I bring a cloth. Somebody should. So it is me."]],
      ['hall', 'counter', 'front', ["The book is open. The hall is open. I am, in most respects, open.", "Forms to the left. Questions to the right. Sighs to me.", "Every name goes in once. Yours went in twice. I fixed it."]],
      ['bench_e', 'bench', 'front', ["Dot reads me the wants. I write them down. It is a good lunch.", "I eat here so the hall can breathe. It has a lot of paper in it.", "Next of kin. I leave mine blank. Anyway. Lovely fountain."]],
      ['hall', 'counter', 'front', ["The Mayor left a note. I answered it. That is how we talk.", "There is a page in the book that somebody scratched out. In 1999.", "Stamp calls her drawer an archive. It is a drawer. I file that."]],
      ['board', 'read', 'front', ["Board of Works. I pin the official ones straight. The rest lean.", "Somebody wants a fish. That one has been up a long time.", "A town is a list of people who stayed. I keep the list.", "That light? The Mayor. Late, or early. I have never learned which. I knock; a note comes back."]],
      ['home', 'home', 'front', ["The book sleeps in a drawer. I sleep above the drawer.", "I count the names before bed. Tonight there is one more.", "Good night, town. Every one of you. Alphabetically."]]],
    hi: ["Good day. You are not in the book yet. That is not a crime. It is a form.", "The new one. I have your page ready. It only needs a person on it.", "{name}. Plot Eleven. Page thirty. I do not need to look it up.", "Ah, Plot Eleven. I say it fondly, {name}. The book has no column for fondly.", "{name}. Next of kin, mine. I wrote you in this morning. I hope that is all right."],
    tap: "Ah. You. The Mayor said somebody might come by the hall. I believe it was you." },
  { key: 'stamp', name: 'Stamp', hat: 'buckethat', glasses: '', tool: 'letter', home: 'post', role: "Runs the Post Office: weighs the mail, sells stock postcards to neighbours, meets the bus.",
    day: [
      ['bus', 'stand', 'right', ["The bus is late. Four minutes. I weigh that against last time.", "One sack, a morning's worth. I can tell by the shape.", "Nothing for me. Noted. Something for everyone else. Good."]],
      ['post', 'counter', 'front', ["Postcards. Stock. No words on them. The honest kind.", "Put it on the scale. Everything goes on the scale. Even hats.", "Two hundred grams of somebody's grandmother. Careful with that."]],
      ['terrace', 'bench', 'front', ["Bean says my cup shows a long journey. It shows coffee.", "Lunch is short. I weigh the bread. Habit.", "The little fountain here is lighter than the big one. I can hear it."]],
      ['post', 'counter', 'front', ["A card to your neighbour costs nothing to write. It is blank. Go on.", "Somebody posted a leaf. Moss, I think. It weighed nothing. I sent it.", "That card is four grams. Three of it is hello."]],
      ['hall', 'stroll', 'right', ["Last round. The hall gets the heavy envelope. It always does.", "I walk the street once so the day has been delivered.", "The hall light is on. Nib is at the board. Somebody is upstairs."]],
      ['home', 'home', 'front', ["The scale is off. My feet are on. Two hundred and something.", "One postcard, blank, in the drawer. Mine. Not sent. Not yet.", "The bus comes back tomorrow. So do I. That is the arrangement."]]],
    hi: ["New face. Stand on the scale a moment. No. That was a joke. Nearly.", "The new one. You have no post yet. That changes. It always changes.", "{name}. Nothing for you today. I checked twice. I always check twice.", "Featherweight. I mean you, {name}. You walk like a letter with good news in it.", "{name}. There is a postcard in my drawer with my name on it. Nobody knows. Now you do."],
    tap: "Postcards go out, mail comes in. I weigh everything. Stand still, I am weighing you." },
  { key: 'moss', name: 'Moss', hat: 'woolbeanie', glasses: '', tool: 'broom', home: 'condo', role: "The sweeper: keeps the streets and the square clear of flyers, leaves and opinions.",
    day: [
      ['square', 'sweep', 'left', ["Leaves. Again.", "Flyers. Somebody printed these. Somebody will answer for it.", "Clean before the light. That way it was always clean."]],
      ['hall', 'sweep', 'right', ["Hall street. Nib's paper. Nib's paper gets everywhere.", "Morning, lamp. Morning, bin. Morning, bin's little friend.", "A town is just a floor. Somebody has to hold it."]],
      ['bench_w', 'bench', 'front', ["Sandwich. Bench. Gran.", "She talks, I chew. Fair split.", "The fountain is loud. Good. Nobody hears me not talking."]],
      ['cafe', 'sweep', 'left', ["Cups. Sleeves. Bean.", "Cafe end. Worst end. She leaves it like this so I come by. I know.", "Crumbs are litter. Legally."]],
      ['square', 'stand', 'front', ["Look at it. Nobody looks at it. Clean.", "I stand here till the first leaf lands. Then I have lost. Fine.", "If you are looking at the square, thank you. Do not say it back."]],
      ['home', 'home', 'front', ["Wall. Pong. Wall. Good night, Spinner.", "Broom by the door. Beanie on the broom. Done.", "One flyer under the mattress. Nobody's business."]]],
    hi: ["New. Feet clean. Keep them that way.", "The new one. You walked round the flyer. Noticed.", "{name}. You are on the clean bit. Stay there.", "Boots. That is what I call you, {name}. Boots that mind where they go.", "{name}. I have a flyer under my mattress. Do not tell Stamp. Not a word."],
    tap: "Leaves. Again. Stand still, you are on a leaf." },
  { key: 'pip', name: 'Pip', hat: 'backwardscap', glasses: '', tool: 'rubberchicken', home: 'store', role: "Runs the General Store: fireworks, lures, duck bread, every one the last one.",
    day: [
      ['store', 'stand', 'front', ["Restocking the last ones. Don't tell anyone.", "Duck bread's in. The ducks know first.", "Fireworks, lures, bread. Bread first. Always."]],
      ['store', 'counter', 'front', ["Last lure. Also the second-last. Roughly.", "Fireworks. Never lit one. Great reviews.", "Duck bread. For ducks. Or not. Your call."]],
      ['bank', 'stand', 'front', ["Checking the machine. Still no. Still checking.", "One day this thing gives out money. I'd like to be here.", "It hums. Good sign. Everything hums before it pays."]],
      ['store', 'counter', 'front', ["Someone bought two once. Big day. Still is.", "Last duck bread. I baked six. Last one.", "Lures. Dot asks about fish. I sell hope."]],
      ['condo', 'stand', 'front', ["Invaders. One more go. Last one. Roughly.", "Spinner's narrating. I'm losing. Both loud.", "Top of the board says Pip. Under four other names."]],
      ['home', 'home', 'front', ["Shelves counted. All last ones.", "Fireworks in the back. Sleeping. Hopefully.", "Bell rang eleven times today. Good day. Roughly."]]],
    hi: ["New face. Fireworks, lures, duck bread. Pick one. Bread, honestly.", "The new one's back. Last duck bread's in. Third one today.", "{name}. Saved you a lure. Also everyone else. It's a big box.", "Bread. Hi, Bread. That's you now, {name}. Best customer. Only customer.", "{name}. I've never lit a firework. You can be the first. I'll watch from here."],
    tap: "Fireworks, lures, duck bread. Every one of them the last one. Roughly." },
  { key: 'bean', name: 'Bean', hat: 'beanieprop', glasses: '', tool: 'mug', home: 'cafe', role: "Runs The Coffee Cup kiosk: today's coffee, today's fortune, and the price rumour.",
    day: [
      ['cafe', 'counter', 'front', ["Kettle's on. So is fate.", "First cup. It says: more cups.", "I see a morning. Then another one."]],
      ['cafe', 'counter', 'front', ["Your fortune is in the cup. So is the coffee.", "I see a queue. Behind you. Small one.", "Grounds say rain. Sky says maybe."]],
      ['terrace', 'bench', 'front', ["Stamp and I are talking. Listen.", "Same bench. Same silence. Best one.", "I see a postcard in her drawer. She knows."]],
      ['cafe', 'counter', 'front', ["Afternoon cups. Bitter and honest.", "I see a nap. Not yours. Mine.", "Moss is sweeping. I left the crumbs. She knows."]],
      ['garden_e', 'stroll', 'left', ["Empty cups in the garden. Each one says milk.", "I see stars. Behind the cloud. Trust me.", "Light on at the hall. Cup didn't mention it."]],
      ['home', 'home', 'front', ["Cups rinsed. Futures too.", "I see sleep. Finally. Mine.", "Propeller's still. Good coffee today."]]],
    hi: ["A stranger. The cup said so. The cup says most things.", "The new one. I saw a second visit. This is it.", "{name}. Your cup is waiting. It has opinions.", "Sugar. You're Sugar now, {name}. Don't ask what the cup said.", "{name}. I have never read my own cup. I might, if you sat with me."],
    tap: "Your fortune is in the cup. So is the coffee. Only one of them is hot." },
  { key: 'figjr', name: 'Fig Jr.', hat: 'cowboy', glasses: 'shades', tool: 'lemonjug', home: 'garden_w', role: "Runs the lemonade stand at the family orchard and wheels the fruit cart into the square at noon.",
    day: [
      ['orchard', 'water', 'right', ["Early inspection of the supply chain. Trees.", "Nobody sees this. Quarterly secret.", "The supplier sleeps. The enterprise does not."]],
      ['stand', 'counter', 'front', ["Fig's Lemonade. Established before I was.", "Fresh batch. Strong quarter. One cup so far.", "The brand is the hat. The hat is the brand."]],
      ['cart', 'stand', 'front', ["Cart's in the square. That's expansion.", "Spinner wants the cart on the Wheel. Not for sale. Not a prize.", "Lunch rush. Rush is a strong word."]],
      ['stand', 'counter', 'front', ["Sold two. Reinvesting. In lemons.", "Growth strategy: more sun. Working on it.", "Pip calls the shelf local. I call it an exclusive."]],
      ['garden_w', 'stand', 'front', ["Walking the supplier to her bench. It's on the way. It isn't.", "Carried out full. Carrying back most.", "She calls me Figgy out here. That's off the record."]],
      ['home', 'home', 'front', ["Jug's in. Books closed. Page one.", "Tomorrow: lemons. Same as today.", "The supplier said goodnight. I said noted."]]],
    hi: ["Welcome to Fig's. Family firm. I'm the firm.", "The new one. Our returning customer base. Singular.", "{name}. Loyalty programme starts now. It's a cup.", "Partner. I call you Partner, {name}. No paperwork, the supplier said no.", "{name}. The sign says FIG'S. Gran's. It's fine. It's good, actually."],
    tap: "Fig's Lemonade. Locally sourced. From behind me. That's the orchard." },
  { key: 'spinner', name: 'Spinner', hat: 'jester', glasses: '', tool: 'balloons', home: 'condo', role: "Runs the Wheel of Peel, one free spin a day, and holds the Pong paddle in the arcade.",
    day: [
      ['square', 'stand', 'front', ["Step up, step up, nobody! Practising, fountain. You are doing great.", "The voice needs warming, like the Wheel needs oiling. Both squeak.", "Spinner at dawn, folks! Quiet as anything! Do not tell the Wheel."]],
      ['wheel', 'counter', 'front', ["One free spin a day! The pot is watching you. The pot is patient.", "Round she goes, where she stops, Spinner does not know. Honest!", "Every spin equal, folks! Rich, poor, hat, no hat. That is the Wheel."]],
      ['cart', 'stand', 'front', ["Lunch is an apple, folks! Fig Jr. sells them! Spinner buys them!", "Put the cart on the Wheel, Fig! No? The pot would love a cart!", "Bean says my cup shows a spin. Every cup shows a spin. Round!"]],
      ['wheel', 'counter', 'front', ["Luck in the afternoon, folks! It tastes the same. It tastes like luck!", "Spun today? No? Then it is still waiting. The pot does not forget.", "Quiet now. Just you and me and the Wheel. There. Loud again!"]],
      ['condo', 'stand', 'front', ["Pong! Two paddles, one Spinner, no mercy! Very little mercy! Some!", "Lost again, folks! By a point! How does Spinner keep doing it!", "Pip is on Invaders. Pip is losing to Invaders. Go on, Pip!"]],
      ['home', 'home', 'front', ["Paddle practice. Bang on the wall. Good night, Moss. Good night!", "Three bells on the hat, all asleep. Spinner too. Nearly.", "Nobody asked Spinner what Spinner wants. Spinner would say a spin."]]],
    hi: ["A stranger, folks! Step up! One spin, free, no strings, no catch, some bells!", "The new one! Back for the pot! The pot remembers you. The pot is like that.", "{name}! Say it with me, folks! {name}! The Wheel heard you. It is blushing!", "Champ! My Pong champ, {name}! Beat me by a point! I was inches off! Inches!", "{name}. Whisper now. I let them win. Every kid. By one. Keep it. Loud again!"],
    tap: "One free spin a day! The pot is watching you. So is Spinner. Both are friendly." },
  { key: 'dot', name: 'Dot', hat: '', glasses: '', tool: '', home: 'print', role: "Keeps the town's wants at the info kiosk: what everyone is looking for, read to Nib at lunch.",
    day: [
      ['square', 'stand', 'front', ["Have you seen a fish? A real one? In here?", "Does the fountain go anywhere? Do fish know?", "If I stand very still, does it count as fishing?"]],
      ['board', 'read', 'front', ["Somebody wants a lure? Somebody wants a hat back? Shall I write it?", "Does the board lean? Or is it the wants?", "What are you looking for? Everyone is? Can I keep it?"]],
      ['bench_e', 'bench', 'front', ["Nib, shall I read the wants? Is the fish still first? Always?", "Is lunch a want or a need? Can I keep it if it is both?", "Why does the bench face the fountain? Does it know something?"]],
      ['info', 'counter', 'front', ["What do you want? Not to buy? To want? Shall I write it down?", "Is a want a wish that has not asked yet?", "Did you know Nib wants a committee? Is two enough?"]],
      ['monument', 'bench', 'front', ["Evening, statue? Seen a fish? You face the water, don't you?", "Does a statue want a name? Has anyone asked it?", "Nib says no fish on record? Does the record swim?"]],
      ['home', 'home', 'front', ["Does the press sound like water? Is that why I sleep?", "Do fish sleep? Do they know they are being looked for?", "Is tomorrow the day? Is it always?"]]],
    hi: ["Are you new? Have you seen a fish? A real one?", "The new one? Are you still new? When does it stop?", "{name}? Did you look in the fountain on the way? Properly?", "Fish! No, sorry, I mean you, {name}. Can I call you that? Too late?", "{name}? Can I tell you where it is? Will you still look with me if I do?"],
    tap: "Have you seen a fish? A real one? Tell me what you want instead, then?" },
  { key: 'granfig', name: 'Gran Fig', hat: 'snailhat', glasses: 'nerd', tool: 'wateringcan', home: 'garden_w', role: "Grows the orchard and the west garden; keeps everyone's names, as they were and as they are.",
    day: [
      ['garden_w', 'water', 'left', ["Beds first. Everything else can wait.", "Snail's up. So am I. Just.", "Water before the sun sees. The beds like to be first."]],
      ['orchard', 'water', 'right', ["The trees were watered. Rain, was it.", "Apples don't hurry. Nor do I.", "Jr.'s at the stand. Good. Keeps busy."]],
      ['bench_w', 'bench', 'front', ["Moss is here. Good. Say nothing.", "I knew your mother's hat. Same slant.", "Nib says the book's complete. Bless him."]],
      ['store', 'stand', 'front', ["My window box. Pip keeps a plant in it. He thinks I don't know.", "Pip's uncle had this shop. Same bell. Same everything.", "I buy nothing. I stay. That's a customer."]],
      ['garden_w', 'bench', 'front', ["Here he comes. On his way, he says. Sit, Figgy.", "Evening does the talking. We let it.", "Sold some, he says. Some is a number. It isn't."]],
      ['home', 'home', 'front', ["Can's by the door. Full. Always.", "Figgy's in. Snail's in. Town's in.", "Goodnight, whoever you are. You'll do."]]],
    hi: ["Stand up straight. There. Now, who are you.", "The new one. I've decided. Don't wander off.", "{name}. I had you down as somebody else. You'll do.", "Pet. I call you Pet now, {name}. It was your grandmother's. Probably.", "{name}. Plot eleven. Somebody asked me before you. I know who. Ask me properly."],
    tap: "You'll want a coat. No, you won't. Sit. Water that." },
];
const MOSS_FLYER = "That one. I said I would know which one.";   // her want, kept: the player picked a flyer up with her near

// ---- where a place's station is (feet, world px): at a lane's edge next to the place. A second
// (third) point is for the residents who share the place in one beat — the bible's lunches.
const ST = {
  monument: [[1416, 372]], 'monument|bench': [[1450, 482]],
  hall: [[1140, 590], [1060, 590]], post: [[1750, 590], [1650, 590]],
  store: [[530, 1068], [440, 1068]], bank: [[620, 1072]], print: [[1580, 1068]], cafe: [[1780, 1068], [1880, 1068]],
  board: [[740, 1012], [812, 1012]], cart: [[1405, 1034], [1478, 1034]], info: [[1012, 1210]],
  terrace: [[1705, 1242], [1835, 1242]], orchard: [[792, 322]], stand: [[890, 576], [962, 576]], bus: [[1962, 352]],
  garden_w: [[485, 704], [556, 704]], garden_e: [[1730, 698]],
  // the lunch pairs stand just behind their bench (feet above its top edge: nothing overlaps), each pair framed by its own
  square: [[1100, 990], [1000, 950], [1200, 950]], bench_w: [[935, 992], [995, 992]], bench_e: [[1215, 992], [1275, 992]],
  condo: [[480, 592], [562, 592]], wheel: [[1400, 802]], exchange: [[800, 802]],
};
// the sweeps and strolls: a line on the lane, walked back and forth
const PATHS = {
  'moss|0': [[880, 985], [1320, 985], [1320, 800], [1230, 800]],
  'moss|1': [[640, 650], [1560, 650]],
  'moss|3': [[1560, 1095], [1900, 1095]],
  'stamp|4': [[1600, 650], [1000, 650], [1300, 650]],
  'bean|4': [[1580, 700], [1880, 700], [1730, 700]],
};
// home: the door they vanish through, and the window that glows while they are in
const HOME = { hall: [1100, 590], post: [1700, 590], condo: [480, 592], store: [480, 1068], cafe: [1830, 1068], print: [1620, 1068], garden_w: [520, 704] };
const GLOW = { hall: [[1098, 468]], post: [[1694, 215]], condo: [[435, 400], [525, 400]], store: [[516, 1006]], cafe: [[1837, 1012]], print: [[1656, 1000]], garden_w: [[612, 738]] };
const MAYOR = [1098, 468];
// the beds a waterer sprinkles, per place
const BEDS = { garden_w: [[440, 748], [530, 748]], orchard: [[690, 336], [900, 336], [790, 222]] };
// the flyers: six spots on the streets, and the beat in which Moss's sweep reaches each
const LITTER = [[1180, 985, 1, 0], [1300, 850, 2, 0], [900, 650, 2, 1], [1350, 640, 1, 1], [1650, 1100, 1, 3], [1860, 1120, 2, 3]];

// ---- the lanes as a graph: nodes on STREETS' centrelines, edges along them; a station attaches to
// the nearest edge (its projection), and a leg is Dijkstra from one attachment to the other
const N = { hw: [310, 615], h1: [720, 615], h2: [792, 615], h3: [1100, 615], h4: [1416, 615], h5: [1480, 615], h6: [1944, 615], he: [1975, 615],
  gw: [310, 1090], g1: [720, 1090], g2: [1100, 1090], g3: [1480, 1090], g4: [1620, 1090], ge: [1975, 1090],
  wl: [310, 696], wp: [655, 696], el: [1975, 696], ep: [1560, 696],
  nw: [720, 700], ne: [1480, 700], sw: [720, 1000], se: [1480, 1000], ss: [1100, 1000],
  or: [792, 322], mo: [1416, 372], mb: [1416, 482], bu: [1944, 352], ms: [1100, 1250], t1: [1620, 1200], t2: [1880, 1200] };
const E = 'hw-h1 h1-h2 h2-h3 h3-h4 h4-h5 h5-h6 h6-he gw-g1 g1-g2 g2-g3 g3-g4 g4-ge hw-wl wl-gw he-el el-ge wl-wp wp-nw el-ep ep-ne h1-nw h5-ne g1-sw g3-se g2-ss nw-ne nw-sw sw-ss ss-se se-ne h2-or h4-mb mb-mo h6-bu g2-ms g4-t1 t1-t2'
  .split(' ').map((s) => s.split('-'));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function attach(p) {   // the closest point on the closest edge
  let best = null;
  for (const [a, b] of E) {
    const A = N[a], B = N[b], vx = B[0] - A[0], vy = B[1] - A[1], L = vx * vx + vy * vy;
    const t = Math.max(0, Math.min(1, ((p[0] - A[0]) * vx + (p[1] - A[1]) * vy) / L));
    const q = [A[0] + vx * t, A[1] + vy * t], d = dist(p, q);
    if (!best || d < best.d) best = { d, pt: q, a, b };
  }
  return best;
}
function route(from, to) {   // the points to walk, from (exclusive) to `to` (inclusive)
  const A = attach(from), B = attach(to);
  const P = { ...N, A: A.pt, B: B.pt };
  const adj = {};
  const link = (a, b) => { const w = dist(P[a], P[b]); (adj[a] = adj[a] || []).push([b, w]); (adj[b] = adj[b] || []).push([a, w]); };
  for (const [a, b] of E) link(a, b);
  link('A', A.a); link('A', A.b); link('B', B.a); link('B', B.b);
  if ((A.a === B.a && A.b === B.b) || (A.a === B.b && A.b === B.a)) link('A', 'B');
  const D = { A: 0 }, prev = {}, open = new Set(['A']), done = new Set();
  while (open.size) {
    let u = null;
    for (const k of open) if (u == null || D[k] < D[u]) u = k;
    open.delete(u); done.add(u);
    if (u === 'B') break;
    for (const [v, w] of adj[u] || []) {
      if (done.has(v)) continue;
      const nd = D[u] + w;
      if (D[v] == null || nd < D[v]) { D[v] = nd; prev[v] = u; open.add(v); }
    }
  }
  const ids = [];
  for (let u = 'B'; u != null; u = prev[u]) ids.unshift(u);
  const pts = ids.map((k) => P[k]);
  pts.push(to);
  // drop the doglegs: a point within a step of its neighbours' line is a bend nobody sees
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = out[out.length - 1];
    if (q && dist(p, q) < 3) continue;
    out.push(p);
  }
  return out;
}

// ---- the ladder: how often this player has met them, a pass stat that travels
const metNow = new Set();   // at most once per page session per resident
const total = (key) => { try { return statTotal(passRaw(), 'tw_met_' + key); } catch (e) { return 0; } };
const rung = (key) => { const t = total(key); return t >= 14 ? 4 : t >= 7 ? 3 : t >= 3 ? 2 : t >= 1 ? 1 : 0; };
function met(key) {
  if (metNow.has(key)) return;
  metNow.add(key);
  try { passStat('tw_met_' + key, 1); } catch (e) {}
}
function nameOf() {
  let n = '';
  try { n = (localStorage.getItem('ps-name-v1') || '').trim().slice(0, 24); } catch (e) {}
  return n || 'friend';
}
const fill = (s) => s.replace(/\{name\}/g, nameOf());

const WALK = 110, BOB_MS = 333, SWEEP_R = 120, NEAR_MOSS = 200;
const FACE_FRAME = { front: 2, left: 4, right: 0 };

export function initLife({ world, W, H, pct }) {
  let ready = false, curBeat = -1, lastSweep = 0, mayorEl = null;
  const flyers = [];

  // the residents: one .tw-npc each (canvas + name) and their home's window glow
  const res = R.map((r, idx) => {
    const el = document.createElement('div');
    el.className = 'tw-npc';
    const cv = document.createElement('canvas'); cv.width = cv.height = 150;
    const tag = document.createElement('span'); tag.textContent = r.name;
    el.appendChild(cv); el.appendChild(tag);
    el.hidden = true;
    world.appendChild(el);
    const outfit = { hat: r.hat || 'none', glasses: r.glasses || 'none', extras: r.tool ? { [r.tool]: true } : {}, top: '', bottom: '', bg: 'transparent', captions: false, effect: 'none' };
    return { ...r, idx, el, cv, ctx: cv.getContext('2d'), outfit, x: 0, y: 0, px: NaN, py: NaN, drawn: '', face: 'front',
      path: [], wait: 0, walking: false, loop: null, li: 0, ldir: 1, hidden: true, beat: -1, place: '', act: '', talked: false, lastWater: 0, bedI: 0, glow: null };
  });
  // glows: one per home window; two residents above the arcade, the Figs share a lantern
  const glowCount = {};
  for (const n of res) {
    const pts = GLOW[n.home] || [], k = glowCount[n.home] || 0; glowCount[n.home] = k + 1;
    const g = pts[Math.min(k, pts.length - 1)];
    if (!g) continue;
    const el = document.createElement('div');
    el.className = 'tw-glow'; el.hidden = true;
    el.style.left = pct(g[0], W); el.style.top = pct(g[1], H); el.style.zIndex = String(100 + HOME[n.home][1] + 2);
    world.appendChild(el);
    n.glow = el; n.glowAt = g;
  }
  mayorEl = document.createElement('div');
  mayorEl.className = 'tw-glow tw-glow--mayor'; mayorEl.hidden = true;
  mayorEl.style.left = pct(MAYOR[0], W); mayorEl.style.top = pct(MAYOR[1], H); mayorEl.style.zIndex = String(100 + 560 + 3);
  world.appendChild(mayorEl);

  const byKey = (key) => res.find((n) => n.key === key);

  // ---- stations
  function stationFor(n, beat) {
    const [place, act, face, lines] = n.day[beat];
    const loop = PATHS[n.key + '|' + beat] || null;
    if (loop) return { place, act, face, lines, x: loop[0][0], y: loop[0][1], loop };
    if (act === 'home') { const d = HOME[n.home]; return { place, act, face, lines, x: d[0], y: d[1], loop: null }; }
    const pts = ST[place + '|' + act] || ST[place] || [[1100, 990]];
    // who else stands at this place this beat (walkers excluded): the k-th takes the k-th point
    const group = res.filter((m) => { const d = m.day[beat]; return d[0] === place && d[1] !== 'sweep' && d[1] !== 'stroll' && d[1] !== 'home'; });
    const k = Math.max(0, group.indexOf(n));
    const p = pts[Math.min(k, pts.length - 1)];
    // 🗣 two residents at one place TURN TOWARD EACH OTHER — with no bubbles that is the only way you
    // see a conversation, and it is how Stardew does it. The one on the left looks right, and vice versa.
    let f = face;
    if (group.length > 1 && pts.length > 1) {
      const other = pts[Math.min(k === 0 ? 1 : 0, pts.length - 1)];
      if (Math.abs(other[0] - p[0]) > 24) f = other[0] > p[0] ? 'right' : 'left';
    }
    return { place, act, face: f, lines, x: p[0], y: p[1], loop: null };
  }
  function goHome(n) {
    n.hidden = true; n.el.hidden = true;
    if (n.glow) n.glow.hidden = false;
  }
  function leaveHome(n) {
    if (!n.hidden) return;
    const d = HOME[n.home];
    n.x = d[0]; n.y = d[1];
    n.hidden = false; n.el.hidden = false;
    if (n.glow) n.glow.hidden = true;
  }
  function changeBeat(beat, walk) {
    curBeat = beat;
    if (!walk || beat === 0) spawnLitter(beat, walk);
    for (const n of res) {
      const st = stationFor(n, beat);
      n.beat = beat; n.place = st.place; n.act = st.act; n.face = st.face; n.lines = st.lines; n.loop = st.loop; n.li = 0; n.ldir = 1;
      n.lastWater = 0;
      if (walk) {
        if (st.act !== 'home' || !n.hidden) leaveHome(n);
        n.path = route([n.x, n.y], [st.x, st.y]);
        n.wait = 300 + n.idx * 260;
        n.walking = false;
      } else {
        n.path = []; n.walking = false; n.wait = 0;
        n.x = st.x; n.y = st.y;
        if (st.act === 'home') goHome(n); else leaveHome(n);
      }
    }
    if (mayorEl) mayorEl.hidden = beat !== 4;
  }
  function arrive(n) {
    n.walking = false; n.path = [];
    if (n.act === 'home') goHome(n);
  }

  // ---- litter
  function spawnLitter(beat, respawn) {
    for (const f of flyers) f.el.remove();
    flyers.length = 0;
    LITTER.forEach(([x, y, art, sweepBeat], i) => {
      if (!respawn && sweepBeat < beat) return;   // Moss has already been past it today
      const el = document.createElement('img');
      el.className = 'tw-litter'; el.alt = ''; el.draggable = false; el.decoding = 'async';
      el.src = '/assets/town/litter-' + art + '.png';
      el.onload = () => { el.style.width = pct(el.naturalWidth, W); };
      el.style.left = pct(x, W); el.style.top = pct(y, H); el.style.zIndex = String(100 + y);
      world.appendChild(el);
      flyers.push({ i, x, y, el, gone: false });
    });
  }
  function poof(x, y) { poofInto(world, 'tw-poof', x / W * 100, (y - 10) / H * 100); }
  function takeFlyer(f) {
    if (f.gone) return;
    f.gone = true; f.el.remove(); poof(f.x, f.y);
  }
  function pick(i) {   // the player picked one up; Moss, if near, has a line for it
    const f = flyers.find((q) => q.i === i && !q.gone);
    if (!f) return false;
    takeFlyer(f);
    const m = byKey('moss');
    // her one reaction to something the PLAYER did — the town's narration line, not a bubble over her head
    if (m && !m.hidden && Math.hypot(m.x - f.x, m.y - f.y) < NEAR_MOSS) return 'Moss: \u201c' + MOSS_FLYER + '\u201d';
    return true;
  }

  // ---- the dialogue: only ever on a tap, and only after you have walked up to them
  // The line is chosen by the ladder — how often you two have met — and the SECOND tap in a session
  // gives you what they are doing right now instead of the greeting again.
  function talk(key) {
    const n = byKey(key);
    if (!n) return null;
    const first = !n.talked;
    n.talked = true;
    const line = first ? n.hi[rung(n.key)] : (n.lines && n.lines.length ? n.lines[Math.floor(hourNow()) % n.lines.length] : n.tap);
    met(n.key);
    return { key: n.key, name: n.name, role: n.role || '', line: fill(line), outfit: n.outfit, at: { x: n.x, y: n.y } };
  }
  function standBy(key) {   // where the player waits to talk: beside them, never on them
    const n = byKey(key);
    if (!n || n.hidden) return null;
    return { x: n.x, y: n.y };
  }

  // ---- drawing: only when the frame changes
  function draw(n, frame) {
    const k = frame + ':' + n.tool;
    if (n.drawn === k) return;
    n.drawn = k;
    drawComposite(n.ctx, 150, frame, n.outfit);
  }
  function placeEl(n) {
    if (n.x === n.px && n.y === n.py) return;
    n.px = n.x; n.py = n.y;
    n.el.style.left = pct(n.x, W); n.el.style.top = pct(n.y, H); n.el.style.zIndex = String(100 + Math.round(n.y));
  }
  function step(n, tx, ty, dt) {   // one step toward (tx, ty); true when there
    const dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy), s = WALK * dt;
    if (d <= s) { n.x = tx; n.y = ty; return true; }
    n.x += dx / d * s; n.y += dy / d * s;
    n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : 'front';
    return false;
  }

  function tick(now, dt) {
    if (!ready) return;
    const beat = beatOf(hourNow());
    if (beat !== curBeat) changeBeat(beat, true);
    const bob = Math.floor(now / BOB_MS) % 2;
    for (const n of res) {
      let frame;
      if (n.path.length) {
        if (n.wait > 0) { n.wait -= dt * 1000; frame = FACE_FRAME[n.face]; }
        else {
          n.walking = true;
          const p = n.path[0];
          if (step(n, p[0], p[1], dt)) { n.path.shift(); if (!n.path.length) arrive(n); }
          frame = (n.dir === 'left' ? 4 : n.dir === 'right' ? 0 : 2) + bob;
        }
      } else if (n.loop && !n.hidden) {
        n.walking = true;
        const p = n.loop[n.li];
        if (step(n, p[0], p[1], dt)) {
          if (n.li + n.ldir >= n.loop.length || n.li + n.ldir < 0) n.ldir = -n.ldir;
          n.li += n.ldir;
        }
        frame = (n.dir === 'left' ? 4 : n.dir === 'right' ? 0 : 2) + bob;
      } else {
        n.walking = false;
        frame = FACE_FRAME[n.face] || 2;
      }
      if (n.hidden) continue;
      draw(n, frame);
      placeEl(n);
      // the act
      if (n.act === 'sweep' && !n.path.length && now - lastSweep > 900) {
        const f = flyers.find((q) => !q.gone && Math.hypot(q.x - n.x, q.y - n.y) < SWEEP_R);
        if (f) { takeFlyer(f); lastSweep = now; }
      }
      if (n.act === 'water' && !n.path.length) {
        if (!n.lastWater) n.lastWater = now - 6500;
        if (now - n.lastWater > 8000) {
          n.lastWater = now;
          const beds = BEDS[n.place] || [[n.x, n.y]];
          const b = beds[n.bedI++ % beds.length];
          poof(b[0], b[1]);
        }
      }
    }
  }

  // ---- hit-testing for the tap handler: a flyer first (small), then a resident
  function at(wx, wy) {
    for (const f of flyers) if (!f.gone && Math.abs(wx - f.x) < 24 && wy < f.y + 8 && wy > f.y - 30) return ['flyer', f.i];
    for (const n of res) if (!n.hidden && Math.abs(wx - n.x) < 34 && wy < n.y + 6 && wy > n.y - 90) return ['npc', n.key];
    return null;
  }
  const flyer = (i) => { const f = flyers.find((q) => q.i === i && !q.gone); return f ? { x: f.x, y: f.y } : null; };

  function start() {
    ready = true;
    changeBeat(beatOf(hourNow()), false);
  }
  // the QA seam (window.__town.life)
  const seam = {
    hour: () => hourNow(),
    set: (h) => { setHour = h == null ? null : +h; setAt = performance.now(); if (ready) changeBeat(beatOf(hourNow()), false); },
    residents: () => res.map((n) => ({ key: n.key, x: Math.round(n.x), y: Math.round(n.y), beat: BEATS[n.beat] || '', place: n.place, act: n.act, tool: n.tool || 'none', walking: n.walking, hidden: n.hidden })),
    litter: () => flyers.filter((f) => !f.gone).length,
    rung,
    talk,
    facing: () => res.filter((n) => !n.hidden).map((n) => ({ key: n.key, face: n.face, place: n.place })),
    pick,
    mayor: () => !!(mayorEl && !mayorEl.hidden),
  };
  return { tick, at, talk, standBy, pick, flyer, start, seam };
}
