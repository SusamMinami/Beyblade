class_name BattleV6Launcher
extends RefCounted

const D = preload("res://scripts/battle/v6_data.gd")

static func part(id: String) -> Dictionary:
	for p in D.catalog().launcherParts:
		if p.id == id: return p
	return {}

static func normalize(raw: Dictionary = {}) -> Dictionary:
	var build = {}
	for slot in D.catalog().defaultLauncherBuild:
		var selected = part(raw.get("build",{}).get(slot,""))
		build[slot] = selected.id if selected.get("slot") == slot else D.catalog().defaultLauncherBuild[slot]
	var colors = D.catalog().defaultLauncherColors.duplicate()
	var regex = RegEx.new()
	regex.compile("^#[0-9a-fA-F]{6}$")
	for zone in colors:
		var value = str(raw.get("colors",{}).get(zone,""))
		if regex.search(value): colors[zone] = value.to_lower()
	return {"version":"launcher-v1","build":build,"colors":colors}

static func active_oil(samples: Array, config: Dictionary) -> Array:
	var codes = []
	for id in config.build.values():
		codes.append(part(id).code)
	var regex = RegEx.new()
	regex.compile("(?:^|_)([RTC]0[123])(?:_|$)")
	var result = []
	for sample in samples:
		var found = regex.search(sample.mesh)
		if found:
			if found.get_string(1) in codes: result.append(sample)
		elif sample.zone != "transmission" or config.build == D.catalog().defaultLauncherBuild:
			result.append(sample)
	return result

static func dose(samples: Array, zone: String) -> float:
	var amount = 0.0
	for sample in samples:
		if sample.zone == zone: amount += sample.amount
	return amount

static func oil_effects(raw: Dictionary = {}, config: Dictionary = {}) -> Dictionary:
	var samples = active_oil(raw.get("launcher",[]),normalize(config))
	var tip_dose = dose(raw.get("tip",[]),"tip")
	var transmission = dose(samples,"transmission")
	var wet = 1-exp(-transmission/2.2)
	var excess = clampf((transmission-6)/12,0,1)
	var contact = 1-exp(-tip_dose/2)
	var material = raw.get("material","stock")
	var rubber = material=="rubber" or (material=="stock" and raw.get("tipId","")=="tip.rubber_balance")
	return {"transmission":transmission,"efficiency":clampf(.72+.16*wet-.22*excess*excess,.5,.88),
		"excess":excess,"support":1-exp(-dose(samples,"support")/2.4),"pull":1-exp(-dose(samples,"pull")/2.4),
		"contact":contact,"traction":1-(.65 if rubber else .48)*contact,
		"groundSpin":1-.2*contact+.12*clampf((tip_dose-6)/12,0,1)}

static func launch_state(build: Dictionary, raw_config: Dictionary = {}, options: Dictionary = {}, effects: Dictionary = {}) -> Dictionary:
	if effects.is_empty(): effects = oil_effects()
	var config = normalize(raw_config)
	var power = clampf(float(options.get("power",.86)),.35,1)
	var height = clampf(float(options.get("height",.45)),0,1)
	var angle = clampf(float(options.get("angle",0)),-1,1)
	var direction = float(options.get("direction",0))
	var speed_scale = clampf(float(options.get("speedScale",1)),0,10)
	var speed = (3.4+build.launchForwardImpulse*power)*(.94+height*.12)*speed_scale
	var tilt = absf(angle)*.18+maxf(height-.55,0)*.08
	var lean = signf(angle) if angle!=0 else 1.0
	var initial = {"velocity":D.vec(sin(direction)*speed+cos(direction)*angle*.72*speed_scale,
		-cos(direction)*speed+sin(direction)*angle*.72*speed_scale),
		"spin":build.maxSpinSpeed*power*(1-absf(angle)*.08)*(1-height*.035),
		"spinDirection":-1 if options.get("spinDirection",1)<0 else 1,
		"tilt":tilt,"tiltVector":D.vec(cos(direction)*lean*tilt,sin(direction)*lean*tilt),"tiltRate":D.vec()}
	var rack = part(config.build.rack)
	var gear = part(config.build.transmission)
	var coupler = part(config.build.coupler)
	var inertia = build.momentOfInertia
	var ratio = gear.ratio
	var residual_inertia = .06*rack.mass/(ratio*ratio)+gear.inertia+coupler.inertia
	var input_budget = .5*(inertia+.14)*initial.spin*initial.spin/(.72*.99*.99)
	var effort = power*maxf(.4,1+.28*(ratio*ratio-1)*inertia/.89+.1*(rack.mass-1))
	var demand = clampf(effort,.35,2)
	var slip = maxf(0,demand-(1.12-effects.support*.53))
	var held_work = minf(1,(1.14-effects.pull*.58)/demand)
	var input_work = input_budget*minf(1,1/effort)*held_work
	var transmitted = input_work*effects.efficiency
	var elastic_fraction = clampf(.025*rack.flex*pow(effort/power,2),0,.15)
	var spring_energy = transmitted*elastic_fraction*.4
	var release_loss = (transmitted-spring_energy)*coupler.drag
	var available = maxf(0,transmitted-spring_energy-release_loss)
	var energy_limit = sqrt(2*available/(inertia+residual_inertia))
	var speed_limit = initial.spin*1.18*ratio*sqrt(effects.efficiency/.72)
	initial.spin = minf(energy_limit,speed_limit)
	var kinetic = .5*inertia*initial.spin*initial.spin
	var residual_energy = .5*residual_inertia*initial.spin*initial.spin
	var error_tilt = absf(angle)*.014*(coupler.alignment-1)*power
	initial.tiltVector.x += cos(direction)*error_tilt*lean
	initial.tiltVector.y += sin(direction)*error_tilt*lean
	var x = initial.velocity.x
	var y = initial.velocity.y
	var oil_direction = slip*.48
	initial.velocity = D.vec(x*cos(oil_direction)-y*sin(oil_direction),x*sin(oil_direction)+y*cos(oil_direction))
	var length = maxf(sqrt(x*x+y*y),1e-6)
	initial.tiltVector.x += -y/length*slip*.18
	initial.tiltVector.y += x/length*slip*.18
	initial.tilt = D.length(initial.tiltVector)
	initial.launcherTelemetry = {"version":"launcher-v1","ratio":ratio,"effort":effort,"inputBudget":input_budget,
		"inputWork":input_work,"kinetic":kinetic,"residualEnergy":residual_energy,"springEnergy":spring_energy,
		"releaseLoss":release_loss,"unusedEnergy":maxf(0,available-kinetic-residual_energy),
		"transmissionLoss":input_work-transmitted,"releaseMs":coupler.releaseMs,"initialSpin":initial.spin,
		"tilt":initial.tilt,"deviation":oil_direction,"limiting":"energy" if energy_limit<=speed_limit else "speed"}
	return initial
