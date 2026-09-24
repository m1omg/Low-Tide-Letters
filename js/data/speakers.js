/*
 * speakers.js - who can talk in a message box (TECH_SPEC section 5, DESIGN_BIBLE 9.1).
 *
 * G.DATA.speakers[id] = {
 *   name   the name shown on the luggage tag tied to the message box (rich-text tags such as {name} work).
 *          May be a getter when the name changes with the story (see `tam`).
 *   color  tint of that luggage tag (the speaker colours of bible 9.1).
 *   faces  portrait family or null. The portrait image id is 'face_<faces>_<expr>', with `expr` coming
 *          from ['say', speaker, expr, text] and falling back to 'neutral' when that file is missing.
 *   blip   typing sound id (one blip every second glyph); null = silent typing.
 *   style  optional default message style for this speaker ('slip' for Nacre), used when the ['say']
 *          command does not ask for one.
 * }
 *
 * Narration and the protagonist's inner voice do not use a speaker: they are ['narrate',...] /
 * ['think',...]. Tam's can-voice wants a ['sfx','sfx_static'] under the line (bible 9.1); the message box
 * does not layer sounds by itself.
 *
 * Only wren / odo / lin / pim have portraits. Everyone else is a name tag only.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};

  const GREY = '#8a8a8a';

  const speakers = G.DATA.speakers = {
    /* ---------------------------------------------------------------- party */
    wren: { name: 'Wren', color: '#3a8c86', faces: 'wren', blip: 'sfx_blip_low' },
    odo: { name: 'Odo', color: '#e8843a', faces: 'odo', blip: 'sfx_blip_mid' },
    lin: { name: 'Lin', color: '#6f8f4a', faces: 'lin', blip: 'sfx_blip_high' },
    pim: { name: 'Pim', color: '#7fb2d9', faces: 'pim', blip: 'sfx_blip_odd' },

    /* ---------------------------------------------------------------- Shore */
    pop: { name: 'Pop', color: '#b79c6e', faces: null, blip: 'sfx_blip_mid' },
    mum: { name: 'Mum', color: '#a58bc4', faces: null, blip: 'sfx_blip_mid' },
    mr_brill: { name: 'Mr Brill', color: '#c9524a', faces: null, blip: 'sfx_blip_mid' },
    robin: { name: 'Robin', color: '#e6c245', faces: null, blip: 'sfx_blip_high' },
    towns_a: { name: 'Fisherman', color: GREY, faces: null, blip: 'sfx_blip_mid' },
    towns_b: { name: 'Old Lady', color: GREY, faces: null, blip: 'sfx_blip_mid' },

    /* ---------------------------------------------------------------- Lull */
    shelley: { name: 'Shelley', color: GREY, faces: null, blip: 'sfx_blip_mid' },
    stan: { name: 'Stan', color: GREY, faces: null, blip: 'sfx_blip_low' },
    postmaster_gull: { name: 'Postmaster Gull', color: GREY, faces: null, blip: 'sfx_blip_mid' },

    /*
     * Nacre never speaks aloud: printed paper slips slide in from the top of the screen (style 'slip').
     * The border colour of a slip is the colour of the tide it is handed over in (bible 8.5 reuses that
     * order as the Pearl Door combination), pearl-white in Tide 5.
     */
    nacre: {
      name: 'Nacre',
      color: '#9fb7c4',
      faces: null,
      blip: null,
      style: 'slip',
      slipColors: { 0: '#7fb2d9', 1: '#7fb2d9', 2: '#d9a13a', 3: '#c9524a', 4: '#6f9f4a', 5: '#efece2', 6: '#efece2' },
    },

    /* Name tag shows ??? until the flag `truth_known` is set (bible 3.2). */
    tam: {
      get name() { return G.State && G.State.getFlag && G.State.getFlag('truth_known') ? 'Tam' : '???'; },
      color: '#e9cf5a',
      faces: null,
      blip: 'sfx_blip_high',
    },

    /* ---------------------------------------------------------------- test maps (keep) */
    test_hero: { name: 'Test', color: '#3f72b8', faces: 'test', blip: 'sfx_blip_mid' },
    test_npc: { name: 'Pip', color: '#d8638f', faces: 'test', blip: 'sfx_blip_high' },
    test_sign: { name: 'Signpost', color: '#8a5a3c', faces: null, blip: 'sfx_blip_low' },
  };

  /** Colour of a speaker's name tag; unknown ids get the "everyone else" grey of bible 9.1. */
  G.DATA.speakerColor = function (id) {
    const s = speakers[id];
    return (s && s.color) || GREY;
  };
})();
