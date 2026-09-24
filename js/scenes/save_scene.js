/*
 * save_scene.js - scene 'save': the three save slots, drawn as postcards (DESIGN_BIBLE 9.2, 8.8).
 *
 * Params: { mode:'save' }   write a slot (asks before writing over one)   - the default
 *         { mode:'load' }   read a slot (the title screen's Continue)
 *
 * Resolves (G.Scenes.pop) with { saved:true, slot } | { loaded:true, slot } | { cancelled:true }.
 * The caller decides what happens next: the title starts the map, the interpreter's ['save'] just
 * carries on with the event.
 *
 * Each postcard shows the location name, the tide number (var 'tide'), the play time and the party's
 * levels. The tide is read out of the stored snapshot (G.State.slotInfo does not carry variables);
 * the storage key is the one TECH_SPEC section 3 fixes, 'fable51.save.<slot>'.
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CONFIG;
  const INK = C.COLORS.ink;
  const SOFT = C.COLORS.inkSoft;

  const CARD = { x: 40, y: 92, w: 688, h: 138, gap: 150 };

  function K() { return G.SceneKit; }

  /** Tide number stored in a slot, or null when it cannot be read. */
  function slotTide(slot) {
    try {
      const raw = window.localStorage.getItem('fable51.save.' + slot);
      if (!raw) return null;
      const d = JSON.parse(raw);
      return d && d.vars && typeof d.vars.tide === 'number' ? d.vars.tide : null;
    } catch (e) {
      return null;
    }
  }

  const SaveScene = {
    opaque: false,

    enter: function (params) {
      params = params || {};
      G.SceneKit.installHooks();
      this.mode = params.mode === 'load' ? 'load' : 'save';
      this.index = 0;
      this.t = 0;
      this.busy = false;
      this.messageT = 0;
      this._refresh();
      const slots = G.State.SLOTS;
      for (let i = 0; i < slots.length; i++) if (this.infos[i]) this.index = i;   // start on the newest-ish
      if (this.mode === 'load') {
        const latest = G.State.latestSlot();
        if (latest) this.index = G.State.SLOTS.indexOf(latest);
      }
      G.UI.sfx('menuOpen');
    },

    exit: function () {},

    resume: function () { G.Input.reset(); this.busy = false; },

    _refresh: function () {
      this.infos = G.State.SLOTS.map(function (s) {
        const info = G.State.slotInfo(s);
        if (info) info.tide = slotTide(s);
        return info;
      });
      this.slots = G.State.SLOTS.slice();
    },

    /* ---------------------------------------------------------------- input */

    update: function () {
      this.t++;
      if (this.messageT > 0) this.messageT--;
      if (this.busy || this.t < 3) return;
      const n = this.slots.length;
      if (G.Input.repeated('down') || G.Input.repeated('up')) {
        const d = G.Input.repeated('down') ? 1 : -1;
        this.index = (this.index + d + n) % n;
        G.UI.sfx('cursor');
      } else if (G.Input.pressed('confirm')) {
        this._pick();
      } else if (G.Input.pressed('cancel')) {
        G.UI.sfx('cancel');
        G.Scenes.pop({ cancelled: true });
      }
    },

    _pick: function () {
      const self = this;
      const slot = this.slots[this.index];
      const info = this.infos[this.index];
      if (this.mode === 'load' && !info) { G.UI.sfx('buzzer'); return; }
      G.UI.sfx('confirm');
      this.busy = true;
      const needsAsk = this.mode === 'load' || !!info;
      const question = this.mode === 'load'
        ? G.str('save.loadConfirm', 'Open this page?')
        : G.str('save.overwrite', 'Write over this page?');
      const ask = needsAsk
        ? G.UI.MessageBox.show({ style: 'narrate', text: question, pos: 'middle' })
          .then(function () { return G.UI.ChoiceBox.show([G.str('common.yes', 'Yes'), G.str('common.no', 'No')], { cancelIndex: 1 }); })
        : Promise.resolve(0);
      ask.then(function (choice) {
        if (choice !== 0) { self.busy = false; return; }
        if (self.mode === 'load') {
          const ok = G.State.load(slot);
          if (!ok) { self._say('That page would not open.'); self.busy = false; return; }
          K().sfx('sfx_page');
          G.Scenes.pop({ loaded: true, slot: slot });
          return;
        }
        const ok = G.State.save(slot);
        self._refresh();
        self.busy = false;
        if (!ok) { self._say(G.str('save.failed', 'The page would not take the ink.')); return; }
        K().sfx('sfx_save');
        self._say(G.str('save.saved', 'Saved.'));
        G.Scenes.pop({ saved: true, slot: slot });
      }).catch(function (e) { G.error(e); self.busy = false; });
    },

    _say: function (text) {
      this.messageT = 110;
      G.UI.Toast.show(text, { frames: 110 });
    },

    /* ---------------------------------------------------------------- drawing */

    draw: function (ctx) {
      K().dim(ctx, 0.45);
      G.Gfx.panel(18, 14, C.W - 36, C.H - 28, { seed: 2600, fill: '#f2e8d4' });
      const title = this.mode === 'load' ? 'Which page?' : 'Where shall I write it?';
      G.Gfx.text(title, 40, 32, { size: 30, font: 'title' });
      G.Gfx.line(38, 78, C.W - 38, 78, { width: 1.6, alpha: 0.5, seed: 2601 });
      for (let i = 0; i < this.slots.length; i++) this._drawCard(ctx, i);
      G.Gfx.text(G.Input.keysFor('confirm', 1) + ': ' + (this.mode === 'load' ? 'open' : 'write') + '     ' +
        G.Input.keysFor('cancel', 1) + ': back',
        C.W - 44, C.H - 46, { size: 18, align: 'right', color: SOFT });
    },

    _drawCard: function (ctx, i) {
      const info = this.infos[i];
      const x = CARD.x, y = CARD.y + i * CARD.gap, w = CARD.w, h = CARD.h;
      const sel = i === this.index;
      ctx.save();
      if (sel) {
        const lift = Math.sin(this.t * 0.06) * 1.2;
        ctx.translate(0, -2 + lift);
      }
      G.Gfx.panel(x, y, w, h, { seed: 2700 + i * 3, fill: info ? '#fdf8ea' : '#ece3cf', lineWidth: sel ? 2.8 : 2 });
      // postcard furniture: the divider and the stamp box
      G.Gfx.line(x + w * 0.58, y + 12, x + w * 0.58, y + h - 12, { width: 1.4, alpha: 0.45, seed: 2800 + i });
      const sx = x + w - 84, sy = y + 14;
      G.Gfx.panel(sx, sy, 62, 52, { seed: 2900 + i, fill: info ? '#eaf1f6' : '#e4dcc8', shadow: false, lineWidth: 1.4 });
      if (info) K().stamp(ctx, sx + 31, sy + 26, 36);
      for (let l = 0; l < 3; l++) {
        const ly = y + 78 + l * 20;
        G.Gfx.line(x + w * 0.60 + 8, ly, x + w - 22, ly, { width: 1.2, alpha: 0.4, seed: 3000 + i * 4 + l });
      }
      G.Gfx.text('Page ' + this.slots[i], x + 20, y + 10, { size: 24, font: 'title', color: sel ? INK : SOFT });
      if (!info) {
        G.Gfx.text(G.str('save.emptySlot', 'A blank page'), x + 20, y + 54, { size: 22, color: SOFT });
      } else {
        G.Gfx.text(info.mapName || info.mapId || '', x + 20, y + 44, { size: 24 });
        const tide = info.tide == null ? null : info.tide;
        G.Gfx.text((tide == null ? '' : 'Tide ' + tide + '     ') + info.playtime,
          x + 20, y + 76, { size: 19, color: SOFT });
        const party = info.party || [];
        for (let p = 0; p < party.length; p++) {
          const px = x + 20 + p * 96;
          G.Gfx.text(party[p].name || party[p].id, px, y + 102, { size: 18, color: K().actorColor(party[p].id) });
          G.Gfx.text('LV ' + party[p].level, px, y + 120, { size: 16, color: SOFT });
        }
        G.Gfx.text(info.dateText || '', x + w - 22, y + h - 28, { size: 15, align: 'right', color: SOFT });
      }
      if (sel) G.UI.drawCursor(ctx, x - 16, y + h / 2);
      if (!this.busy) {
        const self = this;
        G.UI.pointRow(x - 20, y, w + 20, h, function () {
          if (self.busy || self.index === i) return false;
          self.index = i;
          return true;
        });
      }
      ctx.restore();
    },
  };

  G.Scenes.register('save', SaveScene);
})();
