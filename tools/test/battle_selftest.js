#!/usr/bin/env node
/*
 * battle_selftest.js - drives the battle scene in headless Chrome:
 * starts several troops through __game.startBattle (including a boss and the Other Can), plays each of
 * them with one of the automatic policies, drives one turn by hand with simulated key presses (skill
 * list, Confide with the C hotkey, Say to a Line), takes screenshots and fails on __game.errors().
 *
 *   node tools/test/battle_selftest.js            (add --no-build to skip "node tools/build.js")
 *
 * Screenshots land in tools/test/shots/battle_*.png. Exit code 1 on any failed check or captured error.
 */
'use strict';

const H = require('./lib/harness');

const failures = [];
function check(name, ok, detail) {
  if (ok) { console.log('  ok   ' + name + (detail ? '  (' + detail + ')' : '')); return true; }
  failures.push(name + (detail ? ' -> ' + detail : ''));
  console.log('  FAIL ' + name + (detail ? ' -> ' + detail : ''));
  return false;
}

async function waitFor(page, expr, maxFrames, label) {
  let left = maxFrames || 900;
  while (left > 0) {
    if (await page.evaluate(expr)) return true;
    await H.advance(page, 6);
    left -= 6;
  }
  check('wait for ' + (label || expr), false, 'timed out');
  return false;
}

/** New game with the real party at a given level. */
async function newParty(page, level, flags) {
  await page.evaluate(async function (lv, fl) {
    window.__game.skipText = true;
    await window.__game.newGame({ party: ['wren', 'odo', 'lin', 'pim'], map: { id: 'test_map', x: 15, y: 12, dir: 'up' } });
    window.__game.setLevel(lv);
    for (const f of fl) window.G.State.setFlag(f, true);
    window.G.State.setVar('true_words', 6);
    window.G.State.addItem('bag_of_chips', 5);
    window.G.State.album = {};
  }, level, flags || []);
  await H.advance(page, 6);
}

async function startBattle(page, troop) {
  await page.evaluate(function (t) { return window.__game.startBattle(t); }, troop);
  await waitFor(page, '__game.scene() === "battle"', 300, 'battle scene');
  await H.advance(page, 60);
}

/** Runs the battle with a policy until the scene is popped; returns the result. */
async function autoFinish(page, policy, budget) {
  await page.evaluate(function (p) {
    window.__battleResult = null;
    const r = window.__game.battleAuto(p);
    if (r && r.then) r.then(function (x) { window.__battleResult = x; });
  }, policy);
  let left = budget || 9000;
  while (left > 0 && await page.evaluate('__game.scene() === "battle"')) {
    await H.advance(page, 60);
    left -= 60;
  }
  return page.evaluate(function () {
    const s = window.G.Scenes;
    return window.__battleResult || (window.__lastBattle || null);
  });
}

function state(page) {
  return page.evaluate(function () {
    const s = window.G.Scenes.find('battle');
    if (!s) return null;
    const b = s.b;
    return {
      phase: s.phase, mode: s.mode, round: b.round, active: s.active ? s.active.id : null,
      canLineUsed: b.canLine.used, delivered: b.delivered, hushed: b.hushed,
      enemies: b.enemies.map(function (e) {
        return { id: e.id, hp: e.hp, mhp: e.mhp, resolved: e.resolved, lines: e.lines.map(function (l) { return { c: l.c, star: !!l.star, revealed: l.revealed, filled: l.filled }; }) };
      }),
      party: b.party.map(function (m) {
        return { id: m.id, hp: m.hp, mhp: m.mhp, pocket: m.pocket, brim: m.brimState || null, spill: m.spill ? m.spill.colour : null };
      }),
      commands: (s.commands || []).map(function (c) { return { id: c.id, enabled: c.enabled, reason: c.reason }; }),
    };
  });
}

/** Steps the scene until it is waiting for a command from a given member (or any). */
async function waitForInput(page, actorId) {
  return waitFor(page, '(function(){const s=G.Scenes.find("battle"); return !!s && s.phase==="input" && s.mode==="command"' +
    (actorId ? ' && s.active && s.active.id==="' + actorId + '"' : '') + ';})()', 2400, 'input from ' + (actorId || 'anyone'));
}

async function tap(page, action, after) {
  await page.evaluate(function (a) { window.G.Input.simulate(a, true); }, action);
  await H.advance(page, 3);
  await page.evaluate(function (a) { window.G.Input.simulate(a, false); }, action);
  await H.advance(page, after == null ? 4 : after);
}

/** Presses a physical key that is not mapped to an action (the C hotkey). */
async function rawKey(page, code) {
  await page.evaluate(function (c) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: c, bubbles: true }));
  }, code);
  await H.advance(page, 4);
  await page.evaluate(function (c) {
    window.dispatchEvent(new KeyboardEvent('keyup', { code: c, bubbles: true }));
  }, code);
  await H.advance(page, 4);
}

/** Moves the command fan cursor onto a command id. */
async function fanTo(page, id) {
  for (let i = 0; i < 12; i++) {
    const at = await page.evaluate(function () {
      const s = window.G.Scenes.find('battle');
      return s && s.commands ? s.commands[s.cmdIndex].id : null;
    });
    if (at === id) return true;
    await tap(page, 'right', 3);
  }
  return false;
}

async function main() {
  if (!process.argv.includes('--no-build')) {
    require('child_process').execSync('node ' + require('path').join(H.ROOT, 'tools', 'build.js'), { stdio: 'inherit' });
  }
  const { browser, page } = await H.launchGame({ query: 'debug=1' });
  try {
    /* ============================================================ 1. a first battle, played by hand */
    await newParty(page, 3);
    await startBattle(page, 'troop_card_crab');
    check('scene is "battle"', await page.evaluate('__game.scene()') === 'battle');
    await waitForInput(page);
    let s = await state(page);
    check('the battle has two Unsent', s.enemies.length === 2, JSON.stringify(s.enemies.map(function (e) { return e.id; })));
    check('everybody has five Pocket slots', s.party.every(function (m) { return m.pocket.length === 5; }));
    check('the active member gained a home-colour piece', s.party.some(function (m) { return m.pocket.some(function (p) { return p && !p.pebble; }); }));
    await H.shot(page, 'battle_01_command_fan');

    // --- Confide with the C hotkey: C, confirm, confirm
    const before = await state(page);
    await rawKey(page, 'KeyC');
    let mode = await page.evaluate('G.Scenes.find("battle").mode');
    check('the C hotkey jumps straight to Confide', mode === 'pocket', mode);
    await H.shot(page, 'battle_02_confide_pick');
    await tap(page, 'confirm', 6);
    mode = await page.evaluate('G.Scenes.find("battle").mode');
    check('then it asks which friend', mode === 'ally', mode);
    await tap(page, 'confirm', 30);
    s = await state(page);
    check('the Can Line is used up for the round', s.canLineUsed);
    const tumbled = s.party.some(function (m) { return m.pocket.some(function (p) { return p && p.t; }); });
    check('the piece arrived Tumbled', tumbled, JSON.stringify(s.party.map(function (m) { return m.pocket; })));

    // --- open the skill list, flip Plain / Out Loud, then cancel back
    await waitFor(page, '(function(){const s=G.Scenes.find("battle");return s.phase==="input"&&s.mode==="command";})()', 600, 'command fan');
    await fanTo(page, 'skill');
    await tap(page, 'confirm', 6);
    check('the skill list opens', await page.evaluate('G.Scenes.find("battle").mode') === 'skill');
    await H.shot(page, 'battle_03_skill_list');
    await tap(page, 'right', 4);
    await tap(page, 'cancel', 6);
    check('cancel goes back to the command fan', await page.evaluate('G.Scenes.find("battle").mode') === 'command');

    // --- Listen, so a Line is revealed, then Say a piece to it
    await fanTo(page, 'listen');
    await tap(page, 'confirm', 6);
    await tap(page, 'confirm', 40);
    await waitFor(page, '(function(){const s=G.Scenes.find("battle");return s.phase==="input"&&s.mode==="command";})()', 1200, 'next command');
    s = await state(page);
    check('Listen revealed a Line', s.enemies.some(function (e) { return e.lines.some(function (l) { return l.revealed; }); }),
      JSON.stringify(s.enemies[0].lines));
    await H.shot(page, 'battle_04_after_listen');

    // drive a Say by hand: Say -> piece -> enemy -> line
    await fanTo(page, 'say');
    const sayEnabled = await page.evaluate(function () {
      const s = window.G.Scenes.find('battle');
      return s.commands[s.cmdIndex].enabled;
    });
    if (sayEnabled) {
      await tap(page, 'confirm', 5);
      check('Say asks for a piece first', await page.evaluate('G.Scenes.find("battle").mode') === 'pocket');
      await tap(page, 'confirm', 5);
      check('then for an Unsent', await page.evaluate('G.Scenes.find("battle").mode') === 'enemy');
      await tap(page, 'confirm', 5);
      check('then for a Line', await page.evaluate('G.Scenes.find("battle").mode') === 'line');
      await H.shot(page, 'battle_05_say_line');
      await tap(page, 'confirm', 60);
      const after = await state(page);
      check('the Say resolved (a Line filled or Misheard)', after.phase !== 'input' || after.round >= 1);
    } else {
      check('Say is greyed with a reason', !!(await state(page)).commands.find(function (c) { return c.id === 'say'; }).reason);
    }

    // --- finish this one automatically
    let r = await autoFinish(page, 'smart', 7000);
    check('the hand-driven battle finishes', await page.evaluate('__game.scene()') !== 'battle',
      await page.evaluate('__game.scene()'));

    /* ============================================================ 1b. the tutorial troop and its hints */
    await newParty(page, 1);
    await page.evaluate(function () { window.__game.skipText = false; });
    await startBattle(page, 'troop_tutorial_card');
    await waitForInput(page);
    const hint = await page.evaluate(function () {
      const s = window.G.Scenes.find('battle');
      return s.hint ? s.hint.text : null;
    });
    check('the tutorial troop shows a hint strip', !!hint, String(hint));
    await H.shot(page, 'battle_08_tutorial_hint');
    // the result strip and level-up tags, drawn with real numbers
    await page.evaluate(function () {
      const s = window.G.Scenes.find('battle');
      s.__savedPhase = s.phase;
      s.__savedMode = s.mode;
      s.phase = 'result';
      s.timer = 40;
      s.resultLines = ['Delivered 1 \u00b7 Hushed 1 \u00b7 19 EXP \u00b7 13 Stamps', 'Found: Bag of Chips',
        'Wren is level 2 \u2014 learnt Beachcomb'];
      s.result = { outcome: 'win', delivered: 1, hushed: 1, rounds: 3 };
    });
    await page.evaluate(function () {
      // one frame is enough to see the strip: draw it without letting update() pop the scene
      const s = window.G.Scenes.find('battle');
      const ctx = window.G.Gfx.ctx;
      window.G.Gfx.begin(); s.draw(ctx); window.G.Gfx.end();
    });
    await H.shot(page, 'battle_09_result_strip');
    await page.evaluate(function () {
      const s = window.G.Scenes.find('battle');
      s.phase = s.__savedPhase || 'input';
      s.mode = s.__savedMode || 'command';
      s.result = null;
      s.resultLines = [];
      s.timer = 0;
      window.__game.skipText = true;
    });
    await autoFinish(page, 'pacifist', 4000);
    check('the tutorial battle ends', await page.evaluate('__game.scene()') !== 'battle');

    /* ============================================================ 2. each policy on a roamer troop */
    for (const policy of ['attack', 'smart', 'pacifist']) {
      await newParty(page, 6);
      await startBattle(page, 'troop_listworm_overdue');
      await autoFinish(page, policy, 12000);
      const done = await page.evaluate('__game.scene()');
      check('policy "' + policy + '" plays troop_listworm_overdue to the end', done !== 'battle', done);
    }

    /* ============================================================ 3. a boss */
    await newParty(page, 8, ['odo_told', 'lin_told', 'pim_knows']);
    await startBattle(page, 'troop_gull');
    await H.advance(page, 120);
    await H.shot(page, 'battle_06_boss');
    await autoFinish(page, 'smart', 20000);
    check('the Postmaster Gull battle ends', await page.evaluate('__game.scene()') !== 'battle');

    /* ============================================================ 4. the Other Can */
    await newParty(page, 9, ['odo_told', 'lin_told', 'pim_knows']);
    await startBattle(page, 'troop_other_can');
    await H.advance(page, 90);
    let oc = await state(page);
    check('the Other Can cannot be struck', oc.commands.find(function (c) { return c.id === 'strike'; }).enabled === false,
      JSON.stringify(oc.commands.find(function (c) { return c.id === 'strike'; })));
    await H.shot(page, 'battle_07_other_can');
    await autoFinish(page, 'pacifist', 20000);
    check('the Other Can battle ends', await page.evaluate('__game.scene()') !== 'battle');

    /* ============================================================ 5. rewards reached the save state */
    const st = await page.evaluate(function () {
      return {
        money: window.G.State.money,
        levels: window.G.State.party.map(function (a) { return { id: a.id, lv: a.level, hp: a.hp, exp: a.exp }; }),
        album: Object.keys(window.G.State.album || {}),
        delivered: window.G.State.getVar('delivered_count'),
      };
    });
    check('everybody is standing again after the battles', st.levels.every(function (a) { return a.hp > 0; }), JSON.stringify(st.levels));
    check('the album remembers the Unsent that were met', st.album.length > 0, st.album.join(','));

    /* ============================================================ 6. errors */
    const errors = await H.getErrors(page);
    check('no errors or warnings', errors.length === 0, errors.slice(0, 6).join(' | '));
  } finally {
    await browser.close();
  }

  console.log('');
  if (failures.length) {
    console.log(failures.length + ' failure(s):');
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
  console.log('battle self-test passed.');
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
