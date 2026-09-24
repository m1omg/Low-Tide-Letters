/*
 * wren_house.js - Number 9, Harbour Row. Owned by shore_a.
 *
 * 24x18. Two rooms with the void of the outside between them: downstairs (an L of floorboards: kitchen
 * along the top, hall and front door below) and, up the stairs on the right, Wren's bedroom.
 *
 * Fixed tiles other writers rely on (CONTENT_CONTRACT 2 and 5):
 *   (6,15)  arrival from harbour_row, facing up      - passable, no touch event
 *   (6,16)  the front door, touch -> harbour_row (8,10) down
 *   (20,8)  the wake-up tile, facing down, beside the bed - passable, no touch event
 *   (12,4) <-> (18,4)  the stairs (touch; each lands one tile clear of the other trigger)
 *
 * What happens here: the present-day opening (bible 5.2 item 5), the coat hook, the two window cans,
 * the jar under the bed, the bed save point, Mum through the tides and Say/Keep 6 (the June postcard).
 */
G.registerMap('wren_house', {
  name: 'Number 9',
  width: 24,
  height: 18,
  bgm: 'bgm_harbour_row',
  ambience: 'amb_room_hum',
  backdrop: '#181722',
  tint: null,
  start: { x: 6, y: 15, dir: 'up' },

  legend: {
    '#': 'wall_plaster',
    f: 'floorboards',
    ' ': 'void',
  },

  ground: [
    '                        ',
    '                        ',
    '############### ########',
    '############### ########',
    '#fffffffffffff# #ffffff#',
    '#fffffffffffff# #ffffff#',
    '#fffffffffffff# #ffffff#',
    '#fffffffffffff# #ffffff#',
    '#fffffffffffff# #ffffff#',
    '#fffffffffffff# #ffffff#',
    '####ffffffffff# #ffffff#',
    '####ffffffffff# #ffffff#',
    '####ffffffffff# #ffffff#',
    '####ffffffffff# ########',
    '####ffffffffff#         ',
    '####ffffffffff#         ',
    '####ffffffffff#         ',
    '############### #       ',
  ],

  objects: [
    { obj: 'bedroom_door', x: 6, y: 17 },     // the front door, set into the bottom wall under the exit tile
    /* downstairs: kitchen along the top wall, the hall below */
    { obj: 'kitchen_counter', x: 3, y: 4 },
    { obj: 'kitchen_counter', x: 10, y: 4 },
    { obj: 'stairs_wood', x: 12, y: 4 },      // the flight up, on the stair_up trigger tiles
    { obj: 'table', x: 7, y: 7 },
    { obj: 'radio_bench', x: 2, y: 9 },
    { obj: 'table', x: 7, y: 12 },
    { obj: 'bookshelf', x: 11, y: 11 },
    { obj: 'bookshelf', x: 12, y: 14 },
    /* upstairs: the bed against the far wall, a desk under the window */
    { obj: 'stairs_wood', x: 18, y: 4 },      // the top of the flight, on the stair_down trigger tiles
    { obj: 'bed', x: 21, y: 8 },
    { obj: 'table', x: 18, y: 11 },
  ],

  events: [

    /* ============================================================ doors and stairs ============ */

    {
      id: 'front_door',
      x: 6,
      y: 16,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_door_open'],
            ['transfer', 'harbour_row', 8, 10, 'down', { fade: 'black' }],
          ],
        },
      ],
    },

    {
      id: 'stair_up',
      x: 12,
      y: 4,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_step_wood'],
            ['transfer', 'wren_house', 18, 5, 'down', { fade: 'black' }],
          ],
        },
      ],
    },

    {
      id: 'stair_down',
      x: 18,
      y: 4,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_step_wood'],
            ['transfer', 'wren_house', 12, 5, 'down', { fade: 'black' }],
          ],
        },
      ],
    },

    /* ============================================================ the bedroom ================= */

    /* The bed: the Shore save point (bible 8.8). Sits on the bed prop's footprint, faced from (20,8). */
    {
      id: 'bed',
      x: 21,
      y: 8,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'My bed.{w:15} Made, because Mum notices.'],
            ['setSelf', 'A', true],
            ['save'],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['save'],
          ],
        },
      ],
    },

    /* The jar. The whole game is under here, and Wren is not going to look at it yet. */
    {
      id: 'under_bed',
      x: 20,
      y: 7,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Under the bed: a jar.{w:30}\nNot now.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { notFlag: 'truth_known' }] },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Still not now.'],
          ],
        },
        {
          cond: { flag: 'truth_known' },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'A jam jar of the good ones. A note in pencil.{w:20}\nI know exactly where it is. I always did.'],
          ],
        },
      ],
    },

    /* East window: Odo's uninvited line, tied on in January. Taut, always. */
    {
      id: 'can_east',
      x: 22,
      y: 4,
      pages: [
        {
          cond: null,
          sprite: { obj: 'window_can' },
          trigger: 'action',
          commands: [
            ['think', "Odo's line. He tied it to my window in January.{w:20}\nHe did not ask."],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { var: ['tide', '<=', 3] }] },
          sprite: { obj: 'window_can' },
          trigger: 'action',
          commands: [
            ['think', "It's taut.{w:15} He keeps it taut."],
          ],
        },
        {
          cond: { var: ['tide', '>=', 4] },
          sprite: { obj: 'window_can' },
          trigger: 'action',
          commands: [
            ['sfx', 'sfx_static'],
            ['think', 'Still taut.{w:20}\nSomebody is going to have to take it down in the winter.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 6] },
          sprite: { obj: 'window_can' },
          trigger: 'action',
          commands: [
            ['think', 'Two strings now. Both of them tight.{w:20}\nThe window does not shut properly. It never did.'],
          ],
        },
      ],
    },

    /* West window: the slack line across the lane to the house with nobody in it. */
    {
      id: 'can_west',
      x: 17,
      y: 4,
      pages: [
        {
          cond: null,
          sprite: { obj: 'window_can' },
          trigger: 'action',
          commands: [
            ['think', "That one doesn't ring."],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { notFlag: 'sk5_said' }] },
          sprite: { obj: 'window_can' },
          trigger: 'action',
          commands: [
            ['think', 'The string goes out of the window, across the lane,{w:15}\nand into a house with nobody in it.'],
            ['think', 'It has gone slack. That happens.'],
          ],
        },
        {
          cond: { flag: 'sk5_said' },
          sprite: { obj: 'window_can' },
          trigger: 'action',
          commands: [
            ['sfx', 'sfx_static'],
            ['think', "Pop tightened it.{w:20} It still doesn't ring.{w:15}\nIt's just tight now."],
          ],
        },
      ],
    },

    /* The biscuit tin. Three postcards, read exactly once each. */
    {
      id: 'biscuit_tin',
      x: 17,
      y: 12,
      pages: [
        {
          cond: null,
          sprite: { obj: 'biscuit_tin' },
          trigger: 'action',
          commands: [
            ['think', 'A biscuit tin.{w:15} No biscuits.'],
            ['think', 'Three postcards. November, February, June.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { notFlag: 'truth_known' }] },
          sprite: { obj: 'biscuit_tin' },
          trigger: 'action',
          commands: [
            ['think', 'I have read each of them once.{w:20}\nThat was the deal I made with myself. I drive a hard bargain.'],
          ],
        },
        {
          cond: { flag: 'truth_known' },
          sprite: { obj: 'biscuit_tin' },
          trigger: 'action',
          commands: [
            ['think', 'Three postcards. All funny. All kind.{w:20}\nNone of them ask me for anything, which is the worst part.'],
          ],
        },
      ],
    },

    /* The desk under the window. Where a four-page letter got written at two in the morning. */
    {
      id: 'desk',
      x: 18,
      y: 11,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'My desk. A pencil sharpener shaped like a globe, and one pencil,{w:15}\nworn right down to the paint.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Four pages fit on this desk.{w:20} I remember measuring.'],
          ],
        },
      ],
    },

    /* ============================================================ downstairs ================== */

    /* The coat on its hook by the front door. Bible 5.2, item 5. */
    {
      id: 'coat_hook',
      x: 4,
      y: 16,
      pages: [
        {
          cond: null,
          sprite: { obj: 'coat_hook' },
          trigger: 'action',
          commands: [
            ['think', 'My coat. Pockets: string, a peg, sand.{w:20}\nAnd the other pocket.'],
            ['wait', 25],
            ['think', '...Nothing I want to look at.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { notFlag: 'pim_knows' }] },
          sprite: { obj: 'coat_hook' },
          trigger: 'action',
          commands: [
            ['think', 'The other pocket is still there.{w:20} It has been all year.'],
          ],
        },
        {
          cond: { flag: 'pim_knows' },
          sprite: { obj: 'coat_hook' },
          trigger: 'action',
          commands: [
            ['think', 'The hook is empty. He walks about on his own now.'],
            ['think', 'I keep patting the pocket anyway.'],
          ],
        },
      ],
    },

    /* "Postcard's still on the side." It is on the kitchen counter, face down, since June. */
    {
      id: 'postcard_side',
      x: 2,
      y: 4,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'A postcard. Propped against the tea caddy since June.'],
            ['think', 'Face down.{w:20} Somebody keeps turning it face down.{w:15}\nIt is me. I am somebody.'],
          ],
        },
        {
          cond: { hasItem: 'tams_postcard' },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['sfx', 'sfx_page'],
            ['narrate', '{small}Postmarked June. The handwriting leans forward,\nlike it is in a hurry to be read.{/small}'],
            ['say', 'tam', null, "You don't have to write back. I just like telling you things."],
          ],
        },
        {
          cond: { flag: 'sk6_kept' },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Later.'],
            ['wait', 20],
            ['think', 'It is very good at waiting. I will say that for it.'],
          ],
        },
      ],
    },

    {
      id: 'kitchen_counter',
      x: 4,
      y: 4,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'The side. Tea caddy, two mugs, a torch with no batteries,{w:15}\nand a tide table Lin gave us in March.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Lin has annotated our tide table.{w:20} In our house.'],
          ],
        },
      ],
    },

    {
      id: 'kitchen_table',
      x: 7,
      y: 7,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Toast crusts. A biro that has been chewed by a professional.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { var: ['tide', '<=', 4] }] },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Three chairs. We have always had three chairs.{w:20}\nThat is not a sad fact. It is just how many chairs we have.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 5] },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'Mum has left the good plate out.{w:20} For nobody in particular.'],
          ],
        },
      ],
    },

    {
      id: 'bookshelf',
      x: 11,
      y: 11,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', "Pop's books. Nine about radios. One about birds, with a radio\nvalve used as a bookmark."],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'The bird book is on page 61 and has been since I was eight.{w:20}\nPage 61 is gulls. He is not stuck. He just likes gulls.'],
          ],
        },
      ],
    },

    {
      id: 'pops_corner',
      x: 2,
      y: 9,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', "Pop's corner of our kitchen. Three radios in bits,\nand a saucer he is using as a screw dish."],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { all: [{ self: 'A' }, { var: ['tide', '<=', 3] }] },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['sfx', 'sfx_static'],
            ['think', 'One of them comes on if you look at it hard enough.{w:20}\nIt is playing a brass band, somewhere, to somebody.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 4] },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['sfx', 'sfx_static'],
            ['think', 'All three are silent. The saucer is full of screws\nand nothing is in bits any more.'],
          ],
        },
      ],
    },

    {
      id: 'hall_table',
      x: 7,
      y: 12,
      pages: [
        {
          cond: null,
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', 'The hall table. A bowl for keys with no keys in it,\nand a pile of post for people who used to live here.'],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: null,
          solid: false,
          trigger: 'action',
          commands: [
            ['think', "Mum has written NOT AT THIS ADDRESS on all of them\nin her nurse handwriting, which nobody argues with."],
          ],
        },
      ],
    },

    /* ============================================================ Mum ========================= */

    /*
     * Bible 5.9: full lines, full, full, "Love you. Late. Bye.", "..." and a hug, full again.
     * Say/Keep 6 sits on the tide-3 page. Pages are ordered by rising tide: the LAST true one wins.
     * At tide 1 she is out on the front step instead (harbour_row/mum_step).
     */
    {
      id: 'mum',
      x: 5,
      y: 6,
      pages: [
        {
          /* Friday she is already out on the doorstep (harbour_row/mum_step), so no page is true. */
          cond: { var: ['tide', '>=', 2] },
          sprite: { char: 'char_mum', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'mum', null, "You were out late. I'm not cross. I'm making a note of it,\nbut I'm not cross."],
            ['say', 'mum', null, 'Say hello to the Brill boy for me. He waves at the house.\nAt the house, Wren. Not at anybody. At the building.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 3] },
          sprite: { char: 'char_mum', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['if', { all: [{ notFlag: 'sk6_said' }, { notFlag: 'sk6_kept' }] }, [
              ['face', 'this', 'toward_player'],
              ['wait', 20],
              ['say', 'mum', null, "Postcard's still on the side, love. It's been there since June.\nIt's not going to bite."],
              ['custom', 'keep_or_say', {
                say: "I read it. I don't know what to write back.",
                keep: 'Later.',
                varName: 'sk6_choice',
              }],
              ['if', { var: ['sk6_choice', '==', 0] }, [
                ['say', 'wren', 'shrug', "I read it.{w:20} I don't know what to write back."],
                ['wait', 15],
                ['say', 'mum', null, "You don't have to know yet."],
                ['say', 'mum', null, "You just have to not pretend it isn't there."],
                ['sfx', 'sfx_key_item'],
                ['giveItem', 'tams_postcard', 1],
                ['call', 'ce_said_6'],
                ['think', 'It is in my pocket now. The other pocket. The normal one.'],
              ], [
                ['say', 'wren', 'shrug', 'Later.'],
                ['wait', 20],
                ['say', 'mum', null, '...All right. Later.'],
                ['emote', 'this', '...'],
                ['call', 'ce_kept_6'],
              ]],
            ], [
              ['if', { flag: 'sk6_said' }, [
                ['say', 'mum', null, "There's no hurry on it. Take a week. Take a month.\nJust don't take a year, hey."],
              ], [
                ['say', 'mum', null, "It'll keep. Things on that side of the kitchen always do."],
              ]],
            ]],
          ],
        },
        {
          cond: { var: ['tide', '>=', 4] },
          sprite: { char: 'char_mum', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'mum', null, 'Love you. Late. Bye.'],
            ['think', 'Three sentences. She used to manage six.'],
          ],
        },
        {
          cond: { var: ['tide', '>=', 5] },
          sprite: { char: 'char_mum', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'mum', null, '...'],
            ['wait', 20],
            ['move', 'this', ['face_down'], { wait: true }],
            ['emote', 'this', 'heart'],
            ['wait', 40],
            ['think', 'She hugs me for slightly too long and then goes to work.'],
            ['think', "I don't say anything either. Runs in the family, apparently."],
          ],
        },
        {
          cond: { var: ['tide', '>=', 6] },
          sprite: { char: 'char_mum', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'mum', null, "Morning. Sit down, you're letting the heat out of the room."],
            ['say', 'mum', null, "I had her address the whole time, you know. On the back of\nevery one of them. I wasn't going to be the one to say it."],
            ['say', 'mum', null, "Bad habit. Whole town's got it."],
            ['think', "She puts the address on the table and goes to put the kettle on,\nso neither of us has to have a face about it."],
          ],
        },
      ],
    },
  ],

  /* --------------------------------------------------------------------------------------------
   * Lamp, hum and the right music for the hour; then, the first time only, Friday morning.
   * ------------------------------------------------------------------------------------------ */
  onEnter: [
    ['call', 'ce_shore_time_indoor'],
    ['if', { all: [{ flag: 'prologue_done' }, { notFlag: 'wren_house_opened' }] }, [
      ['setFlag', 'wren_house_opened', true],
      ['wait', 40],
      ['think', "Friday. The sea has gone out further than it's supposed to.\nEveryone keeps saying so. Nobody says anything else."],
      ['wait', 30],
      ['sfx', 'sfx_knock'],
      ['shake', 2, 14],
      ['emote', 'player', '?'],
      ['wait', 25],
      /* Stage the call: the player has not met Odo yet, so show WHERE the voice comes from first. */
      ['camera', 'can_east', 40],
      ['emote', 'can_east', '!'],
      ['narrate', 'The tin can on the east window is jumping on its string.\nSomebody is yanking the other end.'],
      ['sfx', 'sfx_static'],
      ['say', 'odo', 'boast', "Wren.{w:10} WREN.{w:20} The sea's gone out too far.\nLike WAY too far. Meet at the beach. This is not a drill. Over."],
      ['wait', 40],
      ['camera', 'player', 40],
      ['think', 'Odo. Next door.{w:15} He tied that can to my window in January\nand calls it a line.'],
      ['think', 'He always waits after "Over".{w:25}\nI never say it.'],
      ['wait', 20],
      ['say', 'mum', null, "Wren! Boots! I'm late!"],
    ], []],
  ],
});
