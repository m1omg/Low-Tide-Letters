#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
make_sfx.py - numpy-only sound effect synthesizer for the game (TECH_SPEC sections 7 and 10).

Everything is synthesized from scratch (oscillators, FM, modal "struck object" synthesis, FFT-filtered
noise, heterodyned swept noise, Karplus-Strong plucks, a Schroeder reverb, bitcrush) at 44.1 kHz and
encoded to OGG Vorbis q4 with ffmpeg.  No samples, no external data.

Usage (run from anywhere):
    python3 tools/sfx/make_sfx.py                    render everything, then print the report
    python3 tools/sfx/make_sfx.py --only id1,id2     render only these ids (then report on them)
    python3 tools/sfx/make_sfx.py --group ui,blip    render only these groups
    python3 tools/sfx/make_sfx.py --report           do not render; analyse the OGG files on disk
    python3 tools/sfx/make_sfx.py --list             list registered ids
    python3 tools/sfx/make_sfx.py --out DIR          write somewhere else (default assets/audio/sfx)

The report decodes every OGG again with ffmpeg and checks: file exists / decodes, sample rate, channel
count, duration inside the registered range, peak (no clipping, close to target), RMS (not silent),
DC offset, click-free edges, and for loops the wrap-around seam.  Exit code 1 if any check fails.

Adding a sound: write a function that takes a numpy Generator and returns a float array
(mono: shape (n,), stereo: shape (n, 2)) at any level, and decorate it with @sfx(...).
See tools/sfx/README.md.
"""
import argparse
import functools
import glob
import importlib.util
import json
import os
import subprocess
import sys
import zlib

import numpy as np

SR = 44100
TWO_PI = 2.0 * np.pi
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT_DIR = os.path.join(ROOT, 'assets', 'audio', 'sfx')
GROUPS = ('ui', 'blip', 'world', 'battle', 'eerie', 'amb')

REGISTRY = {}  # id -> spec dict (insertion ordered)


def sfx(sid, group, peak_db=-6.0, dur=(0.05, 3.0), loop=False, stereo=False, volume=None,
        fade_in=0.002, fade_out=0.012, lofi=True, lp=10500.0, drive=0.9):
    """Register a sound.

    sid      final asset id (file name without extension)
    group    one of GROUPS (only used for --group and the report)
    peak_db  target peak level in dBFS after normalisation
    dur      (min, max) allowed duration in seconds, checked by the report
    loop     True for seamless loops: no edge fades, circular filtering, seam check, sidecar json
    stereo   True if the function returns shape (n, 2)
    volume   sidecar "volume" (only written for loops or when given)
    fade_in / fade_out   edge fades in seconds (ignored for loops)
    lofi     apply the gentle global tone chain (12 dB/oct low-pass at `lp` Hz + soft saturation `drive`)
    """
    def deco(fn):
        if sid in REGISTRY:
            raise ValueError('duplicate sfx id: ' + sid)
        REGISTRY[sid] = dict(id=sid, fn=fn, group=group, peak_db=float(peak_db), dur=tuple(dur), loop=loop,
                             stereo=stereo, volume=volume, fade_in=fade_in, fade_out=fade_out, lofi=lofi,
                             lp=lp, drive=drive, desc=(fn.__doc__ or '').strip().split('\n')[0])
        return fn
    return deco


# ----------------------------------------------------------------------------------------------------
# basic helpers
# ----------------------------------------------------------------------------------------------------

def secs(d):
    """seconds -> whole samples"""
    return int(round(d * SR))


def tt(d):
    """time axis (seconds) for a duration"""
    return np.arange(secs(d)) / SR


_SEMI = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def note(name):
    """'A4' -> 440.0, accepts sharps and flats: 'C#5', 'Eb4'"""
    n = _SEMI[name[0].upper()]
    i = 1
    while i < len(name) and name[i] in '#b':
        n += 1 if name[i] == '#' else -1
        i += 1
    m = 12 * (int(name[i:]) + 1) + n
    return 440.0 * 2.0 ** ((m - 69) / 12.0)


def rms(x):
    return float(np.sqrt(np.mean(np.square(x)) + 1e-30))


def norm(x):
    """scale to peak 1"""
    return x / (np.max(np.abs(x)) + 1e-12)


def smoothstep(u):
    u = np.clip(u, 0.0, 1.0)
    return u * u * (3.0 - 2.0 * u)


def glide(f0, f1, dur, curve='exp'):
    """frequency trajectory f0 -> f1 over dur seconds ('exp', 'lin' or 'ease')"""
    u = tt(dur) / max(dur, 1e-9)
    if curve == 'lin':
        return f0 + (f1 - f0) * u
    if curve == 'ease':
        return f0 + (f1 - f0) * smoothstep(u)
    return f0 * (f1 / f0) ** u


def osc(freq, dur=None, shape='sine', phase=0.0):
    """Oscillator. freq: scalar (needs dur) or per-sample array in Hz.
    shapes: sine, tri, soft (rounded square, few harmonics), saw (naive; filter it afterwards)."""
    if np.isscalar(freq):
        f = np.full(secs(dur), float(freq))
    else:
        f = np.asarray(freq, dtype=float)
    ph = phase + TWO_PI * (np.cumsum(f) - f) / SR
    if shape == 'sine':
        return np.sin(ph)
    if shape == 'tri':
        return (2.0 / np.pi) * np.arcsin(np.sin(ph))
    if shape == 'soft':
        return np.tanh(3.0 * np.sin(ph)) / np.tanh(3.0)
    if shape == 'saw':
        return 2.0 * ((ph / TWO_PI) % 1.0) - 1.0
    raise ValueError(shape)


def perc(dur, a=0.002, d=0.05, hold=0.0):
    """percussive envelope: raised-cosine attack `a`, optional hold, exponential decay time constant `d`"""
    t = tt(dur)
    att = np.clip(t / max(a, 1e-6), 0.0, 1.0)
    att = 0.5 - 0.5 * np.cos(np.pi * att)
    return att * np.exp(-np.maximum(t - a - hold, 0.0) / d)


def adsr(dur, a=0.01, d=0.05, s=0.7, r=0.05):
    """linear ADSR over exactly `dur` seconds (release is the last r seconds)"""
    t = tt(dur)
    env = np.where(t < a, t / max(a, 1e-6), s + (1.0 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = np.clip((dur - t) / max(r, 1e-6), 0.0, 1.0)
    return env * rel


def swell(dur, peak_at=0.6, power=2.0):
    """smooth rise to a peak at fraction `peak_at`, then smooth fall to zero"""
    u = tt(dur) / max(dur, 1e-9)
    up = np.clip(u / peak_at, 0.0, 1.0)
    down = np.clip((1.0 - u) / (1.0 - peak_at), 0.0, 1.0)
    return (np.sin(0.5 * np.pi * up) ** power) * (np.sin(0.5 * np.pi * down) ** power)


def fade(x, fin=0.002, fout=0.01):
    """raised-cosine edge fades (works for mono and (n, ch) arrays)"""
    x = np.array(x, dtype=float, copy=True)
    n = x.shape[0]
    a = min(secs(fin), n // 2)
    b = min(secs(fout), n // 2)
    if a > 0:
        w = 0.5 - 0.5 * np.cos(np.pi * np.arange(a) / a)
        x[:a] = (x[:a].T * w).T
    if b > 0:
        w = 0.5 + 0.5 * np.cos(np.pi * (np.arange(b) + 1) / b)
        x[n - b:] = (x[n - b:].T * w).T
    return x


def mixdown(events, length=None):
    """events: iterable of (start_seconds, samples, gain) -> summed mono buffer"""
    ev = [(secs(t0), np.asarray(x, dtype=float), g) for t0, x, g in events]
    n = max(i + len(x) for i, x, g in ev)
    if length is not None:
        n = max(n, secs(length))
    out = np.zeros(n)
    for i, x, g in ev:
        out[i:i + len(x)] += g * x
    return out


def fit(x, n):
    """pad with zeros / trim to exactly n samples"""
    if len(x) >= n:
        return x[:n]
    return np.concatenate([x, np.zeros(n - len(x))])


# ----------------------------------------------------------------------------------------------------
# filters
# ----------------------------------------------------------------------------------------------------

def fftfilt(x, lo=None, hi=None, order=2, circular=False, pad=0.03):
    """Zero-phase Butterworth-magnitude filter done in the frequency domain.
    lo = high-pass corner, hi = low-pass corner (Hz), order n -> 6n dB/octave.
    circular=True treats the signal as periodic (used for seamless loops and for plain noise)."""
    x = np.asarray(x, dtype=float)
    if x.ndim == 2:
        return np.stack([fftfilt(x[:, c], lo, hi, order, circular, pad) for c in range(x.shape[1])], axis=1)
    n0 = len(x)
    p = 0
    if not circular:
        p = secs(pad)
        x = np.concatenate([np.zeros(p), x, np.zeros(p)])
    n = len(x)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    h = np.ones_like(f)
    if lo:
        r = (f / lo) ** (2 * order)
        h *= np.sqrt(r / (1.0 + r))
    if hi:
        h *= 1.0 / np.sqrt(1.0 + (f / hi) ** (2 * order))
    y = np.fft.irfft(np.fft.rfft(x) * h, n)
    return y[p:p + n0]


def svf_lp(x, fc, q=0.8):
    """time-varying 12 dB/oct low-pass (TPT state variable filter, plain python loop - use on short sounds)"""
    n = len(x)
    fc = np.broadcast_to(np.asarray(fc, dtype=float), (n,))
    g = np.tan(np.pi * np.clip(fc, 20.0, SR * 0.45) / SR)
    k = 1.0 / q
    a1 = 1.0 / (1.0 + g * (g + k))
    a2 = g * a1
    a3 = g * a2
    a1l, a2l, a3l, xl = a1.tolist(), a2.tolist(), a3.tolist(), np.asarray(x, dtype=float).tolist()
    ic1 = ic2 = 0.0
    out = [0.0] * n
    for i in range(n):
        v3 = xl[i] - ic2
        v1 = a1l[i] * ic1 + a2l[i] * v3
        v2 = ic2 + a2l[i] * ic1 + a3l[i] * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        out[i] = v2
    return np.array(out)


def bitcrush(x, bits=6, hold=4):
    """sample-and-hold by `hold` samples + quantise to `bits` bits (input is peak-normalised first)"""
    x = norm(np.asarray(x, dtype=float))
    idx = (np.arange(len(x)) // hold) * hold
    q = float(2 ** (bits - 1))
    return np.round(x[idx] * q) / q


def wow(x, rate=0.7, depth=0.004, phase=0.0):
    """tape-style slow pitch wobble: playback speed = 1 + depth*cos(2 pi rate t)"""
    n = len(x)
    t = np.arange(n) / SR
    pos = np.arange(n) + (depth * SR / (TWO_PI * rate)) * (np.sin(TWO_PI * rate * t + phase) - np.sin(phase))
    return np.interp(pos, np.arange(n), x, left=0.0, right=0.0)


def resample(x, ratio):
    """naive pitch shift by linear interpolation (ratio 2 = one octave up, half as long)"""
    n = int(len(x) / ratio)
    return np.interp(np.arange(n) * ratio, np.arange(len(x)), x)


# ----------------------------------------------------------------------------------------------------
# noise sources
# ----------------------------------------------------------------------------------------------------

def band_noise(n, rng, lo=None, hi=None, order=2):
    """unit-RMS filtered noise of n samples (periodic by construction, harmless for one-shots)"""
    y = fftfilt(rng.standard_normal(n), lo=lo, hi=hi, order=order, circular=True)
    return y / rms(y)


def swept_noise(fc, bw, rng, order=2):
    """unit-RMS band noise whose centre frequency follows the per-sample array `fc` (Hz), bandwidth `bw` Hz.
    Done by heterodyning complex low-pass noise, so it is fully vectorised."""
    fc = np.asarray(fc, dtype=float)
    n = len(fc)
    re = fftfilt(rng.standard_normal(n), hi=bw / 2.0, order=order, circular=True)
    im = fftfilt(rng.standard_normal(n), hi=bw / 2.0, order=order, circular=True)
    ph = TWO_PI * np.cumsum(fc) / SR
    y = re * np.cos(ph) - im * np.sin(ph)
    return y / rms(y)


def smooth_rand(n, rate, rng, lo=0.0, hi=1.0):
    """slow random curve between lo and hi, fluctuating at up to about `rate` Hz"""
    y = fftfilt(rng.standard_normal(n), hi=rate, order=2, circular=True)
    y = (y - y.min()) / (y.max() - y.min() + 1e-12)
    return lo + (hi - lo) * y


def grain(n, rng, rate=500.0, depth=0.5, power=2.0):
    """multiplicative 'paper grain' amplitude texture with mean about 1"""
    g = smooth_rand(n, rate, rng) ** power
    g = g / (g.mean() + 1e-12)
    return (1.0 - depth) + depth * g


def crackle(n, rng, rate, tau=0.001):
    """random impulse envelope (Poisson events per second = rate, scalar or array), each decaying with tau"""
    p = np.broadcast_to(np.asarray(rate, dtype=float) / SR, (n,))
    imp = (rng.random(n) < p) * rng.random(n) ** 2
    k = np.exp(-np.arange(max(2, secs(tau * 6))) / (tau * SR))
    env = np.convolve(imp, k)[:n]
    return env / (env.max() + 1e-12)


def click(rng, dur=0.012, lo=1500.0, hi=7000.0, tau=0.002):
    """tiny filtered-noise tick, peak 1"""
    n = secs(dur)
    y = fftfilt(rng.standard_normal(n), lo=lo, hi=hi, order=2, pad=0.01) * np.exp(-tt(dur) / tau)
    return norm(y)


# ----------------------------------------------------------------------------------------------------
# instruments
# ----------------------------------------------------------------------------------------------------

def modal(partials, dur, attack=0.0008):
    """struck-object synthesis: sum of exponentially decaying sines. partials = [(freq, amp, tau), ...]"""
    t = tt(dur)
    out = np.zeros_like(t)
    for f, a, tau in partials:
        if f < 17000.0:
            out += a * np.exp(-t / tau) * np.sin(TWO_PI * f * t)
    k = max(1, secs(attack))
    out[:k] *= np.linspace(0.0, 1.0, k)
    return out


def mbox(f, dur, bright=1.0, cents=0.0, droop=0.0):
    """music-box tine: strong fundamental, weak octave, short inharmonic 'ping' partials.
    cents = static detune, droop = cents the pitch sags over the note (for the broken music box)."""
    f = f * 2.0 ** (cents / 1200.0)
    t = tt(dur)
    fm = np.ones_like(t) if not droop else 2.0 ** (-(droop / 1200.0) * (t / dur) ** 1.5)
    ph = TWO_PI * np.cumsum(f * fm) / SR
    tau = float(np.clip(0.55 * (523.0 / f) ** 0.5, 0.12, 1.1))
    x = np.exp(-t / tau) * np.sin(ph)
    x += 0.22 * np.exp(-t / (tau * 0.5)) * np.sin(2.0 * ph + 0.3)
    if 3.0 * f < 15000:
        x += 0.07 * np.exp(-t / (tau * 0.3)) * np.sin(3.0 * ph)
    if 5.4 * f < 15000:
        x += bright * 0.16 * np.exp(-t / 0.045) * np.sin(5.4 * ph)
    if 8.93 * f < 15000:
        x += bright * 0.07 * np.exp(-t / 0.02) * np.sin(8.93 * ph)
    return fade(x, 0.0015, min(0.05, dur * 0.3))


def chime(f, dur, bright=1.0):
    """glassy FM chime (carrier : modulator = 1 : 3.5, decaying index)"""
    t = tt(dur)
    idx = 1.4 * bright * np.exp(-t / 0.10) + 0.12
    x = np.sin(TWO_PI * f * t + idx * np.sin(TWO_PI * 3.5 * f * t)) * np.exp(-t / (dur * 0.30))
    x += 0.30 * np.sin(TWO_PI * 2.0 * f * t) * np.exp(-t / (dur * 0.18))
    return fade(x, 0.0015, min(0.05, dur * 0.3))


def glint(f, dur=0.25):
    """tiny high sparkle: sine + slightly sharp octave, fast decay"""
    t = tt(dur)
    x = np.sin(TWO_PI * f * t)
    if 2.01 * f < 14000:
        x += 0.3 * np.sin(TWO_PI * 2.01 * f * t)
    return fade(x * np.exp(-t / (dur * 0.22)), 0.002, dur * 0.3)


def xylo(f, dur=0.3, rng=None):
    """toy xylophone bar: fundamental + inharmonic bar partials, very short, with a wooden knock"""
    tau = 0.035 + 0.085 * (880.0 / f) ** 0.5
    x = modal([(f, 1.0, tau), (2.76 * f, 0.35, tau * 0.35), (5.4 * f, 0.16, tau * 0.15)], dur)
    if rng is not None:
        x += 0.25 * fit(click(rng, 0.02, 900, 4000, 0.003), len(x))
    return fade(x, 0.001, min(0.04, dur * 0.3))


def toyp(f, dur):
    """toy piano: tine with a strong octave, a clangy upper partial and a small hammer thunk"""
    x = modal([(f, 1.0, 0.32), (2.0 * f, 0.42, 0.20), (3.0 * f, 0.10, 0.12), (6.27 * f, 0.12, 0.05),
               (310.0, 0.18, 0.010)], dur)
    return fade(x, 0.001, min(0.05, dur * 0.3))


def chip(f, dur, a=0.003, tau=None, shape='soft', vib=0.0):
    """soft chiptune note (rounded square), percussive envelope"""
    t = tt(dur)
    fa = f * (1.0 + vib * np.sin(TWO_PI * 6.0 * t))
    x = osc(fa, shape=shape) * perc(dur, a, tau or dur * 0.6)
    return fade(x, 0.0, min(0.01, dur * 0.3))


def soft_note(f, dur, a=0.005, tau=None, vib=0.0, tri=0.25):
    """mellow sine/triangle note"""
    t = tt(dur)
    fa = f * (1.0 + vib * np.sin(TWO_PI * 5.5 * t))
    x = (1.0 - tri) * osc(fa) + tri * osc(fa, shape='tri')
    return fade(x * perc(dur, a, tau or dur * 0.35), 0.0, min(0.03, dur * 0.3))


def thump(f0, f1, dur, rng=None, noise=0.2, tau=None, drop=0.03):
    """felt thump: sine dropping from f0 to f1, exponential decay, optional dull noise layer"""
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t / drop)
    x = np.sin(TWO_PI * np.cumsum(f) / SR) * np.exp(-t / (tau or dur * 0.3))
    if rng is not None and noise:
        nz = fftfilt(rng.standard_normal(len(t)), hi=max(4.0 * f0, 400.0), order=2) * np.exp(-t / 0.012)
        x = x + noise * norm(nz)
    return fade(x, 0.0008, min(0.02, dur * 0.3))


def pluck(f, dur, rng, bright=0.6, sustain=0.996):
    """Karplus-Strong plucked string (block-vectorised, then resampled to the exact pitch)"""
    nd = max(2, int(round(SR / f - 0.5)))
    ratio = f / (SR / (nd + 0.5))
    n = secs(dur)
    ngen = int(np.ceil(n * ratio)) + 4
    k = np.arange(1, nd // 2 + 1)
    amps = np.abs(np.sin(np.pi * k * 0.18)) / k ** (2.0 - 1.4 * bright)
    burst = np.fft.irfft(np.concatenate([[0.0], amps * np.exp(1j * rng.uniform(0.0, TWO_PI, len(k)))]), nd)
    blocks = [burst]
    prev, prev2_last = burst, 0.0
    for _ in range(ngen // nd + 1):
        shifted = np.concatenate(([prev2_last], prev[:-1]))
        new = sustain * 0.5 * (prev + shifted)
        prev2_last = prev[-1]
        prev = new
        blocks.append(new)
    y = np.concatenate(blocks)[:ngen]
    out = np.interp(np.arange(n) * ratio, np.arange(len(y)), y)
    return fade(norm(out), 0.001, min(0.06, dur * 0.3))


def creak(dur, f0, f1, rng, res=(700.0, 1300.0, 2100.0)):
    """hinge creak: jittery stick-slip pulse train through a few wooden resonances"""
    n = secs(dur)
    f = glide(f0, f1, dur) * (1.0 + 0.12 * (smooth_rand(n, 18.0, rng) - 0.5))
    saw = osc(f, shape='saw')
    y = np.zeros(n)
    for r in res:
        y += fftfilt(saw, lo=r / 1.25, hi=r * 1.25, order=2)
    return norm(y) * swell(dur, 0.5, 1.0) * (0.6 + 0.4 * smooth_rand(n, 25.0, rng))


# ----------------------------------------------------------------------------------------------------
# reverb (Schroeder: parallel damped combs -> series all-passes), applied by FFT convolution
# ----------------------------------------------------------------------------------------------------

def _comb_damped(x, delay, g, damp):
    n = len(x)
    xl = x.tolist()
    buf = [0.0] * delay
    y = [0.0] * n
    lp = 0.0
    idx = 0
    for i in range(n):
        o = buf[idx]
        lp = o * (1.0 - damp) + lp * damp
        buf[idx] = xl[i] + g * lp
        y[i] = o
        idx += 1
        if idx == delay:
            idx = 0
    return np.array(y)


def _allpass(x, delay, g):
    n = len(x)
    y = np.zeros(n)
    for s in range(0, n, delay):
        e = min(s + delay, n)
        if s >= delay:
            y[s:e] = -g * x[s:e] + x[s - delay:e - delay] + g * y[s - delay:e - delay]
        else:
            y[s:e] = -g * x[s:e]
    return y


@functools.lru_cache(maxsize=None)
def _schroeder_ir(rt, damp):
    length = secs(min(rt * 1.25 + 0.1, 4.0))
    imp = np.zeros(length)
    imp[0] = 1.0
    out = np.zeros(length)
    for ms in (29.7, 33.1, 37.1, 41.1, 43.7, 47.9):
        d = secs(ms / 1000.0)
        g = 10.0 ** (-3.0 * (d / SR) / rt)
        out += _comb_damped(imp, d, g, damp)
    for ms, g in ((5.0, 0.7), (1.7, 0.7), (0.63, 0.6)):
        out = _allpass(out, secs(ms / 1000.0), g)
    return out / np.sqrt(np.sum(out ** 2))


def reverb(x, mix=0.2, rt=1.0, damp=0.35, tail=None, predelay=0.012, lp=6000.0):
    """dry + mix * wet. The output is `tail` seconds longer than the input (default 0.6*rt)."""
    ir = _schroeder_ir(round(float(rt), 2), round(float(damp), 2))
    tail = rt * 0.6 if tail is None else tail
    n = len(x) + secs(tail)
    nfft = len(x) + len(ir)
    wet = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)
    wet = fftfilt(wet, lo=150.0, hi=lp, order=1)
    wet = np.concatenate([np.zeros(secs(predelay)), wet])
    return fit(x, n) + mix * fit(wet, n)


# ----------------------------------------------------------------------------------------------------
# helpers for seamless loops: everything here is periodic over the buffer length
# ----------------------------------------------------------------------------------------------------

def circ_noise(n, rng, lo=None, hi=None, order=2, tilt=0.0):
    """unit-RMS periodic noise; tilt < 0 darkens (-0.5 = pink-ish)"""
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1.0 / SR)
    h = np.ones_like(f)
    if lo:
        r = (f / lo) ** (2 * order)
        h *= np.sqrt(r / (1.0 + r))
    if hi:
        h *= 1.0 / np.sqrt(1.0 + (f / hi) ** (2 * order))
    if tilt:
        h *= (np.maximum(f, 20.0) / 1000.0) ** tilt
    h[0] = 0.0
    y = np.fft.irfft(spec * h, n)
    return y / rms(y)


def circ_lfo(n, rng, max_cycles=5, power=1.0):
    """periodic smooth random curve in 0..1 (sum of sinusoids with whole numbers of cycles)"""
    u = np.arange(n) / n
    y = np.zeros(n)
    for k in range(1, max_cycles + 1):
        y += rng.uniform(0.4, 1.0) / k ** power * np.sin(TWO_PI * k * u + rng.uniform(0, TWO_PI))
    return (y - y.min()) / (y.max() - y.min())


def circ_conv(x, kernel):
    """circular convolution (keeps loops seamless)"""
    n = len(x)
    return np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(kernel, n), n)


def circ_add(buf, pos, x, gain=1.0):
    """add x into buf at sample pos, wrapping around the end"""
    n = len(buf)
    idx = (pos + np.arange(len(x))) % n
    np.add.at(buf, idx, gain * x)


def circ_phase(fc):
    """phase for a time-varying frequency, nudged so it completes a whole number of cycles over the buffer"""
    n = len(fc)
    total = np.sum(fc) / SR
    fc = fc + (np.round(total) - total) * SR / n
    return TWO_PI * np.cumsum(fc) / SR


# ====================================================================================================
# UI
# ====================================================================================================

@sfx('sfx_cursor', 'ui', peak_db=-10, dur=(0.015, 0.06), fade_in=0.0005, fade_out=0.006)
def sfx_cursor(rng):
    """tiny pencil tick"""
    d = 0.034
    body = modal([(1750.0, 1.0, 0.0035), (2900.0, 0.5, 0.0022), (640.0, 0.35, 0.006)], d)
    return 0.8 * body + 0.5 * click(rng, d, 1800, 7000, 0.0022)


@sfx('sfx_confirm', 'ui', peak_db=-9, dur=(0.25, 0.7), fade_out=0.06)
def sfx_confirm(rng):
    """soft two-note music-box plink going up a fourth"""
    x = mixdown([(0.0, mbox(note('G5'), 0.30), 0.8), (0.075, mbox(note('C6'), 0.40), 1.0)])
    return reverb(x, mix=0.12, rt=0.5, tail=0.06)


@sfx('sfx_cancel', 'ui', peak_db=-10, dur=(0.2, 0.6), fade_out=0.04)
def sfx_cancel(rng):
    """soft mellow note stepping down a fourth"""
    x = mixdown([(0.0, soft_note(note('D5'), 0.16, tau=0.05), 1.0),
                 (0.08, soft_note(note('A4'), 0.24, tau=0.07), 0.85)])
    return fftfilt(x, hi=3000.0)


@sfx('sfx_error', 'ui', peak_db=-8, dur=(0.2, 0.6), fade_out=0.03)
def sfx_error(rng):
    """muted double felt thud"""
    a = thump(230.0, 150.0, 0.13, rng, noise=0.4, tau=0.035)
    b = thump(205.0, 132.0, 0.16, rng, noise=0.35, tau=0.04)
    x = mixdown([(0.0, a, 1.0), (0.125, b, 0.9)])
    return fftfilt(x, lo=70.0, hi=1200.0)


@sfx('sfx_menu_open', 'ui', peak_db=-11, dur=(0.15, 0.45), fade_in=0.004, fade_out=0.03)
def sfx_menu_open(rng):
    """paper sliding out (rising)"""
    d = 0.24
    n = secs(d)
    x = swept_noise(glide(1200.0, 3800.0, d), 2600.0, rng) * grain(n, rng, 420.0, 0.55)
    return x * swell(d, 0.35, 1.5)


@sfx('sfx_menu_close', 'ui', peak_db=-12, dur=(0.12, 0.4), fade_in=0.003, fade_out=0.03)
def sfx_menu_close(rng):
    """paper sliding back (falling) with a soft pat at the end"""
    d = 0.20
    n = secs(d)
    x = swept_noise(glide(3400.0, 1000.0, d), 2200.0, rng) * grain(n, rng, 420.0, 0.55) * swell(d, 0.25, 1.5)
    pat = thump(230.0, 150.0, 0.06, rng, noise=0.4, tau=0.012)
    return mixdown([(0.0, x, 1.0), (0.15, pat, 1.6)])


@sfx('sfx_page', 'ui', peak_db=-9, dur=(0.25, 0.6), fade_in=0.004, fade_out=0.04)
def sfx_page(rng):
    """page turn: bending swish then a soft flap"""
    d1 = 0.23
    a = swept_noise(glide(900.0, 4600.0, d1), 2400.0, rng) * grain(secs(d1), rng, 500.0, 0.6) * swell(d1, 0.6, 2.0)
    d2 = 0.17
    b = swept_noise(glide(3000.0, 800.0, d2), 2000.0, rng) * grain(secs(d2), rng, 300.0, 0.5) * perc(d2, 0.004, 0.04)
    flap = band_noise(secs(0.06), rng, lo=120.0, hi=1400.0) * perc(0.06, 0.002, 0.012)
    return mixdown([(0.0, a, 0.8), (0.2, b, 1.0), (0.2, flap, 1.2)])


@sfx('sfx_save', 'ui', peak_db=-7, dur=(1.0, 1.6), fade_out=0.2)
def sfx_save(rng):
    """warm music-box arpeggio (F major, rising)"""
    ev = []
    for k, nm in enumerate(['F4', 'A4', 'C5', 'F5', 'A5', 'C6']):
        ev.append((0.095 * k, mbox(note(nm), 0.8, bright=0.7), 1.0 - 0.05 * k))
    ev.append((0.0, soft_note(note('F3'), 0.9, a=0.03, tau=0.4), 0.35))
    x = fftfilt(mixdown(ev), hi=6000.0, order=1)
    return reverb(x, mix=0.22, rt=1.0, tail=0.1)


@sfx('sfx_item_get', 'ui', peak_db=-7, dur=(0.4, 1.0), fade_out=0.1)
def sfx_item_get(rng):
    """bright three-note chime (C major triad, quick)"""
    ev = [(0.07 * k, chime(note(nm), 0.5, bright=0.75), g) for k, (nm, g) in enumerate([('C6', 0.8), ('E6', 0.9), ('G6', 1.0)])]
    return reverb(mixdown(ev), mix=0.18, rt=0.7, tail=0.1)


@sfx('sfx_key_item', 'ui', peak_db=-6, dur=(1.2, 2.2), fade_out=0.3)
def sfx_key_item(rng):
    """longer sparkly chime: D major arpeggio, then glitter"""
    ev = []
    for k, nm in enumerate(['D5', 'F#5', 'A5', 'D6', 'F#6', 'A6']):
        f = note(nm)
        ev.append((0.085 * k, chime(f, 0.9, bright=0.8), 0.8))
        ev.append((0.085 * k, mbox(f, 0.7), 0.5))
    ev.append((0.0, pluck(note('D4'), 1.0, rng, bright=0.5), 0.5))
    glitter = ['A6', 'D7', 'E7', 'F#7', 'A7', 'B6', 'D7', 'F#7', 'E7']
    tcur = 0.52
    for k, nm in enumerate(glitter):
        ev.append((tcur, glint(note(nm), 0.28), 0.22 * (1.0 - 0.07 * k)))
        tcur += rng.uniform(0.055, 0.10)
    return reverb(mixdown(ev), mix=0.3, rt=1.3, tail=0.35)


@sfx('sfx_level_up', 'ui', peak_db=-5, dur=(1.2, 1.9), fade_out=0.25)
def sfx_level_up(rng):
    """rising toy fanfare in D major"""
    mel = [('A4', 0.00, 0.10), ('D5', 0.09, 0.10), ('F#5', 0.18, 0.10), ('A5', 0.27, 0.20),
           ('B5', 0.45, 0.10), ('C#6', 0.54, 0.10), ('D6', 0.63, 0.55)]
    ev = []
    for nm, t0, ln in mel:
        f = note(nm)
        ev.append((t0, chip(f, ln + 0.05, tau=(ln + 0.05) * 0.7), 0.40))
        ev.append((t0, toyp(f, max(ln + 0.2, 0.35)), 0.8))
    for nm, g in [('D5', 0.5), ('F#5', 0.45), ('A5', 0.45)]:
        ev.append((0.63, mbox(note(nm), 0.7), g))
    ev.append((0.0, pluck(note('D3'), 0.5, rng, bright=0.4), 0.5))
    ev.append((0.63, pluck(note('D3'), 0.7, rng, bright=0.4), 0.7))
    for k, nm in enumerate(['A6', 'D7', 'F#7', 'A7']):
        ev.append((0.70 + 0.06 * k, glint(note(nm), 0.3), 0.16))
    x = fftfilt(mixdown(ev), hi=7000.0, order=1)
    return reverb(x, mix=0.18, rt=0.9, tail=0.2)


@sfx('sfx_coin', 'ui', peak_db=-9, dur=(0.2, 0.6), fade_out=0.05)
def sfx_coin(rng):
    """small coin clink with a two-note ring (up a fifth)"""
    clink = modal([(4180.0, 0.5, 0.05), (6270.0, 0.3, 0.03), (8350.0, 0.12, 0.02)], 0.2)
    x = mixdown([(0.0, clink, 0.35), (0.0, mbox(note('G5'), 0.12), 0.8), (0.06, mbox(note('D6'), 0.36), 1.0),
                 (0.06, clink, 0.25)])
    return x


# ====================================================================================================
# text blips (must stay under 80 ms and be pleasant at 20 per second)
# ====================================================================================================

def _voice_blip(f, d, tau):
    t = tt(d)
    fa = f * (1.0 + 0.035 * np.exp(-t / 0.012))
    x = 0.7 * osc(fa, shape='tri') + 0.3 * osc(fa, shape='soft')
    x = fftfilt(x, hi=2800.0, order=2, pad=0.01)
    return x * perc(d, 0.004, tau)


@sfx('sfx_blip_low', 'blip', peak_db=-13, dur=(0.035, 0.079), fade_in=0.003, fade_out=0.014)
def sfx_blip_low(rng):
    """low voice blip (G3)"""
    return _voice_blip(note('G3'), 0.066, 0.022)


@sfx('sfx_blip_mid', 'blip', peak_db=-14, dur=(0.035, 0.079), fade_in=0.003, fade_out=0.014)
def sfx_blip_mid(rng):
    """middle voice blip (E4)"""
    return _voice_blip(note('E4'), 0.058, 0.018)


@sfx('sfx_blip_high', 'blip', peak_db=-15, dur=(0.035, 0.079), fade_in=0.003, fade_out=0.012)
def sfx_blip_high(rng):
    """high voice blip (C5)"""
    return _voice_blip(note('C5'), 0.050, 0.015)


@sfx('sfx_blip_narrator', 'blip', peak_db=-13, dur=(0.03, 0.079), fade_in=0.001, fade_out=0.012)
def sfx_blip_narrator(rng):
    """soft noise tick, like a pencil touching paper"""
    d = 0.042
    n = secs(d)
    x = fftfilt(rng.standard_normal(n), lo=1200.0, hi=3800.0, order=2, pad=0.01) * perc(d, 0.002, 0.008)
    return norm(x) + 0.35 * modal([(880.0, 1.0, 0.008)], d)


@sfx('sfx_blip_odd', 'blip', peak_db=-14, dur=(0.035, 0.079), fade_in=0.003, fade_out=0.014)
def sfx_blip_odd(rng):
    """slightly detuned, uncanny blip: beating pair plus a quiet tritone, lightly crushed"""
    d = 0.068
    t = tt(d)
    f = note('B3') * (1.0 + 0.03 * t / d)
    x = osc(f, shape='tri') + 0.9 * osc(f * 2.0 ** (70.0 / 1200.0), shape='tri') + 0.3 * osc(f * 2.0 ** 0.5)
    x = bitcrush(x * perc(d, 0.004, 0.024), bits=7, hold=4)
    return fftfilt(x, hi=3500.0, order=2, pad=0.01)


# ====================================================================================================
# world
# ====================================================================================================

@sfx('sfx_step_grass', 'world', peak_db=-16, dur=(0.05, 0.18), fade_in=0.003, fade_out=0.03)
def sfx_step_grass(rng):
    """soft grass rustle"""
    d = 0.11
    n = secs(d)
    return swept_noise(glide(2600.0, 1500.0, d), 3000.0, rng) * grain(n, rng, 900.0, 0.6) * perc(d, 0.01, 0.025)


@sfx('sfx_step_wood', 'world', peak_db=-15, dur=(0.04, 0.15), fade_in=0.001, fade_out=0.02)
def sfx_step_wood(rng):
    """low hollow wooden tap"""
    d = 0.085
    x = modal([(140.0, 1.0, 0.018), (310.0, 0.8, 0.012), (820.0, 0.3, 0.006)], d)
    return x + 0.12 * click(rng, d, 500, 3000, 0.003)


@sfx('sfx_step_stone', 'world', peak_db=-15, dur=(0.03, 0.12), fade_in=0.001, fade_out=0.015)
def sfx_step_stone(rng):
    """dry stone tap"""
    d = 0.06
    x = modal([(950.0, 0.4, 0.006), (2100.0, 0.2, 0.004), (180.0, 0.35, 0.010)], d)
    return x + 0.5 * click(rng, d, 1500, 6000, 0.004)


@sfx('sfx_step_water', 'world', peak_db=-15, dur=(0.08, 0.25), fade_in=0.003, fade_out=0.04)
def sfx_step_water(rng):
    """small slosh with a bubble"""
    d = 0.16
    slosh = swept_noise(glide(1800.0, 600.0, d), 1300.0, rng) * perc(d, 0.012, 0.04)
    bub = osc(glide(500.0, 1150.0, 0.05)) * perc(0.05, 0.004, 0.015)
    return mixdown([(0.0, slosh, 1.0), (0.03, bub, 0.9)])


def _latch(rng, d=0.05, pitch=1.0):
    x = modal([(2300.0 * pitch, 0.5, 0.004), (1200.0 * pitch, 0.6, 0.006), (480.0 * pitch, 0.4, 0.012)], d)
    return x + 0.4 * click(rng, d, 1500, 6000, 0.002)


@sfx('sfx_door_open', 'world', peak_db=-9, dur=(0.35, 0.8), fade_out=0.06)
def sfx_door_open(rng):
    """latch click, short hinge creak, a little air"""
    air = band_noise(secs(0.4), rng, lo=150.0, hi=900.0) * swell(0.4, 0.4, 1.5)
    return mixdown([(0.0, _latch(rng), 0.7), (0.045, _latch(rng, pitch=1.2), 0.4),
                    (0.09, creak(0.36, 55.0, 105.0, rng), 0.6), (0.12, air, 0.12)])


@sfx('sfx_door_close', 'world', peak_db=-8, dur=(0.3, 0.8), fade_in=0.01, fade_out=0.05)
def sfx_door_close(rng):
    """soft swing of air, wooden thud, latch"""
    d = 0.16
    air = swept_noise(glide(900.0, 300.0, d), 600.0, rng) * (tt(d) / d) ** 2
    thud = thump(135.0, 72.0, 0.22, rng, noise=0.4, tau=0.05) + 0.5 * modal([(210.0, 0.6, 0.04), (430.0, 0.3, 0.02)], 0.22)
    return mixdown([(0.0, air, 0.18), (0.15, thud, 1.0), (0.215, _latch(rng, pitch=0.9), 0.45)])


@sfx('sfx_door_locked', 'world', peak_db=-9, dur=(0.25, 0.6), fade_out=0.04)
def sfx_door_locked(rng):
    """rattly handle: three stuck clunks"""
    def clunk(p):
        m = modal([(1300.0 * p, 0.5, 0.012), (2250.0 * p, 0.35, 0.008), (3400.0 * p, 0.2, 0.005)], 0.09)
        return m + 0.7 * fit(thump(165.0, 120.0, 0.06, rng, noise=0.5, tau=0.015), len(m))
    return mixdown([(0.0, clunk(1.0), 1.0), (0.12, clunk(0.94), 0.85), (0.205, clunk(1.03), 0.55)])


@sfx('sfx_chest_open', 'world', peak_db=-8, dur=(0.5, 1.1), fade_out=0.1)
def sfx_chest_open(rng):
    """clasp, lid creak, soft lid stop and a tiny sparkle"""
    lid = thump(150.0, 95.0, 0.12, rng, noise=0.4, tau=0.03)
    ev = [(0.0, _latch(rng, pitch=0.85), 1.0), (0.06, creak(0.42, 70.0, 165.0, rng, res=(600.0, 1100.0, 1900.0)), 0.5),
          (0.47, lid, 0.7), (0.5, glint(note('A6'), 0.3), 0.20), (0.57, glint(note('E7'), 0.3), 0.16)]
    return reverb(mixdown(ev), mix=0.12, rt=0.6, tail=0.1)


@sfx('sfx_switch', 'world', peak_db=-9, dur=(0.08, 0.3), fade_out=0.02)
def sfx_switch(rng):
    """click-clack of a toy switch"""
    a = modal([(900.0, 0.6, 0.006), (2100.0, 0.4, 0.004), (220.0, 0.5, 0.012)], 0.06) + 0.4 * click(rng, 0.06, 1200, 5000, 0.002)
    b = modal([(1400.0, 0.6, 0.005), (3100.0, 0.4, 0.003), (260.0, 0.4, 0.010)], 0.08) + 0.4 * click(rng, 0.08, 1500, 6000, 0.002)
    return mixdown([(0.0, a, 0.8), (0.07, b, 1.0)])


@sfx('sfx_push', 'world', peak_db=-8, dur=(0.35, 0.9), fade_in=0.02, fade_out=0.08)
def sfx_push(rng):
    """heavy object scraping over the floor"""
    d = 0.55
    n = secs(d)
    t = tt(d)
    slip = 0.55 + 0.45 * fftfilt(osc(34.0 * (1.0 + 0.2 * (smooth_rand(n, 6.0, rng) - 0.5)), shape='saw'), hi=400.0)
    x = band_noise(n, rng, lo=120.0, hi=1100.0) * grain(n, rng, 60.0, 0.6, 1.5) * slip
    x += 0.25 * np.sin(TWO_PI * 78.0 * t) * smooth_rand(n, 10.0, rng)
    return x * adsr(d, 0.05, 0.1, 0.85, 0.14)


@sfx('sfx_jump', 'world', peak_db=-10, dur=(0.1, 0.35), fade_out=0.03)
def sfx_jump(rng):
    """soft toy hop (rising blip)"""
    d = 0.2
    f = glide(320.0, 760.0, d)
    x = 0.7 * osc(f, shape='tri') + 0.3 * osc(f, shape='soft')
    return fftfilt(x * perc(d, 0.006, 0.075), hi=3500.0)


@sfx('sfx_fall', 'world', peak_db=-9, dur=(0.7, 1.3), fade_in=0.02, fade_out=0.12)
def sfx_fall(rng):
    """descending whistle with a little breath"""
    d = 1.0
    t = tt(d)
    f = glide(1700.0, 280.0, d) * (1.0 + 0.004 * (1.0 + 4.0 * t / d) * np.sin(TWO_PI * 7.0 * t))
    env = np.minimum(t / 0.04, 1.0) * (1.0 - t / d) ** 0.8
    x = osc(f) + 0.12 * osc(2.0 * f) + 0.22 * swept_noise(f, 260.0, rng)
    return x * env


@sfx('sfx_splash', 'world', peak_db=-7, dur=(0.4, 1.0), fade_out=0.1)
def sfx_splash(rng):
    """plop, spray and a few bubbles"""
    hit = band_noise(secs(0.12), rng, lo=150.0, hi=2600.0) * perc(0.12, 0.003, 0.035)
    d = 0.55
    spray = swept_noise(glide(3600.0, 1200.0, d), 3000.0, rng) * grain(secs(d), rng, 200.0, 0.5) * perc(d, 0.03, 0.16)
    ploop = osc(glide(230.0, 115.0, 0.1)) * perc(0.1, 0.003, 0.035)
    ev = [(0.0, hit, 1.0), (0.015, spray, 0.55), (0.0, ploop, 0.9)]
    for _ in range(6):
        f0 = rng.uniform(450.0, 1100.0)
        ev.append((rng.uniform(0.1, 0.45), osc(glide(f0, f0 * 1.9, 0.04)) * perc(0.04, 0.004, 0.012), rng.uniform(0.12, 0.3)))
    return mixdown(ev)


@sfx('sfx_bell', 'world', peak_db=-7, dur=(1.0, 2.4), fade_out=0.4)
def sfx_bell(rng):
    """small brass hand bell with a gentle warble"""
    f0 = 830.0
    ratios = [(0.5, 0.25, 1.4), (1.0, 1.0, 1.1), (1.183, 0.55, 0.8), (1.506, 0.35, 0.6), (2.0, 0.6, 0.5),
              (2.514, 0.25, 0.35), (2.662, 0.2, 0.3), (3.011, 0.15, 0.25), (4.166, 0.12, 0.15)]
    parts = []
    for r, a, tau in ratios:
        parts.append((f0 * r, a, tau))
        parts.append((f0 * r + 0.9 + 0.4 * r, a * 0.5, tau * 0.9))
    x = modal(parts, 1.8) + 0.3 * fit(click(rng, 0.02, 2000, 8000, 0.002), secs(1.8))
    return reverb(x, mix=0.15, rt=1.0, tail=0.1)


@sfx('sfx_knock', 'world', peak_db=-8, dur=(0.3, 0.7), fade_out=0.05)
def sfx_knock(rng):
    """knock-knock on a wooden door"""
    def k(p):
        m = modal([(190.0 * p, 1.0, 0.03), (410.0 * p, 0.6, 0.02), (760.0 * p, 0.3, 0.012), (1350.0 * p, 0.12, 0.006)], 0.16)
        return m + 0.2 * fit(click(rng, 0.03, 400, 2500, 0.004), len(m))
    x = mixdown([(0.0, k(1.0), 0.85), (0.17, k(1.04), 1.0)])
    return reverb(x, mix=0.1, rt=0.4, tail=0.1)


@sfx('sfx_emote', 'world', peak_db=-10, dur=(0.06, 0.25), fade_out=0.03)
def sfx_emote(rng):
    """bubble pop for emotion balloons"""
    d = 0.14
    t = tt(d)
    f = 380.0 + (1300.0 - 380.0) * smoothstep(t / 0.035)
    x = osc(f) * perc(d, 0.002, 0.032)
    return x + 0.12 * fit(click(rng, 0.02, 1500, 5000, 0.004), len(x))


@sfx('sfx_transfer', 'world', peak_db=-10, dur=(0.4, 1.0), fade_in=0.02, fade_out=0.1)
def sfx_transfer(rng):
    """soft whoosh for map transfers"""
    d = 0.7
    u = tt(d) / d
    fc = 320.0 * (2000.0 / 320.0) ** np.sin(np.pi * u ** 0.8)
    x = swept_noise(fc, 900.0, rng) + 0.5 * swept_noise(fc * 0.5, 400.0, rng)
    return x * swell(d, 0.45, 2.0)


# ====================================================================================================
# battle
# ====================================================================================================

@sfx('sfx_encounter', 'battle', peak_db=-4, dur=(0.6, 1.2), fade_in=0.004, fade_out=0.15)
def sfx_encounter(rng):
    """quick swirl-up: whole-tone run, rising air, soft accent"""
    ev = []
    run = ['C4', 'D4', 'E4', 'F#4', 'G#4', 'A#4', 'C5', 'D5', 'E5', 'F#5', 'G#5', 'A#5']
    for k, nm in enumerate(run):
        ev.append((0.04 * k, chip(note(nm), 0.09, tau=0.05, vib=0.01), 0.35 + 0.035 * k))
    d = 0.5
    air = swept_noise(glide(500.0, 5200.0, d), 1600.0, rng) * (tt(d) / d) ** 1.8
    ev.append((0.0, air, 0.16))
    ev.append((0.49, thump(190.0, 80.0, 0.2, rng, noise=0.4, tau=0.05), 1.0))
    ev.append((0.49, mbox(note('C6'), 0.4), 0.6))
    ev.append((0.49, mbox(note('F#6'), 0.4), 0.45))
    x = fftfilt(mixdown(ev), hi=6500.0, order=1)
    return reverb(x, mix=0.2, rt=0.8, tail=0.12)


@sfx('sfx_attack_swing', 'battle', peak_db=-9, dur=(0.15, 0.4), fade_in=0.005, fade_out=0.04)
def sfx_attack_swing(rng):
    """short swing whoosh"""
    d = 0.25
    u = tt(d) / d
    fc = 500.0 * (3600.0 / 500.0) ** np.sin(np.pi * u ** 0.7)
    return swept_noise(fc, 1800.0, rng) * swell(d, 0.4, 2.5)


def _hit(rng, f0, f1, d, crunch_hi, crunch_tau, drive):
    body = thump(f0, f1, d, rng, noise=0.3, tau=d * 0.28)
    crunch = band_noise(secs(d), rng, lo=300.0, hi=crunch_hi) * perc(d, 0.001, crunch_tau)
    return np.tanh(drive * (body + 0.55 * crunch)) / np.tanh(drive)


@sfx('sfx_hit_soft', 'battle', peak_db=-7, dur=(0.1, 0.35), fade_out=0.03)
def sfx_hit_soft(rng):
    """soft felt hit"""
    return _hit(rng, 240.0, 110.0, 0.2, 3200.0, 0.018, 1.2)


@sfx('sfx_hit_hard', 'battle', peak_db=-4, dur=(0.2, 0.5), fade_out=0.05)
def sfx_hit_hard(rng):
    """heavier hit with a dull slap"""
    a = _hit(rng, 210.0, 62.0, 0.32, 4500.0, 0.035, 2.2)
    slap = band_noise(secs(0.08), rng, lo=500.0, hi=3000.0) * perc(0.08, 0.002, 0.015)
    return mixdown([(0.0, a, 1.0), (0.028, slap, 0.3)])


@sfx('sfx_hit_crit', 'battle', peak_db=-4, dur=(0.5, 1.1), fade_out=0.15)
def sfx_hit_crit(rng):
    """hard hit with a little sparkle on top"""
    a = _hit(rng, 230.0, 58.0, 0.34, 5000.0, 0.04, 2.6)
    ev = [(0.0, a, 1.0)]
    for k, nm in enumerate(['E7', 'B6', 'G#7', 'E7']):
        ev.append((0.045 + 0.06 * k, glint(note(nm), 0.3), 0.2 - 0.03 * k))
    ev.append((0.03, chime(note('E6'), 0.45), 0.22))
    return reverb(mixdown(ev), mix=0.15, rt=0.8, tail=0.2)


@sfx('sfx_miss', 'battle', peak_db=-13, dur=(0.2, 0.5), fade_in=0.01, fade_out=0.06)
def sfx_miss(rng):
    """airy whiff"""
    d = 0.32
    x = swept_noise(glide(2400.0, 6000.0, d), 4000.0, rng)
    return fftfilt(x, lo=1500.0) * swell(d, 0.35, 2.0)


@sfx('sfx_guard', 'battle', peak_db=-7, dur=(0.15, 0.5), fade_out=0.05)
def sfx_guard(rng):
    """muted block: wooden 'tok' with a faint shimmer"""
    tok = modal([(520.0, 1.0, 0.04), (1040.0, 0.4, 0.02), (1680.0, 0.2, 0.01)], 0.3)
    shim = modal([(2500.0, 0.5, 0.07), (4100.0, 0.3, 0.05)], 0.3)
    return mixdown([(0.0, tok, 1.0), (0.0, thump(150.0, 100.0, 0.1, rng, noise=0.3, tau=0.03), 0.9), (0.004, shim, 0.3)])


@sfx('sfx_enemy_down', 'battle', peak_db=-6, dur=(0.5, 1.0), fade_out=0.06)
def sfx_enemy_down(rng):
    """pop, then a wobbly deflating slide"""
    pop = osc(glide(300.0, 950.0, 0.035)) * perc(0.035, 0.002, 0.012)
    d = 0.62
    t = tt(d)
    flut = 0.62 + 0.38 * np.sin(TWO_PI * np.cumsum(glide(30.0, 9.0, d)) / SR)
    tone = fftfilt(osc(glide(560.0, 85.0, d), shape='soft') * flut, hi=2500.0)
    air = swept_noise(glide(2600.0, 500.0, d), 1200.0, rng) * 0.22
    body = (0.8 * tone + air) * (1.0 - t / d) ** 1.3
    return mixdown([(0.0, pop, 0.9), (0.025, body, 1.0)])


@sfx('sfx_ally_down', 'battle', peak_db=-9, dur=(0.9, 1.7), fade_in=0.005, fade_out=0.25)
def sfx_ally_down(rng):
    """sad falling tone: three sagging notes in A minor"""
    d = 1.15
    t = tt(d)
    n = len(t)
    f = np.full(n, note('E5'))
    f[t >= 0.30] = note('C5')
    f[t >= 0.60] = note('A4')
    k = secs(0.05)
    f = np.convolve(np.pad(f, (k, k), mode='edge'), np.hanning(2 * k + 1) / np.hanning(2 * k + 1).sum(), mode='same')[k:-k]
    f = f * (1.0 + 0.006 * smoothstep((t - 0.6) / 0.4) * np.sin(TWO_PI * 5.2 * t)) * 2.0 ** (-(0.5 / 12.0) * smoothstep((t - 0.75) / 0.4))
    env = np.zeros(n)
    for t0, g in [(0.0, 1.0), (0.30, 0.85), (0.60, 0.75)]:
        env = np.maximum(env, g * np.where(t >= t0, np.exp(-(t - t0) / 0.32), 0.0))
    x = (0.7 * osc(f, shape='tri') + 0.3 * osc(f)) * env
    x = fftfilt(x, hi=2600.0)
    return reverb(x, mix=0.28, rt=1.1, tail=0.2)


@sfx('sfx_heal', 'battle', peak_db=-7, dur=(0.7, 1.4), fade_in=0.004, fade_out=0.25)
def sfx_heal(rng):
    """gentle rising shimmer (Cmaj9 arpeggio of soft chimes)"""
    ev = []
    for k, nm in enumerate(['C5', 'E5', 'G5', 'B5', 'D6', 'G6']):
        f = note(nm)
        ev.append((0.07 * k, soft_note(f, 0.55, a=0.015, tau=0.2, tri=0.1), 0.8))
        ev.append((0.07 * k, glint(2.0 * f, 0.3), 0.12))
    d = 0.8
    ev.append((0.0, swept_noise(glide(4000.0, 7500.0, d), 3000.0, rng) * swell(d, 0.6, 2.0), 0.035))
    return reverb(mixdown(ev), mix=0.3, rt=1.1, tail=0.15)


@sfx('sfx_buff', 'battle', peak_db=-8, dur=(0.3, 0.8), fade_out=0.08)
def sfx_buff(rng):
    """stat up: quick rising arpeggio with a lift underneath"""
    ev = []
    for k, nm in enumerate(['C5', 'E5', 'G5', 'C6']):
        ev.append((0.055 * k, chip(note(nm), 0.3 if k == 3 else 0.08, tau=0.12 if k == 3 else 0.05), 0.6))
    d = 0.3
    ev.append((0.0, osc(glide(260.0, 1040.0, d)) * swell(d, 0.7, 1.5), 0.35))
    x = fftfilt(mixdown(ev), hi=5000.0, order=1)
    return reverb(x, mix=0.12, rt=0.5, tail=0.06)


@sfx('sfx_debuff', 'battle', peak_db=-8, dur=(0.3, 0.9), fade_out=0.08)
def sfx_debuff(rng):
    """stat down: diminished steps falling, last one sags"""
    ev = []
    for k, nm in enumerate(['C5', 'A4', 'F#4']):
        ev.append((0.06 * k, chip(note(nm), 0.08, tau=0.05), 0.6))
    d = 0.34
    t = tt(d)
    f = note('D#4') * 2.0 ** (-(2.5 / 12.0) * (t / d) ** 1.5)
    last = osc(f, shape='soft') * perc(d, 0.003, 0.12) * (0.8 + 0.2 * np.sin(TWO_PI * 13.0 * t))
    ev.append((0.18, last, 0.65))
    x = fftfilt(mixdown(ev), hi=3500.0, order=1)
    return reverb(x, mix=0.12, rt=0.5, tail=0.06)


@sfx('sfx_escape', 'battle', peak_db=-9, dur=(0.4, 1.0), fade_out=0.06)
def sfx_escape(rng):
    """scurrying little feet running off, then a puff"""
    ev = []
    tcur = 0.0
    for k in range(9):
        f = 300.0 * (1.0 + 0.06 * k)
        tap = modal([(f, 1.0, 0.012), (f * 2.3, 0.4, 0.007)], 0.05) + 0.5 * click(rng, 0.05, 1500, 5000, 0.003)
        ev.append((tcur, tap, 1.0 - 0.07 * k))
        tcur += 0.078 - 0.0045 * k
    d = 0.24
    ev.append((tcur - 0.12, swept_noise(glide(900.0, 3400.0, d), 1500.0, rng) * swell(d, 0.5, 2.0), 0.3))
    return mixdown(ev)


@sfx('sfx_victory_sting', 'battle', peak_db=-5, dur=(0.8, 1.5), fade_out=0.2)
def sfx_victory_sting(rng):
    """short cheerful sting in F major"""
    ev = []
    for nm, t0, ln in [('C5', 0.0, 0.09), ('F5', 0.08, 0.09), ('A5', 0.16, 0.09), ('C6', 0.24, 0.13), ('A5', 0.35, 0.09)]:
        f = note(nm)
        ev.append((t0, toyp(f, ln + 0.25), 0.8))
        ev.append((t0, chip(f, ln + 0.04, tau=0.06), 0.3))
    for nm, g in [('F5', 0.6), ('A5', 0.55), ('C6', 0.6), ('F6', 0.7)]:
        ev.append((0.44, mbox(note(nm), 0.6), g))
        ev.append((0.44, toyp(note(nm), 0.5), g * 0.5))
    ev.append((0.0, pluck(note('F3'), 0.4, rng, bright=0.45), 0.6))
    ev.append((0.44, pluck(note('F2'), 0.6, rng, bright=0.5), 0.7))
    ev.append((0.44, pluck(note('C4'), 0.6, rng, bright=0.5), 0.4))
    x = fftfilt(mixdown(ev), hi=7000.0, order=1)
    return reverb(x, mix=0.18, rt=0.8, tail=0.12)


@sfx('sfx_skill_cast', 'battle', peak_db=-8, dur=(0.5, 1.2), fade_in=0.01, fade_out=0.15)
def sfx_skill_cast(rng):
    """soft charge-up that ends in a small 'ting'"""
    d = 0.66
    t = tt(d)
    f = glide(196.0, 784.0, d)
    trem = 0.65 + 0.35 * np.sin(TWO_PI * np.cumsum(glide(7.0, 28.0, d)) / SR)
    ramp = (t / d) ** 1.6
    x = (0.6 * osc(f) + 0.25 * osc(2.0 * f, shape='tri') * ramp + 0.10 * swept_noise(3.0 * f, 500.0, rng) * ramp) * trem * ramp
    x = fade(x, 0.0, 0.05)
    ev = [(0.0, x, 1.0), (0.62, mbox(note('G6'), 0.35), 0.55), (0.62, glint(note('D7'), 0.3), 0.15)]
    return reverb(mixdown(ev), mix=0.22, rt=0.8, tail=0.1)


@sfx('sfx_feel_up', 'battle', peak_db=-7, dur=(0.8, 1.5), fade_in=0.02, fade_out=0.2)
def sfx_feel_up(rng):
    """emotion intensifies: warm major swell that bends up into pitch and brightens"""
    d = 1.05
    t = tt(d)
    bend = 2.0 ** (-(1.0 - smoothstep(t / 0.55)) / 12.0)
    bright = smoothstep(t / 0.6)
    x = np.zeros(len(t))
    for nm, g in [('A3', 1.0), ('E4', 0.7), ('A4', 0.6), ('C#5', 0.5), ('E5', 0.3)]:
        for det in (-0.003, 0.003):
            f = note(nm) * bend * (1.0 + det)
            ph = rng.uniform(0, TWO_PI)
            x += g * (osc(f, phase=ph) * (1.0 - 0.45 * bright) + 0.5 * osc(f, shape='tri', phase=ph) * bright)
    env = swell(d, 0.6, 1.6)
    x = x * env + 0.5 * (osc(note('E6'), d) + osc(note('A6'), d)) * env ** 3 * 0.25
    x = fftfilt(x, hi=4500.0, order=1)
    return reverb(x, mix=0.2, rt=0.9, tail=0.12)


@sfx('sfx_feel_down', 'battle', peak_db=-8, dur=(0.7, 1.4), fade_in=0.02, fade_out=0.2)
def sfx_feel_down(rng):
    """emotion calms: exhale-like noise whose filter sweeps down"""
    d = 1.0
    t = tt(d)
    x = svf_lp(rng.standard_normal(len(t)), glide(3600.0, 240.0, d), q=1.1)
    env = np.minimum(t / 0.09, 1.0) ** 1.5 * np.exp(-t / 0.42) * (1.0 - t / d) ** 0.5
    sigh = osc(glide(440.0, 220.0, d)) * 0.10 * rms(x)
    return (x + sigh) * env


@sfx('sfx_feel_shift', 'battle', peak_db=-10, dur=(0.35, 0.9), fade_in=0.004, fade_out=0.1)
def sfx_feel_shift(rng):
    """emotion changes: two tones wobble, then settle on a third"""
    d = 0.6
    t = tt(d)
    fa, fb, fc = note('A4'), note('D5'), note('F#5')
    wob = np.tanh(2.5 * np.sin(TWO_PI * 9.0 * t))
    f = np.where(t < 0.345, fa * (fb / fa) ** (0.5 + 0.5 * wob), fc)
    k = secs(0.006)
    w = np.hanning(2 * k + 1)
    f = np.convolve(np.pad(f, (k, k), mode='edge'), w / w.sum(), mode='same')[k:-k]
    env = np.where(t < 0.36, 1.0, np.exp(-(t - 0.36) / 0.08)) * np.minimum(t / 0.008, 1.0)
    x = (0.65 * osc(f) + 0.35 * osc(f, shape='tri') + 0.12 * osc(2.0 * f)) * env
    x = fftfilt(x, hi=4000.0, order=1)
    return reverb(x, mix=0.15, rt=0.6, tail=0.08)


@sfx('sfx_combo', 'battle', peak_db=-7, dur=(0.35, 0.9), fade_out=0.08)
def sfx_combo(rng):
    """snappy toy xylophone run (C pentatonic, up)"""
    ev = []
    for k, nm in enumerate(['C6', 'D6', 'E6', 'G6', 'A6', 'C7']):
        ev.append((0.045 * k, xylo(note(nm), 0.3, rng), 0.7 + 0.06 * k))
    ev.append((0.225, xylo(note('C6'), 0.3, rng), 0.5))
    return reverb(mixdown(ev), mix=0.1, rt=0.5, tail=0.06)


@sfx('sfx_talk_success', 'battle', peak_db=-7, dur=(0.7, 1.4), fade_out=0.25)
def sfx_talk_success(rng):
    """heart-like soft chime: two warm dyads in a lub-dub rhythm"""
    ev = []
    for t0, names, g in [(0.0, ('E5', 'G#5'), 0.8), (0.17, ('B5', 'E6'), 1.0)]:
        for nm in names:
            ev.append((t0, soft_note(note(nm), 0.7, a=0.008, tau=0.26, tri=0.08), g * 0.6))
            ev.append((t0, mbox(note(nm), 0.6, bright=0.5), g * 0.35))
        ev.append((t0, thump(105.0, 78.0, 0.15, tau=0.04), g * 0.35))
    return reverb(mixdown(ev), mix=0.28, rt=1.1, tail=0.15)


@sfx('sfx_peace', 'battle', peak_db=-6, dur=(1.4, 2.4), fade_in=0.004, fade_out=0.4)
def sfx_peace(rng):
    """resolution: slow A major arpeggio on a soft harp and music box over a warm pad"""
    ev = []
    for k, nm in enumerate(['A3', 'E4', 'A4', 'C#5', 'E5', 'A5']):
        f = note(nm)
        ev.append((0.15 * k, pluck(f, 0.85, rng, bright=0.45, sustain=0.997), 0.8))
        ev.append((0.15 * k, mbox(2.0 * f, 0.8, bright=0.5), 0.35))
    d = 1.5
    pad = (osc(note('A3'), d) + 0.7 * osc(note('E4'), d) + 0.4 * osc(note('C#5'), d)) * swell(d, 0.5, 1.5)
    ev.append((0.0, pad, 0.16))
    x = fftfilt(mixdown(ev), hi=6000.0, order=1)
    return reverb(x, mix=0.3, rt=1.4, tail=0.15)


# ====================================================================================================
# eerie
# ====================================================================================================

@sfx('sfx_heartbeat', 'eerie', peak_db=-4, dur=(0.95, 1.05), fade_in=0.005, fade_out=0.1, lofi=False)
def sfx_heartbeat(rng):
    """two beats (lub-dub) inside exactly one second, silent edges so it can be looped"""
    def beat(f0, f1, ln):
        # octave and twelfth layers keep the beat audible on small speakers
        th = thump(f0, f1, ln, tau=ln * 0.28, drop=0.025) + 0.7 * thump(2.0 * f0, 2.0 * f1, ln, tau=ln * 0.2, drop=0.025)
        th = th + 0.4 * thump(3.0 * f0, 3.0 * f1, ln, tau=ln * 0.14, drop=0.025)
        th = np.tanh(2.2 * th) / np.tanh(2.2)
        nz = band_noise(secs(ln), rng, lo=40.0, hi=180.0) * perc(ln, 0.004, 0.03)
        return th + 0.25 * nz
    x = mixdown([(0.04, beat(88.0, 48.0, 0.22), 1.0), (0.33, beat(104.0, 58.0, 0.18), 0.72)], length=1.0)
    return fit(fftfilt(x, lo=30.0, hi=520.0), SR)


@sfx('sfx_static', 'eerie', peak_db=-9, dur=(0.3, 0.8), fade_in=0.002, fade_out=0.008, lp=7000.0)
def sfx_static(rng):
    """short burst of tape / TV static with dropouts"""
    d = 0.5
    n = secs(d)
    t = tt(d)
    nz = band_noise(n, rng, lo=250.0, hi=6500.0)
    bars = 0.65 + 0.35 * np.tanh(4.0 * np.sin(TWO_PI * 50.0 * t + 0.5))
    gate = np.zeros(n)
    i = 0
    while i < n:
        ln = secs(rng.uniform(0.02, 0.07))
        gate[i:i + ln] = rng.choice([0.15, 0.6, 1.0, 1.0])
        i += ln
    k = secs(0.002)
    gate = np.convolve(gate, np.ones(k) / k, mode='same')
    x = nz * bars * gate * (0.7 + 0.5 * crackle(n, rng, 400.0, 0.0006))
    return x + 0.35 * np.tanh(2.0 * np.sin(TWO_PI * 100.0 * t)) * gate


@sfx('sfx_glitch', 'eerie', peak_db=-11, dur=(0.25, 0.7), fade_in=0.001, fade_out=0.01, lp=6500.0)
def sfx_glitch(rng):
    """stuttery bitcrushed blip"""
    src = osc(glide(392.0, 587.0, 0.07), shape='soft') * perc(0.07, 0.002, 0.05)

    def sl(x, ln):
        return fade(x[:secs(ln)], 0.001, 0.001)
    ev = []
    pos = 0.0
    for _ in range(3):
        ev.append((pos, sl(src, 0.038), 1.0))
        pos += 0.045
    up = resample(src, 4.0 / 3.0)
    for _ in range(3):
        ev.append((pos, sl(up, 0.022), 0.9))
        pos += 0.027
    ev.append((pos, fade(band_noise(secs(0.02), rng, lo=500.0, hi=4000.0), 0.001, 0.001), 0.25))
    pos += 0.03
    low = resample(src, 0.5)
    for k in range(5):
        ev.append((pos, sl(low, 0.016), 0.9))
        pos += 0.02 + 0.004 * k
    ev.append((pos, fade(resample(src, 2.0), 0.001, 0.01), 0.8))
    x = bitcrush(mixdown(ev), bits=5, hold=7)
    return fftfilt(x, hi=6000.0, order=2)


@sfx('sfx_whisper', 'eerie', peak_db=-10, dur=(1.0, 2.2), fade_in=0.03, fade_out=0.3)
def sfx_whisper(rng):
    """breathy, wordless whisper: moving formant noise in irregular syllables"""
    d = 1.5
    n = secs(d)
    a = swept_noise(smooth_rand(n, 3.0, rng, 550.0, 1100.0), 420.0, rng)
    b = swept_noise(smooth_rand(n, 3.5, rng, 1500.0, 2600.0), 650.0, rng)
    air = band_noise(n, rng, lo=3500.0, hi=8000.0)
    env = np.zeros(n)
    pos = 0.04
    while pos < d - 0.25:
        ln = rng.uniform(0.14, 0.34)
        i, m = secs(pos), secs(ln)
        m = min(m, n - i)
        env[i:i + m] += np.hanning(m) ** 0.8 * rng.uniform(0.5, 1.0)
        pos += ln * rng.uniform(0.75, 1.0)
    x = (0.9 * a + 0.6 * b * smooth_rand(n, 4.0, rng, 0.3, 1.0) + 0.2 * air * smooth_rand(n, 5.0, rng) ** 2) * (0.12 + env)
    return reverb(fade(x, 0.03, 0.2), mix=0.35, rt=1.2, damp=0.5, tail=0.3)


@sfx('sfx_drone_hit', 'eerie', peak_db=-3, dur=(2.0, 3.0), fade_in=0.002, fade_out=0.6, lp=6000.0)
def sfx_drone_hit(rng):
    """low dark piano-like thud with a long beating tail"""
    d = 2.6
    t = tt(d)
    f0 = note('A1')
    x = np.zeros(len(t))
    for k in range(1, 15):
        fk = k * f0 * np.sqrt(1.0 + 0.0005 * k * k)
        amp = (0.7 if k == 1 else 1.0) / k ** 0.85 * (0.4 + 0.6 * abs(np.sin(k * np.pi * 0.12)))
        tau = 2.4 / (1.0 + 0.35 * (k - 1))
        x += amp * np.exp(-t / tau) * (np.sin(TWO_PI * fk * t) + 0.7 * np.sin(TWO_PI * fk * 1.0023 * t + 1.0))
    x += 0.08 * np.exp(-t / 1.8) * np.sin(TWO_PI * 2.0 * f0 * 2.0 ** (1.0 / 12.0) * t)
    x = fade(norm(x), 0.003, 0.0)
    x = x + 0.7 * fit(thump(110.0, 45.0, 0.25, rng, noise=0.5, tau=0.06), len(x))
    x = fftfilt(x, hi=1400.0, order=2)
    return fit(reverb(x, mix=0.4, rt=2.2, damp=0.6, tail=0.0, lp=2500.0), len(t))


@sfx('sfx_reverse_swell', 'eerie', peak_db=-5, dur=(1.2, 1.9), fade_in=0.08, fade_out=0.018)
def sfx_reverse_swell(rng):
    """reversed, slightly sour bell cluster that swells and cuts off"""
    d = 1.5
    ev = []
    for nm, cents, g in [('D4', 0, 1.0), ('A4', -12, 0.8), ('D#5', 9, 0.45), ('D5', 5, 0.5)]:
        f = note(nm) * 2.0 ** (cents / 1200.0)
        ev.append((0.0, soft_note(f, 1.3, a=0.004, tau=0.45, vib=0.002), g))
        ev.append((0.0, mbox(f * 2.0, 0.9, bright=0.6), g * 0.3))
    fwd = reverb(mixdown(ev), mix=0.7, rt=1.8, damp=0.45, tail=0.2)
    fwd = fit(fwd, secs(d))
    air = swept_noise(glide(3000.0, 800.0, d), 1200.0, rng) * np.exp(-tt(d) / 0.35) * 0.06 * rms(fwd) * 6.0
    return (fwd + air)[::-1].copy()


@sfx('sfx_music_box_broken', 'eerie', peak_db=-8, dur=(1.8, 3.0), fade_out=0.4)
def sfx_music_box_broken(rng):
    """a few detuned plinks slowing to a stop"""
    names = ['E6', 'C6', 'G5', 'A5', 'E5', 'F5']
    cents = [8.0, -25.0, 14.0, -38.0, 22.0, -55.0]
    gaps = [0.17, 0.21, 0.28, 0.39, 0.56]
    ev = []
    tcur = 0.03
    for k, nm in enumerate(names):
        last = k == len(names) - 1
        ev.append((tcur, mbox(note(nm), 1.0 if last else 0.7, bright=1.2, cents=cents[k], droop=70.0 if last else 6.0 * k),
                   0.9 - 0.06 * k))
        ev.append((max(tcur - 0.012, 0.0), click(rng, 0.01, 2500, 7000, 0.0015), 0.10))
        if not last:
            tcur += gaps[k]
    x = wow(mixdown(ev), rate=0.9, depth=0.006)
    return reverb(x, mix=0.25, rt=1.2, damp=0.5, tail=0.1)


@sfx('sfx_tear', 'eerie', peak_db=-7, dur=(0.35, 0.9), fade_in=0.004, fade_out=0.03, lp=8000.0)
def sfx_tear(rng):
    """paper tearing: crackle density and level rise, then stop"""
    d = 0.55
    n = secs(d)
    t = tt(d)
    hi = band_noise(n, rng, lo=1000.0, hi=5500.0) * (0.22 + 0.78 * crackle(n, rng, glide(250.0, 1700.0, d), 0.0012))
    lo = band_noise(n, rng, lo=350.0, hi=1400.0) * (0.3 + 0.7 * crackle(n, rng, 130.0, 0.004))
    env = (t / d) ** 0.6 * (1.0 - smoothstep((t - (d - 0.05)) / 0.05))
    return (hi + 0.5 * lo) * env


def _strokes(d, rate, rng, phase=0.0):
    """back-and-forth hand movement: returns (amplitude, speed 0..1) for rubbing sounds"""
    t = tt(d)
    jitter = 1.0 + 0.15 * (smooth_rand(len(t), 3.0, rng) - 0.5)
    ph = TWO_PI * np.cumsum(rate * jitter) / SR + phase
    speed = np.abs(np.sin(ph))
    return speed ** 0.7, speed


@sfx('sfx_scribble', 'eerie', peak_db=-9, dur=(0.4, 0.9), fade_in=0.006, fade_out=0.04)
def sfx_scribble(rng):
    """quick pencil scribble"""
    d = 0.6
    n = secs(d)
    amp, speed = _strokes(d, 4.3, rng)
    x = swept_noise(2000.0 + 1600.0 * speed, 2600.0, rng) * grain(n, rng, 700.0, 0.6)
    body = band_noise(n, rng, lo=300.0, hi=800.0) * 0.2
    return (x + body) * amp * fade(np.ones(n), 0.01, 0.08)


@sfx('sfx_erase', 'eerie', peak_db=-11, dur=(0.4, 1.0), fade_in=0.006, fade_out=0.05)
def sfx_erase(rng):
    """eraser rubbing on paper"""
    d = 0.66
    n = secs(d)
    t = tt(d)
    amp, speed = _strokes(d, 2.5, rng)
    rub = 0.6 + 0.4 * np.sin(TWO_PI * 46.0 * t) * speed
    x = swept_noise(500.0 + 700.0 * speed, 1300.0, rng) * grain(n, rng, 150.0, 0.5) * rub
    return x * amp * fade(np.ones(n), 0.01, 0.1)


# ====================================================================================================
# ambience loops (stereo, exactly periodic over the buffer -> seamless without any crossfade)
# ====================================================================================================

@sfx('amb_rain', 'amb', peak_db=-12, dur=(8.0, 12.0), loop=True, stereo=True, volume=0.5, drive=0.6)
def amb_rain(rng):
    """steady soft rain with small droplets"""
    d = 10.0
    n = secs(d)
    u = np.arange(n) / n
    lfo = 1.0 + 0.10 * np.sin(TWO_PI * u + rng.uniform(0, TWO_PI)) + 0.06 * np.sin(TWO_PI * 3.0 * u + rng.uniform(0, TWO_PI))
    chans = []
    for _ in range(2):
        hiss = circ_noise(n, rng, lo=900.0, hi=6500.0, order=1, tilt=-0.4)
        mid = circ_noise(n, rng, lo=250.0, hi=1800.0) * np.clip(1.0 + 0.35 * circ_noise(n, rng, hi=25.0), 0.2, None)
        rumble = circ_noise(n, rng, lo=50.0, hi=220.0)
        drops = np.zeros(n)
        for fc, tau, rate, amp in [(2200.0, 0.0025, 35, 1.0), (3300.0, 0.0018, 50, 0.8), (4700.0, 0.0012, 60, 0.6),
                                   (1400.0, 0.004, 14, 1.0), (800.0, 0.006, 6, 0.9)]:
            imp = np.zeros(n)
            cnt = rng.poisson(rate * d)
            np.add.at(imp, rng.integers(0, n, cnt), rng.random(cnt) ** 3)
            kt = np.arange(secs(tau * 8)) / SR
            drops += amp * circ_conv(imp, np.exp(-kt / tau) * np.sin(TWO_PI * fc * kt))
        ch = 0.55 * hiss + 0.5 * mid + 0.18 * rumble + 0.35 * drops / rms(drops)
        chans.append(ch * lfo)
    return np.stack(chans, axis=1)


@sfx('amb_wind', 'amb', peak_db=-10, dur=(8.0, 12.5), loop=True, stereo=True, volume=0.5, drive=0.6)
def amb_wind(rng):
    """slow gusting wind with a faint whistle on the strongest gusts"""
    d = 12.0
    n = secs(d)
    gust = circ_lfo(n, rng, 6)
    fcw = 760.0 + 420.0 * circ_lfo(n, rng, 4)
    wph = circ_phase(fcw)
    chans = []
    for _ in range(2):
        ch = np.zeros(n)
        for i, (fc, base) in enumerate([(170.0, 1.0), (300.0, 0.9), (500.0, 0.75), (800.0, 0.55), (1250.0, 0.35), (2000.0, 0.2)]):
            nzb = circ_noise(n, rng, lo=fc / 1.35, hi=fc * 1.35)
            gain = base * (0.22 + 0.78 * gust) ** (1.5 + 0.45 * i) * (0.4 + 0.6 * circ_lfo(n, rng, 7))
            ch += nzb * gain
        re = circ_noise(n, rng, hi=35.0)
        im = circ_noise(n, rng, hi=35.0)
        ch += 0.10 * (re * np.cos(wph) - im * np.sin(wph)) * gust ** 3
        chans.append(ch)
    return np.stack(chans, axis=1)


@sfx('amb_night_crickets', 'amb', peak_db=-14, dur=(8.0, 12.0), loop=True, stereo=True, volume=0.5, drive=0.5)
def amb_night_crickets(rng):
    """quiet night: two chirping crickets, a distant trill, soft air"""
    d = 10.0
    n = secs(d)
    t = np.arange(n) / SR
    left = 0.03 * circ_noise(n, rng, lo=80.0, hi=1500.0, order=1, tilt=-0.5) + 0.006 * circ_noise(n, rng, lo=4000.0, hi=9000.0)
    right = 0.03 * circ_noise(n, rng, lo=80.0, hi=1500.0, order=1, tilt=-0.5) + 0.006 * circ_noise(n, rng, lo=4000.0, hi=9000.0)

    def chirp(fc, pulses, plen, gap):
        m = secs(plen)
        one = np.hanning(m) * np.sin(TWO_PI * fc * np.arange(m) / SR)
        out = np.zeros(secs(gap) * (pulses - 1) + m)
        for p in range(pulses):
            i = secs(gap) * p
            out[i:i + m] += one * (0.75 + 0.25 * p / max(pulses - 1, 1))
        return out

    def cricket(fc, pulses, plen, gap, count, amp, pan_l, pan_r, phrase_cycles):
        active = circ_lfo(n, rng, phrase_cycles)
        for k in range(count):
            pos = int(((k + 0.3) * d / count + rng.uniform(-0.012, 0.012)) * SR) % n
            if active[pos] < 0.28:
                continue
            c = chirp(fc * rng.uniform(0.995, 1.005), pulses, plen, gap) * amp * rng.uniform(0.75, 1.0)
            circ_add(left, pos, c, pan_l)
            circ_add(right, pos, c, pan_r)

    cricket(4100.0, 3, 0.011, 0.017, 20, 0.30, 0.85, 0.35, 2)
    cricket(3620.0, 2, 0.014, 0.021, 13, 0.16, 0.30, 0.75, 3)
    trill = np.sin(TWO_PI * 2900.0 * t) * (0.5 + 0.5 * np.cos(TWO_PI * 25.0 * t)) ** 3 * circ_lfo(n, rng, 3) ** 2 * 0.05
    return np.stack([left + 0.55 * trill, right + 0.55 * trill], axis=1)


@sfx('amb_room_hum', 'amb', peak_db=-16, dur=(8.0, 12.0), loop=True, stereo=True, volume=0.5, drive=0.5)
def amb_room_hum(rng):
    """indoor quiet: mains hum, a faint appliance buzz and soft air"""
    d = 10.0
    n = secs(d)
    t = np.arange(n) / SR
    u = np.arange(n) / n
    parts = [(50.0, 0.35), (100.0, 1.0), (150.0, 0.55), (200.0, 0.30), (250.0, 0.20), (300.0, 0.12), (350.0, 0.06)]
    phases = [rng.uniform(0, TWO_PI) for _ in parts]
    buzz_ph = rng.uniform(0, TWO_PI)
    chans = []
    for _ in range(2):
        hum = np.zeros(n)
        for (f, a), ph in zip(parts, phases):
            hum += a * np.sin(TWO_PI * f * t + ph + rng.uniform(-0.3, 0.3))
        am = 1.0 + 0.06 * np.sin(TWO_PI * u + rng.uniform(0, TWO_PI)) + 0.04 * np.sin(TWO_PI * 3.0 * u + rng.uniform(0, TWO_PI))
        buzz = 0.12 * np.tanh(2.0 * np.sin(TWO_PI * 100.0 * t + buzz_ph))
        air = 0.22 * circ_noise(n, rng, lo=90.0, hi=600.0, tilt=-0.5) + 0.02 * circ_noise(n, rng, lo=900.0, hi=3500.0)
        chans.append(0.5 * hum * am + buzz + air)
    return np.stack(chans, axis=1)


@sfx('amb_void', 'amb', peak_db=-10, dur=(8.0, 12.5), loop=True, stereo=True, volume=0.5, lp=5000.0, drive=1.2)
def amb_void(rng):
    """slow dark minor pad with faint breathing noise"""
    d = 12.0
    n = secs(d)
    t = np.arange(n) / SR
    u = np.arange(n) / n
    voices = [(36.71, 0.15), (73.42, 0.6), (110.0, 0.7), (146.83, 0.8), (174.61, 0.6), (220.0, 0.45), (293.66, 0.25),
              (311.13, 0.07), (440.0, 0.08)]
    plan = [(np.round(f * d) / d, a, int(rng.integers(2, 6)), int(rng.integers(1, 4)), rng.uniform(0, TWO_PI),
             rng.uniform(0, TWO_PI), rng.uniform(0, TWO_PI)) for f, a in voices]
    chans = []
    for _ in range(2):
        ch = np.zeros(n)
        for f, a, beat, cyc, ph1, ph2, ph3 in plan:
            lfo = 0.55 + 0.45 * np.sin(TWO_PI * cyc * u + ph3 + rng.uniform(-0.8, 0.8))
            ch += a * lfo * (np.sin(TWO_PI * f * t + ph1)
                             + 0.8 * np.sin(TWO_PI * (f + beat / d) * t + ph2 + rng.uniform(-0.5, 0.5)))
        ch = ch / np.max(np.abs(ch))
        ch += 0.05 * circ_noise(n, rng, lo=150.0, hi=1200.0) * (0.3 + 0.7 * circ_lfo(n, rng, 4)) ** 2
        ch += 0.006 * circ_noise(n, rng, lo=2000.0, hi=5000.0)
        chans.append(ch)
    return np.stack(chans, axis=1)



# ====================================================================================================
# added for LOW TIDE LETTERS content (bible 11.3): sea-glass, the tin can, the gull, two ambiences
# ====================================================================================================

@sfx('sfx_glass_clink', 'battle', peak_db=-10, dur=(0.15, 0.5), fade_out=0.04)
def sfx_glass_clink(rng):
    """two small pieces of sea-glass knocking together in a pocket"""
    f0 = 3100.0 + rng.uniform(-200, 200)
    a = modal([(f0, 0.9, 0.06), (f0 * 1.71, 0.5, 0.04), (f0 * 2.43, 0.25, 0.03), (f0 * 0.52, 0.3, 0.09)], 0.28)
    b = modal([(f0 * 1.19, 0.7, 0.05), (f0 * 2.05, 0.35, 0.03), (f0 * 0.61, 0.25, 0.08)], 0.22)
    x = mixdown([(0.0, a, 1.0), (0.0, fit(click(rng, 0.008, 2500, 9000, 0.0015), secs(0.28)), 0.6),
                 (0.075, b, 0.8), (0.075, fit(click(rng, 0.006, 2500, 9000, 0.0015), secs(0.22)), 0.4)])
    return reverb(x, mix=0.08, rt=0.4, tail=0.05)


@sfx('sfx_glass_tumble', 'battle', peak_db=-9, dur=(0.5, 1.1), fade_out=0.08)
def sfx_glass_tumble(rng):
    """a piece of glass skimmed along wet sand to a friend: a skip, a slide, a soft landing"""
    d = 0.85
    n = secs(d)
    t = tt(d)
    skips = [(0.0, 1.0), (0.11, 0.8), (0.2, 0.65), (0.27, 0.5), (0.33, 0.4)]
    ev = []
    for k, (at, g) in enumerate(skips):
        f0 = 2400.0 * (1.0 - 0.06 * k)
        ev.append((at, modal([(f0, 0.8, 0.03), (f0 * 1.6, 0.4, 0.02)], 0.12), g))
    slide = band_noise(n, rng, lo=900.0, hi=3200.0) * np.exp(-((t - 0.42) / 0.14) ** 2) * 0.5
    land = fit(modal([(1900.0, 0.7, 0.05), (2600.0, 0.4, 0.04), (4200.0, 0.2, 0.02)], 0.25), n)
    x = fit(mixdown(ev), n) + slide + np.concatenate([np.zeros(secs(0.58)), land])[:n] * 0.8
    return reverb(x, mix=0.12, rt=0.6, tail=0.1)


@sfx('sfx_can_rattle', 'world', peak_db=-9, dur=(0.35, 0.9), fade_out=0.06)
def sfx_can_rattle(rng):
    """a dented tin can on a string, rattling: three quick tinny knocks and a ring"""
    d = 0.7
    n = secs(d)
    ring = modal([(1180.0, 0.6, 0.18), (1790.0, 0.45, 0.12), (2650.0, 0.3, 0.08), (3900.0, 0.15, 0.05)], 0.6)
    ev = []
    for k, at in enumerate([0.0, 0.07, 0.16, 0.21]):
        g = 1.0 - 0.18 * k
        ev.append((at, modal([(760.0 + 40 * k, 0.9, 0.04), (1180.0, 0.5, 0.06), (2300.0, 0.3, 0.02)], 0.16), g))
        ev.append((at, fit(click(rng, 0.01, 800, 5000, 0.002), secs(0.16)), 0.7 * g))
    x = fit(mixdown(ev), n) + fit(ring, n) * 0.35
    buzz = band_noise(n, rng, lo=1500.0, hi=4500.0) * perc(d, 0.003, 0.12) * 0.25
    return reverb(x + buzz, mix=0.1, rt=0.5, tail=0.08)


@sfx('sfx_gull_cry', 'world', peak_db=-8, dur=(0.6, 1.4), fade_out=0.1)
def sfx_gull_cry(rng):
    """a herring gull's two-note cry, softened into a paper gull taking off"""
    d = 1.1
    t = tt(d)
    out = np.zeros(len(t))
    for k, (at, ln, f_hi, f_lo) in enumerate([(0.0, 0.32, 1750.0, 1250.0), (0.38, 0.5, 1900.0, 1100.0)]):
        seg = (t >= at) & (t < at + ln)
        u = (t[seg] - at) / ln
        f = f_hi * (1.0 - u) ** 0.6 + f_lo * u + 40.0 * np.sin(TWO_PI * 38.0 * t[seg])
        ph = np.cumsum(f) / SR * TWO_PI
        v = 0.55 * np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)
        env = np.sin(np.pi * u) ** 0.7
        out[seg] += v * env
    breath = band_noise(len(t), rng, lo=1200.0, hi=5000.0) * 0.12 * np.exp(-((t - 0.45) / 0.35) ** 2)
    wing = band_noise(len(t), rng, lo=150.0, hi=600.0) * 0.18 * (t > 0.7) * np.sin(TWO_PI * 9.0 * t) ** 2
    x = fftfilt(out, hi=6500.0, order=2) + breath + wing
    return reverb(x, mix=0.2, rt=1.2, tail=0.15)


@sfx('amb_sea', 'amb', peak_db=-14, dur=(10.0, 14.0), loop=True, stereo=True, volume=0.5, drive=0.5)
def amb_sea(rng):
    """slow waves on shingle, far away: a soft rush in, a hiss of stones drawing back"""
    d = 12.0
    n = secs(d)
    swell = 0.5 + 0.5 * np.sin(TWO_PI * np.arange(n) / n * 2 + 0.3) ** 2
    draw = 0.5 + 0.5 * np.sin(TWO_PI * np.arange(n) / n * 2 + 2.1) ** 6
    chans = []
    for _ in range(2):
        rush = circ_noise(n, rng, lo=120.0, hi=900.0) * (0.15 + 0.85 * swell) ** 2
        hiss = circ_noise(n, rng, lo=1500.0, hi=5200.0) * draw * (0.4 + 0.6 * circ_lfo(n, rng, 9))
        deep = circ_noise(n, rng, hi=140.0) * 0.5 * (0.3 + 0.7 * circ_lfo(n, rng, 3))
        chans.append(rush * 0.8 + hiss * 0.35 + deep)
    return np.stack(chans, axis=1)


@sfx('amb_lull', 'amb', peak_db=-16, dur=(10.0, 14.0), loop=True, stereo=True, volume=0.45, drive=0.5)
def amb_lull(rng):
    """underwater hush with slow bubbles and a faint far-off music-box shimmer"""
    d = 12.0
    n = secs(d)
    hush = [circ_noise(n, rng, lo=60.0, hi=420.0) * (0.5 + 0.5 * circ_lfo(n, rng, 4)) for _ in range(2)]
    tone = np.zeros(n)
    tt_ = np.arange(n) / SR
    for f, g in [(392.0, 0.5), (523.25, 0.4), (659.25, 0.3), (783.99, 0.25)]:
        cyc = max(1, int(round(f * d)))
        fq = cyc / d
        tone += g * np.sin(TWO_PI * fq * tt_) * (0.5 + 0.5 * circ_lfo(n, rng, 2)) ** 2
    tone *= 0.025
    bub = np.zeros(n)
    for k in range(14):
        at = int(rng.uniform(0, n))
        ln = secs(0.18)
        u = np.arange(ln) / ln
        f = 700.0 * (1 + 0.8 * u) * rng.uniform(0.7, 1.4)
        b = np.sin(TWO_PI * f * u * 0.18) * np.sin(np.pi * u) ** 2 * 0.12
        idx = (at + np.arange(ln)) % n
        bub[idx] += b
    chans = [hush[0] + tone + bub, hush[1] + tone + bub * 0.8]
    return np.stack(chans, axis=1)


# ====================================================================================================
# rendering
# ====================================================================================================

def finalize(x, spec):
    """tone chain, DC removal, edge fades, peak normalisation -> float array (n, channels)"""
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = x[:, None]
    if not np.all(np.isfinite(x)):
        raise ValueError(spec['id'] + ': non-finite samples')
    pk = np.max(np.abs(x))
    if pk < 1e-9:
        raise ValueError(spec['id'] + ': silent output')
    x = x / pk
    loop = spec['loop']
    if spec['lofi']:
        x = fftfilt(x, hi=spec['lp'], order=2, circular=loop)
        dr = spec['drive']
        x = np.tanh(dr * x) / np.tanh(dr)
    if loop:
        x = x - x.mean(axis=0, keepdims=True)
    else:
        x = fade(x, spec['fade_in'], spec['fade_out'])
        # windowed DC removal keeps both ends at exactly zero
        w = np.hanning(x.shape[0])[:, None]
        x = x - w * (x.mean(axis=0, keepdims=True) / w.mean())
    return x * (10.0 ** (spec['peak_db'] / 20.0) / np.max(np.abs(x)))


def encode_ogg(x, path, q=4, page_us=1):
    """float array (n, ch) -> OGG Vorbis.

    page_us is the Ogg page duration in microseconds.  It matters: when a whole short sound fits in ONE Ogg
    page, ffmpeg-based decoders (the ffmpeg CLI and Chrome's decodeAudioData) mis-handle the start/end
    granule positions and either drop the last 128 samples or append ~20 ms of padding.  Forcing one packet
    per page (page_us=1) makes the decoded length sample-exact; it costs about 28 bytes per packet."""
    ch = x.shape[1]
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', str(ch), '-i', 'pipe:0',
           '-map_metadata', '-1', '-c:a', 'libvorbis', '-q:a', str(q), '-ar', str(SR), '-ac', str(ch),
           '-page_duration', str(int(page_us)), path]
    subprocess.run(cmd, input=x.astype('<f4').tobytes(), check=True)


def seam_score(step, kink, click_db, level):
    return max(step / 4.0, kink / 4.0) + max(click_db, -6.0) / 6.0 + 1.0


def encode_loop(x, path, tries=14):
    """A loop is periodic, so every circular rotation of it is the same loop.  The codec does not know the
    file wraps, so the tiny quantisation mismatch at the seam differs per rotation: encode several rotations,
    decode each and keep the cleanest seam."""
    n = x.shape[0]
    best = None
    tmp = path + '.tmp.ogg'
    for k in range(tries):
        rot = np.roll(x, -int(k * n / tries + (0 if k == 0 else 1777 * k)) % n, axis=0)
        encode_ogg(rot, tmp, page_us=100000)
        score = seam_score(*seam_metrics(decode(tmp)[0]))
        if best is None or score < best[0]:
            best = (score, rot)
            os.replace(tmp, path)
    if os.path.exists(tmp):
        os.remove(tmp)
    return best[1]


def render(sid, out_dir):
    spec = REGISTRY[sid]
    rng = np.random.default_rng(zlib.crc32(sid.encode('utf-8')))
    x = finalize(spec['fn'](rng), spec)
    if (x.shape[1] == 2) != bool(spec['stereo']):
        raise ValueError(sid + ': channel count does not match stereo flag')
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, sid + '.ogg')
    if spec['loop']:
        x = encode_loop(x, path)
    else:
        encode_ogg(x, path)
    side = os.path.join(out_dir, sid + '.json')
    if spec['loop'] or spec['volume'] is not None:
        with open(side, 'w') as fh:
            json.dump({'loop': bool(spec['loop']), 'volume': spec['volume'] if spec['volume'] is not None else 1.0}, fh)
            fh.write('\n')
    return x


# ====================================================================================================
# analysis / report
# ====================================================================================================

def db(v):
    return 20.0 * np.log10(max(float(v), 1e-12))


def decode(path):
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path]))
    st = info['streams'][0]
    ch = int(st['channels'])
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-acodec', 'pcm_f32le', '-'])
    x = np.frombuffer(raw, dtype='<f4').astype(np.float64).reshape(-1, ch)
    return x, dict(codec=st.get('codec_name'), sr=int(st['sample_rate']), ch=ch,
                   probe_dur=float(info['format'].get('duration', 0.0)), size=int(info['format'].get('size', 0)))


def sparkline(x, cells=16):
    chars = ' .:-=+*#@'
    m = np.max(np.abs(x), axis=1)
    seg = np.array_split(m, cells)
    lv = np.array([db(np.sqrt(np.mean(s ** 2))) if len(s) else -120.0 for s in seg])
    lv = lv - lv.max()
    return ''.join(chars[int(np.clip((v + 48.0) / 48.0, 0.0, 1.0) * (len(chars) - 1))] for v in lv)


def seam_metrics(x):
    """wrap-around checks on a decoded loop, worst channel.  Returns (step, kink, click_db, level_db):
    step     |x[0]-x[-1]| divided by the RMS of ordinary sample-to-sample differences near the seam
    kink     second difference across the seam divided by the local RMS second difference
    click_db high-frequency (>3 kHz) energy of a 5.8 ms frame centred on the seam, relative to the 99th
             percentile of all other frames of the file (0 dB or less = indistinguishable from the rest)
    level_db 50 ms RMS jump across the seam beyond the largest ordinary jump between neighbouring windows"""
    worst = [0.0, 0.0, -120.0, -120.0]
    win = np.hanning(256)
    band = np.fft.rfftfreq(256, 1.0 / SR) > 3000.0
    for c in range(x.shape[1]):
        v = x[:, c]
        n = len(v)
        ring = np.concatenate([v[-2048:], v[:2048]])  # the seam sits between ring[2047] and ring[2048]
        d = np.diff(ring)
        step = abs(d[2047]) / rms(np.delete(d, 2047))
        dd = np.diff(ring, 2)
        kink = max(abs(dd[2046]), abs(dd[2047])) / rms(np.delete(dd, [2046, 2047]))
        frames = np.lib.stride_tricks.sliding_window_view(v, 256)[::128]
        energy = np.sum(np.abs(np.fft.rfft(frames * win, axis=1))[:, band] ** 2, axis=1) + 1e-18
        seam = np.sum(np.abs(np.fft.rfft(ring[2048 - 128:2048 + 128] * win))[band] ** 2) + 1e-18
        click_db = 10.0 * np.log10(seam / np.percentile(energy, 99))
        k = secs(0.05)
        wins = np.array([db(rms(v[i:i + k])) for i in range(0, n - k + 1, k)])
        level = abs(db(rms(v[:k])) - db(rms(v[-k:]))) - np.max(np.abs(np.diff(wins)))
        worst = [max(worst[0], step), max(worst[1], kink), max(worst[2], click_db), max(worst[3], level)]
    return worst


def analyse(sid, out_dir):
    """returns (row dict, list of failure strings)"""
    spec = REGISTRY[sid]
    path = os.path.join(out_dir, sid + '.ogg')
    fails = []
    if not os.path.isfile(path):
        return None, ['file missing']
    try:
        x, info = decode(path)
    except Exception as exc:  # noqa: BLE001
        return None, ['does not decode: %s' % exc]
    n = x.shape[0]
    dur = n / SR
    peak = float(np.max(np.abs(x)))
    mono = x.mean(axis=1)
    k = secs(0.05)
    if n > k:
        cs = np.cumsum(np.concatenate([[0.0], mono ** 2]))
        max50 = float(np.sqrt(np.max(cs[k:] - cs[:-k]) / k))
    else:
        max50 = rms(mono)
    dc = float(np.max(np.abs(x.mean(axis=0))))
    spec_mag = np.abs(np.fft.rfft(mono)) ** 2
    f = np.fft.rfftfreq(n, 1.0 / SR)
    cent = float(np.sum(f * spec_mag) / (np.sum(spec_mag) + 1e-30))
    hf = float(np.sum(spec_mag[f > 6000.0]) / (np.sum(spec_mag) + 1e-30))
    edge_in = float(np.max(np.abs(x[:3])))
    edge_out = float(np.max(np.abs(x[-3:])))
    edge = max(edge_in, edge_out)
    onset = float(np.max(np.abs(x[:secs(0.010)])))
    row = dict(id=sid, group=spec['group'], dur=dur, ch=info['ch'], peak=db(peak), target=spec['peak_db'], rms=db(rms(x)),
               max50=db(max50), dc=dc, cent=cent, hf=hf * 100.0, edge=db(edge), size=info['size'] / 1024.0,
               env=sparkline(x), seam='')
    if info['codec'] != 'vorbis':
        fails.append('codec %s' % info['codec'])
    if info['sr'] != SR:
        fails.append('sample rate %d' % info['sr'])
    if info['ch'] != (2 if spec['stereo'] else 1):
        fails.append('channels %d' % info['ch'])
    if abs(info['probe_dur'] - dur) > 0.01:
        fails.append('ffprobe duration %.3f differs from decoded %.3f' % (info['probe_dur'], dur))
    if not (spec['dur'][0] <= dur <= spec['dur'][1]):
        fails.append('duration %.3f outside %s' % (dur, spec['dur']))
    if spec['group'] == 'blip' and dur >= 0.080:
        fails.append('blip longer than 80 ms')
    if peak >= 10.0 ** (-0.9 / 20.0) or np.mean(np.abs(x) > 0.98) > 0:
        fails.append('clipping risk (peak %.2f dBFS)' % db(peak))
    if abs(db(peak) - spec['peak_db']) > 1.5:
        fails.append('peak %.1f dB is off target %.1f' % (db(peak), spec['peak_db']))
    if db(rms(x)) < -60.0 or db(peak) < -32.0:
        fails.append('too quiet / silent')
    if dc > 0.003 or dc > 0.05 * rms(x):
        fails.append('DC offset %.5f' % dc)
    if spec['loop']:
        step, kink, click_db, level = seam_metrics(x)
        row['seam'] = 'seam: step %.2f kink %.2f click %+.1fdB level %+.1fdB' % (step, kink, click_db, level)
        if step > 4.0:
            fails.append('loop seam step %.2f x local rms' % step)
        if kink > 4.0:
            fails.append('loop seam kink %.2f x local rms' % kink)
        if click_db > 0.0:
            fails.append('loop seam HF click %+.1f dB' % click_db)
        if level > 0.0:
            fails.append('loop seam level jump %+.1f dB beyond normal' % level)
    else:
        if edge_out > 0.01 * peak + 0.0015:
            fails.append('end not silent (%.1f dBFS)' % db(edge_out))
        # A percussive sound that starts at t=0 gets a little codec pre-echo on its first samples.  That is
        # masked when the real attack (within the first 10 ms) is at least 18 dB louder.
        if edge_in > 0.01 * peak + 0.0015 and edge_in > 0.125 * onset:
            fails.append('start not silent (%.1f dBFS, onset %.1f dBFS)' % (db(edge_in), db(onset)))
    return row, fails


def report(ids, out_dir):
    head = '%-22s %-6s %7s %2s %7s %7s %7s %8s %6s %5s %6s %6s  %-16s %s' % (
        'id', 'group', 'dur_s', 'ch', 'peak', 'rms', 'max50', 'dc', 'cent', 'hf%', 'edge', 'KiB', 'envelope', 'status')
    print(head)
    print('-' * len(head))
    bad = 0
    total = 0.0
    for sid in ids:
        row, fails = analyse(sid, out_dir)
        if row is None:
            print('%-22s %s' % (sid, 'FAIL: ' + '; '.join(fails)))
            bad += 1
            continue
        total += row['size']
        status = 'ok' if not fails else 'FAIL: ' + '; '.join(fails)
        if row['seam']:
            status += '  [' + row['seam'] + ']'
        print('%-22s %-6s %7.3f %2d %7.1f %7.1f %7.1f %8.5f %6.0f %5.1f %6.0f %6.1f  %-16s %s' % (
            row['id'], row['group'], row['dur'], row['ch'], row['peak'], row['rms'], row['max50'], row['dc'],
            row['cent'], row['hf'], row['edge'], row['size'], row['env'], status))
        bad += 1 if fails else 0
    print('-' * len(head))
    print('%d sounds, %d failed, %.0f KiB total   (levels in dBFS; max50 = loudest 50 ms window; cent = spectral '
          'centroid Hz; hf%% = energy above 6 kHz; edge = largest of the first/last 3 samples)' % (len(ids), bad, total))
    return bad


def load_extras():
    """import tools/sfx/sfx_extra*.py so other agents can add sounds without editing this file"""
    sys.modules.setdefault('make_sfx', sys.modules[__name__])
    for path in sorted(glob.glob(os.path.join(HERE, 'sfx_extra*.py'))):
        name = os.path.splitext(os.path.basename(path))[0]
        spec = importlib.util.spec_from_file_location(name, path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)


def main(argv=None):
    ap = argparse.ArgumentParser(description='Synthesize the game sound effects (numpy -> OGG).')
    ap.add_argument('--only', help='comma separated ids')
    ap.add_argument('--group', help='comma separated groups: ' + ','.join(GROUPS))
    ap.add_argument('--report', action='store_true', help='only analyse existing files')
    ap.add_argument('--list', action='store_true', help='list registered ids')
    ap.add_argument('--out', default=OUT_DIR, help='output directory')
    args = ap.parse_args(argv)
    load_extras()
    ids = list(REGISTRY)
    if args.only:
        want = [s.strip() for s in args.only.split(',') if s.strip()]
        unknown = [s for s in want if s not in REGISTRY]
        if unknown:
            ap.error('unknown id(s): ' + ', '.join(unknown))
        ids = want
    if args.group:
        groups = [g.strip() for g in args.group.split(',')]
        ids = [s for s in ids if REGISTRY[s]['group'] in groups]
    if args.list:
        for sid in ids:
            print('%-22s %-6s %s' % (sid, REGISTRY[sid]['group'], REGISTRY[sid]['desc']))
        return 0
    if not args.report:
        for sid in ids:
            render(sid, args.out)
            print('rendered', sid, file=sys.stderr)
    return 1 if report(ids, args.out) else 0


if __name__ == '__main__':
    sys.exit(main())
