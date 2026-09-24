#!/usr/bin/env node
/*
 * endings_path.js - drives the three endings and their resume rules through the ending router
 * (bible 5.8): A "Sent", B "Not Yet" (with the rock-pool resume), C "Pearl" (with the "came back" way
 * out and the credits way out). Exit 1 on any failed check.
 *
 *   node tools/test/story/endings_path.js
 */
'use strict';
const path = require('path');
const H = require(path.join(__dirname, '..', 'lib', 'harness'));

let failures = 0;
function check(label, ok, extra) {
  console.log((ok ? '  ok   ' : '  FAIL ') + label + (extra ? ' -> ' + extra : ''));
  if (!ok) failures++;
}
const vr = (k) => 'window.__game.G.State.getVar("' + k + '")';
const flag = (k) => `window.__game.G.State.getFlag('${k}')`;

/** Advances until `expr` is true (any scene), or gives up. */
async function until(page, expr, label, budget) {
  budget = budget || 12000;
  for (let used = 0; used < budget; used += 40) {
    if (await page.evaluate(expr)) return true;
    // the rock pool's Save opens the save screen: pick the first slot like a player would
    if (used % 200 === 0 && (await page.evaluate('window.__game.scene()')) === 'save') {
      await page.evaluate(() => window.__game.press('confirm', 3));
    }
    await H.advance(page, 40);
  }
  console.log('  ...  gave up waiting for ' + label);
  return false;
}

/** Starts a finished game at the pearl_bed rock pool with the given finale flags. */
async function finaleState(page, flags) {
  const base = {
    prologue_done: true, pim_joined: true, odo_told: true, lin_told: true, the_slip: true,
    truth_known: true, pim_knows: true, memory_rocks_done: true, pearl_bed_reached: true,
    pearl_doors_open: true, nacre_offer_seen: true, nacre_delivered: true,
  };
  await page.evaluate((f) => window.__game.newGame({
    party: ['wren', 'odo', 'lin', 'pim'],
    map: { id: 'pearl_bed', x: 14, y: 20, dir: 'up' },
    vars: { tide: 6, true_words: 7, final_choice: 0 },
    flags: Object.assign({}, f),
    items: { nacres_slips: 1 }, money: 40,
  }), Object.assign(base, flags));
  await H.advance(page, 60);
  await H.waitIdle(page, 3000);
  for (const n of [1, 2, 3, 4, 5, 6, 7]) await page.evaluate((k) => window.__game.setFlag(k, true), 'sk' + n + '_said');
}

(async function main() {
  const { browser, page } = await H.launchGame({});
  try {
    await page.evaluate(() => { window.__game.skipText = true; window.__game.autoChoice = 0; window.__game.calm = true; });

    /* ---------------------------------------------------------------- B: Not Yet */
    await finaleState(page, { other_can_answered: true });
    await page.evaluate(() => window.__game.setVar('final_choice', 2));
    page.evaluate(() => window.__game.run([['call', 'ce_ending_router']]));
    await until(page, "window.__game.scene() === 'ending'", 'Ending B reaching the ending scene', 40000);
    check('B: ending scene reached', (await page.evaluate('window.__game.scene()')) === 'ending');
    check('B: ending_not_yet_done', await page.evaluate(flag('ending_not_yet_done')));
    check('B: the cleared game was saved at the rock pool (a save exists)', await page.evaluate('window.__game.G.State.hasAnySave()'));
    // skip through the ending pages and credits back to the title
    for (let i = 0; i < 60 && (await page.evaluate('window.__game.scene()')) === 'ending'; i++) {
      await page.evaluate(() => window.__game.press('confirm', 3));
      await H.advance(page, 40);
    }
    check('B: after the credits the title screen shows', (await page.evaluate('window.__game.scene()')) === 'title');
    // the cleared save resumes at the pearl_bed rock pool with the party
    const slot = await page.evaluate('window.__game.G.State.latestSlot ? window.__game.G.State.latestSlot() : 1');
    await page.evaluate((s) => window.__game.G.State.load(s), slot);
    const w = await page.evaluate('JSON.stringify(window.__game.G.State.map)');
    check('B: the cleared save resumes on pearl_bed', /pearl_bed/.test(w), w);

    /* ---------------------------------------------------------------- C: Pearl, then coming back */
    await finaleState(page, { gave_letter: true });
    await page.evaluate(() => window.__game.setVar('final_choice', 0));
    page.evaluate(() => window.__game.run([['call', 'ce_ending_router']]));
    await until(page, flag('ending_pearl_done'), 'Ending C staging', 40000);
    check('C: ending_pearl_done', await page.evaluate(flag('ending_pearl_done')));
    await until(page, "window.__game.mapInfo && window.__game.scene() === 'map' && window.__game.mapInfo().id === 'wren_house'", 'waking in Number 9', 20000);
    check('C: Wren wakes in Number 9', (await page.evaluate("window.__game.scene() === 'map' && window.__game.mapInfo().id")) === 'wren_house');
    // the last Say it / Keep it: autoChoice 0 = Say it -> came_back -> resume before the offer
    await until(page, flag('came_back'), "Odo's can call and the last Say it", 30000);
    check('C: saying it sets came_back', await page.evaluate(flag('came_back')));
    // came_back and the gave_letter reset are two script lines apart: let the second one run first
    await until(page, '!(' + flag('gave_letter') + ')', 'gave_letter to clear', 2000);
    check('C: gave_letter is cleared again', !(await page.evaluate(flag('gave_letter'))));
    await until(page, "window.__game.scene() === 'map' && window.__game.mapInfo().id === 'pearl_bed'", 'the way back down', 30000);
    check('C: the game resumes at the Pearl Bed', (await page.evaluate("window.__game.scene() === 'map' && window.__game.mapInfo().id")) === 'pearl_bed');

    /* ---------------------------------------------------------------- C: Pearl, keeping it -> credits */
    await finaleState(page, { gave_letter: true });
    await page.evaluate(() => { window.__game.autoChoice = 1; });     // Keep it
    page.evaluate(() => window.__game.run([['call', 'ce_ending_router']]));
    await until(page, "window.__game.scene() === 'ending'", 'Ending C credits', 60000);
    check('C (kept): ending scene reached', (await page.evaluate('window.__game.scene()')) === 'ending');
    await page.evaluate(() => { window.__game.autoChoice = 0; });

    /* ---------------------------------------------------------------- A: Sent (router only; the finale drive covers the staging) */
    await finaleState(page, { other_can_answered: true });
    await page.evaluate(() => window.__game.setVar('final_choice', 1));
    page.evaluate(() => window.__game.run([['call', 'ce_ending_router']]));
    // the letter, then Monday on the Row: Wren alone, the town at tide 6, the postbox ends the walk
    await until(page, "window.__game.scene() === 'map' && window.__game.mapInfo().id === 'harbour_row'", 'Ending A: Monday on Harbour Row', 60000);
    await until(page, flag('epilogue_arrived'), 'the Monday narration', 20000);
    await until(page, '!window.__game.G.Interpreter.isBusy() && !window.__game.G.UI.isModal()', 'the Row to be walkable', 20000);
    check('A: Wren walks the Row alone at tide 6', (await page.evaluate('window.__game.G.State.party.length')) === 1 && (await page.evaluate(vr('tide'))) === 6);
    await page.evaluate(() => window.__game.teleport('harbour_row', 18, 12, 'down'));
    await H.advance(page, 30);
    await page.evaluate(() => window.__game.press('confirm', 3));
    await until(page, "window.__game.scene() === 'ending'", 'Ending A reaching the ending scene', 60000);
    check('A: the postbox starts the ending', (await page.evaluate('window.__game.scene()')) === 'ending');
    check('A: ending_sent_done', await page.evaluate(flag('ending_sent_done')));
    check('A: the letter has three words', (await page.evaluate("window.__game.G.State.getVar('letter_1')")) > 0);

    const errs = (await page.evaluate('window.__game.errors()')).filter((e) => !/Missing image|Missing audio/.test(e));
    check('no unexpected runtime errors', errs.length === 0, errs.join(' | '));
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    await browser.close();
  }
  if (failures) { console.log('ENDINGS PATH FAILED (' + failures + ')'); process.exit(1); }
  console.log('endings path passed.');
})();
