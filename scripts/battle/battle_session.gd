class_name BattleSession
extends RefCounted

signal phase_changed(new_phase: StringName)
signal state_updated(snapshot: Dictionary)
signal event_occurred(event: Dictionary)
signal battle_finished(result: Dictionary)
signal replay_ready(replay: Dictionary)
signal error_occurred(code: int, message: String)
signal connected_to_room
signal disconnected_from_room

var mode: StringName
var transport: BattleTransport
var sim: BattleSimulation
var provider: RefCounted
var my_slot: int = BattleProtocol.SLOT_PLAYER
var player_build: TopBuildData
var enemy_build: TopBuildData
var arena: ArenaMapResource
var seed: int
var phase: StringName = BattleProtocol.PHASE_INIT
var local_ticket: Dictionary = {}
var _interpolated_snapshot: Dictionary = {}
var _snapshot_history: Array[Dictionary] = []
var _max_history := 30


static func create_local_ai_battle(
	p_build: TopBuildData,
	e_build: TopBuildData,
	arena_res: ArenaMapResource,
	battle_seed: int = 20260718
) -> BattleSession:
	var session := BattleSession.new()
	session.mode = BattleProtocol.MODE_LOCAL
	session.player_build = p_build
	session.enemy_build = e_build
	session.arena = arena_res
	session.seed = battle_seed
	session.sim = BattleSimulation.new(p_build, e_build, arena_res, battle_seed)
	session.my_slot = BattleProtocol.SLOT_PLAYER
	var ai_source := StrategyInputSource.new(battle_seed + 1, 0.5)
	session._setup_local_provider(ai_source)
	session._set_phase(BattleProtocol.PHASE_READY)
	return session


static func create_frame_sync_battle(
	p_build: TopBuildData,
	e_build: TopBuildData,
	arena_res: ArenaMapResource,
	battle_seed: int,
	t: BattleTransport,
	slot: int
) -> BattleSession:
	var session := BattleSession.new()
	session.mode = BattleProtocol.MODE_FRAME_SYNC
	session.player_build = p_build
	session.enemy_build = e_build
	session.arena = arena_res
	session.seed = battle_seed
	session.transport = t
	session.sim = BattleSimulation.new(p_build, e_build, arena_res, battle_seed)
	session.my_slot = slot
	var fp := FrameSyncProvider.new(session.sim, t, slot)
	session.provider = fp
	fp.connect("phase_changed", Callable(session, "_on_provider_phase"))
	fp.connect("event_occurred", Callable(session, "_on_provider_event"))
	fp.connect("battle_finished", Callable(session, "_on_provider_finished"))
	fp.connect("error_occurred", Callable(session, "_on_provider_error"))
	fp.start()
	return session


static func create_async_verify_battle(
	p_build: TopBuildData,
	e_build: TopBuildData,
	arena_res: ArenaMapResource,
	battle_seed: int,
	ghost_source: BattleInputSource = null,
	slot: int = BattleProtocol.SLOT_PLAYER
) -> BattleSession:
	var session := BattleSession.new()
	session.mode = BattleProtocol.MODE_ASYNC_VERIFY
	session.player_build = p_build
	session.enemy_build = e_build
	session.arena = arena_res
	session.seed = battle_seed
	session.sim = BattleSimulation.new(p_build, e_build, arena_res, battle_seed)
	session.my_slot = slot
	var ap := AsyncVerifyProvider.new(session.sim, slot, battle_seed + 77)
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
	transport.connect("connected", Callable(self, "_on_transport_connected"))
	transport.connect("disconnected", Callable(self, "_on_transport_disconnected"))
	_set_phase(BattleProtocol.PHASE_CONNECTING)
	transport.connect_to_room(url, ticket)


func submit_ready() -> void:
	if provider and provider.has_method("submit_ready"):
		provider.submit_ready()


func submit_launch(power: float, height: float, direction: float, angle: float) -> void:
	if mode == BattleProtocol.MODE_LOCAL:
		sim.launch(power, direction, angle, height)
		_set_phase(BattleProtocol.PHASE_RUNNING)
		return
	if provider and provider.has_method("submit_launch"):
		provider.submit_launch(power, height, direction, angle)


func set_local_input(control: Vector2, flags: int = 0) -> void:
	if mode == BattleProtocol.MODE_LOCAL:
		return
	if provider and provider.has_method("set_local_input"):
		provider.set_local_input(control, flags)


func poll(delta: float) -> Dictionary:
	if mode == BattleProtocol.MODE_LOCAL:
		if sim.phase == &"running":
			sim.step(delta)
			for ev in sim.events:
				emit_signal("event_occurred", ev)
			if sim.phase == &"finished":
				_set_phase(BattleProtocol.PHASE_FINISHED)
				emit_signal("battle_finished", sim.result)
		var snap := sim.snapshot()
		_track_snapshot(snap)
		emit_signal("state_updated", snap)
		return snap
	if provider and provider.has_method("poll"):
		var snap: Dictionary = provider.poll(delta)
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


func disconnect() -> void:
	if provider and provider.has_method("disconnect"):
		provider.disconnect()
	if transport:
		transport.disconnect()


func _setup_local_provider(ai_source: BattleInputSource) -> void:
	pass


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


func _on_provider_phase(new_phase: StringName) -> void:
	_set_phase(new_phase)


func _on_state_updated(snap: Dictionary) -> void:
	_track_snapshot(snap)


func _on_provider_event(ev: Dictionary) -> void:
	emit_signal("event_occurred", ev)


func _on_provider_finished(result: Dictionary) -> void:
	_set_phase(BattleProtocol.PHASE_FINISHED)
	emit_signal("battle_finished", result)


func _on_replay_ready(replay: Dictionary) -> void:
	emit_signal("replay_ready", replay)


func _on_provider_error(code: int, message: String) -> void:
	emit_signal("error_occurred", code, message)


func _on_transport_connected() -> void:
	emit_signal("connected_to_room")


func _on_transport_disconnected() -> void:
	emit_signal("disconnected_from_room")
