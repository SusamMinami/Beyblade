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
	source.set_active_loadout_index(1)
	source.set_active_loadout_build(
		&"attack_ring.stamina_arc",
		&"core_lock.low_center",
		&"weight_disc.heavy_outer",
		&"driver_shaft.low_stable",
		&"tip.metal_stamina"
	)
	source.set_active_loadout_customization(
		&"attack_ring.stamina_arc",
		{
			"shape": 72.0,
			"size": 1.18,
			"height": 1.22,
			"material": "alloy",
			"symmetry": 3
		}
	)
	_expect(
		source.purchase_part(&"attack_ring.stamina_arc"),
		"余额足够时必须能够购买未拥有零件"
	)
	_expect(
		source.purchase_material(&"polymer"),
		"余额足够时必须能够购买未拥有材料"
	)
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
		restored.selected_attack_ring_id == &"attack_ring.stamina_arc",
		"必须恢复当前槽位攻击环"
	)
	_expect(
		restored.selected_tip_id == &"tip.metal_stamina",
		"必须恢复当前槽位轴尖"
	)
	_expect(restored.selected_map == "复合材质竞技场", "必须恢复地图")
	_expect(restored.coins == 80, "必须恢复购买后的赏金余额")
	_expect(restored.custom_part_style == "突击型", "必须恢复样式")
	_expect(
		restored.loadouts[0].colors.ring.is_equal_approx(
			Color(0.12, 0.34, 0.56)
		),
		"必须在第一槽恢复旧攻击环颜色"
	)
	_expect(
		restored.loadouts[0].build.attack_ring_id
		== "attack_ring.smash_three",
		"必须在第一槽恢复旧攻击环配置"
	)
	_expect(not restored.sound_enabled, "必须恢复静音状态")
	var tuning: Dictionary = restored.get_battle_tuning()
	_expect(is_equal_approx(tuning.damage_scale, 1.4), "必须恢复伤害倍率")
	_expect(is_equal_approx(tuning.spin_scale, 0.8), "必须恢复衰减倍率")
	_expect(is_equal_approx(tuning.control_scale, 1.2), "必须恢复操控倍率")
	_expect(is_equal_approx(tuning.speed_scale, 1.1), "必须恢复速度倍率")
	_expect(restored.loadouts.size() == 3, "必须恢复三个出战槽")
	_expect(restored.active_loadout_index == 1, "必须恢复当前出战槽")
	_expect(
		restored.selected_attack_ring_id == &"attack_ring.stamina_arc",
		"旧版当前配置字段必须同步到当前槽位"
	)
	_expect(
		restored.owned_part_ids.has(&"attack_ring.stamina_arc"),
		"必须恢复零件所有权"
	)
	_expect(
		restored.owned_material_ids.has(&"polymer"),
		"必须恢复材料所有权"
	)
	var customization: Dictionary = restored.get_active_loadout_customizations().get(
		"attack_ring.stamina_arc",
		{}
	)
	_expect(
		is_equal_approx(float(customization.get("shape", 0.0)), 72.0),
		"必须恢复 DIY 轮廓参数"
	)
	_expect(customization.get("material", "") == "alloy", "必须恢复 DIY 材料")

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
