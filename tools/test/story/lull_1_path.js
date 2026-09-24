#!/usr/bin/env node
/*
 * lull_1_path.js - drives the critical path of lull_1's three maps in a real headless browser.
 *
 *   node tools/test/story/lull_1_path.js            (starts its own server; --keep leaves screenshots)
 *
 * Path: tide_steps first arrival -> west door -> sorting_shallows (Pim, Deliver tutorial, Sorting puzzle,
 * the pigeonhole gate, Postmaster Gull, Nacre's first slip, ce_tide_done) -> tide_steps east door ->
 * blare_reef (Pim's blurt, the Horn Pipes, odo_told, troop_big_noise, the Great Horn, the second slip,
 * ce_tide_done).
 *
 * Exits 1 on a failed check or on a runtime error that is not in ALLOWED (maps other writers have not
 * registered yet). Battles are auto-played with the 'pacifist' policy so both Deliver branches run.
 */
'use strict';

const H = require('../lib/harness');

/* Runtime errors that belong to other writers' unfinished files, not to this path. */
const ALLOWED = [
  /unknown map "(shingle_beach|harbour_row|wren_house|brills_chippy|slack_water|undertow_light|memory_rocks|pearl_bed)"/,
  /Missing audio/,
  /Missing image/,
  /unknown common event/,
];

let failures = 0;
function check(label, ok, extra) {
  console.log((ok ? '  ok   ' : '  FAIL ') + label + (extra ? ' -> ' + extra : ''));
  if (!ok) failures++;
}

/** Steps N fixed frames and auto-plays any battle that turns up. */
async function pump(page, steps) {
  for (let i = 0; i < steps; i += 20) {
    await page.evaluate(function () {
      if (!window.__auto) window.__auto = { busy: false };
      if (window.__game.scene() === 'battle' && !window.__auto.busy) {
        window.__auto.busy = true;
        Promise.resolve(window.__game.battleAuto('pacifist'))
          .catch(function () {})
          .then(function () { window.__auto.busy = false; });
      }
    });
    await H.advance(page, 20);
  }
}

/** Pumps until `expr` (a JS expression string) is true, or gives up. */
async function until(page, expr, label, budget) {
  budget = budget || 12000;
  for (let used = 0; used < budget; used += 40) {
    if (await page.evaluate(expr)) return true;
    await pump(page, 40);
  }
  check(label, false, 'timed out');
  return false;
}

const flag = function (k) { return 'window.__game.G.State.getFlag(' + JSON.stringify(k) + ')'; };
const vr = function (k) { return 'window.__game.G.State.getVar(' + JSON.stringify(k) + ')'; };
const mapId = 'window.__game.mapInfo().id';

/** Pumps until no battle or event is running (teleporting on top of a battle would abort it). */
async function settle(page, budget) {
  for (let used = 0; used < (budget || 6000); used += 40) {
    const idle = await page.evaluate(function () {
      const G = window.__game.G;
      return window.__game.scene() === 'map' && !G.Interpreter.isBusy() && !(G.UI.isModal && G.UI.isModal());
    });
    if (idle) return;
    await pump(page, 40);
  }
}

async function tp(page, id, x, y, dir) {
  await settle(page);
  await page.evaluate(function (a) { return window.__game.teleport(a.id, a.x, a.y, a.dir); }, { id: id, x: x, y: y, dir: dir });
  await pump(page, 120);
}

async function step(page, dir, n) {
  for (let i = 0; i < (n || 1); i++) {
    await page.evaluate(function (d) { return window.__game.press(d, 14); }, dir);
    await pump(page, 40);
  }
}

async function act(page) {
  await page.evaluate(function () { return window.__game.press('confirm', 3); });
  await pump(page, 60);
}

(async function main() {
  const { browser, page } = await H.launchGame({ query: 'debug=1' });
  try {
    await page.evaluate(function () {
      window.__game.skipText = true;
      window.__game.calm = true;                       // chasing roamers would catch a standing driver
      window.__game.autoChoice = 0;
      return window.__game.newGame();
    });
    await pump(page, 60);

    /* ---------------------------------------------------------------- TIDE 1: the hub */
    await page.evaluate(function () {
      window.__game.setVar('tide', 1);
      window.__game.addMember('odo');
      window.__game.addMember('lin');
    });
    await tp(page, 'tide_steps', 12, 2, 'down');
    await until(page, flag('tide_steps_arrived'), 'tide_steps: the colour floods in');
    check('tide_steps: first arrival played', await page.evaluate(flag('tide_steps_arrived')));
    await H.shot(page, 'lull1_01_tide_steps');

    /* Shelley is open for business */
    await tp(page, 'tide_steps', 17, 11, 'up');
    await act(page);
    await pump(page, 120);
    await page.evaluate(function () { return window.__game.press('cancel', 3); });
    await pump(page, 120);

    /* west door -> Sorting Shallows */
    await tp(page, 'tide_steps', 3, 24, 'left');
    await step(page, 'left', 2);
    await until(page, mapId + " === 'sorting_shallows'", 'west door -> sorting_shallows');
    check('arrived in Sorting Shallows', await page.evaluate(mapId) === 'sorting_shallows');

    /* ---------------------------------------------------------------- TIDE 1: Pim */
    await tp(page, 'sorting_shallows', 32, 15, 'left');
    await step(page, 'left', 2);                       /* the kicking-legs notice at (31,15) */
    await tp(page, 'sorting_shallows', 28, 15, 'up');
    await act(page);
    await until(page, flag('pim_joined'), 'Pim is pulled out of the pigeonhole');
    check('pim_joined', await page.evaluate(flag('pim_joined')));
    check('Pim is in the party', await page.evaluate("window.__game.G.State.party.some(function(a){return a.id==='pim';})"));

    /* ---------------------------------------------------------------- TIDE 1: the Deliver tutorial */
    await tp(page, 'sorting_shallows', 23, 15, 'left');
    await step(page, 'left', 2);
    await until(page, flag('sorting_shallows_tutorial'), 'the Thank-You Card tutorial battle', 20000);
    check('tutorial battle resolved', await page.evaluate(flag('sorting_shallows_tutorial')));

    /* ---------------------------------------------------------------- TIDE 1: the Sorting puzzle */
    await tp(page, 'sorting_shallows', 7, 13, 'up');
    await act(page);
    check('letter 1 picked up', await page.evaluate(vr('sort_carry')) === 1, 'sort_carry=' + await page.evaluate(vr('sort_carry')));
    await tp(page, 'sorting_shallows', 13, 13, 'up');
    await act(page);
    check('letter 1 filed in the red bin', await page.evaluate(vr('sort_count')) === 1);

    /* wrong bin: the letter goes home in a huff */
    await tp(page, 'sorting_shallows', 24, 8, 'up');
    await act(page);
    await tp(page, 'sorting_shallows', 13, 13, 'up');
    await act(page);
    check('a misfiled letter goes home', await page.evaluate(vr('sort_carry')) === 0 &&
      await page.evaluate(flag('sort_l2_taken')) !== true);

    /* skip the middle of the puzzle, then file the last one for real */
    await page.evaluate(function () { window.__game.setVar('sort_count', 5); });
    await tp(page, 'sorting_shallows', 24, 8, 'up');
    await act(page);
    await tp(page, 'sorting_shallows', 17, 13, 'up');
    await act(page);
    await until(page, flag('sort_done'), 'six of six: the drawer wall opens');
    check('sort_done', await page.evaluate(flag('sort_done')));

    /* ---------------------------------------------------------------- TIDE 1: Postmaster Gull */
    await page.evaluate(() => window.__game.setLevel(3));   /* the level a player has after the four roamers */
    await tp(page, 'sorting_shallows', 6, 10, 'up');
    await step(page, 'up', 4);                          /* through the open gate into the alcove */
    await tp(page, 'sorting_shallows', 6, 6, 'up');
    await step(page, 'up', 1);
    await until(page, flag('sorting_shallows_boss_done'), 'the Postmaster Gull fight', 30000);
    check('gull fight resolved', await page.evaluate(flag('sorting_shallows_boss_done')));
    check('gull_delivered (pacifist policy)', await page.evaluate(flag('gull_delivered')));
    await until(page, "window.__game.G.State.itemCount('nacres_slips') > 0", "Nacre's first slip");
    check('key item nacres_slips', await page.evaluate("window.__game.G.State.itemCount('nacres_slips') > 0"));
    await until(page, vr('tide') + ' === 2', 'ce_tide_done moved the clock to tide 2');
    check('tide is 2', await page.evaluate(vr('tide')) === 2);
    await H.shot(page, 'lull1_02_sorting_shallows');

    /* ---------------------------------------------------------------- TIDE 2: east door -> Blare Reef */
    await tp(page, 'tide_steps', 20, 24, 'right');
    await step(page, 'right', 2);
    await until(page, mapId + " === 'blare_reef'", 'east door -> blare_reef');
    check('arrived on Blare Reef', await page.evaluate(mapId) === 'blare_reef');

    /* Pim's first blurt */
    await tp(page, 'blare_reef', 9, 14, 'right');
    await step(page, 'right', 2);
    await until(page, flag('blare_reef_blurt'), "Pim's first blurt");
    check('blare_reef_blurt', await page.evaluate(flag('blare_reef_blurt')));

    /* the Horn Pipes: a must point right, d must point right, b and c stay left */
    await tp(page, 'blare_reef', 16, 12, 'up');
    await act(page);
    check('pipe_a points right', await page.evaluate(vr('pipe_a')) === 1);
    await tp(page, 'blare_reef', 31, 13, 'up');
    await act(page);
    check('pipe_d points right', await page.evaluate(vr('pipe_d')) === 1);

    /* the mouth horn: the reef goes quiet, Odo says his true thing, the reef takes offence */
    await tp(page, 'blare_reef', 9, 17, 'up');
    await act(page);
    await until(page, flag('pipes_solved'), 'the pipes carry the message', 30000);
    check('pipes_solved', await page.evaluate(flag('pipes_solved')));
    await until(page, flag('odo_told'), 'Odo says it out loud', 30000);
    check('odo_told', await page.evaluate(flag('odo_told')));
    await pump(page, 600);                              /* troop_big_noise resolves here */

    /* the Great Horn and the second slip */
    await tp(page, 'blare_reef', 35, 14, 'right');
    await step(page, 'right', 3);
    await until(page, flag('blare_reef_slip'), "Nacre's second slip", 20000);
    check('blare_reef_slip', await page.evaluate(flag('blare_reef_slip')));
    await until(page, vr('tide') + ' === 3', 'ce_tide_done moved the clock to tide 3');
    check('tide is 3', await page.evaluate(vr('tide')) === 3);
    await H.shot(page, 'lull1_03_blare_reef');

    /* ---------------------------------------------------------------- errors */
    const errors = (await H.getErrors(page)).filter(function (e) {
      return !ALLOWED.some(function (re) { return re.test(e); });
    });
    check('no unexpected runtime errors', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('script ran to the end', false, (e && e.message) || String(e));
  } finally {
    await browser.close();
  }

  console.log(failures ? '\nLULL_1 PATH FAILED (' + failures + ')' : '\nLULL_1 PATH OK');
  process.exit(failures ? 1 : 0);
})();
