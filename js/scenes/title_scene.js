/*
 * title_scene.js - scene 'title' (DESIGN_BIBLE 9.4) AND the small shared toolkit every menu-ish scene
 * uses, G.SceneKit.
 *
 * Title: "press any key" first (that is what unlocks audio), then cg_tide_steps full screen with a slow
 * boil - or, when that illustration does not exist yet, a code-drawn pale sea-and-sand sketch with the
 * string and two cans, so the screen is never a grey placeholder box. The logo is lettered in GochiHand
 * with its two T's joined by a piece of string with a tin can at each end. The menu is four luggage tags
 * hanging from a string on the right: New Game, Continue (greyed out without saves), Options and
 * About this game (the content note of bible section 1).
 *
 * G.SceneKit is defined here because title_scene.js is the first scene file the build loads; every user
 * of it reads it at runtime, so the load order does not matter.
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CONFIG;
  const U = G.Util;
  const INK = C.COLORS.ink;

  /* ==================================================================== G.SceneKit */

  const GLASS_COLORS = { red: '#cf4a3e', blue: '#3f72b8', amber: '#d9a13a', green: '#4c8f4e' };
  let hooksInstalled = false;

  const K = G.SceneKit = {
    GLASS_COLORS: GLASS_COLORS,

    /* ------------------------------------------------------------ guarded audio / assets */

    /** True when an image id exists (manifest or runtime-registered). */
    hasImg: function (id) { return !!id && G.Assets.has(id); },

    /** True when an audio id exists; nothing warns about art that has not been made yet. */
    hasAudio: function (id) {
      const a = G.DATA.manifest && G.DATA.manifest.audio;
      return !!(id && a && a[id]);
    },

    /** Plays music only when the track exists (silently ignores ids the composer has not rendered yet). */
    bgm: function (id, opts) {
      if (!id || id === 'none') { G.Audio.stopBgm(600); return false; }
      if (!K.hasAudio(id)) return false;
      if (G.Audio.currentBgm === id) return true;
      G.Audio.playBgm(id, opts);
      return true;
    },

    /** Plays a sound effect only when it exists. */
    sfx: function (id, opts) {
      if (K.hasAudio(id)) G.Audio.playSfx(id, opts);
    },

    /** Plays a UI sound by role ('cursor', 'confirm', 'cancel', 'page', ...). */
    role: function (name, opts) { G.UI.sfx(name, opts); },

    /* ------------------------------------------------------------ party / data access */

    /** The playable party (never null). */
    party: function () { return (G.State && G.State.party) || []; },

    /**
     * True when G.Party can do the stat maths for this actor: the battle module is loaded AND the actor
     * has real battle data (the engine's placeholder test actor has none).
     */
    _battleActor: function (a) {
      const d = K.actorDef(a && a.id);
      return !!(G.Party && d && d.base);
    },

    /** Stats of an actor instance; falls back to the actor data when js/battle/party.js is not loaded. */
    stats: function (a) {
      if (K._battleActor(a) && G.Party.stats) { try { return G.Party.stats(a); } catch (e) { G.error(e); } }
      const d = (G.DATA.actors && G.DATA.actors[a && a.id]) || {};
      const b = d.base || {}, g = d.growth || {};
      const lv = Math.max(0, ((a && a.level) || 1) - 1);
      return {
        mhp: Math.floor((b.hp || a.hp || 1) + (g.hp || 0) * lv),
        atk: Math.floor((b.atk || 0) + (g.atk || 0) * lv),
        def: Math.floor((b.def || 0) + (g.def || 0) * lv),
        spd: Math.floor((b.spd || 0) + (g.spd || 0) * lv),
      };
    },

    /** Maximum Breath of an actor instance. */
    maxHp: function (a) {
      if (K._battleActor(a) && G.Party.maxHp) { try { return G.Party.maxHp(a); } catch (e) { G.error(e); } }
      return K.stats(a).mhp;
    },

    /** EXP still needed for the next level, or null at the maximum level. */
    expToNext: function (a) {
      if (K._battleActor(a) && G.Party.expToNext) { try { return G.Party.expToNext(a); } catch (e) { G.error(e); } }
      return null;
    },

    /** Skill ids this member knows right now. */
    knownSkills: function (a) {
      if (K._battleActor(a) && G.Party.knownSkills) { try { return G.Party.knownSkills(a); } catch (e) { G.error(e); } }
      return (a && a.skills) || [];
    },

    /** {ordinary, story, total} Pebbles of a member. */
    pebbles: function (a) {
      if (K._battleActor(a) && G.Party.pebbles) { try { return G.Party.pebbles(a); } catch (e) { G.error(e); } }
      const n = (a && a.pebbles) || 0;
      return { ordinary: n, story: 0, total: n };
    },

    /** Fully heals one member (or the whole party when no member is given). */
    fullHeal: function (a) {
      if (a) {
        if (K._battleActor(a)) G.Party.fullHeal(a);
        else a.hp = K.maxHp(a);
        return;
      }
      const list = K.party();
      if (list.length && list.every(K._battleActor)) { for (const m of list) G.Party.fullHeal(m); return; }
      G.State.healAll();
      for (const m of list) if (m.hp == null || m.hp <= 0) m.hp = K.maxHp(m);
    },

    /** Item / skill / actor definitions with friendly fallbacks for ids that have no data yet. */
    itemDef: function (id) { return (G.DATA.items && G.DATA.items[id]) || null; },
    skillDef: function (id) { return (G.DATA.skills && G.DATA.skills[id]) || null; },
    actorDef: function (id) { return (G.DATA.actors && G.DATA.actors[id]) || null; },

    /** Readable name of an item id, even when items.js does not know it. */
    itemName: function (id) {
      const it = K.itemDef(id);
      if (it && it.name) return it.name;
      return String(id).replace(/_/g, ' ').replace(/(^|\s)\S/g, function (c) { return c.toUpperCase(); });
    },

    /** Existing icon image id for an item, or null (the caller then draws a paper square). */
    itemIcon: function (id) {
      const it = K.itemDef(id);
      const icon = it && it.icon ? it.icon : 'icon_' + id;
      if (G.Assets.has(icon)) return icon;
      return null;
    },

    /** Portrait image id for a member, or null. */
    faceId: function (actorId, expr) {
      const d = K.actorDef(actorId);
      const fam = (d && d.faces) || actorId;
      const a = 'face_' + fam + '_' + (expr || 'neutral');
      if (G.Assets.has(a)) return a;
      const b = 'face_' + fam + '_neutral';
      return G.Assets.has(b) ? b : null;
    },

    /** Luggage-tag colour of a member (actors.js `color`, then speakers.js, then grey). */
    actorColor: function (actorId) {
      const d = K.actorDef(actorId);
      if (d && d.color) return d.color;
      const s = G.DATA.speakers && G.DATA.speakers[actorId];
      return (s && s.color) || C.COLORS.inkSoft;
    },

    /** What money is called ("Stamps"). */
    currency: function () {
      const n = G.DATA.system && G.DATA.system.currencyName;
      return n && n !== 'coins' ? n : 'Stamps';
    },

    /** How much money the party has. */
    money: function () { return (G.State && G.State.money) || 0; },

    /** Game title from system.js. */
    gameTitle: function () {
      const t = G.DATA.system && G.DATA.system.title;
      return t && t !== 'Fable 51' ? t : 'LOW TIDE LETTERS';
    },

    /* ------------------------------------------------------------ options */

    /** Reads an option with a default (options the core does not know about are stored all the same). */
    option: function (key, dflt) {
      const o = G.State.options || {};
      return o[key] === undefined ? dflt : o[key];
    },

    /**
     * Installs the small option hooks the core does not provide by itself:
     * screen shake on/off wraps G.Gfx.shake. (Text speed and paper grain are already read by
     * G.Text.Typer and G.Gfx.end; the volumes go through G.Audio.setVolume.)
     */
    installHooks: function () {
      if (hooksInstalled) return;
      hooksInstalled = true;
      const shake = G.Gfx.shake;
      G.Gfx.shake = function (power, frames) {
        if (K.option('shake', true) === false) return;
        return shake.call(G.Gfx, power, frames);
      };
    },

    /* ------------------------------------------------------------ drawing */

    /** Full-screen sketchbook page: cream paper with a faint pencil ruling and a sand line at the bottom. */
    page: function (ctx, o) {
      o = o || {};
      ctx.fillStyle = o.fill || '#f7efdc';
      ctx.fillRect(0, 0, C.W, C.H);
      ctx.save();
      ctx.globalAlpha *= 0.28;
      ctx.strokeStyle = '#b9c6cf';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = 46; y < C.H; y += 30) { ctx.moveTo(0, y + 0.5); ctx.lineTo(C.W, y + 0.5); }
      ctx.stroke();
      ctx.restore();
      if (o.sand !== false) K.sand(ctx, C.H - 34, o.seed || 11);
    },

    /** A wobbly sand line with a little stipple under it. */
    sand: function (ctx, y, seed) {
      G.Gfx.line(-10, y, C.W + 10, y + 3, { width: 1.8, alpha: 0.5, seed: seed, color: '#c8b48c' });
      ctx.save();
      ctx.fillStyle = '#c8b48c';
      ctx.globalAlpha *= 0.5;
      for (let i = 0; i < 90; i++) {
        const x = ((U.noise(seed, i) + 1) / 2) * C.W;
        const yy = y + 6 + ((U.noise(seed + 5, i) + 1) / 2) * 24;
        ctx.fillRect(x, yy, 1.6, 1.6);
      }
      ctx.restore();
    },

    /** Darkens whatever is underneath (menus over the map). */
    dim: function (ctx, alpha) {
      ctx.save();
      ctx.fillStyle = 'rgba(26,22,30,' + (alpha == null ? 0.45 : alpha) + ')';
      ctx.fillRect(0, 0, C.W, C.H);
      ctx.restore();
    },

    /**
     * One piece of sea-glass, a Pebble or an empty pocket hollow. Uses G.BattleUI.drawGlass when the
     * battle UI is loaded and otherwise draws the same shapes itself, so menus work on their own.
     * @param {null|{c:string,t:boolean,from:string}|{pebble:boolean}} piece
     */
    glass: function (ctx, x, y, piece, size) {
      if (G.BattleUI && typeof G.BattleUI.drawGlass === 'function') {
        try { G.BattleUI.drawGlass(ctx, x, y, piece, size); return; } catch (e) { G.error(e); }
      }
      K.drawGlassFallback(ctx, x, y, piece, size);
    },

    /** Code-drawn stand-in for G.BattleUI.drawGlass (same contract: x,y = centre, size = width). */
    drawGlassFallback: function (ctx, x, y, piece, size) {
      const r = (size || 22) / 2;
      ctx.save();
      ctx.translate(x, y);
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.lineWidth = 1.8;
      if (!piece) {                                   // empty hollow: a dashed pocket
        ctx.strokeStyle = 'rgba(80,72,90,0.5)';
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return;
      }
      if (piece.pebble) {                             // grey pebble
        ctx.fillStyle = '#9a958f';
        ctx.strokeStyle = '#4b4750';
        ctx.beginPath();
        ctx.ellipse(0, 1, r * 0.92, r * 0.72, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha *= 0.5;
        ctx.strokeStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-r * 0.25, -r * 0.2, r * 0.3, Math.PI, Math.PI * 1.6);
        ctx.stroke();
        ctx.restore();
        return;
      }
      const col = GLASS_COLORS[piece.c] || '#9fb7c4';
      ctx.fillStyle = col;
      ctx.strokeStyle = INK;
      if (piece.t) {                                  // Tumbled: rounded, with a glint
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.95, r * 0.8, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.save();
        ctx.globalAlpha *= 0.75;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(-r * 0.2, -r * 0.15, r * 0.42, Math.PI * 0.95, Math.PI * 1.5);
        ctx.stroke();
        ctx.restore();
      } else {                                        // raw: jagged
        ctx.beginPath();
        const n = 7;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const rr = r * (0.66 + ((U.noise(31 + i, piece.c ? piece.c.length : 1) + 1) / 2) * 0.42);
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    },

    /** A little blue lighthouse Stamp (the currency icon) - code-drawn when icon_stamp is missing. */
    stamp: function (ctx, x, y, size) {
      const s = size || 22;
      if (G.Assets.has('icon_stamp')) {
        G.Gfx.drawImg('icon_stamp', x, y, { w: s, h: s, anchorX: 0.5, anchorY: 0.5 });
        return;
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.lineJoin = ctx.lineCap = 'round';
      const h = s / 2;
      ctx.fillStyle = '#eaf1f6';
      ctx.strokeStyle = '#4c7fa8';
      ctx.lineWidth = 1.4;
      ctx.beginPath();                                 // perforated square
      const teeth = 6;
      for (let i = 0; i < teeth * 4; i++) {
        const side = Math.floor(i / teeth);
        const t = (i % teeth) / teeth;
        let px, py;
        if (side === 0) { px = -h + 2 * h * t; py = -h; }
        else if (side === 1) { px = h; py = -h + 2 * h * t; }
        else if (side === 2) { px = h - 2 * h * t; py = h; }
        else { px = -h; py = h - 2 * h * t; }
        const bump = (i % 2 === 0) ? 1.6 : 0;
        const nx = side === 0 ? 0 : side === 1 ? 1 : side === 2 ? 0 : -1;
        const ny = side === 0 ? -1 : side === 1 ? 0 : side === 2 ? 1 : 0;
        if (i === 0) ctx.moveTo(px + nx * bump, py + ny * bump);
        else ctx.lineTo(px + nx * bump, py + ny * bump);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#3d6f96';                     // lighthouse
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-h * 0.24, h * 0.5); ctx.lineTo(-h * 0.12, -h * 0.3);
      ctx.lineTo(h * 0.12, -h * 0.3); ctx.lineTo(h * 0.24, h * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -h * 0.42, h * 0.16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },

    /**
     * A tin can on its string (the game's other motif). x,y = centre of the can.
     * @param {{rot?:number, w?:number, alpha?:number, seed?:number}} [o]
     */
    can: function (ctx, x, y, o) {
      o = o || {};
      const w = o.w || 22, h = w * 1.25;
      ctx.save();
      ctx.translate(x, y);
      if (o.rot) ctx.rotate(o.rot);
      if (o.alpha != null) ctx.globalAlpha *= o.alpha;
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = INK;
      ctx.fillStyle = '#dfe4e6';
      ctx.beginPath();                                 // body
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(-w / 2, h / 2 - w * 0.12);
      ctx.quadraticCurveTo(0, h / 2 + w * 0.22, w / 2, h / 2 - w * 0.12);
      ctx.lineTo(w / 2, -h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();                                 // open rim
      ctx.ellipse(0, -h / 2, w / 2, w * 0.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f3f6f7';
      ctx.fill();
      ctx.stroke();
      ctx.save();                                      // label band
      ctx.globalAlpha *= 0.55;
      ctx.strokeStyle = '#a9b3b7';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h * 0.1); ctx.lineTo(w / 2, -h * 0.1);
      ctx.moveTo(-w / 2, h * 0.08); ctx.lineTo(w / 2, h * 0.08);
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    },

    /** Formats a play time (frames at 60 Hz) as h:mm:ss. */
    time: function (frames) { return U.formatTime(frames || 0); },
  };

  /* ==================================================================== the title screen */

  /** Bible section 1. Story writers may override it with G.DATA.strings.contentNote. */
  const CONTENT_NOTE =
    'Low Tide Letters is a gentle game about friendship, guilt and saying sorry. It contains cartoon ' +
    'battles with no blood, some eerie quiet places, and scenes about a friend moving away and a child ' +
    'being unkind to someone she loves.\nNobody dies. It is okay to stop and come back.\n' +
    'Play time is about 75 minutes.';

  const LOGO_SIZE = 52;

  const Title = {
    opaque: true,

    enter: function () {
      K.installHooks();
      G.UI.reset();
      G.Gfx.resetEffects();
      this.t = 0;
      this.phase = 'press';                  // 'press' | 'menu' | 'about'
      this.busy = false;
      this.index = 0;
      this.aboutT = 0;
      this._buildItems();
      G.Gfx.fadeIn(20);
    },

    exit: function () {},

    resume: function (result) {
      // back from the load list or the options pane
      this.busy = false;
      this._buildItems();
      G.Input.reset();
      if (result && result.loaded) this._startLoadedGame();
    },

    _buildItems: function () {
      const has = G.State.hasAnySave();
      this.items = [
        { key: 'new', label: 'New Game', enabled: true },
        { key: 'continue', label: 'Continue', enabled: has },
        { key: 'options', label: 'Options', enabled: true },
        { key: 'about', label: 'About this game', enabled: true },
      ];
      if (!this.items[this.index] || !this.items[this.index].enabled) {
        this.index = this.index === 1 && !has ? 0 : this.index;
      }
    },

    /* ---------------------------------------------------------------- input */

    update: function () {
      this.t++;
      if (this.busy) return;
      if (this.phase === 'press') {
        if (this.t > 6 && G.Input.anyPressed()) {
          G.Audio.unlock();
          K.bgm('bgm_title');
          K.role('confirm');
          this.phase = 'menu';
          this.t = 0;
        }
        return;
      }
      if (this.phase === 'about') {
        this.aboutT++;
        if (this.aboutT > 8 && (G.Input.pressed('confirm') || G.Input.pressed('cancel'))) {
          K.role('cancel');
          this.phase = 'menu';
        }
        return;
      }
      const n = this.items.length;
      if (G.Input.repeated('down') || G.Input.repeated('up')) {
        const d = G.Input.repeated('down') ? 1 : -1;
        this.index = (this.index + d + n) % n;
        K.role('cursor');
      } else if (G.Input.pressed('confirm')) {
        const it = this.items[this.index];
        if (!it.enabled) { K.role('buzzer'); return; }
        K.role('confirm');
        this._pick(it.key);
      }
    },

    _pick: function (key) {
      const self = this;
      if (key === 'about') { this.phase = 'about'; this.aboutT = 0; return; }
      if (key === 'options') { G.Scenes.push('menu', { onlyOptions: true }); return; }
      if (key === 'continue') { G.Scenes.push('save', { mode: 'load' }); return; }
      // new game
      this.busy = true;
      G.Gfx.fadeOut(26).then(function () {
        G.UI.reset();
        G.State.newGame();
        self._enterMap(true);
      });
    },

    _startLoadedGame: function () {
      const self = this;
      this.busy = true;
      G.Gfx.fadeOut(22).then(function () { G.UI.reset(); self._enterMap(false); });
    },

    _enterMap: function (isNew) {
      const m = G.State.map;
      if (!G.Scenes.has('map') || !m.id) {
        G.warn('Title: there is no map to start ("map" scene or G.State.map.id missing)');
        this.busy = false;
        G.Gfx.fadeIn(20);
        return;
      }
      G.Scenes.clearTo('map', { mapId: m.id, x: m.x, y: m.y, dir: m.dir, fade: 'none', newGame: !!isNew });
      G.Gfx.fadeIn(30);
    },

    /* ---------------------------------------------------------------- drawing */

    draw: function (ctx) {
      this._drawBackground(ctx);
      this._drawLogo(ctx, 48, 44);
      if (this.phase === 'press') {
        const a = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.t * 0.06));
        const label = G.str('common.pressAnyKey', 'Press any key');
        ctx.save();
        ctx.globalAlpha *= a;
        G.Gfx.text(label, C.W / 2, 474, { size: 30, font: 'title', align: 'center', color: INK, outline: '#fdf8ea' });
        ctx.restore();
        return;
      }
      this._drawMenu(ctx);
      if (this.phase === 'about') this._drawAbout(ctx);
    },

    _drawBackground: function (ctx) {
      if (K.hasImg('cg_tide_steps')) {
        const b = G.Gfx.boil('title_cg');
        G.Gfx.drawImg('cg_tide_steps', C.W / 2 + b.dx, C.H / 2 + b.dy, {
          w: C.W + 8, h: C.H + 8, anchorX: 0.5, anchorY: 0.5, rot: b.rot * 0.3, scaleX: b.sx, scaleY: b.sy,
        });
        return;
      }
      this._drawFallbackArt(ctx);
    },

    /** A handsome pale sea-and-sand sketch: horizon, water hatching, wet sand, string and two cans. */
    _drawFallbackArt: function (ctx) {
      const horizon = 214;
      const grad = ctx.createLinearGradient(0, 0, 0, horizon);
      grad.addColorStop(0, '#e7eef1');
      grad.addColorStop(1, '#f3eee0');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, C.W, horizon);
      const sea = ctx.createLinearGradient(0, horizon, 0, 360);
      sea.addColorStop(0, '#c3d9d8');
      sea.addColorStop(1, '#dce7dd');
      ctx.fillStyle = sea;
      ctx.fillRect(0, horizon, C.W, 360 - horizon);
      ctx.fillStyle = '#f0e6cc';
      ctx.fillRect(0, 352, C.W, C.H - 352);

      // horizon and a few far waves
      G.Gfx.line(0, horizon, C.W, horizon - 2, { width: 1.6, alpha: 0.55, seed: 21, color: '#8fa8ad' });
      ctx.save();
      ctx.globalAlpha *= 0.5;
      for (let i = 0; i < 16; i++) {
        const y = horizon + 12 + i * 8.4;
        const w = 28 + ((U.noise(90, i) + 1) / 2) * 120;
        const x = ((U.noise(70, i) + 1) / 2) * (C.W - w);
        G.Gfx.line(x, y, x + w, y + 1, { width: 1.4, seed: 100 + i, color: '#7fa0a6' });
        const x2 = ((U.noise(71, i * 3) + 1) / 2) * (C.W - w);
        G.Gfx.line(x2, y + 4, x2 + w * 0.6, y + 4, { width: 1.2, seed: 140 + i, color: '#9dbabd' });
      }
      ctx.restore();

      // wet sand edge + stipple
      G.Gfx.line(-10, 352, C.W + 10, 356, { width: 2, alpha: 0.6, seed: 33, color: '#c9b489' });
      K.sand(ctx, 372, 5);
      K.sand(ctx, 470, 9);

      // two gull ticks
      ctx.save();
      ctx.strokeStyle = '#8b96a0';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      const gull = function (gx, gy, s) {
        ctx.beginPath();
        ctx.moveTo(gx - 9 * s, gy);
        ctx.quadraticCurveTo(gx - 4 * s, gy - 5 * s, gx, gy - 1 * s);
        ctx.quadraticCurveTo(gx + 4 * s, gy - 5 * s, gx + 9 * s, gy);
        ctx.stroke();
      };
      gull(612, 96, 1);
      gull(660, 122, 0.7);
      ctx.restore();

      // the string with a can at each end, lying across the sand
      const x1 = 96, y1 = 500, x2 = 430, y2 = 452;
      G.UI.drawString(ctx, x1 + 10, y1 - 8, x2 - 10, y2 - 6, { sag: 30, seed: 404, width: 1.8, color: '#6b6276' });
      K.can(ctx, x1, y1, { w: 30, rot: -0.5 });
      K.can(ctx, x2, y2, { w: 26, rot: 1.9 });

      // a couple of pebbles
      ctx.save();
      ctx.globalAlpha *= 0.8;
      for (let i = 0; i < 5; i++) {
        K.drawGlassFallback(ctx, 250 + i * 64 + U.noise(3, i) * 20, 528 + U.noise(4, i) * 14,
          i === 2 ? { c: 'blue', t: true } : { pebble: true }, 14 + i);
      }
      ctx.restore();
    },

    /** LOW TIDE LETTERS with the two T's joined by a string, a tin can hanging at each end. */
    _drawLogo: function (ctx, x, y) {
      const text = K.gameTitle().toUpperCase();
      const f = { size: LOGO_SIZE, font: 'title' };
      const w = G.Gfx.measure(text, f).w;
      // a soft paper wash so the letters read over any illustration
      ctx.save();
      ctx.globalAlpha *= 0.62;
      G.Gfx.panel(x - 22, y - 16, w + 48, LOGO_SIZE + 42, { seed: 909, fill: '#fdf8ea', stroke: null });
      ctx.restore();
      G.Gfx.text(text, x, y, Object.assign({ color: INK }, f));
      if (G.Assets.has('ui_logo')) {
        // the T3 emblem (a can, a string of glass, a tide line) sits under the lettering
        const ew = 300, eh = Math.round(ew * 217 / 480);
        G.Gfx.drawImg('ui_logo', x + 8, y + LOGO_SIZE + 26, { w: ew, h: eh, anchorX: 0, anchorY: 0 });
      }

      // find the two T's (bible 9.4); fall back to the first and last letter when there are none
      const tIdx = [];
      for (let i = 0; i < text.length; i++) if (text[i] === 'T') tIdx.push(i);
      const a = tIdx.length >= 2 ? tIdx[0] : 0;
      const b = tIdx.length >= 2 ? tIdx[tIdx.length - 1] : text.length - 1;
      const centre = function (i) {
        return x + G.Gfx.measure(text.slice(0, i), f).w + G.Gfx.measure(text[i], f).w / 2;
      };
      const ax = centre(a), bx = centre(b), ty = y + 4;
      G.UI.drawString(ctx, ax, ty, bx, ty, { sag: 13, seed: 77, width: 2.2, color: '#5d5568' });
      const sway = Math.sin(this.t * 0.03) * 0.08;
      K.can(ctx, ax - 2, ty - 15, { w: 17, rot: -0.35 + sway });
      K.can(ctx, bx + 2, ty - 15, { w: 17, rot: 0.35 + sway });
    },

    /** Four luggage tags hanging from a piece of string on the right. */
    _drawMenu: function (ctx) {
      // the line they hang from: it comes down from the top of the screen past the left of the tags
      const sx = 502, sy = 150, ex = 520, ey = 540;
      G.UI.drawString(ctx, sx, sy, ex, ey, { sag: 0, seed: 55, width: 2.2, color: '#5d5568' });
      const tagW = 196, tagH = 50;
      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i];
        const tx = 528, ty = 226 + i * 70;
        const tieY = ty - 16;
        const tieX = sx + (ex - sx) * U.clamp((tieY - sy) / (ey - sy), 0, 1);
        const sel = i === this.index;
        const swing = Math.sin(this.t * 0.045 + i * 1.3) * (sel ? 0.022 : 0.009);
        ctx.save();
        const hx = tx + 16, hy = ty + 16;
        ctx.translate(hx, hy);
        ctx.rotate(swing);
        ctx.translate(-hx, -hy);
        G.UI.drawTag(ctx, tx, ty, tagW, tagH, {
          color: sel ? C.COLORS.accent : '#9fb0b8',
          label: it.label, size: 25, seed: 600 + i * 7,
          selected: sel, disabled: !it.enabled,
        });
        if (this.phase === 'menu' && !this.busy) {
          const self = this;
          G.UI.pointRow(tx - 26, ty - 4, tagW + 30, tagH + 12, function () {
            if (self.phase !== 'menu' || self.busy || self.index === i) return false;
            self.index = i;
            return true;
          });
        }
        ctx.restore();
        G.UI.drawString(ctx, hx, hy, tieX, tieY, { sag: 2, seed: 300 + i, width: 1.6, color: '#5d5568' });
        if (sel) G.UI.drawCursor(ctx, tx - 22, ty + tagH / 2);
      }
      if (!this.items[1].enabled) {
        G.Gfx.text('(no saved pages yet)', 560, 226 + 70 + 52, { size: 16, color: C.COLORS.inkSoft });
      }
      const I = G.Input;
      G.Gfx.text(I.keysFor('confirm') + ': choose     ' + I.keysFor('cancel') + ': back', C.W - 16, C.H - 12,
        { size: 16, align: 'right', baseline: 'bottom', color: C.COLORS.inkSoft });
    },

    _drawAbout: function (ctx) {
      const note = G.str('contentNote', CONTENT_NOTE);
      const w = 600, x = Math.round((C.W - w) / 2);
      const lay = G.Text.layout(note, { maxWidth: w - 64, size: 22 });
      const h = Math.round(lay.height + 118);
      const y = Math.round((C.H - h) / 2);
      K.dim(ctx, 0.35);
      G.Gfx.panel(x, y, w, h, { seed: 818 });
      G.Gfx.text('About this game', x + 32, y + 22, { size: 30, font: 'title' });
      G.Gfx.line(x + 30, y + 62, x + w - 30, y + 62, { width: 1.6, alpha: 0.5, seed: 819 });
      G.Text.draw(lay, x + 32, y + 76);
      G.Gfx.text('(any key)', x + w - 30, y + h - 34, { size: 17, align: 'right', color: C.COLORS.inkSoft });
    },
  };

  G.Scenes.register('title', Title);
})();
