/*
 * party.js - G.Party: stat maths, levels, known skills, keepsakes and out-of-battle item use.
 * Pure data + state, no UI, no canvas. Node-safe (the battle tests load it in a vm sandbox).
 *
 * Actor instances live in G.State.party; the persistent battle fields are installed by the
 * G.State.hooks.createActor hook at the bottom of this file:
 *   hp, level, exp, pebbles (ordinary count, 0-2), equips.keepsake
 * Story Pebbles are never stored: they are derived from the segN_kept variables (DESIGN_BIBLE 6.5).
 * Glass never persists between battles.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  const U = G.Util;

  const MAX_LEVEL = 10;
  const MAX_PEBBLES = 2;

  function def(actor) {
    const id = typeof actor === 'string' ? actor : actor && actor.id;
    return (G.DATA.actors && G.DATA.actors[id]) || null;
  }

  function inst(actor) {
    if (actor && typeof actor === 'object') return actor;
    return G.State.actor(actor);
  }

  function expTable() {
    return G.DATA.expTable || [0, 0];
  }

  /** Keepsake definition of an actor (or null). */
  function keepsakeOf(a) {
    const id = a && a.equips ? a.equips.keepsake : null;
    return id && G.DATA.items[id] ? G.DATA.items[id] : null;
  }

  const Party = G.Party = {
    MAX_LEVEL: MAX_LEVEL,
    MAX_PEBBLES: MAX_PEBBLES,

    /** Raw level stats of an actor id (no keepsake): floor(base + growth * (level - 1)). */
    baseStats: function (actorId, level) {
      const d = (G.DATA.actors && G.DATA.actors[actorId]) || null;
      if (!d) return { mhp: 1, atk: 1, def: 0, spd: 1 };
      const b = d.base, g = d.growth || { hp: 0, atk: 0, def: 0, spd: 0 };
      const lv = U.clamp(level || 1, 1, MAX_LEVEL) - 1;
      return {
        mhp: Math.floor(b.hp + g.hp * lv),
        atk: Math.floor(b.atk + g.atk * lv),
        def: Math.floor(b.def + g.def * lv),
        spd: Math.floor(b.spd + g.spd * lv),
      };
    },

    /**
     * Full stats of an actor instance including its keepsake.
     * @returns {{mhp:number, atk:number, def:number, spd:number}}
     */
    stats: function (actor) {
      const a = inst(actor);
      if (!a) return { mhp: 1, atk: 1, def: 0, spd: 1 };
      const s = Party.baseStats(a.id, a.level);
      const k = keepsakeOf(a);
      if (k && k.stats) {
        if (k.stats.hp) s.mhp += k.stats.hp;
        if (k.stats.atk) s.atk += k.stats.atk;
        if (k.stats.def) s.def += k.stats.def;
        if (k.stats.spd) s.spd += k.stats.spd;
      }
      s.mhp = Math.max(1, s.mhp);
      return s;
    },

    /** Maximum Breath (shorthand used by G.State.hooks.maxHp). */
    maxHp: function (actor) {
      return Party.stats(actor).mhp;
    },

    /** True when the actor's keepsake carries this passive id. */
    hasPassive: function (actor, passiveId) {
      const a = inst(actor);
      if (!a) return false;
      const k = keepsakeOf(a);
      if (k && k.passive === passiveId) return true;
      const d = def(a);
      return !!(d && d.passive === passiveId);
    },

    /** EXP still needed for the next level, or null at the maximum level. */
    expToNext: function (actor) {
      const a = inst(actor);
      if (!a || a.level >= MAX_LEVEL) return null;
      return Math.max(0, expTable()[a.level + 1] - (a.exp || 0));
    },

    /**
     * Adds EXP and levels the actor up as far as it goes.
     * @returns {{levels:number[], learned:string[]}} the levels reached and skills learnt
     */
    gainExp: function (actor, n) {
      const a = inst(actor);
      const out = { levels: [], learned: [] };
      if (!a || !(n > 0)) return out;
      const before = Party.knownSkills(a);
      a.exp = (a.exp || 0) + n;
      const table = expTable();
      while (a.level < MAX_LEVEL && a.exp >= table[a.level + 1]) {
        const oldMax = Party.stats(a).mhp;
        a.level++;
        out.levels.push(a.level);
        a.hp = Math.min(Party.stats(a).mhp, a.hp + (Party.stats(a).mhp - oldMax));
      }
      if (out.levels.length) {
        for (const s of Party.knownSkills(a)) if (before.indexOf(s) < 0) out.learned.push(s);
        a.skills = Party.knownSkills(a);
      }
      return out;
    },

    /** Sets an actor's level directly (used by __game.setLevel) and tops up Breath. */
    setLevel: function (actor, level) {
      const a = inst(actor);
      if (!a) return;
      a.level = U.clamp(level | 0, 1, MAX_LEVEL);
      a.exp = Math.max(a.exp || 0, expTable()[a.level] || 0);
      a.skills = Party.knownSkills(a);
      a.hp = Party.stats(a).mhp;
    },

    /**
     * Skills an actor knows right now: level-gated entries plus story-flag entries.
     * @returns {string[]}
     */
    knownSkills: function (actor) {
      const a = inst(actor);
      const d = def(a || actor);
      if (!d || !Array.isArray(d.skills)) return [];
      const lv = a ? a.level : 1;
      const out = [];
      for (const s of d.skills) {
        if (typeof s === 'string') { out.push(s); continue; }
        if (!s || !s.id) continue;
        if (s.flag) { if (G.State.getFlag(s.flag)) out.push(s.id); continue; }
        if ((s.level || 1) <= lv) out.push(s.id);
      }
      return out;
    },

    /** Restores Breath to the maximum. */
    fullHeal: function (actor) {
      const a = inst(actor);
      if (!a) return;
      a.hp = Party.stats(a).mhp;
    },

    /**
     * Pebbles currently blocking this actor's Pocket.
     * @returns {{ordinary:number, story:number, total:number}}
     */
    pebbles: function (actor) {
      const a = inst(actor);
      if (!a) return { ordinary: 0, story: 0, total: 0 };
      const ordinary = U.clamp(a.pebbles || 0, 0, MAX_PEBBLES);
      let story = 0;
      if (a.id === 'wren') {
        const late = G.State.getFlag('memory_rocks_done');
        const segs = late ? ['seg5_kept'] : ['seg1_kept', 'seg2_kept', 'seg3_kept', 'seg4_kept', 'seg5_kept'];
        let unsaid = 0;
        for (const s of segs) if (G.State.getVar(s) > 0) unsaid++;
        story = unsaid >= 2 ? 2 : unsaid >= 1 ? 1 : 0;
      }
      return { ordinary: ordinary, story: story, total: Math.min(4, ordinary + story) };
    },

    /** Gives an actor one ordinary Pebble (capped at MAX_PEBBLES). Returns true when it fitted. */
    addPebble: function (actor) {
      const a = inst(actor);
      if (!a) return false;
      if (Party.hasPassive(a, 'no_pebbles')) return false;
      const cur = U.clamp(a.pebbles || 0, 0, MAX_PEBBLES);
      if (cur >= MAX_PEBBLES) return false;
      a.pebbles = cur + 1;
      return true;
    },

    /**
     * Equips (or removes with null) a keepsake. The inventory is adjusted: the old one goes back in.
     * @returns {string|null} the previously worn keepsake id
     */
    equipKeepsake: function (actor, itemId) {
      const a = inst(actor);
      if (!a) return null;
      a.equips = a.equips || {};
      const prev = a.equips.keepsake || null;
      if (itemId) {
        const it = G.DATA.items[itemId];
        if (!it || it.kind !== 'keepsake') { G.warn('Party.equipKeepsake: not a keepsake: ' + itemId); return prev; }
        if (G.State.itemCount(itemId) <= 0) return prev;
        G.State.removeItem(itemId, 1);
      }
      if (prev) G.State.addItem(prev, 1);
      a.equips.keepsake = itemId || null;
      const mhp = Party.stats(a).mhp;
      if (a.hp > mhp) a.hp = mhp;
      return prev;
    },

    /** Clears every ordinary Pebble in the party (a friend's Skim at a rock pool). Returns the count. */
    skim: function () {
      let n = 0;
      for (const a of G.State.party.concat(G.State.reserve)) {
        n += U.clamp(a.pebbles || 0, 0, MAX_PEBBLES);
        a.pebbles = 0;
      }
      return n;
    },

    /* ---------------------------------------------------------------- items outside battle */

    /** True when this item may be used from the menu on this target. */
    canUseInMenu: function (itemId, actor) {
      const it = G.DATA.items[itemId];
      if (!it || !it.useInMenu) return false;
      if (G.State.itemCount(itemId) <= 0) return false;
      const a = inst(actor);
      if (!a && it.target !== 'party') return false;
      if (!it.effects) return false;
      const revives = it.effects.some(function (e) { return e.kind === 'revive'; });
      if (a) {
        if (revives) return a.hp <= 0;
        if (a.hp <= 0) return false;
      }
      return true;
    },

    /**
     * Uses a consumable outside battle. `user` matters for flask_of_tea (only works on someone else).
     * @returns {{ok:boolean, message:string}}
     */
    useInMenu: function (itemId, user, target) {
      const it = G.DATA.items[itemId];
      if (!it) return { ok: false, message: 'There is no such thing.' };
      const u = inst(user);
      const t = inst(target) || u;
      if (!Party.canUseInMenu(itemId, t)) return { ok: false, message: 'Not now.' };
      if (it.target === 'other_ally' && u && t && u.id === t.id) {
        return { ok: false, message: "You can't pour your own." };
      }
      const targets = it.target === 'party' ? G.State.party.slice() : [t];
      const names = [];
      for (const a of targets) {
        const mhp = Party.stats(a).mhp;
        for (const e of it.effects || []) {
          switch (e.kind) {
            case 'heal':
              if (a.hp <= 0) break;
              a.hp = Math.min(mhp, a.hp + (e.amount != null ? e.amount : Math.round(mhp * (e.pct || 0) / 100)));
              break;
            case 'revive':
              if (a.hp <= 0) a.hp = Math.max(1, Math.round(mhp * (e.pct || 50) / 100));
              break;
            case 'removePebbles': a.pebbles = 0; break;
            case 'glass': break;                       // glass only exists inside a battle
            case 'removeState': break;
            default: break;
          }
        }
        names.push(a.name);
      }
      G.State.removeItem(itemId, 1);
      return { ok: true, message: it.name + ' → ' + names.join(', ') };
    },

    /* ---------------------------------------------------------------- after a battle (6.2) */

    /** Everyone regains 20% Breath, Winded members stand up at 25%, Pebbles stay. */
    recover: function () {
      for (const a of G.State.party) {
        const mhp = Party.stats(a).mhp;
        if (a.hp <= 0) a.hp = Math.max(1, Math.round(mhp * 0.25));
        else a.hp = Math.min(mhp, a.hp + Math.round(mhp * 0.20));
      }
    },
  };

  /* ------------------------------------------------------------------ G.State integration */

  G.State.hooks.createActor = function (actor, d) {
    actor.level = U.clamp(actor.level || 1, 1, MAX_LEVEL);
    actor.exp = Math.max(actor.exp || 0, (G.DATA.expTable || [0, 0])[actor.level] || 0);
    actor.equips = actor.equips || {};
    if (actor.equips.keepsake === undefined) actor.equips.keepsake = null;
    actor.pebbles = actor.pebbles || 0;
    delete actor.mp;
    if (d && d.base) {
      actor.skills = Party.knownSkills(actor);
      actor.hp = Party.stats(actor).mhp;
    }
  };
  G.State.hooks.setLevel = function (actor, level) { Party.setLevel(actor, level); };
  G.State.hooks.maxHp = function (actor) { return Party.stats(actor).mhp; };
  G.State.hooks.healAll = function (party, reserve) {
    for (const a of party.concat(reserve || [])) {
      a.hp = Party.stats(a).mhp;
      if (Array.isArray(a.states)) a.states.length = 0;
    }
  };

  /** The Delivered Mail album lives in G.State and is persisted with the save (see state.js). */
  if (!G.State.album) G.State.album = {};
})();
