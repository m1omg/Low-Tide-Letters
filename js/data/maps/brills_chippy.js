/*
 * brills_chippy.js - Brill's Chippy, Harbour Row (DESIGN_BIBLE 4.2 #3, 5.4, 5.9, 7).
 *
 * 20x14. Steam, vinegar and forced cheer. Serving side along y=2..4 behind two counters, customer floor
 * below, and a stock room in the north-east corner reached through the doorway at (15,5).
 *
 *   - Mr Brill: the Shore shop, and the pickled-egg running gag (var `egg_offers`, one egg per tide,
 *     bookkept with `brills_chippy_egg_tide`). His pages get shorter every tide (bible 5.9).
 *   - Tide 2: the vinegar errand sends Wren into the back room, where the CLOSING DOWN sign lies
 *     face-down. Turning it over runs Say/Keep moment 3 with Odo bursting in.
 *   - Owner: shore_b. Calls `ce_said_3` / `ce_kept_3` (shore_a, js/data/common_events.js).
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G;

  /* ---------------------------------------------------------------- local common events (shore_b) */

  Object.assign(G.DATA.commonEvents, {
    /** The Shore stock of bible section 7. */
    ce_bc_shop: {
      name: 'Brill\'s Chippy: the counter',
      commands: [
        ['shop', ['bag_of_chips', 'mushy_peas', 'pickled_egg', 'scraps', 'flask_of_tea', 'stick_of_rock']],
      ],
    },

    /**
     * Has Wren already taken an egg in THIS tide? Leaves the answer in `brills_chippy_egg_diff`
     * (> 0 means Mr Brill may offer again). Only whole tides count, so the medal needs three days.
     */
    ce_bc_egg_check: {
      name: 'Brill\'s Chippy: is an egg due?',
      commands: [
        ['setVar', 'brills_chippy_egg_diff', '=', 'tide'],
        ['setVar', 'brills_chippy_egg_diff', '-', 'brills_chippy_egg_tide'],
      ],
    },

    ce_bc_egg_yes: {
      name: 'Brill\'s Chippy: accepting the egg',
      commands: [
        ['sfx', 'sfx_bell'],
        ['giveItem', 'pickled_egg', 1],
        ['setVar', 'egg_offers', '+', 1],
        ['setVar', 'brills_chippy_egg_tide', '=', 'tide'],
        ['think', 'It is the colour of a rainy Tuesday. Into the pocket it goes.'],
      ],
    },

    ce_bc_egg_no: {
      name: 'Brill\'s Chippy: declining the egg',
      commands: [
        ['setVar', 'brills_chippy_egg_tide', '=', 'tide'],
        ['say', 'mr_brill', null, 'Right you are. {w:15}The egg waits. The egg is patient.'],
      ],
    },
  });

  /* ---------------------------------------------------------------- the map */

  G.registerMap('brills_chippy', {
    name: 'Brill\'s Chippy',
    width: 20,
    height: 14,
    bgm: null,                       /* set per tide in onEnter (bible 4.2) */
    ambience: 'amb_room_hum',
    backdrop: '#1c1a18',
    tint: null,
    start: { x: 10, y: 11, dir: 'up' },

    legend: {
      f: 'floorboards',
      '#': 'wall_plaster',
      ' ': 'void',
    },

    /*        0123456789012345678 9 */
    ground: [
      ' ################## ',
      ' ################## ',
      ' #ffffffffff#fffff# ',
      ' #ffffffffff#fffff# ',
      ' #ffffffffff#fffff# ',
      ' #ffffffffff###f### ',
      ' #ffffffffffffffff# ',
      ' #ffffffffffffffff# ',
      ' #ffffffffffffffff# ',
      ' #ffffffffffffffff# ',
      ' #ffffffffffffffff# ',
      ' #ffffffffffffffff# ',
      ' #########f######## ',
      '                    ',
    ],

    objects: [
      /* the serving side: two counters, the fryers, the drinks machine that has never worked */
      { obj: 'chippy_counter', x: 3, y: 4 },
      { obj: 'chippy_counter', x: 6, y: 4 },
      { obj: 'fryer', x: 8, y: 4 },
      { obj: 'vending_machine', x: 10, y: 4 },
      { obj: 'fryer', x: 8, y: 2 },
      { obj: 'crates', x: 2, y: 2 },

      /* the customer floor */
      { obj: 'table', x: 3, y: 8 },
      { obj: 'bench', x: 3, y: 10 },
      { obj: 'table', x: 13, y: 8 },
      { obj: 'bench', x: 13, y: 10 },
      { obj: 'bench', x: 16, y: 6 },

      /* the back room */
      { obj: 'crates', x: 13, y: 2 },
    ],

    events: [
      /* ---------------------------------------------------------------- out to Harbour Row */
      {
        id: 'door_out',
        x: 10,
        y: 12,
        pages: [
          {
            cond: null,
            sprite: null,
            trigger: 'touch',
            commands: [
              ['sfx', 'sfx_bell'],
              ['transfer', 'harbour_row', 30, 10, 'down', { fade: 'black' }],
            ],
          },
        ],
      },

      /* ---------------------------------------------------------------- Mr Brill, one page per tide */
      {
        id: 'mr_brill',
        x: 4,
        y: 3,
        pages: [
          /* Tide 1 - booming */
          {
            cond: null,
            sprite: { char: 'mr_brill', dir: 'down' },
            trigger: 'action',
            move: { type: 'still' },
            facePlayer: true,
            commands: [
              ['say', 'mr_brill', null, 'There she is. {big}THE WREN{/big} has landed.'],
              ['say', 'mr_brill', null, 'Cod? Chips? Both? {w:15}Both is the correct answer, love.'],
              ['call', 'ce_bc_egg_check'],
              ['if', { var: ['brills_chippy_egg_diff', '>', 0] }, [
                ['say', 'mr_brill', null, 'Pickled egg? On the house. No? {w:25}...Pickled egg?'],
                ['choice', ['Go on then.', 'No, thank you.'], [
                  [['call', 'ce_bc_egg_yes']],
                  [['call', 'ce_bc_egg_no']],
                ], { cancel: 1 }],
              ], []],
              ['choice', ['Buy something.', 'Just looking.'], [
                [['call', 'ce_bc_shop']],
                [['say', 'mr_brill', null, 'Look away. Looking is free. Nothing else in here is.']],
              ], { cancel: 1 }],
            ],
          },

          /* Tide 2 - the vinegar errand, then the egg, then the shop */
          {
            cond: { var: ['tide', '>=', 2] },
            sprite: { char: 'mr_brill', dir: 'down' },
            trigger: 'action',
            move: { type: 'still' },
            facePlayer: true,
            commands: [
              ['if', { flag: 'brills_chippy_vinegar_got' }, [
                ['if', { notFlag: 'brills_chippy_vinegar_done' }, [
                  ['emote', 'this', 'heart'],
                  ['say', 'mr_brill', null, 'You are a marvel and I shall say so at your wedding.'],
                  ['say', 'mr_brill', null, 'Scraps. On the house. {w:15}Don\'t tell Odo, he charges his own father.'],
                  ['giveItem', 'scraps', 1],
                  ['setFlag', 'brills_chippy_vinegar_done', true],
                ], []],
              ], [
                ['if', { notFlag: 'brills_chippy_vinegar_asked' }, [
                  ['say', 'mr_brill', null, 'Morning, morning. Saturday rush. {w:20}Look at it. Both of them.'],
                  ['say', 'mr_brill', null, 'Do us a favour, love — big bottle of vinegar, back room, on the crates.'],
                  ['say', 'mr_brill', null, 'My knees have retired before I have.'],
                  ['setFlag', 'brills_chippy_vinegar_asked', true],
                  ['think', 'Back room. Right.'],
                ], [
                  ['say', 'mr_brill', null, 'Vinegar. Back room. On the crates. {w:15}I believe in you.'],
                ]],
              ]],
              ['call', 'ce_bc_egg_check'],
              ['if', { var: ['brills_chippy_egg_diff', '>', 0] }, [
                ['say', 'mr_brill', null, 'Pickled egg? On the house. No? {w:25}...Pickled egg?'],
                ['choice', ['Go on then.', 'No, thank you.'], [
                  [['call', 'ce_bc_egg_yes']],
                  [['call', 'ce_bc_egg_no']],
                ], { cancel: 1 }],
              ], []],
              ['choice', ['Buy something.', 'Just looking.'], [
                [['call', 'ce_bc_shop']],
                [['say', 'mr_brill', null, 'Right you are. Mind the step on the way out. There isn\'t one. Mind it anyway.']],
              ], { cancel: 1 }],
            ],
          },

          /* Tide 3 - shorter, one egg offer only (bible 5.9) */
          {
            cond: { var: ['tide', '>=', 3] },
            sprite: { char: 'mr_brill', dir: 'down' },
            trigger: 'action',
            move: { type: 'still' },
            facePlayer: true,
            commands: [
              ['say', 'mr_brill', null, 'Evening, love. {w:20}Quiet one.'],
              ['call', 'ce_bc_egg_check'],
              ['if', { var: ['brills_chippy_egg_diff', '>', 0] }, [
                ['say', 'mr_brill', null, 'Egg? {w:15}On the house.'],
                ['choice', ['Go on then.', 'No, thank you.'], [
                  [['call', 'ce_bc_egg_yes']],
                  [['call', 'ce_bc_egg_no']],
                ], { cancel: 1 }],
              ], []],
              ['choice', ['Buy something.', 'Just looking.'], [
                [['call', 'ce_bc_shop']],
                [['say', 'mr_brill', null, 'Aye.']],
              ], { cancel: 1 }],
            ],
          },

          /* Tide 4 - flat and short */
          {
            cond: { var: ['tide', '>=', 4] },
            sprite: { char: 'mr_brill', dir: 'down' },
            trigger: 'action',
            move: { type: 'still' },
            facePlayer: true,
            commands: [
              ['say', 'mr_brill', null, '...Chips?'],
              ['think', 'He has stopped doing the voice.'],
              ['choice', ['Buy something.', 'Just looking.'], [
                [['call', 'ce_bc_shop']],
                [['say', 'mr_brill', null, 'Right.']],
              ], { cancel: 1 }],
            ],
          },

          /* Tide 5 - "...Egg." */
          {
            cond: { var: ['tide', '>=', 5] },
            sprite: { char: 'mr_brill', dir: 'down' },
            trigger: 'action',
            move: { type: 'still' },
            facePlayer: true,
            commands: [
              ['call', 'ce_bc_egg_check'],
              ['if', { var: ['brills_chippy_egg_diff', '>', 0] }, [
                ['say', 'mr_brill', null, '...Egg.'],
                ['choice', ['Go on then.', 'No, thank you.'], [
                  [['call', 'ce_bc_egg_yes']],
                  [['say', 'mr_brill', null, '...'], ['setVar', 'brills_chippy_egg_tide', '=', 'tide']],
                ], { cancel: 1 }],
              ], [
                ['say', 'mr_brill', null, '...'],
              ]],
              ['choice', ['Buy something.', 'Just looking.'], [
                [['call', 'ce_bc_shop']],
                [['think', 'The fryer is on. Nothing is in it.']],
              ], { cancel: 1 }],
            ],
          },

          /* Epilogue - booming again, and tearful about it */
          {
            cond: { var: ['tide', '>=', 6] },
            sprite: { char: 'mr_brill', dir: 'down' },
            trigger: 'action',
            move: { type: 'still' },
            facePlayer: true,
            commands: [
              ['say', 'mr_brill', null, 'WREN! {w:15}Come here. {w:20}No. Stay there. I\'ll only go.'],
              ['say', 'mr_brill', null, 'Our Odo has been marching about the kitchen saying he has POST coming.'],
              ['say', 'mr_brill', null, 'He is extremely sure about it. He has cleared a shelf.'],
              ['if', { notSelf: 'E' }, [
                ['say', 'mr_brill', null, 'Egg? {w:20}...No. Not today. Today you get chips. Large.'],
                ['giveItem', 'bag_of_chips', 2],
                ['setSelf', 'E', true],
              ], [
                ['say', 'mr_brill', null, 'Go on. Before they go cold and I start again.'],
              ]],
              ['choice', ['Buy something.', 'Just looking.'], [
                [['call', 'ce_bc_shop']],
                [['say', 'mr_brill', null, 'Mind how you go, love.']],
              ], { cancel: 1 }],
            ],
          },
        ],
      },

      /* ---------------------------------------------------------------- the gap at the end of the counter */
      {
        id: 'counter_gap',
        x: 11,
        y: 4,
        pages: [
          {
            cond: null,
            sprite: null,
            solid: false,
            trigger: 'touch',
            commands: [
              ['say', 'mr_brill', null, 'Other side, love. Hot fat and small children don\'t mix.'],
              ['move', 'player', ['down'], { wait: true }],
            ],
          },
        ],
      },

      /* ---------------------------------------------------------------- the back room: vinegar */
      {
        id: 'vinegar_crates',
        x: 16,
        y: 2,
        pages: [
          {
            cond: null,
            sprite: { obj: 'crates' },
            trigger: 'action',
            commands: [
              ['think', 'Vinegar. Gallons of it. The smell has opinions.'],
            ],
          },
          {
            cond: { all: [{ flag: 'brills_chippy_vinegar_asked' }, { notFlag: 'brills_chippy_vinegar_got' }] },
            sprite: { obj: 'crates' },
            trigger: 'action',
            commands: [
              ['sfx', 'sfx_item_get'],
              ['narrate', 'One big bottle of vinegar. It is heavier than it looks and it sloshes like it knows.'],
              ['setFlag', 'brills_chippy_vinegar_got', true],
              ['think', 'Right. Back out. {w:15}Without looking at anything.'],
            ],
          },
        ],
      },

      /* ---------------------------------------------------------------- the CLOSING DOWN sign (sk3) */
      {
        id: 'sign_closing',
        x: 16,
        y: 3,
        pages: [
          {
            cond: null,
            sprite: { obj: 'sign_closing' },
            solid: false,
            trigger: 'action',
            commands: [
              ['think', 'A board, face-down on the floor. The dust around it is older than the board is.'],
            ],
          },
          {
            cond: { var: ['tide', '>=', 2] },
            sprite: { obj: 'sign_closing' },
            solid: false,
            trigger: 'action',
            commands: [
              ['if', { flag: 'brills_chippy_sign_turned' }, [
                ['think', 'Face-down again. It doesn\'t change what it says.'],
              ], [
                ['think', 'Face-down. Somebody laid it down carefully, which is worse than dropping it.'],
                ['choice', ['Turn it over.', 'Leave it.'], [
                  [
                    ['sfx', 'sfx_push'],
                    ['wait', 25],
                    ['narrate', '{big}CLOSING DOWN{/big}\n{small}Thank you for thirty years — crossed out.\nThank you for nine months.{/small}'],
                    ['think', 'Oh.'],
                    ['setFlag', 'brills_chippy_sign_turned', true],
                    ['wait', 30],
                    ['call', 'ce_bc_sk3'],
                  ],
                  [
                    ['think', 'Leave it. Boards lie face-down all over this town.'],
                  ],
                ], { cancel: 1 }],
              ]],
            ],
          },
        ],
      },

      /* ---------------------------------------------------------------- Odo, who bursts in (sk3) */
      {
        id: 'odo_sk3',
        x: 15,
        y: 6,
        pages: [
          {
            cond: null,
            sprite: null,
            solid: false,
            trigger: 'action',
            move: { type: 'still' },
            commands: [['end']],
          },
        ],
      },

      /* ---------------------------------------------------------------- dressing */
      {
        id: 'insp_fryer',
        x: 8,
        y: 4,
        pages: [
          {
            cond: null,
            sprite: null,
            solid: false,
            trigger: 'action',
            commands: [
              ['if', { notSelf: 'A' }, [
                ['think', 'The fryer. It has been on since I was born. It will outlive the shop.'],
                ['setSelf', 'A', true],
              ], [
                ['think', 'Still on. Still enormous. Still faintly annoyed about something.'],
              ]],
            ],
          },
        ],
      },
      {
        id: 'insp_vending',
        x: 10,
        y: 4,
        pages: [
          {
            cond: null,
            sprite: null,
            solid: false,
            trigger: 'action',
            commands: [
              ['if', { notSelf: 'A' }, [
                ['think', 'A drinks machine. Out of order since January. Odo has written GOOD LUCK on it in biro.'],
                ['setSelf', 'A', true],
              ], [
                ['sfx', 'sfx_switch'],
                ['think', 'I pressed the button. Nothing. {w:15}Good luck, it says.'],
              ]],
            ],
          },
        ],
      },
      {
        id: 'insp_price_list',
        x: 11,
        y: 12,
        pages: [
          {
            cond: null,
            sprite: null,
            solid: false,
            trigger: 'action',
            commands: [
              ['think', 'The price list. Laminated. The prices under the lamination are older than the prices on top.'],
            ],
          },
        ],
      },
      {
        id: 'insp_bench_wasp',
        x: 17,
        y: 6,
        pages: [
          {
            cond: null,
            sprite: null,
            solid: false,
            trigger: 'action',
            commands: [
              ['if', { notSelf: 'A' }, [
                ['think', 'On the end of the bench: one wasp. September. It has nowhere to be and it knows it.'],
                ['setSelf', 'A', true],
              ], [
                ['if', { notSelf: 'B' }, [
                  ['think', 'The wasp has moved two inches. This appears to have been the plan.'],
                  ['setSelf', 'B', true],
                ], [
                  ['think', 'The wasp and I have an understanding. Neither of us is going to say anything.'],
                ]],
              ]],
            ],
          },
        ],
      },
      {
        id: 'insp_table_front',
        x: 3,
        y: 10,
        pages: [
          {
            cond: null,
            sprite: null,
            solid: false,
            trigger: 'action',
            commands: [
              ['if', { notSelf: 'A' }, [
                ['think', 'Someone has carved ODO B. into the bench. Someone has carved it four times.'],
                ['setSelf', 'A', true],
              ], [
                ['think', 'Four times, in case the bench forgot.'],
              ]],
            ],
          },
        ],
      },
    ],

    onEnter: [
      ['sfx', 'sfx_bell'],
      ['call', 'ce_shore_time_indoor'],
    ],
  });

  /* ---------------------------------------------------------------- sk3, kept in its own list */

  Object.assign(G.DATA.commonEvents, {
    ce_bc_sk3: {
      name: 'Brill\'s Chippy: Say/Keep 3 (Odo and the sign)',
      commands: [
        ['sfx', 'sfx_bell'],
        ['setSprite', 'odo_sk3', { char: 'odo', dir: 'up' }],
        ['move', 'odo_sk3', [['speed', 5], 'up'], { wait: true }],
        ['emote', 'odo_sk3', '!'],
        ['say', 'odo', 'boast', 'Commencing snack. Snack is GO. Over.'],
        ['say', 'odo', 'neutral', 'Dad said you were in the back with the— {w:20}oh.'],
        ['wait', 20],
        ['custom', 'keep_or_say', {
          prompt: 'The board is the wrong way up now.',
          say: 'I saw the sign, Odo.',
          keep: 'Nothing.',
          varName: 'brills_chippy_sk3_choice',
        }],
        ['if', { var: ['brills_chippy_sk3_choice', '==', 0] }, [
          ['say', 'odo', 'scared', 'That\'s — {w:20}that\'s an OLD sign. For a different shop. That closed. Over and OUT.'],
          ['wait', 25],
          ['think', 'He is not ready. But he was seen.'],
          ['say', 'wren', 'neutral', 'Okay.'],
          ['say', 'odo', 'boast', '...Snack, then. Snack is still GO. Over.'],
          ['call', 'ce_said_3'],
        ], [
          ['sfx', 'sfx_push'],
          ['think', 'Not my business. That\'s the rule here. We don\'t make a fuss.'],
          ['say', 'odo', 'neutral', '...You all right? You\'ve gone a bit {small}quiet{/small}. Over.'],
          ['say', 'odo', 'grin', 'Never mind. Snack. Over.'],
          ['call', 'ce_kept_3'],
        ]],
        ['move', 'odo_sk3', [['speed', 4], 'down'], { wait: true }],
        ['erase', 'odo_sk3'],
      ],
    },
  });
})();
