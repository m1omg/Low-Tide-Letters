/*
 * touch.js - the mouse and touch screens: G.Pointer (click / hover on menus) and the on-screen pad.
 *
 * G.POINTER: menus register their clickable rows while they draw, with
 *   G.Pointer.target(x, y, w, h, pick, opts)
 * in the same logical coordinates they draw in (the current canvas transform is applied, so rows inside
 * a translated / scaled / swinging panel still line up). pick(kind, px, py) moves the menu's cursor onto
 * that row and returns true when it changed; kind is 'hover' (the mouse moved over it) or 'click'.
 * After a click the row is confirmed with a Confirm press, so every menu keeps its keyboard code path.
 * opts: { confirm:false } only moves the cursor; { click:fn(px,py) } replaces the whole click.
 * Only the top scene registers (G.Scenes.draw), and an open message / choice box drops what the scenes
 * registered underneath it. A click that misses every row does nothing while rows are on screen;
 * with none (the map, dialogue) a click is Confirm. A right-click on the map walks Wren to the tile (or up to
 * the thing on it, and talks to it); elsewhere it backs out. The middle button is the X key (menu / back);
 * the wheel scrolls lists.
 *
 * A DOM overlay (d-pad on the left; Confirm, Cancel/Menu, Run and Confide on the right) drives the same
 * actions as the keyboard through G.Input.simulate, so every scene works unchanged. Tapping or clicking
 * the game screen itself counts as Confirm (advance dialogue, talk to what is in front of you).
 *
 * The overlay appears on the first touch, on a coarse-pointer device, or with ?touch=1; the small pad
 * button in the corner toggles it by mouse. Nothing here is needed on a keyboard.
 */
(function () {
  'use strict';
  const G = window.G;

  const BUTTONS = [
    { id: 'up', cls: 'dpad up', label: '▲', act: 'up' },
    { id: 'left', cls: 'dpad left', label: '◀', act: 'left' },
    { id: 'right', cls: 'dpad right', label: '▶', act: 'right' },
    { id: 'down', cls: 'dpad down', label: '▼', act: 'down' },
    { id: 'confirm', cls: 'face a', label: 'A', act: 'confirm', title: 'Confirm' },
    { id: 'cancel', cls: 'face b', label: 'B', act: 'cancel', title: 'Back / Menu' },
    { id: 'run', cls: 'face run', label: 'run', act: 'run', title: 'Run (hold)' },
    { id: 'confide', cls: 'face c', label: 'C', act: 'confide', title: 'Confide (battle)' },
  ];

  let root = null;
  let shown = false;
  let canvasEl = null;

  /** A right-click at logical p: a walk on the map, Cancel anywhere else. Returns true when it walked. */
  function rightClick(p) {
    if (p && !live.length) {
      const s = G.Scenes.top && G.Scenes.top();
      if (s && s.pointerWalk && s.pointerWalk(p.x, p.y)) return true;
    }
    pulse('cancel');
    return false;
  }

  /** The middle mouse button does what X does: Cancel, and the pause menu on the map. */
  function menuClick() {
    G.Input.simulate('cancel', true);
    G.Input.simulate('menu', true);
    setTimeout(function () { G.Input.simulate('cancel', false); G.Input.simulate('menu', false); }, 50);
  }

  /** Holds an action for a couple of frames (a tap), releasing it by itself. */
  function pulse(action) {
    G.Input.simulate(action, true);
    setTimeout(function () { G.Input.simulate(action, false); }, 50);
  }

  /* ====================================================================== G.Pointer */

  let building = [];           // regions registered during the frame being drawn
  let live = [];               // regions of the last finished frame (what clicks test against)
  let layerOn = true;
  let px = -1, py = -1, over = false;
  let hoverDirty = false;
  let lastWheel = 0;
  let cursorShown = 'default';

  function toLogical(e) {
    const r = canvasEl.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x: (e.clientX - r.left) / r.width * G.CONFIG.W, y: (e.clientY - r.top) / r.height * G.CONFIG.H };
  }

  function hit(x, y) {
    for (let i = live.length - 1; i >= 0; i--) {
      const r = live[i];
      if (x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1) return r;
    }
    return null;
  }

  function setCursor(kind) {
    if (!canvasEl || cursorShown === kind) return;
    cursorShown = kind;
    canvasEl.style.cursor = kind;
  }

  function hover() {
    if (!over) { setCursor('default'); return; }
    const r = hit(px, py);
    setCursor(r ? 'pointer' : 'default');
    if (r && r.pick) {
      let changed = false;
      try { changed = r.pick('hover', px, py); } catch (e) { G.error(e); }
      if (changed) G.UI.sfx('cursor');
    }
  }

  const Pointer = G.Pointer = {
    /** Pointer position in logical pixels (valid while `over`). */
    get x() { return px; },
    get y() { return py; },
    get over() { return over; },

    /** Registers a clickable rectangle for this frame (call it from draw). */
    target: function (x, y, w, h, pick, opts) {
      if (!layerOn || !(w > 0) || !(h > 0)) return;
      const ctx = G.Gfx.ctx;
      const S = G.CONFIG.SCALE;
      let x0 = x, y0 = y, x1 = x + w, y1 = y + h;
      if (ctx && ctx.getTransform) {
        const m = ctx.getTransform();
        const xs = [], ys = [];
        for (const p of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
          xs.push((m.a * p[0] + m.c * p[1] + m.e) / S);
          ys.push((m.b * p[0] + m.d * p[1] + m.f) / S);
        }
        x0 = Math.min.apply(null, xs); x1 = Math.max.apply(null, xs);
        y0 = Math.min.apply(null, ys); y1 = Math.max.apply(null, ys);
      }
      opts = opts || {};
      building.push({ x0: x0, y0: y0, x1: x1, y1: y1, pick: pick || null, confirm: opts.confirm !== false, click: opts.click || null });
    },

    /** While off, target() ignores registrations (scenes below the top one). */
    layer: function (on) { layerOn = !!on; },

    /** Drops what was registered so far this frame (a modal box opened over it). */
    clear: function () { building = []; },

    /** Start of a rendered frame. */
    begin: function () { building = []; layerOn = true; },

    /** End of a rendered frame: its regions become the clickable ones. */
    end: function () {
      live = building;
      building = [];
      if (hoverDirty) { hoverDirty = false; hover(); }
      else if (over) setCursor(hit(px, py) ? 'pointer' : 'default');
    },

    /** Presses an action for a moment (a click handler that wants Confirm after all). */
    press: function (action) { pulse(action); },

    /** True when the last frame had any clickable rows. */
    hasTargets: function () { return live.length > 0; },

    /** Test hook: acts as if the pointer clicked (or hovered, or middle-clicked) at a logical position. */
    clickAt: function (x, y, kind) {
      px = x; py = y; over = true;
      if (kind === 'hover') { hover(); return !!hit(x, y); }
      if (kind === 'middle') { menuClick(); return false; }
      if (kind === 'right') return rightClick({ x: x, y: y });
      return click(x, y);
    },
  };

  /** A primary click / tap at logical (x, y). Returns true when it landed on a row. */
  function click(x, y) {
    const r = hit(x, y);
    if (!r) {
      if (!live.length) pulse('confirm');                 // map, dialogue: click = Confirm (talk, advance)
      return false;
    }
    try {
      if (r.click) { r.click(x, y); return true; }
      if (r.pick) r.pick('click', x, y);
    } catch (e) { G.error(e); return true; }
    if (r.confirm) pulse('confirm');
    return true;
  }

  function build() {
    if (root) return root;
    root = document.createElement('div');
    root.id = 'touch-controls';
    root.setAttribute('aria-hidden', 'true');
    for (const b of BUTTONS) {
      const el = document.createElement('div');
      el.className = 'tc ' + b.cls;
      el.textContent = b.label;
      if (b.title) el.title = b.title;
      let since = 0;
      const down = function (e) {
        e.preventDefault();
        since = Date.now();
        el.classList.add('held');
        if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (err) { /* nothing */ } }
        if (b.act) G.Input.simulate(b.act, true);
        if (b.key && G.Input.simulateKey) G.Input.simulateKey(b.key);
        if (b.act === 'cancel') G.Input.simulate('menu', true);
      };
      const release = function () {
        if (b.act) G.Input.simulate(b.act, false);
        if (b.act === 'cancel') G.Input.simulate('menu', false);
      };
      const up = function (e) {
        if (e) e.preventDefault();
        el.classList.remove('held');
        // a quick tap must still be held across at least one fixed update to count as a press
        const left = 60 - (Date.now() - since);
        if (left > 0) setTimeout(release, left); else release();
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      el.addEventListener('lostpointercapture', up);
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      root.appendChild(el);
    }
    document.body.appendChild(root);
    return root;
  }

  function show(on) {
    shown = !!on;
    build().classList.toggle('shown', shown);
    document.body.classList.toggle('touch-mode', shown);
    try { localStorage.setItem('fable51.touch', shown ? '1' : '0'); } catch (e) { /* nothing */ }
  }

  function init() {
    const canvas = document.getElementById('game');
    if (!canvas) return;

    // the corner toggle, for mouse users who want the pad
    const tog = document.createElement('button');
    tog.id = 'touch-toggle';
    tog.type = 'button';
    tog.title = 'On-screen controls';
    tog.setAttribute('aria-label', 'Toggle on-screen controls');
    tog.textContent = '☰';
    tog.addEventListener('click', function () { show(!shown); canvas.focus(); });
    document.body.appendChild(tog);

    canvasEl = canvas;

    // a click / tap picks the row under it (or is Confirm when there are no rows); a first touch brings the pad up
    canvas.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' && !shown) show(true);
      const p = toLogical(e);
      if (p) { px = p.x; py = p.y; over = true; }
      if ((e.button === 0 || e.pointerType === 'touch') && p) click(p.x, p.y);
      else if (e.button === 1) { e.preventDefault(); menuClick(); }     // middle button: the X key (menu / back)
      canvas.focus();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      const p = toLogical(e);
      if (!p) return;
      if (Math.abs(p.x - px) < 0.5 && Math.abs(p.y - py) < 0.5 && over) return;
      px = p.x; py = p.y; over = true;
      hoverDirty = true;
    });
    canvas.addEventListener('pointerleave', function () { over = false; setCursor('default'); });
    // right button: on the map it walks Wren to the tile (map_scene.pointerWalk); everywhere else it is Cancel
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); rightClick(toLogical(e)); });
    // the wheel steps through lists (only where there are rows, so it never walks Wren about)
    canvas.addEventListener('wheel', function (e) {
      if (!live.length || !e.deltaY) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheel < 90) return;
      lastWheel = now;
      pulse(e.deltaY > 0 ? 'down' : 'up');
    }, { passive: false });

    let want = false;
    try { want = localStorage.getItem('fable51.touch') === '1'; } catch (e) { /* nothing */ }
    if (/[?&]touch=1/.test(location.search)) want = true;
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) want = true;
    if (want) show(true);
  }

  G.Touch = { init: init, show: show, isShown: function () { return shown; } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
