# Test Lab Finish Review

Review performed in-thread: this session exposes no subagent tool. This is a
scoped Godot scene extension, not a web redesign; no HTML/CSS detector applies.
Evidence: desktop.png, phone.png, scanning.png, details.png and the supplied
laboratory reference. PRODUCT.md and an approved pixel-reproduction comp are
not present; repository documentation supplies product constraints.

disposition: fix

## persistence
The existing project physics baseline and three-loadout model are preserved.
The Blender source, exported GLB, generator, and scene smoke runner exist.

## fidelity
| Element | Verdict | Evidence |
| --- | --- | --- |
| Type | Adaptation | Existing Godot Chinese font, enlarged live instrument readouts |
| Material | Adaptation | Authored beveled 3D equipment, original procedural specimen |
| Ground | Contradicted | Silver wall and worktop remain too close to white |
| Apparatus | Match | Layered platen, measuring arm, twin instruments, acrylic shield |
| Operation | Adaptation | Existing physics units and environment estimates retained |
| Navigation | Adaptation | Three real loadouts; no invented shop or currency |
| Contact shading | Missing | Equipment joints need local ambient occlusion |

## ceiling
The reference's photoreal material texture and soft studio reflections are not
reached by the current Compatibility render. Do not claim pixel fidelity.

## material_fixes
1. Reduce environment and direct exposure; preserve neutral silver instead of cyan-white.
2. Bake local contact occlusion into static geometry for Compatibility rendering.

## keep
Keep the real rotating specimen, live in-world readout, clear sightline, compact
controls, and unmodified battle physics.

## Verdict Pass
1. Exposure: partial. Color is restored, but the now-active vertex albedo makes
   the earlier exposure reduction too strong. Restore neutral studio fill.
2. Contact occlusion: resolved. COLOR_0 is enabled and contact recesses render.
Regression: the dark header is no longer readable on the corrected background;
use the reference's light header treatment.

disposition: fix

## Final Verdict
1. Exposure: resolved for the real-time pass. Neutral mid-value wall panels
   retain shading; the silver platen and graphite enclosure are distinct.
2. Contact occlusion: resolved. The exported color attributes and runtime
   activation are checked by the smoke runner.
3. Header contrast regression: resolved by the reference's light lettering.

Remaining: none of the scored fixes. This verdict covers that list, not
photoreal parity or device performance. Scoped design and source notes are in
`docs/test_lab/`; the existing global visual system was not replaced.

disposition: ship
