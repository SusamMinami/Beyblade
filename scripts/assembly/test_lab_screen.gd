extends Control

const UI_THEME_FACTORY := preload("res://scripts/ui/ui_theme_factory.gd")

@onready var wind_options: OptionButton = %WindOptions
@onready var terrain_options: OptionButton = %TerrainOptions
@onready var result_label: Label = %ResultLabel
@onready var center_of_mass_marker: MeshInstance3D = %CenterOfMassMarker
@onready var top_model: FivePartTopModel = %TopModel

var build_data: TopBuildData


func _ready() -> void:
	theme = UI_THEME_FACTORY.create_graffiti_theme()
	_populate_options()
	build_data = _game_state().get_build_data()
	top_model.configure(
		_game_state().selected_attack_ring_id,
		_game_state().selected_core_lock_id,
		_game_state().selected_weight_disc_id,
		_game_state().selected_driver_shaft_id,
		_game_state().selected_tip_id,
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
	if build_data == null or not build_data.is_valid():
		result_label.text = "当前组装数据无效，请返回设计页重新选择零件。"
		return

	center_of_mass_marker.position = build_data.center_of_mass
	var wind := wind_options.get_item_text(wind_options.selected)
	var terrain := terrain_options.get_item_text(terrain_options.selected)
	var stability_score := _environment_stability_score(wind, terrain)
	var control_score := _environment_control_score(terrain)

	result_label.text = (
		"当前组装\n%s\n\n"
		+ "总质量：%.2f kg  转动惯量：%.2f\n"
		+ "质心：%s\n"
		+ "摩擦：%.2f  回弹：%.2f  转速衰减：%.2f/s\n"
		+ "攻击：%.2f  耐久：%.0f\n"
		+ "风力：%s  地形：%s\n"
		+ "稳定性估算：%.0f/100  控制响应：%.0f/100"
	) % [
		_game_state().get_build_summary(),
		build_data.total_mass,
		build_data.moment_of_inertia,
		str(build_data.center_of_mass),
		build_data.friction,
		build_data.restitution,
		build_data.spin_decay_per_second,
		build_data.attack_power,
		build_data.durability,
		wind,
		terrain,
		stability_score,
		control_score
	]


func _environment_stability_score(wind: String, terrain: String) -> float:
	var score := build_data.stability * 75.0
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


func _environment_control_score(terrain: String) -> float:
	var score := build_data.control_response * 65.0
	if terrain == "高摩擦橡胶":
		score += 12.0
	elif terrain == "低摩擦金属":
		score -= 16.0
	return clampf(score, 0.0, 100.0)


func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/assembly/AssemblyScreen.tscn")
