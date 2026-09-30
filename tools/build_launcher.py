"""Reference-directed SPIN/CORE launcher, in the Web prototype's visual units.

Blender --background --python tools/build_launcher.py [-- --render]
The .blend keeps named parts, collections, bevels and a product-lighting rig.
Only the GLB is evaluated and batched by material. No reference image is shipped.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tools/art_source/launcher.blend"
OUTPUT = ROOT / "resources/launcher/launcher.glb"
REVIEW = ROOT / ".impeccable/review/launcher"


def xyz(p):
    return (p[0], -p[2], p[1])


def material(name, color, roughness, metalness=0, coat=0, alpha=1):
    # Input swatches are sRGB; glTF and Blender BSDFs take linear color.
    rgb = tuple(((c / 255 + .055) / 1.055) ** 2.4 if c > 10 else c / 3294.6 for c in color)
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, alpha)
    m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    for key, value in {"Base Color": (*rgb, 1), "Roughness": roughness,
                       "Metallic": metalness, "Coat Weight": coat,
                       "Coat Roughness": .19, "Alpha": alpha}.items():
        p.inputs[key].default_value = value
    if alpha < 1:
        m.surface_render_method = "DITHERED"
        m.use_transparency_overlap = False
    return m


def collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def finish(obj, name, mat, bevel=.012):
    obj.name = name
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    PARTS.objects.link(obj)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Moulded edge radius", "BEVEL")
        mod.width = bevel
        mod.segments = 1 if bevel <= .008 else 2
    for face in obj.data.polygons:
        face.use_smooth = True
    normals = obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    normals.keep_sharp = True
    return obj


def mesh(name, vertices, faces, mat, bevel=.012):
    data = bpy.data.meshes.new(name)
    data.from_pydata([xyz(p) for p in vertices], [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    finish(obj, name, mat, bevel)
    # Consistent outward winding for authored contours and annular gear profiles.
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(data)
    bm.free()
    return obj


def slab(name, outline, y, depth, mat, bevel=.012):
    n = len(outline)
    vertices = [(x, h, z) for h in [y - depth/2, y + depth/2] for x, z in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
    faces += [(i, (i+1) % n, (i+1) % n+n, i+n) for i in range(n)]
    return mesh(name, vertices, faces, mat, bevel)


def frame(name, outer, inner, y, depth, mat, bevel=.012):
    n = len(outer)
    assert n == len(inner)
    vertices = [(x, h, z) for h in [y-depth/2, y+depth/2] for loop in [outer, inner] for x, z in loop]
    faces = []
    for i in range(n):
        j = (i+1) % n
        faces.extend([(i, j, j+n, i+n), (i+2*n, i+3*n, j+3*n, j+2*n),
                      (i, i+2*n, j+2*n, j), (i+n, j+n, j+3*n, i+3*n)])
    return mesh(name, vertices, faces, mat, bevel)


def box(name, p, size, mat, bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(p))
    obj = bpy.context.object
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bevel)


def cylinder(name, p, radius, height, mat, sides=32, bevel=.007):
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=height, location=xyz(p))
    return finish(bpy.context.object, name, mat, bevel)


def ring(name, p, outer, inner, height, mat, sides=48, bevel=.006):
    loops = [[(p[0]+r*math.cos(i*math.tau/sides), p[2]+r*math.sin(i*math.tau/sides))
              for i in range(sides)] for r in [outer, inner]]
    return frame(name, *loops, p[1], height, mat, bevel)


def gear(name, p, radius, teeth, mat):
    # Constant module across the three wheels; real teeth and a hollow hub.
    outer, inner = [], []
    for i in range(teeth * 4):
        a = i * math.tau/(teeth*4)
        r = radius + (.027 if i % 4 in [1, 2] else -.026)
        outer.append((p[0]+math.cos(a)*r, p[2]+math.sin(a)*r))
        inner.append((p[0]+math.cos(a)*.066, p[2]+math.sin(a)*.066))
    frame(name, outer, inner, p[1], .070, mat, .0025)
    ring(name+" recessed face", (p[0], p[1]+.039, p[2]), radius*.65, .085, .008, graphite, 36, .002)
    ring(name+" hub", (p[0], p[1]+.055, p[2]), .116, .055, .052, steel, 24, .003)
    cylinder(name+" axle", (p[0], p[1]+.063, p[2]), .044, .13, steel, 20)
    for i in range(6):
        a = i*math.tau/6
        cylinder(name+" face dimple", (p[0]+math.cos(a)*radius*.77, p[1]+.038,
                                       p[2]+math.sin(a)*radius*.77), .026, .003, graphite, 12, 0)


def screw(x, z, y=.306):
    cylinder("Recessed fastener well", (x, y-.008, z), .052, .018, graphite, 24, .003)
    cylinder("Stainless captive screw", (x, y+.002, z), .034, .019, steel, 24, .003)
    box("Screw slot", (x, y+.012, z), (.041, .002, .009), graphite, .001)


def marking(text, p, size, mat):
    bpy.ops.object.text_add(location=xyz(p))
    obj = bpy.context.object
    obj.data.body = text
    obj.data.align_x = "CENTER"
    obj.data.size = size
    obj.data.extrude = .0003
    bpy.ops.object.convert(target="MESH")
    return finish(obj, "Mould marking "+text, mat, 0)


def build():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    global PARTS, graphite, steel
    PARTS = collection("01 / Split moulded housing")
    ivory = material("Launcher_Ivory_ABS", (224, 230, 225), .32, coat=.3)
    blue = material("Launcher_Cobalt_ABS", (35, 65, 112), .29, coat=.4)
    graphite = material("Launcher_Graphite_POM", (30, 38, 43), .48)
    rubber = material("Launcher_Grip_TPE", (24, 38, 55), .83)
    steel = material("Launcher_Brushed_Steel", (155, 178, 186), .3, .84)
    amber = material("Launcher_Amber_Lock", (244, 158, 46), .34, coat=.25)
    glass = material("Launcher_Smoked_PC", (69, 94, 113), .13, coat=.22, alpha=.14)
    # A true open frame, so transmission reveals the mechanism, not a solid box.
    outer = [(-.62,-1.02),(.62,-1.02),(.84,-.79),(.84,.49),
             (.57,.77),(-.57,.77),(-.84,.49),(-.84,-.79)]
    inner = [(-.50,-.82),(.50,-.82),(.65,-.67),(.65,.37),
             (.46,.56),(-.46,.56),(-.65,.37),(-.65,-.67)]
    slab("Lower gearbox pan", outer, -.16, .19, graphite, .04)
    frame("Continuous dark parting seam", outer, inner, -.052, .032, graphite, .006)
    frame("Ivory upper shell", outer, inner, .086, .237, ivory, .035)
    # Cobalt protective nose and separate shoulder plates give the shell a hierarchy.
    slab("Cobalt nose armour", [(-.62,-1.044),(.62,-1.044),(.79,-.86),(.66,-.78),
                               (-.66,-.78),(-.79,-.86)], .075, .25, blue, .025)
    for side in [-1, 1]:
        slab("Shoulder bumper", [(side*.69,.12),(side*.88,.16),(side*.88,.51),
                                (side*.59,.79),(side*.48,.61)], .063, .24, blue, .023)
        for z in [-.57, -.30, -.03]:
            box("Moulded side rib", (side*.848, .012, z), (.035,.19,.05), graphite, .008)
        box("Lid side keeper", (side*.717,.228,-.22), (.068,.07,.49), blue, .01)
    slab("Tapered grip chassis", [(-.54,.53),(.54,.53),(.46,.95),(.42,1.85),
                                 (.28,2.04),(-.28,2.04),(-.42,1.85),(-.46,.95)],
         -.086, .27, graphite, .04)
    for side in [-1, 1]:
        slab("Ivory grip rail", [(side*.51,.63),(side*.40,.83),(side*.33,1.85),
                                (side*.27,1.99),(side*.41,1.88),(side*.47,.99)],
             .024, .21, ivory, .023)
    slab("Rubber palm insert", [(-.32,.84),(.32,.84),(.30,1.76),(.23,1.88),
                                (-.23,1.88),(-.30,1.76)], .065, .14, rubber, .028)
    for i in range(6):
        z = .96+i*.135
        for side in [-1, 1]:
            rib = box("Chevron grip tread", (side*.148,.145,z), (.225,.026,.043), blue, .009)
            rib.rotation_euler.z = side*.39
        for side in [-1, 1]:
            box("Finger edge tread", (side*.441,-.055,z), (.027,.14,.036), rubber, .006)
    box("Heel bumper", (0,-.065,1.98), (.65,.28,.18), blue, .03)
    box("Heel inset", (0,.083,1.97), (.27,.018,.092), graphite, .01)
    slab("Ivory neck bridge", [(-.52,.54),(.52,.54),(.31,.91),(-.31,.91)],
         .19, .075, ivory, .018)
    marking("SPIN / CORE", (0,.239,.886), .075, blue)
    # Amber remains a small functional cue, aligned with the game's launch arrow.
    box("Recessed lock surround", (.86,.02,.39), (.12,.25,.27), graphite, .014)
    box("Amber release slider", (.931,.038,.39), (.055,.15,.19), amber, .012)
    for z in [.34,.39,.44]:
        box("Release slider ridges", (.963,.043,z), (.016,.12,.011), blue, .002)

    PARTS = collection("02 / Visible transmission")
    slab("Inner mechanical tray", inner, -.031, .035, graphite, .01)
    gear("Output crown / 24 teeth", (0,.054,-.12), .365, 24, blue)
    gear("Transfer pinion / 12 teeth", (.345,.074,-.545), .183, 12, steel)
    gear("Return pinion / 10 teeth", (-.403,.047,.205), .153, 10, steel)
    box("Internal rack rail", (.23,.055,-.85), (1.28,.09,.105), graphite, .007)
    for i in range(27):
        x = -.38+i*.046
        slab("Internal rack tooth", [(x-.017,-.81),(x+.016,-.81),(x+.011,-.753),
                                     (x-.011,-.753)], .053, .078, graphite, .003)
    for x,z in [(-.5,-.61),(.47,.32)]:
        cylinder("Lid support boss", (x,.069,z), .078, .20, graphite, 24)
        screw(x,z,.185)
    # Spiral spring: one narrow flat metal ribbon, tucked behind the output gear.
    verts, faces = [], []
    for i in range(181):
        a = i/180 * math.tau*2.5
        r = .05+i/180*.09
        for offset in [-.007,.007]:
            verts.append((-.403+math.cos(a)*(r+offset),.102,.205+math.sin(a)*(r+offset)))
        if i:
            faces.append((2*i-2,2*i-1,2*i+1,2*i))
    mesh("Exposed spiral return spring", verts, faces, steel, 0)

    PARTS = collection("03 / Clear inspection cover")
    frame("Raised lid gasket", outer, inner, .220, .032, blue, .01)
    # Thin alpha cover: no screen-space transmission render target in the game.
    slab("Smoke polycarbonate inspection lid", inner, .259, .026, glass, .012)
    for side in [-1, 1]:
        box("Clear lid stiffening rib", (side*.59,.286,-.16), (.017,.034,1.14), glass, .007)
    for x,z in [(-.61,-.84),(.61,-.84),(-.63,.43),(.63,.43)]:
        screw(x,z,.251)
    marking("GEAR DRIVE  /  01", (0,.247,-.927), .066, ivory)
    for x in [-.22,-.11,0,.11,.22]:
        box("Direction datum", (x,.246,-.867), (.05,.008,.014), ivory, .001)

    PARTS = collection("04 / Pull rack and T handle")
    # The rack engages the crown's front edge; its teeth are separate authored geometry.
    box("Rack guide entrance", (.87,.045,-.53), (.14,.18,.29), graphite, .017)
    box("Rack guide trim", (.956,.051,-.53), (.035,.145,.24), steel, .007)
    box("Reinforced toothed rack", (1.38,.055,-.55), (1.14,.09,.105), graphite, .009)
    box("Rack centre bead", (1.36,.109,-.57), (1.09,.017,.02), blue, .002)
    for i in range(21):
        x = .94+i*.046
        slab("Rack drive tooth", [(x-.017,-.51),(x+.016,-.51),(x+.011,-.453),
                                 (x-.011,-.453)], .053, .078, graphite, .003)
    box("Pull handle collar", (1.986,.055,-.55), (.21,.21,.27), blue, .029)
    # The crossbar flares at its ends rather than looking like a cylinder.
    slab("T pull handle shell", [(1.94,-1.15),(2.14,-1.15),(2.19,-1.05),
                                (2.12,-.89),(2.12,-.22),(2.19,-.055),(2.14,.055),
                                (1.94,.055),(1.89,-.055),(1.96,-.24),
                                (1.96,-.89),(1.89,-1.05)], .062, .21, blue, .024)
    box("T handle central thumb pad", (2.04,.183,-.55), (.19,.04,.30), rubber, .014)
    for z in [-.94,-.84,-.27,-.17]:
        box("T handle grip pad", (2.04,.177,z), (.12,.025,.067), rubber, .012)
    for z in [-1.115,.02]:
        box("T handle ivory end cap", (2.04,.068,z), (.22,.17,.062), ivory, .014)
    for obj in PARTS.objects:
        obj.location.y += .30  # Three -Z: rack runs tangent to the transfer pinion.

    PARTS = collection("05 / Bayonet top coupling")
    ring("Underside drive housing", (0,-.246,-.12), .47,.22,.16, graphite)
    ring("Coupling machined shoulder", (0,-.325,-.12), .433,.26,.055, steel)
    ring("Bayonet socket", (0,-.394,-.12), .382,.265,.10, graphite)
    for i in range(3):
        a = i*math.tau/3
        x,z = math.cos(a)*.30, -.12+math.sin(a)*.30
        tab = box("Locking dog", (x,-.452,z), (.15,.045,.095), blue, .008)
        tab.rotation_euler.z = -a
    for i in range(12):
        a = i*math.tau/12
        x,z = math.cos(a)*.468, -.12+math.sin(a)*.468
        rib = box("Coupling radial grip", (x,-.233,z), (.028,.081,.052), graphite, .005)
        rib.rotation_euler.z = -a
    socket = bpy.data.objects.new("TopMount", None)
    socket.location = xyz((0,-.474,-.12))
    PARTS.objects.link(socket)
    socket["purpose"] = "Attach to actual top crown; render units, not physical millimetres"


def studio():
    global PARTS
    PARTS = collection("90 / Studio (not exported)")
    floor = material("Studio ground", (39,49,61), .76)
    box("Studio ground", (0,-.64,0), (200,.1,200), floor, 0)
    scene = bpy.context.scene
    scene.world.color = (.15,.15,.15)
    def light(name, p, power, size, color):
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.shape, data.size, data.color = power, "DISK", size, color
        o = bpy.data.objects.new(name, data)
        PARTS.objects.link(o)
        o.location = xyz(p)
        o.rotation_euler = (Vector(xyz((.2,0,.2)))-o.location).to_track_quat("-Z","Y").to_euler()
    light("Large warm key", (-3,6,2), 620, 5, (1,.91,.82))
    light("Cool soft edge", (4,4,-3), 780, 3, (.70,.83,1))
    light("Front fill", (1,3,5), 220, 4, (.82,.91,1))
    camera = bpy.data.cameras.new("Product camera")
    obj = bpy.data.objects.new("Product camera", camera)
    PARTS.objects.link(obj)
    obj.location = xyz((4.7,6.5,7.5))
    target = Vector(xyz((.45,0,.35)))
    obj.rotation_euler = (target-obj.location).to_track_quat("-Z","Y").to_euler()
    camera.type, camera.ortho_scale = "ORTHO", 5.5
    scene.camera = obj
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 40
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1400, 1100
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "AgX"
    # A useful opening view when the user opens the editable source.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.region_3d.view_distance = 6
                area.spaces.active.region_3d.view_location = target
                area.spaces.active.region_3d.view_rotation = obj.rotation_euler.to_quaternion()


def export():
    for path in [SOURCE.parent, OUTPUT.parent, REVIEW]:
        path.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
    objects = [o for c in bpy.data.collections if c.name[:2] in ["01","02","03","04","05"]
               for o in c.objects]
    authored = len([o for o in objects if o.type == "MESH"])
    bpy.ops.object.select_all(action="DESELECT")
    # Apply modifiers to export copies only; keep the source fully editable.
    runtime = collection("99 / Runtime export")
    copies = []
    deps = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        if obj.type == "MESH":
            data = bpy.data.meshes.new_from_object(obj.evaluated_get(deps))
            copy = bpy.data.objects.new(obj.name, data)
            copy.matrix_world = obj.matrix_world.copy()
        else:
            copy = obj.copy()
        runtime.objects.link(copy)
        copies.append(copy)
    meshes = []
    for mat in list(bpy.data.materials):
        batch = [o for o in runtime.objects if o.type == "MESH" and o.data.materials[0] == mat]
        if not batch:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for o in batch:
            o.select_set(True)
        bpy.context.view_layer.objects.active = batch[0]
        if len(batch) > 1:
            bpy.ops.object.join()
        batch[0].name = mat.name
        meshes.append(batch[0])
    bpy.ops.object.select_all(action="DESELECT")
    for o in runtime.objects:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format="GLB", use_selection=True,
                             export_yup=True, export_extras=True, export_animations=False,
                             export_cameras=False, export_lights=False)
    triangles = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    manifest = {"asset": "SPIN / CORE Gear Drive 01", "authoredParts": authored,
                "runtimeMeshes": len(meshes), "triangles": triangles, "bytes": OUTPUT.stat().st_size,
                "topMount": [0,-.474,-.12], "units": "Web visual units",
                "materials": [o.data.materials[0].name for o in meshes]}
    (OUTPUT.parent/"launcher.json").write_text(json.dumps(manifest, indent=2)+"\n", encoding="utf-8")
    # Remove temporary runtime copies before rendering the authored version.
    for o in list(runtime.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(runtime)
    print("LAUNCHER_READY", json.dumps(manifest), flush=True)


if __name__ == "__main__":
    build()
    studio()
    export()
    if "--render" in sys.argv:
        bpy.context.scene.render.filepath = str(REVIEW/"blender-product.png")
        bpy.ops.render.render(write_still=True)
