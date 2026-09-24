/*
 * objects.js - static props that maps place with { obj:'<id>', x, y } (TECH_SPEC 4.1).
 *
 * G.DATA.objects[id] = {
 *   img      image id ('obj_*'). The picture is drawn with its BOTTOM CENTER on the bottom center of the
 *            base tile (x*48+24+ox, y*48+48+oy), at manifest size / 2 (logical px). A prop wider than one
 *            tile therefore overhangs its neighbours to the left and right, which is what the art expects.
 *   fp       footprint in TILES relative to the base tile: [dx,dy,w,h] or a list of such rectangles.
 *            Default [0,0,1,1]. These tiles are blocked while `solid` is true.
 *   solid    true blocks the footprint (default false).
 *   layer    'below' (flat decals, drawn right after the ground) | 'sort' (default, y-sorted with
 *            characters) | 'above' (always drawn over everyone: canopies, hanging lamps).
 *   ox, oy   pixel nudge of the picture (logical px), does not move the footprint.
 *   counter  true = the player may talk THROUGH this tile to the event behind it (shop counters, tables).
 *   sortBias optional tweak of the y-sort key in logical px (rarely needed).
 *   anim     reserved for animated props ('bob' = the gentle 2 px idle bob of the creature NPCs).
 * }
 *
 * EVEN-WIDTH RULE: a prop whose art is 2 or 4 tiles wide is centred between two tiles, so it carries
 * `ox: 24` (half a tile) to line the picture up with its footprint, which starts on the base tile.
 * Odd widths (1 and 3 tiles) are already centred on the base tile and use ox: 0.
 *
 * The groups below are the final props of DESIGN_BIBLE 10.3, one group per prop sheet. Ids whose art
 * has not been generated yet are listed all the same (the engine simply draws nothing for them).
 * The TEST group at the very end goes with the obj_test_* art and is deleted in the final cleanup.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};

  G.DATA.objects = {
    /* --- sheet_obj_shore: Harbour Row and the beach ------------------------------------------- */
    house_terrace: { img: 'obj_house_terrace', fp: [-1, -1, 4, 2], solid: true, layer: 'sort', ox: 24, oy: 0, anim: null },
    house_tolet: { img: 'obj_house_tolet', fp: [-1, -1, 4, 2], solid: true, layer: 'sort', ox: 24, oy: 0, anim: null },
    chippy_front: { img: 'obj_chippy_front', fp: [-1, -1, 4, 2], solid: true, layer: 'sort', ox: 24, oy: 0, anim: null },
    postbox: { img: 'obj_postbox', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    lobster_pots: { img: 'obj_lobster_pots', fp: [0, 0, 2, 1], solid: true, layer: 'sort', ox: 24, oy: 0, anim: null },
    bench: { img: 'obj_bench', fp: [0, 0, 2, 1], solid: true, layer: 'sort', ox: 24, oy: 0, anim: null },
    groyne: { img: 'obj_groyne', fp: [-1, 0, 3, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    boat_upturned: { img: 'obj_boat_upturned', fp: [-1, 0, 3, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    lighthouse: { img: 'obj_lighthouse', fp: [-1, -1, 3, 2], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },

    /* --- sheet_obj_home: the Ashby house and Brill's Chippy ----------------------------------- */
    bed: { img: 'obj_bed', fp: [0, -1, 2, 2], solid: true, layer: 'sort', ox: 24, oy: 0, anim: null },
    table: { img: 'obj_table', fp: [0, 0, 2, 1], solid: true, layer: 'sort', ox: 24, oy: 0, counter: true, anim: null },
    kitchen_counter: { img: 'obj_kitchen_counter', fp: [-1, 0, 3, 1], solid: true, layer: 'sort', ox: 0, oy: 0, counter: true, anim: null },
    coat_hook: { img: 'obj_coat_hook', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    bookshelf: { img: 'obj_bookshelf', fp: [0, 0, 2, 1], solid: true, layer: 'sort', ox: 24, oy: 0, anim: null },
    chippy_counter: { img: 'obj_chippy_counter', fp: [-1, 0, 3, 1], solid: true, layer: 'sort', ox: 0, oy: 0, counter: true, anim: null },
    fryer: { img: 'obj_fryer', fp: [0, 0, 2, 1], solid: true, layer: 'sort', ox: 24, oy: 0, anim: null },
    sign_closing: { img: 'obj_sign_closing', fp: [0, 0, 2, 1], solid: false, layer: 'below', ox: 24, oy: 0, anim: null },
    window_can: { img: 'obj_window_can', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },

    /* --- sheet_obj_lull_a: Sorting Shallows --------------------------------------------------- */
    rock_pool: { img: 'obj_rock_pool', fp: [0, 0, 2, 1], solid: true, layer: 'sort', ox: 24, oy: 0, counter: true, anim: null },
    pigeonhole_cliff: { img: 'obj_pigeonhole_cliff', fp: [-1, -1, 3, 2], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    pigeonhole_bin: { img: 'obj_pigeonhole_bin', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    mail_sack: { img: 'obj_mail_sack', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    stamp_flower: { img: 'obj_stamp_flower', fp: [0, 0, 1, 1], solid: false, layer: 'sort', ox: 0, oy: 0, anim: null },
    postbox_shelley: { img: 'obj_postbox_shelley', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, counter: true, anim: null },
    mail_slot_door: { img: 'obj_mail_slot_door', fp: [0, 0, 2, 1], solid: true, layer: 'sort', ox: 24, oy: 0, anim: null },
    letter_pile: { img: 'obj_letter_pile', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    can_post: { img: 'obj_can_post', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },

    /* --- sheet_obj_lull_b: Blare Reef, Slack Water and the stair down ------------------------- */
    horn_coral_big: { img: 'obj_horn_coral_big', fp: [-1, 0, 3, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    horn_coral_small: { img: 'obj_horn_coral_small', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    horn_pipe: { img: 'obj_horn_pipe', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    sunk_clock: { img: 'obj_sunk_clock', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    intray_stack: { img: 'obj_intray_stack', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    ironing_board: { img: 'obj_ironing_board', fp: [0, 0, 2, 1], solid: true, layer: 'sort', ox: 24, oy: 0, anim: null },
    vending_machine: { img: 'obj_vending_machine', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    washing_line: { img: 'obj_washing_line', fp: [[-1, 0, 1, 1], [1, 0, 1, 1]], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    stair_hatch: { img: 'obj_stair_hatch', fp: [0, 0, 2, 1], solid: false, layer: 'below', ox: 24, oy: 0, anim: null },
    stairs_wood: { img: 'obj_stairs_wood', fp: [0, 0, 2, 1], solid: false, layer: 'below', ox: 24, oy: 0, anim: null },  /* house staircase, built by tools/art/make_stairs.py */

    /* --- sheet_obj_lull_c: The Undertow Light, The Pearl Bed, hub creatures (T2) --------------- */
    lamp_lens: { img: 'obj_lamp_lens', fp: [-1, -1, 3, 2], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    radio_valve: { img: 'obj_radio_valve', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    pearl_big: { img: 'obj_pearl_big', fp: [0, 0, 2, 1], solid: true, layer: 'sort', ox: 24, oy: 0, anim: null },
    pearl_small: { img: 'obj_pearl_small', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    pearl_heap: { img: 'obj_pearl_big', fp: [-1, 0, 3, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    // the prologue's four shining pieces of sea-glass (drawn from the glass icons, bobbing so they catch the eye)
    glass_red: { img: 'icon_glass_red', fp: [0, 0, 1, 1], solid: false, layer: 'sort', ox: 0, oy: -6, anim: 'bob' },
    glass_blue: { img: 'icon_glass_blue', fp: [0, 0, 1, 1], solid: false, layer: 'sort', ox: 0, oy: -6, anim: 'bob' },
    glass_amber: { img: 'icon_glass_amber', fp: [0, 0, 1, 1], solid: false, layer: 'sort', ox: 0, oy: -6, anim: 'bob' },
    glass_green: { img: 'icon_glass_green', fp: [0, 0, 1, 1], solid: false, layer: 'sort', ox: 0, oy: -6, anim: 'bob' },
    bedroom_door: { img: 'obj_bedroom_door', fp: [0, 0, 2, 1], solid: true, layer: 'sort', ox: 24, oy: 0, anim: null },
    bench_lull: { img: 'obj_bench_lull', fp: [0, 0, 2, 1], solid: true, layer: 'sort', ox: 24, oy: 0, anim: null },
    snail_stan: { img: 'obj_snail_stan', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: 'bob' },
    gull_picket: { img: 'obj_gull_picket', fp: [0, 0, 2, 1], solid: true, layer: 'sort', ox: 24, oy: 0, anim: 'bob' },

    /* --- sheet_obj_shore_b: extra Shore dressing (T3) ----------------------------------------- */
    washing_line_town: { img: 'obj_washing_line_town', fp: [[-1, 0, 1, 1], [1, 0, 1, 1]], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    streetlamp: { img: 'obj_streetlamp', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    crates: { img: 'obj_crates', fp: [0, 0, 2, 1], solid: true, layer: 'sort', ox: 24, oy: 0, anim: null },
    rowboat: { img: 'obj_rowboat', fp: [-1, 0, 3, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    boulder: { img: 'obj_boulder', fp: [0, 0, 2, 1], solid: true, layer: 'sort', ox: 24, oy: 0, anim: null },
    rock_pool_small: { img: 'obj_rock_pool_small', fp: [0, 0, 1, 1], solid: false, layer: 'below', ox: 0, oy: 0, anim: null },
    jam_jar: { img: 'obj_jam_jar', fp: [0, 0, 1, 1], solid: false, layer: 'sort', ox: 0, oy: 0, anim: null },
    biscuit_tin: { img: 'obj_biscuit_tin', fp: [0, 0, 1, 1], solid: false, layer: 'sort', ox: 0, oy: 0, anim: null },
    radio_bench: { img: 'obj_radio_bench', fp: [0, 0, 2, 1], solid: true, layer: 'sort', ox: 24, oy: 0, counter: true, anim: null },

    /* --- TEST GROUP (test maps only, deleted in the final cleanup) ----------------------------- */
    test_tree_round: { img: 'obj_test_tree_round', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    test_pine: { img: 'obj_test_pine', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    test_bush_pink: { img: 'obj_test_bush_pink', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    test_bench: { img: 'obj_test_bench', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    test_picnic_table: { img: 'obj_test_picnic_table', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, counter: true, anim: null },
    test_lamp_post: { img: 'obj_test_lamp_post', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    test_mailbox: { img: 'obj_test_mailbox', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    test_signpost: { img: 'obj_test_signpost', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
    test_boulder: { img: 'obj_test_boulder', fp: [0, 0, 1, 1], solid: true, layer: 'sort', ox: 0, oy: 0, anim: null },
  };
})();
