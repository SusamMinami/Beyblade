class_name BeybladeBody
extends RigidBody3D

signal durability_changed(
	body: BeybladeBody,
	damage: float,
	remaining_durability: float,
	attacker: BeybladeBody
)
signal durability_depleted(body: BeybladeBody)
signal part_damaged(
	part_index: int,
	part_id: StringName,
	damage_amount: float,
	integrity_ratio: float
)
signal part_detached(part_index: int, part_id: StringName)
signal part_broken(part_index: int, part_id: StringName)

const PART_NAMES: Array[String] = [
	"攻击环",
	"核心锁扣",
	"金属配重盘",
	"驱动中轴",
	"轴尖"
]
const PART_DURABILITY_WEIGHTS: Array[float] = [0.25, 0.2, 0.25, 0.15, 0.15]
const PART_DAMAGE_SHIFT_RADII: Array[float] = [0.42, 0.16, 0.32, 0.12, 0.08]
const UPRIGHT_COLLISION_PATTERN: Array[int] = [0, 0, 2, 0, 1]
const TILTED_COLLISION_PATTERN: Array[int] = [0, 2, 1, 3, 0]
const FALLEN_COLLISION_PATTERN: Array[int] = [4, 3, 2, 1, 0]

@export var min_active_spin_speed: float = 2.0
@export var minimum_damage_impulse: float = 0.35
@export var damage_per_impulse: float = 8.0
@export var collision_damage_cooldown: float = 0.12
@export var lateral_angular_damping: float = 0.16
@export var terrain_linear_drag: float = 0.45
@export var low_spin_linear_damping: float = 8.0
@export var high_spin_linear_damping: float = 0.22
@export var minimum_mobility_speed: float = 0.35

@onready var visual_model: FivePartTopModel = %VisualModel
@onready var light_collision_player: AudioStreamPlayer3D = %LightCollisionPlayer
@onready var heavy_collision_player: AudioStreamPlayer3D = %HeavyCollisionPlayer
@onready var part_break_player: AudioStreamPlayer3D = %PartBreakPlayer

var build_data: TopBuildData
var max_spin_speed: float = 0.0
var spin_decay_per_second: float = 0.0
var launch_forward_impulse: float = 0.0
var control_force: float = 0.0
var stability: float = 0.0
var control_response: float = 0.0
var attack_power: float = 0.0
var max_durability: float = 0.0
var current_durability: float = 0.0

var spin_speed: float = 0.0
var is_launched := false
var control_vector := Vector2.ZERO
var part_durabilities: Array[float] = []
var part_max_durabilities: Array[float] = []
var part_damage_directions: Array[Vector3] = []
var damage_center_of_mass_offset := Vector3.ZERO
var damage_wobble_strength: float = 0.0
var runtime_spin_decay_per_second: float = 0.0
var runtime_control_force: float = 0.0

var _base_mass: float = 0.0
var _base_center_of_mass := Vector3.ZERO
var _base_moment_of_inertia: float = 0.0
var _base_attack_power: float = 0.0
var _terrain_surface: TerrainSurfaceResource
var _runtime_lateral_angular_damping: float = 0.16
var _damage_wobble_phase: float = 0.0
var _collision_sequence := 0
var _damage_cooldowns: Dictionary = {}


func _ready() -> void:
	can_sleep = false
	contact_monitor = true
	max_contacts_reported = 8
	_apply_saved_build()
	reset_top()


func _apply_saved_build() -> void:
	var game_state = get_node_or_null("/root/GameState")
	var selected_build: TopBuildData
	if game_state != null:
		selected_build = game_state.get_build_data()
	else:
		selected_build = AssemblyCalculator.calculate_by_ids(
			&"attack_ring.balance_six",
			&"core_lock.standard",
			&"weight_disc.standard",
			&"driver_shaft.standard",
			&"tip.rubber_balance"
		)
	apply_build_data(selected_build)


func apply_build_data(new_build_data: TopBuildData) -> void:
	if new_build_data == null or not new_build_data.is_valid():
		push_error("BeybladeBody 收到无效的 TopBuildData")
		return

	build_data = new_build_data
	_base_mass = build_data.total_mass
	_base_center_of_mass = build_data.center_of_mass
	_base_moment_of_inertia = build_data.moment_of_inertia
	_base_attack_power = build_data.attack_power

	mass = _base_mass
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = _base_center_of_mass
	inertia = Vector3(
		_base_moment_of_inertia * 0.65,
		_base_moment_of_inertia,
		_base_moment_of_inertia * 0.65
	)

	var material := PhysicsMaterial.new()
	material.friction = build_data.friction
	material.bounce = build_data.restitution
	physics_material_override = material

	max_spin_speed = build_data.max_spin_speed
	spin_decay_per_second = build_data.spin_decay_per_second
	launch_forward_impulse = build_data.launch_forward_impulse
	control_force = build_data.control_force
	stability = build_data.stability
	control_response = build_data.control_response
	attack_power = _base_attack_power
	_initialize_damage_state()

	if is_node_ready():
		visual_model.configure(
			build_data.attack_ring.part_id,
			build_data.core_lock.part_id,
			build_data.weight_disc.part_id,
			build_data.driver_shaft.part_id,
			build_data.tip.part_id,
			_get_ring_color(),
			_get_core_color()
		)
		visual_model.set_active_part(-1)


func set_terrain_surface(surface: TerrainSurfaceResource) -> void:
	_terrain_surface = surface
	_recalculate_runtime_performance()


func _get_ring_color() -> Color:
	var game_state = get_node_or_null("/root/GameState")
	return game_state.custom_ring_color if game_state != null else Color(0.2, 0.75, 1.0)


func _get_core_color() -> Color:
	var game_state = get_node_or_null("/root/GameState")
	return game_state.custom_core_color if game_state != null else Color(0.95, 0.78, 0.25)


func _physics_process(delta: float) -> void:
	_update_damage_cooldowns(delta)
	if not is_launched:
		return

	spin_speed = move_toward(
		spin_speed,
		0.0,
		runtime_spin_decay_per_second * delta
	)

	var spin_axis := global_transform.basis.y.normalized()
	var axial_velocity := spin_axis * angular_velocity.dot(spin_axis)
	var lateral_velocity := angular_velocity - axial_velocity
	angular_velocity = lateral_velocity + spin_axis * spin_speed

	if lateral_velocity.length_squared() > 0.0001:
		apply_torque(-lateral_velocity * _runtime_lateral_angular_damping)

	if damage_wobble_strength > 0.001:
		_damage_wobble_phase += delta * (4.0 + spin_speed * 0.08)
		var spin_ratio := clampf(spin_speed / maxf(max_spin_speed, 0.001), 0.0, 1.0)
		var local_wobble := Vector3(
			cos(_damage_wobble_phase),
			0.0,
			sin(_damage_wobble_phase)
		)
		var wobble_direction := (global_transform.basis * local_wobble).normalized()
		var low_spin_amplification := lerpf(1.0, 0.45, spin_ratio)
		apply_torque(
			wobble_direction
			* damage_wobble_strength
			* low_spin_amplification
		)

	var control_direction := Vector3(control_vector.x, 0.0, control_vector.y)
	if control_direction.length_squared() > 0.01 and spin_speed > min_active_spin_speed:
		apply_central_force(
			control_direction.normalized()
			* runtime_control_force
			* _get_spin_mobility()
		)

	var drag_multiplier := (
		_terrain_surface.linear_drag_multiplier
		if _terrain_surface != null
		else 1.0
	)
	_apply_spin_coupled_movement(delta, drag_multiplier)

	if _terrain_surface != null and _terrain_surface.noise_strength > 0.0:
		var noise_direction := Vector3(
			sin(_damage_wobble_phase * 0.73),
			0.0,
			cos(_damage_wobble_phase * 1.13)
		)
		apply_torque(noise_direction * _terrain_surface.noise_strength)

	if spin_speed <= 0.001:
		is_launched = false
		angular_velocity = lateral_velocity


func _apply_spin_coupled_movement(
	delta: float,
	terrain_drag_multiplier: float = 1.0
) -> void:
	var mobility := _get_spin_mobility()
	var horizontal_velocity := Vector3(
		linear_velocity.x,
		0.0,
		linear_velocity.z
	)
	var damping := (
		lerpf(low_spin_linear_damping, high_spin_linear_damping, mobility)
		+ terrain_linear_drag * terrain_drag_multiplier
	)
	horizontal_velocity *= exp(-damping * delta)

	var maximum_speed := lerpf(
		minimum_mobility_speed,
		maxf(launch_forward_impulse * 2.2, minimum_mobility_speed),
		sqrt(mobility)
	)
	if horizontal_velocity.length() > maximum_speed:
		horizontal_velocity = horizontal_velocity.normalized() * maximum_speed
	linear_velocity = Vector3(
		horizontal_velocity.x,
		linear_velocity.y,
		horizontal_velocity.z
	)


func _get_spin_mobility() -> float:
	if max_spin_speed <= 0.0:
		return 0.0
	var spin_ratio := clampf(spin_speed / max_spin_speed, 0.0, 1.0)
	return smoothstep(0.02, 0.55, spin_ratio)


func get_control_influence() -> float:
	var runtime_ratio := runtime_control_force / maxf(control_force, 0.001)
	return clampf(
		control_vector.length() * _get_spin_mobility() * runtime_ratio,
		0.0,
		1.0
	)


func _integrate_forces(state: PhysicsDirectBodyState3D) -> void:
	if is_defeated():
		return

	var strongest_contacts: Dictionary = {}
	for contact_index in range(state.get_contact_count()):
		var collider := state.get_contact_collider_object(contact_index)
		if not collider is BeybladeBody or collider == self:
			continue
		var attacker := collider as BeybladeBody
		var attacker_id := attacker.get_instance_id()
		var impact_impulse := state.get_contact_impulse(contact_index).length()
		var previous_contact: Dictionary = strongest_contacts.get(attacker_id, {})
		if impact_impulse <= float(previous_contact.get("impulse", 0.0)):
			continue
		strongest_contacts[attacker_id] = {
			"attacker": attacker,
			"impulse": impact_impulse,
			"position": state.get_contact_local_position(contact_index)
		}

	for contact_data_variant in strongest_contacts.values():
		var contact_data := contact_data_variant as Dictionary
		var attacker := contact_data["attacker"] as BeybladeBody
		var attacker_id := attacker.get_instance_id()
		if float(_damage_cooldowns.get(attacker_id, 0.0)) > 0.0:
			continue
		var contact_position := contact_data["position"] as Vector3
		var target_part := _select_part_from_contact(contact_position)
		var damage_direction := Vector3(
			contact_position.x,
			0.0,
			contact_position.z
		)
		var applied_damage := apply_collision_damage(
			attacker,
			float(contact_data["impulse"]),
			target_part,
			damage_direction
		)
		if applied_damage > 0.0:
			_damage_cooldowns[attacker_id] = collision_damage_cooldown


func calculate_collision_damage(attacker: BeybladeBody, impact_impulse: float) -> float:
	if attacker == null or attacker == self:
		return 0.0
	var effective_impulse := maxf(impact_impulse - minimum_damage_impulse, 0.0)
	if effective_impulse <= 0.0:
		return 0.0
	return effective_impulse * damage_per_impulse * maxf(attacker.attack_power, 0.0)


func apply_collision_damage(
	attacker: BeybladeBody,
	impact_impulse: float,
	target_part_index: int = -1,
	damage_direction: Vector3 = Vector3.ZERO
) -> float:
	if is_defeated():
		return 0.0
	var calculated_damage := calculate_collision_damage(attacker, impact_impulse)
	var applied_damage := minf(calculated_damage, current_durability)
	if applied_damage <= 0.0:
		return 0.0

	var target_index := target_part_index
	if target_index < 0 or target_index >= part_durabilities.size():
		target_index = _select_pattern_part()
	_apply_distributed_part_damage(target_index, applied_damage, damage_direction)
	_play_collision_sound(applied_damage)
	durability_changed.emit(self, applied_damage, current_durability, attacker)
	_finish_damage_settlement()
	return applied_damage


func apply_part_damage(
	part_index: int,
	damage_amount: float,
	damage_direction: Vector3 = Vector3.RIGHT
) -> float:
	if is_defeated() or part_index < 0 or part_index >= part_durabilities.size():
		return 0.0
	var applied_damage := _damage_single_part(
		part_index,
		minf(damage_amount, part_durabilities[part_index]),
		damage_direction
	)
	if applied_damage <= 0.0:
		return 0.0
	_recalculate_damage_physics()
	durability_changed.emit(self, applied_damage, current_durability, null)
	_finish_damage_settlement()
	return applied_damage


func _apply_distributed_part_damage(
	target_part_index: int,
	damage_amount: float,
	damage_direction: Vector3
) -> void:
	var allocations: Array[float] = [0.0, 0.0, 0.0, 0.0, 0.0]
	allocations[target_part_index] += damage_amount * 0.72
	allocations[TopPartResource.PartType.CORE_LOCK] += damage_amount * 0.18
	allocations[TopPartResource.PartType.WEIGHT_DISC] += damage_amount * 0.1

	var remaining_damage := damage_amount
	for part_index in range(allocations.size()):
		var applied := _damage_single_part(
			part_index,
			allocations[part_index],
			damage_direction
		)
		remaining_damage -= applied

	if remaining_damage > 0.001:
		for offset in range(part_durabilities.size()):
			var part_index := posmod(target_part_index + offset, part_durabilities.size())
			var applied := _damage_single_part(
				part_index,
				remaining_damage,
				damage_direction
			)
			remaining_damage -= applied
			if remaining_damage <= 0.001:
				break

	_recalculate_damage_physics()


func _damage_single_part(
	part_index: int,
	damage_amount: float,
	damage_direction: Vector3
) -> float:
	if damage_amount <= 0.0 or part_durabilities[part_index] <= 0.0:
		return 0.0
	var previous_durability := part_durabilities[part_index]
	var applied_damage := minf(damage_amount, previous_durability)
	part_durabilities[part_index] = previous_durability - applied_damage

	var normalized_direction := _normalized_damage_direction(
		damage_direction,
		part_index
	)
	var previous_direction := part_damage_directions[part_index]
	part_damage_directions[part_index] = (
		normalized_direction
		if previous_direction.is_zero_approx()
		else (previous_direction * 0.35 + normalized_direction * 0.65).normalized()
	)

	var integrity_ratio := get_part_integrity_ratio(part_index)
	if is_instance_valid(visual_model):
		visual_model.set_part_damage_state(
			part_index,
			integrity_ratio,
			integrity_ratio <= 0.0
		)
		visual_model.flash_part_damage(part_index)

	var part_id := build_data.get_part_ids()[part_index]
	part_damaged.emit(part_index, part_id, applied_damage, integrity_ratio)
	if previous_durability > 0.0 and part_durabilities[part_index] <= 0.0:
		if is_instance_valid(part_break_player):
			part_break_player.play()
		part_detached.emit(part_index, part_id)
		part_broken.emit(part_index, part_id)
	return applied_damage


func _recalculate_damage_physics() -> void:
	if build_data == null or part_durabilities.size() != 5:
		return

	var parts := build_data.get_parts()
	var total_effective_mass := 0.0
	var weighted_center := Vector3.ZERO
	for part_index in range(parts.size()):
		var integrity := get_part_integrity_ratio(part_index)
		var remaining_mass_ratio := (
			0.0
			if integrity <= 0.0
			else lerpf(0.72, 1.0, integrity)
		)
		var effective_mass := parts[part_index].mass * remaining_mass_ratio
		var shifted_position := parts[part_index].center_of_mass_offset
		shifted_position -= (
			part_damage_directions[part_index]
			* PART_DAMAGE_SHIFT_RADII[part_index]
			* (1.0 - integrity)
			* 0.28
		)
		total_effective_mass += effective_mass
		weighted_center += shifted_position * effective_mass

	if total_effective_mass <= 0.001:
		current_durability = 0.0
		return

	var updated_center := weighted_center / total_effective_mass
	damage_center_of_mass_offset = updated_center - _base_center_of_mass
	mass = total_effective_mass
	center_of_mass = updated_center

	var mass_ratio := total_effective_mass / maxf(_base_mass, 0.001)
	var eccentricity_scale := 1.0 + damage_center_of_mass_offset.length() * 1.8
	var axial_inertia := maxf(
		_base_moment_of_inertia * mass_ratio * eccentricity_scale,
		0.01
	)
	inertia = Vector3(axial_inertia * 0.65, axial_inertia, axial_inertia * 0.65)

	current_durability = 0.0
	for part_durability in part_durabilities:
		current_durability += part_durability
	_recalculate_runtime_performance()


func _recalculate_runtime_performance() -> void:
	if build_data == null:
		return
	var surface_spin_damping := (
		_terrain_surface.spin_damping_multiplier
		if _terrain_surface != null
		else 1.0
	)
	var surface_control := (
		_terrain_surface.control_modifier
		if _terrain_surface != null
		else 1.0
	)
	var surface_stability := (
		_terrain_surface.stability_modifier
		if _terrain_surface != null
		else 1.0
	)
	var overall_loss := 1.0 - get_integrity_ratio()
	var ring_integrity := get_part_integrity_ratio(TopPartResource.PartType.ATTACK_RING)
	var core_integrity := get_part_integrity_ratio(TopPartResource.PartType.CORE_LOCK)
	var weight_integrity := get_part_integrity_ratio(TopPartResource.PartType.WEIGHT_DISC)
	var shaft_integrity := get_part_integrity_ratio(TopPartResource.PartType.DRIVER_SHAFT)
	var tip_integrity := get_part_integrity_ratio(TopPartResource.PartType.TIP)
	var detached_count := get_detached_part_count()
	var eccentricity := Vector2(
		damage_center_of_mass_offset.x,
		damage_center_of_mass_offset.z
	).length()

	runtime_spin_decay_per_second = spin_decay_per_second * surface_spin_damping * (
		1.0
		+ overall_loss * 0.65
		+ eccentricity * 10.0
		+ float(detached_count) * 0.55
		+ (1.0 - tip_integrity) * 0.6
	)
	runtime_control_force = control_force * surface_control * (
		lerpf(0.3, 1.0, tip_integrity)
		* lerpf(0.6, 1.0, shaft_integrity)
	)
	_runtime_lateral_angular_damping = lateral_angular_damping * stability * surface_stability * (
		lerpf(0.35, 1.0, weight_integrity)
		* lerpf(0.45, 1.0, shaft_integrity)
		* lerpf(0.6, 1.0, core_integrity)
	)
	attack_power = _base_attack_power * (
		lerpf(0.45, 1.0, ring_integrity)
		* lerpf(0.75, 1.0, weight_integrity)
	)
	damage_wobble_strength = (
		eccentricity * 12.0
		+ (1.0 - core_integrity) * 0.12
		+ (1.0 - weight_integrity) * 0.22
		+ (1.0 - shaft_integrity) * 0.3
		+ (1.0 - tip_integrity) * 0.15
		+ float(detached_count) * 0.18
	)


func _finish_damage_settlement() -> void:
	if not is_defeated():
		return
	is_launched = false
	spin_speed = 0.0
	angular_velocity = Vector3.ZERO
	durability_depleted.emit(self)


func is_defeated() -> bool:
	return max_durability > 0.0 and current_durability <= 0.001


func get_integrity_ratio() -> float:
	if max_durability <= 0.0:
		return 1.0
	return clampf(current_durability / max_durability, 0.0, 1.0)


func get_part_integrity_ratio(part_index: int) -> float:
	if (
		part_index < 0
		or part_index >= part_durabilities.size()
		or part_max_durabilities[part_index] <= 0.0
	):
		return 0.0
	return clampf(
		part_durabilities[part_index] / part_max_durabilities[part_index],
		0.0,
		1.0
	)


func get_most_damaged_part_index() -> int:
	var result := -1
	var lowest_integrity := INF
	for part_index in range(part_durabilities.size()):
		var integrity := get_part_integrity_ratio(part_index)
		if integrity < lowest_integrity:
			lowest_integrity = integrity
			result = part_index
	return result


func get_part_display_name(part_index: int) -> String:
	if part_index < 0 or part_index >= PART_NAMES.size():
		return "未知部件"
	return PART_NAMES[part_index]


func get_detached_part_count() -> int:
	var count := 0
	for part_durability in part_durabilities:
		if part_durability <= 0.0:
			count += 1
	return count


func launch(forward_direction: Vector3 = Vector3.FORWARD) -> void:
	if is_defeated():
		return
	is_launched = true
	spin_speed = max_spin_speed
	linear_velocity = Vector3.ZERO
	var spin_axis := global_transform.basis.y.normalized()
	angular_velocity = spin_axis * spin_speed
	apply_central_impulse(forward_direction.normalized() * launch_forward_impulse)


func reset_top() -> void:
	is_launched = false
	spin_speed = 0.0
	control_vector = Vector2.ZERO
	_damage_cooldowns.clear()
	_collision_sequence = 0
	_damage_wobble_phase = 0.0
	_initialize_damage_state()
	global_position = Vector3(0.0, 0.45, 0.0)
	global_rotation = Vector3.ZERO
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.ZERO


func set_control_vector(value: Vector2) -> void:
	control_vector = value.limit_length(1.0)


func _initialize_damage_state() -> void:
	if build_data == null:
		return
	part_max_durabilities.clear()
	part_durabilities.clear()
	part_damage_directions.clear()
	var parts := build_data.get_parts()
	for part_index in range(parts.size()):
		var part_durability := (
			parts[part_index].durability
			* PART_DURABILITY_WEIGHTS[part_index]
		)
		part_max_durabilities.append(part_durability)
		part_durabilities.append(part_durability)
		part_damage_directions.append(Vector3.ZERO)

	max_durability = 0.0
	for part_durability in part_max_durabilities:
		max_durability += part_durability
	current_durability = max_durability
	mass = _base_mass
	center_of_mass = _base_center_of_mass
	inertia = Vector3(
		_base_moment_of_inertia * 0.65,
		_base_moment_of_inertia,
		_base_moment_of_inertia * 0.65
	)
	damage_center_of_mass_offset = Vector3.ZERO
	damage_wobble_strength = 0.0
	attack_power = _base_attack_power
	if is_instance_valid(visual_model):
		visual_model.reset_damage_visuals()
	_recalculate_runtime_performance()


func _select_part_from_contact(local_position: Vector3) -> int:
	if local_position.y >= 0.08:
		return TopPartResource.PartType.ATTACK_RING
	if local_position.y >= 0.025:
		return TopPartResource.PartType.CORE_LOCK
	if local_position.y >= -0.045:
		return TopPartResource.PartType.WEIGHT_DISC
	if local_position.y >= -0.12:
		return TopPartResource.PartType.DRIVER_SHAFT
	return TopPartResource.PartType.TIP


func _select_pattern_part() -> int:
	_collision_sequence += 1
	var uprightness := absf(global_transform.basis.y.normalized().dot(Vector3.UP))
	var pattern: Array[int] = UPRIGHT_COLLISION_PATTERN
	if uprightness < 0.55:
		pattern = FALLEN_COLLISION_PATTERN
	elif uprightness < 0.82:
		pattern = TILTED_COLLISION_PATTERN
	return pattern[posmod(_collision_sequence, pattern.size())]


func _normalized_damage_direction(
	damage_direction: Vector3,
	part_index: int
) -> Vector3:
	var horizontal_direction := Vector3(
		damage_direction.x,
		0.0,
		damage_direction.z
	)
	if horizontal_direction.length_squared() > 0.0001:
		return horizontal_direction.normalized()
	var fallback_angle := deg_to_rad(
		float(part_index) * 137.5 + float(_collision_sequence) * 61.0
	)
	return Vector3(cos(fallback_angle), 0.0, sin(fallback_angle))


func _update_damage_cooldowns(delta: float) -> void:
	for attacker_id in _damage_cooldowns.keys():
		var remaining := float(_damage_cooldowns[attacker_id]) - delta
		if remaining <= 0.0:
			_damage_cooldowns.erase(attacker_id)
		else:
			_damage_cooldowns[attacker_id] = remaining


func _play_collision_sound(damage_amount: float) -> void:
	var player := heavy_collision_player if damage_amount >= 10.0 else light_collision_player
	if not is_instance_valid(player):
		return
	if player.playing:
		player.stop()
	player.pitch_scale = 0.97 + float(_collision_sequence % 5) * 0.015
	player.play()
