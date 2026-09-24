#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bgm_dear_tam - Ending A and credits.  Release; plain, warm.  ONE-SHOT, ends properly.

C major, 84 bpm, 38 bars (about 1:55 with the ritardandi).  The only piece where "Are You Awake" gets its
eighth note.
  bars 1-8    piano alone: the seven notes (ending on D), a sequence of them on A (ending on G), a closing
              phrase that sinks to D again.  Three questions.
  bars 9-16   strings enter, piano an octave higher over a rocking left hand: motif, sequence on F, sequence
              on A up to F6 (the high point), then a long D held over G7sus4-G with a ritardando.
  bars 17-20  the harbour_row band (nylon guitar, upright bass, brushes) and the whistle: ALL EIGHT NOTES.
              Am7-Fmaj7-C/E-G6 and the whistle steps down from D to C on a plain C chord; glockenspiel answers
              with one C.
  bars 21-30  the eight notes as a round: whistle (bars 21, 25), glockenspiel two bars behind (bars 23, 27),
              over a two-bar cycle C-F | C/E-G, so that every landing on C meets a plain C chord.
  bars 31-34  tutti: whistle, violins and piano octaves state the eight notes once more.
  bars 35-38  coda, piano and quiet strings: "C-D" asked one last time, a breath, and the low C.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import midilib  # noqa: E402
from midilib import Pattern, Song, fretted  # noqa: E402

META = {
    "id": "bgm_dear_tam",
    "loop": False,
    "lofi": 0.4,
    "crackle": 0.08,
    "space": 0.25,
    "gain_db": 0.0,
    "tail_beats": 8,
    "key": "C major",
    "lead": "whistle",
}

BARS = 38
SEVEN = "E5:1 G5:1 A5:1.5 G5:.5 | E5:1 C6:1 D5:2"
EIGHT = Pattern(SEVEN + " | C5:4")                      # the answer

CHORDS = (
    ["Am7", "Fmaj7", "C/E", "G6", "G6", "G6", "Fmaj7", "Dm7", "F/A", "G", "Am7", "Fmaj7", "C/E", "G6", "G6", "Gsus4"] +
    ["Am7", "Fmaj7", "C/E", "G6", "Dm7", "G", "F6", "Am7", "Fmaj7", "Dm7", "F/A", "G", "C/E", "Fadd9", "G7sus4", "G"] +
    ["Am7", "Fmaj7", "C/E", "G6", "C", "C", "C", "C"] +
    ["C", "F", "C/E", "G"] * 4 + ["C", "C", "C", "G/B"] +
    ["Am7", "Fmaj7", "C/E", "G7sus4", "C", "C", "C", "C"] +
    ["C/E", "G6", "G6", "G6", "C", "C", "C", "C"]
)
assert len(CHORDS) == BARS * 2

# open three-note voicings: piano left hand / strings
LV = {"Am7": ["A2", "E3", "G3"], "Fmaj7": ["F2", "C3", "E3"], "C/E": ["E2", "C3", "G3"], "G6": ["G2", "D3", "E3"],
      "Dm7": ["D2", "C3", "F3"], "F/A": ["A2", "F3", "C4"], "G": ["G2", "D3", "B3"], "Gsus4": ["G2", "D3", "C4"],
      "F6": ["F2", "C3", "A3"], "Fadd9": ["F2", "C3", "G3"], "G7sus4": ["G2", "F3", "C4"], "C": ["C2", "G2", "E3"],
      "F": ["F2", "C3", "A3"], "G/B": ["B2", "G3", "D4"]}
SV = {"Am7": ["A3", "E4", "G4"], "Fmaj7": ["F3", "C4", "E4"], "C/E": ["G3", "C4", "E4"], "G6": ["G3", "D4", "E4"],
      "Dm7": ["F3", "A3", "D4"], "F/A": ["A3", "C4", "F4"], "G": ["G3", "B3", "D4"], "Gsus4": ["G3", "C4", "D4"],
      "F6": ["F3", "A3", "D4"], "Fadd9": ["F3", "G3", "C4"], "G7sus4": ["G3", "C4", "F4"], "C": ["G3", "C4", "E4"],
      "F": ["A3", "C4", "F4"], "G/B": ["G3", "B3", "D4"]}

BASS = (
    "A2:2 F2:2 | E2:2 G2:1 B2:1 | C3:3 G2:1 | C2:2 E2:1 G2:1 | "                       # 17-20
    "C2:2 F2:2 | E2:2 G2:1 B2:1 | C3:1.5 G2:.5 F2:1.5 A2:.5 | E2:1.5 E2:.5 G2:1 G2:1 | "
    "C2:2 F2:2 | E2:2 G2:1 B2:1 | C3:1.5 G2:.5 F2:1.5 A2:.5 | E2:1.5 E2:.5 G2:1 G2:1 | "
    "C2:2 G2:1 C3:1 | C3:2 B2:2 | "                                                      # 29-30
    "A2:2 F2:2 | E2:2 G2:1 G2:1 | C2:3 G2:1 | C3:2 C2:2"                                 # 31-34
)


def build():
    song = Song(bpm=84, time_sig=(4, 4), seed=8408, title="bgm_dear_tam")
    song.set_loop_bars(BARS)
    for name, b in (("piano", 0), ("strings", 8), ("band: eight notes", 16), ("round", 20), ("tutti", 30),
                    ("coda", 34)):
        song.marker(name, song.bar(b))
    B = song.bar

    pno = song.track("piano", "piano", volume=106, pan=-0.12, reverb=66, vel=68)
    strs = song.track("strings", "strings", volume=100, pan=0.1, reverb=92, vel=56)
    vln = song.track("violins", "strings", volume=86, pan=-0.2, reverb=92, vel=66)
    gtr = song.track("guitar", "nylon_guitar", volume=80, pan=-0.32, reverb=55, vel=58)
    bass = song.track("bass", "acoustic_bass", volume=92, pan=-0.04, reverb=18, vel=78)
    whi = song.track("whistle", "whistle", volume=74, pan=0.14, reverb=84, vel=78)
    glock = song.track("glock", "glockenspiel", volume=116, pan=0.34, reverb=86, vel=66)
    drums = song.drums("brushes", kit="brush", volume=106, reverb=42, vel=78)

    # ---- piano right hand -----------------------------------------------------------------------------
    seven_low = Pattern(SEVEN).transpose(-12)
    pno.play(seven_low, at=B(0), vel=70)
    pno.play("A4:1 C5:1 D5:1.5 C5:.5 | A4:1 F5:1 G4:2", at=B(3), vel=72)
    pno.play("C5:1 B4:1 A4:1.5 G4:.5 | E4:1 G4:1 D4:2", at=B(5), vel=68)
    pno.play(SEVEN, at=B(8), vel=76)
    pno.play("F5:1 A5:1 B5:1.5 A5:.5 | F5:1 D6:1 E5:2", at=B(10), vel=78)
    pno.play("A5:1 C6:1 D6:1.5 C6:.5 | A5:1 F6:1! G5:2", at=B(12), vel=82)
    pno.play("E5:1 D5:1 C5:1.5 D5:.5 | D5:4", at=B(14), vel=74)
    pno.play("r:1 G4:1 C5:1 E5:1 | G5:2 r:2", at=B(18), vel=62)                       # the C chord opens up
    for b in range(20, 28, 2):                                                        # warm thirds under the round
        pno.play("E4+G4:2 F4+A4:2 | E4+G4:2 D4+G4:2", at=B(b), vel=56)
    pno.play("E4+G4:2 E4+C5:2 | E4+G4:2 D4+G4:2", at=B(28), vel=56)
    pno.play("E4+E5:1 G4+G5:1 A4+A5:1.5 G4+G5:.5 | E4+E5:1 C5+C6:1 D4+D5:2 | C4+C5:2 E5:1 G5:1 | C6:2 r:2",
             at=B(30), vel=78)
    pno.play("E4:1 C5:1 D4:2 | r:4 | C4:4 | -:4", at=B(34), vel=60)

    # ---- piano left hand: rocking open voicings ---------------------------------------------------------
    for i, sym in enumerate(CHORDS):
        at, bar = i * 2.0, i // 2
        v = LV[sym]
        soft = 16 <= bar < 30
        vel = 50 if soft else (64 if 30 <= bar < 34 else 58)
        if bar >= 36:
            continue
        if 8 <= bar < 16:                                  # flowing eighths under the strings
            for k, p in enumerate((v[0], v[1], v[2], v[1])):
                pno.note(p, at + 0.5 * k, 1.0, vel=vel - (0 if k == 0 else 8))
        else:
            pno.note(v[0], at, 2.0, vel=vel)
            pno.chord(v[1:], at + 1.0, 1.0, vel=vel - 10)
    pno.chord(["C2", "G2", "E3", "G3"], B(36), 8.0, vel=56, roll_ms=40)
    pno.pedal_every(0, B(36), every=2.0, lift=0.12)
    pno.pedal(B(36), B(38) - 0.05)

    # ---- strings: held voicings, merged while the chord stays -------------------------------------------
    i = 16
    while i < len(CHORDS):
        j = i
        while j + 1 < len(CHORDS) and CHORDS[j + 1] == CHORDS[i] and j + 1 - i < 4:
            j += 1
        strs.chord(SV[CHORDS[i]], i * 2.0, (j - i + 1) * 2.0, vel=56)
        i = j + 1
    for a, b, v0, v1 in ((0, 8, 40, 40), (8, 12, 40, 72), (12, 15, 72, 104), (15, 16, 104, 84), (16, 18, 84, 92),
                         (18, 20, 92, 78), (20, 28, 78, 92), (28, 30, 92, 100), (30, 32, 100, 116),
                         (32, 34, 116, 70), (34, 36, 70, 52), (36, 38, 52, 34)):
        strs.expression(B(a), B(b), v0, v1)
    vln.play(EIGHT, at=B(30), vel=70)
    vln.expression(B(30), B(31) + 2, 92, 116)
    vln.expression(B(32), B(33), 116, 60)

    # ---- whistle and glockenspiel: the eight notes ------------------------------------------------------
    for b in (16, 20, 24, 30):
        whi.play(EIGHT, at=B(b), vel=80 if b in (16, 30) else 74, gate=0.96)
        whi.vibrato(B(b + 1) + 2.5, 36)                    # a little life on the long D and the C
        whi.vibrato(B(b + 1) + 3.9, 0)
        whi.vibrato(B(b + 2) + 1.0, 44)
        whi.vibrato(B(b + 3), 0)
    glock.note("C6", B(18), 3.0, vel=60)                   # "over."
    for b in (22, 26):
        glock.play(EIGHT, at=B(b), ring=0.5, vel=66)
    glock.play("C6:1 D5:2 | C5:4", at=B(31) + 1, ring=0.5, vel=70, bar_check=False)
    glock.note("C6", B(37), 4.0, vel=46)

    # ---- nylon guitar --------------------------------------------------------------------------------------
    for i, sym in enumerate(CHORDS):
        at, bar = i * 2.0, i // 2
        if not 16 <= bar < 34:
            continue
        gsym = "G" if sym == "G/B" else sym
        up = fretted(gsym, tuning=midilib.GUITAR, max_fret=5)[-4:]
        if bar < 20 or bar == 33:
            gtr.arp(up, at, 2.0, step=0.5, order=[0, 2, 1, 3], ring=1.0, vel=56, accent=8)
        elif bar == 32:
            gtr.strum(gsym, at, 2.0, vel=62, direction="down", spread_ms=40, instrument="guitar")
        else:
            gtr.strum_pattern(gsym, at, "D-du", step=0.5, instrument="guitar", vel=56, spread_ms=16)

    # ---- upright bass ------------------------------------------------------------------------------------------
    end = bass.play(BASS, at=B(16), gate=0.92, vel=78)
    assert end == B(34)
    for n in bass.notes:
        if n.start % 2.0 != 0.0:
            n.vel = 64

    # ---- brushes -------------------------------------------------------------------------------------------------
    light = {"kick": ("x.......x.......", 58), "brush_tap": ("....x.......x..o", 78), "chh": ("x.x.x.x.x.x.x.x.", 52)}
    full = {"kick": ("x.........x.....", 66), "brush_tap": ("....x..o....x.o.", 88), "chh": ("x.x.x.x.x.x.x.x.", 58)}
    drums.grid(light, start=B(16), repeats=4)
    drums.grid(full, start=B(20), repeats=4)
    drums.grid(dict(full, ride=("x...x...x...x...", 50)), start=B(24), repeats=5)
    drums.grid({"kick": ("x.......x.......", 64), "brush_tap": ("....x.....x.x.xx", 88), "chh": ("x.x.x.x.x.x.....", 56)},
               start=B(29), repeats=1)
    drums.grid(dict(full, ride=("x...x...x...x...", 54)), start=B(30), repeats=2)
    drums.hit("triangle", B(32), vel=56, dur=1.0)
    drums.grid(light, start=B(32), repeats=1)
    drums.hit("kick", B(33), vel=56)
    drums.hit("brush_swirl", B(33), vel=92, dur=2.0)
    drums.hit("brush_swirl", B(33) + 2, vel=74, dur=2.0)

    song.swing(0.54, grid=0.5, start=B(16), end=B(34))
    song.humanize(timing_ms=9, velocity=6, drums_timing_ms=4)
    song.tempo_ramp(B(14) + 2, B(16) - 0.5, 84, 72)
    song.tempo(84, at=B(16))
    song.tempo_ramp(B(33), B(37), 84, 60)
    return song


if __name__ == "__main__":
    s = build()
    print(s.summary())
    for w in s.lint():
        print("lint:", w)
