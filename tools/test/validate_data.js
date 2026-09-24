#!/usr/bin/env node
/*
 * validate_data.js - static checker for every game data file (TECH_SPEC section 11).
 *
 *   node tools/test/validate_data.js              check everything
 *   node tools/test/validate_data.js --map wren_house
 *   node tools/test/validate_data.js --quiet      errors only (no warnings, no summary of ok maps)
 *
 * It runs no browser: every js/data/**\/*.js file is executed inside a Node `vm` sandbox that provides a
 * fake `window` / `G`, so the files register themselves exactly as they do in the game. Nothing is drawn,
 * nothing is loaded from assets/ - image and audio ids are checked against js/data/manifest.js.
 *
 * Output lines:
 *   ERROR <where>: <what>     the game will misbehave. Exit code 1.
 *   WARN  <where>: <what>     probably fine for now (missing art, unused flag, ...). Exit code stays 0.
 * <where> is "<map id>" or "<map id>/<event id> p<page> #<command index>" so you can find it instantly.
 *
 * Data files that do not exist yet are simply skipped (the game is written by several agents at once).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* VALIDATE_ROOT lets the validator's own self-test point it at a throwaway copy of the tree. */
const ROOT = process.env.VALIDATE_ROOT ? path.resolve(process.env.VALIDATE_ROOT) : path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'js', 'data');

/* ====================================================================== options */

const argv = process.argv.slice(2);
const OPT = { map: null, quiet: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--map') OPT.map = argv[++i];
  else if (a.indexOf('--map=') === 0) OPT.map = a.slice(6);
  else if (a === '--quiet' || a === '-q') OPT.quiet = true;
  else if (a === '--help' || a === '-h') {
    console.log('usage: node tools/test/validate_data.js [--map <id>] [--quiet]');
    process.exit(0);
  } else {
    console.log('validate_data: unknown option "' + a + '" (try --help)');
    process.exit(2);
  }
}

/* ====================================================================== reporting */

const errors = [];
const warnings = [];
const seen = new Set();

/** Reports a hard problem: the game will misbehave. */
function err(where, msg) {
  const line = 'ERROR ' + where + ': ' + msg;
  if (seen.has(line)) return;
  seen.add(line);
  errors.push(line);
  console.log(line);
}

/** Reports something suspicious that does not break the game (missing art, unused flag, ...). */
function warn(where, msg) {
  const line = 'WARN  ' + where + ': ' + msg;
  if (seen.has(line)) return;
  seen.add(line);
  warnings.push(line);
  if (!OPT.quiet) console.log(line);
}

function note(msg) {
  if (!OPT.quiet) console.log(msg);
}

/* ====================================================================== loading the data files */

/**
 * Lists every data file in the order index.html loads them (build.js keeps that list correct),
 * then any js/data file the list does not mention yet.
 * @returns {string[]} absolute paths
 */
function dataFiles() {
  const out = [];
  const pushed = new Set();
  const add = function (abs) {
    if (!pushed.has(abs) && fs.existsSync(abs)) { pushed.add(abs); out.push(abs); }
  };
  let html = '';
  try { html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'); } catch (e) { /* no index.html */ }
  const re = /<script src="(js\/data\/[^"]+\.js)"><\/script>/g;
  let m;
  while ((m = re.exec(html))) add(path.join(ROOT, m[1]));

  const walk = function (dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    entries.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('.js')) add(p);
    }
  };
  walk(DATA_DIR);
  return out;
}

/**
 * Executes every data file in a sandbox and returns the resulting G plus a map of "who registered what".
 * @returns {{G:object, owner:object, files:string[]}}
 */
function loadData() {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.console = { log: function () {}, warn: function () {}, error: function () {}, info: function () {} };
  sandbox.setTimeout = function () { return 0; };
  sandbox.clearTimeout = function () {};
  sandbox.document = { fonts: { ready: Promise.resolve() }, getElementById: function () { return null; } };

  const owner = {};                       // 'map:test_map' -> relative file path
  let current = '(unknown)';

  const G = sandbox.G = {
    CONFIG: { W: 768, H: 576, TILE: 48, SCALE: 2, FPS: 60, DEBUG: false },
    DATA: { maps: {} },
    errors: [],
    warn: function (m) { G.errors.push('[warn] ' + m); },
    error: function (m) { G.errors.push('[error] ' + m); },
    str: function (k, d) { return d == null ? k : d; },
    registerMap: function (id, def) {
      def = def || {};
      def.id = id;
      if (G.DATA.maps[id]) err(id, 'map registered twice (' + owner['map:' + id] + ' and ' + current + ')');
      owner['map:' + id] = current;
      G.DATA.maps[id] = def;
      return def;
    },
    Util: {
      clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
      randInt: function (a) { return a; },
      choice: function (a) { return a && a[0]; },
      deepClone: function (o) { return JSON.parse(JSON.stringify(o)); },
      makeRng: function () { return function () { return 0.5; }; },
    },
    Assets: { has: function () { return true; }, size: function () { return { w: 48, h: 48 }; }, img: function () { return null; } },
    Scenes: { register: function () {}, has: function () { return false; } },
    Interpreter: { custom: {} },
    State: { flags: {}, vars: {}, getFlag: function () { return false; }, getVar: function () { return 0; } },
  };
  vm.createContext(sandbox);

  const files = dataFiles();
  for (const abs of files) {
    current = path.relative(ROOT, abs);
    let code;
    try { code = fs.readFileSync(abs, 'utf8'); } catch (e) { err(current, 'cannot read file: ' + e.message); continue; }
    try {
      vm.runInContext(code, sandbox, { filename: current, timeout: 10000 });
    } catch (e) {
      err(current, 'threw while loading: ' + (e && e.stack ? e.stack.split('\n')[0] : e));
    }
  }
  return { G: G, owner: owner, files: files.map(function (f) { return path.relative(ROOT, f); }) };
}

/* ====================================================================== known vocabularies */

const DIRS = ['up', 'down', 'left', 'right'];
const EMOTES = ['!', '?', '...', 'heart', 'sweat', 'anger', 'tear', 'note'];
const TRIGGERS = ['action', 'touch', 'auto', 'parallel'];
const MOVE_TYPES = ['still', 'wander', 'patrol', 'chase', 'flee'];
const COND_KEYS = ['flag', 'notFlag', 'var', 'hasItem', 'notItem', 'inParty', 'notInParty', 'self', 'notSelf', 'all', 'any', 'not'];
const VAR_OPS = ['==', '!=', '>', '>=', '<', '<='];
const BUILTIN_CUSTOM = ['ghost_choice', 'letter_compose', 'rock_pool', 'keep_or_say'];

const SKILL_TARGETS = ['enemy', 'all_enemies', 'ally', 'other_ally', 'party', 'self', 'two_allies'];
const SKILL_TYPES = ['damage', 'heal', 'buff', 'debuff', 'glass', 'say'];
const ITEM_KINDS = ['consumable', 'keepsake', 'key', 'glass'];
const GLASS_COLOURS = ['red', 'blue', 'amber', 'green', 'any', 'same_as_first'];

/* Args counted WITHOUT the command name. */
const ARITY = {
  say: [3, 3], narrate: [1, 2], think: [1, 1], choice: [2, 3],
  if: [2, 3], label: [1, 1], goto: [1, 1], call: [1, 1], wait: [1, 1], end: [0, 0],
  setFlag: [1, 2], setVar: [3, 3], setSelf: [1, 2],
  giveItem: [1, 2], takeItem: [1, 2], giveMoney: [1, 1],
  addMember: [1, 1], removeMember: [1, 1], healAll: [0, 0], giveExp: [1, 1],
  save: [0, 0], shop: [1, 1],
  transfer: [3, 5], move: [2, 3], face: [2, 2], emote: [2, 2],
  fade: [1, 3], flash: [0, 2], shake: [0, 2], tint: [1, 2],
  cg: [1, 2], bgm: [1, 2], bgmFade: [0, 1], sfx: [1, 2], ambience: [1, 1],
  camera: [1, 2], setSprite: [2, 2], erase: [0, 1],
  battle: [1, 3], ending: [1, 1], title: [0, 0], gameover: [0, 0], custom: [1, 2],
};

/* ====================================================================== main */

const loaded = loadData();
const G = loaded.G;
const D = G.DATA;
const MAN = D.manifest || { images: {}, audio: {} };
const IMAGES = MAN.images || {};
const AUDIO = MAN.audio || {};

const has = function (obj, id) { return !!(obj && Object.prototype.hasOwnProperty.call(obj, id)); };
const present = function (obj) { return !!obj && Object.keys(obj).length > 0; };

/* Ids that start with "test_" belong to the engine's own test content (test_map, test_room, the
 * placeholder actor). They may point at things the real game no longer defines, so an unknown
 * test_* id is only a warning. Everything else is an error. */
const isTestId = function (id) { return typeof id === 'string' && /(^|_)test(_|$)/.test(id); };
const missing = function (where, msg, id) { if (isTestId(id)) warn(where, msg + ' [test content]'); else err(where, msg); };

/* which optional data files exist at all - references into a missing table are not errors yet */
const HAVE = {
  items: present(D.items),
  actors: present(D.actors),
  skills: present(D.skills),
  enemies: present(D.enemies),
  troops: present(D.troops),
  endings: present(D.endings),
  speakers: present(D.speakers),
  terrains: present(D.terrains),
  objects: present(D.objects),
  commonEvents: present(D.commonEvents),
};

/* custom command names: the bible list plus anything registered in js/scenes/custom_ui.js */
const customNames = new Set(BUILTIN_CUSTOM);
(function () {
  const f = path.join(ROOT, 'js', 'scenes', 'custom_ui.js');
  if (!fs.existsSync(f)) return;
  let src = '';
  try { src = fs.readFileSync(f, 'utf8'); } catch (e) { return; }
  const res = [
    /custom\s*\[\s*['"]([A-Za-z0-9_]+)['"]\s*\]\s*=/g,
    /custom\.([A-Za-z0-9_]+)\s*=/g,
    /^\s*([A-Za-z0-9_]+)\s*:\s*(?:async\s+)?function/gm,
  ];
  for (const re of res) { let m; while ((m = re.exec(src))) customNames.add(m[1]); }
})();

/* collected cross-file facts */
const flagWrites = new Map();   // name -> [where, ...]
const flagReads = new Map();
const varWrites = new Map();
const varReads = new Map();
const transfersInto = new Map(); // mapId -> [{x, y, dir, where}]
const troopsUsed = new Set();
const endingsUsed = new Set();

function record(map, key, where) {
  if (!key || typeof key !== 'string') return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(where);
}

/* ---------------------------------------------------------------- asset helpers */

function needImage(where, id, what) {
  if (id == null) return;
  if (typeof id !== 'string') { err(where, what + ' image id must be a string, got ' + JSON.stringify(id)); return; }
  if (!has(IMAGES, id)) warn(where, what + ' image "' + id + '" is not in the manifest (art not produced yet?)');
}

function needAudio(where, id, what) {
  if (id == null || id === 'none') return;
  if (typeof id !== 'string') { err(where, what + ' audio id must be a string, got ' + JSON.stringify(id)); return; }
  if (!has(AUDIO, id)) warn(where, what + ' audio "' + id + '" is not in the manifest (not composed yet?)');
}

/* ---------------------------------------------------------------- conditions */

/**
 * Validates a condition (TECH_SPEC 4.3) and records the flags/vars/items it reads.
 * @param {*} cond
 * @param {string} where
 */
function checkCond(cond, where) {
  if (cond == null || cond === true || cond === false) return;
  if (Array.isArray(cond)) { for (const c of cond) checkCond(c, where); return; }
  if (typeof cond !== 'object') { err(where, 'condition must be null or an object, got ' + JSON.stringify(cond)); return; }
  for (const key of Object.keys(cond)) {
    const v = cond[key];
    if (COND_KEYS.indexOf(key) < 0) { err(where, 'unknown condition key "' + key + '" (allowed: ' + COND_KEYS.join(', ') + ')'); continue; }
    switch (key) {
      case 'flag': case 'notFlag':
        if (typeof v !== 'string') err(where, 'condition {' + key + '} needs a flag name');
        else record(flagReads, v, where);
        break;
      case 'var':
        if (!Array.isArray(v) || v.length !== 3) { err(where, 'condition {var} must be [name, op, value]'); break; }
        if (typeof v[0] !== 'string') err(where, 'condition {var}: first element must be the variable name');
        else record(varReads, v[0], where);
        if (VAR_OPS.indexOf(v[1]) < 0) err(where, 'condition {var}: bad operator "' + v[1] + '" (' + VAR_OPS.join(' ') + ')');
        if (typeof v[2] === 'string') record(varReads, v[2], where);
        break;
      case 'hasItem': case 'notItem':
        if (typeof v !== 'string') err(where, 'condition {' + key + '} needs an item id');
        else if (HAVE.items && !has(D.items, v)) err(where, 'condition {' + key + '}: unknown item "' + v + '"');
        break;
      case 'inParty': case 'notInParty':
        if (typeof v !== 'string') err(where, 'condition {' + key + '} needs an actor id');
        else if (HAVE.actors && !has(D.actors, v)) err(where, 'condition {' + key + '}: unknown actor "' + v + '"');
        break;
      case 'self': case 'notSelf':
        if (typeof v !== 'string') err(where, 'condition {' + key + '} needs a self-flag name');
        break;
      case 'all': case 'any':
        if (!Array.isArray(v)) { err(where, 'condition {' + key + '} needs an array of conditions'); break; }
        for (const c of v) checkCond(c, where);
        break;
      case 'not':
        checkCond(v, where);
        break;
      default: break;
    }
  }
}

/* ---------------------------------------------------------------- text */

/** Records `{v:name}` reads and flags obviously broken markup. */
function checkText(text, where) {
  if (text == null) return;
  if (typeof text !== 'string') { err(where, 'text must be a string, got ' + JSON.stringify(text)); return; }
  let m;
  const re = /\{v:([A-Za-z0-9_]+)\}/g;
  while ((m = re.exec(text))) record(varReads, m[1], where);
  const open = (text.match(/\{(c:[a-z]+|shake|wave|big|small)\}/g) || []).length;
  const close = (text.match(/\{\/(c|shake|wave|big|small)\}/g) || []).length;
  if (open !== close) warn(where, 'rich-text tags look unbalanced (' + open + ' opening, ' + close + ' closing)');
}

/* ---------------------------------------------------------------- speakers */

function checkSpeaker(id, expr, where) {
  if (id == null) return;
  if (typeof id !== 'string') { err(where, 'speaker id must be a string or null, got ' + JSON.stringify(id)); return; }
  if (!has(D.speakers, id)) {
    if (HAVE.speakers) err(where, 'unknown speaker "' + id + '" (add it to js/data/speakers.js)');
    return;
  }
  const sp = D.speakers[id];
  if (!sp.faces) {
    if (expr && expr !== 'neutral') warn(where, 'speaker "' + id + '" has no portraits, so expression "' + expr + '" is ignored');
    return;
  }
  const e = expr || 'neutral';
  if (typeof e !== 'string') { err(where, 'expression must be a string or null, got ' + JSON.stringify(expr)); return; }
  const imgId = 'face_' + sp.faces + '_' + e;
  if (!has(IMAGES, imgId)) warn(where, 'no portrait "' + imgId + '" for speaker "' + id + '" expression "' + e + '"');
}

/* ---------------------------------------------------------------- command lists */

/**
 * Walks a command list recursively (choice branches, if branches, battle outcome branches).
 * @param {*} list
 * @param {string} where
 * @param {{mapId:string}} env
 */
function checkCommands(list, where, env) {
  if (!Array.isArray(list)) { err(where, 'command list must be an array, got ' + JSON.stringify(list)); return; }
  const labels = new Map();
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (Array.isArray(c) && c[0] === 'label') {
      if (typeof c[1] !== 'string') continue;
      if (labels.has(c[1])) warn(where + ' #' + i, 'duplicate label "' + c[1] + '" in the same list');
      else labels.set(c[1], i);
    }
  }
  const usedLabels = new Set();

  for (let i = 0; i < list.length; i++) {
    const cmd = list[i];
    const w = where + ' #' + i;
    if (!Array.isArray(cmd) || typeof cmd[0] !== 'string') {
      err(w, 'malformed command ' + JSON.stringify(cmd) + ' (must be an array starting with the command name)');
      continue;
    }
    const name = cmd[0];
    const ar = ARITY[name];
    if (!ar) {
      err(w, 'unknown command "' + name + '" (see TECH_SPEC 4.4 / js/map/interpreter.js)');
      continue;
    }
    const n = cmd.length - 1;
    if (n < ar[0] || n > ar[1]) {
      err(w, '["' + name + '", ...] takes ' + (ar[0] === ar[1] ? ar[0] : ar[0] + '-' + ar[1]) + ' argument(s), got ' + n);
      continue;
    }
    checkCommand(name, cmd, w, env, labels, usedLabels);
  }

  for (const [lbl, at] of labels) {
    if (!usedLabels.has(lbl)) warn(where + ' #' + at, 'label "' + lbl + '" is never used by a goto in this list');
  }
}

function checkCommand(name, cmd, w, env, labels, usedLabels) {
  switch (name) {
    case 'say':
      checkSpeaker(cmd[1], cmd[2], w);
      checkText(cmd[3], w);
      break;
    case 'narrate': case 'think':
      checkText(cmd[1], w);
      break;

    case 'choice': {
      const options = cmd[1], branches = cmd[2], o = cmd[3] || {};
      if (!Array.isArray(options) || !options.length) { err(w, 'choice needs a non-empty array of option strings'); break; }
      options.forEach(function (t, k) {
        if (typeof t === 'string') checkText(t, w + ' option ' + k);
        else if (t && typeof t === 'object' && typeof t.text === 'string') checkText(t.text, w + ' option ' + k);
        else err(w, 'choice option ' + k + ' must be a string');
      });
      if (!Array.isArray(branches)) { err(w, 'choice needs an array of branches'); break; }
      if (branches.length > options.length) err(w, 'choice has ' + branches.length + ' branches but only ' + options.length + ' options');
      branches.forEach(function (b, k) {
        if (b == null) return;
        checkCommands(b, w + ' branch ' + k, env);
      });
      if (typeof o !== 'object') { err(w, 'choice options argument must be an object'); break; }
      if (o.cancel != null && (typeof o.cancel !== 'number' || o.cancel < -1 || o.cancel >= options.length)) {
        err(w, 'choice cancel index ' + o.cancel + ' is out of range (-1 .. ' + (options.length - 1) + ')');
      }
      if (o.varName != null) {
        if (typeof o.varName !== 'string') err(w, 'choice varName must be a string');
        else record(varWrites, o.varName, w);
      }
      break;
    }

    case 'if':
      checkCond(cmd[1], w);
      if (cmd[2] != null) checkCommands(cmd[2], w + ' then', env);
      if (cmd[3] != null) checkCommands(cmd[3], w + ' else', env);
      break;

    case 'goto':
      if (typeof cmd[1] !== 'string') { err(w, 'goto needs a label name'); break; }
      if (!labels.has(cmd[1])) err(w, 'goto "' + cmd[1] + '" has no matching ["label","' + cmd[1] + '"] in this list');
      else usedLabels.add(cmd[1]);
      break;

    case 'label':
      if (typeof cmd[1] !== 'string') err(w, 'label needs a name');
      break;

    case 'call': {
      const id = cmd[1];
      if (typeof id !== 'string') { err(w, 'call needs a common event id'); break; }
      if (!has(D.commonEvents, id)) {
        if (HAVE.commonEvents) missing(w, 'unknown common event "' + id + '" (js/data/common_events.js)', id);
        else warn(w, 'common event "' + id + '" cannot be checked: js/data/common_events.js has no entries yet');
      }
      break;
    }

    case 'wait':
      if (typeof cmd[1] !== 'number' || cmd[1] < 0) err(w, 'wait needs a frame count >= 0');
      break;

    case 'setFlag':
      if (typeof cmd[1] !== 'string') { err(w, 'setFlag needs a flag name'); break; }
      record(flagWrites, cmd[1], w);
      if (cmd.length > 2 && typeof cmd[2] !== 'boolean') err(w, 'setFlag value must be true or false');
      break;

    case 'setVar': {
      if (typeof cmd[1] !== 'string') { err(w, 'setVar needs a variable name'); break; }
      record(varWrites, cmd[1], w);
      if (['=', '+', '-', '*'].indexOf(cmd[2]) < 0) err(w, 'setVar operator must be one of = + - * (got ' + JSON.stringify(cmd[2]) + ')');
      if (typeof cmd[3] === 'string') record(varReads, cmd[3], w);
      else if (typeof cmd[3] !== 'number') err(w, 'setVar value must be a number or the name of another variable');
      if (cmd[2] !== '=') record(varReads, cmd[1], w);
      break;
    }

    case 'setSelf':
      if (typeof cmd[1] !== 'string') err(w, 'setSelf needs a self-flag name');
      if (env.eventId == null) warn(w, 'setSelf outside an event context has no effect');
      break;

    case 'giveItem': case 'takeItem': {
      const id = cmd[1];
      if (typeof id !== 'string') { err(w, name + ' needs an item id'); break; }
      if (HAVE.items && !has(D.items, id)) missing(w, 'unknown item "' + id + '" (js/data/items.js)', id);
      else if (!HAVE.items) warn(w, 'item "' + id + '" cannot be checked: js/data/items.js does not exist yet');
      if (cmd.length > 2 && (typeof cmd[2] !== 'number' || cmd[2] < 1)) err(w, name + ' count must be a positive number');
      break;
    }

    case 'giveMoney': case 'giveExp':
      if (typeof cmd[1] !== 'number') err(w, name + ' needs a number');
      break;

    case 'addMember': case 'removeMember': {
      const id = cmd[1];
      if (typeof id !== 'string') { err(w, name + ' needs an actor id'); break; }
      if (HAVE.actors && !has(D.actors, id)) missing(w, 'unknown actor "' + id + '" (js/data/actors.js)', id);
      break;
    }

    case 'shop': {
      if (!Array.isArray(cmd[1])) { err(w, 'shop needs an array of item ids'); break; }
      for (const id of cmd[1]) {
        if (typeof id !== 'string') err(w, 'shop item ids must be strings');
        else if (HAVE.items && !has(D.items, id)) err(w, 'shop: unknown item "' + id + '"');
      }
      break;
    }

    case 'transfer': {
      const mapId = cmd[1];
      if (typeof mapId !== 'string') { err(w, 'transfer needs a map id'); break; }
      if (typeof cmd[2] !== 'number' || typeof cmd[3] !== 'number') { err(w, 'transfer needs numeric x and y'); break; }
      if (cmd.length > 4 && cmd[4] != null && DIRS.indexOf(cmd[4]) < 0) err(w, 'transfer direction must be one of ' + DIRS.join('/'));
      if (cmd.length > 5 && cmd[5] != null && typeof cmd[5] !== 'object') err(w, 'transfer options must be an object');
      if (!has(D.maps, mapId)) { err(w, 'transfer to unknown map "' + mapId + '"'); break; }
      record(transfersInto, mapId, { x: cmd[2], y: cmd[3], where: w });
      const t = D.maps[mapId];
      if (cmd[2] < 0 || cmd[3] < 0 || cmd[2] >= (t.width | 0) || cmd[3] >= (t.height | 0)) {
        err(w, 'transfer target ' + cmd[2] + ',' + cmd[3] + ' is outside map "' + mapId + '" (' + t.width + 'x' + t.height + ')');
        break;
      }
      const coll = collisionOf(mapId);
      if (coll && coll.blocked[cmd[3] * coll.w + cmd[2]]) {
        err(w, 'transfer lands on an impassable tile ' + cmd[2] + ',' + cmd[3] + ' of map "' + mapId + '"');
      }
      break;
    }

    case 'move': {
      checkCharRef(cmd[1], w, env, 'move');
      const steps = cmd[2];
      if (!Array.isArray(steps)) { err(w, 'move needs an array of route steps'); break; }
      for (const st of steps) checkRouteStep(st, w);
      if (cmd.length > 3 && cmd[3] != null && typeof cmd[3] !== 'object') err(w, 'move options must be an object');
      break;
    }

    case 'face':
      checkCharRef(cmd[1], w, env, 'face');
      if (DIRS.indexOf(cmd[2]) < 0 && cmd[2] !== 'toward_player' && cmd[2] !== 'away') {
        err(w, 'face direction must be ' + DIRS.join('/') + ', toward_player or away (got ' + JSON.stringify(cmd[2]) + ')');
      }
      break;

    case 'emote':
      checkCharRef(cmd[1], w, env, 'emote');
      if (EMOTES.indexOf(cmd[2]) < 0) err(w, 'unknown emote ' + JSON.stringify(cmd[2]) + ' (allowed: ' + EMOTES.join(' ') + ')');
      break;

    case 'fade':
      if (cmd[1] !== 'out' && cmd[1] !== 'in') err(w, 'fade must be "out" or "in"');
      if (cmd.length > 2 && cmd[2] != null && typeof cmd[2] !== 'number') err(w, 'fade frames must be a number');
      if (cmd.length > 3 && cmd[3] != null && typeof cmd[3] !== 'string') err(w, 'fade colour must be a colour string');
      break;

    case 'flash':
      if (cmd.length > 1 && cmd[1] != null && typeof cmd[1] !== 'string') err(w, 'flash colour must be a string like "#fff"');
      if (cmd.length > 2 && cmd[2] != null && typeof cmd[2] !== 'number') err(w, 'flash frames must be a number');
      break;

    case 'shake':
      for (let k = 1; k < cmd.length; k++) if (cmd[k] != null && typeof cmd[k] !== 'number') err(w, 'shake takes numbers (power, frames)');
      break;

    case 'tint':
      if (cmd[1] != null) {
        if (!Array.isArray(cmd[1]) || cmd[1].length !== 4) err(w, 'tint needs [r,g,b,a] or null');
      }
      if (cmd.length > 2 && cmd[2] != null && typeof cmd[2] !== 'number') err(w, 'tint frames must be a number');
      break;

    case 'cg':
      if (cmd[1] != null) {
        if (typeof cmd[1] !== 'string') err(w, 'cg needs an image id or null');
        else needImage(w, cmd[1], 'cg');
      }
      break;

    case 'bgm':
      if (typeof cmd[1] !== 'string' && cmd[1] !== null) err(w, 'bgm needs an id, "none" or null');
      else needAudio(w, cmd[1], 'bgm');
      break;

    case 'sfx':
      if (typeof cmd[1] !== 'string') err(w, 'sfx needs a sound id');
      else needAudio(w, cmd[1], 'sfx');
      break;

    case 'ambience':
      if (cmd[1] != null && typeof cmd[1] !== 'string') err(w, 'ambience needs an id, "none" or null');
      else needAudio(w, cmd[1], 'ambience');
      break;

    case 'bgmFade':
      if (cmd.length > 1 && cmd[1] != null && typeof cmd[1] !== 'number') err(w, 'bgmFade takes milliseconds');
      break;

    case 'camera':
      if (Array.isArray(cmd[1])) {
        if (cmd[1].length !== 2 || typeof cmd[1][0] !== 'number') err(w, 'camera target must be [x,y]');
      } else checkCharRef(cmd[1], w, env, 'camera');
      break;

    case 'setSprite':
      checkCharRef(cmd[1], w, env, 'setSprite');
      checkSprite(cmd[2], w, true);
      break;

    case 'erase':
      if (cmd.length > 1 && cmd[1] != null) checkCharRef(cmd[1], w, env, 'erase', true);
      break;

    case 'battle': {
      const troop = cmd[1];
      const o = (cmd[3] && typeof cmd[3] === 'object') ? cmd[3] : (cmd[2] && typeof cmd[2] === 'object' ? cmd[2] : {});
      if (typeof troop !== 'string') { err(w, 'battle needs a troop id'); break; }
      troopsUsed.add(troop);
      if (HAVE.troops && !has(D.troops, troop)) missing(w, 'unknown troop "' + troop + '" (js/data/troops.js)', troop);
      else if (!HAVE.troops) warn(w, 'troop "' + troop + '" cannot be checked: js/data/troops.js does not exist yet');
      if (o.bgm) needAudio(w, o.bgm, 'battle bgm');
      if (o.back) needImage(w, o.back, 'battleback');
      for (const key of ['onWin', 'onPeace', 'onLose', 'onEscape', 'onTimeout']) {
        const b = o[key];
        if (b == null) continue;
        if (b === 'gameover') continue;
        if (!Array.isArray(b)) { err(w, 'battle ' + key + ' must be a command list (or "gameover")'); continue; }
        checkCommands(b, w + ' ' + key, env);
      }
      for (const key of Object.keys(o)) {
        if (['canEscape', 'bgm', 'back', 'onWin', 'onPeace', 'onLose', 'onEscape', 'onTimeout'].indexOf(key) < 0) {
          warn(w, 'battle option "' + key + '" is not part of the contract (TECH_SPEC Battle addendum)');
        }
      }
      break;
    }

    case 'ending': {
      const id = cmd[1];
      if (typeof id !== 'string') { err(w, 'ending needs an ending id'); break; }
      endingsUsed.add(id);
      if (HAVE.endings && !has(D.endings, id)) missing(w, 'unknown ending "' + id + '" (G.DATA.endings)', id);
      else if (!HAVE.endings) warn(w, 'ending "' + id + '" cannot be checked: G.DATA.endings does not exist yet');
      break;
    }

    case 'custom': {
      const cname = cmd[1];
      if (typeof cname !== 'string') { err(w, 'custom needs a command name'); break; }
      if (!customNames.has(cname)) {
        err(w, 'unknown custom command "' + cname + '" (known: ' + Array.from(customNames).sort().join(', ') + ')');
      }
      if (cmd.length > 2 && cmd[2] != null && typeof cmd[2] !== 'object') err(w, 'custom args must be an object or array');
      if (cmd[2] && typeof cmd[2] === 'object' && typeof cmd[2].varName === 'string') record(varWrites, cmd[2].varName, w);
      if (cmd[2] && Array.isArray(cmd[2].options)) {
        cmd[2].options.forEach(function (op, k) {
          if (op && typeof op.text === 'string') checkText(op.text, w + ' option ' + k);
        });
      }
      break;
    }

    default: break;
  }
}

function checkRouteStep(st, w) {
  if (typeof st === 'string') {
    if (DIRS.indexOf(st) >= 0) return;
    if (st.indexOf('face_') === 0 && DIRS.indexOf(st.slice(5)) >= 0) return;
    if (['jump', 'hide', 'show', 'wait'].indexOf(st) >= 0) return;
    err(w, 'unknown move route step "' + st + '"');
    return;
  }
  if (Array.isArray(st)) {
    const n = st[0];
    if (n === 'wait' || n === 'speed') {
      if (typeof st[1] !== 'number') err(w, 'move route ["' + n + '", n] needs a number');
      return;
    }
    if (n === 'to') {
      if (typeof st[1] !== 'number' || typeof st[2] !== 'number') err(w, 'move route ["to",x,y] needs numbers');
      return;
    }
    if (n === 'face') {
      if (DIRS.indexOf(st[1]) < 0) err(w, 'move route ["face",dir] needs ' + DIRS.join('/'));
      return;
    }
    err(w, 'unknown move route step ' + JSON.stringify(st));
    return;
  }
  err(w, 'move route step must be a string or an array, got ' + JSON.stringify(st));
}

function checkCharRef(ref, w, env, cmdName, mustBeEvent) {
  if (ref == null) {
    if (mustBeEvent) err(w, cmdName + ' needs an event id');
    return;
  }
  if (typeof ref !== 'string') { err(w, cmdName + ' target must be "player", "this" or an event id'); return; }
  if (ref === 'player' || ref === 'hero') { if (mustBeEvent) err(w, cmdName + ' cannot target the player'); return; }
  if (ref === 'this' || ref === 'self') {
    if (env.eventId == null) err(w, cmdName + ' uses "this" outside an event');
    return;
  }
  const map = env.mapId ? D.maps[env.mapId] : null;
  if (!map) return;                              // common events run on whatever map called them
  const ids = (map.events || []).map(function (e) { return e && e.id; });
  if (ids.indexOf(ref) < 0) err(w, cmdName + ': map "' + env.mapId + '" has no event "' + ref + '"');
}

/* ---------------------------------------------------------------- sprites */

function checkSprite(spec, w, allowNull) {
  if (spec == null) {
    if (!allowNull) return;
    return;
  }
  if (typeof spec !== 'object') { err(w, 'sprite spec must be an object or null, got ' + JSON.stringify(spec)); return; }
  if (spec.char != null) {
    const id = String(spec.char).indexOf('char_') === 0 ? spec.char : 'char_' + spec.char;
    needImage(w, id, 'character sprite');
    if (spec.dir != null && DIRS.indexOf(spec.dir) < 0) err(w, 'sprite dir must be ' + DIRS.join('/'));
    return;
  }
  if (spec.obj != null) {
    const raw = String(spec.obj);
    if (has(D.objects, raw)) { needImage(w, D.objects[raw].img, 'object sprite'); return; }
    const id = raw.indexOf('obj_') === 0 ? raw : 'obj_' + raw;
    if (has(IMAGES, id)) return;
    if (HAVE.objects) err(w, 'sprite {obj:"' + raw + '"} is neither an object id (js/data/objects.js) nor an image id');
    else warn(w, 'sprite {obj:"' + raw + '"}: no such object or image "' + id + '" yet');
    return;
  }
  if (spec.enemy != null) {
    const raw = String(spec.enemy);
    if (HAVE.enemies && !has(D.enemies, raw) && raw.indexOf('en_') !== 0) {
      warn(w, 'sprite {enemy:"' + raw + '"} is not an enemy id in js/data/enemies.js');
    }
    needImage(w, raw.indexOf('en_') === 0 ? raw : 'en_' + raw, 'enemy sprite');
    return;
  }
  err(w, 'sprite spec must be {char}, {obj}, {enemy} or null, got ' + JSON.stringify(spec));
}

/* ---------------------------------------------------------------- collision + reachability */

const collCache = {};

/**
 * Builds the collision grid of a map exactly like map_scene._buildCollision.
 * @returns {{w:number,h:number,blocked:Uint8Array}|null}
 */
function collisionOf(mapId) {
  if (collCache[mapId] !== undefined) return collCache[mapId];
  const def = D.maps[mapId];
  if (!def) { collCache[mapId] = null; return null; }
  const w = def.width | 0, h = def.height | 0;
  if (w <= 0 || h <= 0) { collCache[mapId] = null; return null; }
  const blocked = new Uint8Array(w * h);
  const legend = def.legend || {};
  const rows = def.ground || [];
  for (let y = 0; y < h; y++) {
    const row = typeof rows[y] === 'string' ? rows[y] : '';
    for (let x = 0; x < w; x++) {
      const ch = row.charAt(x) || ' ';
      const tid = legend[ch];
      const t = tid ? D.terrains[tid] : null;
      if (!t || t.passable === false) blocked[y * w + x] = 1;
    }
  }
  const block = function (x, y) { if (x >= 0 && y >= 0 && x < w && y < h) blocked[y * w + x] = 1; };
  for (const o of def.objects || []) {
    if (!o || typeof o !== 'object') continue;
    const d = D.objects ? D.objects[o.obj] : null;
    if (!d || !d.solid) continue;
    for (const r of footprints(d)) {
      const rw = (r[2] | 0) || 1, rh = (r[3] | 0) || 1;
      for (let dy = 0; dy < rh; dy++) for (let dx = 0; dx < rw; dx++) block((o.x | 0) + (r[0] | 0) + dx, (o.y | 0) + (r[1] | 0) + dy);
    }
  }
  const ov = def.overrides || {};
  for (const p of ov.block || []) if (Array.isArray(p)) block(p[0], p[1]);
  for (const p of ov.open || []) {
    if (Array.isArray(p) && p[0] >= 0 && p[1] >= 0 && p[0] < w && p[1] < h) blocked[p[1] * w + p[0]] = 0;
  }
  const out = { w: w, h: h, blocked: blocked };
  collCache[mapId] = out;
  return out;
}

function footprints(d) {
  const fp = d.fp;
  if (!fp) return [[0, 0, 1, 1]];
  if (Array.isArray(fp) && Array.isArray(fp[0])) return fp;
  return [fp];
}

/** True when this page makes the event block the tile it stands on. */
function pageSolid(p) {
  if (!p || typeof p !== 'object') return false;
  return p.solid != null ? !!p.solid : !!p.sprite;
}

/** Pages of an event, expanding the roaming-enemy sugar of TECH_SPEC 4.2. */
function pagesOf(ev) {
  if (ev && ev.enemy) {
    const e = ev.enemy;
    return [{
      cond: e.cond || null,
      sprite: { enemy: e.sprite || ev.id },
      solid: e.solid != null ? e.solid : false,
      trigger: 'touch',
      move: e.move || { type: 'wander', radius: 3 },
      through: !!e.through,
      commands: [['battle', e.troop, {
        canEscape: e.canEscape !== false, bgm: e.bgm || null, back: e.back || null,
        onWin: [], onPeace: [], onLose: e.onLose || 'gameover', onEscape: e.onEscape || [],
      }]],
      _synthetic: true,
    }];
  }
  return (ev && ev.pages) || [];
}

/**
 * Flood fill from a set of tiles.
 * @returns {Uint8Array} 1 where the player can stand
 */
function flood(coll, starts, eventBlocks) {
  const w = coll.w, h = coll.h;
  const seen = new Uint8Array(w * h);
  const queue = [];
  const open = function (x, y) {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    if (coll.blocked[y * w + x]) return false;
    if (eventBlocks && eventBlocks.has(x + ',' + y)) return false;
    return true;
  };
  for (const s of starts) {
    if (s.x < 0 || s.y < 0 || s.x >= w || s.y >= h) continue;
    const i = s.y * w + s.x;
    if (seen[i]) continue;
    seen[i] = 1;
    queue.push(i);                        // a start tile counts as reached even when it is blocked
  }
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const x = i % w, y = (i / w) | 0;
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [nx, ny] of nb) {
      if (!open(nx, ny)) continue;
      const j = ny * w + nx;
      if (seen[j]) continue;
      seen[j] = 1;
      queue.push(j);
    }
  }
  return seen;
}

function reachedOrAdjacent(seen, coll, x, y) {
  const w = coll.w, h = coll.h;
  if (x >= 0 && y >= 0 && x < w && y < h && seen[y * w + x]) return true;
  const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
  for (const [nx, ny] of nb) {
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    if (seen[ny * w + nx]) return true;
  }
  return false;
}

/* ====================================================================== map checks */

function checkMap(mapId) {
  const def = D.maps[mapId];
  const where = mapId;

  /* -- header ------------------------------------------------------------------- */
  const w = def.width | 0, h = def.height | 0;
  if (!(def.width > 0) || !(def.height > 0)) { err(where, 'width/height must be positive numbers'); return; }
  if (w < 16 || h < 12) warn(where, 'map is ' + w + 'x' + h + '; TECH_SPEC 4.1 expects at least 16x12 (smaller rooms are centred on the backdrop)');
  if (typeof def.name !== 'string' || !def.name) warn(where, 'map has no `name`');
  if (def.bgm != null && def.bgm !== 'none') needAudio(where, def.bgm, 'map bgm');
  if (def.ambience != null && def.ambience !== 'none') needAudio(where, def.ambience, 'map ambience');
  if (def.battleback != null) needImage(where, def.battleback, 'map battleback');
  if (def.tint != null && (!Array.isArray(def.tint) || def.tint.length !== 4)) err(where, 'tint must be [r,g,b,a] or null');
  if (def.backdrop != null && typeof def.backdrop !== 'string') err(where, 'backdrop must be a colour string');

  /* -- ground grid and legend ----------------------------------------------------- */
  const legend = def.legend || {};
  if (!Object.keys(legend).length) err(where, 'map has no `legend`');
  for (const ch of Object.keys(legend)) {
    if (ch.length !== 1) err(where, 'legend key "' + ch + '" must be exactly one character');
    const tid = legend[ch];
    if (typeof tid !== 'string') { err(where, 'legend["' + ch + '"] must be a terrain id'); continue; }
    if (!has(D.terrains, tid)) { err(where, 'legend["' + ch + '"]: unknown terrain "' + tid + '" (js/data/terrains.js)'); continue; }
    const t = D.terrains[tid];
    if (t.img) needImage(where, t.img, 'terrain "' + tid + '"');
    if (t.step) needAudio(where, t.step, 'terrain "' + tid + '" step');
  }

  const rows = def.ground || [];
  if (!Array.isArray(rows)) err(where, '`ground` must be an array of strings');
  else {
    if (rows.length !== h) err(where, 'ground has ' + rows.length + ' rows, expected height ' + h);
    const usedChars = new Set();
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      if (typeof row !== 'string') { err(where, 'ground row ' + y + ' is not a string'); continue; }
      if (row.length !== w) err(where, 'ground row ' + y + ' is ' + row.length + ' chars, expected width ' + w);
      for (let x = 0; x < row.length; x++) {
        const ch = row.charAt(x);
        usedChars.add(ch);
        if (!has(legend, ch)) err(where, 'ground ' + x + ',' + y + ': legend has no entry for "' + ch + '"');
      }
    }
    for (const ch of Object.keys(legend)) {
      if (!usedChars.has(ch)) warn(where, 'legend entry "' + ch + '" (' + legend[ch] + ') is never used in the ground');
    }
  }

  /* -- objects -------------------------------------------------------------------- */
  for (let i = 0; i < (def.objects || []).length; i++) {
    const o = def.objects[i];
    const ow = where + ' object #' + i;
    if (!o || typeof o !== 'object') { err(ow, 'object entry must be {obj, x, y}'); continue; }
    if (typeof o.obj !== 'string') { err(ow, 'object entry needs an `obj` id'); continue; }
    if (!has(D.objects, o.obj)) { err(ow, 'unknown object "' + o.obj + '" (js/data/objects.js)'); continue; }
    if (typeof o.x !== 'number' || typeof o.y !== 'number') { err(ow, 'object "' + o.obj + '" needs numeric x,y'); continue; }
    if (o.x < 0 || o.y < 0 || o.x >= w || o.y >= h) err(ow, 'object "' + o.obj + '" at ' + o.x + ',' + o.y + ' is outside the map');
    needImage(ow, D.objects[o.obj].img, 'object "' + o.obj + '"');
  }

  /* -- overrides ------------------------------------------------------------------- */
  const ov = def.overrides || {};
  for (const key of ['block', 'open']) {
    for (const p of ov[key] || []) {
      if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'number') { err(where, 'overrides.' + key + ' entries must be [x,y]'); continue; }
      if (p[0] < 0 || p[1] < 0 || p[0] >= w || p[1] >= h) err(where, 'overrides.' + key + ' [' + p + '] is outside the map');
    }
  }

  /* -- events ---------------------------------------------------------------------- */
  const ids = new Set();
  const tiles = new Map();
  const events = def.events || [];
  if (!Array.isArray(events)) err(where, '`events` must be an array');

  for (let i = 0; i < (Array.isArray(events) ? events.length : 0); i++) {
    const ev = events[i];
    if (!ev || typeof ev !== 'object') { err(where + ' event #' + i, 'event must be an object'); continue; }
    const id = ev.id;
    const ew = where + '/' + (id || '#' + i);
    if (typeof id !== 'string' || !id) { err(where + ' event #' + i, 'event needs a string `id`'); continue; }
    if (ids.has(id)) err(ew, 'duplicate event id "' + id + '" on this map');
    ids.add(id);
    if (typeof ev.x !== 'number' || typeof ev.y !== 'number') { err(ew, 'event needs numeric x,y'); continue; }
    if (ev.x < 0 || ev.y < 0 || ev.x >= w || ev.y >= h) err(ew, 'event is at ' + ev.x + ',' + ev.y + ', outside the ' + w + 'x' + h + ' map');
    const key = ev.x + ',' + ev.y;
    if (!tiles.has(key)) tiles.set(key, []);
    tiles.get(key).push(ev);

    const pages = pagesOf(ev);
    if (ev.enemy) {
      const e = ev.enemy;
      if (typeof e.troop !== 'string') err(ew, 'enemy sugar needs a `troop` id');
      else {
        troopsUsed.add(e.troop);
        if (HAVE.troops && !has(D.troops, e.troop)) missing(ew, 'enemy sugar: unknown troop "' + e.troop + '"', e.troop);
      }
      if (e.cond != null) checkCond(e.cond, ew + ' enemy cond');
      if (ev.pages) warn(ew, 'event has both `enemy` sugar and `pages`; the pages are ignored');
    }
    if (!pages.length) { warn(ew, 'event has no pages and will never do anything'); continue; }

    for (let p = 0; p < pages.length; p++) {
      const page = pages[p];
      const pw = ew + ' p' + p;
      if (!page || typeof page !== 'object') { err(pw, 'page must be an object'); continue; }
      checkCond(page.cond, pw + ' cond');
      checkSprite(page.sprite, pw, true);
      const trig = page.trigger || 'action';
      if (TRIGGERS.indexOf(trig) < 0) err(pw, 'unknown trigger "' + trig + '" (allowed: ' + TRIGGERS.join(', ') + ')');
      const mv = page.move || { type: 'still' };
      if (typeof mv !== 'object' || MOVE_TYPES.indexOf(mv.type) < 0) {
        err(pw, 'move.type must be one of ' + MOVE_TYPES.join(', ') + ' (got ' + JSON.stringify(mv && mv.type) + ')');
      } else if (mv.type === 'patrol') {
        if (!Array.isArray(mv.route) || !mv.route.length) err(pw, 'move type "patrol" needs a route [[x,y],...]');
        else for (const pt of mv.route) {
          if (!Array.isArray(pt) || pt.length !== 2 || typeof pt[0] !== 'number') { err(pw, 'patrol route points must be [x,y]'); continue; }
          if (pt[0] < 0 || pt[1] < 0 || pt[0] >= w || pt[1] >= h) err(pw, 'patrol route point ' + pt + ' is outside the map');
        }
      }
      if (page._synthetic) continue;                     // the enemy sugar's command list is generated
      if (page.commands == null) { warn(pw, 'page has no commands'); continue; }
      checkCommands(page.commands, pw, { mapId: mapId, eventId: id });
    }
  }

  for (const [key, list] of tiles) {
    if (list.length < 2) continue;
    const solids = list.filter(function (ev) { return pagesOf(ev).some(pageSolid); });
    const names = list.map(function (ev) { return ev.id; }).join(', ');
    if (solids.length > 1) err(where, 'events on the same tile ' + key + ' are both solid: ' + names);
    else warn(where, 'events share tile ' + key + ': ' + names + ' (only one of them can be triggered there)');
  }

  if (def.onEnter != null) checkCommands(def.onEnter, where + ' onEnter', { mapId: mapId, eventId: null });

  /* -- declared start -------------------------------------------------------------- */
  if (def.start) {
    const s = def.start;
    if (typeof s.x !== 'number' || typeof s.y !== 'number') err(where, '`start` needs numeric x,y');
    else if (s.x < 0 || s.y < 0 || s.x >= w || s.y >= h) err(where, '`start` ' + s.x + ',' + s.y + ' is outside the map');
    else {
      const coll = collisionOf(mapId);
      if (coll && coll.blocked[s.y * coll.w + s.x]) err(where, '`start` ' + s.x + ',' + s.y + ' is an impassable tile');
    }
    if (s.dir != null && DIRS.indexOf(s.dir) < 0) err(where, '`start.dir` must be ' + DIRS.join('/'));
  }
}

/* ---------------------------------------------------------------- reachability pass */

function checkReachability(mapId) {
  const def = D.maps[mapId];
  const coll = collisionOf(mapId);
  if (!coll) return;
  const where = mapId;

  /* arrival points: the game start, the map's own `start`, and every transfer that lands here */
  const starts = [];
  const sys = D.system && D.system.startMap;
  if (sys && sys.id === mapId && typeof sys.x === 'number') starts.push({ x: sys.x, y: sys.y, from: 'system.startMap' });
  if (def.start && typeof def.start.x === 'number') starts.push({ x: def.start.x, y: def.start.y, from: 'map.start' });
  for (const t of transfersInto.get(mapId) || []) starts.push({ x: t.x, y: t.y, from: t.where });

  if (!starts.length) {
    warn(where, 'no arrival point: nothing transfers here and the map has no `start` - reachability not checked');
    return;
  }

  /* tiles blocked by events that are solid on every one of their pages */
  const eventBlocks = new Set();
  for (const ev of def.events || []) {
    if (!ev || typeof ev.x !== 'number') continue;
    const pages = pagesOf(ev);
    if (pages.length && pages.every(pageSolid)) eventBlocks.add(ev.x + ',' + ev.y);
  }

  const strict = flood(coll, starts, eventBlocks);
  const loose = flood(coll, starts, null);

  const report = function (tw, x, y, what) {
    if (reachedOrAdjacent(strict, coll, x, y)) return;
    if (reachedOrAdjacent(loose, coll, x, y)) {
      warn(tw, what + ' at ' + x + ',' + y + ' is only reachable if a solid event moves or disappears first');
      return;
    }
    err(tw, what + ' at ' + x + ',' + y + ' cannot be reached on foot from any arrival point (' +
      starts.map(function (s) { return s.x + ',' + s.y; }).join(' / ') + ')');
  };

  for (const s of starts) {
    if (s.x < 0 || s.y < 0 || s.x >= coll.w || s.y >= coll.h) { err(where, 'arrival point ' + s.x + ',' + s.y + ' (' + s.from + ') is outside the map'); continue; }
    if (coll.blocked[s.y * coll.w + s.x]) err(where, 'arrival point ' + s.x + ',' + s.y + ' (' + s.from + ') is an impassable tile');
  }

  for (const ev of def.events || []) {
    if (!ev || typeof ev.x !== 'number' || typeof ev.id !== 'string') continue;
    const pages = pagesOf(ev);
    const triggers = new Set(pages.map(function (p) { return (p && p.trigger) || 'action'; }));
    const ew = where + '/' + ev.id;
    if (triggers.has('action') || triggers.has('touch')) {
      report(ew, ev.x, ev.y, 'event "' + ev.id + '"');
    }
    const hasTransfer = pages.some(function (p) { return p && listHasTransfer(p.commands); });
    if (hasTransfer && !triggers.has('action') && !triggers.has('touch')) {
      report(ew, ev.x, ev.y, 'transfer event "' + ev.id + '"');
    }
  }
}

function listHasTransfer(list) {
  if (!Array.isArray(list)) return false;
  for (const c of list) {
    if (!Array.isArray(c)) continue;
    if (c[0] === 'transfer') return true;
    for (const a of c.slice(1)) {
      if (Array.isArray(a) && listHasTransfer(a)) return true;
      if (Array.isArray(a) && a.some(function (b) { return Array.isArray(b) && listHasTransfer(b); })) return true;
      if (a && typeof a === 'object' && !Array.isArray(a)) {
        for (const k of Object.keys(a)) if (Array.isArray(a[k]) && listHasTransfer(a[k])) return true;
      }
    }
  }
  return false;
}

/* ====================================================================== battle data schemas */

function num(v) { return typeof v === 'number' && isFinite(v); }

function checkActors() {
  if (!HAVE.actors) { note('  (js/data/actors.js not written yet - actor schema not checked)'); return; }
  for (const id of Object.keys(D.actors)) {
    const a = D.actors[id];
    const w = 'actors/' + id;
    if (!a || typeof a !== 'object') { err(w, 'actor must be an object'); continue; }
    if (typeof a.name !== 'string') err(w, 'actor needs a `name`');
    if (a.char) needImage(w, String(a.char).indexOf('char_') === 0 ? a.char : 'char_' + a.char, 'actor walk sheet');
    else if (a.sprite) needImage(w, String(a.sprite).indexOf('char_') === 0 ? a.sprite : 'char_' + a.sprite, 'actor walk sheet');
    if (a.faces && HAVE.speakers && !has(D.speakers, id)) warn(w, 'actor has portraits but no speaker entry with the same id');
    if (a.base) {
      for (const k of ['hp', 'atk', 'def', 'spd']) if (!num(a.base[k])) err(w, 'base.' + k + ' must be a number');
      if (!a.growth) err(w, 'actor has `base` but no `growth`');
      else for (const k of ['hp', 'atk', 'def', 'spd']) if (!num(a.growth[k])) err(w, 'growth.' + k + ' must be a number');
    }
    if (a.home && GLASS_COLOURS.indexOf(a.home) < 0) err(w, 'home colour "' + a.home + '" must be red/blue/amber/green');
    for (const s of a.skills || []) {
      const sid = typeof s === 'string' ? s : s && s.id;
      if (typeof sid !== 'string') { err(w, 'skill entry must be an id or {id, level|flag}'); continue; }
      if (HAVE.skills && !has(D.skills, sid)) err(w, 'unknown skill "' + sid + '" (js/data/skills.js)');
      if (s && typeof s === 'object' && s.flag) record(flagReads, s.flag, w);
      if (s && typeof s === 'object' && s.level != null && !num(s.level)) err(w, 'skill "' + sid + '": level must be a number');
    }
  }
  if (D.expTable != null) {
    if (!Array.isArray(D.expTable)) err('expTable', 'G.DATA.expTable must be an array');
    else for (let i = 1; i < D.expTable.length; i++) {
      if (!num(D.expTable[i])) err('expTable', 'entry ' + i + ' is not a number');
      else if (D.expTable[i] < D.expTable[i - 1]) err('expTable', 'entry ' + i + ' (' + D.expTable[i] + ') is smaller than the one before it');
    }
  }
}

function checkSkills() {
  if (!HAVE.skills) { note('  (js/data/skills.js not written yet - skill schema not checked)'); return; }
  for (const id of Object.keys(D.skills)) {
    const s = D.skills[id];
    const w = 'skills/' + id;
    if (!s || typeof s !== 'object') { err(w, 'skill must be an object'); continue; }
    if (typeof s.name !== 'string') err(w, 'skill needs a `name`');
    if (s.user != null && HAVE.actors && !has(D.actors, s.user)) err(w, 'unknown user actor "' + s.user + '"');
    if (s.target != null && SKILL_TARGETS.indexOf(s.target) < 0) err(w, 'target "' + s.target + '" must be one of ' + SKILL_TARGETS.join(', '));
    if (s.type != null && SKILL_TYPES.indexOf(s.type) < 0) err(w, 'type "' + s.type + '" must be one of ' + SKILL_TYPES.join(', '));
    if (s.cost != null && typeof s.cost !== 'object') err(w, 'cost must be an object like {red:2} / {tumbled:1} / {free:true, cooldown:3}');
    else if (s.cost) {
      for (const k of Object.keys(s.cost)) {
        if (['red', 'blue', 'amber', 'green', 'any', 'tumbled', 'free', 'cooldown', 'pebble', 'call'].indexOf(k) < 0) {
          warn(w, 'cost key "' + k + '" is not a known glass colour or cost kind');
        }
      }
    }
    if (s.effects != null && !Array.isArray(s.effects)) err(w, 'effects must be an array');
    else for (const e of s.effects || []) {
      if (!e || typeof e !== 'object' || typeof e.kind !== 'string') err(w, 'every effect needs a string `kind`');
    }
    if (s.call && s.call.partner && HAVE.actors && !has(D.actors, s.call.partner)) err(w, 'unknown call partner "' + s.call.partner + '"');
    if (s.icon) needImage(w, s.icon, 'skill icon');
  }
}

function checkItems() {
  if (!HAVE.items) { note('  (js/data/items.js not written yet - item schema not checked)'); return; }
  for (const id of Object.keys(D.items)) {
    const it = D.items[id];
    const w = 'items/' + id;
    if (!it || typeof it !== 'object') { err(w, 'item must be an object'); continue; }
    if (typeof it.name !== 'string') err(w, 'item needs a `name`');
    if (it.kind != null && ITEM_KINDS.indexOf(it.kind) < 0) err(w, 'kind "' + it.kind + '" must be one of ' + ITEM_KINDS.join(', '));
    if (it.price != null && !num(it.price)) err(w, 'price must be a number');
    if (it.icon) needImage(w, String(it.icon).indexOf('icon_') === 0 ? it.icon : 'icon_' + it.icon, 'item icon');
    if (it.target != null && SKILL_TARGETS.indexOf(it.target) < 0) err(w, 'target "' + it.target + '" must be one of ' + SKILL_TARGETS.join(', '));
    if (it.effects != null && !Array.isArray(it.effects)) err(w, 'effects must be an array');
    else for (const e of it.effects || []) {
      if (!e || typeof e !== 'object' || typeof e.kind !== 'string') err(w, 'every effect needs a string `kind`');
    }
    if (it.stats != null && typeof it.stats !== 'object') err(w, 'stats must be an object like {hp:10}');
  }
}

function checkEnemies() {
  if (!HAVE.enemies) { note('  (js/data/enemies.js not written yet - enemy schema not checked)'); return; }
  for (const id of Object.keys(D.enemies)) {
    const e = D.enemies[id];
    const w = 'enemies/' + id;
    if (!e || typeof e !== 'object') { err(w, 'enemy must be an object'); continue; }
    const base = e.base ? D.enemies[e.base] : null;
    if (e.base && !base) err(w, 'unknown base enemy "' + e.base + '"');
    if (typeof e.name !== 'string' && !base) err(w, 'enemy needs a `name`');
    if (e.img) needImage(w, e.img, 'enemy illustration');
    else if (!base) err(w, 'enemy needs an `img` id');
    if (!base) {
      for (const k of ['hp', 'atk', 'def', 'spd']) if (!num(e[k])) err(w, k + ' must be a number');
    }
    const lines = e.lines || (base && base.lines);
    if (!Array.isArray(lines)) err(w, '`lines` must be an array of Unsent lines');
    else if (!lines.length && !e.lineRules && !(base && base.lineRules)) {
      err(w, '`lines` is empty and there is no `lineRules` to generate any');
    } else for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l || typeof l !== 'object') { err(w, 'line ' + i + ' must be an object like {c:"red"}'); continue; }
      if (typeof l.c !== 'string' || GLASS_COLOURS.indexOf(l.c) < 0) err(w, 'line ' + i + ': c must be one of ' + GLASS_COLOURS.join('/'));
      if (l.shownAs != null && GLASS_COLOURS.indexOf(l.shownAs) < 0) err(w, 'line ' + i + ': shownAs must be a glass colour');
      if (l.from != null && HAVE.actors && !has(D.actors, l.from)) err(w, 'line ' + i + ': unknown actor "' + l.from + '" in `from`');
      if (l.sayer != null && HAVE.actors && !has(D.actors, l.sayer)) err(w, 'line ' + i + ': unknown actor "' + l.sayer + '" in `sayer`');
    }
    if (e.exp != null && !num(e.exp)) err(w, 'exp must be a number');
    if (e.stamps != null && !num(e.stamps)) err(w, 'stamps must be a number');
    if (e.drop) {
      if (HAVE.items && e.drop.item && !has(D.items, e.drop.item)) err(w, 'drop: unknown item "' + e.drop.item + '"');
      if (e.drop.chance != null && (!num(e.drop.chance) || e.drop.chance < 0 || e.drop.chance > 1)) err(w, 'drop.chance must be 0..1');
    }
    if (e.letter != null && !Array.isArray(e.letter)) err(w, '`letter` must be an array of lines');
  }
}

function checkTroops() {
  if (!HAVE.troops) { note('  (js/data/troops.js not written yet - troop schema not checked)'); return; }
  const RULE_KEYS = ['noEscape', 'noHush', 'forcedSpill', 'roundLimit', 'onlySayer', 'tutorial'];
  for (const id of Object.keys(D.troops)) {
    const t = D.troops[id];
    const w = 'troops/' + id;
    if (!t || typeof t !== 'object') { err(w, 'troop must be an object'); continue; }
    if (!Array.isArray(t.members) || !t.members.length) { err(w, '`members` must be a non-empty array of enemy ids'); continue; }
    for (const m of t.members) {
      if (typeof m !== 'string') err(w, 'member ids must be strings');
      else if (HAVE.enemies && !has(D.enemies, m)) err(w, 'unknown enemy "' + m + '" (js/data/enemies.js)');
    }
    if (t.back) needImage(w, t.back, 'troop battleback');
    if (t.bgm) needAudio(w, t.bgm, 'troop bgm');
    if (t.rules != null) {
      if (typeof t.rules !== 'object') err(w, '`rules` must be an object or null');
      else for (const k of Object.keys(t.rules)) {
        if (RULE_KEYS.indexOf(k) < 0) warn(w, 'rules key "' + k + '" is not in the bible list (' + RULE_KEYS.join(', ') + ')');
        if (k === 'forcedSpill') {
          const f = t.rules[k] || {};
          if (HAVE.actors && f.actor && !has(D.actors, f.actor)) err(w, 'rules.forcedSpill: unknown actor "' + f.actor + '"');
          if (f.colour && GLASS_COLOURS.indexOf(f.colour) < 0) err(w, 'rules.forcedSpill: bad colour "' + f.colour + '"');
        }
        if (k === 'onlySayer' && HAVE.actors && !has(D.actors, t.rules[k])) err(w, 'rules.onlySayer: unknown actor "' + t.rules[k] + '"');
      }
    }
  }
  for (const id of troopsUsed) {
    if (!has(D.troops, id)) continue;                 // already reported at the use site
  }
  for (const id of Object.keys(D.troops)) {
    if (!troopsUsed.has(id)) warn('troops/' + id, 'troop is never used by a ["battle",...] command or enemy sugar');
  }
}

function checkEndings() {
  if (!HAVE.endings) {
    if (endingsUsed.size) note('  (G.DATA.endings does not exist yet - ' + endingsUsed.size + ' ending id(s) used but not checked)');
    return;
  }
  for (const id of Object.keys(D.endings)) {
    const e = D.endings[id];
    const w = 'endings/' + id;
    if (!e || typeof e !== 'object') { err(w, 'ending must be an object'); continue; }
    if (e.cond != null) checkCond(e.cond, w + ' cond');
    if (e.cg) needImage(w, e.cg, 'ending cg');
    if (e.bgm) needAudio(w, e.bgm, 'ending bgm');
    if (!endingsUsed.has(id)) warn(w, 'ending is never reached by an ["ending","' + id + '"] command');
  }
}

function checkSpeakersTable() {
  if (!HAVE.speakers) return;
  for (const id of Object.keys(D.speakers)) {
    const sp = D.speakers[id];
    const w = 'speakers/' + id;
    if (!sp || typeof sp !== 'object') { err(w, 'speaker must be an object'); continue; }
    if (typeof sp.name !== 'string') err(w, 'speaker needs a `name`');
    if (sp.blip) needAudio(w, sp.blip, 'speaker blip');
    if (sp.faces && !has(IMAGES, 'face_' + sp.faces + '_neutral')) {
      warn(w, 'no neutral portrait "face_' + sp.faces + '_neutral" in the manifest');
    }
  }
}

function checkCommonEvents() {
  for (const id of Object.keys(D.commonEvents || {})) {
    const ce = D.commonEvents[id];
    const list = Array.isArray(ce) ? ce : (ce && ce.commands);
    if (!Array.isArray(list)) { err('commonEvents/' + id, 'common event must be an array of commands or {name, commands}'); continue; }
    checkCommands(list, 'commonEvents/' + id, { mapId: null, eventId: null });
  }
}

function checkSystem() {
  const sys = D.system;
  if (!sys) { err('system', 'G.DATA.system is missing (js/data/system.js)'); return; }
  const sm = sys.startMap;
  if (!sm || typeof sm !== 'object') { err('system', 'system.startMap must be {id, x, y, dir}'); return; }
  if (!has(D.maps, sm.id)) { err('system', 'system.startMap.id "' + sm.id + '" is not a registered map'); return; }
  const coll = collisionOf(sm.id);
  if (!coll) return;
  if (typeof sm.x !== 'number' || typeof sm.y !== 'number') { err('system', 'system.startMap needs numeric x,y'); return; }
  if (sm.x < 0 || sm.y < 0 || sm.x >= coll.w || sm.y >= coll.h) { err('system', 'system.startMap ' + sm.x + ',' + sm.y + ' is outside map "' + sm.id + '"'); return; }
  if (coll.blocked[sm.y * coll.w + sm.x]) err('system', 'system.startMap ' + sm.x + ',' + sm.y + ' is an impassable tile of "' + sm.id + '"');
  if (sm.dir != null && DIRS.indexOf(sm.dir) < 0) err('system', 'system.startMap.dir must be ' + DIRS.join('/'));
  for (const id of sys.startParty || []) {
    if (HAVE.actors && !has(D.actors, id)) err('system', 'startParty: unknown actor "' + id + '"');
  }
  for (const id of Object.keys(sys.startItems || {})) {
    if (HAVE.items && !has(D.items, id)) err('system', 'startItems: unknown item "' + id + '"');
  }
  for (const k of Object.keys(sys.startFlags || {})) record(flagWrites, k, 'system.startFlags');
  for (const k of Object.keys(sys.startVars || {})) record(varWrites, k, 'system.startVars');
}

/* ====================================================================== run */

const allMaps = Object.keys(D.maps).sort();
if (OPT.map && !has(D.maps, OPT.map)) {
  console.log('ERROR validate_data: no map "' + OPT.map + '" is registered (known: ' + (allMaps.join(', ') || 'none') + ')');
  process.exit(1);
}
const mapsToCheck = OPT.map ? [OPT.map] : allMaps;

note('validate_data: ' + loaded.files.length + ' data file(s), ' + allMaps.length + ' map(s), ' +
  Object.keys(IMAGES).length + ' image(s) and ' + Object.keys(AUDIO).length + ' sound(s) in the manifest');

for (const e of G.errors) err('data load', e.replace(/^\[(warn|error)\] /, ''));

/* pass 1: everything that does not depend on the transfer graph */
checkSpeakersTable();
checkCommonEvents();
for (const id of allMaps) checkMap(id);     // always all maps: transfers into the checked map matter
checkSystem();
checkActors();
checkSkills();
checkItems();
checkEnemies();
checkTroops();
checkEndings();

/* pass 2: reachability needs every transfer to have been collected */
for (const id of mapsToCheck) checkReachability(id);

/* pass 3: flags and variables across the whole game */
for (const [name, wheres] of flagReads) {
  if (!flagWrites.has(name)) warn('flags', 'flag "' + name + '" is read (' + wheres[0] + (wheres.length > 1 ? ', +' + (wheres.length - 1) + ' more' : '') + ') but never set anywhere');
}
for (const [name, wheres] of flagWrites) {
  if (!flagReads.has(name)) warn('flags', 'flag "' + name + '" is set (' + wheres[0] + (wheres.length > 1 ? ', +' + (wheres.length - 1) + ' more' : '') + ') but never read by any condition');
}
for (const [name, wheres] of varReads) {
  if (!varWrites.has(name)) warn('vars', 'variable "' + name + '" is read (' + wheres[0] + (wheres.length > 1 ? ', +' + (wheres.length - 1) + ' more' : '') + ') but never set anywhere');
}
for (const [name, wheres] of varWrites) {
  if (!varReads.has(name)) warn('vars', 'variable "' + name + '" is set (' + wheres[0] + (wheres.length > 1 ? ', +' + (wheres.length - 1) + ' more' : '') + ') but never read');
}

/* ---------------------------------------------------------------- summary */

if (!OPT.quiet) {
  console.log('');
  console.log('checked maps: ' + (mapsToCheck.join(', ') || '(none)'));
}
console.log(errors.length + ' error(s), ' + warnings.length + ' warning(s)');
process.exit(errors.length ? 1 : 0);
