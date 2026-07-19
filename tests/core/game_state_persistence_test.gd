extends Node

const GAME_STATE_SCRIPT := preload("res://scripts/core/game_state.gd")

var _failures: Array[String] = []


func _ready() -> void:
	_run()


func _run() -> void:
	var test_save_path := (
		"res://.godot/state_test_%d.cfg"
		% Time.get_ticks_usec()
	)
	var direct_file := FileAccess.open(test_save_path, FileAccess.WRITE)
	_expect(
		direct_file != null,
		"用户数据目录必须可写，错误码：%d" % FileAccess.get_open_error()
	)
	if direct_file != null:
		direct_file.store_string("probe")
		direct_file.close()
		DirAccess.remove_absolute(
			ProjectSettings.globalize_path(test_save_path)
		)

	var config_probe := ConfigFile.new()
	config_probe.set_value("probe", "value", 1)
	var config_probe_error := config_probe.save(test_save_path)
	_expect(
		config_probe_error == OK,
		"ConfigFile 最小写入必须成功，错误码：%d" % config_probe_error
	)

	var source = GAME_STATE_SCRIPT.new()
	source.save_path = test_save_path
	source.set_build(
		&"attack_ring.smash_three",
		&"core_lock.reinforced",
		&"weight_disc.eccentric",
		&"driver_shaft.high_attack",
		&"tip.flat_attack"
	)
	source.set_map("复合材质竞技场")
	source.set_custom_part(
		Color(0.12, 0.34, 0.56),
		Color(0.78, 0.21, 0.09),
		"突击型"
	)
	source.add_reward(360)
	source.set_sound_enabled(false)
	source.set_battle_tuning("damage_scale", 1.4)
	source.set_battle_tuning("spin_scale", 0.8)
	source.set_battle_tuning("control_scale", 1.2)
	source.set_battle_tuning("speed_scale", 1.1)
	var save_error: Error = source.save_state()
	_expect(
		save_error == OK,
		"状态必须能够写入 ConfigFile，错误码：%d" % save_error
	)

	var restored = GAME_STATE_SCRIPT.new()
	restored.save_path = test_save_path
	var load_error: Error = restored.load_state()
	_expect(
		load_error == OK,
		"状态必须能够从 ConfigFile 恢复，错误码：%d" % load_error
	)
	_expect(
		restored.selected_attack_ring_id == &"attack_ring.smash_three",
		"必须恢复攻击环"
	)
	_expect(
		restored.selected_tip_id == &"tip.flat_attack",
		"必须恢复轴尖"
	)
	_expect(restored.selected_map == "复合材质竞技场", "必须恢复地图")
	_expect(restored.coins == 360, "必须恢复赏金")
	_expect(restored.custom_part_style == "突击型", "必须恢复样式")
	_expect(
		restored.custom_ring_color.is_equal_approx(Color(0.12, 0.34, 0.56)),
		"必须恢复攻击环颜色"
	)
	_expect(not restored.sound_enabled, "必须恢复静音状态")
	var tuning: Dictionary = restored.get_battle_tuning()
	_expect(is_equal_approx(tuning.damage_scale, 1.4), "必须恢复伤害倍率")
	_expect(is_equal_approx(tuning.spin_scale, 0.8), "必须恢复衰减倍率")
	_expect(is_equal_approx(tuning.control_scale, 1.2), "必须恢复操控倍率")
	_expect(is_equal_approx(tuning.speed_scale, 1.1), "必须恢复速度倍率")

	var absolute_path := ProjectSettings.globalize_path(test_save_path)
	if FileAccess.file_exists(test_save_path):
		DirAccess.remove_absolute(absolute_path)
	source.free()
	restored.free()
	_finish()


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("PASS: game_state_persistence_test")
		get_tree().quit(0)
		return
	for failure in _failures:
		push_error(failure)
	get_tree().quit(1)
