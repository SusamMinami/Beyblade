class_name StrategyInputSource
extends BattleInputSource

var _aggression_bias := 0.5
var _orbit_sign := 1.0
var _rng_seed: int


func _init(seed: int = 0, aggression_bias: float = 0.5) -> void:
	_rng_seed = seed if seed != 0 else Time.get_ticks_msec()
	_aggression_bias = clampf(aggression_bias, 0.15, 0.9)
	_orbit_sign = 1.0 if _seed_unit(99) > 0.5 else -1.0


func get_launch_command(slot: int) -> Dictionary:
	var power := 0.78 + _seed_unit(3) * 0.16
	var height := 0.45 + (_seed_unit(4) - 0.5) * 0.2
	var direction := (_seed_unit(5) - 0.5) * 0.24
	var angle := (_seed_unit(6) - 0.5) * 0.12
	return {
		"slot": slot,
		"power_q": BattleProtocol.quantize_power(power),
		"height_q": BattleProtocol.quantize_height(clampf(height, 0.0, 1.0)),
		"direction_q": BattleProtocol.quantize_direction(direction),
		"angle_q": BattleProtocol.quantize_angle(clampf(angle, -1.0, 1.0))
	}


func get_input(sim: BattleSimulation, slot: int, frame: int) -> Dictionary:
	var self_state: BattleSimulation.TopState
	var opponent_state: BattleSimulation.TopState
	if slot == BattleProtocol.SLOT_PLAYER:
		self_state = sim.player
		opponent_state = sim.enemy
	else:
		self_state = sim.enemy
		opponent_state = sim.player
	if self_state == null or opponent_state == null:
		return _zero_input(slot, frame)
	var to_opponent := opponent_state.position - self_state.position
	var distance := maxf(to_opponent.length(), 0.001)
	var pursuit := to_opponent / distance
	var orbit := Vector2(-pursuit.y * _orbit_sign, pursuit.x * _orbit_sign)
	var aggression := clampf(self_state.build.attack_power - 0.72 + _aggression_bias * 0.2, 0.15, 0.8)
	var retreat := Vector2.ZERO
	if self_state.position.length() > sim.arena.wall_radius * 0.78:
		retreat = -self_state.position.normalized() * 0.85
	var control := (
		pursuit * aggression
		+ orbit * (0.62 - aggression * 0.35)
		+ retreat
	)
	control = control.limit_length(1.0)
	return {
		"frame": frame,
		"slot": slot,
		"cx": BattleProtocol.quantize_control(control.x),
		"cy": BattleProtocol.quantize_control(control.y),
		"flags": 0
	}


func _zero_input(slot: int, frame: int) -> Dictionary:
	return {
		"frame": frame,
		"slot": slot,
		"cx": 0,
		"cy": 0,
		"flags": 0
	}


func _seed_unit(salt: int) -> float:
	var value := _uint32(_rng_seed + salt * 0x9e3779b9)
	value = _uint32(value ^ _uint32(value << 13))
	value = _uint32(value ^ (value >> 17))
	value = _uint32(value ^ _uint32(value << 5))
	return float(value) / 4294967295.0


func _uint32(value: int) -> int:
	return value & 0xffffffff
