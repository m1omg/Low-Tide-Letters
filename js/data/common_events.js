/*
 * common_events.js - command lists that any map can run with ['call','<id>'] (TECH_SPEC 4.4).
 *
 * G.DATA.commonEvents[id] = { name: 'human readable', commands: [ ...commands... ] }
 * (a bare array works too). They run inside the caller's context, so ['setSelf',...] still refers to the
 * event that called them.
 *
 * ===================================================================================================
 * THE CHAPTER FLOW (CONTENT_CONTRACT section 3; owned by shore_a). Other writers CALL these; nobody
 * else writes them, and NOBODY sets the variable `tide` by hand.
 * ===================================================================================================
 *
 *   ce_prologue_done   shore_b, last command of the prologue auto event on shingle_beach.
 *                      -> white fade, tint cleared, tide = 1, prologue_done, Wren wakes in wren_house.
 *
 *   ce_go_down         shore_b, at the Tide Steps mouth once the segment's duties are done.
 *                      -> recount this segment's Kept moments, gather the party, go to tide_steps (12,2).
 *
 *   ce_tide_done       the zone owner, last command of each Tide's climax scene.
 *                      -> fade, walking-home narration, healAll, tide += 1, party back to Wren alone,
 *                         transfer to the next Shore start: harbour_row (10,11) facing down for tides
 *                         2-5. At tide 6 it transfers nowhere: the finale owner stages the epilogue.
 *
 *   ce_said_1 .. ce_said_9     whoever scripts Say it / Keep it moment N, on the "Say it" branch.
 *   ce_kept_1 .. ce_kept_9     ...and on the "Keep it" branch.
 *   ce_late_said_1 .. _5       the zone owner, in the onPeace branch of troop_kept_N (bible 6.11).
 *
 * Helpers other writers are welcome to use:
 *   ce_shore_time          outdoor Shore maps: bgm + ambience + time-of-day tint for the current tide.
 *                          Call it from the map's onEnter (shingle_beach, harbour_row).
 *   ce_shore_time_indoor   the same for a Shore interior (wren_house, brills_chippy): lamp warmth,
 *                          amb_room_hum, and the right music for the tide.
 *   ce_recount_kept        recomputes segN_kept for the CURRENT tide from the skN flags.
 *
 * Deliberately NOT here: autosave. The interpreter's ['save'] opens the save UI and waits for the
 * player, so it must never be called by a scripted scene. The Shore save point is Wren's bed
 * (wren_house) and the Lull save points are the rock pools.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};

  /* Say it / Keep it moment N -> the Shore segment it belongs to (CONTENT_CONTRACT 5). */
  const SEGMENT_OF = { 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5 };

  /* The True Word each moment earns (bible 8.7). ce_late_said_N has Wren say the ones she kept. */
  const TRUE_WORD = {
    1: "I'm not all right about it.",
    2: 'You were my best friend.',
    3: 'I saw you were sad and I looked away.',
    4: 'Thank you.',
    5: 'I kept the string up.',
    6: 'I read every postcard.',
    7: 'I should have helped you pack.',
    8: "I'm still your friend. If you want.",
    9: "I didn't mean it. I'm sorry.",
  };

  /* The moments that belong to each Shore segment, in the order Wren would say them late. */
  const MOMENTS_OF = { 1: [1, 2], 2: [3, 4], 3: [5, 6], 4: [7, 8], 5: [9] };

  // merged into the shared table, so the load order of the other common-event files does not matter
  const events = G.DATA.commonEvents = Object.assign(G.DATA.commonEvents || {}, {

    /* ================================================================= the clock ============== */

    /**
     * Called by shore_b as the LAST command of the prologue on shingle_beach.
     * The memory whites out; Wren is twelve again, in her own bedroom, on Friday.
     */
    ce_prologue_done: {
      name: 'Chapter flow: the prologue ends',
      commands: [
        ['bgmFade', 1200],
        ['fade', 'out', 70, 'white'],
        ['wait', 40],
        ['tint', null, 0],
        ['cg', null, { fade: 0 }],
        ['setVar', 'tide', '=', 1],
        ['setFlag', 'prologue_done', true],
        ['transfer', 'wren_house', 20, 8, 'down', { fade: 'white' }],
      ],
    },

    /**
     * Called by shore_b at the Tide Steps mouth. The gate has already been checked there; this is only
     * the going-down. The party gathers on the stairs (bible: on the Shore, Wren walks alone).
     */
    ce_go_down: {
      name: 'Chapter flow: down to the Lull',
      commands: [
        ['call', 'ce_recount_kept'],
        ['fade', 'out', 45, 'black'],
        ['wait', 15],
        ['addMember', 'odo'],
        ['addMember', 'lin'],
        ['if', { flag: 'pim_joined' }, [['addMember', 'pim']], []],
        ['transfer', 'tide_steps', 12, 2, 'down', { fade: 'black' }],
      ],
    },

    /**
     * Called by the zone owner after the Tide's climax. Everything that moves the clock lives here so
     * that the walking-home beat sounds the same every time and the town's hours stay honest.
     */
    ce_tide_done: {
      name: 'Chapter flow: a Tide ends',
      commands: [
        ['fade', 'out', 60, 'black'],
        ['bgmFade', 1200],
        ['ambience', null],
        ['wait', 30],
        ['healAll'],
        ['setVar', 'tide', '+', 1],

        ['if', { var: ['tide', '==', 2] }, [
          ['narrate', 'They come back up the steps in the dark, with the sea a long way behind them.'],
          ['think', 'My boots are full of sand.{w:20} Both of them.{w:15} Somehow.'],
          ['narrate', 'Saturday. Low water at 10:42.\nLin has written it down, so it is true.'],
        ], []],
        ['if', { var: ['tide', '==', 3] }, [
          ['narrate', 'Up the steps, along the row, home to a sandwich nobody finishes.'],
          ['think', 'Odo walked up the whole way backwards.{w:20} Showing off.{w:15} Still doing it.'],
          ['narrate', 'Saturday evening. The lamps come on one at a time,\nlike they are thinking about it.'],
        ], []],
        ['if', { var: ['tide', '==', 4] }, [
          ['narrate', "Home in the dark. Somebody's radio two streets over, playing to nobody."],
          ['think', 'Sunday tomorrow. Lowest one yet, Lin says.{w:20} She said it twice.'],
          ['narrate', 'Sunday morning. Rain: the small kind,\nthat does not look like much and soaks you anyway.'],
        ], []],
        ['if', { var: ['tide', '==', 5] }, [
          ['narrate', 'They climb up wet through, and nobody mentions it,\nwhich is the local custom.'],
          ['think', 'Nobody left.{w:20} I keep checking.{w:15} They keep being there.'],
          ['narrate', 'Sunday evening. The last low water of the year that low.'],
        ], []],

        /* The Shore is Wren's alone. The others keep their levels in the reserve. */
        ['removeMember', 'odo'],
        ['removeMember', 'lin'],
        ['removeMember', 'pim'],

        /*
         * Tides 2-5 all start on Harbour Row at the segment start tile; the map's onEnter calls
         * ce_shore_time, which puts the right hour and weather on the town. At tide 6 the finale
         * owner has the screen: we leave it black for their fade.
         */
        ['if', { var: ['tide', '<=', 5] }, [
          ['transfer', 'harbour_row', 10, 11, 'down', { fade: 'black' }],
        ], []],
      ],
    },

    /* ================================================================= the hour of the day ==== */

    /**
     * Outdoor Shore maps call this from onEnter. Friday afternoon, Saturday morning, Saturday evening,
     * Sunday drizzle, Sunday evening, and the epilogue's clean early light (bible 5.3-5.8).
     */
    ce_shore_time: {
      name: 'Shore: hour, weather and music',
      commands: [
        ['if', { var: ['tide', '<=', 1] }, [
          ['bgm', 'bgm_harbour_row'], ['ambience', 'amb_wind'], ['tint', [255, 214, 168, 0.12], 24],
        ], []],
        ['if', { var: ['tide', '==', 2] }, [
          ['bgm', 'bgm_harbour_row'], ['ambience', 'amb_wind'], ['tint', [214, 232, 255, 0.10], 24],
        ], []],
        ['if', { var: ['tide', '==', 3] }, [
          ['bgm', 'bgm_harbour_row'], ['ambience', 'amb_wind'], ['tint', [255, 172, 106, 0.22], 24],
        ], []],
        ['if', { var: ['tide', '==', 4] }, [
          ['bgm', 'bgm_town_hush'], ['ambience', 'amb_rain'], ['tint', [132, 152, 182, 0.26], 24],
        ], []],
        ['if', { var: ['tide', '==', 5] }, [
          ['bgm', 'bgm_town_hush'], ['ambience', 'amb_wind'], ['tint', [64, 84, 136, 0.30], 24],
        ], []],
        ['if', { var: ['tide', '>=', 6] }, [
          ['bgm', 'bgm_harbour_row'], ['ambience', 'amb_wind'], ['tint', [255, 238, 214, 0.10], 24],
        ], []],
      ],
    },

    /** The same, for a Shore interior: lamp warmth instead of weather, and the room's own hum. */
    ce_shore_time_indoor: {
      name: 'Shore interior: lamp, hum and music',
      commands: [
        ['if', { var: ['tide', '>=', 4] }, [['bgm', 'bgm_town_hush']], [['bgm', 'bgm_harbour_row']]],
        ['ambience', 'amb_room_hum'],
        ['if', { var: ['tide', '==', 4] }, [
          ['tint', [126, 146, 178, 0.18], 24],
        ], [
          ['tint', [255, 206, 150, 0.14], 24],
        ]],
      ],
    },

    /* ================================================================= Say it / Keep it ======= */

    /**
     * Recomputes segN_kept for the CURRENT tide straight from the skN flags, so that a moment which was
     * Kept and then Said late can never leave a stale count behind. ce_go_down calls it; anyone may.
     */
    ce_recount_kept: {
      name: 'Say/Keep: recount this segment',
      commands: [],   /* filled in below */
    },

    /* ================================================================= the test map =========== */

    /** Used by the test signpost to prove that ['call', ...] works. Kept on purpose. */
    test_signature: {
      name: 'Signpost signature',
      commands: [
        ['narrate', '{small}(Someone has drawn a small smiling sun in the corner.){/small}'],
      ],
    },
  });

  /* ---------------------------------------------------------------------------------------------
   * ce_recount_kept, built from the segment table so the two never drift apart.
   * ------------------------------------------------------------------------------------------- */
  const recount = [];
  for (let seg = 1; seg <= 5; seg++) {
    const inner = [['setVar', 'seg' + seg + '_kept', '=', 0]];
    for (const n of MOMENTS_OF[seg]) {
      inner.push(['if', { all: [{ flag: 'sk' + n + '_kept' }, { notFlag: 'sk' + n + '_said' }] },
        [['setVar', 'seg' + seg + '_kept', '+', 1]], []]);
    }
    recount.push(['if', { var: ['tide', '==', seg] }, inner, []]);
  }
  events.ce_recount_kept.commands = recount;

  /* ---------------------------------------------------------------------------------------------
   * ce_said_N / ce_kept_N, moments 1-9.
   *
   * said: skN_said, true_words += 1. kept: skN_kept, segM_kept += 1, and the small dropped-pebble
   * sound. Nothing here ever comments on the choice; Keeping is the easy button, not the wrong one.
   * Both are guarded so that a re-triggered scene can never count the same word twice.
   * ------------------------------------------------------------------------------------------- */
  for (let n = 1; n <= 9; n++) {
    const seg = SEGMENT_OF[n];

    events['ce_said_' + n] = {
      name: 'Say it ' + n,
      commands: [
        ['if', { notFlag: 'sk' + n + '_said' }, [
          ['setFlag', 'sk' + n + '_said', true],
          ['setVar', 'true_words', '+', 1],
          ['sfx', 'sfx_feel_up'],
        ], []],
      ],
    };

    events['ce_kept_' + n] = {
      name: 'Keep it ' + n,
      commands: [
        ['if', { notFlag: 'sk' + n + '_kept' }, [
          ['setFlag', 'sk' + n + '_kept', true],
          ['setVar', 'seg' + seg + '_kept', '+', 1],
          ['sfx', 'sfx_feel_down'],
        ], []],
      ],
    };
  }

  /* ---------------------------------------------------------------------------------------------
   * ce_late_said_1 .. ce_late_said_5 (bible 6.11).
   *
   * The zone owner calls this from the onPeace branch of troop_kept_N, when the named Unsent of that
   * Tide has been Delivered. Every word that was Kept in that Shore segment is said now, late, out
   * loud, to whoever happens to be standing there. It counts exactly the same.
   * ------------------------------------------------------------------------------------------- */
  const LATE_INTRO = {
    1: 'The Shrug comes apart, the way a held breath does.',
    2: 'Never Mind stops minding. It goes quiet, and waits, politely.',
    3: 'Later folds itself up small and looks at Wren as if to say: well?',
    4: 'Ask Her Yourself hangs there in the water, not going anywhere.',
    5: 'The coating slides off it. Underneath it was only ever a thing somebody meant to say.',
  };

  for (let seg = 1; seg <= 5; seg++) {
    const cmds = [
      ['if', { var: ['seg' + seg + '_kept', '>', 0] }, (function () {
        const body = [
          ['narrate', LATE_INTRO[seg]],
          ['setVar', 'true_words', '+', 'seg' + seg + '_kept'],
        ];
        for (const n of MOMENTS_OF[seg]) {
          body.push(['if', { all: [{ flag: 'sk' + n + '_kept' }, { notFlag: 'sk' + n + '_said' }] }, [
            ['setFlag', 'sk' + n + '_said', true],
            ['say', 'wren', [3, 7, 9].includes(n) ? 'neutral' : 'small_smile', TRUE_WORD[n]],   // the hard ones are said plainly
          ], []]);
        }
        body.push(['setVar', 'seg' + seg + '_kept', '=', 0]);
        body.push(['sfx', 'sfx_feel_up']);
        body.push(['narrate', '{small}(Late. But out loud.){/small}']);
        return body;
      })(), []],
    ];
    events['ce_late_said_' + seg] = { name: 'Said late, segment ' + seg, commands: cmds };
  }
})();
