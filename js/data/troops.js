/*
 * troops.js - DESIGN_BIBLE 6.13.
 *
 * G.DATA.troops.<id> = { members:['enemy_id', ...], back:'bb_id'|null, bgm:'id'|null, rules:null|{
 *   noEscape:true,             escape is refused ("There is nowhere to run to down here.")
 *   noHush:true,               damage cannot take an Unsent below 1 Breath
 *   forcedSpill:{actor,colour,count,noTimeout,thawAfter,skimPebbles}  count raw pieces at the start (2);
 *     noTimeout: the Spill never runs out by itself; thawAfter: N Confides received end it (and skimPebbles
 *     clears that member's Story Pebbles); strikeBlocked:'reason' greys Strike out; confessions:{'from>to':line},
 *   roundLimit:12,             the battle ends with outcome 'timeout' after this many rounds
 *   onlySayer:'wren',          only this member may Say
 *   tutorial:{ hints:[{round:1, text:'...'}, ...] }   timed hint strips for the first battle
 *                              ({key:confide} etc. become the player's current key)
 * } }
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};
  const T = G.DATA.troops = G.DATA.troops || {};

  function troop(id, members, rules, o) {
    T[id] = Object.assign({ members: members, back: null, bgm: null, rules: rules || null }, o || {});
    return T[id];
  }

  /* sorting_shallows */
  troop('troop_tutorial_card', ['thank_you_card'], {
    tutorial: {
      hints: [
        { round: 1, text: 'Glass fills your Pocket by itself. Spend it, Say it, or pass it on.' },
        { round: 1, after: 'command', text: 'Listen shows a Line. Say gives it the colour it wanted.' },
        { round: 2, text: '{key:confide} is the Can Line: Confide a piece to a friend. It arrives Tumbled.' },
      ],
    },
  });
  troop('troop_card_crab', ['thank_you_card', 'sorry_crab']);
  troop('troop_crab_pair', ['sorry_crab', 'sorry_crab']);
  troop('troop_gull', ['boss_postmaster_gull'], { noEscape: true }, { bgm: 'bgm_boss' });

  /* blare_reef */
  troop('troop_reply_toot', ['reply_all', 'toot']);
  troop('troop_toot_crab', ['toot', 'sorry_crab', 'sorry_crab']);
  troop('troop_blank_reply', ['blank_postcard', 'reply_all']);
  troop('troop_big_noise', ['toot', 'reply_all', 'toot'], { noEscape: true }, { bgm: 'bgm_boss' });

  /* slack_water */
  troop('troop_listworm_overdue', ['listworm', 'overdue_notice']);
  troop('troop_chain_listworm', ['chain_letter', 'listworm']);
  troop('troop_draft', ['draft_47', 'blank_postcard']);
  troop('troop_fine', ['boss_perfectly_fine'], { noEscape: true }, { bgm: 'bgm_boss' });

  /* undertow_light */
  troop('troop_echo_static', ['echo', 'static']);
  troop('troop_echo_chain', ['echo', 'chain_letter']);
  /* bible 5.6: Wren starts flooded with five raw Blue and Freezes Up for as long as it takes the three
   * friends to each Confide one piece to her (one per round: one Can Line); Strike is refused. */
  troop('troop_three_words', ['echo', 'echo', 'echo'], {
    noEscape: true, noHush: true, strikeBlocked: "it isn't them you're angry at",
    forcedSpill: { actor: 'wren', colour: 'blue', count: 5, noTimeout: true, thawAfter: 3, skimPebbles: true },
    confessions: {
      'odo>wren': "I'm still cross with you. I'm still here. Both. Over.",
      'lin>wren': 'I have done worse to Robin on a Tuesday. Hold the rail.',
      'pim>wren': "Dear Tam. That's how I start. I've just read my own first line.",
    },
  }, { bgm: 'bgm_other_can' });

  /* pearl_bed */
  troop('troop_drip_pair', ['pearl_drip', 'pearl_drip']);
  troop('troop_drip_static', ['pearl_drip', 'static']);
  troop('troop_nacre', ['boss_nacre'], { noEscape: true }, { bgm: 'bgm_nacre' });

  /* finale */
  troop('troop_other_can', ['other_can'], {
    noEscape: true, noHush: true, roundLimit: 12, onlySayer: 'wren',
    forcedSpill: { actor: 'wren', colour: 'blue', noTimeout: true },
  }, { bgm: 'bgm_other_can' });

  /* named Unsent, one per zone (6.11) */
  troop('troop_kept_1', ['kept_shrug'], { noEscape: true });
  troop('troop_kept_2', ['kept_never_mind'], { noEscape: true });
  troop('troop_kept_3', ['kept_later'], { noEscape: true });
  troop('troop_kept_4', ['kept_ask_her'], { noEscape: true });
  troop('troop_kept_5', ['kept_dot_dot_dot'], { noEscape: true });
})();
