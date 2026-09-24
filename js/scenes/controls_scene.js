/*
 * controls_scene.js - scene 'controls': rebinding the keyboard, opened from Options ('Controls').
 *
 * One row per rebindable action (G.Input.BINDABLE) with three key slots, then "Put every key back".
 * Choose a slot (Confirm or a click) and press the new key; Esc leaves it as it was, Delete empties it.
 * A key already used elsewhere swaps places with the slot's old key, so no key ever does two jobs.
 * Esc itself is fixed as Back / Menu, so nobody can lock themselves out. Bindings save to localStorage.
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CONFIG;
  const INK = C.COLORS.ink;
  const SOFT = C.COLORS.inkSoft;

  const ROW = { x: 44, y: 94, h: 43 };
  const SLOT = { x: 236, w: 138, gap: 150, h: 34 };
  const CAPTURE_FRAMES = 60 * 10;

  const Controls = {
    opaque: false,

    enter: function () {
      this.acts = G.Input.BINDABLE.slice();
      this.row = 0;
      this.col = 0;
      this.t = 0;
      this.wait = null;            // { action, slot, t } while waiting for a key
      this.note = null;            // { text, t, bad }
      this.busy = false;
      G.UI.sfx('menuOpen');
    },

    exit: function () {
      if (this.wait) G.Input.captureKey(null);
      this.wait = null;
    },

    resume: function () { G.Input.reset(); },

    _say: function (text, bad) {
      this.note = { text: text, t: 0, bad: !!bad };
    },

    _listen: function () {
      const self = this;
      const action = this.acts[this.row], slot = this.col;
      this.wait = { action: action, slot: slot, t: 0 };
      this.note = null;
      G.Input.captureKey(function (code) { self._got(code); });
    },

    _got: function (code) {
      const w = this.wait;
      this.wait = null;
      if (!w) return;
      if (code == null) { G.UI.sfx('cancel'); return; }
      if (code === 'Delete') { this._clear(w.action, w.slot); return; }
      const r = G.Input.bind(w.action, w.slot, code);
      if (!r.ok) { G.UI.sfx('buzzer'); this._say(r.reason, true); return; }
      G.UI.sfx('confirm');
      const name = G.Input.keyName(code);
      this._say(r.swapped
        ? name + ' is ' + G.Input.actionName(w.action) + ' now; ' + G.Input.actionName(r.swapped) + ' took the old key.'
        : name + ' is ' + G.Input.actionName(w.action) + ' now.');
    },

    _clear: function (action, slot) {
      const r = G.Input.unbind(action, slot);
      if (!r.ok) { G.UI.sfx('buzzer'); this._say(r.reason, true); return; }
      G.UI.sfx('cancel');
    },

    _stopListening: function () {
      if (!this.wait) return;
      G.Input.captureKey(null);
      this.wait = null;
      G.UI.sfx('cancel');
    },

    _reset: function () {
      const self = this;
      this.busy = true;
      G.UI.ChoiceBox.show(['Put them back', 'Leave them'], { cancelIndex: 1 }).then(function (i) {
        self.busy = false;
        if (i !== 0) return;
        G.Input.resetBindings();
        G.UI.sfx('confirm');
        self._say('Every key is back where it started.');
      });
    },

    /* ---------------------------------------------------------------- input */

    update: function () {
      this.t++;
      if (this.note) this.note.t++;
      if (this.wait) {
        if (++this.wait.t > CAPTURE_FRAMES) this._stopListening();
        return;
      }
      if (this.busy || this.t < 3) return;
      const I = G.Input;
      const rows = this.acts.length + 1;                  // + the reset row
      if (I.repeated('down') || I.repeated('up')) {
        this.row = (this.row + (I.repeated('down') ? 1 : -1) + rows) % rows;
        G.UI.sfx('cursor');
      } else if (this.row < this.acts.length && (I.repeated('right') || I.repeated('left'))) {
        this.col = (this.col + (I.repeated('right') ? 1 : -1) + I.SLOTS) % I.SLOTS;
        G.UI.sfx('cursor');
      } else if (I.pressed('confirm')) {
        if (this.row >= this.acts.length) { G.UI.sfx('confirm'); this._reset(); }
        else { G.UI.sfx('confirm'); this._listen(); }
      } else if (I.keyPressed('Delete') && this.row < this.acts.length) {
        this._clear(this.acts[this.row], this.col);
      } else if (I.pressed('cancel')) {
        G.UI.sfx('menuClose');
        G.Scenes.pop({});
      }
    },

    /* ---------------------------------------------------------------- drawing */

    draw: function (ctx) {
      const I = G.Input;
      const self = this;
      G.SceneKit.dim(ctx, 0.5);
      G.Gfx.panel(18, 14, C.W - 36, C.H - 28, { seed: 5200, fill: '#f2e8d4' });
      G.Gfx.text('Controls', 40, 26, { size: 30, font: 'title' });
      G.Gfx.text('Esc always backs out, whatever else you choose.', C.W - 44, 40,
        { size: 16, align: 'right', color: SOFT });
      G.Gfx.line(38, 72, C.W - 38, 72, { width: 1.6, alpha: 0.5, seed: 5201 });

      // while listening, a click anywhere else leaves the key as it was
      if (this.wait) G.UI.pointRow(0, 0, C.W, C.H, null, { click: function () { self._stopListening(); } });

      const binds = I.bindings();
      for (let r = 0; r < this.acts.length; r++) {
        const a = this.acts[r];
        const y = ROW.y + r * ROW.h;
        const rowSel = r === this.row;
        G.Gfx.text(I.actionName(a), ROW.x + 16, y + SLOT.h / 2, {
          size: 22, baseline: 'middle', color: rowSel ? INK : SOFT,
        });
        for (let c = 0; c < I.SLOTS; c++) {
          const x = SLOT.x + c * SLOT.gap;
          const code = binds[a][c];
          const sel = rowSel && c === this.col;
          const listening = this.wait && this.wait.action === a && this.wait.slot === c;
          let label = code ? I.keyName(code) : '—';
          if (listening) label = Math.floor(this.t / 20) % 2 ? 'press a key…' : 'press a key';
          G.UI.drawTag(ctx, x, y, SLOT.w, SLOT.h, {
            color: listening ? '#f7d774' : (sel ? C.COLORS.accent : (code ? '#9fb0b8' : '#d7cfbf')),
            label: label, size: listening ? 18 : 20, seed: 5300 + r * 7 + c, font: 'body',
            selected: sel && !this.wait, labelColor: code || listening ? INK : SOFT, shadow: sel,
          });
          if (sel && !this.wait) G.UI.drawCursor(ctx, x - 14, y + SLOT.h / 2);
          if (!this.wait && !this.busy) {
            G.UI.pointRow(x - 4, y - 3, SLOT.w + 8, SLOT.h + 6, function () {
              if (self.wait || (self.row === r && self.col === c)) return false;
              self.row = r; self.col = c;
              return true;
            });
          }
        }
        if (a === 'cancel') {
          G.Gfx.text('+ Esc', SLOT.x + I.SLOTS * SLOT.gap - 4, y + SLOT.h / 2, { size: 17, baseline: 'middle', color: SOFT });
        }
      }

      // put every key back
      const ry = ROW.y + this.acts.length * ROW.h + 10;
      const resetSel = this.row >= this.acts.length;
      G.UI.drawTag(ctx, SLOT.x, ry, SLOT.w * 2 + (SLOT.gap - SLOT.w), SLOT.h + 4, {
        color: resetSel ? C.COLORS.accent : '#9fb0b8', label: 'Put every key back', size: 21,
        seed: 5400, selected: resetSel && !this.wait,
      });
      if (resetSel && !this.wait) G.UI.drawCursor(ctx, SLOT.x - 14, ry + SLOT.h / 2 + 2);
      if (!this.wait && !this.busy) {
        G.UI.pointRow(SLOT.x - 4, ry - 3, SLOT.w * 2 + SLOT.gap - SLOT.w + 8, SLOT.h + 10, function () {
          if (self.row === self.acts.length) return false;
          self.row = self.acts.length;
          return true;
        });
      }

      // what just happened / what to do
      const fy = C.H - 70;
      if (this.wait) {
        const left = Math.ceil((CAPTURE_FRAMES - this.wait.t) / 60);
        G.Gfx.text('Press the key for ' + I.actionName(this.wait.action) + '.   Esc: leave it   Delete: empty the slot   (' + left + ')',
          40, fy, { size: 18, color: INK });
        // a Clear tag for mouse users (drawn over the "click anywhere to leave it" area)
        const cx = C.W - 170, cy = fy - 6;
        G.UI.drawTag(ctx, cx, cy, 120, 30, { color: '#d7cfbf', label: 'Empty it', size: 18, seed: 5410, shadow: false });
        G.UI.pointRow(cx, cy, 120, 30, null, {
          click: function () {
            const w = self.wait;
            if (!w) return;
            G.Input.captureKey(null);
            self.wait = null;
            self._clear(w.action, w.slot);
          },
        });
      } else if (this.note && this.note.t < 60 * 5) {
        G.Gfx.text(this.note.text, 40, fy, { size: 18, color: this.note.bad ? '#a4514b' : INK, maxWidth: C.W - 80 });
      }
      if (!this.wait) {
        G.Gfx.text(I.keysFor('confirm', 1) + ' or click: change a key     Delete: empty it     ' + I.keysFor('cancel', 1) + ': done',
          C.W - 44, C.H - 40, { size: 17, align: 'right', color: SOFT });
      }
    },
  };

  G.Scenes.register('controls', Controls);
})();
