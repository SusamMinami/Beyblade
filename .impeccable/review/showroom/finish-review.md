# Showroom / wind inspection finish review

Review performed in-thread; the session has no available subagent spawn tool.
Authority: the user's two stage references and the explicit request for spin,
closer framing, manual overhead view, visible wind influence and lift switching.

disposition: ship

## persistence
The Web-first rule is retained. Both editable Blender sources and exported GLBs
exist. Selection reuses existing loadouts, stat bars reuse getBuildRatings, and
stage unlock uses lab XP with no coins charged. Preview is transient.

## fidelity
| Requirement | Evidence / verdict |
| --- | --- |
| Explicit test rotation | RPM rises with idle rotation disabled; functional reduced-motion path |
| Closer inspection | Front camera moved from z=9.7 to z=8.85 |
| Manual overhead | Button changes camera and clips upper instruments; HTML summary stays visible |
| Wind direction/speed | Adjustable 0–12, 0–360; downstream arrows and tilt/displacement use same vector |
| Holographic stage | Authored concentric deck, ring, crest, service fixtures, shader cylinder |
| Arena stage | Separate authored truss, chain, speakers, light rig, warm crest and spotlight cones |
| Lift switching | 400 ms down / hidden commit / 650 ms up, clipping at the deck plane |
| Unlock | LV1 lock, preview isolation, LV2 free unlock/equip, reload persistence |
| Device coverage | 1440x1000 desktop and 390x844 phone-sized browser |

## ceiling
Real-time geometry and lightweight effects follow the reference direction.
They do not match its photoreal surface textures. Wind is a local demonstration,
not the battle solver; this limitation is present in the help and documentation.
Phone-sized browser verification does not constitute real-device benchmarking.

## material_fixes
Resolved in the single correction batch:
1. Camera angle and distance now show the lift deck before the card strip.
2. Reduced crest proportions and emission keep focus on the specimen.
3. Stage label no longer overlaps XP. Explicit detail rows keep the action within
   the phone panel.
4. Collection stat bars now call the incumbent ratings function.

## keep
Keep the actual playable specimen, consistent navigation and units, isolated
preview/equip states, shared renderer, bounded lift state machine and saved wind.
No generated raster assets ship. The design detector's color advisories correspond
to the intentional cyan/gold stage palette now recorded in DESIGN.md.

Evidence files opened and checked: holo/arena desktop, mobile and portrait,
lab-close-desktop.png, lab-top-running.png, lift-rising.png, unlock.png.
Validation: 29 existing tests, 27 lab integration checks, 25 showroom/wind checks.
