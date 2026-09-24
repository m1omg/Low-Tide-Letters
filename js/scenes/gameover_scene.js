/*
 * gameover_scene.js - scene 'gameover'. Nobody dies in this game, so this screen is gentle and in-world:
 * "Everyone sat down for a bit." Two luggage tags: continue from the last save, or go back to the title.
 * Entered with ['gameover'] or by a battle whose onLose is 'gameover'.
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CONFIG;
  const U = G.Util;
  const SOFT = C.COLORS.inkSoft;

  function K() { return G.SceneKit; }

  const GameOver = {
    opaque: true,

    enter: function () {
      G.SceneKit.installHooks();
      G.UI.reset();
      G.Gfx.resetEffects();
      G.Audio.stopBgm(900);
      this.t = 0;
      this.busy = false;
      this.slot = G.State.latestSlot();
      this.items = [
        { key: 'continue', label: 'Get up and carry on', enabled: !!this.slot },
        { key: 'title', label: 'Back to the title', enabled: true },
      ];
      this.index = this.slot ? 0 : 1;
      G.Gfx.setFade(1, 'black');
      G.Gfx.fadeIn(50);
    },

    exit: function () {},

    update: function () {
      this.t++;
      if (this.busy || this.t < 40) return;
      const n = this.items.length;
      if (G.Input.repeated('down') || G.Input.repeated('up')) {
        this.index = (this.index + (G.Input.repeated('down') ? 1 : -1) + n) % n;
        G.UI.sfx('cursor');
      } else if (G.Input.pressed('confirm')) {
        const it = this.items[this.index];
        if (!it.enabled) { G.UI.sfx('buzzer'); return; }
        G.UI.sfx('confirm');
        this._pick(it.key);
      }
    },

    _pick: function (key) {
      const self = this;
      this.busy = true;
      G.Gfx.fadeOut(28).then(function () {
        G.UI.reset();
        if (key === 'continue' && self.slot && G.State.load(self.slot)) {
          const m = G.State.map;
          if (G.Scenes.has('map') && m.id) {
            G.Scenes.clearTo('map', { mapId: m.id, x: m.x, y: m.y, dir: m.dir, fade: 'none' });
            G.Gfx.fadeIn(30);
            return;
          }
        }
        G.Scenes.clearTo('title', {});
        G.Gfx.fadeIn(30);
      });
    },

    draw: function (ctx) {
      K().page(ctx, { fill: '#efe7d6', sand: false });
      K().sand(ctx, 402, 17);
      // four small tags sitting in a row on the sand, resting
      const party = K().party();
      const n = Math.max(1, party.length);
      for (let i = 0; i < n; i++) {
        const a = party[i] || { id: 'wren', name: '' };
        const x = Math.round(C.W / 2 - (n * 78) / 2 + i * 78);
        const bob = Math.sin(this.t * 0.03 + i * 0.9) * 1.5;
        G.UI.drawTag(ctx, x, 322 + bob, 62, 74, {
          color: K().actorColor(a.id), label: null, seed: 4100 + i, shadow: true,
        });
        G.Gfx.text(String(a.name || '').slice(0, 8), x + 31, 404, { size: 16, align: 'center', color: SOFT });
      }
      K().can(ctx, C.W / 2 + n * 44, 386, { w: 20, rot: 1.6 });

      const a = U.clamp((this.t - 20) / 40, 0, 1);
      ctx.save();
      ctx.globalAlpha *= a;
      G.Gfx.text('Everyone sat down for a bit.', C.W / 2, 150,
        { size: 38, font: 'title', align: 'center', color: C.COLORS.ink });
      G.Gfx.text('Nothing is broken. It will keep.', C.W / 2, 200,
        { size: 21, align: 'center', color: SOFT, italic: true });
      ctx.restore();

      if (this.t < 40) return;
      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i];
        const x = 232, y = 452 + i * 60;
        const sel = i === this.index;
        G.UI.drawTag(ctx, x, y, 304, 48, {
          color: sel ? C.COLORS.accent : '#9fb0b8', label: it.label, size: 23,
          seed: 4200 + i, selected: sel, disabled: !it.enabled,
        });
        if (sel) G.UI.drawCursor(ctx, x - 18, y + 24);
        if (!this.busy) {
          const self = this;
          G.UI.pointRow(x - 24, y - 4, 330, 56, function () {
            if (self.busy || self.index === i) return false;
            self.index = i;
            return true;
          });
        }
      }
      if (!this.slot) {
        G.Gfx.text('(nothing written down yet)', 552, 470, { size: 16, color: SOFT });
      }
    },
  };

  G.Scenes.register('gameover', GameOver);
})();
