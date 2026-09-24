/*
 * items.js - DESIGN_BIBLE section 7. Currency is Stamps.
 *
 * G.DATA.items.<id> = { name, kind:'consumable'|'keepsake'|'key', desc, flavor, price, icon,
 *   useInMenu, useInBattle, target:'ally'|'other_ally'|'party'|'user', effects:[...], stats:null|{hp,atk,def,spd},
 *   passive:null|'<id>' }
 *
 * Item effects use the same DSL as skills (see skills.js). Keepsake passives read by the battle code:
 *   'free_first_confide'   the wearer's first Confide each battle does not use up the Can Line
 *   'start_tumbled_amber'  the wearer starts each battle with one Tumbled Amber
 *   'listen_plus'          the wearer's Listen reveals one extra Line
 *   'immune_tongue_tied'   the wearer cannot be Tongue-Tied
 *   'no_pebbles'           enemy moves cannot give the wearer Pebbles
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};
  const I = G.DATA.items = G.DATA.items || {};

  function consumable(id, o) {
    I[id] = Object.assign({
      kind: 'consumable', icon: 'icon_' + id, useInMenu: true, useInBattle: true,
      target: 'ally', effects: [], stats: null, passive: null, price: 0,
    }, o);
    return I[id];
  }

  function keepsake(id, o) {
    I[id] = Object.assign({
      kind: 'keepsake', icon: 'icon_' + id, useInMenu: false, useInBattle: false,
      target: null, effects: null, stats: null, passive: null, price: 0,
    }, o);
    return I[id];
  }

  /* ------------------------------------------------------------------ consumables */

  consumable('bag_of_chips', {
    name: 'Bag of Chips', price: 8, desc: 'Heals 40 Breath.', flavor: 'Hot, salty, slightly too many.',
    effects: [{ kind: 'heal', amount: 40 }],
  });

  consumable('mushy_peas', {
    name: 'Mushy Peas', price: 18, desc: 'Heals 90 Breath.', flavor: 'Green. Warm. Asks no questions.',
    effects: [{ kind: 'heal', amount: 90 }],
  });

  consumable('pickled_egg', {
    name: 'Pickled Egg', price: 25, desc: 'Heals 150 Breath. The user gains 1 raw Blue.',
    flavor: 'Restores Breath. Nobody is happy about it.',
    effects: [{ kind: 'heal', amount: 150 }, { kind: 'glass', colour: 'blue', n: 1, on: 'user' }],
  });

  consumable('scraps', {
    name: 'Scraps', price: 30, target: 'party', desc: 'Heals the whole party 25%.',
    flavor: 'The crunchy bits from the bottom of the fryer. Free if you ask nicely. You never ask.',
    effects: [{ kind: 'heal', pct: 25 }],
  });

  consumable('flask_of_tea', {
    name: 'Flask of Tea', price: 20, target: 'other_ally',
    desc: 'Used on somebody else: heals 30 Breath and removes their ordinary Pebbles and Tongue-Tied.',
    flavor: "You can't pour your own. Well, you can. It's not the same.",
    effects: [
      { kind: 'heal', amount: 30 },
      { kind: 'removePebbles', on: 'target' },
      { kind: 'removeState', ids: ['tongue_tied'], on: 'target' },
    ],
  });

  consumable('stick_of_rock', {
    name: 'Stick of Rock', price: 35, desc: 'A Winded friend stands up with 50% Breath.',
    flavor: 'It says PELLOW’S REACH all the way through. So do we, probably.',
    effects: [{ kind: 'revive', pct: 50 }],
  });

  const chips = [
    ['glass_red', 'Red Chip', 'red', 'Bit of an old brake light. Still cross about it.'],
    ['glass_blue', 'Blue Chip', 'blue', 'Medicine bottle. Worried for a living.'],
    ['glass_amber', 'Amber Chip', 'amber', "Beer bottle, Pop says. 'Somebody had a nice evening.'"],
    ['glass_green', 'Green Chip', 'green', 'Well I never.'],
  ];
  for (const c of chips) {
    consumable(c[0], {
      name: c[1], price: 12, target: 'ally', glass: c[2],
      desc: 'The user gains 1 raw ' + c[1].split(' ')[0] + '.', flavor: c[3],
      effects: [{ kind: 'glass', colour: c[2], n: 1, on: 'target' }],
    });
  }

  /* ------------------------------------------------------------------ keepsakes */

  keepsake('tide_table_page', {
    name: 'Tide Table Page', price: 50, desc: 'Pace +3.', flavor: "Lin's spare. Laminated.",
    stats: { spd: 3 },
  });

  keepsake('darned_patch', {
    name: 'Darned Elbow Patch', price: 60, desc: 'Coat +3.', flavor: 'Pop mends everything except the subject.',
    stats: { def: 3 },
  });

  keepsake('orange_lace', {
    name: 'Orange Lace', desc: 'The wearer’s first Confide each battle does not use up the Can Line.',
    flavor: "Odo's spare. It doesn't match. That's the point.", passive: 'free_first_confide',
  });

  keepsake('egg_medal', {
    name: 'Medal for Valour in the Face of Egg', desc: 'Maximum Breath +15.',
    flavor: 'Cardboard. Extremely official.', stats: { hp: 15 },
  });

  keepsake('doing_fine_token', {
    name: '"You’re Doing Fine" Token', desc: 'The wearer starts each battle with 1 Tumbled Amber.',
    flavor: 'It only says one thing. It’s the right thing.', passive: 'start_tumbled_amber',
  });

  keepsake('second_class_stamp', {
    name: 'Second-Class Stamp', desc: 'The wearer’s Listen reveals one extra Line.',
    flavor: 'Gets there in the end.', passive: 'listen_plus',
  });

  keepsake('gull_feather', {
    name: 'Postmaster’s Feather', desc: 'The wearer cannot be Tongue-Tied.',
    flavor: 'Regulation grey. Slightly on strike.', passive: 'immune_tongue_tied',
  });

  keepsake('pearl_button', {
    name: 'Pearl Button', desc: 'Enemy moves cannot give the wearer Pebbles.',
    flavor: 'Pretty. Hard. Means nothing. Useful, though.', passive: 'no_pebbles',
  });

  /* ------------------------------------------------------------------ key items */

  I.nacres_slips = {
    name: "Nacre's Slips", kind: 'key', icon: 'icon_nacres_slips', useInMenu: false, useInBattle: false,
    desc: 'Little printed slips, each with a coloured border. Re-readable.',
    flavor: '"THERE IS NO NEED FOR ALL THIS."', price: 0, effects: null, stats: null, passive: null,
  };

  I.tams_postcard = {
    name: "Tam's Postcard", kind: 'key', icon: 'icon_tams_postcard', useInMenu: false, useInBattle: false,
    desc: 'June. Still on the side. Not going to bite.',
    flavor: 'The handwriting leans forward, like it is in a hurry to be read.',
    price: 0, effects: null, stats: null, passive: null,
  };

  /*
   * Test fixture: the placeholder map (js/data/maps/test_map.js) hands out 'test_letter', and
   * G.State.addItem warns about ids that are not in this table. Delete this entry together with the
   * test maps.
   */
  I.test_letter = {
    name: 'A Letter', kind: 'key', icon: 'icon_test_letter', useInMenu: false, useInBattle: false,
    desc: 'A letter from the test mailbox.', flavor: 'It is addressed to nobody in particular.',
    price: 0, effects: null, stats: null, passive: null,
  };

  /** Shop stock (7. Shops). */
  G.DATA.shops = G.DATA.shops || {};
  G.DATA.shops.brills_chippy = ['bag_of_chips', 'mushy_peas', 'pickled_egg', 'scraps', 'flask_of_tea', 'stick_of_rock'];
  G.DATA.shops.shelleys_postbox = ['glass_red', 'glass_blue', 'glass_amber', 'glass_green', 'bag_of_chips',
    'flask_of_tea', 'stick_of_rock', 'tide_table_page', 'darned_patch'];
})();
