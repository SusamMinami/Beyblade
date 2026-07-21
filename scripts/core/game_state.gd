extends Node

const PART_CUSTOMIZATION := preload(
	"res://scripts/assembly/part_customization.gd"
)
const DEFAULT_SAVE_PATH := "user://game_state.cfg"
const STORAGE_VERSION := 2
const LOADOUT_COUNT := 3
const DEFAULT_ATTACK_RING_ID := &"attack_ring.balance_six"
const DEFAULT_CORE_LOCK_ID := &"core_lock.standard"
const DEFAULT_WEIGHT_DISC_ID := &"weight_disc.standard"
const DEFAULT_DRIVER_SHAFT_ID := &"driver_shaft.standard"
const DEFAULT_TIP_ID := &"tip.rubber_balance"
const DEFAULT_MAP := "标准碗形竞技场"
const DEFAULT_COLORS := [
	{
		"ring": Color("#27c9b3"),
		"core": Color("#efbd3c")
	},
	{
		"ring": Color("#f45b2a"),
		"core": Color("#2d78da")
	},
	{
		"ring": Color("#7567d9"),
		"core": Color("#e8d5a1")
	}
]
const LOADOUT_NAMES := ["主力", "突击", "续航"]
const BUILD_KEYS := [
	"attack_ring_id",
	"core_lock_id",
	"weight_disc_id",
	"driver_shaft_id",
	"tip_id"
]
const DEFAULT_BUILD := {
	"attack_ring_id": "attack_ring.balance_six",
	"core_lock_id": "core_lock.standard",
	"weight_disc_id": "weight_disc.standard",
	"driver_shaft_id": "driver_shaft.standard",
	"tip_id": "tip.rubber_balance"
}
const PART_PRICES := {
	"attack_ring.balance_six": 0,
	"attack_ring.stamina_arc": 120,
	"attack_ring.smash_three": 260,
	"core_lock.standard": 0,
	"core_lock.low_center": 140,
	"core_lock.reinforced": 240,
	"weight_disc.standard": 0,
	"weight_disc.eccentric": 300,
	"weight_disc.heavy_outer": 360,
	"driver_shaft.standard": 0,
	"driver_shaft.low_stable": 160,
	"driver_shaft.high_attack": 220,
	"tip.rubber_balance": 0,
	"tip.flat_attack": 180,
	"tip.metal_stamina": 280
}
const INITIAL_OWNED_PART_IDS := [
	"attack_ring.balance_six",
	"core_lock.standard",
	"weight_disc.standard",
	"driver_shaft.standard",
	"tip.rubber_balance"
]
const INITIAL_OWNED_MATERIAL_IDS := ["stock"]
const TUTORIAL_FIRST_BATTLE := "first_battle"
const TUTORIAL_BUY_FIRST_PART := "buy_first_part"
const TUTORIAL_SECOND_BATTLE := "second_battle"
const TUTORIAL_COMPLETE := "complete"
const VALID_TUTORIAL_STAGES := [
	TUTORIAL_FIRST_BATTLE,
	TUTORIAL_BUY_FIRST_PART,
	TUTORIAL_SECOND_BATTLE,
	TUTORIAL_COMPLETE
]
const FIRST_BATTLE_REWARD := 180
const WIN_REWARD := 120
const LOSS_REWARD := 40
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
var custom_ring_color: Color = DEFAULT_COLORS[0].ring
var custom_core_color: Color = DEFAULT_COLORS[0].core
var custom_part_style: String = "平衡型"
var sound_enabled := true
var battle_tuning := {
	"damage_scale": 1.0,
	"spin_scale": 1.0,
	"control_scale": 1.0,
	"speed_scale": 1.0
}
var loadouts: Array[Dictionary] = []
var active_loadout_index := 0
var owned_part_ids: Array[StringName] = []
var owned_material_ids: Array[String] = []
var customizing_part_id: StringName = &""
var tutorial := {
	"stage": TUTORIAL_FIRST_BATTLE,
	"completed": false,
	"first_reward_claimed": false
}


func _init() -> void:
	_reset_progression()


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
	set_active_loadout_build(
		attack_ring_id,
		core_lock_id,
		weight_disc_id,
		driver_shaft_id,
		tip_id
	)


func set_active_loadout_build(
	attack_ring_id: StringName,
	core_lock_id: StringName,
	weight_disc_id: StringName,
	driver_shaft_id: StringName,
	tip_id: StringName
) -> void:
	_ensure_loadouts()
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
	var loadout := loadouts[active_loadout_index]
	loadout.build = {
		"attack_ring_id": String(build_data.attack_ring.part_id),
		"core_lock_id": String(build_data.core_lock.part_id),
		"weight_disc_id": String(build_data.weight_disc.part_id),
		"driver_shaft_id": String(build_data.driver_shaft.part_id),
		"tip_id": String(build_data.tip.part_id)
	}
	loadouts[active_loadout_index] = loadout
	_sync_legacy_fields()
	save_state()


func set_active_loadout_index(index: int) -> void:
	_ensure_loadouts()
	active_loadout_index = clampi(index, 0, loadouts.size() - 1)
	_sync_legacy_fields()
	save_state()


func get_active_loadout() -> Dictionary:
	_ensure_loadouts()
	return loadouts[active_loadout_index].duplicate(true)


func set_active_loadout_customization(
	part_id: StringName,
	value: Dictionary
) -> void:
	_ensure_loadouts()
	if PartDatabase.get_part(part_id) == null:
		push_warning("忽略未知 DIY 零件：%s" % part_id)
		return
	var loadout := loadouts[active_loadout_index]
	var customizations: Dictionary = loadout.customizations.duplicate(true)
	customizations[String(part_id)] = PART_CUSTOMIZATION.normalize(value)
	loadout.customizations = customizations
	loadouts[active_loadout_index] = loadout
	save_state()


func get_active_loadout_customizations() -> Dictionary:
	_ensure_loadouts()
	return loadouts[active_loadout_index].customizations.duplicate(true)


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
	_ensure_loadouts()
	custom_ring_color = ring_color
	custom_core_color = core_color
	custom_part_style = style
	var loadout := loadouts[active_loadout_index]
	loadout.colors = {
		"ring": ring_color,
		"core": core_color
	}
	loadouts[active_loadout_index] = loadout
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


func owns_part(part_id: StringName) -> bool:
	return part_id in owned_part_ids


func owns_material(material_id: String) -> bool:
	return material_id in owned_material_ids


func get_part_price(part_id: StringName) -> int:
	return int(PART_PRICES.get(String(part_id), 0))


func purchase_part(part_id: StringName) -> bool:
	if PartDatabase.get_part(part_id) == null or owns_part(part_id):
		return false
	var price := get_part_price(part_id)
	if coins < price:
		return false
	coins -= price
	owned_part_ids.append(part_id)
	if tutorial.stage == TUTORIAL_BUY_FIRST_PART:
		tutorial.stage = TUTORIAL_SECOND_BATTLE
	save_state()
	return true


func purchase_material(material_id: String) -> bool:
	if owns_material(material_id):
		return false
	var material := PART_CUSTOMIZATION.get_material(material_id)
	if material.id != material_id:
		return false
	var price := int(material.price)
	if coins < price:
		return false
	coins -= price
	owned_material_ids.append(material_id)
	save_state()
	return true


func get_battle_reward(won: bool) -> int:
	if (
		tutorial.stage == TUTORIAL_FIRST_BATTLE
		and not bool(tutorial.first_reward_claimed)
	):
		return FIRST_BATTLE_REWARD
	return WIN_REWARD if won else LOSS_REWARD


func apply_battle_result(won: bool) -> int:
	var reward := get_battle_reward(won)
	coins += reward
	if tutorial.stage == TUTORIAL_FIRST_BATTLE:
		tutorial.first_reward_claimed = true
		tutorial.stage = TUTORIAL_BUY_FIRST_PART
	elif tutorial.stage == TUTORIAL_SECOND_BATTLE:
		tutorial.stage = TUTORIAL_COMPLETE
		tutorial.completed = true
	save_state()
	return reward


func skip_tutorial() -> void:
	tutorial.stage = TUTORIAL_COMPLETE
	tutorial.completed = true
	save_state()


func save_state() -> Error:
	_ensure_loadouts()
	_sync_legacy_fields()
	var config := ConfigFile.new()
	config.set_value("meta", "version", STORAGE_VERSION)
	config.set_value("build", "attack_ring_id", String(selected_attack_ring_id))
	config.set_value("build", "core_lock_id", String(selected_core_lock_id))
	config.set_value("build", "weight_disc_id", String(selected_weight_disc_id))
	config.set_value("build", "driver_shaft_id", String(selected_driver_shaft_id))
	config.set_value("build", "tip_id", String(selected_tip_id))
	config.set_value("profile", "selected_map", selected_map)
	config.set_value("profile", "coins", coins)
	config.set_value("appearance", "ring_color", custom_ring_color)
	config.set_value("appearance", "core_color", custom_core_color)
	config.set_value("appearance", "part_style", custom_part_style)
	config.set_value("settings", "sound_enabled", sound_enabled)
	config.set_value("settings", "battle_tuning", battle_tuning)
	config.set_value("progression", "loadouts", loadouts)
	config.set_value("progression", "active_loadout_index", active_loadout_index)
	config.set_value(
		"progression",
		"owned_part_ids",
		_to_string_array(owned_part_ids)
	)
	config.set_value(
		"progression",
		"owned_material_ids",
		owned_material_ids
	)
	config.set_value("progression", "tutorial", tutorial)
	return config.save(save_path)


func load_state() -> Error:
	if not FileAccess.file_exists(save_path):
		return ERR_FILE_NOT_FOUND
	var config := ConfigFile.new()
	var error := config.load(save_path)
	if error != OK:
		return error

	var legacy_build := _load_legacy_build(config)
	var legacy_colors := {
		"ring": _load_color(
			config.get_value("appearance", "ring_color", DEFAULT_COLORS[0].ring),
			DEFAULT_COLORS[0].ring
		),
		"core": _load_color(
			config.get_value("appearance", "core_color", DEFAULT_COLORS[0].core),
			DEFAULT_COLORS[0].core
		)
	}
	var saved_loadouts = config.get_value("progression", "loadouts", [])
	loadouts = _normalize_loadouts(saved_loadouts, legacy_build, legacy_colors)
	active_loadout_index = clampi(
		int(config.get_value("progression", "active_loadout_index", 0)),
		0,
		loadouts.size() - 1
	)
	selected_map = str(config.get_value(
		"profile",
		"selected_map",
		DEFAULT_MAP
	))
	if selected_map not in VALID_MAPS:
		selected_map = DEFAULT_MAP
	coins = maxi(int(config.get_value("profile", "coins", 0)), 0)
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
	_load_tuning(config.get_value("settings", "battle_tuning", {}))
	_load_progression(config)
	_sync_legacy_fields()
	return OK


func get_build_summary() -> String:
	return "出战槽：%s\n攻击环：%s\n核心锁扣：%s\n金属配重盘：%s\n驱动中轴：%s\n轴尖：%s\n赏金：%d" % [
		loadouts[active_loadout_index].name,
		_part_name(selected_attack_ring_id),
		_part_name(selected_core_lock_id),
		_part_name(selected_weight_disc_id),
		_part_name(selected_driver_shaft_id),
		_part_name(selected_tip_id),
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
		selected_tip_id,
		get_active_loadout_customizations()
	)


func _reset_progression() -> void:
	loadouts = _create_default_loadouts(DEFAULT_BUILD, DEFAULT_COLORS[0])
	active_loadout_index = 0
	owned_part_ids.clear()
	for part_id in INITIAL_OWNED_PART_IDS:
		owned_part_ids.append(StringName(part_id))
	owned_material_ids.assign(INITIAL_OWNED_MATERIAL_IDS)
	tutorial = {
		"stage": TUTORIAL_FIRST_BATTLE,
		"completed": false,
		"first_reward_claimed": false
	}
	_sync_legacy_fields()


func _ensure_loadouts() -> void:
	if loadouts.size() != LOADOUT_COUNT:
		loadouts = _create_default_loadouts(DEFAULT_BUILD, DEFAULT_COLORS[0])
		active_loadout_index = 0
	_sync_legacy_fields()


func _create_default_loadouts(
	first_build: Dictionary,
	first_colors: Dictionary
) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for index in range(LOADOUT_COUNT):
		result.append({
			"id": "loadout-%d" % (index + 1),
			"name": LOADOUT_NAMES[index],
			"build": _normalize_build(
				first_build if index == 0 else DEFAULT_BUILD
			),
			"colors": _normalize_colors(
				first_colors if index == 0 else DEFAULT_COLORS[index],
				DEFAULT_COLORS[index]
			),
			"customizations": {}
		})
	return result


func _normalize_loadouts(
	saved_value,
	legacy_build: Dictionary,
	legacy_colors: Dictionary
) -> Array[Dictionary]:
	var result := _create_default_loadouts(legacy_build, legacy_colors)
	if not saved_value is Array:
		return result
	for index in range(mini(saved_value.size(), LOADOUT_COUNT)):
		var saved_loadout = saved_value[index]
		if not saved_loadout is Dictionary:
			continue
		var fallback := result[index]
		var saved_build = saved_loadout.get("build", fallback.build)
		if not saved_build is Dictionary:
			saved_build = fallback.build
		var saved_colors = saved_loadout.get("colors", fallback.colors)
		if not saved_colors is Dictionary:
			saved_colors = fallback.colors
		var saved_customizations = saved_loadout.get("customizations", {})
		if not saved_customizations is Dictionary:
			saved_customizations = {}
		result[index] = {
			"id": "loadout-%d" % (index + 1),
			"name": str(saved_loadout.get("name", fallback.name)),
			"build": _normalize_build(saved_build),
			"colors": _normalize_colors(
				saved_colors,
				fallback.colors
			),
			"customizations": PART_CUSTOMIZATION.normalize_map(
				saved_customizations
			)
		}
	return result


func _normalize_build(value: Dictionary) -> Dictionary:
	var result := DEFAULT_BUILD.duplicate(true)
	for part_index in range(BUILD_KEYS.size()):
		var key: String = BUILD_KEYS[part_index]
		var part_id := StringName(value.get(key, result[key]))
		var part := PartDatabase.get_part(part_id)
		if part != null and part.part_type == part_index:
			result[key] = String(part_id)
	return result


func _normalize_colors(value: Dictionary, fallback: Dictionary) -> Dictionary:
	return {
		"ring": _load_color(value.get("ring", fallback.ring), fallback.ring),
		"core": _load_color(value.get("core", fallback.core), fallback.core)
	}


func _load_color(value, fallback: Color) -> Color:
	return value if value is Color else fallback


func _load_legacy_build(config: ConfigFile) -> Dictionary:
	return _normalize_build({
		"attack_ring_id": config.get_value(
			"build",
			"attack_ring_id",
			String(DEFAULT_ATTACK_RING_ID)
		),
		"core_lock_id": config.get_value(
			"build",
			"core_lock_id",
			String(DEFAULT_CORE_LOCK_ID)
		),
		"weight_disc_id": config.get_value(
			"build",
			"weight_disc_id",
			String(DEFAULT_WEIGHT_DISC_ID)
		),
		"driver_shaft_id": config.get_value(
			"build",
			"driver_shaft_id",
			String(DEFAULT_DRIVER_SHAFT_ID)
		),
		"tip_id": config.get_value(
			"build",
			"tip_id",
			String(DEFAULT_TIP_ID)
		)
	})


func _load_tuning(value) -> void:
	if not value is Dictionary:
		return
	for key in TUNING_LIMITS:
		if value.has(key):
			var limits: Vector2 = TUNING_LIMITS[key]
			battle_tuning[key] = clampf(
				float(value[key]),
				limits.x,
				limits.y
			)


func _load_progression(config: ConfigFile) -> void:
	owned_part_ids.clear()
	for part_id in INITIAL_OWNED_PART_IDS:
		owned_part_ids.append(StringName(part_id))
	var saved_parts = config.get_value("progression", "owned_part_ids", [])
	if saved_parts is Array:
		for part_id in saved_parts:
			_add_owned_part(StringName(part_id))
	for loadout in loadouts:
		for part_id in loadout.build.values():
			_add_owned_part(StringName(part_id))

	owned_material_ids.assign(INITIAL_OWNED_MATERIAL_IDS)
	var saved_materials = config.get_value(
		"progression",
		"owned_material_ids",
		[]
	)
	if saved_materials is Array:
		for material_id in saved_materials:
			_add_owned_material(str(material_id))
	for loadout in loadouts:
		for customization in loadout.customizations.values():
			_add_owned_material(str(customization.get("material", "stock")))

	var saved_tutorial = config.get_value("progression", "tutorial", {})
	if saved_tutorial is Dictionary:
		var stage := str(saved_tutorial.get("stage", TUTORIAL_FIRST_BATTLE))
		tutorial.stage = (
			stage if stage in VALID_TUTORIAL_STAGES else TUTORIAL_FIRST_BATTLE
		)
		tutorial.completed = bool(saved_tutorial.get("completed", false))
		tutorial.first_reward_claimed = bool(saved_tutorial.get(
			"first_reward_claimed",
			false
		))
	if tutorial.completed:
		tutorial.stage = TUTORIAL_COMPLETE


func _add_owned_part(part_id: StringName) -> void:
	if PartDatabase.get_part(part_id) != null and part_id not in owned_part_ids:
		owned_part_ids.append(part_id)


func _add_owned_material(material_id: String) -> void:
	var material := PART_CUSTOMIZATION.get_material(material_id)
	if material.id == material_id and material_id not in owned_material_ids:
		owned_material_ids.append(material_id)


func _sync_legacy_fields() -> void:
	if loadouts.is_empty():
		return
	active_loadout_index = clampi(active_loadout_index, 0, loadouts.size() - 1)
	var loadout := loadouts[active_loadout_index]
	var build: Dictionary = loadout.build
	selected_attack_ring_id = StringName(build.attack_ring_id)
	selected_core_lock_id = StringName(build.core_lock_id)
	selected_weight_disc_id = StringName(build.weight_disc_id)
	selected_driver_shaft_id = StringName(build.driver_shaft_id)
	selected_tip_id = StringName(build.tip_id)
	custom_ring_color = loadout.colors.ring
	custom_core_color = loadout.colors.core


func _to_string_array(values: Array[StringName]) -> Array[String]:
	var result: Array[String] = []
	for value in values:
		result.append(String(value))
	return result


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
