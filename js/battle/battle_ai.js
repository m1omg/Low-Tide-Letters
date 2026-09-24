/*
 * battle_ai.js - G.BattleAI
 *
 *  - `decide(b, enemy)` picks one enemy MOVE object (DESIGN_BIBLE 6.11 / 6.12), keyed by `enemy.data.ai`.
 *    Move shape (executed by battle_logic.performMove):
 *      { name, text, power, all, targetIdx, state, stateChance, turns, glass:{colour,n}, pebble,
 *        healPct, reshuffle, selfState, telegraph:{name, power, all, state, turns, jamCanLine} }
 *  - `autoPolicy('attack'|'smart'|'pacifist')` returns choose(b, member) -> a command for b.act(), or a
 *    {type:'confide'} command which the caller passes to b.confide(). Used by __game.battleAuto in tests.
 *
 * Node-safe: no DOM, no canvas.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  const U = G.Util;

  function chance(p) { return U.rng() < p; }
  function pick(a) { return a.length ? a[Math.floor(U.rng() * a.length)] : null; }

  /* ================================================================== enemies */

  const RULES = {
    thank_you_card: function (b, e) {
      if (chance(0.3)) return { name: 'So sorry!', text: 'It blushes all the way to its fold.' };
      return { name: 'Flap', power: 1.0 };
    },

    sorry_crab: function (b, e) {
      e.step = (e.step || 0) + 1;
      if (e.step % 2 === 0) return { name: 'Scuttle', selfState: 'sidestep', text: 'It sidesteps, entirely on principle.' };
      return { name: 'Pinch', power: 1.0 };
    },

    reply_all: function (b, e) {
      if (e.struck) {
        e.struck = false;
        return { name: 'Reply to all', power: 0.6, all: true, selfState: 'riled', text: 'It replies to ALL of you.' };
      }
      if (chance(0.6)) return { name: 'Reply to all', power: 0.6, all: true };
      return { name: 'Peck', power: 1.0 };
    },

    toot: function (b, e) {
      if (chance(0.6)) return { name: "I'M FINE", power: 1.2 };
      return { name: 'Blare', state: 'tongue_tied', text: 'The note goes right through you.' };
    },

    blank_postcard: function (b, e) {
      const counts = { red: 0, blue: 0, amber: 0, green: 0 };
      for (const m of b.party) for (const p of m.pocket) if (p && !p.pebble) counts[p.c]++;
      let best = 'red';
      for (const c of Object.keys(counts)) if (counts[c] > counts[best]) best = c;
      if (best === 'red') return { name: 'Mirror: Temper', power: 1.3 };
      if (best === 'blue') return { name: 'Mirror: Worry', state: 'rattled' };
      if (best === 'amber') return { name: 'Mirror: Fondness', healPct: 15, text: 'It warms itself on your fondness.' };
      return { name: 'Mirror: Wonder', selfState: 'mirror_guard', text: 'It goes blank and slips aside.' };
    },

    listworm: function (b, e) {
      e.step = (e.step || 0) + 1;
      if (e.step % 2 === 0) return { name: 'Add an item', glass: { colour: 'amber', n: 1 }, text: 'It adds you to the list.' };
      return { name: 'Nibble', power: 1.0 };
    },

    overdue_notice: function (b, e) {
      return { name: 'Stamp', power: 1.1 };
    },

    chain_letter: function (b, e) {
      e.preferred = null;
      for (const m of b.party) {
        if (m.hp > 0 && b.rawCount(m, 'blue') >= 3) { e.preferred = m.idx; break; }
      }
      return { name: 'Constrict', power: 1.0, glass: { colour: 'blue', n: 2 } };
    },

    draft_47: function (b, e) {
      if (chance(0.45)) return { name: 'Crosses itself out', healPct: 10, reshuffle: true, text: 'No, that reads wrong.' };
      return { name: 'Paper Cut', power: 1.1 };
    },

    echo: function (b, e) {
      if (e.lastHit && e.lastHit.by != null) {
        return {
          name: 'Repeat', power: Math.max(0.8, e.lastHit.power), targetIdx: e.lastHit.by,
          text: 'It says your own thing back to you.',
        };
      }
      return { name: 'Murmur', text: 'It murmurs. …over.' };
    },

    static: function (b, e) {
      if (chance(0.55)) return { name: 'Crackle', power: 0.7, all: true };
      return { name: 'Half a sentence', state: 'tongue_tied' };
    },

    pearl_drip: function (b, e) {
      if (chance(0.5)) return { name: 'Coat', power: 0.8, pebble: true, text: 'Something goes smooth and heavy in your pocket.' };
      return { name: 'Blob', power: 1.1 };
    },

    /* ---------------------------------------------------------------- bosses */

    boss_postmaster_gull: function (b, e) {
      if (e.phase >= 1) {
        if (!e.blurt && chance(0.45)) {
          return { name: 'Telegraph', text: 'He raises the picket sign…', telegraph: { name: 'Walkout', power: 1.8, all: true } };
        }
        return { name: 'SQUAWK', power: 0.7, all: true };
      }
      if (chance(0.4)) return { name: 'Red Tape', state: 'tongue_tied', text: 'Form 12-B. In triplicate.' };
      return { name: 'Peck', power: 1.0 };
    },

    boss_perfectly_fine: function (b, e) {
      if (e.phase >= 1) {
        if (!e.blurt && chance(0.4)) {
          return { name: 'Telegraph', text: 'Steam builds between the layers…', telegraph: { name: 'Starch', state: 'tongue_tied', all: true, turns: 2 } };
        }
        return { name: 'Everything Is Fine', power: 0.8, all: true };
      }
      const r = U.rng();
      if (r < 0.34) return { name: 'Press', power: 1.2 };
      if (r < 0.67) return { name: 'Fold Away', glass: { colour: 'amber', n: 2 }, text: 'It folds your fondness away, neatly.' };
      if (!e.states.fine) return { name: "I'm Fine!", selfState: 'fine', text: 'No trouble at all! None!' };
      return { name: 'Press', power: 1.2 };
    },

    boss_nacre: function (b, e) {
      if (e.phase < 1 && !e.blurt && chance(0.3)) {
        return { name: 'Telegraph', text: 'A slip slides half out…', telegraph: { name: 'Return to Sender', jamCanLine: true } };
      }
      if (chance(0.5)) return { name: 'Lull', power: 0.7, all: true, glass: { colour: 'blue', n: 1 } };
      return { name: 'Coat', power: 0.8, pebble: true };
    },

    other_can: function () { return null; },
  };

  /* ================================================================== auto policies */

  const DAMAGE_SKILLS = ['call_over_and_out', 'cannonball', 'salt_and_vinegar', 'rattle', 'red_pen',
    'paper_cut', 'skimmer', 'whistle_blast'];
  const SUPPORT_SKILLS = ['plaster', 'cup_of_tea', 'chip_shield', 'checklist', 'big_talk', 'spare_tissue',
    'fold', 'beachcomb'];
  const PEACE_SKILLS = ['call_first_class', 'special_delivery', 'plain_words', 'read_aloud', 'i_need_help',
    'forward_mail', 'call_by_the_book'];

  function rows(b, m) {
    const out = {};
    for (const r of b.skillRows(m)) out[r.id] = r;
    return out;
  }

  function firstEnemy(b) {
    const live = b.liveEnemies();
    return live.length ? live[0].idx : null;
  }

  function weakestEnemy(b) {
    const live = b.liveEnemies().filter(function (e) { return !e.invulnerable; });
    if (!live.length) return null;
    let best = live[0];
    for (const e of live) if (e.hp < best.hp) best = e;
    return best.idx;
  }

  function lowestAlly(b) {
    const live = b.aliveParty();
    if (!live.length) return null;
    let best = live[0];
    for (const a of live) if (a.hp / a.mhp < best.hp / best.mhp) best = a;
    return best;
  }

  /** A Say that would actually land, or null. */
  function findSay(b, m) {
    if (b.blockReason(m, 'say')) return null;
    for (const e of b.liveEnemies()) {
      for (let li = 0; li < e.lines.length; li++) {
        const l = e.lines[li];
        if (l.filled || !l.revealed) continue;
        if (l.sayer && l.sayer !== m.id) continue;
        if (l.last && e.lines.some(function (x, j) { return j !== li && !x.filled; })) continue;
        const want = b.wantedColour(e, l);
        for (let s = 0; s < 5; s++) {
          const p = m.pocket[s];
          if (!p || p.pebble) continue;
          if (l.star && !p.t) continue;
          if (l.from && p.from !== l.from) continue;
          if (want && want !== 'any' && want !== p.c) continue;
          return { type: 'say', slot: s, enemy: e.idx, line: li };
        }
      }
    }
    return null;
  }

  function findListen(b, m) {
    if (b.blockReason(m, 'listen')) return null;
    for (const e of b.liveEnemies()) {
      if (e.blurt) return { type: 'listen', enemy: e.idx };
      const rules = e.data.lineRules || {};
      if (rules.deliverByListens) return { type: 'listen', enemy: e.idx };
      if (e.lines.some(function (l) { return !l.revealed && !l.filled; })) return { type: 'listen', enemy: e.idx };
    }
    return null;
  }

  /** Who is allowed to Say in this battle (the Other Can locks it to Wren). */
  function sayer(b, m) {
    if (b.rules.onlySayer) return b.party.find(function (a) { return a.id === b.rules.onlySayer; }) || null;
    return null;
  }

  /**
   * A Confide worth making: first a piece a starred / from-locked Line needs, then a friend who is
   * Spilling, then simply the oldest raw piece when the Pocket is getting dangerous.
   */
  function findConfide(b, m) {
    if (b.blockReason(m, 'confide')) return null;
    const rawSlots = [];
    for (let i = 0; i < 5; i++) {
      const p = m.pocket[i];
      if (p && !p.pebble && !p.t) rawSlots.push(i);
    }
    if (!rawSlots.length) return null;
    const receivers = b.party.filter(function (a) { return a !== m && a.hp > 0 && b.canReceive(a); });
    if (!receivers.length) return null;
    const locked = sayer(b, m);

    // 1. a Line that wants Tumbled glass of a colour this member is holding raw
    for (const e of b.liveEnemies()) {
      for (let li = 0; li < e.lines.length; li++) {
        const l = e.lines[li];
        if (l.filled || !l.star) continue;
        if (l.from && l.from !== m.id) continue;
        if (l.last && e.lines.some(function (x, j) { return j !== li && !x.filled; })) continue;
        const want = b.wantedColour(e, l);
        for (const slot of rawSlots) {
          const p = m.pocket[slot];
          if (want && want !== 'any' && want !== p.c) continue;
          let to = locked;
          if (to && (to === m || to.hp <= 0 || !b.canReceive(to))) to = null;
          if (!to) {
            to = receivers.find(function (a) { return !b.blockReason(a, 'say') && !b.tumbledCount(a, p.c); }) ||
              receivers.find(function (a) { return !b.blockReason(a, 'say'); });
          }
          // no point sending a second copy of something they can already say
          if (to && holdsFor(b, to, e, l)) continue;
          if (to && to !== m) return { type: 'confide', slot: slot, to: to.idx, need: 'line' };
        }
      }
    }
    // 2. rescue a friend who is Spilling
    const spilling = receivers.find(function (a) { return a.spill; });
    if (spilling) return { type: 'confide', slot: rawSlots[0], to: spilling.idx, need: 'rescue' };
    // 3. keep the Pocket healthy - but only when it is actually getting dangerous, because the whole
    //    party shares one Can Line per round
    if (!b.brimming(m) && !m.spill) return null;
    let best = null, free = -1;
    for (const a of receivers) {
      let n = 0;
      for (const p of a.pocket) if (!p) n++;
      if (n > free) { free = n; best = a; }
    }
    if (!best) return null;
    let oldest = rawSlots[0], seq = Infinity;
    for (const i of rawSlots) if (m.pocket[i].seq < seq) { oldest = i; seq = m.pocket[i].seq; }
    return { type: 'confide', slot: oldest, to: best.idx };
  }

  /** True when this member is already holding a piece that would fill that Line. */
  function holdsFor(b, who, e, l) {
    const want = b.wantedColour(e, l);
    for (const p of who.pocket) {
      if (!p || p.pebble) continue;
      if (l.star && !p.t) continue;
      if (l.from && p.from !== l.from) continue;
      if (want && want !== 'any' && want !== p.c) continue;
      return true;
    }
    return false;
  }

  /** Would this skill actually change anything right now? Keeps the auto policies from looping. */
  function skillWouldDo(b, m, id) {
    const live = b.liveEnemies();
    switch (id) {
      case 'plain_words':
        return live.some(function (e) {
          return e.lines.some(function (l) { return !l.filled && l.revealed && !l.star && !l.from && !l.sayer; });
        });
      case 'read_aloud':
        return live.some(function (e) { return e.lines.some(function (l) { return !l.revealed && !l.filled; }); });
      case 'call_first_class':
        return live.some(function (e) { return e.lines.some(function (l) { return !l.filled && l.revealed && !l.from; }); });
      case 'special_delivery': {
        const piece = m.pocket.find(function (p) { return p && !p.pebble && p.t; });
        if (!piece) return false;
        return live.some(function (e) {
          return e.lines.some(function (l) {
            const want = b.wantedColour(e, l);
            return !l.filled && (!want || want === 'any' || want === piece.c) && (!l.from || l.from === piece.from);
          });
        });
      }
      case 'i_need_help':
        // it pulls every friend's oldest piece to Lin, so only when she really needs it and nobody is
        // routing glass to a locked sayer
        if (b.rules.onlySayer) return false;
        return m.hp / m.mhp < 0.6 && b.aliveParty().some(function (a) { return a !== m && b.rawCount(a) > 0; });
      case 'forward_mail':
        return b.aliveParty().some(function (a) { return a !== m && b.rawCount(a) > 0; }) && !m.forwardedThisRound;
      case 'call_by_the_book':
        return b.aliveParty().some(function (a) { return a.hp / a.mhp < 0.75; });
      case 'beachcomb':
        return b.rawCount(m) < 2;
      case 'big_talk':
      case 'checklist':
        return !m.states[id === 'big_talk' ? 'big_talk' : 'on_the_list'];
      case 'chip_shield': {
        const a = lowestAlly(b);
        return !!a && !a.states.shielded;
      }
      case 'fold':
        return !m.states.folded;
      case 'spare_tissue':
        return b.aliveParty().some(function (a) { return a !== m && (a.actor.pebbles > 0 || a.states.tongue_tied); });
      case 'oi':
        return !m.states.taunting;
      default:
        return true;
    }
  }

  function bestSkill(b, m, ids, wantOutLoud) {
    const r = rows(b, m);
    for (const id of ids) {
      const row = r[id];
      if (row && row.enabled && skillWouldDo(b, m, id)) {
        const cmd = { type: 'skill', skill: id, outLoud: wantOutLoud ? row.outLoud : (row.outLoud && !row.plain) };
        const sk = G.DATA.skills[id];
        if (sk.target === 'enemy' || sk.target === 'all_enemies') cmd.enemy = weakestEnemy(b);
        if (cmd.enemy == null && (sk.target === 'enemy')) continue;
        if (sk.target === 'ally') { const a = lowestAlly(b); cmd.ally = a ? a.idx : m.idx; }
        if (sk.target === 'other_ally') {
          const a = b.aliveParty().find(function (x) { return x !== m; });
          if (!a) continue;
          cmd.ally = a.idx;
        }
        if (sk.target === 'two_allies') {
          const route = findRoute(b, m);
          if (!route) continue;
          cmd.from = route.from; cmd.to = route.to; cmd.slot = route.slot;
        }
        if (id === 'beachcomb') cmd.colour = m.home;
        if (id === 'forward_mail') m.forwardedThisRound = true;
        return cmd;
      }
    }
    return null;
  }

  /** Which raw piece should travel to whom (Forward Mail): a Line's colour toward the one who can Say. */
  function findRoute(b, m) {
    const live = b.liveEnemies();
    const locked = sayer(b, m);
    for (const e of live) {
      for (const l of e.lines) {
        if (l.filled || !l.star) continue;
        for (const a of b.aliveParty()) {
          if (l.from && l.from !== a.id) continue;
          const want = b.wantedColour(e, l);
          for (let i = 0; i < 5; i++) {
            const p = a.pocket[i];
            if (!p || p.pebble || p.t) continue;
            if (want && want !== 'any' && want !== p.c) continue;
            let to = locked;
            if (!to) to = b.aliveParty().find(function (x) { return x !== a && !b.blockReason(x, 'say') && b.canReceive(x); });
            if (to && to !== a && b.canReceive(to)) return { from: a.idx, to: to.idx, slot: i };
          }
        }
      }
    }
    const from = b.aliveParty().find(function (x) { return x !== m && b.rawCount(x) > 0 && b.brimming(x); });
    const to = from ? b.aliveParty().find(function (x) { return x !== from && b.canReceive(x); }) : null;
    if (from && to) return { from: from.idx, to: to.idx, slot: null };
    return null;
  }

  function healIfNeeded(b, m) {
    const low = lowestAlly(b);
    if (!low || low.hp / low.mhp > 0.4) return null;
    const r = rows(b, m);
    if (r.cup_of_tea && r.cup_of_tea.enabled && b.aliveParty().filter(function (a) { return a.hp / a.mhp < 0.6; }).length >= 2) {
      return { type: 'skill', skill: 'cup_of_tea', outLoud: r.cup_of_tea.outLoud && !r.cup_of_tea.plain };
    }
    if (r.plaster && r.plaster.enabled) {
      return { type: 'skill', skill: 'plaster', ally: low.idx, outLoud: r.plaster.outLoud && !r.plaster.plain };
    }
    if (G.State.itemCount('bag_of_chips') > 0 && low.hp / low.mhp < 0.35) {
      return { type: 'item', item: 'bag_of_chips', target: low.idx };
    }
    return null;
  }

  const POLICIES = {
    attack: function (b, m) {
      const heal = healIfNeeded(b, m);
      if (heal) return heal;
      const dmg = bestSkill(b, m, DAMAGE_SKILLS, false);
      if (dmg) return dmg;
      const target = weakestEnemy(b);
      if (target != null && !b.blockReason(m, 'strike')) return { type: 'strike', enemy: target };
      const sup = bestSkill(b, m, SUPPORT_SKILLS, false);
      if (sup) return sup;
      return { type: 'brace', ally: m.idx };
    },

    smart: function (b, m) {
      const say = findSay(b, m);
      if (say) return say;
      let confide = null;
      if (!m.triedConfide) confide = findConfide(b, m);
      if (confide && confide.need === 'line') { m.triedConfide = true; return confide; }
      const heal = healIfNeeded(b, m);
      if (heal) return heal;
      if (confide) { m.triedConfide = true; return confide; }
      const listen = findListen(b, m);
      if (listen) return listen;
      const peace = bestSkill(b, m, PEACE_SKILLS, true);
      if (peace) return peace;
      const dmg = bestSkill(b, m, DAMAGE_SKILLS, false);
      if (dmg) return dmg;
      const target = weakestEnemy(b);
      if (target != null && !b.blockReason(m, 'strike')) return { type: 'strike', enemy: target };
      return { type: 'brace', ally: m.idx };
    },

    pacifist: function (b, m) {
      const say = findSay(b, m);
      if (say) return say;
      let confide = null;
      if (!m.triedConfide) confide = findConfide(b, m);
      if (confide && confide.need === 'line') { m.triedConfide = true; return confide; }
      const heal = healIfNeeded(b, m);
      if (heal) return heal;
      if (confide) { m.triedConfide = true; return confide; }
      const listen = findListen(b, m);
      if (listen) return listen;
      const peace = bestSkill(b, m, PEACE_SKILLS, true);
      if (peace) return peace;
      const sup = bestSkill(b, m, SUPPORT_SKILLS, false);
      if (sup) return sup;
      // a kind player who has run out of ideas still defends: this also keeps tests finite
      if (b.round > 20) return POLICIES.attack(b, m);
      const low = lowestAlly(b);
      return { type: 'brace', ally: low ? low.idx : m.idx };
    },
  };

  G.BattleAI = {
    RULES: RULES,

    /** One enemy move, or null when the Unsent does nothing at all. */
    decide: function (b, e) {
      const fn = RULES[e.data.ai] || RULES[e.id];
      if (!fn) { G.warn('BattleAI: no rules for ' + e.id); return { name: 'Waits' }; }
      return fn(b, e);
    },

    /**
     * An automatic player for tests and the F4/auto mode.
     * @param {'attack'|'smart'|'pacifist'} name
     * @returns {function(object, object): object} choose(battle, member) -> command
     */
    autoPolicy: function (name) {
      const fn = POLICIES[name] || POLICIES.attack;
      return function (b, m) {
        if (m.autoRound !== b.round) { m.autoRound = b.round; m.triedConfide = false; m.forwardedThisRound = false; }
        let cmd = null;
        try {
          cmd = fn(b, m);
        } catch (err) {
          G.error(err);
        }
        if (!cmd) cmd = { type: 'brace', ally: m.idx };
        return cmd;
      };
    },

    policies: Object.keys(POLICIES),
  };
})();
