/*
 * audio.js - music / ambience / sound effects.
 * Primary path: WebAudio (fetch + decodeAudioData, sample-accurate gapless loops).
 * Fallback path: HTMLAudioElement with loop=true, used automatically when fetch is impossible
 * (file://) or fails for a given id. Missing ids warn once and are skipped.
 */
(function () {
  'use strict';
  const G = window.G;

  let manifest = {};
  let audioEmpty = true;
  let toldEmpty = false;
  let ctx = null;
  let canFetch = false;
  let gesture = false;
  let autoSuspended = false;
  let inited = false;
  const bus = { bgm: null, sfx: null };
  const volumes = { bgm: 0.7, sfx: 0.8 };
  const buffers = new Map();     // id -> AudioBuffer
  const loading = new Map();     // id -> Promise<AudioBuffer|null>
  const noBuffer = new Set();    // ids that must use the HTMLAudio path
  const bgmLru = [];             // decoded music kept in memory (most recent last)
  const BGM_CACHE = 4;
  const elementVoices = new Set();
  const blockedVoices = new Set();
  const sfxPools = {};
  const lastSfx = {};

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  function missing(id) {
    if (audioEmpty) {
      if (!toldEmpty) {
        toldEmpty = true;
        console.info('[audio] the manifest lists no audio files yet - sound is disabled');
      }
      return;
    }
    G.warn('Missing audio: ' + id);
  }

  function entryVolume(entry) {
    return entry && typeof entry.volume === 'number' ? entry.volume : 1;
  }

  /* ------------------------------------------------------------------ voices */

  /** WebAudio voice: one AudioBufferSourceNode + gain. */
  function BufferVoice(id, buffer, kind, loop) {
    this.id = id; this.buffer = buffer; this.kind = kind; this.loop = loop;
    this.gain = ctx.createGain();
    this.gain.connect(bus[kind]);
    this.src = null; this.startedAt = 0; this.offset = 0; this.onended = null; this.dead = false;
  }
  BufferVoice.prototype.start = function (offset, vol, fadeInMs) {
    const dur = this.buffer.duration;
    offset = dur > 0 ? ((offset || 0) % dur + dur) % dur : 0;
    const src = this.src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = this.loop;
    src.connect(this.gain);
    const self = this;
    src.onended = function () {
      self.dead = true;
      try { self.gain.disconnect(); } catch (e) { /* already gone */ }
      if (self.onended) self.onended();
    };
    const t = ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    if (fadeInMs > 0) {
      this.gain.gain.setValueAtTime(0, t);
      this.gain.gain.linearRampToValueAtTime(vol, t + fadeInMs / 1000);
    } else {
      this.gain.gain.setValueAtTime(vol, t);
    }
    this.startedAt = t; this.offset = offset;
    src.start(0, offset);
  };
  BufferVoice.prototype.fadeTo = function (vol, ms) {
    const t = ctx.currentTime, g = this.gain.gain;
    const cur = g.value;
    g.cancelScheduledValues(t);
    g.setValueAtTime(cur, t);
    if (ms > 0) g.linearRampToValueAtTime(vol, t + ms / 1000);
    else g.setValueAtTime(vol, t);
  };
  BufferVoice.prototype.stop = function (ms) {
    if (this.dead || !this.src) return;
    this.onended = null;
    this.fadeTo(0, ms || 0);
    try { this.src.stop(ctx.currentTime + (ms || 0) / 1000 + 0.03); } catch (e) { /* not started */ }
  };
  BufferVoice.prototype.position = function () {
    const dur = this.buffer.duration;
    const p = ctx.currentTime - this.startedAt + this.offset;
    return this.loop && dur > 0 ? p % dur : Math.min(p, dur);
  };

  /** Fallback voice: one <audio> element; fades are stepped with a timer. */
  function ElementVoice(id, entry, kind, loop) {
    this.id = id; this.kind = kind; this.loop = loop; this.vol = 0; this.timer = null;
    this.onended = null; this.dead = false; this.paused = false;
    const el = this.el = new Audio();
    el.preload = 'auto';
    el.loop = loop;
    el.src = entry.path;
    const self = this;
    el.addEventListener('ended', function () { if (!self.loop) { self.kill(); if (self.onended) self.onended(); } });
    el.addEventListener('error', function () { G.warn('Audio failed to load: ' + id); self.kill(); });
  }
  ElementVoice.prototype.apply = function () {
    this.el.volume = clamp01(this.vol * volumes[this.kind]);
  };
  ElementVoice.prototype.tryPlay = function () {
    const self = this;
    let p;
    try { p = this.el.play(); } catch (e) { p = null; }
    if (p && p.catch) {
      p.then(function () { blockedVoices.delete(self); })
        .catch(function (err) {
          if (self.dead) return;
          if (err && err.name === 'NotAllowedError') blockedVoices.add(self);
        });
    }
  };
  ElementVoice.prototype.start = function (offset, vol, fadeInMs) {
    const el = this.el;
    elementVoices.add(this);
    this.vol = fadeInMs > 0 ? 0 : vol;
    this.apply();
    if (offset > 0) {
      const seek = function () {
        try { el.currentTime = el.duration ? offset % el.duration : offset; } catch (e) { /* not seekable */ }
      };
      if (el.readyState >= 1) seek(); else el.addEventListener('loadedmetadata', seek, { once: true });
    }
    this.tryPlay();
    if (fadeInMs > 0) this.fadeTo(vol, fadeInMs);
  };
  ElementVoice.prototype.fadeTo = function (vol, ms, then) {
    const self = this;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (!(ms > 0)) { this.vol = vol; this.apply(); if (then) then(); return; }
    const from = this.vol, t0 = performance.now();
    this.timer = setInterval(function () {
      const k = Math.min(1, (performance.now() - t0) / ms);
      self.vol = from + (vol - from) * k;
      self.apply();
      if (k >= 1) { clearInterval(self.timer); self.timer = null; if (then) then(); }
    }, 30);
  };
  ElementVoice.prototype.kill = function () {
    this.dead = true;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    try { this.el.pause(); } catch (e) { /* ignore */ }
    elementVoices.delete(this);
    blockedVoices.delete(this);
  };
  ElementVoice.prototype.stop = function (ms) {
    if (this.dead) return;
    this.onended = null;
    const self = this;
    this.fadeTo(0, ms || 0, function () { self.kill(); });
  };
  ElementVoice.prototype.position = function () {
    return this.el.currentTime || 0;
  };

  /* ------------------------------------------------------------------ loading */

  function decode(arrayBuffer) {
    return new Promise(function (resolve, reject) {
      const p = ctx.decodeAudioData(arrayBuffer, resolve, reject);
      if (p && p.catch) p.catch(reject);
    });
  }

  function loadBuffer(id) {
    if (buffers.has(id)) return Promise.resolve(buffers.get(id));
    if (loading.has(id)) return loading.get(id);
    const entry = manifest[id];
    const p = fetch(entry.path)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(decode)
      .then(function (buf) {
        buffers.set(id, buf);
        if (entry.kind === 'bgm') {
          bgmLru.push(id);
          while (bgmLru.length > BGM_CACHE) {
            const victim = bgmLru.find(function (v) { return v !== id && v !== channels.bgm.id && v !== channels.amb.id; });
            if (!victim) break;
            bgmLru.splice(bgmLru.indexOf(victim), 1);
            buffers.delete(victim);
          }
        }
        loading.delete(id);
        return buf;
      })
      .catch(function (err) {
        console.info('[audio] WebAudio path unavailable for ' + id + ' (' + (err && err.message) + '), using <audio>');
        noBuffer.add(id);
        loading.delete(id);
        return null;
      });
    loading.set(id, p);
    return p;
  }

  function useBuffers(id) {
    return !!ctx && canFetch && !noBuffer.has(id);
  }

  function makeVoice(id, kind, loop) {
    const entry = manifest[id];
    if (useBuffers(id)) {
      return loadBuffer(id).then(function (buf) {
        return buf ? new BufferVoice(id, buf, kind, loop) : new ElementVoice(id, entry, kind, loop);
      });
    }
    return Promise.resolve(new ElementVoice(id, entry, kind, loop));
  }

  /* ------------------------------------------------------------------ channels (bgm, ambience) */

  function Channel(name, alwaysLoop) {
    this.name = name; this.alwaysLoop = alwaysLoop;
    this.id = null;        // requested track id (may still be loading)
    this.volume = 1;       // requested track volume 0..1 (before the manifest volume)
    this.voice = null; this.pending = null; this.token = 0; this.saved = null;
  }
  Channel.prototype.play = function (id, opts) {
    opts = opts || {};
    const fadeMs = opts.fadeMs != null ? opts.fadeMs : 600;
    const volume = opts.volume != null ? opts.volume : 1;
    if (!id || id === 'none') { this.stop(fadeMs); return; }
    const entry = manifest[id];
    if (!entry) { missing(id); this.stop(fadeMs); return; }
    if (this.id === id) {
      this.volume = volume;
      if (this.voice) this.voice.fadeTo(volume * entryVolume(entry), fadeMs);
      return;
    }
    const hadOld = !!this.voice && !this.voice.dead;
    this.stop(fadeMs);
    const self = this;
    const token = this.token;
    const loop = this.alwaysLoop || entry.loop !== false;
    const startAt = opts.startAt || 0;
    const delay = hadOld ? fadeMs : 0;
    const t0 = performance.now();
    this.id = id; this.volume = volume;
    this.pending = { id: id, startAt: startAt };
    makeVoice(id, 'bgm', loop).then(function (voice) {
      if (self.token !== token) return;
      const go = function () {
        if (self.token !== token) return;
        self.pending = null;
        self.voice = voice;
        voice.onended = function () {
          if (self.voice === voice) { self.voice = null; self.id = null; }
        };
        voice.start(startAt, self.volume * entryVolume(entry), opts.fadeInMs != null ? opts.fadeInMs : 150);
      };
      const remaining = delay - (performance.now() - t0);
      if (remaining > 5) setTimeout(go, remaining); else go();
    });
  };
  Channel.prototype.stop = function (fadeMs) {
    this.token++;
    if (this.voice) this.voice.stop(fadeMs != null ? fadeMs : 600);
    this.voice = null; this.pending = null; this.id = null;
  };
  Channel.prototype.fade = function (toVol, ms) {
    this.volume = toVol;
    if (this.voice) this.voice.fadeTo(toVol * entryVolume(manifest[this.id]), ms != null ? ms : 600);
  };
  Channel.prototype.position = function () {
    if (this.voice) return this.voice.position();
    return this.pending ? this.pending.startAt : 0;
  };
  Channel.prototype.save = function () {
    this.saved = { id: this.id, pos: this.position(), volume: this.volume };
  };
  Channel.prototype.restore = function (fadeMs) {
    const s = this.saved;
    this.saved = null;
    if (!s) return;
    if (!s.id) { this.stop(fadeMs); return; }
    this.play(s.id, { fadeMs: fadeMs, volume: s.volume, startAt: s.pos, fadeInMs: 500 });
  };

  const channels = { bgm: new Channel('bgm', false), amb: new Channel('amb', true) };

  /* ------------------------------------------------------------------ sfx */

  function fireBuffer(buf, vol, rate) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g); g.connect(bus.sfx);
    src.onended = function () { try { g.disconnect(); } catch (e) { /* ignore */ } };
    src.start(0);
  }

  function fireElement(id, entry, vol, rate) {
    const pool = sfxPools[id] || (sfxPools[id] = []);
    let el = pool.find(function (a) { return a.paused || a.ended; });
    if (!el) {
      if (pool.length < 4) {
        el = new Audio();
        el.preload = 'auto';
        el.src = entry.path;
        el.addEventListener('error', function () { G.warn('Audio failed to load: ' + id); });
        pool.push(el);
      } else {
        el = pool[0];
        pool.push(pool.shift());
      }
    }
    try {
      el.currentTime = 0;
      el.volume = clamp01(vol * volumes.sfx);
      if ('preservesPitch' in el) el.preservesPitch = false;
      el.playbackRate = rate;
      const p = el.play();
      if (p && p.catch) p.catch(function () { /* locked before first gesture: skip */ });
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ public API */

  const A = G.Audio = {
    /** Builds the audio graph and installs the unlock listeners. Called by main.js at boot. */
    init: function () {
      manifest = (G.DATA.manifest && G.DATA.manifest.audio) || {};
      audioEmpty = Object.keys(manifest).length === 0;
      if (G.State && G.State.options) {
        volumes.bgm = clamp01(G.State.options.bgmVol);
        volumes.sfx = clamp01(G.State.options.sfxVol);
      }
      if (inited) return;
      inited = true;
      canFetch = typeof fetch === 'function' && window.location.protocol !== 'file:';
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC && canFetch) {
        try {
          ctx = new AC();
          const master = ctx.createGain();
          master.connect(ctx.destination);
          bus.bgm = ctx.createGain(); bus.bgm.gain.value = volumes.bgm; bus.bgm.connect(master);
          bus.sfx = ctx.createGain(); bus.sfx.gain.value = volumes.sfx; bus.sfx.connect(master);
        } catch (e) {
          ctx = null;
        }
      }
      const onGesture = function () { A.unlock(); };
      window.addEventListener('keydown', onGesture, true);
      window.addEventListener('pointerdown', onGesture, true);
      window.addEventListener('touchstart', onGesture, true);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          if (ctx && ctx.state === 'running') { autoSuspended = true; ctx.suspend(); }
          elementVoices.forEach(function (v) { if (!v.el.paused) { v.paused = true; v.el.pause(); } });
        } else {
          if (ctx && autoSuspended) { autoSuspended = false; ctx.resume(); }
          elementVoices.forEach(function (v) { if (v.paused) { v.paused = false; v.tryPlay(); } });
        }
      });
    },

    /** Resumes audio after the first user gesture (also called automatically on key/pointer events). */
    unlock: function () {
      gesture = true;
      if (ctx && ctx.state === 'suspended' && !autoSuspended) {
        const p = ctx.resume();
        if (p && p.catch) p.catch(function () { /* still locked */ });
      }
      blockedVoices.forEach(function (v) { v.tryPlay(); });
    },

    /** 'webaudio' or 'html' - which path new sounds will use. */
    mode: function () {
      return ctx && canFetch ? 'webaudio' : 'html';
    },

    /** True once sound can actually be heard (context running or a gesture happened). */
    isUnlocked: function () {
      return ctx ? ctx.state === 'running' : gesture;
    },

    /**
     * Plays looping music. Same id as the current track only adjusts the volume. `'none'`/null stops.
     * The old track fades out over fadeMs, then the new one starts.
     * @param {string|null} id
     * @param {{fadeMs?:number, volume?:number, startAt?:number}} [opts] startAt in seconds
     */
    playBgm: function (id, opts) {
      channels.bgm.play(id, opts);
    },

    /** Fades the music out and forgets it. */
    stopBgm: function (fadeMs) {
      channels.bgm.stop(fadeMs);
    },

    /** Fades the current music to a relative volume (0..1) without stopping it. */
    fadeBgm: function (toVol, ms) {
      channels.bgm.fade(toVol, ms);
    },

    /** Remembers the current track and its position (battle start). */
    saveBgm: function () {
      channels.bgm.save();
    },

    /** Resumes the track remembered by saveBgm() at the saved position (battle end). */
    restoreBgm: function (fadeMs) {
      channels.bgm.restore(fadeMs != null ? fadeMs : 600);
    },

    /** Playback position of the current music in seconds. */
    bgmPosition: function () {
      return channels.bgm.position();
    },

    /**
     * Plays a one-shot sound effect.
     * @param {string} id
     * @param {{volume?:number, rate?:number}} [opts] rate = playback speed / pitch factor
     */
    playSfx: function (id, opts) {
      if (!id) return;
      const entry = manifest[id];
      if (!entry) { missing(id); return; }
      opts = opts || {};
      const vol = (opts.volume != null ? opts.volume : 1) * entryVolume(entry);
      const rate = opts.rate != null ? opts.rate : 1;
      const now = performance.now();
      if (lastSfx[id] && now - lastSfx[id] < 20) return;
      lastSfx[id] = now;
      if (useBuffers(id)) {
        if (ctx.state !== 'running') return;
        const buf = buffers.get(id);
        if (buf) { fireBuffer(buf, vol, rate); return; }
        loadBuffer(id).then(function (b) {
          if (b) { if (performance.now() - now < 300) fireBuffer(b, vol, rate); } else fireElement(id, entry, vol, rate);
        });
        return;
      }
      fireElement(id, entry, vol, rate);
    },

    /** Starts a looping ambience bed on its own channel (uses the music volume). */
    playAmbience: function (id, opts) {
      channels.amb.play(id, Object.assign({ fadeMs: 800 }, opts || {}));
    },

    /** Stops the ambience bed. */
    stopAmbience: function (fadeMs) {
      channels.amb.stop(fadeMs != null ? fadeMs : 800);
    },

    /**
     * Sets a bus volume and persists it in G.State.options (bgmVol / sfxVol).
     * @param {'bgm'|'sfx'} kind
     * @param {number} v 0..1
     */
    setVolume: function (kind, v) {
      if (kind !== 'bgm' && kind !== 'sfx') { G.warn('Audio.setVolume: unknown bus ' + kind); return; }
      v = clamp01(Number(v) || 0);
      volumes[kind] = v;
      if (bus[kind]) bus[kind].gain.setTargetAtTime(v, ctx.currentTime, 0.02);
      elementVoices.forEach(function (voice) { voice.apply(); });
      if (G.State && G.State.options) {
        G.State.options[kind + 'Vol'] = v;
        if (G.State.saveOptions) G.State.saveOptions();
      }
    },

    /** Current bus volume 0..1. */
    getVolume: function (kind) {
      return volumes[kind];
    },

    /** True when the id exists in the audio manifest. */
    has: function (id) {
      return !!manifest[id];
    },

    /**
     * Decodes every sound effect up front (WebAudio path only) so the first play has no latency.
     * @param {function(number, number)} [onProgress]
     * @returns {Promise<void>} never rejects
     */
    preloadSfx: function (onProgress) {
      const ids = Object.keys(manifest).filter(function (id) { return manifest[id].kind === 'sfx' && useBuffers(id); });
      let done = 0;
      if (!ids.length) return Promise.resolve();
      return Promise.all(ids.map(function (id) {
        return loadBuffer(id).then(function () { done++; if (onProgress) onProgress(done, ids.length); });
      })).then(function () {});
    },
  };

  Object.defineProperty(A, 'currentBgm', {
    enumerable: true,
    get: function () { return channels.bgm.id; },
  });
  Object.defineProperty(A, 'currentAmbience', {
    enumerable: true,
    get: function () { return channels.amb.id; },
  });
})();
