#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bgm_blare_reef - the reef that plays its own brass band so nobody has to talk.

Bb major, 132 bpm, 4/4, 33 bars (60.0 s).  Tuba oom, reed-organ pah, a shouting brass tune and
trombones that keep the "Are You Awake" motif at double speed and fifteen cents flat.
Form: A 8 (oom-pah) / A' 8 (borrowed Ebm6, snare thickens, trombone counter-slide) / B 8 (shouting:
bVII Ab, brass stabs, the trombones' detuned motif in bars 20-21) / A'' 8 (tutti, bVI Gb swerve) /
one bar of sudden silence - broken only by a snare pickup on the last beat that shoves the loop
back to bar 1.

Render:  python3 tools/music/render.py tools/music/tracks/bgm_blare_reef.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from midilib import Pattern, Song, bass_note, voice_led  # noqa: E402

META = {
    "id": "bgm_blare_reef",
    "loop": True,
    "lofi": 0.25,
    "space": 0.16,
    "noise": 0.2,
    "gain_db": 0.0,
    "tail_beats": 8,
    "key": "Bb major",
    "lead": "brass",
    "volume": 0.78,
}

SILENT_BAR = 32
CHORDS = [
    # A 0-7
    "Bb6", "Gm7", "Eb6", "F7", "Bb/D", "Ebmaj7", "Cm7", "F7",
    # A' 8-15   (Ebm6 = borrowed iv)
    "Bb6", "Gm7", "Ebm6", "F7", "Dm7", "Gm7", "Cm7", "F7",
    # B 16-23   (Ab6 = bVII, the shout)
    "Ebmaj7", "Ebmaj7", "Ab6", "Ab6", "Cm7", "F7", "Bb6", "F7",
    # A'' 24-31 (Gb6 = bVI swerve)
    "Bb6", "Gm7", "Eb6", "F7", "Bb/D", "Gb6", "F7sus4", "F7",
    # 32: nobody plays
    "F7",
]

TUNE_A = [
    "F5:.75 F5:.25 Bb5:1 Bb5:.75 A5:.25 G5:1",
    "G5:1.5 F5:.5 D5:2",
    "Eb5:.75 Eb5:.25 G5:1 Bb5:1 G5:1",
    "A5:1.5 C6:.5 A5:2",
    "D5:.75 F5:.25 A5:1 D6:1.5 C6:.5",
    "Bb5:1 G5:1 D5:2",
    "Eb5:.75 Eb5:.25 G5:1 C6:1 Bb5:1",
    "A5:1.5 F5:.5 F5:1 r:1",
]
TUNE_A2 = TUNE_A[:2] + [
    "Eb5:.75 Eb5:.25 Gb5:1 Bb5:1 Gb5:1",      # the borrowed iv turns the tune flat
    "A5:1.5 C6:.5 Bb5:1 A5:1",
    "D6:1 C6:1 A5:1 F5:1",
    "G5:.75 A5:.25 Bb5:1 D6:2",
    "C6:1 Bb5:.5 G5:.5 Eb5:1 G5:1",
    "F5:1 A5:1 C6:2!",
]
TUNE_B = [
    "Bb5:.5! r:.5 Bb5:.5! r:.5 C6:2!",
    "Bb5:.5! r:.5 Bb5:.5! r:.5 D6:2!",
    "Ab5:.5! r:.5 Ab5:.5! r:.5 C6:1.5 Bb5:.5",
    "Ab5:1 G5:1 F5:2",
    "r:4", "r:4",                              # the trombones take the motif here
    "G5:.5! Bb5:.5 D6:1 C6:1 Bb5:1",
    "C6:2! A5:1 F5:1",
]
TUNE_A3 = TUNE_A[:4] + [
    "D6:1 Bb5:1 G5:1 Bb5:1",
    "Db6:1.5 Bb5:.5 Gb5:2",
    "C6:1 Bb5:1 A5:1 G5:1",
    "F5:.75 A5:.25 C6:1 D6:2!",
]

# "Are You Awake" in Bb - D F G F D Bb C - every value halved, so it fits in a single bar
MOTIF_FAST = Pattern("D5:.5 F5:.5 G5:.75 F5:.25 D5:.5 Bb5:.5 C5:1")


def build():
    song = Song(bpm=132, time_sig=(4, 4), seed=20260921, title="bgm_blare_reef")
    song.set_loop_bars(33)
    for name, bar in (("A", 0), ("A'", 8), ("B", 16), ("A''", 24), ("silence", 32)):
        song.marker(name, song.bar(bar))

    brass = song.track("brass", "brass_section", volume=104, pan=0.08, reverb=48, vel=76)
    bone = song.track("bone", "trombone", volume=98, pan=-0.3, reverb=42, vel=72)
    organ = song.track("organ", "reed_organ", volume=93, pan=0.3, reverb=52, vel=62)
    tuba = song.track("tuba", "tuba", volume=100, pan=-0.05, reverb=20, vel=78)
    snr = song.drums("snare", kit="standard", volume=88, pan=0.05, reverb=38, vel=72)

    # ---- tuba: the oom (and, in B, four flat-footed quarters) ---------------------------------
    for i, sym in enumerate(CHORDS):
        if i == SILENT_BAR:
            break
        b = song.bar(i)
        root = bass_note(sym, 2)
        fifth = root + 7 if root + 7 <= 55 else root - 5
        nxt = bass_note(CHORDS[(i + 1) % len(CHORDS)], 2)
        if 16 <= i < 24:                         # B: no oom-pah, just weight on every beat
            for k in range(4):
                tuba.note(root if k % 2 == 0 else fifth, b + k, 0.85, vel=80 if k % 2 == 0 else 70)
        else:
            tuba.note(root, b, 0.9, vel=82)
            tuba.note(fifth, b + 2, 0.9, vel=72)
            if i in (7, 15, 23, 27, 31):         # a walking pickup into the next phrase
                step = 1 if nxt > root else -1
                tuba.note(nxt - step, b + 3, 0.5, vel=70)
                tuba.note(nxt - 12 if abs(nxt - root) > 6 else root, b + 3.5, 0.45, vel=66)
        if 24 <= i < 32:                         # A'': a little push on the and-of-4
            tuba.note(root, b + 3.5, 0.4, vel=64)

    # ---- reed organ: the pah ------------------------------------------------------------------
    voicings = voice_led(CHORDS[:SILENT_BAR], lo="C3", hi="A4")
    for i, v in enumerate(voicings):
        b = song.bar(i)
        if 16 <= i < 24:                         # B: offbeat eighths, hissing between the shouts
            for k in (0.5, 1.5, 2.5, 3.5):
                organ.chord(v, b + k, 0.4, vel=58 if k in (1.5, 3.5) else 52)
        elif 24 <= i < 32:                       # A'': held, so the tutti has a floor
            organ.chord(v, b + 1, 1.2, vel=62)
            organ.chord(v, b + 3, 1.2, vel=60)
        else:
            organ.chord(v, b + 1, 0.85, vel=60)
            organ.chord(v, b + 3, 0.85, vel=56)

    # ---- brass section: the tune ---------------------------------------------------------------
    t = 0.0
    for k, bar_src in enumerate(TUNE_A + TUNE_A2 + TUNE_B + TUNE_A3):
        vel = 74 if k < 8 else (78 if k < 16 else (84 if k < 24 else 82))
        t = brass.play(bar_src, at=t, vel=vel, gate=0.88 if k < 16 else 0.8)
    assert t == song.bar(32), t
    brass.crescendo(song.bar(14), song.bar(16), 0.95, 1.1)
    brass.crescendo(song.bar(30), song.bar(32), 1.0, 1.08)

    # ---- trombones: counter-slide in A', the motif twice in B, flat by 15 cents ------------------
    bone.bend_range(2)
    bone.play("Bb3:1.5 D4:.5 F4:2 | Eb4:2 D4:2", at=song.bar(10), vel=66, gate=0.9)
    bone.play("G3:2 Bb3:1 D4:1 | C4:2 F3:2", at=song.bar(13), vel=64, gate=0.9)
    bone.bend(song.bar(16) - 0.05, -0.15)        # 15 cents flat for the whole shouting section
    bone.play("Bb3:1! r:1 Bb3:1! r:1", at=song.bar(16), vel=72)
    bone.play("Ab3:1! r:1 Ab3:1! r:1", at=song.bar(18), vel=72)
    bone.play(MOTIF_FAST, at=song.bar(20), vel=78, gate=0.9, transpose=-12)
    bone.play(MOTIF_FAST, at=song.bar(21), vel=74, gate=0.9, transpose=-24)
    bone.play("D4:2 C4:2 | Bb3:2 A3:2", at=song.bar(22), vel=70, gate=0.95)
    bone.bend_ramp(song.bar(24) - 1.0, song.bar(24), -0.15, 0.0)
    bone.play("Bb3:2 D4:2 | Eb4:2 F4:2 | Bb3:2 Db4:2 | C4:2 F3:2",
              at=song.bar(28), vel=70, gate=0.92)

    # ---- marching snare --------------------------------------------------------------------------
    march = {"snare": ("x..x..x.x..x..x.", 92), "kick": ("x.......x.......", 76)}
    snr.grid(march, start=song.bar(0), repeats=8)
    snr.grid({"snare": ("x.oxo.x.x.oxo.ox", 96), "kick": ("x.....x.x.......", 76)},
             start=song.bar(8), repeats=8)
    snr.grid({"snare": ("Xooooooo" "Xooooooo", 104), "kick": ("x...x...x...x...", 80)},
             start=song.bar(16), repeats=8)
    snr.grid({"snare": ("X..x..x.X..x.oxo", 100), "kick": ("x...x...x...x...", 78),
              "tambourine": ("..x...x...x...x.", 52)}, start=song.bar(24), repeats=8)
    for bar in (0, 8, 16, 24):
        snr.hit("crash", song.bar(bar), vel=84 if bar else 76)
    snr.hit("crash2", song.bar(31) + 3.0, vel=88)
    # the silent bar: three beats of nothing, then four rising sixteenths that shove the loop round
    for k, v in enumerate((54, 64, 74, 88)):
        snr.hit("snare", song.bar(SILENT_BAR) + 3.0 + 0.25 * k, vel=v)

    song.humanize(timing_ms=6, velocity=7, drums_timing_ms=3)
    return song


if __name__ == "__main__":
    s = build()
    print(s.summary())
    for w in s.lint():
        print("lint:", w)
