extends SceneTree

const D = preload("res://scripts/battle/v6_data.gd")
const P = preload("res://scripts/battle/v6_dynamics.gd")
const L = preload("res://scripts/battle/v6_launcher.gd")
var failures: Array = []
var comparisons = 0
var max_error = 0.0

func _initialize() -> void:
	call_deferred("_run")

func compare(actual: Variant, expected: Variant, path: String) -> void:
	if expected is Dictionary:
		if not actual is Dictionary:
			failures.append(path+": not a dictionary")
			return
		for key in expected:
			if not actual.has(key): failures.append(path+"."+str(key)+": missing")
			else: compare(actual[key],expected[key],path+"."+str(key))
	elif expected is Array:
		if not actual is Array or actual.size()!=expected.size():
			failures.append(path+": array mismatch")
			return
		for i in expected.size(): compare(actual[i],expected[i],path+"["+str(i)+"]")
	elif expected is float or expected is int:
		var error = absf(float(actual)-float(expected))
		max_error = maxf(max_error,error)
		comparisons += 1
		if error>1e-8: failures.append("%s: %.12g vs %.12g" % [path,actual,expected])
	elif actual!=expected:
		failures.append(path+": value mismatch")

func _run() -> void:
	var fixtures = JSON.parse_string(FileAccess.get_file_as_string("res://resources/physics/v6_fixtures.json"))
	for fixture in fixtures.fixtures:
		for side in ["player","enemy"]:
			var expected_build = fixture.initial.context.builds[0 if side=="player" else 1]
			var ids = expected_build.selection
			var build = AssemblyCalculator.calculate_by_ids(ids.attackRing,ids.coreLock,ids.weightDisc,
				ids.driverShaft,ids.tip,expected_build.customizations)
			var actual_build = D.build_data(build)
			compare(actual_build,expected_build,fixture.id+"."+side+".build")
			var shape = P.structure(actual_build)
			compare(shape,fixture.initial[side].structure,fixture.id+"."+side+".structure")
			var config = fixture.initial.launchers[side]
			var raw_oil = fixture.options.get("maintenance",{}).get(side,{})
			compare(L.oil_effects(raw_oil,config),fixture.initial.maintenance[side],fixture.id+"."+side+".oil")
		var options = fixture.launch
		var actual = L.launch_state(fixture.initial.context.builds[0],
			fixture.initial.launchers.player,options,fixture.initial.maintenance.player)
		compare(actual.launcherTelemetry,fixture.initial.player.launcherTelemetry,fixture.id+".launch")
	print("V6 helper comparisons: ",comparisons," maximum error: ",max_error)
	for failure in failures.slice(0,30): printerr(failure)
	var report = {"comparisons":comparisons,"maxError":max_error,"failures":failures}
	var file = FileAccess.open("res://.impeccable/review/physics-v6/godot-helpers.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(report,"\t"))
	quit(0 if failures.is_empty() else 1)
