# tools/sfx — sound effect synthesizer

All sound effects and ambience loops of the game are synthesized from scratch with numpy
(`make_sfx.py`) and encoded to OGG Vorbis. There are no samples and no external data; every
render is deterministic (the random generator of a sound is seeded from its id).

Look and feel: soft, toy-like, hand-made, a little lo-fi — pencil ticks, music-box plinks, paper,
soft chiptune blips, felt thumps. The eerie sounds are restrained (low drones, reversed swells,
heartbeat, detuned bells), never harsh.

## Usage

```
python3 tools/sfx/make_sfx.py                   # render everything into assets/audio/sfx, then report (about 45 s)
python3 tools/sfx/make_sfx.py --only id1,id2    # render only these ids
python3 tools/sfx/make_sfx.py --group ui,blip   # groups: ui blip world battle eerie amb
python3 tools/sfx/make_sfx.py --report          # no rendering: decode the OGGs on disk, print the table, exit 1 on failure
python3 tools/sfx/make_sfx.py --list            # ids + one-line descriptions
python3 tools/sfx/make_sfx.py --out DIR         # write somewhere else (for experiments)
node tools/sfx/check_chrome.js [DIR]            # decode every OGG in headless Chrome (the real runtime decoder)
```

Requirements: python3 + numpy, ffmpeg/ffprobe with libvorbis. `check_chrome.js` additionally needs
`tools/test/node_modules/puppeteer-core` and `/usr/bin/google-chrome`.
After adding files run `node tools/build.js` so the manifest picks them up.

## Output format

- `assets/audio/sfx/<id>.ogg`, Vorbis q4, 44.1 kHz. One-shots are **mono**; ambience loops are **stereo**.
- Ambience loops also get a sidecar `assets/audio/sfx/<id>.json` = `{"loop": true, "volume": 0.5}`.
  One-shot effects have no sidecar.
- Levels: loud battle/eerie hits peak around -3..-5 dBFS, normal effects -6..-10, UI ticks / paper / steps
  -10..-16, ambience -10..-16 (and is meant to be played at the sidecar volume 0.5).
- Every one-shot starts and ends at zero (raised-cosine fades), has no DC offset, and its decoded length is
  sample-exact (see "Encoding gotcha").
- Loops are **exactly periodic by construction** (circular FFT filtering, LFOs and sine partials with a whole
  number of cycles, events wrapped around the end), so they loop gaplessly with
  `AudioBufferSourceNode.loop = true`. There is no crossfade region and no loop-point metadata: loop the whole buffer.
  With the `HTMLAudioElement` fallback (`file://`) the browser inserts its own tiny gap; nothing in the file can fix that.
- `sfx_heartbeat` is exactly 1.000 s (two beats, silent edges): loop it for a 60 bpm pulse, raise `rate` for panic.
- Text blips are 42-68 ms and tuned to G3 / E4 / C5 (a C major spread), so different speakers sound consonant.
  They tolerate `rate` 0.8-1.3 for per-character pitch variation.

## Adding a sound

Either add a function to `make_sfx.py`, or (preferred for other agents, no merge conflicts) create a file
`tools/sfx/sfx_extra_<anything>.py`; every file matching `sfx_extra*.py` is imported automatically.

```python
# tools/sfx/sfx_extra_chapter3.py
from make_sfx import *          # sfx, note, mbox, chime, thump, swept_noise, reverb, mixdown, ...

@sfx('sfx_lantern', 'world', peak_db=-9, dur=(0.3, 0.9), fade_out=0.08)
def sfx_lantern(rng):
    """small flame catching, then a glass ting"""        # first docstring line shows up in --list
    d = 0.35
    puff = swept_noise(glide(600.0, 2400.0, d), 1200.0, rng) * swell(d, 0.3, 2.0)
    return reverb(mixdown([(0.0, puff, 0.5), (0.22, mbox(note('E6'), 0.4), 0.8)]), mix=0.15, rt=0.6, tail=0.1)
```

Rules for a sound function: it receives a seeded `numpy.random.Generator` (use only this for randomness),
returns a float array at any level — shape `(n,)` for mono or `(n, 2)` for stereo — and must not apply the
final normalisation itself. `finalize()` then applies the gentle global tone chain (12 dB/oct low-pass at
`lp` Hz + soft `tanh` saturation `drive`), removes DC, fades the edges and normalises to `peak_db`.

`@sfx(id, group, ...)` arguments:

| arg | default | meaning |
|---|---|---|
| `peak_db` | -6 | target peak in dBFS |
| `dur` | (0.05, 3.0) | allowed duration range in seconds; the report fails outside it |
| `loop` | False | seamless loop: circular tone chain, no fades, seam checks, best-rotation encode, sidecar json |
| `stereo` | False | function returns `(n, 2)` |
| `volume` | None | sidecar volume (written for loops, or whenever given) |
| `fade_in`, `fade_out` | 0.002, 0.012 | edge fades in seconds (ignored for loops) |
| `lofi`, `lp`, `drive` | True, 10500, 0.9 | global tone chain; lower `lp` for darker sounds |

A loop function must return a buffer that is periodic over its own length. Use the `circ_*` helpers
(`circ_noise`, `circ_lfo`, `circ_conv`, `circ_add`, `circ_phase`), sine partials at multiples of `1/duration` Hz,
and only memoryless processing; do not use `reverb()` or non-circular filters in a loop.
Keep tonal/bass content nearly in phase between the two channels (mono compatibility).

### Helper catalogue (all in `make_sfx.py`)

- time / pitch: `secs`, `tt`, `note('C#5')`, `glide(f0, f1, dur, 'exp'|'lin'|'ease')`
- oscillators: `osc(freq_or_array, dur, shape='sine'|'tri'|'soft'|'saw')`
- envelopes: `perc`, `adsr`, `swell`, `fade`, `smoothstep`
- mixing: `mixdown([(start_s, samples, gain), ...])`, `fit`, `norm`, `rms`
- filters / fx: `fftfilt(x, lo, hi, order, circular)`, `svf_lp` (time-varying low-pass), `bitcrush`, `wow`,
  `resample`, `reverb(x, mix, rt, damp, tail)` (Schroeder: 6 damped combs + 3 all-passes, applied by FFT convolution)
- noise: `band_noise`, `swept_noise(fc_array, bw, rng)` (heterodyned band noise for whooshes), `smooth_rand`,
  `grain` (paper texture), `crackle`, `click`
- instruments: `modal` (struck objects), `mbox` (music box), `chime` (FM glass), `glint` (sparkle), `xylo`,
  `toyp` (toy piano), `chip` (soft square), `soft_note`, `thump` (felt), `pluck` (Karplus-Strong), `creak`

## Encoding gotcha (important if you encode OGGs elsewhere)

When a whole short sound fits into **one Ogg page**, ffmpeg-based decoders — the ffmpeg CLI *and* Chrome's
`decodeAudioData` — mishandle the granule positions: they drop the last 128 samples or append about 20 ms of
padding. `encode_ogg()` therefore passes `-page_duration 1` (one packet per page) for one-shots and
`-page_duration 100000` for loops. With that, decoded lengths are sample-exact in both ffmpeg and Chrome,
which is what makes the loops seamless.

For loops `encode_loop()` additionally encodes 14 circular rotations of the (periodic) buffer, decodes each and
keeps the one whose wrap-around seam is cleanest, because the codec does not know that the file wraps.

## Verification

`--report` decodes every OGG again and prints one row per sound: duration, channels, peak, RMS, `max50`
(loudest 50 ms window, a rough loudness figure for balancing), DC offset, spectral centroid, share of energy above
6 kHz (harshness guard), level of the first/last samples, file size and a 16-cell ASCII level envelope.
It fails a sound when: the file is missing or does not decode, codec/sample rate/channel count are wrong, ffprobe and
decoded durations differ, the duration is outside the registered range (text blips must be under 80 ms), the peak is
above -0.9 dBFS or more than 1.5 dB off target, it is (nearly) silent, DC exceeds 0.003 or 5 % of RMS, the end is not
silent, or the start is not silent without being masked by an attack within 10 ms.
Loops are checked at the wrap-around instead of the edges: `step` (|x[0]-x[n-1]| / local RMS sample step, max 4),
`kink` (second difference across the seam / local RMS, max 4), `click` (high-frequency energy of a 5.8 ms frame on the
seam vs. the 99th percentile of all frames, max 0 dB) and `level` (50 ms RMS jump across the seam vs. the largest
ordinary jump).

`check_chrome.js` repeats the essential checks (decodes, exact length, channels, peak, seam step/kink) with the decoder
the game really uses.

## Sound list (base set)

| group | ids |
|---|---|
| ui | `sfx_cursor` `sfx_confirm` `sfx_cancel` `sfx_error` `sfx_menu_open` `sfx_menu_close` `sfx_page` `sfx_save` `sfx_item_get` `sfx_key_item` `sfx_level_up` `sfx_coin` |
| blip | `sfx_blip_low` (G3) `sfx_blip_mid` (E4) `sfx_blip_high` (C5) `sfx_blip_narrator` (noise tick) `sfx_blip_odd` (detuned, lightly crushed) |
| world | `sfx_step_grass` `sfx_step_wood` `sfx_step_stone` `sfx_step_water` `sfx_door_open` `sfx_door_close` `sfx_door_locked` `sfx_chest_open` `sfx_switch` `sfx_push` `sfx_jump` `sfx_fall` `sfx_splash` `sfx_bell` `sfx_knock` `sfx_emote` `sfx_transfer` |
| battle | `sfx_encounter` `sfx_attack_swing` `sfx_hit_soft` `sfx_hit_hard` `sfx_hit_crit` `sfx_miss` `sfx_guard` `sfx_enemy_down` `sfx_ally_down` `sfx_heal` `sfx_buff` `sfx_debuff` `sfx_escape` `sfx_victory_sting` `sfx_skill_cast` `sfx_feel_up` `sfx_feel_down` `sfx_feel_shift` `sfx_combo` `sfx_talk_success` `sfx_peace` |
| eerie | `sfx_heartbeat` `sfx_static` `sfx_glitch` `sfx_whisper` `sfx_drone_hit` `sfx_reverse_swell` `sfx_music_box_broken` `sfx_tear` `sfx_scribble` `sfx_erase` |
| amb (stereo loops + sidecar) | `amb_rain` (10 s) `amb_wind` (12 s) `amb_night_crickets` (10 s) `amb_room_hum` (10 s) `amb_void` (12 s) |

Musical keys, so jingles do not clash with each other: save = F major, item get = C, key item = D, level up = D,
victory sting = F, heal = Cmaj9, peace = A major, ally down = A minor, encounter = whole-tone run, void pad = D minor.
