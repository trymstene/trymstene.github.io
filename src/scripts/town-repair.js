// 🔧 THE ARCADE'S REPAIR GAME (23 Sep 2026; the job ladder's slice 2 — Trym: "build the arcade repair game next").
//
// A dark cabinet used to be a 3.2-second hold: stand at it and wait for a bar. The ladder plan named it the weakest job in
// town — "none: walk onto litter, hold still" — and the arcade is the ladder's third rung, so it needed a real skill. It is
// the counter's: the same tray, the same one-thumb gestures, the same windows measured against a real thumb (town-cafe.js),
// graded the same way — the repair's grade is its WORST step. Three steps on the cabinet's back panel:
//   unscrew   a needle to stop in the screw's slot (the café's grinder)
//   solder    a hold, let go in the band (the café's pour)
//   power     three presses on the switch's pulse (the café's milk)
// A spoiled repair sparks and the cabinet stays dark: another go, straight away, as many as it takes. A fine one wakes it,
// a perfect one wakes it and earns the most work XP (src/data/town/jobs.js XP.condo.fix, by grade).
//
// ⚠️ IT DECIDES NOTHING ABOUT THE ARCADE. The town's room owns the dark cabinet and its fix (town-room.js cabinetFixed);
// this is only the tray and the thumb, handed a cabinet and handing back a grade. While it is up the banana is held where
// it stands (banana-town.js working()), and the tray's Leave button is the way out — the cabinet simply stays dark.
import { mountCounter, newCup, CAFE_DECK } from './town-cafe.js';
const COPY_MODS = import.meta.glob('../data/copy/town-repair.json', { eager: true, import: 'default' });
export const COPY = Object.values(COPY_MODS)[0] || {};

export const ARCADE_DECK = {
  id: 'arcade',
  order: ['unscrew', 'solder', 'power'],
  stations: {
    unscrew: { ...CAFE_DECK.stations.grind, kind: 'sweep' },
    solder: { ...CAFE_DECK.stations.pour, kind: 'hold' },
    power: { ...CAFE_DECK.stations.milk, kind: 'taps' },
  },
  drinks: { panel: ['screw', 'wire', 'switch'] },   // the ticket: the three parts, as pictures
};

export function bootTownRepair(ctx) {
  const { host, say, track, onFixed } = ctx;
  let tray = null, on = false, key = '', tries = 0, held = false;
  const words = () => COPY.go || {};
  // the screw's slot moves with the day and each try, so a second go is not the same tap
  const serve = () => tray.serve(newCup('panel', 0, (Math.floor(Date.now() / 864e5) * 131 + tries * 29 + key.length * 7) >>> 0, ARCADE_DECK), words().unscrew || '');
  function start(k) {
    if (on || !k) return false;
    on = true; key = k; tries = 0;
    if (!tray) tray = mountCounter(host, { deck: ARCADE_DECK, label: (s) => words()[s] || '', leave: COPY.leave || '', onLeave: stop, onCup: done });
    serve();
    if (!held) tray.show();
    if (COPY.on) say(COPY.on);
    return true;
  }
  function done(c) {
    if (!on) return;
    const g = c.grade | 0;
    if (!g) {   // it sparks and stays dark: another go (a fix is told to Pulse by the room that wakes the cabinet)
      track('town_chore', { at: 'condo', kind: 'spark' });
      tries++;
      if (COPY.spark) say(COPY.spark);
      setTimeout(() => { if (on) serve(); }, 700);
      return;
    }
    on = false;
    tray.hide();
    const line = (COPY.fixed || {})[g === 2 ? 'perfect' : 'fine'];
    if (line) say(line);
    if (onFixed) onFixed(key, g);
  }
  function stop() { if (!on) return false; on = false; if (tray) tray.hide(); return true; }
  return {
    start, stop,
    on: () => on,
    // the pocket opens at the bottom of the screen too: the tray stands down for it, as the counters do
    hold(v) { held = !!v; if (!tray || !on) return; if (held) tray.fold(); else tray.show(); },
    seam: { on: () => on, start, stop, key: () => key, tries: () => tries, cup: () => (tray ? tray.cup() : null), gest: () => (tray ? tray.seam : null) },
  };
}
