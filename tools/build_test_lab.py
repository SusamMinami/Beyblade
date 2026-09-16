"""Build the authored test-lab set. Run with Blender --background --python."""

import math
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "resources" / "test_lab"
OUTPUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, color, metal=0.0, rough=0.4, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Emission Color"].default_value = (*color, 1)
    bsdf.inputs["Emission Strength"].default_value = emission
    return mat


SHELL = material("Ceramic silver", (0.38, 0.42, 0.43), 0.48, 0.32)
WHITE = material("Pearl enamel", (0.62, 0.65, 0.64), 0.2, 0.29)
METAL = material("Machined aluminium", (0.46, 0.54, 0.56), 0.82, 0.23)
DARK = material("Graphite chassis", (0.045, 0.063, 0.067), 0.58, 0.33)
RUBBER = material("Recesses and seals", (0.019, 0.028, 0.032), 0.08, 0.61)
SCREEN = material("Instrument glass", (0.012, 0.050, 0.057), 0.16, 0.27)
CYAN = material("Cyan instrument light", (0.035, 0.72, 0.60), 0.25, 0.26, 0.7)
DIM = material("Screen markings", (0.025, 0.28, 0.29), 0.0, 0.6, 0.8)
YELLOW = material("Safety chartreuse", (0.70, 0.86, 0.035), 0.12, 0.35, 0.3)
WALL = material("Cool wall panels", (0.40, 0.47, 0.49), 0.15, 0.7)


def xyz(v):
    return (v[0], -v[2], v[1])


def finish(obj, name, mat, bevel=0):
    obj.name = name
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Manufactured edge radius", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if obj.type == "MESH":
        for poly in obj.data.polygons:
            poly.use_smooth = True
        normal = obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
        normal.keep_sharp = True
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=normal.name)
    return obj


def box(name, pos, size, mat, bevel=0.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(pos))
    obj = bpy.context.object
    obj.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bevel)


def cylinder(name, pos, radius, depth, mat, vertices=64, bevel=0.01):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=xyz(pos)
    )
    return finish(bpy.context.object, name, mat, bevel)


def torus(name, pos, radius, tube, mat):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=radius, minor_radius=tube, major_segments=96,
        minor_segments=8, location=xyz(pos)
    )
    return finish(bpy.context.object, name, mat)


def line(name, points, thickness, mat):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = thickness
    curve.bevel_resolution = 2
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (*xyz(co), 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    curve.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return obj


def front_text(text, pos, size, mat):
    bpy.ops.object.text_add(location=xyz(pos))
    obj = bpy.context.object
    obj.name = "Engraving " + text
    obj.data.body = text
    obj.data.align_x = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.0003
    obj.rotation_euler = (math.pi / 2, 0, 0)
    obj.data.materials.append(mat)
    bpy.ops.object.convert(target="MESH")
    return obj


def bolt(pos, radius=0.032):
    cylinder("Counterbore", pos, radius * 1.45, 0.009, RUBBER, 20, 0)
    cylinder("Hex fastener", (pos[0], pos[1] + 0.008, pos[2]), radius, 0.018, METAL, 6, 0.003)
    box("Bolt drive slot", (pos[0], pos[1] + 0.019, pos[2]),
        (radius, 0.003, 0.008), RUBBER, 0)


# A real room behind the instrument, with recessed panel joints and service rails.
box("Rear wall", (0, 2.5, -3.1), (12, 6.8, 0.22), WALL)
for x in range(-5, 6):
    box("Wall inset", (x * 1.08, 2.8, -2.94), (1.045, 4.6, 0.13), SHELL, 0.075)
    box("Wall lower reveal", (x * 1.08, 0.12, -2.94), (1.04, 0.56, 0.14), WALL)
box("Utility rail", (0, 0.94, -2.79), (12, 0.14, 0.14), DARK)
box("Recessed linear illumination", (0, 0.96, -2.705), (12, 0.035, 0.028), CYAN, 0.003)
for x in [-3.3, 3.4]:
    box("Rear equipment cabinet", (x, 0.0, -2.0), (1.65, 1.65, 0.8), WHITE, 0.08)
    for y in [-0.42, 0.02, 0.46]:
        box("Equipment drawer", (x, y, -1.57), (1.49, 0.38, 0.035), SHELL, 0.02)
        box("Recessed drawer pull", (x, y + 0.09, -1.54), (0.5, 0.035, 0.025), DARK, 0.005)
    box("Cabinet worktop", (x, 0.88, -1.96), (1.85, 0.09, 1.0), METAL)
for i in range(9):
    box("Background ventilation", (2.52, 1.6 + i * 0.085, -2.76),
        (0.7, 0.03, 0.07), DARK, 0.005)
for x in [-2.5, -2.2]:
    line("Service conduit", [(x, -0.6, -2.7), (x, 1.95, -2.7),
         (x + 0.12, 2.07, -2.7), (x + 0.5, 2.07, -2.7)], 0.027, METAL)

# Continuous workbench, layered measuring pedestal, and radial fasteners.
cylinder("Workbench edge", (0, -0.38, 0), 3.85, 0.27, DARK, 128, 0.055)
cylinder("Continuous worktop", (0, -0.235, 0), 3.86, 0.12, SHELL, 128, 0.025)
torus("Worktop inlay", (0, -0.17, 0), 2.76, 0.009, DARK)
for angle in [0.5, 2.1, 3.4, 5.2]:
    line("Worktop panel joint", [
        (2.8 * math.cos(angle), -0.167, 2.8 * math.sin(angle)),
        (3.8 * math.cos(angle), -0.167, 3.8 * math.sin(angle))], 0.006, DARK)
cylinder("Isolation foot", (0, -0.11, 0), 1.38, 0.12, RUBBER)
cylinder("Scale bottom housing", (0, 0.045, 0), 1.38, 0.25, SHELL, 96, 0.065)
cylinder("Scale shoulder", (0, 0.195, 0), 1.25, 0.09, WHITE, 96, 0.025)
cylinder("Floating graphite platen", (0, 0.28, 0), 1.13, 0.11, DARK, 96, 0.025)
torus("Primary cyan ring", (0, 0.338, 0), 1.045, 0.026, CYAN)
cylinder("Brushed measurement plate", (0, 0.339, 0), 0.98, 0.035, METAL, 96)
cylinder("Central dark insert", (0, 0.363, 0), 0.72, 0.018, DARK, 96, 0.004)
for radius in [0.53, 0.67, 0.9]:
    torus("Platen concentric etching", (0, 0.379, 0), radius, 0.005, DIM)
for i in range(48):
    angle = math.tau * i / 48
    radius = 0.925
    tick = box("Scale graduation", (radius * math.cos(angle), 0.36,
               radius * math.sin(angle)), (0.028 if i % 4 else 0.064, 0.003, 0.008), WHITE, 0)
    tick.rotation_euler.z = -angle
for i in range(8):
    angle = math.tau * (i + 0.5) / 8
    x, z = 1.27 * math.cos(angle), 1.27 * math.sin(angle)
    bolt((x, 0.174, z))
for x in [-0.88, 0.88]:
    box("Scale forward bumper", (x, 0.055, 0.99), (0.24, 0.31, 0.23), METAL, 0.035)
    box("Scale status lamp", (x * 0.74, 0.075, 1.2), (0.19, 0.032, 0.035), YELLOW, 0.005)
front_text("MASS / INERTIA", (0, 0.00, 1.379), 0.08, DARK)

# The cantilevered metrology head is deliberately clear of the specimen.
box("Gantry base", (1.56, -0.02, -0.33), (0.63, 0.30, 0.65), DARK, 0.045)
box("Gantry base cap", (1.56, 0.145, -0.33), (0.58, 0.06, 0.60), METAL)
for x in [1.35, 1.77]:
    for z in [-0.54, -0.12]:
        bolt((x, 0.18, z))
box("Gantry vertical column", (1.58, 1.45, -0.46), (0.28, 2.6, 0.32), DARK, 0.045)
box("Gantry front insert", (1.58, 1.36, -0.287), (0.12, 2.05, 0.018), RUBBER, 0.02)
box("Gantry front light", (1.58, 1.36, -0.267), (0.040, 1.87, 0.02), CYAN, 0.012)
cylinder("Linear guide", (1.35, 1.50, -0.34), 0.035, 2.55, METAL, 32)
box("Vertical carriage", (1.45, 2.41, -0.38), (0.47, 0.42, 0.46), SHELL, 0.04)
box("Cantilever beam", (0.74, 2.26, -0.37), (1.55, 0.19, 0.24), DARK, 0.035)
cylinder("Probe motor body", (0, 2.24, -0.32), 0.21, 0.28, DARK)
cylinder("Probe lower collar", (0, 2.055, -0.32), 0.13, 0.11, METAL)
cylinder("Probe needle", (0, 1.90, -0.32), 0.011, 0.22, METAL, 24, 0)
box("Optical height sensor", (1.12, 1.42, -0.27), (0.42, 0.49, 0.39), WHITE, 0.035)
box("Sensor dark lens", (0.899, 1.40, -0.24), (0.016, 0.19, 0.21), SCREEN, 0.015)
front_text("HEIGHT", (1.12, 1.48, -0.064), 0.059, DARK)
front_text("SENSOR", (1.12, 1.37, -0.064), 0.046, DARK)

# Main monitor: its glass is supplied by a live Godot SubViewport.
box("Display rear support", (0.05, 2.46, -0.95), (0.14, 1.45, 0.15), DARK)
box("Main display outer shell", (0, 3.06, -0.78), (2.72, 1.53, 0.20), DARK, 0.085)
box("Main display metal bezel", (0, 3.06, -0.666), (2.61, 1.42, 0.035), METAL, 0.065)
box("Main display inner gasket", (0, 3.06, -0.641), (2.52, 1.34, 0.028), RUBBER, 0.045)
for x in [-1.17, 1.17]:
    box("Monitor corner top light", (x, 3.695, -0.618), (0.16, 0.021, 0.012), CYAN, 0.004)
    box("Monitor corner bottom light", (x, 2.425, -0.618), (0.16, 0.021, 0.012), CYAN, 0.004)
for x in [-1.28, 1.28]:
    for y in [2.42, 3.7]:
        cylinder_obj = cylinder("Display fastener", (x, y, -0.64), 0.018, 0.012, DARK, 8)
        cylinder_obj.rotation_euler.x = math.pi / 2

# Side instruments use engraved graphs, not invented measurement readouts.
for y in [0.26, 1.16]:
    box("Auxiliary instrument case", (-1.53, y + 0.35, -0.11), (0.75, 0.84, 0.46), SHELL, 0.05)
    box("Auxiliary instrument bezel", (-1.53, y + 0.35, 0.13), (0.66, 0.74, 0.032), DARK, 0.035)
    box("Auxiliary instrument glass", (-1.53, y + 0.35, 0.151), (0.57, 0.65, 0.018), SCREEN, 0.018)
    for x in [-1.8, -1.26]:
        box("Auxiliary corner light", (x, y + 0.61, 0.165), (0.014, 0.10, 0.01), CYAN, 0)
for radius in [0.065, 0.13, 0.2, 0.245]:
    line("Axial target", [(-1.53 + radius * math.cos(i * math.tau / 64),
         1.49 + radius * math.sin(i * math.tau / 64), 0.168) for i in range(65)], 0.002, DIM)
for i in range(8):
    a = i * math.pi / 4
    line("Axial reticle", [(-1.53, 1.49, 0.17),
         (-1.53 + 0.245 * math.cos(a), 1.49 + 0.245 * math.sin(a), 0.17)], 0.0017, DIM)
front_text("AXIAL ALIGNMENT", (-1.53, 1.76, 0.17), 0.04, CYAN)
for y in [0.40, 0.5, 0.6, 0.7]:
    line("Waveform grid", [(-1.77, y, 0.17), (-1.29, y, 0.17)], 0.0015, DIM)
line("Reference waveform", [(-1.77 + i * 0.48 / 80,
     0.55 + 0.075 * math.sin(i * 0.22) + 0.034 * math.cos(i * 0.5), 0.172)
     for i in range(81)], 0.004, CYAN)
front_text("REFERENCE SIGNAL", (-1.53, 0.86, 0.17), 0.035, CYAN)
box("Instrument stand", (-1.53, -0.12, -0.13), (0.83, 0.1, 0.6), DARK)

# Foreground calibration tools and cabling give the bench a working scale.
box("Calibration block seal", (-1.57, -0.04, 1.17), (0.58, 0.25, 0.46), DARK, 0.04)
box("Calibration block shell", (-1.57, 0.065, 1.17), (0.55, 0.26, 0.43), WHITE, 0.025)
box("Calibration block lid", (-1.57, 0.215, 1.17), (0.58, 0.055, 0.46), METAL)
for x, radius in [(-1.72, 0.075), (-1.52, 0.055), (-1.36, 0.036)]:
    cylinder("Calibration weight", (x, 0.29, 1.17), radius, 0.12, METAL, 32)
    cylinder("Weight grip", (x, 0.367, 1.17), radius * 0.47, 0.05, DARK, 32)
front_text("CALIBRATION", (-1.57, 0.04, 1.39), 0.047, DARK)
cylinder("Spirit level base", (1.52, -0.025, 1.16), 0.26, 0.25, DARK, 48, 0.025)
cylinder("Spirit level bezel", (1.52, 0.115, 1.16), 0.24, 0.045, METAL, 48)
cylinder("Spirit level face", (1.52, 0.142, 1.16), 0.185, 0.01, YELLOW, 48, 0)
torus("Level target", (1.52, 0.15, 1.16), 0.10, 0.006, DARK)
cylinder("Level bubble", (1.53, 0.155, 1.15), 0.035, 0.004, WHITE, 24, 0)
line("Sensor cable", [(1.6, 0.25, -0.7), (1.88, -0.08, -0.85),
     (2.12, -0.14, -0.55), (2.23, -0.14, 0.35), (2.00, -0.14, 0.8),
     (1.7, -0.14, 0.92)], 0.022, RUBBER)

# Merge static geometry by material to keep the mobile draw-call cost bounded.
bpy.ops.object.select_all(action="DESELECT")
for mat in list(bpy.data.materials):
    meshes = [obj for obj in bpy.context.scene.objects
              if obj.type == "MESH" and obj.data.materials
              and obj.data.materials[0] == mat]
    if not meshes:
        continue
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    meshes[0].name = mat.name.replace(" ", "_")
    bpy.ops.object.select_all(action="DESELECT")

# Vertex AO keeps enclosure joins legible without screen-space effects or textures.
world_vertices, world_faces = [], []
for obj in bpy.context.scene.objects:
    start = len(world_vertices)
    world_vertices.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
    world_faces.extend(tuple(start + i for i in p.vertices) for p in obj.data.polygons)
bvh = BVHTree.FromPolygons(world_vertices, world_faces)
samples = 20
for obj in bpy.context.scene.objects:
    mat = obj.data.materials[0]
    if mat in [CYAN, DIM, YELLOW, SCREEN]:
        continue
    colors = obj.data.color_attributes.new(name="ContactOcclusion", type="FLOAT_COLOR", domain="POINT")
    base = mat.diffuse_color
    normal_matrix = obj.matrix_world.to_3x3().inverted().transposed()
    for vertex in obj.data.vertices:
        normal = (normal_matrix @ vertex.normal).normalized()
        origin = obj.matrix_world @ vertex.co + normal * 0.004
        tangent = normal.cross(Vector((0, 0, 1)))
        if tangent.length < 0.01:
            tangent = normal.cross(Vector((0, 1, 0)))
        tangent.normalize()
        bitangent = normal.cross(tangent)
        blocked = 0.0
        for i in range(samples):
            radius = math.sqrt((i + 0.5) / samples)
            angle = i * 2.3999632297
            ray = tangent * (radius * math.cos(angle)) + bitangent * (radius * math.sin(angle))
            ray += normal * math.sqrt(1 - radius * radius)
            hit, _, _, distance = bvh.ray_cast(origin, ray, 0.46)
            if hit is not None:
                blocked += 1 - distance / 0.46
        shade = 1.0 - 0.64 * blocked / samples
        colors.data[vertex.index].color = (base[0] * shade, base[1] * shade, base[2] * shade, 1.0)
    color_node = mat.node_tree.nodes.new("ShaderNodeVertexColor")
    color_node.layer_name = "ContactOcclusion"
    mat.node_tree.links.new(color_node.outputs["Color"], mat.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])

SOURCE = ROOT / "tools" / "art_source"
SOURCE.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "test_lab.blend"))
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT / "test_lab.glb"), export_format="GLB",
    export_yup=True, export_cameras=False, export_lights=False,
    export_vertex_color="ACTIVE", export_all_vertex_colors=True,
)
print("LAB_ASSET_READY", len(bpy.context.scene.objects), "material batches")
