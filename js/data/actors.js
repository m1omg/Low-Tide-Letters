/*
 * actors.js - the four party members (DESIGN_BIBLE 3.1 and 6.8) and the EXP table.
 *
 * G.DATA.actors.<id> = {
 *   name, char, faces, home, weapon, color,        home = home glass colour (6.2), color = luggage-tag tint (9.1)
 *   base:{hp,atk,def,spd},                         level 1 stats
 *   growth:{hp,atk,def,spd},                       stat = floor(base + growth * (level - 1))
 *   skills:[{id, level} | {id, flag}],             flag = learnt when that story flag is set
 *   passive: null | 'nosy',
 *   startsInParty: bool
 * }
 * G.DATA.expTable[i] = cumulative EXP needed to REACH level i (index 0 unused, max level 10).
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};
  const A = G.DATA.actors = G.DATA.actors || {};

  A.wren = {
    name: 'Wren', char: 'char_wren', faces: 'wren', home: 'blue', weapon: 'tin can', color: '#3a8c86',
    base: { hp: 46, atk: 9, def: 6, spd: 8 }, growth: { hp: 7, atk: 2, def: 1.5, spd: 1 },
    skills: [
      { id: 'rattle', level: 1 },
      { id: 'beachcomb', level: 2 },
      { id: 'plain_words', level: 4 },
      { id: 'skimmer', level: 6 },
      { id: 'call_over_and_out', flag: 'odo_told' },
      { id: 'call_by_the_book', flag: 'lin_told' },
      { id: 'call_first_class', flag: 'pim_knows' },
    ],
    passive: null,
    startsInParty: true,
  };

  A.odo = {
    name: 'Odo', char: 'char_odo', faces: 'odo', home: 'red', weapon: 'fry scoop', color: '#e8843a',
    base: { hp: 60, atk: 10, def: 8, spd: 5 }, growth: { hp: 9, atk: 2, def: 2, spd: 0.7 },
    skills: [
      { id: 'oi', level: 1 },
      { id: 'cannonball', level: 2 },
      { id: 'chip_shield', level: 3 },
      { id: 'big_talk', level: 4 },
      { id: 'whistle_blast', level: 5 },
      { id: 'salt_and_vinegar', level: 7 },
    ],
    passive: null,
  };

  A.lin = {
    name: 'Lin', char: 'char_lin', faces: 'lin', home: 'amber', weapon: 'clipboard', color: '#6f8f4a',
    base: { hp: 40, atk: 7, def: 6, spd: 7 }, growth: { hp: 6, atk: 1.5, def: 1.5, spd: 1 },
    skills: [
      { id: 'plaster', level: 1 },
      { id: 'red_pen', level: 2 },
      { id: 'spare_tissue', level: 3 },
      { id: 'checklist', level: 5 },
      { id: 'cup_of_tea', level: 6 },
      { id: 'i_need_help', flag: 'lin_told' },
    ],
    passive: null,
  };

  A.pim = {
    name: 'Pim', char: 'char_pim', faces: 'pim', home: 'green', weapon: 'paper corner', color: '#7fb2d9',
    base: { hp: 32, atk: 8, def: 4, spd: 12 }, growth: { hp: 5, atk: 2, def: 1, spd: 1.5 },
    skills: [
      { id: 'paper_cut', level: 1 },
      { id: 'fold', level: 2 },
      { id: 'forward_mail', level: 3 },
      { id: 'read_aloud', level: 5 },
      { id: 'special_delivery', level: 7 },
    ],
    passive: 'nosy',
  };

  /** Cumulative EXP to reach level i (DESIGN_BIBLE 6.8). Level 10 is the maximum. */
  G.DATA.expTable = [0, 0, 20, 50, 95, 155, 230, 320, 425, 545, 680];
})();
