/*
 * battle_scene.js - the scene 'battle': intro, command input, event playback, result strip.
 *
 *   G.Scenes.push('battle', {troop, canEscape, bgm, back})
 *     -> {outcome:'peace'|'win'|'lose'|'escape'|'timeout', delivered, hushed, rounds}
 *
 * The rules live in battle_logic.js; this file only asks it for the next thing that happens, animates
 * the events it returns and collects the player's commands. Test hooks: battleAuto(policy), debugWin().
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CONFIG;
  const U = G.Util;
  const UI = G.BattleUI;
  const L = UI.L;

  /* ------------------------------------------------------------------ sound (missing ids are skipped) */

  const SFX = {
    clink: ['sfx_glass_clink', 'sfx_bell'],
    tumble: ['sfx_glass_tumble', 'sfx_feel_shift'],
    gull: ['sfx_gull_cry', 'sfx_peace'],
    hit: ['sfx_hit_soft'], hard: ['sfx_hit_hard'], crit: ['sfx_hit_crit'], miss: ['sfx_miss'],
    heal: ['sfx_heal'], skill: ['sfx_skill_cast'], swing: ['sfx_attack_swing'],
    down: ['sfx_enemy_down'], allyDown: ['sfx_ally_down'], victory: ['sfx_victory_sting'],
    levelup: ['sfx_level_up'], encounter: ['sfx_encounter'], buff: ['sfx_buff'], debuff: ['sfx_debuff'],
    page: ['sfx_page'], scribble: ['sfx_scribble'], error: ['sfx_error'], pebble: ['sfx_drone_hit'],
    talk: ['sfx_talk_success'], escape: ['sfx_escape'], guard: ['sfx_guard'], coin: ['sfx_coin'],
  };
  function sfx(name, opts) {
    const list = SFX[name] || [];
    const audio = (G.DATA.manifest && G.DATA.manifest.audio) || {};
    for (const id of list) if (audio[id]) { G.Audio.playSfx(id, opts); return; }
  }

  function skipping() {
    return !!(window.__game && window.__game.skipText);
  }

  /* ================================================================== the scene */

  const Battle = {
    opaque: true,

    /* ---------------------------------------------------------------- setup */

    enter: function (params) {
      params = params || {};
      this.params = params;
      const troop = G.DATA.troops[params.troop] || { members: [], rules: null };
      this.troop = troop;
      this.back = params.back || troop.back || (G.DATA.maps[G.State.map.id] || {}).battleback || null;
      this.b = G.BattleLogic.create({ troop: params.troop, party: G.State.party, canEscape: params.canEscape !== false });
      this.enemyX = UI.enemySlots(this.b.enemies.length);
      this.enemyBox = [];
      this.phase = 'intro';
      this.timer = 0;
      this.queue = [];
      this.cur = null;
      this.floaters = [];
      this.scraps = [];
      this.skims = [];
      this.efx = {};
      this.hint = null;
      this.message = '';
      this.mutter = '';
      this.mode = null;
      this.stack = [];
      this.menu = null;
      this.auto = null;
      this.autoName = null;
      this.result = null;
      this.resultLines = [];
      this.levelTags = [];
      this.pendingAction = null;
      this.shakeT = 0;
      this.clock = null;
      G.Audio.saveBgm();
      const bgm = params.bgm || troop.bgm || (G.DATA.system && G.DATA.system.battleBgm) || null;
      if (bgm && G.DATA.manifest.audio[bgm]) G.Audio.playBgm(bgm);
      sfx('encounter');
      this.pull();
    },

    exit: function () {
      G.Audio.restoreBgm();
    },

    /* ---------------------------------------------------------------- event plumbing */

    pull: function () {
      const events = this.b.take();
      for (const e of events) this.queue.push(e);
    },

    dur: function (n) {
      if (skipping() || this.auto) return Math.max(1, Math.round(n / 6));
      return n;
    },

    memberPos: function (idx) {
      return { x: L.partyX[idx], y: L.feetY - 70 };
    },

    enemyPos: function (idx) {
      const box = this.enemyBox[idx];
      return { x: this.enemyX[idx] || 380, y: box ? box.top + 40 : L.enemyBase - 70 };
    },

    floater: function (pos, text, o) {
      o = o || {};
      this.floaters.push({
        x: pos.x + (o.dx || 0), y: pos.y, text: String(text), t: 0, life: o.life || 46,
        color: o.color, big: !!o.big, seed: Math.floor(U.rng() * 1000), tilt: (U.rng() - 0.5) * 0.2,
      });
    },

    scrap: function (idx, text) {
      if (!text) return;
      const p = this.memberPos(idx);
      this.scraps.push({ x: p.x, y: p.y - 30, text: text, t: 0, life: 90 });
    },

    /** Starts one battle event; returns how many frames it should take. */
    play: function (e) {
      const b = this.b;
      switch (e.t) {
        case 'begin': return 1;
        case 'round':
          this.message = 'Round ' + e.round;
          return this.dur(16);
        case 'turn':
          if (e.side === 'party') this.message = e.name + '…';
          else this.message = e.name;
          return this.dur(e.side === 'party' ? 6 : 12);
        case 'message':
          this.message = e.text;
          return this.dur(30);
        case 'hint':
          this.hint = { text: G.Input.fillKeys(e.text), t: 0 };
          return this.dur(20);
        case 'clock':
          this.clock = e.text;
          this.message = e.text + ' — the can rings.';
          sfx('clink');
          return this.dur(24);
        case 'mutter':
          this.mutter = e.text;
          return this.dur(14);
        case 'phase':
          this.message = e.line || 'It changes.';
          G.Gfx.flash('#ffffff', 16);
          return this.dur(26);
        case 'glass': {
          sfx('clink', { rate: 1 + U.rng() * 0.15 });
          return this.dur(7);
        }
        case 'glassOut':
          sfx('clink', { rate: 0.8 });
          return this.dur(6);
        case 'glassLost':
          this.message = 'It rolls away into the sand.';
          return this.dur(10);
        case 'rattlePocket':
          this.efx['rattle' + e.who] = { t: 18 };
          sfx('clink', { rate: 1.3 });
          return this.dur(10);
        case 'brim':
          if (e.state) {
            this.message = b.party[e.who].name + ' is ' + e.name + '.';
            sfx('buff');
            return this.dur(22);
          }
          return this.dur(4);
        case 'spill': {
          const m = b.party[e.who];
          this.message = m.name + ': ' + e.kind + '!';
          G.Gfx.shake(5, 18);
          sfx('debuff');
          return this.dur(e.start ? 28 : 22);
        }
        case 'spillEnd':
          this.message = b.party[e.who].name + ' comes back to herself.';
          return this.dur(16);
        case 'confide': {
          const from = this.memberPos(e.from), to = this.memberPos(e.to);
          this.skims.push({ x0: from.x, x1: to.x, t: 0, life: this.dur(26), piece: e.piece });
          this.message = b.party[e.from].name + ' tells ' + b.party[e.to].name + ' something.';
          if (e.line) this.scrap(e.to, e.line);
          sfx('tumble');
          return this.dur(30);
        }
        case 'strike':
          this.message = b.party[e.who].name + ' swings the can.';
          this.efx['lunge' + e.who] = { t: 12 };
          sfx('swing');
          return this.dur(12);
        case 'skill':
          this.message = b.party[e.who].name + ': ' + e.name + (e.outLoud ? ' — out loud!' : '');
          sfx('skill');
          if (e.outLoud) G.Gfx.flash('#fff3c4', 14);
          return this.dur(20);
        case 'enemyMove':
          this.message = e.text || (b.enemies[e.enemy].name + ': ' + e.name);
          return this.dur(18);
        case 'blurt':
          this.message = 'It is winding up for ' + e.name + '!';
          sfx('debuff');
          return this.dur(26);
        case 'blurtCancel':
          this.message = e.name + ' comes to nothing.';
          sfx('guard');
          return this.dur(20);
        case 'damage': {
          const side = e.side;
          const pos = side === 'party' ? this.memberPos(e.who) : this.enemyPos(e.who);
          if (e.miss) { this.floater(pos, 'miss', { color: '#6b6276' }); sfx('miss'); return this.dur(16); }
          if (e.shielded) { this.floater(pos, 'held', { color: '#4f8fd0' }); sfx('guard'); return this.dur(16); }
          if (e.blocked) { this.message = e.blocked; this.floater(pos, '—', { color: '#6b6276' }); return this.dur(20); }
          this.floater(pos, e.amount, { color: e.crit ? '#d2452c' : '#b5432f', big: !!e.crit });
          this.efx[(side === 'party' ? 'hurt' : 'ehurt') + e.who] = { t: 12 };
          sfx(e.crit ? 'crit' : (e.amount > 30 ? 'hard' : 'hit'));
          if (e.crit) G.Gfx.shake(5, 14);
          return this.dur(18);
        }
        case 'heal': {
          const pos = e.side === 'party' ? this.memberPos(e.who) : this.enemyPos(e.who);
          this.floater(pos, '+' + e.amount, { color: '#5c8f4a' });
          sfx('heal');
          return this.dur(16);
        }
        case 'state': {
          const pos = e.side === 'party' ? this.memberPos(e.who) : this.enemyPos(e.who);
          if (e.on) {
            this.floater(pos, e.name, { color: '#7a5fa0', life: 40 });
            sfx(G.BattleLogic.STATES[e.id] && G.BattleLogic.STATES[e.id].bad ? 'debuff' : 'buff');
          }
          return this.dur(e.on ? 12 : 4);
        }
        case 'listen': {
          this.message = b.party[e.who].name + ' listens.';
          sfx('page');
          return this.dur(18);
        }
        case 'lineReveal':
          sfx('scribble', { rate: 1.2 });
          return this.dur(10);
        case 'lineGrow':
          this.message = 'It thinks of something else.';
          return this.dur(16);
        case 'lineShuffle':
          this.message = 'It changes its mind.';
          sfx('scribble');
          return this.dur(16);
        case 'say': {
          const from = this.memberPos(e.who);
          const to = this.enemyPos(e.enemy);
          this.skims.push({ x0: from.x, x1: to.x, y0: from.y + 90, y1: to.y + 30, t: 0, life: this.dur(22), piece: e.piece });
          this.message = b.party[e.who].name + ' says it.';
          return this.dur(26);
        }
        case 'lineFill':
          sfx('talk');
          this.floater(this.enemyPos(e.enemy), '✓', { color: UI.COLOURS[e.colour] || '#5c8f4a' });
          return this.dur(18);
        case 'misheard':
          this.message = 'Misheard. It takes it the wrong way.';
          this.floater(this.enemyPos(e.enemy), 'misheard', { color: '#a4514b', life: 40 });
          sfx('error');
          return this.dur(24);
        case 'shake':
          this.floater(this.enemyPos(e.enemy), 'shaken loose', { color: '#8a6a30', life: 36 });
          return this.dur(16);
        case 'delivered': {
          const e2 = b.enemies[e.enemy];
          this.efx['enemy' + e.enemy] = { kind: 'deliver', t: 0, life: this.dur(64) };
          this.message = e2.name + ' is delivered.';
          if (e.letter) this.letterPopup = { lines: e.letter, t: 0, life: this.dur(110) };
          sfx('gull');
          return this.dur(70);
        }
        case 'hushed': {
          const e2 = b.enemies[e.enemy];
          this.efx['enemy' + e.enemy] = { kind: 'hush', t: 0, life: this.dur(46) };
          this.message = e2.name + ' goes quiet.';
          sfx('down');
          return this.dur(50);
        }
        case 'winded':
          this.message = b.party[e.who].name + ' sits down in the sand.';
          sfx('allyDown');
          return this.dur(26);
        case 'stand':
          this.message = b.party[e.who].name + ' gets up.';
          return this.dur(20);
        case 'pebble':
          this.floater(this.memberPos(e.who), 'pebble', { color: '#6b6276' });
          sfx('pebble');
          return this.dur(20);
        case 'pebbleGone':
          this.floater(this.memberPos(e.who), 'pockets emptied', { color: '#5c8f4a', life: 40 });
          return this.dur(18);
        case 'brace':
          this.message = b.party[e.who].name + ' stands in front.';
          sfx('guard');
          return this.dur(16);
        case 'item':
          this.message = b.party[e.who].name + ' uses ' + e.name + '.';
          sfx('page');
          return this.dur(18);
        case 'escape':
          this.message = e.ok ? 'You go back up the beach.' : 'There is nowhere to run to down here.';
          sfx(e.ok ? 'escape' : 'error');
          return this.dur(24);
        case 'end':
          return this.dur(10);
        default:
          return this.dur(6);
      }
    },

    /* ---------------------------------------------------------------- update */

    update: function () {
      const b = this.b;
      this.timer++;
      // animations tick regardless of phase
      for (let i = this.floaters.length - 1; i >= 0; i--) if (++this.floaters[i].t > this.floaters[i].life) this.floaters.splice(i, 1);
      for (let i = this.scraps.length - 1; i >= 0; i--) if (++this.scraps[i].t > this.scraps[i].life) this.scraps.splice(i, 1);
      for (let i = this.skims.length - 1; i >= 0; i--) if (++this.skims[i].t > this.skims[i].life) this.skims.splice(i, 1);
      for (const k of Object.keys(this.efx)) {
        const f = this.efx[k];
        f.t++;
        if (f.life != null) { if (f.t > f.life) { if (f.kind) this.finishEnemyFx(k, f); delete this.efx[k]; } }
        else if (f.t > 24) delete this.efx[k];
      }
      if (this.hint) { this.hint.t++; if (this.hint.t > 150) this.hint = null; }
      if (this.letterPopup) { this.letterPopup.t++; if (this.letterPopup.t > this.letterPopup.life) this.letterPopup = null; }

      if (this.phase === 'intro') {
        if (this.timer > (skipping() ? 2 : 40)) { this.phase = 'run'; this.timer = 0; }
        return;
      }
      if (this.phase === 'result') { this.updateResult(); return; }
      if (this.phase === 'done') return;

      if (this.phase === 'anim') {
        if (this.wait > 0) { this.wait--; return; }
        this.phase = 'run';
      }
      if (this.phase === 'input') { this.updateInput(); return; }

      // 'run': play queued events, then ask the rules engine for the next thing
      if (this.queue.length) {
        const e = this.queue.shift();
        this.wait = this.play(e);
        this.phase = 'anim';
        return;
      }
      const s = b.advance();
      this.pull();
      if (this.queue.length) return;                 // play what that produced first
      if (s.state === 'end') { this.beginResult(s.result); return; }
      this.beginInput(s.actor);
    },

    finishEnemyFx: function (key, f) {
      const idx = parseInt(key.replace('enemy', ''), 10);
      const e = this.b.enemies[idx];
      if (e) e.gone = true;
    },

    /* ---------------------------------------------------------------- input */

    beginInput: function (m) {
      this.active = m;
      this.phase = 'input';
      this.mode = 'command';
      this.stack = [];
      this.cmdIndex = 0;
      this.buildCommands();
      this.message = m.name + '?';
      this.autoDelay = 0;
    },

    buildCommands: function () {
      const b = this.b, m = this.active;
      const items = [];
      const confideBlock = b.blockReason(m, 'confide');
      items.push({
        id: 'confide', label: 'Confide', enabled: !confideBlock, reason: confideBlock,
        help: 'C — pass a piece to a friend',
      });
      for (const c of b.commands(m)) items.push(c);
      this.commands = items;
      this.cmdIndex = U.clamp(this.cmdIndex, 0, items.length - 1);
    },

    pushMode: function (mode, data) {
      this.stack.push({ mode: this.mode, menu: this.menu, data: this.modeData });
      this.mode = mode;
      this.modeData = data || {};
      this.menu = null;
    },

    popMode: function () {
      const s = this.stack.pop();
      if (!s) { this.mode = 'command'; this.menu = null; return; }
      this.mode = s.mode;
      this.menu = s.menu;
      this.modeData = s.data;
    },

    updateInput: function () {
      if (this.auto) { this.updateAuto(); return; }
      const I = G.Input;
      if (this.mode === 'command') {
        if (I.pressed('confide')) {
          const c = this.commands[0];
          this.cmdIndex = 0;
          if (c.enabled) { G.UI.sfx('confirm'); this.startConfide(); }
          else { G.UI.sfx('buzzer'); this.message = c.reason; }
          return;
        }
        const n = this.commands.length;
        if (I.repeated('right') || I.repeated('down')) { this.cmdIndex = (this.cmdIndex + 1) % n; G.UI.sfx('cursor'); }
        else if (I.repeated('left') || I.repeated('up')) { this.cmdIndex = (this.cmdIndex + n - 1) % n; G.UI.sfx('cursor'); }
        else if (I.pressed('confirm')) {
          const c = this.commands[this.cmdIndex];
          if (!c.enabled) { G.UI.sfx('buzzer'); this.message = c.reason; return; }
          G.UI.sfx('confirm');
          this.chooseCommand(c.id);
        } else if (I.pressed('cancel')) {
          if (this.b.canEscape) { G.UI.sfx('cancel'); this.submit({ type: 'escape' }); }
          else { G.UI.sfx('buzzer'); this.message = 'There is nowhere to run to down here.'; }
        }
        return;
      }
      if (this.menu) {
        const ev = this.menu.update();
        if (this.mode === 'skill' && (I.pressed('left') || I.pressed('right'))) this.flipOutLoud();
        if (!ev) return;
        if (ev.type === 'cancel') { G.UI.sfx('cancel'); this.popMode(); return; }
        if (ev.type === 'disabled') { this.message = (ev.item && ev.item.reason) || 'Not now.'; return; }
        if (ev.type === 'select') this.onMenuSelect(ev.item, ev.index);
        return;
      }
      // cursor-based pickers: enemies, allies, pocket slots, letter lines
      const d = this.modeData || {};
      const list = d.list || [];
      if (I.repeated('right') || I.repeated('down')) { d.index = (d.index + 1) % list.length; G.UI.sfx('cursor'); }
      else if (I.repeated('left') || I.repeated('up')) { d.index = (d.index + list.length - 1) % list.length; G.UI.sfx('cursor'); }
      else if (I.pressed('cancel')) { G.UI.sfx('cancel'); this.popMode(); }
      else if (I.pressed('confirm')) {
        const value = list[d.index];
        if (d.check) {
          const why = d.check(value);
          if (why) { G.UI.sfx('buzzer'); this.message = why; return; }
        }
        G.UI.sfx('confirm');
        d.onPick(value);
      }
    },

    /* ---------------------------------------------------------------- command handlers */

    chooseCommand: function (id) {
      const b = this.b, m = this.active, self = this;
      switch (id) {
        case 'confide': this.startConfide(); break;
        case 'strike':
          this.pickEnemy('Which one?', function (idx) { self.submit({ type: 'strike', enemy: idx }); });
          break;
        case 'listen':
          this.pickEnemy('Listen to which?', function (idx) { self.submit({ type: 'listen', enemy: idx }); });
          break;
        case 'brace':
          this.pickAlly('Stand in front of whom?', function (idx) { self.submit({ type: 'brace', ally: idx }); }, true);
          break;
        case 'say':
          this.pickPiece('Which piece?', function (slot) {
            self.pickEnemy('Say it to whom?', function (ei) {
              self.pickLine(ei, function (li) { self.submit({ type: 'say', slot: slot, enemy: ei, line: li }); });
            });
          }, false);
          break;
        case 'skill': this.openSkills(); break;
        case 'item': this.openItems(); break;
        default: break;
      }
    },

    startConfide: function () {
      const b = this.b, m = this.active, self = this;
      // the oldest raw piece and the friend with the most free slots are pre-selected (6.1)
      let oldest = -1, seq = Infinity;
      for (let i = 0; i < 5; i++) {
        const p = m.pocket[i];
        if (p && !p.pebble && !p.t && p.seq < seq) { oldest = i; seq = p.seq; }
      }
      this.pickPiece('Confide which piece?', function (slot) {
        self.pickAlly('Tell whom?', function (idx) {
          const r = b.confide({ slot: slot, to: idx });
          if (!r.ok) { self.message = r.reason; G.UI.sfx('buzzer'); return; }
          self.pull();
          self.stack = [];
          self.mode = 'command';
          self.menu = null;
          self.buildCommands();
          self.phase = 'run';
        }, false, true);
      }, true, oldest);
    },

    pickEnemy: function (prompt, onPick) {
      const b = this.b;
      const list = b.enemies.filter(function (e) { return !e.resolved; }).map(function (e) { return e.idx; });
      if (!list.length) return;
      this.message = prompt;
      this.pushMode('enemy', { list: list, index: 0, onPick: onPick });
    },

    pickAlly: function (prompt, onPick, includeSelf, needRoom) {
      const b = this.b, m = this.active;
      const list = [];
      for (const a of b.party) {
        if (a.hp <= 0 && !needRoom) { if (includeSelf || a !== m) list.push(a.idx); continue; }
        if (a.hp <= 0) continue;
        if (!includeSelf && a === m) continue;
        if (needRoom && (a === m || !b.canReceive(a))) continue;
        list.push(a.idx);
      }
      if (!list.length) { this.message = 'Nobody can take it.'; return; }
      // pre-select the friend with the most free slots when Confiding
      let index = 0;
      if (needRoom) {
        let free = -1;
        list.forEach(function (idx, i) {
          let n = 0;
          for (const p of b.party[idx].pocket) if (!p) n++;
          if (n > free) { free = n; index = i; }
        });
      }
      this.message = prompt;
      this.pushMode('ally', { list: list, index: index, onPick: onPick });
    },

    pickPiece: function (prompt, onPick, rawOnly, preferred) {
      const m = this.active;
      const list = [];
      for (let i = 0; i < 5; i++) {
        const p = m.pocket[i];
        if (!p || p.pebble) continue;
        if (rawOnly && p.t) continue;
        list.push(i);
      }
      if (!list.length) { this.message = rawOnly ? 'Nothing raw to pass on.' : 'No glass to offer.'; G.UI.sfx('buzzer'); return; }
      let index = 0;
      if (preferred != null) { const i = list.indexOf(preferred); if (i >= 0) index = i; }
      this.message = prompt;
      this.pushMode('pocket', { list: list, index: index, onPick: onPick });
    },

    pickLine: function (enemyIdx, onPick) {
      const e = this.b.enemies[enemyIdx];
      const list = [];
      for (let i = 0; i < e.lines.length; i++) if (!e.lines[i].filled) list.push(i);
      if (!list.length) { this.message = 'Every line is full.'; return; }
      this.message = 'Which line?';
      this.pushMode('line', { list: list, index: 0, enemy: enemyIdx, onPick: onPick });
    },

    openSkills: function () {
      const b = this.b, m = this.active;
      this.rows = b.skillRows(m);
      if (!this.rows.length) { this.message = 'No skills yet.'; G.UI.sfx('buzzer'); return; }
      this.outLoud = {};
      const items = this.rows.map(function (r) {
        return {
          label: r.name, value: r.id, enabled: r.enabled, reason: r.reason,
          right: costText(r), help: G.DATA.skills[r.id].desc,
        };
      });
      this.pushMode('skill');
      this.menu = new G.UI.ListMenu({
        x: 150, y: 296, w: 330, rowH: 30, size: 20, title: 'Skill', items: items,
        visibleRows: Math.min(7, items.length), seed: 77,
      });
      this.menu.battleRows = this.rows;
    },

    flipOutLoud: function () {
      const r = this.rows[this.menu.index];
      if (!r || !r.plain || !r.outLoud) return;
      this.outLoud[r.id] = !this.outLoud[r.id];
      G.UI.sfx('cursor');
    },

    openItems: function () {
      const items = [];
      for (const id of Object.keys(G.State.inventory)) {
        const it = G.DATA.items[id];
        if (!it || !it.useInBattle || G.State.itemCount(id) <= 0) continue;
        items.push({ label: it.name, value: id, right: 'x' + G.State.itemCount(id), help: it.desc, icon: it.icon });
      }
      if (!items.length) { this.message = 'Nothing in the coat pockets.'; G.UI.sfx('buzzer'); return; }
      this.pushMode('item');
      this.menu = new G.UI.ListMenu({
        x: 150, y: 296, w: 330, rowH: 30, size: 20, title: 'Item', items: items,
        visibleRows: Math.min(6, items.length), seed: 78,
      });
    },

    onMenuSelect: function (item) {
      const self = this, b = this.b, m = this.active;
      if (this.mode === 'skill') {
        const id = item.value;
        const skill = G.DATA.skills[id];
        const row = this.rows.find(function (r) { return r.id === id; });
        const out = row.outLoud && (!row.plain || this.outLoud[id]);
        const base = { type: 'skill', skill: id, outLoud: out };
        switch (skill.target) {
          case 'enemy':
            this.pickEnemy('At which?', function (idx) { base.enemy = idx; self.submit(base); });
            break;
          case 'ally':
            this.pickAlly('For whom?', function (idx) { base.ally = idx; self.submit(base); }, true);
            break;
          case 'other_ally':
            this.pickAlly('For whom?', function (idx) { base.ally = idx; self.submit(base); }, false);
            break;
          case 'two_allies':
            this.pickAlly('Take a piece from whom?', function (from) {
              self.pickAlly('And give it to whom?', function (to) {
                base.from = from; base.to = to;
                self.submit(base);
              }, true, true);
            }, true);
            break;
          case 'self':
            if (id === 'beachcomb') {
              this.pushMode('colour', {
                list: G.BattleLogic.COLOURS, index: 0,
                onPick: function (c) { base.colour = c; self.submit(base); },
              });
              this.message = 'Which colour?';
            } else this.submit(base);
            break;
          default:
            this.submit(base);
        }
        return;
      }
      if (this.mode === 'item') {
        const id = item.value;
        const it = G.DATA.items[id];
        if (it.target === 'party') { this.submit({ type: 'item', item: id }); return; }
        this.pickAlly('For whom?', function (idx) {
          self.submit({ type: 'item', item: id, target: idx });
        }, it.target !== 'other_ally');
      }
    },

    /** Sends a command to the rules engine and goes back to playing events. */
    submit: function (cmd) {
      const ok = this.b.act(cmd);
      this.pull();
      if (!ok) {
        this.message = 'Not like that.';
        G.UI.sfx('buzzer');
        this.mode = 'command';
        this.stack = [];
        this.menu = null;
        return false;
      }
      this.active = null;
      this.mode = null;
      this.menu = null;
      this.stack = [];
      this.phase = 'run';
      return true;
    },

    /* ---------------------------------------------------------------- auto play */

    updateAuto: function () {
      if (this.autoDelay > 0) { this.autoDelay--; return; }
      const b = this.b, m = this.active;
      for (let k = 0; k < 3; k++) {
        const cmd = this.auto(b, m);
        if (!cmd) break;
        if (cmd.type === 'confide') {
          const r = b.confide(cmd);
          this.pull();
          if (!r.ok) break;
          continue;
        }
        if (this.submit(cmd)) return;
        break;
      }
      this.submit({ type: 'brace', ally: m.idx });
    },

    /**
     * Test hook: plays the rest of the battle with one of the automatic policies.
     * @param {'attack'|'smart'|'pacifist'} policy
     */
    battleAuto: function (policy) {
      this.autoName = policy || 'attack';
      this.auto = G.BattleAI.autoPolicy(this.autoName);
      if (this.phase === 'intro') { this.phase = 'run'; this.timer = 0; }
      return undefined;                  // main.js resolves with the scene's own push() promise
    },

    /** Debug key F4. */
    debugWin: function () {
      this.b.debugWin();
      this.pull();
      this.phase = 'run';
    },

    /* ---------------------------------------------------------------- result */

    beginResult: function (result) {
      const b = this.b;
      this.result = result;
      this.phase = 'result';
      this.timer = 0;
      this.levelTags = [];
      // write the battle back into the save state
      for (const m of b.party) {
        if (m.actor) m.actor.hp = Math.max(0, Math.round(m.hp));
      }
      const lines = [];
      if (result.outcome === 'lose') {
        lines.push('Everybody sits down in the sand.');
      } else if (result.outcome === 'escape') {
        lines.push('You go back up the beach.');
      } else if (result.outcome === 'timeout') {
        lines.push('Ten o’clock. The can goes quiet.');
      } else {
        G.State.setVar('delivered_count', G.State.getVar('delivered_count') + result.delivered);
        G.State.setVar('hushed_count', G.State.getVar('hushed_count') + result.hushed);
        G.State.addMoney(result.stamps);
        for (const id of result.drops) G.State.addItem(id, 1);
        for (const a of G.State.party) {
          const got = G.Party.gainExp(a, result.exp);
          for (const lv of got.levels) this.levelTags.push({ name: a.name, level: lv, learned: got.learned });
        }
        lines.push('Delivered ' + result.delivered + ' · Hushed ' + result.hushed +
          ' · ' + result.exp + ' EXP · ' + result.stamps + ' Stamps');
        if (result.drops.length) {
          lines.push('Found: ' + result.drops.map(function (d) { return G.DATA.items[d] ? G.DATA.items[d].name : d; }).join(', '));
        }
        for (const t of this.levelTags) {
          lines.push(t.name + ' is level ' + t.level + (t.learned && t.learned.length
            ? ' — learnt ' + t.learned.map(function (s) { return G.DATA.skills[s] ? G.DATA.skills[s].name : s; }).join(', ') : ''));
        }
        if (result.letters.length) lines.push('“' + result.letters[0].letter[0] + '”');
      }
      this.resultLines = lines;
      if (result.outcome !== 'lose') sfx(this.levelTags.length ? 'levelup' : 'victory');
      G.Party.recover();
    },

    updateResult: function () {
      const auto = this.auto || skipping();
      const minT = auto ? 4 : 30;
      if (this.timer < minT) return;
      if (auto || G.Input.pressed('confirm') || G.Input.pressed('cancel') || this.timer > 60 * 12) {
        this.phase = 'done';
        const r = this.result;
        G.Scenes.pop({ outcome: r.outcome, delivered: r.delivered, hushed: r.hushed, rounds: r.rounds });
      }
    },

    /* ---------------------------------------------------------------- draw */

    draw: function (ctx) {
      const b = this.b;
      UI.drawBackground(ctx, this.back, G.Gfx.frame);

      // enemies with their letter strips
      this.enemyBox = [];
      for (let i = 0; i < b.enemies.length; i++) {
        const e = b.enemies[i];
        const x = this.enemyX[i];
        const fx = this.efx['enemy' + i];
        const hurt = this.efx['ehurt' + i];
        let o = { dx: 0, dy: 0, alpha: 1 };
        if (hurt) o.dx = Math.sin(hurt.t * 1.4) * 5;
        if (fx) {
          const k = U.clamp(fx.t / fx.life, 0, 1);
          if (fx.kind === 'deliver') { o.dy = -k * 150; o.alpha = 1 - k; }
          else { o.dy = k * 12; o.alpha = 1 - k; }
        }
        const box = e.gone ? null : UI.drawEnemy(ctx, e, x, o);
        this.enemyBox[i] = box || { top: L.enemyBase - 80 };
        if (fx && fx.kind === 'deliver') this.drawGull(ctx, x, L.enemyBase, fx.t / fx.life);
        if (fx && fx.kind === 'hush') this.drawPebbleFall(ctx, x, L.enemyBase, fx.t / fx.life);
        if (!e.gone && !e.resolved) {
          const strip = UI.drawLetterStrip(ctx, b, e, x, this.enemyBox[i].top, this.enemyBox[i]);
          this.enemyBox[i].strip = strip;
          if (e.blurt) UI.drawBlurt(ctx, e, x, this.enemyBox[i].top);
        }
      }

      // the party on the tideline
      for (const m of b.party) {
        const hurt = this.efx['hurt' + m.idx];
        const lunge = this.efx['lunge' + m.idx];
        const o = { rattle: !!this.efx['rattle' + m.idx] };
        if (hurt) o.dx = Math.sin(hurt.t * 1.5) * 4;
        if (lunge) o.dy = -Math.sin((lunge.t / 12) * Math.PI) * 14;
        if (this.mode === 'pocket' && this.active === m) o.cursor = this.modeData.list[this.modeData.index];
        UI.drawPartyMember(ctx, b, m, this.active === m, o);
      }

      // glass skimming along the sand (Confide / Say)
      for (const s of this.skims) {
        const k = U.clamp(s.t / s.life, 0, 1);
        const x = U.lerp(s.x0, s.x1, k);
        const y0 = s.y0 != null ? s.y0 : L.pocketY;
        const y1 = s.y1 != null ? s.y1 : L.pocketY;
        const y = U.lerp(y0, y1, k) - Math.sin(k * Math.PI) * 26;
        UI.drawGlass(ctx, x, y, s.piece, 20);
      }

      UI.drawCanLine(ctx, b);
      UI.drawTurnRibbon(ctx, b);
      UI.drawMessageStrip(ctx, this.message, this.mutter ? '“' + this.mutter + '”' : null);

      if (this.phase === 'input' && this.active && this.mode === 'command') {
        const tags = UI.drawCommandFan(ctx, this.active, this.commands, this.cmdIndex);
        if (!this.auto) this.pointCommands(tags);
      }
      if (this.menu) {
        this.menu.draw(ctx);
        const it = this.menu.current();
        if (it) {
          const y = this.menu.y + this.menu.h + 4;
          if (it.enabled === false && it.reason) {
            G.Gfx.text('— ' + it.reason, this.menu.x + 8, y, { size: 16, color: '#a4514b', italic: true, outline: '#fbf5e6' });
          } else if (it.help) {
            G.Gfx.text(it.help, this.menu.x + 8, y, { size: 15, color: C.COLORS.inkSoft, maxWidth: 420, outline: '#fbf5e6' });
          }
        }
        if (this.mode === 'skill') this.drawSkillMode(ctx);
      }
      this.drawPickers(ctx);

      for (const f of this.floaters) UI.drawFloater(ctx, f);
      for (const s of this.scraps) UI.drawScrap(ctx, s);
      if (this.hint) UI.drawHintStrip(ctx, this.hint.text, this.hint.t);
      if (this.letterPopup) this.drawLetter(ctx, this.letterPopup);
      if (this.clock) {
        G.Gfx.text(this.clock, L.strip.x + L.strip.w + 10, L.strip.y + 10, { size: 20, font: 'title', outline: '#fbf5e6' });
      }
      if (this.phase === 'result') UI.drawResultStrip(ctx, this.resultLines, this.timer);
      if (this.phase === 'intro') {
        const a = U.clamp(1 - this.timer / 30, 0, 1);
        ctx.save();
        ctx.globalAlpha = a * 0.8;
        ctx.fillStyle = '#2b2433';
        ctx.fillRect(0, 0, C.W, C.H);
        ctx.restore();
      }
      if (this.auto) {
        G.Gfx.text('auto: ' + this.autoName, 6, C.H - 22, { size: 14, color: '#6b6276', outline: '#fbf5e6' });
      }
    },

    /** The command tags are clickable (their centres come back from drawCommandFan). */
    pointCommands: function (tags) {
      const self = this;
      this.cmdTags = tags;
      for (let i = 0; i < tags.length; i++) {
        G.UI.pointRow(tags[i].x - 41, tags[i].y - 21, 82, 34, function () {
          if (self.mode !== 'command' || self.cmdIndex === i) return false;
          self.cmdIndex = i;
          return true;
        });
      }
    },

    drawSkillMode: function (ctx) {
      const r = this.rows[this.menu.index];
      if (!r) return;
      const x = this.menu.x + this.menu.w + 12;
      const y = this.menu.y + 10;
      const self = this;
      if (r.plain && r.outLoud) {
        G.UI.pointRow(x, y, 150, 62, null, { click: function () { if (self.mode === 'skill') self.flipOutLoud(); } });
      }
      const mode = r.outLoud && (!r.plain || this.outLoud[r.id]) ? 'Out Loud' : 'Plain';
      G.Gfx.panel(x, y, 150, 62, { seed: 88, fill: '#fdf7e6' });
      G.Gfx.text(mode, x + 75, y + 20, {
        size: 21, font: 'title', align: 'center', baseline: 'middle',
        color: mode === 'Out Loud' ? '#b5432f' : C.COLORS.ink,
      });
      if (r.plain && r.outLoud) {
        G.Gfx.text('← flip →', x + 75, y + 44, { size: 15, align: 'center', baseline: 'middle', color: C.COLORS.inkSoft });
      } else if (r.outLoud) {
        G.Gfx.text('all Tumbled', x + 75, y + 44, { size: 15, align: 'center', baseline: 'middle', color: C.COLORS.inkSoft });
      }
    },

    drawPickers: function (ctx) {
      const d = this.modeData;
      if (!d || !d.list || this.phase !== 'input') return;
      if (!this.auto) this.pointPickers(d);
      const value = d.list[d.index];
      if (this.mode === 'enemy') {
        const x = this.enemyX[value];
        const box = this.enemyBox[value] || { top: 200 };
        G.UI.drawCursor(ctx, x, box.top - 16, {});
      } else if (this.mode === 'ally') {
        G.UI.drawCursor(ctx, L.partyX[value], L.feetY - L.spriteH - 16, {});
      } else if (this.mode === 'line') {
        const e = this.b.enemies[d.enemy];
        const strip = (this.enemyBox[d.enemy] || {}).strip;
        if (strip) {
          G.UI.drawCursor(ctx, strip.x - strip.w / 2 - 6, strip.y + 19 + value * 16, {});
        }
      } else if (this.mode === 'colour') {
        const x = 280, y = 330;
        G.Gfx.panel(x - 12, y - 30, 220, 60, { seed: 91, fill: '#fdf7e6' });
        for (let i = 0; i < d.list.length; i++) {
          UI.drawGlass(ctx, x + 20 + i * 48, y, { c: d.list[i], t: false, seq: i + 1 }, 28);
          if (i === d.index) G.UI.drawCursor(ctx, x + 20 + i * 48 - 22, y, {});
        }
      }
    },

    /** Click targets for the cursor pickers: enemies, allies, Lines on a letter strip, colours, pocket slots. */
    pointPickers: function (d) {
      const self = this, mode = this.mode;
      const at = function (i, x, y, w, h) {
        G.UI.pointRow(x, y, w, h, function () {
          if (self.modeData !== d || self.mode !== mode || d.index === i) return false;
          d.index = i;
          return true;
        });
      };
      for (let i = 0; i < d.list.length; i++) {
        const value = d.list[i];
        if (mode === 'enemy') {
          const box = this.enemyBox[value] || {};
          const w = box.w || 120, h = box.h || 90, top = box.top != null ? box.top : L.enemyBase - h;
          at(i, (this.enemyX[value] || 380) - w / 2, top, w, h);
        } else if (mode === 'ally') {
          at(i, L.partyX[value] - L.spriteW / 2 - 8, L.feetY - L.spriteH, L.spriteW + 16, L.spriteH + 12);
        } else if (mode === 'line') {
          const strip = (this.enemyBox[d.enemy] || {}).strip;
          if (strip) at(i, strip.x - strip.w / 2, strip.y + 11 + value * 16, strip.w, 16);
        } else if (mode === 'colour') {
          at(i, 280 + 20 + i * 48 - 24, 330 - 24, 48, 48);
        } else if (mode === 'pocket' && this.active) {
          const x = L.partyX[this.active.idx] + (value - 2) * L.slotGap;
          at(i, x - L.slotGap / 2, L.pocketY - 14, L.slotGap, 28);
        }
      }
    },

    drawGull: function (ctx, x, y, k) {
      const gx = x + k * 210, gy = y - 60 - k * 240;
      const flap = Math.sin(k * 26) * 12;
      ctx.save();
      ctx.globalAlpha = U.clamp(1.2 - k, 0, 1);
      ctx.strokeStyle = '#fdf7e6';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(gx - 26, gy + flap);
      ctx.quadraticCurveTo(gx - 8, gy - 8, gx, gy);
      ctx.quadraticCurveTo(gx + 8, gy - 8, gx + 26, gy - flap);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(43,36,51,0.45)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    },

    drawPebbleFall: function (ctx, x, y, k) {
      const py = y - 40 + U.ease.in(k) * 40;
      UI.drawGlass(ctx, x, py, { pebble: true, story: false }, 18 + 10 * (1 - k));
    },

    drawLetter: function (ctx, p) {
      const a = U.clamp(Math.min(p.t, p.life - p.t) / 12, 0, 1);
      ctx.save();
      ctx.globalAlpha *= a;
      const w = 460, x = (C.W - w) / 2, y = 108;
      G.Gfx.panel(x, y, w, 76, { seed: 606, fill: '#fffdf2' });
      G.Gfx.text(p.lines[0], x + w / 2, y + 24, { size: 18, align: 'center', baseline: 'middle', maxWidth: w - 28, italic: true });
      G.Gfx.text(p.lines[1], x + w / 2, y + 52, { size: 18, align: 'center', baseline: 'middle', maxWidth: w - 28, italic: true });
      ctx.restore();
    },
  };

  /** "1 Blue" / "2 Red" / "Tumbled" / "free" as a right-aligned cost label. */
  function costText(row) {
    const c = row.cost || {};
    if (c.free) return 'free';
    if (c.call) return 'two cans';
    if (c.tumbled) return 'Tumbled x' + c.tumbled;
    const parts = [];
    for (const col of G.BattleLogic.COLOURS) {
      if (c[col]) parts.push(c[col] + ' ' + G.BattleLogic.COLOUR_NAME[col]);
    }
    return parts.join(' + ');
  }

  G.Scenes.register('battle', Battle);
})();
