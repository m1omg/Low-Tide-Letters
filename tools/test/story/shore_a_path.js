/*
 * shore_a_path.js - drives shore_a's critical path once, headlessly, so QA can re-run it.
 *
 *   node tools/test/story/shore_a_path.js
 *
 * What it walks (CONTENT_CONTRACT 3 and 5):
 *   ce_prologue_done -> wake in wren_house (20,8), the present-day opening plays
 *   the stairs (18,4) -> (12,5), the front door (6,16) -> harbour_row (8,10)
 *   sk1 Pop (Say)  -> sk1_said, true_words 1
 *   sk4 Lin (Keep) -> sk4_kept, seg2_kept 1
 *   ce_go_down     -> party gathered, tide_steps (12,2)
 *   ce_tide_done   -> tide 3, Wren alone, harbour_row (10,11)
 *   sk6 Mum (Say)  -> tams_postcard, true_words 2
 *   sk7 Lin (Say), sk8 Robin (Say) -> true_words 4
 *   ce_late_said_2 -> the Kept sk4 is said late: true_words 5, seg2_kept 0
 *
 * Maps owned by other writers are only touched where the contract says shore_a hands over
 * (tide_steps), so the run still passes while their files are being written.
 */
'use strict';

const path = require('path');
const H = require(path.join(__dirname, '..', 'lib', 'harness'));

/* Warnings that belong to art/music/maps that do not exist yet, not to shore_a's scripts. */
const EXPECTED = /Missing image|Missing (audio|sound)|not in the manifest|unknown map "shingle_beach"|shingle_beach/i;

let failures = 0;
function check(name, ok, extra) {
  if (ok) { console.log('  ok   ' + name); return true; }
  failures++;
  console.log('  FAIL ' + name + (extra === undefined ? '' : '  -> ' + JSON.stringify(extra)));
  return false;
}

const ev = (page, fn, arg) => page.evaluate(fn, arg === undefined ? null : arg);

const getVar = (page, k) => page.evaluate((k) => window.__game.G.State.getVar(k), k);
const getFlag = (page, k) => page.evaluate((k) => !!window.__game.G.State.getFlag(k), k);
const party = (page) => page.evaluate(() => window.__game.G.State.party.map((m) => m.id));
const where = (page) => page.evaluate(() => {
  const m = window.__game.G.State.map;
  return { id: m.id, x: m.x, y: m.y, dir: m.dir };
});
const hasItem = (page, id) => page.evaluate((id) => (window.__game.G.State.itemCount(id)) > 0, id);

async function run(page, commands) {
  await page.evaluate((c) => window.__game.run(c), commands);
  await H.advance(page, 240);
}

/** Stands on `tile` facing `dir` and presses confirm; `frames` covers the whole scene. */
async function talkFrom(page, map, x, y, dir, frames) {
  await page.evaluate((a) => window.__game.teleport(a.map, a.x, a.y, a.dir), { map, x, y, dir });
  await H.advance(page, 60);
  await H.waitIdle(page);                 // an arrival scene may still be running
  await H.press(page, 'confirm', 8);
  await H.advance(page, frames || 700);
}

(async function main() {
  const { browser, page } = await H.launchGame({});
  try {
    await page.evaluate(() => { window.__game.skipText = true; });

    /* ---------------------------------------------------------------- the prologue handoff */
    await page.evaluate(() => window.__game.newGame({
      party: ['wren'],
      map: { id: 'harbour_row', x: 20, y: 14, dir: 'down' },
      vars: { tide: 0 },
      flags: {},
      items: {},
      money: 15,
    }));
    await H.advance(page, 60);
    check('a new game starts with tide 0', (await getVar(page, 'tide')) === 0);

    await run(page, [['call', 'ce_prologue_done']]);
    await H.advance(page, 600);          // the opening in wren_house plays out
    let w = await where(page);
    check('ce_prologue_done wakes Wren on the wake-up tile',
      w.id === 'wren_house' && w.x === 20 && w.y === 8, w);
    check('ce_prologue_done sets tide 1', (await getVar(page, 'tide')) === 1);
    check('ce_prologue_done sets prologue_done', await getFlag(page, 'prologue_done'));
    check('the present-day opening has played', await getFlag(page, 'wren_house_opened'));

    /* ---------------------------------------------------------------- stairs and front door */
    await page.evaluate(() => window.__game.teleport('wren_house', 18, 5, 'up'));
    await H.advance(page, 30);
    await H.press(page, 'up', 20);
    await H.advance(page, 120);
    w = await where(page);
    check('the stairs come down into the kitchen', w.id === 'wren_house' && w.x === 12 && w.y === 5, w);

    await page.evaluate(() => window.__game.teleport('wren_house', 6, 15, 'down'));
    await H.advance(page, 30);
    await H.press(page, 'down', 20);
    await H.advance(page, 120);
    w = await where(page);
    check('the front door lands on Harbour Row at (8,10)',
      w.id === 'harbour_row' && w.x === 8 && w.y === 10, w);

    /* ---------------------------------------------------------------- sk1: Pop, said */
    await page.evaluate(() => { window.__game.autoChoice = 0; });
    await talkFrom(page, 'harbour_row', 13, 14, 'down');
    check('sk1 said', await getFlag(page, 'sk1_said'));
    check('true_words is 1 after sk1', (await getVar(page, 'true_words')) === 1,
      await getVar(page, 'true_words'));

    /* ---------------------------------------------------------------- sk4: Lin, kept */
    await page.evaluate(() => { window.__game.G.State.setVar('tide', 2); window.__game.autoChoice = 1; });
    await talkFrom(page, 'harbour_row', 17, 12, 'up');
    check('sk4 kept', await getFlag(page, 'sk4_kept'));
    check('seg2_kept is 1 after keeping sk4', (await getVar(page, 'seg2_kept')) === 1,
      await getVar(page, 'seg2_kept'));
    check('true_words is still 1', (await getVar(page, 'true_words')) === 1);

    /* ---------------------------------------------------------------- down, and back up */
    await run(page, [['call', 'ce_go_down']]);
    await H.advance(page, 300);
    w = await where(page);
    check('ce_go_down arrives at tide_steps (12,2)', w.id === 'tide_steps' && w.x === 12 && w.y === 2, w);
    let p = await party(page);
    check('ce_go_down gathers Odo and Lin', p.indexOf('odo') >= 0 && p.indexOf('lin') >= 0, p);
    check('ce_go_down recounted seg2_kept', (await getVar(page, 'seg2_kept')) === 1);

    await run(page, [['call', 'ce_tide_done']]);
    await H.advance(page, 400);
    w = await where(page);
    check('ce_tide_done returns to the segment start (10,11)',
      w.id === 'harbour_row' && w.x === 10 && w.y === 11, w);
    check('ce_tide_done advances the clock to tide 3', (await getVar(page, 'tide')) === 3);
    p = await party(page);
    check('ce_tide_done leaves Wren alone on the Shore', p.length === 1 && p[0] === 'wren', p);

    /* ---------------------------------------------------------------- sk6: Mum, said */
    await page.evaluate(() => { window.__game.autoChoice = 0; });
    await talkFrom(page, 'wren_house', 5, 7, 'up');
    check('sk6 said', await getFlag(page, 'sk6_said'));
    check("Tam's postcard was given", await hasItem(page, 'tams_postcard'));
    check('true_words is 2 after sk6', (await getVar(page, 'true_words')) === 2,
      await getVar(page, 'true_words'));

    /* ---------------------------------------------------------------- sk7 and sk8, said */
    await page.evaluate(() => { window.__game.G.State.setVar('tide', 4); });
    await talkFrom(page, 'harbour_row', 17, 12, 'up');
    check('sk7 said', await getFlag(page, 'sk7_said'));
    await talkFrom(page, 'harbour_row', 16, 14, 'up');
    check('sk8 said', await getFlag(page, 'sk8_said'));
    check('true_words is 4 after sk7 and sk8', (await getVar(page, 'true_words')) === 4,
      await getVar(page, 'true_words'));

    /* ---------------------------------------------------------------- late still counts */
    await run(page, [['call', 'ce_late_said_2']]);
    await H.advance(page, 300);
    check('ce_late_said_2 finally says the kept sk4', await getFlag(page, 'sk4_said'));
    check('ce_late_said_2 adds the kept word to true_words', (await getVar(page, 'true_words')) === 5,
      await getVar(page, 'true_words'));
    check('ce_late_said_2 clears seg2_kept', (await getVar(page, 'seg2_kept')) === 0);

    /* ---------------------------------------------------------------- no runtime errors */
    const errs = (await H.getErrors(page)).filter((e) => !EXPECTED.test(e));
    check('no unexpected runtime errors', errs.length === 0, errs);

    await H.shot(page, 'shore_a_path_end');
  } finally {
    await browser.close();
  }

  if (failures) { console.log('\nSHORE_A PATH FAILED (' + failures + ')'); process.exit(1); }
  console.log('\nshore_a path: all checks passed.');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
