class_name BattleV6Dynamics
extends RefCounted

const D = preload("res://scripts/battle/v6_data.gd")
const WEIGHTS = [.25,.2,.25,.15,.15]
const RADII = [.69,.23,.5,.12,.08]

static func structure(build: Dictionary) -> Dictionary:
	var state = {"revision":0,"parts":[]}
	for i in build.parts.size():
		var part = build.parts[i]
		state.parts.append({"slot":part.type,"id":part.id,"name":part.name,
			"sectors":[0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0],"health":1.0,"worst":0.0,"lostMass":0.0,"index":i})
	derive(build,state)
	return state

static func derive(build: Dictionary, state: Dictionary) -> void:
	var mass = 0.0
	var raw_inertia = 0.0
	var wear = 0.0
	var moment = [0.0,0.0,0.0]
	var bx = 0.0
	var bz = 0.0
	for i in state.parts.size():
		var runtime = state.parts[i]
		var part = build.parts[i]
		var custom = D.CUSTOM.normalize(build.customizations.get(part.id,{}))
		var radius = RADII[i]*custom.size
		var lost = 0.0
		var rx = 0.0
		var rz = 0.0
		var bend = D.vec()
		var sum = 0.0
		var worst = 0.0
		for sector in 8:
			var damage = runtime.sectors[sector]
			var angle = sector/8.0*TAU
			var removed = part.mass/8.0*maxf(damage-.55,0)/.45*.38
			lost += removed
			rx += removed*radius*cos(angle)
			rz += removed*radius*sin(angle)
			bend.x -= cos(angle)*damage*damage/8
			bend.y -= sin(angle)*damage*damage/8
			sum += damage
			worst = maxf(worst,damage)
		var remaining = part.mass-lost
		runtime.health = 1-sum/8
		runtime.worst = worst
		runtime.lostMass = lost
		mass += remaining
		moment[0] += remaining*part.center[0]-rx
		moment[1] += remaining*part.center[1]
		moment[2] += remaining*part.center[2]-rz
		raw_inertia += part.inertia*(remaining/part.mass)+remaining*(pow(part.center[0],2)+pow(part.center[2],2))-2*(part.center[0]*rx+part.center[2]*rz)
		wear += (1-runtime.health)*WEIGHTS[i]
		bx += bend.x*radius*.24
		bz += bend.y*radius*.24
	var center = [moment[0]/mass,moment[1]/mass,moment[2]/mass]
	state.totalMass = mass
	state.centerOfMass = center
	state.bend = [bx,bz]
	state.momentOfInertia = maxf(build.momentOfInertia*.35,raw_inertia-mass*(center[0]*center[0]+center[2]*center[2]))
	var shift = D.length(D.vec(center[0]-build.centerOfMass[0]+bx,center[2]-build.centerOfMass[2]+bz))
	var ring = state.parts[0]
	var lock = state.parts[1]
	var shaft = state.parts[3]
	var tip = state.parts[4]
	state.wear = wear
	state.imbalance = clampf(shift*9+pow(shaft.worst,2)*.5+pow(lock.worst,2)*.23+pow(ring.worst,2)*.2+wear*.55,0,1)
	state.stiffness = clampf(1-wear*.65-pow(lock.worst,2)*.26-pow(shaft.worst,2)*.35,.16,1)
	state.stability = build.stability*state.stiffness
	state.spinDrag = wear*2+pow(state.imbalance,2)*14+pow(shaft.worst,2)*6+pow(tip.worst,2)*4
	state.integrity = 0.0
	state.brokenSectors = 0
	for i in 5:
		state.integrity += state.parts[i].health*WEIGHTS[i]
		for damage in state.parts[i].sectors:
			if damage>=.99: state.brokenSectors += 1
	state.failed = ring.health<.3 or lock.health<.35 or shaft.health<.3
	var tip_height = D.CUSTOM.normalize(build.customizations.get(build.selection.tip,{})).height
	var bottom = -.21625 if build.selection.tip=="tip.metal_stamina" else (-.1275 if build.selection.tip=="tip.flat_attack" else -.2028)
	state.contactOffset = -(-.56+bottom*tip_height)
	var vertical = 0.0
	for i in 5:
		vertical += (build.parts[i].mass-state.parts[i].lostMass)*(D.catalog().slotY[D.SLOTS[i]]+build.parts[i].center[1])
	state.supportHeight = maxf(.05,(state.contactOffset+vertical/mass)*.92)

static func impact(top: Dictionary, damage: float, world_angle: float) -> Array:
	if damage<=0: return []
	var local_angle = fposmod(world_angle+top.spinPhase,TAU)
	var sector = int(floor(local_angle/TAU*8+.5))%8
	var ring_custom = D.CUSTOM.normalize(top.build.customizations.get(top.build.selection.attackRing,{}))
	var shaft_custom = D.CUSTOM.normalize(top.build.customizations.get(top.build.selection.driverShaft,{}))
	var leverage = 1+maxf(shaft_custom.height-1,0)*1.3+top.tilt*.6
	var shares = [.64,.13*leverage,.17,.09*leverage,.035+top.tilt*.12]
	var impacts = []
	for i in 5:
		var runtime = top.structure.parts[i]
		var part = top.build.parts[i]
		var custom = D.CUSTOM.normalize(top.build.customizations.get(part.id,{}))
		var section = clampf(custom.height/custom.size,.58,1.55)
		var concentration = 1+ring_custom.shape/100.0*(.55+1.0/ring_custom.symmetry) if i==0 else 1
		var dose = damage*shares[i]*concentration/(part.durability*.24*section)
		for pair in [[0,.72],[-1,.14],[1,.14]]:
			var at = (sector+pair[0]+8)%8
			runtime.sectors[at] = clampf(runtime.sectors[at]+dose*pair[1],0,1)
		impacts.append({"slot":runtime.slot,"sector":sector,"dose":dose})
	top.structure.revision += 1
	derive(top.build,top.structure)
	top.durability = top.build.durability*top.structure.integrity
	return impacts

static func signed_spin(top: Dictionary) -> float:
	return top.spin*top.spinDirection

static func set_spin(top: Dictionary, value: float) -> void:
	if absf(value)>1e-10: top.spinDirection = signf(value)
	top.spin = absf(value)

static func lose_spin(top: Dictionary, amount: float, channel = "contact") -> float:
	var lost = minf(top.spin,maxf(0,amount))
	top.spin -= lost
	if top.has("spinBudget"): top.spinBudget[channel] += lost
	return lost

static func tip_contact(build: Dictionary) -> Dictionary:
	var tip = build.parts[4]
	return {"radius":.018*tip.get("customization",{}).get("size",1)*clampf(tip.damping,.5,1.8),
		"friction":clampf(tip.friction,.05,1)}

static func loss_torques(top: Dictionary, surface: Dictionary, spin_scale = 1.0) -> Dictionary:
	var tip = tip_contact(top.build)
	return {"natural":.89*top.build.spinDecayPerSecond*surface.spinDamping*spin_scale*
		(.72+.28*pow(top.spin/65.0,2))*(.85+.15*tip.radius/.018),
		"scrape":.89*(top.structure.spinDrag+(1.25+top.build.friction*surface.friction*1.8)*clampf((top.tilt-.48)/.34,0,1))}

static func ground_contact(top: Dictionary, surface: Dictionary, dt: float) -> float:
	var mass = top.structure.totalMass
	var inertia = top.structure.momentOfInertia
	var tip = tip_contact(top.build)
	var offset = D.body_to_world(top.structure.centerOfMass[0]+top.structure.bend[0],
		top.structure.centerOfMass[2]+top.structure.bend[1],top.spinPhase)
	var rx = -top.tiltVector.x*top.structure.supportHeight-offset.x
	var ry = -top.tiltVector.y*top.structure.supportHeight-offset.y
	var q = signed_spin(top)
	var vx = top.velocity.x+q*ry
	var vy = top.velocity.y-q*rx
	var slip = sqrt(vx*vx+vy*vy)
	var traction = tip.friction*surface.friction*9.8*mass*top.get("terrain",{}).get("normal",{"y":1.0}).y
	var kxx = 1/mass+ry*ry/inertia
	var kyy = 1/mass+rx*rx/inertia
	var kxy = -rx*ry/inertia
	var determinant = kxx*kyy-kxy*kxy
	var jx = (-kyy*vx+kxy*vy)/determinant
	var jy = (kxy*vx-kxx*vy)/determinant
	var relaxation = 1-exp(-(.35+tip.friction*1.5)*surface.linearDrag*dt)
	var factor = minf(relaxation,traction*dt/maxf(sqrt(jx*jx+jy*jy),1e-12))
	jx *= factor
	jy *= factor
	top.velocity.x += jx/mass
	top.velocity.y += jy/mass
	var before = top.spin
	set_spin(top,q+(ry*jx-rx*jy)/inertia)
	if top.has("spinBudget"): top.spinBudget.ground += before-top.spin
	top.ground = {"slip":slip,"state":"scraping" if top.tilt>=.48 else ("sliding" if slip>.18 else "gripping"),
		"traction":traction,"radius":tip.radius}
	return traction/mass

static func update_axis(top: Dictionary, surface: Dictionary, dt: float) -> void:
	var direction = D.body_to_world(top.structure.centerOfMass[0]+top.structure.bend[0],
		top.structure.centerOfMass[2]+top.structure.bend[1],top.spinPhase)
	var momentum = top.structure.momentOfInertia*top.spin
	var support = clampf(momentum/(.89*65),0,1.5)
	var stability = maxf(.16,top.structure.stability*surface.stability)
	var slope_weight = .3/(1+support*2)
	var normal = top.get("terrain",{}).get("normal",{"x":0.0,"z":0.0})
	var target = D.vec(direction.x*(5+top.structure.imbalance*4)-top.velocity.x*.012+normal.x*slope_weight,
		direction.y*(5+top.structure.imbalance*4)-top.velocity.y*.012+normal.z*slope_weight)
	var stiffness = (6+support*18)*stability
	var rate = D.body_to_world(top.tiltRate.x,top.tiltRate.y,top.spinDirection*(2.5/(.3+support))*dt)
	var decay = exp(-(5+support*2)*dt)
	for axis in ["x","y"]:
		top.tiltRate[axis] = (rate[axis]+(target[axis]-top.tiltVector[axis])*stiffness*dt)*decay
		top.tiltVector[axis] += top.tiltRate[axis]*dt
		top.tiltVector[axis] *= exp(maxf(0,.18-support)*7*dt)
	var magnitude = D.length(top.tiltVector)
	var limit = minf(1,.9/maxf(magnitude,1e-12))
	top.tiltVector = D.scale(top.tiltVector,limit)
	top.tilt = minf(magnitude,.9)
	var ratio = sin(top.tilt)/maxf(top.tilt,1e-12)
	top.axis = {"x":top.tiltVector.x*ratio,"y":cos(top.tilt),"z":top.tiltVector.y*ratio}
	top.angularMomentum = momentum

static func disk_contact(a: Dictionary, b: Variant, normal: Dictionary, ra: float, rb: float, restitution: float, friction = .24) -> Dictionary:
	var ma = a.structure.totalMass
	var ia = a.structure.momentOfInertia
	var inv_b = 1/b.structure.totalMass if b!=null else 0.0
	var ib = b.structure.momentOfInertia if b!=null else INF
	var tangent = D.vec(-normal.y,normal.x)
	var dx = (b.velocity.x if b!=null else 0)-a.velocity.x
	var dy = (b.velocity.y if b!=null else 0)-a.velocity.y
	var vn = dx*normal.x+dy*normal.y
	var jn = maxf(0,-(1+clampf(restitution,0,1))*vn/(1/ma+inv_b))
	var vt = dx*tangent.x+dy*tangent.y+signed_spin(a)*ra+(signed_spin(b)*rb if b!=null else 0)
	var jt = clampf(-vt/(1/ma+inv_b+ra*ra/ia+rb*rb/ib),-friction*jn,friction*jn)
	var jx = normal.x*jn+tangent.x*jt
	var jy = normal.y*jn+tangent.y*jt
	a.velocity.x -= jx/ma
	a.velocity.y -= jy/ma
	set_spin(a,signed_spin(a)+ra*jt/ia)
	if b!=null:
		b.velocity.x += jx*inv_b
		b.velocity.y += jy*inv_b
		set_spin(b,signed_spin(b)+rb*jt/ib)
	return {"normal":jn,"tangent":jt,"normalSpeed":vn,"slip":vt}
