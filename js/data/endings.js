/*
 * endings.js - the data the ending scene plays (DESIGN_BIBLE 5.8, scene: js/scenes/ending_scene.js).
 *
 * An ending is reached with ['ending','<id>'] from an event; the ending router (ce_ending_router in
 * js/data/common_events_finale.js) decides which id in the order of bible 5.8: ending_pearl, then
 * ending_sent, then ending_not_yet. The playable half of each ending (letter_compose, the waking in
 * wren_house, the resume at the rock pool) is staged there; these pages are the quiet half.
 *
 * SCHEMA
 * G.DATA.endings.<id> = {
 *   bgm: 'bgm_id' | null,            music started when the ending begins (null = keep / silence)
 *   pages: [                          played in order, one screen each
 *     { cg: 'cg_id' | null,           full-screen illustration; a missing image falls back to a drawn
 *                                     colour wash (ending_scene._drawPicture), never a placeholder box,
 *                                     so every page below also reads on plain paper
 *       text: 'line one\nline two',   rich text (TECH_SPEC 5 markup works); '' = picture only
 *       style: 'narrate'              centred italic strip low on the screen (dry captions)
 *              | 'letter'             a paper sheet with ruled lines, for written words
 *              | 'plain',             big GochiHand words in the middle of the screen
 *       waitFrames: 240,              frames the page stays before it advances by itself
 *                                     (confirm always advances at once; 0/absent = wait for the player)
 *       sfx: 'sfx_id',                optional one-shot when the page appears
 *       fade: 20 }                    optional cross-fade length in frames (default 24)
 *   ],
 *   credits: true,                    roll js/data/credits.js after the last page
 *   after: 'title'                    'title' (default) | 'none' (the scene stays until popped)
 * }
 *
 * `pages` is a GETTER on the two endings that read the save: Ending A shows the three True Words the
 * player actually placed in the letter (letter_1..3) and how far the town has come back (nacre_delivered).
 * No ending reads a Deliver or Hush count (bible 12.1).
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};

  /** The nine True Words of bible 8.7, by the N of skN; letter_compose stores those numbers. */
  const TRUE_WORD = {
    1: "I'm not all right about it.",
    2: 'You were my best friend.',
    3: 'I saw you were sad and I looked away.',
    4: 'Thank you.',
    5: 'I kept the string up.',
    6: 'I read every postcard.',
    7: 'I should have helped you pack.',
    8: "I'm still your friend. If you want.",
    9: "I didn't mean it. I'm sorry.",
  };

  /** Reads a save flag without assuming the engine is running (the validator loads this file bare). */
  function flag(k) {
    return !!(G.State && G.State.getFlag && G.State.getFlag(k));
  }

  /** Reads a save variable the same way. @returns {number} */
  function num(k) {
    return (G.State && G.State.getVar ? G.State.getVar(k) : 0) | 0;
  }

  /** The letter as the player built it, or the plainest possible version of it. */
  function letterText() {
    const lines = [];
    for (const key of ['letter_1', 'letter_2', 'letter_3']) {
      const n = num(key);
      if (TRUE_WORD[n]) lines.push(TRUE_WORD[n]);
    }
    if (!lines.length) lines.push(TRUE_WORD[9]);
    return 'Dear Tam,\n\n' + lines.join('\n') + '\n\n— Wren';
  }

  G.DATA.endings = {

    /* ============================================================== A - "Sent" ================
     * gave_letter false, other_can_answered, final_choice == 1 (which needed true_words >= 6).
     * Whether Tam answers is never shown. The point was the sending.
     */
    ending_sent: {
      bgm: 'bgm_dear_tam',
      credits: true,
      after: 'title',
      get pages() {
        return [
          { cg: null, text: letterText(), style: 'letter', waitFrames: 420, sfx: 'sfx_page' },
          {
            cg: 'cg_ending_sent', style: 'narrate', waitFrames: 340, sfx: 'sfx_scribble',
            text: 'Monday, 9:14. Wren writes the address on the blue ruled line,\nand the letter goes in before she can think about it.',
          },
          {
            cg: 'cg_ending_sent', style: 'narrate', waitFrames: 300, sfx: 'sfx_bell',
            text: 'The flap of the postbox clacks shut.\nIt is the loudest thing on Harbour Row.',
          },
          {
            cg: 'cg_den_jar', style: 'narrate', waitFrames: 340,
            text: 'That afternoon she pulls the jar out from under the bed\nand carries it to the den. The door is not locked. Only stiff.',
          },
          { cg: null, text: 'She did not hear back that week.', style: 'narrate', waitFrames: 220 },
          { cg: null, text: 'She checked the mat anyway.\nThat was new.', style: 'narrate', waitFrames: 260 },
          {
            cg: null, style: 'narrate', waitFrames: 280,
            text: flag('nacre_delivered')
              ? 'The town started talking again that winter.\nAll at once, mostly about the weather, and then not only the weather.'
              : 'The town started talking again that winter.\nMostly about the weather. It was a start.',
          },
          {
            cg: null, style: 'narrate', waitFrames: 300,
            text: 'Moving day. A van, and far too many boxes of frying equipment.\nWren hands Odo an envelope: stamped, addressed, and completely empty.',
          },
          { cg: null, text: '"For you to fill in.\nI\'ll write back."', style: 'plain', waitFrames: 280 },
          { cg: null, text: '"Commencing not crying.\nNot crying is GO. Over."', style: 'plain', waitFrames: 280 },
          { cg: null, text: '"...Over."', style: 'plain', waitFrames: 300, sfx: 'sfx_can_rattle' },
          { cg: null, text: '{small}Coat Pocket: "Empty. Good."{/small}', style: 'narrate', waitFrames: 240 },
          {
            cg: null, style: 'narrate', waitFrames: 260, sfx: 'sfx_bell',
            text: 'One morning the letterbox flap clacks.\nWren looks up.',
          },
        ];
      },
    },

    /* ============================================================== B - "Not Yet" =============
     * gave_letter false, other_can_answered, final_choice == 2. No ending closes the door: the
     * cleared save loads at the pearl_bed rock pool with every zone open (ce_not_yet_keep).
     */
    ending_not_yet: {
      bgm: 'bgm_title',
      credits: true,
      after: 'title',
      pages: [
        {
          cg: null, style: 'narrate', waitFrames: 280,
          text: 'Dawn. The water comes in over the lowest steps,\nand the Lull goes back to being a sea.',
        },
        {
          cg: 'cg_not_yet', style: 'narrate', waitFrames: 340,
          text: 'Pim waves his flap from the bottom step until the water reaches it,\nthen hops into the coat pocket and makes himself comfortable.',
        },
        {
          cg: 'cg_not_yet', style: 'narrate', waitFrames: 300,
          text: '"Letters keep," he says, from inside the pocket.\n"It is the one thing we are excellent at."',
        },
        {
          cg: null, style: 'narrate', waitFrames: 300,
          text: 'Winter. Moving day. Wren writes her address\non the back of Odo\'s hand, in biro.',
        },
        { cg: null, text: '"It\'ll wash off."', style: 'plain', waitFrames: 240 },
        { cg: null, text: '"Then I\'ll write it again."', style: 'plain', waitFrames: 280 },
        { cg: null, text: '{small}Coat Pocket: "Not yet. But soon."{/small}', style: 'narrate', waitFrames: 240 },
        {
          cg: null, text: 'Not yet is allowed.', style: 'plain', waitFrames: 360,
          sfx: 'sfx_music_box_broken',
        },
      ],
    },

    /* ============================================================== C - "Pearl" ===============
     * gave_letter. Quiet, not punishing. Odo is still on the line, and the offer is still waiting
     * down there: loading the save (or answering the can) puts Wren back in front of it.
     */
    ending_pearl: {
      bgm: 'bgm_nacre',
      credits: true,
      after: 'title',
      pages: [
        {
          cg: 'cg_pearl_calm', style: 'narrate', waitFrames: 300,
          text: 'A calm, lovely, pale seabed. Ranks of smooth pearls,\nevery one of them exactly as nice as the next.',
        },
        {
          cg: 'cg_pearl_calm', style: 'narrate', waitFrames: 280,
          text: 'One of them is the exact shape of a paper boat.',
        },
        {
          cg: null, style: 'narrate', waitFrames: 300,
          text: 'The winter is polite. Nobody makes a fuss.\nNobody mentions the sea going out that far, that once.',
        },
        { cg: null, text: '{small}Coat Pocket:{/small}', style: 'narrate', waitFrames: 200 },
        { cg: null, text: '', style: 'narrate', waitFrames: 150 },
        {
          cg: null, style: 'plain', waitFrames: 320, sfx: 'sfx_can_rattle',
          text: 'Letters keep.\nYou can come and get him.',
        },
      ],
    },
  };
})();
