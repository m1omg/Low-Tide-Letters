/*
 * input.js - keyboard (+ optional gamepad) mapped to abstract actions, sampled once per fixed step.
 */
(function () {
  'use strict';
  const G = window.G;

  const ACTIONS = ['up', 'down', 'left', 'right', 'confirm', 'cancel', 'menu', 'run', 'confide', 'debug'];

  /**
   * Rebindable actions, in the order the Controls screen lists them. Each has up to SLOTS physical keys
   * (KeyboardEvent.code). 'cancel' also drives 'menu': the game treats "back" and "open the menu" as one key.
   */
  const BINDABLE = ['up', 'down', 'left', 'right', 'confirm', 'cancel', 'run', 'confide'];
  const SLOTS = 3;
  const DEFAULT_BINDINGS = {
    up: ['ArrowUp', 'KeyW', null],
    down: ['ArrowDown', 'KeyS', null],
    left: ['ArrowLeft', 'KeyA', null],
    right: ['ArrowRight', 'KeyD', null],
    confirm: ['KeyZ', 'Enter', 'Space'],
    cancel: ['KeyX', 'Backspace', null],
    run: ['ShiftLeft', 'ShiftRight', null],
    confide: ['KeyC', null, null],
  };
  /** Keys that can never be rebound, so nobody can lock themselves out: Esc always backs out. */
  const FIXED = { Escape: ['cancel', 'menu'], Backquote: ['debug'] };
  const BINDINGS_KEY = 'fable51.keys';

  let bindings = copyBindings(DEFAULT_BINDINGS);
  let capture = null;              // function(code|null) waiting for the next key (Controls screen)

  /** Physical key (KeyboardEvent.code) -> list of actions. Rebuilt from `bindings`; mutated in place. */
  const KEYMAP = {};

  function copyBindings(b) {
    const out = {};
    for (const a of BINDABLE) {
      const src = (b && Array.isArray(b[a])) ? b[a] : DEFAULT_BINDINGS[a];
      const row = [];
      for (let i = 0; i < SLOTS; i++) row.push(typeof src[i] === 'string' && src[i] ? src[i] : null);
      out[a] = row;
    }
    return out;
  }

  function rebuildKeymap() {
    for (const k of Object.keys(KEYMAP)) delete KEYMAP[k];
    for (const a of BINDABLE) {
      for (const code of bindings[a]) {
        if (!code || FIXED[code]) continue;
        const acts = KEYMAP[code] || (KEYMAP[code] = []);
        if (acts.indexOf(a) < 0) acts.push(a);
        if (a === 'cancel' && acts.indexOf('menu') < 0) acts.push('menu');
      }
    }
    for (const code of Object.keys(FIXED)) KEYMAP[code] = FIXED[code].slice();
    // the keypad Enter follows the main Enter unless it has been bound by itself
    if (!KEYMAP.NumpadEnter && KEYMAP.Enter) KEYMAP.NumpadEnter = KEYMAP.Enter.slice();
  }

  function saveBindings() {
    try { window.localStorage.setItem(BINDINGS_KEY, JSON.stringify(bindings)); } catch (e) { /* private mode */ }
  }

  function loadBindings() {
    let raw = null;
    try { raw = window.localStorage.getItem(BINDINGS_KEY); } catch (e) { raw = null; }
    if (raw) {
      try { bindings = copyBindings(JSON.parse(raw)); } catch (e) { G.warn('Key bindings were unreadable and have been reset'); }
    }
    for (const a of BINDABLE) {                                  // never load an action with no key at all
      if (!bindings[a].some(Boolean)) bindings[a] = DEFAULT_BINDINGS[a].slice();
    }
    rebuildKeymap();
  }

  rebuildKeymap();

  const KEY_NAMES = {
    ArrowUp: '\u2191', ArrowDown: '\u2193', ArrowLeft: '\u2190', ArrowRight: '\u2192',
    Enter: 'Enter', NumpadEnter: 'Num Enter', Space: 'Space', Escape: 'Esc', Backspace: 'Backspace',
    Tab: 'Tab', ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl',
    AltLeft: 'L Alt', AltRight: 'R Alt', CapsLock: 'Caps Lock', Backquote: '`', Minus: '-', Equal: '=',
    BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',',
    Period: '.', Slash: '/', Insert: 'Ins', Delete: 'Del', Home: 'Home', End: 'End', PageUp: 'PgUp',
    PageDown: 'PgDn', NumpadAdd: 'Num +', NumpadSubtract: 'Num -', NumpadMultiply: 'Num *',
    NumpadDivide: 'Num /', NumpadDecimal: 'Num .', IntlBackslash: '\\',
  };

  /** Short on-screen name for a physical key code ('KeyZ' -> 'Z', 'ShiftLeft' -> 'L Shift'). */
  function keyName(code) {
    if (!code) return '\u2014';
    if (KEY_NAMES[code]) return KEY_NAMES[code];
    let m = /^Key([A-Z])$/.exec(code);
    if (m) return m[1];
    m = /^Digit(\d)$/.exec(code);
    if (m) return m[1];
    m = /^Numpad(\d)$/.exec(code);
    if (m) return 'Num ' + m[1];
    return code;
  }

  const REPEAT_DELAY = 22;
  const REPEAT_RATE = 6;

  const keysDown = new Set();      // physical codes currently held
  const latch = {};                // action -> true when a keydown happened since the last update
  const simulated = {};            // action -> bool (test hook / virtual input)
  const state = {};                // action -> { down, pressed, released, hold }
  let rawLatch = new Set();        // physical codes pressed since last update
  let rawPressed = new Set();      // physical codes pressed this frame
  let anyLatch = false;
  let anyNow = false;
  let blocked = false;
  let padDown = {};
  let inited = false;

  for (const a of ACTIONS) state[a] = { down: false, pressed: false, released: false, hold: 0 };

  function onKeyDown(e) {
    if (capture) {
      if (e.repeat || !e.code || e.metaKey) return;
      e.preventDefault();
      const fn = capture;
      capture = null;
      fn(e.code === 'Escape' ? null : e.code);                 // Esc backs out of "press a key"
      return;
    }
    // leave browser shortcuts alone (Ctrl+R, Alt+Tab...) unless the key pressed is itself a bound modifier
    if ((e.ctrlKey || e.metaKey || e.altKey) && !/^(Control|Alt)/.test(e.code)) return;
    const acts = KEYMAP[e.code];
    const isDebugKey = G.CONFIG.DEBUG && /^F[1-4]$/.test(e.code);
    if (acts || isDebugKey) e.preventDefault();
    if (e.repeat) return;
    keysDown.add(e.code);
    rawLatch.add(e.code);
    anyLatch = true;
    if (acts) for (const a of acts) latch[a] = true;
  }

  function onKeyUp(e) {
    keysDown.delete(e.code);
  }

  function clearAll() {
    keysDown.clear();
  }

  function pollGamepad() {
    padDown = {};
    const nav = window.navigator;
    if (!nav || typeof nav.getGamepads !== 'function') return;
    let pads;
    try { pads = nav.getGamepads(); } catch (e) { return; }
    if (!pads) return;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const b = function (i) { return !!(p.buttons[i] && p.buttons[i].pressed); };
      const ax = p.axes || [];
      if (b(12) || ax[1] < -0.5) padDown.up = true;
      if (b(13) || ax[1] > 0.5) padDown.down = true;
      if (b(14) || ax[0] < -0.5) padDown.left = true;
      if (b(15) || ax[0] > 0.5) padDown.right = true;
      if (b(0)) padDown.confirm = true;
      if (b(1)) { padDown.cancel = true; }
      if (b(3) || b(9)) padDown.menu = true;
      if (b(2) || b(5) || b(7)) padDown.run = true;
    }
  }

  const Input = G.Input = {
    ACTIONS: ACTIONS,
    KEYMAP: KEYMAP,
    BINDABLE: BINDABLE,
    SLOTS: SLOTS,

    /** Installs the DOM listeners (idempotent). Called by main.js at boot. */
    init: function () {
      if (inited) return;
      inited = true;
      loadBindings();
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', clearAll);
      window.addEventListener('pointerdown', function () { anyLatch = true; });
    },

    /** Samples the devices. Must be called exactly once per fixed update step (main loop does it). */
    update: function () {
      pollGamepad();
      for (const a of ACTIONS) {
        let down = !!simulated[a] || !!latch[a] || !!padDown[a];
        if (!down) {
          for (const code in KEYMAP) {
            if (keysDown.has(code) && KEYMAP[code].indexOf(a) >= 0) { down = true; break; }
          }
        }
        const s = state[a];
        s.pressed = down && !s.down;
        s.released = !down && s.down;
        s.hold = down ? s.hold + 1 : 0;
        s.down = down;
        latch[a] = false;
      }
      rawPressed = rawLatch;
      rawLatch = new Set();
      anyNow = anyLatch;
      anyLatch = false;
      for (const a of ACTIONS) if (state[a].pressed) anyNow = true;
    },

    /** True while the action is held. */
    isDown: function (a) {
      return !blocked && !!state[a] && state[a].down;
    },

    /** True only on the first frame the action went down. */
    pressed: function (a) {
      return !blocked && !!state[a] && state[a].pressed;
    },

    /** True on the frame the action was released. */
    released: function (a) {
      return !blocked && !!state[a] && state[a].released;
    },

    /** Like pressed(), but also fires repeatedly while held (menu cursor auto-repeat). */
    repeated: function (a) {
      if (blocked || !state[a]) return false;
      const s = state[a];
      if (s.pressed) return true;
      return s.down && s.hold >= REPEAT_DELAY && (s.hold - REPEAT_DELAY) % REPEAT_RATE === 0;
    },

    /** Number of frames the action has been held (0 when up). */
    holdFrames: function (a) {
      return !blocked && state[a] ? state[a].hold : 0;
    },

    /**
     * Virtual input: holds (true) or releases (false) an action until changed again.
     * Takes effect at the next update(). Used by window.__game.press and tests.
     */
    simulate: function (a, isDown) {
      if (ACTIONS.indexOf(a) < 0) { G.warn('Input.simulate: unknown action ' + a); return; }
      simulated[a] = !!isDown;
      if (isDown) anyLatch = true;
    },

    /** Virtual key press by physical code (the on-screen Confide button sends 'KeyC'). */
    simulateKey: function (code) {
      rawLatch.add(code);
      anyLatch = true;
    },

    /** True on a frame where any key, mouse button or action was newly pressed ("press any key"). */
    anyPressed: function () {
      return !blocked && anyNow;
    },

    /** Raw physical key check for this frame, e.g. keyPressed('F1'). Not affected by block(). */
    keyPressed: function (code) {
      return rawPressed.has(code);
    },

    /** 4-way direction currently held ('up'|'down'|'left'|'right'|null); the most recent press wins. */
    dir4: function () {
      if (blocked) return null;
      let best = null, bestHold = Infinity;
      for (const d of ['up', 'down', 'left', 'right']) {
        const s = state[d];
        if (s.down && s.hold < bestHold) { best = d; bestHold = s.hold; }
      }
      return best;
    },

    /**
     * While blocked, every query returns false/0. The main loop blocks input for scene updates while a
     * modal UI box (message, choice) is open so one key press never reaches both the box and the scene.
     */
    block: function (on) {
      blocked = !!on;
    },

    /* ---------------------------------------------------------------- key bindings */

    /** A copy of the current bindings: { action: [code|null x SLOTS] }. */
    bindings: function () {
      return copyBindings(bindings);
    },

    /**
     * Binds `code` to slot `slot` of `action`. When another action already uses the key, the two swap
     * (that action gets this slot's old key), so nothing is ever bound twice.
     * Returns { ok, reason, swapped: action|null }.
     */
    bind: function (action, slot, code) {
      if (BINDABLE.indexOf(action) < 0 || slot < 0 || slot >= SLOTS || !code) return { ok: false, reason: 'bad' };
      if (FIXED[code]) return { ok: false, reason: keyName(code) + ' is fixed.' };
      if (/^Meta|^OS/.test(code)) return { ok: false, reason: 'That key belongs to the computer.' };
      const old = bindings[action][slot];
      if (old === code) return { ok: true, swapped: null };
      let swapped = null;
      for (const a of BINDABLE) {
        const j = bindings[a].indexOf(code);
        if (j < 0 || (a === action && j === slot)) continue;
        if (a === action) { bindings[a][j] = old; continue; }       // same action: just trade slots
        const left = bindings[a].filter(function (c, k) { return c && k !== j; }).length;
        if (!old && !left) return { ok: false, reason: keyName(code) + ' is the only key for ' + Input.actionName(a) + '.' };
        bindings[a][j] = old;
        swapped = a;
      }
      bindings[action][slot] = code;
      rebuildKeymap();
      saveBindings();
      return { ok: true, swapped: swapped };
    },

    /** Empties a slot. Refused when it is the action's last key. */
    unbind: function (action, slot) {
      const row = bindings[action];
      if (!row || !row[slot]) return { ok: true };
      if (row.filter(Boolean).length <= 1) return { ok: false, reason: Input.actionName(action) + ' needs at least one key.' };
      row[slot] = null;
      rebuildKeymap();
      saveBindings();
      return { ok: true };
    },

    /** Puts every key back where it started. */
    resetBindings: function () {
      bindings = copyBindings(DEFAULT_BINDINGS);
      rebuildKeymap();
      saveBindings();
    },

    /** The next key press goes to fn(code) instead of the game; Esc calls fn(null). */
    captureKey: function (fn) {
      capture = typeof fn === 'function' ? fn : null;
      keysDown.clear();
    },

    /** True while captureKey is waiting. */
    capturing: function () {
      return !!capture;
    },

    /** Display name of a key code. */
    keyName: keyName,

    /** Player-facing name of an action. */
    actionName: function (a) {
      const names = { up: 'Up', down: 'Down', left: 'Left', right: 'Right', confirm: 'Confirm',
        cancel: 'Back / Menu', menu: 'Back / Menu', run: 'Run', confide: 'Confide' };
      return names[a] || a;
    },

    /** The keys of an action for hints, e.g. keysFor('confirm') -> 'Z / Enter'. `max` limits the count. */
    keysFor: function (action, max) {
      const a = action === 'menu' ? 'cancel' : action;
      const row = (bindings[a] || []).filter(Boolean);
      if (a === 'cancel') row.splice(1, 0, 'Escape');
      const names = row.slice(0, max || 2).map(keyName);
      return names.length ? names.join(' / ') : '\u2014';
    },

    /** Replaces {key:action} tokens in a hint with the current keys (first key only). */
    fillKeys: function (text) {
      return String(text == null ? '' : text).replace(/\{key:(\w+)\}/g, function (m, a) { return Input.keysFor(a, 1); });
    },

    /** Re-reads the saved bindings (tests). */
    loadBindings: loadBindings,

    /** Releases everything (used on scene changes to avoid a held key leaking into the next scene). */
    reset: function () {
      for (const a of ACTIONS) { simulated[a] = false; latch[a] = false; }
      keysDown.clear();
    },
  };
})();
