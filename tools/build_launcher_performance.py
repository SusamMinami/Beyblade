"""Author nine interchangeable launcher cartridges and reusable inspection nodes.

Blender --background --python tools/build_launcher_performance.py -- --render
Web modular launcher assets. The original unsegmented launcher stays archived.
"""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import build_launcher as B
import split_launcher as S

OUT = ROOT / "resources/launcher/performance"
REVIEW = ROOT / "docs/assets/launcher-performance"
BLEND = ROOT / "tools/art_source/launcher_performance.blend"
PITCH = .046
MODULE = PITCH / math.pi
INPUT_TEETH = 36
INPUT_RADIUS = MODULE * INPUT_TEETH / 2
RACK_LINE = -.780
INPUT_Z = RACK_LINE + INPUT_RADIUS
DISTANCE = MODULE * 64 / 2
INPUT_X = math.sqrt(DISTANCE ** 2 - (INPUT_Z + .12) ** 2)
INPUT = (INPUT_X, .055, INPUT_Z)
OUTPUT = (0, .055, -.12)
MOUNTS = [(-.50, -.61), (.47, .32)]
SPECS = [
    dict(code="R01", slot="rack", name="循衡", family="均衡齿条",
         benefit="连续聚合物背梁，抽拉负担与刚性平衡", cost="轻快与高载刚性均不突出"),
    dict(code="R02", slot="rack", name="轻羽", family="轻快齿条",
         benefit="开窗骨架与窄筋，降低往复件惯量", cost="高载下的挠曲与储能回弹更明显"),
    dict(code="R03", slot="rack", name="刚脊", family="加强齿条",
         benefit="嵌入金属背脊，降低大拉力下的挠曲", cost="往复质量增加，快速起拉更费力"),
    dict(code="T01", slot="transmission", name="恒比", family="均衡芯组",
         drive=32, output=32, benefit="32 : 32，同速与扭矩平衡", cost="没有极端速转或省力优势"),
    dict(code="T02", slot="transmission", name="超越", family="增速芯组",
         drive=36, output=28, benefit="36 : 28，同抽速下输出转速更高", cost="同输出负载需更大拉力"),
    dict(code="T03", slot="transmission", name="厚积", family="扭矩芯组",
         drive=28, output=36, benefit="28 : 36，高惯量负载更容易带起", cost="同抽速下输出转速更低"),
    dict(code="C01", slot="coupler", name="直联", family="通用连接头",
         benefit="单支承与标准三爪，导向和阻力平衡", cost="极限快脱与抗倾覆支承均不突出"),
    dict(code="C02", slot="coupler", name="瞬脱", family="快脱连接头",
         benefit="短导向裙与开窗转子，减少退出接触", cost="对轴线偏斜的约束行程更短"),
    dict(code="C03", slot="coupler", name="定轴", family="稳轴连接头",
         benefit="双支承与连续导向裙，提高支承跨度", cost="多一组支承与密封，拖曳和惯量增加"),
]


def vector(p):
    return S.xyz(p)


def attach(obj, parent):
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_basis = parent.matrix_world.inverted() @ world


def empty(name, point, parent, **extras):
    obj = bpy.data.objects.new(name, None)
    B.PARTS.objects.link(obj)
    obj.location = vector(point)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = .06
    for key, value in extras.items():
        obj[key] = value
    if parent:
        attach(obj, parent)
    return obj


def group(root, label, point, displacement=(0, 0, 0), motion="fixed"):
    return empty(root["partCode"] + "_" + label, point, root,
                 inspectionGroup=label, detailExplode=list(displacement),
                 motionType=motion, motionAxis=[0, 1, 0] if motion == "rotation" else [1, 0, 0])


def collect_since(group_obj, before, surface):
    for obj in set(B.PARTS.objects) - before:
        if obj.type == "MESH":
            attach(obj, group_obj)
            obj["surfaceRole"] = surface
            obj["paintZone"] = "fixed"
            obj["slotId"] = group_obj.parent["slotId"]


def cut(obj, point, size=None, radius=None, height=1):
    if radius:
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=radius, depth=height,
                                            location=B.xyz(point))
    else:
        bpy.ops.mesh.primitive_cube_add(size=1, location=B.xyz(point))
        bpy.context.object.dimensions = (size[0], size[2], size[1])
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    cutter = bpy.context.object
    bpy.context.view_layer.objects.active = obj
    modifier = obj.modifiers.new("Service interface cut", "BOOLEAN")
    modifier.operation, modifier.solver, modifier.object = "DIFFERENCE", "EXACT", cutter
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def rod(name, a, b, radius, mat):
    midpoint = tuple((x+y)/2 for x, y in zip(a, b))
    direction = vector(b) - vector(a)
    obj = B.cylinder(name, midpoint, radius, direction.length, mat, 16, .002)
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    return obj


def annulus(name, x, y, z, outer, inner, h, mat, sides=48):
    return B.ring(name, (x, y, z), outer, inner, h, mat, sides, .002)


def radial_bar(name, center, angle, r1, r2, width, height, mat):
    x, y, z = center
    radius = (r1+r2)/2
    obj = B.box(name, (x+math.cos(angle)*radius, y, z+math.sin(angle)*radius),
                (r2-r1, height, width), mat, .004)
    obj.rotation_euler.z = -angle
    return obj


def gear(name, center, teeth, phase, mat, open_web=False, hub_height=.068):
    x, y, z = center
    radius = MODULE * teeth / 2
    outside, inside = [], []
    inner_r = radius*.61 if open_web else .078
    for tooth in range(teeth):
        for fraction, r in [(-.5, radius-1.25*MODULE), (-.23, radius+MODULE),
                             (.23, radius+MODULE), (.5, radius-1.25*MODULE)]:
            angle = phase+(tooth+fraction)*math.tau/teeth
            outside.append((x+math.cos(angle)*r, z+math.sin(angle)*r))
            inside.append((x+math.cos(angle)*inner_r, z+math.sin(angle)*inner_r))
    obj = B.frame(name, outside, inside, y, .045, mat, .0014)
    obj["teeth"], obj["pitchRadius"], obj["visualModule"] = teeth, radius, MODULE
    obj["profileStatus"] = "Simplified trapezoid. Pitch geometry checked; not an involute/contact simulation."
    if open_web:
        for i in range(6):
            radial_bar(name+" web spoke", center, phase+i*math.tau/6, .07, inner_r+.008,
                       .024, .030, mat)
    annulus(name+" hub", x, y, z, .104, .046, hub_height, STEEL, 32)
    if not open_web:
        annulus(name+" recessed web", x, y+.024, z, radius*.66, .112, .004, DARK, 36)
    return obj


def bearing(name, x, y, z, outer=.096, inner=.050, balls=False):
    annulus(name+" outer race", x,y,z,outer,outer-.016,.027,STEEL,32)
    annulus(name+" inner race", x,y,z,inner+.012,inner,.028,STEEL,32)
    if balls:
        for i in range(10):
            a = i*math.tau/10
            r = (outer+inner)/2
            bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=.011,
                location=B.xyz((x+math.cos(a)*r,y,z+math.sin(a)*r)))
            B.finish(bpy.context.object,name+" ball",STEEL,0)
    else:
        annulus(name+" seal",x,y+.014,z,outer-.017,inner+.013,.003,DARK,32)


def fastener(name, x, y, z, radius=.027):
    B.cylinder(name+" head",(x,y,z),radius,.014,STEEL,20,.002)
    B.box(name+" slot",(x,y+.008,z),(radius*1.3,.002,.008),DARK,.0005)


def rack(root, variant):
    accent = ACCENTS[variant]
    root["motionType"],root["motionAxis"]="translation",[1,0,0]
    body = group(root,"rack_body",(.875,.055,-.85),(0,0,0))
    before = set(B.PARTS.objects)
    if variant == 1:
        # Real through windows between two continuous rails, not painted recesses.
        for z in [-.890, -.810]:
            B.box("R02 continuous rail",(.715,.055,z),(2.27,.073,.025),DARK,.004)
        for i in range(16):
            B.box("R02 ladder cross rib",(-.38+i*.145,.055,-.85),(.031,.073,.085),STEEL,.003)
    else:
        B.box("Rack continuous carrier",(.715,.055,-.85),(2.27,.080,.105),DARK,.005)
    for i in range(49):
        x = -.38+i*PITCH
        B.slab("Rack working tooth",[(x-.019,RACK_LINE-1.25*MODULE),
               (x+.019,RACK_LINE-1.25*MODULE),(x+.009,RACK_LINE+MODULE),
               (x-.009,RACK_LINE+MODULE)],.055,.076,DARK,.0012)
    # Shared pin eye and neck fit the retained T handle.
    neck = B.box("Rack pin tongue",(1.918,.055,-.85),(.166,.076,.082),STEEL,.006)
    cut(neck,(1.95,.055,-.85),radius=.020,height=.20)
    for i in range(5):
        B.box("Stroke witness",(.95+i*.16,.097,-.876),(.018,.006,.017),accent,.001)
    collect_since(body,before,"rack_guide_and_teeth")
    spine = group(root,"backbone",(.875,.055,-.85),(0,.16,0))
    before = set(B.PARTS.objects)
    if variant == 2:
        B.box("R03 stainless load spine",(.715,.105,-.868),(2.20,.015,.027),STEEL,.002)
        for x in [-.31,.12,.55,.98,1.41,1.73]:
            fastener("Spine rivet",x,.119,-.868,.012)
    elif variant == 0:
        B.box("R01 polymer reinforcing bead",(.715,.105,-.870),(2.18,.016,.026),accent,.003)
    else:
        for i in range(7):
            B.box("R02 guide wear pad",(-.28+i*.31,.099,-.89),(.11,.009,.018),accent,.002)
    collect_since(spine,before,"backbone")
    pin = group(root,"service_pin",(1.95,.055,-.85),(0,.33,0))
    before = set(B.PARTS.objects)
    B.cylinder("Captive rack dowel",(1.95,.055,-.85),.017,.245,STEEL,20,.002)
    fastener("Rack dowel",1.95,.187,-.85,.030)
    collect_since(pin,before,"service_fastener")
    empty(root["partCode"]+"_RackGuide",(.875,.055,-.85),root,interfaceId="rack-guide-v1")
    empty(root["partCode"]+"_HandlePin",(1.95,.055,-.85),root,interfaceId="rack-pin-v1")


def transmission(root, variant):
    spec = SPECS[3+variant]
    accent = ACCENTS[variant]
    direction = math.atan2(-.12-INPUT_Z, -INPUT_X)
    tray = group(root,"tray",OUTPUT,(0,0,0))
    before = set(B.PARTS.objects)
    outer = [(-.49,-.80),(.49,-.80),(.62,-.65),(.62,.35),(.44,.53),
             (-.44,.53),(-.62,.35),(-.62,-.65)]
    plate = B.slab("Cassette base plate",outer,-.031,.026,DARK,.006)
    cut(plate,(0,-.031,-.12),radius=.118,height=.20)
    for x,z in MOUNTS:
        cut(plate,(x,-.031,z),radius=.082,height=.20)
    for x,z in [(INPUT_X,INPUT_Z),(0,-.12)]:
        annulus("Bearing support tower",x,.007,z,.109,.077,.05,DARK)
        bearing("Lower bearing",x,.031,z)
    annulus("Through pan output bearing carrier",0,-.155,-.12,.126,.103,.24,STEEL)
    # The fixed corner lands fit existing support bosses.
    for x,z in [(-.50,.27),(.49,-.69)]:
        B.cylinder("Cassette positioning land",(x,.005,z),.045,.035,accent,24,.003)
        fastener("Cassette captive fixing",x,.034,z,.024)
    B.marking(spec["code"]+" / "+str(spec["drive"])+":"+str(spec["output"]),
              (0,-.015,.41),.064,STEEL)
    collect_since(tray,before,"fixed_carrier")
    drive = group(root,"input_rotor",INPUT,(.12,.35,-.10),"rotation")
    before = set(B.PARTS.objects)
    gear("36T common rack pinion",(INPUT_X,.073,INPUT_Z),INPUT_TEETH,0,STEEL,variant==1,.038)
    gear(str(spec["drive"])+"T compound drive",(INPUT_X,.143,INPUT_Z),
         spec["drive"],direction,accent,variant==1)
    B.cylinder("Compound rotor journal",(INPUT_X,.102,INPUT_Z),.046,.244,STEEL,24,.001)
    collect_since(drive,before,"input_gear_working_faces")
    output = group(root,"output_rotor",OUTPUT,(-.13,.56,.09),"rotation")
    before = set(B.PARTS.objects)
    gear(str(spec["output"])+"T output gear",(0,.143,-.12),spec["output"],
         direction+math.pi+math.pi/spec["output"],accent,variant==1)
    B.cylinder("Output bearing journal",(0,-.030,-.12),.046,.466,STEEL,24,.001)
    B.slab("Hex drive shaft",[(.086*math.cos(i*math.tau/6),-.12+.086*math.sin(i*math.tau/6))
                              for i in range(6)],-.245,.075,STEEL,.002)
    collect_since(output,before,"output_gear_and_hex_drive")
    bridge = group(root,"bearing_bridge",OUTPUT,(0,.87,0))
    before = set(B.PARTS.objects)
    for x,z in [(INPUT_X,INPUT_Z),(0,-.12)]:
        annulus("Upper bearing seat",x,.198,z,.117,.097,.036,DARK,32)
        bearing("Upper bearing",x,.200,z,balls=True)
    rod("Cassette upper brace",(INPUT_X,.196,INPUT_Z),(0,.196,-.12),.025,STEEL)
    for i,(x,z) in enumerate([(-.50,.27),(.49,-.69)]):
        target = (0,.196,-.12) if i == 0 else (INPUT_X,.196,INPUT_Z)
        rod("Diagonal bearing brace",(x,.196,z),target,.019,STEEL)
        B.cylinder("Bridge support",(x,.098,z),.022,.198,STEEL,20,.002)
        fastener("Bridge screw",x,.206,z,.026)
    collect_since(bridge,before,"bearing_working_faces")
    spring = group(root,"return_spring",INPUT,(.12,1.06,-.10))
    before = set(B.PARTS.objects)
    # Ribbon has actual volume. Motion remains a design placeholder.
    verts, faces = [], []
    steps = 144
    for i in range(steps+1):
        angle = i/steps*math.tau*2.3
        radius = .050+i/steps*.037
        for y, offset in [(.213,-.003),(.213,.003),(.224,-.003),(.224,.003)]:
            verts.append((INPUT_X+math.cos(angle)*(radius+offset),y,
                          INPUT_Z+math.sin(angle)*(radius+offset)))
        if i:
            a,b = (i-1)*4,i*4
            faces.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),
                          (a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
    faces.extend([(0,1,3,2),(steps*4,steps*4+2,steps*4+3,steps*4+1)])
    B.mesh("Input return ribbon spring",verts,faces,STEEL,.0005)
    collect_since(spring,before,"return_spring_design")
    for name,point,key in [
        ("InputAxis",INPUT,"rack-pinion-v1"),
        ("OutputAxis",OUTPUT,"output-axis-v1"),
        ("DriveHex",(0,-.25,-.12),"hex-drive-v1")]:
        empty(root["partCode"]+"_"+name,point,root,interfaceId=key)
    root["gearRatio"] = spec["drive"]/spec["output"]
    root["gearRatioMeaning"] = "output speed / rack-pinion speed; not a battle multiplier"


def coupler(root, variant):
    accent = ACCENTS[variant]
    stator = group(root,"stationary_housing",(0,-.25,-.12),(0,.38,0))
    before = set(B.PARTS.objects)
    annulus("Coupler fixed mounting flange",0,-.268,-.12,.438,.212,.035,DARK)
    annulus("Coupler machined shoulder",0,-.302,-.12,.418,.263,.035,STEEL)
    skirt_height = [.075,.034,.109][variant]
    skirt_y = -.338
    annulus("Stationary alignment skirt",0,skirt_y,-.12,.389,.363,skirt_height,
            accent if variant!=1 else DARK)
    for i in range(12):
        angle=i*math.tau/12
        radial_bar("Housing grip rib",(0,-.285,-.12),angle,.423,.454,.021,.045,DARK)
    for i in range(3):
        a = math.tau*i/3+math.pi/6
        x,z = math.cos(a)*.32,-.12+math.sin(a)*.32
        for obj in [o for o in B.PARTS.objects if o.name.startswith("Coupler fixed mounting flange")]:
            cut(obj,(x,-.268,z),radius=.017,height=.15)
        fastener("Mount flange screw",x,-.238,z,.027)
    # Support ring is joined to the fixed flange by three narrow webs.
    for i in range(3):
        radial_bar("Bearing support web",(0,-.283,-.12),i*math.tau/3,
                   .185,.28,.045,.031,DARK)
    bearing("Coupler upper bearing",0,-.286,-.12,.208,.15,balls=True)
    if variant==2:
        bearing("Coupler second bearing",0,-.359,-.12,.208,.15,balls=True)
        for i in range(3):
            a=i*math.tau/3
            x,z=math.cos(a)*.226,-.12+math.sin(a)*.226
            B.cylinder("Double bearing support spacer",(x,-.321,z),.025,.078,STEEL,20,.003)
        annulus("Lower bearing carrier",0,-.359,-.12,.249,.208,.024,DARK)
    collect_since(stator,before,"fixed_support_and_bearing")
    rotor = group(root,"coupler_rotor",(0,-.36,-.12),(0,-.15,0),"rotation")
    before=set(B.PARTS.objects)
    # Matching six-flat socket has a visible through cavity and radial clearance.
    B.ring("Female hex drive socket",(0,-.265,-.12),.143,.093,.116,STEEL,6,.002)
    annulus("Rotor spindle",0,-.332,-.12,.149,.094,.080,STEEL)
    annulus("Three dog rotor rim",0,-.415,-.12,.358,.265,.052,accent)
    for i in range(3):
        angle=i*math.tau/3
        radial_bar("Rotor spoke",(0,-.388,-.12),angle,.132,.342,
                   .046 if variant==1 else .074,.029,STEEL)
    if variant==1:
        for i in range(3):
            a=i*math.tau/3+.19
            radial_bar("Relieved exit ramp",(0,-.438,-.12),a,.273,.347,.040,.018,STEEL)
    if variant==2:
        annulus("Extended rotor guide",0,-.391,-.12,.278,.265,.052,STEEL)
    collect_since(rotor,before,"rotating_socket_and_dogs")
    # Three independent radial dogs, driven by the axially sliding cam collar.
    # These remain children of the rotor, so rotation and release can coexist.
    for i in range(3):
        angle=i*math.tau/3
        x,z=math.cos(angle)*.30,-.12+math.sin(angle)*.30
        jaw=group(root,"release_jaw_"+str(i),(x,-.452,z),motion="translation")
        jaw["releaseVector"]=[math.cos(angle)*.095,0,math.sin(angle)*.095]
        before=set(B.PARTS.objects)
        dog=B.box("Sliding top locking dog",(x,-.452,z),(.15,.045,.095),accent,.007)
        dog.rotation_euler.z=-angle
        B.cylinder("Cam follower pin",(x,-.418,z),.017,.045,STEEL,16,.002)
        collect_since(jaw,before,"release_dog")
        attach(jaw,rotor)
    cam=group(root,"release_cam",(0,-.365,-.12),motion="translation")
    cam["releaseVector"]=[0,.07,0]
    before=set(B.PARTS.objects)
    annulus("Sliding cam collar",0,-.365,-.12,.362,.286,.032,STEEL)
    for i in range(3):
        radial_bar("Cam ramp",(0,-.389,-.12),i*math.tau/3,.294,.35,.037,.040,DARK)
    collect_since(cam,before,"release_cam")
    empty(root["partCode"]+"_DriveHex",(0,-.25,-.12),root,interfaceId="hex-drive-v1")
    empty(root["partCode"]+"_TopMount",(0,-.474,-.12),root,interfaceId="top-mount-stock")


def create_variants(roots, members):
    variants={}
    for spec in SPECS:
        slot,code=spec["slot"],spec["code"]
        B.PARTS=B.collection(code+" / "+spec["name"]+" / "+spec["family"])
        anchor=next(m["anchor"] for m in S.MODULES if m["id"]==slot)
        root=empty("Part_"+code,anchor,None,slotId=slot,partId="launcher."+slot+"."+code.lower(),
                   partCode=code,moduleLabel=spec["name"],status="web-runtime",
                   interfaceVersion="launcher-performance-v1")
        if slot=="rack":
            rack(root,int(code[-1])-1)
        elif slot=="transmission":
            transmission(root,int(code[-1])-1)
        else:
            coupler(root,int(code[-1])-1)
        variants[code]={"root":root,"collection":B.PARTS,"spec":spec}
    return variants


def adapt_common_parts(roots,members):
    # Candidate-only bore and actual rack passage. Existing art remains intact.
    for slot in ["rack","transmission","coupler"]:
        for obj in members[slot]:
            bpy.data.objects.remove(obj,do_unlink=True)
        members[slot]=[]
        roots[slot].hide_render=True
    housing=members["housing"]
    pan=next(o for o in housing if o.name=="Lower gearbox pan")
    cut(pan,(0,-.16,-.12),radius=.148,height=.6)
    for name in ["Ivory upper shell","Cobalt nose armour","Rack guide entrance","Rack guide trim"]:
        obj=next(o for o in housing if o.name==name)
        cut(obj,(.32,.065,-.835),size=(1.85,.150,.174))
    collar=next(o for o in members["pull_handle"] if o.name=="Pull handle collar")
    cut(collar,(1.93,.055,-.85),size=(.26,.084,.092))
    cut(collar,(1.95,.055,-.85),radius=.020,height=.4)
    # Threaded seats for the coupler stator flange; these stay with the housing.
    B.PARTS=roots["housing"].users_collection[0]
    before=set(B.PARTS.objects)
    for i in range(3):
        a=math.tau*i/3+math.pi/6
        x,z=math.cos(a)*.32,-.12+math.sin(a)*.32
        annulus("Coupler chassis threaded seat",x,-.239,z,.039,.017,.045,STEEL,24)
    for obj in set(B.PARTS.objects)-before:
        attach(obj,roots["housing"])
        obj["paintZone"]="fixed"
        obj["slotId"]="housing"
        members["housing"].append(obj)
    # A fork carries the external release lever's motion to the cam collar.
    B.PARTS=roots["release"].users_collection[0]
    fork=empty("Release_lifting_fork",(.34,-.31,-.12),roots["release"],
               inspectionGroup="release_fork",releaseVector=[0,.07,0],motionType="translation")
    before=set(B.PARTS.objects)
    rod("Release pushrod",(.62,.08,.03),(.34,-.31,.03),.021,STEEL)
    rod("Release fork front",(.34,-.31,.03),(.12,-.365,.19),.019,STEEL)
    rod("Release fork rear",(.34,-.31,-.27),(.12,-.365,-.43),.019,STEEL)
    collect_since(fork,before,"release_linkage")


def set_variant_visibility(variants,codes):
    for code,entry in variants.items():
        for obj in entry["collection"].objects:
            obj.hide_render=code not in codes
            obj.hide_set(code not in codes)


def export_asset(path, source_roots, animated=False):
    """Batch only within the same articulation + material + surface role."""
    scene=bpy.context.scene
    scene.frame_set(1)
    deps=bpy.context.evaluated_depsgraph_get()
    export=B.collection("99 / temporary export")
    mapping={}
    descendants=[]
    def walk(root):
        descendants.append(root)
        for child in root.children:
            walk(child)
    for root in source_roots:
        walk(root)
    for obj in descendants:
        if obj.type!="MESH":
            duplicate=obj.copy()
            duplicate.animation_data_clear()
            export.objects.link(duplicate)
            duplicate.hide_render=False
            duplicate.hide_set(False)
            duplicate.name="Export_"+obj.name
            duplicate.matrix_world=obj.matrix_world.copy()
            mapping[obj]=duplicate
    bpy.context.view_layer.update()
    for src,dst in mapping.items():
        if src.parent in mapping:
            attach(dst,mapping[src.parent])
    batches={}
    for obj in descendants:
        if obj.type!="MESH":
            continue
        mesh=bpy.data.meshes.new_from_object(obj.evaluated_get(deps))
        dst=bpy.data.objects.new(obj.name,mesh)
        export.objects.link(dst)
        dst.matrix_world=obj.matrix_world.copy()
        parent=mapping[obj.parent]
        attach(dst,parent)
        surface=obj.get("surfaceRole","module_surface")
        key=(parent,mesh.materials[0],obj.get("paintZone","fixed"),surface)
        batches.setdefault(key,[]).append(dst)
    triangles=0
    for (parent,mat,paint,surface),batch in batches.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in batch:
            obj.select_set(True)
        bpy.context.view_layer.objects.active=batch[0]
        if len(batch)>1:
            bpy.ops.object.join()
        obj=batch[0]
        obj.name=parent.name+"__"+mat.name+"__"+surface
        obj["paintZone"],obj["surfaceRole"]=paint,surface
        obj.data.calc_loop_triangles()
        triangles+=len(obj.data.loop_triangles)
    if animated:
        for src in source_roots:
            dst=mapping[src]
            slot=src["slotId"]
            delta=next(m["explode"] for m in S.MODULES if m["id"]==slot)
            dst.keyframe_insert(data_path="location",frame=1)
            dst.location+=vector(delta)
            dst.keyframe_insert(data_path="location",frame=60)
            dst.animation_data.action.name="Launcher_Explode_"+slot
        scene.frame_set(1)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in export.objects:
        obj.select_set(True)
    old_scene_name=scene.name
    if animated:
        scene.name="Launcher_Explode"
    bpy.ops.export_scene.gltf(filepath=str(path),export_format="GLB",use_selection=True,
        export_yup=True,export_extras=True,export_animations=animated,
        export_animation_mode="SCENE",export_anim_scene_split_object=False,
        export_anim_slide_to_zero=True,export_force_sampling=True,
        export_cameras=False,export_lights=False)
    scene.name=old_scene_name
    report=dict(meshes=len(batches),triangles=triangles,bytes=path.stat().st_size)
    for obj in list(export.objects):
        bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.collections.remove(export)
    return report


def camera_at(target,offset,scale):
    camera=bpy.context.scene.camera
    camera.animation_data_clear()
    camera.data.animation_data_clear()
    camera.location=vector(tuple(a+b for a,b in zip(target,offset)))
    camera.rotation_euler=(vector(target)-camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.ortho_scale=scale
    bpy.context.view_layer.update()


def render_image(name,width=1100,height=820):
    scene=bpy.context.scene
    scene.render.resolution_x,scene.render.resolution_y=width,height
    scene.render.filepath=str(REVIEW/(name+".png"))
    bpy.ops.render.render(write_still=True)


def projections(objects):
    scene=bpy.context.scene
    deps=bpy.context.evaluated_depsgraph_get()
    points=[world_to_camera_view(scene,scene.camera,p) for obj in objects if obj.type=="MESH"
            for p in S.evaluated_bounds(obj,deps)]
    return [min(p.x for p in points),1-max(p.y for p in points),
            max(p.x for p in points),1-min(p.y for p in points)]


def render_reviews(roots,members,variants,materials):
    scene=bpy.context.scene
    scene.frame_set(1)
    scene.cycles.samples=24
    floor=bpy.data.objects["Studio ground"]
    floor.animation_data_clear()
    floor.location.z=-.72
    for slot,objs in members.items():
        for obj in objs:
            obj.hide_render=True
    for code,entry in variants.items():
        set_variant_visibility(variants,[code])
        slot=entry["spec"]["slot"]
        if slot=="rack":
            camera_at((.77,.05,-.85),(1.2,5,4.2),2.95)
            render_image(code,1100,540)
        elif slot=="transmission":
            camera_at((0,.035,-.12),(2.1,5.2,4.0),1.95)
            render_image(code,900,850)
        else:
            camera_at((0,-.33,-.12),(2.6,-3.7,4.2),1.20)
            # The underside view needs a light below the object; hide the floor.
            floor.hide_render=True
            render_image(code,900,850)
            floor.hide_render=False
    set_variant_visibility(variants,["R01","T02","C03"])
    for slot,objs in members.items():
        for obj in objs:
            obj.hide_render=False
    for code in ["R01","T02","C03"]:
        root=variants[code]["root"]
        slot=root["slotId"]
        root.location+=vector(next(m["explode"] for m in S.MODULES if m["id"]==slot))
    scene.frame_set(60)
    floor.location.z=-1.85
    camera_at((1,.8,.5),(5.8,8.1,12),10.5)
    render_image("exploded",1900,1450)
    projection={}
    for m in S.MODULES:
        objects=members[m["id"]]
        if m["id"] in ["rack","transmission","coupler"]:
            code=dict(rack="R01",transmission="T02",coupler="C03")[m["id"]]
            objects=list(variants[code]["collection"].objects)
        projection[m["id"]]=projections(objects)
    (REVIEW/"projection.json").write_text(json.dumps(projection,indent=2)+"\n",encoding="utf-8")
    scene.frame_set(1)
    for code in ["R01","T02","C03"]:
        root=variants[code]["root"]
        root.location=vector(next(m["anchor"] for m in S.MODULES if m["id"]==root["slotId"]))
    floor.location.z=-.72
    camera_at((.50,0,.38),(4.7,6.5,7.5),5.25)
    # Hide only the service cover for a readable installed-parts preview.
    for obj in members["cover"]:
        obj.hide_render=True
    S.set_palette(materials,"red_black")
    render_image("installed-red",1400,1100)
    S.set_palette(materials,"blue_white")
    for objs in members.values():
        for obj in objs:
            obj.hide_render=True
    set_variant_visibility(variants,["T02"])
    detail=variants["T02"]["root"]
    for obj in detail.children:
        if obj.get("inspectionGroup"):
            obj.location+=vector(obj["detailExplode"])
    floor.location.z=-.52
    camera_at((0,.42,-.12),(2.1,3.2,5),2.85)
    render_image("transmission-detail",1600,1500)
    detail_projection={o["inspectionGroup"]:projections(list(o.children)) for o in detail.children
                       if o.get("inspectionGroup")}
    (REVIEW/"detail-projection.json").write_text(json.dumps(detail_projection,indent=2)+"\n",encoding="utf-8")
    for obj in detail.children:
        if obj.get("inspectionGroup"):
            obj.location-=vector(obj["detailExplode"])


def main():
    for folder in [OUT,REVIEW]:
        folder.mkdir(parents=True,exist_ok=True)
    if "--export-assembly" in sys.argv:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        manifest=json.loads((OUT/"parts.json").read_text(encoding="utf-8"))
        source_roots=[bpy.data.objects["Module_"+slot] for slot in
                      ["housing","cover","grip","pull_handle","release"]]
        source_roots += [bpy.data.objects["Part_"+code] for code in manifest["assembly"]["parts"]]
        manifest["assembly"]["runtime"]=export_asset(OUT/manifest["assembly"]["file"],source_roots,True)
        (OUT/"parts.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        print("PERFORMANCE_ASSEMBLY_EXPORTED",flush=True)
        return
    roots,members,materials,old_manifest=S.split()
    global STEEL,DARK,ACCENTS
    STEEL=bpy.data.materials["Launcher_Brushed_Steel"]
    DARK=bpy.data.materials["Launcher_Graphite_POM"]
    ACCENTS=[
        B.material("Performance_Blue_Anodized",(53,111,147),.28,.55),
        B.material("Performance_Copper_Anodized",(190,104,56),.27,.62),
        B.material("Performance_Teal_Anodized",(59,126,118),.31,.58),
    ]
    adapt_common_parts(roots,members)
    variants=create_variants(roots,members)
    # Improve underside product lighting without changing any game material.
    studio=bpy.data.collections.get("90 / Studio (not exported)")
    lamp=bpy.data.lights.new("Coupler underside fill","AREA")
    lamp.energy,lamp.shape,lamp.size=220,"DISK",3
    lamp_obj=bpy.data.objects.new(lamp.name,lamp)
    studio.objects.link(lamp_obj)
    lamp_obj.location=vector((1,-3,2))
    lamp_obj.rotation_euler=(-lamp_obj.location).to_track_quat("-Z","Y").to_euler()
    manifest=dict(schemaVersion=1,status="web-runtime",units="Web visual units",
        source="tools/art_source/launcher_performance.blend",topMount=[0,-.474,-.12],
        interfaceVersion="launcher-performance-v1",
        geometry=dict(rackPitch=PITCH,gearModule=MODULE,rackPitchLine=RACK_LINE,
                      inputAxis=list(INPUT),outputAxis=list(OUTPUT),inputTeeth=INPUT_TEETH,
                      compoundCenterDistance=DISTANCE,pairTeethSum=64,
                      driveMaleHexRadius=.086,driveFemaleHexRadius=.093,
                      handlePin=[1.95,.055,-.85],pinRadius=.017,pinHoleRadius=.020),
        inspection=dict(fps=24,assemblyFrame=1,explodedFrame=60,
            moduleExplode={m["id"]:m["explode"] for m in S.MODULES},
            detailDisplacementSpace="parent local Web axes; add to assembled transform",
            motionStatus="Web kinematic rack, compound gears, lifting fork, cam and radial dogs"),
        parts=[])
    set_variant_visibility(variants,list(variants))
    for code,entry in variants.items():
        root=entry["root"]
        source_meshes=[o for o in entry["collection"].objects if o.type=="MESH"]
        groups=[dict(node="Export_"+o.name,id=o["inspectionGroup"],
                     pivot=[o.location.x,o.location.z,-o.location.y],
                     explode=list(o["detailExplode"]),motion=o["motionType"])
                for o in root.children_recursive if o.get("inspectionGroup")]
        stat=export_asset(OUT/(code.lower()+".glb"),[root])
        manifest["parts"].append(dict(**entry["spec"],partId=root["partId"],
            file=code.lower()+".glb",anchor=next(m["anchor"] for m in S.MODULES if m["id"]==root["slotId"]),
            sourceMeshes=len(source_meshes),runtime=stat,inspectionGroups=groups,
            ratio=root.get("gearRatio",None)))
    active_roots=[r for s,r in roots.items() if s not in ["rack","transmission","coupler"]]
    active_roots += [variants[c]["root"] for c in ["R01","T01","C01"]]
    manifest["assembly"]=dict(parts=["R01","T01","C01"],file="launcher-performance.glb",
        runtime=export_asset(OUT/"launcher-performance.glb",active_roots,True))
    # Save an immediately useful assembly scene plus a catalog of all nine parts.
    scene=bpy.context.scene
    scene.name="Launcher assembly R01 T01 C01"
    scene.frame_set(1)
    for code,entry in variants.items():
        root=entry["root"]
        slot=root["slotId"]
        root.keyframe_insert(data_path="location",frame=1)
        root.location+=vector(next(m["explode"] for m in S.MODULES if m["id"]==slot))
        root.keyframe_insert(data_path="location",frame=60)
    scene.frame_set(1)
    # Camera and floor follow the same inspection as the previous modular file.
    camera=scene.camera
    floor=bpy.data.objects["Studio ground"]
    for obj,paths in [(camera,["location","rotation_euler"]),(floor,["location"])]:
        for path in paths:
            obj.keyframe_insert(data_path=path,frame=1)
    camera.data.keyframe_insert(data_path="ortho_scale",frame=1)
    scene.frame_set(60)
    camera.location=vector((6.8,8.9,12.5))
    camera.rotation_euler=(vector((1,.8,.5))-camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.ortho_scale=10.5
    floor.location.z=-1.85
    for obj,paths in [(camera,["location","rotation_euler"]),(floor,["location"])]:
        for path in paths:
            obj.keyframe_insert(data_path=path,frame=60)
    camera.data.keyframe_insert(data_path="ortho_scale",frame=60)
    scene.frame_set(1)
    # Inactive variants are excluded only from the assembly view layer.
    for code,entry in variants.items():
        bpy.context.view_layer.layer_collection.children[entry["collection"].name].exclude=code not in ["R01","T01","C01"]
    scene["status"]="Nine Web runtime parts. Frame 1 assembled; frame 60 exploded. Release nodes driven by runtime."
    scene["variantHelp"]="Enable one R, T, C collection in the view layer. Shared housing includes service bores."
    for frame,label in [(1,"ASSEMBLED"),(60,"EXPLODED / reusable upgrade pose")]:
        scene.timeline_markers.new(label,frame=frame)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    (OUT/"parts.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("PERFORMANCE_ASSETS_READY",json.dumps(manifest["assembly"]),flush=True)
    if "--render" in sys.argv:
        for entry in variants.values():
            bpy.context.view_layer.layer_collection.children[entry["collection"].name].exclude=False
            entry["root"].animation_data_clear()
        render_reviews(roots,members,variants,materials)
        print("PERFORMANCE_RENDERS_READY",flush=True)


if __name__=="__main__":
    main()
