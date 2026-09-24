/*
 * undertow_light.js - Tide 4 of the Lull (DESIGN_BIBLE 4.2 #9, 5.6, 8.4; CONTENT_CONTRACT 2).
 *
 * A lighthouse built downward into the seabed. Its lamp shines up, so the deeper you go the darker
 * it gets. Three round rooms on top of one another, joined by hatches; valve radios in the walls
 * murmuring the half-sentences of Pellow's Reach; and one white string going all the way down.
 *
 * Owner: lull_2. Contract interfaces:
 *   in   tide_steps (14,30) -> (16,3) facing down
 *   in   memory_rocks / pearl_bed -> (16,26) facing up
 *   out  top hatch (16,2) -> tide_steps (14,29) facing up
 *   out  bottom hatch (16,27) -> memory_rocks (12,15) up, or pearl_bed (16,3) down after `truth_known`
 *        (both need `string_done`)
 *
 * Own flags are prefixed ul_. Bible flags/vars set here: string_held, string_step, string_done,
 * stan_talks.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};

  const DARK = [0, 0, 30, 0.65];

  /* ------------------------------------------------------------------ the String Line (8.4) */

  /*
   * Pop's rhyme is the combination: red, blue, amber, green. Each can post hums its own colour when
   * the string touches it, and the friend whose home colour it is says the word the static ate.
   */
  const POSTS = [
    { id: 'post_red', x: 11, y: 13, step: 0, colour: 'red', flash: '#cf4a3e', who: 'odo', expr: 'boast', word: '"...cross."' },
    { id: 'post_blue', x: 21, y: 13, step: 1, colour: 'blue', flash: '#3f72b8', who: 'wren', expr: 'neutral', word: '"...fretting."' },
    { id: 'post_amber', x: 10, y: 17, step: 2, colour: 'amber', flash: '#d9a13a', who: 'lin', expr: 'fond', word: '"...fond."' },
    { id: 'post_green', x: 22, y: 17, step: 3, colour: 'green', flash: '#4c8f4e', who: 'pim', expr: 'delighted', word: '"...well-I-never."' },
  ];

  const COLOUR_WORD = { red: 'red', blue: 'blue', amber: 'amber', green: 'green' };

  /**
   * Builds the four can-post events of the String Line puzzle.
   * @returns {Array} map events
   */
  function postEvents() {
    return POSTS.map(function (p) {
      const done = [
        ['flash', p.flash, 14],
        ['sfx', 'sfx_can_rattle'],
        ['setVar', 'string_step', '=', p.step + 1],
        ['say', p.who, p.expr, p.word],
      ];
      if (p.step === 3) {
        done.push(['call', 'ce_ul_string_done']);
      } else {
        done.push(['narrate', 'The line goes on into the dark, one post tighter.']);
      }
      return {
        id: p.id,
        x: p.x,
        y: p.y,
        pages: [
          {
            cond: null,
            sprite: { obj: 'can_post' },
            trigger: 'action',
            commands: [
              ['if', { notFlag: 'string_held' }, [
                ['think', "A post with a tin can on it. {w:15}Nothing in my hands to hook on yet."],
                ['end'],
              ], []],
              ['sfx', 'sfx_glitch'],
              ['flash', p.flash, 20],
              ['narrate', 'The can on the post hums, and hums ' + COLOUR_WORD[p.colour] + '.'],
              ['if', { var: ['string_step', '==', p.step] }, done, [
                ['sfx', 'sfx_error'],
                ['setVar', 'string_step', '=', 0],
                ['say', 'odo', 'scared', 'Slack line! Over.'],
                ['narrate', 'The string sighs off all four posts and lies down in the dark again.'],
              ]],
            ],
          },
          {
            cond: { flag: 'string_done' },
            sprite: { obj: 'can_post' },
            trigger: 'action',
            commands: [
              ['think', 'Taut. {w:15}You can feel somebody talking through it, a long way off.'],
            ],
          },
        ],
      };
    });
  }

  /* ------------------------------------------------------------------ common events (mine) */

  Object.assign(G.DATA.commonEvents, {

    /** The dark middle room: Wren picks the string up off the floor. */
    ce_ul_string_start: {
      name: 'Undertow Light: the line is in your hands',
      commands: [
        ['setFlag', 'string_held', true],
        ['tint', DARK, 40],
        ['bgm', 'bgm_undertow', { fadeMs: 1400 }],
        ['narrate', 'The lamp of this lighthouse is somewhere below them, shining up.\nHere, halfway, it is dark.'],
        ['say', 'odo', 'scared', 'Permission to be a bit scared, Captain?{w:20} ...Asking for a friend.{w:12} Who is me. Over.'],
        ['say', 'lin', 'neutral', 'Permission granted. Hold the rail.'],
        ['say', 'odo', 'quiet', "There's no rail."],
        ['say', 'lin', 'fond', 'Then hold the concept of a rail.'],
        ['wait', 20],
        ['sfx', 'sfx_can_rattle'],
        ['narrate', 'A white string comes down through the hatch behind them\nand lies across the floor, going on into the dark.'],
        ['think', "It goes past the light. {w:20}Of course it does."],
        ['say', 'lin', 'stern', 'Three things. One: that is a line. Two: lines go on posts. Three: I cannot see the posts.'],
        ['say', 'pim', 'delighted', "I can! I'm mostly paper, and paper is excellent in the dark!"],
        ['wait', 15],
        ['say', 'pim', 'puzzled', "...That isn't true. I just very much wanted to be useful."],
        ['say', 'wren', 'small_smile', 'You are, though.'],
        ['say', 'pim', 'brave', 'Oh.{w:20} Right. {w:10}Yes. {w:10}Carry on.'],
      ],
    },

    /** Four posts in the rhyme's order: the radios all find the same voice. */
    ce_ul_string_done: {
      name: 'Undertow Light: the line goes taut',
      commands: [
        ['setFlag', 'string_done', true],
        ['sfx', 'sfx_bell'],
        ['tint', null, 60],
        ['bgmFade', 900],
        ['narrate', 'The string comes up off the floor and goes taut, all the way down\nand all the way up, humming like a wire in wind.'],
        ['wait', 25],
        ['narrate', 'Every radio in the room stops muttering at once.'],
        ['wait', 30],
        ['sfx', 'sfx_static'],
        ['say', 'tam', null, 'Wren?{w:25} Are you awake?{w:25} Over.'],
        ['wait', 20],
        ['say', 'pim', 'puzzled', "That's the voice I'm for."],
        ['wait', 25],
        ['say', 'wren', 'frozen', '...'],
        ['say', 'odo', 'quiet', 'Cap? {w:15}Your hands are doing a thing. Over.'],
        ['say', 'lin', 'neutral', 'Odo.'],
        ['say', 'odo', 'quiet', 'Roger. Over.'],
        ['wait', 20],
        ['sfx', 'sfx_door_open'],
        ['shake', 4, 24],
        ['narrate', 'Below them, the bottom hatch swings open on its own.'],
        ['bgm', 'bgm_other_can', { fadeMs: 1600 }],
      ],
    },
  });

  /* ------------------------------------------------------------------ the map */

  G.registerMap('undertow_light', {
    name: 'The Undertow Light',
    width: 32,
    height: 30,
    bgm: 'bgm_undertow',
    ambience: 'amb_void',
    battleback: 'bb_lull_day',
    backdrop: '#0c2529',
    tint: null,
    start: { x: 16, y: 3, dir: 'down' },

    legend: {
      f: 'floorboards',
      p: 'pale_sand',
      t: 'stair_stone',
      r: 'reef_rock',
      d: 'deep_water',
      ' ': 'void',
    },

    ground: [
      '              ddddd             ',
      '          dddddrrrddddd         ',
      '        dddrrrrrtrrrrrddd       ',
      '       ddrrrfffftffffrrrdd      ',
      '       drrfffffffffffffrrd      ',
      '       drfffffffffffffffrd      ',
      '       drfpppfffffffffffrd      ',
      '       drpppppffffffffffrd      ',
      '       drrpppffffffffffrrd      ',
      '       ddrrrfffttffffrrrdd      ',
      '        dddrrrrttrrrrrddd       ',
      '       ddrrrfffttffffrrrdd      ',
      '      ddrrfffffffffffffrrdd     ',
      '      drrfpppppfffffffffrrd     ',
      '      drffpppppffffffffffrd     ',
      '      drffpppppffffpppppfrd     ',
      '      drffffffffffppppppprd     ',
      '      drrffffffffffppppprrd     ',
      '      ddrrfffffffffffffrrdd     ',
      '       ddrrrfffttffffrrrdd      ',
      '        dddrrrrttrrrrrddd       ',
      '        dddrrrrttrrrrrddd       ',
      '        drrrfffffffffrrrd       ',
      '        drfffffffffffffrd       ',
      '        drffffffpppffffrd       ',
      '        drffffpppppppffrd       ',
      '        drrrfffftppffrrrd       ',
      '        dddrrrrrtrrrrrddd       ',
      '          dddddrrrddddd         ',
      '              ddddd             ',
    ],

    /* second tiles of the two-wide props drawn by event sprites */
    overrides: {
      block: [[21, 7]],
      open: [],
    },

    objects: [
      /* the hatches themselves are flat decals under the stairs */
      { obj: 'stair_hatch', x: 15, y: 2 },
      { obj: 'stair_hatch', x: 15, y: 9 },
      { obj: 'stair_hatch', x: 15, y: 19 },
      { obj: 'stair_hatch', x: 15, y: 27 },

      /* --- top room: the lamp room that is not the lamp room -------------------------------- */
      { obj: 'intray_stack', x: 10, y: 4 },
      { obj: 'mail_sack', x: 21, y: 5 },
      { obj: 'letter_pile', x: 19, y: 8 },

      /* --- middle room: the dark one -------------------------------------------------------- */
      { obj: 'lamp_lens', x: 21, y: 16 },
      { obj: 'mail_sack', x: 11, y: 12 },
      { obj: 'intray_stack', x: 19, y: 18 },
      { obj: 'stamp_flower', x: 12, y: 18 },

      /* --- bottom room: the sill ------------------------------------------------------------ */
      { obj: 'letter_pile', x: 12, y: 23 },
      { obj: 'mail_sack', x: 20, y: 25 },
      { obj: 'stamp_flower', x: 14, y: 23 },
    ],

    events: [

      /* ================================================================ the hatches ========== */
      {
        id: 'hatch_top',
        x: 16,
        y: 2,
        pages: [{
          cond: null,
          sprite: null,
          trigger: 'action',
          commands: [
            ['if', { flag: 'string_done' }, [
              ['think', 'Up is still up. {w:15}It just feels further than it did.'],
            ], []],
            ['choice', ['Climb back up.', 'Stay down here.'], [
              [
                ['sfx', 'sfx_transfer'],
                ['transfer', 'tide_steps', 14, 29, 'up', { fade: 'black' }],
              ],
              [],
            ], { cancel: 1 }],
          ],
        }],
      },
      {
        id: 'hatch_bottom',
        x: 16,
        y: 27,
        pages: [
          {
            cond: { notFlag: 'string_done' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['narrate', 'The bottom hatch is shut, and there is no handle on this side.'],
              ['say', 'pim', 'puzzled', "It's waiting for the line to be finished, I think.{w:15} Doors are very literal."],
            ],
          },
          {
            cond: { all: [{ flag: 'string_done' }, { notFlag: 'truth_known' }] },
            sprite: null,
            trigger: 'action',
            commands: [
              ['narrate', 'The hatch is open. The string goes down through it and does not come back.'],
              ['say', 'lin', 'neutral', 'Wren. {w:15}You do not have to.'],
              ['say', 'wren', 'frozen', 'I know.'],
              ['choice', ['Go down.', 'Not yet.'], [
                [
                  ['bgmFade', 1200],
                  ['sfx', 'sfx_reverse_swell'],
                  ['fade', 'out', 70, 'white'],
                  ['wait', 30],
                  ['transfer', 'memory_rocks', 12, 15, 'up', { fade: 'white' }],
                ],
                [
                  ['think', 'Not yet.{w:25} The two most useful words I own.'],
                ],
              ], { cancel: 1 }],
            ],
          },
          {
            cond: { flag: 'truth_known' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['narrate', 'Below the hatch the water turns the colour of the inside of a shell.'],
              ['sfx', 'sfx_door_open'],
              ['transfer', 'pearl_bed', 16, 3, 'down', { fade: 'black' }],
            ],
          },
        ],
      },

      /* ================================================================ rock pool ============ */
      {
        id: 'pool',
        x: 20,
        y: 7,
        pages: [{
          cond: null,
          sprite: { obj: 'rock_pool' },
          trigger: 'action',
          commands: [
            ['custom', 'rock_pool', { joke: 'A pool, indoors, in a lighthouse, under the sea. Nobody comments. Down here that would be rude.', id: 'pool_undertow' }],
          ],
        }],
      },

      /* ================================================================ the dark begins ====== */
      /* two tiles wide so nobody slips past the scene down the shaft */
      {
        id: 'dark_a',
        x: 15,
        y: 11,
        pages: [{
          cond: { notFlag: 'string_held' },
          sprite: null,
          trigger: 'touch',
          commands: [['call', 'ce_ul_string_start']],
        }],
      },
      {
        id: 'dark_b',
        x: 16,
        y: 11,
        pages: [{
          cond: { notFlag: 'string_held' },
          sprite: null,
          trigger: 'touch',
          commands: [['call', 'ce_ul_string_start']],
        }],
      },

      /* ================================================================ the four can posts === */
      /* (built above: red -> blue -> amber -> green, Pop's rhyme) */

      /* ================================================================ the radios =========== */
      {
        id: 'radio_rhyme',
        x: 13,
        y: 12,
        pages: [
          {
            cond: { notFlag: 'string_done' },
            sprite: { obj: 'radio_valve' },
            trigger: 'action',
            commands: [
              ['sfx', 'sfx_static'],
              ['narrate', 'A valve radio set into the wall, warm to the touch.\nIt is saying a thing it has said a great many times.'],
              ['narrate', '"Red for —,{w:20} blue for —,{w:20} amber for —,{w:20} green for —"'],
              ['wait', 15],
              ['think', "Pop's rhyme. {w:20}With all the ends eaten."],
              ['say', 'pim', 'nosy', 'Do you know the ends?'],
              ['think', 'I know the ends.'],
              ['say', 'lin', 'stern', 'Then the posts want them in that order. Obviously.'],
            ],
          },
          {
            cond: { flag: 'string_done' },
            sprite: { obj: 'radio_valve' },
            trigger: 'action',
            commands: [
              ['sfx', 'sfx_static'],
              ['narrate', '"...and don\'t keep them all in one pocket, love.{w:20} You\'ll rattle."'],
              ['think', 'Yeah.{w:25} I know.'],
            ],
          },
        ],
      },
      {
        id: 'radio_a',
        x: 12,
        y: 5,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: { obj: 'radio_valve' },
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['sfx', 'sfx_static'],
              ['narrate', '"—been meaning to say, only it never seems to be the—"'],
              ['say', 'pim', 'nosy', "That's from up there. {w:15}That's somebody's kitchen."],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: { obj: 'radio_valve' },
            trigger: 'action',
            commands: [
              ['sfx', 'sfx_static'],
              ['narrate', '"—forty-one years and he still doesn\'t know I—"'],
              ['think', 'It never finishes. None of them finish.'],
            ],
          },
        ],
      },
      {
        id: 'radio_b',
        x: 22,
        y: 5,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: { obj: 'radio_valve' },
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['sfx', 'sfx_static'],
              ['narrate', '"—never did thank her for the—"'],
              ['say', 'odo', 'quiet', 'Who are they all talking to? Over.'],
              ['say', 'lin', 'tired', 'Nobody. That is rather the point.'],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: { obj: 'radio_valve' },
            trigger: 'action',
            commands: [
              ['sfx', 'sfx_static'],
              ['narrate', '"—pickled egg? On the—"'],
              ['say', 'odo', 'teary_grin', "That's my dad.{w:20} ...That's my dad. Over."],
              ['narrate', 'Nobody says anything for a bit, which is the kindest available option.'],
            ],
          },
        ],
      },
      {
        id: 'radio_c',
        x: 20,
        y: 14,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: { obj: 'radio_valve' },
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['sfx', 'sfx_static'],
              ['narrate', '"—I\'m fine. I\'m fine. I\'m—"'],
              ['say', 'lin', 'neutral', 'Turn that one off.'],
              ['narrate', 'It has no off.'],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: { obj: 'radio_valve' },
            trigger: 'action',
            commands: [
              ['sfx', 'sfx_static'],
              ['narrate', '"—I\'m fine. I\'m—"'],
              ['say', 'lin', 'tired', 'Still going.'],
            ],
          },
          {
            cond: { all: [{ self: 'A' }, { flag: 'fine_delivered' }] },
            sprite: { obj: 'radio_valve' },
            trigger: 'action',
            commands: [
              ['sfx', 'sfx_static'],
              ['narrate', '"—could somebody else do the ironing, just—"'],
              ['say', 'lin', 'relieved', '...It got out, then.'],
            ],
          },
        ],
      },
      {
        id: 'radio_d',
        x: 13,
        y: 23,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: { obj: 'radio_valve' },
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['sfx', 'sfx_static'],
              ['narrate', '"—wanted to tell you first, only you\'d gone all—"'],
              ['say', 'wren', 'startled', '...'],
              ['say', 'pim', 'puzzled', 'Are you all right? You went a funny colour and I am not even in colour.'],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: { obj: 'radio_valve' },
            trigger: 'action',
            commands: [
              ['sfx', 'sfx_static'],
              ['narrate', 'This one is only breathing now.'],
              ['think', "I'd like it to go back to half a sentence, please."],
            ],
          },
        ],
      },

      /* ================================================================ the lamp ============= */
      {
        id: 'look_lamp',
        x: 20,
        y: 17,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['narrate', 'A lighthouse lens the size of a shed, lying on its side,\npointing its light straight up through the roof.'],
              ['think', 'Built the wrong way round on purpose. {w:15}So the sea can find the town.'],
              ['say', 'odo', 'boast', "Dad says Pop kept this one. {w:12}Before it got wet. {w:12}Over."],
              ['say', 'pim', 'nosy', 'It only lights things it is not in.'],
              ['say', 'lin', 'tired', 'Yes. Thank you, Pim.'],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['think', 'Warm. {w:15}Everything down here that matters is warm and pointing somewhere else.'],
            ],
          },
        ],
      },

      /* ================================================================ Second-Class Stan ==== */
      {
        id: 'stan',
        x: 13,
        y: 8,
        pages: [{
          cond: null,
          sprite: { obj: 'snail_stan' },
          trigger: 'action',
          facePlayer: false,
          commands: [
            ['if', { notSelf: 'A' }, [
              ['setSelf', 'A', true],
              ['setVar', 'stan_talks', '+', 1],
            ], []],
            ['say', 'stan', null, 'Nearly there.'],
            ['say', 'odo', 'neutral', 'He said that yesterday. Over.'],
            ['say', 'stan', null, 'Nearer.'],
            ['say', 'pim', 'brave', 'He is doing forty years in one go. {w:15}I have done one October.'],
          ],
        }],
      },

      /* ================================================================ roaming Unsent ======= */
      {
        id: 'roam_echo_a',
        x: 19,
        y: 6,
        enemy: { troop: 'troop_echo_static', sprite: 'echo', move: { type: 'chase', sight: 4 }, respawn: false },
      },
      {
        id: 'roam_static',
        x: 12,
        y: 15,
        enemy: { troop: 'troop_echo_static', sprite: 'static', move: { type: 'chase', sight: 4 }, respawn: false },
      },
      {
        id: 'roam_echo_b',
        x: 20,
        y: 12,
        enemy: { troop: 'troop_echo_chain', sprite: 'echo', move: { type: 'chase', sight: 4 }, respawn: false },
      },
      {
        id: 'roam_chain',
        x: 18,
        y: 24,
        enemy: { troop: 'troop_echo_chain', sprite: 'chain_letter', move: { type: 'chase', sight: 4 }, respawn: false },
      },
      /* the optional corner: a draft guarding the fog pocket behind the lens */
      {
        id: 'roam_draft',
        x: 23,
        y: 17,
        enemy: { troop: 'troop_draft', sprite: 'draft_47', move: { type: 'chase', sight: 4 }, respawn: false },
      },

      /* the price of Keeping in Shore segment 4 (bible 6.11) */
      {
        id: 'kept_ask_her',
        x: 14,
        y: 18,
        pages: [{
          cond: { var: ['seg4_kept', '>', 0] },
          sprite: { enemy: 'kept_ask_her' },
          solid: false,
          trigger: 'touch',
          move: { type: 'chase', sight: 4 },
          commands: [
            ['battle', 'troop_kept_4', {
              canEscape: false,
              onPeace: [
                ['call', 'ce_late_said_4'],
                ['erase', 'kept_ask_her'],
              ],
              onWin: [
                ['narrate', 'It stops repeating, and the dark closes over the place where it was.'],
                ['say', 'lin', 'neutral', 'That will be back. Things that only wanted hearing always are.'],
                ['erase', 'kept_ask_her'],
              ],
              onLose: 'gameover',
            }],
          ],
        }],
      },

      /* ================================================================ things to poke ======= */
      {
        id: 'look_stairs',
        x: 16,
        y: 4,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['think', 'A lighthouse, built downwards.'],
              ['think', 'Same stairs, same rail, same brass. Just the wrong way about,\nso that climbing it is going under.'],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['say', 'odo', 'boast', 'I counted the steps. {w:12}Ninety-one. Over.'],
              ['say', 'lin', 'stern', 'There are forty.'],
              ['say', 'odo', 'grin', 'I counted some twice. {w:12}They were good ones. Over.'],
            ],
          },
        ],
      },
      {
        id: 'look_letter_pile',
        x: 19,
        y: 8,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['sfx', 'sfx_chest_open'],
              ['narrate', 'A drift of letters in the corner, all of them starting "I know it\'s been a while".'],
              ['giveItem', 'glass_blue', 2],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['think', '"I know it\'s been a while." {w:20}Eight times. {w:15}Same handwriting.'],
            ],
          },
        ],
      },
      {
        id: 'look_sill',
        x: 20,
        y: 25,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['sfx', 'sfx_chest_open'],
              ['narrate', 'A mail sack at the bottom of the lighthouse, waiting by the hatch\nlike a dog that is not allowed in the room beyond.'],
              ['giveItem', 'flask_of_tea', 1],
              ['giveItem', 'glass_amber', 1],
              ['say', 'lin', 'fond', 'Somebody keeps leaving us flasks.'],
              ['say', 'pim', 'delighted', 'Somebody has excellent instincts.'],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['think', 'Empty. {w:15}Facing the hatch. {w:15}Still waiting.'],
            ],
          },
        ],
      },
      {
        id: 'creature_barnacle',
        x: 11,
        y: 23,
        pages: [{
          cond: null,
          sprite: { obj: 'stamp_flower' },
          trigger: 'action',
          commands: [
            ['narrate', 'A barnacle on the wall, with a very small brass grille on the front of it.'],
            ['narrate', '"Evening. Mind the step."'],
            ['say', 'pim', 'nosy', 'Are you a radio?'],
            ['narrate', '"I am a barnacle with opinions. {w:15}It is nearly the same job."'],
          ],
        }],
      },
      {
        id: 'pim_reads',
        x: 13,
        y: 7,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: { obj: 'stamp_flower' },
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['narrate', 'A stamp flower, growing out of a crack in the brass.\nPim leans over it for a long time without reading it.'],
              ['say', 'pim', 'brave', 'I am being very good and not reading things.{w:20} Ask me how good I am being.'],
              ['say', 'wren', 'small_smile', 'How good are you being.'],
              ['say', 'pim', 'delighted', 'ENORMOUSLY.'],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: { obj: 'stamp_flower' },
            trigger: 'action',
            commands: [
              ['say', 'pim', 'nosy', 'It says PLEASE AFFIX HERE.{w:20} On a flower.{w:15} Down here they really do try.'],
            ],
          },
        ],
      },
    ].concat(postEvents()),

    onEnter: [
      /* the dark is a screen tint, and the map scene clears tints on entry: put it back */
      ['if', { all: [{ flag: 'string_held' }, { notFlag: 'string_done' }] }, [
        ['tint', DARK, 1],
      ], []],
      ['if', { notFlag: 'ul_seen_intro' }, [
        ['setFlag', 'ul_seen_intro', true],
        ['wait', 20],
        ['narrate', 'A lighthouse, built downward into the seabed.\nIts lamp is somewhere below, shining up at the town.'],
        ['think', 'Pop kept a light for thirty years.{w:20} He never said which one.'],
        ['say', 'lin', 'stern', 'Three things. One: this is a lighthouse. Two: it is upside down. Three: I am going to stop saying three things for a while.'],
        ['say', 'odo', 'neutral', 'Keep saying them. Over.'],
        ['say', 'lin', 'neutral', '...Noted.'],
        ['wait', 20],
        ['say', 'pim', 'puzzled', "Wren?{w:20} I have started being able to read myself."],
        ['say', 'pim', 'puzzled', 'A bit at a time. {w:15}Like fog coming off a window.'],
        ['say', 'pim', 'nosy', "Page three says 'I don't even care'.{w:25} It says it four times.{w:15} In a row."],
        ['say', 'lin', 'neutral', 'That is not usually what people write when they do not care.'],
        ['say', 'pim', 'puzzled', '...No.'],
        ['think', 'Stop reading.'],
        ['wait', 20],
        ['think', 'Stop reading.'],
        ['say', 'pim', 'blurt', 'Sorry! {w:10}Sorry. {w:10}Stopping. {w:15}Stopped.'],
        ['narrate', 'He is thinner than he was on Friday.\nNobody mentions it, because that is what this town is for.'],
        ['if', { flag: 'the_slip' }, [
          ['narrate', 'Odo came down the ladder three paces behind, the way he has all morning.'],
          ['think', 'He is still here. {w:20}He is just here further away.'],
        ], []],
      ], []],
    ],
  });
})();
