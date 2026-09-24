#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bgm_harbour_row - the Shore town theme (tides 1-3, prologue).  Fond, grey, ambling.

C major, 96 bpm, light swing, 28 bars (70 s loop).  Two nylon guitars (tune + finger-picking),
glockenspiel, upright bass, brushes.
  A   bars 1-8    the town tune on nylon guitar; every phrase opens with a rest and the last one sinks to D
                  (the same unanswered second degree the leitmotif ends on).  Brushes enter in bar 5.
  B   bars 9-16   bars 9-10: the first four notes of "Are You Awake" (E G A G) in the glockenspiel, augmented,
                  over the motif's own Am7-Fmaj7, continued by C/E-G6; the guitar answers.  Bars 13-14 try
                  again and reach up to C over D7/F#; the guitar climbs to A5 (the one high point) on G7sus4.
  A'  bars 17-28  full band, ornamented tune, borrowed iv (Fm6) in bar 22; bars 25-28 are a thinning tag
                  on F - C/E - Dm7 - G7sus4 that leans back into bar 1.

build(hush=True) is bgm_town_hush: the very same material with parts muted (see bgm_town_hush.py):
no brushes, the glockenspiel plays only the first note of each phrase (the motif shrinks to E-G, then
silence), the tune loses whole phrases, the picking thins to two notes a bar, the bass keeps downbeats only.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import midilib  # noqa: E402
from midilib import Pattern, Song, fretted  # noqa: E402

META = {
    "id": "bgm_harbour_row",
    "loop": True,
    "lofi": 0.45,
    "crackle": 0.1,
    "gain_db": 0.0,
    "tail_beats": 8,
    "key": "C major",
    "lead": "lead",
}

BARS = 28

# one chord per half bar
CHORDS = (
    # A
    ["Cadd9", "Cadd9", "Am7", "Am7", "Fmaj7", "Fmaj7", "G6", "G6",
     "C/E", "C/E", "Fmaj7", "Fmaj7", "Dm7", "G7sus4", "Cadd9", "Gsus4"] +
    # B
    ["Am7", "Am7", "Fmaj7", "Fmaj7", "C/E", "C/E", "G6", "G6",
     "Fmaj7", "Fmaj7", "D7/F#", "D7/F#", "G7sus4", "G7sus4", "G7", "G7"] +
    # A'
    ["Cadd9", "Cadd9", "Am7", "Am7", "Fmaj7", "Fmaj7", "G6", "G6",
     "C/E", "C/E", "Fm6", "Fm6", "Dm7", "G7sus4", "Cadd9", "C/E"] +
    # tag
    ["Fmaj7", "Fmaj7", "C/E", "C/E", "Dm7", "Dm7", "G7sus4", "G7sus4"]
)
assert len(CHORDS) == BARS * 2

# ---- the tune: (bar, pattern, hush slice in beats or None = muted in the hush version) ---------------
LEAD = [
    # A
    (0, "r:.5 E4:.5 G4:.5 C5:.5 D5:1.5 E5:.5 | C5:1 A4:.5 G4:.5 A4:2", (0, 8)),
    (2, "r:.5 F4:.5 A4:.5 C5:.5 E5:1.5 D5:.5 | B4:1 G4:.5 A4:.5 B4:1 r:1", None),
    (4, "r:.5 E4:.5 G4:.5 C5:.5 G5:1.5 E5:.5 | F5:.5 E5:.5 C5:1 A4:2", (0, 4)),
    (6, "r:.5 D4:.5 F4:.5 A4:.5 C5:1 B4:.5 A4:.5 | G4:1.5 E4:.5 D4:1 r:1", (4, 8)),
    # B
    (8, "r:4 | r:2.5 C5:.5 A4:.5 F4:.5", None),
    (10, "r:.5 G4:.5 C5:.5 E5:.5 D5:1 C5:1 | B4:1.5 A4:.5 G4:2", (0, 8)),
    (12, "r:4 | r:1 F#4:.5 A4:.5 D5:1 C5:1", None),
    (14, "r:.5 D5:.5 F5:.5 A5:.5! G5:1.5 F5:.5 | E5:.5 D5:.5 B4:1 G4:1.5 r:.5", None),
    # A'
    (16, "r:.5 E4:.5 G4:.5 C5:.5 D5:1 E5:.5 G5:.5 | E5:1 C5:.5 G4:.5 A4:2", (0, 8)),
    (18, "r:.5 F4:.5 A4:.5 C5:.5 E5:1.5 D5:.5 | B4:1 G4:.5 A4:.5 B4:.5 D5:.5 r:1", None),
    (20, "r:.5 E4:.5 G4:.5 C5:.5 G5:1.5 E5:.5 | F5:.5 D5:.5 C5:1 Ab4:2", (4, 8)),
    (22, "r:.5 D4:.5 F4:.5 A4:.5 C5:1 B4:.5 A4:.5 | G4:1.5 E4:.5 D4:2", (4, 8)),
    # tag
    (24, "r:2 A4:1 C5:1 | G4:2 r:1 E4:1", None),
    (26, "F4:1 A4:1 D5:2 | r:2 G4:1 B4:1", (0, 4)),
]

# ---- glockenspiel: (bar, pattern, beats kept in the hush version) ------------------------------------
GLOCK = [
    (0, "r:.5 E5:1.5 r:2 | r:2 C6:.5 B5:.5 G5:1", 2),
    (2, "r:.5 F5:1.5 r:2 | r:3 D6:.5 B5:.5", 2),
    (4, "r:.5 E5:1.5 r:2 | r:2 E5:.5 A5:.5 C6:1", 2),
    (6, "r:.5 D5:1.5 r:2 | r:3 G5:.5 B5:.5", 2),
    (8, "E5:2 G5:2 | A5:3 G5:1", 4),              # "Wren? Are you a-" ... hush: E-G, then silence
    (12, "E5:2 G5:2 | A5:3 C6:1", 2),
    (16, "r:.5 E5:1.5 r:2 | r:2 C6:.5 B5:.5 G5:.5 E5:.5", 2),
    (18, "r:.5 F5:1.5 r:2 | r:3 D6:.5 B5:.5", 2),
    (20, "r:.5 E5:1.5 r:2 | r:2 D5:.5 F5:.5 Ab5:1", 2),
    (22, "r:.5 D5:1.5 r:2 | r:4", 2),
    (24, "r:.5 A5:1.5 r:2 | r:4", 2),
    (27, "r:2.5 G5:.5 B5:.5 D6:.5", 0),
]

BASS = (
    "C2:2 G2:1 B2:1 | A2:2 E2:1 G2:1 | F2:2 C3:1 A2:1 | G2:2 D2:1 Eb2:1 | "
    "E2:2 G2:1 E2:1 | F2:2 A2:1 E2:1 | D2:1.5 A2:.5 G2:1.5 G2:.5 | C3:1.5 G2:.5 G2:1 B2:1 | "
    "A2:3 E2:1 | F2:3 C3:1 | E2:2 G2:1 E2:1 | G2:2 B2:1 D3:1 | "
    "F2:2 C3:1 F2:1 | F#2:2 A2:1 D3:1 | G2:2 D3:1 G2:1 | G2:1.5 G2:.5 A2:1 B2:1 | "
    "C2:2 G2:1 B2:1 | A2:2 E2:1 G2:1 | F2:2 C3:1 A2:1 | G2:2 D2:1 Eb2:1 | "
    "E2:2 G2:1 E2:1 | F2:2 Ab2:1 F2:1 | D2:1.5 A2:.5 G2:1.5 G2:.5 | C3:1.5 G2:.5 E2:1 E2:1 | "
    "F2:3 C3:1 | E2:3 G2:1 | D2:2 A2:1 D3:1 | G2:2 G2:1 B2:1"
)

HUSH_GUITAR_RESTS = {9, 13, 19, 25}          # whole bars where even the picking stops


def upper(sym):
    """Top four strings of a playable guitar shape."""
    return fretted(sym, tuning=midilib.GUITAR, max_fret=5)[-4:]


def build(hush=False):
    song = Song(bpm=96, time_sig=(4, 4), seed=9603 if not hush else 9645,
                title="bgm_town_hush" if hush else "bgm_harbour_row")
    song.set_loop_bars(BARS)
    for name, b in (("A", 0), ("B", 8), ("A'", 16), ("tag", 24)):
        song.marker(name, song.bar(b))

    lead = song.track("lead", "nylon_guitar", volume=112, pan=0.18, reverb=68, chorus=6, vel=84)
    gtr = song.track("guitar", "nylon_guitar", volume=84, pan=-0.3, reverb=55, vel=58)
    glock = song.track("glock", "glockenspiel", volume=118, pan=0.34, reverb=86, vel=56)
    bass = song.track("bass", "acoustic_bass", volume=97, pan=-0.04, reverb=18, vel=80)

    # ---- tune -----------------------------------------------------------------------------------
    for bar, text, keep in LEAD:
        pat = Pattern(text)
        if not hush:
            lead.play(pat, at=song.bar(bar), ring=0.6, vel=84 if bar < 16 else 88)
        elif keep is not None:
            lead.play(pat.slice(*keep), at=song.bar(bar) + keep[0], ring=1.2, vel=70, bar_check=False)
    if not hush:
        lead.crescendo(song.bar(14), song.bar(14) + 2, 0.92, 1.1)
        lead.diminuendo(song.bar(24), song.bar(27), 0.95, 0.8)

    # ---- glockenspiel -----------------------------------------------------------------------------
    for bar, text, keep in GLOCK:
        pat = Pattern(text)
        motif = bar in (8, 12)
        if not hush:
            glock.play(pat, at=song.bar(bar), ring=0.5, vel=78 if motif else 66)
        elif keep:
            glock.play(pat.slice(0, keep), at=song.bar(bar), ring=1.0, vel=58 if motif else 52, bar_check=False)

    # ---- finger-picked guitar -------------------------------------------------------------------------
    for i, sym in enumerate(CHORDS):
        at = i * 2.0
        bar = i // 2
        up = upper(sym)
        if hush:
            if bar in HUSH_GUITAR_RESTS:
                continue
            if i % 2 == 0:
                gtr.note(up[0], at, 1.0 + 2.0, vel=54)
                gtr.note(up[2], at + 1.0, 1.0 + 2.0, vel=48)
            elif CHORDS[i - 1] != sym:
                gtr.note(up[1], at, 2.5, vel=48)
            continue
        if bar in (8, 9, 12):                                   # leave room for the glockenspiel motif
            gtr.strum(sym, at, 2.0, vel=54, direction="down", spread_ms=42, instrument="guitar")
        elif bar in (14, 15) or (16 <= bar < 24 and bar not in (20, 21)):
            gtr.strum_pattern(sym, at, "D-du", step=0.5, instrument="guitar", vel=56, spread_ms=16)
        elif bar >= 26:
            gtr.arp(up, at, 2.0, step=1.0, order=[0, 2], ring=1.5, vel=54)
        else:
            gtr.arp(up, at, 2.0, step=0.5, order=[0, 2, 1, 3], ring=1.0, vel=58, accent=8)
    if not hush:
        gtr.clear_range(song.bar(27) + 2, song.bar(28))
        gtr.strum("G7sus4", song.bar(27) + 2, 2.0, vel=56, direction="down", spread_ms=46, instrument="guitar")

    # ---- upright bass ---------------------------------------------------------------------------------
    end = bass.play(BASS, at=0.0, gate=0.92, vel=80)
    assert end == song.loop_length_beats
    if hush:
        kept = []
        for n in bass.notes:
            beat = n.start % 4.0
            two_chords = CHORDS[2 * int(n.start // 4)] != CHORDS[2 * int(n.start // 4) + 1]
            if beat == 0.0 or (two_chords and beat in (1.5, 2.0) and n.dur >= 0.9):
                n.dur = 1.6 if two_chords else 3.0
                n.vel = 66
                kept.append(n)
        bass.notes[:] = kept
    else:
        for n in bass.notes:                                    # pickups and passing notes sit back
            if n.start % 2.0 != 0.0:
                n.vel = 66
        bass.bend_range(2)
        slide = song.bar(21)                                    # one slide, into the borrowed iv
        bass.bend(slide - 0.02, -1.0)
        bass.bend_ramp(slide, slide + 0.4, -1.0, 0.0)

    # ---- brushes --------------------------------------------------------------------------------------
    if not hush:
        drums = song.drums("brushes", kit="brush", volume=108, reverb=42, vel=78)
        light = {"kick": ("x.......x.......", 60), "brush_tap": ("....x.......x..o", 80),
                 "chh": ("x.x.x.x.x.x.x.x.", 54)}
        full = {"kick": ("x.........x.....", 68), "brush_tap": ("....x..o....x.o.", 90),
                "chh": ("x.x.x.x.x.x.x.x.", 60), "ride": ("x...x...x...x...", 50)}
        drums.grid(light, start=song.bar(4), repeats=4)
        for b in range(8, 12):                                  # B opens with swirls only
            drums.hit("brush_swirl", song.bar(b), vel=86, dur=2.0)
            drums.hit("brush_swirl", song.bar(b) + 2, vel=74, dur=2.0)
            drums.hit("kick", song.bar(b), vel=54)
        drums.grid(light, start=song.bar(12), repeats=3)
        drums.grid({"kick": ("x.......x.......", 64), "brush_tap": ("....x.....x.x.xx", 88),
                    "chh": ("x.x.x.x.x.x.....", 56)}, start=song.bar(15), repeats=1)
        drums.hit("triangle", song.bar(16), vel=52, dur=1.0)
        drums.grid(full, start=song.bar(16), repeats=8)
        drums.grid(light, start=song.bar(24), repeats=3)
        drums.grid({"kick": ("x...............", 58), "brush_tap": ("....x...........", 76),
                    "chh": ("x.x.x.x.........", 50)}, start=song.bar(27), repeats=1)
        drums.hit("brush_swirl", song.bar(27) + 2, vel=92, dur=2.0)

    song.swing(0.56, grid=0.5)
    song.humanize(timing_ms=14 if hush else 9, velocity=7 if hush else 6, drums_timing_ms=4)
    return song


if __name__ == "__main__":
    s = build()
    print(s.summary())
    for w in s.lint():
        print("lint:", w)
