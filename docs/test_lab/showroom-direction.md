# Showroom and wind inspection

Original Web direction brief; scope checked on 2026-09-16.
Current implementation details live in [Web DESIGN](../../web-prototype/DESIGN.md)
and [battle worlds](../battle_worlds.md). Keep this brief for intent and lift
ordering; do not maintain a second full feature or validation list here.

## Direction contract
THESIS: the existing playable top arrives from a working stage lift.
OWN-WORLD: two user-pinned worlds: cyan holographic containment and an upgraded
graphite/gold concert rig. Continue the laboratory's type, currency and navigation.
STORY: inspect an owned build, switch it through the lift, preview or unlock a
stage, then test, customize or battle.
FIRST VIEWPORT: compact title/currency header; large top centered above a layered
deck; real build thumbnails below; concise description, calculated stat bars and
active-selection action above the five-item navigation.
FORM: user-specified references, no concept tournament. Actual Blender-authored
sets with runtime lift and light effects, not reference-image backgrounds.
FINISH: record the scoped review and asset provenance with each delivery.
Existing delivery evidence is historical, not a new approval gate for every task.

## Motion contract
- Focal moment: descend in 400 ms, exchange the hidden specimen, rise in 650 ms.
- Continuity: selection and stored active build change together while hidden;
  repeated input is disabled until the lift settles.
- Reduced motion: shorten the lift, freeze decorative rotation and light sweeps;
  explicit lab testing retains gentle functional spin.
- Lab: explicit test spin is independent of optional idle rotation. Wind vectors
  use the same direction as drift/wobble; they are a local demonstration, not a
  replacement battle solver.
- Render budget: reuse one lab renderer for the showroom, static GLB batches,
  instanced lighting fixtures, lightweight transparent cones; suspend hidden views.
- Progression: holographic stage is owned by default, concert stage unlocks at
  laboratory level 2; previewing never changes ownership or equipped stage.
