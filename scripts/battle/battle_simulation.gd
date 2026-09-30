class_name BattleSimulation
extends RefCounted

# Native public adapter: keeps existing resource/Vector2 APIs at the scene
# boundary, while the v6 solver and recovery data remain double precision.
const CORE = preload("res://scripts/battle/v6_simulation.gd")
const D = preload("res://scripts/battle/v6_data.gd")
const SIMULATION_VERSION = D.VERSION
const RESULT_SPIN_OUT = &"spin_out"
const RESULT_RING_OUT = &"ring_out"
const RESULT_BREAK = &"break"
const RESULT_TIME = &"time"
const RESULT_DRAW = &"draw"
const TOP_RADIUS = .69
const MIN_ACTIVE_SPIN = 2.0

class TopState:
	var build: TopBuildData
	var data: Dictionary
	var position: Vector2:
		get: return Vector2(data.position.x,data.position.y)
		set(value): data.position = {"x":float(value.x),"y":float(value.y)}
	var velocity: Vector2:
		get: return Vector2(data.velocity.x,data.velocity.y)
		set(value): data.velocity = {"x":float(value.x),"y":float(value.y)}
	var spin: float:
		get: return data.spin
		set(value): data.spin = value
	var durability: float:
		get: return data.durability
		set(value): data.durability = value
	var tilt: float:
		get: return data.tilt
		set(value):
			var previous = float(data.tilt)
			data.tilt = value
			if previous>1e-12:
				data.tiltVector.x *= value/previous
				data.tiltVector.y *= value/previous
			else:
				data.tiltVector = {"x":value,"y":0.0}
	var imbalance: float:
		get: return data.imbalance
		set(value): data.imbalance = value
	var control_input: Vector2:
		get: return Vector2(data.controlInput.x,data.controlInput.y)
	var control_influence: float:
		get: return data.controlInfluence
	var surface_name: String:
		get: return data.surfaceName
	var spin_loss_rate: float:
		get: return data.spinLossRate
	var ring_out_risk: float:
		get: return data.ringOutRisk
	var stability_state: StringName:
		get: return data.stabilityState
	var ring_risk_state: StringName:
		get: return data.ringRiskState
	var spin_risk_state: StringName:
		get: return data.spinRiskState

	func _init(resource: TopBuildData, state: Dictionary) -> void:
		build = resource
		data = state

	func _get(property: StringName) -> Variant:
		return data.get(String(property).to_camel_case())

var core: CORE
var player_build: TopBuildData
var enemy_build: TopBuildData
var arena: ArenaMapResource
var player: TopState
var enemy: TopState
var tuning: Dictionary = {}
var diagnostics = false
var logger: Callable
var phase: StringName:
	get: return core.phase
	set(value): core.phase = value
var time: float:
	get: return core.time
	set(value): core.time = value
var frame: int:
	get: return core.frame
	set(value): core.frame = value
var seed: int:
	get: return core.seed
var result: Dictionary:
	get: return {} if core.result==null else native_data(core.result)
var events: Array[Dictionary]:
	get:
		var value: Array[Dictionary] = []
		for event in core.events: value.append(native_data(event))
		return value
var collision_log: Array[Dictionary]:
	get:
		var value: Array[Dictionary] = []
		for event in core.collision_log: value.append(native_data(event))
		return value
var drive_zone: Dictionary:
	get: return core.drive_zone

func _init(a: TopBuildData, b: TopBuildData, map: ArenaMapResource, new_seed: int = 20260718,
	initial_tuning: Dictionary = {}, enable_diagnostics = false, diagnostic_logger: Callable = Callable(),
	rules: Dictionary = {}) -> void:
	player_build = a
	enemy_build = b
	arena = map
	diagnostics = enable_diagnostics
	logger = diagnostic_logger
	var options = rules.duplicate(true)
	options.seed = new_seed
	core = CORE.new(D.build_data(a),D.build_data(b),map.get_v6_record(),options)
	set_tuning(initial_tuning)
	bind_tops()

func bind_tops() -> void:
	player = TopState.new(player_build,core.player)
	enemy = TopState.new(enemy_build,core.enemy)

func reset() -> void:
	core.reset()
	bind_tops()

func set_tuning(next: Dictionary) -> void:
	for key in next:
		core.tuning[str(key).to_camel_case()] = float(next[key])
	for key in core.tuning:
		tuning[str(key).to_snake_case()] = core.tuning[key]

func launch(power: float = .86, direction: float = 0, angle: float = 0, height: float = .45, spin_direction: int = 1) -> void:
	core.launch({"power":power,"direction":direction,"angle":angle,"height":height,"spinDirection":spin_direction})
	bind_tops()

func launch_explicit(a: Dictionary, b: Dictionary) -> void:
	core.launch_explicit(a,b)
	bind_tops()

func step(delta: float, control: Vector2 = Vector2.ZERO, opponent: Vector2 = Vector2.INF) -> void:
	core.step(delta,D.vec(control.x,control.y),null if opponent==Vector2.INF else D.vec(opponent.x,opponent.y))
	if diagnostics and logger.is_valid():
		for event in events:
			if event.type=="collision": logger.call("[BattleSimulation] collision",event.telemetry)

func integrate_top(top: TopState, input: Vector2, delta: float, is_enemy: bool) -> void:
	core.integrate(top.data,D.vec(input.x,input.y),delta,is_enemy)

func _update_tilt(top: TopState, delta: float) -> void:
	core.update_tilt(top.data,delta)

func _resolve_collision() -> void:
	core.resolve_collision()

func _check_result() -> void:
	core.check_result()

func _get_enemy_control() -> Vector2:
	var value = core.enemy_control()
	return Vector2(value.x,value.y)

func _seed_unit(salt: int) -> float:
	return core.seed_unit(salt)

func get_frame() -> int:
	return core.frame

func export_state() -> Dictionary:
	return core.export_state()

func restore_state(value: Dictionary) -> bool:
	if not core.restore_state(value): return false
	bind_tops()
	set_tuning({})
	return true

func restore_from_snapshot(value: Dictionary) -> bool:
	# A rounded/legacy network snapshot cannot reconstruct v6 contact history.
	return restore_state(value)

static func native_data(value: Variant) -> Variant:
	if value is Dictionary:
		var converted = {}
		for key in value:
			if key in ["position","velocity","controlInput","tiltVector","tiltRate"] and value[key] is Dictionary:
				converted[str(key).to_snake_case()] = Vector2(value[key].x,value[key].y)
			else: converted[str(key).to_snake_case()] = native_data(value[key])
		return converted
	if value is Array:
		var converted = []
		for item in value: converted.append(native_data(item))
		return converted
	return value

func snapshot() -> Dictionary:
	var value = native_data(core.export_state())
	value.result = result
	value.erase("context")
	for side in ["player","enemy"]:
		value[side].spin_ratio = clampf(core[side].spin/core[side].build.maxSpinSpeed,0,1)
	return value
