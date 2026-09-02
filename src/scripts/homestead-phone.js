// 📱 THE BANANA PHONE + THE ANIMAL CARD — a lazy chunk, loaded on the
// first phone or card open (the yard's hot path stays under its budget).
// Everything it needs arrives once through ctx; `state`, `inside` and
// `visiting` are LIVE getters because the main module reassigns them.
let C = null;
let CHEESE_C, COIN, DEX, EGG_C, INCAP, MILK_C, STALL_CAP, WOOL_C, bestFriend, closeShop, dayNum, farmAnimals, farmMemory, fedToday, he0, inList, isIndoorItem, isYoungA, lvNext, lvOf, mintId, openShop, passSpend, passStat, penCaps, petEl, refreshHud, renderShop, save, shopHead, shopNote, spCount, spotOf, stallDay, stallSell, startPlacing, syncLock, toast, track, track1, traitsOf;
export function init(ctx) {
  C = ctx;
  ({ CHEESE_C, COIN, DEX, EGG_C, INCAP, MILK_C, STALL_CAP, WOOL_C, bestFriend, closeShop, dayNum, farmAnimals, farmMemory, fedToday, he0, inList, isIndoorItem, isYoungA, lvNext, lvOf, mintId, openShop, passSpend, passStat, penCaps, petEl, refreshHud, renderShop, save, shopHead, shopNote, spCount, spotOf, stallDay, stallSell, startPlacing, syncLock, toast, track, track1, traitsOf } = ctx);
}

// 🪪 THE CARD — her portrait, her level as dots, three stat tiles with
// icons, one concrete next-step line. Visuals first (Trym); names go in
// through textContent, never markup.
export function openPet(a) {
  if (!a) return;
  const box = document.getElementById('hsPetBody');
  const lv = lvOf(a), young = isYoungA(a), he = a.sp === 'rooster';
  const sp = THUMB[(young ? 'y' : '') + a.sp] || THUMB.hen;
  const badge = lv >= 10 ? 'crown-solid' : lv >= 5 ? 'star-solid' : '';
  const GOOD = { hen: ['m-egg.png', 'eggs'], goat: ['m-milk.png', 'cans'], cow: ['m-milk.png', 'cans'],
    sheep: ['m-wool.png', 'wool'], rooster: ['', 'mornings'], dog: ['', 'visits'] };
  const g = GOOD[a.sp] || GOOD.hen;
  const days = Math.max(0, dayNum() - (a.ad == null ? dayNum() : a.ad));
  const goodsN = a.sp === 'rooster' ? days : (a.gs || 0);
  const left = 5 - (a.gd || 0);
  const next = young
    ? 'fill the trough ' + left + ' more morning' + (left === 1 ? '' : 's') + ' — then ' + (he ? 'he' : 'she') + '’s grown'
    : lv >= 10 ? ''
    : lvNext(a) + ' hug' + (lvNext(a) === 1 ? '' : 's') + ' to Lv ' + (lv + 1)
      + (lv + 1 === 3 && !a.name ? ' — then you can name ' + (he ? 'him' : 'her')
        : lv + 1 === 5 ? ' — ' + (he ? 'he' : 'she') + '’ll meet you at the gate' : '');
  const icon = (nm, col) => "<span class='pai-m' style='--pai:url(/assets/pixelarticons-pro-2.2.1/svg/" + nm + ".svg);color:" + col + "'></span>";
  box.innerHTML = "<div class='hs-pethead'><span class='hs-petport" + (lv >= 10 ? ' hs-petport--best' : '') + "'>"
    + "<i style=\"background-image:url('/assets/homestead/" + sp[0] + "');width:" + Math.round(sp[3] * 1.45) + "px;aspect-ratio:" + sp[1] + "/" + sp[2] + "\"></i>"
    + (badge ? "<span class='hs-petbadge pai-m' style='--pai:url(/assets/pixelarticons-pro-2.2.1/svg/" + badge + ".svg);color:#d9a400'></span>" : '')
    + "</span><div class='hs-petname'><b class='" + (lv >= 10 ? 'is-best' : '') + "'></b><small></small>"
    + "<div class='hs-petlv'><span class='hs-rowbond" + (lv >= 10 ? ' hs-rowbond--love' : '') + "'>Lv " + lv + "</span><span class='hs-petdots'>"
    + Array.from({ length: 10 }, (_, i) => '<i' + (i < lv ? " class='on'" : '') + '></i>').join('') + "</span></div></div></div>"
    + (next ? "<p class='hs-petnext'></p>" : '')
    + (traitLine(a) ? "<p class='hs-pettrait'></p>" : '')
    + "<div class='hs-petstats'>"
    + "<div class='hs-petstat'>" + icon('heart-solid', '#e5566d') + "<div><span class='n'>" + (a.b || 0) + "</span><span class='l'>hugs</span></div></div>"
    + "<div class='hs-petstat'>" + (g[0] ? "<img src='/assets/homestead/" + g[0] + "' alt=''>" : icon(a.sp === 'dog' ? 'heart' : 'cake', '#b07d00'))
    + "<div><span class='n'>" + goodsN + "</span><span class='l'>" + g[1] + "</span></div></div>"
    + "<div class='hs-petstat'>" + icon('calendar', '#4a6b8a') + "<div><span class='n'>" + days + "</span><span class='l'>days</span></div></div>"
    + "</div><div class='hs-petacts'></div>";
  box.querySelector('.hs-petname b').textContent = a.name || (young ? 'little ' : 'unnamed ') + a.sp;
  if (lv >= 3) {
    const pen = document.createElement('button');
    pen.className = 'hs-petedit';
    pen.setAttribute('aria-label', a.name ? 'rename' : 'name her');
    pen.innerHTML = "<span class='pai-m' style='--pai:url(/assets/pixelarticons-pro-2.2.1/svg/edit.svg)'></span>";
    pen.addEventListener('click', () => petRename(a));
    box.querySelector('.hs-petname b').appendChild(pen);
  }
  box.querySelector('.hs-petname small').textContent = young ? (BABY_W[a.sp] || a.sp) + ' · growing up'
    : a.sp + ' · grown' + (lv >= 10 ? ' · best friends' : '');
  if (next) box.querySelector('.hs-petnext').textContent = next;
  if (traitLine(a)) box.querySelector('.hs-pettrait').textContent = traitLine(a);
  box.querySelector('.hs-petacts').appendChild(btnEl('↩ rehome', true, () => { petEl.hidden = true; syncLock(); openShop('animals'); }));
  petEl.hidden = false; syncLock();
  track1('homestead_pet_card', { lv });
}
export function petRename(a) {
  const b = document.querySelector('#hsPetBody .hs-petname b');
  if (!b || b.querySelector('input')) return;
  const he = he0(a);
  b.innerHTML = '';
  const inp = document.createElement('input');
  inp.type = 'text'; inp.maxLength = 20; inp.className = 'hs-nameinp';
  inp.placeholder = he ? 'his name…' : 'her name…';
  inp.value = a.name || '';
  const ok = document.createElement('button');
  ok.className = 'hs-petedit hs-petedit--ok';
  ok.setAttribute('aria-label', 'save name');
  ok.innerHTML = "<span class='pai-m' style='--pai:url(/assets/pixelarticons-pro-2.2.1/svg/check.svg)'></span>";
  const go = async () => {
    const v = (inp.value || '').trim().slice(0, 20);
    if (!v) { inp.focus(); return; }
    // ⚠️ one Gunnar per farm — the living AND the remembered
    const taken = (x) => x !== a && x.name && x.name.toLowerCase() === v.toLowerCase();
    if (farmAnimals().some(taken) || farmMemory().some(taken)) {
      toast('there’s already a ' + v + ' on this farm — every name is one of a kind');
      inp.focus(); return;
    }
    ok.disabled = true;
    let clean = true;
    try { clean = await import('../lib/sticker-core.js').then((m) => m.captionsClean({ top: v })); } catch (e) {}
    ok.disabled = false;
    if (!clean) { toast('let’s keep names family friendly — try another'); inp.focus(); return; }
    const first = !a.name;
    a.name = v;
    save();
    const bf = first ? bestFriend(a) : null;
    if (bf) {
      bf.visit = a.id;
      setTimeout(() => toast((bf.name || 'the ' + bf.sp) + ' came to hear ' + (he ? 'his' : 'her') + ' new name', 3600), 3800);
    }
    toast(first ? '❤️ ' + v + '! ' + (he ? 'he knows it’s you' : 'she knows it’s you')
      : (he ? 'he answers to ' : 'she answers to ') + v + ' now', 3600);
    track1(first ? 'homestead_name_animal' : 'homestead_rename_animal');
    openPet(a);
  };
  ok.addEventListener('click', go);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  b.appendChild(inp); b.appendChild(ok);
  inp.focus();
}
const SPOT_W = ['the trough', 'the well', 'the house', 'the coop', 'the fence'];
export function traitLine(a) {
  if (a.sp === 'dog') return '';
  const t = traitsOf(a), he = he0(a);
  const w = [];
  if (t.pace === 0) w.push('a dawdler'); else if (t.pace === 2) w.push('quick on ' + (he ? 'his' : 'her') + ' feet');
  if (t.pat === 0) w.push('restless'); else if (t.pat === 2) w.push('a dreamer');
  if (t.bold === 0) w.push('a bit shy'); else if (t.bold === 1) w.push('nosy');
  const f = bestFriend(a);
  if (f) w.push('inseparable from ' + (f.name || 'the ' + f.sp));
  const sp = spotOf(a);
  if (sp) w.push('you’ll find ' + (he ? 'him' : 'her') + ' by ' + SPOT_W[sp.k]);
  return w.join(' · ');
}
const BABY_W = { hen: 'chick', rooster: 'chick', goat: 'kid goat', sheep: 'lamb', cow: 'calf' };
// needs = the locked-row line; it speaks the SAME size-words as the
// fence card and the build-mode fence label, so they explain each other
const ANIMAL_SHOP = [
  { sp: 'hen', name: 'a hen', price: 12, needs: 'needs a hen-sized fence' },
  { sp: 'rooster', name: 'the rooster', price: 25, needs: '' },
  { sp: 'goat', name: 'a goat', price: 35, needs: 'needs a goat-sized fence' },
  { sp: 'sheep', name: 'a sheep', price: 45, needs: 'needs a sheep-sized fence' },
  { sp: 'cow', name: 'the cow', price: 90, needs: 'needs a cow-sized fence' },
  { sp: 'dog', name: 'the dog', price: 40, needs: '' },
];
// ---- 📱 THE PHONE ROW -------------------------------------------
// One shape for stall/market/animals/shed (Trym: "game UI, not web UI" —
// sprite left, words right, small buttons; an app list, not floating
// boxes). Thumbs are the game's OWN art: [strip, frameW, frameH, showW].
const THUMB = {
  hen: ['c-hen0.png', 32, 32, 32], rooster: ['c-roost.png', 48, 48, 40],
  goat: ['c-goat.png', 96, 78, 46], sheep: ['c-sheepf.png', 96, 57, 48],
  cow: ['c-cow.png', 144, 81, 52], dog: ['c-dogidle.png', 104, 66, 48],
  yhen: ['c-chick.png', 48, 30, 30], yrooster: ['c-chick.png', 48, 30, 30],
  ygoat: ['c-ygoat.png', 96, 57, 38], ysheep: ['c-ysheep.png', 96, 48, 38],
  ycow: ['c-ycow.png', 96, 60, 42],
};
function btnEl(html, ghost, fn) {
  const b = document.createElement('button');
  b.className = 'hs-btn' + (ghost ? ' hs-btn--ghost' : '');
  b.innerHTML = html;   // ⚠️ internal strings + COIN only — player names go in TITLES (textContent)
  if (fn) b.addEventListener('click', fn); else b.disabled = true;
  return b;
}
function rowEl(o) {
  const r = document.createElement('div');
  r.className = 'hs-row' + (o.dim ? ' hs-row--dim' : '');
  const t = document.createElement('span');
  t.className = 'hs-rowthumb';
  if (o.svg) { const sv = document.createElement('span'); sv.className = 'hs-tilesvg'; sv.innerHTML = o.svg; t.appendChild(sv); }
  else if (o.img) { const im = document.createElement('img'); im.src = o.img; im.alt = ''; t.appendChild(im); }
  else if (o.sprite && THUMB[o.sprite]) {
    const sp = THUMB[o.sprite];
    const i2 = document.createElement('i');
    i2.style.backgroundImage = "url('/assets/homestead/" + sp[0] + "')";
    i2.style.width = sp[3] + 'px';
    i2.style.aspectRatio = sp[1] + ' / ' + sp[2];
    t.appendChild(i2);
  }
  r.appendChild(t);
  const m = document.createElement('div');
  m.className = 'hs-rowmain';
  const b2 = document.createElement('b');
  const tt = document.createElement('span');
  tt.className = 'hs-rowtitle';
  tt.textContent = o.title;
  b2.appendChild(tt);
  if (o.chip) { const c = document.createElement('span');
    c.className = 'hs-rowbond' + (o.love ? ' hs-rowbond--love' : '');
    c.textContent = o.chip; b2.appendChild(c); }
  m.appendChild(b2);
  const s2 = document.createElement('span');
  s2.className = 'hs-rowsub';
  if (o.sub) { s2.textContent = o.sub; m.appendChild(s2); }
  r.appendChild(m);
  if (o.acts && o.acts.length) {
    const a2 = document.createElement('div');
    a2.className = 'hs-rowact';
    o.acts.forEach((x) => a2.appendChild(x));
    r.appendChild(a2);
  }
  return { row: r, sub: s2 };
}
function goodsRow(list, img, title, kind, price, emptyNote) {
  const have = C.state[kind] || 0;
  const sd = stallDay();
  const canSell = Math.min(have, Math.floor(Math.max(0, STALL_CAP - sd.sold) / price));
  const acts = [canSell
    ? btnEl('sell ' + canSell + ' · ' + (canSell * price) + ' ' + COIN, false,
      () => stallSell(kind, price, title.toLowerCase()))
    : btnEl('sell', false, null)];
  if (kind !== 'wool' && have) {
    acts.push(btnEl('to the pantry', true, () => {
      const nAll = C.state[kind] || 0;
      C.state.pantry = C.state.pantry || {};
      const pk = kind === 'milk' ? 'milk' : kind === 'cheese' ? 'cheese' : 'egg';
      C.state.pantry[pk] = (C.state.pantry[pk] || 0) + nAll;
      C.state[kind] = 0;
      save(); renderShop();
      toast('🍳 ' + nAll + ' into the pantry', 3200);
      track1('homestead_pantry_eggs', { kind, n: nAll });
    }));
  }
  const sub2 = have && !canSell ? 'the stall’s full today — more tomorrow'
    : have ? price + ' coins each' : emptyNote;
  list.appendChild(rowEl({ img, title, chip: '× ' + have, sub: sub2, acts }).row);
}
// 🪙 THE STALL — the payoff desk. Goods wear their own item icons
// (the pack's hand-made 32px set — the same family m-milk/m-cheese
// already come from).
export function renderSell(list) {
  list.classList.add('hs-list--rows');
  const sd = stallDay();
  const head = document.createElement('p');
  head.className = 'hs-note';
  head.textContent = 'the stall buys ' + STALL_CAP + ' coins of goods a day — ' + sd.sold + ' so far';
  list.appendChild(head);
  goodsRow(list, '/assets/homestead/m-egg.png', 'Eggs', 'eggs', EGG_C, 'the hens lay overnight');
  if (spCount('goat') || spCount('cow') || C.state.milk) goodsRow(list, '/assets/homestead/m-milk.png', 'Milk', 'milk', MILK_C, 'fresh milk in the morning');
  if (spCount('sheep') || C.state.wool) goodsRow(list, '/assets/homestead/m-wool.png', 'Wool', 'wool', WOOL_C, 'wool grows back in three days');
  if (C.state.cheese || C.state.items.some((i2) => i2.id === 'cheesemk')) goodsRow(list, '/assets/homestead/m-cheese.png', 'Cheese', 'cheese', CHEESE_C, 'put 2 milk in the press — cheese by morning');
}
// 🐄 THE MARKET — capacity in ANIMALS and size-words, never tiles
// (Trym: "are we expecting users to count tiles?"). The fence card and
// the locked rows speak the same four rankable words a kid can order:
// hen-sized → goat-sized → sheep-sized → cow-sized. "The Pen" is dead —
// players build FENCES, so the fence is what the phone talks about.
const BUY_SUB = {
  hen: 'lays an egg every morning',
  rooster: 'keeps your goods safe longer',
  goat: 'fills a can of milk a day',
  sheep: 'grows wool for shearing',
  cow: 'fills two cans a day',
  dog: 'no goods — just love',
};
const HOME_W = { hen: 'all home', rooster: 'he’s home', goat: 'she’s home',
  sheep: 'both home', cow: 'she’s home', dog: 'at your heel' };
export function renderBuy(list) {
  list.classList.add('hs-list--rows');
  const caps = penCaps();
  const big = caps.pens[0];
  const n2 = big ? big.int : 0;
  const F = !big ? ['not built yet', 'Fence in some grass in 🔨 build mode — close it all the way round and animals can move in.']
    : n2 >= 20 ? ['cow-sized', 'Room for everyone — hens, goat, sheep and the cow.']
    : n2 >= 12 ? ['sheep-sized', 'Room for hens, a goat and 2 sheep. Bigger, and the cow fits.']
    : n2 >= 8 ? ['goat-sized', 'Room for 4 hens and a goat. Bigger, and 2 sheep fit.']
    : n2 >= 4 ? ['hen-sized', 'Room for 4 hens. Bigger, and a goat fits.']
    : ['a bit snug', 'It’s closed — nice! Stretch it bigger and 4 hens fit.'];
  const fc = document.createElement('div');
  fc.className = 'hs-fencecard';
  fc.innerHTML = '<b>🚧 Your fence <span class="hs-fencechip"></span></b><span class="hs-rowsub"></span>';
  fc.querySelector('.hs-fencechip').textContent = F[0];
  fc.querySelector('.hs-rowsub').textContent = F[1];
  list.appendChild(fc);
  ANIMAL_SHOP.forEach((an) => {
    const owned = spCount(an.sp);
    const cap = caps[an.sp];
    const chip = owned ? '× ' + owned : '';
    if (cap === 0) {
      list.appendChild(rowEl({ sprite: an.sp, title: an.name, sub: an.needs, dim: true }).row);
    } else if (owned >= cap) {
      list.appendChild(rowEl({ sprite: an.sp, title: an.name, chip, sub: HOME_W[an.sp] }).row);
    } else {
      list.appendChild(rowEl({ sprite: an.sp, title: an.name, chip, sub: BUY_SUB[an.sp],
        acts: [btnEl('buy · ' + an.price + ' ' + COIN, false, () => buyAnimal(an))] }).row);
    }
  });
}
function buyAnimal(an) {
  if (!passSpend(an.price)) { toast('need ' + an.price + ' coins — the stall pays daily'); return; }
  const mem = farmMemory().filter((m) => m.sp === an.sp && m.name)   // old nameless records stay inert
    .sort((x, y) => (y.b || 0) - (x.b || 0))[0];
  if (mem) C.state.memory.splice(C.state.memory.indexOf(mem), 1);
  // 🐣 new animals arrive YOUNG (the dog excepted — the pack has
  // no puppy); a remembered one returns at her remembered stage
  const na2 = { sp: an.sp, b: mem ? mem.b : 0, pd: 0, name: mem ? mem.name : '', wd: 0,
    id: mem && mem.id ? mem.id : mintId(), ad: mem && mem.ad != null ? mem.ad : dayNum(),
    gs: mem ? (mem.gs || 0) : 0, sd: mem && mem.sd != null ? mem.sd : Math.floor(Math.random() * 10000) };
  if (an.sp !== 'dog') na2.gd = mem ? (mem.gd == null ? 5 : mem.gd) : 0;
  farmAnimals().push(na2);
  C.state.hens = C.state.animals.filter((a2) => a2.sp === 'hen').length;
  save(); refreshHud(); renderShop();
  toast(mem && mem.name
    ? '💛 ' + mem.name + '! ' + (an.sp === 'rooster' ? 'he remembers you' : 'she remembers you')
    : an.sp === 'dog' ? '🐕 the dog is yours — she’s already at your heel'
    // ⚠️ an UNNAMED remembered adult also lands here — only a real kid
    // gets the kid line
    : na2.gd != null && na2.gd < 5
      ? '🐣 a ' + BABY_W[an.sp] + '! fill the trough 5 mornings and '
        + (an.sp === 'rooster' ? 'he’ll' : 'she’ll') + ' grow up'
    : an.name + ' is back — '
      + (an.sp === 'rooster' ? 'he’s already bossing the yard' : 'she’s finding her feet'), 3600);
  track1('homestead_buy_animal', { sp: an.sp });
}
// 🐔 MY ANIMALS — the roster: her own sprite (babies look like
// babies), her hearts, her C.state, and a SMALL rehome button (the pick is
// yours here, not a species sort). Named friends still ask twice — the
// warning moves into the row's own status line, not a ballooning button.
export function renderAnimals(list) {
  list.classList.add('hs-list--rows');
  const flock = farmAnimals();
  if (!flock.length) {
    const p3 = document.createElement('p');
    p3.className = 'hs-note';
    p3.textContent = 'nobody lives here yet — the market has hens';
    list.appendChild(p3);
    return;
  }
  const price = (sp) => (ANIMAL_SHOP.find((x) => x.sp === sp) || {}).price || 10;
  flock.forEach((a) => {
    const he = a.sp === 'rooster';
    const young = isYoungA(a);
    const left = 5 - (a.gd || 0);
    const stateLn = young
      ? '🐣 growing up — fill the trough ' + left + ' more morning' + (left === 1 ? '' : 's')
      : a.sp === 'sheep' && (a.wd || 0) >= 3 ? '🧶 woolly — tap her to shear'
      : fedToday() ? '❤️ fed today' : '💔 hungry — fill the trough';
    const nameHint = a.name ? '' : ' · hug ' + (he ? 'him' : 'her') + ' '
      + Math.max(0, 3 - (a.b || 0)) + ' more day' + (3 - (a.b || 0) === 1 ? '' : 's')
      + ' to name ' + (he ? 'him' : 'her');
    let r2;
    const sb = btnEl('↩ rehome', true, () => {
      if (a.name && !sb.armed) {
        sb.armed = true;
        sb.innerHTML = 'yes · +' + price(a.sp) + ' ' + COIN;
        r2.sub.textContent = (he ? 'he’ll' : 'she’ll') + ' remember you — tap again to be sure';
        setTimeout(() => { sb.armed = false; if (sb.isConnected) renderShop(); }, 4000);
        return;
      }
      C.state.animals.splice(C.state.animals.indexOf(a), 1);
      if (a.name) {   // ⚠️ NAMED only — an unnamed revival read as "grown up right away"
        farmMemory().push({ sp: a.sp, name: a.name, b: a.b || 0, gd: a.gd, id: a.id, ad: a.ad, gs: a.gs || 0, sd: a.sd });
        if (C.state.memory.length > 12) C.state.memory.shift();
      }
      C.state.hens = C.state.animals.filter((a2) => a2.sp === 'hen').length;
      passStat('coins_earned', price(a.sp));
      save(); refreshHud(); renderShop();
      toast('🪙 +' + price(a.sp) + ' — ' + (a.name ? a.name + ' will remember you'
        : 'the ' + a.sp + ' found a new farm'), 3600);
      track1('homestead_sell_animal', { sp: a.sp });
    });
    r2 = rowEl({ sprite: (young ? 'y' : '') + a.sp,
      title: a.name ? a.name : (young ? 'little ' : 'unnamed ') + a.sp,
      chip: 'Lv ' + lvOf(a), love: lvOf(a) >= 10, sub: stateLn + nameHint, acts: [sb] });
    r2.row.classList.add('hs-row--tap');
    r2.row.addEventListener('click', (e) => { if (e.target.closest('button')) return; closeShop(); openPet(a); });
    list.appendChild(r2.row);
  });
}
export function shedRows(list) {
    // 📱 shed as app rows: thumb, name, count, two small buttons
    list.classList.add('hs-list--rows');
    const counts2 = {};
    C.state.shed.forEach((s) => { if (DEX[s.id]) counts2[s.id] = (counts2[s.id] || 0) + 1; });
    Object.keys(counts2).forEach((id) => {
      const d = DEX[id];
      const sale2 = Math.floor((d.price || 0) / 2);
      const acts = [btnEl('place it', false, () => {
        const indoorItem = isIndoorItem(d);
        if (indoorItem && !C.inside) { shopNote('🛋 that belongs indoors — step C.inside first'); return; }
        if (!indoorItem && C.inside) { shopNote('🌳 that belongs in the yard — step outside first'); return; }
        if (C.inside ? inList().length >= INCAP[C.inside] : C.state.items.length >= cap()) {
          toast(C.inside ? 'this room is full (' + INCAP[C.inside] + ' spots)' : 'the plot is full');
          return;
        }
        const i3 = C.state.shed.findIndex((sx) => sx.id === id);
        if (i3 < 0) return;
        C.state.shed.splice(i3, 1);
        save();
        closeShop();
        startPlacing(d.id);
      })];
      if (sale2 > 0) acts.push(btnEl('sell · ' + sale2 + ' ' + COIN, true, () => {
        const i3 = C.state.shed.findIndex((sx) => sx.id === id);
        if (i3 < 0) return;
        C.state.shed.splice(i3, 1);
        passStat('coins_earned', sale2);
        save();
        refreshHud();
        shopNote('💰 sold — +' + sale2 + ' coins');
        track('homestead_sell', { id: id, sale: sale2 });
        shopHead();
        renderShop();
      }));
      list.appendChild(rowEl({ svg: d.svg, img: d.svg ? null : d.img, title: d.name,
        chip: counts2[id] > 1 ? '× ' + counts2[id] : '', sub: 'in the shed', acts }).row);
    });
}
