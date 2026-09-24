/*
 * shop_scene.js - scene 'shop' (DESIGN_BIBLE section 7). Opened by ['shop',['item_id',...]].
 *
 * Params: { items:['bag_of_chips', ...],      what is for sale, in that order
 *           name:'Shelley\'s Postbox',        heading (optional)
 *           speaker:'shelley',                whose one-liners these are (optional, for the name tag)
 *           lines:['No refunds. ...'] }       one-liners: the first is shown on entry, the next one
 *                                             after every purchase (optional)
 *
 * Buying spends Stamps (G.State.money). The quantity picker is capped by what the player can afford.
 * Resolves with { spent:n, bought:{id:count} }.
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CONFIG;
  const U = G.Util;
  const INK = C.COLORS.ink;
  const SOFT = C.COLORS.inkSoft;

  const LIST = { x: 28, y: 96, w: 404, h: 380 };
  const INFO = { x: 444, y: 96, w: 296, h: 380 };

  function K() { return G.SceneKit; }

  function priceOf(id) {
    const d = K().itemDef(id);
    return d && d.price ? d.price : 10;
  }

  const Shop = {
    opaque: false,

    enter: function (params) {
      params = params || {};
      G.SceneKit.installHooks();
      this.items = (params.items || []).slice();
      this.name = params.name || 'Shop';
      this.speaker = params.speaker || null;
      this.lines = (params.lines || []).slice();
      this.lineIndex = 0;
      this.index = 0;
      this.qty = 0;                       // 0 = browsing, >0 = choosing how many
      this.t = 0;
      this.spent = 0;
      this.bought = {};
      if (!this.items.length) G.warn('Shop: opened with no items');
      G.UI.sfx('menuOpen');
      K().sfx('sfx_bell', { volume: 0.6 });
    },

    exit: function () {},

    resume: function () { G.Input.reset(); },

    /* ---------------------------------------------------------------- input */

    update: function () {
      this.t++;
      if (this.t < 3) return;
      const n = this.items.length;
      if (this.qty > 0) {
        const id = this.items[this.index];
        const max = this._maxAffordable(id);
        if (G.Input.repeated('right') || G.Input.repeated('up')) { this.qty = U.clamp(this.qty + 1, 1, max); G.UI.sfx('cursor'); }
        else if (G.Input.repeated('left') || G.Input.repeated('down')) { this.qty = U.clamp(this.qty - 1, 1, max); G.UI.sfx('cursor'); }
        else if (G.Input.pressed('cancel')) { this.qty = 0; G.UI.sfx('cancel'); }
        else if (G.Input.pressed('confirm')) this._buy(id, this.qty);
        return;
      }
      if (n && (G.Input.repeated('down') || G.Input.repeated('up'))) {
        const d = G.Input.repeated('down') ? 1 : -1;
        this.index = (this.index + d + n) % n;
        G.UI.sfx('cursor');
      } else if (G.Input.pressed('confirm') && n) {
        const id = this.items[this.index];
        if (this._maxAffordable(id) < 1) { G.UI.sfx('buzzer'); this._nextLine("That's more than you've got."); return; }
        G.UI.sfx('confirm');
        this.qty = 1;
      } else if (G.Input.pressed('cancel')) {
        G.UI.sfx('cancel');
        G.Scenes.pop({ spent: this.spent, bought: this.bought });
      }
    },

    _maxAffordable: function (id) {
      const p = priceOf(id);
      return p > 0 ? Math.min(99, Math.floor(K().money() / p)) : 99;
    },

    _buy: function (id, n) {
      const cost = priceOf(id) * n;
      if (cost > K().money()) { G.UI.sfx('buzzer'); return; }
      G.State.addMoney(-cost);
      G.State.addItem(id, n);
      this.spent += cost;
      this.bought[id] = (this.bought[id] || 0) + n;
      this.qty = 0;
      K().sfx('sfx_coin');
      G.UI.Toast.show(K().itemName(id) + (n > 1 ? ' x' + n : ''), { icon: K().itemIcon(id), frames: 90 });
      this._nextLine(null);
    },

    /** Steps the shopkeeper's one-liners on (or shows a one-off remark). */
    _nextLine: function (oneOff) {
      if (oneOff) { this.oneOff = oneOff; this.oneOffT = 150; return; }
      if (this.lines.length > 1) this.lineIndex = (this.lineIndex + 1) % this.lines.length;
    },

    /* ---------------------------------------------------------------- drawing */

    draw: function (ctx) {
      K().dim(ctx, 0.45);
      G.Gfx.panel(14, 12, C.W - 28, C.H - 24, { seed: 3300, fill: '#f2e8d4' });
      G.Gfx.text(this.name, 34, 28, { size: 30, font: 'title' });
      // purse
      K().stamp(ctx, C.W - 150, 44, 26);
      G.Gfx.text(K().money() + ' ' + K().currency(), C.W - 132, 32, { size: 24 });
      G.Gfx.line(30, 78, C.W - 30, 78, { width: 1.6, alpha: 0.5, seed: 3301 });

      this._drawList(ctx);
      this._drawInfo(ctx);

      if (this.oneOffT > 0) this.oneOffT--;
      const line = this.oneOffT > 0 ? this.oneOff : this.lines[this.lineIndex];
      if (line) {
        const y = C.H - 82;
        G.Gfx.panel(28, y, C.W - 56, 58, { seed: 3302, fill: '#fdf8ea' });
        if (this.speaker) {
          const sp = G.DATA.speakers && G.DATA.speakers[this.speaker];
          G.UI.drawTag(ctx, 44, y - 22, 132, 34, {
            color: (sp && sp.color) || SOFT, label: (sp && sp.name) || this.speaker, size: 19, seed: 3303,
            tieX: 36, tieY: y + 6, sag: 4,
          });
        }
        G.Gfx.text('"' + line + '"', 60, y + 16, { size: 20, maxWidth: C.W - 130 });
      }
      const ok = G.Input.keysFor('confirm', 1), back = G.Input.keysFor('cancel', 1);
      G.Gfx.text(this.qty > 0 ? '← → how many     ' + ok + ': buy     ' + back + ': back' : ok + ': buy     ' + back + ': leave',
        C.W - 36, C.H - 18, { size: 17, align: 'right', baseline: 'bottom', color: SOFT });
    },

    _drawList: function (ctx) {
      G.Gfx.panel(LIST.x, LIST.y, LIST.w, LIST.h, { seed: 3400, fill: '#fdf8ea' });
      const rowH = 36;
      const rows = Math.floor((LIST.h - 20) / rowH);
      const first = U.clamp(this.index - Math.floor(rows / 2), 0, Math.max(0, this.items.length - rows));
      for (let i = first; i < Math.min(this.items.length, first + rows); i++) {
        const id = this.items[i];
        const ry = LIST.y + 10 + (i - first) * rowH;
        const sel = i === this.index;
        const afford = this._maxAffordable(id) >= 1;
        if (sel) G.UI.drawHighlight(ctx, LIST.x + 18, ry + 2, LIST.w - 40, rowH - 8, 3500 + i);
        if (sel && this.qty === 0) G.UI.drawCursor(ctx, LIST.x + 12, ry + rowH / 2);
        const self = this;
        G.UI.pointRow(LIST.x + 6, ry, LIST.w - 12, rowH, function () {
          if (self.qty > 0 || self.index === i) return false;
          self.index = i;
          return true;
        }, { confirm: this.qty === 0 });
        ctx.save();
        if (!afford) ctx.globalAlpha *= 0.5;
        const icon = K().itemIcon(id);
        let tx = LIST.x + 28;
        if (icon) { G.Gfx.drawImg(icon, tx, ry + rowH / 2, { w: 26, h: 26, anchorY: 0.5 }); tx += 32; }
        G.Gfx.text(K().itemName(id), tx, ry + rowH / 2, { size: 21, baseline: 'middle' });
        const owned = G.State.itemCount(id);
        if (owned) G.Gfx.text('have ' + owned, LIST.x + LIST.w - 96, ry + rowH / 2, { size: 16, align: 'right', baseline: 'middle', color: SOFT });
        G.Gfx.text(String(priceOf(id)), LIST.x + LIST.w - 22, ry + rowH / 2, { size: 21, align: 'right', baseline: 'middle' });
        ctx.restore();
      }
      if (!this.items.length) G.Gfx.text('Nothing on the shelf.', LIST.x + 24, LIST.y + 24, { size: 21, color: SOFT });
    },

    _drawInfo: function (ctx) {
      G.Gfx.panel(INFO.x, INFO.y, INFO.w, INFO.h, { seed: 3600, fill: '#fdf8ea' });
      const id = this.items[this.index];
      if (!id) return;
      const def = K().itemDef(id);
      const icon = K().itemIcon(id);
      const cx = INFO.x + INFO.w / 2;
      G.Gfx.panel(cx - 38, INFO.y + 16, 76, 76, { seed: 3601, fill: C.COLORS.paperShade, shadow: false });
      if (icon) G.Gfx.drawImg(icon, cx, INFO.y + 54, { w: 60, h: 60, anchorX: 0.5, anchorY: 0.5 });
      else K().glass(ctx, cx, INFO.y + 54, { c: 'amber', t: true }, 44);
      G.Gfx.text(K().itemName(id), cx, INFO.y + 100, { size: 24, font: 'title', align: 'center' });
      G.Text.drawRich(def && def.desc ? def.desc : '', INFO.x + 18, INFO.y + 136, { maxWidth: INFO.w - 36, size: 19 });
      if (def && def.flavor) {
        G.Gfx.text('"' + def.flavor + '"', INFO.x + 18, INFO.y + 216, {
          size: 17, color: SOFT, italic: true, maxWidth: INFO.w - 36,
        });
      }
      const p = priceOf(id);
      if (this.qty > 0) {
        const y = INFO.y + INFO.h - 92;
        G.Gfx.panel(INFO.x + 16, y, INFO.w - 32, 76, { seed: 3602, fill: C.COLORS.paperShade, shadow: false });
        G.Gfx.text('◀  ' + this.qty + '  ▶', INFO.x + INFO.w / 2, y + 12, { size: 26, font: 'title', align: 'center' });
        // the quantity: click the left half for fewer, the right half for more; the price line buys
        const self = this, cx = INFO.x + INFO.w / 2;
        G.UI.pointRow(INFO.x + 16, y, INFO.w - 32, 40, null, {
          click: function (px) {
            const max = self._maxAffordable(id);
            self.qty = U.clamp(self.qty + (px < cx ? -1 : 1), 1, Math.max(1, max));
            G.UI.sfx('cursor');
          },
        });
        G.UI.pointRow(INFO.x + 16, y + 40, INFO.w - 32, 36, null, {
          click: function () { if (self.qty > 0) self._buy(id, self.qty); },
        });
        G.Gfx.text(p * this.qty + ' ' + K().currency(), INFO.x + INFO.w / 2, y + 46,
          { size: 20, align: 'center', color: INK });
      } else {
        G.Gfx.text(p + ' ' + K().currency(), INFO.x + INFO.w / 2, INFO.y + INFO.h - 44,
          { size: 22, align: 'center', color: SOFT });
      }
    },
  };

  G.Scenes.register('shop', Shop);
})();
