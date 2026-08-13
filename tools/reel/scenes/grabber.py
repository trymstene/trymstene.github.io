# -*- coding: utf-8 -*-
"""🕹 THE GRABBER — the pier's claw machine, and the one prize that isn't luck.

The real mechanic (banana-beach.js openGrabber + beach.astro .bh-glass/.bh-claw):
a glass case panel, a ticket bar, and a claw that descends and NEVER misses.

   0.00 the machine on the pier — a banana walks the last leg and STOPS
   0.21 tap → the panel snaps open over the beach
   0.30 the ticket bar fills in three chunks; at 0.43 the button lights
   0.48 the camera dives INTO the glass
   0.56 the claw rides down the rail, prongs close on the giant plush
   0.73 LIFT — flash, ring, chroma, sparkles, confetti
   0.85 cut back to the pier: won = WORN, the plush is in its hand
"""
import math

from PIL import Image, ImageDraw

from engine import (BAN_H, Cam, Walk, asset, blink_fade, chroma_split, clamp01, confetti,
                    flash, flicker, impact_ring, in_out, out_back, out_cubic, pulse, seg,
                    shake_img, sparkle_burst, vignette, world_banana, zoom_punch, H, W)

SECS = 4.9

# 🌍 the pier, in beach-plate world px (beach-geo.js GRABBER = 2648,700)
GX = 2648
MACH = (2600, 546, 2696, 699)          # the claw machine baked into the plate
GLOW = (2607, 556, 2689, 654)          # its lit window
STAND = (2612, 764)                    # where you stand to reach it

# 🎛 the panel, in CSS px (straight off beach.astro)
CARD_W, INNER, PAD_X, PAD_Y, BRD, SHD = 420, 388, 16, 14.4, 4, 6
HEAD_H, HEAD_MB, GLASS_H = 30, 10, 132
GAP1, BAR_BOX, GAP2, BTN_MT, BTN_H = 20, 20, 16, 16, 39
CARD_H = 2 * BRD + 2 * PAD_Y + HEAD_H + HEAD_MB + GLASS_H + GAP1 + BAR_BOX + GAP2 + BTN_MT + BTN_H
GLASS_TOP = BRD + PAD_Y + HEAD_H + HEAD_MB          # from the card's top edge
GLASS_MID = GLASS_TOP + GLASS_H / 2
PLUSH_H, PLUSH_AR = 72, 417 / 456                   # the grand prize, filling its case
PRONG_LEN = 26                                      # the .bh-claw prong drop

BLACK = (0, 0, 0, 255)
CARD_BG = (23, 18, 31, 255)
GOLD = (255, 210, 87, 255)
ORANGE = (255, 179, 71, 255)
ROD = (200, 200, 208, 255)
PRONG = (170, 170, 182, 255)


def _plush(ph):
    """the ORIGINAL banana art, snapped to whole source blocks so it stays crisp"""
    src = asset('wearables/plushbanana.png')
    ph = max(24, round(ph / 24) * 24)
    return src.resize((max(1, round(ph * PLUSH_AR)), ph), Image.NEAREST)


def _glass(S, down, close, up, sheen, lit):
    """the .bh-glass case: gradient, rail, claw, plush — clipped like overflow:hidden"""
    gw, gh = round(INNER * S), round(GLASS_H * S)
    im = Image.new('RGBA', (gw, gh), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for y in range(gh):
        u = y / max(1, gh - 1)
        d.line([0, y, gw, y], fill=(round(77 - 26 * u), round(107 - 35 * u), round(128 - 36 * u), 255))
    d.rectangle([0, gh - round(13 * S), gw, gh], fill=(40, 56, 72, 255))
    d.ellipse([gw / 2 - 70 * S, gh - 27 * S, gw / 2 + 70 * S, gh - 1 * S],
              fill=(102, 132, 154, 130))

    # 🦾 geometry: the claw hangs on the rail, the prongs drop PRONG_LEN below it
    ps = _plush(PLUSH_H * S)
    rest_top = gh - 8 * S - ps.height
    rod_rest = rest_top + 0.40 * ps.height - PRONG_LEN * S     # feet meet the plush
    rod_h = 10 * S + (rod_rest - 10 * S) * down - (rod_rest - 14 * S) * up
    feet = rod_h + PRONG_LEN * S
    cx = gw / 2

    # 🍌 THE GRAND PRIZE — plush-sized in the case, hoisted when the claw grips
    ptop = rest_top if up <= 0 else feet - 0.40 * ps.height
    if up > 0:
        ps = ps.rotate(math.sin(up * 7.5) * 4.5 * (1 - up * 0.5), expand=True,
                       resample=Image.NEAREST)
    im.alpha_composite(ps, (round(cx - ps.width / 2), round(ptop)))

    d.rectangle([0, round(3 * S), gw, round(7 * S)], fill=PRONG)            # the rail
    d.rectangle([round(cx - 2.5 * S), 0, round(cx + 2.5 * S), round(rod_h)], fill=ROD)
    spread = (ps.width * (0.56 - 0.10 * close))
    for sgn in (-1, 1):
        arm = [(cx, rod_h - 3 * S), (cx + sgn * spread, rod_h + 8 * S),
               (cx + sgn * spread, feet), (cx + sgn * (spread - 11 * S), feet + 7 * S),
               (cx + sgn * (spread - 11 * S), feet + 1 * S),
               (cx + sgn * (spread - 5 * S), feet - 5 * S),
               (cx + sgn * (spread - 5 * S), rod_h + 12 * S), (cx, rod_h + 6 * S)]
        d.polygon(arm, fill=PRONG, outline=(60, 60, 70, 255), width=max(1, round(1.5 * S)))
    d.rectangle([round(cx - 9 * S), round(rod_h - 6 * S),
                 round(cx + 9 * S), round(rod_h + 8 * S)], fill=ROD)        # the carriage
    d.rectangle([round(cx - 9 * S), round(rod_h - 6 * S),
                 round(cx + 9 * S), round(rod_h + 8 * S)],
                outline=(60, 60, 70, 255), width=max(1, round(1.5 * S)))

    # a slow reflection sweeping the glass + the inset highlight
    ov = Image.new('RGBA', (gw, gh), (0, 0, 0, 0))
    ImageDraw.Draw(ov).polygon(
        [(x, y) for x, y in ((0, gh), (44 * S, gh), (44 * S + gh * 0.5, 0), (gh * 0.5, 0))],
        fill=(255, 255, 255, 18))
    im.alpha_composite(ov, (round((sheen % 1.0) * (gw + 300 * S) - 150 * S), 0))
    if lit > 0:
        im.alpha_composite(Image.new('RGBA', (gw, gh), (255, 236, 160, round(46 * lit))))
    d.rectangle([0, 0, gw - 1, gh - 1], outline=(255, 255, 255, 24), width=max(1, round(3 * S)))
    d.rectangle([0, 0, gw - 1, gh - 1], outline=BLACK, width=max(2, round(3 * S)))
    return im


def _card(S, pct, down, close, up, sheen, lit, btn):
    """the whole .bh-card--stall, drawn at S screen px per CSS px"""
    cw, ch = round((CARD_W + 2 * BRD) * S), round(CARD_H * S)
    im = Image.new('RGBA', (cw + round(SHD * S) + 1, ch + round(SHD * S) + 1), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([round(SHD * S), round(SHD * S), cw + round(SHD * S), ch + round(SHD * S)], fill=BLACK)
    d.rectangle([0, 0, cw, ch], fill=BLACK)
    d.rectangle([round(BRD * S), round(BRD * S), cw - round(BRD * S), ch - round(BRD * S)], fill=CARD_BG)

    x0, y = (BRD + PAD_X) * S, (BRD + PAD_Y) * S

    # ---- head: a joystick, a ticket pill, the orange close square ----------
    d.rectangle([x0 + 3 * S, y + 21 * S, x0 + 25 * S, y + 30 * S], fill=(36, 29, 51, 255))
    d.rectangle([x0 + 3 * S, y + 21 * S, x0 + 25 * S, y + 30 * S], outline=BLACK, width=max(1, round(2 * S)))
    d.rectangle([x0 + 12 * S, y + 9 * S, x0 + 16 * S, y + 23 * S], fill=ROD)
    d.ellipse([x0 + 8 * S, y + 1 * S, x0 + 20 * S, y + 13 * S], fill=(255, 93, 143, 255))
    px = x0 + INNER * S - 78 * S
    d.rectangle([px, y + 4 * S, px + 40 * S, y + 26 * S], fill=CARD_BG)
    d.rectangle([px, y + 4 * S, px + 40 * S, y + 26 * S], outline=BLACK, width=max(1, round(2 * S)))
    d.rectangle([px + 8 * S, y + 10 * S, px + 32 * S, y + 20 * S], fill=GOLD)
    d.rectangle([px + 17 * S, y + 13 * S, px + 23 * S, y + 17 * S], fill=CARD_BG)
    qx = x0 + INNER * S - 30 * S
    d.rectangle([qx + 2 * S, y + 2 * S, qx + 32 * S, y + 32 * S], fill=BLACK)
    d.rectangle([qx, y, qx + 30 * S, y + 30 * S], fill=ORANGE)
    d.rectangle([qx, y, qx + 30 * S, y + 30 * S], outline=BLACK, width=max(1, round(3 * S)))

    im.alpha_composite(_glass(S, down, close, up, sheen, lit),
                       (round(x0), round(GLASS_TOP * S)))

    # ---- the ticket bar ----------------------------------------------------
    by = (GLASS_TOP + GLASS_H + GAP1) * S
    d.rectangle([x0, by, x0 + INNER * S, by + BAR_BOX * S], fill=CARD_BG)
    d.rectangle([x0, by, x0 + INNER * S, by + BAR_BOX * S], outline=BLACK, width=max(2, round(3 * S)))
    fillw = (INNER - 6) * S * clamp01(pct)
    if fillw > 1:
        d.rectangle([x0 + 3 * S, by + 3 * S, x0 + 3 * S + fillw, by + (BAR_BOX - 3) * S], fill=GOLD)
        d.rectangle([x0 + 3 * S, by + 3 * S, x0 + 3 * S + fillw, by + 8 * S], fill=(255, 236, 158, 255))

    # ---- the button: dead until the bar is full ----------------------------
    ty = by + (BAR_BOX + GAP2 + BTN_MT) * S
    sh = (4 if btn > 0.5 else 2) * S
    d.rectangle([x0 + sh, ty + sh, x0 + INNER * S + sh, ty + BTN_H * S + sh], fill=BLACK)
    col = (round(58 + 197 * btn), round(44 + 135 * btn), round(38 + 33 * btn), 255)
    d.rectangle([x0, ty, x0 + INNER * S, ty + BTN_H * S], fill=col)
    d.rectangle([x0, ty, x0 + INNER * S, ty + BTN_H * S], outline=BLACK, width=max(2, round(3 * S)))
    if btn > 0.5:
        d.rectangle([x0 + 5 * S, ty + 5 * S, x0 + INNER * S - 5 * S, ty + 12 * S],
                    fill=(255, 216, 145, 255))
    return im


def _bar_pct(t):
    p = 0.08
    for at, to in ((0.300, 0.42), (0.352, 0.73), (0.404, 1.00)):
        u = out_cubic(seg(t, at, at + 0.042))
        p = p + (to - p) * u if u > 0 else p
    return p


def fn(t, i):
    ts = t * SECS
    plate = asset('beach/beach.png')
    panel = 0.212 <= t < 0.852
    payoff = t >= 0.852

    # 🎥 the pier camera — a slow push in; the cut at 0.852 re-frames tight
    if payoff:
        z = in_out(seg(t, 0.852, 1.0))
        cam = Cam(plate, 2620 + math.sin(ts * 1.5) * 3, 668, 208 - 24 * z)
    else:
        push = in_out(seg(t, 0.02, 0.21))
        cam = Cam(plate, 2598 + math.sin(ts * 1.5) * 4, 638 + math.cos(ts * 1.1) * 3,
                  262 - 28 * push)
    hit = max(pulse(t, 0.200, 0.045) * 10, pulse(t, 0.727, 0.05) * 22, pulse(t, 0.860, 0.03) * 12)
    cam.shake_amt = hit * 0.35
    im, k = cam.shot()

    # 🖥 the machine's window, alive
    gx0, gy0 = cam.tf(GLOW[0], GLOW[1])
    gx1, gy1 = cam.tf(GLOW[2], GLOW[3])
    ga = 22 + 12 * math.sin(ts * 7.3) + 9 * math.sin(ts * 19.0)
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(ov).rectangle([gx0, gy0, gx1, gy1], fill=(196, 232, 255, round(max(6, ga))))
    im.alpha_composite(ov)

    # 🚶 the last leg, walked the way the game walks it — then a hard stop
    if payoff:
        # won = WORN: the plush rides in its hand (its bbox sits right, so nudge)
        hop = -abs(math.sin((t - 0.852) * 42)) * 10 * (1 - seg(t, 0.852, 0.95))
        world_banana(im, cam, i, {'extras': ['plushbanana']}, STAND[0] + 12, STAND[1], lift=hop)
    else:
        wx, wy, moving = Walk([(2498, 764), STAND], pause=0.6, start_pause=0.06).at(ts)
        world_banana(im, cam, i, {}, wx, wy, lift=-abs(math.sin(i * 0.5)) * 3 if moving else 0)

    mx, my = cam.tf((MACH[0] + MACH[2]) / 2, (MACH[1] + MACH[3]) / 2)
    impact_ring(im, mx, my, seg(t, 0.196, 0.26), r1=210, col=(255, 233, 150))

    # 🎛 THE PANEL — inset:0 over the stage, backdrop dimmed like the game
    if panel:
        im.alpha_composite(Image.new('RGBA', im.size,
                                     (0, 0, 0, round(152 * out_cubic(seg(t, 0.212, 0.30))))))
        pop = 0.80 + 0.20 * out_back(seg(t, 0.212, 0.30))
        dive = in_out(seg(t, 0.478, 0.592))                 # ⤵ INTO the glass
        S = (1.14 + 0.08 * in_out(seg(t, 0.30, 0.45)) + 3.10 * dive) * pop

        card = _card(S, _bar_pct(t),
                     in_out(seg(t, 0.560, 0.700)),          # the claw rides down
                     out_cubic(seg(t, 0.700, 0.727)),       # the prongs close
                     out_cubic(seg(t, 0.729, 0.845)),       # and lift
                     ts * 0.20, pulse(t, 0.727, 0.030), seg(t, 0.428, 0.468))

        # the glass rides to the frame's centre line as the camera dives in
        gy = H * 0.5 - (GLASS_MID - CARD_H / 2) * S * (1 - dive) - 42 * dive
        top = gy - GLASS_MID * S
        im.alpha_composite(card, (round(W / 2 - card.width / 2), round(top)))

        cgy = top + (GLASS_TOP + GLASS_H * 0.44) * S
        impact_ring(im, W / 2, cgy, seg(t, 0.727, 0.84), r0=150, r1=470, width=12,
                    col=(255, 233, 150))
        sparkle_burst(im, W / 2, cgy, seg(t, 0.731, 0.850), n=22, dist=290, seed=7)
        flash(im, max(pulse(t, 0.727, 0.016) * 0.50, pulse(t, 0.452, 0.018) * 0.20))
        if t > 0.745:
            confetti(im, (t - 0.745) / 0.25, n=30)
    elif payoff:
        px, py = cam.tf(STAND[0] + 30, STAND[1] - BAN_H * 0.52)
        sparkle_burst(im, px, py, seg(t, 0.856, 0.99), n=22, dist=250, seed=3)
        impact_ring(im, px, py + BAN_H * 0.5 * k, seg(t, 0.856, 0.93), r0=34, r1=340,
                    col=(255, 233, 150))
        confetti(im, 0.28 + seg(t, 0.852, 1.0) * 0.72, n=30)

    vignette(im, 62)
    im = zoom_punch(im, hit / 22)
    im = shake_img(im, hit)
    im = chroma_split(im, pulse(t, 0.727, 0.020) * 7)
    im = flicker(im, ts, hz=8.5, depth=0.055 if panel else 0.02)
    im.putalpha(255)
    # the two hard cuts (world → panel → world) and a blink into the clip
    im = blink_fade(im, max(0.88 * (1 - seg(t, 0.0, 0.035)),
                            pulse(t, 0.212, 0.012), pulse(t, 0.852, 0.011)))
    return im


SCENE = {'name': 'grabber', 'secs': SECS, 'fn': fn}
