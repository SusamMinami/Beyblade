# Test Lab Art Pass

Scope: retained **Godot precision-lab scene and shared asset**.
Documentation scope checked on 2026-09-16; the verification below is the original
delivery record, not a new run. Current Web work starts at
[Web README](../../web-prototype/README.md) and
[battle worlds](../battle_worlds.md). The Web lab now defaults to the childhood
desk and uses a 5.2-second explicit test; the 2.4-second scan below is Godot-only.

## Entry Points

- Scene: `res://scenes/assembly/TestLabScreen.tscn`
- UI and data: `scripts/assembly/test_lab_screen.gd`
- Lighting, acrylic shield, specimen fit, and scan animation:
  `scripts/assembly/test_lab_stage.gd`
- Shipping set: `resources/test_lab/test_lab.glb`
- Editable Blender source: `tools/art_source/test_lab.blend`
- Reproducible authoring script: `tools/build_test_lab.py`

Run the scene directly with Godot F6, or enter the lab from the assembly screen.
The existing main scene and project renderer are unchanged.

## Asset Provenance

The set was authored locally in Blender 5.2 with the Python generator, using the
user-provided laboratory image as visual reference. No external textures, fonts,
models, or reference-image pixels are included. Graphs on side instruments are
engraved reference graphics; only the central display shows live numeric data.

The exported set has 10 static material batches, 66,144 triangles, and a roughly
2.3 MB GLB. This excludes the existing dynamic specimen. Vertex colors contain
linear base color multiplied by ray-cast ambient occlusion. Godot must enable
`vertex_color_use_as_albedo`, with `vertex_color_is_srgb = false`, for those meshes.

The `.blend` stays in a `.gdignore` directory so a clean Godot checkout can import
the GLB without configuring Blender. Running the generator overwrites its own
two outputs. Edit the generator for reproducible changes; edits made directly
to the Blender source must be exported separately.

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.2\blender.exe" `
  --background --factory-startup --python tools/build_test_lab.py
```

## Data Boundaries

The test scene reuses `AssemblyCalculator` and the original stability/control
adjustments. Values are prototype game units, not physical SI measurements.
The 2.4-second scan is presentation only. Active DIY parameters now reach the
rendered specimen, and the center marker shares its fitted scale and rotation.
Switching samples uses the existing saved active-loadout operation.

## Verification

```powershell
$godot = "C:\Users\Admin\Downloads\Godot_v4.7-stable_win64.exe\Godot_v4.7-stable_win64_console.exe"
& $godot --headless --path . --editor --quit
& $godot --headless --path . --script tools/verify_test_lab.gd
& $godot --path . --script tools/verify_test_lab.gd
& $godot --headless --path . --script tests/assembly/assembly_calculator_test.gd
& $godot --headless --path . --script tests/assembly/five_part_top_model_test.gd
```

The graphical smoke run saves 720 x 1280 and 389 x 693 screenshots, scan and
details states, to `.impeccable/review/`. It covers 35 assertions including
imported vertex color activation, actual data, progress, mode/preset state,
center-marker transform, idle motion, details, and return navigation.
The runner does not change saved configurations or tutorial progress.

Verified on Windows / Godot 4.7 Compatibility / RTX 4080. Phone-sized windows
validate framing, not Android/iOS performance. No mobile-device benchmark or
photoreal fidelity claim is made. Future high-fidelity work can replace the
procedural specimen and add authored roughness/normal textures without changing
the calculation layer.
