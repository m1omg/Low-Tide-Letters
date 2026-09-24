# shore_a progress

## Done
- `js/data/system.js` - final start values (Low Tide Letters, Stamps, shingle_beach 20,14 down, tide 0).
- `js/data/common_events.js` - full chapter flow: ce_prologue_done, ce_go_down, ce_tide_done,
  ce_shore_time, ce_shore_time_indoor, ce_recount_kept, ce_said_1..9, ce_kept_1..9, ce_late_said_1..5,
  plus the kept `test_signature`.
- `js/data/maps/wren_house.js` - 24x18, geometry + all events + the present-day opening + sk6.
- `js/data/maps/harbour_row.js` - 40x20, geometry + all events + sk1/sk4/sk5/sk7/sk8 + 5.9 schedule.
- validate_data: zero ERRORs for both of my maps (remaining errors belong to unwritten maps of others).

## Next
- smoke + one screenshot per map, then tools/test/story/shore_a_path.js (critical path drive).
