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
  street-ground: "#a2a18b"
  street-accent: "#e7b66e"
  ruins-ground: "#25394d"
  ruins-accent: "#b194ed"
  battle-trail-player: "#38dac6"
  battle-trail-opponent: "#ff795c"
  battle-impact-energy: "#ffad45"
  battle-critical-energy: "#ff4934"
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
The metal arena gains a modeled sci-fi stadium; the street toy-bowl alley and
square floating ruins extend the existing map selection. These are distinct
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
  background frame the shallow metal bowl, transparent guard and tiered seating.
  `championship-accent` belongs to the map's controls, not every scene material.
- Street: ivory plastic and cobalt bowl clips separate from worn asphalt,
  terracotta brick, ochre/copper leaves and warm plaster. `street-accent` carries
  the map controls. Warm directional light, lower ambient/reflection fill and
  disabled arena spotlights preserve the outdoor material separation.
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

## Shapes
Manufactured bevels and concentric measurement rings carry the scene.
Buttons, enclosures and dialogs use restrained rounded corners.

The childhood and street toy bowls keep rounded plastic rims and blue clips.
The stadium layers concentric shells, seating and industrial light towers.
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

Recorded verification on 2026-09-16: `npm test` 29, `verify:lab` 27,
`verify:showroom` 25 and `verify:worlds` 31 checks passed; the build passed with
the existing Three.js chunk-size warning. These are inherited results, not a
test rerun for this documentation update. The reviewer verdict is **Ship, scoped
to F1-F4**: childhood text contrast, visible ruin slate, street lighting/material
separation and jagged pillar silhouettes are resolved. Static captures are not
independent verification of motion, reduced-motion behavior or the solver.
Evidence: [world review record](../.impeccable/review/worlds/verification.md).

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
