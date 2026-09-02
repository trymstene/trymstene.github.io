// 🍳🧶 THE KITCHEN + THE TAILOR — a lazy chunk, loaded on the first
// stove, fire or tailor open (the yard's hot path stays under its budget).
// Everything it needs arrives once through ctx (the phone chunk's ctx);
// `state`, `inside` and `visiting` are LIVE getters.
import { KNIT_SVG } from '../data/knitwear.js';
let C = null;
let CROP_EMO, DISHES, bondUp, buffGet, buffSet, cookEl, farmAnimals, farmStats, he0, hens, passStat, phone, refreshHud, save, syncLock, tailorEl, toast, track, track1;
export function init(ctx) {
  C = ctx;
  ({ CROP_EMO, DISHES, bondUp, buffGet, buffSet, cookEl, farmAnimals, farmStats, he0, hens, passStat, phone, refreshHud, save, syncLock, tailorEl, toast, track, track1 } = ctx);
}

// ---- 🍳 THE KITCHEN — a stove you WATCH (Trym: "pressing a button and it
// prints a dish is doing taxes"). Three parts, named on screen: the shelf
// (what you have), the recipes (have/need per ingredient, cookable first)
// and the ritual: burners light, the pan sizzles, a bar fills, the dish
// lands on the counter with its payout line. Opened from the stove in the
// house or the lit campfire in the yard — the fire plays the same ritual
// on the tripod pot. Ingredient art = the farm's 32px icon family, the
// park's own flowers; dishes = the pack's plated singles.
const KICON = { egg: 'm-egg', milk: 'm-milk', cheese: 'm-cheese', radish: 'm-radish', carrot: 'm-carrot',
  tomato: 'm-tomato', pumpkin: 'm-pumpkin', wheat: 'm-wheat', strawberry: 'm-strawberry', corn: 'm-corn',
  watermelon: 'm-watermelon', grape: 'm-grape', pineapple: 'm-pineapple', prickly: 'm-prickly' };
const kIcon = (k) => KICON[k] ? "<img src='/assets/homestead/" + KICON[k] + ".png' alt=''>"
  : (k === 'daisy' || k === 'sunflower' || k === 'tulip') ? "<img src='/assets/park/g-" + k + ".png' alt=''>" : (CROP_EMO[k] || '');
const kPlate = (d) => d.id === 'bouquet' ? '/assets/homestead/d-sunvase.png' : '/assets/homestead/f-' + d.id + '.png';
let cookAt = 'stove', cookBusy = null, cookTimer = 0;   // the door it opened from; the dish on the go
const dishOf = (id) => DISHES.find((d) => d.id === id);
// 🍽 TREAT QUALITIES (Trym): a hearts ladder per dish, and every species
// has ONE favourite dish worth +2 more — said on the recipe row (so you cook
// for someone) and again on her tile in the picker
const TREAT_BASE = { fried: 1, greens: 2, bouquet: 2, soup: 3, board: 4 };
const FAVE = { hen: 'greens', rooster: 'fried', goat: 'bouquet', sheep: 'soup', cow: 'board', dog: 'fried' };
const FAVE_W = { hen: 'hens’', rooster: 'roosters’', goat: 'goats’', sheep: 'sheep’s', cow: 'cows’', dog: 'dogs’' };
const isFave = (d, a) => !!a && FAVE[a.sp] === d.id;
const treatN = (d, a) => (TREAT_BASE[d.id] || 1) + (isFave(d, a) ? 2 : 0);
const faveWord = (d) => {
  const who = Object.keys(FAVE).filter((sp) => FAVE[sp] === d.id).map((sp) => FAVE_W[sp]);
  return who.length ? ' · ' + who.join(' and ') + ' favourite' : '';
};
function renderCook(keepNote) {
  const pan = document.getElementById('hsPantry');
  pan.replaceChildren();
  const P = C.state.pantry || (C.state.pantry = {});
  // ⚠️ ONLY WHAT YOU HAVE — a chip per crop (14 × 0) once pushed the dishes off the phone
  const held = Object.keys(P).filter((k) => (P[k] || 0) > 0);
  held.forEach((k) => {
    const b = document.createElement('span');
    b.className = 'hs-kchip';
    b.innerHTML = kIcon(k) + '× ' + P[k];
    pan.appendChild(b);
  });
  if (!held.length) {
    const b = document.createElement('span');
    b.className = 'hs-kempty';
    b.textContent = 'nothing on the shelf yet — harvest a bed, or send eggs and milk over from the stall';
    pan.appendChild(b);
  }
  const buff = buffGet();
  const note = document.getElementById('hsCookNote');
  if (!keepNote && !cookBusy && !C.state.plate) {
    note.classList.toggle('is-buff', !!buff);
    note.textContent = buff
      ? '✨ ' + (buff.fx === 'coins2' ? 'double coins' : 'double XP') + ' is on — '
        + Math.max(1, Math.round((buff.until - Date.now()) / 60000)) + ' min left'
      : cookAt === 'fire' ? 'the fire is lit — pick a dish' : 'the stove is cold — pick a dish';
  }
  const list = document.getElementById('hsCookList');
  list.classList.remove('hs-krecipes--tiles');
  list.replaceChildren();
  const can = (d) => Object.entries(d.need).every(([k, n]) => (P[k] || 0) >= n);
  DISHES.slice().sort((a, b) => can(b) - can(a)).forEach((d) => {
    const ok = can(d), busy = !!(d.fx && buff);   // one pot, one simmer at a time
    const short = Object.entries(d.need).find(([k, n]) => (P[k] || 0) < n);
    const row = document.createElement('div');
    row.className = 'hs-krow' + (ok && !busy && !cookBusy ? '' : ' is-dim');
    row.innerHTML = "<span class='hs-kthumb'><img src='" + kPlate(d) + "' alt=''></span><div class='hs-kmain'><b></b><small></small><div class='hs-kneeds'>"
      + Object.entries(d.need).map(([k, n]) => "<span class='hs-kneed" + ((P[k] || 0) >= n ? '' : ' is-short') + "'>"
        + kIcon(k) + Math.min(P[k] || 0, n) + '/' + n + '</span>').join('')
      + "</div></div><div class='hs-kact'></div>";
    row.querySelector('b').textContent = d.name;
    row.querySelector('small').textContent = d.fx ? '✨ ' + d.blurb : '→ ' + d.pay + ' coins, or a +' + treatN(d) + ' ❤ treat' + faveWord(d);
    const btn = document.createElement('button');
    btn.className = 'hs-btn';
    btn.textContent = cookBusy ? 'busy' : busy ? 'pot’s busy' : ok ? 'cook' : 'need ' + short[0];
    btn.disabled = !ok || busy || !!cookBusy;
    btn.addEventListener('click', () => cookDish(d));
    row.querySelector('.hs-kact').appendChild(btn);
    list.appendChild(row);
  });
}
function cookDish(d) {
  if (cookBusy) return;
  if (C.state.plate) sellPlate(true);   // the counter holds one dish — cooking again sells the one waiting
  Object.entries(d.need).forEach(([k, n]) => { C.state.pantry[k] -= n; });
  const T = d.st === 'counter' ? 2200 : d.st === 'oven' ? 5000 : 4000;
  C.state.cooking = { id: d.id, until: Date.now() + T };   // survives a reload mid-cook
  save();
  startCookShow(d, T);
  track('homestead_cook', { dish: d.id, at: cookAt });
}
function startCookShow(d, T) {
  cookBusy = d;
  const stage = document.getElementById('hsKStage');
  stage.className = 'hs-kstage ' + (cookAt === 'fire' ? 'is-fire'
    : (d.st === 'oven' ? 'is-oven' : 'is-hob') + (d.st === 'pan' ? ' is-pan' : d.st === 'pot' ? ' is-pot' : ''));
  stage.style.setProperty('--cook', T + 'ms');
  document.getElementById('hsKPlate').querySelector('img').src = kPlate(d);
  document.getElementById('hsKFloat').textContent = d.fx ? '✨' : '';
  document.getElementById('hsKActs').replaceChildren();
  void stage.offsetWidth;   // flush the reset so the bar and the burners transition in
  stage.classList.add('is-on');
  const note = document.getElementById('hsCookNote');
  note.textContent = d.verb + '…';
  note.classList.remove('is-buff');
  renderCook(true);
  clearTimeout(cookTimer);
  cookTimer = setTimeout(() => finishDish(d), T);
}
function finishDish(d) {
  cookBusy = null; delete C.state.cooking;
  const stage = document.getElementById('hsKStage');
  stage.classList.remove('is-on'); stage.classList.add('is-done');
  const note = document.getElementById('hsCookNote');
  if (d.fx) { buffSet(d.fx, d.mins); note.textContent = d.name + ' — ' + d.blurb; note.classList.add('is-buff'); save(); renderCook(true); return; }
  // 🍽 a coin dish WAITS on the counter: sell it, or treat someone with it
  // (Trym: cashing a dish straight into coins felt like nothing happened)
  C.state.plate = d.id; save();
  showPlate(d);
  renderCook(true);
}
function showPlate(d) {
  const stage = document.getElementById('hsKStage');
  document.getElementById('hsKPlate').querySelector('img').src = kPlate(d);
  document.getElementById('hsKFloat').textContent = '';
  stage.classList.remove('is-on'); stage.classList.add('is-done');
  const note = document.getElementById('hsCookNote');
  note.classList.remove('is-buff');
  const canTreat = farmAnimals().length > 0;
  note.textContent = d.name + ' is ready — sell it' + (canTreat ? ', or treat someone' : '');
  const acts = document.getElementById('hsKActs');
  acts.replaceChildren();
  const sell = document.createElement('button');
  sell.className = 'hs-btn';
  sell.textContent = 'sell · +' + d.pay + ' 🪙';
  sell.addEventListener('click', () => sellPlate(false));
  acts.appendChild(sell);
  if (canTreat) {
    const tr = document.createElement('button');
    tr.className = 'hs-btn hs-btn--treat';
    tr.textContent = 'treat · +' + treatN(d) + ' ❤';   // the base; her tile says what SHE gets
    tr.addEventListener('click', () => openTreat(d));
    acts.appendChild(tr);
  }
}
function clearPlate() {
  C.state.plate = null;
  document.getElementById('hsKActs').replaceChildren();
  document.getElementById('hsKStage').classList.remove('is-done');
}
function sellPlate(quiet) {
  const d = dishOf(C.state.plate);
  if (!d) return;
  clearPlate();
  passStat('coins_earned', d.pay); refreshHud(); save();
  const note = document.getElementById('hsCookNote');
  note.classList.remove('is-buff');
  note.textContent = d.name + ' → ' + d.pay + ' coins in your wallet';
  if (quiet) toast('🪙 +' + d.pay + ' — sold the ' + d.name.toLowerCase(), 2600);
  track1('homestead_sell_dish', { dish: d.id });
}
function openTreat(d) {
  document.getElementById('hsKRecLabel').textContent = 'Who gets the ' + d.name.toLowerCase() + '?';
  const list = document.getElementById('hsCookList');
  phone().then((PH) => PH.renderTreat(list, d, (a) => treatN(d, a), (a) => isFave(d, a), (a) => giveTreat(a, d),
    () => { document.getElementById('hsKRecLabel').textContent = 'Recipes'; renderCook(true); }));
}
function giveTreat(a, d) {
  if (C.state.plate !== d.id) return;
  const n = treatN(d, a);
  clearPlate();
  bondUp(a, n, hens.find((o) => o.a === a));
  save();
  document.getElementById('hsKRecLabel').textContent = 'Recipes';
  const note = document.getElementById('hsCookNote');
  note.classList.remove('is-buff');
  note.textContent = (a.name || 'the ' + a.sp) + ' loved the ' + d.name.toLowerCase() + (isFave(d, a) ? ' — ' + (he0(a) ? 'his' : 'her') + ' favourite! +' : ' — +') + n + ' ❤';
  track1('homestead_treat', { dish: d.id, sp: a.sp });
  renderCook(true);
}
export function openCook(where) {
  cookAt = where === 'fire' ? 'fire' : 'stove';
  document.getElementById('hsCookTitle').textContent = cookAt === 'fire' ? '🔥 The fire' : '🍳 The kitchen';
  document.getElementById('hsKRecLabel').textContent = 'Recipes';
  cookEl.hidden = false; syncLock();
  track('homestead_kitchen', { at: cookAt });
  if (cookBusy) { renderCook(true); return; }
  if (C.state.cooking) {
    // a dish left on the heat (the page reloaded mid-cook) picks up where it was
    const d = dishOf(C.state.cooking.id), left = C.state.cooking.until - Date.now();
    if (d && left > 0) { startCookShow(d, left); return; }
    if (d) { renderCook(); finishDish(d); return; }
    delete C.state.cooking;
  }
  document.getElementById('hsKStage').className = 'hs-kstage' + (cookAt === 'fire' ? ' is-fire' : '');
  document.getElementById('hsKActs').replaceChildren();
  renderCook();
  const waiting = dishOf(C.state.plate);
  if (waiting) showPlate(waiting); else C.state.plate = null;
}
// ---- 🧶 THE TAILOR — the Threadneedle road: a sheep's wool becomes
// knitwear at a table in the yard. The FIRST of each pattern is yours to
// wear (a pass stat the builder and the rave read: earned:'homestead');
// every one after sells for more than the raw wool ever could. Same
// grammar as the kitchen: a stage you watch, the shelf, the patterns.
const KNITS = [
  { id: 'woolbeanie', name: 'Wool beanie', wool: 3, pay: 50, wear: 'hat' },
  { id: 'woolscarf', name: 'Wool scarf', wool: 4, pay: 70, wear: 'neck' },
];
let knitBusy = null, knitTimer = 0;
const knitOwned = (k) => (farmStats()['knit_' + k.id] || 0) > 0;
const knitArt = (k, px) => KNIT_SVG[k.id].replace('<svg ', '<svg style="width:' + px + 'px;height:auto" ');
function renderTailor(keepNote) {
  const wool = C.state.wool || 0;
  const sh = document.getElementById('hsTShelf');
  sh.replaceChildren();
  const chip = document.createElement('span');
  chip.className = wool ? 'hs-kchip' : 'hs-kempty';
  if (wool) chip.innerHTML = "<img src='/assets/homestead/m-wool.png' alt=''>× " + wool;
  else chip.textContent = 'no wool yet — a sheep grows a coat in three days, then you shear it';
  sh.appendChild(chip);
  const note = document.getElementById('hsTNote');
  if (!keepNote && !knitBusy) note.textContent = wool ? 'the needles are still — pick a pattern' : 'the needles are still';
  const list = document.getElementById('hsTList');
  list.replaceChildren();
  KNITS.forEach((k) => {
    const ok = wool >= k.wool, own = knitOwned(k);
    const row = document.createElement('div');
    row.className = 'hs-krow' + (ok && !knitBusy ? '' : ' is-dim');
    row.innerHTML = "<span class='hs-kthumb hs-kthumb--knit'>" + knitArt(k, 38) + "</span><div class='hs-kmain'><b></b><small></small><div class='hs-kneeds'>"
      + "<span class='hs-kneed" + (ok ? '' : ' is-short') + "'><img src='/assets/homestead/m-wool.png' alt=''>" + Math.min(wool, k.wool) + '/' + k.wool + "</span></div></div><div class='hs-kact'></div>";
    row.querySelector('b').textContent = k.name;
    row.querySelector('small').textContent = own ? 'in your wardrobe · the next sells for ' + k.pay + ' coins' : 'the first one is yours to wear';
    const act = row.querySelector('.hs-kact');
    const btn = document.createElement('button');
    btn.className = 'hs-btn';
    btn.textContent = knitBusy ? 'busy' : ok ? 'knit' : 'need ' + (k.wool - wool) + ' wool';
    btn.disabled = !ok || !!knitBusy;
    btn.addEventListener('click', () => knitPattern(k));
    act.appendChild(btn);
    if (own) {
      const w = document.createElement('a');
      w.className = 'hs-btn';
      w.href = '/make-a-banana/?wear=' + k.id;
      w.textContent = 'wear it';
      act.appendChild(w);
    }
    list.appendChild(row);
  });
}
function knitPattern(k) {
  if (knitBusy || (C.state.wool || 0) < k.wool) return;
  C.state.wool -= k.wool; save();
  knitBusy = k;
  const stage = document.getElementById('hsTStage');
  stage.classList.remove('is-done');
  stage.style.setProperty('--cook', '4000ms');
  const kn = document.getElementById('hsTKnit');
  kn.className = 'hs-tknit ' + (k.wear === 'hat' ? 'is-hat' : 'is-neck');
  kn.innerHTML = knitArt(k, 46);
  void stage.offsetWidth;
  stage.classList.add('is-on');
  document.getElementById('hsTNote').textContent = 'knitting…';
  renderTailor(true);
  clearTimeout(knitTimer);
  knitTimer = setTimeout(() => {
    knitBusy = null;
    stage.classList.remove('is-on'); stage.classList.add('is-done');
    const first = !knitOwned(k);
    const note = document.getElementById('hsTNote');
    if (first) {
      passStat('knit_' + k.id, 1);
      note.textContent = k.name + ' — yours. it’s in your wardrobe, at the rave too';
      toast('🧶 ' + k.name.toLowerCase() + ' — knitted. wear it from the builder', 4200);
    } else {
      passStat('coins_earned', k.pay); refreshHud();
      note.textContent = k.name + ' → ' + k.pay + ' coins in your wallet';
    }
    save();
    track1('homestead_knit', { pattern: k.id, first: first ? 1 : 0 });
    renderTailor(true);
  }, 4000);
}
export function openTailor() {
  tailorEl.hidden = false; syncLock();
  if (!knitBusy) document.getElementById('hsTStage').className = 'hs-kstage hs-tstage';
  renderTailor();
  track('homestead_tailor');
}
