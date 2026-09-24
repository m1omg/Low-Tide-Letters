/*
 * harbour_row.js - Harbour Row, Pellow's Reach. Owned by shore_a.
 *
 * 40x20. A cobbled lane between two rows of houses, closed by garden walls to the north, the harbour
 * wall to the south, and a notch in the cliff to the east where the road gives up and becomes shingle.
 * Number 9 is on the north side; the house with TO LET in the window is directly across the lane, which
 * is why one of the two can strings overhead runs the wrong way and never rings.
 *
 * Fixed tiles other writers rely on (CONTENT_CONTRACT 2 and 5):
 *   (10,11)      the Shore segment start, facing down (ce_tide_done lands here for tides 2-5)
 *   (8,10)       arrival from wren_house, facing down  - passable, no touch event
 *   (30,10)      arrival from brills_chippy, facing down - passable, no touch event
 *   (38,10)/(38,11)  arrival from shingle_beach, facing left - passable, no touch events
 *   (8,9)        door of Number 9, touch -> wren_house (6,15) up      (on the house footprint)
 *   (30,9)       door of Brill's Chippy, touch -> brills_chippy (10,11) up
 *   (39,10)/(39,11)  east edge, touch -> shingle_beach (1,10)/(1,11) right
 *   (18,13)      the postbox (Ending A's backdrop); approach it from (18,12), which is kept clear
 *
 * Say it / Keep it moments scripted here: sk1 and sk5 (Pop, tides 1 and 3), sk4 and sk7 (Lin, tides 2
 * and 4), sk8 (Robin, tide 4). The town-going-quiet schedule of bible 5.9 is on the NPC pages.
 */
G.registerMap('harbour_row', {
  name: "Harbour Row",
  width: 40,
  height: 20,
  bgm: 'bgm_harbour_row',
  ambience: 'amb_wind',
  backdrop: '#20222a',
  tint: null,
  start: { x: 10, y: 11, dir: 'down' },

  legend: {
    '#': 'wall_plaster',
    '.': 'cobbles',
    g: 'grass_verge',
    s: 'shingle',
    C: 'cliff',
    ' ': 'void',
  },

  ground: [
    '                                        ',
    '                                        ',
    '#####################################CCC',
    '#####################################CCC',
    '#####################################CCC',
    '#####################################CCC',
    '#####################################CCC',
    '#####################################CCC',
    '#...............gggggg....ggg........CCC',
    '#...............gggggg....ggg........CCC',
    '#.gggg......gggg..................ssssss',
    '#..gggg............ggg............ssssss',
    '#.gggg............ggggg.............ssCC',
    '#..ggg............ggggg..............sCC',
    '#..................ggg................sC',
    '#gggggg...........................ssCCCC',
    '#ggggg...........gggggg..........sssCCCC',
    '########################################',
    '                                        ',
    '                                        ',
  ],

  objects: [
    /* --- north side: the row itself. Number 9 at x 7-10, the Brills next door at 12-15 --------- */
    { obj: 'house_terrace', x: 3, y: 9 },
    { obj: 'house_terrace', x: 8, y: 9 },
    { obj: 'house_terrace', x: 13, y: 9 },
    { obj: 'house_terrace', x: 23, y: 9 },
    { obj: 'chippy_front', x: 30, y: 9 },
    { obj: 'house_terrace', x: 34, y: 9 },

    /* --- south side: the house with nobody in it, straight across from Number 9 ---------------- */
    { obj: 'house_tolet', x: 8, y: 16 },

    /* --- the harbour side: pots, crates, Pop's workshop bench, a line of washing in the wind ---- */
    { obj: 'lobster_pots', x: 2, y: 16 },
    { obj: 'crates', x: 5, y: 16 },
    { obj: 'radio_bench', x: 13, y: 16 },
    { obj: 'washing_line_town', x: 26, y: 16 },
    { obj: 'lobster_pots', x: 28, y: 16 },
    { obj: 'lobster_pots', x: 18, y: 16 },
    { obj: 'crates', x: 17, y: 9 },
    { obj: 'crates', x: 32, y: 15 },

    /* --- the little green in the middle of the row --------------------------------------------- */
    { obj: 'bench', x: 20, y: 13 },
    { obj: 'streetlamp', x: 22, y: 12 },
    { obj: 'streetlamp', x: 11, y: 15 },
  ],

  events: [

    /* ============================================================ ways out ==================== */

    {
      id: 'door_number_nine',
      x: 8,
      y: 9,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_door_open'],
            ['transfer', 'wren_house', 6, 15, 'up', { fade: 'black' }],
          ],
        },
      ],
    },

    {
      id: 'door_chippy',
      x: 30,
      y: 9,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_door_open'],
            ['transfer', 'brills_chippy', 10, 11, 'up', { fade: 'black' }],
          ],
        },
      ],
    },

    {
      id: 'to_beach_a',
      x: 39,
      y: 10,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'touch',
          commands: [
            ['transfer', 'shingle_beach', 1, 10, 'right', { fade: 'black' }],
          ],
        },
      ],
    },

    {
      id: 'to_beach_b',
      x: 39,
      y: 11,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'touch',
          commands: [
            ['transfer', 'shingle_beach', 1, 11, 'right', { fade: 'black' }],
          ],
        },
      ],
    },

    /* ============================================================ Pop ========================= */

    /*
     * Pop Ansel, on the bench outside his workshop with a soldering iron and no hurry at all.
     * sk1 on the tide-1 page, sk5 on the tide-3 page. Tides 4 and 5 he only whistles (bible 5.9).
     */
    {
      id: 'pop',
      x: 13,
      y: 15,
      pages: [
        {
          cond: null,
          sprite: { char: 'char_pop', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['if', { all: [{ notFlag: 'sk1_said' }, { notFlag: 'sk1_kept' }] }, [
              ['say', 'pop', null, "There she is. Mind the iron, it's hot and it bites."],
              ['wait', 15],
              ['say', 'pop', null, "You've gone quiet on me this year, pet.\nAnything rattling?"],
              ['custom', 'keep_or_say', {
                say: "A bit. I don't know how to say it yet.",
                keep: 'What. No.',
                varName: 'sk1_choice',
              }],
              ['if', { var: ['sk1_choice', '==', 0] }, [
                ['say', 'wren', 'shrug', "A bit.{w:20} I don't know how to say it yet."],
                ['wait', 20],
                ['say', 'pop', null, "That's a whole sentence more than yesterday."],
                ['say', 'pop', null, 'No rush. Tide goes out, tide comes in.'],
                ['call', 'ce_said_1'],
              ], [
                ['say', 'wren', 'shrug', 'What.{w:15} No.'],
                ['wait', 25],
                ['emote', 'this', '...'],
                ['say', 'pop', null, 'Right you are.'],
                ['call', 'ce_kept_1'],
              ]],
            ], [
              ['say', 'pop', null, "This radio's been dead since 1974. I'm in no rush either."],
              ['think', 'He has been in no rush since 1974.'],
            ]],
          ],
        },
        {
          cond: { var: ['tide', '>=', 2] },
          sprite: { char: 'char_pop', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'pop', null, "Morning, pet. Solder's gone gummy. Everything has, in this."],
            ['say', 'pop', null, "That Brill lad came past at seven shouting his own name\nthrough a tin can. Cheered me right up."],
          ],
        },
        {
          cond: { var: ['tide', '>=', 3] },
          sprite: { char: 'char_pop', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['if', { all: [{ notFlag: 'sk5_said' }, { notFlag: 'sk5_kept' }] }, [
              ['say', 'pop', null, 'Sit down a minute. I want to ask you a thing and then\nI shall not ask it again.'],
              ['wait', 20],
              ['say', 'pop', null, "That old line across the lane's gone slack.\nWant me to take it down, or tighten it?"],
              ['custom', 'keep_or_say', {
                say: 'Tighten it. ...Please.',
                keep: 'Leave it.',
                varName: 'sk5_choice',
              }],
              ['if', { var: ['sk5_choice', '==', 0] }, [
                ['say', 'wren', 'neutral', 'Tighten it.{w:25} ...Please.'],
                ['wait', 20],
                ['say', 'pop', null, 'Thought you might.'],
                ['sfx', 'sfx_switch'],
                ['narrate', 'He goes at it with a screwdriver and a great deal of leaning.\nAcross the lane, the string lifts out of its sag.'],
                ['call', 'ce_said_5'],
                ['think', 'It still goes to an empty house.{w:20}\nIt just goes there properly now.'],
              ], [
                ['say', 'wren', 'shrug', 'Leave it.'],
                ['wait', 25],
                ['say', 'pop', null, 'Righto. It bothers nobody where it is.'],
                ['emote', 'this', '...'],
                ['call', 'ce_kept_5'],
              ]],
            ], [
              ['say', 'pop', null, "Red for cross, blue for fretting, amber for fond,\ngreen for well-I-never."],
              ['say', 'pop', null, "Don't keep them all in one pocket, love. You'll rattle."],
            ]],
          ],
        },
        {
          cond: { var: ['tide', '>=', 4] },
          sprite: { char: 'char_pop', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['emote', 'this', 'note'],
            ['narrate', '{small}Pop is whistling. Seven notes, and no ending to them.{/small}'],
            ['wait', 30],
            ['think', 'He does that when the news is on.{w:20}\nHe has been doing it since Thursday.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 5] },
          sprite: { char: 'char_pop', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['emote', 'this', 'note'],
            ['narrate', '{small}Seven notes. He gets to the seventh and starts again.{/small}'],
            ['wait', 30],
            ['think', 'I could ask him to finish it.{w:25}\nI could ask him a lot of things.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 6] },
          sprite: { char: 'char_pop', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'pop', null, 'There she is.'],
            ['wait', 20],
            ['say', 'pop', null, "Sit down. I've finished that tune, if you want to hear the end\nof it. It's not much of an end. That's rather the point."],
            ['emote', 'this', 'note'],
            ['sfx', 'sfx_bell'],
            ['wait', 40],
            ['think', 'Eight notes.{w:25} All that time and it was only ever one more.'],
          ],
        },
      ],
    },

    /* ============================================================ Mum on the step ============= */

    /* Friday only: she is locking up and late, and then she is gone until the evening. */
    {
      id: 'mum_step',
      x: 9,
      y: 10,
      pages: [
        {
          cond: { var: ['tide', '==', 1] },
          sprite: { char: 'char_mum', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'mum', null, "Key's under the pot, which is a terrible place for it,\nand where it has always been."],
            ['say', 'mum', null, "Go on then. Go and look at your enormous puddle."],
            ['wait', 15],
            ['say', 'mum', null, "There's toast, if you're quick and not fussy."],
            ['wait', 15],
            ['say', 'mum', null, 'And take somebody with you.'],
            ['think', 'She says that like it is a thing you can just do.'],
            ['think', 'She has been half into that coat since I was nine.'],
          ],
        },
      ],
    },

    /* ============================================================ Lin ========================= */

    /*
     * Lin Hale with her clipboard. Tide 1 the rail joke, tide 2 sk4, tide 3 the first crack in her,
     * tide 4 sk7, then the two quiet days.
     */
    {
      id: 'lin',
      x: 17,
      y: 11,
      pages: [
        {
          cond: null,
          sprite: { char: 'char_lin', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'lin', 'stern', 'Three things. One: that is not a staircase that should exist.'],
            ['say', 'lin', 'stern', "Two: I'm coming. Three: hold the rail."],
            ['sfx', 'sfx_static'],
            ['narrate', "The can on Wren's hip crackles."],
            ['say', 'odo', 'boast', "There's no rail. Over."],
            ['wait', 15],
            ['say', 'lin', 'neutral', 'Then hold the concept of a rail.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { var: ['tide', '<=', 1] }] },
          sprite: { char: 'char_lin', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'lin', 'neutral', 'Low water is in forty minutes. I have allowed six minutes\nfor Odo being Odo.'],
            ['think', 'She has allowed six minutes for Odo being Odo.{w:20}\nThat is not enough minutes.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 2] },
          sprite: { char: 'char_lin', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['if', { all: [{ notFlag: 'sk4_said' }, { notFlag: 'sk4_kept' }] }, [
              ['say', 'lin', 'stern', "Tide 2 is at 10:42. I've allowed four minutes for dawdling."],
              ['custom', 'keep_or_say', {
                say: "Thanks for coming yesterday. I'd have gone alone.",
                keep: 'What.',
                varName: 'sk4_choice',
              }],
              ['if', { var: ['sk4_choice', '==', 0] }, [
                ['say', 'wren', 'neutral', "Thanks for coming yesterday.{w:20}\nI'd have gone alone."],
                ['wait', 20],
                ['say', 'lin', 'fond', 'Noted.'],
                ['wait', 20],
                ['sfx', 'sfx_scribble'],
                ['say', 'lin', 'fond', "...I've written it down. It's going in the minutes."],
                ['call', 'ce_said_4'],
              ], [
                ['say', 'wren', 'shrug', 'What.'],
                ['wait', 20],
                ['say', 'lin', 'neutral', 'Nothing. Four minutes.'],
                ['call', 'ce_kept_4'],
              ]],
            ], [
              ['say', 'lin', 'neutral', 'Item four: do not stand on the weed. It is not a floor.\nIt is a trapdoor with opinions.'],
            ]],
          ],
        },
        {
          cond: { var: ['tide', '>=', 3] },
          sprite: { char: 'char_lin', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'lin', 'tired', "Sorry. Sorry. I'm late. I have never been late.\nI would like that on the record."],
            ['wait', 20],
            ['say', 'lin', 'tired', 'I am fine. I am absolutely fine.'],
            ['say', 'lin', 'tired', "Please stop looking at me like I'm a tide table\nwith a mistake in it."],
            ['think', 'Her plait is coming undone at the bottom.{w:20}\nI have never seen that before.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 4] },
          sprite: { char: 'char_lin', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['if', { all: [{ notFlag: 'sk7_said' }, { notFlag: 'sk7_kept' }] }, [
              ['say', 'lin', 'tired', "Right. Low water 13:04, and I've got Robin, and I've got\nno coat, and that is fine, that is all completely fine."],
              ['wait', 15],
              ['say', 'lin', 'tired', 'Could you—'],
              ['wait', 25],
              ['say', 'lin', 'neutral', "no. Never mind. It's fine."],
              ['custom', 'keep_or_say', {
                say: 'Could I what? I can mind Robin while you get your coat.',
                keep: 'Okay.',
                varName: 'sk7_choice',
              }],
              ['if', { var: ['sk7_choice', '==', 0] }, [
                ['say', 'wren', 'neutral', 'Could I what?{w:20}\nI can mind Robin while you get your coat.'],
                ['wait', 25],
                ['say', 'lin', 'fond', '...Yes. That. Thank you. Four minutes.'],
                ['call', 'ce_said_7'],
                ['think', 'Four minutes is the longest anybody in this town has ever\nasked anybody for.'],
              ], [
                ['say', 'wren', 'shrug', 'Okay.'],
                ['wait', 25],
                ['say', 'lin', 'tired', 'Good. Good. Yes.'],
                ['emote', 'this', 'sweat'],
                ['call', 'ce_kept_7'],
              ]],
            ], [
              ['say', 'lin', 'tired', 'Item one is still item one. I keep moving it to tomorrow.'],
            ]],
          ],
        },
        {
          cond: { var: ['tide', '>=', 5] },
          sprite: { char: 'char_lin', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'lin', 'neutral', 'Two things. One: last one tonight.'],
            ['wait', 20],
            ['say', 'lin', 'neutral', "Two: I've not written the second thing yet.\nI thought I'd see what it turned out to be."],
            ['think', 'A list with a gap in it.{w:20} Whatever next.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 6] },
          sprite: { char: 'char_lin', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'lin', 'relieved', "Mum's home on Tuesdays now. I asked. Out loud.\nWith my actual mouth."],
            ['say', 'lin', 'relieved', "Robin has two shoes. I want that minuted as well."],
          ],
        },
      ],
    },

    /* ============================================================ Robin ======================= */

    /* Five, blunt, one shoe. sk8 (bible 5.6). Only on the row from Sunday morning on. */
    {
      id: 'robin',
      x: 16,
      y: 13,
      pages: [
        {
          cond: { var: ['tide', '>=', 4] },
          sprite: { char: 'char_robin', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['if', { all: [{ notFlag: 'sk8_said' }, { notFlag: 'sk8_kept' }] }, [
              ['say', 'robin', null, "Are you Lin's friend?"],
              ['wait', 15],
              ['say', 'robin', null, "She said she hasn't got time for friends."],
              ['custom', 'keep_or_say', {
                say: 'Yes. I am.',
                keep: 'Ask her.',
                varName: 'sk8_choice',
              }],
              ['if', { var: ['sk8_choice', '==', 0] }, [
                ['say', 'wren', 'neutral', 'Yes.{w:15} I am.'],
                ['wait', 20],
                ['say', 'robin', null, "Okay. I've only got one shoe."],
                ['call', 'ce_said_8'],
                ['think', 'He says it the way you would report the weather.'],
              ], [
                ['say', 'wren', 'shrug', 'Ask her.'],
                ['wait', 20],
                ['say', 'robin', null, "I did ask her. She said ask you."],
                ['emote', 'player', 'sweat'],
                ['call', 'ce_kept_8'],
              ]],
            ], [
              ['say', 'robin', null, 'The sea is on the wrong setting.'],
              ['wait', 15],
              ['say', 'robin', null, 'I have one shoe.'],
            ]],
          ],
        },
        {
          cond: { var: ['tide', '>=', 6] },
          sprite: { char: 'char_robin', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'robin', null, 'I have two shoes.'],
            ['wait', 20],
            ['say', 'robin', null, 'They are different shoes but I have two.'],
            ['think', 'A fair result.'],
          ],
        },
      ],
    },

    /* ============================================================ Mr Brill ==================== */

    /* Out on the pavement with a broom and no shop to sweep for. Epilogue only. */
    {
      id: 'mr_brill_out',
      x: 33,
      y: 10,
      pages: [
        {
          cond: { var: ['tide', '>=', 6] },
          sprite: { char: 'char_mr_brill', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'mr_brill', null, 'PICKLED EGG! On the house! It is ALL on the house,\nthe house is shutting, take an egg!'],
            ['wait', 20],
            ['say', 'mr_brill', null, "...Sorry. Sorry, love. I've been saving that up."],
            ['wait', 20],
            ['say', 'mr_brill', null, "Nine months we've fried fish in this town and I've not said\none true word about it till this morning."],
            ['say', 'mr_brill', null, 'Good for the sinuses, crying. Ask anyone.'],
            ['think', "He is beaming and leaking at the same time.{w:20}\nOdo gets it from somewhere."],
          ],
        },
      ],
    },

    /* ============================================================ townsfolk =================== */

    /* The town going quiet, bible 5.9. One page per tide band; the LAST true page wins. */
    {
      id: 'towns_a',
      x: 26,
      y: 11,
      pages: [
        {
          cond: null,
          sprite: { char: 'char_towns_a', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'towns_a', null, 'Lowest tide in forty years, they reckon.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 2] },
          sprite: { char: 'char_towns_a', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'towns_a', null, "Can't complain."],
            ['wait', 20],
            ['say', 'towns_a', null, "Well. Could. Won't."],
          ],
        },
        {
          cond: { var: ['tide', '>=', 3] },
          sprite: { char: 'char_towns_a', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'towns_a', null, '...'],
            ['think', 'He had a whole sentence yesterday.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 4] },
          sprite: { char: 'char_towns_a', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'towns_a', null, '...'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 6] },
          sprite: { char: 'char_towns_a', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['if', { var: ['final_choice', '==', 1] }, [
              ['say', 'towns_a', null, "Forty-one years, I've been meaning to tell my brother\nhe can have the boat."],
              ['wait', 20],
              ['say', 'towns_a', null, "Off to tell him. Before I think better of it."],
            ], [
              ['say', 'towns_a', null, 'Morning.'],
              ['wait', 20],
              ['think', "It is not much. It is more than yesterday."],
            ]],
          ],
        },
      ],
    },

    {
      id: 'towns_b',
      x: 24,
      y: 14,
      pages: [
        {
          cond: null,
          sprite: { char: 'char_towns_b', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'towns_b', null, "We don't make a fuss here, dear."],
            ['think', 'It is the town motto. It is nearly on the sign.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 2] },
          sprite: { char: 'char_towns_b', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'towns_b', null, "Mustn't grumble."],
          ],
        },
        {
          cond: { var: ['tide', '>=', 3] },
          sprite: { char: 'char_towns_b', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'towns_b', null, "Mustn't..."],
            ['emote', 'this', '...'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 4] },
          sprite: { char: 'char_towns_b', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'towns_b', null, '...'],
            ['think', 'Her trolley has one squeaking wheel and it is saying\nmore than she is.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 6] },
          sprite: { char: 'char_towns_b', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['if', { var: ['final_choice', '==', 1] }, [
              ['say', 'towns_b', null, "I've a fuss to make, as it happens. Put the kettle on."],
            ], [
              ['say', 'towns_b', null, "Mustn't grumble."],
              ['wait', 25],
              ['say', 'towns_b', null, '...Might, though.'],
            ]],
          ],
        },
      ],
    },

    /* Two more, reused with lighter lines. Entirely optional. */
    {
      id: 'towns_a2',
      x: 6,
      y: 11,
      pages: [
        {
          cond: null,
          sprite: { char: 'char_towns_a', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'towns_a', null, "I've walked out to where my pots should be and stood on\nthe bottom of the sea in my slippers."],
            ['wait', 15],
            ['say', 'towns_a', null, "Felt rude, if I'm honest."],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { var: ['tide', '<=', 2] }] },
          sprite: { char: 'char_towns_a', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'towns_a', null, 'Sea knows what it is doing. Sea has a plan.'],
            ['wait', 15],
            ['say', 'towns_a', null, "Sea has never had a plan in its life."],
          ],
        },
        {
          cond: { var: ['tide', '>=', 3] },
          sprite: { char: 'char_towns_a', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'towns_a', null, '...'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 6] },
          sprite: { char: 'char_towns_a', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'towns_a', null, 'Got my slippers back off the seabed. Ruined.'],
            ['wait', 15],
            ['say', 'towns_a', null, 'Worth it.'],
          ],
        },
      ],
    },

    {
      id: 'towns_b2',
      x: 31,
      y: 13,
      pages: [
        {
          cond: null,
          sprite: { char: 'char_towns_b', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'towns_b', null, "I put a card through the Brills' door in January\nwith WELCOME on it and my name spelled wrong."],
            ['wait', 15],
            ['say', 'towns_b', null, "Never corrected it. Eight months. It's too late now, isn't it."],
            ['think', "It is absolutely not too late.{w:20} I decide not to say so."],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { var: ['tide', '<=', 2] }] },
          sprite: { char: 'char_towns_b', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'towns_b', null, 'Brenda, it is. Not Glenda.'],
            ['wait', 20],
            ['say', 'towns_b', null, "Anyway. Mustn't."],
          ],
        },
        {
          cond: { var: ['tide', '>=', 3] },
          sprite: { char: 'char_towns_b', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'towns_b', null, '...'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 6] },
          sprite: { char: 'char_towns_b', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'towns_b', null, "I've told them it's Brenda."],
            ['wait', 20],
            ['say', 'towns_b', null, "Eight months of being Glenda. What a waste of a woman."],
          ],
        },
      ],
    },

    /* ============================================================ the two strings ============= */

    /* Wren's west window, seen from the lane: the line that goes across to the empty house. */
    {
      id: 'can_west_outside',
      x: 7,
      y: 9,
      pages: [
        {
          cond: null,
          sprite: { obj: 'window_can' },
          above: true,
          trigger: 'action',
          commands: [
            ['think', 'My west window. The string comes out of it, crosses the lane,\nand sags in the middle like a washing line in the rain.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { notFlag: 'sk5_said' }] },
          sprite: { obj: 'window_can' },
          above: true,
          trigger: 'action',
          commands: [
            ['think', 'Pop put it up when I was seven. It took him a whole Sunday\nand he sang the entire time, badly.'],
          ],
        },
        {
          cond: { flag: 'sk5_said' },
          sprite: { obj: 'window_can' },
          above: true,
          trigger: 'action',
          commands: [
            ['think', 'Tight as a guitar string.{w:20}\nNobody is going to ring it. That is not the point of it.'],
          ],
        },
      ],
    },

    /* Wren's east window: Odo's uninvited line, strung in January without asking. */
    {
      id: 'can_east_outside',
      x: 10,
      y: 9,
      pages: [
        {
          cond: null,
          sprite: { obj: 'window_can' },
          above: true,
          trigger: 'action',
          commands: [
            ['think', "The other string. Odo's. It goes four feet to next door\nand it is stretched like he is expecting a phone call."],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { var: ['tide', '<=', 3] }] },
          sprite: { obj: 'window_can' },
          above: true,
          trigger: 'action',
          commands: [
            ['think', 'He has tied three knots in it so it does not slip.{w:20}\nThe knots have names. He told me the names.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 4] },
          sprite: { obj: 'window_can' },
          above: true,
          trigger: 'action',
          commands: [
            ['sfx', 'sfx_static'],
            ['think', 'Still tight.{w:25} In the winter somebody will come out with\nscissors and that will be that.'],
          ],
        },
      ],
    },

    /* The house across the lane. TO LET, and the string comes down to a nail by its window. */
    {
      id: 'house_tolet_front',
      x: 8,
      y: 15,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['narrate', 'A card in the front window, gone the colour of weak tea:\n{c:brown}TO LET{/c}. It has been there a year.'],
            ['think', 'The string ends at a nail by the upstairs window.{w:20}\nNobody has taken the can off it.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { notFlag: 'truth_known' }] },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'The doorstep has a ring on it where a jar stood once,\nin the rain, for four hours.'],
            ['wait', 25],
            ['think', "...I don't know how I know it was four hours."],
          ],
        },
        {
          cond: { flag: 'truth_known' },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Number 12. Yellow door, once. Two of us used to be able to\nget from my window to that one without touching the road.'],
            ['wait', 20],
            ['think', 'That is a lie. We were never once allowed.'],
          ],
        },
      ],
    },

    /* ============================================================ the postbox ================= */

    {
      id: 'postbox',
      x: 18,
      y: 13,
      pages: [
        {
          cond: null,
          sprite: { obj: 'postbox' },
          trigger: 'action',
          commands: [
            ['think', 'The postbox. Collections: 9:15 and 4:30, and on Sundays,\napparently, never.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { notFlag: 'pim_knows' }] },
          sprite: { obj: 'postbox' },
          trigger: 'action',
          commands: [
            ['think', 'It is red and it is patient and it has a slot the exact size\nof a thing I am not going to put in it.'],
          ],
        },
        {
          cond: { all: [{ flag: 'pim_knows' }, { var: ['tide', '<=', 5] }] },
          sprite: { obj: 'postbox' },
          trigger: 'action',
          commands: [
            ['sfx', 'sfx_knock'],
            ['think', 'Something in my coat pocket goes very still when I stand here.'],
            ['wait', 25],
            ['think', 'Not yet, Pim.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 6] },
          sprite: { obj: 'postbox' },
          trigger: 'action',
          commands: [
            ['think', 'Collections: 9:15 and 4:30.{w:25}\nIt is 9:11.'],
          ],
        },
        {
          cond: { all: [{ flag: 'epilogue_walk' }, { notFlag: 'epilogue_posted' }] },
          sprite: { obj: 'postbox' },
          trigger: 'action',
          commands: [['call', 'ce_epilogue_post']],
        },
      ],
    },

    /* ============================================================ things worth poking ======== */

    {
      id: 'bench_row',
      x: 20,
      y: 13,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'A bench with a little brass plate on it.'],
            ['narrate', '{small}"FOR EDIE, WHO LIKED IT HERE."{/small}'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Four words and a name. Somebody managed that, once.{w:20}\nThey had to wait until she was dead, mind.'],
          ],
        },
      ],
    },

    {
      id: 'lobster_pots_west',
      x: 2,
      y: 16,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'A lobster pot. Empty.{w:20}\nThe lobsters have moved on. Good for them.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Still empty. Still pleased for them.'],
          ],
        },
      ],
    },

    {
      id: 'lobster_pots_east',
      x: 28,
      y: 16,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['sfx', 'sfx_coin'],
            ['narrate', 'Something small and metal in the bottom of the pot, under\nforty years of tar and one crisp packet.'],
            ['giveMoney', 25],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'The crisp packet is a flavour they stopped making.{w:20}\nI am not going to investigate further.'],
          ],
        },
      ],
    },

    {
      id: 'radio_bench',
      x: 14,
      y: 16,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', "Pop's bench. Nine radios, one of which works, and a tin of\nscrews sorted by a system only he understands."],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { var: ['tide', '<=', 3] }] },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'The system is: big ones on the left, and then it goes wrong.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 4] },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['sfx', 'sfx_static'],
            ['think', 'One of the radios is on, very low, tuned to nothing.'],
            ['wait', 25],
            ['think', 'He does that so the workshop is not quiet.'],
          ],
        },
      ],
    },

    {
      id: 'crates_west',
      x: 5,
      y: 16,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Fish crates. They smell exactly the way you think they do,\nand also of pine, for some reason.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['sfx', 'sfx_item_get'],
            ['narrate', 'A paper bag has been tucked behind the crates, out of the wind.\nStill warm. Somebody always does this.'],
            ['giveItem', 'bag_of_chips', 1],
            ['setSelf', 'B', true],
          ],
        },
        {
          cond: { self: 'B' },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Nothing behind the crates today. Rude.'],
          ],
        },
      ],
    },

    {
      id: 'washing_line',
      x: 26,
      y: 16,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Somebody has hung a whole wash out in this wind.'],
            ['wait', 20],
            ['think', 'Four shirts, pointing east, all agreeing about something.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { var: ['tide', '<=', 3] }] },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Still pointing east. Committed.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 4] },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Nobody has brought the washing in and it is raining.{w:20}\nThat is not like this street at all.'],
          ],
        },
      ],
    },

    {
      id: 'chippy_front',
      x: 31,
      y: 9,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', "BRILL'S, in gold on the glass, with the apostrophe put in\nby somebody who had to be shown twice."],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { var: ['tide', '<=', 4] }] },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'The window is steamed up from the inside.{w:20}\nYou can tell how busy they are by how steamed up it is.'],
            ['wait', 20],
            ['think', 'It is very clear today.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 5] },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Somebody has taken the gold letters off the top of the glass\nand not got round to the rest.'],
          ],
        },
      ],
    },

    /* The alley nook between Number 9 and the house on the corner. */
    {
      id: 'alley_nook',
      x: 6,
      y: 8,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'The gap between the houses. Wide enough for a bin\nand a determined child.'],
            ['sfx', 'sfx_coin'],
            ['narrate', 'A jam jar of change on the sill of the gas meter, labelled\nin biro: {c:brown}CAN STRING FUND{/c}.'],
            ['giveMoney', 20],
            ['wait', 15],
            ['think', "Pop's handwriting. He has been funding it for five years."],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Empty jar. I have embezzled the Can String Fund.'],
          ],
        },
      ],
    },

    /* --- optional creatures ------------------------------------------------------------------- */

    {
      id: 'gull_on_bin',
      x: 19,
      y: 8,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['narrate', 'A herring gull is standing on a bin lid with its chest out,\nlike a small furious postmaster.'],
            ['wait', 20],
            ['think', 'We look at each other.{w:20} Neither of us blinks.{w:20} It wins.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { notFlag: 'gull_delivered' }] },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['sfx', 'sfx_whisper'],
            ['narrate', 'It screams once, at the whole street, about nothing.'],
            ['think', 'Must be nice.'],
          ],
        },
        {
          cond: { flag: 'gull_delivered' },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['narrate', 'The gull is standing on the bin lid holding a chip it has\nnot eaten, as though waiting for a form to be countersigned.'],
            ['think', 'I know a bird who would have something to say about you.'],
          ],
        },
      ],
    },

    {
      id: 'cat_under_crates',
      x: 4,
      y: 16,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['narrate', 'Two eyes under the crates. A tail comes out, considers the\nweather, and goes back in.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { var: ['tide', '<=', 3] }] },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'The chippy cat. It has no name and about nine homes.'],
            ['wait', 20],
            ['think', 'It has never once come when called, which I respect enormously.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 4] },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['narrate', 'The cat comes all the way out, sits on your boot,\nand does not explain itself.'],
            ['wait', 30],
            ['emote', 'player', 'heart'],
            ['think', '...Right. Okay. Fine.'],
          ],
        },
      ],
    },
  ],

  /* --------------------------------------------------------------------------------------------
   * The hour of the day (ce_shore_time) and, the first time Wren steps out on Friday, the two
   * strings over the lane.
   * ------------------------------------------------------------------------------------------ */
  onEnter: [
    ['call', 'ce_shore_time'],
    ['if', { all: [{ flag: 'epilogue_walk' }, { notFlag: 'epilogue_arrived' }] }, [['call', 'ce_epilogue_arrive']], []],
    ['if', { all: [{ var: ['tide', '==', 1] }, { notFlag: 'harbour_row_seen' }] }, [
      ['setFlag', 'harbour_row_seen', true],
      ['wait', 25],
      ['camera', [9, 8], 50],
      ['wait', 30],
      ['think', 'Two strings cross the lane over my head.'],
      ['wait', 20],
      ['think', 'One of them is tight.'],
      ['camera', 'player', 50],
    ], []],
  ],
});
