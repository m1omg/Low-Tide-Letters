# tools/art - art pipeline

Python 3 + Pillow + numpy only (no scipy, no opencv). Every tool is a CLI script **and** an importable
module. Relative paths are resolved against the project root, so the tools can be started from anywhere.
Every tool logs to stderr, prints the written asset path(s) on stdout and drops a preview into
`art_raw/_preview/` - **look at the preview before you ship the asset**.

```
raw generation (art_raw/...)           tool                    game asset (assets/img/...)
----------------------------------------------------------------------------------------------------
(prompt)                               gen_image.py            art_raw/<name>.png + <name>.prompt.txt
4x3 walk sheet                         slice_chars.py          chars/char_<id>.png + .json
expression sheet / icon sheet / bust   slice_grid.py           faces/face_<spk>_<expr>.png, icons/icon_<id>.png
prop sheet                             cut_objects.py          objects/obj_<name>.png
ground swatch sheet                    make_terrain.py         terrain/ter_<name>.png
single enemy illustration              cutout.py               enemies/en_<id>.png + .json
background / CG                        fit_screen.py           battlebacks/bb_<id>.jpg, cg/cg_<id>.jpg
any images                             contact_sheet.py        art_raw/_preview/<anything>.png
```
After adding assets run `node tools/build.js` (regenerates the manifest; sidecar `.json` files are merged
into the manifest entry).

## Background handling (all cut-out tools)

Raw generations come in two flavours and every cut-out tool handles both (`--bg auto` decides):

* **real alpha** (what the image model normally returns when a transparent background is requested).
  The raw matte is dirty: alpha 1-60 carries saturated red/yellow garbage and there is a whitish paper
  halo up to about alpha 215. `common.defringe_alpha` fixes this at raw scale: alpha levels
  (150..245 -> 0..1, which also pulls the edge in by about one raw pixel), interior forced opaque, and
  every pixel whose raw alpha is below 240 gets its colour from the nearest trusted interior pixels
  (colour bleed). Downscaling happens afterwards with premultiplied LANCZOS.
* **flat white / paper background** (`--bg white`): flood fill from the image borders through near-paper
  pixels (`--tol`, default 26), 1-px leaks are closed first, so *enclosed* whites (eyes, teeth, a white
  ghost inside its outline) survive. The rim gets a soft, un-mixed "colour to alpha" edge.
  Enclosed paper regions are kept by default. Opt-in fixes:
  `--pockets N` clears pockets that are only separated from the outside by lines thinner than N raw px
  (gaps between hair strands; try 8), `--holes N` clears **every** enclosed paper region of at least N raw
  px (gaps under a table, inside a handle; try 150; props only - it would also remove white eyes).

Prefer transparent generations; the paper path is the fallback.

## gen_image.py - generate one raw image with Codex

```
python3 tools/art/gen_image.py --name chars/mira_walk --prompt-file tools/art/prompts/mira_walk.txt
python3 tools/art/gen_image.py --name rnd/boat --prompt "A cute hand-drawn ... Avoid: text, letters, ..."
    [--style-file docs/style_block.txt]   text put in front of the prompt (STYLE BLOCK of the bible)
    [--transparent]                       appends the standard transparent-background sentence
    [--aspect square|portrait|landscape]  appends a format hint (1:1 / 3:4 / 4:3)
    [--force] [--timeout 600] [--retries 2] [--pause 20] [--effort low] [--log-dir DIR]
```
* Output: `art_raw/<name>.png` and the final prompt in `art_raw/<name>.prompt.txt` (provenance).
* stdout is exactly ONE JSON line:
  `{"ok":true,"path":"art_raw/rnd/boat.png","width":1254,"height":1254,"has_alpha":true,"seconds":63.2,"attempts":1,"cached":false}`
  Exit code 0 = ok, 1 = failed after all retries, 2 = Codex usage limit reached (`"usage_limit":true`,
  no retries are made because they cannot succeed; the Codex message with the reset time is in `"error"`).
* Cache: when the PNG exists and the stored prompt is identical, nothing is generated (`"cached":true`).
  Change the prompt or pass `--force` to regenerate. Batch scripts can therefore simply be re-run.
* Safe to run 3 instances concurrently: Codex writes to a unique `art_raw/_tmp/gen_*.png`, the wrapper
  verifies that the file decodes as an image and only then moves it to its final name. Companion logs go
  to `<system tmp>/fable51_gen_logs/` (deleted on success, tail printed on failure).
* The instruction text tells Codex: built-in image tool, exactly ONE image, copy the PNG, never draw with
  code, never read other directories or memories. The prompt itself must start with the STYLE BLOCK and
  end with an explicit `Avoid:` line (TECH_SPEC section 9).
* Import: `from gen_image import generate_image` -> `generate_image(name, prompt, style=None,
  transparent=False, aspect=None, force=False, timeout=600, retries=2, pause=20)` returns the same dict.

## slice_chars.py - walk sheet -> char_<id>.png

```
python3 tools/art/slice_chars.py art_raw/chars/mira_walk.png --id mira
    [--height 150]                     standing FRONT figure height in real px (150 of the 176 px frame)
    [--rows-order down,left,right,up]  what the sheet rows show top to bottom (default = as generated:
                                       front, left, right, back)
    [--cols-order stepA,stand,stepB]   what the sheet columns show left to right
    [--swap-lr]                        the sheet has its left/right rows mixed up
    [--mirror left|right]              build the OTHER side row by mirroring this one (consistent sides)
    [--per-row-height]                 give every row the same standing height (rows drawn at other scales)
    [--bob 2]                          step frames sit N real px lower than the stand frame
    [--bg/--tol/--pockets/--holes]     background handling, see above
    [--out-dir assets/img/chars] [--preview-dir DIR]
```
Output: `char_<id>.png` 384x704 (3 cols stepA/stand/stepB x 4 rows down/left/right/up, frame 128x176)
and `char_<id>.json` `{"frameW":128,"frameH":176}`.
How: defringe at raw scale -> 12 figures by connected components (fragments merged per cell; falls back
to an even grid / cutting along the grid lines when figures touch) -> ONE uniform scale -> each frame is
resampled in a single LANCZOS pass with sub-pixel placement: x = centroid of the HEAD region (upper 40 %)
on the frame centre; stand frames put the feet on the baseline (8 px above the frame bottom); step frames
align their head to the stand frame of the same row (row-profile matching, robust against hair wisps)
plus `--bob`, so the body never jitters. The log prints `feet_dev` (how far the lowest foot of a step
frame ends below the baseline; limited to -2..+6 px) and warns when a frame touches the frame border.
Previews: `char_<id>_sheet.png` (2x, centre + baseline guides, 4th column = onion skin of the 3 frames:
a sharp head means no jitter) and `char_<id>_walk.gif` (all 4 directions walking).
CHECK in the preview that the "left" row really faces left; if not use `--swap-lr`.

## slice_grid.py - expression sheets, icon sheets, single busts

```
python3 tools/art/slice_grid.py art_raw/faces/mira_sheet.png --rows 2 --cols 3 --kind face \
    --prefix face_mira_ --names neutral,happy,sad,angry,scared,cry
python3 tools/art/slice_grid.py art_raw/icons/items_a.png --rows 4 --cols 4 --kind icon \
    --prefix icon_ --names potion,ether,key,_,map,bell
python3 tools/art/slice_grid.py art_raw/test_portrait.png --kind face --prefix face_test_ --names neutral
    --names a,b,c      reading order; "_" (or "-"/"skip") skips a cell; fewer names than cells is fine
    --kind face|icon   presets, see below       --size N   output square (256 faces, 64 icons)
    --anchor bottom|center|top     --hcenter bbox|head     --uniform | --no-uniform
    --zoom 1.0         >1 enlarges; whatever leaves the frame is cut (use with --anchor top for busts)
    --margin N         --main-only | --keep-all            --keep-bg
    --bg/--tol/--pockets/--holes   --out-dir DIR   --prefix P   --preview-name NAME
```
* `--kind face`: 256x256 into `assets/img/faces`, bottom anchored, ONE scale for the whole sheet and the
  heads of all expressions aligned to the first one (the face does not jump when the expression changes),
  stray doodles far from the bust (sparkles, text, sweat drops drawn far away) are dropped (`--keep-all`
  keeps them). The game shows portraits at 128x128 logical px.
* `--kind icon`: 64x64 into `assets/img/icons`, centred, each icon fitted on its own, margin 3.
* Default is a cut-out bust with alpha. `--keep-bg` keeps the cell background instead and only rounds the
  corners softly (transparent sheets are put on the paper colour first).
* Output name = `<prefix><name>.png`, e.g. `face_mira_happy.png`.

## cut_objects.py - prop sheet -> obj_<name>.png

```
python3 tools/art/cut_objects.py art_raw/props/park_a.png \
    --spec "tree_round:2,pine:1.5,bush_pink:1.5,signpost:1,boulder:1.5,bench:2,lamp_post:1,mailbox:1,picnic_table:2"
    [--spec-file spec.txt]         one "name:tiles" per line, '#' comments
    [--grid 3x3]                   the props sit on an even grid (use when a prop has several BIG detached
                                   parts or the tool reports a wrong count)
    [--prefix obj_] [--out-dir assets/img/objects] [--max-height-tiles 4.5] [--margin 2]
    [--bg/--tol/--holes] [--preview-name NAME]
```
`name:tiles` in reading order; final image width = tiles x 96 real px (incl. the 2 px transparent margin),
height capped at 4.5 tiles (432 px; the width shrinks proportionally then). `_` skips a prop (write
`--spec=-,a:1` or use `_` when the list starts with a skip). The N biggest components are the props
(N = number of spec entries), rows are found by clustering, smaller detached fragments are merged into the
nearest prop, far-away specks are dropped. The engine anchors the image bottom-centre on the base tile.

## make_terrain.py - swatch sheet -> seamless ter_<name>.png

```
python3 tools/art/make_terrain.py art_raw/terrain/ground_a.png --grid 3x3 \
    --names "grass,forest_grass,dirt,cobble,planks=pattern:0x4,water,carpet,checker=pattern:2,void"
    [--size 192|288] [--mode blend|pattern:<n>|pattern:<nx>x<ny>] [--overlap 0.22] [--inset 0.035]
    [--flatten 0.6] [--prefix ter_] [--out-dir assets/img/terrain] [--format png|jpg] [--preview-name N]
```
* Cells are found by their gutters (transparent or light lines), fallback = even split; each swatch is
  cropped well inside its border. `--grid 1x1` takes a single swatch image.
* `blend` (default): wrap-around cross-blend on both axes. Low frequencies are cross-faded, details switch
  along a minimum-error seam, so tufts/stones are not ghosted. `--flatten` removes large brightness
  blotches that would make the repetition obvious (0 = off).
* `pattern:<n>`: for REGULAR patterns (checker tiles, planks, bricks). The period is measured by
  autocorrelation, exactly n periods are cropped per axis, only a narrow seam is blended and the block is
  rolled so a pattern edge lies on the block (= tile) boundary. `pattern:<nx>x<ny>` sets the axes
  separately, `0` = "not periodic on this axis, use blend" (planks: `pattern:0x4` = 4 planks per block,
  i.e. 2 per tile). An axis without a clear period falls back to blend (logged).
  With 192 px blocks (2x2 tiles): `pattern:2` on a checker = 4 squares per block side = 2 per tile.
* Per swatch overrides with `name=mode`; `_` skips a swatch.
* ALWAYS written: `art_raw/_preview/ter_<name>_tiled.png` (5x5 tiling, red ticks in the margin mark the
  block boundaries) and an overview sheet. The log prints a seam score per axis (colour jump across the
  wrap relative to normal neighbouring lines; about 1.0 = invisible, > 1.6 is flagged).

## cutout.py - single illustration -> en_<id>.png

```
python3 tools/art/cutout.py art_raw/enemies/moth.png --id moth
    [--max-side 640] [--main-only] [--near 2.5] [--min-area 40]
    [--bg/--tol/--pockets/--holes] [--prefix en_] [--out-dir assets/img/enemies] [--no-sidecar]
```
Defringed, trimmed alpha PNG, longest side <= 640 (never upscaled). All parts are kept (enemies may have
floating bits) except specks below `--min-area` raw px; `--main-only` also drops everything further than
`--near` percent of the image side from the main shape (stray text, doodles). Sidecar
`en_<id>.json` = `{"mapScale": s}` where s scales the LOGICAL size to the roaming map sprite
(about 56 logical px high, at most 80 wide).

## fit_screen.py - backgrounds and CGs

```
python3 tools/art/fit_screen.py art_raw/bb/forest.png --kind bb --id forest          -> battlebacks/bb_forest.jpg
python3 tools/art/fit_screen.py art_raw/cg/title.png --kind cg --id title --focus 0.5,0.35
    [--size 1536x1152] [--quality 88] [--matte "#f6f1e4"] [--out path.jpg]
```
Cover crop to 4:3 around `--focus x,y` (0-1), LANCZOS, JPEG q88. Transparent sources are put on `--matte`.
Preview `<id>_fit.jpg` shows the crop rectangle on the source next to the result.

## make_stairs.py - the house staircase, without a generation

`obj_stairs_wood.png` (Wren's house, both ends of the stairs) is not a Codex image: no staircase prop was
ever generated and the Lull's `obj_stair_hatch` does not belong indoors. `python3 tools/art/make_stairs.py`
builds it from `ter_floorboards.png` (treads and risers cut from the boards, a wobbly pencil outline, a
handrail) and drops the usual preview. Re-run it if the floorboard tile is ever regenerated.

## placard_text.py - SQUAWK on the picket gull

Prompts forbid writing, so the striking gull comes out with a blank board. `python3 tools/art/placard_text.py`
letters SQUAWK on `obj_gull_picket.png` in GochiHand (in place; `process_all.sh` runs it after cutting lull_c).

## contact_sheet.py - look at many images at once

```
python3 tools/art/contact_sheet.py "assets/img/objects/obj_*.png" --out art_raw/_preview/objects.png
    [--cell 256] [--cols N] [--bg checker|dark|light|split] [--no-upscale] [--title TEXT]
```
`--bg split` = left half dark, right half light: light halos AND dark fringes both become visible.
Import: `from contact_sheet import make_contact_sheet` (accepts paths or numpy arrays).

## common.py - shared helpers (importable)

`load_rgba, save_png, write_json, has_real_alpha, prepare_cutout(arr, bg, tol, pockets, holes),
defringe_alpha, paper_to_alpha, bleed_colors, dilate, erode, box_blur, label_components (run based
union-find CCL, 8-connected), flood_from_border, detect_items(mask, rows, cols | count), extract_item,
prune_far_fragments, measure_figure, render_to_frame (single-pass sub-pixel LANCZOS placement),
resize_rgba (premultiplied), trim, paste, pad_canvas, checkerboard, composite_over, add_bg_args, bg_opts`.
Defringe constants live in `common.DEFRINGE`.

## R&D reference run (what the test assets were made with)

```
python3 tools/art/slice_chars.py  art_raw/rnd/walk_sheet.png --id test
python3 tools/art/cut_objects.py  art_raw/rnd/prop_sheet.png --prefix obj_test_ --preview-name obj_test_objects \
    --spec "tree_round:2,pine:1.5,bush_pink:1.5,signpost:1,boulder:1.5,bench:2,lamp_post:1,mailbox:1,picnic_table:2"
python3 tools/art/make_terrain.py art_raw/rnd/ground_sheet.png --grid 3x3 --prefix ter_test_ --preview-name ter_test_terrains \
    --names "grass,forest_grass,dirt,cobble,planks=pattern:0x4,water,carpet,checker=pattern:2,void"
python3 tools/art/slice_grid.py   art_raw/test_portrait.png --kind face --prefix face_test_ --names neutral --pockets 8 --preview-name face_test_grid
python3 tools/art/cutout.py       <one prop cropped from the prop sheet> --id test
```

## Prompting notes learned from the R&D sheets

* Walk sheets: ask for "4 rows x 3 columns, rows = front, left, right, back; columns = left foot forward,
  standing, right foot forward; same character, same size in every cell, generous empty space between
  figures, transparent background". 1086x1448 (3:4) works well.
* Prop sheets: 3x3 on a transparent background, "each prop complete, not touching its neighbours".
* Ground sheets: 3x3 flat top-down swatches separated by thin gutters, "no perspective, no borders, no
  objects crossing a swatch edge". Regular patterns should show at least 2.5 periods per swatch.
* Never ask for cast shadows or text; both end up baked into the asset.
