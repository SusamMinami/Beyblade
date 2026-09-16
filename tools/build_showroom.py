"""Author both display stages. Blender --background --python tools/build_showroom.py."""
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "resources" / "showroom"
SOURCE = ROOT / "tools" / "art_source"
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)


def xyz(v):
    return (v[0], -v[2], v[1])


def mat(name, color, metal=0, rough=0.4, emit=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Metallic"].default_value = metal
    p.inputs["Roughness"].default_value = rough
    p.inputs["Emission Color"].default_value = (*color, 1)
    p.inputs["Emission Strength"].default_value = emit
    return m


def finish(o, name, material, bevel=0.018):
    o.name = name
    o.data.materials.append(material)
    if bevel:
        m = o.modifiers.new("Machined bevel", "BEVEL")
        m.width = bevel
        m.segments = 3
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=m.name)
    for p in o.data.polygons:
        p.use_smooth = True
    m = o.modifiers.new("Corner normals", "WEIGHTED_NORMAL")
    m.keep_sharp = True
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier=m.name)
    return o


def box(name, p, s, material, bevel=0.018):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(p))
    o = bpy.context.object
    o.dimensions = (s[0], s[2], s[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o, name, material, bevel)


def cyl(name, p, r, h, material, vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=r, depth=h, location=xyz(p))
    return finish(bpy.context.object, name, material, 0.01)


def ring(name, p, outer, inner, h, material, segments=96):
    vertices, faces = [], []
    for y, r in [(-h/2, inner), (-h/2, outer), (h/2, outer), (h/2, inner)]:
        vertices.extend(xyz((p[0] + r * math.cos(i * math.tau/segments), p[1] + y,
                             p[2] + r * math.sin(i * math.tau/segments))) for i in range(segments))
    for layer in range(4):
        for i in range(segments):
            a, b = layer * segments + i, layer * segments + (i+1) % segments
            c, d = ((layer+1) % 4)*segments + (i+1) % segments, ((layer+1) % 4)*segments+i
            faces.append((a, b, c, d))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], [face[::-1] for face in faces])
    mesh.update()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    return finish(o, name, material, min(0.009, h/4))


def rod(name, a, b, r, material):
    va, vb = Vector(xyz(a)), Vector(xyz(b))
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=r, depth=(vb-va).length, location=(va+vb)/2)
    o = bpy.context.object
    o.rotation_euler = (vb-va).to_track_quat("Z", "Y").to_euler()
    return finish(o, name, material, 0)


def engraving(text, p, size, material):
    bpy.ops.object.text_add(location=xyz(p), rotation=(math.pi/2, 0, 0))
    o = bpy.context.object
    o.data.body = text
    o.data.align_x = "CENTER"
    o.data.size = size
    o.data.extrude = 0.0003
    o.data.materials.append(material)
    bpy.ops.object.convert(target="MESH")
    o.name = "Marking_" + text


def badge(material, z=-1.62):
    # Two angular chevrons form the original SPIN/CORE stage emblem.
    for points in [
        [(-.95, 3.3), (.95, 3.3), (.68, 3.02), (-.66, 3.02), (.04, 2.29), (-.24, 2.02), (-1.15, 2.92)],
        [(.92, 2.91), (.50, 2.91), (-.06, 2.34), (.22, 2.06), (.63, 2.48), (.28, 2.48)],
    ]:
        mesh = bpy.data.meshes.new("Chevron")
        mesh.from_pydata([xyz((x*.72, 2.25+(y-2.65)*.72, z)) for x, y in points], [], [tuple(range(len(points)))])
        o = bpy.data.objects.new("SPIN_CORE_emblem", mesh)
        bpy.context.collection.objects.link(o)
        bpy.context.view_layer.objects.active = o
        mod = o.modifiers.new("Emblem thickness", "SOLIDIFY")
        mod.thickness = 0.05
        bpy.ops.object.modifier_apply(modifier=mod.name)
        finish(o, "SPIN_CORE_emblem", material, 0.012)


def build(tier):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.materials):
        bpy.data.materials.remove(m)
    dark = mat("Graphite", (.045, .065, .075), .73, .32)
    black = mat("Black recesses", (.009, .017, .022), .15, .58)
    metal = mat("Titanium", (.22, .30, .34), .84, .26)
    silver = mat("Edges", (.5, .59, .61), .8, .24)
    wall = mat("Background enamel", (.022, .041, .050), .4, .52)
    accent = (.025, .74, .87) if tier == "holo" else (.95, .58, .14)
    light = mat("Accent emission", accent, .2, .26, 3)
    emblem = mat("Crest backlight", accent, .4, .32, .8)
    white = mat("White emission", (.68, .89, 1), .15, .22, 4)
    glass = mat("Panel glass", (.012, .065, .082), .5, .26)

    cyl("Floor", (0, -.55, 0), 5.5, .25, wall, 128)
    ring("Outer stage base", (0, -.28, 0), 2.42, .94, .30, black)
    ring("Outer stage rim", (0, -.10, 0), 2.37, .94, .09, metal)
    ring("Understep light", (0, -.02, 0), 2.26, 2.24, .027, light)
    ring("Stepped deck", (0, .04, 0), 2.10, .94, .14, dark)
    ring("Deck faceted shell", (0, .20, 0), 1.87, .94, .20, dark, 64)
    ring("Brushed deck top", (0, .325, 0), 1.81, .94, .06, metal)
    ring("Inner well rim", (0, .36, 0), 1.02, .94, .018, silver)
    ring("Concentric active ring", (0, .362, 0), 1.66, 1.64, .02, light)
    ring("Outer cut ring", (0, .362, 0), 1.76, 1.75, .014, silver)
    cyl("Black lift shaft", (0, -.50, 0), .937, .85, black)
    for i in range(24):
        angle = math.tau * i / 24
        x, z = 1.77*math.sin(angle), 1.77*math.cos(angle)
        o = box("Rim bracket", (x, .18, z), (.15, .24, .12), metal, .012)
        o.rotation_euler.z = -angle
        cyl("Deck bolt", (x, .366, z), .021, .014, black, 6)
        for r, w in [(1.34, .09), (1.5, .025)]:
            o = box("Deck graduation", (r*math.sin(angle), .363, r*math.cos(angle)),
                    (w, .005, .007), light if i%4 == 0 else silver, 0)
            o.rotation_euler.z = -angle
        if i % 2 == 0:
            o = box("Rim lamp recess", (x, .16, z*1.02), (.14, .075, .04), black, .01)
            o.rotation_euler.z = -angle
            o = box("Rim lamp", (x*1.026, .16, z*1.026), (.06, .04, .025), light, .006)
            o.rotation_euler.z = -angle
        rod("Radial deck seam", (1.89*math.sin(angle), -.025, 1.89*math.cos(angle)),
            (2.18*math.sin(angle), -.025, 2.18*math.cos(angle)), .007, black)
    for x in [-3.2, -2.55, 2.55, 3.2]:
        box("Wall support", (x, 2.25, -2.3), (.24, 5.7, .36), dark, .045)
        box("Recessed wall lamp", (x, 2.9, -2.10), (.035, 2.8, .027), white, .003)
    box("Back wall", (0, 2.45, -2.7), (9, 6.3, .22), wall, .07)
    for x in [-3, -2, -1, 0, 1, 2, 3]:
        box("Wall panel", (x*1.13, 2.5, -2.56), (1.10, 5.9, .09), wall, .045)
    engraving("SPIN / CORE", (0, 1.62, -1.62), .10, emblem)
    if tier == "holo":
        box("Hologram screen backing", (0, 2.40, -1.9), (2.35, 2.25, .16), glass, .08)
        # Vertical halo gives the crest its containment frame.
        o = ring("Crest halo", (0, 2.40, -1.77), .91, .90, .018, emblem)
        # Ring was authored in world XZ; turn it into the XY plane.
        center = Vector(xyz((0, 2.40, -1.77)))
        for v in o.data.vertices:
            p = v.co - center
            v.co = center + Vector((p.x, -p.z, p.y))
        badge(emblem)
        for height in [.40, 3.15]:
            ring("Containment housing", (0, height, 0), 1.48, 1.41, .065, metal)
            ring("Containment light", (0, height-.018, 0), 1.455, 1.435, .015, light)
        for x in [-1.8, 1.8]:
            box("Service pedestal", (x, .75, -1.25), (.32, 1.7, .42), dark, .035)
            for j in range(7):
                box("Data slot", (x, .25+j*.19, -1.025), (.18, .025, .012), light, .002)
    else:
        box("Back crest frame", (0, 2.4, -1.93), (2.8, 2.35, .14), metal, .045)
        box("Back LED wall", (0, 2.4, -1.835), (2.60, 2.15, .055), black, .03)
        badge(emblem)
        for side in [-1, 1]:
            x = side*1.75
            for z in [-1.58, -1.88]:
                for dx in [-.14, .14]:
                    rod("Truss chord", (x+dx, -.1, z), (x+dx, 4.65, z), .026, metal)
            for j in range(12):
                y = j*.38
                rod("Truss cross brace", (x-.14, y, -1.56), (x+.14, y+.38, -1.56), .018, metal)
                box("Golden rig lamp", (x, y+.15, -1.52), (.08, .09, .035), light, .007)
            for z in [-1.58, -1.88]:
                rod("Ceiling gantry", (-1.9, 4.65, z), (1.9, 4.65, z), .032, metal)
            box("Speaker cabinet", (side*2.05, .60, -.9), (.45, 1.15, .45), black, .05)
            for y in [.34, .83]:
                driver = cyl("Speaker driver", (side*2.05, y, -.658), .16, .03, metal, 32)
                driver.rotation_euler.x = math.pi/2
            # Interlocking links are authored geometry, not a flat chain texture.
            for j in range(23):
                o = ring("Hanging chain link", (side*2.42, .15+j*.18, -1.6), .085, .060, .026, metal, 12)
                center = Vector(xyz((side*2.42, .15+j*.18, -1.6)))
                for v in o.data.vertices:
                    p = v.co-center
                    v.co = center + Vector((p.x, -p.z, p.y*1.4))
                if j%2:
                    # Link cross-orientation around its local center.
                    for v in o.data.vertices:
                        p = v.co-center
                        v.co = center+Vector((p.y, -p.x, p.z))
        for x in [-1.3, -.65, 0, .65, 1.3]:
            box("Overhead fixture", (x, 4.46, -1.50), (.34, .16, .29), dark, .025)
            box("Overhead lens", (x, 4.365, -1.46), (.25, .018, .20), white, .01)
        for x in [-2.0, 2.0]:
            box("Floor uplight", (x, -.32, 1.15), (.23, .23, .32), dark, .025)
            box("Floor uplight lens", (x, -.18, 1.15), (.17, .02, .25), white, .01)

    # Keep all editable parts in the .blend; merge only the runtime export.
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / f"showroom_{tier}.blend"))
    bpy.ops.object.select_all(action="DESELECT")
    for material in list(bpy.data.materials):
        objects = [o for o in bpy.context.scene.objects if o.type == "MESH"
                   and o.data.materials and o.data.materials[0] == material]
        if not objects:
            continue
        for o in objects:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        objects[0].name = material.name.replace(" ", "_")
        bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.export_scene.gltf(filepath=str(OUT / f"{tier}.glb"), export_format="GLB", export_yup=True)
    print("SHOWROOM_READY", tier, len(bpy.context.scene.objects))


if __name__ == "__main__":
    build("holo")
    build("arena")
