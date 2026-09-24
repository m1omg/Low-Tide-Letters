# tools/test — the automated QA pass

Four things live here. Run them from the project root.

| command | what it does | needs a browser |
|---|---|---|
| `node tools/test/validate_data.js` | static check of every data file: maps, events, commands, battle data | no (fast, ~1 s) |
| `node tools/test/smoke.js` | boots the real game, visits every map, fights every troop | yes (headless Chrome) |
| `node tools/test/core_selftest.js`, `map_selftest.js`, … | engine self-tests written by the engine agents | yes |
| `tools/test/run_all.sh` | build + validate + every `*_selftest.js` + smoke, with a summary | yes |

All of them exit `0` when everything is fine and `1` when something is wrong, so they can be chained.

---

## validate_data.js — the one the story scripters use all day

```
node tools/test/validate_data.js                 check everything
node tools/test/validate_data.js --map wren_house    check only that map
node tools/test/validate_data.js --quiet         errors only (good for a git hook / a loop)
```

It never opens a browser. Every `js/data/**/*.js` file is executed in a Node `vm` sandbox with a fake
`window`/`G`, so the files register themselves exactly as they do in the game, and then everything is
cross-checked. Files that do not exist yet (`items.js`, `troops.js`, …) are skipped with a note instead
of crashing — several people write this game at the same time.

### Reading the output

```
ERROR test_map/mailbox_letter p0 #2: unknown item "brass_key" (js/data/items.js)
WARN  harbour_row: legend entry "x" (sand) is never used in the ground
```

* **`ERROR`** — the game will misbehave (crash, dead end, unreachable content). The exit code becomes 1.
  Fix these before you commit.
* **`WARN`** — probably fine *for now*: art or music that has not been produced yet, a flag nobody reads
  yet, a troop nobody fights yet. Worth a glance before the game is finished, not worth stopping for.

The bit before the colon tells you exactly where to look:

| shape | meaning |
|---|---|
| `harbour_row` | the map file itself (`js/data/maps/harbour_row.js`) |
| `harbour_row object #3` | the 4th entry of that map's `objects` array |
| `harbour_row/pop p1 #7` | map `harbour_row`, event `pop`, page index 1, command index 7 |
| `harbour_row/pop p1 #7 then #0` | …inside the `then` branch of that `if`; also `else`, `branch 2`, `onWin`, … |
| `commonEvents/skim_line #2` | a command in `js/data/common_events.js` |
| `skills/cannonball`, `enemies/echo`, `troops/troop_gull`, `items/…`, `actors/…`, `endings/…`, `speakers/…` | a battle/data table entry |
| `system`, `flags`, `vars` | `js/data/system.js` and the game-wide flag/variable audit |

Command indexes count from 0 and include `['label', …]` commands, so `#7` is literally `commands[7]`.

### What it checks

**Maps** — `width`/`height` sane (and at least 16x12); `ground` has exactly `height` rows of exactly
`width` characters; every ground character has a `legend` entry; every legend entry names a real terrain
(and unused legend entries are warned about); object ids exist and sit inside the map; `overrides.block`
/ `.open` inside the map; `start` is a passable tile; `bgm`/`ambience`/`battleback`/`tint` sane.

**Events** — unique ids; inside the map; two events on the same tile (ERROR when both are solid,
otherwise WARN); page `cond` well formed (TECH_SPEC 4.3 keys, `{var:[k,op,n]}` operators); sprite specs
(`{char}`, `{obj}`, `{enemy}`); trigger in `action|touch|auto|parallel`; `move.type` in
`still|wander|patrol|chase|flee` with in-bounds patrol routes; the roaming-enemy sugar (`enemy:{troop,…}`)
is expanded the way `entities.js` expands it.

**Commands** — every command name exists in `js/map/interpreter.js`, with the right number of arguments,
recursively through `choice` branches, `if` then/else and `battle` `onWin`/`onPeace`/`onLose`/`onEscape`/
`onTimeout`. Plus, per command: speakers and their portrait expressions, item / actor / troop / ending /
common-event / skill ids, emotes, directions, move-route steps, `goto` targets (and duplicate or unused
labels), `custom` command names, and every image and sound id.

**Transfers and reachability** — a `transfer` must name a registered map, land inside it and land on a
passable tile. Then, per map, a BFS over the real collision grid (terrain passability + solid object
footprints + `overrides` + events that are solid on every page) starts from *every arrival point*
(`G.DATA.system.startMap`, the map's own `start`, and every `transfer` anywhere in the game that lands
here) and must be able to walk to every `action`/`touch` event and every transfer event. Standing on the
tile *or* on a neighbouring tile counts, because you can talk to (and bump into) a solid event from
beside it. If a target is only reachable when a solid event gets out of the way, that is a WARN, not an
ERROR. A map nothing transfers into and that has no `start` is reported as "no arrival point" and its
reachability is not checked — that usually means you forgot the door.

**Flags and variables** — the whole game at once: a flag or variable that is *read* (in a condition,
in `{v:name}` markup, in an actor's skill unlock) but never *set* anywhere is a WARN, and so is one that
is set but never read. Typos in flag names show up here, so scan this block after writing a chapter.

**Battle data** (TECH_SPEC "Battle addendum") — when `actors.js` / `skills.js` / `items.js` /
`enemies.js` / `troops.js` / the endings table exist: stat blocks, growth, `expTable` monotonic, skill
`target`/`type`/`cost` vocabularies, item `kind`, enemy `lines` colours and `from`/`sayer` actors, drops,
troop members, `rules` keys, and that every `['ending','id']` names a real ending.

**Assets** — every image and sound id is looked up in `js/data/manifest.js` (run `node tools/build.js`
first). A missing image or sound is a **warning**, never an error: art and music are still being made.

### Two conventions worth knowing

* Ids containing `test` (`test_map`, `test_letter`, `troop_test`) belong to the engine's own test content.
  An unknown `test…` id is downgraded to a warning, so the old engine test maps do not block the real game.
* A reference into a data file that does not exist yet is a warning, not an error, and the run continues.

---

## smoke.js

```
node tools/test/smoke.js                  every map + one battle per troop
node tools/test/smoke.js --maps a,b       only those maps
node tools/test/smoke.js --no-battles     skip the battle pass
node tools/test/smoke.js --no-build       do not re-run tools/build.js first
```

Launches `/usr/bin/google-chrome` headless through `puppeteer-core`, serves the game over
`http://localhost` with `serve.js`, then:

1. `__game.skipText = true` and `__game.newGame()`.
2. For every registered map: `__game.teleport` to a tile the player can actually stand on (the map's
   `start` when it has one), wait for the map to settle, screenshot it to
   `tools/test/shots/smoke_<map>.png`, and walk six seeded "random" runs of held input so movement,
   collision, followers, touch events and parallel events all get exercised. The seed is fixed, so two
   runs do the same thing.
3. For every troop: `__game.startBattle(troop)` then `__game.battleAuto('smart')`, and the outcome must
   be one of `peace|win|lose|escape|timeout`. If no `'battle'` scene is registered yet, the whole pass is
   skipped with a line saying so — that is not a failure.
4. Anything in `__game.errors()` (which also collects `G.warn`/`G.error`), plus page errors, failed
   requests and HTTP >= 400, fails the run.

Look at the screenshots in `tools/test/shots/` when a map looks wrong: they are the quickest way to see a
missing terrain texture or an object standing in the sea.

---

## run_all.sh

```
tools/test/run_all.sh               build, validate, all *_selftest.js, smoke
tools/test/run_all.sh --quick       build + validate only (no browser, a few seconds)
tools/test/run_all.sh --no-build    leave js/data/manifest.js alone
tools/test/run_all.sh --no-battles  pass --no-battles on to smoke.js
```

It runs every step even when an earlier one fails, and prints a `PASS` / `FAIL` summary at the end.
`--quick` is the one to run while writing story data; the full run is for before you hand work over.
