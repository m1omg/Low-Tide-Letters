#!/usr/bin/env node
/*
 * dump_script.js - prints every line of player-facing text in the game as a readable screenplay, so the
 * whole script can be proofread without opening map files.
 *
 *   node tools/test/dump_script.js                 everything
 *   node tools/test/dump_script.js --map blare_reef
 *   node tools/test/dump_script.js --common        only common events
 *
 * Output per event: "== map / event (x,y) page N [cond]" followed by the lines in command order;
 * choices and branches are indented.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'js', 'data');
const args = process.argv.slice(2);
const onlyMap = args.includes('--map') ? args[args.indexOf('--map') + 1] : null;
const onlyCommon = args.includes('--common');

/** Loads all data files in a sandbox (same idea as validate_data.js, reduced). */
function loadData() {
  const sandbox = {};
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  sandbox.console = { log() {}, warn() {}, error() {}, info() {} };
  sandbox.setTimeout = () => 0; sandbox.clearTimeout = () => {};
  sandbox.document = { fonts: { ready: Promise.resolve() }, getElementById: () => null };
  const G = sandbox.G = {
    CONFIG: { W: 768, H: 576, TILE: 48, SCALE: 2, FPS: 60, DEBUG: false },
    DATA: { maps: {} }, errors: [], warn() {}, error() {}, str: (k, d) => (d == null ? k : d),
    registerMap(id, def) { def.id = id; G.DATA.maps[id] = def; return def; },
    Util: { clamp: (v, a, b) => Math.min(b, Math.max(a, v)), randInt: (a) => a, choice: (a) => a && a[0],
      deepClone: (o) => JSON.parse(JSON.stringify(o)), makeRng: () => () => 0.5 },
    Assets: { has: () => true, size: () => ({ w: 48, h: 48 }), img: () => null },
    Scenes: { register() {}, has: () => false }, Interpreter: { custom: {} },
    State: { flags: {}, vars: {}, getFlag: () => false, getVar: () => 0 },
  };
  vm.createContext(sandbox);
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) files.push(p);
    }
  })(DATA_DIR);
  for (const f of files) {
    try { vm.runInContext(fs.readFileSync(f, 'utf8'), sandbox, { filename: f, timeout: 10000 }); } catch (e) { /* validator reports these */ }
  }
  return G;
}

const clean = (t) => String(t).replace(/\n/g, ' / ');
const condStr = (c) => (c ? ' [' + JSON.stringify(c).replace(/"/g, '') + ']' : '');

/** Recursively prints the text-bearing commands of a list. */
function dump(cmds, indent) {
  const pad = ' '.repeat(indent);
  for (const c of cmds || []) {
    if (!Array.isArray(c)) continue;
    const n = c[0];
    if (n === 'say') console.log(pad + (c[1] || '-').toUpperCase() + (c[2] ? ' (' + c[2] + ')' : '') + ': ' + clean(c[3]));
    else if (n === 'narrate') console.log(pad + '  ~ ' + clean(c[1]));
    else if (n === 'think') console.log(pad + '  ( ' + clean(c[1]) + ' )');
    else if (n === 'choice') {
      (c[1] || []).forEach((opt, i) => { console.log(pad + '  > ' + clean(opt)); dump((c[2] || [])[i], indent + 6); });
    } else if (n === 'if') {
      console.log(pad + '  if' + condStr(c[1])); dump(c[2], indent + 4);
      if (c[3] && c[3].length) { console.log(pad + '  else'); dump(c[3], indent + 4); }
    } else if (n === 'battle') {
      console.log(pad + '  [BATTLE ' + c[1] + ']');
      const o = c[2] || {};
      for (const k of ['onPeace', 'onWin', 'onLose', 'onEscape', 'onTimeout']) {
        if (Array.isArray(o[k]) && o[k].length) { console.log(pad + '   ' + k + ':'); dump(o[k], indent + 6); }
      }
    } else if (n === 'custom') {
      const a = c[2] || {};
      const bits = [];
      if (a.prompt) bits.push('prompt: ' + clean(a.prompt));
      if (a.say) bits.push('SAY: ' + clean(a.say));
      if (a.keep) bits.push('KEEP: ' + clean(a.keep));
      if (a.joke) bits.push('joke: ' + clean(a.joke));
      if (Array.isArray(a.options)) bits.push('options: ' + a.options.map((o) => (o.ghost ? '(ghost) ' : '') + clean(o.text)).join(' | '));
      console.log(pad + '  [' + c[1] + (bits.length ? ' - ' + bits.join(' ; ') : '') + ']');
    } else if (n === 'call') console.log(pad + '  [call ' + c[1] + ']');
    else if (n === 'cg' && c[1]) console.log(pad + '  [CG ' + c[1] + ']');
    else if (n === 'ending') console.log(pad + '  [ENDING ' + c[1] + ']');
    else if (n === 'transfer') console.log(pad + '  [-> ' + c[1] + ' ' + c[2] + ',' + c[3] + ']');
    else if (n === 'giveItem') console.log(pad + '  [+' + (c[2] || 1) + ' ' + c[1] + ']');
    else if (n === 'setFlag' && c[2] !== false) console.log(pad + '  [flag ' + c[1] + ']');
  }
}

const G = loadData();
if (!onlyCommon) {
  for (const id of Object.keys(G.DATA.maps).sort()) {
    if (onlyMap && id !== onlyMap) continue;
    if (!onlyMap && id.startsWith('test_')) continue;
    const m = G.DATA.maps[id];
    console.log('\n############ MAP ' + id + ' - ' + (m.name || '') + ' (' + m.width + 'x' + m.height + ')');
    if (m.onEnter && m.onEnter.length) { console.log('== onEnter'); dump(m.onEnter, 2); }
    for (const ev of m.events || []) {
      const pages = ev.pages || (ev.enemy ? [] : []);
      if (ev.enemy) { console.log('== ' + ev.id + ' (' + ev.x + ',' + ev.y + ') roaming ' + ev.enemy.troop + condStr(ev.enemy.cond)); continue; }
      pages.forEach((pg, i) => {
        const before = [];
        const log = console.log;
        console.log = (s) => before.push(s);
        dump(pg.commands, 2);
        console.log = log;
        if (!before.length) return;
        console.log('== ' + ev.id + ' (' + ev.x + ',' + ev.y + ') page ' + (i + 1) + ' ' + (pg.trigger || 'action') + condStr(pg.cond));
        before.forEach((s) => console.log(s));
      });
    }
  }
}
if (!onlyMap) {
  console.log('\n############ COMMON EVENTS');
  for (const id of Object.keys(G.DATA.commonEvents || {})) {
    const ce = G.DATA.commonEvents[id];
    console.log('== ' + id);
    dump(Array.isArray(ce) ? ce : ce.commands, 2);
  }
  if (G.DATA.endings) {
    console.log('\n############ ENDINGS');
    for (const id of Object.keys(G.DATA.endings)) {
      const e = G.DATA.endings[id];
      console.log('== ' + id);
      const pages = typeof e.pages === 'function' ? e.pages() : e.pages;
      (pages || []).forEach((p) => console.log('  ' + (p.cg ? '[CG ' + p.cg + '] ' : '') + clean(p.text || '')));
    }
  }
}
