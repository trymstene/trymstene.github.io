// 🧪 THE SHIMMER BENCH (3 Oct 2026). Trym, starting Shimmer and the Star Map: "for the perks we should make a preview of the
// perks and how they would look visually so we can make sure they actually feel like something special". Add ?shimmer to
// any area: a panel under the game plays every perk's moment on YOUR banana in the real world — the flowers behind you as you
// walk the park, the gold footprints on the rave's floor, a star falling to be caught — so the feel is judged where it would
// live, on a phone. NOTHING IS EARNED OR SAVED: no stat moves, the pill is only painted, the map is the bench's.
// 4 Oct 2026, the perks rewritten on levers the game has: the Sunflower, the Vinyl, the Hen and the Banana play here (the Hen's
// show the moment a number changes: two hearts, the extra goods, the van's clock); the rest wait their turn, their buttons off.
// The look itself is src/lib/shimmer-fx.js.
import * as F from './shimmer-fx.js';
import { openMap } from './shimmer-map.js';
import { LADDER, KIND, shimmerStep } from '../data/shimmer.js';
import { townNightAt } from './world.js';   // already a shared chunk: the bench splits nothing
import { iconSvg } from './pixel-icons.js';   // the chunk every script shares (an icon alone splits a chunk of its own)

const W = F.WORDS;
const perkNight = () => townNightAt(Date.now());
const front = (dx = 44, dy = -2) => { const p = F.meWorld(); return p ? { x: p.x + F.sp(dx), y: p.y + F.sp(dy) } : null; };
const img = (src, w, h) => { const i = new Image(); i.src = src; i.alt = ''; i.draggable = false; Object.assign(i.style, { position: 'absolute', left: '0', top: '0', width: w + 'px', height: h + 'px', marginLeft: (-w / 2) + 'px', marginTop: (-h) + 'px', imageRendering: 'pixelated', pointerEvents: 'none', transformOrigin: '50% 100%' }); return i; };
const later = (ms, f) => setTimeout(f, ms);
let hint = () => {};   // the bench's caption, for a perk that needs the player somewhere (set by mount)

// a drop of water, as pixels: blue, or starlit (a pour a perk gave)
const DROP = ['.a.', 'aba', 'aba', '.a.'];
const dropSrc = (star) => { const c = document.createElement('canvas'); c.width = 3; c.height = 4; const x = c.getContext('2d'); DROP.forEach((r, y) => [...r].forEach((ch, i) => { if (ch === '.') return; x.fillStyle = star ? (ch === 'b' ? '#ffffff' : '#bfe3ff') : (ch === 'b' ? '#bfe6ff' : '#4f9dd9'); x.fillRect(i, y, 1, 1); })); return c.toDataURL(); };
function pour(at, star) {
  const me = F.meWorld(); if (!me || !at) return;
  const d = img(dropSrc(star), F.sp(9), F.sp(12));
  if (star) d.className = 'sh-star';
  F.inWorld(d, { x: me.x + F.sp(14), y: me.y - F.sp(30) }, F.meZ() + 2);
  F.play(d, [{ translate: '0 0' }, { translate: (at.x - me.x - F.sp(14)) + 'px ' + (at.y - me.y + F.sp(30)) + 'px' }], { duration: 380, easing: 'cubic-bezier(.4,0,.9,.6)' }).then(() => { d.remove(); if (star) F.glint(at, { size: 26, scale: 1 }); });
}
// a sprout that grows a stage where it stands, or flies into your banana (a seed for home)
function sprout(p, src = '/assets/park/g-sprout1.png') { const s = img(src, F.sp(20), F.sp(20)); F.inWorld(s, p, F.meZ() - 1); return s; }

// ── 🌻 THE SUNFLOWER, in the park
const parkPlants = () => [...document.querySelectorAll('#pkWorld .pk-plant')].filter((p) => p.getClientRects().length && p.style.backgroundImage);
const nearest = (list, n) => { const s = F.meScreen(); if (!s) return list.slice(0, n); return list.map((e) => { const r = e.getBoundingClientRect(); return [Math.hypot(r.left + r.width / 2 - s.x, r.bottom - s.feet), e]; }).sort((a, b) => a[0] - b[0]).slice(0, n).map((x) => x[1]); };
const BLOOMS = [['b-marigold.png', 17, 15], ['b-poppy.png', 12, 15], ['b-bluebell.png', 17, 15], ['b-primrose.png', 17, 12]];
const PARK = {
  greenthumb() {   // a day sooner: the sprout jumps a stage in front of you
    const p = front(60, 4), s = sprout(p);
    later(500, () => { s.src = '/assets/park/g-sprout2.png'; F.play(s, [{ scale: '1 0.6' }, { scale: '1 1.3', offset: 0.5 }, { scale: '1 1' }], { duration: 380, easing: 'ease-out' }); F.spray({ x: p.x, y: p.y - F.sp(10) }, 8, { reach: 22 }); F.tag('greenthumb'); });
    later(4000, () => s.remove());
  },
  twoseeds() {   // two seeds fly up from the harvest and into your banana, for home
    const me = F.meWorld();
    [0, 1].forEach((n) => later(n * 260, () => {
      const p = front(46 + n * 14, 0); F.glint(p, { size: 30 });
      const s = img('/assets/park/g-sprout1.png', F.sp(20), F.sp(20));
      F.inWorld(s, p, F.meZ() + 3);
      F.play(s, [{ translate: '0 0', scale: '0.4' }, { translate: '0 ' + (-F.sp(46)) + 'px', scale: '1.3', offset: 0.45 }, { translate: (me.x - p.x) + 'px ' + (me.y - p.y - F.sp(60)) + 'px', scale: '0.5', opacity: 0.2 }], { duration: 1100, easing: 'ease-in-out' }).then(() => s.remove());
    }));
    later(400, () => F.tag('twoseeds'));
  },
  waterall() {   // one tap, every thirsty plant in reach: a starlit drop to each
    const plants = nearest(parkPlants(), 4);
    if (!plants.length) { hint('No plants in view: walk to the garden beds and every plant near you gets a drop.'); pour(front(), true); F.tag('waterall'); return; }
    plants.forEach((pl, i) => later(i * 140, () => { const r = pl.getBoundingClientRect(); pour(F.screenToWorld(r.left + r.width / 2, r.bottom - 6), true); }));
    later(plants.length * 140 + 300, () => F.tag('waterall'));
  },
  waterpays() {   // your own plant, watered: it blooms for a moment, and it pays like anyone else's
    const pl = nearest(parkPlants(), 1)[0];
    const p = pl ? (() => { const r = pl.getBoundingClientRect(); return F.screenToWorld(r.left + r.width / 2, r.bottom - 4); })() : front();
    if (!pl) hint('No plants in view: walk to the garden beds and water one of yours.');
    pour(p, false);
    later(420, () => {
      [[-14, -6], [12, -10], [-4, 4], [16, 2], [-18, 6]].forEach(([dx, dy], i) => later(i * 70, () => {
        const [src, w, h] = BLOOMS[i % BLOOMS.length], f = img('/assets/park/' + src, w, h);
        F.inWorld(f, { x: p.x + F.sp(dx), y: p.y + F.sp(dy) }, F.meZ() + 1);
        if (!F.still()) F.play(f, [{ scale: '0.2 0' }, { scale: '1.1 1.25', offset: 0.55 }, { scale: '1 1' }], { duration: 360, easing: 'ease-out' });
        fadeOut(f, 1700);
      }));
      plusOne({ x: p.x, y: p.y - F.sp(34) }, '+6 XP');
      F.tag('waterpays');
    });
  },
  sunflowercap() {   // a harvest of yours bursts into starlight: the moment, not a plant that shimmers all day
    const pl = nearest(parkPlants(), 1)[0];
    if (!pl) { hint('No plants in view: walk to the garden beds, a harvest bursts there.'); }
    const p = pl ? (() => { const r = pl.getBoundingClientRect(); return F.screenToWorld(r.left + r.width / 2, r.top + r.height * 0.4); })() : { x: front().x, y: front().y - F.sp(16) };
    const sw = pl ? F.sweep(pl, { mask: pl.style.backgroundImage, gap: 200, ms: 900 }) : null;
    F.glint(p, { size: 60 }); F.spray(p, 18, { reach: 54, up: 34 });
    later(240, () => F.spray(p, 12, { reach: 36, up: 48 }));
    later(300, () => F.tag('sunflowercap'));
    if (sw) later(2200, () => sw.stop());
  },
};

// ── 💿 THE VINYL, at the rave
const floor = () => document.getElementById('rvFloor');
function floorGlow(ms = 1600) {
  const f = floor(); if (!f) return;
  const g = document.createElement('i');
  Object.assign(g.style, { position: 'absolute', inset: '0', zIndex: '900', pointerEvents: 'none', boxShadow: 'inset 0 0 0 3px rgba(127,191,255,.85), inset 0 0 34px rgba(79,157,255,.65)' });
  f.appendChild(g);
  F.play(g, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0.35, offset: 0.7 }, { opacity: 0 }], { duration: ms }).then(() => g.remove());
}
const RAVE = {
  jellykeep() {
    const m = document.getElementById('rvMixer');
    if (m) {
      const b = F.starEl('l', 18); Object.assign(b.style, { left: '100%', top: '0', zIndex: '5' });
      if (getComputedStyle(m).position === 'static') m.style.position = 'relative';
      m.appendChild(b);
      F.play(b, [{ scale: '0.2', opacity: 0 }, { scale: '1.5', opacity: 1, offset: 0.3 }, { scale: '1', opacity: 1, offset: 0.5 }, { scale: '1', opacity: 1 }], { duration: 900 });
      later(4200, () => b.remove());
      F.tag('jellykeep', () => { const r = m.getBoundingClientRect(), v = F.els().view.getBoundingClientRect(); return { x: r.left + r.width / 2 - v.left, y: r.top - v.top }; });
    } else F.tag('jellykeep');
  },
  longjelly() { const b = F.buff('longjelly', 20, { fast: 2 }); later(900, () => { if (b) b.add(10); F.tag('longjelly'); }); },
  goldsteps() {   // JELLY TIME: gold prints while it lasts (the bench's clock runs fast), and the jelly pays double
    F.buff('goldsteps', 20, { fast: 2 });
    F.tag('goldsteps');
    const t = F.trail((p, n) => {   // a gold print at each step, left and right in turn
      const f = document.createElement('i'), w = F.sp(7), side = n % 2 ? 1 : -1;
      Object.assign(f.style, { width: w + 'px', height: (w * 0.5) + 'px', marginLeft: (side * F.sp(5) - w / 2) + 'px', marginTop: (-w * 0.25) + 'px', borderRadius: '50%', background: '#ffcf4a', boxShadow: '0 0 4px 1px rgba(255,214,90,.8)', pointerEvents: 'none' });
      F.inLight(f, p, F.meZ() - 2);
      return f;
    }, { step: F.sp(16), life: 2600 });
    hint('Walk around: the prints last as long as JELLY TIME does.');
    later(10000, () => t.stop());
  },
  vinylcap() {   // your name on the club's big screen, and a drop for the whole floor
    const scr = document.querySelector('.rv-screen');
    let name = ''; try { name = (localStorage.getItem('ps-name-v1') || '').trim(); } catch (e) {}
    if (scr) {
      const o = document.createElement('div');
      Object.assign(o.style, { position: 'absolute', inset: '0', zIndex: '6', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'rgba(6,14,36,.92)', pointerEvents: 'none' });
      const a = F.starEl('l', 22), b = F.starEl('l', 22);
      for (const s of [a, b]) Object.assign(s.style, { position: 'static', margin: '0' });
      const t = document.createElement('b'); t.className = 'sh-txt'; t.textContent = (name || 'YOUR NAME').toUpperCase();
      Object.assign(t.style, { font: '900 1.5rem/1 Anton, "Arial Black", sans-serif', letterSpacing: '.06em' });
      o.appendChild(a); o.appendChild(t); o.appendChild(b);
      if (getComputedStyle(scr).position === 'static') scr.style.position = 'relative';
      scr.appendChild(o);
      F.play(o, [{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.92 }, { opacity: 0 }], { duration: 6500 }).then(() => o.remove());
    }
    floorGlow(2400);
    F.tag('vinylcap');
  },
};

// ── 🐔 THE HEN, at your homestead (4 Oct 2026, Trym: "build the previews for the Hen next"). Each plays on YOUR yard: your
// animals, your trough, your crops, your sheep. Where the yard has none of the thing yet, a stand-in stands in front of you,
// drawn from the game's own sprites at the game's own sizes (a hen is a third of the banana, as in the yard).
const HS = '/assets/homestead/';
const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
const hsEls = (sel) => [...document.querySelectorAll('.hs-world ' + sel)].filter(vis);
const farmEls = () => hsEls('.hs-hen').filter((e) => !/hs-hen--(dog|cat)\b/.test(e.className));
const kindOf = (e) => { const m = /hs-hen--(\w+)/.exec(e.className); return m ? m[1] : 'hen'; };
const YOUNG = { chick: 'hen', ygoat: 'goat', ycow: 'cow', ysheep: 'sheep' };
const feetOf = (e) => { const r = e.getBoundingClientRect(); return F.screenToWorld(r.left + r.width / 2, r.bottom); };
const headOf = (e) => { const r = e.getBoundingClientRect(); return F.screenToWorld(r.left + r.width / 2, r.top); };
const bananaW = () => { const s = F.meScreen(); return s && s.w ? s.w : 60; };
// [sprite, width as a share of the banana (the yard's own: a hen 1.8% of the world to the banana's 5.5%), w/h, frames]
const SPECIES = { hen: ['c-hen0.png', 0.33, 1, 4], goat: ['c-goat.png', 0.4, 96 / 78, 4], sheep: ['c-sheepf.png', 0.55, 96 / 57, 4], cow: ['c-cow.png', 0.62, 144 / 81, 4] };
const STARLIT = 'drop-shadow(0 0 1px #fff) drop-shadow(0 0 5px rgba(127,191,255,.95))';
function strip(file, wScreen, aspect, frames) {
  const w = F.sp(wScreen), h = w / aspect, d = document.createElement('div');
  Object.assign(d.style, { position: 'absolute', width: w + 'px', height: h + 'px', marginLeft: (-w / 2) + 'px', marginTop: (-h) + 'px', pointerEvents: 'none', backgroundImage: "url('" + HS + file + "')", backgroundSize: (frames * 100) + '% 100%', backgroundPosition: '0 0', backgroundRepeat: 'no-repeat', imageRendering: 'pixelated', transformOrigin: '50% 100%' });
  return d;
}
const animal = (sp) => { const [f, k, a, n] = SPECIES[sp] || SPECIES.hen; return strip(f, bananaW() * k, a, n); };
const fadeOut = (el, ms) => later(ms, () => F.play(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 450 }).then(() => el.remove()));
// a stand-in animal in front of you, for a yard that has none yet
function standIn(sp, why) { if (why) hint(why); const p = front(46, 4), a = animal(sp); F.inWorld(a, p, F.meZ() - 1); fadeOut(a, 4200); return { el: a, feet: p, head: { x: p.x, y: p.y - parseFloat(a.style.height) } }; }
const nearestFarm = () => { const e = nearest(farmEls(), 1)[0]; return e ? { el: e, feet: feetOf(e), head: headOf(e), kind: kindOf(e) } : null; };
// a heart up off an animal: the hug's own, or the second one a perk gave, in starlight
function heartUp(at, star) {
  const d = document.createElement('i'), w = F.sp(20);
  d.className = 'shb-heart';
  d.innerHTML = iconSvg('heart-solid', { size: 16 });
  Object.assign(d.style, { width: w + 'px', height: w + 'px', marginLeft: (-w / 2) + 'px', marginTop: (-w) + 'px', color: star ? '#eef7ff' : '#ff4d6d', pointerEvents: 'none', filter: star ? STARLIT : 'drop-shadow(1px 1px 0 #000)' });
  if (d.firstChild) Object.assign(d.firstChild.style, { width: '100%', height: '100%', display: 'block' });
  F.inLight(d, at, F.meZ() + 6);
  F.play(d, [{ translate: '0 0', scale: '0.5', opacity: 0 }, { translate: '0 ' + (-F.sp(12)) + 'px', scale: '1.15', opacity: 1, offset: 0.25 }, { translate: '0 ' + (-F.sp(46)) + 'px', scale: '1', opacity: 0 }], { duration: 1300, easing: 'ease-out' }).then(() => d.remove());
}
// a thing that flies from a world point into your banana (a seed, a tuft of wool)
function intoMe(el, from, star) {
  const me = F.meWorld(); if (!me) return;
  if (star) el.style.filter = STARLIT;
  F.inWorld(el, from, F.meZ() + 4);
  F.play(el, [{ translate: '0 0', scale: '0.6' }, { translate: (me.x - from.x) * 0.4 + 'px ' + (-F.sp(52)) + 'px', scale: '1.25', offset: 0.45 }, { translate: (me.x - from.x) + 'px ' + (me.y - from.y - F.sp(56)) + 'px', scale: '0.5', opacity: 0.2 }], { duration: 1150, easing: 'ease-in-out' }).then(() => el.remove());
}
function plusOne(at, text) {
  const t = document.createElement('b'); t.className = 'sh-txt'; t.textContent = text || '+1';
  Object.assign(t.style, { position: 'absolute', transform: 'translate(-50%,-100%)', fontWeight: '900', fontSize: F.sp(14) + 'px', lineHeight: '1', whiteSpace: 'nowrap', pointerEvents: 'none' });
  F.inLight(t, at, F.meZ() + 6);
  F.play(t, [{ translate: '0 0', opacity: 0 }, { translate: '0 ' + (-F.sp(10)) + 'px', opacity: 1, offset: 0.3 }, { translate: '0 ' + (-F.sp(24)) + 'px', opacity: 0 }], { duration: 1700, easing: 'ease-out' }).then(() => t.remove());
}
const troughEl = () => hsEls('.hs-it').find((e) => /d-trough/.test(e.style.backgroundImage)) || null;
const cropEls = () => hsEls('.hs-crop');

// 🐕🐈 YOUR DOG OR CAT AT YOUR HEELS (the Hen's top star): the yard's own walk, run and idle rows, following a step behind you,
// facing the way it goes. It plays in every area, since the perk is that the pet comes along.
let petTurn = 0;
function petFollow() {
  let kind = 'dog';
  try { const y = JSON.parse(localStorage.getItem('hs-v1') || 'null'), an = (y && y.animals) || [], d = an.some((a) => a.sp === 'dog'), c = an.some((a) => a.sp === 'cat'); kind = d && c ? (petTurn++ % 2 ? 'cat' : 'dog') : c ? 'cat' : 'dog'; } catch (e) {}
  const P = kind === 'dog'
    ? { rows: { idle: ['c-dog-idle.png', 170], walk: ['c-dog-walk.png', 95], run: ['c-dog-run.png', 70] }, k: 0.57, aspect: 105 / 66 }
    : { rows: { idle: ['c-catidle.png', 170], walk: ['c-cat.png', 95], run: ['c-catrun.png', 70] }, k: 0.47, aspect: 1 };
  const me0 = F.meWorld(); if (!me0) return null;
  const el = strip(P.rows.idle[0], bananaW() * P.k, P.aspect, 6);
  el.className = 'shb-pet shb-pet--' + kind;
  const keep = F.sp(bananaW() * 0.75);   // how far behind you it walks
  const at = { x: me0.x - keep, y: me0.y + F.sp(4) };
  F.inWorld(el, at, F.meZ() - 1);
  let live = true, row = 'idle', frame = 0, frameAt = 0, last = performance.now(), fl = '';
  const tick = (now) => {
    if (!live || !el.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const me = F.meWorld();
    if (me) {
      const dx = me.x - at.x, dy = me.y - at.y, d = Math.hypot(dx, dy);
      let speed = 0;
      if (d > keep) { const k = Math.min(1, dt * (d > keep * 2.5 ? 5 : 3)); const mx = dx * (1 - keep / d) * k, my = dy * (1 - keep / d) * k; at.x += mx; at.y += my; speed = Math.hypot(mx, my) / Math.max(dt, 0.001); if (Math.abs(mx) > 0.2) { const f = mx < 0 ? 'scaleX(-1)' : ''; if (f !== fl) { fl = f; el.style.transform = f; } } }
      const want = speed > F.sp(150) ? 'run' : speed > F.sp(12) ? 'walk' : 'idle';
      if (want !== row) { row = want; frame = 0; el.style.backgroundImage = "url('" + HS + P.rows[row][0] + "')"; }
      if (now - frameAt > P.rows[row][1]) { frameAt = now; frame = (frame + 1) % 6; el.style.backgroundPosition = (frame * 20) + '% 0'; }
      el.style.left = at.x + 'px'; el.style.top = at.y + 'px';
      el.style.zIndex = String(F.meZ() + (at.y > me.y ? 1 : -1));
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  F.tag('hencap');
  return { stop() { live = false; el.remove(); } };
}

const HEN = {
  express() {   // the van's clock runs at twice the speed, and the parcel lands at your feet
    const b = F.buff('express', 45 * 60, { fast: 300 });
    later(800, () => { if (b) b.add(-22.5 * 60); F.tag('express'); });
    later(6200, () => {
      const p = front(30, 10), box = img(HS + 'd-boxes.png', F.sp(26), F.sp(52));
      F.inWorld(box, p, F.meZ() + 1);
      F.play(box, [{ translate: '0 ' + (-F.sp(140)) + 'px', opacity: 0 }, { translate: '0 0', opacity: 1, offset: 0.7 }, { translate: '0 ' + (-F.sp(8)) + 'px', offset: 0.85 }, { translate: '0 0' }], { duration: 720, easing: 'ease-in' })
        .then(() => { F.glint({ x: p.x, y: p.y - F.sp(30) }, { size: 56 }); F.spray({ x: p.x, y: p.y - F.sp(16) }, 14, { reach: 40 }); });
      fadeOut(box, 3600);
    });
  },
  sprout() {   // your crop shows the stage it would already be at: planting counted as its first watering
    const c = nearest(cropEls(), 1)[0];
    let src = '/assets/park/c-carrot-2.png', p = null, w = F.sp(36), h = F.sp(40);
    if (c) {
      const m = /c-([a-z]+)-(\d)\.png/.exec(c.style.backgroundImage), r = c.getBoundingClientRect();
      if (m) src = '/assets/park/c-' + m[1] + '-' + Math.min(4, +m[2] + 1) + '.png';
      p = F.screenToWorld(r.left + r.width / 2, r.bottom); w = F.sp(r.width); h = F.sp(r.height);
    } else { hint('No crops in your soil yet: plant a seed from the park and it starts a stage ahead.'); p = front(46, 4); }
    const g = img(src, w, h); F.inWorld(g, p, F.meZ() + 1);
    F.play(g, [{ scale: '1 0.3', opacity: 0 }, { scale: '1 1.2', opacity: 1, offset: 0.55 }, { scale: '1 1' }], { duration: 420, easing: 'ease-out' });
    const sw = F.sweep(g, { mask: "url('" + src + "')", gap: 400, ms: 1100 });
    later(300, () => { F.glint({ x: p.x, y: p.y - h * 0.7 }, { size: 48 }); F.spray({ x: p.x, y: p.y - h * 0.6 }, 10, { reach: 30 }); F.tag('sprout'); });
    later(3400, () => { sw.stop(); F.play(g, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 }).then(() => g.remove()); });
  },
  dblhearts() {   // a hug: the heart it always gives, and a second one in starlight
    const a = nearestFarm() || standIn('hen', 'No animals here yet: buy a hen on the Banana Phone to hug one.');
    heartUp(a.head, false);
    later(220, () => heartUp({ x: a.head.x + F.sp(16), y: a.head.y }, true));
    later(260, () => F.tag('dblhearts'));
  },
  goodswait() {   // the pile by the trough: the days it keeps today, then two more days of it in starlight
    const t = troughEl(), r = t && t.getBoundingClientRect();
    const base = r ? F.screenToWorld(r.left + r.width / 2, r.bottom) : front(10, 4);
    if (!t) hint('No trough in your yard: the goods pile up by your house instead.');
    const goods = ['e-egg', 'm-milk', 'e-egg', 'm-milk', 'e-egg', 'm-milk', 'e-egg', 'm-milk'];
    const els = goods.map((g, i) => {
      const star = i >= 4, el = img(g === 'e-egg' ? '/assets/park/e-egg.png' : HS + 'm-milk.png', F.sp(g === 'e-egg' ? 19 : 22), F.sp(g === 'e-egg' ? 24 : 22));
      el.className = 'shb-good' + (star ? ' is-star' : '');
      const at = { x: base.x - F.sp(46) + (i % 4) * F.sp(30), y: base.y + F.sp(18) + Math.floor(i / 4) * F.sp(24) };
      later(i * 160 + (star ? 700 : 0), () => {
        if (star) el.style.filter = STARLIT;
        F.inWorld(el, at, F.meZ() - 1);
        F.play(el, [{ scale: '0.2', opacity: 0 }, { scale: '1.2', opacity: 1, offset: 0.6 }, { scale: '1' }], { duration: 320, easing: 'ease-out' });
        if (star) F.glint({ x: at.x, y: at.y - F.sp(10) }, { size: 22, scale: 1 });
      });
      return el;
    });
    later(1900, () => F.tag('goodswait'));
    els.forEach((el) => fadeOut(el, 5200));
  },
  babies() {   // a baby grows into its grown-up self, in starlight
    const young = farmEls().filter((e) => YOUNG[kindOf(e)]);
    const e = nearest(young.length ? young : farmEls(), 1)[0];
    const sp = e ? (YOUNG[kindOf(e)] || (SPECIES[kindOf(e)] ? kindOf(e) : 'hen')) : 'hen';
    const p = e ? feetOf(e) : front(46, 4);
    if (!e) hint('No animals here yet: babies come from the Banana Phone, and grow up here.');
    const g = animal(sp); g.style.filter = STARLIT;
    F.inWorld(g, { x: p.x + (e ? F.sp(4) : 0), y: p.y }, F.meZ() + 1);
    F.play(g, [{ scale: '0.45', opacity: 0 }, { scale: '0.5', opacity: 1, offset: 0.2 }, { scale: '1.12', offset: 0.8 }, { scale: '1' }], { duration: 1400, easing: 'ease-in-out' });
    later(1100, () => { F.spray({ x: p.x, y: p.y - F.sp(16) }, 12, { reach: 34 }); F.tag('babies'); });
    fadeOut(g, 3600);
  },
  trough() {   // the trough, full, with a star for each of the two mornings it feeds
    const t = troughEl();
    let p, w = F.sp(65), h = F.sp(33);
    if (t) { const r = t.getBoundingClientRect(); p = F.screenToWorld(r.left + r.width / 2, r.bottom); w = F.sp(r.width); h = F.sp(r.height); }
    else { hint('No trough in your yard: place one from your shed to see it.'); p = front(50, 6); }
    const g = img(HS + 'd-trough-full.png', w, h); F.inWorld(g, p, F.meZ() + 1);
    const sw = F.sweep(g, { mask: "url('" + HS + "d-trough-full.png')", gap: 300, ms: 1000 });
    [-1, 1].forEach((side, i) => later(500 + i * 380, () => { const s2 = F.starEl('m', F.sp(14)); F.inLight(s2, { x: p.x + side * F.sp(12), y: p.y - h - F.sp(8) }, F.meZ() + 3); F.play(s2, [{ scale: '0', opacity: 0 }, { scale: '1.3', opacity: 1, offset: 0.5 }, { scale: '1' }], { duration: 360 }); fadeOut(s2, 2800); }));
    later(900, () => F.tag('trough'));
    later(3400, () => { sw.stop(); F.play(g, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 }).then(() => g.remove()); });
  },
  pie() { const b = F.buff('pie', 45 * 60, { fast: 120 }); later(900, () => { if (b) b.add(45 * 60); F.tag('pie'); }); },
  neighbour() {   // on a neighbour's crops, one watering counts as two: a drop, and a second one in starlight
    hint('Played on your own yard here: the real one counts in a neighbour’s.');
    const c = nearest(cropEls().concat(hsEls('.hs-soil')), 1)[0];
    const p = c ? (() => { const r = c.getBoundingClientRect(); return F.screenToWorld(r.left + r.width / 2, r.bottom - r.height * 0.3); })() : front();
    pour(p, false); later(260, () => pour(p, true)); later(700, () => F.tag('neighbour'));
  },
  walkhugs: { toggle: () => {   // walk past your animals: each gets its hug, a heart over it, no tap (nothing is saved here)
    const done = new WeakSet();
    let live = true, tagged = false;
    const tick = () => {
      if (!live) return;
      const me = F.meWorld();
      if (me) for (const e of hsEls('.hs-hen')) {
        if (done.has(e)) continue;
        const f = feetOf(e);
        if (Math.hypot(f.x - me.x, f.y - me.y) < F.sp(bananaW() * 1.1)) { done.add(e); heartUp(headOf(e), false); if (!tagged) { tagged = true; F.tag('walkhugs'); } }
      }
      setTimeout(tick, 120);
    };
    if (!hsEls('.hs-hen').length) hint('No animals here yet: buy a hen on the Banana Phone, then walk past her.');
    else hint('Walk past your animals: each gets its hug as you go by.');
    tick();
    return { stop() { live = false; } };
  } },
  moreanimals() {   // one more of each kind you keep, standing beside the one you have, in starlight
    const seen = new Map();
    for (const e of farmEls()) { const k = YOUNG[kindOf(e)] || kindOf(e); if (SPECIES[k] && !seen.has(k)) seen.set(k, e); }
    if (!seen.size) { hint('No animals here yet: the extra room shows beside each kind you keep.'); seen.set('hen', null); }
    [...seen].forEach(([k, e], i) => later(i * 260, () => {
      const p = e ? feetOf(e) : front(46, 4), g = animal(k);
      g.style.filter = STARLIT; g.style.opacity = '0.9';
      const at = { x: p.x + F.sp(bananaW() * SPECIES[k][1] * 0.9), y: p.y + F.sp(3) };
      F.inWorld(g, at, F.meZ() + 1);
      F.play(g, [{ scale: '0.3', opacity: 0 }, { scale: '1.1', opacity: 0.9, offset: 0.6 }, { scale: '1', opacity: 0.9 }], { duration: 480, easing: 'ease-out' });
      F.spray({ x: at.x, y: at.y - F.sp(12) }, 8, { reach: 24 });
      later(250, () => plusOne({ x: at.x, y: at.y - parseFloat(g.style.height) - F.sp(4) }));
      fadeOut(g, 3800);
    }));
    later(400, () => F.tag('moreanimals'));
  },
  hencap: { toggle: petFollow },
};

// ── 🍌 THE BANANA, everywhere: what your own banana can do and show
// a perk switched on for real while its button is lit: every area reads window.__perks (perkReach, perkSpeed in world.js)
const perks = () => (window.__perks = window.__perks || {});
function real(key, ring) {
  return () => {
    perks()[key] = true;
    const r = ring ? F.ring(ring / F.sp(1)) : null;
    F.tag(key);
    return { stop() { delete perks()[key]; if (r) r.stop(); } };
  };
}
// starlight over your banana's body, for as long as it runs: small stars come and go
const shine = (ms) => { const t = F.trail(() => {
  const s2 = F.meScreen(); if (!s2) return null;
  const feet = F.screenToWorld(s2.x, s2.feet), head = F.screenToWorld(s2.x, s2.head);
  const h = feet.y - head.y, big = Math.random() < 0.3;
  const st = F.starEl(big ? 'm' : 's', F.sp(big ? 13 : 9));
  F.inLight(st, { x: feet.x + (Math.random() - 0.5) * h * 0.7, y: feet.y - Math.random() * h }, F.meZ() + 1);
  if (!F.still()) F.play(st, [{ scale: '0', opacity: 0 }, { scale: '1.2', opacity: 1, offset: 0.35 }, { scale: '0', opacity: 0 }], { duration: 820 }).then(() => st.remove());
  else later(700, () => st.remove());
  return null;
}, { step: Infinity, every: 90 }); if (ms) later(ms, () => t.stop()); return t; };
const sugarStars = (ms) => { const t = F.trail((p, n) => {
  const st = F.starEl(n % 3 ? 's' : 'm', F.sp(n % 3 ? 9 : 13));
  F.inLight(st, { x: p.x + (n % 2 ? 1 : -1) * F.sp(5), y: p.y }, F.meZ() - 1);
  return st;
}, { step: F.sp(18), life: 1600 }); later(ms, () => t.stop()); return t; };
const BANANA = {
  nightstride: { toggle: real('nightstride') },
  reach: { toggle: real('reach', 50) },
  sugarrush() {   // a pickup: a quarter faster for a few seconds, stars at your feet while it lasts
    perks().sugarUntil = Date.now() + 3500;
    sugarStars(3500);
    F.buff('sugarrush', 4, { fast: 1 });
    F.tag('sugarrush');
    hint('In play every pickup starts it; here, walk now.');
  },
  daystride: { toggle: real('daystride') },
  reach2: { toggle: real('reach2', 68) },
  nightsprint: { toggle: real('nightsprint') },
  bananacap() {   // a new Shimmer level: you shine for a few minutes (a few seconds here), with double XP while you shine
    shine(12000);
    F.buff('bananacap', 12, { fast: 1 });
    F.tag('bananacap');
  },
};
const PREVIEWS = { park: { c: 'sunflower', fx: PARK }, rave: { c: 'vinyl', fx: RAVE }, homestead: { c: 'hen', fx: HEN } };
// the Hen's top star is a pet that comes along into every area, so its preview plays anywhere the map is opened
const ANYWHERE = { hencap: HEN.hencap };
const fxOf = (pv, k) => (pv && pv.fx[k]) || BANANA[k] || ANYWHERE[k] || null;

const CSS = `
.shb{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:#0b1730;color:#cfe6ff;border-top:3px solid #000;box-shadow:0 -4px 0 rgba(0,0,0,.35),0 -8px 24px rgba(40,100,220,.25);font:700 12px/1.3 system-ui,sans-serif;max-height:42vh;overflow:auto;padding:8px 10px 10px}
.shb.is-min{max-height:none;overflow:visible;padding:6px 10px}
.shb.is-min .shb-body{display:none}
.shb-top{display:flex;align-items:center;gap:8px}
.shb-top b{font-weight:900;letter-spacing:.08em;color:#fff;font-size:12px}
.shb-top span{opacity:.7;font-size:11px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.shb-top button{background:#13254d;color:#dff0ff;border:2px solid #000;font:900 11px/1 system-ui,sans-serif;padding:5px 8px;cursor:pointer}
.shb-h{margin:8px 0 4px;font-size:10px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#6f93c2}
.shb-row{display:flex;flex-wrap:wrap;gap:5px}
.shb-row button{display:flex;align-items:center;gap:5px;background:#13254d;color:#dff0ff;border:2px solid #000;box-shadow:2px 2px 0 #000;font:800 11.5px/1.1 system-ui,sans-serif;padding:6px 8px;cursor:pointer;white-space:nowrap}
.shb-row button i{font-style:normal;font-size:10px;color:#8fc4ff;font-weight:900}
.shb-row button.is-on{background:#2a5bb5;color:#fff}
.shb-row button[disabled]{opacity:.45;cursor:default}
.shb-cap{margin-top:7px;min-height:2.6em;font-size:11.5px;color:#dff0ff}
.shb-cap em{display:block;font-style:normal;color:#8fb6e6;font-size:10.5px;margin-top:2px}
`;

export function mount(api) {
  if (document.querySelector('.shb')) return;
  const chip = api && api.lvl;
  const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
  const box = document.createElement('div'); box.className = 'shb';
  box.innerHTML = '<div class="shb-top"><b>SHIMMER BENCH</b><span>a preview: nothing is earned or saved</span><button type="button" data-min>hide</button></div><div class="shb-body"></div>';
  document.body.appendChild(box);
  box.querySelector('[data-min]').onclick = (e) => { box.classList.toggle('is-min'); e.target.textContent = box.classList.contains('is-min') ? 'show' : 'hide'; };
  const body = box.querySelector('.shb-body');
  const cap = document.createElement('div'); cap.className = 'shb-cap';
  const say = (t, e) => { cap.textContent = t; if (e) { const m = document.createElement('em'); m.textContent = e; cap.appendChild(m); } };
  hint = (t) => { const m = document.createElement('em'); m.textContent = t; cap.appendChild(m); };
  const row = (title) => { const h = document.createElement('div'); h.className = 'shb-h'; h.textContent = title; const r = document.createElement('div'); r.className = 'shb-row'; body.appendChild(h); body.appendChild(r); return r; };
  const btn = (r, label, pre, fn, toggle) => {
    const b = document.createElement('button'); b.type = 'button';
    if (pre) { const i = document.createElement('i'); i.textContent = pre; b.appendChild(i); }
    b.appendChild(document.createTextNode(label));
    let live = null;
    b.onclick = () => {
      if (!toggle) { fn(); return; }
      if (live) { live.stop(); live = null; b.classList.remove('is-on'); return; }
      live = fn() || { stop() {} }; b.classList.add('is-on');
    };
    r.appendChild(b);
    return b;
  };
  const pv = PREVIEWS[F.areaKey];
  const myC = pv ? pv.c : Object.keys(LADDER).find((c) => LADDER[c].area === F.areaKey);
  // ── Shimmer itself, in every area. ONE LOOP, and the bench shows it whole (Trym, on the first bench: "wheres the Shimmer XP
  // progression? you want ongoing XP points for Shimmer, not a handful of stars you collect here and there?"): after 99 your
  // XP keeps flowing, into the blue bar; each time it fills you reach the next Shimmer level, and every level is ONE star to
  // place. So the stars you have are always your Shimmer level — placed plus waiting — and the map says how far the next is.
  const S = { level: 38, xp: 1400, lit: { sunflower: 15, vinyl: 7, hen: 4, ghost: 0, fish: 0, banana: 0 }, toPlace: 12, chosen: {} };
  let on = false, map = null;
  const paint = () => F.pill(chip, on, S.level, S.xp / shimmerStep(S.level));
  const earn = (amount) => {
    on = true; paint();
    let given = 0;
    F.flowXP(chip, amount, (k, n) => {
      const part = Math.round((amount * k) / n) - given; given += part;
      S.xp += part;
      while (S.xp >= shimmerStep(S.level)) { S.xp -= shimmerStep(S.level); S.level += 1; S.toPlace += 1; F.levelUp(chip, S.level); }
      paint();
      if (map) map.refresh();
    });
  };
  const sh = row('Shimmer');
  btn(sh, 'Blue pill', '', () => { on = !on; paint(); say(on ? 'After 99 the level pill turns blue: a star and your Shimmer level, and the bar is the XP to the next one.' : 'The pill as it is today.'); });
  btn(sh, 'Earn XP', '', () => { earn(900); say('After 99 your XP keeps flowing, into the blue bar. Each time it fills you reach the next Shimmer level, and every level is one star to place.', 'Shimmer ' + S.level + ' · ' + S.toPlace + ' to place · the next level costs ' + shimmerStep(S.level).toLocaleString('en-US') + ' XP'); });
  btn(sh, 'Reach 99', '', () => {
    on = true; Object.assign(S, { level: 1, xp: 0, toPlace: 1, chosen: {}, lit: { sunflower: 0, vinyl: 0, hen: 0, ghost: 0, fish: 0, banana: 0 } });
    F.arrive(chip); setTimeout(paint, 320); if (map) map.refresh();
    say('Level 99 becomes Shimmer 1: the biggest burst there is, the pill turns blue, and your first star waits on the map.');
  });
  // a perk "seen" from the map plays its preview right here (a lasting one runs a few seconds and stops)
  const playPerk = (k) => {
    const fx = fxOf(pv, k); if (!fx) return;
    say(F.perkWords(k).name, F.perkWords(k).line);
    if (typeof fx === 'object' && fx.toggle) { const t = fx.toggle(); setTimeout(() => { if (t && t.stop) t.stop(); }, 7000); } else fx();
  };
  btn(sh, 'Star Map', '', () => {
    map = openMap(S, { from: chip, select: myC, step: shimmerStep, canSee: (k) => !!fxOf(pv, k), see: playPerk, lit: (k) => say(F.perkWords(k).name + ' · lit on the map', F.perkWords(k).line), closed: () => { map = null; } });
    say('Your stars are your Shimmer levels. Place one: the figure draws itself, and every fourth star lights a perk.');
  });
  btn(sh, 'Stardust', '', () => { F.fall({ caught: () => F.note(W.dust.replace('{n}', '2')) }); say('Stardust is not a perk and not a map star: it is the endgame’s other half. Now and then a star falls near you; walk over it and you get stardust, which buys wishes (lanterns on the square for an hour, rain for the gardens). The Shimmer doc has the wishes.'); });
  btn(sh, 'Everything on', '', () => {
    const live = [];
    if (pv && pv.c === 'vinyl') RAVE.goldsteps();
    if (pv && pv.c === 'sunflower') PARK.sunflowercap();
    live.push(petFollow(), shine(12000), sugarStars(12000));
    perks().sugarUntil = Date.now() + 12000;
    const t0 = performance.now(); let n = 0, worst = 0, last = t0;
    const meter = (now) => {
      n++; worst = Math.max(worst, now - last); last = now;
      if (now - t0 < 12000) { requestAnimationFrame(meter); if (n % 30 === 0) say('Everything on: every look a banana can have at once, here.', Math.round(n / ((now - t0) / 1000)) + ' frames a second · slowest frame ' + Math.round(worst) + ' ms'); return; }
      live.forEach((x) => x && x.stop && x.stop());
      say('Everything on, for twelve seconds: ' + Math.round(n / ((now - t0) / 1000)) + ' frames a second, the slowest frame ' + Math.round(worst) + ' ms.', 'A phone runs smoothly at about 60; under 30 you will feel it.');
    };
    requestAnimationFrame(meter);
  });
  btn(sh, 'Area boost', '', () => { F.plusWithStars(24, 6); say('Always on: every star you place in this area’s constellation adds 1% to the XP you earn here. The blue part is your stars’.'); });
  // ── this area's constellation, then the banana's own (it works in every area): a perk with a look plays; one that only
  // changes a number says so and stays off
  const signRow = (c, fxFor) => {
    const nm = W.constellations.find((q) => q.key === c);
    const r = row(nm ? nm.name + ' · ' + nm.area : c);
    for (const st of LADDER[c].steps) {
      for (const k of st.slice(1)) {
        const w = F.perkWords(k), fx = fxFor(k);
        const isToggle = fx && typeof fx === 'object' && fx.toggle;
        const b = btn(r, w.name, String(st[0]), () => {
          say(w.name + ' · star ' + st[0] + ' · ' + (W.kinds[KIND[k]] || ''), w.line);
          if (/^night/.test(k) && !perkNight()) hint('It is day here now: it works once night falls (the sky turns every few minutes). Leave it on.');
          return isToggle ? fx.toggle() : fx && fx();
        }, isToggle);
        if (!fx) b.disabled = true;
      }
    }
  };
  if (myC && myC !== 'banana') signRow(myC, (k) => (pv && pv.fx[k]) || null);
  signRow('banana', (k) => BANANA[k] || null);
  body.appendChild(cap);
  say('Tap a perk to see it happen on your banana. A lit button stays on: walk around with it. Grey ones change a number, not a look.');
}
