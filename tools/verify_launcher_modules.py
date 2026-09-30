"""Blender --background --python tools/verify_launcher_modules.py"""
import json
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]


def import_bounds(path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    return [min(p[i] for p in points) for i in range(3)] + [
        max(p[i] for p in points) for i in range(3)]


stock = import_bounds(ROOT/"resources/launcher/launcher.glb")
modular = import_bounds(ROOT/"resources/launcher/study/launcher-modular.glb")
assert max(abs(x-y) for x,y in zip(stock,modular)) < 1e-5, (stock,modular)
modules = [o for o in bpy.context.scene.objects if o.get("partId") and o.type == "EMPTY"]
assert len(modules) == 8
slots = {o["slotId"] for o in modules}
assert len(slots) == 8
mount = next(o for o in bpy.context.scene.objects if o.name.startswith("TopMount"))
assert (mount.matrix_world.translation-Vector((0,.12,-.474))).length < 1e-5
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for mesh in meshes:
    assert mesh.parent in modules
    assert mesh.get("slotId") == mesh.parent.get("slotId")
    if mesh.get("paintZone") != "fixed":
        assert mesh.get("slotId") not in {"rack","transmission","coupler"}
report = {
    "moduleCount": len(modules), "slots": sorted(slots), "meshCount": len(meshes),
    "stockBounds": stock, "modularBounds": modular,
    "topMountPreserved": True, "internalPaintIsolated": True,
    "note": "GLB re-import check; bounds use Blender Z-up coordinates",
}
path = ROOT/"docs/assets/launcher-modules/validation.json"
path.write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
print("MODULE_VALIDATION_OK", json.dumps(report), flush=True)
