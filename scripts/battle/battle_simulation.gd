class_name BattleSimulation
extends RefCounted

const RESULT_SPIN_OUT := &"spin_out"
const RESULT_RING_OUT := &"ring_out"
const RESULT_BREAK := &"break"
const RESULT_TIME := &"time"

const TOP_RADIUS := 0.69
const MIN_ACTIVE_SPIN := 2.0
const MIN_DAMAGE_IMPULSE := 0.35
const DAMAGE_PER_IMPULSE := 1.1
const MAX_BATTLE_TIME := 75.0


class TopState:
	var build: TopBuildData
	var position: Vector2
	var velocity := Vector2.ZERO
	var spin := 0.0
	var durability := 0.0
	var tilt := 0.0
	var surface_name := ""
	var control_input := Vector2.ZERO
	var control_influence := 0.0

	func _init(build_data: TopBuildData, start_position: Vector2) -> void:
		build = build_data
		position = start_position
		durability = build_data.durability


var player_build: TopBuildData
var enemy_build: TopBuildData
var arena: ArenaMapResource
var seed: int
var tuning: Dictionary

var phase := &"ready"
var time := 0.0
var result: Dictionary = {}
var events: Array[Dictionary] = []
var collision_cooldown := 0.0
var player: TopState
var enemy: TopState


func _init(
	new_player_build: TopBuildData,
	new_enemy_build: TopBuildData,
	new_arena: ArenaMapResource,
	new_seed: int = 20260718,
	initial_tuning: Dictionary = {}
) -> void:
	player_build = new_player_build
	enemy_build = new_enemy_build
	arena = new_arena
	seed = _uint32(new_seed)
	tuning = {
		"damage_scale": 1.0,
		"spin_scale": 1.0,
		"control_scale": 1.0,
		"speed_scale": 1.0
	}
	set_tuning(initial_tuning)
	reset()


func reset() -> void:
	phase = &"ready"
	time = 0.0
	result.clear()
	events.clear()
	collision_cooldown = 0.0
	player = TopState.new(player_build, Vector2(0.0, 4.45))
	enemy = TopState.new(enemy_build, Vector2(0.0, -4.45))


func set_tuning(next_tuning: Dictionary) -> void:
	for key in next_tuning:
		var normalized_key := _normalize_tuning_key(str(key))
		if tuning.has(normalized_key):
			tuning[normalized_key] = float(next_tuning[key])


func launch(
	power: float = 0.86,
	direction: float = 0.0,
	angle: float = 0.0
) -> void:
	reset()
	phase = &"running"
	var launch_power := clampf(power, 0.35, 1.0)
	var launch_angle := clampf(angle, -1.0, 1.0)
	var speed_scale := _tuning_value("speed_scale")
	var player_speed := (
		3.4 + player_build.launch_forward_impulse * launch_power
	) * speed_scale
	var enemy_power := 0.78 + _seed_unit(3) * 0.16
	var enemy_speed := (
		3.4 + enemy_build.launch_forward_impulse * enemy_power
	) * speed_scale

	player.velocity = Vector2(
		sin(direction) * player_speed + launch_angle * 0.72,
		-cos(direction) * player_speed
	)
	var enemy_direction := (_seed_unit(5) - 0.5) * 0.24
	enemy.velocity = Vector2(
		sin(enemy_direction) * enemy_speed,
		cos(enemy_direction) * enemy_speed
	)
	player.spin = (
		player_build.max_spin_speed
		* launch_power
		* (1.0 - absf(launch_angle) * 0.08)
	)
	enemy.spin = enemy_build.max_spin_speed * enemy_power
	player.tilt = absf(launch_angle) * 0.18
	enemy.tilt = _seed_unit(7) * 0.08
	events.append({"type": &"launch", "power": launch_power})


func step(delta: float, player_control: Vector2 = Vector2.ZERO) -> void:
	events.clear()
	if phase != &"running":
		return

	var dt := clampf(delta, 0.0, 1.0 / 30.0)
	time += dt
	collision_cooldown = maxf(collision_cooldown - dt, 0.0)

	var enemy_control := _get_enemy_control()
	integrate_top(player, player_control, dt, false)
	integrate_top(enemy, enemy_control, dt, true)
	_resolve_collision()
	_update_tilt(player, dt)
	_update_tilt(enemy, dt)
	_check_result()


func integrate_top(
	top: TopState,
	input: Vector2,
	delta: float,
	is_enemy: bool
) -> void:
	var radius := top.position.length()
	var current_surface := arena.get_surface_at_radius(radius)
	if current_surface == null:
		return
	top.surface_name = current_surface.surface_name

	top.spin = maxf(
		top.spin
		- top.build.spin_decay_per_second
		* current_surface.spin_damping_multiplier
		* _tuning_value("spin_scale")
		* delta,
		0.0
	)

	var spin_ratio := clampf(
		top.spin / maxf(top.build.max_spin_speed, 0.001),
		0.0,
		1.0
	)
	var raw_control := Vector2(
		clampf(input.x, -1.0, 1.0),
		clampf(input.y, -1.0, 1.0)
	)
	var control_magnitude := clampf(raw_control.length(), 0.0, 1.0)
	var control := raw_control.normalized() if raw_control.length() > 0.00001 else Vector2.ZERO
	var mobility := _smoothstep(0.02, 0.55, spin_ratio)
	var control_acceleration := (
		top.build.control_force
		/ top.build.total_mass
		* current_surface.control_modifier
		* _tuning_value("control_scale")
		* mobility
	)
	top.velocity += control * control_acceleration * delta
	top.control_input = control * control_magnitude
	top.control_influence = clampf(
		control_magnitude
		* mobility
		* current_surface.control_modifier
		* top.build.control_response,
		0.0,
		1.0
	)

	if radius > 0.01:
		var inward := -top.position / radius
		var bowl_acceleration := arena.bowl_force * (
			0.4 + radius / arena.wall_radius
		)
		top.velocity += inward * bowl_acceleration * delta

	var center := top.build.center_of_mass
	var eccentricity := Vector2(center.x, center.z).length()
	if eccentricity > 0.005 and spin_ratio > 0.05:
		var wobble_phase := (
			time * (5.2 + spin_ratio * 3.1)
			+ (2.1 if is_enemy else 0.4)
			+ float(seed) * 0.0001
		)
		var wobble := eccentricity * 6.5 * (1.2 - top.build.stability)
		top.velocity += Vector2(
			cos(wobble_phase),
			sin(wobble_phase)
		) * wobble * delta

	if current_surface.noise_strength > 0.0:
		var noise := sin(
			time * 17.0
			+ float(seed) * 0.17
			+ (4.0 if is_enemy else 0.0)
		) * current_surface.noise_strength
		top.velocity.x += noise * delta
		top.velocity.y -= noise * 0.7 * delta

	var drag := (
		0.17
		* top.build.friction
		* current_surface.surface_friction
		* current_surface.linear_drag_multiplier
		+ (1.0 - mobility) * 8.0
	)
	top.velocity *= exp(-drag * delta)

	var max_speed := (
		0.35
		+ (8.15 + top.build.attack_power * 1.5) * sqrt(mobility)
	) * _tuning_value("speed_scale")
	if top.velocity.length() > max_speed:
		top.velocity = top.velocity.normalized() * max_speed
	top.position += top.velocity * delta
	_resolve_arena_rim(top, current_surface)


func _resolve_arena_rim(
	top: TopState,
	surface: TerrainSurfaceResource
) -> void:
	var radius := top.position.length()
	if radius <= arena.wall_radius or radius >= arena.ring_out_radius:
		return
	var normal := top.position / radius
	var outward_speed := top.velocity.dot(normal)
	if outward_speed >= 9.2:
		return

	top.position = normal * (arena.wall_radius - 0.03)
	if outward_speed > 0.0:
		var rebound := outward_speed * (
			1.0 + surface.bounce_multiplier * 0.52
		)
		top.velocity -= normal * rebound
		top.spin = maxf(top.spin - outward_speed * 0.24, 0.0)


func _get_enemy_control() -> Vector2:
	var to_player := player.position - enemy.position
	var distance := maxf(to_player.length(), 0.001)
	var pursuit := to_player / distance
	var orbit_sign := 1.0 if _seed_unit(11) > 0.5 else -1.0
	var orbit := Vector2(-pursuit.y * orbit_sign, pursuit.x * orbit_sign)
	var aggression := clampf(enemy.build.attack_power - 0.72, 0.15, 0.7)
	var retreat := Vector2.ZERO
	if enemy.position.length() > arena.wall_radius * 0.78:
		retreat = -enemy.position.normalized() * 0.85
	return (
		pursuit * aggression
		+ orbit * (0.62 - aggression * 0.35)
		+ retreat
	)


func _resolve_collision() -> void:
	var offset := enemy.position - player.position
	var distance := offset.length()
	var minimum_distance := TOP_RADIUS * 2.0
	if distance >= minimum_distance or distance <= 0.00001:
		return

	var normal := offset / distance
	var relative_velocity := enemy.velocity - player.velocity
	var normal_speed := relative_velocity.dot(normal)
	var overlap := minimum_distance - distance
	player.position -= normal * overlap * 0.5
	enemy.position += normal * overlap * 0.5
	if normal_speed >= 0.0:
		return

	var player_surface := arena.get_surface_at_radius(player.position.length())
	var enemy_surface := arena.get_surface_at_radius(enemy.position.length())
	if player_surface == null or enemy_surface == null:
		return
	var restitution := clampf(
		(player.build.restitution + enemy.build.restitution) * 0.5,
		0.12,
		0.82
	) * (
		(player_surface.bounce_multiplier + enemy_surface.bounce_multiplier)
		* 0.5
	)
	var inverse_player_mass := 1.0 / player.build.total_mass
	var inverse_enemy_mass := 1.0 / enemy.build.total_mass
	var impulse := (
		-(1.0 + restitution) * normal_speed
		/ (inverse_player_mass + inverse_enemy_mass)
	)

	player.velocity -= normal * impulse * inverse_player_mass
	enemy.velocity += normal * impulse * inverse_enemy_mass

	if collision_cooldown <= 0.0 and impulse > MIN_DAMAGE_IMPULSE:
		var base_damage := (
			(impulse - MIN_DAMAGE_IMPULSE)
			* DAMAGE_PER_IMPULSE
			* _tuning_value("damage_scale")
		)
		var damage_to_player := (
			base_damage
			* enemy.build.attack_power
			* enemy_surface.damage_multiplier
		)
		var damage_to_enemy := (
			base_damage
			* player.build.attack_power
			* player_surface.damage_multiplier
		)
		player.durability = maxf(
			player.durability - damage_to_player,
			0.0
		)
		enemy.durability = maxf(
			enemy.durability - damage_to_enemy,
			0.0
		)
		player.spin = maxf(player.spin - impulse * 0.19, 0.0)
		enemy.spin = maxf(enemy.spin - impulse * 0.19, 0.0)
		collision_cooldown = 0.12
		events.append({
			"type": &"collision",
			"impulse": impulse,
			"intensity": clampf(impulse / 7.0, 0.0, 1.0),
			"position": (player.position + enemy.position) * 0.5
		})


func _update_tilt(top: TopState, delta: float) -> void:
	var speed := top.velocity.length()
	var spin_ratio := clampf(
		top.spin / maxf(top.build.max_spin_speed, 0.001),
		0.0,
		1.0
	)
	var instability := clampf(1.15 - top.build.stability, 0.0, 0.8)
	var target_tilt := clampf(
		instability * 0.5 + speed * 0.012 + (1.0 - spin_ratio) * 0.32,
		0.0,
		0.62
	)
	top.tilt += (target_tilt - top.tilt) * minf(delta * 4.0, 1.0)


func _check_result() -> void:
	if player.durability <= 0.0:
		_finish(&"enemy", RESULT_BREAK)
		return
	if player.position.length() > arena.ring_out_radius:
		_finish(&"enemy", RESULT_RING_OUT)
		return
	if player.spin <= MIN_ACTIVE_SPIN:
		_finish(&"enemy", RESULT_SPIN_OUT)
		return

	if enemy.durability <= 0.0:
		_finish(&"player", RESULT_BREAK)
		return
	if enemy.position.length() > arena.ring_out_radius:
		_finish(&"player", RESULT_RING_OUT)
		return
	if enemy.spin <= MIN_ACTIVE_SPIN:
		_finish(&"player", RESULT_SPIN_OUT)
		return

	if time >= MAX_BATTLE_TIME:
		var player_score := (
			player.spin
			+ player.durability / player.build.durability * 20.0
		)
		var enemy_score := (
			enemy.spin
			+ enemy.durability / enemy.build.durability * 20.0
		)
		_finish(
			&"player" if player_score >= enemy_score else &"enemy",
			RESULT_TIME
		)


func _finish(winner: StringName, reason: StringName) -> void:
	phase = &"finished"
	result = {
		"winner": winner,
		"reason": reason,
		"time": time
	}
	events.append({
		"type": &"result",
		"winner": winner,
		"reason": reason,
		"time": time
	})


func snapshot() -> Dictionary:
	return {
		"phase": phase,
		"time": _rounded(time),
		"result": (
			{}
			if result.is_empty()
			else {
				"winner": result.winner,
				"reason": result.reason,
				"time": _rounded(result.time)
			}
		),
		"player": _top_snapshot(player),
		"enemy": _top_snapshot(enemy)
	}


func _top_snapshot(top: TopState) -> Dictionary:
	return {
		"position": Vector2(
			_rounded(top.position.x),
			_rounded(top.position.y)
		),
		"velocity": Vector2(
			_rounded(top.velocity.x),
			_rounded(top.velocity.y)
		),
		"spin": _rounded(top.spin),
		"durability": _rounded(top.durability),
		"tilt": _rounded(top.tilt),
		"surface_name": top.surface_name,
		"control_influence": _rounded(top.control_influence)
	}


func _normalize_tuning_key(key: String) -> String:
	match key:
		"damageScale":
			return "damage_scale"
		"spinScale":
			return "spin_scale"
		"controlScale":
			return "control_scale"
		"speedScale":
			return "speed_scale"
		_:
			return key


func _tuning_value(key: String) -> float:
	return float(tuning.get(key, 1.0))


func _seed_unit(salt: int) -> float:
	var value := _uint32(seed + salt * 0x9e3779b9)
	value = _uint32(value ^ _uint32(value << 13))
	value = _uint32(value ^ (value >> 17))
	value = _uint32(value ^ _uint32(value << 5))
	return float(value) / 4294967295.0


func _uint32(value: int) -> int:
	return value & 0xffffffff


func _smoothstep(edge_from: float, edge_to: float, value: float) -> float:
	var ratio := clampf(
		(value - edge_from) / (edge_to - edge_from),
		0.0,
		1.0
	)
	return ratio * ratio * (3.0 - 2.0 * ratio)


func _rounded(value: float) -> float:
	return roundf(value * 1000000.0) / 1000000.0
