/*
 * text.js - rich text: markup parsing, word wrap, paging, drawing with effects, typewriter.
 *
 * Markup (TECH_SPEC section 5):
 *   \n newline            {c:red}..{/c} color (palette name from G.DATA.strings.colors or a CSS color)
 *   {shake}..{/shake}     {wave}..{/wave}     {big}..{/big}     {small}..{/small}     {i}..{/i} italic
 *   {w:20} pause 20 frames   {speed:2} frames per character from here on (0 = instant)
 *   {p} forced page break    {name} protagonist name    {v:varName} value of a game variable
 */
(function () {
  'use strict';
  const G = window.G;
  const C = G.CONFIG;

  const LINE_HEIGHT = 1.25;
  const cache = new Map();
  const STYLE_TAGS = { c: 1, color: 1, shake: 1, wave: 1, big: 1, small: 1, i: 1 };

  function playerName() {
    const S = G.State;
    if (S && S.playerName) return S.playerName;
    if (S && S.party && S.party[0] && S.party[0].name) return S.party[0].name;
    return (G.DATA.strings && G.DATA.strings.defaultName) || '???';
  }

  /** Replaces {name} and {v:var} with their current values. */
  function expand(str) {
    return String(str == null ? '' : str)
      .replace(/\{name\}/g, playerName)
      .replace(/\{v:([^{}]+)\}/g, function (m, k) {
        return String(G.State && G.State.getVar ? G.State.getVar(k.trim()) : 0);
      });
  }

  function colorOf(name) {
    const pal = (G.DATA.strings && G.DATA.strings.colors) || {};
    return pal[name] || name;
  }

  /**
   * Splits an (already expanded) string into tokens:
   * {t:'text',s} {t:'nl'} {t:'open',tag,arg} {t:'close',tag} {t:'wait',n} {t:'speed',n} {t:'page'}
   */
  function tokenize(str) {
    const out = [];
    const re = /\{(\/?)([a-zA-Z]+)(?::([^{}]*))?\}|\n/g;
    let last = 0, m;
    const pushText = function (s) { if (s) out.push({ t: 'text', s: s }); };
    while ((m = re.exec(str))) {
      pushText(str.slice(last, m.index));
      last = re.lastIndex;
      if (m[0] === '\n') { out.push({ t: 'nl' }); continue; }
      const tag = m[2].toLowerCase();
      if (m[1]) {
        if (STYLE_TAGS[tag]) out.push({ t: 'close', tag: tag === 'color' ? 'c' : tag });
        else { G.warn('Text: unknown closing tag ' + m[0]); pushText(m[0]); }
      } else if (STYLE_TAGS[tag]) {
        out.push({ t: 'open', tag: tag === 'color' ? 'c' : tag, arg: m[3] });
      } else if (tag === 'w' || tag === 'wait') {
        out.push({ t: 'wait', n: Math.max(0, parseInt(m[3], 10) || 0) });
      } else if (tag === 'speed') {
        out.push({ t: 'speed', n: Math.max(0, parseFloat(m[3]) || 0) });
      } else if (tag === 'p') {
        out.push({ t: 'page' });
      } else {
        G.warn('Text: unknown tag ' + m[0]);
        pushText(m[0]);
      }
    }
    pushText(str.slice(last));
    return out;
  }

  /**
   * Lays out a rich string.
   * @param {string} str
   * @param {{maxWidth?:number, size?:number, font?:string, italic?:boolean, lineHeight?:number}} [o]
   * @returns {Array} array of lines; each line = { runs, w, h, y, size, start, end, pageBreak } and each
   *   run = { text, x, w, start, color|null, size, font, italic, shake, wave }. `start`/`end` are glyph
   *   indices (typewriter positions). The array also carries: width, height, count (glyphs), plain
   *   (visible characters), ctrl ([{at, type:'wait'|'speed', value}]), font, size.
   *   Results are cached - treat them as read-only.
   */
  function layout(str, o) {
    o = o || {};
    const size = o.size || C.TEXT_SIZE;
    const font = o.font || 'body';
    const maxWidth = o.maxWidth > 0 ? o.maxWidth : Infinity;
    const lh = o.lineHeight || LINE_HEIGHT;
    const text = expand(str);
    const key = size + '|' + font + '|' + (o.italic ? 1 : 0) + '|' + maxWidth + '|' + lh + '|' + text;
    const hit = cache.get(key);
    if (hit) return hit;

    const tokens = tokenize(text);
    const lines = [];
    const ctrl = [];
    let plain = '';
    let glyph = 0;
    let word = [];
    let wordW = 0;
    const stack = [{ color: null, scale: 1, shake: false, wave: false, italic: !!o.italic }];
    const top = function () { return stack[stack.length - 1]; };
    const px = function (st) { return Math.max(6, Math.round(size * st.scale)); };
    const measure = function (s, st) { return G.Gfx.measureRaw(s, px(st), font, st.italic); };
    const newLine = function (soft) {
      return { runs: [], w: 0, h: size * lh, y: 0, size: size, start: glyph, end: glyph, soft: soft, pageBreak: false };
    };
    let cur = newLine(false);

    const pushLine = function (soft) {
      cur.end = glyph;
      let maxSize = cur.runs.length ? 0 : size;
      for (const r of cur.runs) maxSize = Math.max(maxSize, r.size);
      cur.size = maxSize;
      cur.h = maxSize * lh;
      const lastRun = cur.runs[cur.runs.length - 1];
      if (lastRun && / $/.test(lastRun.text)) {
        cur.w = lastRun.x + G.Gfx.measureRaw(lastRun.text.replace(/ +$/, ''), lastRun.size, font, lastRun.italic);
      }
      lines.push(cur);
      cur = newLine(soft);
    };

    const append = function (seg) {
      if (seg.ctrl) { ctrl.push({ at: glyph, type: seg.ctrl.type, value: seg.ctrl.value }); return; }
      const last = cur.runs[cur.runs.length - 1];
      if (last && last.style === seg.style) {
        last.text += seg.text;
        last.w = measure(last.text, seg.style);
        cur.w = last.x + last.w;
      } else {
        const st = seg.style;
        cur.runs.push({
          text: seg.text, x: cur.w, w: seg.w, start: glyph, style: st,
          color: st.color, size: px(st), font: font, italic: st.italic, shake: st.shake, wave: st.wave,
        });
        cur.w += seg.w;
      }
      plain += seg.text;
      glyph += seg.text.length;
    };

    const flushWord = function () {
      if (!word.length) return;
      if (cur.runs.length && cur.w + wordW > maxWidth) pushLine(true);
      if (wordW > maxWidth) {
        for (const seg of word) {
          if (seg.ctrl) { append(seg); continue; }
          for (const ch of seg.text) {
            const w = measure(ch, seg.style);
            if (cur.runs.length && cur.w + w > maxWidth) pushLine(true);
            append({ text: ch, w: w, style: seg.style });
          }
        }
      } else {
        for (const seg of word) append(seg);
      }
      word = [];
      wordW = 0;
    };

    for (const tk of tokens) {
      if (tk.t === 'text') {
        const st = top();
        const parts = tk.s.split(/( +)/);
        for (const part of parts) {
          if (!part) continue;
          if (part[0] === ' ') {
            flushWord();
            if (!cur.runs.length && cur.soft) continue; // no leading spaces after an automatic wrap
            append({ text: part, w: measure(part, st), style: st });
          } else {
            const w = measure(part, st);
            word.push({ text: part, w: w, style: st });
            wordW += w;
          }
        }
      } else if (tk.t === 'nl') {
        flushWord();
        pushLine(false);
      } else if (tk.t === 'page') {
        flushWord();
        if (cur.runs.length || lines.length) { cur.pageBreak = true; pushLine(false); }
      } else if (tk.t === 'wait' || tk.t === 'speed') {
        const c = { ctrl: { type: tk.t, value: tk.n } };
        if (word.length) word.push(c); else append(c);
      } else if (tk.t === 'open') {
        const st = Object.assign({}, top());
        if (tk.tag === 'c') st.color = colorOf(tk.arg || 'red');
        else if (tk.tag === 'shake') st.shake = true;
        else if (tk.tag === 'wave') st.wave = true;
        else if (tk.tag === 'big') st.scale = st.scale * 1.5;
        else if (tk.tag === 'small') st.scale = st.scale * 0.75;
        else if (tk.tag === 'i') st.italic = true;
        st.tag = tk.tag;
        stack.push(st);
      } else if (tk.t === 'close') {
        if (stack.length > 1) stack.pop();
      }
    }
    flushWord();
    if (cur.runs.length || !lines.length) pushLine(false);

    let y = 0, width = 0;
    for (const ln of lines) { ln.y = y; y += ln.h; width = Math.max(width, ln.w); }
    lines.width = width;
    lines.height = y;
    lines.count = glyph;
    lines.plain = plain;
    lines.ctrl = ctrl;
    lines.font = font;
    lines.size = size;

    if (cache.size > 300) cache.clear();
    cache.set(key, lines);
    return lines;
  }

  /**
   * Splits a layout into pages.
   * @param {string|Array} strOrLines a string (laid out with `o`) or a layout() result
   * @param {{maxLines?:number, maxHeight?:number}} [o] defaults: 4 lines of the base size
   * @returns {Array<{lines:Array, start:number, end:number, width:number, height:number, plain:string, ctrl:Array}>}
   */
  function paginate(strOrLines, o) {
    o = o || {};
    const lines = typeof strOrLines === 'string' ? layout(strOrLines, o) : strOrLines;
    const maxLines = o.maxLines || 4;
    const maxHeight = o.maxHeight || maxLines * lines.size * (o.lineHeight || LINE_HEIGHT) + 0.5;
    const pages = [];
    let page = null;
    const open = function (ln) {
      page = { lines: [], start: ln.start, end: ln.end, width: 0, height: 0, plain: lines.plain, ctrl: lines.ctrl };
      pages.push(page);
    };
    for (const ln of lines) {
      if (!page || page.lines.length >= maxLines || (page.lines.length && page.height + ln.h > maxHeight)) open(ln);
      page.lines.push(Object.assign({}, ln, { y: page.height }));
      page.height += ln.h;
      page.width = Math.max(page.width, ln.w);
      page.end = ln.end;
      if (ln.pageBreak) page = null;
    }
    if (!pages.length) pages.push({ lines: [], start: 0, end: 0, width: 0, height: 0, plain: '', ctrl: [] });
    return pages;
  }

  function prefixWidths(run) {
    if (!run.cx) {
      run.cx = [0];
      for (let i = 1; i <= run.text.length; i++) {
        run.cx.push(G.Gfx.measureRaw(run.text.slice(0, i), run.size, run.font, run.italic));
      }
    }
    return run.cx;
  }

  /**
   * Draws laid-out lines (a layout() result, a page, or page.lines) with their top-left at (x, y).
   * @param {{upTo?:number, align?:'left'|'center'|'right', width?:number, color?:string, alpha?:number,
   *          outline?:string}} [o] `upTo` = number of glyphs revealed (absolute glyph index, exclusive);
   *          `width` = box width used for center/right alignment (default: the widest line).
   */
  function draw(lines, x, y, o) {
    o = o || {};
    if (lines && !Array.isArray(lines) && lines.lines) lines = lines.lines;
    if (!lines || !lines.length) return;
    const ctx = G.Gfx.ctx;
    const upTo = o.upTo == null ? Infinity : o.upTo;
    const base = o.color || C.COLORS.ink;
    const t = G.Gfx.frame;
    let boxW = o.width;
    if (boxW == null) { boxW = 0; for (const ln of lines) boxW = Math.max(boxW, ln.w); }
    ctx.save();
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    for (const ln of lines) {
      if (ln.start >= upTo) break;
      const ox = o.align === 'center' ? (boxW - ln.w) / 2 : o.align === 'right' ? boxW - ln.w : 0;
      const by = y + ln.y + ln.h / 2 + ln.size * 0.33;
      for (const run of ln.runs) {
        const n = Math.min(run.text.length, upTo - run.start);
        if (n <= 0) break;
        ctx.font = G.Gfx.fontString(run.size, run.font, run.italic);
        ctx.fillStyle = run.color || base;
        const rx = x + ox + run.x;
        if (run.shake || run.wave) {
          const cx = prefixWidths(run);
          for (let i = 0; i < n; i++) {
            const ch = run.text[i];
            if (ch === ' ') continue;
            let dx = 0, dy = 0;
            if (run.shake) {
              const k = (run.start + i) * 7 + Math.floor(t / 3) * 131;
              dx += G.Util.noise(k, 1) * 1.4;
              dy += G.Util.noise(k, 2) * 1.4;
            }
            if (run.wave) dy += Math.sin(t * 0.13 + (run.start + i) * 0.55) * run.size * 0.13;
            if (o.outline) { ctx.strokeStyle = o.outline; ctx.lineWidth = run.size / 6; ctx.strokeText(ch, rx + cx[i] + dx, by + dy); }
            ctx.fillText(ch, rx + cx[i] + dx, by + dy);
          }
        } else {
          const s = n >= run.text.length ? run.text : run.text.slice(0, n);
          if (o.outline) { ctx.strokeStyle = o.outline; ctx.lineWidth = run.size / 6; ctx.strokeText(s, rx, by); }
          ctx.fillText(s, rx, by);
        }
      }
    }
    ctx.restore();
  }

  /**
   * Convenience: layout (cached) + draw in one call.
   * @returns {Array} the layout (so the caller can read .width/.height)
   */
  function drawRich(str, x, y, o) {
    const lines = layout(str, o);
    draw(lines, x, y, o);
    return lines;
  }

  /** Removes all markup and returns the visible characters (after {name}/{v:} expansion). */
  function strip(str) {
    return tokenize(expand(str)).map(function (tk) {
      return tk.t === 'text' ? tk.s : tk.t === 'nl' ? '\n' : '';
    }).join('');
  }

  const SPEED_FACTORS = [1.7, 1, 0.5, 0];

  /**
   * Typewriter over one page (or a whole layout). Call update() once per frame and pass `upTo` to draw().
   * @param {object|Array} page a paginate() page or a layout() result
   * @param {{speed?:number, onGlyph?:function(string, number)}} [o] speed = frames per character (default 2,
   *   scaled by G.State.options.textSpeed: 0 slow, 1 normal, 2 fast, 3 instant)
   */
  function Typer(page, o) {
    o = o || {};
    const isLayout = Array.isArray(page);
    this.start = isLayout ? 0 : page.start;
    this.end = isLayout ? page.count : page.end;
    this.plain = page.plain || '';
    this.ctrl = (page.ctrl || []).filter(function (c) { return c.at >= this.start && c.at <= this.end; }, this);
    this.fired = 0;
    this.pos = this.start;
    this.speed = o.speed != null ? o.speed : 2;
    this.wait = 0;
    this.acc = 0;
    this.onGlyph = o.onGlyph || null;
  }
  Object.defineProperty(Typer.prototype, 'done', { get: function () { return this.pos >= this.end && this.wait <= 0; } });
  Object.defineProperty(Typer.prototype, 'upTo', { get: function () { return this.pos; } });

  /** Applies control codes placed at the current position. Returns true when a pause started. */
  Typer.prototype._controls = function (ignoreWaits) {
    while (this.fired < this.ctrl.length && this.ctrl[this.fired].at <= this.pos) {
      const c = this.ctrl[this.fired++];
      if (c.type === 'speed') this.speed = c.value;
      else if (c.type === 'wait' && !ignoreWaits && c.value > 0) { this.wait = c.value; return true; }
    }
    return false;
  };

  /**
   * Advances by one frame.
   * @param {boolean} [fast] fast-forward: several glyphs per frame, pauses ignored
   */
  Typer.prototype.update = function (fast) {
    if (this.wait > 0) {
      if (fast) this.wait = 0; else { this.wait--; return; }
    }
    if (this.pos >= this.end) { this._controls(fast); return; }
    const opt = G.State && G.State.options ? G.State.options.textSpeed : 1;
    const factor = SPEED_FACTORS[opt] != null ? SPEED_FACTORS[opt] : 1;
    const fpc = this.speed * factor;
    if (fast) this.acc += 8;
    else if (fpc <= 0) this.acc += this.end - this.pos + 1;
    else this.acc += 1 / fpc;
    while (this.acc >= 1 && this.pos < this.end) {
      if (this._controls(fast)) { this.acc = 0; return; }
      const ch = this.plain[this.pos] || '';
      const next = this.plain[this.pos + 1] || '';
      this.pos++;
      this.acc -= 1;
      if (this.onGlyph && ch !== ' ') this.onGlyph(ch, this.pos);
      if (!fast && fpc > 0 && this.pos < this.end) {
        let pause = 0;
        if ('.!?…'.indexOf(ch) >= 0) pause = next === ' ' || next === '' ? 9 : (ch === '.' && next === '.' ? 5 : 0);
        else if (',;:—'.indexOf(ch) >= 0 && next === ' ') pause = 5;
        if (pause) { this.wait = Math.round(pause * Math.max(0.5, factor)); this.acc = 0; return; }
      }
    }
    if (this.pos >= this.end) { this.acc = 0; this._controls(fast); }
  };

  /** Reveals the whole page immediately (speed changes still apply, pauses are dropped). */
  Typer.prototype.complete = function () {
    this.pos = this.end;
    this.wait = 0;
    this.acc = 0;
    this._controls(true);
  };

  G.Text = {
    LINE_HEIGHT: LINE_HEIGHT,
    expand: expand,
    /** Expands {name}/{v:} and returns the token list (see tokenize). */
    parse: function (str) { return tokenize(expand(str)); },
    tokenize: tokenize,
    layout: layout,
    paginate: paginate,
    draw: draw,
    drawRich: drawRich,
    strip: strip,
    Typer: Typer,
    /** Drops cached layouts (call after fonts finish loading). */
    clearCache: function () { cache.clear(); },
  };
})();
