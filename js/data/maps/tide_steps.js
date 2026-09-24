/*
 * tide_steps.js - THE TIDE STEPS (24x32), the hub of the Lull (DESIGN_BIBLE 4.2 row 5).
 *
 * A stone stair that should be under the sea, dropping from the beach through a bright landing (Shelley's
 * postbox shop, the first rock pool, the striking gulls) into a wide sandy plaza where four mail-slot doors
 * wait for their tide. Nothing roams here (bible 8.9). Nobody may climb back up except through the chapter
 * flow: ce_tide_done does the climbing.
 *
 * Owner: lull_1. Flags invented here are prefixed `tide_steps_`.
 */
G.registerMap('tide_steps', {
  name: 'The Tide Steps',
  width: 24,
  height: 32,
  bgm: null,                 /* set in onEnter: the first arrival needs silence for the colour flood */
  ambience: 'amb_lull',
  backdrop: '#1d3b44',
  battleback: 'bb_lull_day',
  tint: null,

  legend: {
    '#': 'reef_rock',
    's': 'stair_stone',
    '.': 'pale_sand',
    '~': 'shallows',
  },

  ground: [
    '########################',   /*  0 */
    '###########sss##########',   /*  1  (12,1) the way up - chapter flow only */
    '##########sssss#########',   /*  2  (12,2) arrival from shingle_beach */
    '##########sssss#########',   /*  3 */
    '#########sssssss########',   /*  4 */
    '#########sssssss########',   /*  5 */
    '########sssssssss#######',   /*  6 */
    '#######ssssssssss#######',   /*  7 */
    '#####..ssssssss..#######',   /*  8 */
    '####................####',   /*  9  the landing */
    '###..................###',   /* 10 */
    '###.....~~~~.........###',   /* 11 */
    '###....~~~~~~........###',   /* 12  the landing pool */
    '###.....~~~~.........###',   /* 13 */
    '#######ssssss###########',   /* 14  the lower stair */
    '#######ssssss###########',   /* 15 */
    '########ssssss##########',   /* 16 */
    '########ssssss##########',   /* 17 */
    '#########ssssss#########',   /* 18 */
    '#########ssssss#########',   /* 19 */
    '######............######',   /* 20  the plaza */
    '####................####',   /* 21 */
    '##....................##',   /* 22 */
    '#......................#',   /* 23 */
    '#......................#',   /* 24  (2,24) west door   (21,24) east door */
    '#...~~~~........~~~~...#',   /* 25 */
    '#..~~~~~~......~~~~~~..#',   /* 26 */
    '#...~~~~.........~~~~..#',   /* 27 */
    '#......................#',   /* 28 */
    '##....................##',   /* 29 */
    '######s#######s####s####',   /* 30  (6,30) slack water  (14,30) undertow  (19,30) pearl slot */
    '########################',   /* 31 */
  ],

  objects: [
    /* the four mail-slot doors, set into the rock; the tile in front of each is the threshold */
    { obj: 'mail_slot_door', x: 0, y: 24 },
    { obj: 'mail_slot_door', x: 22, y: 24 },
    { obj: 'mail_slot_door', x: 6, y: 31 },
    { obj: 'mail_slot_door', x: 14, y: 31 },
    { obj: 'pearl_small', x: 19, y: 31 },

    /* dressing */
    { obj: 'can_post', x: 5, y: 9 },
    { obj: 'can_post', x: 7, y: 20 },
    { obj: 'mail_sack', x: 4, y: 23 },
    { obj: 'mail_sack', x: 17, y: 28 },
    { obj: 'stamp_flower', x: 7, y: 10 },
    { obj: 'stamp_flower', x: 19, y: 12 },
    { obj: 'stamp_flower', x: 3, y: 25 },
    { obj: 'stamp_flower', x: 21, y: 27 },
    { obj: 'stamp_flower', x: 12, y: 21 },
  ],

  overrides: { block: [[7, 12], [13, 10], [10, 21], [22, 23]] },   // right halves of 2-wide event props

  events: [
    /* ================================================================= the way back up */
    {
      id: 'steps_up',
      x: 12,
      y: 1,
      pages: [
        {
          cond: null,
          sprite: null,
          trigger: 'touch',
          commands: [
            /* `tide_steps_may_leave` is never set by this map: climbing out is done by ce_tide_done
             * (CONTENT_CONTRACT section 3). The branch exists so QA can drive the transfer by hand. */
            ['if', { flag: 'tide_steps_may_leave' }, [
              ['transfer', 'shingle_beach', 20, 25, 'up', { fade: 'black' }],
            ], [
              ['think', 'Not yet. The others would worry.'],
            ]],
          ],
        },
      ],
    },

    /* ================================================================= Second-Class Stan (positions 0 and 1) */
    {
      id: 'stan_step',
      x: 12,
      y: 7,
      pages: [
        {
          cond: { var: ['tide', '==', 1] },
          sprite: { obj: 'snail_stan' },
          trigger: 'action',
          move: { type: 'still' },
          commands: [
            ['say', 'stan', null, 'Nearly there.'],
            ['think', 'He is on step six. {w:15}Of forty-four.'],
            ['if', { notSelf: 'A' }, [
              ['setSelf', 'A', true],
              ['setVar', 'stan_talks', '+', 1],
            ], []],
          ],
        },
      ],
    },
    {
      id: 'stan_landing',
      x: 10,
      y: 19,
      pages: [
        {
          cond: { var: ['tide', '==', 2] },
          sprite: { obj: 'snail_stan' },
          trigger: 'action',
          move: { type: 'still' },
          commands: [
            ['say', 'stan', null, 'Nearly there.'],
            ['say', 'odo', 'grin', 'He has moved ELEVEN STEPS since yesterday. That is a personal best. Over.'],
            ['think', 'The parcel says: to whoever is resting here.'],
            ['if', { notSelf: 'A' }, [
              ['setSelf', 'A', true],
              ['setVar', 'stan_talks', '+', 1],
            ], []],
          ],
        },
      ],
    },

    /* ================================================================= the string, on its way down */
    {
      id: 'can_on_the_stair',
      x: 15,
      y: 8,
      pages: [
        {
          cond: null,
          sprite: { obj: 'can_post' },
          trigger: 'action',
          commands: [
            ['think', 'A post with a tin can hung on it, like a lamp nobody lights.'],
            ['think', 'My string goes past it. {w:20}Down.'],
            ['think', 'It has never gone anywhere before.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'can_post' },
          trigger: 'action',
          commands: [
            ['think', 'Still going down. {w:15}Still my string.'],
          ],
        },
      ],
    },

    /* ================================================================= Shelley's postbox shop */
    {
      id: 'shelley',
      x: 17,
      y: 10,
      pages: [
        {
          cond: null,
          sprite: { obj: 'postbox_shelley' },
          trigger: 'action',
          facePlayer: false,
          commands: [
            ['sfx', 'sfx_knock'],
            ['narrate', 'A red postbox, standing in the sand as if it grew there. Two eyestalks come out of the slot. Then a claw.'],
            ['say', 'shelley', null, "We're open. Mind the claw."],
            ['say', 'lin', 'stern', 'Are you a shop, or a crab?'],
            ['say', 'shelley', null, "Yes."],
            ['setSelf', 'A', true],
            ['shop', ['glass_red', 'glass_blue', 'glass_amber', 'glass_green', 'bag_of_chips', 'flask_of_tea', 'stick_of_rock', 'tide_table_page', 'darned_patch']],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'postbox_shelley' },
          trigger: 'action',
          facePlayer: false,
          commands: [
            ['say', 'shelley', null, 'No refunds. No returns. {w:15}That\'s the whole problem with this place, if you think about it.'],
            ['shop', ['glass_red', 'glass_blue', 'glass_amber', 'glass_green', 'bag_of_chips', 'flask_of_tea', 'stick_of_rock', 'tide_table_page', 'darned_patch']],
          ],
        },
      ],
    },

    /* ================================================================= secret bench 1 (behind the postbox) */
    {
      id: 'bench_one',
      x: 19,
      y: 9,
      pages: [
        {
          cond: null,
          sprite: { obj: 'bench_lull' },
          trigger: 'action',
          commands: [
            ['narrate', 'A bench, tucked round the back of the postbox where nobody posts anything.'],
            ['sfx', 'sfx_feel_down'],
            ['wait', 20],
            ['say', 'odo', 'boast', 'Medal for sitting. Awarded to: everyone. Over.'],
            ['say', 'lin', 'neutral', 'We have six minutes.'],
            ['if', { flag: 'pim_joined' }, [
              ['say', 'pim', 'delighted', "I've never sat. It's just standing, but lower!"],
            ], []],
            ['wait', 30],
            ['think', 'This is all right.'],
            ['setFlag', 'bench_1', true],
            ['wait', 20],
          ],
        },
        {
          cond: { flag: 'bench_1' },
          sprite: { obj: 'bench_lull' },
          trigger: 'action',
          commands: [
            ['narrate', 'The bench is still there. It is very good at that.'],
            ['say', 'odo', 'grin', 'Second medal. For sitting AGAIN. Over.'],
          ],
        },
      ],
    },

    /* ================================================================= the rock pool (save / rest / skim) */
    {
      id: 'pool_steps',
      x: 5,
      y: 12,
      pages: [
        {
          cond: null,
          sprite: { obj: 'rock_pool' },
          trigger: 'action',
          commands: [
            ['narrate', 'A rock pool, bright as a jam jar. Something in it is pretending to be a stone.'],
            ['say', 'lin', 'stern', 'Item one: we can stop here. Item two: we can rest here.'],
            ['say', 'lin', 'neutral', 'Item three: if one of us gets a pebble stuck in a pocket, somebody ELSE skims it out. Not the owner. That is the rule and I did not make it.'],
            ['say', 'odo', 'boast', 'I am excellent at skimming. Seven. Over.'],
            ['think', "Pop's record is nine."],
            ['setFlag', 'tide_steps_pool_shown', true],
            ['custom', 'rock_pool', { joke: 'A limpet watches you save. It has seen things.', id: 'pool_tide_steps' }],
          ],
        },
        {
          cond: { flag: 'tide_steps_pool_shown' },
          sprite: { obj: 'rock_pool' },
          trigger: 'action',
          commands: [
            ['custom', 'rock_pool', { joke: 'A limpet watches you save. It has seen things.', id: 'pool_tide_steps' }],
          ],
        },
      ],
    },

    /* ================================================================= the striking gulls */
    {
      id: 'gull_a',
      x: 11,
      y: 10,
      pages: [
        {
          cond: null,
          sprite: { obj: 'gull_picket' },
          trigger: 'action',
          move: { type: 'still' },
          commands: [
            ['narrate', 'A gull on strike. The placard says: {big}SQUAWK{/big}'],
            ['think', 'Underneath, in small careful pencil: (and conditions).'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'gull_picket' },
          trigger: 'action',
          move: { type: 'still' },
          commands: [
            ['think', 'It tilts the placard so I can read it better. {w:15}Solidarity, probably.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 4] },
          sprite: { obj: 'gull_picket' },
          trigger: 'action',
          move: { type: 'still' },
          commands: [
            ['narrate', 'The placard is blank now. The gull holds it up anyway.'],
            ['think', 'Even the shouting has gone quiet down here.'],
          ],
        },
      ],
    },
    {
      id: 'gull_b',
      x: 8,
      y: 21,
      pages: [
        {
          cond: null,
          sprite: { obj: 'gull_picket' },
          trigger: 'action',
          move: { type: 'still' },
          commands: [
            ['narrate', 'Placard: {big}SQUAWK{/big}{w:10}\nFootnote: (rates, mainly).'],
            ['say', 'odo', 'boast', 'OI. What are you striking ABOUT. {w:10}Over.'],
            ['emote', 'this', '...'],
            ['think', "He waits after 'Over'. Even for a gull."],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'gull_picket' },
          trigger: 'action',
          move: { type: 'still' },
          commands: [
            ['narrate', 'It turns the placard over. The back says: {big}SQUAWK{/big} (cont.)'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 4] },
          sprite: { obj: 'gull_picket' },
          trigger: 'action',
          move: { type: 'still' },
          commands: [
            ['narrate', 'The gull lowers the placard when it sees us, the way people stop a conversation.'],
          ],
        },
      ],
    },
    {
      id: 'gull_c',
      x: 15,
      y: 23,
      pages: [
        {
          cond: null,
          sprite: { obj: 'gull_picket' },
          trigger: 'action',
          move: { type: 'still' },
          commands: [
            ['narrate', 'Placard: {big}SQUAWK{/big}{w:10}\nFootnote: (no, we will not spell it out).'],
            ['say', 'lin', 'neutral', 'Unofficial action. No notice given. I could write that up.'],
            ['say', 'odo', 'grin', 'Do NOT write it up. They have chips. Over.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'gull_picket' },
          trigger: 'action',
          move: { type: 'still' },
          commands: [
            ['think', 'It has added a second placard for a friend who has not turned up.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 4] },
          sprite: { obj: 'gull_picket' },
          trigger: 'action',
          move: { type: 'still' },
          commands: [
            ['narrate', 'The second placard is still waiting for its gull.'],
          ],
        },
      ],
    },

    /* ================================================================= dressing with a voice */
    {
      id: 'sack_plaza',
      x: 18,
      y: 10,
      pages: [
        {
          cond: null,
          sprite: { obj: 'mail_sack' },
          trigger: 'action',
          commands: [
            ['think', 'A mail sack, full and tied shut. It leans against the rock like it has been told to wait there.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'mail_sack' },
          trigger: 'action',
          commands: [
            ['think', 'Still full. {w:15}Still waiting. Fine. Same.'],
          ],
        },
      ],
    },
    {
      id: 'flower_glass',
      x: 19,
      y: 25,
      pages: [
        {
          cond: null,
          sprite: null,
          trigger: 'action',
          commands: [
            ['narrate', 'A stamp-flower grows out of the shallows, one pale blue lighthouse per petal.'],
            ['think', "Something's caught in the roots."],
            ['sfx', 'sfx_item_get'],
            ['giveItem', 'glass_green', 1],
            ['think', 'Green. {w:15}Well I never.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: null,
          trigger: 'action',
          commands: [
            ['think', 'The flower has gone back to pretending it is a flower.'],
          ],
        },
      ],
    },

    /* ================================================================= Postmaster Gull's lost-property window */
    {
      id: 'lost_property',
      x: 20,
      y: 23,
      pages: [
        {
          cond: { flag: 'gull_hushed' },
          sprite: { obj: 'mail_slot_door' },
          trigger: 'action',
          commands: [
            ['think', 'A shutter, pulled down and dented from the inside.'],
            ['think', 'Somebody has chalked WORK TO RULE on it. Underneath, in the same hand, smaller: (sorry).'],
          ],
        },
        {
          cond: { flag: 'gull_delivered' },
          sprite: { enemy: 'boss_postmaster_gull' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'postmaster_gull', null, 'LOST PROPERTY. {w:10}Form 12-B, please.'],
            ['say', 'postmaster_gull', null, "...You still don't have a 12-B. {w:15}Nobody has a 12-B. I have thought about this a great deal."],
            ['if', { notSelf: 'A' }, [
              ['setSelf', 'A', true],
              ['say', 'postmaster_gull', null, 'Handed in this morning. Amber. No name on it. The crab was very firm that it was not his.'],
              ['sfx', 'sfx_item_get'],
              ['giveItem', 'glass_amber', 1],
              ['say', 'postmaster_gull', null, "Somebody had a nice evening once. Take it. It's been sat in a drawer long enough."],
            ], [
              ['say', 'postmaster_gull', null, 'Today: one odd boot, a whelk with opinions, and a letter addressed to "You Know Who You Are".'],
              ['think', 'Half this town could claim that one.'],
            ]],
          ],
        },
      ],
    },

    /* ================================================================= the four doors and the pearl slot */
    {
      id: 'door_sorting',
      x: 2,
      y: 24,
      pages: [
        {
          cond: null,
          sprite: null,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_door_locked'],
            ['think', 'Shut, and the slot is stiff with sand. Not this tide.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 1] },
          sprite: null,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_door_open'],
            ['transfer', 'sorting_shallows', 38, 15, 'left', { fade: 'black' }],
          ],
        },
      ],
    },
    {
      id: 'door_blare',
      x: 21,
      y: 24,
      pages: [
        {
          cond: null,
          sprite: null,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_door_locked'],
            ['think', 'A slot with a horn painted over it. Shut.'],
            ['think', 'Something behind it is already shouting. It can wait.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 2] },
          sprite: null,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_door_open'],
            ['transfer', 'blare_reef', 1, 14, 'right', { fade: 'black' }],
          ],
        },
      ],
    },
    {
      id: 'door_slack',
      x: 6,
      y: 30,
      pages: [
        {
          cond: null,
          sprite: null,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_door_locked'],
            ['think', 'Shut. A card in the slot, in very neat handwriting: BACK SOON.'],
            ['think', 'It has been soon for a while.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 3] },
          sprite: null,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_door_open'],
            ['transfer', 'slack_water', 18, 1, 'down', { fade: 'black' }],
          ],
        },
      ],
    },
    {
      id: 'door_undertow',
      x: 14,
      y: 30,
      pages: [
        {
          cond: null,
          sprite: null,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_door_locked'],
            ['think', 'Shut. Cold air comes out of the slot.'],
            ['think', 'It smells like a shed at night. I am not ready for that, thanks.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 4] },
          sprite: null,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_door_open'],
            ['transfer', 'undertow_light', 16, 2, 'down', { fade: 'black' }],
          ],
        },
      ],
    },
    {
      id: 'slot_pearl',
      x: 19,
      y: 30,
      pages: [
        {
          cond: null,
          sprite: null,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_door_locked'],
            ['think', 'A slot too small for a person. Something pale moves behind it, politely.'],
          ],
        },
        {
          cond: { flag: 'pearl_bed_reached' },
          sprite: null,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_transfer'],
            ['transfer', 'pearl_bed', 16, 21, 'up', { fade: 'white' }],     // (16,22) is the way back; landing there bounced
          ],
        },
      ],
    },
  ],

  onEnter: [
    ['if', { notFlag: 'tide_steps_arrived' }, [
      /* -------- first arrival: the colour floods in (bible 5.3) -------- */
      ['setFlag', 'tide_steps_arrived', true],
      ['tint', [150, 150, 155, 0.5], 1],
      ['wait', 24],
      ['think', 'Twenty-two steps. {w:15}Then twenty-two more.'],
      ['think', 'The sea should be here. The sea is somewhere else.'],
      ['wait', 16],
      ['sfx', 'sfx_reverse_swell'],
      ['flash', '#ffffff', 40],
      ['tint', null, 48],
      ['bgm', 'bgm_lull_bright'],
      ['wait', 40],
      ['think', '...{w:25}Oh.'],
      ['say', 'odo', 'boast', 'Captain. Confirming the sea is INSIDE OUT. {w:10}Over.'],
      ['say', 'lin', 'stern', 'Three things. One: we are below the tide line. Two: it is dry. Three: I would like somebody to account for the colours.'],
      ['say', 'odo', 'grin', 'Crayons. Next question. Over.'],
      ['think', 'Everything down here is coloured right to the edges.\nNobody does that. Not past about seven.'],
      ['camera', [12, 26], 90],
      ['wait', 30],
      ['camera', 'player', 60],
      ['say', 'lin', 'neutral', 'Doors. Four of them, and a slot. Only the one on the left has any give in it.'],
      ['say', 'odo', 'boast', 'Then we take the left one. Leading. Over.'],
      ['think', 'He waits after that. {w:20}I could say it.\nI go down the steps instead.'],
    ], [
      ['bgm', 'bgm_lull_bright'],
    ]],
  ],
});
