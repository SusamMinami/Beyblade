extends Control

const UI_THEME_FACTORY := preload("res://scripts/ui/ui_theme_factory.gd")
const PART_CUSTOMIZATION := preload(
	"res://scripts/assembly/part_customization.gd"
)

@onready var ring_color_picker: ColorPickerButton = %RingColorPicker
@onready var core_color_picker: ColorPickerButton = %CoreColorPicker
@onready var material_options: OptionButton = %MaterialOptions
@onready var symmetry_options: OptionButton = %SymmetryOptions
@onready var view_options: OptionButton = %ViewOptions
@onready var status_label: Label = %StatusLabel
@onready var metrics_label: Label = %MetricsLabel
@onready var part_title: Label = %PartTitle
@onready var preview_camera: Camera3D = %PreviewCamera
@onready var top_model: FivePartTopModel = %TopModel

var target_part_id: StringName
var target_part_index := 0
var draft: Dictionary
var draft_customizations: Dictionary
var pending_material_id := ""
var material_dialog: ConfirmationDialog


func _ready() -> void:
	theme = UI_THEME_FACTORY.create_graffiti_theme()
	_resolve_target_part()
	_create_material_dialog()
	_populate_options()
	ring_color_picker.color = _game_state().custom_ring_color
	core_color_picker.color = _game_state().custom_core_color
	draft_customizations = _game_state().get_active_loadout_customizations()
	draft = PART_CUSTOMIZATION.normalize(
		draft_customizations.get(String(target_part_id), {})
	)
	_sync_option_selection()
	_set_view(0)
	_update_preview()


func _game_state():
	return get_node("/root/GameState")


func _resolve_target_part() -> void:
	target_part_id = _game_state().customizing_part_id
	var part := PartDatabase.get_part(target_part_id)
	if part == null:
		target_part_id = _game_state().selected_attack_ring_id
		part = PartDatabase.get_part(target_part_id)
	target_part_index = int(part.part_type)
	part_title.text = "%02d  %s · 深度 DIY" % [
		target_part_index + 1,
		part.part_name
	]
	_game_state().customizing_part_id = target_part_id


func _create_material_dialog() -> void:
	material_dialog = ConfirmationDialog.new()
	material_dialog.title = "解锁材料"
	material_dialog.ok_button_text = "购买并使用"
	material_dialog.cancel_button_text = "取消"
	material_dialog.confirmed.connect(_on_material_purchase_confirmed)
	add_child(material_dialog)


func _populate_options() -> void:
	material_options.clear()
	for material in PART_CUSTOMIZATION.get_material_list():
		var state := (
			"已拥有"
			if _game_state().owns_material(material.id)
			else "%d 金币" % int(material.price)
		)
		material_options.add_item("%s · %s" % [material.name, state])
		material_options.set_item_metadata(
			material_options.item_count - 1,
			material.id
		)

	symmetry_options.clear()
	for symmetry in PART_CUSTOMIZATION.SYMMETRY_OPTIONS:
		symmetry_options.add_item("%d 边延展" % symmetry, symmetry)

	view_options.clear()
	for view_name in ["正视", "俯视", "侧视"]:
		view_options.add_item(view_name)


func _sync_option_selection() -> void:
	for index in range(material_options.item_count):
		if material_options.get_item_metadata(index) == draft.material:
			material_options.select(index)
			break
	for index in range(symmetry_options.item_count):
		if symmetry_options.get_item_id(index) == int(draft.symmetry):
			symmetry_options.select(index)
			break


func _on_size_handle_gui_input(event: InputEvent) -> void:
	var delta := _drag_delta(event)
	if delta == Vector2.ZERO:
		return
	draft.size = float(draft.size) + delta.x * 0.0035
	_normalize_and_update()


func _on_height_handle_gui_input(event: InputEvent) -> void:
	var delta := _drag_delta(event)
	if delta == Vector2.ZERO:
		return
	draft.height = float(draft.height) - delta.y * 0.0035
	_normalize_and_update()


func _on_shape_handle_gui_input(event: InputEvent) -> void:
	var delta := _drag_delta(event)
	if delta == Vector2.ZERO:
		return
	draft.shape = float(draft.shape) + delta.x * 0.45
	_normalize_and_update()


func _drag_delta(event: InputEvent) -> Vector2:
	if event is InputEventScreenDrag:
		return event.relative
	if (
		event is InputEventMouseMotion
		and event.button_mask & MOUSE_BUTTON_MASK_LEFT
	):
		return event.relative
	return Vector2.ZERO


func _normalize_and_update() -> void:
	draft = PART_CUSTOMIZATION.normalize(draft)
	_update_preview()


func _on_material_options_item_selected(index: int) -> void:
	var material_id := str(material_options.get_item_metadata(index))
	if _game_state().owns_material(material_id):
		draft.material = material_id
		_normalize_and_update()
		return
	var material := PART_CUSTOMIZATION.get_material(material_id)
	if _game_state().coins < int(material.price):
		status_label.text = "金币不足，还差 %d" % (
			int(material.price) - _game_state().coins
		)
		_sync_option_selection()
		return
	pending_material_id = material_id
	material_dialog.dialog_text = (
		"%s\n价格：%d\n购买后余额：%d"
		% [
			material.name,
			int(material.price),
			_game_state().coins - int(material.price)
		]
	)
	material_dialog.popup_centered(Vector2i(480, 260))
	_sync_option_selection()


func _on_material_purchase_confirmed() -> void:
	if pending_material_id.is_empty():
		return
	if _game_state().purchase_material(pending_material_id):
		draft.material = pending_material_id
		_populate_options()
		_sync_option_selection()
		_normalize_and_update()
	pending_material_id = ""


func _on_symmetry_options_item_selected(index: int) -> void:
	draft.symmetry = symmetry_options.get_item_id(index)
	_normalize_and_update()


func _on_view_options_item_selected(index: int) -> void:
	_set_view(index)


func _set_view(index: int) -> void:
	match index:
		1:
			preview_camera.position = Vector3(0.0, 5.0, 0.01)
		2:
			preview_camera.position = Vector3(5.0, 0.6, 0.0)
		_:
			preview_camera.position = Vector3(0.0, 0.8, 5.0)
	preview_camera.look_at(Vector3.ZERO, Vector3.FORWARD if index == 1 else Vector3.UP)


func _update_preview() -> void:
	draft_customizations[String(target_part_id)] = draft.duplicate(true)
	top_model.configure(
		_game_state().selected_attack_ring_id,
		_game_state().selected_core_lock_id,
		_game_state().selected_weight_disc_id,
		_game_state().selected_driver_shaft_id,
		_game_state().selected_tip_id,
		ring_color_picker.color,
		core_color_picker.color,
		draft_customizations
	)
	top_model.set_active_part(target_part_index)
	var build := AssemblyCalculator.calculate_by_ids(
		_game_state().selected_attack_ring_id,
		_game_state().selected_core_lock_id,
		_game_state().selected_weight_disc_id,
		_game_state().selected_driver_shaft_id,
		_game_state().selected_tip_id,
		draft_customizations
	)
	metrics_label.text = "质量 %.3f kg  ·  惯量 %.3f kg·m²" % [
		build.total_mass,
		build.moment_of_inertia
	]
	var material := PART_CUSTOMIZATION.get_material(str(draft.material))
	status_label.text = (
		"尺寸 %d%%  ·  高度 %d%%  ·  轮廓 %d%%\n%s  ·  %d 边延展  ·  金币 %d"
		% [
			roundi(float(draft.size) * 100.0),
			roundi(float(draft.height) * 100.0),
			roundi(float(draft.shape)),
			material.name,
			int(draft.symmetry),
			_game_state().coins
		]
	)


func _on_color_changed(_color: Color) -> void:
	_update_preview()


func _on_apply_button_pressed() -> void:
	_game_state().set_custom_part(
		ring_color_picker.color,
		core_color_picker.color,
		_game_state().custom_part_style
	)
	_game_state().set_active_loadout_customization(target_part_id, draft)
	_game_state().customizing_part_id = &""
	get_tree().change_scene_to_file("res://scenes/assembly/AssemblyScreen.tscn")


func _on_back_button_pressed() -> void:
	_game_state().customizing_part_id = &""
	get_tree().change_scene_to_file("res://scenes/assembly/AssemblyScreen.tscn")
