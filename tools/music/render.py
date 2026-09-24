#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""render.py - track module -> MIDI -> fluidsynth -> seamless loop -> lo-fi chain -> -16 LUFS -> OGG.

Usage
    python3 tools/music/render.py tools/music/tracks/<id>.py [more tracks ...]
    python3 tools/music/render.py --all [--jobs 3] [--changed]
Options
    --workdir DIR   scratch directory for the MIDI and intermediate WAVs
                    (default: $MUSIC_SCRATCH or <system temp>/fable51_music)
    --keep          keep the intermediate WAV files (the .mid is always kept in the workdir)
    --no-lofi       skip the lo-fi chain (debugging)
    --no-balance    skip the per-track solo loudness table (saves ~1 s per track)
    --out DIR       output directory (default: ROOT/assets/audio/bgm)

A track module defines
    META = {"id": "town_theme", "loop": True, "lofi": 0.5, "gain_db": 0.0, "tail_beats": 8}
    def build() -> midilib.Song
Optional META keys: "volume" (sidecar volume, default 0.8), "space" (extra hall wash 0..1, default 0.2),
"noise" (tape hiss 0..1, default = lofi), "crackle" (vinyl crackle 0..1, default 0), "key" ("A minor": checked
against the key estimate), "lead" (name of the melody track: warns when it is buried in the mix),
"reverb" / "chorus" (dicts overriding the fluidsynth effect settings), "seed".

Exit status is non-zero when any render fails its checks (silence, clipping, bad loop seam, wrong length).
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import importlib.util
import json
import math
import os
import subprocess
import sys
import tempfile
import time
import traceback

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import audiolib as A  # noqa: E402
import midilib  # noqa: E402

SOUNDFONT = "/usr/share/sounds/sf2/FluidR3_GM.sf2"
SR = 44100
TARGET_LUFS = -16.0
TRUE_PEAK_LIMIT_DB = -1.0
SAMPLE_CEILING_DB = -1.6
MAX_LIMITING_DB = 6.0

REVERB_DEFAULT = {"room-size": 0.72, "damp": 0.40, "width": 0.9, "level": 0.9}
CHORUS_DEFAULT = {"nr": 3, "level": 1.4, "speed": 0.35, "depth": 5.5}

META_DEFAULTS = {"loop": True, "lofi": 0.5, "gain_db": 0.0, "tail_beats": 8.0, "volume": 0.8, "space": 0.2,
                 "noise": None, "crackle": 0.0, "key": None, "seed": 1}


class RenderError(Exception):
    pass


# --------------------------------------------------------------------------------------
# Track loading
# --------------------------------------------------------------------------------------

def load_track(path):
    """Import a track module and return (song, meta)."""
    path = os.path.abspath(path)
    name = "track_" + os.path.splitext(os.path.basename(path))[0]
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None:
        raise RenderError("cannot import %s" % path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if not hasattr(mod, "build") or not hasattr(mod, "META"):
        raise RenderError("%s must define META and build()" % path)
    meta = dict(META_DEFAULTS)
    meta.update(mod.META)
    file_id = os.path.splitext(os.path.basename(path))[0]
    if "id" not in mod.META:
        raise RenderError("%s: META needs an 'id'" % path)
    if meta["id"] != file_id:
        raise RenderError("%s: META['id'] = %r must equal the file name %r" % (path, meta["id"], file_id))
    if not 0.0 <= float(meta["lofi"]) <= 1.0:
        raise RenderError("META['lofi'] must be within 0..1")
    if not -12.0 <= float(meta["gain_db"]) <= 6.0:
        raise RenderError("META['gain_db'] must be within -12..+6 dB")
    song = mod.build()
    if not isinstance(song, midilib.Song):
        raise RenderError("%s: build() must return a midilib.Song" % path)
    return song, meta


# --------------------------------------------------------------------------------------
# Synthesis
# --------------------------------------------------------------------------------------

def fluidsynth_render(mid_path, wav_path, meta):
    rv = dict(REVERB_DEFAULT)
    rv.update(meta.get("reverb") or {})
    ch = dict(CHORUS_DEFAULT)
    ch.update(meta.get("chorus") or {})
    cmd = ["fluidsynth", "-ni", "-g", "0.7", "-r", str(SR), "-O", "float", "-T", "wav",
           "-o", "synth.reverb.active=1", "-o", "synth.chorus.active=1", "-o", "synth.polyphony=512",
           "-o", "synth.cpu-cores=1"]
    for k, v in sorted(rv.items()):
        cmd += ["-o", "synth.reverb.%s=%s" % (k, v)]
    for k, v in sorted(ch.items()):
        cmd += ["-o", "synth.chorus.%s=%s" % (k, v)]
    cmd += ["-F", wav_path, SOUNDFONT, mid_path]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0 or not os.path.exists(wav_path):
        raise RenderError("fluidsynth failed (%d): %s" % (res.returncode, (res.stderr or res.stdout).strip()[-600:]))
    x, sr = A.read_wav(wav_path)
    if sr != SR:
        raise RenderError("fluidsynth wrote %d Hz instead of %d Hz" % (sr, SR))
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1)
    return x[:, :2]


def cut_second_pass(x, loop_samples, xfade_ms=30.0):
    """Keep exactly the second pass [L, 2L) of a twice-rendered loop.  The release/reverb tails of pass one
    ring into the start of pass two, i.e. they wrap around.  The very end is cross-faded into the end of
    pass one (which continues sample-exactly into the kept start), so the seam cannot click even though the
    synth's event timing is only accurate to about a millisecond."""
    L = int(loop_samples)
    if x.shape[0] < 2 * L:
        x = np.vstack([x, np.zeros((2 * L - x.shape[0], x.shape[1]))])
    out = x[L:2 * L].copy()
    n = int(min(xfade_ms * 0.001 * SR, L // 8))
    if n > 1:
        w = (0.5 - 0.5 * np.cos(np.linspace(0.0, math.pi, n)))[:, None]      # 0 -> 1
        out[-n:] = out[-n:] * (1.0 - w) + x[L - n:L] * w
    return out


def trim_oneshot(x, body_samples, fade_seconds=1.2):
    """One-shot: keep the natural tail, cut trailing silence, fade the very end."""
    env = np.max(np.abs(x), axis=1)
    peak = float(np.max(env)) if len(env) else 0.0
    if peak <= 0:
        return x
    loud = np.flatnonzero(env > peak * A.undb(-50.0))
    end = int(loud[-1]) + int(0.3 * SR) if len(loud) else len(x)
    end = max(end, min(int(body_samples), len(x)))
    end = min(end, len(x))
    y = x[:end].copy()
    tail = max(0, end - int(body_samples))
    n = int(min(max(fade_seconds * SR, 0.5 * tail), 0.5 * end))
    if n > 1:
        y[-n:] *= (0.5 + 0.5 * np.cos(np.linspace(0.0, math.pi, n)))[:, None]
    return y


# --------------------------------------------------------------------------------------
# Post processing
# --------------------------------------------------------------------------------------

def space_reverb(x, amount, rng, circular):
    """Soft, dark 'bedroom hall' wash on the whole mix: convolution with a synthetic stereo impulse response
    (decaying band-limited noise).  Circular convolution for loops = the wash wraps around the seam."""
    if amount <= 0:
        return x
    rt60 = 1.4 + 1.8 * amount
    length = A.next_fast_len(int(min(rt60 * 1.3, 5.0) * SR))
    t = np.arange(length) / float(SR)
    pre = int(0.018 * SR)
    irs = []
    f = np.fft.rfftfreq(length, 1.0 / SR)
    colour = (f / (f + 300.0)) ** 2 / (1.0 + (f / 4200.0) ** 2)            # send: high-passed and dark
    for c in range(2):
        noise = rng.standard_normal(length)
        body_hi = noise * np.exp(-6.91 * t / (rt60 * 0.55))
        body_lo = noise * np.exp(-6.91 * t / rt60)
        spec_lo = np.fft.rfft(body_lo) * colour / (1.0 + (f / 1500.0) ** 2)
        spec_hi = np.fft.rfft(body_hi) * colour * (1.0 - 1.0 / (1.0 + (f / 1500.0) ** 2))
        ir = np.fft.irfft(spec_lo + spec_hi, length)
        ir *= np.minimum(1.0, t / 0.03)                                     # soft onset
        ir = np.concatenate([np.zeros(pre), ir])
        for k in range(5):                                                  # a few early reflections
            pos = pre + int(rng.uniform(0.006, 0.07) * SR)
            ir[pos] += rng.choice([-1.0, 1.0]) * 0.25 * float(np.max(np.abs(ir))) * (1.0 - 0.12 * k)
        ir /= math.sqrt(float(np.sum(ir * ir))) + A.EPS
        irs.append(ir)
    wet_gain = A.undb(-24.0 + 16.0 * amount)
    send = np.stack([0.8 * x[:, 0] + 0.2 * x[:, 1], 0.8 * x[:, 1] + 0.2 * x[:, 0]], axis=1)
    wet = A.convolve_ir(send, irs, circular=circular)
    if circular:
        return x + wet_gain * wet
    out = wet_gain * wet                       # one-shot: n + len(ir) frames, the wash is allowed to ring out
    out[:x.shape[0]] += x
    return out


def lofi_chain(x, amount, meta, rng, circular):
    """HP 40 Hz -> wow/flutter -> tape saturation -> gentle low-pass (11 kHz .. 7 kHz) -> narrower lows -> hiss.
    Every stage is periodic over the buffer when ``circular`` is set, so a loop stays seamless."""
    n = x.shape[0]
    a = float(amount)
    # 1. rumble filter (always)
    y = A.apply_response(x, lambda nf: A.biquad_response("highpass", 40.0, SR, nf), SR, circular)
    if a <= 0:
        return y
    # 2. wow & flutter
    y = A.wow_flutter(y, SR, wow_pct=0.05 + 0.20 * a, flutter_pct=0.015 + 0.045 * a, rng=rng, circular=circular)
    # 3. saturation at a defined level (so the amount of 'tape' does not depend on how loud the MIDI was)
    lufs = A.lufs_integrated(y, SR)
    if lufs == float("-inf"):
        return y
    y = y * A.undb(-18.0 - lufs)
    y = A.tape_saturation(y, drive=0.6 + 1.4 * a, bias=0.04 * a)
    y = y - np.mean(y, axis=0, keepdims=True)
    # 4. tone: low-pass + mono-ish lows, done in mid/side
    cutoff = 11000.0 - 4000.0 * a
    mid = 0.5 * (y[:, 0] + y[:, 1])
    side = 0.5 * (y[:, 0] - y[:, 1])
    narrow = min(1.0, 0.45 + 0.55 * a)
    ms = np.stack([mid, side], axis=1)

    def tone(nf):
        # 12 dB/oct at low amounts, blending toward 24 dB/oct at lofi = 1
        first = A.biquad_response("lowpass", cutoff, SR, nf)
        second = A.biquad_response("lowpass", cutoff * 1.2, SR, nf)
        return first * ((1.0 - a) + a * second)

    def resp_mid(nf):
        return tone(nf)

    def resp_side(nf):
        lows = A.biquad_response("lowpass", 170.0, SR, nf)
        return tone(nf) * (1.0 - narrow * lows)

    mid_f = A.apply_response(ms[:, :1], resp_mid, SR, circular)[:, 0]
    side_f = A.apply_response(ms[:, 1:], resp_side, SR, circular)[:, 0] * (1.0 - 0.12 * a)
    y = np.stack([mid_f + side_f, mid_f - side_f], axis=1)
    # 5. noise bed
    noise = a if meta.get("noise") is None else float(meta["noise"])
    crackle = float(meta.get("crackle") or 0.0)
    if noise > 0 or crackle > 0:
        # working level here is -18 LUFS, the master ends up 2 dB hotter: hiss lands at about
        # -66 dBFS RMS (noise 0.1) ... -60 (0.5) ... -54 (1.0) in the final file
        hiss_rms = A.undb(-68.0 + 12.0 * max(noise, 0.0))
        bed = A.noise_bed(n, SR, rng, hiss_rms if noise > 0 else A.undb(-90.0), crackle, circular)
        bed = A.apply_response(bed, tone, SR, circular)
        y = y + bed
    return y


def finalize_loudness(x, target_lufs, circular):
    """Static gain to the target loudness, look-ahead limiter against the ceiling; returns (y, notes)."""
    notes = []
    ceiling = A.undb(SAMPLE_CEILING_DB)
    lufs = A.lufs_integrated(x, SR)
    if lufs == float("-inf"):
        raise RenderError("render is silent (no measurable loudness)")
    y = x * A.undb(target_lufs - lufs)
    total_reduction = 0.0
    for _ in range(3):
        over_db = A.db(A.sample_peak(y) / ceiling)
        if over_db > MAX_LIMITING_DB:
            y = y * A.undb(-(over_db - MAX_LIMITING_DB))
            notes.append("very peaky mix: target loudness lowered by %.1f dB to keep limiting under %.0f dB"
                         % (over_db - MAX_LIMITING_DB, MAX_LIMITING_DB))
        y, red = A.limiter(y, SR, ceiling=ceiling, circular=circular)
        total_reduction = max(total_reduction, red)
        now = A.lufs_integrated(y, SR)
        miss = target_lufs - now
        if abs(miss) < 0.15 or over_db > MAX_LIMITING_DB:
            break
        y = y * A.undb(miss)
    if total_reduction > 0.05:
        notes.append("limiter engaged: max gain reduction %.1f dB" % total_reduction)
    return y, notes


def encode_ogg(wav_path, ogg_path):
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", wav_path, "-map_metadata", "-1", "-bitexact",
           "-c:a", "libvorbis", "-q:a", "5", "-ar", str(SR), "-ac", "2", ogg_path]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RenderError("ffmpeg/libvorbis failed: %s" % res.stderr.strip()[-400:])


# --------------------------------------------------------------------------------------
# Report
# --------------------------------------------------------------------------------------

def format_report(info, extra=None, loop=True):
    lines = []
    lines.append("  duration      %.3f s  (%d samples @ %d Hz, %d ch)" % (
        info["duration"], info["frames"], info["sample_rate"], info["channels"]))
    lines.append("  peak          %.2f dBFS sample, %.2f dBTP true peak, clipped samples: %d" % (
        info["peak_db"], info["true_peak_db"], info["clipped_samples"]))
    lines.append("  loudness      %.2f LUFS integrated, RMS %.2f dBFS, crest %.1f dB" % (
        info["lufs"], info["rms_db"], info["crest_db"]))
    lines.append("  dc offset     L %+.5f  R %+.5f   silence ratio %.1f %%   stereo corr %.2f" % (
        info["dc_offset"][0], info["dc_offset"][-1], 100.0 * info["silence_ratio"],
        info.get("stereo_correlation", 1.0)))
    if loop and "seam" in info:
        s = info["seam"]
        verdict, why = A.judge_seam(s)
        lines.append("  loop seam     jump %.5f (%.1f dB), jump ratio %.2f, click ratio %.2f" % (
            s["jump"], s["jump_db"], s["jump_ratio"], s["click_ratio"]))
        lines.append("                spectral similarity %.3f, tail continuation %.3f, level end/start %.1f / %.1f dB" % (
            s["spectral_sim"], s["tail_continuation"], s["level_end_db"], s["level_start_db"]))
        lines.append("                verdict: %s - %s" % (verdict.upper(), why))
    if extra:
        lines.extend(extra)
    return "\n".join(lines)


# --------------------------------------------------------------------------------------
# Mix balance (solo stems)
# --------------------------------------------------------------------------------------

def balance_report(song, meta, workdir, tid):
    """Render every track solo (one pass) and measure its loudness: composers cannot listen, but they can
    read which instrument dominates.  Returns (lines, warnings)."""
    tracks = [t for t in song.tracks if t.notes]

    def solo(t):
        safe = "".join(ch if ch.isalnum() else "_" for ch in t.name)
        mid = os.path.join(workdir, "%s.solo_%s.mid" % (tid, safe))
        wav = os.path.join(workdir, "%s.solo_%s.wav" % (tid, safe))
        song.save(mid, repeats=1, tail_beats=4.0, solo=[t.name])
        x = fluidsynth_render(mid, wav, meta)
        for p in (mid, wav):
            try:
                os.unlink(p)
            except OSError:
                pass
        # momentary-ish activity: share of 400 ms blocks above -50 dBFS
        mono = np.mean(x, axis=1)
        blk = int(0.4 * SR)
        nb = max(1, len(mono) // blk)
        rms = np.sqrt(np.mean(mono[:nb * blk].reshape(nb, blk) ** 2, axis=1))
        active = float(np.mean(rms > A.undb(-50.0)))
        return t, A.lufs_integrated(x, SR), A.db(A.sample_peak(x)), active

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(solo, tracks))
    finite = [r[1] for r in rows if r[1] != float("-inf")]
    lines, warnings = [], []
    if not finite:
        return lines, warnings
    top = max(finite)
    lines.append("  mix balance   solo loudness of each track (gated LUFS while it plays), relative to the loudest")
    for t, lufs, peak, active in rows:
        if lufs == float("-inf"):
            lines.append("    %-14s silent!" % t.name[:14])
            warnings.append("track %r renders silent" % t.name)
            continue
        rel = lufs - top
        bar = "#" * max(1, int(round(20 + rel))) if rel > -20 else "."
        lines.append("    %-14s %+6.1f LU  peak %6.1f dBFS  active %3.0f %%  %s" % (t.name[:14], rel, peak, 100 * active, bar))
    lead = meta.get("lead")
    if lead:
        hit = [r for r in rows if r[0].name == lead]
        if not hit:
            warnings.append("META['lead'] = %r is not a track name" % lead)
        elif hit[0][1] - top < -5.0:
            warnings.append("lead track %r sits %.1f LU below the loudest track - the tune may be buried"
                            % (lead, top - hit[0][1]))
    return lines, warnings


# --------------------------------------------------------------------------------------
# One track
# --------------------------------------------------------------------------------------

def default_workdir():
    base = os.environ.get("MUSIC_SCRATCH") or os.path.join(tempfile.gettempdir(), "fable51_music")
    os.makedirs(base, exist_ok=True)
    return base


def render_track(path, workdir=None, out_dir=None, keep=False, no_lofi=False, quiet=False, balance=True):
    """Render one track module.  Returns a dict with 'ok', 'id', 'log' (text) and the analysis."""
    t0 = time.time()
    log = []

    def say(msg=""):
        log.append(msg)
        if not quiet:
            print(msg, flush=True)

    workdir = workdir or default_workdir()
    out_dir = out_dir or os.path.join(ROOT, "assets", "audio", "bgm")
    os.makedirs(workdir, exist_ok=True)
    os.makedirs(out_dir, exist_ok=True)
    result = {"ok": False, "path": path, "id": os.path.splitext(os.path.basename(path))[0]}
    try:
        song, meta = load_track(path)
        tid = meta["id"]
        loop = bool(meta["loop"])
        say("== %s  (%s, lofi %.2f, space %.2f, gain %+.1f dB)" % (
            tid, "LOOP" if loop else "one-shot", meta["lofi"], meta["space"], meta["gain_db"]))
        say(song.summary())
        for w in song.lint():
            say("  lint: " + w)

        mid_path = os.path.join(workdir, tid + ".mid")
        raw_path = os.path.join(workdir, tid + ".raw.wav")
        fin_path = os.path.join(workdir, tid + ".final.wav")
        ogg_path = os.path.join(out_dir, tid + ".ogg")
        json_path = os.path.join(out_dir, tid + ".json")

        tail_beats = max(float(meta["tail_beats"]), 2.0)
        song.save(mid_path, repeats=2 if loop else 1, tail_beats=tail_beats)
        if song.last_trimmed:
            say("  note: %d overlapping same-pitch note(s) were trimmed" % song.last_trimmed)
        loop_seconds = song.loop_seconds()
        L = int(round(loop_seconds * SR))

        x = fluidsynth_render(mid_path, raw_path, meta)
        raw_peak = A.sample_peak(x)
        if raw_peak < A.undb(-70.0):
            raise RenderError("fluidsynth output is silent (peak %.1f dBFS)" % A.db(raw_peak))
        say("  synth         %.2f s rendered, raw peak %.2f dBFS%s" % (
            x.shape[0] / float(SR), A.db(raw_peak), "  (hot mix: consider lower CC7/velocities)" if raw_peak > 1.0 else ""))

        balance_warnings = []
        if balance:
            blines, balance_warnings = balance_report(song, meta, workdir, tid)
            for bl in blines:
                say(bl)

        seed_material = "%s|%s" % (meta.get("seed", 1), tid)
        rng = np.random.default_rng(int(hashlib.sha256(seed_material.encode()).hexdigest()[:12], 16))
        if loop:
            y = cut_second_pass(x, L)
            y = space_reverb(y, float(meta["space"]), rng, circular=True)
        else:
            y = space_reverb(x, float(meta["space"]), rng, circular=False)
            y = trim_oneshot(y, L)
        del x
        y = lofi_chain(y, 0.0 if no_lofi else float(meta["lofi"]), meta, rng, circular=loop)
        if not loop:
            n = int(min(0.4 * SR, y.shape[0] // 4))
            if n > 1:                                   # keep the hiss bed from starting/ending abruptly
                y[-n:] *= (0.5 + 0.5 * np.cos(np.linspace(0.0, math.pi, n)))[:, None]
                k = int(0.01 * SR)
                y[:k] *= np.linspace(0.0, 1.0, k)[:, None]
        target = TARGET_LUFS + float(meta["gain_db"])
        y, notes = finalize_loudness(y, target, circular=loop)
        for nmsg in notes:
            say("  note: " + nmsg)

        # encode, then verify the DECODED ogg (that is what the game plays); back off if the codec overshoots
        info = None
        for attempt in range(4):
            A.write_wav_float32(fin_path, y, SR)
            encode_ogg(fin_path, ogg_path)
            dec, dsr = A.load_audio(ogg_path)
            info = A.analyze_array(dec, dsr, loop=loop)
            excess = info["true_peak_db"] - TRUE_PEAK_LIMIT_DB
            if excess <= 0.0:
                break
            y = y * A.undb(-(excess + 0.15))
        with open(json_path, "w", encoding="utf-8") as fh:
            json.dump({"loop": loop, "volume": float(meta["volume"])}, fh)
            fh.write("\n")

        extra = []
        keys, _chroma = A.key_estimate(dec, dsr)
        extra.append("  key estimate  " + ", ".join("%s (%.2f)" % k for k in keys))
        extra.append("  level/time    [" + A.sparkline(A.short_term_db(dec, dsr), lo=-48.0, hi=-6.0) + "]")
        size_kb = os.path.getsize(ogg_path) / 1024.0
        shown = os.path.relpath(ogg_path, ROOT) if os.path.abspath(ogg_path).startswith(ROOT + os.sep) else ogg_path
        extra.append("  output        %s  (%.0f KB)  + %s" % (shown, size_kb, os.path.basename(json_path)))
        say(format_report(info, extra, loop))

        problems = []
        warnings = list(balance_warnings)
        if info["lufs"] == float("-inf") or info["peak_db"] < -50.0:
            problems.append("output is silent")
        if info["clipped_samples"] > 0:
            problems.append("%d clipped samples" % info["clipped_samples"])
        if info["true_peak_db"] > TRUE_PEAK_LIMIT_DB + 0.1:
            problems.append("true peak %.2f dBTP above %.1f" % (info["true_peak_db"], TRUE_PEAK_LIMIT_DB))
        if abs(info["lufs"] - target) > 1.0:
            warnings.append("loudness %.2f LUFS misses the target %.1f by more than 1 LU" % (info["lufs"], target))
        if loop:
            if info["frames"] != L:
                problems.append("decoded length %d samples differs from the loop length %d" % (info["frames"], L))
            verdict, why = A.judge_seam(info["seam"])
            if verdict == "bad":
                problems.append("loop seam: " + why)
            elif verdict == "warn":
                warnings.append("loop seam: " + why)
        if info["silence_ratio"] > 0.35:
            warnings.append("%.0f %% of the track is below -60 dBFS" % (100 * info["silence_ratio"]))
        if meta.get("key"):
            want = A.normalize_key_name(meta["key"])
            names = [k[0] for k in keys]
            if names[0] == want:
                say("  key check     OK: estimate matches META key %s" % want)
            elif want in names[:3] or names[0] in A.related_keys(want):
                say("  key check     close: META key %s, estimate %s (relative/parallel keys are easily confused)"
                    % (want, names[0]))
            else:
                warnings.append("key estimate %s does not match META key %s" % (names[0], want))
        for w in warnings:
            say("  WARNING: " + w)
        for p in problems:
            say("  FAILED: " + p)
        if not keep:
            for p in (raw_path, fin_path):
                try:
                    os.unlink(p)
                except OSError:
                    pass
        result.update(ok=not problems, id=tid, info=info, problems=problems, warnings=warnings, ogg=ogg_path,
                      seconds=time.time() - t0)
        say("  %s in %.1f s" % ("OK" if not problems else "FAILED", time.time() - t0))
    except Exception as exc:  # noqa: BLE001 - report every failure loudly, keep --all going
        detail = traceback.format_exc() if not isinstance(exc, (RenderError, ValueError)) else ""
        if not log:
            say("== %s" % result["id"])
        say("  FAILED: %s: %s" % (type(exc).__name__, exc))
        if detail:
            say(detail)
        result.update(ok=False, problems=[str(exc)], warnings=[])
    result["log"] = "\n".join(log)
    return result


def _job(args):
    path, workdir, out_dir, keep, no_lofi, balance = args
    return render_track(path, workdir, out_dir, keep, no_lofi, quiet=True, balance=balance)


def main(argv=None):
    ap = argparse.ArgumentParser(description="Render track modules to seamless lo-fi OGG loops.")
    ap.add_argument("tracks", nargs="*", help="track module(s), e.g. tools/music/tracks/town_theme.py")
    ap.add_argument("--all", action="store_true", help="render every module in tools/music/tracks/")
    ap.add_argument("--changed", action="store_true", help="with --all: skip tracks whose OGG is newer than the sources")
    ap.add_argument("--jobs", type=int, default=3, help="parallel renders for several tracks (default 3)")
    ap.add_argument("--workdir", default=None)
    ap.add_argument("--out", default=None)
    ap.add_argument("--keep", action="store_true")
    ap.add_argument("--no-lofi", action="store_true")
    ap.add_argument("--no-balance", action="store_true", help="skip the per-track solo loudness table")
    args = ap.parse_args(argv)

    paths = list(args.tracks)
    if args.all:
        tdir = os.path.join(HERE, "tracks")
        paths += [os.path.join(tdir, f) for f in sorted(os.listdir(tdir)) if f.endswith(".py") and not f.startswith("_")]
    if not paths:
        ap.error("give at least one track module or --all")
    out_dir = args.out or os.path.join(ROOT, "assets", "audio", "bgm")
    if args.changed:
        tool_mtime = max(os.path.getmtime(os.path.join(HERE, f)) for f in ("midilib.py", "render.py", "audiolib.py"))
        fresh = []
        for p in paths:
            ogg = os.path.join(out_dir, os.path.splitext(os.path.basename(p))[0] + ".ogg")
            if os.path.exists(ogg) and os.path.getmtime(ogg) > max(os.path.getmtime(p), tool_mtime):
                print("up to date: %s" % os.path.basename(p))
            else:
                fresh.append(p)
        paths = fresh
    results = []
    if len(paths) <= 1 or args.jobs <= 1:
        for p in paths:
            results.append(render_track(p, args.workdir, out_dir, args.keep, args.no_lofi,
                                        balance=not args.no_balance))
    else:
        jobs = [(p, args.workdir, out_dir, args.keep, args.no_lofi, not args.no_balance) for p in paths]
        with concurrent.futures.ProcessPoolExecutor(max_workers=args.jobs) as pool:
            for res in pool.map(_job, jobs):
                print(res["log"], flush=True)
                results.append(res)
    if len(results) > 1:
        print("\n== summary")
        for r in results:
            status = "OK    " if r["ok"] else "FAILED"
            detail = ""
            if r.get("info"):
                detail = "%7.2f s  %6.2f LUFS  %6.2f dBTP" % (r["info"]["duration"], r["info"]["lufs"],
                                                              r["info"]["true_peak_db"])
            print("  %s %-28s %s %s" % (status, r["id"], detail, "; ".join(r.get("problems") or [])))
    failed = [r for r in results if not r["ok"]]
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
