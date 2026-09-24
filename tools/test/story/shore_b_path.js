/*
 * shore_b_path.js - drives shore_b's critical path (shingle_beach + brills_chippy).
 *
 *   node tools/test/story/shore_b_path.js [--headful]
 *
 * It walks the real events, not the common events behind them:
 *   1. prologue        tide 0 -> the fourth glass -> cg_prologue_glass -> ce_prologue_done -> wren_house
 *   2. the gate, T1    sk1 unmet -> hint + pushed back; sk1 met -> sk2 -> cg_tide_steps -> ce_go_down
 *   3. the chippy, T2  the face-down sign -> Odo bursts in -> sk3 -> ce_said_3
 *   4. the slip, T4    sk7+sk8 met -> ghost_choice -> the_slip -> ce_go_down
 *   5. sk9, T5         the mouth -> ce_said_9 -> ce_go_down
 *
 * Exit code 1 on any failed check or on a runtime error that is not a missing-asset warning.
 */
'use strict';

const path = require('path');
const H = require(path.join(__dirname, '..', 'lib', 'harness'));

const HEADFUL = process.argv.indexOf('--headful') >= 0;
let failures = 0;

function check(what, ok, detail) {
  console.log((ok ? '  ok   ' : '  FAIL ') + what + (ok || !detail ? '' : ' -> ' + detail));
  if (!ok) failures++;
}

/** Runs frames until the interpreter and every modal box are done (or the budget runs out). */
async function idle(page, budget) {
  let left = budget || 1500;
  while (left > 0) {
    const busy = await page.evaluate(function () {
      return window.G.Interpreter.isBusy() || window.G.UI.isModal();
    });
    if (!busy) return true;
    await H.advance(page, 5);
    left -= 5;
  }
  return false;
}

const info = page => page.evaluate(() => window.__game.mapInfo());
const flag = (page, k) => page.evaluate(k => window.G.State.getFlag(k), k);
const vr = (page, k) => page.evaluate(k => window.G.State.getVar(k), k);

async function setup(page, opts) {
  await page.evaluate(function (o) {
    const g = window.__game;
    g.skipText = true;
    g.autoChoice = o.choice;
    for (const k of Object.keys(o.flags || {})) window.G.State.setFlag(k, o.flags[k]);
    for (const k of Object.keys(o.vars || {})) window.G.State.setVar(k, o.vars[k]);
  }, opts);
}

/** Walks one tile in `dir` by holding the key, then waits for whatever it triggered. */
async function step(page, dir) {
  await page.evaluate(d => window.G.Input.simulate(d, true), dir);
  await H.advance(page, 16);
  await page.evaluate(d => window.G.Input.simulate(d, false), dir);
  await H.advance(page, 6);
  await idle(page);
}

(async function main() {
  const { browser, page } = await H.launchGame({ headless: HEADFUL ? false : 'new' });

  /* ---------------------------------------------------------------- 1. the prologue */
  console.log('\n1. prologue (tide 0)');
  await page.evaluate(() => window.__game.newGame());
  await H.advance(page, 30);
  await setup(page, { choice: 0, vars: { tide: 0 } });
  const start = await info(page);
  check('new game starts on shingle_beach', start.id === 'shingle_beach', start.id);
  await idle(page, 2000);                                   /* the auto event narrates */

  /* three of the four shining spots already picked up, then walk onto the fourth (30,12) */
  await setup(page, { choice: 0, vars: { beach_glass: 3 } });
  await page.evaluate(() => window.__game.teleport('shingle_beach', 30, 13, 'up'));
  await H.advance(page, 20);
  await step(page, 'up');
  await idle(page, 3000);
  const after = await info(page);
  check('the fourth glass ends the prologue in wren_house', after.id === 'wren_house', after.id);
  check('prologue_done is set', await flag(page, 'prologue_done') === true);
  check('tide is 1', await vr(page, 'tide') === 1);

  /* ---------------------------------------------------------------- 2. the gate, tide 1 */
  console.log('\n2. the gate at the Tide Steps mouth (tide 1)');
  await setup(page, {
    choice: 0,
    vars: { tide: 1 },
    flags: { sk1_said: false, sk1_kept: false, sk2_said: false, sk2_kept: false },
  });
  await page.evaluate(() => window.__game.teleport('shingle_beach', 20, 25, 'down'));
  await H.advance(page, 20);
  await step(page, 'down');
  const blocked = await info(page);
  check('gate refuses while sk1 is unmet', blocked.id === 'shingle_beach' && blocked.player.y === 25,
    blocked.id + ' ' + blocked.player.x + ',' + blocked.player.y);

  await setup(page, { choice: 0, flags: { sk1_said: true } });
  await step(page, 'down');
  await idle(page, 4000);
  const down = await info(page);
  check('sk2 + cg_tide_steps then ce_go_down -> tide_steps', down.id === 'tide_steps', down.id);
  check('sk2_said is set (Say it)', await flag(page, 'sk2_said') === true);
  check('true_words counted', (await vr(page, 'true_words')) >= 1);

  /* ---------------------------------------------------------------- 3. the chippy, tide 2 */
  console.log('\n3. the CLOSING DOWN sign and sk3 (tide 2)');
  await setup(page, { choice: 0, vars: { tide: 2 }, flags: { sk3_said: false, sk3_kept: false } });
  await page.evaluate(() => window.__game.teleport('brills_chippy', 16, 4, 'up'));
  await H.advance(page, 20);
  await H.press(page, 'confirm', 10);
  await idle(page, 4000);
  check('the sign was turned over', await flag(page, 'brills_chippy_sign_turned') === true);
  check('sk3_said is set (Say it)', await flag(page, 'sk3_said') === true);
  const chippy = await info(page);
  check('still in the chippy afterwards', chippy.id === 'brills_chippy', chippy.id);

  /* the shop counter answers through the counter prop */
  await page.evaluate(() => window.__game.teleport('brills_chippy', 4, 5, 'up'));
  await H.advance(page, 20);
  await page.evaluate(() => { window.__game.autoChoice = 1; });       /* "Just looking." */
  await H.press(page, 'confirm', 10);
  await idle(page, 2500);
  check('Mr Brill answers across the counter', await vr(page, 'brills_chippy_egg_tide') >= 0);

  /* ---------------------------------------------------------------- 4. the slip, tide 4 */
  console.log('\n4. the slip (tide 4)');
  await setup(page, {
    choice: 2,                                              /* ghost_choice: the only live line */
    vars: { tide: 4 },
    flags: { sk7_said: true, sk8_said: true, the_slip: false },
  });
  await page.evaluate(() => window.__game.teleport('shingle_beach', 20, 25, 'down'));
  await H.advance(page, 20);
  await step(page, 'down');
  await idle(page, 6000);
  const slipped = await info(page);
  check('the slip ends in ce_go_down -> tide_steps', slipped.id === 'tide_steps', slipped.id);
  check('the_slip is set', await flag(page, 'the_slip') === true);

  /* ---------------------------------------------------------------- 5. sk9, tide 5 */
  console.log('\n5. sk9 (tide 5)');
  await setup(page, { choice: 0, vars: { tide: 5 }, flags: { sk9_said: false, sk9_kept: false } });
  await page.evaluate(() => window.__game.teleport('shingle_beach', 20, 25, 'down'));
  await H.advance(page, 20);
  await step(page, 'down');
  await idle(page, 5000);
  const last = await info(page);
  check('sk9 ends in ce_go_down -> tide_steps', last.id === 'tide_steps', last.id);
  check('sk9_said is set', await flag(page, 'sk9_said') === true);

  /* ---------------------------------------------------------------- runtime errors */
  const errors = (await H.getErrors(page)).filter(function (e) {
    return !/Missing (image|audio)/.test(e);
  });
  check('no runtime errors beyond missing assets', errors.length === 0, errors.join(' | '));

  await H.shot(page, 'shore_b_path_end');
  await browser.close();

  console.log(failures ? '\nSHORE_B PATH FAILED (' + failures + ')' : '\nSHORE_B PATH OK');
  process.exit(failures ? 1 : 0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
