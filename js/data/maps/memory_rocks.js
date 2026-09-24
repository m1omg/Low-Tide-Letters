/*
 * memory_rocks.js - The Rocks, Last September (DESIGN_BIBLE 4.2 #10, 5.6).
 *
 * Not a place: a thing that happened. Sepia, sunny, ordinary, unbearable. Entered only through the
 * bottom hatch of `undertow_light`; left only by script, and by then everything is different.
 *
 * Owner: lull_2. Contract interfaces:
 *   in   undertow_light bottom hatch -> (12,15) facing up
 *   out  by script -> undertow_light (16,26) facing up, then ['call','ce_tide_done']
 *
 * Own flags are prefixed mr_. Bible flags set here: truth_known, pim_knows, memory_rocks_done.
 * No roaming Unsent and no rock pool live here (bible 8.8 / 8.9).
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};

  /* ------------------------------------------------------------------ common events (mine) */

  Object.assign(G.DATA.commonEvents, {

    /**
     * The whole climax of Tide 4: the three words, the battle, what the friends learn, and the slip.
     * Called by the three trigger tiles at the foot of the rocks so that none of them can be walked past.
     */
    ce_mr_memory: {
      name: 'The Rocks: the three words',
      commands: [
        ['setFlag', 'mr_seen', true],
        ['move', 'player', ['face_up'], { wait: true }],
        ['camera', [12, 8], 60],
        ['wait', 40],

        ['narrate', 'There are two girls on the third groyne, sitting with their backs to a sea\nthat is only ordinarily far out.'],
        ['narrate', 'One of them is eleven, in a coat she has not grown into yet.\nThe other has dark red hair in two puffs and yellow wellies with daisies on.'],
        ['think', "I know what she's going to say. {w:25}I've known all weekend."],
        ['wait', 25],
        ['sfx', 'sfx_static'],
        ['say', 'tam', null, 'They sold the Marigold.{w:25} We have to go inland.'],
        ['say', 'tam', null, 'I wanted to tell you first.'],
        ['wait', 30],
        ['bgmFade', 1400],
        ['sfx', 'sfx_heartbeat'],

        ['custom', 'ghost_choice', {
          prompt: 'The eleven-year-old opens her mouth.',
          options: [
            { text: "I don't want you to go.", ghost: true },
            { text: 'Who am I going to talk to?', ghost: true },
            { text: 'Fine. Go then.', ghost: false },
          ],
          varName: 'mr_choice',
        }],

        /* the rest arrives without being asked for (bible 5.6) */
        ['say', 'wren', 'frozen', 'Fine. Go then.{w:70} I was getting bored of you anyway.'],
        ['wait', 40],
        ['shake', 3, 20],
        ['narrate', 'The girl in the yellow wellies does not say anything back.'],
        ['narrate', 'She picks up the jar between them and goes down off the rocks,\nputting her feet in the places they always put their feet.'],
        ['wait', 30],
        ['camera', 'player', 40],
        ['say', 'odo', 'quiet', "...Oh.{w:30} It's what you said to me."],
        ['wait', 25],
        ['say', 'wren', 'frozen', '...'],
        ['say', 'lin', 'neutral', 'Wren.'],
        ['say', 'wren', 'frozen', "Don't."],

        /* --- the scripted battle (bible 5.6, 6.13) ---------------------------------------- */
        ['sfx', 'sfx_encounter'],
        ['emote', 'player', '!'],
        ['narrate', 'Three shapes come up out of the shingle wearing paper bibs.\nFINE.{w:15} GO.{w:15} THEN.'],
        ['say', 'pim', 'brave', "They're only the words.{w:20} Words can be listened to."],
        ['battle', 'troop_three_words', {
          canEscape: false,
          bgm: 'bgm_other_can',
          onPeace: [
            ['narrate', 'Having finally been listened to, the three of them unfold into gulls\nand go up the beach in the wrong direction, like gulls do.'],
          ],
          onWin: [
            ['narrate', 'The three of them unfold into gulls and go up the beach\nin the wrong direction, like gulls do.'],
          ],
          onLose: 'gameover',
        }],
        ['wait', 30],

        /* --- the friends learn, in four short boxes ---------------------------------------- */
        ['say', 'wren', 'crying_smile', 'Her name is Tam.{w:20} She rang the can line on her last night.'],
        ['say', 'wren', 'crying_smile', 'For an hour.{w:25} I heard every word of it through a pillow.'],
        ['say', 'wren', 'crying_smile', 'In the morning I watched the van go from behind the curtain.'],
        ['say', 'wren', 'crying_smile', 'She left a jam jar of our best glass on the step.{w:20} "Keep the good ones."\nIt is under my bed. I have never opened it.'],
        ['setFlag', 'truth_known', true],
        ['wait', 30],

        ['say', 'lin', 'stern', 'One: that was unkind.{w:15} Two: you were eleven.'],
        ['say', 'lin', 'fond', "Three: you are not a 'kind of friend'.{w:20} You're a friend who did a thing."],
        ['say', 'odo', 'teary_grin', 'Permission to stay, Captain?{w:20} Over.'],
        ['wait', 20],
        ['say', 'wren', 'crying_smile', '...Granted.'],
        ['say', 'pim', 'brave', "Oh.{w:30} I'm yours, aren't I?{w:25} I'm the thing you didn't send."],
        ['say', 'pim', 'brave', "That's all right. {w:15}I'd rather be somebody's than nobody's."],
        ['setFlag', 'pim_knows', true],
        ['sfx', 'sfx_level_up'],
        ['narrate', 'Wren and Pim can now call {big}First Class{/big}.'],
        ['wait', 20],

        /* --- Nobody leaves (no cg_nobody_leaves yet: narration carries it) ------------------ */
        ['bgmFade', 1500],
        ['fade', 'out', 70, 'white'],
        ['wait', 40],
        ['narrate', 'Nobody goes back up the rocks.'],
        ['narrate', 'They sit down on the groyne in a row, all four of them,\nwith their backs to a sea that is much too far away.'],
        ['narrate', 'Odo hands round a bag of chips that has been in his vest since Friday.\nThey are terrible. Everybody has some.'],
        ['wait', 30],
        ['narrate', '{big}Nobody leaves.{/big}'],
        ['wait', 50],
        ['fade', 'in', 70, 'white'],
        ['bgm', 'bgm_other_can', { fadeMs: 1600 }],

        /* --- the fourth slip --------------------------------------------------------------- */
        ['sfx', 'sfx_page'],
        ['say', 'nacre', null, 'YOU HAVE HAD A LONG DAY. LET ME KEEP IT FOR YOU.'],
        ['wait', 20],
        ['say', 'wren', 'neutral', 'No, thank you.'],
        ['say', 'lin', 'neutral', '...That is the first time anyone has answered one of those.'],
        ['say', 'odo', 'grin', 'Logged. Over.'],
        ['setFlag', 'memory_rocks_done', true],
        ['wait', 20],

        /* back up into the lighthouse, and then home (shore_a owns the clock) */
        ['fade', 'out', 50, 'black'],
        ['transfer', 'undertow_light', 16, 26, 'up', { fade: 'none' }],
        ['call', 'ce_tide_done'],
      ],
    },
  });

  /* ------------------------------------------------------------------ the map */

  G.registerMap('memory_rocks', {
    name: 'The Rocks, Last September',
    width: 24,
    height: 18,
    bgm: 'bgm_other_can',
    ambience: 'amb_sea',
    battleback: 'bb_lull_day',
    backdrop: '#6b5a3c',
    tint: [150, 110, 60, 0.25],
    start: { x: 12, y: 15, dir: 'up' },

    legend: {
      e: 'sea',
      k: 'rock',
      w: 'wet_sand',
      g: 'shingle',
    },

    ground: [
      'eeeeeeeeeeeeeeeeeeeeeeee',
      'eeeeeeeeeeeeeeeeeeeeeeee',
      'eeeeeeeeeeeeeeeeeeeeeeee',
      'eeeeeeweeeeeeeeeeeweeeee',
      'eweewwwwweewwweewwwwweee',
      'ewwwwkkkkkwwkwwwwwwwwwwe',
      'ewkkekkkkkkkkkkkwwwwwwwe',
      'ekkeeekkkkkkkkkkkkkkkkwe',
      'ekkkekkkkkkkkkkkkkeeekke',
      'ekkkkkkkkkkkkkkkkkkkkkke',
      'ewkkkkkkkkkwwwkkkkkkkkke',
      'ewwwwkkkkkwwwwkkkkkkkkwe',
      'ewwwwwwwwwwwggwwwwwwwwwe',
      'ewwwwwwwwwwggwwwwwwwwwwe',
      'ewwwwwgwwwwgggwwwwgwwwwe',
      'egwwgggggwwgggwwgggggwwe',
      'egggggggggggggggggggggge',
      'eeeeeeeeeeeeeeeeeeeeeeee',
    ],

    objects: [
      { obj: 'groyne', x: 4, y: 13 },
      { obj: 'groyne', x: 19, y: 12 },
      { obj: 'groyne', x: 8, y: 16 },
      { obj: 'lobster_pots', x: 2, y: 16 },
      { obj: 'lobster_pots', x: 20, y: 16 },
    ],

    events: [

      /* ================================================================ the memory =========== */
      /* three tiles across the only way up onto the rocks: it cannot be walked past */
      {
        id: 'trip_a',
        x: 11,
        y: 11,
        pages: [{
          cond: { notFlag: 'mr_seen' },
          sprite: null,
          trigger: 'touch',
          commands: [['call', 'ce_mr_memory']],
        }],
      },
      {
        id: 'trip_b',
        x: 12,
        y: 11,
        pages: [{
          cond: { notFlag: 'mr_seen' },
          sprite: null,
          trigger: 'touch',
          commands: [['call', 'ce_mr_memory']],
        }],
      },
      {
        id: 'trip_c',
        x: 13,
        y: 11,
        pages: [{
          cond: { notFlag: 'mr_seen' },
          sprite: null,
          trigger: 'touch',
          commands: [['call', 'ce_mr_memory']],
        }],
      },

      /* ================================================================ things to poke ======= */
      {
        id: 'look_sea',
        x: 12,
        y: 5,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['think', 'The sea. {w:20}Ordinarily far out. {w:15}Just an afternoon.'],
              ['think', 'Everybody keeps saying this weekend is the lowest tide in forty years.\nThis one was nothing. {w:20}This one was a Tuesday, practically.'],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['think', "It's the same sea. {w:20}That's the annoying part."],
            ],
          },
        ],
      },
      {
        id: 'look_groyne',
        x: 19,
        y: 12,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['think', 'The third groyne. {w:20}Ours, if you asked us then.'],
              ['think', 'Two flat bits on the top, worn smooth. {w:15}One each.'],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['think', 'Somebody scratched two letters into the tar, ages ago,\nand then scratched a line between them instead of an "and".'],
              ['think', 'It was me. {w:15}I did the line.'],
            ],
          },
        ],
      },
      {
        id: 'look_pots',
        x: 2,
        y: 16,
        pages: [
          {
            cond: { notSelf: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['setSelf', 'A', true],
              ['think', 'A lobster pot. Empty. {w:20}The lobsters have moved on.'],
              ['think', 'Good for them.'],
            ],
          },
          {
            cond: { self: 'A' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['think', 'Still empty. {w:15}I checked in case one had come back.'],
            ],
          },
        ],
      },
      {
        id: 'look_jar_spot',
        x: 13,
        y: 9,
        pages: [
          {
            cond: { notFlag: 'truth_known' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['think', 'There is a jam jar sitting on the rock between the two of them.\nBest glass only. Four colours.'],
              ['say', 'pim', 'nosy', 'Is that jar addressed to anybody?'],
              ['think', "Not yet."],
            ],
          },
          {
            cond: { flag: 'truth_known' },
            sprite: null,
            trigger: 'action',
            commands: [
              ['think', 'The jar is gone off the rock.'],
              ['think', 'It went as far as a doorstep, and then under a bed, and stopped there.'],
              ['say', 'lin', 'fond', 'Jars keep. {w:15}That is the entire point of jars.'],
            ],
          },
        ],
      },
    ],

    onEnter: [
      ['if', { notFlag: 'mr_arrived' }, [
        ['setFlag', 'mr_arrived', true],
        ['wait', 25],
        ['narrate', 'Last September.'],
        ['narrate', 'Sun on the wet sand, flat and yellow, like it has been left in a drawer.'],
        ['say', 'odo', 'scared', "Cap?{w:20} Where's the lighthouse gone? Over."],
        ['say', 'lin', 'tired', 'It has not gone anywhere. {w:15}We have.'],
        ['say', 'pim', 'puzzled', 'I know this beach.{w:25} I have never been anywhere,\nand I know this beach.'],
        ['think', 'Up on the rocks. {w:25}Third groyne along.'],
        ['think', "I could just stand here. {w:20}I've been standing here for a year."],
      ], []],
    ],
  });
})();
