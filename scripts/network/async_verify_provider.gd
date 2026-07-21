class_name AsyncVerifyProvider
extends RefCounted

signal phase_changed(new_phase: StringName)
signal state_updated(snapshot: Dictionary)
signal event_occurred(event: Dictionary)
signal battle_finished(result: Dictionary)
signal replay_ready_to_submit(replay_envelope: Dictionary)
signal error_occurred(code: int, message: String)

var sim: BattleSimulation
var phase: StringName = BattleProtocol.PHASE_INIT
var local_input: LocalInputSource
var strategy: StrategyInputSource
var my_slot: int = BattleProtocol.SLOT_PLAYER
var player_launch_cmd: Dictionary = {}
var enemy_launch_cmd: Dictionary = {}
var enemy_build: TopBuildData
var arena_id: String = "standard"
var launch_submitted := false
var recorder: Array[Dictionary] = []
var checkpoints: Array[Dictionary] = []
var checkpoint_interval := BattleProtocol.HASH_CHECK_INTERVAL
var _tick_accumulator := 0.0
var enemy_input_source: BattleInputSource


func _init(simulation: BattleSimulation, slot: int = BattleProtocol.SLOT_PLAYER, ghost_seed: int = 0) -> void:
	sim = simulation
	my_slot = slot
	local_input = LocalInputSource.new()
	strategy = StrategyInputSource.new(ghost_seed, 0.5)
	enemy_input_source = strategy


func set_enemy_input_source(source: BattleInputSource) -> void:
	enemy_input_source = source


func start() -> void:
	_set_phase(BattleProtocol.PHASE_READY)


func submit_ready() -> void:
	_set_phase(BattleProtocol.PHASE_LAUNCH_WINDOW)


func submit_launch(power: float, height: float, direction: float, angle: float) -> void:
	local_input.set_launch(power, height, direction, angle)
	player_launch_cmd = local_input.get_launch_command(my_slot)
	enemy_launch_cmd = enemy_input_source.get_launch_command(1 - my_slot)
	launch_submitted = true
	if my_slot == BattleProtocol.SLOT_PLAYER:
		sim.launch_explicit(player_launch_cmd, enemy_launch_cmd)
	else:
		sim.launch_explicit(enemy_launch_cmd, player_launch_cmd)
	_set_phase(BattleProtocol.PHASE_RUNNING)
	recorder.clear()
	checkpoints.clear()
	_record_frame(0, true)


func set_local_input(control: Vector2, flags: int = 0) -> void:
	local_input.set_input(control, flags)


func poll(delta: float) -> Dictionary:
	_tick_accumulator += delta
	if phase != BattleProtocol.PHASE_RUNNING:
		return sim.snapshot() if sim else {}
	while _tick_accumulator >= BattleProtocol.FIXED_DT:
		_tick_accumulator -= BattleProtocol.FIXED_DT
		_advance_tick()
	var snap := sim.snapshot()
	emit_signal("state_updated", snap)
	return snap


func _advance_tick() -> void:
	var current_frame := sim.get_frame() + 1
	var player_ctrl: Vector2
	var enemy_ctrl: Vector2
	var p_in := local_input.get_input(sim, BattleProtocol.SLOT_PLAYER, current_frame)
	var e_in := enemy_input_source.get_input(sim, BattleProtocol.SLOT_ENEMY, current_frame)
	var p_vec := BattleProtocol.dequantize_vector2({"x": p_in.cx, "y": p_in.cy})
	var e_vec := BattleProtocol.dequantize_vector2({"x": e_in.cx, "y": e_in.cy})
	player_ctrl = p_vec
	enemy_ctrl = e_vec
	recorder.append({
		"f": current_frame,
		"p": BattleStateCodec.encode_input_frame(p_in),
		"e": BattleStateCodec.encode_input_frame(e_in)
	})
	sim.step(BattleProtocol.FIXED_DT, player_ctrl, enemy_ctrl)
	_record_frame(current_frame, false)
	_process_events()
	if sim.phase == &"finished":
		_finish_async()


func _record_frame(frame: int, is_launch: bool) -> void:
	if is_launch or frame % checkpoint_interval == 0:
		var snap := sim.snapshot()
		var hash := BattleStateHasher.compute_snapshot_hash(snap)
		checkpoints.append({
			"frame": frame,
			"hash": hash,
			"snapshot": BattleStateCodec.normalize_snapshot(snap)
		})


func _process_events() -> void:
	for ev in sim.events:
		emit_signal("event_occurred", ev)


func _finish_async() -> void:
	_set_phase(BattleProtocol.PHASE_FINISHED)
	var replay := _build_replay_envelope()
	emit_signal("battle_finished", sim.result)
	emit_signal("replay_ready_to_submit", replay)


func _build_replay_envelope() -> Dictionary:
	var final_snap := sim.snapshot()
	return {
		"manifest": {
			"protocol_version": BattleProtocol.PROTOCOL_VERSION,
			"simulation_version": BattleProtocol.SIMULATION_VERSION,
			"fixed_step_hz": BattleProtocol.FIXED_STEP_HZ
		},
		"mode": BattleProtocol.MODE_ASYNC_VERIFY,
		"seed": sim.seed,
		"arena_id": str(arena_id) if arena_id is String else "standard",
		"launches": {
			"player": BattleStateCodec.encode_launch_command(player_launch_cmd),
			"enemy": BattleStateCodec.encode_launch_command(enemy_launch_cmd)
		},
		"inputs": recorder,
		"checkpoints": checkpoints,
		"final_hash": BattleStateHasher.compute_snapshot_hash(final_snap),
		"result": sim.result
	}


func _set_phase(new_phase: StringName) -> void:
	if phase == new_phase:
		return
	phase = new_phase
	emit_signal("phase_changed", new_phase)
