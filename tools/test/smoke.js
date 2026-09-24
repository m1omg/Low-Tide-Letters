#!/usr/bin/env node
/*
 * smoke.js - the "does the whole game still run" test (TECH_SPEC section 11).
 *
 *   node tools/test/smoke.js                     every map + one battle per troop
 *   node tools/test/smoke.js --maps a,b          only those maps
 *   node tools/test/smoke.js --no-battles        skip the battle pass
 *   node tools/test/smoke.js --no-build          do not run "node tools/build.js" first
 *
 * It boots the real game in headless Chrome over http://localhost, starts a new game, teleports to every
 * registered map with text skipping on, photographs each into tools/test/shots/smoke_<map>.png, walks a
 * few (seeded, reproducible) steps on each one, and then fights one battle per troop with
 * battleAuto('smart'). When no 'battle' scene is registered yet the battle pass is skipped cleanly.
 *
 * Exit code 1 on any check failure or any entry in __game.errors().
 */
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const H = require('./lib/harness');

/* ---------------------------------------------------------------- options */

const argv = process.argv.slice(2);
const OPT = { maps: null, battles: true, build: true };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--maps') OPT.maps = String(argv[++i] || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  else if (a.indexOf('--maps=') === 0) OPT.maps = a.slice(7).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  else if (a === '--no-battles') OPT.battles = false;
  else if (a === '--no-build') OPT.build = false;
  else if (a === '--help' || a === '-h') {
    console.log('usage: node tools/test/smoke.js [--maps a,b] [--no-battles] [--no-build]');
    process.exit(0);
  } else { console.log('smoke: unknown option "' + a + '" (try --help)'); process.exit(2); }
}

/* ---------------------------------------------------------------- reporting */

const failures = [];
function check(name, ok, detail) {
  if (ok) { console.log('  ok   ' + name); return true; }
  failures.push(name + (detail ? ' -> ' + detail : ''));
  console.log('  FAIL ' + name + (detail ? ' -> ' + detail : ''));
  return false;
}

/* a tiny deterministic RNG so "random steps" are the same on every run */
let seed = 20260921;
function rnd(n) {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed % n;
}

/* ---------------------------------------------------------------- page helpers */

/** Runs frames until `expr` is true (or gives up); returns true when it became true. */
async function waitFor(page, expr, maxFrames) {
  let left = maxFrames || 600;
  while (left > 0) {
    if (await page.evaluate(expr)) return true;
    await H.advance(page, 5);
    left -= 5;
  }
  return false;
}

function idle(page) {
  return waitFor(page, '!window.G.Interpreter.isBusy() && !window.G.UI.isModal()', 900);
}

/** Holds a direction for a while so the player really walks. */
async function hold(page, action, frames) {
  await page.evaluate(function (a) { window.G.Input.simulate(a, true); }, action);
  await H.advance(page, frames);
  await page.evaluate(function (a) { window.G.Input.simulate(a, false); }, action);
  await H.advance(page, 14);
}

/**
 * Picks a tile the player can stand on, using the same rules as map_scene (terrain, solid objects,
 * overrides). Prefers the map's own `start` and the game's start tile.
 */
function spawnTile(mapId) {
  {
    const G = window.G;
    const def = G.DATA.maps[mapId];
    if (!def) return null;
    const w = def.width | 0, h = def.height | 0;
    const blocked = new Uint8Array(w * h);
    const legend = def.legend || {};
    for (let y = 0; y < h; y++) {
      const row = (def.ground || [])[y] || '';
      for (let x = 0; x < w; x++) {
        const t = G.DATA.terrains[legend[row.charAt(x)]];
        if (!t || t.passable === false) blocked[y * w + x] = 1;
      }
    }
    const block = function (x, y) { if (x >= 0 && y >= 0 && x < w && y < h) blocked[y * w + x] = 1; };
    for (const o of def.objects || []) {
      const d = G.DATA.objects[o.obj];
      if (!d || !d.solid) continue;
      let fps = d.fp || [0, 0, 1, 1];
      if (!Array.isArray(fps[0])) fps = [fps];
      for (const r of fps) {
        for (let dy = 0; dy < ((r[3] | 0) || 1); dy++) for (let dx = 0; dx < ((r[2] | 0) || 1); dx++) block((o.x | 0) + (r[0] | 0) + dx, (o.y | 0) + (r[1] | 0) + dy);
      }
    }
    const ov = def.overrides || {};
    for (const p of ov.block || []) block(p[0], p[1]);
    for (const p of ov.open || []) if (p[0] >= 0 && p[1] >= 0 && p[0] < w && p[1] < h) blocked[p[1] * w + p[0]] = 0;
    const solidEvents = {};
    for (const ev of def.events || []) {
      const pages = ev.enemy ? [] : (ev.pages || []);
      if (pages.length && pages.every(function (p) { return p.solid != null ? !!p.solid : !!p.sprite; })) solidEvents[ev.x + ',' + ev.y] = 1;
    }
    const free = function (x, y) {
      return x >= 0 && y >= 0 && x < w && y < h && !blocked[y * w + x] && !solidEvents[x + ',' + y];
    };
    const sys = G.DATA.system && G.DATA.system.startMap;
    if (sys && sys.id === mapId && free(sys.x, sys.y)) return { x: sys.x, y: sys.y, dir: sys.dir || 'down' };
    if (def.start && free(def.start.x, def.start.y)) return { x: def.start.x, y: def.start.y, dir: def.start.dir || 'down' };
    let best = null;
    for (let y = 0; y < h && !best; y++) for (let x = 0; x < w && !best; x++) if (free(x, y)) best = { x: x, y: y, dir: 'down' };
    return best;
  }
}

/* ---------------------------------------------------------------- the run */

async function main() {
  if (OPT.build) {
    console.log('build: node tools/build.js');
    execFileSync(process.execPath, [path.join(H.ROOT, 'tools', 'build.js')], { stdio: 'inherit' });
  }

  const { browser, page } = await H.launchGame({ query: 'smoke=1' });
  try {
    await page.evaluate(function () { window.__game.skipText = true; });

    /* --- new game ------------------------------------------------------------- */
    await page.evaluate(function () { return window.__game.newGame(); });
    await H.advance(page, 60);
    await idle(page);
    const started = await page.evaluate(function () { return window.__game.scene(); });
    check('new game reaches the map scene', started === 'map', 'scene is "' + started + '"');
    await H.shot(page, 'smoke_newgame');

    /* --- maps ------------------------------------------------------------------ */
    let mapIds = await page.evaluate(function () { return Object.keys(window.G.DATA.maps).sort(); });
    if (OPT.maps) {
      for (const id of OPT.maps) if (mapIds.indexOf(id) < 0) check('map "' + id + '" is registered', false, 'unknown map');
      mapIds = mapIds.filter(function (id) { return OPT.maps.indexOf(id) >= 0; });
    }
    check('there is at least one map to visit', mapIds.length > 0);

    for (const id of mapIds) {
      const spot = await page.evaluate(spawnTile, id);
      if (!check('map "' + id + '" has a tile to stand on', !!spot)) continue;

      let ok = true;
      try {
        await page.evaluate(function (a) { return window.__game.teleport(a.id, a.x, a.y, a.dir); }, Object.assign({ id: id }, spot));
      } catch (e) {
        ok = check('teleport to "' + id + '"', false, e.message);
      }
      if (!ok) continue;
      await H.advance(page, 60);
      await idle(page);

      const info = await page.evaluate(function () { return window.__game.mapInfo(); });
      const arrived = info && info.id === id;
      check('arrived on "' + id + '" (' + (info ? info.w + 'x' + info.h + ', ' + (info.events || []).length + ' events' : '?') + ')', arrived,
        info ? 'ended up on "' + info.id + '"' : 'mapInfo() returned nothing');
      await H.shot(page, 'smoke_' + id);
      if (!arrived) continue;

      /* a few seeded steps, so movement, collision, followers and parallel events all run */
      const dirs = ['up', 'down', 'left', 'right'];
      for (let s = 0; s < 6; s++) {
        await hold(page, dirs[rnd(4)], 14 + rnd(20));
        const busy = await page.evaluate(function () { return window.G.Interpreter.isBusy() || window.G.Scenes.topName() !== 'map'; });
        if (busy) { await idle(page); }
        const now = await page.evaluate(function () { return window.__game.scene(); });
        if (now !== 'map') break;              // an event took us somewhere (battle, transfer, ...)
      }
      await idle(page);
      if ((await page.evaluate(function () { return window.__game.scene(); })) !== 'map') {
        // walk into something that pushed a scene: get back to a known place before the next map
        await page.evaluate(function () { return window.__game.newGame(); });
        await H.advance(page, 60);
        await idle(page);
      }
    }

    /* --- battles ---------------------------------------------------------------- */
    const hasBattle = await page.evaluate(function () { return window.G.Scenes.has('battle'); });
    if (!OPT.battles) {
      console.log('  --   battles skipped (--no-battles)');
    } else if (!hasBattle) {
      console.log('  --   battles skipped: no "battle" scene is registered yet');
    } else {
      const troops = await page.evaluate(function () { return Object.keys(window.G.DATA.troops || {}).sort(); });
      check('there is at least one troop to fight', troops.length > 0);
      for (const troop of troops) {
        await page.evaluate(function () { return window.__game.newGame(); });
        await H.advance(page, 60);
        await idle(page);
        await page.evaluate(function (t) {
          window.__smoke = { done: false, result: null, err: null };
          (async function () {
            try {
              await window.__game.startBattle(t);
              window.__smoke.result = await window.__game.battleAuto('smart');
            } catch (e) {
              window.__smoke.err = String((e && e.message) || e);
            } finally { window.__smoke.done = true; }
          })();
        }, troop);

        let budget = 6000;                       // fixed steps
        while (budget > 0) {
          const st = await page.evaluate(function () { return window.__smoke.done; });
          if (st) break;
          await H.advance(page, 20);
          budget -= 20;
        }
        const res = await page.evaluate(function () { return window.__smoke; });
        if (!res.done) { check('battle "' + troop + '" finishes', false, 'still running after 6000 frames'); continue; }
        if (res.err) { check('battle "' + troop + '" finishes', false, res.err); continue; }
        const outcome = res.result && res.result.outcome;
        check('battle "' + troop + '" -> ' + outcome,
          ['peace', 'win', 'lose', 'escape', 'timeout'].indexOf(outcome) >= 0,
          'outcome was ' + JSON.stringify(res.result));
        await H.advance(page, 30);
        await idle(page);
      }
      await H.shot(page, 'smoke_after_battles');
    }

    /* --- errors ------------------------------------------------------------------ */
    const errors = await H.getErrors(page);
    if (errors.length) {
      console.log('');
      console.log('game errors (' + errors.length + '):');
      for (const e of errors) console.log('  ' + e);
    }
    check('no runtime errors', errors.length === 0, errors.length + ' error(s)/warning(s)');
  } finally {
    await browser.close();
  }

  console.log('');
  if (failures.length) {
    console.log('SMOKE FAILED (' + failures.length + '):');
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
  console.log('smoke: all checks passed. Screenshots in tools/test/shots/smoke_*.png');
}

main().catch(function (e) {
  console.error('smoke: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
