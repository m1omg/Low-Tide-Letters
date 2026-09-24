#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""test_pipeline - 16-bar original demo that exercises every midilib helper.

Music-box lullaby in F major over soft pedalled piano chords, a nylon-guitar arpeggio (bars 1-8) that turns
into a gentle strum (bars 9-16), an upright bass with one pitch-bend slide, and light brushed drums that
enter in bar 5.  Form: A (bars 1-8), A' (bars 9-16, borrowed iv chord, thicker accompaniment); the last bar
sits on C7sus4 so the loop falls back into bar 1.

Render:  python3 tools/music/render.py tools/music/tracks/test_pipeline.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from midilib import Pattern, Scale, Song, bass_note, voice_led  # noqa: E402

META = {
    "id": "test_pipeline",
    "loop": True,
    "lofi": 0.5,
    "gain_db": 0.0,
    "tail_beats": 8,
    "key": "F major",
    "lead": "musicbox",
}

# one chord symbol per half bar (2 beats)
CHORDS_A = ["Fmaj7", "Fmaj7", "Am7", "Am7", "Bbmaj7", "Bbmaj7", "C7sus4", "C7sus4",
            "Dm7", "Dm7", "Bbmaj7", "Bbmaj7", "Gm7", "Gm7", "C7sus4", "C7"]
CHORDS_B = ["Fmaj7", "Fmaj7", "Am7", "Am7", "Bbmaj7", "Bbmaj7", "Bbm6", "Bbm6",
            "F/A", "F/A", "Dm7", "Dm7", "Gm7", "C7sus4", "Fadd9", "C7sus4"]


def build():
    song = Song(bpm=84, time_sig=(4, 4), seed=20260921, title="test_pipeline")
    song.set_loop_bars(16)
    key = Scale("F", "major")
    chords = CHORDS_A + CHORDS_B
    song.marker("A", song.bar(0))
    song.marker("A'", song.bar(8))

    # ---- music box: the tune --------------------------------------------------------------
    box = song.track("musicbox", "music_box", volume=108, pan=0.12, reverb=88, chorus=10, vel=84)
    phrase_1 = Pattern("C6:1 A5:.5 C6:.5 E6:1.5 D6:.5 | C6:1 G5:1 A5:2")
    phrase_2 = Pattern("D6:1 Bb5:.5 D6:.5 F6:1.5 E6:.5 | D6:1 C6:1 G5:1 r:1")
    phrase_3 = Pattern("A5:1 F5:.5 A5:.5 C6:1.5 A5:.5 | Bb5:1 A5:.5 F5:.5 D5:2")
    phrase_4 = Pattern("G5:.5 A5:.5 Bb5:1 D6:1 C6:1 | C6:1.5 Bb5:.5 G5:1 E5:1")
    t = 0.0
    for ph in (phrase_1, phrase_2, phrase_3, phrase_4):
        t = box.play(ph, at=t, ring=0.75)
    # A': same opening, then the borrowed iv (Bbm6) and a new close that leads back to bar 1
    t = box.play(phrase_1, at=song.bar(8), ring=0.75)
    t = box.play("D6:1 Bb5:.5 D6:.5 F6:1.5 E6:.5 | Db6:1 Bb5:1 G5:2", at=t, ring=0.75)
    t = box.play("C6:1 A5:.5 C6:.5 F6:2! | E6:.5 D6:.5 C6:1 A5:2", at=t, ring=0.75)
    t = box.play("Bb5:1 D6:1 C6:1 Bb5:1 | A5:1.5 G5:.5 F5:1 G5:.5 Bb5:.5", at=t, ring=0.5)
    assert t == song.loop_length_beats
    # a little answer figure written in SCALE DEGREES (transposed up an octave), later restated one
    # scale step higher (diatonic shift) over the Dm7 bar
    sparkle = Pattern("5:.5 6:.5 8:1")
    box.play(sparkle, at=song.bar(3) + 3, scale=key, octave=4, transpose=12, vel=58)
    box.play(sparkle.shift(1), at=song.bar(13) + 2, scale=key, octave=5, vel=56)
    box.crescendo(song.bar(6), song.bar(8), 0.85, 1.1)
    box.diminuendo(song.bar(15), song.bar(16), 1.0, 0.75)

    # ---- piano: voice-led pad of soft chords with pedal --------------------------------------
    pno = song.track("piano", "piano", volume=100, pan=-0.15, reverb=70, vel=66)
    voicings = voice_led(chords, lo="C3", hi="G4")
    prev = None
    for i, (sym, v) in enumerate(zip(chords, voicings)):
        start = i * 2.0
        if sym == prev and i % 2 == 1:
            continue                                    # chord lasts the whole bar
        dur = 4.0 if (i % 2 == 0 and i + 1 < len(chords) and chords[i + 1] == sym) else 2.0
        pno.chord(v, start, dur, vel=66, top_accent=6, roll_ms=22)
        prev = sym
    pno.pedal_every(0, song.loop_length_beats, every=2.0, lift=0.12)

    # ---- nylon guitar: arpeggio in A, strum in the second half of A' ---------------------------
    gtr = song.track("guitar", "nylon_guitar", volume=92, pan=0.35, reverb=55, vel=62)
    for i, sym in enumerate(chords):
        start = i * 2.0
        if start < song.bar(12):
            gtr.arp(sym, start, 2.0, step=0.5, order=[0, 2, 1, 3], octave=3, ring=1.0, vel=60, accent=10)
        else:
            gtr.strum_pattern(sym, start, "D-du", step=0.5, instrument="guitar", vel=58, spread_ms=16)
    # last half bar: one slow ukulele-style roll on the dominant
    gtr.clear_range(song.bar(15) + 2, song.bar(16))
    gtr.strum("C7sus4", song.bar(15) + 2, 2.0, vel=60, direction="down", spread_ms=38, instrument="guitar")

    # ---- upright bass: roots, one slide into the borrowed chord ---------------------------------
    bass = song.track("bass", "acoustic_bass", volume=100, pan=-0.05, reverb=20, vel=78)
    bass.bend_range(2)
    for i, sym in enumerate(chords):
        start = i * 2.0
        if i % 2 == 1 and chords[i - 1] == sym:
            bass.note(bass_note(sym, 2) + 7 if bass_note(sym, 2) + 7 <= 50 else bass_note(sym, 2) - 5,
                      start + 1.0, 1.0, vel=64)    # fifth as a pickup on beat 4
            continue
        dur = 3.0 if (i % 2 == 0 and chords[i + 1] == sym) else 2.0
        bass.note(bass_note(sym, 2), start, dur, vel=80)
    slide_at = song.bar(11)
    bass.bend(slide_at - 0.02, -1.0)
    bass.bend_ramp(slide_at, slide_at + 0.5, -1.0, 0.0)

    # ---- brushed drums from bar 5 ------------------------------------------------------------------
    drums = song.drums("brushes", kit="brush", volume=112, reverb=45, vel=80)
    groove = {
        "kick":       ("x.........x.....", 70),
        "brush_tap":  ("....x..o....x..o", 92),
        "chh":        ("x.x.x.x.x.x.x.x.", 66),
    }
    drums.grid(groove, start=song.bar(4), repeats=4)
    drums.grid(dict(groove, ride=("x...x...x...x...", 58)), start=song.bar(8), repeats=7)
    drums.grid({"kick": ("x.......", 68), "brush_tap": ("....x.oo", 90), "chh": ("x.x.x...", 62)},
               start=song.bar(15), repeats=1)
    drums.hit("triangle", song.bar(8), vel=58, dur=1.0)
    drums.hit("brush_swirl", song.bar(15) + 2, vel=100, dur=2.0)

    # ---- feel: light swing, human timing, a tiny ritardando into the loop point -------------------
    song.swing(0.56, grid=0.5)
    song.humanize(timing_ms=9, velocity=6)
    song.tempo_ramp(song.bar(15) + 2, song.bar(16) - 0.5, 84, 79)
    return song


if __name__ == "__main__":
    s = build()
    print(s.summary())
    for w in s.lint():
        print("lint:", w)
