extends Node3D

const KEYBOARD_CONTROL_STEP := 1.0
const JOYSTICK_RADIUS := 72.0
const PRE_LAUNCH_CAMERA_POSITION := Vector3(0.0, 8.4, 9.8)
const FOLLOW_CAMERA_OFFSET := Vector3(0.0, 3.2, 4.2)
const LAUNCH_POSITION := Vector3(0.0, 0.45, 5.4)
const WIN_REWARD := 120

@onready var beyblade: BeybladeBody = %Beyblade
@onready var camera: Camera3D = %BattleCamera
@onready var battle_summary_label: Label = %BattleSummaryLabel
@onready var spin_label: Label = %SpinLabel
@onready var battle_log_label: Label = %BattleLogLabel
@onready var joystick_area: Control = %JoystickArea
@onready var joystick_knob: Control = %JoystickKnob

var joystick_vector: Vector2 = Vector2.ZERO
var joystick_dragging := false
var battle_started := false
var reward_granted := false

func _ready() -> void:
	if not beyblade.part_damaged.is_connected(_on_beyblade_part_damaged):
		beyblade.part_damaged.connect(_on_beyblade_part_damaged)
	if not beyblade.part_broken.is_connected(_on_beyblade_part_broken):
		beyblade.part_broken.connect(_on_beyblade_part_broken)
	battle_summary_label.text = "战斗配置\n%s" % _game_state().get_battle_summary()
	battle_log_label.text = "发射前先观察场地。点击发射后镜头会拉近并跟随陀螺。"
	_prepare_for_launch()
	_update_joystick_knob()
	_update_spin_label()


func _game_state():
	return get_node("/root/GameState")


func _process(_delta: float) -> void:
	var keyboard_vector := _get_keyboard_control_vector()
	var final_control := keyboard_vector if keyboard_vector.length_squared() > 0.01 else joystick_vector
	beyblade.set_control_vector(final_control)
	_update_camera(_delta)
	_check_battle_end()
	_update_spin_label()


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
	var state_text := "部件破坏" if beyblade.is_broken else (
		"已发射" if beyblade.is_launched else "待发射"
	)
	var damaged_part_index := beyblade.get_most_damaged_part_index()
	var weakest_part_text := "无"
	if beyblade.get_integrity_ratio() < 0.999:
		weakest_part_text = "%s %.0f%%" % [
			beyblade.get_part_display_name(damaged_part_index),
			beyblade.get_part_integrity_ratio(damaged_part_index) * 100.0
		]
	spin_label.text = "状态：%s\n转速：%.1f\n结构：%.0f%%\n最弱：%s\n赏金：%d" % [
		state_text,
		beyblade.spin_speed,
		beyblade.get_integrity_ratio() * 100.0,
		weakest_part_text,
		_game_state().coins
	]


func _on_launch_button_pressed() -> void:
	battle_started = true
	reward_granted = false
	beyblade.reset_top()
	beyblade.visible = true
	beyblade.freeze = false
	beyblade.global_position = LAUNCH_POSITION
	beyblade.launch(Vector3.FORWARD)
	battle_log_label.text = "发射完成。镜头已切换为近距离跟随。使用摇杆或键盘微调移动方向。"


func _on_restart_button_pressed() -> void:
	joystick_vector = Vector2.ZERO
	joystick_dragging = false
	_prepare_for_launch()
	_update_joystick_knob()
	battle_log_label.text = "回合已重置。发射前陀螺不会出现在场地内。"


func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/maps/MapSelectScreen.tscn")


func _update_camera(delta: float) -> void:
	if not battle_started or not beyblade.visible:
		return
	var target_position := beyblade.global_position + FOLLOW_CAMERA_OFFSET
	camera.global_position = camera.global_position.lerp(target_position, minf(delta * 5.0, 1.0))
	camera.look_at(beyblade.global_position, Vector3.UP)


func _check_battle_end() -> void:
	if not battle_started or reward_granted:
		return
	if beyblade.is_broken:
		reward_granted = true
		var broken_part_name := beyblade.get_part_display_name(beyblade.broken_part_index)
		battle_log_label.text = (
			"Break：%s 已破坏，本回合失败。重置后会恢复全部部件耐久。"
			% broken_part_name
		)
		return
	if beyblade.is_launched:
		return
	reward_granted = true
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
		battle_log_label.text = "%s 严重损坏，完整度 %.0f%%，性能大幅下降。" % [
			part_name,
			integrity_ratio * 100.0
		]
	elif integrity_ratio <= 0.65:
		battle_log_label.text = "%s 受损，完整度 %.0f%%，本次承受 %.1f 伤害。" % [
			part_name,
			integrity_ratio * 100.0,
			damage_amount
		]


func _on_beyblade_part_broken(part_index: int, _part_id: StringName) -> void:
	var part_name := beyblade.get_part_display_name(part_index)
	battle_log_label.text = "%s 结构失效，Break 判定即将生效。" % part_name


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
	joystick_vector = ((local_position - center) / JOYSTICK_RADIUS).limit_length(1.0)
	_update_joystick_knob()


func _update_joystick_knob() -> void:
	if joystick_knob == null or joystick_area == null:
		return
	var center := joystick_area.size * 0.5
	joystick_knob.position = center + joystick_vector * JOYSTICK_RADIUS - joystick_knob.size * 0.5
