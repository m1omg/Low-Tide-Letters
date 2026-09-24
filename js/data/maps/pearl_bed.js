/*
 * pearl_bed.js - The Pearl Bed (DESIGN_BIBLE 4.2 #11, 5.7, 8.5, 8.6; CONTENT_CONTRACT 2).
 *
 * Tide 5. Everything down here has been coated: envelopes, notes, the town's whole century of
 * not-saying, smoothed over until it is beautiful and means nothing. The bed is a wide white floor
 * with two curved corridors running round a walled chamber; in the chamber, Nacre, and behind Nacre
 * an ordinary bedroom door standing open on the dark.
 *
 * Fixed tiles (CONTENT_CONTRACT 2 and 5):
 *   (16,2)  north exit trigger  -> undertow_light (16,26) up
 *   (16,3)  arrival from undertow_light (passable, no touch event)
 *   (16,22) pearl slot trigger  -> tide_steps (19,29) up
 *   (16,21) arrival from tide_steps (passable, no touch event)
 *   (14,20) rock-pool resume tile, facing up (the pool itself sits at (14,19))
 *
 * The big scenes live in js/data/common_events_finale.js so the command lists here stay readable.
 * Flags invented here carry the map prefix `pb_`.
 */
(function () {
  'use strict';
  const G = window.G;

  /* ---------------------------------------------------------------- rub spots (bible 8.6) ----
   * Eight pearls you can rub. The coating comes away like pencil frottage and shows one line of
   * whatever the town put under it; the pearl stays. Rubbing shows. It does not fix.
   */
  const RUBS = [
    { x: 5, y: 7, item: 'glass_blue', scrap: '"—I never told him I was proud—"', again: 'Still proud. Still not told.' },
    { x: 8, y: 5, item: 'glass_amber', scrap: '"—sorry about the wedding—"', again: 'Somebody is sorry about a wedding. That is all we get.' },
    { x: 24, y: 6, item: 'glass_red', scrap: '"—the dog was old. It was not your fault—"', again: 'It was not. Somebody should have said so with their mouth.' },
    { x: 27, y: 10, item: 'glass_green', scrap: '"—I kept all your school photos. Even the bad one—"', again: 'Especially the bad one, I bet.' },
    { x: 6, y: 16, item: 'glass_amber', scrap: '"—it was me who broke the gate, in 1979—"', again: 'Forty-odd years of being quietly guilty about a gate.' },
    { x: 10, y: 20, item: 'glass_green', scrap: '"—two spoons of vinegar, not one. Tell Bren—"', again: 'A recipe, kept a whole lifetime in case it was a bother.' },
    { x: 22, y: 17, item: 'glass_blue', scrap: '"—I would have come if you had asked me—"', again: 'Both of them waiting for the other one to start. Classic.' },
    { x: 23, y: 21, item: 'glass_red', scrap: '"—I am not cross with you. I am just quiet—"', again: '...Oh.{w:20} That one is nearly mine.' },
  ];

  /**
   * Builds one rub-spot event: first rub shows the scrap and gives a Chip, later rubs show it again.
   * @param {number} i index into RUBS
   * @returns {object} map event definition
   */
  function rubEvent(i) {
    const r = RUBS[i];
    return {
      id: 'rub_' + (i + 1),
      x: r.x,
      y: r.y,
      pages: [
        {
          cond: null,
          sprite: { obj: 'pearl_small' },
          trigger: 'action',
          commands: [
            ['if', { notFlag: 'pb_rub_taught' }, [
              ['setFlag', 'pb_rub_taught', true],
              ['say', 'pim', 'nosy', 'A smooth one!{w:15} Rub it. Gently, like a brass plaque.'],
              ['say', 'lin', 'stern', 'We are not vandalising it. We are reading it.'],
              ['think', 'Those are the same thing with different manners.'],
            ], []],
            ['sfx', 'sfx_erase'],
            ['wait', 34],
            ['narrate', 'The coating comes away under her thumb, like pencil.\n{small}' + r.scrap + '{/small}'],
            ['giveItem', r.item, 1],
            ['setVar', 'rub_count', '+', 1],
            ['setSelf', 'A', true],
            ['if', { var: ['rub_count', '==', 6] }, [
              ['sfx', 'sfx_key_item'],
              ['narrate', 'Something small and round comes away with the coating. A button.'],
              ['giveItem', 'pearl_button', 1],
              ['say', 'lin', 'stern', 'Item one: keep it.{w:20} Item two: do not become it.'],
            ], []],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'pearl_small' },
          trigger: 'action',
          commands: [
            ['narrate', '{small}' + r.scrap + '{/small}'],
            ['think', r.again],
          ],
        },
      ],
    };
  }

  /* ---------------------------------------------------------------- the Pearl Doors (8.5) ----
   * Four stamp-flowers, the only colour left in the bed. Pressed in the order of the borders of
   * Nacre's four slips as they were received: blue, amber, red, green.
   */
  const FLOWERS = [
    { id: 'flower_blue', x: 18, y: 14, step: 0, colour: 'blue', look: 'A stamp-flower with blue petals. The only blue left down here.' },
    { id: 'flower_amber', x: 12, y: 14, step: 1, colour: 'amber', look: 'A stamp-flower with amber petals, holding very still.' },
    { id: 'flower_red', x: 20, y: 14, step: 2, colour: 'red', look: 'A stamp-flower with red petals. Somebody was cross once.' },
    { id: 'flower_green', x: 14, y: 14, step: 3, colour: 'green', look: 'A stamp-flower with green petals. Well I never.' },
  ];

  /**
   * One Pearl Door button. Right one in the sequence: it opens. Wrong one: everything shuts again,
   * politely, and nothing is lost but the order.
   * @param {object} f entry of FLOWERS
   * @returns {object} map event definition
   */
  function flowerEvent(f) {
    const ok = [
      ['sfx', 'sfx_switch'],
      ['setVar', 'pearl_seq', '=', f.step + 1],
      ['narrate', 'The ' + f.colour + ' flower opens its petals.\nSomething behind the wall clicks, very politely.'],
    ];
    if (f.step === 3) {
      ok.push(['call', 'ce_pearl_doors_open']);
    }
    return {
      id: f.id,
      x: f.x,
      y: f.y,
      pages: [
        {
          cond: null,
          sprite: { obj: 'stamp_flower' },
          solid: false,
          trigger: 'action',
          commands: [
            ['narrate', f.look],
            ['if', { var: ['pearl_seq', '==', f.step] }, ok, [
              ['sfx', 'sfx_error'],
              ['setVar', 'pearl_seq', '=', 0],
              ['narrate', 'The petals fold shut. So do the other three.'],
              ['say', 'pim', 'puzzled', 'Ah. Back to the beginning. It is not cross, it is just filing.'],
            ]],
          ],
        },
        {
          cond: { flag: 'pearl_doors_open' },
          sprite: { obj: 'stamp_flower' },
          solid: false,
          trigger: 'action',
          commands: [
            ['narrate', 'The ' + f.colour + ' flower is open, and staying open.'],
          ],
        },
      ],
    };
  }

  /**
   * A roaming Pearl Drip (bible 8.9): visible, slow, chases on sight 4, gone for good once dealt with.
   * @param {string} id event id
   * @param {number} x tile
   * @param {number} y tile
   * @param {string} troop troop id
   * @returns {object} map event definition
   */
  function roamer(id, x, y, troop) {
    return {
      id: id,
      x: x,
      y: y,
      enemy: { troop: troop, sprite: 'pearl_drip', move: { type: 'chase', sight: 4 }, respawn: false },
    };
  }

  /**
   * A coated parcel in a corner of the bed: one item, once.
   * @param {string} id event id
   * @param {number} x tile
   * @param {number} y tile
   * @param {string} item item id
   * @param {string} text what is under the coating
   * @returns {object} map event definition
   */
  function findEvent(id, x, y, item, text) {
    return {
      id: id,
      x: x,
      y: y,
      pages: [
        {
          cond: null,
          sprite: { obj: 'letter_pile' },
          trigger: 'action',
          commands: [
            ['sfx', 'sfx_chest_open'],
            ['narrate', text],
            ['giveItem', item, 1],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'letter_pile' },
          trigger: 'action',
          commands: [
            ['think', 'Empty. Well. Emptier.'],
          ],
        },
      ],
    };
  }

  const events = [
    /* ================================================================ ways in and out ======== */
    {
      id: 'exit_north',
      x: 16,
      y: 2,
      pages: [{
        cond: null,
        sprite: null,
        trigger: 'touch',
        commands: [
          ['sfx', 'sfx_transfer'],
          ['transfer', 'undertow_light', 16, 26, 'up', { fade: 'black' }],
        ],
      }],
    },
    {
      id: 'exit_pearl_slot',
      x: 16,
      y: 22,
      pages: [{
        cond: null,
        sprite: null,
        trigger: 'touch',
        commands: [
          ['sfx', 'sfx_door_open'],
          ['narrate', 'A brass flap in the floor of the world, with the stairs on the other side of it.'],
          ['transfer', 'tide_steps', 19, 29, 'up', { fade: 'black' }],
        ],
      }],
    },

    /* ================================================================ the rock pool ========== */
    {
      id: 'rock_pool',
      x: 14,
      y: 19,
      pages: [{
        cond: null,
        sprite: { obj: 'rock_pool' },
        trigger: 'action',
        commands: [
          ['custom', 'rock_pool', {
            id: 'pool_pearl_bed',
            joke: 'The limpet in this one has been polished. It does not look grateful.',
          }],
        ],
      }],
    },

    /* ================================================================ Second-Class Stan ====== */
    {
      id: 'stan',
      x: 17,
      y: 19,
      pages: [
        {
          cond: null,
          sprite: { obj: 'snail_stan' },
          trigger: 'action',
          facePlayer: true,
          commands: [
            ['say', 'stan', null, 'Here we are.'],
            ['wait', 24],
            ['say', 'stan', null, 'Forty years.{w:30} Sign here.'],
            ['say', 'odo', 'boast', 'SIGNING. O. Brill. That is B-R-I-L-L. Over.'],
            ['say', 'lin', 'stern', 'That parcel is not addressed to us.'],
            ['say', 'stan', null, 'It is addressed to whoever is resting here.'],
            ['setVar', 'stan_talks', '+', 1],
            ['setSelf', 'A', true],
            ['if', { var: ['stan_talks', '>=', 5] }, [
              ['sfx', 'sfx_key_item'],
              ['say', 'stan', null, 'You lot said hello at every tide. That is a kind of address.'],
              ['giveItem', 'second_class_stamp', 1],
              ['think', 'Second class.{w:20} Forty years.{w:20} It got here.'],
            ], [
              ['narrate', 'He leans the parcel against the rock pool, for whoever is resting here.'],
              ['think', 'We only met him properly at the end. That is usually how it goes.'],
            ]],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'snail_stan' },
          trigger: 'action',
          facePlayer: true,
          commands: [
            ['say', 'stan', null, 'Nearly there.'],
            ['think', 'He has arrived. He says it anyway.{w:20} Fair enough.'],
          ],
        },
      ],
    },

    /* ================================================================ the Pearl Doors ======== */
    flowerEvent(FLOWERS[0]),
    flowerEvent(FLOWERS[1]),
    flowerEvent(FLOWERS[2]),
    flowerEvent(FLOWERS[3]),
    {
      id: 'pearl_gate',
      x: 16,
      y: 12,
      pages: [
        {
          cond: null,
          sprite: { obj: 'pearl_small' },
          solid: true,
          trigger: 'action',
          commands: [
            ['narrate', 'The gap in the wall is filled with pearl, smooth as the back of a spoon.'],
            ['if', { hasItem: 'nacres_slips' }, [
              ['say', 'lin', 'stern', 'Four slips. Four borders.{w:15} Blue, amber, red, green, in the order it handed them to us.'],
              ['say', 'odo', 'grin', 'It gave us the code. In WRITING. Over.'],
            ], [
              ['say', 'pim', 'puzzled', 'Four flowers, four colours.{w:15} I do love a form.'],
            ]],
          ],
        },
        {
          cond: { flag: 'pearl_doors_open' },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['end'],
          ],
        },
      ],
    },

    /* ================================================================ Nacre ================== */
    {
      id: 'nacre_offer',
      x: 16,
      y: 11,
      pages: [
        {
          cond: { notFlag: 'nacre_offer_seen' },
          sprite: null,
          trigger: 'touch',
          commands: [
            ['call', 'ce_nacre_offer'],
          ],
        },
        {
          cond: { flag: 'nacre_offer_seen' },
          sprite: null,
          trigger: 'action',
          commands: [
            ['end'],
          ],
        },
      ],
    },
    {
      id: 'nacre',
      x: 16,
      y: 8,
      pages: [
        {
          cond: null,
          sprite: { enemy: 'boss_nacre' },
          solid: true,
          trigger: 'action',
          commands: [
            ['narrate', 'The shell stands open a hand\'s width. Inside: soft darkness, and a glow.'],
          ],
        },
        {
          cond: { flag: 'nacre_offer_seen' },
          sprite: { enemy: 'boss_nacre' },
          solid: true,
          trigger: 'action',
          commands: [
            ['call', 'ce_nacre_fight'],
          ],
        },
        {
          cond: { any: [{ flag: 'nacre_delivered' }, { flag: 'nacre_hushed' }] },
          sprite: { enemy: 'boss_nacre' },
          solid: true,
          trigger: 'action',
          commands: [
            ['if', { flag: 'nacre_delivered' }, [
              ['narrate', 'The shell is open all the way. It has not been open in two hundred years, and it is not sure what to do with its face.'],
              ['say', 'pim', 'delighted', 'You are very good at keeping things. You are not to do it any more, though.'],
            ], [
              ['narrate', 'The shell is shut. The white string runs in through the hinge and does not come out.'],
              ['say', 'lin', 'tired', 'It is not hurt. It is shut.{w:20} Those are different, and we did the second one.'],
            ]],
          ],
        },
      ],
    },
    {
      id: 'bedroom_door',
      x: 16,
      y: 6,
      pages: [
        {
          cond: null,
          sprite: { obj: 'bedroom_door' },
          solid: true,
          trigger: 'action',
          commands: [
            ['narrate', 'An ordinary white bedroom door, standing on its own in a seabed, ajar on the dark.'],
            ['say', 'pim', 'puzzled', 'It will not open while it is being watched.{w:20} I do understand that.'],
          ],
        },
        {
          cond: { any: [{ flag: 'nacre_delivered' }, { flag: 'nacre_hushed' }] },
          sprite: { obj: 'bedroom_door' },
          solid: true,
          trigger: 'action',
          commands: [
            ['if', { flag: 'other_can_answered' }, [
              ['narrate', 'The room beyond is dark and quiet and nobody is calling.'],
              ['think', 'Good. Let it be quiet.'],
              /* after "Not yet" the question is open again: every zone is, that is the point of B */
              ['if', { var: ['final_choice', '==', 2] }, [
                ['wait', 20],
                ['say', 'pim', 'brave', 'You can ask me again, you know.{w:20} I have not gone anywhere. Letters keep.'],
                ['call', 'ce_pim_question'],
              ], []],
            ], [
              ['call', 'ce_other_can'],
            ]],
          ],
        },
      ],
    },

    /* ================================================================ rub spots ============== */
    rubEvent(0), rubEvent(1), rubEvent(2), rubEvent(3),
    rubEvent(4), rubEvent(5), rubEvent(6), rubEvent(7),

    /* ================================================================ roamers (6.13, 8.9) === */
    roamer('drip_a', 8, 8, 'troop_drip_pair'),
    roamer('drip_b', 24, 11, 'troop_drip_pair'),
    roamer('drip_c', 5, 15, 'troop_drip_static'),
    roamer('drip_d', 26, 16, 'troop_drip_static'),
    {
      id: 'kept_5',
      x: 16,
      y: 17,
      pages: [{
        cond: { var: ['seg5_kept', '>', 0] },
        sprite: { enemy: 'kept_dot_dot_dot' },
        solid: false,
        trigger: 'touch',
        move: { type: 'chase', sight: 4 },
        commands: [
          ['battle', 'troop_kept_5', {
            canEscape: false,
            bgm: 'bgm_battle',
            onPeace: [
              ['call', 'ce_late_said_5'],
              ['erase', 'kept_5'],
            ],
            onWin: [
              ['narrate', 'It goes quiet. Quiet is not the same as gone; it will be here when they come back.'],
              ['erase', 'kept_5'],
            ],
            onLose: 'gameover',
          }],
        ],
      }],
    },

    /* ================================================================ finds ================== */
    findEvent('find_west', 3, 14, 'flask_of_tea',
      'A parcel, coated to a smooth white lump. Inside, still warm somehow: a flask of tea.'),
    findEvent('find_east', 28, 16, 'stick_of_rock',
      'Under the coating: a stick of rock with PELLOW\'S REACH all the way through it.'),

    /* ================================================================ things to poke ========= */
    {
      id: 'letter_brick',
      x: 13,
      y: 16,
      pages: [
        {
          cond: null,
          sprite: { obj: 'letter_pile' },
          trigger: 'action',
          commands: [
            ['think', 'A stack of letters, coated into one brick. No edges. Nothing to open.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'letter_pile' },
          trigger: 'action',
          commands: [
            ['think', 'Still a brick. A very nice brick.'],
          ],
        },
      ],
    },
    {
      id: 'sealed_parcel',
      x: 18,
      y: 19,
      pages: [
        {
          cond: null,
          sprite: { obj: 'letter_pile' },
          trigger: 'action',
          commands: [
            ['think', 'Addressed. Stamped. Sealed. Pearled.{w:20} Four kinds of finished, and not one of them is sent.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'letter_pile' },
          trigger: 'action',
          commands: [
            ['say', 'pim', 'nosy', 'I can almost read it.{w:20} ...No. That is the pearl I am reading. It says nothing, beautifully.'],
          ],
        },
      ],
    },
    {
      id: 'heap_big',
      x: 20,
      y: 13,
      pages: [
        {
          cond: null,
          sprite: { obj: 'pearl_heap' },
          trigger: 'action',
          commands: [
            ['narrate', 'A mound of envelopes, coated together into one smooth hill. Somewhere in there, a corner sticks up.'],
            ['think', 'Two hundred years of not making a fuss. It is honestly quite pretty.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'pearl_heap' },
          trigger: 'action',
          commands: [
            ['say', 'odo', 'quiet', 'How many of these are ours, do you reckon?{w:25} ...Do not answer that. Over.'],
          ],
        },
      ],
    },
    {
      id: 'little_drip',
      x: 21,
      y: 20,
      pages: [
        {
          cond: null,
          sprite: { enemy: 'pearl_drip' },
          solid: true,
          trigger: 'action',
          facePlayer: true,
          commands: [
            ['narrate', 'A very small Pearl Drip is coating a bus ticket, with its tongue out.'],
            ['think', 'That ticket is from before I was born. It is not going anywhere.'],
            ['setVar', 'pb_drip_talks', '+', 1],
          ],
        },
        {
          cond: { var: ['pb_drip_talks', '>=', 1] },
          sprite: { enemy: 'pearl_drip' },
          solid: true,
          trigger: 'action',
          facePlayer: true,
          commands: [
            ['narrate', 'It has moved on to a bottle top. It works with enormous patience.'],
            ['say', 'pim', 'nosy', 'Excuse me. Do you ever read them first?{w:25} ...No. Right. No.'],
            ['setVar', 'pb_drip_talks', '+', 1],
          ],
        },
        {
          cond: { var: ['pb_drip_talks', '>=', 2] },
          sprite: { enemy: 'pearl_drip' },
          solid: true,
          trigger: 'action',
          facePlayer: true,
          commands: [
            ['narrate', 'It has started on its own left foot.'],
            ['think', 'Nobody down here knows when to stop.{w:20} Including me, probably.'],
          ],
        },
      ],
    },
    {
      id: 'the_hole',
      x: 12,
      y: 18,
      pages: [{
        cond: { notSelf: 'A' },
        sprite: null,
        trigger: 'touch',
        commands: [
          ['setSelf', 'A', true],
          ['think', 'A hole in the bed. The pearl stopped here.{w:25} Nobody stopped it. It just stopped.'],
          ['say', 'lin', 'tired', 'Even this place gets tired.{w:20} Noted. Filed. Moving on.'],
        ],
      }],
    },
  ];

  G.registerMap('pearl_bed', {
    name: 'The Pearl Bed',
    width: 32,
    height: 24,
    bgm: 'bgm_undertow',
    ambience: 'amb_void',
    backdrop: '#141018',
    battleback: 'bb_pearl_bed',
    tint: [241, 238, 240, 0.10],
    start: { x: 16, y: 3, dir: 'down' },

    legend: {
      p: 'pale_sand',      /* T2: pearl_floor */
      e: 'envelope_paper',
      r: 'reef_rock',      /* T2: nacre_wall */
      w: 'deep_water',
    },

    ground: [
      'wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww',
      'wwwwwrrrrrrrrrrrrrrrrrrrrrrwwwww',
      'wwwwrrrrrrrrrrppppprrrrrrrrrwwww',
      'wwwrrrpppppppppppppppppppprrrwww',
      'wwrrrpppppppppppppppppppppprrwww',
      'wwrrppppppprrrrrrrrrrrpppppprrww',
      'wrrrppppppprppppppppprppeeepprrw',
      'wrrpppppppprppppppppprpeeeppprrw',
      'rrrpppppppprppppppppprppppppprrr',
      'rrrpeeepppprppppppppprppppppprrr',
      'wwrpppppppprppppppppprppppppprww',
      'wwrpppppppprppppppppprppppppprww',
      'wwrpppppppprrrrrprrrrrppppppprww',
      'wwrpppppppppeeeeeeppppppppppprww',
      'wrrppppppppeeeeeeeepppppppppprrw',
      'rrpppppppppppeeeeppppppppppppprr',
      'rrpppeeeepppppppppppppeeeepppprr',
      'rrppeeeeppwwpppppppppppeeeeppprr',
      'wrrppeeeppwwppppppppppppppppprrw',
      'wwrrppppppppppppppppeeeeeppprrww',
      'wwwrrppppppppppppppeeeepppprrwww',
      'wwwwwrrpppppppppppppppppprrwwwww',
      'wwwwwwwwwwrrrrrppprrrrrwwwwwwwww',
      'wwwwwwwwwwwwwrrrrrrrwwwwwwwwwwww',
    ],

    objects: [
      /* the chamber: shell-lips of pearl on either side of Nacre, heaps behind it */
      { obj: 'pearl_big', x: 12, y: 7 },
      { obj: 'pearl_big', x: 19, y: 7 },
      { obj: 'pearl_heap', x: 13, y: 10 },
      { obj: 'pearl_heap', x: 19, y: 10 },

      /* the west corridor and the bed */
      { obj: 'pearl_big', x: 4, y: 12 },
      { obj: 'pearl_big', x: 8, y: 18 },
      { obj: 'pearl_big', x: 12, y: 20 },
      { obj: 'pearl_heap', x: 8, y: 21 },
      { obj: 'letter_pile', x: 5, y: 13 },

      /* the east corridor and the bed */
      { obj: 'pearl_big', x: 19, y: 16 },
      { obj: 'pearl_big', x: 26, y: 15 },
      { obj: 'letter_pile', x: 25, y: 13 },
      { obj: 'letter_pile', x: 27, y: 14 },
      { obj: 'letter_pile', x: 22, y: 20 },
    ],

    overrides: { block: [[15, 19]] },   // the rock pool's right half

    events: events,

    onEnter: [
      ['setFlag', 'pearl_bed_reached', true],
      ['if', { flag: 'nacre_offer_seen' }, [['bgm', 'bgm_nacre']], []],
      ['if', { flag: 'pb_can_retry' }, [
        ['setFlag', 'pb_can_retry', false],
        ['call', 'ce_can_retry_pool'],
      ], []],
      ['if', { flag: 'pb_came_back' }, [
        ['setFlag', 'pb_came_back', false],
        ['call', 'ce_pearl_resume'],
      ], []],
      ['if', { flag: 'pb_keep_this' }, [
        ['setFlag', 'pb_keep_this', false],
        ['call', 'ce_not_yet_keep'],
      ], []],
      ['if', { notFlag: 'pb_first_seen' }, [
        ['setFlag', 'pb_first_seen', true],
        ['call', 'ce_pearl_bed_arrival'],
      ], []],
    ],
  });
})();
