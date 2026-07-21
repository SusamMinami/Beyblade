class_name FrameSyncProvider
extends RefCounted

signal phase_changed(new_phase: StringName)
signal state_updated(snapshot: Dictionary)
signal event_occurred(event: Dictionary)
signal battle_finished(result: Dictionary)
signal error_occurred(code: int, message: String)

var transport: BattleTransport
var sim: BattleSimulation
var my_slot: int = 0
var phase: StringName = BattleProtocol.PHASE_INIT
var local_input: LocalInputSource
var remote_inputs: Array[Dictionary] = []
var pending_launches: Dictionary = {}
var my_launch_submitted := false
var ready_sent := false
var confirmed_frame := 0
var latest_server_frame := 0
var input_queue: Dictionary = {}
var expected_inputs_for_frame := 2
var _local_seq := 0
var _last_sent_frame := -1
var _tick_accumulator := 0.0
var _hash_mismatches := 0


func _init(simulation: BattleSimulation, t: BattleTransport, slot: int) -> void:
	sim = simulation
	transport = t
	my_slot = slot
	local_input = LocalInputSource.new()
	input_queue[BattleProtocol.SLOT_PLAYER] = []
	input_queue[BattleProtocol.SLOT_ENEMY] = []


func start() -> void:
	_set_phase(BattleProtocol.PHASE_CONNECTING)
	if transport:
		transport.connect("message_received", Callable(self, "_on_message"))
		transport.connect("connected", Callable(self, "_on_connected"))
		transport.connect("disconnected", Callable(self, "_on_disconnected"))


func submit_ready() -> void:
	if ready_sent:
		return
	ready_sent = true
	_send(BattleProtocol.MSG_READY, {"slot": my_slot})


func submit_launch(power: float, height: float, direction: float, angle: float) -> void:
	local_input.set_launch(power, height, direction, angle)
	var cmd := local_input.get_launch_command(my_slot)
	_send(BattleProtocol.MSG_LAUNCH, BattleStateCodec.encode_launch_command(cmd))
	my_launch_submitted = true


func set_local_input(control: Vector2, flags: int = 0) -> void:
	local_input.set_input(control, flags)


func poll(delta: float) -> Dictionary:
	if transport:
		transport.poll()
	_tick_accumulator += delta
	_set_phase_from_sim()
	if phase != BattleProtocol.PHASE_RUNNING:
		return sim.snapshot() if sim else {}
	while _tick_accumulator >= BattleProtocol.FIXED_DT:
		_tick_accumulator -= BattleProtocol.FIXED_DT
		_advance_simulation_tick()
	var snap := sim.snapshot()
	_check_hash_if_needed(snap)
	return snap


func _advance_simulation_tick() -> void:
	var current_frame := sim.get_frame() + 1
	var player_ctrl := Vector2.ZERO
	var enemy_ctrl := Vector2.ZERO
	var p_input := _consume_input_for_frame(BattleProtocol.SLOT_PLAYER, current_frame)
	var e_input := _consume_input_for_frame(BattleProtocol.SLOT_ENEMY, current_frame)
	if my_slot == BattleProtocol.SLOT_PLAYER:
		player_ctrl = BattleProtocol.dequantize_vector2({"x": p_input.cx, "y": p_input.cy})
	else:
		enemy_ctrl = BattleProtocol.dequantize_vector2({"x": p_input.cx, "y": p_input.cy})
	if e_input != null:
		if my_slot == BattleProtocol.SLOT_ENEMY:
			player_ctrl = BattleProtocol.dequantize_vector2({"x": e_input.cx, "y": e_input.cy})
		else:
			enemy_ctrl = BattleProtocol.dequantize_vector2({"x": e_input.cx, "y": e_input.cy})
	sim.step(BattleProtocol.FIXED_DT, player_ctrl, enemy_ctrl)
	_process_events()
	_send_local_input_batch(current_frame)
	if sim.phase == &"finished":
		_handle_battle_end()


func _consume_input_for_frame(slot: int, frame: int) -> Dictionary:
	var queue: Array = input_queue.get(slot, [])
	for i in range(queue.size()):
		if int(queue[i].f) == frame:
			var result := queue[i].duplicate()
			queue.remove_at(i)
			return BattleStateCodec.decode_input_frame(result)
	if slot == my_slot:
		return local_input.get_input(sim, slot, frame)
	return {
		"frame": frame,
		"slot": slot,
		"cx": 0,
		"cy": 0,
		"flags": 0
	}


func _send_local_input_batch(frame: int) -> void:
	if frame - _last_sent_frame < BattleProtocol.INPUT_BATCH_SIZE:
		return
	_last_sent_frame = frame
	var batch: Array = []
	for f in range(frame - BattleProtocol.INPUT_BATCH_SIZE + 1, frame + 1):
		var inp := local_input.get_input(sim, my_slot, f)
		batch.append(BattleStateCodec.encode_input_frame(inp))
	_local_seq += 1
	_send(BattleProtocol.MSG_INPUT, {"frames": batch, "seq": _local_seq})


func _check_hash_if_needed(snap: Dictionary) -> void:
	if sim.get_frame() % BattleProtocol.HASH_CHECK_INTERVAL != 0:
		return
	var hash := BattleStateHasher.compute_snapshot_hash(snap)
	_send(BattleProtocol.MSG_HASH_CHECK, {"frame": sim.get_frame(), "hash": hash})


func _process_events() -> void:
	for ev in sim.events:
		emit_signal("event_occurred", ev)


func _handle_battle_end() -> void:
	_set_phase(BattleProtocol.PHASE_FINISHED)
	emit_signal("battle_finished", sim.result)


func _on_connected() -> void:
	_set_phase(BattleProtocol.PHASE_READY)
	_send(BattleProtocol.MSG_HELLO, {
		"protocol_version": BattleProtocol.PROTOCOL_VERSION,
		"simulation_version": BattleProtocol.SIMULATION_VERSION,
		"slot": my_slot
	})


func _on_message(msg: Dictionary) -> void:
	var type: String = str(msg.get("type", ""))
	match type:
		BattleProtocol.MSG_WELCOME:
			pass
		BattleProtocol.MSG_LAUNCH_WINDOW:
			_set_phase(BattleProtocol.PHASE_LAUNCH_WINDOW)
		BattleProtocol.MSG_LAUNCH_BOTH:
			_handle_launch_both(msg.data)
		BattleProtocol.MSG_INPUT_BATCH:
			_handle_input_batch(msg.data)
		BattleProtocol.MSG_RESULT:
			emit_signal("battle_finished", msg.data)
			_set_phase(BattleProtocol.PHASE_FINISHED)
		BattleProtocol.MSG_HASH_CHECK:
			_handle_hash_check(msg.data)
		BattleProtocol.MSG_ERROR:
			emit_signal("error_occurred", int(msg.data.get("code", -1)), str(msg.data.get("message", "error")))


func _handle_launch_both(data: Dictionary) -> void:
	if not phase == BattleProtocol.PHASE_LAUNCH_WINDOW or BattleProtocol.PHASE_READY:
		pass
	var p_cmd := BattleStateCodec.decode_launch_command(data.player)
	var e_cmd := BattleStateCodec.decode_launch_command(data.enemy)
	sim.launch_explicit(p_cmd, e_cmd)
	_set_phase(BattleProtocol.PHASE_RUNNING)


func _handle_input_batch(data: Dictionary) -> void:
	var frames: Array = data.get("frames", [])
	for f in frames:
		var decoded := BattleStateCodec.decode_input_frame(f)
		var slot := int(decoded.slot)
		if not input_queue.has(slot):
			input_queue[slot] = []
		input_queue[slot].append(f)


func _handle_hash_check(data: Dictionary) -> void:
	var remote_hash := str(data.get("hash", ""))
	var frame := int(data.get("frame", 0))
	var snap := sim.snapshot()
	var local_hash := BattleStateHasher.compute_snapshot_hash(snap)
	if remote_hash != "" and remote_hash != local_hash:
		_hash_mismatches += 1
		emit_signal("error_occurred", -2, "Hash mismatch at frame " + str(frame))


func _on_disconnected() -> void:
	_set_phase(BattleProtocol.PHASE_CLOSED)
	emit_signal("error_occurred", -1, "Disconnected")


func _set_phase(new_phase: StringName) -> void:
	if phase == new_phase:
		return
	phase = new_phase
	emit_signal("phase_changed", new_phase)


func _set_phase_from_sim() -> void:
	if sim == null:
		return
	if sim.phase == &"running" and phase != BattleProtocol.PHASE_RUNNING:
		_set_phase(BattleProtocol.PHASE_RUNNING)


func _send(type: String, data: Dictionary = {}) -> void:
	if transport and transport.is_connected():
		transport.send_message(BattleProtocol.make_envelope(type, data, _local_seq))


func disconnect() -> void:
	if transport:
		transport.disconnect()
