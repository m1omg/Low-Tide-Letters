/*
 * main.js - boot sequence, fixed-timestep loop, the window.__game test hook, debug keys and the built-in
 * engine SELF-TEST scene (shown with ?selftest=1 or when no 'title' scene is registered).
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CONFIG;
  const U = G.Util;
  const STEP_MS = 1000 / C.FPS;

  let ctx = null;
  let lastTime = 0;
  let acc = 0;
  let advancing = 0;
  let booted = false;
  let battlePromise = null;
  let fpsShown = 0, fpsCount = 0, fpsTime = 0;

  /* ====================================================================== loop */

  /** One fixed update step (1/60 s). */
  function step() {
    G.Input.update();
    if (C.DEBUG) debugKeys();
    const modal = G.UI.isModal();
    G.UI.update();
    if (modal) G.Input.block(true);      // the open message/choice box owns this frame's input
    G.Scenes.update();
    G.Input.block(false);
    G.Gfx.updateEffects();
    U.tick();
    if (G.State.active) G.State.playtimeFrames++;
  }

  function render() {
    G.Gfx.begin();
    if (G.Pointer) G.Pointer.begin();
    G.Scenes.draw(ctx);
    G.Gfx.drawEffects();
    G.UI.draw(ctx);
    if (C.DEBUG) {
      G.Gfx.text(fpsShown + ' fps  ' + (G.Scenes.names().join(' > ') || '-'), 6, C.H - 4,
        { size: 14, baseline: 'bottom', color: '#fff', outline: '#000' });
    }
    G.Gfx.end();
    if (G.Pointer) G.Pointer.end();
  }

  function frame(now) {
    window.requestAnimationFrame(frame);
    if (!lastTime) lastTime = now;
    let dt = now - lastTime;
    lastTime = now;
    if (dt > 250) dt = 250;
    if (Math.abs(dt - STEP_MS) < 2) dt = STEP_MS;   // snap to the display rate to avoid 0/2-step jitter
    fpsCount++; fpsTime += dt;
    if (fpsTime >= 500) { fpsShown = Math.round(fpsCount * 1000 / fpsTime); fpsCount = 0; fpsTime = 0; }
    if (!advancing) {
      acc += dt;
      let n = 0;
      while (acc >= STEP_MS - 0.01 && n < 5) { step(); acc -= STEP_MS; n++; }
      if (n >= 5) acc = 0;
    }
    try {
      render();
    } catch (e) {
      G.error(e);
    }
  }

  // macrotask yield (lets every pending promise continuation run between two steps of advance())
  const yieldQueue = [];
  let channel = null;
  function macrotask() {
    return new Promise(function (resolve) {
      if (!channel && typeof MessageChannel === 'function') {
        channel = new MessageChannel();
        channel.port1.onmessage = function () { const r = yieldQueue.shift(); if (r) r(); };
      }
      if (channel) { yieldQueue.push(resolve); channel.port2.postMessage(0); } else setTimeout(resolve, 0);
    });
  }

  /* ====================================================================== debug keys */

  function sceneObj(name) {
    const reg = G.Scenes.get(name);
    if (G.Scenes.find) { const live = G.Scenes.find(name); if (live) return live; }
    return reg && typeof reg === 'object' ? reg : null;
  }

  function firstMethod(obj, names) {
    if (!obj) return null;
    for (const n of names) if (typeof obj[n] === 'function') return n;
    return null;
  }

  function debugConsole() {
    const S = G.DATA.strings.debug || {};
    const line = window.prompt(S.consolePrompt || 'debug command');
    if (!line) return;
    const a = line.trim().split(/\s+/);
    const hook = window.__game;
    const done = function (p) { if (p && p.catch) p.catch(function (e) { G.UI.Toast.show(String(e.message || e)); }); };
    switch (a[0]) {
      case 'tp': done(hook.teleport(a[1], parseInt(a[2], 10) || 0, parseInt(a[3], 10) || 0, a[4] || 'down')); break;
      case 'flag': hook.setFlag(a[1], a[2] !== '0' && a[2] !== 'false'); break;
      case 'var': hook.setVar(a[1], isNaN(Number(a[2])) ? a[2] : Number(a[2])); break;
      case 'give': hook.give(a[1], parseInt(a[2], 10) || 1); break;
      case 'battle': done(hook.startBattle(a[1])); break;
      case 'lvl': hook.setLevel(parseInt(a[1], 10) || 1); break;
      case 'heal': G.State.healAll(); break;
      default: G.UI.Toast.show('? ' + a[0]);
    }
  }

  function debugKeys() {
    const I = G.Input;
    if (I.keyPressed('F1')) C.DEBUG_OVERLAY = !C.DEBUG_OVERLAY;
    if (I.keyPressed('F2')) { I.reset(); debugConsole(); }
    if (I.keyPressed('F3')) { G.State.healAll(); G.UI.Toast.show(G.str('debug.healed', 'healed')); }
    if (I.keyPressed('F4') && G.Scenes.isActive('battle')) {
      const b = sceneObj('battle');
      const m = firstMethod(b, ['debugWin', 'forceWin', 'win']);
      if (m) b[m](); else G.UI.Toast.show('battle scene has no debugWin()');
    }
  }

  /* ====================================================================== window.__game */

  function installHook() {
    const hook = window.__game = window.__game || {};
    const def = function (name, fn) { if (hook[name] === undefined) hook[name] = fn; };
    const fail = function (msg) { return Promise.reject(new Error(msg)); };

    hook.G = G;
    if (hook.ready === undefined) hook.ready = false;
    if (hook.skipText === undefined) hook.skipText = false;
    /** Extra: when set to a number, choice boxes pick that option by themselves. */
    if (hook.autoChoice === undefined) hook.autoChoice = null;
    /** Extra: chasing Unsent do not catch Wren when they reach her side (story drives stand still a lot). */
    if (hook.calm === undefined) hook.calm = false;

    def('scene', function () { return G.Scenes.topName(); });
    def('errors', function () { return G.errors.slice(); });
    def('setFlag', function (k, v) { G.State.setFlag(k, v === undefined ? true : v); });
    def('setVar', function (k, v) { G.State.setVar(k, v); });
    def('give', function (id, n) { return G.State.addItem(id, n == null ? 1 : n); });
    def('addMember', function (id) { return G.State.addMember(id); });

    def('setLevel', function (n) {
      for (const a of G.State.party) {
        if (G.State.hooks.setLevel) G.State.hooks.setLevel(a, n);
        else a.level = n;
      }
      if (!G.State.hooks.setLevel) G.State.healAll();
    });

    /**
     * Resets the state; when a 'map' scene exists it becomes the only scene, entered with
     * {mapId,x,y,dir,fade:'none',newGame:true} (mirrors G.State.map).
     */
    def('newGame', function (opts) {
      G.UI.reset();
      G.Gfx.resetEffects();
      G.Input.reset();
      G.State.newGame(opts);
      const m = G.State.map;
      if (G.Scenes.has('map') && m.id) {
        G.Scenes.clearTo('map', { mapId: m.id, x: m.x, y: m.y, dir: m.dir, fade: 'none', newGame: true });
      }
      return U.waitFrames(2).then(function () { return G.Scenes.topName(); });
    });

    /**
     * Delegates to the map scene's teleport(mapId,x,y,dir) (or debugTeleport/transfer/transferTo) when it
     * has one; otherwise re-enters the map scene with {mapId,x,y,dir,fade:'none'}.
     */
    def('teleport', function (mapId, x, y, dir) {
      if (!G.Scenes.has('map')) return fail('__game.teleport: no "map" scene is registered');
      if (!G.DATA.maps[mapId]) return fail('__game.teleport: unknown map "' + mapId + '"');
      dir = dir || 'down';
      if (!G.State.active) G.State.newGame();
      G.UI.reset();
      while (G.Scenes.isActive('map') && G.Scenes.topName() !== 'map' && G.Scenes.depth() > 1) G.Scenes.pop();
      const map = sceneObj('map');
      const m = G.Scenes.topName() === 'map' ? firstMethod(map, ['teleport', 'debugTeleport', 'transfer', 'transferTo']) : null;
      let p;
      if (m) {
        p = map[m](mapId, x, y, dir, { fade: 'none' });
      } else {
        G.State.map = { id: mapId, x: x, y: y, dir: dir };
        G.Gfx.resetEffects();
        G.Scenes.clearTo('map', { mapId: mapId, x: x, y: y, dir: dir, fade: 'none' });
      }
      return Promise.resolve(p).then(function () { return U.waitFrames(2); });
    });

    /** Resolves once the battle scene is running; the outcome comes from battleAuto(). */
    def('startBattle', function (troopId, opts) {
      if (!G.Scenes.has('battle')) return fail('__game.startBattle: no "battle" scene is registered');
      if (!G.DATA.troops[troopId]) return fail('__game.startBattle: unknown troop "' + troopId + '"');
      if (!G.State.active) G.State.newGame();
      G.Scenes.push('battle', Object.assign({ troop: troopId, canEscape: true }, opts || {}));
      return U.waitFrames(2).then(function () { return true; });
    });

    /**
     * Calls battleAuto(policy) (or auto/setAuto/autoPlay) on the battle scene and resolves with the battle
     * result ({outcome}) when the battle scene is popped.
     */
    def('battleAuto', function (policy) {
      if (!G.Scenes.isActive('battle')) return fail('__game.battleAuto: no battle is in progress');
      const b = sceneObj('battle');
      const m = firstMethod(b, ['battleAuto', 'auto', 'setAuto', 'autoPlay']);
      if (!m) return fail('__game.battleAuto: the battle scene has no battleAuto(policy) method');
      const r = b[m](policy || 'attack');
      if (r && typeof r.then === 'function') return r;
      return battlePromise || Promise.resolve(r);
    });

    /** Runs an event command list through the interpreter. */
    def('run', function (commands) {
      const I = G.Interpreter;
      const m = firstMethod(I, ['run', 'runCommands', 'runList', 'execute']);
      if (m) return Promise.resolve(I[m](commands));
      const map = sceneObj('map');
      const mm = firstMethod(map, ['run', 'runCommands']);
      if (mm) return Promise.resolve(map[mm](commands));
      return fail('__game.run: no interpreter available (G.Interpreter.run is missing)');
    });

    /** Holds an action for `frames` fixed steps, then releases it. Resolves one step after the release. */
    def('press', function (action, frames) {
      G.Input.simulate(action, true);
      return U.waitFrames(frames || 2).then(function () {
        G.Input.simulate(action, false);
        return U.waitFrames(1);
      });
    });

    /**
     * Fast-forward: runs N fixed update steps back to back (the display loop stops stepping meanwhile).
     * Between two steps it yields one macrotask so awaiting game code (events, battles) keeps up exactly
     * as in real time. Returns a Promise that resolves after the last step.
     */
    def('advance', function (frames) {
      frames = Math.max(0, frames | 0);
      advancing++;
      const run = async function () {
        try {
          for (let i = 0; i < frames; i++) { step(); await macrotask(); }
        } finally {
          advancing--;
          acc = 0;
        }
      };
      return run();
    });

    def('mapInfo', function () {
      const map = sceneObj('map');
      const m = firstMethod(map, ['mapInfo', 'info']);
      if (m && G.Scenes.isActive('map')) return map[m]();
      const s = G.State.map;
      const d = s.id ? G.DATA.maps[s.id] : null;
      return {
        id: s.id, w: d ? d.width : 0, h: d ? d.height : 0,
        player: { x: s.x, y: s.y, dir: s.dir },
        events: d && d.events ? d.events.map(function (e) { return { id: e.id, x: e.x, y: e.y, page: null }; }) : [],
      };
    });
    return hook;
  }

  /* ====================================================================== loading screen */

  const loading = { images: [0, 0], audio: [0, 0], raf: 0, on: false };

  function drawLoading() {
    const x = 184, y = 300, w = 400, h = 34;
    const tot = loading.images[1] + loading.audio[1];
    const p = tot ? (loading.images[0] + loading.audio[0]) / tot : 0;
    G.Gfx.frame++;
    G.Gfx.begin();
    ctx.fillStyle = C.COLORS.paper;
    ctx.fillRect(0, 0, C.W, C.H);
    G.Gfx.text(G.str('common.loading', 'Loading…'), C.W / 2, 236, { size: 38, font: 'title', align: 'center' });
    G.Gfx.panel(x, y, w, h, { seed: 99, fill: C.COLORS.paperShade });
    if (p > 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x + 4, y + 4, (w - 8) * p, h - 8); ctx.clip();
      G.Gfx.panel(x + 4, y + 4, w - 8, h - 8, { seed: 98, fill: C.COLORS.accent, stroke: null, shadow: false, radius: 8, boil: false });
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let d = -h; d < w; d += 9) { ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); }
      ctx.stroke();
      ctx.restore();
    }
    G.UI.drawContinueMark(ctx, x + 6 + (w - 12) * p, y - 2, false);
    G.Gfx.end();
  }

  function loadingLoop() {
    if (!loading.on) return;
    try { drawLoading(); } catch (e) { G.error(e); }
    loading.raf = window.requestAnimationFrame(loadingLoop);
  }

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise(function (resolve) {
        setTimeout(function () { resolve('timeout'); }, ms);
      }),
    ]).then(function (r) {
      if (r === 'timeout') G.warn(label + ' took longer than ' + ms + ' ms - continuing without waiting');
    });
  }

  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const fams = [C.FONT_BODY, C.FONT_TITLE];
    return Promise.all(fams.map(function (f) { return document.fonts.load('24px "' + f + '"').catch(function () {}); }))
      .then(function () { return document.fonts.ready; })
      .then(function () {
        for (const f of fams) if (!document.fonts.check('24px "' + f + '"')) G.warn('Font did not load: ' + f);
      });
  }

  /* ====================================================================== boot */

  async function boot() {
    const canvas = document.getElementById('game');
    G.Gfx.init(canvas);
    ctx = G.Gfx.ctx;
    G.State.loadOptions();
    G.Input.init();
    G.Assets.init();
    G.Audio.init();
    const hook = installHook();
    if (G.DATA.strings.gameTitle) document.title = G.DATA.strings.gameTitle;

    // wrap push so __game.battleAuto can hand out the result of whichever battle is running
    const push = G.Scenes.push;
    G.Scenes.push = function (scene, params) {
      const p = push.call(G.Scenes, scene, params);
      if (scene === 'battle') battlePromise = p;
      return p;
    };

    await withTimeout(loadFonts(), 5000, 'Font loading');
    G.Text.clearCache();
    loading.on = true;
    loadingLoop();
    await Promise.all([
      G.Assets.preloadAll(function (d, t) { loading.images = [d, t]; }),
      withTimeout(G.Audio.preloadSfx(function (d, t) { loading.audio = [d, t]; }), 15000, 'Sound decoding'),
    ]);
    loading.on = false;
    window.cancelAnimationFrame(loading.raf);

    G.Scenes.register('selftest', SelfTest);
    const start = C.SELFTEST || !G.Scenes.has('title') ? 'selftest' : 'title';
    G.Scenes.clearTo(start, {});
    booted = true;
    canvas.focus();
    window.requestAnimationFrame(function (t) {
      frame(t);
      hook.ready = true;
    });
  }

  /* ====================================================================== self-test scene */

  function doodleCanvas(size, kind) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const k = size / 192;
    x.scale(k, k);
    x.lineJoin = x.lineCap = 'round';
    x.strokeStyle = C.COLORS.ink;
    if (kind !== 'body') { x.fillStyle = '#efe3c6'; x.fillRect(0, 0, 192, 192); }
    // a lumpy little creature drawn with a wobbly pencil
    x.fillStyle = kind === 'happy' ? '#ffd9a8' : '#cfe4f7';
    x.lineWidth = 5;
    x.beginPath();
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 62 + U.noise(7, i % n) * 7 + (Math.sin(a * 3) * 4);
      const px = 96 + Math.cos(a) * r, py = 108 + Math.sin(a) * r * 0.92;
      if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.closePath(); x.fill(); x.stroke();
    // ears
    x.beginPath(); x.moveTo(60, 60); x.lineTo(52, 22); x.lineTo(84, 50); x.stroke();
    x.beginPath(); x.moveTo(132, 60); x.lineTo(142, 22); x.lineTo(110, 50); x.stroke();
    // eyes + mouth
    x.fillStyle = C.COLORS.ink;
    x.beginPath(); x.arc(74, 100, 7, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(118, 100, 7, 0, Math.PI * 2); x.fill();
    x.lineWidth = 4;
    x.beginPath();
    if (kind === 'happy') { x.arc(96, 118, 18, 0.15 * Math.PI, 0.85 * Math.PI); } else { x.moveTo(84, 130); x.quadraticCurveTo(96, 136, 108, 130); }
    x.stroke();
    // blush
    x.fillStyle = 'rgba(232,96,76,0.35)';
    x.beginPath(); x.ellipse(58, 120, 10, 6, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(134, 120, 10, 6, 0, 0, Math.PI * 2); x.fill();
    return c;
  }

  const SelfTest = {
    opaque: true,

    enter: function () {
      const S = this.S = G.DATA.strings.selftest;
      if (!G.Assets.has('selftest_doodle')) {
        G.Assets.register('selftest_doodle', doodleCanvas(192, 'body'));
        G.Assets.register('face_selftest_neutral', doodleCanvas(256, 'neutral'));
        G.Assets.register('face_selftest_happy', doodleCanvas(256, 'happy'));
      }
      this.speaker = { name: S.speakerName, color: G.DATA.strings.colors.blue, faces: 'selftest', blip: G.DATA.strings.sfx.blip };
      G.State.newGame({ party: [], map: { id: null, x: 0, y: 0, dir: 'down' }, playerName: S.playerName || 'friend' });
      G.State.setVar('selftest_presses', 0);
      this.menu = new G.UI.ListMenu({ x: 16, y: 58, w: 236, h: 340, rowH: 30, size: 21, title: S.menuTitle, items: S.items, seed: 31 });
      this.hp = new G.UI.Gauge({ w: 240, h: 16, max: 120, value: 120, color: '#e8604c', label: S.gaugeHp, labelColor: '#f3ecdc', showNumbers: true, seed: 5 });
      this.mp = new G.UI.Gauge({ w: 240, h: 16, max: 60, value: 45, color: '#4f8fd0', label: S.gaugeMp, labelColor: '#f3ecdc', showNumbers: true, seed: 6 });
      this.busy = false;
      this.tintIndex = 0;
      this.log = [];
    },

    exit: function () {},

    run: function (index) {
      const self = this, S = this.S, MB = G.UI.MessageBox;
      const say = function (text, expr) { return MB.show({ speaker: self.speaker, expr: expr || 'neutral', text: text }); };
      const actions = [
        async function () { await say(S.talk1); await say(S.talk2, 'happy'); await say(S.talk3, 'missing_expression'); },
        async function () {
          await say(S.ask);
          const i = await G.UI.ChoiceBox.show(S.askOptions, { cancelIndex: 2 });
          self.log.push('choice:' + i);
          await say(S.askReplies[i], i === 0 ? 'happy' : 'neutral');
        },
        async function () { G.UI.Toast.show(S.toastMap, { title: true }); G.UI.Toast.show(S.toast, { icon: 'selftest_doodle' }); },
        async function () {
          if (self.hp.value <= 0) { self.hp.set(self.hp.max); self.mp.set(self.mp.max); } else { self.hp.set(self.hp.value - 45); self.mp.set(self.mp.value - 20); G.Gfx.shake(4, 12); }
        },
        async function () { G.Gfx.shake(9, 36); },
        async function () { G.Gfx.flash('#ffffff', 30); },
        async function () { await G.Gfx.fadeOut(24); await MB.show({ style: 'narrate', text: S.narrate, pos: 'middle' }); await G.Gfx.fadeIn(24); },
        async function () {
          const tints = [[255, 140, 60, 0.3], [30, 30, 110, 0.5], null];
          G.Gfx.setTint(tints[self.tintIndex % tints.length], 40);
          self.tintIndex++;
        },
        async function () { await MB.show({ style: 'narrate', text: S.narrate }); await MB.show({ style: 'think', text: S.think }); },
        async function () {
          let backup = null;
          try { backup = window.localStorage.getItem('fable51.save.3'); } catch (e) { backup = null; }
          const token = Math.floor(Math.random() * 1e9);
          G.State.setVar('selftest_token', token);
          G.State.setFlag('selftest_flag', true);
          G.State.addItem('selftest_item', 3);
          const okSave = G.State.save(3);
          G.State.setVar('selftest_token', -1);
          G.State.setFlag('selftest_flag', false);
          G.State.removeItem('selftest_item', 3);
          const okLoad = G.State.load(3);
          const info = G.State.slotInfo(3);
          const ok = okSave && okLoad && G.State.getVar('selftest_token') === token && G.State.getFlag('selftest_flag') &&
            G.State.itemCount('selftest_item') === 3 && !!info && info.slot === 3 && G.State.hasAnySave();
          G.State.removeItem('selftest_item', 3);
          try {
            if (backup == null) G.State.deleteSave(3); else window.localStorage.setItem('fable51.save.3', backup);
          } catch (e) { /* ignore */ }
          self.log.push('save:' + (ok ? 'ok' : 'FAILED'));
          if (!ok) G.error('Self-test: save/load round trip failed');
          await say(ok ? S.saved : S.saveFailed, ok ? 'happy' : 'neutral');
        },
        async function () {
          const audio = G.DATA.manifest.audio || {};
          const ids = Object.keys(audio);
          if (!ids.length) { await say(S.noAudio); return; }
          const sfx = ids.find(function (id) { return audio[id].kind === 'sfx'; });
          const bgm = ids.find(function (id) { return audio[id].kind === 'bgm'; });
          if (sfx) G.Audio.playSfx(sfx);
          if (bgm) { if (G.Audio.currentBgm === bgm) G.Audio.stopBgm(400); else G.Audio.playBgm(bgm); }
          await say(S.audio);
        },
      ];
      const fn = actions[index];
      if (!fn) return;
      this.busy = true;
      this.menu.active = false;
      fn().catch(function (e) { G.error(e); }).then(function () { self.busy = false; self.menu.active = true; });
    },

    update: function () {
      for (const a of G.Input.ACTIONS) if (G.Input.pressed(a)) G.State.setVar('selftest_presses', G.State.getVar('selftest_presses') + 1);
      this.hp.update();
      this.mp.update();
      const ev = this.menu.update();
      if (ev && ev.type === 'select' && !this.busy) this.run(ev.index);
    },

    draw: function (ctx) {
      const S = this.S;
      // notebook page
      ctx.fillStyle = '#f7efdc';
      ctx.fillRect(0, 0, C.W, C.H);
      ctx.strokeStyle = 'rgba(90,140,200,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = 52; y < C.H; y += 26) { ctx.moveTo(0, y + 0.5); ctx.lineTo(C.W, y + 0.5); }
      ctx.stroke();
      G.Gfx.text(S.title, 20, 8, { size: 34, font: 'title' });

      this.menu.draw(ctx);

      G.Gfx.panel(264, 58, 488, 204, { seed: 41 });
      G.Text.drawRich(S.rich, 282, 68, { maxWidth: 454, size: 22 });

      G.Gfx.panel(264, 274, 190, 124, { seed: 42 });
      const b = G.Gfx.boil('selftest');
      G.Gfx.drawImg('selftest_doodle', 264 + 95 + b.dx, 274 + 116 + b.dy, {
        w: 104, h: 104, anchorX: 0.5, anchorY: 1, rot: b.rot, scaleX: b.sx, scaleY: b.sy,
        flipX: Math.floor(G.Gfx.frame / 120) % 2 === 1,
      });

      G.Gfx.panel(466, 274, 286, 124, { seed: 43, fill: 'rgba(38,32,48,0.93)', stroke: '#e9e0cf' });
      ctx.save();
      this.hp.draw(ctx, 486, 306);
      this.mp.draw(ctx, 486, 356);
      ctx.restore();

      // input display
      G.Gfx.panel(16, 410, 736, 150, { seed: 44 });
      G.Gfx.text(S.inputTitle, 36, 416, { size: 26, font: 'title' });
      G.Gfx.text(G.Input.fillKeys(S.hint), 734, 424, { size: 17, align: 'right', color: C.COLORS.inkSoft });
      const acts = G.Input.ACTIONS;
      for (let i = 0; i < acts.length; i++) {
        const kx = 36 + i * 71, ky = 462;
        const down = G.Input.isDown(acts[i]);
        G.Gfx.panel(kx, ky + (down ? 3 : 0), 64, 44, {
          seed: 300 + i, fill: down ? '#f7d774' : C.COLORS.paperShade, shadow: !down, radius: 9,
        });
        G.Gfx.text(acts[i], kx + 32, ky + 22 + (down ? 3 : 0), { size: 17, align: 'center', baseline: 'middle', maxWidth: 60 });
      }
      G.Gfx.text('frame ' + G.Gfx.frame + '   audio: ' + G.Audio.mode() + '   presses: ' + G.State.getVar('selftest_presses'),
        36, 522, { size: 17, color: C.COLORS.inkSoft });
    },
  };

  /* ====================================================================== go */

  boot().catch(function (e) {
    G.error(e);
    if (!booted && ctx) {
      loading.on = false;
      ctx.setTransform(C.SCALE, 0, 0, C.SCALE, 0, 0);
      ctx.fillStyle = C.COLORS.paper;
      ctx.fillRect(0, 0, C.W, C.H);
      ctx.fillStyle = C.COLORS.ink;
      ctx.font = '20px sans-serif';
      ctx.fillText('The game could not start: ' + (e && e.message ? e.message : e), 24, 48);
    }
  });
})();
