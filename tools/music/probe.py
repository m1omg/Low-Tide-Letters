#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""probe.py - 'listen by analysis': render single notes of GM programs through FluidR3 and measure them.

    python3 tools/music/probe.py                     # the recommended palette (see README)
    python3 tools/music/probe.py 10 music_box 89     # specific programs (numbers or GM names)
    python3 tools/music/probe.py --drums brush       # level of every drum name in a kit
    python3 tools/music/probe.py --velocity 0 10 24  # velocity response at C4/C5

Per program and register (C1 .. C7, velocity 80, one second held, three seconds of release) it prints:
  lvl   K-weighted loudness of the held second (LUFS-like; compare across registers and instruments)
  pk    sample peak in dBFS
  sus   level after 1 s relative to the first 100 ms (0 = organ-like sustain, -20 = plucked/decaying)
  rel   seconds until the release has fallen 40 dB below the held level (long = washy, overlaps pile up)
  cen   spectral centroid in Hz (brightness)
  corr  left/right correlation of the held second (1 = mono-safe, < 0 = cancels on mono speakers)
"""

from __future__ import annotations

import argparse
import math
import os
import sys
import tempfile

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import audiolib as A  # noqa: E402
import midilib as M  # noqa: E402
import render as R  # noqa: E402

PALETTE = [10, 8, 9, 11, 0, 4, 24, 25, 32, 33, 48, 49, 52, 53, 73, 79, 80, 81, 82, 89, 94, 108, 46, 12, 88, 91, 95]
SLOT_BEATS = 10.0      # at 120 bpm: 5 s per probe note
HOLD_BEATS = 2.0       # 1 s held


def _render(song, workdir, tag):
    mid = os.path.join(workdir, tag + ".mid")
    wav = os.path.join(workdir, tag + ".wav")
    song.save(mid, repeats=1, tail_beats=2)
    x = R.fluidsynth_render(mid, wav, {"reverb": {"level": 0.0}, "chorus": {"level": 0.0}})
    for p in (mid, wav):
        try:
            os.unlink(p)
        except OSError:
            pass
    return x


def _measure(seg):
    """seg: (frames, 2) slice that starts at the note-on and lasts one slot."""
    sr = R.SR
    mono = np.mean(seg, axis=1)
    held = seg[:sr]
    ky = A.k_weight(held, sr)
    ms = float(np.mean(np.sum(ky * ky, axis=1)))
    lvl = -0.691 + 10.0 * math.log10(ms) if ms > 1e-14 else float("-inf")
    pk = A.db(A.sample_peak(seg))

    def rms(a):
        return math.sqrt(float(np.mean(a * a)) + 1e-20)
    first = rms(mono[int(0.005 * sr):int(0.105 * sr)])
    late = rms(mono[int(0.9 * sr):int(1.0 * sr)])
    sus = A.db(late / first) if first > 1e-7 else float("-inf")
    rel = float("nan")
    ref = rms(mono[int(0.8 * sr):int(1.0 * sr)])
    if ref > 1e-7:
        frame = int(0.02 * sr)
        tail = mono[sr:]
        nfr = len(tail) // frame
        env = np.sqrt(np.mean(tail[:nfr * frame].reshape(nfr, frame) ** 2, axis=1) + 1e-20)
        below = np.flatnonzero(env < ref * A.undb(-40.0))
        rel = below[0] * 0.02 if len(below) else float("inf")
    spec = np.abs(np.fft.rfft(mono[:sr] * np.hanning(sr)))
    f = np.fft.rfftfreq(sr, 1.0 / sr)
    cen = float(np.sum(f * spec) / (np.sum(spec) + 1e-12))
    l, r = seg[:sr, 0], seg[:sr, 1]
    den = math.sqrt(float(np.sum(l * l)) * float(np.sum(r * r)))
    corr = float(np.sum(l * r) / den) if den > 1e-12 else 1.0
    return lvl, pk, sus, rel, cen, corr


def probe_program(prog, workdir, vel=80):
    song = M.Song(bpm=120, seed=1)
    t = song.track("probe", prog, volume=100, reverb=0, chorus=0)
    octaves = list(range(1, 8))
    for i, o in enumerate(octaves):
        t.note(12 * (o + 1), i * SLOT_BEATS, HOLD_BEATS, vel)
    song.loop_length_beats = len(octaves) * SLOT_BEATS
    x = _render(song, workdir, "probe_%d" % prog)
    slot = int(SLOT_BEATS * 0.5 * R.SR)
    out = []
    for i, o in enumerate(octaves):
        seg = x[i * slot:(i + 1) * slot]
        if len(seg) < R.SR * 2:
            seg = np.vstack([seg, np.zeros((R.SR * 5 - len(seg), 2))])
        out.append((o,) + _measure(seg))
    return out


def probe_velocity(prog, workdir, note=60):
    song = M.Song(bpm=120, seed=1)
    t = song.track("probe", prog, volume=100, reverb=0, chorus=0)
    vels = [30, 50, 70, 90, 110, 127]
    for i, v in enumerate(vels):
        t.note(note, i * SLOT_BEATS, HOLD_BEATS, v)
    song.loop_length_beats = len(vels) * SLOT_BEATS
    x = _render(song, workdir, "vel_%d" % prog)
    slot = int(SLOT_BEATS * 0.5 * R.SR)
    return [(v,) + _measure(x[i * slot:(i + 1) * slot]) for i, v in enumerate(vels)]


def probe_drums(kit, workdir):
    names = sorted(set(M.DRUMS.values()))
    song = M.Song(bpm=120, seed=1)
    d = song.drums(kit=kit, volume=100, reverb=0)
    for i, key in enumerate(names):
        d.note(key, i * 4.0, 0.5, 90)
    song.loop_length_beats = len(names) * 4.0
    x = _render(song, workdir, "drums_%s" % kit)
    slot = int(2.0 * R.SR)
    rows = []
    for i, key in enumerate(names):
        seg = x[i * slot:(i + 1) * slot]
        mono = np.mean(seg, axis=1)
        pk = A.db(A.sample_peak(seg))
        env = np.abs(mono)
        loud = np.flatnonzero(env > A.sample_peak(seg) * A.undb(-30.0))
        length = (loud[-1] - loud[0]) / float(R.SR) if len(loud) else 0.0
        spec = np.abs(np.fft.rfft(mono[:R.SR] * np.hanning(R.SR))) if len(mono) >= R.SR else np.zeros(2)
        f = np.fft.rfftfreq(R.SR, 1.0 / R.SR) if len(mono) >= R.SR else np.zeros(2)
        cen = float(np.sum(f * spec) / (np.sum(spec) + 1e-12))
        label = "/".join(sorted(k for k, v in M.DRUMS.items() if v == key))
        rows.append((key, label, pk, length, cen))
    return rows


def fmt(v, spec="%6.1f"):
    if v != v:
        return "   n/a"
    if v in (float("inf"), float("-inf")):
        return "   inf" if v > 0 else "  -inf"
    return spec % v


def main(argv=None):
    ap = argparse.ArgumentParser(description="Measure FluidR3 patches by rendering probe notes.")
    ap.add_argument("programs", nargs="*", help="GM program numbers or names (default: the recommended palette)")
    ap.add_argument("--drums", default=None, help="probe a drum kit (standard, brush, jazz, ...)")
    ap.add_argument("--velocity", action="store_true", help="velocity response instead of registers")
    ap.add_argument("--workdir", default=None)
    args = ap.parse_args(argv)
    workdir = args.workdir or R.default_workdir()
    os.makedirs(workdir, exist_ok=True)
    if args.drums:
        print("drum kit %r, velocity 90, CC7 100 (dry)" % args.drums)
        print("%4s %-28s %7s %7s %7s" % ("key", "name", "pk dB", "len s", "cen Hz"))
        for key, label, pk, length, cen in probe_drums(args.drums, workdir):
            print("%4d %-28s %7.1f %7.2f %7.0f" % (key, label[:28], pk, length, cen))
        return 0
    progs = [M.gm_program(int(p) if p.isdigit() else p) for p in args.programs] or PALETTE
    for prog in progs:
        print("\n%3d %s" % (prog, M.GM_NAMES[prog]))
        if args.velocity:
            print("   vel    lvl     pk    sus    rel    cen   corr")
            for v, lvl, pk, sus, rel, cen, corr in probe_velocity(prog, workdir, 72 if prog in (8, 9, 10) else 60):
                print("   %3d %s %s %s %s %6.0f  %5.2f" % (v, fmt(lvl), fmt(pk), fmt(sus), fmt(rel, "%6.2f"), cen, corr))
        else:
            print("   note   lvl     pk    sus    rel    cen   corr")
            for o, lvl, pk, sus, rel, cen, corr in probe_program(prog, workdir):
                print("   C%d  %s %s %s %s %6.0f  %5.2f" % (o, fmt(lvl), fmt(pk), fmt(sus), fmt(rel, "%6.2f"), cen, corr))
    return 0


if __name__ == "__main__":
    sys.exit(main())
