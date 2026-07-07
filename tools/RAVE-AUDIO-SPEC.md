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

## File 1 — the chapter loop (`chapter-01.wav`)

- **Exactly 180.000 seconds.** At 44.1kHz = **7,938,000 samples**, not one
  more. Any excess drifts the drop against the strobe a little every cycle.
- **120 BPM (90 bars) or 128 BPM (96 bars)** — both divide 180s into whole
  bars. Pick by vibe; stick to it for all future chapters.
- **Arrangement: drop FIRST.** Bars 1–8-ish = the banger (the strobe covers
  the first 10s). Then groove/verse — moving but breathable (most visitors
  hear this part). Last ~8 bars = the riser that resolves into bar 1 when
  the file loops. The end is the build-up to its own beginning.
- **Loop-clean edges**: no reverb/delay tail past the last sample. Cut dry
  into the loop point (the drop impact masks it) or bake the tail into the
  file's start.
- The dance visually double-times during the drop (0.8s → 0.48s cycle) —
  no tempo change needed; that's what drops feel like.
- Deliver **WAV, 44.1kHz, 24-bit stereo**. Claude handles encoding; looping
  is done sample-exact in WebAudio so codec padding never causes gaps.
- Master ~**−14 LUFS**, no brickwall — headroom is needed for ducking.

## File 2 — the jelly-time stinger (`jellytime.wav`)

- ~4 bars (8.0s at 120 / 7.5s at 128), **same key as the chapter** — it
  overlays the groove at ANY bar, so it must stack harmonically.
- Shape: riser → impact → short sub hit → clean out (a short tail is fine;
  it plays on its own layer).
- The client ducks the main loop ~6dB under it, then releases.

## Later (optional, same spec)

- **More chapters**: each exactly 180.000s, same BPM + key family. The
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
