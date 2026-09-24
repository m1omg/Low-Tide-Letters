#!/usr/bin/env node
/*
 * lull_2_path.js - drives the critical path of Tide 3 (Slack Water) and Tide 4 (The Undertow Light and
 * The Rocks, Last September) with the window.__game hooks. Battles are auto-played with the pacifist
 * policy. Exit 1 on any failed check.
 *
 *   node tools/test/story/lull_2_path.js
 */
'use strict';
const path = require('path');
const H = require(path.join(__dirname, '..', 'lib', 'harness'));

let failures = 0;
function check(label, ok, extra) {
  console.log((ok ? '  ok   ' : '  FAIL ') + label + (extra ? ' -> ' + extra : ''));
  if (!ok) failures++;
}
const flag = (k) => `window.__game.G.State.getFlag('${k}')`;
const vr = (k) => `window.__game.G.State.getVar('${k}')`;

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

async function until(page, expr, label, budget) {
  budget = budget || 12000;
  for (let used = 0; used < budget; used += 40) {
    if (await page.evaluate(expr)) return true;
    await pump(page, 40);
  }
  console.log('  ...  gave up waiting for ' + label);
  return false;
}

async function tp(page, id, x, y, dir) {
  await settle(page);
  await page.evaluate(function (a) { return window.__game.teleport(a.id, a.x, a.y, a.dir); }, { id, x, y, dir });
  await pump(page, 120);
}
async function step(page, dir, n) {
  for (let i = 0; i < (n || 1); i++) {
    await page.evaluate(function (d) { return window.__game.press(d, 14); }, dir);
    await pump(page, 40);
  }
}
async function act(page) {
  await settle(page);
  await page.evaluate(function () { return window.__game.press('confirm', 3); });
  await pump(page, 60);
}
/** Interacts with an event from the tile below it (or from x,y facing dir). */
async function talk(page, map, x, y, dir) {
  await tp(page, map, x, y, dir || 'up');
  await act(page);
  await settle(page, 9000);
}

(async function main() {
  const { browser, page } = await H.launchGame({});
  try {
    await page.evaluate(() => { window.__game.skipText = true; window.__game.autoChoice = 0; window.__game.calm = true; });   // roamers must not catch a standing driver
    await page.evaluate(() => window.__game.newGame({
      party: ['wren', 'odo', 'lin', 'pim'],
      map: { id: 'tide_steps', x: 6, y: 28, dir: 'down' },
      vars: { tide: 3, true_words: 2 },
      flags: { prologue_done: true, pim_joined: true, odo_told: true, gull_delivered: true },
      items: { nacres_slips: 1 }, money: 30,
    }));
    await pump(page, 60);
    await settle(page);
    await page.evaluate(() => window.__game.setLevel(6));

    /* ---------------------------------------------------------------- TIDE 3: Slack Water */
    await tp(page, 'tide_steps', 6, 29, 'down');
    await step(page, 'down', 1);
    await until(page, "window.__game.mapInfo().id === 'slack_water'", 'the south-west door into Slack Water');
    check('arrived in Slack Water', (await page.evaluate('window.__game.mapInfo().id')) === 'slack_water');
    await settle(page, 9000);
    check('slack_water intro played', await page.evaluate(flag('sw_seen_intro')));

    // the vending machine gag: 1 Stamp + Odo's thump -> keepsake
    await talk(page, 'slack_water', 27, 6, 'up');
    check('the compliment machine gave doing_fine_token',
      await page.evaluate("window.__game.G.State.itemCount('doing_fine_token') > 0"));

    // Four Clocks: LOW, HIGH, FLOOD, EBB = 2, 0, 3, 1 is "right"; the LATE door needs exactly three right.
    for (let n = 1; n <= 4; n++) await page.evaluate((k) => window.__game.setVar(k, [2, 0, 3, 1][k.slice(-1) - 1]), 'clock_' + n);
    await talk(page, 'slack_water', 30, 7, 'up');           // door ON TIME: loops back to the start
    check('ON TIME loops back to the start tile',
      JSON.stringify(await page.evaluate('[window.__game.mapInfo().player.x, window.__game.mapInfo().player.y]')) === '[4,24]');
    await page.evaluate(() => window.__game.setVar('clock_4', 0));   // one clock wrong on purpose
    await talk(page, 'slack_water', 32, 7, 'up');           // door LATE
    check('late_door_open after exactly three right', await page.evaluate(flag('late_door_open')));
    check('the LATE door leads into the inner flat',
      JSON.stringify(await page.evaluate('[window.__game.mapInfo().player.x, window.__game.mapInfo().player.y]')) === '[20,12]');

    // the boss: Perfectly Fine
    // the trigger tile (24,13) is walled in by in-trays north and south; a roamer on the two tiles before it
    // would start its own fight and eat the steps, so arrive on the tile itself (a touch tile fires on arrival)
    await tp(page, 'slack_water', 24, 13, 'right');
    await until(page, flag('sw_boss_done'), 'the Perfectly Fine fight', 40000);
    check('Perfectly Fine resolved', await page.evaluate(flag('sw_boss_done')));
    check('fine_delivered or fine_hushed', await page.evaluate(flag('fine_delivered') + '||' + flag('fine_hushed')));
    await until(page, vr('tide') + ' === 4', 'ce_tide_done moved the clock to tide 4', 40000);
    check('lin_told', await page.evaluate(flag('lin_told')));
    check('tide is 4', (await page.evaluate(vr('tide'))) === 4);
    await settle(page);                                   // the party leaves AFTER tide ticks over; do not read it mid-scene
    check('Wren alone on the Shore again', (await page.evaluate('window.__game.G.State.party.length')) === 1);

    /* ---------------------------------------------------------------- TIDE 4: The Undertow Light */
    await settle(page);
    await page.evaluate(() => { const g = window.__game; g.addMember('odo'); g.addMember('lin'); g.addMember('pim'); g.setFlag('the_slip', true); });
    await tp(page, 'tide_steps', 14, 29, 'down');
    await step(page, 'down', 1);
    await until(page, "window.__game.mapInfo().id === 'undertow_light'", 'the south door into the Undertow Light');
    check('arrived in the Undertow Light', (await page.evaluate('window.__game.mapInfo().id')) === 'undertow_light');
    await settle(page, 9000);

    // String Line: pick the string up in the dark room, then hook the posts Red, Blue, Amber, Green
    await tp(page, 'undertow_light', 15, 10, 'down');
    await step(page, 'down', 1);
    await settle(page, 9000);
    check('string_held', await page.evaluate(flag('string_held')));
    await talk(page, 'undertow_light', 21, 14, 'up');       // blue first: wrong, resets
    check('a wrong post resets string_step', (await page.evaluate(vr('string_step'))) === 0);
    for (const p of [[11, 14], [21, 14], [10, 18], [22, 18]]) await talk(page, 'undertow_light', p[0], p[1], 'up');
    check('string_done after Red, Blue, Amber, Green', await page.evaluate(flag('string_done')));

    // the bottom hatch leads to the memory
    await talk(page, 'undertow_light', 16, 26, 'down');
    await until(page, "window.__game.mapInfo().id === 'memory_rocks'", 'the hatch down to the Rocks');
    check('arrived on The Rocks, Last September', (await page.evaluate('window.__game.mapInfo().id')) === 'memory_rocks');
    await settle(page, 9000);

    // walk into the memory: ghost choice, the three words, the friends learn
    await tp(page, 'memory_rocks', 12, 13, 'up');
    await step(page, 'up', 2);
    await until(page, flag('truth_known'), 'the memory and the three Echoes', 60000);
    await until(page, flag('memory_rocks_done'), 'the friends learn, and nobody leaves', 30000);
    check('truth_known', await page.evaluate(flag('truth_known')));
    check('pim_knows', await page.evaluate(flag('pim_knows')));
    check('memory_rocks_done', await page.evaluate(flag('memory_rocks_done')));
    await until(page, vr('tide') + ' === 5', 'ce_tide_done moved the clock to tide 5', 40000);
    check('tide is 5', (await page.evaluate(vr('tide'))) === 5);

    // after truth_known the bottom hatch goes on to the Pearl Bed
    await page.evaluate(() => { const g = window.__game; g.addMember('odo'); g.addMember('lin'); g.addMember('pim'); });
    await talk(page, 'undertow_light', 16, 26, 'down');
    await until(page, "window.__game.mapInfo().id === 'pearl_bed'", 'the hatch on to the Pearl Bed');
    check('the hatch now leads to the Pearl Bed', (await page.evaluate('window.__game.mapInfo().id')) === 'pearl_bed');

    const errs = (await page.evaluate('window.__game.errors()')).filter((e) => !/Missing image|Missing audio/.test(e));
    check('no unexpected runtime errors', errs.length === 0, errs.join(' | '));
  } catch (e) {
    console.error(e);
    failures++;
  } finally {
    await browser.close();
  }
  if (failures) { console.log('LULL_2 PATH FAILED (' + failures + ')'); process.exit(1); }
  console.log('lull_2 path passed.');
})();
