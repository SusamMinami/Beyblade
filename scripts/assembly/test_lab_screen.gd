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
	var snapshot: TopBattleSnapshot = _game_state().get_battle_snapshot()
	var display_com := snapshot.center_of_mass_m * 20.0
	center_of_mass_marker.position = display_com

	var wind := wind_options.get_item_text(wind_options.selected)
	var terrain := terrain_options.get_item_text(terrain_options.selected)
	var stability_score := _estimate_stability(wind, terrain, snapshot)
	var control_score := _estimate_control(terrain, snapshot)
	result_label.text = "当前组装\n%s\n\n总质量：%.1f g\n质心偏移：%s mm\n轴向惯量：%.2f g·cm²\n风力：%s\n地形：%s\n稳定性估算：%.0f/100\n控制响应估算：%.0f/100" % [
		_game_state().get_build_summary(),
		snapshot.total_mass_kg * 1000.0,
		str(snapshot.center_of_mass_m * 1000.0),
		snapshot.inertia_kg_m2.y * 10000000.0,
		wind,
		terrain,
		stability_score,
		control_score
	]


func _estimate_stability(
	wind: String,
	terrain: String,
	snapshot: TopBattleSnapshot
) -> float:
	var score := 72.0 * snapshot.stability
	score -= absf(snapshot.center_of_mass_m.x) * 4000.0
	score -= maxf(snapshot.center_of_mass_m.y - 0.002, 0.0) * 1500.0
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


func _estimate_control(terrain: String, snapshot: TopBattleSnapshot) -> float:
	var score := 58.0 * snapshot.control_response
	if terrain == "高摩擦橡胶":
		score += 12.0
	elif terrain == "低摩擦金属":
		score -= 16.0
	return clampf(score, 0.0, 100.0)


func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/assembly/AssemblyScreen.tscn")
