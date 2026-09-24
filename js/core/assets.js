/*
 * assets.js - image registry driven by G.DATA.manifest.images. Never throws for missing art:
 * unknown ids return a visible hand-drawn placeholder canvas (one warning per id).
 */
(function () {
  'use strict';
  const G = window.G;

  let manifest = {};
  const cache = {};        // id -> { el, ready, failed, promise }
  const registered = {};   // id -> meta of runtime-registered images
  const placeholders = {}; // id -> canvas
  const blanks = {};       // "wxh" -> transparent canvas used while an image is still loading

  /** Real-pixel placeholder sizes per id prefix (mirrors TECH_SPEC section 8). */
  function placeholderSize(id) {
    if (/^char_/.test(id)) return { w: 384, h: 704, frameW: 128, frameH: 176 };
    if (/^face_/.test(id)) return { w: 256, h: 256 };
    if (/^en_/.test(id)) return { w: 320, h: 320 };
    if (/^ter_/.test(id)) return { w: 192, h: 192 };
    if (/^(bb|cg)_/.test(id)) return { w: 1536, h: 1152 };
    if (/^icon_/.test(id)) return { w: 64, h: 64 };
    return { w: 96, h: 96 };
  }

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w | 0);
    c.height = Math.max(1, h | 0);
    return c;
  }

  function scribbleRect(ctx, x, y, w, h, seed) {
    const N = G.Util.noise;
    ctx.beginPath();
    const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    for (let i = 0; i <= 4; i++) {
      const p = pts[i % 4];
      const px = p[0] + N(seed, i * 2) * 3, py = p[1] + N(seed, i * 2 + 1) * 3;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function makePlaceholder(id) {
    const s = placeholderSize(id);
    const c = makeCanvas(s.w, s.h);
    const ctx = c.getContext('2d');
    const seed = G.Util.hash(id);
    const ink = '#2b2433';
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.strokeStyle = ink;
    if (/^char_/.test(id)) {
      // twelve little doodle figures so walk animations remain visible without art
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
          const cx = col * 128 + 64, by = row * 176 + 168;
          const lean = (col - 1) * 6;
          ctx.fillStyle = '#f6c9a0';
          ctx.lineWidth = 5;
          ctx.beginPath(); ctx.ellipse(cx, by - 46, 30, 42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fbf5e6';
          ctx.beginPath(); ctx.arc(cx, by - 112, 32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.lineWidth = 6;
          ctx.beginPath(); ctx.moveTo(cx - 12, by - 8); ctx.lineTo(cx - 12 - lean, by);
          ctx.moveTo(cx + 12, by - 8); ctx.lineTo(cx + 12 + lean, by); ctx.stroke();
          ctx.fillStyle = ink;
          const ex = row === 1 ? -12 : row === 2 ? 12 : 0;
          if (row !== 3) {
            ctx.beginPath(); ctx.arc(cx - 10 + ex, by - 114, 4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(cx + 10 + ex, by - 114, 4, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      return c;
    }
    const opaque = /^(ter|bb|cg|face)_/.test(id);
    if (opaque) {
      ctx.fillStyle = '#f1e7cf';
      ctx.fillRect(0, 0, s.w, s.h);
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = Math.max(2, s.w / 160);
      for (let d = -s.h; d < s.w; d += Math.max(24, s.w / 16)) {
        ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + s.h, s.h); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = 'rgba(251,245,230,0.85)';
      ctx.fillRect(6, 6, s.w - 12, s.h - 12);
    }
    const m = Math.max(4, s.w / 24);
    ctx.lineWidth = Math.max(3, s.w / 64);
    ctx.setLineDash([ctx.lineWidth * 3, ctx.lineWidth * 2.5]);
    scribbleRect(ctx, m, m, s.w - 2 * m, s.h - 2 * m, seed);
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(m, m); ctx.lineTo(s.w - m, s.h - m);
    ctx.moveTo(s.w - m, m); ctx.lineTo(m, s.h - m); ctx.stroke();
    ctx.globalAlpha = 1;
    const label = id.length > 22 ? id.slice(0, 21) + '…' : id;
    const fs = Math.max(11, Math.min(s.w / 9, 64));
    ctx.font = fs + 'px "' + G.CONFIG.FONT_BODY + '", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = Math.min(s.w - 2 * m, ctx.measureText(label).width + fs);
    ctx.fillStyle = '#fbf5e6';
    ctx.fillRect(s.w / 2 - tw / 2, s.h / 2 - fs * 0.7, tw, fs * 1.4);
    ctx.fillStyle = '#c8443c';
    ctx.fillText(label, s.w / 2, s.h / 2, s.w - 2 * m);
    return c;
  }

  function placeholder(id) {
    if (!placeholders[id]) placeholders[id] = makePlaceholder(id);
    return placeholders[id];
  }

  function blank(w, h) {
    const key = w + 'x' + h;
    if (!blanks[key]) blanks[key] = makeCanvas(w, h);
    return blanks[key];
  }

  function load(id) {
    if (cache[id]) return cache[id].promise;
    const entry = manifest[id];
    const rec = cache[id] = { el: null, ready: false, failed: false, promise: null };
    rec.promise = new Promise(function (resolve) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        rec.el = img; rec.ready = true;
        if (entry && (entry.w !== img.naturalWidth || entry.h !== img.naturalHeight)) {
          G.warn('Manifest size mismatch for ' + id + ' (run node tools/build.js)');
        }
        resolve(img);
      };
      img.onerror = function () {
        G.warn('Image failed to load: ' + id + ' (' + entry.path + ')');
        rec.el = placeholder(id); rec.ready = true; rec.failed = true;
        resolve(rec.el);
      };
      img.src = entry.path;
    });
    return rec.promise;
  }

  G.Assets = {
    /** Reads the generated manifest. Called by main.js at boot (safe to call again). */
    init: function () {
      manifest = (G.DATA.manifest && G.DATA.manifest.images) || {};
    },

    /** True when the id exists in the manifest or was registered at runtime. */
    has: function (id) {
      return !!(manifest[id] || registered[id]);
    },

    /** True when the image is decoded and ready to draw. */
    isLoaded: function (id) {
      return !!(cache[id] && cache[id].ready);
    },

    /**
     * Returns a drawable for the id: the loaded image, a transparent stand-in of the right size while a
     * manifest image is still loading (lazy load starts here), or a visible placeholder for unknown ids.
     * @param {string} id
     * @returns {HTMLImageElement|HTMLCanvasElement}
     */
    img: function (id) {
      const rec = cache[id];
      if (rec && rec.ready) return rec.el;
      const entry = manifest[id];
      if (!entry) {
        G.warn('Missing image: ' + id);
        return placeholder(id);
      }
      if (!rec) load(id);
      return blank(entry.w, entry.h);
    },

    /**
     * Logical size (real pixels / SCALE) from the manifest; placeholder size for unknown ids.
     * @param {string} id
     * @returns {{w:number,h:number}}
     */
    size: function (id) {
      const m = G.Assets.meta(id);
      return { w: m.w / G.CONFIG.SCALE, h: m.h / G.CONFIG.SCALE };
    },

    /**
     * Manifest entry ({path,w,h,...sidecar meta}, w/h in REAL pixels). Unknown ids get a synthetic
     * entry `{path:null, w, h, placeholder:true}` (char_ ids also carry frameW/frameH) - never null.
     */
    meta: function (id) {
      if (manifest[id]) return manifest[id];
      if (registered[id]) return registered[id];
      const s = placeholderSize(id);
      return Object.assign({ path: null, placeholder: true }, s);
    },

    /**
     * Registers a runtime-generated image (canvas or image) under an id, e.g. procedural textures.
     * @param {string} id
     * @param {HTMLCanvasElement|HTMLImageElement} el
     * @param {object} [meta] extra meta merged into the synthetic manifest entry
     */
    register: function (id, el, meta) {
      registered[id] = Object.assign({ path: null, w: el.width, h: el.height, runtime: true }, meta || {});
      cache[id] = { el: el, ready: true, failed: false, promise: Promise.resolve(el) };
      return el;
    },

    /**
     * Loads the given ids. Never rejects; missing/broken files resolve to placeholders (with a warning).
     * @param {string[]} ids
     * @param {function(number, number)} [onProgress] called with (done, total)
     * @returns {Promise<void>}
     */
    preload: function (ids, onProgress) {
      ids = (ids || []).filter(function (id, i, arr) { return arr.indexOf(id) === i; });
      const total = ids.length;
      let done = 0;
      if (!total) { if (onProgress) onProgress(0, 0); return Promise.resolve(); }
      return Promise.all(ids.map(function (id) {
        let p;
        if (!manifest[id]) {
          if (!registered[id]) G.warn('Missing image: ' + id);
          p = Promise.resolve();
        } else {
          p = load(id);
        }
        return p.then(function () { done++; if (onProgress) onProgress(done, total); });
      })).then(function () {});
    },

    /** Loads every image in the manifest. */
    preloadAll: function (onProgress) {
      return G.Assets.preload(Object.keys(manifest), onProgress);
    },

    /** All manifest image ids (optionally filtered by prefix such as 'face_'). */
    ids: function (prefix) {
      const all = Object.keys(manifest).concat(Object.keys(registered));
      return prefix ? all.filter(function (id) { return id.indexOf(prefix) === 0; }) : all;
    },
  };
})();
