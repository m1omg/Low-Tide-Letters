/*
 * system.js - where a new game begins.
 *
 * G.DATA.system = {
 *   title        window / title-screen name of the game.
 *   startMap     { id, x, y, dir } the very first map and the tile the protagonist stands on.
 *   startParty   actor ids that are in the party at the start (order = battle order).
 *   startItems   { itemId: count } starting inventory.
 *   startFlags   { flagName: true } flags that are already set at the start.
 *   startVars    { varName: n } variables that already have a value at the start.
 *   startMoney   starting money.
 *   currencyName what money is called in the UI.
 * }
 *
 * G.State.newGame() reads G.DATA.newGame, so this file also publishes the same values under that name -
 * that keeps the engine core free of game-specific knowledge.
 *
 * FINAL VALUES (CONTENT_CONTRACT 5, "Prologue handoff"): a new game opens on `shingle_beach` at (20,14)
 * facing down with `tide` = 0, Wren alone. shore_b's prologue auto event (page cond `tide == 0`) plays
 * there and ends with ['call','ce_prologue_done'] (js/data/common_events.js, owned by shore_a), which
 * sets `tide` = 1 and moves Wren to her bedroom for the present-day opening.
 *
 * The two bags of chips are what is actually in the coat: "string, a peg, sand" is flavour, chips are
 * mechanics. Fifteen Stamps is enough for exactly one Chip of glass at Shelley's and not a penny more,
 * which is the correct amount of money for a twelve-year-old.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};

  const system = G.DATA.system = {
    title: 'Low Tide Letters',
    startMap: { id: 'shingle_beach', x: 20, y: 14, dir: 'down' },
    startParty: ['wren'],
    startItems: { bag_of_chips: 2 },
    startFlags: {},
    /** The chapter clock of DESIGN_BIBLE 5.1. 0 = prologue. Only the chapter-flow common events move it. */
    startVars: { tide: 0 },
    startMoney: 15,
    currencyName: 'Stamps',
    /** Default battle music (troops may override it with their own `bgm`). */
    battleBgm: 'bgm_battle',
  };

  /** What G.State.newGame() consumes (TECH_SPEC section 3). */
  G.DATA.newGame = {
    party: system.startParty.slice(),
    map: { id: system.startMap.id, x: system.startMap.x, y: system.startMap.y, dir: system.startMap.dir },
    items: Object.assign({}, system.startItems),
    flags: Object.assign({}, system.startFlags),
    vars: Object.assign({}, system.startVars),
    money: system.startMoney,
  };
})();
