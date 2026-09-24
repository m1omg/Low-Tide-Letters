/*
 * gfx.js - canvas, logical-pixel drawing helpers, hand-drawn panels, line boil, screen effects,
 * paper grain + vignette post pass.
 */
(function () {
  'use strict';
  const G = window.G;
  const U = G.Util;
  const C = G.CONFIG;

  let canvas = null;
  let ctx = null;
  let measureCtx = null;
  let overlayGrain = null;   // procedural grain + vignette, baked at full resolution
  let overlayPlain = null;   // vignette only
  let paperFull = null;      // pre-tiled 'ui_paper' image (when the art pipeline provides one)
  const panelPaths = new Map();

  const fx = {
    fade: { alpha: 0, from: 0, to: 0, t: 0, frames: 0, color: '#000', resolve: null },
    flash: { color: '#fff', t: 0, frames: 0 },
    shake: { power: 0, t: 0, frames: 0, ox: 0, oy: 0 },
    tint: { cur: [0, 0, 0, 0], from: [0, 0, 0, 0], to: [0, 0, 0, 0], t: 0, frames: 0 },
  };

  function cssColor(name) {
    if (name === 'black' || name == null) return '#000';
    if (name === 'white') return '#fff';
    return name;
  }

  /**
   * Resolves a font option to a CSS family list. 'body' (default) -> PatrickHand, 'title' -> GochiHand,
   * anything else is used as a family name.
   */
  function family(font) {
    if (!font || font === 'body') return '"' + C.FONT_BODY + '", "Comic Sans MS", "Segoe Print", cursive';
    if (font === 'title') return '"' + C.FONT_TITLE + '", "' + C.FONT_BODY + '", "Comic Sans MS", cursive';
    return font.indexOf(',') >= 0 || font.indexOf('"') >= 0 ? font : '"' + font + '", "' + C.FONT_BODY + '", cursive';
  }

  function fontString(size, font, italic) {
    return (italic ? 'italic ' : '') + (size || C.TEXT_SIZE) + 'px ' + family(font);
  }

  /* ------------------------------------------------------------------ procedural paper + vignette */

  /*
   * The post pass must stay cheap even without GPU acceleration, so everything is baked once into
   * full-size canvases: `overlayGrain` (procedural grain as a translucent darkening layer + vignette) is a
   * single source-over blit per frame. When a real 'ui_paper' image exists it is pre-tiled into `paperFull`
   * and multiplied instead, followed by the vignette-only overlay.
   */

  function makeGrainTile() {
    const size = 512;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const rng = U.makeRng(0xfab1e51);
    const img = x.createImageData(size, size);
    const d = img.data;
    for (let i = 0; i < size * size; i++) {
      // soft grain: mostly faint, occasionally a darker speck
      let a = rng() * 17;
      if (rng() < 0.035) a += 12 + rng() * 20;
      d[i * 4] = 92; d[i * 4 + 1] = 70; d[i * 4 + 2] = 52; d[i * 4 + 3] = a;
    }
    x.putImageData(img, 0, 0);
    // long faint fibres and a few pulp blotches; drawn wrapped so the tile stays seamless
    const wrapDraw = function (fn) {
      for (let ox = -size; ox <= size; ox += size) for (let oy = -size; oy <= size; oy += size) {
        x.save(); x.translate(ox, oy); fn(); x.restore();
      }
    };
    for (let i = 0; i < 170; i++) {
      const px = rng() * size, py = rng() * size, a = rng() * Math.PI, len = 8 + rng() * 34;
      const dark = rng() < 0.6;
      const bend = (rng() - 0.5) * 12;
      x.strokeStyle = dark ? 'rgba(110,88,66,' + (0.05 + rng() * 0.08) + ')' : 'rgba(255,255,255,' + (0.08 + rng() * 0.1) + ')';
      x.lineWidth = 0.6 + rng() * 0.9;
      wrapDraw(function () {
        x.beginPath();
        x.moveTo(px, py);
        x.quadraticCurveTo(px + Math.cos(a) * len / 2 + bend, py + Math.sin(a) * len / 2 - bend,
          px + Math.cos(a) * len, py + Math.sin(a) * len);
        x.stroke();
      });
    }
    for (let i = 0; i < 26; i++) {
      const px = rng() * size, py = rng() * size, r = 18 + rng() * 60;
      const alpha = 0.02 + rng() * 0.03;
      wrapDraw(function () {
        const g = x.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, 'rgba(150,120,90,' + alpha + ')');
        g.addColorStop(1, 'rgba(150,120,90,0)');
        x.fillStyle = g;
        x.fillRect(px - r, py - r, r * 2, r * 2);
      });
    }
    return c;
  }

  function fullCanvas() {
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = canvas.height;
    return c;
  }

  function drawVignette(x, w, h) {
    const cx = w / 2, cy = h / 2;
    x.save();
    x.translate(cx, cy);
    x.scale(1, h / w);
    const g = x.createRadialGradient(0, 0, w * 0.27, 0, 0, w * 0.68);
    g.addColorStop(0, 'rgba(70,48,40,0)');
    g.addColorStop(0.6, 'rgba(70,48,40,0.05)');
    g.addColorStop(1, 'rgba(60,40,44,0.34)');
    x.fillStyle = g;
    x.fillRect(-cx, -cy * (w / h), w, h * (w / h));
    x.restore();
  }

  function ensureOverlays() {
    if (!overlayGrain) {
      const tile = makeGrainTile();
      overlayGrain = fullCanvas();
      let x = overlayGrain.getContext('2d');
      x.fillStyle = x.createPattern(tile, 'repeat');
      x.fillRect(0, 0, overlayGrain.width, overlayGrain.height);
      drawVignette(x, overlayGrain.width, overlayGrain.height);
      overlayPlain = fullCanvas();
      drawVignette(overlayPlain.getContext('2d'), overlayPlain.width, overlayPlain.height);
      if (G.Assets && !G.Assets.has('ui_paper')) {
        // an opaque cream paper tile other code can use as a background texture
        const paper = document.createElement('canvas');
        paper.width = paper.height = tile.width;
        x = paper.getContext('2d');
        x.fillStyle = C.COLORS.paper;
        x.fillRect(0, 0, paper.width, paper.height);
        x.drawImage(tile, 0, 0);
        G.Assets.register('ui_paper', paper, { procedural: true });
      }
    }
    if (!paperFull && G.Assets && G.Assets.has('ui_paper') && !G.Assets.meta('ui_paper').runtime) {
      if (G.Assets.isLoaded('ui_paper')) {
        paperFull = fullCanvas();
        const x = paperFull.getContext('2d');
        x.fillStyle = x.createPattern(G.Assets.img('ui_paper'), 'repeat');
        x.fillRect(0, 0, paperFull.width, paperFull.height);
      } else {
        G.Assets.img('ui_paper'); // kicks off the lazy load; the procedural grain is used meanwhile
      }
    }
  }

  /* ------------------------------------------------------------------ wobbly geometry */

  /** Points around a rounded rectangle (clockwise from the top-left corner's end). */
  function roundedRectPoints(w, h, r, step) {
    const pts = [];
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    const edge = function (x1, y1, x2, y2) {
      const len = Math.hypot(x2 - x1, y2 - y1);
      const n = Math.max(1, Math.round(len / step));
      for (let i = 0; i < n; i++) pts.push([x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n]);
    };
    const corner = function (cx, cy, a0) {
      if (r <= 0) return;
      for (let i = 1; i <= 2; i++) {
        const a = a0 + (Math.PI / 2) * (i / 3);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
    };
    edge(r, 0, w - r, 0); corner(w - r, r, -Math.PI / 2);
    edge(w, r, w, h - r); corner(w - r, h - r, 0);
    edge(w - r, h, r, h); corner(r, h - r, Math.PI / 2);
    edge(0, h - r, 0, r); corner(r, r, Math.PI);
    return pts;
  }

  /** Smooth closed Path2D through jittered points (quadratic mid-point spline). */
  function wobblyClosedPath(pts, seed, amp, boilSeed, boilAmp) {
    const n = pts.length;
    const jit = new Array(n);
    for (let i = 0; i < n; i++) {
      jit[i] = [
        pts[i][0] + U.noise(seed, i * 2) * amp + U.noise(boilSeed, i * 2) * boilAmp,
        pts[i][1] + U.noise(seed, i * 2 + 1) * amp + U.noise(boilSeed, i * 2 + 1) * boilAmp,
      ];
    }
    const p = new Path2D();
    const mid = function (a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    const m0 = mid(jit[n - 1], jit[0]);
    p.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) {
      const m = mid(jit[i], jit[(i + 1) % n]);
      p.quadraticCurveTo(jit[i][0], jit[i][1], m[0], m[1]);
    }
    p.closePath();
    return p;
  }

  function panelPath(w, h, r, seed, phase, variant) {
    const key = w + '|' + h + '|' + r + '|' + seed + '|' + phase + '|' + variant;
    let p = panelPaths.get(key);
    if (!p) {
      if (panelPaths.size > 600) panelPaths.clear();
      const pts = roundedRectPoints(w, h, r, 22);
      const s = (seed + variant * 7919) | 0;
      p = wobblyClosedPath(pts, s, variant ? 1.9 : 1.25, (s ^ Math.imul(phase + 1, 0x9e3779b1)) | 0, variant ? 0.75 : 0.45);
      panelPaths.set(key, p);
    }
    return p;
  }

  /* ------------------------------------------------------------------ module */

  const Gfx = G.Gfx = {
    canvas: null,
    ctx: null,
    /** Fixed-step frame counter (advanced by updateEffects). Drives boil and UI animations. */
    frame: 0,

    /**
     * Binds the renderer to a canvas element and sizes its backing store (W*SCALE x H*SCALE).
     * @param {HTMLCanvasElement} el
     */
    init: function (el) {
      canvas = Gfx.canvas = el;
      canvas.width = C.W * C.SCALE;
      canvas.height = C.H * C.SCALE;
      ctx = Gfx.ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      measureCtx = document.createElement('canvas').getContext('2d');
    },

    /** Starts a frame: clears to black and installs the logical transform (including screen shake). */
    begin: function () {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(C.SCALE, 0, 0, C.SCALE, fx.shake.ox * C.SCALE, fx.shake.oy * C.SCALE);
    },

    /** Ends a frame: paper grain + soft vignette over everything, unless disabled in options (paper:false). */
    end: function () {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      const on = !(G.State && G.State.options && G.State.options.paper === false);
      if (on) {
        ensureOverlays();
        if (paperFull) {
          ctx.globalCompositeOperation = 'multiply';
          ctx.globalAlpha = 0.35;
          ctx.drawImage(paperFull, 0, 0);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
          ctx.drawImage(overlayPlain, 0, 0);
        } else {
          ctx.drawImage(overlayGrain, 0, 0);
        }
      }
      ctx.setTransform(C.SCALE, 0, 0, C.SCALE, 0, 0);
    },

    /**
     * Draws an image in LOGICAL pixels. All numbers (x, y, w, h and the source rect sx, sy, sw, sh) are
     * logical units: a 128x176 real-pixel walk frame is sw:64, sh:88.
     * - w/h: destination size (default = source rect size); giving only one keeps the aspect ratio
     * - anchorX/anchorY (0..1, default 0): which point of the destination rect sits at (x, y); also the
     *   pivot for `rot` (radians) and `scale`/`scaleX`/`scaleY`
     * - flipX mirrors the image inside its destination rect; alpha multiplies the current alpha
     * @param {string|HTMLCanvasElement|HTMLImageElement} id asset id or a drawable
     */
    drawImg: function (id, x, y, o) {
      o = o || {};
      const img = typeof id === 'string' ? G.Assets.img(id) : id;
      if (!img || !img.width) return;
      const S = C.SCALE;
      const iw = img.width / S, ih = img.height / S;
      const sx = o.sx || 0, sy = o.sy || 0;
      const sw = o.sw != null ? o.sw : iw - sx;
      const sh = o.sh != null ? o.sh : ih - sy;
      if (sw <= 0 || sh <= 0) return;
      let w = o.w, h = o.h;
      if (w == null && h == null) { w = sw; h = sh; }
      else if (w == null) w = sw * (h / sh);
      else if (h == null) h = sh * (w / sw);
      const ax = o.anchorX || 0, ay = o.anchorY || 0;
      const scX = o.scaleX != null ? o.scaleX : o.scale != null ? o.scale : 1;
      const scY = o.scaleY != null ? o.scaleY : o.scale != null ? o.scale : 1;
      const plain = !o.rot && !o.flipX && scX === 1 && scY === 1;
      if (plain && o.alpha == null) {
        ctx.drawImage(img, sx * S, sy * S, sw * S, sh * S, x - ax * w, y - ay * h, w, h);
        return;
      }
      ctx.save();
      if (o.alpha != null) ctx.globalAlpha *= U.clamp(o.alpha, 0, 1);
      ctx.translate(x, y);
      if (o.rot) ctx.rotate(o.rot);
      if (scX !== 1 || scY !== 1) ctx.scale(scX, scY);
      if (o.flipX) {
        const cx = -ax * w + w / 2;
        ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0);
      }
      ctx.drawImage(img, sx * S, sy * S, sw * S, sh * S, -ax * w, -ay * h, w, h);
      ctx.restore();
    },

    /**
     * Draws one cell of a sprite sheet. The cell size comes from the manifest meta `frameW`/`frameH`
     * (real pixels, e.g. 128x176 for char_ sheets) or from opts.frameW/frameH (LOGICAL pixels).
     * Other options as in drawImg (anchorX/anchorY, flipX, alpha, scale, rot...).
     */
    drawFrame: function (id, col, row, x, y, o) {
      o = o || {};
      const m = G.Assets.meta(id);
      const fw = o.frameW || (m.frameW ? m.frameW / C.SCALE : m.w / C.SCALE);
      const fh = o.frameH || (m.frameH ? m.frameH / C.SCALE : m.h / C.SCALE);
      Gfx.drawImg(id, x, y, Object.assign({}, o, { sx: col * fw, sy: row * fh, sw: fw, sh: fh }));
    },

    /**
     * Hand-drawn sketchbook box: soft offset shadow, paper fill, wobbly double pencil outline that boils
     * four times per second. The wobble is stable per `seed` (default: derived from w and h, so a panel
     * that only moves keeps its shape; pass a fixed seed when animating the size).
     * @param {{fill?:string|null, stroke?:string|null, seed?:number, shadow?:boolean, radius?:number,
     *          lineWidth?:number, alpha?:number, boil?:boolean}} [o]
     */
    panel: function (x, y, w, h, o) {
      o = o || {};
      w = Math.max(8, Math.round(w)); h = Math.max(8, Math.round(h));
      const fill = o.fill === undefined ? C.COLORS.paper : o.fill;
      const stroke = o.stroke === undefined ? C.COLORS.ink : o.stroke;
      const seed = (o.seed != null ? o.seed : (w * 31 + h * 17)) | 0;
      const r = o.radius != null ? o.radius : 12;
      const lw = o.lineWidth || 2.4;
      const phase = o.boil === false ? 0 : Math.floor(Gfx.frame / 15) % 4;
      const main = panelPath(w, h, r, seed, phase, 0);
      ctx.save();
      if (o.alpha != null) ctx.globalAlpha *= U.clamp(o.alpha, 0, 1);
      ctx.translate(x, y);
      if (fill) {
        if (o.shadow !== false) {
          ctx.translate(3, 4);
          ctx.fillStyle = C.COLORS.shadow;
          ctx.fill(main);
          ctx.translate(-3, -4);
        }
        ctx.fillStyle = fill;
        ctx.fill(main);
      }
      if (stroke) {
        ctx.lineJoin = ctx.lineCap = 'round';
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lw;
        ctx.stroke(main);
        const alpha = ctx.globalAlpha;
        ctx.globalAlpha = alpha * 0.38;
        ctx.lineWidth = lw * 0.45;
        ctx.stroke(panelPath(w, h, r, seed, phase, 1));
        ctx.globalAlpha = alpha;
      }
      ctx.restore();
    },

    /**
     * Wobbly pencil line between two points.
     * @param {{color?:string, width?:number, seed?:number, alpha?:number}} [o]
     */
    line: function (x1, y1, x2, y2, o) {
      o = o || {};
      const len = Math.hypot(x2 - x1, y2 - y1);
      const n = Math.max(2, Math.round(len / 18));
      const seed = (o.seed != null ? o.seed : Math.round(len) * 13) | 0;
      const phase = Math.floor(Gfx.frame / 15) % 4;
      const nx = len ? -(y2 - y1) / len : 0, ny = len ? (x2 - x1) / len : 0;
      ctx.save();
      if (o.alpha != null) ctx.globalAlpha *= o.alpha;
      ctx.strokeStyle = o.color || C.COLORS.ink;
      ctx.lineWidth = o.width || 2;
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const k = i === n ? 0 : U.noise(seed, i) * 1.3 + U.noise(seed + phase * 101, i) * 0.4;
        ctx.lineTo(x1 + (x2 - x1) * t + nx * k, y1 + (y2 - y1) * t + ny * k);
      }
      ctx.stroke();
      ctx.restore();
    },

    /**
     * Plain (no markup) text. Defaults: size 24, PatrickHand ('body'; 'title' = GochiHand), ink color,
     * align 'left', baseline 'top' (NOT canvas' alphabetic default - y is the top of the text line).
     * `outline` = true or a color draws a contrasting stroke behind the glyphs; `maxWidth` squeezes
     * the text horizontally to fit.
     */
    text: function (str, x, y, o) {
      o = o || {};
      str = String(str);
      const size = o.size || C.TEXT_SIZE;
      ctx.save();
      if (o.alpha != null) ctx.globalAlpha *= U.clamp(o.alpha, 0, 1);
      ctx.font = fontString(size, o.font, o.italic);
      ctx.textAlign = o.align || 'left';
      ctx.textBaseline = o.baseline || 'top';
      if (o.outline) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(2, size / 6);
        ctx.strokeStyle = o.outline === true ? C.COLORS.paper : o.outline;
        if (o.maxWidth) ctx.strokeText(str, x, y, o.maxWidth); else ctx.strokeText(str, x, y);
      }
      ctx.fillStyle = o.color || C.COLORS.ink;
      if (o.maxWidth) ctx.fillText(str, x, y, o.maxWidth); else ctx.fillText(str, x, y);
      ctx.restore();
    },

    /**
     * Measures plain text. Returns the width as a Number object that also carries `.w`, `.width` and
     * `.h` (line height = size * 1.25), so both `measure(s) + 4` and `measure(s).w` work.
     */
    measure: function (str, o) {
      o = o || {};
      const size = o.size || C.TEXT_SIZE;
      measureCtx.font = fontString(size, o.font, o.italic);
      const w = measureCtx.measureText(String(str)).width;
      const out = new Number(w); // eslint-disable-line no-new-wrappers
      out.w = w; out.width = w; out.h = size * 1.25; out.height = out.h;
      return out;
    },

    /** Raw width of a string for an explicit font string (used by G.Text). */
    measureRaw: function (str, size, font, italic) {
      measureCtx.font = fontString(size, font, italic);
      return measureCtx.measureText(str).width;
    },

    /** CSS font shorthand for a size and font option ('body' | 'title' | family name). */
    fontString: fontString,

    /**
     * Line boil: a tiny deterministic jitter that changes 6 times per second, different per seed.
     * Apply to hand-drawn sprites: x+dx, y+dy, rot (radians), scale sx/sy around 1.
     * @param {number|string} seed
     * @returns {{dx:number, dy:number, rot:number, sx:number, sy:number}}
     */
    boil: function (seed) {
      const s = (typeof seed === 'string' ? U.hash(seed) : (seed | 0)) | 0;
      const phase = Math.floor(Gfx.frame / 10);
      const k = (s ^ Math.imul(phase, 0x9e3779b1)) | 0;
      return {
        dx: U.noise(k, 1) * 0.9,
        dy: U.noise(k, 2) * 0.9,
        rot: U.noise(k, 3) * 0.012,
        sx: 1 + U.noise(k, 4) * 0.01,
        sy: 1 + U.noise(k, 5) * 0.01,
      };
    },

    /**
     * Fades the whole screen to a solid color. Resolves when fully covered.
     * @param {number} [frames=30]
     * @param {string} [color='black'] 'black' | 'white' | any CSS color
     * @returns {Promise<void>}
     */
    fadeOut: function (frames, color) {
      return startFade(1, frames, color);
    },

    /**
     * Fades back in from the current cover color. Resolves when fully visible.
     * @param {number} [frames=30]
     * @returns {Promise<void>}
     */
    fadeIn: function (frames, color) {
      return startFade(0, frames, color);
    },

    /** True while the screen is (partly) covered by a fade. */
    isFaded: function () {
      return fx.fade.alpha > 0;
    },

    /** Instantly sets the fade cover (1 = fully covered). */
    setFade: function (alpha, color) {
      const f = fx.fade;
      if (f.resolve) { const r = f.resolve; f.resolve = null; r(); }
      f.alpha = f.from = f.to = U.clamp(alpha, 0, 1);
      f.frames = 0; f.t = 0;
      if (color) f.color = cssColor(color);
    },

    /** Full-screen color flash that decays over `frames`. */
    flash: function (color, frames) {
      fx.flash.color = cssColor(color || '#fff');
      fx.flash.frames = Math.max(1, frames || 20);
      fx.flash.t = 0;
    },

    /** Screen shake with decaying power (logical pixels). */
    shake: function (power, frames) {
      fx.shake.power = power || 6;
      fx.shake.frames = Math.max(1, frames || 20);
      fx.shake.t = 0;
    },

    /**
     * Ambient screen tint. `rgba` = [r,g,b,a] with r,g,b 0-255 and a 0-1, or null to clear.
     * Blends from the current tint over `frames` (0 = instant).
     */
    setTint: function (rgba, frames) {
      const t = fx.tint;
      t.from = t.cur.slice();
      t.to = rgba ? [rgba[0], rgba[1], rgba[2], rgba[3] == null ? 0.3 : rgba[3]] : [t.cur[0], t.cur[1], t.cur[2], 0];
      if (t.from[3] === 0) { t.from[0] = t.to[0]; t.from[1] = t.to[1]; t.from[2] = t.to[2]; }
      t.frames = Math.max(0, frames || 0);
      t.t = 0;
      if (!t.frames) t.cur = t.to.slice();
    },

    /** Clears every screen effect immediately (scene changes, title). Pending fade promises resolve. */
    resetEffects: function () {
      Gfx.setFade(0, '#000');
      fx.flash.frames = 0; fx.shake.frames = 0; fx.shake.ox = fx.shake.oy = 0;
      fx.tint.cur = [0, 0, 0, 0]; fx.tint.frames = 0;
    },

    /** Advances effects by one fixed step. Called by the main loop. */
    updateEffects: function () {
      Gfx.frame++;
      const f = fx.fade;
      if (f.frames > 0) {
        f.t++;
        const k = Math.min(1, f.t / f.frames);
        f.alpha = U.lerp(f.from, f.to, k);
        if (k >= 1) {
          f.frames = 0;
          if (f.resolve) { const r = f.resolve; f.resolve = null; r(); }
        }
      }
      if (fx.flash.frames > 0 && ++fx.flash.t >= fx.flash.frames) fx.flash.frames = 0;
      const s = fx.shake;
      if (s.frames > 0) {
        s.t++;
        const decay = 1 - s.t / s.frames;
        s.ox = U.noise(Gfx.frame, 11) * s.power * decay;
        s.oy = U.noise(Gfx.frame, 12) * s.power * decay * 0.8;
        if (s.t >= s.frames) { s.frames = 0; s.ox = s.oy = 0; }
      }
      const t = fx.tint;
      if (t.frames > 0) {
        t.t++;
        const k = Math.min(1, t.t / t.frames);
        for (let i = 0; i < 4; i++) t.cur[i] = U.lerp(t.from[i], t.to[i], k);
        if (k >= 1) t.frames = 0;
      }
    },

    /**
     * Draws tint, flash and fade over the scenes and removes the shake offset from the transform, so
     * UI drawn afterwards (message boxes) stays readable and steady.
     */
    drawEffects: function () {
      ctx.setTransform(C.SCALE, 0, 0, C.SCALE, 0, 0);
      ctx.globalAlpha = 1;
      const t = fx.tint.cur;
      if (t[3] > 0.003) {
        ctx.fillStyle = 'rgba(' + Math.round(t[0]) + ',' + Math.round(t[1]) + ',' + Math.round(t[2]) + ',' + t[3].toFixed(3) + ')';
        ctx.fillRect(0, 0, C.W, C.H);
      }
      if (fx.flash.frames > 0) {
        ctx.globalAlpha = U.clamp(1 - fx.flash.t / fx.flash.frames, 0, 1) * 0.9;
        ctx.fillStyle = fx.flash.color;
        ctx.fillRect(0, 0, C.W, C.H);
        ctx.globalAlpha = 1;
      }
      if (fx.fade.alpha > 0) {
        ctx.globalAlpha = U.clamp(fx.fade.alpha, 0, 1);
        ctx.fillStyle = fx.fade.color;
        ctx.fillRect(0, 0, C.W, C.H);
        ctx.globalAlpha = 1;
      }
    },

    /** Read-only view of the effect state (tests, debug overlay). */
    effects: fx,
  };

  function startFade(to, frames, color) {
    const f = fx.fade;
    if (f.resolve) { const r = f.resolve; f.resolve = null; r(); }
    if (color) f.color = cssColor(color);
    else if (to === 1 && f.alpha === 0) f.color = '#000';
    frames = frames == null ? 30 : frames;
    if (!(frames > 0)) {
      f.alpha = f.from = f.to = to; f.frames = 0;
      return Promise.resolve();
    }
    f.from = f.alpha; f.to = to; f.frames = frames; f.t = 0;
    return new Promise(function (resolve) { f.resolve = resolve; });
  }
})();
