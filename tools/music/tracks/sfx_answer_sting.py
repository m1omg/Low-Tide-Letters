#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""sfx_answer_sting - the eighth note.  One-shot sting for the moment the Other Can is answered.

The seven notes of "Are You Awake" on the music box (C major, 144 bpm so the whole call fits in about three
seconds), the soft strings come in under "O-ver" (C/E - G6), and the question is finally answered: D steps
down to C, doubled by the low C, on a plain C chord that swells and lets go.

This is an SFX, not a BGM.  Render it into the sfx folder:
    python3 tools/music/render.py tools/music/tracks/sfx_answer_sting.py --out assets/audio/sfx
(`render.py --all` would put a copy into assets/audio/bgm; delete that copy if it appears.)
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from midilib import Song  # noqa: E402

META = {
    "id": "sfx_answer_sting",
    "loop": False,
    "lofi": 0.3,
    "noise": 0.0,
    "crackle": 0.0,
    "space": 0.3,
    "gain_db": 0.0,
    "tail_beats": 3,
    "volume": 0.9,
    "key": "C major",
    "lead": "musicbox",
}


def build():
    song = Song(bpm=144, time_sig=(4, 4), seed=8, title="sfx_answer_sting")
    song.set_loop_bars(3)
    box = song.track("musicbox", "music_box", volume=112, pan=0.08, reverb=92, chorus=8, vel=80)
    strs = song.track("strings", "strings", volume=92, pan=-0.08, reverb=100, vel=54)

    box.play("E5:1 G5:1 A5:1.5 G5:.5 | E5:1 C6:1 D5:2:74", at=0.0, ring=0.9, vel=78)
    box.note("C5", song.bar(2), 3.5, vel=88)               # the answer
    box.note("C4", song.bar(2), 3.5, vel=80)               # ... and the low C under it
    box.note("G4", song.bar(2) + 1.0, 2.5, vel=52)         # the plain chord, spelled once, quietly
    box.note("E5", song.bar(2) + 1.5, 2.0, vel=50)

    strs.chord(["G3", "C4", "E4"], song.bar(1), 2.0, vel=50)
    strs.chord(["G3", "D4", "E4"], song.bar(1) + 2, 2.0, vel=52)
    strs.chord(["C3", "G3", "C4", "E4"], song.bar(2), 4.5, vel=58)
    strs.expression(0, song.bar(1), 30, 30)
    strs.expression(song.bar(1), song.bar(2), 30, 84)
    strs.expression(song.bar(2), song.bar(2) + 1.5, 84, 110)
    strs.expression(song.bar(2) + 1.5, song.bar(3) - 0.05, 110, 40)

    box.humanize(timing_ms=6, velocity=4, seed=1)
    song.tempo_ramp(song.bar(1) + 2, song.bar(2), 144, 120)
    return song


if __name__ == "__main__":
    s = build()
    print(s.summary())
    for w in s.lint():
        print("lint:", w)
