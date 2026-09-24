#!/usr/bin/env python3
"""Writes every prompt file of tools/art/prompts/ that is not one of the four proven party
prompts (char_wren/odo/lin/pim_walk.txt, face_*_sheet.txt, style.txt - those stay hand-written).

Run:  python3 tools/art/prompts/_build.py
It only rewrites the files it owns, so it is safe to re-run; edit a description here, re-run,
and gen_image.py's prompt cache will regenerate exactly that image on the next batch run.
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent

# The proven style line of the party sheets (tools/art/prompts/style.txt) - never change it,
# every new character/creature must match the art that already exists.
STYLE_CHAR = ("Style/medium: hand-drawn colored pencil and ink doodle from a child's sketchbook, "
              "slightly wobbly dark pencil outlines, soft pastel colors with visible pencil hatching "
              "and waxy crayon texture, cute melancholic storybook feeling, chibi proportions with big "
              "heads, simple dot eyes and rosy crayon cheeks. Flat even lighting.")
# Same wording for things that have no face/body proportions.
STYLE_OBJ = ("Style/medium: hand-drawn colored pencil and ink doodle from a child's sketchbook, "
             "slightly wobbly dark pencil outlines, soft pastel colors with visible pencil hatching "
             "and waxy crayon texture, cute melancholic storybook feeling, drawn on warm cream paper. "
             "Flat even lighting, no cast shadows.")

AV_CHAR = ("Avoid: any text, letters, labels, numbers, grid lines, borders, ground shadows, floor, "
           "scenery, extra objects, extra characters.")
AV_FACE = ("Avoid: any text, letters, labels, numbers, grid lines, borders, frames, backgrounds, "
           "scenery, speech bubbles, extra objects, extra characters.")
AV_ENEMY = ("Avoid: any text, letters, labels, numbers, watermarks, grid lines, borders, frames, "
            "cast shadows, ground, floor, scenery, background, extra objects, extra characters.")
AV_SHEET = ("Avoid: any text, letters, labels, numbers, watermarks, grid lines, borders, frames, "
            "cast shadows, background scenery, extra objects.")
AV_TER = ("Avoid: any text, letters, labels, numbers, watermarks, grid lines, borders, frames, "
          "perspective, horizon, cast shadows, objects lying on the ground, characters.")
AV_SCENE = ("Avoid: any text, letters, numbers, labels, watermarks, signatures, grid lines, borders, "
            "frames, speech bubbles, photorealism, 3D rendering, anime style, glossy digital shading.")

files = {}


def w(name, lines):
    files[name] = "\n".join(lines) + "\n"


# --------------------------------------------------------------------------- walk sheets
def walk(name, subject):
    w(name, [
        "Use case: stylized-concept",
        "Asset type: 2D top-down RPG character walking sprite sheet",
        "Subject: the SAME character drawn 12 times in a strict grid of 4 rows x 3 columns with "
        "equal-sized cells. " + subject,
        "Row 1: facing the viewer (front view), 3 walking frames: left foot forward, standing neutral, "
        "right foot forward.",
        "Row 2: facing LEFT (side view), 3 walking frames.",
        "Row 3: facing RIGHT (side view), 3 walking frames.",
        "Row 4: facing AWAY from the viewer (back view), 3 walking frames.",
        "Composition: every figure the same size, full body from head to feet, centered in its cell, "
        "feet on the same baseline within each row, generous empty space between figures, nothing "
        "overlapping, identical outfit and colors in every frame.",
        STYLE_CHAR, AV_CHAR,
    ])


ADULT = ("Grown-up proportions for this cute style, about 3 heads tall, clearly taller and heavier "
         "than a child. ")

walk('char_pop_walk.txt', ADULT +
     "The character is Pop, a 74-year-old fisherman grandfather: tall and stooped with very big hands, "
     "a bushy white moustache, kind crinkled dot eyes, a navy blue fisherman's cap; an oatmeal cream "
     "cable-knit jumper with one darned patch on the elbow; brown corduroy trousers held up by red "
     "braces; soft tartan slippers worn outdoors; a small screwdriver tucked behind his right ear.")

walk('char_mum_walk.txt', ADULT +
     "The character is Mum, a busy 41-year-old district nurse: sandy blonde hair pinned up in a claw "
     "clip with strands escaping, tired kind face; a lilac nurse's tunic under an open grey raincoat "
     "that is only half put on, one arm still out of its sleeve; navy trousers; flat black shoes; an "
     "ID lanyard round her neck; a red travel mug in one hand.")

walk('char_mr_brill_walk.txt', ADULT +
     "The character is Mr Brill, a broad cheerful 45-year-old fish-and-chip shop owner: warm brown "
     "skin, bald head, big black moustache, folded paper hat on his head; a white apron with a few "
     "grease smudges over a red polo shirt; dark blue trousers; black shoes; a chip fork in his "
     "breast pocket.")

walk('char_towns_a_walk.txt', ADULT +
     "The character is a seaside fisherman townsperson: weathered pale face with grey stubble and a "
     "flat cap, yellow oilskin bib-and-brace waterproofs over a faded blue jumper, black rubber "
     "wellington boots, a coil of rope over one shoulder.")

walk('char_towns_b_walk.txt', ADULT +
     "The character is an old seaside townswoman: small and round, white permed hair, round spectacles, "
     "a mauve quilted coat over a floral dress, thick brown stockings, sensible brown shoes, and she "
     "pulls a red tartan shopping trolley on two little wheels beside her in every frame.")

walk('char_robin_walk.txt',
     "The character is Robin, a tiny 5-year-old boy, very small, about 2 heads tall, much shorter than "
     "a twelve-year-old: black bowl-cut hair, round face, wide dot eyes; a yellow T-shirt with a simple "
     "drawn crab on the front; blue shorts; one red shoe on his left foot and a bare sock on the right.")

# --------------------------------------------------------------------------- portrait sheets
def face(name, rows, cols, who, cells):
    lines = [
        "Use case: stylized-concept",
        "Asset type: character expression sheet for RPG dialogue portraits",
        "Subject: %d bust portraits (head and shoulders) in a strict grid of %d rows x %d columns with "
        "equal-sized cells, reading order left to right, top to bottom. %s Same outfit, same hair, same "
        "colors, same scale and same framing in every cell; only the facial expression and small pose "
        "details change." % (rows * cols, rows, cols, who),
    ]
    lines += ["Cell %d: %s" % (i + 1, c) for i, c in enumerate(cells)]
    lines += [
        "Composition: each bust centered in its cell, facing the viewer in three-quarter front view, "
        "generous empty space between the busts, nothing overlapping, shoulders cropped softly at the "
        "bottom of each bust.",
        STYLE_CHAR, AV_FACE,
    ]
    w(name, lines)


face('face_pop_sheet.txt', 2, 2,
     "The character is Pop, a 74-year-old grandfather: bushy white moustache, crinkled kind eyes, navy "
     "fisherman's cap, oatmeal cream cable-knit jumper, a screwdriver behind his right ear. Drawn with "
     "grown-up proportions, a big head but an older face.",
     ["neutral: calm and unhurried, gentle steady look.",
      "twinkle: eyes crinkled almost shut with fond amusement, moustache lifted by a smile.",
      "concerned: brows drawn together, mouth hidden under the moustache, looking slightly down.",
      "whistling: lips pursed under the moustache, eyes softly closed, head tilted back a little."])

face('face_grownups_sheet.txt', 2, 3,
     "TWO different characters. The TOP row is all the same woman: Mum, a 41-year-old district nurse, "
     "sandy blonde hair in a claw clip with escaping strands, tired kind face, lilac nurse's tunic "
     "under a grey raincoat collar. The BOTTOM row is all the same man: Mr Brill, a broad 45-year-old "
     "chip-shop owner, warm brown skin, bald, big black moustache, folded white paper hat, white apron "
     "over a red polo shirt. Grown-up proportions.",
     ["Mum, neutral: pleasant, a little distracted, eyebrows relaxed.",
      "Mum, soft: warm gentle smile, eyes half closed, head tilted.",
      "Mum, worried: small frown, lips pressed, eyes glancing aside.",
      "Mr Brill, neutral: friendly, eyebrows up, slight smile.",
      "Mr Brill, booming: mouth wide open in a huge laugh, eyes shut, head thrown back.",
      "Mr Brill, flat: no smile at all, moustache level, eyes tired and far away."])

# --------------------------------------------------------------------------- enemies
def enemy(name, subject, tall=False):
    w(name, [
        "Use case: stylized-concept",
        "Asset type: single enemy illustration for the battle screen of a turn-based RPG",
        "Subject: " + subject,
        "Composition: ONE single creature and nothing else, seen straight from the front at eye level, "
        "complete from top to bottom, standing upright, centered, filling the frame with a small even "
        "margin all round, on a completely empty background.",
        STYLE_CHAR, AV_ENEMY,
    ])
    return tall


TALL = set()


def enemy_t(name, subject):
    enemy(name, subject)
    TALL.add(name)


enemy('en_thank_you_card.txt',
      "a wilted folded greeting card standing on its own bottom edge like a little person, sagging "
      "cone party hat on its top corner, a faded grey balloon drawing on its front, mortified dot eyes "
      "peeking over the fold, two tiny ink-line hands wringing together, the whole card drooping with "
      "embarrassment, creased and slightly yellowed with age.")

enemy('en_sorry_crab.txt',
      "a crumpled sheet of lined notepaper scrunched into the shape of a crab: two folded paper corners "
      "for claws, two stalk eyes on top, a scribbled crossed-out squiggle on its shell-back, six little "
      "ink legs, walking sideways, scowling and sulky.")

enemy('en_reply_all.txt',
      "a tight overlapping clump of six identical small grey-white seagulls folded out of office memo "
      "paper, flying together as one shape, each with a silver paperclip for a beak, all looking in "
      "different directions, one at the edge looking apologetic; the clump is roughly round and reads "
      "as one enemy.")

enemy_t('en_toot.txt',
        "a striped paper party blow-horn, unrolled rigid and standing upright on two stubby legs, its "
        "wide bell end at the top wearing a forced strained grin, tiny sweat beads on its brow, a "
        "blank pleated rosette pinned to its body, red and cream stripes, trembling slightly.")

enemy_t('en_listworm.txt',
        "an inchworm made from a long paper to-do list folded into loops, small empty ticked boxes as "
        "spots down its back, two pencil-stub horns on its head, an anxious over-busy little face, and "
        "its tail still unrolling into a loose curl of paper at the bottom.")

enemy('en_echo.txt',
      "a translucent pale teal jellyfish whose bell is shaped like a rounded speech bubble, trailing "
      "soft tentacles that look like a row of dots trailing off, its outline faintly repeated three "
      "times slightly offset as if drawn again and again, a small calm listening face; nothing scary, "
      "gentle and quiet.")

enemy('en_pearl_drip.txt',
      "a slow glossy teardrop-shaped blob of pearl-white lacquer with a soft rainbow sheen, half-set "
      "drips hanging from its lower edge, a polite closed-eye smile, and one corner of a cream envelope "
      "visible trapped inside its body.")

enemy_t('en_boss_postmaster_gull.txt',
        "a large barrel-chested herring gull standing upright like an official: a navy postmaster's "
        "peaked cap, a wide sash across his chest covered in rubber date-stamps, small reading glasses "
        "on a chain, a thick rule book tucked under one wing and a blank picket sign on a stick under "
        "the other; grey and white feathers, yellow beak, a very stern disapproving face. Big and "
        "self-important but not frightening.")

enemy_t('en_boss_perfectly_fine.txt',
        "a teetering tower of crisply ironed folded laundry and tablecloths, twice a child's height, "
        "swaying slightly; a black flat-iron hanging as one hand on the left and a feather duster as "
        "the other hand on the right; on top, a round smiling paper-plate mask held up on a stick, its "
        "painted smile crossed by fine hairline cracks; small curls of steam escaping between the "
        "folded layers. Pastel whites, creams and washed-out blues.")

enemy('en_boss_nacre.txt',
      "an enormous house-sized giant clam seen from the front, its ridged pale pink and cream scallop "
      "shell crusted all over with barnacles and with old envelopes coated in smooth pearl, the shell "
      "open only a hand's width; inside the gap there is soft darkness and a faint warm glow, and a few "
      "small printed paper slips are sliding out of the slot between the shell lips. No eyes, no teeth, "
      "no face at all. It must read as gentle, enormous and patient, never as a monster.")

enemy('en_other_can.txt',
      "a single dented tin can with its label gone, lying on its side, a taut white string running out "
      "of its open end and off to one side, small hand-drawn motion lines around it showing it is "
      "trembling, and a faint warm amber glow coming from inside the can. No face, no eyes, no legs.")

enemy('en_blank_postcard.txt',
      "a seaside postcard standing upright on its short edge, the picture side showing a faded empty "
      "beach, one corner dog-eared and fringed, a printed greeting drawn only as a meaningless wavy "
      "squiggle, and two shy dot eyes in the little stamp box in the corner.")

enemy_t('en_overdue_notice.txt',
        "a stern pink library slip standing upright like a tiny bailiff, holding a big wooden rubber "
        "date-stamp over its shoulder like a hammer, half-moon spectacles perched on its top edge, a "
        "disapproving pursed mouth, splats of red ink on its lower half, two short ink legs.")

enemy_t('en_chain_letter.txt',
        "a sea-snake made of a linked paper chain of interlocking loops in school-craft colours, each "
        "loop carrying a scribbled squiggle, rearing up in an S-curve, a forked paper tongue, and "
        "dramatic doom-laden eyebrows over worried eyes.")

enemy('en_static.txt',
      "a rounded 1950s valve radio standing on four stubby legs, its glowing amber tuning dial used as "
      "a single eye, a cloth speaker grille for a mouth out of which leaks a scribble of pencil "
      "static, a bent wire aerial on top, and a crust of barnacles on one side.")

enemy('en_draft_47.txt',
      "a blushing sheet of lined notepaper standing upright, covered in scribbled-out lines and "
      "crossings-out, holding its own pencil in a small ink hand, eraser crumbs flying around it, a few "
      "little heart doodles hastily scratched over, an embarrassed face near the top.")

# --------------------------------------------------------------------------- terrain sheets
def terrain(name, cells):
    lines = [
        "Use case: stylized-concept",
        "Asset type: ground material swatch sheet for a top-down RPG",
        "Subject: a strict grid of 3 rows x 3 columns of equal square swatches of flat ground material, "
        "separated by thin white gutters, reading order left to right and top to bottom. Each swatch "
        "shows ONE material seen straight down from directly above, completely flat, filling its whole "
        "square evenly right up to the edge of the swatch; no perspective, no horizon, no objects lying "
        "on it, no edges or corners of the material. A regular pattern shows at least three full "
        "repetitions across its swatch.",
    ]
    lines += ["Cell %d: %s" % (i + 1, c) for i, c in enumerate(cells)]
    lines += ["Style/medium: hand-drawn coloured pencil and ink texture from a child's sketchbook, "
              "visible pencil hatching and waxy crayon grain, soft pastel colours, wobbly hand-drawn "
              "detail lines. Flat even lighting.", AV_TER]
    w(name, lines)


terrain('sheet_ter_shore.txt', [
    "grey seaside cobblestones, rounded uneven stones in muted slate and warm grey with pale sandy "
    "mortar between them.",
    "a scruffy verge of coarse seaside grass, washed-out sage green with a few paler dry tufts.",
    "shingle beach: small flat pebbles in warm grey, oatmeal and dull brown, packed close together.",
    "wet rippled sand, pale grey-brown with shallow ripple lines and a faint wet sheen, a few tiny "
    "shell fragments.",
    "flat tidal rock, a pale grey-blue rock shelf with hairline cracks, dull green weed in the cracks "
    "and small round limpets.",
    "a rough dark cliff face seen from above, angular broken slate-grey rock, deep shadowed cracks, "
    "much darker and coarser than the flat tidal rock.",
    "cold grey-blue sea water with small choppy pencil-drawn wavelets and pale foam flecks, opaque, "
    "nothing visible underneath.",
    "worn indoor floorboards of pale honey-brown wood running top to bottom, four boards across the "
    "swatch, visible grain and dark seams between boards.",
    "a painted interior plaster wall, flat cream with a faint pink undertone, gently mottled crayon "
    "texture and a few tiny hairline cracks.",
])

terrain('sheet_ter_lull.txt', [
    "pale dry sand, warm cream-yellow, finely stippled, with a scatter of tiny broken shells.",
    "clear shallow turquoise water over pale sand: bright turquoise with light ripple caustics and the "
    "sand colour showing through.",
    "a floor made of overlapping cream envelopes lying flat, their triangular back-flaps and seams "
    "forming a soft irregular patchwork, warm paper cream.",
    "deep dark blue-green sea water, opaque, with darker drifting bands and a few pale foam specks.",
    "rough reef rock crusted with pink and coral-orange coral nubs and small barnacles, seen from "
    "directly above.",
    "a coral floor of close-packed soft pastel coral: pink, cream and pale turquoise rounded lobes "
    "fitted together like a carpet.",
    "ruled ledger paper: pale greenish-cream paper with evenly spaced horizontal pale blue ruled lines "
    "and one faint red vertical margin line, six ruled lines across the swatch.",
    "a perfectly still mirror-calm water surface, pale silvery grey-blue, almost featureless with a "
    "very faint soft marbling and no ripples.",
    "cut stone stair-slabs seen from above: large rectangular pale grey-cream blocks with sandy joints "
    "and worn rounded corners, two blocks across the swatch.",
])

terrain('sheet_ter_deep.txt', [
    "curved stone steps of a spiral staircase seen from above, warm grey wedge-shaped stone slabs "
    "fanning out, worn and slightly damp.",
    "dark varnished floorboards of an old lighthouse, deep brown wood running top to bottom, four "
    "boards across the swatch, black seams and brass nail heads.",
    "the inner wall of a lighthouse: teal-painted plaster with a curved grain, worn patches showing "
    "paler undercoat, a faint vertical brush texture.",
    "soft pale fog lying on the ground, a cloudy milky grey-white with gentle drifting swirls and "
    "almost no detail.",
    "a flat surface of very dark blue-black spilled ink, near black with faint darker swirls and one or "
    "two tiny paler bubbles.",
    "a pearl floor: smooth pearl-white with a faint soft rainbow sheen and gentle concentric growth "
    "rings, very pale and clean.",
    "a nacre wall: thick ridged mother-of-pearl in shell pink, cream and lilac, with wavy parallel "
    "growth ridges and a soft iridescent shimmer.",
    "an old kitchen lino floor in a check pattern of cream and faded sage-green squares, four squares "
    "across the swatch, scuffed and slightly worn at the square corners.",
    "plain flat warm cream paper with nothing on it at all, even crayon grain, no pattern.",
])

# --------------------------------------------------------------------------- prop sheets
def props(name, cells, note=""):
    lines = [
        "Use case: stylized-concept",
        "Asset type: prop sheet for the maps of a top-down RPG",
        "Subject: nine separate objects arranged in a strict grid of 3 rows x 3 columns, one object per "
        "cell, reading order left to right and top to bottom. Classic JRPG three-quarter top-down view: "
        "every object seen slightly from above and from the front, upright, complete from top to bottom. "
        "Wide empty space between the objects, nothing touching or overlapping its neighbours, every "
        "object drawn as a single complete piece. Relative sizes roughly as described (the number of "
        "tiles tells you how wide it is compared to the others). " + note,
    ]
    lines += ["Cell %d: %s" % (i + 1, c) for i, c in enumerate(cells)]
    lines += [STYLE_OBJ, AV_SHEET]
    w(name, lines)


props('sheet_obj_shore.txt', [
    "a terraced seaside house front, 4 tiles wide: two storeys, grey slate roof, pebble-dashed cream "
    "wall, a front door, three sash windows of which one upstairs is lit warm yellow, and a dented tin "
    "can standing on a window sill.",
    "an identical terraced house front, 4 tiles wide, but empty: every window dark, curtains gone, a "
    "blank estate agent's board on a post bolted to the wall, paint peeling.",
    "a fish-and-chip shop front, 4 tiles wide: a red and cream striped awning, a wide steamed-up window "
    "with a warm glow behind it, a propped-open door, a blank menu board beside the door.",
    "a British pillar postbox, 1 tile wide: a fat round red cast-iron pillar with a horizontal letter "
    "slot and a domed top. The brightest, reddest thing on the sheet.",
    "a stack of wooden-and-net lobster pots, 2 tiles wide: three curved slatted traps piled and "
    "tangled with a few orange floats and rope.",
    "a weathered wooden slatted park bench, 2 tiles wide, with black iron ends, paint flaking.",
    "a wooden sea groyne, 3 tiles wide: a low line of tarred upright timber posts joined by planks, "
    "green weed and barnacles on the lower half.",
    "a small wooden rowing boat turned upside down, 3 tiles wide, its peeling pale blue painted hull "
    "uppermost, resting on the ground.",
    "a lighthouse, 3 tiles wide and very tall (about twice as tall as the houses are): a tapering white "
    "tower with one horizontal teal band, a glazed lamp room with a railing at the top, and a small "
    "arched oil-store door at its foot.",
], "Cell 9 must be drawn clearly taller than everything else on the sheet.")

props('sheet_obj_home.txt', [
    "a child's single bed, 2 tiles wide, seen from the front and slightly above: wooden frame, a "
    "patchwork quilt in faded teal and cream, one pillow.",
    "a small square wooden kitchen table, 2 tiles wide, with a cream oilcloth cover and one chair "
    "tucked in at the front.",
    "a kitchen counter run, 3 tiles wide: a cream cupboard base with a wooden worktop, a small sink "
    "with a tap at the left and a kettle at the right.",
    "a wall coat hook board, 1 tile wide: a varnished wooden board with three brass hooks, one hook "
    "empty, a cream scarf with a red stripe hanging from another.",
    "a low wooden bookshelf, 2 tiles wide, two shelves of leaning books in faded pastel covers, a "
    "radio part and a jar on the top.",
    "a fish-and-chip shop serving counter, 3 tiles wide: stainless steel front, a glass heated display "
    "on top, a bottle of vinegar and a stack of paper wrappers.",
    "a chip-shop deep fryer, 2 tiles wide: a stainless steel double fryer with a hinged lid, a wire "
    "basket, a hanging wire scoop, and a curl of steam.",
    "a hand-painted wooden shop sign board lying flat on the ground face-down, 2 tiles wide, plain "
    "back planks showing, one corner chipped.",
    "a sash window, 1 tile wide, seen from inside: a white painted frame with four panes showing grey "
    "sky, a dented tin can standing on the inner sill and a white string leading from the can out of "
    "the picture to the right.",
])

props('sheet_obj_lull_a.txt', [
    "a rock pool, 2 tiles wide: a shallow bowl of dark tidal rock filled with glowing turquoise water, "
    "one limpet on the rim, a soft glow rising from the water.",
    "a cliff face of post office pigeonholes, 3 tiles wide and very tall: a wall of square wooden "
    "sorting compartments built into pale rock, most of them stuffed with cream envelopes, some "
    "envelopes spilling out.",
    "a single free-standing pigeonhole sorting bin, 1 tile wide: a small four-compartment wooden sorting "
    "box on short legs, drawn in plain neutral cream with no strong colour, one envelope in a slot.",
    "a canvas mail sack, 1 tile wide: a fat cream canvas sack tied with rope, bulging with envelopes, "
    "leaning slightly.",
    "a stamp flower, 1 tile wide: a single flower on a green stem whose petals are five postage stamps "
    "with perforated edges, drawn white with only pencil outlines so it carries no colour, a round "
    "button centre and two leaves.",
    "a red pillar postbox half sunk into sand at a tilt, 1 tile wide, with two little hermit-crab "
    "eyestalks and one orange claw poking out of the letter slot.",
    "a brass letter-flap door set into rock, 2 tiles wide: a low arched wooden door in a pale rock "
    "face with a big polished brass letter flap in the middle.",
    "a pile of loose envelopes and letters heaped on the ground, 1 tile wide, cream and pale blue, "
    "some open, some sealed.",
    "a driftwood post, 1 tile wide: a weathered wooden post standing upright with a dented tin can "
    "nailed to the top of it and a white string tied to the can.",
], "Cell 2 must be drawn clearly the tallest object on the sheet.")

props('sheet_obj_lull_b.txt', [
    "a big horn coral, 3 tiles wide and tall: a cluster of pink coral trumpets shaped like old "
    "gramophone horns growing from one base, all opening in different directions.",
    "a small horn coral, 1 tile wide: one single leaning pink gramophone-horn coral trumpet on a short "
    "stalk.",
    "a speaking-tube horn pipe, 1 tile wide: a brass elbow joint of ship's speaking tube standing up "
    "out of the ground, its bell mouth turned to one side, verdigris patches.",
    "a grandfather clock half buried in sand at a tilt, 1 tile wide and tall: a dark wooden long-case "
    "clock with a round blank white face and crusted barnacles along one side.",
    "a stack of office in-trays, 1 tile wide and tall: four wire mesh letter trays stacked into a "
    "leaning tower like a sea stack, loose papers lifting from them.",
    "an ironing board, 2 tiles wide: a padded cream-covered ironing board standing on its splayed metal "
    "legs, a black flat-iron resting on the end.",
    "an old vending machine, 1 tile wide and tall: a rounded cream and mint-green machine with a glass "
    "front, one big red button and a small hand-written card taped on showing only a wavy squiggle.",
    "a washing line, 3 tiles wide: two wooden posts, one at each end, with a slack rope between them "
    "and three pressed white sheets pegged to it.",
    "a round floor hatch standing open, 2 tiles wide, seen from above and in front: a circular rim in "
    "the ground, the top of a spiral stone stair going down into it, warm lamp light coming up.",
])

props('sheet_obj_lull_c.txt', [
    "a great lighthouse lens, 3 tiles wide: a barrel of concentric glass prism rings in a brass cage, "
    "standing on a base and pointing upwards, faint amber light inside.",
    "a radio valve, 1 tile wide: a tall glass vacuum tube with a metal base and pins, a warm orange "
    "filament glowing inside, standing upright.",
    "a big pearl, 2 tiles wide: a smooth round pearl-white boulder with a soft rainbow sheen resting on "
    "the ground.",
    "a small pearl, 1 tile wide: a smooth round pearl the size of a football, faint rainbow sheen.",
    "a heap of pearl-coated envelopes, 3 tiles wide: a long smooth low mound of pearl-white in which the "
    "corners and edges of envelopes are still just visible under the coating.",
    "an ordinary white bedroom door standing alone with no wall around it, 2 tiles wide, in a plain "
    "painted frame, ajar, with flat darkness in the gap.",
    "a driftwood bench, 2 tiles wide: two grey weathered planks on two stone blocks, worn smooth.",
    "a snail postman, 1 tile wide: a garden snail with a warm brown spiral shell, a tiny navy peaked "
    "cap between its eyestalks and a small leather postbag slung on its shell, a patient smile.",
    "three seagulls standing in a row, 2 tiles wide, each holding up a small blank placard on a stick "
    "with one wing, beaks open as if chanting, indignant.",
])

props('sheet_obj_shore_b.txt', [
    "a washing line between two posts, 3 tiles wide: two wooden posts, a slack rope and four pegged "
    "items of faded laundry, a shirt and towels.",
    "a seaside street lamp, 1 tile wide and tall: a dark green cast-iron post with a curved top and a "
    "small glass lantern, unlit.",
    "a stack of wooden fish crates, 2 tiles wide: three pale slatted boxes piled up, one with a few "
    "floats in it.",
    "a wooden rowing boat the right way up, 3 tiles wide, resting on the ground: peeling pale blue and "
    "cream paint, two oars inside, a coil of rope.",
    "a big sea boulder, 2 tiles wide: a rounded grey rock with dark cracks, dull green weed at its base.",
    "a very small rock pool, 1 tile wide, seen from above: a shallow dip of dark rock holding clear "
    "water, a tiny anemone and two pebbles, very flat.",
    "a jam jar, 1 tile wide: a glass jar with a screw lid standing on the ground, half full of pieces "
    "of frosted sea glass in red, blue, amber and green.",
    "a biscuit tin, 1 tile wide: a battered round tin with a dented lid and a faded floral pattern, "
    "standing closed.",
    "an outdoor workbench of radio parts, 2 tiles wide: a wooden trestle bench covered in valves, coils "
    "of wire, a half-opened radio chassis and a screwdriver.",
])

# --------------------------------------------------------------------------- scenes (bb + cg)
def scene(name, subject, kind):
    lines = [
        "Use case: stylized-concept",
        "Asset type: " + kind,
        "Subject: " + subject,
        "Composition: a single complete illustration in 4:3 landscape format, filling the whole picture "
        "to the edges, no border and no frame, no empty margin, one clear focal point.",
        "Style/medium: hand-drawn coloured pencil and ink storybook illustration on warm cream paper, "
        "slightly wobbly dark pencil outlines, soft pastel colours with visible pencil hatching and "
        "waxy crayon grain, flat gentle lighting with no cast shadows, tender and a little lonely. "
        "Children are drawn cute with big heads, simple dot eyes and rosy crayon cheeks.",
        AV_SCENE,
    ]
    w(name, lines)


BB = "battle background for a turn-based RPG (the characters are drawn by the game on top of it)"
CG = "full-screen story illustration for an RPG"

scene('bb_lull_day.txt',
      "a bright empty undersea seabed where the sea has gone out: pale cream sand, scattered small "
      "shells and a few pink coral nubs, a distant cliff of post office pigeonholes stuffed with "
      "envelopes across the background, a turquoise sky-like haze above. The lower third is a plain "
      "flat band of wet sand with nothing on it at all, kept simple and empty.", BB)

scene('bb_undertow.txt',
      "the inside of a lighthouse that goes downward instead of up, seen from within: a curved "
      "teal-painted wall running round the picture, a spiral stair edge, a brass porthole, coils of "
      "white string on hooks; warm amber lamp light welling up from below so the lower part glows and "
      "the top is deep teal shadow. The lower third is a plain empty floor band.", BB)

scene('bb_dark_bedroom.txt',
      "a child's small bedroom at night drawn almost entirely in deep blue pencil: one curtained "
      "window with pale moonlight, a plain wall, and a single white string crossing the darkness from "
      "the window to the right edge. Nothing else at all in the room, no furniture, no toys. Very "
      "empty, very quiet. The lower third is plain dark floor.", BB)

scene('bb_pearl_bed.txt',
      "a vast calm pale seabed of pearl: ranks of smooth pearl-white domes receding into a soft pink "
      "and lilac haze, faint rainbow sheen everywhere, a few pearl-coated envelope corners in the "
      "middle distance. Almost no saturated colour. The lower third is a plain pale floor band.", BB)

scene('bb_blare_reef.txt',
      "a coral reef on the dry seabed: clusters of pink coral shaped like gramophone horns rising left "
      "and right, brass speaking-tube elbows poking out of the sand between them, bright turquoise "
      "water haze behind. The lower third is a plain empty band of pale coral sand.", BB)

scene('bb_slack_water.txt',
      "a flooded office sunk in still water: leaning stacks of wire in-trays like sea stacks, a "
      "half-buried grandfather clock at a tilt, sheets of ruled ledger paper drifting, everything in "
      "pale ledger green and ruled-line blue, the water perfectly mirror-still. The lower third is a "
      "plain empty floor band.", BB)

scene('cg_prologue_glass.txt',
      "a very close view of a big weathered old hand and a very small child's hand together holding up "
      "a piece of amber sea-glass towards a low evening sun, so the glass glows warm amber. At the left "
      "edge, cropped, the white moustache and navy cap of an old man. The small girl's squinting happy "
      "face is lit amber through the glass. Warm grey rocks and a sliver of pale sea below. Warm, "
      "close, golden.", CG)

scene('cg_tide_steps.txt',
      "a wide moonlit beach at night with the sea drawn back for miles, leaving a vast pale wet "
      "seabed. In the centre of the picture a flight of stone steps descends INTO the seabed and down "
      "out of sight, a faint turquoise glow rising from the bottom of it. At the near top of the steps, "
      "seen small and from behind, three children stand looking down: a girl in a too-big teal duffel "
      "coat with a stubby up-ponytail, a stocky boy in a bright orange life vest, and a tall girl with a "
      "very long black plait. A white string trails from the first girl's hip down into the glow. The "
      "upper left quarter of the picture is calm empty sky with nothing in it.", CG)

scene('cg_ending_sent.txt',
      "a grey seaside morning on a terraced harbour street, seen from behind and slightly above: a "
      "small girl in a too-big teal duffel coat with a stubby up-ponytail stands on tiptoe at a red "
      "pillar postbox, pushing an envelope half into the slot. A few steps behind her a stocky boy in "
      "an orange life vest and a tall girl with a long black plait wait, carefully not looking straight "
      "at her. The houses behind are just beginning to take back their colour, warmer at the far end of "
      "the street.", CG)

scene('cg_the_rocks.txt',
      "a memory drawn entirely in sepia and faded warm brown, like an old photograph in pencil: two "
      "eleven-year-old girls on grey seaside rocks. Nearest the viewer, seen from behind, a girl with "
      "two dark red curly hair puffs, a denim pinafore dress and yellow wellington boots with painted "
      "daisies on them. Facing her, a sandy-haired girl in a too-big duffel coat stands with her arms "
      "tightly crossed and her mouth a flat line, looking away. Low sun, long quiet rocks, nobody else.", CG)

scene('cg_nobody_leaves.txt',
      "the bottom room of a lighthouse, warm amber lamp light coming up from below. A girl in a teal "
      "duffel coat sits on the floor with her knees drawn up, a bright orange life vest laid round her "
      "shoulders; a tall girl with a long black plait crouches beside her with one hand flat on her "
      "back; a little cream paper boat with two stick legs and a stamp on its forehead leans his whole "
      "body against her boot. Nobody is looking at anybody. Quiet, close, kind.", CG)

scene('cg_not_yet.txt',
      "dawn on the stone sea steps, the water already coming in over the lowest steps. On the bottom "
      "step a little cream paper boat with two stick legs and a stamp on his forehead waves his top "
      "flap upward in farewell. Halfway up the steps three children have stopped and turned to look "
      "back: a girl in a teal duffel coat, a boy in an orange life vest, a tall girl with a long plait. "
      "A gull folded out of paper glides overhead. Pale pink and grey dawn light.", CG)

scene('cg_pearl_calm.txt',
      "a perfectly calm and lovely pale seabed with no people in it at all: neat ranks of smooth "
      "pearl-white domes stretching into a soft pink and lilac haze, faint rainbow sheen, perfectly "
      "tidy and perfectly silent. In the near foreground one small pearl has the exact shape of a "
      "little folded paper boat. Beautiful and slightly wrong.", CG)

scene('cg_lin_asleep.txt',
      "inside a flooded office room: a tall girl with a very long black plait and round glasses has "
      "fallen asleep sitting against a leaning stack of wire in-trays, her glasses crooked, a bright "
      "orange life vest laid over her like a blanket. In the foreground a girl in a teal duffel coat "
      "holds one finger to her lips towards a little cream paper boat with stick legs, whose top flap "
      "is already open to speak. Soft green-blue light, very quiet, gently funny.", CG)

scene('cg_den_jar.txt',
      "inside a small stone lamp-oil store used as a children's den: a wooden crate for a table, two "
      "flat cushions on the floor, and on the crate a glass jam jar full of sea glass in red, blue, "
      "amber and green with a hand-written paper label showing only a wavy squiggle. The low door "
      "stands open at one side and a shaft of pale daylight falls across the jar, which catches the "
      "light. Nobody is in the room.", CG)

scene('cg_credits_gulls.txt',
      "a wide cream sky filled with dozens of small folded-paper seagulls flying upward and to the "
      "right, each folded from a slightly different paper: lined notepaper, an envelope, a postcard, "
      "pale blue airmail, ledger paper. They get smaller towards the top right corner. Nothing else in "
      "the picture but soft pencil clouds. Hopeful and light.", CG)

# --------------------------------------------------------------------------- icons + logo
def icons(name, cells):
    lines = [
        "Use case: stylized-concept",
        "Asset type: icon sheet for the menus of a hand-drawn RPG",
        "Subject: sixteen separate small icons in a strict grid of 4 rows x 4 columns, one icon per "
        "cell, reading order left to right and top to bottom. Each icon is a single object drawn from "
        "the front, centred in its cell, roughly the same size as the others, with wide empty space "
        "around it and nothing touching its neighbours.",
    ]
    lines += ["Cell %d: %s" % (i + 1, c) for i, c in enumerate(cells)]
    lines += [STYLE_OBJ, AV_SHEET]
    w(name, lines)


icons('sheet_icon_glass.txt', [
    "a jagged shard of frosted sea glass, deep red.",
    "a jagged shard of frosted sea glass, cornflower blue.",
    "a jagged shard of frosted sea glass, warm amber.",
    "a jagged shard of frosted sea glass, leaf green.",
    "a smooth rounded tumbled pebble of frosted sea glass, deep red, with a soft highlight.",
    "a smooth rounded tumbled pebble of frosted sea glass, cornflower blue, with a soft highlight.",
    "a smooth rounded tumbled pebble of frosted sea glass, warm amber, with a soft highlight.",
    "a smooth rounded tumbled pebble of frosted sea glass, leaf green, with a soft highlight.",
    "a dull heavy grey beach pebble, egg shaped, with a faint dark seam.",
    "a dented tin can with a loop of white string tied through a hole near its rim.",
    "a postage stamp with perforated edges, pale blue, showing a tiny lighthouse.",
    "a small pair of cartoon lungs puffing out two curls of breath, pale pink, to mean winded.",
    "a hot little storm cloud with two cross eyebrows and one zigzag, red-orange, to mean angry.",
    "a soft turquoise wave curl with three calm sparkles above it, to mean soothed.",
    "a mouth closed by a neat criss-cross of white string, to mean unable to speak.",
    "a small round pot lid held up like a shield with one string handle, cream and grey, to mean "
    "protected.",
])

icons('sheet_icon_items.txt', [
    "an open paper cone of chips (french fries), cream paper, golden chips.",
    "a small white tub of mushy peas with a wooden fork in it.",
    "a pale pickled egg in a small glass jar of vinegar.",
    "a paper bag of crispy batter scraps.",
    "a battered tartan vacuum flask of tea with its cup on top.",
    "a pink and white stick of seaside rock sweet in a twist of cellophane.",
    "a torn page of a tide table: a page of ruled paper with wavy pencil squiggles for rows.",
    "a square darned patch of oatmeal knitted wool with visible cross-stitch mending.",
    "a single bright orange shoelace coiled in a loose loop.",
    "a home-made medal: a pickled egg shape on a red ribbon.",
    "a small round enamel badge, cream with a plain circle, hanging on a pin.",
    "a second-class postage stamp with perforated edges, plain reddish brown, no picture.",
    "a single grey and white seagull feather.",
    "a round pearl button with four stitch holes, faint rainbow sheen.",
    "a small printed paper slip curling at one end, blank, pearl white.",
    "a seaside postcard seen from the back, cream, with a stamp in the corner and wavy squiggles where "
    "the handwriting would be.",
])

w('ui_logo.txt', [
    "Use case: stylized-concept",
    "Asset type: decorative emblem for the title screen of a hand-drawn RPG",
    "Subject: a single decorative emblem with NO writing of any kind: a dented tin can lying on its "
    "side with a taut white string running out of it and looping into a wide horizontal arc, and along "
    "the string three small pieces of frosted sea glass in red, amber and green strung like beads; "
    "below the arc a thin wavy pencil line of tide water and two tiny shells. Centred, symmetrical "
    "enough to sit above a title, with wide empty space around it.",
    STYLE_OBJ,
    "Avoid: any text, letters, words, labels, numbers, watermarks, signatures, grid lines, borders, "
    "frames, cast shadows, background scenery, extra objects.",
])

for fname, body in sorted(files.items()):
    (OUT / fname).write_text(body)
print("wrote %d prompt files to %s" % (len(files), OUT))
