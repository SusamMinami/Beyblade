class_name AssemblyCalculator
extends RefCounted

const UPPER_STACK_PART_TYPES := [
	TopPartResource.PartType.ATTACK_RING,
	TopPartResource.PartType.CORE_LOCK,
	TopPartResource.PartType.WEIGHT_DISC
]
const SPIN_DAMPING_WEIGHTS: Array[float] = [0.25, 0.05, 0.10, 0.15, 0.45]
const STABILITY_WEIGHTS: Array[float] = [0.20, 0.10, 0.25, 0.25, 0.20]
const CONTROL_WEIGHTS: Array[float] = [0.05, 0.05, 0.10, 0.25, 0.55]
const ATTACK_WEIGHTS: Array[float] = [0.45, 0.05, 0.25, 0.10, 0.15]


static func calculate(build: TopBuildData) -> TopBattleSnapshot:
	assert(build != null and build.is_complete(), "Cannot calculate an incomplete top build.")

	var snapshot := TopBattleSnapshot.new()
	var parts := build.get_parts()
	var positions: Array[Vector3] = []
	var stack_height_offset := build.driver_shaft.upper_stack_height_offset

	for part in parts:
		var part_position := part.center_of_mass_offset
		if part.part_type in UPPER_STACK_PART_TYPES:
			part_position.y += stack_height_offset
		positions.append(part_position)
		snapshot.total_mass_kg += part.mass
		snapshot.part_ids.append(part.part_id)

	for part_index in range(parts.size()):
		snapshot.center_of_mass_m += positions[part_index] * parts[part_index].mass
	snapshot.center_of_mass_m /= snapshot.total_mass_kg

	for part_index in range(parts.size()):
		var part := parts[part_index]
		var offset := positions[part_index] - snapshot.center_of_mass_m
		snapshot.inertia_kg_m2.x += (
			part.transverse_moment_of_inertia
			+ part.mass * (offset.y * offset.y + offset.z * offset.z)
		)
		snapshot.inertia_kg_m2.y += (
			part.moment_of_inertia
			+ part.mass * (offset.x * offset.x + offset.z * offset.z)
		)
		snapshot.inertia_kg_m2.z += (
			part.transverse_moment_of_inertia
			+ part.mass * (offset.x * offset.x + offset.y * offset.y)
		)

	# Only the tip contacts the arena in the normal upright state.
	snapshot.friction = build.tip.friction
	# The prototype has one collider, so its bounce represents ring-to-ring impact.
	snapshot.restitution = build.attack_ring.restitution
	snapshot.contact_area_m2 = build.tip.contact_area

	snapshot.spin_damping_multiplier = _weighted_geometric_mean(
		parts,
		SPIN_DAMPING_WEIGHTS,
		func(part: TopPartResource) -> float: return part.spin_damping_multiplier
	)
	snapshot.stability = _weighted_geometric_mean(
		parts,
		STABILITY_WEIGHTS,
		func(part: TopPartResource) -> float: return part.stability
	)
	snapshot.control_response = _weighted_geometric_mean(
		parts,
		CONTROL_WEIGHTS,
		func(part: TopPartResource) -> float: return part.control_response
	)
	snapshot.attack_power = _weighted_geometric_mean(
		parts,
		ATTACK_WEIGHTS,
		func(part: TopPartResource) -> float: return part.attack_power
	)

	# More total mass reduces instantaneous collision acceleration slightly.
	# Each part keeps an independent durability pool for battle damage.
	var durability_mass_scale := sqrt(snapshot.total_mass_kg / 0.046)
	var weakest_durability := INF
	for part in parts:
		var part_durability := part.durability * durability_mass_scale
		snapshot.part_durabilities.append(part_durability)
		weakest_durability = minf(weakest_durability, part_durability)
	snapshot.durability = weakest_durability
	return snapshot


static func _weighted_geometric_mean(
	parts: Array[TopPartResource],
	weights: Array[float],
	value_getter: Callable
) -> float:
	assert(parts.size() == weights.size())
	var total_weight := 0.0
	var weighted_log_sum := 0.0
	for part_index in range(parts.size()):
		var value := float(value_getter.call(parts[part_index]))
		total_weight += weights[part_index]
		weighted_log_sum += weights[part_index] * log(maxf(value, 0.001))
	return exp(weighted_log_sum / total_weight)
