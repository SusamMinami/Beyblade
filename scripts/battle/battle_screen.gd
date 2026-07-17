extends Node3D

const KEYBOARD_CONTROL_STEP := 1.0
const JOYSTICK_RADIUS := 72.0
const PRE_LAUNCH_CAMERA_POSITION := Vector3(0.0, 8.4, 9.8)
const FOLLOW_CAMERA_OFFSET := Vector3(0.0, 3.2, 4.2)
const LAUNCH_HORIZONTAL_POSITION := Vector3(0.0, 0.0, 5.4)
const TOP_GROUND_CLEARANCE := 0.45
const WIN_REWARD := 120

@onready var beyblade: BeybladeBody = %Beyblade
@onready var camera: Camera3D = %BattleCamera
@onready var arena_terrain: ArenaTerrain = %ArenaTerrain
@onready var center_metal_patch: MeshInstance3D = %CenterMetalPatch
@onready var battle_summary_label: Label = %BattleSummaryLabel
@onready var spin_label: Label = %SpinLabel
@onready var battle_log_label: Label = %BattleLogLabel
@onready var joystick_area: Control = %JoystickArea
@onready var joystick_knob: Control = %JoystickKnob

var joystick_vector := Vector2.ZERO
var joystick_dragging := false
var battle_started := false
var reward_granted := false
var arena_map: ArenaMapResource


func _ready() -> void:
	arena_map = ArenaMapCatalog.get_by_name(_game_state().selected_map)
	_configure_arena()
	beyblade.part_damaged.connect(_on_beyblade_part_damaged)
	beyblade.part_detached.connect(_on_beyblade_part_detached)
	battle_summary_label.text = (
		"战斗配置\n%s\n地形倾角：最高约 %.1f°"
		% [_game_state().get_battle_summary(), arena_map.get_max_incline_degrees()]
	)
	battle_log_label.text = "利用下坡加速、上坡减速。受损或脱落会偏移质心并加快失速。"
	_prepare_for_launch()
	_update_joystick_knob()
	_update_spin_label()


func _game_state():
	return get_node("/root/GameState")


func _process(delta: float) -> void:
	var keyboard_vector := _get_keyboard_control_vector()
	var final_control := (
		keyboard_vector
		if keyboard_vector.length_squared() > 0.01
		else joystick_vector
	)
	beyblade.set_control_vector(final_control)
	_update_camera(delta)
	_check_battle_end()
	_update_spin_label()


func _configure_arena() -> void:
	var terrain_color := Color(0.18, 0.2, 0.23, 1.0)
	if arena_map.default_surface != null:
		var friction_ratio := clampf(
			arena_map.default_surface.surface_friction,
			0.0,
			1.4
		)
		terrain_color = Color(0.12, 0.16, 0.2).lerp(
			Color(0.34, 0.38, 0.4),
			friction_ratio / 1.4
		)
	arena_terrain.configure(arena_map, terrain_color)
	beyblade.set_terrain_surface(arena_map.default_surface)

	var patch_position := Vector3.ZERO
	patch_position.y = arena_map.get_height_at(patch_position) + 0.012
	center_metal_patch.position = patch_position
	var patch_normal := arena_map.get_surface_normal_at(Vector3.ZERO)
	center_metal_patch.basis = _basis_from_up(patch_normal)


func _prepare_for_launch() -> void:
	battle_started = false
	reward_granted = false
	beyblade.reset_top()
	beyblade.visible = false
	beyblade.freeze = true
	beyblade.global_position = Vector3(0.0, -8.0, 0.0)
	camera.global_position = PRE_LAUNCH_CAMERA_POSITION
	camera.look_at(Vector3.ZERO, Vector3.UP)


func _get_keyboard_control_vector() -> Vector2:
	var vector := Vector2.ZERO
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		vector.x -= KEYBOARD_CONTROL_STEP
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		vector.x += KEYBOARD_CONTROL_STEP
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		vector.y -= KEYBOARD_CONTROL_STEP
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		vector.y += KEYBOARD_CONTROL_STEP
	return vector.limit_length(1.0)


func _update_spin_label() -> void:
	var state_text := (
		"已击破"
		if beyblade.is_defeated()
		else ("已发射" if beyblade.is_launched else "待发射")
	)
	var weakest_part_text := "无"
	var damaged_part_index := beyblade.get_most_damaged_part_index()
	if beyblade.get_integrity_ratio() < 0.999 and damaged_part_index >= 0:
		weakest_part_text = "%s %.0f%%" % [
			beyblade.get_part_display_name(damaged_part_index),
			beyblade.get_part_integrity_ratio(damaged_part_index) * 100.0
		]
	var eccentricity := Vector2(
		beyblade.damage_center_of_mass_offset.x,
		beyblade.damage_center_of_mass_offset.z
	).length()
	spin_label.text = (
		"状态：%s\n转速：%.1f\n结构：%.0f%%\n"
		+ "最弱：%s\n偏心：%.3f\n脱落：%d\n赏金：%d"
	) % [
		state_text,
		beyblade.spin_speed,
		beyblade.get_integrity_ratio() * 100.0,
		weakest_part_text,
		eccentricity,
		beyblade.get_detached_part_count(),
		_game_state().coins
	]


func _on_launch_button_pressed() -> void:
	battle_started = true
	reward_granted = false
	beyblade.reset_top()
	beyblade.visible = true
	beyblade.freeze = false
	var launch_position := LAUNCH_HORIZONTAL_POSITION
	launch_position.y = (
		arena_map.get_height_at(launch_position)
		+ TOP_GROUND_CLEARANCE
	)
	beyblade.global_position = launch_position
	beyblade.launch(Vector3.FORWARD)
	battle_log_label.text = "发射完成。顺坡会提速，逆坡会减速；控制输入可用于选择路线。"


func _on_restart_button_pressed() -> void:
	joystick_vector = Vector2.ZERO
	joystick_dragging = false
	_prepare_for_launch()
	_update_joystick_knob()
	battle_log_label.text = "回合已重置，部件耐久和质心恢复。"


func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/maps/MapSelectScreen.tscn")


func _update_camera(delta: float) -> void:
	if not battle_started or not beyblade.visible:
		return
	var target_position := beyblade.global_position + FOLLOW_CAMERA_OFFSET
	camera.global_position = camera.global_position.lerp(
		target_position,
		minf(delta * 5.0, 1.0)
	)
	camera.look_at(beyblade.global_position, Vector3.UP)


func _check_battle_end() -> void:
	if not battle_started or reward_granted or beyblade.is_launched:
		return
	reward_granted = true
	if beyblade.is_defeated():
		battle_log_label.text = "结构耐久归零，本回合被击破。"
		return
	_game_state().add_reward(WIN_REWARD)
	battle_log_label.text = "Spin Out：战斗结束。获得赏金 %d。" % WIN_REWARD


func _on_beyblade_part_damaged(
	part_index: int,
	_part_id: StringName,
	damage_amount: float,
	integrity_ratio: float
) -> void:
	var part_name := beyblade.get_part_display_name(part_index)
	if integrity_ratio <= 0.3:
		battle_log_label.text = "%s 严重损坏，质心偏移和失速风险上升。" % part_name
	elif integrity_ratio <= 0.65:
		battle_log_label.text = "%s 完整度 %.0f%%，本次承受 %.1f 伤害。" % [
			part_name,
			integrity_ratio * 100.0,
			damage_amount
		]


func _on_beyblade_part_detached(part_index: int, _part_id: StringName) -> void:
	var part_name := beyblade.get_part_display_name(part_index)
	battle_log_label.text = "%s 已脱落。陀螺仍会运行，但摆动和转速衰减显著增加。" % part_name


func _on_joystick_area_gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		joystick_dragging = event.pressed
		if event.pressed:
			_set_joystick_from_local_position(event.position)
		else:
			joystick_vector = Vector2.ZERO
			_update_joystick_knob()
	elif event is InputEventMouseMotion and joystick_dragging:
		_set_joystick_from_local_position(event.position)
	elif event is InputEventScreenTouch:
		joystick_dragging = event.pressed
		if event.pressed:
			_set_joystick_from_local_position(event.position)
		else:
			joystick_vector = Vector2.ZERO
			_update_joystick_knob()
	elif event is InputEventScreenDrag:
		_set_joystick_from_local_position(event.position)


func _set_joystick_from_local_position(local_position: Vector2) -> void:
	var center := joystick_area.size * 0.5
	joystick_vector = (
		(local_position - center) / JOYSTICK_RADIUS
	).limit_length(1.0)
	_update_joystick_knob()


func _update_joystick_knob() -> void:
	if joystick_knob == null or joystick_area == null:
		return
	var center := joystick_area.size * 0.5
	joystick_knob.position = (
		center
		+ joystick_vector * JOYSTICK_RADIUS
		- joystick_knob.size * 0.5
	)


func _basis_from_up(up_direction: Vector3) -> Basis:
	var forward := Vector3.FORWARD
	if absf(up_direction.dot(forward)) > 0.98:
		forward = Vector3.RIGHT
	var right := up_direction.cross(forward).normalized()
	var corrected_forward := right.cross(up_direction).normalized()
	return Basis(right, up_direction, corrected_forward)
