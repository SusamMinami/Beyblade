class_name TopBuildData
extends RefCounted

var attack_ring: TopPartResource
var core_lock: TopPartResource
var weight_disc: TopPartResource
var driver_shaft: TopPartResource
var tip: TopPartResource

var total_mass: float = 0.0
var center_of_mass: Vector3 = Vector3.ZERO
var moment_of_inertia: float = 0.0
var friction: float = 0.0
var restitution: float = 0.0
var contact_area: float = 0.0
var spin_decay_per_second: float = 0.0
var stability: float = 0.0
var control_response: float = 0.0
var control_force: float = 0.0
var attack_power: float = 0.0
var durability: float = 0.0
var max_spin_speed: float = 0.0
var launch_forward_impulse: float = 0.0
var collision_momentum: float = 0.0

func get_parts() -> Array[TopPartResource]:
	return [attack_ring, core_lock, weight_disc, driver_shaft, tip]


func get_part_ids() -> Array[StringName]:
	var result: Array[StringName] = []
	for part in get_parts():
		result.append(part.part_id if part != null else &"")
	return result


func is_valid() -> bool:
	for part in get_parts():
		if part == null:
			return false
	return (
		total_mass > 0.0
		and moment_of_inertia > 0.0
		and friction >= 0.0
		and restitution >= 0.0
		and spin_decay_per_second > 0.0
		and stability > 0.0
		and control_response > 0.0
		and attack_power > 0.0
		and durability > 0.0
	)
