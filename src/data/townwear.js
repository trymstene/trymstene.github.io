// 🏘️ TOWN WEAR — the hand tools the town's residents carry (12 Sep 2026).
// Drawn in the banana's own hat grammar (10px cells, #111 outline, hand items
// sized like the glowstick). Draw-time only: registered raveOnly in
// src/data/wearables.js, never a builder chip, never in the daily banana.
const B = (x, y, w, h, c) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + c + '"/>';
const K = '#111111', PAPER = '#fffdf5', PAPER2 = '#d9d2c6', INK = '#8890a8', RED = '#e22020', RED2 = '#ff6a6a',
  LEMON = '#ffd23f', FLESH = '#fff6c2', ADE = '#ffe680', ADE2 = '#f2c200', GLASS = '#dff4ff', DROP = '#7ec8ff',
  TIN = '#3f9b4a', TIN2 = '#2f7a38', TIN3 = '#8fd18f', ROSE = '#d9d9d9';
const svg = (w, h, body) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" shape-rendering="crispEdges">' + body + '</svg>';

// Stamp's letter: a white envelope with a red stamp in the corner, held like evidence
const letter = svg(110, 80,
  B(0, 0, 110, 10, K)
  + B(0, 10, 10, 10, K) + B(10, 10, 60, 10, PAPER) + B(70, 10, 30, 10, RED) + B(100, 10, 10, 10, K)
  + B(0, 20, 10, 10, K) + B(10, 20, 60, 10, PAPER) + B(70, 20, 10, 10, RED) + B(80, 20, 10, 10, RED2) + B(90, 20, 10, 10, RED) + B(100, 20, 10, 10, K)
  + B(0, 30, 10, 10, K) + B(10, 30, 60, 10, PAPER) + B(70, 30, 30, 10, RED) + B(100, 30, 10, 10, K)
  + B(0, 40, 10, 10, K) + B(10, 40, 10, 10, PAPER) + B(20, 40, 40, 10, INK) + B(60, 40, 40, 10, PAPER) + B(100, 40, 10, 10, K)
  + B(0, 50, 10, 10, K) + B(10, 50, 10, 10, PAPER) + B(20, 50, 60, 10, INK) + B(80, 50, 20, 10, PAPER) + B(100, 50, 10, 10, K)
  + B(0, 60, 10, 10, K) + B(10, 60, 80, 10, PAPER) + B(90, 60, 10, 10, PAPER2) + B(100, 60, 10, 10, K)
  + B(0, 70, 110, 10, K));

// Fig Jr.'s jug: a glass jug of lemonade, a lemon wheel hooked on the rim, sweating
const lemonjug = svg(100, 130,
  B(10, 0, 30, 10, K)
  + B(0, 10, 10, 10, K) + B(10, 10, 30, 10, LEMON) + B(40, 10, 10, 10, K)
  + B(0, 20, 10, 10, K) + B(10, 20, 10, 10, LEMON) + B(20, 20, 10, 10, FLESH) + B(30, 20, 10, 10, LEMON) + B(40, 20, 10, 10, K)
  + B(0, 30, 10, 10, K) + B(10, 30, 30, 10, LEMON) + B(40, 30, 50, 10, K)
  + B(10, 40, 30, 10, K) + B(40, 40, 10, 10, GLASS) + B(50, 40, 20, 10, ADE) + B(70, 40, 10, 10, K) + B(90, 40, 10, 10, K)
  + B(10, 50, 10, 10, K) + B(20, 50, 10, 10, GLASS) + B(30, 50, 40, 10, ADE) + B(70, 50, 10, 10, K) + B(90, 50, 10, 10, K)
  + B(10, 60, 10, 10, K) + B(20, 60, 10, 10, GLASS) + B(30, 60, 10, 10, ADE) + B(40, 60, 10, 10, DROP) + B(50, 60, 20, 10, ADE) + B(70, 60, 10, 10, K) + B(90, 60, 10, 10, K)
  + B(10, 70, 10, 10, K) + B(20, 70, 10, 10, GLASS) + B(30, 70, 30, 10, ADE) + B(60, 70, 10, 10, ADE2) + B(70, 70, 10, 10, K) + B(90, 70, 10, 10, K)
  + B(10, 80, 10, 10, K) + B(20, 80, 10, 10, GLASS) + B(30, 80, 30, 10, ADE) + B(60, 80, 10, 10, ADE2) + B(70, 80, 20, 10, K)
  + B(10, 90, 10, 10, K) + B(20, 90, 10, 10, GLASS) + B(30, 90, 10, 10, DROP) + B(40, 90, 20, 10, ADE) + B(60, 90, 10, 10, ADE2) + B(70, 90, 10, 10, K)
  + B(10, 100, 10, 10, K) + B(20, 100, 10, 10, GLASS) + B(30, 100, 20, 10, ADE) + B(50, 100, 20, 10, ADE2) + B(70, 100, 10, 10, K)
  + B(10, 110, 10, 10, K) + B(20, 110, 50, 10, ADE2) + B(70, 110, 10, 10, K)
  + B(10, 120, 70, 10, K));

// Gran Fig's watering can: green tin, a dent in its side, a hoop on top, always full (it drips)
const wateringcan = svg(120, 120,
  B(60, 0, 40, 10, K)
  + B(0, 10, 30, 10, K) + B(50, 10, 10, 10, K) + B(60, 10, 40, 10, TIN) + B(100, 10, 10, 10, K)
  + B(0, 20, 10, 10, K) + B(10, 20, 20, 10, ROSE) + B(30, 20, 10, 10, K) + B(50, 20, 10, 10, K) + B(60, 20, 10, 10, TIN) + B(90, 20, 10, 10, TIN) + B(100, 20, 10, 10, K)
  + B(0, 30, 10, 10, K) + B(10, 30, 20, 10, ROSE) + B(30, 30, 90, 10, K)
  + B(0, 40, 10, 10, DROP) + B(10, 40, 10, 10, K) + B(20, 40, 20, 10, TIN) + B(40, 40, 10, 10, K) + B(50, 40, 60, 10, TIN) + B(110, 40, 10, 10, K)
  + B(20, 50, 10, 10, K) + B(30, 50, 40, 10, TIN) + B(70, 50, 10, 10, TIN3) + B(80, 50, 30, 10, TIN) + B(110, 50, 10, 10, K)
  + B(30, 60, 10, 10, K) + B(40, 60, 40, 10, TIN) + B(80, 60, 20, 10, TIN2) + B(100, 60, 10, 10, TIN) + B(110, 60, 10, 10, K)
  + B(40, 70, 10, 10, K) + B(50, 70, 30, 10, TIN) + B(80, 70, 20, 10, TIN2) + B(100, 70, 10, 10, TIN) + B(110, 70, 10, 10, K)
  + B(40, 80, 10, 10, K) + B(50, 80, 60, 10, TIN) + B(110, 80, 10, 10, K)
  + B(40, 90, 10, 10, K) + B(50, 90, 60, 10, TIN) + B(110, 90, 10, 10, K)
  + B(40, 100, 10, 10, K) + B(50, 100, 60, 10, TIN2) + B(110, 100, 10, 10, K)
  + B(40, 110, 80, 10, K));

export const TOWN_SVG = { letter, lemonjug, wateringcan };
