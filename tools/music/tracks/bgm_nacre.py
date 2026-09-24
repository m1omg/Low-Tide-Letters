#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bgm_nacre - Nacre's offer, the Nacre fight, Ending C.

A lullaby that is too sweet.  66 BPM, Eb major, 3/4, 32 bars (~87 s) = eight four-bar phrases.
Celesta carries the tune over a harp that rocks the bar, choir aahs breathe underneath and a soft
timpani closes each lid.  Nothing is allowed to run on: every four-bar phrase stops before the last
beat of its fourth bar, and that beat gets one dull timpani stroke - the seal.

Form: P1 celesta+harp | P2 +timpani | P3 +choir | P4 full | P5 the sweetness sours (borrowed Abm6,
Db6/9) | P6 the opening returns | P7 the one climb to G5 | P8 thinned back to celesta and harp.
Leitmotif: only its last two notes.  Every phrase ends Eb5 -> F4 - "1' 2", the seventh-drop onto the
unanswered second degree - and then the beat where the tune would continue is silence.

Render:  python3 tools/music/render.py tools/music/tracks/bgm_nacre.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from midilib import Pattern, Scale, Song, bass_note, voice_led  # noqa: E402

META = {
    "id": "bgm_nacre",
    "loop": True,
    "lofi": 0.42,
    "gain_db": 0.0,
    "tail_beats": 10,
    "key": "Eb major",
    "lead": "celesta",
    "volume": 0.8,
    "space": 0.3,
    "chorus": {"level": 0.15, "depth": 2.5, "nr": 2},
}

# one chord per bar; the fourth bar of every phrase is the sealed one
PHRASES = [
    ["Ebmaj9", "Cm9", "Abmaj7", "Bb7sus4"],
    ["Ebmaj9", "Gm7", "Abmaj9", "Bb7sus4"],
    ["Fm9", "Bb7", "Ebmaj7/G", "Cm7"],
    ["Abmaj7", "Bb7sus4", "Gm7", "Cm9"],
    ["Abm6", "Ebmaj7/G", "Db6", "Bb7sus4"],
    ["Ebmaj9", "Cm9", "Fm9", "Bb7sus4"],
    ["Abmaj9", "Gm7", "Fm9", "Bb7"],
    ["Ebmaj9", "Cm7", "Abmaj7", "Bb7sus4"],
]
CHORDS = [s for ph in PHRASES for s in ph]

SEAL = "1':1 2:1 r:1"          # the leitmotif's last two notes, then the beat that never comes

TUNE = [
    "5:1 6:1 1':1     | 7:1.5 6:.5 5:1   | 6:1 5:1 3:1",
    "1':1 7:1 6:1     | 5:1.5 6:.5 7:1   | 1':1 6:1 5:1",
    "6:1 1':1 2':1    | 3':1.5 2':.5 1':1| 7:1 6:1 5:1",
    "1':1 2':1 1':1   | 7:1.5 5:.5 6:1   | 5:1 6:1 7:1",
    "1':1 b6:1 5:1    | 5:1.5 3:.5 2:1   | b7:1 6:1 5:1",
    "5:1 6:1 1':1     | 7:1.5 6:.5 5:1   | 6:1 5:1 3:1",
    "1':1 2':1 3':1   | 3':1.5 2':.5 1':1| 2':1 1':1 7:1",
    "5:1 r:1 6:1      | 5:1.5 3:.5 2:1   | 3:1 5:1 6:1",
]


def build():
    song = Song(bpm=66, time_sig=(3, 4), seed=6603, title="bgm_nacre")
    song.set_loop_bars(32)
    key = Scale("Eb", "major")
    for i in range(8):
        song.marker("P%d" % (i + 1), song.bar(4 * i))

    # ---- celesta: the tune ---------------------------------------------------------------------
    cel = song.track("celesta", "celesta", volume=112, pan=0.1, reverb=86, vel=66)
    for i, body in enumerate(TUNE):
        at = song.bar(4 * i)
        vel = (62, 64, 68, 70, 62, 66, 76, 58)[i]
        cel.play(Pattern(body.replace("|", " | ")), at=at, scale=key, octave=4, ring=0.6, vel=vel)
        cel.play(SEAL, at=at + 9.0, scale=key, octave=4, ring=0.35, vel=vel - 4, gate=0.8)
    # one glassy octave doubling on the climb, so the high point happens exactly once
    cel.play("1':1 2':1 3':1", at=song.bar(24), scale=key, octave=5, ring=0.7, vel=48)
    cel.diminuendo(song.bar(28), song.bar(32), 1.0, 0.86)

    # ---- harp: the rocking of the bar -----------------------------------------------------------
    hp = song.track("harp", "harp", volume=96, pan=-0.28, reverb=78, vel=54)
    for i, sym in enumerate(CHORDS):
        bar = i % 4
        at = song.bar(i)
        if bar == 3:                                        # sealed bar: two beats only
            if i // 4 in (4, 7):
                hp.arp(sym, at, 2.0, step=0.5, order="up", octaves=1, octave=3, ring=1.1, vel=46)
            else:
                hp.strum(sym, at, 1.8, vel=52, direction="up", spread_ms=46, octave=3)
                hp.arp(sym, at + 1.0, 1.0, step=0.5, order="up", octave=4, ring=0.9, vel=44)
            continue
        if i // 4 in (0, 1, 5, 7):                          # thin phrases: a slow rocking figure
            hp.arp(sym, at, 3.0, step=0.5, order=[0, 2, 1, 3, 2, 1], octave=3, ring=1.2, vel=50)
        else:
            hp.arp(sym, at, 3.0, step=0.25, order="up", octaves=2, octave=3, ring=1.0, vel=48,
                   accent=8)
    hp.crescendo(song.bar(24), song.bar(27), 0.95, 1.12)
    hp.diminuendo(song.bar(28), song.bar(32), 1.0, 0.82)

    # ---- choir: the breath under it (phrases 3, 4, 6, 7) -----------------------------------------
    ch = song.track("choir", "choir_aahs", volume=86, pan=0.24, reverb=98, vel=52)
    voicings = voice_led(CHORDS, lo="G3", hi="F5")
    for i, v in enumerate(voicings):
        if i // 4 not in (2, 3, 5, 6):
            continue
        dur = 2.6 if i % 4 == 3 else 3.0
        ch.chord(v, song.bar(i), dur, vel=50 if i // 4 in (2, 5) else 56)
    for blk in (2, 3, 5, 6):
        a, b = song.bar(4 * blk), song.bar(4 * blk + 4)
        ch.expression(a, a + 6.0, 52, 96)
        ch.expression(a + 6.0, b - 0.4, 96, 48)
    ch.cc(11, 127, at=song.bar(31) + 2.6)

    # ---- timpani: the lid --------------------------------------------------------------------------
    tp = song.track("timp", 47, volume=98, pan=0.0, reverb=54, vel=48)
    for i in range(1, 8):                                   # phrase downbeats from P2 on
        tp.note(bass_note(CHORDS[4 * i], 2), song.bar(4 * i), 2.0, vel=40 + 3 * i)
    for i in range(8):                                      # the seal itself, on the dead beat
        tp.note(bass_note(CHORDS[4 * i + 3], 2), song.bar(4 * i + 3) + 2.0, 1.4,
                vel=44 if i not in (6,) else 54)
    tp.note(bass_note("Bb7sus4", 2), song.bar(26), 1.6, vel=46)

    song.humanize(timing_ms=13, velocity=6)
    song.tempo_ramp(song.bar(30), song.bar(31) + 2, 66, 63)
    song.tempo(66, at=song.bar(31) + 2.5)
    return song


if __name__ == "__main__":
    s = build()
    print(s.summary())
    for w in s.lint():
        print("lint:", w)
