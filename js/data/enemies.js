/*
 * enemies.js - the Unsent (DESIGN_BIBLE 6.11 and 6.12).
 *
 * BALANCE LOG (every change from the bible's printed numbers is recorded here):
 *   2026-09-21  NO NUMERIC CHANGES. Every Breath/Arm/Coat/Pace, EXP, Stamps and drop chance below is the
 *               bible's. tools/test/battle_sim.js plays the paper scenarios of 6.14 over 40 seeds and
 *               lands inside the 40% tolerance everywhere:
 *                 A Deliver 2.9 rounds (bible 2-3)      A Strike-only 4.4 (see the note in battle_sim.js:
 *                   the bible's "3" divides the pair's total Breath by an average round of damage and so
 *                   ignores the overkill strike on the card and the crab's higher Coat; 4 is the floor)
 *                 B Strike-only 6.8 (bible 6-7)   B engaged Hush 4.8 (bible 4)   B Deliver 3.1 (bible 3)
 *                 C skills-without-Confiding 13.4 (bible 14-15)   C Deliver 6.3 (bible 8-10)
 *                 D The Other Can 5.4 of 12 rounds (bible 6-8)
 *               Rules reading worth knowing: "shakes loose its most recently filled ORDINARY Line" (6.6)
 *               is read as "not one of the personal Lines" (no `from`/`sayer` lock), so starred Lines can
 *               be shaken loose too. Without that, Nacre's phase-2 re-coat would do nothing at all,
 *               because every one of her Lines is starred.
 *
 * Schema (TECH_SPEC battle addendum):
 *   { name, img, hp, atk, def, spd, lines:[{c,star,shownAs,from,sayer}], lineRules, ai, mutters:[],
 *     boss, actions, exp, stamps, drop:{item,chance}, mapScale, letter:[two lines], glass:null|'red'|...,
 *     phases:[...], pebbleCap }
 * Line colours: 'red'|'blue'|'amber'|'green'|'any'|'same_as_first'. `star:true` = Tumbled glass only.
 * lineRules: {grow:[{round,line}]} {reshuffleUntilListens:n} {rerollUntilListens:n} {deliverByListens:n}
 *            {recoatUnlessListened:true} (Nacre phase 2)
 * Tint variants: { base:'<id>', img, name, hpMul, lines, named:{seg:n}, exp, stamps }.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};
  const E = G.DATA.enemies = G.DATA.enemies || {};

  function enemy(id, o) {
    E[id] = Object.assign({
      img: 'en_' + id, lineRules: null, ai: id, mutters: [], boss: false, actions: 1,
      exp: 1, stamps: 1, drop: null, mapScale: 0.5, letter: ['', ''], glass: null, phases: null,
    }, o);
    return E[id];
  }

  /* ================================================================== ordinary Unsent */

  enemy('thank_you_card', {
    name: 'Thank-You Card That Waited Too Long',
    hp: 60, atk: 9, def: 3, spd: 4,
    lines: [{ c: 'amber' }, { c: 'green' }],
    exp: 5, stamps: 4, drop: { item: 'bag_of_chips', chance: 0.30 }, mapScale: 0.45,
    mutters: ['it was a lovely party', 'I did mean it', 'is it still a thank you now?'],
    letter: ['Thank you for the lovely afternoon. I meant to say so on the Tuesday.',
      'It is now considerably later than the Tuesday. Thank you anyway.'],
  });

  enemy('sorry_crab', {
    name: 'Sorry-Not-Sorry',
    hp: 85, atk: 11, def: 6, spd: 7,
    lines: [{ c: 'red' }, { c: 'blue' }],
    exp: 6, stamps: 5, drop: { item: 'glass_red', chance: 0.25 },
    mutters: ["it's not FAIR", 'well I said sorry', 'you started it, actually'],
    letter: ['Sorry. Not that I was wrong, because I was not wrong.',
      'Sorry that you are still cross, which is a different sorry, and I know it.'],
  });

  enemy('reply_all', {
    name: 'Reply-All',
    hp: 150, atk: 17, def: 8, spd: 10,
    lines: [{ c: 'green' }, { c: 'blue' }, { c: 'green' }],
    exp: 9, stamps: 8, drop: { item: 'scraps', chance: 0.30 }, glass: 'red',
    mutters: ['+1', 'sorry, everyone', 'was that meant for all of us?', 'please remove me from this'],
    letter: ['Sorry, everyone. I only meant to send this to one person.',
      'I can no longer remember which one. Please pass it along if it is you.'],
  });

  enemy('toot', {
    name: 'Toot',
    hp: 180, atk: 19, def: 10, spd: 6,
    lines: [{ c: 'red', shownAs: 'amber' }, { c: 'blue' }],
    exp: 10, stamps: 9, drop: { item: 'glass_blue', chance: 0.25 },
    mutters: ["I'M FINE", 'BEST DAY EVER', 'no really, look how loud I am'],
    letter: ['I am having a marvellous time. Listen how loud I can be about it.',
      'Please do not ask me a quiet question. I have not got one of those ready.'],
  });

  enemy('blank_postcard', {
    name: 'Blank Postcard',
    hp: 160, atk: 17, def: 9, spd: 8,
    lines: [{ c: 'any' }, { c: 'same_as_first', star: true }],
    exp: 10, stamps: 9, drop: { item: 'glass_green', chance: 0.25 }, glass: 'copy',
    mutters: ['wish you were', '...', 'having a'],
    letter: ['Wish you were.', 'That is all I got written. It is still true.'],
  });

  enemy('listworm', {
    name: 'Listworm',
    hp: 210, atk: 20, def: 11, spd: 8,
    lines: [{ c: 'amber' }, { c: 'amber' }],
    lineRules: { grow: [{ round: 3, line: { c: 'red' } }, { round: 5, line: { c: 'blue', star: true } }] },
    exp: 13, stamps: 11, drop: { item: 'mushy_peas', chance: 0.30 }, glass: 'amber',
    mutters: ['add an item', "that's not ticked", 'while we are on the subject'],
    letter: ['Things to do: everything, in order, before anyone notices I am tired.',
      'Item one, which I keep moving to the bottom: ask somebody for help.'],
  });

  enemy('overdue_notice', {
    name: 'Overdue Notice',
    hp: 240, atk: 19, def: 13, spd: 7,
    lines: [{ c: 'blue' }, { c: 'red', star: true }, { c: 'amber' }],
    exp: 14, stamps: 12, drop: { item: 'tide_table_page', chance: 0.15 },
    mutters: ['this is your final reminder', 'it has been noted', 'somebody has to keep count'],
    letter: ['This is your final reminder. It has been your final reminder for nine years.',
      'I would rather you came in than that I was right.'],
  });

  enemy('chain_letter', {
    name: 'Chain Letter',
    hp: 200, atk: 20, def: 10, spd: 11,
    lines: [{ c: 'blue' }, { c: 'green' }, { c: 'green', star: true }],
    exp: 13, stamps: 11, drop: { item: 'glass_amber', chance: 0.25 }, glass: 'blue',
    mutters: ['send this to ten friends', 'or ELSE', 'do not break the chain'],
    letter: ['Send this to ten friends or something awful will happen.',
      'I made that part up. I only wanted to be passed on.'],
  });

  enemy('draft_47', {
    name: 'Draft No. 47',
    hp: 170, atk: 18, def: 9, spd: 13,
    lines: [{ c: 'green' }, { c: 'amber' }, { c: 'blue' }],
    lineRules: { reshuffleUntilListens: 1 },
    exp: 12, stamps: 14, drop: { item: 'orange_lace', chance: 1.0, once: true },
    mutters: ['no, that reads wrong', 'start again', 'delete that bit'],
    letter: ['Dear you. Dear YOU. Dear (crossed out) (crossed out) (crossed out).',
      'Forty-six tries and the good bit is always the bit I scribble over.'],
  });

  enemy('echo', {
    name: 'Echo',
    hp: 260, atk: 24, def: 13, spd: 12,
    lines: [],
    lineRules: { deliverByListens: 3 },
    exp: 16, stamps: 13, drop: { item: 'flask_of_tea', chance: 0.30 },
    mutters: ['...awake? Over.', '...are you', '...over. Over. Over.'],
    letter: ['Nothing was wrong with me. Nobody was listening, so I said it again.',
      'And again. Thank you. You can stop now; so can I.'],
  });

  enemy('static', {
    name: 'Static',
    hp: 300, atk: 25, def: 15, spd: 9,
    lines: [{ c: 'blue' }, { c: 'amber', star: true }, { c: 'red' }],
    lineRules: { rerollUntilListens: 2 },
    exp: 17, stamps: 14, drop: { item: 'darned_patch', chance: 0.15 }, glass: 'green',
    mutters: ['—ssss— and anyway —ssss—', 'half a sent', '—kkk— love to your—'],
    letter: ['—ssss— and anyway I never told you that the —kkk— was my fault —ssss—',
      'Tune me in properly and I will say it without the weather in the way.'],
  });

  enemy('pearl_drip', {
    name: 'Pearl Drip',
    hp: 300, atk: 27, def: 16, spd: 10,
    lines: [{ c: 'amber' }, { c: 'blue', star: true }, { c: 'red', star: true }],
    exp: 18, stamps: 15, drop: { item: 'pickled_egg', chance: 0.30 }, glass: 'pebble',
    mutters: ['there, there', 'let me smooth that over', 'nothing sharp, nothing sharp'],
    letter: ['I have coated it so it cannot hurt you. It cannot do anything else either.',
      'Here it is back, shiny and heavy. I am sorry. I only wanted to help.'],
  });

  /* ================================================================== named Unsent (6.11) */

  function named(id, o) {
    E[id] = Object.assign({
      img: 'en_' + id, hpMul: 1.3, named: true, exp: 0, stamps: 0, drop: null, mapScale: 0.5,
    }, o);
    return E[id];
  }

  named('kept_shrug', {
    base: 'sorry_crab', name: 'The Shrug', tint: '#8fa6bb', seg: 1,
    lines: [{ c: 'blue', star: true }, { c: 'amber', star: true }],
    mutters: ['dunno', 'it’s fine', 'whatever, honestly'],
    letter: ['I shrugged so you would stop asking, and you did stop asking.',
      'I am not all right about it. There. That is the whole letter.'],
  });

  named('kept_never_mind', {
    base: 'reply_all', name: 'Never Mind', tint: '#b09a6f', seg: 2,
    lines: [{ c: 'red', star: true }, { c: 'amber', star: true }],
    mutters: ['forget it', 'doesn’t matter', 'no, go on, you first'],
    letter: ['Never mind. I said it three times so it would sound like it was nothing.',
      'You were my best friend. That is what I was minding about.'],
  });

  named('kept_later', {
    base: 'listworm', name: 'Later', tint: '#9a82c4', seg: 3,
    lines: [{ c: 'amber', star: true }, { c: 'blue', star: true }, { c: 'green', star: true }],
    mutters: ['in a minute', 'after the tide', 'when things are quieter'],
    letter: ['I saw you were sad and I looked away and told myself: later.',
      'It has been a great many laters. This one is now.'],
  });

  named('kept_ask_her', {
    base: 'echo', name: 'Ask Her Yourself', tint: '#d99aa6', seg: 4,
    lineRules: null,
    lines: [{ c: 'amber', star: true }, { c: 'amber', star: true }],
    mutters: ['go on then', 'she’s right there', 'ask her. ask her. ask her'],
    letter: ['Everyone kept telling me to ask her myself, so I practised on the water.',
      'Thank you. That is the thing I would have asked. Thank you.'],
  });

  named('kept_dot_dot_dot', {
    base: 'pearl_drip', name: '...', tint: '#6e6a72', seg: 5,
    lines: [{ c: 'red', star: true }, { c: 'blue', star: true }],
    mutters: ['…', '…', 'I was going to say'],
    letter: ['…', 'I didn’t mean it. I’m sorry. That is what the dots were for.'],
  });

  /* ================================================================== bosses (6.12) */

  enemy('boss_postmaster_gull', {
    name: 'Postmaster Gull',
    hp: 420, atk: 15, def: 8, spd: 9, boss: true, actions: 2,
    lines: [{ c: 'blue', star: true }, { c: 'red', star: true }, { c: 'amber', star: true }, { c: 'green', star: true }],
    ai: 'boss_postmaster_gull',
    exp: 30, stamps: 40, drop: null, mapScale: 0.7,   // the feather is handed over in the scene, not dropped
    mutters: ['no return address, no service', 'it’s in the handbook', 'I wrote the handbook'],
    phases: [
      { line: "Form 12-B. In triplicate. You don't HAVE a 12-B." },
      { at: 0.5, linesFilled: 2, line: "EVERYBODY OUT! ...That's me. I'm everybody.", blurt: { name: 'Walkout', power: 1.8, all: true } },
    ],
    letter: ['Dear Sirs, I resign, effective— ...forty years ago. Hm.',
      'Turns out I like it here. Withdraw the above. Regards, the Postmaster.'],
  });

  enemy('boss_perfectly_fine', {
    name: 'Perfectly Fine',
    hp: 1000, atk: 24, def: 14, spd: 8, boss: true, actions: 2,
    lines: [{ c: 'amber' }, { c: 'blue' }, { c: 'green' }, { c: 'red', star: true }, { c: 'red', star: true }],
    ai: 'boss_perfectly_fine',
    exp: 60, stamps: 70, drop: null, mapScale: 0.8,
    mutters: ['no trouble at all', 'look how flat everything is', 'nothing to see, all ironed'],
    phases: [
      { line: 'No trouble at all! None! Look how flat everything is!' },
      { at: 0.5, linesFilled: 3, line: '...Could somebody else do the ironing? Just once?', blurt: { name: 'Starch', state: 'tongue_tied', all: true, turns: 2 } },
    ],
    letter: ['Everything is fine. The washing is done. The washing is always done.',
      'Could somebody else do the ironing? Just once. That is all I was ever saying.'],
  });

  enemy('boss_nacre', {
    name: 'Nacre, Keeper of the Lull',
    hp: 1800, atk: 29, def: 18, spd: 6, boss: true, actions: 2,
    lines: [
      { c: 'blue', star: true }, { c: 'red', star: true }, { c: 'amber', star: true }, { c: 'green', star: true },
      { c: 'any', star: true, sayer: 'wren' }, { c: 'any', star: true, sayer: 'wren' },
    ],
    lineRules: { recoatUnlessListened: true },
    ai: 'boss_nacre',
    exp: 90, stamps: 60, drop: null, mapScale: 1.0, glass: 'pebble',
    mutters: ['THERE IS NO NEED FOR ALL THIS.', 'YOU WILL ONLY UPSET YOURSELVES.',
      'I HAVE KEPT THIS TOWN COMFORTABLE FOR TWO HUNDRED YEARS.', 'PLEASE. I DO NOT KNOW WHAT HAPPENS IF I OPEN.'],
    phases: [
      { line: 'THERE IS NO NEED FOR ALL THIS.', blurt: { name: 'Return to Sender', jamCanLine: true } },
      { at: 0.5, linesFilled: 3, line: 'PLEASE. I DO NOT KNOW WHAT HAPPENS IF I OPEN.', regen: 25 },
    ],
    letter: ['I kept them all. Every unsaid thing in this town, coated smooth so it could not cut.',
      'Thank you for opening me. It is cold and bright and I can hear the tide again.'],
  });

  enemy('other_can', {
    name: 'The Other Can',
    hp: 1, atk: 0, def: 0, spd: 1, boss: true, actions: 0,
    invulnerable: true, noDamage: "It's only a can.",
    lines: [
      { c: 'red', star: true, from: 'odo' },
      { c: 'amber', star: true, from: 'lin' },
      { c: 'green', star: true, from: 'pim' },
      { c: 'blue' },
      { c: 'any', star: true, last: true },
    ],
    lineRules: { ring: { blue: 2, drainPct: 6 }, lastLineGoesLast: true },
    ai: 'other_can',
    exp: 0, stamps: 0, drop: null, mapScale: 0.4,
    mutters: ['Wren? Are you awake? Over.', 'You don’t have to write back.',
      'I just like telling you things.', 'Are you still there? Over.'],
    letter: ['I am awake. I am still your friend, if you want.',
      'Over. (You are meant to say "over" back.)'],
  });
})();
