#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""bgm_town_hush - the same town with the talk gone (Shore, tides 4-5; Ending C waking).

Not a new composition: it rebuilds bgm_harbour_row with hush=True.  Same bars, same harmony, same 96 bpm, but
the brushes are gone, the tune loses whole phrases, the finger-picking thins to two notes a bar and stops
completely in four bars, the bass keeps only its downbeats, and the glockenspiel plays the first note of each
phrase and stops - so the leitmotif in B shrinks to E-G, then silence.
"""

import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(_HERE))
sys.path.insert(0, _HERE)

import bgm_harbour_row as harbour  # noqa: E402

META = {
    "id": "bgm_town_hush",
    "loop": True,
    "lofi": 0.6,
    "crackle": 0.2,
    "space": 0.32,
    "gain_db": 0.0,
    "tail_beats": 8,
    "key": "C major",
}


def build():
    return harbour.build(hush=True)


if __name__ == "__main__":
    s = build()
    print(s.summary())
    for w in s.lint():
        print("lint:", w)
