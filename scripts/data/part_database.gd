class_name PartDatabase
extends RefCounted

const ALL_PARTS = [
	preload("res://resources/parts/attack_rings/balance_six.tres"),
	preload("res://resources/parts/attack_rings/smash_three.tres"),
	preload("res://resources/parts/attack_rings/stamina_arc.tres"),
	preload("res://resources/parts/core_locks/standard.tres"),
	preload("res://resources/parts/core_locks/low_center.tres"),
	preload("res://resources/parts/core_locks/reinforced.tres"),
	preload("res://resources/parts/weight_discs/standard.tres"),
	preload("res://resources/parts/weight_discs/heavy_outer.tres"),
	preload("res://resources/parts/weight_discs/eccentric.tres"),
	preload("res://resources/parts/driver_shafts/standard.tres"),
	preload("res://resources/parts/driver_shafts/low_stable.tres"),
	preload("res://resources/parts/driver_shafts/high_attack.tres"),
	preload("res://resources/parts/tips/rubber_balance.tres"),
	preload("res://resources/parts/tips/metal_stamina.tres"),
	preload("res://resources/parts/tips/flat_attack.tres")
]

static func get_all_parts() -> Array[TopPartResource]:
	var result: Array[TopPartResource] = []
	for part in ALL_PARTS:
		result.append(part as TopPartResource)
	return result


static func get_part(part_id: StringName) -> TopPartResource:
	for part in ALL_PARTS:
		var typed_part := part as TopPartResource
		if typed_part != null and typed_part.part_id == part_id:
			return typed_part
	return null


static func get_parts_by_type(part_type: TopPartResource.PartType) -> Array[TopPartResource]:
	var result: Array[TopPartResource] = []
	for part in ALL_PARTS:
		var typed_part := part as TopPartResource
		if typed_part != null and typed_part.part_type == part_type:
			result.append(typed_part)
	return result


static func validate_database() -> PackedStringArray:
	var errors := PackedStringArray()
	var seen_ids := {}
	var type_counts := {}

	if ALL_PARTS.size() != 15:
		errors.append("数据库应包含 15 个零件，实际为 %d" % ALL_PARTS.size())

	for part in ALL_PARTS:
		var typed_part := part as TopPartResource
		if typed_part == null:
			errors.append("数据库包含非 TopPartResource 资源")
			continue
		if typed_part.part_id.is_empty():
			errors.append("零件缺少 part_id：%s" % typed_part.part_name)
		elif seen_ids.has(typed_part.part_id):
			errors.append("part_id 重复：%s" % typed_part.part_id)
		else:
			seen_ids[typed_part.part_id] = true
		type_counts[typed_part.part_type] = type_counts.get(typed_part.part_type, 0) + 1

		if typed_part.part_name.is_empty():
			errors.append("零件缺少显示名称：%s" % typed_part.part_id)
		if typed_part.mass <= 0.0:
			errors.append("零件质量必须大于 0：%s" % typed_part.part_id)
		if typed_part.moment_of_inertia <= 0.0:
			errors.append("零件转动惯量必须大于 0：%s" % typed_part.part_id)
		if typed_part.durability <= 0.0:
			errors.append("零件耐久必须大于 0：%s" % typed_part.part_id)

	for part_type in range(TopPartResource.PartType.size()):
		if type_counts.get(part_type, 0) != 3:
			errors.append("零件类型 %d 应包含 3 个资源" % part_type)

	return errors
