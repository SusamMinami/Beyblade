"""Detailed toy-scale competition apparatus, sharing the incumbent combat dish.

Blender --background --python tools/build_championship_scene.py
The surrounding tiers are equipment banks, not miniature human seating.
"""
import math
import json
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).parent))
import build_battle_worlds as world
from build_showroom import box, cyl, ring, rod, mat, xyz, engraving, finish

FIXTURES = [
    {"position": [side * 8.5, height, z], "phase": i * 1.65 + (0 if side < 0 else math.pi),
     "color": "#76dcf5" if (i + (side > 0)) % 2 == 0 else "#a8b9ff"}
    for i, (height, z) in enumerate([(6.6, -7.2), (5.4, -2.6), (3.3, 3.8)])
    for side in [-1, 1]
]


def panel_arc(name, inner, outer, start, end, y, material):
    """Bevelled annular metal tile with real separation from its neighbours."""
    steps = 10
    vertices = [xyz((r * math.cos(a), h, r * math.sin(a)))
                for h in [y - .12, y]
                for r in [inner, outer]
                for a in [start + (end - start) * i / steps for i in range(steps + 1)]]
    n = steps + 1
    faces = []
    for i in range(steps):
        faces += [(i, i+1, n+i+1, n+i),
                  (2*n+i, 3*n+i, 3*n+i+1, 2*n+i+1),
                  (i, 2*n+i, 2*n+i+1, i+1),
                  (n+i, n+i+1, 3*n+i+1, 3*n+i)]
    faces += [(0, n, 3*n, 2*n), (n-1, 3*n-1, 4*n-1, 2*n-1)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj, name, material, .018)
    return obj


def championship():
    world.reset()
    dark, steel, cyan = world.dark, world.steel, world.cyan
    titanium = mat("Arena satin titanium", (.22, .29, .34), .82, .34)
    panel = mat("Deck graphite enamel", (.08, .12, .155), .56, .32)
    silver = mat("Edge polished aluminium", (.46, .57, .63), .9, .23)
    rubber = mat("Isolator rubber", (.022, .029, .04), 0, .83)
    amber = mat("Championship amber status", (.98, .45, .08), .2, .34, 1.3)
    display = mat("Championship display ink", (.016, .038, .058), .35, .22)
    ice = mat("Championship ice lettering", (.37, .69, .78), .25, .28, .8)
    world.bowl(6.9, 0)
    bpy.data.objects["Combat dish"].data.materials[0] = titanium
    cyl("Foundation", (0, -1.30, 0), 13.5, .44, dark, 128)
    ring("Rubber isolation seam", (0, -.97, 0), 7.68, 7.42, .12, rubber)
    ring("Polished outer reveal", (0, -.84, 0), 7.73, 7.68, .13, silver)
    ring("Outer equipment rail", (0, -.93, 0), 12.3, 12.18, .2, steel)
    for i in range(32):
        a = i * math.tau / 32
        panel_arc("Removable deck plate", 7.82, 10.45, a+.012, a+math.tau/32-.012, -.91,
                  steel if i % 4 == 0 else panel)
        for r in [8.0, 10.23]:
            for offset in [.04, .15]:
                angle = a + offset
                x, z = r * math.cos(angle), r * math.sin(angle)
                cyl("Recessed socket", (x, -.900, z), .047, .012, rubber, 12)
                cyl("Hex fastener", (x, -.888, z), .026, .015, silver, 6)
        if i % 2 == 0:
            for j in range(5):
                angle = a + .037 + j * .03
                o = box("Deck cooling slot", (9.25*math.cos(angle), -.902, 9.25*math.sin(angle)),
                        (.85, .015, .035), rubber, .01)
                o.rotation_euler.z = -angle
        else:
            o = box("Maintenance marker", (9.6*math.cos(a+.09), -.89, 9.6*math.sin(a+.09)),
                    (.27, .016, .1), amber, .008)
            o.rotation_euler.z = -a
    # Three rear tiers support amplifier/ventilation banks at apparatus scale.
    for row in range(3):
        for i in range(15):
            a = math.pi + (i+.5)*math.pi/15
            r, y = 10.8 + row*.78, -.65 + row*.4
            panel_arc("Tier amplifier shell", r-.3, r+.32, a-.085, a+.085, y, panel)
            for j in range(3):
                angle = a-.05+j*.05
                o = box("Tier cooling fin", (r*math.cos(angle), y+.09, r*math.sin(angle)),
                        (.45,.13,.035), steel, .012)
                o.rotation_euler.z=-angle
            panel_arc("Tier recessed indicator", r+.29, r+.32, a-.075, a+.025, y+.01, ice)
    # Braced perimeter supports leave the full central playing area unobstructed.
    for fixture in FIXTURES:
        x, h, z = fixture["position"]
        cyl("Light tower foot", (x,-.66,z), .52,.42,dark,32)
        ring("Foot chrome collar", (x,-.43,z), .44,.37,.08,silver,32)
        for dx in [-.2,.2]:
            rod("Light tower rail",(x+dx,-.4,z),(x+dx,h-.5,z),.065,steel)
        levels = max(3, round(h))
        for j in range(levels):
            y = -.35 + j*(h-.3)/levels
            rod("Tower diagonal",(x-.2,y,z),(x+.2,y+(h-.3)/levels,z),.03,steel)
            box("Tower status strip",(x,y+.18,z+.07),(.11,.3,.035),cyan,.01)
        cyl("Fixture mounting plate",(x,h-.34,z),.32,.12,dark,32)
        # Runtime moving heads and real lights use these exact exported anchors.
    for x in [-8.5,8.5]:
        rod("Rear truss upright",(x,-.8,-10.8),(x,7.4,-10.8),.13,steel)
        box("Truss footing",(x,-.65,-10.8),(.9,.55,.9),dark,.07)
    for y in [6.9,7.45]:
        rod("Overhead crossbar",(-8.5,y,-10.8),(8.5,y,-10.8),.09,steel)
    for i in range(20):
        x=-8.5+i*.85
        rod("Crossbar web",(x,6.9,-10.8),(x+.85,7.45,-10.8),.035,steel)
    for x in [-3.4,3.4]:
        rod("Scoreboard hanger",(x,7.1,-10.8),(x,5.7,-10.8),.07,steel)
    box("Scoreboard enclosure",(0,4.6,-10.8),(8.3,2.7,.7),dark,.16)
    box("Scoreboard bezel",(0,4.6,-10.4),(8.04,2.5,.12),silver,.10)
    box("Scoreboard glass",(0,4.6,-10.31),(7.85,2.3,.055),display,.08)
    for x in [-3.8,3.8]:
        box("Scoreboard cyan border",(x,4.6,-10.265),(.035,2.04,.025),cyan,.006)
    engraving("SPIN / CORE",(0,4.8,-10.265),.67,ice)
    engraving("CHAMPIONSHIP ARENA",(0,4.23,-10.262),.21,steel)
    for side in [-1,1]:
        for i in range(8):
            box("Scoreboard signal cells",(side*(.45+i*.36),3.77,-10.26),
                (.23,.055,.02),cyan if i<6 else amber,.006)
    # Low equipment pods balance the lower frame without reading as tiny people.
    for side in [-1,1]:
        box("Power module shell",(side*10.1,-.18,1.2),(1.1,1.35,2.4),dark,.12)
        box("Power module lid",(side*10.1,.52,1.2),(1.04,.07,2.2),silver,.045)
        for j in range(9):
            box("Module louvers",(side*10.1,.05,.32+j*.21),(1.13,.07,.09),steel,.015)
        for z in [.4,2]:
            rod("External cable",(side*9.7,-.67,z),(side*8.3,-.67,z+.5),.055,rubber)
    world.export("championship")
    (world.OUT/"championship_layout.json").write_text(json.dumps({
        "bowlRadius": 6.9, "fixtures": FIXTURES,
        "runners": [{"radius": 7.62, "y": -.73}, {"radius": 10.58, "y": -.89}],
    },indent=2),encoding="utf-8")


if __name__ == "__main__":
    championship()
