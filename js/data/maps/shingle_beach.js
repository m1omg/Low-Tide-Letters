/*
 * shingle_beach.js - Shingle Beach, Pellow's Reach (DESIGN_BIBLE 4.2 #4, 5.2, 5.3, 5.6, 5.7, 5.9).
 *
 * 40x28. Huge sky, a cliff along the north, the lighthouse headland east, and the sea drawn back
 * miles further than it has any business being. A flat tidal outcrop runs through the middle (the
 * rocks of the prologue) and a rock spur reaches south to the mouth of the Tide Steps at (20,26).
 *
 * Owned by shore_b. What lives here:
 *   - the PROLOGUE (tide 0): Pop, tiny Wren, four shining spots, cg_prologue_glass, the ??? voice,
 *     and ['call','ce_prologue_done'].
 *   - THE GATE (CONTENT_CONTRACT 5): the friends wait at the mouth; a segment's Say/Keep moments must
 *     be met before the steps will have them. sk2 in Tide 1, the slip in Tide 4, sk9 in Tide 5; every
 *     branch ends in ['call','ce_go_down'].
 *   - the locked lighthouse oil-store door (34,8), and the dawn tile (20,24), kept free for the finale.
 *
 * Fixed tiles other writers rely on: (1,10)/(1,11) arrival from harbour_row, (20,25) arrival from
 * tide_steps, (20,24) the epilogue dawn tile - all passable and free of touch events.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G;

  const SK = function (n) {
    return { any: [{ flag: 'sk' + n + '_said' }, { flag: 'sk' + n + '_kept' }] };
  };

  /* ================================================================= scenes (shore_b's own) ==== */

  Object.assign(G.DATA.commonEvents, {

    /** The steps are not having you yet. One step back onto the arrival tile. */
    ce_sb_back: {
      name: 'Beach: not yet',
      commands: [
        ['move', 'player', ['up'], { wait: true }],
      ],
    },

    /** Every descent goes through here: Odo's medal, then the chapter flow. */
    ce_sb_descend: {
      name: 'Beach: down the Tide Steps',
      commands: [
        ['if', { all: [{ var: ['egg_offers', '>=', 3] }, { notFlag: 'shingle_beach_medal_given' }] }, [
          ['emote', 'friend_odo', '!'],
          ['say', 'odo', 'boast', 'HOLD. {w:20}Wren Ashby. Three pickled eggs. Three separate days. Over.'],
          ['say', 'odo', 'grin', 'By the power vested in me by absolutely nobody: the Medal for Valour in the Face of Egg.'],
          ['sfx', 'sfx_key_item'],
          ['giveItem', 'egg_medal', 1],
          ['setFlag', 'shingle_beach_medal_given', true],
          ['say', 'lin', 'stern', 'It is cardboard.'],
          ['say', 'odo', 'boast', 'It is EXTREMELY official. Over.'],
        ], []],
        ['call', 'ce_go_down'],
      ],
    },

    /* ---------------------------------------------------------------- Tide 1: sk2, then the CG */
    ce_sb_sk2: {
      name: 'Beach: Say/Keep 2 (Odo and the other line)',
      commands: [
        ['face', 'friend_odo', 'toward_player'],
        ['say', 'odo', 'neutral', 'Hold up. {w:15}String check.'],
        ['narrate', 'Two strings leave the top of the steps. One is Odo\'s, taut and new.\nThe other is grey with weather and goes slack the moment you touch it.'],
        ['say', 'odo', 'neutral', 'That\'s your other line. Who\'s it for? The one to the empty house. Over.'],
        ['wait', 20],
        ['custom', 'keep_or_say', {
          prompt: 'He waits. He always waits after Over.',
          say: 'A friend. Tam. She moved.',
          keep: 'Nobody.',
          varName: 'shingle_beach_sk2_choice',
        }],
        ['if', { var: ['shingle_beach_sk2_choice', '==', 0] }, [
          ['wait', 15],
          ['say', 'odo', 'quiet', '...Roger. Thanks for telling me. Over.'],
          ['call', 'ce_said_2'],
        ], [
          ['say', 'odo', 'neutral', 'Roger. Nobody. Copy that.'],
          ['wait', 25],
          ['say', 'odo', 'neutral', '...Weird that Nobody gets a whole string. Over.'],
          ['call', 'ce_kept_2'],
        ]],
        ['say', 'lin', 'stern', 'I have written us into the tide table. If we are not up by ten past nine I have left a note for my mother.'],
        ['say', 'odo', 'boast', 'A NOTE. {w:15}Very professional. Over.'],
        ['wait', 15],
        ['fade', 'out', 40, 'black'],
        ['cg', 'cg_tide_steps', { fade: 1 }],
        ['fade', 'in', 55, 'black'],
        ['narrate', 'The beach goes on for miles where the sea should be.\nIn the middle of all that wet sand: a staircase, going down.'],
        ['narrate', 'Three children at the top of it, seen from behind.\nA white string runs from Wren\'s hip, over the edge, into a faint turquoise glow.'],
        ['wait', 20],
        ['fade', 'out', 40, 'black'],
        ['cg', null, { fade: 1 }],
        ['fade', 'in', 40, 'black'],
        ['call', 'ce_sb_descend'],
      ],
    },

    /* ---------------------------------------------------------------- Tide 4: the slip */
    ce_sb_slip: {
      name: 'Beach: the slip',
      commands: [
        ['face', 'friend_odo', 'toward_player'],
        ['say', 'odo', 'neutral', 'Tide four. Lowest one yet, Dad reckons. {w:15}Over.'],
        ['wait', 20],
        ['say', 'odo', 'quiet', '...Wren.'],
        ['wait', 25],
        ['say', 'odo', 'quiet', 'When we move — you\'ll write, right? You\'ve got a whole letter FACE. You\'d be good at it. Over.'],
        ['bgm', 'none', { fadeMs: 900 }],
        ['wait', 50],
        ['sfx', 'sfx_heartbeat'],
        ['wait', 55],
        ['sfx', 'sfx_heartbeat'],
        ['custom', 'ghost_choice', {
          prompt: 'He is waiting. He will wait as long as it takes.',
          options: [
            { text: 'Of course I will.', ghost: true },
            { text: 'I\'ll miss you.', ghost: true },
            { text: 'Fine. Go then.', ghost: false },
          ],
          varName: 'shingle_beach_slip_choice',
          cancelIndex: 2,
        }],
        ['sfx', 'sfx_heartbeat'],
        ['say', 'wren', 'frozen', 'Fine. Go then.'],
        ['wait', 35],
        ['say', 'odo', 'quiet', '...Roger. Out.'],
        ['setFlag', 'the_slip', true],
        ['wait', 20],
        ['think', 'Say something else. {w:25}Say anything else.'],
        ['wait', 25],
        ['narrate', 'She doesn\'t.'],
        ['wait', 20],
        ['say', 'lin', 'tired', '...Right. Down we go, then.'],
        ['narrate', 'Odo comes down the steps anyway. Three paces behind.'],
        ['call', 'ce_sb_descend'],
      ],
    },

    /* ---------------------------------------------------------------- Tide 5: sk9 */
    ce_sb_sk9: {
      name: 'Beach: Say/Keep 9 (this morning)',
      commands: [
        ['face', 'friend_odo', 'toward_player'],
        ['say', 'lin', 'tired', 'Nine minutes of usable light. I have allowed four for dawdling and five for Odo.'],
        ['say', 'odo', 'neutral', 'Present and correct. {w:15}Over.'],
        ['wait', 20],
        ['think', 'He has been kind to me all day. Since this morning. {w:20}It is unbearable.'],
        ['custom', 'keep_or_say', {
          prompt: 'The lowest tide of the lot is waiting under his boots.',
          say: 'This morning. I didn\'t mean it. I\'m sorry.',
          keep: '...Ready?',
          varName: 'shingle_beach_sk9_choice',
        }],
        ['if', { var: ['shingle_beach_sk9_choice', '==', 0] }, [
          ['wait', 15],
          ['say', 'odo', 'grin', 'Apology received and UNDERSTOOD. {w:25}...Say it again slower, I want to log it. Over.'],
          ['say', 'lin', 'fond', 'I have written it down. It is going in the minutes.'],
          ['call', 'ce_said_9'],
        ], [
          ['say', 'odo', 'neutral', 'Ready. Over.'],
          ['wait', 20],
          ['think', 'He is kind about it. {w:20}That is worse.'],
          ['call', 'ce_kept_9'],
        ]],
        ['call', 'ce_sb_descend'],
      ],
    },

    /* ---------------------------------------------------------------- the prologue */
    ce_sb_glass_check: {
      name: 'Beach prologue: all four?',
      commands: [
        ['if', { var: ['beach_glass', '>=', 4] }, [
          ['call', 'ce_sb_prologue_end'],
        ], []],
      ],
    },

    ce_sb_prologue_end: {
      name: 'Beach prologue: nobody smooths their own glass',
      commands: [
        ['wait', 25],
        ['say', 'pop', null, 'That\'s your four. {w:15}Give us the amber one a minute.'],
        ['fade', 'out', 45, 'black'],
        ['cg', 'cg_prologue_glass', { fade: 1 }],
        ['fade', 'in', 60, 'black'],
        ['narrate', 'He holds it up between two fingers against a low sun.\nThe light comes through it the colour of strong tea.'],
        ['say', 'pop', null, 'See how it\'s gone soft? Sea did that. Rolled it about with all the others for years.'],
        ['wait', 20],
        ['say', 'pop', null, 'Nobody smooths their own glass, pet.'],
        ['wait', 30],
        ['say', 'pop', null, 'Don\'t keep them all in one pocket, love. You\'ll rattle.'],
        ['fade', 'out', 45, 'black'],
        ['cg', null, { fade: 1 }],
        ['fade', 'in', 50, 'black'],
        ['wait', 25],
        ['camera', [31, 17], 70],
        ['sfx', 'sfx_can_rattle'],
        ['say', 'tam', null, 'Wren! I found a GREEN one!'],
        ['wait', 20],
        ['camera', 'player', 50],
        ['emote', 'player', '!'],
        ['say', 'pop', null, 'Well then. {w:15}Off you go.'],
        ['narrate', 'She goes. Boots on wet rock, both arms out,\nand absolutely no thought of falling.'],
        ['wait', 25],
        ['flash', '#ffffff', 36],
        ['wait', 20],
        ['call', 'ce_prologue_done'],
      ],
    },
  });

  /* ================================================================= the map =================== */

  G.registerMap('shingle_beach', {
    name: 'Shingle Beach',
    width: 40,
    height: 28,
    bgm: null,                      /* onEnter -> ce_shore_time */
    ambience: null,
    backdrop: '#20333c',
    tint: null,
    start: { x: 20, y: 14, dir: 'up' },

    legend: {
      C: 'cliff',
      v: 'grass_verge',
      s: 'shingle',
      w: 'wet_sand',
      r: 'rock',
      '~': 'sea',
    },

    /*         0123456789012345678901234567890123456789 */
    ground: [
      'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
      'CCCvvCCCCvvvCCCCCCvvvCCCCCCCCCCCCCCCCCCC',
      'CvvvvvCCvvvvvvCCvvvvsvvCCCvvCCCCCrrrCCCC',
      'CvvssvvvvsssvvvvvvsssssvvvsssCCrrrrrrCCC',
      'CsssssvvssssssvvsssssssssssssrrrrrrrrrCC',
      'CssssssssssssssssssssssssssssrrrrrrrrrrC',
      'CssssssssssssssssssssssssssssrrrrrrrrrrC',
      'CssssssssssssssssssssssssssssrrrrrrrrrrC',
      'sssssssssssssssssssssssssrrrssrrrrrrrrrC',
      'ssssssssssssssssssrrrsrrrrrrrrrrrrrrrrrC',
      'CsssssssssssssssrrrrrrrrrrrrrrrrsrrrrrsC',
      'CsssssssssssssssrrrrrrrrrrrrrrrrrssssssC',
      'CsssssssssssssssrrrrrrrrrrrrrrrrrssssssC',
      'CsssssssssssssssssrrrrrrrrrrrrrrrssssssC',
      'Cssssssssssssssssswwsrrrrrrrrrrrsssswww~',
      'Csssssssssssssswwwwwwwrrrrrrrrrssswwwww~',
      'Csssssssssssswwwwwwwwwwwwrrrssswwwwwwww~',
      'Csssssssssswwwwwwwwwwwwwwwwwwwwwwwwwwww~',
      'Cwwwssssswwwwwwwwwwwwwwwwwwwwwwwwwwwwww~',
      'Cwwwwwwwwwwwwwwwrrrrrrrrrwwwwwwwwwwwwww~',
      'Cwwwwwwwwwwwwwwrrrrrrrrrrrwwwwwwwwwwww~~',
      'Cwwwwwwwwwwwwwwrrrrrrrrrrrwwwwwwwwwww~~~',
      'Cwwwwwwwwww~~~~rrrrrrrrrrrwwwww~~~~~~~~~',
      'Cwwwwwww~~~~~~~~rrrrrrrrrwww~~~~~~~~~~~~',
      'C~~~~~~~~~~~~~~~~rrrrrrr~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    ],

    objects: [
      /* the town end of the beach */
      { obj: 'lobster_pots', x: 2, y: 8 },
      { obj: 'boat_upturned', x: 6, y: 13 },
      { obj: 'lobster_pots', x: 3, y: 15 },
      { obj: 'rowboat', x: 6, y: 20 },
      { obj: 'boulder', x: 12, y: 7 },

      /* the groynes marching down to where the water used to be */
      { obj: 'groyne', x: 7, y: 19 },
      { obj: 'groyne', x: 12, y: 22 },
      { obj: 'groyne', x: 31, y: 20 },

      /* the rocks */
      { obj: 'boulder', x: 27, y: 9 },
      { obj: 'boulder', x: 24, y: 19 },
      { obj: 'rock_pool_small', x: 24, y: 15 },
      { obj: 'rock_pool_small', x: 29, y: 13 },

      /* the headland */
      { obj: 'lighthouse', x: 34, y: 7 },
      { obj: 'lobster_pots', x: 36, y: 10 },
    ],

    events: [
      /* ============================================================ west edge -> Harbour Row */
      {
        id: 'to_row_a',
        x: 0,
        y: 10,
        pages: [{
          cond: { var: ['tide', '==', 0] },
          sprite: null,
          trigger: 'touch',
          commands: [['think', "Pop's up on the rocks.{w:15} Not that way."]],
        }, {
          cond: { var: ['tide', '>=', 1] },
          sprite: null,
          trigger: 'touch',
          commands: [['transfer', 'harbour_row', 38, 10, 'left', { fade: 'black' }]],
        }],
      },
      {
        id: 'to_row_b',
        x: 0,
        y: 11,
        pages: [{
          cond: { var: ['tide', '==', 0] },
          sprite: null,
          trigger: 'touch',
          commands: [['think', "Pop's up on the rocks.{w:15} Not that way."]],
        }, {
          cond: { var: ['tide', '>=', 1] },
          sprite: null,
          trigger: 'touch',
          commands: [['transfer', 'harbour_row', 38, 11, 'left', { fade: 'black' }]],
        }],
      },

      /* ============================================================ THE PROLOGUE (tide 0) */
      {
        id: 'prologue',
        x: 20,
        y: 16,
        pages: [{
          cond: { all: [{ var: ['tide', '==', 0] }, { notSelf: 'A' }] },
          sprite: null,
          solid: false,
          trigger: 'auto',
          commands: [
            ['setSelf', 'A', true],
            ['fade', 'out', 1, 'black'],
            ['bgm', 'bgm_harbour_row', { fadeMs: 2500 }],
            ['narrate', 'Eight summers ago. Low tide.'],
            ['wait', 20],
            ['narrate', '{small}(Somebody is whistling. Seven notes. It never gets to the end of itself.){/small}'],
            ['tint', [255, 220, 120, 0.18], 1],
            ['fade', 'in', 90, 'black'],
            ['wait', 30],
            ['say', 'pop', null, 'Mind the green weed, pet. That\'s the stuff that puts grandads on their backs.'],
            ['say', 'pop', null, 'Right. Glass hunt. {w:15}Rules: you find them, I name them.'],
            ['say', 'pop', null, 'Red for cross, blue for fretting, amber for fond, green for well-I-never.'],
            ['say', 'pop', null, 'Four of them out today. I can feel it in my knees, and my knees have never been wrong about glass.'],
            ['wait', 15],
            ['camera', [22, 15], 60],
            ['wait', 30],
            ['camera', 'player', 60],
            ['think', '...There.'],
          ],
        }],
      },
      {
        id: 'pop_prologue',
        x: 22,
        y: 13,
        pages: [{
          cond: { var: ['tide', '==', 0] },
          sprite: { char: 'pop', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['if', { var: ['beach_glass', '>=', 1] }, [
              ['say', 'pop', null, 'Keep looking, love. They hide in plain sight. That\'s their whole trick.'],
            ], [
              ['say', 'pop', null, 'Eyes down. Sun behind you. {w:15}Glass shows off when it thinks you\'re not bothered.'],
            ]],
          ],
        }],
      },
      {
        id: 'glass_1',
        x: 22,
        y: 15,
        pages: [{
          cond: { all: [{ var: ['tide', '==', 0] }, { notSelf: 'A' }] },
          sprite: { obj: 'glass_red' },
          solid: false,
          trigger: 'touch',
          commands: [
            ['setSelf', 'A', true],
            ['sfx', 'sfx_item_get'],
            ['narrate', 'A chip of red glass, gone soft at every corner.'],
            ['say', 'pop', null, 'Red. Red for cross. {w:15}Somebody\'s brake light, that, having a long think about it.'],
            ['setVar', 'beach_glass', '+', 1],
            ['camera', [25, 13], 45],
            ['wait', 20],
            ['camera', 'player', 45],
            ['call', 'ce_sb_glass_check'],
          ],
        }],
      },
      {
        id: 'glass_2',
        x: 25,
        y: 13,
        pages: [{
          cond: { all: [{ var: ['tide', '==', 0] }, { notSelf: 'A' }] },
          sprite: { obj: 'glass_blue' },
          solid: false,
          trigger: 'touch',
          commands: [
            ['setSelf', 'A', true],
            ['sfx', 'sfx_item_get'],
            ['narrate', 'Blue, and cloudy, like it has been worrying about something all the way here.'],
            ['say', 'pop', null, 'Blue. Blue for fretting. {w:15}Medicine bottle. Worried for a living, that one.'],
            ['setVar', 'beach_glass', '+', 1],
            ['camera', [28, 16], 45],
            ['wait', 20],
            ['camera', 'player', 45],
            ['call', 'ce_sb_glass_check'],
          ],
        }],
      },
      {
        id: 'glass_3',
        x: 28,
        y: 16,
        pages: [{
          cond: { all: [{ var: ['tide', '==', 0] }, { notSelf: 'A' }] },
          sprite: { obj: 'glass_amber' },
          solid: false,
          trigger: 'touch',
          commands: [
            ['setSelf', 'A', true],
            ['sfx', 'sfx_item_get'],
            ['narrate', 'Amber. Warm to hold, which cannot possibly be true.'],
            ['say', 'pop', null, 'Amber. Amber for fond. {w:15}Beer bottle. Somebody had a nice evening.'],
            ['setVar', 'beach_glass', '+', 1],
            ['camera', [30, 12], 45],
            ['wait', 20],
            ['camera', 'player', 45],
            ['call', 'ce_sb_glass_check'],
          ],
        }],
      },
      {
        id: 'glass_4',
        x: 30,
        y: 12,
        pages: [{
          cond: { all: [{ var: ['tide', '==', 0] }, { notSelf: 'A' }] },
          sprite: { obj: 'glass_green' },
          solid: false,
          trigger: 'touch',
          commands: [
            ['setSelf', 'A', true],
            ['sfx', 'sfx_item_get'],
            ['narrate', 'Green. The colour of the shallow bit, where you are allowed to go.'],
            ['say', 'pop', null, 'Green. Green for well-I-never. {w:15}And well. I never.'],
            ['setVar', 'beach_glass', '+', 1],
            ['call', 'ce_sb_glass_check'],
          ],
        }],
      },

      /* ============================================================ THE GATE */
      {
        id: 'friend_odo',
        x: 19,
        y: 25,
        pages: [
          {
            cond: null,
            sprite: null,
            solid: false,
            trigger: 'action',
            move: { type: 'still' },
            commands: [['end']],
          },
          {
            cond: { all: [{ var: ['tide', '>=', 1] }, { var: ['tide', '<=', 5] }] },
            sprite: { char: 'odo', dir: 'right' },
            trigger: 'action',
            move: { type: 'still' },
            facePlayer: true,
            commands: [
              ['if', { var: ['tide', '==', 1] }, [
                ['say', 'odo', 'boast', 'Expedition assembled. Rations: one bag of chips, eaten. Over.'],
              ], []],
              ['if', { var: ['tide', '==', 2] }, [
                ['say', 'odo', 'grin', 'Day two. Morale: HIGH. Knees: scabbed. Over.'],
              ], []],
              ['if', { var: ['tide', '==', 3] }, [
                ['say', 'odo', 'scared', 'Permission to be a bit scared of the evening one, Captain? {w:20}...Asking for a friend. Who is me. Over.'],
              ], []],
              ['if', { var: ['tide', '==', 4] }, [
                ['say', 'odo', 'quiet', 'Rain. Rain is fine. Rain is my favourite weather, actually. Over.'],
              ], []],
              ['if', { var: ['tide', '==', 5] }, [
                ['say', 'odo', 'neutral', 'Last one. {w:20}Lowest water in forty years, under our actual boots. Over.'],
              ], []],
            ],
          },
        ],
      },
      {
        id: 'friend_lin',
        x: 21,
        y: 25,
        pages: [
          {
            cond: null,
            sprite: null,
            solid: false,
            trigger: 'action',
            move: { type: 'still' },
            commands: [['end']],
          },
          {
            cond: {
              all: [
                { var: ['tide', '>=', 1] },
                { var: ['tide', '<=', 5] },
                { any: [{ var: ['tide', '!=', 2] }, { flag: 'sk4_said' }, { flag: 'sk4_kept' }] },
                { any: [{ var: ['tide', '!=', 4] }, { flag: 'sk7_said' }, { flag: 'sk7_kept' }] },
              ],
            },
            sprite: { char: 'lin', dir: 'left' },
            trigger: 'action',
            move: { type: 'still' },
            facePlayer: true,
            commands: [
              ['if', { var: ['tide', '<=', 2] }, [
                ['say', 'lin', 'stern', 'Three things. One: the steps are wet. Two: so is everything. Three: I have brought a second pair of socks and they are not for me.'],
              ], []],
              ['if', { var: ['tide', '==', 3] }, [
                ['say', 'lin', 'tired', 'I am fine. {w:20}I have done the lists. The lists are done.'],
              ], []],
              ['if', { var: ['tide', '>=', 4] }, [
                ['say', 'lin', 'tired', 'Two things. One: Robin is at Mrs Pallant\'s. Two: I did ask her. Out loud. With my mouth.'],
              ], []],
            ],
          },
        ],
      },
      {
        id: 'steps_mouth',
        x: 20,
        y: 26,
        pages: [
          /* tide 0 - there is nothing down there yet but weather */
          {
            cond: null,
            sprite: null,
            solid: false,
            trigger: 'touch',
            commands: [
              ['narrate', 'The rock stops here. After that it is just sea, going on being sea.'],
              ['call', 'ce_sb_back'],
            ],
          },

          /* Tide 1 - sk1 with Pop, then sk2 right here */
          {
            cond: { var: ['tide', '>=', 1] },
            sprite: null,
            solid: false,
            trigger: 'touch',
            commands: [
              ['if', SK(1), [
                ['call', 'ce_sb_sk2'],
              ], [
                ['say', 'odo', 'neutral', 'Hold position. {w:15}Pop flagged you down by his bench. Said he wanted a word. Over.'],
                ['say', 'lin', 'stern', 'He has been soldering the same joint for an hour. That is not soldering. That is waiting.'],
                ['call', 'ce_sb_back'],
              ]],
            ],
          },

          /* Tide 2 - sk3 (the chippy) and sk4 (Lin, the Row) */
          {
            cond: { var: ['tide', '>=', 2] },
            sprite: null,
            solid: false,
            trigger: 'touch',
            commands: [
              ['if', { all: [SK(3), SK(4)] }, [
                ['say', 'lin', 'stern', 'Three things. One: low water at 10:42. Two: we are four minutes early. Three: I am not apologising for that.'],
                ['say', 'odo', 'boast', 'Descending! {w:10}Descending is GO. Over.'],
                ['call', 'ce_sb_descend'],
              ], [
                ['if', SK(3), [], [
                  ['say', 'odo', 'neutral', 'Dad says his vinegar is still stood in the back room. He is doing the face about it. Over.'],
                ]],
                ['if', SK(4), [], [
                  ['say', 'odo', 'neutral', 'And Lin\'s up on the Row doing her list AT people. She won\'t come down till she\'s finished. Over.'],
                ]],
                ['call', 'ce_sb_back'],
              ]],
            ],
          },

          /* Tide 3 - sk5 (Pop) and sk6 (Mum) */
          {
            cond: { var: ['tide', '>=', 3] },
            sprite: null,
            solid: false,
            trigger: 'touch',
            commands: [
              ['if', { all: [SK(5), SK(6)] }, [
                ['say', 'odo', 'grin', 'Evening tide. Spooky tide. My favourite. Over.'],
                ['say', 'lin', 'neutral', 'It is the same sea, Odo.'],
                ['say', 'odo', 'boast', 'It is a DIFFERENT SHAPE. Over.'],
                ['call', 'ce_sb_descend'],
              ], [
                ['if', SK(5), [], [
                  ['say', 'odo', 'neutral', 'Your Pop is out on his bench in his slippers. In September. He keeps looking up the lane. Over.'],
                ]],
                ['if', SK(6), [], [
                  ['say', 'lin', 'stern', 'Your mother is stood at your door with her coat half on. She has been for ten minutes. Doors are for going through.'],
                ]],
                ['call', 'ce_sb_back'],
              ]],
            ],
          },

          /* Tide 4 - sk7 (Lin) and sk8 (Robin), then the slip */
          {
            cond: { var: ['tide', '>=', 4] },
            sprite: null,
            solid: false,
            trigger: 'touch',
            commands: [
              ['if', { all: [SK(7), SK(8)] }, [
                ['call', 'ce_sb_slip'],
              ], [
                ['if', SK(7), [], [
                  ['say', 'odo', 'neutral', 'Lin\'s up on the Row trying to get her coat on and hold a five-year-old at the same time. Over.'],
                ]],
                ['if', SK(8), [], [
                  ['say', 'odo', 'neutral', 'Also the small one is asking everybody whether they\'re Lin\'s friend. He\'s asked me twice. Over.'],
                ]],
                ['call', 'ce_sb_back'],
              ]],
            ],
          },

          /* Tide 5 - sk9 happens right here */
          {
            cond: { var: ['tide', '>=', 5] },
            sprite: null,
            solid: false,
            trigger: 'touch',
            commands: [
              ['call', 'ce_sb_sk9'],
            ],
          },

          /* Epilogue - the sea has the steps back */
          {
            cond: { var: ['tide', '>=', 6] },
            sprite: null,
            solid: false,
            trigger: 'touch',
            commands: [
              ['narrate', 'The water is coming back over the steps. Quietly.\nAs though it had never been anywhere.'],
              ['call', 'ce_sb_back'],
            ],
          },
        ],
      },

      /* ============================================================ the oil-store door */
      {
        id: 'oil_store_door',
        x: 34,
        y: 8,
        pages: [
          {
            cond: { var: ['tide', '>=', 1] },
            sprite: null,
            solid: false,
            trigger: 'action',
            commands: [
              ['if', { notSelf: 'A' }, [
                ['think', 'The lighthouse. Pop kept this lamp lit for thirty years. It\'s automatic now. It doesn\'t whistle.'],
                ['setSelf', 'A', true],
              ], []],
              ['sfx', 'sfx_door_locked'],
              ['if', { notSelf: 'B' }, [
                ['think', 'The oil store. The den. Locked.'],
                ['wait', 20],
                ['think', '...I have never actually tried it.'],
                ['setSelf', 'B', true],
              ], [
                ['think', 'Still locked. Still never tried.'],
              ]],
            ],
          },
          {
            cond: { var: ['tide', '>=', 6] },
            sprite: null,
            solid: false,
            trigger: 'action',
            commands: [
              ['sfx', 'sfx_door_open'],
              ['think', 'It isn\'t locked. {w:25}It was never locked. It was stiff.'],
              ['wait', 20],
              ['narrate', 'Inside: a crate for a table, two flat cushions, and a jam jar\nwith a squiggle on the label where a name should be.'],
              ['think', 'Later. {w:20}But today later means today.'],
            ],
          },
        ],
      },

      /* ============================================================ the two can strings */
      {
        id: 'string_shingle',
        x: 8,
        y: 11,
        pages: [
          {
            cond: { var: ['tide', '>=', 1] },
            sprite: null,
            solid: false,
            trigger: 'touch',
            commands: [
              ['if', { notSelf: 'A' }, [
                ['setSelf', 'A', true],
                ['sfx', 'sfx_can_rattle'],
                ['think', 'The string off my west window comes all the way out here. Under the shingle in places. Still going.'],
                ['wait', 15],
                ['think', 'It used to stop at a window across the lane.'],
              ], []],
            ],
          },
          {
            cond: { var: ['tide', '>=', 4] },
            sprite: null,
            solid: false,
            trigger: 'touch',
            commands: [
              ['if', { notSelf: 'A' }, [                                  // first time here at all
                ['setSelf', 'A', true],
                ['sfx', 'sfx_can_rattle'],
                ['think', 'The string off my west window comes all the way out here. Under the shingle in places. Still going.'],
                ['wait', 15],
                ['think', 'It used to stop at a window across the lane.'],
                ['wait', 15],
              ], []],
              ['if', { notSelf: 'B' }, [
                ['setSelf', 'B', true],
                ['think', 'Two strings out here now. Mine, and the one from next door.'],
                ['wait', 15],
                ['think', 'Next door is moving too. {w:20}I keep forgetting on purpose.'],
              ], []],
            ],
          },
        ],
      },
      {
        id: 'string_sand',
        x: 20,
        y: 22,
        pages: [
          {
            cond: { var: ['tide', '>=', 1] },
            sprite: null,
            solid: false,
            trigger: 'touch',
            commands: [
              ['if', { notSelf: 'A' }, [
                ['setSelf', 'A', true],
                ['think', 'It goes over the edge here. {w:20}Straight down, into the dark bit.'],
                ['wait', 15],
                ['think', 'Strings are supposed to have two ends. Someone should tell this one.'],
              ], []],
            ],
          },
        ],
      },

      /* ============================================================ the fisherman (bible 5.9) */
      {
        id: 'fisherman',
        x: 10,
        y: 8,
        pages: [
          {
            cond: { var: ['tide', '>=', 1] },
            sprite: { char: 'towns_a', dir: 'down' },
            trigger: 'action',
            move: { type: 'still' },
            facePlayer: true,
            commands: [
              ['say', 'towns_a', null, 'Sea\'s gone out past the Blare. I\'ve not seen that since I was a lad with hair.'],
            ],
          },
          {
            cond: { var: ['tide', '>=', 2] },
            sprite: { char: 'towns_a', dir: 'down' },
            trigger: 'action',
            move: { type: 'still' },
            facePlayer: true,
            commands: [
              ['say', 'towns_a', null, 'Could say it\'s wrong. {w:20}Won\'t.'],
            ],
          },
          {
            cond: { var: ['tide', '>=', 3] },
            sprite: { char: 'towns_a', dir: 'down' },
            trigger: 'action',
            move: { type: 'still' },
            facePlayer: true,
            commands: [
              ['say', 'towns_a', null, '...'],
              ['think', 'He used to talk about the boat for twenty minutes at a time. I used to mind.'],
            ],
          },
          {
            cond: { var: ['tide', '>=', 5] },
            sprite: { char: 'towns_a', dir: 'down' },
            trigger: 'action',
            move: { type: 'still' },
            facePlayer: true,
            commands: [
              ['say', 'towns_a', null, '...'],
            ],
          },
          {
            cond: { var: ['tide', '>=', 6] },
            sprite: { char: 'towns_a', dir: 'down' },
            trigger: 'action',
            move: { type: 'still' },
            facePlayer: true,
            commands: [
              ['say', 'towns_a', null, 'Tide\'s coming in. {w:20}Look at it come.'],
              ['say', 'towns_a', null, 'Forty-one years I\'ve stood here watching it do that. Grand, isn\'t it.'],
            ],
          },
        ],
      },

      /* ============================================================ things worth poking at */
      {
        id: 'insp_boat',
        x: 6,
        y: 13,
        pages: [{
          cond: { var: ['tide', '>=', 1] },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['if', { notSelf: 'A' }, [
              ['setSelf', 'A', true],
              ['think', 'An upturned boat with no name left on it. Somebody sanded the name off, which takes longer than painting one on.'],
            ], [
              ['if', { notSelf: 'B' }, [
                ['setSelf', 'B', true],
                ['sfx', 'sfx_chest_open'],
                ['narrate', 'Something under the gunwale, wedged in the sand: a chip of blue glass.'],
                ['giveItem', 'glass_blue', 1],
                ['think', 'Medicine bottle. Worried for a living. {w:15}Pop\'s words, not mine.'],
              ], [
                ['think', 'Sand, a crab shell, and the smell of forty summers of tar.'],
              ]],
            ]],
          ],
        }],
      },
      {
        id: 'insp_pots',
        x: 3,
        y: 15,
        pages: [{
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['if', { notSelf: 'A' }, [
              ['setSelf', 'A', true],
              ['think', 'A lobster pot. Empty. The lobsters have moved on. Good for them.'],
            ], [
              ['think', 'Still empty. I check every time, like the lobsters might have changed their minds.'],
            ]],
          ],
        }],
      },
      {
        id: 'insp_rowboat',
        x: 6,
        y: 20,
        pages: [{
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['if', { notSelf: 'A' }, [
              ['setSelf', 'A', true],
              ['sfx', 'sfx_item_get'],
              ['narrate', 'A forgotten stick of rock rolling about in the bilge, sandy but sealed.'],
              ['giveItem', 'stick_of_rock', 1],
              ['think', 'It says PELLOW\'S REACH all the way through. So does everyone here, probably.'],
            ], [
              ['think', 'Two oars, one rowlock. An optimistic arrangement.'],
            ]],
          ],
        }],
      },
      {
        id: 'insp_groyne_gull',
        x: 12,
        y: 22,
        pages: [{
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['if', { notSelf: 'A' }, [
              ['setSelf', 'A', true],
              ['think', 'A gull on the groyne post. It is standing on one leg to prove it can.'],
            ], [
              ['if', { notSelf: 'B' }, [
                ['setSelf', 'B', true],
                ['sfx', 'sfx_emote'],
                ['think', 'It has swapped legs. {w:15}It is looking at me to make sure I noticed.'],
              ], [
                ['think', 'We have been staring at each other for some time. I am not going to be the one who leaves.'],
              ]],
            ]],
          ],
        }],
      },
      {
        id: 'insp_rock_pool',
        x: 24,
        y: 15,
        pages: [{
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['if', { notSelf: 'A' }, [
              ['setSelf', 'A', true],
              ['sfx', 'sfx_splash'],
              ['think', 'A rock pool the size of a dinner plate. One small crab. It raises a claw.'],
              ['wait', 15],
              ['think', 'Threat or wave. Unclear.'],
            ], [
              ['if', { notSelf: 'B' }, [
                ['setSelf', 'B', true],
                ['think', 'It has raised the other claw as well. {w:20}It has chosen wave.'],
              ], [
                ['think', 'The crab is busy. The crab has a whole plate of sea to run.'],
              ]],
            ]],
          ],
        }],
      },
      {
        id: 'insp_far_sea',
        x: 12,
        y: 24,
        pages: [{
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['if', { notSelf: 'A' }, [
              ['setSelf', 'A', true],
              ['think', 'The sea. Miles off. Sulking behind the Blare, where it thinks nobody can see it.'],
            ], [
              ['think', 'Everyone keeps saying how far out it is. Nobody says anything else.'],
            ]],
          ],
        }],
      },
      {
        id: 'insp_cliff_steps',
        x: 20,
        y: 21,
        pages: [{
          cond: { var: ['tide', '>=', 1] },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Steps. Cut into rock that has been under water since before there was a town.'],
            ['wait', 15],
            ['think', 'They go down a lot further than the light does.'],
          ],
        }],
      },
    ],

    onEnter: [
      ['call', 'ce_shore_time'],
      ['if', { var: ['tide', '!=', 4] }, [
        ['ambience', 'amb_sea'],
      ], []],
    ],
  });
})();
