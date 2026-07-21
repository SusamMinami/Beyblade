extends Node3D

const BATTLE_SIMULATION := preload(
	"res://scripts/battle/battle_simulation.gd"
)
const UI_THEME_FACTORY := preload("res://scripts/ui/ui_theme_factory.gd")
const ARENA_MAP_CATALOG := preload("res://scripts/maps/arena_map_catalog.gd")

const FIXED_STEP := 1.0 / 60.0
const MAX_FRAME_DELTA := 0.05
const KEYBOARD_CONTROL_STEP := 1.0
const JOYSTICK_RADIUS := 72.0
const PRE_LAUNCH_CAMERA_POSITION := Vector3(0.0, 7.2, 9.0)
const TOP_GROUND_CLEARANCE := 0.45

const RESULT_LABELS := {
	&"spin_out": "停转胜利",
	&"ring_out": "撞飞胜利",
	&"break": "击破胜利",
	&"time": "计时判定"
}
const ENEMY_BUILD_IDS := {
	&"standard": [
		&"attack_ring.balance_six",
		&"core_lock.reinforced",
		&"weight_disc.standard",
		&"driver_shaft.low_stable",
		&"tip.rubber_balance"
	],
	&"metal": [
		&"attack_ring.smash_three",
		&"core_lock.standard",
		&"weight_disc.eccentric",
		&"driver_shaft.high_attack",
		&"tip.flat_attack"
	],
	&"composite": [
		&"attack_ring.stamina_arc",
		&"core_lock.low_center",
		&"weight_disc.heavy_outer",
		&"driver_shaft.low_stable",
		&"tip.metal_stamina"
	]
}

@onready var beyblade: BeybladeBody = %Beyblade
@onready var enemy_beyblade: BeybladeBody = %EnemyBeyblade
@onready var camera: Camera3D = %BattleCamera
@onready var arena_terrain = %ArenaTerrain
@onready var center_metal_patch: MeshInstance3D = %CenterMetalPatch
@onready var map_features: Node3D = %MapFeatures
@onready var battle_summary_label: Label = %BattleSummaryLabel
@onready var spin_label: Label = %SpinLabel
@onready var enemy_spin_label: Label = %EnemySpinLabel
@onready var battle_time_label: Label = %BattleTimeLabel
@onready var battle_log_label: Label = %BattleLogLabel
@onready var joystick_area: Control = %JoystickArea
@onready var joystick_knob: Control = %JoystickKnob
@onready var control_feedback_panel: Control = %ControlFeedbackPanel
@onready var control_feedback_label: Label = %ControlFeedbackLabel
@onready var launch_panel: Control = %LaunchPanel
@onready var launch_direct_area: Control = %LaunchDirectArea
@onready var launch_vector_line: ColorRect = %LaunchVectorLine
@onready var launch_vector_endpoint: ColorRect = %LaunchVectorEndpoint
@onready var launch_power_slider: HSlider = %LaunchPowerSlider
@onready var launch_height_slider: HSlider = %LaunchHeightSlider
@onready var launch_direction_slider: HSlider = %LaunchDirectionSlider
@onready var launch_angle_slider: HSlider = %LaunchAngleSlider
@onready var launch_power_output: Label = %LaunchPowerOutput
@onready var launch_height_output: Label = %LaunchHeightOutput
@onready var launch_direction_output: Label = %LaunchDirectionOutput
@onready var launch_angle_output: Label = %LaunchAngleOutput
@onready var tune_button: Button = %TuneButton
@onready var tutorial_button: Button = %TutorialButton
@onready var pause_button: Button = %PauseButton
@onready var result_panel: Control = %ResultPanel
@onready var result_label: Label = %ResultLabel
@onready var tuning_panel: Control = %TuningPanel
@onready var sound_button: Button = %SoundButton
@onready var tuning_damage_slider: HSlider = %TuningDamageSlider
@onready var tuning_spin_slider: HSlider = %TuningSpinSlider
@onready var tuning_control_slider: HSlider = %TuningControlSlider
@onready var tuning_speed_slider: HSlider = %TuningSpeedSlider
@onready var tuning_damage_output: Label = %TuningDamageOutput
@onready var tuning_spin_output: Label = %TuningSpinOutput
@onready var tuning_control_output: Label = %TuningControlOutput
@onready var tuning_speed_output: Label = %TuningSpeedOutput
@onready var launch_audio: AudioStreamPlayer = %LaunchAudio
@onready var player_spin_audio: AudioStreamPlayer = %PlayerSpinAudio
@onready var enemy_spin_audio: AudioStreamPlayer = %EnemySpinAudio
@onready var reward_audio: AudioStreamPlayer = %RewardAudio
@onready var ring_out_audio: AudioStreamPlayer = %RingOutAudio
@onready var spin_out_audio: AudioStreamPlayer = %SpinOutAudio

var arena_map: ArenaMapResource
var player_build: TopBuildData
var enemy_build: TopBuildData
var simulation
var accumulator := 0.0
var paused := false
var result_handled := false
var reward_granted := false
var joystick_vector := Vector2.ZERO
var joystick_dragging := false
var player_spin_angle := 0.0
var enemy_spin_angle := 0.0


func _ready() -> void:
	arena_map = ARENA_MAP_CATALOG.get_by_name(_game_state().selected_map)
	player_build = _game_state().get_build_data()
	enemy_build = _create_enemy_build()
	_apply_map_theme()
	_configure_arena()
	_configure_visual_body(beyblade, player_build, false)
	_configure_visual_body(enemy_beyblade, enemy_build, true)
	_create_simulation()
	_restore_tuning_controls()
	_update_sound_button()
	tutorial_button.visible = not bool(_game_state().tutorial.completed)
	battle_summary_label.text = (
		"1V1 确定性对战\n%s\nYOU：%s\nAI：%s"
		% [
			arena_map.map_name,
			player_build.attack_ring.part_name,
			enemy_build.attack_ring.part_name
		]
	)
	_prepare_for_launch()
	_update_launch_outputs()
	_update_joystick_knob()


func _process(delta: float) -> void:
	_advance_simulation(delta)
	_sync_battle_visuals(delta)
	_update_camera(delta)
	_update_hud()
	_update_spin_audio()


func _game_state():
	return get_node("/root/GameState")


func _create_enemy_build() -> TopBuildData:
	var ids: Array = ENEMY_BUILD_IDS.get(
		arena_map.map_id,
		ENEMY_BUILD_IDS[&"standard"]
	)
	return AssemblyCalculator.calculate_by_ids(
		ids[0],
		ids[1],
		ids[2],
		ids[3],
		ids[4]
	)


func _create_simulation() -> void:
	simulation = BATTLE_SIMULATION.new(
		player_build,
		enemy_build,
		arena_map,
		20260718,
		_game_state().get_battle_tuning()
	)


func _configure_visual_body(
	body: BeybladeBody,
	build: TopBuildData,
	is_enemy: bool
) -> void:
	body.apply_build_data(build)
	body.reset_top()
	body.set_physics_process(false)
	body.freeze = true
	body.gravity_scale = 0.0
	body.collision_layer = 0
	body.collision_mask = 0
	body.visible = true
	var ring_color: Color = (
		Color(0.96, 0.29, 0.14)
		if is_enemy
		else _game_state().custom_ring_color
	)
	var core_color: Color = (
		Color(0.36, 0.08, 0.06)
		if is_enemy
		else _game_state().custom_core_color
	)
	if (
		not is_enemy
		and _game_state().tutorial.stage
		== _game_state().TUTORIAL_FIRST_BATTLE
	):
		ring_color = Color(0.46, 0.27, 0.12)
		core_color = Color(0.69, 0.45, 0.2)
	body.visual_model.configure(
		build.attack_ring.part_id,
		build.core_lock.part_id,
		build.weight_disc.part_id,
		build.driver_shaft.part_id,
		build.tip.part_id,
		ring_color,
		core_color,
		{} if is_enemy else _game_state().get_active_loadout_customizations()
	)
	body.visual_model.set_active_part(-1)


func _configure_arena() -> void:
	var palette: Dictionary = UI_THEME_FACTORY.get_battle_palette(
		arena_map.map_name
	)
	arena_terrain.configure(arena_map, palette.arena)
	var patch_position := Vector3.ZERO
	patch_position.y = arena_map.get_height_at(patch_position) + 0.012
	center_metal_patch.position = patch_position
	center_metal_patch.basis = _basis_from_up(
		arena_map.get_surface_normal_at(Vector3.ZERO)
	)
	var patch_scale := (
		arena_map.center_surface_radius / 2.2
		if arena_map.supports_composite_terrain
		else 1.0
	)
	center_metal_patch.scale = Vector3(patch_scale, 1.0, patch_scale)
	center_metal_patch.visible = arena_map.supports_composite_terrain
	_configure_arena_features()


func _configure_arena_features() -> void:
	for child in map_features.get_children():
		child.free()
	var palette: Dictionary = UI_THEME_FACTORY.get_battle_palette(
		arena_map.map_name
	)
	match arena_map.map_id:
		&"standard":
			_add_circular_feature(1.15, 0.08, palette.accent, 0.0)
		&"metal":
			_add_circular_feature(4.8, 0.025, Color(0.23, 0.43, 0.5), 0.0)
			_add_circular_feature(3.15, 0.035, Color(0.32, 0.58, 0.66), 0.012)
			_add_circular_feature(1.55, 0.05, Color(0.52, 0.78, 0.84), 0.024)
		&"composite":
			for index in range(8):
				var angle := TAU * float(index) / 8.0
				var position := Vector3(
					cos(angle) * 6.05,
					0.0,
					sin(angle) * 6.05
				)
				position.y = arena_map.get_height_at(position) + 0.08
				_add_box_feature(
					Vector3(1.05, 0.12, 0.48),
					position,
					Vector3(0.0, -angle, 0.0),
					Color(0.74, 0.2, 0.12)
				)


func _add_circular_feature(
	radius: float,
	height: float,
	color: Color,
	y_offset: float
) -> void:
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	mesh.radial_segments = 64
	var position := Vector3.ZERO
	position.y = arena_map.get_height_at(position) + height * 0.5 + y_offset
	_add_feature_mesh(mesh, position, Vector3.ZERO, color)


func _add_box_feature(
	size: Vector3,
	position: Vector3,
	rotation: Vector3,
	color: Color
) -> void:
	var mesh := BoxMesh.new()
	mesh.size = size
	_add_feature_mesh(mesh, position, rotation, color)


func _add_feature_mesh(
	mesh: Mesh,
	position: Vector3,
	rotation: Vector3,
	color: Color
) -> void:
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.position = position
	instance.rotation = rotation
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.metallic = 0.55
	material.roughness = 0.32
	instance.material_override = material
	map_features.add_child(instance)


func _prepare_for_launch() -> void:
	simulation.reset()
	accumulator = 0.0
	paused = false
	result_handled = false
	reward_granted = false
	joystick_vector = Vector2.ZERO
	joystick_dragging = false
	player_spin_angle = 0.0
	enemy_spin_angle = 0.0
	launch_panel.visible = true
	battle_summary_label.visible = true
	joystick_area.visible = false
	control_feedback_panel.visible = false
	result_panel.visible = false
	tuning_panel.visible = false
	pause_button.disabled = true
	sound_button.visible = true
	tune_button.visible = true
	pause_button.text = "暂停"
	$BattleUI/Root/ButtonColumn/LaunchButton.disabled = false
	$BattleUI/Root/ResultPanel/ResultColumn/ResultActions/ResultRestartButton.visible = true
	$BattleUI/Root/ResultPanel/ResultColumn/ResultActions/ResultAssemblyButton.text = "返回改装"
	battle_log_label.text = "拖动发射向量，或精调力度、高度、方向与入场倾角。"
	_sync_battle_visuals(0.0)
	_update_hud()
	_update_joystick_knob()


func _advance_simulation(delta: float) -> void:
	if simulation == null or simulation.phase != &"running" or paused:
		return
	accumulator += clampf(delta, 0.0, MAX_FRAME_DELTA)
	var control := _get_control_vector()
	while accumulator + 0.0000001 >= FIXED_STEP:
		simulation.step(FIXED_STEP, control)
		_process_simulation_events()
		accumulator -= FIXED_STEP
		if simulation.phase != &"running":
			break


func _process_simulation_events() -> void:
	for event in simulation.events:
		if event.type == &"collision":
			var intensity := float(event.intensity)
			if _game_state().sound_enabled:
				beyblade.call("_play_collision_sound", intensity * 12.0)
			battle_log_label.text = "碰撞冲量 %.2f" % float(event.impulse)
		elif event.type == &"stability" and event.actor == &"player":
			battle_log_label.text = (
				"严重失衡，控制正在衰减"
				if event.state == &"critical"
				else "陀螺开始摇晃" if event.state == &"wobble" else "姿态恢复稳定"
			)
		elif event.type == &"ring_out_risk" and event.actor == &"player":
			if event.state != &"safe":
				battle_log_label.text = "撞飞风险：%s" % (
					"危险" if event.state == &"critical" else "警告"
				)
		elif event.type == &"spin_risk" and event.actor == &"player":
			if event.state != &"safe":
				battle_log_label.text = "转速衰退：%s" % (
					"临界" if event.state == &"critical" else "警告"
				)
		elif event.type == &"result":
			_handle_result()


func _handle_result() -> void:
	if result_handled or simulation.result.is_empty():
		return
	result_handled = true
	var winner: StringName = simulation.result.winner
	var reason: StringName = simulation.result.reason
	var won := winner == &"player"
	var reason_label: String = RESULT_LABELS.get(reason, "对战结束")
	var reward := 0
	var tutorial_stage_before: String = str(_game_state().tutorial.stage)
	if not reward_granted:
		reward_granted = true
		reward = _game_state().apply_battle_result(won)
	result_label.text = (
		"%s\n%.1f 秒 · %s"
		% [
			reason_label if won else "本回合失败",
			float(simulation.result.time),
			"+%d 赏金" % reward
		]
	)
	result_panel.visible = true
	pause_button.disabled = true
	battle_log_label.text = reason_label if won else "AI 获胜：%s" % reason_label
	if tutorial_stage_before == _game_state().TUTORIAL_FIRST_BATTLE:
		$BattleUI/Root/ResultPanel/ResultColumn/ResultActions/ResultRestartButton.visible = false
		$BattleUI/Root/ResultPanel/ResultColumn/ResultActions/ResultAssemblyButton.text = "购买第一个零件"
		battle_log_label.text = "首战训练完成，下一步购买并装备新零件。"
	tutorial_button.visible = not bool(_game_state().tutorial.completed)
	_stop_spin_audio()
	if _game_state().sound_enabled:
		if won or tutorial_stage_before == _game_state().TUTORIAL_FIRST_BATTLE:
			reward_audio.play()
		elif reason == &"ring_out":
			ring_out_audio.play()
		else:
			spin_out_audio.play()


func _on_launch_button_pressed() -> void:
	if simulation == null:
		_create_simulation()
	var power := float(launch_power_slider.value)
	var height := float(launch_height_slider.value)
	var direction := deg_to_rad(float(launch_direction_slider.value))
	var angle := float(launch_angle_slider.value) / 12.0
	simulation.launch(power, direction, angle, height)
	accumulator = 0.0
	paused = false
	result_handled = false
	reward_granted = false
	launch_panel.visible = false
	battle_summary_label.visible = false
	joystick_area.visible = true
	control_feedback_panel.visible = true
	result_panel.visible = false
	pause_button.disabled = false
	sound_button.visible = false
	tune_button.visible = false
	$BattleUI/Root/ButtonColumn/LaunchButton.disabled = true
	beyblade.is_launched = true
	enemy_beyblade.is_launched = true
	battle_log_label.text = "发射完成。拖动摇杆微调轨迹。"
	if _game_state().sound_enabled:
		launch_audio.pitch_scale = lerpf(0.9, 1.08, power)
		launch_audio.play()
	_sync_battle_visuals(0.0)


func _on_restart_button_pressed() -> void:
	_create_simulation()
	_prepare_for_launch()


func _on_pause_button_pressed() -> void:
	if simulation == null or simulation.phase != &"running":
		return
	paused = not paused
	pause_button.text = "继续" if paused else "暂停"
	battle_log_label.text = "模拟已暂停" if paused else "模拟继续"


func _on_sound_button_pressed() -> void:
	_game_state().set_sound_enabled(not _game_state().sound_enabled)
	_update_sound_button()
	if not _game_state().sound_enabled:
		_stop_spin_audio()


func _on_tune_button_pressed() -> void:
	tuning_panel.visible = not tuning_panel.visible


func _on_close_tuning_pressed() -> void:
	tuning_panel.visible = false


func _on_damage_tuning_changed(value: float) -> void:
	_set_tuning_value("damage_scale", value)


func _on_spin_tuning_changed(value: float) -> void:
	_set_tuning_value("spin_scale", value)


func _on_control_tuning_changed(value: float) -> void:
	_set_tuning_value("control_scale", value)


func _on_speed_tuning_changed(value: float) -> void:
	_set_tuning_value("speed_scale", value)


func _on_reset_tuning_pressed() -> void:
	_game_state().reset_battle_tuning()
	_restore_tuning_controls()
	if simulation != null:
		simulation.set_tuning(_game_state().get_battle_tuning())


func _set_tuning_value(key: String, value: float) -> void:
	_game_state().set_battle_tuning(key, value)
	var tuning: Dictionary = _game_state().get_battle_tuning()
	if simulation != null:
		simulation.set_tuning({key: tuning[key]})
	_update_tuning_outputs()


func _restore_tuning_controls() -> void:
	var tuning: Dictionary = _game_state().get_battle_tuning()
	tuning_damage_slider.set_value_no_signal(float(tuning.damage_scale))
	tuning_spin_slider.set_value_no_signal(float(tuning.spin_scale))
	tuning_control_slider.set_value_no_signal(float(tuning.control_scale))
	tuning_speed_slider.set_value_no_signal(float(tuning.speed_scale))
	_update_tuning_outputs()


func _update_tuning_outputs() -> void:
	if not is_instance_valid(tuning_damage_output):
		return
	tuning_damage_output.text = "%d%%" % roundi(
		tuning_damage_slider.value * 100.0
	)
	tuning_spin_output.text = "%d%%" % roundi(
		tuning_spin_slider.value * 100.0
	)
	tuning_control_output.text = "%d%%" % roundi(
		tuning_control_slider.value * 100.0
	)
	tuning_speed_output.text = "%d%%" % roundi(
		tuning_speed_slider.value * 100.0
	)


func _update_sound_button() -> void:
	if is_instance_valid(sound_button):
		sound_button.text = (
			"声音：开" if _game_state().sound_enabled else "声音：关"
		)


func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/maps/MapSelectScreen.tscn")


func _on_result_assembly_pressed() -> void:
	get_tree().change_scene_to_file(
		"res://scenes/assembly/AssemblyScreen.tscn"
	)


func _on_result_restart_pressed() -> void:
	_create_simulation()
	_prepare_for_launch()


func _on_launch_parameter_changed(_value: float) -> void:
	_update_launch_outputs()


func _update_launch_outputs() -> void:
	if not is_instance_valid(launch_power_output):
		return
	launch_power_output.text = "%d%%" % roundi(
		float(launch_power_slider.value) * 100.0
	)
	launch_height_output.text = "%d%%" % roundi(
		float(launch_height_slider.value) * 100.0
	)
	launch_direction_output.text = "%d°" % roundi(
		float(launch_direction_slider.value)
	)
	launch_angle_output.text = "%d°" % roundi(
		float(launch_angle_slider.value)
	)
	_update_launch_vector()


func _update_launch_vector() -> void:
	if not is_instance_valid(launch_direct_area):
		return
	var center := launch_direct_area.size * 0.5
	var max_length := maxf(minf(launch_direct_area.size.x * 0.42, 210.0), 42.0)
	var normalized_power := inverse_lerp(
		0.35,
		1.0,
		float(launch_power_slider.value)
	)
	var length := lerpf(34.0, max_length, normalized_power)
	var direction := deg_to_rad(float(launch_direction_slider.value))
	var target := center + Vector2(sin(direction), -cos(direction)) * length
	launch_vector_line.position = center - Vector2(4.0, length)
	launch_vector_line.size = Vector2(8.0, length)
	launch_vector_line.pivot_offset = Vector2(4.0, length)
	launch_vector_line.rotation = direction
	launch_vector_endpoint.position = target - Vector2(16.0, 16.0)
	launch_vector_endpoint.size = Vector2(32.0, 32.0)


func _on_launch_direct_area_gui_input(event: InputEvent) -> void:
	var position := Vector2.ZERO
	var active := false
	if event is InputEventScreenDrag:
		position = event.position
		active = true
	elif event is InputEventMouseMotion and event.button_mask & MOUSE_BUTTON_MASK_LEFT:
		position = event.position
		active = true
	if not active:
		return
	var center := launch_direct_area.size * 0.5
	var vector := position - center
	var direction_degrees := clampf(
		rad_to_deg(atan2(vector.x, -vector.y)),
		-30.0,
		30.0
	)
	var power := clampf(vector.length() / 210.0, 0.35, 1.0)
	var angle_degrees := clampf(-vector.y / 9.0, -12.0, 12.0)
	launch_direction_slider.value = direction_degrees
	launch_power_slider.value = power
	launch_angle_slider.value = angle_degrees
	_update_launch_outputs()


func _on_tutorial_button_pressed() -> void:
	_game_state().skip_tutorial()
	get_tree().change_scene_to_file(
		"res://scenes/assembly/AssemblyScreen.tscn"
	)


func _get_control_vector() -> Vector2:
	var keyboard_vector := _get_keyboard_control_vector()
	return (
		keyboard_vector
		if keyboard_vector.length_squared() > 0.01
		else joystick_vector
	)


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


func _sync_battle_visuals(delta: float) -> void:
	if simulation == null:
		return
	if simulation.phase == &"running":
		player_spin_angle += simulation.player.spin * delta
		enemy_spin_angle -= simulation.enemy.spin * delta
	_sync_top_visual(
		beyblade,
		simulation.player,
		player_spin_angle
	)
	_sync_top_visual(
		enemy_beyblade,
		simulation.enemy,
		enemy_spin_angle
	)


func _sync_top_visual(
	body: BeybladeBody,
	state,
	spin_angle: float
) -> void:
	var terrain_position := Vector3(
		state.position.x,
		0.0,
		state.position.y
	)
	terrain_position.y = (
		arena_map.get_height_at(terrain_position)
		+ TOP_GROUND_CLEARANCE
	)
	body.global_position = terrain_position
	var movement_angle := atan2(state.velocity.y, state.velocity.x)
	body.rotation = Vector3(
		sin(movement_angle) * state.tilt,
		spin_angle,
		-cos(movement_angle) * state.tilt
	)
	body.spin_speed = state.spin
	body.current_durability = state.durability
	body.is_launched = simulation.phase == &"running"
	var surface := arena_map.get_surface_at_radius(state.position.length())
	if surface != null and body.get_meta("simulation_surface", &"") != surface.surface_name:
		body.set_meta("simulation_surface", surface.surface_name)
		body.set_terrain_surface(surface)
	_sync_damage_visual(body, state)


func _sync_damage_visual(body: BeybladeBody, state) -> void:
	var integrity := clampf(
		state.durability / maxf(state.build.durability, 0.001),
		0.0,
		1.0
	)
	var previous := float(body.get_meta("simulation_integrity", -1.0))
	if absf(previous - integrity) < 0.001:
		return
	body.set_meta("simulation_integrity", integrity)
	for part_index in range(body.visual_model.get_customizable_part_count()):
		body.visual_model.set_part_damage_state(
			part_index,
			integrity,
			integrity <= 0.0
		)


func _update_camera(delta: float) -> void:
	if simulation == null or simulation.phase == &"ready":
		camera.global_position = PRE_LAUNCH_CAMERA_POSITION
		camera.look_at(Vector3.ZERO, Vector3.UP)
		return
	var midpoint := (
		beyblade.global_position + enemy_beyblade.global_position
	) * 0.5
	var separation := beyblade.global_position.distance_to(
		enemy_beyblade.global_position
	)
	var target_position := midpoint + Vector3(
		0.0,
		2.9 + separation * 0.18,
		3.8 + separation * 0.34
	)
	camera.global_position = camera.global_position.lerp(
		target_position,
		minf(delta * 6.5, 1.0)
	)
	camera.look_at(midpoint, Vector3.UP)


func _update_hud() -> void:
	if simulation == null:
		return
	spin_label.text = "YOU\n%.0f RPM\n%.0f DUR" % [
		simulation.player.spin,
		simulation.player.durability
	]
	enemy_spin_label.text = "AI\n%.0f RPM\n%.0f DUR" % [
		simulation.enemy.spin,
		simulation.enemy.durability
	]
	battle_time_label.text = "ROUND 01\n%.1f" % simulation.time
	_update_control_feedback(simulation.player.control_input)


func _update_spin_audio() -> void:
	var should_play: bool = (
		_game_state().sound_enabled
		and simulation != null
		and simulation.phase == &"running"
		and not paused
	)
	if not should_play:
		_stop_spin_audio()
		return
	_update_spin_voice(
		player_spin_audio,
		simulation.player.spin,
		simulation.player.build.max_spin_speed,
		1.0
	)
	_update_spin_voice(
		enemy_spin_audio,
		simulation.enemy.spin,
		simulation.enemy.build.max_spin_speed,
		0.92
	)


func _update_spin_voice(
	audio: AudioStreamPlayer,
	spin: float,
	max_spin: float,
	pitch_scale: float
) -> void:
	var normalized := clampf(spin / maxf(max_spin, 0.001), 0.0, 1.0)
	audio.pitch_scale = (0.72 + normalized * 0.58) * pitch_scale
	audio.volume_db = lerpf(-28.0, -11.0, normalized)
	if not audio.playing:
		audio.play()


func _stop_spin_audio() -> void:
	if is_instance_valid(player_spin_audio) and player_spin_audio.playing:
		player_spin_audio.stop()
	if is_instance_valid(enemy_spin_audio) and enemy_spin_audio.playing:
		enemy_spin_audio.stop()


func _update_control_feedback(control: Vector2) -> void:
	var influence: float = (
		simulation.player.control_influence * 100.0
		if simulation != null
		else 0.0
	)
	var state_text := "拖动摇杆决定偏转方向"
	if simulation != null:
		var spin_ratio: float = (
			simulation.player.spin
			/ maxf(simulation.player.build.max_spin_speed, 0.001)
		)
		if simulation.phase == &"running" and spin_ratio < 0.18:
			state_text = "低转速：推力和移动距离显著衰减"
		elif simulation.player.imbalance > 0.55:
			state_text = "失衡：控制力已被削弱"
		elif control.length_squared() > 0.01:
			state_text = "箭头方向即当前施力方向"
	control_feedback_label.text = "操控 %s  推力 %.0f%%\n%s" % [
		_control_arrow(control),
		influence,
		state_text
	]


func _control_arrow(control: Vector2) -> String:
	if control.length_squared() <= 0.01:
		return "·"
	var horizontal := signf(control.x)
	var vertical := signf(control.y)
	if horizontal < 0.0 and vertical < 0.0:
		return "↖"
	if horizontal > 0.0 and vertical < 0.0:
		return "↗"
	if horizontal < 0.0 and vertical > 0.0:
		return "↙"
	if horizontal > 0.0 and vertical > 0.0:
		return "↘"
	if absf(control.x) > absf(control.y):
		return "←" if control.x < 0.0 else "→"
	return "↑" if control.y < 0.0 else "↓"


func _apply_map_theme() -> void:
	var palette: Dictionary = UI_THEME_FACTORY.get_battle_palette(
		arena_map.map_name
	)
	$BattleUI/Root.theme = UI_THEME_FACTORY.create_battle_theme(
		arena_map.map_name
	)
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = palette.background
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = palette.accent.lightened(0.35)
	environment.ambient_light_energy = 0.58
	$WorldEnvironment.environment = environment
	_apply_mesh_color(center_metal_patch, palette.center, 0.76, 0.24)
	$DirectionalLight3D.light_color = palette.accent.lightened(0.45)
	joystick_knob.color = Color(
		palette.accent.r,
		palette.accent.g,
		palette.accent.b,
		0.82
	)


func _apply_mesh_color(
	mesh_instance: MeshInstance3D,
	color: Color,
	metallic: float,
	roughness: float
) -> void:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.metallic = metallic
	material.roughness = roughness
	mesh_instance.material_override = material


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
