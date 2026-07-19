extends Node

const DEFAULT_SAVE_PATH := "user://game_state.cfg"
const DEFAULT_ATTACK_RING_ID := &"attack_ring.balance_six"
const DEFAULT_CORE_LOCK_ID := &"core_lock.standard"
const DEFAULT_WEIGHT_DISC_ID := &"weight_disc.standard"
const DEFAULT_DRIVER_SHAFT_ID := &"driver_shaft.standard"
const DEFAULT_TIP_ID := &"tip.rubber_balance"
const DEFAULT_MAP := "标准碗形竞技场"
const VALID_MAPS := [
	"标准碗形竞技场",
	"金属高速竞技场",
	"复合材质竞技场"
]
const TUNING_LIMITS := {
	"damage_scale": Vector2(0.5, 1.8),
	"spin_scale": Vector2(0.6, 1.6),
	"control_scale": Vector2(0.5, 1.8),
	"speed_scale": Vector2(0.7, 1.4)
}

var save_path := DEFAULT_SAVE_PATH
var selected_attack_ring_id: StringName = DEFAULT_ATTACK_RING_ID
var selected_core_lock_id: StringName = DEFAULT_CORE_LOCK_ID
var selected_weight_disc_id: StringName = DEFAULT_WEIGHT_DISC_ID
var selected_driver_shaft_id: StringName = DEFAULT_DRIVER_SHAFT_ID
var selected_tip_id: StringName = DEFAULT_TIP_ID
var selected_map: String = DEFAULT_MAP
var coins: int = 0
var custom_ring_color: Color = Color(0.2, 0.75, 1.0, 1.0)
var custom_core_color: Color = Color(0.95, 0.78, 0.25, 1.0)
var custom_part_style: String = "平衡型"
var sound_enabled := true
var battle_tuning := {
	"damage_scale": 1.0,
	"spin_scale": 1.0,
	"control_scale": 1.0,
	"speed_scale": 1.0
}


func _ready() -> void:
	var error := load_state()
	if error != OK and error != ERR_FILE_NOT_FOUND:
		push_warning("读取游戏存档失败，错误码：%d" % error)


func set_build(
	attack_ring_id: StringName,
	core_lock_id: StringName,
	weight_disc_id: StringName,
	driver_shaft_id: StringName,
	tip_id: StringName
) -> void:
	var build_data := AssemblyCalculator.calculate_by_ids(
		attack_ring_id,
		core_lock_id,
		weight_disc_id,
		driver_shaft_id,
		tip_id
	)
	if not build_data.is_valid():
		push_error("尝试保存无效的五件式陀螺配置")
		return
	selected_attack_ring_id = build_data.attack_ring.part_id
	selected_core_lock_id = build_data.core_lock.part_id
	selected_weight_disc_id = build_data.weight_disc.part_id
	selected_driver_shaft_id = build_data.driver_shaft.part_id
	selected_tip_id = build_data.tip.part_id
	save_state()


func set_map(map_name: String) -> void:
	if map_name not in VALID_MAPS:
		push_warning("忽略未知竞技场：%s" % map_name)
		return
	selected_map = map_name
	save_state()


func set_custom_part(
	ring_color: Color,
	core_color: Color,
	style: String
) -> void:
	custom_ring_color = ring_color
	custom_core_color = core_color
	custom_part_style = style
	save_state()


func set_sound_enabled(enabled: bool) -> void:
	sound_enabled = enabled
	save_state()


func set_battle_tuning(key: String, value: float) -> void:
	var normalized_key := _normalize_tuning_key(key)
	if not TUNING_LIMITS.has(normalized_key):
		push_warning("忽略未知战斗调参项：%s" % key)
		return
	var limits: Vector2 = TUNING_LIMITS[normalized_key]
	battle_tuning[normalized_key] = clampf(value, limits.x, limits.y)
	save_state()


func get_battle_tuning() -> Dictionary:
	return battle_tuning.duplicate(true)


func reset_battle_tuning() -> void:
	for key in battle_tuning:
		battle_tuning[key] = 1.0
	save_state()


func add_reward(amount: int) -> void:
	coins += maxi(amount, 0)
	save_state()


func spend_coins(amount: int) -> bool:
	if amount <= 0:
		return true
	if coins < amount:
		return false
	coins -= amount
	save_state()
	return true


func save_state() -> Error:
	var config := ConfigFile.new()
	config.set_value(
		"build",
		"attack_ring_id",
		String(selected_attack_ring_id)
	)
	config.set_value("build", "core_lock_id", String(selected_core_lock_id))
	config.set_value(
		"build",
		"weight_disc_id",
		String(selected_weight_disc_id)
	)
	config.set_value(
		"build",
		"driver_shaft_id",
		String(selected_driver_shaft_id)
	)
	config.set_value("build", "tip_id", String(selected_tip_id))
	config.set_value("profile", "selected_map", selected_map)
	config.set_value("profile", "coins", coins)
	config.set_value("appearance", "ring_color", custom_ring_color)
	config.set_value("appearance", "core_color", custom_core_color)
	config.set_value("appearance", "part_style", custom_part_style)
	config.set_value("settings", "sound_enabled", sound_enabled)
	config.set_value("settings", "battle_tuning", battle_tuning)
	return config.save(save_path)


func load_state() -> Error:
	if not FileAccess.file_exists(save_path):
		return ERR_FILE_NOT_FOUND
	var config := ConfigFile.new()
	var error := config.load(save_path)
	if error != OK:
		return error

	var loaded_build := AssemblyCalculator.calculate_by_ids(
		StringName(config.get_value(
			"build",
			"attack_ring_id",
			String(DEFAULT_ATTACK_RING_ID)
		)),
		StringName(config.get_value(
			"build",
			"core_lock_id",
			String(DEFAULT_CORE_LOCK_ID)
		)),
		StringName(config.get_value(
			"build",
			"weight_disc_id",
			String(DEFAULT_WEIGHT_DISC_ID)
		)),
		StringName(config.get_value(
			"build",
			"driver_shaft_id",
			String(DEFAULT_DRIVER_SHAFT_ID)
		)),
		StringName(config.get_value(
			"build",
			"tip_id",
			String(DEFAULT_TIP_ID)
		))
	)
	if loaded_build.is_valid():
		selected_attack_ring_id = loaded_build.attack_ring.part_id
		selected_core_lock_id = loaded_build.core_lock.part_id
		selected_weight_disc_id = loaded_build.weight_disc.part_id
		selected_driver_shaft_id = loaded_build.driver_shaft.part_id
		selected_tip_id = loaded_build.tip.part_id

	var loaded_map := str(config.get_value(
		"profile",
		"selected_map",
		DEFAULT_MAP
	))
	selected_map = loaded_map if loaded_map in VALID_MAPS else DEFAULT_MAP
	coins = maxi(int(config.get_value("profile", "coins", 0)), 0)

	var ring_color = config.get_value(
		"appearance",
		"ring_color",
		custom_ring_color
	)
	if ring_color is Color:
		custom_ring_color = ring_color
	var core_color = config.get_value(
		"appearance",
		"core_color",
		custom_core_color
	)
	if core_color is Color:
		custom_core_color = core_color
	custom_part_style = str(config.get_value(
		"appearance",
		"part_style",
		custom_part_style
	))
	sound_enabled = bool(config.get_value(
		"settings",
		"sound_enabled",
		true
	))

	var loaded_tuning = config.get_value(
		"settings",
		"battle_tuning",
		{}
	)
	if loaded_tuning is Dictionary:
		for key in TUNING_LIMITS:
			if loaded_tuning.has(key):
				var limits: Vector2 = TUNING_LIMITS[key]
				battle_tuning[key] = clampf(
					float(loaded_tuning[key]),
					limits.x,
					limits.y
				)
	return OK


func get_build_summary() -> String:
	return "攻击环：%s\n核心锁扣：%s\n金属配重盘：%s\n驱动中轴：%s\n轴尖：%s\n样式：%s\n赏金：%d" % [
		_part_name(selected_attack_ring_id),
		_part_name(selected_core_lock_id),
		_part_name(selected_weight_disc_id),
		_part_name(selected_driver_shaft_id),
		_part_name(selected_tip_id),
		custom_part_style,
		coins
	]


func get_battle_summary() -> String:
	return "攻击环：%s\n锁扣 / 配重：%s / %s\n中轴 / 轴尖：%s / %s\n地图：%s" % [
		_part_name(selected_attack_ring_id),
		_part_name(selected_core_lock_id),
		_part_name(selected_weight_disc_id),
		_part_name(selected_driver_shaft_id),
		_part_name(selected_tip_id),
		selected_map
	]


func get_build_data() -> TopBuildData:
	return AssemblyCalculator.calculate_by_ids(
		selected_attack_ring_id,
		selected_core_lock_id,
		selected_weight_disc_id,
		selected_driver_shaft_id,
		selected_tip_id
	)


func _normalize_tuning_key(key: String) -> String:
	match key:
		"damageScale":
			return "damage_scale"
		"spinScale":
			return "spin_scale"
		"controlScale":
			return "control_scale"
		"speedScale":
			return "speed_scale"
		_:
			return key


func _part_name(part_id: StringName) -> String:
	var part := PartDatabase.get_part(part_id)
	return part.part_name if part != null else "未知零件"
