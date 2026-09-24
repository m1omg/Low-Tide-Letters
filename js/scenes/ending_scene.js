/*
 * ending_scene.js - scene 'ending': plays G.DATA.endings[id] (see js/data/endings.js for the schema)
 * and then rolls the credits from js/data/credits.js.
 *
 * Entered with ['ending','ending_id'] (the interpreter does G.Scenes.clearTo('ending', {id})).
 * Each page is a full-screen illustration (or a code-drawn colour wash when the cg does not exist yet)
 * with one of three text looks: 'narrate' (a centred italic caption low on the screen), 'letter' (words
 * on a ruled paper sheet) or 'plain' (big GochiHand words in the middle).
 *
 * Controls: confirm finishes the typing and then turns the page; a page with waitFrames turns by itself.
 * During the credits, confirm scrolls faster and cancel skips to the end.
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CONFIG;
  const U = G.Util;
  const INK = C.COLORS.ink;
  const SOFT = C.COLORS.inkSoft;

  function K() { return G.SceneKit; }

  /** Two seeded colours for a missing illustration - a sea-and-sky wash, never a placeholder box. */
  function washColors(id) {
    const palettes = [
      ['#e9eef0', '#cfdcd9'], ['#f2e6cf', '#dcc8a6'], ['#e2e6f2', '#c3cadd'],
      ['#f0e4e4', '#d9c3c3'], ['#e6efe4', '#c7d8c4'],
    ];
    return palettes[U.hash(String(id || 'ending')) % palettes.length];
  }

  const Ending = {
    opaque: true,

    enter: function (params) {
      params = params || {};
      G.SceneKit.installHooks();
      G.UI.reset();
      G.Gfx.resetEffects();
      this.id = params.id || null;
      this.data = (G.DATA.endings && G.DATA.endings[this.id]) || null;
      if (!this.data) {
        G.warn('Ending scene: unknown ending "' + this.id + '"');
        this.data = { bgm: null, pages: [], credits: true, after: 'title' };
      }
      this.pages = this.data.pages || [];
      this.pageIndex = -1;
      this.phase = 'page';                  // 'page' | 'credits' | 'done'
      this.t = 0;
      this.fadeT = 0;
      this.scroll = 0;
      this.skipping = false;
      this.finished = false;
      K().bgm(this.data.bgm || null);
      G.Gfx.setFade(1, 'black');
      this._nextPage(true);
      G.Gfx.fadeIn(40);
    },

    exit: function () {},

    /* ---------------------------------------------------------------- pages */

    _nextPage: function (first) {
      this.pageIndex++;
      if (this.pageIndex >= this.pages.length) {
        if (this.data.credits) this._startCredits();
        else this._finish();
        return;
      }
      const p = this.pages[this.pageIndex] || {};
      this.t = 0;
      this.fadeT = first ? 0 : (p.fade == null ? 24 : p.fade);
      this.fadeMax = Math.max(1, this.fadeT);
      const width = p.style === 'letter' ? 470 : 600;
      this.layout = G.Text.layout(String(p.text || ''), {
        maxWidth: width, size: p.style === 'plain' ? 34 : 24,
        font: p.style === 'plain' ? 'title' : 'body', italic: p.style === 'narrate',
      });
      this.reveal = 0;
      this.revealTo = this.layout.count || 0;
      if (p.sfx) K().sfx(p.sfx);
    },

    _startCredits: function () {
      this.phase = 'credits';
      this.t = 0;
      this.scroll = 0;
      this.creditBlocks = this._buildCredits();
      this.creditEnd = this.creditHeight + C.H * 0.5;
    },

    /** Flattens G.DATA.credits into drawable lines with their heights. */
    _buildCredits: function () {
      const data = G.DATA.credits || { title: K().gameTitle(), blocks: [] };
      const out = [];
      let y = 0;
      out.push({ kind: 'title', text: data.title || K().gameTitle(), y: y, size: 46 });
      y += 90;
      for (const b of data.blocks || []) {
        if (b.gap) { y += b.gap; continue; }
        if (b.big) { out.push({ kind: 'big', text: b.big, y: y, size: 32 }); y += 52; continue; }
        if (b.head) { out.push({ kind: 'head', text: b.head, y: y, size: 26 }); y += 38; }
        for (const l of b.lines || []) { out.push({ kind: 'line', text: l, y: y, size: 21 }); y += 30; }
      }
      this.creditHeight = y;
      this.creditSpeed = (data.speed || 0.55);
      return out;
    },

    _finish: function () {
      if (this.finished) return;
      this.finished = true;
      this.phase = 'done';
      const after = this.data.after || 'title';
      G.Gfx.fadeOut(40).then(function () {
        G.UI.reset();
        if (after === 'title' && G.Scenes.has('title')) G.Scenes.clearTo('title', {});
        else G.Scenes.pop({ ending: true });
      });
    },

    /* ---------------------------------------------------------------- input */

    update: function () {
      this.t++;
      if (this.fadeT > 0) this.fadeT--;
      if (this.phase === 'done') return;
      if (this.phase === 'credits') {
        const fast = G.Input.isDown('confirm') ? 4 : 1;
        this.scroll += this.creditSpeed * fast * (this.skipping ? 12 : 1);
        if (G.Input.pressed('cancel')) this.skipping = true;
        if (this.scroll >= this.creditEnd) this._finish();
        return;
      }
      const p = this.pages[this.pageIndex] || {};
      const speed = window.__game && window.__game.skipText ? 999 : 1.6;
      if (this.reveal < this.revealTo) this.reveal += speed;
      const typed = this.reveal >= this.revealTo;
      if (G.Input.pressed('confirm')) {
        if (!typed) { this.reveal = this.revealTo; return; }
        this._nextPage(false);
        return;
      }
      if (typed && p.waitFrames > 0 && this.t >= p.waitFrames) this._nextPage(false);
    },

    /* ---------------------------------------------------------------- drawing */

    draw: function (ctx) {
      if (this.phase === 'credits') { this._drawCredits(ctx); return; }
      const p = this.pages[this.pageIndex];
      if (!p) { ctx.fillStyle = '#0d0c12'; ctx.fillRect(0, 0, C.W, C.H); return; }
      this._drawPicture(ctx, p.cg);
      const a = this.fadeMax ? 1 - this.fadeT / this.fadeMax : 1;
      ctx.save();
      ctx.globalAlpha *= U.clamp(a, 0, 1);
      if (p.style === 'letter') this._drawLetter(ctx);
      else if (p.style === 'plain') this._drawPlain(ctx);
      else this._drawNarrate(ctx);
      ctx.restore();
    },

    _drawPicture: function (ctx, cg) {
      if (cg && G.Assets.has(cg)) {
        const b = G.Gfx.boil(cg);
        G.Gfx.drawImg(cg, C.W / 2 + b.dx, C.H / 2 + b.dy, {
          w: C.W + 6, h: C.H + 6, anchorX: 0.5, anchorY: 0.5, rot: b.rot * 0.25, scaleX: b.sx, scaleY: b.sy,
        });
        return;
      }
      const cols = washColors(cg || this.id);
      const g = ctx.createLinearGradient(0, 0, 0, C.H);
      g.addColorStop(0, cols[0]);
      g.addColorStop(1, cols[1]);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, C.W, C.H);
      // a horizon and a few water strokes so the screen still looks drawn
      G.Gfx.line(0, 300, C.W, 297, { width: 1.6, alpha: 0.4, seed: 5001, color: '#8fa8ad' });
      ctx.save();
      ctx.globalAlpha *= 0.34;
      for (let i = 0; i < 12; i++) {
        const y = 316 + i * 13;
        const w = 60 + ((U.noise(12, i) + 1) / 2) * 180;
        const x = ((U.noise(13, i) + 1) / 2) * (C.W - w);
        G.Gfx.line(x, y, x + w, y, { width: 1.3, seed: 5100 + i, color: '#7fa0a6' });
      }
      ctx.restore();
      K().sand(ctx, C.H - 46, 23);
    },

    _drawNarrate: function (ctx) {
      const lay = this.layout;
      const w = Math.min(C.W - 80, lay.width + 84);
      const h = lay.height + 40;
      const x = Math.round((C.W - w) / 2), y = C.H - h - 52;
      G.Gfx.panel(x, y, w, h, { seed: 5200, fill: 'rgba(253,248,234,0.93)' });
      G.Text.draw(lay, x, y + 20, { upTo: this.reveal, align: 'center', width: w, color: INK });
    },

    _drawPlain: function (ctx) {
      const lay = this.layout;
      const x = Math.round((C.W - lay.width) / 2);
      const y = Math.round((C.H - lay.height) / 2);
      ctx.save();
      ctx.globalAlpha *= 0.55;
      G.Gfx.panel(x - 40, y - 26, lay.width + 80, lay.height + 52, { seed: 5300, fill: '#fdf8ea', stroke: null });
      ctx.restore();
      G.Text.draw(lay, x, y, { upTo: this.reveal, color: INK });
    },

    _drawLetter: function (ctx) {
      const lay = this.layout;
      const w = 540, h = Math.max(300, lay.height + 130);
      const x = Math.round((C.W - w) / 2), y = Math.round((C.H - h) / 2);
      G.Gfx.panel(x, y, w, h, { seed: 5400, fill: '#fffdf2' });
      ctx.save();
      ctx.globalAlpha *= 0.4;
      for (let i = 0; i < Math.floor((h - 60) / 30); i++) {
        G.Gfx.line(x + 30, y + 74 + i * 30, x + w - 30, y + 74 + i * 30, { width: 1, seed: 5410 + i, color: '#9fb6c8' });
      }
      ctx.restore();
      G.Text.draw(lay, x + 36, y + 56, { upTo: this.reveal, color: '#3a3444' });
    },

    _drawCredits: function (ctx) {
      ctx.fillStyle = '#f3ecdb';
      ctx.fillRect(0, 0, C.W, C.H);
      if (G.Assets.has('cg_credits_gulls')) {
        // the T3 illustration, washed back so the names stay readable over it
        ctx.save();
        ctx.globalAlpha *= 0.45;
        G.Gfx.drawImg('cg_credits_gulls', C.W / 2, C.H / 2, { w: C.W + 6, h: C.H + 6, anchorX: 0.5, anchorY: 0.5 });
        ctx.restore();
      } else {
        K().sand(ctx, C.H - 30, 31);
      }
      // paper gulls drifting past
      ctx.save();
      ctx.globalAlpha *= G.Assets.has('cg_credits_gulls') ? 0.2 : 0.35;
      ctx.strokeStyle = '#8b96a0';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        const gx = ((this.t * (0.3 + i * 0.09) + i * 173) % (C.W + 80)) - 40;
        const gy = 60 + i * 74 + Math.sin(this.t * 0.02 + i) * 8;
        const s = 0.7 + i * 0.12;
        ctx.beginPath();
        ctx.moveTo(gx - 10 * s, gy);
        ctx.quadraticCurveTo(gx - 4 * s, gy - 6 * s, gx, gy - 1 * s);
        ctx.quadraticCurveTo(gx + 4 * s, gy - 6 * s, gx + 10 * s, gy);
        ctx.stroke();
      }
      ctx.restore();

      const top = C.H * 0.72 - this.scroll;
      for (const b of this.creditBlocks) {
        const y = top + b.y;
        if (y < -60 || y > C.H + 20) continue;
        if (b.kind === 'title') G.Gfx.text(b.text, C.W / 2, y, { size: b.size, font: 'title', align: 'center', color: INK });
        else if (b.kind === 'head') G.Gfx.text(b.text, C.W / 2, y, { size: b.size, font: 'title', align: 'center', color: '#5c6a74' });
        else if (b.kind === 'big') G.Gfx.text(b.text, C.W / 2, y, { size: b.size, font: 'title', align: 'center', color: INK });
        else G.Gfx.text(b.text, C.W / 2, y, { size: b.size, align: 'center', color: INK });
      }
      G.Gfx.text('X: skip', C.W - 20, C.H - 14, { size: 16, align: 'right', baseline: 'bottom', color: SOFT });
    },
  };

  G.Scenes.register('ending', Ending);
})();
