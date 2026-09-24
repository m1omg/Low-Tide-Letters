/*
 * boot.js - creates the global namespace G, constants, the data registry and error capture.
 * Safe to load in a Node `vm` sandbox too (no DOM access at load time besides optional `location`).
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};

  let query = null;
  try {
    query = new URLSearchParams(root.location && root.location.search ? root.location.search : '');
  } catch (e) {
    query = null;
  }

  /**
   * Reads a URL query parameter (works on http:// and file://).
   * @param {string} key
   * @returns {string|null}
   */
  G.query = function (key) {
    return query ? query.get(key) : null;
  };

  G.CONFIG = {
    W: 768,
    H: 576,
    TILE: 48,
    SCALE: 2,
    FPS: 60,
    DEBUG: G.query('debug') === '1',
    SELFTEST: G.query('selftest') === '1',
    /** Set by the F1 debug key; the map scene may draw its collision/event overlay when true. */
    DEBUG_OVERLAY: false,
    /** Members beyond this count go to G.State.reserve. */
    MAX_PARTY: 4,
    FONT_BODY: 'PatrickHand',
    FONT_TITLE: 'GochiHand',
    TEXT_SIZE: 24,
    /** Shared sketchbook palette used by the core UI. */
    COLORS: {
      paper: '#fbf5e6',
      paperShade: '#f1e7cf',
      ink: '#2b2433',
      inkSoft: '#6b6276',
      accent: '#e8604c',
      shadow: 'rgba(43,36,51,0.22)',
    },
  };

  G.DATA = {
    strings: {},
    terrains: {},
    objects: {},
    speakers: {},
    actors: {},
    skills: {},
    items: {},
    enemies: {},
    troops: {},
    commonEvents: {},
    maps: {},
    manifest: { images: {}, audio: {} },
  };

  /**
   * Registers a map definition (called by each js/data/maps/<id>.js).
   * @param {string} id
   * @param {object} def map definition, see TECH_SPEC 4.1; `def.id` is filled in.
   * @returns {object} the definition
   */
  G.registerMap = function (id, def) {
    def = def || {};
    def.id = id;
    if (G.DATA.maps[id]) report('warn', 'Map registered twice: ' + id);
    G.DATA.maps[id] = def;
    return def;
  };

  /** Captured runtime errors/warnings as strings ("[warn] ..." / "[error] ..."). */
  G.errors = [];
  const seen = new Set();

  function report(level, msg) {
    const text = '[' + level + '] ' + String(msg);
    if (seen.has(text)) return false;
    seen.add(text);
    G.errors.push(text);
    if (typeof console !== 'undefined') {
      if (level === 'error') console.error(text);
      else console.warn(text);
    }
    return true;
  }

  /**
   * Logs a warning once per distinct message and records it in G.errors.
   * @param {string} msg
   * @returns {boolean} true when the message was new
   */
  G.warn = function (msg) {
    return report('warn', msg);
  };

  /**
   * Logs an error once per distinct message and records it in G.errors.
   * @param {string|Error} msg
   * @returns {boolean} true when the message was new
   */
  G.error = function (msg) {
    if (msg && msg.stack) msg = msg.message + ' @ ' + String(msg.stack).split('\n').slice(1, 3).join(' | ').trim();
    return report('error', msg);
  };

  /**
   * Looks up a generic UI string by dotted key in G.DATA.strings ("menu.items").
   * @param {string} key
   * @param {string} [fallback] returned when the key does not exist (defaults to the key itself)
   * @returns {string}
   */
  G.str = function (key, fallback) {
    let node = G.DATA.strings;
    const parts = String(key).split('.');
    for (let i = 0; i < parts.length && node != null; i++) node = node[parts[i]];
    if (typeof node === 'string') return node;
    return fallback !== undefined ? fallback : key;
  };

  if (typeof root.addEventListener === 'function') {
    root.addEventListener('error', function (e) {
      if (e && e.target && e.target !== root && e.target.tagName === 'SCRIPT') {
        report('error', 'Failed to load script: ' + (e.target.getAttribute('src') || '?'));
        return;
      }
      if (!e || e.target !== root) return;
      const where = e.filename ? ' @ ' + String(e.filename).split('/').slice(-2).join('/') + ':' + e.lineno : '';
      report('error', (e.message || 'Unknown error') + where);
    }, true);
    root.addEventListener('unhandledrejection', function (e) {
      const r = e && e.reason;
      report('error', 'Unhandled rejection: ' + (r && r.message ? r.message : String(r)));
    });
  }
})();
