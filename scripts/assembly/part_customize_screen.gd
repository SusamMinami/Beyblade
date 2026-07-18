extends Control

const UI_THEME_FACTORY := preload("res://scripts/ui/ui_theme_factory.gd")

@onready var ring_color_picker: ColorPickerButton = %RingColorPicker
@onready var core_color_picker: ColorPickerButton = %CoreColorPicker
@onready var style_options: OptionButton = %StyleOptions
@onready var status_label: Label = %StatusLabel

func _ready() -> void:
	theme = UI_THEME_FACTORY.create_graffiti_theme()
	_populate_styles()
	ring_color_picker.color = _game_state().custom_ring_color
	core_color_picker.color = _game_state().custom_core_color
	_select_current_style()
	_update_status()


func _game_state():
	return get_node("/root/GameState")


func _populate_styles() -> void:
	style_options.clear()
	for style in ["平衡型", "重击型", "续航型", "偏心攻击型"]:
		style_options.add_item(style)


func _select_current_style() -> void:
	for index in range(style_options.item_count):
		if style_options.get_item_text(index) == _game_state().custom_part_style:
			style_options.select(index)
			return


func _update_status() -> void:
	status_label.text = "当前样式：%s\n赏金余额：%d\n本页先保存外观参数，后续会接入更细的建模器。" % [
		style_options.get_item_text(style_options.selected),
		_game_state().coins
	]


func _on_apply_button_pressed() -> void:
	_game_state().set_custom_part(
		ring_color_picker.color,
		core_color_picker.color,
		style_options.get_item_text(style_options.selected)
	)
	_update_status()


func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/assembly/AssemblyScreen.tscn")
