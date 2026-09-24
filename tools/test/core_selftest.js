#!/usr/bin/env node
/*
 * core_selftest.js - boots index.html?selftest=1 in headless Chrome, drives the built-in engine self-test
 * with simulated input, takes screenshots into tools/test/shots/ and checks the core API contract.
 *
 *   node tools/test/core_selftest.js            http run + file:// run
 *   node tools/test/core_selftest.js --http     only over http://localhost
 *   node tools/test/core_selftest.js --file     only from file://
 *   (add --no-build to skip the automatic "node tools/build.js" run)
 *
 * Exit code 1 when __game.errors() is non-empty, a page error occurred or a check failed.
 */
'use strict';

const H = require('./lib/harness');

const failures = [];
function check(name, ok, detail) {
  if (ok) { console.log('  ok   ' + name); return; }
  failures.push(name + (detail ? ' -> ' + detail : ''));
  console.log('  FAIL ' + name + (detail ? ' -> ' + detail : ''));
}

const REQUIRED_API = {
  'G': ['CONFIG', 'DATA', 'registerMap', 'errors', 'warn', 'error'],
  'G.Util': ['clamp', 'lerp', 'randInt', 'choice', 'shuffle', 'deepClone', 'ease', 'makeRng', 'rng'],
  'G.Util.ease': ['inOut', 'out'],
  'G.Input': ['update', 'isDown', 'pressed', 'repeated', 'simulate', 'anyPressed'],
  'G.Assets': ['init', 'img', 'has', 'size', 'meta', 'preload', 'preloadAll'],
  'G.Audio': ['init', 'unlock', 'playBgm', 'stopBgm', 'fadeBgm', 'saveBgm', 'restoreBgm', 'playSfx', 'playAmbience', 'stopAmbience', 'setVolume'],
  'G.Gfx': ['canvas', 'ctx', 'begin', 'end', 'drawImg', 'panel', 'text', 'measure', 'boil', 'fadeOut', 'fadeIn', 'flash', 'shake', 'setTint', 'updateEffects', 'drawEffects'],
  'G.Text': ['parse', 'layout'],
  'G.UI': ['MessageBox', 'ChoiceBox', 'ListMenu', 'Gauge', 'Toast'],
  'G.State': ['newGame', 'party', 'reserve', 'inventory', 'money', 'flags', 'vars', 'map', 'playtimeFrames', 'options', 'getFlag', 'setFlag', 'getVar', 'setVar', 'addItem', 'removeItem', 'itemCount', 'addMember', 'removeMember', 'actor', 'save', 'load', 'slotInfo', 'hasAnySave', 'SAVE_VERSION'],
  'G.Scenes': ['push', 'pop', 'replace', 'clearTo', 'top', 'register'],
  'G.Cond': ['evaluate'],
  'window.__game': ['G', 'ready', 'scene', 'newGame', 'teleport', 'setFlag', 'setVar', 'give', 'addMember', 'setLevel', 'startBattle', 'battleAuto', 'press', 'run', 'advance', 'skipText', 'mapInfo', 'errors'],
};

async function tap(page, action, after) {
  await page.evaluate(function (a) { window.G.Input.simulate(a, true); }, action);
  await H.advance(page, 2);
  await page.evaluate(function (a) { window.G.Input.simulate(a, false); }, action);
  await H.advance(page, after == null ? 3 : after);
}

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

async function menuGoto(page, index) {
  for (let guard = 0; guard < 40; guard++) {
    const cur = await page.evaluate('G.Scenes.top().menu.index');
    if (cur === index) return;
    await tap(page, cur < index ? 'down' : 'up', 2);
  }
  check('menu cursor reaches ' + index, false);
}

async function pick(page, index) {
  await waitFor(page, '!G.Scenes.top().busy && !G.UI.isModal()', 900, 'self-test idle');
  await menuGoto(page, index);
  await tap(page, 'confirm', 2);
}

/** Confirms message pages until no modal box is left. */
async function finishDialogue(page, maxTaps) {
  for (let i = 0; i < (maxTaps || 30); i++) {
    if (!(await page.evaluate('G.UI.isModal()'))) return i;
    await tap(page, 'confirm', 6);
  }
  check('dialogue finishes', false, 'still modal');
  return -1;
}

async function assertClean(page, label) {
  const errors = await H.getErrors(page);
  check(label + ': no game/page errors', errors.length === 0, errors.join(' || '));
}

async function runHttp(prefix, launchOpts) {
  console.log('\n== ' + prefix + ' ==');
  const { browser, page } = await H.launchGame(launchOpts);
  try {
    check('boots into the self-test scene', (await page.evaluate('window.__game.scene()')) === 'selftest');
    await H.advance(page, 20);
    await H.shot(page, prefix + '_01_boot');

    // --- API contract
    const missing = await page.evaluate(function (spec) {
      const out = [];
      for (const ns of Object.keys(spec)) {
        let obj;
        try { obj = ns.split('.').reduce(function (o, k) { return k === 'window' ? window : o[k]; }, window); } catch (e) { obj = null; }
        if (!obj) { out.push(ns); continue; }
        for (const k of spec[ns]) if (obj[k] === undefined) out.push(ns + '.' + k);
      }
      return out;
    }, REQUIRED_API);
    check('every API of TECH_SPEC section 3 exists', missing.length === 0, missing.join(', '));
    const fonts = await page.evaluate(function () { return [document.fonts.check('24px "PatrickHand"'), document.fonts.check('24px "GochiHand"')]; });
    check('both fonts loaded', fonts[0] && fonts[1], JSON.stringify(fonts));
    check('canvas backing store is 1536x1152', await page.evaluate('G.Gfx.canvas.width === 1536 && G.Gfx.canvas.height === 1152'));

    // --- conversation: typewriter, complete, advance, paging
    await pick(page, 0);
    await H.advance(page, 30);
    const typing = await page.evaluate(function () { const c = window.G.UI.MessageBox.cur; return c ? { pos: c.typer.upTo, end: c.typer.end, face: c.face } : null; });
    check('message box is typing (partial text)', !!typing && typing.pos > 0 && typing.pos < typing.end, JSON.stringify(typing));
    check('portrait resolved for the fake speaker', !!typing && typing.face === 'face_selftest_neutral', JSON.stringify(typing));
    await H.shot(page, prefix + '_02_message_typing');
    await tap(page, 'confirm', 2);
    check('confirm completes the page', await page.evaluate('G.UI.MessageBox.cur && G.UI.MessageBox.cur.typer.done'));
    await H.advance(page, 20);
    await H.shot(page, prefix + '_03_message_complete');
    await tap(page, 'confirm', 4);                       // -> talk2 (speed changes, big text)
    await waitFor(page, 'G.UI.MessageBox.cur && G.UI.MessageBox.cur.typer.done', 900, 'talk2 typed out');
    check('expression face used', (await page.evaluate('G.UI.MessageBox.cur.face')) === 'face_selftest_happy');
    await H.shot(page, prefix + '_04_message_markup');
    await tap(page, 'confirm', 4);                       // -> talk3 (long, two pages)
    const pages = await page.evaluate('G.UI.MessageBox.cur ? G.UI.MessageBox.cur.pages.length : 0');
    check('long message is split into pages automatically', pages >= 2, 'pages=' + pages);
    check('missing expression falls back to neutral', (await page.evaluate('G.UI.MessageBox.cur.face')) === 'face_selftest_neutral');
    // hold cancel = fast-forward through everything
    await page.evaluate(function () { window.G.Input.simulate('cancel', true); });
    await H.advance(page, 90);
    await page.evaluate(function () { window.G.Input.simulate('cancel', false); });
    await H.advance(page, 4);
    check('holding cancel fast-forwards the conversation', !(await page.evaluate('G.UI.isModal()')));

    // --- choice box
    await pick(page, 1);
    await waitFor(page, 'G.UI.MessageBox.cur && G.UI.MessageBox.cur.typer.done', 600, 'question typed');
    await tap(page, 'confirm', 8);
    check('choice box opened', await page.evaluate('!!G.UI.ChoiceBox.active'));
    await tap(page, 'down', 6);
    await H.shot(page, prefix + '_05_choice');
    await tap(page, 'confirm', 6);
    check('choice resolved with index 1', (await page.evaluate('G.Scenes.top().log.slice(-1)[0]')) === 'choice:1');
    await finishDialogue(page);

    // --- toast + gauges
    await pick(page, 2);
    await H.advance(page, 24);
    check('toasts are queued', (await page.evaluate('G.UI.Toast.list.length')) === 2);
    await pick(page, 3);
    await H.advance(page, 10);
    await H.shot(page, prefix + '_06_toast_gauge');
    await H.advance(page, 200);

    // --- screen effects
    await pick(page, 4);
    await H.advance(page, 6);
    check('shake offsets the screen', await page.evaluate('Math.abs(G.Gfx.effects.shake.ox) + Math.abs(G.Gfx.effects.shake.oy) > 0'));
    await H.advance(page, 50);
    await pick(page, 5);
    await H.advance(page, 5);
    await H.shot(page, prefix + '_07_flash');
    await H.advance(page, 40);
    await pick(page, 7);
    await H.advance(page, 50);
    check('tint is applied', await page.evaluate('G.Gfx.effects.tint.cur[3] > 0.25'));
    await H.shot(page, prefix + '_08_tint');
    await pick(page, 7);
    await H.advance(page, 50);
    await pick(page, 7);
    await H.advance(page, 50);
    check('tint cleared again', await page.evaluate('G.Gfx.effects.tint.cur[3] < 0.01'));

    // --- fade out -> narration on black -> fade in
    await pick(page, 6);
    await waitFor(page, 'G.UI.MessageBox.cur && G.UI.MessageBox.cur.typer.done', 600, 'narration typed');
    check('screen is faded out behind the narration', await page.evaluate('G.Gfx.effects.fade.alpha === 1'));
    await H.shot(page, prefix + '_09_fade_narrate');
    await finishDialogue(page);
    await waitFor(page, '!G.Scenes.top().busy', 300, 'fade in done');
    check('fade in finished', await page.evaluate('G.Gfx.effects.fade.alpha === 0'));

    // --- narrate + think styles
    await pick(page, 8);
    await waitFor(page, 'G.UI.MessageBox.cur && G.UI.MessageBox.cur.typer.done', 600, 'narrate typed');
    await tap(page, 'confirm', 6);
    await waitFor(page, 'G.UI.MessageBox.cur && G.UI.MessageBox.cur.style === "think" && G.UI.MessageBox.cur.typer.done', 600, 'think typed');
    await H.shot(page, prefix + '_10_think');
    await finishDialogue(page);

    // --- save / load round trip (menu scrolls here)
    await pick(page, 9);
    await waitFor(page, 'G.Scenes.top().log.some(function (l) { return l.indexOf("save:") === 0; })', 300, 'save test ran');
    check('save/load round trip', (await page.evaluate('G.Scenes.top().log.filter(function (l) { return l.indexOf("save:") === 0; })[0]')) === 'save:ok');
    await H.advance(page, 60);
    await H.shot(page, prefix + '_11_menu_scrolled');
    await finishDialogue(page);

    // --- sound check (works with an empty manifest too)
    await pick(page, 10);
    await H.advance(page, 30);
    await finishDialogue(page);
    const au = await page.evaluate(function () {
      const a = window.G.DATA.manifest.audio || {};
      const ids = Object.keys(a);
      return {
        mode: window.G.Audio.mode(),
        bgm: ids.find(function (i) { return a[i].kind === 'bgm'; }) || null,
        amb: ids.find(function (i) { return i.indexOf('amb_') === 0; }) || null,
      };
    });
    check('audio path is ' + (launchOpts.file ? 'html' : 'webaudio'), au.mode === (launchOpts.file ? 'html' : 'webaudio'), au.mode);
    if (au.bgm) {
      check('music started', (await page.evaluate('G.Audio.currentBgm')) === au.bgm);
      await H.sleep(900);
      const pos1 = await page.evaluate('G.Audio.bgmPosition()');
      check('music position advances', pos1 > 0.2, 'pos=' + pos1);
      await page.evaluate(function () { window.G.Audio.saveBgm(); window.G.Audio.stopBgm(0); });
      check('stopBgm clears currentBgm', (await page.evaluate('G.Audio.currentBgm')) === null);
      await H.sleep(300);
      await page.evaluate(function () { window.G.Audio.restoreBgm(0); });
      await H.sleep(900);
      const pos2 = await page.evaluate('G.Audio.bgmPosition()');
      check('restoreBgm resumes the saved track at its position', (await page.evaluate('G.Audio.currentBgm')) === au.bgm && pos2 >= pos1, 'pos1=' + pos1 + ' pos2=' + pos2);
      if (au.amb) {
        await page.evaluate(function (id) { window.G.Audio.playAmbience(id); }, au.amb);
        check('ambience channel plays alongside', (await page.evaluate('G.Audio.currentAmbience')) === au.amb);
        await page.evaluate(function () { window.G.Audio.stopAmbience(0); });
      }
      await page.evaluate(function () { window.G.Audio.fadeBgm(0.3, 100); });
      await H.sleep(200);
      await page.evaluate(function () { window.G.Audio.stopBgm(0); });
    } else {
      console.log('  note: no bgm in the manifest yet - music checks skipped');
    }
    const missAudio = await page.evaluate(function () {
      const G = window.G;
      const before = G.errors.length;
      G.Audio.playSfx('sfx_definitely_missing'); G.Audio.playSfx('sfx_definitely_missing');
      G.Audio.playBgm('bgm_definitely_missing');
      const added = G.errors.slice(before);
      G.errors.length = before;                 // deliberate misses must not fail the run
      return added;
    });
    const emptyAudio = await page.evaluate('Object.keys(G.DATA.manifest.audio || {}).length === 0');
    check('missing audio ids warn exactly once each', emptyAudio ? missAudio.length === 0 : missAudio.length === 2, JSON.stringify(missAudio));

    // --- skipText: a whole conversation finishes by itself
    await page.evaluate(function () { window.__game.skipText = true; });
    await pick(page, 0);
    await H.advance(page, 30);
    check('skipText auto-confirms all messages', !(await page.evaluate('G.UI.isModal() || G.Scenes.top().busy')));
    await page.evaluate(function () { window.__game.skipText = false; });

    await assertClean(page, prefix);

    // --- unit-style checks inside the page
    const unit = await page.evaluate(async function () {
      const G = window.G;
      const r = {};
      // conditions
      G.State.newGame({ party: [], map: { id: 'm', x: 1, y: 2, dir: 'up' } });
      G.State.setFlag('a', true); G.State.setVar('n', 3); G.State.addItem('selftest_key', 1);
      G.State.setSelf('m', 'ev1', 'A', true);
      const E = G.Cond.evaluate;
      r.cond = E(null) && E({ flag: 'a' }) && !E({ notFlag: 'a' }) && E({ notFlag: 'zzz' }) &&
        E({ var: ['n', '>=', 3] }) && !E({ var: ['n', '<', 3] }) && E({ var: ['n', '!=', 4] }) && E({ var: ['n', '==', 3] }) &&
        E({ var: ['n', '>', 2] }) && E({ var: ['n', '<=', 3] }) &&
        E({ hasItem: 'selftest_key' }) && !E({ hasItem: 'nope' }) && !E({ inParty: 'nobody' }) &&
        E({ self: 'A' }, { mapId: 'm', eventId: 'ev1' }) && E({ notSelf: 'B' }, { mapId: 'm', eventId: 'ev1' }) &&
        E({ all: [{ flag: 'a' }, { hasItem: 'selftest_key' }] }) && !E({ all: [{ flag: 'a' }, { flag: 'b' }] }) &&
        E({ any: [{ flag: 'b' }, { flag: 'a' }] }) && E({ not: { flag: 'b' } });
      // rng
      G.Util.seed(42); const s1 = [G.Util.rng(), G.Util.randInt(1, 6), G.Util.choice([1, 2, 3])];
      G.Util.seed(42); const s2 = [G.Util.rng(), G.Util.randInt(1, 6), G.Util.choice([1, 2, 3])];
      r.rng = JSON.stringify(s1) === JSON.stringify(s2);
      const rr = []; for (let i = 0; i < 200; i++) rr.push(G.Util.randInt(2, 4));
      r.randInt = Math.min.apply(null, rr) === 2 && Math.max.apply(null, rr) === 4;
      // text layout
      const lay = G.Text.layout('one two three four five six seven eight nine ten eleven twelve', { maxWidth: 120, size: 24 });
      r.wrap = lay.length > 2 && lay.every(function (l) { return l.w <= 121; });
      const lay2 = G.Text.layout('a{w:10}b{speed:5}c {c:red}red{/c} {big}B{/big}', { maxWidth: 400 });
      r.ctrl = lay2.ctrl.length === 2 && lay2.ctrl[0].at === 1 && lay2.ctrl[1].at === 2 && lay2.plain === 'abc red B';
      r.measure = G.Gfx.measure('hello') > 10 && G.Gfx.measure('hello').w === +G.Gfx.measure('hello');
      // scenes: push/pop promise + pause/resume
      const calls = [];
      const A = { enter: function () { calls.push('A.enter'); }, pause: function () { calls.push('A.pause'); }, resume: function (x) { calls.push('A.resume:' + x); }, exit: function () { calls.push('A.exit'); } };
      const B = { opaque: false, enter: function (p) { calls.push('B.enter:' + p.v); }, exit: function () { calls.push('B.exit'); } };
      G.Scenes.register('t_a', A); G.Scenes.register('t_b', B);
      G.Scenes.push('t_a');
      const p = G.Scenes.push('t_b', { v: 7 });
      r.sceneName = window.__game.scene() === 't_b';
      G.Scenes.pop('done');
      r.popResult = (await p) === 'done';
      G.Scenes.pop();
      r.sceneCalls = calls.join(',') === 'A.enter,A.pause,B.enter:7,B.exit,A.resume:done,A.exit';
      r.backToSelftest = window.__game.scene() === 'selftest';
      // hook rejections for scenes that do not exist yet
      const rej = async function (fn) { try { await fn(); return false; } catch (e) { return /scene|interpreter|battle/i.test(e.message); } };
      r.rejects = (G.Scenes.has('map') || await rej(function () { return window.__game.teleport('x', 1, 1); })) &&
        (G.Scenes.has('battle') || await rej(function () { return window.__game.startBattle('x'); })) &&
        (G.Scenes.has('battle') || await rej(function () { return window.__game.battleAuto('attack'); })) &&
        (!!G.Interpreter || await rej(function () { return window.__game.run([]); }));
      // options persistence
      G.Audio.setVolume('bgm', 0.33);
      r.options = G.State.options.bgmVol === 0.33 && JSON.parse(localStorage.getItem('fable51.options')).bgmVol === 0.33;
      G.Audio.setVolume('bgm', 0.7);
      return r;
    });
    for (const k of Object.keys(unit)) check('unit: ' + k, unit[k] === true, String(unit[k]));
    await assertClean(page, prefix + ' after unit checks');

    // --- deliberate misses: placeholder + exactly one warning each
    const miss = await page.evaluate(function () {
      const G = window.G;
      const before = G.errors.length;
      const a = G.Assets.img('char_does_not_exist'); G.Assets.img('char_does_not_exist');
      const s = G.Assets.size('char_does_not_exist');
      G.Gfx.drawImg('obj_does_not_exist', 0, 0); G.Gfx.drawImg('obj_does_not_exist', 0, 0);
      G.Text.layout('{bogus}tag');
      G.Text.layout('{bogus}tag');
      return { added: G.errors.length - before, w: a.width, h: a.height, lw: s.w, lh: s.h, list: G.errors.slice(before) };
    });
    check('missing images give placeholders and warn once each', miss.added === 3 && miss.w === 384 && miss.h === 704 && miss.lw === 192 && miss.lh === 352, JSON.stringify(miss));
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const doHttp = !args.includes('--file');
  const doFile = !args.includes('--http');
  if (!args.includes('--no-build')) {
    const out = require('child_process').execFileSync(process.execPath, [require('path').join(H.ROOT, 'tools', 'build.js')], { encoding: 'utf8' });
    console.log(out.trim());
  }
  if (doHttp) {
    const server = await H.startServer();
    try {
      await runHttp('core_http', { url: server.url, query: 'selftest=1' });
    } finally {
      await server.close();
    }
  }
  if (doFile) await runHttp('core_file', { file: true, query: 'selftest=1' });

  console.log('');
  if (failures.length) {
    console.log('FAILED (' + failures.length + '):');
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
  console.log('core self-test passed. Screenshots: ' + H.SHOTS);
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
