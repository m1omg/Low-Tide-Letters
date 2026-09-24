/*
 * test_room.js - the engine's interior test page: a small plank room with a carpet, standing on the void
 * backdrop (the map is exactly one screen, so the camera centres it), and a door back to test_map.
 */
G.registerMap('test_room', {
  name: 'Test Room',
  width: 16,
  height: 12,
  bgm: null,                       // null = keep whatever is playing outside
  ambience: 'amb_room_hum',
  backdrop: '#191426',
  tint: [255, 216, 170, 0.1],

  legend: {
    p: 'test_planks',
    r: 'test_carpet',
    k: 'test_wall',
    ' ': 'void',
  },

  ground: [
    '                ',
    '                ',
    '                ',
    '   kkkkkkkkkk   ',
    '   pppppppppp   ',
    '   pppppppppp   ',
    '   ppprrrrppp   ',
    '   ppprrrrppp   ',
    '   pppppppppp   ',
    '   pppppppppp   ',
    '                ',
    '                ',
  ],

  objects: [
    { obj: 'test_bench', x: 5, y: 5 },
    { obj: 'test_picnic_table', x: 10, y: 5 },
  ],

  events: [
    /* --- the way out: step on it and you are back in the yard --------------------------------- */
    {
      id: 'door_out',
      x: 7,
      y: 9,
      pages: [
        {
          cond: null,
          sprite: null,
          trigger: 'touch',
          commands: [
            ['sfx', 'sfx_door_close'],
            ['transfer', 'test_map', 22, 5, 'down', { fade: 'black' }],
          ],
        },
      ],
    },

    /* --- an action event on an impassable wall tile (talk to the wall) ------------------------- */
    {
      id: 'wall_drawing',
      x: 9,
      y: 3,
      pages: [
        {
          cond: null,
          sprite: null,
          trigger: 'action',
          commands: [
            ['narrate', 'A drawing of the outside is taped to the wall, in case anyone misses it.'],
          ],
        },
      ],
    },
  ],
});
