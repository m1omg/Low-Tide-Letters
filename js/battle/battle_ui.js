/*
 * battle_ui.js - G.BattleUI: the "Tideline" HUD of DESIGN_BIBLE 6.1 and 9.3.
 *
 * Everything here is code-drawn first and uses images only when they exist (enemy art, battle
 * backgrounds and glass icons are all optional), so the battle is legible the whole way through the
 * art pipeline. Public helper used by the menus:
 *
 *   G.BattleUI.drawGlass(ctx, x, y, piece, size)
 *       piece = null | {c,t,from} | {pebble:true, story:bool}   (x, y = centre)
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CONFIG;
  const U = G.Util;

  /** Glass palette (10.2 sea-glass colours). */
  const COLOURS = {
    red: '#c9524a', blue: '#4f8fd0', amber: '#e0a33c', green: '#6f9e58',
    any: '#8a8a8a', pebble: '#8d8a86', pebbleStory: '#6b6862',
  };
  const LIGHT = { red: '#efa199', blue: '#a8cef0', amber: '#f5d79a', green: '#b6d4a4', any: '#cfc9bd' };

  /** Layout constants, straight from 6.1. */
  const L = {
    W: 768, H: 576,
    strip: { x: 144, y: 12, w: 480, h: 44 },
    can: { x: 16, y: 12, w: 48, h: 48 },
    ribbon: { x: 720, y: 16, w: 40, h: 360, token: 40, gap: 24 },
    enemyBase: 300, enemyMinX: 150, enemyMaxX: 610,
    tideY: 392,
    partyX: [120, 296, 472, 648], feetY: 470,
    spriteW: 96, spriteH: 132,
    pocketY: 498, slotW: 22, slotGap: 26,
    breathY: 526, breathW: 120,
    nameY: 548,
    fanY: 392, fanTop: 330,
  };

  const SAND = '#d9c6a0';
  const WET = '#c3ad86';

  function ink(a) { return 'rgba(43,36,51,' + a + ')'; }

  /* ================================================================== glass */

  function jagged(ctx, x, y, r, seed) {
    ctx.beginPath();
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - 0.4;
      const rr = r * (0.72 + Math.abs(U.noise(seed, i)) * 0.5);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr * 0.92;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  /**
   * Draws one Pocket slot value at its centre.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object|null} piece null (empty hollow) | raw/Tumbled glass | a Pebble
   * @param {number} [size=22] full width in logical pixels
   */
  function drawGlass(ctx, x, y, piece, size) {
    size = size || 22;
    const r = size / 2;
    ctx.save();
    if (!piece) {
      // an empty hollow pressed into the sand
      ctx.fillStyle = 'rgba(120,98,70,0.30)';
      ctx.beginPath(); ctx.ellipse(x, y + 1, r * 0.82, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(80,64,48,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(x, y, r * 0.82, r * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      return;
    }
    if (piece.pebble) {
      const id = piece.story ? 'icon_pebble_story' : 'icon_pebble';
      if (G.Assets.has(id)) {
        G.Gfx.drawImg(id, x, y, { w: size, h: size, anchorX: 0.5, anchorY: 0.5 });
        ctx.restore();
        return;
      }
      ctx.fillStyle = piece.story ? COLOURS.pebbleStory : COLOURS.pebble;
      ctx.beginPath(); ctx.ellipse(x, y, r * 0.92, r * 0.78, 0.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ink(0.55); ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(x - r * 0.25, y - r * 0.3, r * 0.26, r * 0.16, 0.3, 0, Math.PI * 2); ctx.fill();
      if (piece.story) {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x, y, r * 0.55, r * 0.45, 0.2, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
      return;
    }
    const col = COLOURS[piece.c] || COLOURS.any;
    const light = LIGHT[piece.c] || LIGHT.any;
    const iconId = 'icon_glass_' + piece.c + (piece.t ? '_tumbled' : '');
    if (G.Assets.has(iconId)) {
      G.Gfx.drawImg(iconId, x, y, { w: size, h: size, anchorX: 0.5, anchorY: 0.5 });
      ctx.restore();
      return;
    }
    if (piece.t) {
      // smooth, rounded, with a white glint
      const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      g.addColorStop(0, light); g.addColorStop(1, col);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, r * 0.92, r * 0.8, 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = ink(0.5); ctx.lineWidth = 1.4; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.ellipse(x - r * 0.28, y - r * 0.3, r * 0.3, r * 0.17, 0.4, 0, Math.PI * 2); ctx.fill();
    } else {
      // sharp, hatched
      ctx.fillStyle = col;
      jagged(ctx, x, y, r * 0.95, (piece.seq || 1) * 7 + piece.c.length);
      ctx.fill();
      ctx.strokeStyle = ink(0.6); ctx.lineWidth = 1.3; ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.33)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let d = -size; d < size; d += 4) { ctx.moveTo(x - r + d, y + r); ctx.lineTo(x - r + d + size, y - r); }
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  /* ================================================================== background */

  function drawBackground(ctx, backId, frame) {
    if (backId && G.Assets.has(backId)) {
      G.Gfx.drawImg(backId, 0, 0, { w: C.W, h: C.H });
    } else {
      // code-drawn paper seabed: pale water above, torn wet sand below
      const g = ctx.createLinearGradient(0, 0, 0, L.tideY);
      g.addColorStop(0, '#bcd8dc');
      g.addColorStop(1, '#9fc3c2');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, C.W, L.tideY + 40); // runs under the torn sand edge so no gap shows
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const y = 70 + i * 40 + Math.sin((frame / 70) + i) * 3;
        ctx.beginPath();
        for (let x = -20; x < C.W + 20; x += 24) {
          const yy = y + Math.sin(x / 60 + i + frame / 90) * 4;
          if (x < 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    }
    // the tideline: a torn band of wet sand
    ctx.fillStyle = SAND;
    ctx.beginPath();
    ctx.moveTo(0, C.H);
    ctx.lineTo(0, L.tideY + 10);
    for (let x = 0; x <= C.W; x += 32) {
      ctx.lineTo(x, L.tideY + 10 + U.noise(4242, x / 32) * 9 + Math.sin(x / 90) * 4);
    }
    ctx.lineTo(C.W, C.H);
    ctx.closePath();
    ctx.fill();
    // foam and a soft pencil line along the torn edge
    const edgeY = function (x) { return L.tideY + 10 + U.noise(4242, x / 32) * 9 + Math.sin(x / 90) * 4; };
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let x = 0; x <= C.W; x += 32) { if (x === 0) ctx.moveTo(x, edgeY(x) - 2); else ctx.lineTo(x, edgeY(x) - 2); }
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.beginPath();
    for (let x = 0; x <= C.W; x += 32) { if (x === 0) ctx.moveTo(x, edgeY(x) + 1); else ctx.lineTo(x, edgeY(x) + 1); }
    ctx.strokeStyle = 'rgba(90,72,52,0.45)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = WET;
    ctx.beginPath();
    ctx.moveTo(0, L.tideY + 30);
    for (let x = 0; x <= C.W; x += 28) ctx.lineTo(x, L.tideY + 26 + U.noise(77, x / 28) * 7);
    ctx.lineTo(C.W, L.tideY + 10);
    for (let x = C.W; x >= 0; x -= 32) ctx.lineTo(x, L.tideY + 10 + U.noise(4242, x / 32) * 9 + Math.sin(x / 90) * 4);
    ctx.closePath();
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
    // scattered shells and pencil marks in the sand
    ctx.strokeStyle = 'rgba(120,98,70,0.35)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) {
      const x = ((i * 137) % C.W), y = L.tideY + 30 + ((i * 53) % 130);
      ctx.beginPath();
      ctx.arc(x, y, 3 + (i % 3), 0.6, 2.6);
      ctx.stroke();
    }
  }

  /* ================================================================== enemies */

  /** Baseline x positions for n enemies, spread between 150 and 610 (6.1). */
  function enemySlots(n) {
    if (n <= 1) return [(L.enemyMinX + L.enemyMaxX) / 2];
    const out = [];
    for (let i = 0; i < n; i++) out.push(L.enemyMinX + (L.enemyMaxX - L.enemyMinX) * (i / (n - 1)));
    return out;
  }

  function enemySize(e) {
    const big = !!(e.data && e.data.boss);
    if (e.img && G.Assets.has(e.img)) {
      const s = G.Assets.size(e.img);
      const k = Math.min((big ? 300 : 200) / s.w, (big ? 240 : 180) / s.h, big ? 1.8 : 1.4);
      return { w: s.w * k, h: s.h * k };
    }
    return { w: big ? 180 : 120, h: big ? 160 : 120 };
  }

  /** A folded-paper stand-in used until the enemy illustration exists. */
  function drawPaperCreature(ctx, e, x, y, w, h) {
    const seed = U.hash(e.id);
    const hue = [0.94, 0.88, 0.82, 0.76][seed % 4];
    const tint = e.data && e.data.tint ? e.data.tint : null;
    const paper = tint || ['#f2e7cd', '#ecdfc4', '#efe2d2', '#e9e6d4'][seed % 4];
    ctx.save();
    ctx.translate(x, y);
    // body: a wobbly folded sheet standing on its edge
    G.Gfx.panel(-w / 2, -h, w, h, { seed: seed % 9973, fill: paper, radius: 10 });
    // folded corner
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 22, -h); ctx.lineTo(w / 2, -h); ctx.lineTo(w / 2, -h + 22);
    ctx.closePath(); ctx.fill();
    // ruled lines
    ctx.strokeStyle = 'rgba(90,120,170,0.35)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const yy = -h + 18 + i * (h / 6);
      ctx.beginPath(); ctx.moveTo(-w / 2 + 12, yy); ctx.lineTo(w / 2 - 14, yy - 1); ctx.stroke();
    }
    // face
    const fy = -h * 0.55;
    ctx.fillStyle = C.COLORS.ink;
    ctx.beginPath(); ctx.arc(-w * 0.13, fy, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.13, fy, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.COLORS.ink; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, fy + 16);
    ctx.quadraticCurveTo(0, fy + 16 + (hue > 0.85 ? -5 : 6), 8, fy + 16);
    ctx.stroke();
    // two stubby legs
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-11, 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(11, 9); ctx.stroke();
    ctx.restore();
  }

  function drawEnemy(ctx, e, x, o) {
    o = o || {};
    if (e.gone) return;
    const size = enemySize(e);
    const b = G.Gfx.boil(e.id + e.idx);
    const y = L.enemyBase + (o.dy || 0);
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    // soft shadow on the seabed
    ctx.fillStyle = 'rgba(60,70,80,0.18)';
    ctx.beginPath(); ctx.ellipse(x, y + 4, size.w * 0.34, 9, 0, 0, Math.PI * 2); ctx.fill();
    if (e.img && G.Assets.has(e.img)) {
      G.Gfx.drawImg(e.img, x + b.dx, y + b.dy, {
        w: size.w, h: size.h, anchorX: 0.5, anchorY: 1, rot: b.rot, scaleX: b.sx, scaleY: b.sy,
        alpha: o.alpha,
      });
    } else {
      ctx.save();
      ctx.translate(b.dx, b.dy);
      ctx.rotate(b.rot);
      drawPaperCreature(ctx, e, x, y, size.w, size.h);
      ctx.restore();
    }
    ctx.restore();
    return { top: y - size.h, w: size.w, h: size.h };
  }

  /** The cream letter slip above an Unsent: one ruled Line per row (6.1). */
  function drawLetterStrip(ctx, b, e, x, topY, box) {
    const rows = Math.max(1, e.lines.length);
    const w = 108;
    const h = 16 + rows * 16 + (e.seenBreath ? 10 : 0);
    let sx = x;
    let y = topY - h - 14;
    if (y < 56 && topY - h - 2 >= 56) y = topY - h - 2;      // a tighter gap before giving up on "above"
    if (y < 56) {
      // a tall Unsent: the slip floats beside its shoulder instead of over its head
      const half = ((box && box.w) || 140) / 2;
      const right = x + half + w / 2 + 6;
      const left = x - half - w / 2 - 6;
      sx = right + w / 2 < L.ribbon.x - 8 ? right : left;
      sx = U.clamp(sx, w / 2 + 6, L.ribbon.x - w / 2 - 10);
      y = U.clamp(topY + 24, 56, L.enemyBase - h - 10);
    }
    x = sx;
    G.Gfx.panel(x - w / 2, y, w, h, { seed: 500 + e.idx * 13, fill: '#fdf7e6', radius: 6 });
    // a pencil line joining the slip to the Unsent
    G.Gfx.line(x, y + h, x, Math.max(topY - 4, y + h + 6), { width: 1, alpha: 0.4, seed: 31 + e.idx });
    for (let i = 0; i < e.lines.length; i++) {
      const l = e.lines[i];
      const ly = y + 12 + i * 16;
      const lx = x - w / 2 + 12, lw = w - 26;
      if (!l.revealed && !l.filled) {
        G.Gfx.text('?', x, ly + 7, { size: 17, align: 'center', baseline: 'middle', color: C.COLORS.inkSoft });
        G.Gfx.line(lx, ly + 13, lx + lw, ly + 13, { width: 1, alpha: 0.25, seed: i * 3 + 1 });
        continue;
      }
      const colour = l.filled ? l.colour : b.shownColour(e, l);
      const col = COLOURS[colour] || COLOURS.any;
      if (l.filled) {
        // a coloured scribble on the line
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let k = 0; k <= 10; k++) {
          const px = lx + (lw * k) / 10;
          const py = ly + 7 + Math.sin(k * 1.9 + i) * 3.4;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      } else {
        G.Gfx.line(lx, ly + 12, lx + lw, ly + 12, { width: 3, color: col, seed: i * 5 + 2 });
      }
      if (l.star) {
        G.Gfx.text('★', lx + lw + 5, ly + 7, { size: 13, align: 'center', baseline: 'middle', color: l.filled ? col : '#b9932f' });
      }
      if (l.from || l.sayer) {
        const who = l.from || l.sayer;
        G.Gfx.text(who.slice(0, 3), lx - 5, ly + 7, { size: 12, align: 'right', baseline: 'middle', color: C.COLORS.inkSoft });
      }
    }
    if (e.seenBreath) {
      const by = y + h - 7;
      const frac = Math.max(0, e.hp / e.mhp);
      G.Gfx.line(x - w / 2 + 10, by, x + w / 2 - 10, by, { width: 2, alpha: 0.25, seed: 9 });
      ctx.save();
      ctx.strokeStyle = e.invulnerable ? '#8a8a8a' : '#7a6a58';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + 10, by);
      ctx.lineTo(x - w / 2 + 10 + (w - 20) * frac, by);
      ctx.stroke();
      ctx.restore();
    }
    return { x: x, y: y, w: w, h: h };
  }

  /** The shaking speech scrap of a telegraphed Blurt. */
  function drawBlurt(ctx, e, x, topY) {
    const t = G.Gfx.frame;
    const dx = Math.sin(t * 0.7) * 2.2, dy = Math.cos(t * 0.9) * 1.6;
    const label = e.blurt.name + '!';
    const w = Math.max(90, G.Gfx.measure(label, { size: 20, font: 'title' }).w + 26);
    const x0 = x + 60 + dx, y0 = topY - 26 + dy;
    G.Gfx.panel(x0, y0, w, 32, { seed: 707, fill: '#fff0d0', radius: 14 });
    G.Gfx.text(label, x0 + w / 2, y0 + 16, { size: 20, font: 'title', align: 'center', baseline: 'middle', color: '#b5432f' });
  }

  /* ================================================================== the party */

  function drawMember(ctx, m, x, o) {
    o = o || {};
    const cx = x + (o.dx || 0);
    const feet = L.feetY + (o.dy || 0);
    ctx.save();
    if (m.hp <= 0) ctx.globalAlpha *= 0.55;
    // shadow
    ctx.fillStyle = 'rgba(60,50,40,0.20)';
    ctx.beginPath(); ctx.ellipse(cx, feet - 2, 34, 8, 0, 0, Math.PI * 2); ctx.fill();
    const img = m.char;
    const down = m.hp <= 0;
    if (img && G.Assets.has(img)) {
      // walk sheet: rows down/left/right/up, columns stepA/stand/stepB -> the 'up' stand frame at 1.5x
      const b = G.Gfx.boil(m.id);
      ctx.save();
      ctx.translate(cx, feet);
      if (down) { ctx.rotate(0.12); ctx.translate(0, 26); }
      G.Gfx.drawFrame(img, 1, 3, b.dx, b.dy, {
        w: L.spriteW, h: L.spriteH, anchorX: 0.5, anchorY: 1, rot: b.rot,
      });
      ctx.restore();
    } else {
      // code-drawn stand-in: a duffel-coat shape seen from behind
      ctx.save();
      ctx.translate(cx, feet);
      if (down) { ctx.rotate(0.12); ctx.translate(0, 26); }
      G.Gfx.panel(-30, -96, 60, 96, { seed: U.hash(m.id) % 997, fill: m.color || '#8fb0ad', radius: 16 });
      ctx.fillStyle = '#e8d9b8';
      ctx.beginPath(); ctx.ellipse(0, -100, 20, 18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C.COLORS.ink; ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function stateTags(b, m) {
    const tags = [];
    if (m.hp <= 0) tags.push({ text: 'Winded', col: '#7a7a7a' });
    if (m.spill) tags.push({ text: G.BattleLogic.SPILL_NAME[m.spill.colour], col: COLOURS[m.spill.colour] });
    else if (m.brimState) {
      const colour = Object.keys(G.BattleLogic.HOME_STATE).find(function (c) { return G.BattleLogic.HOME_STATE[c] === m.brimState; });
      tags.push({ text: G.BattleLogic.BRIM_NAME[colour], col: COLOURS[colour] });
    }
    for (const id of Object.keys(m.states)) {
      if (id === 'winded') continue;
      const d = G.BattleLogic.STATES[id];
      if (d) tags.push({ text: d.name, col: d.bad ? '#a4514b' : '#5c7d4f' });
    }
    return tags;
  }

  function drawPocket(ctx, m, cx, o) {
    o = o || {};
    const shake = o.rattle ? Math.sin(G.Gfx.frame * 0.9) * 2 : 0;
    for (let i = 0; i < 5; i++) {
      const x = cx + (i - 2) * L.slotGap + shake * (i % 2 ? 1 : -1);
      drawGlass(ctx, x, L.pocketY, m.pocket[i], L.slotW);
      if (o.cursor === i) {
        G.UI.drawCursor(ctx, x - 16, L.pocketY, {});
      }
    }
  }

  function drawBreathString(ctx, m, cx) {
    const x0 = cx - L.breathW / 2, y = L.breathY;
    const frac = U.clamp(m.hp / m.mhp, 0, 1);
    // the can string
    G.Gfx.line(x0, y, x0 + L.breathW, y, { width: 2, alpha: 0.35, seed: 61 + m.idx });
    ctx.save();
    ctx.strokeStyle = m.hp <= 0 ? '#8a8a8a' : (frac < 0.3 ? '#c9524a' : m.color || '#4f8fd0');
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y);
    for (let k = 1; k <= 8; k++) {
      const t = k / 8;
      if (t > frac) break;
      ctx.lineTo(x0 + L.breathW * t, y + U.noise(m.idx * 7, k) * 1.2);
    }
    if (frac > 0) ctx.lineTo(x0 + L.breathW * frac, y);
    ctx.stroke();
    ctx.restore();
    G.Gfx.text(String(Math.max(0, Math.round(m.hp))), x0 + L.breathW + 6, y, {
      size: 17, baseline: 'middle', color: C.COLORS.ink, outline: '#fbf5e6',
    });
  }

  function drawPartyMember(ctx, b, m, active, o) {
    o = o || {};
    const cx = L.partyX[m.idx];
    drawMember(ctx, m, cx, o);
    drawPocket(ctx, m, cx, o);
    drawBreathString(ctx, m, cx);
    const tags = stateTags(b, m);
    G.Gfx.text(m.name, cx, L.nameY, {
      size: 21, align: 'center', font: 'title', color: active ? '#b5432f' : C.COLORS.ink, outline: '#fbf5e6',
    });
    let ty = L.nameY + 2;
    let tx = cx + G.Gfx.measure(m.name, { size: 21, font: 'title' }).w / 2 + 8;
    for (const t of tags.slice(0, 2)) {
      const w = G.Gfx.measure(t.text, { size: 13 }).w + 10;
      G.Gfx.panel(tx, ty, w, 18, { seed: 90 + m.idx, fill: '#fdf7e6', radius: 5, shadow: false, lineWidth: 1.4 });
      G.Gfx.text(t.text, tx + w / 2, ty + 9, { size: 13, align: 'center', baseline: 'middle', color: t.col });
      ty += 20;
    }
    if (active) {
      const bob = Math.sin(G.Gfx.frame * 0.12) * 3;
      G.Gfx.text('▼', cx, L.feetY - L.spriteH - 14 + bob, { size: 20, align: 'center', color: '#b5432f' });
    }
  }

  /* ================================================================== chrome */

  function drawMessageStrip(ctx, text, sub) {
    const s = L.strip;
    G.Gfx.panel(s.x, s.y, s.w, s.h, { seed: 12, fill: '#fdf7e6' });
    G.Gfx.text(text || '', s.x + s.w / 2, s.y + (sub ? 9 : s.h / 2), {
      size: sub ? 20 : 22, align: 'center', baseline: sub ? 'top' : 'middle', maxWidth: s.w - 28,
    });
    if (sub) {
      G.Gfx.text(sub, s.x + s.w / 2, s.y + s.h - 3, {
        size: 15, align: 'center', baseline: 'bottom', color: C.COLORS.inkSoft, maxWidth: s.w - 28, italic: true,
      });
    }
  }

  function drawCanLine(ctx, b) {
    const c = L.can;
    const free = !b.canLine.used && !b.canLine.jammed;
    // string along the top edge toward the ribbon
    ctx.save();
    ctx.strokeStyle = free ? '#e0a33c' : 'rgba(80,72,60,0.45)';
    ctx.lineWidth = free ? 2.2 : 1.6;
    ctx.beginPath();
    ctx.moveTo(c.x + c.w - 4, c.y + 10);
    for (let x = c.x + c.w; x < L.ribbon.x; x += 26) {
      ctx.lineTo(x, c.y + 8 + Math.sin(x / 40 + G.Gfx.frame / 60) * 2);
    }
    ctx.lineTo(L.ribbon.x + 8, L.ribbon.y + 4);
    ctx.stroke();
    ctx.restore();
    // the tin can
    ctx.save();
    ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
    ctx.rotate(-0.15);
    const body = free ? '#dfc9a2' : '#b7b2a8';
    G.Gfx.panel(-17, -13, 34, 28, { seed: 5, fill: body, radius: 7 });
    ctx.strokeStyle = ink(0.5); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(-17, 1, 4, 13, 0, 0, Math.PI * 2); ctx.stroke();
    if (free) {
      ctx.fillStyle = 'rgba(240,186,90,0.55)';
      ctx.beginPath(); ctx.ellipse(-16, 1, 3.4, 11, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      // a knot in the string
      ctx.strokeStyle = ink(0.6); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(14, -12, 4, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    G.Gfx.text(b.canLine.jammed ? 'jammed' : free ? 'Can Line' : 'used', c.x + c.w / 2, c.y + c.h + 2, {
      size: 13, align: 'center', color: free ? '#8a6a30' : C.COLORS.inkSoft, outline: '#fbf5e6',
    });
    G.Gfx.text('Round ' + b.round, c.x + c.w / 2, c.y + c.h + 18, {
      size: 15, align: 'center', font: 'title', outline: '#fbf5e6',
    });
  }

  function drawToken(ctx, c, x, y, size, active) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = c.side === 'party' ? '#fdf7e6' : '#e6dcc6';
    ctx.fill();
    ctx.save();
    ctx.clip();
    if (c.side === 'party' && c.char && G.Assets.has(c.char)) {
      // the head of the walk sprite
      G.Gfx.drawFrame(c.char, 1, 3, x + size / 2, y - 4, { w: size * 1.5, h: size * 2.1, anchorX: 0.5, anchorY: 0 });
    } else if (c.side === 'enemy' && c.img && G.Assets.has(c.img)) {
      G.Gfx.drawImg(c.img, x + size / 2, y + size / 2, { w: size * 0.95, h: size * 0.95, anchorX: 0.5, anchorY: 0.5 });
    } else {
      ctx.fillStyle = c.side === 'party' ? (c.color || '#8fb0ad') : '#c8b48c';
      ctx.fillRect(x, y, size, size);
      G.Gfx.text((c.name || '?').slice(0, 2), x + size / 2, y + size / 2, {
        size: 16, align: 'center', baseline: 'middle', color: '#3a3040',
      });
    }
    ctx.restore();
    ctx.strokeStyle = active ? '#b5432f' : ink(0.55);
    ctx.lineWidth = active ? 3 : 1.8;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawTurnRibbon(ctx, b) {
    const r = L.ribbon;
    const list = b.upcoming(6);
    ctx.save();
    ctx.fillStyle = 'rgba(253,247,230,0.55)';
    G.Gfx.panel(r.x - 4, r.y - 8, r.w + 8, r.h + 6, { seed: 21, fill: 'rgba(253,247,230,0.62)', radius: 14 });
    ctx.restore();
    // the string the tokens hang from
    G.Gfx.line(r.x + r.token / 2, r.y - 4, r.x + r.token / 2, r.y + r.h - 10, { width: 1.4, alpha: 0.5, seed: 8 });
    for (let i = 0; i < list.length; i++) {
      const y = r.y + i * (r.token + r.gap * 0.85);
      drawToken(ctx, list[i], r.x, y, r.token, i === 0);
    }
  }

  /** The luggage-tag command fan (6.1): tags hang from the member on strings, in a shallow arc. */
  function drawCommandFan(ctx, m, items, index, o) {
    o = o || {};
    const n = items.length;
    const tagW = 78, tagH = 28, step = 82;
    const span = (n - 1) * step;
    const cx = U.clamp(L.partyX[m.idx], span / 2 + 24, C.W - 60 - span / 2);
    const anchorX = L.partyX[m.idx];
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;      // -1 .. 1
      const x = cx + t * (span / 2);
      const y = L.fanY - 6 - Math.cos(t * 1.15) * 26 - (i % 2 ? 26 : 0);
      out.push({ x: x, y: y });
    }
    for (let i = 0; i < n; i++) {
      const it = items[i];
      const p = out[i];
      const sel = i === index;
      const x = p.x - tagW / 2, y = p.y - tagH / 2 - (sel ? 5 : 0);
      G.Gfx.line(anchorX, L.fanY + 18, x + tagW / 2, y + tagH, { width: 1.1, alpha: 0.3, seed: 40 + i });
      G.Gfx.panel(x, y, tagW, tagH, {
        seed: 120 + i * 7, radius: 8,
        fill: sel ? '#fff0c9' : (it.enabled === false ? '#e7e0cf' : '#fdf7e6'),
        lineWidth: sel ? 2.8 : 2,
      });
      ctx.save();
      ctx.strokeStyle = ink(0.45); ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(x + 10, y + tagH / 2, 3.2, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      G.Gfx.text(it.label, x + tagW / 2 + 5, y + tagH / 2, {
        size: 18, align: 'center', baseline: 'middle', maxWidth: tagW - 20,
        color: it.enabled === false ? '#9a9286' : C.COLORS.ink,
      });
      if (sel) {
        const cur = items[index];
        const note = cur.enabled === false && cur.reason ? '\u2014 ' + cur.reason : (cur.help || '');
        if (note) {
          G.Gfx.text(note, U.clamp(p.x, 120, C.W - 120), L.fanY + 34, {
            size: 16, align: 'center', outline: '#fbf5e6', italic: cur.enabled === false,
            color: cur.enabled === false ? '#a4514b' : C.COLORS.inkSoft,
          });
        }
      }
    }
    return out;
  }

  /** Hand-lettered, boiling damage number. */
  function drawFloater(ctx, f) {
    const t = f.t / f.life;
    const y = f.y - U.ease.out(t) * 34;
    const a = U.clamp((1 - t) * 2.2, 0, 1);
    const b = G.Gfx.boil(f.seed);
    const size = f.big ? 38 : 28;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(f.x + b.dx, y + b.dy);
    ctx.rotate(b.rot * 2 + (f.tilt || 0));
    G.Gfx.text(f.text, 0, 0, {
      size: size, font: 'title', align: 'center', baseline: 'middle',
      color: f.color || '#b5432f', outline: '#fdf7e6',
    });
    ctx.restore();
  }

  function drawScrap(ctx, s) {
    const a = U.clamp(Math.min(s.t, s.life - s.t) / 12, 0, 1);
    const w = Math.max(120, G.Gfx.measure(s.text, { size: 17 }).w + 26);
    ctx.save();
    ctx.globalAlpha *= a;
    G.Gfx.panel(s.x - w / 2, s.y - 34, w, 30, { seed: 333, fill: '#fffdf2', radius: 4 });
    G.Gfx.text(s.text, s.x, s.y - 19, { size: 17, align: 'center', baseline: 'middle', maxWidth: w - 16, italic: true });
    ctx.restore();
  }

  function drawHintStrip(ctx, text, t) {
    const w = Math.min(520, G.Gfx.measure(text, { size: 19 }).w + 44);
    const a = U.clamp(Math.min(t, 90 - t) / 14, 0, 1);
    ctx.save();
    ctx.globalAlpha *= a;
    G.Gfx.panel((C.W - w) / 2, 70, w, 34, { seed: 404, fill: '#fff6d8' });
    G.Gfx.text(text, C.W / 2, 87, { size: 19, align: 'center', baseline: 'middle', maxWidth: w - 20 });
    ctx.restore();
  }

  function drawResultStrip(ctx, lines, t) {
    const a = U.clamp(t / 12, 0, 1);
    ctx.save();
    ctx.globalAlpha *= a;
    const w = 560, x = (C.W - w) / 2;
    G.Gfx.panel(x, 200, w, 56 + (lines.length - 1) * 30, { seed: 909, fill: '#fdf7e6' });
    for (let i = 0; i < lines.length; i++) {
      G.Gfx.text(lines[i], C.W / 2, 226 + i * 30, {
        size: i === 0 ? 26 : 21, font: i === 0 ? 'title' : 'body', align: 'center', baseline: 'middle',
      });
    }
    ctx.restore();
  }

  G.BattleUI = {
    L: L,
    COLOURS: COLOURS,
    drawGlass: drawGlass,
    drawBackground: drawBackground,
    enemySlots: enemySlots,
    enemySize: enemySize,
    drawEnemy: drawEnemy,
    drawLetterStrip: drawLetterStrip,
    drawBlurt: drawBlurt,
    drawPartyMember: drawPartyMember,
    drawPocket: drawPocket,
    drawMessageStrip: drawMessageStrip,
    drawCanLine: drawCanLine,
    drawTurnRibbon: drawTurnRibbon,
    drawCommandFan: drawCommandFan,
    drawFloater: drawFloater,
    drawScrap: drawScrap,
    drawHintStrip: drawHintStrip,
    drawResultStrip: drawResultStrip,
    stateTags: stateTags,
  };
})();
