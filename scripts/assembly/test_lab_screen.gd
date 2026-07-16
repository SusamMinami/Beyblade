extends Control

@onready var wind_options: OptionButton = %WindOptions
@onready var terrain_options: OptionButton = %TerrainOptions
@onready var result_label: Label = %ResultLabel
@onready var center_of_mass_marker: MeshInstance3D = %CenterOfMassMarker
@onready var top_model: FivePartTopModel = %TopModel

func _ready() -> void:
	_populate_options()
	top_model.configure(
		_game_state().selected_attack_ring,
		_game_state().selected_core_lock,
		_game_state().selected_weight_disc,
		_game_state().selected_driver_shaft,
		_game_state().selected_tip,
		_game_state().custom_ring_color,
		_game_state().custom_core_color
	)
	top_model.set_active_part(-1)
	_update_result()


func _game_state():
	return get_node("/root/GameState")


func _populate_options() -> void:
	_add_options(wind_options, ["无风", "侧风", "强逆风"])
	_add_options(terrain_options, ["标准地面", "低摩擦金属", "高摩擦橡胶", "砂砾扰动"])


func _add_options(option_button: OptionButton, items: Array[String]) -> void:
	option_button.clear()
	for item in items:
		option_button.add_item(item)


func _on_option_changed(_index: int) -> void:
	_update_result()


func _update_result() -> void:
	var com := _estimate_center_of_mass()
	center_of_mass_marker.position = com

	var wind := wind_options.get_item_text(wind_options.selected)
	var terrain := terrain_options.get_item_text(terrain_options.selected)
	var stability_score := _estimate_stability(wind, terrain, com)
	var control_score := _estimate_control(terrain)
	result_label.text = "当前组装\n%s\n\n质心位置：%s\n风力：%s\n地形：%s\n稳定性估算：%.0f/100\n控制响应估算：%.0f/100" % [
		_game_state().get_build_summary(),
		str(com),
		wind,
		terrain,
		stability_score,
		control_score
	]


func _estimate_center_of_mass() -> Vector3:
	var y := 0.02
	var x := 0.0
	if _game_state().selected_weight_disc == "重型外缘配重盘":
		y -= 0.08
	elif _game_state().selected_weight_disc == "偏心突击配重盘":
		x += 0.14
	if _game_state().selected_core_lock == "低重心核心锁扣":
		y -= 0.04
	elif _game_state().selected_core_lock == "强化核心锁扣":
		y += 0.02
	if _game_state().selected_driver_shaft == "低位稳定中轴":
		y -= 0.05
	elif _game_state().selected_driver_shaft == "高位突击中轴":
		y += 0.07
	if _game_state().selected_tip == "金属续航尖":
		y -= 0.05
	elif _game_state().selected_tip == "攻击扁平尖":
		y += 0.03
	return Vector3(x, y, 0.0)


func _estimate_stability(wind: String, terrain: String, com: Vector3) -> float:
	var score := 78.0
	score -= absf(com.x) * 120.0
	score -= maxf(com.y, 0.0) * 80.0
	if _game_state().selected_attack_ring == "圆弧续航攻击环":
		score += 8.0
	elif _game_state().selected_attack_ring == "三翼重击攻击环":
		score -= 7.0
	if _game_state().selected_core_lock == "强化核心锁扣":
		score += 5.0
	if wind == "侧风":
		score -= 8.0
	elif wind == "强逆风":
		score -= 15.0
	if terrain == "砂砾扰动":
		score -= 18.0
	elif terrain == "低摩擦金属":
		score -= 5.0
	elif terrain == "高摩擦橡胶":
		score += 6.0
	return clampf(score, 0.0, 100.0)


func _estimate_control(terrain: String) -> float:
	var score := 60.0
	if _game_state().selected_driver_shaft == "低位稳定中轴":
		score += 8.0
	elif _game_state().selected_driver_shaft == "高位突击中轴":
		score -= 5.0
	if _game_state().selected_tip == "橡胶平衡尖":
		score += 18.0
	elif _game_state().selected_tip == "金属续航尖":
		score -= 10.0
	if terrain == "高摩擦橡胶":
		score += 12.0
	elif terrain == "低摩擦金属":
		score -= 16.0
	return clampf(score, 0.0, 100.0)


func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/assembly/AssemblyScreen.tscn")
