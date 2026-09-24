/*
 * map_scene.js - the 'map' scene: ground rendering (cached chunks + hand-drawn terrain borders),
 * objects with y-sorting, the player with caterpillar followers, events and their triggers, the camera,
 * transfers and the debug overlay. See TECH_SPEC 4.1 - 4.4.
 *
 * Ground is drawn by tiling each terrain texture world-aligned (tile (tx,ty) samples source
 * ((tx*96)%imgW, (ty*96)%imgH)) into 8x8-tile canvases that are cached with an LRU. Where two terrains
 * meet, the one with the higher `edge` value draws a wobbly pencil line in its `edgeColor` into that same
 * cache, so the ground looks outlined by hand instead of blocky.
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CONFIG;
  const U = G.Util;
  const E = G.Entities;
  const T = C.TILE;
  const SRC = T * C.SCALE;          // 96 real px of source texture per tile
  const CHUNK = 8;                  // tiles per cached chunk
  const CHUNK_PX = CHUNK * T;
  const CHUNK_CAP = 40;             // LRU capacity (a screen needs at most 3x3)

  // one entry per tile side: d = neighbour delta, a/b = the two corners of the shared edge (in tile
  // fractions), n = unit normal pointing INTO the tile (the line is drawn just inside the owner)
  const SIDES = [
    { d: [0, -1], a: [0, 0], b: [1, 0], n: [0, 1] },     // up
    { d: [1, 0], a: [1, 0], b: [1, 1], n: [-1, 0] },     // right
    { d: [0, 1], a: [0, 1], b: [1, 1], n: [0, -1] },     // down
    { d: [-1, 0], a: [0, 0], b: [0, 1], n: [1, 0] },     // left
  ];

  const VOID = { id: 'void', img: null, passable: false, edge: 0, edgeColor: null, step: null };

  const warned = {};
  function terrainDef(id) {
    if (!id) return VOID;
    const d = G.DATA.terrains[id];
    if (d) return d;
    if (!warned['t' + id]) { warned['t' + id] = 1; G.warn('Map: unknown terrain "' + id + '"'); }
    return VOID;
  }

  function objectDef(id) {
    const d = G.DATA.objects[id];
    if (d) return d;
    if (!warned['o' + id]) { warned['o' + id] = 1; G.warn('Map: unknown object "' + id + '"'); }
    return null;
  }

  /** Footprint rectangles of an object definition, normalized to a list of [dx,dy,w,h]. */
  function footprints(def) {
    const fp = def.fp || [0, 0, 1, 1];
    return Array.isArray(fp[0]) ? fp : [fp];
  }

  /** The char_ sheet id for a party member (falls back to any character sheet in the manifest). */
  function actorSprite(actor) {
    const d = (G.DATA.actors && G.DATA.actors[actor.id]) || {};
    const tries = [d.sprite, d.char, d.mapSprite, actor.id];
    for (const t of tries) {
      if (!t) continue;
      const id = String(t).indexOf('char_') === 0 ? String(t) : 'char_' + t;
      if (G.Assets.has(id)) return id;
    }
    const any = G.Assets.ids('char_');
    return any.length ? any[0] : 'char_test';
  }

  /* ====================================================================== the scene */

  const MapScene = {
    opaque: true,
    mapId: null,
    def: null,
    w: 0,
    h: 0,
    generation: 0,

    /* ---------------------------------------------------------------- lifecycle */

    /** Scene interface: enters (or re-enters) a map. params {mapId,x,y,dir,fade,newGame}. */
    enter: function (params) {
      params = params || {};
      G.Interpreter.scene = this;
      G.Interpreter.reset();
      this.chunks = this.chunks || new Map();
      this.cam = this.cam || { x: 0, y: 0 };
      this._sortBuf = this._sortBuf || [];
      this.cg = null; this.cgAlpha = 0; this.cgTo = 0; this.cgFrames = 0;
      this.camTarget = null; this.camFrames = 0;
      this.transferring = false;
      this.stepSound = 0;
      this.pagesRev = -1;
      const s = G.State.map;
      const id = params.mapId || s.id;
      const x = params.x != null ? params.x : s.x;
      const y = params.y != null ? params.y : s.y;
      const dir = params.dir || s.dir || 'down';
      if (!id) { G.error('Map scene: no map to enter (G.State.map.id is empty)'); return; }
      const fade = params.fade || 'none';
      if (fade !== 'none') G.Gfx.setFade(1, fade === 'white' ? '#fff' : fade);
      this._enterMap(id, x, y, dir, { fade: fade, keepBgm: false });
    },

    exit: function () {
      G.Interpreter.scene = null;
      G.Interpreter.reset();
    },

    pause: function () {},

    /** Scene interface: a menu/battle above us was popped. */
    resume: function () {
      G.Input.reset();
      this.pagesRev = -1;
    },

    /* ---------------------------------------------------------------- map loading */

    async _enterMap(id, x, y, dir, opts) {
      const def = G.DATA.maps[id];
      if (!def) { G.error('Map scene: unknown map "' + id + '"'); return; }
      this.generation++;
      const gen = this.generation;
      this.mapId = id;
      this.def = def;
      this.w = def.width | 0;
      this.h = def.height | 0;
      this.seed = U.hash('map:' + id);
      this.chunks.clear();
      this._buildGrid(def);
      this._buildObjects(def);
      this._buildCollision(def);
      this.events = (def.events || []).map(function (d) { return new E.MapEvent(MapScene, d); }, this);
      this._makeParty(x, y, dir);
      G.State.map = { id: id, x: x | 0, y: y | 0, dir: dir };
      this.camTarget = null;
      this.camFrames = 0;
      this.cam.x = 0; this.cam.y = 0;
      this._updateCamera(true);
      this.pagesRev = G.State.rev;
      // music, ambience, ambient tint
      if (def.bgm !== undefined && def.bgm !== null) {
        if (def.bgm === 'none') G.Audio.stopBgm(600); else G.Audio.playBgm(def.bgm);
      }
      if (def.ambience !== undefined) {
        if (!def.ambience || def.ambience === 'none') G.Audio.stopAmbience();
        else G.Audio.playAmbience(def.ambience);
      }
      G.Gfx.setTint(def.tint || null, 0);
      if (def.name && !def.hideName) G.UI.Toast.show(def.name, { title: true, frames: 130 });
      if (opts.fade && opts.fade !== 'none') await G.Gfx.fadeIn(24);
      if (gen !== this.generation) return;
      this.transferring = false;
      if (def.onEnter && def.onEnter.length) {
        await G.Interpreter.run(def.onEnter, { mapId: id, main: true });
      }
    },

    _buildGrid: function (def) {
      const w = this.w, h = this.h;
      const legend = def.legend || {};
      this.terrs = [];
      const index = {};
      const grid = this.grid = new Int16Array(w * h);
      const rows = def.ground || [];
      if (rows.length !== h) G.error('Map "' + def.id + '": ground has ' + rows.length + ' rows, expected ' + h);
      for (let y = 0; y < h; y++) {
        const row = rows[y] || '';
        if (row.length !== w) G.error('Map "' + def.id + '": ground row ' + y + ' is ' + row.length + ' chars, expected ' + w);
        for (let x = 0; x < w; x++) {
          const ch = row.charAt(x) || ' ';
          const tid = legend[ch];
          if (tid === undefined && !warned['l' + def.id + ch]) {
            warned['l' + def.id + ch] = 1;
            G.warn('Map "' + def.id + '": legend has no entry for "' + ch + '"');
          }
          const d = terrainDef(tid);
          let i = index[d.id || tid || 'void'];
          if (i === undefined) { i = this.terrs.length; index[d.id || tid || 'void'] = i; this.terrs.push(d); }
          grid[y * w + x] = i;
        }
      }
    },

    _buildObjects: function (def) {
      this.objects = { below: [], sort: [], above: [] };
      this.counters = {};
      const list = def.objects || [];
      for (const o of list) {
        const d = objectDef(o.obj);
        if (!d) continue;
        const img = d.img;
        const size = G.Assets.size(img);
        const entry = {
          obj: true, def: d, img: img, tx: o.x | 0, ty: o.y | 0, flipX: !!o.flipX,
          w: size.w, h: size.h,
          px: (o.x | 0) * T + T / 2 + (d.ox || 0) + (o.ox || 0),
          py: (o.y | 0) * T + T + (d.oy || 0) + (o.oy || 0),
          sortY: ((o.y | 0) + 1) * T + (d.sortBias || 0),
          anim: d.anim || null, phase: ((o.x | 0) * 7 + (o.y | 0) * 13) % 60,
        };
        const layer = d.layer || 'sort';
        (this.objects[layer] || this.objects.sort).push(entry);
        if (d.counter) {
          for (const r of footprints(d)) {
            for (let dy = 0; dy < (r[3] | 0 || 1); dy++) {
              for (let dx = 0; dx < (r[2] | 0 || 1); dx++) {
                this.counters[(entry.tx + (r[0] | 0) + dx) + ',' + (entry.ty + (r[1] | 0) + dy)] = true;
              }
            }
          }
        }
      }
      this.objects.sort.sort(function (a, b) { return a.sortY - b.sortY; });
    },

    _buildCollision: function (def) {
      const w = this.w, h = this.h;
      const coll = this.coll = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const t = this.terrs[this.grid[y * w + x]];
          if (!t || t.passable === false) coll[y * w + x] = 1;
        }
      }
      const block = function (x, y) { if (x >= 0 && y >= 0 && x < w && y < h) coll[y * w + x] = 1; };
      for (const layer of ['below', 'sort', 'above']) {
        for (const o of this.objects[layer]) {
          if (!o.def.solid) continue;
          for (const r of footprints(o.def)) {
            const rw = (r[2] | 0) || 1, rh = (r[3] | 0) || 1;
            for (let dy = 0; dy < rh; dy++) for (let dx = 0; dx < rw; dx++) block(o.tx + (r[0] | 0) + dx, o.ty + (r[1] | 0) + dy);
          }
        }
      }
      const ov = def.overrides || {};
      for (const p of ov.block || []) block(p[0], p[1]);
      for (const p of ov.open || []) { if (p[0] >= 0 && p[1] >= 0 && p[0] < w && p[1] < h) coll[p[1] * w + p[0]] = 0; }
      this._bfsSeen = new Int32Array(w * h);
      this._bfsStamp = 0;
      this._bfsQueue = new Int32Array(w * h);
      this._bfsFrom = new Int32Array(w * h);
    },

    _makeParty: function (x, y, dir) {
      const party = G.State.party;
      const lead = party[0] || { id: 'player', name: 'player' };
      this.walkGoal = null;
      if (!this.player) this.player = new E.Character(this, { x: x, y: y, dir: dir, key: 'player' });
      this.player.setSprite({ char: actorSprite(lead) });
      this.player.place(x, y, dir);
      this.player.speed = 12;
      const self = this;
      // every player step - from input OR from a forced move route - drags the followers along
      this.player.onStep = function (p) { self._afterPlayerStep(p.moveFrames); };
      this.player.onBump = function () {
        if (self.bumpCool > 0) return;
        self.bumpCool = 14;
        G.Audio.playSfx('sfx_knock', { volume: 0.18, rate: 1.2 });
      };
      this.bumpCool = 0;
      this.followers = [];
      for (let i = 1; i < party.length; i++) {
        const f = new E.Character(this, { x: x, y: y, dir: dir, key: 'follower' + i, sprite: { char: actorSprite(party[i]) } });
        f.speed = 12;
        this.followers.push(f);
      }
    },

    /* ---------------------------------------------------------------- queries */

    /** Terrain definition at a tile (VOID outside the map). */
    terrainAt: function (x, y) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
      return this.terrs[this.grid[y * this.w + x]] || VOID;
    },

    /** True when `mover` may stand on this tile (terrain, objects, overrides, solid events). */
    passable: function (x, y, mover) {
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
      if (this.coll[y * this.w + x]) return false;
      for (const ev of this.events) {
        if (ev !== mover && ev.solid && !ev.erased && ev.x === x && ev.y === y) return false;
      }
      if (mover !== this.player && this.player && !this.player.through && this.player.x === x && this.player.y === y) return false;
      return true;
    },

    /** The event with this id (or null). */
    event: function (id) {
      for (const ev of this.events) if (ev.id === id) return ev;
      return null;
    },

    /** True when the tile is covered by an object flagged `counter:true` (talk across it). */
    isCounter: function (x, y) {
      return !!this.counters[x + ',' + y];
    },

    /**
     * Breadth-first path on the collision grid.
     * @returns {string[]|null} list of directions, or null when the target cannot be reached
     */
    findPath: function (x0, y0, x1, y1, mover) {
      if (x0 === x1 && y0 === y1) return [];
      const w = this.w, h = this.h;
      if (x1 < 0 || y1 < 0 || x1 >= w || y1 >= h) return null;
      const seen = this._bfsSeen, q = this._bfsQueue, from = this._bfsFrom;
      const stamp = ++this._bfsStamp;
      let head = 0, tail = 0;
      const start = y0 * w + x0;
      seen[start] = stamp; from[start] = -1;
      q[tail++] = start;
      const goal = y1 * w + x1;
      const dxs = [0, 1, 0, -1], dys = [-1, 0, 1, 0];
      const names = ['up', 'right', 'down', 'left'];
      let found = false;
      while (head < tail) {
        const cur = q[head++];
        if (cur === goal) { found = true; break; }
        const cx = cur % w, cy = (cur / w) | 0;
        for (let i = 0; i < 4; i++) {
          const nx = cx + dxs[i], ny = cy + dys[i];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (seen[ni] === stamp) continue;
          if (!this.passable(nx, ny, mover)) continue;
          seen[ni] = stamp;
          from[ni] = cur * 4 + i;
          q[tail++] = ni;
        }
      }
      if (!found) return null;
      const out = [];
      let cur = goal;
      while (cur !== start) {
        const rec = from[cur];
        if (rec < 0) return null;
        out.push(names[rec % 4]);
        cur = (rec / 4) | 0;
      }
      out.reverse();
      return out;
    },

    /** Test/debug info (window.__game.mapInfo). */
    mapInfo: function () {
      return {
        id: this.mapId,
        w: this.w,
        h: this.h,
        player: { x: this.player.x, y: this.player.y, dir: this.player.dir },
        events: this.events.map(function (e) {
          return { id: e.id, x: e.x, y: e.y, page: e.pageIndex < 0 ? null : e.pageIndex, erased: e.erased };
        }),
      };
    },

    /** Runs a command list on this map (used by window.__game.run). */
    run: function (commands, ctx) {
      return G.Interpreter.run(commands, ctx || { mapId: this.mapId });
    },

    /* ---------------------------------------------------------------- transfer */

    /**
     * Moves the party to another map (TECH_SPEC `transfer`).
     * @returns {Promise<void>} resolves once the new map is faded in and its onEnter list has run
     */
    async transfer(mapId, x, y, dir, opts) {
      opts = opts || {};
      if (!G.DATA.maps[mapId]) { G.error('transfer: unknown map "' + mapId + '"'); return; }
      const fade = opts.fade === undefined ? 'black' : opts.fade;
      this.transferring = true;
      G.Input.reset();
      if (fade !== 'none') await G.Gfx.fadeOut(opts.frames || 22, fade === 'white' ? '#fff' : 'black');
      await this._enterMap(mapId, x | 0, y | 0, dir || 'down', { fade: fade });
      this.transferring = false;
    },

    /** window.__game.teleport hook. */
    teleport: function (mapId, x, y, dir, opts) {
      return this.transfer(mapId, x, y, dir, Object.assign({ fade: 'none' }, opts || {}));
    },

    /** Shows or hides a full-screen CG above the map (TECH_SPEC `cg`). */
    setCg: function (id, frames) {
      const self = this;
      frames = Math.max(0, frames | 0);
      if (id) { this.cg = id; this.cgTo = 1; } else { this.cgTo = 0; }
      this.cgFrom = this.cgAlpha;
      this.cgT = 0;
      this.cgFrames = frames;
      if (!frames) { this.cgAlpha = this.cgTo; if (!id) this.cg = null; return Promise.resolve(); }
      return U.waitFrames(frames).then(function () { if (!self.cgTo) self.cg = null; });
    },

    /** Pans the camera to a character, a fixed tile ({x,y}) or back to the player (null). */
    cameraTo: function (targetOrTile, frames) {
      this.camTarget = targetOrTile || null;
      this.camFrom = { x: this.cam.x, y: this.cam.y };
      this.camFrames = Math.max(0, frames | 0);
      this.camT = 0;
    },

    /* ---------------------------------------------------------------- update */

    update: function () {
      this.frame = (this.frame || 0) + 1;
      if (!this.def) return;
      if (this.bumpCool > 0) this.bumpCool--;
      if (this.pagesRev !== G.State.rev) { this.pagesRev = G.State.rev; this.refreshEvents(); }
      const busy = G.Interpreter.isBusy() || this.transferring || G.UI.isModal();
      if (busy && this.walkGoal) this._stopWalk();     // a cutscene or a touch tile stops a pointer walk
      if (!busy) this._input();
      this.player.update();
      for (const f of this.followers) f.update();
      for (const ev of this.events) {
        ev.update();
        if (!busy) ev.updateAI(this.player);
      }
      if (!busy) this._triggers();
      this._updateCamera(false);
      if (this.cgFrames > 0) {
        this.cgT++;
        const k = Math.min(1, this.cgT / this.cgFrames);
        this.cgAlpha = U.lerp(this.cgFrom, this.cgTo, k);
        if (k >= 1) { this.cgFrames = 0; if (!this.cgTo) this.cg = null; }
      }
    },

    /** Re-evaluates every event page (after a flag/var/item/party change). */
    refreshEvents: function () {
      for (const ev of this.events) ev.refresh();
    },

    _input: function () {
      const p = this.player;
      if (G.Input.pressed('menu') || G.Input.pressed('cancel')) {
        this._stopWalk();
        if (G.Scenes.has('menu')) {
          G.UI.sfx('menuOpen');
          G.Scenes.push('menu', {});
        }
        return;
      }
      if (this.walkGoal && (G.Input.dir4() || G.Input.pressed('confirm'))) this._stopWalk();   // any key takes over
      if (p.isMoving() || p.isRouting()) return;
      if (this.walkGoal) { this._walkStep(); return; }
      if (G.Input.pressed('confirm')) { this._action(); return; }
      const d = G.Input.dir4();
      if (!d) { this.bumpHeld = null; return; }
      const frames = G.Input.isDown('run') ? 7 : 12;
      const delta = E.DELTA[d];
      const tx = p.x + delta[0], ty = p.y + delta[1];
      if (p.tryStep(d, frames)) {           // a successful step calls _afterPlayerStep through onStep
        this.bumpHeld = null;
      } else {
        // a solid touch event fires once per push: holding the key into it does not replay its scene
        const ev = this._eventAt(tx, ty, 'touch');
        if (ev && this.bumpHeld !== ev) { this.bumpHeld = ev; this.startEvent(ev, 'touch'); }
      }
    },

    _afterPlayerStep: function (frames) {
      const p = this.player;
      // caterpillar: every follower takes the tile the one ahead has just left
      let ax = p.fromX, ay = p.fromY;
      for (const f of this.followers) {
        const nx = ax, ny = ay;
        ax = f.x; ay = f.y;
        if (f.x === nx && f.y === ny) continue;
        if (Math.abs(f.x - nx) + Math.abs(f.y - ny) !== 1) { f.place(nx, ny, f.dir); continue; }
        f.dir = E.dirBetween(f.x, f.y, nx, ny);
        f.startStep(nx, ny, frames);
      }
      G.State.map = { id: this.mapId, x: p.x, y: p.y, dir: p.dir };
      this.stepSound++;
      if (this.stepSound % 2 === 0) {
        const t = this.terrainAt(p.x, p.y);
        if (t && t.step) G.Audio.playSfx(t.step, { volume: 0.16, rate: 0.95 + Math.random() * 0.12 });
      }
    },

    /* ---------------------------------------------------------------- pointer walking */

    /**
     * A right-click on the map (G.Pointer): walk Wren to the tile under (sx, sy) in logical screen px.
     * A tile that cannot be stood on (a person, a counter, a prop) is walked up to instead and, on
     * arrival, faced and talked to. Wren's own tile is Confirm: she talks to whatever she is facing.
     * The walk is stepped from _input, so it behaves exactly like holding an arrow key: touch tiles
     * fire, an event that starts ends it, and a key press takes over.
     * @returns {boolean} true when the click was taken
     */
    pointerWalk: function (sx, sy) {
      if (!this.def || !this.player) return false;
      if (G.Interpreter.isBusy() || this.transferring || G.UI.isModal()) return false;
      const p = this.player;
      const tx = Math.floor((sx + this.cam.x) / T), ty = Math.floor((sy + this.cam.y) / T);
      if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h) return false;
      this._stopWalk();
      if (tx === p.x && ty === p.y) {
        if (!p.isMoving() && !p.isRouting()) this._action();
        return true;
      }
      const plan = this._planWalk(tx, ty);
      if (!plan) return true;                          // nowhere to go: the click is still ours, nothing happens
      this.walkGoal = { x: tx, y: ty, act: plan.act, path: plan.path, t: 0, replans: 0 };
      return true;
    },

    /** Path to (tx,ty), or next to it when it cannot be stood on. @returns {{path:string[],act:boolean}|null} */
    _planWalk: function (tx, ty) {
      const p = this.player;
      const path = this.findPath(p.x, p.y, tx, ty, p);
      if (path) return { path: path, act: false };
      // walk up next to it: the nearest reachable neighbour (or, across a counter, one tile further)
      let best = null;
      const near = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      for (const d of near) {
        for (let k = 1; k <= 2; k++) {
          const nx = tx + d[0] * k, ny = ty + d[1] * k;
          if (k === 2 && !this.isCounter(tx + d[0], ty + d[1])) break;
          const q = (nx === p.x && ny === p.y) ? [] : this.findPath(p.x, p.y, nx, ny, p);
          if (q && (!best || q.length < best.length)) best = q;
        }
      }
      return best ? { path: best, act: true } : null;
    },

    /** One step of a pointer walk (called from _input when Wren stands still). */
    _walkStep: function () {
      const g = this.walkGoal, p = this.player;
      if (!g.path.length) { this._arrived(); return; }
      const d = g.path.shift();
      const delta = E.DELTA[d];
      const tx = p.x + delta[0], ty = p.y + delta[1];
      if (p.tryStep(d, G.Input.isDown('run') ? 7 : 12)) return;
      const ev = this._eventAt(tx, ty, 'touch');      // a solid touch event in the way (a roaming Unsent, a gate)
      if (ev) { this._stopWalk(); this.startEvent(ev, 'touch'); return; }
      // somebody wandered into the way: path round them, giving up after a few tries
      if (++g.replans > 4) { this._stopWalk(); return; }
      const plan = this._planWalk(g.x, g.y);
      if (!plan) { this._stopWalk(); return; }
      g.path = plan.path; g.act = plan.act;
    },

    _stopWalk: function () {
      this.walkGoal = null;
    },

    /** The pointer walk has reached its tile (or the tile beside the thing that was clicked). */
    _arrived: function () {
      const g = this.walkGoal;
      this.walkGoal = null;
      if (!g || !g.act) return;
      const p = this.player;
      if (Math.abs(g.x - p.x) + Math.abs(g.y - p.y) > 2) return;    // never got there
      p.dir = E.dirBetween(p.x, p.y, g.x, g.y);
      this._action();
    },

    _eventAt: function (x, y, trigger) {
      for (const ev of this.events) {
        if (ev.erased || !ev.page || ev.x !== x || ev.y !== y) continue;
        if (trigger && ev.trigger !== trigger) continue;
        if (!ev.commands() || !ev.commands().length) continue;
        return ev;
      }
      return null;
    },

    _action: function () {
      const p = this.player;
      const d = E.DELTA[p.dir];
      let ev = this._eventAt(p.x, p.y, 'action');
      if (!ev) {
        const tx = p.x + d[0], ty = p.y + d[1];
        ev = this._eventAt(tx, ty, 'action');
        if (!ev && this.isCounter(tx, ty)) ev = this._eventAt(tx + d[0], ty + d[1], 'action');
      }
      if (ev) this.startEvent(ev, 'action');
    },

    _triggers: function () {
      const p = this.player;
      for (const ev of this.events) {
        if (ev.erased || !ev.page || ev.running) continue;
        const cmds = ev.commands();
        if (!cmds || !cmds.length) continue;
        if (ev.trigger === 'parallel') {
          if (ev.parallelWait > 0) { ev.parallelWait--; continue; }
          this.startEvent(ev, 'parallel');
          continue;
        }
        if (ev.trigger === 'auto' && !ev.autoDone) {
          if (this.startEvent(ev, 'auto')) { ev.autoDone = true; return; }
          continue;
        }
        // a passable touch tile fires once per arrival: standing still on it after its scene has played
        // must not run it again (a locked-door message would loop forever)
        const key = p.steps + ':' + ev.x + ',' + ev.y;
        if (ev.trigger === 'touch' && ev.x === p.x && ev.y === p.y && !p.isMoving() && ev.touchedAt !== key) {
          ev.touchedAt = key;
          this.startEvent(ev, 'touch');
          return;
        }
        // a chaser that has caught up (it cannot step onto Wren's tile) catches her: bible 8.9, running
        // is the way out. Once per approach: it has to lose her and come back to catch her again.
        const md = ev.moveDef;
        const calm = !!(window.__game && window.__game.calm);
        if (!calm && ev.trigger === 'touch' && md && md.type === 'chase' && !ev.isMoving() && !p.isMoving() &&
            Math.abs(ev.x - p.x) + Math.abs(ev.y - p.y) === 1 && ev.caughtAt !== key) {
          ev.caughtAt = key;
          ev.dir = E.dirBetween(ev.x, ev.y, p.x, p.y);
          this.startEvent(ev, 'touch');
          return;
        }
      }
    },

    /**
     * Starts an event's command list.
     * @param {object} ev map event
     * @param {string} how 'action' | 'touch' | 'auto' | 'parallel'
     * @returns {boolean} true when the list actually started
     */
    startEvent: function (ev, how) {
      if (ev.running) return false;
      const cmds = ev.commands();
      if (!cmds || !cmds.length) return false;
      const parallel = how === 'parallel';
      if (!parallel && G.Interpreter.isBusy()) return false;
      if (!parallel && ev.facePlayer && how !== 'auto') {
        ev.dir = E.dirBetween(ev.x, ev.y, this.player.x, this.player.y);
      }
      ev.running = true;
      const self = this;
      G.Interpreter.run(cmds, { eventId: ev.id, event: ev, mapId: this.mapId, main: !parallel })
        .then(function () {
          ev.running = false;
          if (parallel) ev.parallelWait = 8;
          self.pagesRev = G.State.rev;
          self.refreshEvents();
        });
      return true;
    },

    _updateCamera: function (snap) {
      const t = this.camTarget;
      let cx, cy;
      if (t && t.px !== undefined) { cx = t.px * T + T / 2; cy = t.py * T + T / 2; }
      else if (t) { cx = (t.x + 0.5) * T; cy = (t.y + 0.5) * T; }
      else { cx = this.player.px * T + T / 2; cy = this.player.py * T + T / 2; }
      const mw = this.w * T, mh = this.h * T;
      let x = mw <= C.W ? (mw - C.W) / 2 : U.clamp(cx - C.W / 2, 0, mw - C.W);
      let y = mh <= C.H ? (mh - C.H) / 2 : U.clamp(cy - C.H / 2, 0, mh - C.H);
      if (!snap && this.camFrames > 0) {
        this.camT++;
        const k = U.ease.inOut(Math.min(1, this.camT / this.camFrames));
        x = U.lerp(this.camFrom.x, x, k);
        y = U.lerp(this.camFrom.y, y, k);
        if (this.camT >= this.camFrames) this.camFrames = 0;
      }
      const q = C.SCALE;
      this.cam.x = Math.round(x * q) / q;
      this.cam.y = Math.round(y * q) / q;
    },

    /* ---------------------------------------------------------------- ground chunks */

    _chunk: function (cx, cy) {
      const key = cx + ',' + cy;
      const hit = this.chunks.get(key);
      if (hit) { this.chunks.delete(key); this.chunks.set(key, hit); return hit; }
      const made = this._buildChunk(cx, cy);
      if (made.ready) {
        this.chunks.set(key, made);
        if (this.chunks.size > CHUNK_CAP) this.chunks.delete(this.chunks.keys().next().value);
      }
      return made;
    },

    _buildChunk: function (cx, cy) {
      const canvas = document.createElement('canvas');
      canvas.width = CHUNK_PX * C.SCALE;
      canvas.height = CHUNK_PX * C.SCALE;
      const x = canvas.getContext('2d');
      x.setTransform(C.SCALE, 0, 0, C.SCALE, 0, 0);
      const x0 = cx * CHUNK, y0 = cy * CHUNK;
      let ready = true;
      for (let ty = y0; ty < y0 + CHUNK; ty++) {
        for (let tx = x0; tx < x0 + CHUNK; tx++) {
          const d = this.terrainAt(tx, ty);
          if (!d || !d.img) continue;
          if (!G.Assets.isLoaded(d.img)) { ready = false; G.Assets.img(d.img); }
          this._blitTile(x, d, tx, ty, x0, y0);
        }
      }
      this._roundCorners(x, x0, y0);
      this._drawEdges(x, x0, y0);
      return { canvas: canvas, ready: ready };
    },

    /** Draws one world-aligned tile of a terrain texture at its chunk-local position. */
    _blitTile: function (x, d, tx, ty, x0, y0) {
      const img = G.Assets.img(d.img);
      if (!img || img.width < SRC || img.height < SRC) return;
      const sx = ((tx * SRC) % img.width + img.width) % img.width;
      const sy = ((ty * SRC) % img.height + img.height) % img.height;
      if (sx + SRC > img.width || sy + SRC > img.height) return;
      x.drawImage(img, sx, sy, SRC, SRC, (tx - x0) * T, (ty - y0) * T, T, T);
    },

    /**
     * Classifies the corner at the end of side `side` of tile (tx,ty) of terrain `a`, where `ta` is the
     * unit vector along the side pointing at that corner. Returns null (straight), or
     * { kind:'convex'|'concave', R, u, v, tex, tile } where u/v are the unit vectors of the rounding
     * square from the corner point and `tex` is the terrain painted into the cut-off region.
     */
    _cornerInfo: function (a, tx, ty, side, ta) {
      const N = this.terrainAt(tx + ta[0], ty + ta[1]);
      const D = this.terrainAt(tx + ta[0] + side.d[0], ty + ta[1] + side.d[1]);
      const B = this.terrainAt(tx + side.d[0], ty + side.d[1]);
      const ne = N ? (N.edge || 0) : -1;
      if (N !== a && a.edge > ne) {
        // both sides at this corner border away from `a`: cut the corner round with the neighbour's texture
        const be = B ? (B.edge || 0) : -1;
        const tex = (N && N.img && (ne >= be || !B || !B.img)) ? N : (B && B.img ? B : null);
        return { kind: 'convex', R: 17, u: [-ta[0], -ta[1]], v: [side.n[0], side.n[1]], tex: tex, tile: [tx, ty] };
      }
      if (N === a && D === a) {
        // the border turns away across the side: a fillet of `a` in the neighbour's corner
        return { kind: 'concave', R: 11, u: [-ta[0], -ta[1]], v: [side.d[0], side.d[1]], tex: a, tile: [tx + side.d[0], ty + side.d[1]] };
      }
      return null;
    },

    /** Corner point (chunk-local) at the end `end` (0 = a, 1 = b) of a side of tile (tx,ty). */
    _cornerPoint: function (tx, ty, side, end, x0, y0) {
      const c = end ? side.b : side.a;
      return [(tx - x0 + c[0]) * T, (ty - y0 + c[1]) * T];
    },

    /** Rounds every terrain corner: paints the cut-off/fillet regions with the right texture. */
    _roundCorners: function (x, x0, y0) {
      for (let ty = y0 - 1; ty <= y0 + CHUNK; ty++) {
        for (let tx = x0 - 1; tx <= x0 + CHUNK; tx++) {
          const a = this.terrainAt(tx, ty);
          if (!a || !a.img || !a.edge || !a.edgeColor) continue;
          for (let s = 0; s < 4; s++) {
            const side = SIDES[s];
            if (side.d[1] === 0) continue;                       // every corner is handled once, from its horizontal side
            const b = this.terrainAt(tx + side.d[0], ty + side.d[1]);
            if (b === a || a.edge <= (b ? (b.edge || 0) : -1)) continue;
            for (let end = 0; end < 2; end++) {
              const ta = end ? [side.b[0] - side.a[0], side.b[1] - side.a[1]] : [side.a[0] - side.b[0], side.a[1] - side.b[1]];
              const ci = this._cornerInfo(a, tx, ty, side, ta);
              if (!ci || !ci.tex) continue;
              const p = this._cornerPoint(tx, ty, side, end, x0, y0);
              const R = ci.R;
              const cx = p[0] + ci.u[0] * R + ci.v[0] * R, cy = p[1] + ci.u[1] * R + ci.v[1] * R;
              x.save();
              x.beginPath();
              x.rect(Math.min(p[0], cx), Math.min(p[1], cy), R, R);
              x.clip();
              x.beginPath();
              x.rect(-T, -T, CHUNK_PX + 2 * T, CHUNK_PX + 2 * T);
              x.arc(cx, cy, R, 0, Math.PI * 2, true);
              x.clip('evenodd');
              this._blitTile(x, ci.tex, ci.tile[0], ci.tile[1], x0, y0);
              x.restore();
            }
          }
        }
      }
    },

    /** Wobbly pencil outlines where terrains meet; the higher `edge` value owns the line. */
    _drawEdges: function (x, x0, y0) {
      x.lineJoin = x.lineCap = 'round';
      for (let ty = y0 - 1; ty <= y0 + CHUNK; ty++) {
        for (let tx = x0 - 1; tx <= x0 + CHUNK; tx++) {
          const a = this.terrainAt(tx, ty);
          if (!a || !a.img || !a.edge || !a.edgeColor) continue;
          for (let s = 0; s < 4; s++) {
            const side = SIDES[s];
            const b = this.terrainAt(tx + side.d[0], ty + side.d[1]);
            if (b === a) continue;
            const be = b ? (b.edge || 0) : -1;
            if (a.edge <= be) continue;
            const seed = (this.seed ^ Math.imul((tx * 73856093) ^ (ty * 19349663), 0x9e3779b1) ^ (s * 0x27d4eb2d)) | 0;
            const lx = (tx - x0) * T, ly = (ty - y0) * T;
            const inset = 1.7, ext = 1.6;
            const ux = side.b[0] - side.a[0], uy = side.b[1] - side.a[1];   // unit along the edge
            const ca = this._cornerInfo(a, tx, ty, side, [-ux, -uy]);
            const cb = this._cornerInfo(a, tx, ty, side, [ux, uy]);
            const sa = ca ? ca.R : -ext, sb = cb ? cb.R : -ext;          // shortening at each end
            const p1x = lx + side.a[0] * T + side.n[0] * inset + ux * sa;
            const p1y = ly + side.a[1] * T + side.n[1] * inset + uy * sa;
            const p2x = lx + side.b[0] * T + side.n[0] * inset - ux * sb;
            const p2y = ly + side.b[1] * T + side.n[1] * inset - uy * sb;
            this._pencil(x, p1x, p1y, p2x, p2y, seed, a.edgeColor, a.edgeWidth || 2.3);
            if (side.d[1] === 0) continue;                       // arcs are drawn once, from the horizontal sides
            for (let end = 0; end < 2; end++) {
              const ci = end ? cb : ca;
              if (!ci) continue;
              const p = this._cornerPoint(tx, ty, side, end, x0, y0);
              const R = ci.R;
              const cx = p[0] + ci.u[0] * R + ci.v[0] * R, cy = p[1] + ci.u[1] * R + ci.v[1] * R;
              // the arc runs from the shortened end of this side to the shortened end of the other one
              const a0 = Math.atan2(p[1] + ci.u[1] * R - cy, p[0] + ci.u[0] * R - cx);
              const a1 = Math.atan2(p[1] + ci.v[1] * R - cy, p[0] + ci.v[0] * R - cx);
              let da = a1 - a0;
              while (da > Math.PI) da -= Math.PI * 2;
              while (da < -Math.PI) da += Math.PI * 2;
              const pts = [];
              const rr = ci.kind === 'convex' ? R - inset : R + inset;   // keep the line just inside the owner
              for (let i = 0; i <= 5; i++) {
                const t = a0 + da * i / 5;
                pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
              }
              this._pencilPath(x, pts, seed ^ (end * 0x5bd1e995), a.edgeColor, a.edgeWidth || 2.3);
            }
          }
        }
      }
    },

    _pencil: function (x, x1, y1, x2, y2, seed, color, width) {
      if (Math.hypot(x2 - x1, y2 - y1) < 2) return;
      const n = 6, pts = [];
      for (let i = 0; i <= n; i++) pts.push([x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n]);
      this._pencilPath(x, pts, seed, color, width);
    },

    /** A wobbly double pencil stroke along a polyline (hand-drawn look, stable per seed). */
    _pencilPath: function (x, pts, seed, color, width) {
      const stroke = function (off, w, alpha) {
        x.globalAlpha = alpha;
        x.strokeStyle = color;
        x.lineWidth = w;
        x.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
          const len = Math.hypot(q[0] - o[0], q[1] - o[1]) || 1;
          const nx = -(q[1] - o[1]) / len, ny = (q[0] - o[0]) / len;
          const k = U.noise(seed, i) * 1.5 + off;
          const px = pts[i][0] + nx * k, py = pts[i][1] + ny * k;
          if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
        }
        x.stroke();
      };
      stroke(0, width, 0.82);
      if (U.noise(seed, 31) > -0.1) stroke(U.noise(seed, 32) * 1.5 + 0.9, width * 0.6, 0.38);
      x.globalAlpha = 1;
    },

    /* ---------------------------------------------------------------- draw */

    draw: function (ctx) {
      const def = this.def;
      ctx.fillStyle = (def && def.backdrop) || '#141019';
      ctx.fillRect(0, 0, C.W, C.H);
      if (!def) return;
      const cam = this.cam;
      this._drawGround(ctx, cam);
      this._drawObjects(ctx, cam, this.objects.below);
      this._drawSorted(ctx, cam);
      this._drawObjects(ctx, cam, this.objects.above);
      this._drawEmotes(ctx, cam);
      if (this.walkGoal) this._drawWalkGoal(ctx, cam);
      if (this.cg && this.cgAlpha > 0.002) {
        ctx.save();
        ctx.globalAlpha *= U.clamp(this.cgAlpha, 0, 1);
        G.Gfx.drawImg(this.cg, 0, 0, { w: C.W, h: C.H });
        ctx.restore();
      }
      if (C.DEBUG_OVERLAY) this._drawDebug(ctx, cam);
    },

    _drawGround: function (ctx, cam) {
      const c0x = Math.floor(cam.x / CHUNK_PX), c1x = Math.floor((cam.x + C.W - 1) / CHUNK_PX);
      const c0y = Math.floor(cam.y / CHUNK_PX), c1y = Math.floor((cam.y + C.H - 1) / CHUNK_PX);
      const maxCx = Math.floor((this.w - 1) / CHUNK), maxCy = Math.floor((this.h - 1) / CHUNK);
      for (let cy = Math.max(0, c0y); cy <= Math.min(maxCy, c1y); cy++) {
        for (let cx = Math.max(0, c0x); cx <= Math.min(maxCx, c1x); cx++) {
          const ch = this._chunk(cx, cy);
          ctx.drawImage(ch.canvas, cx * CHUNK_PX - cam.x, cy * CHUNK_PX - cam.y, CHUNK_PX, CHUNK_PX);
        }
      }
    },

    /** Vertical offset for props with anim:'bob' (a slow 2 px breathing bob; creature props feel alive). */
    _bobOf: function (o) {
      if (o.anim !== 'bob') return 0;
      return Math.round(Math.sin(((this.frame || 0) + o.phase * 4) / 22) * 2 * C.SCALE) / C.SCALE;
    },

    /** A pencilled ring on the tile Wren is walking to, breathing while she goes. */
    _drawWalkGoal: function (ctx, cam) {
      const g = this.walkGoal;
      g.t++;
      const cx = (g.x + 0.5) * T - cam.x, cy = (g.y + 0.5) * T - cam.y;
      const r = 12 + Math.sin(g.t * 0.18) * 2;
      ctx.save();
      ctx.globalAlpha *= 0.7;
      ctx.strokeStyle = g.act ? '#d9a13a' : '#5d5568';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) {
        const a = i / 14 * Math.PI * 2;
        const rr = r + U.noise(g.x * 31 + g.y, i) * 1.5;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.6;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    },

    _drawObjects: function (ctx, cam, list) {
      for (const o of list) {
        const x = o.px - cam.x, y = o.py - cam.y + this._bobOf(o);
        if (x + o.w / 2 < -8 || x - o.w / 2 > C.W + 8 || y - o.h > C.H + 8 || y < -8) continue;
        G.Gfx.drawImg(o.img, Math.round(x * C.SCALE) / C.SCALE, Math.round(y * C.SCALE) / C.SCALE, {
          w: o.w, h: o.h, anchorX: 0.5, anchorY: 1, flipX: o.flipX,
        });
      }
    },

    _drawSorted: function (ctx, cam) {
      const buf = this._sortBuf;
      buf.length = 0;
      for (const o of this.objects.sort) {
        const x = o.px - cam.x, y = o.py - cam.y;
        if (x + o.w / 2 < -8 || x - o.w / 2 > C.W + 8 || y - o.h > C.H + 8 || y < -8) continue;
        buf.push(o);
      }
      for (let i = this.followers.length - 1; i >= 0; i--) buf.push(this.followers[i]);
      buf.push(this.player);
      for (const ev of this.events) {
        if (!ev.visible || ev.erased || ev.above) continue;
        const x = ev.px * T + T / 2 - cam.x, y = ev.py * T + T - cam.y;
        if (x < -80 || x > C.W + 80 || y < -120 || y > C.H + 120) continue;
        buf.push(ev);
      }
      buf.sort(function (a, b) {
        const ay = a.obj ? a.sortY : a.sortY();
        const by = b.obj ? b.sortY : b.sortY();
        return ay - by;
      });
      for (const it of buf) {
        if (it.obj) {
          G.Gfx.drawImg(it.img, Math.round((it.px - cam.x) * C.SCALE) / C.SCALE,
            Math.round((it.py - cam.y + this._bobOf(it)) * C.SCALE) / C.SCALE,
            { w: it.w, h: it.h, anchorX: 0.5, anchorY: 1, flipX: it.flipX });
        } else {
          it.draw(ctx, cam);
        }
      }
      for (const ev of this.events) if (ev.visible && !ev.erased && ev.above) ev.draw(ctx, cam);
    },

    _drawEmotes: function (ctx, cam) {
      this.player.drawEmote(ctx, cam);
      for (const f of this.followers) f.drawEmote(ctx, cam);
      for (const ev of this.events) if (!ev.erased) ev.drawEmote(ctx, cam);
    },

    _drawDebug: function (ctx, cam) {
      const x0 = Math.max(0, Math.floor(cam.x / T)), x1 = Math.min(this.w - 1, Math.ceil((cam.x + C.W) / T));
      const y0 = Math.max(0, Math.floor(cam.y / T)), y1 = Math.min(this.h - 1, Math.ceil((cam.y + C.H) / T));
      ctx.save();
      ctx.lineWidth = 1;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const sx = x * T - cam.x, sy = y * T - cam.y;
          const blocked = this.coll[y * this.w + x];
          ctx.strokeStyle = 'rgba(255,255,255,0.14)';
          ctx.strokeRect(sx + 0.5, sy + 0.5, T - 1, T - 1);
          if (blocked) {
            ctx.fillStyle = 'rgba(220,60,60,0.28)';
            ctx.fillRect(sx + 1, sy + 1, T - 2, T - 2);
          }
          if (this.isCounter(x, y)) {
            ctx.fillStyle = 'rgba(60,140,255,0.22)';
            ctx.fillRect(sx + 1, sy + 1, T - 2, T - 2);
          }
        }
      }
      for (const ev of this.events) {
        const sx = ev.x * T - cam.x, sy = ev.y * T - cam.y;
        if (sx < -T || sy < -T || sx > C.W || sy > C.H) continue;
        ctx.fillStyle = ev.erased ? 'rgba(120,120,120,0.35)' : 'rgba(80,200,120,0.3)';
        ctx.fillRect(sx + 1, sy + 1, T - 2, T - 2);
        G.Gfx.text(ev.id + ' p' + (ev.pageIndex < 0 ? '-' : ev.pageIndex), sx + 3, sy + 2,
          { size: 12, color: '#fff', outline: '#000' });
      }
      const p = this.player;
      G.Gfx.text('map ' + this.mapId + '  player ' + p.x + ',' + p.y + ' ' + p.dir + '  cam ' +
        Math.round(cam.x) + ',' + Math.round(cam.y) + '  chunks ' + this.chunks.size,
        6, 6, { size: 15, color: '#fff', outline: '#000' });
      ctx.restore();
    },
  };

  G.Scenes.register('map', MapScene);
  G.MapScene = MapScene;
})();
