// 📸 THE PARK-DAY CARD — who's in the park, your day's numbers, and a
// shareable postcard: the bay's beach-day card, park edition. Wired through
// the shared ctx (P5 pattern); the garden lends its gardener level + live
// bloom. Booted AFTER the room wiring so the roster can read the peers.
import { drawComposite } from '../lib/banana-engine.js';
import { passGet } from '../lib/banana-pass.js';
import { track, esc } from './park-util.js';
import { birdsToday, BIRD_NAMES } from './park-birds.js';

const SHARE_FILE = 'my-day-the-park-trymstene.com.png';

export function initShare(ctx, garden) {
  const { ME_DRAW, peersList, parkName } = ctx;

  // ---- the panel below the view: roster + your park day -------------------
  const parkStart = Date.now();
  function parkTime() {
    const t = Math.max(0, Math.floor((Date.now() - parkStart) / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return h ? h + 'h ' + m + 'm' : m ? m + 'm ' + s + 's' : s + 's';
  }
  // live bloom, '—' until the server has spoken
  const bloomStr = () => { const v = garden.bloomNow(); return v < 0 ? '—' : v + '%'; };
  const rosterEl = document.getElementById('pkRoster');
  const dayStatsEl = document.getElementById('pkDayStats');
  // 🔭 today's sightings as little pack portraits (the idle frame of each
  // species' own sheet — row 3 col 0, no extra asset)
  const birdFace = (sp, cls) => '<i class="' + (cls || 'pk-bface') + '" title="' + esc(BIRD_NAMES[sp] || sp)
    + '" style="background-image:url(/assets/park/bird-' + sp + '.png)"></i>';
  function refreshSide() {
    if (dayStatsEl) {
      const s = passGet().stats || {};
      const seen = birdsToday();
      dayStatsEl.innerHTML =
        '<span class="pk-daystats__time">⏱ <b>' + parkTime() + '</b> in the park</span>'
        + '<span>🌿 <b>' + (s.weeds_pulled || 0) + '</b> weeds pulled</span>'
        + '<span>🌱 <b>' + (s.garden_harvests || 0) + '</b> harvests</span>'
        + '<span>🥚 <b>' + (s.eggs_found || 0) + '</b> eggs found</span>'
        + '<span>🧑‍🌾 <b>lvl ' + garden.gardenerLvl().lvl + '</b> gardener</span>'
        + '<span>🌸 <b>' + bloomStr() + '</b> health</span>'   // 'park health' wrapped on 360px chips
        + '<span class="pk-daystats__birds">🔭 <b>' + seen.length + '</b> bird'
        + (seen.length === 1 ? '' : 's') + ' spotted today'
        + (seen.length ? '<em>' + seen.map((sp) => birdFace(sp)).join('') + '</em>'
          : '<small>none yet — tap a bird to spot it</small>') + '</span>';
    }
    if (rosterEl) {
      const me = '<li class="is-you"><span>' + esc(parkName || 'you')
        + '</span><span class="pk-roster__tag">YOU</span></li>';
      const others = peersList()
        .map((p) => '<li><span>' + esc(p.name || 'a banana') + '</span></li>').join('');
      rosterEl.innerHTML = me + others;
    }
  }
  refreshSide();
  setInterval(() => { if (!document.hidden) refreshSide(); }, 1000);

  // ---- 📸 SHARE MY PARK DAY: a 1080×1080 postcard rendered on the spot ----
  // The bay card's graphic language, park mood: a deep forest band up top
  // with a scalloped treeline, warm lawn below, light through leaves instead
  // of a sun — YOUR banana big and tilted, today's numbers beside it.
  async function shareDay() {
    try { await document.fonts.ready; } catch (e) {}
    const S = 1080;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    // warm lawn ground, a deep forest band across the top
    const lawn = c.createLinearGradient(0, S * 0.28, 0, S);
    lawn.addColorStop(0, '#b8d478');
    lawn.addColorStop(1, '#86ae52');
    c.fillStyle = lawn; c.fillRect(0, 0, S, S);
    const woods = c.createLinearGradient(0, 0, 0, S * 0.30);
    woods.addColorStop(0, '#2f8f45');
    woods.addColorStop(1, '#54b86a');
    c.fillStyle = woods; c.fillRect(0, 0, S, S * 0.30);
    // the treeline: a darker scalloped silhouette of crowns along the band's
    // bottom edge — the forest the lawn opens out of
    c.fillStyle = '#1f5c2e';
    const EDGE = Math.round(S * 0.30);
    for (let i = 0; i < 12; i++) {
      const x = i * 96 + ((i * 379) % 48);
      const r = 46 + ((i * 733) % 34);
      c.beginPath(); c.arc(x, EDGE - 14, r, 0, Math.PI * 2); c.fill();
    }
    // 🌤 GOD-RAYS v2 (Trym: "stronger sun-effect lines… from the corner of
    // the card"): the apex sits JUST OFF the top-right corner and the fan
    // sweeps the whole card — higher alpha, wider blades, plus a soft
    // corner glow so the light has a source without a literal sun disc.
    const RAYX = S + 26, RAYY = -26;
    const glow = c.createRadialGradient(RAYX, RAYY, 0, RAYX, RAYY, 340);
    glow.addColorStop(0, 'rgba(255,246,190,0.5)');
    glow.addColorStop(1, 'rgba(255,246,190,0)');
    c.fillStyle = glow;
    c.fillRect(S - 380, 0, 380, 380);
    c.save();
    c.translate(RAYX, RAYY);
    for (let i = 0; i < 9; i++) {
      c.save();
      c.rotate((97 + i * 10.4) * Math.PI / 180);   // fan: straight down → far left
      const len = 1750, w0 = 8, w1 = 92 + (i % 2) * 44;
      const g = c.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, 'rgba(255,246,180,0.30)');
      g.addColorStop(0.55, 'rgba(255,246,180,0.16)');
      g.addColorStop(1, 'rgba(255,246,180,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, -w0); c.lineTo(len, -w1); c.lineTo(len, w1); c.lineTo(0, w0);
      c.closePath(); c.fill();
      c.restore();
    }
    c.restore();
    // dappled light pooling on the lawn where the rays land
    c.fillStyle = 'rgba(255,250,205,0.10)';
    for (let i = 0; i < 12; i++) {
      c.beginPath();
      c.ellipse(((i * 733) % S), 400 + ((i * 379) % (S - 460)),
        44 + ((i * 211) % 46), 18 + ((i * 149) % 18), 0, 0, Math.PI * 2);
      c.fill();
    }
    // tiny flower specks so the lawn isn't flat
    const petals = ['#fffdf5', '#ffd6e8', '#ffe135'];
    for (let i = 0; i < 46; i++) {
      c.fillStyle = petals[i % 3];
      c.fillRect(((i * 641) % S), 380 + ((i * 487) % (S - 420)), 7, 7);
    }
    // ── v2 background details: the park itself gets on the card ──
    // ⛲ the fountain, mid-distance in the treeline clearing — a simple
    // two-tone silhouette with the water arcs
    const drawFountain = (fx, fy, k) => {
      const dark = '#33735c', lite = '#7fb98f';
      c.fillStyle = dark; c.fillRect(fx - 52 * k, fy - 14 * k, 104 * k, 14 * k);
      c.fillStyle = lite; c.fillRect(fx - 52 * k, fy - 20 * k, 104 * k, 6 * k);
      c.fillStyle = dark; c.fillRect(fx - 7 * k, fy - 52 * k, 14 * k, 38 * k);
      c.fillStyle = lite; c.fillRect(fx - 22 * k, fy - 58 * k, 44 * k, 8 * k);
      c.strokeStyle = 'rgba(200,236,255,0.9)';
      c.lineWidth = 5 * k;
      c.lineCap = 'round';
      c.beginPath(); c.moveTo(fx, fy - 58 * k);
      c.quadraticCurveTo(fx - 30 * k, fy - 96 * k, fx - 40 * k, fy - 26 * k); c.stroke();
      c.beginPath(); c.moveTo(fx, fy - 58 * k);
      c.quadraticCurveTo(fx + 30 * k, fy - 96 * k, fx + 40 * k, fy - 26 * k); c.stroke();
    };
    drawFountain(640, 912, 1.0);   // the sunlit lawn, right of centre, under the stats
    // 🌼 flower clusters — little drifts, bigger than the specks
    const cluster = (cx2, cy2, col) => {
      for (let i = 0; i < 6; i++) {
        const fx = cx2 + ((i * 53) % 64) - 32, fy = cy2 + ((i * 37) % 40) - 20;
        c.fillStyle = '#2c6b2c'; c.fillRect(fx + 3, fy + 8, 4, 12);
        c.fillStyle = col;
        c.fillRect(fx - 6, fy, 8, 8); c.fillRect(fx + 8, fy, 8, 8);
        c.fillRect(fx + 1, fy - 7, 8, 8); c.fillRect(fx + 1, fy + 7, 8, 8);
        c.fillStyle = '#fffdf0'; c.fillRect(fx + 2, fy + 1, 6, 6);
      }
    };
    cluster(415, 585, '#ffd6e8');
    cluster(860, 862, '#ffe135');
    cluster(555, 1005, '#fffdf5');
    // 🐔🐇 park animals strolling the lawn, a little ❤️ over each head —
    // the ACTUAL farm-pack strips (frame 0), scaled small, pixelated
    const loadImg = (src) => new Promise((res) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src;
    });
    const [chick1, chick2, rabbit] = await Promise.all([
      loadImg('/assets/park/a-chicken1.png'),
      loadImg('/assets/park/a-chicken2.png'),
      loadImg('/assets/park/a-rabbit.png'),
    ]);
    c.imageSmoothingEnabled = false;
    const critter = (img, fx, fy, k, flip) => {
      if (!img) return;                     // strip missing → just no cameo
      const fw = Math.floor(img.width / 6), fh = img.height;
      c.save();
      c.translate(fx, fy);
      if (flip) c.scale(-1, 1);
      c.drawImage(img, 0, 0, fw, fh, -fw * k / 2, -fh * k, fw * k, fh * k);
      c.restore();
      c.textAlign = 'center';
      c.font = '34px serif';
      c.fillText('❤️', fx, fy - fh * k - 12);
    };
    critter(chick2, 505, 618, 1.8);         // strolling past the banana
    critter(chick1, 540, 1020, 2.4, true);  // pecking near the front
    critter(rabbit, 840, 902, 1.2);         // hopping under the stats
    // your banana — hands-up frame, big, tilted, hugging the left edge
    const bcv = document.createElement('canvas');
    bcv.width = bcv.height = 1024;
    drawComposite(bcv.getContext('2d'), 1024, 2, {
      bg: 'transparent', captions: false, top: '', bottom: '',
      hat: ME_DRAW.hat, glasses: ME_DRAW.glasses, extras: ME_DRAW.extras || {}, effect: 'none',
    });
    // a soft contact shadow on the grass under him
    c.fillStyle = 'rgba(30,60,20,0.30)';
    c.beginPath(); c.ellipse(255, 940, 190, 42, 0, 0, Math.PI * 2); c.fill();
    c.save();
    c.imageSmoothingEnabled = false;
    c.translate(150, 640);
    c.rotate(-9 * Math.PI / 180);
    c.drawImage(bcv, -620, -620, 1240, 1240);
    c.restore();
    // type, right-aligned, the banana leans into it
    c.textAlign = 'right';
    c.fillStyle = '#163a1c';
    c.font = '800 44px "Archivo Black", sans-serif';
    c.fillText('MY DAY AT', S - 60, 130);
    c.fillStyle = '#0f5c26';
    c.font = '800 82px "Archivo Black", sans-serif';
    c.fillText('THE PARK', S - 60, 220);
    c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = 14;
    c.fillStyle = '#e6712a';
    c.font = '800 42px "Archivo Black", sans-serif';
    c.fillText('TENDED FOR ' + parkTime().toUpperCase(), S - 60, 292);
    c.shadowBlur = 0;
    // 🔭 SPOTTED TODAY — a portrait strip under the header, right-aligned so
    // it reads as part of the type block; the stats slide down to make room
    // (nothing else on the card moves). Up to 6 portraits, the label carries
    // the true count.
    const seen = birdsToday();
    if (seen.length) {
      const faces = await Promise.all(seen.slice(0, 6)
        .map((sp) => loadImg('/assets/park/bird-' + sp + '.png')));
      c.textAlign = 'right';
      c.fillStyle = '#1c3312';
      c.font = '800 30px "Archivo Black", sans-serif';
      c.fillText('SPOTTED TODAY · ' + seen.length, S - 60, 340);
      const FW = 64, GAP = 8;
      let fx = S - 60 - faces.length * (FW + GAP) + GAP;
      c.imageSmoothingEnabled = false;
      faces.forEach((img) => {
        if (img) c.drawImage(img, 0, 96, 32, 32, fx, 354, FW, FW);   // row 3 col 0 = the idle pose
        fx += FW + GAP;
      });
    }
    const s = passGet().stats || {};
    const v = garden.bloomNow();
    const rows = [
      [String(s.weeds_pulled || 0), 'WEEDS PULLED'],
      [String(s.garden_harvests || 0), 'HARVESTS'],
      [String(s.eggs_found || 0), 'EGGS FOUND'],
      [v < 0 ? '—' : v + '%', 'PARK HEALTH'],
    ];
    let y = seen.length ? 508 : 400;
    const gap = seen.length ? 122 : 132;
    for (const [n, label] of rows) {
      c.shadowColor = 'rgba(255,255,255,0.85)'; c.shadowBlur = 20;
      c.fillStyle = '#2f5514';
      c.font = '800 96px "Archivo Black", sans-serif';
      c.textAlign = 'right';
      c.fillText(String(n), S - 470, y);
      c.shadowBlur = 8;
      c.fillStyle = '#1c3312';
      c.font = '800 34px "Archivo Black", sans-serif';
      c.textAlign = 'left';
      c.fillText(label, S - 445, y - 8);
      c.textAlign = 'right';
      c.shadowBlur = 0;
      y += gap;
    }
    c.fillStyle = '#1c3312';
    c.font = '700 30px "Archivo Black", sans-serif';
    c.fillText((parkName || 'a banana').toUpperCase(), S - 60, S - 116);
    c.fillStyle = '#0f5c26';
    c.font = '800 34px "Archivo Black", sans-serif';
    c.fillText('trymstene.com', S - 60, S - 62);
    track('park_share_day');
    openShare(cv);
  }
  function openShare(cv) {
    const modal = document.getElementById('pkShareModal');
    document.getElementById('pkShareSlot').replaceChildren(cv);
    modal.hidden = false;
    document.getElementById('pkShareSys').hidden = !navigator.canShare;
    const toBlob = () => new Promise((r) => cv.toBlob(r, 'image/png'));
    document.getElementById('pkShareDl').onclick = async () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await toBlob());
      a.download = SHARE_FILE; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    };
    document.getElementById('pkShareCopy').onclick = async () => {
      const btn = document.getElementById('pkShareCopy');
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': await toBlob() })]);
        btn.textContent = '✓ copied';
      } catch (e) { btn.textContent = 'copy blocked — download'; }
      setTimeout(() => { btn.textContent = '⧉ copy image'; }, 2500);
    };
    document.getElementById('pkShareSys').onclick = async () => {
      const file = new File([await toBlob()], SHARE_FILE, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'My day at The Park' }); } catch (e) {}
      }
    };
  }
  const closeShare = () => { document.getElementById('pkShareModal').hidden = true; };
  document.getElementById('pkShareDay').addEventListener('click', shareDay);
  document.getElementById('pkShareClose').addEventListener('click', closeShare);
  document.getElementById('pkShareModal').addEventListener('click', (e) => {
    if (e.target.id === 'pkShareModal') closeShare();
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('pkShareModal').hidden) closeShare();
  });

  return { refreshSide };
}
