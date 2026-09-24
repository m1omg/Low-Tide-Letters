# lull_2 progress

Owner of `js/data/maps/slack_water.js`, `js/data/maps/undertow_light.js`, `js/data/maps/memory_rocks.js`.

## Done
- **slack_water** (36x28) — geometry, props, all events written and validating with 0 ERRORs.
  - onEnter intro (Pim's "and anyway" count), rock pool save (21,3), compliment vending machine (27,5)
    with the 1-Stamp + Odo thump gag -> `doing_fine_token`.
  - Four Clocks puzzle (8.3): clock events at (20,8) (23,8) (26,8) (29,8), vars `clock_1..4`,
    common events `ce_sw_clocks` / `ce_sw_clock_after` (defined in the map file).
  - ON TIME door (30,6) -> loops to (4,24), `sw_loops` counts the loop gags.
  - LATE door (32,6) -> `late_door_open`, transfers into the inner flat (20,12).
  - Secret bench 2 at (2,11) (narration fallback, no `cg_lin_asleep`), `bench_2`.
  - Boss `troop_fine` at (24,13)/(27,13), both outcomes, then Lin's line, `lin_told`,
    the third slip, `['call','ce_tide_done']`.
  - `kept_later` (troop_kept_3 / ce_late_said_3) at (24,19); 5 ordinary roamers; 6 inspection props;
    2 hidden item caches; Stan at (32,17).

## Next
1. `undertow_light` (32x30) — three round rooms, String Line puzzle (8.4), `kept_ask_her`.
2. `memory_rocks` (24x18) — the memory, `troop_three_words`, `truth_known`, `pim_knows`.
3. `tools/test/story/lull_2_path.js` critical-path puppeteer drive.
