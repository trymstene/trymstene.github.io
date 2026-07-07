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

## File 1 — the chapter loop (`chapter-01.wav`) — 150 BPM (Sentry's pick)

150 BPM is the magic tempo: the banana's sacred 0.8s bob = exactly 2 beats,
so the floor is genuinely beat-locked to the kick.

- **Exactly 180.000 seconds.** At 44.1kHz = **7,938,000 samples**, not one
  more. Any excess drifts the drop against the strobe a little every cycle.
- 180s at 150 BPM = 450 beats = **112.5 bars** — the half bar is THE HOLD:

  | Section | Bars | Seconds |
  | --- | --- | --- |
  | THE DROP (strobe covers the first 10s) | 8 | 12.8 |
  | The groove (split however you like) | 88 | 140.8 |
  | The build / riser | 16 | 25.6 |
  | THE HOLD — 2 beats of near-silence | 0.5 | 0.8 |
  | **Total** | **112.5** | **180.000** |

  The file ENDS on the 2-beat hold; the loop lands on bar 1 = the drop on
  the strobe. 0.8s = exactly one banana dance cycle: the whole planet does
  one silent bob in the dark, then the drop hits. That's the signature.
- Only the total (180.000s) and the ending-on-the-hold are fixed — the
  groove/build split is the producer's business. Musical drop section =
  whole bars (8 recommended; the strobe is 10.0s = 6.25 bars, so the music
  drop outlasting it by 2.8s reads as natural decay).
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
