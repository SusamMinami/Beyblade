class_name TopBattleSnapshot
extends RefCounted

var part_ids: Array[StringName] = []
var part_durabilities: Array[float] = []
var total_mass_kg: float = 0.0
var center_of_mass_m: Vector3 = Vector3.ZERO
var inertia_kg_m2: Vector3 = Vector3.ZERO
var friction: float = 0.0
var restitution: float = 0.0
var contact_area_m2: float = 0.0
var spin_damping_multiplier: float = 1.0
var stability: float = 1.0
var control_response: float = 1.0
var attack_power: float = 1.0
var durability: float = 0.0


func is_valid() -> bool:
	if part_ids.size() != 5 or part_durabilities.size() != 5:
		return false
	for part_durability in part_durabilities:
		if part_durability <= 0.0:
			return false
	return (
		total_mass_kg > 0.0
		and inertia_kg_m2.x > 0.0
		and inertia_kg_m2.y > 0.0
		and inertia_kg_m2.z > 0.0
		and contact_area_m2 > 0.0
	)
