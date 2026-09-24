#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""midilib - dependency-free Standard MIDI File (format 1) writer and composing helpers.

Written for this project's soundtrack pipeline (see tools/music/README.md for the composer's
guide).  Pure standard library, deterministic (every random choice comes from a seeded RNG).

Conventions
-----------
* Time is measured in BEATS = quarter notes, as floats.  Beat 0.0 is the start of the song.
  In 4/4 a bar is 4 beats, in 3/4 it is 3 beats, in 6/8 it is 3 beats (six eighths).
* Pitches are MIDI numbers (C4 = 60) or note names: "C4", "F#3", "Bb5", "C-1".
* Velocities are 1..127 (clamped).  Durations must be > 0 (ValueError otherwise).
* Channels are handled for you.  Drums live on MIDI channel 10 (``Song.drums()``).

Quick example
-------------
    from midilib import Song, Scale, Pattern, voice_led

    song = Song(bpm=84, time_sig=(4, 4), seed=7)
    song.set_loop_bars(8)
    box = song.track("box", "music_box", volume=104, pan=0.15, reverb=80)
    box.play("E5:1 G5:.5 A5:.5 r:1 C6:2 | B5:1 G5:1 E5:2", at=0, vel=84, ring=1.0)
    pno = song.track("piano", "piano", volume=84, reverb=60)
    for i, v in enumerate(voice_led(["Cmaj7", "Am7", "Fmaj7", "G7sus4"])):
        pno.chord(v, song.bar(i), 4, vel=56)
    song.humanize(timing_ms=8, velocity=6)
    song.save("/tmp/demo.mid")

Run ``python3 midilib.py`` to execute the built-in self test.
"""

from __future__ import annotations

import itertools
import math
import random
import re
import struct
from functools import lru_cache

__all__ = [
    "Song", "Track", "DrumTrack", "Pattern", "Scale", "Note",
    "pitch", "pitch_class", "note_name", "scale", "SCALES",
    "parse_chord", "chord", "chord_pcs", "bass_note", "voice_lead", "voice_led", "fretted",
    "GM", "GM_NAMES", "gm_program", "DRUMS", "DRUM_KITS", "UKULELE", "GUITAR",
    "RANGE_HINTS", "parse_duration", "read_midi_summary",
]

# --------------------------------------------------------------------------------------
# Pitch helpers
# --------------------------------------------------------------------------------------

_NOTE_BASE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
_SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
_FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
_NOTE_RE = re.compile(r"^([A-G])([#b♯♭]*)(-?\d+)$")
_PC_RE = re.compile(r"^([A-G])([#b♯♭]*)$")


def _acc_value(acc):
    """Semitone offset of an accidental string such as '#', 'bb'."""
    total = 0
    for ch in acc:
        total += 1 if ch in "#♯" else -1
    return total


def pitch(p):
    """Convert a note name ("C4", "F#3", "Bb5") or a number to a MIDI pitch (C4 = 60).

    Raises ValueError for anything outside 0..127 or unparsable.
    """
    if isinstance(p, bool):
        raise ValueError("pitch must be a note name or an int, got bool")
    if isinstance(p, str):
        m = _NOTE_RE.match(p.strip())
        if not m:
            raise ValueError("cannot parse note name %r (expected an upper-case letter, optional #/b and an "
                             "octave, like 'C4', 'F#3', 'Bb5')" % (p,))
        value = 12 * (int(m.group(3)) + 1) + _NOTE_BASE[m.group(1)] + _acc_value(m.group(2))
    else:
        try:
            f = float(p)
        except (TypeError, ValueError):
            raise ValueError("cannot interpret %r as a pitch" % (p,))
        if f != int(f):
            raise ValueError("pitch must be a whole number, got %r" % (p,))
        value = int(f)
    if not 0 <= value <= 127:
        raise ValueError("pitch %r -> %d is outside the MIDI range 0..127" % (p, value))
    return value


def pitch_class(name):
    """Pitch class 0..11 of a note name without octave ("F#", "Bb") or of any pitch/int."""
    if isinstance(name, str):
        m = _PC_RE.match(name.strip())
        if m:
            return (_NOTE_BASE[m.group(1)] + _acc_value(m.group(2))) % 12
        return pitch(name) % 12
    return int(name) % 12


def note_name(num, flats=False):
    """MIDI number -> name, e.g. 60 -> 'C4'."""
    num = int(num)
    names = _FLAT_NAMES if flats else _SHARP_NAMES
    return "%s%d" % (names[num % 12], num // 12 - 1)


# --------------------------------------------------------------------------------------
# Scales and modes
# --------------------------------------------------------------------------------------

SCALES = {
    "major": (0, 2, 4, 5, 7, 9, 11),
    "ionian": (0, 2, 4, 5, 7, 9, 11),
    "dorian": (0, 2, 3, 5, 7, 9, 10),
    "phrygian": (0, 1, 3, 5, 7, 8, 10),
    "lydian": (0, 2, 4, 6, 7, 9, 11),
    "mixolydian": (0, 2, 4, 5, 7, 9, 10),
    "minor": (0, 2, 3, 5, 7, 8, 10),
    "aeolian": (0, 2, 3, 5, 7, 8, 10),
    "natural_minor": (0, 2, 3, 5, 7, 8, 10),
    "locrian": (0, 1, 3, 5, 6, 8, 10),
    "harmonic_minor": (0, 2, 3, 5, 7, 8, 11),
    "melodic_minor": (0, 2, 3, 5, 7, 9, 11),
    "major_pentatonic": (0, 2, 4, 7, 9),
    "minor_pentatonic": (0, 3, 5, 7, 10),
    "blues": (0, 3, 5, 6, 7, 10),
    "whole_tone": (0, 2, 4, 6, 8, 10),
    "chromatic": tuple(range(12)),
    "octatonic_wh": (0, 2, 3, 5, 6, 8, 9, 11),
    "octatonic_hw": (0, 1, 3, 4, 6, 7, 9, 10),
    "hirajoshi": (0, 2, 3, 7, 8),
    "in_sen": (0, 1, 5, 7, 10),
    "hungarian_minor": (0, 2, 3, 6, 7, 8, 11),
    "phrygian_dominant": (0, 1, 4, 5, 7, 8, 10),
    "lydian_dominant": (0, 2, 4, 6, 7, 9, 10),
}


class Scale:
    """A root + mode.  Degrees are 1-based; degree 8 is the octave, degree 0 the step below 1.

        s = Scale("A", "minor")
        s.degree(1, octave=4)   -> 69 (A4)
        s.degree(3, octave=4)   -> 72 (C5)
        s.degree(5, octave=4, alter=-1)  -> flat fifth
        s.chord(5, size=4)      -> diatonic seventh chord on degree 5 as MIDI pitches
        s.snap(61)              -> nearest scale pitch
        s.step(64, +2)          -> two scale steps above E4
    """

    def __init__(self, root, mode="major"):
        self.root_pc = pitch_class(root)
        self.root_name = root if isinstance(root, str) else _SHARP_NAMES[self.root_pc]
        key = str(mode).lower().replace(" ", "_").replace("-", "_")
        if key not in SCALES:
            raise ValueError("unknown scale/mode %r; known: %s" % (mode, ", ".join(sorted(SCALES))))
        self.mode = key
        self.intervals = SCALES[key]

    def __repr__(self):
        return "Scale(%r, %r)" % (self.root_name, self.mode)

    def __len__(self):
        return len(self.intervals)

    def degree(self, d, octave=4, alter=0):
        """MIDI pitch of scale degree ``d`` (1-based, may exceed the scale size or be <= 0)."""
        d = int(d)
        shift, idx = divmod(d - 1, len(self.intervals))
        value = 12 * (int(octave) + 1) + self.root_pc + 12 * shift + self.intervals[idx] + int(alter)
        if not 0 <= value <= 127:
            raise ValueError("degree %d at octave %d -> pitch %d outside 0..127" % (d, octave, value))
        return value

    def pcs(self):
        """Set of pitch classes in the scale."""
        return {(self.root_pc + iv) % 12 for iv in self.intervals}

    def contains(self, p):
        return pitch(p) % 12 in self.pcs()

    def pitches(self, lo="C0", hi="C8"):
        """All scale pitches between lo and hi (inclusive), ascending."""
        lo, hi = pitch(lo), pitch(hi)
        pcs = self.pcs()
        return [p for p in range(lo, hi + 1) if p % 12 in pcs]

    def snap(self, p):
        """Nearest scale pitch (ties resolve downward)."""
        p = pitch(p)
        pcs = self.pcs()
        for dist in range(0, 7):
            if (p - dist) % 12 in pcs and p - dist >= 0:
                return p - dist
            if (p + dist) % 12 in pcs and p + dist <= 127:
                return p + dist
        return p

    def step(self, p, steps):
        """Move ``p`` (snapped into the scale) by a number of scale steps."""
        p = self.snap(p)
        ladder = self.pitches(0, 127)
        i = ladder.index(p) + int(steps)
        if not 0 <= i < len(ladder):
            raise ValueError("scale step leaves the MIDI range")
        return ladder[i]

    def chord(self, degree, size=3, octave=4):
        """Diatonic chord built in thirds on a degree: size 3 = triad, 4 = seventh, 5 = ninth."""
        return [self.degree(degree + 2 * k, octave) for k in range(size)]


def scale(root, mode="major", octave=4, octaves=1):
    """List of MIDI pitches of a scale, ascending, including the top octave note."""
    s = Scale(root, mode)
    n = len(s.intervals) * int(octaves) + 1
    return [s.degree(d, octave) for d in range(1, n + 1)]


# --------------------------------------------------------------------------------------
# Chord symbols
# --------------------------------------------------------------------------------------

_CHORD_ROOT_RE = re.compile(r"^([A-G])([#b♯♭]*)")
_CHORD_TOK_RE = re.compile(
    r"mMaj|mmaj|minmaj|mM|maj|Maj|MAJ|M|Δ|min|m|-|dim|no|°|o|ø|aug|\+|sus2|sus4|sus|add|"
    r"b|#|♭|♯|\d+"
)


class ChordSpec(tuple):
    """(root_pc, intervals, bass_pc, symbol) - result of parse_chord()."""

    __slots__ = ()

    def __new__(cls, root_pc, intervals, bass_pc, symbol):
        return tuple.__new__(cls, (root_pc, tuple(intervals), bass_pc, symbol))

    root_pc = property(lambda self: self[0])
    intervals = property(lambda self: self[1])
    bass_pc = property(lambda self: self[2])
    symbol = property(lambda self: self[3])


@lru_cache(maxsize=512)
def parse_chord(sym):
    """Parse a chord symbol into a ChordSpec(root_pc, intervals, bass_pc, symbol).

    Understands e.g. C, Cm, C-, Cdim, Caug, C+, C5, C6, Cm6, C69, C7, Cmaj7, CM7, Cm7, CmMaj7,
    Cdim7, Cm7b5, C9, Cmaj9, Cm9, C11, Cm11, C13, Cadd9, Cmadd9, Csus2, Csus4, C7sus4, C7b9, C7#9,
    C7#5, Cmaj7#11, C7b13, Cno3 and slash chords such as F/A or Dm7/G.
    """
    if not isinstance(sym, str) or not sym.strip():
        raise ValueError("chord symbol must be a non-empty string, got %r" % (sym,))
    s = sym.strip()
    m = _CHORD_ROOT_RE.match(s)
    if not m:
        raise ValueError("chord symbol %r must start with a note letter A-G" % (sym,))
    root_pc = (_NOTE_BASE[m.group(1)] + _acc_value(m.group(2))) % 12
    rest = s[m.end():]
    bass_pc = None
    if "/" in rest:
        head, _, tail = rest.rpartition("/")
        if _PC_RE.match(tail):
            bass_pc = pitch_class(tail)
            rest = head
    rest = rest.replace("(", "").replace(")", "").replace(" ", "").replace(",", "").replace("6/9", "69")

    toks = []
    pos = 0
    while pos < len(rest):
        tm = _CHORD_TOK_RE.match(rest, pos)
        if not tm:
            raise ValueError("cannot parse chord symbol %r near %r" % (sym, rest[pos:]))
        toks.append(tm.group(0))
        pos = tm.end()

    third, fifth, seventh = 4, 7, None
    extra = set()
    omit = set()
    maj_flag = False
    dim_flag = False
    add_map = {2: 14, 4: 17, 6: 9, 9: 14, 11: 17, 13: 21}

    def need_number(i):
        if i + 1 >= len(toks) or not toks[i + 1].isdigit():
            raise ValueError("chord symbol %r: %r must be followed by a number" % (sym, toks[i]))
        return int(toks[i + 1])

    def plain_seventh():
        return 11 if maj_flag else (9 if dim_flag else 10)

    i = 0
    while i < len(toks):
        t = toks[i]
        if t in ("mMaj", "mmaj", "minmaj", "mM"):
            third, maj_flag = 3, True
        elif t in ("maj", "Maj", "MAJ", "M", "Δ"):
            maj_flag = True
        elif t in ("min", "m", "-"):
            third = 3
        elif t in ("dim", "°", "o"):
            third, fifth, dim_flag = 3, 6, True
        elif t == "ø":
            third, fifth, seventh = 3, 6, 10
        elif t in ("aug", "+"):
            fifth = 8
        elif t == "sus2":
            third = 2
        elif t in ("sus4", "sus"):
            third = 5
        elif t == "add":
            n = need_number(i)
            i += 1
            if n not in add_map:
                raise ValueError("chord symbol %r: unsupported add%d" % (sym, n))
            extra.add(add_map[n])
        elif t == "no":
            n = need_number(i)
            i += 1
            omit.add(n)
        elif t in ("b", "#", "♭", "♯"):
            n = need_number(i)
            i += 1
            d = -1 if t in ("b", "♭") else 1
            if n == 5:
                fifth = 7 + d
            elif n == 9:
                extra.discard(14)
                extra.add(14 + d)
            elif n == 11:
                extra.discard(17)
                extra.add(17 + d)
            elif n == 13:
                extra.discard(21)
                extra.add(21 + d)
            else:
                raise ValueError("chord symbol %r: unsupported alteration %s%d" % (sym, t, n))
        elif t.isdigit():
            n = int(t)
            if n == 5:
                third = None
            elif n == 6:
                extra.add(9)
            elif n == 69:
                extra.update((9, 14))
            elif n == 7:
                seventh = plain_seventh()
            elif n == 9:
                seventh = plain_seventh()
                extra.add(14)
            elif n == 11:
                seventh = plain_seventh()
                extra.update((14, 17))
            elif n == 13:
                seventh = plain_seventh()
                extra.update((14, 21))
            elif n == 2:
                extra.add(14)
            elif n == 4:
                third = 5
            else:
                raise ValueError("chord symbol %r: unsupported number %d" % (sym, n))
        i += 1

    ivs = {0}
    if third is not None and 3 not in omit:
        ivs.add(third)
    if 5 not in omit:
        ivs.add(fifth)
    if seventh is not None:
        ivs.add(seventh)
    ivs.update(extra)
    return ChordSpec(root_pc, sorted(ivs), bass_pc, s)


def chord_pcs(sym):
    """Set of pitch classes of a chord symbol (slash bass included)."""
    spec = parse_chord(sym)
    pcs = {(spec.root_pc + iv) % 12 for iv in spec.intervals}
    if spec.bass_pc is not None:
        pcs.add(spec.bass_pc)
    return pcs


def _check_pitches(pitches, what):
    for p in pitches:
        if not 0 <= p <= 127:
            raise ValueError("%s produces pitch %d outside 0..127" % (what, p))
    return pitches


def chord(sym, octave=4, inversion=0, voicing="close", bass=None):
    """Chord symbol -> list of MIDI pitches (ascending).

    octave     octave of the root (C4 = 60).
    inversion  0 = root position, 1 = first inversion ... (negative moves top notes down).
    voicing    'close'    stacked as written (extensions above the seventh)
               'open'     every second note raised an octave (R-5-10 style; warm piano/pad voicing)
               'drop2'    second note from the top dropped an octave (needs >= 4 notes)
               'shell'    root + third + seventh (root + third for triads)
               'rootless' everything but the root
               'spread'   root dropped an octave, rest close
    bass       None  = add the slash bass below the voicing when the symbol has one ("F/A")
               True  = always add a bass note (slash bass or root) one octave below
               False = never add a bass note
    """
    spec = parse_chord(sym)
    root = 12 * (int(octave) + 1) + spec.root_pc
    notes = [root + iv for iv in spec.intervals]
    v = str(voicing).lower()
    if v == "close":
        pass
    elif v == "open":
        notes = sorted(p + 12 if i % 2 == 1 else p for i, p in enumerate(notes))
    elif v == "drop2":
        if len(notes) >= 4:
            notes = sorted(notes[:-2] + [notes[-2] - 12] + notes[-1:])
    elif v == "shell":
        ivs = spec.intervals
        keep = [0]
        keep += [iv for iv in ivs if iv in (2, 3, 4, 5)][:1]
        keep += [iv for iv in ivs if iv in (9, 10, 11)][:1]
        notes = [root + iv for iv in keep]
    elif v == "rootless":
        if len(notes) > 2:
            notes = notes[1:]
    elif v == "spread":
        notes = sorted([notes[0] - 12] + notes[1:])
    else:
        raise ValueError("unknown voicing %r (close, open, drop2, shell, rootless, spread)" % (voicing,))

    inv = int(inversion)
    for _ in range(abs(inv)):
        if inv > 0:
            notes = sorted(notes[1:] + [notes[0] + 12])
        else:
            notes = sorted([notes[-1] - 12] + notes[:-1])

    if bass is None:
        bass = spec.bass_pc is not None
    if bass:
        bpc = spec.bass_pc if spec.bass_pc is not None else spec.root_pc
        b = notes[0] - 1
        while b % 12 != bpc:
            b -= 1
        if notes[0] - b < 5:
            b -= 12
        notes = [p for p in notes if not (p % 12 == bpc and p - b <= 12 and len(notes) > 3)]
        notes = [b] + notes
    return _check_pitches(sorted(set(notes)), "chord(%r)" % (sym,))


def bass_note(sym, octave=2):
    """The bass pitch of a chord symbol (slash bass if present, else the root) in an octave."""
    spec = parse_chord(sym)
    pc = spec.bass_pc if spec.bass_pc is not None else spec.root_pc
    return _check_pitches([12 * (int(octave) + 1) + pc], "bass_note(%r)" % (sym,))[0]


def _resolve_pitches(x, octave=4, inversion=0, voicing="close"):
    """A STRING is always a chord symbol ("C7" is the dominant seventh chord, never the note C7);
    single notes and custom voicings are given as a list: ["C7"], ["C3", "G3", "E4"] or MIDI numbers."""
    if isinstance(x, str):
        return chord(x, octave=octave, inversion=inversion, voicing=voicing)
    if isinstance(x, (int, float)):
        return [pitch(x)]
    out = [pitch(p) for p in x]
    if not out:
        raise ValueError("empty pitch list")
    return out


def voice_lead(prev, sym, lo=52, hi=84):
    """Voicing of ``sym`` (close position, any inversion/octave inside lo..hi) that moves the
    least from the previous voicing ``prev`` (list of pitches, or None for a centred start)."""
    lo, hi = pitch(lo), pitch(hi)
    spec = parse_chord(sym)
    pcs = []
    for iv in spec.intervals:
        pc = (spec.root_pc + iv) % 12
        if pc not in pcs:
            pcs.append(pc)
    cands = []
    n = len(pcs)
    for rot in range(n):
        order = pcs[rot:] + pcs[:rot]
        for base in range(lo, hi + 1):
            if base % 12 != order[0]:
                continue
            notes = [base]
            for pc in order[1:]:
                nxt = notes[-1] + 1
                while nxt % 12 != pc:
                    nxt += 1
                notes.append(nxt)
            if notes[-1] <= hi:
                cands.append(notes)
    if not cands:
        raise ValueError("voice_lead(%r): no voicing fits the range %d..%d" % (sym, lo, hi))
    if prev:
        prev = [pitch(p) for p in prev]

        def cost(c):
            a = sum(min(abs(x - y) for y in prev) for x in c)
            b = sum(min(abs(x - y) for y in c) for x in prev)
            return (a + b, c[-1] - c[0], abs(c[0] - prev[0]))
    else:
        mid = (lo + hi) / 2.0

        def cost(c):
            return (abs(sum(c) / len(c) - mid) + (0 if c[0] % 12 == spec.root_pc else 3), c[-1] - c[0], c[0])
    return min(cands, key=cost)


def voice_led(symbols, lo=52, hi=84, first=None):
    """Voice-lead a whole progression: list of chord symbols -> list of voicings."""
    out = []
    prev = first
    for sym in symbols:
        v = voice_lead(prev, sym, lo, hi)
        out.append(v)
        prev = v
    return out


UKULELE = ("G4", "C4", "E4", "A4")           # re-entrant tuning, physical string order
GUITAR = ("E2", "A2", "D3", "G3", "B3", "E4")


@lru_cache(maxsize=512)
def _fretted_cached(sym, tuning, max_fret):
    spec = parse_chord(sym)
    pcs = [(spec.root_pc + iv) % 12 for iv in spec.intervals]
    pcset = set(pcs)
    want_bass = spec.bass_pc if spec.bass_pc is not None else spec.root_pc
    if spec.bass_pc is not None:
        pcset.add(spec.bass_pc)
    important = {spec.root_pc}
    for iv in spec.intervals:
        if iv in (2, 3, 4, 5, 9, 10, 11):
            important.add((spec.root_pc + iv) % 12)
    opens = [pitch(s) for s in tuning]
    n = len(opens)
    per_string = []
    for si, op in enumerate(opens):
        opts = [f for f in range(0, max_fret + 1) if (op + f) % 12 in pcset]
        if n > 4 and si < 2:
            opts = opts + [None]          # the two lowest guitar strings may stay silent
        if not opts:
            opts = [None]
        per_string.append(opts)
    best, best_score = None, None
    for combo in itertools.product(*per_string):
        sounding = [(opens[i] + f) for i, f in enumerate(combo) if f is not None]
        if len(sounding) < min(3, n):
            continue
        if n > 4:
            muted = [f is None for f in combo]
            if muted[1] and not muted[0]:
                continue
        covered = {p % 12 for p in sounding}
        frets = [f for f in combo if f]
        span = (max(frets) - min(frets)) if frets else 0
        score = 0.0
        score += 40 * len(important - covered) + 12 * len(pcset - covered)
        score += 6 * max(0, span - 3) + 0.5 * sum(frets)
        if n > 4 and min(sounding) % 12 != want_bass:
            score += 9
        score += 2 * sum(1 for f in combo if f is None)
        if best_score is None or score < best_score:
            best, best_score = combo, score
    if best is None:
        raise ValueError("fretted(%r): no playable shape found" % (sym,))
    return tuple(opens[i] + f for i, f in enumerate(best) if f is not None)


def fretted(sym, tuning=UKULELE, max_fret=5):
    """A playable fretboard voicing of a chord symbol in PHYSICAL string order (low string first;
    a ukulele's re-entrant G string therefore comes first although it sounds high).
    Use with Track.strum(..., instrument='ukulele'|'guitar')."""
    return list(_fretted_cached(sym, tuple(tuning), int(max_fret)))


# --------------------------------------------------------------------------------------
# General MIDI tables
# --------------------------------------------------------------------------------------

GM_NAMES = [
    "acoustic_grand_piano", "bright_acoustic_piano", "electric_grand_piano", "honky_tonk_piano",
    "electric_piano_1", "electric_piano_2", "harpsichord", "clavinet",
    "celesta", "glockenspiel", "music_box", "vibraphone", "marimba", "xylophone", "tubular_bells", "dulcimer",
    "drawbar_organ", "percussive_organ", "rock_organ", "church_organ", "reed_organ", "accordion",
    "harmonica", "tango_accordion",
    "nylon_guitar", "steel_guitar", "jazz_guitar", "clean_guitar", "muted_guitar", "overdriven_guitar",
    "distortion_guitar", "guitar_harmonics",
    "acoustic_bass", "fingered_bass", "picked_bass", "fretless_bass", "slap_bass_1", "slap_bass_2",
    "synth_bass_1", "synth_bass_2",
    "violin", "viola", "cello", "contrabass", "tremolo_strings", "pizzicato_strings", "harp", "timpani",
    "strings", "slow_strings", "synth_strings_1", "synth_strings_2", "choir_aahs", "voice_oohs",
    "synth_voice", "orchestra_hit",
    "trumpet", "trombone", "tuba", "muted_trumpet", "french_horn", "brass_section", "synth_brass_1",
    "synth_brass_2",
    "soprano_sax", "alto_sax", "tenor_sax", "baritone_sax", "oboe", "english_horn", "bassoon", "clarinet",
    "piccolo", "flute", "recorder", "pan_flute", "blown_bottle", "shakuhachi", "whistle", "ocarina",
    "square_lead", "saw_lead", "calliope", "chiff_lead", "charang", "voice_lead", "fifths_lead", "bass_lead",
    "new_age_pad", "warm_pad", "polysynth_pad", "choir_pad", "bowed_pad", "metallic_pad", "halo_pad", "sweep_pad",
    "fx_rain", "fx_soundtrack", "fx_crystal", "fx_atmosphere", "fx_brightness", "fx_goblins", "fx_echoes",
    "fx_scifi",
    "sitar", "banjo", "shamisen", "koto", "kalimba", "bagpipe", "fiddle", "shanai",
    "tinkle_bell", "agogo", "steel_drums", "woodblock", "taiko_drum", "melodic_tom", "synth_drum",
    "reverse_cymbal",
    "guitar_fret_noise", "breath_noise", "seashore", "bird_tweet", "telephone_ring", "helicopter", "applause",
    "gunshot",
]
assert len(GM_NAMES) == 128

GM = {name: i for i, name in enumerate(GM_NAMES)}
GM.update({
    "piano": 0, "grand_piano": 0, "acoustic_piano": 0, "bright_piano": 1, "honkytonk": 3,
    "electric_piano": 4, "epiano": 4, "rhodes": 4, "epiano2": 5, "dx_piano": 5,
    "musicbox": 10, "vibes": 11, "bells": 14, "organ": 16,
    "nylon": 24, "acoustic_guitar_nylon": 24, "ukulele": 24, "steel": 25, "acoustic_guitar_steel": 25,
    "upright_bass": 32, "bass": 33, "electric_bass": 33, "fretless": 35,
    "pizzicato": 45, "string_ensemble_1": 48, "string_ensemble_2": 49, "string_ensemble": 48,
    "choir": 52, "aahs": 52, "oohs": 53, "horn": 60,
    "square": 80, "lead_square": 80, "saw": 81, "sawtooth": 81, "lead_saw": 81, "lead_calliope": 82,
    "pad_new_age": 88, "pad_warm": 89, "pad_polysynth": 90, "pad_choir": 91, "pad_bowed": 92,
    "pad_metallic": 93, "pad_halo": 94, "pad_sweep": 95, "crystal": 98, "atmosphere": 99,
    "thumb_piano": 108,
})


def gm_program(p):
    """GM program number 0..127 from a number or a name from the GM table ("music_box")."""
    if isinstance(p, str):
        key = p.strip().lower().replace(" ", "_").replace("-", "_")
        if key not in GM:
            close = [k for k in GM if key[:4] in k][:8]
            raise ValueError("unknown GM instrument %r%s" % (p, (" (did you mean: %s?)" % ", ".join(close)) if close else ""))
        return GM[key]
    n = int(p)
    if not 0 <= n <= 127:
        raise ValueError("GM program %r outside 0..127 (programs are 0-based here: piano = 0)" % (p,))
    return n


DRUMS = {
    "kick2": 35, "kick": 36, "rim": 37, "sidestick": 37, "snare": 38, "clap": 39, "snare2": 40,
    "brush_tap": 38, "brush_slap": 39, "brush_swirl": 40,
    "tom_floor_lo": 41, "chh": 42, "hat": 42, "closed_hat": 42, "tom_floor_hi": 43, "phh": 44, "pedal_hat": 44,
    "tom_lo": 45, "ohh": 46, "open_hat": 46, "tom_mid_lo": 47, "tom_mid_hi": 48, "crash": 49, "tom_hi": 50,
    "ride": 51, "china": 52, "ride_bell": 53, "tambourine": 54, "splash": 55, "cowbell": 56, "crash2": 57,
    "vibraslap": 58, "ride2": 59, "bongo_hi": 60, "bongo_lo": 61, "conga_mute": 62, "conga_hi": 63,
    "conga_lo": 64, "timbale_hi": 65, "timbale_lo": 66, "agogo_hi": 67, "agogo_lo": 68, "cabasa": 69,
    "maracas": 70, "whistle_short": 71, "whistle_long": 72, "guiro_short": 73, "guiro_long": 74, "claves": 75,
    "woodblock_hi": 76, "woodblock_lo": 77, "cuica_mute": 78, "cuica_open": 79, "triangle_mute": 80,
    "triangle": 81, "triangle_open": 81, "shaker": 82, "jingle_bell": 83, "bell_tree": 84, "castanets": 85,
}

DRUM_KITS = {"standard": 0, "room": 8, "power": 16, "electronic": 24, "tr808": 25, "808": 25, "jazz": 32,
             "brush": 40, "orchestra": 48}

# Comfortable registers (lo, hi) per GM program for FluidR3_GM, from probe renders (tools/music/probe.py).
# Notes outside are legal but Song.lint() will mention them.
RANGE_HINTS = {
    0: ("A1", "C6"), 4: ("C2", "C6"), 8: ("C3", "C7"), 9: ("C4", "C7"), 10: ("C4", "C7"), 11: ("F2", "F5"),
    12: ("C2", "C6"), 24: ("E2", "C6"), 25: ("E2", "C6"), 32: ("E1", "G3"), 33: ("E1", "C4"), 46: ("C2", "C6"),
    48: ("C2", "C7"), 49: ("C2", "C7"), 52: ("C2", "C6"), 53: ("C4", "C7"), 73: ("C4", "C7"), 79: ("C3", "C7"),
    80: ("C2", "C7"), 81: ("C2", "C7"), 82: ("C3", "C7"), 88: ("C3", "C7"), 89: ("A2", "C6"), 91: ("C2", "C7"),
    94: ("C3", "C7"), 95: ("C3", "C6"), 108: ("C4", "C7"),
}


# --------------------------------------------------------------------------------------
# Durations and the Pattern mini language
# --------------------------------------------------------------------------------------

_DUR_LETTERS = {"w": 4.0, "h": 2.0, "q": 1.0, "e": 0.5, "s": 0.25, "t": 0.125}


def parse_duration(s):
    """Duration in beats from a number (1, .5, 0.75), a fraction ("1/3") or a letter code:
    w h q e s t = whole, half, quarter, eighth, sixteenth, thirty-second; append '.' for dotted
    and 't' for a triplet value ("q." = 1.5, "et" = 1/3, "qt" = 2/3)."""
    if isinstance(s, (int, float)):
        value = float(s)
    else:
        txt = str(s).strip()
        if not txt:
            raise ValueError("empty duration")
        if txt[0] in _DUR_LETTERS and not re.match(r"^[\d.]", txt):
            value = _DUR_LETTERS[txt[0]]
            add = value
            for ch in txt[1:]:
                if ch == ".":
                    add /= 2.0
                    value += add
                elif ch == "t":
                    value *= 2.0 / 3.0
                else:
                    raise ValueError("cannot parse duration %r" % (s,))
        elif "/" in txt:
            a, b = txt.split("/", 1)
            value = float(a) / float(b)
        else:
            try:
                value = float(txt)
            except ValueError:
                raise ValueError("cannot parse duration %r" % (s,))
    if not value > 0 or math.isinf(value) or math.isnan(value):
        raise ValueError("duration must be > 0, got %r" % (s,))
    return value


_DEGREE_RE = re.compile(r"^([#b]*)(-?\d+)([',]*)$")


class _PEvent:
    __slots__ = ("offset", "dur", "pitches", "degrees", "symbol", "vel", "accent", "gate")

    def __init__(self, offset, dur, pitches=None, degrees=None, symbol=None, vel=None, accent=False, gate=None):
        self.offset, self.dur = offset, dur
        self.pitches, self.degrees, self.symbol = pitches, degrees, symbol
        self.vel, self.accent, self.gate = vel, accent, gate

    def copy(self, **kw):
        e = _PEvent(self.offset, self.dur, None if self.pitches is None else list(self.pitches),
                    None if self.degrees is None else list(self.degrees), self.symbol, self.vel, self.accent,
                    self.gate)
        for k, v in kw.items():
            setattr(e, k, v)
        return e


class Pattern:
    """A melody/rhythm fragment written as a compact string.

    Token grammar (tokens separated by spaces; ``|`` is a bar line: play() verifies that it really falls on a
    bar line of the song, which catches miscounted rhythms early):

        E5:1          note E5 lasting 1 beat               F#4:.5   Bb3:1/3   C5:q.  (letter durations)
        E5            note with the previous duration      E5:1:96  explicit velocity 96
        r:1           rest (also R or _)                   -:1      tie: extend previous note by 1 beat
        C4+E4+G4:2    several notes at once                @Am7:2   chord symbol (octave from play())
        E5:1!         accent (+ ~18 velocity)              E5:1*    staccato (half length)
        1:1 3:.5 b7:1 5,:2 1':2     SCALE DEGREES (need scale= when played): accidentals in front,
                                    ' raises and , lowers by an octave.

    Patterns are immutable; transformations return new patterns:
        p.transpose(3)  p.shift(2)  p.repeat(4)  p.augment(2)  p.reverse()  p.invert()  p + q
        p.slice(0, 4)   p.with_length(8)   p.length
    """

    def __init__(self, text=None, default_dur=1.0):
        self.events = []
        self.length = 0.0
        self.barlines = []
        if text is not None:
            self._parse(text, float(default_dur))

    # -- parsing ---------------------------------------------------------------------
    def _parse(self, text, default_dur):
        t = 0.0
        dur = default_dur
        for raw in str(text).split():
            if raw == "|":
                self.barlines.append(t)
                continue
            tok = raw
            accent = staccato = False
            while tok and tok[-1] in "!*":
                if tok[-1] == "!":
                    accent = True
                else:
                    staccato = True
                tok = tok[:-1]
            if tok.startswith("@"):
                head, *fields = tok[1:].split(":")
                kind = "symbol"
            else:
                head, *fields = tok.split(":")
                kind = None
            if len(fields) > 2:
                raise ValueError("pattern token %r has too many ':' fields" % (raw,))
            if fields and fields[0] != "":
                dur = parse_duration(fields[0])
            vel = None
            if len(fields) == 2:
                try:
                    vel = int(fields[1])
                except ValueError:
                    raise ValueError("pattern token %r: velocity must be an integer" % (raw,))
                if not 1 <= vel <= 127:
                    raise ValueError("pattern token %r: velocity outside 1..127" % (raw,))
            gate = 0.5 if staccato else None
            if kind == "symbol":
                parse_chord(head)
                self.events.append(_PEvent(t, dur, symbol=head, vel=vel, accent=accent, gate=gate))
            elif head in ("r", "R", "_"):
                pass
            elif head in ("-", "~"):
                if not self.events:
                    raise ValueError("pattern starts with a tie %r" % (raw,))
                last_off = self.events[-1].offset
                for e in self.events:
                    if e.offset == last_off:
                        e.dur += dur
            else:
                parts = head.split("+")
                pitches, degrees = [], []
                for part in parts:
                    if _NOTE_RE.match(part):
                        pitches.append(pitch(part))
                    else:
                        dm = _DEGREE_RE.match(part)
                        if not dm:
                            raise ValueError("pattern token %r: %r is neither a note name nor a scale degree"
                                             % (raw, part))
                        alter = _acc_value(dm.group(1))
                        octs = dm.group(3).count("'") - dm.group(3).count(",")
                        degrees.append((int(dm.group(2)), alter, octs))
                if pitches and degrees:
                    raise ValueError("pattern token %r mixes note names and scale degrees" % (raw,))
                self.events.append(_PEvent(t, dur, pitches=pitches or None, degrees=degrees or None, vel=vel,
                                           accent=accent, gate=gate))
            t += dur
        self.length = t

    # -- helpers ---------------------------------------------------------------------
    def _new(self, events, length, barlines=()):
        p = Pattern()
        p.events = events
        p.length = length
        p.barlines = list(barlines)
        return p

    def __repr__(self):
        return "<Pattern %d events, %.3f beats>" % (len(self.events), self.length)

    def __add__(self, other):
        if not isinstance(other, Pattern):
            return NotImplemented
        ev = [e.copy() for e in self.events] + [e.copy(offset=e.offset + self.length) for e in other.events]
        bars = list(self.barlines) + [b + self.length for b in other.barlines]
        return self._new(ev, self.length + other.length, bars)

    def uses_degrees(self):
        return any(e.degrees for e in self.events)

    def check_bars(self, beats_per_bar, at=0.0, repeat=1):
        """Verify the ``|`` bar lines: when the pattern is played at beat ``at`` every bar line must fall on a
        real bar line of the song, and the part after the last ``|`` must not be longer than a bar.  So full
        bars are checked exactly, while a pickup (pattern started mid-bar) is still allowed.
        Raises ValueError naming the offending bar of the pattern."""
        if not self.barlines:
            return
        marks = [0.0] + list(self.barlines) + [self.length]
        for r in range(int(repeat)):
            base = float(at) + r * self.length
            for i, b in enumerate(self.barlines):
                pos = (base + b) / beats_per_bar
                if abs(pos - round(pos)) > 1e-6:
                    seg = marks[i + 1] - marks[i]
                    raise ValueError("pattern bar %d holds %.4g beats: its closing '|' falls on song beat %.4g, "
                                     "which is not a bar line (%.4g beats per bar; pattern starts at beat %.4g)"
                                     % (i + 1, seg, base + b, beats_per_bar, base))
        if marks[-1] - marks[-2] > beats_per_bar + 1e-6:
            raise ValueError("the last bar of the pattern holds %.4g beats, more than a bar of %.4g"
                             % (marks[-1] - marks[-2], beats_per_bar))

    # -- transformations ---------------------------------------------------------------
    def transpose(self, semitones):
        """Chromatic transposition (also works on degree patterns: adds an alteration)."""
        s = int(semitones)
        ev = []
        for e in self.events:
            c = e.copy()
            if c.pitches:
                c.pitches = _check_pitches([p + s for p in c.pitches], "Pattern.transpose")
            if c.degrees:
                c.degrees = [(d, a + s, o) for d, a, o in c.degrees]
            if c.symbol and s:
                raise ValueError("Pattern.transpose cannot move @chord tokens; write the new symbols instead")
            ev.append(c)
        return self._new(ev, self.length, self.barlines)

    def shift(self, steps, scale=None):
        """Diatonic transposition by scale steps.  Degree patterns need no scale; note-name patterns
        need ``scale`` (pitches are snapped into it first)."""
        steps = int(steps)
        ev = []
        for e in self.events:
            c = e.copy()
            if c.degrees:
                c.degrees = [(d + steps, a, o) for d, a, o in c.degrees]
            if c.pitches:
                if scale is None:
                    raise ValueError("Pattern.shift on note names needs scale=Scale(...)")
                c.pitches = [scale.step(p, steps) for p in c.pitches]
            ev.append(c)
        return self._new(ev, self.length, self.barlines)

    def repeat(self, n):
        n = int(n)
        if n < 1:
            raise ValueError("repeat count must be >= 1")
        out = self
        for _ in range(n - 1):
            out = out + self
        return out

    def augment(self, factor):
        """Rhythmic augmentation (factor 2 = twice as slow) or diminution (0.5)."""
        f = float(factor)
        if not f > 0:
            raise ValueError("augment factor must be > 0")
        ev = [e.copy(offset=e.offset * f, dur=e.dur * f) for e in self.events]
        bars = [b * f for b in self.barlines] if f == int(f) else []      # bar lines survive whole factors only
        return self._new(ev, self.length * f, bars)

    def reverse(self):
        """Retrograde."""
        ev = [e.copy(offset=self.length - (e.offset + e.dur)) for e in self.events]
        ev = [e for e in ev if e.offset > -1e-9]
        ev.sort(key=lambda e: e.offset)
        return self._new(ev, self.length)

    def invert(self, axis=None):
        """Melodic inversion around ``axis`` (a pitch for note patterns, a degree for degree patterns;
        default: the first note)."""
        first = next((e for e in self.events if e.pitches or e.degrees), None)
        if first is None:
            return self
        ev = []
        if first.pitches:
            ax = pitch(axis) if axis is not None else first.pitches[0]
            for e in self.events:
                c = e.copy()
                if c.pitches:
                    c.pitches = _check_pitches(sorted(2 * ax - p for p in c.pitches), "Pattern.invert")
                ev.append(c)
        else:
            d0, _, o0 = first.degrees[0]
            ax = int(axis) if axis is not None else d0 + 7 * o0
            for e in self.events:
                c = e.copy()
                if c.degrees:
                    c.degrees = [(2 * ax - (d + 7 * o), -a, 0) for d, a, o in c.degrees]
                ev.append(c)
        return self._new(ev, self.length, self.barlines)

    def slice(self, start, end):
        """Events whose start lies in [start, end), re-based to 0."""
        start, end = float(start), float(end)
        ev = [e.copy(offset=e.offset - start, dur=min(e.dur, end - e.offset))
              for e in self.events if start - 1e-9 <= e.offset < end - 1e-9]
        return self._new(ev, end - start)

    def with_length(self, beats):
        """Same events, total length forced to ``beats`` (pads with silence or cuts)."""
        beats = float(beats)
        if beats >= self.length:
            return self._new([e.copy() for e in self.events], beats, self.barlines)
        return self.slice(0, beats)

    def scale_velocity(self, factor):
        ev = [e.copy(vel=None if e.vel is None else max(1, min(127, int(round(e.vel * factor)))))
              for e in self.events]
        return self._new(ev, self.length, self.barlines)


# --------------------------------------------------------------------------------------
# Song / Track
# --------------------------------------------------------------------------------------

class Note:
    __slots__ = ("pitch", "start", "dur", "vel", "group", "grid_start")

    def __init__(self, pitch_, start, dur, vel, group=None):
        self.pitch, self.start, self.dur, self.vel, self.group = pitch_, start, dur, vel, group
        self.grid_start = start        # where the composer put it (humanize moves .start only)

    @property
    def end(self):
        return self.start + self.dur

    def __repr__(self):
        return "Note(%s, start=%.3f, dur=%.3f, vel=%d)" % (note_name(self.pitch), self.start, self.dur, self.vel)


def _clamp_vel(v):
    return max(1, min(127, int(round(v))))


def _pan_to_cc(pan):
    pan = float(pan)
    if not -1.0 <= pan <= 1.0:
        raise ValueError("pan must be between -1.0 (left) and 1.0 (right), got %r" % (pan,))
    return max(0, min(127, int(round(64 + pan * 63))))


def _cc_value(v, what):
    v = int(round(v))
    if not 0 <= v <= 127:
        raise ValueError("%s must be 0..127, got %r" % (what, v))
    return v


class Track:
    """One instrument on one MIDI channel.  Create through Song.track() / Song.drums()."""

    is_drums = False

    def __init__(self, song, name, program, channel, volume, pan, reverb, chorus, vel, bank=0):
        self.song = song
        self.name = name
        self.program = program
        self.bank = bank
        self.channel = channel              # 0-based internally
        self.volume = _cc_value(volume, "volume")
        self.pan_cc = _pan_to_cc(pan)
        self.reverb = _cc_value(reverb, "reverb")
        self.chorus = _cc_value(chorus, "chorus")
        self.default_vel = _clamp_vel(vel)
        self.notes = []
        self.events = []                    # (beat, kind, a, b): 'cc', 'bend', 'program', 'rpn_bend_range'
        self.bend_range_semitones = 2.0
        self._group = 0

    # -- basics ------------------------------------------------------------------------
    def _ctx(self, start):
        return "track %r at beat %.4g" % (self.name, start)

    def _new_group(self):
        self._group += 1
        return self._group

    def note(self, p, start, dur, vel=None, group=None):
        """Add one note.  Returns the beat where it ends."""
        start, dur = float(start), float(dur)
        try:
            n = pitch(p)
        except ValueError as exc:
            raise ValueError("%s: %s" % (self._ctx(start), exc))
        if start < 0:
            raise ValueError("%s: note start must be >= 0" % self._ctx(start))
        if not dur > 0:
            raise ValueError("%s: note duration must be > 0, got %r" % (self._ctx(start), dur))
        v = self.default_vel if vel is None else vel
        self.notes.append(Note(n, start, dur, _clamp_vel(v), group))
        return start + dur

    def chord(self, chord_or_pitches, start, dur, vel=None, octave=4, inversion=0, voicing="close",
              top_accent=0, roll_ms=0.0):
        """Block chord from a symbol ("Fmaj7") or a list of pitches.  ``top_accent`` adds velocity to
        the highest note (brings out a melody), ``roll_ms`` > 0 rolls the chord upward like a harp."""
        pitches = sorted(_resolve_pitches(chord_or_pitches, octave, inversion, voicing))
        v = self.default_vel if vel is None else vel
        g = self._new_group()
        step = self.song.ms_to_beats(roll_ms, start) if roll_ms else 0.0
        for i, p in enumerate(pitches):
            extra = top_accent if i == len(pitches) - 1 else 0
            off = i * step
            self.note(p, start + off, max(dur - off, min(dur, 0.1)), v + extra, group=g)
        return start + dur

    def arp(self, chord_or_pitches, start, length, step=0.5, order="up", octaves=1, vel=None, note_dur=None,
            ring=0.0, octave=4, inversion=0, accent=8):
        """Arpeggiate a chord from ``start`` for ``length`` beats, one note every ``step`` beats.

        order     'up' | 'down' | 'updown' | 'downup' | 'random' | list of indices into the pitch list
                  (indices >= len wrap upward by octaves, e.g. [0, 2, 1, 2, 3, 2]).
        octaves   repeat the chord tones over this many octaves.
        note_dur  sounding length of each note (default = step); ``ring`` adds extra beats of sustain
                  (nice for harp / music box / guitar).
        accent    extra velocity on the first note of each cycle.
        """
        base = sorted(_resolve_pitches(chord_or_pitches, octave, inversion))
        pool = [p + 12 * o for o in range(int(octaves)) for p in base]
        pool = sorted(set(p for p in pool if p <= 127))
        n = len(pool)
        if isinstance(order, str):
            o = order.lower()
            if o == "up":
                seq = list(range(n))
            elif o == "down":
                seq = list(range(n - 1, -1, -1))
            elif o == "updown":
                seq = list(range(n)) + list(range(n - 2, 0, -1))
            elif o == "downup":
                seq = list(range(n - 1, -1, -1)) + list(range(1, n - 1))
            elif o == "random":
                seq = None
            else:
                raise ValueError("unknown arp order %r" % (order,))
        else:
            seq = [int(i) for i in order]
            if not seq:
                raise ValueError("arp order list is empty")
        step = float(step)
        if not step > 0:
            raise ValueError("arp step must be > 0")
        nd = (step if note_dur is None else float(note_dur)) + float(ring)
        v = self.default_vel if vel is None else vel
        rng = self.song.rng("arp:%s:%.4f" % (self.name, start))
        count = int(math.floor(length / step + 1e-9))
        last = None
        for k in range(count):
            if seq is None:
                idx = rng.randrange(n)
                if n > 1 and idx == last:
                    idx = (idx + 1) % n
                last = idx
                first_of_cycle = k == 0
            else:
                idx = seq[k % len(seq)]
                first_of_cycle = k % len(seq) == 0
            o, i = divmod(idx, n) if idx >= 0 else (0, idx % n)
            p = pool[i] + 12 * o
            if p > 127:
                p -= 12 * ((p - 116) // 12)
            self.note(p, start + k * step, nd, v + (accent if first_of_cycle else 0))
        return start + length

    def strum(self, chord_or_pitches, start, dur, vel=None, direction="down", spread_ms=14.0, instrument=None,
              octave=3, falloff=0.05, strings=None):
        """Strum a chord: strings sound one after another with ``spread_ms`` between them.

        direction  'down' (low string first) or 'up' (high string first).
        instrument None      -> close voicing of the symbol at ``octave`` (or your own pitch list)
                   'ukulele' -> real 4-string re-entrant shape (G4 C4 E4 A4), 'guitar' -> 6-string shape.
        strings    optional number of strings actually hit (upstrokes usually catch only the top 3).
        """
        if instrument is not None and isinstance(chord_or_pitches, str):
            key = str(instrument).lower()
            if key in ("ukulele", "uke"):
                pitches = fretted(chord_or_pitches, UKULELE)
            elif key == "guitar":
                pitches = fretted(chord_or_pitches, GUITAR)
            else:
                raise ValueError("unknown strum instrument %r (ukulele, guitar)" % (instrument,))
        else:
            pitches = _resolve_pitches(chord_or_pitches, octave)
            if instrument is None:
                pitches = sorted(pitches)
        order = list(pitches)
        if str(direction).lower().startswith("u"):
            order.reverse()
        elif not str(direction).lower().startswith("d"):
            raise ValueError("strum direction must be 'down' or 'up'")
        if strings is not None:
            order = order[:max(1, int(strings))]
        v = self.default_vel if vel is None else vel
        step = self.song.ms_to_beats(spread_ms, start)
        g = self._new_group()
        dur = float(dur)
        if not dur > 0:
            raise ValueError("%s: strum duration must be > 0" % self._ctx(start))
        seen = set()
        for i, p in enumerate(order):
            if p in seen:
                continue
            seen.add(p)
            off = i * step
            self.note(p, start + off, max(dur - off, min(dur, 0.08)), v * (1.0 - falloff * i), group=g)
        return start + dur

    def strum_pattern(self, chord_or_pitches, start, pattern="D-DU-UDU", step=0.5, repeats=1, vel=None,
                      instrument="ukulele", octave=3, spread_ms=12.0, ring=None):
        """Rhythmic strumming.  Pattern characters, one per ``step`` beats:
        D/U strong down/up stroke, d/u soft stroke, x muted 'chuck', '-' or '.' nothing (keeps ringing).
        Each stroke rings until the next stroke (or ``ring`` beats at most).  Returns the end beat."""
        chars = [c for c in pattern if c not in " |"]
        if not chars:
            raise ValueError("empty strum pattern")
        for c in chars:
            if c not in "DUdux-.":
                raise ValueError("strum pattern char %r not understood (use D U d u x - .)" % c)
        v = self.default_vel if vel is None else vel
        total = len(chars) * int(repeats)
        hits = [(k, chars[k % len(chars)]) for k in range(total) if chars[k % len(chars)] not in "-."]
        for j, (k, c) in enumerate(hits):
            t = start + k * step
            nxt = (start + hits[j + 1][0] * step) if j + 1 < len(hits) else start + total * step
            d = nxt - t
            if ring is not None:
                d = min(d, float(ring))
            if c == "x":
                self.strum(chord_or_pitches, t, min(d, 0.12), v * 0.55, "down", spread_ms * 0.6, instrument, octave)
            else:
                down = c in "Dd"
                strength = 1.0 if c in "DU" else 0.72
                self.strum(chord_or_pitches, t, d, v * strength * (1.0 if down else 0.9),
                           "down" if down else "up", spread_ms, instrument, octave,
                           strings=None if down else 3)
        return start + total * step

    def play(self, pattern, at=0.0, vel=None, transpose=0, repeat=1, gate=1.0, ring=0.0, scale=None, octave=4,
             chord_octave=None, accent=18, bar_check=True):
        """Play a Pattern (or pattern string) starting at beat ``at``.  Returns the end beat.

        vel        default velocity for tokens without their own.
        transpose  semitones.        repeat  number of times.
        gate       fraction of each duration that sounds (1.0 legato, 0.5 staccato).
        ring       extra beats of sustain added to every note (music box, harp, guitar, vibes).
        scale      Scale used for degree tokens; ``octave`` is the octave of degree 1.
        """
        pat = pattern if isinstance(pattern, Pattern) else Pattern(pattern)
        if bar_check:
            try:
                pat.check_bars(self.song.beats_per_bar, at, repeat)
            except ValueError as exc:
                raise ValueError("%s: %s" % (self._ctx(at), exc))
        if pat.uses_degrees() and scale is None:
            raise ValueError("%s: pattern uses scale degrees, pass scale=Scale(...)" % self._ctx(at))
        v0 = self.default_vel if vel is None else vel
        t0 = float(at)
        for _ in range(int(repeat)):
            for e in pat.events:
                if e.symbol:
                    pitches = chord(e.symbol, octave=octave if chord_octave is None else chord_octave)
                elif e.degrees:
                    pitches = [scale.degree(d, octave + o, a) for d, a, o in e.degrees]
                else:
                    pitches = e.pitches
                v = (e.vel if e.vel is not None else v0) + (accent if e.accent else 0)
                g = e.gate if e.gate is not None else gate
                d = e.dur * g + (ring if e.gate is None else 0.0)
                grp = self._new_group() if len(pitches) > 1 else None
                for p in pitches:
                    q = p + int(transpose)
                    self.note(q, t0 + e.offset, d, v, group=grp)
            t0 += pat.length
        return t0

    # -- controllers -------------------------------------------------------------------
    def cc(self, number, value, at=0.0):
        """Raw control change at a beat."""
        if at < 0:
            raise ValueError("%s: controller time must be >= 0" % self._ctx(at))
        self.events.append((float(at), "cc", _cc_value(number, "controller number"), _cc_value(value, "cc value")))

    def program_change(self, program, at):
        """Switch instrument mid-track (rarely needed; a new track is usually clearer)."""
        self.events.append((float(at), "program", gm_program(program), 0))

    def pedal(self, down_at, up_at):
        """Sustain pedal (CC64) down at one beat and up at another."""
        if up_at <= down_at:
            raise ValueError("%s: pedal up must come after pedal down" % self._ctx(down_at))
        self.cc(64, 127, down_at)
        self.cc(64, 0, up_at)

    def pedal_every(self, start, end, every=None, lift=0.1):
        """Classic 'change the pedal on every chord': pedal held from ``start`` to ``end`` and re-taken
        every ``every`` beats (default one bar).  The pedal goes down ``lift`` beats after each change so
        the new chord is caught but the old one is cleared."""
        every = self.song.beats_per_bar if every is None else float(every)
        t = float(start)
        while t < end - 1e-9:
            seg_end = min(t + every, end)
            self.pedal(t + lift, seg_end)
            t += every

    def expression(self, start, end, v_from, v_to, steps_per_beat=8):
        """CC11 ramp - a real crescendo/diminuendo for SUSTAINED sounds (strings, pads, choir).
        In a loop make sure CC11 is back at its starting value before the loop end."""
        n = max(2, int(math.ceil((end - start) * steps_per_beat)) + 1)
        last = None
        for k in range(n):
            u = k / (n - 1.0)
            val = int(round(v_from + (v_to - v_from) * u))
            if val != last:
                self.cc(11, max(0, min(127, val)), start + (end - start) * u)
                last = val

    def bend_range(self, semitones, at=0.0):
        """Set the pitch-bend range (RPN 0); default is +-2 semitones."""
        semitones = float(semitones)
        if not 0 < semitones <= 24:
            raise ValueError("bend range must be within (0, 24] semitones")
        self.bend_range_semitones = semitones
        self.events.append((float(at), "rpn_bend_range", int(semitones), int(round((semitones % 1) * 100))))

    def bend(self, at, semitones):
        """Pitch bend to ``semitones`` (relative to the note) at a beat.  0 re-centres."""
        r = self.bend_range_semitones
        value = int(round(8192 + max(-1.0, min(1.0, semitones / r)) * 8191))
        self.events.append((float(at), "bend", max(0, min(16383, value)), 0))

    def bend_ramp(self, start, end, frm, to, steps_per_beat=16):
        """Smooth pitch bend from ``frm`` to ``to`` semitones (scoops, falls, tape-stop effects)."""
        n = max(2, int(math.ceil((end - start) * steps_per_beat)) + 1)
        for k in range(n):
            u = k / (n - 1.0)
            self.bend(start + (end - start) * u, frm + (to - frm) * u)

    def vibrato(self, at, depth):
        """Mod wheel (CC1) 0..127 - FluidR3 maps it to vibrato depth."""
        self.cc(1, depth, at)

    # -- dynamics / feel ---------------------------------------------------------------
    def _select(self, start, end):
        lo = -1e18 if start is None else float(start)
        hi = 1e18 if end is None else float(end)
        return [n for n in self.notes if lo - 1e-9 <= n.start < hi - 1e-9]

    def velocity_ramp(self, start, end, v_from, v_to, mode="scale"):
        """Reshape velocities of existing notes whose start lies in [start, end).
        mode 'scale': multiply by a factor going v_from -> v_to (keeps accents), 'set': absolute."""
        span = float(end) - float(start)
        if not span > 0:
            raise ValueError("velocity_ramp needs end > start")
        for n in self._select(start, end):
            u = (n.start - start) / span
            f = v_from + (v_to - v_from) * u
            n.vel = _clamp_vel(n.vel * f if mode == "scale" else f)

    def crescendo(self, start, end, frm=0.6, to=1.0):
        """Velocity crescendo over existing notes (factors)."""
        self.velocity_ramp(start, end, frm, to, "scale")

    def diminuendo(self, start, end, frm=1.0, to=0.55):
        """Velocity diminuendo over existing notes (factors)."""
        self.velocity_ramp(start, end, frm, to, "scale")

    def swing(self, amount=0.62, grid=0.5, start=None, end=None):
        """Swing existing notes: every pair of ``grid``-long subdivisions is re-divided
        amount : (1 - amount).  0.5 = straight, 0.58 = lazy lo-fi, 0.667 = triplet swing.
        Call BEFORE humanize()."""
        if not 0.5 <= amount <= 0.8:
            raise ValueError("swing amount should be 0.5..0.8, got %r" % (amount,))
        cell = 2.0 * float(grid)

        def warp(t):
            k = math.floor(t / cell + 1e-9)
            u = (t - k * cell) / cell
            w = u / 0.5 * amount if u < 0.5 else amount + (u - 0.5) / 0.5 * (1.0 - amount)
            return (k + w) * cell

        for n in self._select(start, end):
            s, e = warp(n.start), warp(n.end)
            n.start, n.dur = s, max(e - s, 0.02)
            n.grid_start = s

    def humanize(self, timing_ms=9.0, velocity=6.0, seed=0, start=None, end=None):
        """Seeded random timing (gaussian, sigma = timing_ms/2, clipped to +-timing_ms) and velocity
        jitter on existing notes.  Notes of one chord/strum move together.  Reproducible."""
        rng = self.song.rng("humanize:%s:%s" % (self.name, seed))
        group_shift = {}
        loop_len = self.song._loop_length_beats
        for n in sorted(self._select(start, end), key=lambda x: (x.start, x.pitch)):
            ms = max(-timing_ms, min(timing_ms, rng.gauss(0.0, timing_ms / 2.0))) if timing_ms > 0 else 0.0
            if n.group is not None:
                if n.group not in group_shift:
                    group_shift[n.group] = ms
                ms = group_shift[n.group] + 0.25 * ms
            shift = self.song.ms_to_beats(ms, n.start)
            new_start = max(0.0, n.start + shift)
            if loop_len is not None and n.start < loop_len:
                new_start = min(new_start, loop_len - 0.01)
            n.start = new_start
            if velocity > 0:
                n.vel = _clamp_vel(n.vel + max(-2 * velocity, min(2 * velocity, rng.gauss(0.0, velocity))))

    # -- editing -----------------------------------------------------------------------
    def copy_range(self, src_start, src_end, dest_start, transpose=0, vel_scale=1.0):
        """Copy the notes that start in [src_start, src_end) to dest_start (A -> A' construction)."""
        delta = float(dest_start) - float(src_start)
        for n in list(self._select(src_start, src_end)):
            self.note(n.pitch + int(transpose), n.start + delta, n.dur, n.vel * vel_scale, n.group)
        return dest_start + (src_end - src_start)

    def clear_range(self, start, end):
        """Remove the notes that start in [start, end)."""
        doomed = set(id(n) for n in self._select(start, end))
        self.notes = [n for n in self.notes if id(n) not in doomed]

    def end_beat(self):
        return max([n.end for n in self.notes], default=0.0)


class DrumTrack(Track):
    """Percussion on MIDI channel 10.  Pitches may be drum names from DRUMS ("kick", "chh", ...)."""

    is_drums = True

    def hit(self, drum, at, vel=None, dur=0.25):
        """One drum hit; ``drum`` is a name from DRUMS or a GM percussion key number."""
        return self.note(self._key(drum), at, dur, vel)

    def _key(self, drum):
        if isinstance(drum, str):
            key = drum.strip().lower()
            if key not in DRUMS:
                raise ValueError("unknown drum %r; known: %s" % (drum, ", ".join(sorted(DRUMS))))
            return DRUMS[key]
        return pitch(drum)

    def pattern(self, drum, steps, start=0.0, step=0.25, repeats=1, vel=None, accent=22, ghost=-32):
        """Step-string drum pattern: 'x' hit, 'X' accent, 'o' ghost note, '.' or '-' rest;
        spaces and '|' are ignored so you can group: "x... x... x.x. x...".  Returns the end beat."""
        key = self._key(drum)
        chars = [c for c in steps if c not in " |"]
        if not chars:
            raise ValueError("empty drum pattern")
        v = self.default_vel if vel is None else vel
        for c in chars:
            if c not in "xXo.-":
                raise ValueError("drum pattern char %r not understood (use x X o . -)" % c)
        for r in range(int(repeats)):
            for i, c in enumerate(chars):
                if c in ".-":
                    continue
                vv = v + (accent if c == "X" else ghost if c == "o" else 0)
                self.note(key, start + (r * len(chars) + i) * step, min(step, 0.25), vv)
        return start + int(repeats) * len(chars) * step

    def grid(self, lines, start=0.0, step=0.25, repeats=1, vel=None):
        """Several step strings at once: {"kick": "x...x...", "snare": "....x...", "chh": "x.x.x.x."}.
        A value may be (steps, velocity).  All strings should have the same length."""
        end = start
        for drum, spec in lines.items():
            if isinstance(spec, (tuple, list)):
                steps, v = spec[0], spec[1]
            else:
                steps, v = spec, vel
            end = max(end, self.pattern(drum, steps, start, step, repeats, v))
        return end


class Song:
    """A song: tempo map, time signature, tracks, loop length and the MIDI writer."""

    def __init__(self, bpm=90, time_sig=(4, 4), ppq=480, seed=1, title=""):
        self.ppq = int(ppq)
        if self.ppq < 24 or self.ppq > 9600:
            raise ValueError("ppq should be within 24..9600")
        num, den = int(time_sig[0]), int(time_sig[1])
        if num < 1 or den not in (1, 2, 4, 8, 16, 32):
            raise ValueError("unsupported time signature %r" % (time_sig,))
        self.time_sig = (num, den)
        self.seed = seed
        self.title = title
        self.tracks = []
        self.tempos = []            # (beat, bpm)
        self.markers = []           # (beat, text)
        self.warnings = []
        self._loop_length_beats = None
        self.tempo(bpm, 0.0)

    # -- time ------------------------------------------------------------------------------
    @property
    def bpm(self):
        return self.tempos[0][1]

    @property
    def beats_per_bar(self):
        """Quarter-note beats in one bar (4/4 -> 4, 3/4 -> 3, 6/8 -> 3)."""
        return self.time_sig[0] * 4.0 / self.time_sig[1]

    def bar(self, index):
        """Beat at which the 0-based bar ``index`` starts: bar(0) == 0.0, bar(4) == 16.0 in 4/4."""
        return index * self.beats_per_bar

    def tempo(self, bpm, at=0.0):
        """Set the tempo (quarter notes per minute) from beat ``at`` on."""
        bpm = float(bpm)
        if not 20 <= bpm <= 400:
            raise ValueError("bpm %r outside 20..400" % (bpm,))
        if at < 0:
            raise ValueError("tempo change time must be >= 0")
        self.tempos = [t for t in self.tempos if abs(t[0] - at) > 1e-9]
        self.tempos.append((float(at), bpm))
        self.tempos.sort()

    def tempo_ramp(self, start, end, bpm_from, bpm_to, steps_per_beat=2):
        """Gradual tempo change (ritardando / accelerando) as a staircase of tempo events."""
        n = max(2, int(math.ceil((end - start) * steps_per_beat)) + 1)
        for k in range(n):
            u = k / (n - 1.0)
            self.tempo(bpm_from + (bpm_to - bpm_from) * u, start + (end - start) * u)

    def tempo_at(self, beat):
        cur = self.tempos[0][1]
        for t, b in self.tempos:
            if t <= beat + 1e-9:
                cur = b
            else:
                break
        return cur

    def ms_to_beats(self, ms, at=0.0):
        return (ms / 1000.0) * self.tempo_at(at) / 60.0

    def _tick(self, beat):
        return int(round(beat * self.ppq))

    def _tempo_events_ticks(self):
        """[(tick, microseconds per quarter)] - integer values exactly as written to the file."""
        out = []
        for beat, bpm in self.tempos:
            out.append((self._tick(beat), int(round(60000000.0 / bpm))))
        if out[0][0] != 0:
            out.insert(0, (0, out[0][1]))
        return out

    def beats_to_seconds(self, beat):
        """Exact playback time of a beat position, using the integer tempo values of the MIDI file."""
        target = self._tick(beat)
        ev = self._tempo_events_ticks()
        secs = 0.0
        for i, (tick, mpqn) in enumerate(ev):
            nxt = ev[i + 1][0] if i + 1 < len(ev) else None
            seg_end = target if nxt is None else min(nxt, target)
            if seg_end > tick:
                secs += (seg_end - tick) * mpqn / (self.ppq * 1e6)
            if nxt is None or nxt >= target:
                break
        return secs

    # -- loop length -----------------------------------------------------------------------
    @property
    def loop_length_beats(self):
        """Exact length of the loop body in beats.  If never set: end of the last note rounded up to a
        whole bar."""
        if self._loop_length_beats is not None:
            return self._loop_length_beats
        last = max([t.end_beat() for t in self.tracks], default=0.0)
        bars = max(1, int(math.ceil(last / self.beats_per_bar - 1e-6)))
        return bars * self.beats_per_bar

    @loop_length_beats.setter
    def loop_length_beats(self, beats):
        beats = float(beats)
        if not beats > 0:
            raise ValueError("loop_length_beats must be > 0")
        self._loop_length_beats = beats

    def set_loop_bars(self, bars):
        """Convenience: loop length = ``bars`` full bars."""
        self.loop_length_beats = bars * self.beats_per_bar
        return self.loop_length_beats

    def loop_seconds(self):
        return self.beats_to_seconds(self.loop_length_beats)

    # -- tracks ----------------------------------------------------------------------------
    def rng(self, salt=""):
        """A reproducible random.Random derived from the song seed and a salt string."""
        return random.Random("%s|%s" % (self.seed, salt))

    def _free_channel(self):
        used = {t.channel for t in self.tracks}
        for ch in list(range(0, 9)) + list(range(10, 16)):
            if ch not in used:
                return ch
        raise ValueError("no free MIDI channel left: a song can hold 15 melodic tracks + drums")

    def track(self, name, program=0, volume=100, pan=0.0, reverb=50, chorus=0, vel=80, channel=None):
        """Create a melodic track.

        program  GM program number (0-based) or name ("music_box", "nylon_guitar", "warm_pad" ...).
        volume   CC7 0..127.   pan  -1.0 (left) .. 1.0 (right).   reverb/chorus  CC91/CC93 send 0..127.
        vel      default note velocity for this track.
        channel  MIDI channel 1..16 (normally leave None: assigned automatically, 10 is reserved).
        """
        if any(t.name == name for t in self.tracks):
            raise ValueError("track name %r already used" % (name,))
        prog = gm_program(program)
        if channel is None:
            ch = self._free_channel()
        else:
            ch = int(channel) - 1
            if not 0 <= ch <= 15:
                raise ValueError("channel must be 1..16")
            if ch == 9:
                raise ValueError("channel 10 is the drum channel; use Song.drums()")
            if any(t.channel == ch for t in self.tracks):
                raise ValueError("channel %d already used by another track" % (ch + 1))
        t = Track(self, name, prog, ch, volume, pan, reverb, chorus, vel)
        self.tracks.append(t)
        return t

    def drums(self, name="drums", kit="standard", volume=100, pan=0.0, reverb=30, chorus=0, vel=90):
        """Create the drum track (MIDI channel 10).  kit: standard, room, power, electronic, tr808, jazz,
        brush, orchestra (or a program number)."""
        if any(t.is_drums for t in self.tracks):
            raise ValueError("the song already has a drum track")
        if isinstance(kit, str):
            key = kit.lower()
            if key not in DRUM_KITS:
                raise ValueError("unknown drum kit %r; known: %s" % (kit, ", ".join(sorted(DRUM_KITS))))
            prog = DRUM_KITS[key]
        else:
            prog = gm_program(kit)
        t = DrumTrack(self, name, prog, 9, volume, pan, reverb, chorus, vel)
        self.tracks.append(t)
        return t

    def marker(self, text, at):
        """Section marker (shows up in the render report and in MIDI editors)."""
        self.markers.append((float(at), str(text)))

    def humanize(self, timing_ms=9.0, velocity=6.0, drums_timing_ms=None, seed=0):
        """Humanize every track (drums get half the timing jitter unless given)."""
        for t in self.tracks:
            tm = (timing_ms * 0.5 if drums_timing_ms is None else drums_timing_ms) if t.is_drums else timing_ms
            t.humanize(tm, velocity, seed)

    def swing(self, amount=0.62, grid=0.5, start=None, end=None):
        """Swing every track."""
        for t in self.tracks:
            t.swing(amount, grid, start, end)

    # -- checks ----------------------------------------------------------------------------
    def lint(self):
        """Non-fatal advice as a list of strings (register, density, velocity, loop length)."""
        out = list(self.warnings)
        loop = self.loop_length_beats
        bpb = self.beats_per_bar
        if abs(loop / bpb - round(loop / bpb)) > 1e-6:
            out.append("loop length %.4g beats is not a whole number of bars (%.4g beats per bar)" % (loop, bpb))
        points = []
        for t in self.tracks:
            if not t.notes:
                out.append("track %r has no notes" % t.name)
                continue
            if not t.is_drums and t.program in RANGE_HINTS:
                lo, hi = (pitch(x) for x in RANGE_HINTS[t.program])
                outside = [n for n in t.notes if not lo <= n.pitch <= hi]
                if outside:
                    ex = ", ".join(sorted({note_name(n.pitch) for n in outside})[:6])
                    out.append("track %r (%s): %d note(s) outside the comfortable register %s..%s (%s)" % (
                        t.name, GM_NAMES[t.program], len(outside), RANGE_HINTS[t.program][0],
                        RANGE_HINTS[t.program][1], ex))
            mean_v = sum(n.vel for n in t.notes) / float(len(t.notes))
            if mean_v > 112:
                out.append("track %r: mean velocity %.0f is very hot; FluidR3 gets harsh above ~105" % (t.name, mean_v))
            if mean_v < 25:
                out.append("track %r: mean velocity %.0f is nearly inaudible" % (t.name, mean_v))
            wrap = [n for n in t.notes if n.end > loop + 4 * bpb]
            if wrap:
                out.append("track %r: %d note(s) ring more than 4 bars past the loop end" % (t.name, len(wrap)))
            for n in t.notes:
                points.append((n.start, 1))
                points.append((n.end, -1))
        points.sort(key=lambda x: (x[0], x[1]))
        cur = peak = 0
        for _, d in points:
            cur += d
            peak = max(peak, cur)
        if peak > 40:
            out.append("up to %d notes sound at once; dense FluidR3 mixes turn muddy (and steal voices)" % peak)
        return out

    # -- MIDI writer -----------------------------------------------------------------------
    @staticmethod
    def _varlen(value):
        value = int(value)
        if value < 0:
            raise ValueError("negative delta time")
        out = [value & 0x7F]
        value >>= 7
        while value:
            out.append((value & 0x7F) | 0x80)
            value >>= 7
        return bytes(reversed(out))

    def _track_setup(self, t):
        """Controller state asserted at the start of every pass (keeps loops periodic)."""
        ev = []
        ch = t.channel
        ev.append((0, 0, bytes([0xC0 | ch, t.program])))          # on channel 10 the program selects the drum kit
        for num, val in ((7, t.volume), (10, t.pan_cc), (91, t.reverb), (93, t.chorus), (11, 127), (64, 0), (1, 0)):
            ev.append((0, 0, bytes([0xB0 | ch, num, val])))
        ev.append((0, 0, bytes([0xE0 | ch, 0x00, 0x40])))
        return ev

    def _collect_notes(self, t, repeats, loop_ticks, strict_loop):
        loop = self.loop_length_beats
        notes = []
        for n in t.notes:
            on = self._tick(n.start)
            if strict_loop and n.start >= loop - 1e-9:
                if n.grid_start < loop - 1e-9:            # humanize nudged it over the edge: keep it inside
                    on = loop_ticks - 1
                else:
                    raise ValueError("track %r: note %s starts at beat %.4g but the loop is only %.4g beats long "
                                     "(pickup notes into bar 1 belong at the END of the loop)"
                                     % (t.name, note_name(n.pitch), n.start, loop))
            off = max(on + 1, self._tick(n.start + n.dur))
            for r in range(repeats):
                notes.append([on + r * loop_ticks, off + r * loop_ticks, n.pitch, n.vel])
        # trim overlapping notes of the same pitch (same channel)
        by_pitch = {}
        for rec in notes:
            by_pitch.setdefault(rec[2], []).append(rec)
        out = []
        trimmed = 0
        for p, recs in by_pitch.items():
            recs.sort(key=lambda r: (r[0], -r[3]))
            kept = []
            for rec in recs:
                if kept and rec[0] == kept[-1][0]:
                    kept[-1][1] = max(kept[-1][1], rec[1])      # duplicate onset: keep the louder, longer
                    trimmed += 1
                    continue
                if kept and kept[-1][1] > rec[0]:
                    kept[-1][1] = rec[0]
                    trimmed += 1
                kept.append(rec)
            out.extend(kept)
        return out, trimmed

    def to_midi_bytes(self, repeats=1, tail_beats=0.0, strict_loop=None, solo=None):
        """Serialise as a format-1 SMF.  ``repeats`` > 1 writes the loop body several times back to back
        (used by render.py); ``tail_beats`` pads the end so release/reverb tails are rendered;
        ``solo`` = iterable of track names: only those tracks are written (stem renders)."""
        repeats = int(repeats)
        if repeats < 1:
            raise ValueError("repeats must be >= 1")
        if not self.tracks:
            raise ValueError("the song has no tracks")
        if strict_loop is None:
            strict_loop = repeats > 1 or self._loop_length_beats is not None
        loop_beats = self.loop_length_beats
        loop_ticks = self._tick(loop_beats)
        total_ticks = repeats * loop_ticks + self._tick(max(0.0, tail_beats))
        for beat, _ in self.tempos:
            if beat >= loop_beats:
                raise ValueError("tempo change at beat %.4g lies outside the loop (%.4g beats)" % (beat, loop_beats))

        chunks = []
        # conductor track
        ev = [(0, 0, b"\xFF\x03" + self._varlen(len(self.title.encode("utf-8"))) + self.title.encode("utf-8"))]
        num, den = self.time_sig
        ev.append((0, 0, b"\xFF\x58\x04" + bytes([num, int(math.log2(den)), 24, 8])))
        for r in range(repeats):
            for tick, mpqn in self._tempo_events_ticks():
                ev.append((tick + r * loop_ticks, 1, b"\xFF\x51\x03" + struct.pack(">I", mpqn)[1:]))
            for beat, text in self.markers:
                data = text.encode("utf-8")
                ev.append((self._tick(beat) + r * loop_ticks, 2, b"\xFF\x06" + self._varlen(len(data)) + data))
        chunks.append(self._chunk(ev, total_ticks))

        self.last_trimmed = 0
        solo = None if solo is None else set(solo)
        if solo is not None:
            unknown = solo - {t.name for t in self.tracks}
            if unknown:
                raise ValueError("solo: unknown track name(s) %s" % ", ".join(sorted(unknown)))
        for t in self.tracks:
            if solo is not None and t.name not in solo:
                continue
            ev = []
            name = t.name.encode("utf-8")
            ev.append((0, -1, b"\xFF\x03" + self._varlen(len(name)) + name))
            ch = t.channel
            for r in range(repeats):
                base = r * loop_ticks
                for tick, order, data in self._track_setup(t):
                    ev.append((base + tick, order, data))
                for beat, kind, a, b in sorted(t.events, key=lambda e: e[0]):
                    if strict_loop and beat > loop_beats + 1e-9:
                        raise ValueError("track %r: %s event at beat %.4g lies outside the loop (%.4g beats)"
                                         % (t.name, kind, beat, loop_beats))
                    tick = self._tick(beat)
                    if strict_loop:
                        tick = min(tick, loop_ticks - 1)   # an event exactly on the loop end belongs to this pass
                    tick += base
                    if kind == "cc":
                        ev.append((tick, 2, bytes([0xB0 | ch, a, b])))
                    elif kind == "program":
                        ev.append((tick, 2, bytes([0xC0 | ch, a])))
                    elif kind == "bend":
                        ev.append((tick, 2, bytes([0xE0 | ch, a & 0x7F, (a >> 7) & 0x7F])))
                    elif kind == "rpn_bend_range":
                        for num_, val in ((101, 0), (100, 0), (6, a), (38, b), (101, 127), (100, 127)):
                            ev.append((tick, 2, bytes([0xB0 | ch, num_, val])))
            notes, trimmed = self._collect_notes(t, repeats, loop_ticks, strict_loop)
            self.last_trimmed += trimmed
            for on, off, p, v in notes:
                ev.append((on, 3, bytes([0x90 | ch, p, v])))
                ev.append((min(off, max(total_ticks, on + 1)), 1, bytes([0x80 | ch, p, 0])))
            chunks.append(self._chunk(ev, total_ticks))

        header = b"MThd" + struct.pack(">IHHH", 6, 1, len(chunks), self.ppq)
        return header + b"".join(chunks)

    def _chunk(self, events, total_ticks):
        # stable sort: tick, then order class (setup < note-off < controllers < note-on)
        indexed = sorted(enumerate(events), key=lambda x: (x[1][0], x[1][1], x[0]))
        body = bytearray()
        last = 0
        for _, (tick, _order, data) in indexed:
            body += self._varlen(tick - last) + data
            last = tick
        end = max(total_ticks, last)
        body += self._varlen(end - last) + b"\xFF\x2F\x00"
        return b"MTrk" + struct.pack(">I", len(body)) + bytes(body)

    def save(self, path, repeats=1, tail_beats=0.0, solo=None):
        """Write the MIDI file.  Returns the path."""
        data = self.to_midi_bytes(repeats, tail_beats, solo=solo)
        with open(path, "wb") as fh:
            fh.write(data)
        return path

    def summary(self):
        """Human readable overview (used by render.py)."""
        lines = ["Song %r  %.4g bpm  %d/%d  loop %.4g beats (%.4g bars, %.3f s)" % (
            self.title, self.bpm, self.time_sig[0], self.time_sig[1], self.loop_length_beats,
            self.loop_length_beats / self.beats_per_bar, self.loop_seconds())]
        for t in self.tracks:
            if t.notes:
                lo = note_name(min(n.pitch for n in t.notes))
                hi = note_name(max(n.pitch for n in t.notes))
                mv = sum(n.vel for n in t.notes) / float(len(t.notes))
            else:
                lo = hi = "-"
                mv = 0
            kind = "drum kit %d" % t.program if t.is_drums else "%d %s" % (t.program, GM_NAMES[t.program])
            lines.append("  ch%-2d %-14s %-24s notes %4d  range %s..%s  mean vel %3.0f  vol %3d rev %3d" % (
                t.channel + 1, t.name[:14], kind[:24], len(t.notes), lo, hi, mv, t.volume, t.reverb))
        return "\n".join(lines)


# --------------------------------------------------------------------------------------
# Minimal SMF reader (for tests and sanity reports)
# --------------------------------------------------------------------------------------

def read_midi_summary(data):
    """Parse SMF bytes and return {'format','ppq','tracks':[{'name','notes_on','notes_off','length_ticks',
    'channels'}]} - raises ValueError when the file is malformed."""
    if data[:4] != b"MThd":
        raise ValueError("not a MIDI file")
    hlen, fmt, ntrk, ppq = struct.unpack(">IHHH", data[4:14])
    pos = 8 + hlen
    tracks = []
    for _ in range(ntrk):
        if data[pos:pos + 4] != b"MTrk":
            raise ValueError("missing MTrk chunk")
        (length,) = struct.unpack(">I", data[pos + 4:pos + 8])
        p, end = pos + 8, pos + 8 + length
        tick = 0
        info = {"name": "", "notes_on": 0, "notes_off": 0, "length_ticks": 0, "channels": set(), "tempos": []}
        status = None
        ended = False
        while p < end:
            delta = 0
            while True:
                b = data[p]
                p += 1
                delta = (delta << 7) | (b & 0x7F)
                if not b & 0x80:
                    break
            tick += delta
            b = data[p]
            if b == 0xFF:
                mtype = data[p + 1]
                p += 2
                ln = 0
                while True:
                    c = data[p]
                    p += 1
                    ln = (ln << 7) | (c & 0x7F)
                    if not c & 0x80:
                        break
                payload = data[p:p + ln]
                p += ln
                if mtype == 0x03:
                    info["name"] = payload.decode("utf-8", "replace")
                elif mtype == 0x51:
                    info["tempos"].append((tick, int.from_bytes(payload, "big")))
                elif mtype == 0x2F:
                    ended = True
                    break
                continue
            if b & 0x80:
                status = b
                p += 1
            if status is None:
                raise ValueError("running status without status byte")
            kind = status & 0xF0
            nbytes = 1 if kind in (0xC0, 0xD0) else 2
            args = data[p:p + nbytes]
            p += nbytes
            info["channels"].add(status & 0x0F)
            if kind == 0x90 and args[1] > 0:
                info["notes_on"] += 1
            elif kind == 0x80 or (kind == 0x90 and args[1] == 0):
                info["notes_off"] += 1
        if not ended:
            raise ValueError("track without end-of-track event")
        info["length_ticks"] = tick
        tracks.append(info)
        pos = end
    return {"format": fmt, "ppq": ppq, "tracks": tracks}


# --------------------------------------------------------------------------------------
# Self test
# --------------------------------------------------------------------------------------

def _selftest():
    def raises(fn, *a, **k):
        try:
            fn(*a, **k)
        except ValueError:
            return True
        return False

    assert pitch("C4") == 60 and pitch("A4") == 69 and pitch("F#3") == 54 and pitch("Bb5") == 82
    assert pitch("C-1") == 0 and pitch("G9") == 127 and pitch("Cb4") == 59 and pitch(61) == 61
    assert raises(pitch, "H2") and raises(pitch, "A9") and raises(pitch, -1) and raises(pitch, 60.5)
    assert note_name(60) == "C4" and note_name(61, flats=True) == "Db4"

    assert scale("C", "major") == [60, 62, 64, 65, 67, 69, 71, 72]
    s = Scale("A", "minor")
    assert s.degree(1) == 69 and s.degree(3) == 72 and s.degree(8) == 81 and s.degree(0) == 67
    assert s.snap(70) in (69, 71) and s.step(69, 2) == 72 and s.chord(1) == [69, 72, 76]
    assert Scale("D", "dorian").pcs() == {2, 4, 5, 7, 9, 11, 0}
    assert raises(Scale, "C", "nonsense")

    def ivs(sym):
        return list(parse_chord(sym).intervals)
    assert ivs("C") == [0, 4, 7] and ivs("Cm") == [0, 3, 7] and ivs("Cmaj7") == [0, 4, 7, 11]
    assert ivs("Am9") == [0, 3, 7, 10, 14] and ivs("Gsus4") == [0, 5, 7] and ivs("Dm7b5") == [0, 3, 6, 10]
    assert ivs("Cdim7") == [0, 3, 6, 9] and ivs("C7#9") == [0, 4, 7, 10, 15] and ivs("Cadd9") == [0, 4, 7, 14]
    assert ivs("C69") == [0, 4, 7, 9, 14] and ivs("C6/9") == [0, 4, 7, 9, 14] and ivs("CmMaj7") == [0, 3, 7, 11]
    assert ivs("C7sus4") == [0, 5, 7, 10] and ivs("Caug") == [0, 4, 8] and ivs("C5") == [0, 7]
    assert ivs("Cmaj13#11") == [0, 4, 7, 11, 14, 18, 21] and ivs("C-7") == [0, 3, 7, 10] and ivs("CM7") == ivs("Cmaj7")
    assert parse_chord("F/A").bass_pc == 9 and parse_chord("Bbm7b5/E").root_pc == 10
    assert raises(parse_chord, "Hm") and raises(parse_chord, "Cfoo") and raises(parse_chord, "")
    assert chord("Cmaj7") == [60, 64, 67, 71] and chord("C", inversion=1) == [64, 67, 72]
    assert chord("C", voicing="open") == [60, 67, 76] and chord("F/A")[0] % 12 == 9
    assert chord("Dm7", voicing="shell") == [62, 65, 72] and bass_note("F/A") == 45 and bass_note("C", 1) == 24
    v = voice_led(["C", "F", "G", "C"])
    assert all(len(x) == 3 for x in v) and sum(abs(a - b) for a, b in zip(v[0], v[1])) <= 5
    assert {p % 12 for p in fretted("C")} == {0, 4, 7} and len(fretted("Am7")) == 4
    assert {p % 12 for p in fretted("G", GUITAR)} == {7, 11, 2}
    assert gm_program("music_box") == 10 and gm_program("Nylon Guitar") == 24 and raises(gm_program, "kazoo")
    assert raises(gm_program, 128)

    assert parse_duration("q.") == 1.5 and abs(parse_duration("et") - 1 / 3.0) < 1e-12 and parse_duration("1/3") > 0.33
    assert parse_duration(".5") == 0.5 and raises(parse_duration, "0") and raises(parse_duration, "zz")
    p = Pattern("E5:1 G5:.5 A5:.5 r:1 C6:2")
    assert p.length == 5.0 and len(p.events) == 4 and p.events[3].offset == 3.0
    assert p.transpose(12).events[0].pitches == [88] and p.repeat(3).length == 15.0
    assert p.augment(2).events[1].offset == 2.0 and p.reverse().events[0].pitches == [84]
    assert Pattern("C4:1 -:1 D4:2").events[0].dur == 2.0
    assert Pattern("C4+E4+G4:2 @Am7:2").length == 4.0
    assert raises(Pattern, "C4:1:200") and raises(Pattern, "Q9:1") and raises(Pattern, "C4:-1")
    dp = Pattern("1:1 3:.5 5:.5 b7:1 1':1")
    assert dp.uses_degrees() and dp.shift(1).events[0].degrees == [(2, 0, 0)]
    assert dp.invert().events[1].degrees[0][0] == -1

    song = Song(bpm=84, seed=5, title="selftest")
    song.set_loop_bars(4)
    a = song.track("a", "music_box", pan=-0.2)
    end = a.play("E5:1 G5:.5 A5:.5 r:1 C6:1 | E5:4", vel=80, ring=0.5)
    assert end == 8.0
    assert raises(a.play, "E5:1 G5:1 | E5:5 | C5:4")            # bar check: first bar too short
    assert raises(a.play, "E5:2 G5:2 | E5:3 | C5:4")            # bar check: middle bar too short
    assert raises(a.play, "E5:2 G5:2 | E5:5")                   # bar check: last bar too long
    assert not raises(a.play, "G5:1 | E5:4 | C5:2", 3)          # pickup starting on beat 4 is fine
    a.clear_range(3, 3.5)
    a.clear_range(4, 99)
    a.play(dp, at=8, scale=Scale("C", "major"), octave=5)
    assert raises(a.play, dp, 8)                                 # degrees need a scale
    assert raises(a.note, "C4", 0, 0) and raises(a.note, "C4", -1, 1) and raises(a.note, 140, 0, 1)
    b = song.track("b", 24)
    assert max(n.pitch for n in (b.arp("C7", 0, 2, octave=3), b.notes)[1]) < 72      # "C7" is a chord here
    b.clear_range(0, 99)
    b.strum("Am7", 0, 2, instrument="ukulele")
    b.strum_pattern("F", 4, "D-DU-UDU", repeats=1, instrument="guitar")
    b.arp("Cmaj7", 8, 4, step=0.5, order="updown", ring=0.5)
    b.arp("Cmaj7", 12, 4, step=0.5, order=[0, 2, 1, 3], octaves=2)
    c = song.track("c", "piano")
    c.chord("Cmaj7", 0, 4, vel=60, voicing="open", top_accent=10)
    c.pedal_every(0, 16)
    c.note("C4", 0, 3)
    c.note("C4", 2, 2)          # overlap on the same pitch gets trimmed at export
    c.crescendo(0, 16)
    c.bend_range(12)
    c.bend_ramp(14, 15, 0, -2)
    c.bend(15.5, 0)
    c.expression(8, 12, 127, 80)
    c.expression(12, 15.9, 80, 127)
    d = song.drums(kit="brush")
    d.grid({"kick": "x.......x.x.....", "brush_tap": "....x..o....x...", "chh": ("x.x.x.x.x.x.x.x.", 50)}, repeats=4)
    assert raises(d.pattern, "kick", "x..q")
    assert raises(song.drums)
    song.swing(0.58)
    song.humanize(8, 5)
    song.tempo(80, 12)
    data1 = song.to_midi_bytes()
    data2 = song.to_midi_bytes(repeats=2, tail_beats=4)
    info1, info2 = read_midi_summary(data1), read_midi_summary(data2)
    assert info1["format"] == 1 and info1["ppq"] == 480 and len(info1["tracks"]) == 5
    assert song.last_trimmed >= 1
    for tr in info1["tracks"][1:]:
        assert tr["notes_on"] == tr["notes_off"] > 0, tr
    assert info1["tracks"][4]["channels"] == {9}
    assert info2["tracks"][1]["notes_on"] == 2 * info1["tracks"][1]["notes_on"]
    assert info2["tracks"][0]["length_ticks"] == 2 * 16 * 480 + 4 * 480
    # determinism
    assert data1 == song.to_midi_bytes()
    # tempo map
    s2 = Song(bpm=120)
    s2.track("x").note(60, 0, 1)
    s2.set_loop_bars(2)
    assert abs(s2.loop_seconds() - 4.0) < 1e-9
    s2.tempo(60, 4)
    assert abs(s2.loop_seconds() - 6.0) < 1e-9
    e = song.track("late", 0)
    e.note(60, 16, 1)
    assert raises(song.to_midi_bytes)                            # note beyond the loop
    assert isinstance(song.lint(), list)
    print("midilib self test: OK (%d + %d bytes of MIDI written in memory)" % (len(data1), len(data2)))


if __name__ == "__main__":
    _selftest()
