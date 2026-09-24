#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bgm_boss - "Out Loud".

Boss theme (Gull, Perfectly Fine, troop_big_noise).  150 BPM, E minor, 4/4, 40 bars (64 s).
Driving and stubborn: a syncopated fingered-bass riff that will not let go of the root, a saw lead
that shouts the same note three times before it dares to move, string stabs on the off-beats and a
kit that keeps reaching for the toms.

Form: intro 4 | A 8 | A' 8 (phrygian F6 borrowed) | B 8 (E dorian, the motif fragmented) |
      break 4 (drums out, strings alone) | A'' 8 (climax, then stripped back to the riff).
Leitmotif: "Are You Awake" in E minor - G B C B G E5 F#, sung plainly by the strings in the break
and still stopping on the second degree; its first three notes also seed the B-section fragment.

Render:  python3 tools/music/render.py tools/music/tracks/bgm_boss.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from midilib import Pattern, Scale, Song, bass_note  # noqa: E402

META = {
    "id": "bgm_boss",
    "loop": True,
    "lofi": 0.18,
    "gain_db": 0.0,
    "tail_beats": 8,
    "key": "E minor",
    "lead": "saw",
    "volume": 0.85,
    "space": 0.14,
    # FluidR3's saw-lead and string presets carry a built-in chorus send; the renderer's default
    # chorus is wide enough to invert the stereo image, so keep it to a trace here.
    "chorus": {"level": 0.12, "depth": 2.0, "nr": 2},
}

INTRO = ["Em", "Em", "Em", "B7sus4"]
A = ["Em9", "Em9", "Cmaj7", "Cmaj7", "Am7", "Am7", "B7sus4", "B7"]
A2 = ["Em9", "Em9", "Cmaj7", "Cmaj7", "Am7", "F6", "B7sus4", "B7#5"]
B = ["Em7", "A9", "Em7", "A9", "Cmaj7", "Bm7", "Am7", "B7sus4"]
BREAK = ["Em(add9)", "Am7", "Cmaj7", "B7sus4"]
A3 = ["Em9", "Em9", "Cmaj7", "Cmaj7", "Am7", "F6", "B7sus4", "B7"]
CHORDS = INTRO + A + A2 + B + BREAK + A3          # 40 bars, one chord per bar


def build():
    song = Song(bpm=150, time_sig=(4, 4), seed=1507, title="bgm_boss")
    song.set_loop_bars(40)
    key = Scale("E", "minor")
    dorian = Scale("E", "dorian")
    for name, bar in (("intro", 0), ("A", 4), ("A'", 12), ("B", 20), ("break", 28), ("A''", 32)):
        song.marker(name, song.bar(bar))

    # ---- bass: the stubborn riff --------------------------------------------------------------
    bass = song.track("bass", "fingered_bass", volume=88, pan=0.0, reverb=12, vel=88)
    roots = [bass_note(s, 2) for s in CHORDS]
    for i in range(len(CHORDS)):
        t = song.bar(i)
        r = roots[i]
        nxt = roots[(i + 1) % len(roots)]
        app = r + 2 if nxt == r else (nxt - 1 if nxt > r else nxt + 1)
        if 28 <= i < 31:                                  # the break: bass drops to a bare pedal
            bass.note(r, t, 3.5, vel=62)
            continue
        for off, p, dur, vel in ((0.0, r, 0.45, 96), (0.5, r, 0.22, 70), (0.75, r, 0.22, 80),
                                 (1.5, r, 0.45, 88), (2.0, r + 7, 0.45, 80), (2.5, r, 0.22, 74),
                                 (2.75, r + 12, 0.22, 82), (3.5, app, 0.45, 90)):
            bass.note(p, t + off, dur, vel=vel)
    bass.bend_range(2)
    bass.bend(song.bar(32) - 0.05, -2.0)
    bass.bend_ramp(song.bar(32), song.bar(32) + 0.3, -2.0, 0.0)

    # ---- saw lead: the shout ---------------------------------------------------------------------
    saw = song.track("saw", "saw_lead", volume=118, pan=0.14, reverb=30, vel=84)
    motif = Pattern("5:.5 5:.5 5:.5 6:.5 5:1 3:1 | 4:.5 4:.5 3:.5 2:.5 1:2")
    answer = motif.shift(+2, scale=key)
    third = motif.shift(-1, scale=key)
    cad = Pattern("5:.5 6:.5 7:.5 1':1 7:.5 5:1 | 6:.5 5:.5 4:1 3:.5 2:.5 2:1")

    def shout(bar, last, vel=None, oct_=4, sc=None):
        t = song.bar(bar)
        for ph in (motif, answer, third, last):
            saw.play(ph, at=t, scale=sc or key, octave=oct_, gate=0.9, vel=vel)
            t += ph.length
        return t

    shout(4, cad)                                                     # A
    # A': same shape, but the answer is pushed up and the cadence refuses to come down
    cad2 = Pattern("5:.5 6:.5 7:.5 1':1 2':.5 3':1 | 2':.5 1':.5 7:1 5:.5 #7:.5 5:1")
    shout(12, cad2, vel=84)

    # B: only the first three notes survive, sequenced over an E dorian vamp
    frag = Pattern("5:.5 5:.5 5:.5 r:.5 6:1 5:1")
    for k in range(4):
        saw.play(frag.shift(k, scale=dorian), at=song.bar(20 + 2 * k), scale=dorian, octave=4,
                 gate=0.88, vel=76 + 3 * k)
        saw.play("1':.5 7:.5 6:.5 5:.5 4:1 3:1" if k % 2 == 0 else "3:.5 4:.5 5:.5 6:.5 5:2",
                 at=song.bar(21 + 2 * k), scale=dorian, octave=4, gate=0.9, vel=76 + 3 * k)

    # A'': the highest note of the piece, once, then the lead walks off before the loop point
    cad3 = Pattern("5:.5 6:.5 7:.5 1':1 2':.5 3':1! | 2':.5 1':.5 7:1 6:1 5:1")
    shout(32, cad3, vel=88)
    saw.clear_range(song.bar(39), song.bar(40))
    saw.play("5:1 r:3", at=song.bar(39), scale=key, octave=4, vel=70)
    saw.crescendo(song.bar(26), song.bar(28), 0.9, 1.08)

    # ---- strings: stabs, and the leitmotif in the break --------------------------------------------
    st = song.track("strings", "strings", volume=120, pan=-0.2, reverb=56, vel=78)
    for i in (2, 3):                                                  # intro: they arrive early
        st.chord(CHORDS[i], song.bar(i) + 2, 2.0, vel=58, octave=3, voicing="open")
    for block in (12, 32):                                            # A' and A'': off-beat stabs
        for i in range(block, block + 8):
            for off, v in ((1.5, 72), (2.75, 62), (3.5, 76)):
                st.chord(CHORDS[i], song.bar(i) + off, 0.4, vel=v, octave=3, voicing="drop2")
    for i in range(20, 28):                                           # B: sustained, swelling
        st.chord(CHORDS[i], song.bar(i), 3.9, vel=60, octave=3, voicing="open")
    st.expression(song.bar(20), song.bar(24), 60, 105)
    st.expression(song.bar(24), song.bar(28), 105, 62)
    # the break: the call itself, unaccompanied, still stopping on the second degree
    call = Pattern("3:1 5:1 6:1.5 5:.5 | 3:1 1':1 2:2")
    st.play(call, at=song.bar(28), scale=key, octave=4, gate=1.0, vel=74)
    st.play(call.slice(0, 4), at=song.bar(30), scale=key, octave=4, transpose=12, gate=1.0, vel=62)
    st.chord("B7sus4", song.bar(31), 4.0, vel=66, octave=3, voicing="open")
    st.expression(song.bar(28), song.bar(30), 78, 100)
    st.expression(song.bar(30), song.bar(32), 100, 78)
    st.cc(11, 127, at=song.bar(39) + 3.5)

    # ---- kit ------------------------------------------------------------------------------------
    d = song.drums("kit", kit="power", volume=74, reverb=30, vel=84)
    drive = {"kick":  ("x.....x...x.....", 88),
             "snare": ("....x.......x...", 100),
             "chh":   ("x.x.x.x.x.x.x.x.", 66)}
    ride = {"kick":  ("x.....x...x.....", 88),
            "snare": ("....x.......x...", 100),
            "ride":  ("x.x.x.x.x.x.x.x.", 60),
            "tom_floor_lo": ("..........x.....", 66)}
    fill = {"kick": ("x.......x.......", 86), "snare": ("....x...x.x.....", 100),
            "tom_mid_hi": ("..........x.x...", 92), "tom_floor_lo": ("..............x.", 96)}
    d.grid({"tom_floor_lo": ("x.......x.......", 78)}, start=song.bar(0), repeats=1)
    d.grid({"tom_floor_lo": ("x.......x...x...", 82), "tom_mid_lo": ("....x.......x...", 74)},
           start=song.bar(1), repeats=1)
    d.grid({"tom_floor_lo": ("x...x...x...x...", 86), "tom_mid_lo": ("..x...x...x...x.", 76),
            "chh": ("x.x.x.x.x.x.x.x.", 54)}, start=song.bar(2), repeats=1)
    d.grid(fill, start=song.bar(3), repeats=1)
    d.hit("crash", song.bar(4), vel=96)
    for bar in list(range(4, 28)) + list(range(32, 40)):
        if bar in (28, 29, 30, 31):
            continue
        if bar % 8 == 3:
            d.grid(fill, start=song.bar(bar), repeats=1)
        elif 20 <= bar < 28:
            d.grid(ride, start=song.bar(bar), repeats=1)
        else:
            d.grid(drive, start=song.bar(bar), repeats=1)
    d.grid({"tom_floor_lo": ("x.......x.......", 62)}, start=song.bar(30), repeats=1)
    d.grid({"tom_floor_lo": ("x...x...x...x...", 70), "tom_mid_lo": ("..x...x...x...x.", 62),
            "tom_mid_hi": ("..............x.", 88)}, start=song.bar(31), repeats=1)
    d.hit("crash", song.bar(32), vel=100)
    d.hit("crash2", song.bar(20), vel=88)
    # last bar: strip back to the bare pulse so the loop falls into the intro's toms
    d.clear_range(song.bar(39), song.bar(40))
    d.grid({"kick": ("x.......x.......", 84), "tom_floor_lo": ("............x.x.", 80)},
           start=song.bar(39), repeats=1)

    song.humanize(timing_ms=6, velocity=6, drums_timing_ms=3)
    return song


if __name__ == "__main__":
    s = build()
    print(s.summary())
    for w in s.lint():
        print("lint:", w)
