#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bgm_battle - "Rattle Your Pockets".

Regular-battle theme.  138 BPM, G major, 4/4, 36 bars (~62 s).  Bouncy and cheeky: everything hangs
off one eighth-note bass riff (root - fifth - octave - chromatic approach to the next root) so the
groove never stops walking, a toy square lead carries the tune, marimba answers on the off-beats and
the glockenspiel throws confetti at the ends of phrases.

Form: intro 2 | A 8 | A' 8 (borrowed iv, Cm6) | B 8 | A'' 8 | turnaround 2.
Leitmotif: the first four notes of "Are You Awake" (degrees 3-5-6-5 = B D E D in G) are the B-section
hook, stated twice plain and then chopped into a two-beat fragment that drives back into A''.

Render:  python3 tools/music/render.py tools/music/tracks/bgm_battle.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from midilib import Pattern, Scale, Song, bass_note, chord  # noqa: E402

META = {
    "id": "bgm_battle",
    "loop": True,
    "lofi": 0.2,
    "gain_db": 0.0,
    "tail_beats": 8,
    "key": "G major",
    "lead": "lead",
    "volume": 0.85,
    "space": 0.12,
    # FluidR3's synth-lead presets carry a built-in chorus send; the renderer's default
    # chorus is wide enough to invert the stereo image, so keep it to a trace here.
    "chorus": {"level": 0.12, "depth": 2.0, "nr": 2},
}

INTRO = ["G6", "G6"]
A = ["G6", "Em7", "Cmaj9", "Am7", "D7sus4", "Bm7", "C6", "D7"]
A2 = ["G6", "Em7", "Cmaj9", "Am7", "D7sus4", "Bm7", "Cm6", "D7"]
B = ["Em9", "Em9", "C6", "Bm7", "Am7", "F6", "D7sus4", "D7"]
TURN = ["D7sus4", "D7"]
CHORDS = INTRO + A + A2 + B + A + TURN          # 36 bars, one chord per bar


def build():
    song = Song(bpm=138, time_sig=(4, 4), seed=1381, title="bgm_battle")
    song.set_loop_bars(36)
    key = Scale("G", "major")
    for name, bar in (("intro", 0), ("A", 2), ("A'", 10), ("B", 18), ("A''", 26), ("turn", 34)):
        song.marker(name, song.bar(bar))

    # ---- bass: the riff everything else is glued to -------------------------------------------
    bass = song.track("bass", "fingered_bass", volume=106, pan=0.0, reverb=10, vel=92)
    roots = [bass_note(s, 2) for s in CHORDS]
    for i, sym in enumerate(CHORDS):
        t = song.bar(i)
        r = roots[i]
        nxt = roots[(i + 1) % len(roots)]
        fifth = r + 7
        # chromatic (or diatonic, when the roots already touch) approach into the next downbeat
        if nxt == r:
            app = r + 2 if r + 2 <= 50 else r - 2
        else:
            app = nxt - 1 if nxt > r else nxt + 1
        bass.note(r, t + 0.0, 0.45, vel=90)
        bass.note(r, t + 1.0, 0.45, vel=76)
        bass.note(fifth, t + 1.5, 0.45, vel=80)
        bass.note(r, t + 2.0, 0.45, vel=84)
        bass.note(r + 12, t + 2.5, 0.45, vel=74)
        bass.note(fifth, t + 3.0, 0.45, vel=72)
        bass.note(app, t + 3.5, 0.45, vel=82)
    # B section leans harder: drop the octave hop for a stubborn low pulse in bars 22-25
    for i in range(22, 26):
        bass.clear_range(song.bar(i) + 2.4, song.bar(i) + 2.9)
        bass.note(roots[i], song.bar(i) + 2.5, 0.45, vel=78)
    bass.bend_range(2)
    bass.bend(song.bar(26) - 0.06, -1.0)
    bass.bend_ramp(song.bar(26), song.bar(26) + 0.35, -1.0, 0.0)       # slide into the return

    # ---- square lead: the tune ------------------------------------------------------------------
    lead = song.track("lead", "square_lead", volume=120, pan=0.16, reverb=26, vel=80)
    # the same tune an octave down on marimba: a toy-band unison that keeps the square honest
    toy = song.track("toy", "marimba", volume=100, pan=-0.12, reverb=26, vel=72)
    motif = Pattern("5:.5 1':.5 -:.5 6:.5 5:.5 3:.5 5:1 | 6:.5 5:.5 3:.5 2:.5 3:1.5 r:.5")
    answer = motif.shift(+1, scale=key)
    vary = motif.shift(-1, scale=key)
    cadence = Pattern("6:.5 1':.5 2':1 1':.5 6:.5 5:1 | 6:.5 5:.5 3:.5 2:.5 1:1.5 r:.5")

    def tune(bar, last, vel=None, double=False):
        t = song.bar(bar)
        for ph in (motif, answer, vary, last):
            lead.play(ph, at=t, scale=key, octave=4, gate=0.92, vel=vel)
            if double:
                toy.play(ph, at=t, scale=key, octave=3, gate=0.95, vel=(vel or 72) - 4)
            t += ph.length
        return t

    tune(2, cadence)                                                   # A: square alone
    # A': the tail is re-pointed - it climbs to the borrowed iv instead of settling
    cadence2 = Pattern("1':.5 2':.5 1':1 b6:.5 5:.5 3:1 | 6:.5 5:.5 4:1 2:1.5 r:.5")
    tune(10, cadence2, vel=78, double=True)

    # B: the leitmotif's first four notes as the hook (3 5 6 5 = B D E D in G)
    hook = Pattern("3:1 5:1 6:1.5 5:.5 | 3:1 5:.5 3:.5 2:2")
    hook2 = (hook.shift(+2, scale=key).slice(0, 4) + Pattern("1':1 7:.5 6:.5 5:1 3:1"))
    t = lead.play(hook, at=song.bar(18), scale=key, octave=4, gate=0.9, vel=80)
    t = lead.play(hook2, at=t, scale=key, octave=4, gate=0.9, vel=80)
    toy.play(hook, at=song.bar(18), scale=key, octave=3, gate=0.95, vel=74)
    toy.play(hook2, at=song.bar(20), scale=key, octave=3, gate=0.95, vel=74)
    frag = Pattern("3:.5 5:.5 6:.5 5:.5")
    for k in range(4):                                                 # chopped, sequenced, insistent
        lead.play(frag.shift(k % 2, scale=key), at=song.bar(22 + k), scale=key, octave=4,
                  gate=0.85, vel=76 + 3 * k)
        if k < 3:
            lead.play(frag.shift(-1 + k % 2, scale=key), at=song.bar(22 + k) + 2, scale=key,
                      octave=4, gate=0.85, vel=74 + 3 * k)
    lead.play("5:.5 6:.5 1':.5 2':.5", at=song.bar(25) + 2, scale=key, octave=4, vel=86)

    # A'': the high point, then the lead steps aside for the turnaround
    tune(26, Pattern("6:.5 1':.5 3':2! 2':.5 1':.5 | 6:.5 5:.5 3:.5 5:.5 6:1.5 r:.5"),
         vel=84, double=True)
    lead.play("5:.5 6:.5 5:1 r:2 | r:2 5:.5 6:.5 7:1", at=song.bar(34), scale=key, octave=4, vel=70)
    lead.crescendo(song.bar(24), song.bar(26), 0.9, 1.1)

    # ---- marimba: off-beat comping, the cheeky half of the groove -------------------------------
    mar = song.track("marimba", "marimba", volume=98, pan=-0.32, reverb=30, vel=68)
    for i, sym in enumerate(CHORDS):
        t = song.bar(i)
        if i < 2:
            continue
        if 18 <= i < 26:                                               # B: running eighths, thinner
            mar.arp(sym, t, 4.0, step=0.5, order="updown", octave=3, vel=58, accent=10, note_dur=0.45)
        else:
            for off in (0.5, 1.5, 2.5, 3.5):
                mar.chord(sym, t + off, 0.4, vel=60 if off in (0.5, 2.5) else 66,
                          octave=3, voicing="shell", top_accent=4)
    mar.clear_range(song.bar(34), song.bar(36))
    for off in (0.0, 1.0, 2.0, 2.5, 3.0):
        mar.chord("D7sus4", song.bar(34) + off, 0.4, vel=62, octave=3, voicing="shell")
    mar.chord("D7", song.bar(35) + 2, 0.4, vel=66, octave=3, voicing="shell")
    mar.chord("D7", song.bar(35) + 3, 0.9, vel=72, octave=3, voicing="shell")

    # ---- glockenspiel: punctuation and the doubled hook ------------------------------------------
    glk = song.track("glock", "glockenspiel", volume=124, pan=0.32, reverb=58, vel=60)
    for bar in (5, 9, 13, 17, 29, 33):
        glk.play("1':.5 2':.5 3':1", at=song.bar(bar) + 2, scale=key, octave=5, ring=1.0, vel=52)
    glk.play(Pattern("3:1 5:1 6:1.5 5:.5"), at=song.bar(18), scale=key, octave=5, ring=0.8, vel=56)
    glk.play(Pattern("3:1 5:1 6:1.5 5:.5").shift(+2, scale=key), at=song.bar(20), scale=key,
             octave=5, ring=0.8, vel=54)
    for bar in (26, 28, 30):
        glk.play("5:1", at=song.bar(bar), scale=key, octave=5, ring=1.4, vel=58)
    glk.note(chord("D7", octave=5)[0] + 12, song.bar(35) + 3.5, 0.5, vel=60)

    # ---- kit ---------------------------------------------------------------------------------------
    d = song.drums("kit", kit="room", volume=98, reverb=26, vel=82)
    groove = {"kick":  ("x.....x.x.......", 74),
              "snare": ("....x.......x...", 96),
              "chh":   ("x.x.x.x.x.x.x.x.", 62)}
    groove_open = dict(groove, ohh=("..............x.", 70))
    fill_a = {"kick": ("x.......x.......", 74), "snare": ("....x...x.x.x.x.", 96),
              "tom_mid_hi": ("..........x.....", 84), "tom_lo": ("..............x.", 88)}
    d.grid({"chh": ("x.x.xxx.x.x.xxx.", 58)}, start=song.bar(0), repeats=1)
    d.grid({"chh": ("x.x.x.x.x.x.x.x.", 58), "snare": ("............x.x.", 78)},
           start=song.bar(1), repeats=1)
    for bar in list(range(2, 18)) + list(range(26, 34)):
        if bar % 8 == 1:
            d.grid(fill_a, start=song.bar(bar), repeats=1)
        else:
            d.grid(groove_open if bar % 4 == 3 else groove, start=song.bar(bar), repeats=1)
    for bar in range(18, 26):                                          # B: ride, no open hat
        d.grid({"kick": ("x...x...x.x.....", 72), "snare": ("....x.......x...", 92),
                "ride": ("x.x.x.x.x.x.x.x.", 56)}, start=song.bar(bar), repeats=1)
    d.hit("crash", song.bar(18), vel=88)
    d.hit("crash", song.bar(26), vel=92)
    d.grid({"tom_mid_hi": ("x.x.....x.......", 80), "tom_lo": ("....x.x.....x.x.", 84),
            "kick": ("x.......x.......", 74)}, start=song.bar(25), repeats=1)
    d.grid({"kick": ("x.......x.......", 74), "chh": ("x.x.x.x.x.x.x.x.", 58),
            "snare": ("....x.......x...", 90)}, start=song.bar(34), repeats=1)
    d.grid({"kick": ("x.......x.......", 74), "snare": ("....x...x.x.xxx.", 94),
            "tambourine": ("x.......x.......", 62)}, start=song.bar(35), repeats=1)

    song.swing(0.55, grid=0.5)
    song.humanize(timing_ms=7, velocity=6, drums_timing_ms=3)
    return song


if __name__ == "__main__":
    s = build()
    print(s.summary())
    for w in s.lint():
        print("lint:", w)
