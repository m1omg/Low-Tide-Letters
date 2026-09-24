# Composer's guide — `tools/music/`

Everything you need to write a track for this game. You write **one Python file per track** in
`tools/music/tracks/<id>.py`; `render.py` turns it into MIDI, renders it through FluidR3, wraps the
loop seamlessly, applies the lo-fi chain, normalises to −16 LUFS and writes
`assets/audio/bgm/<id>.ogg` + `<id>.json`.

```
python3 tools/music/render.py tools/music/tracks/<id>.py     # render + full check report
python3 tools/music/render.py --all --changed --jobs 3       # rebuild everything stale
python3 tools/music/analyze.py assets/audio/bgm/<id>.ogg --expect-key "F major"
python3 tools/music/probe.py 10 89 --velocity 0 24           # "listen" to GM programs by numbers
python3 tools/music/tracks/<id>.py                           # print summary() + lint() without rendering
```

`tools/music/tracks/test_pipeline.py` is a working 16-bar example that uses nearly every helper.
Read it once; do not copy it wholesale — write real music.

---

## 1. Anatomy of a track file

```python
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from midilib import Song, Scale, Pattern, chord, voice_led, bass_note   # noqa: E402

META = {
    "id": "town_theme",      # MUST equal the file name
    "loop": True,            # False -> one-shot (fanfare, game over); no seam check, fade-out tail
    "lofi": 0.5,             # 0..1 lo-fi chain: low-pass, wow/flutter, saturation, tape hiss
    "gain_db": 0.0,          # -12..+6 offset applied before normalisation (leave 0 unless a cue must sit low)
    "tail_beats": 8,         # extra beats rendered so reverb/release tails wrap around the loop
    "key": "F major",        # checked against the automatic key estimate
    "lead": "musicbox",      # name of the melody track: warns if it is buried in the mix
}

def build():
    song = Song(bpm=84, time_sig=(4, 4), seed=20260921, title="town_theme")
    song.set_loop_bars(32)
    ...
    return song

if __name__ == "__main__":
    s = build()
    print(s.summary())
    for w in s.lint():
        print("lint:", w)
```

Other `META` keys: `volume` (manifest volume, default 0.8), `space` (extra hall wash 0..1, default
0.2), `noise` (tape hiss 0..1, default = `lofi`), `crackle` (vinyl crackle 0..1, default 0),
`reverb` / `chorus` (dicts overriding fluidsynth effects, e.g. `{"room-size": 0.85, "level": 1.0}`),
`seed`.

Always keep the `__main__` block: `lint()` catches register, velocity, density and loop-length
mistakes in under a second, before you pay for a render.

---

## 2. Pitches, scales, chords

```python
pitch("C4") == 60          note_name(60) == "C4"          pitch_class("Bb") == 10
scale("D", "dorian", octave=4, octaves=2)      # list of MIDI pitches
```

`Scale(root, mode)` — modes: `major/ionian, dorian, phrygian, lydian, mixolydian, minor/aeolian,
locrian, harmonic_minor, melodic_minor, major_pentatonic, minor_pentatonic, blues, whole_tone,
chromatic, octatonic_wh, octatonic_hw, hirajoshi, in_sen, hungarian_minor, phrygian_dominant,
lydian_dominant`.

```python
s = Scale("A", "minor")
s.degree(3, octave=4)        # 72  (1-based; degree 8 = octave, 0 = step below the root)
s.degree(5, octave=4, alter=-1)
s.chord(5, size=4)           # diatonic seventh on degree 5 -> pitches
s.snap(61); s.step(64, +2); s.contains(60); s.pitches("C3", "C6")
```

`chord(sym, octave=4, inversion=0, voicing="close", bass=None)` → ascending MIDI pitches.
Symbols understood: `C Cm C- Cdim Caug C+ C5 C6 Cm6 C69 C7 Cmaj7 CM7 Cm7 CmMaj7 Cdim7 Cm7b5 C9
Cmaj9 Cm9 C11 Cm11 C13 Cadd9 Cmadd9 Csus2 Csus4 C7sus4 C7b9 C7#9 C7#5 Cmaj7#11 C7b13 Cno3` and
slash chords `F/A`, `Dm7/G`.
Voicings: `close`, `open` (every second note up an octave — warm piano/pad), `drop2`, `shell`
(root+3rd+7th), `rootless`, `spread` (root down an octave).
`bass=True` always adds a bass note, `False` never, `None` only for slash chords.

```python
bass_note("Dm7/G", 2)                    # the G below
voice_led(["Fmaj7","Am7","Bbmaj7","C7sus4"], lo="C3", hi="G4")   # whole progression, minimal motion
voice_lead(prev_pitches, "Gm7", lo=52, hi=84)                    # one chord at a time
fretted("Am7", tuning=GUITAR, max_fret=5)  # real playable shape; also UKULELE (re-entrant)
chord_pcs("Bbm6"); parse_chord("F/A")
```

---

## 3. `Pattern` — the melody mini-language

One string, tokens separated by spaces, `|` is a bar line that is **verified** against the song's
bar grid (miscounted rhythms fail loudly instead of drifting).

```
E5:1        note, 1 beat                 E5            reuse the previous duration
E5:1:96     explicit velocity            r:1  R:1  _:1 rest
-:1         tie: extend the previous note by 1 beat
C4+E4+G4:2  simultaneous notes           @Am7:2        chord symbol (octave from play())
E5:1!       accent (+18 vel)             E5:1*         staccato (half length)
1:1 3:.5 b7:1 5,:2 1':2                  SCALE DEGREES: accidentals in front, ' = octave up, , = down
```

Durations: numbers (`1`, `.5`, `0.75`), fractions (`1/3`), or letters `w h q e s t` (whole … 32nd)
with `.` dotted and `t` triplet — `q.` = 1.5, `et` = 1/3, `qt` = 2/3.

Patterns are immutable; every transformation returns a new one — this is your motif workshop:

```python
m = Pattern("C5:1 D5:.5 E5:.5 G5:2 | A5:1 G5:1 E5:2")
m.transpose(-3)         m.shift(+2, scale=key)     # chromatic / diatonic
m.augment(2.0)          m.augment(0.5)             # twice as slow / fast
m.reverse()             m.invert(axis="E5")        # retrograde / melodic inversion
m.slice(0, 4)           m.repeat(2)   m + other
m.with_length(8)        m.scale_velocity(0.8)
m.check_bars(4, at=0.0)                            # called for you by play()
```

---

## 4. Tracks

```python
t = song.track("lead", "music_box", volume=108, pan=0.12, reverb=88, chorus=10, vel=84)
```
`program`: GM number or name (`"music_box"`, `"nylon_guitar"`, `"warm_pad"` …). `volume` = CC7
0..127, `pan` −1..1, `reverb`/`chorus` = CC91/CC93 sends, `vel` = default velocity. Channels are
assigned automatically (10 reserved for drums).

**Notes and chords**
```python
t.note("A4", start=0.0, dur=1.5, vel=70)
t.chord("Fmaj7", 0.0, 4.0, vel=66, octave=4, voicing="open", top_accent=6, roll_ms=22)
t.play(pattern_or_string, at=0.0, vel=None, transpose=0, repeat=1, gate=1.0, ring=0.0,
       scale=key, octave=4, accent=18)      # returns the beat where it ends
```
`gate` shortens every note (1.0 legato, 0.5 staccato); `ring` **adds** sustain beats — essential for
music box, harp, kalimba, vibes and guitar, where the sample must decay naturally. `scale` +
`octave` are required for degree patterns.

**Arpeggios and strums**
```python
t.arp("Am7", start, length=2.0, step=0.5, order="up", octaves=1, ring=1.0,
      octave=3, accent=8)                  # order: up|down|updown|downup|random|[0,2,1,3]
t.strum("C7sus4", start, dur=2.0, direction="down", spread_ms=38,
        instrument="guitar", octave=3, strings=4)     # instrument: None | "ukulele" | "guitar"
t.strum_pattern("Gm7", start, "D-du", step=0.5, repeats=1, spread_ms=16, instrument="guitar")
```
Strum pattern characters, one per `step`: `D`/`U` strong down/up, `d`/`u` soft, `x` muted chuck,
`-`/`.` let it ring.

**Controllers and expression**
```python
t.cc(74, 60, at=0.0)                 t.program_change(48, at=song.bar(16))
t.pedal(down_at, up_at)              t.pedal_every(0, song.loop_length_beats, every=2.0, lift=0.12)
t.expression(start, end, 40, 100)    # CC11 ramp — the real crescendo for strings/pads/choir
t.bend_range(2); t.bend(at, -1.0); t.bend_ramp(start, end, -1.0, 0.0)
t.vibrato(at, 40)                    # mod wheel CC1
t.crescendo(a, b, 0.85, 1.1)         t.diminuendo(a, b, 1.0, 0.75)
t.velocity_ramp(a, b, 0.7, 1.0, mode="scale")        # or mode="set" for absolute velocities
```
CC11 (`expression`) changes the loudness of a *held* note; velocity only affects the attack. Use
`expression` for strings/choir/pads, `crescendo`/`diminuendo` for plucked and struck sounds.
**In a loop, bring every CC ramp back to its starting value before the loop end.**

**Editing**
```python
t.copy_range(song.bar(0), song.bar(8), song.bar(16), transpose=0, vel_scale=0.9)   # A -> A''
t.clear_range(song.bar(15) + 2, song.bar(16))
t.swing(0.58, grid=0.5, start=None, end=None)     # call BEFORE humanize
t.humanize(timing_ms=9, velocity=6, seed=0)
t.end_beat()
```

**Drums** (`song.drums(name, kit=...)`, kits: `standard room power electronic tr808 jazz brush
orchestra`)
```python
d = song.drums("kit", kit="brush", volume=112, reverb=45, vel=80)
d.hit("triangle", song.bar(8), vel=58, dur=1.0)
d.pattern("chh", "x.x.x.x.", start=0.0, step=0.25, repeats=4, accent=22, ghost=-32)
d.grid({"kick": ("x.........x.....", 70),
        "brush_tap": ("....x..o....x..o", 92),
        "chh": "x.x.x.x.x.x.x.x."}, start=song.bar(4), step=0.25, repeats=4)
```
Step characters: `x` hit, `X` accent, `o` ghost, `.`/`-` rest; spaces and `|` are ignored.
Names: `kick kick2 snare snare2 rim sidestick clap brush_tap brush_slap brush_swirl chh phh ohh
ride ride_bell ride2 crash crash2 splash china tom_lo tom_mid_lo tom_mid_hi tom_hi tom_floor_lo
tom_floor_hi tambourine cowbell shaker cabasa maracas claves woodblock_hi woodblock_lo triangle
triangle_mute jingle_bell bell_tree castanets agogo_hi agogo_lo bongo_hi bongo_lo conga_hi
conga_lo conga_mute guiro_short guiro_long vibraslap`.

**Song level**
```python
song.bar(n)                 # beat where 0-based bar n starts
song.beats_per_bar          song.bpm        song.loop_length_beats     song.loop_seconds
song.set_loop_bars(32)      song.marker("B", song.bar(16))
song.tempo(88, at=0.0)      song.tempo_ramp(start, end, 84, 79)        song.tempo_at(beat)
song.beats_to_seconds(b)    song.ms_to_beats(120)     song.rng("salt")
song.swing(0.56, grid=0.5)  song.humanize(timing_ms=9, velocity=6, drums_timing_ms=4)
song.summary()              song.lint()
song.save(path, repeats=1, tail_beats=0, solo=["lead"])   # stem render for debugging
```
`loop_length_beats` defaults to the last note rounded up to a bar — **always set it explicitly**
with `set_loop_bars()` so the loop point is where you intend, not where a ringing note happened to
end.

Order of operations at the end of `build()`: write all notes → `swing()` → `humanize()` →
`tempo_ramp()`. Swing after humanize would quantise the human jitter away.

---

## 5. The palette (FluidR3_GM, measured with `probe.py`)

Target sound: lo-fi bedroom-pop JRPG. Soft mallets and boxes carry melody, piano/guitar carry
harmony, one warm bass, pads for air. `lvl` below is the measured K-weighted loudness of a held
note at velocity 80 — it is how much CC7 compensation a program needs, **not** its musical weight.

| # | name | good register | notes from the probe |
|---|---|---|---|
| 10 | `music_box` | C5–C7 (lint C4–C7) | the signature lead. Decays fast (`sus` −30 dB), so always `ring=0.5..1.0`. Bright (centroid 2–4 kHz); above C6 it thins out. |
| 8 | `celesta` | C4–C6 | softer, rounder music box; 0.8 s release. Doubles the box an octave down beautifully. |
| 9 | `glockenspiel` | C4–C6 | hard, glassy, long ring (1.2–1.7 s). Use sparingly — 2–4 notes per phrase as punctuation, vel 45–65. |
| 11 | `vibraphone` | F3–F5 | warm, mid-register; loses level fast above C5. Great for a lazy counter-melody or block chords, vel 55–75. |
| 0 | `acoustic_grand_piano` | A1–C6, best C3–C5 | the workhorse. Stereo-spread (L/R correlation goes negative above C4) — keep the *bass* of the piano below C4 or it smears on mono speakers. |
| 4 | `electric_piano_1` | C2–C6, best C3–C5 | Rhodes-ish, long sustain, perfectly mono. The bedroom-pop chord bed; vel 50–70 stays mellow, above 90 it barks. |
| 24 | `nylon_guitar` | E2–C6, best E2–C5 | arpeggios and soft strums. Below C3 it sustains, above C4 it decays quickly. |
| 25 | `steel_guitar` | E2–C5 | much longer ring (2–3 s in the low register) — it will wash over a loop seam; keep it above E2 and thin. |
| 32 | `acoustic_bass` | E1–G3 | upright. Very short release (0.05 s): clean, no mud. Default bass choice. |
| 33 | `fingered_bass` | E1–C4 | rounder, more modern; use for slightly more pop-leaning cues. |
| 48 | `strings` | C2–C7, best C3–C5 | fast attack, 0.8 s release. **Negative L/R correlation at C2/C3/C5** — thin on mono; double with a pad or keep them above C3. |
| 49 | `slow_strings` | C2–C7 | slow swell, 2 s release, `sus` +20 dB (grows while held). The pad-like string. Same mono caveat. |
| 52 | `choir_aahs` | C2–C6, best C4–C5 | breathy, grows while held. Long notes only; never fast passages. |
| 53 | `voice_oohs` | C4–C6 | closer, more "human". Weak below C4 (−38 LUFS at C1). Doubles a melody an octave below at vel 50–60 for a nostalgic halo. |
| 73 | `flute` | C4–C6 | very quiet below C3, and loud/shrill at C7. Sweet spot C4–C5, vel 60–80, with `vibrato(at, 30..50)` on long notes. |
| 79 | `ocarina` | C3–C6 | flat level across the whole range and perfectly mono — the most reliable wind lead. Pure, slightly naive; ideal for a child/memory motif. |
| 80 | `square_lead` | C3–C6 | chiptune nostalgia. Constant level; mono-ish in the low register only. vel 55–75, `gate=0.9`. |
| 81 | `saw_lead` | C3–C5 | brighter and more aggressive; for tense or mechanical cues. Keep reverb low. |
| 82 | `calliope` | C3–C6 | soft breathy synth flute, 0.7 s release. A gentle pad-lead hybrid. |
| 89 | `warm_pad` | A2–C6, best C3–C5 | the default pad: swells (+30 dB while held), 1 s release. Collapses below C3 (−44 LUFS at C1) — do **not** use it as a bass. |
| 94 | `halo_pad` | C3–C6 | huge 2.6–2.9 s release and very bright above C5. Beautiful for dream/memory cues; in a loop its tail needs `tail_beats: 12`+. |
| 108 | `kalimba` | C4–C6 | very quiet (−36..−42 LUFS): give it `volume=118` and vel 80–95, or it disappears. Plucky, 1.5 s ring. Lovely doubling the music box. |

Also useful: `46 harp` (glissandi via `arp(..., order="up", octaves=2)`), `12 marimba`,
`88 new_age_pad`, `91 choir_pad`, `95 sweep_pad`, `14 tubular_bells`, `98 fx_crystal`. Rules of thumb:
- Keep every part inside `RANGE_HINTS` unless you mean it; `lint()` tells you when you left.
- Melody C5–C6, counter-melody C4–C5, chords C3–C4, bass E1–G2. Two parts in the same octave fight.
- Velocity 45–85 is the musical range for this soundtrack. FluidR3 turns harsh above ~105, and
  `lint()` warns at mean > 112. Whisper cues: 30–50. Never flat velocities — even ±4 helps.
- Never more than ~40 notes sounding at once (`lint()` warns); 6–14 is plenty and stays clear.

---

## 6. Mixing

There is no mixer: **CC7 (`volume=`), velocity, register and reverb are the mix.**

Starting levels that work: lead 104–112, chords/piano 92–102, guitar 88–96, bass 96–104, pads
72–86, drums 104–114. Then read the *mix balance* table `render.py` prints — it solos every track
and reports gated loudness while it plays, relative to the loudest:

```
musicbox   +0.0 LU    piano  -4.9 LU    guitar  -2.9 LU    bass  -6.3 LU    brushes  -8.0 LU
```
Aim for: melody 0 LU (loudest), harmony −3 to −6 LU, bass −5 to −8 LU, drums −6 to −10 LU, pads
−8 to −14 LU. If the `lead` track is not near the top, `render.py` warns. Fix balance with CC7
first, velocity second; never with `gain_db` (that is a whole-track offset applied before
normalisation and only shifts the final limiter's work).

Reverb (CC91) is depth, not polish: bass 10–25, drums 35–50, guitar/piano 50–70, lead 70–95, pads
80–110. Something must stay dry or the track loses its floor — that is the bass's job.
Chorus (CC93) 0–20 only, on electric piano and pads; more makes FluidR3 seasick.
Pan: bass and kick near centre (−0.1..0.1), lead slightly off-centre, guitar/keys ±0.2..0.4.
Stereo correlation in the report should stay 0.5–0.9; below 0.3 the track will partly cancel on a
phone speaker (usually `strings` 48/49 too low — move them up or double them).

`lofi` 0.3–0.5 for warm bedroom cues, 0.6–0.8 for memory/tape-flashback cues, 0.15–0.25 when the
cue must stay legible (battle, ambient tension). `space` 0.15–0.3 normally, 0.4–0.6 for caves and
dream sequences. `crackle` 0.2–0.4 only for a deliberate vinyl cue.

---

## 7. Making the loop feel seamless

The renderer plays the loop body **twice** and cuts the second pass, so reverb and release tails
from the end wrap into the beginning automatically. That solves the *acoustic* seam. You still have
to solve the *musical* one:

1. `song.set_loop_bars(N)` explicitly, and make sure your last `play()` really ends there
   (`assert t == song.loop_length_beats` is a cheap guard).
2. The last bar must **lead back**, not conclude: a dominant or `sus4` chord, an open fifth, an
   unresolved melodic note, or a two-note pickup on beat 4 that lands on bar 1's downbeat.
3. Give the loop end roughly the same **density and level** as the loop start. A big diminuendo
   into the seam makes the restart sound like a cut, even with a perfect waveform. Keep
   `level end/start` within ~6 dB if you want the loop to be unnoticeable; the demo track
   deliberately ends −10 dB down because it also ritards, and you can hear the restart.
4. Return every controller (CC11, CC1, pitch bend, sustain pedal) to its bar-1 value before the end.
5. Let notes ring past the loop end — `tail_beats` (8 is the default, 12–16 for `halo_pad`, big
   reverb or a final chord) renders that tail and folds it back in. `lint()` warns if something
   rings more than 4 bars past the end.
6. `tempo_ramp` back to the starting tempo before the loop point if you used one.
7. Do **not** fade out. `loop: True` tracks are cut, not faded.

---

## 8. Structuring a 60–100 s loop

At 4/4, 32 bars ≈ 91 s at 84 bpm, ≈ 77 s at 100 bpm, ≈ 64 s at 120 bpm. 24 bars at 80 bpm ≈ 72 s.
Pick tempo and bar count from that, then use **A A′ B A″**:

| section | bars | job |
|---|---|---|
| A | 0–7 | state the motif; thin — melody + one accompaniment + bass |
| A′ | 8–15 | same melody, *changed*: added counter-line, thicker voicing, one borrowed chord, drums enter |
| B | 16–23 | contrast: new harmonic area (relative minor, IV, or a modal shift), new rhythm, melody built from a *fragment* of the motif, not a new tune |
| A″ | 24–31 | return; fullest texture for 4 bars, then **subtract** — let instruments drop out over the last 2 bars so the loop point is not a wall of sound |

Rules that make it feel composed rather than generated:

- **Instruments enter and leave.** Nobody plays all 32 bars except the harmony bed. Write down who
  is playing in each 8-bar block before you write notes. Drums entering at bar 8 and dropping out
  for bars 16–19 does more for the form than any amount of harmony.
- **A real melody.** Build a 2-bar motif, then: bars 0–1 motif, 2–3 answer (motif transposed or
  inverted), 4–5 motif varied, 6–7 cadence. That is `Pattern` + `.shift()` + `.invert()` +
  `.augment()`, not four unrelated phrases. The melody should have one clear high point, once, in
  A″ or late B.
- **Bass moves.** Roots on every downbeat is a placeholder, not a bass line. Use: a fifth or third
  as a pickup on beat 4, a passing tone between two chord roots, a pedal point held for 4 bars under
  a changing harmony in B, an inversion (`F/A`, `Dm7/G`) to make a stepwise bass. One slide
  (`bend_ramp`) per track is enough.
- **Harmony must go somewhere.** Two-chord vamps for 32 bars are the failure mode. Give each 8-bar
  section its own cadence, and change one chord in A′ (a borrowed `iv`, `bVII`, `bVI`, or a
  secondary dominant) so the ear notices the repeat is not a copy.
- **Rhythmic layers at different rates**: bass in half notes, chords in quarters, arpeggio in
  eighths, music box in a mixed rhythm. Do not put everything on the same grid.

```python
box.play(motif, at=song.bar(0), ring=0.8)
box.play(motif.shift(+2, scale=key), at=song.bar(2), ring=0.8)      # answer
box.play(motif.augment(2.0).slice(0, 4), at=song.bar(16), ring=1.2) # B: fragment, slowed
gtr.copy_range(song.bar(0), song.bar(8), song.bar(24), vel_scale=0.9)
```

---

## 9. Restating a leitmotif in another mood

Keep the **interval shape**; change the frame. Pick two or three of these per restatement, never all:

- **Mode**: same degrees, new scale. `motif` written in degrees plays under `Scale("D","minor")`,
  `Scale("D","dorian")` (wistful), `Scale("D","phrygian")` (dread), `Scale("D","lydian")` (wonder).
  Degree patterns make this a one-line change: `box.play(motif, at=0, scale=Scale("D","dorian"), octave=5)`.
- **Tempo & register**: the town theme at 84 bpm on music box C5–C6 → at 58 bpm on `voice_oohs`
  C3–C4 is grief; at 132 bpm on `square_lead` is panic.
- **Augmentation / diminution**: `.augment(2.0)` makes a tune into a hymn or a memory; `.augment(0.5)`
  makes it nervous.
- **Reharmonisation**: same melody notes, new chords underneath. A melodic `A` over `Fmaj7` (3rd)
  → over `Dm9` (5th) → over `Bbmaj7#11` (7th) → over `F#m7b5` (unstable). Change the bass note alone
  (`F/A` → `F/Ab`) and the whole colour turns.
- **Fragmentation**: use only the first three notes, repeated and sequenced downward, with silence
  between. This is how you write a *threat* version of a warm theme.
- **Inversion / retrograde**: `.invert(axis="A4")` for an uncanny mirror of a familiar tune.
- **Timbre & articulation**: `ring=1.2, gate=1.0` (sung) vs `gate=0.45, vel 40` (hesitant, played on
  one finger) vs `arp()` of the motif's notes (it dissolves into the background).

Keep one anchor constant — usually the first interval or the rhythm — or listeners will not connect
the versions.

---

## 10. Uneasy / dark ambient cues

- Remove the pulse: no drums, no regular arpeggio. Place events at irregular beats
  (`song.rng("cue")` for reproducible spacing), long rests, 2–6 notes per bar.
- Slow tempo (48–68 bpm) with long `tail_beats` (12–16) and `space` 0.4–0.6.
- Harmony: static pedal in the bass while upper voices shift; `sus2`/`sus4`/`add9`/`m7b5`/`dim7`,
  quartal stacks (`chord(..., voicing="rootless")` on an 11th chord), or a bare tritone. Avoid
  clean triads — they resolve, and resolution is comfort.
- Scales: `octatonic_hw`, `whole_tone`, `phrygian`, `in_sen`, `hungarian_minor`, `locrian`.
- Registers: put the pad low (`halo_pad` C3, `warm_pad` C3) and one thin high line far above
  (`glockenspiel` C6, `music_box` C6, vel 35–50) with a large gap between them. The gap is the fear.
- Detuning: `bend_range(2)` then `bend(at, -0.12)` on a sustained pad makes a slow beating against
  the other voices. Very effective, very cheap. Keep it under ±0.25 semitones or it reads as broken.
- `vibrato(at, 70)` on `slow_strings` or `choir_aahs`; `expression()` swells that rise and fall
  without ever arriving.
- `lofi` 0.2–0.35 with `noise` 0.5 and `crackle` 0.15: hiss with almost no music is unsettling.
- Keep it quiet: mean velocity 35–55, `gain_db` 0, and let the −16 LUFS normalisation do the rest;
  the cue will still sit under dialogue because its crest factor is high.

Example skeleton:

```python
pad  = song.track("pad",  "halo_pad",    volume=78, pan=-0.2, reverb=104, vel=48)
low  = song.track("drone","warm_pad",    volume=84, pan=0.0,  reverb=90,  vel=44)
bell = song.track("bell", "glockenspiel",volume=96, pan=0.35, reverb=110, vel=42)
low.note("D2", 0, 64, vel=44)                              # pedal under everything
for i, sym in enumerate(["Dm(add9)", "Dm7b5", "Ebmaj7#11", "Dm7b5"]):
    pad.chord(sym, i * 16, 16.0, voicing="rootless", octave=4, vel=46)
    pad.expression(i * 16, i * 16 + 8, 45, 95); pad.expression(i * 16 + 8, i * 16 + 16, 95, 45)
r = song.rng("bells")
for b in sorted(r.sample(range(4, 60), 9)):
    bell.note(r.choice([84, 86, 89, 91]), b + r.random() * 0.4, 2.0, vel=r.randint(34, 50))
```

---

## 11. Verifying

`render.py` prints the full report and exits non-zero on failure; `analyze.py` re-checks any
existing file. What the numbers should look like for an accepted track:

| field | expected | fails when |
|---|---|---|
| `duration` | your intended `loop_seconds()` | off by more than a few ms → loop length wrong |
| `peak` / true peak | −1.6 … −2.8 dBFS, **0 clipped samples** | true peak > −0.9 dBTP |
| `loudness` | −16.00 LUFS integrated (forced), RMS −17 … −20 dBFS, crest 12–17 dB | crest < 8 = squashed, > 20 = too sparse |
| `dc offset` | < 0.0005 | > 0.002 |
| `silence ratio` | 0 % for music | > 35 % |
| `stereo corr` | 0.5 … 0.9 | < 0.3 → mono cancellation |
| `loop seam` | jump < 0.03, **jump ratio < 2.5**, **click ratio < 2.0**, tail continuation > 0.35 | verdict `WARN` or `BAD` |
| `level end/start` | within ~6 dB of each other | not enforced, but audible |
| `key estimate` | top candidate matches `META["key"]` | mismatch → warning (relative/parallel keys are confused easily) |

Reference numbers from the demo: `jump 0.0216 (−33.3 dB), jump ratio 0.32, click ratio 0.70,
tail continuation 0.691` → `OK — seam is clean`. Ratios are the seam's discontinuity *relative to
the discontinuities inside the music*, so a value below 1 means the seam is smoother than a normal
sample-to-sample transition in the track.

Useful when something sounds wrong:
```bash
python3 tools/music/analyze.py assets/audio/bgm/<id>.ogg --png /tmp/x.png   # waveform+spectrogram+seam
python3 tools/music/analyze.py assets/audio/bgm/<id>.ogg --json
python3 tools/music/render.py tools/music/tracks/<id>.py --no-lofi --keep   # dry render + WAVs kept
python3 tools/music/probe.py --velocity 0 10 24        # how a program responds to velocity
python3 tools/music/probe.py --drums brush             # relative level of every drum in a kit
```
For a stem render, call `song.save("/tmp/x.mid", repeats=1, tail_beats=8, solo=["lead"])`.

Checklist before you call a track done: `lint()` silent → render exits 0 → seam verdict `OK` → the
`lead` track is at the top of the mix balance table → key estimate matches → the form is really
A A′ B A″ with instruments entering and leaving, not 32 bars of the same texture.
