#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bgm_undertow - the deep, held rooms of the Lull (undertow_light, pearl_bed).

D minor, 60 bpm, 4/4, 24 bars (96.0 s), through-composed: nothing comes back the same way twice.
A detuned electric piano (two copies a seventh of a semitone apart, panned left and right) plays
close, low chords; a warm pad sits under them, bent a tenth of a semitone flat so it beats slowly
against everything; a sub bass holds D for the first eight bars and only then starts to move; the
tape hiss and crackle of the lo-fi chain, with brushed swirls at irregular places, is the radio
static.

The music box plays "Are You Awake" backwards - D C' E G A G E - first plainly (bars 8-9), then
broken into its first three notes and sequenced downward as the harmony darkens (Bbm6, Ebmaj7#11,
Gm(maj7)), and finally twice as slow over the last four bars, where everything else leaves. It ends
on E over A7sus4: not the question and not the answer, just the shape of it in reverse, hanging.

Render:  python3 tools/music/render.py tools/music/tracks/bgm_undertow.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from midilib import Pattern, Scale, Song, bass_note, voice_led  # noqa: E402

META = {
    "id": "bgm_undertow",
    "loop": True,
    "lofi": 0.55,
    "space": 0.45,
    "noise": 0.6,
    "crackle": 0.28,
    "gain_db": 0.0,
    "tail_beats": 14,
    "key": "D minor",
    "lead": "box",
    "volume": 0.72,
    "reverb": {"room-size": 0.86, "damp": 0.5, "width": 0.9, "level": 0.95},
}

CHORDS = [
    "Dmadd9", "Dmadd9", "Bbmaj7", "Bbmaj7",          # 0-3   only pad and sub bass
    "Gm9", "Gm9", "A7sus4", "A7b9",                  # 4-7   the electric piano arrives
    "Dmadd9", "Dm7/C", "Bbmaj7", "A7sus4",           # 8-11  the motif, backwards, plainly
    "Bbm6", "Ebmaj7#11", "Gmmaj7", "A7b9",           # 12-15 it darkens and the motif breaks up
    "Dmadd9", "Bbmaj7", "F/A", "Gm9",                # 16-19 the tender centre
    "Dm9", "Bbmaj7", "A7sus4", "A7sus4",             # 20-23 everything leaves the music box alone
]

# the leitmotif in retrograde: D C' E G A G E, in the original rhythm
MOTIF_R = Pattern("D5:1 C6:1 E5:1.5 G5:.5 | A5:1 G5:1 E5:2")
HEAD_R = Pattern("D5:1 C6:1 E5:2")                   # its first three notes
# the same retrograde at half speed, for the last four bars
MOTIF_SLOW = Pattern("D5:2 C6:2 | E5:3 G5:1 | A5:2 G5:2 | E5:4")

# electric piano: a counter-line through the dark bars, then the one real tune
EP_DARK = ["Db5:1 C5:1 Bb4:2", "A4:1.5 G4:.5 Bb4:2", "G4:1 Bb4:1 F#5:2", "Bb4:1 A4:1 E4:2"]
EP_TUNE = ["F4:1 A4:1 D5:1.5 C5:.5", "A4:1 F4:1 G4:2", "A4:1 C5:1 F5:2!", "E5:1 D5:1 A4:1 G4:1"]


def build():
    song = Song(bpm=60, time_sig=(4, 4), seed=20260921, title="bgm_undertow")
    song.set_loop_bars(24)
    key = Scale("D", "minor")
    for name, bar in (("open", 0), ("keys", 4), ("motif", 8), ("dark", 12),
                      ("tender", 16), ("alone", 20)):
        song.marker(name, song.bar(bar))

    box = song.track("box", "music_box", volume=122, pan=0.16, reverb=90, vel=62)
    epl = song.track("ep_l", "electric_piano_1", volume=86, pan=-0.3, reverb=58, chorus=14, vel=54)
    epr = song.track("ep_r", "electric_piano_1", volume=86, pan=0.3, reverb=58, chorus=14, vel=54)
    pad = song.track("pad", "warm_pad", volume=84, pan=0.0, reverb=104, vel=46)
    sub = song.track("sub", "synth_bass_1", volume=102, pan=0.0, reverb=14, vel=62)
    stat = song.drums("static", kit="brush", volume=64, pan=-0.2, reverb=70, vel=30)

    # the two electric pianos are the same part, a seventh of a semitone apart: a slow, close beating
    epl.bend_range(2)
    epr.bend_range(2)
    epl.bend(0.0, +0.07)
    epr.bend(0.0, -0.07)
    pad.bend_range(2)
    pad.bend(0.0, -0.10)

    def ep(method, *args, **kw):
        getattr(epl, method)(*args, **kw)
        return getattr(epr, method)(*args, **kw)

    # ---- warm pad: one chord a bar, breathing in and out, never arriving ------------------------
    voicings = voice_led(CHORDS, lo="C3", hi="A4")
    i = 0
    while i < len(CHORDS):
        j = i
        while j + 1 < len(CHORDS) and CHORDS[j + 1] == CHORDS[i]:
            j += 1
        pad.chord(voicings[i], song.bar(i), song.bar(j + 1) - song.bar(i) + 0.75, vel=46)
        i = j + 1
    for a, b, lo, hi in ((0, 4, 52, 66), (4, 8, 66, 56), (8, 12, 56, 72), (12, 16, 72, 60),
                         (16, 18, 60, 90), (18, 20, 90, 66), (20, 24, 66, 52)):
        pad.expression(song.bar(a), song.bar(b), lo, hi)

    # ---- sub bass: D held for eight bars, then it starts to move --------------------------------
    for i, sym in enumerate(CHORDS):
        b = song.bar(i)
        root = bass_note(sym, 1)
        if i < 8:
            if i % 2 == 0:
                sub.note(38, b, 7.6, vel=58 if i else 52)          # D2 pedal, two bars at a time
        elif i < 20:
            sub.note(root, b, 3.4, vel=58)
            if i in (11, 15, 19):                                  # a slow step into the next chord
                nxt = bass_note(CHORDS[i + 1], 1)
                sub.note(nxt + (1 if nxt < root else -1), b + 3.4, 0.55, vel=48)
        else:
            sub.note(root, b, 3.6, vel=52 - 2 * (i - 20))
    sub.note(33, song.bar(23), 4.2, vel=50)                        # A1 under the last bar

    # ---- electric pianos: close chords, a counter-line, then the tune ---------------------------
    for i in range(4, 24):
        b = song.bar(i)
        v = CHORDS[i]
        if i < 8:                                   # arriving: one soft chord, off the downbeat
            ep("chord", v, b + 0.5, 3.2, vel=48, roll_ms=34, octave=3, voicing="shell")
        elif i < 12:                                # under the motif: two per bar, quiet
            ep("chord", v, b, 1.8, vel=46, roll_ms=26, octave=3, voicing="shell")
            ep("chord", v, b + 2.5, 1.4, vel=42, roll_ms=26, octave=3, voicing="rootless")
        elif i < 16:                                # dark: only the downbeat, let the line speak
            ep("chord", v, b, 2.2, vel=50, roll_ms=30, octave=3, voicing="shell")
        elif i < 20:                                # tender: a gentle rocking figure
            ep("chord", v, b, 1.4, vel=52, roll_ms=22, octave=3, voicing="shell")
            ep("chord", v, b + 2.0, 1.4, vel=46, roll_ms=22, octave=3, voicing="rootless")
        elif i < 22:                                # leaving
            ep("chord", v, b, 2.6, vel=42, roll_ms=30, octave=3, voicing="shell")
    t = song.bar(12)
    for src in EP_DARK:
        t = ep("play", src, at=t, vel=54, gate=0.95)
    assert t == song.bar(16)
    for k, src in enumerate(EP_TUNE):
        t = ep("play", src, at=t, vel=56 + 2 * k, gate=0.95)
    assert t == song.bar(20)
    ep("play", "A4:2 G4:2 | F4:4", at=song.bar(20), vel=46, gate=0.9)
    epl.diminuendo(song.bar(20), song.bar(22), 1.0, 0.7)
    epr.diminuendo(song.bar(20), song.bar(22), 1.0, 0.7)

    # ---- music box: the motif, backwards ---------------------------------------------------------
    box.play(MOTIF_R, at=song.bar(8), vel=64, ring=1.1)
    box.play(HEAD_R, at=song.bar(12) + 1.0, vel=58, ring=1.2)          # broken up and sequenced
    box.play(HEAD_R.shift(-1, scale=key), at=song.bar(13) + 2.0, vel=54, ring=1.2)
    box.play(HEAD_R.shift(-2, scale=key), at=song.bar(15) + 1.0, vel=50, ring=1.4)
    box.note("D5", song.bar(18) + 2.5, 1.0, vel=52)                    # one note answering the tune
    box.note("A5", song.bar(19) + 3.0, 1.0, vel=48)
    box.play(MOTIF_SLOW, at=song.bar(20), vel=60, ring=1.6)            # twice as slow, alone
    # one last D on the way out: the first note of the retrograde, handing the loop back
    box.note("D5", song.bar(23) + 3.5, 1.6, vel=58)
    box.diminuendo(song.bar(22), song.bar(23), 1.0, 0.9)

    # ---- radio static: brushed swirls at irregular places ------------------------------------------
    r = song.rng("static")
    for _ in range(11):
        at = r.uniform(0.0, song.loop_length_beats - 2.0)
        stat.hit(r.choice(["brush_swirl", "cabasa", "brush_swirl"]), at,
                 vel=r.randint(22, 38), dur=r.uniform(0.8, 2.2))
    stat.hit("brush_swirl", song.bar(23) + 2.6, vel=30, dur=1.4)

    song.humanize(timing_ms=14, velocity=5, drums_timing_ms=8)
    return song


if __name__ == "__main__":
    s = build()
    print(s.summary())
    for w in s.lint():
        print("lint:", w)
