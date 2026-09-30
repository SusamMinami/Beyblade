extends SceneTree

const D = preload("res://scripts/battle/v6_data.gd")
const Sim = preload("res://scripts/battle/v6_simulation.gd")
var failures: Array = []
var comparisons = 0
var max_error = 0.0
var reports: Array = []
var recovery: Array = []

func _initialize() -> void:
	call_deferred("_run")

func compare(actual: Variant, expected: Variant, path: String, tolerance = 1e-4) -> void:
	if expected is Dictionary:
		if not actual is Dictionary:
			failures.append(path+": not a dictionary")
			return
		for key in expected:
			if not actual.has(key): failures.append(path+"."+str(key)+": missing")
			else: compare(actual[key],expected[key],path+"."+str(key),tolerance)
	elif expected is Array:
		if not actual is Array or actual.size()!=expected.size():
			failures.append(path+": array size mismatch")
			return
		for i in expected.size(): compare(actual[i],expected[i],path+"["+str(i)+"]",tolerance)
	elif expected is float or expected is int:
		if not (actual is float or actual is int):
			failures.append(path+": not a number")
			return
		var error = absf(float(actual)-float(expected))
		max_error = maxf(max_error,error)
		comparisons += 1
		if error>tolerance: failures.append("%s: %.14f vs %.14f" % [path,actual,expected])
	elif actual!=expected: failures.append(path+": value mismatch (%s vs %s)" % [actual,expected])

func native_build(expected: Dictionary) -> Dictionary:
	var ids = expected.selection
	return D.build_data(AssemblyCalculator.calculate_by_ids(ids.attackRing,ids.coreLock,ids.weightDisc,
		ids.driverShaft,ids.tip,expected.customizations))

func _run() -> void:
	var fixtures = JSON.parse_string(FileAccess.get_file_as_string("res://resources/physics/v6_fixtures.json"))
	for fixture in fixtures.fixtures:
		var start_failures = failures.size()
		var a = native_build(fixture.initial.context.builds[0])
		var b = native_build(fixture.initial.context.builds[1])
		var sim = Sim.new(a,b,D.catalog().arenas[fixture.initial.context.arena.id],fixture.options)
		sim.launch(fixture.launch)
		# Match explicit test arrangements; do not import Web dynamics.
		if fixture.id=="draw":
			sim.player.spin = 2.001
			sim.enemy.spin = 2.001
			sim.player.velocity = D.vec()
			sim.enemy.velocity = D.vec()
		elif fixture.id=="edge":
			sim.player.position = D.vec(6.95,0)
			sim.player.velocity = D.vec(.1,0)
		elif fixture.id=="impact":
			sim.player.position = D.vec(-.6,0)
			sim.enemy.position = D.vec(.6,0)
			sim.player.velocity = D.vec(3,0)
			sim.enemy.velocity = D.vec(-3,0)
		compare(sim.export_state(),fixture.initial,fixture.id+".initial")
		var restored = Sim.new(a,b,sim.arena,fixture.options)
		if not restored.restore_state(fixture.initial): failures.append(fixture.id+": Web restore rejected")
		var resume = sim.export_state()
		for i in fixture.inputs.size():
			var input = fixture.inputs[i]
			sim.step(1.0/60,input.player,input.enemy)
			restored.step(1.0/60,input.player,input.enemy)
			for point in fixture.checkpoints:
				if point.frame==i+1:
					compare(sim.export_state(),point.state,fixture.id+".frame"+str(i+1))
					compare(restored.export_state(),point.state,fixture.id+".web_resume"+str(i+1))
			if i==14:
				var state = sim.export_state()
				resume = state
				var text = JSON.stringify(state,"",true,true)
				if not restored.restore_state(JSON.parse_string(text)): failures.append(fixture.id+": native restore rejected")
				compare(restored.export_state(),state,fixture.id+".native_resume",1e-12)
				var corrupt = state.duplicate(true)
				corrupt.simulationVersion = "old"
				if restored.restore_state(corrupt): failures.append(fixture.id+": accepted obsolete state")
				compare(restored.export_state(),state,fixture.id+".atomic_reject",1e-12)
				var malformed = []
				corrupt = state.duplicate(true)
				corrupt.player.erase("spinPhase")
				malformed.append(corrupt)
				corrupt = state.duplicate(true)
				corrupt.enemy.velocity.erase("y")
				malformed.append(corrupt)
				corrupt = state.duplicate(true)
				corrupt.player.structure.erase("momentOfInertia")
				malformed.append(corrupt)
				corrupt = state.duplicate(true)
				corrupt.enemy.structure.parts[0].sectors[2] = "bad"
				malformed.append(corrupt)
				corrupt = state.duplicate(true)
				corrupt.player.edge.falling = 1
				malformed.append(corrupt)
				corrupt = state.duplicate(true)
				corrupt.tuning.controlScale = "1"
				malformed.append(corrupt)
				for bad in malformed:
					if restored.restore_state(bad): failures.append(fixture.id+": accepted malformed state")
				compare(restored.export_state(),state,fixture.id+".malformed_atomic_reject",1e-12)
		reports.append({"id":fixture.id,"frames":sim.frame,"result":sim.result,"failures":failures.size()-start_failures})
		recovery.append({"id":fixture.id,"initial":resume,
			"inputs":fixture.inputs.slice(int(resume.frame)),"final":sim.export_state()})
		print("V6 parity: ",fixture.id," frames=",sim.frame," failures=",failures.size()-start_failures)
	print("V6 comparisons: ",comparisons," maximum error: ",max_error)
	for failure in failures.slice(0,35): printerr(failure)
	var file = FileAccess.open("res://.impeccable/review/physics-v6/godot-parity.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"comparisons":comparisons,"maxError":max_error,"cases":reports,"failures":failures},"\t",true,true))
	var recovery_file = FileAccess.open("res://.impeccable/review/physics-v6/native-recovery.json",FileAccess.WRITE)
	recovery_file.store_string(JSON.stringify(recovery,"",true,true))
	quit(0 if failures.is_empty() else 1)
