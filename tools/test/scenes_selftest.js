#!/usr/bin/env node
/*
 * scenes_selftest.js - drives the title / menu / save / shop / ending scenes and the custom event UIs
 * in headless Chrome:
 *   title "press any key" -> title menu -> New Game -> pause menu (every tab, panes entered) ->
 *   the custom commands (ghost_choice, keep_or_say, letter_compose, rock_pool) through __game.run ->
 *   the save scene -> back to the title -> Continue (load) -> shop (buy something) ->
 *   the ending scene with its credits roll and the credits skip.
 *
 *   node tools/test/scenes_selftest.js            (add --no-build to skip "node tools/build.js")
 *
 * Screenshots land in tools/test/shots/scenes_*.png. Exit code 1 on any failed check or any entry in
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

function scene(page) { return page.evaluate('window.__game.scene()'); }

async function waitScene(page, name, maxFrames) {
  let left = maxFrames || 400;
  while (left > 0) {
    if ((await scene(page)) === name) return true;
    await H.advance(page, 5);
    left -= 5;
  }
  check('wait for scene "' + name + '"', false, 'still ' + (await scene(page)));
  return false;
}

async function waitFor(page, expr, maxFrames, label) {
  let left = maxFrames || 400;
  while (left > 0) {
    if (await page.evaluate(expr)) return true;
    await H.advance(page, 5);
    left -= 5;
  }
  check('wait for ' + (label || expr), false, 'timed out');
  return false;
}

function setAuto(page, v) {
  return page.evaluate(function (x) { window.__game.autoChoice = x; }, v);
}

async function main() {
  if (!process.argv.includes('--no-build')) {
    require('child_process').execSync('node ' + require('path').join(H.ROOT, 'tools', 'build.js'), { stdio: 'inherit' });
  }
  const { browser, page } = await H.launchGame({});
  try {
    /* ---------------------------------------------------------------- title */
    check('boots into the title scene', (await scene(page)) === 'title');
    await H.advance(page, 20);
    check('press-any-key phase first', await page.evaluate('G.Scenes.top().phase === "press"'));

    await H.press(page, 'confirm', 24);
    check('a key press opens the title menu', await page.evaluate('G.Scenes.top().phase === "menu"'));
    check('Continue is greyed out without saves',
      await page.evaluate('G.Scenes.top().items[1].enabled === false'));
    await H.shot(page, 'scenes_02_title_menu');

    /* about this game (the content note) */
    await H.press(page, 'down', 3);
    await H.press(page, 'down', 3);
    await H.press(page, 'down', 3);
    check('cursor reaches "About this game"', await page.evaluate('G.Scenes.top().index === 3'));
    await H.press(page, 'confirm', 10);
    check('the content note opens', await page.evaluate('G.Scenes.top().phase === "about"'));
    await H.press(page, 'cancel', 8);

    /* ---------------------------------------------------------------- new game */
    await page.evaluate(function () { window.__game.skipText = true; });
    await page.evaluate('G.Scenes.top().index = 0');
    await H.press(page, 'confirm', 10);
    await waitScene(page, 'map', 400);
    check('New Game starts the map', (await scene(page)) === 'map');
    // the real opening (prologue on the beach) is a long scripted scene: the UI checks use the engine test page
    await page.evaluate(function () { window.__game.skipText = true; window.__game.teleport('test_map', 15, 12, 'up'); });
    await H.advance(page, 120);
    await H.waitIdle(page, 900);            // the test page's arrival note plays out by itself
    await page.evaluate(function () { window.__game.skipText = false; });

    /* a few things to look at in the menu */
    await page.evaluate(function () {
      const ids = Object.keys(window.G.DATA.items || {});
      const first = ids.filter(function (i) { return G.DATA.items[i].kind === 'consumable'; }).slice(0, 3);
      for (const id of first) window.__game.give(id, 2);
      const keep = ids.filter(function (i) { return G.DATA.items[i].kind === 'keepsake'; }).slice(0, 2);
      for (const id of keep) window.__game.give(id, 1);
      window.G.State.addMoney(240);
      window.__game.setVar('tide', 2);
      // one album entry so the Delivered Mail page has something to show
      const en = Object.keys(window.G.DATA.enemies || {})[0];
      if (en) {
        window.G.State.album = window.G.State.album || {};
        window.G.State.album[en] = { linesKnown: [true, false], delivered: 1, hushed: 0, letter: true };
      }
    });

    /* ---------------------------------------------------------------- dialogue looks (ui.js) */
    await page.evaluate(function () { window.__game.skipText = false; });
    await page.evaluate(function () {
      window.__game.run([['say', 'wren', 'neutral', 'The name tag is a luggage tag on a bit of string.']]);
    });
    await H.advance(page, 60);
    check('a message box is open', await page.evaluate('G.UI.MessageBox.isBusy()'));
    await H.shot(page, 'scenes_01_dialogue_tag');
    await H.press(page, 'confirm', 8);
    await H.press(page, 'confirm', 8);
    await H.waitIdle(page, 600);            // one command list at a time, like real play
    await page.evaluate(function () {
      window.__game.setVar('tide', 2);
      window.__game.run([['say', 'nacre', null, 'Please do not trouble yourself.'], ['think', 'It is very polite.']]);
    });
    await H.advance(page, 60);
    check('Nacre speaks on a slip', await page.evaluate('G.UI.MessageBox.cur && G.UI.MessageBox.cur.style === "slip"'));
    await H.shot(page, 'scenes_05_slip_and_think');
    await H.press(page, 'confirm', 10);
    await H.advance(page, 40);
    await H.press(page, 'confirm', 10);
    await waitFor(page, '!G.UI.MessageBox.isBusy()', 300, 'dialogue finished');
    await page.evaluate(function () { window.__game.skipText = true; });

    /* ---------------------------------------------------------------- pause menu */
    for (let i = 0; i < 8; i++) {           // finish whatever dialogue is left, like a player tapping through
      if (!(await page.evaluate('G.Interpreter.isBusy()'))) break;
      await H.press(page, 'confirm', 10);
      await H.advance(page, 40);
    }
    await H.waitIdle(page, 600);
    await H.press(page, 'menu', 12);
    check('the map opens the pause menu', (await scene(page)) === 'menu', await page.evaluate('JSON.stringify({busy:G.Interpreter.isBusy(), modal:G.UI.isModal(), box:G.UI.MessageBox.isBusy(), top:__game.scene(), skip:__game.skipText})'));
    await H.advance(page, 10);
    await H.shot(page, 'scenes_03_menu_pockets');

    const tabs = await page.evaluate('G.Scenes.top().order.slice()');
    check('seven tags in the coat', tabs.length === 7, tabs.join(','));
    for (let i = 1; i < tabs.length; i++) {
      await H.press(page, 'down', 4);
      const cur = await page.evaluate('G.Scenes.top().order[G.Scenes.top().tab]');
      check('tab ' + tabs[i] + ' selected', cur === tabs[i], cur);
      const interactive = await page.evaluate('!!G.Scenes.top().order && (function(){var s=G.Scenes.top();return s.tab>=0;})()');
      void interactive;
      // step into the pane and back out again
      await H.press(page, 'confirm', 6);
      const focus = await page.evaluate('G.Scenes.top().focus');
      if (focus === 'pane') {
        await H.press(page, 'down', 4);
        await H.press(page, 'right', 4);
        if (tabs[i] === 'album') await H.shot(page, 'scenes_04_menu_album');
        await H.press(page, 'cancel', 6);
        check(tabs[i] + ': cancel returns to the tags', (await page.evaluate('G.Scenes.top().focus')) === 'tabs');
      }
    }
    await H.press(page, 'cancel', 10);
    await waitScene(page, 'map', 120);
    check('the menu closes back to the map', (await scene(page)) === 'map');

    /* ---------------------------------------------------------------- custom UIs */
    await setAuto(page, 1);
    await page.evaluate(function () {
      window.__game.run([['custom', 'ghost_choice', {
        options: [{ text: 'Say it.' }, { text: '(you could have said it)', ghost: true }, { text: 'Keep it.' }],
        varName: 'test_ghost',
      }]]);
    });
    await waitFor(page, '__game.scene() === "map" && G.State.getVar("test_ghost") !== 0', 300, 'ghost_choice finished');
    check('ghost_choice skips the ghost option', (await page.evaluate('G.State.getVar("test_ghost")')) === 2,
      String(await page.evaluate('G.State.getVar("test_ghost")')));
    await setAuto(page, null);

    // keep_or_say, driven by hand so the two tags and the falling pebble can be seen
    await page.evaluate(function () {
      window.__game.run([['custom', 'keep_or_say', {
        prompt: 'Say it or keep it?', varName: 'test_keep', flagKept: 'test_kept',
      }]]);
    });
    await H.advance(page, 14);
    check('keep_or_say pre-selects "Keep it"', (await page.evaluate('G.Scenes.top().index')) === 1);
    await H.shot(page, 'scenes_06_keep_or_say');
    await H.press(page, 'cancel', 20);
    await H.advance(page, 60);
    await waitScene(page, 'map', 200);
    check('a Keep is recorded', (await page.evaluate('G.State.getVar("test_keep")')) === 1 &&
      (await page.evaluate('G.State.getFlag("test_kept")')) === true);

    // letter_compose
    await page.evaluate(function () {
      ['sk1_said', 'sk2_said', 'sk4_said', 'sk9_said'].forEach(function (f) { window.__game.setFlag(f, true); });
      window.__game.run([['custom', 'letter_compose', {}]]);
    });
    await H.advance(page, 16);
    check('the letter opens with the earned True Words',
      (await page.evaluate('G.Scenes.top().words.length')) === 4);
    await H.press(page, 'confirm', 6);
    await H.press(page, 'confirm', 6);
    await H.shot(page, 'scenes_07_letter_compose');
    await H.press(page, 'confirm', 6);
    check('three words placed', (await page.evaluate('G.Scenes.top().placed.length')) === 3);
    await H.press(page, 'confirm', 30);            // seal it
    await H.press(page, 'confirm', 20);            // dismiss the finished letter
    if ((await scene(page)) !== 'map') await H.press(page, 'confirm', 20);
    await waitScene(page, 'map', 200);
    const letterVars = await page.evaluate('[G.State.getVar("letter_1"),G.State.getVar("letter_2"),G.State.getVar("letter_3")]');
    check('letter_1..3 hold the True Word numbers', letterVars.every(function (v) { return v >= 1 && v <= 9; }),
      JSON.stringify(letterVars));

    // rock_pool (Skim)
    await setAuto(page, 1);
    await page.evaluate(function () {
      window.G.State.party.forEach(function (a) { a.pebbles = 1; a.hp = 5; });
      window.__game.run([['custom', 'rock_pool', { joke: 'A limpet watches you save. It has seen things.' }]]);
    });
    await waitFor(page, '!G.Interpreter.isBusy()', 600, 'rock_pool finished');
    check('Skim empties the pockets',
      (await page.evaluate('G.State.party.every(function(a){return !a.pebbles;})')) === true);
    await setAuto(page, null);

    /* ---------------------------------------------------------------- save */
    await page.evaluate(function () { window.__game.run([['save']]); });
    await waitScene(page, 'save', 200);
    await H.advance(page, 12);
    await H.shot(page, 'scenes_08_save_cards');
    await H.press(page, 'confirm', 20);
    await waitFor(page, 'G.State.hasAnySave()', 300, 'the game is saved');
    check('a slot was written', (await page.evaluate('G.State.hasAnySave()')) === true);
    await waitScene(page, 'map', 200);

    /* ---------------------------------------------------------------- title -> continue */
    await page.evaluate(function () { window.G.Scenes.clearTo('title', {}); });
    await H.advance(page, 20);
    await H.press(page, 'confirm', 14);
    check('Continue is available now', await page.evaluate('G.Scenes.top().items[1].enabled === true'));
    await H.press(page, 'down', 4);
    await setAuto(page, 0);
    await H.press(page, 'confirm', 14);
    check('Continue opens the load list', (await scene(page)) === 'save');
    await H.press(page, 'confirm', 30);
    await waitScene(page, 'map', 400);
    check('loading a page returns to the map', (await scene(page)) === 'map');
    await setAuto(page, null);

    /* ---------------------------------------------------------------- shop */
    const shopItems = await page.evaluate(function () {
      return Object.keys(window.G.DATA.items || {})
        .filter(function (i) { return G.DATA.items[i].price > 0; }).slice(0, 6);
    });
    check('there are items to sell', shopItems.length > 0, String(shopItems.length));
    await page.evaluate(function (items) {
      window.G.State.addMoney(300);
      window.__game.run([['shop', items]]);
    }, shopItems);
    await waitScene(page, 'shop', 200);
    await H.advance(page, 12);
    await H.shot(page, 'scenes_09_shop');
    const before = await page.evaluate(function (id) { return [G.State.itemCount(id), G.State.money]; }, shopItems[0]);
    await H.press(page, 'confirm', 8);              // quantity
    await H.press(page, 'confirm', 12);             // buy one
    const after = await page.evaluate(function (id) { return [G.State.itemCount(id), G.State.money]; }, shopItems[0]);
    check('buying adds the item and spends Stamps', after[0] === before[0] + 1 && after[1] < before[1],
      JSON.stringify(before) + ' -> ' + JSON.stringify(after));
    await H.press(page, 'cancel', 12);
    await waitScene(page, 'map', 200);

    /* ---------------------------------------------------------------- gameover */
    await page.evaluate(function () { window.__game.run([['gameover']]); });
    await waitScene(page, 'gameover', 200);
    await H.advance(page, 70);
    await H.shot(page, 'scenes_11_gameover');
    check('gameover offers the last save', await page.evaluate('G.Scenes.top().items[0].enabled === true'));
    await H.press(page, 'confirm', 20);
    await waitScene(page, 'map', 400);
    check('"carry on" loads the last save', (await scene(page)) === 'map');

    /* ---------------------------------------------------------------- ending + credits */
    await page.evaluate(function () { window.G.Scenes.clearTo('ending', { id: 'ending_not_yet' }); });
    await H.advance(page, 60);
    check('the ending scene plays', (await scene(page)) === 'ending');
    for (let i = 0; i < 40; i++) {                   // finish typing / turn every page until the credits roll
      if (await page.evaluate('G.Scenes.top().phase === "credits"')) break;
      await H.press(page, 'confirm', 20);
      await H.advance(page, 20);
    }
    await waitFor(page, 'G.Scenes.top().phase === "credits"', 400, 'credits roll');
    await H.advance(page, 90);
    await H.shot(page, 'scenes_10_credits');
    await H.press(page, 'cancel', 30);              // skip
    await waitScene(page, 'title', 600);
    check('the credits end at the title', (await scene(page)) === 'title');

    /* ---------------------------------------------------------------- errors */
    const errors = await H.getErrors(page);
    check('no game or page errors', errors.length === 0, errors.join(' || '));
  } finally {
    await browser.close();
  }

  console.log('');
  if (failures.length) {
    console.log('FAILED (' + failures.length + '):');
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
  console.log('scenes self-test passed. Screenshots: ' + H.SHOTS);
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
