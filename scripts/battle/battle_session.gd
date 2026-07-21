extends RefCounted

const BattleProtocolRef := preload("res://scripts/battle/battle_protocol.gd")
const BattleSimulationRef := preload("res://scripts/battle/battle_simulation.gd")

signal phase_changed(new_phase)
signal state_updated(snapshot)
signal event_occurred(event)
signal battle_finished(result)
signal replay_ready(replay)
signal error_occurred(code, message)
signal connected_to_room
signal disconnected_from_room

var mode: StringName
var transport: RefCounted
var sim: RefCounted
var provider: RefCounted
var my_slot: int = BattleProtocolRef.SLOT_PLAYER
var player_build
var enemy_build
var arena
var seed: int
var phase: StringName = BattleProtocolRef.PHASE_INIT
var local_ticket: Dictionary = {}
var _local_input: Vector2 = Vector2.ZERO
var _interpolated_snapshot: Dictionary = {}
var _snapshot_history: Array = []
var _max_history := 30


static func create_local_ai_battle(
	p_build,
	e_build,
	arena_res,
	battle_seed: int = 20260718
):
	var session_script := load("res://scripts/battle/battle_session.gd")
	var session = session_script.new()
	session.mode = BattleProtocolRef.MODE_LOCAL
	session.player_build = p_build
	session.enemy_build = e_build
	session.arena = arena_res
	session.seed = battle_seed
	session.sim = BattleSimulationRef.new(p_build, e_build, arena_res, battle_seed)
	session.my_slot = BattleProtocolRef.SLOT_PLAYER
	session._set_phase(BattleProtocolRef.PHASE_LAUNCH_WINDOW)
	return session


static func create_frame_sync_battle(
	p_build,
	e_build,
	arena_res,
	battle_seed: int,
	t,
	slot: int
):
	var FrameSyncProviderRef := load("res://scripts/network/frame_sync_provider.gd")
	var session_script := load("res://scripts/battle/battle_session.gd")
	var session = session_script.new()
	session.mode = BattleProtocolRef.MODE_FRAME_SYNC
	session.player_build = p_build
	session.enemy_build = e_build
	session.arena = arena_res
	session.seed = battle_seed
	session.transport = t
	session.sim = BattleSimulationRef.new(p_build, e_build, arena_res, battle_seed)
	session.my_slot = slot
	var fp = FrameSyncProviderRef.new(session.sim, t, slot)
	session.provider = fp
	fp.connect("phase_changed", Callable(session, "_on_provider_phase"))
	fp.connect("event_occurred", Callable(session, "_on_provider_event"))
	fp.connect("battle_finished", Callable(session, "_on_provider_finished"))
	fp.connect("error_occurred", Callable(session, "_on_provider_error"))
	fp.start()
	return session


static func create_async_verify_battle(
	p_build,
	e_build,
	arena_res,
	battle_seed: int,
	ghost_source = null,
	slot: int = BattleProtocolRef.SLOT_PLAYER
):
	var AsyncVerifyProviderRef := load("res://scripts/network/async_verify_provider.gd")
	var session_script := load("res://scripts/battle/battle_session.gd")
	var session = session_script.new()
	session.mode = BattleProtocolRef.MODE_ASYNC_VERIFY
	session.player_build = p_build
	session.enemy_build = e_build
	session.arena = arena_res
	session.seed = battle_seed
	session.sim = BattleSimulationRef.new(p_build, e_build, arena_res, battle_seed)
	session.my_slot = slot
	var ap = AsyncVerifyProviderRef.new(session.sim, slot, battle_seed + 77)
	if ghost_source != null:
		ap.set_enemy_input_source(ghost_source)
	session.provider = ap
	ap.connect("phase_changed", Callable(session, "_on_provider_phase"))
	ap.connect("state_updated", Callable(session, "_on_state_updated"))
	ap.connect("event_occurred", Callable(session, "_on_provider_event"))
	ap.connect("battle_finished", Callable(session, "_on_provider_finished"))
	ap.connect("replay_ready_to_submit", Callable(session, "_on_replay_ready"))
	ap.connect("error_occurred", Callable(session, "_on_provider_error"))
	ap.start()
	return session


func connect_to_room(url: String, ticket: Dictionary = {}) -> void:
	if transport == null:
		emit_signal("error_occurred", -1, "No transport configured")
		return
	local_ticket = ticket
	if transport.has_signal("connected"):
		transport.connect("connected", Callable(self, "_on_transport_connected"))
	if transport.has_signal("disconnected"):
		transport.connect("disconnected", Callable(self, "_on_transport_disconnected"))
	_set_phase(BattleProtocolRef.PHASE_CONNECTING)
	transport.connect_to_room(url, ticket)


func submit_ready() -> void:
	if mode == BattleProtocolRef.MODE_LOCAL:
		_set_phase(BattleProtocolRef.PHASE_LAUNCH_WINDOW)
		return
	if provider and provider.has_method("submit_ready"):
		provider.submit_ready()


func submit_launch(power: float, height: float, direction: float, angle: float) -> void:
	if mode == BattleProtocolRef.MODE_LOCAL:
		sim.launch(power, direction, angle, height)
		_set_phase(BattleProtocolRef.PHASE_RUNNING)
		return
	if provider and provider.has_method("submit_launch"):
		provider.submit_launch(power, height, direction, angle)


func set_local_input(control: Vector2, flags: int = 0) -> void:
	_local_input = control
	if mode == BattleProtocolRef.MODE_LOCAL:
		return
	if provider and provider.has_method("set_local_input"):
		provider.set_local_input(control, flags)


func poll(delta: float) -> Dictionary:
	if mode == BattleProtocolRef.MODE_LOCAL:
		if sim.phase == &"running":
			sim.step(delta, _local_input)
			for ev in sim.events:
				emit_signal("event_occurred", ev)
			if sim.phase == &"finished":
				_set_phase(BattleProtocolRef.PHASE_FINISHED)
				emit_signal("battle_finished", sim.result)
		var snap = sim.snapshot()
		_track_snapshot(snap)
		emit_signal("state_updated", snap)
		return snap
	if provider and provider.has_method("poll"):
		var snap = provider.poll(delta)
		_track_snapshot(snap)
		emit_signal("state_updated", snap)
		return snap
	return sim.snapshot() if sim else {}


func get_render_snapshot() -> Dictionary:
	if _snapshot_history.size() >= 2:
		return _interpolated_snapshot if not _interpolated_snapshot.is_empty() else _snapshot_history[-1]
	return sim.snapshot() if sim else {}


func get_my_slot() -> int:
	return my_slot


func close_session() -> void:
	if provider and provider.has_method("shutdown"):
		provider.shutdown()
	if transport and transport.has_method("shutdown"):
		transport.shutdown()


func _track_snapshot(snap: Dictionary) -> void:
	_snapshot_history.append(snap)
	if _snapshot_history.size() > _max_history:
		_snapshot_history.pop_front()
	_interpolated_snapshot = snap


func _set_phase(new_phase: StringName) -> void:
	if phase == new_phase:
		return
	phase = new_phase
	emit_signal("phase_changed", new_phase)


func _on_provider_phase(new_phase) -> void:
	_set_phase(new_phase)


func _on_state_updated(snap) -> void:
	_track_snapshot(snap)


func _on_provider_event(ev) -> void:
	emit_signal("event_occurred", ev)


func _on_provider_finished(result) -> void:
	_set_phase(BattleProtocolRef.PHASE_FINISHED)
	emit_signal("battle_finished", result)


func _on_replay_ready(replay) -> void:
	emit_signal("replay_ready", replay)


func _on_provider_error(code, message) -> void:
	emit_signal("error_occurred", code, message)


func _on_transport_connected() -> void:
	emit_signal("connected_to_room")


func _on_transport_disconnected() -> void:
	emit_signal("disconnected_from_room")
