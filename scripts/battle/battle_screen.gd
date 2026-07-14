extends Node3D

const KEYBOARD_CONTROL_STEP := 1.0
const JOYSTICK_RADIUS := 72.0

@onready var beyblade: BeybladeBody = %Beyblade
@onready var battle_summary_label: Label = %BattleSummaryLabel
@onready var spin_label: Label = %SpinLabel
@onready var battle_log_label: Label = %BattleLogLabel
@onready var joystick_area: Control = %JoystickArea
@onready var joystick_knob: Control = %JoystickKnob

var joystick_vector: Vector2 = Vector2.ZERO
var joystick_dragging := false

func _ready() -> void:
	battle_summary_label.text = "战斗配置\n%s" % _game_state().get_battle_summary()
	battle_log_label.text = "点击发射开始。电脑端可用 WASD / 方向键控制，手机端可拖动左下角摇杆区域。"
	_update_joystick_knob()
	_update_spin_label()


func _game_state():
	return get_node("/root/GameState")


func _process(_delta: float) -> void:
	var keyboard_vector := _get_keyboard_control_vector()
	var final_control := keyboard_vector if keyboard_vector.length_squared() > 0.01 else joystick_vector
	beyblade.set_control_vector(final_control)
	_update_spin_label()


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
	var state_text := "已发射" if beyblade.is_launched else "待发射"
	spin_label.text = "状态：%s\n转速：%.1f" % [state_text, beyblade.spin_speed]


func _on_launch_button_pressed() -> void:
	beyblade.reset_top()
	beyblade.launch(Vector3.FORWARD)
	battle_log_label.text = "发射完成。转速会持续衰减，使用摇杆或键盘微调移动方向。"


func _on_restart_button_pressed() -> void:
	joystick_vector = Vector2.ZERO
	joystick_dragging = false
	beyblade.reset_top()
	_update_joystick_knob()
	battle_log_label.text = "回合已重置。"


func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/maps/MapSelectScreen.tscn")


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
