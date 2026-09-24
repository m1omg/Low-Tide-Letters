/*
 * common_events_finale.js - the Tide 5 scenes, the ending router and the three endings
 * (DESIGN_BIBLE 5.7, 5.8; CONTENT_CONTRACT 3 and 5). Owned by the finale writer.
 *
 * Registered with Object.assign so that shore_a's js/data/common_events.js (the chapter flow) and this
 * file can both contribute to G.DATA.commonEvents. Nothing here ever touches another writer's file.
 *
 * WHAT LIVES HERE
 *   ce_pearl_bed_arrival   the first look at the coated seabed
 *   ce_pearl_doors_open    the Pearl Doors puzzle pays off (bible 8.5)
 *   ce_nacre_offer         the offer, the slips, and the choice that leads to Ending C
 *   ce_nacre_fight         boss_nacre with both outcomes (bible 6.12)
 *   ce_other_can           the final encounter, its success and its gentle retry (bible 5.7, 6.12)
 *   ce_pim_question        "Send him." / "Not yet." -> final_choice, tide = 6, the router
 *   ce_ending_router       bible 5.8's three conditions, in that exact order
 *   ce_ending_sent / ce_ending_not_yet / ce_ending_pearl   the staged endings
 *   ce_pearl_wake / ce_pearl_resume / ce_not_yet_keep / ce_can_retry_pool   their after-scenes
 *
 * THE ONE EXCEPTION TO THE CLOCK RULE: `tide` is set to 6 in ce_pim_question. Every other zone owner
 * calls ce_tide_done; after Tide 5 there is no Shore segment to go back to, so the finale moves the
 * clock itself, once, and then hands over to the ending router.
 *
 * SCENES AFTER A TRANSFER are reached through a flag plus the destination map's onEnter (pb_can_retry,
 * pb_came_back, pb_keep_this in pearl_bed), so that the beat survives even if the running event list
 * does not outlive the transfer.
 */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const G = root.G = root.G || {};
  G.DATA = G.DATA || {};
  G.DATA.commonEvents = G.DATA.commonEvents || {};

  Object.assign(G.DATA.commonEvents, {

    /* ================================================================= arriving ============== */

    ce_pearl_bed_arrival: {
      name: 'Pearl Bed: the first look',
      commands: [
        ['bgm', 'bgm_undertow'],
        ['ambience', 'amb_void'],
        ['wait', 20],
        ['camera', [16, 9], 80],
        ['wait', 30],
        ['think', 'Everything down here has been made beautiful.'],
        ['say', 'pim', 'delighted', 'Ooh.{w:20} Ooh! Look at the—{w:30} ...oh.'],
        ['say', 'lin', 'stern', 'Three things. One: it is lovely. Two: it is completely silent.{w:15} Three: I do not like it.'],
        ['say', 'odo', 'quiet', '...Over.'],
        ['think', 'Odo whispered.{w:25} Odo has never whispered.'],
        ['camera', 'player', 50],
        ['sfx', 'sfx_page'],
        ['say', 'nacre', null, 'MIND THE FLOOR. IT HAS ONLY JUST BEEN DONE.'],
        ['say', 'odo', 'scared', 'It does NOTES.{w:20} From the FLOOR.{w:20} Over.'],
      ],
    },

    /* ================================================================= the Pearl Doors ======= */

    ce_pearl_doors_open: {
      name: 'Pearl Bed: the doors open',
      commands: [
        ['sfx', 'sfx_reverse_swell'],
        ['shake', 3, 26],
        ['setFlag', 'pearl_doors_open', true],
        ['erase', 'pearl_gate'],
        ['narrate', 'The pearl over the gap softens, curls back like a cuff,\nand is simply not there any more.'],
        ['say', 'pim', 'delighted', 'It told us the way in itself.{w:20} Very polite of it.{w:25} Rather sad, actually.'],
        ['say', 'odo', 'scared', 'Right. In we go.{w:20} I do not want to.{w:20} Going in. Over.'],
        ['say', 'lin', 'stern', 'Hold the rail.'],
        ['think', 'There is no rail.{w:20} I hold the concept of one.'],
      ],
    },

    /* ================================================================= Nacre's offer ========= */

    ce_nacre_offer: {
      name: 'Pearl Bed: Nacre offers',
      commands: [
        ['bgm', 'bgm_nacre', { fadeMs: 1400 }],
        ['camera', [16, 8], 70],
        ['wait', 40],
        ['sfx', 'sfx_page'],
        ['say', 'nacre', null, 'WELCOME, DEARS.'],
        ['wait', 20],
        ['sfx', 'sfx_page'],
        ['say', 'nacre', null, 'YOU ARE CARRYING SOMETHING SHARP.'],
        ['say', 'pim', 'puzzled', 'Is that me?{w:25} I think that is me.'],
        ['wait', 20],
        ['sfx', 'sfx_page'],
        ['say', 'nacre', null, 'LET ME KEEP IT FOR YOU. IT WILL NEVER HURT. IT WILL NEVER ANYTHING.'],
        ['setFlag', 'nacre_offer_seen', true],
        ['camera', 'player', 40],
        ['choice', ['Keep walking.', 'Let Nacre keep it.'], [
          [
            ['think', 'No.'],
            ['say', 'odo', 'boast', 'Copy that. Walking. Over.'],
            ['say', 'pim', 'brave', 'I should like to stay sharp, please.{w:20} Sorry. Thank you. Sorry.'],
            ['sfx', 'sfx_page'],
            ['say', 'nacre', null, 'OF COURSE. I SHALL BE HERE.'],
          ],
          [
            ['say', 'pim', 'brave', 'It\'s all right. I\'d be very shiny.'],
            ['wait', 25],
            ['say', 'lin', 'tired', '...Wren.'],
            ['choice', ['Actually — keep walking.', 'Let Nacre keep it.'], [
              [
                ['say', 'pim', 'delighted', 'Oh good.{w:20} I mean — whichever.{w:20} Oh good.'],
                ['say', 'odo', 'grin', 'Walking. Over.'],
              ],
              [
                ['setFlag', 'gave_letter', true],
                ['call', 'ce_ending_pearl'],
              ],
            ], { cancel: 0 }],
          ],
        ], { cancel: 0 }],
      ],
    },

    /* ================================================================= the boss ============== */

    ce_nacre_fight: {
      name: 'Pearl Bed: boss_nacre',
      commands: [
        ['sfx', 'sfx_page'],
        ['say', 'nacre', null, 'PLEASE DO NOT TROUBLE YOURSELF.'],
        ['think', 'I am going to trouble myself.'],
        ['say', 'odo', 'boast', 'Permission to be ENORMOUS, Captain? Over.'],
        ['say', 'lin', 'stern', 'Granted. Mind the shell.{w:20} It is two hundred years old and it is doing its best.'],
        ['battle', 'troop_nacre', {
          canEscape: false,
          bgm: 'bgm_nacre',
          onPeace: [
            ['sfx', 'sfx_reverse_swell'],
            ['narrate', 'The shell opens all the way, slowly,\nthe way a hand opens when somebody asks it to.'],
            ['sfx', 'sfx_page'],
            ['narrate', '{small}(One more slip. This one is handwritten. The letters lean,\nand one of them has been gone over twice.){/small}'],
            ['say', 'nacre', null, 'I did not want you to hurt. I did not know what else to do.'],
            ['wait', 40],
            ['say', 'wren', 'small_smile', 'Thank you for keeping it. I\'ll take it from here.'],
            ['setFlag', 'nacre_delivered', true],
            ['say', 'pim', 'brave', 'Two hundred years of other people\'s post.{w:20} You must be so tired.'],
            ['narrate', 'Behind the shell, standing on its own in the seabed: a door.'],
          ],
          onWin: [
            ['sfx', 'sfx_enemy_down'],
            ['narrate', 'The shell clamps shut. It is a small sound, and a final one.'],
            ['say', 'pim', 'puzzled', 'Goodnight, then.{w:20} Sorry.'],
            ['narrate', 'The white string runs in through the hinge and does not come out.\nThey squeeze after it.'],
            ['setFlag', 'nacre_hushed', true],
            ['say', 'odo', 'quiet', '...It never fought back much. Over.'],
            ['say', 'lin', 'tired', 'No. It did not.'],
            ['narrate', 'Behind the shell, standing on its own in the seabed: a door.'],
          ],
          onLose: 'gameover',
        }],
      ],
    },

    /* ================================================================= the Other Can ========= */

    ce_other_can: {
      name: 'Pearl Bed: the Other Can',
      commands: [
        ['sfx', 'sfx_door_open'],
        ['narrate', 'The door opens on a bedroom at night.'],
        ['bgm', 'bgm_other_can'],
        ['ambience', null],
        ['narrate', 'A window. A curtain half across it. A white string coming in over the sill.\nOn the sill, a tin can.'],
        ['sfx', 'sfx_can_rattle'],
        ['narrate', 'It is rattling.'],
        ['say', 'odo', 'scared', 'Captain.{w:25} That is your can.'],
        ['think', 'No. Mine is here, on my hip.{w:30} That is the other one.'],
        ['battle', 'troop_other_can', {
          canEscape: false,
          bgm: 'bgm_other_can',
          back: 'bb_dark_bedroom',
          onPeace: [['call', 'ce_can_answered']],
          onWin: [['call', 'ce_can_answered']],
          onTimeout: [['call', 'ce_can_retry']],
          onLose: [['call', 'ce_can_retry']],
        }],
      ],
    },

    ce_can_answered: {
      name: 'Pearl Bed: the can is answered',
      commands: [
        ['sfx', 'sfx_can_rattle'],
        ['wait', 25],
        ['narrate', 'The can stops.'],
        ['wait', 50],
        ['setFlag', 'other_can_answered', true],
        ['say', 'odo', 'teary_grin', 'You said Over.{w:30} You have NEVER said Over.'],
        ['say', 'odo', 'teary_grin', 'Logged. Logged for ever. Over.'],
        ['say', 'lin', 'relieved', 'Three things. One:{w:30} ...no. One thing. Good.'],
        ['think', 'My ears are ringing.{w:25} It is quiet in the nice way.'],
        ['call', 'ce_pim_question'],
      ],
    },

    ce_can_retry: {
      name: 'Pearl Bed: the can rings out',
      commands: [
        ['sfx', 'sfx_static'],
        ['say', 'tam', null, '…Okay. Night, Wren. Over and out.'],
        ['wait', 60],
        ['narrate', 'The string goes slack. The can is only a can.'],
        ['say', 'pim', 'brave', 'We can try again. It\'s allowed.'],
        ['healAll'],
        ['setFlag', 'pb_can_retry', true],
        ['transfer', 'pearl_bed', 14, 20, 'up', { fade: 'black' }],
      ],
    },

    ce_can_retry_pool: {
      name: 'Pearl Bed: back at the pool, unhurried',
      commands: [
        ['narrate', 'The rock pool is warm, which is a strange thing for water to be, this deep.'],
        ['say', 'lin', 'stern', 'Item one: breathe.{w:20} Item two: again, when you are ready.'],
        ['say', 'odo', 'grin', 'Standing by. All night if you like. Over.'],
        ['think', 'The door is still there. It is still open.'],
      ],
    },

    /* ================================================================= Pim's question ======== */

    ce_pim_question: {
      name: 'Pearl Bed: Pim asks to be sent',
      commands: [
        ['wait', 30],
        ['say', 'pim', 'brave', 'I know who I\'m for now.'],
        ['wait', 20],
        ['say', 'pim', 'brave', 'Being sent isn\'t the end of a letter. It\'s the point of one.'],
        ['say', 'pim', 'brave', 'Is that all right?'],

        /* "Send him." is live only at true_words >= 6; otherwise it is drawn as a ghost line (bible 5.7). */
        ['if', { var: ['true_words', '>=', 6] }, [
          ['custom', 'ghost_choice', {
            prompt: '(He is very light now.)',
            options: [{ text: 'Send him.', ghost: false }, { text: 'Not yet.', ghost: false }],
            varName: 'pb_pim_pick',
            cancelIndex: 1,
          }],
        ], [
          ['custom', 'ghost_choice', {
            prompt: '(He is still quite heavy.)',
            options: [
              { text: 'Send him. (He\'s still mostly \'and anyway\'.)', ghost: true },
              { text: 'Not yet.', ghost: false },
            ],
            varName: 'pb_pim_pick',
            cancelIndex: 1,
          }],
        ]],

        ['if', { var: ['pb_pim_pick', '==', 0] }, [
          ['setVar', 'final_choice', '=', 1],
          ['say', 'pim', 'delighted', 'Oh!{w:20} Right. Right.{w:20} I shall need an address.'],
          ['say', 'wren', 'small_smile', 'I\'ll find it.'],
        ], [
          ['setVar', 'final_choice', '=', 2],
          ['say', 'pim', 'brave', 'Not yet is a real answer. Letters keep.'],
          ['think', 'Okay.'],
        ]],

        /* The one place in the game where a zone owner moves the clock: no Shore segment follows. */
        ['setVar', 'tide', '=', 6],
        ['call', 'ce_ending_router'],
      ],
    },

    /* ================================================================= the router ============ */

    /**
     * Bible 5.8, evaluated in this exact order: Pearl, then Sent, then Not Yet. No ending reads a
     * Deliver or Hush count, ever.
     */
    ce_ending_router: {
      name: 'Endings: which one',
      commands: [
        ['if', { flag: 'gave_letter' }, [
          ['call', 'ce_ending_pearl'],
        ], [
          ['if', { all: [{ flag: 'other_can_answered' }, { var: ['final_choice', '==', 1] }] }, [
            ['call', 'ce_ending_sent'],
          ], [
            ['call', 'ce_ending_not_yet'],
          ]],
        ]],
      ],
    },

    /* ================================================================= Ending A - Sent ======= */

    ce_ending_sent: {
      name: 'Ending A: Sent',
      commands: [
        ['bgmFade', 1400],
        ['wait', 30],
        ['narrate', 'Somewhere above them, the tide turns.'],
        ['say', 'pim', 'brave', 'Right.{w:20} Take the extra pages out. I shan\'t need them.'],

        /* The player builds the three-line letter from the True Words they earned (bible 8.7). */
        ['custom', 'letter_compose', {}],

        ['say', 'pim', 'delighted', 'Oh, I\'m SHORT.{w:25} I\'m so much better short.'],
        ['say', 'lin', 'fond', 'Three lines.{w:20} Not one "and anyway".'],
        ['say', 'odo', 'grin', 'That is a PROPER letter. Over.'],
        ['think', 'It is smaller than the pocket it lived in.'],
        ['setFlag', 'ending_sent_done', true],
        ['bgmFade', 900],
        ['fade', 'out', 70, 'white'],
        ['wait', 40],
        ['narrate', 'Dawn. The tide comes back in over the steps, one at a time,\nlike somebody counting them.'],
        ['narrate', 'In the ordinary air of the Shore, Pim is an envelope folded like a boat.\nStill. Light. Nothing rattles in him at all.'],
        ['wait', 20],
        /* Monday: Wren alone on the Row with the letter in her pocket. harbour_row's onEnter plays
         * ce_epilogue_arrive (flag + onEnter, so the beat survives the transfer); the postbox ends it. */
        ['removeMember', 'odo'],
        ['removeMember', 'lin'],
        ['removeMember', 'pim'],
        ['setFlag', 'epilogue_walk', true],
        ['transfer', 'harbour_row', 10, 11, 'down', { fade: 'white' }],
      ],
    },

    ce_epilogue_arrive: {
      name: 'Ending A: Monday on the Row',
      commands: [
        ['setFlag', 'epilogue_arrived', true],
        ['wait', 30],
        ['narrate', 'Monday.'],
        ['think', 'Mum had the address the whole time.{w:20}\nIt was on the back of every postcard, in small careful writing.'],
        ['think', 'Three lines, and an address.{w:20} The postbox is at the end of the row.'],
        ['think', 'The town is talking again. {w:15}I could listen to some of it first.'],
      ],
    },

    ce_epilogue_post: {
      name: 'Ending A: the postbox',
      commands: [
        ['think', 'Collections: 9:15.{w:25} It is 9:11.'],
        ['wait', 20],
        ['choice', ['Post it.', 'Walk round the row first.'], [
          [
            ['setFlag', 'epilogue_posted', true],
            ['bgmFade', 900],
            ['fade', 'out', 60, 'black'],
            ['ending', 'ending_sent'],
          ],
          [
            ['think', 'Four minutes. {w:15}I know exactly how long four minutes is.'],
          ],
        ], { cancel: 1 }],
      ],
    },

    /* ================================================================= Ending B - Not Yet === */

    ce_ending_not_yet: {
      name: 'Ending B: Not Yet',
      commands: [
        ['bgmFade', 1400],
        ['wait', 20],
        ['narrate', 'Pim hops twice on the spot, which is how a letter shrugs.'],
        ['say', 'pim', 'brave', 'I shall keep.{w:20} It is what I am best at, after being read.'],
        ['say', 'odo', 'grin', 'Standing by. Over.'],
        ['say', 'lin', 'fond', 'Noted.{w:20} In pencil.'],
        ['setFlag', 'ending_not_yet_done', true],
        ['setFlag', 'pb_keep_this', true],
        ['transfer', 'pearl_bed', 14, 20, 'up', { fade: 'black' }],
      ],
    },

    /**
     * Reached from pearl_bed's onEnter after Ending B's transfer. The save point is the rock pool, so
     * a cleared save loads exactly here, with every zone still open: Kept things can still be
     * Delivered and the choice can be made again (bible 5.8, pillar 6).
     */
    ce_not_yet_keep: {
      name: 'Ending B: somewhere to keep it',
      commands: [
        ['narrate', 'The rock pool is still warm.'],
        ['say', 'lin', 'stern', 'Three things. One: we stop here.{w:15} Two: write it down.{w:15} Three: come back whenever you like.'],
        ['custom', 'rock_pool', { id: 'pool_pearl_bed', joke: 'Somewhere to keep this, if you would like to keep it.' }],
        ['ending', 'ending_not_yet'],
      ],
    },

    /* ================================================================= Ending C - Pearl ===== */

    ce_ending_pearl: {
      name: 'Ending C: Pearl',
      commands: [
        ['bgm', 'bgm_nacre'],
        ['sfx', 'sfx_page'],
        ['say', 'nacre', null, 'THANK YOU. IT WILL BE QUITE SAFE.'],
        ['narrate', 'Nacre closes round Pim the way a hand closes round a moth:\ncarefully, and completely.'],
        ['wait', 40],
        ['say', 'pim', 'neutral', 'Oh.{w:25} It\'s quiet. I can\'t feel my \'and anyway\'s.'],
        ['say', 'pim', 'brave', 'Goodnight, I think. You can come and get me. Letters keep.'],
        ['wait', 40],
        ['removeMember', 'pim'],
        ['narrate', 'The shell closes. The seabed is calm, and lovely,\nand nothing whatever is happening.'],
        ['setFlag', 'ending_pearl_done', true],
        ['fade', 'out', 70, 'white'],
        ['wait', 30],
        ['removeMember', 'odo'],          // she wakes alone: Odo is on the other end of the can
        ['removeMember', 'lin'],
        ['transfer', 'wren_house', 20, 8, 'down', { fade: 'white' }],
        ['call', 'ce_pearl_wake'],
      ],
    },

    /**
     * The waking scene of bible 5.8, on the wren_house wake-up tile (CONTENT_CONTRACT 5, used here as a
     * backdrop only: no wren_house event is touched). A friend on the line is always a way back.
     */
    ce_pearl_wake: {
      name: 'Ending C: waking up light',
      commands: [
        ['bgm', 'bgm_town_hush'],
        ['narrate', 'Sunday night, and then Monday, and nothing at all in between.'],
        ['think', 'I slept the whole way through.{w:25} I never do that.'],
        ['think', 'There is nothing in my coat pocket.{w:20} I checked twice.{w:20} It is lovely.'],
        ['narrate', 'Downstairs, the kettle. Outside, the town, being polite.'],
        ['think', 'Everybody is being very nice.{w:25} Nobody is saying anything.'],
        ['wait', 40],
        ['sfx', 'sfx_can_rattle'],
        ['narrate', 'The can on the east window rattles.'],
        ['say', 'odo', 'neutral', 'Wren? You awake? Over.'],
        ['custom', 'keep_or_say', {
          prompt: 'The can is still going.',
          say: '...Odo? I think I left something down there. Over.',
          keep: '(Let it ring.)',
          varName: 'pb_came_back_pick',
        }],
        ['if', { var: ['pb_came_back_pick', '==', 0] }, [
          ['setFlag', 'came_back', true],
          ['say', 'odo', 'grin', 'COPY THAT.{w:15} Copy that copy that copy that.{w:20} Meet you at the steps. Over.'],
          ['setFlag', 'gave_letter', false],
          ['setFlag', 'nacre_offer_seen', false],
          ['addMember', 'odo'],
          ['addMember', 'lin'],
          ['addMember', 'pim'],
          ['setFlag', 'pb_came_back', true],
          ['transfer', 'pearl_bed', 14, 20, 'up', { fade: 'black' }],
        ], [
          ['narrate', 'The can rings for a while.{w:30} Then it does not.'],
          ['think', '...'],
          ['wait', 40],
          ['ending', 'ending_pearl'],
        ]],
      ],
    },

    /**
     * Reached from pearl_bed's onEnter after "came back". Pim is un-pearled and the offer is waiting
     * again, exactly where it was.
     */
    ce_pearl_resume: {
      name: 'Ending C: came back',
      commands: [
        ['bgm', 'bgm_undertow'],
        ['healAll'],
        ['sfx', 'sfx_glass_tumble'],
        ['narrate', 'There is a crack in the floor of the chamber, the shape of a paper boat.'],
        ['say', 'pim', 'delighted', 'Told you.{w:25} Letters keep.'],
        ['think', 'You were in there about nine hours.'],
        ['say', 'pim', 'nosy', 'Was it nine? It felt like one very long full stop.'],
        ['say', 'odo', 'boast', 'Right. Second attempt. Over.'],
        ['say', 'lin', 'fond', 'Item one: this time we all go in together.'],
      ],
    },
  });
})();
