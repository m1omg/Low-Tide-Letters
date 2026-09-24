/*
 * skills.js - the 24 skills of DESIGN_BIBLE 6.9 and 6.10.
 *
 * ---------------------------------------------------------------------------------------------------
 * THE EFFECT DSL
 * ---------------------------------------------------------------------------------------------------
 * A skill is data:
 *
 *   G.DATA.skills.<id> = {
 *     name, user:'wren'|'odo'|'lin'|'pim', level|flag, flavor, desc,
 *     cost:  {red:n, blue:n, amber:n, green:n}      raw pieces of that colour (a Tumbled piece pays 2 of
 *                                                   any colour, see BattleLogic.payCost)
 *          | {tumbled:n}                            n Tumbled pieces specifically ("T" in the bible)
 *          | {free:true, cooldown:3}                free, but usable once every 3 rounds
 *     target:'enemy'|'all_enemies'|'ally'|'other_ally'|'party'|'self'|'two_allies',
 *     type:  'damage'|'heal'|'buff'|'debuff'|'glass'|'say'    picks the Out Loud rider (6.4)
 *     priority: bool,                                the user goes first in the next round (see below)
 *     effects: [ ... ],                              executed in order on the resolved targets
 *     call: null | {partner:'odo'}                   Two-Can Call: costs one Tumbled piece from Wren and
 *                                                    one from the partner, always fires Out Loud
 *   }
 *
 * Effect objects (`t` is the resolved target of the action, `u` the user):
 *
 *   {kind:'damage', power:2.0, crit:0.35, noShake:true, useHigherAtk:'odo'}
 *        Damage with DESIGN_BIBLE 6.2's formula. `crit` overrides the 5% base critical chance.
 *        `noShake` keeps the hit from shaking a filled Line loose. `useHigherAtk` uses max(user, partner).
 *   {kind:'heal', pct:35}                         heal pct% of the target's maximum Breath
 *   {kind:'state', id:'rattled', chance:1, on:'target'|'user', turns:2}
 *        Applies a status effect of 6.7 (`turns` defaults to the status' own duration).
 *   {kind:'removeState', ids:['riled'], on:'target'}
 *   {kind:'removeBuffs', on:'target'}              strips the target's own buffs (Red Pen)
 *   {kind:'glass', colour:'amber'|'choose', n:1, on:'target'|'user', tumbled:false}
 *   {kind:'removePebbles', on:'target'}            ordinary Pebbles only, never Story Pebbles
 *   {kind:'reveal', count:1|'all'}                 reveals hidden Lines of the target
 *   {kind:'fillLine', count:1, any:true, star:false, colour:'piece', revealedOnly:true}
 *        Fills Lines without offering glass (Plain Words, First Class). `any:true` ignores the colour,
 *        `star:true` may also fill starred Lines, `colour:'piece'` means "the colour of the paid piece".
 *   {kind:'cancelBlurt'}                           cancels a telegraphed Blurt on the target
 *   {kind:'special', name:'i_need_help'}           genuine one-offs, implemented in battle_logic.js
 *        (SPECIALS there: 'oi', 'i_need_help', 'forward_mail', 'special_delivery', 'call_over_and_out',
 *         'call_first_class', 'hold_the_string')
 *
 * Out Loud (6.4): a skill paid entirely with Tumbled glass deals +50% effect plus one rider chosen by
 * `type` - damage: cannot miss and ignores half the target's Coat; heal: also removes one status;
 * buff/debuff: one turn longer; glass/say: the user also gains +1 raw Green.
 *
 * Priority note (implementation): commands are chosen when a combatant's token comes up, so a priority
 * skill cannot overtake a turn that is already happening. Instead it marks its user "quick": they are
 * placed at the very front of the NEXT round's order (shown on the turn ribbon), which is what makes
 * Whistle Blast and Paper Cut good answers to a telegraphed Blurt.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};
  const S = G.DATA.skills = G.DATA.skills || {};

  /* ------------------------------------------------------------------ Wren */

  S.rattle = {
    name: 'Rattle', user: 'wren', level: 1, cost: { blue: 1 }, target: 'enemy', type: 'damage', priority: false,
    desc: 'Power 1.3 hit. The Unsent is Rattled.', flavor: 'Shake the can at it. It hates that.',
    effects: [{ kind: 'damage', power: 1.3 }, { kind: 'state', id: 'rattled', on: 'target' }],
    call: null,
  };

  S.beachcomb = {
    name: 'Beachcomb', user: 'wren', level: 2, cost: { green: 1 }, target: 'self', type: 'glass', priority: false,
    desc: 'Gain one raw piece of a colour you choose.', flavor: "There's always one more if you look.",
    effects: [{ kind: 'glass', colour: 'choose', n: 1, on: 'user' }],
    call: null,
  };

  S.plain_words = {
    name: 'Plain Words', user: 'wren', level: 4, cost: { blue: 1, amber: 1 }, target: 'enemy', type: 'say', priority: false,
    desc: 'Fills one revealed, unstarred Line of any colour. Cannot be Misheard.', flavor: "No 'and anyway'.",
    effects: [{ kind: 'fillLine', count: 1, any: true, star: false, revealedOnly: true }],
    call: null,
  };

  S.skimmer = {
    name: 'Skimmer', user: 'wren', level: 6, cost: { green: 2 }, target: 'all_enemies', type: 'damage', priority: false,
    desc: 'Power 0.9 to every Unsent. Does not shake Lines loose.', flavor: "Seven skips. Pop's record is nine.",
    effects: [{ kind: 'damage', power: 0.9, noShake: true }],
    call: null,
  };

  /* ------------------------------------------------------------------ Odo */

  S.oi = {
    name: 'Oi!', user: 'odo', level: 1, cost: { free: true, cooldown: 3 }, target: 'all_enemies', type: 'debuff', priority: false,
    desc: "Single-target moves aim at Odo for 2 turns.", flavor: 'OI. OVER HERE. Over.',
    effects: [{ kind: 'special', name: 'oi' }],
    call: null,
  };

  S.cannonball = {
    name: 'Cannonball', user: 'odo', level: 2, cost: { red: 2 }, target: 'enemy', type: 'damage', priority: false,
    desc: 'Power 2.0 hit on one Unsent.', flavor: "Technically a bomb. Pool rules don't apply on the seabed.",
    effects: [{ kind: 'damage', power: 2.0 }],
    call: null,
  };

  S.chip_shield = {
    name: 'Chip Shield', user: 'odo', level: 3, cost: { amber: 1 }, target: 'ally', type: 'buff', priority: false,
    desc: 'The ally is Shielded and gains 1 Amber.', flavor: 'The fry scoop has never been cleaner. Or prouder.',
    effects: [{ kind: 'state', id: 'shielded', on: 'target' }, { kind: 'glass', colour: 'amber', n: 1, on: 'target' }],
    call: null,
  };

  S.big_talk = {
    name: 'Big Talk', user: 'odo', level: 4, cost: { red: 1 }, target: 'party', type: 'buff', priority: false,
    desc: 'The whole party deals +15% damage for 3 turns.', flavor: 'We are the BEST at this. Probably. Over.',
    effects: [{ kind: 'state', id: 'big_talk', on: 'target', turns: 3 }],
    call: null,
  };

  S.whistle_blast = {
    name: 'Whistle Blast', user: 'odo', level: 5, cost: { blue: 1 }, target: 'enemy', type: 'damage', priority: true,
    desc: 'Power 0.8. Cancels a telegraphed Blurt.', flavor: 'PHEEEP.',
    effects: [{ kind: 'cancelBlurt' }, { kind: 'damage', power: 0.8, noShake: true }],
    call: null,
  };

  S.salt_and_vinegar = {
    name: 'Salt and Vinegar', user: 'odo', level: 7, cost: { red: 1, green: 1 }, target: 'all_enemies', type: 'damage', priority: false,
    desc: 'Power 1.1 to all. 30% chance of Soft Spot.', flavor: 'In the eyes. Sorry. Not sorry. Sorry.',
    effects: [{ kind: 'damage', power: 1.1 }, { kind: 'state', id: 'soft_spot', chance: 0.3, on: 'target' }],
    call: null,
  };

  /* ------------------------------------------------------------------ Lin */

  S.plaster = {
    name: 'Plaster', user: 'lin', level: 1, cost: { amber: 1 }, target: 'ally', type: 'heal', priority: false,
    desc: 'Heals one friend 35% of their Breath.', flavor: 'Hold still. I have a system.',
    effects: [{ kind: 'heal', pct: 35 }],
    call: null,
  };

  S.red_pen = {
    name: 'Red Pen', user: 'lin', level: 2, cost: { red: 1 }, target: 'enemy', type: 'damage', priority: false,
    desc: 'Power 1.2. Removes Riled and any buff the Unsent gave itself.', flavor: "It's 'apologise'. With an S.",
    effects: [
      { kind: 'damage', power: 1.2 },
      { kind: 'removeState', ids: ['riled'], on: 'target' },
      { kind: 'removeBuffs', on: 'target' },
    ],
    call: null,
  };

  S.spare_tissue = {
    name: 'Spare Tissue', user: 'lin', level: 3, cost: { amber: 1 }, target: 'other_ally', type: 'heal', priority: false,
    desc: 'Removes that friend’s ordinary Pebbles and Tongue-Tied. They gain 1 Amber.', flavor: 'I carry six. Take it.',
    effects: [
      { kind: 'removePebbles', on: 'target' },
      { kind: 'removeState', ids: ['tongue_tied'], on: 'target' },
      { kind: 'glass', colour: 'amber', n: 1, on: 'target' },
    ],
    call: null,
  };

  S.checklist = {
    name: 'Checklist', user: 'lin', level: 5, cost: { green: 1 }, target: 'party', type: 'buff', priority: false,
    desc: 'On the List: the next 3 party actions have +15% effect.', flavor: 'Item one: win. Sub-items to follow.',
    effects: [{ kind: 'state', id: 'on_the_list', on: 'target' }],
    call: null,
  };

  S.cup_of_tea = {
    name: 'Cup of Tea', user: 'lin', level: 6, cost: { amber: 2 }, target: 'party', type: 'heal', priority: false,
    desc: 'Heals the party 25%. Removes Rattled and Soft Spot.', flavor: "I don't even like tea. It's the pouring.",
    effects: [{ kind: 'heal', pct: 25 }, { kind: 'removeState', ids: ['rattled', 'soft_spot'], on: 'target' }],
    call: null,
  };

  S.i_need_help = {
    name: 'I Need Help', user: 'lin', flag: 'lin_told', cost: { tumbled: 1 }, target: 'self', type: 'heal', priority: false,
    desc: 'Every other friend Confides Lin their oldest raw piece at once. Lin heals 50%.', flavor: 'Item one.',
    effects: [{ kind: 'special', name: 'i_need_help' }],
    call: null,
  };

  /* ------------------------------------------------------------------ Pim */

  S.paper_cut = {
    name: 'Paper Cut', user: 'pim', level: 1, cost: { green: 1 }, target: 'enemy', type: 'damage', priority: true,
    desc: 'Power 1.1 with a 35% critical chance.', flavor: 'Ow for you! Sorry!',
    effects: [{ kind: 'damage', power: 1.1, crit: 0.35 }],
    call: null,
  };

  S.fold = {
    name: 'Fold', user: 'pim', level: 2, cost: { blue: 1 }, target: 'self', type: 'buff', priority: false,
    desc: 'Folded: evades the next attack.', flavor: 'Flat as a bill.',
    effects: [{ kind: 'state', id: 'folded', on: 'target' }],
    call: null,
  };

  S.forward_mail = {
    name: 'Forward Mail', user: 'pim', level: 3, cost: { green: 1 }, target: 'two_allies', type: 'glass', priority: false,
    desc: 'Moves one raw piece from one friend to another. It arrives Tumbled. Does not use the Can Line.',
    flavor: 'Redirected with love.',
    effects: [{ kind: 'special', name: 'forward_mail' }],
    call: null,
  };

  S.read_aloud = {
    name: 'Read Aloud', user: 'pim', level: 5, cost: { green: 1, amber: 1 }, target: 'all_enemies', type: 'debuff', priority: false,
    desc: 'Reveals every Line. The Unsent are Rattled (embarrassed).',
    flavor: "'Dear Sir, I am WRITHING to complain—' oh, writing.",
    effects: [{ kind: 'reveal', count: 'all' }, { kind: 'state', id: 'rattled', on: 'target' }],
    call: null,
  };

  S.special_delivery = {
    name: 'Special Delivery', user: 'pim', level: 7, cost: { tumbled: 1 }, target: 'enemy', type: 'say', priority: false,
    desc: 'A Say that fills up to two Lines matching the piece’s colour.', flavor: 'Signed for.',
    effects: [{ kind: 'special', name: 'special_delivery' }],
    call: null,
  };

  /* ------------------------------------------------------------------ Two-Can Calls (6.10) */

  S.call_over_and_out = {
    name: 'Over and Out', user: 'wren', flag: 'odo_told', cost: { call: true }, target: 'enemy', type: 'damage', priority: false,
    desc: 'Power 2.8 using the higher Arm. Odo covers Wren until his next turn.',
    flavor: 'Two cans, one string, extremely loud.',
    effects: [{ kind: 'special', name: 'call_over_and_out' }],
    call: { partner: 'odo' },
  };

  S.call_by_the_book = {
    name: 'By the Book', user: 'wren', flag: 'lin_told', cost: { call: true }, target: 'party', type: 'heal', priority: false,
    desc: 'The party heals 35%. All ordinary Pebbles and Tongue-Tied are removed.',
    flavor: 'There is a procedure for this. There is now.',
    effects: [
      { kind: 'heal', pct: 35 },
      { kind: 'removePebbles', on: 'target' },
      { kind: 'removeState', ids: ['tongue_tied'], on: 'target' },
    ],
    call: { partner: 'lin' },
  };

  S.call_first_class = {
    name: 'First Class', user: 'wren', flag: 'pim_knows', cost: { call: true }, target: 'enemy', type: 'say', priority: false,
    desc: 'Fills up to two revealed Lines of any colour, stars included.',
    flavor: 'Straight to the front of the queue.',
    effects: [{ kind: 'special', name: 'call_first_class' }],
    call: { partner: 'pim' },
  };

  /* ------------------------------------------------------------------ enemy-side helper action */

  S.hold_the_string = {
    name: 'Hold the String', user: null, hidden: true, cost: { free: true }, target: 'self', type: 'buff', priority: false,
    desc: 'Hold the can steady: Wren takes no Blue from the next ring.', flavor: 'Both hands. Don’t let go.',
    effects: [{ kind: 'special', name: 'hold_the_string' }],
    call: null,
  };
})();
