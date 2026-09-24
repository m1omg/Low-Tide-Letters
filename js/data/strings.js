/*
 * strings.js - generic UI labels, the named text color palette and the UI sound roles.
 * Story text does NOT live here (maps, common events and the other data files hold it).
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};

  G.DATA.strings = {
    /** Fallback for the {name} tag before a party exists. */
    defaultName: '???',

    /** Named colors for {c:name}...{/c}; tuned to stay readable on cream paper and on the dim box. */
    colors: {
      red: '#cf4a3e',
      orange: '#d97a2b',
      yellow: '#c4922a',
      green: '#4c8f4e',
      teal: '#2f8f8a',
      blue: '#3f72b8',
      purple: '#7d55a8',
      pink: '#d8638f',
      brown: '#8a5a3c',
      gray: '#8a8291',
      grey: '#8a8291',
      black: '#2b2433',
      white: '#ffffff',
      cream: '#fbf5e6',
    },

    /** UI sound roles -> sfx ids (missing files are skipped with one warning). */
    sfx: {
      cursor: 'sfx_cursor',
      confirm: 'sfx_confirm',
      cancel: 'sfx_cancel',
      buzzer: 'sfx_error',
      blip: 'sfx_blip_mid',
      page: 'sfx_page',
      save: 'sfx_save',
      item: 'sfx_item_get',
      menuOpen: 'sfx_menu_open',
      menuClose: 'sfx_menu_close',
    },

    common: {
      yes: 'Yes',
      no: 'No',
      ok: 'OK',
      back: 'Back',
      cancel: 'Cancel',
      on: 'On',
      off: 'Off',
      empty: '(empty)',
      level: 'LV',
      money: 'coins',
      loading: 'Sharpening pencils…',
      pressAnyKey: 'Press any key',
    },

    title: {
      newGame: 'New Game',
      continue: 'Continue',
      options: 'Options',
    },

    menu: {
      items: 'Items',
      skills: 'Skills',
      equip: 'Equip',
      status: 'Status',
      party: 'Party',
      save: 'Save',
      load: 'Load',
      options: 'Options',
      toTitle: 'To Title',
      close: 'Close',
    },

    options: {
      bgmVol: 'Music',
      sfxVol: 'Sounds',
      textSpeed: 'Text speed',
      textSpeeds: ['Slow', 'Normal', 'Fast', 'Instant'],
      paper: 'Paper grain',
    },

    save: {
      slot: 'Page',
      emptySlot: 'A blank page',
      saved: 'Saved.',
      overwrite: 'Write over this page?',
      loadConfirm: 'Open this page?',
      failed: 'The page would not take the ink. (Saving failed.)',
    },

    debug: {
      consolePrompt: 'debug: tp <map> <x> <y> [dir] | flag <k> [0|1] | var <k> <n> | give <item> [n] | battle <troop> | lvl <n> | heal',
      healed: 'Party healed.',
    },

    /** Text of the built-in engine self-test scene (index.html?selftest=1). */
    selftest: {
      title: 'Sketchbook engine self-test',
      hint: 'Arrows: move   {key:confirm}: pick   {key:cancel}: back   {key:run}: run',
      menuTitle: 'Try things',
      items: ['Talk', 'Ask a question', 'Toast', 'Hurt / heal', 'Shake', 'Flash', 'Fade out + in', 'Tint', 'Narrate + think', 'Save + load', 'Sound check'],
      speakerName: 'Doodle',
      rich: 'Plain ink, {c:red}red{/c}, {c:blue}blue{/c}, {c:green}green{/c} and {c:purple}purple{/c} pencils.\n' +
        '{shake}Shaky nerves{/shake}, {wave}wavy daydreams{/wave}, {big}BIG{/big} feelings and {small}tiny whispers{/small}.\n' +
        'Hello {name}, you have pressed buttons {v:selftest_presses} times. Long lines wrap around all by themselves, like this one does.',
      talk1: 'Oh! {w:20}A visitor. {w:12}Hi, {name}.\nI am a {c:red}placeholder{/c} who lives in the {wave}margins{/wave} of this sketchbook.',
      talk2: 'Watch this. {speed:6}S l o w . . .{speed:1} and then very quick again! {speed:2}{shake}Brrr.{/shake} {big}Ta-da!{/big}\n{small}(hold X to fast-forward me){/small}',
      talk3: 'This message is long on purpose so that it spills past four lines and has to continue on another page. One line. Two lines. Three lines. Four lines of careful handwriting, and then some more words that simply will not fit, so the pencil waits for you, and after you press the button the rest of the thought shows up here on a fresh page.',
      ask: 'Do you like the wobbly boxes?',
      askOptions: ['Yes, a lot', '{c:blue}They make me seasick{/c}', 'What boxes?'],
      askReplies: ['Hooray! I drew them myself.', 'Sorry. They only wobble a little.', '...The ones around these words.'],
      narrate: 'Somewhere, a page turns.',
      think: '(...Was the drawing always looking at me?)',
      toast: 'Got a {c:orange}Shiny Button{/c}!',
      toastMap: 'Margin of the Page',
      saved: 'Saved and loaded slot 3: {c:green}state matches{/c}.',
      saveFailed: 'Save/load round trip {c:red}FAILED{/c}.',
      noAudio: 'No audio files in the manifest yet.',
      audio: 'Playing the first sound and track from the manifest.',
      inputTitle: 'Input',
      gaugeHp: 'HEART',
      gaugeMp: 'INK',
    },
  };
})();
