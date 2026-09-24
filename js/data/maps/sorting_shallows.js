/*
 * sorting_shallows.js - SORTING SHALLOWS (40x30), Tide 1 of the Lull (DESIGN_BIBLE 4.2 row 6, 5.3, 8.1).
 *
 * Pale sand, paper instead of seaweed, cliffs of pigeonholes filing themselves. Pim is found upside down
 * in one of them; the Thank-You Card teaches Deliver; six stray letters want sorting by colour; a wall of
 * drawers slides back on the north-west alcove where Postmaster Gull is on strike.
 *
 * Owner: lull_1. Flags invented here are prefixed `sorting_shallows_`.
 * Two helper common events are registered at the bottom of this file (`ss_letter_home`, `ss_sorted`).
 */
G.registerMap('sorting_shallows', {
  name: 'Sorting Shallows',
  width: 40,
  height: 30,
  bgm: 'bgm_lull_bright',
  ambience: 'amb_lull',
  backdrop: '#1d3b44',
  battleback: 'bb_lull_day',
  tint: null,

  legend: {
    '#': 'reef_rock',
    '.': 'pale_sand',
    'e': 'envelope_paper',
    '~': 'shallows',
    'D': 'deep_water',
  },

  ground: [
    '########################################',  /*  0 */
    '########################################',  /*  1 */
    '###eeeeeeee#####....................####',  /*  2  the north-west alcove: the boss arena */
    '##eeeeeeeee####.....................####',  /*  3 */
    '##eeeeeeeee###......................####',  /*  4 */
    '##eeeeeeeee###......................####',  /*  5 */
    '##eeeeeeeee###......................####',  /*  6 */
    '##eeeeeeeee####.....................####',  /*  7 */
    '###eeeeeeee####.....................####',  /*  8 */
    '#####ee####.........................####',  /*  9  (5,9) (6,9) the pigeonhole gate */
    '####................................####',  /* 10 */
    '###.................................####',  /* 11 */
    '###..........eeeeeeee...............####',  /* 12  the sorting floor */
    '###.........eeeeeeeeee..............####',  /* 13 */
    '###.........eeeeeeeeee.................#',  /* 14 */
    '###.........eeeeeeeeee..................',  /* 15  (39,15) out to the Tide Steps */
    '###..........eeeeeeee..................#',  /* 16 */
    '###.................................####',  /* 17 */
    '###......~~~~~~~~...................####',  /* 18 */
    '##.....~~~~~~~~~~~..................####',  /* 19 */
    '##....~~~~~~~~~~~~..................####',  /* 20 */
    '##.....~~~~~~~~~~...................####',  /* 21 */
    '###.................................####',  /* 22 */
    '###.................................####',  /* 23 */
    '####...............................#####',  /* 24 */
    '#####.............................######',  /* 25 */
    '######............~~~~~~~~~~.....#######',  /* 26 */
    '#######..........~~~~~~~~~~~~...########',  /* 27 */
    '#########DDDDDDDDDDDDDDDDDDDD###########',  /* 28  the drop-off */
    '########################################',  /* 29 */
  ],

  objects: [
    /* cliffs of pigeonholes along the north wall and standing out of the flat like sea stacks */
    { obj: 'pigeonhole_cliff', x: 18, y: 3 },
    { obj: 'pigeonhole_cliff', x: 22, y: 3 },
    { obj: 'pigeonhole_cliff', x: 26, y: 3 },
    { obj: 'pigeonhole_cliff', x: 31, y: 3 },
    { obj: 'pigeonhole_cliff', x: 25, y: 10 },
    { obj: 'pigeonhole_cliff', x: 10, y: 11 },
    { obj: 'pigeonhole_cliff', x: 33, y: 12 },
    { obj: 'pigeonhole_cliff', x: 30, y: 23 },

    /* the boss alcove, furnished so it is a room and not a field */
    { obj: 'mail_sack', x: 3, y: 3 },
    { obj: 'mail_sack', x: 9, y: 7 },
    { obj: 'letter_pile', x: 9, y: 2 },
    { obj: 'letter_pile', x: 3, y: 7 },

    { obj: 'mail_sack', x: 15, y: 11 },
    { obj: 'mail_sack', x: 30, y: 16 },
    { obj: 'mail_sack', x: 9, y: 24 },
    { obj: 'letter_pile', x: 21, y: 25 },
    { obj: 'letter_pile', x: 6, y: 22 },
    { obj: 'stamp_flower', x: 5, y: 18 },
    { obj: 'stamp_flower', x: 23, y: 21 },
    { obj: 'stamp_flower', x: 33, y: 25 },
    { obj: 'stamp_flower', x: 14, y: 10 },
  ],

  overrides: { block: [[36, 17], [27, 13], [28, 13], [29, 13], [27, 14], [29, 14]] },   // the pool's right half, the pigeonhole cliff

  events: [
    /* ================================================================= back to the hub */
    {
      id: 'out_east',
      x: 39,
      y: 15,
      pages: [
        {
          cond: null,
          sprite: null,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_door_open'],
            ['transfer', 'tide_steps', 3, 24, 'right', { fade: 'black' }],
          ],
        },
      ],
    },

    /* ================================================================= the rock pool */
    {
      id: 'pool_shallows',
      x: 34,
      y: 17,
      pages: [
        {
          cond: null,
          sprite: { obj: 'rock_pool' },
          trigger: 'action',
          commands: [
            ['custom', 'rock_pool', { joke: 'A prawn surfaces, reads the situation, and goes back down.', id: 'pool_sorting' }],
          ],
        },
      ],
    },

    /* ================================================================= Pim */
    {
      id: 'pim_notice',
      x: 31,
      y: 15,
      pages: [
        {
          cond: { all: [{ notFlag: 'pim_joined' }, { notSelf: 'A' }] },
          sprite: null,
          trigger: 'touch',
          commands: [
            ['setSelf', 'A', true],
            ['sfx', 'sfx_emote'],
            ['say', 'odo', 'boast', 'CAPTAIN. {w:10}Legs. {w:10}Upside down. Ten o\'clock. Over.'],
            ['camera', [28, 14], 45],
            ['wait', 40],
            ['camera', 'player', 45],
            ['think', 'Two little ink legs, kicking out of a pigeonhole, very hard, at nothing.'],
          ],
        },
      ],
    },
    {
      id: 'pim_hole',
      x: 28,
      y: 14,
      pages: [
        {
          cond: { notFlag: 'pim_joined' },
          sprite: { obj: 'pigeonhole_cliff' },
          trigger: 'action',
          commands: [
            ['narrate', 'A wall of pigeonholes. In one of them, wedged, two stubby ink legs are still kicking.'],
            ['say', 'odo', 'boast', 'Requesting permission to salute it. Over.'],
            ['say', 'lin', 'stern', 'Permission denied. {w:10}Pull.'],
            ['sfx', 'sfx_push'],
            ['shake', 3, 24],
            ['wait', 20],
            ['sfx', 'sfx_page'],
            ['say', 'pim', 'delighted', "Hello! I'm Pim. I'm for somebody. Is it you? {w:20}...No. {w:20}Is it YOU?"],
            ['say', 'lin', 'neutral', "It's a letter. With legs."],
            ['say', 'pim', 'delighted', 'First Class, actually.'],
            ['sfx', 'sfx_level_up'],
            ['addMember', 'pim'],
            ['setFlag', 'pim_joined', true],
            ['say', 'pim', 'puzzled', "I'm awfully heavy for my size. Four pages, I think. I can't read my own inside. Can you?"],
            ['emote', 'player', '...'],
            ['narrate', 'Wren shrugs. It is the only answer she keeps in stock.'],
            ['think', 'I know that stamp.'],
            ['think', 'Pale blue. A lighthouse. You get them in books of ten.'],
          ],
        },
        {
          cond: { flag: 'pim_joined' },
          sprite: { obj: 'pigeonhole_cliff' },
          trigger: 'action',
          commands: [
            ['say', 'pim', 'nosy', 'That was MY pigeonhole. I was in it for ages. I did a lot of thinking.'],
            ['think', 'Empty now. There is a small Pim-shaped dent in the dust.'],
          ],
        },
      ],
    },

    /* ================================================================= the Deliver tutorial */
    {
      id: 'tutorial_card',
      x: 22,
      y: 15,
      pages: [
        {
          cond: { all: [{ flag: 'pim_joined' }, { notFlag: 'sorting_shallows_tutorial' }] },
          sprite: null,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_encounter'],
            ['narrate', 'Something folded is coming across the sand sideways, apologising to the sand as it goes.'],
            ['say', 'pim', 'nosy', 'Ooh. That one has been waiting SO long it has gone crunchy at the corners.'],
            ['say', 'pim', 'neutral', 'Listen to it first. If you listen, you can see what it needed saying WITH. Then you say that back to it.'],
            ['say', 'lin', 'stern', "And the Can Line. One confidence per round. The string only carries one voice at a time. I've made a rota."],
            ['say', 'odo', 'boast', 'A ROTA. {w:10}Over.'],
            ['battle', 'troop_tutorial_card', {
              canEscape: false,
              onPeace: [
                ['setFlag', 'sorting_shallows_tutorial', true],
                ['say', 'pim', 'delighted', 'It went as a GULL. Did you see? They all do that. It is the best part of the job.'],
                ['say', 'odo', 'quiet', '...I was kinda scared on the stairs. Over.'],
                ['think', 'He said that down a string, in the middle of a fight, like it cost nothing.'],
                ['think', 'It came back smooth. I felt it land.'],
              ],
              onWin: [
                ['setFlag', 'sorting_shallows_tutorial', true],
                ['narrate', 'The card goes quiet and folds down into a small grey pebble.'],
                ['say', 'lin', 'neutral', 'Noted. It stops them. It does not finish them.'],
                ['say', 'pim', 'puzzled', 'It still says thank you. Just... not out loud any more.'],
              ],
              onLose: 'gameover',
            }],
          ],
        },
      ],
    },

    /* ================================================================= the six stray letters (8.1) */
    {
      id: 'letter_1',
      x: 7,
      y: 12,
      pages: [
        {
          cond: { notFlag: 'sort_l1_taken' },
          sprite: { obj: 'letter_pile' },
          trigger: 'action',
          commands: [
            ['if', { var: ['sort_carry', '==', 0] }, [
              ['sfx', 'sfx_page'],
              ['narrate', '"I was so CROSS I wrote this in capitals and then didn\'t post it."'],
              ['think', 'Capitals all the way down. You can hear it from here.'],
              ['setFlag', 'sort_l1_taken', true],
              ['setVar', 'sort_carry', '=', 1],
            ], [
              ['think', 'One at a time. I have exactly the one free hand.'],
            ]],
          ],
        },
        { cond: { flag: 'sort_l1_taken' }, sprite: null, solid: false, trigger: 'action', commands: [] },
      ],
    },
    {
      id: 'letter_2',
      x: 24,
      y: 7,
      pages: [
        {
          cond: { notFlag: 'sort_l2_taken' },
          sprite: { obj: 'letter_pile' },
          trigger: 'action',
          commands: [
            ['if', { var: ['sort_carry', '==', 0] }, [
              ['sfx', 'sfx_page'],
              ['narrate', '"I keep checking the back door is locked. It always is. I check anyway."'],
              ['if', { flag: 'pim_joined' }, [
                ['say', 'pim', 'nosy', 'Eleven times, by the creases.'],
              ], []],
              ['setFlag', 'sort_l2_taken', true],
              ['setVar', 'sort_carry', '=', 2],
            ], [
              ['think', 'One at a time. I have exactly the one free hand.'],
            ]],
          ],
        },
        { cond: { flag: 'sort_l2_taken' }, sprite: null, solid: false, trigger: 'action', commands: [] },
      ],
    },
    {
      id: 'letter_3',
      x: 32,
      y: 20,
      pages: [
        {
          cond: { notFlag: 'sort_l3_taken' },
          sprite: { obj: 'letter_pile' },
          trigger: 'action',
          commands: [
            ['if', { var: ['sort_carry', '==', 0] }, [
              ['sfx', 'sfx_page'],
              ['narrate', '"You make the best toast. I have never said."'],
              ['think', 'Toast. {w:15}Whole letter about toast, and it never left the house.'],
              ['setFlag', 'sort_l3_taken', true],
              ['setVar', 'sort_carry', '=', 3],
            ], [
              ['think', 'One at a time. I have exactly the one free hand.'],
            ]],
          ],
        },
        { cond: { flag: 'sort_l3_taken' }, sprite: null, solid: false, trigger: 'action', commands: [] },
      ],
    },
    {
      id: 'letter_4',
      x: 8,
      y: 23,
      pages: [
        {
          cond: { notFlag: 'sort_l4_taken' },
          sprite: { obj: 'letter_pile' },
          trigger: 'action',
          commands: [
            ['if', { var: ['sort_carry', '==', 0] }, [
              ['sfx', 'sfx_page'],
              ['narrate', '"There was a seal on the slipway this morning!! An actual SEAL!!"'],
              ['if', { flag: 'pim_joined' }, [
                ['say', 'pim', 'delighted', 'Two exclamation marks. Twice! This one is my FAVOURITE and I have only just met it.'],
              ], []],
              ['setFlag', 'sort_l4_taken', true],
              ['setVar', 'sort_carry', '=', 4],
            ], [
              ['think', 'One at a time. I have exactly the one free hand.'],
            ]],
          ],
        },
        { cond: { flag: 'sort_l4_taken' }, sprite: null, solid: false, trigger: 'action', commands: [] },
      ],
    },
    {
      id: 'letter_5',
      x: 27,
      y: 25,
      pages: [
        {
          cond: { notFlag: 'sort_l5_taken' },
          sprite: { obj: 'letter_pile' },
          trigger: 'action',
          commands: [
            ['if', { var: ['sort_carry', '==', 0] }, [
              ['sfx', 'sfx_page'],
              ['narrate', '"If the boat\'s late again I don\'t know what I\'ll do."'],
              ['think', 'Nothing, probably. That is usually what we do.'],
              ['setFlag', 'sort_l5_taken', true],
              ['setVar', 'sort_carry', '=', 5],
            ], [
              ['think', 'One at a time. I have exactly the one free hand.'],
            ]],
          ],
        },
        { cond: { flag: 'sort_l5_taken' }, sprite: null, solid: false, trigger: 'action', commands: [] },
      ],
    },
    {
      id: 'letter_6',
      x: 20,
      y: 19,
      pages: [
        {
          cond: { notFlag: 'sort_l6_taken' },
          sprite: { obj: 'letter_pile' },
          trigger: 'action',
          commands: [
            ['if', { var: ['sort_carry', '==', 0] }, [
              ['sfx', 'sfx_page'],
              ['narrate', '"Your mother would have been proud of that, you know."'],
              ['wait', 20],
              ['think', 'Somebody wrote that down and then put it in the sea.'],
              ['setFlag', 'sort_l6_taken', true],
              ['setVar', 'sort_carry', '=', 6],
            ], [
              ['think', 'One at a time. I have exactly the one free hand.'],
            ]],
          ],
        },
        { cond: { flag: 'sort_l6_taken' }, sprite: null, solid: false, trigger: 'action', commands: [] },
      ],
    },

    /* ================================================================= the four bins (8.1) */
    {
      id: 'bin_red',
      x: 13,
      y: 12,
      pages: [
        {
          cond: null,
          sprite: { obj: 'pigeonhole_bin' },
          trigger: 'action',
          commands: [
            ['if', { var: ['sort_carry', '==', 0] }, [
              ['think', 'A bin painted red. {w:15}Red for cross.'],
            ], [
              ['if', { var: ['sort_carry', '==', 1] }, [
                ['sfx', 'sfx_talk_success'],
                ['setVar', 'sort_count', '+', 1],
                ['setVar', 'sort_carry', '=', 0],
                ['narrate', 'The letter goes in crossly and settles, which is the most a cross letter can do.'],
                ['call', 'ss_sorted'],
              ], [
                ['sfx', 'sfx_error'],
                ['call', 'ss_letter_home'],
              ]],
            ]],
          ],
        },
      ],
    },
    {
      id: 'bin_blue',
      x: 17,
      y: 12,
      pages: [
        {
          cond: null,
          sprite: { obj: 'pigeonhole_bin' },
          trigger: 'action',
          commands: [
            ['if', { var: ['sort_carry', '==', 0] }, [
              ['think', 'A bin painted blue. {w:15}Blue for fretting.'],
            ], [
              ['if', { any: [{ var: ['sort_carry', '==', 2] }, { var: ['sort_carry', '==', 5] }] }, [
                ['sfx', 'sfx_talk_success'],
                ['setVar', 'sort_count', '+', 1],
                ['setVar', 'sort_carry', '=', 0],
                ['narrate', 'It slides in and stops worrying at once, like a dog that has been let indoors.'],
                ['call', 'ss_sorted'],
              ], [
                ['sfx', 'sfx_error'],
                ['call', 'ss_letter_home'],
              ]],
            ]],
          ],
        },
      ],
    },
    {
      id: 'bin_amber',
      x: 13,
      y: 16,
      pages: [
        {
          cond: null,
          sprite: { obj: 'pigeonhole_bin' },
          trigger: 'action',
          commands: [
            ['if', { var: ['sort_carry', '==', 0] }, [
              ['think', 'A bin painted amber. {w:15}Amber for fond.'],
            ], [
              ['if', { any: [{ var: ['sort_carry', '==', 3] }, { var: ['sort_carry', '==', 6] }] }, [
                ['sfx', 'sfx_talk_success'],
                ['setVar', 'sort_count', '+', 1],
                ['setVar', 'sort_carry', '=', 0],
                ['narrate', 'It goes in warm and sits down, the way people do in a kitchen.'],
                ['call', 'ss_sorted'],
              ], [
                ['sfx', 'sfx_error'],
                ['call', 'ss_letter_home'],
              ]],
            ]],
          ],
        },
      ],
    },
    {
      id: 'bin_green',
      x: 17,
      y: 16,
      pages: [
        {
          cond: null,
          sprite: { obj: 'pigeonhole_bin' },
          trigger: 'action',
          commands: [
            ['if', { var: ['sort_carry', '==', 0] }, [
              ['think', 'A bin painted green. {w:15}Green for well-I-never.'],
            ], [
              ['if', { var: ['sort_carry', '==', 4] }, [
                ['sfx', 'sfx_talk_success'],
                ['setVar', 'sort_count', '+', 1],
                ['setVar', 'sort_carry', '=', 0],
                ['narrate', 'The letter hops in by itself, twice, to be sure everyone saw.'],
                ['call', 'ss_sorted'],
              ], [
                ['sfx', 'sfx_error'],
                ['call', 'ss_letter_home'],
              ]],
            ]],
          ],
        },
      ],
    },

    /* ================================================================= the pigeonhole gate */
    {
      id: 'gate_a',
      x: 5,
      y: 9,
      pages: [
        {
          cond: null,
          sprite: { obj: 'pigeonhole_bin' },
          trigger: 'action',
          commands: [
            ['think', 'A wall of little drawers. All shut.'],
            ['say', 'lin', 'neutral', 'It opens when the filing is done. That is the whole personality of a filing system.'],
          ],
        },
        {
          cond: { all: [{ flag: 'sort_done' }, { notFlag: 'pim_joined' }] },
          sprite: { obj: 'pigeonhole_bin' },
          trigger: 'action',
          commands: [
            ['say', 'lin', 'stern', 'Filed. It still says shut.'],
            ['say', 'odo', 'boast', 'Because we are LEAVING LEGS in a DRAWER, Captain. Ten o\'clock. Over.'],
          ],
        },
        { cond: { all: [{ flag: 'sort_done' }, { flag: 'pim_joined' }] }, sprite: null, solid: false, trigger: 'action', commands: [] },
      ],
    },
    {
      id: 'gate_b',
      x: 6,
      y: 9,
      pages: [
        {
          cond: null,
          sprite: { obj: 'pigeonhole_bin' },
          trigger: 'action',
          commands: [
            ['think', 'Shut too. There is a handwritten card taped to it: STAFF ONLY (ALL STAFF ON STRIKE).'],
          ],
        },
        {
          cond: { all: [{ flag: 'sort_done' }, { notFlag: 'pim_joined' }] },
          sprite: { obj: 'pigeonhole_bin' },
          trigger: 'action',
          commands: [
            ['think', 'Still shut.{w:20} The legs are still kicking, over there.'],
          ],
        },
        { cond: { all: [{ flag: 'sort_done' }, { flag: 'pim_joined' }] }, sprite: null, solid: false, trigger: 'action', commands: [] },
      ],
    },

    /* ================================================================= Postmaster Gull */
    {
      id: 'boss_gull',
      x: 6,
      y: 5,
      pages: [
        {
          cond: { notFlag: 'sorting_shallows_boss_done' },
          sprite: { enemy: 'boss_postmaster_gull' },
          trigger: 'touch',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['bgmFade', 600],
            ['narrate', 'The alcove is floored with envelope paper. A very large gull stands in the middle of it with a picket sign under one wing.'],
            ['say', 'postmaster_gull', null, 'HALT. {w:15}No return address, no service. It\'s in the handbook. I wrote the handbook.'],
            ['say', 'pim', 'puzzled', 'I have no address at all. Is that better, or much worse?'],
            ['say', 'postmaster_gull', null, 'It is a FORM, is what it is. Form 12-B. In triplicate.'],
            ['say', 'lin', 'stern', 'Three things. One: he is a bird. Two: he is a bird with a rulebook. Three: I respect that and I am going to argue with him anyway.'],
            ['say', 'odo', 'boast', 'Commencing delivery. Delivery is GO. Over.'],
            ['battle', 'troop_gull', {
              canEscape: false,
              bgm: 'bgm_boss',
              onPeace: [
                ['setFlag', 'gull_delivered', true],
                ['setFlag', 'sorting_shallows_boss_done', true],
                ['narrate', 'He unfolds something from under the sash. It is soft with keeping.'],
                ['say', 'postmaster_gull', null, '"Dear Sirs, I resign, effective—" {w:25}...forty years ago. {w:20}Hm.'],
                ['wait', 20],
                ['say', 'postmaster_gull', null, "Turns out I like it here. {w:15}Don't tell the lads."],
                ['sfx', 'sfx_item_get'],
                ['giveItem', 'gull_feather', 1],
                ['say', 'postmaster_gull', null, 'Regulation grey. Slightly on strike. Wear it where they can see it.'],
                ['say', 'odo', 'grin', 'We have a POSTMASTER. Log it. Over.'],
                ['erase', 'this'],
              ],
              onWin: [
                ['setFlag', 'gull_hushed', true],
                ['setFlag', 'sorting_shallows_boss_done', true],
                ['narrate', 'He folds his cap in one wing, very carefully, the way you fold a thing you mean to keep.'],
                ['say', 'postmaster_gull', null, 'Work to rule, then.'],
                ['narrate', 'He stalks off north without looking back, picket sign held high for nobody.'],
                ['think', '...Right.'],
                ['think', 'He was going to say something. I did not find out what.'],
                ['erase', 'this'],
              ],
              onLose: 'gameover',
            }],

            /* ---------------- Nacre's first slip, and the tide turning ---------------- */
            ['wait', 30],
            ['sfx', 'sfx_page'],
            ['narrate', 'A small printed slip slides out from under a stone, as if it had been waiting for a gap in the conversation.'],
            ['say', 'nacre', null, 'PLEASE DO NOT TROUBLE YOURSELF.'],
            ['say', 'lin', 'stern', 'Who prints a note in a rock?'],
            ['say', 'pim', 'delighted', 'Somebody with lovely manners.'],
            ['sfx', 'sfx_key_item'],
            ['giveItem', 'nacres_slips', 1],
            ['think', 'It was under there before we came down. {w:20}Like a place mat.'],
            ['wait', 20],
            ['sfx', 'sfx_reverse_swell'],
            ['narrate', 'Somewhere far above, a great deal of water changes its mind.'],
            ['say', 'lin', 'neutral', 'That is the turn. Up, please. I have allowed four minutes for dawdling and you have used nine.'],
            ['say', 'pim', 'nosy', 'Am I coming? {w:15}...I am coming.'],
            ['call', 'ce_tide_done'],
          ],
        },
      ],
    },

    /* ================================================================= roaming Unsent (bible 6.13, 8.9) */
    {
      id: 'roam_card_1',
      x: 22,
      y: 20,
      enemy: { troop: 'troop_card_crab', sprite: 'thank_you_card', move: { type: 'chase', sight: 4 }, respawn: false },
    },
    {
      id: 'roam_crabs_1',
      x: 26,
      y: 11,
      enemy: { troop: 'troop_crab_pair', sprite: 'sorry_crab', move: { type: 'chase', sight: 4 }, respawn: false },
    },
    {
      id: 'roam_card_2',
      x: 10,
      y: 21,
      enemy: { troop: 'troop_card_crab', sprite: 'sorry_crab', move: { type: 'chase', sight: 4 }, respawn: false },
    },
    {
      id: 'roam_corner_ne',
      x: 31,
      y: 4,
      enemy: { troop: 'troop_crab_pair', sprite: 'sorry_crab', move: { type: 'chase', sight: 4 }, respawn: false },
    },
    {
      id: 'roam_corner_sw',
      x: 11,
      y: 26,
      enemy: { troop: 'troop_card_crab', sprite: 'thank_you_card', move: { type: 'chase', sight: 4 }, respawn: false },
    },

    /* the two guarded corners (bible 8.9: two roamers sit on an item) */
    {
      id: 'corner_item_ne',
      x: 33,
      y: 3,
      pages: [
        {
          cond: null,
          sprite: { obj: 'mail_sack' },
          trigger: 'action',
          commands: [
            ['narrate', 'A sack nobody has opened, right in the corner where nobody goes.'],
            ['sfx', 'sfx_item_get'],
            ['giveItem', 'glass_amber', 1],
            ['think', "Amber. Pop says that's a beer bottle. Somebody had a nice evening."],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'mail_sack' },
          trigger: 'action',
          commands: [
            ['think', 'Sand, two buttons and a crab who would like some privacy.'],
          ],
        },
      ],
    },
    {
      id: 'corner_item_sw',
      x: 7,
      y: 26,
      pages: [
        {
          cond: null,
          sprite: { obj: 'letter_pile' },
          trigger: 'action',
          commands: [
            ['narrate', 'A pile of letters gone soft at the edges, stuck down with salt.'],
            ['sfx', 'sfx_item_get'],
            ['giveItem', 'glass_red', 1],
            ['think', 'Red. Bit of an old brake light. Still cross about it.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'letter_pile' },
          trigger: 'action',
          commands: [
            ['think', 'The rest of them are addressed to the sea. The sea never writes back and they keep going anyway.'],
          ],
        },
      ],
    },

    /* ================================================================= The Shrug (named Unsent, bible 6.11) */
    {
      id: 'kept_shrug',
      x: 19,
      y: 22,
      pages: [
        {
          cond: { var: ['seg1_kept', '>', 0] },
          sprite: { enemy: 'kept_shrug' },
          trigger: 'touch',
          move: { type: 'chase', sight: 4 },
          commands: [
            ['narrate', 'Something grey-blue comes sideways across the sand with one shoulder up.'],
            ['battle', 'troop_kept_1', {
              canEscape: true,
              onPeace: [
                ['call', 'ce_late_said_1'],
                ['say', 'odo', 'quiet', '...Roger. {w:15}Thanks for telling me. Over.'],
              ],
              onWin: [
                ['narrate', 'It goes quiet. It does not go away; it only stops for now.'],
                ['say', 'lin', 'neutral', "You can't hush your own for long. I've read the tide table. It comes back in."],
                ['erase', 'kept_shrug'],
              ],
              onLose: 'gameover',
            }],
          ],
        },
      ],
    },

    /* ================================================================= dressing with a voice */
    {
      id: 'filing_cliff',
      x: 25,
      y: 11,
      pages: [
        {
          cond: null,
          sprite: null,
          trigger: 'action',
          commands: [
            ['narrate', 'The pigeonholes are filing themselves. Letters hop up two rows, think better of it, and hop back.'],
            ['think', 'Nobody is sorting them. They are just very busy.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: null,
          trigger: 'action',
          commands: [
            ['think', 'One of them has been going up and down the same two rows since we got here.'],
            ['if', { flag: 'pim_joined' }, [
              ['say', 'pim', 'neutral', 'That one is a draft. Drafts do that.'],
            ], []],
          ],
        },
      ],
    },
    {
      id: 'sack_leaning',
      x: 30,
      y: 17,
      pages: [
        {
          cond: null,
          sprite: null,
          trigger: 'action',
          commands: [
            ['think', 'A mail sack, tied at the neck, fat as a seal.'],
            ['if', { flag: 'pim_joined' }, [
              ['say', 'pim', 'nosy', 'Shall I read them? {w:20}I can read them. {w:15}I am going to read them.'],
              ['say', 'lin', 'stern', 'Pim.'],
              ['say', 'pim', 'neutral', '...I will read one quietly to myself.'],
            ], []],
          ],
        },
      ],
    },
  ],

  onEnter: [
    ['if', { notFlag: 'sorting_shallows_seen' }, [
      ['setFlag', 'sorting_shallows_seen', true],
      ['think', 'Pale sand. Paper instead of seaweed.'],
      ['think', 'The letters are filing themselves. Badly, but with feeling.'],
      ['say', 'odo', 'boast', 'Post office. Underwater. No water. {w:10}Over.'],
      ['say', 'lin', 'neutral', 'Two things. One: nothing here is wet. Two: I would like that to bother me more than it does.'],
    ], []],
  ],
});

/* =================================================================================================
 * Helper common events for the Sorting puzzle (bible 8.1). Registered here so nobody else's file
 * has to change; ids are prefixed `ss_`.
 * ============================================================================================== */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};
  G.DATA.commonEvents = G.DATA.commonEvents || {};

  /** Wrong bin: the held letter hops back to where it came from, in a huff. */
  const home = [];
  for (let i = 1; i <= 6; i++) {
    home.push(['if', { var: ['sort_carry', '==', i] }, [['setFlag', 'sort_l' + i + '_taken', false]], []]);
  }
  home.push(['setVar', 'sort_carry', '=', 0]);
  home.push(['if', { flag: 'pim_joined' }, [
    ['say', 'pim', 'blurt', "Misfiled! It's gone home in a huff."],
  ], [
    ['narrate', 'The letter wriggles out of the slot and goes home in a huff.'],
  ]]);

  Object.assign(G.DATA.commonEvents, {
    ss_letter_home: {
      name: 'Sorting: a misfiled letter goes home',
      commands: home,
    },

    /** Right bin: count it, and open the drawer wall at six. */
    ss_sorted: {
      name: 'Sorting: check whether the filing is done',
      commands: [
        ['if', { var: ['sort_count', '>=', 6] }, [
          ['setFlag', 'sort_done', true],
          ['wait', 20],
          ['say', 'lin', 'relieved', 'Six of six. Filed, posted and accounted for.'],
          ['sfx', 'sfx_push'],
          ['shake', 4, 36],
          ['narrate', 'Away in the north-west, a wall of drawers slides back into itself with a sound like a long drawer closing somewhere else.'],
          ['erase', 'gate_a'],
          ['erase', 'gate_b'],
          ['say', 'pim', 'delighted', 'A door made of DRAWERS. That is my favourite kind of door and I have only just thought of it.'],
          ['say', 'odo', 'boast', 'New heading: north-west. Over.'],
        ], [
          ['if', { var: ['sort_count', '==', 5] }, [
            ['say', 'lin', 'neutral', 'Five. One left, and it is not going to file itself. Obviously.'],
          ], []],
        ]],
      ],
    },
  });
})();
