/*
 * credits.js - the credits roll played at the end of an ending (js/scenes/ending_scene.js).
 *
 * SCHEMA
 * G.DATA.credits = {
 *   title: 'LOW TIDE LETTERS',      lettered big in GochiHand at the top of the roll
 *   speed: 0.55,                    scroll speed in logical pixels per frame
 *   blocks: [                       drawn in order, top to bottom
 *     { head: 'Heading', lines: ['line', 'line'] }   a heading in GochiHand + PatrickHand lines
 *     { gap: 40 }                                     empty space in logical pixels
 *     { big: 'Thanks for playing.' }                  one large centred line
 *   ],
 * }
 *
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};

  G.DATA.credits = {
    title: 'LOW TIDE LETTERS',
    speed: 0.55,
    blocks: [
      { gap: 30 },
      { head: 'Game concept and direction', lines: ['Michal', 'Claude (Anthropic)'] },
      { gap: 26 },
      { head: 'Writing, code and design', lines: ['Claude (Anthropic)', 'with Michal'] },
      { gap: 26 },
      { head: 'Art', lines: ['Generated with the Codex image tool', 'and cut into sprites by scripts'] },
      { gap: 26 },
      { head: 'Music and sound', lines: ['Rendered with the FluidR3 GM soundfont', '(MIT licence)'] },
      { gap: 26 },
      { head: 'Lettering', lines: ['Patrick Hand and Gochi Hand', 'under the SIL Open Font License'] },
      { gap: 26 },
      { head: 'Built with', lines: ['HTML5 canvas, and a lot of pencil'] },
      { gap: 60 },
      { big: 'Thanks for playing.' },
      { gap: 40 },
      { lines: ['Tide goes out. Tide comes in.'] },
    ],
  };
})();
