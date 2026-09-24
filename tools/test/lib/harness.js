/*
 * harness.js - shared helpers for the headless browser tests (puppeteer-core + system Chrome).
 *
 *   const H = require('./lib/harness');
 *   const server = await H.startServer();                       // -> { url, port, close() }
 *   const { browser, page } = await H.launchGame({ url: server.url, query: 'selftest=1' });
 *   await H.shot(page, 'my_screenshot');                        // -> tools/test/shots/my_screenshot.png
 *   const errors = await H.getErrors(page);                     // game errors + page errors (strings)
 *   await browser.close(); await server.close();
 *
 * launchGame options: { url, query, file, width, height, timeout, headless }
 *   url    base URL of a running server (default: starts one itself; it is closed with browser.close())
 *   file   true -> open ROOT/index.html through file:// instead of http
 *   query  query string without '?', e.g. 'selftest=1&debug=1'
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SHOTS = path.join(ROOT, 'tools', 'test', 'shots');
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome';

const puppeteer = require(path.join(ROOT, 'tools', 'test', 'node_modules', 'puppeteer-core'));
const serve = require(path.join(ROOT, 'serve.js'));

/**
 * Starts the static server on a free port (first tries 8770 so it does not fight a dev server on 8765).
 * @returns {Promise<{url:string, port:number, close:function():Promise<void>}>}
 */
async function startServer(opts) {
  const s = await serve.start(Object.assign({ port: 8770, quiet: true }, opts || {}));
  return { url: s.url, port: s.port, close: s.close };
}

/**
 * Launches Chrome, opens the game and waits until window.__game.ready is true.
 * @returns {Promise<{browser, page, server:null|object}>}
 */
async function launchGame(opts) {
  opts = opts || {};
  let server = null;
  let base;
  if (opts.file) base = pathToFileURL(path.join(ROOT, 'index.html')).href;
  else if (opts.url) base = opts.url;
  else { server = await startServer(); base = server.url; }
  const query = opts.query ? String(opts.query).replace(/^\?/, '') : '';
  const target = query ? base + (base.indexOf('?') >= 0 ? '&' : '?') + query : base;

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: opts.headless === undefined ? 'new' : opts.headless,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
    defaultViewport: { width: opts.width || 768, height: opts.height || 576, deviceScaleFactor: 1 },
  });
  if (server) {
    const close = browser.close.bind(browser);
    browser.close = async function () { await close(); await server.close(); };
  }
  try {
    const page = await browser.newPage();
    page.__errors = [];
    page.on('pageerror', function (err) { page.__errors.push('[pageerror] ' + (err && err.message ? err.message : String(err))); });
    page.on('console', function (msg) {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (/favicon\.ico/.test(text) || /favicon\.ico/.test((msg.location() || {}).url || '')) return;
      page.__errors.push('[console.error] ' + text);
    });
    page.on('requestfailed', function (req) {
      if (/favicon\.ico$/.test(req.url())) return;
      page.__errors.push('[requestfailed] ' + req.url() + ' ' + ((req.failure() || {}).errorText || ''));
    });
    page.on('response', function (res) {
      if (res.status() >= 400 && !/favicon\.ico$/.test(res.url())) page.__errors.push('[http ' + res.status() + '] ' + res.url());
    });
    await page.goto(target, { waitUntil: 'load', timeout: opts.timeout || 60000 });
    await page.waitForFunction('window.__game && window.__game.ready === true', { timeout: opts.timeout || 60000 });
    return { browser: browser, page: page, server: server };
  } catch (e) {
    await browser.close();
    throw e;
  }
}

/**
 * Saves a screenshot to tools/test/shots/<name>.png (the folder is created when needed).
 * @returns {Promise<string>} absolute path of the PNG
 */
async function shot(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const file = path.join(SHOTS, String(name).replace(/[^a-zA-Z0-9_.-]+/g, '_') + '.png');
  await page.screenshot({ path: file });
  return file;
}

/**
 * All problems seen so far: entries of window.__game.errors() plus page errors, console.error output,
 * failed requests and HTTP >= 400 responses (de-duplicated).
 * @returns {Promise<string[]>}
 */
async function getErrors(page) {
  let game = [];
  try {
    game = await page.evaluate(function () { return window.__game && window.__game.errors ? window.__game.errors() : ['[harness] window.__game is missing']; });
  } catch (e) {
    game = ['[harness] could not read __game.errors(): ' + e.message];
  }
  const out = game.slice();
  for (const e of page.__errors || []) {
    // console.error lines produced by G.warn/G.error are already in the game list
    const bare = e.replace(/^\[console\.error\] /, '');
    if (out.indexOf(bare) < 0 && out.indexOf(e) < 0) out.push(e);
  }
  return out;
}

/** Steps the game N fixed frames (fast) - shorthand for page.evaluate(() => __game.advance(n)). */
function advance(page, frames) {
  return page.evaluate(function (n) { return window.__game.advance(n); }, frames);
}

/** Taps an action through the test hook and lets `after` extra frames pass. */
async function press(page, action, after) {
  await page.evaluate(function (a) { return window.__game.press(a, 2); }, action);
  if (after) await advance(page, after);
}

/** Small sleep helper (real time). */
/**
 * Steps the game until the event interpreter, the transfer fade and any modal UI are idle (an arrival
 * scene may still be running after a transfer). Gives up after maxFrames.
 */
async function waitIdle(page, maxFrames) {
  let left = maxFrames || 3000;
  while (left > 0) {
    const busy = await page.evaluate(function () {
      const G = window.__game && window.__game.G;
      if (!G) return false;
      const sc = G.Scenes.top && G.Scenes.top();
      return (G.Interpreter && G.Interpreter.isBusy()) || (G.UI && G.UI.isModal && G.UI.isModal()) ||
        !!(sc && sc.transferring) || (window.__game.scene() !== 'map');
    });
    if (!busy) return true;
    await advance(page, 60);
    left -= 60;
  }
  return false;
}

function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

module.exports = { ROOT, SHOTS, startServer, launchGame, shot, getErrors, advance, press, sleep, waitIdle };
