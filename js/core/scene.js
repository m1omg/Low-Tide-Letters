/*
 * scene.js - the scene stack.
 *
 * Scene interface (every method optional): { enter(params), exit(), pause(), resume(result), update(),
 * draw(ctx), opaque }. Set `opaque = false` on overlay scenes (menus) so the scene below is still drawn.
 * Only the top scene is updated. A registered scene may be a plain object (singleton, re-entered on each
 * push) or a constructor function/class (a fresh instance is created on each push).
 */
(function () {
  'use strict';
  const G = window.G;

  const registry = {};
  const stack = [];   // entries: { scene, name, resolve }

  function resolveScene(sceneOrName) {
    if (typeof sceneOrName === 'string') {
      const reg = registry[sceneOrName];
      if (!reg) throw new Error('Scene not registered: ' + sceneOrName);
      const scene = typeof reg === 'function' ? new reg() : reg; // eslint-disable-line new-cap
      return { scene: scene, name: sceneOrName };
    }
    if (!sceneOrName || typeof sceneOrName !== 'object') throw new Error('Scenes: invalid scene');
    let name = sceneOrName.name || sceneOrName.sceneName || null;
    for (const k of Object.keys(registry)) if (registry[k] === sceneOrName) name = k;
    return { scene: sceneOrName, name: name || 'anonymous' };
  }

  function call(scene, method, arg) {
    if (scene && typeof scene[method] === 'function') {
      try {
        return scene[method](arg);
      } catch (e) {
        G.error(e);
      }
    }
    return undefined;
  }

  function topEntry() {
    return stack.length ? stack[stack.length - 1] : null;
  }

  function enterNew(sceneOrName, params) {
    const entry = resolveScene(sceneOrName);
    const promise = new Promise(function (resolve) { entry.resolve = resolve; });
    stack.push(entry);
    if (G.Input && G.Input.block) G.Input.block(false);
    call(entry.scene, 'enter', params || {});
    return promise;
  }

  G.Scenes = {
    /**
     * Registers a scene under a name ('title', 'map', 'battle', 'menu', ...).
     * @param {string} name
     * @param {object|Function} scene singleton object or constructor
     */
    register: function (name, scene) {
      if (registry[name]) G.warn('Scene registered twice: ' + name);
      registry[name] = scene;
      return scene;
    },

    /** True when a scene with this name is registered. */
    has: function (name) {
      return !!registry[name];
    },

    /** The registered scene object/constructor (or null). */
    get: function (name) {
      return registry[name] || null;
    },

    /**
     * Pauses the current top scene and enters a new one on top of it.
     * @param {string|object} scene registered name or a scene object
     * @param {object} [params] passed to scene.enter(params)
     * @returns {Promise<*>} resolves with the `result` given to pop(result) when that scene is popped
     *   (undefined when it is removed by replace/clearTo). Example:
     *   `const r = await G.Scenes.push('battle', {troop:'x'});  // r.outcome`
     */
    push: function (scene, params) {
      const below = topEntry();
      if (below) call(below.scene, 'pause');
      return enterNew(scene, params);
    },

    /**
     * Exits the top scene, resolves its push() promise with `result` and resumes the scene below with
     * resume(result).
     */
    pop: function (result) {
      const entry = stack.pop();
      if (!entry) return;
      call(entry.scene, 'exit');
      const below = topEntry();
      if (below) call(below.scene, 'resume', result);
      entry.resolve(result);
    },

    /** Exits the top scene (its promise resolves with undefined) and enters another in its place. */
    replace: function (scene, params) {
      const entry = stack.pop();
      if (entry) { call(entry.scene, 'exit'); entry.resolve(undefined); }
      return enterNew(scene, params);
    },

    /**
     * Exits every scene (top first) and starts over with a single scene. Also closes any open message,
     * choice or toast (their pending promises are dropped, so abandoned event scripts simply stop).
     */
    clearTo: function (scene, params) {
      while (stack.length) {
        const entry = stack.pop();
        call(entry.scene, 'exit');
        entry.resolve(undefined);
      }
      if (G.UI && G.UI.reset) G.UI.reset();
      return enterNew(scene, params);
    },

    /** The top scene object (or null when the stack is empty). */
    top: function () {
      const e = topEntry();
      return e ? e.scene : null;
    },

    /** Registered name of the top scene ('anonymous' for unregistered objects, null when empty). */
    topName: function () {
      const e = topEntry();
      return e ? e.name : null;
    },

    /** Names of all scenes on the stack, bottom first. */
    names: function () {
      return stack.map(function (e) { return e.name; });
    },

    /** True when a scene with this registered name is somewhere on the stack. */
    isActive: function (name) {
      return stack.some(function (e) { return e.name === name; });
    },

    /** The live scene object with this registered name that is highest on the stack (or null). */
    find: function (name) {
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].name === name) return stack[i].scene;
      return null;
    },

    /** Number of scenes on the stack. */
    depth: function () {
      return stack.length;
    },

    /** Updates the top scene (errors are captured in G.errors instead of killing the loop). */
    update: function () {
      const e = topEntry();
      if (e) call(e.scene, 'update');
    },

    /** Draws from the lowest visible scene upwards: everything above the top-most opaque scene. */
    draw: function (ctx) {
      let from = stack.length - 1;
      while (from > 0 && stack[from].scene.opaque === false) from--;
      for (let i = Math.max(0, from); i < stack.length; i++) {
        if (G.Pointer) G.Pointer.layer(i === stack.length - 1);    // only the top scene is clickable
        ctx.save();
        call(stack[i].scene, 'draw', ctx);
        ctx.restore();
      }
      if (G.Pointer) G.Pointer.layer(true);
    },
  };
})();
