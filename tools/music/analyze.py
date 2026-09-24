#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""analyze.py - standalone checker for rendered music (OGG or WAV).

    python3 tools/music/analyze.py assets/audio/bgm/town_theme.ogg
    python3 tools/music/analyze.py a.ogg b.ogg --expect-key "A minor"
    python3 tools/music/analyze.py a.ogg --png /tmp/a.png        # waveform + spectrogram + seam zoom picture
    python3 tools/music/analyze.py a.ogg --json                  # machine readable

Reports duration, sample/true peak, RMS, integrated loudness (LUFS), DC offset, silence ratio, stereo
correlation, the loop-seam metrics (last 50 ms against first 50 ms), a chromagram key estimate and a
loudness-over-time sparkline.  Whether a file is a loop is read from the sidecar <name>.json when present
(override with --loop / --no-loop).

Exit status 1 when a check fails: silence, clipping, true peak above -0.9 dBTP, a bad loop seam, or a key
estimate that contradicts --expect-key.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import audiolib as A  # noqa: E402


def chroma_bar(chroma):
    names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
    top = float(np.max(chroma)) or 1.0
    cells = []
    for i, nme in enumerate(names):
        cells.append("%s%s" % (nme, A.sparkline([chroma[i] / top], lo=0.0, hi=1.0)))
    return " ".join(cells)


def make_png(x, sr, path, loop, title):
    """Waveform, log-frequency spectrogram and a zoom on the loop seam (or the first/last 40 ms)."""
    from PIL import Image, ImageDraw

    W, H = 1200, 760
    img = Image.new("RGB", (W, H), (250, 247, 240))
    d = ImageDraw.Draw(img)
    mono = np.mean(x, axis=1)
    n = len(mono)
    left, right = 60, W - 20
    cols = right - left
    d.text((left, 6), "%s   %.2f s   peak %.1f dBFS" % (title, n / float(sr), A.db(A.sample_peak(x))), fill=(40, 40, 40))

    # waveform (min/max per column)
    top, bot = 28, 188
    mid = (top + bot) // 2
    d.rectangle([left, top, right, bot], outline=(180, 170, 160))
    edges = np.linspace(0, n, cols + 1).astype(int)
    for c in range(cols):
        seg = mono[edges[c]:max(edges[c + 1], edges[c] + 1)]
        lo, hi = float(np.min(seg)), float(np.max(seg))
        d.line([left + c, mid - hi * (bot - top) / 2.0, left + c, mid - lo * (bot - top) / 2.0], fill=(70, 90, 140))
    d.line([left, mid, right, mid], fill=(200, 190, 180))

    # spectrogram, log frequency 40 Hz .. 16 kHz
    stop, sbot = 204, 544
    rows = sbot - stop
    nfft = 4096
    hop = max(1, (n - nfft) // cols) if n > nfft else 1
    win = np.hanning(nfft)
    freqs = np.fft.rfftfreq(nfft, 1.0 / sr)
    targets = np.geomspace(40.0, min(16000.0, sr / 2.0 - 1), rows)
    idx = np.clip(np.searchsorted(freqs, targets), 1, len(freqs) - 1)
    spec_img = np.zeros((rows, cols))
    padded = np.concatenate([mono, np.zeros(nfft)])
    for c in range(cols):
        start = min(c * hop, max(0, n - 1))
        frame = padded[start:start + nfft] * win
        mag = np.abs(np.fft.rfft(frame)) / (nfft / 4.0)
        spec_img[:, c] = 20.0 * np.log10(np.maximum(mag[idx], 1e-7))
    norm = np.clip((spec_img + 90.0) / 80.0, 0.0, 1.0)[::-1]
    rgb = np.stack([np.clip(norm * 2.2 - 0.3, 0, 1), np.clip(norm * 1.6 - 0.5, 0, 1) * 0.9 + 0.05,
                    np.clip(0.35 + norm * 0.2 - norm ** 3 * 0.4, 0, 1)], axis=2)
    rgb = (rgb * norm[..., None] ** 0.5 * 255).astype(np.uint8)
    img.paste(Image.fromarray(rgb, "RGB"), (left, stop))
    for fmark in (100, 1000, 10000):
        yy = sbot - int(np.searchsorted(targets, fmark))
        d.line([left - 6, yy, left, yy], fill=(60, 60, 60))
        d.text((6, yy - 6), "%d Hz" % fmark, fill=(60, 60, 60))

    # seam zoom: last 40 ms followed by first 40 ms
    ztop, zbot = 566, 742
    zmid = (ztop + zbot) // 2
    d.rectangle([left, ztop, right, zbot], outline=(180, 170, 160))
    k = int(0.04 * sr)
    k = min(k, n // 2)
    ring = np.concatenate([mono[-k:], mono[:k]])
    scale = float(np.max(np.abs(ring))) or 1.0
    pts = []
    for i, v in enumerate(ring):
        pts.append((left + i * (cols - 1) / float(len(ring) - 1), zmid - v / scale * (zbot - ztop) * 0.45))
    d.line(pts, fill=(150, 60, 60))
    xm = left + cols // 2
    d.line([xm, ztop, xm, zbot], fill=(40, 120, 60))
    label = "loop seam: last 40 ms | first 40 ms (green line = end of file -> start of file)" if loop else \
        "last 40 ms | first 40 ms"
    d.text((left, zbot + 2), label + "   zoom scale %.1f dBFS" % A.db(scale), fill=(40, 40, 40))
    img.save(path)


def analyze_file(path, loop=None, expect_key=None, png=None, ascii_only=True):
    x, sr = A.load_audio(path)
    if loop is None:
        side = os.path.splitext(path)[0] + ".json"
        loop = True
        if os.path.exists(side):
            try:
                with open(side, encoding="utf-8") as fh:
                    loop = bool(json.load(fh).get("loop", True))
            except (OSError, ValueError):
                pass
    info = A.analyze_array(x, sr, loop=loop)
    keys, chroma = A.key_estimate(x, sr)
    info["key_estimates"] = [{"key": k, "score": round(s, 4)} for k, s in keys]
    info["chroma"] = [round(float(v), 4) for v in chroma]
    info["loop"] = loop
    info["path"] = path
    problems, warnings = [], []
    if info["lufs"] == float("-inf") or info["peak_db"] < -50.0:
        problems.append("file is silent")
    if info["clipped_samples"] > 0:
        problems.append("%d clipped samples" % info["clipped_samples"])
    if info["true_peak_db"] > -0.9:
        problems.append("true peak %.2f dBTP is above -1 dBTP" % info["true_peak_db"])
    if max(abs(v) for v in info["dc_offset"]) > 0.002:
        warnings.append("DC offset above 0.002")
    if info["silence_ratio"] > 0.35:
        warnings.append("%.0f %% of the file is below -60 dBFS" % (100 * info["silence_ratio"]))
    if not -19.0 <= info["lufs"] <= -13.0 and info["lufs"] != float("-inf"):
        warnings.append("loudness %.1f LUFS is far from the -16 LUFS house level" % info["lufs"])
    if sr != 44100 or info["channels"] != 2:
        warnings.append("expected 44.1 kHz stereo, got %d Hz / %d ch" % (sr, info["channels"]))
    if loop:
        verdict, why = A.judge_seam(info["seam"])
        info["seam_verdict"] = verdict
        if verdict == "bad":
            problems.append("loop seam: " + why)
        elif verdict == "warn":
            warnings.append("loop seam: " + why)
    if expect_key:
        want = A.normalize_key_name(expect_key)
        names = [k for k, _ in keys]
        if names[0] == want:
            info["key_check"] = "match"
        elif want in names[:3] or names[0] in A.related_keys(want):
            info["key_check"] = "close"
            warnings.append("key estimate %s is only close to the expected %s (relative/parallel keys and modal "
                            "tunes are easily confused)" % (names[0], want))
        else:
            info["key_check"] = "mismatch"
            problems.append("key estimate %s contradicts the expected key %s" % (names[0], want))
    info["problems"], info["warnings"] = problems, warnings
    info["sparkline"] = A.sparkline(A.short_term_db(x, sr, columns=72), lo=-48.0, hi=-6.0, ascii_only=ascii_only)
    if png:
        make_png(x, sr, png, loop, os.path.basename(path))
    return info


def print_report(info, chroma_line=True):
    print("== %s  (%s)" % (info["path"], "loop" if info["loop"] else "one-shot"))
    print("  duration      %.3f s  (%d samples @ %d Hz, %d ch)" % (
        info["duration"], info["frames"], info["sample_rate"], info["channels"]))
    print("  peak          %.2f dBFS sample, %.2f dBTP true peak, clipped samples: %d" % (
        info["peak_db"], info["true_peak_db"], info["clipped_samples"]))
    print("  loudness      %.2f LUFS integrated, RMS %.2f dBFS, crest %.1f dB" % (
        info["lufs"], info["rms_db"], info["crest_db"]))
    print("  dc offset     L %+.5f  R %+.5f   silence ratio %.1f %%   stereo corr %.2f" % (
        info["dc_offset"][0], info["dc_offset"][-1], 100.0 * info["silence_ratio"],
        info.get("stereo_correlation", 1.0)))
    if info["loop"]:
        s = info["seam"]
        print("  loop seam     jump %.5f (%.1f dB), jump ratio %.2f, click ratio %.2f" % (
            s["jump"], s["jump_db"], s["jump_ratio"], s["click_ratio"]))
        print("                spectral similarity %.3f, tail continuation %.3f, level end/start %.1f / %.1f dB" % (
            s["spectral_sim"], s["tail_continuation"], s["level_end_db"], s["level_start_db"]))
        print("                verdict: %s" % info["seam_verdict"].upper())
    print("  key estimate  " + ", ".join("%s (%.2f)" % (k["key"], k["score"]) for k in info["key_estimates"]))
    if chroma_line:
        print("  chroma        " + chroma_bar(np.array(info["chroma"])))
    print("  level/time    [" + info["sparkline"] + "]  (-48 .. -6 dBFS)")
    for w in info["warnings"]:
        print("  WARNING: " + w)
    for p in info["problems"]:
        print("  FAILED: " + p)
    print("  result        %s" % ("FAILED" if info["problems"] else "OK"))


def main(argv=None):
    ap = argparse.ArgumentParser(description="Check rendered music files (OGG/WAV).")
    ap.add_argument("files", nargs="+")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--loop", dest="loop", action="store_true", default=None, help="treat as a loop")
    g.add_argument("--no-loop", dest="loop", action="store_false", help="treat as a one-shot (skip the seam check)")
    ap.add_argument("--expect-key", default=None, help='e.g. "F major", "A minor", "Dm"')
    ap.add_argument("--png", default=None, help="write a waveform/spectrogram/seam picture (one input file)")
    ap.add_argument("--json", action="store_true", help="print JSON instead of the text report")
    ap.add_argument("--unicode", action="store_true", help="use block characters for the sparkline")
    args = ap.parse_args(argv)
    if args.png and len(args.files) > 1:
        ap.error("--png works with a single input file")
    failed = False
    out = []
    for path in args.files:
        if not os.path.exists(path):
            print("== %s\n  FAILED: file not found" % path)
            failed = True
            continue
        info = analyze_file(path, args.loop, args.expect_key, args.png, ascii_only=not args.unicode)
        failed = failed or bool(info["problems"])
        if args.json:
            clean = {k: (None if isinstance(v, float) and (math.isinf(v) or math.isnan(v)) else v)
                     for k, v in info.items()}
            out.append(clean)
        else:
            print_report(info)
    if args.json:
        print(json.dumps(out if len(out) != 1 else out[0], indent=1))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
