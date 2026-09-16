"""Editable reference-directed dioramas. Blender --background --python tools/build_battle_worlds.py.

Three coordinates throughout; shared helpers convert to Blender's Z-up.
Combat surfaces and ruin blockers are read from the exported manifest at runtime.
"""
import sys
import json
import math
import random
from pathlib import Path
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
from build_showroom import box, cyl, ring, rod, mat, xyz, engraving, finish

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "resources" / "battle_worlds"
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / "tools" / "art_source"
random.seed(716)
BLOCKERS = [{"x": x, "z": z, "hx": .85, "hz": .40}
            for x in [-2.9, 2.9] for z in [-2.2, 2.2]]
PILLARS = [{"x": x, "z": z, "hx": .45, "hz": .45}
           for x in [-6.7, 6.7] for z in [-6.7, -2.4, 2.4, 6.7]]


def reset():
    random.seed(716)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for m in list(bpy.data.materials):
        if m.users == 0:
            bpy.data.materials.remove(m)
    global dark, steel, cyan, gold, cream, blue, red, wood, stone, purple, green
    dark = mat("Graphite", (.035, .065, .083), .65, .38)
    steel = mat("Brushed aluminium", (.31, .41, .45), .8, .3)
    cyan = mat("Energy_cyan", (.025, .65, .82), .2, .28, 3)
    gold = mat("Amber", (.95, .4, .06), .25, .4, .4)
    cream = mat("Ivory plastic", (.57, .54, .44), .02, .48)
    blue = mat("Cobalt enamel", (.025, .20, .42), .15, .36)
    red = mat("Vermilion", (.65, .06, .035), .1, .45)
    wood = mat("Honey oak", (.36, .19, .075), 0, .76)
    stone = mat("Blue grey stone", (.15, .19, .25), .1, .83)
    purple = mat("Crystal_violet", (.32, .07, .8), .25, .25, 2)
    green = mat("Cutting mat", (.055, .22, .15), 0, .88)


def export(name):
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / f"{name}.blend"))
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
    bpy.ops.export_scene.gltf(filepath=str(OUT / f"{name}.glb"), export_format="GLB", export_yup=True)
    print("WORLD_READY", name, flush=True)


def bowl(radius, y, plastic=False):
    """Dish matches the existing standard/metal render height, no visual-only raised rails."""
    verts, faces = [], []
    for j in range(33):
        r = radius*j/32
        h = (-.5+(r/radius)**2*.82) if plastic else (-.46+(r/radius)**1.5*.76)
        for i in range(128):
            a = i*math.tau/128
            verts.append(xyz((r*math.cos(a), y+h, r*math.sin(a))))
    for j in range(32):
        for i in range(128):
            a = j*128+i
            b = j*128+(i+1)%128
            faces.append((a, a+128, b+128, b))
    mesh = bpy.data.meshes.new("Combat dish")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    o = bpy.data.objects.new("Combat dish", mesh)
    bpy.context.collection.objects.link(o)
    finish(o, "Combat dish", cream if plastic else dark, 0)
    for r in [radius*.32, radius*.69, radius*.96]:
        h = (-.5+(r/radius)**2*.82) if plastic else (-.46+(r/radius)**1.5*.76)
        ring("Flush track", (0,y+h+.012,0), r+.012, r-.012, .012, blue if plastic else cyan)
    ring("Layered shell", (0,y-.32,0), radius+.48,radius,.7, cream if plastic else steel)
    ring("Lower base", (0,y-.82,0), radius+.58,radius-.4,.22, cream if plastic else dark)
    ring("Energy channel", (0,y-.63,0),radius+.5,radius+.47,.075,blue if plastic else cyan)
    glass = mat("Acrylic guard", (.47,.72,.77), .1,.14)
    glass.diffuse_color = (.47,.72,.77,.13)
    glass.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value=.13
    glass.surface_render_method="DITHERED"
    ring("Transparent guard", (0,y+.63,0),radius+.17,radius+.13,.58,glass)
    ring("Guard lip", (0,y+.93,0),radius+.18,radius+.12,.025,steel if not plastic else cream)
    for i in range(12):
        a = i*math.tau/12
        r = radius+.26
        p = (math.cos(a)*r,y+.28,math.sin(a)*r)
        o=box("Rim clip",p,(.43,.6,.5),blue if plastic else dark,.06)
        o.rotation_euler.z=-a
        if not plastic:
            o=box("Rim LED",(p[0],y+.6,p[2]),(.32,.018,.16),cyan,.005)
            o.rotation_euler.z=-a
    # Fine surface wear follows the dish; deterministic authored geometry.
    wear=mat("Surface hairlines",(.29,.34,.33) if not plastic else (.53,.51,.44),0,.95)
    for i in range(100):
        a=random.random()*math.tau
        r=random.uniform(.5,radius-.2)
        h=(-.5+(r/radius)**2*.82) if plastic else (-.46+(r/radius)**1.5*.76)
        rod("Battle scratch",(math.cos(a)*r,y+h+.007,math.sin(a)*r),
            (math.cos(a+.018)*r,y+h+.007,math.sin(a+.018)*r),.003,wear)


def sci_fi():
    reset()
    bowl(6.9,0)
    cyl("Arena foundation",(0,-1.17,0),13,.4,dark)
    for row in range(4):
        r=9+row*.85
        y=-.3+row*.57
        for i in range(25):
            a=math.pi+ i*math.pi/24
            x,z=math.cos(a)*r,math.sin(a)*r
            o=box("Tiered seat",(x,y,z),(.72,.19,.65),steel,.04)
            o.rotation_euler.z=-a-math.pi/2
            o=box("Seat back",(x,y+.31,z-.18),(.7,.49,.10),dark,.03)
            o.rotation_euler.z=-a-math.pi/2
    for i in range(9):
        a=math.pi+i*math.pi/8
        x,z=math.cos(a)*10.8,math.sin(a)*10.8
        box("Industrial tower",(x,2,z),(.65,6,.72),dark,.08)
        box("Tower face",(x,2.5,z+.4),(.45,2,.06),steel,.015)
        for y in [.3,1.2,3.8,4.3]:
            box("Tower luminaires",(x,y,z+.45),(.44,.1,.045),cyan,.01)
    box("Scoreboard housing",(0,3.5,-9.9),(6.1,3.25,.6),steel,.23)
    box("Scoreboard glass",(0,3.5,-9.56),(5.7,2.88,.05),dark,.16)
    for x in [-2.7,2.7]:
        box("Scoreboard border",(x,3.5,-9.51),(.04,2.55,.035),cyan,.008)
    for y in [2.18,4.82]:
        box("Scoreboard border",(0,y,-9.51),(5.4,.04,.035),cyan,.008)
    engraving("SPIN / CORE",(0,3.55,-9.50),.66,cyan)
    engraving("CHAMPIONSHIP ARENA",(0,2.85,-9.50),.21,steel)
    for i in range(16):
        a=i*math.tau/16
        o=box("Deck radial panel",(math.cos(a)*8.05,-.85,math.sin(a)*8.05),(1.45,.19,.64),steel,.04)
        o.rotation_euler.z=-a
    export("championship")


def toy(p,scale=1,color=None):
    x,y,z=p
    cyl("Spare top ring",(x,y+.12*scale,z),.28*scale,.10*scale,color or blue,24)
    cyl("Spare top metal",(x,y+.06*scale,z),.21*scale,.07*scale,steel,24)
    cyl("Spare top core",(x,y+.2*scale,z),.1*scale,.05*scale,cream,20)


def launcher(p,s=1):
    x,y,z=p
    box("Launcher",(x,y,z),(.66*s,.18*s,.43*s),red,.04*s)
    box("Launcher grip",(x+.42*s,y,z),(.30*s,.13*s,.19*s),dark,.03*s)
    for i in range(6):
        box("Launcher ribs",(x-.22*s+i*.08*s,y+.105*s,z),(.025*s,.025*s,.33*s),dark,.003)
    cyl("Launcher socket",(x,y+.13*s,z),.14*s,.07*s,steel,24)


def case(p,s=1):
    x,y,z=p
    box("Stickered equipment case",(x,y,z),(1.3*s,.85*s,.7*s),cream,.05*s)
    for dx in [-.57,.57]:
        box("Case trim",(x+dx*s,y,z+.37*s),(.07*s,.85*s,.025*s),steel,.01)
    rod("Case handle",(x-.22*s,y+.55*s,z),(x+.22*s,y+.55*s,z),.045*s,dark)
    for i in range(7):
        o=box("Original sticker",(x+random.uniform(-.45,.45)*s,y+random.uniform(-.3,.3)*s,z+.361*s),(.24*s,.15*s,.004),[blue,red,gold,green][i%4],.002)
        o.rotation_euler.y=random.uniform(-.25,.25)


def desk():
    reset()
    # The specimen/monitor anchors stay identical to the incumbent lab.
    box("Oak workbench",(0,.05,.2),(7,.28,5.7),wood,.065)
    for i in range(18):
        box("Oak grain",(-3.2+i*.37,.194,.2),(.008,.004,5.5),gold,0)
    box("Green cutting mat",(0,.21,.35),(4.65,.025,3.8),green,.03)
    grid=mat("Mat grid",(.26,.47,.35),0,.9)
    for i in range(24):
        x=-2.2+i*.19
        box("Mat grid",(x,.225,.35),(.005,.002,3.6),grid,0)
    for i in range(19):
        box("Mat grid",(0,.225,-1.35+i*.19),(4.4,.002,.005),grid,0)
    # Small toy dish at the lab's existing contact height .47.
    cyl("Toy dish",(0,.40,0),1.14,.12,cream)
    ring("Toy bowl rim",(0,.49,0),1.24,1.1,.18,cream)
    for r in [.31,.66,.98]:
        ring("Toy target",(0,.468,0),r+.008,r-.008,.006,blue)
    for x in [-1,1]:
        box("Toy blue clip",(x*1.16,.55,0),(.20,.16,.20),blue,.025)
    box("Red target",(0,.474,0),(1.75,.004,.014),red,.001)
    box("Whiteboard frame",(0,3.06,-.73),(2.65,1.44,.15),steel,.065)
    box("Whiteboard",(0,3.06,-.64),(2.47,1.26,.05),cream,.025)
    for x in [-1.1,1.1]:
        rod("Board stand",(x,.2,-.84),(x,3.8,-.84),.035,steel)
        cyl("Board magnet",(x,3.6,-.59),.045,.025,red,16).rotation_euler.x=math.pi/2
    wall=mat("Warm plaster",(.68,.65,.54),0,.95)
    box("Room wall",(0,3,-3.1),(8,6,.16),wall,.01)
    sky=mat("Window daylight",(.46,.74,.86),0,.9,.65)
    box("Sunlit window",(-2.3,3.2,-2.98),(2.55,3.95,.06),sky,.01)
    for x in [-3.59,-2.3,-1.01]:
        box("Window frame",(x,3.2,-2.87),(.075,4.1,.12),cream,.01)
    for y in [1.15,3.2,5.25]:
        box("Window frame",(-2.3,y,-2.87),(2.65,.075,.12),cream,.01)
    # Tree silhouettes are modeled outside the glazing.
    foliage=mat("Garden leaves",(.21,.44,.17),0,1)
    for i in range(14):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=random.uniform(.2,.43),
            location=xyz((-3.3+random.random()*2,1.4+random.random(),-2.90)))
        finish(bpy.context.object,"Garden foliage",foliage,0)
    for y in [1.3,2.6,3.9]:
        box("Shelf",(2.9,y,-2.4),(1.9,.1,1),wood,.03)
        for i in range(4):
            box("Toy kit box",(2.25+i*.41,y+.27,-2.3),(.34,.44,.55),[blue,red,cream,green][i],.015)
    for i in range(3):
        x=-.1+i*.69
        box("Original tournament poster",(x,4.7,-2.97),(.61,1.13,.022),[blue,red,green][i],0)
        engraving(["SPIN","BUILD","WIN"][i],(x,4.82,-2.945),.14,cream)
    cyl("Lamp base",(-2.22,.30,.25),.43,.12,blue)
    rod("Lamp lower arm",(-2.22,.35,.25),(-2.65,1.25,-.1),.042,steel)
    rod("Lamp upper arm",(-2.65,1.25,-.1),(-1.86,2.08,-.05),.042,blue)
    bpy.ops.mesh.primitive_cone_add(vertices=40,radius1=.38,radius2=.17,depth=.45,location=xyz((-1.83,1.97,.02)))
    finish(bpy.context.object,"Blue lamp shade",blue,.015)
    cyl("Lamp warm lens",(-1.83,1.74,.02),.32,.015,mat("Task lamp",(.98,.8,.39),0,.3,3))
    cyl("Pencil pot",(-1.87,.45,-1.17),.16,.44,green,32)
    for i in range(7):
        rod("Pencil",(-1.98+i*.036,.4,-1.17),(-2.07+i*.055,1.1+(i%2)*.12,-1.14),.017,[gold,red,blue][i%3])
    case((-2.44,.58,1.57),.7)
    launcher((1.83,.36,.92),.9)
    for i in range(3):
        toy((1.62+i*.40,.24,-.8),.65,[blue,red,green][i])
    box("Open notebook",(1.56,.28,1.94),(1.48,.07,.88),cream,.02)
    for i in range(9):
        box("Notebook ruling",(1.56,.322,1.63+i*.071),(1.23,.002,.003),blue,0)
    rod("Notebook pen",(1.18,.35,1.8),(1.9,.35,2),.027,blue)
    for x in [-1.5,1.5]:
        box("Sticky note",(x,3.13,-.62),(.26,.31,.008),gold,.004)
    export("childhood_lab")


def street():
    reset()
    asphalt=mat("Worn asphalt",(.15,.15,.13),0,.97)
    brick=mat("Terracotta brick",(.29,.13,.07),0,.9)
    mortar=mat("Mortar",(.25,.26,.22),0,1)
    box("Alley pavement",(0,-1.14,0),(34,.4,44),asphalt,.01)
    bowl(6.7,0,True)
    box("Brick wall",(10,3,-6),(.4,8,30),mortar,.02)
    for row in range(12):
        for i in range(22):
            box("Individual brick",(9.76,-.75+row*.64,-20+i*1.34+(row%2)*.67),(.16,.57,1.25),brick,.015)
    # Original broad paint marks, authored as geometry on the wall.
    for i in range(30):
        z=-13+random.random()*22
        y=.2+random.random()*4
        rod("Graffiti stroke",(9.65,y,z),(9.65,y+.9,z+.5),.095,[blue,cream,red,gold][i%4])
    for i in range(60):
        x,z=random.uniform(-13,9),random.uniform(-17,12)
        if math.hypot(x,z)<7.4:
            continue
        rod("Pavement seam",(x,-.934,z),(x+.4,-.933,z+.9),.009,mortar)
    leafmats=[mat("Autumn ochre",(.61,.31,.055),0,1),mat("Autumn copper",(.37,.12,.025),0,1)]
    for i in range(170):
        x,z=random.uniform(-13,9),random.uniform(-18,10)
        if math.hypot(x,z)<7.4:
            continue
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=xyz((x,-.91,z)))
        o=bpy.context.object
        o.scale=(.14,.23,.014)
        o.rotation_euler.z=random.random()*math.tau
        finish(o,"Fallen leaf",leafmats[i%2],0)
    case((-8.4,.45,-4.8),2.1)
    box("Blue parts crate",(7.8,-.14,-4),(2.35,1.6,1.8),blue,.08)
    box("Crate inset",(7.8,.68,-4),(2.06,.04,1.52),dark,.02)
    for i in range(4):
        toy((7.2+(i%2)*1.05,.71,-4.4+(i//2)*.75),1.2,[blue,red,gold,green][i])
    box("Backpack",(8.1,.9,-8.1),(1.8,3.15,1.1),red,.35)
    box("Backpack front pocket",(8.1,.4,-7.45),(1.44,1.38,.35),dark,.18)
    for x in [7.5,8.7]:
        rod("Backpack strap",(x,-.7,-7.4),(x,2.4,-7.7),.065,dark)
    cyl("Drink bottle",(-7.5,-.12,-1.8),.29,1.5,blue)
    cyl("Bottle cap",(-7.5,.68,-1.8),.18,.18,red)
    launcher((6.7,-.73,6.5),2.2)
    for i in range(3):
        toy((-7.6+i*.7,-.87,3.6+i),1.2,[blue,gold,red][i])
    for x in [-12,12]:
        box("Distant building",(x,7,-20),(5,16,5),stone,.1)
    facade=mat("Old alley plaster",(.34,.29,.20),0,.96)
    for side in [-1,1]:
        for depth in [-17,-24,-31]:
            box("Alley facade",(side*10,4,depth),(2.5,10,5.8),facade,.08)
            for y in [1.5,4.4,7.3]:
                for dz in [-1.5,1.5]:
                    box("Recessed alley window",(side*8.69,y,depth+dz),(.04,1.7,1.1),dark,.035)
                    box("Window sill",(side*8.59,y-.86,depth+dz),(.30,.10,1.25),cream,.02)
    for x,z in [(-8.6,-12.8),(-8.6,-22)]:
        rod("Autumn tree trunk",(x,-.9,z),(x+.2,5.7,z),.23,wood)
        for i in range(6):
            a=i*math.tau/6
            end=(x+math.cos(a)*1.8,5+random.random()*2,z+math.sin(a)*1.5)
            rod("Autumn branch",(x,3.8,z),end,.075,wood)
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1.45,location=xyz(end))
            finish(bpy.context.object,"Autumn tree crown",leafmats[i%2],0)
    for z in [-13,-23]:
        rod("Alley light post",(-7.8,-1,z),(-7.8,5.9,z),.10,dark)
        rod("Lamp arm",(-7.8,5.9,z),(-6.6,5.9,z),.07,dark)
        box("Alley lamp",(-6.6,5.8,z),(.65,.14,.45),gold,.05)
    export("street")


def ruins():
    reset()
    box("Floating platform",(0,-1.15,0),(16.8,1.45,16.8),stone,.48)
    trim=mat("Ancient bronze",(.25,.25,.17),.55,.55)
    slabmats=[mat("Slate "+str(i),(.12+i*.009,.16+i*.01,.22+i*.012),.05,.9) for i in range(5)]
    for ix in range(12):
        for iz in range(12):
            x,z=(ix-5.5)*1.33,(iz-5.5)*1.33
            box("Paving slab",(x,-.42,z),(1.30,.16,1.30),slabmats[(ix*3+iz)%5],.045)
            if (ix+iz)%5==0:
                rod("Cracked slate",(x-.42,-.333,z-.5),(x+.13,-.332,z+.4),.009,dark)
    for r in [1.15,1.48,2.13,6.95]:
        ring("Floor sigil",(0,-.325,0),r+.018,r-.018,.012,cyan if r<2 else trim)
    for a in [0,math.pi/2,math.pi,math.pi*1.5]:
        for i in range(4):
            r=3.7+i*.8
            o=box("Path rune",(math.cos(a)*r,-.323,math.sin(a)*r),(.25,.01,.25),cyan,.01)
            o.rotation_euler.z=math.pi/4
    for b in BLOCKERS:
        x,z=b["x"],b["z"]
        box("Solid battle blocker",(x,.2,z),(b["hx"]*2,1.06,b["hz"]*2),stone,.09)
        box("Blocker cap",(x,.75,z),(1.7,.12,.8),trim,.035)
        box("Blocker sigil",(x,.33,z+.411),(.35,.17,.02),cyan,.005)
    for i in range(7):
        for side in [-1,1]:
            z=-6.8+i*2.25
            box("Edge balustrade",(side*7.75,.13,z),(.23,.87,1.92),stone,.04)
            box("Edge balustrade",(z,.13,side*7.75),(1.92,.87,.23),stone,.04)
    for x in [-6.7,6.7]:
        for z in [-6.7,-2.4,2.4,6.7]:
            h=2.0 if z>0 else 3.3
            box("Column footing",(x,-.06,z),(.9,.5,.9),trim,.08)
            broken=abs(z)<3
            if broken:
                corners=[(-.26,-.26),(.26,-.26),(.26,.26),(-.26,.26)]
                vertices=[xyz((x+dx,0,z+dz)) for dx,dz in corners]
                vertices.extend(xyz((x+dx,h+offset,z+dz))
                    for (dx,dz),offset in zip(corners,[-.42,.02,-.18,-.65]))
                mesh=bpy.data.meshes.new("Fractured shaft")
                mesh.from_pydata(vertices,[],[(0,1,2,3),(7,6,5),(7,5,4),
                    (0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)])
                mesh.update()
                obj=bpy.data.objects.new("Jagged broken pillar",mesh)
                bpy.context.collection.objects.link(obj)
                finish(obj,"Jagged broken pillar",stone,.012)
                rod("Fracture fissure",(x-.1,h-.4,z+.267),(x+.1,h-1.1,z+.267),.014,dark)
            else:
                box("Intact column",(x,h/2,z),(.52,h,.52),stone,.07)
            for y in ([.55] if broken else [.55,h-.2]):
                box("Column collar",(x,y,z),(.70,.18,.70),trim,.025)
            if not broken:
                bpy.ops.mesh.primitive_cone_add(vertices=5,radius1=.24,radius2=0,depth=.95,location=xyz((x,h+.48,z)))
                finish(bpy.context.object,"Violet crystal",purple,0)
    for i in range(5):
        box("Temple stair",(0,-.15+i*.18,-7.5-i*.44),(4.3,.2,.5),stone,.03)
    for x in [-1.85,1.85]:
        box("Temple portal pier",(x,2,-9.25),(.7,4.5,.7),stone,.07)
        box("Portal gold inset",(x,2,-8.87),(.1,3.7,.03),trim,.01)
    box("Portal lintel",(0,4.2,-9.25),(4.7,.5,1.2),stone,.08)
    box("Portal violet core",(0,2.1,-9.30),(1.17,3.0,.10),purple,.12)
    for y,w in [(4.6,5.9),(5.35,4.5)]:
        # Layered swept eaves, individually editable tiles.
        for i in range(19):
            x=(i-9)*w/19
            box("Temple roof tile",(x,y+(abs(x)/(w/2))**3*.42,-9.25),(.28,.14,1.85),dark,.025)
        for side in [-1,1]:
            rod("Raised eave",(side*w/2,y+.38,-9.25),(side*(w/2+.25),y+.75,-9.25),.09,trim)
    for i in range(12):
        a=i*math.tau/12
        r=14+random.random()*10
        x,z=math.cos(a)*r,math.sin(a)*r-3
        y=-3+random.random()*4
        bpy.ops.mesh.primitive_cone_add(vertices=7,radius1=.12,radius2=1.2+random.random(),depth=4,location=xyz((x,y-2,z)))
        finish(bpy.context.object,"Distant floating island",stone,0)
        cyl("Island crown",(x,y,z),1.4,.3,stone,7)
        rod("Island tree",(x,y,z),(x+.2,y+1.4,z),.11,wood)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.8,location=xyz((x+.2,y+1.6,z)))
        finish(bpy.context.object,"Island canopy",green,0)
    export("floating_ruins")


if __name__ == "__main__":
    sci_fi()
    desk()
    street()
    ruins()
    (OUT / "collision_manifest.json").write_text(json.dumps({
        "ruins": {"halfExtent":6.94,"ringOutExtent":8.25,"groundHeight":-.33,"blockers":BLOCKERS,"pillars":PILLARS}
    },indent=2),encoding="utf-8")
