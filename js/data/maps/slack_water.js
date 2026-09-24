/*
 * slack_water.js - Tide 3 of the Lull (DESIGN_BIBLE 4.2 #8, 5.5, 8.3; CONTENT_CONTRACT 2).
 *
 * A becalmed seabed of ruled ledger paper: grandfather clocks half buried like groynes, in-trays
 * stacked into sea stacks, pools so still they are mirrors, and a vending machine that sells
 * compliments. The moment between tides, when nothing moves and everybody is fine.
 *
 * Owner: lull_2. Contract interfaces used by other writers:
 *   in   tide_steps (6,30) -> (18,1) facing down
 *   out  north edge (18,0) -> tide_steps (6,29) facing up
 *   same-map: door ON TIME (30,6) -> (4,24)   door LATE (32,6) -> (20,12), the inner flat
 *   last command of the climax: ['call','ce_tide_done'] (shore_a owns the clock)
 *
 * Own flags/vars are prefixed sw_. Bible flags set here: late_door_open, bench_2, lin_told,
 * fine_delivered / fine_hushed, clock_1..clock_4, clocks_right, stan_talks.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};

  /* ------------------------------------------------------------------ the Four Clocks (8.3) */

  /* 0 HIGH, 1 EBB, 2 LOW, 3 FLOOD. Lin's tide table, west to east: LOW, HIGH, FLOOD, EBB. */
  const FACE = [
    ['{c:blue}HIGH{/c}', 'The hand swings all the way up and stops, pleased with itself.'],
    ['{c:teal}EBB{/c}', 'The hand slides down a quarter and sulks there.'],
    ['{c:brown}LOW{/c}', 'The hand points straight down, at the floor, at nothing.'],
    ['{c:green}FLOOD{/c}', 'The hand comes back up the other side, hopeful.'],
  ];

  /**
   * Command list for one of the four sunk clocks.
   * @param {number} n 1-4, west to east
   * @param {string} where human name of the clock used in the narration
   * @returns {Array} event commands
   */
  function clockCommands(n, where) {
    const v = 'clock_' + n;
    const cmds = [
      ['if', { notFlag: 'sw_clocks_told' }, [
        ['setFlag', 'sw_clocks_told', true],
        ['say', 'lin', 'stern', 'Four clocks.{w:12} Four doors\' worth of opinion between them.'],
        ['say', 'lin', 'neutral', 'Three things. One: they are all set wrong.{w:10} Two: I have the tide table.{w:10} Three: nobody touches anything until I have read it out.'],
        ['say', 'lin', 'neutral', 'West to east.{w:15} Low. High. Flood. Ebb.{w:20} It is in the Pockets menu under my name, if anybody forgets.'],
        ['say', 'odo', 'neutral', 'I will forget. Over.'],
        ['say', 'pim', 'delighted', "I won't! I'm paper! Things stay on me!"],
        ['say', 'pim', 'puzzled', '...Low. High. Flood. {w:15}Um.'],
      ], []],
      ['sfx', 'sfx_switch'],
      ['setVar', v, '+', 1],
      ['if', { var: [v, '>', 3] }, [['setVar', v, '=', 0]], []],
    ];
    for (let i = 0; i < 4; i++) {
      cmds.push(['if', { var: [v, '==', i] }, [
        ['narrate', 'The ' + where + ' clock is set to ' + FACE[i][0] + '.\n' + FACE[i][1]],
      ], []]);
    }
    cmds.push(['call', 'ce_sw_clock_after']);
    return cmds;
  }

  /* ------------------------------------------------------------------ common events (mine) */

  Object.assign(G.DATA.commonEvents, {

    /** Recounts how many of the four clocks agree with Lin's tide table into `clocks_right`. */
    ce_sw_clocks: {
      name: 'Slack Water: count the clocks',
      commands: [
        ['setVar', 'clocks_right', '=', 0],
        ['if', { var: ['clock_1', '==', 2] }, [['setVar', 'clocks_right', '+', 1]], []],
        ['if', { var: ['clock_2', '==', 0] }, [['setVar', 'clocks_right', '+', 1]], []],
        ['if', { var: ['clock_3', '==', 3] }, [['setVar', 'clocks_right', '+', 1]], []],
        ['if', { var: ['clock_4', '==', 1] }, [['setVar', 'clocks_right', '+', 1]], []],
      ],
    },

    /** Runs after any clock is turned: Lin's two moments, on time and on purpose. */
    ce_sw_clock_after: {
      name: 'Slack Water: Lin watches the clocks',
      commands: [
        ['call', 'ce_sw_clocks'],
        ['if', { all: [{ var: ['clocks_right', '==', 4] }, { notFlag: 'sw_all_right' }] }, [
          ['setFlag', 'sw_all_right', true],
          ['sfx', 'sfx_talk_success'],
          ['say', 'lin', 'stern', "That's correct.{w:20} It's CORRECT.{w:15} I checked it twice."],
          ['say', 'odo', 'boast', 'Logging it. {w:10}Logged. Over.'],
        ], []],
        ['if', { all: [{ var: ['clocks_right', '==', 3] }, { flag: 'sw_all_right' }, { notFlag: 'sw_lin_badly' }] }, [
          ['setFlag', 'sw_lin_badly', true],
          ['narrate', 'Lin keeps her hand over the clock face for a while without touching anything.'],
          ['say', 'lin', 'tired', 'Doing it badly.{w:20} On purpose.{w:20} Item one.'],
          ['say', 'pim', 'brave', '{small}You are very good at it, for a beginner.{/small}'],
        ], []],
      ],
    },
  });

  /* ------------------------------------------------------------------ the map */

  G.registerMap('slack_water', {
    name: 'Slack Water',
    width: 36,
    height: 28,
    bgm: 'bgm_slack_water',
    ambience: 'amb_void',
    battleback: 'bb_lull_day',
    backdrop: '#6f6552',
    tint: null,
    start: { x: 18, y: 1, dir: 'down' },

    legend: {
      l: 'ledger_paper',
      s: 'pale_sand',
      m: 'mirror_water',
      r: 'reef_rock',
    },

    ground: [
      'rrrrrrrrrrrrrrrrrrsrrrrrrrrrrrrrrrrr',
      'rrlllrlllrlllrlllllllllrllrlrrrrrrrr',
      'rrrlllllllllllllssssslllllllrrrrrrrr',
      'rrlllmmmllllllssssssssslllllrrrrrrrr',
      'rrllmmmmmllllsssssssssssllllrrrrrrrr',
      'rllllmmmllllllsssssssssllllllrrrrrrr',
      'rrllllllllllllllssssslllllllllrrrrrr',
      'rrllllllllllllllllllssssslllllllllrr',
      'rrrllllllllllllllllsssssssllllllllrr',
      'rrrlllllllllllrrrrrrrrrrrrrrrrrlslrr',
      'rrlllllmllllllrlllllllllllllllrsssrr',
      'rrllmmmmmmmlllrlllllllllllllllrsssrr',
      'rrllmmmmmmmlllrlllllllllllllllrsssrr',
      'rrrmmmmmmmmlllrlllllllllllllllrsssrr',
      'rrllmmmmmmmlllrlllllllllllllllrsssrr',
      'rrllmmmmmmmlllrlllllllllllllllrlslrr',
      'rllllllmllllllrlllllllllllllllrlllrr',
      'rrllllllllllllrrrrrrrrrrrrrrrrrlllrr',
      'rrllssslllllllllllllllllllllllllllrr',
      'rrsssssssslllllllllllllllllllllllrrr',
      'rrrssssssslllllllllllllmmmllllllllrr',
      'rrrsslllssllllmmmmmmmlmmmmmlllllllrr',
      'rrlslllllsllmmmmmmmmmmmmmmlllllllrrr',
      'rrlsslllsslmmmmmmmmmmmmmllllllllllrr',
      'rrlsssssssllmmmmmmmmmmmsssssssllllrr',
      'rrrsssssssllllmmmmmmmlssssssssslllrr',
      'rrlllllrrlllllllllllrrlssssssrlllrrr',
      'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
    ],

    /* the second tile of every two-tile prop that is drawn by an EVENT sprite */
    overrides: {
      block: [[22, 3], [3, 11]],
      open: [],
    },

    objects: [
      /* --- the north flat: in-trays stacked like sea stacks ---------------------------------- */
      { obj: 'intray_stack', x: 10, y: 2 },
      { obj: 'intray_stack', x: 11, y: 3 },
      { obj: 'intray_stack', x: 9, y: 4 },
      { obj: 'intray_stack', x: 12, y: 5 },
      { obj: 'intray_stack', x: 24, y: 2 },
      { obj: 'intray_stack', x: 25, y: 3 },
      { obj: 'intray_stack', x: 26, y: 5 },
      { obj: 'intray_stack', x: 3, y: 8 },
      { obj: 'washing_line', x: 10, y: 6 },
      { obj: 'ironing_board', x: 4, y: 6 },

      /* --- the rock face with the two mail-slot doors ----------------------------------------- */
      { obj: 'mail_slot_door', x: 30, y: 6 },
      { obj: 'mail_slot_door', x: 32, y: 6 },

      /* --- decorative sunk clocks (the four puzzle ones are events) --------------------------- */
      { obj: 'sunk_clock', x: 5, y: 8 },
      { obj: 'sunk_clock', x: 8, y: 16 },
      { obj: 'sunk_clock', x: 33, y: 14 },
      { obj: 'sunk_clock', x: 6, y: 19 },
      { obj: 'sunk_clock', x: 27, y: 23 },

      /* --- the west corridor and the pool shore ----------------------------------------------- */
      { obj: 'intray_stack', x: 12, y: 9 },
      { obj: 'intray_stack', x: 12, y: 16 },
      { obj: 'intray_stack', x: 3, y: 12 },
      { obj: 'stamp_flower', x: 11, y: 14 },
      { obj: 'stamp_flower', x: 19, y: 2 },

      /* --- the inner flat: everything ironed, everything fine --------------------------------- */
      { obj: 'ironing_board', x: 17, y: 11 },
      { obj: 'washing_line', x: 22, y: 10 },
      { obj: 'intray_stack', x: 16, y: 15 },
      { obj: 'intray_stack', x: 19, y: 16 },
      { obj: 'intray_stack', x: 22, y: 16 },
      /* the wall of in-trays across the flat, with one gap at (24,13) */
      { obj: 'intray_stack', x: 24, y: 10 },
      { obj: 'intray_stack', x: 24, y: 11 },
      { obj: 'intray_stack', x: 24, y: 12 },
      { obj: 'intray_stack', x: 24, y: 14 },
      { obj: 'intray_stack', x: 24, y: 15 },
      { obj: 'intray_stack', x: 24, y: 16 },
      { obj: 'ironing_board', x: 26, y: 11 },
      { obj: 'washing_line', x: 28, y: 15 },

      /* --- the south flat --------------------------------------------------------------------- */
      { obj: 'intray_stack', x: 10, y: 19 },
      { obj: 'intray_stack', x: 28, y: 20 },
      { obj: 'intray_stack', x: 31, y: 22 },
      { obj: 'intray_stack', x: 13, y: 26 },
      { obj: 'stamp_flower', x: 8, y: 19 },
      { obj: 'stamp_flower', x: 30, y: 22 },
      { obj: 'washing_line', x: 26, y: 24 },
    ],

    events: [

      /* ================================================================ the way back up ====== */
      {
        id: 'exit_north',
        x: 18,
        y: 0,
        pages: [{
          cond: null,
          sprite: null,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_transfer'],
            ['transfer', 'tide_steps', 6, 29, 'up', { fade: 'black' }],
          ],
        }],
      },

      /* ================================================================ rock pool ============ */
      {
        id: 'pool',
        x: 21,
        y: 3,
        pages: [{
          cond: null,
          sprite: { obj: 'rock_pool' },
          trigger: 'action',
          commands: [
            ['custom', 'rock_pool', { joke: 'The pool is so still it has a ceiling. Four faces look back up, waiting to be told what the plan is.', id: 'pool_slack_water' }],
          ],
        }],
      },

      /* ================================================================ the vending machine === */
      {
        id: 'vending',
        x: 27,
        y: 5,
        pages: [
          {
            cond: null,
            sprite: { obj: 'vending_machine' },
            trigger: 'action',
            commands: [
              ['think', 'A vending machine, shin-deep in paper.{w:15} OUT OF ORDER, in somebody\'s very best handwriting.'],
              ['think', 'The window says COMPLIMENTS.{w:15} 1 STAMP.'],
              ['say', 'odo', 'boast', "It's a machine that says nice things.{w:12} To STRANGERS.{w:12} On the SEABED. Over."],
              ['say', 'lin', 'neutral', 'It is out of order.'],
              ['say', 'pim', 'nosy', 'It might only be shy.'],
              ['choice', ['Put a Stamp in.', 'Leave it.'], [
                [
                  ['sfx', 'sfx_coin'],
                  ['giveMoney', -1],
                  ['narrate', 'The Stamp goes in with a small polite click.{w:30}\nNothing comes out.'],
                  ['wait', 30],
                  ['say', 'odo', 'boast', 'Stand back.{w:15} I have a PROCEDURE for this. Over.'],
                  ['narrate', 'Odo thumps it once, flat-handed, low down on the left,\nthe way his dad thumps the fryer.'],
                  ['sfx', 'sfx_push'],
                  ['shake', 5, 20],
                  ['wait', 20],
                  ['sfx', 'sfx_item_get'],
                  ['narrate', 'Something small drops into the tray.'],
                  ['think', 'A cardboard token. Printed on one side, in the machine\'s best handwriting:'],
                  ['narrate', "{big}YOU'RE DOING FINE{/big}"],
                  ['giveItem', 'doing_fine_token', 1],
                  ['setFlag', 'sw_token', true],
                  ['say', 'odo', 'grin', 'IT WORKS.{w:12} Filing an incident report.{w:12} Incident: SUCCESS. Over.'],
                  ['wait', 20],
                  ['narrate', 'Lin does not say anything for a while. She is reading four words.'],
                  ['say', 'lin', 'tired', "It's a machine.{w:20} It says that to everyone."],
                  ['say', 'pim', 'nosy', "It says it to you, though.{w:15} That's the whole of how being addressed works."],
                  ['say', 'lin', 'neutral', '...Yes.{w:20} Well.{w:15} Right.'],
                  ['emote', 'player', 'note'],
                ],
                [
                  ['think', "It's waited this long. It can wait a bit more."],
                ],
              ], { cancel: 1 }],
            ],
          },
          {
            cond: { flag: 'sw_token' },
            sprite: { obj: 'vending_machine' },
            trigger: 'action',
            commands: [
              ['think', 'OUT OF ORDER again.{w:20} It only had the one in it.'],
              ['think', 'Fair enough. It was a good one.'],
            ],
          },
        ],
      },

      /* ================================================================ the Four Clocks ====== */
      {
        id: 'clock_a',
        x: 20,
        y: 8,
        pages: [{ cond: null, sprite: { obj: 'sunk_clock' }, trigger: 'action', commands: clockCommands(1, 'west') }],
      },
      {
        id: 'clock_b',
        x: 23,
        y: 8,
        pages: [{ cond: null, sprite: { obj: 'sunk_clock' }, trigger: 'action', commands: clockCommands(2, 'second') }],
      },
      {
        id: 'clock_c',
        x: 26,
        y: 8,
        pages: [{ cond: null, sprite: { obj: 'sunk_clock' }, trigger: 'action', commands: clockCommands(3, 'third') }],
      },
      {
        id: 'clock_d',
        x: 29,
        y: 8,
        pages: [{ cond: null, sprite: { obj: 'sunk_clock' }, trigger: 'action', commands: clockCommands(4, 'east') }],
      },

      /* ================================================================ door: ON TIME ======== */
      {
        id: 'door_on_time',
        x: 30,
        y: 6,
        pages: [{
          cond: null,
          sprite: null,
          trigger: 'action',
          commands: [
            ['call', 'ce_sw_clocks'],
            ['if', { var: ['clocks_right', '<', 4] }, [
              ['narrate', 'A small brass slot. Above it, stamped into the rock: {c:blue}ON TIME{/c}.'],
              ['narrate', 'A card sits in the slot: WHEN THE CLOCKS AGREE.'],
              ['end'],
            ], []],
            ['sfx', 'sfx_door_open'],
            ['narrate', 'The ON TIME door opens the instant the clocks agree,\nas if it had been standing there with its hand on the latch.'],
            ['setVar', 'sw_loops', '+', 1],
            ['transfer', 'slack_water', 4, 24, 'down', { fade: 'black' }],
            ['wait', 15],
            ['if', { var: ['sw_loops', '==', 1] }, [
              ['think', 'We went through the correct door.{w:20} And it put us back at the beginning.'],
              ['say', 'lin', 'stern', 'That is not what doors are FOR.'],
            ], []],
            ['if', { var: ['sw_loops', '==', 2] }, [
              ['say', 'pim', 'puzzled', "Is this the same bit?{w:15} It's the same bit."],
            ], []],
            ['if', { var: ['sw_loops', '>=', 3] }, [
              ['say', 'odo', 'neutral', "I've SEEN that in-tray. Over."],
            ], []],
            ['if', { var: ['sw_loops', '==', 3] }, [
              ['say', 'lin', 'tired', 'Being right is taking us round in a circle.'],
              ['say', 'lin', 'tired', '...I would like that written down somewhere it cannot be read.'],
            ], []],
          ],
        }],
      },

      /* ================================================================ door: LATE =========== */
      {
        id: 'door_late',
        x: 32,
        y: 6,
        pages: [{
          cond: null,
          sprite: null,
          trigger: 'action',
          commands: [
            ['call', 'ce_sw_clocks'],
            ['if', { var: ['clocks_right', '==', 3] }, [
              ['setFlag', 'late_door_open', true],
              ['sfx', 'sfx_door_open'],
              ['narrate', 'The LATE door opens.{w:20}\nIt does not seem pleased about it.'],
              ['say', 'lin', 'relieved', '...Oh.'],
              ['transfer', 'slack_water', 20, 12, 'down', { fade: 'black' }],
              ['wait', 20],
              ['narrate', 'Inside, everything has been ironed.\nEven the things that were never meant to be flat.'],
              ['think', 'Tablecloths. Pillowcases. A whole tide table, pressed.'],
              ['say', 'odo', 'quiet', "It's warm in here.{w:15} I don't like that it's warm. Over."],
              ['end'],
            ], []],
            ['narrate', 'Stamped into the rock: {c:red}LATE{/c} — PLEASE BE ON TIME.'],
            ['if', { var: ['clocks_right', '==', 4] }, [
              ['narrate', 'The slot stays shut. Everything is correct, and it will not open.'],
              ['say', 'pim', 'puzzled', 'It only opens for people who are late?'],
              ['say', 'lin', 'stern', '...One of the clocks has to be wrong.'],
              ['wait', 25],
              ['say', 'lin', 'tired', 'On purpose.'],
              ['say', 'odo', 'grin', 'Being bad at something ON PURPOSE.{w:12} Finally, my department. Over.'],
              ['end'],
            ], []],
            ['if', { var: ['clocks_right', '<=', 2] }, [
              ['say', 'lin', 'stern', 'One mistake is human.{w:20} This is just mess.'],
              ['end'],
            ], []],
            ['narrate', 'A card in the slot: ONE MISTAKE ONLY.'],
          ],
        }],
      },

      /* ================================================================ back out of the flat = */
      {
        id: 'flat_back',
        x: 14,
        y: 12,
        pages: [{
          cond: null,
          sprite: null,
          trigger: 'action',
          commands: [
            ['narrate', 'A letter box, at ankle height, in the wall of the flat.'],
            ['choice', ['Squeeze back out.', 'Stay.'], [
              [
                ['sfx', 'sfx_door_open'],
                ['transfer', 'slack_water', 32, 7, 'down', { fade: 'black' }],
              ],
              [],
            ], { cancel: 1 }],
          ],
        }],
      },

      /* ================================================================ the boss ============= */
      {
        id: 'fine_tower',
        x: 27,
        y: 13,
        pages: [
          {
            cond: { notFlag: 'sw_boss_done' },
            sprite: { enemy: 'boss_perfectly_fine' },
            solid: true,
            trigger: 'action',
            move: { type: 'still' },
            commands: [
              ['think', 'A tower of ironing, twice as tall as Odo, with a paper plate on a stick for a face.'],
              ['think', 'It is smiling.{w:20} It has been smiling for a long time.'],
            ],
          },
          {
            cond: { flag: 'sw_boss_done' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['narrate', 'A heap of warm washing, thoroughly creased, fast asleep.'],
            ],
          },
        ],
      },
      {
        id: 'fine_trigger',
        x: 24,
        y: 13,
        pages: [{
          cond: { notFlag: 'sw_boss_done' },
          sprite: null,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_encounter'],
            ['emote', 'player', '!'],
            ['bgmFade', 600],
            ['narrate', 'The tower of ironing turns around.\nIt does this without moving, which is worse.'],
            ['say', 'odo', 'scared', 'It\'s a PILE.{w:12} It\'s a pile and it is LOOKING at us. Over.'],
            ['say', 'pim', 'nosy', 'Excuse me — are you all right?'],
            ['narrate', 'The paper mask beams.\n"No trouble at all! None! Look how flat everything is!"'],
            ['say', 'lin', 'neutral', '...'],
            ['say', 'lin', 'angry', 'I know that voice.{w:20} I do that voice.'],

            ['battle', 'troop_fine', {
              canEscape: false,
              bgm: 'bgm_boss',
              onPeace: [
                ['setFlag', 'fine_delivered', true],
                ['narrate', 'The mask comes off the stick and lands face up in the paper.'],
                ['narrate', '"...Could somebody else do the ironing? Just once?"'],
                ['say', 'lin', 'relieved', 'Yes.{w:20} Obviously yes.'],
                ['narrate', 'The whole tower unfolds into one enormous paper gull\nand goes up through the ceiling of the sea.'],
              ],
              onWin: [
                ['setFlag', 'fine_hushed', true],
                ['narrate', 'The tower goes over sideways, very neatly, and stops being anything at all.'],
                ['narrate', 'The mask is still smiling on the floor.\nNobody picks it up.'],
                ['say', 'lin', 'tired', '...That was quicker.'],
                ['say', 'odo', 'quiet', 'Yeah. Over.'],
              ],
              onLose: 'gameover',
            }],

            ['setFlag', 'sw_boss_done', true],
            ['erase', 'fine_tower'],
            ['wait', 30],

            /* --- Lin says the thing (bible 5.5) ------------------------------------------- */
            ['say', 'lin', 'relieved', 'I need help.{w:25} There.{w:20} It\'s said.'],
            ['say', 'lin', 'relieved', 'It was item one all along.{w:15} I just kept moving it to tomorrow.'],
            ['say', 'odo', 'grin', 'Helping is GO. Over.'],
            ['say', 'pim', 'delighted', "I'm very good at carrying things! That's nearly all I am!"],
            ['think', "Say something. {w:20}Say 'me too'. {w:20}Say anything."],
            ['say', 'wren', 'small_smile', 'Tomorrow\'s full.{w:20} Do it today.'],
            ['say', 'lin', 'fond', 'Noted.'],
            ['setFlag', 'lin_told', true],
            ['sfx', 'sfx_level_up'],
            ['narrate', 'Lin learned {big}I Need Help{/big}.\nWren and Lin can now call {big}By the Book{/big}.'],
            ['wait', 20],

            /* --- the third slip ------------------------------------------------------------ */
            ['sfx', 'sfx_page'],
            ['say', 'nacre', null, 'LEAST SAID, SOONEST MENDED.'],
            ['say', 'lin', 'stern', 'Who keeps printing these.'],
            ['say', 'pim', 'puzzled', 'Somebody with lovely manners.{w:20} I said that last time and I liked it less this time.'],
            ['think', "Least said.{w:25} Yeah. {w:15}I've tried that one."],
            ['wait', 20],
            ['call', 'ce_tide_done'],
          ],
        }],
      },

      /* ================================================================ secret bench 2 ======= */
      {
        id: 'bench_two',
        x: 2,
        y: 11,
        pages: [
          {
            cond: { notFlag: 'bench_2' },
            sprite: { obj: 'bench_lull' },
            trigger: 'action',
            commands: [
              ['narrate', 'A bench, behind the pool, facing nothing in particular.\nThe paper on it is not even creased.'],
              ['choice', ['Sit down.', 'Not now.'], [
                [
                  ['setFlag', 'bench_2', true],
                  ['bgmFade', 900],
                  ['narrate', 'They sit.{w:30}\nNothing comes in. Nothing goes out.'],
                  ['say', 'odo', 'neutral', "Minute's rest.{w:12} Logged. Over."],
                  ['say', 'lin', 'tired', 'One minute.{w:20} I have a schedule.'],
                  ['say', 'pim', 'delighted', "I've never sat!{w:15} It's just standing, but lower!"],
                  ['think', 'This is all right.'],
                  ['wait', 40],
                  ['fade', 'out', 60, 'black'],
                  ['cg', 'cg_lin_asleep', { fade: 1 }],        // T3 art; the narration below stands on its own without it
                  ['fade', 'in', 60, 'black'],
                  ['wait', 40],
                  ['narrate', 'Lin is asleep against an in-tray stack, glasses gone crooked,\nplait over one shoulder, mouth very slightly open.'],
                  ['narrate', 'Odo takes off his life vest and puts it over her,\ncarefully, the way a person defuses something.'],
                  ['wait', 20],
                  ['say', 'pim', 'nosy', '{small}Shall I read her mail?{/small}'],
                  ['narrate', 'Wren puts one finger to her lips.'],
                  ['say', 'pim', 'blurt', '{small}...Roger.{/small}'],
                  ['say', 'odo', 'quiet', '{small}She makes everyone\'s packed lunches. Over.{/small}'],
                  ['wait', 50],
                  ['fade', 'out', 60, 'black'],
                  ['cg', null, { fade: 1 }],
                  ['fade', 'in', 60, 'black'],
                  ['bgm', 'bgm_slack_water', { fadeMs: 1200 }],
                  ['narrate', 'One minute, they all agree afterwards.\nIt was eleven.'],
                ],
                [
                  ['think', "Benches down here are a trap. You'd never get up."],
                ],
              ], { cancel: 1 }],
            ],
          },
          {
            cond: { flag: 'bench_2' },
            sprite: { obj: 'bench_lull' },
            trigger: 'action',
            commands: [
              ['narrate', 'The bench. Creased now, in four places.'],
              ['think', 'Improved.'],
            ],
          },
        ],
      },

      /* ================================================================ Second-Class Stan ==== */
      {
        id: 'stan',
        x: 32,
        y: 17,
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
            ['say', 'pim', 'delighted', 'A colleague!'],
            ['say', 'stan', null, '...Nearly there.'],
            ['think', "He's a screen further along than yesterday. {w:15}Which is more than most of us."],
          ],
        }],
      },

      /* ================================================================ roaming Unsent ======= */
      {
        id: 'roam_listworm',
        x: 17,
        y: 7,
        enemy: { troop: 'troop_listworm_overdue', sprite: 'listworm', move: { type: 'chase', sight: 4 }, respawn: false },
      },
      {
        id: 'roam_overdue',
        x: 8,
        y: 17,
        enemy: { troop: 'troop_listworm_overdue', sprite: 'overdue_notice', move: { type: 'chase', sight: 4 }, respawn: false },
      },
      {
        id: 'roam_chain',
        x: 28,
        y: 19,
        enemy: { troop: 'troop_chain_listworm', sprite: 'chain_letter', move: { type: 'chase', sight: 4 }, respawn: false },
      },
      /* the two optional-corner guards (bible 8.9) */
      {
        id: 'roam_blank',
        x: 7,
        y: 22,
        enemy: { troop: 'troop_blank_reply', sprite: 'blank_postcard', move: { type: 'chase', sight: 4 }, respawn: false },
      },
      {
        id: 'roam_draft',
        x: 27,
        y: 25,
        enemy: { troop: 'troop_draft', sprite: 'draft_47', move: { type: 'chase', sight: 4 }, respawn: false },
      },

      /* the price of Keeping in Shore segment 3 (bible 6.11, CONTENT_CONTRACT 4) */
      {
        id: 'kept_later',
        x: 24,
        y: 19,
        pages: [{
          cond: { var: ['seg3_kept', '>', 0] },
          sprite: { enemy: 'kept_later' },
          solid: false,
          trigger: 'touch',
          move: { type: 'chase', sight: 4 },
          commands: [
            ['battle', 'troop_kept_3', {
              canEscape: false,
              onPeace: [
                ['call', 'ce_late_said_3'],
                ['erase', 'kept_later'],
              ],
              onWin: [
                ['narrate', 'It goes quiet, and folds itself away somewhere in the paper.'],
                ['say', 'pim', 'puzzled', "It'll be back, I think.{w:15} Things like that keep their appointments."],
                ['erase', 'kept_later'],
              ],
              onLose: 'gameover',
            }],
          ],
        }],
      },

      /* ================================================================ things to poke ======= */
      {
        id: 'look_trays_north',
        x: 11,
        y: 2,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['think', 'An in-tray, stacked up taller than me. Every tray full. Every tray labelled TO DO.'],
              ['think', 'Nobody has written what.'],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['think', 'The top tray has one sheet in it that just says "sorry about the".'],
              ['think', 'I looked underneath. {w:15}There is no second page. {w:15}That was the whole thing.'],
            ],
          },
        ],
      },
      {
        id: 'look_pool_mirror',
        x: 10,
        y: 13,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['think', 'The pool is so still it has a ceiling.'],
              ['think', 'Four of us up there, upside down, waiting to be told what the plan is.'],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['say', 'odo', 'grin', 'Watch this. {w:12}Watch. {w:12}WATCH.'],
              ['sfx', 'sfx_splash'],
              ['narrate', 'Odo drops a stamp in the pool. The ceiling wobbles and puts itself back.'],
              ['say', 'lin', 'stern', 'That was legal tender.'],
              ['say', 'odo', 'boast', 'It was an EXPERIMENT. Over.'],
            ],
          },
        ],
      },
      {
        id: 'look_ironing',
        x: 4,
        y: 6,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['think', 'An ironing board, set up on the seabed, with nobody near it.'],
              ['think', 'Still warm.'],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['think', "Still warm. {w:20}I've checked four times now. I'm going to stop checking."],
            ],
          },
        ],
      },
      {
        id: 'look_washing',
        x: 10,
        y: 6,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['narrate', 'A washing line, pegged with letters instead of shirts.\nThey have all been rinsed until the writing came off.'],
              ['say', 'pim', 'puzzled', 'Oh, that is not what a wash is FOR.'],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['think', 'One of them still has half a word on it.{w:20} "—ways."'],
              ['say', 'pim', 'blurt', "That's not mine.{w:20} ...That's not mine."],
            ],
          },
        ],
      },
      {
        id: 'look_clock_decor',
        x: 8,
        y: 16,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['think', 'A grandfather clock, buried to the waist in paper like a groyne in sand.'],
              ['think', 'No hands. Just the word SOON, painted on, quite recently.'],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['think', 'Still SOON.'],
            ],
          },
        ],
      },
      {
        id: 'look_flat_laundry',
        x: 18,
        y: 14,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['narrate', 'A folded pile, pressed so hard the creases have gone shiny.'],
              ['think', "Every one of these is somebody saying they're fine."],
              ['think', "Mum does this with tea towels when she's had a week."],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['think', 'I unfolded one.{w:25} It says FINE on the inside too.'],
              ['think', 'I folded it back. {w:15}Badly. {w:15}On purpose.'],
            ],
          },
        ],
      },

      /* ================================================================ hidden things ======== */
      {
        id: 'item_letter_pile',
        x: 4,
        y: 22,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: { obj: 'letter_pile' },
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['narrate', 'A drift of letters in the sand, all of them addressed and none of them stamped.'],
              ['sfx', 'sfx_chest_open'],
              ['giveItem', 'glass_red', 2],
              ['think', "Two red chips down in the middle. {w:15}Somebody was cross enough to leave sharp bits."],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: { obj: 'letter_pile' },
            trigger: 'action',
            commands: [
              ['think', "Just paper now. {w:15}Very cross paper."],
            ],
          },
        ],
      },
      {
        id: 'item_mail_sack',
        x: 31,
        y: 25,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: { obj: 'mail_sack' },
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['sfx', 'sfx_chest_open'],
              ['narrate', 'A mail sack, tied at the neck, propped in the corner where the paper runs out.'],
              ['giveItem', 'flask_of_tea', 1],
              ['giveItem', 'glass_green', 1],
              ['say', 'lin', 'fond', 'A flask.{w:15} Somebody packed a flask for somebody.'],
              ['say', 'lin', 'neutral', 'It only works on other people, mind. Put it away until it is needed.'],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: { obj: 'mail_sack' },
            trigger: 'action',
            commands: [
              ['think', 'Empty sack. {w:15}Warm at the bottom, which I am choosing not to think about.'],
            ],
          },
        ],
      },
      {
        id: 'creature_sack',
        x: 12, y: 26,
        pages: [{
          cond: null,
          sprite: { obj: 'mail_sack' },
          trigger: 'action',
          commands: [
            ['narrate', 'This sack has two small eyes near the top and is breathing.'],
            ['say', 'pim', 'nosy', 'Hello! Are you post, or are you a person?'],
            ['narrate', 'The sack thinks about it for a long time.'],
            ['narrate', '"...Both. Been in the queue since March."'],
            ['say', 'odo', 'neutral', 'Respect. Over.'],
          ],
        }],
      },
    ],

    onEnter: [
      ['if', { notFlag: 'sw_seen_intro' }, [
        ['setFlag', 'sw_seen_intro', true],
        ['wait', 20],
        ['think', 'Slack water.{w:20} The bit between tides when the sea cannot be bothered either way.'],
        ['think', 'Somebody has ruled lines on the seabed.{w:25} Somebody has filed the sea.'],
        ['say', 'pim', 'puzzled', "I appear to contain the phrase 'and anyway'.{w:20} Eleven times.{w:15} Is that normal?"],
        ['say', 'lin', 'stern', 'It is poor style.'],
        ['say', 'pim', 'delighted', 'Oh good.{w:15} I was worried it was a lot.'],
        ['say', 'odo', 'neutral', "Nothing down here is doing anything.{w:15} I don't trust it. Over."],
        ['say', 'lin', 'tired', 'It is the calmest place I have ever stood in and I would like to leave.'],
        ['think', 'Lin was late this evening. {w:20}First time ever.'],
        ['think', "Nobody said anything about it. {w:15}That's the rule here."],
      ], []],
    ],
  });
})();
