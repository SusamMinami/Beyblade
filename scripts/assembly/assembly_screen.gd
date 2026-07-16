extends Control

const PART_NAMES := ["攻击环", "核心锁扣", "金属配重盘", "驱动中轴", "轴尖"]
const PART_VARIANTS := [
	["六刃平衡攻击环", "三翼重击攻击环", "圆弧续航攻击环"],
	["标准核心锁扣", "低重心核心锁扣", "强化核心锁扣"],
	["标准金属配重盘", "重型外缘配重盘", "偏心突击配重盘"],
	["标准驱动中轴", "低位稳定中轴", "高位突击中轴"],
	["橡胶平衡尖", "金属续航尖", "攻击扁平尖"]
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

var part_selections: Array[int] = [0, 0, 0, 0, 0]
var active_part_index := FivePartTopModel.PartSlot.ATTACK_RING
var preview_dragging := false
var last_drag_position := Vector2.ZERO
var drag_distance := 0.0

func _ready() -> void:
	_position_preview_camera()
	_restore_saved_build()
	_select_active_part(active_part_index, false)
	_update_summary()


func _process(delta: float) -> void:
	if not preview_dragging:
		top_model.rotation_degrees.y += delta * 15.0


func _position_preview_camera() -> void:
	preview_camera.global_position = Vector3(0.0, 1.18, 6.4)
	preview_camera.look_at(Vector3(0.0, 0.02, 0.0), Vector3.UP)


func _game_state():
	return get_node("/root/GameState")


func _restore_saved_build() -> void:
	var saved_names := [
		_game_state().selected_attack_ring,
		_game_state().selected_core_lock,
		_game_state().selected_weight_disc,
		_game_state().selected_driver_shaft,
		_game_state().selected_tip
	]
	for part_index in range(PART_VARIANTS.size()):
		var saved_index: int = PART_VARIANTS[part_index].find(saved_names[part_index])
		part_selections[part_index] = maxi(saved_index, 0)


func _select_active_part(part_index: int, play_sound := true) -> void:
	active_part_index = clampi(part_index, 0, PART_VARIANTS.size() - 1)
	active_part_label.text = "%02d  %s" % [active_part_index + 1, PART_NAMES[active_part_index]]
	part_description_label.text = PART_DESCRIPTIONS[active_part_index]
	part_options.clear()
	for variant_name in PART_VARIANTS[active_part_index]:
		part_options.add_item(variant_name)
	part_options.select(part_selections[active_part_index])
	top_model.set_active_part(active_part_index)
	for index in range(part_buttons.size()):
		part_buttons[index].disabled = index == active_part_index
	if play_sound:
		_play_ui_select()


func _on_part_options_item_selected(index: int) -> void:
	part_selections[active_part_index] = index
	_update_summary()
	_play_ui_select()


func _select_previous_variant() -> void:
	var variants: Array = PART_VARIANTS[active_part_index]
	part_selections[active_part_index] = wrapi(
		part_selections[active_part_index] - 1,
		0,
		variants.size()
	)
	part_options.select(part_selections[active_part_index])
	_update_summary()
	_play_ui_select()


func _select_next_variant() -> void:
	var variants: Array = PART_VARIANTS[active_part_index]
	part_selections[active_part_index] = wrapi(
		part_selections[active_part_index] + 1,
		0,
		variants.size()
	)
	part_options.select(part_selections[active_part_index])
	_update_summary()
	_play_ui_select()


func _current_part_name(part_index: int) -> String:
	return PART_VARIANTS[part_index][part_selections[part_index]]


func _update_summary() -> void:
	var build_names := _get_build_names()
	summary_label.text = "五件式结构 · 5/5 已配置\n%s / %s / %s / %s / %s" % build_names
	top_model.configure(
		build_names[0],
		build_names[1],
		build_names[2],
		build_names[3],
		build_names[4],
		_game_state().custom_ring_color,
		_game_state().custom_core_color
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
	var build_names := _get_build_names()
	_game_state().set_build(
		build_names[0],
		build_names[1],
		build_names[2],
		build_names[3],
		build_names[4]
	)


func _on_next_button_pressed() -> void:
	_commit_build()
	get_tree().change_scene_to_file("res://scenes/maps/MapSelectScreen.tscn")


func _on_customize_button_pressed() -> void:
	_commit_build()
	get_tree().change_scene_to_file("res://scenes/assembly/PartCustomizeScreen.tscn")


func _on_test_button_pressed() -> void:
	_commit_build()
	get_tree().change_scene_to_file("res://scenes/assembly/TestLabScreen.tscn")


func _on_attack_ring_part_pressed() -> void:
	_select_active_part(FivePartTopModel.PartSlot.ATTACK_RING)


func _on_core_lock_part_pressed() -> void:
	_select_active_part(FivePartTopModel.PartSlot.CORE_LOCK)


func _on_weight_disc_part_pressed() -> void:
	_select_active_part(FivePartTopModel.PartSlot.WEIGHT_DISC)


func _on_driver_shaft_part_pressed() -> void:
	_select_active_part(FivePartTopModel.PartSlot.DRIVER_SHAFT)


func _on_tip_part_pressed() -> void:
	_select_active_part(FivePartTopModel.PartSlot.TIP)


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
		else:
			preview_dragging = false
			if drag_distance < 8.0:
				_select_part_from_screen_position(event.position)
	elif event is InputEventMouseMotion and preview_dragging:
		drag_distance += event.relative.length()
		_rotate_preview(event.relative)
	elif event is InputEventScreenTouch:
		if event.pressed:
			preview_dragging = true
			last_drag_position = event.position
			drag_distance = 0.0
		else:
			preview_dragging = false
			if drag_distance < 8.0:
				_select_part_from_screen_position(event.position)
	elif event is InputEventScreenDrag:
		drag_distance += event.relative.length()
		_rotate_preview(event.relative)


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
		return
	if closest_index == active_part_index:
		_select_next_variant()
	else:
		_select_active_part(closest_index)


func _play_ui_select() -> void:
	if ui_select_player.playing:
		ui_select_player.stop()
	ui_select_player.pitch_scale = randf_range(0.97, 1.03)
	ui_select_player.play()
