#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bgm_slack_water - the becalmed office of the Lull: everything waits, nothing arrives.

A minor, 80 bpm, 5/4, 20 bars (75.0 s).  A woodblock ticks all five beats of every bar and never
varies; pizzicato strings walk in a prim 3+2; the acoustic grand states a punctual little tune in A
and then, in B, plays the same kind of phrase a whole beat late in every single bar, so the melody
is permanently one step behind its own accompaniment.  The vibraphone carries "Are You Awake"
(C E F E C A B in A minor) with every note placed a beat behind the bar it belongs to, and stops on
B, the second degree - still no answer.

Form: A 8 / B 8 (the late piano, bVII G6) / A' 4 (thinned return, E7sus4 hanging into the loop).

Render:  python3 tools/music/render.py tools/music/tracks/bgm_slack_water.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from midilib import Pattern, Song, bass_note, voice_led  # noqa: E402

META = {
    "id": "bgm_slack_water",
    "loop": True,
    "lofi": 0.4,
    "space": 0.35,
    "noise": 0.35,
    "crackle": 0.1,
    "gain_db": 0.0,
    "tail_beats": 10,
    "key": "A minor",
    "lead": "vibes",
    "volume": 0.75,
}

CHORDS = [
    # A 0-7
    "Amadd9", "Amadd9", "Dm9", "Dm9", "Fmaj7", "Cmaj7/E", "Dm7/G", "E7sus4",
    # B 8-15   the piano is late through all of this
    "Fmaj7", "Bm7b5", "E7sus4", "Am7", "Dm7", "G6", "Cmaj7", "E7sus4",
    # A' 16-19
    "Amadd9", "Dm9", "Fmaj7", "E7sus4",
]

# piano, section A: on the beat, tidy, question and answer
PNO_A = [
    "A4:1 C5:1 E5:2 D5:1",
    "C5:2 B4:1 A4:2",
    "D5:1 F5:1 A5:2 G5:1",
    "F5:2 E5:1 D5:2",
    "r:5", "r:5",                       # the vibraphone has the motif in bars 4-5
    "G4:1 B4:1 D5:2 C5:1",
    "B4:2 A4:1 B4:2",
]
# piano, section B: every bar opens with a hole and the line arrives one beat late
PNO_B = [
    "r:1 A4:1 C5:1 F5:2",
    "r:1 D5:1 F5:1 B4:2",
    "r:1 E5:1 D5:1 B4:2",
    "r:1 C5:1 B4:1 A4:2",
    "r:1 D5:1 F5:1 A5:2",
    "r:1 B4:1 D5:1 G5:2",
    "r:1 E5:1 G5:1 C6:2",               # the one high point of the piece, and it is late too
    "r:1 D5:1 C5:1 B4:2",
]
PNO_A2 = ["r:5", "r:5", "F5:2 E5:1 D5:2", "B4:2 A4:1 B4:1 E4:1"]

# "Are You Awake" in A minor, each note pushed a beat behind the bar line
MOTIF_LATE = Pattern("r:1 C4:1 E4:1 F4:1.5 E4:.5 | C4:1 A4:1 B3:3")
MOTIF_HEAD = Pattern("r:2 C4:1 E4:1 F4:1 | r:5")


def build():
    song = Song(bpm=80, time_sig=(5, 4), seed=20260921, title="bgm_slack_water")
    song.set_loop_bars(20)
    for name, bar in (("A", 0), ("B", 8), ("A'", 16)):
        song.marker(name, song.bar(bar))

    vibes = song.track("vibes", "vibraphone", volume=120, pan=0.2, reverb=86, vel=64)
    pno = song.track("piano", "acoustic_grand_piano", volume=98, pan=-0.16, reverb=64, vel=58)
    pizz = song.track("pizz", "pizzicato_strings", volume=86, pan=0.26, reverb=30, vel=64)
    clock = song.drums("clock", kit="standard", volume=80, pan=-0.3, reverb=26, vel=44)

    # ---- the clock: five ticks a bar, hi on 1, lo on the rest, forever ------------------------
    for i in range(20):
        b = song.bar(i)
        for k in range(5):
            clock.hit("woodblock_hi" if k == 0 else "woodblock_lo", b + k,
                      vel=46 if k == 0 else (38 if k % 2 else 34))

    # ---- pizzicato: a prim 3 + 2, a dominant pedal at the top of B ------------------------------
    for i, sym in enumerate(CHORDS):
        b = song.bar(i)
        root = bass_note(sym, 2)
        nxt = bass_note(CHORDS[(i + 1) % len(CHORDS)], 2)
        if 8 <= i < 12:                          # B opens over a still E pedal
            pizz.note(40, b, 2.0, vel=62)
            pizz.note(40, b + 3, 1.6, vel=54)
            if i == 11:
                pizz.note(root, b + 4, 0.9, vel=58)
        else:
            pizz.note(root, b, 2.0, vel=66)
            pizz.note(root + 7, b + 2, 2.0, vel=56)
            step = 1 if nxt > root else -1
            pizz.note(nxt - step if abs(nxt - root) > 2 else root + 12, b + 4, 0.9, vel=58)

    # ---- piano: tidy in A, a beat late all through B ---------------------------------------------
    voicings = voice_led(CHORDS, lo="C3", hi="A4")
    for i, v in enumerate(voicings):
        b = song.bar(i)
        if 8 <= i < 16:                          # B: one dry chord per bar, on the downbeat, alone
            pno.chord(v, b, 2.4, vel=48, roll_ms=0)
        elif i >= 16:
            pno.chord(v, b, 2.8, vel=46, roll_ms=26)
            pno.chord(v, b + 3, 1.8, vel=42, roll_ms=26)
        else:
            pno.chord(v, b, 2.6, vel=52, roll_ms=18, top_accent=4)
            pno.chord(v, b + 3, 1.8, vel=46, roll_ms=18)
    t = 0.0
    for src in PNO_A:
        t = pno.play(src, at=t, vel=58, gate=0.92)
    assert t == song.bar(8)
    for k, src in enumerate(PNO_B):
        t = pno.play(src, at=t, vel=56 + k, gate=0.95, ring=0.2)
    assert t == song.bar(16)
    for src in PNO_A2:
        t = pno.play(src, at=t, vel=52, gate=0.9)
    assert t == song.loop_length_beats
    pno.pedal_every(0, song.loop_length_beats, every=5.0, lift=0.14)
    pno.crescendo(song.bar(13), song.bar(15), 0.98, 1.1)
    pno.diminuendo(song.bar(18), song.bar(20), 1.0, 0.88)

    # ---- vibraphone: the motif, always a beat behind ---------------------------------------------
    vibes.play(MOTIF_LATE, at=song.bar(4), vel=66, ring=1.4)
    vibes.play(MOTIF_HEAD, at=song.bar(12), vel=58, ring=1.6)
    vibes.play(MOTIF_HEAD.transpose(3), at=song.bar(14), vel=54, ring=1.6)
    vibes.play(MOTIF_LATE, at=song.bar(16), vel=62, ring=1.8)
    # one lonely chime answering itself at the top of B
    vibes.note("A4", song.bar(9) + 3.0, 2.0, vel=50)
    vibes.note("B3", song.bar(10) + 4.0, 2.0, vel=46)
    # the dominant left ringing on the last beat, so the loop does not restart from nothing
    vibes.note("E4", song.bar(19) + 4.0, 2.4, vel=56)

    song.humanize(timing_ms=8, velocity=5, drums_timing_ms=0)
    return song


if __name__ == "__main__":
    s = build()
    print(s.summary())
    for w in s.lint():
        print("lint:", w)
