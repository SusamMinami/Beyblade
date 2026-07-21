extends Control

const UI_THEME_FACTORY := preload("res://scripts/ui/ui_theme_factory.gd")
const PART_NAMES := ["攻击环", "核心锁扣", "金属配重盘", "驱动中轴", "轴尖"]
const PART_TYPES := [
	TopPartResource.PartType.ATTACK_RING,
	TopPartResource.PartType.CORE_LOCK,
	TopPartResource.PartType.WEIGHT_DISC,
	TopPartResource.PartType.DRIVER_SHAFT,
	TopPartResource.PartType.TIP
]
const PART_DESCRIPTIONS := [
	"决定接触轮廓、攻击方向与外缘惯量",
	"固定上层结构，影响耐久与重心高度",
	"决定质量分布、转动惯量与偏心程度",
	"连接配重盘与轴尖，控制整体高度",
	"唯一接地点，决定摩擦、续航与移动倾向"
]
const PREVIEW_CLICK_RADIUS := 150.0

@onready var summary_label: Label = %SummaryLabel
@onready var active_part_label: Label = %ActivePartLabel
@onready var part_description_label: Label = %PartDescriptionLabel
@onready var part_options: OptionButton = %PartOptions
@onready var part_editor: Control = %PartEditor
@onready var config_button: Button = %ConfigButton
@onready var preview_camera: Camera3D = %PreviewCamera
@onready var top_model: FivePartTopModel = %TopModel
@onready var part_buttons: Array[Button] = [
	%AttackRingPartButton,
	%CoreLockPartButton,
	%WeightDiscPartButton,
	%DriverShaftPartButton,
	%TipPartButton
]
@onready var ui_select_player: AudioStreamPlayer = %UiSelectPlayer

var part_selections: Array[StringName] = [
	&"attack_ring.balance_six",
	&"core_lock.standard",
	&"weight_disc.standard",
	&"driver_shaft.standard",
	&"tip.rubber_balance"
]
var active_part_index := -1
var preview_dragging := false
var last_drag_position := Vector2.ZERO
var drag_distance := 0.0
var drag_vector := Vector2.ZERO
var pending_purchase_part: TopPartResource
var purchase_dialog: ConfirmationDialog

func _ready() -> void:
	theme = UI_THEME_FACTORY.create_graffiti_theme()
	_create_purchase_dialog()
	_position_preview_camera()
	_restore_saved_build()
	_clear_active_part()
	_update_summary()
	if (
		get_tree().current_scene == self
		and
		_game_state().tutorial.stage == _game_state().TUTORIAL_FIRST_BATTLE
		and not bool(_game_state().tutorial.completed)
	):
		_game_state().selected_map = "标准碗形竞技场"
		get_tree().call_deferred(
			"change_scene_to_file",
			"res://scenes/battle/BattleScreen.tscn"
		)


func _process(delta: float) -> void:
	if not preview_dragging:
		top_model.rotation_degrees.y += delta * 15.0


func _position_preview_camera() -> void:
	preview_camera.global_position = Vector3(0.0, 1.05, 5.15)
	preview_camera.look_at(Vector3(0.0, 0.02, 0.0), Vector3.UP)


func _game_state():
	return get_node("/root/GameState")


func _restore_saved_build() -> void:
	var saved_ids: Array[StringName] = [
		_game_state().selected_attack_ring_id,
		_game_state().selected_core_lock_id,
		_game_state().selected_weight_disc_id,
		_game_state().selected_driver_shaft_id,
		_game_state().selected_tip_id
	]
	for part_index in range(PART_TYPES.size()):
		var saved_part := PartDatabase.get_part(saved_ids[part_index])
		if saved_part != null and saved_part.part_type == PART_TYPES[part_index]:
			part_selections[part_index] = saved_ids[part_index]


func _create_purchase_dialog() -> void:
	purchase_dialog = ConfirmationDialog.new()
	purchase_dialog.title = "解锁零件"
	purchase_dialog.ok_button_text = "购买并装备"
	purchase_dialog.cancel_button_text = "取消"
	purchase_dialog.confirmed.connect(_on_purchase_confirmed)
	add_child(purchase_dialog)


func _select_active_part(part_index: int, play_sound := true) -> void:
	active_part_index = clampi(part_index, 0, PART_TYPES.size() - 1)
	part_editor.visible = true
	active_part_label.text = "%02d  %s" % [active_part_index + 1, PART_NAMES[active_part_index]]
	part_description_label.text = PART_DESCRIPTIONS[active_part_index]
	part_options.clear()
	var variants := _get_active_variants()
	for part in variants:
		var access_label := "已拥有"
		if not _game_state().owns_part(part.part_id):
			access_label = "%d 金币" % _game_state().get_part_price(part.part_id)
		part_options.add_item("%s · %s" % [part.part_name, access_label])
	var selected_index := _find_selected_index(variants)
	part_options.select(selected_index)
	top_model.set_active_part(active_part_index)
	for index in range(part_buttons.size()):
		part_buttons[index].disabled = false
	if play_sound:
		_play_ui_select()


func _clear_active_part() -> void:
	active_part_index = -1
	part_editor.visible = false
	top_model.set_active_part(-1)
	for button in part_buttons:
		button.disabled = false


func _on_part_options_item_selected(index: int) -> void:
	_try_select_variant(index)


func _try_select_variant(index: int) -> void:
	var variants := _get_active_variants()
	if index < 0 or index >= variants.size():
		return
	var part := variants[index]
	if not _game_state().owns_part(part.part_id):
		var price: int = _game_state().get_part_price(part.part_id)
		if _game_state().coins < price:
			var missing: int = price - _game_state().coins
			summary_label.text = "金币不足，还差 %d\n当前余额：%d" % [
				missing,
				_game_state().coins
			]
			part_options.select(_find_selected_index(variants))
			return
		pending_purchase_part = part
		purchase_dialog.dialog_text = (
			"%s\n价格：%d\n购买后余额：%d"
			% [part.part_name, price, _game_state().coins - price]
		)
		purchase_dialog.popup_centered(Vector2i(480, 260))
		part_options.select(_find_selected_index(variants))
		return
	part_selections[active_part_index] = part.part_id
	_update_summary()
	_play_ui_select()


func _on_purchase_confirmed() -> void:
	if pending_purchase_part == null:
		return
	if _game_state().purchase_part(pending_purchase_part.part_id):
		part_selections[active_part_index] = pending_purchase_part.part_id
		_commit_build()
		_update_summary()
		_select_active_part(active_part_index, false)
	pending_purchase_part = null


func _select_previous_variant() -> void:
	var variants := _get_active_variants()
	var selected_index := wrapi(_find_selected_index(variants) - 1, 0, variants.size())
	_try_select_variant(selected_index)


func _select_next_variant() -> void:
	var variants := _get_active_variants()
	var selected_index := wrapi(_find_selected_index(variants) + 1, 0, variants.size())
	_try_select_variant(selected_index)


func _get_active_variants() -> Array[TopPartResource]:
	if active_part_index < 0:
		return []
	return PartDatabase.get_parts_by_type(PART_TYPES[active_part_index])


func _find_selected_index(variants: Array[TopPartResource]) -> int:
	for index in range(variants.size()):
		if variants[index].part_id == part_selections[active_part_index]:
			return index
	return 0


func _current_part_name(part_index: int) -> String:
	var part := PartDatabase.get_part(part_selections[part_index])
	return part.part_name if part != null else "未知零件"


func _update_summary() -> void:
	var build_names := _get_build_names()
	var loadout: Dictionary = _game_state().get_active_loadout()
	summary_label.text = "%s · %02d/%02d · 金币 %d\n%s / %s / %s / %s / %s" % [
		loadout.name,
		_game_state().active_loadout_index + 1,
		_game_state().LOADOUT_COUNT,
		_game_state().coins,
		build_names[0],
		build_names[1],
		build_names[2],
		build_names[3],
		build_names[4]
	]
	config_button.text = "切换出战槽 · %02d/%02d" % [
		_game_state().active_loadout_index + 1,
		_game_state().LOADOUT_COUNT
	]
	top_model.configure(
		part_selections[0],
		part_selections[1],
		part_selections[2],
		part_selections[3],
		part_selections[4],
		_game_state().custom_ring_color,
		_game_state().custom_core_color,
		_game_state().get_active_loadout_customizations()
	)
	top_model.set_active_part(active_part_index)


func _get_build_names() -> Array[String]:
	return [
		_current_part_name(FivePartTopModel.PartSlot.ATTACK_RING),
		_current_part_name(FivePartTopModel.PartSlot.CORE_LOCK),
		_current_part_name(FivePartTopModel.PartSlot.WEIGHT_DISC),
		_current_part_name(FivePartTopModel.PartSlot.DRIVER_SHAFT),
		_current_part_name(FivePartTopModel.PartSlot.TIP)
	]


func _commit_build() -> void:
	_game_state().set_build(
		part_selections[0],
		part_selections[1],
		part_selections[2],
		part_selections[3],
		part_selections[4]
	)


func _on_next_button_pressed() -> void:
	if _game_state().tutorial.stage == _game_state().TUTORIAL_BUY_FIRST_PART:
		summary_label.text = "先购买并装备一个新零件，再进行验证战。"
		return
	_commit_build()
	get_tree().change_scene_to_file("res://scenes/maps/MapSelectScreen.tscn")


func _on_customize_button_pressed() -> void:
	if active_part_index < 0:
		_select_active_part(FivePartTopModel.PartSlot.ATTACK_RING)
		return
	_open_active_part_diy()


func _open_active_part_diy() -> void:
	_commit_build()
	_game_state().customizing_part_id = part_selections[active_part_index]
	get_tree().change_scene_to_file(
		"res://scenes/assembly/PartCustomizeScreen.tscn"
	)


func _on_test_button_pressed() -> void:
	if _game_state().tutorial.stage == _game_state().TUTORIAL_BUY_FIRST_PART:
		summary_label.text = "新手训练中：请先购买一个新零件。"
		return
	_commit_build()
	get_tree().change_scene_to_file("res://scenes/assembly/TestLabScreen.tscn")


func _on_attack_ring_part_pressed() -> void:
	_select_or_open_diy(FivePartTopModel.PartSlot.ATTACK_RING)


func _on_core_lock_part_pressed() -> void:
	_select_or_open_diy(FivePartTopModel.PartSlot.CORE_LOCK)


func _on_weight_disc_part_pressed() -> void:
	_select_or_open_diy(FivePartTopModel.PartSlot.WEIGHT_DISC)


func _on_driver_shaft_part_pressed() -> void:
	_select_or_open_diy(FivePartTopModel.PartSlot.DRIVER_SHAFT)


func _on_tip_part_pressed() -> void:
	_select_or_open_diy(FivePartTopModel.PartSlot.TIP)


func _select_or_open_diy(part_index: int) -> void:
	if active_part_index == part_index:
		_open_active_part_diy()
	else:
		_select_active_part(part_index)


func _on_config_button_pressed() -> void:
	_commit_build()
	_game_state().set_active_loadout_index(
		wrapi(
			_game_state().active_loadout_index + 1,
			0,
			_game_state().LOADOUT_COUNT
		)
	)
	_restore_saved_build()
	_clear_active_part()
	_update_summary()


func _on_previous_variant_pressed() -> void:
	_select_previous_variant()


func _on_next_variant_pressed() -> void:
	_select_next_variant()


func _on_preview_panel_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.pressed:
			preview_dragging = true
			last_drag_position = event.position
			drag_distance = 0.0
			drag_vector = Vector2.ZERO
		else:
			preview_dragging = false
			if _finish_preview_gesture():
				return
			if drag_distance < 8.0:
				_select_part_from_screen_position(event.position)
	elif event is InputEventMouseMotion and preview_dragging:
		drag_distance += event.relative.length()
		drag_vector += event.relative
		_rotate_preview(event.relative)
	elif event is InputEventScreenTouch:
		if event.pressed:
			preview_dragging = true
			last_drag_position = event.position
			drag_distance = 0.0
			drag_vector = Vector2.ZERO
		else:
			preview_dragging = false
			if _finish_preview_gesture():
				return
			if drag_distance < 8.0:
				_select_part_from_screen_position(event.position)
	elif event is InputEventScreenDrag:
		drag_distance += event.relative.length()
		drag_vector += event.relative
		_rotate_preview(event.relative)


func _finish_preview_gesture() -> bool:
	if absf(drag_vector.x) < 120.0 or absf(drag_vector.x) < absf(drag_vector.y) * 1.4:
		return false
	_commit_build()
	var direction := 1 if drag_vector.x < 0.0 else -1
	_game_state().set_active_loadout_index(
		wrapi(
			_game_state().active_loadout_index + direction,
			0,
			_game_state().LOADOUT_COUNT
		)
	)
	_restore_saved_build()
	_clear_active_part()
	_update_summary()
	return true


func _rotate_preview(delta: Vector2) -> void:
	top_model.rotation_degrees.y += delta.x * 0.45
	top_model.rotation_degrees.x = clampf(
		top_model.rotation_degrees.x + delta.y * 0.25,
		-18.0,
		18.0
	)


func _select_part_from_screen_position(screen_position: Vector2) -> void:
	var anchors := top_model.get_part_anchor_positions()
	var closest_index := -1
	var closest_distance := INF
	for index in range(anchors.size()):
		var projected_position := preview_camera.unproject_position(anchors[index])
		var distance := screen_position.distance_to(projected_position)
		if distance < closest_distance:
			closest_distance = distance
			closest_index = index
	if closest_index < 0 or closest_distance > PREVIEW_CLICK_RADIUS:
		_clear_active_part()
		return
	if closest_index == active_part_index:
		_open_active_part_diy()
	else:
		_select_active_part(closest_index)


func _play_ui_select() -> void:
	if ui_select_player.playing:
		ui_select_player.stop()
	ui_select_player.pitch_scale = randf_range(0.97, 1.03)
	ui_select_player.play()
