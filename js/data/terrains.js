/*
 * terrains.js - every ground type a map may use in its `legend` (TECH_SPEC 4.1).
 *
 * G.DATA.terrains[id] = {
 *   img        image id of the seamless tile block ('ter_*', size a multiple of 96 real px).
 *              null = draws nothing at all, the map backdrop shows through (that is what 'void' is).
 *   passable   false blocks walking (water, walls, void). Default true.
 *   edge       0-9, how "high" this ground sits. Where two different terrains meet, the one with the
 *              HIGHER edge draws the hand-drawn pencil border between them; equal values draw nothing.
 *   edgeColor  pencil color of that border line (a darker shade of the texture reads best).
 *   edgeWidth  optional line width in logical px (default 2.3).
 *   step       sfx id played every other step while walking on it (very quiet), or null for silence.
 * }
 *
 * Ids are referenced by map legends, so keep them stable. The three groups below are the final
 * chapter terrains of DESIGN_BIBLE 10.3 (sheet_ter_shore / sheet_ter_lull / sheet_ter_deep).
 * Edge values are chosen per zone so that the "lower" ground (sand, paper) never draws over the
 * "higher" one (water, rock, walls) and no two grounds that actually meet share a value.
 *
 * The TEST group at the very end goes with the ter_test_* art and is used by the test maps only;
 * it is removed in the final cleanup.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};

  G.DATA.terrains = {
    /* --- the engine's empty tile: nothing is drawn, nothing can walk there --------------------- */
    void: { img: null, passable: false, edge: 0, edgeColor: null, step: null },

    /* --- The Shore (sheet_ter_shore) ----------------------------------------------------------- */
    wet_sand: { img: 'ter_wet_sand', passable: true, edge: 1, edgeColor: '#8d8172', step: 'sfx_step_grass' },
    shingle: { img: 'ter_shingle', passable: true, edge: 2, edgeColor: '#8b8375', step: 'sfx_step_grass' },
    cobbles: { img: 'ter_cobbles', passable: true, edge: 3, edgeColor: '#6f6a61', step: 'sfx_step_stone' },
    floorboards: { img: 'ter_floorboards', passable: true, edge: 3, edgeColor: '#8a5e36', step: 'sfx_step_wood' },
    rock: { img: 'ter_rock', passable: true, edge: 4, edgeColor: '#5f6a72', step: 'sfx_step_stone' },
    grass_verge: { img: 'ter_grass_verge', passable: true, edge: 5, edgeColor: '#6e7d5c', step: 'sfx_step_grass' },
    sea: { img: 'ter_sea', passable: false, edge: 6, edgeColor: '#5d7d8f', step: null },
    cliff: { img: 'ter_cliff', passable: false, edge: 8, edgeColor: '#4a4640', step: null },
    wall_plaster: { img: 'ter_wall_plaster', passable: false, edge: 8, edgeColor: '#9c8f7e', step: null },

    /* --- The Lull: Sorting Shallows, Blare Reef, Slack Water (sheet_ter_lull) ------------------ */
    pale_sand: { img: 'ter_pale_sand', passable: true, edge: 1, edgeColor: '#c9b183', step: 'sfx_step_grass' },
    envelope_paper: { img: 'ter_envelope_paper', passable: true, edge: 2, edgeColor: '#c1ae87', step: 'sfx_step_grass' },
    coral_floor: { img: 'ter_coral_floor', passable: true, edge: 3, edgeColor: '#c98b8b', step: 'sfx_step_grass' },
    ledger_paper: { img: 'ter_ledger_paper', passable: true, edge: 3, edgeColor: '#8fa78a', step: 'sfx_step_grass' },
    stair_stone: { img: 'ter_stair_stone', passable: true, edge: 4, edgeColor: '#8a8270', step: 'sfx_step_stone' },
    shallows: { img: 'ter_shallows', passable: true, edge: 5, edgeColor: '#3f9e95', step: 'sfx_step_water' },
    mirror_water: { img: 'ter_mirror_water', passable: false, edge: 6, edgeColor: '#93a6ae', step: null },
    deep_water: { img: 'ter_deep_water', passable: false, edge: 7, edgeColor: '#2f6d86', step: null },
    reef_rock: { img: 'ter_reef_rock', passable: false, edge: 8, edgeColor: '#a0685f', step: null },

    /* --- The Undertow Light, memory and The Pearl Bed (sheet_ter_deep) ------------------------- *
     * T2 art. Every `img` here has a documented fallback in DESIGN_BIBLE 10.3; swap the img id (the
     * comment on each line) if the sheet is cut, the rest of the entry stays as it is.            */
    fog: { img: 'ter_fog', passable: true, edge: 1, edgeColor: '#b4b9ba', step: null },                          /* fallback ter_pale_sand */
    pearl_floor: { img: 'ter_pearl_floor', passable: true, edge: 2, edgeColor: '#c3b9c2', step: 'sfx_step_stone' }, /* fallback ter_pale_sand */
    lino_check: { img: 'ter_lino_check', passable: true, edge: 3, edgeColor: '#9aa98f', step: 'sfx_step_wood' },  /* fallback ter_floorboards */
    dark_boards: { img: 'ter_dark_boards', passable: true, edge: 3, edgeColor: '#4a3526', step: 'sfx_step_wood' }, /* fallback ter_floorboards */
    spiral_stone: { img: 'ter_spiral_stone', passable: true, edge: 4, edgeColor: '#6e675b', step: 'sfx_step_stone' }, /* fallback ter_stair_stone */
    ink_dark: { img: 'ter_ink_dark', passable: false, edge: 7, edgeColor: '#0e2226', step: null },                /* fallback ter_deep_water */
    nacre_wall: { img: 'ter_nacre_wall', passable: false, edge: 8, edgeColor: '#b79db0', step: null },            /* fallback ter_reef_rock */
    light_wall: { img: 'ter_light_wall', passable: false, edge: 8, edgeColor: '#1d4a50', step: null },            /* fallback ter_reef_rock */

    /* --- TEST GROUP (test maps only, deleted in the final cleanup) ----------------------------- */
    test_grass: { img: 'ter_test_grass', passable: true, edge: 2, edgeColor: '#4a7738', step: 'sfx_step_grass' },
    test_forest_grass: { img: 'ter_test_forest_grass', passable: true, edge: 4, edgeColor: '#2f5a2c', step: 'sfx_step_grass' },
    test_dirt: { img: 'ter_test_dirt', passable: true, edge: 1, edgeColor: '#a67c47', step: 'sfx_step_stone' },
    test_water: { img: 'ter_test_water', passable: false, edge: 5, edgeColor: '#3f86bf', step: 'sfx_step_water' },
    test_cobble: { img: 'ter_test_cobble', passable: true, edge: 3, edgeColor: '#78736c', step: 'sfx_step_stone' },
    test_planks: { img: 'ter_test_planks', passable: true, edge: 2, edgeColor: '#8a5e36', step: 'sfx_step_wood' },
    test_carpet: { img: 'ter_test_carpet', passable: true, edge: 4, edgeColor: '#c08a8a', step: 'sfx_step_wood' },
    test_wall: { img: 'ter_test_checker', passable: false, edge: 6, edgeColor: '#3f8d84', step: null },
    test_starfield: { img: 'ter_test_void', passable: false, edge: 7, edgeColor: '#5b4f8a', step: null },
  };
})();
