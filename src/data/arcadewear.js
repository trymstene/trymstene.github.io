// 🕹 ARCADE WEAR — the prizes the town's Arcade boards hand out (12 Sep 2026).
// Drawn in the banana's own hat grammar (10px cells, #111 outline; hats on a
// 120–140 wide box with seat -1, hand items sized like the glowstick, the medal
// on the participation medal's 120×120 box). Won on a board, never bought: the
// pass worker grants own_<id> the admin way, the builder reads the stat.
const B = (x, y, w, h, c) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c + '"/>';
const K = '#111111', MAG = '#ff2fa0', CYAN = '#2ee6ff', CYAN2 = '#1aa9c2', GOLD = '#f2c200', GOLD2 = '#c49a00', GLOW = '#fff3a0',
  RED = '#e22020', RED2 = '#ff6a6a', NAVY = '#1a1a40', GREY = '#9a9a9a', GREY2 = '#6e6e6e', DARK = '#2b2b2b', GREEN = '#39ff14';
const svg = (w, h, body) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" shape-rendering="crispEdges">' + body + '</svg>';

// a dark headband with magenta pixels and a cyan visor brim — 10 on the Peel Out board
const arcvisor = svg(130, 60,
  B(10, 0, 110, 10, K)
  + B(0, 10, 10, 10, K) + B(10, 10, 110, 10, DARK) + B(120, 10, 10, 10, K)
  + B(20, 10, 10, 10, MAG) + B(50, 10, 10, 10, MAG) + B(80, 10, 10, 10, MAG) + B(110, 10, 10, 10, MAG)
  + B(0, 20, 10, 10, K) + B(10, 20, 110, 10, DARK) + B(120, 20, 10, 10, K)
  + B(0, 30, 10, 10, K) + B(10, 30, 110, 10, CYAN) + B(120, 30, 10, 10, K)
  + B(10, 40, 10, 10, K) + B(20, 40, 90, 10, CYAN2) + B(110, 40, 10, 10, K)
  + B(20, 50, 90, 10, K));

// an 8-bit crown: three square blocks, cyan and magenta gems — 15 on the Banana Snake board
const pixelcrown = svg(130, 80,
  B(10, 0, 30, 10, K) + B(50, 0, 30, 10, K) + B(90, 0, 30, 10, K)
  + B(10, 10, 10, 10, K) + B(20, 10, 10, 10, CYAN) + B(30, 10, 10, 10, K)
  + B(50, 10, 10, 10, K) + B(60, 10, 10, 10, MAG) + B(70, 10, 10, 10, K)
  + B(90, 10, 10, 10, K) + B(100, 10, 10, 10, CYAN) + B(110, 10, 10, 10, K)
  + B(0, 20, 10, 10, K) + B(10, 20, 30, 10, GOLD) + B(40, 20, 10, 10, K) + B(50, 20, 30, 10, GOLD) + B(80, 20, 10, 10, K) + B(90, 20, 30, 10, GOLD) + B(120, 20, 10, 10, K)
  + B(0, 30, 10, 10, K) + B(10, 30, 110, 10, GOLD) + B(120, 30, 10, 10, K)
  + B(0, 40, 10, 10, K) + B(10, 40, 110, 10, GOLD) + B(120, 40, 10, 10, K)
  + B(30, 40, 10, 10, MAG) + B(60, 40, 10, 10, CYAN) + B(90, 40, 10, 10, MAG)
  + B(0, 50, 10, 10, K) + B(10, 50, 110, 10, GOLD) + B(120, 50, 10, 10, K)
  + B(0, 60, 10, 10, K) + B(10, 60, 110, 10, GOLD2) + B(120, 60, 10, 10, K)
  + B(10, 70, 110, 10, K));

// a navy cap with cyan pixels, a magenta brim and a red joystick ball on top — 15 on the Banana Stack board
const joycap = svg(140, 90,
  B(60, 0, 20, 10, K)
  + B(50, 10, 10, 10, K) + B(60, 10, 10, 10, RED2) + B(70, 10, 10, 10, RED) + B(80, 10, 10, 10, K)
  + B(50, 20, 10, 10, K) + B(60, 20, 20, 10, RED) + B(80, 20, 10, 10, K)
  + B(60, 30, 20, 10, K)
  + B(30, 40, 80, 10, K)
  + B(20, 50, 10, 10, K) + B(30, 50, 80, 10, NAVY) + B(110, 50, 10, 10, K)
  + B(10, 60, 10, 10, K) + B(20, 60, 100, 10, NAVY) + B(120, 60, 10, 10, K)
  + B(40, 60, 10, 10, CYAN) + B(70, 60, 10, 10, CYAN) + B(100, 60, 10, 10, CYAN)
  + B(0, 70, 10, 10, K) + B(10, 70, 120, 10, MAG) + B(130, 70, 10, 10, K)
  + B(0, 80, 140, 10, K));

// a joystick: red ball, black stick, a grey base with two buttons; the glove wraps the base
const joystick = svg(80, 100,
  B(20, 0, 30, 10, K)
  + B(10, 10, 10, 10, K) + B(20, 10, 10, 10, RED2) + B(30, 10, 20, 10, RED) + B(50, 10, 10, 10, K)
  + B(10, 20, 10, 10, K) + B(20, 20, 30, 10, RED) + B(50, 20, 10, 10, K)
  + B(20, 30, 30, 10, K)
  + B(30, 40, 10, 20, K)
  + B(0, 60, 80, 10, K)
  + B(0, 70, 10, 10, K) + B(10, 70, 40, 10, GREY) + B(50, 70, 10, 10, CYAN) + B(60, 70, 10, 10, MAG) + B(70, 70, 10, 10, K)
  + B(0, 80, 10, 10, K) + B(10, 80, 60, 10, GREY2) + B(70, 80, 10, 10, K)
  + B(0, 90, 80, 10, K));

// a gold token with a pixel star, held between two fingers
const goldtoken = svg(70, 70,
  B(20, 0, 30, 10, K)
  + B(10, 10, 10, 10, K) + B(20, 10, 10, 10, GLOW) + B(30, 10, 20, 10, GOLD) + B(50, 10, 10, 10, K)
  + B(0, 20, 10, 10, K) + B(10, 20, 20, 10, GOLD) + B(30, 20, 10, 10, GOLD2) + B(40, 20, 20, 10, GOLD) + B(60, 20, 10, 10, K)
  + B(0, 30, 10, 10, K) + B(10, 30, 10, 10, GOLD) + B(20, 30, 30, 10, GOLD2) + B(50, 30, 10, 10, GOLD) + B(60, 30, 10, 10, K)
  + B(0, 40, 10, 10, K) + B(10, 40, 20, 10, GOLD) + B(30, 40, 10, 10, GOLD2) + B(40, 40, 20, 10, GOLD) + B(60, 40, 10, 10, K)
  + B(10, 50, 10, 10, K) + B(20, 50, 30, 10, GOLD2) + B(50, 50, 10, 10, K)
  + B(20, 60, 30, 10, K));

// the Arcade trophy: a golden miniature cabinet, a magenta marquee, a lit screen — a score on every board
const arctrophy = svg(80, 120,
  B(10, 0, 60, 10, K)
  + B(0, 10, 10, 10, K) + B(10, 10, 60, 10, MAG) + B(70, 10, 10, 10, K)
  + B(0, 20, 10, 10, K) + B(10, 20, 60, 10, GOLD) + B(70, 20, 10, 10, K)
  + B(0, 30, 10, 10, K) + B(10, 30, 10, 10, GOLD) + B(20, 30, 40, 10, K) + B(60, 30, 10, 10, GOLD) + B(70, 30, 10, 10, K)
  + B(0, 40, 10, 10, K) + B(10, 40, 10, 10, GOLD) + B(20, 40, 10, 10, K) + B(30, 40, 20, 10, GREEN) + B(50, 40, 10, 10, K) + B(60, 40, 10, 10, GOLD) + B(70, 40, 10, 10, K)
  + B(0, 50, 10, 10, K) + B(10, 50, 10, 10, GOLD) + B(20, 50, 10, 10, K) + B(30, 50, 10, 10, NAVY) + B(40, 50, 10, 10, GREEN) + B(50, 50, 10, 10, K) + B(60, 50, 10, 10, GOLD) + B(70, 50, 10, 10, K)
  + B(0, 60, 10, 10, K) + B(10, 60, 10, 10, GOLD) + B(20, 60, 40, 10, K) + B(60, 60, 10, 10, GOLD) + B(70, 60, 10, 10, K)
  + B(0, 70, 10, 10, K) + B(10, 70, 60, 10, GOLD2) + B(70, 70, 10, 10, K) + B(30, 70, 10, 10, RED) + B(50, 70, 10, 10, CYAN)
  + B(0, 80, 10, 10, K) + B(10, 80, 60, 10, GOLD) + B(70, 80, 10, 10, K)
  + B(0, 90, 10, 10, K) + B(10, 90, 60, 10, GOLD) + B(70, 90, 10, 10, K)
  + B(0, 100, 10, 10, K) + B(10, 100, 60, 10, GOLD2) + B(70, 100, 10, 10, K)
  + B(0, 110, 80, 10, K));

// the Arcade medal: a cyan ribbon, a gold disc with a magenta pixel star — a top three on any board
const arcmedal = svg(120, 120,
  B(0, 0, 20, 10, CYAN) + B(100, 0, 10, 10, CYAN) + B(110, 0, 10, 10, CYAN2)
  + B(10, 10, 20, 10, CYAN) + B(90, 10, 10, 10, CYAN) + B(100, 10, 10, 10, CYAN2)
  + B(20, 20, 20, 10, CYAN) + B(80, 20, 10, 10, CYAN) + B(90, 20, 10, 10, CYAN2)
  + B(30, 30, 20, 10, CYAN) + B(70, 30, 10, 10, CYAN) + B(80, 30, 10, 10, CYAN2)
  + B(40, 40, 30, 10, CYAN) + B(70, 40, 10, 10, CYAN2)
  + B(30, 50, 10, 10, GOLD2) + B(40, 50, 40, 10, GOLD) + B(80, 50, 10, 10, GOLD2)
  + B(20, 60, 10, 10, GOLD2) + B(30, 60, 60, 10, GOLD) + B(90, 60, 10, 10, GOLD2) + B(50, 60, 10, 10, MAG) + B(40, 60, 10, 10, GLOW)
  + B(20, 70, 10, 10, GOLD2) + B(30, 70, 60, 10, GOLD) + B(90, 70, 10, 10, GOLD2) + B(40, 70, 30, 10, MAG)
  + B(20, 80, 10, 10, GOLD2) + B(30, 80, 60, 10, GOLD) + B(90, 80, 10, 10, GOLD2) + B(50, 80, 10, 10, MAG)
  + B(20, 90, 10, 10, GOLD2) + B(30, 90, 60, 10, GOLD) + B(90, 90, 10, 10, GOLD2)
  + B(30, 100, 10, 10, GOLD2) + B(40, 100, 40, 10, GOLD) + B(80, 100, 10, 10, GOLD2)
  + B(40, 110, 40, 10, GOLD2));

export const ARCADE_SVG = { arcvisor, pixelcrown, joycap, joystick, goldtoken, arctrophy, arcmedal };
