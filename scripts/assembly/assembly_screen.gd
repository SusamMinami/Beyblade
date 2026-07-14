extends Control

@onready var ring_options: OptionButton = %RingOptions
@onready var weight_options: OptionButton = %WeightOptions
@onready var tip_options: OptionButton = %TipOptions
@onready var summary_label: Label = %SummaryLabel
@onready var preview_root: Node3D = %PreviewRoot
@onready var preview_ring: MeshInstance3D = %PreviewRing
@onready var preview_core: MeshInstance3D = %PreviewCore
@onready var preview_tip: MeshInstance3D = %PreviewTip

func _ready() -> void:
	_populate_options()
	_update_summary()


func _process(delta: float) -> void:
	preview_root.rotation_degrees.y += delta * 24.0


func _populate_options() -> void:
	_add_options(ring_options, ["平衡外圈", "重击外圈", "轻量续航外圈"])
	_add_options(weight_options, ["标准配重", "重型配重", "偏心攻击配重"])
	_add_options(tip_options, ["橡胶平衡尖", "金属续航尖", "攻击扁平尖"])


func _add_options(option_button: OptionButton, items: Array[String]) -> void:
	option_button.clear()
	for item in items:
		option_button.add_item(item)


func _game_state():
	return get_node("/root/GameState")


func _on_option_changed(_index: int) -> void:
	_update_summary()


func _select_previous(option_button: OptionButton) -> void:
	var next_index := wrapi(option_button.selected - 1, 0, option_button.item_count)
	option_button.select(next_index)
	_update_summary()


func _select_next(option_button: OptionButton) -> void:
	var next_index := wrapi(option_button.selected + 1, 0, option_button.item_count)
	option_button.select(next_index)
	_update_summary()


func _update_summary() -> void:
	var ring := ring_options.get_item_text(ring_options.selected)
	var weight := weight_options.get_item_text(weight_options.selected)
	var tip := tip_options.get_item_text(tip_options.selected)
	summary_label.text = "%s / %s / %s\n样式：%s  赏金：%d" % [
		ring,
		weight,
		tip,
		_game_state().custom_part_style,
		_game_state().coins
	]
	_update_preview(ring, weight, tip)


func _update_preview(ring: String, weight: String, tip: String) -> void:
	preview_ring.scale = Vector3.ONE
	preview_core.scale = Vector3.ONE
	preview_tip.scale = Vector3.ONE
	preview_core.position.x = 0.0

	if ring == "重击外圈":
		preview_ring.scale = Vector3(1.22, 0.9, 1.22)
	elif ring == "轻量续航外圈":
		preview_ring.scale = Vector3(0.92, 1.12, 0.92)

	if weight == "重型配重":
		preview_core.scale = Vector3(1.12, 1.18, 1.12)
	elif weight == "偏心攻击配重":
		preview_core.position.x = 0.12

	if tip == "金属续航尖":
		preview_tip.scale = Vector3(0.72, 1.28, 0.72)
	elif tip == "攻击扁平尖":
		preview_tip.scale = Vector3(1.28, 0.65, 1.28)

	_apply_preview_material(preview_ring, _game_state().custom_ring_color)
	_apply_preview_material(preview_core, _game_state().custom_core_color)
	_apply_preview_material(preview_tip, Color(0.88, 0.88, 0.92, 1.0))


func _apply_preview_material(mesh: MeshInstance3D, color: Color) -> void:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.roughness = 0.35
	mesh.material_override = material


func _on_next_button_pressed() -> void:
	_game_state().set_build(
		ring_options.get_item_text(ring_options.selected),
		weight_options.get_item_text(weight_options.selected),
		tip_options.get_item_text(tip_options.selected)
	)
	get_tree().change_scene_to_file("res://scenes/maps/MapSelectScreen.tscn")


func _on_customize_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/assembly/PartCustomizeScreen.tscn")


func _on_test_button_pressed() -> void:
	_game_state().set_build(
		ring_options.get_item_text(ring_options.selected),
		weight_options.get_item_text(weight_options.selected),
		tip_options.get_item_text(tip_options.selected)
	)
	get_tree().change_scene_to_file("res://scenes/assembly/TestLabScreen.tscn")


func _on_ring_previous_pressed() -> void:
	_select_previous(ring_options)


func _on_ring_next_pressed() -> void:
	_select_next(ring_options)


func _on_weight_previous_pressed() -> void:
	_select_previous(weight_options)


func _on_weight_next_pressed() -> void:
	_select_next(weight_options)


func _on_tip_previous_pressed() -> void:
	_select_previous(tip_options)


func _on_tip_next_pressed() -> void:
	_select_next(tip_options)
