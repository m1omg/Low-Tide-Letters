#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bgm_lull_bright - the bright, bubbling zones of the Lull (tide_steps, sorting_shallows).

F major, 112 bpm, 4/4, 28 bars (60.0 s).  Wonder with a busy surface: celesta arpeggios bubble
like air going up, a soft square lead sings the tune, a choir pad holds the water above, and
pizzicato strings bounce along the floor.  Form: Intro 4 / A 8 / A' 8 (borrowed Bbm6, light kit
enters) / B 8 - the "Are You Awake" leitmotif transposed to F (A C D C A F G), which still refuses
to close: the last melody note is G, the second degree, over C7sus4, so the loop falls back into
the intro.

Render:  python3 tools/music/render.py tools/music/tracks/bgm_lull_bright.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from midilib import Pattern, Scale, Song, bass_note, voice_led  # noqa: E402

META = {
    "id": "bgm_lull_bright",
    "loop": True,
    "lofi": 0.35,
    "space": 0.3,
    "gain_db": 0.0,
    "tail_beats": 10,
    "key": "F major",
    "lead": "shine",
    "volume": 0.8,
}

# one chord per bar, 28 bars
CHORDS = [
    # intro 0-3
    "Fadd9", "Fadd9", "Bbmaj7", "C7sus4",
    # A 4-11
    "Fadd9", "Am7", "Bbmaj7", "C7sus4", "Dm9", "Bbmaj7", "Gm7", "C7sus4",
    # A' 12-19
    "Fadd9", "Am7", "Bbmaj7", "Bbm6", "Dm9", "Gm7", "C7sus4", "F6",
    # B 20-27  (leitmotif: open three-note voicings Dm7 - Bbmaj7 - F/A - C6)
    "Dm7", "Bbmaj7", "F/A", "C6", "Dm7", "Bbmaj7", "Gm7", "C7sus4",
]

# --- the tune -------------------------------------------------------------------------------
A1 = Pattern("A5:.5 C6:.5 A5:1 G5:1 F5:1 | G5:1.5 A5:.5 C6:2")            # motif
A2 = Pattern("Bb5:.5 D6:.5 C6:1 A5:1 G5:1 | F5:1 G5:1 A5:2")              # answer
A3 = Pattern("D6:.5 F6:.5 D6:1 C6:1 A5:1 | Bb5:1.5 C6:.5 D6:2")           # lifted
A4 = Pattern("C6:.5 Bb5:.5 A5:1 G5:1 Bb5:1 | A5:1 G5:1 F5:1 r:1")         # cadence, open

B2 = Pattern("Bb5:.5 D6:.5 Bb5:1 A5:1 G5:1 | Db6:1 C6:1 Bb5:2")           # borrowed iv colour
B3 = Pattern("D6:.5 F6:.5 E6:1 D6:1 C6:1 | Bb5:1 A5:1 G5:2")
B4 = Pattern("A5:1 C6:1 D6:1 C6:1 | A5:1.5 G5:.5 F5:1 A5:1")

# leitmotif in F: A C D C A F G - climbs, leaps to the high F, drops a seventh onto G
MOTIF = Pattern("A5:1 C6:1 D6:1.5 C6:.5 | A5:1 F6:1 G5:2")
M2 = Pattern("C6:1 D6:1 F6:1.5 E6:.5 | D6:1 A5:1 C6:2")                   # sequenced answer
M3 = Pattern("A5:.5 C6:.5 D6:2 C6:.5 D6:.5 | F6:2! E6:1 D6:1")            # climax on F6
M4 = Pattern("D6:1 C6:1 A5:1.5 G5:.5 | F5:1 A5:1 G5:2")                   # lands on G, unresolved


def build():
    song = Song(bpm=112, time_sig=(4, 4), seed=20260921, title="bgm_lull_bright")
    song.set_loop_bars(28)
    key = Scale("F", "major")
    song.marker("intro", song.bar(0))
    song.marker("A", song.bar(4))
    song.marker("A'", song.bar(12))
    song.marker("B", song.bar(20))

    shine = song.track("shine", "celesta", volume=124, pan=0.14, reverb=78, vel=72)
    lead = song.track("square", "square_lead", volume=64, pan=0.1, reverb=76, vel=54)
    cel = song.track("celesta", "celesta", volume=98, pan=-0.28, reverb=82, chorus=8, vel=62)
    pad = song.track("pad", "choir_pad", volume=76, pan=0.0, reverb=100, chorus=12, vel=48)
    pizz = song.track("pizz", "pizzicato_strings", volume=98, pan=0.22, reverb=34, vel=70)
    kit = song.drums("kit", kit="room", volume=108, reverb=44, vel=66)

    # ---- choir pad: the water overhead -------------------------------------------------------
    voicings = voice_led(CHORDS, lo="C3", hi="A4")
    i = 0
    while i < len(CHORDS):
        j = i
        while j + 1 < len(CHORDS) and CHORDS[j + 1] == CHORDS[i]:
            j += 1
        start, dur = song.bar(i), song.bar(j + 1) - song.bar(i)
        pad.chord(voicings[i], start, dur + 0.5, vel=46)
        i = j + 1
    # slow breathing; back to the opening value before the seam
    pad.expression(song.bar(0), song.bar(4), 46, 66)
    pad.expression(song.bar(4), song.bar(12), 66, 58)
    pad.expression(song.bar(12), song.bar(20), 58, 84)
    pad.expression(song.bar(20), song.bar(25), 84, 92)
    pad.expression(song.bar(25), song.bar(28), 92, 46)

    # ---- celesta: bubbles ---------------------------------------------------------------------
    for i, sym in enumerate(CHORDS):
        b = song.bar(i)
        if i < 2:                       # intro: fast, weightless 16ths climbing two octaves
            cel.arp(sym, b, 4.0, step=0.25, order="up", octaves=2, octave=4, ring=0.6,
                    vel=52, accent=10)
        elif i < 4:
            cel.arp(sym, b, 4.0, step=0.25, order="updown", octaves=2, octave=4, ring=0.6,
                    vel=56, accent=10)
        elif i < 12:                    # A: eighths, gentler, one octave
            cel.arp(sym, b, 3.5, step=0.5, order=[0, 2, 1, 3], octaves=1, octave=5, ring=0.9,
                    vel=54, accent=8)
        elif i < 20:                    # A': broken 16ths again, wider
            cel.arp(sym, b, 4.0, step=0.25, order="updown", octaves=2, octave=4, ring=0.7,
                    vel=58, accent=10)
        elif i < 26:                    # B: sparse, lets the motif through
            cel.arp(sym, b + 2.0, 2.0, step=0.5, order="up", octaves=1, octave=5, ring=1.2,
                    vel=50, accent=8)
        else:                           # last two bars: thin out, one rising bubble per bar
            cel.arp(sym, b + 1.0, 3.0, step=0.5, order="up", octaves=2, octave=4, ring=1.3,
                    vel=48, accent=8)

    # ---- pizzicato: the bouncing floor --------------------------------------------------------
    for i, sym in enumerate(CHORDS):
        b = song.bar(i)
        root = bass_note(sym, 2)
        nxt = bass_note(CHORDS[(i + 1) % len(CHORDS)], 2)
        thin = i < 2 or i >= 26
        pizz.note(root, b, 0.9, vel=74 if not thin else 64)
        if not thin:
            pizz.note(root + 12, b + 1.5, 0.4, vel=54)
            pizz.note(root + 7, b + 2.0, 0.9, vel=68)
        else:
            pizz.note(root + 7, b + 2.0, 1.4, vel=58)
        if 12 <= i < 20:                        # A': octave pops on the and-of-2
            pizz.note(root + 19, b + 2.5, 0.35, vel=48)
        # approach note on the and-of-4, stepping into the next root
        if not thin:
            step = 1 if nxt > root else -1
            approach = nxt - step if abs(nxt - root) > 1 else root + step
            pizz.note(approach, b + 3.5, 0.45, vel=58)
    # two-note pickup out of the loop, straight into bar 1's F
    pizz.note(bass_note("C7sus4", 2), song.bar(27) + 3.0, 0.45, vel=62)
    pizz.note(bass_note("C7sus4", 2) + 4, song.bar(27) + 3.5, 0.45, vel=66)

    # ---- square lead --------------------------------------------------------------------------
    # the tune: celesta sings it, the square lead sits just underneath as a chiptune edge (the
    # FluidR3 square patch is a wide, phase-inverted stereo sample, so it stays a colour, never
    # the whole melody - on a mono phone speaker the celesta is what survives)
    tunes = (A1, A2, A3, A4, A1, B2, B3, B4, MOTIF, M2, M3, M4)
    t = song.bar(4)
    for k, ph in enumerate(tunes):
        v = 68 if k < 4 else (72 if k < 8 else 76)
        t = shine.play(ph, at=t, ring=0.75, vel=v)
    assert t == song.loop_length_beats
    t = song.bar(4)
    for k, ph in enumerate(tunes):
        t = lead.play(ph, at=t, gate=0.92, vel=50 if k < 4 else 56)
    assert t == song.loop_length_beats
    shine.crescendo(song.bar(23), song.bar(25), 0.95, 1.12)
    shine.diminuendo(song.bar(26), song.bar(28), 1.0, 0.86)
    lead.diminuendo(song.bar(26), song.bar(28), 1.0, 0.8)
    # the motif's little sigh, doubled an octave down on the celesta the second time round
    cel.play(Pattern("5:.5 6:.5 8:1"), at=song.bar(11) + 2, scale=key, octave=5, vel=52, ring=0.8)
    cel.play(MOTIF.slice(0, 4).augment(0.5), at=song.bar(19) + 2, vel=50, ring=0.9, transpose=-24)

    # ---- light kit: in at A', out for the first half of B --------------------------------------
    groove = {"kick": ("x.......x.......", 62),
              "sidestick": ("....x.......x...", 78),
              "shaker": ("x.x.x.x.x.x.x.x.", 52)}
    kit.grid(groove, start=song.bar(12), repeats=8)
    kit.grid(dict(groove, shaker="x.xxx.x.x.xxx.x."), start=song.bar(24), repeats=2)
    kit.grid({"kick": ("x.......x...x...", 62),
              "sidestick": ("....x.......x...", 78),
              "shaker": ("x.x.x.x.x.x.x.x.", 50)}, start=song.bar(26), repeats=1)
    kit.hit("triangle", song.bar(20), vel=48, dur=2.0)
    kit.hit("shaker", song.bar(27) + 3.5, vel=44)

    song.swing(0.54, grid=0.5)
    song.humanize(timing_ms=7, velocity=6, drums_timing_ms=3)
    return song


if __name__ == "__main__":
    s = build()
    print(s.summary())
    for w in s.lint():
        print("lint:", w)
