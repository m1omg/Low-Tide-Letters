#!/bin/sh
# Turn every raw generation that exists in art_raw/ into finished assets/img/... art.
# Safe to re-run: each step is skipped when its raw image has not been generated yet.
# Run from the project root:   sh tools/art/batches/process_all.sh
#
# Generation itself is resumed with (gen_image.py caches by prompt, so finished images are skipped):
#   python3 tools/art/gen_batch.py tools/art/batches/02_t1.json --workers 3
#   python3 tools/art/gen_batch.py tools/art/batches/03_t2.json --workers 3
#   python3 tools/art/gen_batch.py tools/art/batches/04_t3.json --workers 3
cd "$(dirname "$0")/../../.." || exit 1
P=python3
has() { [ -f "art_raw/$1.png" ]; }

# --- walk sheets ------------------------------------------------------------------------------
# children keep the default 150 px figure height, adults are 168 px so they tower over the party.
has chars/pop_walk       && $P tools/art/slice_chars.py art_raw/chars/pop_walk.png       --id pop       --height 168
has chars/mum_walk       && $P tools/art/slice_chars.py art_raw/chars/mum_walk.png       --id mum       --height 168
has chars/mr_brill_walk  && $P tools/art/slice_chars.py art_raw/chars/mr_brill_walk.png  --id mr_brill  --height 168
has chars/towns_a_walk   && $P tools/art/slice_chars.py art_raw/chars/towns_a_walk.png   --id towns_a   --height 166
has chars/towns_b_walk   && $P tools/art/slice_chars.py art_raw/chars/towns_b_walk.png   --id towns_b   --height 162
has chars/robin_walk     && $P tools/art/slice_chars.py art_raw/chars/robin_walk.png     --id robin     --height 112

# --- portrait sheets --------------------------------------------------------------------------
has faces/pop_sheet && $P tools/art/slice_grid.py art_raw/faces/pop_sheet.png --rows 2 --cols 2 \
    --kind face --prefix face_pop_ --names neutral,twinkle,concerned,whistling --preview-name face_pop_grid
has faces/grownups_sheet && $P tools/art/slice_grid.py art_raw/faces/grownups_sheet.png --rows 2 --cols 3 \
    --kind face --prefix face_ --names mum_neutral,mum_soft,mum_worried,mr_brill_neutral,mr_brill_booming,mr_brill_flat \
    --preview-name face_grownups_grid

# --- terrain swatch sheets --------------------------------------------------------------------
has terrain/shore && $P tools/art/make_terrain.py art_raw/terrain/shore.png --grid 3x3 --preview-name shore_terrains \
    --names "cobbles,grass_verge,shingle,wet_sand,rock,cliff,sea,floorboards=pattern:0x4,wall_plaster"
has terrain/lull && $P tools/art/make_terrain.py art_raw/terrain/lull.png --grid 3x3 --preview-name lull_terrains \
    --names "pale_sand,shallows,envelope_paper,deep_water,reef_rock,coral_floor,ledger_paper=pattern:0x6,mirror_water,stair_stone"
has terrain/deep && $P tools/art/make_terrain.py art_raw/terrain/deep.png --grid 3x3 --preview-name deep_terrains \
    --names "spiral_stone,dark_boards=pattern:0x4,light_wall,fog,ink_dark,pearl_floor,nacre_wall,lino_check=pattern:2,_"

# --- prop sheets (tile widths come straight from DESIGN_BIBLE 10.3) ----------------------------
has props/shore && $P tools/art/cut_objects.py art_raw/props/shore.png --preview-name obj_shore --max-height-tiles 6 \
    --spec "house_terrace:4,house_tolet:4,chippy_front:4,postbox:1,lobster_pots:2,bench:2,groyne:3,boat_upturned:3,lighthouse:3"
has props/home && $P tools/art/cut_objects.py art_raw/props/home.png --preview-name obj_home \
    --spec "bed:2,table:2,kitchen_counter:3,coat_hook:1,bookshelf:2,chippy_counter:3,fryer:2,sign_closing:2,window_can:1"
has props/lull_a && $P tools/art/cut_objects.py art_raw/props/lull_a.png --preview-name obj_lull_a --max-height-tiles 5 \
    --spec "rock_pool:2,pigeonhole_cliff:3,pigeonhole_bin:1,mail_sack:1,stamp_flower:1,postbox_shelley:1,mail_slot_door:2,letter_pile:1,can_post:1"
has props/lull_b && $P tools/art/cut_objects.py art_raw/props/lull_b.png --preview-name obj_lull_b --max-height-tiles 3.5 \
    --spec "horn_coral_big:3,horn_coral_small:1,horn_pipe:1,sunk_clock:1,intray_stack:1,ironing_board:2,vending_machine:1,washing_line:3,stair_hatch:2"
has props/lull_c && $P tools/art/cut_objects.py art_raw/props/lull_c.png --preview-name obj_lull_c \
    --spec "lamp_lens:3,radio_valve:1,pearl_big:2,pearl_small:1,bedroom_door:2,bench_lull:2,gull_pair:2,snail_stan:1,gull_picket:2"   # the two small pearls merge into one component, so the heap has no image of its own
has props/lull_c && $P tools/art/placard_text.py      # letters SQUAWK on the picket gull's blank placard
has props/shore_b && $P tools/art/cut_objects.py art_raw/props/shore_b.png --preview-name obj_shore_b \
    --spec "washing_line_town:3,streetlamp:1,crates:2,rowboat:3,boulder:2,rock_pool_small:1,jam_jar:1,biscuit_tin:1,radio_bench:2"

# --- enemies ----------------------------------------------------------------------------------
for e in thank_you_card sorry_crab reply_all toot blank_postcard listworm overdue_notice \
         chain_letter draft_47 echo static pearl_drip \
         boss_postmaster_gull boss_perfectly_fine boss_nacre other_can; do
  has "enemies/$e" && $P tools/art/cutout.py "art_raw/enemies/$e.png" --id "$e" --main-only
done
# the five named Unsent are tints of the bases above (no image budget)
$P tools/art/tint_kept.py

# --- battle backgrounds and CGs ---------------------------------------------------------------
for b in lull_day undertow dark_bedroom pearl_bed blare_reef slack_water; do
  has "bb/$b" && $P tools/art/fit_screen.py "art_raw/bb/$b.png" --kind bb --id "$b"
done
for c in prologue_glass tide_steps ending_sent the_rocks nobody_leaves not_yet pearl_calm \
         lin_asleep den_jar credits_gulls; do
  has "cg/$c" && $P tools/art/fit_screen.py "art_raw/cg/$c.png" --kind cg --id "$c"
done

# --- icon sheets and the logo -----------------------------------------------------------------
has icons/glass && $P tools/art/slice_grid.py art_raw/icons/glass.png --rows 4 --cols 4 --kind icon --prefix icon_ \
    --names glass_red,glass_blue,glass_amber,glass_green,tumbled_red,tumbled_blue,tumbled_amber,tumbled_green,pebble,can_line,stamp,winded,riled,soothed,tongue_tied,shielded \
    --preview-name icon_glass_grid
has icons/items && $P tools/art/slice_grid.py art_raw/icons/items.png --rows 4 --cols 4 --kind icon --prefix icon_ \
    --names bag_of_chips,mushy_peas,pickled_egg,scraps,flask_of_tea,stick_of_rock,tide_table_page,darned_patch,orange_lace,egg_medal,doing_fine_token,second_class_stamp,gull_feather,pearl_button,nacres_slips,tams_postcard \
    --preview-name icon_items_grid
has ui/logo && $P tools/art/trim_logo.py               # the wide emblem, trimmed (not squared)

# --- contact sheets to look at, then the manifest ----------------------------------------------
$P tools/art/contact_sheet.py "assets/img/objects/obj_*.png"  --out art_raw/_preview/all_objects.png  --bg split
$P tools/art/contact_sheet.py "assets/img/enemies/en_*.png"   --out art_raw/_preview/all_enemies.png  --bg split
$P tools/art/contact_sheet.py "assets/img/terrain/ter_*.png"  --out art_raw/_preview/all_terrain.png
node tools/build.js
