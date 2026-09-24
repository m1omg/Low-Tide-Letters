#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""audiolib - numpy-only audio helpers shared by render.py, analyze.py and probe.py.

WAV I/O (PCM 16/24/32 and float), FFT-domain biquad filtering (exactly loop-periodic when
``circular=True``), BS.1770 integrated loudness, true-peak estimate, look-ahead limiter,
loop-safe wow/flutter, tape saturation, noise bed, loop-seam metrics, chromagram key estimate
and an ASCII sparkline.  No scipy.
"""

from __future__ import annotations

import math
import os
import struct
import subprocess
import tempfile

import numpy as np

EPS = 1e-12


def db(x):
    """Amplitude ratio -> dB (floor at -200)."""
    return 20.0 * math.log10(max(float(x), 1e-10))


def undb(d):
    return 10.0 ** (d / 20.0)


# --------------------------------------------------------------------------------------
# WAV I/O
# --------------------------------------------------------------------------------------

def read_wav(path):
    """Read a RIFF/WAVE file -> (float64 array of shape (frames, channels), sample_rate)."""
    with open(path, "rb") as fh:
        data = fh.read()
    if data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise ValueError("%s is not a RIFF/WAVE file" % path)
    pos = 12
    fmt = None
    audio = None
    while pos + 8 <= len(data):
        cid = data[pos:pos + 4]
        (size,) = struct.unpack("<I", data[pos + 4:pos + 8])
        body = data[pos + 8:pos + 8 + size]
        if cid == b"fmt ":
            tag, ch, sr, _br, _align, bits = struct.unpack("<HHIIHH", body[:16])
            if tag == 0xFFFE and len(body) >= 26:
                tag = struct.unpack("<H", body[24:26])[0]
            fmt = (tag, ch, sr, bits)
        elif cid == b"data":
            if size == 0xFFFFFFFF or pos + 8 + size > len(data):
                body = data[pos + 8:]
            audio = body
            break
        pos += 8 + size + (size & 1)
    if fmt is None or audio is None:
        raise ValueError("%s: missing fmt or data chunk" % path)
    tag, ch, sr, bits = fmt
    if tag == 3 and bits == 32:
        arr = np.frombuffer(audio[:len(audio) // 4 * 4], dtype="<f4").astype(np.float64)
    elif tag == 3 and bits == 64:
        arr = np.frombuffer(audio[:len(audio) // 8 * 8], dtype="<f8").astype(np.float64)
    elif tag == 1 and bits == 16:
        arr = np.frombuffer(audio[:len(audio) // 2 * 2], dtype="<i2").astype(np.float64) / 32768.0
    elif tag == 1 and bits == 32:
        arr = np.frombuffer(audio[:len(audio) // 4 * 4], dtype="<i4").astype(np.float64) / 2147483648.0
    elif tag == 1 and bits == 24:
        raw = np.frombuffer(audio[:len(audio) // 3 * 3], dtype=np.uint8).reshape(-1, 3).astype(np.int32)
        val = raw[:, 0] | (raw[:, 1] << 8) | (raw[:, 2] << 16)
        val = np.where(val >= 1 << 23, val - (1 << 24), val)
        arr = val.astype(np.float64) / 8388608.0
    elif tag == 1 and bits == 8:
        arr = (np.frombuffer(audio, dtype=np.uint8).astype(np.float64) - 128.0) / 128.0
    else:
        raise ValueError("%s: unsupported WAV format tag %d with %d bits" % (path, tag, bits))
    frames = len(arr) // ch
    return arr[:frames * ch].reshape(frames, ch), sr


def write_wav_float32(path, x, sr):
    """Write float32 WAVE (format tag 3).  ``x`` has shape (frames, channels)."""
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = x[:, None]
    frames, ch = x.shape
    payload = x.astype("<f4").tobytes()
    fmt = struct.pack("<HHIIHH", 3, ch, int(sr), int(sr) * ch * 4, ch * 4, 32)
    fact = struct.pack("<I", frames)
    chunks = b"fmt " + struct.pack("<I", len(fmt)) + fmt + b"fact" + struct.pack("<I", 4) + fact
    chunks += b"data" + struct.pack("<I", len(payload)) + payload
    with open(path, "wb") as fh:
        fh.write(b"RIFF" + struct.pack("<I", 4 + len(chunks)) + b"WAVE" + chunks)


def load_audio(path):
    """Read WAV directly, anything else (OGG ...) through ffmpeg.  -> (array (frames, ch), sr)"""
    if path.lower().endswith(".wav"):
        try:
            return read_wav(path)
        except ValueError:
            pass
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp.close()
    try:
        cmd = ["ffmpeg", "-v", "error", "-y", "-i", path, "-c:a", "pcm_f32le", "-f", "wav", tmp.name]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            raise RuntimeError("ffmpeg could not decode %s: %s" % (path, res.stderr.strip()))
        return read_wav(tmp.name)
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


# --------------------------------------------------------------------------------------
# Filters in the FFT domain
# --------------------------------------------------------------------------------------

def _biquad(kind, fc, sr, q=0.70710678, gain_db=0.0):
    w0 = 2.0 * math.pi * fc / sr
    cw, sw = math.cos(w0), math.sin(w0)
    alpha = sw / (2.0 * q)
    if kind == "lowpass":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "highpass":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "bandpass":
        b = [alpha, 0.0, -alpha]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "highshelf":
        A = 10.0 ** (gain_db / 40.0)
        s = 2.0 * math.sqrt(A) * alpha
        b = [A * ((A + 1) + (A - 1) * cw + s), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - s)]
        a = [(A + 1) - (A - 1) * cw + s, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - s]
    else:
        raise ValueError(kind)
    return np.array(b) / a[0], np.array(a) / a[0]


def biquad_response(kind, fc, sr, n, q=0.70710678, gain_db=0.0):
    """Complex frequency response of an RBJ biquad on the rfft grid of an n-sample signal."""
    b, a = _biquad(kind, fc, sr, q, gain_db)
    w = 2.0 * math.pi * np.arange(n // 2 + 1) / n
    z1 = np.exp(-1j * w)
    z2 = z1 * z1
    return (b[0] + b[1] * z1 + b[2] * z2) / (a[0] + a[1] * z1 + a[2] * z2)


def next_fast_len(n):
    """Smallest 2^a * 3^b * 5^c >= n (FFT sizes with large prime factors are ~10x slower)."""
    n = int(n)
    best = 1 << max(1, (n - 1).bit_length())
    p5 = 1
    while p5 < best:
        p35 = p5
        while p35 < best:
            v = p35
            while v < n:
                v *= 2
            best = min(best, v)
            p35 *= 3
        p5 *= 5
    return best


def wrap_prefix(x, count):
    """The last ``count`` frames of x, tiling x when it is shorter than that (used as circular pre-roll)."""
    n = x.shape[0]
    if count <= n:
        return x[n - count:]
    reps = int(math.ceil(count / float(n)))
    return np.concatenate([x] * reps, axis=0)[reps * n - count:]


def apply_response(x, response_fn, sr, circular=True, pad_seconds=1.0):
    """Filter every channel of ``x`` (frames, ch) with a CAUSAL response H = response_fn(n_fft).

    circular=True  -> loop-safe: the filter is warmed up with the END of the buffer (pre-roll of pad_seconds),
                      i.e. it behaves as if the loop had been playing forever.  Exact up to the part of the
                      impulse response that lies beyond pad_seconds (nothing, for the biquads used here).
    circular=False -> starts from silence."""
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = x[:, None]
    n = x.shape[0]
    pad = int(pad_seconds * sr)
    pre = wrap_prefix(x, pad) if circular else np.zeros((0, x.shape[1]))
    nfft = next_fast_len(len(pre) + n + pad)
    H = response_fn(nfft)
    out = np.empty((n, x.shape[1]))
    buf = np.zeros(nfft)
    for c in range(x.shape[1]):
        buf[:] = 0.0
        buf[:len(pre)] = pre[:, c]
        buf[len(pre):len(pre) + n] = x[:, c]
        out[:, c] = np.fft.irfft(np.fft.rfft(buf) * H, nfft)[len(pre):len(pre) + n]
    return out


def convolve_ir(x, irs, circular=True):
    """Convolve channel c of x with irs[c] (FIR).  circular=True gives the exact periodic (loop) result by
    pre-rolling with the end of the buffer; circular=False returns n + len(ir) frames (the tail is kept)."""
    x = np.asarray(x, dtype=np.float64)
    n = x.shape[0]
    m = max(len(ir) for ir in irs)
    pre = wrap_prefix(x, m) if circular else np.zeros((0, x.shape[1]))
    total = len(pre) + n + m
    nfft = next_fast_len(total)
    keep = n if circular else n + m
    out = np.empty((keep, x.shape[1]))
    buf = np.zeros(nfft)
    for c in range(x.shape[1]):
        buf[:] = 0.0
        buf[:len(pre)] = pre[:, c]
        buf[len(pre):len(pre) + n] = x[:, c]
        H = np.fft.rfft(irs[c], nfft)
        out[:, c] = np.fft.irfft(np.fft.rfft(buf) * H, nfft)[len(pre):len(pre) + keep]
    return out


# --------------------------------------------------------------------------------------
# Loudness / peaks
# --------------------------------------------------------------------------------------

def k_weight(x, sr):
    """BS.1770 K-weighting (high shelf +4 dB @1.5 kHz, high-pass 38 Hz) applied via FFT."""
    def resp(n):
        return (biquad_response("highshelf", 1500.0, sr, n, q=1.0 / math.sqrt(2.0), gain_db=4.0)
                * biquad_response("highpass", 38.0, sr, n, q=0.5))
    return apply_response(x, resp, sr, circular=True)


def lufs_integrated(x, sr):
    """Integrated loudness (ITU-R BS.1770-4 gating) in LUFS.  Returns -inf for silence."""
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = x[:, None]
    if x.shape[0] < int(0.4 * sr):
        x = np.vstack([x, np.zeros((int(0.4 * sr) - x.shape[0] + 1, x.shape[1]))])
    y = k_weight(x, sr)
    block, hop = int(round(0.4 * sr)), int(round(0.1 * sr))
    sq = np.sum(y * y, axis=1)
    cs = np.concatenate([[0.0], np.cumsum(sq)])
    starts = np.arange(0, len(sq) - block + 1, hop)
    ms = (cs[starts + block] - cs[starts]) / block
    if len(ms) == 0:
        return float("-inf")
    loud = -0.691 + 10.0 * np.log10(np.maximum(ms, 1e-20))
    keep = ms[loud > -70.0]
    if len(keep) == 0:
        return float("-inf")
    rel = -0.691 + 10.0 * math.log10(float(np.mean(keep))) - 10.0
    keep2 = ms[(loud > -70.0) & (loud > rel)]
    if len(keep2) == 0:
        return float("-inf")
    return -0.691 + 10.0 * math.log10(float(np.mean(keep2)))


def short_term_db(x, sr, window=1.0, columns=64):
    """RMS level in dBFS of ``columns`` equal slices (for the sparkline)."""
    mono = np.mean(np.asarray(x, dtype=np.float64), axis=1) if np.ndim(x) > 1 else np.asarray(x, dtype=np.float64)
    n = len(mono)
    columns = max(1, min(columns, n))
    edges = np.linspace(0, n, columns + 1).astype(int)
    out = []
    for i in range(columns):
        seg = mono[edges[i]:max(edges[i + 1], edges[i] + 1)]
        out.append(db(math.sqrt(float(np.mean(seg * seg)) + 1e-20)))
    return out


def sparkline(values, lo=-60.0, hi=0.0, ascii_only=True):
    """Levels -> one-line sparkline.  ASCII ramp by default."""
    ramp = " .:-=+*#%@" if ascii_only else " ▁▂▃▄▅▆▇█"
    out = []
    for v in values:
        u = (min(max(v, lo), hi) - lo) / (hi - lo)
        out.append(ramp[int(round(u * (len(ramp) - 1)))])
    return "".join(out)


def sample_peak(x):
    return float(np.max(np.abs(x))) if np.size(x) else 0.0


def true_peak(x, oversample=8, max_windows=400):
    """Inter-sample ('true') peak estimate: band-limited 8x interpolation around the largest samples."""
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = x[:, None]
    n = x.shape[0]
    best = sample_peak(x)
    if n < 64 or best <= 0:
        return best
    half = 32
    for c in range(x.shape[1]):
        ch = x[:, c]
        mag = np.abs(ch)
        thresh = best * 0.70
        cand = np.flatnonzero(mag >= thresh)
        if len(cand) == 0:
            continue
        if len(cand) > max_windows:
            cand = cand[np.argsort(mag[cand])[-max_windows:]]
        done = np.zeros(0, dtype=int)
        for idx in cand[np.argsort(-mag[cand])]:
            if len(done) and np.min(np.abs(done - idx)) < half // 2:
                continue
            done = np.append(done, idx)
            lo, hi = idx - half, idx + half
            seg = np.take(ch, np.arange(lo, hi), mode="wrap") * np.hanning(2 * half + 1)[:-1] ** 0.25
            spec = np.fft.rfft(seg)
            up = np.fft.irfft(np.concatenate([spec, np.zeros(len(spec) * (oversample - 1))]), 2 * half * oversample)
            up *= oversample
            mid = up[len(up) // 4: 3 * len(up) // 4]
            best = max(best, float(np.max(np.abs(mid))))
    return best


def sliding_max(a, width, circular=True):
    """Maximum over the window [n, n + width) for every n (log-time doubling; circular or zero-padded)."""
    a = np.asarray(a, dtype=np.float64)
    width = int(max(1, width))
    if not circular:
        a = np.concatenate([a, np.zeros(width)])
    out = a.copy()
    span = 1
    while span < width:
        shift = min(span, width - span)
        out = np.maximum(out, np.roll(out, -shift))
        span += shift
    return out if circular else out[:len(out) - width]


def limiter(x, sr, ceiling=0.84, lookahead_ms=6.0, release_db_per_s=60.0, circular=True):
    """Transparent look-ahead peak limiter (linked stereo).  Returns (y, max_gain_reduction_db)."""
    x = np.asarray(x, dtype=np.float64)
    env = np.max(np.abs(x), axis=1)
    if float(np.max(env)) <= ceiling:
        return x, 0.0
    n = len(env)
    gr = np.maximum(0.0, 20.0 * np.log10(np.maximum(env, 1e-9) / ceiling))      # needed reduction in dB
    w = max(2, int(lookahead_ms * 0.001 * sr))
    gr = sliding_max(gr, w, circular)
    gr = np.roll(gr, w // 2) if circular else np.concatenate([np.zeros(w // 2), gr])[:n]
    # linear-in-dB release via a running maximum (two laps when circular so the state is periodic)
    d = release_db_per_s / sr
    src = np.concatenate([gr, gr]) if circular else gr
    k = np.arange(len(src), dtype=np.float64)
    rel = np.maximum.accumulate(src + d * k) - d * k
    rel = rel[n:] if circular else rel
    # attack smoothing: moving average over the look-ahead window (keeps gain <= required gain)
    kernel_src = np.concatenate([rel[-w:], rel, rel[:w]]) if circular else np.concatenate([np.zeros(w), rel, np.zeros(w)])
    cs = np.concatenate([[0.0], np.cumsum(kernel_src)])
    lo = np.arange(n) + w - w // 2
    smooth = (cs[lo + w] - cs[lo]) / w
    smooth = np.maximum(smooth, 0.0)
    gain = 10.0 ** (-smooth / 20.0)
    y = x * gain[:, None]
    over = float(np.max(np.abs(y)))
    if over > ceiling:                       # numerical safety net
        y *= ceiling / over
    return y, float(np.max(smooth))


# --------------------------------------------------------------------------------------
# Lo-fi building blocks (all loop-safe when circular=True)
# --------------------------------------------------------------------------------------

def wow_flutter(x, sr, wow_pct, flutter_pct, rng, circular=True):
    """Slow pitch wobble: time-varying delay made of sinusoids.  When circular, every sinusoid completes a
    whole number of cycles over the loop and the read index wraps, so the result loops seamlessly."""
    x = np.asarray(x, dtype=np.float64)
    n = x.shape[0]
    T = n / float(sr)
    comps = [(0.47, wow_pct * 0.7), (1.13, wow_pct * 0.3), (6.7, flutter_pct * 0.7), (9.1, flutter_pct * 0.3)]
    t = np.arange(n, dtype=np.float64) / sr
    delay = np.zeros(n)
    for f, pct in comps:
        if pct <= 0:
            continue
        if circular:
            f = max(1.0, round(f * T)) / T
        amp = (pct / 100.0) * sr / (2.0 * math.pi * f)        # samples of delay swing for that pitch deviation
        delay += amp * np.sin(2.0 * math.pi * f * t + rng.uniform(0, 2 * math.pi))
    pos = np.arange(n, dtype=np.float64) + delay
    i0 = np.floor(pos).astype(np.int64)
    fr = (pos - i0)[:, None]
    mode = "wrap" if circular else "clip"
    pm1 = np.take(x, i0 - 1, axis=0, mode=mode)
    p0 = np.take(x, i0, axis=0, mode=mode)
    p1 = np.take(x, i0 + 1, axis=0, mode=mode)
    p2 = np.take(x, i0 + 2, axis=0, mode=mode)
    # Catmull-Rom cubic interpolation
    return p0 + 0.5 * fr * (p1 - pm1 + fr * (2.0 * pm1 - 5.0 * p0 + 4.0 * p1 - p2 + fr * (3.0 * (p0 - p1) + p2 - pm1)))


def tape_saturation(x, drive, bias=0.0):
    """Soft tanh saturation with unity small-signal gain and optional even-harmonic bias."""
    if drive <= 0:
        return x
    y = (np.tanh(drive * (x + bias)) - math.tanh(drive * bias)) / drive
    return y / (1.0 - math.tanh(drive * bias) ** 2)


def noise_bed(n, sr, rng, hiss_rms, crackle=0.0, circular=True):
    """Stereo tape hiss (+ optional sparse vinyl crackle).  For loops the hiss is made periodic with an
    equal-power wrap cross-fade and the crackle is filtered circularly, so the bed is loop-safe."""
    xf = int(min(0.5 * sr, n // 2)) if circular else 0
    m = next_fast_len(n + xf)
    f = np.fft.rfftfreq(m, 1.0 / sr)
    shape = np.sqrt(1.0 + (f / 2500.0) ** 2) / (1.0 + (f / 9000.0) ** 4)
    shape += 3.0 / (1.0 + (f / 60.0) ** 2)               # a little low rumble
    shape[0] = 0.0
    out = np.zeros((n, 2))
    common = rng.standard_normal(m)
    for c in range(2):
        white = 0.6 * common + 0.8 * rng.standard_normal(m)
        y = np.fft.irfft(np.fft.rfft(white) * shape, m)
        seg = y[:n].copy()
        if xf > 1:
            w = np.linspace(0.0, 1.0, xf)
            seg[:xf] = seg[:xf] * np.sqrt(w) + y[n:n + xf] * np.sqrt(1.0 - w)   # seg[0] continues y[n-1]
        out[:, c] = seg
    rms = math.sqrt(float(np.mean(out * out))) + EPS
    out *= hiss_rms / rms
    if crackle > 0:
        T = n / float(sr)
        count = int(T * (1.5 + 4.0 * crackle))
        imp = np.zeros((n, 2))
        pos = rng.integers(0, n, size=count)
        amp = hiss_rms * 10.0 ** rng.uniform(0.6, 1.5, size=count) * rng.choice([-1.0, 1.0], size=count) * crackle
        pan = rng.uniform(0.2, 0.8, size=count)
        np.add.at(imp[:, 0], pos, amp * (1.0 - pan))
        np.add.at(imp[:, 1], pos, amp * pan)
        out += 6.0 * apply_response(imp, lambda nf: biquad_response("bandpass", 2800.0, sr, nf, q=0.9), sr, circular)
    return out


# --------------------------------------------------------------------------------------
# Loop seam metrics
# --------------------------------------------------------------------------------------

def _band_energies(seg, sr, nbands=24):
    win = np.hanning(len(seg))
    spec = np.abs(np.fft.rfft(seg * win)) ** 2
    f = np.fft.rfftfreq(len(seg), 1.0 / sr)
    edges = np.geomspace(40.0, min(16000.0, sr / 2.0), nbands + 1)
    out = np.zeros(nbands)
    for b in range(nbands):
        m = (f >= edges[b]) & (f < edges[b + 1])
        if np.any(m):
            out[b] = float(np.sum(spec[m]))
    return out


def _partial_continuation(last, first, sr, count=10):
    """Energy-weighted share of the strongest spectral partials of the ending that are still present at the
    same frequencies in the beginning.  A release/reverb tail that wraps around keeps its partials (~0.7-1.0);
    a tail that was simply cut off loses them (~0.5 and below)."""
    win = np.hanning(len(last))
    a = np.abs(np.fft.rfft(last * win)) ** 2
    b = np.abs(np.fft.rfft(first * win)) ** 2
    f = np.fft.rfftfreq(len(last), 1.0 / sr)
    a = a * ((f > 60.0) & (f < 6000.0))
    inner = a[1:-1]
    peaks = np.flatnonzero((inner > a[:-2]) & (inner >= a[2:])) + 1
    if len(peaks) == 0 or float(np.sum(a)) <= 0:
        return 1.0
    peaks = peaks[np.argsort(-a[peaks])][:count]
    num = den = 0.0
    for i in peaks:
        ea = float(np.sum(a[i - 1:i + 2]))
        eb = float(np.sum(b[i - 1:i + 2]))
        num += min(ea, eb)
        den += ea
    return num / den if den > 0 else 1.0


def seam_metrics(x, sr, win_ms=50.0):
    """How well does the END of the file connect to its START (gapless looping)?

    jump           largest |x[0] - x[-1]| over channels (linear amplitude)
    click_ratio    second-difference at the seam / 99.9th percentile of the second difference nearby
                   (<= ~1.5 means the seam is no sharper than ordinary samples around it)
    spectral_sim   cosine similarity of band energies, last 50 ms vs first 50 ms (1.0 = identical)
    tail_continuation  share of the ending's strongest partials that are still sounding in the first window
                   (a wrapped reverb/release tail gives ~0.6-1.0, staccato endings with fast releases ~0.4-0.6,
                   an ending that was simply cut off while loud scores low)
    level_end_db / level_start_db  RMS of those windows
    """
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = x[:, None]
    n = x.shape[0]
    w = max(16, min(int(win_ms * 0.001 * sr), n // 4))
    ring = np.vstack([x[-w:], x[:w]])                 # seam sits between index w-1 and w
    jump = float(np.max(np.abs(x[0] - x[-1])))
    d2 = np.abs(ring[2:] - 2.0 * ring[1:-1] + ring[:-2])
    seam_d2 = float(np.max(d2[w - 2:w]))              # the two second differences that straddle the seam
    mask = np.ones(len(d2), dtype=bool)
    mask[w - 2:w] = False
    ref = float(np.percentile(np.max(d2[mask], axis=1), 99.9)) if np.any(mask) else 0.0
    d1 = np.abs(np.diff(ring, axis=0))
    seam_d1 = float(np.max(d1[w - 1]))
    m1 = np.ones(len(d1), dtype=bool)
    m1[w - 1] = False
    ref1 = float(np.percentile(np.max(d1[m1], axis=1), 99.9))
    mono = np.mean(x, axis=1)
    e_last = _band_energies(mono[-w:], sr)
    e_first = _band_energies(mono[:w], sr)
    denom = math.sqrt(float(np.sum(e_last ** 2)) * float(np.sum(e_first ** 2)))
    sim = float(np.sum(e_last * e_first) / denom) if denom > 0 else 1.0
    cont = _partial_continuation(mono[-w:], mono[:w], sr)
    rms_end = math.sqrt(float(np.mean(mono[-w:] ** 2)))
    rms_start = math.sqrt(float(np.mean(mono[:w] ** 2)))
    return {
        "jump": jump,
        "jump_db": db(jump),
        "jump_ratio": seam_d1 / (ref1 + 1e-9),
        "click_ratio": seam_d2 / (ref + 1e-9),
        "seam_d2": seam_d2,
        "spectral_sim": sim,
        "tail_continuation": cont,
        "level_end_db": db(rms_end),
        "level_start_db": db(rms_start),
    }


def judge_seam(m):
    """-> ('ok'|'warn'|'bad', reason).  Thresholds chosen so that an audible click or a chopped tail fails."""
    reasons = []
    verdict = "ok"
    audible = m["seam_d2"] > 0.004 or m["jump"] > 0.02
    if audible and (m["click_ratio"] > 4.0 or m["jump_ratio"] > 4.0):
        verdict = "bad"
        reasons.append("discontinuity at the seam (jump %.4f, click ratio %.1f)" % (m["jump"], m["click_ratio"]))
    elif m["seam_d2"] > 0.002 and (m["click_ratio"] > 2.0 or m["jump_ratio"] > 2.5):
        verdict = "warn"
        reasons.append("seam slightly sharper than its surroundings (click ratio %.1f)" % m["click_ratio"])
    # staccato material with fast releases legitimately scores 0.4-0.6 here, so only low values are flagged
    if m["level_end_db"] > -45.0:
        if m["tail_continuation"] < 0.15:
            verdict = "bad"
            reasons.append("the ending does not continue into the start (tail continuation %.2f): chopped tail?"
                           % m["tail_continuation"])
        elif m["tail_continuation"] < 0.35 and verdict == "ok":
            verdict = "warn"
            reasons.append("weak continuity of the ending's partials across the seam (%.2f): was the tail wrapped?"
                           % m["tail_continuation"])
    return verdict, "; ".join(reasons) if reasons else "seam is clean"


# --------------------------------------------------------------------------------------
# Key estimate
# --------------------------------------------------------------------------------------

_KS_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_KS_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
_PC_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def chromagram(x, sr, fmin=55.0, fmax=2100.0, nfft=16384):
    """Coarse 12-bin chroma vector (sum over time) from an STFT; harmonics are partly discounted."""
    mono = np.mean(np.asarray(x, dtype=np.float64), axis=1) if np.ndim(x) > 1 else np.asarray(x, dtype=np.float64)
    if len(mono) < nfft:
        mono = np.concatenate([mono, np.zeros(nfft - len(mono))])
    hop = nfft // 2
    win = np.hanning(nfft)
    f = np.fft.rfftfreq(nfft, 1.0 / sr)
    valid = (f >= fmin) & (f <= fmax)
    midi = 69.0 + 12.0 * np.log2(np.maximum(f, 1e-6) / 440.0)
    pc_float = np.mod(midi, 12.0)
    weights = np.zeros((12, len(f)))
    for pc in range(12):
        dist = np.abs(((pc_float - pc + 6.0) % 12.0) - 6.0)
        weights[pc] = np.where(valid, np.exp(-0.5 * (dist / 0.35) ** 2), 0.0)
    # favour the fundamental region a little: gentle tilt against high partials
    tilt = np.where(valid, 1.0 / np.sqrt(np.maximum(f, fmin) / fmin), 0.0)
    chroma = np.zeros(12)
    for start in range(0, len(mono) - nfft + 1, hop):
        spec = np.abs(np.fft.rfft(mono[start:start + nfft] * win))
        frame = weights @ (spec * tilt)
        s = float(np.sum(frame))
        if s > 1e-9:
            chroma += frame / s * math.sqrt(s)      # compress dynamics so loud bars do not dominate
    total = float(np.sum(chroma))
    return chroma / total if total > 0 else chroma


def key_estimate(x, sr, top=4):
    """Krumhansl-Schmuckler key finding on the chromagram -> [(name, correlation), ...] best first."""
    chroma = chromagram(x, sr)
    results = []
    for tonic in range(12):
        for name, prof in (("major", _KS_MAJOR), ("minor", _KS_MINOR)):
            rolled = np.roll(prof, tonic)
            c = float(np.corrcoef(chroma, rolled)[0, 1]) if np.std(chroma) > 0 else 0.0
            results.append(("%s %s" % (_PC_NAMES[tonic], name), c))
    results.sort(key=lambda r: -r[1])
    return results[:top], chroma


def normalize_key_name(name):
    """'a minor', 'Am', 'A min', 'F# major', 'Gb' -> canonical 'A minor' / 'F# major' (flats for Eb Ab Bb)."""
    s = name.strip().replace("♯", "#").replace("♭", "b")
    parts = s.replace("-", " ").split()
    head = parts[0]
    mode = " ".join(parts[1:]).lower()
    if not mode and len(head) > 1 and head.endswith("m") and not head.endswith("dim"):
        head, mode = head[:-1], "minor"
    letter = head[0].upper()
    acc = head[1:]
    base = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}[letter]
    pc = (base + acc.count("#") - acc.count("b")) % 12
    mode = "minor" if mode.startswith("min") or mode == "m" else "major"
    return "%s %s" % (_PC_NAMES[pc], mode)


def related_keys(name):
    """Relative and parallel keys of a canonical key name (common, harmless confusions)."""
    tonic, mode = name.split()
    pc = _PC_NAMES.index(tonic)
    if mode == "major":
        return ["%s minor" % _PC_NAMES[(pc + 9) % 12], "%s minor" % tonic]
    return ["%s major" % _PC_NAMES[(pc + 3) % 12], "%s major" % tonic]


# --------------------------------------------------------------------------------------
# File level analysis (used by analyze.py and the render report)
# --------------------------------------------------------------------------------------

def analyze_array(x, sr, loop=True):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = x[:, None]
    n = x.shape[0]
    mono = np.mean(x, axis=1)
    peak = sample_peak(x)
    rms = math.sqrt(float(np.mean(x * x))) if n else 0.0
    frame = max(1, int(0.05 * sr))
    nfr = max(1, n // frame)
    fr = mono[:nfr * frame].reshape(nfr, -1) if n >= frame else mono[None, :]
    fr_rms = np.sqrt(np.mean(fr * fr, axis=1))
    silence_ratio = float(np.mean(fr_rms < undb(-60.0)))
    info = {
        "frames": n,
        "sample_rate": sr,
        "channels": x.shape[1],
        "duration": n / float(sr),
        "peak": peak,
        "peak_db": db(peak),
        "true_peak_db": db(true_peak(x)),
        "rms_db": db(rms),
        "lufs": lufs_integrated(x, sr),
        "dc_offset": [float(v) for v in np.mean(x, axis=0)],
        "silence_ratio": silence_ratio,
        "clipped_samples": int(np.sum(np.abs(x) >= 0.999)),
        "crest_db": db(peak) - db(rms),
    }
    if x.shape[1] >= 2:
        l, r = x[:, 0], x[:, 1]
        denom = math.sqrt(float(np.sum(l * l)) * float(np.sum(r * r)))
        info["stereo_correlation"] = float(np.sum(l * r) / denom) if denom > 0 else 1.0
    if loop:
        info["seam"] = seam_metrics(x, sr)
    return info
