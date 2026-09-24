/*
 * custom_ui.js - the bespoke event UIs of DESIGN_BIBLE 8.7, registered as G.Interpreter.custom handlers
 * and called from event scripts with ['custom','<name>',args].
 *
 * ---------------------------------------------------------------------------------------------------
 * ARGUMENT SHAPES (for the story scripters)
 * ---------------------------------------------------------------------------------------------------
 *
 * ['custom','ghost_choice', {
 *     options: [ {text:'Say it.',  ghost:false},        // a real, choosable option
 *                {text:'(you could have said it)', ghost:true} ],   // greyed out, the cursor skips it
 *     varName: 'choice_var',        // optional: the chosen INDEX (into `options`) is stored here
 *     cancelIndex: 1,               // optional: which index `cancel` picks (must not be a ghost)
 *     prompt: 'Well?' }]            // optional line drawn above the box
 *   -> resolves with the chosen index. Ghost options are never choosable; they are the words that are
 *      no longer available (bible: the slip, the rocks, "Send him.").
 *
 * ['custom','letter_compose', {
 *     to: 'Dear Tam,',              // optional heading (default "Dear Tam,")
 *     sign: '— Wren' }]             // optional signature
 *   -> Ending A (bible 8.7). Lists the True Words whose `skN_said` flag is set, the player places three
 *      of them under the heading, and the finished letter is shown. Stores the WORD NUMBERS (1-9, the N
 *      of skN) in the vars letter_1, letter_2, letter_3; unfilled lines store 0.
 *
 * ['custom','rock_pool', {
 *     joke: 'A limpet watches you save. It has seen things.',   // optional, shown once per pool
 *     id: 'pool_shallows' }]        // optional key for that "once" (defaults to the event + map id)
 *   -> The save-point menu of bible 8.8: Save / Skim / Rest / Leave. Skim calls G.Party.skim() and plays
 *      one confession line from G.DATA.confessions when that table exists. Rest fully heals the party.
 *
 * ['custom','keep_or_say', {
 *     say: 'Say it.',               // defaults
 *     keep: 'Keep it.',
 *     prompt: '...',                // optional line above the two tags
 *     varName: 'sk1_choice',        // optional: 0 = said, 1 = kept
 *     flagSaid: 'sk1_said',         // optional flags set for each outcome
 *     flagKept: 'sk1_kept' }]
 *   -> The two-tag choice of bible 9.1. "Keep it" is pre-selected and also bound to cancel; after a Keep
 *      a small grey pebble drops into the corner of the screen for a second. Nothing judges the player.
 *
 * All four resolve a Promise, so the interpreter waits for them.
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CONFIG;
  const U = G.Util;
  const INK = C.COLORS.ink;
  const SOFT = C.COLORS.inkSoft;

  function K() { return G.SceneKit; }

  /** Pushes a throw-away overlay scene and resolves with whatever it pops. */
  function overlay(scene, params) {
    return G.Scenes.push(scene, params || {});
  }

  /** The test hook: window.__game.autoChoice picks an option by itself. */
  function autoChoice() {
    const v = window.__game ? window.__game.autoChoice : null;
    return typeof v === 'number' ? v : null;
  }

  /* ====================================================================== ghost_choice */

  const GhostChoice = {
    opaque: false,

    enter: function (params) {
      this.opts = (params.options || []).map(function (o) {
        return typeof o === 'string' ? { text: o, ghost: false } : { text: String(o.text), ghost: !!o.ghost };
      });
      this.varName = params.varName || null;
      this.prompt = params.prompt || null;
      this.cancelIndex = params.cancelIndex != null ? params.cancelIndex : -1;
      this.t = 0;
      this.rowH = 40;
      this.layouts = this.opts.map(function (o) { return G.Text.layout(o.text, { size: 22 }); });
      let w = 260;
      for (const l of this.layouts) w = Math.max(w, l.width + 96);
      this.w = Math.min(w, 600);
      this.h = this.opts.length * this.rowH + 28;
      this.x = Math.round((C.W - this.w) / 2);
      this.y = Math.round(C.H * 0.42 - this.h / 2);
      this.index = this._firstReal(0, 1);
      if (!this.opts.length) { this.index = 0; }
    },

    exit: function () {},

    _firstReal: function (from, dir) {
      const n = this.opts.length;
      for (let i = 0; i < n; i++) {
        const j = ((from + i * dir) % n + n) % n;
        if (!this.opts[j].ghost) return j;
      }
      return from;
    },

    _move: function (dir) {
      const n = this.opts.length;
      let j = this.index;
      for (let i = 0; i < n; i++) {
        j = (j + dir + n) % n;
        if (!this.opts[j].ghost) break;
      }
      if (j !== this.index) { this.index = j; G.UI.sfx('cursor'); }
    },

    _close: function (i) {
      if (this.varName) G.State.setVar(this.varName, i);
      G.Scenes.pop(i);
    },

    update: function () {
      this.t++;
      if (this.t < 3) return;
      const auto = autoChoice();
      if (auto != null && this.t >= 4) {
        const n = this.opts.length;
        let i = U.clamp(auto, 0, Math.max(0, n - 1));
        if (this.opts[i] && this.opts[i].ghost) i = this._firstReal(i, 1);
        this._close(i);
        return;
      }
      if (G.Input.repeated('down')) this._move(1);
      else if (G.Input.repeated('up')) this._move(-1);
      else if (G.Input.pressed('confirm')) {
        if (this.opts[this.index] && this.opts[this.index].ghost) { G.UI.sfx('buzzer'); return; }
        G.UI.sfx('confirm');
        this._close(this.index);
      } else if (G.Input.pressed('cancel') && this.cancelIndex >= 0 && !(this.opts[this.cancelIndex] || {}).ghost) {
        G.UI.sfx('cancel');
        this._close(this.cancelIndex);
      }
    },

    draw: function (ctx) {
      if (this.prompt) {
        G.Gfx.text(this.prompt, C.W / 2, this.y - 44, { size: 24, font: 'title', align: 'center', outline: '#fdf8ea' });
      }
      G.Gfx.panel(this.x, this.y, this.w, this.h, { seed: 6100 });
      for (let i = 0; i < this.opts.length; i++) {
        const o = this.opts[i];
        const ry = this.y + 14 + i * this.rowH;
        const self = this;
        G.UI.pointRow(this.x + 8, ry, this.w - 16, this.rowH, function () {
          if (o.ghost || self.index === i) return false;
          self.index = i;
          return true;
        }, { confirm: !o.ghost });
        if (i === this.index && !o.ghost) {
          G.UI.drawHighlight(ctx, this.x + 44, ry + 3, this.w - 64, this.rowH - 8, 6200 + i);
          G.UI.drawCursor(ctx, this.x + 26, ry + this.rowH / 2);
        }
        ctx.save();
        if (o.ghost) ctx.globalAlpha *= 0.42;
        G.Text.draw(this.layouts[i], this.x + 52, ry + (this.rowH - this.layouts[i].height) / 2,
          { color: o.ghost ? '#7a7684' : INK });
        if (o.ghost) {
          G.Gfx.line(this.x + 50, ry + this.rowH / 2 + 1, this.x + 52 + this.layouts[i].width,
            ry + this.rowH / 2 + 1, { width: 1.2, alpha: 0.5, seed: 6300 + i, color: '#7a7684' });
        }
        ctx.restore();
      }
    },
  };

  /* ====================================================================== keep_or_say */

  const KeepOrSay = {
    opaque: false,

    enter: function (params) {
      this.say = params.say || 'Say it.';
      this.keep = params.keep || 'Keep it.';
      this.prompt = params.prompt || null;
      this.varName = params.varName || null;
      this.flagSaid = params.flagSaid || null;
      this.flagKept = params.flagKept || null;
      this.index = 1;                     // Keep is pre-selected: keeping is always the easy option
      this.t = 0;
      this.pebble = null;                 // the little pebble that drops after a Keep
    },

    exit: function () {},

    _choose: function (i) {
      if (this.varName) G.State.setVar(this.varName, i);
      if (i === 0) {
        if (this.flagSaid) G.State.setFlag(this.flagSaid, true);
        G.UI.sfx('confirm');
        K().sfx('sfx_talk_success', { volume: 0.8 });
        G.Scenes.pop(0);
        return;
      }
      if (this.flagKept) G.State.setFlag(this.flagKept, true);
      G.UI.sfx('cancel');
      K().sfx('sfx_drone_hit', { volume: 0.6 });
      this.pebble = { t: 0, x: C.W / 2, y: C.H * 0.52 };      // falls into the corner for a second
    },

    update: function () {
      this.t++;
      if (this.pebble) {
        this.pebble.t++;
        if (this.pebble.t > 66) G.Scenes.pop(1);
        return;
      }
      if (this.t < 3) return;
      const auto = autoChoice();
      if (auto != null && this.t >= 4) { this._choose(U.clamp(auto, 0, 1)); return; }
      if (G.Input.repeated('left') || G.Input.repeated('right') ||
          G.Input.repeated('up') || G.Input.repeated('down')) {
        this.index = this.index === 0 ? 1 : 0;
        G.UI.sfx('cursor');
      } else if (G.Input.pressed('confirm')) this._choose(this.index);
      else if (G.Input.pressed('cancel')) this._choose(1);     // cancel = Keep it
    },

    draw: function (ctx) {
      const y = Math.round(C.H * 0.52);
      if (this.prompt && !this.pebble) {
        const pw = G.Gfx.measure(this.prompt, { size: 24, font: 'title' }).w + 56;
        G.Gfx.panel(Math.round((C.W - pw) / 2), y - 86, pw, 48, { seed: 6350, fill: '#fdf8ea' });
        G.Gfx.text(this.prompt, C.W / 2, y - 76, { size: 24, font: 'title', align: 'center' });
      }
      if (!this.pebble) {
        const labels = [this.say, this.keep];
        for (let i = 0; i < 2; i++) {
          const x = C.W / 2 - 236 + i * 244;
          const sel = i === this.index;
          const swing = Math.sin(this.t * 0.05 + i * 1.7) * (sel ? 0.02 : 0.008);
          ctx.save();
          ctx.translate(x + 16, y + 16);
          ctx.rotate(swing);
          ctx.translate(-(x + 16), -(y + 16));
          G.UI.drawTag(ctx, x, y, 228, 56, {
            color: i === 0 ? '#3a8c86' : '#9fb0b8', label: labels[i], size: 24, fit: true,
            seed: 6400 + i, selected: sel, labelColor: i === 0 ? INK : '#4b4750',
            tieX: C.W / 2, tieY: y - 34, sag: 4,
          });
          ctx.restore();
          if (sel) G.UI.drawCursor(ctx, x - 16, y + 28);
          const self = this;
          G.UI.pointRow(x - 20, y - 4, 252, 66, function () {
            if (self.pebble || self.index === i) return false;
            self.index = i;
            return true;
          });
        }
      } else {
        // a small grey pebble drops into the corner of the screen and settles there
        const t = this.pebble.t;
        const k = U.clamp(t / 34, 0, 1);
        const px = U.lerp(this.pebble.x, C.W - 44, U.ease.inOut(k));
        const py = U.lerp(this.pebble.y, C.H - 44, U.ease.in(k)) - Math.sin(Math.PI * k) * 40;
        const a = t > 50 ? U.clamp((66 - t) / 16, 0, 1) : 1;
        ctx.save();
        ctx.globalAlpha *= a;
        K().glass(ctx, px, py, { pebble: true }, 22);
        ctx.restore();
      }
    },
  };

  /* ====================================================================== letter_compose */

  /** The True Words of bible 8.7; the Nth is offered once the flag skN_said is set. */
  const TRUE_WORDS = [
    { n: 1, flag: 'sk1_said', text: "I'm not all right about it." },
    { n: 2, flag: 'sk2_said', text: 'You were my best friend.' },
    { n: 3, flag: 'sk3_said', text: 'I saw you were sad and I looked away.' },
    { n: 4, flag: 'sk4_said', text: 'Thank you.' },
    { n: 5, flag: 'sk5_said', text: 'I kept the string up.' },
    { n: 6, flag: 'sk6_said', text: 'I read every postcard.' },
    { n: 7, flag: 'sk7_said', text: 'I should have helped you pack.' },
    { n: 8, flag: 'sk8_said', text: "I'm still your friend. If you want." },
    { n: 9, flag: 'sk9_said', text: "I didn't mean it. I'm sorry." },
  ];

  const SHEET = { x: 118, y: 28, w: 532, h: 316 };

  const LetterCompose = {
    opaque: false,

    enter: function (params) {
      this.to = params.to || 'Dear Tam,';
      this.sign = params.sign || '— Wren';
      this.words = TRUE_WORDS.filter(function (w) { return G.State.getFlag(w.flag); });
      this.placed = [];
      this.index = 0;
      this.mode = this.words.length ? 'pick' : 'seal';   // nothing earned: an honest empty letter
      this.confirmIndex = 0;
      this.t = 0;
      K().sfx('sfx_page');
    },

    exit: function () {},

    _slots: function () { return Math.min(3, Math.max(1, this.words.length || 1)); },

    _available: function () {
      const self = this;
      return this.words.filter(function (w) { return self.placed.indexOf(w) < 0; });
    },

    _store: function () {
      for (let i = 0; i < 3; i++) {
        G.State.setVar('letter_' + (i + 1), this.placed[i] ? this.placed[i].n : 0);
      }
    },

    update: function () {
      this.t++;
      if (this.t < 3) return;
      const auto = autoChoice();
      if (this.mode === 'pick') {
        const avail = this._available();
        if (!avail.length) { this.mode = 'seal'; return; }
        if (auto != null && this.t % 6 === 0) {                 // tests: place words by themselves
          this.placed.push(avail[U.clamp(auto, 0, avail.length - 1)]);
          this.index = 0;
          if (this.placed.length >= this._slots()) this.mode = 'seal';
          return;
        }
        if (G.Input.repeated('down')) { this.index = (this.index + 1) % avail.length; G.UI.sfx('cursor'); }
        else if (G.Input.repeated('up')) { this.index = (this.index + avail.length - 1) % avail.length; G.UI.sfx('cursor'); }
        else if (G.Input.pressed('confirm')) {
          this.placed.push(avail[this.index]);
          this.index = Math.min(this.index, Math.max(0, avail.length - 2));
          K().sfx('sfx_scribble', { volume: 0.8 });
          G.UI.sfx('confirm');
          if (this.placed.length >= this._slots()) this.mode = 'seal';
        } else if (G.Input.pressed('cancel') && this.placed.length) {
          this.placed.pop();
          G.UI.sfx('cancel');
        }
        return;
      }
      if (this.mode === 'seal') {
        if (auto != null && this.t % 6 === 0) { this._seal(); return; }
        if (G.Input.repeated('left') || G.Input.repeated('right')) {
          this.confirmIndex = this.confirmIndex === 0 ? 1 : 0;
          G.UI.sfx('cursor');
        } else if (G.Input.pressed('confirm')) {
          if (this.confirmIndex === 0) this._seal();
          else { this.placed.pop(); this.mode = 'pick'; this.index = 0; G.UI.sfx('cancel'); }
        } else if (G.Input.pressed('cancel') && this.placed.length) {
          this.placed.pop();
          this.mode = 'pick';
          G.UI.sfx('cancel');
        }
        return;
      }
      // 'done': the finished letter is on screen
      if (this.t - this.doneAt > 20 && (G.Input.pressed('confirm') || auto != null)) {
        G.Scenes.pop({ letter: this.placed.map(function (w) { return w.n; }) });
      }
    },

    _seal: function () {
      this._store();
      this.mode = 'done';
      this.doneAt = this.t;
      K().sfx('sfx_page');
      G.UI.sfx('confirm');
    },

    draw: function (ctx) {
      K().dim(ctx, 0.5);
      this._drawSheet(ctx, this.mode === 'done');
      if (this.mode === 'done') {
        G.Gfx.text('(press ' + G.Input.keysFor('confirm', 1) + ')', C.W / 2, C.H - 60, { size: 18, align: 'center', color: '#e8e0cf' });
        return;
      }
      const px = 40, py = 360, pw = C.W - 80, ph = 190;
      G.Gfx.panel(px, py, pw, ph, { seed: 6600, fill: '#f2e8d4' });
      G.Gfx.text(this.mode === 'pick' ? 'True Words' : 'Send it?', px + 22, py + 10, { size: 26, font: 'title' });
      if (this.mode === 'pick') {
        const avail = this._available();
        const rowH = 32;
        const rows = Math.floor((ph - 56) / rowH);
        const first = U.clamp(this.index - Math.floor(rows / 2), 0, Math.max(0, avail.length - rows));
        for (let i = first; i < Math.min(avail.length, first + rows); i++) {
          const ry = py + 50 + (i - first) * rowH;
          const sel = i === this.index;
          if (sel) { G.UI.drawHighlight(ctx, px + 38, ry + 1, pw - 70, rowH - 6, 6700 + i); G.UI.drawCursor(ctx, px + 26, ry + rowH / 2); }
          const self = this;
          G.UI.pointRow(px + 16, ry, pw - 32, rowH, function () {
            if (self.mode !== 'pick' || self.index === i) return false;
            self.index = i;
            return true;
          });
          G.Gfx.text(avail[i].text, px + 52, ry + rowH / 2, { size: 20, baseline: 'middle' });
        }
        G.Gfx.text(G.Input.keysFor('confirm', 1) + ': write it down     ' + G.Input.keysFor('cancel', 1) + ': take the last one back',
          px + pw - 22, py + 14, { size: 16, align: 'right', color: SOFT });
      } else {
        const labels = ['Seal the letter', 'Take one back'];
        for (let i = 0; i < 2; i++) {
          const x = px + 60 + i * 300;
          const sel = i === this.confirmIndex;
          G.UI.drawTag(ctx, x, py + 68, 268, 54, {
            color: i === 0 ? '#3a8c86' : '#9fb0b8', label: labels[i], size: 23,
            seed: 6800 + i, selected: sel,
          });
          if (sel) G.UI.drawCursor(ctx, x - 16, py + 95);
          const self = this;
          G.UI.pointRow(x - 20, py + 64, 292, 62, function () {
            if (self.mode !== 'seal' || self.confirmIndex === i) return false;
            self.confirmIndex = i;
            return true;
          });
        }
      }
    },

    _drawSheet: function (ctx, big) {
      const s = big
        ? { x: 104, y: 70, w: 560, h: 420 }
        : SHEET;
      G.Gfx.panel(s.x, s.y, s.w, s.h, { seed: 6500, fill: '#fffdf2' });
      ctx.save();
      ctx.globalAlpha *= 0.35;
      for (let i = 0; i < Math.floor((s.h - 92) / 34); i++) {
        G.Gfx.line(s.x + 34, s.y + 92 + i * 34, s.x + s.w - 34, s.y + 92 + i * 34,
          { width: 1, seed: 6510 + i, color: '#9fb6c8' });
      }
      ctx.restore();
      G.Gfx.text(this.to, s.x + 34, s.y + 26, { size: 30, font: 'title', color: '#3a3444' });
      const slots = this._slots();
      for (let i = 0; i < slots; i++) {
        const ly = s.y + 84 + i * 56;
        const w = this.placed[i];
        if (w) {
          G.Gfx.text(w.text, s.x + 40, ly, { size: 23, color: '#3a3444', maxWidth: s.w - 80 });
        } else {
          ctx.save();
          ctx.globalAlpha *= 0.5;
          ctx.setLineDash([4, 5]);
          ctx.strokeStyle = '#8f9bab';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(s.x + 40, ly + 26);
          ctx.lineTo(s.x + s.w - 60, ly + 26);
          ctx.stroke();
          ctx.restore();
        }
      }
      G.Gfx.text(this.sign, s.x + s.w - 40, s.y + s.h - 50,
        { size: 26, font: 'title', align: 'right', color: '#3a3444' });
    },
  };

  /* ====================================================================== rock_pool */

  /** One confession line from G.DATA.confessions[from][to], or null when the table has none. */
  function confessionLine(fromId, toId) {
    const t = G.DATA.confessions;
    if (!t || !t[fromId]) return null;
    const list = t[fromId][toId] || null;
    if (!list || !list.length) return null;
    return U.choice(list);
  }

  async function rockPool(args, ctx) {
    args = args || {};
    const MB = G.UI.MessageBox;
    const mapId = (ctx && ctx.mapId) || G.State.map.id || 'map';
    const key = 'pool_joke:' + (args.id || (mapId + ':' + ((ctx && ctx.eventId) || 'pool')));
    if (args.joke && !G.State.getFlag(key)) {
      G.State.setFlag(key, true);
      await MB.show({ style: 'narrate', text: args.joke });
    }
    K().sfx('sfx_splash', { volume: 0.5 });
    const labels = ['Save', 'Skim', 'Rest', 'Leave'];
    for (let guard = 0; guard < 20; guard++) {
      const pick = await G.UI.ChoiceBox.show(labels, { cancelIndex: 3 });
      if (pick === 3 || pick < 0) return;
      if (pick === 0) {
        if (G.Scenes.has('save')) await G.Scenes.push('save', { mode: 'save' });
        else G.UI.Toast.show('There is nowhere to write just now.');
      } else if (pick === 1) {
        await skim();
      } else if (pick === 2) {
        K().fullHeal(null);
        K().sfx('sfx_heal');
        await MB.show({ style: 'narrate', text: 'Everyone sits in the shallow water for a while. Breath comes back.' });
      }
      if (autoChoice() != null && pick !== 3) return;         // tests drive one action at a time
    }
  }

  /** A friend skims everyone's ordinary Pebbles out of their pockets, and says something true. */
  async function skim() {
    const MB = G.UI.MessageBox;
    const party = K().party();
    const n = G.Party && G.Party.skim ? G.Party.skim() : 0;
    const friend = party.length > 1 ? party[1 + Math.floor(U.rng() * (party.length - 1))] : party[0];
    const to = party[0] || friend;
    if (!friend) { await MB.show({ style: 'narrate', text: 'Nobody is here to do it.' }); return; }
    K().sfx(K().hasAudio('sfx_glass_tumble') ? 'sfx_glass_tumble' : 'sfx_splash', { volume: 0.7 });
    await MB.show({
      style: 'narrate',
      text: n > 0
        ? friend.name + ' turns out everyone\'s pockets over the water. ' + n + ' pebble' + (n === 1 ? '' : 's') + ' gone.'
        : 'Nothing rattles. The pockets are already clear.',
    });
    const line = confessionLine(friend.id, to.id) || confessionLine(friend.id, 'wren');
    if (line) await MB.show({ speaker: friend.id, text: line });
  }

  /* ====================================================================== registration */

  const custom = G.Interpreter.custom;

  custom.ghost_choice = function (args) {
    return overlay(GhostChoice, Object.assign({ options: [] }, args || {}));
  };

  custom.keep_or_say = function (args) {
    return overlay(KeepOrSay, args || {});
  };

  custom.letter_compose = function (args) {
    return overlay(LetterCompose, args || {});
  };

  custom.rock_pool = function (args, ctx) {
    return rockPool(args, ctx);
  };
})();
