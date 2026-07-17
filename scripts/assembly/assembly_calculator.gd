class_name AssemblyCalculator
extends RefCounted

const REFERENCE_MASS := 1.22
const REFERENCE_INERTIA := 0.89
const BASE_SPIN_DECAY := 3.8
const BASE_MAX_SPIN_SPEED := 65.0
const BASE_LAUNCH_IMPULSE := 4.5
const BASE_CONTROL_FORCE := 9.0

static func calculate_by_ids(
	attack_ring_id: StringName,
	core_lock_id: StringName,
	weight_disc_id: StringName,
	driver_shaft_id: StringName,
	tip_id: StringName
) -> TopBuildData:
	return calculate(
		PartDatabase.get_part(attack_ring_id),
		PartDatabase.get_part(core_lock_id),
		PartDatabase.get_part(weight_disc_id),
		PartDatabase.get_part(driver_shaft_id),
		PartDatabase.get_part(tip_id)
	)


static func calculate(
	attack_ring: TopPartResource,
	core_lock: TopPartResource,
	weight_disc: TopPartResource,
	driver_shaft: TopPartResource,
	tip: TopPartResource
) -> TopBuildData:
	var result := TopBuildData.new()
	result.attack_ring = _accept_type(attack_ring, TopPartResource.PartType.ATTACK_RING)
	result.core_lock = _accept_type(core_lock, TopPartResource.PartType.CORE_LOCK)
	result.weight_disc = _accept_type(weight_disc, TopPartResource.PartType.WEIGHT_DISC)
	result.driver_shaft = _accept_type(driver_shaft, TopPartResource.PartType.DRIVER_SHAFT)
	result.tip = _accept_type(tip, TopPartResource.PartType.TIP)

	var parts := result.get_parts()
	for part in parts:
		if part == null:
			return result

	result.total_mass = _sum_mass(parts)
	result.center_of_mass = _calculate_center_of_mass(parts, result.total_mass)
	result.moment_of_inertia = _sum_inertia(parts)
	result.contact_area = _sum_contact_area(parts)

	result.friction = clampf(
		attack_ring.friction * 0.15
		+ weight_disc.friction * 0.1
		+ tip.friction * 0.75,
		0.05,
		1.0
	)
	result.restitution = clampf(
		attack_ring.restitution * 0.55
		+ weight_disc.restitution * 0.25
		+ driver_shaft.restitution * 0.05
		+ tip.restitution * 0.15,
		0.0,
		1.0
	)

	result.stability = _calculate_stability(
		attack_ring,
		core_lock,
		weight_disc,
		driver_shaft,
		tip,
		result.center_of_mass
	)
	result.control_response = _calculate_control_response(
		attack_ring,
		core_lock,
		weight_disc,
		driver_shaft,
		tip,
		result.total_mass
	)
	result.attack_power = (
		attack_ring.attack_power * 0.4
		+ core_lock.attack_power * 0.05
		+ weight_disc.attack_power * 0.3
		+ driver_shaft.attack_power * 0.15
		+ tip.attack_power * 0.1
	)
	result.durability = (
		attack_ring.durability * 0.25
		+ core_lock.durability * 0.2
		+ weight_disc.durability * 0.25
		+ driver_shaft.durability * 0.15
		+ tip.durability * 0.15
	)

	var damping_multiplier := (
		attack_ring.spin_damping_multiplier * 0.15
		+ core_lock.spin_damping_multiplier * 0.05
		+ weight_disc.spin_damping_multiplier * 0.1
		+ driver_shaft.spin_damping_multiplier * 0.1
		+ tip.spin_damping_multiplier * 0.6
	)
	var instability_decay := clampf(1.0 / result.stability, 0.78, 1.4)
	result.spin_decay_per_second = BASE_SPIN_DECAY * damping_multiplier * instability_decay

	result.max_spin_speed = BASE_MAX_SPIN_SPEED * sqrt(
		REFERENCE_INERTIA / result.moment_of_inertia
	)
	result.launch_forward_impulse = BASE_LAUNCH_IMPULSE * pow(
		result.total_mass / REFERENCE_MASS,
		0.75
	)
	result.collision_momentum = result.launch_forward_impulse
	result.control_force = BASE_CONTROL_FORCE * result.control_response
	return result


static func _accept_type(
	part: TopPartResource,
	expected_type: TopPartResource.PartType
) -> TopPartResource:
	if part == null or part.part_type != expected_type:
		return null
	return part


static func _sum_mass(parts: Array[TopPartResource]) -> float:
	var total := 0.0
	for part in parts:
		total += part.mass
	return total


static func _sum_inertia(parts: Array[TopPartResource]) -> float:
	var total := 0.0
	for part in parts:
		total += part.moment_of_inertia
	return total


static func _sum_contact_area(parts: Array[TopPartResource]) -> float:
	var total := 0.0
	for part in parts:
		total += part.contact_area
	return total


static func _calculate_center_of_mass(
	parts: Array[TopPartResource],
	total_mass: float
) -> Vector3:
	var weighted_offset := Vector3.ZERO
	for part in parts:
		weighted_offset += part.center_of_mass_offset * part.mass
	return weighted_offset / maxf(total_mass, 0.001)


static func _calculate_stability(
	attack_ring: TopPartResource,
	core_lock: TopPartResource,
	weight_disc: TopPartResource,
	driver_shaft: TopPartResource,
	tip: TopPartResource,
	center_of_mass: Vector3
) -> float:
	var component_stability := (
		attack_ring.stability * 0.2
		+ core_lock.stability * 0.15
		+ weight_disc.stability * 0.25
		+ driver_shaft.stability * 0.2
		+ tip.stability * 0.2
	)
	var lateral_penalty := clampf(
		Vector2(center_of_mass.x, center_of_mass.z).length() * 2.5,
		0.0,
		0.25
	)
	var height_penalty := clampf(maxf(center_of_mass.y, 0.0) * 0.8, 0.0, 0.15)
	return clampf(component_stability - lateral_penalty - height_penalty, 0.35, 1.4)


static func _calculate_control_response(
	attack_ring: TopPartResource,
	core_lock: TopPartResource,
	weight_disc: TopPartResource,
	driver_shaft: TopPartResource,
	tip: TopPartResource,
	total_mass: float
) -> float:
	var component_control := (
		attack_ring.control_response * 0.08
		+ core_lock.control_response * 0.07
		+ weight_disc.control_response * 0.15
		+ driver_shaft.control_response * 0.2
		+ tip.control_response * 0.5
	)
	var mass_response := pow(REFERENCE_MASS / maxf(total_mass, 0.1), 0.35)
	return clampf(component_control * mass_response, 0.35, 1.5)
