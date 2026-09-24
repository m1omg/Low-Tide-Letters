# TECH SPEC — engine, data formats, asset pipeline

This is the binding technical contract for everyone building the game. The creative source of truth is
`docs/DESIGN_BIBLE.md`; the battle rules and all content ids come from there. Where this spec and the
bible disagree on a *technical* matter, this spec wins; on a *creative* matter, the bible wins.

Project root: `/home/mroz/Dokumenty/fable51omorilike` (called `ROOT` below).

## 0. Ground rules

- **Originality / file access.** Never read, list or search anything outside `ROOT` (exception: system
  tools, the soundfont, and your own scratch space). The user's drives hold other, similar game projects
  and the user explicitly forbade borrowing from them. Do not copy code, text, maps, music or art from
  any existing game or project. Everything is written fresh.
- **No build step, no frameworks, no ES modules.** Plain classic `<script>` files attached to one global
  namespace `window.G`. The game must run both from `http://localhost` (via `serve.js`) **and** by opening
  `index.html` directly from `file://`. Therefore: no `import`/`export`, no `fetch()` of JSON for game data
  (all data lives in `.js` files that register themselves), and every `fetch()` used for audio must have an
  `HTMLAudioElement` fallback.
- **File ownership.** Each agent only creates/edits the files assigned to it. If you need a change in a
  file you do not own, report it in your final message instead of editing it.
- **Robustness.** A missing image must never crash the game: `G.Assets.img(id)` returns a visible
  placeholder canvas and logs one warning. A missing sound is silently skipped (one warning). Unknown
  event commands log an error and are skipped.
- **Style of code.** ES2020, 2-space indent, semicolons, `'use strict';` inside an IIFE per file,
  JSDoc comment on every public function. No external libraries at runtime.
- Text language: English. All player-facing strings live in data files, never hard-coded in engine code
  (except generic UI labels, which live in `G.DATA.strings` in `js/data/strings.js`).

## 1. Screen, units, rendering

| constant | value | meaning |
|---|---|---|
| `G.CONFIG.W`, `H` | 768, 576 | logical resolution (4:3) |
| `G.CONFIG.TILE` | 48 | logical tile size |
| `G.CONFIG.SCALE` | 2 | backing-store density: canvas is 1536x1152 real pixels |
| `G.CONFIG.FPS` | 60 | fixed-step update rate (`update()` is called in 1/60 s steps) |

- All game code works in **logical pixels**. `G.Gfx` applies `ctx.setTransform(SCALE,0,0,SCALE,0,0)` before
  scenes draw. The canvas is CSS-scaled to fit the window (letterboxed, aspect preserved,
  `image-rendering: auto` – the art is hand-drawn, not pixel art, so smooth scaling is correct).
- **All raster assets are authored at 2x**: an image that is 96x96 real pixels covers 48x48 logical
  pixels. `G.Assets.img(id)` returns the image; `G.Assets.size(id)` returns its **logical** `{w,h}`
  (real size / 2). Drawing helper: `G.Gfx.drawImg(id, x, y, opts)` draws at logical size.
- Fonts (bundled, OFL): `PatrickHand` (body text, UI) and `GochiHand` (titles, big emotive text), loaded
  with `@font-face` from `assets/fonts/`. Default body size 24 logical px. Always wait for
  `document.fonts.ready` before the title screen.
- "Boil": hand-drawn sprites feel alive through a cheap line-boil: `G.Gfx.boil(seed)` returns a small
  `{dx,dy,rot,sx,sy}` jitter that changes ~6 times per second. Used for portraits, battle enemies, CGs,
  title logo. Never for ground tiles.
- Paper look: after every scene draw, `G.Gfx` composites a subtle paper-grain overlay (`ui_paper`,
  multiply, low alpha) and a soft vignette. Can be disabled in Options.

## 2. File layout

```
ROOT/
  index.html            start.sh  start.bat  serve.js  README.md
  css/style.css
  js/core/   boot.js util.js input.js assets.js audio.js gfx.js text.js ui.js state.js scene.js
  js/map/    entities.js interpreter.js map_scene.js
  js/battle/ battle_logic.js battle_ai.js battle_ui.js battle_scene.js
  js/scenes/ title_scene.js menu_scene.js gameover_scene.js ending_scene.js
  js/data/   strings.js terrains.js objects.js speakers.js actors.js skills.js items.js enemies.js
             troops.js common_events.js manifest.js (GENERATED)  maps/<map_id>.js
  js/main.js
  assets/img/{chars,faces,enemies,terrain,objects,battlebacks,cg,icons,ui}/   assets/audio/{bgm,sfx}/   assets/fonts/
  art_raw/        raw AI generations (kept for provenance, never loaded by the game)
  tools/art/      python art pipeline + prompt specs     tools/music/  python MIDI composer lib + tracks
  tools/sfx/      python sfx synth                       tools/test/   node validators + headless tests
  tools/build.js  regenerates js/data/manifest.js and the <script> list in index.html
  docs/           DESIGN_BIBLE.md TECH_SPEC.md
```

`index.html` contains two marker comments, `<!-- BUILD:SCRIPTS:START -->` and `<!-- BUILD:SCRIPTS:END -->`.
`node tools/build.js` rewrites everything between them with `<script src>` tags in this order:
core (in the order listed above), map, battle, scenes, data (non-map files, then `manifest.js`, then every
`js/data/maps/*.js` alphabetically), then `js/main.js`. It also regenerates `js/data/manifest.js` by scanning
`assets/` (see section 8). Run it after adding any file.

## 3. Core API (namespace `G`)

```
G.CONFIG                         constants above, plus DEBUG (true when URL has ?debug=1)
G.DATA                           { strings, terrains, objects, speakers, actors, skills, items, enemies,
                                   troops, commonEvents, maps, manifest }
G.registerMap(id, def)           called by each js/data/maps/<id>.js
G.errors                         array of captured runtime errors/warnings (window.onerror + G.warn/G.error)
G.warn(msg) / G.error(msg)       log once per distinct message, push into G.errors

G.Util      clamp, lerp, randInt(a,b), choice(arr), shuffle, deepClone, ease{inOut,out,...},
            makeRng(seed) -> () => float        (battle logic uses G.Util.rng which tests can reseed)
G.Input     update(); isDown(a); pressed(a); repeated(a); simulate(a, isDown); anyPressed()
            actions: 'up','down','left','right','confirm','cancel','menu','run','debug'
            keys: arrows/WASD; Z/Enter/Space=confirm; X/Escape/Backspace=cancel (+menu on map); Shift=run
G.Assets    init(); img(id); has(id); size(id) -> {w,h} logical; meta(id) -> manifest entry;
            preload(ids, onProgress) -> Promise; preloadAll(onProgress)
G.Audio     init(); unlock(); playBgm(id,{fadeMs=600,volume=1}); stopBgm(fadeMs); fadeBgm(toVol,ms);
            saveBgm()/restoreBgm() (battle enters/leaves, resumes at saved position);
            playSfx(id,{volume=1,rate=1}); playAmbience(id)/stopAmbience();
            setVolume('bgm'|'sfx', 0..1); currentBgm
G.Gfx       canvas, ctx; begin()/end() per frame; drawImg(id,x,y,{w,h,alpha,flipX,rot,anchorX,anchorY,
            sx,sy,sw,sh}); panel(x,y,w,h,{fill,stroke,seed}) – hand-drawn wobbly box;
            text(str,x,y,{size,color,font,align,baseline,outline,maxWidth}); measure(str,{size,font});
            boil(seed); screen effects: fadeOut(frames)/fadeIn(frames) -> Promise, flash(color,frames),
            shake(power,frames), setTint([r,g,b,a],frames), updateEffects(), drawEffects()
G.Text      parse/layout of rich text (section 5); G.Text.layout(str,{maxWidth,size}) -> lines of glyph runs
G.UI        MessageBox, ChoiceBox, ListMenu, Gauge, Toast (section 5)
G.State     newGame(); party (array of actor instances, order = battle order); reserve; inventory {id:n};
            money; flags {}; vars {}; map {id,x,y,dir}; playtimeFrames; options {bgmVol,sfxVol,textSpeed,
            paper}; getFlag/setFlag/getVar/setVar; addItem/removeItem/itemCount; addMember/removeMember;
            actor(id); save(slot) / load(slot) -> bool / slotInfo(slot) / hasAnySave(); SAVE_VERSION
            localStorage keys: 'fable51.save.<slot>' (slots 1-3), 'fable51.options'
G.Scenes    push(scene,params) / pop(result) / replace(scene,params) / clearTo(scene,params); top();
            scenes registered by name: G.Scenes.register('map', obj); scene interface:
            { enter(params), exit(), pause(), resume(result), update(), draw(ctx) }
G.Cond      evaluate(cond) – the condition mini-language (section 4.3), used by events, skills, endings
```

Main loop (`js/main.js`): fixed timestep accumulator at 60 Hz, max 5 catch-up steps; per step:
`G.Input.update(); G.Scenes.top().update(); G.Gfx.updateEffects();` then one draw per animation frame:
`G.Gfx.begin(); for each scene in stack from the lowest opaque one: scene.draw(ctx); G.Gfx.drawEffects(); G.Gfx.end();`
A scene may set `this.opaque = false` (menus, message overlays) so the scene below is drawn first.

### Test/debug hook (mandatory, used by automated QA)

`window.__game` exposes: `G`, `ready` (true once the title is interactive), `scene()` (name of top scene),
`newGame(opts)`, `teleport(mapId,x,y,dir)`, `setFlag(k,v)`, `setVar(k,v)`, `give(itemId,n)`,
`addMember(id)`, `setLevel(n)`, `startBattle(troopId)`, `battleAuto(policy)` (auto-plays the current battle:
`'attack'`, `'smart'`, `'pacifist'`), `press(action, frames=2)`, `run(commands)` (runs an event command list on
the map interpreter, returns a Promise), `advance(frames)` (steps the fixed update N times synchronously,
for fast-forward in tests), `skipText` (boolean: message boxes complete and auto-confirm instantly), `calm` (boolean: chasing Unsent stop catching Wren when they reach her side),
`mapInfo()` -> `{id,w,h,player:{x,y,dir},events:[{id,x,y,page}]}`, `errors()` -> copy of `G.errors`.
With `?debug=1`: F1 toggles collision/event overlay, F2 opens a teleport/flag console, F3 heals party,
F4 wins the current battle.

## 4. Maps, entities, events

### 4.1 Map file format — `js/data/maps/<map_id>.js`

```js
G.registerMap('example_lane', {
  name: 'Example Lane',            // shown on entry (toast) unless hideName:true
  width: 30, height: 20,           // tiles; minimum 16x12 (smaller rooms are centered on a void background)
  bgm: 'track_id' | null,          // null = keep current; 'none' = silence
  ambience: 'amb_id' | null,
  backdrop: '#1a1626',             // color behind/outside the map
  tint: null,                      // optional [r,g,b,a] ambient screen tint (0-255, a 0-1)
  legend: { 'g':'grass', 'p':'path', 'w':'pond_water', '#':'wall_brick', ' ':'void' },  // char -> terrain id
  ground: [                        // exactly `height` strings of exactly `width` chars
    "gggggggggggggggggggggggggggggg",
    ...
  ],
  overrides: { block: [[x,y],...], open: [[x,y],...] },   // optional manual collision fixes
  objects: [                       // static props, y-sorted with characters
    { obj:'tree_round', x:5, y:7 },                 // x,y = BASE TILE (where the prop touches the ground)
    { obj:'lamp_post', x:9, y:7, flipX:true },
  ],
  events: [ ... see 4.2 ... ],
  onEnter: [ ...commands... ],     // optional, runs after fade-in every time the map is entered
});
```

Terrains (`js/data/terrains.js`): `G.DATA.terrains[id] = { img:'ter_grass', passable:true, edge:2,
edgeColor:'#3b5d3a', step:'sfx_step_grass' }`. Ground is drawn by world-aligned tiling of the terrain
texture (texture sizes are multiples of 96 real px; tile (tx,ty) samples source
`((tx*96) % imgW, (ty*96) % imgH)`). Where two different terrains meet, the terrain with the higher `edge`
value draws a wobbly pencil border line in its `edgeColor` (deterministic per map seed) so tile borders look
hand-drawn rather than blocky. `void` terrain draws nothing (backdrop shows) and is impassable.

Objects (`js/data/objects.js`): `G.DATA.objects[id] = { img:'obj_tree_round', fp:[-1,0,2,1], solid:true,
layer:'sort', ox:0, oy:0, anim:null }`.
- The image is drawn with its **bottom-center** at the bottom-center of the base tile
  (`x*48+24+ox`, `y*48+48+oy`). Logical size comes from the manifest (real px / 2).
- `fp` = footprint rectangle `[dx,dy,w,h]` in tiles relative to the base tile (or an array of such
  rectangles). Default `[0,0,1,1]`. Footprint tiles are blocked when `solid` is true.
- `layer`: `'below'` (rugs, floor decals – drawn right after ground), `'sort'` (default; y-sorted with
  characters using the base tile's bottom edge), `'above'` (always on top: hanging lamps, tree canopies).

Collision: a tile is passable iff terrain passable, not inside a solid object footprint, not occupied by a
solid event, and not in `overrides.block` (`overrides.open` force-opens a tile). Movement is tile-based with
smooth interpolation: walking takes 12 frames per tile, running takes 7 frames per tile. The player faces a
direction; `confirm` interacts with the event in the faced tile (or on the player's own tile, or one tile
further when the faced tile holds an object flagged `counter:true`). Party members who are not the leader
follow the leader in a line (classic "caterpillar" followers) and never block movement.

### 4.2 Events

```js
{ id:'mailbox',                    // unique within the map
  x:12, y:8,
  pages: [                         // the LAST page whose cond is true is active (RPG Maker rule)
    { cond: null,                  // section 4.3; null = always
      sprite: { char:'npc_postman', dir:'down' }   // OR { obj:'obj_mailbox' } OR { enemy:'moth' } OR null (invisible)
      solid: true,                 // default true if it has a sprite, false if not
      trigger: 'action',           // 'action' | 'touch' (player steps on / bumps into) | 'auto' (runs once when page becomes active, blocks input) | 'parallel'
      move: { type:'still' },      // 'still' | 'wander' {radius} | 'patrol' {route:[[x,y],...]} | 'chase' {sight:5, speed:..} | 'flee'
      through: false, above: false, facePlayer: true,   // facePlayer: turn toward player when triggered
      commands: [ ... ] }
  ] }
```

Roaming enemy sugar: `{ id:'moth1', x:4, y:9, enemy:{ troop:'troop_moths', sprite:'moth', move:{type:'chase',sight:5},
respawn:true, cond:{notFlag:'ch1_done'} } }` expands to a touch-trigger page that starts the battle; on victory or
peaceful resolution the event disappears until the map is re-entered (`respawn:true`) or forever (`respawn:false`,
stored in a self flag). Map sprites for enemies reuse the battle illustration scaled to about 56 logical px
high (`meta.mapScale`) with a gentle bob.

**Self flags**: `['setSelf','A',true]` and cond `{self:'A'}` are per-event persistent flags (keyed
`mapId:eventId:A` in `G.State.flags`).

### 4.3 Conditions

`null` (true) | `{flag:'k'}` | `{notFlag:'k'}` | `{var:['k','>=',3]}` (ops `== != > >= < <=`) |
`{hasItem:'id'}` | `{inParty:'actorId'}` | `{self:'A'}` | `{notSelf:'A'}` | `{all:[...]}` | `{any:[...]}` | `{not:cond}`

### 4.4 Event commands (arrays; first element = command name)

Dialogue and flow
- `['say', speakerId|null, expr|null, 'text']` – message box with name tag + portrait (if the speaker has faces).
  `expr` falls back to `'neutral'`. Text supports the markup of section 5.
- `['narrate', 'text']` – no name/portrait, italic, centered-box style. `['think','text']` – protagonist's
  inner voice (dim box, no portrait).
- `['choice', ['Option A','Option B',...], [[cmds A],[cmds B],...], {cancel: index|-1, varName:'k'}]`
- `['if', cond, [then cmds], [else cmds]]`   `['label','x']` / `['goto','x']` (within the same list)
- `['call','commonEventId']`   `['wait', frames]`   `['end']` (stop this event)
State
- `['setFlag','k',true|false]`  `['setVar','k','='|'+'|'-', n]`  `['setSelf','A',true]`
- `['giveItem','id',n]` (shows a toast + sfx) `['takeItem','id',n]` `['giveMoney',n]`
- `['addMember','actorId']` `['removeMember','actorId']` `['healAll']` `['giveExp',n]`
- `['save']` opens the save UI   `['shop',['itemId',...]]`
Staging
- `['transfer','mapId',x,y,'down',{fade:'black'|'white'|'none'}]`
- `['move', 'player'|'eventId'|'this', [route steps], {wait:true}]` – steps: `'up'|'down'|'left'|'right'`,
  `'face_up'...`, `'jump'`, `['wait',n]`, `['speed',n]`, `'hide'`, `'show'`, `['to',x,y]` (pathfind)
- `['face','player'|'eventId', dir|'toward_player'|'away']`  `['emote','player'|'eventId','!'|'?'|'...'|'heart'|'sweat'|'anger'|'tear'|'note']`
- `['fade','out'|'in',frames,'black'|'white']` `['flash','#fff',frames]` `['shake',power,frames]`
  `['tint',[r,g,b,a]|null,frames]`
- `['cg','cg_id'|null,{fade:30}]` – show/hide a full-screen illustration above the map (below message box)
- `['bgm','id'|'none',{fadeMs}]` `['bgmFade',ms]` `['sfx','id']` `['ambience','id'|null]`
- `['camera','player'|[x,y]|'eventId',frames]`  `['setSprite','eventId',spriteSpec]` `['erase','eventId']` (until re-entry)
Battle and endings
- `['battle','troopId',{canEscape:true, bgm:'id', back:'bb_id', onWin:[cmds], onPeace:[cmds], onLose:[cmds]|'gameover', onEscape:[cmds]}]`
- `['ending','ending_id']` → ending scene.  `['title']` → back to title.  `['gameover']`.
- `['custom','name',args]` – calls `G.Interpreter.custom[name](args, ctx)`; returns a Promise or nothing.
  Used for puzzles with bespoke UI. Keep these rare and defined in `js/map/interpreter.js` or a data file.

The interpreter is async (one running "main" event blocks player input; `parallel` events run alongside).
Message boxes, choices, waits, moves with `wait:true`, fades, battles all suspend the command list until done.

## 5. Text and UI

Rich text markup inside strings: `\n` newline, `{c:red}…{/c}` color (named palette in `G.DATA.strings.colors`),
`{shake}…{/shake}`, `{wave}…{/wave}`, `{big}…{/big}`, `{small}…{/small}`, `{w:20}` pause N frames,
`{speed:2}` change typing speed, `{name}` protagonist name, `{v:varName}` variable value. Text auto-wraps to the box
width; a message that does not fit in 4 lines continues on a new page automatically.

- `G.UI.MessageBox.show({speaker, expr, text, style}) -> Promise` – bottom box (736x156 at y=404), portrait
  128x128 logical on the left when available, name tag tab on top-left, typewriter with per-speaker blip
  (`G.DATA.speakers[id].blip`), confirm = complete line / next page, holding `cancel` fast-forwards.
  A small bouncing "continue" pencil mark shows when waiting.
- `G.UI.ChoiceBox.show(options,{cancelIndex}) -> Promise<index>`
- `G.UI.ListMenu` – generic vertical/grid list with cursor, used by menus, shops, battle commands.
- `G.UI.Toast.show('text', {icon})` – small non-blocking notification (item get, map name).
- All boxes use `G.Gfx.panel` (cream paper fill, dark wobbly pencil outline, slight drop shadow).
- Speakers (`js/data/speakers.js`): `G.DATA.speakers[id] = { name:'Mira', color:'#e79', faces:'mira'|null,
  blip:'sfx_blip_mid' }`. Portrait image id = `face_<faces>_<expr>`.

## 6. Battle system

See `docs/DESIGN_BIBLE.md` section 6 for rules and numbers and the **Battle addendum** at the end of this file
for the technical contract (data schemas for `actors.js`, `skills.js`, `enemies.js`, `troops.js`, the battle scene
entry point `G.Scenes.push('battle', {troop, canEscape, bgm, back}) -> result {outcome:'win'|'peace'|'lose'|'escape'}`).
Battle logic (`battle_logic.js`) must be pure and UI-free (deterministic given `G.Util.rng`) so it can be unit-tested
in Node; `battle_scene.js`/`battle_ui.js` present it.

## 7. Audio

- Music: OGG Vorbis, 44.1 kHz stereo, q5, in `assets/audio/bgm/<track_id>.ogg`. Loop tracks are rendered so the
  file loops seamlessly end-to-start (the composer tool renders the loop twice and cuts the second pass so reverb
  tails wrap around). Manifest entry: `{ path, loop:true|false, volume:0.8 }`.
- SFX: OGG (or WAV if under 60 KB), mono, in `assets/audio/sfx/<sfx_id>.ogg`.
- `G.Audio` decodes through WebAudio when `fetch` works (http) for gapless looping; on `file://` it falls back to
  `HTMLAudioElement` with `loop=true`. Audio starts only after the first user gesture (title screen "press any key").

## 8. Asset ids, folders, manifest

`tools/build.js` scans `assets/` and writes `js/data/manifest.js`:
`G.DATA.manifest = { images: { id: {path, w, h, ...meta} }, audio: { id: {path, kind:'bgm'|'sfx', loop, volume} } }`
where `w,h` are REAL pixel sizes (read from the PNG/JPG/WebP header) and extra meta is merged from optional sidecar
files `assets/img/<folder>/<id>.json` (written by the art pipeline, e.g. `{ "frameW":128, "frameH":176 }`).
The image id is the file name without extension; ids are globally unique thanks to prefixes:

| folder | id pattern | format | notes |
|---|---|---|---|
| `chars/` | `char_<id>` | PNG, 3 cols x 4 rows | rows: down, left, right, up; cols: stepA, stand, stepB; frame 128x176 real px (64x88 logical), feet at bottom-center, 8 px bottom margin |
| `faces/` | `face_<speaker>_<expr>` | PNG 256x256 | one file per expression |
| `enemies/` | `en_<id>` | PNG, alpha, longest side <= 640 real px | battle illustration; also used (scaled) as map sprite |
| `terrain/` | `ter_<id>` | PNG/JPG, opaque, size multiple of 96 (192 or 288) | seamless tile block |
| `objects/` | `obj_<id>` | PNG, alpha | width = intended tile width x 96 real px |
| `battlebacks/` | `bb_<id>` | JPG 1536x1152 | |
| `cg/` | `cg_<id>` | JPG 1536x1152 | full-screen story illustrations, title art |
| `icons/` | `icon_<id>` | PNG 64x64 | items, emotions, status |
| `ui/` | `ui_<id>` | PNG | paper grain, logo, cursor, save-point art etc. |

## 9. Art pipeline (`tools/art/`)

Raw generations come from the Codex CLI image tool (about 1 minute each; 1254x1254 or 1086x1448 PNG; real alpha
when a transparent background is requested; edges carry a colored fringe that must be removed).

Generation command (run from `ROOT`, one image per call is the most reliable; up to 3 calls may run concurrently):
```
node "/home/mroz/.claude/plugins/cache/openai-codex/codex/1.0.5/scripts/codex-companion.mjs" task --write --fresh --effort low "<instructions + image prompt>"
```
The instruction text must say: use the built-in image generation tool, generate exactly ONE image, copy the PNG to
`./art_raw/<name>.png`, do not draw with code, do not read other project directories or memories. Every image
prompt ends with an explicit `Avoid:` line (no text, letters, labels, numbers, grid lines, borders, extra objects,
cast shadows) and starts from the STYLE BLOCK of the design bible.

Processing tools (Python 3 + Pillow + numpy only):
- `slice_chars.py` – 4x3 walk sheet → normalized `char_<id>.png` (component detection, defringe, uniform scale,
  feet baseline + head-centered horizontal alignment).
- `slice_grid.py` – expression sheets and icon sheets → individual files.
- `cut_objects.py` – prop sheets → individual `obj_*.png` by connected components (reading order), defringe,
  scale to the target tile width given in the sheet spec.
- `make_terrain.py` – swatch sheets → seamless `ter_*.png` blocks (with a tiled preview render for QA).
- `cutout.py` – single illustrations (enemies) → defringed alpha PNG, trimmed, max side 640.
- `fit_screen.py` – backgrounds/CGs → 1536x1152 JPG (cover-crop).
- Every tool writes a contact-sheet preview into `art_raw/_preview/` so a reviewer can look at the result.

## 10. Music and SFX tools

- `tools/music/midilib.py` – tiny dependency-free MIDI writer + helpers (chords, arpeggios, humanize, swing, drums),
  `render.py` – MIDI → WAV with `fluidsynth -ni -g 0.7 -r 44100 -F out.wav /usr/share/sounds/sf2/FluidR3_GM.sf2 in.mid`,
  seamless-loop wrap, lo-fi chain through ffmpeg (gentle low-pass, slight wow/flutter, soft saturation, optional vinyl
  noise bed), loudness normalize to about -16 LUFS, encode OGG q5. One Python file per track in `tools/music/tracks/`.
- `tools/sfx/make_sfx.py` – numpy synthesis of all sound effects → OGG.

## 11. Testing

- `node tools/test/validate_data.js` – loads every data file in a Node `vm` sandbox and checks: grid dimensions,
  legend/terrain/object/speaker/expression/asset ids exist, command names and arity, transfer targets exist and land
  on passable tiles, every event and transfer is reachable on foot from each map entry point (BFS over collision),
  skill/item/enemy/troop cross references, flags that are read but never set (warning), ending conditions.
- `node tools/test/smoke.js` – puppeteer-core + `/usr/bin/google-chrome` (`--no-sandbox`, headless): boots the game
  over `http://localhost`, starts a new game, visits every map via `__game.teleport`, takes a screenshot of each into
  `tools/test/shots/`, runs one battle per troop with `battleAuto`, fails on any entry in `__game.errors()`.

---

## Battle addendum (binding contract; rules and numbers live in DESIGN_BIBLE section 6)

Vocabulary: HP = **Breath**, glass colours `red | blue | amber | green`, a Pocket has 5 slots, a slot holds
`null | {c:'red', t:false, from:null}` (raw) `| {c, t:true, from:'odo'}` (Tumbled, remembers the giver) `| {pebble:true, story:false}`.

### Files and ownership

| file | contents |
|---|---|
| `js/battle/party.js` | `G.Party` (below) – stat math, levels, skills known, keepsakes, menu item use. Pure, no UI. |
| `js/battle/battle_logic.js` | `G.BattleLogic` – the whole rules engine, pure and deterministic given `G.Util.rng`; no canvas, no audio, no timers. Emits an ordered list of **battle events** (plain objects) that the scene plays back. Runs in Node for tests. |
| `js/battle/battle_ai.js` | enemy decision rules (bible 6.11/6.12) as small per-enemy functions keyed by `ai` id, plus `G.BattleAI.autoPolicy` used by `__game.battleAuto('attack'|'smart'|'pacifist')`. |
| `js/battle/battle_ui.js` | `G.BattleUI` – the Tideline HUD (bible 6.1/9.3): pockets, Breath strings, letter strips, turn ribbon, Can Line indicator, luggage-tag command fan, target cursors, damage numbers. Public helper used by menus: `G.BattleUI.drawGlass(ctx, x, y, piece, size)` where `piece` is a slot value as defined above (draws jagged raw glass, rounded Tumbled glass with a glint, a grey pebble, or an empty hollow for `null`); must work with no images at all (code-drawn), and use `icon_glass_*` when present. |
| `js/battle/battle_scene.js` | scene `'battle'`: intro, command input, event playback with animation and sfx, result strip, level-up tags, returns the result. |
| `js/data/actors.js skills.js items.js enemies.js troops.js` | transcribed from the bible tables. |

### Data schemas

```js
G.DATA.actors.wren = { name:'Wren', char:'char_wren', faces:'wren', home:'blue', weapon:'tin can',
  base:{hp:46,atk:9,def:6,spd:8}, growth:{hp:7,atk:2,def:1.5,spd:1},      // stat = floor(base + growth*(lv-1))
  skills:[ {id:'rattle',level:1}, {id:'call_over_and_out',flag:'odo_told'}, {id:'i_need_help',flag:'lin_told'} ],
  passive:null };                                                          // pim: passive:'nosy'
G.DATA.expTable = [0,0,20,50,95,155,230,320,425,545,680];                   // cumulative EXP to reach level i (max 10)

G.DATA.skills.cannonball = { name:'Cannonball', user:'odo', flavor:'...', desc:'Power 2.0 hit on one Unsent.',
  cost:{red:2},               // colours: raw pieces; {tumbled:1} = must be Tumbled; {free:true, cooldown:3}
  target:'enemy',             // 'enemy' | 'all_enemies' | 'ally' | 'other_ally' | 'party' | 'self' | 'two_allies'
  type:'damage',              // 'damage' | 'heal' | 'buff' | 'debuff' | 'glass' | 'say'  (selects the Out Loud rider)
  priority:false,
  effects:[ {kind:'damage', power:2.0} ],     // effect DSL is designed by the battle agent; regular effects are data,
  call:null };                                // one-offs use {kind:'special', name:'i_need_help'}; call:{partner:'odo'} for Two-Can Calls

G.DATA.items.bag_of_chips = { name:'Bag of Chips', kind:'consumable', // 'consumable' | 'keepsake' | 'key' | 'glass'
  desc:'...', flavor:'...', price:12, icon:'icon_bag_of_chips', useInMenu:true, useInBattle:true,
  target:'ally', effects:[ {kind:'heal', pct:40} ], stats:null };      // keepsakes: stats:{hp:+10,...} and/or passive id

G.DATA.enemies.sorry_crab = { name:'Sorry-Not-Sorry', img:'en_sorry_crab', hp:85, atk:11, def:6, spd:7,
  lines:[ {c:'red'}, {c:'blue'} ],            // {c:'blue', star:true}, {c:'any'}, {c:'same_as_first', star:true},
                                              // {c:'red', shownAs:'amber'}, {c:'amber', from:'lin', star:true}, {c:'any', sayer:'wren', star:true}
  lineRules:null,                             // e.g. {grow:[{round:3,line:{c:'red'}}]}, {reshuffleUntilListens:1}, {rerollUntilListens:2}, {deliverByListens:3}
  ai:'sorry_crab', mutters:['it\'s not FAIR', ...], boss:false, actions:1,
  exp:6, stamps:5, drop:{item:'glass_red', chance:0.25}, mapScale:0.5,
  letter:['line one of its delivered letter','line two'] };
// tint variants: G.DATA.enemies.kept_shrug = { base:'sorry_crab', img:'en_kept_shrug', name:'The Shrug', hpMul:1.3,
//   lines:[{c:'blue',star:true},{c:'amber',star:true}], named:{seg:1}, exp:0, stamps:0 }  (image file is produced by the art pipeline)

G.DATA.troops.troop_card_crab = { members:['thank_you_card','sorry_crab'], back:null, bgm:null,
  rules:null };  // rules: {noEscape, noHush, forcedSpill:{actor,colour,noTimeout}, roundLimit, onlySayer, tutorial:'id'}

G.DATA.confessions = { odo:{ wren:['I gave myself the swimming medal. Over.', ...], lin:[...] }, ... };  // [from][to], written by the story agents; optional
```

### APIs other modules rely on (exact names)

```
G.Party.stats(actor)            -> {mhp, atk, def, spd} incl. keepsake        G.Party.expToNext(actor) -> n | null at max
G.Party.gainExp(actor, n)       -> {levels:[2,3], learned:['beachcomb']}      G.Party.knownSkills(actor) -> ['rattle',...] (level + story flags)
G.Party.setLevel(actor, lv)     G.Party.fullHeal(actor)                       G.Party.pebbles(actor) -> {ordinary:n, story:n}
G.Party.equipKeepsake(actor, itemId|null) -> previous id (inventory is adjusted)
G.Party.canUseInMenu(itemId, actor) -> bool      G.Party.useInMenu(itemId, user, target) -> {ok, message}   (flask_of_tea only works on someone else)
G.Party.skim()                  -> clears ordinary Pebbles of the whole party, returns count
G.State.album                   -> { [enemyId]: {linesKnown:[bool...], delivered:n, hushed:n, letter:bool} }  (persisted in saves)
```
Actor instances (created by `G.State`, extended through `G.State.hooks.createActor`) carry persistent battle fields:
`hp`, `level`, `exp`, `equips.keepsake`, `pebbles` (ordinary count, 0-2). Story Pebbles are derived from flags (`segN_kept`),
never stored. Glass never persists between battles.

### Scene contract

`G.Scenes.push('battle', { troop:'troop_id', canEscape:true, bgm:'id'|null, back:'bb_id'|null })` resolves (via the scene
stack's `resume(result)`) with `{ outcome, delivered:n, hushed:n, rounds:n }` where `outcome` is
`'peace'` (every Unsent Delivered) | `'win'` (battle won with at least one Hush) | `'lose'` (whole party Winded) |
`'escape'` | `'timeout'` (round limit reached; only with `rules.roundLimit`). The interpreter's `battle` command runs
`onPeace` (falling back to `onWin` when absent), `onWin`, `onLose`, `onEscape`, `onTimeout` (falling back to `onLose`).
Background resolution: command option > troop `back` > map `battleback` > a code-drawn paper seabed. Music: command
option > troop `bgm` > `G.DATA.system.battleBgm`; the map BGM is saved on entry and restored on exit (`G.Audio.saveBgm/restoreBgm`).
The battle scene applies rewards itself (EXP to everyone, Stamps, drops, Pebbles, album, `delivered_count`/`hushed_count`
vars) before resolving. The party is never game-overed by the scene itself; that is the event's decision.
