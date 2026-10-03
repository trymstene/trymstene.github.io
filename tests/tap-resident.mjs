// 👆 shared by every walk that taps a resident: the ladder, the hire, the keepers, the citizens, Spinner and Pip
// 👆 A RESIDENT IS TAPPED WHERE THE TOWN FINDS THEM (3 Oct 2026). The walks tapped one fixed point, the feet, and the town is
// alive: at noon Moss sweeps the Coffee Cup's front 27 px in front of Bean, so a tap at Bean's feet lands on Moss, drawn in
// front of him, and Moss's card opened instead in about one walk of two. A player taps the part of the banana they can see.
// So does this: the first point down the body where the town's own answer to a tap there (window.__town.tapFinds) is that
// resident, with room round it for a step they take before the tap lands. While the camera is still easing after a stand(),
// or somebody covers all of them, it waits.
export async function tapResident(page, key, timeout = 15000) {
  const h = await page.waitForFunction((k) => {
    const e = document.querySelector('.tw-npc[data-k="' + k + '"]'), T = window.__town;
    if (!e || e.hidden || !T || !T.tapFinds) return null;
    const r = e.getBoundingClientRect(), w = document.getElementById('twWorld').getBoundingClientRect();
    const was = window.__tapCam; window.__tapCam = [w.left, w.top];
    if (!r.width || !was || Math.abs(was[0] - w.left) > 0.5 || Math.abs(was[1] - w.top) > 0.5) return null;
    const is = (x, y) => { const a = T.tapFinds(x, y); return !!a && a[0] === 'npc' && a[1] === k; };
    for (const fy of [0.82, 0.66, 0.5, 0.34]) for (const fx of [0.5, 0.36, 0.64]) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      if (is(x, y) && is(x - 5, y) && is(x + 5, y) && is(x, y - 5) && is(x, y + 5)) return { x, y };
    }
    return null;
  }, key, { timeout, polling: 100 });
  const p = await h.jsonValue();
  await page.mouse.click(p.x, p.y);
  return p;
}
