/*
 * util.js - small pure helpers. Node-safe (battle logic unit tests load this file in a vm sandbox).
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  const U = G.Util = {};

  /** Clamps v into [a, b]. */
  U.clamp = function (v, a, b) {
    return v < a ? a : v > b ? b : v;
  };

  /** Linear interpolation from a to b. */
  U.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };

  /**
   * Creates a deterministic pseudo random generator (mulberry32).
   * @param {number} seed any integer
   * @returns {function(): number} function returning floats in [0, 1)
   */
  U.makeRng = function (seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /**
   * The shared game RNG. All helpers below call `G.Util.rng()` at call time, so tests can reseed by
   * assigning `G.Util.rng = G.Util.makeRng(123)` or calling `G.Util.seed(123)`.
   */
  U.rng = U.makeRng((Date.now() ^ 0x5bd1e995) >>> 0);

  /** Reseeds G.Util.rng. */
  U.seed = function (seed) {
    U.rng = U.makeRng(seed);
  };

  /** Random integer in [a, b] (both inclusive). */
  U.randInt = function (a, b) {
    if (b < a) { const t = a; a = b; b = t; }
    return a + Math.floor(U.rng() * (b - a + 1));
  };

  /** Random float in [a, b). */
  U.randFloat = function (a, b) {
    return a + U.rng() * (b - a);
  };

  /** True with probability p (0..1). */
  U.chance = function (p) {
    return U.rng() < p;
  };

  /** Random element of an array (undefined for an empty array). */
  U.choice = function (arr) {
    if (!arr || !arr.length) return undefined;
    return arr[Math.floor(U.rng() * arr.length)];
  };

  /**
   * Fisher-Yates shuffle. Shuffles IN PLACE and also returns the same array, so both
   * `shuffle(a)` and `a = shuffle(a.slice())` work.
   */
  U.shuffle = function (arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(U.rng() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  /** Deep clone of plain JSON-like data (objects, arrays, primitives). */
  U.deepClone = function (v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) {
      const out = new Array(v.length);
      for (let i = 0; i < v.length; i++) out[i] = U.deepClone(v[i]);
      return out;
    }
    const out = {};
    for (const k of Object.keys(v)) out[k] = U.deepClone(v[k]);
    return out;
  };

  /** Easing functions, all map t in [0,1] to [0,1] (outBack overshoots slightly). */
  U.ease = {
    linear: function (t) { return t; },
    in: function (t) { return t * t; },
    out: function (t) { return 1 - (1 - t) * (1 - t); },
    inOut: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    inCubic: function (t) { return t * t * t; },
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    outBack: function (t) { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    outBounce: function (t) {
      const n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) { t -= 1.5 / d; return n * t * t + 0.75; }
      if (t < 2.5 / d) { t -= 2.25 / d; return n * t * t + 0.9375; }
      t -= 2.625 / d; return n * t * t + 0.984375;
    },
    sine: function (t) { return 0.5 - Math.cos(t * Math.PI) / 2; },
  };

  /** FNV-1a hash of a string -> unsigned 32 bit integer. */
  U.hash = function (str) {
    str = String(str);
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  };

  /** Deterministic noise in [-1, 1) for an integer (seed, index) pair. Used for wobbly pencil lines. */
  U.noise = function (seed, i) {
    let h = (seed | 0) ^ Math.imul((i | 0) + 0x7f4a7c15, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
    h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
    h ^= h >>> 15;
    return ((h >>> 0) / 2147483648) - 1;
  };

  /** Formats a frame count (60 fps) as "h:mm:ss". */
  U.formatTime = function (frames) {
    const total = Math.floor((frames || 0) / 60);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  };

  const waiters = [];

  /**
   * Promise that resolves after n fixed-step frames (driven by G.Util.tick, which the main loop calls
   * once per update step). n <= 0 resolves on the next microtask.
   * @param {number} n
   * @returns {Promise<void>}
   */
  U.waitFrames = function (n) {
    return new Promise(function (resolve) {
      if (!(n > 0)) { resolve(); return; }
      waiters.push({ n: Math.ceil(n), resolve: resolve });
    });
  };

  /** Advances the frame waiters by one step. Called by the main loop only. */
  U.tick = function () {
    for (let i = waiters.length - 1; i >= 0; i--) {
      if (--waiters[i].n <= 0) {
        const w = waiters[i];
        waiters.splice(i, 1);
        w.resolve();
      }
    }
  };
})();
