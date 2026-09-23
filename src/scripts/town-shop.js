// 🏪 TOWN SHOP — every card the town opens over its own square (19 Sep 2026).
//
// Pip's shelf, the travelling stall, the night vendor and the notice board. Split out of
// town-room.js when that chunk reached 96% of its 56 000 B budget with 2.2 KB left and Trym asked
// for chunking. Nothing here runs until a card is opened, and none of it is on the walk-around path.
//
// ⭐ IT READS THE TOWN AND NEVER WRITES IT. Every card is a render of state the room owns, so this
// module takes a ctx and hands back four functions. Four of those ctx members are GETTERS, and that
// is not decoration: town-room reassigns `L`, `band`, `problems` and `curse` in place (a whole new
// object arrives from the room on every poll), so a value passed once here goes stale and the board
// quietly reports the town as it was when you arrived.
//
// ⚠️ WHAT STAYED BEHIND, and why: `shelfFor` (the QA seam calls it synchronously and a walk asserts
// its length), and `let merchant, vendor` — those two are the BODIES standing in the world, written
// by seven sites in town-room including one inside the frame loop. They were declared in the middle
// of this block by accident of history; taking them with it is a ReferenceError in lampsByHour().
import { passSpend, passStat, coinsNow } from '../lib/banana-pass.js';
import { grantToShed, orderFor, takeFromShed, hasInShed, homeStage, canHold, shipMin } from '../lib/homestead-inventory.js';
import { iconSvg } from '../lib/pixel-icons.js';

const dayNum = () => Math.floor(Date.now() / 86400000);

export function bootTownShop(ctx) {
  const {
    // the tables, passed once: none of these references is ever replaced
    COPY, W_BAND, W_OBJ, DEX, BANDS, ANCHORS, MERCHANT, CURSE_SHELF, OBJECTS, BOUNTY, SALT_SHELF,
    // the room's own helpers and its condition object (mutated in place, so the reference holds)
    cond, propOf, pickN, one, fill, found, omenNow, shelfFor,
    // ⚠️ GETTERS: town-room reassigns each of these, so a value would go stale
    band, life, problems, curse,
    // the world's card furniture and its books
    openCard, closeCard, cardBody, card, esc, say, hud, track,
  } = ctx;

    function rows(ids, markup, where) {
      const stage = homeStage(), coins = coinsNow(), room = canHold(), ws = COPY.store || {};
      return ids.map((id) => {
        const d = DEX[id]; if (!d) return '';
        const price = Math.max(1, Math.round(d.price * (markup || 1)));
        const can = d.stage <= stage && coins >= price && room;
        // the two notes are copy (store.needs / store.van): nothing until the words are approved
        return '<div class="tw-row"><div class="tw-store__it"><img src="' + esc(d.img) + '" alt=""><div><b>' + esc(d.name) + '</b><small>' + price + ' coins' + (d.stage > stage && ws.needs ? ' · ' + esc(ws.needs) : '') + (shipMin(d) && ws.van ? ' · ' + esc(ws.van) : '') + '</small></div></div>'
          + '<button type="button" data-town-buy="' + esc(id) + '" data-price="' + price + '" data-where="' + esc(where) + '"' + (can ? '' : ' disabled') + '>buy</button></div>';
      }).join('');
    }
    function wireBuys(soldLines) {
      cardBody.querySelectorAll('[data-town-buy]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.townBuy, price = +b.dataset.price, d = DEX[id]; if (!d) return;
        if (!canHold()) return;
        if (!passSpend(price, 'townstore', id)) return;
        const mins = shipMin(d);
        if (mins) orderFor(id, mins); else grantToShed(id);
        if (hud && hud.refresh) hud.refresh();
        b.disabled = true;
        const line = fill(one(soldLines, price + id.length), d.name.toLowerCase());
        if (line) say(line);
        track('town_buy', { id, price, where: b.dataset.where });
        // 🛍 the rest of the shelf re-prices against what is left in the purse
        cardBody.querySelectorAll('[data-town-buy]').forEach((o) => { if (!o.disabled && +o.dataset.price > coinsNow()) o.disabled = true; });
      }));
    }
    function storeCard() {
      const ids = shelfFor();
      const w = COPY.store || {};
      openCard('<h2>The General Store</h2>'
        + (ids ? (w.greet ? '<p class="tw-card__sub">' + esc(fill(w.greet)) + '</p>' : '') + '<div class="tw-store">' + rows(ids, 1, 'store') + '</div>'
          : (w.shut ? '<p class="tw-card__sub">' + esc(fill(w.shut)) + '</p>' : '<p class="tw-card__sub"></p>')));
      if (ids) wireBuys(w.sold);
      // 🚪 THE SHELF IS ON THE COUNTER INSIDE (Trym, 23 Sep 2026: "you can walk inside that store before anything
      // happens"). A tap on the shopfront walks you in (banana-town.js openFor); this card is the till's, so it carries no
      // way inside. It used to open at the door with a "Step inside" row under the goods (the old "a room is a gain,
      // never a toll" rule, docs/town-jobs-plan.md §4), and that is the thing Trym asked to move.
      return true;
    }
    function merchantCard() {
      const w = COPY.merchant || {};
      const ids = pickN(MERCHANT.pool.filter((id) => DEX[id]), MERCHANT.n, SALT_SHELF + dayNum() * 29);
      openCard('<h2>' + esc(w.name || 'The travelling stall') + '</h2>' + (w.greet ? '<p class="tw-card__sub">' + esc(fill(w.greet)) + '</p>' : '')
        + '<div class="tw-store">' + rows(ids, MERCHANT.markup, 'merchant') + '</div>');
      wireBuys(w.lines);
      track('town_merchant', { n: ids.length });
      return true;
    }
    function vendorCard() {
      const w = COPY.vendor || {};
      const ids = pickN(CURSE_SHELF.pool.filter((id) => DEX[id]), CURSE_SHELF.n, SALT_SHELF + dayNum() * 37);
      // what the player holds that the vendor wants: cursed finds sitting in the shed
      const held = OBJECTS.filter((o) => hasInShed(o.decor) > 0 && found(o.id));
      openCard('<h2>' + esc(w.name || 'The night stall') + '</h2>' + (w.greet ? '<p class="tw-card__sub">' + esc(fill(w.greet)) + '</p>' : '')
        + '<div class="tw-store">' + rows(ids, CURSE_SHELF.markup, 'vendor') + '</div>'
        + (held.length ? '<div class="tw-store">' + held.map((o) => { const d = DEX[o.decor]; const wo = W_OBJ[o.id] || {}; return '<div class="tw-row"><div class="tw-store__it"><img src="' + esc(d.img) + '" alt=""><div><b>' + esc(wo.name || d.name) + '</b><small>' + BOUNTY[o.rarity] + ' coins</small></div></div><button type="button" data-town-sell="' + o.id + '">sell</button></div>'; }).join('') + '</div>' : ''));
      wireBuys(w.lines);
      cardBody.querySelectorAll('[data-town-sell]').forEach((b) => b.addEventListener('click', () => {
        const o = OBJECTS.find((x) => x.id === b.dataset.townSell); if (!o) return;
        if (!takeFromShed(o.decor)) return;
        passStat('coins_earned', BOUNTY[o.rarity], 'object');
        if (hud && hud.refresh) hud.refresh();
        b.disabled = true;
        const line = fill(w.bought, (W_OBJ[o.id] || {}).name || DEX[o.decor].name);
        if (line) say(line);
        track('town_object', { id: o.id, sold: 1 });
      }));
      return true;
    }
    // 📌 THE SQUARE REPORT — and it is not a card of its own any more.
    //
    // Trym, 20 Sep 2026: "i think the Square Report sign is a bit unnecessary now that we have the Town
    // Health Meter popup — can we move the Square Report content into the Town Health popup? And remove
    // the sign?" He is right: the two said the same thing in two places, one of which you had to walk
    // across the square to find. The meter is on screen at all times; the report belongs under it.
    //
    // ⚠️ IT STAYS IN THIS CHUNK, and that is a budget decision rather than a tidy one. town-room.js
    // carries the health card and is at 87% of its ceiling; this block is the lamps, the to-do list, the
    // tally and the found objects, and it pulls OBJECTS, DEX and the icon set with it. So the health
    // card mounts an empty host and asks for this, and the report lands a frame later — which is what a
    // lazy chunk is for. The pictures are still the town's own; the words are still the copy file's.
    function report(host) {
      if (!host) return false;
      const w = COPY.board || {};
      const foundN = OBJECTS.filter((o) => found(o.id)).length;
      const note = (icon, n, label, cls) => '<div class="tw-paper tw-paper--note ' + (cls || '') + '"><i class="tw-pin"></i>' + iconSvg(icon, { size: 26 }) + '<b>' + n + '</b><small>' + esc(label) + '</small></div>';
      // the second notice: what is going on — a night tonight, a night on, the morning after — or,
      // on an ordinary day, that nights exist at all; and always what fixing is for
      const L = life(), cu = curse();   // ⚠️ READ THEM NOW, never close over them: town-room reassigns both
      const om = omenNow(), after = !cu && !om && L.curseAt && Date.now() - L.curseAt < 8 * 3600000;
      const news = cu && cu !== 'hush' ? w.night : om ? w.omen : after ? w.after : null;   // the nights are Moss's to explain (his card); the board only reports one that is coming, on, or just gone
      const bi = BANDS.indexOf(band()), nb = W_BAND[BANDS[bi + 1]] || null, todo = todoList();
      // ⚠️ NO PLANK AND NO SECOND FRAME. The board's card was a wooden board with its own title on a
      // plank, because it WAS the board. Inside the health popup that is a box inside a box inside a box
      // (design library §2) with a second heading under the one the card already has.
      // ⭐ AND IT KEEPS ITS NAME. The board is gone but the words on it are still THE SQUARE REPORT —
      // the copy's own `board.title` — and a small label over the papers is what makes them read as one
      // thing reported rather than three loose notes under a meter. (It also keeps that string read:
      // it used to name the plank in the square, and the plank went with the board.)
      host.innerHTML = ('<div class="tw-board2 tw-board2--in">'
        + (w.title ? '<b class="tw-board2__of">' + esc(w.title) + '</b>' : '')
        // 📋 THE REPORT, for a banana who has just walked in (Trym, 15 Sep: "look at the totality … fixing copy means often
        // cutting crap"): what this square is; the eight lamps as they are; what wants doing today — the player's own
        // open list, in plain words; one line on what the next state brings; one on the nights. No state stamp, no band
        // poetry, no paragraph on why — the intro says what a fix does.
        + (w.intro ? '<div class="tw-paper tw-paper--intro"><i class="tw-pin"></i><p>' + esc(fill(w.intro)) + '</p></div>' : '')
        + '<div class="tw-paper tw-paper--notice"><i class="tw-pin tw-pin--b"></i>'
        + '<canvas class="tw-lamps" width="220" height="66" aria-hidden="true"></canvas>'
        + '<p class="tw-todo">' + (w.todo ? '<small class="tw-todo__h">' + esc(w.todo) + '</small>' : '') + (todo.length ? todo.map(esc).join(' · ') : esc(fill(w.nothing || ''))) + '</p>'
        + (nb && nb.name ? '<small class="tw-next">' + (w.next ? esc(w.next) + ' ' : '') + '<b>' + esc(nb.name) + '</b>' + (nb.brings ? ' — ' + esc(fill(nb.brings)) : '') + '</small>' : '')
        + '</div>'
        + (news ? '<div class="tw-paper tw-paper--news' + (om || (cu && cu !== 'hush') ? ' is-omen' : '') + '"><i class="tw-pin' + (om || (curse && curse !== 'hush') ? '' : ' tw-pin--b') + '"></i><p class="tw-news__now">' + esc(fill(news)) + '</p></div>' : '')
        + '<div class="tw-tally">' + note('tools', L.today.fixes | 0, w.fixes || '', 'is-a') + note('users', L.today.people | 0, w.people || '', 'is-b') + note('moon-solid', foundN + '/' + OBJECTS.length, w.found || '', 'is-c') + '</div>'
        + (foundN ? '<div class="tw-paper tw-paper--list"><i class="tw-pin"></i>' + OBJECTS.filter((o) => found(o.id)).map((o) => { const d = DEX[o.decor], wo = W_OBJ[o.id] || {}; return '<div class="tw-store__it"><img src="' + esc(d.img) + '" alt=""><div><b>' + esc(wo.name || d.name) + '</b>' + (wo.desc ? '<small>' + esc(wo.desc) + '</small>' : '') + '</div></div>'; }).join('') + '</div>' : '')
        + '</div>');
      drawLamps(host.querySelector('.tw-lamps'));
      return true;
    }
    // today's open list in plain words — "2 dark lamps · a full bin · rubbish on the cobbles" — from the player's own
    // problems and the approved words for each kind (things.<kind> = [one, many])
    function todoList() {
      const W_THING = COPY.things || {}, counts = {};
      for (const p of problems()) counts[p.type] = (counts[p.type] || 0) + 1;
      return Object.entries(counts).map(([t, n]) => { const w = W_THING[t]; return w && w.length ? fill((n === 1 ? w[0] : w[1] || w[0]).replace('{n}', n)) : n + ' ' + t; });
    }
    // the town's own EIGHT lamps as they are — lit, stuttering or dark — drawn from the placed lamp's sprite so the
    // board never needs art of its own, and never says a lamp is out that the square shows lit (Trym, 15 Sep)
    function drawLamps(cv, frac) {
      if (!cv) return;
      const p = propOf('lamp0'); if (!p) return;
      const img = new Image();
      img.src = p.el.src;
      img.onload = () => {
        const g = cv.getContext('2d'); if (!g) return;
        g.imageSmoothingEnabled = false;
        const keys = ANCHORS.lamps, n = keys.length, slot = cv.width / n, lw = 16, lh = Math.round(lw * img.naturalHeight / img.naturalWidth);
        // the bar under the lamps: this band's stretch, filled as far as the town has come
        if (frac != null) { g.fillStyle = '#3a2a10'; g.fillRect(10, cv.height - 7, cv.width - 20, 6); g.fillStyle = '#ffe135'; g.fillRect(11, cv.height - 6, Math.round((cv.width - 22) * frac), 4); }
        for (let i = 0; i < n; i++) {
          // ⚠️ A FLICKERING LAMP IS A BROKEN LAMP and the report has to say so. It used to draw LIT with
          // a fainter halo and no shading at all — at sixteen pixels that is indistinguishable from working,
          // so a player with one dead lamp and one stuttering one fixed the dead one and the row read as
          // done (Trym, 19 Sep: "both broken streetlight got fixed status-wise"). Three readable steps now:
          // lit is a bright halo and no shade, stuttering is a weak halo AND a shade, dead is shade alone.
          const st = cond.lamps[keys[i]], x = Math.round(i * slot + slot / 2), ok = st === 'ok', top = cv.height - lh - 12;
          if (st !== 'out') {
            const r = g.createRadialGradient(x + 3, top + 7, 2, x + 3, top + 7, 18);
            r.addColorStop(0, 'rgba(255, 225, 90, ' + (ok ? 0.75 : 0.26) + ')'); r.addColorStop(1, 'rgba(255, 200, 40, 0)');
            g.fillStyle = r; g.fillRect(x - 18, top - 14, 44, 44);
          }
          g.drawImage(img, x - lw / 2, top, lw, lh);
          if (!ok) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(20, 16, 30, ' + (st === 'out' ? 0.55 : 0.36) + ')'; g.fillRect(x - lw / 2, top, lw, lh); g.globalCompositeOperation = 'source-over'; }
        }
      };
    }

  return { store: storeCard, report, merchant: merchantCard, vendor: vendorCard };
}
