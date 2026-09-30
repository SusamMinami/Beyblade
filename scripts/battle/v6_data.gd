class_name BattleV6Data
extends RefCounted

const VERSION = "2026.09.24-shared-v6+launcher-v1"
const SLOTS = ["attackRing", "coreLock", "weightDisc", "driverShaft", "tip"]
const CUSTOM = preload("res://scripts/assembly/part_customization.gd")
static var _catalog: Dictionary = {}

static func catalog() -> Dictionary:
	if _catalog.is_empty():
		_catalog = JSON.parse_string(FileAccess.get_file_as_string("res://resources/physics/v6_catalog.json"))
	return _catalog

static func vec(x = 0.0, y = 0.0) -> Dictionary:
	return {"x": float(x), "y": float(y)}

static func length(v: Dictionary) -> float:
	return sqrt(v.x*v.x + v.y*v.y)

static func scale(v: Dictionary, amount: float) -> Dictionary:
	return vec(v.x*amount, v.y*amount)

static func normalized(v: Dictionary) -> Dictionary:
	var m = length(v)
	return scale(v, 1.0/m) if m > .00001 else vec()

static func dot(a: Dictionary, b: Dictionary) -> float:
	return a.x*b.x + a.y*b.y

static func smooth(a: float, b: float, value: float) -> float:
	var t = clampf((value-a)/(b-a), 0, 1)
	return t*t*(3-2*t)

static func body_to_world(x: float, y: float, phase: float) -> Dictionary:
	return vec(cos(phase)*x+sin(phase)*y, -sin(phase)*x+cos(phase)*y)

static func rounded(value: float) -> float:
	# JavaScript Math.round, including negative halfway values.
	return floor(value*1e6+.5)/1e6

static func weighted(parts: Array, field: String, weights: Array) -> float:
	var total = 0.0
	for i in parts.size():
		total += parts[i][field]*weights[i]
	return total

static func build_data(build: TopBuildData) -> Dictionary:
	# Keep double precision in the solver; Vector2/3 in a standard Godot build
	# use float32. Resources and the existing DIY calculator stay authoritative.
	var parts: Array = []
	var selection = {}
	for i in SLOTS.size():
		var part = build.get_parts()[i]
		var id = str(part.part_id)
		selection[SLOTS[i]] = id
		var raw = PartDatabase.get_part(part.part_id)
		var custom = CUSTOM.normalize(build.customizations.get(id, {}))
		var center = raw.center_of_mass_offset
		var cy = round(float(center.y)*1e7)/1e7
		var data = {"id": id, "type": SLOTS[i], "name": part.part_name, "mass": part.mass,
			"center": [round(float(center.x)*1e7)/1e7,
				cy*custom.height+(custom.height-1)*.045, round(float(center.z)*1e7)/1e7],
			"inertia": part.moment_of_inertia, "friction": part.friction,
			"restitution": part.restitution, "contactArea": part.contact_area,
			"damping": part.spin_damping_multiplier, "stability": part.stability,
			"control": part.control_response, "attack": part.attack_power, "durability": part.durability}
		if not CUSTOM.is_default(custom):
			data.customization = custom
		parts.append(data)
	var mass = 0.0
	var center = [0.0, 0.0, 0.0]
	for part in parts:
		mass += part.mass
		for a in 3:
			center[a] += part.mass*part.center[a]
	for a in 3:
		center[a] /= mass
	var inertia = 0.0
	var area = 0.0
	for part in parts:
		inertia += part.inertia+part.mass*(pow(part.center[0]-center[0], 2)+pow(part.center[2]-center[2], 2))
		area += part.contactArea
	var lateral = sqrt(center[0]*center[0]+center[2]*center[2])
	var stability = clampf(weighted(parts, "stability", [.2,.15,.25,.2,.2]) -
		clampf(lateral*2.5,0,.25)-clampf(maxf(center[1],0)*.8,0,.15), .35,1.4)
	var response = clampf(weighted(parts,"control",[.08,.07,.15,.2,.5])*pow(1.22/maxf(mass,.1),.35),.35,1.5)
	return {"selection": selection, "customizations": build.customizations.duplicate(true), "parts": parts,
		"totalMass": mass, "centerOfMass": center, "momentOfInertia": inertia, "contactArea": area,
		"friction": clampf(weighted(parts,"friction",[.15,0,.1,0,.75]),.05,1),
		"restitution": clampf(weighted(parts,"restitution",[.55,0,.25,.05,.15]),0,1),
		"stability": stability, "controlResponse": response, "controlForce": 9*response,
		"attackPower": weighted(parts,"attack",[.4,.05,.3,.15,.1]),
		"durability": weighted(parts,"durability",[.25,.2,.25,.15,.15]),
		"spinDecayPerSecond": 3.8*weighted(parts,"damping",[.15,.05,.1,.1,.6])*clampf(1/stability,.78,1.4),
		"maxSpinSpeed": 65*sqrt(.89/inertia), "launchForwardImpulse": 4.5*pow(mass/1.22,.75),
		"collisionMomentum": 4.5*pow(mass/1.22,.75)}

static func surface_at(arena: Dictionary, radius: float) -> Dictionary:
	var selected = arena.surfaces[0]
	for surface in arena.surfaces:
		if radius >= surface.radius:
			selected = surface
	var result = selected.duplicate()
	result.erase("radius")
	return result

static func boundary(arena: Dictionary, p: Dictionary) -> float:
	return maxf(absf(p.x),absf(p.y)) if arena.get("boundary","") == "square" else length(p)

static func hermite(x: float, a: float, b: float, ha: float, hb: float, ma: float, mb: float) -> float:
	var t = (x-a)/(b-a)
	return (2*t*t*t-3*t*t+1)*ha+(t*t*t-2*t*t+t)*(b-a)*ma+(-2*t*t*t+3*t*t)*hb+(t*t*t-t*t)*(b-a)*mb

static func height_at(arena: Dictionary, radius: float, angle = 0.0) -> float:
	if arena.has("groundHeight"):
		return arena.groundHeight
	if not arena.bowlForce:
		return 0
	var n = clampf(radius/arena.wallRadius,0,1)
	var h = -.5+n*n*.82
	if arena.id == "metal":
		h = -.46+pow(n,1.5)*.76+sin(angle*6+n*8)*n*n*.012
	elif arena.id == "composite":
		h = hermite(n,0,.46,-.52,-.448056,0,.3) if n<.46 else (
			hermite(n,.46,.86,-.448056,-.16,.3,.9) if n<.86 else hermite(n,.86,1,-.16,.295,.9,3.25))
	if radius > arena.wallRadius:
		h += pow(sin(PI*clampf((radius-arena.wallRadius)/.24,0,1)),2)*.16
	return h

static func height_xy(arena: Dictionary, x: float, y: float) -> float:
	return height_at(arena,sqrt(x*x+y*y),atan2(y,x))

static func sample(arena: Dictionary, p: Dictionary) -> Dictionary:
	var gx = (height_xy(arena,p.x+.01,p.y)-height_xy(arena,p.x-.01,p.y))/.02
	var gy = (height_xy(arena,p.x,p.y+.01)-height_xy(arena,p.x,p.y-.01))/.02
	var norm = sqrt(gx*gx+1+gy*gy)
	return {"height":height_xy(arena,p.x,p.y), "gradient":vec(gx,gy),
		"normal":{"x":-gx/norm,"y":1/norm,"z":-gy/norm},
		"supported":boundary(arena,p)<=arena.wallRadius+(0 if arena.get("boundary","")=="square" else .24)}

static func control(input: Dictionary) -> Dictionary:
	var x = clampf(float(input.get("x",0)), -1,1)
	var y = clampf(float(input.get("y",0)), -1,1)
	if not is_finite(x) or not is_finite(y):
		return vec()
	var raw = sqrt(x*x+y*y)
	var magnitude = clampf((raw-.035)/.965,0,1)
	return vec(x/raw*magnitude,y/raw*magnitude) if magnitude>0 else vec()

static func zones(arena: Dictionary, time: float) -> Dictionary:
	var list = arena.get("driveZones",[
		{"id":"A","x":-2.35,"y":0.0,"radius":1.25},
		{"id":"B","x":2.35,"y":0.0,"radius":1.25},
		{"id":"C","x":0.0,"y":2.35,"radius":1.25}])
	if list.is_empty():
		return {"zones":list,"active":null,"remaining":0,"cooling":true}
	var elapsed = fmod(time,8)
	var cooling = elapsed>=7
	return {"zones":list,"active":list[int(floor(time/8))%list.size()],
		"cooling":cooling,"remaining":(8 if cooling else 7)-elapsed}

static func in_zone(top: Dictionary, zone: Variant) -> bool:
	return zone != null and length(vec(top.position.x-zone.x,top.position.y-zone.y))<=zone.radius
