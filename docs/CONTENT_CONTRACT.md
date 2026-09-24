# CONTENT CONTRACT — how the story scripters divide and connect their work

Creative source: `DESIGN_BIBLE.md` sections 3–5 and 8. Technical source: `TECH_SPEC.md` section 4 (map format, events,
conditions, commands). This file fixes the **interfaces between map files** so that several writers can work at the
same time without touching each other's files.

## 1. File ownership

| owner | files |
|---|---|
| **shore_a** | `js/data/maps/harbour_row.js`, `js/data/maps/wren_house.js`, `js/data/common_events.js` (chapter flow, see 3), `js/data/system.js` (final start values) |
| **shore_b** | `js/data/maps/brills_chippy.js`, `js/data/maps/shingle_beach.js` (incl. prologue, the slip, epilogue dawn) |
| **lull_1** | `js/data/maps/tide_steps.js`, `js/data/maps/sorting_shallows.js`, `js/data/maps/blare_reef.js` |
| **lull_2** | `js/data/maps/slack_water.js`, `js/data/maps/undertow_light.js`, `js/data/maps/memory_rocks.js` |
| **finale** | `js/data/maps/pearl_bed.js`, `js/data/common_events_finale.js` (ending router etc.), `js/data/endings.js` (real pages), `js/data/confessions.js` |

A writer never edits another writer's file. Common events are added with
`Object.assign(G.DATA.commonEvents, { id: {name, commands}, ... })` so that two files can both contribute.

## 2. Transfers (binding coordinates)

The **trigger tile** holds a touch event (or an action door) in the source map; the **arrival tile** must be passable in
the destination map and must NOT hold a touch event (arrival is always one step away from that map's own exit trigger).

| from map | trigger tile(s) | to map | arrival tile, facing | condition |
|---|---|---|---|---|
| harbour_row | door (8,9) action/touch up | wren_house | (6,15) up | |
| wren_house | (6,16) | harbour_row | (8,10) down | |
| harbour_row | door (30,9) | brills_chippy | (10,11) up | |
| brills_chippy | (10,12) | harbour_row | (30,10) down | |
| harbour_row | east edge (39,10) and (39,11) | shingle_beach | (1,10) / (1,11) right | |
| shingle_beach | west edge (0,10) and (0,11) | harbour_row | (38,10) / (38,11) left | |
| shingle_beach | Tide Steps mouth (20,26) | tide_steps | (12,2) down | `tide` >= 1 and the friends have gathered (shore_b decides the flag; before that the mouth is sea) |
| tide_steps | (12,1) | shingle_beach | (20,25) up | only through the chapter flow (see 3); otherwise a line: "Not yet. The others would worry." |
| tide_steps | west door (2,24) | sorting_shallows | (38,15) left | `tide` >= 1 |
| sorting_shallows | east edge (39,15) | tide_steps | (3,24) right | |
| tide_steps | east door (21,24) | blare_reef | (1,14) right | `tide` >= 2 |
| blare_reef | west edge (0,14) | tide_steps | (20,24) left | |
| tide_steps | south-west door (6,30) | slack_water | (18,1) down | `tide` >= 3 |
| slack_water | north edge (18,0) | tide_steps | (6,29) up | |
| tide_steps | south door (14,30) | undertow_light | (16,3) down | `tide` >= 4 |
| undertow_light | top hatch (16,2) | tide_steps | (14,29) up | |
| undertow_light | bottom hatch (16,27) | memory_rocks (12,15) up before `truth_known`; pearl_bed (16,3) down after | | `string_done` |
| memory_rocks | by script only | undertow_light | (16,26) up | |
| pearl_bed | north (16,2) | undertow_light | (16,26) up | |
| tide_steps | pearl slot (19,30) | pearl_bed | (16,21) up | `pearl_bed_reached` |
| pearl_bed | pearl slot (16,22) | tide_steps | (19,29) up | |
| same-map | wren_house stair (12,4) <-> (18,4); slack_water door ON TIME (30,6) -> (4,24), door LATE (32,6) -> (20,12) | | | see bible 4.2 |

Closed doors in `tide_steps` show a short in-voice line instead of transferring. Map sizes are those of bible 4.2.

## 3. Chapter flow (owned by shore_a in `common_events.js`)

The clock is the var `tide` (0 prologue, 1–5, 6 epilogue). Zone owners never set `tide` themselves; they call:

| common event | who calls it | what it does |
|---|---|---|
| `ce_prologue_done` | shore_b, as the LAST command of the prologue auto event on `shingle_beach` (see section 5) | white fade, clear the tint, `tide` = 1, `prologue_done`, transfer to the `wren_house` wake-up tile; the present-day opening then plays there |
| `ce_go_down` | shore_b's Tide Steps mouth, when the segment's duties are done | fade, recount `segN_kept` for the current tide, autosave, transfer to `tide_steps` (12,2) |
| `ce_tide_done` | the zone owner, as the LAST command of each Tide's climax scene (after the boss / set piece) | fade to black, short "walking home" narration, `healAll`, `tide` += 1, autosave, transfer to the next Shore segment start: `harbour_row` (10,11) facing down for tides 2–4, and the bible's special starts where it says so |
| `ce_say(n)` / `ce_keep(n)` helpers: `ce_said_1` … `ce_said_9`, `ce_kept_1` … `ce_kept_9` | whoever scripts the Say it / Keep it moment n | said: set `skN_said`, `true_words` += 1. kept: set `skN_kept`, `segM_kept` += 1 (M = the Shore segment of moment n per bible 5), show the pebble drop |
| `ce_late_said_1` … `ce_late_said_5` | the zone owner in the `onPeace` branch of `troop_kept_N` | per bible 6.11: `true_words` += `segN_kept`, set the matching `skN_said` flags, `segN_kept` = 0, Wren finally says the Kept line(s) |

Every Say it / Keep it moment uses `['custom','keep_or_say',{say:'text',keep:'text',varName:'k'}]` when that handler exists
(see the header of `js/scenes/custom_ui.js`), otherwise a plain two-option `choice` with cancel on the Keep option.

The finale owner provides `ce_ending_router` (evaluates the three ending conditions of bible 5.8 in the stated order and
runs `['ending', id]`) and everything from Nacre's offer onward.

## 4. Conventions

- Named roaming Unsent `kept_*`: placed by the zone owner with `cond:{var:['segN_kept','>',0]}`, `respawn:true`, battle
  `troop_kept_N` with `onPeace:[['call','ce_late_said_N'], ...]`.
- Ordinary roamers: `respawn:false`, 4–5 per zone as listed in bible 6.13, two of them in optional corners guarding an item.
- Bosses: `['battle', troop, {canEscape:false, bgm:'bgm_boss', onPeace:[..set <boss>_delivered..], onWin:[..set <boss>_hushed..], onLose:'gameover'}]`.
- Save points: rock pool object event with `['custom','rock_pool',{joke:'...'}]`; Wren's bed with `['save']`.
- Every map: `battleback:'bb_<id>'` when the bible's asset list has one for the zone; `bgm`/`ambience` per bible 4.2
  (maps whose music depends on `tide` set it in `onEnter`).
- NPC sprites use only walk sheets that exist in the bible's asset list (`char_pop`, `char_mum`, `char_mr_brill`,
  `char_towns_a`, `char_towns_b`, `char_robin`); creature NPCs are object events.
- Validate constantly: `node tools/test/validate_data.js --map <id>` must report no ERROR for your maps before you finish.

## 5. Shore segments: who scripts what, and the gate

Say it / Keep it moments by segment and owner (bible 5.3–5.7):

| segment (`tide`) | moments | map / owner |
|---|---|---|
| 1 | sk1 Pop · sk2 Odo at the top of the steps | harbour_row / shore_a · shingle_beach / shore_b |
| 2 | sk3 Odo + the sign · sk4 Lin | brills_chippy / shore_b · harbour_row / shore_a |
| 3 | sk5 Pop · sk6 Mum | harbour_row / shore_a · wren_house / shore_a |
| 4 | sk7 Lin · sk8 Robin · then **the slip** | harbour_row / shore_a · shingle_beach / shore_b |
| 5 | sk9 Odo | shingle_beach / shore_b |

`segM_kept` mapping used by `ce_kept_N`: sk1, sk2 -> seg1; sk3, sk4 -> seg2; sk5, sk6 -> seg3; sk7, sk8 -> seg4; sk9 -> seg5.

**The gate** (shore_b, at the Tide Steps mouth where the friends wait). A moment counts as *met* when `skN_said` or
`skN_kept` is set. Going down requires: tide 1: sk1 met (then the sk2 scene plays right there, then `cg_tide_steps`);
tide 2: sk3 and sk4 met; tide 3: sk5 and sk6 met; tide 4: sk7 and sk8 met (then the slip scene plays right there);
tide 5: nothing (the sk9 scene plays right there). When the gate is not satisfied, the waiting friend gives an in-voice
hint naming where to go ("Pop wanted a word first. Over."). The gate scene ends with `['call','ce_go_down']`.

**Party.** On the Shore the party is Wren alone. `ce_go_down` adds `odo`, `lin` and (when `pim_joined`) `pim`;
`ce_tide_done` removes everyone but Wren (they stay in the reserve with their levels). Pim joins mid-Tide-1 through
lull_1's script (`addMember pim`, `pim_joined`).

**Prologue handoff.** `system.js` starts a new game on `shingle_beach` at (20,14) with `tide` = 0. shore_b's prologue
(auto event, page cond `tide == 0`) ends with `['call','ce_prologue_done']` (shore_a): white fade, `tide` = 1,
`prologue_done`, transfer to the wake-up tile, present-day opening in `wren_house`.

**Fixed tiles other writers rely on:** `wren_house` wake-up tile (20,8) facing down, beside the bed (shore_a keeps it
passable and free of touch events); `harbour_row` segment start (10,11) facing down; `pearl_bed` rock-pool resume tile
(14,20) facing up (finale keeps it passable); `shingle_beach` dawn tile (20,24) facing down.

**Epilogue (`tide` = 6).** Shore maps run no auto events at tide 6 and give their NPCs the epilogue lines of bible 5.9.
The finale owner stages the endings from common events (fades, CGs with narration fallbacks, dialogue, transfers to the
fixed tiles above used as backdrops) and then runs `['ending', id]`; it sets `ending_sent_done` / `ending_not_yet_done` /
`ending_pearl_done` (read by the menu's Coat Pocket line) and implements the resume rules of bible 5.8 (Ending B and
Ending C's "came back" resume at the `pearl_bed` rock pool).

## 6. Art that exists right now (the rest arrives later; author against every bible id anyway)

Image generation is rate-limited, so some props/terrains listed in `js/data/objects.js` / `terrains.js` have no image yet:
they are invisible in your screenshots but their collision already works, and the art will appear without any map change.
Already drawn: terrains `cobbles grass_verge shingle wet_sand rock cliff sea floorboards wall_plaster pale_sand shallows
envelope_paper deep_water reef_rock coral_floor ledger_paper mirror_water stair_stone`; every prop of the sheets
`sheet_obj_shore`, `sheet_obj_home`, `sheet_obj_lull_a` (see the groups in `objects.js`); walk sheets `char_wren char_odo
char_lin char_pim char_pop`; enemies `thank_you_card sorry_crab boss_postmaster_gull kept_shrug`.
Use the T1 fallback terrain wherever the bible lists a T2 terrain (bible 4.2 note), so every map looks right today.
