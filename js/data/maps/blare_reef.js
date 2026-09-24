/*
 * blare_reef.js - BLARE REEF (40x28), Tide 2 of the Lull (DESIGN_BIBLE 4.2 row 7, 5.4, 8.2).
 *
 * A reef of coral shaped like gramophone horns and ship's funnels, every one of them shouting so that
 * nobody has to talk. Pim blurts a piece of himself here. Four pipe joints carry a whispered message to
 * the far horn; get them right and the reef goes quiet for the length of one true sentence.
 *
 * Owner: lull_1. Flags invented here are prefixed `blare_reef_`.
 */
G.registerMap('blare_reef', {
  name: 'Blare Reef',
  width: 40,
  height: 28,
  bgm: 'bgm_blare_reef',
  ambience: 'amb_lull',
  backdrop: '#3a1f28',
  battleback: 'bb_lull_day',
  tint: null,

  legend: {
    '#': 'reef_rock',
    'c': 'coral_floor',
    '.': 'pale_sand',
    '~': 'shallows',
    'D': 'deep_water',
  },

  ground: [
    '########################################',  /*  0 */
    '#######cccccccccccc####ccccccccccc######',  /*  1 */
    '#####ccccccccccccccc##ccccccccccccc#####',  /*  2 */
    '####ccccccccccccccccc#ccccccccccccc#####',  /*  3 */
    '####ccccccccccccccccccccccccccccccc#####',  /*  4 */
    '###cccccccccccccccccccccccccccccccc#####',  /*  5 */
    '###cccccccccc###ccccccccccccccccccc#####',  /*  6 */
    '###ccccccccc####ccccccccccccccccccc#####',  /*  7 */
    '###ccccccccc####ccccccccccccccccccc#####',  /*  8 */
    '###cccccccccc###ccccccccccccccccccc#####',  /*  9 */
    '###cccccccccccccccccccccccccccccccc#####',  /* 10 */
    '##...ccccccccccccccccccccccccccccccc####',  /* 11 */
    '#.....cccccccccccccccccccccccccccccc####',  /* 12 */
    '#......ccccccccccccccccccccccccccccc#c##',  /* 13 */
    '.......ccccccccccccccccccccccccccccccc##',  /* 14  (0,14) out to the Tide Steps; (36,14) the gate */
    '#......ccccccccccccccccccccccccccccc#c##',  /* 15 */
    '#.....cccccccccccccccccccccccccccc######',  /* 16 */
    '##...cccccccccccccccccccccccccccccc#####',  /* 17 */
    '###cccccccccccccccccccccccccccccccc#####',  /* 18 */
    '###cccccccccc###ccccccccccccccccccc#####',  /* 19 */
    '###ccccccccc####ccccccccccccccccccc#####',  /* 20 */
    '####~~~~~~~~####ccccccccccccccccccc#####',  /* 21 */
    '####~~~~~~~~~##cccccccccccccccccccc#####',  /* 22 */
    '####~~~~~~~~~~ccccccccccccccccccccc#####',  /* 23 */
    '#####~~~~~~~~~ccccccccccccccccc....#####',  /* 24 */
    '######~~~~~~~ccccccccccccccc.......#####',  /* 25 */
    '########DDDDDDDDDDcccccccccc....########',  /* 26 */
    '########################################',  /* 27 */
  ],

  objects: [
    /* the big horns */
    { obj: 'horn_coral_big', x: 11, y: 5 },
    { obj: 'horn_coral_big', x: 19, y: 9 },
    { obj: 'horn_coral_big', x: 28, y: 4 },
    { obj: 'horn_coral_big', x: 14, y: 18 },
    { obj: 'horn_coral_big', x: 24, y: 22 },
    { obj: 'horn_coral_big', x: 33, y: 20 },

    /* the four clue horns lean the way the sound wants to go (bible 8.2) */
    { obj: 'horn_coral_small', x: 17, y: 11, flipX: true },
    { obj: 'horn_coral_small', x: 21, y: 6 },
    { obj: 'horn_coral_small', x: 24, y: 17 },
    { obj: 'horn_coral_small', x: 32, y: 12, flipX: true },

    { obj: 'horn_coral_small', x: 8, y: 12 },
    { obj: 'horn_coral_small', x: 20, y: 24 },
    { obj: 'horn_coral_small', x: 30, y: 19 },
    { obj: 'horn_coral_small', x: 34, y: 16 },
    { obj: 'horn_coral_small', x: 6, y: 18 },
    { obj: 'horn_coral_small', x: 18, y: 21 },

    { obj: 'mail_sack', x: 12, y: 17 },
    { obj: 'mail_sack', x: 29, y: 24 },
    { obj: 'stamp_flower', x: 7, y: 13 },
    { obj: 'stamp_flower', x: 26, y: 20 },
    { obj: 'stamp_flower', x: 19, y: 25 },
  ],

  overrides: { block: [[10, 17]] },   // the rock pool's right half

  events: [
    /* ================================================================= back to the hub */
    {
      id: 'out_west',
      x: 0,
      y: 14,
      pages: [
        {
          cond: null,
          sprite: null,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_door_open'],
            ['transfer', 'tide_steps', 20, 24, 'left', { fade: 'black' }],
          ],
        },
      ],
    },

    /* ================================================================= the rock pool */
    {
      id: 'pool_reef',
      x: 8,
      y: 17,
      pages: [
        {
          cond: null,
          sprite: { obj: 'rock_pool' },
          trigger: 'action',
          commands: [
            ['custom', 'rock_pool', { joke: 'The pool is the only quiet thing on the reef. It is showing off about it.', id: 'pool_blare' }],
          ],
        },
      ],
    },

    /* ================================================================= Pim's first blurt (bible 5.4) */
    /* a trip line across the whole corridor (rows 13-15), so the beat cannot be walked round */
    ...[13, 14, 15].map(function (y) { return {
      id: 'pim_blurt_' + y,
      x: 10,
      y: y,
      pages: [
        {
          cond: { notFlag: 'blare_reef_blurt' },
          sprite: null,
          trigger: 'touch',
          commands: [
            ['setFlag', 'blare_reef_blurt', true],
            ['sfx', 'sfx_page'],
            ['say', 'pim', 'nosy', 'Memo! A memo went past! {w:15}"TO ALL: THE MEETING WAS FINE. THE MEETING WAS ALWAYS GOING TO BE FINE."'],
            ['say', 'pim', 'delighted', 'I do love a memo.'],
            ['wait', 25],
            ['sfx', 'sfx_glitch'],
            ['say', 'pim', 'blurt', "...and anyway YOU were the one who— {w:30}oh. {w:25}That's not a nice bit."],
            ['say', 'pim', 'puzzled', 'Whose is that? {w:20}Is that MINE?'],
            ['wait', 20],
            ['say', 'wren', 'frozen', '...'],
            ['think', "Don't.{w:25} Don't read the rest of it."],
            ['say', 'odo', 'neutral', 'Wren? Your face has gone all— {w:15}Over.'],
            ['say', 'lin', 'neutral', 'Leave it. {w:15}Pim, inside voice.'],
            ['say', 'pim', 'puzzled', "I haven't got an inside voice. I'm all inside."],
            ['wait', 20],
            ['think', 'Four pages. {w:20}He said four pages.'],
          ],
        },
      ],
    }; }),

    /* ================================================================= the Horn Pipes (bible 8.2) */
    {
      id: 'pipe_a',
      x: 16,
      y: 11,
      pages: [
        {
          cond: null,
          sprite: { obj: 'horn_pipe' },
          trigger: 'action',
          commands: [
            ['if', { notSelf: 'A' }, [
              ['setSelf', 'A', true],
              ['narrate', 'A joint of coral pipe, loose in its socket. Beside it a little horn leans over, listening one way.'],
              ['say', 'lin', 'stern', 'Sound follows the lean. Obviously.'],
              ['say', 'odo', 'boast', 'Obviously. {w:15}...Obviously WHAT. Over.'],
            ], []],
            ['think', 'The little horn beside this one leans right.'],
            ['if', { var: ['pipe_a', '==', 0] }, [
              ['setVar', 'pipe_a', '=', 1],
              ['sfx', 'sfx_switch'],
              ['narrate', 'The joint swings over. It now points right.'],
            ], [
              ['setVar', 'pipe_a', '=', 0],
              ['sfx', 'sfx_switch'],
              ['narrate', 'The joint swings over. It now points left.'],
            ]],
          ],
        },
      ],
    },
    {
      id: 'pipe_b',
      x: 22,
      y: 6,
      pages: [
        {
          cond: null,
          sprite: { obj: 'horn_pipe' },
          trigger: 'action',
          commands: [
            ['think', 'The little horn beside this one leans left.'],
            ['if', { var: ['pipe_b', '==', 0] }, [
              ['setVar', 'pipe_b', '=', 1],
              ['sfx', 'sfx_switch'],
              ['narrate', 'The joint swings over. It now points right.'],
            ], [
              ['setVar', 'pipe_b', '=', 0],
              ['sfx', 'sfx_switch'],
              ['narrate', 'The joint swings over. It now points left.'],
            ]],
          ],
        },
      ],
    },
    {
      id: 'pipe_c',
      x: 25,
      y: 17,
      pages: [
        {
          cond: null,
          sprite: { obj: 'horn_pipe' },
          trigger: 'action',
          commands: [
            ['think', 'The little horn beside this one leans left, into the rock, like it is sulking.'],
            ['if', { var: ['pipe_c', '==', 0] }, [
              ['setVar', 'pipe_c', '=', 1],
              ['sfx', 'sfx_switch'],
              ['narrate', 'The joint swings over. It now points right.'],
            ], [
              ['setVar', 'pipe_c', '=', 0],
              ['sfx', 'sfx_switch'],
              ['narrate', 'The joint swings over. It now points left.'],
            ]],
          ],
        },
      ],
    },
    {
      id: 'pipe_d',
      x: 31,
      y: 12,
      pages: [
        {
          cond: null,
          sprite: { obj: 'horn_pipe' },
          trigger: 'action',
          commands: [
            ['think', 'The little horn beside this one leans right, towards the big shut one at the end.'],
            ['if', { var: ['pipe_d', '==', 0] }, [
              ['setVar', 'pipe_d', '=', 1],
              ['sfx', 'sfx_switch'],
              ['narrate', 'The joint swings over. It now points right.'],
            ], [
              ['setVar', 'pipe_d', '=', 0],
              ['sfx', 'sfx_switch'],
              ['narrate', 'The joint swings over. It now points left.'],
            ]],
          ],
        },
      ],
    },

    /* ----------------------------------------------------------------- the mouth horn: the test message */
    {
      id: 'horn_mouth',
      x: 9,
      y: 16,
      pages: [
        {
          cond: { notFlag: 'pipes_solved' },
          sprite: { obj: 'horn_coral_big' },
          trigger: 'action',
          commands: [
            ['narrate', 'A coral horn the size of a chimney pot, its mouth down at knee height. Four joints of pipe run off from it into the reef.'],
            ['say', 'odo', 'boast', 'Test message. Volunteering. {w:10}Over.'],
            ['say', 'lin', 'stern', 'Whisper it. The question is whether the pipes carry it, not whether you can be heard in Norway.'],
            ['sfx', 'sfx_whisper'],
            ['narrate', 'Odo leans right into the horn and whispers something with his hand round his mouth.'],
            ['wait', 40],

            ['setVar', 'pipes_wrong', '=', 0],
            ['if', { var: ['pipe_a', '!=', 1] }, [['setVar', 'pipes_wrong', '+', 1]], []],
            ['if', { var: ['pipe_b', '!=', 0] }, [['setVar', 'pipes_wrong', '+', 1]], []],
            ['if', { var: ['pipe_c', '!=', 0] }, [['setVar', 'pipes_wrong', '+', 1]], []],
            ['if', { var: ['pipe_d', '!=', 1] }, [['setVar', 'pipes_wrong', '+', 1]], []],

            /* ---- four wrong ---- */
            ['if', { var: ['pipes_wrong', '==', 4] }, [
              ['sfx', 'sfx_drone_hit'],
              ['shake', 3, 20],
              ['narrate', 'Far off at the east end, the big shut horn booms:\n{big}WEIRD MUFFIN.{/big}'],
            ], []],
            ['if', { var: ['pipes_wrong', '==', 3] }, [
              ['sfx', 'sfx_drone_hit'],
              ['shake', 3, 20],
              ['narrate', 'The far horn booms:\n{big}WE\'RE MOOING.{/big}'],
              ['say', 'lin', 'neutral', 'Closer. That was cows.'],
            ], []],
            ['if', { var: ['pipes_wrong', '==', 2] }, [
              ['sfx', 'sfx_drone_hit'],
              ['shake', 3, 20],
              ['narrate', 'The far horn booms:\n{big}DEER MOVING.{/big}'],
              ['say', 'pim', 'delighted', 'Deer! {w:15}Moving! {w:15}That is lovely news for the deer.'],
            ], []],
            ['if', { var: ['pipes_wrong', '==', 1] }, [
              ['sfx', 'sfx_drone_hit'],
              ['shake', 3, 20],
              ['narrate', 'The far horn booms:\n{big}WE\'RE... MUFFING?{/big}'],
              ['say', 'odo', 'scared', 'ONE joint. One. Over.'],
            ], []],
            ['if', { var: ['pipes_wrong', '>', 0] }, [
              ['say', 'lin', 'stern', 'What did you actually say?'],
              ['say', 'odo', 'quiet', '...Classified. Over.'],
              ['think', 'Four joints. Four little horns, all leaning somewhere.'],
            ], []],

            /* ---- none wrong: the reef goes quiet (bible 5.4) ---- */
            ['if', { var: ['pipes_wrong', '==', 0] }, [
              ['setFlag', 'pipes_solved', true],
              ['bgmFade', 900],
              ['ambience', null],
              ['wait', 40],
              ['narrate', 'The reef stops.'],
              ['wait', 30],
              ['narrate', 'Every horn on it takes a breath at the same time, and for the first time since the sea went out, nobody is shouting.'],
              ['wait', 30],
              ['sfx', 'sfx_answer_sting'],
              ['narrate', 'Far off at the east end, one small horn says it, clearly, in Odo\'s voice:'],
              ['say', 'odo', 'quiet', "We're moving. In winter. I didn't want it to be true. Over."],
              ['wait', 45],
              ['say', 'odo', 'quiet', "Dad says if you don't say a thing out loud it might not happen. I've been not saying it SO hard."],
              ['say', 'lin', 'neutral', "Odo. That's not how things work."],
              ['say', 'odo', 'quiet', 'I KNOW. {w:15}Over.'],
              ['say', 'pim', 'brave', "It doesn't make it more real. I carry four pages of something and I'm exactly as real as I was before. Just less lonely, now you know."],
              ['setFlag', 'odo_told', true],
              ['wait', 30],
              ['say', 'wren', 'neutral', 'Oh.'],
              ['wait', 20],
              ['think', 'Not again.'],
              ['wait', 25],

              /* ---- the reef takes offence: set piece ---- */
              ['sfx', 'sfx_encounter'],
              ['shake', 6, 45],
              ['narrate', 'Then the reef gets its breath back, and it is OFFENDED.'],
              ['battle', 'troop_big_noise', {
                canEscape: false,
                onPeace: [
                  ['narrate', 'Three horns unfold into paper gulls and go up through the water together, still faintly humming.'],
                  ['say', 'lin', 'relieved', 'Delivered. All three. I have written the time down and I am not sorry.'],
                  ['say', 'odo', 'teary_grin', 'Medal for the pipes. Awarded to: the pipes. Over.'],
                ],
                onWin: [
                  ['narrate', 'The horns go quiet one after another, like windows shutting along a street.'],
                  ['say', 'odo', 'quiet', "Quieter. {w:20}...I'm not sure I like it quieter. Over."],
                ],
                onLose: 'gameover',
              }],
              ['wait', 20],
              ['sfx', 'sfx_push'],
              ['shake', 4, 36],
              ['narrate', 'At the east end of the reef, something enormous swings open a hand\'s width.'],
              ['say', 'lin', 'neutral', 'East. Two of you in front, please. I have a bad feeling and a good torch.'],
            ], []],
          ],
        },
        {
          cond: { flag: 'pipes_solved' },
          sprite: { obj: 'horn_coral_big' },
          trigger: 'action',
          commands: [
            ['think', 'The horn has nothing left to carry. It hums a bit, to be polite.'],
            ['say', 'odo', 'grin', 'Say something into it. {w:15}Go on. {w:15}...You do not have to. Over.'],
          ],
        },
      ],
    },

    /* ----------------------------------------------------------------- the Great Horn gate */
    {
      id: 'great_horn',
      x: 36,
      y: 14,
      pages: [
        {
          cond: null,
          sprite: { obj: 'horn_coral_big' },
          trigger: 'action',
          commands: [
            ['think', 'The Great Horn. Shut like a fist.'],
            ['think', 'You can feel it breathing through the rock. In, {w:15}and in, {w:15}and in.'],
          ],
        },
        { cond: { flag: 'pipes_solved' }, sprite: null, solid: false, trigger: 'action', commands: [] },
      ],
    },

    /* ----------------------------------------------------------------- the shelf behind it: slip two */
    {
      id: 'slip_two',
      x: 37,
      y: 14,
      pages: [
        {
          cond: { notFlag: 'blare_reef_slip' },
          sprite: null,
          trigger: 'touch',
          commands: [
            ['setFlag', 'blare_reef_slip', true],
            ['narrate', 'Behind the Great Horn: a shelf of quiet coral, and one printed slip held down by a pebble.'],
            ['sfx', 'sfx_page'],
            ['say', 'nacre', null, 'THERE, THERE. NO NEED TO GO ON ABOUT IT.'],
            ['say', 'pim', 'puzzled', 'The border has changed colour. Is that a code, or just taste?'],
            ['say', 'lin', 'stern', 'It is keeping notes on us. I do not enjoy being somebody\'s notes.'],
            ['say', 'odo', 'quiet', '"No need to go on about it." {w:25}...I only said it the once. Over.'],
            ['wait', 20],
            ['think', 'Once is how it starts.'],
            ['wait', 25],
            ['sfx', 'sfx_reverse_swell'],
            ['narrate', 'Above them the water turns over and starts back in.'],
            ['say', 'lin', 'neutral', 'Up. Now, please. Two minutes for dawdling and one for Odo.'],
            ['call', 'ce_tide_done'],
          ],
        },
        {
          cond: { flag: 'blare_reef_slip' },
          sprite: null,
          trigger: 'action',
          commands: [
            ['think', 'The shelf where the slip was. The pebble is still warm.'],
          ],
        },
      ],
    },

    /* ================================================================= roaming Unsent (6.13, 8.9) */
    {
      id: 'roam_reply_1',
      x: 9,
      y: 23,
      enemy: { troop: 'troop_reply_toot', sprite: 'reply_all', move: { type: 'chase', sight: 4 }, respawn: false },
    },
    {
      id: 'roam_reply_2',
      x: 30,
      y: 4,
      enemy: { troop: 'troop_reply_toot', sprite: 'toot', move: { type: 'chase', sight: 4 }, respawn: false },
    },
    {
      id: 'roam_toot_crab',
      x: 27,
      y: 13,
      enemy: { troop: 'troop_toot_crab', sprite: 'toot', move: { type: 'chase', sight: 4 }, respawn: false },
    },
    {
      id: 'roam_blank',
      x: 20,
      y: 8,
      enemy: { troop: 'troop_blank_reply', sprite: 'blank_postcard', move: { type: 'chase', sight: 4 }, respawn: false },
    },

    /* the two guarded corners */
    {
      id: 'corner_item_ne',
      x: 33,
      y: 3,
      pages: [
        {
          cond: null,
          sprite: { obj: 'horn_coral_small' },
          trigger: 'action',
          commands: [
            ['narrate', 'A little horn pointed into the corner, shouting at the rock. Something is rattling inside it.'],
            ['sfx', 'sfx_item_get'],
            ['giveItem', 'glass_blue', 1],
            ['think', 'Blue. Medicine bottle. Worried for a living.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'horn_coral_small' },
          trigger: 'action',
          commands: [
            ['think', 'Empty, and still shouting at the rock. Fair enough.'],
          ],
        },
      ],
    },
    {
      id: 'corner_item_sw',
      x: 6,
      y: 24,
      pages: [
        {
          cond: null,
          sprite: null,
          trigger: 'action',
          commands: [
            ['narrate', 'The shallow end, where the loud water goes to be shallow about it.'],
            ['sfx', 'sfx_splash'],
            ['giveItem', 'glass_red', 1],
            ['think', 'Red, under a flat stone. Somebody put it there on purpose.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: null,
          trigger: 'action',
          commands: [
            ['think', 'Just the stone now. I put it back the way it was.'],
          ],
        },
      ],
    },

    /* ================================================================= Never Mind (named Unsent, 6.11) */
    {
      id: 'kept_never_mind',
      x: 21,
      y: 18,
      pages: [
        {
          cond: { var: ['seg2_kept', '>', 0] },
          sprite: { enemy: 'kept_never_mind' },
          trigger: 'touch',
          move: { type: 'chase', sight: 4 },
          commands: [
            ['narrate', 'A clump of sepia memo-gulls drifts over, all looking somewhere else, all saying the same two words.'],
            ['battle', 'troop_kept_2', {
              canEscape: true,
              onPeace: [
                ['call', 'ce_late_said_2'],
                ['say', 'lin', 'fond', 'Noted. {w:15}And filed under: said.'],
              ],
              onWin: [
                ['narrate', 'It goes quiet in the middle of the same sentence it always stops in.'],
                ['say', 'pim', 'puzzled', 'It will start again from the beginning, you know. They always do.'],
                ['erase', 'kept_never_mind'],
              ],
              onLose: 'gameover',
            }],
          ],
        },
      ],
    },

    /* ================================================================= the shouting, close up */
    {
      id: 'horn_fine',
      x: 10,
      y: 20,
      pages: [
        {
          cond: null,
          sprite: { obj: 'horn_coral_small' },
          trigger: 'action',
          commands: [
            ['narrate', 'A small horn, aimed at nobody in particular:\n{big}I\'M FINE{/big}'],
            ['think', 'It has been fine for a long time. You can tell by the wear on the rim.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'horn_coral_small' },
          trigger: 'action',
          commands: [
            ['narrate', '{big}I\'M FINE{/big} {small}(still){/small}'],
            ['say', 'odo', 'grin', 'Same, mate. Over.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 4] },
          sprite: { obj: 'horn_coral_small' },
          trigger: 'action',
          commands: [
            ['narrate', 'The horn is still aimed at nobody. Nothing comes out of it now.'],
            ['think', 'Even down here it is going quiet.'],
          ],
        },
      ],
    },
    {
      id: 'horn_gossip',
      x: 27,
      y: 9,
      pages: [
        {
          cond: null,
          sprite: { obj: 'horn_coral_small' },
          trigger: 'action',
          commands: [
            ['narrate', '{big}—AND SHE NEVER SAID A WORD ABOUT IT, NOT ONE, NOT IN FORTY YEARS—{/big}'],
            ['say', 'pim', 'nosy', 'Is that the same one as before? {w:15}I think they are all the same one.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'horn_coral_small' },
          trigger: 'action',
          commands: [
            ['narrate', '{big}—NOT ONE WORD—{/big}'],
            ['think', 'Nobody down here is listening to anybody. That is the whole trick of it.'],
          ],
        },
      ],
    },
  ],

  onEnter: [
    ['if', { notFlag: 'blare_reef_seen' }, [
      ['setFlag', 'blare_reef_seen', true],
      ['shake', 3, 30],
      ['narrate', 'The reef shouts. All of it. At once. At nothing.'],
      ['think', 'Coral grown into horns and funnels, pink as a sunburn, every mouth pointed away from every other mouth.'],
      ['say', 'odo', 'boast', 'THIS IS EXCELLENT. {w:10}Over.'],
      ['say', 'lin', 'neutral', 'Two things. One: nobody here is listening. Two: neither can I, so could everyone stand closer.'],
      ['think', 'It is the loudest place I have ever been and it is the same as the town.'],
    ], []],
  ],
});
