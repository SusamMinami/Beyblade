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
var my_launch_submitted := false
var ready_sent := false
var confirmed_frame := 0
var input_queue: Dictionary = {}
var _tick_accumulator := 0.0
var _hash_mismatches := 0

var _last_sent_frame := -1
var _send_accumulator := 0.0
var _current_send_interval := 1.0 / BattleProtocol.SEND_RATE_MID_HZ
var _last_sent_cx := 0x7FFF
var _last_sent_cy := 0x7FFF
var _last_sent_fl := 0xFF
var _frames_since_input_change := 0
var _pending_frames: Array = []
var _force_send := false
var _last_intensity_level := 1


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
		transport.connect("error_occurred", Callable(self, "_on_transport_error"))


func submit_ready() -> void:
	if ready_sent:
		return
	ready_sent = true
	_send_binary(BattleStateCodec.encode_binary_ready(my_slot))


func submit_launch(power: float, height: float, direction: float, angle: float) -> void:
	local_input.set_launch(power, height, direction, angle)
	var pq := BattleProtocol.quantize_power(power)
	var hq := BattleProtocol.quantize_height(height)
	var dq := BattleProtocol.quantize_direction(direction)
	var aq := BattleProtocol.quantize_angle(angle)
	_send_binary(BattleStateCodec.encode_binary_launch(pq, hq, dq, aq))
	my_launch_submitted = true


func set_local_input(control: Vector2, flags: int = 0) -> void:
	local_input.set_input(control, flags)
	var cx := BattleProtocol.quantize_control(control.x)
	var cy := BattleProtocol.quantize_control(control.y)
	var fl := flags & BattleProtocol.FRAME_FLAGS_MASK
	if cx != _last_sent_cx or cy != _last_sent_cy or fl != _last_sent_fl:
		_frames_since_input_change = 0
		_force_send = true
	else:
		_frames_since_input_change += 1


func poll(delta: float) -> Dictionary:
	if transport:
		transport.poll()
	_set_phase_from_sim()
	if phase != BattleProtocol.PHASE_RUNNING:
		return sim.snapshot() if sim else {}
	_tick_accumulator += delta
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
		enemy_ctrl = BattleProtocol.dequantize_vector2({"x": e_input.cx, "y": e_input.cy})
	else:
		enemy_ctrl = BattleProtocol.dequantize_vector2({"x": p_input.cx, "y": p_input.cy})
		player_ctrl = BattleProtocol.dequantize_vector2({"x": e_input.cx, "y": e_input.cy})
	sim.step(BattleProtocol.FIXED_DT, player_ctrl, enemy_ctrl)
	_process_events()
	_queue_local_input(current_frame)
	_update_send_rate()
	_try_send_pending(current_frame)
	if sim.phase == &"finished":
		_handle_battle_end()


func _queue_local_input(frame: int) -> void:
	var inp := local_input.get_input(sim, my_slot, frame)
	_pending_frames.append({
		"f": frame,
		"cx": int(inp.cx),
		"cy": int(inp.cy),
		"fl": int(inp.get("flags", 0)) & BattleProtocol.FRAME_FLAGS_MASK,
	})


func _update_send_rate() -> void:
	var intensity := BattleProtocol.compute_intensity_level(sim)
	if intensity != _last_intensity_level:
		_last_intensity_level = intensity
		_force_send = true
	var hz := BattleProtocol.send_rate_for_level(intensity)
	_current_send_interval = 1.0 / hz


func _try_send_pending(current_frame: int) -> void:
	_send_accumulator += BattleProtocol.FIXED_DT
	var should_send := _force_send
	var idle_heartbeat := false
	if _send_accumulator >= _current_send_interval:
		should_send = true
		idle_heartbeat = true
	if _pending_frames.size() >= BattleProtocol.INPUT_BATCH_SIZE:
		should_send = true
	if not should_send or _pending_frames.is_empty():
		return
	_send_accumulator = 0.0
	_force_send = false
	var batch: Array = []
	var take := min(_pending_frames.size(), BattleProtocol.INPUT_BATCH_MAX)
	var first_frame := _pending_frames[0].f
	var last_frame := _pending_frames[take - 1].f
	for i in range(take):
		batch.append(_pending_frames[i])
	_pending_frames = _pending_frames.slice(take)
	if not batch.is_empty():
		var last := batch[-1]
		_last_sent_cx = int(last.cx)
		_last_sent_cy = int(last.cy)
		_last_sent_fl = int(last.fl)
		_last_sent_frame = int(last.f)
		_send_binary(BattleStateCodec.encode_binary_input_batch(batch))


func _consume_input_for_frame(slot: int, frame: int) -> Dictionary:
	var queue: Array = input_queue.get(slot, [])
	for i in range(queue.size()):
		if int(queue[i].f) == frame:
			var result := queue[i].duplicate()
			queue.remove_at(i)
			return {
				"frame": frame,
				"slot": slot,
				"cx": int(result.cx),
				"cy": int(result.cy),
				"flags": int(result.get("fl", result.get("flags", 0)))
			}
	if slot == my_slot:
		return local_input.get_input(sim, slot, frame)
	return {
		"frame": frame,
		"slot": slot,
		"cx": 0,
		"cy": 0,
		"flags": 0
	}


func _process_events() -> void:
	for ev in sim.events:
		emit_signal("event_occurred", ev)


func _handle_battle_end() -> void:
	_set_phase(BattleProtocol.PHASE_FINISHED)
	emit_signal("battle_finished", sim.result)


func _on_connected() -> void:
	_set_phase(BattleProtocol.PHASE_READY)
	_send_binary(BattleStateCodec.encode_binary_hello())


func _on_message(msg: Dictionary) -> void:
	var type_val: Variant = msg.get("type", "")
	if type_val is String:
		_on_text_message(type_val, msg.get("data", {}))
	elif type_val is int:
		_on_binary_message(int(type_val), msg.get("data", {}))


func _on_text_message(type_str: String, data: Dictionary) -> void:
	match type_str:
		"launch_window":
			_set_phase(BattleProtocol.PHASE_LAUNCH_WINDOW)
		"launch_both":
			_handle_launch_both(data)
		"input_batch":
			_handle_input_batch(data)
		"result":
			emit_signal("battle_finished", data)
			_set_phase(BattleProtocol.PHASE_FINISHED)
		"error":
			emit_signal("error_occurred", int(data.get("code", -1)), str(data.get("message", "error")))
		"room_state":
			pass


func _on_binary_message(type_id: int, data: Dictionary) -> void:
	match type_id:
		BattleProtocol.MSG_WELCOME:
			pass
		BattleProtocol.MSG_LAUNCH_WINDOW:
			_set_phase(BattleProtocol.PHASE_LAUNCH_WINDOW)
		BattleProtocol.MSG_LAUNCH_BOTH:
			_handle_binary_launch_both(data)
		BattleProtocol.MSG_INPUT_BATCH:
			_handle_binary_input_batch(data)
		BattleProtocol.MSG_RESULT:
			emit_signal("battle_finished", {"winner": int(data.get("winner", 0)), "reason": str(data.get("reason", ""))})
			_set_phase(BattleProtocol.PHASE_FINISHED)
		BattleProtocol.MSG_ERROR:
			emit_signal("error_occurred", int(data.get("code", -1)), str(data.get("message", "error")))
		BattleProtocol.MSG_ROOM_STATE:
			pass
		BattleProtocol.MSG_HASH_CHECK:
			_handle_hash_check(data)


func _handle_launch_both(data: Dictionary) -> void:
	var p_cmd := BattleStateCodec.decode_launch_command(data.player)
	var e_cmd := BattleStateCodec.decode_launch_command(data.enemy)
	sim.launch_explicit(p_cmd, e_cmd)
	_set_phase(BattleProtocol.PHASE_RUNNING)


func _handle_binary_launch_both(data: Dictionary) -> void:
	var p_raw: Dictionary = data.get("player", {})
	var e_raw: Dictionary = data.get("enemy", {})
	var own_cmd := {
		"power_q": int(p_raw.get("p", 0)),
		"height_q": int(p_raw.get("h", 0)),
		"direction_q": int(p_raw.get("d", 0)),
		"angle_q": int(p_raw.get("a", 0)),
	}
	var opp_cmd := {
		"power_q": int(e_raw.get("p", 0)),
		"height_q": int(e_raw.get("h", 0)),
		"direction_q": int(e_raw.get("d", 0)),
		"angle_q": int(e_raw.get("a", 0)),
	}
	if my_slot == BattleProtocol.SLOT_PLAYER:
		sim.launch_explicit(own_cmd, opp_cmd)
	else:
		sim.launch_explicit(opp_cmd, own_cmd)
	_set_phase(BattleProtocol.PHASE_RUNNING)


func _handle_input_batch(data: Dictionary) -> void:
	var frames: Array = data.get("frames", [])
	_ingest_remote_frames(frames)


func _handle_binary_input_batch(data: Dictionary) -> void:
	var frames: Array = data.get("frames", [])
	var sender_slot := int(data.get("sender_slot", 1 - my_slot))
	if not input_queue.has(sender_slot):
		input_queue[sender_slot] = []
	var q: Array = input_queue[sender_slot]
	for f in frames:
		q.append(f)


func _ingest_remote_frames(frames: Array) -> void:
	var remote_slot := 1 - my_slot
	if not input_queue.has(remote_slot):
		input_queue[remote_slot] = []
	var q: Array = input_queue[remote_slot]
	for f in frames:
		q.append(f)


func _check_hash_if_needed(snap: Dictionary) -> void:
	if sim.get_frame() % BattleProtocol.HASH_CHECK_INTERVAL != 0:
		return
	var hash := BattleStateHasher.compute_snapshot_hash(snap)
	_send_binary(BattleStateCodec.encode_binary_hash_check(sim.get_frame(), hash))


func _handle_hash_check(data: Dictionary) -> void:
	var remote_hash := str(data.get("hash", ""))
	var frame := int(data.get("frame", 0))
	var snap := sim.snapshot()
	var local_hash := BattleStateHasher.compute_snapshot_hash(snap)
	if remote_hash != "" and remote_hash != local_hash:
		_hash_mismatches += 1
		emit_signal("error_occurred", -2, "Hash mismatch at frame " + str(frame))


func _on_transport_error(code: int, message: String) -> void:
	emit_signal("error_occurred", code, message)


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


func _send_binary(data: PackedByteArray) -> void:
	if transport and transport.has_method("send_binary"):
		transport.send_binary(data)
	elif transport:
		transport.send_message({"payload": data})


func shutdown() -> void:
	if transport and transport.has_method("disconnect"):
		transport.disconnect()
