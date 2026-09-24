/*
 * entities.js - everything that stands ON a map: the player, caterpillar followers and events.
 *
 * A Character owns a tile position (x, y), a smooth interpolated position (px, py, in TILES, fractional
 * while stepping), a facing direction, a sprite spec and an optional move route. Collision is asked from
 * the owning scene (scene.passable(x, y, mover)), so this file stays free of map knowledge.
 *
 * Public:
 *   G.Entities.Character(scene, opts)     base map character
 *   G.Entities.MapEvent(scene, def)       event with pages (TECH_SPEC 4.2)
 *   G.Entities.drawShadow(ctx, x, y, w, seed)
 *   G.Entities.drawEmote(ctx, x, y, kind, t)
 *   G.Entities.EMOTES                     list of the emote symbols the balloon can draw
 *   G.Entities.DELTA / .DIR_ROW / .dirBetween(...) / .opposite(dir)
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CONFIG;
  const U = G.Util;
  const T = C.TILE;

  /** Sprite-sheet row per direction (TECH_SPEC section 8: down, left, right, up). */
  const DIR_ROW = { down: 0, left: 1, right: 2, up: 3 };
  /** Tile delta per direction. */
  const DELTA = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
  /** Column order of the walk cycle: stepA, stand, stepB, stand. */
  const ANIM = [0, 1, 2, 1];
  const EMOTES = ['!', '?', '...', 'heart', 'sweat', 'anger', 'tear', 'note'];

  /** Direction from (x1,y1) toward (x2,y2); the larger axis wins. */
  function dirBetween(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    if (Math.abs(dx) >= Math.abs(dy)) return dx === 0 ? (dy > 0 ? 'down' : 'up') : (dx > 0 ? 'right' : 'left');
    return dy > 0 ? 'down' : 'up';
  }

  /* ====================================================================== sprites */

  /**
   * Normalizes a sprite spec from map data into a draw description.
   * Accepted: {char:'id', dir} | {obj:'id'|'obj_id'} | {enemy:'id'|'en_id'} | null (invisible).
   * @returns {object|null} { kind, img, frameW, frameH, w, h, ox, oy, shadow }
   */
  function makeSprite(spec) {
    if (!spec) return null;
    if (spec.kind && spec.img) return spec;                       // already normalized
    if (spec.char) {
      const id = String(spec.char).indexOf('char_') === 0 ? spec.char : 'char_' + spec.char;
      const m = G.Assets.meta(id);
      const fw = (m.frameW || m.w / 3) / C.SCALE;
      const fh = (m.frameH || m.h / 4) / C.SCALE;
      return { kind: 'char', img: id, frameW: fw, frameH: fh, w: fw, h: fh, ox: 0, oy: 0, shadow: true };
    }
    if (spec.obj) {
      const def = G.DATA.objects[spec.obj] || null;
      let id = def ? def.img : spec.obj;
      if (!G.Assets.has(id) && G.Assets.has('obj_' + id)) id = 'obj_' + id;
      const s = G.Assets.size(id);
      return { kind: 'obj', img: id, w: s.w, h: s.h, ox: def ? (def.ox || 0) : 0, oy: def ? (def.oy || 0) : 0, shadow: false };
    }
    if (spec.enemy) {
      const id = String(spec.enemy).indexOf('en_') === 0 ? spec.enemy : 'en_' + spec.enemy;
      const m = G.Assets.meta(id);
      const s = { w: m.w / C.SCALE, h: m.h / C.SCALE };
      const k = m.mapScale ? m.mapScale : 56 / Math.max(1, s.h);
      return { kind: 'enemy', img: id, w: s.w * k, h: s.h * k, ox: 0, oy: 0, shadow: true, bob: true };
    }
    G.warn('Entities: unknown sprite spec ' + JSON.stringify(spec));
    return null;
  }

  /* ====================================================================== shadow + emotes */

  /**
   * Soft hand-drawn oval shadow under a character (logical pixels, x/y = the feet point).
   * @param {CanvasRenderingContext2D} ctx
   */
  function drawShadow(ctx, x, y, w, seed) {
    const rx = Math.max(7, w * 0.33), ry = Math.max(3, rx * 0.38);
    ctx.save();
    ctx.globalAlpha *= 0.2;
    ctx.fillStyle = '#3a3040';
    ctx.beginPath();
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const j = 1 + U.noise(seed, i % n) * 0.09;
      const px = x + Math.cos(a) * rx * j, py = y - 1 + Math.sin(a) * ry * j;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function balloonPath(ctx, w, h, seed) {
    ctx.beginPath();
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const r = 1 + U.noise(seed, i % n) * 0.06;
      const px = Math.cos(a) * (w / 2) * r, py = Math.sin(a) * (h / 2) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function emoteSymbol(ctx, kind, s) {
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = C.COLORS.ink;
    ctx.fillStyle = C.COLORS.ink;
    switch (kind) {
      case '!':
        ctx.beginPath(); ctx.moveTo(0, -s * 0.52); ctx.lineTo(0.7, s * 0.12); ctx.stroke();
        ctx.beginPath(); ctx.arc(0.6, s * 0.42, 2.6, 0, Math.PI * 2); ctx.fill();
        break;
      case '?':
        ctx.beginPath();
        ctx.moveTo(-s * 0.3, -s * 0.3);
        ctx.quadraticCurveTo(0.3 * s, -s * 0.85, s * 0.26, -s * 0.16);
        ctx.quadraticCurveTo(s * 0.2, s * 0.02, 0, s * 0.14);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(0, s * 0.44, 2.6, 0, Math.PI * 2); ctx.fill();
        break;
      case '...':
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * s * 0.32, s * 0.08, 2.9, 0, Math.PI * 2); ctx.fill(); }
        break;
      case 'heart':
        ctx.fillStyle = '#d8638f';
        ctx.beginPath();
        ctx.moveTo(0, s * 0.46);
        ctx.bezierCurveTo(-s * 0.62, -s * 0.06, -s * 0.34, -s * 0.62, 0, -s * 0.24);
        ctx.bezierCurveTo(s * 0.34, -s * 0.62, s * 0.62, -s * 0.06, 0, s * 0.46);
        ctx.fill(); ctx.lineWidth = 2.2; ctx.stroke();
        break;
      case 'sweat':
      case 'tear':
        ctx.fillStyle = kind === 'tear' ? '#5f9fd8' : '#7cc0e8';
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.5);
        ctx.bezierCurveTo(s * 0.4, s * 0.02, s * 0.3, s * 0.48, 0, s * 0.48);
        ctx.bezierCurveTo(-s * 0.3, s * 0.48, -s * 0.4, s * 0.02, 0, -s * 0.5);
        ctx.fill(); ctx.lineWidth = 2.2; ctx.stroke();
        if (kind === 'tear') { ctx.lineWidth = 2; G.Gfx.line(-s * 0.58, -s * 0.5, -s * 0.2, s * 0.3, { width: 2, seed: 41, alpha: 0.7 }); }
        break;
      case 'anger':
        ctx.strokeStyle = '#cf4a3e';
        ctx.lineWidth = 3.2;
        for (let i = 0; i < 2; i++) {
          const f = i ? -1 : 1;
          ctx.beginPath();
          ctx.moveTo(-s * 0.36 * f, -s * 0.36); ctx.lineTo(-s * 0.06 * f, -s * 0.06);
          ctx.moveTo(-s * 0.4 * f, -s * 0.02); ctx.lineTo(-s * 0.04 * f, -s * 0.4);
          ctx.stroke();
        }
        break;
      case 'note':
        ctx.fillStyle = '#3f72b8'; ctx.strokeStyle = '#3f72b8';
        ctx.beginPath(); ctx.ellipse(-s * 0.16, s * 0.34, s * 0.22, s * 0.16, -0.35, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(s * 0.04, s * 0.32); ctx.lineTo(s * 0.1, -s * 0.46); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 0.46); ctx.quadraticCurveTo(s * 0.48, -s * 0.34, s * 0.3, -s * 0.04); ctx.stroke();
        break;
      default:
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  /**
   * Hand-drawn emote balloon (TECH_SPEC 4.4 `emote`). Pops in, holds, fades out.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x logical x of the balloon tip (the head of the character)
   * @param {number} y logical y of the balloon tip
   * @param {string} kind one of G.Entities.EMOTES
   * @param {number} t age in frames
   */
  function drawEmote(ctx, x, y, kind, t) {
    const life = 76;
    const inK = U.clamp(t / 8, 0, 1);
    const out = U.clamp((life - t) / 10, 0, 1);
    const k = U.ease.outBack(inK) * (0.55 + 0.45 * out);
    const w = 54, h = 42;
    const float = -Math.min(6, t * 0.6) - Math.sin(t * 0.12) * 1.2;
    ctx.save();
    ctx.globalAlpha *= out;
    ctx.translate(x, y - h / 2 - 6 + float);
    ctx.scale(k, k);
    ctx.lineJoin = ctx.lineCap = 'round';
    // tail
    ctx.beginPath();
    ctx.moveTo(-6, h / 2 - 4); ctx.lineTo(-1, h / 2 + 11); ctx.lineTo(7, h / 2 - 5); ctx.closePath();
    ctx.fillStyle = C.COLORS.paper; ctx.fill();
    ctx.strokeStyle = C.COLORS.ink; ctx.lineWidth = 2.4; ctx.stroke();
    // bubble
    const seed = U.hash('emote' + kind) + (Math.floor(G.Gfx.frame / 15) % 4) * 131;
    balloonPath(ctx, w, h, seed);
    ctx.fillStyle = C.COLORS.paper; ctx.fill();
    ctx.lineWidth = 2.6; ctx.strokeStyle = C.COLORS.ink; ctx.stroke();
    ctx.save(); ctx.globalAlpha *= 0.35; ctx.lineWidth = 1.2;
    balloonPath(ctx, w + 2.5, h + 2.5, seed + 7); ctx.stroke();
    ctx.restore();
    emoteSymbol(ctx, kind, 22);
    ctx.restore();
  }

  /* ====================================================================== Character */

  /**
   * A character standing on the map.
   * @param {object} scene the map scene (must provide passable(x,y,mover) and findPath(...))
   * @param {{x,y,dir,speed,sprite,through,above,visible,solid,key}} [opts]
   */
  function Character(scene, opts) {
    opts = opts || {};
    this.scene = scene;
    this.x = opts.x | 0;
    this.y = opts.y | 0;
    this.px = this.x;
    this.py = this.y;
    this.fromX = this.x;
    this.fromY = this.y;
    this.dir = opts.dir || 'down';
    this.speed = opts.speed || 12;
    this.through = !!opts.through;
    this.above = !!opts.above;
    this.visible = opts.visible !== false;
    this.solid = !!opts.solid;
    this.sprite = makeSprite(opts.sprite || null);
    this.seed = U.hash(opts.key || 'char' + this.x + ',' + this.y);
    this.moving = false;
    this.moveT = 0;
    this.moveFrames = 0;
    this.animPhase = 1;
    this.animHalf = false;
    this.steps = 0;
    this.jumpT = 0;
    this.jumpFrames = 0;
    this.bumpT = 0;
    this.bumpDir = 'down';
    this.emote = null;
    this.emoteT = 0;
    this.route = null;
    this.routeIndex = 0;
    this.routeWait = 0;
    this.routeResolve = null;
    this.onStep = null;      // called by the owner when a step starts (step sounds)
    this.onBump = null;
  }

  /** Replaces the sprite (TECH_SPEC `setSprite`). */
  Character.prototype.setSprite = function (spec) {
    this.sprite = makeSprite(spec);
    if (spec && spec.dir) this.dir = spec.dir;
  };

  /** Logical height of the sprite (0 when invisible) - used to place emote balloons. */
  Character.prototype.height = function () {
    return this.sprite ? this.sprite.h : 24;
  };

  /** True while the character slides between two tiles or hops. */
  Character.prototype.isMoving = function () {
    return this.moving || this.jumpT > 0;
  };

  /** True while a forced move route is still running. */
  Character.prototype.isRouting = function () {
    return !!this.route;
  };

  /** Puts the character on a tile immediately (no animation). */
  Character.prototype.place = function (x, y, dir) {
    this.x = this.fromX = x | 0;
    this.y = this.fromY = y | 0;
    this.px = this.x;
    this.py = this.y;
    this.moving = false;
    this.moveT = 0;
    this.jumpT = 0;
    if (dir) this.dir = dir;
  };

  /** Starts a step to an ADJACENT tile without checking collision. */
  Character.prototype.startStep = function (nx, ny, frames) {
    this.fromX = this.x; this.fromY = this.y;
    this.x = nx; this.y = ny;
    this.moving = true;
    this.moveT = 0;
    this.moveFrames = Math.max(1, frames || this.speed);
    this.animPhase = (this.animPhase + 1) % 4;
    this.animHalf = false;
    if (this.onStep) this.onStep(this);
  };

  /**
   * Turns toward `dir` and steps there when the tile is free.
   * @returns {boolean} true when the step started
   */
  Character.prototype.tryStep = function (dir, frames) {
    this.dir = dir;
    const d = DELTA[dir];
    if (!d) return false;
    const nx = this.x + d[0], ny = this.y + d[1];
    if (!this.through && !this.scene.passable(nx, ny, this)) {
      this.bumpT = 8;
      this.bumpDir = dir;
      if (this.onBump) this.onBump(this);
      return false;
    }
    this.startStep(nx, ny, frames);
    return true;
  };

  /** Starts a little hop in place. */
  Character.prototype.hop = function (frames) {
    this.jumpFrames = Math.max(1, frames || 18);
    this.jumpT = this.jumpFrames;
  };

  /** Shows an emote balloon above the character. */
  Character.prototype.showEmote = function (kind) {
    this.emote = EMOTES.indexOf(kind) >= 0 ? kind : '!';
    this.emoteT = 0;
  };

  /**
   * Runs a forced move route (TECH_SPEC 4.4 `move`).
   * @param {Array} steps 'up'|'down'|'left'|'right'|'face_up'...|'jump'|'hide'|'show'|['wait',n]|
   *   ['speed',n]|['to',x,y]
   * @param {{loop?:boolean}} [opts]
   * @returns {Promise<void>} resolves when the route is finished (never, when looping)
   */
  Character.prototype.setRoute = function (steps, opts) {
    const self = this;
    this.clearRoute();
    this.route = (steps || []).slice();
    this.routeLoop = !!(opts && opts.loop);
    this.routeIndex = 0;
    this.routeWait = 0;
    return new Promise(function (resolve) { self.routeResolve = resolve; });
  };

  /** Cancels a running route (its promise resolves). */
  Character.prototype.clearRoute = function () {
    this.route = null;
    this.routeIndex = 0;
    this.routeWait = 0;
    if (this.routeResolve) { const r = this.routeResolve; this.routeResolve = null; r(); }
  };

  Character.prototype._routeStep = function (st) {
    if (typeof st === 'string') {
      if (DELTA[st]) { this.tryStep(st, this.speed); return true; }
      if (st.indexOf('face_') === 0) { this.dir = st.slice(5); return false; }
      if (st === 'jump') { this.hop(); return true; }
      if (st === 'hide') { this.visible = false; return false; }
      if (st === 'show') { this.visible = true; return false; }
      if (st === 'wait') { this.routeWait = 20; return true; }
      G.error('move route: unknown step "' + st + '"');
      return false;
    }
    if (Array.isArray(st)) {
      const name = st[0];
      if (name === 'wait') { this.routeWait = Math.max(0, st[1] | 0); return true; }
      if (name === 'speed') { this.speed = Math.max(1, st[1] | 0); return false; }
      if (name === 'to') {
        const path = this.scene.findPath(this.x, this.y, st[1] | 0, st[2] | 0, this);
        if (!path || !path.length) { G.warn('move route: no path to ' + st[1] + ',' + st[2]); return false; }
        const rest = this.route.slice(this.routeIndex);
        this.route = path.concat(rest);
        this.routeIndex = 0;
        return false;
      }
      if (name === 'face') { this.dir = st[1]; return false; }
      G.error('move route: unknown step "' + name + '"');
      return false;
    }
    return false;
  };

  Character.prototype._updateRoute = function () {
    if (!this.route || this.isMoving()) return;
    if (this.routeWait > 0) { this.routeWait--; return; }
    let guard = 0;
    while (this.route && this.routeIndex < this.route.length && guard++ < 64) {
      const st = this.route[this.routeIndex++];
      if (this._routeStep(st)) return;              // a step that takes time started
    }
    if (this.route && this.routeIndex >= this.route.length) {
      if (this.routeLoop) { this.routeIndex = 0; this.routeWait = 6; return; }
      this.clearRoute();
    }
  };

  /** One fixed step of movement, route, hop, bump and emote timers. */
  Character.prototype.update = function () {
    if (this.moving) {
      this.moveT++;
      const k = Math.min(1, this.moveT / this.moveFrames);
      this.px = U.lerp(this.fromX, this.x, k);
      this.py = U.lerp(this.fromY, this.y, k);
      if (!this.animHalf && k >= 0.5) { this.animHalf = true; this.animPhase = (this.animPhase + 1) % 4; }
      if (k >= 1) {
        this.moving = false;
        this.px = this.x; this.py = this.y;
        this.steps++;
      }
    }
    if (this.jumpT > 0) this.jumpT--;
    if (this.bumpT > 0) this.bumpT--;
    if (this.emote) { this.emoteT++; if (this.emoteT > 76) this.emote = null; }
    this._updateRoute();
  };

  /** Screen x of the character's feet (logical px) for a camera at cam.x/cam.y. */
  Character.prototype.screenX = function (cam) {
    let x = this.px * T + T / 2 - cam.x;
    if (this.bumpT > 0) x += (DELTA[this.bumpDir][0] || 0) * Math.sin(this.bumpT / 8 * Math.PI) * 3;
    return x;
  };

  /** Screen y of the character's feet (logical px). */
  Character.prototype.screenY = function (cam) {
    let y = this.py * T + T - cam.y;
    if (this.bumpT > 0) y += (DELTA[this.bumpDir][1] || 0) * Math.sin(this.bumpT / 8 * Math.PI) * 3;
    return y;
  };

  /** Sort key for y-sorting against objects (bottom edge of the occupied tile). */
  Character.prototype.sortY = function () {
    return this.py * T + T;
  };

  /** Draws the character (and its shadow) at the given camera offset. */
  Character.prototype.draw = function (ctx, cam) {
    const s = this.sprite;
    if (!s || !this.visible) return;
    const q = C.SCALE;
    const x = Math.round(this.screenX(cam) * q) / q;
    const yFeet = Math.round(this.screenY(cam) * q) / q;
    let y = yFeet;
    if (this.jumpT > 0) y -= Math.sin((1 - this.jumpT / this.jumpFrames) * Math.PI) * 16;
    if (s.kind === 'char') {
      if (s.shadow) drawShadow(ctx, x, yFeet, s.w * 0.5, this.seed);
      G.Gfx.drawFrame(s.img, ANIM[this.animPhase], DIR_ROW[this.dir] || 0, x, y, {
        anchorX: 0.5, anchorY: 1, frameW: s.frameW, frameH: s.frameH,
      });
      return;
    }
    if (s.kind === 'enemy') {
      const b = G.Gfx.boil(this.seed);
      const bob = Math.sin((G.Gfx.frame + (this.seed % 60)) * 0.06) * 2.2;
      drawShadow(ctx, x, yFeet, s.w * 0.55, this.seed);
      G.Gfx.drawImg(s.img, x + b.dx, y + bob - 1, {
        w: s.w, h: s.h, anchorX: 0.5, anchorY: 1, rot: b.rot, scaleX: b.sx, scaleY: b.sy,
      });
      return;
    }
    G.Gfx.drawImg(s.img, x + (s.ox || 0), y + (s.oy || 0), { w: s.w, h: s.h, anchorX: 0.5, anchorY: 1 });
  };

  /** Draws the emote balloon (called after every sprite, so balloons stay on top). */
  Character.prototype.drawEmote = function (ctx, cam) {
    if (!this.emote) return;
    const x = this.screenX(cam);
    const y = this.screenY(cam) - this.height();
    drawEmote(ctx, x, y, this.emote, this.emoteT);
  };

  /* ====================================================================== MapEvent */

  function mergeCond(a, b) {
    if (!a) return b;
    if (!b) return a;
    return { all: [a, b] };
  }

  /**
   * Expands the roaming-enemy sugar of TECH_SPEC 4.2 into a normal touch page.
   * respawn:true  -> the event is erased until the map is re-entered.
   * respawn:false -> the self flag '_beaten' is set, so it never comes back.
   */
  function enemyPages(def) {
    const e = def.enemy || {};
    const forever = e.respawn === false;
    const after = forever ? [['setSelf', '_beaten', true], ['erase', def.id]] : [['erase', def.id]];
    const opts = {
      canEscape: e.canEscape !== false, bgm: e.bgm || null, back: e.back || null,
      onWin: after, onPeace: after, onEscape: e.onEscape || [], onLose: e.onLose || 'gameover',
    };
    return [{
      cond: mergeCond(e.cond || null, forever ? { notSelf: '_beaten' } : null),
      sprite: { enemy: e.sprite || def.id },
      solid: e.solid != null ? e.solid : false,
      trigger: 'touch',
      move: e.move || { type: 'wander', radius: 3 },
      through: !!e.through,
      commands: [['battle', e.troop, opts]],
    }];
  }

  /**
   * A map event: a character driven by pages (TECH_SPEC 4.2). The LAST page whose condition is true wins.
   * @param {object} scene map scene
   * @param {object} def event definition from the map file
   */
  function MapEvent(scene, def) {
    Character.call(this, scene, { x: def.x, y: def.y, key: 'ev:' + def.id, visible: false });
    this.def = def;
    this.id = def.id;
    this.homeX = def.x | 0;
    this.homeY = def.y | 0;
    this.pages = def.enemy ? enemyPages(def) : (def.pages || []);
    this.pageIndex = -1;
    this.page = null;
    this.trigger = null;
    this.moveDef = { type: 'still' };
    this.facePlayer = true;
    this.erased = false;
    this.running = false;
    this.autoDone = false;
    this.aiWait = U.randInt(20, 70);
    this.refresh();
  }
  MapEvent.prototype = Object.create(Character.prototype);
  MapEvent.prototype.constructor = MapEvent;

  /** Re-evaluates the page conditions. Call after any flag/var/item/party change. */
  MapEvent.prototype.refresh = function () {
    if (this.erased) {
      this.visible = false; this.solid = false; this.trigger = null; this.page = null;
      return;
    }
    const ctx = { mapId: this.scene ? this.scene.mapId : G.State.map.id, eventId: this.id };
    let idx = -1;
    for (let i = 0; i < this.pages.length; i++) {
      if (G.Cond.evaluate(this.pages[i].cond, ctx)) idx = i;
    }
    if (idx === this.pageIndex) return;
    this.pageIndex = idx;
    this.page = idx >= 0 ? this.pages[idx] : null;
    this.autoDone = false;
    this.clearRoute();
    const p = this.page;
    if (!p) {
      this.visible = false; this.solid = false; this.trigger = null; this.setSprite(null);
      return;
    }
    this.setSprite(p.sprite || null);
    this.visible = !!p.sprite;
    this.solid = p.solid != null ? !!p.solid : !!p.sprite;
    this.trigger = p.trigger || 'action';
    this.through = !!p.through;
    this.above = !!p.above;
    this.facePlayer = p.facePlayer !== false;
    this.moveDef = p.move || { type: 'still' };
    this.speed = this.moveDef.speed || 16;
  };

  /** Removes the event until the map is re-entered (TECH_SPEC `erase`). */
  MapEvent.prototype.erase = function () {
    this.erased = true;
    this.running = false;
    this.clearRoute();
    this.visible = false;
    this.solid = false;
    this.trigger = null;
  };

  /** The command list of the active page (or null). */
  MapEvent.prototype.commands = function () {
    return this.page && this.page.commands ? this.page.commands : null;
  };

  /** Autonomous movement (still / wander / patrol / chase / flee). */
  MapEvent.prototype.updateAI = function (player) {
    if (this.erased || !this.page || this.running || this.isMoving() || this.route) return;
    const m = this.moveDef || { type: 'still' };
    if (!m.type || m.type === 'still') return;
    if (this.aiWait > 0) { this.aiWait--; return; }
    const dist = Math.abs(player.x - this.x) + Math.abs(player.y - this.y);
    if (m.type === 'wander') {
      const r = m.radius == null ? 3 : m.radius;
      const dirs = ['up', 'down', 'left', 'right'];
      const d = U.choice(dirs);
      const dd = DELTA[d];
      if (Math.abs(this.homeX - (this.x + dd[0])) <= r && Math.abs(this.homeY - (this.y + dd[1])) <= r) {
        this.tryStep(d, this.speed);
      } else {
        this.dir = d;
      }
      this.aiWait = U.randInt(28, 80);
      return;
    }
    if (m.type === 'patrol') {
      const route = m.route || [];
      if (!route.length) return;
      this.patrolIndex = (this.patrolIndex || 0) % route.length;
      const target = route[this.patrolIndex];
      if (this.x === (target[0] | 0) && this.y === (target[1] | 0)) {
        this.patrolIndex = (this.patrolIndex + 1) % route.length;
        this.aiWait = m.pause == null ? 24 : m.pause;
        return;
      }
      const path = this.scene.findPath(this.x, this.y, target[0] | 0, target[1] | 0, this);
      if (path && path.length) this.tryStep(path[0], this.speed);
      else { this.patrolIndex = (this.patrolIndex + 1) % route.length; this.aiWait = 30; }
      return;
    }
    if (m.type === 'chase' || m.type === 'flee') {
      const sight = m.sight == null ? 5 : m.sight;
      if (dist > sight) { this.aiWait = 12; return; }
      let d = dirBetween(this.x, this.y, player.x, player.y);
      if (m.type === 'flee') d = OPPOSITE[d];
      if (!this.tryStep(d, this.speed)) {
        const alt = (d === 'up' || d === 'down') ? (player.x > this.x ? 'right' : 'left') : (player.y > this.y ? 'down' : 'up');
        this.tryStep(m.type === 'flee' ? OPPOSITE[alt] : alt, this.speed);
      }
      this.aiWait = m.pause == null ? 4 : m.pause;
    }
  };

  /* ====================================================================== module */

  G.Entities = {
    Character: Character,
    MapEvent: MapEvent,
    DIR_ROW: DIR_ROW,
    DELTA: DELTA,
    ANIM: ANIM,
    EMOTES: EMOTES,
    opposite: function (dir) { return OPPOSITE[dir] || 'down'; },
    dirBetween: dirBetween,
    makeSprite: makeSprite,
    drawShadow: drawShadow,
    drawEmote: drawEmote,
  };
})();
