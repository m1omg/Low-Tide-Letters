/*
 * confessions.js - the line that appears over the receiver every time somebody Confides down the Can
 * Line (DESIGN_BIBLE 6.4: "about eight per ordered pair, mostly tiny").
 *
 * G.DATA.confessions[from][to] = [ 'line', ... ]   (from and to are actor ids: wren, odo, lin, pim)
 *
 * The battle picks one at random and the rock pool's Skim uses them too, so every line here has to be
 * safe at any point in the game: no spoilers of the hidden truth, nothing that assumes a scene has or
 * has not happened, nothing heavy enough to land badly in the middle of a fight. The story-critical
 * confessions (bible 5.3 and 5.6) are scripted in the map files and are not in this table.
 *
 * Voices: Odo ends on "Over.", Lin counts things, Pim is postal and nosy, and Wren says the least of
 * anybody - her lists are the shortest and her lines are the smallest, because that is the character.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};

  G.DATA.confessions = {

    /* ---------------------------------------------------------------- Wren: six words, tops */
    wren: {
      odo: [
        'I hear you. Every time.',
        'Your whistle is too loud. Don\'t change it.',
        'You\'re braver than the vest.',
        'I like it when you shout. It\'s quieter in my head.',
        'You\'re not annoying. Mostly.',
        'I\'d have come down here on my own. I\'m glad I didn\'t.',
      ],
      lin: [
        'Your lists work. I started one.',
        'You\'re allowed to be bad at something.',
        'You look tired. That\'s all. That\'s the whole thing.',
        'I\'d come, if you asked.',
        'Nobody\'s a tide table.',
        'Thanks for the tissue. I didn\'t need it.',
      ],
      pim: [
        'You\'re lighter than you were.',
        'I don\'t mind the questions.',
        'Stop reading over my shoulder. ...Carry on.',
        'I like your stamp.',
        'You\'re not heavy.',
        'You\'re a good letter.',
      ],
    },

    /* ---------------------------------------------------------------- Odo: radio procedure */
    odo: {
      wren: [
        'I gave myself the swimming medal. Over.',
        'I practise saying Over in the mirror. Over.',
        'I\'m not actually allowed to touch the fryer. Over.',
        'Dad laughs louder when it\'s bad news. I do it too. Over.',
        'I picked the orange laces because they don\'t match. On purpose. Over.',
        'You walk faster when you\'re cross. I\'ve charted it. Over.',
        'I say Over so nobody has to answer. Over.',
        'Scared of the dark. Specifically the dark with a THINK in it. Over.',
      ],
      lin: [
        'You\'re the captain really. Don\'t tell the crew. Over.',
        'I copied your homework once. Too neat. Got caught. Over.',
        'If you\'re ever cold, say. I\'ve got a vest and no shame. Over.',
        'Your plait is a rope. That is a compliment. Over.',
        'I don\'t know what a prefect does. Never asked. Over.',
        'I let you win at cards. ...I did not. Over.',
        'You\'re allowed to do a rubbish job of something. I do it daily. Over.',
        'When you say "noted" I feel five feet tall. Over.',
      ],
      pim: [
        'You\'re the best mail I\'ve ever had. Over.',
        'Can\'t read your handwriting. You haven\'t got any. Over.',
        'I\'d post you myself. First class. Over.',
        'You\'re light. I could throw you. I WON\'T. Over.',
        'Told my dad about you. He said have a pickled egg. Over.',
        'Do letters sleep? Asking for me. I can\'t. Over.',
        'You ask the questions I\'m scared of. Keep going. Over.',
        'If you ever get sent, I\'m coming to the postbox. Over.',
      ],
    },

    /* ---------------------------------------------------------------- Lin: itemised */
    lin: {
      wren: [
        'I do not actually like tea. It is the pouring.',
        'I rewrite my lists in pen so they look decided.',
        'I make Robin\'s packed lunch at ten at night so I can sit down at seven.',
        'You are not difficult. You are quiet. There is a difference; I have a diagram.',
        'I carry a spare of everything except patience.',
        'I am thirteen. I mention it to myself sometimes.',
        'Three things. One: you are fine. Two: you are fine. Three: I have run out.',
        'I was glad you came. Item two was saying so, and I skipped it.',
      ],
      odo: [
        'Your shouting is structurally load-bearing. Do not stop.',
        'I laugh one second late on purpose so you do the joke again.',
        'I wrote OVER on a homework sheet once. It got a circle round it.',
        'You are kinder than you are loud, and you are extremely loud.',
        'I do not know how to be looked after. You are no help, which helps.',
        'I put you down as "reliable" on a form. I nearly wrote "friend".',
        'Your medals are cardboard. I have kept mine.',
        'Stop giving me your vest. ...Keep giving me your vest.',
      ],
      pim: [
        'You are an appalling filing system and an excellent friend.',
        'I have read the same page four times. Do not tell anybody.',
        '"And anyway" is poor style. It is also very human.',
        'I should like to be read aloud once. Not now. Once.',
        'You are the only one who asks a second question.',
        'I check my work eleven times. You would enjoy the eleventh.',
        'Letters are lists with feelings in. I am coming round to them.',
        'If you are ever heavy, I will take the top half.',
      ],
    },

    /* ---------------------------------------------------------------- Pim: postal facts */
    pim: {
      wren: [
        'I read your shopping list. You\'re out of jam.',
        'I appear to contain the phrase "and anyway". Eleven times.',
        'I like being carried. I shan\'t say it twice.',
        'Your pocket has sand in it. It\'s very homely.',
        'I was folded by somebody who was taught properly. It shows.',
        'I don\'t know what\'s inside me. I\'d like to, and I wouldn\'t.',
        'You listen with your whole face. It\'s slightly alarming.',
        'First Class, actually.',
      ],
      odo: [
        'Your can is cleaner than hers. I notice. I notice everything.',
        'You say "Over" like a full stop. I do love a full stop.',
        'I have never been frightened, because I have never been outdoors at night. Ask me later.',
        'When you shout, the water wobbles and so do I. Delightfully.',
        'You gave me a medal. It is cardboard. I wear it internally.',
        'You are the loudest kind thing I have met.',
        'I have opinions about your handwriting. They are warm opinions.',
        'If I\'m ever sent, will you wave? ...You will. Never mind.',
      ],
      lin: [
        'I tried to make a list. It came out as a letter.',
        'You have six tissues. I counted. I count.',
        'Your pencil is behind your ear. It has been all day.',
        'You write "item one" when you mean "please".',
        'I should like to be filed by you. Alphabetically. Under P.',
        'You said "noted" and I felt real.',
        'You\'re allowed one day where nothing is checked. I\'ll keep watch.',
        'Three things: you, are, tired.',
      ],
    },
  };
})();
