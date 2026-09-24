/*
 * interpreter.js - the async event command interpreter (TECH_SPEC 4.4).
 *
 *   await G.Interpreter.run(commands, ctx)     ctx = { eventId, event, mapId, main }
 *
 * One "main" list blocks player input (G.Interpreter.isBusy()); parallel lists run alongside it.
 * Every command is an array whose first element is its name; unknown names log one error and are skipped.
 * Bespoke puzzle logic goes into G.Interpreter.custom['name'] = function (args, ctx) {...}.
 */
(function () {
  'use strict';
  const G = window.G;
  const U = G.Util;

  const END = { end: true };
  let mainCount = 0;
  let generation = 0;          // bumped by reset(); lists from an older generation stop at their next command

  /** The live map scene (set by map_scene.js on enter). */
  function scene() {
    return G.Interpreter.scene || G.Scenes.find('map') || null;
  }

  /** False once the map scene has been left for good (title, gameover, ending): the list then stops. */
  function alive() {
    return !G.Scenes.has('map') || G.Scenes.isActive('map');
  }

  function sfxId(role) {
    const m = (G.DATA.strings && G.DATA.strings.sfx) || {};
    return m[role] || null;
  }

  /** Display name of an item: from items.js when it is known, otherwise the id made readable. */
  function itemName(id) {
    const it = G.DATA.items && G.DATA.items[id];
    if (it && (it.name || it.label)) return it.name || it.label;
    return String(id).replace(/_/g, ' ').replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); });
  }

  function itemIcon(id) {
    const it = G.DATA.items && G.DATA.items[id];
    const icon = it && it.icon ? it.icon : null;
    if (!icon) return null;
    return G.Assets.has(icon) ? icon : (G.Assets.has('icon_' + icon) ? 'icon_' + icon : null);
  }

  /** Resolves 'player' | 'this' | '<eventId>' to a character on the map. */
  function target(name, ctx) {
    const s = scene();
    if (!s) return null;
    if (name == null || name === 'player' || name === 'hero') return s.player;
    if (name === 'this' || name === 'self') return ctx && ctx.event ? ctx.event : null;
    const ev = s.event(name);
    if (!ev) G.warn('Interpreter: no event "' + name + '" on map ' + s.mapId);
    return ev;
  }

  function sceneResult(name, params) {
    return G.Scenes.push(name, params || {});
  }

  /* ====================================================================== commands */

  const CMD = {
    /* ---------------------------------------------------------------- dialogue */

    say: async function (a, ctx) {
      await G.UI.MessageBox.show({ speaker: a[1] || null, expr: a[2] || 'neutral', text: a[3] == null ? '' : a[3] });
    },

    narrate: async function (a) {
      await G.UI.MessageBox.show({ style: 'narrate', text: a[1] == null ? '' : a[1], pos: a[2] || undefined });
    },

    think: async function (a) {
      await G.UI.MessageBox.show({ style: 'think', text: a[1] == null ? '' : a[1] });
    },

    choice: async function (a, ctx) {
      const options = a[1] || [];
      const branches = a[2] || [];
      const o = a[3] || {};
      const i = await G.UI.ChoiceBox.show(options, { cancelIndex: o.cancel != null ? o.cancel : -1 });
      if (o.varName) G.State.setVar(o.varName, i);
      if (!alive()) return END;
      const branch = branches[i];
      if (branch && branch.length) return await exec(branch, ctx);
      return undefined;
    },

    /* ---------------------------------------------------------------- flow */

    if: async function (a, ctx) {
      const ok = G.Cond.evaluate(a[1], ctx);
      const branch = ok ? a[2] : a[3];
      if (branch && branch.length) return await exec(branch, ctx);
      return undefined;
    },

    label: function () {},

    call: async function (a, ctx) {
      const id = a[1];
      const ce = G.DATA.commonEvents ? G.DATA.commonEvents[id] : null;
      if (!ce) { G.error('Interpreter: unknown common event "' + id + '"'); return undefined; }
      const list = Array.isArray(ce) ? ce : ce.commands || [];
      return await exec(list, ctx);
    },

    wait: async function (a) {
      await U.waitFrames(Math.max(0, a[1] | 0));
    },

    end: function () { return END; },

    /* ---------------------------------------------------------------- state */

    setFlag: function (a) { G.State.setFlag(a[1], a[2] === undefined ? true : a[2]); },

    setVar: function (a) {
      const k = a[1], op = a[2], n = a[3];
      const cur = G.State.getVar(k);
      const val = typeof n === 'string' ? G.State.getVar(n) : n;
      if (op === '=') G.State.setVar(k, val);
      else if (op === '+') G.State.setVar(k, cur + val);
      else if (op === '-') G.State.setVar(k, cur - val);
      else if (op === '*') G.State.setVar(k, cur * val);
      else G.error('Interpreter: bad setVar operator "' + op + '"');
    },

    setSelf: function (a, ctx) {
      const id = ctx && ctx.eventId;
      if (!id) { G.error('Interpreter: setSelf outside an event'); return; }
      G.State.setSelf(ctx.mapId || G.State.map.id, id, a[1], a[2] === undefined ? true : a[2]);
    },

    giveItem: function (a) {
      const n = a[2] == null ? 1 : a[2];
      G.State.addItem(a[1], n);
      const icon = itemIcon(a[1]);
      G.UI.Toast.show(G.str('map.gotItem', 'Got {item}!').replace('{item}', itemName(a[1]) + (n > 1 ? ' x' + n : '')),
        { icon: icon, sfx: sfxId('item') });
    },

    takeItem: function (a) { G.State.removeItem(a[1], a[2] == null ? 1 : a[2]); },

    giveMoney: function (a) {
      G.State.addMoney(a[1] | 0);
      const unit = (G.DATA.system && G.DATA.system.currencyName) || G.str('common.money', 'coins');
      G.UI.Toast.show((a[1] | 0) + ' ' + unit, { sfx: 'sfx_coin' });
    },

    addMember: function (a) { G.State.addMember(a[1]); },
    removeMember: function (a) { G.State.removeMember(a[1]); },
    healAll: function () { G.State.healAll(); },

    giveExp: function (a) {
      const n = a[1] | 0;
      if (G.State.hooks.giveExp) { G.State.hooks.giveExp(G.State.party, n); return; }
      for (const m of G.State.party) m.exp = (m.exp || 0) + n;
    },

    save: async function () {
      if (G.Scenes.has('save')) { await sceneResult('save', { mode: 'save' }); return; }
      G.UI.Toast.show(G.str('map.noSave', 'There is nowhere to write just now.'));
    },

    shop: async function (a) {
      if (G.Scenes.has('shop')) { await sceneResult('shop', Object.assign({ items: a[1] || [] }, a[2] || {})); return; }
      G.UI.Toast.show(G.str('map.noShop', 'The shop is closed.'));
    },

    /* ---------------------------------------------------------------- staging */

    transfer: async function (a) {
      const s = scene();
      if (!s) { G.error('Interpreter: transfer without a map scene'); return; }
      await s.transfer(a[1], a[2] | 0, a[3] | 0, a[4] || 'down', a[5] || {});
    },

    move: async function (a, ctx) {
      const ch = target(a[1], ctx);
      if (!ch) return;
      const p = ch.setRoute(a[2] || [], a[3] || {});
      if (a[3] && a[3].wait) await p;
    },

    face: function (a, ctx) {
      const ch = target(a[1], ctx);
      const s = scene();
      if (!ch || !s) return;
      const d = a[2];
      if (d === 'toward_player') ch.dir = G.Entities.dirBetween(ch.x, ch.y, s.player.x, s.player.y);
      else if (d === 'away') ch.dir = G.Entities.opposite(G.Entities.dirBetween(ch.x, ch.y, s.player.x, s.player.y));
      else if (G.Entities.DELTA[d]) ch.dir = d;
      else G.error('Interpreter: bad direction "' + d + '"');
    },

    emote: function (a, ctx) {
      const ch = target(a[1], ctx);
      if (!ch) return;
      ch.showEmote(a[2]);
      G.Audio.playSfx('sfx_emote', { volume: 0.5 });
    },

    fade: async function (a) {
      const frames = a[2] == null ? 30 : a[2];
      if (a[1] === 'out') await G.Gfx.fadeOut(frames, a[3] || 'black');
      else await G.Gfx.fadeIn(frames, a[3] || undefined);
    },

    flash: function (a) { G.Gfx.flash(a[1] || '#fff', a[2] == null ? 20 : a[2]); },
    shake: function (a) { G.Gfx.shake(a[1] == null ? 6 : a[1], a[2] == null ? 20 : a[2]); },
    tint: function (a) { G.Gfx.setTint(a[1] || null, a[2] == null ? 30 : a[2]); },

    cg: async function (a) {
      const s = scene();
      if (!s) return;
      const o = a[2] || {};
      await s.setCg(a[1] || null, o.fade == null ? 30 : o.fade);
    },

    bgm: function (a) {
      const id = a[1];
      const o = a[2] || {};
      if (!id || id === 'none') G.Audio.stopBgm(o.fadeMs);
      else G.Audio.playBgm(id, o);
    },

    bgmFade: function (a) { G.Audio.stopBgm(a[1] == null ? 600 : a[1]); },
    sfx: function (a) { G.Audio.playSfx(a[1], a[2] || undefined); },

    ambience: function (a) {
      if (!a[1] || a[1] === 'none') G.Audio.stopAmbience();
      else G.Audio.playAmbience(a[1]);
    },

    camera: async function (a, ctx) {
      const s = scene();
      if (!s) return;
      const frames = a[2] == null ? 30 : a[2];
      if (Array.isArray(a[1])) s.cameraTo({ x: a[1][0], y: a[1][1] }, frames);
      else if (a[1] === 'player' || a[1] == null) s.cameraTo(null, frames);
      else {
        const ch = target(a[1], ctx);
        if (ch) s.cameraTo(ch, frames);
      }
      await U.waitFrames(frames);
    },

    setSprite: function (a, ctx) {
      const ch = target(a[1], ctx);
      if (ch) ch.setSprite(a[2] || null);
      if (ch) ch.visible = !!a[2];
    },

    erase: function (a, ctx) {
      const s = scene();
      const own = !a[1] || a[1] === 'this' || a[1] === 'self';
      const ev = own ? (ctx ? ctx.event : null) : (s ? s.event(a[1]) : null);
      if (ev && ev.erase) ev.erase();
      else G.warn('Interpreter: erase - no event "' + a[1] + '"');
    },

    /* ---------------------------------------------------------------- battle and endings */

    battle: async function (a, ctx) {
      const o = a[3] || a[2] || {};
      let outcome = 'win';
      if (G.Scenes.has('battle')) {
        const params = {
          troop: a[1], canEscape: o.canEscape !== false, bgm: o.bgm || null, back: o.back || null,
        };
        const r = await sceneResult('battle', params);
        // a battle removed without a result (teleport/clearTo) must never count as a win
        outcome = (r && r.outcome) || 'escape';
      } else {
        G.warn('Interpreter: no "battle" scene is registered yet - treating troop "' + a[1] + '" as a win');
        await U.waitFrames(2);
      }
      if (!alive()) return END;
      // onPeace falls back to onWin, onTimeout falls back to onLose (TECH_SPEC battle addendum)
      const branch = outcome === 'peace' ? (o.onPeace || o.onWin) :
        outcome === 'lose' ? o.onLose :
        outcome === 'timeout' ? (o.onTimeout || o.onLose) :
        outcome === 'escape' ? o.onEscape : o.onWin;
      if (branch === 'gameover') { return await CMD.gameover([]); }
      if (Array.isArray(branch) && branch.length) return await exec(branch, ctx);
      if (outcome === 'lose' && !branch) return await CMD.gameover([]);
      if (outcome === 'timeout' && !branch && o.onLose === undefined) return undefined;
      return undefined;
    },

    ending: async function (a) {
      if (!G.Scenes.has('ending')) { G.warn('Interpreter: no "ending" scene registered (' + a[1] + ')'); return END; }
      G.Scenes.clearTo('ending', { id: a[1] });
      return END;
    },

    title: async function () {
      if (!G.Scenes.has('title')) { G.warn('Interpreter: no "title" scene registered'); return END; }
      G.Scenes.clearTo('title', {});
      return END;
    },

    gameover: async function () {
      if (!G.Scenes.has('gameover')) { G.warn('Interpreter: no "gameover" scene registered'); return END; }
      G.Scenes.clearTo('gameover', {});
      return END;
    },

    custom: async function (a, ctx) {
      const fn = G.Interpreter.custom[a[1]];
      if (typeof fn !== 'function') { G.error('Interpreter: unknown custom command "' + a[1] + '"'); return undefined; }
      await Promise.resolve(fn(a[2], ctx));
    },
  };

  /* ====================================================================== runner */

  function findLabel(list, name) {
    for (let i = 0; i < list.length; i++) {
      if (Array.isArray(list[i]) && list[i][0] === 'label' && list[i][1] === name) return i;
    }
    return -1;
  }

  /**
   * Runs a command list. Returns END when the list (and every list above it) must stop.
   * @param {Array} list
   * @param {object} ctx
   */
  async function exec(list, ctx) {
    if (!Array.isArray(list)) { G.error('Interpreter: command list is not an array'); return undefined; }
    let i = 0;
    let guard = 0;
    while (i < list.length) {
      if (guard++ > 100000) { G.error('Interpreter: command list ran away (infinite goto?)'); return END; }
      const cmd = list[i++];
      if (!Array.isArray(cmd) || typeof cmd[0] !== 'string') {
        G.error('Interpreter: malformed command ' + JSON.stringify(cmd));
        continue;
      }
      if (cmd[0] === 'goto') {
        const at = findLabel(list, cmd[1]);
        if (at < 0) { G.error('Interpreter: unknown label "' + cmd[1] + '"'); continue; }
        i = at + 1;
        continue;
      }
      const fn = CMD[cmd[0]];
      if (!fn) { G.error('Interpreter: unknown command "' + cmd[0] + '"'); continue; }
      let r;
      try {
        r = await fn(cmd, ctx);
      } catch (e) {
        G.error(e);
      }
      if (r === END) return END;
      if (!alive() || ctx.gen !== generation) return END;
    }
    return undefined;
  }

  G.Interpreter = {
    /** Registry for `['custom','name',args]` commands. */
    custom: {},

    /** The live map scene; map_scene.js keeps this up to date. */
    scene: null,

    /** Every command name the interpreter understands. */
    commands: Object.keys(CMD).concat(['goto']),

    /**
     * Runs an event command list.
     * @param {Array} commands array of command arrays (TECH_SPEC 4.4)
     * @param {{eventId?:string, event?:object, mapId?:string, main?:boolean}} [ctx]
     * @returns {Promise<void>} resolves when the list is finished
     */
    run: function (commands, ctx) {
      ctx = ctx || {};
      if (ctx.mapId == null) ctx.mapId = (scene() && scene().mapId) || G.State.map.id;
      const isMain = ctx.main !== false;
      ctx.gen = generation;
      if (isMain) mainCount++;
      return exec(commands || [], ctx)
        .catch(function (e) { G.error(e); })
        .then(function () { if (isMain && ctx.gen === generation) mainCount = Math.max(0, mainCount - 1); });
    },

    /** True while a blocking ("main") command list is running. */
    isBusy: function () {
      return mainCount > 0;
    },

    /** Drops the busy counter (used when the map scene is torn down). */
    reset: function () {
      generation++;
      mainCount = 0;
    },
  };
})();
