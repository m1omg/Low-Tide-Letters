#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bgm_title - "Are You Awake" stated plainly.  Title screen and Ending B.

C major, 72 bpm, 16 bars (53 s loop).  Music box + warm pad (+ a very soft Rhodes for the bass notes).
Form (4-bar phrases):
  bars 1-4    the seven-note motif completely alone, then two bars of held breath
  bars 5-8    motif with single bass notes, answered by a phrase that also sinks back to D
  bars 9-12   motif with after-beat "comb" notes, the answer climbs to E6 (the only high point),
              passes through the borrowed iv (Fm6) and falls to D again
  bars 13-16  motif once more, thinner; the last two notes (C-D) echo, the pad is left hanging on G6
The motif always ends on D (the second degree).  The home note C is never played as a melodic goal.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from midilib import Pattern, Song  # noqa: E402

META = {
    "id": "bgm_title",
    "loop": True,
    "lofi": 0.55,
    "crackle": 0.15,
    "space": 0.3,
    "gain_db": 0.0,
    "tail_beats": 12,
    "key": "C major",
    "lead": "musicbox",
}

# "Wren? Are you a-wake? O-ver" - seven notes, ends on D
MOTIF = Pattern("E5:1 G5:1 A5:1.5 G5:.5 | E5:1 C6:1 D5:2")

# open three-note voicings (bible 11.1)
V = {
    "Am7": ["A3", "E4", "G4"], "Fmaj7": ["F3", "C4", "E4"], "C/E": ["E3", "C4", "G4"],
    "G6": ["G3", "D4", "E4"], "Cadd9/E": ["E3", "C4", "D4"], "Dm7": ["D3", "A3", "C4"],
    "Fm6": ["F3", "Ab3", "D4"], "Gsus2": ["G3", "D4", "A4"],
}
BASS = {"Am7": "A2", "Fmaj7": "F2", "C/E": "E2", "G6": "G2", "Cadd9/E": "E2", "Dm7": "D2", "Fm6": "F2",
        "Gsus2": "G2"}

# (bar, beat, chord, beats)
HARMONY = [
    (4, 0, "Am7", 2), (4, 2, "Fmaj7", 2), (5, 0, "C/E", 2), (5, 2, "G6", 2),
    (6, 0, "Fmaj7", 2), (6, 2, "Cadd9/E", 2), (7, 0, "Dm7", 2), (7, 2, "G6", 2),
    (8, 0, "Am7", 2), (8, 2, "Fmaj7", 2), (9, 0, "C/E", 2), (9, 2, "G6", 2),
    (10, 0, "Fmaj7", 4), (11, 0, "Fm6", 2), (11, 2, "G6", 2),
    (12, 0, "Am7", 2), (12, 2, "Fmaj7", 2), (13, 0, "C/E", 2), (13, 2, "G6", 2),
    (14, 0, "Gsus2", 4), (15, 0, "G6", 4),
]


def build():
    song = Song(bpm=72, time_sig=(4, 4), seed=11072, title="bgm_title")
    song.set_loop_bars(16)
    for name, b in (("alone", 0), ("bass notes", 4), ("comb", 8), ("thin", 12)):
        song.marker(name, song.bar(b))

    box = song.track("musicbox", "music_box", volume=112, pan=0.1, reverb=92, chorus=8, vel=78)
    comb = song.track("comb", "music_box", volume=96, pan=-0.18, reverb=92, vel=50)
    pad = song.track("pad", "warm_pad", volume=86, pan=-0.05, reverb=100, chorus=12, vel=50)
    low = song.track("low", "electric_piano_1", volume=100, pan=0.0, reverb=40, vel=50)

    # ---- the tune ---------------------------------------------------------------------------
    box.play(MOTIF, at=song.bar(0), ring=0.9, vel=76)
    box.play(MOTIF, at=song.bar(4), ring=0.9, vel=78)
    box.play("G5:1 A5:1 C6:1.5 A5:.5 | G5:1 E5:1 D5:2", at=song.bar(6), ring=0.9, vel=72)
    box.play(MOTIF, at=song.bar(8), ring=0.9, vel=82)
    box.play("A5:1 C6:1 E6:1.5! D6:.5 | C6:1 Ab5:1 D5:2", at=song.bar(10), ring=0.9, vel=80)
    box.play(MOTIF, at=song.bar(12), ring=1.0, vel=70)
    box.play("r:1 C6:1:50 D5:2:44", at=song.bar(14), ring=1.2)
    box.crescendo(song.bar(10), song.bar(10) + 2.5, 0.9, 1.08)
    box.diminuendo(song.bar(11), song.bar(12), 1.0, 0.85)

    # ---- after-beat comb notes: the mechanism of the box, bars 9-14 -----------------------------
    comb.play("r:.5 C5:1.5 r:.5 C5:1.5 | r:.5 G4:1.5 r:.5 B4:1.5", at=song.bar(8), ring=0.6, vel=50)
    comb.play("r:.5 C5:.5 F5:1 r:.5 C5:.5 F5:1 | r:.5 F4:1.5 r:.5 B4:1.5", at=song.bar(10), ring=0.6, vel=52)
    comb.play("r:.5 C5:1.5 r:.5 C5:1.5 | r:.5 G4:1.5 r:2", at=song.bar(12), ring=0.6, vel=44)
    comb.play("r:2 G4:1:44 B4:1:42", at=song.bar(15), ring=1.0)      # two notes that lean back into bar 1

    # ---- pad + bass notes ---------------------------------------------------------------------------
    pad.chord(["G3", "D4"], song.bar(2) + 2, 6.0, vel=40)            # a breath under the silence
    for bar, beat, sym, beats in HARMONY:
        at = song.bar(bar) + beat
        full = 8 <= bar < 12
        pad.chord(V[sym], at, beats, vel=54 if full else 46)
        if bar < 14:
            low.note(BASS[sym], at, beats - 0.1, vel=(56 if full else 48) - (6 if bar >= 12 else 0))
    low.note("G2", song.bar(14), 7.0, vel=40)
    # swells: rise into the climb (bars 9-11), settle, and come back to the starting value
    pad.expression(0, song.bar(4), 70, 70)
    pad.expression(song.bar(4), song.bar(8), 70, 84)
    pad.expression(song.bar(8), song.bar(10) + 2, 84, 106)
    pad.expression(song.bar(10) + 2, song.bar(12), 106, 80)
    pad.expression(song.bar(12), song.bar(16), 80, 70)

    box.humanize(timing_ms=7, velocity=5, seed=1)
    comb.humanize(timing_ms=9, velocity=5, seed=2)
    low.humanize(timing_ms=6, velocity=4, seed=3)
    return song


if __name__ == "__main__":
    s = build()
    print(s.summary())
    for w in s.lint():
        print("lint:", w)
