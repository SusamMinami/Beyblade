---
name: SPIN CORE Web Prototype
description: A portrait spinning-top game with reference-directed labs, collection stages, and battle worlds.
colors:
  lab-ink: "#202f33"
  lab-muted: "#435d62"
  lab-cyan: "#75eddb"
  lab-yellow: "#cfdf32"
  lab-dialog: "#e3ece9"
  instrument-glass: "#102e34"
  stage-ground: "#08151d"
  stage-panel: "#17313a"
  stage-text: "#d8e9e9"
  stage-secondary: "#b1cdcf"
  stage-line: "#456875"
  stage-cyan: "#5fd8d5"
  stage-gold: "#efc579"
  childhood-ink: "#243c45"
  childhood-label-paper: "#efe9d8"
  childhood-readout-paper: "#eee9d7"
  childhood-status: "#ac3e2f"
  childhood-progress: "#227aa2"
  championship-ground: "#0c1c25"
  championship-accent: "#8ed8e7"
  street-ground: "#142635"
  street-accent: "#e7b66e"
  ruins-ground: "#25394d"
  ruins-accent: "#b194ed"
  battle-trail-player: "#38dac6"
  battle-trail-opponent: "#ff795c"
  battle-impact-energy: "#ffad45"
  battle-critical-energy: "#ff4934"
  campaign-white: "#fffdf7"
  campaign-ink: "#12151a"
  campaign-yellow: "#ffd23f"
  campaign-text: "#4d555d"
  campaign-blue: "#266d9c"
---

# Web visual conventions

## Overview
Web is the first implementation and review target. Assembly retains its incumbent
visual system; battle retains its portrait controls while expanding its worlds.
The precision test lab remains a distinct silver, graphite, cyan, and yellow-green
instrument environment based on the user's reference, now available at LV.2.
The reference's planned systems are present even when their service is pending.
The separate collection route follows the two new user references: a cyan
holographic chamber and a gold-lit arena rig. Dark tonal variations, tinted
text/borders and opaque instrument overlays are intentional for those stages.

The beginner lab now opens on a sunny childhood desk: honey oak, a green cutting
mat, an ivory toy dish, a blue task lamp, stationery and a paper-colored whiteboard.
The metal arena is a detailed sci-fi competition apparatus with segmented service
plates, stepped cooling-equipment banks and synchronized moving lighting.
The rainy cafe street with its toy bowl and square floating ruins extend the
existing map selection. These are distinct
stylized real-time worlds, not a replacement global skin or photo-identical copies.
Godot and external-server collision/protocol integration have not been migrated
for these additions.

## Colors
Silver enclosures and graphite frames establish the room. Cyan belongs to
instrumentation and specimen selection; yellow-green identifies the main test
command and current navigation item. Diamonds use their own violet icon.

### World-specific application
- Childhood: warm wood, plaster and paper surround cobalt enamel, green matting
  and small vermilion accents. Use `childhood-ink` on `childhood-label-paper` for
  the title, utility captions and XP caption. The whiteboard uses the separate
  `childhood-readout-paper`, dark measured values, brick-red status and blue
  progress. Keep the existing yellow-green test command and navigation.
- Collection: `stage-ground`, tinted light text and opaque blue-green panels
  support cyan holography or gold arena lighting. Five moving spots alternate
  aqua/ice blue in the hologram stage and warm gold/cool blue in the arena.
- Championship: graphite, brushed aluminium, cyan energy channels and a cool
  background frame the shallow metal bowl, transparent guard and stepped
  cooling-equipment banks. Cyan/ice-blue fixtures reveal the satin bowl and
  polished edges; day retains metal depth with quieter emitters and beams.
  `championship-accent` belongs to the map's controls, not every scene material.
- Street: a quiet, warm Japanese cafe beside a closed bicycle shop sits against
  `street-ground` night blue or a pale blue-grey daytime sky. Coated ivory plastic
  and cobalt bowl clips separate from jade ceramic tiles, stained wood, fabric
  awnings, low-gloss plaster and fine-grained wet asphalt. `street-accent` retains
  the map controls. Day uses warm sunlight, blue sky and ground bounce; night
  keeps cool directional light and restrained fill around warm storefront spill
  and cool vending light, never an overall orange wash. Arena spotlights stay
  disabled in street during both periods.
- Ruins: readable blue-grey slate and aged bronze sit against `ruins-ground`;
  cyan floor runes and violet crystals/portal provide localized emissive accents.
  `ruins-accent` identifies map controls. Do not flatten paving into the dark base.
- Battle feedback: teal/coral movement trails distinguish the two tops.
  Authored energy/crystal materials shift toward `battle-impact-energy` on impact
  and `battle-critical-energy` for critical spin or ring-out risk. These are
  transient state cues, not replacement world palettes.

**The Local Palette Rule.** Warm paper labels belong to the childhood room;
dark instrument glass belongs to the precision room. Color-detector findings
are advisories to inspect in context, not authority to homogenize these worlds.
Authored Blender material values and rendered lighting remain the material truth;
the CSS/renderer colors above are not claimed as exact final pixel colors.

## Typography
Inherit Bahnschrift and Microsoft YaHei UI. UI text is HTML; the main instrument
uses a 1200 x 600 canvas texture plus an accessible live text equivalent.
Do not equate texture-space font sizes with CSS sizes.

Both rooms share the readout hierarchy and real metric values. Childhood changes
the readout's ink and paper, not its typography or calculation model. Keep tabular
numerals, Chinese-first labels and compact English secondary labels; do not
introduce a new display face for the added worlds.

## Layout
The lab keeps a 9:16 composition centered within the available viewport.
Controls scale in container units. Title, currencies and experience occupy the
top; utility controls follow the right edge. The active specimen and readout
remain central, with testing, three configurations and five navigation entries
at the bottom.

Collection uses the same centered 9:16 shell. Its close-inspection toolbar wraps
above the loadout/details area on narrow screens; part buttons and the return
action remain HTML controls over the existing scene. Battle framing fits the
arena width to the viewport aspect while keeping the incumbent HUD and launch
controls. Preserve visible square edges and obstacle routes in the ruins.

**The Championship Apparatus Rule.** Frame the complete playable dish with
service decks, braced light towers and a suspended scoreboard. The stepped rear
banks are cooling equipment at apparatus scale, not miniature human seating.
Keep the configured tops, A/B/C zones and portrait launch/running controls
readable. Preserve the `metal` ID, bowl radius (6.9), battle physics, loadouts
and ownership; perimeter lighting is decoration, not a new gameplay zone.

**The Street Scale Rule.** Keep normal-life-scale surroundings around the unchanged
toy bowl and tops. The generator's `humanScale` is 16 relative to the earlier
miniature props: the default battle top is about 1.99 across, the bicycle wheel
21.76 across and the door 68.48 high, all in render units. These calibrate visual
proportions, not game-balance measurement units. Near views show portions of the
wheel, planter and doorstep; upper storefronts extend out of frame. Never shrink
life-size belongings to fit a whole building into view. Keep the complete bowl,
tops and launch controls readable; the bowl radius remains 6.7.

## Elevation & Depth
The apparatus uses actual GLB geometry, baked vertex occlusion, a room reflection
environment, and real-time shadows. Retain the original Web specimen builder,
including its DIY customizations and procedural surface finishes.
The acrylic enclosure stays faint enough to preserve the specimen silhouette.

The childhood room hides the precision enclosure and uses warm directional
daylight over the desk. Its paper-backed HTML labels remain opaque and shadow-free
for legibility against the bright room. Collection inspection dims the spot beams
and hides the holographic cylinder so the actual parts lead the close view.

Battle worlds use material-merged GLBs, real-time shadows and procedural surface
finishes for metal, slate, brick and asphalt. Ruin paving sits visibly above its
foundation; fissures, slab seams and broken column tops carry depth rather than
an undifferentiated dark platform. Beam cones and distance fog are presentation
techniques, not true volumetric fog.

**The Championship Material Rule.** Keep satin titanium, polished aluminium
edges and graphite-enamel deck plates visually distinct. Runtime upgrades these
three authored finishes to `MeshPhysicalMaterial`: clearcoat is 0.18 on the bowl
and edges, 0.32 on the deck, with clearcoat roughness 0.24 and material environment
intensity 0.8. Retain fine procedural surface finish at strength 0.6, using
`arena` on the bowl and `machined` on the edges/deck. Existing environment
reflections and the main directional shadow supply depth; the championship
extension adds no spotlight shadow maps or reflection targets.

Street depth comes from a modeled recessed cafe opening, timber reveals, shelves,
cups, a low-emission rear wall, interior lighting and thin transparent glazing.
Separated ceramic tiles and recessed grout, striped awnings, upstairs curtains,
air-conditioning louvers and pipes, bicycles, plants, benches, menus and drains
give the quiet rainy corner its lived-in scale. Glazing, enamel and glazed tile
use physical clearcoat (0.42, with clearcoat roughness 0.19), distinct from the
ivory bowl's coating. These authored storefront details remain in the model;
the current close framing does not require them all to be visible.

**The Street Plastic Rule.** Keep the coated ivory bowl's worn center rougher
than its polished edge. Each street atmosphere creates two ivory-plastic-only
soft-light PMREM probes: bright sky and soft sunlight for day; dark surroundings,
a warm strip and a cool sky card for night. Select the matching probe to shape
broad local sheen without uniformly brightening the dish. Both are separate
from the shared outdoor environment and the live puddle reflection.

**The Street Reflection Rule.** Four irregular puddle regions outside the bowl
share one actual planar scene reflection, not a painted glow. Keep broken
dry/wet gaps, quiet low-amplitude noise and spatially varied blur; the cool
shutter-side reflection is dimmer and blurrier than the cafe reflection.

## Shapes
Manufactured bevels and concentric measurement rings carry the scene.
Buttons, enclosures and dialogs use restrained rounded corners.

The childhood and street toy bowls keep rounded plastic rims and blue clips.
The stadium layers concentric shells, stepped equipment banks and braced
industrial light towers. Separated deck plates, recessed sockets, hex fasteners,
cooling slots, overhead truss and suspended scoreboard are modeled details,
not a background image.
Ruins deliberately break the circular world silhouette with a square stone
platform, four solid inner plinths, perimeter column footings and jagged fractured
shafts. Circular floor sigils are decoration, not a circular collision boundary.

## Components
- Measurement command: idle, scanning, complete and asset-error states.
- Mode selector: pressed state; locked during scanning.
- Configuration carousel: real canvas-rendered specimens and current selection.
- Records: empty state, dated results, environment and JSON export.
- Laboratory level: accumulated experience and next-level progress.
- Settings: environment, rotation, center marker, rendering quality and calibration.
- Shop: canonical part prices, insufficient-funds state, confirmation and ownership.
- Dialogs: native modal focus handling and Escape dismissal.
- Future services: diamonds and level-based equipment upgrades explicitly pending.
- Camera controls: closer front framing and manual overhead inspection. Wind
  direction uses downstream vectors, always consistent with the arrows.
- Explicit testing spins independently of optional idle rotation; reduced motion
  uses gentle functional spin instead of removing the feedback entirely.
- Collection lift: 400 ms descent, hidden selection commit, 650 ms ascent;
  220 ms total under reduced motion, with repeated selection blocked.
- Stage selection: default hologram, LV.2 arena unlock, honest locked state,
  temporary preview and persistent equip. Selection never changes battle stats.

### Scene routes and inspection
For the scene surfaces reached through `#collection`, `#lab` and `#map` into
battle, the named design mode is **Experience**, with **Operate** overlays for
inspection, settings, measurement, selection and launch. This describes those
surfaces only, not a global application mode or a new runtime mode switch.

- Collection presentation: five moving spotlights and slow specimen rotation
  (0.16 rad/s) while resting on stage. Rotation pauses during lift and inspection.
- Close inspection: click the actual top or use the close-view button to move
  nearer within the same scene. Drag to orbit; wheel or two-finger pinch to zoom.
  Click a part or use its named button to focus through the existing top-model
  part-focus system. Pressed buttons and a live hint reflect the selected part.
- Return to stage restores the wide framing and slow rotation. Outside inspection,
  a horizontal swipe switches loadouts through the existing hidden-commit lift;
  orbit and pinch must not act as loadout selection.
- Reduced motion freezes spot sweeps, hologram scanning and decorative rotation;
  camera repositioning is immediate and the shortened lift preserves its order.
  Necessary part-selection and test feedback remain available.

### Laboratory rooms
`childhood` is the default room. Settings retains the original `advanced`
precision lab as an explicit LV.2 choice (120 laboratory XP), disabled below the
unlock. The room choice persists in the existing save; reaching LV.2 does not
automatically replace the childhood desk. This room unlock is implemented and
is separate from the still-pending equipment-upgrade services.

The whiteboard displays the same computed metrics, status, progress and accessible
live text as the precision monitor. Room appearance does not change measurement,
wind demonstration, rewards or XP. Front/overhead inspection, quality controls
and explicit test-driven spin continue to work in both rooms.

### Battle worlds and feedback
Five maps are selectable: the existing standard and composite arenas, the upgraded
`metal` championship stadium, `street`, and `ruins`. The championship keeps the
metal ID and balance parameters; street reuses the standard bowl behavior.
Ruins uses a flat standard surface with a square boundary, no bowl-centering
force, four indestructible inner plinths and eight collidable perimeter footings.
The shared collision manifest aligns those solids with the authored geometry;
the visual pass does not create a parallel physics or inventory model.

Movement trails and three-layer energy arcs follow the live tops. Collision
events drive sparks, impact rings, brief local light, scene-energy pulses and
short camera shake; critical spin/ring-out state drives warning energy color.
Random sparks are renderer-only and do not change simulation determinism.
Budgets are 192 spark slots, 48 trail points per top and at most 24 impact rings.
Pause freezes battle FX time. Reduced motion removes arcs, trails, flashes,
shake and moving sweeps while retaining non-expanding fading impact markers and
the existing state/operation feedback. Do not describe all feedback as disabled.

Asset loading has explicit loading, ready and failure states; a failed GLB must
not be presented as a successfully loaded alternate arena. No destructible
terrain, new skill buttons or server compatibility is implied by the artwork.

### Battle scene time
The five battle maps share `sceneTime` in the existing v2 save: `auto`, `day` or
`night`, with missing or invalid values normalized to `auto`. Story and free
battle use the same preference. Auto resolves the player's local hour on map
or battle entry: `6 <= hour < 18` means day, otherwise night. The resolved period
stays fixed during that match, even across a clock boundary. On the map screen,
changing the selector updates the preview without reloading the GLB.

The native time `select` shares the top row with the story/free mode buttons.
It uses the existing campaign paper, ink and blue focus treatment: a 2px frame
with 4px corners, 12px text, a 40px minimum-height select and a 3px focus outline
with 1px offset. The select is 104px wide inside a maximum 148px control. At
viewport widths up to 480px, hide only the visual time label, retain the select's
`aria-label`, reduce its width to 98px and keep all three controls in one row.
The hover background (`#e6f2f7`) comes from existing campaign disclosure/link
hover styling; its palette-detector advisory is not a reason to change the color.

All five maps support daylight with directional sun, sky/ground fill and a
generated outdoor sky PMREM, not just a background tint. `ThreeStage` lazily
caches at most two outdoor environment targets, day and night; street and ruins
also use the outdoor night environment. These shared targets survive map
switches and are released by `ThreeStage.destroy()`, not on each street exit.
Other maps retain their geometry, materials and battle parameters.

### Championship moving lighting
The existing `metal` map preview and battle follow the local
[championship direction](../.impeccable/championship-direction.md).
`ChampionshipAtmosphere` uses six actual spotlights on both desktop and mobile,
anchored to the fixtures exported in `championship_layout.json`. Their
phase-offset targets sweep the dish with `x = sin(t * 0.32 + phase) * 3.65`,
`y = -0.12` and `z = cos(t * 0.23 + phase) * 3.1`; the visible heads and cones
turn together with the lights. Base spotlight intensity is 380 at night and
55 by day. Soft-edged geometric cones use transparent additive shaders with
opacity strength 0.085 at night and 0.012 by day, not true volumetric fog.
The spotlights illuminate modeled surfaces independently of those visible cones.

Two perimeter runner rings each contain 96 shader-defined cells, at radii
7.62 and 10.58 from the exported layout. Their light packets circulate in
opposite directions using `cos(angle * 3 - t * 0.85 * direction)`, with base
runner level 0.9 at night and 0.28 by day. Collision pulses can raise spotlight
intensity by up to 22% and runner level by up to 25%; the existing energy
materials retain warning-color feedback. The runner rings do not change A/B/C
supply behavior or collision geometry.

`ThreeStage` applies championship lighting in both map preview and battle.
Day uses brighter sky/fill, quieter emissions and distance-fog density 0.004;
night uses cool metal sheen, restrained bloom and fog density 0.017. The two
generic arena spotlights are disabled in `metal` during both periods. Leaving
the championship restores the destination scene's period-specific lighting.

Pause and hidden tabs freeze the decorative sweep/runner clock. Reduced motion
fixes `t = 0`, keeps the heads and runners static, halves the corresponding
period's beam strength and suppresses collision boosts without removing steady
illumination or necessary battle feedback. Scene exit/disposal removes the
local lights, heads, cones and runners, releasing their shared geometry and
materials once; `ThreeStage` owns disposal of the upgraded model materials.
Stale asynchronous arena loads are discarded before mounting. No per-frame
geometry, additional spotlight shadow maps or reflection targets are introduced.

### Street day/night atmosphere
The warm cafe and closed bicycle shop follow the local
[street direction](../.impeccable/street-direction.md), retaining the portrait
HUD, launch controls, toy bowl geometry and standard-bowl physics.
`StreetAtmosphere` adds six point lights and four rectangular area lights:
the cafe window, vending machine, street-lamp lens and open sky supply broad
reflections. Their authored fixture anchors come from `street_layout.json`.
`ThreeStage` uses the same period-specific street lighting in map selection and
battle. Day moves the sun to `[-45, 95, 55]`, distinct from the night directional
light at `[-40, 90, 35]`, and uses the matching outdoor and plastic environments.
Daytime emissive strength is multiplied by 0.06 and non-sky local light strength
by 0.04; the sky area light instead uses 1.9 times its base strength. Night
restores warm storefront/cool sky separation, low fill and restrained bloom.
Leaving street restores the destination scene's period-specific lighting.

Lightbox, vending and lantern emissions vary continuously at low amplitude,
with their local lights synchronized and no strobe. Puddle noise uses the same
pausable atmosphere clock. Pause freezes decorative light/water time; reduced
motion retains static reflections and steady lights. The shared reflection
target is 512 x 512 when the container is narrower than 480px at scene creation,
otherwise 768 x 768, adding one scene draw rather than one per puddle.
Scene exit/disposal releases the reflector target, geometry, material, plastic
day/night probe pair and local lights; stale asynchronous loads cannot remount
after disposal. The reflection budget is unchanged. These are renderer-only
effects, not water physics or altered battle balance.

### Campaign overlay and story entrance
The campaign is a local extension of the existing map page, not a new visual
world. Follow the [campaign direction contract](../docs/campaign_direction.md):
read the conflict, opponent and objective, prepare the real loadout, launch, then
read the outcome and relationship change. Retain the real scene behind the
overlay and the incumbent Chinese system typography.

**The Campaign Paper Rule.** Use `campaign-white` for opaque mission and launch
text surfaces, `campaign-ink` for primary text and outlines, `campaign-yellow`
for the selected mode and text selection, `campaign-text` for secondary copy,
and `campaign-blue` for focus outlines and the scroll thumb. These are local
incumbent campaign colors, not replacements for the laboratory or stage palettes.

- Layout: the two equal-width mode buttons share a row with the time selector,
  8px from the top and 16px from either side, with a 6px gap and 42px minimum
  button height. The scene caption starts at 64px. The mission sheet sits at
  29% from the top, 88px above the bottom,
  with 16px side insets and padding; it scrolls independently with contained
  overscroll, leaving the existing bottom launch action outside the scroll area.
  At viewport heights up to 700px, use top 23%, bottom 82px and padding 12px.
- Shape and hierarchy: the sheet has a 2px ink border and 5px corners; mode
  buttons have 2px borders and 4px corners. Inherit the existing font family:
  body 14px/1.6, campaign heading 24px, mission heading 22px/1.35, opponent name
  21px, and secondary labels 12px. Progress uses tabular numerals. Headings,
  opponent metadata and preparation controls wrap; the mission select remains
  native, 13px with a 40px minimum height.
- Modes and controls: `#journey` opens story mode on the map screen; `#map`
  opens free selection. Show only the matching mission sheet or arena list.
  Mode buttons expose `aria-pressed`, yellow selection and pale-blue hover;
  sheet controls and mode buttons use a 3px blue focus outline with 3px offset.
  Intelligence, suggestions, memories and battle history use native disclosures.
- Mission states: the selector labels completed, playable and unopened missions.
  Locked missions remain previewable, name the prerequisite and disable launch
  with an opaque grey surface and secondary text. Unfinished onboarding offers
  continue/skip actions and also blocks launch. Playable actions name the opponent;
  completed missions offer replay. Preparation links use the real loadout,
  ownership and prices; suggested purchases and optional challenges are not gates.
  Empty memories/history explain how to begin; completion shows the return-home
  message. The journal shows the latest 40 completed story battles, not replays.

**The Campaign Readability Rule.** Keep the launch opponent/objective brief on
an opaque paper panel, inset 16px horizontally and positioned at top 97px, with
8px 10px padding, a 1px ink border, 3px corners and 13px/1.5 text. Campaign result
paragraphs must remain 14px/1.6, left-aligned and dark on the result surface;
the battle result card scrolls within `calc(100% - 40px)` maximum height.

The collection's existing five-item navigation retains its stage styling:
the fourth item is the story entrance, with Chinese title and `JOURNEY` subtitle.
Its title attribute reports the next mission and completed count, or completion
and memories; it does not replace the specimen or add a separate progress card.
The collection item retains `aria-current="page"` on that screen. Navigation
continues to respect the existing lift-in-progress guard.

Sources: `src/ui/campaign.css`, `src/ui/campaign-panel.js`,
`src/ui/showroom-screen.js` and the campaign wiring in `src/main.js`.
Recorded campaign handoff on 2026-09-16: independent reviewer **SHIP**, scoped
only to the six current captures in [campaign evidence](../.impeccable/review/campaign/):
`desktop.png`, `mobile.png`, `locked-mobile.png`, `launch-mobile.png`,
`result-mobile.png` and `collection-mobile.png`. F1 (opaque launch text panel)
and F2 (14px left-aligned result text) are resolved. This verdict does not prove
full campaign balance, keyboard operation or motion behavior. Supplied main
verification: campaign PASS65, worlds PASS31, lab PASS27, showroom PASS25,
`npm test` 29 passed and build passed with the existing Three.js chunk warning.
These are inherited results, not checks rerun for this documentation-only merge.

### Web v4 battle structure extension
Built for Web `2026.09.16-web-v4`, following the
[structure direction](../.impeccable/structure-direction.md) and
[implemented rules and limits](../docs/structural_battle_design.md).
This extends the existing portrait Experience arena and Operate HUD, retaining
canonical five-part loadouts, DIY, ownership and economy. Damage is round-local.
The model uses current prototype game-balance units, not FEA, real material
fracture or SI stress; no networking or Godot/Worker migration is implied.

- Damage: `src/core/top-structure.js` tracks eight body-local sectors per part
  and derives mass loss, center-of-mass shift, inertia, stiffness and persistent
  in-round imbalance. `applyTopDamage` in `src/render/top-model.js` deforms the
  actual part geometry at damaged sectors, with duller, rougher surfaces.
  One-sided dents remain distinguishable from uniform whole-top wear.
- Opponents: `src/data/opponent-identities.js` supplies five authored identities:
  honey-orange/teal six-lobed, violet-black/vermilion three-claw, teal/brass
  riveted, ice-white/cobalt marked, and moss-green/bronze twin-ring.
  Story variants reuse canonical parts and the existing DIY calculation path.
  The new models and ground markings are procedural; no new shipping raster
  assets or screenshot backgrounds are introduced.
- Supply: `src/core/drive-zones.js` rotates A/B/C every eight seconds, with seven
  seconds active and one cooling. `src/render/drive-zone-model.js` places the
  letters and rings on the actual ground: signal-yellow active, coral contested,
  muted blue-grey inactive. Supply replenishes spin, not damaged parts.
- HUD: `src/ui/battle-structure.css` places an opaque dark countdown below the
  fighter HUD, while fighter status names local damage or imbalance. Existing
  launch and joystick controls remain below. The strip uses 13px tabular text,
  16px side insets and a top of 81px; at heights up to 700px it uses 12px text
  and top 74px. The launch brief moves below it to 124px, or 110px on short
  viewports. The actual CSS and drive-zone renderer palettes are intentional;
  the supplied detector's eight findings are advisories, not palette defects.
- Results: `src/main.js` explains the finishing cause and affected part where
  relevant, then reports each side's zone time, spin harvested and integrity,
  plus contact count and peak impulse. A native disclosure exposes both sides'
  worst local damage per part. Keep the opaque paper report, dark left-aligned
  14px/1.6 cause and telemetry, and existing scrollable card/actions. The finishing
  pose precedes reveal by a configured 850ms; reduced motion reveals immediately.

Recorded handoff on 2026-09-16: supplied final reviewer **SHIP**, no material
findings, scoped only to the eight static captures in
[structure evidence](../.impeccable/review/structure/): `desktop.png`,
`mobile.png`, `launch-desktop.png`, `launch-mobile.png`, `result-desktop.png`,
`result-mobile.png`, `opponents.png` and `damage.png`. The review covered distinct
opponent palettes/silhouettes, visible one-sided dents, active A emphasis and
mobile report-action visibility, not independent mechanics or motion validation.
Supplied main verification: tests 29, physics 69, worlds 31, campaign 65 and
battle-ui 20 passed; build passed with the existing approximately 887 kB Three.js
chunk warning. Supplied reveal timing was 859ms normal and 0ms reduced motion.
These are inherited results, not checks rerun for this documentation-only merge.

### Source and review evidence
Implementation references: `src/render/showroom-stage.js`, `lab-stage.js`,
`three-stage.js`, `battle-effects.js`, and `src/ui/showroom.css` / `lab.css`.
See [battle-world implementation notes](../docs/battle_worlds.md) for build and
collision details. `tools/build_battle_worlds.py` at the repository root authors
editable `.blend` sources in `tools/art_source/` and runtime GLBs in
`resources/battle_worlds/`: `championship`, `childhood_lab`, `street` and
`floating_ruins`. Existing showroom and precision-lab assets remain in
`resources/showroom/` and `resources/test_lab/`. No reference screenshot is used
as a scene background.

Championship authoring lives in `tools/build_championship_scene.py`, also called
by `tools/build_battle_worlds.py` for full rebuilds. It preserves editable
`tools/art_source/championship.blend` and exports the material-merged
`resources/battle_worlds/championship.glb` (approximately 6.66 MB) together with
`championship_layout.json` for all six fixture anchors and both runner tracks.
Runtime integration is in `src/render/championship-atmosphere.js` and
`src/render/three-stage.js`; the shared bowl radius and metal physics are preserved.

Street authoring lives in `tools/build_street_scene.py`, called by
`tools/build_battle_worlds.py` for full rebuilds. Its editable `street.blend`
and material-merged `street.glb` use the same generator. The Blender source keeps
storefronts, bicycles, planters and street fixtures in editable Collections.
The same export writes `resources/battle_worlds/street_layout.json` with
`humanScale`, measured dimensions and lighting anchors, so runtime lights follow
the rescaled groups. Bowl geometry and battle balance are unchanged.
Runtime sources: `src/render/scene-time.js`, `src/render/street-atmosphere.js`,
`src/render/three-stage.js`, `src/ui/scene-time.css` and the save/control wiring
in `src/main.js`. The [Web README](README.md) covers the shared entry.

**Historical world review, before the street night-scene refinement:**
Recorded verification on 2026-09-16: `npm test` 29, `verify:lab` 27,
`verify:showroom` 25 and `verify:worlds` 31 checks passed; the build passed with
the existing Three.js chunk-size warning. These are inherited results, not a
test rerun for this documentation update. The reviewer verdict is **Ship, scoped
to F1-F4**: childhood text contrast, visible ruin slate, street lighting/material
separation and jagged pillar silhouettes are resolved. Static captures are not
independent verification of motion, reduced-motion behavior or the solver.
Evidence: [world review record](../.impeccable/review/worlds/verification.md).

**Historical street review, before normal-life scale and day/night:**
Recorded independent street review on 2026-09-16 at 18:50: **Ship, scoped
to F1-F3/static captures only**. F1 plastic sheen, F2 cafe depth and F3 calm
reflections are resolved, with no visible regressions in
[desktop.png](../.impeccable/review/street/desktop.png) and
[mobile.png](../.impeccable/review/street/mobile.png). This static verdict does
not independently certify motion, reduced motion, disposal or battle physics.
Recorded verification: `npm test` 29, worlds 31, street 10 and build PASS;
the Three.js chunk is approximately 887 kB with the existing chunk-size warning.
The old [street review](../.impeccable/review/street/finish-review.md), its captures
and the earlier world review remain historical evidence, not the current verdict.

**Current street scale/day-night review (2026-09-16):** supplied independent
reviewer **Ship**, limited to the eight final static captures in
[street-scale evidence](../.impeccable/review/street-scale/):
`day-desktop.png`, `day-mobile.png`, `night-desktop.png`, `night-mobile.png`,
`day-map-desktop.png`, `day-map-mobile.png`, `night-map-desktop.png` and
`night-map-mobile.png`. See the [review record](../.impeccable/review/street-scale/review.md).
The verdict covers normal-life proportions, close framing, bowl readability,
material separation and the visible day/night selector; it does not extend to
off-screen storefront details, other maps, keyboard interaction, motion, resource
lifetime, performance, battle balance or Godot. The parallel supply-zone HUD
and structural-damage feedback are not replaced or re-reviewed by this art merge.
Supplied main-thread verification: street 33, worlds 31, campaign 65, unit tests
29 and build PASS, with the existing approximately 888 kB Three.js chunk warning.
These are inherited results, not checks rerun or independently certified by this
documentation-only merge.

**Current championship review (2026-09-16):** supplied fresh independent
reviewer **SHIP**, no material findings, after independently viewing all six
static captures in [championship evidence](../.impeccable/review/championship/):
`day-desktop.png`, `night-desktop.png`, `day-mobile.png`, `night-mobile.png`,
`day-running-mobile.png` and `night-running-mobile.png`. The accepted launch
and running views show detailed plates, fasteners, cooling banks and truss,
readable material separation, bowl, tops and zones, and visible mobile actions.
This verdict does not independently validate motion, device performance,
battle physics, map previews or unrelated changes.

Supplied main [championship verification](../.impeccable/review/championship/verification.json):
PASS24, with `movingPixels` 1739 and `illuminatedPixels` 2121.
`paused`, `reduced`, `hidden`, `dayReduced`, `defaultSpotsDisabled`,
`physicalMetal`, `noShadowMaps`, `released`, `standardRestored` and
`stableMemory` are true; six spots were measured with no spotlight shadow maps.
The recorded 70 submitted draw calls and 533926 submitted triangles include
the shadow pass and other renderer submissions, not single-model geometry
faces or a device-performance certification. Supplied detector output for the
renderer modules was `[]`.

Supplied main reruns also passed: tests 29, structure 69, worlds 31, campaign 65,
battle-ui 20, lab 27, showroom 25 and street 33. Final build passed with the
existing approximately 888 kB Three.js chunk warning. Finishing-report timing
was 855ms normally and 0ms with reduced motion. These are main-thread results,
not checks independently certified by the documentation-only merge; the earlier
review sections retain their own historical scope.

## Do's and Don'ts
- Do read configuration and economy from the existing v2 store.
- Do keep all results in game-balance units.
- Do respect reduced motion and offer a lighter rendering mode.
- Don't fabricate premium-currency transactions, data history or lab experience.
- Don't change battle physics to match the illustration.
- Don't claim this real-time art pass is a photoreal reproduction.
- Do retain warm childhood ink/paper and world-specific material/lighting palettes.
- Do preserve visible ruin paving, square edges and broken pillar silhouettes.
- Do keep inspection on the real configured top and use existing part focus.
- Do keep street belongings at normal-life scale and the full toy bowl readable.
- Do keep championship cooling banks at apparatus scale and the full dish readable.
- Do synchronize championship fixture heads, real spots and decorative cones.
- Don't add championship spotlight shadow maps or reflection targets.
- Don't shrink street props to fit whole storefronts into the close view.
- Don't treat a locked stage preview as ownership or equipment selection.
- Don't promote scene-level Experience into a global mode for task overlays.
- Don't treat color advisories as defects without inspecting the intended world.
- Don't claim the new worlds or their collision model have shipped in Godot or
  external multiplayer services.

## Collection composition
The actual top occupies the center above a modeled circular lift well. The
background emblem and lighting distinguish the two tiers without replacing the
specimen. Three real loadout thumbnails, the incumbent five performance ratings,
mass and center of mass sit below. The five-item navigation connects existing
screens. The UI shares lab typography and currency controls, with stage-specific
dark panels and cyan/gold lighting.

The .blend sources preserve editable objects; runtime assets merge them by
material. Hologram lines and spotlight cones are shaders/geometry. No reference
image is shipped as a background. Both display routes share the lab renderer.
