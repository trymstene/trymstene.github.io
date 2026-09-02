// 🌳 THE FAMILY TREE — a pure renderer: nodes in, a pannable, pinchable,
// collapsible, animated tree out. Used by the phone chunk (real animals)
// and by the bench page (a mock family); it knows nothing about the yard.
//
// node: { id, pa, name, state: 'live' | 'grass' | 'away', line,
//         thumb: { file, fw, fh, w }, gold, badge: 'star-solid' | 'crown-solid' | '' }
// opts: { onTap(node), icon(name, px) -> inline <svg> string, art: '/assets/homestead/' }

const NODE_W = 88, NODE_H = 130, GAP_X = 12, GAP_Y = 44, ROW_H = 182, PAD = 10;
const SC_MIN = 0.45, SC_MAX = 2;

export function buildTree(view, nodes, opts) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const kids = new Map();
  nodes.forEach((n) => { const p = n.pa && byId.has(n.pa) ? n.pa : 0; if (!kids.has(p)) kids.set(p, []); kids.get(p).push(n); });
  const roots = (kids.get(0) || []);
  const open = new Set(nodes.filter((n) => (kids.get(n.id) || []).length).map((n) => n.id));   // everything expanded at first
  view.innerHTML = '';
  view.classList.add('hs-treeview');
  const canvas = document.createElement('div');
  canvas.className = 'hs-treecanvas';
  view.appendChild(canvas);
  const els = new Map();    // id -> node element
  const nodeOf = new WeakMap();   // node element -> node
  const lines = new Map();  // id -> [segments] for the family under this parent
  let tx = 0, ty = 0, sc = 1, first = true;

  const measure = (n) => {
    const c = open.has(n.id) ? (kids.get(n.id) || []) : [];
    if (!c.length) return NODE_W;
    return Math.max(NODE_W, c.reduce((w, k) => w + measure(k), 0) + GAP_X * (c.length - 1));
  };
  const family = (n) => (kids.get(n.id) || []).reduce((s, k) => s + 1 + family(k), 0);
  const rows = (n) => 1 + (open.has(n.id) ? (kids.get(n.id) || []).reduce((d, k) => Math.max(d, rows(k)), 0) : 0);
  // a forest: each founder's tree is a block, blocks flow into rows the width
  // of the phone, so ten founders never become one long shelf
  const layout = () => {
    const pos = new Map();
    // never narrower than three lone founders — a 360 phone shrinks a hair instead of stacking them
    const maxW = Math.max(NODE_W * 3 + GAP_X * 2, (view.clientWidth || 340) - PAD * 2);
    let x = PAD, y = PAD, rowH = 0;
    const place = (n, x0, y0, depth) => {
      const w = measure(n);
      const c = open.has(n.id) ? (kids.get(n.id) || []) : [];
      pos.set(n.id, { x: x0 + w / 2 - NODE_W / 2, y: y0 + depth * ROW_H, depth });
      let kx = x0 + (w - (c.reduce((s, k) => s + measure(k), 0) + GAP_X * (c.length - 1))) / 2;
      c.forEach((k) => { place(k, kx, y0, depth + 1); kx += measure(k) + GAP_X; });
    };
    roots.forEach((r) => {
      const w = measure(r), h = (rows(r) - 1) * ROW_H + NODE_H;
      if (x > PAD && x + w > PAD + maxW) { x = PAD; y += rowH + GAP_Y; rowH = 0; }
      place(r, x, y, 0);
      x += w + GAP_X; rowH = Math.max(rowH, h);
    });
    return pos;
  };

  const icon = (name, px) => opts.icon(name, px);
  const nodeEl = (n) => {
    const el = document.createElement('div');
    el.className = 'hs-tnode is-' + n.state + (n.gold ? ' is-gold' : '');
    el.style.width = NODE_W + 'px';
    const ph = document.createElement('span');
    ph.className = 'hs-tphoto';
    const i = document.createElement('i');
    i.style.backgroundImage = "url('" + opts.art + n.thumb.file + "')";
    i.style.width = n.thumb.w + 'px'; i.style.aspectRatio = n.thumb.fw + ' / ' + n.thumb.fh;
    ph.appendChild(i);
    const badge = n.state === 'grass' ? 'flower-solid' : n.badge;
    if (badge) {
      const b = document.createElement('span');
      b.className = 'hs-tbadge';
      b.innerHTML = icon(badge, 15);
      ph.appendChild(b);
    }
    el.appendChild(ph);
    if (n.state === 'live') i.style.animationDelay = (-(n.id * 7919) % 4000) + 'ms';   // the living fidget, out of step
    const nm = document.createElement('b'); nm.textContent = n.name; el.appendChild(nm);
    const dt = document.createElement('small'); dt.textContent = n.line; el.appendChild(dt);
    if ((kids.get(n.id) || []).length) {
      // the toggle sits on the stem: a chevron when open, the hidden headcount when folded
      const tg = document.createElement('button');
      tg.className = 'hs-ttoggle' + (open.has(n.id) ? ' is-open' : '');
      tg.setAttribute('aria-label', 'show or hide the family');
      tg.innerHTML = icon('chevron-down', 14) + '<b>' + family(n) + '</b>';
      tg.addEventListener('click', (e) => {
        e.stopPropagation();
        // the tapped animal stays under the thumb: the canvas glides by the
        // same amount the layout moves her, on the same curve
        const p0 = layout().get(n.id);
        if (open.has(n.id)) open.delete(n.id); else open.add(n.id);
        tg.classList.toggle('is-open', open.has(n.id));
        const p1 = layout().get(n.id);
        tx -= (p1.x - p0.x) * sc; ty -= (p1.y - p0.y) * sc;
        glide(); apply(); paint();
      });
      el.appendChild(tg);
    }
    nodeOf.set(el, n);   // taps are read off the pointer (see below), never `click`
    return el;
  };

  const visible = () => {
    const out = [];
    const walk = (n) => { out.push(n); if (open.has(n.id)) (kids.get(n.id) || []).forEach(walk); };
    roots.forEach(walk);
    return out;
  };

  // 🌱 grow-in: on the first paint every row arrives a beat after the one above
  const arrive = (el, depth) => {
    el.classList.add('is-new');
    const wait = first ? depth * 110 : 0;
    el.style.transitionDelay = wait + 'ms';
    void el.offsetWidth;   // flush the hidden state so the reveal transitions
    el.classList.remove('is-new');
    setTimeout(() => { el.style.transitionDelay = ''; }, wait + 400);
  };

  const paint = () => {
    const pos = layout();
    const vis = new Set(visible().map((n) => n.id));
    vis.forEach((id) => {
      const n = byId.get(id), p = pos.get(id);
      let el = els.get(id);
      if (!el) {
        el = nodeEl(n); els.set(id, el); canvas.appendChild(el);
        el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
        arrive(el, p.depth);
      } else {
        el.style.left = p.x + 'px'; el.style.top = p.y + 'px';
        el.classList.remove('is-gone');
      }
    });
    els.forEach((el, id) => {
      if (vis.has(id)) return;
      el.classList.add('is-gone');
      setTimeout(() => { if (el.classList.contains('is-gone')) { el.remove(); els.delete(id); } }, 320);
    });
    // connectors: an elbow per family — stem, bar, drops (divs, so they animate)
    lines.forEach((segs, id) => { if (!vis.has(id) || !open.has(id)) { segs.forEach((s) => s.remove()); lines.delete(id); } });
    vis.forEach((id) => {
      if (!open.has(id)) return;
      const c = (kids.get(id) || []);
      if (!c.length) return;
      const p = pos.get(id);
      let segs = lines.get(id);
      if (!segs) {
        segs = [];
        for (let k = 0; k < c.length + 2; k++) {
          const d = document.createElement('i'); d.className = 'hs-tline';
          canvas.insertBefore(d, canvas.firstChild); segs.push(d); arrive(d, p.depth + 1);
        }
        lines.set(id, segs);
      }
      const px = p.x + NODE_W / 2, py = p.y + NODE_H;
      const mid = py + (ROW_H - NODE_H) / 2;
      const xs = c.map((k) => pos.get(k.id).x + NODE_W / 2);
      const put = (d, x, y, w, h) => { d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.width = w + 'px'; d.style.height = h + 'px'; };
      put(segs[0], px - 1.5, py, 3, mid - py);
      put(segs[1], Math.min(...xs) - 1.5, mid - 1.5, Math.max(...xs) - Math.min(...xs) + 3, 3);
      c.forEach((k, j) => put(segs[j + 2], xs[j] - 1.5, mid, 3, pos.get(k.id).y - mid));
    });
    let mx = 0, my = 0;
    pos.forEach((p) => { mx = Math.max(mx, p.x + NODE_W + PAD); my = Math.max(my, p.y + NODE_H + PAD); });
    canvas.style.width = mx + 'px'; canvas.style.height = my + 'px';
    if (first) { fit(false); first = false; }
  };

  // 🗺 the map: pan by drag or wheel, zoom by pinch or ctrl-wheel, one pill to refit
  const apply = () => { canvas.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + sc + ')'; };
  const zoomAt = (s, x, y) => {
    s = Math.min(SC_MAX, Math.max(SC_MIN, s));
    const k = s / sc;
    tx = x - (x - tx) * k; ty = y - (y - ty) * k; sc = s; apply();
  };
  const glide = () => { canvas.style.transition = 'transform 0.35s ease'; setTimeout(() => { canvas.style.transition = ''; }, 380); };
  const fit = (smooth, all) => {
    // first open: the width, and the whole thing if that costs little;
    // the pill: everything, however small it has to get
    const w = canvas.offsetWidth || 1, h = canvas.offsetHeight || 1;
    const vw = view.clientWidth, vh = view.clientHeight;
    let s = Math.min(1, (vw - 8) / w);
    const sh = (vh - 8) / h;
    if (sh < s && (all || sh >= 0.7)) s = sh;
    sc = Math.max(SC_MIN, s);
    tx = Math.round((vw - w * sc) / 2);
    ty = h * sc < vh ? Math.round(Math.min(12, (vh - h * sc) / 2)) : 0;
    if (smooth) glide();
    apply();
  };
  const fitBtn = document.createElement('button');
  fitBtn.className = 'hs-tfit';
  fitBtn.setAttribute('aria-label', 'show the whole tree');
  fitBtn.innerHTML = icon('zoom-out', 18);
  fitBtn.addEventListener('click', (e) => { e.stopPropagation(); fit(true, true); });
  view.appendChild(fitBtn);

  // ⚠️ the map CAPTURES the pointer to pan, and a captured pointer's `click`
  // lands on the map, never on the photo under the finger — so a tap is read
  // off the pointer itself: a press on a photo that neither moves nor grows
  // a second finger. (The pills are buttons and keep their own clicks.)
  const ptrs = new Map();
  let drag = null, pinch = null, tap = null;
  const local = (e) => { const r = view.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const still = (e) => tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) <= 8;
  view.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    ptrs.set(e.pointerId, local(e));
    try { view.setPointerCapture(e.pointerId); } catch (err) {}
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, s0: sc }; drag = null; tap = null;
    } else {
      drag = { x: e.clientX, y: e.clientY, tx, ty };
      const el = e.target.closest('.hs-tnode');
      tap = el ? { el, x: e.clientX, y: e.clientY } : null;
    }
  });
  view.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, local(e));
    if (tap && !still(e)) tap = null;
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      zoomAt(pinch.s0 * d / pinch.d0, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      pinch.s0 = sc; pinch.d0 = d;
    } else if (drag) { tx = drag.tx + (e.clientX - drag.x); ty = drag.ty + (e.clientY - drag.y); apply(); }
  });
  const end = (e) => {
    if (e.type === 'pointerup' && ptrs.size === 1 && still(e)) {
      const n = nodeOf.get(tap.el);
      if (n && opts.onTap) opts.onTap(n);
    }
    tap = null;
    ptrs.delete(e.pointerId); pinch = null;
    const rest = [...ptrs.keys()];
    drag = null;
    if (rest.length === 1) { const p = ptrs.get(rest[0]); const r = view.getBoundingClientRect(); drag = { x: p[0] + r.left, y: p[1] + r.top, tx, ty }; }
  };
  view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
  view.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey) { const [x, y] = local(e); zoomAt(sc * (e.deltaY < 0 ? 1.1 : 0.9), x, y); }
    else { tx -= e.deltaX; ty -= e.deltaY; apply(); }
  }, { passive: false });

  paint();
  return { refit: () => fit(true, true), paint };
}
