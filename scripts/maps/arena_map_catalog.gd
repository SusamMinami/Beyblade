class_name ArenaMapCatalog
extends RefCounted

const MAPS: Array[ArenaMapResource] = [
	preload("res://resources/maps/standard_bowl_arena.tres"),
	preload("res://resources/maps/metal_speed_arena.tres"),
	preload("res://resources/maps/composite_arena.tres")
]


static func get_all() -> Array[ArenaMapResource]:
	return MAPS


static func get_by_name(map_name: String) -> ArenaMapResource:
	for arena_map in MAPS:
		if arena_map.map_name == map_name:
			return arena_map
	return MAPS[0]
