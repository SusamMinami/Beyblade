"""Split the current authored launcher into replaceable modules and paint zones.

Blender --background --python tools/split_launcher.py [-- --render]
Study outputs only: the live game's seven-mesh launcher is not overwritten.
Frame 1 = assembled blue/white, frame 60 = exploded. Named module roots keep
their own attachment anchors; export batches only within a module/paint zone.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tools/art_source/launcher.blend"
MODULAR = ROOT / "tools/art_source/launcher_modular.blend"
OUTPUT = ROOT / "resources/launcher/study"
REVIEW = ROOT / "docs/assets/launcher-modules"

MODULES = [
    dict(id="housing", label="机身外壳", anchor=[0, -.03, -.12],
         explode=[0, 0, 0], role="cosmetic", note="上下壳、护肩、固定导轨"),
    dict(id="cover", label="检修上盖", anchor=[0, .25, -.12],
         explode=[-.4, 2.8, -.4], role="cosmetic", note="盖板、边框、加强筋与螺丝"),
    dict(id="grip", label="主握柄", anchor=[0, 0, .7],
         explode=[-1.3, -.25, 1.8], role="handling_candidate", note="握柄骨架、胶垫、防滑纹"),
    dict(id="pull_handle", label="抽拉柄", anchor=[1.95, .055, -.85],
         explode=[2.65, .25, 0], role="handling_candidate", note="T 形手柄、端盖与连接头"),
    dict(id="rack", label="驱动齿条", anchor=[.875, .055, -.85],
         explode=[1.3, 1, 0], role="performance_candidate", note="贯穿壳体的整条齿条"),
    dict(id="transmission", label="传动芯组", anchor=[0, .055, -.12],
         explode=[0, 1.4, 0], role="performance_candidate", note="三组齿轮、轴座、回位弹簧"),
    dict(id="coupler", label="陀螺连接头", anchor=[0, -.25, -.12],
         explode=[0, -1, 0], role="performance_candidate", note="输出套筒、卡口、锁定爪"),
    dict(id="release", label="释放开关", anchor=[.9, .04, .39],
         explode=[1.6, -.3, .3], role="incomplete_mechanism", note="现有滑钮；内部释放机构待补"),
]

PALETTES = {
    "blue_white": {"primary": [35,65,112], "secondary": [224,230,225],
                   "chassis": [30,38,43], "grip": [24,38,55],
                   "accent": [244,158,46], "window": [69,94,113]},
    "red_black": {"primary": [184,55,34], "secondary": [52,57,61],
                  "chassis": [27,31,34], "grip": [24,27,30],
                  "accent": [232,171,67], "window": [69,94,113]},
}


def xyz(p):
    return Vector((p[0], -p[2], p[1]))


def linear(rgb):
    return tuple(((c/255+.055)/1.055)**2.4 if c > 10 else c/3294.6 for c in rgb)


def prefix(name, names):
    return any(name.startswith(p) for p in names)


def classify(obj, source_collection):
    n = obj.name
    if source_collection.startswith("01"):
        if prefix(n, ["Tapered grip", "Ivory grip", "Rubber palm", "Chevron grip",
                      "Finger edge", "Heel", "Ivory neck", "Mould marking SPIN"]):
            return "grip"
        if prefix(n, ["Recessed lock", "Amber release", "Release slider"]):
            return "release"
        if n.startswith("Lid side keeper"):
            return "cover"
        return "housing"
    if source_collection.startswith("02"):
        if prefix(n, ["Internal rack"]):
            return "rack"
        if prefix(n, ["Lid support", "Recessed fastener", "Stainless captive", "Screw slot"]):
            return "housing"
        return "transmission"
    if source_collection.startswith("03"):
        return "cover"
    if source_collection.startswith("04"):
        if prefix(n, ["Pull handle", "T pull", "T handle"]):
            return "pull_handle"
        if prefix(n, ["Rack guide"]):
            return "housing"
        return "rack"
    if source_collection.startswith("05"):
        return "coupler"
    raise ValueError(f"Unclassified part: {obj.name} / {source_collection}")


def paint_zone(obj, slot):
    n = obj.name
    if obj.type != "MESH":
        return None
    m = obj.data.materials[0].name
    # Internal gears and the wearing surfaces of the coupling/rack stay fixed.
    if slot in {"transmission", "coupler", "rack"}:
        return None
    if prefix(n, ["Mould marking", "Direction datum", "Recessed fastener",
                  "Stainless captive", "Screw slot", "Lid support"]):
        return None
    return {"Launcher_Cobalt_ABS": "primary", "Launcher_Ivory_ABS": "secondary",
            "Launcher_Graphite_POM": "chassis", "Launcher_Grip_TPE": "grip",
            "Launcher_Amber_Lock": "accent", "Launcher_Smoked_PC": "window"}.get(m)


def evaluated_bounds(obj, deps):
    return [obj.matrix_world @ Vector(p) for p in obj.evaluated_get(deps).bound_box]


def split():
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    source_collections = [c for c in bpy.data.collections if c.name[:2] in {"01","02","03","04","05"}]
    original = [(o, c.name) for c in source_collections for o in c.objects]
    assert len([o for o, _ in original if o.type == "MESH"]) == 193
    source_transforms = {o.name: o.matrix_world.copy() for o, _ in original}
    roots, groups, members, paint_materials = {}, {}, {}, {}
    for index, module in enumerate(MODULES, 1):
        slot = module["id"]
        c = bpy.data.collections.new(f"{index:02d} / {slot} / {module['label']}")
        bpy.context.scene.collection.children.link(c)
        root = bpy.data.objects.new("Module_"+slot, None)
        root.empty_display_type = "PLAIN_AXES"
        root.empty_display_size = .15
        root.location = xyz(module["anchor"])
        root["slotId"] = slot
        root["partId"] = f"launcher.{slot}.stock"
        root["designRole"] = module["role"]
        root["moduleLabel"] = module["label"]
        c.objects.link(root)
        roots[slot], groups[slot], members[slot] = root, c, []
    bpy.context.view_layer.update()
    for obj, source_collection in original:
        slot = classify(obj, source_collection)
        zone = paint_zone(obj, slot)
        transform = obj.matrix_world.copy()
        for c in list(obj.users_collection):
            c.objects.unlink(obj)
        groups[slot].objects.link(obj)
        obj.parent = roots[slot]
        obj.matrix_basis = roots[slot].matrix_world.inverted() @ transform
        obj["slotId"] = slot
        obj["paintZone"] = zone or "fixed"
        members[slot].append(obj)
        if zone:
            src = obj.data.materials[0]
            key = (zone, src.name)
            if key not in paint_materials:
                m = src.copy()
                m.name = f"Paint_{zone}__{src.name}"
                m["paintZone"] = zone
                paint_materials[key] = m
            obj.data.materials[0] = paint_materials[key]
        elif obj.name.startswith("Mould marking SPIN"):
            ink = obj.data.materials[0].copy()
            ink.name = "Label_adaptive"
            obj.data.materials[0] = ink
    for c in source_collections:
        bpy.data.collections.remove(c)
    # Assembled object transforms are preserved; anchors are design interfaces,
    # not newly invented physical joints hidden inside the mesh.
    bpy.context.view_layer.update()
    for module in MODULES:
        root = roots[module["id"]]
        root.keyframe_insert(data_path="location", frame=1)
        root.location += xyz(module["explode"])
        root.keyframe_insert(data_path="location", frame=60)
    scene = bpy.context.scene
    scene.frame_start, scene.frame_end = 1, 60
    scene.frame_set(1)
    scene["assemblyNotes"] = "Frame 1: stock assembly; Frame 60: exploded module study"
    scene["paintNotes"] = "primary / secondary / chassis / grip / accent / window; internal metals/gears fixed"
    scene["palettePresets"] = json.dumps(PALETTES)
    scene["status"] = "Design study. Not imported by the game; no progression or combat stats assigned."
    bpy.context.view_layer.update()
    assert all(abs(o.matrix_world[i][j]-source_transforms[o.name][i][j]) < 1e-6
               for o, _ in original for i in range(4) for j in range(4)), "Assembled transforms changed"
    # An existing bolt or decorative slider is not a validated replacement joint.
    contracts = {
        "housing": "Fixed output axis and shared mounting envelope; shell-specific geometry may vary",
        "cover": "Four lid screws and gearbox opening perimeter",
        "grip": "Neck plane at visual Z=0.70; hidden plug/screws still to author",
        "pull_handle": "Rack end at visual X=1.95; replaceable pin joint still to author",
        "rack": "Common guide cross-section and tooth module; visible teeth are illustrative",
        "transmission": "Output axis X=0,Z=-0.12; swap the whole matched gear cassette",
        "coupler": "TopMount unchanged at [0,-0.474,-0.12]; upper quick-change joint still to author",
        "release": "Slider only; latch/cam/spring and its motion are not yet modeled",
    }
    manifest = {
        "status": "design-study-not-integrated", "source": str(SOURCE.relative_to(ROOT)),
        "sourceMeshCount": 193, "units": "Web visual units",
        "palettes": PALETTES, "topMount": [0,-.474,-.12], "modules": [],
    }
    for index, module in enumerate(MODULES, 1):
        slot = module["id"]
        meshes = [o for o in members[slot] if o.type == "MESH"]
        manifest["modules"].append({
            **module, "number": f"{index:02d}", "partId": f"launcher.{slot}.stock",
            "meshCount": len(meshes), "objects": [o.name for o in members[slot]],
            "paintZones": sorted({o["paintZone"] for o in meshes}),
            "interfaceNote": contracts[slot],
        })
    return roots, members, paint_materials, manifest


def export_modules(roots, members, manifest):
    scene = bpy.context.scene
    scene.frame_set(1)
    deps = bpy.context.evaluated_depsgraph_get()
    runtime = bpy.data.collections.new("99 / Module export")
    scene.collection.children.link(runtime)
    all_export = []
    triangle_count = batch_count = 0
    for module in MODULES:
        slot = module["id"]
        root = roots[slot].copy()
        root.animation_data_clear()
        root.name = "Export_"+slot
        runtime.objects.link(root)
        all_export.append(root)
        bpy.context.view_layer.update()
        batches = {}
        for obj in members[slot]:
            if obj.type == "MESH":
                data = bpy.data.meshes.new_from_object(obj.evaluated_get(deps))
                copy = bpy.data.objects.new(obj.name, data)
                runtime.objects.link(copy)
                copy.parent = root
                copy.matrix_basis = root.matrix_world.inverted() @ obj.matrix_world
                key = (data.materials[0].name, obj["paintZone"])
                batches.setdefault(key, []).append(copy)
            else:
                copy = obj.copy()
                runtime.objects.link(copy)
                copy.parent = root
                copy.matrix_basis = root.matrix_world.inverted() @ obj.matrix_world
                all_export.append(copy)
        for (material_name, zone), batch in batches.items():
            bpy.ops.object.select_all(action="DESELECT")
            for o in batch:
                o.select_set(True)
            bpy.context.view_layer.objects.active = batch[0]
            if len(batch) > 1:
                bpy.ops.object.join()
            obj = batch[0]
            obj.name = f"{slot}__{material_name}"
            obj["slotId"], obj["paintZone"] = slot, zone
            obj.data.calc_loop_triangles()
            triangle_count += len(obj.data.loop_triangles)
            batch_count += 1
            all_export.append(obj)
    bpy.ops.object.select_all(action="DESELECT")
    for o in all_export:
        o.select_set(True)
    path = OUTPUT / "launcher-modular.glb"
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", use_selection=True,
                             export_yup=True, export_extras=True, export_animations=False,
                             export_cameras=False, export_lights=False)
    manifest["runtime"] = {"meshCount": batch_count, "triangles": triangle_count,
                           "bytes": path.stat().st_size, "moduleRoots": 8}
    for o in list(runtime.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(runtime)


def set_palette(materials, palette):
    for (zone, _), material in materials.items():
        color = (*linear(PALETTES[palette][zone]), 1)
        p = material.node_tree.nodes["Principled BSDF"]
        p.inputs["Base Color"].default_value = color
        material.diffuse_color = (*color[:3], material.diffuse_color[3])
    ink = bpy.data.materials.get("Label_adaptive")
    if ink:
        value = (224,230,225) if palette == "red_black" else (35,65,112)
        ink.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*linear(value),1)


def render(name):
    bpy.context.scene.render.filepath = str(REVIEW/(name+".png"))
    bpy.ops.render.render(write_still=True)


def setup_explosion(roots, members, manifest):
    scene = bpy.context.scene
    scene.frame_set(60)
    # Avoid the ground covering the exploded output socket.
    bpy.data.objects["Studio ground"].location.z = -1.7
    camera = scene.camera
    target = xyz((1.0,.8,.5))
    camera.location = xyz((6.8,8.9,12.5))
    camera.rotation_euler = (target-camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.ortho_scale = 10.5
    scene.render.resolution_x, scene.render.resolution_y = 1900, 1450
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    projections = {}
    for module in MODULES:
        points = [world_to_camera_view(scene, camera, p)
                  for obj in members[module["id"]] if obj.type == "MESH"
                  for p in evaluated_bounds(obj, deps)]
        projections[module["id"]] = {
            "bounds": [min(p.x for p in points),1-max(p.y for p in points),
                       max(p.x for p in points),1-min(p.y for p in points)],
            "label": module["label"], "number": f"{MODULES.index(module)+1:02d}",
        }
    (REVIEW/"projection.json").write_text(json.dumps(projections, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    return projections


def animate_inspection_camera(roots, members, manifest):
    scene = bpy.context.scene
    scene.frame_set(1)
    camera = scene.camera
    floor = bpy.data.objects["Studio ground"]
    camera.keyframe_insert(data_path="location", frame=1)
    camera.keyframe_insert(data_path="rotation_euler", frame=1)
    camera.data.keyframe_insert(data_path="ortho_scale", frame=1)
    floor.keyframe_insert(data_path="location", frame=1)
    setup_explosion(roots, members, manifest)
    camera.keyframe_insert(data_path="location", frame=60)
    camera.keyframe_insert(data_path="rotation_euler", frame=60)
    camera.data.keyframe_insert(data_path="ortho_scale", frame=60)
    floor.keyframe_insert(data_path="location", frame=60)
    scene.frame_set(1)
    for frame, label in [(1, "ASSEMBLED / 完整装配"), (60, "EXPLODED / 八个模块")]:
        marker = scene.timeline_markers.new(label)
        marker.frame = frame


if __name__ == "__main__":
    for folder in [OUTPUT, REVIEW, MODULAR.parent]:
        folder.mkdir(parents=True, exist_ok=True)
    roots, members, materials, manifest = split()
    animate_inspection_camera(roots, members, manifest)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(MODULAR))
    export_modules(roots, members, manifest)
    assert manifest["runtime"]["triangles"] == 27560, "Unexpected geometry change"
    assert sum(m["meshCount"] for m in manifest["modules"]) == 193
    (OUTPUT/"modules.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    if "--render" in sys.argv:
        scene = bpy.context.scene
        scene.cycles.samples = 32
        scene.render.resolution_x, scene.render.resolution_y = 1200, 1000
        render("assembled-blue")
        set_palette(materials, "red_black")
        render("assembled-red")
        set_palette(materials, "blue_white")
        setup_explosion(roots, members, manifest)
        render("exploded")
    print("MODULES_READY", json.dumps({"modules": [(m["id"], m["meshCount"]) for m in manifest["modules"]],
                                     "runtime": manifest["runtime"]}), flush=True)
