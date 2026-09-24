/*
 * menu_scene.js - scene 'menu': the pause menu of DESIGN_BIBLE 9.2, opened by the map scene.
 *
 * It looks like the inside of Wren's open coat: a column of seven luggage tags on the left (x 24-250)
 * and a content pane on the right. The seven tabs are
 *   Pockets (status)  Skills  Items  Keepsakes  Delivered Mail  Coat Pocket  Options
 *
 * Params:
 *   {}                      the normal pause menu (cancel closes it)
 *   { tab:'options' }       opens on a named tab
 *   { onlyOptions:true }    just the Options pane, for the title screen (no coat, no other tabs)
 *
 * Everything that needs the battle module goes through G.SceneKit, which falls back to code-drawn
 * stand-ins when js/battle is not loaded (G.Party, G.BattleUI.drawGlass).
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CONFIG;
  const U = G.Util;
  const INK = C.COLORS.ink;
  const SOFT = C.COLORS.inkSoft;

  const PANE = { x: 264, y: 54, w: 488, h: 484 };
  const COL = { x: 24, y: 70, w: 226, h: 50, gap: 62 };

  function K() { return G.SceneKit; }

  /* ====================================================================== small shared drawing */

  /** A member's portrait in a little paper frame (or their initial when there is no face image). */
  function drawFace(ctx, x, y, size, actor, alpha) {
    const face = K().faceId(actor.id);
    ctx.save();
    if (alpha != null) ctx.globalAlpha *= alpha;
    G.Gfx.panel(x, y, size, size, { seed: U.hash(actor.id) % 900, fill: C.COLORS.paperShade, lineWidth: 1.8 });
    if (face) {
      const b = G.Gfx.boil(actor.id);
      G.Gfx.drawImg(face, x + size / 2 + b.dx * 0.5, y + size / 2 + b.dy * 0.5, {
        w: size - 6, h: size - 6, anchorX: 0.5, anchorY: 0.5, rot: b.rot * 0.5,
      });
    } else {
      G.Gfx.text(String(actor.name || actor.id).charAt(0).toUpperCase(), x + size / 2, y + size / 2, {
        size: size * 0.6, font: 'title', align: 'center', baseline: 'middle', color: K().actorColor(actor.id),
      });
    }
    ctx.restore();
  }

  /** Pebbles of a member, drawn as pebble glyphs (story Pebbles are outlined in the accent colour). */
  function drawPebbles(ctx, x, y, actor) {
    const p = K().pebbles(actor);
    const total = Math.min(4, (p.ordinary || 0) + (p.story || 0));
    if (!total) {
      G.Gfx.text('pockets clear', x, y, { size: 16, baseline: 'middle', color: SOFT });
      return;
    }
    for (let i = 0; i < total; i++) {
      K().glass(ctx, x + 11 + i * 20, y, { pebble: true, story: i >= (p.ordinary || 0) }, 18);
      if (i >= (p.ordinary || 0)) {
        ctx.save();
        ctx.globalAlpha *= 0.85;
        ctx.strokeStyle = C.COLORS.accent;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(x + 11 + i * 20, y, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /** Cost of a skill as glass pips; returns the width it used. */
  function drawCost(ctx, x, y, cost) {
    if (!cost) { G.Gfx.text('—', x, y, { size: 18, baseline: 'middle', color: SOFT }); return 16; }
    if (cost.free) {
      const s = cost.cooldown ? 'free · every ' + cost.cooldown : 'free';
      G.Gfx.text(s, x, y, { size: 16, baseline: 'middle', color: SOFT });
      return G.Gfx.measure(s, { size: 16 }).w;
    }
    let dx = 0;
    if (cost.tumbled) {
      for (let i = 0; i < cost.tumbled; i++) { K().glass(ctx, x + 10 + dx, y, { c: 'green', t: true }, 18); dx += 20; }
      return dx;
    }
    for (const c of ['red', 'blue', 'amber', 'green']) {
      for (let i = 0; i < (cost[c] || 0); i++) { K().glass(ctx, x + 10 + dx, y, { c: c, t: false }, 18); dx += 20; }
    }
    return dx || 16;
  }

  /** A small slider row for the options pane. */
  function drawSlider(ctx, x, y, w, ratio, color) {
    G.UI.Gauge.draw(ctx, x, y, w, 14, ratio, { color: color || '#7fb2d9', seed: 404 });
  }

  /**
   * A clickable row inside the pane. Hovering only moves the cursor while the pane has focus; a click
   * also moves focus into the pane. select() moves the tab's own cursor and returns true when it changed.
   */
  function paneRow(s, x, y, w, h, select, opts) {
    G.UI.pointRow(x, y, w, h, function (kind) {
      if (kind === 'hover' && s.focus !== 'pane') return false;
      const was = s.focus;
      s.focus = 'pane';
      return select() || was !== 'pane';
    }, opts);
  }

  /* ====================================================================== tabs */

  /**
   * Every tab implements: title, interactive (can the cursor go into the pane),
   * enter(scene), update(scene) -> 'back'|null, draw(ctx, scene, x, y, w, h).
   */
  const TABS = {};

  /* ---------------------------------------------------------------- 1. Pockets */

  TABS.pockets = {
    title: 'Pockets',
    interactive: false,
    enter: function () {},
    update: function () { return null; },
    draw: function (ctx, scene, x, y, w, h) {
      const party = K().party();
      if (!party.length) { G.Gfx.text('Nobody yet.', x + 20, y + 20, { size: 22, color: SOFT }); return; }
      const ch = Math.min(112, Math.floor((h - 10) / Math.max(1, party.length)));
      for (let i = 0; i < party.length; i++) {
        const a = party[i];
        const st = K().stats(a);
        const cy = y + 6 + i * ch;
        const col = K().actorColor(a.id);
        G.Gfx.panel(x + 6, cy, w - 12, ch - 8, { seed: 1200 + i * 3, fill: '#fdf8ea', lineWidth: 1.8 });
        drawFace(ctx, x + 14, cy + 8, ch - 24, a);
        const tx = x + 14 + (ch - 24) + 14;
        G.Gfx.text(a.name || a.id, tx, cy + 8, { size: 25, font: 'title', color: col });
        const lvw = G.Gfx.measure(a.name || a.id, { size: 25, font: 'title' }).w;
        G.Gfx.text('LV ' + (a.level || 1), tx + lvw + 12, cy + 15, { size: 18, color: SOFT });
        const mhp = st.mhp;
        const hp = Math.max(0, Math.min(mhp, a.hp == null ? mhp : a.hp));
        G.Gfx.text('Breath', tx, cy + 40, { size: 16, color: SOFT });
        G.UI.Gauge.draw(ctx, tx + 54, cy + 41, 128, 13, mhp ? hp / mhp : 0, { color: '#6fb0a8', seed: 90 + i });
        G.Gfx.text(hp + '/' + mhp, tx + 190, cy + 39, { size: 17, color: INK });
        const stats = 'Arm ' + st.atk + '   Coat ' + st.def + '   Pace ' + st.spd;
        G.Gfx.text(stats, tx, cy + 60, { size: 18, color: INK });
        const next = K().expToNext(a);
        G.Gfx.text(next == null ? 'nothing left to learn' : next + ' EXP to next', tx, cy + 82, { size: 16, color: SOFT });
        const keep = a.equips && a.equips.keepsake;
        G.Gfx.text(keep ? K().itemName(keep) : 'no keepsake', x + w - 18, cy + 12,
          { size: 17, align: 'right', color: keep ? INK : SOFT });
        drawPebbles(ctx, x + w - 110, cy + 44, a);
        if (a.id === 'lin') {
          G.Gfx.text('tide table: LOW HIGH FLOOD EBB', x + w - 18, cy + ch - 34,
            { size: 15, align: 'right', color: SOFT });
        }
      }
    },
  };

  /* ---------------------------------------------------------------- 2. Skills */

  TABS.skills = {
    title: 'Skills',
    interactive: true,
    enter: function (s) {
      s.skillMember = Math.min(s.skillMember || 0, Math.max(0, K().party().length - 1));
      s.skillIndex = 0;
    },
    update: function (s) {
      const party = K().party();
      const a = party[s.skillMember];
      const list = a ? K().knownSkills(a) : [];
      if (G.Input.repeated('right') || G.Input.repeated('left')) {
        const d = G.Input.repeated('right') ? 1 : -1;
        s.skillMember = (s.skillMember + d + party.length) % Math.max(1, party.length);
        s.skillIndex = 0;
        G.UI.sfx('cursor');
      } else if (G.Input.repeated('down') || G.Input.repeated('up')) {
        const d = G.Input.repeated('down') ? 1 : -1;
        if (list.length) { s.skillIndex = (s.skillIndex + d + list.length) % list.length; G.UI.sfx('cursor'); }
      } else if (G.Input.pressed('cancel')) {
        return 'back';
      }
      return null;
    },
    draw: function (ctx, s, x, y, w, h) {
      const party = K().party();
      const a = party[s.skillMember];
      for (let i = 0; i < party.length; i++) {
        const m = party[i];
        G.UI.drawTag(ctx, x + 8 + i * 112, y + 2, 104, 36, {
          color: K().actorColor(m.id), label: m.name || m.id, size: 19, seed: 70 + i,
          selected: i === s.skillMember && s.focus === 'pane', shadow: i === s.skillMember,
          disabled: i !== s.skillMember,
        });
        paneRow(s, x + 8 + i * 112, y + 2, 104, 36, function () {
          if (s.skillMember === i) return false;
          s.skillMember = i; s.skillIndex = 0;
          return true;
        }, { confirm: false });
      }
      if (!a) return;
      const list = K().knownSkills(a);
      const rowH = 34;
      const top = y + 50;
      const rows = Math.min(list.length, Math.floor((h - 150) / rowH));
      const first = U.clamp(s.skillIndex - Math.floor(rows / 2), 0, Math.max(0, list.length - rows));
      for (let i = first; i < Math.min(list.length, first + rows); i++) {
        const def = K().skillDef(list[i]) || { name: list[i] };
        const ry = top + (i - first) * rowH;
        const sel = i === s.skillIndex;
        if (sel) G.UI.drawHighlight(ctx, x + 22, ry + 2, w - 46, rowH - 6, 500 + i);
        if (sel && s.focus === 'pane') G.UI.drawCursor(ctx, x + 14, ry + rowH / 2);
        paneRow(s, x + 6, ry, w - 12, rowH, function () {
          if (s.skillIndex === i) return false;
          s.skillIndex = i;
          return true;
        }, { confirm: false });
        let nx = x + 30;
        if (def.call && def.call.partner) {            // Two-Can Call: both faces
          const p = G.State.actor(def.call.partner);
          drawFace(ctx, nx, ry + 2, 26, a, 1);
          if (p) drawFace(ctx, nx + 22, ry + 2, 26, p, 1);
          nx += 56;
        }
        G.Gfx.text(def.name || list[i], nx, ry + rowH / 2, { size: 21, baseline: 'middle' });
        drawCost(ctx, x + w - 130, ry + rowH / 2, def.cost);
      }
      const cur = K().skillDef(list[s.skillIndex]);
      const by = y + h - 92;
      G.Gfx.panel(x + 10, by, w - 20, 84, { seed: 515, fill: C.COLORS.paperShade });
      if (cur) {
        G.Text.drawRich(cur.desc || '', x + 24, by + 10, { maxWidth: w - 48, size: 19 });
        G.Gfx.text(cur.flavor ? '"' + cur.flavor + '"' : '', x + 24, by + 54, { size: 17, color: SOFT, italic: true });
      } else {
        G.Gfx.text('Nothing learnt yet.', x + 24, by + 28, { size: 19, color: SOFT });
      }
    },
  };

  /* ---------------------------------------------------------------- 3. Items */

  TABS.items = {
    title: 'Items',
    interactive: true,
    enter: function (s) {
      s.itemIndex = 0;
      s.itemTarget = -1;                                 // -1 = picking an item, otherwise picking a member
    },
    list: function () {
      const inv = G.State.inventory || {};
      return Object.keys(inv).filter(function (id) { return inv[id] > 0; });
    },
    update: function (s) {
      const list = TABS.items.list();
      if (s.itemTarget >= 0) {
        const party = K().party();
        if (G.Input.repeated('right') || G.Input.repeated('down')) { s.itemTarget = (s.itemTarget + 1) % party.length; G.UI.sfx('cursor'); }
        else if (G.Input.repeated('left') || G.Input.repeated('up')) { s.itemTarget = (s.itemTarget + party.length - 1) % party.length; G.UI.sfx('cursor'); }
        else if (G.Input.pressed('cancel')) { s.itemTarget = -1; G.UI.sfx('cancel'); }
        else if (G.Input.pressed('confirm')) {
          const id = list[s.itemIndex];
          const user = G.State.party[0] || null;
          const target = party[s.itemTarget];
          let r = { ok: false, message: 'Nothing happens.' };
          if (G.Party && G.Party.useInMenu) r = G.Party.useInMenu(id, user, target) || r;
          G.UI.Toast.show(r.message, { icon: K().itemIcon(id), frames: 110 });
          G.UI.sfx(r.ok ? 'confirm' : 'buzzer');
          if (r.ok) K().sfx('sfx_heal', { volume: 0.7 });
          s.itemTarget = -1;
          if (!G.State.itemCount(id)) s.itemIndex = Math.max(0, Math.min(s.itemIndex, TABS.items.list().length - 1));
        }
        return null;
      }
      if (G.Input.repeated('down') || G.Input.repeated('up')) {
        const d = G.Input.repeated('down') ? 1 : -1;
        if (list.length) { s.itemIndex = (s.itemIndex + d + list.length) % list.length; G.UI.sfx('cursor'); }
      } else if (G.Input.pressed('confirm')) {
        const id = list[s.itemIndex];
        const usable = id && G.Party && G.Party.canUseInMenu
          ? K().party().some(function (m) { return G.Party.canUseInMenu(id, m); })
          : false;
        if (!usable) { G.UI.sfx('buzzer'); return null; }
        G.UI.sfx('confirm');
        s.itemTarget = 0;
      } else if (G.Input.pressed('cancel')) {
        return 'back';
      }
      return null;
    },
    draw: function (ctx, s, x, y, w, h) {
      const list = TABS.items.list();
      const rowH = 34;
      const rows = Math.floor((h - 170) / rowH);
      if (!list.length) G.Gfx.text('Pockets are empty.', x + 24, y + 16, { size: 22, color: SOFT });
      const first = U.clamp(s.itemIndex - Math.floor(rows / 2), 0, Math.max(0, list.length - rows));
      for (let i = first; i < Math.min(list.length, first + rows); i++) {
        const id = list[i];
        const def = K().itemDef(id);
        const ry = y + 8 + (i - first) * rowH;
        const sel = i === s.itemIndex;
        if (sel) G.UI.drawHighlight(ctx, x + 22, ry + 2, w - 46, rowH - 6, 700 + i);
        if (sel && s.focus === 'pane' && s.itemTarget < 0) G.UI.drawCursor(ctx, x + 14, ry + rowH / 2);
        paneRow(s, x + 6, ry, w - 12, rowH, function () {
          if (s.itemTarget >= 0) { s.itemTarget = -1; s.itemIndex = i; return true; }   // changed their mind
          if (s.itemIndex === i) return false;
          s.itemIndex = i;
          return true;
        });
        const icon = K().itemIcon(id);
        let tx = x + 32;
        if (icon) { G.Gfx.drawImg(icon, tx, ry + rowH / 2, { w: 26, h: 26, anchorY: 0.5 }); tx += 32; }
        const key = def && def.kind === 'key';
        G.Gfx.text(K().itemName(id), tx, ry + rowH / 2, { size: 21, baseline: 'middle', color: key ? SOFT : INK });
        G.Gfx.text('x' + G.State.itemCount(id), x + w - 26, ry + rowH / 2,
          { size: 20, align: 'right', baseline: 'middle', color: SOFT });
      }
      // description / target picker
      const by = y + h - 148;
      G.Gfx.panel(x + 10, by, w - 20, 138, { seed: 717, fill: C.COLORS.paperShade });
      const cur = list.length ? K().itemDef(list[s.itemIndex]) : null;
      G.Text.drawRich(cur && cur.desc ? cur.desc : (list.length ? '' : 'Nothing to use.'), x + 24, by + 10,
        { maxWidth: w - 48, size: 19 });
      if (cur && cur.flavor) {
        G.Gfx.text('"' + cur.flavor + '"', x + 24, by + 42, { size: 17, color: SOFT, italic: true, maxWidth: w - 48 });
      }
      const party = K().party();
      for (let i = 0; i < party.length; i++) {
        const m = party[i];
        const mhp = K().stats(m).mhp;
        const sel = s.itemTarget === i;
        G.UI.drawTag(ctx, x + 20 + i * 112, by + 74, 104, 46, {
          color: K().actorColor(m.id), label: m.name || m.id, size: 19, seed: 940 + i,
          selected: sel, disabled: s.itemTarget < 0,
        });
        if (s.itemTarget >= 0) {
          paneRow(s, x + 20 + i * 112, by + 74, 104, 46, function () {
            if (s.itemTarget < 0 || s.itemTarget === i) return false;
            s.itemTarget = i;
            return true;
          });
        }
        G.Gfx.text((m.hp == null ? mhp : m.hp) + '/' + mhp, x + 20 + i * 112 + 52, by + 74 + 34,
          { size: 15, align: 'center', color: SOFT });
      }
      if (s.itemTarget >= 0) G.Gfx.text('Use on whom?', x + w - 26, by + 78, { size: 18, align: 'right', color: INK });
    },
  };

  /* ---------------------------------------------------------------- 4. Keepsakes */

  TABS.keepsakes = {
    title: 'Keepsakes',
    interactive: true,
    enter: function (s) { s.keepMember = 0; s.keepList = -1; },
    options: function () {
      const inv = G.State.inventory || {};
      const out = [null];
      for (const id of Object.keys(inv)) {
        const d = K().itemDef(id);
        if (d && d.kind === 'keepsake' && inv[id] > 0) out.push(id);
      }
      return out;
    },
    update: function (s) {
      const party = K().party();
      if (s.keepList >= 0) {
        const opts = TABS.keepsakes.options();
        if (G.Input.repeated('down') || G.Input.repeated('up')) {
          const d = G.Input.repeated('down') ? 1 : -1;
          s.keepList = (s.keepList + d + opts.length) % opts.length;
          G.UI.sfx('cursor');
        } else if (G.Input.pressed('cancel')) { s.keepList = -1; G.UI.sfx('cancel'); }
        else if (G.Input.pressed('confirm')) {
          const a = party[s.keepMember];
          const id = opts[s.keepList];
          if (a && G.Party && G.Party.equipKeepsake) G.Party.equipKeepsake(a, id);
          else if (a) { a.equips = a.equips || {}; a.equips.keepsake = id; }
          G.UI.sfx('confirm');
          K().sfx('sfx_key_item', { volume: 0.6 });
          s.keepList = -1;
        }
        return null;
      }
      if (G.Input.repeated('down') || G.Input.repeated('up')) {
        const d = G.Input.repeated('down') ? 1 : -1;
        s.keepMember = (s.keepMember + d + party.length) % Math.max(1, party.length);
        G.UI.sfx('cursor');
      } else if (G.Input.pressed('confirm')) { s.keepList = 0; G.UI.sfx('confirm'); }
      else if (G.Input.pressed('cancel')) return 'back';
      return null;
    },
    draw: function (ctx, s, x, y, w, h) {
      const party = K().party();
      const rowH = 62;
      for (let i = 0; i < party.length; i++) {
        const a = party[i];
        const ry = y + 8 + i * rowH;
        const sel = i === s.keepMember;
        if (sel) G.UI.drawHighlight(ctx, x + 22, ry + 2, w - 46, rowH - 10, 810 + i);
        if (sel && s.focus === 'pane' && s.keepList < 0) G.UI.drawCursor(ctx, x + 14, ry + rowH / 2 - 4);
        paneRow(s, x + 6, ry, w - 12, rowH - 6, function () {
          if (s.keepList >= 0) { s.keepList = -1; s.keepMember = i; return true; }
          if (s.keepMember === i) return false;
          s.keepMember = i;
          return true;
        });
        drawFace(ctx, x + 28, ry, 46, a);
        G.Gfx.text(a.name || a.id, x + 84, ry + 4, { size: 22, font: 'title', color: K().actorColor(a.id) });
        const keep = a.equips && a.equips.keepsake;
        G.Gfx.text(keep ? K().itemName(keep) : '(empty slot)', x + 84, ry + 30,
          { size: 19, color: keep ? INK : SOFT });
      }
      const by = y + 8 + party.length * rowH + 6;
      const bh = y + h - by - 6;
      G.Gfx.panel(x + 10, by, w - 20, bh, { seed: 818, fill: C.COLORS.paperShade });
      const a = party[s.keepMember];
      if (!a) return;
      const opts = TABS.keepsakes.options();
      if (s.keepList < 0) {
        const keep = a.equips && a.equips.keepsake;
        const d = keep ? K().itemDef(keep) : null;
        G.Gfx.text(d ? d.desc || '' : 'Choose a keepsake to wear. One each.', x + 24, by + 12,
          { size: 19, color: d ? INK : SOFT, maxWidth: w - 48 });
        if (d && d.flavor) G.Gfx.text('"' + d.flavor + '"', x + 24, by + 40, { size: 17, color: SOFT, italic: true, maxWidth: w - 48 });
        return;
      }
      // list + stat preview
      const rows = Math.max(1, Math.floor((bh - 16) / 28));
      const first = U.clamp(s.keepList - Math.floor(rows / 2), 0, Math.max(0, opts.length - rows));
      for (let i = first; i < Math.min(opts.length, first + rows); i++) {
        const id = opts[i];
        const ry = by + 10 + (i - first) * 28;
        const sel = i === s.keepList;
        if (sel) { G.UI.drawHighlight(ctx, x + 26, ry - 2, 230, 26, 890 + i); G.UI.drawCursor(ctx, x + 20, ry + 10); }
        paneRow(s, x + 14, ry - 3, 250, 28, function () {
          if (s.keepList === i) return false;
          s.keepList = i;
          return true;
        });
        G.Gfx.text(id ? K().itemName(id) : '(take it off)', x + 38, ry, { size: 19, color: id ? INK : SOFT });
      }
      const cur = K().stats(a);
      const next = previewStats(a, opts[s.keepList]);
      const px = x + w - 190;
      const names = [['Breath', 'mhp'], ['Arm', 'atk'], ['Coat', 'def'], ['Pace', 'spd']];
      for (let i = 0; i < names.length; i++) {
        const py = by + 12 + i * 24;
        const from = cur[names[i][1]], to = next[names[i][1]];
        G.Gfx.text(names[i][0], px, py, { size: 18, color: SOFT });
        G.Gfx.text(String(from), px + 74, py, { size: 18, align: 'right' });
        if (to !== from) {
          G.Gfx.text('→ ' + to, px + 84, py, {
            size: 18, color: to > from ? '#4c8f4e' : '#cf4a3e',
          });
        }
      }
    },
  };

  /** Stats the member would have while wearing `itemId` (nothing is changed). */
  function previewStats(actor, itemId) {
    const cur = K().stats(actor);
    const wornId = actor.equips && actor.equips.keepsake;
    const worn = wornId ? K().itemDef(wornId) : null;
    const next = itemId ? K().itemDef(itemId) : null;
    const map = { hp: 'mhp', mhp: 'mhp', atk: 'atk', def: 'def', spd: 'spd' };
    const out = { mhp: cur.mhp, atk: cur.atk, def: cur.def, spd: cur.spd };
    const apply = function (def, sign) {
      if (!def || !def.stats) return;
      for (const k of Object.keys(def.stats)) {
        const key = map[k];
        if (key) out[key] += sign * (def.stats[k] || 0);
      }
    };
    apply(worn, -1);
    apply(next, 1);
    return out;
  }

  /* ---------------------------------------------------------------- 5. Delivered Mail */

  TABS.album = {
    title: 'Delivered Mail',
    interactive: true,
    cols: 5,
    enter: function (s) { s.albumIndex = 0; },
    entries: function () {
      const all = G.DATA.enemies || {};
      return Object.keys(all).filter(function (id) { return !all[id].hidden; });
    },
    resolve: function (id) {
      const all = G.DATA.enemies || {};
      const e = all[id] || {};
      const base = e.base ? all[e.base] || {} : {};
      return {
        id: id,
        name: e.name || base.name || id,
        img: e.img || base.img || null,
        lines: e.lines || base.lines || [],
        letter: e.letter || base.letter || null,
      };
    },
    update: function (s) {
      const list = TABS.album.entries();
      const cols = TABS.album.cols;
      let moved = 0;
      if (G.Input.repeated('right')) moved = 1;
      else if (G.Input.repeated('left')) moved = -1;
      else if (G.Input.repeated('down')) moved = cols;
      else if (G.Input.repeated('up')) moved = -cols;
      if (moved && list.length) {
        const n = list.length;
        s.albumIndex = (s.albumIndex + moved + n * 2) % n;
        G.UI.sfx('cursor');
        return null;
      }
      if (G.Input.pressed('cancel')) return 'back';
      if (G.Input.pressed('confirm')) G.UI.sfx('page');
      return null;
    },
    draw: function (ctx, s, x, y, w, h) {
      const list = TABS.album.entries();
      const album = (G.State && G.State.album) || {};
      const cols = TABS.album.cols;
      const cellW = Math.floor((w - 24) / cols), cellH = 74;
      const detailH = 176;
      const rows = Math.max(1, Math.floor((h - detailH - 16) / cellH));
      const curRow = Math.floor(s.albumIndex / cols);
      const firstRow = U.clamp(curRow - Math.floor(rows / 2), 0, Math.max(0, Math.ceil(list.length / cols) - rows));
      for (let i = firstRow * cols; i < Math.min(list.length, (firstRow + rows) * cols); i++) {
        const e = TABS.album.resolve(list[i]);
        const rec = album[list[i]];
        const cx = x + 12 + (i % cols) * cellW;
        const cy = y + 8 + (Math.floor(i / cols) - firstRow) * cellH;
        const sel = i === s.albumIndex;
        G.Gfx.panel(cx + 2, cy + 2, cellW - 6, cellH - 8, {
          seed: 1300 + i, fill: rec ? '#fdf8ea' : '#ece4d2', lineWidth: sel ? 2.6 : 1.6,
        });
        if (rec && e.img && G.Assets.has(e.img)) {
          const sz = G.Assets.size(e.img);
          const k = Math.min((cellW - 18) / sz.w, (cellH - 22) / sz.h);
          G.Gfx.drawImg(e.img, cx + cellW / 2 - 2, cy + cellH / 2 - 3, {
            w: sz.w * k, h: sz.h * k, anchorX: 0.5, anchorY: 0.5,
          });
        } else {
          drawEnvelope(ctx, cx + cellW / 2 - 2, cy + cellH / 2 - 4, 40, !rec);
        }
        if (rec && rec.delivered > 0) {
          G.Gfx.text('✓', cx + cellW - 16, cy + 6, { size: 17, align: 'right', color: '#4c8f4e' });
        } else if (rec && rec.hushed > 0) {
          K().glass(ctx, cx + cellW - 16, cy + 14, { pebble: true }, 14);
        }
        if (sel) G.UI.drawCursor(ctx, cx + 6, cy + cellH / 2 - 4);
        paneRow(s, cx + 2, cy + 2, cellW - 6, cellH - 8, function () {
          if (s.albumIndex === i) return false;
          s.albumIndex = i;
          return true;
        }, { confirm: false });
      }
      // detail
      const by = y + h - detailH;
      G.Gfx.panel(x + 10, by, w - 20, detailH - 6, { seed: 1390, fill: C.COLORS.paperShade });
      if (!list.length) { G.Gfx.text('No mail yet.', x + 26, by + 16, { size: 20, color: SOFT }); return; }
      const e = TABS.album.resolve(list[s.albumIndex]);
      const rec = album[list[s.albumIndex]];
      G.Gfx.text(rec ? e.name : '???', x + 26, by + 10, { size: 26, font: 'title' });
      // known Lines
      const lines = e.lines || [];
      G.Gfx.text('Lines', x + 26, by + 48, { size: 17, color: SOFT });
      for (let i = 0; i < lines.length; i++) {
        const known = rec && rec.linesKnown && rec.linesKnown[i];
        const lx = x + 80 + i * 26;
        if (known) K().glass(ctx, lx, by + 56, { c: lines[i].c === 'any' ? 'green' : lines[i].c, t: !!lines[i].star }, 20);
        else {
          K().glass(ctx, lx, by + 56, null, 20);
          G.Gfx.text('?', lx, by + 48, { size: 16, align: 'center', color: SOFT });
        }
      }
      let msg;
      if (rec && rec.letter && e.letter && (e.letter[0] || e.letter[1])) msg = e.letter.join('\n');
      else if (rec && rec.hushed > 0 && (!rec.delivered || !rec.letter)) msg = 'It went quiet.';
      else if (rec) msg = 'Not delivered yet.';
      else msg = 'You have not met this one.';
      G.Text.drawRich(msg, x + 26, by + 80, { maxWidth: w - 56, size: 19 });
      if (rec) {
        G.Gfx.text('delivered ' + (rec.delivered || 0) + ' · hushed ' + (rec.hushed || 0),
          x + w - 26, by + 12, { size: 16, align: 'right', color: SOFT });
      }
    },
  };

  /** A little code-drawn envelope, used when an enemy illustration is missing or unknown. */
  function drawEnvelope(ctx, x, y, w, grey) {
    const h = w * 0.68;
    ctx.save();
    ctx.translate(x - w / 2, y - h / 2);
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.lineWidth = 1.8;
    ctx.fillStyle = grey ? '#ded6c6' : '#fdf8ea';
    ctx.strokeStyle = grey ? '#a79f92' : INK;
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w / 2, h * 0.58); ctx.lineTo(w, 0);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------------------------------------------------------------- 6. Coat Pocket */

  TABS.coat = {
    title: 'Coat Pocket',
    interactive: false,
    enter: function () {},
    update: function () { return null; },
    /** The single state-dependent line of bible 9.2. */
    line: function () {
      const f = function (k) { return G.State.getFlag(k); };
      if (f('ending_sent_done')) return 'Empty. Good.';
      if (f('ending_not_yet_done')) return 'Not yet. But soon.';
      if (f('ending_pearl_done') || f('came_back')) return '';
      if (f('pim_knows')) return 'Pim. I know.';
      return 'Nothing I want to look at.';
    },
    draw: function (ctx, s, x, y, w, h) {
      const line = TABS.coat.line();
      G.Gfx.panel(x + 40, y + h / 2 - 78, w - 80, 156, { seed: 1500, fill: '#efe6d2' });
      // a stitched pocket mouth
      G.Gfx.line(x + 56, y + h / 2 - 62, x + w - 56, y + h / 2 - 62, { width: 1.6, alpha: 0.5, seed: 1501 });
      if (line) {
        G.Gfx.text(line, x + w / 2, y + h / 2, { size: 30, font: 'title', align: 'center', baseline: 'middle' });
      } else {
        G.Gfx.text('( nothing )', x + w / 2, y + h / 2, { size: 24, align: 'center', baseline: 'middle', color: SOFT });
      }
    },
  };

  /* ---------------------------------------------------------------- 7. Options */

  const OPTION_ROWS = [
    { key: 'bgmVol', label: 'Music', kind: 'slider' },
    { key: 'sfxVol', label: 'Sounds', kind: 'slider' },
    { key: 'textSpeed', label: 'Text speed', kind: 'choice', choices: ['Slow', 'Normal', 'Fast', 'Instant'] },
    { key: 'paper', label: 'Paper grain', kind: 'toggle' },
    { key: 'shake', label: 'Screen shake', kind: 'toggle' },
    { key: 'controls', label: 'Controls', kind: 'open', scene: 'controls' },
  ];

  /** Steps an option row left (d = -1) or right (d = 1) and saves. */
  function stepOption(row, d) {
    const o = G.State.options;
    if (row.kind === 'slider') {
      const v = U.clamp(Math.round((K().option(row.key, 0.7) + d * 0.1) * 10) / 10, 0, 1);
      G.Audio.setVolume(row.key === 'bgmVol' ? 'bgm' : 'sfx', v);
      if (row.key === 'sfxVol') G.UI.sfx('cursor');
    } else if (row.kind === 'choice') {
      o[row.key] = U.clamp((K().option(row.key, 1) | 0) + d, 0, row.choices.length - 1);
      G.UI.sfx('cursor');
    } else if (row.kind === 'toggle') {
      o[row.key] = !(K().option(row.key, true) !== false);
      G.UI.sfx('cursor');
    } else {
      return;
    }
    G.State.saveOptions();
  }

  /** Where a slider is drawn inside the options pane (for clicks). */
  const SLIDER = { dx: 200, w: 170 };

  TABS.options = {
    title: 'Options',
    interactive: true,
    enter: function (s) { s.optIndex = 0; },
    update: function (s) {
      const n = OPTION_ROWS.length;
      if (G.Input.repeated('down') || G.Input.repeated('up')) {
        const d = G.Input.repeated('down') ? 1 : -1;
        s.optIndex = (s.optIndex + d + n) % n;
        G.UI.sfx('cursor');
        return null;
      }
      const row = OPTION_ROWS[s.optIndex];
      const right = G.Input.repeated('right'), left = G.Input.repeated('left');
      if ((right || left) && row.kind !== 'open') {
        stepOption(row, right ? 1 : -1);
        return null;
      }
      if (G.Input.pressed('confirm') && row.kind === 'open') {
        G.UI.sfx('confirm');
        G.Scenes.push(row.scene, {});
        return null;
      }
      if (G.Input.pressed('confirm') && row.kind === 'toggle') {
        G.State.options[row.key] = !(K().option(row.key, true) !== false);
        G.State.saveOptions();
        G.UI.sfx('confirm');
        return null;
      }
      if (G.Input.pressed('cancel')) return 'back';
      return null;
    },
    draw: function (ctx, s, x, y, w, h) {
      const rowH = 42;
      for (let i = 0; i < OPTION_ROWS.length; i++) {
        const row = OPTION_ROWS[i];
        const ry = y + 14 + i * rowH;
        const sel = i === s.optIndex;
        if (sel) G.UI.drawHighlight(ctx, x + 22, ry - 2, w - 46, rowH - 8, 1600 + i);
        if (sel && s.focus === 'pane') G.UI.drawCursor(ctx, x + 14, ry + 12);
        this._pointRow(s, i, row, x, ry - 6, w, rowH);
        G.Gfx.text(row.label, x + 34, ry, { size: 22 });
        if (row.kind === 'open') {
          G.Gfx.text('change keys \u2192', x + 200, ry + 1, { size: 21 });
        } else if (row.kind === 'slider') {
          const v = K().option(row.key, 0.7);
          drawSlider(ctx, x + SLIDER.dx, ry + 5, SLIDER.w, v, row.key === 'bgmVol' ? '#7fb2d9' : '#6fb0a8');
          G.Gfx.text(Math.round(v * 100) + '%', x + 388, ry + 2, { size: 19, color: SOFT });
        } else if (row.kind === 'choice') {
          const v = U.clamp(K().option(row.key, 1) | 0, 0, row.choices.length - 1);
          G.Gfx.text('◀ ' + row.choices[v] + ' ▶', x + 200, ry + 1, { size: 21 });
        } else {
          const on = K().option(row.key, true) !== false;
          G.UI.drawTag(ctx, x + 200, ry - 4, 96, 34, {
            color: on ? '#6fb0a8' : '#b0a89c', label: on ? 'On' : 'Off', size: 20, seed: 1700 + i, shadow: false,
          });
        }
      }
      const by = y + 14 + OPTION_ROWS.length * rowH + 6;
      G.Gfx.panel(x + 16, by, w - 32, Math.max(90, y + h - by - 10), { seed: 1750, fill: C.COLORS.paperShade });
      G.Gfx.text('Keys', x + 32, by + 8, { size: 22, font: 'title' });
      const I = G.Input;
      const walk = ['up', 'left', 'down', 'right'].map(function (a) { return I.keysFor(a, 1); }).join(' ');
      const keys = [
        walk + ' \u2014 walk     ' + I.keysFor('run', 1) + ' \u2014 run     ' + I.keysFor('confide', 1) + ' \u2014 Confide',
        I.keysFor('confirm', 3) + ' \u2014 talk, choose',
        I.keysFor('cancel', 3) + ' \u2014 back; on the map: this menu',
        'Mouse: click to choose, right-click to go back',
      ];
      for (let i = 0; i < keys.length; i++) G.Gfx.text(keys[i], x + 32, by + 38 + i * 21, { size: 17, color: SOFT, maxWidth: w - 64 });
    },

    /** Mouse on an option row: sliders take the click position, choices step by side, toggles flip. */
    _pointRow: function (s, i, row, x, ry, w, rowH) {
      const pick = function () {
        if (s.optIndex === i) return false;
        s.optIndex = i;
        return true;
      };
      G.UI.pointRow(x + 6, ry, w - 12, rowH, function (kind) {
        if (kind === 'hover' && s.focus !== 'pane') return false;
        const was = s.focus;
        s.focus = 'pane';
        return pick() || was !== 'pane';
      }, {
        click: function (px) {
          s.focus = 'pane';
          pick();
          if (row.kind === 'open') { G.Pointer.press('confirm'); return; }
          if (row.kind === 'slider' && px >= x + SLIDER.dx - 12) {
            const v = U.clamp(Math.round((px - (x + SLIDER.dx)) / SLIDER.w * 10) / 10, 0, 1);
            G.Audio.setVolume(row.key === 'bgmVol' ? 'bgm' : 'sfx', v);
            G.State.saveOptions();
            G.UI.sfx('cursor');
            return;
          }
          if (row.kind === 'choice' && px >= x + 190) {
            const v = U.clamp(K().option(row.key, 1) | 0, 0, row.choices.length - 1);
            const mid = x + 200 + G.Gfx.measure('\u25c0 ' + row.choices[v] + ' \u25b6', { size: 21 }).w / 2;
            stepOption(row, px < mid ? -1 : 1);
            return;
          }
          if (row.kind === 'toggle' && px >= x + 190) { stepOption(row, 1); return; }
          G.UI.sfx('cursor');
        },
      });
    },
  };

  /* ====================================================================== the scene */

  const ORDER = ['pockets', 'skills', 'items', 'keepsakes', 'album', 'coat', 'options'];

  const Menu = {
    opaque: false,

    enter: function (params) {
      params = params || {};
      G.SceneKit.installHooks();
      this.onlyOptions = !!params.onlyOptions;
      this.order = this.onlyOptions ? ['options'] : ORDER.slice();
      this.tab = Math.max(0, this.order.indexOf(params.tab || (this.onlyOptions ? 'options' : 'pockets')));
      if (this.tab < 0) this.tab = 0;
      this.focus = this.onlyOptions ? 'pane' : 'tabs';
      this.t = 0;
      this.closing = false;
      for (const k of this.order) TABS[k].enter(this);
      G.UI.sfx('menuOpen');
    },

    exit: function () {},

    resume: function () { G.Input.reset(); },

    /* ---------------------------------------------------------------- input */

    update: function () {
      this.t++;
      if (this.closing || this.t < 2) return;
      const tab = TABS[this.order[this.tab]];
      if (this.focus === 'pane') {
        const r = tab.update(this);
        if (r === 'back') {
          if (this.onlyOptions) { this._close(); return; }
          this.focus = 'tabs';
        }
        return;
      }
      const n = this.order.length;
      if (G.Input.repeated('down') || G.Input.repeated('up')) {
        const d = G.Input.repeated('down') ? 1 : -1;
        this.tab = (this.tab + d + n) % n;
        TABS[this.order[this.tab]].enter(this);
        G.UI.sfx('cursor');
      } else if (G.Input.pressed('confirm') || G.Input.pressed('right')) {
        if (tab.interactive) { this.focus = 'pane'; G.UI.sfx('confirm'); } else G.UI.sfx('buzzer');
      } else if (G.Input.pressed('cancel') || G.Input.pressed('menu')) {
        this._close();
      }
    },

    _close: function () {
      this.closing = true;
      G.UI.sfx('menuClose');
      G.Scenes.pop({ closed: true });
    },

    /* ---------------------------------------------------------------- drawing */

    draw: function (ctx) {
      const tab = TABS[this.order[this.tab]];
      if (this.onlyOptions) {
        G.SceneKit.dim(ctx, 0.5);
      } else {
        this._drawCoat(ctx);
      }
      G.Gfx.panel(PANE.x, PANE.y, PANE.w, PANE.h, { seed: 2001 });
      G.Gfx.text(tab.title, PANE.x + 22, PANE.y + 10, { size: 28, font: 'title' });
      G.Gfx.line(PANE.x + 18, PANE.y + 48, PANE.x + PANE.w - 18, PANE.y + 48, { width: 1.6, alpha: 0.5, seed: 2002 });
      ctx.save();
      tab.draw(ctx, this, PANE.x + 8, PANE.y + 56, PANE.w - 16, PANE.h - 66);
      ctx.restore();
      if (!this.onlyOptions) this._drawTags(ctx);
      this._drawFooter(ctx);
    },

    /** The inside of an open coat: oatmeal cloth, a seam, stitches and a pocket behind the tags. */
    _drawCoat: function (ctx) {
      G.SceneKit.dim(ctx, 0.5);
      G.Gfx.panel(6, 6, C.W - 12, C.H - 12, { seed: 1999, fill: '#ded2bb', lineWidth: 2.6 });
      ctx.save();
      ctx.globalAlpha *= 0.35;
      for (let i = 0; i < 26; i++) {
        const x = 18 + i * 29;
        G.Gfx.line(x, 14, x + 6, C.H - 16, { width: 1.1, seed: 40 + i, color: '#b6a88c' });
      }
      ctx.restore();
      // the pocket the tags hang in
      G.Gfx.panel(COL.x - 12, COL.y - 34, COL.w + 24, COL.h + COL.gap * 6 + 60, {
        seed: 1998, fill: '#e9dfc8', lineWidth: 2,
      });
      G.Gfx.line(COL.x - 4, COL.y - 22, COL.x + COL.w + 4, COL.y - 22, { width: 1.6, alpha: 0.6, seed: 1997 });
      G.Gfx.text('Coat', COL.x + 4, COL.y - 62, { size: 26, font: 'title', color: '#6b6276' });
    },

    /** The column of seven luggage tags. */
    _drawTags: function (ctx) {
      for (let i = 0; i < this.order.length; i++) {
        const t = TABS[this.order[i]];
        const y = COL.y + i * COL.gap;
        const sel = i === this.tab;
        const swing = Math.sin(this.t * 0.04 + i) * (sel ? 0.012 : 0.005);
        ctx.save();
        ctx.translate(COL.x + 14, y + 14);
        ctx.rotate(swing);
        ctx.translate(-(COL.x + 14), -(y + 14));
        G.UI.drawTag(ctx, COL.x, y, COL.w, COL.h, {
          color: sel ? C.COLORS.accent : '#9fb0b8',
          label: t.title, size: 23, seed: 2100 + i * 5,
          selected: sel, alpha: sel || this.focus === 'tabs' ? 1 : 0.82,
        });
        ctx.restore();
        this._pointTag(i, y);
        if (sel) {
          G.UI.drawString(ctx, COL.x + COL.w, y + COL.h / 2, PANE.x + 2, PANE.y + 30,
            { sag: 10, seed: 2200 + i, width: 1.5 });
          if (this.focus === 'tabs') G.UI.drawCursor(ctx, COL.x - 12, y + COL.h / 2);
        }
      }
    },

    /** Tag i: hovering picks it while the tags have focus; a click shows it, a second click opens it. */
    _pointTag: function (i, y) {
      const self = this;
      G.UI.pointRow(COL.x - 20, y - 4, COL.w + 24, COL.h + 8, function (kind) {
        if (kind === 'hover' && self.focus !== 'tabs') return false;
        if (self.tab === i) return false;
        self.tab = i;
        TABS[self.order[i]].enter(self);
        return true;
      }, {
        click: function () {
          if (self.closing) return;
          if (self.tab === i && self.focus === 'tabs') { G.Pointer.press('confirm'); return; }
          if (self.tab !== i) { self.tab = i; TABS[self.order[i]].enter(self); }
          self.focus = 'tabs';
          G.UI.sfx('cursor');
        },
      });
    },

    _drawFooter: function (ctx) {
      const y = C.H - 32;
      G.SceneKit.stamp(ctx, 40, y + 2, 24);
      G.Gfx.text(G.SceneKit.money() + ' ' + G.SceneKit.currency(), 58, y - 8, { size: 20 });
      const tide = G.State.getVar('tide');
      G.Gfx.text('Tide ' + tide, 200, y - 8, { size: 20, color: SOFT });
      G.Gfx.text(G.SceneKit.time(G.State.playtimeFrames), 290, y - 8, { size: 20, color: SOFT });
      const ok = G.Input.keysFor('confirm', 1), back = G.Input.keysFor('cancel', 1);
      G.Gfx.text(this.focus === 'tabs' ? ok + ': open a tag   ' + back + ': close the coat' : back + ': back to the tags',
        C.W - 24, y - 8, { size: 17, align: 'right', color: SOFT });
    },
  };

  G.Scenes.register('menu', Menu);
})();
