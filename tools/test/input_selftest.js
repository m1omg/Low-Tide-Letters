#!/usr/bin/env node
/*
 * input_selftest.js - the mouse and the key bindings, with real browser mouse / keyboard events:
 *   title menu: hover moves the cursor, a click picks the row under the mouse (not the highlighted one),
 *   a click outside every row does nothing; ChoiceBox: a click resolves with the clicked option;
 *   Options -> Controls: click a slot, press a key, the key is bound (and swaps with its old owner),
 *   the new key drives the action, Esc stays Back, bindings survive a reload, "put every key back".
 *
 *   node tools/test/input_selftest.js            (add --no-build to skip "node tools/build.js")
 *
 * The window is 1024x768, so the canvas is scaled and the logical -> page mapping is exercised too.
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

/** Page position of a logical canvas point. */
async function toPage(page, x, y) {
  return page.evaluate(function (lx, ly) {
    const r = document.getElementById('game').getBoundingClientRect();
    return { x: r.left + lx * r.width / G.CONFIG.W, y: r.top + ly * r.height / G.CONFIG.H };
  }, x, y);
}

async function click(page, x, y) {
  const p = await toPage(page, x, y);
  await page.mouse.click(p.x, p.y);
  await H.sleep(160);                       // real frames: render (regions) + the confirm pulse
}

async function hover(page, x, y) {
  const p = await toPage(page, x, y);
  await page.mouse.move(p.x, p.y, { steps: 3 });
  await H.sleep(120);
}

async function waitFor(page, expr, ms, label) {
  const end = Date.now() + (ms || 3000);
  while (Date.now() < end) {
    if (await page.evaluate(expr)) return true;
    await H.sleep(40);
  }
  return check('wait for ' + (label || expr), false, 'timed out');
}

function top(page, expr) {
  return page.evaluate('(function (s) { return ' + expr + '; })(G.Scenes.top())');
}

async function main() {
  if (!process.argv.includes('--no-build')) {
    require('child_process').execSync('node ' + require('path').join(H.ROOT, 'tools', 'build.js'), { stdio: 'inherit' });
  }
  const { browser, page } = await H.launchGame({ width: 1024, height: 768 });
  try {
    await page.evaluate('localStorage.removeItem("fable51.keys"); G.Input.loadBindings()');
    await waitFor(page, 'G.Scenes.top().phase === "press"', 3000, 'title press phase');
    await H.sleep(200);
    await click(page, 384, 300);                            // "press any key" also takes a click
    await waitFor(page, 'G.Scenes.top().phase === "menu"', 2000, 'title menu');
    await H.sleep(200);

    /* ---------------------------------------------------------------- title: hover / click */
    // tags: x 528..724, y 226 + i*70 .. +50
    const tag = function (i) { return { x: 620, y: 226 + i * 70 + 25 }; };
    await hover(page, tag(2).x, tag(2).y);
    check('hover moves the title cursor to Options', (await top(page, 's.index')) === 2, 'index ' + (await top(page, 's.index')));
    await hover(page, tag(0).x, tag(0).y);
    check('hover moves it back to New Game', (await top(page, 's.index')) === 0);
    await page.keyboard.press('ArrowDown');
    await H.sleep(80);
    check('keyboard still moves the cursor after hovering', (await top(page, 's.index')) === 1);
    await click(page, 60, 520);                              // empty space on the left
    check('a click on empty space picks nothing', (await top(page, 's.phase')) === 'menu' && (await page.evaluate('G.Scenes.names().join()')) === 'title');
    await click(page, tag(3).x, tag(3).y);                   // highlighted: Continue (1); clicked: About (3)
    check('a click picks the clicked row, not the highlighted one', (await top(page, 's.phase')) === 'about',
      'phase ' + (await top(page, 's.phase')) + ', index ' + (await top(page, 's.index')));
    await H.sleep(200);
    await click(page, 384, 300);                             // no rows in the note: a click closes it
    await waitFor(page, 'G.Scenes.top().phase === "menu"', 2000, 'the note closes on a click');

    /* ---------------------------------------------------------------- ChoiceBox */
    await page.evaluate('window.__pick = null; G.UI.ChoiceBox.show(["One", "Two", "Three"], { cancelIndex: 2 }).then(function (i) { window.__pick = i; }); 0');
    await H.sleep(250);
    const box = await page.evaluate('({ x: G.UI.ChoiceBox.active.x, y: G.UI.ChoiceBox.active.y, w: G.UI.ChoiceBox.active.w, rowH: G.UI.ChoiceBox.active.rowH })');
    await click(page, box.x + box.w / 2, box.y + 13 + 1 * box.rowH + box.rowH / 2);
    await waitFor(page, 'window.__pick !== null', 2000, 'choice resolves');
    check('ChoiceBox: clicking "Two" (cursor on "One") returns 1', (await page.evaluate('window.__pick')) === 1,
      'got ' + (await page.evaluate('window.__pick')));
    check('the title under the box did not react', (await top(page, 's.phase')) === 'menu' && (await page.evaluate('G.Scenes.names().join()')) === 'title');

    /* ---------------------------------------------------------------- Options -> Controls */
    await click(page, tag(2).x, tag(2).y);
    await waitFor(page, 'G.Scenes.names().join() === "title,menu"', 2000, 'Options opens');
    await H.sleep(150);
    // options pane: rows at PANE.y + 56 + 14 + i*42 (rows start 6px above), Controls is row 5
    const rowY = function (i) { return 54 + 56 + 14 + i * 42 + 12; };
    await click(page, 330, rowY(5));
    await waitFor(page, 'G.Scenes.names().join() === "title,menu,controls"', 2000, 'Controls opens from its row');
    await H.sleep(150);

    // slots: x 236 + c*150 (w 138), rows y 94 + r*43 (h 34); confirm is row 4, confide row 7
    const slot = function (r, c) { return { x: 236 + c * 150 + 69, y: 94 + r * 43 + 17 }; };
    await click(page, slot(4, 0).x, slot(4, 0).y);
    check('clicking a slot listens for a key', await page.evaluate('G.Input.capturing()'));
    check('...on the slot that was clicked', (await top(page, 's.row + ":" + s.col')) === '4:0');
    await page.keyboard.press('KeyK');
    await H.sleep(100);
    check('K is bound to Confirm', await page.evaluate('G.Input.bindings().confirm[0] === "KeyK"'));
    check('Z is no longer Confirm', await page.evaluate('!G.Input.KEYMAP.KeyZ'));

    // swap: give Confide the X key; Back / Menu must get Confide's old C
    await click(page, slot(7, 0).x, slot(7, 0).y);
    await page.keyboard.press('KeyX');
    await H.sleep(100);
    const b = await page.evaluate('G.Input.bindings()');
    check('X moved to Confide', b.confide[0] === 'KeyX');
    check('Back / Menu got C in exchange', b.cancel[0] === 'KeyC', JSON.stringify(b.cancel));
    check('the change was saved', await page.evaluate('JSON.parse(localStorage.getItem("fable51.keys")).confide[0] === "KeyX"'));

    // Esc while listening leaves the slot alone
    await click(page, slot(0, 2).x, slot(0, 2).y);
    await page.keyboard.press('Escape');
    await H.sleep(100);
    check('Esc while listening changes nothing', await page.evaluate('!G.Input.capturing() && G.Input.bindings().up[2] === null'));
    check('...and does not close the screen', (await page.evaluate('G.Scenes.top() && G.Scenes.names().join()')) === 'title,menu,controls');

    // the new keys drive the game: K moves nothing but confirms; Esc (fixed) backs out
    await page.keyboard.press('ArrowDown');
    await H.sleep(80);
    const before = await top(page, 's.row');
    await page.keyboard.press('Escape');
    await H.sleep(150);
    check('Esc still backs out of Controls', (await page.evaluate('G.Scenes.names().join()')) === 'title,menu', 'row was ' + before);
    await page.keyboard.press('KeyC');                          // C is Back / Menu now
    await H.sleep(150);
    check('C (the new Back key) closes Options', (await page.evaluate('G.Scenes.names().join()')) === 'title');
    await page.keyboard.press('ArrowDown');
    await H.sleep(60);
    const idx = await top(page, 's.index');
    await page.keyboard.press('KeyK');                          // K is Confirm now
    await H.sleep(200);
    check('K (the new Confirm key) picks on the title', (await page.evaluate('G.Scenes.names().join()')) !== 'title' || (await top(page, 's.phase')) !== 'menu',
      'index ' + idx);
    // back to a known place
    await page.keyboard.press('Escape');
    await H.sleep(200);
    await page.evaluate('while (G.Scenes.depth() > 1) G.Scenes.pop(); G.Scenes.top().phase = "menu"');

    /* ---------------------------------------------------------------- battle */
    await page.evaluate('window.__game.startBattle("troop_card_crab"); 0');
    await waitFor(page, 'G.Scenes.topName() === "battle" && G.Scenes.top().phase === "input" && G.Scenes.top().mode === "command" && !!G.Scenes.top().cmdTags', 15000, 'battle command input');
    await H.sleep(150);
    await page.evaluate('(function (s) { window.__cmd = null; const f = s.chooseCommand; s.chooseCommand = function (id) { window.__cmd = id; return f.apply(this, arguments); }; })(G.Scenes.top()); 0');
    const cmds = await page.evaluate('G.Scenes.top().commands.map(function (c) { return { id: c.id, enabled: c.enabled !== false }; })');
    const tags = await page.evaluate('G.Scenes.top().cmdTags');
    const want = cmds.findIndex(function (c, i) { return i > 0 && c.enabled; });
    await hover(page, tags[want].x, tags[want].y - 4);
    check('battle: hover moves the command cursor', (await top(page, 's.cmdIndex')) === want, 'cmdIndex ' + (await top(page, 's.cmdIndex')));
    await page.evaluate('G.Scenes.top().cmdIndex = 0');
    await click(page, tags[want].x, tags[want].y - 4);
    check('battle: a click chooses the clicked command (' + cmds[want].id + ')', (await page.evaluate('window.__cmd')) === cmds[want].id,
      'chose ' + (await page.evaluate('window.__cmd')));
    await H.shot(page, 'input_02_battle_after_click');
    await page.evaluate('G.Scenes.clearTo("title", {}); 0');
    await H.sleep(300);

    /* ---------------------------------------------------------------- persistence + reset */
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction('window.__game && window.__game.ready === true', { timeout: 60000 });
    check('bindings survive a reload', await page.evaluate('G.Input.bindings().confirm[0] === "KeyK" && G.Input.KEYMAP.KeyK.indexOf("confirm") >= 0'));
    check('the tutorial hint names the new Confide key', await page.evaluate('G.Input.fillKeys("{key:confide} is the Can Line") === "X is the Can Line"'));
    await page.evaluate('G.Input.resetBindings()');
    check('put every key back', await page.evaluate('G.Input.KEYMAP.KeyZ[0] === "confirm" && G.Input.KEYMAP.KeyC[0] === "confide" && G.Input.KEYMAP.KeyX.join() === "cancel,menu"'));
    check('the last key of an action cannot be emptied', await page.evaluate('!G.Input.unbind("confide", 0).ok'));

    /* ---------------------------------------------------------------- right-click walks Wren, middle = X */
    await page.evaluate(() => window.__game.newGame({ party: ['wren'], map: { id: 'test_map', x: 15, y: 12, dir: 'up' } }));
    await H.advance(page, 60);
    for (let i = 0; i < 8 && await page.evaluate('G.UI.isModal()'); i++) await H.press(page, 'confirm', 30);   // the map's one-line intro
    await H.waitIdle(page);
    await H.sleep(200);                                      // a rendered frame: the old menu rows must be gone
    const tileScreen = (tx, ty) => page.evaluate(([x, y]) => {
      const s = G.Scenes.top(), T = G.CONFIG.TILE;
      return { x: (x + 0.5) * T - s.cam.x, y: (y + 0.5) * T - s.cam.y };
    }, [tx, ty]);
    let pt = await tileScreen(18, 14);
    check('a right-click on the map is taken by the scene', await page.evaluate(([x, y]) => G.Pointer.clickAt(x, y, 'right'), [pt.x, pt.y]));
    check('...and marks the goal', await page.evaluate('!!G.Scenes.top().walkGoal'));
    await H.advance(page, 100);
    let pos = await page.evaluate('({x: G.Scenes.top().player.x, y: G.Scenes.top().player.y})');
    check('Wren walked to the tile', pos.x === 18 && pos.y === 14, pos);
    check('the goal marker is gone on arrival', await page.evaluate('!G.Scenes.top().walkGoal'));
    check('the menu did not open', await page.evaluate('G.Scenes.names().join()') === 'map');

    pt = await tileScreen(12, 8);                            // Pip, who cannot be stood on
    await page.evaluate(([x, y]) => G.Pointer.clickAt(x, y, 'right'), [pt.x, pt.y]);
    check('a right-click on an NPC plans a walk-and-talk', await page.evaluate('!!(G.Scenes.top().walkGoal && G.Scenes.top().walkGoal.act)'));
    await H.advance(page, 200);
    pos = await page.evaluate('({x: G.Scenes.top().player.x, y: G.Scenes.top().player.y})');
    check('Wren stopped next to Pip', Math.abs(pos.x - 12) + Math.abs(pos.y - 8) === 1, pos);
    check('...and started talking to him', await page.evaluate('G.UI.isModal() || G.Interpreter.isBusy()'));
    await page.evaluate(() => { window.__game.autoChoice = 0; });
    for (let i = 0; i < 16 && await page.evaluate('G.UI.isModal() || G.Interpreter.isBusy()'); i++) await H.press(page, 'confirm', 30);
    await H.waitIdle(page);

    await page.evaluate(() => window.__game.teleport('test_map', 15, 12, 'up'));
    await H.advance(page, 20);
    await H.sleep(200);
    await page.evaluate(() => G.Pointer.clickAt(300, 300, 'middle'));
    await H.advance(page, 5);
    check('a middle-click on the map opens the pause menu', await page.evaluate('G.Scenes.names().join()') === 'map,menu');
    await H.sleep(200);                                      // the menu's rows are registered on render
    check('in a menu a right-click is still Cancel', await page.evaluate('G.Pointer.clickAt(300, 300, "right") === false'));
    await H.sleep(120);
    await H.advance(page, 10);
    check('...which closed it', await page.evaluate('G.Scenes.names().join()') === 'map');

    await H.shot(page, 'input_01_after');
    const errs = await H.getErrors(page);
    check('no runtime errors', errs.length === 0, errs.join(' | '));
  } finally {
    await page.evaluate('localStorage.removeItem("fable51.keys")').catch(function () {});
    await browser.close();
  }
  if (failures.length) {
    console.log('\ninput_selftest: ' + failures.length + ' check(s) FAILED');
    process.exit(1);
  }
  console.log('\ninput_selftest: all checks passed.');
}

main().catch(function (e) { console.error(e); process.exit(1); });
