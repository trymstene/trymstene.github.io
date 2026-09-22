// 🎖 THE BIG MOMENT — pixel type over the world for a beat that changes what you are (22 Sep 2026).
//
// The rave has put a new title over the dance floor since August; the town's first beat of the same kind is
// being hired. One call, the rave's timing: in over 0.3 s, held, then up and out. The looks are
// /css/world-moment.css (link it in the page's head); the words are always the caller's, from the rig.
// See docs/design-library.md §27.
//
//   bigMoment(view, 'HIRED', 'YOU WORK AT THE COFFEE CUP NOW')
export function bigMoment(host, title, sub, opts) {
  if (!host || !title) return null;
  const d = document.createElement('div');
  d.className = 'wm-moment';
  d.setAttribute('role', 'status');
  const b = document.createElement('b'); b.textContent = title; d.appendChild(b);
  if (sub) { const s = document.createElement('small'); s.textContent = sub; d.appendChild(s); }
  host.appendChild(d);
  const hold = (opts && opts.hold) || 3800;
  setTimeout(() => d.classList.add('wm-moment--out'), hold);
  setTimeout(() => d.remove(), hold + 600);
  return d;
}
