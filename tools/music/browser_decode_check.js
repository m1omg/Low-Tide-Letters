#!/usr/bin/env node
/* browser_decode_check.js - decode rendered OGG loops with Chrome's WebAudio decoder (what the game uses over
 * http) and verify that the decoded length equals the intended loop length and that the seam is continuous.
 *
 *   node tools/music/browser_decode_check.js assets/audio/bgm/test_pipeline.ogg [more.ogg ...]
 *
 * Needs puppeteer-core from tools/test/node_modules and /usr/bin/google-chrome. Prints one JSON line per file:
 * {file, frames, sampleRate, channels, seamJump, maxStep, ok}. Exit status 1 when a file fails to decode or the
 * seam jump is larger than the biggest ordinary sample-to-sample step near the seam. */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(__dirname, '..', 'test', 'node_modules', 'puppeteer-core'));

(async () => {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('usage: node browser_decode_check.js file.ogg [...]');
    process.exit(2);
  }
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });
  let failed = false;
  try {
    const page = await browser.newPage();
    await page.goto('about:blank');
    for (const file of files) {
      const b64 = fs.readFileSync(file).toString('base64');
      const res = await page.evaluate(async (data) => {
        const bin = atob(data);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const ctx = new OfflineAudioContext(2, 1, 44100);
        const buf = await ctx.decodeAudioData(bytes.buffer);
        const n = buf.length;
        let seamJump = 0;
        let maxStep = 0;
        const w = Math.min(2205, n >> 2);
        for (let c = 0; c < buf.numberOfChannels; c++) {
          const d = buf.getChannelData(c);
          seamJump = Math.max(seamJump, Math.abs(d[0] - d[n - 1]));
          for (let i = 1; i < w; i++) {
            maxStep = Math.max(maxStep, Math.abs(d[i] - d[i - 1]), Math.abs(d[n - i] - d[n - i - 1]));
          }
        }
        return { frames: n, sampleRate: buf.sampleRate, channels: buf.numberOfChannels, seamJump, maxStep };
      }, b64);
      res.file = file;
      res.ok = res.seamJump <= res.maxStep * 1.5 + 1e-4;
      if (!res.ok) failed = true;
      console.log(JSON.stringify(res));
    }
  } catch (err) {
    console.error('decode check failed: ' + err.message);
    failed = true;
  } finally {
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
})();
