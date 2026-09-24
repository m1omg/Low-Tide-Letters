/*
 * battle_logic.js - G.BattleLogic: the whole rules engine of DESIGN_BIBLE section 6.
 *
 * Pure and deterministic given G.Util.rng. No canvas, no audio, no timers, no DOM: it runs in plain
 * Node (tools/test/battle_sim.js loads it in a vm sandbox). It emits an ordered list of plain battle
 * EVENT objects which battle_scene.js plays back with animation and sound.
 *
 *   const b = G.BattleLogic.create({ troop:'troop_card_crab', party:G.State.party, canEscape:true });
 *   let s = b.advance();                       // -> {state:'input', actor} | {state:'end', result}
 *   b.take();                                  // -> the events produced so far (and clears them)
 *   b.act({type:'strike', enemy:0});           // the active member's action
 *   b.confide({slot:0, to:1});                 // free pre-action, once per round for the whole party
 *
 * Event objects (all plain data; `who`/`enemy` are indices into b.party / b.enemies):
 *   {t:'round', round} {t:'turn', who, side} {t:'message', text} {t:'hint', text}
 *   {t:'glass', who, slot, piece, reason} {t:'glassOut', who, slot, piece} {t:'glassLost', who, piece}
 *   {t:'rattlePocket', who} {t:'brim', who, colour, state} {t:'spill', who, colour, kind}
 *   {t:'confide', from, to, piece, line} {t:'strike', who, enemy} {t:'skill', who, id, outLoud, name}
 *   {t:'damage', side, who, amount, crit, miss, source} {t:'heal', side, who, amount}
 *   {t:'state', side, who, id, on} {t:'listen', who, enemy, revealed}
 *   {t:'say', who, enemy, line, piece, ok} {t:'lineFill', enemy, line, colour} {t:'lineReveal', enemy, line}
 *   {t:'misheard', enemy} {t:'shake', enemy, line} {t:'delivered', enemy} {t:'hushed', enemy}
 *   {t:'winded', who} {t:'stand', who} {t:'pebble', who} {t:'enemyMove', enemy, name, text}
 *   {t:'blurt', enemy, name} {t:'blurtCancel', enemy} {t:'mutter', enemy, text} {t:'phase', enemy, line}
 *   {t:'clock', text} {t:'item', who, id, target} {t:'escape', ok} {t:'end', outcome}
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  const U = G.Util;

  const COLOURS = ['red', 'blue', 'amber', 'green'];
  const HOME_STATE = { red: 'short_fuse', blue: 'fretting', amber: 'doting', green: 'daydreaming' };
  const BRIM_NAME = { red: 'Short Fuse', blue: 'Fretting', amber: 'Doting', green: 'Daydreaming' };
  const SPILL_NAME = { red: 'Lash Out', blue: 'Freeze Up', amber: 'Cling', green: 'Drift Off' };
  const COLOUR_NAME = { red: 'Red', blue: 'Blue', amber: 'Amber', green: 'Green' };

  /** DESIGN_BIBLE 6.7. `turns` is the default duration; effects are read by statOf()/damage(). */
  const STATES = {
    winded: { name: 'Winded', turns: Infinity, bad: true },
    riled: { name: 'Riled', turns: 2, atkMul: 1.2 },
    soothed: { name: 'Soothed', turns: 1, bad: true },
    rattled: { name: 'Rattled', turns: 2, atkMul: 0.8, bad: true },
    tongue_tied: { name: 'Tongue-Tied', turns: 2, bad: true },
    covered: { name: 'Covered', turns: 1 },
    shielded: { name: 'Shielded', turns: 99 },
    big_talk: { name: 'Big Talk', turns: 3, dmgMul: 1.15 },
    on_the_list: { name: 'On the List', turns: 3, uses: 3, effectMul: 1.15 },
    soft_spot: { name: 'Soft Spot', turns: 2, defMul: 0.8, bad: true },
    folded: { name: 'Folded', turns: 99 },
    bracing: { name: 'Bracing', turns: 1, takenMul: 0.6 },
    fine: { name: "I'm Fine!", turns: 3, defMul: 1.3, selfBuff: true },
    sidestep: { name: 'Sidestepping', turns: 1, evade: 0.30, selfBuff: true },
    mirror_guard: { name: 'Mirrored', turns: 1, evade: 1, selfBuff: true },
    taunting: { name: 'Loud', turns: 2 },
    holding: { name: 'Holding the string', turns: 1 },
  };

  function rnd() { return U.rng(); }
  function chance(p) { return U.rng() < p; }
  function pick(arr) { return arr.length ? arr[Math.floor(U.rng() * arr.length)] : null; }

  /* ================================================================== construction */

  function makeMember(actor, idx) {
    const d = G.DATA.actors[actor.id] || {};
    const st = G.Party.stats(actor);
    const peb = G.Party.pebbles(actor);
    const m = {
      side: 'party', idx: idx, id: actor.id, name: actor.name || d.name || actor.id,
      actor: actor, home: d.home || 'blue', char: d.char || null, color: d.color || '#8a8a8a',
      mhp: st.mhp, hp: Math.min(st.mhp, actor.hp > 0 ? actor.hp : st.mhp),
      atk: st.atk, def: st.def, spd: st.spd,
      pocket: [null, null, null, null, null],
      states: {}, spill: null, quick: false, cooldowns: {},
      covering: null, gainedBlue: false, gainedRed: false, confidedFree: false,
      skills: G.Party.knownSkills(actor),
      passive: d.passive || null,
      keepsake: (actor.equips && actor.equips.keepsake) || null,
    };
    if (m.hp <= 0) { m.hp = 0; m.states.winded = { turns: Infinity }; }
    let slot = 0;
    for (let i = 0; i < peb.story; i++) m.pocket[slot++] = { pebble: true, story: true };
    for (let i = 0; i < peb.ordinary && slot < 5; i++) m.pocket[slot++] = { pebble: true, story: false };
    return m;
  }

  function enemyDef(id) {
    const e = G.DATA.enemies[id];
    if (!e) return null;
    if (!e.base) return e;
    const b = G.DATA.enemies[e.base] || {};
    const merged = Object.assign({}, b, e);
    merged.hp = Math.round((e.hp || b.hp) * (e.hpMul || 1));
    merged.ai = e.ai || b.ai;
    merged.letter = e.letter || b.letter;
    merged.mutters = e.mutters || b.mutters;
    merged.lineRules = e.lineRules !== undefined ? e.lineRules : b.lineRules;
    return merged;
  }

  function makeEnemy(id, idx, album) {
    const d = enemyDef(id);
    if (!d) { G.warn('BattleLogic: unknown enemy ' + id); return null; }
    const known = (album && album[id] && album[id].linesKnown) || [];
    const lines = (d.lines || []).map(function (l, i) {
      return {
        c: l.c, star: !!l.star, shownAs: l.shownAs || null, from: l.from || null, sayer: l.sayer || null,
        last: !!l.last, revealed: !!known[i], filled: false, colour: null, grown: false,
      };
    });
    return {
      side: 'enemy', idx: idx, id: id, data: d, name: d.name, img: d.img,
      mhp: d.hp, hp: d.hp, atk: d.atk, def: d.def, spd: d.spd,
      lines: lines, listens: 0, states: {}, phase: 0, blurt: null, seen: {},
      bonusAtk: 0, targetedThisRound: false, struck: false, lastHit: null,
      resolved: null, seenByParty: false, actionsLeft: d.actions == null ? 1 : d.actions,
      invulnerable: !!d.invulnerable, mutterIndex: 0,
    };
  }

  /* ================================================================== the battle object */

  function create(params) {
    params = params || {};
    const troop = G.DATA.troops[params.troop];
    if (!troop) { G.warn('BattleLogic: unknown troop ' + params.troop); }
    const rules = (troop && troop.rules) || {};
    const album = (G.State && G.State.album) || {};
    const partyActors = (params.party || (G.State ? G.State.party : [])).slice(0, 4);

    const b = {
      troopId: params.troop,
      troop: troop || { members: [] },
      rules: rules,
      canEscape: params.canEscape !== false && !rules.noEscape,
      round: 0,
      party: partyActors.map(makeMember),
      enemies: [],
      queue: [],
      active: null,
      events: [],
      seq: 1,
      done: false,
      result: null,
      canLine: { used: false, jammed: false },
      delivered: 0,
      hushed: 0,
      log: [],
      hints: ((rules.tutorial && rules.tutorial.hints) || []).slice(),
    };
    let i = 0;
    for (const id of (troop ? troop.members : [])) {
      const e = makeEnemy(id, i, album);
      if (e) { b.enemies.push(e); i++; }
    }

    /* ---------------------------------------------------------------- helpers bound to b */

    function ev(o) { b.events.push(o); return o; }
    function msg(text) { ev({ t: 'message', text: text }); }

    function aliveParty() { return b.party.filter(function (m) { return m.hp > 0; }); }
    function liveEnemies() { return b.enemies.filter(function (e) { return !e.resolved; }); }

    function has(c, id) { return !!c.states[id]; }

    function addState(c, id, turns) {
      const def = STATES[id];
      if (!def) return false;
      if (id === 'tongue_tied' && c.side === 'party' && G.Party.hasPassive(c.actor, 'immune_tongue_tied')) {
        msg(c.name + ' keeps talking. (Postmaster’s Feather)');
        return false;
      }
      const s = c.states[id] || {};
      s.turns = Math.max(s.turns || 0, turns != null ? turns : def.turns);
      if (def.uses) s.uses = def.uses;
      if (id === 'soothed') s.count = (s.count || 0) + 1;
      c.states[id] = s;
      ev({ t: 'state', side: c.side, who: c.idx, id: id, on: true, name: def.name });
      return true;
    }

    function removeState(c, id) {
      if (!c.states[id]) return false;
      delete c.states[id];
      ev({ t: 'state', side: c.side, who: c.idx, id: id, on: false, name: STATES[id] ? STATES[id].name : id });
      return true;
    }

    function tickStates(c) {
      for (const id of Object.keys(c.states)) {
        const def = STATES[id];
        if (!def || def.turns === Infinity || def.turns >= 99) continue;
        const s = c.states[id];
        if (s.turns > 0) s.turns--;
        if (s.turns <= 0 && !(id === 'on_the_list' && s.uses > 0)) removeState(c, id);
      }
    }

    /* ---------------------------------------------------------------- glass */

    function rawCount(m, colour) {
      let n = 0;
      for (const p of m.pocket) if (p && !p.pebble && !p.t && (!colour || p.c === colour)) n++;
      return n;
    }
    function tumbledCount(m, colour) {
      let n = 0;
      for (const p of m.pocket) if (p && !p.pebble && p.t && (!colour || p.c === colour)) n++;
      return n;
    }
    function pebbleSlots(m) {
      let n = 0;
      for (const p of m.pocket) if (p && p.pebble) n++;
      return n;
    }

    /** The Brimming colour (3+ raw of one colour), or null. */
    function brimming(m) {
      for (const c of COLOURS) if (rawCount(m, c) >= 3) return c;
      return null;
    }

    function oldestRawSlot(m) {
      let best = -1;
      for (let i = 0; i < 5; i++) {
        const p = m.pocket[i];
        if (p && !p.pebble && !p.t && (best < 0 || p.seq < m.pocket[best].seq)) best = i;
      }
      return best;
    }

    function afterPocket(m) {
      const brim = brimming(m);
      const wanted = brim ? HOME_STATE[brim] : null;
      if (m.brimState !== wanted) {
        m.brimState = wanted;
        ev({ t: 'brim', who: m.idx, colour: brim, state: wanted, name: brim ? BRIM_NAME[brim] : null });
      }
      // Spill: every non-Pebble slot holds the same raw colour, at least three pieces (6.3)
      const free = 5 - pebbleSlots(m);
      for (const c of COLOURS) {
        const n = rawCount(m, c);
        if (n >= 3 && n === free && !m.spill) {
          m.spill = { colour: c, left: 2 };
          ev({ t: 'spill', who: m.idx, colour: c, kind: SPILL_NAME[c], start: true });
          return;
        }
      }
      // one piece short: the Pocket rattles
      for (const c of COLOURS) {
        const n = rawCount(m, c);
        if (n >= 2 && n === free - 1 && free >= 3) { ev({ t: 'rattlePocket', who: m.idx }); return; }
      }
    }

    /**
     * Puts a piece in a Pocket. When it is full the oldest raw piece rolls away; if there is none
     * the new piece is lost (6.3).
     */
    function gainGlass(m, colour, o) {
      o = o || {};
      if (!m || m.hp <= 0 || !colour) return null;
      const piece = { c: colour, t: !!o.tumbled, from: o.from || null, seq: b.seq++ };
      let i = m.pocket.indexOf(null);
      if (i < 0) {
        const oldest = oldestRawSlot(m);
        if (oldest < 0) { ev({ t: 'glassLost', who: m.idx, piece: piece }); return null; }
        ev({ t: 'glassOut', who: m.idx, slot: oldest, piece: m.pocket[oldest] });
        i = oldest;
      }
      m.pocket[i] = piece;
      ev({ t: 'glass', who: m.idx, slot: i, piece: piece, reason: o.reason || null });
      afterPocket(m);
      return piece;
    }

    function takePiece(m, slot) {
      const p = m.pocket[slot];
      if (!p || p.pebble) return null;
      m.pocket[slot] = null;
      afterPocket(m);
      return p;
    }

    function clearRaw(m) {
      for (let i = 0; i < 5; i++) {
        const p = m.pocket[i];
        if (p && !p.pebble && !p.t) m.pocket[i] = null;
      }
      afterPocket(m);
    }

    /* ---------------------------------------------------------------- stats and damage */

    function statOf(c, key) {
      let v = c[key];
      if (key === 'atk' && c.side === 'enemy') v += c.bonusAtk || 0;
      for (const id of Object.keys(c.states)) {
        const d = STATES[id];
        if (!d) continue;
        if (key === 'atk' && d.atkMul) v *= d.atkMul;
        if (key === 'def' && d.defMul) v *= d.defMul;
      }
      return Math.max(0, Math.round(v));
    }

    /** Sharp and smooth (6.2) plus Brimming / Spill / Brace modifiers on incoming damage. */
    function takenMul(c) {
      let k = 1;
      if (c.side === 'party') {
        k *= 1 + 0.05 * rawCount(c) - 0.05 * tumbledCount(c);
        if (c.brimState === 'fretting') k *= 0.75;
        if (c.spill && c.spill.colour === 'blue') k *= 0.5;
      }
      for (const id of Object.keys(c.states)) {
        const d = STATES[id];
        if (d && d.takenMul) k *= d.takenMul;
      }
      return Math.max(0.05, k);
    }

    function dealtMul(c, kind) {
      let k = 1;
      if (c.side === 'party') {
        if (c.brimState === 'short_fuse' && kind === 'damage') k *= 1.25;
        if (c.states.big_talk) k *= 1.15;
        if (c.states.on_the_list) k *= 1.15;
      }
      return k;
    }

    function evadeChance(c) {
      let e = 0.03;
      if (c.side === 'party' && c.brimState === 'daydreaming') e += 0.15;
      if (c.spill && c.spill.colour === 'green') e += 0.5;
      for (const id of Object.keys(c.states)) {
        const d = STATES[id];
        if (d && d.evade) e += d.evade;
      }
      return e;
    }

    /**
     * The damage formula of 6.2:  max(1, round((atk*2 - def) * power * mods * rnd)), rnd 0.92-1.08.
     * @returns {{amount:number, crit:boolean, miss:boolean}}
     */
    function damage(src, tgt, o) {
      o = o || {};
      const power = o.power == null ? 1 : o.power;
      let atk = o.atk != null ? o.atk : statOf(src, 'atk');
      let def = statOf(tgt, 'def');
      if (o.ignoreHalfDef) def = Math.round(def / 2);
      const missChance = o.cannotMiss ? 0 : evadeChance(tgt);
      if (tgt.states.folded) { removeState(tgt, 'folded'); return { amount: 0, crit: false, miss: true }; }
      if (tgt.states.mirror_guard) { removeState(tgt, 'mirror_guard'); return { amount: 0, crit: false, miss: true }; }
      if (chance(missChance)) return { amount: 0, crit: false, miss: true };
      const crit = chance(o.crit != null ? o.crit : 0.05);
      let mods = dealtMul(src, 'damage') * takenMul(tgt) * (o.mul || 1);
      if (crit) mods *= 1.5;
      const variance = 0.92 + rnd() * 0.16;
      const amount = Math.max(1, Math.round((atk * 2 - def) * power * mods * variance));
      return { amount: amount, crit: crit, miss: false };
    }

    /** Single-target redirection: Oi!, Brace/Cover and Doting (6.3/6.6). */
    function redirect(target) {
      if (target.side !== 'party') return target;
      const cov = target.states.covered;
      if (cov && cov.by != null) {
        const c = b.party[cov.by];
        if (c && c.hp > 0) return c;
      }
      return target;
    }

    function pickPartyTarget(e) {
      const live = aliveParty();
      if (!live.length) return null;
      const taunt = b.party.find(function (m) { return m.hp > 0 && m.states.taunting; });
      if (taunt) return taunt;
      // Doting steps in front of the lowest-Breath ally
      let t = pick(live);
      if (e && e.preferred != null) {
        const p = b.party[e.preferred];
        if (p && p.hp > 0 && chance(0.7)) t = p;
      }
      const doting = b.party.find(function (m) { return m.hp > 0 && m.brimState === 'doting'; });
      if (doting) {
        let lowest = live[0];
        for (const m of live) if (m.hp / m.mhp < lowest.hp / lowest.mhp) lowest = m;
        if (lowest === t && doting !== t) return doting;
      }
      return t;
    }

    function hurtMember(m, amount, o) {
      o = o || {};
      if (m.hp <= 0) return 0;
      if (m.states.shielded) { removeState(m, 'shielded'); ev({ t: 'damage', side: 'party', who: m.idx, amount: 0, shielded: true }); return 0; }
      const before = m.hp;
      m.hp = Math.max(0, m.hp - amount);
      ev({ t: 'damage', side: 'party', who: m.idx, amount: amount, crit: !!o.crit, source: o.source || null });
      // being hit: +1 Blue, at most once per round (some enemies push another colour instead)
      if (amount > 0 && !m.gainedBlue) {
        m.gainedBlue = true;
        gainGlass(m, o.glass || 'blue', { reason: 'hit' });
      }
      const lost = (before - m.hp) / m.mhp;
      if (m.hp <= 0) {
        addState(m, 'winded', Infinity);
        m.spill = null;
        ev({ t: 'winded', who: m.idx });
      }
      if (lost >= 0.25 || m.hp <= 0) {
        for (const a of b.party) {
          if (a === m || a.hp <= 0 || a.gainedRed) continue;
          a.gainedRed = true;
          gainGlass(a, 'red', { reason: 'ally hurt' });
        }
      }
      return amount;
    }

    function healMember(m, amount, o) {
      o = o || {};
      if (!m) return 0;
      if (m.hp <= 0 && !o.revive) return 0;
      const before = m.hp;
      m.hp = Math.min(m.mhp, m.hp + Math.max(0, Math.round(amount)));
      if (m.hp > 0 && before <= 0) { removeState(m, 'winded'); ev({ t: 'stand', who: m.idx }); }
      const got = m.hp - before;
      if (got > 0) ev({ t: 'heal', side: 'party', who: m.idx, amount: got });
      if (got > 0 && o.byAlly) gainGlass(m, 'amber', { reason: 'cared for' });
      return got;
    }

    /* ---------------------------------------------------------------- Lines */

    function wantedColour(e, line) {
      if (line.c === 'same_as_first') {
        const first = e.lines[0];
        return first && first.filled ? first.colour : null;
      }
      return line.c;
    }

    /** What the letter strip shows for this Line right now. */
    function shownColour(e, line) {
      if (line.shownAs && e.listens <= 0) return line.shownAs;
      return wantedColour(e, line) || 'any';
    }

    function revealLine(e, n) {
      let count = 0;
      for (const line of e.lines) {
        if (count >= n) break;
        if (!line.revealed) {
          line.revealed = true;
          ev({ t: 'lineReveal', enemy: e.idx, line: e.lines.indexOf(line), colour: shownColour(e, line) });
          count++;
        }
      }
      rememberLines(e);
      return count;
    }

    function rememberLines(e) {
      if (!G.State || !G.State.album) return;
      const a = G.State.album[e.id] = G.State.album[e.id] || { linesKnown: [], delivered: 0, hushed: 0, letter: false };
      for (let i = 0; i < e.lines.length; i++) if (e.lines[i].revealed) a.linesKnown[i] = true;
    }

    function shakeLoose(e) {
      let best = -1;
      for (let i = 0; i < e.lines.length; i++) {
        const l = e.lines[i];
        if (l.filled && !l.star && (best < 0 || l.fillSeq > e.lines[best].fillSeq)) best = i;
      }
      if (best < 0) return false;
      e.lines[best].filled = false;
      e.lines[best].colour = null;
      ev({ t: 'shake', enemy: e.idx, line: best });
      return true;
    }

    function allFilled(e) {
      const rules = e.data.lineRules || {};
      if (rules.deliverByListens) return e.listens >= rules.deliverByListens;
      if (!e.lines.length) return false;
      return e.lines.every(function (l) { return l.filled; });
    }

    function fillLine(e, index, colour, o) {
      o = o || {};
      const line = e.lines[index];
      if (!line || line.filled) return false;
      line.filled = true;
      line.colour = colour;
      line.revealed = true;
      line.fillSeq = b.seq++;
      ev({ t: 'lineFill', enemy: e.idx, line: index, colour: colour, star: line.star });
      rememberLines(e);
      checkPhase(e);
      if (allFilled(e)) resolveEnemy(e, 'delivered', o.by);
      return true;
    }

    function resolveEnemy(e, how, byIdx) {
      if (e.resolved) return;
      e.resolved = how;
      e.finisher = byIdx == null ? null : byIdx;
      if (how === 'delivered') { b.delivered++; ev({ t: 'delivered', enemy: e.idx, letter: e.data.letter || null }); }
      else { b.hushed++; ev({ t: 'hushed', enemy: e.idx }); }
      // the enemy leaves the queue
      b.queue = b.queue.filter(function (q) { return q.c !== e; });
    }

    /* ---------------------------------------------------------------- enemy damage */

    function hurtEnemy(e, res, o) {
      o = o || {};
      if (e.resolved) return 0;
      if (e.invulnerable) { ev({ t: 'damage', side: 'enemy', who: e.idx, amount: 0, blocked: e.data.noDamage || "It can't be hurt." }); return 0; }
      e.seenBreath = true;
      if (res.miss) { ev({ t: 'damage', side: 'enemy', who: e.idx, amount: 0, miss: true }); return 0; }
      e.hp = Math.max(b.rules.noHush ? 1 : 0, e.hp - res.amount);
      e.lastHit = { power: o.power || 1, by: o.by == null ? null : o.by };
      ev({ t: 'damage', side: 'enemy', who: e.idx, amount: res.amount, crit: res.crit });
      if (!o.noShake) shakeLoose(e);
      checkPhase(e);
      if (e.hp <= 0) {
        resolveEnemy(e, 'hushed', o.by);
        if (o.by != null && b.party[o.by]) {
          const m = b.party[o.by];
          if (G.Party.addPebble(m.actor)) {
            const slot = m.pocket.indexOf(null);
            if (slot >= 0) m.pocket[slot] = { pebble: true, story: false };
            else { const raw = oldestRawSlot(m); if (raw >= 0) m.pocket[raw] = { pebble: true, story: false }; }
            afterPocket(m);
            ev({ t: 'pebble', who: m.idx });
          }
        }
      }
      return res.amount;
    }

    function checkPhase(e) {
      const phases = e.data.phases;
      if (!phases || e.phase >= phases.length - 1) return;
      const next = phases[e.phase + 1];
      const filled = e.lines.filter(function (l) { return l.filled; }).length;
      if ((next.at != null && e.hp <= e.mhp * next.at) || (next.linesFilled != null && filled >= next.linesFilled)) {
        e.phase++;
        ev({ t: 'phase', enemy: e.idx, phase: e.phase, line: next.line || null });
        if (next.line) ev({ t: 'mutter', enemy: e.idx, text: next.line });
      }
    }

    /* ---------------------------------------------------------------- turn order */

    function effSpd(c) {
      return statOf(c, 'spd');
    }

    function startRound() {
      b.round++;
      b.canLine.used = false;
      if (b.canLine.jamRound === b.round) b.canLine.jammed = true;
      else b.canLine.jammed = false;
      ev({ t: 'round', round: b.round });
      for (const m of b.party) {
        m.gainedBlue = false;
        m.gainedRed = false;
        m.confidedFree = false;
      }
      for (const e of b.enemies) {
        e.targetedThisRound = false;
        e.actionsLeft = e.data.actions == null ? 1 : e.data.actions;
        if (e.data.ai === 'overdue_notice' && b.round > 1 && !e.wasTargeted) { e.bonusAtk = Math.min(9, e.bonusAtk + 3); }
        e.wasTargeted = false;
      }
      roundStartRules();
      if (b.done) return;
      // mutterings cycle once a round as Line clues (9.3)
      for (const e of liveEnemies()) {
        const muts = e.data.mutters || [];
        if (muts.length) {
          ev({ t: 'mutter', enemy: e.idx, text: muts[e.mutterIndex % muts.length] });
          e.mutterIndex++;
        }
      }
      for (const h of b.hints) {
        if (h.round === b.round && !h.shown && !h.after) { h.shown = true; ev({ t: 'hint', text: h.text }); }
      }
      buildQueue();
    }

    function roundStartRules() {
      // line growth / reshuffle / reroll (6.11)
      for (const e of liveEnemies()) {
        const r = e.data.lineRules || {};
        if (r.grow) {
          for (const g of r.grow) {
            if (b.round >= g.round && !e.lines.some(function (l) { return l.grownFrom === g.round; })) {
              const line = Object.assign({ revealed: false, filled: false, colour: null }, g.line);
              line.star = !!g.line.star;
              line.grownFrom = g.round;
              e.lines.push(line);
              ev({ t: 'lineGrow', enemy: e.idx, line: e.lines.length - 1 });
            }
          }
        }
        if (r.reshuffleUntilListens && e.listens < r.reshuffleUntilListens && b.round > 1) reshuffleLines(e, false);
        if (r.rerollUntilListens && e.listens < r.rerollUntilListens && b.round > 1) reshuffleLines(e, true);
        if (r.ring) {
          // The Other Can: it rings, Wren takes Worry, everyone loses Breath by holding on (6.12)
          const clock = ['9:00', '9:05', '9:10', '9:15', '9:20', '9:25', '9:30', '9:35', '9:40', '9:45', '9:50', '9:55', '10:00'];
          ev({ t: 'clock', text: clock[Math.min(clock.length - 1, b.round - 1)] });
          ev({ t: 'mutter', enemy: e.idx, text: 'Wren? Are you awake? Over.' });
          const wren = b.party.find(function (m) { return m.id === 'wren'; });
          if (wren && wren.hp > 0) {
            if (wren.states.holding) { removeState(wren, 'holding'); }
            else for (let i = 0; i < (r.ring.blue || 2); i++) gainGlass(wren, 'blue', { reason: 'the can rings' });
          }
          for (const m of b.party) {
            if (m.hp <= 0) continue;
            const d = Math.max(1, Math.round(m.mhp * (r.ring.drainPct || 6) / 100));
            m.hp = Math.max(1, m.hp - d);
            ev({ t: 'damage', side: 'party', who: m.idx, amount: d, source: 'holding on' });
          }
        }
      }
      if (b.rules.roundLimit && b.round > b.rules.roundLimit) {
        b.round = b.rules.roundLimit;
        finish('timeout');
      }
    }

    function reshuffleLines(e, reroll) {
      const unfilled = e.lines.filter(function (l) { return !l.filled; });
      if (!unfilled.length) return;
      if (reroll) {
        for (const l of unfilled) {
          l.c = pick(COLOURS);
          l.star = chance(0.3);
          l.revealed = false;
        }
      } else {
        const cols = U.shuffle(unfilled.map(function (l) { return l.c; }));
        unfilled.forEach(function (l, i) { l.c = cols[i]; l.revealed = false; });
      }
      ev({ t: 'lineShuffle', enemy: e.idx, reroll: !!reroll });
    }

    function buildQueue() {
      const quick = [], normal = [], last = [], extra = [];
      for (const m of b.party) {
        if (m.hp <= 0) continue;
        const entry = { c: m, spd: effSpd(m) };
        if (m.quick) { quick.push(entry); m.quick = false; }
        else if (m.brimState === 'fretting') last.push(entry);
        else normal.push(entry);
      }
      for (const e of liveEnemies()) {
        const n = e.data.actions == null ? 1 : e.data.actions;
        if (n <= 0) continue;
        normal.push({ c: e, spd: effSpd(e) });
        for (let i = 1; i < n; i++) extra.push({ c: e, spd: -1 });
      }
      const cmp = function (x, y) {
        if (y.spd !== x.spd) return y.spd - x.spd;
        const px = x.c.side === 'party' ? 0 : 1, py = y.c.side === 'party' ? 0 : 1;
        if (px !== py) return px - py;
        return rnd() - 0.5;
      };
      normal.sort(cmp);
      quick.sort(cmp);
      b.queue = quick.concat(normal, last, extra);
    }

    /* ---------------------------------------------------------------- turns */

    function beginPartyTurn(m) {
      // returns true when the turn was consumed automatically
      if (m.states.bracing) removeState(m, 'bracing');
      if (m.covering != null) {
        const ally = b.party[m.covering];
        if (ally) removeState(ally, 'covered');
        m.covering = null;
      }
      ev({ t: 'turn', who: m.idx, side: 'party', name: m.name });
      gainGlass(m, m.home, { reason: 'turn start' });
      if (m.hp <= 0) return true;
      if (m.spill) {
        doSpill(m);
        return true;
      }
      if (m.states.soothed) {
        const s = m.states.soothed;
        s.count = (s.count || 1) - 1;
        if (s.count <= 0) removeState(m, 'soothed');
        msg(m.name + ' lets it go by.');
        return true;
      }
      if (m.brimState === 'daydreaming' && chance(0.25)) {
        msg('…oh, a limpet.');
        return true;
      }
      for (const k of Object.keys(m.cooldowns)) if (m.cooldowns[k] > 0) m.cooldowns[k]--;
      return false;
    }

    function doSpill(m) {
      const col = m.spill.colour;
      ev({ t: 'spill', who: m.idx, colour: col, kind: SPILL_NAME[col], start: false });
      if (col === 'red') {
        const allies = b.party.filter(function (a) { return a !== m && a.hp > 0; });
        const hitAlly = allies.length && chance(0.4);
        const target = hitAlly ? pick(allies) : pick(liveEnemies());
        if (target) {
          const res = damage(m, target, { power: 1.0, mul: 1.5 });
          if (target.side === 'enemy') hurtEnemy(target, res, { by: m.idx, power: 1.0 });
          else if (!res.miss) hurtMember(target, res.amount, { crit: res.crit, source: 'Lash Out' });
        }
      } else if (col === 'amber') {
        const live = aliveParty();
        if (live.length) {
          let lowest = live[0];
          for (const a of live) if (a.hp / a.mhp < lowest.hp / lowest.mhp) lowest = a;
          healMember(lowest, Math.round(lowest.mhp * 0.20), { byAlly: lowest !== m });
        }
      }
      const fs = b.rules.forcedSpill;
      // a scripted Spill only ends when the scene says so - as long as somebody is left to say it
      const friends = b.party.some(function (a) { return a !== m && a.hp > 0; });
      if (fs && fs.noTimeout && m.id === fs.actor && friends) return;
      m.spill.left--;
      if (m.spill.left <= 0) {
        m.spill = null;
        clearRaw(m);
        msg(m.name + ' is empty-pocketed and a bit embarrassed.');
      }
    }

    function endTurn(c) {
      tickStates(c);
      if (c.side === 'party') {
        const ol = c.states.on_the_list;
        if (ol && ol.uses <= 0) removeState(c, 'on_the_list');
      }
      b.active = null;
      checkEnd();
    }

    function useListUp(m) {
      const ol = m.states.on_the_list;
      if (ol) { ol.uses = (ol.uses || 1) - 1; if (ol.uses <= 0) removeState(m, 'on_the_list'); }
    }

    /* ---------------------------------------------------------------- end conditions */

    function checkEnd() {
      if (b.done) return;
      if (!liveEnemies().length) {
        finish(b.hushed === 0 ? 'peace' : 'win');
        return;
      }
      if (!aliveParty().length) finish('lose');
    }

    function finish(outcome) {
      if (b.done) return;
      b.done = true;
      b.queue.length = 0;
      b.active = null;
      b.result = rewards(outcome);
      ev({ t: 'end', outcome: outcome, result: b.result });
    }

    function rewards(outcome) {
      const r = {
        outcome: outcome, rounds: b.round, delivered: b.delivered, hushed: b.hushed,
        exp: 0, stamps: 0, drops: [], letters: [], levels: [],
      };
      if (outcome === 'lose' || outcome === 'escape') return r;
      for (const e of b.enemies) {
        if (!e.resolved) continue;
        const d = e.data;
        r.exp += d.exp || 0;
        r.stamps += e.resolved === 'delivered' ? (d.stamps || 0) : Math.floor((d.stamps || 0) / 2);
        const album = G.State && G.State.album ? (G.State.album[e.id] = G.State.album[e.id] ||
          { linesKnown: [], delivered: 0, hushed: 0, letter: false }) : null;
        if (e.resolved === 'delivered') {
          if (album) { album.delivered++; }
          if (d.letter && album && !album.letter) { album.letter = true; r.letters.push({ id: e.id, name: d.name, letter: d.letter }); }
          else if (d.letter) r.letters.push({ id: e.id, name: d.name, letter: d.letter });
          if (d.drop) {
            const first = !d.drop.once || !(album && album.dropped);
            if (first && chance(d.drop.chance)) {
              r.drops.push(d.drop.item);
              if (album) album.dropped = true;
            }
          }
        } else if (album) album.hushed++;
      }
      return r;
    }

    /* ================================================================ enemy turns */

    function enemyTurn(e) {
      if (e.resolved) return;
      ev({ t: 'turn', who: e.idx, side: 'enemy', name: e.name });
      if (e.states.soothed) {
        const s = e.states.soothed;
        s.count = (s.count || 1) - 1;
        if (s.count <= 0) removeState(e, 'soothed');
        ev({ t: 'enemyMove', enemy: e.idx, name: 'Soothed', text: e.name + ' has nothing to add.' });
        return;
      }
      if (e.blurt && e.blurt.fireRound <= b.round) {
        fireBlurt(e);
        return;
      }
      const move = G.BattleAI.decide(b, e);
      if (!move) return;
      performMove(e, move);
    }

    function fireBlurt(e) {
      const bl = e.blurt;
      e.blurt = null;
      ev({ t: 'enemyMove', enemy: e.idx, name: bl.name, text: e.name + ': ' + bl.name + '!' });
      if (bl.jamCanLine) {
        b.canLine.jamRound = b.round + 1;
        msg('The string goes slack. Nobody can reach anybody next round.');
        return;
      }
      if (bl.all) {
        for (const m of aliveParty()) {
          if (bl.power) {
            const res = damage(e, m, { power: bl.power });
            if (!res.miss) hurtMember(m, res.amount, { crit: res.crit, source: bl.name });
          }
          if (bl.state) addState(m, bl.state, bl.turns);
        }
      } else {
        const t = pickPartyTarget(e);
        if (t) {
          const tt = redirect(t);
          if (bl.power) {
            const res = damage(e, tt, { power: bl.power });
            if (!res.miss) hurtMember(tt, res.amount, { crit: res.crit, source: bl.name });
          }
          if (bl.state) addState(tt, bl.state, bl.turns);
        }
      }
    }

    /** Executes one enemy move object (see battle_ai.js for the shapes). */
    function performMove(e, move) {
      const seenKey = e.id + ':' + move.name;
      const firstSight = !b.seenMoves[seenKey];
      b.seenMoves[seenKey] = true;
      ev({ t: 'enemyMove', enemy: e.idx, name: move.name, text: move.text || null });

      if (move.telegraph) {
        e.blurt = Object.assign({ fireRound: b.round + 1 }, move.telegraph);
        ev({ t: 'blurt', enemy: e.idx, name: e.blurt.name });
      }
      if (move.selfState) addState(e, move.selfState, move.turns);
      if (move.healPct) {
        const h = Math.round(e.mhp * move.healPct / 100);
        e.hp = Math.min(e.mhp, e.hp + h);
        ev({ t: 'heal', side: 'enemy', who: e.idx, amount: h });
      }
      if (move.reshuffle) reshuffleLines(e, false);

      const targets = move.all ? aliveParty() : [];
      if (!move.all && (move.power || move.state || move.glass || move.pebble)) {
        let t = null;
        if (move.targetIdx != null && b.party[move.targetIdx] && b.party[move.targetIdx].hp > 0) t = b.party[move.targetIdx];
        if (!t) t = pickPartyTarget(e);
        if (t) targets.push(redirect(t));
      }
      for (const m of targets) {
        if (move.power) {
          const res = damage(e, m, { power: move.power });
          if (res.miss) ev({ t: 'damage', side: 'party', who: m.idx, amount: 0, miss: true });
          else hurtMember(m, res.amount, { crit: res.crit, source: move.name, glass: e.data.glass === 'red' ? 'red' : e.data.glass === 'green' ? 'green' : 'blue' });
        }
        if (m.hp <= 0) continue;
        if (move.state && (move.stateChance == null || chance(move.stateChance))) addState(m, move.state, move.turns);
        if (move.glass) for (let i = 0; i < (move.glass.n || 1); i++) gainGlass(m, move.glass.colour, { reason: e.name });
        if (move.pebble && !G.Party.hasPassive(m.actor, 'no_pebbles')) {
          if (G.Party.addPebble(m.actor)) {
            const slot = m.pocket.indexOf(null);
            const raw = slot >= 0 ? slot : oldestRawSlot(m);
            if (raw >= 0) { m.pocket[raw] = { pebble: true, story: false }; afterPocket(m); ev({ t: 'pebble', who: m.idx }); }
          }
        }
      }
      if (firstSight) {
        for (const m of aliveParty()) gainGlass(m, 'green', { reason: 'well I never' });
      }
    }

    /* ================================================================ player actions */

    function payableColours(m) {
      const out = { red: 0, blue: 0, amber: 0, green: 0, tumbled: 0 };
      for (const p of m.pocket) {
        if (!p || p.pebble) continue;
        if (p.t) out.tumbled++;
        else out[p.c]++;
      }
      return out;
    }

    function costTotal(cost) {
      let n = 0;
      for (const c of COLOURS) n += cost[c] || 0;
      return n;
    }

    /**
     * Can this skill be paid for?
     * @returns {{plain:boolean, outLoud:boolean}}
     */
    function canPay(m, skill) {
      const cost = skill.cost || {};
      const have = payableColours(m);
      if (cost.call) {
        const partner = b.party.find(function (a) { return a.id === skill.call.partner; });
        return {
          plain: false,
          outLoud: have.tumbled >= 1 && !!partner && partner.hp > 0 && !partner.spill && tumbledCount(partner) >= 1,
        };
      }
      if (cost.free) return { plain: (m.cooldowns[skill.id] || 0) <= 0, outLoud: false };
      if (cost.tumbled) return { plain: false, outLoud: have.tumbled >= cost.tumbled };
      const total = costTotal(cost);
      let missing = 0;
      for (const c of COLOURS) missing += Math.max(0, (cost[c] || 0) - have[c]);
      const plain = have.tumbled * 2 >= missing;
      return { plain: plain && missing < total + 1, outLoud: have.tumbled >= Math.ceil(total / 2) };
    }

    /**
     * Spends the glass for a skill. Plain pays raw first, Out Loud pays only with Tumbled pieces.
     * @returns {{ok:boolean, pieces:Array, outLoud:boolean}}
     */
    function payCost(m, skill, outLoud) {
      const cost = skill.cost || {};
      const taken = [];
      const spendSlot = function (i) { taken.push(m.pocket[i]); m.pocket[i] = null; };
      const findSlot = function (test) {
        let best = -1;
        for (let i = 0; i < 5; i++) {
          const p = m.pocket[i];
          if (p && !p.pebble && test(p) && (best < 0 || p.seq < m.pocket[best].seq)) best = i;
        }
        return best;
      };
      if (cost.free) {
        if ((m.cooldowns[skill.id] || 0) > 0) return { ok: false };
        if (cost.cooldown) m.cooldowns[skill.id] = cost.cooldown;
        afterPocket(m);
        return { ok: true, pieces: [], outLoud: false };
      }
      if (cost.call) {
        const partner = b.party.find(function (a) { return a.id === skill.call.partner; });
        const i = findSlot(function (p) { return p.t; });
        if (i < 0 || !partner) return { ok: false };
        spendSlot(i);
        let j = -1, bestSeq = Infinity;
        for (let k = 0; k < 5; k++) {
          const p = partner.pocket[k];
          if (p && !p.pebble && p.t && p.seq < bestSeq) { j = k; bestSeq = p.seq; }
        }
        if (j < 0) { m.pocket[i] = taken.pop(); return { ok: false }; }
        taken.push(partner.pocket[j]);
        partner.pocket[j] = null;
        afterPocket(m); afterPocket(partner);
        return { ok: true, pieces: taken, outLoud: true, partner: partner };
      }
      if (cost.tumbled) {
        for (let n = 0; n < cost.tumbled; n++) {
          const i = findSlot(function (p) { return p.t; });
          if (i < 0) { for (const p of taken) gainBack(m, p); return { ok: false }; }
          spendSlot(i);
        }
        afterPocket(m);
        return { ok: true, pieces: taken, outLoud: true };
      }
      if (outLoud) {
        const need = Math.ceil(costTotal(cost) / 2);
        for (let n = 0; n < need; n++) {
          const i = findSlot(function (p) { return p.t; });
          if (i < 0) { for (const p of taken) gainBack(m, p); return { ok: false }; }
          spendSlot(i);
        }
        afterPocket(m);
        return { ok: true, pieces: taken, outLoud: true };
      }
      // Plain: raw of the right colour first, Tumbled pieces cover any shortfall (2 units each)
      let shortfall = 0;
      for (const c of COLOURS) {
        let need = cost[c] || 0;
        while (need > 0) {
          const i = findSlot(function (p) { return !p.t && p.c === c; });
          if (i < 0) break;
          spendSlot(i);
          need--;
        }
        shortfall += need;
      }
      while (shortfall > 0) {
        const i = findSlot(function (p) { return p.t; });
        if (i < 0) { for (const p of taken) gainBack(m, p); return { ok: false }; }
        spendSlot(i);
        shortfall -= 2;
      }
      afterPocket(m);
      const allTumbled = taken.length > 0 && taken.every(function (p) { return p.t; });
      return { ok: true, pieces: taken, outLoud: allTumbled };
    }

    function gainBack(m, piece) {
      const i = m.pocket.indexOf(null);
      if (i >= 0) m.pocket[i] = piece;
    }

    /* ---------------------------------------------------------------- availability (for the UI) */

    /** Why a command is greyed out, or null when it is available. */
    function blockReason(m, cmd) {
      if (m.states.tongue_tied && (cmd === 'say' || cmd === 'listen' || cmd === 'confide')) return 'tongue-tied';
      if (m.brimState === 'short_fuse' && (cmd === 'say' || cmd === 'listen' || cmd === 'confide')) return 'too cross to talk';
      if (m.brimState === 'fretting' && cmd === 'strike') return 'too worried to swing';
      if (cmd === 'say') {
        if (b.rules.onlySayer && m.id !== b.rules.onlySayer) return 'only ' + b.rules.onlySayer + ' can say it';
        if (!m.pocket.some(function (p) { return p && !p.pebble; })) return 'no glass to offer';
      }
      if (cmd === 'confide') {
        if (b.canLine.jammed) return 'the string is jammed';
        if (b.canLine.used && !(G.Party.hasPassive(m.actor, 'free_first_confide') && !m.confidedFree)) return 'the line is used this round';
        if (!m.pocket.some(function (p) { return p && !p.pebble && !p.t; })) return 'nothing raw to pass on';
        if (!b.party.some(function (a) { return a !== m && a.hp > 0 && canReceive(a); })) return 'nobody has room';
      }
      if (cmd === 'strike' && b.rules.strikeBlocked) return b.rules.strikeBlocked;
      if (cmd === 'strike' && b.enemies.every(function (e) { return e.resolved || e.invulnerable; })) return "it's only a can";
      if (cmd === 'escape' && !b.canEscape) return 'there is nowhere to go';
      return null;
    }

    function canReceive(a) {
      if (a.pocket.indexOf(null) >= 0) return true;
      return oldestRawSlot(a) >= 0;
    }

    /** Command list for the luggage-tag fan, with enabled state and a one-line reason. */
    function commands(m) {
      const list = [];
      const add = function (id, label) { list.push({ id: id, label: label, reason: blockReason(m, id), enabled: !blockReason(m, id) }); };
      add('strike', 'Strike');
      add('skill', 'Skill');
      add('say', 'Say');
      add('listen', 'Listen');
      add('brace', 'Brace');
      add('item', 'Item');
      return list;
    }

    /** Skill rows for the skill list: {id, name, cost, plain, outLoud, enabled, reason}. */
    function skillRows(m) {
      const rows = [];
      for (const id of m.skills) {
        const s = G.DATA.skills[id];
        if (!s) continue;
        const pay = canPay(m, s);
        let reason = null;
        if (!pay.plain && !pay.outLoud) reason = s.cost.free ? 'not yet' : 'not enough glass';
        if (s.type === 'say' && blockReason(m, 'say')) reason = blockReason(m, 'say');
        if (s.call) {
          const partner = b.party.find(function (a) { return a.id === s.call.partner; });
          if (!partner || partner.hp <= 0) reason = s.call.partner + ' is not up to it';
          else if (partner.spill) reason = s.call.partner + ' is not listening';
          else if (!pay.outLoud) reason = 'both of you need something Tumbled';
        }
        rows.push({
          id: id, name: s.name, skill: s, cost: s.cost, plain: pay.plain, outLoud: pay.outLoud,
          enabled: !reason, reason: reason,
        });
      }
      if (b.rules.onlySayer && m.id !== b.rules.onlySayer) {
        const hs = G.DATA.skills.hold_the_string;
        rows.push({ id: 'hold_the_string', name: hs.name, skill: hs, cost: hs.cost, plain: true, outLoud: false, enabled: true, reason: null });
      }
      return rows;
    }

    /* ---------------------------------------------------------------- the actions */

    function doStrike(m, enemyIdx) {
      const e = b.enemies[enemyIdx];
      if (!e || e.resolved) return false;
      ev({ t: 'strike', who: m.idx, enemy: e.idx });
      e.wasTargeted = true;
      e.struck = true;
      const res = damage(m, e, { power: 1.0 });
      hurtEnemy(e, res, { by: m.idx, power: 1.0 });
      useListUp(m);
      return true;
    }

    function doListen(m, enemyIdx) {
      const e = b.enemies[enemyIdx];
      if (!e || e.resolved) return false;
      let n = m.passive === 'nosy' ? 2 : 1;
      if (G.Party.hasPassive(m.actor, 'listen_plus')) n++;
      e.listens++;
      e.seenBreath = true;
      e.listenedThisRound = true;
      e.wasTargeted = true;
      if (e.data.ai === 'overdue_notice') e.bonusAtk = 0;
      const revealed = revealLine(e, n);
      ev({ t: 'listen', who: m.idx, enemy: e.idx, revealed: revealed });
      if (e.blurt) { ev({ t: 'blurtCancel', enemy: e.idx, name: e.blurt.name }); e.blurt = null; }
      gainGlass(m, 'green', { reason: 'listening' });
      if (allFilled(e)) resolveEnemy(e, 'delivered', m.idx);
      useListUp(m);
      return true;
    }

    function doBrace(m, allyIdx) {
      const ally = b.party[allyIdx == null ? m.idx : allyIdx];
      addState(m, 'bracing', 1);
      if (ally && ally !== m && ally.hp > 0) {
        addState(ally, 'covered', 1);
        ally.states.covered.by = m.idx;
        m.covering = ally.idx;
        gainGlass(ally, 'amber', { reason: 'covered' });
      }
      ev({ t: 'brace', who: m.idx, ally: ally ? ally.idx : null });
      useListUp(m);
      return true;
    }

    /**
     * Say: offer one piece from the Pocket to one Line (6.6).
     * @returns {boolean}
     */
    function doSay(m, slot, enemyIdx, lineIdx) {
      const e = b.enemies[enemyIdx];
      const piece = m.pocket[slot];
      if (!e || e.resolved || !piece || piece.pebble) return false;
      const line = e.lines[lineIdx];
      if (!line || line.filled) return false;
      e.wasTargeted = true;
      const want = wantedColour(e, line);
      let ok = true;
      if (line.star && !piece.t) ok = false;
      if (line.from && piece.from !== line.from) ok = false;
      if (line.sayer && line.sayer !== m.id) ok = false;
      if (want && want !== 'any' && want !== piece.c) ok = false;
      if (line.c === 'same_as_first' && want == null) ok = false;
      if (line.last && e.lines.some(function (l, i) { return i !== lineIdx && !l.filled; })) ok = false;
      takePiece(m, slot);
      ev({ t: 'say', who: m.idx, enemy: e.idx, line: lineIdx, piece: piece, ok: ok });
      if (ok) {
        fillLine(e, lineIdx, piece.c, { by: m.idx });
        if (piece.t && !e.resolved) addState(e, 'soothed', 1);
      } else {
        ev({ t: 'misheard', enemy: e.idx });
        addState(e, 'riled', 2);
      }
      useListUp(m);
      return true;
    }

    function doItem(m, itemId, targetIdx) {
      const it = G.DATA.items[itemId];
      if (!it || !it.useInBattle) return false;
      if (G.State.itemCount(itemId) <= 0) return false;
      const t = targetIdx == null ? m : b.party[targetIdx];
      if (it.target === 'other_ally' && t === m) return false;
      G.State.removeItem(itemId, 1);
      ev({ t: 'item', who: m.idx, id: itemId, target: t ? t.idx : null, name: it.name });
      const targets = it.target === 'party' ? aliveParty() : [t];
      for (const a of targets) {
        if (!a) continue;
        for (const e of it.effects || []) applyEffect(m, a, e, { effectMul: 1 });
      }
      useListUp(m);
      return true;
    }

    /* ---------------------------------------------------------------- Confide (6.4) */

    function doConfide(m, slot, toIdx) {
      const reason = blockReason(m, 'confide');
      if (reason) return { ok: false, reason: reason };
      const to = b.party[toIdx];
      const piece = m.pocket[slot];
      if (!to || to === m || to.hp <= 0) return { ok: false, reason: 'nobody there' };
      if (!piece || piece.pebble || piece.t) return { ok: false, reason: 'that one cannot go' };
      if (!canReceive(to)) return { ok: false, reason: to.name + ' has no room' };
      takePiece(m, slot);
      const line = confessionFor(m.id, to.id);
      const given = gainGlass(to, piece.c, { tumbled: true, from: m.id, reason: 'confided' });
      ev({ t: 'confide', from: m.idx, to: to.idx, piece: given || piece, line: line });
      const fs = b.rules.forcedSpill;
      if (to.spill && fs && fs.thawAfter && to.id === fs.actor) {
        // the scripted Freeze Up: it takes every friend's voice down the line before she can move
        to.thawCount = (to.thawCount || 0) + 1;
        if (to.thawCount < fs.thawAfter) {
          msg(to.name + ' heard that.' + (fs.thawAfter - to.thawCount === 1 ? ' One more.' : ''));
          b.canLine.used = true;
          return { ok: true, line: line };
        }
        if (fs.skimPebbles) {
          for (let i = 0; i < 5; i++) {
            const pb = to.pocket[i];
            if (pb && pb.pebble) { ev({ t: 'glassOut', who: to.idx, slot: i, piece: pb }); to.pocket[i] = null; }
          }
        }
        clearRaw(to);
        to.spill = null;
        afterPocket(to);
        ev({ t: 'spillEnd', who: to.idx });
        msg(to.name + ' can move again. The Pocket is empty, and so are the pebbles.');
        b.canLine.used = true;
        return { ok: true, line: line };
      }
      if (to.spill) {
        to.spill = null;
        const raw = oldestRawSlot(to);
        if (raw >= 0) { ev({ t: 'glassOut', who: to.idx, slot: raw, piece: to.pocket[raw] }); to.pocket[raw] = null; }
        afterPocket(to);
        ev({ t: 'spillEnd', who: to.idx });
      }
      if (G.Party.hasPassive(m.actor, 'free_first_confide') && !m.confidedFree) m.confidedFree = true;
      else b.canLine.used = true;
      return { ok: true, line: line };
    }

    function confessionFor(from, to) {
      const scripted = b.rules.confessions && b.rules.confessions[from + '>' + to];
      if (scripted) return scripted;
      const pool = G.DATA.confessions && G.DATA.confessions[from] && G.DATA.confessions[from][to];
      if (pool && pool.length) return pick(pool);
      return null;
    }

    /* ---------------------------------------------------------------- skills */

    function resolveTargets(m, skill, cmd) {
      switch (skill.target) {
        case 'enemy': {
          const e = b.enemies[cmd.enemy != null ? cmd.enemy : 0];
          return e && !e.resolved ? [e] : liveEnemies().slice(0, 1);
        }
        case 'all_enemies': return liveEnemies();
        case 'ally': return [b.party[cmd.ally != null ? cmd.ally : m.idx] || m];
        case 'other_ally': {
          const a = b.party[cmd.ally];
          return a && a !== m ? [a] : [];
        }
        case 'party': return aliveParty();
        case 'two_allies': return [b.party[cmd.from], b.party[cmd.to]].filter(Boolean);
        case 'self':
        default: return [m];
      }
    }

    function applyEffect(user, target, e, ctx) {
      const mulE = (ctx.outLoud ? 1.5 : 1) * (ctx.effectMul || 1);
      switch (e.kind) {
        case 'damage': {
          if (target.side !== 'enemy' || target.resolved) return;
          target.wasTargeted = true;
          const res = damage(user, target, {
            power: e.power * (ctx.outLoud ? 1.5 : 1) * (ctx.effectMul || 1),
            crit: e.crit, cannotMiss: ctx.outLoud, ignoreHalfDef: ctx.outLoud,
            atk: e.useHigherAtk ? Math.max(statOf(user, 'atk'), partnerAtk(e.useHigherAtk)) : undefined,
          });
          hurtEnemy(target, res, { by: user.idx, power: e.power, noShake: e.noShake });
          break;
        }
        case 'heal': {
          if (target.side !== 'party') return;
          let pct = (e.pct || 0) * mulE;
          if (user.brimState === 'doting') pct *= 1.3;
          const amount = e.amount != null ? Math.round(e.amount * mulE) : Math.round(target.mhp * pct / 100);
          healMember(target, amount, { byAlly: target !== user });
          if (ctx.outLoud) {
            for (const id of Object.keys(target.states)) if (STATES[id] && STATES[id].bad && id !== 'winded') { removeState(target, id); break; }
          }
          break;
        }
        case 'revive': {
          if (target.side !== 'party' || target.hp > 0) return;
          healMember(target, Math.round(target.mhp * (e.pct || 50) / 100), { revive: true });
          break;
        }
        case 'state': {
          if (e.chance != null && !chance(e.chance * (ctx.outLoud ? 1.25 : 1))) return;
          const who = e.on === 'user' ? user : target;
          const def = STATES[e.id];
          const turns = (e.turns || (def ? def.turns : 1)) + (ctx.outLoud && (ctx.type === 'buff' || ctx.type === 'debuff') ? 1 : 0);
          addState(who, e.id, turns);
          break;
        }
        case 'removeState': {
          const who = e.on === 'user' ? user : target;
          for (const id of e.ids || []) removeState(who, id);
          break;
        }
        case 'removeBuffs': {
          const who = e.on === 'user' ? user : target;
          for (const id of Object.keys(who.states)) if (STATES[id] && STATES[id].selfBuff) removeState(who, id);
          break;
        }
        case 'glass': {
          const who = e.on === 'user' ? user : target;
          if (who.side !== 'party') return;
          const colour = e.colour === 'choose' ? (ctx.colour || who.home) : e.colour;
          for (let i = 0; i < (e.n || 1); i++) gainGlass(who, colour, { tumbled: !!e.tumbled, reason: ctx.name });
          break;
        }
        case 'removePebbles': {
          const who = e.on === 'user' ? user : target;
          if (who.side !== 'party') return;
          who.actor.pebbles = 0;
          let removed = 0;
          for (let i = 0; i < 5; i++) {
            const p = who.pocket[i];
            if (p && p.pebble && !p.story) { who.pocket[i] = null; removed++; }
          }
          if (removed) { afterPocket(who); ev({ t: 'pebbleGone', who: who.idx, n: removed }); }
          break;
        }
        case 'reveal': {
          if (target.side !== 'enemy') return;
          revealLine(target, e.count === 'all' ? target.lines.length : (e.count || 1));
          break;
        }
        case 'fillLine': {
          if (target.side !== 'enemy' || target.resolved) return;
          let left = Math.round(e.count || 1);
          for (let i = 0; i < target.lines.length && left > 0; i++) {
            const l = target.lines[i];
            if (l.filled) continue;
            if (e.revealedOnly && !l.revealed) continue;
            if (!e.star && l.star) continue;
            if (l.from || l.sayer) continue;
            const want = wantedColour(target, l);
            const colour = e.any ? (want && want !== 'any' ? want : user.home) : ctx.colour;
            if (!e.any && want && want !== 'any' && want !== colour) continue;
            fillLine(target, i, colour || 'amber', { by: user.idx });
            left--;
          }
          break;
        }
        case 'cancelBlurt': {
          if (target.side === 'enemy' && target.blurt) {
            ev({ t: 'blurtCancel', enemy: target.idx, name: target.blurt.name });
            target.blurt = null;
          }
          break;
        }
        case 'special':
          special(e.name, user, target, ctx);
          break;
        default:
          break;
      }
    }

    function partnerAtk(id) {
      const p = b.party.find(function (a) { return a.id === id; });
      return p ? statOf(p, 'atk') : 0;
    }

    /** The genuine one-offs (see the DSL header of skills.js). */
    function special(name, user, target, ctx) {
      switch (name) {
        case 'oi': {
          addState(user, 'taunting', 2);
          break;
        }
        case 'hold_the_string': {
          addState(user, 'holding', 1);
          const wren = b.party.find(function (a) { return a.id === 'wren'; });
          if (wren) addState(wren, 'holding', 1);
          break;
        }
        case 'i_need_help': {
          for (const a of b.party) {
            if (a === user || a.hp <= 0) continue;
            const slot = oldestRawSlot(a);
            if (slot < 0) continue;
            const p = a.pocket[slot];
            takePiece(a, slot);
            const given = gainGlass(user, p.c, { tumbled: true, from: a.id, reason: 'i need help' });
            ev({ t: 'confide', from: a.idx, to: user.idx, piece: given || p, line: confessionFor(a.id, user.id) });
          }
          if (user.spill) { user.spill = null; ev({ t: 'spillEnd', who: user.idx }); }
          healMember(user, Math.round(user.mhp * 0.5), { byAlly: true });
          break;
        }
        case 'forward_mail': {
          const from = b.party[ctx.cmd.from], to = b.party[ctx.cmd.to];
          if (!from || !to || from === to) break;
          const slot = ctx.cmd.slot != null && from.pocket[ctx.cmd.slot] && !from.pocket[ctx.cmd.slot].pebble && !from.pocket[ctx.cmd.slot].t
            ? ctx.cmd.slot : oldestRawSlot(from);
          if (slot < 0 || !canReceive(to)) break;
          const p = from.pocket[slot];
          takePiece(from, slot);
          const given = gainGlass(to, p.c, { tumbled: true, from: p.from || from.id, reason: 'forwarded' });
          ev({ t: 'confide', from: from.idx, to: to.idx, piece: given || p, line: confessionFor(from.id, to.id), forwarded: true });
          if (to.spill) { to.spill = null; ev({ t: 'spillEnd', who: to.idx }); }
          break;
        }
        case 'special_delivery': {
          if (target.side !== 'enemy' || target.resolved) break;
          const piece = ctx.pieces && ctx.pieces[0];
          if (!piece) break;
          let filled = 0;
          for (let i = 0; i < target.lines.length && filled < 2; i++) {
            const l = target.lines[i];
            if (l.filled) continue;
            if (l.sayer && l.sayer !== user.id) continue;
            if (l.from && l.from !== piece.from) continue;
            const want = wantedColour(target, l);
            if (want && want !== 'any' && want !== piece.c) continue;
            if (l.last && target.lines.some(function (x, j) { return j !== i && !x.filled; })) continue;
            fillLine(target, i, piece.c, { by: user.idx });
            filled++;
          }
          if (filled) addState(target, 'soothed', 1);
          else { ev({ t: 'misheard', enemy: target.idx }); addState(target, 'riled', 2); }
          break;
        }
        case 'call_over_and_out': {
          if (target.side !== 'enemy') break;
          target.wasTargeted = true;
          const res = damage(user, target, {
            power: 2.8 * 1.5, cannotMiss: true, ignoreHalfDef: true,
            atk: Math.max(statOf(user, 'atk'), partnerAtk('odo')),
          });
          hurtEnemy(target, res, { by: user.idx, power: 2.8 });
          const odo = b.party.find(function (a) { return a.id === 'odo'; });
          if (odo && odo.hp > 0) {
            addState(user, 'covered', 1);
            user.states.covered.by = odo.idx;
            odo.covering = user.idx;
            gainGlass(user, 'amber', { reason: 'covered' });
          }
          break;
        }
        case 'call_first_class': {
          if (target.side !== 'enemy') break;
          let filled = 0;
          for (let i = 0; i < target.lines.length && filled < 2; i++) {
            const l = target.lines[i];
            if (l.filled || !l.revealed || l.from) continue;
            if (l.sayer && l.sayer !== user.id) continue;
            if (l.last && target.lines.some(function (x, j) { return j !== i && !x.filled; })) continue;
            const want = wantedColour(target, l);
            fillLine(target, i, want && want !== 'any' ? want : 'amber', { by: user.idx });
            filled++;
          }
          break;
        }
        default:
          G.warn('BattleLogic: unknown special ' + name);
      }
    }

    function doSkill(m, cmd) {
      const skill = G.DATA.skills[cmd.skill];
      if (!skill) return false;
      const pay = canPay(m, skill);
      let outLoud = !!cmd.outLoud;
      if (outLoud && !pay.outLoud) outLoud = false;
      if (!outLoud && !pay.plain) { if (!pay.outLoud) return false; outLoud = true; }
      const paid = payCost(m, skill, outLoud);
      if (!paid.ok) return false;
      outLoud = paid.outLoud;
      ev({ t: 'skill', who: m.idx, id: skill.id, name: skill.name, outLoud: outLoud, type: skill.type });
      const ctx = {
        outLoud: outLoud, type: skill.type, colour: cmd.colour || null, cmd: cmd, pieces: paid.pieces,
        effectMul: m.states.on_the_list ? 1.15 : 1, name: skill.name,
      };
      if (!ctx.colour && paid.pieces && paid.pieces.length) ctx.colour = paid.pieces[0].c;
      const targets = resolveTargets(m, skill, cmd);
      for (const e of skill.effects) {
        if (e.kind === 'special' || skill.target === 'self' || skill.target === 'two_allies') {
          applyEffect(m, targets[0] || m, e, ctx);
        } else {
          for (const t of targets) applyEffect(m, t, e, ctx);
        }
      }
      if (outLoud && (skill.type === 'glass' || skill.type === 'say')) gainGlass(m, 'green', { reason: 'said out loud' });
      if (skill.priority) m.quick = true;
      useListUp(m);
      return true;
    }

    /* ================================================================ public surface */

    b.seenMoves = {};

    /** The next `n` queue entries, for the turn ribbon. */
    b.upcoming = function (n) {
      const out = [];
      if (b.active) out.push(b.active);
      for (const q of b.queue) {
        if (out.length >= n) break;
        if (q.c.side === 'enemy' && q.c.resolved) continue;
        if (q.c.side === 'party' && q.c.hp <= 0) continue;
        out.push(q.c);
      }
      return out.slice(0, n);
    };

    b.take = function () {
      const out = b.events;
      b.events = [];
      return out;
    };

    /**
     * Runs the battle forward until a party member needs a command or the battle ends.
     * @returns {{state:'input'|'end', actor?:object, result?:object}}
     */
    b.advance = function () {
      for (let guard = 0; guard < 20000; guard++) {
        if (b.done) return { state: 'end', result: b.result };
        if (b.active) return { state: 'input', actor: b.active };
        if (!b.queue.length) {
          if (b.round > 0) b.endRoundRules();
          startRound();
          if (b.done) continue;
        }
        const entry = b.queue.shift();
        if (!entry) continue;
        const c = entry.c;
        if (c.side === 'party') {
          if (c.hp <= 0) continue;
          if (beginPartyTurn(c)) { endTurn(c); continue; }
          b.active = c;
          return { state: 'input', actor: c };
        }
        if (c.resolved) continue;
        enemyTurn(c);
        endTurn(c);
      }
      G.warn('BattleLogic: advance() ran away');
      finish('lose');
      return { state: 'end', result: b.result };
    };

    /**
     * Performs the active member's action.
     * @param {{type:string}} cmd type: 'strike'|'skill'|'say'|'listen'|'brace'|'item'|'escape'
     * @returns {boolean} true when the action was accepted (the turn is over)
     */
    b.act = function (cmd) {
      const m = b.active;
      if (!m || b.done) return false;
      let ok = false;
      switch (cmd.type) {
        case 'strike': ok = !blockReason(m, 'strike') && doStrike(m, cmd.enemy); break;
        case 'skill': ok = doSkill(m, cmd); break;
        case 'say': ok = !blockReason(m, 'say') && doSay(m, cmd.slot, cmd.enemy, cmd.line); break;
        case 'listen': ok = !blockReason(m, 'listen') && doListen(m, cmd.enemy); break;
        case 'brace': ok = doBrace(m, cmd.ally); break;
        case 'item': ok = doItem(m, cmd.item, cmd.target); break;
        case 'escape': {
          if (!b.canEscape) { ev({ t: 'escape', ok: false }); return false; }
          ev({ t: 'escape', ok: true });
          finish('escape');
          return true;
        }
        default: ok = false;
      }
      if (!ok) return false;
      for (const h of b.hints) {
        if (!h.shown && h.after === 'command' && h.round === b.round) { h.shown = true; ev({ t: 'hint', text: h.text }); }
      }
      endTurn(m);
      return true;
    };

    /** The free pre-action. Does not end the turn. */
    b.confide = function (cmd) {
      const m = b.active;
      if (!m || b.done) return { ok: false, reason: 'not now' };
      return doConfide(m, cmd.slot, cmd.to);
    };

    /** Nacre's phase-2 re-coat and other end-of-round rules. Called by the scene between rounds. */
    b.endRoundRules = function () {
      for (const e of liveEnemies()) {
        const r = e.data.lineRules || {};
        if (r.recoatUnlessListened && e.phase >= 1) {
          if (e.listenedThisRound) { e.listenedThisRound = false; continue; }
          const ph = e.data.phases && e.data.phases[e.phase];
          if (ph && ph.regen) { e.hp = Math.min(e.mhp, e.hp + ph.regen); ev({ t: 'heal', side: 'enemy', who: e.idx, amount: ph.regen }); }
          if (shakeLoose(e)) msg(e.name + ' coats it over again.');
        }
      }
    };

    b.commands = commands;
    b.skillRows = skillRows;
    b.blockReason = blockReason;
    b.canPay = canPay;
    b.brimming = brimming;
    b.rawCount = rawCount;
    b.tumbledCount = tumbledCount;
    b.canReceive = canReceive;
    b.shownColour = shownColour;
    b.wantedColour = wantedColour;
    b.liveEnemies = liveEnemies;
    b.aliveParty = aliveParty;
    b.gainGlass = gainGlass;
    b.finish = finish;
    b.debugWin = function () {
      for (const e of liveEnemies()) resolveEnemy(e, 'hushed', 0);
      checkEnd();
    };
    b.debugDeliver = function () {
      for (const e of liveEnemies()) resolveEnemy(e, 'delivered', 0);
      checkEnd();
    };

    /* ---------------------------------------------------------------- opening */

    (function opening() {
      // keepsake gifts and "said things pay later" (6.4)
      for (const m of b.party) {
        if (G.Party.hasPassive(m.actor, 'start_tumbled_amber')) {
          gainGlass(m, 'amber', { tumbled: true, from: 'token', reason: 'keepsake' });
        }
      }
      // a scripted flood (troop rules.forcedSpill): that member starts already half full of one colour,
      // so the Spill the scene is written around is going to happen
      if (rules.forcedSpill) {
        const fm = b.party.find(function (a) { return a.id === rules.forcedSpill.actor; });
        const n = rules.forcedSpill.count || 2;      // 5 = the whole Pocket: the Spill starts at once
        if (fm) for (let i = 0; i < n; i++) gainGlass(fm, rules.forcedSpill.colour, { reason: 'it keeps ringing' });
      }
      const words = G.State ? G.State.getVar('true_words') : 0;
      const gifts = Math.min(3, Math.floor(words / 3));
      const order = [['wren', 'amber'], ['odo', 'blue'], ['lin', 'green']];
      for (let i = 0; i < gifts; i++) {
        const m = b.party.find(function (a) { return a.id === order[i][0]; });
        if (m) gainGlass(m, order[i][1], { tumbled: true, from: 'said', reason: 'something you said' });
      }
      for (const e of b.enemies) rememberLines(e);
      ev({ t: 'begin', troop: b.troopId, enemies: b.enemies.length });
      for (const h of b.hints) if (h.round === 0 && !h.shown) { h.shown = true; ev({ t: 'hint', text: h.text }); }
    })();

    return b;
  }

  G.BattleLogic = {
    COLOURS: COLOURS,
    STATES: STATES,
    BRIM_NAME: BRIM_NAME,
    SPILL_NAME: SPILL_NAME,
    COLOUR_NAME: COLOUR_NAME,
    HOME_STATE: HOME_STATE,
    create: create,
    enemyDef: enemyDef,
  };
})();
