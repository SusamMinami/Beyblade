class_name BattleV6Simulation
extends RefCounted

# All solver vectors stay in double-precision Dictionaries. Vector2/3 are
# reserved for the scene adapter because standard Godot vectors use float32.
const D = preload("res://scripts/battle/v6_data.gd")
const P = preload("res://scripts/battle/v6_dynamics.gd")
const L = preload("res://scripts/battle/v6_launcher.gd")
var player_build: Dictionary
var enemy_build: Dictionary
var arena: Dictionary
var seed: int
var tuning = {"damageScale":1.0,"spinScale":1.0,"controlScale":1.0,"speedScale":1.0}
var launchers: Dictionary
var maintenance: Dictionary
var player: Dictionary
var enemy: Dictionary
var phase = "ready"
var time = 0.0
var frame = 0
var result: Variant = null
var events: Array = []
var collision_log: Array = []
var contact_active = false
var drive_zone: Dictionary
var zone_occupants: Array = []
var last_zone_key = ""

func _init(a: Dictionary, b: Dictionary, map: Dictionary, options: Dictionary = {}) -> void:
	player_build = a
	enemy_build = b
	arena = map
	seed = int(options.get("seed",20260718)) & 0xffffffff
	tuning.merge(options.get("tuning",{}),true)
	for side in ["player","enemy"]:
		launchers[side] = L.normalize(options.get("launchers",{}).get(side,{}))
		maintenance[side] = L.oil_effects(options.get("maintenance",{}).get(side,{}),launchers[side])
	reset()

func create_top(build: Dictionary, y: float) -> Dictionary:
	return {"build":build,"position":D.vec(0,y),"velocity":D.vec(),"spin":0.0,"spinPhase":0.0,
		"spinDirection":1,"tiltVector":D.vec(),"tiltRate":D.vec(),"axis":{"x":0.0,"y":1.0,"z":0.0},
		"ground":{"state":"gripping","slip":0.0},"edge":{"falling":false,"drop":0.0,"velocity":0.0,"height":0.0},
		"obstacleContacts":[],"structure":P.structure(build),"zone":{"id":null,"contested":false,"gain":0.0},
		"stats":{"zoneSeconds":0.0,"spinHarvested":0.0,"hits":0,"peakImpulse":0.0},
		"durability":build.durability,"tilt":0.0,"surfaceName":"","controlInput":D.vec(),
		"controlInfluence":0.0,"imbalance":0.0,"spinLossRate":0.0,"ringOutRisk":0.0,
		"stabilityState":"stable","ringRiskState":"safe","spinRiskState":"safe"}

func reset() -> void:
	phase = "ready"
	time = 0
	frame = 0
	result = null
	events = []
	collision_log = []
	contact_active = false
	player = create_top(player_build,4.45)
	enemy = create_top(enemy_build,-4.45)
	player.oil = maintenance.player
	enemy.oil = maintenance.enemy
	drive_zone = D.zones(arena,0)
	zone_occupants = []
	last_zone_key = ""

func launch(options: Dictionary = {}) -> void:
	reset()
	phase = "running"
	var args = options.duplicate()
	args.speedScale = tuning.speedScale
	player.merge(L.launch_state(player_build,launchers.player,args,player.oil),true)
	enemy.merge(L.launch_state(enemy_build,launchers.enemy,{
		"power":.78+seed_unit(3)*.16,"height":0.0,"direction":PI+(seed_unit(5)-.5)*.24,
		"angle":seed_unit(7)*.3,"speedScale":tuning.speedScale},enemy.oil),true)
	events.append({"type":"launch","power":clampf(options.get("power",.86),.35,1),
		"height":clampf(options.get("height",.45),0,1)})

func launch_explicit(a: Dictionary, b: Dictionary) -> void:
	reset()
	phase = "running"
	for side in ["player","enemy"]:
		var top = player if side=="player" else enemy
		var cmd = a if side=="player" else b
		top.merge(L.launch_state(top.build,launchers[side],{
			"power":clampf(.35+cmd.get("power_q",cmd.get("p",0))/255.0*.65,.35,1),
			"height":clampf(cmd.get("height_q",cmd.get("h",0))/255.0,0,1),
			"direction":cmd.get("direction_q",cmd.get("d",0))/10.0+(0 if side=="player" else PI),
			"angle":clampf(cmd.get("angle_q",cmd.get("a",0))/127.0,-1,1),
			"spinDirection":cmd.get("spinDirection",1),"speedScale":tuning.speedScale},top.oil),true)
	events.append({"type":"launch","power":.86,"height":.45})

func step(delta: float, control: Dictionary = {}, opponent: Variant = null) -> void:
	events = []
	if phase!="running": return
	var dt = clampf(delta,0,1.0/30)
	if not is_finite(dt) or dt==0: return
	frame += 1
	for top in [player,enemy]:
		top.spinBudget = {"before":top.spin,"supply":0.0,"natural":0.0,"scrape":0.0,"ground":0.0,"contact":0.0}
	var count = int(ceil(dt/(1.0/120)))
	var start = time
	for i in count:
		if phase!="running": break
		substep(dt/count,control,opponent)
	for top in [player,enemy]:
		var budget = top.spinBudget
		budget.after = top.spin
		budget.contact = budget.before+budget.supply-budget.natural-budget.scrape-budget.ground-budget.after
		top.spinLossRate = (budget.before-budget.after)/(time-start)
		top.zone.status = "outside" if top.zone.id==null else ("capped" if top.zone.gain==0 else (
			"gaining" if top.spinLossRate < -1e-6 else "draining"))

func substep(dt: float, control: Dictionary, opponent: Variant) -> void:
	time += dt
	drive_zone = D.zones(arena,time)
	zone_occupants = []
	for side in ["player","enemy"]:
		var top = player if side=="player" else enemy
		if not drive_zone.cooling and not top.edge.falling and top.spin>2 and D.in_zone(top,drive_zone.active):
			zone_occupants.append(side)
	var key = str(drive_zone.active.id if drive_zone.active!=null else "undefined")+":"+("true" if drive_zone.cooling else "false")
	if key!=last_zone_key:
		last_zone_key = key
		events.append({"type":"drive_zone","id":drive_zone.active.id if drive_zone.active!=null else null,"cooling":drive_zone.cooling})
	var enemy_input = enemy_control() if opponent==null else opponent
	integrate(player,control,dt,false)
	integrate(enemy,enemy_input,dt,true)
	resolve_collision()
	if arena.has("blockers"):
		resolve_obstacles(player)
		resolve_obstacles(enemy)
	update_tilt(player,dt)
	update_tilt(enemy,dt)
	update_risks(player,"player")
	update_risks(enemy,"enemy")
	check_result()

func integrate(top: Dictionary, input: Dictionary, dt: float, is_enemy: bool) -> void:
	var surface = D.surface_at(arena,D.length(top.position))
	top.surfaceName = surface.name
	top.terrain = D.sample(arena,top.position)
	if top.edge.falling or not top.terrain.supported:
		if not top.edge.falling:
			top.edge.falling = true
			top.edge.height = top.terrain.height
		top.edge.velocity += 9.8*dt
		top.edge.drop += top.edge.velocity*dt
		top.position.x += top.velocity.x*dt
		top.position.y += top.velocity.y*dt
		top.ground = {"state":"airborne","slip":0.0,"traction":0.0,"radius":0.0}
		top.controlInput = D.vec()
		top.controlInfluence = 0.0
		top.zone = {"id":null,"contested":false,"gain":0.0}
		top.spinPhase = fmod(top.spinPhase+P.signed_spin(top)*dt,TAU)
		return
	top.spinPhase = fmod(top.spinPhase+P.signed_spin(top)*dt,TAU)
	var inside = ("enemy" if is_enemy else "player") in zone_occupants
	var contested = zone_occupants.size()>1
	var supplied = 6.4/top.structure.momentOfInertia*(.35 if contested else 1)*clampf(1-top.structure.imbalance*.6,.25,1) if inside else 0.0
	var gain = minf(supplied,maxf(0,top.build.maxSpinSpeed*.92-top.spin)/maxf(dt,1e-6))
	top.zone = {"id":drive_zone.active.id if inside else null,"contested":inside and contested,"gain":gain}
	if inside:
		top.stats.zoneSeconds += dt
		top.stats.spinHarvested += gain*dt
	top.spin += gain*dt
	if top.has("spinBudget"): top.spinBudget.supply += gain*dt
	var torques = P.loss_torques(top,surface,tuning.spinScale)
	torques.natural *= 1+.35*(top.oil.groundSpin-1)
	P.lose_spin(top,torques.natural/top.structure.momentOfInertia*dt,"natural")
	P.lose_spin(top,torques.scrape/top.structure.momentOfInertia*dt,"scrape")
	var oiled = surface.duplicate()
	oiled.friction *= top.oil.traction
	oiled.linearDrag *= top.oil.traction
	var traction = P.ground_contact(top,oiled,dt)
	var spin_ratio = clampf(top.spin/top.build.maxSpinSpeed,0,1)
	var raw = D.control(input)
	var magnitude = clampf(D.length(raw),0,1)
	var direction = D.normalized(raw)
	var mobility = D.smooth(.02,.55,spin_ratio)
	var scrape = D.smooth(.48,.82,top.tilt)
	var balance = clampf(1-top.imbalance*.45-scrape*.35,.35,1)
	var requested = top.build.controlForce/top.structure.totalMass*surface.control*tuning.controlScale*mobility*balance*magnitude*top.structure.stiffness
	var acceleration = minf(requested,traction*mobility)
	top.velocity.x += direction.x*acceleration*dt
	top.velocity.y += direction.y*acceleration*dt
	top.controlInput = D.scale(direction,magnitude)
	top.controlInfluence = clampf(magnitude*mobility*surface.control*top.oil.traction*top.build.controlResponse*balance,0,1)
	var gradient = top.terrain.gradient
	var slope = 9.8/(1+gradient.x*gradient.x+gradient.y*gradient.y)
	top.velocity.x -= gradient.x*slope*dt
	top.velocity.y -= gradient.y*slope*dt
	if surface.noise>0:
		var noise = sin(time*17+seed*.17+(4 if is_enemy else 0))*surface.noise
		top.velocity.x += noise*dt
		top.velocity.y -= noise*.7*dt
	var drag = exp(-(1-mobility)*8*dt)
	top.velocity.x *= drag
	top.velocity.y *= drag
	var cap = (.35+(8.15+top.build.attackPower*1.5)*sqrt(mobility))*tuning.speedScale
	var speed = D.length(top.velocity)
	if speed>cap: top.velocity = D.scale(top.velocity,cap/speed)
	top.position.x += top.velocity.x*dt
	top.position.y += top.velocity.y*dt
	resolve_obstacles(top)

func contact_radius(top: Dictionary) -> float:
	var custom = top.build.parts[0].get("customization",{})
	return .69*custom.get("size",1)*(1+custom.get("shape",0)*.0006)

func nonzero_sign(value: float) -> float:
	return signf(value) if value!=0 else 1.0

func resolve_obstacles(top: Dictionary) -> void:
	if top.edge.falling: return
	var blockers = arena.get("blockers",[])
	for index in blockers.size():
		var o = blockers[index]
		var px = top.position.x
		var py = top.position.y
		var nearest_x = clampf(px,o.x-o.hx,o.x+o.hx)
		var nearest_y = clampf(py,o.z-o.hz,o.z+o.hz)
		var dx = px-nearest_x
		var dy = py-nearest_y
		var distance = sqrt(dx*dx+dy*dy)
		var radius = contact_radius(top)
		if distance>radius+.04: top.obstacleContacts.erase(index)
		if distance>=radius: continue
		var entering = not index in top.obstacleContacts
		if entering: top.obstacleContacts.append(index)
		var depth = radius-distance
		if distance<1e-8:
			var gx = o.hx-absf(px-o.x)
			var gy = o.hz-absf(py-o.z)
			dx = nonzero_sign(px-o.x) if gx<gy else 0.0
			dy = 0.0 if gx<gy else nonzero_sign(py-o.z)
			depth = radius+minf(gx,gy)
			distance = 1.0
		var nx = dx/distance
		var ny = dy/distance
		top.position.x += nx*(depth+.001)
		top.position.y += ny*(depth+.001)
		var approach = top.velocity.x*nx+top.velocity.y*ny
		if approach>=0: continue
		var contact = P.disk_contact(top,null,D.vec(-nx,-ny),radius,0,.52)
		if entering and approach<-.4:
			var impulse = contact.normal
			P.impact(top,impulse*.75*tuning.damageScale,atan2(-ny,-nx))
			collision_imbalance(top,1,D.surface_at(arena,D.length(top.position)),impulse,D.vec(nx,ny))
			events.append({"type":"obstacle","position":D.vec(nearest_x,nearest_y),
				"intensity":clampf(-approach/10,.1,1),"impulse":impulse,"tangentImpulse":contact.tangent})

func enemy_control() -> Dictionary:
	var active = drive_zone.active
	if active!=null:
		var contest = D.in_zone(player,active) and D.length(D.vec(player.position.x-enemy.position.x,player.position.y-enemy.position.y))<3.2
		var target = player.position if contest else active
		var bias = clampf((enemy.build.attackPower-.85)*1.8,0,.8)
		var desired = D.vec((target.x-enemy.position.x)*(2+bias if contest else 1.6)-enemy.velocity.x*(.4-bias*.3 if contest else 1.05),
			(target.y-enemy.position.y)*(2+bias if contest else 1.6)-enemy.velocity.y*(.4-bias*.3 if contest else 1.05))
		for o in arena.get("blockers",[]):
			var dx = enemy.position.x-o.x
			var dy = enemy.position.y-o.z
			var sx = o.hx+1.25
			var sy = o.hz+1.25
			if absf(dx)<sx and absf(dy)<sy:
				var strength = (1-minf(absf(dx)/sx,absf(dy)/sy))*4
				if absf(dx)/sx>absf(dy)/sy: desired.x += nonzero_sign(dx)*strength
				else:
					desired.y += nonzero_sign(dy)*strength
					desired.x += nonzero_sign(target.x-o.x)*2
		var magnitude = D.length(desired)
		return D.scale(desired,1/magnitude) if magnitude>1 else desired
	var delta = D.vec(player.position.x-enemy.position.x,player.position.y-enemy.position.y)
	var pursuit = D.scale(delta,1/maxf(D.length(delta),.001))
	var sign_orbit = 1 if seed_unit(11)>.5 else -1
	var orbit = D.vec(-pursuit.y*sign_orbit,pursuit.x*sign_orbit)
	var aggression = clampf(enemy.build.attackPower-.72,.15,.7)
	var retreat = D.scale(D.normalized(enemy.position),-.85) if D.length(enemy.position)>arena.wallRadius*.78 else D.vec()
	return D.vec(pursuit.x*aggression+orbit.x*(.62-aggression*.35)+retreat.x,
		pursuit.y*aggression+orbit.y*(.62-aggression*.35)+retreat.y)

func resolve_collision() -> void:
	if player.edge.falling or enemy.edge.falling:
		contact_active = false
		return
	var delta = D.vec(enemy.position.x-player.position.x,enemy.position.y-player.position.y)
	var distance = D.length(delta)
	var minimum = contact_radius(player)+contact_radius(enemy)
	if distance>minimum+.04: contact_active = false
	if distance>=minimum: return
	var entering = not contact_active
	contact_active = true
	var normal = D.scale(delta,1/distance) if distance>.00001 else D.vec(1,0)
	var relative = D.vec(enemy.velocity.x-player.velocity.x,enemy.velocity.y-player.velocity.y)
	var speed = D.dot(relative,normal)
	var overlap = minimum-distance
	var share = enemy.structure.totalMass/(player.structure.totalMass+enemy.structure.totalMass)
	player.position.x -= normal.x*overlap*share
	player.position.y -= normal.y*overlap*share
	enemy.position.x += normal.x*overlap*(1-share)
	enemy.position.y += normal.y*overlap*(1-share)
	if speed>=.2: return
	var ps = D.surface_at(arena,D.length(player.position))
	var es = D.surface_at(arena,D.length(enemy.position))
	var restitution = clampf((player.build.restitution+enemy.build.restitution)*.5,.12,.82)*(ps.bounce+es.bounce)*.5
	var ip = 1/player.structure.totalMass
	var ie = 1/enemy.structure.totalMass
	var before = {"player":collision_state(player),"enemy":collision_state(enemy)}
	var contact = P.disk_contact(player,enemy,normal,contact_radius(player),contact_radius(enemy),restitution)
	var lobe = .65+player.build.parts[0].get("customization",{}).get("shape",0)/200.0+enemy.build.parts[0].get("customization",{}).get("shape",0)/200.0
	var requested = minf(1.8,minf(player.spin,enemy.spin)*.045)*lobe if entering else 0.0
	var inv_mass = ip+ie
	var energy = [.5*player.structure.momentOfInertia*player.spin*player.spin,.5*enemy.structure.momentOfInertia*enemy.spin*enemy.spin]
	var available = energy[0]+energy[1]
	var separating = maxf(0,speed+contact.normal*inv_mass)
	var affordable = (sqrt(separating*separating+2*inv_mass*available)-separating)/inv_mass
	var tooth = minf(requested,affordable)
	var transfer = maxf(0,tooth*separating+.5*tooth*tooth*inv_mass)
	for i in 2:
		var top = player if i==0 else enemy
		var debit = transfer*energy[i]/maxf(available,1e-12)
		top.spin = sqrt(maxf(0,top.spin*top.spin-2*debit/top.structure.momentOfInertia))
	var impulse = contact.normal+tooth
	player.velocity.x -= normal.x*tooth*ip
	player.velocity.y -= normal.y*tooth*ip
	enemy.velocity.x += normal.x*tooth*ie
	enemy.velocity.y += normal.y*tooth*ie
	if entering and impulse>.35:
		var base_damage = (impulse-.35)*1.1*tuning.damageScale
		var dp = base_damage*enemy.build.attackPower*es.damage
		var de = base_damage*player.build.attackPower*ps.damage
		var angle = atan2(normal.y,normal.x)
		var pp = P.impact(player,dp,angle)
		var ep = P.impact(enemy,de,angle+PI)
		for top in [player,enemy]:
			top.stats.hits += 1
			top.stats.peakImpulse = maxf(top.stats.peakImpulse,impulse)
			P.lose_spin(top,impulse*.19*.89/top.structure.momentOfInertia)
		collision_imbalance(player,enemy.build.attackPower,ps,impulse,D.scale(normal,-1))
		collision_imbalance(enemy,player.build.attackPower,es,impulse,normal)
		var telemetry = {"time":D.rounded(time),"impulse":D.rounded(impulse),"intensity":D.rounded(clampf(impulse/7,0,1)),
			"position":D.vec(D.rounded((player.position.x+enemy.position.x)*.5),D.rounded((player.position.y+enemy.position.y)*.5)),
			"player":collision_delta(before.player,collision_state(player),dp),"enemy":collision_delta(before.enemy,collision_state(enemy),de)}
		telemetry.player.parts = pp
		telemetry.enemy.parts = ep
		telemetry.tangentImpulse = contact.tangent
		telemetry.contactSlip = contact.slip
		collision_log.append(telemetry)
		if collision_log.size()>200: collision_log.pop_front()
		events.append({"type":"collision","impulse":impulse,"intensity":clampf(impulse/7,0,1),
			"position":D.vec((player.position.x+enemy.position.x)*.5,(player.position.y+enemy.position.y)*.5),"telemetry":telemetry})

func collision_imbalance(top: Dictionary, attack: float, surface: Dictionary, impulse: float, direction: Dictionary) -> void:
	var ratio = clampf(top.spin/top.build.maxSpinSpeed,0,1)
	var stability = maxf(top.structure.stability*surface.stability,.2)
	var gain = clampf((impulse-.35)/7*(attack/stability)*(.72+(1-ratio)*.55)*.48,0,.5)
	top.imbalance = clampf(top.imbalance+gain,0,1)
	var support = 1+top.structure.momentOfInertia*top.spin/58
	for axis in ["x","y"]:
		top.tiltVector[axis] += direction[axis]*gain*.28/support
		top.tiltRate[axis] += direction[axis]*gain*3/support
	top.tilt = clampf(D.length(top.tiltVector),0,.9)

func collision_state(top: Dictionary) -> Dictionary:
	return {"tilt":D.rounded(top.tilt),"spin":D.rounded(top.spin),"imbalance":D.rounded(top.imbalance),
		"durability":D.rounded(top.durability),"structuralImbalance":D.rounded(top.structure.imbalance),
		"inertia":D.rounded(top.structure.momentOfInertia)}

func collision_delta(before: Dictionary, after: Dictionary, damage: float) -> Dictionary:
	var value = {}
	for key in ["tilt","spin","imbalance","durability","structuralImbalance","inertia"]:
		value[key+"Before"] = before[key]
		value[key+"After"] = after[key]
		if key in ["tilt","spin","imbalance"]: value[key+"Delta"] = D.rounded(after[key]-before[key])
	value.damage = D.rounded(before.durability-after.durability)
	value.impactLoad = D.rounded(damage)
	return value

func update_tilt(top: Dictionary, dt: float) -> void:
	var ratio = clampf(top.spin/top.build.maxSpinSpeed,0,1)
	var surface = D.surface_at(arena,D.length(top.position))
	P.update_axis(top,surface,dt)
	var recovery = (.1+top.structure.stability*surface.stability*.16)*(.55+ratio*.45)
	top.imbalance = maxf(top.imbalance-recovery*dt,top.structure.imbalance)
	var radius = D.boundary(arena,top.position)
	var edge = D.smooth(arena.wallRadius*.7,arena.ringOutRadius,radius)
	var axis = "x" if absf(top.position.x)>=absf(top.position.y) else "y"
	var outward = maxf(0,top.velocity[axis]*signf(top.position[axis])) if arena.get("boundary","")=="square" else (
		maxf(D.dot(top.velocity,D.scale(top.position,1/radius)),0) if radius>.001 else 0.0)
	top.ringOutRisk = clampf(edge*.58+D.smooth(1.5,9.2,outward)*.27+D.smooth(.38,.9,top.tilt)*.15,0,1)

func update_risks(top: Dictionary, actor: String) -> void:
	var ratio = clampf(top.spin/top.build.maxSpinSpeed,0,1)
	var states = [
		["stabilityState","critical" if top.tilt>=.62 else ("wobble" if top.tilt>=.38 else "stable"),"stability"],
		["ringRiskState","critical" if top.ringOutRisk>=.78 else ("warning" if top.ringOutRisk>=.5 else "safe"),"ring_out_risk"],
		["spinRiskState","critical" if ratio<=.16 else ("warning" if ratio<=.32 else "safe"),"spin_risk"]]
	for state in states:
		if top[state[0]]==state[1]: continue
		top[state[0]] = state[1]
		events.append({"type":state[2],"actor":actor,"state":state[1],"tilt":D.rounded(top.tilt),
			"spin":D.rounded(top.spin),"imbalance":D.rounded(top.imbalance),"ringOutRisk":D.rounded(top.ringOutRisk)})

func failure(top: Dictionary) -> Variant:
	if top.durability<=0 or top.structure.failed: return "break"
	if top.edge.drop>.3 or D.boundary(arena,top.position)>arena.ringOutRadius: return "ring_out"
	if top.spin<=2: return "spin_out"
	return null

func check_result() -> void:
	var eliminations = {"player":failure(player),"enemy":failure(enemy)}
	if eliminations.player!=null or eliminations.enemy!=null:
		var both = eliminations.player!=null and eliminations.enemy!=null
		finish("draw" if both else ("enemy" if eliminations.player!=null else "player"),
			"draw" if both else (eliminations.player if eliminations.player!=null else eliminations.enemy),eliminations)
	elif time>=75:
		var ps = player.spin+player.durability/player.build.durability*20
		var es = enemy.spin+enemy.durability/enemy.build.durability*20
		finish("draw" if absf(ps-es)<=1e-6 else ("player" if ps>es else "enemy"),"time")

func finish(winner: String, reason: String, eliminations: Dictionary = {}) -> void:
	phase = "finished"
	var loser = enemy if winner=="player" else player
	var weakest = loser.structure.parts[0]
	for part in loser.structure.parts:
		if part.worst>weakest.worst: weakest = part
	var draw = winner=="draw"
	result = {"winner":winner,"reason":reason,"time":time,"eliminations":eliminations,
		"cause":"draw" if draw else ("structural_spin_out" if reason=="spin_out" and (
			loser.structure.imbalance>.2 or loser.structure.spinDrag>loser.build.spinDecayPerSecond*.35) else reason),
		"weakestPart":null if draw else weakest.slot,"weakestPartName":null if draw else weakest.name,
		"loserImbalance":null if draw else loser.structure.imbalance,
		"stats":{"player":player.stats.duplicate(),"enemy":enemy.stats.duplicate()}}
	var event = result.duplicate()
	event.type = "result"
	events.append(event)

func seed_unit(salt: int) -> float:
	var value = (seed+salt*0x9e3779b9)&0xffffffff
	value = (value^(value<<13))&0xffffffff
	value = (value^(value>>17))&0xffffffff
	value = (value^(value<<5))&0xffffffff
	return float(value)/4294967295.0

func state_context() -> Dictionary:
	var map = arena.duplicate(true)
	map.erase("surfaces")
	var surfaces = []
	for radius in [0,3.1,5.9,arena.wallRadius]:
		surfaces.append(D.surface_at(arena,radius))
	return {"builds":[player_build,enemy_build],"arena":map,"surfaces":surfaces}

func export_state() -> Dictionary:
	var value = {"schema":1,"simulationVersion":D.VERSION,"context":state_context(),
		"seed":seed,"tuning":tuning,"launchers":launchers,"maintenance":maintenance,"phase":phase,
		"frame":frame,"time":time,"result":result,"events":events,"collisionLog":collision_log,
		"contactActive":contact_active,"lastZoneKey":last_zone_key,"driveZone":drive_zone,"zoneOccupants":zone_occupants}
	for side in ["player","enemy"]:
		var top = (player if side=="player" else enemy).duplicate(true)
		top.erase("build")
		top.obstacleContacts.sort()
		value[side] = top
	return value.duplicate(true)

static func finite_data(value: Variant) -> bool:
	if value is float: return is_finite(value)
	if value is Dictionary:
		for v in value.values():
			if not finite_data(v): return false
	if value is Array:
		for v in value:
			if not finite_data(v): return false
	return true

static func equivalent(a: Variant, b: Variant) -> bool:
	if (a is float or a is int) and (b is float or b is int):
		return absf(float(a)-float(b))<=1e-10*maxf(1,absf(float(a)))
	if a is Dictionary and b is Dictionary:
		if a.size()!=b.size(): return false
		for k in a:
			if not b.has(k) or not equivalent(a[k],b[k]): return false
		return true
	if a is Array and b is Array:
		if a.size()!=b.size(): return false
		for i in a.size():
			if not equivalent(a[i],b[i]): return false
		return true
	return a==b

static func has_state_shape(value: Variant, template: Variant) -> bool:
	if template==null: return value==null or value is String
	if template is float or template is int:
		return value is float or value is int
	if template is Dictionary:
		if not value is Dictionary: return false
		for key in template:
			if not value.has(key) or not has_state_shape(value[key],template[key]): return false
		return true
	if template is Array:
		if not value is Array: return false
		if template.is_empty(): return true
		if value.size()!=template.size(): return false
		for i in template.size():
			if not has_state_shape(value[i],template[i]): return false
		return true
	return typeof(value)==typeof(template)

func restore_state(value: Dictionary) -> bool:
	var fields = ["seed","tuning","launchers","maintenance","phase","frame","time","result","events",
		"collisionLog","contactActive","lastZoneKey","driveZone","zoneOccupants","player","enemy"]
	for key in fields:
		if not value.has(key): return false
	if not finite_data(value) or value.get("schema")!=1 or value.get("simulationVersion")!=D.VERSION or not equivalent(value.get("context"),state_context()): return false
	if not has_state_shape(value,{"seed":0,"frame":0,"time":0.0,"contactActive":false,"lastZoneKey":"",
		"tuning":tuning,"launchers":launchers,"maintenance":maintenance}): return false
	if value.seed<0 or value.seed>0xffffffff or floor(value.seed)!=value.seed: return false
	if not value.phase in ["ready","running","finished"] or value.frame<0 or floor(value.frame)!=value.frame or value.time<0: return false
	for key in ["events","collisionLog","zoneOccupants"]:
		if not value[key] is Array: return false
	for key in ["tuning","launchers","maintenance","driveZone"]:
		if not value[key] is Dictionary: return false
	for side in value.zoneOccupants:
		if not side in ["player","enemy"]: return false
	for side in ["player","enemy"]:
		var top = value[side]
		var template = create_top(player_build if side=="player" else enemy_build,0)
		template.erase("build")
		template.oil = maintenance[side]
		if not has_state_shape(top,template): return false
		# JSON parses numbers as floats; Array.has would distinguish 1.0 / 1.
		if top.spin<0 or (top.spinDirection != -1 and top.spinDirection != 1): return false
	# Commit only after validation. JSON numbers restore as doubles, which is
	# intentional for dynamics; the frame/seed counters remain integers.
	var saved = value.duplicate(true)
	seed = int(saved.seed)
	tuning = saved.tuning
	launchers = saved.launchers
	maintenance = saved.maintenance
	phase = saved.phase
	frame = int(saved.frame)
	time = saved.time
	result = saved.result
	events = saved.events
	collision_log = saved.collisionLog
	contact_active = saved.contactActive
	last_zone_key = saved.lastZoneKey
	drive_zone = saved.driveZone
	zone_occupants = saved.zoneOccupants
	player = saved.player
	enemy = saved.enemy
	player.build = player_build
	enemy.build = enemy_build
	return true
