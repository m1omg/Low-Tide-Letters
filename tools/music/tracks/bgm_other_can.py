#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bgm_other_can - The Other Can, memory_rocks, the slip.

One held breath.  54 BPM, C with no third anywhere in the harmony, 4/4, 32 bars (~142 s).
The piece is written as four eight-bar layers that only ever add: a string ensemble holding G and a
heartbeat that never changes tempo; then one instrument per friend, in the order they answer -
nylon guitar (Odo), vibraphone (Lin), music box (Pim).  The last two bars take everyone away again
except the held G and the heartbeat, so the loop starts the same breath over.

Harmony is sus2/sus4/quartal only - Csus2, Fsus2, Gsus4, Bbsus2 - so the only third ever heard is
the E inside the call itself.
Leitmotif: the full seven notes of "Are You Awake", once in every eight-bar layer, handed on from
the strings to Odo to Lin to Pim, always stopping on D.

Render:  python3 tools/music/render.py tools/music/tracks/bgm_other_can.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from midilib import Pattern, Scale, Song, bass_note  # noqa: E402

META = {
    "id": "bgm_other_can",
    "loop": True,
    "lofi": 0.45,
    "gain_db": 0.0,
    "tail_beats": 14,
    "key": "C major",
    "lead": "box",
    "volume": 0.78,
    "space": 0.42,
    "noise": 0.5,
    "crackle": 0.1,
    "chorus": {"level": 0.1, "depth": 2.0, "nr": 2},
    "reverb": {"room-size": 0.82, "damp": 0.35, "width": 0.55, "level": 0.95},
}

# two bars per chord
LAYERS = [
    ["Csus2", "Csus2", "Gsus4", "Csus2"],
    ["Csus2", "Fsus2", "Gsus4", "Csus2"],
    ["Csus2", "Fsus2", "Bbsus2", "Gsus4"],
    ["Csus2", "Fsus2", "Gsus4", "Csus2"],
]
CALL = Pattern("3:1 5:1 6:1.5 5:.5 | 3:1 1':1 2:2")      # E G A G E C5 D - and it stops there


def chord_at(bar):
    return LAYERS[bar // 8][(bar % 8) // 2]


def build():
    song = Song(bpm=54, time_sig=(4, 4), seed=5401, title="bgm_other_can")
    song.set_loop_bars(32)
    key = Scale("C", "major")
    for i in range(4):
        song.marker("L%d" % (i + 1), song.bar(8 * i))

    # ---- layer 1: the held G, and the heartbeat --------------------------------------------------
    st = song.track("held", "strings", volume=100, pan=-0.12, reverb=96, vel=52)
    st.note("G3", 0.0, 32.2, vel=50)
    st.note("G3", 32.0, 32.2, vel=52)
    st.note("G4", 32.0, 32.2, vel=42)
    st.note("G3", 64.0, 32.2, vel=54)
    st.note("G4", 64.0, 32.2, vel=44)
    st.note("D4", 64.0, 32.2, vel=38)
    st.note("G3", 96.0, 35.5, vel=52)          # rings past the loop point, so the seam breathes on
    st.note("G4", 96.0, 34.0, vel=42)
    st.note("D4", 96.0, 24.0, vel=36)
    for blk in range(4):                                  # breathing in, breathing out
        a = song.bar(8 * blk)
        st.expression(a, a + 16.0, 54, 92 + 6 * blk)
        st.expression(a + 16.0, a + 32.0, 92 + 6 * blk, 54)
    st.bend_range(2)
    st.bend(song.bar(16), -0.14)                          # the pedal starts to beat against itself
    st.bend_ramp(song.bar(28), song.bar(31), -0.14, 0.0)

    beat = song.drums("heart", kit="room", volume=96, reverb=52, vel=56)
    for b in range(32):
        grow = 1.0 + 0.16 * (b // 8)
        if b >= 30:
            grow = 1.0
        for off in (0.0, 2.0):
            at = song.bar(b) + off
            beat.hit("kick2", at, vel=int(52 * grow), dur=0.5)
            beat.hit("kick2", at + 0.42, vel=int(38 * grow), dur=0.4)
    # layer 1 states the call itself, thin and high, in the strings
    st.play(CALL, at=song.bar(4), scale=key, octave=4, gate=0.98, vel=46)

    # ---- layer 2: Odo, nylon guitar ----------------------------------------------------------------
    gtr = song.track("odo", "nylon_guitar", volume=96, pan=0.3, reverb=62, vel=58)
    for b in range(8, 32):
        sym = chord_at(b)
        at = song.bar(b)
        if b >= 30:                                       # he stops first
            continue
        low = bass_note(sym, 2)
        low = low + 12 if low < 40 else low
        if b % 2 == 0:
            gtr.note(low, at, 3.4, vel=52)                # the root under the drone: this is a C piece
            gtr.arp(sym, at, 4.0, step=1.0, order=[0, 1, 2, 1], octave=3, ring=1.6, vel=56)
        else:
            gtr.arp(sym, at, 3.0, step=0.5, order=[2, 3, 2, 1, 0, 1], octave=3, ring=1.4, vel=50)
            gtr.note(low, at + 3.0, 1.2, vel=54)
    gtr.play(CALL, at=song.bar(12), scale=key, octave=4, gate=1.0, ring=0.9, vel=62)

    # ---- layer 3: Lin, vibraphone -------------------------------------------------------------------
    vib = song.track("lin", "vibraphone", volume=108, pan=-0.32, reverb=80, vel=58)
    counter = Pattern("5:2 6:1 5:1 | 3:2 2:2")
    for b in range(16, 32):
        if b >= 29:
            continue
        sym = chord_at(b)
        if b % 4 == 0:
            vib.chord(sym, song.bar(b), 3.6, vel=52, octave=3, voicing="open", roll_ms=70)
        elif b % 4 == 2:
            vib.arp(sym, song.bar(b), 4.0, step=1.0, order="updown", octave=4, ring=1.2, vel=48)
    vib.play(counter, at=song.bar(18), scale=key, octave=4, ring=1.0, vel=56)
    vib.play(CALL, at=song.bar(20), scale=key, octave=4, gate=1.0, ring=0.8, vel=60)
    vib.play(counter.reverse(), at=song.bar(26), scale=key, octave=4, ring=1.0, vel=50)

    # ---- layer 4: Pim, music box ---------------------------------------------------------------------
    box = song.track("box", "music_box", volume=116, pan=0.16, reverb=98, vel=66)
    box.play("5:2 1':2 | 6:2 5:2", at=song.bar(24), scale=key, octave=5, ring=1.2, vel=58)
    box.play(CALL, at=song.bar(28), scale=key, octave=5, gate=1.0, ring=1.1, vel=68)
    box.note("G5", song.bar(31) + 2.0, 3.0, vel=46)       # the one note left ringing over the seam

    song.humanize(timing_ms=16, velocity=5, drums_timing_ms=10)
    return song


if __name__ == "__main__":
    s = build()
    print(s.summary())
    for w in s.lint():
        print("lint:", w)
