#!/usr/bin/env node
/*
 * build.js - regenerates js/data/manifest.js from assets/ and the <script> list in index.html.
 * Usage: node tools/build.js          (idempotent; run it after adding any file)
 * No dependencies: PNG / JPEG / WebP sizes are read straight from the file headers.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IMG_DIR = path.join(ROOT, 'assets', 'img');
const AUDIO_DIR = path.join(ROOT, 'assets', 'audio');
const MANIFEST = path.join(ROOT, 'js', 'data', 'manifest.js');
const INDEX = path.join(ROOT, 'index.html');
const MARK_START = '<!-- BUILD:SCRIPTS:START -->';
const MARK_END = '<!-- BUILD:SCRIPTS:END -->';

const IMG_EXT = ['.png', '.jpg', '.jpeg', '.webp'];
const AUDIO_EXT = ['.ogg', '.wav', '.mp3', '.m4a'];   // preference order when an id exists twice

const SCRIPT_ORDER = {
  core: ['boot.js', 'util.js', 'input.js', 'assets.js', 'audio.js', 'gfx.js', 'text.js', 'ui.js', 'state.js', 'scene.js'],
  map: ['entities.js', 'interpreter.js', 'map_scene.js'],
  battle: ['party.js', 'battle_logic.js', 'battle_ai.js', 'battle_ui.js', 'battle_scene.js'],
  scenes: ['title_scene.js', 'menu_scene.js', 'gameover_scene.js', 'ending_scene.js'],
  data: ['strings.js', 'terrains.js', 'objects.js', 'speakers.js', 'actors.js', 'skills.js', 'items.js', 'enemies.js', 'troops.js', 'common_events.js'],
};

const warnings = [];
function warn(msg) { warnings.push(msg); }

function listDir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return [];
  }
}

function posix(p) { return p.split(path.sep).join('/'); }

/* ---------------------------------------------------------------------- image sizes */

function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47 || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) { off++; continue; }
    const marker = buf[off + 1];
    if (marker === 0xff) { off++; continue; }                       // fill byte
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
    const len = buf.readUInt16BE(off + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return { w: buf.readUInt16BE(off + 7), h: buf.readUInt16BE(off + 5) };
    if (marker === 0xda) break;                                     // start of scan: no SOF found before data
    off += 2 + len;
  }
  return null;
}

function webpSize(buf) {
  if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  }
  if (chunk === 'VP8 ') {
    // frame tag (3 bytes) + start code 9d 01 2a, then 14-bit width / height
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (buf[20] !== 0x2f) return null;
    const bits = buf.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >>> 14) & 0x3fff) + 1 };
  }
  return null;
}

function imageSize(file) {
  const buf = fs.readFileSync(file);
  const ext = path.extname(file).toLowerCase();
  let size = null;
  if (ext === '.png') size = pngSize(buf);
  else if (ext === '.jpg' || ext === '.jpeg') size = jpegSize(buf);
  else if (ext === '.webp') size = webpSize(buf);
  return size || pngSize(buf) || jpegSize(buf) || webpSize(buf);
}

function readSidecar(file) {
  const side = file.replace(/\.[^.]+$/, '.json');
  if (!fs.existsSync(side)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(side, 'utf8'));
    if (data && typeof data === 'object' && !Array.isArray(data)) return data;
    warn('sidecar is not an object: ' + posix(path.relative(ROOT, side)));
  } catch (e) {
    warn('sidecar is not valid JSON: ' + posix(path.relative(ROOT, side)) + ' (' + e.message + ')');
  }
  return null;
}

/* ---------------------------------------------------------------------- scanning */

function walk(dir, exts, out) {
  for (const ent of listDir(dir).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const full = path.join(dir, ent.name);
    if (ent.name.startsWith('.') || ent.name.startsWith('_')) continue;
    if (ent.isDirectory()) walk(full, exts, out);
    else if (exts.includes(path.extname(ent.name).toLowerCase())) out.push(full);
  }
  return out;
}

function scanImages() {
  const images = {};
  for (const file of walk(IMG_DIR, IMG_EXT, [])) {
    const id = path.basename(file).replace(/\.[^.]+$/, '');
    const rel = posix(path.relative(ROOT, file));
    if (images[id]) { warn('duplicate image id "' + id + '": ' + images[id].path + ' and ' + rel + ' (kept the first)'); continue; }
    let size = null;
    try { size = imageSize(file); } catch (e) { size = null; }
    if (!size || !size.w || !size.h) { warn('cannot read image size, skipped: ' + rel); continue; }
    const entry = { path: rel, w: size.w, h: size.h };
    const meta = readSidecar(file);
    if (meta) for (const k of Object.keys(meta)) if (k !== 'path' && k !== 'w' && k !== 'h') entry[k] = meta[k];
    images[id] = entry;
  }
  return images;
}

function scanAudio() {
  const audio = {};
  for (const kind of ['bgm', 'sfx']) {
    const files = walk(path.join(AUDIO_DIR, kind), AUDIO_EXT, []);
    files.sort((a, b) => AUDIO_EXT.indexOf(path.extname(a).toLowerCase()) - AUDIO_EXT.indexOf(path.extname(b).toLowerCase()) || (a < b ? -1 : a > b ? 1 : 0));
    for (const file of files) {
      const id = path.basename(file).replace(/\.[^.]+$/, '');
      const rel = posix(path.relative(ROOT, file));
      if (audio[id]) {
        if (audio[id].kind !== kind) warn('duplicate audio id "' + id + '": ' + audio[id].path + ' and ' + rel + ' (kept the first)');
        continue;
      }
      const entry = { path: rel, kind: kind, loop: kind === 'bgm', volume: kind === 'bgm' ? 0.8 : 1 };
      const meta = readSidecar(file);
      if (meta) for (const k of Object.keys(meta)) if (k !== 'path' && k !== 'kind') entry[k] = meta[k];
      audio[id] = entry;
    }
  }
  return audio;
}

function sortKeys(obj) {
  const out = {};
  for (const k of Object.keys(obj).sort()) out[k] = obj[k];
  return out;
}

function writeIfChanged(file, content) {
  let old = null;
  try { old = fs.readFileSync(file, 'utf8'); } catch (e) { old = null; }
  if (old === content) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

function buildManifest() {
  const images = sortKeys(scanImages());
  const audio = sortKeys(scanAudio());
  const block = function (obj) {
    const keys = Object.keys(obj);
    if (!keys.length) return '{}';
    return '{\n' + keys.map((k) => '      ' + JSON.stringify(k) + ': ' + JSON.stringify(obj[k])).join(',\n') + '\n    }';
  };
  const src =
    '/* GENERATED by tools/build.js - do not edit by hand. Re-run "node tools/build.js" after changing assets/. */\n' +
    '(function () {\n' +
    "  'use strict';\n" +
    "  const root = typeof window !== 'undefined' ? window : globalThis;\n" +
    '  const G = root.G = root.G || {};\n' +
    '  G.DATA = G.DATA || {};\n' +
    '  G.DATA.manifest = {\n' +
    '    images: ' + block(images) + ',\n' +
    '    audio: ' + block(audio) + '\n' +
    '  };\n' +
    '})();\n';
  const changed = writeIfChanged(MANIFEST, src);
  return { images: Object.keys(images).length, audio: Object.keys(audio).length, changed: changed };
}

/* ---------------------------------------------------------------------- script list */

function jsFiles(dir) {
  return listDir(dir)
    .filter((e) => e.isFile() && e.name.endsWith('.js') && !e.name.startsWith('.') && !e.name.startsWith('_'))
    .map((e) => e.name)
    .sort();
}

function orderedFolder(folder, exclude) {
  const dir = path.join(ROOT, 'js', folder);
  const present = jsFiles(dir).filter((n) => !(exclude || []).includes(n));
  const listed = (SCRIPT_ORDER[folder] || []).filter((n) => present.includes(n));
  const extra = present.filter((n) => !listed.includes(n));
  return listed.concat(extra).map((n) => 'js/' + folder + '/' + n);
}

function scriptList() {
  let list = [];
  list = list.concat(orderedFolder('core'));
  list = list.concat(orderedFolder('map'));
  list = list.concat(orderedFolder('battle'));
  list = list.concat(orderedFolder('scenes'));
  list = list.concat(orderedFolder('data', ['manifest.js']));
  list.push('js/data/manifest.js');
  list = list.concat(jsFiles(path.join(ROOT, 'js', 'data', 'maps')).map((n) => 'js/data/maps/' + n));
  if (fs.existsSync(path.join(ROOT, 'js', 'main.js'))) list.push('js/main.js');
  else warn('js/main.js does not exist');
  return list;
}

function buildIndex() {
  let html;
  try {
    html = fs.readFileSync(INDEX, 'utf8');
  } catch (e) {
    throw new Error('index.html not found at ' + INDEX);
  }
  const a = html.indexOf(MARK_START);
  const b = html.indexOf(MARK_END);
  if (a < 0 || b < 0 || b < a) throw new Error('index.html is missing the ' + MARK_START + ' / ' + MARK_END + ' markers');
  const lineStart = html.lastIndexOf('\n', a) + 1;
  const indent = html.slice(lineStart, a).replace(/[^\s]/g, '');
  const list = scriptList();
  const tags = list.map((src) => indent + '<script src="' + src + '"></script>').join('\n');
  const out = html.slice(0, a + MARK_START.length) + '\n' + tags + '\n' + indent + html.slice(b);
  const changed = writeIfChanged(INDEX, out);
  return { scripts: list.length, changed: changed };
}

/* ---------------------------------------------------------------------- main */

function main() {
  const m = buildManifest();
  const i = buildIndex();
  console.log('manifest: ' + m.images + ' images, ' + m.audio + ' audio' + (m.changed ? ' (updated)' : ' (unchanged)'));
  console.log('index.html: ' + i.scripts + ' scripts' + (i.changed ? ' (updated)' : ' (unchanged)'));
  for (const w of warnings) console.warn('warning: ' + w);
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error('build failed: ' + e.message);
    process.exit(1);
  }
}

module.exports = { imageSize, scanImages, scanAudio, scriptList, buildManifest, buildIndex };
