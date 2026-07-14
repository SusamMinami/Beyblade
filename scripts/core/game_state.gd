extends Node

const DEFAULT_RING := "平衡外圈"
const DEFAULT_WEIGHT := "标准配重"
const DEFAULT_TIP := "橡胶平衡尖"
const DEFAULT_MAP := "标准碗形竞技场"

var selected_ring: String = DEFAULT_RING
var selected_weight: String = DEFAULT_WEIGHT
var selected_tip: String = DEFAULT_TIP
var selected_map: String = DEFAULT_MAP
var coins: int = 0
var custom_ring_color: Color = Color(0.2, 0.75, 1.0, 1.0)
var custom_core_color: Color = Color(0.95, 0.78, 0.25, 1.0)
var custom_part_style: String = "平衡型"

func set_build(ring: String, weight: String, tip: String) -> void:
	selected_ring = ring
	selected_weight = weight
	selected_tip = tip


func set_map(map_name: String) -> void:
	selected_map = map_name


func set_custom_part(ring_color: Color, core_color: Color, style: String) -> void:
	custom_ring_color = ring_color
	custom_core_color = core_color
	custom_part_style = style


func add_reward(amount: int) -> void:
	coins += max(amount, 0)


func spend_coins(amount: int) -> bool:
	if amount <= 0:
		return true
	if coins < amount:
		return false
	coins -= amount
	return true


func get_build_summary() -> String:
	return "外圈：%s\n配重：%s\n底尖：%s\n样式：%s\n赏金：%d" % [
		selected_ring,
		selected_weight,
		selected_tip,
		custom_part_style,
		coins
	]


func get_battle_summary() -> String:
	return "%s\n地图：%s" % [get_build_summary(), selected_map]
