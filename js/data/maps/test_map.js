/*
 * test_map.js - the engine's outdoor test page: grass, a forest border, a dirt crossroads, a pond with a
 * little plank jetty, a cobbled yard with a door into test_room, an NPC with two pages and a choice, a
 * signpost that calls a common event, a mailbox that gives an item exactly once, and a roaming test enemy.
 * It exists to exercise the map/event engine; the real chapter maps replace it.
 */
G.registerMap('test_map', {
  name: 'Test Page',
  width: 30,
  height: 22,
  bgm: 'bgm_harbour_row',
  ambience: 'amb_wind',
  backdrop: '#2b3a2a',
  tint: null,
  start: { x: 15, y: 12, dir: 'up' },

  legend: {
    g: 'test_grass',
    f: 'test_forest_grass',
    d: 'test_dirt',
    w: 'test_water',
    c: 'test_cobble',
    p: 'test_planks',
    ' ': 'void',
  },

  ground: [
    'ffffffffffffffffffffffffffffff',
    'ffffffffffffffffffffffffffffff',
    'ffggggggggggggddggggggggggggff',
    'ffggggggggggggddggggcccccgggff',
    'ffggggggggggggddggggcccccgggff',
    'ffggggggggggggddggggcccccgggff',
    'ffggggggggggggddggggcccccgggff',
    'ffggggggggggggddggggcccccgggff',
    'ffggggggggggggddggggggdgggggff',
    'ffddddddddddddddddddddddddddff',
    'ffddddddddddddddddddddddddddff',
    'ffggggggggggggddggggggggggggff',
    'ffggddddddggggddggggggggggggff',
    'ffgddwwwwddgggddggggggggggggff',
    'ffgdwwwwwwpgggddggggggggggggff',
    'ffgdwwwwwwpgggddggggggggggggff',
    'ffgddwwwwwdgggddggggggggggggff',
    'ffggddwwwddgggddggggggggggggff',
    'ffgggdddddggggddggggggggggggff',
    'ffggggggggggggddggggggggggggff',
    'ffffffffffffffffffffffffffffff',
    'ffffffffffffffffffffffffffffff',
  ],

  objects: [
    { obj: 'test_pine', x: 3, y: 1 },
    { obj: 'test_tree_round', x: 7, y: 1 },
    { obj: 'test_pine', x: 11, y: 1 },
    { obj: 'test_tree_round', x: 19, y: 1 },
    { obj: 'test_pine', x: 24, y: 1, flipX: true },
    { obj: 'test_tree_round', x: 27, y: 1 },
    { obj: 'test_pine', x: 0, y: 6 },
    { obj: 'test_tree_round', x: 1, y: 13 },
    { obj: 'test_pine', x: 0, y: 17 },
    { obj: 'test_tree_round', x: 29, y: 6 },
    { obj: 'test_pine', x: 28, y: 13, flipX: true },
    { obj: 'test_tree_round', x: 29, y: 18 },
    { obj: 'test_pine', x: 2, y: 20 },
    { obj: 'test_tree_round', x: 9, y: 20 },
    { obj: 'test_pine', x: 17, y: 21 },
    { obj: 'test_tree_round', x: 25, y: 20 },
    { obj: 'test_tree_round', x: 5, y: 4 },
    { obj: 'test_pine', x: 9, y: 3 },
    { obj: 'test_tree_round', x: 18, y: 5 },
    { obj: 'test_pine', x: 26, y: 12 },
    { obj: 'test_bush_pink', x: 12, y: 6 },
    { obj: 'test_bush_pink', x: 19, y: 13 },
    { obj: 'test_bush_pink', x: 8, y: 19 },
    { obj: 'test_bush_pink', x: 25, y: 7 },
    { obj: 'test_boulder', x: 11, y: 17 },
    { obj: 'test_boulder', x: 24, y: 18, flipX: true },
    { obj: 'test_picnic_table', x: 6, y: 7 },
    { obj: 'test_bench', x: 8, y: 7 },
    { obj: 'test_lamp_post', x: 21, y: 4 },
    { obj: 'test_lamp_post', x: 23, y: 4, flipX: true },
  ],

  events: [
    /* --- an NPC with two pages, a choice and an emote ---------------------------------------- */
    {
      id: 'npc_pip',
      x: 12,
      y: 8,
      pages: [
        {
          cond: null,
          sprite: { char: 'test', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['say', 'test_npc', 'neutral', 'Oh! {w:10}Someone new on this page.'],
            ['say', 'test_npc', 'neutral', 'Do you like the way the ground is outlined?'],
            ['choice', ['I do.', 'It is a bit {wave}wobbly{/wave}.'], [
              [['say', 'test_npc', 'neutral', 'Good. I pressed quite hard with the pencil.'], ['emote', 'this', 'heart']],
              [['say', 'test_npc', 'neutral', 'So am I, most days.'], ['emote', 'this', 'sweat']],
            ], { cancel: 1, varName: 'test_choice' }],
            ['setFlag', 'test_met_pip', true],
          ],
        },
        {
          cond: { flag: 'test_met_pip' },
          sprite: { char: 'test', dir: 'down' },
          trigger: 'action',
          move: { type: 'still' },
          facePlayer: true,
          commands: [
            ['emote', 'this', 'note'],
            ['say', 'test_npc', 'neutral', 'The door up on the cobbles is open. Just walk into it.'],
          ],
        },
      ],
    },

    /* --- a signpost: object sprite, narration, common event ---------------------------------- */
    {
      id: 'sign_crossroads',
      x: 16,
      y: 8,
      pages: [
        {
          cond: null,
          sprite: { obj: 'test_signpost' },
          trigger: 'action',
          commands: [
            ['narrate', 'A wooden sign, planted a little crookedly.\n{c:brown}North: the little house.   West: the pond.{/c}'],
            ['call', 'test_signature'],
          ],
        },
      ],
    },

    /* --- the "chest": gives its item exactly once, remembered in a self flag ------------------ */
    {
      id: 'mailbox_letter',
      x: 18,
      y: 12,
      pages: [
        {
          cond: null,
          sprite: { obj: 'test_mailbox' },
          trigger: 'action',
          commands: [
            ['sfx', 'sfx_chest_open'],
            ['narrate', 'The little door of the mailbox creaks open.'],
            ['giveItem', 'test_letter', 1],
            ['setSelf', 'A', true],
          ],
        },
        {
          cond: { self: 'A' },
          sprite: { obj: 'test_mailbox' },
          trigger: 'action',
          commands: [
            ['narrate', 'Empty now, except for a spider who would rather be left alone.'],
          ],
        },
      ],
    },

    /* --- the door into test_room: invisible touch event --------------------------------------- */
    {
      id: 'door_house',
      x: 22,
      y: 4,
      pages: [
        {
          cond: null,
          sprite: null,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_door_open'],
            ['transfer', 'test_room', 7, 8, 'down', { fade: 'black' }],
          ],
        },
      ],
    },

    /* --- roaming enemy sugar: wanders, starts a battle on touch, gone until the map is re-entered */
    {
      id: 'moth1',
      x: 25,
      y: 15,
      enemy: { troop: 'troop_test', sprite: 'test', move: { type: 'wander', radius: 3 }, respawn: true },
    },

    /* --- a parallel event: Pip hums every few seconds while the player walks around ------------ */
    {
      id: 'pip_hums',
      x: 12,
      y: 7,
      pages: [
        {
          cond: { flag: 'test_met_pip' },
          sprite: null,
          trigger: 'parallel',
          commands: [
            ['wait', 420],
            ['emote', 'npc_pip', 'note'],
          ],
        },
      ],
    },
  ],

  onEnter: [
    ['if', { notFlag: 'test_seen_intro' }, [
      ['setFlag', 'test_seen_intro', true],
      ['think', '(A test page. Grass, a pond, and someone humming.)'],
    ], []],
  ],
});
