// 👕 WARDROBE UI — the ONE chip/tray/tooltip layer the main builder and the
// custom-product dressers share. Extracted 28 Aug (Trym: the PDP dresser
// drifted stale because polish had to be ported by hand). The STATE stays
// with each surface — the builder mutates `state` directly, the PDP rebuilds
// from descriptors — only the presentation lives here, so a chip polished
// once is polished everywhere.
//
// CSS lives in public/css/wardrobe.css — a page using this module must link
// it (make-a-banana.astro and make-a-banana/[product].astro do).

const escT = (t) => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// a chip's art is normally an inline pixel-SVG string; a PNG-art item (the
// plush = the resized banana) needs an <img> instead of raw innerHTML.
export const chipArt = (art) => (!art ? '' : art.charAt(0) === '<' ? art
  : '<img src="' + art + '" alt="" style="max-width:100%;max-height:100%;image-rendering:pixelated" />');

// One wardrobe chip. Unlocked = a <button> the caller wires (`onPick`);
// locked = an <a> DOOR to where the item is earned or bought. `comm` marks
// community-made pieces (the pixel sparkle). `data` lands on dataset — the
// builder's aria-sync reads chips by dataset key, so it rides through here.
export function wardChip({ art, label, tip, comm, locked, data, pressed, onPick }) {
  if (locked) {
    const a = document.createElement('a');
    a.className = 'bb-chip bb-chip--icon bb-chip--locked' + (comm ? ' bb-chip--comm' : '');
    a.href = locked.href;
    if (locked.place) a.dataset.place = locked.place;
    // ⚠️ no art ≠ print the label inline: raw names side by side render as
    // overlapping garble in an icon grid — a locked tile looks like a tile
    a.innerHTML = chipArt(art) || '<span class="bb-chip__none">🔒</span>';
    a.dataset.tip = locked.tip || (label + ' — locked');
    a.setAttribute('aria-label', locked.aria || (label + ' (locked)'));
    if (data) Object.keys(data).forEach((k) => { a.dataset[k] = data[k]; });
    return a;
  }
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'bb-chip bb-chip--icon' + (comm ? ' bb-chip--comm' : '');
  b.innerHTML = chipArt(art) || escT(label);
  b.dataset.tip = tip || label;
  b.setAttribute('aria-label', label);
  if (pressed !== undefined) b.setAttribute('aria-pressed', String(!!pressed));
  if (data) Object.keys(data).forEach((k) => { b.dataset[k] = data[k]; });
  if (onPick) b.onclick = onPick;
  return b;
}

// ---- slot trays: the chip rows scroll sideways so the catalog can grow
// forever. trayify adds the browse furniture — edge fades + arrows only WHEN
// items are actually hidden, an item count on the label, and (when the
// surface has one) a ⊞ all door to its inventory sheet. The host container
// (the row) anchors the arrows: it gets .bb-trayrow for positioning.
export function trayify(tray, { label, onSeeAll } = {}) {
  if (!tray || !tray.children.length) return;
  const row = tray.parentElement;
  if (row) row.classList.add('bb-trayrow');
  if (label && !label.querySelector('.bb-count')) {
    const slotName = label.textContent.trim();
    const n = document.createElement('span');
    n.className = 'bb-count';
    n.textContent = tray.children.length;
    label.appendChild(n);
    if (onSeeAll) {
      // the OVERVIEW door: trays show 4-5 at a time; the inventory sheet
      // shows the whole category at once (Trym: scanning a long sidescroll
      // for "that item somewhere at the end" is exhausting)
      const all = document.createElement('button');
      all.type = 'button';
      all.className = 'bb-seeall';
      all.textContent = '⊞ all';
      all.setAttribute('aria-label', 'Browse all ' + slotName.toLowerCase());
      all.onclick = () => onSeeAll(tray, slotName);
      label.appendChild(all);
    }
  }
  let aL = null, aR = null;
  if (row) {
    const mk = (dir) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bb-trayarrow bb-trayarrow--' + (dir < 0 ? 'l' : 'r');
      b.textContent = dir < 0 ? '‹' : '›';
      b.setAttribute('aria-label', dir < 0 ? 'Scroll back' : 'More items');
      b.onclick = () => tray.scrollBy({ left: dir * tray.clientWidth * 0.8, behavior: 'smooth' });
      row.appendChild(b);
      return b;
    };
    aL = mk(-1); aR = mk(1);
  }
  const sync = () => {
    const more = tray.scrollWidth - tray.clientWidth > 4;
    const atL = tray.scrollLeft < 4;
    const atR = tray.scrollLeft > tray.scrollWidth - tray.clientWidth - 4;
    tray.classList.toggle('bb-chips--fadeR', more && !atR);
    tray.classList.toggle('bb-chips--fadeL', more && !atL);
    if (aL) aL.hidden = !more || atL;
    if (aR) aR.hidden = !more || atR;
  };
  tray.addEventListener('scroll', sync, { passive: true });
  // ⚠️ self-pruning: the PDP REBUILDS its wardrobe per pick — a plain resize
  // listener per trayify would accumulate forever, retaining dead trays
  const onResize = () => {
    if (!tray.isConnected) { window.removeEventListener('resize', onResize); return; }
    sync();
  };
  window.addEventListener('resize', onResize);
  sync();
}

// 👁 a band opens SHOWING what the banana wears — taking something off never
// starts with a hunt for where it lives in the sidescroll
export function revealWorn(tray) {
  if (!tray) return;
  const on = tray.querySelector('[aria-pressed="true"]');
  if (!on) return;
  const tr = tray.getBoundingClientRect(), cr = on.getBoundingClientRect();
  tray.scrollLeft += (cr.left - tr.left) - (tray.clientWidth - cr.width) / 2;
  // a clamped scroll fires no native event — nudge trayify's fade/arrow sync
  // so a tray that just gained chips shows its affordances
  tray.dispatchEvent(new Event('scroll'));
}

// 🏷 THE BANANA TOOLTIP — chips carry data-tip and ONE themed bubble follows
// the pointer (the OS title balloon looked stock). Hover/keyboard only
// ([[tappable-info-doctrine]]: touch never had tooltips — on mobile the info
// lives in visible selection + each surface's own cards). Idempotent:
// attaches once per page no matter how many surfaces ask.
let tipsOn = false;
export function attachTips() {
  if (tipsOn) return;
  tipsOn = true;
  const tipEl = document.createElement('div');
  tipEl.className = 'bb-tip';
  tipEl.hidden = true;
  document.body.appendChild(tipEl);
  let tipT = 0;
  const hide = () => { clearTimeout(tipT); tipT = 0; tipEl.hidden = true; };
  const showFor = (chip) => {
    const text = chip.dataset.tip || chip.getAttribute('aria-label');
    if (!text) return;
    tipEl.textContent = text;
    tipEl.hidden = false;
    tipEl.style.left = '0px'; tipEl.style.top = '0px';   // reset before measuring
    const r = chip.getBoundingClientRect(), tr = tipEl.getBoundingClientRect();
    const x = Math.max(6, Math.min(innerWidth - tr.width - 6, r.left + r.width / 2 - tr.width / 2));
    let y = r.top - tr.height - 12;
    const below = y < 4;
    if (below) y = r.bottom + 12;
    tipEl.classList.toggle('bb-tip--below', below);
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
  };
  if (matchMedia('(hover: hover)').matches) {
    document.addEventListener('mouseover', (e) => {
      const chip = e.target.closest && e.target.closest('.bb-chip');
      if (!chip) { hide(); return; }
      clearTimeout(tipT);
      tipT = setTimeout(() => showFor(chip), 160);
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest && e.target.closest('.bb-chip')) hide();
    });
  }
  document.addEventListener('focusin', (e) => {
    const chip = e.target.closest && e.target.closest('.bb-chip');
    if (chip) showFor(chip); else hide();
  });
  document.addEventListener('click', hide, true);
  addEventListener('scroll', hide, { passive: true, capture: true });
}
