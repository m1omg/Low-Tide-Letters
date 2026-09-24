/*
 * ui.js - sketchbook UI widgets: MessageBox, ChoiceBox, ListMenu, Gauge, Toast.
 *
 * MessageBox, ChoiceBox and Toast are singletons that live on an overlay ABOVE the scene stack: the main
 * loop calls G.UI.update() every step and G.UI.draw(ctx) every frame (after screen effects, so text can be
 * shown on a faded-out screen). They never change G.Scenes.top(). While a message or choice is open,
 * G.UI.isModal() is true and the main loop hides all input from scene updates.
 * ListMenu and Gauge are classes owned by whoever creates them: call their update()/draw(ctx) yourself.
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CONFIG;
  const U = G.Util;
  const INK = C.COLORS.ink;
  const PAPER = C.COLORS.paper;

  const BOX = { x: 16, y: 404, w: 736, h: 156 };
  const PORTRAIT = 128;
  /** Nacre's paper slip (DESIGN_BIBLE 9.1): narrow white slip that slides in from the top. */
  const SLIP = { w: 360, h: 72, y: 26 };
  /** The 'think' card: dim grey-blue paper, no tag (DESIGN_BIBLE 9.1). */
  const THINK = { fill: '#d7e0e8', stroke: '#65788a', text: '#44515f' };

  function skipping() {
    return !!(window.__game && window.__game.skipText);
  }

  /** Plays a generic UI sound by role: 'cursor' | 'confirm' | 'cancel' | 'buzzer' | ... (G.DATA.strings.sfx). */
  function uiSfx(role, opts) {
    const map = (G.DATA.strings && G.DATA.strings.sfx) || {};
    if (map[role]) G.Audio.playSfx(map[role], opts);
  }

  /** Selection cursor: uses image 'ui_cursor' when it exists, otherwise a little red pencil-drawn arrow. */
  function drawCursor(ctx, x, y, o) {
    o = o || {};
    const t = G.Gfx.frame;
    const bob = o.still ? 0 : Math.sin(t * 0.14) * 2.2;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (G.Assets.has('ui_cursor')) {
      const s = G.Assets.size('ui_cursor');
      const k = Math.min(1, 26 / Math.max(s.w, s.h));
      G.Gfx.drawImg('ui_cursor', x + bob, y, { w: s.w * k, h: s.h * k, anchorX: 0.5, anchorY: 0.5 });
      ctx.restore();
      return;
    }
    ctx.translate(x + bob, y);
    const ph = Math.floor(t / 15) % 4;
    const j = function (i) { return U.noise(977 + ph, i) * 0.7; };
    ctx.beginPath();
    ctx.moveTo(-8 + j(1), -7.5 + j(2));
    ctx.quadraticCurveTo(2, -5 + j(3), 9 + j(4), 0 + j(5));
    ctx.quadraticCurveTo(2, 5 + j(6), -8 + j(7), 7.5 + j(8));
    ctx.quadraticCurveTo(-4.5, 0, -8 + j(1), -7.5 + j(2));
    ctx.closePath();
    ctx.fillStyle = C.COLORS.accent;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.restore();
  }

  /** The bouncing "continue" pencil (image 'ui_continue' when present). */
  function drawContinueMark(ctx, x, y, light) {
    const t = G.Gfx.frame;
    const bounce = Math.abs(Math.sin(t * 0.085)) * 6;
    if (G.Assets.has('ui_continue')) {
      const s = G.Assets.size('ui_continue');
      const k = Math.min(1, 28 / Math.max(s.w, s.h));
      G.Gfx.drawImg('ui_continue', x, y - bounce, { w: s.w * k, h: s.h * k, anchorX: 0.5, anchorY: 1 });
      return;
    }
    ctx.save();
    ctx.translate(x, y - bounce);
    ctx.rotate(0.55);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = light ? PAPER : INK;
    ctx.fillStyle = '#e8836f';                         // eraser
    ctx.beginPath(); ctx.rect(-4, -26, 8, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f2c14e';                         // body
    ctx.beginPath(); ctx.rect(-4, -21, 8, 14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f6e3c3';                         // sharpened wood
    ctx.beginPath(); ctx.moveTo(-4, -7); ctx.lineTo(4, -7); ctx.lineTo(0, 1); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = light ? PAPER : INK;               // lead
    ctx.beginPath(); ctx.moveTo(-1.6, -2.2); ctx.lineTo(1.6, -2.2); ctx.lineTo(0, 1); ctx.closePath(); ctx.fill();
    ctx.restore();
    // the little scribble it is "writing"
    ctx.save();
    ctx.globalAlpha *= 0.55;
    G.Gfx.line(x - 12, y + 3, x + 2, y + 3, { width: 1.6, seed: 5150, color: light ? PAPER : INK });
    ctx.restore();
  }

  /* ====================================================================== luggage tags and string */

  /** Builds a wobbly closed pencil path through `pts` on the current context (boils 4x per second). */
  function wobblyPath(ctx, pts, seed, amp) {
    const phase = Math.floor(G.Gfx.frame / 15) % 4;
    const p = new Array(pts.length);
    for (let i = 0; i < pts.length; i++) {
      p[i] = [pts[i][0] + U.noise(seed + phase * 131, i * 2) * amp,
        pts[i][1] + U.noise(seed + phase * 131, i * 2 + 1) * amp];
    }
    const mid = function (a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    let m = mid(p[p.length - 1], p[0]);
    ctx.beginPath();
    ctx.moveTo(m[0], m[1]);
    for (let i = 0; i < p.length; i++) {
      const nxt = p[(i + 1) % p.length];
      m = mid(p[i], nxt);
      ctx.quadraticCurveTo(p[i][0], p[i][1], m[0], m[1]);
    }
    ctx.closePath();
  }

  /**
   * A hanging piece of string (slightly sagging, hand-drawn). Used to tie luggage tags to things.
   * @param {{sag?:number, color?:string, width?:number, seed?:number, alpha?:number}} [o]
   */
  function drawStringLine(ctx, x1, y1, x2, y2, o) {
    o = o || {};
    const len = Math.hypot(x2 - x1, y2 - y1);
    const sag = o.sag != null ? o.sag : Math.min(16, len * 0.22);
    const seed = (o.seed != null ? o.seed : 77) | 0;
    const phase = Math.floor(G.Gfx.frame / 15) % 4;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.strokeStyle = o.color || C.COLORS.inkSoft;
    ctx.lineWidth = o.width || 1.7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const n = 9;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const j = i === n ? 0 : 0.8;
      ctx.lineTo(x1 + (x2 - x1) * t + U.noise(seed + phase, i) * j,
        y1 + (y2 - y1) * t + Math.sin(Math.PI * t) * sag + U.noise(seed + phase, i + 40) * j);
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * The game's signature widget: a luggage tag (rectangle with a clipped top-left corner, an eyelet and,
   * optionally, a short string tying it to something). Everything in the UI that used to be a "button"
   * is one of these (DESIGN_BIBLE 9: luggage tags, string and sand).
   * @param {object} [o]
   *   color        tint of the card (speaker colour / member colour); the label stays in ink
   *   label, size, font ('title' by default), labelColor, labelAlign ('left'|'center'), fit (shrink/wrap a long label)
   *   tieX, tieY   when given, a string is drawn from the eyelet to that point
   *   sag          sag of that string
   *   selected     draws the highlighter stroke under the label
   *   disabled     draws the whole tag faded
   *   alpha, seed, fill, shadow
   * @returns {{holeX:number, holeY:number}} where the eyelet ended up (to tie more string to it)
   */
  /** Corner list of a tag outline, subdivided so the wobble keeps the edges straight and the corners crisp. */
  function tagPoints(w, h, cut) {
    const corners = [[cut, 0], [w, 0], [w, h], [0, h], [0, cut]];
    const out = [];
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i], b = corners[(i + 1) % corners.length];
      const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 12));
      for (let j = 0; j < n; j++) out.push([a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n]);
    }
    return out;
  }

  function drawTag(ctx, x, y, w, h, o) {
    o = o || {};
    const seed = (o.seed != null ? o.seed : (w * 7 + h * 13)) | 0;
    const cut = Math.min(20, Math.max(10, h * 0.42));
    const pts = tagPoints(w, h, cut);
    const color = o.color || C.COLORS.inkSoft;
    const holeX = x + cut * 0.55 + 5, holeY = y + cut * 0.55 + 5;
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= U.clamp(o.alpha, 0, 1);
    if (o.disabled) ctx.globalAlpha *= 0.42;
    if (o.tieX != null) drawStringLine(ctx, holeX, holeY, o.tieX, o.tieY, { sag: o.sag, seed: seed + 3 });
    ctx.save();
    ctx.translate(x, y);
    if (o.shadow !== false) {
      ctx.save();
      ctx.translate(3, 4);
      wobblyPath(ctx, pts, seed, 0.8);
      ctx.fillStyle = C.COLORS.shadow;
      ctx.fill();
      ctx.restore();
    }
    wobblyPath(ctx, pts, seed, 0.8);
    ctx.fillStyle = o.fill || C.COLORS.paper;
    ctx.fill();
    ctx.save();                      // colour wash inside the card
    ctx.clip();
    ctx.globalAlpha *= o.selected ? 0.34 : 0.2;
    ctx.fillStyle = color;
    ctx.fillRect(-2, -2, w + 4, h + 4);
    ctx.restore();
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.strokeStyle = C.COLORS.ink;
    ctx.lineWidth = o.selected ? 2.6 : 2;
    ctx.stroke();
    ctx.restore();
    // eyelet
    ctx.beginPath();
    ctx.arc(holeX, holeY, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = C.COLORS.paper;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = color;
    ctx.stroke();
    if (o.label != null) {
      let size = o.size || 22;
      let lay = G.Text.layout(String(o.label), { size: size, font: o.font || 'title' });
      if (o.fit) {
        // shrink to fit the tag, then wrap to two lines rather than run off it (bible 9.2 Say/Keep lines)
        const room = w - cut - 16;
        while (lay.width > room && size > 17) { size -= 1; lay = G.Text.layout(String(o.label), { size: size, font: o.font || 'title' }); }
        if (lay.width > room) lay = G.Text.layout(String(o.label), { size: size, font: o.font || 'title', maxWidth: room, lineHeight: 1.0 });
      }
      const lx = o.labelAlign === 'center' ? x + (w + cut * 0.5) / 2 - lay.width / 2 : x + cut + 8;
      const ly = y + (h - lay.height) / 2;
      if (o.selected) drawHighlight(ctx, lx - 8, ly + 1, Math.min(lay.width + 16, w - cut - 6), lay.height + 2, seed + 9);
      G.Text.draw(lay, lx, ly, { color: o.labelColor || C.COLORS.ink });
    }
    ctx.restore();
    return { holeX: holeX, holeY: holeY };
  }

  /* ====================================================================== MessageBox */

  function resolveSpeaker(sp) {
    if (!sp) return null;
    if (typeof sp === 'object') return sp;
    const def = G.DATA.speakers && G.DATA.speakers[sp];
    if (!def) { G.warn('MessageBox: unknown speaker ' + sp); return { name: String(sp) }; }
    return def;
  }

  /** Border colour of a slip: explicit > the speaker's per-tide table > the speaker colour. */
  function slipColor(speaker, o) {
    if (o && o.color) return o.color;
    const tide = G.State && G.State.getVar ? G.State.getVar('tide') : 0;
    if (speaker && speaker.slipColors && speaker.slipColors[tide]) return speaker.slipColors[tide];
    return (speaker && speaker.color) || C.COLORS.inkSoft;
  }

  function faceFor(speaker, expr) {
    if (!speaker || !speaker.faces) return null;
    const a = 'face_' + speaker.faces + '_' + (expr || 'neutral');
    if (G.Assets.has(a)) return a;
    const b = 'face_' + speaker.faces + '_neutral';
    if (G.Assets.has(b)) return b;
    return null;
  }

  const MessageBox = {
    queue: [],
    cur: null,
    ghost: null,
    openT: 0,
    linger: 0,

    /**
     * Shows a message and resolves when the player has confirmed its last page.
     * @param {{speaker?:string|object|null, expr?:string|null, text:string,
     *          style?:'normal'|'narrate'|'think', pos?:'bottom'|'middle'|'top', auto?:number,
     *          speed?:number}} opts
     *   speaker: id in G.DATA.speakers or an inline {name,color,faces,blip} object; style 'narrate' =
     *   centered italic box without name/portrait; 'think' = dim box with light text; `auto` = frames
     *   after which a finished page advances by itself (non-interactive captions).
     *   Calls made while another message is open are queued in order.
     * @returns {Promise<void>}
     */
    show: function (opts) {
      if (typeof opts === 'string') opts = { text: opts };
      opts = opts || {};
      const self = this;
      return new Promise(function (resolve) {
        self.queue.push({ opts: opts, resolve: resolve });
        if (!self.cur) self._begin(self.queue.shift());
      });
    },

    /** True while a message is on screen or queued (the box blocks the game). */
    isBusy: function () {
      return !!this.cur || this.queue.length > 0;
    },

    /** True while the box is visible at all (including the short linger after the last page). */
    isOpen: function () {
      return !!this.cur || !!this.ghost;
    },

    /** Drops everything without resolving pending promises (used when leaving to the title). */
    reset: function () {
      // resolve what is dropped: a command list awaiting one of these boxes must not hang forever
      const pending = this.queue.splice(0);
      if (this.cur) pending.unshift(this.cur);
      this.cur = null; this.ghost = null; this.openT = 0; this.linger = 0;
      for (const e of pending) { try { e.resolve(); } catch (err) { /* nothing */ } }
    },

    _begin: function (entry) {
      const o = entry.opts;
      const spDef = resolveSpeaker(o.speaker);
      let style = o.style || (spDef && spDef.style) || 'normal';
      if (style !== 'narrate' && style !== 'think' && style !== 'slip') style = 'normal';
      const speaker = style === 'normal' ? spDef : null;
      const face = style === 'normal' ? faceFor(speaker, o.expr) : null;
      const geo = { x: BOX.x, y: BOX.y, w: BOX.w, h: BOX.h };
      let size = C.TEXT_SIZE, font = 'body', maxLines = 4;
      if (style === 'think') {                       // a quieter, narrower card (bible 9.1)
        geo.x = BOX.x + 52; geo.w = BOX.w - 104; geo.y = BOX.y + 14; geo.h = BOX.h - 22;
      } else if (style === 'slip') {                 // Nacre's printed slip: 360x72, slides in from the top
        geo.x = Math.round((C.W - SLIP.w) / 2); geo.y = SLIP.y; geo.w = SLIP.w; geo.h = SLIP.h;
        size = 21; font = 'title'; maxLines = 2;
      }
      if (o.pos === 'top' && style === 'normal') geo.y = speaker && speaker.name ? 54 : 16;
      else if (o.pos === 'middle' && style !== 'slip') geo.y = Math.round((C.H - geo.h) / 2);
      let textX = geo.x + 24, textW = geo.w - 48 - 10;
      if (face) { textX = geo.x + 14 + PORTRAIT + 20; textW = geo.x + geo.w - 30 - textX; }
      if (style === 'narrate') textW = 620;
      if (style === 'slip') { textX = geo.x + 20; textW = geo.w - 40; }
      let raw = String(o.text == null ? '' : o.text);
      if (style === 'slip') raw = raw.toUpperCase();
      const pages = G.Text.paginate(raw, {
        maxWidth: textW, size: size, font: font, italic: style === 'narrate', maxLines: maxLines,
      });
      let blip = (spDef && spDef.blip !== undefined ? spDef.blip : null) ||
        (G.DATA.strings.sfx && G.DATA.strings.sfx.blip) || null;
      if (style === 'slip') { blip = o.blip || null; uiSfx('page', { volume: 0.85 }); }
      const cur = {
        opts: o, resolve: entry.resolve, style: style, speaker: speaker, face: face, geo: geo,
        textX: textX, textW: textW, pages: pages, page: 0, typer: null, age: 0, doneT: 0, blipN: 0,
        speed: o.speed != null ? o.speed : 2, blip: blip, size: size,
        slipColor: style === 'slip' ? slipColor(spDef, o) : null,
      };
      cur.onGlyph = function () {
        if (cur.blip && cur.blipN++ % 2 === 0 && !skipping()) {
          G.Audio.playSfx(cur.blip, { volume: 0.6, rate: 0.95 + Math.random() * 0.1 });
        }
      };
      cur.typer = new G.Text.Typer(pages[0], { speed: cur.speed, onGlyph: cur.onGlyph });
      if (this.ghost) this.openT = Math.max(this.openT, 0.75); else this.openT = 0;
      this.ghost = null;
      this.cur = cur;
    },

    _finish: function () {
      const cur = this.cur;
      this.cur = null;
      this.ghost = cur;
      this.linger = 3;
      cur.resolve();
    },

    _nextPage: function () {
      const cur = this.cur;
      if (cur.page + 1 >= cur.pages.length) { this._finish(); return; }
      cur.page++;
      cur.doneT = 0;
      const speed = cur.typer.speed;
      cur.typer = new G.Text.Typer(cur.pages[cur.page], { speed: speed, onGlyph: cur.onGlyph });
      uiSfx('page', { volume: 0.5 });
    },

    /** Called by G.UI.update(). `passive` = a choice box owns the input; only keep the box alive. */
    update: function (passive) {
      if (!this.cur) {
        if (this.queue.length) this._begin(this.queue.shift());
        else if (this.ghost && !passive) {
          if (this.linger > 0) this.linger--;
          else { this.openT -= 0.22; if (this.openT <= 0) { this.openT = 0; this.ghost = null; } }
        }
        return;
      }
      const cur = this.cur;
      cur.age++;
      if (this.openT < 1) this.openT = Math.min(1, this.openT + 0.2);
      if (passive) return;
      if (skipping()) {
        cur.typer.complete();
        this._finish();
        return;
      }
      const armed = cur.age > 3;
      const fast = armed && G.Input.isDown('cancel');
      if (!cur.typer.done) {
        if (armed && G.Input.pressed('confirm')) cur.typer.complete();
        else cur.typer.update(fast);
        return;
      }
      cur.doneT++;
      if ((armed && G.Input.pressed('confirm')) || (fast && cur.doneT > 5) ||
          (cur.opts.auto > 0 && cur.doneT >= cur.opts.auto)) {
        this._nextPage();
      }
    },

    /** Called by G.UI.draw(). */
    draw: function (ctx) {
      const m = this.cur || this.ghost;
      if (!m || this.openT <= 0) return;
      const a = U.ease.out(U.clamp(this.openT, 0, 1));
      const page = m.pages[Math.min(m.page, m.pages.length - 1)];
      const upTo = this.cur ? m.typer.upTo : Infinity;
      const dark = m.style === 'think';
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.translate(0, m.style === 'slip' ? -(1 - a) * (SLIP.y + SLIP.h + 24) : (1 - a) * 14);
      if (m.style === 'slip') {
        const g = m.geo;
        G.Gfx.panel(g.x, g.y, g.w, g.h, { seed: 6161, fill: '#fffdf4', stroke: m.slipColor, radius: 3, lineWidth: 1.8 });
        G.Gfx.panel(g.x + 7, g.y + 7, g.w - 14, g.h - 14, {
          seed: 6162, fill: null, stroke: m.slipColor, radius: 2, lineWidth: 1, shadow: false, alpha: 0.7,
        });
        G.Text.draw(page, m.textX, g.y + (g.h - page.height) / 2, {
          upTo: upTo, align: 'center', width: m.textW, color: '#4a4450',
        });
        if (this.cur && m.typer.done && !(m.opts.auto > 0)) drawContinueMark(ctx, g.x + g.w - 22, g.y + g.h - 6, false);
        ctx.restore();
        return;
      }
      if (m.style === 'narrate') {
        const w = Math.max(340, Math.min(BOX.w, page.width + 84));
        const h = Math.max(84, page.height + 44);
        const x = Math.round((C.W - w) / 2);
        let y = BOX.y + BOX.h - h;
        if (m.opts.pos === 'middle') y = Math.round((C.H - h) / 2);
        else if (m.opts.pos === 'top') y = 20;
        G.Gfx.panel(x, y, w, h, { seed: 4242 });
        G.Text.draw(page, x, y + (h - page.height) / 2, { upTo: upTo, align: 'center', width: w, color: INK });
        if (this.cur && m.typer.done && !(m.opts.auto > 0)) drawContinueMark(ctx, x + w - 26, y + h - 8, false);
        ctx.restore();
        return;
      }
      const g = m.geo;
      const name = m.speaker && m.speaker.name ? G.Text.expand(m.speaker.name) : null;
      if (dark) G.Gfx.panel(g.x, g.y, g.w, g.h, { seed: 2323, fill: THINK.fill, stroke: THINK.stroke, lineWidth: 2 });
      else G.Gfx.panel(g.x, g.y, g.w, g.h, { seed: 2121 });
      if (name) {
        // the name tag is a luggage tag tied to the box's top-left corner by a short string (bible 9.1)
        const nw = G.Gfx.measure(name, { size: 23, font: 'title' }).w;
        const tw = Math.max(92, nw + 54), th = 40;
        const tx = g.x + 34, ty = g.y - th - 8;
        drawTag(ctx, tx, ty, tw, th, {
          color: m.speaker.color || INK, label: name, size: 23, seed: 1717,
          tieX: g.x + 11, tieY: g.y + 7, sag: 5,
        });
      }
      if (m.face) {
        G.Gfx.panel(g.x + 12, g.y + 12, PORTRAIT + 4, PORTRAIT + 4, { seed: 3131, fill: C.COLORS.paperShade, shadow: false, lineWidth: 2 });
        const b = G.Gfx.boil(m.face);
        G.Gfx.drawImg(m.face, g.x + 14 + PORTRAIT / 2 + b.dx * 0.6, g.y + 14 + PORTRAIT / 2 + b.dy * 0.6, {
          w: PORTRAIT, h: PORTRAIT, anchorX: 0.5, anchorY: 0.5, rot: b.rot * 0.6, scaleX: b.sx, scaleY: b.sy,
        });
      }
      const ty = g.y + Math.max(14, (g.h - 4 * C.TEXT_SIZE * G.Text.LINE_HEIGHT) / 2);
      G.Text.draw(page, m.textX, ty, { upTo: upTo, color: dark ? THINK.text : INK });
      if (this.cur && m.typer.done && !(m.opts.auto > 0)) drawContinueMark(ctx, g.x + g.w - 26, g.y + g.h - 10, false);
      ctx.restore();
    },
  };

  /* ====================================================================== ChoiceBox */

  const ChoiceBox = {
    active: null,

    /**
     * Shows a vertical list of options and resolves with the chosen index.
     * @param {string[]} options labels (rich text markup allowed)
     * @param {{cancelIndex?:number, index?:number, x?:number, y?:number}} [o] cancelIndex: index returned
     *   when cancel is pressed (-1/undefined = cancel disabled); index: initially selected option.
     *   Test hook: when window.__game.autoChoice is a number the box picks that option by itself.
     * @returns {Promise<number>}
     */
    show: function (options, o) {
      o = o || {};
      options = (options || []).map(String);
      const self = this;
      return new Promise(function (resolve) {
        const rowH = 36;
        const layouts = options.map(function (s) { return G.Text.layout(s, { size: C.TEXT_SIZE }); });
        let w = 150;
        for (const l of layouts) w = Math.max(w, l.width + 78);
        w = Math.min(w, 560);
        const h = options.length * rowH + 26;
        let x = o.x, y = o.y;
        const msgAtBottom = MessageBox.isOpen() && (MessageBox.cur || MessageBox.ghost).geo.y >= 300 &&
          (MessageBox.cur || MessageBox.ghost).style !== 'narrate';
        if (x == null) x = msgAtBottom ? BOX.x + BOX.w - w : Math.round((C.W - w) / 2);
        if (y == null) y = msgAtBottom ? BOX.y - h - 12 : Math.round((C.H - h) / 2);
        if (self.active) { G.warn('ChoiceBox.show while another choice is open'); self.active.resolve(self.active.cancelIndex); }
        self.active = {
          options: options, layouts: layouts, resolve: resolve, x: x, y: y, w: w, h: h, rowH: rowH,
          index: U.clamp(o.index || 0, 0, Math.max(0, options.length - 1)),
          cancelIndex: o.cancelIndex != null ? o.cancelIndex : -1, age: 0, openT: 0,
        };
      });
    },

    reset: function () {
      const a = this.active;
      this.active = null;
      if (a) { try { a.resolve(a.cancelIndex != null ? a.cancelIndex : -1); } catch (e) { /* nothing */ } }
    },

    _close: function (result) {
      const a = this.active;
      this.active = null;
      a.resolve(result);
    },

    update: function () {
      const a = this.active;
      if (!a) return;
      a.age++;
      a.openT = Math.min(1, a.openT + 0.25);
      const n = a.options.length;
      const auto = window.__game ? window.__game.autoChoice : null;
      if (typeof auto === 'number' && a.age >= 2) { this._close(U.clamp(auto, 0, n - 1)); return; }
      if (a.age < 4 || !n) return;
      if (G.Input.repeated('up')) { a.index = (a.index + n - 1) % n; uiSfx('cursor'); }
      else if (G.Input.repeated('down')) { a.index = (a.index + 1) % n; uiSfx('cursor'); }
      else if (G.Input.pressed('confirm')) { uiSfx('confirm'); this._close(a.index); }
      else if (G.Input.pressed('cancel') && a.cancelIndex >= 0) { uiSfx('cancel'); this._close(a.cancelIndex); }
    },

    draw: function (ctx) {
      const a = this.active;
      if (!a) return;
      const k = U.ease.outBack(a.openT);
      ctx.save();
      ctx.globalAlpha *= U.clamp(a.openT * 1.5, 0, 1);
      ctx.translate(a.x + a.w / 2, a.y + a.h);
      ctx.scale(0.9 + 0.1 * k, 0.8 + 0.2 * k);
      ctx.translate(-(a.x + a.w / 2), -(a.y + a.h));
      G.Gfx.panel(a.x, a.y, a.w, a.h, { seed: 5151 });
      for (let i = 0; i < a.options.length; i++) {
        const ry = a.y + 13 + i * a.rowH;
        pointRow(a.x + 8, ry, a.w - 16, a.rowH, function () {
          if (ChoiceBox.active !== a || a.index === i) return false;
          a.index = i;
          return true;
        });
        if (i === a.index) {
          drawHighlight(ctx, a.x + 40, ry + 3, a.w - 58, a.rowH - 7, 600 + i);
          drawCursor(ctx, a.x + 24, ry + a.rowH / 2);
        }
        G.Text.draw(a.layouts[i], a.x + 46, ry + (a.rowH - a.layouts[i].height) / 2);
      }
      ctx.restore();
    },
  };

  /** Soft yellow highlighter stroke behind the selected row. */
  function drawHighlight(ctx, x, y, w, h, seed) {
    ctx.save();
    ctx.globalAlpha *= 0.5;
    G.Gfx.panel(x, y, w, h, { fill: '#f7d774', stroke: null, shadow: false, radius: h / 2.2, seed: seed, boil: false });
    ctx.restore();
  }

  /** Registers a clickable row with G.Pointer (no-op when the pointer module is absent). */
  function pointRow(x, y, w, h, pick, opts) {
    if (G.Pointer) G.Pointer.target(x, y, w, h, pick, opts);
  }

  /* ====================================================================== ListMenu */

  function normItem(it) {
    if (it && typeof it === 'object') return it;
    return { label: String(it), value: it };
  }

  /**
   * Generic vertical / grid list with a cursor.
   * @param {object} o
   *   x, y, w            position and width (logical px)
   *   h                  optional fixed height (otherwise derived from the rows)
   *   items              array of strings or {label, value, enabled, icon, right, color, help}
   *                      (`enabled:false` greys the row out; `right` = right-aligned text such as a count)
   *   cols=1, rowH=34, visibleRows (scrolls when there are more rows), index=0, wrap=true
   *   title              optional heading drawn in GochiHand
   *   panel=true         draw the paper panel behind the list
   *   active=true        inactive lists draw a dim cursor and ignore input
   *   cancelable=true    whether cancel produces a 'cancel' event
   *   size=22, seed, onSelect(item,index), onCancel(), onChange(item,index)
   * update() returns null or an event {type:'select'|'cancel'|'move'|'disabled', index, item}.
   */
  function ListMenu(o) {
    o = o || {};
    this.x = o.x || 0; this.y = o.y || 0; this.w = o.w || 240;
    this.cols = Math.max(1, o.cols || 1);
    this.rowH = o.rowH || 34;
    this.pad = o.pad != null ? o.pad : 14;
    this.size = o.size || 22;
    this.title = o.title || null;
    this.titleH = this.title ? 40 : 0;
    this.items = (o.items || []).map(normItem);
    this.fixedH = o.h || null;
    this.visibleRows = o.visibleRows || null;
    this.index = o.index || 0;
    this.scroll = 0;
    this.wrap = o.wrap !== false;
    this.active = o.active !== false;
    this.cancelable = o.cancelable !== false;
    this.panel = o.panel !== false;
    this.seed = o.seed != null ? o.seed : (U.hash((this.title || '') + this.w) % 9973);
    this.onSelect = o.onSelect || null;
    this.onCancel = o.onCancel || null;
    this.onChange = o.onChange || null;
    this.age = 0;
    this._clamp();
  }

  /** Total number of rows. */
  ListMenu.prototype.rows = function () {
    return Math.ceil(this.items.length / this.cols);
  };

  /** Number of rows visible at once (the list scrolls when there are more). */
  ListMenu.prototype.shownRows = function () {
    if (this.visibleRows) return this.visibleRows;
    if (this.fixedH) return Math.max(1, Math.floor((this.fixedH - 2 * this.pad - this.titleH) / this.rowH));
    return Math.max(1, this.rows());
  };

  Object.defineProperty(ListMenu.prototype, 'h', {
    get: function () { return this.fixedH || this.shownRows() * this.rowH + 2 * this.pad + this.titleH; },
  });

  /** The currently highlighted item (or null). */
  ListMenu.prototype.current = function () {
    return this.items[this.index] || null;
  };

  /** Replaces the items. keepIndex keeps the cursor where it was (clamped). */
  ListMenu.prototype.setItems = function (items, keepIndex) {
    this.items = (items || []).map(normItem);
    if (!keepIndex) { this.index = 0; this.scroll = 0; }
    this._clamp();
  };

  /** Moves the cursor to an index. */
  ListMenu.prototype.select = function (i) {
    this.index = i;
    this._clamp();
  };

  ListMenu.prototype._clamp = function () {
    const n = this.items.length;
    this.index = n ? U.clamp(this.index | 0, 0, n - 1) : 0;
    const row = Math.floor(this.index / this.cols);
    const vis = this.shownRows();
    if (row < this.scroll) this.scroll = row;
    if (row >= this.scroll + vis) this.scroll = row - vis + 1;
    this.scroll = U.clamp(this.scroll, 0, Math.max(0, this.rows() - vis));
  };

  ListMenu.prototype._isEnabled = function (it) {
    return !!it && it.enabled !== false && it.disabled !== true;
  };

  /** Handles input for one frame. Returns an event object or null. */
  ListMenu.prototype.update = function () {
    this.age++;
    if (!this.active) return null;
    const n = this.items.length;
    const I = G.Input;
    let moved = 0;
    if (n > 0) {
      if (I.repeated('down')) moved = this.cols;
      else if (I.repeated('up')) moved = -this.cols;
      else if (this.cols > 1 && I.repeated('right')) moved = 1;
      else if (this.cols > 1 && I.repeated('left')) moved = -1;
    }
    if (moved) {
      let next = this.index + moved;
      if (next < 0 || next >= n) {
        if (!this.wrap) next = U.clamp(next, 0, n - 1);
        else if (Math.abs(moved) === 1) next = (next + n) % n;
        else {
          const col = this.index % this.cols;
          if (moved > 0) next = col;
          else { next = (this.rows() - 1) * this.cols + col; if (next >= n) next -= this.cols; }
          next = U.clamp(next, 0, n - 1);
        }
      }
      if (next !== this.index) {
        this.index = next;
        this._clamp();
        uiSfx('cursor');
        if (this.onChange) this.onChange(this.current(), this.index);
        return { type: 'move', index: this.index, item: this.current() };
      }
      return null;
    }
    if (I.pressed('confirm') && n > 0) {
      const it = this.current();
      if (!this._isEnabled(it)) { uiSfx('buzzer'); return { type: 'disabled', index: this.index, item: it }; }
      uiSfx('confirm');
      if (this.onSelect) this.onSelect(it, this.index);
      return { type: 'select', index: this.index, item: it };
    }
    if (I.pressed('cancel') && this.cancelable) {
      uiSfx('cancel');
      if (this.onCancel) this.onCancel();
      return { type: 'cancel', index: this.index, item: this.current() };
    }
    return null;
  };

  /** Draws the list. */
  ListMenu.prototype.draw = function (ctx) {
    ctx = ctx || G.Gfx.ctx;
    const h = this.h;
    if (this.panel) G.Gfx.panel(this.x, this.y, this.w, h, { seed: this.seed });
    let top = this.y + this.pad;
    if (this.title) {
      G.Gfx.text(this.title, this.x + this.pad + 6, top - 4, { size: 26, font: 'title' });
      G.Gfx.line(this.x + this.pad, top + 29, this.x + this.w - this.pad, top + 29, { width: 1.6, alpha: 0.55, seed: this.seed + 5 });
      top += this.titleH;
    }
    const vis = this.shownRows();
    const colW = (this.w - 2 * this.pad) / this.cols;
    const first = this.scroll * this.cols;
    const last = Math.min(this.items.length, first + vis * this.cols);
    for (let i = first; i < last; i++) {
      const it = this.items[i];
      const col = i % this.cols, row = Math.floor(i / this.cols) - this.scroll;
      const rx = this.x + this.pad + col * colW;
      const ry = top + row * this.rowH;
      const enabled = this._isEnabled(it);
      let tx = rx + 30;
      if (this.active) {
        const self = this;
        pointRow(rx, ry, colW, this.rowH, function () {
          if (!self.active || self.index === i || i >= self.items.length) return false;
          self.index = i;
          self._clamp();
          if (self.onChange) self.onChange(self.current(), self.index);
          return true;
        });
      }
      if (i === this.index) {
        drawHighlight(ctx, rx + 24, ry + 3, colW - 28, this.rowH - 6, this.seed + i);
        drawCursor(ctx, rx + 13, ry + this.rowH / 2, { alpha: this.active ? 1 : 0.4, still: !this.active });
      }
      ctx.save();
      if (!enabled) ctx.globalAlpha *= 0.4;
      if (it.icon && G.Assets.has(it.icon)) {
        G.Gfx.drawImg(it.icon, tx, ry + this.rowH / 2, { w: 26, h: 26, anchorY: 0.5 });
        tx += 30;
      }
      let rightW = 0;
      if (it.right != null) {
        const rs = String(it.right);
        rightW = G.Gfx.measure(rs, { size: this.size }).w + 10;
        G.Gfx.text(rs, rx + colW - 10, ry + this.rowH / 2, { size: this.size, align: 'right', baseline: 'middle', color: C.COLORS.inkSoft });
      }
      const lay = G.Text.layout(String(it.label == null ? '' : it.label), { size: this.size });
      const avail = rx + colW - 8 - rightW - tx;
      if (lay.width > avail && avail > 20) {
        ctx.translate(tx, 0); ctx.scale(avail / lay.width, 1); ctx.translate(-tx, 0);
      }
      G.Text.draw(lay, tx, ry + (this.rowH - lay.height) / 2, { color: it.color || INK });
      ctx.restore();
    }
    // scroll hints
    const bob = Math.sin(G.Gfx.frame * 0.12) * 1.5;
    ctx.save();
    ctx.fillStyle = INK;
    if (this.scroll > 0) {
      const ax = this.x + this.w / 2, ay = top - 1 + bob;
      ctx.beginPath(); ctx.moveTo(ax - 7, ay + 4); ctx.lineTo(ax + 7, ay + 4); ctx.lineTo(ax, ay - 4); ctx.closePath(); ctx.fill();
    }
    if (this.scroll + vis < this.rows()) {
      const ax = this.x + this.w / 2, ay = top + vis * this.rowH + 4 - bob;
      ctx.beginPath(); ctx.moveTo(ax - 7, ay - 4); ctx.lineTo(ax + 7, ay - 4); ctx.lineTo(ax, ay + 4); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };

  /* ====================================================================== Gauge */

  /**
   * Crayon-filled meter with a pencil outline.
   * @param {object} o x, y, w=120, h=14, color, back, value, max, label (drawn left of the bar; `w` includes
   *   it), labelColor, showNumbers (draws "value/max" right-aligned above the bar), seed
   * Use set(value,max) then call update() each frame for a smooth slide, draw(ctx[,x,y]) to render.
   */
  function Gauge(o) {
    o = o || {};
    this.x = o.x || 0; this.y = o.y || 0; this.w = o.w || 120; this.h = o.h || 14;
    this.color = o.color || C.COLORS.accent;
    this.back = o.back || '#e6dcc3';
    this.max = o.max != null ? o.max : 1;
    this.value = o.value != null ? o.value : this.max;
    this.shown = this.value;
    this.trail = this.value;
    this.label = o.label || null;
    this.labelColor = o.labelColor || INK;
    this.showNumbers = !!o.showNumbers;
    this.seed = o.seed != null ? o.seed : 77;
    this.hold = 0;
  }

  /** Sets the target value (and optionally max). instant=true skips the slide animation. */
  Gauge.prototype.set = function (value, max, instant) {
    if (max != null) this.max = max;
    const v = U.clamp(value, 0, this.max);
    if (v < this.value) this.hold = 24;
    this.value = v;
    if (instant) { this.shown = v; this.trail = v; }
  };

  /** Animates the displayed value toward the target. */
  Gauge.prototype.update = function () {
    const step = Math.max(this.max / 90, Math.abs(this.value - this.shown) * 0.18);
    if (Math.abs(this.value - this.shown) <= step) this.shown = this.value;
    else this.shown += Math.sign(this.value - this.shown) * step;
    if (this.hold > 0) this.hold--;
    else if (this.trail > this.shown) this.trail = Math.max(this.shown, this.trail - Math.max(this.max / 70, (this.trail - this.shown) * 0.12));
    if (this.trail < this.shown) this.trail = this.shown;
  };

  /** Draws the gauge at its own position or at (x, y) when given. */
  Gauge.prototype.draw = function (ctx, x, y) {
    x = x != null ? x : this.x; y = y != null ? y : this.y;
    let bx = x;
    if (this.label) {
      G.Gfx.text(this.label, x, y + this.h / 2, { size: 18, baseline: 'middle', color: this.labelColor });
      bx = x + G.Gfx.measure(this.label, { size: 18 }).w + 8;
    }
    const bw = this.w - (bx - x);
    Gauge.draw(ctx, bx, y, bw, this.h, this.max > 0 ? this.shown / this.max : 0, {
      color: this.color, back: this.back, seed: this.seed, trail: this.max > 0 ? this.trail / this.max : 0,
    });
    if (this.showNumbers) {
      G.Gfx.text(Math.round(this.shown) + '/' + this.max, bx + bw - 2, y - 3, { size: 16, align: 'right', baseline: 'bottom', outline: true });
    }
  };

  /**
   * Stateless gauge drawing.
   * @param {number} ratio 0..1
   * @param {{color?:string, back?:string, seed?:number, trail?:number}} [o] trail = lighter "recent damage" ratio
   */
  Gauge.draw = function (ctx, x, y, w, h, ratio, o) {
    o = o || {};
    ctx = ctx || G.Gfx.ctx;
    ratio = U.clamp(ratio || 0, 0, 1);
    const seed = o.seed != null ? o.seed : 77;
    const r = Math.min(h / 2, 7);
    G.Gfx.panel(x, y, w, h, { fill: o.back || '#e6dcc3', stroke: null, shadow: false, radius: r, seed: seed, boil: false });
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y - 2, w, h + 4);
    ctx.clip();
    const inner = function (k, color, alpha) {
      if (k <= 0) return;
      const fw = Math.max(3, (w - 2) * k);
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.beginPath();
      ctx.rect(x, y - 2, fw + 1, h + 4);
      ctx.clip();
      G.Gfx.panel(x + 1, y + 1, w - 2, h - 2, { fill: color, stroke: null, shadow: false, radius: r, seed: seed + 1, boil: false });
      ctx.restore();
    };
    if (o.trail != null && o.trail > ratio) inner(o.trail, '#fff1b8', 0.95);
    inner(ratio, o.color || C.COLORS.accent, 1);
    // crayon hatching
    if (ratio > 0) {
      ctx.beginPath();
      ctx.rect(x + 1, y + 1, (w - 2) * ratio, h - 2);
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let d = -h; d < w; d += 7) { ctx.moveTo(x + d, y + h); ctx.lineTo(x + d + h, y); }
      ctx.stroke();
    }
    ctx.restore();
    G.Gfx.panel(x, y, w, h, { fill: null, radius: r, seed: seed, lineWidth: 2 });
  };

  /* ====================================================================== Toast */

  const Toast = {
    list: [],

    /**
     * Small non-blocking notification at the top of the screen (item get, map name).
     * @param {string} text rich text allowed
     * @param {{icon?:string, frames?:number, sfx?:string, title?:boolean}} [o] icon = image id drawn 28x28;
     *   frames = how long it stays (default 150); sfx = sound id to play; title = GochiHand heading style
     */
    show: function (text, o) {
      o = o || {};
      const size = o.title ? 28 : 22;
      const lay = G.Text.layout(String(text), { size: size, font: o.title ? 'title' : 'body', maxWidth: 560 });
      const icon = o.icon && G.Assets.has(o.icon) ? o.icon : null;
      this.list.push({
        lay: lay, icon: icon, t: 0, frames: o.frames || 150,
        w: Math.round(lay.width + 44 + (icon ? 36 : 0)), h: Math.round(lay.height + 18), y: -60, seed: 800 + (this.list.length % 7),
      });
      if (this.list.length > 5) this.list.shift();
      if (o.sfx) G.Audio.playSfx(o.sfx);
    },

    reset: function () { this.list.length = 0; },

    update: function () {
      let y = 14;
      for (let i = 0; i < this.list.length; i++) {
        const t = this.list[i];
        t.t++;
        const target = y;
        t.y = t.t === 1 ? target - 40 : t.y + (target - t.y) * 0.25;
        y += t.h + 8;
      }
      this.list = this.list.filter(function (t) { return t.t < t.frames + 20; });
    },

    draw: function (ctx) {
      for (const t of this.list) {
        const a = Math.min(1, t.t / 10) * U.clamp((t.frames + 20 - t.t) / 20, 0, 1);
        const x = Math.round((C.W - t.w) / 2);
        ctx.save();
        ctx.globalAlpha *= a;
        G.Gfx.panel(x, t.y, t.w, t.h, { seed: t.seed });
        let tx = x + 22;
        if (t.icon) { G.Gfx.drawImg(t.icon, tx - 4, t.y + t.h / 2, { w: 28, h: 28, anchorY: 0.5 }); tx += 34; }
        G.Text.draw(t.lay, tx, t.y + (t.h - t.lay.height) / 2);
        ctx.restore();
      }
    },
  };

  /* ====================================================================== module */

  G.UI = {
    MessageBox: MessageBox,
    ChoiceBox: ChoiceBox,
    ListMenu: ListMenu,
    Gauge: Gauge,
    Toast: Toast,
    BOX: BOX,
    drawCursor: drawCursor,
    drawContinueMark: drawContinueMark,
    drawHighlight: drawHighlight,
    /** G.Pointer.target when the pointer module is loaded (menus call this for every clickable row). */
    pointRow: pointRow,
    /** Luggage tag (the game's button): see drawTag above. Used by every menu and the title screen. */
    drawTag: drawTag,
    /** A short sagging piece of hand-drawn string. */
    drawString: drawStringLine,
    /** Wobbly closed pencil path through a point list (builds the path, does not paint it). */
    wobblyPath: wobblyPath,
    sfx: uiSfx,

    /** True while a message or choice box is open; the main loop then hides input from scenes. */
    isModal: function () {
      return MessageBox.isBusy() || !!ChoiceBox.active;
    },

    /** Steps the overlay widgets. Called by the main loop once per fixed step, before the scene update. */
    update: function () {
      Toast.update();
      if (ChoiceBox.active) { ChoiceBox.update(); MessageBox.update(true); }
      else MessageBox.update(false);
    },

    /** Draws the overlay widgets. Called by the main loop after G.Gfx.drawEffects(). */
    draw: function (ctx) {
      ctx = ctx || G.Gfx.ctx;
      if (G.Pointer) {
        G.Pointer.layer(true);
        if (this.isModal()) G.Pointer.clear();          // an open box owns the mouse: nothing under it is clickable
      }
      MessageBox.draw(ctx);
      ChoiceBox.draw(ctx);
      Toast.draw(ctx);
    },

    /** Closes everything without resolving pending promises (title screen, new game, load). */
    reset: function () {
      MessageBox.reset(); ChoiceBox.reset(); Toast.reset();
    },
  };
})();
