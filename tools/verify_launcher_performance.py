"""Re-import the actual GLBs and inspect source geometry/animation contracts."""
import hashlib
import itertools
import json
import math
import struct
from pathlib import Path

import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"resources/launcher/performance"
REVIEW=ROOT/"docs/assets/launcher-performance"
manifest=json.loads((OUT/"parts.json").read_text(encoding="utf-8"))
old=json.loads((ROOT/"resources/launcher/study/modules.json").read_text(encoding="utf-8"))
TOL=2e-5


def web(v):
    return [v.x,v.z,-v.y]


def close(a,b):
    return max(abs(x-y) for x,y in zip(a,b))<TOL


def glb(path):
    data=path.read_bytes()
    magic,version,size=struct.unpack_from("<III",data)
    assert magic==0x46546C67 and version==2 and size==len(data)
    length,kind=struct.unpack_from("<II",data,12)
    assert kind==0x4E4F534A
    doc=json.loads(data[20:20+length])
    offset=20+length
    binary=data[offset+8:]
    return doc,binary


def floats(doc,binary,index):
    accessor=doc["accessors"][index]
    assert accessor["componentType"]==5126
    width={"SCALAR":1,"VEC3":3,"VEC4":4}[accessor["type"]]
    view=doc["bufferViews"][accessor["bufferView"]]
    offset=view.get("byteOffset",0)+accessor.get("byteOffset",0)
    stride=view.get("byteStride",width*4)
    return [struct.unpack_from("<"+"f"*width,binary,offset+i*stride)
            for i in range(accessor["count"])]


# Authoring checks are independent of the generated manifest's mesh counters.
bpy.ops.wm.open_mainfile(filepath=str(ROOT/"tools/art_source/launcher_performance.blend"))
scene=bpy.context.scene
scene.frame_set(1)
for layer in bpy.context.view_layer.layer_collection.children:
    layer.exclude=False
bpy.context.view_layer.update()
gear_report={}
for code,drive,output in [("T01",32,32),("T02",36,28),("T03",28,36)]:
    root=bpy.data.objects["Part_"+code]
    groups={o["inspectionGroup"]:o for o in root.children if o.get("inspectionGroup")}
    wheels=[o for group in groups.values() for o in group.children if o.get("teeth")]
    assert sorted(o["teeth"] for o in wheels)==sorted([36,drive,output])
    input_wheels=[o for o in groups["input_rotor"].children if o.get("teeth")]
    output_wheel=next(o for o in groups["output_rotor"].children if o.get("teeth"))
    upper=next(o for o in input_wheels if "compound drive" in o.name)
    # Gear mesh vertices are authored in world coordinates inside each group.
    input_center=groups["input_rotor"].matrix_world.translation
    output_center=groups["output_rotor"].matrix_world.translation
    distance=(input_center-output_center).length
    assert abs(distance-upper["pitchRadius"]-output_wheel["pitchRadius"])<TOL
    input_radius=next(o["pitchRadius"] for o in input_wheels if "common rack pinion" in o.name)
    assert abs(web(input_center)[2]-input_radius-(-.780))<TOL
    lower_wheel=next(o for o in input_wheels if "common rack pinion" in o.name)
    lower_heights=[web(lower_wheel.matrix_world@v.co)[1] for v in lower_wheel.data.vertices]
    assert min(lower_heights)>.045,"Rack pinion intersects the lower bearing height"
    hubs=[o for group in groups.values() for o in group.children
          if o.type=="MESH" and " hub" in o.name]
    for hub in hubs:
        heights=[web(hub.matrix_world@v.co)[1] for v in hub.data.vertices]
        assert max(heights)<.180,"Rotor hub intersects the upper bearing seat"
    # The stepped journal clears both bearing bores; hex is confined below pan.
    journal=next(o for o in groups["output_rotor"].children if o.name.startswith("Output bearing journal"))
    hex_end=next(o for o in groups["output_rotor"].children if o.name.startswith("Hex drive shaft"))
    assert max(math.hypot(v.co.x,v.co.y) for v in journal.data.vertices)<.050
    hex_points=[web(hex_end.matrix_world@v.co) for v in hex_end.data.vertices]
    assert min(p[1] for p in hex_points)>-.290 and max(p[1] for p in hex_points)<-.200
    gear_report[code]=dict(teeth=[36,drive,output],centerDistance=distance,ratio=drive/output)

source_dogs={}
for code in ["C01","C02","C03"]:
    root=bpy.data.objects["Part_"+code]
    rotor=next(o for o in root.children if o.get("inspectionGroup")=="coupler_rotor")
    jaws=[o for o in rotor.children if o.get("inspectionGroup","").startswith("release_jaw_")]
    assert len(jaws)==3 and all(Vector(o["releaseVector"]).length>.09 for o in jaws)
    dogs=[o for jaw in jaws for o in jaw.children if o.name.startswith("Sliding top locking dog")]
    assert len(dogs)==3
    source_dogs[code]=sorted(tuple(round(c,6) for c in web(o.matrix_world.translation)) for o in dogs)
assert source_dogs["C01"]==source_dogs["C02"]==source_dogs["C03"]

records={}
for spec in manifest["parts"]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path=OUT/spec["file"]
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    objects=list(bpy.context.scene.objects)
    roots=[o for o in objects if o.get("partId")]
    assert len(roots)==1
    root=roots[0]
    assert root["partId"]==spec["partId"] and close(web(root.matrix_world.translation),spec["anchor"])
    groups={o.get("inspectionGroup"):o for o in objects if o.get("inspectionGroup")}
    assert set(groups)=={g["id"] for g in spec["inspectionGroups"]}
    for g in spec["inspectionGroups"]:
        obj=groups[g["id"]]
        assert obj.name==g["node"],(obj.name,g["node"])
        assert close(web(obj.location),g["pivot"])
        assert close(obj["detailExplode"],g["explode"])
    meshes=[o for o in objects if o.type=="MESH"]
    triangles=0
    for obj in meshes:
        assert obj.parent in groups.values(),"A movable mesh lost its articulation parent"
        assert obj.get("paintZone")=="fixed"
        assert all(not m.name.startswith("Paint_") for m in obj.data.materials)
        assert all(math.isfinite(c) for v in obj.data.vertices for c in v.co)
        obj.data.calc_loop_triangles()
        triangles+=len(obj.data.loop_triangles)
    assert triangles==spec["runtime"]["triangles"]
    assert len(meshes)==spec["runtime"]["meshes"]
    assert triangles<42000 and len(meshes)<=16
    interfaces={o["interfaceId"]:web(o.matrix_world.translation) for o in objects if o.get("interfaceId")}
    if spec["slot"]=="coupler":
        assert close(interfaces["top-mount-stock"],[0,-.474,-.12])
        assert close(interfaces["hex-drive-v1"],[0,-.25,-.12])
        assert set(groups)=={"stationary_housing","coupler_rotor","release_cam",
                             "release_jaw_0","release_jaw_1","release_jaw_2"}
        assert groups["release_cam"]["releaseVector"][1]>.06
    if spec["slot"]=="rack":
        assert close(interfaces["rack-pin-v1"],[1.95,.055,-.85])
        assert root.get("motionType")=="translation"
    records[spec["code"]]=dict(meshes=len(meshes),triangles=triangles,interfaces=interfaces,
        bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest())

# Exhaustive cross-product of imported attachment data, not a collision claim.
combinations=[]
for rack,transmission,coupler in itertools.product(["R01","R02","R03"],["T01","T02","T03"],["C01","C02","C03"]):
    r,t,c=[records[code]["interfaces"] for code in [rack,transmission,coupler]]
    assert close(t["hex-drive-v1"],c["hex-drive-v1"])
    assert close(r["rack-guide-v1"],[.875,.055,-.85])
    assert close(t["rack-pinion-v1"],manifest["geometry"]["inputAxis"])
    combinations.append([rack,transmission,coupler])

path=OUT/"launcher-performance.glb"
doc,binary=glb(path)
nodes=doc["nodes"]
root_nodes={i:n for i,n in enumerate(nodes) if n.get("extras",{}).get("partId")}
assert len(root_nodes)==8
assert len(doc["animations"])==1
animation=doc["animations"][0]
assert animation["name"]=="Launcher_Explode"
expected={m["id"]:m for m in old["modules"]}
animated_slots=[]
duration=0
for channel in animation["channels"]:
    target=channel["target"]
    if target["node"] not in root_nodes or target["path"]!="translation":
        continue
    node=root_nodes[target["node"]]
    slot=node["extras"]["slotId"]
    sampler=animation["samplers"][channel["sampler"]]
    times=floats(doc,binary,sampler["input"])
    values=floats(doc,binary,sampler["output"])
    anchor=expected[slot]["anchor"]
    delta=expected[slot]["explode"]
    assert close(values[0],anchor),(slot,values[0],anchor)
    assert close(values[-1],[a+d for a,d in zip(anchor,delta)]),(slot,values[-1])
    assert close([times[0][0],times[-1][0]],[0,59/24])
    duration=max(duration,times[-1][0])
    animated_slots.append(slot)
# Exporter may optimize a truly stationary housing track away.
assert set(animated_slots)>={"cover","grip","pull_handle","rack","transmission","coupler","release"}
assert manifest["assembly"]["runtime"]["triangles"]<90000
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(path))
bpy.context.scene.frame_set(0)
bpy.context.view_layer.update()
mount=next(o for o in bpy.context.scene.objects if o.get("interfaceId")=="top-mount-stock")
assert close(web(mount.matrix_world.translation),[0,-.474,-.12])
bpy.context.scene.frame_set(59)
bpy.context.view_layer.update()
assert close(web(mount.matrix_world.translation),[0,-1.474,-.12])
bpy.context.scene.frame_set(0)
bpy.context.view_layer.update()
assert close(web(mount.matrix_world.translation),[0,-.474,-.12]),"Explosion does not return to assembly"

report=dict(status="passed",scope="Source nominal geometry, GLB re-import, common anchors, motion groups and animation",
    notVerified=["mechanical contacts","full rack stroke","elastic deformation","battle effects (separate Web checks)","GPU timing"],
    parts=records,gearGeometry=gear_report,compatibleAnchorCombinations=combinations,
    sharedDogLocations=source_dogs["C01"],
    assembly=dict(**manifest["assembly"]["runtime"],moduleRoots=8,animation=animation["name"],
                  durationSeconds=duration,animatedSlots=animated_slots,topMountRestored=True))
(REVIEW/"validation.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("PERFORMANCE_VALIDATION_OK",json.dumps(report["assembly"]),flush=True)
