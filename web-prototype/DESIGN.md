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
  championship-titanium: "#687780"
  championship-enamel: "#27333b"
  championship-graphite: "#1a252d"
  championship-brushed: "#627881"
  championship-polished: "#b1c4cc"
  championship-acrylic: "#a2c1cc"
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
  campaign-button-hover: "#bfe4ff"
  campaign-disclosure-hover-ink: "#145888"
  campaign-disclosure-hover-paper: "#e6f2f7"
  flow-coach-ink: "#234d5e"
  flow-separator: "#b2bbb9"
  assembly-blue: "#238cff"
typography:
  assembly-tool-body:
    fontFamily: "Bahnschrift, Microsoft YaHei UI, sans-serif"
    fontSize: "13px"
    lineHeight: 1.5
rounded:
  assembly-control: "3px"
components:
  maintenance-save:
    backgroundColor: "{colors.assembly-blue}"
    textColor: "{colors.campaign-ink}"
    typography: "{typography.assembly-tool-body}"
    rounded: "{rounded.assembly-control}"
    padding: "6px 9px"
  maintenance-control:
    backgroundColor: "{colors.campaign-white}"
    textColor: "{colors.campaign-ink}"
    typography: "{typography.assembly-tool-body}"
    rounded: "{rounded.assembly-control}"
    padding: "6px 9px"
  maintenance-control-selected:
    backgroundColor: "{colors.assembly-blue}"
    textColor: "{colors.campaign-ink}"
    typography: "{typography.assembly-tool-body}"
    rounded: "{rounded.assembly-control}"
    padding: "6px 9px"
---

# Web visual conventions

## Overview
**Creative North Star: "Original assembly, growing laboratory, distinct stage worlds"**

Web is the first implementation and review target. Assembly retains its incumbent
paper/ink/blue visual system, three-loadout carousel, five-part picker and DIY.
Launcher outfit and care are tools inside that original assembly, not independent
workbench pages. Its actual room grows with the story; the controls keep their
minimal style. Battle retains its portrait controls while expanding its worlds.
The precision test lab remains a distinct silver, graphite, cyan, and yellow-green
instrument environment based on the user's reference, now available at LV.2.
The reference's planned systems are present even when their service is pending.
The separate collection route follows the two new user references: a cyan
holographic chamber and a gold-lit arena rig. Dark tonal variations, tinted
text/borders and opaque instrument overlays are intentional for those stages.

New players begin in the shared minimal space. With story following enabled,
chapter one introduces the sunny childhood desk: honey oak, a green cutting mat,
an ivory toy dish, a blue task lamp, stationery and a paper-colored whiteboard.
Chapter two recommends the precision room through the existing LV.2 progression.
The metal arena is a detailed sci-fi competition apparatus with segmented service
plates, stepped cooling-equipment banks and synchronized moving lighting.
The rainy cafe street with its toy bowl and square floating ruins extend the
existing map selection. These are distinct
stylized real-time worlds, not a replacement global skin or photo-identical copies.
The unified assembly/tool UI and complete Web scene-art integration are not a
full native port. Concurrent shared-physics v6 is implemented in Godot local
battle; its status and external-network limits remain governed by
[the v6 implementation notes](../docs/physics_v6_implementation.md).

## Colors
Assembly uses the existing paper, ink and electric-blue controls across minimal,
childhood and advanced rooms. In the laboratory instruments, silver enclosures
and graphite frames establish the room. Cyan belongs to
instrumentation and specimen selection; yellow-green identifies the main test
command and current navigation item. Diamonds use their own violet icon.

### Assembly application
- Primary: `assembly-blue` identifies filled part/tool selection, Save and the
  thin selected-tab underline. Filled labels use `campaign-ink`, not white;
  the final review records 5.46:1 contrast for this pair.
- Neutral: reuse `campaign-white`, `campaign-ink`, `campaign-text` and
  `flow-separator` for paper, text and separators; do not duplicate their values
  under maintenance-only color names. Upgraded-room gesture hints use opaque
  paper and secondary ink, with 7.45:1 contrast in the final review.
- Interaction: reuse `campaign-disclosure-hover-ink` for focus and selected-tab
  text, and `campaign-disclosure-hover-paper` for enabled hover. Hover uses pale
  paper even on filled controls; dark selected/Save labels and semantic pressed
  state remain intact.

**The Assembly Continuity Rule.** Keep the original paper/ink/blue controls in
every assembly tool mode and room. Room upgrades change the actual scene, not
the assembly UI skin.

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

**The Local Palette Rule.** Warm paper labels belong to childhood lab instruments;
dark instrument glass belongs to precision lab instruments. Assembly tools keep
their own paper/ink/blue controls in both rooms. Color-detector findings
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

Assembly tools use the inherited body voice (13px/1.5), compact headings
(21px/1.25), measured values (18px, weight 600), control labels (12px) and
secondary labels (11px). Tabular numerals remain on prices and telemetry.
These are local tool roles, not a new global display scale.

## Layout
Assembly keeps the original centered 9:16 shell and model-first composition.
The compact toolbar switches top, launcher outfit and care, with a room disclosure
at the right. Top mode retains the three-loadout carousel, five-part picker and
DIY; DIY hides the toolbar while editing. Tool overlays leave the central canvas
available for direct pointer interaction.

**The Visible Save Rule.** Scroll only the lower tool console; keep Save outside
it in the fixed footer. Tool and room changes stay on the assembly page.

The tool console is inset 16px, 64px above the bottom, with a 36% maximum height;
the footer sits 12px above the bottom. At viewport heights up to 740px, tool modes
hide the loadout title, move the toolbar/header/focus controls to 12px/58px/104px
and reduce the console to 32% maximum height. Top assembly retains its header.
At widths up to 360px, toolbar insets contract to 10px and button horizontal
padding to 7px. Scrolling reveals trial/help without moving Save offscreen.

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
Assembly tool paper stays flat over real equipment and room geometry. Upgraded
rooms give the loadout title and lower-left gesture hint opaque paper backing,
without a room-specific maintenance gradient. The room disclosure uses a soft
overlay shadow. Existing comic edges on assembly part cards remain local;
they are not an elevation recipe for lab, collection or other screens.

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
use physical clearcoat (0.65, with clearcoat roughness 0.13), distinct from the
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

### Outdoor surface refinement (2026-09-22)

`world-surface.js` adds world-space mineral grain, normal relief, cavities,
roughness and coating variation to the existing street/ruins GLBs. Fine grain
fades at unresolved pixel footprints. Keep scuffs sparse: repeated fine rings
or diagonal lines produce interference patterns on the toy dish.
These are shader finishes, with no new raster downloads, mesh displacement
or physics changes. The main directional shadow resolution and street's
single planar reflection budget remain unchanged.

- Ruins: slate has damp patches (roughness 0.25–0.83), worn seams and sparse
  fissures; masonry has mineral relief and darker damp bases. Bronze combines
  warm exposed metal with rough green patina. Faceted crystals retain reflective
  coating, while the portal has a restrained luminous inscription instead of a
  uniformly emissive panel. `RuinsAtmosphere` adds five point lights and two area
  lights for crystals, central runes, portal spill and sky reflection, with no
  additional shadow maps or reflection targets. Night fog density is 0.012;
  day is 0.005. Day quiets energy emissions and localized colored light.
- Street: asphalt separates exposed aggregate, dark pores and broad damp
  patches; normal strength stays low enough to avoid glitter. Ivory plastic
  uses a neutral ivory base, sparse scuffs, center/edge roughness 0.35/0.145
  and varying coating 0.32/0.78. Blue clips, transparent acrylic, glazed tile,
  brushed metal, rough clay, timber and cloth retain distinct light response.
- Both atmosphere classes explicitly bind the current shared outdoor
  environment to their materials, enabling per-material reflection intensity.
  Ivory plastic then uses its existing separate day/night probe. In Three r178,
  `envMapIntensity` alone is ignored when `envMap` is null and the scene supplies
  the environment. Physical conversions retain both `STANDARD` and `PHYSICAL`
  defines so the precompiled material matches the actual render.

Ruins local lights follow the live energy-material tint, including existing
impact/warning feedback; there is no new animation clock. Atmospheres release
local lights on exit; model materials remain owned by `ThreeStage`, and shared
outdoor probes remain renderer-owned. Desktop/mobile day/night evidence and
pixel/resource checks are in [world-materials](../.impeccable/review/world-materials/).
This pass does not claim photo-identical reconstruction or new geometry.

## Shapes
Manufactured bevels and concentric measurement rings carry the scene.
Buttons, enclosures and dialogs use restrained rounded corners.

Assembly controls reuse the small `assembly-control` corner, while launcher slot
tabs are square and underline-selected. Part cards keep their incumbent ink
frames and comic edge treatment; compact tool buttons do not acquire that shadow.

The childhood and street toy bowls keep rounded plastic rims and blue clips.
The stadium layers concentric shells, stepped equipment banks and braced
industrial light towers. Separated deck plates, recessed sockets, hex fasteners,
cooling slots, overhead truss and suspended scoreboard are modeled details,
not a background image.
Ruins deliberately break the circular world silhouette with a square stone
platform, four solid inner plinths, perimeter column footings and jagged fractured
shafts. Circular floor sigils are decoration, not a circular collision boundary.

## Components

### Maintenance within original assembly (2026-09-24)

`#assembly` is the only assembly/tool page. The original three-loadout carousel,
five-part picker and DIY remain intact; the toolbar adds launcher outfit, care
for the selected equipment, and a room disclosure. `#launcher` and `#maintenance`
are compatibility aliases that enter their tool modes and normalize the address
to `#assembly`. The minimal paper/ink/blue interface is retained in every room;
neither a standalone workbench nor a dark precision-maintenance skin is current.

Ordinary tool buttons use a 36px minimum height, focus buttons 32px, and toolbar
buttons 38px. Their 2px focus outline has a 3px outside gap; the canvas outline
is inset by 3px. Filled selected part/tool buttons and Save use dark ink on blue.
The same lower-console/fixed-footer layout applies to outfit and care, including
short screens. The sidecar samples this built assembly UI, not replacement rooms.

`MaintenanceStage` borrows the same `LabStage.scene`, renderer/canvas,
`roomSets` cache, lights and reflection environment. Only the current equipment's
exploded workpiece is local. Entry hides the test specimen, scan, wind, trace and
shield; exit restores their visibility, the previous view and canvas ownership.
Workpiece scale and placement stay on a local parent group, preserving mesh-local
oil samples and the existing oil/physics calculations. `workshop-room.js` shares
the original minimal plinth with the lab; childhood and advanced reuse their
authored rooms. Assembly, tools, lab and showroom share one WebGLRenderer.
No duplicate room scene, extra WebGL context or new shipping raster is introduced.

Keep automatic explosion, freely reversible paint, and visible draft/save state.
No cover-opening puzzle or compulsory consumable interaction belongs here.
The controlled trial labels its input, duration and game units. Slow mechanical
illustration is distinct from physics telemetry and respects reduced motion.
Named part controls focus real geometry. When the model has keyboard focus,
the visible reticle seeks a real visible ray hit on the focused part rather than
empty space between exploded pieces. Enter paints or wipes at that same reticle;
arrows orbit and plus/minus zoom. The canvas accessible label and
[Web instructions](README.md) describe this path.

Save commits oil and launcher equipment/color drafts and stays in the current
mode. Cancel/revert discards unsaved tool edits and returns to original top
assembly. Same-page tool and room changes retain these drafts; leaving assembly
discards them. Purchases persist ownership immediately and survive discarding.
Save failure retains drafts and restores the previous in-memory equipment.
These rules do not replace the original top picker or DIY save/cancel behavior.

The [original maintenance review](../.impeccable/review/maintenance/finish-review.md)
and [independent-workbench handoff](../.impeccable/review/launcher-integration/verdict.md)
are historical. The current assembly-merge review and two-fix verdict are linked
below.

### Laboratory and collection controls

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

### Launcher outfit extension (2026-09-24)

Launcher outfit is the original assembly's `outfit` mode, with the same paper,
ink, blue selection/Save, Chinese system typography and tabular numbers.
The legacy `#launcher` link is an alias, not a separate page.

- Keep the actual eight modules exposed, without a cover/access puzzle.
  Rack, transmission and coupler offer three authored variants each; three
  independent shell/accent/grip color inputs and the red-black preset are free
  and cosmetic. Model clicks and named slot buttons select the same real parts.
- Retain the centered 9:16 shell and scrollable lower console. Trial and help
  can extend below the initial mobile console view; Save stays fixed outside it.
  Close-view controls
  enlarge the selected mechanism without replacing it with an illustration.
- Slot and variant buttons persist through asynchronous swaps; refresh their
  labels and pressed state in place. Use `aria-disabled` with an activation guard
  while loading, preserving focus; equipping returns focus to the selected part.
  Buttons and inputs have a 2px blue focus outline separated by a 3px outside
  gap. Selected buttons use blue at rest and pale paper on enabled hover, retaining
  dark ink and `aria-pressed`. The canvas retains its separate inset focus treatment.
- Distinguish preview, ownership and draft equipment. Unowned previews never
  equip or purchase; buying uses existing coins and immediately saves ownership.
  Equipping edits the draft. Combine equipment/color and oil dirty status across
  outfit and both care targets, with preview labeled separately. Save commits
  both drafts without changing mode, never an uninstalled preview. Tool/room
  changes retain drafts; cancel or leaving assembly discards unsaved edits but
  retains completed purchases.
- Swap the old part out, then the new part in along its authored direction,
  retaining housing and orbit; reduced motion jumps to the completed swap.
  Trial and battle share the finite-energy launch calculation. Keep controlled
  input and game-unit labels; the fork, cam and three dogs demonstrate release,
  not mechanical contact-force simulation.

Sources: `src/ui/maintenance-screen.js`, `src/ui/maintenance.css`,
`src/render/maintenance-stage.js` and `src/render/launcher-model.js`.
[Runtime boundaries](../docs/launcher_runtime.md) remain the technical reference.
Models are Blender-authored GLBs; no new shipping raster assets are introduced.

The [earlier launcher verdict](../.impeccable/review/launcher-integration/verdict.md)
was **SHIP for its F1-F3 fixes only**. Its independent-workbench appearance and
whole-page scrolling are historical, not current UI guidance. Retained mechanism
and purchase/draft behavior is described above; current finish evidence is the
[assembly-merge verdict](../.impeccable/review/assembly-merge/verdict.md).

### Home and shared laboratory integration (2026-09-24)

This is an implemented local merge into original assembly, not a new identity
or a design proposal. Top assembly, outfit and care borrow the actual selected
laboratory while preserving the same paper controls. No room-specific tool skin
or return-to-entry behavior remains.

The display homepage is titled **我的陀螺基地** and reuses the existing holographic
chamber and arena stages with the actual equipped top. `#home` and no hash follow
the existing two-match tutorial before collection; completed/skipped tutorial or
existing story progress resolves to collection. `#collection` remains a direct
entry, while `#assembly` remains an explicit assembly deep link.

New players start in `minimal`. With `followStory` enabled, chapter one's
`rival-arrives` recommends `childhood`; chapter two's `choose-a-line` recommends
`advanced` and raises existing lab XP to a floor of 120. This never adds repeatable
XP, coins or a parallel progression model. Existing LV.2 rules unlock `arena`
and `advanced`. Assembly and testing share the lab room preference; the display
stage has its own `followStory` control. Manual selection sets only the relevant
switch to false; re-enabling follows the story again. Players can always return
to minimal. Existing test XP can still unlock advanced selection early.
Locked stage previews never equip or change ownership.

Lab and collection/home maintenance actions enter the same `#assembly` tools.
Save stays in the current mode; cancel returns to top assembly on that same page.
Changing tools or rooms retains oil and equipment/color drafts; leaving assembly
discards unsaved edits. Completed purchases remain owned. Room preference save
failure restores the previous preference rather than committing the scene early.

Sources: `src/ui/maintenance.css`, `src/ui/maintenance-screen.js`,
`src/render/maintenance-stage.js`, `src/main.js`, `src/render/workshop-room.js`,
`src/core/home-progression.js`,
[implementation overview](../docs/home_lab_integration.md) and the
[surface contract](.impeccable/surfaces/src-ui-maintenance-screen-js.md).

The [home/lab handoff](../.impeccable/review/home-lab/verdict.md) is historical
independent-tool-entry evidence. Its keyboard-targeting fix remains in the build,
but its room-specific overlay and return behavior are superseded here.

Current [independent full finish review](../.impeccable/review/assembly-merge/finish-review.md):
all nine supplied captures, the direction brief and primary CSS were inspected.
It found two material issues and made persistence conditional on this targeted
documentation merge. The [final verdict](../.impeccable/review/assembly-merge/verdict.md)
is **SHIP for both scored fixes**: opaque upgraded-room hint backing and dark
selected/Save labels. A fresh scoring agent confirmed those two fixes against
same-path recaptures; it did not conduct a second defect hunt or certify that
the whole surface has no possible defects.

Final evidence in [assembly-merge](../.impeccable/review/assembly-merge/):
`top-desktop.png`, `diy-desktop.png`, `launcher-desktop.png`,
`launcher-mobile.png`, `care-mobile.png`, `care-small.png`,
`childhood-launcher.png`, `advanced-top.png` and `room-mobile.png`.
This documenter inspected `launcher-mobile.png` and `advanced-top.png` against
the current code. The supplied [detector](../.impeccable/review/assembly-merge/detector.json)
has seven advisory findings for the inherited blue and 3px corners, not a reason
to alter the pinned appearance to match the older DESIGN.
No tests, browser execution or new detector were run for this documentation-only
merge. Static evidence does not independently verify strokes, swap motion,
real-device performance, Safari or a native UI port. Runtime verification remains
separate in the [assembly verification record](../.impeccable/review/assembly-merge/verification.md).

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
`minimal` is the initial shared room. `childhood` remains manually selectable
before its chapter-one recommendation; the original `advanced` precision lab
requires LV.2 (120 laboratory XP). Story following recommends the rooms at the
chapter milestones above; earning LV.2 through testing unlocks manual advanced
selection without replacing the room by itself. Manual choice disables room
story following and can always restore minimal. The preference persists in the
existing save and is shared by assembly/tools and testing. These room unlocks
are implemented, separate from still-pending equipment-upgrade services.

The whiteboard displays the same computed metrics, status, progress and accessible
live text as the precision monitor. Selecting a room does not change measurement,
wind demonstration or rewards; chapter two's XP floor is a progression rule,
not a room-selection reward. Front/overhead inspection, quality controls and
explicit test-driven spin remain available across the shared rooms.

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

### Championship materials and hardware (2026-09-23)
The supplied metal/glass/cyan concept refines the existing competition apparatus.
Six material families now use physical shading with explicit PHYSICAL definitions:
satin titanium, graphite enamel, graphite housings, brushed aluminium, polished
aluminium and acrylic. The six `championship-*` material colors above are
surface albedos, not UI colors. Each material explicitly binds the current scene
environment so its reflection intensity actually applies in Three r178.

`world-surface.js` shades restrained radial machining, peripheral panel joins,
fine central hexagonal etching and light scuffs without changing the bowl shape.
Coating grain and the bright polished reveals contrast with dark equipment shells.
Transparent acrylic has Fresnel opacity, edge/seam accents and clearcoat; it does
not allocate a transmission target. Two side-rig area lights create broad metal
highlights, with intensities 2.1 at night and 1.25 by day. They share Three's LTC
lookup textures and add no shadows or reflection passes. The six moving spots
and two runner rings retain their existing timing and pause behavior.

Blender adds twelve guard saddles with gaskets, clamp caps and captive screws;
twelve external service housings with bracing; outer foundation cassettes and
recessed channels; flush perimeter indices and inward chevrons. These are visual
details at the existing apparatus scale. Radius 6.9, all collision surfaces,
the real A/B/C supply zones and the battle solver retain their definitions.
Fresh desktop/mobile day/night evidence is in
[championship material verification](../.impeccable/review/championship-materials/verification.md).

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
the battle result card now scrolls within `calc(100% - 32px)` maximum height,
as extended by the game-flow styles below.

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

### Preparation, result advice and pause
Implemented in Web on 2026-09-17, following the
[game-flow direction](../docs/game_flow_optimization.md). Its current execution
items are implemented; the separately listed future opportunities remain proposals.
This is a local interaction extension: retain campaign paper, existing navigation,
fixed portrait framing, all street/championship art and other world conventions.
No new shipping raster, physics, economy, ownership or progression model is added.

- Mission sheet: show opponent, objective and current loadout/preparation links
  before the story. Story and opponent intelligence remain available in separate
  native disclosures, closed initially; the existing bottom launch action stays
  outside the mission sheet's scroll area.
- Preparation return: use the current tab's `sessionStorage` key
  `spin-core-preparing-mission`, not a new field in the v2 save. Reading, writing
  and using the target require completed/skipped onboarding and a playable
  mission. Assembly, lab and collection reuse their existing navigation to return
  to that mission, including replaying an older mission after cross-page moves
  or refresh. Show the opponent with the return label; retain testing/lift guards.
  Locked previews cannot establish a target. Explicit free-mode selection or
  preparing a new battle clears it. Storage failure warns and limits persistence.
- Result advice: give one next step from the player's own measured damage,
  imbalance and zone time, never the loser's metadata. A lost ring-out prioritizes
  control; significant structural damage points to the affected part; low zone
  time prompts zone control, then other losses suggest the tip. A win can retain
  the current build. A part action focuses the existing assembly slot without
  buying or equipping anything. First-training results retain the existing
  first-purchase guidance instead of a part-coach shortcut.
- Result presentation: use `flow-coach-ink` for left-aligned 14px/1.6 advice.
  Full telemetry and part damage are initially folded into a native disclosure;
  reward receipt and next actions remain outside it. The scrollable result card
  uses contained overscroll; its opaque paper action row sticks at bottom -20px
  with 10px vertical padding. Action labels wrap and buttons are at least 44px high.
- Pause dialog: native modal with named heading/description, paper/ink surfaces,
  2px border, 5px corners and 24px padding; width is
  `min(380px, calc(100vw - 40px))`, maximum height `calc(100dvh - 40px)` with
  scrolling. Keep 24px heading, 14px/1.6 body, 44px minimum-height buttons and
  a 3px blue focus outline offset by 3px. Continue is yellow and initially focused;
  exit is secondary and explicitly says no coins or mission progress are settled.
  Timer/Escape pauses a running match; Escape in the dialog explicitly resumes.
  Window blur or hidden visibility clears keys, joystick and pointer capture,
  then pauses. Returning focus alone never resumes; continuing clears input
  again and returns focus to the timer. Leaving discards the match without
  rewards or battle history. In the ready phase, the control returns instead.

Local interaction colors come from `src/ui/game-flow.css` and `campaign.css`:
`campaign-button-hover` is the existing button hover blue;
`campaign-disclosure-hover-ink` and `campaign-disclosure-hover-paper` retain
the existing disclosure/link hover pair. `flow-coach-ink` is the paper report's
deep teal advice text. These are local tokens, not new world palettes.
Sources: `src/main.js`, `src/core/battle-coach.js`, `src/ui/game-flow.css`,
`campaign-panel.js`, `lab-screen.js` and `showroom-screen.js` under `src/ui/`.

Recorded [flow finish review](../.impeccable/review/flow/finish-review.md):
**SHIP**, limited to eight static captures in that directory: `desktop.png`,
`mobile.png`, `result-desktop.png`, `result-mobile.png`, `pause-desktop.png`,
`pause-mobile.png`, `lab-mobile.png` and `collection-mobile.png`. This does not
independently certify runtime, motion, full keyboard/accessibility paths, every
advice branch or real-device performance. Supplied main evidence: unit 29,
flow 41, campaign 65, lab 27, showroom 25 and battle-ui 20 PASS; build PASS with
the existing approximately 888 kB Three.js chunk warning. These are inherited
results, not tests, browser checks or an independent review rerun for this
documentation-only merge.

### Staged training, build comparison and chapter replies
Implemented in Web on 2026-09-17 within the existing aesthetic; see the
[second-round flow scope](../docs/game_flow_round2.md). These components extend
the incumbent paper guidance, assembly and campaign reports, with no new raster,
world palette, physics, economy or progression authority.

- Staged tutorial: reuse one polite live guidance card for both training matches.
  Ready emphasizes direct launch; running first asks for joystick or keyboard
  steering, then follows the active supply zone and its cooling state. Steering
  is acknowledged only after control magnitude exceeds 0.15 in a solver step;
  replenishment is acknowledged only after actual `spinHarvested > 0`. These
  cues do not gate the match or rewards. Skip remains available, and guidance
  hides when the match finishes. The first-part action opens the existing part
  selector; purchase still requires the existing confirmation. Before the second
  match, assembly summarizes theoretical changes, not a promise of victory.
- Tutorial presentation: opaque campaign paper, inherited type, 18px/1.35
  heading, 13px/1.5 copy and a soft `0 5px 16px #12151a33` shadow, without backdrop
  blur. Battle guidance sits at top 180px with 16px side insets and 10px 12px
  padding; at heights up to 700px, top becomes 145px, vertical padding 6px and
  heading 16px. Assembly guidance sits 280px above the bottom. Tutorial controls
  use a 3px campaign-blue focus outline with 2px offset.
- Same-slot comparison: assembly and mission preparation compare the current
  loadout against that slot's latest completed-battle build and normalized DIY.
  Results compare the actual pre-match snapshot against the retained prior
  baseline before replacing it in the existing v2 save's `battleNotes`. Abandoned
  matches do not overwrite the baseline. Missing history gets an explicit empty
  state, not a sample build. Show changed parts/DIY and five rounded theoretical
  ratings (0-100), with previous/current columns and signed deltas from the
  canonical calculation model. Unchanged builds suggest trying another control
  route; the qualification explains that map, launch and steering affect results.
- Comparison presentation: native disclosures start closed. Assembly places its
  paper container below the loadout controls at top 140px, inset 16px, with 10px
  horizontal padding, a 1px separator border and 3px corners. Opening it hides
  assembly guidance and limits the scroll area to `min(340px, 45dvh)` with contained
  overscroll; DIY editing hides the comparison. Mission comparison stays inside
  the mission sheet, and result comparison nests inside the existing report
  disclosure, leaving primary actions outside the disclosures and retaining
  the sticky result action row. Use
  13px/1.5 copy, a 12px table caption, tabular numerals, left-aligned row headings
  and right-aligned values with 5px 8px cell padding. Disclosure summaries have
  40px minimum height, 9px vertical padding, the existing disclosure hover pair
  and a 3px blue focus outline offset by 2px.
- Chapter replies: each of the five existing chapter-ending missions has an
  attributed response. Only first-clear results insert that response and name
  the next destination or final memory action; replay does not repeat a first
  clear. The mission sheet's initially closed replies disclosure shows the
  unlocked count out of five and only responses whose chapter-ending mission is
  completed, or an explanatory empty state. Existing completion facts also
  restore replies for older saves, without extra rewards or locked-chapter
  spoilers. Recall titles are 15px; result replies retain 14px/1.6 narrative text
  in `flow-coach-ink`, with separator borders and 12px vertical padding.

`flow-separator` names the existing muted grey-green border reused by first-round
result advice and the comparison table/container, reply articles and result
reply. It is a local paper-interface separator, not a new palette or recoloring
request. Sources: `src/ui/growth-flow.css`, `src/ui/build-comparison.js`,
`src/ui/campaign-panel.js`, `src/core/growth-state.js`, `src/data/chapter-moments.js`
and tutorial/result wiring in `src/main.js`.

Recorded [growth finish review](../.impeccable/review/growth/finish-review.md):
**SHIP**, no material findings or fixes, scoped to the local extension, inspected
code and supplied evidence including ten desktop/mobile captures. Chapter
captures show a migrated completion fixture; they do not visually demonstrate
all five replies or live chapter-ending transitions. This documentation merge
does not rerun context loading, browser checks, detectors or tests, and does not
extend the review to human learning, difficulty, full accessibility, device
performance or Godot.

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
`resources/battle_worlds/championship.glb` (approximately 8.66 MB) together with
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
- Do keep assembly tools paper/ink/blue across rooms, with dark selected/Save labels.
- Do keep the tool console scrollable and Save fixed outside it.
- Do retain the original assembly carousel, five-part picker and DIY.
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
- Don't turn local assembly comic edges into a global screen style.
- Don't reintroduce a separate launcher/maintenance page or room-specific tool skin.
- Don't equate shared-physics v6 in Godot with a full native Web UI/art port or
  external multiplayer compatibility.

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

## Physics feedback v5 (2026-09-24)

Preserve the incumbent battle and collection palettes. Battle controls are
screen-relative at the input boundary; the arrow consumes the resulting world
force. Preview and released motion share the same launch calculation, including
launcher and maintenance settings. Compose tilt before local-axis spin, keeping
the tip on its support point. Trail brightness ages over 0.55 seconds.

Draws use the existing result sheet with explicit reasons and a visible rematch
action, including first training. They grant no coins or progression. Stop,
ring-out and time endings retain distinct motion; reserve the extra impact for
structural break. Audio failures cannot stop the game.

The existing ground label adds sliding/gripping/scraping state. Supply copy
distinguishes the speed cap, net gain, continued drain and contested supply.
Do not infer damage merely from a negative net spin change.

Stamina and durability scores now derive from fixed-condition solver trials;
the other three remain attribute conversions. Assembly exposes a native
measurement disclosure inside the existing comparison panel, reachable without
selecting a part; collection reuses its existing dialog. Conditions use
the base launcher and no maintenance. Keep the current compact typography,
keyboard focus and world-specific colors. See
[model and validation boundaries](../docs/physics_v5_implementation.md).
