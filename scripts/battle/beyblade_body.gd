class_name BeybladeBody
extends RigidBody3D

signal part_damaged(
	part_index: int,
	part_id: StringName,
	damage_amount: float,
	integrity_ratio: float
)
signal part_broken(part_index: int, part_id: StringName)

const REAL_REFERENCE_RADIUS_M := 0.035
const REAL_REFERENCE_MASS_KG := 0.0416
const REAL_REFERENCE_AXIAL_INERTIA_KG_M2 := 2.368e-05
const SIMULATION_COLLIDER_RADIUS := 0.55
const SIMULATION_REFERENCE_MASS := 1.4
const LENGTH_SCALE := SIMULATION_COLLIDER_RADIUS / REAL_REFERENCE_RADIUS_M
const MASS_SCALE := SIMULATION_REFERENCE_MASS / REAL_REFERENCE_MASS_KG
const INERTIA_SCALE := MASS_SCALE * LENGTH_SCALE * LENGTH_SCALE
const PART_NAMES: Array[String] = ["攻击环", "核心锁扣", "金属配重盘", "驱动中轴", "轴尖"]
const UPRIGHT_COLLISION_PATTERN: Array[int] = [0, 0, 2, 0, 1]
const TILTED_COLLISION_PATTERN: Array[int] = [0, 2, 1, 3, 0]
const FALLEN_COLLISION_PATTERN: Array[int] = [4, 3, 2, 1, 0]

@export var max_spin_speed: float = 65.0
@export var spin_decay_per_second: float = 3.8
@export var launch_forward_impulse: float = 4.5
@export var control_force: float = 9.0
@export var min_active_spin_speed: float = 2.0
@export var lateral_angular_damping: float = 0.11
@export var collision_damage_scale: float = 0.55
@export var environment_damage_multiplier: float = 0.55
@export var minimum_damage_speed: float = 2.0
@export var collision_damage_cooldown: float = 0.14
@export var maximum_collision_damage: float = 55.0
@export var spin_contact_speed_scale: float = 0.04

@onready var visual_model: FivePartTopModel = %VisualModel
@onready var light_collision_player: AudioStreamPlayer3D = %LightCollisionPlayer
@onready var heavy_collision_player: AudioStreamPlayer3D = %HeavyCollisionPlayer
@onready var part_break_player: AudioStreamPlayer3D = %PartBreakPlayer

var spin_speed: float = 0.0
var is_launched: bool = false
var is_broken: bool = false
var broken_part_index: int = -1
var control_vector: Vector2 = Vector2.ZERO
var battle_snapshot: TopBattleSnapshot
var current_durability: float = 0.0
var max_durability: float = 0.0
var attack_power: float = 1.0
var part_durabilities: Array[float] = []
var part_max_durabilities: Array[float] = []
var runtime_spin_decay_per_second: float = 3.8
var runtime_control_force: float = 9.0
var runtime_lateral_angular_damping: float = 0.11
var base_spin_decay_per_second: float = 3.8
var base_control_force: float = 9.0
var base_lateral_angular_damping: float = 0.11
var base_attack_power: float = 1.0
var damage_wobble_strength: float = 0.0
var damage_wobble_phase: float = 0.0
var previous_linear_velocity: Vector3 = Vector3.ZERO
var collision_sequence: int = 0
var collision_frames: Dictionary = {}

func _ready() -> void:
	can_sleep = false
	contact_monitor = true
	max_contacts_reported = 8
	if not body_entered.is_connected(_on_body_entered):
		body_entered.connect(_on_body_entered)
	_apply_saved_build()
	reset_top()


func _apply_saved_build() -> void:
	var game_state = get_node_or_null("/root/GameState")
	if game_state == null:
		visual_model.set_active_part(-1)
		return
	visual_model.configure(
		game_state.selected_attack_ring,
		game_state.selected_core_lock,
		game_state.selected_weight_disc,
		game_state.selected_driver_shaft,
		game_state.selected_tip,
		game_state.custom_ring_color,
		game_state.custom_core_color
	)
	visual_model.set_active_part(-1)
	apply_battle_snapshot(game_state.get_battle_snapshot())


func apply_battle_snapshot(snapshot: TopBattleSnapshot) -> void:
	assert(snapshot != null and snapshot.is_valid(), "BeybladeBody requires a valid battle snapshot.")
	battle_snapshot = snapshot

	mass = snapshot.total_mass_kg * MASS_SCALE
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = snapshot.center_of_mass_m * LENGTH_SCALE
	inertia = snapshot.inertia_kg_m2 * INERTIA_SCALE

	var physics_material := PhysicsMaterial.new()
	physics_material.friction = snapshot.friction
	physics_material.bounce = snapshot.restitution
	physics_material_override = physics_material

	var inertia_decay_ratio := REAL_REFERENCE_AXIAL_INERTIA_KG_M2 / snapshot.inertia_kg_m2.y
	base_spin_decay_per_second = (
		spin_decay_per_second
		* snapshot.spin_damping_multiplier
		* inertia_decay_ratio
	)
	base_control_force = (
		control_force
		* snapshot.control_response
		* mass / SIMULATION_REFERENCE_MASS
	)
	base_lateral_angular_damping = lateral_angular_damping * snapshot.stability
	base_attack_power = snapshot.attack_power
	part_max_durabilities = snapshot.part_durabilities.duplicate()
	_reset_damage_state()


func _physics_process(delta: float) -> void:
	previous_linear_velocity = linear_velocity
	if not is_launched:
		return

	var updated_angular_velocity := angular_velocity
	updated_angular_velocity.y = move_toward(
		updated_angular_velocity.y,
		0.0,
		runtime_spin_decay_per_second * delta
	)
	angular_velocity = updated_angular_velocity
	spin_speed = absf(updated_angular_velocity.y)

	var lateral_angular_velocity := Vector3(
		angular_velocity.x,
		0.0,
		angular_velocity.z
	)
	if lateral_angular_velocity.length_squared() > 0.0001:
		apply_torque(-lateral_angular_velocity * runtime_lateral_angular_damping)

	if damage_wobble_strength > 0.001:
		damage_wobble_phase += delta * (4.0 + spin_speed * 0.08)
		var spin_ratio := clampf(spin_speed / max_spin_speed, 0.0, 1.0)
		var wobble_direction := Vector3(
			cos(damage_wobble_phase),
			0.0,
			sin(damage_wobble_phase)
		)
		apply_torque(wobble_direction * damage_wobble_strength * spin_ratio)

	var control_direction := Vector3(control_vector.x, 0.0, control_vector.y)
	if control_direction.length_squared() > 0.01 and spin_speed > min_active_spin_speed:
		apply_central_force(control_direction.normalized() * runtime_control_force)

	if spin_speed <= 0.001:
		is_launched = false


func launch(forward_direction: Vector3 = Vector3.FORWARD) -> void:
	if is_broken:
		return
	is_launched = true
	spin_speed = max_spin_speed
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3(angular_velocity.x, spin_speed, angular_velocity.z)
	apply_central_impulse(forward_direction.normalized() * launch_forward_impulse)


func reset_top() -> void:
	is_launched = false
	spin_speed = 0.0
	_reset_damage_state()
	control_vector = Vector2.ZERO
	previous_linear_velocity = Vector3.ZERO
	collision_sequence = 0
	collision_frames.clear()
	global_position = Vector3(0.0, 0.45, 0.0)
	global_rotation = Vector3.ZERO
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.ZERO


func set_control_vector(value: Vector2) -> void:
	control_vector = value.limit_length(1.0)


func apply_collision_damage(
	damage_amount: float,
	target_part_index: int
) -> void:
	if is_broken or damage_amount <= 0.0 or part_durabilities.size() != 5:
		return
	var target_index := clampi(target_part_index, 0, part_durabilities.size() - 1)
	var allocations: Array[float] = [0.0, 0.0, 0.0, 0.0, 0.0]
	allocations[target_index] += damage_amount * 0.82
	allocations[TopPartResource.PartType.CORE_LOCK] += damage_amount * 0.12
	allocations[TopPartResource.PartType.WEIGHT_DISC] += damage_amount * 0.06
	for part_index in range(allocations.size()):
		if allocations[part_index] <= 0.0:
			continue
		_apply_part_damage(part_index, allocations[part_index])
		if is_broken:
			break


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


func _on_body_entered(other_body: Node) -> void:
	if not is_launched or is_broken or battle_snapshot == null or other_body == self:
		return
	var collision_key := other_body.get_instance_id()
	var current_frame := Engine.get_physics_frames()
	var cooldown_frames := maxi(
		1,
		ceili(collision_damage_cooldown * Engine.physics_ticks_per_second)
	)
	var last_collision_frame := int(collision_frames.get(collision_key, -1000000))
	if current_frame - last_collision_frame < cooldown_frames:
		return
	collision_frames[collision_key] = current_frame

	var damage_amount := _calculate_collision_damage(other_body)
	if damage_amount <= 0.0:
		return
	var target_part_index := _select_collision_part(other_body)
	_play_collision_sound(damage_amount)
	apply_collision_damage(damage_amount, target_part_index)


func _calculate_collision_damage(other_body: Node) -> float:
	var relative_speed := previous_linear_velocity.length()
	var effective_mass := mass
	var incoming_attack_power := 1.0
	var spin_contact_speed := absf(spin_speed) * SIMULATION_COLLIDER_RADIUS
	var damage_multiplier := environment_damage_multiplier

	if other_body is BeybladeBody:
		var other_top := other_body as BeybladeBody
		relative_speed = (
			previous_linear_velocity - other_top.previous_linear_velocity
		).length()
		effective_mass = mass * other_top.mass / maxf(mass + other_top.mass, 0.001)
		incoming_attack_power = other_top.attack_power
		spin_contact_speed += (
			absf(other_top.spin_speed) * SIMULATION_COLLIDER_RADIUS
		)
		damage_multiplier = 1.0
	elif other_body is StaticBody3D:
		var body_name := String(other_body.name)
		if body_name.contains("Floor"):
			relative_speed = absf(previous_linear_velocity.y)
			spin_contact_speed = 0.0
		else:
			incoming_attack_power = lerpf(1.0, attack_power, 0.5)
			relative_speed = Vector2(
				previous_linear_velocity.x,
				previous_linear_velocity.z
			).length()
	else:
		return 0.0

	var effective_speed := relative_speed + spin_contact_speed * spin_contact_speed_scale
	if effective_speed <= minimum_damage_speed:
		return 0.0
	var impact_energy := 0.5 * effective_mass * (
		effective_speed * effective_speed
		- minimum_damage_speed * minimum_damage_speed
	)
	return clampf(
		impact_energy
		* collision_damage_scale
		* incoming_attack_power
		* damage_multiplier,
		0.0,
		maximum_collision_damage
	)


func _select_collision_part(other_body: Node) -> int:
	collision_sequence += 1
	if other_body is StaticBody3D:
		var body_name := String(other_body.name)
		if body_name.contains("Floor"):
			return TopPartResource.PartType.TIP
		return TopPartResource.PartType.ATTACK_RING

	var uprightness := absf(global_transform.basis.y.normalized().dot(Vector3.UP))
	var pattern: Array[int] = UPRIGHT_COLLISION_PATTERN
	if uprightness < 0.55:
		pattern = FALLEN_COLLISION_PATTERN
	elif uprightness < 0.82:
		pattern = TILTED_COLLISION_PATTERN
	return pattern[posmod(collision_sequence, pattern.size())]


func _apply_part_damage(part_index: int, damage_amount: float) -> void:
	if part_index < 0 or part_index >= part_durabilities.size():
		return
	var previous_durability := part_durabilities[part_index]
	part_durabilities[part_index] = maxf(previous_durability - damage_amount, 0.0)
	var integrity_ratio := get_part_integrity_ratio(part_index)
	visual_model.set_part_damage_state(part_index, integrity_ratio, integrity_ratio <= 0.0)
	visual_model.flash_part_damage(part_index)
	_recalculate_damage_performance()
	part_damaged.emit(
		part_index,
		battle_snapshot.part_ids[part_index],
		damage_amount,
		integrity_ratio
	)
	if previous_durability > 0.0 and part_durabilities[part_index] <= 0.0:
		_trigger_part_break(part_index)


func _trigger_part_break(part_index: int) -> void:
	if is_broken:
		return
	is_broken = true
	broken_part_index = part_index
	is_launched = false
	control_vector = Vector2.ZERO
	angular_velocity = Vector3(
		angular_velocity.x,
		angular_velocity.y * 0.18,
		angular_velocity.z
	)
	if part_break_player.playing:
		part_break_player.stop()
	part_break_player.play()
	part_broken.emit(part_index, battle_snapshot.part_ids[part_index])


func _reset_damage_state() -> void:
	part_durabilities = part_max_durabilities.duplicate()
	max_durability = 0.0
	for part_durability in part_max_durabilities:
		max_durability += part_durability
	current_durability = max_durability
	is_broken = false
	broken_part_index = -1
	damage_wobble_phase = 0.0
	if is_instance_valid(visual_model):
		visual_model.reset_damage_visuals()
	_recalculate_damage_performance()


func _recalculate_damage_performance() -> void:
	if part_durabilities.size() < 5:
		runtime_spin_decay_per_second = base_spin_decay_per_second
		runtime_control_force = base_control_force
		runtime_lateral_angular_damping = base_lateral_angular_damping
		attack_power = base_attack_power
		damage_wobble_strength = 0.0
		return

	var ring_integrity := get_part_integrity_ratio(TopPartResource.PartType.ATTACK_RING)
	var core_integrity := get_part_integrity_ratio(TopPartResource.PartType.CORE_LOCK)
	var weight_integrity := get_part_integrity_ratio(TopPartResource.PartType.WEIGHT_DISC)
	var shaft_integrity := get_part_integrity_ratio(TopPartResource.PartType.DRIVER_SHAFT)
	var tip_integrity := get_part_integrity_ratio(TopPartResource.PartType.TIP)

	attack_power = (
		base_attack_power
		* lerpf(0.48, 1.0, ring_integrity)
		* lerpf(0.78, 1.0, weight_integrity)
	)
	runtime_control_force = (
		base_control_force
		* lerpf(0.3, 1.0, tip_integrity)
		* lerpf(0.65, 1.0, shaft_integrity)
	)
	runtime_lateral_angular_damping = (
		base_lateral_angular_damping
		* lerpf(0.55, 1.0, weight_integrity)
		* lerpf(0.55, 1.0, shaft_integrity)
		* lerpf(0.7, 1.0, core_integrity)
	)
	runtime_spin_decay_per_second = base_spin_decay_per_second * (
		1.0
		+ (1.0 - ring_integrity) * 0.35
		+ (1.0 - core_integrity) * 0.2
		+ (1.0 - weight_integrity) * 0.4
		+ (1.0 - shaft_integrity) * 0.3
		+ (1.0 - tip_integrity) * 0.9
	)
	damage_wobble_strength = (
		(1.0 - core_integrity) * 0.22
		+ (1.0 - weight_integrity) * 0.5
		+ (1.0 - shaft_integrity) * 0.72
		+ (1.0 - tip_integrity) * 0.32
	)

	current_durability = 0.0
	for part_durability in part_durabilities:
		current_durability += part_durability


func _play_collision_sound(damage_amount: float) -> void:
	var player := heavy_collision_player if damage_amount >= 12.0 else light_collision_player
	if player.playing:
		player.stop()
	player.pitch_scale = 0.97 + float(collision_sequence % 5) * 0.015
	player.play()
