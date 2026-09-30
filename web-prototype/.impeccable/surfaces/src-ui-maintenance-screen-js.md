---
version: 1
slug: "src-ui-maintenance-screen-js"
primary_target: "src/ui/maintenance-screen.js"
related_targets: ["src/render/maintenance-stage.js","src/ui/maintenance.css","src/render/launcher-model.js","src/main.js","src/render/workshop-room.js","src/core/home-progression.js"]
---

# Unified assembly tools

Scope: original Web assembly, with Operate tools over the actual equipment.
Latest user correction: the original assembly was better; fold new features
into it, retain its minimal style and reuse laboratory scenes. Separate pages
and replacement laboratory skins are rejected. `#launcher` and `#maintenance`
resolve into modes of the sole `#assembly` page and normalize the address.
Saving stays in the current mode; cancel/revert restores top assembly. Same-page
tool and room changes retain oil and launcher equipment/color drafts; navigation
away from assembly discards them. Completed purchases immediately persist
ownership and survive discard. These rules preserve original top picker and DIY
behavior rather than replacing their save/cancel flow.
The initial minimal plinth is shared with LabStage. With `followStory` enabled,
chapter one's `rival-arrives` recommends the existing childhood desk; chapter
two's `choose-a-line` recommends precision through the existing 120 XP floor/LV.2
rule. Repetition grants no extra XP; test-earned early unlock remains available.
Manual room choice sets its `followStory` to false and can return to minimal at
any progression. Assembly and testing share the room preference; the collection
stage retains an independent preference. Re-enabling follows the story again.
Extension 2026-09-24: launcher outfit mode shares original assembly and its actual
eight-module assembly. Three performance slots, nine authored parts, free shell/
accent/grip colors. Locked preview changes neither equipment nor ownership.
Purchase uses existing coins; equip enters draft; Save commits equipment and oil.
Part swaps move the old part out and the new part in along the authored vector,
without resetting orbit or reloading the housing. Click exposed geometry to select
a slot; textual controls provide the same keyboard path. Trial and battle use one
finite-work calculation; cam/fork/three dogs demonstrate release.
User-approved: transmission lubrication, oily grips, tip traction; automatically
exploded parts, no cover/access puzzle; movable top internals deferred.

## Direction contract

THESIS: Enjoy touching and tuning the actual equipment; location and amount
produce observable, reversible changes.

OWN-WORLD: Original assembly paper/ink/blue controls, three-loadout carousel,
five-part picker and DIY. The actual room changes independently; equipment and
minimal controls lead. Preserve this interface in minimal, childhood and advanced
rooms; no room-specific dark maintenance skin.

STORY: Choose the top or launcher, paint or wipe its exposed surfaces, inspect
the response, compare a controlled trial, save or discard.

FIRST VIEWPORT: Keep original header, loadouts and full-size scene. One compact
toolbar switches equipment, care and room. Original top customization remains;
launcher/care tools occupy the existing lower area with a fixed Save action.
The implemented short-screen adaptation hides the loadout title only in tool
modes at heights up to 740px, compressing upper controls to preserve model space.

FORM: Precisely specified local extension to the original assembly;
no concept tournament or seed. Signature: continuous surface strokes and
reversible oil sheen follow the moving parts.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Built assembly contract (2026-09-24)

- The toolbar exposes top, outfit, care and a room disclosure inside original
  assembly. Care applies to the current top/launcher target. No independent
  maintenance page or replacement navigation is created.
- All tool modes use the same paper/ink/blue palette. Selected part/tool and Save
  labels are `#12151a` on `#238cff` (5.46:1); upgraded-room gesture hints use
  opaque `#fffdf7` with `#4d555d` (7.45:1). Small 3px corners and existing comic
  part-card edges remain local assembly conventions, not global screen rules.
- Only the lower console scrolls, with Save fixed outside it. At heights up to
  740px the top compresses and the console uses a 32% maximum height rather than
  36%. Pointer tools retain the central scene. Keyboard focus uses named real
  parts and the visible surface-hit reticle; Enter paints/wipes at that reticle.
- `MaintenanceStage` and original assembly borrow `LabStage.scene`, the room
  cache, lights and reflection environment. `workshop-room.js` provides the shared
  minimal plinth; upgraded rooms reuse actual assets. Assembly, tools, lab and
  showroom use one renderer. Exit restores borrowed scene/canvas state.
- Automatic explosion, free paint/wipe, controlled trials and finite-energy
  launch calculations are unchanged. Mesh-local oil coordinates survive visual
  placement/scale. Save failure retains drafts and restores in-memory equipment;
  failed room-preference saves do not commit the new room.
- Shared-physics v6 in Godot local battle remains implemented concurrent work.
  This merge does not claim a full native assembly/tool UI or Web art port.

Sources: `src/ui/maintenance.css`, `src/ui/maintenance-screen.js`,
`src/render/maintenance-stage.js`, workshop wiring in `src/main.js`,
`src/render/workshop-room.js` and `src/core/home-progression.js`.
Current behavior: [shared assembly](../../../docs/home_lab_integration.md),
[launcher runtime](../../../docs/launcher_runtime.md) and
[maintenance boundaries](../../../docs/maintenance_lubrication_design.md).

## Current finish record (2026-09-24)

The [independent full finish review](../../../.impeccable/review/assembly-merge/finish-review.md)
inspected all nine supplied captures, the direction brief and primary CSS. It
found two material issues and made persistence conditional on the immediate
documentation merge. The [final verdict](../../../.impeccable/review/assembly-merge/verdict.md)
is **ship for both scored fixes**: opaque paper-backed upgraded-room instructions
and readable dark selected/Save labels. A fresh scoring agent checked those fixes
and same-path recaptures without a new defect hunt. This is not a claim of no
possible defects across the surface, nor a review of concurrent physics/Godot work.

Final captures in [assembly-merge](../../../.impeccable/review/assembly-merge/):
`top-desktop.png`, `diy-desktop.png`, `launcher-desktop.png`,
`launcher-mobile.png`, `care-mobile.png`, `care-small.png`,
`childhood-launcher.png`, `advanced-top.png` and `room-mobile.png`.
The documenter corroborated `launcher-mobile.png` and `advanced-top.png` against
the current code; it did not independently inspect every capture or execute the UI.
The existing [detector](../../../.impeccable/review/assembly-merge/detector.json)
contains seven advisories for inherited `#238cff` and 3px corners. They are not
authority to change the pinned appearance to satisfy the older DESIGN.

The [DESIGN merge](../../DESIGN.md#maintenance-within-original-assembly-2026-09-24),
its [sidecar](../design.json) and [PRODUCT](../../PRODUCT.md) record the final
states. This documentation pass ran no tests, browser checks or new detector.
Static evidence does not independently prove oil strokes, swap motion, real-device
performance or a native UI port. No new shipping raster assets were added;
launcher and upgraded-room models remain Blender-authored GLBs, while the shared
minimal plinth and existing tops are procedural.

## Historical independent-workbench handoffs

The [launcher handoff](../../../.impeccable/review/launcher-integration/verdict.md)
resolved its F1/F2/F3 fixes only; the
[home/lab handoff](../../../.impeccable/review/home-lab/verdict.md) resolved its
keyboard-targeting fix. Their separate tool entry, room-specific skin and older
scroll/return behavior are historical, not current assembly guidance. Retained
mechanisms and keyboard behavior do not reinstate the rejected workbench.
