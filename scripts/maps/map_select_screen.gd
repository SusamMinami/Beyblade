extends Control

const UI_THEME_FACTORY := preload("res://scripts/ui/ui_theme_factory.gd")
const ARENA_MAP_CATALOG := preload("res://scripts/maps/arena_map_catalog.gd")

@onready var map_options: OptionButton = %MapOptions
@onready var selected_map_label: Label = %SelectedMapLabel
@onready var build_label: Label = %BuildLabel
@onready var map_description_label: Label = %MapDescriptionLabel

func _ready() -> void:
	theme = UI_THEME_FACTORY.create_graffiti_theme()
	_populate_maps()
	build_label.text = "已选择陀螺\n%s" % _game_state().get_build_summary()
	_update_map_description()


func _populate_maps() -> void:
	map_options.clear()
	var maps := ARENA_MAP_CATALOG.get_all()
	for arena_map in maps:
		map_options.add_item(arena_map.map_name)
	for map_index in range(maps.size()):
		if maps[map_index].map_name == _game_state().selected_map:
			map_options.select(map_index)
			break


func _game_state():
	return get_node("/root/GameState")


func _on_map_options_item_selected(_index: int) -> void:
	_update_map_description()


func _on_previous_map_pressed() -> void:
	map_options.select(wrapi(
		map_options.selected - 1,
		0,
		map_options.item_count
	))
	_update_map_description()


func _on_next_map_pressed() -> void:
	map_options.select(wrapi(
		map_options.selected + 1,
		0,
		map_options.item_count
	))
	_update_map_description()


func _update_map_description() -> void:
	var arena_map: ArenaMapResource = ARENA_MAP_CATALOG.get_all()[map_options.selected]
	var terrain_mode := "复合地形" if arena_map.supports_composite_terrain else "单一地形"
	selected_map_label.text = "%02d / %02d\n%s" % [
		map_options.selected + 1,
		map_options.item_count,
		arena_map.map_name
	]
	map_description_label.text = "%s\n%s\n默认地形：%s\n类型：%s\n最大倾角：约 %.1f°" % [
		arena_map.map_name,
		arena_map.description,
		arena_map.default_surface.surface_name,
		terrain_mode,
		arena_map.get_max_incline_degrees()
	]


func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/assembly/AssemblyScreen.tscn")


func _on_start_button_pressed() -> void:
	_game_state().set_map(map_options.get_item_text(map_options.selected))
	get_tree().change_scene_to_file("res://scenes/battle/BattleScreen.tscn")
