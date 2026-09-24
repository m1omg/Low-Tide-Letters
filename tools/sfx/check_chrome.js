#!/usr/bin/env node
/*
 * check_chrome.js - decodes every OGG in assets/audio/sfx with the decoder the game really uses
 * (headless Chrome, WebAudio decodeAudioData) and checks what matters at runtime:
 *   - the file decodes, 44.1 kHz, expected channel count (mono, stereo for loops)
 *   - the decoded length is sample-exact (equals the Ogg granule length reported by ffprobe)
 *   - no clipping, not silent
 *   - loops (sidecar json with "loop": true): the wrap-around seam x[n-1] -> x[0] is no rougher than the
 *     signal around it (step and second-difference "kink", both relative to the local RMS)
 *
 * Usage:  node tools/sfx/check_chrome.js [dir]        (exit code 1 on any failure)
 * Needs puppeteer-core from tools/test/node_modules and /usr/bin/google-chrome.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const puppeteer = require(path.join(ROOT, 'tools', 'test', 'node_modules', 'puppeteer-core'));
const dir = path.resolve(process.argv[2] || path.join(ROOT, 'assets', 'audio', 'sfx'));

/** runs inside the page */
async function decodeInPage(b64, isLoop) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const ctx = new OfflineAudioContext(2, 44100, 44100);
  let buf;
  try {
    buf = await ctx.decodeAudioData(u8.buffer);
  } catch (e) {
    return { ok: false, err: String(e) };
  }
  const out = { ok: true, length: buf.length, sr: buf.sampleRate, ch: buf.numberOfChannels, peak: 0, rms: 0,
    edgeIn: 0, edgeOut: 0, step: 0, kink: 0 };
  let sum = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    const n = d.length;
    for (let i = 0; i < n; i++) {
      const a = Math.abs(d[i]);
      if (a > out.peak) out.peak = a;
      sum += d[i] * d[i];
    }
    for (let i = 0; i < 3 && i < n; i++) {
      out.edgeIn = Math.max(out.edgeIn, Math.abs(d[i]));
      out.edgeOut = Math.max(out.edgeOut, Math.abs(d[n - 1 - i]));
    }
    if (isLoop && n > 8192) {
      const R = 2048;
      const ring = new Float64Array(2 * R);
      for (let i = 0; i < R; i++) { ring[i] = d[n - R + i]; ring[R + i] = d[i]; }
      let s1 = 0, n1 = 0, s2 = 0, n2 = 0;
      for (let i = 0; i < 2 * R - 1; i++) {
        if (i === R - 1) continue;
        const v = ring[i + 1] - ring[i];
        s1 += v * v; n1++;
      }
      for (let i = 0; i < 2 * R - 2; i++) {
        if (i === R - 2 || i === R - 1) continue;
        const v = ring[i + 2] - 2 * ring[i + 1] + ring[i];
        s2 += v * v; n2++;
      }
      const step = Math.abs(ring[R] - ring[R - 1]) / Math.sqrt(s1 / n1);
      const k1 = Math.abs(ring[R] - 2 * ring[R - 1] + ring[R - 2]);
      const k2 = Math.abs(ring[R + 1] - 2 * ring[R] + ring[R - 1]);
      const kink = Math.max(k1, k2) / Math.sqrt(s2 / n2);
      out.step = Math.max(out.step, step);
      out.kink = Math.max(out.kink, kink);
    }
  }
  out.rms = Math.sqrt(sum / (buf.length * buf.numberOfChannels));
  return out;
}

function granuleLength(file) {
  const txt = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=duration_ts', '-of', 'csv=p=0', file]).toString();
  return parseInt(txt.trim(), 10);
}

const dB = (v) => (20 * Math.log10(Math.max(v, 1e-12))).toFixed(1);

(async () => {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ogg')).sort();
  if (!files.length) { console.error('no .ogg files in ' + dir); process.exit(1); }
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const page = await browser.newPage();
  await page.goto('about:blank');
  let bad = 0;
  console.log('id                      samples   expect ch   peak    rms  status');
  for (const f of files) {
    const id = f.replace(/\.ogg$/, '');
    const full = path.join(dir, f);
    const side = path.join(dir, id + '.json');
    const isLoop = fs.existsSync(side) && JSON.parse(fs.readFileSync(side, 'utf8')).loop === true;
    const expect = granuleLength(full);
    const r = await page.evaluate(decodeInPage, fs.readFileSync(full).toString('base64'), isLoop);
    const fails = [];
    if (!r.ok) {
      fails.push('decode error ' + r.err);
    } else {
      if (r.sr !== 44100) fails.push('sample rate ' + r.sr);
      if (r.ch !== (isLoop ? 2 : 1)) fails.push('channels ' + r.ch);
      if (r.length !== expect) fails.push('length ' + r.length + ' != granule ' + expect);
      if (r.peak > 0.9) fails.push('peak too hot');
      if (r.rms < 0.001) fails.push('silent');
      if (id.startsWith('sfx_blip_') && r.length / 44100 >= 0.08) fails.push('blip >= 80 ms');
      if (isLoop) {
        if (r.step > 4) fails.push('seam step ' + r.step.toFixed(2));
        if (r.kink > 4) fails.push('seam kink ' + r.kink.toFixed(2));
      } else if (r.edgeOut > 0.01 * r.peak + 0.0015) {
        fails.push('end not silent');
      }
    }
    bad += fails.length ? 1 : 0;
    const seam = isLoop && r.ok ? '  [loop seam: step ' + r.step.toFixed(2) + ' kink ' + r.kink.toFixed(2) + ']' : '';
    console.log(id.padEnd(22) + String(r.ok ? r.length : '-').padStart(9) + String(expect).padStart(9) +
      String(r.ok ? r.ch : '-').padStart(3) + (r.ok ? dB(r.peak) : '-').padStart(7) + (r.ok ? dB(r.rms) : '-').padStart(7) +
      '  ' + (fails.length ? 'FAIL: ' + fails.join('; ') : 'ok') + seam);
  }
  await browser.close();
  console.log(files.length + ' files decoded in Chrome, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
