class_name TopBuildData
extends Resource

@export var attack_ring: TopPartResource
@export var core_lock: TopPartResource
@export var weight_disc: TopPartResource
@export var driver_shaft: TopPartResource
@export var tip: TopPartResource


func get_parts() -> Array[TopPartResource]:
	return [attack_ring, core_lock, weight_disc, driver_shaft, tip]


func is_complete() -> bool:
	var parts := get_parts()
	for part_index in range(parts.size()):
		if parts[part_index] == null:
			return false
		if parts[part_index].part_type != part_index:
			return false
	return true


func get_part_ids() -> Array[StringName]:
	var result: Array[StringName] = []
	for part in get_parts():
		result.append(part.part_id if part != null else &"")
	return result


func get_part_names() -> Array[String]:
	var result: Array[String] = []
	for part in get_parts():
		result.append(part.part_name if part != null else "")
	return result
