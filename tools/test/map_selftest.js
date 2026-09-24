#!/usr/bin/env node
/*
 * map_selftest.js - drives the map / event engine in headless Chrome:
 * new game, walking with simulated input, collision against water and trees, talking to an NPC (with a
 * choice), taking the mailbox item exactly once, the door transfer into test_room and back, caterpillar
 * followers, the window.__game hooks (teleport / mapInfo / run) and the debug overlay.
 *
 *   node tools/test/map_selftest.js            (add --no-build to skip "node tools/build.js")
 *
 * Screenshots land in tools/test/shots/map_*.png. Exit code 1 on any check failure or any entry in
 * __game.errors().
 */
'use strict';

const H = require('./lib/harness');

const failures = [];
function check(name, ok, detail) {
  if (ok) { console.log('  ok   ' + name); return true; }
  failures.push(name + (detail ? ' -> ' + detail : ''));
  console.log('  FAIL ' + name + (detail ? ' -> ' + detail : ''));
  return false;
}

/** Holds an action down for `frames` fixed steps, then releases it. */
async function hold(page, action, frames) {
  await page.evaluate(function (a) { window.G.Input.simulate(a, true); }, action);
  await H.advance(page, frames);
  await page.evaluate(function (a) { window.G.Input.simulate(a, false); }, action);
  await H.advance(page, 3);
}

/**
 * Walks exactly n tiles: holds the direction until the last step has begun (one step starts every 12
 * frames), releases, then lets that last step finish.
 */
async function walk(page, dir, tiles) {
  await hold(page, dir, (tiles - 1) * 12 + 3);
  await H.advance(page, 14);
}

/** Runs frames until `expr` is true (or gives up). */
async function waitFor(page, expr, maxFrames, label) {
  let left = maxFrames || 600;
  while (left > 0) {
    if (await page.evaluate(expr)) return true;
    await H.advance(page, 5);
    left -= 5;
  }
  check('wait for ' + (label || expr), false, 'timed out');
  return false;
}

function idle(page) {
  return waitFor(page, '!G.Interpreter.isBusy()', 900, 'interpreter idle');
}

function info(page) {
  return page.evaluate(function () { return window.__game.mapInfo(); });
}

async function main() {
  if (!process.argv.includes('--no-build')) {
    require('child_process').execSync('node ' + require('path').join(H.ROOT, 'tools', 'build.js'), { stdio: 'inherit' });
  }
  const { browser, page } = await H.launchGame({ query: 'debug=1' });
  try {
    /* ---------------------------------------------------------------- new game */
    await page.evaluate(function () { window.__game.skipText = true; });
    await page.evaluate(function () {
      return window.__game.newGame({ party: ['wren'], map: { id: 'test_map', x: 15, y: 12, dir: 'up' } });   // the engine test page
    });
    await idle(page);
    check('scene is "map"', await page.evaluate('__game.scene()') === 'map');
    let m = await info(page);
    check('started on test_map', m.id === 'test_map', m.id);
    check('map is 30x22', m.w === 30 && m.h === 22, m.w + 'x' + m.h);
    check('every event has a page or none', m.events.length >= 5, 'events: ' + m.events.length);
    await H.shot(page, 'map_01_start');

    /* ---------------------------------------------------------------- walking */
    const before = m.player;
    await walk(page, 'down', 3);
    m = await info(page);
    check('walking down moved the player', m.player.y === before.y + 3 && m.player.x === before.x,
      JSON.stringify(m.player));
    check('facing down after walking down', m.player.dir === 'down', m.player.dir);

    await page.evaluate(function () { return window.__game.teleport('test_map', 11, 15, 'left'); });
    await walk(page, 'left', 3);
    m = await info(page);
    check('water blocks the player', m.player.x === 10 && m.player.y === 15, JSON.stringify(m.player));

    await page.evaluate(function () { return window.__game.teleport('test_map', 5, 5, 'up'); });
    await walk(page, 'up', 2);
    m = await info(page);
    check('a tree blocks the player', m.player.x === 5 && m.player.y === 5, JSON.stringify(m.player));

    /* ---------------------------------------------------------------- running is faster */
    await page.evaluate(function () { return window.__game.teleport('test_map', 15, 12, 'down'); });
    await page.evaluate(function () { window.G.Input.simulate('run', true); });
    await walk(page, 'down', 4);
    await page.evaluate(function () { window.G.Input.simulate('run', false); });
    m = await info(page);
    check('running covers more ground in the same time', m.player.y >= 17, JSON.stringify(m.player));

    /* ---------------------------------------------------------------- talk to the NPC */
    await page.evaluate(function () { window.__game.autoChoice = 0; });
    await page.evaluate(function () { return window.__game.teleport('test_map', 12, 9, 'up'); });
    await H.advance(page, 4);
    await page.evaluate(function () { window.__game.skipText = false; });
    await H.press(page, 'confirm', 20);
    await H.shot(page, 'map_02_talk');
    await page.evaluate(function () { window.__game.skipText = true; });
    await idle(page);
    check('talking set the flag', await page.evaluate('G.State.getFlag("test_met_pip")'));
    check('the choice wrote its variable', await page.evaluate('G.State.getVar("test_choice")') === 0);
    m = await info(page);
    const pip = m.events.find(function (e) { return e.id === 'npc_pip'; });
    check('the NPC switched to its second page', pip && pip.page === 1, JSON.stringify(pip));

    /* ---------------------------------------------------------------- the parallel event runs */
    check('the parallel event makes the NPC hum while the player walks around',
      await waitFor(page, 'G.Scenes.find("map").event("npc_pip").emote === "note"', 700, 'parallel emote'));

    /* ---------------------------------------------------------------- the mailbox gives once */
    await page.evaluate(function () { return window.__game.teleport('test_map', 18, 13, 'up'); });
    await H.advance(page, 4);
    await H.press(page, 'confirm', 10);
    await idle(page);
    check('mailbox gave the letter', await page.evaluate('G.State.itemCount("test_letter")') === 1);
    await H.advance(page, 20);
    await H.press(page, 'confirm', 10);
    await idle(page);
    check('mailbox gives it only once', await page.evaluate('G.State.itemCount("test_letter")') === 1);

    /* ---------------------------------------------------------------- followers */
    await page.evaluate(function () {
      window.G.DATA.actors.test_buddy = { name: 'Buddy', sprite: 'char_test', level: 1, hp: 10 };
      window.__game.addMember('test_buddy');
    });
    await page.evaluate(function () { return window.__game.teleport('test_map', 15, 12, 'down'); });
    await H.advance(page, 4);
    await walk(page, 'down', 3);
    const follow = await page.evaluate(function () {
      const s = window.G.Scenes.find('map');
      const f = s.followers[0];
      return { n: s.followers.length, fx: f.x, fy: f.y, px: s.player.x, py: s.player.y };
    });
    check('the party has one follower', follow.n === 1, JSON.stringify(follow));
    check('the follower walks one tile behind',
      Math.abs(follow.fx - follow.px) + Math.abs(follow.fy - follow.py) === 1, JSON.stringify(follow));
    await H.shot(page, 'map_03_followers');

    /* ---------------------------------------------------------------- __game.run + pathfinding */
    await page.evaluate(function () { return window.__game.run([['setVar', 'probe', '=', 7]]); });
    check('__game.run executed a command', await page.evaluate('G.State.getVar("probe")') === 7);
    await page.evaluate(function () {
      return window.__game.run([['move', 'player', [['to', 15, 10]], { wait: true }]]);
    });
    await waitFor(page, '__game.mapInfo().player.y === 10', 600, 'pathfinding move');
    m = await info(page);
    check('["to",x,y] pathfinding walked the player there', m.player.x === 15 && m.player.y === 10,
      JSON.stringify(m.player));

    /* ---------------------------------------------------------------- camera, jump, emote, enemy */
    await page.evaluate(function () { return window.__game.teleport('test_map', 21, 15, 'right'); });
    await H.advance(page, 4);
    await page.evaluate(function () {
      return window.__game.run([
        ['camera', [24, 15], 16],
        ['camera', 'player', 16],
        ['move', 'player', ['jump'], { wait: true }],
        ['emote', 'player', 'heart'],
      ]);
    });
    await idle(page);
    await H.advance(page, 6);
    const emo = await page.evaluate(function () {
      const s = window.G.Scenes.find('map');
      const moth = s.event('moth1');
      return { emote: s.player.emote, mothSprite: moth && moth.sprite ? moth.sprite.kind : null,
        mothH: moth && moth.sprite ? Math.round(moth.sprite.h) : 0 };
    });
    check('the emote balloon is up', emo.emote === 'heart', JSON.stringify(emo));
    check('the enemy uses its illustration at ~56 logical px',
      emo.mothSprite === 'enemy' && emo.mothH >= 45 && emo.mothH <= 70, JSON.stringify(emo));
    await H.shot(page, 'map_07_emote_enemy');

    /* ---------------------------------------------------------------- debug overlay */
    await page.evaluate(function () { window.G.CONFIG.DEBUG_OVERLAY = true; });
    await H.advance(page, 3);
    await H.shot(page, 'map_04_debug');
    await page.evaluate(function () { window.G.CONFIG.DEBUG_OVERLAY = false; });

    /* ---------------------------------------------------------------- transfer there and back */
    await page.evaluate(function () { return window.__game.teleport('test_map', 22, 5, 'up'); });
    await H.advance(page, 4);
    await walk(page, 'up', 1);
    await waitFor(page, '__game.mapInfo().id === "test_room"', 400, 'transfer into test_room');
    await idle(page);
    m = await info(page);
    check('the door transferred into test_room', m.id === 'test_room', m.id);
    check('landed on the right tile', m.player.x === 7 && m.player.y === 8, JSON.stringify(m.player));
    await H.advance(page, 10);
    await H.shot(page, 'map_05_room');

    await walk(page, 'down', 1);
    await waitFor(page, '__game.mapInfo().id === "test_map"', 400, 'transfer back to test_map');
    m = await info(page);
    check('the exit door came back to test_map', m.id === 'test_map', m.id);
    check('came back outside the door', m.player.x === 22 && m.player.y === 5, JSON.stringify(m.player));
    await H.advance(page, 20);
    await H.shot(page, 'map_06_back');

    /* ---------------------------------------------------------------- a touch tile fires once per arrival */
    // stand on the door tile with its page replaced by a plain message: it must play once, not every frame
    await page.evaluate(function () {
      const s = G.Scenes.top();
      const ev = s.events.find(function (e) { return e.id === 'door_house'; });
      ev.page.commands = [['think', 'a locked door']];
      window.__touchFired = 0;
      const orig = s.startEvent.bind(s);
      s.startEvent = function (e, how) { const r = orig(e, how); if (r && e.id === 'door_house') window.__touchFired++; return r; };
    });
    await walk(page, 'up', 1);                       // (22,5) -> (22,4), onto the tile
    for (let k = 0; k < 5; k++) { await H.advance(page, 30); await H.press(page, 'confirm', 6); }
    await H.advance(page, 240);
    m = await info(page);
    check('standing on a passable touch tile fires it once, not every frame',
      m.player.y === 4 && (await page.evaluate('window.__touchFired')) === 1, await page.evaluate('window.__touchFired'));
    await walk(page, 'down', 1);
    await walk(page, 'up', 1);
    for (let k = 0; k < 5; k++) { await H.advance(page, 30); await H.press(page, 'confirm', 6); }
    check('stepping off and back on fires it again', (await page.evaluate('window.__touchFired')) === 2, await page.evaluate('window.__touchFired'));
    await walk(page, 'down', 1);

    /* ---------------------------------------------------------------- performance budget */
    const perf = await page.evaluate(function () {
      const G = window.G;
      const objs = [], evs = [], rows = [];
      for (let y = 0; y < 30; y++) rows.push(new Array(40).fill('g').join(''));
      for (let i = 0; i < 80; i++) objs.push({ obj: 'test_tree_round', x: (i * 7) % 38 + 1, y: (i * 3) % 28 + 1 });
      for (let i = 0; i < 20; i++) {
        evs.push({ id: 'perf' + i, x: (i * 11) % 38 + 1, y: (i * 5) % 28 + 1,
          pages: [{ cond: null, sprite: { char: 'test' }, trigger: 'action', move: { type: 'wander', radius: 4 }, commands: [['wait', 1]] }] });
      }
      G.registerMap('perf_probe', { name: 'Perf', hideName: true, width: 40, height: 30, backdrop: '#222',
        legend: { g: 'test_grass', d: 'test_dirt' }, ground: rows, objects: objs, events: evs });
      return window.__game.teleport('perf_probe', 20, 15, 'down').then(function () {
        const s = G.Scenes.find('map');
        const ctx = G.Gfx.ctx;
        for (let i = 0; i < 20; i++) { s.update(); G.Gfx.begin(); s.draw(ctx); G.Gfx.end(); }   // warm the chunk cache
        const t0 = performance.now();
        for (let i = 0; i < 120; i++) { s.update(); G.Gfx.begin(); s.draw(ctx); G.Gfx.end(); }
        return (performance.now() - t0) / 120;
      });
    });
    check('a 40x30 map with 80 objects and 20 events updates+draws inside the 16.6 ms budget',
      perf < 16.6, perf.toFixed(2) + ' ms per frame');

    /* ---------------------------------------------------------------- errors */
    const errors = await H.getErrors(page);
    check('no errors or warnings', errors.length === 0, errors.join(' | '));
  } finally {
    await browser.close();
  }

  console.log('');
  if (failures.length) {
    console.log(failures.length + ' failure(s):');
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
  console.log('map self-test passed.');
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
