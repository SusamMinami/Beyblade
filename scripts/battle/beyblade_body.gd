class_name BeybladeBody
extends RigidBody3D

signal durability_changed(
	body: BeybladeBody,
	damage: float,
	remaining_durability: float,
	attacker: BeybladeBody
)
signal durability_depleted(body: BeybladeBody)

@export var min_active_spin_speed: float = 2.0
@export var minimum_damage_impulse: float = 0.35
@export var damage_per_impulse: float = 8.0
@export var collision_damage_cooldown: float = 0.12

@onready var visual_model: FivePartTopModel = %VisualModel

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
var _damage_cooldowns: Dictionary = {}

func _ready() -> void:
	can_sleep = false
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
	mass = build_data.total_mass
	center_of_mass_mode = RigidBody3D.CENTER_OF_MASS_MODE_CUSTOM
	center_of_mass = build_data.center_of_mass
	inertia = Vector3(
		build_data.moment_of_inertia * 0.65,
		build_data.moment_of_inertia,
		build_data.moment_of_inertia * 0.65
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
	attack_power = build_data.attack_power
	max_durability = build_data.durability
	current_durability = max_durability

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

	spin_speed = maxf(spin_speed - spin_decay_per_second * delta, 0.0)
	angular_velocity = Vector3.UP * spin_speed

	var control_direction := Vector3(control_vector.x, 0.0, control_vector.y)
	if control_direction.length_squared() > 0.01 and spin_speed > min_active_spin_speed:
		apply_central_force(control_direction.normalized() * control_force)

	if spin_speed <= 0.0:
		is_launched = false
		angular_velocity = Vector3.ZERO


func _integrate_forces(state: PhysicsDirectBodyState3D) -> void:
	if is_defeated():
		return

	var strongest_impulse_by_attacker: Dictionary = {}
	for contact_index in range(state.get_contact_count()):
		var collider := state.get_contact_collider_object(contact_index)
		if not collider is BeybladeBody or collider == self:
			continue
		var attacker := collider as BeybladeBody
		var impact_impulse := state.get_contact_impulse(contact_index).length()
		var current_strongest := float(strongest_impulse_by_attacker.get(attacker, 0.0))
		if impact_impulse > current_strongest:
			strongest_impulse_by_attacker[attacker] = impact_impulse

	for attacker_variant in strongest_impulse_by_attacker:
		var attacker := attacker_variant as BeybladeBody
		var attacker_id := attacker.get_instance_id()
		if float(_damage_cooldowns.get(attacker_id, 0.0)) > 0.0:
			continue
		var applied_damage := apply_collision_damage(
			attacker,
			float(strongest_impulse_by_attacker[attacker])
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


func apply_collision_damage(attacker: BeybladeBody, impact_impulse: float) -> float:
	if is_defeated():
		return 0.0
	var calculated_damage := calculate_collision_damage(attacker, impact_impulse)
	var applied_damage := minf(calculated_damage, current_durability)
	if applied_damage <= 0.0:
		return 0.0

	current_durability = maxf(current_durability - applied_damage, 0.0)
	durability_changed.emit(self, applied_damage, current_durability, attacker)
	if is_defeated():
		is_launched = false
		spin_speed = 0.0
		angular_velocity = Vector3.ZERO
		durability_depleted.emit(self)
	return applied_damage


func is_defeated() -> bool:
	return max_durability > 0.0 and current_durability <= 0.0


func _update_damage_cooldowns(delta: float) -> void:
	for attacker_id in _damage_cooldowns.keys():
		var remaining := float(_damage_cooldowns[attacker_id]) - delta
		if remaining <= 0.0:
			_damage_cooldowns.erase(attacker_id)
		else:
			_damage_cooldowns[attacker_id] = remaining


func launch(forward_direction: Vector3 = Vector3.FORWARD) -> void:
	is_launched = true
	spin_speed = max_spin_speed
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.UP * spin_speed
	apply_central_impulse(forward_direction.normalized() * launch_forward_impulse)


func reset_top() -> void:
	is_launched = false
	spin_speed = 0.0
	control_vector = Vector2.ZERO
	_damage_cooldowns.clear()
	current_durability = max_durability
	global_position = Vector3(0.0, 0.45, 0.0)
	global_rotation = Vector3.ZERO
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.ZERO


func set_control_vector(value: Vector2) -> void:
	control_vector = value.limit_length(1.0)
