// 🧪 THE SHIMMER BENCH (3 Oct 2026). Trym, starting Shimmer and the Star Map: "for the perks we should make a preview of the
// perks and how they would look visually so we can make sure they actually feel like something special". Add ?shimmer to
// any area: a panel under the game plays every perk's moment on YOUR banana in the real world — the flowers behind you as you
// walk the park, the gold footprints on the rave's floor, a star falling to be caught — so the feel is judged where it would
// live, on a phone. NOTHING IS EARNED OR SAVED: no stat moves, the pill is only painted, the map is the bench's.
// 4 Oct 2026, the perks rewritten on levers the game has: a perk that changes a look plays here; one that changes a number (a
// shorter wait, a second spin) has no look to play, and its button stays off. The look itself is src/lib/shimmer-fx.js.
import * as F from './shimmer-fx.js';
import { openMap } from './shimmer-map.js';
import { LADDER, KIND, shimmerStep } from '../data/shimmer.js';

const W = F.WORDS;
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
  bloomsteps: { toggle: () => F.trail((p, n) => {
    // two at a step, either side of your feet: one alone read as a dropped petal on a phone. One holder carries both, so the
    // pair fades as one. At night they would be as dark as the park, so they rise into the light instead: starlit flowers, a
    // soft rim on each (a glow laid over them read as milk on a phone)
    const night = F.nightOn();
    const b = document.createElement('i');
    Object.assign(b.style, { width: '0', height: '0', pointerEvents: 'none' });
    (night ? F.inLight : F.inWorld)(b, p, F.meZ() - 1);
    [-1, 1].forEach((side, j) => {
      const [src, w, h] = BLOOMS[(n * 2 + j) % BLOOMS.length];
      const f = img('/assets/park/' + src, w, h);
      f.style.left = (side * F.sp(9 + (n % 3) * 2)) + 'px'; f.style.top = F.sp(side > 0 ? 3 : 0) + 'px';
      if (night) f.style.filter = 'drop-shadow(0 0 1px rgba(223,240,255,.95)) drop-shadow(0 0 4px rgba(127,191,255,.7))';
      b.appendChild(f);
      if (!F.still()) F.play(f, [{ scale: '0.2 0' }, { scale: '1.1 1.25', offset: 0.55 }, { scale: '1 1' }], { duration: 380, easing: 'ease-out', delay: j * 90 });
    });
    if (n % 3 === 0) F.glint({ x: p.x, y: p.y - F.sp(14) }, { size: 18, scale: 1, z: F.meZ() - 1 });
    return b;
  }, { step: F.sp(20), life: 6500 }) },
  sunflowercap: { toggle: () => {
    const plants = parkPlants().slice(0, 24);
    if (!plants.length) hint('No plants in view: walk to the garden beds, your plants shimmer there.');
    const sw = plants.map((p, i) => F.sweep(p, { mask: p.style.backgroundImage, gap: 700 + (i % 5) * 260, ms: 1300 }));
    const tw = setInterval(() => { const p = plants[Math.floor(Math.random() * plants.length)]; if (!p) return; const at = F.screenToWorld(p.getBoundingClientRect().left + p.getBoundingClientRect().width * Math.random(), p.getBoundingClientRect().top + 4); F.glint(at, { size: 20, scale: 1, z: (parseInt(getComputedStyle(p).zIndex, 10) || 0) + 2 }); }, 420);
    F.tag('sunflowercap');
    return { stop() { sw.forEach((x) => x.stop()); clearInterval(tw); } };
  } },
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
  goldsteps: { toggle: () => F.trail((p, n) => {   // a gold print at each step, left and right in turn
    const f = document.createElement('i'), w = F.sp(7), side = n % 2 ? 1 : -1;
    Object.assign(f.style, { width: w + 'px', height: (w * 0.5) + 'px', marginLeft: (side * F.sp(5) - w / 2) + 'px', marginTop: (-w * 0.25) + 'px', borderRadius: '50%', background: '#ffcf4a', boxShadow: '0 0 4px 1px rgba(255,214,90,.8)', pointerEvents: 'none' });
    F.inLight(f, p, F.meZ() - 2);
    return f;
  }, { step: F.sp(16), life: 2600 }) },
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

// ── 🍌 THE BANANA, everywhere: what your own banana can do and show
const reachRing = (worldPx) => { const r = F.ring(worldPx / F.sp(1)); later(2600, () => r.stop()); };
const BANANA = {
  reach() { reachRing(50); F.tag('reach'); },
  reach2() { reachRing(68); F.tag('reach2'); },
  starsteps: { toggle: () => F.trail((p, n) => {
    const s = F.starEl(n % 3 ? 's' : 'm', F.sp(n % 3 ? 9 : 13));
    F.inLight(s, { x: p.x + (n % 2 ? 1 : -1) * F.sp(5), y: p.y }, F.meZ() - 1);
    return s;
  }, { step: F.sp(18), life: 2600 }) },
  starburst() {
    const p = F.meWorld(); if (!p) return;
    const top = { x: p.x, y: p.y - F.sp(70) };
    F.glint(top, { size: 52 }); F.spray(top, 16, { reach: 64, up: 30 });
    later(220, () => F.spray(top, 12, { reach: 44, up: 50 }));
    later(420, () => F.glint({ x: top.x + F.sp(18), y: top.y + F.sp(8) }, { size: 30, scale: 1 }));
    F.tag('starburst');
  },
  lantern: { toggle: () => {   // a bigger, brighter pool of your own light at your feet (best seen at night)
    if (!F.nightOn()) hint('This shows best at night: the sky turns dark every few minutes here.');
    const g = document.createElement('i');
    Object.assign(g.style, { position: 'absolute', pointerEvents: 'none', borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,236,200,.42), rgba(255,222,170,.18) 55%, rgba(255,214,160,0))' });
    let live = true;
    const tick = () => {
      if (!live) return;
      const p = F.meWorld();
      if (p) { const rx = F.sp(118), ry = rx * 0.6; if (!g.isConnected) F.inLight(g, p, F.meZ() - 3); Object.assign(g.style, { left: (p.x - rx) + 'px', top: (p.y - ry - F.sp(30)) + 'px', width: rx * 2 + 'px', height: ry * 2 + 'px' }); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    F.tag('lantern');
    return { stop() { live = false; g.remove(); } };
  } },
  bananacap: { toggle: () => {   // starlight on your banana: small stars come and go over its body, day and night
    F.tag('bananacap');
    return F.trail(() => {
      const s = F.meScreen(); if (!s) return null;
      const feet = F.screenToWorld(s.x, s.feet), head = F.screenToWorld(s.x, s.head);
      const h = feet.y - head.y, big = Math.random() < 0.3;
      const st = F.starEl(big ? 'm' : 's', F.sp(big ? 13 : 9));
      F.inLight(st, { x: feet.x + (Math.random() - 0.5) * h * 0.7, y: feet.y - Math.random() * h }, F.meZ() + 1);
      if (!F.still()) F.play(st, [{ scale: '0', opacity: 0 }, { scale: '1.2', opacity: 1, offset: 0.35 }, { scale: '0', opacity: 0 }], { duration: 820 }).then(() => st.remove());
      else later(700, () => st.remove());
      return null;
    }, { step: Infinity, every: 90 });
  } },
};
const PREVIEWS = { park: { c: 'sunflower', fx: PARK }, rave: { c: 'vinyl', fx: RAVE } };
const fxOf = (pv, k) => (pv && pv.fx[k]) || BANANA[k] || null;

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
  btn(sh, 'Falling star', '', () => { F.fall({ caught: () => F.note(W.dust.replace('{n}', '2')) }); say('Not a map star: a falling star gives STARDUST, the thing wishes are bought with. Walk over it.'); });
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
