/*
 * state.js - G.State (party, inventory, flags, save/load, options) and G.Cond (condition mini-language).
 * Node-safe: no DOM access at load time; storage falls back to memory when localStorage is unavailable.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  const U = G.Util;

  const SAVE_VERSION = 1;
  const SAVE_PREFIX = 'fable51.save.';
  const OPTIONS_KEY = 'fable51.options';
  const SLOTS = [1, 2, 3];
  const DEFAULT_OPTIONS = { bgmVol: 0.7, sfxVol: 0.8, textSpeed: 1, paper: true };

  /* ------------------------------------------------------------------ storage */

  const memory = {};
  function storage() {
    try {
      if (root.localStorage) return root.localStorage;
    } catch (e) { /* blocked (privacy mode / some file:// setups) */ }
    return null;
  }
  function readKey(key) {
    const ls = storage();
    try { if (ls) return ls.getItem(key); } catch (e) { /* fall through */ }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }
  function writeKey(key, value) {
    const ls = storage();
    try { if (ls) { ls.setItem(key, value); return true; } } catch (e) { G.warn('Storage write failed, keeping data in memory only'); }
    memory[key] = value;
    return !ls;
  }
  function removeKey(key) {
    const ls = storage();
    try { if (ls) ls.removeItem(key); } catch (e) { /* ignore */ }
    delete memory[key];
  }

  /* ------------------------------------------------------------------ actors */

  function firstNumber() {
    for (let i = 0; i < arguments.length; i++) if (typeof arguments[i] === 'number' && isFinite(arguments[i])) return arguments[i];
    return null;
  }

  /**
   * Creates a generic actor instance from G.DATA.actors[id]. The core knows nothing about battle rules:
   * it copies id/name/level/skills/equips and takes starting hp/mp from whichever of these the data has:
   * def.hp|mhp|maxHp, def.stats.hp|mhp, def.base.hp|mhp (same for mp). Battle code may then refine the
   * instance through the optional hook `G.State.hooks.createActor(actor, def)`.
   */
  function createActor(id) {
    const def = (G.DATA.actors && G.DATA.actors[id]) || null;
    if (!def) G.warn('State: unknown actor ' + id);
    const d = def || {};
    const stats = d.stats || {}, base = d.base || {};
    const level = firstNumber(d.level, d.startLevel, d.initialLevel) || 1;
    const skills = [];
    const src = Array.isArray(d.skills) ? d.skills : Array.isArray(d.startSkills) ? d.startSkills : [];
    for (const s of src) {
      // plain ids are known from the start; {id|skill, level} entries only once the level is reached
      if (typeof s === 'string') skills.push(s);
      else if (s && typeof s === 'object') {
        const sid = s.id || s.skill;
        if (sid && (firstNumber(s.level, s.lv) || 1) <= level) skills.push(sid);
      }
    }
    const actor = {
      id: id,
      name: d.name || id,
      level: level,
      exp: firstNumber(d.exp) || 0,
      hp: firstNumber(d.hp, d.mhp, d.maxHp, stats.hp, stats.mhp, base.hp, base.mhp) || 1,
      mp: firstNumber(d.mp, d.mmp, d.maxMp, stats.mp, stats.mmp, base.mp, base.mmp) || 0,
      equips: U.deepClone(d.equips || d.equip || {}),
      skills: skills,
    };
    if (State.hooks.createActor) {
      try { State.hooks.createActor(actor, def); } catch (e) { G.error(e); }
    }
    return actor;
  }

  /* ------------------------------------------------------------------ state */

  const State = G.State = {
    SAVE_VERSION: SAVE_VERSION,
    SLOTS: SLOTS,

    /** True after newGame() or a successful load(); the main loop counts playtime only while active. */
    active: false,
    /**
     * Bumped by every change to flags, variables, items, money or party membership. The map scene
     * watches it to re-evaluate event pages (TECH_SPEC 4.2) without polling the whole state.
     */
    rev: 0,
    party: [],
    reserve: [],
    inventory: {},
    money: 0,
    flags: {},
    vars: {},
    /** Delivered Mail album: { [enemyId]: {linesKnown:[bool], delivered:n, hushed:n, letter:bool} }. */
    album: {},
    map: { id: null, x: 0, y: 0, dir: 'down' },
    playtimeFrames: 0,
    /** Protagonist name used by the {name} text tag (null = party leader's name). */
    playerName: null,
    options: Object.assign({}, DEFAULT_OPTIONS),

    /**
     * Optional integration hooks, all null by default. Battle code may install:
     *   createActor(actor, def)   finish a freshly created actor instance (compute hp/mp from level...)
     *   setLevel(actor, level)    used by window.__game.setLevel
     *   healAll(party, reserve)   used by G.State.healAll (debug F3, ['healAll'] may call it too)
     *   maxHp(actor) / maxMp(actor)
     */
    hooks: { createActor: null, setLevel: null, healAll: null, maxHp: null, maxMp: null },

    /**
     * Resets everything for a new game.
     * Starting values come from (first match wins per field): `opts`, then the optional data object
     * `G.DATA.newGame` = { party:[actorIds], map:{id,x,y,dir}, money, items:{id:n}, flags:{}, vars:{},
     * playerName }, then defaults: actors flagged `startsInParty:true` (or the first actor in
     * G.DATA.actors), and the first registered map that has a `start:{x,y,dir}` property (last resort,
     * with a warning: the middle of the first registered map).
     * @param {object} [opts] same shape as G.DATA.newGame
     * @returns {object} G.State
     */
    newGame: function (opts) {
      opts = opts || {};
      const base = G.DATA.newGame || {};
      const pick = function (k, dflt) { return opts[k] !== undefined ? opts[k] : base[k] !== undefined ? base[k] : dflt; };
      State.party = [];
      State.reserve = [];
      State.inventory = U.deepClone(pick('items', {}));
      State.money = pick('money', 0);
      State.flags = U.deepClone(pick('flags', {}));
      State.vars = U.deepClone(pick('vars', {}));
      State.playtimeFrames = 0;
      State.album = {};
      State.playerName = pick('playerName', null);
      let ids = pick('party', null);
      if (!ids) {
        const all = Object.keys(G.DATA.actors || {});
        ids = all.filter(function (id) { const a = G.DATA.actors[id]; return a && (a.startsInParty || a.initial); });
        if (!ids.length && all.length) ids = [all[0]];
      }
      for (const id of ids) State.addMember(id);
      let map = pick('map', null);
      if (!map) {
        const mapIds = Object.keys(G.DATA.maps || {});
        for (const id of mapIds) {
          const s = G.DATA.maps[id].start;
          if (s) { map = { id: id, x: s.x, y: s.y, dir: s.dir || 'down' }; break; }
        }
        if (!map && mapIds.length) {
          const d = G.DATA.maps[mapIds[0]];
          map = { id: mapIds[0], x: Math.floor((d.width || 2) / 2), y: Math.floor((d.height || 2) / 2), dir: 'down' };
          G.warn('State.newGame: no start position defined (G.DATA.newGame.map) - using the middle of "' + map.id + '"');
        }
      }
      State.map = map ? { id: map.id, x: map.x | 0, y: map.y | 0, dir: map.dir || 'down' } : { id: null, x: 0, y: 0, dir: 'down' };
      State.active = true;
      State.rev++;
      return State;
    },

    /** Flag value as a boolean (unset = false). */
    getFlag: function (k) { return !!State.flags[k]; },
    /** Sets a flag (default true). */
    setFlag: function (k, v) { State.flags[k] = v === undefined ? true : !!v; State.rev++; },
    /** Variable value (unset = 0). */
    getVar: function (k) { const v = State.vars[k]; return v === undefined ? 0 : v; },
    /** Sets a variable. */
    setVar: function (k, v) { State.vars[k] = v; State.rev++; },

    /** Key of a per-event self flag inside G.State.flags: "mapId:eventId:A". */
    selfKey: function (mapId, eventId, name) { return mapId + ':' + eventId + ':' + name; },
    /** Reads a per-event self flag. */
    getSelf: function (mapId, eventId, name) { return State.getFlag(State.selfKey(mapId, eventId, name)); },
    /** Writes a per-event self flag (default true). */
    setSelf: function (mapId, eventId, name, v) { State.setFlag(State.selfKey(mapId, eventId, name), v); },

    /** Adds n (default 1) of an item. Returns the new count. */
    addItem: function (id, n) {
      n = n == null ? 1 : n;
      if (G.DATA.items && Object.keys(G.DATA.items).length && !G.DATA.items[id] && !/^(test_|selftest_)/.test(id)) G.warn('State: unknown item ' + id);
      const c = Math.max(0, (State.inventory[id] || 0) + n);
      if (c > 0) State.inventory[id] = c; else delete State.inventory[id];
      State.rev++;
      return c;
    },
    /** Removes up to n (default 1) of an item. Returns true when at least n were owned. */
    removeItem: function (id, n) {
      n = n == null ? 1 : n;
      const have = State.inventory[id] || 0;
      const c = Math.max(0, have - n);
      if (c > 0) State.inventory[id] = c; else delete State.inventory[id];
      State.rev++;
      return have >= n;
    },
    /** How many of an item the party owns. */
    itemCount: function (id) { return State.inventory[id] || 0; },

    /** Adds money (negative to spend); never drops below 0. Returns the new amount. */
    addMoney: function (n) { State.money = Math.max(0, State.money + (n || 0)); State.rev++; return State.money; },

    /**
     * Adds an actor to the party (created from G.DATA.actors on first join, restored from the reserve
     * afterwards). Goes to the reserve when the party already has G.CONFIG.MAX_PARTY members.
     * @returns {object} the actor instance
     */
    addMember: function (id) {
      let a = State.party.find(function (m) { return m.id === id; });
      if (a) return a;
      State.rev++;
      const ri = State.reserve.findIndex(function (m) { return m.id === id; });
      if (ri >= 0) a = State.reserve[ri];
      else a = createActor(id);
      if (State.party.length < G.CONFIG.MAX_PARTY) {
        if (ri >= 0) State.reserve.splice(ri, 1);
        State.party.push(a);
      } else if (ri < 0) {
        State.reserve.push(a);
      }
      return a;
    },

    /** Moves an actor from the party to the reserve (progress is kept). Returns the actor or null. */
    removeMember: function (id) {
      const i = State.party.findIndex(function (m) { return m.id === id; });
      if (i < 0) return null;
      const a = State.party.splice(i, 1)[0];
      State.reserve.push(a);
      State.rev++;
      return a;
    },

    /** Actor instance by id (party first, then reserve) or null. */
    actor: function (id) {
      return State.party.find(function (m) { return m.id === id; }) ||
        State.reserve.find(function (m) { return m.id === id; }) || null;
    },

    /** True when the actor is in the active party. */
    inParty: function (id) {
      return State.party.some(function (m) { return m.id === id; });
    },

    /**
     * Fully heals everyone. Delegates to hooks.healAll when installed; otherwise uses hooks.maxHp/maxMp or
     * the actor's own mhp/maxHp (mmp/maxMp) fields when present.
     */
    healAll: function () {
      if (State.hooks.healAll) { State.hooks.healAll(State.party, State.reserve); return; }
      for (const a of State.party.concat(State.reserve)) {
        const mh = State.hooks.maxHp ? State.hooks.maxHp(a) : firstNumber(a.mhp, a.maxHp);
        const mm = State.hooks.maxMp ? State.hooks.maxMp(a) : firstNumber(a.mmp, a.maxMp);
        if (mh != null) a.hp = mh;
        if (mm != null) a.mp = mm;
        if (Array.isArray(a.states)) a.states.length = 0;
      }
    },

    /* ---------------------------------------------------------------- options */

    /** Loads options from localStorage ('fable51.options'); missing keys keep their defaults. */
    loadOptions: function () {
      State.options = Object.assign({}, DEFAULT_OPTIONS);
      const raw = readKey(OPTIONS_KEY);
      if (!raw) return State.options;
      try {
        const o = JSON.parse(raw);
        for (const k of Object.keys(o || {})) State.options[k] = o[k];
      } catch (e) { G.warn('Options were unreadable and have been reset'); }
      return State.options;
    },

    /** Persists G.State.options. */
    saveOptions: function () {
      writeKey(OPTIONS_KEY, JSON.stringify(State.options));
    },

    /* ---------------------------------------------------------------- save / load */

    /** Plain-object snapshot of the whole game state (what save() writes). */
    snapshot: function () {
      const mapDef = State.map.id && G.DATA.maps ? G.DATA.maps[State.map.id] : null;
      return {
        version: SAVE_VERSION,
        timestamp: Date.now(),
        info: {
          mapId: State.map.id,
          mapName: mapDef && mapDef.name ? mapDef.name : (State.map.id || ''),
          playtimeFrames: State.playtimeFrames,
          party: State.party.map(function (a) { return { id: a.id, name: a.name, level: a.level }; }),
          money: State.money,
        },
        party: U.deepClone(State.party),
        reserve: U.deepClone(State.reserve),
        inventory: U.deepClone(State.inventory),
        money: State.money,
        flags: U.deepClone(State.flags),
        vars: U.deepClone(State.vars),
        album: U.deepClone(State.album || {}),
        map: U.deepClone(State.map),
        playtimeFrames: State.playtimeFrames,
        playerName: State.playerName,
      };
    },

    /**
     * Writes the game to a slot (1-3). The map scene is expected to keep G.State.map up to date.
     * @returns {boolean} success
     */
    save: function (slot) {
      if (SLOTS.indexOf(slot) < 0) { G.warn('State.save: bad slot ' + slot); return false; }
      try {
        writeKey(SAVE_PREFIX + slot, JSON.stringify(State.snapshot()));
        return true;
      } catch (e) {
        G.error('Saving failed: ' + e.message);
        return false;
      }
    },

    /**
     * Restores a slot into G.State. Does not change scenes - the caller starts the map scene afterwards.
     * @returns {boolean} false when the slot is empty, corrupt or from an incompatible version
     */
    load: function (slot) {
      const raw = readKey(SAVE_PREFIX + slot);
      if (!raw) return false;
      let d;
      try { d = JSON.parse(raw); } catch (e) { G.warn('Save slot ' + slot + ' is corrupt'); return false; }
      if (!d || d.version !== SAVE_VERSION) { G.warn('Save slot ' + slot + ' has an incompatible version'); return false; }
      State.party = d.party || [];
      State.reserve = d.reserve || [];
      State.inventory = d.inventory || {};
      State.money = d.money || 0;
      State.flags = d.flags || {};
      State.vars = d.vars || {};
      State.album = d.album || {};
      State.map = d.map || { id: null, x: 0, y: 0, dir: 'down' };
      State.playtimeFrames = d.playtimeFrames || 0;
      State.playerName = d.playerName || null;
      State.active = true;
      State.rev++;
      return true;
    },

    /**
     * Summary of a slot for the save/load UI, or null when empty/incompatible.
     * @returns {{slot:number, mapId:string, mapName:string, playtimeFrames:number, playtime:string,
     *            party:Array<{id,name,level}>, levels:number[], money:number, timestamp:number,
     *            dateText:string}|null}
     */
    slotInfo: function (slot) {
      const raw = readKey(SAVE_PREFIX + slot);
      if (!raw) return null;
      try {
        const d = JSON.parse(raw);
        if (!d || d.version !== SAVE_VERSION) return null;
        const info = d.info || {};
        const party = info.party || [];
        const date = new Date(d.timestamp || 0);
        const p2 = function (n) { return (n < 10 ? '0' : '') + n; };
        return {
          slot: slot,
          mapId: info.mapId || null,
          mapName: info.mapName || '',
          playtimeFrames: info.playtimeFrames || 0,
          playtime: U.formatTime(info.playtimeFrames || 0),
          party: party,
          levels: party.map(function (p) { return p.level; }),
          money: info.money || 0,
          timestamp: d.timestamp || 0,
          dateText: date.getFullYear() + '-' + p2(date.getMonth() + 1) + '-' + p2(date.getDate()) + ' ' + p2(date.getHours()) + ':' + p2(date.getMinutes()),
        };
      } catch (e) {
        return null;
      }
    },

    /** True when at least one slot holds a loadable save. */
    hasAnySave: function () {
      return SLOTS.some(function (s) { return !!State.slotInfo(s); });
    },

    /** Slot number of the most recent save, or null. */
    latestSlot: function () {
      let best = null, bestT = -1;
      for (const s of SLOTS) {
        const i = State.slotInfo(s);
        if (i && i.timestamp > bestT) { best = s; bestT = i.timestamp; }
      }
      return best;
    },

    /** Deletes a save slot. */
    deleteSave: function (slot) {
      removeKey(SAVE_PREFIX + slot);
    },
  };

  /* ------------------------------------------------------------------ conditions */

  const OPS = {
    '==': function (a, b) { return a == b; }, // eslint-disable-line eqeqeq
    '!=': function (a, b) { return a != b; }, // eslint-disable-line eqeqeq
    '>': function (a, b) { return a > b; },
    '>=': function (a, b) { return a >= b; },
    '<': function (a, b) { return a < b; },
    '<=': function (a, b) { return a <= b; },
  };

  G.Cond = {
    /**
     * Evaluates the condition mini-language (TECH_SPEC 4.3):
     * null | {flag} | {notFlag} | {var:[k,op,n]} | {hasItem} | {inParty} | {self} | {notSelf} |
     * {all:[..]} | {any:[..]} | {not:cond}. An object with several keys requires all of them.
     * @param {object|null} cond
     * @param {{mapId?:string, eventId?:string}} [ctx] needed for self/notSelf; mapId defaults to
     *   G.State.map.id, eventId may also be given as ctx.id or ctx.event.id
     * @returns {boolean}
     */
    evaluate: function (cond, ctx) {
      if (cond == null || cond === true) return true;
      if (cond === false) return false;
      if (Array.isArray(cond)) return cond.every(function (c) { return G.Cond.evaluate(c, ctx); });
      if (typeof cond !== 'object') { G.warn('Cond: invalid condition ' + JSON.stringify(cond)); return false; }
      for (const key of Object.keys(cond)) {
        if (!evalKey(key, cond[key], ctx)) return false;
      }
      return true;
    },
  };

  function selfFlag(name, ctx) {
    ctx = ctx || {};
    const mapId = ctx.mapId || ctx.map || State.map.id;
    const eventId = ctx.eventId || (typeof ctx.id === 'string' ? ctx.id : null) || (ctx.event && ctx.event.id);
    if (!eventId) { G.warn('Cond: self flag "' + name + '" evaluated without an event context'); return false; }
    return State.getSelf(mapId, eventId, name);
  }

  function evalKey(key, v, ctx) {
    switch (key) {
      case 'flag': return State.getFlag(v);
      case 'notFlag': return !State.getFlag(v);
      case 'var': {
        if (!Array.isArray(v) || v.length < 3 || !OPS[v[1]]) { G.warn('Cond: bad var condition ' + JSON.stringify(v)); return false; }
        const rhs = typeof v[2] === 'string' && State.vars[v[2]] !== undefined ? State.getVar(v[2]) : v[2];
        return OPS[v[1]](State.getVar(v[0]), rhs);
      }
      case 'hasItem': return State.itemCount(v) > 0;
      case 'notItem': return State.itemCount(v) <= 0;
      case 'inParty': return State.inParty(v);
      case 'notInParty': return !State.inParty(v);
      case 'self': return selfFlag(v, ctx);
      case 'notSelf': return !selfFlag(v, ctx);
      case 'all': return (v || []).every(function (c) { return G.Cond.evaluate(c, ctx); });
      case 'any': return (v || []).some(function (c) { return G.Cond.evaluate(c, ctx); });
      case 'not': return !G.Cond.evaluate(v, ctx);
      default:
        G.warn('Cond: unknown condition key "' + key + '"');
        return false;
    }
  }
})();
