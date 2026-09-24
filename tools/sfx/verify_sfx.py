#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_sfx.py - independent QA of the rendered sound effects (does NOT import make_sfx.py).

It decodes every OGG in assets/audio/sfx with ffmpeg and measures, with its own numpy code:
  dur     decoded duration (s)                      ch      channels
  peak    sample peak (dBFS)                        rms     RMS over the whole file (dBFS)
  LAF     loudness figure: A-weighted level with the 125 ms "fast" time weighting of a sound level meter,
          maximum over the file (dB re full scale).  Unlike peak or RMS it accounts for the ear's short-term
          integration, so a 40 ms tick reads much quieter than a 300 ms hit with the same peak.
  dc      |mean| of the samples
  lead    silence before the sound starts (ms, first sample above -50 dB relative to the file's peak)
  trail   silence after the sound ends (ms)
  x0 / xN magnitude of the very first / last sample (dBFS)  -> start / end clicks
  cent    spectral centroid (Hz)                    >6k / >10k   share of energy above 6 / 10 kHz (%)
  seam    loops (amb_*, sfx_heartbeat): wrap-around check, see seam_check()

and applies the balance rules of the project:
  - nothing peaks above -3.0 dBFS
  - text blips and UI ticks are at least 8 dB (LAF) below the quietest battle hit; steps are below the blips
  - harshness: centroid > 6 kHz with RMS > -30 dBFS, or > 10 % of the energy above 10 kHz
  - one-shots start and end silent (no clicks), lead-in silence < 15 ms (latency), DC < 0.002
  - blips shorter than 80 ms

Usage:   python3 tools/sfx/verify_sfx.py [DIR] [--spectro OUTDIR]      exit code 1 on any failure
         --spectro writes one spectrogram PNG per sound (ffmpeg showspectrumpic) for eyeballing.
"""
import json
import os
import subprocess
import sys

import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DIR = os.path.abspath(os.path.join(HERE, '..', '..', 'assets', 'audio', 'sfx'))

# ids whose loudness is compared (see rules above)
TICKS = ['sfx_cursor', 'sfx_blip_low', 'sfx_blip_mid', 'sfx_blip_high', 'sfx_blip_narrator', 'sfx_blip_odd']
STEPS = ['sfx_step_grass', 'sfx_step_wood', 'sfx_step_stone', 'sfx_step_water']
HITS = ['sfx_hit_soft', 'sfx_hit_hard', 'sfx_hit_crit']
PEAK_CEILING_DB = -3.0


def db(v):
    return 20.0 * np.log10(max(float(v), 1e-12))


def decode(path):
    probe = json.loads(subprocess.check_output(
        ['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', path]))['streams'][0]
    ch = int(probe['channels'])
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-acodec', 'pcm_f32le', '-'])
    x = np.frombuffer(raw, dtype='<f4').astype(np.float64).reshape(-1, ch)
    return x, probe


def a_weight(x):
    """A-weighting applied in the frequency domain (IEC 61672 magnitude, zero phase)."""
    n = len(x)
    f = np.fft.rfftfreq(n, 1.0 / SR)
    f2 = f * f
    ra = (12194.0 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * np.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194.0 ** 2) + 1e-30)
    return np.fft.irfft(np.fft.rfft(x) * ra * 10.0 ** (2.0 / 20.0), n)


def laf_max(x):
    """max of the 125 ms exponentially time-weighted A-weighted level, dB re full scale"""
    pad = np.concatenate([x, np.zeros(SR // 2)])
    p = a_weight(pad) ** 2
    tau = 0.125
    k = np.exp(-np.arange(int(SR * 1.0)) / (tau * SR))
    k /= k.sum()
    n = len(p) + len(k)
    sm = np.fft.irfft(np.fft.rfft(p, n) * np.fft.rfft(k, n), n)[:len(p)]
    return 10.0 * np.log10(max(float(sm.max()), 1e-24))


def seam_check(v):
    """Independent loop test on one channel: play the file three times in a row and compare the broadband
    'novelty' (short-time spectral flux above 2 kHz, 128-sample hop) at the two seams with the distribution of
    the same measure everywhere else.  Returns (flux percentile of the worse seam, sample step at the wrap in
    multiples of the median absolute sample step)."""
    n = len(v)
    tri = np.concatenate([v, v, v])
    hop, size = 128, 512
    win = np.hanning(size)
    idx = np.arange(0, len(tri) - size, hop)
    frames = np.lib.stride_tricks.sliding_window_view(tri, size)[::hop] * win
    mag = np.abs(np.fft.rfft(frames, axis=1))
    band = np.fft.rfftfreq(size, 1.0 / SR) > 2000.0
    flux = np.sum(np.maximum(np.diff(np.log1p(200.0 * mag[:, band]), axis=0), 0.0), axis=1)
    centre = idx[1:] + size // 2
    worst = 0.0
    for s in (n, 2 * n):
        near = np.abs(centre - s) <= size // 2
        far = np.abs(((centre - s + n // 2) % n) - n // 2) > size
        worst = max(worst, float(np.mean(flux[far] < flux[near].max())) * 100.0)
    d = np.abs(np.diff(v))
    step = abs(v[0] - v[-1]) / (np.median(d) + 1e-12)
    return worst, step


def analyse(path):
    x, probe = decode(path)
    n, ch = x.shape
    mono = x.mean(axis=1)
    peak = float(np.max(np.abs(x)))
    mag = np.max(np.abs(x), axis=1)
    thr = peak * 10.0 ** (-50.0 / 20.0)
    above = np.nonzero(mag > thr)[0]
    spec = np.abs(np.fft.rfft(mono)) ** 2
    f = np.fft.rfftfreq(n, 1.0 / SR)
    tot = spec.sum() + 1e-30
    return dict(
        x=x, n=n, ch=ch, sr=int(probe['sample_rate']), codec=probe.get('codec_name'),
        dur=n / SR, peak=db(peak), rms=db(np.sqrt(np.mean(x ** 2))), laf=max(laf_max(x[:, c]) for c in range(ch)),
        dc=float(np.max(np.abs(x.mean(axis=0)))),
        lead=above[0] / SR * 1000.0, trail=(n - 1 - above[-1]) / SR * 1000.0,
        x0=db(mag[0]), xn=db(mag[-1]), first8=db(mag[:8].max()), last8=db(mag[-8:].max()),
        onset10=db(mag[:int(0.010 * SR)].max()),
        cent=float((f * spec).sum() / tot), hf6=float(spec[f > 6000.0].sum() / tot * 100.0),
        hf10=float(spec[f > 10000.0].sum() / tot * 100.0))


def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    folder = os.path.abspath(args[0]) if args else DEFAULT_DIR
    spectro = None
    if '--spectro' in argv:
        spectro = os.path.abspath(argv[argv.index('--spectro') + 1])
        folder = os.path.abspath(args[0]) if len(args) > 1 else DEFAULT_DIR
        os.makedirs(spectro, exist_ok=True)
    files = sorted(fn for fn in os.listdir(folder) if fn.endswith('.ogg'))
    rows = {}
    problems = []
    print('%-22s %6s %2s %6s %6s %6s %8s %5s %6s %5s %5s %6s %5s %5s  %s' % (
        'id', 'dur', 'ch', 'peak', 'rms', 'LAF', 'dc', 'lead', 'trail', 'x0', 'xN', 'cent', '>6k', '>10k', 'notes'))
    for fn in files:
        sid = fn[:-4]
        r = analyse(os.path.join(folder, fn))
        rows[sid] = r
        notes = []
        side = os.path.join(folder, sid + '.json')
        is_loop = os.path.isfile(side) and json.load(open(side)).get('loop') is True
        if r['codec'] != 'vorbis' or r['sr'] != SR:
            notes.append('FORMAT %s/%d' % (r['codec'], r['sr']))
        if r['ch'] != (2 if is_loop else 1):
            notes.append('CHANNELS %d' % r['ch'])
        if r['peak'] > PEAK_CEILING_DB + 0.05:
            notes.append('PEAK above %.0f dBFS' % PEAK_CEILING_DB)
        if r['dc'] > 0.002:
            notes.append('DC')
        if (r['cent'] > 6000.0 and r['rms'] > -30.0) or r['hf10'] > 10.0:
            notes.append('HARSH')
        if sid.startswith('sfx_blip_') and r['dur'] >= 0.080:
            notes.append('BLIP too long')
        if is_loop or sid == 'sfx_heartbeat':
            pct, step = max(seam_check(r['x'][:, c]) for c in range(r['ch']))
            tag = 'seam: flux pct %.1f, step %.1fx' % (pct, step)
            if pct > 99.9 and is_loop:
                tag = 'SEAM audible? ' + tag
            notes.append(tag)
        if not is_loop:
            # a click = an abrupt first/last sample.  Codec pre-echo before a percussive attack is accepted
            # when the attack inside the first 10 ms is more than 18 dB louder.
            if r['xn'] > -60.0 and r['xn'] > r['peak'] - 40.0:
                notes.append('END CLICK')
            if r['x0'] > -60.0 and r['x0'] > r['onset10'] - 18.0:
                notes.append('START CLICK')
            if r['lead'] > 15.0 and sid != 'sfx_heartbeat':
                notes.append('LATENCY %.0f ms lead-in' % r['lead'])
        bad = [s for s in notes if s[:1].isupper() and s.split(' ')[0].isupper()]
        if bad:
            problems.append('%s: %s' % (sid, ', '.join(bad)))
        print('%-22s %6.3f %2d %6.1f %6.1f %6.1f %8.5f %5.1f %6.1f %5.0f %5.0f %6.0f %5.1f %5.1f  %s' % (
            sid, r['dur'], r['ch'], r['peak'], r['rms'], r['laf'], r['dc'], r['lead'], r['trail'], r['x0'], r['xn'],
            r['cent'], r['hf6'], r['hf10'], '; '.join(notes)))
        if spectro:
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(folder, fn), '-lavfi',
                            'showspectrumpic=s=640x320:legend=1:scale=log:fscale=lin:stop=12000',
                            os.path.join(spectro, sid + '.png')], check=False)

    # ---- relative loudness rules -------------------------------------------------------------------
    have = lambda ids: [s for s in ids if s in rows]  # noqa: E731
    if have(HITS) and have(TICKS):
        quiet_hit = min(rows[s]['laf'] for s in have(HITS))
        print('\nloudness ladder (LAF, dB):')
        for label, ids in (('battle hits', HITS), ('blips / cursor', TICKS), ('steps', STEPS)):
            print('  %-15s %s' % (label, '  '.join('%s %.1f' % (s.replace('sfx_', ''), rows[s]['laf']) for s in have(ids))))
        for s in have(TICKS):
            if rows[s]['laf'] > quiet_hit - 8.0:
                problems.append('%s: only %.1f dB below the quietest battle hit (need 8)' % (s, quiet_hit - rows[s]['laf']))
        blip_floor = min(rows[s]['laf'] for s in have(TICKS))
        for s in have(STEPS):
            if rows[s]['laf'] > blip_floor:
                problems.append('%s: step louder than the quietest blip (%.1f > %.1f)' % (s, rows[s]['laf'], blip_floor))
    print()
    if problems:
        print('%d PROBLEM(S):' % len(problems))
        for p in problems:
            print('  - ' + p)
        return 1
    print('%d files verified, no problems' % len(files))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
