# Low Tide Letters

A small, hand-drawn JRPG about a fishing town that is going quiet, and the things nobody said.

Wren Ashby is twelve. The sea has gone out further than it is supposed to, a staircase that should not
exist has appeared at the bottom of the beach, and under it is the Lull: a bright crayon seabed where every
unsent message in Pellow's Reach washes up alive and upset. With Odo (radio procedure, life vest, fry scoop),
Lin (clipboard, tide table, a very long plait) and Pim (a letter with legs who does not know who he is for),
Wren goes down five times over one weekend. Battles are turn-based: feelings are pieces of sea-glass in your
pocket, kept alone they cut, and handed to a friend down the tin-can line they come back smooth. You can
quiet an Unsent by force or deliver it by finding what it needed saying with. Nobody dies. There are three
endings, and the one you get depends on what Wren says out loud.

About an hour of play. Content note: grief, guilt, growing up, and the ordinary unkindness of children;
handled with care, no violence beyond paper creatures crumpling.

## How to play

**In the browser:** play it at **https://m1omg.github.io/Low-Tide-Letters/** (nothing to install; saves stay in your browser).

**Easiest offline:** double-click `index.html`. The game runs straight from the file in any modern browser
(Chrome, Firefox, Edge, Safari).

**Better (gapless music loops):** run `./start.sh` on Linux/macOS or `start.bat` on Windows. It starts a tiny
local server (`node serve.js`, needs Node.js) and opens the game at `http://localhost:8765`.

Saves live in your browser's local storage (three slots, saved at rock pools in the Lull and at Wren's bed).

### Controls

Default keys (every one except Esc can be changed in **Options → Controls**; the choice is saved in the browser):

| key | action |
|---|---|
| Arrow keys / WASD | walk |
| Z / Enter / Space | talk, confirm |
| X / Esc / Backspace | cancel, open the pause menu on the map (Esc always works, whatever else is bound) |
| Shift (hold) | run |
| C (in battle) | Confide: hand a piece of glass to a friend down the Can Line |
| Left / Right (in a skill list) | flip a skill between Plain and Out Loud |

**Mouse and touch:** hovering a menu moves the cursor and clicking an option picks that option; on the map and in
dialogue a click is Confirm (talk, advance). **Right-click on the map walks Wren to that spot** (hold Shift to run);
right-click a person or a thing and she walks up and talks to it. The middle button is the X key (pause menu on the
map, back in menus); in menus right-click cancels too, and the mouse wheel steps through lists. An on-screen
pad (d-pad, A, B, run, C) appears automatically on touch screens, or click the ☰ button in the top-right corner
to show it for the mouse. It stays on until you switch it off again.

## Project layout

```
index.html, serve.js, start.sh, start.bat     the game and its launcher
js/core/     engine core (input, assets, audio, text, UI, save state, scenes)
js/map/      maps, characters, events and the event-command interpreter
js/battle/   the sea-glass battle system (pure rules in battle_logic.js, HUD in battle_ui.js)
js/scenes/   title, menu, save, shop, ending, game-over, custom puzzle UIs
js/data/     all content: actors, skills, items, enemies, troops, speakers, endings, confessions,
             common_events*.js (chapter flow) and maps/<map>.js (one file per location)
assets/      images, music (ogg), sound effects (ogg), fonts
docs/        DESIGN_BIBLE.md (story, rules, asset list), TECH_SPEC.md (engine contract),
             CONTENT_CONTRACT.md (how the map files connect)
tools/       art pipeline, music composer, sfx synth, tests
```

Maps and events are plain data (see `docs/TECH_SPEC.md` section 4); `js/data/maps/test_map.js` and
`test_room.js` are development fixtures used by the engine self-tests and are unreachable in play.

## Making more of it

- **Art** was generated with the Codex CLI image tool from the prompts in `tools/art/prompts/` and cut into
  sprites by the scripts in `tools/art/` (see `tools/art/README.md`). Some planned images may still be
  missing (they show as small labelled placeholders in the game). To generate the rest, with the Codex CLI
  logged in, run from the project root:
  ```
  python3 tools/art/gen_batch.py tools/art/batches/02_t1.json --workers 3
  python3 tools/art/gen_batch.py tools/art/batches/03_t2.json --workers 3
  python3 tools/art/gen_batch.py tools/art/batches/04_t3.json --workers 3
  sh tools/art/batches/process_all.sh
  ```
  Finished images are skipped, so the batches can be re-run at any time.
- **Music** is composed as MIDI in `tools/music/tracks/*.py` and rendered with fluidsynth and the FluidR3 GM
  soundfont (`tools/music/README.md` is the composer's guide). Sound effects are synthesised by
  `tools/sfx/make_sfx.py`.
- **Tests:** `sh tools/test/run_all.sh` builds, validates every data file (`validate_data.js`), runs the
  engine self-tests and the smoke test (loads every map headlessly). The chapter drives in
  `tools/test/story/` play each part of the story with the test hooks and check the flags.
  `node tools/test/dump_script.js --map <id>` prints a map's dialogue as a screenplay for proofreading.

## Credits and licences

Concept and direction: Michal, with Claude (Anthropic). Writing, code and design: Claude, with Michal.
Art generated with the Codex image tool. Music rendered with the FluidR3 GM soundfont (MIT licence).
Fonts: Patrick Hand and Gochi Hand, under the SIL Open Font License (licence texts in `assets/fonts/`).
Everything else in this repository was written for this game and is released under the GNU GPL v3 (see `LICENSE`).
