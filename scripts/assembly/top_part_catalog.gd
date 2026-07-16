class_name TopPartCatalog
extends RefCounted

const ALL_PARTS: Array[TopPartResource] = [
	preload("res://resources/parts/attack_rings/balanced_six_blade.tres"),
	preload("res://resources/parts/attack_rings/heavy_three_wing.tres"),
	preload("res://resources/parts/attack_rings/round_stamina.tres"),
	preload("res://resources/parts/core_locks/standard_core_lock.tres"),
	preload("res://resources/parts/core_locks/low_center_core_lock.tres"),
	preload("res://resources/parts/core_locks/reinforced_core_lock.tres"),
	preload("res://resources/parts/weight_discs/standard_weight_disc.tres"),
	preload("res://resources/parts/weight_discs/heavy_rim_weight_disc.tres"),
	preload("res://resources/parts/weight_discs/eccentric_assault_weight_disc.tres"),
	preload("res://resources/parts/driver_shafts/standard_driver_shaft.tres"),
	preload("res://resources/parts/driver_shafts/low_stability_driver_shaft.tres"),
	preload("res://resources/parts/driver_shafts/high_assault_driver_shaft.tres"),
	preload("res://resources/parts/tips/rubber_balance_tip.tres"),
	preload("res://resources/parts/tips/metal_stamina_tip.tres"),
	preload("res://resources/parts/tips/attack_flat_tip.tres")
]


static func get_all_parts() -> Array[TopPartResource]:
	return ALL_PARTS.duplicate()


static func find_by_id(part_id: StringName) -> TopPartResource:
	for part in ALL_PARTS:
		if part.part_id == part_id:
			return part
	return null


static func find_by_name(part_name: String) -> TopPartResource:
	for part in ALL_PARTS:
		if part.part_name == part_name:
			return part
	return null


static func create_build_from_names(
	attack_ring_name: String,
	core_lock_name: String,
	weight_disc_name: String,
	driver_shaft_name: String,
	tip_name: String
) -> TopBuildData:
	var build := TopBuildData.new()
	build.attack_ring = find_by_name(attack_ring_name)
	build.core_lock = find_by_name(core_lock_name)
	build.weight_disc = find_by_name(weight_disc_name)
	build.driver_shaft = find_by_name(driver_shaft_name)
	build.tip = find_by_name(tip_name)
	return build


static func create_build_from_ids(
	attack_ring_id: StringName,
	core_lock_id: StringName,
	weight_disc_id: StringName,
	driver_shaft_id: StringName,
	tip_id: StringName
) -> TopBuildData:
	var build := TopBuildData.new()
	build.attack_ring = find_by_id(attack_ring_id)
	build.core_lock = find_by_id(core_lock_id)
	build.weight_disc = find_by_id(weight_disc_id)
	build.driver_shaft = find_by_id(driver_shaft_id)
	build.tip = find_by_id(tip_id)
	return build
