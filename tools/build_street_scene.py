"""Rain-after-school street diorama. Run with Blender --background --python this file.

All positions use Three.js Y-up coordinates via the shared authoring helpers.
The combat dish stays at its original height/radius. Set STREET_FONT to a local
Japanese-capable font when rebuilding on another workstation.
"""
import math
import json
import os
import random
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).parent))
import build_battle_worlds as worlds
from build_showroom import box, cyl, ring, rod, mat, xyz, finish


# Relative visual calibration: a stock top is ~1.99 units across, a door is
# 68.48 and a bicycle wheel 21.76. These are NOT physics measurement units.
HUMAN_SCALE = 16
PAVEMENT_Y = 3.70
FACADE_ORIGIN = (.98, -.58, -12.50)
FACADE_ANCHOR = (10, PAVEMENT_Y, -50)
VENDING_ORIGIN = (9.73, -.61, -10.74)
VENDING_ANCHOR = (47, PAVEMENT_Y, -48)
LAMP_ORIGIN = (-10.2, -.95, -7.8)
LAMP_ANCHOR = (-23, -.94, -14)


def transformed(p, origin, anchor, scale=HUMAN_SCALE):
    return [anchor[i] + (p[i] - origin[i]) * scale for i in range(3)]


def reframe(previous, origin, anchor, collection_name, scale=HUMAN_SCALE):
    """Recompose actual life-size groups, keeping the toy dish untouched."""
    transform = (Matrix.Translation(Vector(xyz(anchor))) @
                 Matrix.Scale(scale, 4) @ Matrix.Translation(-Vector(xyz(origin))))
    collection = bpy.data.collections.new(collection_name)
    bpy.context.scene.collection.children.link(collection)
    for obj in set(bpy.context.scene.objects) - previous:
        obj.matrix_world = transform @ obj.matrix_world
        for owner in list(obj.users_collection):
            owner.objects.unlink(obj)
        collection.objects.link(obj)


def text(body, p, size, material, font):
    bpy.ops.object.text_add(location=xyz(p), rotation=(math.pi / 2, 0, 0))
    obj = bpy.context.object
    obj.data.body = body
    obj.data.font = font
    obj.data.align_x = "CENTER"
    obj.data.size = size
    obj.data.space_character = 1.12
    obj.data.extrude = .002
    obj.data.resolution_u = 4
    obj.data.materials.append(material)
    bpy.ops.object.convert(target="MESH")
    obj.name = "Shop lettering " + body


def wire(name, points, radius, material):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 8
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, co in zip(spline.bezier_points, points):
        point.co = xyz(co)
        point.handle_left_type = point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return obj


def sphere(name, p, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, location=xyz(p))
    obj = bpy.context.object
    obj.scale = (scale[0], scale[2], scale[1])
    return finish(obj, name, material, 0)


def street():
    worlds.reset()
    random.seed(916)
    font_path = os.environ.get("STREET_FONT", "C:/Windows/Fonts/YuGothM.ttc")
    if not Path(font_path).exists():
        raise FileNotFoundError("Set STREET_FONT to a Japanese-capable font: " + font_path)
    font = bpy.data.fonts.load(font_path)
    ink = mat("Street painted iron", (.023, .047, .060), .65, .3)
    metal = mat("Street brushed steel", (.25, .31, .32), .82, .26)
    plaster = mat("Street indigo plaster", (.12, .18, .23), 0, .87)
    warmwall = mat("Street ivory plaster", (.42, .38, .28), 0, .82)
    tile = mat("Street glazed jade tile", (.048, .20, .18), .16, .24)
    grout = mat("Street tile grout", (.033, .07, .075), 0, .95)
    oak = mat("Street stained oak", (.19, .080, .034), 0, .55)
    lettering = mat("Street sign ink", (.012, .008, .005), 0, .88)
    paper = mat("Street aged paper", (.78, .64, .40), 0, .65)
    red = mat("Street oxblood enamel", (.35, .038, .037), .3, .27)
    canvas = mat("Street awning teal", (.04, .16, .16), 0, .89)
    stripe = mat("Street awning cream", (.49, .44, .32), 0, .89)
    darkglass = mat("Street smoked glass", (.025, .073, .091), .45, .15)
    interior = mat("Street cafe interior", (.30, .15, .067), 0, .85, .08)
    window = mat("Street window glow", (1, .48, .16), 0, .35, 1.2)
    sign = mat("Street lightbox glow", (1, .64, .30), 0, .3, 2.1)
    vending = mat("Street vending glow", (.48, .78, .84), .1, .22, 1.65)
    lamp = mat("Street lantern glow", (1, .36, .10), 0, .5, 1.4)
    soil = mat("Street damp soil", (.025, .022, .013), 0, 1)
    pot = mat("Street terracotta", (.26, .10, .054), 0, .79)
    leaf = [mat("Street leaf " + str(i), c, 0, .66) for i, c in enumerate([
        (.05, .16, .09), (.09, .24, .13), (.16, .26, .11)])]
    asphalt = mat("Street wet asphalt", (.031, .052, .066), .08, .48)
    curb = mat("Street curb stone", (.19, .23, .24), 0, .78)
    joints = mat("Street pavement joints", (.025, .04, .046), 0, .92)
    stone = [mat("Street paver " + str(i), (.16+i*.013, .20+i*.014, .21+i*.015), 0, .57)
             for i in range(4)]
    # Slightly aged toy plastic: original geometry, rings and collision contact.
    worlds.cream = mat("Street bowl ivory", (.59, .53, .39), 0, .28)
    plastic = worlds.cream.node_tree.nodes["Principled BSDF"]
    plastic.inputs["Coat Weight"].default_value = .48
    plastic.inputs["Coat Roughness"].default_value = .24
    worlds.blue = mat("Street bowl cobalt", (.03, .17, .24), .15, .29)
    worlds.bowl(6.7, 0, True)
    box("Street foundation", (0, -1.16, -70), (360, .44, 420), asphalt, .08)

    # Human-scale paving: ~30cm slabs relative to the ~6cm stock toy.
    # A cropped curb behind the dish gives a direct, honest scale reference.
    box("Sidewalk foundation", (0, 1.33, -98), (380, 4.60, 132), joints, .12)
    for row in range(8):
        for i in range(26):
            box("Individual sidewalk paver", (-184+i*14.72, 3.66, -39.4-row*14.72),
                (14.58, .08, 14.56), stone[(i+row*3) % 4], .07)
    for i in range(28):
        box("Rounded curb stone", (-186+i*13.76, 1.38, -31.7), (13.59, 4.64, .6), curb, .13)
    for x in [-26, 25]:
        box("Drain recessed cavity", (x, -.928, -30.08), (20, .02, 2.1), joints, .03)
        for i in range(14):
            box("Drain grille", (x-9.2+i*1.41, -.887, -30.08), (.21, .08, 1.96), metal, .025)
    for i in range(6):
        # Asphalt repaired by hand, not a repeated checkerboard pattern.
        x, z = [-9.4, 9.2][i % 2], -5+i*2.25
        wire("Tar repair seam", [(x, -.927, z), (x+.3, -.926, z+.42),
             (x+.21, -.927, z+.91), (x+.46, -.927, z+1.4)], .012, joints)
    cyl("Manhole cover", (25, -.92, 4), 9.1, .025, ink, 96)
    for r in [3, 5.8, 8.8]:
        ring("Manhole concentric ridges", (25, -.891, 4), r+.10, r, .035, metal, 96)

    # Three asymmetrical connected buildings; shop fronts face the game camera.
    # A real opening instead of a luminous panel pasted over a solid facade.
    group_start = set(bpy.context.scene.objects)
    box("Cafe upper story", (-3.35, 5.82, -15), (12.3, 4.16, 4.2), warmwall, .055)
    box("Cafe rear structure", (-3.35, 1.58, -15.92), (12.3, 4.32, 2.36), warmwall, .025)
    box("Cafe lower structure", (-3.35, .10, -15), (12.3, 1.36, 4.2), warmwall, .025)
    box("Cafe left pier", (-9.13, 2.18, -15), (.74, 3.1, 4.2), warmwall, .025)
    box("Cafe door surround", (.90, 2.18, -15), (3.76, 3.1, 4.2), warmwall, .025)
    box("Neighbour blue plaster", (6.8, 4.5, -15.7), (7.8, 10.2, 5.4), plaster, .045)
    box("Left return building", (-12.1, 4.5, -16.9), (5.1, 10.3, 6), plaster, .06)
    # Contact borders keep corners readable under low evening illumination.
    for x in [-9.55, 2.82, 10.73]:
        box("Wall corner shadow", (x, 3.55, -12.86), (.055, 8.2, .035), grout, .004)
    for x, width, y in [(-3.35, 12.55, 7.97), (6.8, 8, 9.69)]:
        box("Roof fascia", (x, y, -14.9), (width, .23, 4.7), ink, .055)
        box("Roof coping", (x, y+.16, -14.9), (width+.12, .11, 4.8), metal, .02)
    # Cafe jade tile dado: genuine separated ceramic blocks and mortar recesses.
    box("Cafe tile backing", (-3.35, .26, -12.86), (12.1, 1.7, .13), grout, .012)
    for row in range(4):
        for i in range(28):
            box("Glazed facade tile", (-9.2+i*.435, -.37+row*.41, -12.76),
                (.418, .393, .075), tile, .014)

    # Recessed shop window, frame, mullions, interior shelves, cups and menus.
    box("Warm interior rear wall", (-4.9, 2.2, -14.66), (7.55, 2.9, .09), interior, .008)
    for x in [-8.72, -1.08]:
        box("Deep timber window return", (x, 2.2, -13.53), (.12, 2.96, 1.9), oak, .016)
    for y in [.77, 3.64]:
        box("Cafe reveal top and bottom", (-4.9, y, -13.53), (7.75, .13, 1.9), oak, .016)
    for x in [-7.4, -4.9, -2.4]:
        box("Cafe rear shelf", (x, 2.46, -14.39), (1.83, .13, .49), oak, .016)
        for i in range(5):
            cyl("Rear coffee tin", (x-.69+i*.34, 2.68, -14.32), .105, .30,
                paper if i%2 else canvas, 16)
    box("Cafe interior counter", (-4.9, 1.07, -13.64), (7.2, .60, .55), oak, .025)
    for x in [-8.65, -6.25, -3.8, -1.12]:
        box("Cafe timber mullion", (x, 2.2, -12.50), (.105, 2.98, .32), oak, .018)
    for y in [.75, 3.64]:
        box("Cafe timber window frame", (-4.9, y, -12.50), (7.72, .11, .32), oak, .016)
    for y in [1.4, 2.65]:
        box("Inside window shelf", (-4.92, y, -12.72), (7.25, .14, .72), oak, .014)
        for i in range(9):
            x = -8.22+i*.8
            cyl("Cafe ceramic cup", (x, y+.17, -12.52), .095, .22, paper, 16)
            cyl("Coffee dark surface", (x, y+.282, -12.52), .073, .007, oak, 16)
    for x in [-7.8, -5.9, -2.3]:
        box("Window hanging menu", (x, 3.13, -12.42), (.45, .62, .02), paper, .008)
        for k in range(4):
            box("Menu ink line", (x, 3.31-k*.11, -12.402), (.29-(k%2)*.08, .018, .008), oak, .001)
    for x in [-7.5, -4.9, -2.3]:
        cyl("Pendant cord", (x, 3.32, -12.42), .013, .52, ink, 12)
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=.27, radius2=.055, depth=.16,
                                       location=xyz((x, 3.07, -12.40)))
        finish(bpy.context.object, "Cafe pendant shade", ink, .012)
        cyl("Pendant warm bulb", (x, 2.985, -12.40), .18, .018, sign, 24)
    # Near-transparent glazing retains the real interior and catches grazing light.
    glazing = mat("Street cafe glazing", (.25, .42, .44), .1, .13)
    glazing.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = .09
    glazing.diffuse_color = (.25, .42, .44, .09)
    glazing.surface_render_method = "DITHERED"
    for x, w in [(-7.45, 2.26), (-5.02, 2.32), (-2.46, 2.54)]:
        box("Window glass pane", (x, 2.2, -12.34), (w, 2.70, .018), glazing, 0)
    # Door has a transom, bevelled jambs, brass handle and a small open sign.
    box("Door deep recess", (.98, 1.66, -12.79), (2.02, 4.28, .23), ink, .025)
    box("Door lit upper glass", (.98, 2.45, -12.66), (1.65, 2.2, .025), window, .008)
    box("Door bottom timber", (.98, .46, -12.57), (1.69, 1.65, .20), oak, .025)
    for x in [.06, 1.90]:
        box("Door jamb", (x, 1.65, -12.46), (.12, 4.2, .32), oak, .02)
    rod("Door brass handle", (1.52, 1.11, -12.27), (1.52, 1.77, -12.27), .035, metal)
    box("Door hanging card", (.93, 2.5, -12.36), (.95, .45, .025), paper, .01)
    text("営業中", (.93, 2.42, -12.34), .26, oak, font)
    box("Cafe doorstep", (.99, -.45, -12.09), (2.25, .25, 1.02), curb, .04)

    # Broad, readable lightbox with original Japanese lettering.
    box("Cafe lightbox casing", (-3.35, 4.48, -12.55), (11.5, 1.22, .48), ink, .065)
    box("Cafe lightbox face", (-3.35, 4.48, -12.295), (11.22, .99, .04), sign, .035)
    text("喫茶  こもれび", (-3.55, 4.17, -12.23), .91, lettering, font)
    for x in [-8.84, 2.14]:
        for y in [4.1, 4.86]:
            sphere("Lightbox fixing", (x, y, -12.251), (.025, .025, .014), metal)
    # Sloped fabric strips, stitched valance and metal supports.
    for i in range(30):
        x = -9.3+i*.405
        obj = box("Striped fabric awning", (x, 3.95, -11.79), (.401, .055, 1.24),
                  canvas if i%4 < 2 else stripe, .008)
        obj.rotation_euler.x = .16
        box("Awning scalloped valance", (x, 3.71, -11.17), (.401, .27, .045),
            canvas if i%4 < 2 else stripe, .028)
    for x in [-9.4, -3.4, 2.65]:
        rod("Awning support", (x, 3.3, -12.65), (x, 3.75, -11.12), .033, metal)
    rod("Awning front rail", (-9.48, 3.77, -11.13), (2.83, 3.77, -11.13), .036, ink)

    # Upstairs everyday life: curtains, tiny balcony, air conditioner, gutter.
    for x, lit in [(-7.5, False), (-3.5, True), (.5, False), (5.0, False), (8.7, True)]:
        y = 6.47 if x < 3 else 7.5
        box("Upper window inset", (x, y, -12.82), (2.30, 1.98, .15), ink, .025)
        box("Upper window pane", (x, y, -12.727), (2.07, 1.75, .03),
            window if lit else darkglass, .008)
        if lit:
            for dx in [-.87, -.65, .61, .84]:
                box("Soft curtain fold", (x+dx, y, -12.683), (.19, 1.66, .065), paper, .032)
        box("Upper window center bar", (x, y, -12.64), (.065, 1.91, .13), metal, .008)
        box("Upper window sill", (x, y-.98, -12.60), (2.49, .105, .42), curb, .015)
    for x in [-7.5, .5, 7.6]:
        y = 5.15 if x < 3 else 5.8
        box("AC outdoor housing", (x, y, -12.40), (1.38, .76, .49), curb, .05)
        for i in range(9):
            box("AC vent louvre", (x-.52+i*.115, y, -12.138), (.033, .56, .025), metal, .006)
        for dx in [-.52, .52]:
            box("AC wall bracket", (x+dx, y-.43, -12.45), (.06, .10, .72), ink, .012)
        wire("AC pipe insulation", [(x+.65, y-.1, -12.4), (x+.9, y-.2, -12.6),
             (x+1.06, y-1, -12.69)], .034, paper)
    for x in [-9.68, 2.94, 10.62]:
        wire("Rain downpipe", [(x, 8, -13), (x, 7.65, -12.55),
             (x, -.26, -12.55), (x+.22, -.52, -12.32)], .07, metal)
        for y in [.5, 2.7, 5.2, 7.2]:
            box("Pipe retaining clip", (x, y, -12.48), (.19, .09, .14), ink, .014)
    for z, y in [(-12.0, 9.4), (-12.5, 9.9)]:
        wire("Slack overhead cable", [(-15, y, z), (-6, y-1, z+.7),
             (3, y-.9, z+.65), (14, y+.4, z)], .023, ink)

    # Neighbour's shutter gives the quiet, closed-for-the-night counterpoint.
    box("Shutter recess", (6.43, 1.9, -12.78), (5.67, 4.9, .17), ink, .02)
    for i in range(34):
        box("Shutter rolled slat", (6.43, -.36+i*.139, -12.65), (5.29, .127, .08), metal, .015)
    for x in [3.69, 9.16]:
        box("Shutter runner", (x, 1.9, -12.48), (.14, 4.82, .25), ink, .019)
    box("Shutter bottom bar", (6.43, -.34, -12.50), (5.48, .13, .21), ink, .016)
    text("自転車", (6.43, 2.15, -12.593), .58, ink, font)
    text("REPAIR / 18:30", (6.43, 1.66, -12.593), .24, ink, font)
    box("Bike shop faded fascia", (6.43, 4.63, -12.69), (5.8, .62, .24), canvas, .03)
    text("まちの自転車店", (6.43, 4.45, -12.545), .41, paper, font)
    reframe(group_start, FACADE_ORIGIN, FACADE_ANCHOR, "Human scale / storefront")

    # Cold vending machine, lit individual cans, coin slot and pickup cavity.
    group_start = set(bpy.context.scene.objects)
    box("Vending machine shell", (9.73, 1.21, -10.74), (1.92, 3.64, 1.12), red, .095)
    box("Vending lit display", (9.52, 1.83, -10.16), (1.27, 1.83, .055), vending, .024)
    for row in range(3):
        for i in range(5):
            x, y = 9.02+i*.251, 1.28+row*.56
            cyl("Vending drink can", (x, y, -10.065), .077, .27, [red, paper, canvas][(i+row)%3], 16)
            cyl("Drink can rim", (x, y+.14, -10.065), .078, .012, metal, 16)
            box("Selection button", (x, y-.19, -10.075), (.115, .05, .04), sign, .014)
    box("Vending coin panel", (10.29, 1.37, -10.155), (.22, .70, .02), ink, .012)
    box("Coin slot", (10.29, 1.51, -10.137), (.025, .14, .01), metal, .001)
    box("Vending pickup cavity", (9.65, .09, -10.155), (1.37, .44, .045), ink, .025)
    box("Vending canopy label", (9.73, 2.79, -10.15), (1.64, .31, .05), paper, .016)
    text("DRINK", (9.73, 2.72, -10.114), .22, red, font)
    reframe(group_start, VENDING_ORIGIN, VENDING_ANCHOR, "Human scale / vending")

    # Bicycle side silhouette: tyre, spokes, frame, fenders, basket.
    group_start = set(bpy.context.scene.objects)
    for x in [4.6, 6.65]:
        wheel = ring("Bicycle rubber tyre", (0, 0, 0), .68, .61, .095, ink, 48)
        wheel.location = xyz((x, .19, -10.72))
        wheel.rotation_euler.x = math.pi/2
        rim = ring("Bicycle polished rim", (0, 0, 0), .606, .58, .039, metal, 48)
        rim.location = xyz((x, .19, -10.72))
        rim.rotation_euler.x = math.pi/2
        for i in range(16):
            a = i*math.tau/16
            rod("Bicycle spoke", (x, .19, -10.72),
                (x+math.cos(a)*.58, .19+math.sin(a)*.58, -10.72), .008, metal)
        rod("Bicycle axle hub", (x, .19, -10.80), (x, .19, -10.64), .056, metal)
        wire("Bicycle curved mudguard", [
            (x+math.cos(a)*.73, .19+math.sin(a)*.73, -10.72)
            for a in [math.pi*i/16 for i in range(17)]], .033, metal)
        rod("Bicycle tyre valve", (x, -.36, -10.72), (x, -.29, -10.72), .014, metal)
    for a,b in [((4.6,.19),(5.32,1.17)),((5.32,1.17),(5.78,.22)),
                ((5.78,.22),(4.6,.19)),((5.32,1.17),(6.22,1.2)),
                ((6.22,1.2),(5.78,.22)),((6.22,1.2),(6.65,.19))]:
        rod("Bicycle enamel frame", (*a, -10.72), (*b, -10.72), .042, canvas)
    rod("Bicycle seat post", (5.32,1.12,-10.72),(5.27,1.47,-10.72),.026,metal)
    box("Bicycle leather saddle", (5.25,1.49,-10.72),(.46,.10,.28),oak,.045)
    wire("Bicycle handlebar", [(6.22,1.18,-10.72),(6.17,1.73,-10.72),
         (6.32,1.84,-10.72),(6.47,1.79,-10.45)],.03,metal)
    for y in [1.32,1.62,1.90]:
        box("Basket horizontal wire", (6.88,y,-10.46),(.7,.018,.48),metal,.009)
    for i in range(7):
        rod("Basket vertical wire", (6.56+i*.105,1.32,-10.20),(6.56+i*.105,1.90,-10.20),.009,metal)
    rod("Bicycle kickstand",(5.65,.27,-10.7),(5.39,-.56,-10.35),.026,metal)
    wire("Bicycle brake cable", [(6.4,1.79,-10.46),(6.5,1.2,-10.57),
         (6.26,.82,-10.66)], .010, ink)
    wire("Bicycle chain", [(4.6,.24,-10.60),(5.77,.37,-10.60),
         (5.95,.22,-10.60),(5.77,.07,-10.60),(4.6,.14,-10.60),
         (4.6,.24,-10.60)], .013, metal)
    rod("Bicycle pedal crank", (5.78,.22,-10.59),(5.91,.02,-10.51), .023, metal)
    box("Bicycle rubber pedal", (5.91,.02,-10.41), (.25,.07,.20), ink, .013)
    reframe(group_start, (5.6, -.49, -10.72), (-24, -.94, -18),
            "Human scale / bicycle")

    # Storefront props: plants, bench, menu, stacked crates and paper lantern.
    for (x, z, s), anchor in zip(
            [(-9.2,-10.9,.9),(-1.5,-11.2,.6),(2.45,-11.1,.75),(10.75,-10.7,.65)],
            [(-40,PAVEMENT_Y,-42),(-27,PAVEMENT_Y,-48),(13,-.94,-15),(56,PAVEMENT_Y,-42)]):
        group_start = set(bpy.context.scene.objects)
        bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=.32*s,radius2=.47*s,depth=.7*s,
                                       location=xyz((x,-.58+.35*s,z)))
        finish(bpy.context.object,"Terracotta planter",pot,.018)
        ring("Planter rolled lip",(x,-.58+.69*s,z),.49*s,.415*s,.075*s,pot,48)
        ring("Planter saucer",(x,-.55,z),.40*s,.30*s,.055*s,pot,48)
        cyl("Planter soil",(x,-.57+.70*s,z),.43*s,.035,soil,24)
        for i in range(17):
            a=random.random()*math.tau
            h=random.uniform(.22,1.05)*s
            end=(x+math.cos(a)*.45*s,-.57+.70*s+h,z+math.sin(a)*.4*s)
            rod("Plant slender stem",(x,-.57+.7*s,z),end,.009,leaf[0])
            obj=sphere("Individual plant leaf",end,(.14*s,.035*s,.32*s),leaf[i%3])
            obj.rotation_euler=(random.random()*.7,random.random()*.5,a)
        reframe(group_start, (x, -.58, z), anchor, "Human scale / planter")
    group_start = set(bpy.context.scene.objects)
    for x in [-7.8,-5.5]:
        for z in [-11.7,-11.1]:
            box("Bench iron leg",(x,-.16,z),(.065,.84,.065),ink,.012)
    for i in range(4):
        box("Bench timber seat",(-6.65,.25,-11.75+i*.21),(2.65,.11,.18),oak,.026)
    for y in [.72,.99]:
        box("Bench timber back",(-6.65,y,-11.8),(2.65,.20,.09),oak,.022)
    for x in [-7.8,-5.5]:
        rod("Bench back support",(x,.2,-11.8),(x,1.12,-11.8),.035,ink)
    reframe(group_start, (-6.65, -.58, -11.4), (-49, PAVEMENT_Y, -43),
            "Human scale / bench")
    group_start = set(bpy.context.scene.objects)
    for x in [-8.13,-7.55]:
        box("Stacked delivery crate",(x,-.19,-11.13),(.52,.72,.63),oak,.018)
        for j in range(3):
            box("Crate separated slat",(x,-.42+j*.21,-10.795),(.49,.11,.04),paper,.01)
    box("Menu board timber",(-2.2,.15,-10.43),(1.1,1.5,.10),oak,.045)
    box("Menu chalk face",(-2.2,.15,-10.362),(.94,1.3,.025),ink,.012)
    text("本日の珈琲",(-2.2,.51,-10.34),.18,paper,font)
    text("380",(-2.2,.09,-10.34),.32,paper,font)
    for i in range(3):
        box("Chalk menu ruling",(-2.2,-.17-i*.13,-10.343),(.64,.017,.008),paper,.001)
    for x in [-2.68,-1.72]:
        rod("Menu easel",(x,-.59,-10.23),(x,.87,-10.48),.035,oak)
    reframe(group_start, (-2.2, -.58, -10.43), (43, PAVEMENT_Y, -38),
            "Human scale / shop belongings")
    group_start = set(bpy.context.scene.objects)
    rod("Lantern hanger",(2.5,3.59,-12.5),(2.5,3.59,-11.6),.024,ink)
    sphere("Paper lantern",(2.5,2.96,-11.65),(.29,.45,.29),lamp)
    for y in [2.57,2.69,2.83,2.98,3.13,3.27,3.35]:
        r=.29*math.sqrt(max(.05,1-((y-2.96)/.45)**2))
        ring("Lantern bamboo rib",(2.5,y,-11.65),r+.006,r,.016,oak,32)
    reframe(group_start, FACADE_ORIGIN, FACADE_ANCHOR, "Human scale / lantern")

    # Single street lamp anchors the left side; its lens has a local runtime light.
    group_start = set(bpy.context.scene.objects)
    wire("Street lamp pole",[(-10.2,-.95,-7.8),(-10.2,5.65,-7.8),
         (-9.9,6.15,-7.8),(-8.7,6.15,-7.8)],.079,ink)
    box("Street lamp hood",(-8.64,6.13,-7.8),(.87,.19,.55),ink,.066)
    box("Street lamp diffuser",(-8.64,6.015,-7.8),(.72,.032,.41),sign,.019)
    reframe(group_start, LAMP_ORIGIN, LAMP_ANCHOR, "Human scale / street lamp")
    for i in range(25):
        x,z=random.uniform(-11,11),random.uniform(-10,8)
        if math.hypot(x,z)<7.5:
            continue
        obj=sphere("Rain fallen leaf",(x,-.90,z),(.32,.016,.67),pot if i%3 else paper)
        obj.rotation_euler.z=random.random()*math.tau
    # Belongings keep the scene connected to tops played after school.
    worlds.case((-8.15,-.30,1.3),1.25)
    worlds.launcher((7.65,-.75,2.2),1.1)
    worlds.toy((-8.1,-.90,2.6),1,worlds.blue)
    # Background skyline uses recessed windows, sparse occupied rooms and roof pipes.
    group_start = set(bpy.context.scene.objects)
    for x,z,h,w in [(-13,-24,14,6),(-6,-23,11,6),(1,-24,13,6),(10,-25,16,7)]:
        box("Distant apartment",(x,h/2-1,z),(w,h,4),plaster,.04)
        for row in range(4):
            for col in range(3):
                box("Distant apartment window",(x-w*.32+col*w*.32,1.3+row*2.6,z+2.025),
                    (.8,1.3,.04),window if (row*3+col+int(x))%7==0 else darkglass,.018)
        box("Apartment roof cap",(x,h-.94,z),(w+.16,.13,4.13),ink,.016)
    reframe(group_start, (0,-1,-24), (0,-.94,-260), "Human scale / distant city")
    bpy.context.view_layer.update()
    # Runtime luminaires share authoring transforms; no hand-copied miniature
    # positions survive a geometry re-layout.
    layout = {
        "humanScale": HUMAN_SCALE,
        "pavementHeight": PAVEMENT_Y,
        "lights": {
            "cafeLeft": transformed((-6,2.9,-10.3), FACADE_ORIGIN, FACADE_ANCHOR),
            "cafeDoor": transformed((.5,2.6,-10.7), FACADE_ORIGIN, FACADE_ANCHOR),
            "window": transformed((-4.9,2.25,-12.2), FACADE_ORIGIN, FACADE_ANCHOR),
            "pendant": transformed((-4.9,3.1,-13.3), FACADE_ORIGIN, FACADE_ANCHOR),
            "lantern": transformed((2.5,2.9,-11.3), FACADE_ORIGIN, FACADE_ANCHOR),
            "vending": transformed((9.45,1.65,-9.7), VENDING_ORIGIN, VENDING_ANCHOR),
            "lamp": transformed((-8.64,5.85,-7.8), LAMP_ORIGIN, LAMP_ANCHOR),
        },
        "measurements": {},
    }
    for name in ["Door deep recess", "Bicycle rubber tyre", "Bench timber seat", "Combat dish"]:
        obj = bpy.data.objects[name]
        corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        dims = [max(p[i] for p in corners)-min(p[i] for p in corners) for i in range(3)]
        layout["measurements"][name] = [round(dims[0],4),round(dims[2],4),round(dims[1],4)]
    (worlds.OUT / "street_layout.json").write_text(json.dumps(layout, indent=2)+"\n", encoding="utf-8")
    worlds.export("street")
    print("STREET_DETAIL_READY", flush=True)


if __name__ == "__main__":
    street()
