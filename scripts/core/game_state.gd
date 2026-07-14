extends Node

const DEFAULT_RING := "平衡外圈"
const DEFAULT_WEIGHT := "标准配重"
const DEFAULT_TIP := "橡胶平衡尖"
const DEFAULT_MAP := "标准碗形竞技场"

var selected_ring: String = DEFAULT_RING
var selected_weight: String = DEFAULT_WEIGHT
var selected_tip: String = DEFAULT_TIP
var selected_map: String = DEFAULT_MAP

func set_build(ring: String, weight: String, tip: String) -> void:
	selected_ring = ring
	selected_weight = weight
	selected_tip = tip


func set_map(map_name: String) -> void:
	selected_map = map_name


func get_build_summary() -> String:
	return "外圈：%s\n配重：%s\n底尖：%s" % [selected_ring, selected_weight, selected_tip]


func get_battle_summary() -> String:
	return "%s\n地图：%s" % [get_build_summary(), selected_map]
