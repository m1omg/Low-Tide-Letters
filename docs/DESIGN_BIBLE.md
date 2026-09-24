# LOW TIDE LETTERS — Design Bible

Single creative source of truth. Technical contracts (file formats, engine API, asset naming) live in `docs/TECH_SPEC.md`; ids here follow its prefixes (`char_`, `face_`, `en_`, `ter_`, `obj_`, `bb_`, `cg_`, `icon_`, `ui_`, `bgm_`, `sfx_`). All ids are stable snake_case. If something is not written here, choose the smallest option that fits the pillars.

---

## 1. Title, logline, pillars, content note

**Title:** LOW TIDE LETTERS

**Logline:** On the weekend of the lowest tide of the year, twelve-year-old Wren follows a tin-can telephone string down a staircase the sea should never have uncovered, into the Lull: a bright crayon seabed where every word the town failed to say washes up alive. With two real friends and a walking paper-boat letter who does not know who he is addressed to, she fights — or better, delivers — the town's unsent words, using a battle system where feelings are sea-glass in your pockets: kept alone they are sharp and heavy and eventually spill; handed to a friend they come back smooth and twice as strong.

**Design pillars**

1. **Say it or keep it.** Every system asks the same question. Keeping is always the easy, default option. Saying costs something now and pays later. The game never scolds; it only counts.
2. **Nobody smooths their own glass.** The strongest resource in combat (Tumbled glass) can only be made by confiding in a friend. Blocked pocket slots (Pebbles) cannot be cleared by their owner.
3. **The friends are real.** Nobody in the party is a figment, a dream or a memory. The Lull is a shared place all of them remember afterwards. The hurt person is alive, off-screen, and owes Wren nothing.
4. **Small true wound.** No death, no illness, no violence. One ordinary childhood cruelty, and the long hiding afterwards.
5. **Funny first.** Radio-procedure boasting, a letter who reads everyone's mail aloud, striking seagulls. The jokes thin out near the truth and come back quieter.
6. **Late still counts.** Anything the player Kept can still be said later, at a higher price. No ending closes the door.

**Content note (shown from the title menu, "About this game"):** "Low Tide Letters is a gentle game about friendship, guilt and saying sorry. It contains cartoon battles with no blood, some eerie quiet places, and scenes about a friend moving away and a child being unkind to someone she loves. Nobody dies. It is okay to stop and come back. Play time is about 75 minutes."

---

## 2. Theme, emotional arc, hidden truth

### 2.1 Theme

What we do not say does not vanish; it waits. A feeling kept alone stays sharp. The same feeling told to a friend comes back smooth. A real apology is one you send without knowing whether it will be answered — and being too late to be forgiven is not the same as being too late to say it.

### 2.2 Emotional arc

| Stage | Where | Player feels |
|---|---|---|
| Warmth | Prologue memory on the rocks | Safe, amused; learns the four colours from Pop |
| Small ache | Tide 1 shore | Wren shrugs at everything; a string runs from her window to an empty house and nobody mentions it |
| Delight | Tides 1–2 in the Lull | The Lull is funny and colourful; confiding is literally the best move |
| Recognition | Tides 2–3 | Odo and Lin each say a small true thing; it costs them and helps them |
| The slip | Tide 4 shore | Odo asks Wren to write when he moves. The only selectable answer is "Fine. Go then." |
| Dread and tenderness | Tide 4, the Undertow Light | The same three words, a year earlier. The friends learn what she did. Nobody leaves |
| Temptation | Tide 5, the Pearl Bed | Nacre offers to coat the letter in pearl: "It will never hurt. It will never anything." |
| Release | Epilogue | Wren sends it, or is allowed not to yet. The tide comes in |

Arc in one line: from *"if I never say it, it never happened"* to *"saying it late still counts, even if nobody answers."*

### 2.3 THE HIDDEN TRUTH (full spoilers)

**Who.** Wren Ashby's best friend from age four was **Tamsin "Tam" Quill**, who lived directly across the lane on Harbour Row. Wren's grandfather, Pop Ansel (alive, well, retired lighthouse keeper and radio repairman), taught both girls to hunt sea-glass and built them a tin-can telephone between their bedroom windows. Their den was the old lamp-oil store at the foot of the lighthouse.

**What Wren did.** A year ago the Quills' fishing boat, the *Marigold*, was sold and the family had to move inland. Tam told Wren on the rocks. Wren, eleven, felt the floor go and said the first thing that would make it hurt less: **"Fine. Go then. I was getting bored of you anyway."** She avoided Tam for the two weeks that followed. On Tam's last night, Tam called down the can line for an hour: *"Wren? Are you awake? Over."* Wren lay with a pillow over her head and heard every word. The last thing on the line was: *"...Okay. Night, Wren. Over and out."* In the morning Wren watched the removal van from behind her curtain. On the doorstep Tam had left a jam jar of their best glass with a note: "Keep the good ones. — T". Wren pushed the jar under her bed and has not touched it.

**What came after.** Tam has sent three postcards in a year. They are funny and kind. The third says: "You don't have to write back. I just like telling you things." Wren has read each one once and hidden them in a biscuit tin. In October, at two in the morning, she wrote Tam a four-page letter — mostly crossings-out and reasons why it wasn't really her fault — sealed it, stuck on a pale blue lighthouse stamp, and never wrote the address, because an address makes it real. She folded the envelope into a paper boat the way Pop taught her and put it in her coat pocket. She has not looked in that pocket since. **That letter is Pim**, the fourth party member. The menu entry "Coat Pocket" reads: *"Nothing I want to look at."*

**The pattern.** Wren has told nobody. She has decided she is "the kind of friend who says that", and keeps everyone at a shrug's distance so she cannot do it again. In January the Brill family moved in next door and Odo strung an uninvited second can line to her other window. She has never once said "Over" back. This weekend, when Odo admits his family is moving too, the same three words come out of her mouth (Tide 4). The game's present-tense question is not "will Tam forgive her" but "will she do it again".

**The Lull.** Below the lowest tide line lies the Lull, where the unsent words of Pellow's Reach have pooled for generations ("we don't make a fuss" is the town motto). Its keeper is **Nacre**, a house-sized, courteous giant clam who coats painful unsent things in pearl, layer on layer, until they are beautiful, hard, and mean nothing. Nacre is not Wren's inner self and not evil; it is the town's habit of clamming up, and it sincerely believes it is sparing children pain. It has grown huge this year on three big unsaid things carried by three children: Odo's "we're moving", Lin's "I need help", and Wren's letter. As it grows, townsfolk above speak less; by Tide 4 half of them say only "...". The equinox spring tide uncovers the Tide Steps, and the can string from Wren's window — the one to the empty house — now leads down them.

**The final encounter** is not Nacre. It is **The Other Can**: a tin can on the end of a string in a dark bedroom, rattling, asking "Wren? Are you awake? Over." It cannot be hurt and does not attack.

**Pim's letter.** The four-page version is never shown in full; Pim quotes scraps of it by accident ("...and anyway YOU were the one who— oh. That's not a nice bit."). In the best ending the player rebuilds it from True Words earned by saying things all game. It is three lines long and has no room for excuses. Whether Tam answers is never shown.

### 2.4 Timeline

| When | Event |
|---|---|
| 8 years ago | Wren (4) and Tam (4) meet on Shingle Beach. Pop teaches the colour rhyme. |
| 5 years ago | Pop strings the can line across the lane between their windows. |
| 3 years ago | The lamp-oil store becomes the den. A jar labelled "T + W" holds their best glass. |
| Last 3 Sept | *Marigold* sold. Tam tells Wren on the rocks. "Fine. Go then. I was getting bored of you anyway." |
| Last 17 Sept, 9–10 pm | Tam calls on the can for an hour. Wren does not answer. |
| Last 18 Sept, 7 am | Van leaves. Jar and note on the doorstep. House across the lane goes TO LET. |
| October | Wren writes the four-page letter at 2 am. Never addressed. Into the coat pocket (Pim). |
| Nov / Feb / June | Tam's three postcards. Hidden in the biscuit tin. |
| January | The Brills take over the chippy and the house next door. Odo strings his own can line. |
| This week | The chippy's lease is not renewed. A CLOSING DOWN sign lies face-down in its back room. |
| This Fri–Sun | Equinox spring tide. The game (Prologue, Tides 1–5, Epilogue). |
| This winter | Epilogue montage (Ending A/B): the Brills' moving day. |

---

## 3. Characters

Portrait files are `face_<speaker_id>_<expr>`. Every speaker's first expression is `neutral`. Walk sheets are `char_<id>`. Children are drawn with big heads (about 1:2.5 head-to-body on map sprites), dot eyes, rosy crayon cheeks.

### 3.1 Party

#### `wren` — Wren Ashby, 12 (protagonist)
- **Personality:** watchful, dry, stubborn; kind in deeds, not words. Answers questions with shrugs and "What." The player chooses her lines at Say it / Keep it moments; otherwise she says little. Her inner voice (`think` boxes, prop inspections) is deadpan and funny.
- **Arc:** "I am the kind of friend who says that" → "I said that once. I can say something else now."
- **Speech style:** short, flat, lower-case energy; never uses radio procedure until the ending.
  - "What."
  - (inspecting a lobster pot) "A lobster pot. Empty. The lobsters have moved on. Good for them."
- **Battle role:** flexible all-rounder, best at Say; home colour **Blue (Worry)**. Weapon: the tin can swung on its string.
- **Visual:** small and slight, looks 11–12. Sandy-blonde hair in a short, messy, stubby ponytail that sticks straight up at the back, pinned with a **wooden clothes-peg**; one loose strand over the left eye. Round face, dot eyes, freckles across the nose, a beige plaster on her chin. Wears a too-big **sea-green (teal) duffel coat** with three wooden toggles (the middle one missing, replaced by a loop of string), two big square patch pockets, sleeves rolled twice; a cream scarf with one red stripe; dark grey leggings; brown lace-up boots, the left lace orange, the right white. **Signature item:** a dented tin can on a loop of white string worn across the body like a satchel, resting on her right hip. **Silhouette:** boxy coat, stubby up-ponytail with peg, can at the hip. On the Shore she is drawn in soft pencil with the teal muted; in the Lull the coat is saturated crayon teal and the can glows faintly amber inside.
- **Portraits (6):** `neutral`, `shrug` (eyes aside, one shoulder up), `small_smile`, `startled`, `frozen` (wide eyes, no mouth drawn), `crying_smile`.

#### `odo` — Odo Brill, 11
- **Personality:** loud, boastful, generous; narrates his own life in radio procedure and awards himself medals. Secretly afraid of the dark and of being left out.
- **Arc:** he brags because he cannot say the small true thing — the chippy is closing and his family moves inland in winter. He learns that telling friends bad news does not make it more real, only less lonely.
- **Speech style:** radio procedure, capitals for emphasis, ends most lines with "Over."
  - "Commencing snack. Snack is GO. Over."
  - "Permission to be a bit scared, Captain? ...Asking for a friend. Who is me. Over."
- **Battle role:** tank and Red generator; home colour **Red (Temper)**. Weapon: a wire chip-shop fry scoop.
- **Visual:** short, stocky, round-faced; warm brown skin; black hair buzzed short; thick eyebrows; gap between front teeth. **Bright orange foam life vest** with two white buckles over a navy-and-white striped long-sleeve top; khaki shorts in all weather; grey socks; white trainers with orange laces; a scab on each knee. **Signature items:** a wire fry scoop carried like a sword; a red plastic whistle on a lanyard; his own tin can clipped to the vest. **Silhouette:** wide blocky vest, scoop raised.
- **Portraits (6):** `neutral`, `boast` (chin up, fist on chest), `grin`, `scared`, `quiet` (looking down, no grin), `teary_grin`.

#### `lin` — Linnet "Lin" Hale, 13
- **Personality:** class prefect, planner, carrier of spare tissues; corrects grammar mid-battle; speaks in numbered lists. Looks after her five-year-old brother Robin alone most evenings while her mother works the night boats.
- **Arc:** furious and tired under the competence; has never once said "I need help." Learns to be looked after and to do one thing badly on purpose.
- **Speech style:** precise, itemised, faintly exasperated.
  - "Three things. One: that is not a staircase that should exist. Two: I'm coming. Three: hold the rail."
  - "I am fine. I am absolutely fine. Please stop looking at me like I'm a tide table with a mistake in it."
- **Battle role:** healer/support and pocket manager; home colour **Amber (Fondness)** with a hidden well of Red. Weapon: clipboard.
- **Visual:** tall, thin, very straight posture; pale brown skin; very long black plait to the waist tied with a moss-green ribbon; round wire glasses. Navy school cardigan with tan elbow patches over a white collared shirt; pleated charcoal skirt; grey knee socks, the left one always slipped down; black buckle shoes. **Signature item:** a wooden clipboard holding a tide table, pencil behind the right ear. **Silhouette:** tall narrow column, long plait, clipboard held to chest.
- **Portraits (6):** `neutral`, `stern` (eyebrow up, pencil pointing), `fond`, `tired` (glasses slipping, shadows under eyes), `angry` (flushed, plait bristling), `relieved` (eyes closed, shoulders dropped).

#### `pim` — Pim, an unsent letter
- **Personality:** nosy, literal, cheerful; reads everyone else's mail aloud; terrible at secrets; proud of his stamp and believes stamps are a rank ("First Class, actually"). Determined to find out who he is for.
- **Arc:** he is Wren's unsent letter to Tam. He is "awfully heavy for my size" at first (four pages). He keeps blurting scraps of himself that embarrass Wren. He works it out in Tide 4. In the finale he is not destroyed: he asks to be **sent**. "Being sent isn't the end of a letter. It's the point of one."
- **Speech style:** bright, formal-ish, lots of questions; describes feelings as postal facts.
  - "Hello! I'm Pim. I'm for somebody. Is it you? ...No. Is it YOU?"
  - "I appear to contain the phrase 'and anyway'. Eleven times. Is that normal?"
- **Battle role:** fast, fragile scout and Green generator; home colour **Green (Wonder)**. Listens better than anyone.
- **Visual:** knee-high. A thick cream envelope folded into a lopsided **paper-boat body**; two stubby black ink-line legs with no feet; no arms (gestures by flapping his top flap); two dot eyes, tiny curved ink mouth, round wax-red cheeks; a torn top corner that sticks up like a cowlick; a faint blue ruled line across his back where an address should be. **Signature item:** one pale-blue postage stamp showing a lighthouse, stuck crookedly on his forehead like a cap badge. **Silhouette:** paper boat on two stick legs. He visibly gets thinner across the game (battle pose only: Tide 1–3 plump, Tide 4+ slim; implemented as a 0.85 horizontal scale, no new art).
- **Portraits (6):** `neutral`, `delighted` (flap up), `nosy` (leaning, one eye big), `puzzled`, `blurt` (flap clapped over mouth), `brave` (small, steady smile).

### 3.2 Key NPCs

| id | Who | Personality / function | Speech sample | Visual | Portraits |
|---|---|---|---|---|---|
| `pop` | Pop Ansel Ashby, 74. Wren's grandfather. Alive and well. Workshop on Harbour Row full of radios. | Warm, unhurried, never pushes. Teaches the colour rhyme in the prologue; whistles the leitmotif. By Tide 4 he only whistles. | "Red for cross, blue for fretting, amber for fond, green for well-I-never. Don't keep them all in one pocket, love. You'll rattle." / "No rush, pet. Tide goes out, tide comes in." | Tall, stooped, big hands; white moustache; navy fisherman's cap; oatmeal cable-knit jumper with a darned elbow; brown cord trousers held by red braces; slippers outdoors. Screwdriver behind ear. | `neutral`, `twinkle`, `concerned`, `whistling` |
| `mum` | Hazel Ashby, 41. District nurse, always half into her coat. | Kind, busy, notices more than she says. Offers the June postcard (Say/Keep 6). | "Postcard's still on the side, love. It's been there since June. It's not going to bite." | Sandy hair in a clip; lilac nurse's tunic under a grey raincoat; lanyard; travel mug. | `neutral`, `soft`, `worried` |
| `mr_brill` | Dev Brill, 45. Odo's dad, runs Brill's Chippy. Shopkeeper on the Shore. | Booming, cheerful, offers pickled eggs to everyone. Quieter each tide. | "Pickled egg? On the house. No? ...Pickled egg?" | Broad, warm brown skin, bald, big black moustache; white apron over a red polo shirt; paper hat. | `neutral`, `booming`, `flat` |
| `robin` | Robin Hale, 5. Lin's brother. | Blunt five-year-old. Asks Say/Keep 8. | "Are you Lin's friend? She said she hasn't got time for friends." | Tiny; bowl-cut black hair; yellow T-shirt with a crab on it; one shoe. | none (name tag only) |
| `tam` | Tamsin Quill, 12. Never seen from the front, never met. | A voice through a tin can in Tide 4 and the finale; handwriting on postcards. Name tag shows `???` until `truth_known`. | "Wren? Are you awake? Over." / "You don't have to write back. I just like telling you things." | Only in CG: from behind or boots only. Dark red curly hair in two puffs; yellow wellies with painted-on daisies; denim pinafore. | none |
| `nacre` | Nacre, Keeper of the Lull. | House-sized, courteous giant clam. Never speaks aloud: little printed paper **slips** slide out between its shell-lips (UI: a slip graphic, font GochiHand, no portrait). Sincere, soothing, wrong. | (slip) "PLEASE DO NOT TROUBLE YOURSELF." / (slip) "LET ME KEEP IT FOR YOU. IT WILL NEVER HURT. IT WILL NEVER ANYTHING." | See `boss_nacre`. | none |
| `postmaster_gull` | Postmaster Gull. Union gull, mini-boss, later hub NPC. | Rules-obsessed, permanently about to go on strike. | "No return address, no service. It's in the handbook. I wrote the handbook." | See `boss_postmaster_gull`. | none |
| `stan` | Second-Class Stan, snail postman. | Forty years into one delivery. Appears one screen further along each tide. | "Nearly there." | Snail with a tiny postbag and peaked cap. | none |
| `shelley` | Shelley, hermit-crab shopkeeper living in a red postbox; sells through the slot. Lull shop. | Dry saleswoman. | "We're open. Mind the claw." | Two eyestalks and a claw poking from a postbox slot. | none |
| `towns_a`, `towns_b` | Generic townsfolk (fisherman in yellow oilskin bib; old lady with a tartan shopping trolley). Reused with different lines. | Carry the "town going quiet" effect: their lines become "..." by schedule (section 5.9). | "Lowest tide in forty years, they reckon." | As described. | none |

---

## 4. World structure and location table

### 4.1 Structure

Two layers and one clock. **The Shore** (Pellow's Reach: 4 maps, no combat) is drawn in soft graphite with muted colour. **The Lull** (7 maps) is saturated crayon on cream paper. The clock is Lin's tide table: there are five low tides between Friday evening and Sunday night, each lower than the last. The variable `tide` (0 = prologue, 1–5, 6 = epilogue) drives everything: which Lull zone is uncovered, which Shore lines are spoken, how quiet the town is (5.9).

Each chapter is one **Shore segment** (3–4 minutes: two Say it / Keep it moments, a shop visit, a joke) followed by one **Tide** (8–11 minutes in one Lull zone: roaming Unsent, one puzzle, a climax). The hub `tide_steps` links everything; zones already visited stay open through mail-slot doors so that Kept things can be said late (pillar 6).

Unity rule for the Lull (fixes the "several metaphors competing" risk): everything down there is **seabed + post**. No funfair, no office, no rope knots. A reef of coral horns, a flat of tide-table paper at slack water, a lighthouse that was built downward, a pearl bed. The tin-can string is the only thread between the layers, and it is also the battle system's confiding channel (the Can Line, 6.4).

### 4.2 Location table

Terrain ids are listed without the `ter_` prefix, prop ids without `obj_`. Sizes are in tiles.

| # | id | Name | Size | Mood | Terrains | Props | Connections | What happens | bgm | ambience |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `harbour_row` | Harbour Row | 40x20 | Grey, fond, a little too quiet | cobbles, grass_verge, wall_plaster (garden walls) | house_terrace (x5), house_tolet, chippy_front, postbox, lobster_pots, bench, window_can; T3: streetlamp, crates, washing_line_town, radio_bench | Door (8,9) → `wren_house`; door (30,9) → `brills_chippy`; east edge → `shingle_beach` west edge | Shore segments: Pop on his bench outside the workshop, Mum at the door, townsfolk, Lin and Robin, two can strings crossing the lane overhead (one slack, one taut). Ending A: the postbox | `bgm_harbour_row` (tide ≤ 3), `bgm_town_hush` (tide ≥ 4) | `amb_wind` |
| 2 | `wren_house` | Number 9 | 24x18 | Warm lamp, things pushed under beds | floorboards, wall_plaster | bed, table, kitchen_counter, coat_hook, bookshelf, window_can (x2); T3: jam_jar, biscuit_tin | Door south (6,16) → `harbour_row`; stair tile (12,4) ↔ bedroom half of the same map (18,4) | Bed = Shore save point. Coat hook (Coat Pocket joke). Under-bed inspection. Mum and the June postcard (sk6). Ending C's waking scene | `bgm_harbour_row` / `bgm_town_hush` | `amb_room_hum` |
| 3 | `brills_chippy` | Brill's Chippy | 20x14 | Steam, vinegar, forced cheer | floorboards (T2: lino_check), wall_plaster | chippy_counter, fryer, table, sign_closing, bench | Door south (10,12) → `harbour_row`; inner doorway (15,5) to the back room (same map) | Shore shop (Mr Brill). Pickled egg gag. Back room: the face-down CLOSING DOWN sign (sk3) | `bgm_harbour_row` / `bgm_town_hush` | `amb_room_hum` |
| 4 | `shingle_beach` | Shingle Beach | 40x28 | Huge sky, sea much too far away | shingle, wet_sand, rock, cliff, sea, grass_verge | groyne (x3), boat_upturned, lighthouse, lobster_pots; T3: boulder, rowboat, rock_pool_small | West edge → `harbour_row`; Tide Steps mouth (20,26) → `tide_steps` (12,2); lighthouse oil-store door (34,8) locked until epilogue | Prologue (sunny tint, tiny Wren + Pop). Meeting point before each Tide. The slip (Tide 4). sk2, sk9. Epilogue dawn | `bgm_harbour_row`; Tide 4–5: `bgm_town_hush` | `amb_sea` |
| 5 | `tide_steps` | The Tide Steps | 24x32 | Wonder; first colour; a long way down | stair_stone, pale_sand, shallows, reef_rock, deep_water | rock_pool, postbox_shelley, mail_slot_door (x4), stamp_flower, mail_sack, can_post; T2: bench_lull, gull_picket, snail_stan | North (12,1) → `shingle_beach`; west door (2,24) → `sorting_shallows` (38,15); east door (21,24) → `blare_reef` (1,14); south-west door (6,30) → `slack_water` (18,1); south door (14,30) → `undertow_light` (16,2); pearl slot (19,30) → `pearl_bed` (16,22) once `pearl_bed_reached` | Hub. Shelley's shop. Rock-pool save. Striking gulls with SQUAWK placards. After `gull_delivered`: Postmaster Gull runs a lost-property window here. Secret bench 1 | `bgm_lull_bright` | `amb_lull` |
| 6 | `sorting_shallows` | Sorting Shallows | 40x30 | Bright, busy, funny | pale_sand, shallows, envelope_paper, deep_water, reef_rock | pigeonhole_cliff (x8), pigeonhole_bin (x4, tinted), mail_sack, letter_pile (x6), stamp_flower, rock_pool | East edge → `tide_steps`; boss arena in the north-west alcove (6,5) | Tide 1. Pim found upside-down. Deliver tutorial. Sorting puzzle (8.1). Boss `boss_postmaster_gull`. Stan, position 1 | `bgm_lull_bright` | `amb_lull` |
| 7 | `blare_reef` | Blare Reef | 40x28 | Deafening, pink, nobody listening | coral_floor, pale_sand, shallows, reef_rock, deep_water | horn_coral_big (x6), horn_coral_small (x12), horn_pipe (x4), rock_pool, mail_sack, stamp_flower | West edge → `tide_steps`; the Great Horn gate (36,14) opens on `pipes_solved` | Tide 2. A reef of coral shaped like gramophone horns and ship's funnels, all shouting so nobody has to talk. Horn Pipes puzzle (8.2). Odo says his true thing. Set-piece battle `troop_big_noise`. Stan, position 2 | `bgm_blare_reef` | `amb_lull` |
| 8 | `slack_water` | Slack Water | 36x28 | Becalmed, prim, exhausted | ledger_paper, mirror_water, pale_sand, reef_rock | sunk_clock (x4 puzzle + 5 decor), intray_stack (x8), ironing_board, washing_line, vending_machine, rock_pool, mail_slot_door (x2: ON TIME, LATE); T2: bench_lull | North edge → `tide_steps`; door ON TIME (30,6) loops to (4,24) of the same map; door LATE (32,6) → inner flat (same map, (20,12)) with the boss arena | Tide 3. The moment between tides when nothing moves. Four Clocks puzzle (8.3). Lin's scene. Boss `boss_perfectly_fine`. Compliment vending machine. Secret bench 2. Stan, position 3 | `bgm_slack_water` | `amb_void` |
| 9 | `undertow_light` | The Undertow Light | 32x30 | Dark teal, close, tender | stair_stone (T2: spiral_stone), floorboards (T2: dark_boards), reef_rock (T2: light_wall), pale_sand (T2: fog), T2: ink_dark | stair_hatch (x3), can_post (x4), rock_pool; T2: lamp_lens, radio_valve (x5) | Top hatch (16,2) → `tide_steps`; bottom hatch (16,27) → `memory_rocks` (12,15) and, after `truth_known`, → `pearl_bed` (16,2) | Tide 4. A lighthouse built downward into the seabed; its lamp shines up. Three round rooms joined by hatches. String Line puzzle in the dark (8.4). Pim starts reading himself. Stan, position 4 | `bgm_undertow` | `amb_void` |
| 10 | `memory_rocks` | The Rocks, Last September | 24x18 | Sepia, sunny, unbearable | rock, wet_sand, sea, shingle | groyne, lobster_pots | Entered only from `undertow_light`; exit by script back to (16,27) | The three words, a year ago (map tint `[150,110,60,0.25]`). Tam seen only from behind (CG). Scripted battle `troop_three_words`. The friends learn. Nobody leaves | `bgm_other_can` | `amb_sea` |
| 11 | `pearl_bed` | The Pearl Bed | 32x24 | Beautiful, hushed, airless | pale_sand (T2: pearl_floor), reef_rock (T2: nacre_wall), deep_water, envelope_paper | rock_pool, letter_pile, stamp_flower (x4, tinted: the Pearl Doors buttons); T2: pearl_big (x6), pearl_small (x8 rub spots), pearl_heap (x4), bedroom_door, snail_stan | North (16,2) → `undertow_light`; pearl slot → `tide_steps`; Nacre at (16,8); behind Nacre the bedroom door → battle `troop_other_can` | Tide 5. `onEnter` sets `pearl_bed_reached`. Pearl Doors puzzle (8.5). Nacre's offer (Ending C branch). Boss `boss_nacre`. The Other Can. Stan arrives | `bgm_undertow`, then `bgm_nacre` | `amb_void` |

Notes for map builders. Interiors are floor + `wall_plaster` with furniture props. Where a T2 terrain is listed the T1 terrain in front of it is the fallback, so every map is buildable from T1 art alone. The prologue reuses `shingle_beach` with `['tint',[255,220,120,0.18],1]` in its opening event instead of a separate map.

---

## 5. Story script outline

Conventions: **W** Wren, **O** Odo, **L** Lin, **P** Pim. `think` = Wren's inner voice. Every Say it / Keep it moment is a two-option `choice` with "Say it" text first and the Keep option as the cancel default (keeping is the easy button, pillar 1). Lines in quotation marks are final text.

### 5.1 Flags and variables

| Key | Type | Meaning |
|---|---|---|
| `tide` | var 0–6 | Chapter clock |
| `sk1_said` … `sk9_said` | flags | The true thing was said (on time or late) |
| `sk1_kept` … `sk9_kept` | flags | It was kept at the moment (stays true even if said late; used for dialogue colour only) |
| `true_words` | var 0–9 | Count of `skN_said`. Drives starting Tumbled glass (6.4) and the final choice |
| `seg1_kept` … `seg5_kept` | var | Number of still-unsaid Kept moments in that Shore segment; > 0 spawns that Tide's named Unsent (6.11) and gives Wren a Story Pebble (6.5) |
| `pim_joined`, `odo_told`, `lin_told`, `the_slip`, `truth_known`, `pim_knows` | flags | Story beats |
| `sort_done`, `pipes_solved`, `late_door_open`, `string_done`, `pearl_doors_open` | flags | Puzzles |
| `gull_delivered` / `gull_hushed`, `fine_delivered` / `fine_hushed`, `nacre_delivered` / `nacre_hushed` | flags | Boss outcomes (colour dialogue and the hub; never gate endings) |
| `nacre_offer_seen`, `gave_letter`, `came_back`, `other_can_answered`, `pearl_bed_reached` | flags | Finale |
| `final_choice` | var | 0 none, 1 "Send him", 2 "Not yet" |
| `egg_offers`, `stan_talks`, `rub_count`, `bench_1`, `bench_2` | var/flags | Side content |
| `delivered_count`, `hushed_count` | var | Album statistics only. **No ending reads them.** |
| `sort_carry`, `sort_count`, `sort_l1_taken`…`sort_l6_taken`, `pipe_a`…`pipe_d`, `pipes_wrong`, `clock_1`…`clock_4`, `clocks_right`, `string_held`, `string_step`, `pearl_seq`, `letter_1`…`letter_3` | var/flags | Puzzle and letter state (section 8) |

### 5.2 Prologue — "Glass" (3 min, `tide` 0)

1. Black. Whistled leitmotif (seven notes, no ending). `narrate`: "Eight summers ago. Low tide."
2. `shingle_beach`, sunny tint. Tiny Wren follows Pop along the rocks. Four shining spots; each pickup gives one colour and one line of the rhyme. **Pop:** "Red for cross, blue for fretting, amber for fond, green for well-I-never."
3. Pop holds the amber piece to the sun (`cg_prologue_glass`). **Pop:** "See how it's gone soft? Sea did that. Rolled it about with all the others for years. Nobody smooths their own glass, pet." / **Pop:** "Don't keep them all in one pocket, love. You'll rattle."
4. A second small girl's voice from off-screen (name tag `???`): "Wren! I found a GREEN one!" Tiny Wren runs toward it. Cut to white.
5. Present day, `wren_house`. `think`: "Friday. The sea has gone out further than it's supposed to. Everyone keeps saying so. Nobody says anything else." Inspect coat hook: `think` "My coat. Pockets: string, a peg, sand. And the other pocket. ...Nothing I want to look at." Sets `prologue_done`, `tide` = 1.

### 5.3 Tide 1 — "The Sea Went Out Too Far" (Shore 4 min + Lull 10 min)

**Shore.** The can on Wren's east window rattles. **O (through can):** "Wren. WREN. The sea's gone out too far. Like WAY too far. Meet at the beach. This is not a drill. Over." `think`: "He always waits after 'Over'. I never say it." On the west window a second can hangs on a slack string that crosses the lane to the TO LET house. Inspect: `think` "That one doesn't ring."

- **sk1 (Pop, `harbour_row`).** Pop, soldering on his bench: "You've gone quiet on me this year, pet. Anything rattling?" → Say it: "A bit. I don't know how to say it yet." (**Pop**, `twinkle`: "That's a whole sentence more than yesterday. No rush. Tide goes out, tide comes in.") / Keep it: "What. No." (**Pop**, `concerned`, then: "Right you are.")
- Lin is on the row with her clipboard. **L:** "Three things. One: that is not a staircase that should exist. Two: I'm coming. Three: hold the rail." **O:** "There's no rail. Over." **L:** "Then hold the concept of a rail."
- **sk2 (Odo, top of the steps, `shingle_beach`).** The slack string from Wren's west window runs over the shingle and down the steps. **O:** "That's your other line. Who's it for? The one to the empty house. Over." → Say it: "A friend. Tam. She moved." (**O**, `quiet`: "...Roger. Thanks for telling me. Over.") / Keep it: "Nobody." (**O:** "Roger. Nobody. Copy that. ...Weird that Nobody gets a whole string. Over.")
- `cg_tide_steps`. They go down.

**Lull.** `tide_steps`: colour floods in (`flash`, `bgm_lull_bright`). Striking gulls hold placards reading SQUAWK. Shelley's postbox: "We're open. Mind the claw." Rock pool tutorial (save, heal, Skim).

- `sorting_shallows`. Kicking ink legs stick out of a pigeonhole. **O** salutes. Pull him out. **P:** "Hello! I'm Pim. I'm for somebody. Is it you? ...No. Is it YOU?" **L:** "It's a letter. With legs." **P:** "First Class, actually." `addMember pim`, `pim_joined`. **P** (`puzzled`): "I'm awfully heavy for my size. Four pages, I think. I can't read my own inside. Can you?" W → forced shrug. `think`: "I know that stamp."
- **Deliver tutorial**, `troop_tutorial_card`. The Thank-You Card mutters "sorry sorry it's been so long it's got AWKWARD now". Pim explains Listen and Say; Lin explains the Can Line: "One confidence per round. The string only carries one voice at a time. I've made a rota." First Confide confession, **O → W:** "...I was kinda scared on the stairs. Over."
- Sorting puzzle (8.1) opens the pigeonhole gate.
- **Boss `boss_postmaster_gull`.** "No return address, no service. It's in the handbook. I wrote the handbook." He accepts only Tumbled glass: the fight teaches that a thing must pass through a friend first. Delivered: he unfolds his own forty-year-old resignation letter, reads it, and decides to stay ("Turns out I like it here. Don't tell the lads.") → `gull_delivered`, keepsake `gull_feather`, he moves to the hub. Hushed: he crumples his cap, mutters "Work to rule, then," and stalks off → `gull_hushed`, the hub window stays shuttered.
- **Nacre's first slip** (blue border) slides out from under a stone: "PLEASE DO NOT TROUBLE YOURSELF." **L:** "Who prints a note in a rock?" **P:** "Somebody with lovely manners." Key item `nacres_slips`. The tide turns; they climb. `tide` = 2.

### 5.4 Tide 2 — "Blare Reef" (3 + 10 min)

**Shore, Saturday morning.** Mr Brill: "Pickled egg? On the house. No? ...Pickled egg?" (accepting increments `egg_offers`). He sends Wren to the back room for vinegar. The sign lies face-down. Turning it over: CLOSING DOWN. `think`: "Oh."

- **sk3 (Odo, `brills_chippy`).** O bursts in: "Commencing snack. Snack is GO. Over." → Say it: "I saw the sign, Odo." (**O**, `scared`, then `boast`: "That's — that's an OLD sign. For a different shop. That closed. Over and OUT." He is not ready, but he was seen. **W:** "Okay.") / Keep it: Wren puts it back face-down. `think`: "Not my business. That's the rule here. We don't make a fuss."
- **sk4 (Lin, `harbour_row`).** **L:** "Tide 2 is at 10:42. I've allowed four minutes for dawdling." → Say it: "Thanks for coming yesterday. I'd have gone alone." (**L**, `fond`: "Noted. ...I've written it down. It's going in the minutes.") / Keep it: "What."

**Lull, `blare_reef`.** Everything shouts. Toots bellow I'M FINE. **P** reads a passing memo aloud, then blurts (`blurt`): "...and anyway YOU were the one who— oh. That's not a nice bit. Whose is that? Is that MINE?" W: `frozen`.

- Horn Pipes puzzle (8.2). Odo volunteers to whisper the test message. With the pipes wrong, the far horn booms: "WEIRD MUFFIN." **L:** "What did you actually say?" **O:** "...Classified. Over." With the pipes right, the reef falls silent for the first time and the far horn says, small and clear, in Odo's voice: "We're moving. In winter. I didn't want it to be true. Over."
- **O** (`quiet`): "Dad says if you don't say a thing out loud it might not happen. I've been not saying it SO hard." **L:** "Odo. That's not how things work." **O:** "I KNOW. Over." **P:** "It doesn't make it more real. I carry four pages of something and I'm exactly as real as I was before. Just less lonely, now you know." → `odo_told`; unlocks the Two-Can Call `call_over_and_out`. Wren says only "Oh." `think`: "Not again."
- The reef roars back, offended: set-piece `troop_big_noise`. Afterwards the Great Horn gate opens to a shelf with Nacre's second slip (amber border): "THERE, THERE. NO NEED TO GO ON ABOUT IT." `tide` = 3.

### 5.5 Tide 3 — "Slack Water" (3 + 11 min)

**Shore, Saturday evening.** Townsfolk are thinning into "..." (5.9).

- **sk5 (Pop).** "That old line across the lane's gone slack. Want me to take it down, or tighten it?" → Say it: "Tighten it. ...Please." (**Pop**, `twinkle`: "Thought you might.") / Keep it: "Leave it."
- **sk6 (Mum, `wren_house`).** "Postcard's still on the side, love. It's been there since June. It's not going to bite." → Say it: "I read it. I don't know what to write back." (**Mum**, `soft`: "You don't have to know yet. You just have to not pretend it isn't there." `giveItem tams_postcard`; inspecting it shows Tam's handwriting: "You don't have to write back. I just like telling you things.") / Keep it: "Later." (**Mum**, `worried`: "...All right. Later.")
- Lin is late for the first time ever. **L** (`tired`): "I am fine. I am absolutely fine. Please stop looking at me like I'm a tide table with a mistake in it."

**Lull, `slack_water`.** Flat ledger-paper seabed, mirror-still pools, grandfather clocks half-buried like groynes, in-trays stacked like sea stacks. **P:** "I appear to contain the phrase 'and anyway'. Eleven times. Is that normal?" **L:** "It is poor style."

- The compliment vending machine: OUT OF ORDER. Insert 1 Stamp and have Odo thump it → "You're doing fine." Lin stares at it for a long time. Keepsake `doing_fine_token`.
- Four Clocks puzzle (8.3). Lin sets all four perfectly from the tide table; door ON TIME loops them back to the start. **L:** "That's correct. It's CORRECT. I checked it twice." Setting one clock wrong on purpose opens LATE. **L** (hand shaking over the clock): "Doing it badly. On purpose. Item one."
- Secret bench 2. Lin sits for "one minute" and falls asleep against an in-tray stack; Odo lays his life vest over her (`cg_lin_asleep`, T3; without it, a fade and a `narrate`). **P** (whisper): "Shall I read her mail?" W: finger to lips.
- **Boss `boss_perfectly_fine`**: a tower of ironed laundry with a smiling paper mask, the town's every "I'm fine, really" pressed flat. Its last two Lines accept only Tumbled Red from anyone; if Lin is the one who Says one, she gets the line: "I am NOT fine. I'm thirteen. I make the tea and the packed lunches and the lists and I'm TIRED." Mask cracks at each Red.
- After (either outcome): **L** (`relieved`): "I need help. There. It's said. It was item one all along. I just kept moving it to tomorrow." **O:** "Helping is GO. Over." → `lin_told`; Lin learns `i_need_help`; unlocks `call_by_the_book`. Third slip (red border): "LEAST SAID, SOONEST MENDED." `tide` = 4.

### 5.6 Tide 4 — "The Undertow Light" (4 + 10 min)

**Shore, Sunday morning, drizzle (`amb_rain`), `bgm_town_hush`.** Pop only whistles. Lin arrives with Robin in tow.

- **sk7 (Lin).** **L:** "Could you— no. Never mind. It's fine." → Say it: "Could I what? I can mind Robin while you get your coat." (**L**, `fond`: "...Yes. That. Thank you. Four minutes.") / Keep it: "Okay."
- **sk8 (Robin).** "Are you Lin's friend? She said she hasn't got time for friends." → Say it: "Yes. I am." (**Robin:** "Okay. I've only got one shoe.") / Keep it: "Ask her."
- **The slip (`shingle_beach`).** **O:** "When we move — you'll write, right? You've got a whole letter FACE. You'd be good at it. Over." The choice box shows three lines. Two are greyed ghost lines that the cursor passes over: "Of course I will." and "I'll miss you." The only live line: **"Fine. Go then."** The game waits as long as the player needs; no timer, the music drops to the heartbeat SFX. On confirm: **O** (`quiet`): "...Roger. Out." He comes down the steps anyway, three paces behind. Sets `the_slip`.

**Lull, `undertow_light`.** The string leads into a lighthouse built downward. Valve radios murmur half-sentences from the town ("—been meaning to say—", "—never did thank her—"). String Line puzzle (8.4): when the line is taut the radios all tune to one voice. **`???`:** "Wren? Are you awake? Over." **P** (`puzzled`): "That's the voice I'm for."

- Bottom hatch → `memory_rocks`. Sepia. Eleven-year-old Wren and a girl seen only from behind (`cg_the_rocks`, T2). **`???`:** "They sold the *Marigold*. We have to go inland. I wanted to tell you first." The choice box again: two ghost lines, one live: **"Fine. Go then."** Then the text finishes itself without the player: "I was getting bored of you anyway." **O**, behind her, very quietly: "...Oh. It's what you said to me."
- **Scripted battle `troop_three_words`**: three Echoes wearing FINE / GO / THEN. At the start Wren's pocket is force-filled with five raw Blue: she Freezes Up and cannot act, and in this fight the Spill does not time out. The player controls Odo, Lin and Pim. The Echoes cannot be Hushed here (Strike shows "It isn't them you're angry at."). The only way forward: each friend Confides one glass to Wren (one per round, because there is one Can Line). Confessions: **O:** "I'm still cross with you. I'm still here. Both. Over." **L:** "I have done worse to Robin on a Tuesday. Hold the rail." **P:** "Dear Tam. That's how I start. I've just read my own first line." After the third, Wren's Freeze Up ends, all her Story Pebbles are skimmed away, and the Echoes, having been Listened to, fold into gulls.
- **The friends learn.** W tells it in four short boxes (the can, the hour, the van, the jar). Sets `truth_known`; Tam's name tag becomes "Tam". **L:** "One: that was unkind. Two: you were eleven. Three: you are not a 'kind of friend'. You're a friend who did a thing." **O** (`teary_grin`): "Permission to stay, Captain? Over." **P** (`brave`): "Oh. I'm yours, aren't I? I'm the thing you didn't send." → `pim_knows`; unlocks `call_first_class`; `cg_nobody_leaves` (T2). **Nobody leaves.** Fourth slip (green border): "YOU HAVE HAD A LONG DAY. LET ME KEEP IT FOR YOU." `tide` = 5.

### 5.7 Tide 5 — "The Pearl Bed" (2 + 8 min)

**Shore, Sunday evening.** Half the town says only "...". Mr Brill (`flat`): "...Egg."

- **sk9 (Odo, `shingle_beach`).** → Say it: "This morning. I didn't mean it. I'm sorry." (**O**, `grin`: "Apology received and UNDERSTOOD. ...Say it again slower, I want to log it. Over.") / Keep it: "...Ready?" (**O:** "Ready. Over." He is kind about it, which is worse.)

**Lull, `pearl_bed`.** Everything is coated, beautiful and silent. Rubbing a pearl (8.6) shows a scrap of what is underneath: "—I never told him I was proud—". Pearl Doors puzzle (8.5). Stan arrives: "Here we are. Forty years. Sign here."

- **Nacre's offer.** Slips slide out one by one: "WELCOME, DEARS." / "YOU ARE CARRYING SOMETHING SHARP." / "LET ME KEEP IT FOR YOU. IT WILL NEVER HURT. IT WILL NEVER ANYTHING." Sets `nacre_offer_seen`. Choice: **"Keep walking."** / **"Let Nacre keep it."** The second asks once more ("Pim: It's all right. I'd be very shiny."), then sets `gave_letter` → Ending C.
- **Boss `boss_nacre`** (6.12). Delivered: the shell opens fully and a last slip comes out, handwritten for the first time, the true sentence Nacre could never say: "I did not want you to hurt. I did not know what else to do." **W:** "Thank you for keeping it. I'll take it from here." `nacre_delivered`. Hushed: the shell clamps shut; the string runs through the hinge and they squeeze after it. `nacre_hushed`.
- **Final encounter `troop_other_can`** (6.12), in the dark bedroom inside the shell. On timeout: "…Okay. Night, Wren. Over and out." — and **P:** "We can try again. It's allowed." (retry from the rock pool, full heal). On success the last Line is Wren's: **"I'm here. I'm sorry. Over."** Her first "Over". The can stops rattling. Sets `other_can_answered`.
- **Pim's question.** **P** (`brave`): "I know who I'm for now. Being sent isn't the end of a letter. It's the point of one. Is that all right?" Choice: **"Send him."** (live only if `true_words` ≥ 6; otherwise drawn as a ghost line reading "Send him. (He's still mostly 'and anyway'.)") / **"Not yet."** Sets `final_choice`. `tide` = 6.

### 5.8 Epilogue and endings

Exact conditions (evaluated in this order by the ending router):

| Ending | id | Condition |
|---|---|---|
| C — "Pearl" | `ending_pearl` | `gave_letter` is true |
| A — "Sent" | `ending_sent` | `gave_letter` false AND `other_can_answered` AND `final_choice` == 1 (which requires `true_words` ≥ 6) |
| B — "Not Yet" | `ending_not_yet` | `gave_letter` false AND `other_can_answered` AND `final_choice` == 2 |

**Ending A — "Sent".** Custom screen `letter_compose` (8.7): the four pages fall away; under "Dear Tam," the player places three of their earned True Words; the letter closes "— Wren". Pim reads himself aloud once, delighted: "Oh, I'm SHORT. I'm so much better short." Dawn on `shingle_beach`: the tide comes in over the steps; Pim, in the air of the Shore, is an envelope folded like a boat, still and light. Monday, `harbour_row`: Mum has had the address on the postcards all along. Wren writes it on the blue ruled line and posts it (`cg_ending_sent`). That afternoon she finally pulls the jar out from under the bed and carries it to the den; the oil-store door is not locked, it turns out, only stiff (`cg_den_jar`, T3). Dry captions (`narrate`): "She did not hear back that week." / "She checked the mat anyway. That was new." Winter, moving day: Wren hands Odo a stamped, addressed, empty envelope. **W:** "For you to fill in. I'll write back." **O** (`teary_grin`): "Commencing not crying. Not crying is GO. Over." **W** (`crying_smile`): "...Over." The town talks again (fully if `nacre_delivered`, "mostly" otherwise). Credits over the Delivered Mail album as flying paper gulls (`cg_credits_gulls`, T3). Post-credits: the letterbox flap clacks; Wren looks up; cut to black. Coat Pocket now reads: "Empty. Good."

**Ending B — "Not Yet".** **P:** "Not yet is a real answer. Letters keep." Dawn; Pim waves from the bottom step as the water comes in, then hops into the coat pocket (`cg_not_yet`, T2). Winter: Wren writes her address on Odo's hand in biro. **O:** "It'll wash off." **W:** "Then I'll write it again." Coat Pocket: "Not yet. But soon." `narrate`: "Not yet is allowed." `bgm_title` (the unresolved tune). Loading the cleared save puts the party at the `pearl_bed` rock pool with every zone open, so Kept things can still be Delivered and the choice made again.

**Ending C — "Pearl".** Nacre coats the letter. **P:** "Oh. It's quiet. I can't feel my 'and anyway's. Goodnight, I think. You can come and get me. Letters keep." `cg_pearl_calm` (T2): a calm, lovely seabed and one small pearl shaped like a paper boat. Wren wakes light and untroubled in `wren_house`; the town is polite and silent; the Coat Pocket entry is blank. Then the east-window can rattles. **O:** "Wren? You awake? Over." One last Say it / Keep it. Say it: **"...Odo? I think I left something down there. Over."** → sets `came_back`, fade, and the game resumes at the `pearl_bed` rock pool before the offer with Pim un-pearled ("Told you. Letters keep."). Keep it: credits over a flat sea; the title screen's Continue still resumes before the offer. A friend on the line is always a way back.

### 5.9 The town going quiet (schedule)

| Speaker | Tide 1 | Tide 2 | Tide 3 | Tide 4 | Tide 5 | Epilogue A / B |
|---|---|---|---|---|---|---|
| `towns_a` (fisherman) | "Lowest tide in forty years, they reckon." | "Can't complain. Well. Could. Won't." | "..." | "..." | "..." | "Forty-one years, I've been meaning to tell my brother he can have the boat." / "Morning." |
| `towns_b` (trolley lady) | "We don't make a fuss here, dear." | "Mustn't grumble." | "Mustn't..." | "..." | "..." | "I've a fuss to make, as it happens. Put the kettle on." / "Mustn't grumble. ...Might, though." |
| `mr_brill` | booming | booming | one egg offer only | `flat`, short | "...Egg." | booming, tearful |
| `pop` | full lines | full lines | full lines | whistles only (`whistling`) | whistles only | "There she is." |
| `mum` | full | full | full | "Love you. Late. Bye." | "..." then a hug (`move` only) | full |

Implementation: each of these events has one page per tide range using `{var:['tide','>=',n]}` conditions.

---

## 6. Battle system

### 6.1 Overview and screen layout

Turn-based, party of up to four against one to three **Unsent** (messages nobody sent, alive and upset). There is no MP. The one resource is **sea-glass** in each character's five-slot **Pocket**; it pays for skills, it is what you **Say** to an Unsent to Deliver it, it changes how its holder behaves, and too much of one kind **Spills**. Once per round the **Can Line** lets one character **Confide** a piece to a friend, where it arrives **Tumbled**: smooth, double value, harmless. HP is **Breath** (you are on a seabed; at 0 a character is **Winded** and sits down; nobody dies).

**"Tideline" layout, 768x576** (side-on stage; no corner portraits, no portrait boxes at all):

- Full-frame battle background. A message strip (480x44 at x 144, y 12) names actions and shows enemy mutterings.
- **Can Line indicator** at (16,12): a 48x48 tin can with a string running along the top edge to the turn ribbon; amber-lit when the line is free this round, grey with a knot when used. A round counter sits under it.
- **Turn ribbon**: vertical strip at x 720–760, y 16–376, the next six turns as 40x40 round tokens (party tokens are the character's walk-sprite head; enemy tokens are thumbnails).
- **Enemies** stand on a baseline at y 300, spread between x 150 and x 610, drawn with boil. Above each floats its **letter strip**: a cream paper slip 100 px wide with one ruled **Line** per row (16 px each). A hidden Line shows "?"; a revealed Line shows a coloured underline (a small star if it needs Tumbled glass); a filled Line shows a coloured scribble. Enemy Breath is a thin pencil bar under the strip, visible only after the first hit or Listen.
- **The tideline**: a torn-paper band of wet sand from y 392 to 576. The party stand on it with their backs to the camera (the `up` stand frame of the walk sheet at 1.5x, 96x132), feet at y 470, centres at x 120, 296, 472, 648. No separate battle sprites are needed.
- Under each member, pressed into the sand: the **Pocket**, five hollows 22 px wide, 26 px apart, centred on the member at y 498. Raw glass is drawn jagged with hatching, Tumbled glass rounded with a white glint, a Pebble as a grey stone. Below it the **Breath string**: a 120 px can-string at y 526 whose coloured length is the Breath fraction, with the number at its end; the name is lettered at y 548. Brimming and Spill states show as a small word tag beside the name.
- **Commands** fan out from the active member as six paper luggage tags in an arc (centre at member x, y 330–392): Strike, Skill, Say, Listen, Brace, Item. When the Can Line is free a seventh tag with a can icon, **Confide**, sits at the left end; the key `C` jumps straight to it (one key, then pick a piece, then pick a friend; the oldest raw piece and the friend with the most free slots are pre-selected, so `C`, confirm, confirm is the fast path).
- A Confided piece is visibly skimmed along the sand to the friend, and the one-line confession appears as a scrap above the receiver for 90 frames.

### 6.2 Stats, formulas, turn order

Stats: **Breath** (`hp`), **Arm** (`atk`), **Coat** (`def`), **Pace** (`spd`).

- Damage = `max(1, round((atk*2 - def) * power * mods * rnd))`, `rnd` uniform 0.92–1.08. Strike has power 1.0. Critical 5% base, x1.5. Evasion 3% base.
- Healing is a percentage of the target's maximum Breath.
- **Sharp and smooth** (one colour-blind rule): a character takes +5% damage per raw piece held and −5% per Tumbled piece held. Feelings kept alone cut; feelings that came from a friend protect.
- Round structure: at round start the Can Line becomes free; all combatants are ordered by `spd` (ties: party first, then random). Priority skills act first; a Fretting character acts last. Bosses act twice per round (at their `spd` and again at the end).
- At the start of each of their turns a party member gains 1 raw piece of their **home colour** (Wren Blue, Odo Red, Lin Amber, Pim Green).
- After battle: everyone regains 20% Breath; Winded members stand up at 25%; all glass is emptied; Pebbles stay. Rock pools heal fully. Escape always succeeds against roaming Unsent and is disabled in boss and scripted fights.

### 6.3 Sea-glass: colours, gaining, Brimming, Spill

Four colours, named by Pop's rhyme: **Red = Temper** (cross), **Blue = Worry** (fretting), **Amber = Fondness** (fond), **Green = Wonder** (well-I-never). There is no strength/weakness wheel between them.

**Gaining glass (feelings happen to you).** Turn start: +1 home colour. Being hit: +1 Blue (at most once per round). Seeing an ally lose 25% or more of their Breath in one hit, or become Winded: +1 Red (once per round). Being healed, shielded or covered by an ally: +1 Amber. Using Listen, or seeing an enemy move for the first time in this battle: +1 Green. If the Pocket is full, the oldest raw piece rolls away to make room; if there is no raw piece to push, the new piece is lost.

**Brimming** (3 or more raw pieces of one colour): behaviour changes, not stat tiers.

| Colour | State | Boon | Rule cost |
|---|---|---|---|
| Red | Short Fuse | Strikes and damaging skills +25% | Cannot Listen, Say or Confide: too cross to talk |
| Blue | Fretting | Takes −25% damage | Acts last in the round and cannot Strike |
| Amber | Doting | Heals given +30% | Automatically steps in front of the lowest-Breath ally and takes single-target hits aimed at them |
| Green | Daydreaming | Critical +25%, evasion +15% | 25% chance each turn to lose the action ("...oh, a limpet.") |

**Spill.** If every non-Pebble slot of a Pocket holds the same raw colour (minimum three pieces), the character Spills for their next two turns and cannot be controlled: Red **Lash Out** (Strikes a random target at +50%; 40% chance it is an ally), Blue **Freeze Up** (no action, takes −50% damage), Amber **Cling** (only heals the lowest-Breath ally for 20%), Green **Drift Off** (no action, 50% evasion). Then the raw glass empties. One piece short of a Spill the Pocket visibly rattles (`sfx_glass_clink` twice). **A friend who Confides to a Spilling character ends the Spill at once**: the Tumbled piece pushes out one raw piece. Tumbled glass never counts toward Brimming or Spill, so simply holding something a friend gave you keeps you steady.

A player who only ever Strikes gains one home piece a turn, Brims by turn 3 and Spills around turn 5–8, again and again. Spending, Saying and Confiding are what keep a Pocket healthy.

### 6.4 The Can Line: Confide, Tumbled glass, Out Loud

- **Confide** is a free action taken before the main action, but the party shares **one Can Line per round** ("the string carries one voice at a time"). The active character hands one raw piece to any ally; it arrives **Tumbled**. If the ally's Pocket is full it pushes out their oldest raw piece (never a Pebble or a Tumbled piece; if there is none, the Confide is refused). Tumbled pieces cannot be Confided again. The piece remembers who it came from (`from`), which matters for a few boss Lines.
- A **Tumbled piece**: counts as **2 pieces of any colour** when paying a skill cost; keeps its true colour for Say; gives −5% damage taken instead of +5%; never Brims or Spills.
- **Out Loud.** A skill paid for entirely with Tumbled glass fires Out Loud: **+50% effect** and one generic rider chosen by the skill's type: damage skills cannot miss and ignore half the target's `def`; healing skills also remove one status; buff/debuff skills last one turn longer; glass-moving and Say-type skills also give the user +1 Green. In the skill list the player flips between Plain and Out Loud with left/right when both are payable (default: Plain, raw first).
- **Confessions.** Every Confide shows one line from that pair's confession pool (about eight per ordered pair, mostly tiny: "Lin: I do not actually like tea." "Odo: I gave myself the swimming medal. Over." "Pim: I read your shopping list. You're out of jam."). Story-critical confessions are scripted (5.3, 5.6).
- **Said things pay later.** At battle start the party receives `floor(true_words / 3)` Tumbled pieces (maximum 3): first a Tumbled Amber for Wren, then a Tumbled Blue for Odo, then a Tumbled Green for Lin.

### 6.5 Pebbles

A **Pebble** blocks one Pocket slot and **cannot be removed by its owner** (pillar 2). Maximum two per character.

- **Hushing** an Unsent gives the character who struck the last blow one Pebble ("you made it be quiet; it sits in your pocket").
- Some enemy moves add Pebbles (Pearl Drip, Nacre).
- **Story Pebbles**: while any `segN_kept` > 0 Wren starts every battle with one Story Pebble (two if two or more segments are still unsaid). After the `memory_rocks` scene only `seg5_kept` counts.
- Removal: a friend's **Skim** at any rock pool clears all ordinary Pebbles in the party for free; Lin's `spare_tissue`; the item `flask_of_tea` used **on someone else**. Story Pebbles ignore all three: at the pool Lin says, "That one's stuck. We could help if you told us what it is." They go when the matching named Unsent is Delivered (6.11) or at the rocks in Tide 4.
- Because Spill looks only at non-Pebble slots, a Pebbled Pocket Spills sooner.

### 6.6 Actions, Lines, Deliver and Hush

| Action | Effect |
|---|---|
| Strike | Power 1.0 hit, free. Damage **shakes loose** the target's most recently filled ordinary Line |
| Skill | See 6.9. Costs glass |
| Listen | Reveals one hidden Line of the target (Pim: two). User +1 Green. Cancels a telegraphed **Blurt** (a charged move shown as a shaking speech scrap over the enemy) |
| Say | Offer one piece to one Line of the target. Right colour: the Line fills. If the piece was Tumbled the target is also **Soothed** (skips its next action; bosses lose one of their two). Wrong colour, or raw glass on a starred Line: **Misheard**: the piece is lost and the target is **Riled**. Saying to a hidden Line is allowed (a guess) |
| Brace | Until the user's next turn: −40% damage taken, and stand in front of one chosen ally, taking single-target hits for them. The covered ally gains +1 Amber |
| Item | See section 7 |

**Lines.** Every Unsent has 2–3 Lines (bosses 4–6), each wanting one colour: what the message needed to be said with. Clues come from its look and its muttering (the crab grumbling "it's not FAIR" wants Red). A starred Line (★) accepts only Tumbled glass. The **Delivered Mail** album remembers every Line ever revealed for an enemy type, so repeat encounters start revealed.

**Delivered** (all Lines filled): the Unsent unfolds into a paper gull and flies out of frame (`sfx_gull_cry`); its two-line letter joins the album. **Hushed** (Breath 0): it crumples into a grey pebble.

| Outcome | EXP | Stamps | Extra |
|---|---|---|---|
| Delivered | 100% | 100% | Album letter; drop roll; `delivered_count` +1 |
| Hushed | 100% | 50% | Finisher gains a Pebble; `hushed_count` +1 |

EXP is identical on purpose: there is no "violence makes you strong, kindness keeps you weak" split, and no ending counts Hushes. The difference is felt inside the pockets.

### 6.7 Status effects

| id | Name | Effect | Duration |
|---|---|---|---|
| `winded` | Winded | Breath 0, cannot act; stands up after battle or with `stick_of_rock` | until cured |
| `riled` | Riled | Enemy `atk` +20% | 2 turns |
| `soothed` | Soothed | Skips next action | 1 action |
| `rattled` | Rattled | `atk` −20% | 2 turns |
| `tongue_tied` | Tongue-Tied | Cannot Say, Listen or Confide | 2 turns |
| `covered` | Covered | Single-target hits are taken by the coverer | until coverer's next turn |
| `shielded` | Shielded | Next hit deals 0 | until hit |
| `big_talk` | Big Talk | Damage dealt +15% | 3 turns |
| `on_the_list` | On the List | Next 3 party actions +15% effect | 3 actions |
| `soft_spot` | Soft Spot | `def` −20% | 2 turns |
| `folded` | Folded | Evades next attack | until attacked |

Brimming and Spill states (6.3) are shown the same way but come only from glass.

### 6.8 Level curve and growth

EXP is given in full to every member. Cumulative EXP to reach a level, and stats as Breath/Arm/Coat/Pace:

| Lv | EXP | `wren` | `odo` | `lin` | `pim` |
|---|---|---|---|---|---|
| 1 | 0 | 46/9/6/8 | 60/10/8/5 | 40/7/6/7 | 32/8/4/12 |
| 2 | 20 | 53/11/7/9 | 69/12/10/5 | 46/8/7/8 | 37/10/5/13 |
| 3 | 50 | 60/13/9/10 | 78/14/12/6 | 52/10/9/9 | 42/12/6/15 |
| 4 | 95 | 67/15/10/11 | 87/16/14/7 | 58/11/10/10 | 47/14/7/16 |
| 5 | 155 | 74/17/12/12 | 96/18/16/7 | 64/13/12/11 | 52/16/8/18 |
| 6 | 230 | 81/19/13/13 | 105/20/18/8 | 70/14/13/12 | 57/18/9/19 |
| 7 | 320 | 88/21/15/14 | 114/22/20/9 | 76/16/15/13 | 62/20/10/21 |
| 8 | 425 | 95/23/16/15 | 123/24/22/9 | 82/17/16/14 | 67/22/11/22 |
| 9 | 545 | 102/25/18/16 | 132/26/24/10 | 88/19/18/15 | 72/24/12/24 |
| 10 | 680 | 109/27/19/17 | 141/28/26/11 | 94/20/19/16 | 77/26/13/25 |

Growth per level (floor of base + growth x (Lv − 1)): Wren +7/+2/+1.5/+1, Odo +9/+2/+2/+0.7, Lin +6/+1.5/+1.5/+1, Pim +5/+2/+1/+1.5. Pim joins at the party's level. Expected level: 3 after Tide 1, 5 after Tide 2, 7 after Tide 3, 8–9 after Tide 4, 9–10 at Nacre.

### 6.9 Skills (24)

Costs: R/B/A/G = raw pieces of that colour; a Tumbled piece pays for 2 of any colour; "T" = one Tumbled piece specifically.

| id | Name | Who | Lv | Cost | Target | Effect | Flavor |
|---|---|---|---|---|---|---|---|
| `rattle` | Rattle | wren | 1 | 1 B | one enemy | Power 1.3; target Rattled | "Shake the can at it. It hates that." |
| `beachcomb` | Beachcomb | wren | 2 | 1 G | self | Gain 1 raw piece of a colour you choose | "There's always one more if you look." |
| `plain_words` | Plain Words | wren | 4 | 1 B + 1 A | one enemy | Fills one revealed, unstarred Line of any colour; cannot be Misheard | "No 'and anyway'." |
| `skimmer` | Skimmer | wren | 6 | 2 G | all enemies | Power 0.9 to all; does not shake Lines loose | "Seven skips. Pop's record is nine." |
| `oi` | Oi! | odo | 1 | free (3-turn cooldown) | all enemies | Enemies' single-target moves aim at Odo for 2 turns | "OI. OVER HERE. Over." |
| `cannonball` | Cannonball | odo | 2 | 2 R | one enemy | Power 2.0 | "Technically a bomb. Pool rules don't apply on the seabed." |
| `chip_shield` | Chip Shield | odo | 3 | 1 A | one ally | Ally Shielded; ally +1 Amber | "The fry scoop has never been cleaner. Or prouder." |
| `big_talk` | Big Talk | odo | 4 | 1 R | party | Big Talk for 3 turns | "We are the BEST at this. Probably. Over." |
| `whistle_blast` | Whistle Blast | odo | 5 | 1 B | one enemy | Power 0.8; cancels a Blurt; priority | "PHEEEP." |
| `salt_and_vinegar` | Salt and Vinegar | odo | 7 | 1 R + 1 G | all enemies | Power 1.1; 30% Soft Spot | "In the eyes. Sorry. Not sorry. Sorry." |
| `plaster` | Plaster | lin | 1 | 1 A | one ally | Heal 35% | "Hold still. I have a system." |
| `red_pen` | Red Pen | lin | 2 | 1 R | one enemy | Power 1.2; removes Riled and any self-buff | "It's 'apologise'. With an S." |
| `spare_tissue` | Spare Tissue | lin | 3 | 1 A | one other ally | Removes that ally's ordinary Pebbles and Tongue-Tied; ally +1 Amber | "I carry six. Take it." |
| `checklist` | Checklist | lin | 5 | 1 G | party | On the List | "Item one: win. Sub-items to follow." |
| `cup_of_tea` | Cup of Tea | lin | 6 | 2 A | party | Heal 25%; removes Rattled and Soft Spot | "I don't even like tea. It's the pouring." |
| `i_need_help` | I Need Help | lin | story (`lin_told`) | T (must be Tumbled) | self | Every other ally at once Confides her their oldest raw piece (does not use the Can Line); Lin heals 50% | "Item one." |
| `paper_cut` | Paper Cut | pim | 1 | 1 G | one enemy | Power 1.1; critical 35%; priority | "Ow for you! Sorry!" |
| `fold` | Fold | pim | 2 | 1 B | self | Folded | "Flat as a bill." |
| `forward_mail` | Forward Mail | pim | 3 | 1 G | two allies | Moves one raw piece from any ally to any other ally; it arrives Tumbled and keeps its original `from`. Does not use the Can Line | "Redirected with love." |
| `read_aloud` | Read Aloud | pim | 5 | 1 G + 1 A | all enemies | Reveals every Line; enemies Rattled (embarrassed) | "'Dear Sir, I am WRITHING to complain—' oh, writing." |
| `special_delivery` | Special Delivery | pim | 7 | T (must be Tumbled) | one enemy | A Say that fills up to two matching Lines of that piece's colour | "Signed for." |

Passive: **Nosy** (Pim's Listen reveals two Lines). The remaining three skills are the Two-Can Calls below.

### 6.10 Party combo: Two-Can Calls

Three combos, each Wren plus one friend, unlocked by story (no bond counters). They appear in Wren's skill list. Cost: **one Tumbled piece from Wren's Pocket and one from the partner's Pocket** (any colours): both must currently be holding something a friend told them. The partner must be standing and not Spilling; the Call uses Wren's action only. Always Out Loud.

| id | Name | Pair | Unlock | Effect | Flavor |
|---|---|---|---|---|---|
| `call_over_and_out` | Over and Out | wren + odo | `odo_told` | Power 2.8 on one enemy using the higher `atk`; Odo covers Wren until his next turn | "Two cans, one string, extremely loud." |
| `call_by_the_book` | By the Book | wren + lin | `lin_told` | Party heals 35%; all ordinary Pebbles and Tongue-Tied removed | "There is a procedure for this. There is now." |
| `call_first_class` | First Class | wren + pim | `pim_knows` | Fills up to two revealed Lines on one enemy, any colours, stars included (not `from`-locked Lines) | "Straight to the front of the queue." |

### 6.11 Enemies

Numbers are Breath/Arm/Coat/Pace. "Lines" lists the colours in order; ★ = Tumbled only. Glass tendency = what the enemy pushes into your Pockets.

| id | Name | Maps | B/A/C/P | Lines (Deliver condition: fill all unless stated) | EXP | Stamps | Drop (Deliver only) |
|---|---|---|---|---|---|---|---|
| `thank_you_card` | Thank-You Card That Waited Too Long | sorting_shallows | 60/9/3/4 | Amber, Green | 5 | 4 | `bag_of_chips` 30% |
| `sorry_crab` | Sorry-Not-Sorry | sorting_shallows, blare_reef | 85/11/6/7 | Red, Blue | 6 | 5 | `glass_red` 25% |
| `reply_all` | Reply-All | blare_reef, slack_water | 150/17/8/10 | Green, Blue, Green | 9 | 8 | `scraps` 30% |
| `toot` | Toot | blare_reef | 180/19/10/6 | Red (shows as Amber until Listened), Blue | 10 | 9 | `glass_blue` 25% |
| `blank_postcard` | Blank Postcard | blare_reef, slack_water | 160/17/9/8 | Two Lines. The first accepts **any** colour; the second then wants the same colour, ★ | 10 | 9 | `glass_green` 25% |
| `listworm` | Listworm | slack_water | 210/20/11/8 | Amber, Amber; grows +Red at round 3 and +★Blue at round 5 | 13 | 11 | `mushy_peas` 30% |
| `overdue_notice` | Overdue Notice | slack_water | 240/19/13/7 | Blue, ★Red, Amber | 14 | 12 | `tide_table_page` 15% |
| `chain_letter` | Chain Letter | slack_water, undertow_light | 200/20/10/11 | Blue, Green, ★Green | 13 | 11 | `glass_amber` 25% |
| `draft_47` | Draft No. 47 | slack_water, undertow_light (optional corners) | 170/18/9/13 | Green, Amber, Blue, reshuffled every round until Listened once | 12 | 14 | `orange_lace` 100% first time |
| `echo` | Echo | undertow_light, memory_rocks | 260/24/13/12 | **No Lines. Delivered by being Listened to three times** (any characters, cumulative). Nothing to fix; it only wanted hearing | 16 | 13 | `flask_of_tea` 30% |
| `static` | Static | undertow_light, pearl_bed | 300/25/15/9 | Three Lines that re-roll each round until Listened **twice**; then fixed (e.g. Blue, ★Amber, Red) | 17 | 14 | `darned_patch` 15% |
| `pearl_drip` | Pearl Drip | pearl_bed | 300/27/16/10 | Amber, ★Blue, ★Red | 18 | 15 | `pickled_egg` 30% |

| id | AI rules | Glass tendency | Visual (for the illustrator) |
|---|---|---|---|
| `thank_you_card` | 70% Flap (power 1.0), 30% "So sorry!" (does nothing, blushes) | none | A wilted folded greeting card standing on its bottom edge, sagging cone party hat, balloon drawing on its front gone grey, mortified dot eyes peeking over the fold, tiny ink hands wringing |
| `sorry_crab` | Scuttles: every second turn sidesteps (evasion +30% that turn); else Pinch 1.0. Mutters "it's not FAIR" | none | A crumpled lined-paper apology note scrunched into a crab: two folded-corner claws, stalk eyes, the word "sorry" crossed out on its shell, walking sideways, scowling |
| `reply_all` | "Reply to all" 0.6 to the whole party 60%; Peck 1.0 40%. If Struck, next turn is always Reply to all and it is Riled | Hit characters gain Red instead of Blue | Six identical small grey-white gulls made of folded office memos flying as one overlapping clump, each with a paperclip beak, all looking in different directions, one apologising |
| `toot` | Bellows "I'M FINE" (power 1.2) 60%; "Blare" 40%: target Tongue-Tied | none | A striped paper party horn, unrolled and rigid, with a wide forced grin at the bell end, tiny sweating brow, rosette pinned on reading nothing, stubby legs |
| `blank_postcard` | Mirrors: uses the colour the party holds most: Red → hit 1.3; Blue → target Rattled; Amber → heals itself 15%; Green → evades next hit | Copies | A seaside postcard standing upright, picture side a faded beach, message side empty except a printed greeting line drawn as a squiggle, one corner dog-eared like a fringe, shy eyes on the stamp box |
| `listworm` | Nibble 1.0; every other turn "Add an item": target gains 1 raw Amber and is told off | Stuffs Amber (toward Cling) | An inchworm made of a long paper to-do list folded in loops, ticked boxes as spots down its back, pencil-stub horns, anxious busy face, its tail still unrolling |
| `overdue_notice` | Stamp 1.1. `atk` +3 for every round in which nobody targeted it (max +9); resets when Listened to | none | A stern pink library slip standing like a little bailiff, big rubber date-stamp for a hammer, half-moon spectacles, red ink splats |
| `chain_letter` | Constrict 1.0 and target gains 2 raw Blue; at 3 Blue on a target prefers that target | Stuffs Blue (toward Freeze Up) | A sea-snake made of linked paper-chain loops in school-craft colours, each loop with a scribbled line, forked paper tongue, dramatic doom-laden eyebrows |
| `draft_47` | Crosses itself out: heals 10% and reshuffles; Paper Cut 1.1 | none | A blushing sheet of notepaper covered in scribbled-out lines, holding its own pencil, eraser crumbs flying, heart doodles hastily scratched over |
| `echo` | Repeats: copies the power of the last damaging action used on it, against that attacker (minimum 0.8). If nobody damaged it, it only murmurs | none | A translucent pale-teal jellyfish whose bell is the shape of a speech bubble, trailing tentacles like dotted ellipses, faint repeated outline as if drawn three times slightly offset, small listening face |
| `static` | Crackle 0.7 to all; "Half a sentence": target Tongue-Tied | Hit characters gain Green (curiosity) | A rounded 1950s valve radio on four stubby legs, glowing amber dial for an eye, cloth speaker mouth leaking scribbled pencil static, bent aerial, barnacles on one side |
| `pearl_drip` | "Coat": power 0.8 and target gains a Pebble (if under cap); Blob 1.1 | Pebbles | A slow, glossy teardrop blob of pearl-white lacquer with soft rainbow sheen, half-set drips, a polite closed-eye smile, a corner of an envelope visible trapped inside it |

**Named Unsent (the price of Keeping).** If `segN_kept` > 0 when Tide N begins, one named Unsent roams that Tide's zone (and stays until dealt with, including in a cleared save). They are **tint variants of existing art** (no new images), with the base enemy's AI, Breath x1.3, and **every Line starred**: a thing said late has to go through a friend first. Delivered: `true_words` += `segN_kept`, the matching `skN_said` flags are set, `segN_kept` = 0, the Story Pebble goes, and Wren says the Kept line at last, to whoever is there. Hushed: no Pebble, no repeat EXP, and it re-forms when the map is re-entered ("You can't hush your own for long."). No extra loot either way: Keeping is never the rewarding route.

| id | Name | Base / tint | Zone | Lines |
|---|---|---|---|---|
| `kept_shrug` | The Shrug | `sorry_crab`, grey-blue | sorting_shallows | ★Blue, ★Amber |
| `kept_never_mind` | Never Mind | `reply_all`, sepia | blare_reef | ★Red, ★Amber |
| `kept_later` | Later | `listworm`, violet | slack_water | ★Amber, ★Blue, ★Green |
| `kept_ask_her` | Ask Her Yourself | `echo`, rose | undertow_light | ★Amber, ★Amber |
| `kept_dot_dot_dot` | ... | `pearl_drip`, charcoal | pearl_bed | ★Red, ★Blue |

### 6.12 Bosses and the final encounter

**`boss_postmaster_gull` — Postmaster Gull** (Tide 1). 420/15/8/9, two actions per round. EXP 30, Stamps 40. Lines: ★Blue, ★Red, ★Amber, ★Green ("No return address, no service": he takes nothing that has not been through a friend). Visual: a large, barrel-chested herring gull in a navy postmaster's cap and a sash of rubber stamps, reading glasses on a chain, a rule book under one wing, a picket sign reading only a squiggle under the other.
- Phase 1: Peck 1.0; "Red Tape": target Tongue-Tied. Line: "Form 12-B. In triplicate. You don't HAVE a 12-B."
- Phase 2 (below 50% Breath or two Lines filled): "SQUAWK" 0.7 to all; telegraphs the Blurt **Walkout** (power 1.8 to all next turn unless Listened to or Whistle Blasted). Line: "EVERYBODY OUT! ...That's me. I'm everybody."
- Delivered: "Dear Sirs, I resign, effective— ...forty years ago. Hm. Turns out I like it here."

**`boss_perfectly_fine` — Perfectly Fine** (Tide 3). 1000/24/14/8, two actions. EXP 60, Stamps 70. Lines: Amber, Blue, Green, ★Red, ★Red. Visual: a teetering tower of crisply ironed, folded laundry and tablecloths twice the children's height, a flat-iron for one hand and a feather duster for the other, topped with a smiling paper-plate mask on a stick; hairline cracks in the mask; steam curling out between the layers.
- Phase 1: Press 1.2; "Fold Away": target gains 2 raw Amber; "I'm Fine!": own `def` +30% for 3 turns (Red Pen removes it). Line: "No trouble at all! None! Look how flat everything is!"
- Phase 2 (below 50% or three Lines filled): "Everything Is Fine" 0.8 to all; telegraphs the Blurt **Starch** (whole party Tongue-Tied 2 turns). The mask cracks with each Red Line; at the second it falls and there is only a tired heap of washing. Line: "...Could somebody else do the ironing? Just once?"

**`boss_nacre` — Nacre, Keeper of the Lull** (Tide 5). 1800/29/18/6, two actions. EXP 90. Lines: ★Blue, ★Red, ★Amber, ★Green, then two personal Lines: ★any colour, **Said by Wren only** (she has to be holding something a friend told her, twice). Visual: a house-sized giant clam, shell ridged like a pale pink-and-cream scallop crusted with generations of pearl-coated envelopes and barnacles, open a hand's width; inside, soft darkness, a glow, and a slot between the shell-lips from which small printed paper slips slide; no eyes, no teeth; it must read as gentle, enormous and patient, never as a monster.
- Phase 1: "Coat" 0.8 + Pebble; "Lull" 0.7 to all and everyone gains 1 raw Blue; telegraphs the Blurt **Return to Sender** (the Can Line is jammed next round) — Listen cancels. Slips: "THERE IS NO NEED FOR ALL THIS." / "YOU WILL ONLY UPSET YOURSELVES."
- Phase 2 (below 50% or three Lines filled): the shell half closes. Each round end it regains 25 Breath and **re-coats** (empties) its most recently filled ordinary Line unless somebody Listened to it that round. Slips: "I HAVE KEPT THIS TOWN COMFORTABLE FOR TWO HUNDRED YEARS." / "PLEASE. I DO NOT KNOW WHAT HAPPENS IF I OPEN."
- Both outcomes lead on (5.7). Nacre is never mocked, and is thanked if Delivered.

**`other_can` — The Other Can** (finale; image `en_other_can`). No Breath, cannot be damaged (Strike and damage skills are greyed with the note "It's only a can."), never attacks. Visual: a dented tin can lying on its side on a windowsill, a taut white string leading off into darkness, the can trembling with small motion lines, a faint warm amber glow inside it.
- A clock in the message strip runs from 9:00 to 10:00 in five-minute steps: **12 rounds**. Each round start the can rings ("Wren? Are you awake? Over."), Wren gains **2 raw Blue**, and everyone loses 6% Breath (holding it).
- Lines, in any order except the last: ★Red `from` Odo, ★Amber `from` Lin, ★Green `from` Pim, Blue (Wren's own, raw allowed), and last ★any. **Only Wren can Say.** Friends can Confide, Forward Mail, Brace, heal, or use **Hold the String** (replaces Strike: Wren takes no Blue from the next ring).
- The tension is the flood: three Blue a round will Freeze her unless she is holding something Tumbled, and she has to spend those very pieces to fill the Lines. The Can Line is shared, so every round is a choice between a friend reaching her and Wren handing her Worry out.
- Timeout is not a game over (5.7).

### 6.13 Troops

| id | Members | Where |
|---|---|---|
| `troop_tutorial_card` | thank_you_card | sorting_shallows, scripted tutorial |
| `troop_card_crab` | thank_you_card, sorry_crab | sorting_shallows roamers (x2) |
| `troop_crab_pair` | sorry_crab x2 | sorting_shallows roamers (x2) |
| `troop_gull` | boss_postmaster_gull | sorting_shallows boss |
| `troop_reply_toot` | reply_all, toot | blare_reef roamers (x2) |
| `troop_toot_crab` | toot, sorry_crab x2 | blare_reef roamer |
| `troop_blank_reply` | blank_postcard, reply_all | blare_reef roamer, slack_water roamer |
| `troop_big_noise` | toot, reply_all, toot | blare_reef set piece (no escape) |
| `troop_listworm_overdue` | listworm, overdue_notice | slack_water roamers (x2) |
| `troop_chain_listworm` | chain_letter, listworm | slack_water roamer |
| `troop_draft` | draft_47, blank_postcard | slack_water and undertow_light optional corner |
| `troop_fine` | boss_perfectly_fine | slack_water boss |
| `troop_echo_static` | echo, static | undertow_light roamers (x2) |
| `troop_echo_chain` | echo, chain_letter | undertow_light roamers (x2) |
| `troop_three_words` | echo x3 | memory_rocks, scripted (5.6) |
| `troop_drip_pair` | pearl_drip x2 | pearl_bed roamers (x2) |
| `troop_drip_static` | pearl_drip, static | pearl_bed roamer |
| `troop_nacre` | boss_nacre | pearl_bed boss |
| `troop_other_can` | other_can | finale |
| `troop_kept_1` … `troop_kept_5` | kept_shrug / kept_never_mind / kept_later / kept_ask_her / kept_dot_dot_dot | one per zone, conditional |

### 6.14 Paper simulations (numbers were adjusted to these)

**A. Level 1, `troop_card_crab`** (145 Breath total; party Strikes 15/17/11/13 vs the card, 12/14/8/10 vs the crab). *Strike only:* about 50 a round: card down in round 2, crab in round 3; about 66 damage taken (37% of the party's 178 Breath) and the finisher pockets a Pebble or two. *Deliver:* round 1 Pim Listens to the card (both Lines), Wren Listens to the crab, Lin Says Amber, Odo Says Red; round 2 Pim Says Green (card Delivered), Wren Says Blue (crab Delivered). **2 rounds, about 44 damage taken, full Stamps.** Expected: 2–3 rounds.

**B. Level 6, `troop_listworm_overdue`** (450 Breath; Strikes 26/28/16/24). *Strike only:* 94 a round on paper, about 73 after Spill downtime; **6–7 rounds**, taking about 65 a round (Sharp +15% on average, the Overdue Notice ramping): roughly 400 damage against 313 Breath, so two or three healing items and probably a Winded friend. *Engaged Hush:* Cannonball Out Loud (84) alternating with raw Cannonball (56), Rattle 34 with `atk` −20%, Paper Cut 31, Lin healing: about 145 a round, **4 rounds**, about 100 net damage. *Deliver:* needs three Amber and one ★Red: round 1 Pim Listens to the Notice, Wren Says Blue, Lin Says Amber to the worm, Odo Confides Red to Wren and Braces Lin (+Amber); round 2 Pim Listens to the worm, Wren Says the Tumbled Red (Notice Soothed), Lin Says Amber (worm Delivered before it grows), Odo Braces Lin again; round 3 Lin Says Amber. **3 rounds, about 90 damage.**

**C. Level 9, `boss_nacre`** (1800 Breath; Strikes 32/34/20/30 = 116). *Strike only:* about 90 a round, then 65 after the phase 2 regeneration: **24+ rounds** at roughly 100 incoming a round; not realistically survivable, by design, and the Gull has already taught why. *Skills without Confiding:* about 142 a round, **14–15 rounds**, around six healing items. *Engaged Hush:* one Tumbled piece a round plus starting Tumbled glass keeps Cannonball and Over and Out firing Out Loud under Big Talk: 175–190 a round, **11–12 rounds**; Lin's Plaster and Cup of Tea cover about 65 of the 90 incoming. *Deliver:* six Tumbled pieces are needed; Can Line (1 a round) + Forward Mail + I Need Help give about two a round; each Tumbled Say Soothes one of Nacre's two actions; phase 2 needs one Listen a round: **8–10 rounds**, the least damage of any route.

**D. The Other Can:** a player who routes Pim's Green first, holds it as an anchor, and uses Forward Mail for Odo's Red finishes in **6–8 of 12 rounds**; one accidental Freeze Up costs about two rounds and is rescued by any friend's Confide.

---

## 7. Items, currency, shops

Currency: **Stamps** (icon: a small blue lighthouse stamp). Expected income: about 100 by the end of Tide 1, about 450 over the whole game. Each character has **one Keepsake slot** (the only equipment). Healing items work in and out of battle.

| id | Name | Type | Effect | Price | Found | Flavor |
|---|---|---|---|---|---|---|
| `bag_of_chips` | Bag of Chips | consumable | Heal 40 Breath | 8 | Chippy, Shelley, drops | "Hot, salty, slightly too many." |
| `mushy_peas` | Mushy Peas | consumable | Heal 90 Breath | 18 | Chippy, drops | "Green. Warm. Asks no questions." |
| `pickled_egg` | Pickled Egg | consumable | Heal 150 Breath; user gains 1 raw Blue | 25 | Chippy, Mr Brill's gifts, drops | "Restores Breath. Nobody is happy about it." |
| `scraps` | Scraps | consumable | Heal whole party 25% | 30 | Chippy, drops | "The crunchy bits from the bottom of the fryer. Free if you ask nicely. You never ask." |
| `flask_of_tea` | Flask of Tea | consumable | Used on **someone else**: heal 30 Breath, remove their ordinary Pebbles and Tongue-Tied | 20 | Chippy, Shelley, drops | "You can't pour your own. Well, you can. It's not the same." |
| `stick_of_rock` | Stick of Rock | consumable | A Winded ally stands up with 50% Breath | 35 | Chippy, Shelley | "It says PELLOW'S REACH all the way through. So do we, probably." |
| `glass_red` | Red Chip | consumable | User gains 1 raw Red | 12 | Shelley, drops, rub spots | "Bit of an old brake light. Still cross about it." |
| `glass_blue` | Blue Chip | consumable | User gains 1 raw Blue | 12 | Shelley, drops, rub spots | "Medicine bottle. Worried for a living." |
| `glass_amber` | Amber Chip | consumable | User gains 1 raw Amber | 12 | Shelley, drops, rub spots | "Beer bottle, Pop says. 'Somebody had a nice evening.'" |
| `glass_green` | Green Chip | consumable | User gains 1 raw Green | 12 | Shelley, drops, rub spots | "Well I never." |
| `tide_table_page` | Tide Table Page | keepsake | Pace +3 | 50 | Shelley; Overdue Notice drop | "Lin's spare. Laminated." |
| `darned_patch` | Darned Elbow Patch | keepsake | Coat +3 | 60 | Shelley; Static drop | "Pop mends everything except the subject." |
| `orange_lace` | Orange Lace | keepsake | The wearer's first Confide each battle does not use up the Can Line | — | Draft No. 47, first Delivery | "Odo's spare. It doesn't match. That's the point." |
| `egg_medal` | Medal for Valour in the Face of Egg | keepsake | Max Breath +15 | — | Accept Mr Brill's egg at three different tides (`egg_offers` ≥ 3); Odo awards it | "Cardboard. Extremely official." |
| `doing_fine_token` | "You're Doing Fine" Token | keepsake | Wearer starts each battle with 1 Tumbled Amber | — | Compliment vending machine, `slack_water` | "It only says one thing. It's the right thing." |
| `second_class_stamp` | Second-Class Stamp | keepsake | Wearer's Listen reveals one extra Line | — | Talk to Stan in all five tides (`stan_talks` = 5) | "Gets there in the end." |
| `gull_feather` | Postmaster's Feather | keepsake | Wearer is immune to Tongue-Tied | — | Deliver Postmaster Gull | "Regulation grey. Slightly on strike." |
| `pearl_button` | Pearl Button | keepsake | Wearer cannot receive Pebbles from enemy moves | — | Rub six pearls in `pearl_bed` (`rub_count` ≥ 6) | "Pretty. Hard. Means nothing. Useful, though." |

Key items (not counted above): `nacres_slips` (re-readable; each slip drawn with its coloured border), `tams_postcard` (if sk6 was Said). The menu entry **Coat Pocket** is not an item; it is a line of text that changes (9.2).

**Shops.** Brill's Chippy (`brills_chippy`, Shore, `['shop',[...]]`): `bag_of_chips`, `mushy_peas`, `pickled_egg`, `scraps`, `flask_of_tea`, `stick_of_rock`. Shelley's Postbox (`tide_steps`): `glass_red`, `glass_blue`, `glass_amber`, `glass_green`, `bag_of_chips`, `flask_of_tea`, `stick_of_rock`, `tide_table_page`, `darned_patch`. Shelley: "No refunds. No returns. That's the whole problem with this place, if you think about it."

---

## 8. Exploration

All puzzles use only the commands, flags and vars of TECH_SPEC 4.4. Small custom needs are listed in 8.7.

### 8.1 Sorting (Sorting Shallows)

Six `letter_pile` events, each a readable stray letter; four `pigeonhole_bin` events tinted red, blue, amber and green. Vars: `sort_carry` (0 = empty hands, 1–6 = letter held), `sort_count`. Flags `sort_l1_taken` … `sort_l6_taken` hide a pile while its letter is held or posted.

| # | Text | Colour |
|---|---|---|
| 1 | "I was so CROSS I wrote this in capitals and then didn't post it." | Red |
| 2 | "I keep checking the back door is locked. It always is. I check anyway." | Blue |
| 3 | "You make the best toast. I have never said." | Amber |
| 4 | "There was a seal on the slipway this morning!! An actual SEAL!!" | Green |
| 5 | "If the boat's late again I don't know what I'll do." | Blue |
| 6 | "Your mother would have been proud of that, you know." | Amber |

Pile: `if sort_carry == 0` → `say` the text, set `sort_carry`, set its `taken` flag. Bin: `if` the held letter's colour matches → `sort_count` +1, `sort_carry` = 0, `sfx_talk_success`; else → clear the `taken` flag (the letter hops back), `sort_carry` = 0, `sfx_error`, **P:** "Misfiled! It's gone home in a huff." At `sort_count` == 6 → `sort_done`; the pigeonhole gate event erases. This is the colour language of every Line in the game.

### 8.2 Horn Pipes (Blare Reef)

Four `horn_pipe` joints, vars `pipe_a` … `pipe_d`, each 0 (points left) or 1 (points right), toggled by `action` (`sfx_switch`). Beside each joint a `horn_coral_small` leans the way the sound wants to go (placed with or without `flipX`); **L:** "Sound follows the lean. Obviously." Solution: a=1, b=0, c=0, d=1. At the mouth horn, Odo whispers; the script counts wrong joints into `pipes_wrong` and the far horn booms: 4 wrong "WEIRD MUFFIN.", 3 "WE'RE MOOING.", 2 "DEER MOVING.", 1 "WE'RE... MUFFING?". 0 wrong → the scene in 5.4 and `pipes_solved`.

### 8.3 The Four Clocks (Slack Water)

Four `sunk_clock` events, vars `clock_1` … `clock_4`, each cycling 0 HIGH, 1 EBB, 2 LOW, 3 FLOOD. Lin's tide table (she reads it out; it is also in the Pockets menu under Lin) gives LOW, HIGH, FLOOD, EBB = 2, 0, 3, 1. Each door's event recomputes `clocks_right` (four `if`s). Door ON TIME opens at 4 and transfers back to the map start (a loop; the third time Odo says "I've SEEN that in-tray. Over."). Door LATE ("LATE — please be on time") opens only at exactly 3 → `late_door_open`. At 2 or fewer: "One mistake is human. This is just mess."

### 8.4 String Line (The Undertow Light)

The middle room is dark (`['tint',[0,0,30,0.65],30]`), lit only near the `lamp_lens`. Wren takes the string end from the hatch (`string_held`). Four `can_post` events each hum a colour when inspected (a soft `flash` in that colour). A radio by the door murmurs Pop's rhyme with the endings eaten by static: "Red for —, blue for —, amber for —, green for —". Hook the posts in the rhyme's order: Red, Blue, Amber, Green. Var `string_step` 0–4; a wrong post sets it to 0 (`sfx_error`; **O:** "Slack line! Over."). Each correct post plays `sfx_can_rattle` and a friend says the rhyme's missing word down the line ("...cross." "...fretting." "...fond." "...well-I-never."). At 4 → `string_done`, the tint lifts, the radios all tune to Tam's voice, the bottom hatch opens.

### 8.5 Pearl Doors (The Pearl Bed)

Four `stamp_flower` events (tint variants red, blue, amber, green), the only living colour left in the bed, stand before a sealed pearl wall. Press them in the order of the **border colours of Nacre's four slips as received**: Blue, Amber, Red, Green (re-readable in `nacres_slips`). Var `pearl_seq` 0–4, wrong press resets. At 4 → `pearl_doors_open`. **P:** "It told us the way in itself. Very polite of it. Rather sad, actually."

### 8.6 Rubbing, collectibles and side content

- **Rub** (the Pearl Bed's exploration verb): eight `pearl_small` spots. Interact: `sfx_erase`, a short wait, and the coating rubs away like pencil frottage to show the scrap beneath ("—I never told him I was proud—", "—sorry about the wedding—") plus a Chip item; `rub_count` +1; at 6, `pearl_button`. Rubbing shows what is under the pearl; it never destroys the pearl. Helping is not fixing.
- **Delivered Mail album** (20 entries: 12 regular, 5 named, 3 bosses): a two-line letter per Delivered type, e.g. Thank-You Card: "Dear Auntie Bren, thank you for the jumper. I was nine. I am thirty-one. It still fits my heart, if not my arms." Sorry-Not-Sorry: "Dear Col, I'm sorry about the fence. I'm sorrier I spent six years being right about it." Toot: "To whom it may concern: I was not fine at the party. The cake was lovely." Echo: "(nothing was written. Somebody just needed to say it to someone.)" Listworm: "Item 1: rest. (Carried over from last week. And the week before.)" Hushed types show a grey pebble and "It went quiet."
- **Second-Class Stan** moves one zone further each tide (`stan_talks`): "Nearly there." x4, then arrives in `pearl_bed`. His parcel is addressed "To whoever is resting here" and he hands it to the party at the rock pool.
- **Secret benches** (`bench_lull`, `bench_1` in `tide_steps` behind the postbox, `bench_2` in `slack_water`): the party sit; four unprompted lines; nothing else happens. Bench 1: **O:** "Medal for sitting. Awarded to: everyone. Over." **L:** "We have six minutes." **P:** "I've never sat. It's just standing, but lower!" `think`: "This is all right."
- **The pickled egg gag**, the **vending machine**, the **striking gulls** (each placard inspection gives a different SQUAWK footnote), and deadpan prop inspections everywhere (section 3, Wren's voice).

### 8.7 Custom commands and data hooks (complete list)

| Name | Use |
|---|---|
| `['custom','ghost_choice',{options:[{text,ghost:true|false},...],varName}]` | Choice box whose ghost options are drawn grey and skipped by the cursor. Used for the slip, the rocks, and "Send him." No timer: the game waits |
| `['custom','letter_compose',{}]` | Ending A: lists the True Words whose `skN_said` is set; the player places three under "Dear Tam,"; stores `letter_1..3`; shows the finished letter |
| `['custom','rock_pool',{}]` | Save-point menu: Save / Skim / Rest (8.8) |
| Troop `rules` field | `{noEscape, noHush, forcedSpill:{actor:'wren',colour:'blue',noTimeout:true}, roundLimit:12, onlySayer:'wren'}` for `troop_three_words` and `troop_other_can` |
| `setSprite` honouring `flipX` | Only for the horn joints; fallback is a `narrate` "The joint now points left." |

True Words (the phrases sk1–sk9 put in the picker): 1 "I'm not all right about it." 2 "You were my best friend." 3 "I saw you were sad and I looked away." 4 "Thank you." 5 "I kept the string up." 6 "I read every postcard." 7 "I should have helped you pack." 8 "I'm still your friend. If you want." 9 "I didn't mean it. I'm sorry."

### 8.8 Save points

- **Lull: rock pools** (`rock_pool`, one in every Lull map except `memory_rocks`). Menu: **Save**; **Skim** (a friend skims the ordinary Pebbles out of everyone's Pockets; one confession line plays); **Rest** (full Breath). Each pool has a one-line joke on first use ("A limpet watches you save. It has seen things.").
- **Shore: Wren's bed** (`bed` in `wren_house`): Save only. "Under the bed: a jar. Not now."
- Autosave on entering each Tide and before each boss.

### 8.9 Roaming-enemy policy

No random encounters. Every Unsent is visible on the map as its battle illustration scaled to about 56 px with a bob. Four or five per zone (see 6.13), `move:{type:'chase',sight:4}` at a speed slightly below walking so that running always escapes; two per zone sit in optional corners guarding a Chip item or a rub spot. `respawn:false` for all ordinary roamers, so the level curve is predictable and a zone stays peaceful once cleared; named Unsent follow 6.11. Nothing roams on the Shore, in `tide_steps` or in `memory_rocks`.

---

## 9. UI and UX

Everything is cream paper, dark wobbly pencil outline (`G.Gfx.panel`), PatrickHand for body text and GochiHand for titles and big feelings. UI motifs are **luggage tags, string and sand**, never hearts, film strips or corner portrait frames.

### 9.1 Dialogue

- Message box per TECH_SPEC (736x156 at y 404), portrait 128x128 on the left when the speaker has faces. The **name tag is a luggage tag** tied to the top-left corner of the box by a short string, tinted per speaker: `wren` teal `#3a8c86`, `odo` orange `#e8843a`, `lin` moss `#6f8f4a`, `pim` stamp blue `#7fb2d9`, `pop` oatmeal `#b79c6e`, `mum` lilac `#a58bc4`, `mr_brill` red `#c9524a`, `robin` yellow `#e6c245`, `tam` daisy yellow `#e9cf5a` (name shown as `???` until `truth_known`), others grey `#8a8a8a`.
- Blips: `wren` `sfx_blip_low`, `odo` `sfx_blip_mid`, `lin` `sfx_blip_high`, `pim` `sfx_blip_odd`, adults `sfx_blip_mid`, narration `sfx_blip_narrator`; Tam's can-voice uses `sfx_static` under `sfx_blip_high`.
- `think` boxes: dim grey-blue paper, no tag, lower-case feel. `narrate`: centred italic strip.
- **Nacre's slips**: no box; a narrow white paper slip (360x72) slides in from the top of the screen with `sfx_page`, text in GochiHand capitals, a thin coloured border (blue, amber, red, green by tide; pearl-white in Tide 5). Speaker id `nacre` with style `slip`.
- Say it / Keep it choices: two tags; "Say it" text is in ink, the Keep option is pre-selected and also bound to `cancel`. After a Keep, a small grey pebble icon drops into the corner of the screen for a second. No text judges the player.

### 9.2 Pause menu

Opens as the inside of Wren's open coat: a column of seven tags on the left (x 24–250), content pane on the right.

1. **Pockets** (status): the four members in a row with level, Breath, Arm, Coat, Pace, EXP to next, current Pebbles, Keepsake; Lin's page also shows the tide table (8.3).
2. **Skills**: per member; cost drawn as glass pips; Two-Can Calls show both faces.
3. **Items**: list with icons; use on a member.
4. **Keepsakes**: one slot per member; stat change preview.
5. **Delivered Mail**: album grid; known Lines per enemy type.
6. **Coat Pocket**: a single line of text. "Nothing I want to look at." → after `pim_knows`: "Pim. I know." → Ending B: "Not yet. But soon." → Ending A: "Empty. Good." → Ending C: blank.
7. **Options**: music, sound and text-speed sliders, paper grain on/off, screen shake on/off, key help.

Saving is only at save points (8.8): three slots drawn as postcards showing location name, tide number, play time and party levels.

### 9.3 Battle HUD

As laid out in 6.1. Additional rules: glass pips animate into hollows with `sfx_glass_clink`; a Confide plays `sfx_glass_tumble`; the rattling-Pocket warning shakes the five hollows; enemy mutterings cycle in the message strip every round as Line clues; damage numbers are hand-lettered and boil; the result screen is a single strip ("Delivered 1 · Hushed 1 · 19 EXP · 13 Stamps") followed by level-up tags.

### 9.4 Title screen

`cg_tide_steps` full-screen with slow boil; the logo LOW TIDE LETTERS lettered in GochiHand (or `ui_logo`, T3) at the top left, its two T's joined by a drawn string with a can at each end. Menu as four tags hanging from the string on the right: New Game, Continue, Options, About this game (the content note from section 1). `bgm_title`. "Press any key" first, to unlock audio.

---

## 10. Art direction

### 10.1 STYLE BLOCK (paste at the start of every image prompt)

> Hand-drawn children's storybook illustration in coloured pencil and ink on warm cream paper. Wobbly, slightly uneven dark sepia-charcoal outlines as if drawn by a careful twelve-year-old with a soft pencil; visible pencil hatching and crayon grain inside every shape; soft pastel colours with one or two saturated accents; flat, gentle lighting with no cast shadows; simple rounded shapes, dot eyes, rosy crayon cheeks on living things; a seaside world of sea-glass, tin cans, string, envelopes, stamps, shells and tide-worn wood. Tender, funny, a little lonely. Nothing scary, nothing glossy, nothing digital-looking.

Every prompt ends with: `Avoid: text, letters, numbers, labels, watermarks, grid lines, borders, frames, extra objects, cast shadows, photorealism, 3D rendering, gradients, anime style.` Signs and letters inside the art carry squiggles, never readable writing; real words are drawn by the engine.

### 10.2 Palettes

| World | Paper / line | Main colours | Accent |
|---|---|---|---|
| The Shore | cream `#f3ead8`, graphite line `#4a4640` | fog grey-blue `#9fb0b8`, shingle `#b9b1a2`, slate `#6d7780`, washed grass `#a9b79a` | only three things keep their colour: Wren's teal coat `#3a8c86`, Odo's orange vest `#e8843a`, the red postbox `#c9524a` |
| The Lull (bright zones) | cream `#f7efdc`, sepia line `#3d2f2a` | turquoise `#6fcfc4`, sand `#f2dfae`, coral pink `#f29c9c`, envelope cream `#efe3c2`, stamp blue `#7fb2d9` | the four glass colours: red `#d9534a`, blue `#4a86c9`, amber `#e0a030`, green `#58a868` |
| Slack Water | ledger cream `#eee6cf`, line `#3d2f2a` | pale ledger green `#bcd0b4`, ruled-line blue `#8aa3c2`, mirror grey `#cfd6d8` | red ink `#c9524a` |
| The Undertow Light | deep teal paper `#173a40`, line `#0e2226` | teal `#2a6268`, lamp amber `#e6b04a`, radio-dial orange `#d98a3a` | can-string white `#f4f1e6` |
| Memory | cream, sepia line | sepia wash `#c9a36a` over Shore colours | daisy yellow `#e9cf5a` (Tam's wellies) |
| The Pearl Bed | pearl white `#f1eef0`, soft grey line `#6b6470` | shell pink `#ecd3d6`, lilac `#d6cfe6`, faint rainbow sheen | no saturated colour at all except the party and four stamp-flowers |

### 10.3 Asset list with tiers

Counts: **T1 = 32, T2 = 18, T3 = 10, total 60 generated images.** Tint variants, the paper grain, cursors and tags are made by the pipeline or drawn in code and cost nothing.

**Walk sheets** (`char_<id>`, 3x4, one image each)

| id | Tier | Notes |
|---|---|---|
| `char_wren`, `char_odo`, `char_lin`, `char_pim` | T1 | As section 3.1. Tiny Wren (prologue) and eleven-year-old Wren (`memory_rocks`) are `char_wren` drawn at 0.75 and 0.92 scale. The `up` stand frame is also the battle figure, so backs must be characterful: Wren's peg ponytail and can, Odo's vest buckles, Lin's plait, Pim's torn corner |
| `char_pop` | T1 | Section 3.2 |
| `char_mum`, `char_mr_brill`, `char_towns_a`, `char_towns_b` | T2 | Section 3.2 |
| `char_robin` | T3 | Fallback: Robin speaks from behind Lin (no sprite) |

Creature NPCs are props with a bob (`snail_stan`, `gull_picket`, Shelley inside `postbox_shelley`); Postmaster Gull in the hub reuses `en_boss_postmaster_gull` as a map sprite.

**Portrait sheets** (2x3 grids, sliced to `face_<speaker>_<expr>`)

| Sheet | Tier | Files |
|---|---|---|
| `sheet_face_wren` | T1 | `face_wren_neutral`, `_shrug`, `_small_smile`, `_startled`, `_frozen`, `_crying_smile` |
| `sheet_face_odo` | T1 | `face_odo_neutral`, `_boast`, `_grin`, `_scared`, `_quiet`, `_teary_grin` |
| `sheet_face_lin` | T1 | `face_lin_neutral`, `_stern`, `_fond`, `_tired`, `_angry`, `_relieved` |
| `sheet_face_pim` | T1 | `face_pim_neutral`, `_delighted`, `_nosy`, `_puzzled`, `_blurt`, `_brave` |
| `sheet_face_pop` | T2 | `face_pop_neutral`, `_twinkle`, `_concerned`, `_whistling` |
| `sheet_face_grownups` | T2 | top row `face_mum_neutral`, `_soft`, `_worried`; bottom row `face_mr_brill_neutral`, `_booming`, `_flat` |

Fallback for a missing T2 sheet: that speaker talks with a name tag only.

**Enemies** (`en_<id>`, one image each; visual descriptions in 6.11 and 6.12)

| Tier | ids |
|---|---|
| T1 (11) | `en_thank_you_card`, `en_sorry_crab`, `en_reply_all`, `en_toot`, `en_listworm`, `en_echo`, `en_pearl_drip`, `en_boss_postmaster_gull`, `en_boss_perfectly_fine`, `en_boss_nacre`, `en_other_can` |
| T2 (4) | `en_blank_postcard`, `en_overdue_notice`, `en_chain_letter`, `en_static` |
| T3 (1) | `en_draft_47` |
| Free tints | `en_kept_shrug`, `en_kept_never_mind`, `en_kept_later`, `en_kept_ask_her`, `en_kept_dot_dot_dot` |

**Terrain swatch sheets** (3x3 swatches; each becomes a seamless `ter_<id>`)

| Sheet | Tier | Swatches (passable?) |
|---|---|---|
| `sheet_ter_shore` | T1 | `ter_cobbles` (yes), `ter_grass_verge` (yes), `ter_shingle` (yes), `ter_wet_sand` (yes), `ter_rock` (yes; flat tidal rock), `ter_cliff` (no), `ter_sea` (no), `ter_floorboards` (yes), `ter_wall_plaster` (no) |
| `sheet_ter_lull` | T1 | `ter_pale_sand` (yes), `ter_shallows` (yes, `sfx_step_water`), `ter_envelope_paper` (yes), `ter_deep_water` (no), `ter_reef_rock` (no), `ter_coral_floor` (yes), `ter_ledger_paper` (yes), `ter_mirror_water` (no), `ter_stair_stone` (yes) |
| `sheet_ter_deep` | T2 | `ter_spiral_stone` (yes), `ter_dark_boards` (yes), `ter_light_wall` (no), `ter_fog` (yes), `ter_ink_dark` (no), `ter_pearl_floor` (yes), `ter_nacre_wall` (no), `ter_lino_check` (yes). Fallbacks in `terrains.js` when the sheet is missing: spiral_stone → stair_stone, dark_boards → floorboards, light_wall and nacre_wall → reef_rock, fog and pearl_floor → pale_sand, ink_dark → deep_water, lino_check → floorboards |

**Prop sheets** (up to 9 props; "w" = width in tiles; `fp` = `[dx,dy,w,h]`; even-width props use `ox:24` so they sit on the grid)

| Sheet | Tier | Props |
|---|---|---|
| `sheet_obj_shore` | T1 | `obj_house_terrace` (4w, fp [-1,-1,4,2], solid; slate roof, one lit window, a can on a sill), `obj_house_tolet` (4w, same fp, solid; dark windows, a blank agent's board), `obj_chippy_front` (4w, same fp, solid; striped awning, steamed window), `obj_postbox` (1w, solid; the reddest thing on the Shore), `obj_lobster_pots` (2w, fp [0,0,2,1], solid), `obj_bench` (2w, fp [0,0,2,1], solid), `obj_groyne` (3w, fp [-1,0,3,1], solid), `obj_boat_upturned` (3w, fp [-1,0,3,1], solid), `obj_lighthouse` (3w, about 6 tiles tall, fp [-1,-1,3,2], solid; white with one teal band, small oil-store door at its foot) |
| `sheet_obj_home` | T1 | `obj_bed` (2w, fp [0,-1,2,2], solid), `obj_table` (2w, fp [0,0,2,1], solid), `obj_kitchen_counter` (3w, fp [-1,0,3,1], solid, `counter:true`), `obj_coat_hook` (1w, solid; the teal coat's empty hook and a scarf), `obj_bookshelf` (2w, fp [0,0,2,1], solid), `obj_chippy_counter` (3w, fp [-1,0,3,1], solid, `counter:true`), `obj_fryer` (2w, fp [0,0,2,1], solid), `obj_sign_closing` (2w, not solid, layer `below`; a board lying face-down), `obj_window_can` (1w, solid; a sash window with a tin can on the sill and a string leaving the frame) |
| `sheet_obj_lull_a` | T1 | `obj_rock_pool` (2w, fp [0,0,2,1], solid; save point, glowing turquoise water, one limpet), `obj_pigeonhole_cliff` (3w, 4 tiles tall, fp [-1,-1,3,2], solid; a cliff face of sorting pigeonholes stuffed with envelopes), `obj_pigeonhole_bin` (1w, solid; drawn neutral cream so it tints well), `obj_mail_sack` (1w, solid), `obj_stamp_flower` (1w, not solid; a flower whose petals are postage stamps; drawn white-petalled so it tints), `obj_postbox_shelley` (1w, solid, `counter:true`; a red pillar box half-sunk in sand, two eyestalks and a claw poking from the slot), `obj_mail_slot_door` (2w, fp [0,0,2,1], solid; a brass letter-flap door set in rock), `obj_letter_pile` (1w, solid), `obj_can_post` (1w, solid; a driftwood post with a tin can nailed to the top) |
| `sheet_obj_lull_b` | T1 | `obj_horn_coral_big` (3w, 3 tiles tall, fp [-1,0,3,1], solid; pink coral shaped like a cluster of gramophone horns), `obj_horn_coral_small` (1w, solid; one leaning horn, flippable), `obj_horn_pipe` (1w, solid; a brass elbow joint of speaking tube, flippable), `obj_sunk_clock` (1w, 2 tiles tall, solid; grandfather clock half-buried at a tilt, barnacled), `obj_intray_stack` (1w, 2 tiles tall, solid; office in-trays stacked like a sea stack, papers lifting), `obj_ironing_board` (2w, fp [0,0,2,1], solid), `obj_vending_machine` (1w, 2 tiles tall, solid; a rounded old machine with one big button and a hand-written out-of-order card drawn as a squiggle), `obj_washing_line` (3w, fp [[-1,0,1,1],[1,0,1,1]], solid posts; pressed white laundry), `obj_stair_hatch` (2w, not solid, layer `below`; a round hatch with a spiral stair going down and lamp light coming up) |
| `sheet_obj_lull_c` | T2 | `obj_lamp_lens` (3w, fp [-1,-1,3,2], solid; a great lighthouse lens pointing upward), `obj_radio_valve` (1w, solid), `obj_pearl_big` (2w, fp [0,0,2,1], solid), `obj_pearl_small` (1w, solid; rub spot), `obj_pearl_heap` (3w, fp [-1,0,3,1], solid; envelopes coated into one smooth mound), `obj_bedroom_door` (2w, fp [0,0,2,1], solid; an ordinary white bedroom door standing alone, ajar on darkness), `obj_bench_lull` (2w, fp [0,0,2,1], solid; driftwood bench), `obj_snail_stan` (1w, solid, bob; snail with peaked cap and tiny postbag), `obj_gull_picket` (2w, fp [0,0,2,1], solid, bob; three gulls with squiggle placards) |
| `sheet_obj_shore_b` | T3 | `obj_washing_line_town` (3w, solid posts), `obj_streetlamp` (1w, solid), `obj_crates` (2w, solid), `obj_rowboat` (3w, solid), `obj_boulder` (2w, solid), `obj_rock_pool_small` (1w, not solid, `below`), `obj_jam_jar` (1w, not solid), `obj_biscuit_tin` (1w, not solid), `obj_radio_bench` (2w, solid; Pop's outdoor workbench of radio parts) |

**Battle backgrounds** (`bb_<id>`): `bb_lull_day` (T1; bright seabed, distant pigeonhole cliffs, wet sand foreground band left plain for the tideline; used for the Shallows, the Reef and Slack Water), `bb_undertow` (T1; inside the downward lighthouse, curved teal wall, lamp glow from below; also `memory_rocks`), `bb_dark_bedroom` (T1; a child's bedroom at night in deep blue pencil, a window, a curtain, a string crossing the dark; nothing else), `bb_pearl_bed` (T2; fallback `bb_undertow`), `bb_blare_reef`, `bb_slack_water` (T3; fallback `bb_lull_day`).

**CGs** (`cg_<id>`)

| id | Tier | Composition |
|---|---|---|
| `cg_prologue_glass` | T1 | Close on a big weathered hand and a very small one holding a piece of amber sea-glass up to a low sun; Pop's moustache and cap at the left edge, tiny Wren's squinting face lit amber through the glass; warm rocks below |
| `cg_tide_steps` | T1 (also the title art) | Wide moonlit beach, the sea drawn back for miles; a stone staircase descending into the seabed at centre; three small children at the top seen from behind (teal coat, orange vest, long plait); a white string trailing from Wren's hip down into a faint turquoise glow. Upper left kept calm for the logo |
| `cg_ending_sent` | T1 | Grey morning on Harbour Row; Wren on tiptoe at the red postbox, envelope half in the slot, seen from behind and slightly above; Odo and Lin a few steps back, not looking directly; the first colour returning to the houses |
| `cg_the_rocks` | T2 | Sepia. Two eleven-year-olds on the rocks; nearer the viewer, from behind, a girl with two dark red curly hair puffs, denim pinafore, yellow wellies with painted daisies; facing her, Wren with her arms tightly crossed, mouth a flat line |
| `cg_nobody_leaves` | T2 | The bottom room of the Undertow Light; Wren sitting on the floor, knees up; Odo's life vest round her shoulders, Lin's hand flat on her back, Pim leaning his whole boat-body against her boot; lamp light from below; nobody is looking at anybody |
| `cg_not_yet` | T2 | Dawn; water coming in over the lowest steps; Pim on the bottom step waving his flap; the three children halfway up, looking back; a paper gull overhead |
| `cg_pearl_calm` | T2 | A perfectly calm, lovely, pale seabed; ranks of smooth pearls; in the foreground one small pearl in the exact shape of a paper boat; no figures |
| `cg_lin_asleep` | T3 | Lin asleep against a stack of in-trays with Odo's orange vest laid over her, glasses crooked; Wren with a finger to her lips at Pim, whose flap is already open |
| `cg_den_jar` | T3 | Inside the old lamp-oil store: a crate table, two cushions, a jam jar of sea-glass labelled with a squiggle catching the light from the door, which is open |
| `cg_credits_gulls` | T3 | A cream sky full of small folded-paper gulls flying up and right, each a slightly different paper; fallback: gulls drawn in code over `bb_lull_day` |

**Icons and UI.** `sheet_icon_glass` (T2, 4x4): `icon_glass_red`, `icon_glass_blue`, `icon_glass_amber`, `icon_glass_green`, `icon_tumbled_red`, `icon_tumbled_blue`, `icon_tumbled_amber`, `icon_tumbled_green`, `icon_pebble`, `icon_can_line`, `icon_stamp`, `icon_winded`, `icon_riled`, `icon_soothed`, `icon_tongue_tied`, `icon_shielded`. Until it exists the battle UI draws glass, Pebbles and the can in code (jagged or rounded polygons with hatching), which must always remain as the fallback. `sheet_icon_items` (T3, 4x4): `icon_bag_of_chips`, `icon_mushy_peas`, `icon_pickled_egg`, `icon_scraps`, `icon_flask_of_tea`, `icon_stick_of_rock`, `icon_tide_table_page`, `icon_darned_patch`, `icon_orange_lace`, `icon_egg_medal`, `icon_doing_fine_token`, `icon_second_class_stamp`, `icon_gull_feather`, `icon_pearl_button`, `icon_nacres_slips`, `icon_tams_postcard`; Chip items reuse `icon_glass_*`. `ui_logo` (T3; fallback: GochiHand lettering). `ui_paper`, `ui_cursor` (a pencil stub) and `ui_tag` are generated procedurally by the art pipeline (no image budget).

Tier totals: T1 = 5 walk + 4 face + 11 enemy + 2 terrain + 4 prop + 3 battleback + 3 CG = **32**. T2 = 4 walk + 2 face + 4 enemy + 1 terrain + 1 prop + 1 battleback + 4 CG + 1 icon = **18**. T3 = 1 walk + 1 enemy + 1 prop + 2 battleback + 3 CG + 1 icon + 1 logo = **10**.

---

## 11. Audio direction

### 11.1 Leitmotif: "Are You Awake"

Key C major, 4/4, 84 BPM. Seven notes that scan exactly to Tam's call, "Wren? Are you a-wake? O-ver":

| Bar 1 | | | | Bar 2 | | |
|---|---|---|---|---|---|---|
| E4 quarter | G4 quarter | A4 dotted quarter | G4 eighth | E4 quarter | C5 quarter | D4 half |

It climbs, leaps hopefully to the high C, and drops a seventh to land on D, the second degree: an unanswered question. It never reaches the home note until Wren answers: the **eighth note, C4 (whole note)**, is heard only when the Other Can is answered (as a sting) and in `bgm_dear_tam`. Harmonise with open three-note voicings only (Am7–Fmaj7–C/E–G6 under the seven notes; the answer lands on a plain C). Pop whistles it in the prologue without knowing why it sounds unfinished.

### 11.2 Tracks (12)

Lo-fi chain on everything: gentle tape saturation, slow wow and flutter, low-pass near 9 kHz, faint crackle.

| id | Used | Mood | BPM | Key | GM instruments | Structure | Leitmotif | Loop |
|---|---|---|---|---|---|---|---|---|
| `bgm_title` | Title, Ending B | Small, unfinished | 72 | C | Music Box (10), soft Pad (89) | Motif alone, then with bass notes, 16 bars | Stated plainly, ends on D every time | loop |
| `bgm_harbour_row` | Shore, tides 1–3; prologue | Fond, grey, ambling | 96 | C | Nylon Guitar (24), Glockenspiel (9), Acoustic Bass (32), brushes | A 8 bars, B 8 bars, A' | Bars 1–2 of B are the motif's first four notes in the glockenspiel | loop |
| `bgm_town_hush` | Shore, tides 4–5; Ending C waking | The same town with the talk gone | 96 | C | Nylon Guitar, Acoustic Bass only; glock plays first note of each phrase and stops | Same MIDI as `bgm_harbour_row`, parts muted, long rests | Motif reduced to E–G, then silence | loop |
| `bgm_lull_bright` | `tide_steps`, `sorting_shallows` | Wonder, busy, bubbling | 112 | F | Celesta (8) arpeggios, Square Lead (80) soft, Choir Pad (91), Pizzicato (45), light kit | Intro 4, A 8, B 8 | Motif transposed to F in the square lead in B, still unresolved (ends on G) | loop |
| `bgm_blare_reef` | `blare_reef` | Loud so nobody has to talk | 132 | Bb | Brass Section (61), Tuba (58), Reed Organ (20), Trombone (57), marching snare | Oom-pah A 8, shouting B 8, one bar of sudden silence before the loop | Motif at double speed in the trombones, slightly out of tune (pitch bend −15 cents) | loop |
| `bgm_slack_water` | `slack_water` | Prim, becalmed, tired | 80 | A minor | Woodblock clock tick, Pizzicato Strings (45), Acoustic Grand (0), Vibraphone (11) | 5/4; A 8 bars, B 8 bars where the piano deliberately lands one note late | Motif in the vibraphone, each note placed a beat behind | loop |
| `bgm_undertow` | `undertow_light`, `pearl_bed` | Dark, close, tender | 60 | D minor | Detuned Electric Piano (4), Warm Pad (89), Music Box (10), sub bass, radio static layer | Through-composed 24 bars | Motif played backwards on the music box (D C' E G A G E) | loop |
| `bgm_battle` | Regular battles: "Rattle Your Pockets" | Bouncy, cheeky | 138 | G | Fingered Bass (33), Square Lead (80), Glockenspiel (9), Marimba (12), kit | Intro 2, A 8, B 8 | First four notes as the B-section hook | loop |
| `bgm_boss` | Gull, Perfectly Fine, `troop_big_noise`: "Out Loud" | Driving, stubborn | 150 | E minor | Saw Lead (81), String Ensemble (48) stabs, Fingered Bass, kit with toms | Intro 4, A 8, B 8, break 4 | Motif in E minor in the strings during the break | loop |
| `bgm_nacre` | Nacre's offer, Nacre fight, Ending C | A lullaby that is too sweet | 66 | Eb | Celesta (8), Choir Aahs (52), Harp (46), soft timpani | 3/4; every 4-bar phrase is cut off on its last beat, as if sealed | Motif's last two notes (C–D) repeated and never allowed to continue | loop |
| `bgm_other_can` | The Other Can, `memory_rocks`, the slip | One held breath | 54 | C (no third) | One held String note (48) on G, heartbeat kick, then one instrument per friend: Nylon Guitar (Odo), Vibraphone (Lin), Music Box (Pim) | Layers are written into successive 8-bar sections so a single file builds over 32 bars, then loops the full section | The full seven notes once every 8 bars, always stopping on D | loop |
| `bgm_dear_tam` | Ending A, credits | Release; plain, warm | 84 | C | Acoustic Grand, String Ensemble, Nylon Guitar, whistle (Whistle 78), Glockenspiel | Piano alone, then strings, then the full `bgm_harbour_row` band with the whistle | **All eight notes. It lands on C** for the first time, then repeats it as a round between whistle and glockenspiel | one-shot (about 2:20), then `bgm_title` is not resumed |

### 11.3 SFX

Existing ids are reused; six are new (marked NEW).

| Use | id |
|---|---|
| Cursor, confirm, cancel, error, menu open/close | `sfx_cursor`, `sfx_confirm`, `sfx_cancel`, `sfx_error`, `sfx_menu_open`, `sfx_menu_close` |
| Text blips | `sfx_blip_low` (Wren), `sfx_blip_mid` (Odo, adults), `sfx_blip_high` (Lin, Tam), `sfx_blip_odd` (Pim), `sfx_blip_narrator` |
| Nacre's slips, album pages | `sfx_page` |
| Footsteps | `sfx_step_stone` (cobbles, stairs, rock), `sfx_step_wood`, `sfx_step_water` (shallows), `sfx_step_grass` (verge, sand, paper) |
| Doors, hatches, mail slots | `sfx_door_open`, `sfx_door_close`, `sfx_door_locked`, `sfx_knock` |
| Item, key item, Stamps, chest-like finds | `sfx_item_get`, `sfx_key_item`, `sfx_coin`, `sfx_chest_open` |
| Save; map transfer; falling down a hatch | `sfx_save`, `sfx_transfer`, `sfx_fall` |
| Emotes; jump | `sfx_emote`, `sfx_jump` |
| Puzzle toggles; sorting success | `sfx_switch`, `sfx_push`, `sfx_talk_success` |
| Rubbing a pearl | `sfx_erase` |
| Encounter start, escape | `sfx_encounter`, `sfx_escape` |
| Strike, hits, critical, miss | `sfx_attack_swing`, `sfx_hit_soft`, `sfx_hit_hard`, `sfx_hit_crit`, `sfx_miss` |
| Skill, heal, buff, debuff, Brace | `sfx_skill_cast`, `sfx_heal`, `sfx_buff`, `sfx_debuff`, `sfx_guard` |
| Gaining a glass piece; rattling-Pocket warning (played twice) | `sfx_glass_clink` NEW |
| Confide (skim along the sand and chime); Out Loud flourish | `sfx_glass_tumble` NEW, `sfx_combo` (also Two-Can Calls) |
| Brimming begins / ends; Spill | `sfx_feel_up`, `sfx_feel_down`, `sfx_feel_shift` |
| Listen; a correct Say; Misheard | `sfx_whisper`, `sfx_talk_success`, `sfx_error` |
| Delivered (unfold, then gull) | `sfx_peace`, `sfx_gull_cry` NEW |
| Hushed (crumple); Pebble gained | `sfx_enemy_down`, `sfx_drone_hit` |
| Ally Winded; victory; level up | `sfx_ally_down`, `sfx_victory_sting`, `sfx_level_up` |
| The tin can rattling on its string (calls, String Line, the Other Can's ring) | `sfx_can_rattle` NEW |
| Tam's voice and the radios | `sfx_static` |
| The slip and the rocks (music drops out) | `sfx_heartbeat` |
| Memory transition; Nacre opening | `sfx_reverse_swell` |
| Bench scenes, Ending B last beat | `sfx_music_box_broken` |
| Splash into shallows, rock pool | `sfx_splash` |
| Pim blurting (paper tear); writing the address | `sfx_tear`, `sfx_scribble` |
| Chippy bell, postbox clack | `sfx_bell` |
| Ambience | `amb_sea` NEW (far surf and gulls; `shingle_beach`, `memory_rocks`), `amb_lull` NEW (soft underwater bubbles, distant surf overhead; bright Lull maps), `amb_wind` (`harbour_row`), `amb_room_hum` (interiors), `amb_rain` (Tide 4 Shore), `amb_void` (`slack_water`, `undertow_light`, `pearl_bed`), `amb_night_crickets` (Shore evenings, tides 1, 3, 5, via `onEnter`) |

Unused existing ids (`sfx_glitch`) stay unused.

---

## 12. Scope guardrails and cut list

### 12.1 Guardrails

- **Counts are ceilings:** 11 maps, 4 party members, 12 regular enemy types + 5 tint-variant named Unsent, 3 bosses + 1 non-combat finale, 24 skills, 18 items, 5 puzzles, 12 tracks, 60 images, 6 new sounds, 9 Say it / Keep it moments, 3 endings. Adding anything means removing something.
- **One resource.** No MP, no bond meters, no equipment beyond one Keepsake, no crafting, no elemental wheel. If a new idea cannot be expressed as glass, a Line, a Pebble or the Can Line, it does not go in.
- **Play time 55–75 minutes:** prologue 3, Tide 1 14, Tide 2 13, Tide 3 14, Tide 4 14, Tide 5 10, epilogue 5. A Shore segment that runs past four minutes loses a line, not a Tide.
- **No ending reads a Hush or Deliver count.** Endings read only `gave_letter`, `other_can_answered`, `final_choice` and (through the ghost line) `true_words`.
- **Originality checks that must survive production.** The friends are real and remember the Lull. The Lull belongs to the whole town, not to Wren. Nobody is dead, ill or a figment. The antagonist is a clam who prints slips, is never maternal, never heals the party, and is thanked. Feelings are glass with rule-changing Brimming states, not a three-way emotion wheel or stat tiers. The confiding verb is **Confide** over a single shared Can Line (never "Pass", never follow-up prompts). Enemy needs are **Lines** on a letter strip (no rope knots, no mercy meter). EXP is identical for Hush and Deliver. The battle screen is a side-on tideline with Pockets pressed in sand (no corner portraits). The protagonist wears a teal duffel coat and boots, not a raincoat and wellies. The leitmotif in 11.1 is new to this game.
- **Tone checks.** No blood, no death, nothing frightening for its own sake; the dark bedroom is sad, not horror. Every heavy scene is followed within two minutes by something small and funny. Ending C is quiet, not punishing, and always leaves Odo on the line.

### 12.2 Prioritized cut list (cut from the top)

1. All T3 art (each has a stated fallback): `ui_logo`, `cg_credits_gulls`, `cg_den_jar`, `cg_lin_asleep`, `bb_blare_reef`, `bb_slack_water`, `sheet_icon_items`, `sheet_obj_shore_b`, `en_draft_47` (remove `troop_draft`; `orange_lace` moves to Shelley at 80 Stamps), `char_robin`.
2. Side content: secret benches, the egg medal, striking-gull placard jokes, Stan (move `second_class_stamp` to the `pearl_bed` rock pool).
3. The rub verb (8.6): `pearl_button` becomes a Nacre Delivery reward.
4. T2 enemies: replace `blank_postcard` with `sorry_crab`, `overdue_notice` and `chain_letter` with `listworm` and `reply_all`, `static` with `echo` in their troops (stats rescaled to the replaced enemy's row).
5. T2 props and terrain (`sheet_obj_lull_c`, `sheet_ter_deep`): the fallbacks in 10.3 apply; the String Line lamp becomes the glow of `stair_hatch`, the hint radio becomes a `can_post`, rub spots and pearls become white-tinted `letter_pile` and `mail_sack`.
6. T2 walk sheets and faces: Mum speaks from the kitchen doorway and Mr Brill from behind the counter without sprites; townsfolk lines move to inspectable doors ("Through the letterbox: '...'").
7. `bgm_town_hush` (play `bgm_harbour_row` at half volume) and `bgm_blare_reef` (use `bgm_boss` at low volume).
8. The named Unsent: Kept moments then only lower `true_words`; late saying happens by talking to the same person again on the Shore in the next segment (one extra dialogue page each).
9. Puzzle 8.5 (Pearl Doors): the wall opens after the last roaming fight.
10. Two-Can Calls other than `call_over_and_out`.

**Never cut:** the Can Line and Tumbled glass; Lines, Listen, Say and Deliver; Pebbles that only a friend can clear; the nine Say it / Keep it moments; the slip with its ghost lines; `troop_three_words` with the player controlling the friends; Nacre's offer; the Other Can; "Not yet is allowed"; Odo on the line in Ending C.

