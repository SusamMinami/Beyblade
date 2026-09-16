---
name: Battle Beyblade Test Lab
description: Reference-directed real-time metrology workbench for the Godot test scene.
colors:
  ink: "#172b30"
  readout: "#75efdc"
  instrument-glass: "#102e34"
  primary-action: "#d6e936"
  controls: "#d4dddd"
  secondary-control: "#e8eeed"
  muted: "#486268"
  header: "#f4fafa"
rounded:
  control: "6px"
  dialog: "8px"
typography:
  title:
    fontSize: "38px"
  body:
    fontSize: "21px"
  label:
    fontSize: "18px"
components:
  primary-button:
    backgroundColor: "{colors.primary-action}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
---

# Test Lab Visual System

Scope checked on 2026-09-16: retained **Godot precision-lab** design only.
The restrictions on currency/history/shop and the 2.4-second scan below do not
apply to the Web lab. Use [Web DESIGN](../../web-prototype/DESIGN.md) for current
Web rooms, test-driven rotation, XP, reports and shop behavior.

## Overview
Scope: `scenes/assembly/TestLabScreen.tscn` only. This does not replace the
graffiti visual language of assembly, customization, or battle.

The user's supplied laboratory image establishes the direction: silver equipment,
graphite housings, cyan measurement lights, and a yellow-green primary action.
The specimen remains the existing playable model, not a substitute illustration.

## Colors
Cyan belongs to instruments and active measurement. Yellow-green belongs to
the start command and physical calibration markers. The background remains a
neutral industrial set; the live display uses dark instrument glass.

## Typography
Use the incumbent Godot font and its Chinese fallback. Sizes are logical units
on the existing 720 x 1280 canvas, not viewport-dependent font sizes.
The in-world display renders at 960 x 480, with 94-unit values and 48-unit
headings before projection; these are texture-space sizes, not UI sizes.

## Layout
Retain the project's fixed portrait aspect and canvas stretch. The 3D view fills
the canvas. Controls form one full-width bottom band. Header and three loadout
selectors occupy the top; the monitor, specimen, and platen stay unobstructed.
Details use an explicit modal with keyboard focus retained on its close command.

## Elevation & Depth
Depth comes from authored beveled geometry, local vertex ambient occlusion,
physical shadows, environment reflection, and an open acrylic cylinder.
The live specimen is automatically fitted to its actual DIY bounds.

## Shapes
Circular measuring apparatus contrasts with straight gantry and instrument
enclosures. Controls have restrained corners and one-pixel borders.

## Components
The start command becomes a disabled progress readout during the 2.4-second
visual scan, then becomes a repeat command. Presets and modes are locked while
scanning. Changing a mode, environment, or specimen invalidates completion.
The specimen rotates slowly at rest; only the scan ring speeds up during testing.
All displayed numeric results come from the current build calculator.

## Do's and Don'ts
- Do preserve the real five-part build and its customizations.
- Do label rule-space measurements as game units, not grams or millimeters.
- Do keep ambient-occlusion vertex colors enabled on imported geometry.
- Don't add unsupported currency, lab levels, history, or shop actions.
- Don't propagate this local scene palette to unrelated screens.
- Don't treat this real-time pass as photoreal or pixel-identical to the reference.
