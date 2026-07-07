# Rave audio spec — what Sentry produces, and why the math is strict

*The club's trick: everything is wall-clock synced. The music will be too —
a radio station that has always been playing, not a play button. The client
starts playback at `(clock mod 180s)` into the file, so the musical drop
lands on the visual strobe by arithmetic alone.*

## The clock the music must fit

| Moment | When | Length |
| --- | --- | --- |
| THE DROP (strobe, pyro, double-time dance) | second 0 of every 3rd minute | 10s |
| The groove (normal floor) | the other 170s | — |
| JELLY TIME (personal, any moment) | player-triggered | ~8s overlay |

## ⭐ CURRENT PLAN (Sentry, 7 Jul): TWO files

The client is a wall-clock DJ scheduling these sample-accurately (with
~10ms crossfades at file joints). Both 150 BPM, same key, WAV 44.1k/24-bit:

| File | Content | Length (hard) |
| --- | --- | --- |
| `loop.wav` | the melodic club groove, seamless into itself | **32 bars = 51.2s** (16/24/48/96 also legal — must divide 96 bars) |
| `drop.wav` | 0.8s HOLD (near-silence; a shouted vocal fits, barely) + the 16-bar drop; final bar resolves into loop bar 1 | **26.4s exactly** (0.8 + 25.6) |

Window math (why 16 bars is load-bearing): drop 16 bars leaves 180 − 26.4
= 153.6s = 96 bars of groove — divisible by lots of loop lengths. Any
other drop length breaks the tiling. Schedule per 180s window: drop.wav
starts 0.8s BEFORE second 0 (impact = strobe), ends 25.6s in; loop.wav
plays 3× (at 32 bars) to 179.2s; the next drop.wav's hold covers the last
0.8s. Total: 180.000s.

**JELLY TIME reuses drop.wav**: the client plays its first 8.0s (hold +
impact = exactly 5 bars) as the personal ducked overlay — matching the
visuals, which already reuse the drop strobe for the personal mini-drop.
So if a vocal lives in the hold, jelly time gets it too. No separate file.

**No intro file**: tapping sound-on fades you into the live set mid-groove
— the music was playing before you arrived (the lore and the sync model
agree). An intro airlock can be added later without touching anything.

---

## (Superseded) File 1 — the single chapter loop — 150 BPM

150 BPM is the magic tempo: the banana's sacred 0.8s bob = exactly 2 beats,
so the floor is genuinely beat-locked to the kick.

- **Exactly 180.000 seconds.** At 44.1kHz = **7,938,000 samples**, not one
  more. Any excess drifts the drop against the strobe a little every cycle.
- 180s at 150 BPM = 450 beats = **112.5 bars** — the half bar is THE HOLD:

  | Section | Bars | Seconds |
  | --- | --- | --- |
  | THE DROP (strobe covers the first 10s) | 16 | 25.6 |
  | The groove (split however you like) | 88 | 140.8 |
  | The build / riser | 8 | 12.8 |
  | THE HOLD — 2 beats of near-silence | 0.5 | 0.8 |
  | **Total** | **112.5** | **180.000** |

  (Proportions are a SUGGESTION — normal club shape: short build, longer
  drop. The strobe is only the first 10s of the visual window, so a 16-bar
  drop keeps banging after the lights calm — reads fine; an 8-bar drop
  peaks tighter with the visuals. Producer's call.)

  **The drop does NOT have to be at the start of the file.** Sentry's
  preferred arrangement — club loop first, vocal, drop at the END, looping
  seamlessly back into the club section — works identically: the client
  plays with a phase offset. The rules then are just:
  1. total = exactly 180.000s,
  2. the file loops seamlessly end → start,
  3. **report the exact bar/second where the drop impact hits** — that
     becomes the client's alignment constant (drop impact = strobe start).
  The pre-drop hold relocates with it: silence, the vocal, impact.

  **⚠️ The drop vocal**: never sample the Buckwheat Boyz recording or sing
  their melodic hook (the hard rule). A freshly recorded SPOKEN phrase is
  a grey zone for the full "peanut butter jelly time" (it's their song
  title); **"IT'S JELLY TIME!" is 100% ours and matches the club's whole
  vocabulary** (the meter, the button). The jelly-time stinger is the
  natural home for that shout — the player presses a button that says
  JELLY TIME and the club yells it back.

  The file ENDS on the 2-beat hold; the loop lands on bar 1 = the drop on
  the strobe. 0.8s = exactly one banana dance cycle: the whole planet does
  one silent bob in the dark, then the drop hits. That's the signature.
- Only the total (180.000s), bar 1 = drop, and ending-on-the-hold are
  fixed — everything between is the producer's business. Keep sections to
  whole bars (the strobe's 10.0s = 6.25 bars is NOT a musical boundary —
  don't chase it).
- **Loop-clean edges**: no reverb/delay tail past the last sample — the
  hold wants to be NEARLY silent anyway; bake any tail into the file start.
- The dance visually double-times during the drop (0.8s → 0.48s cycle) —
  no tempo change needed; that's what drops feel like.
- Deliver **WAV, 44.1kHz, 24-bit stereo**. Claude handles encoding; looping
  is done sample-exact in WebAudio so codec padding never causes gaps.
- Master ~**−14 LUFS**, no brickwall — headroom is needed for ducking.

## File 2 — the jelly-time stinger (`jellytime.wav`)

- **Exactly 5 bars = 8.000s at 150 BPM** — a perfect match for the 8s
  jelly-time mini-drop visual. Same key as the chapter (it overlays the
  groove at ANY bar, so it must stack harmonically).
- Shape: riser → impact → short sub hit → clean out (a short tail is fine;
  it plays on its own layer).
- The client ducks the main loop ~6dB under it, then releases.

## Later (optional, same spec)

- **More chapters**: each exactly 180.000s, 150 BPM, same key family. The
  clock's window number picks the chapter deterministically — everyone on
  Earth still hears the same thing, but the set rotates.
- **Stems** (drums / bass / music) would enable adaptive intensity —
  not needed for v1.

## The AI workflow (Suno → DAW)

Sentry generates the raw material in Suno, then enforces this spec in the
DAW (exact 180.000s cut, seamless loop edge, the hold, the stinger bounce).

- ⚠️ **Don't prompt Suno with "peanut butter jelly time"** — the Buckwheat
  Boyz song is in its training data and it may regurgitate their actual
  hook/cadence dressed as "original". Prompt **"it's jelly time!"** (the
  club's canon line). If the full phrase is ever tried anyway: A/B the
  output against the real song before keeping it.
- **Paid Suno plan only** — free-tier outputs are non-commercial and the
  site sells stickers. Pro/Premier grants commercial rights.
- Generate at/around 150 BPM (Suno's tempo control is loose — time-stretch
  in the DAW if needed).
- Raw AI output isn't copyrightable; the DAW processing/arrangement is what
  makes the master Sentry's own.

## Rules that already exist

- All music = original Sentry productions. The Buckwheat Boyz' PBJT song is
  NEVER bundled (standing legal rule).
- Sound starts muted behind a toggle (browsers require a user gesture) —
  the "put your headphones on" moment. Preference remembered per device.

## Handover

Drop the WAVs anywhere in the repo (e.g. `tools/audio-masters/`, they won't
ship raw) and ask Claude to "wire the rave audio" — the client work is:
audio toggle, WebAudio clock-offset start, drift correction, jelly-time
duck/overlay, mute-by-default.
