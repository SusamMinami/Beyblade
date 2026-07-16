extends Node

const DEFAULT_ATTACK_RING := "六刃平衡攻击环"
const DEFAULT_CORE_LOCK := "标准核心锁扣"
const DEFAULT_WEIGHT_DISC := "标准金属配重盘"
const DEFAULT_DRIVER_SHAFT := "标准驱动中轴"
const DEFAULT_TIP := "橡胶平衡尖"
const DEFAULT_ATTACK_RING_ID := &"attack_ring_balanced_six_blade"
const DEFAULT_CORE_LOCK_ID := &"core_lock_standard"
const DEFAULT_WEIGHT_DISC_ID := &"weight_disc_standard"
const DEFAULT_DRIVER_SHAFT_ID := &"driver_shaft_standard"
const DEFAULT_TIP_ID := &"tip_rubber_balance"
const DEFAULT_MAP := "标准碗形竞技场"

var selected_attack_ring: String = DEFAULT_ATTACK_RING
var selected_core_lock: String = DEFAULT_CORE_LOCK
var selected_weight_disc: String = DEFAULT_WEIGHT_DISC
var selected_driver_shaft: String = DEFAULT_DRIVER_SHAFT
var selected_tip: String = DEFAULT_TIP
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

func set_build(
	attack_ring: String,
	core_lock: String,
	weight_disc: String,
	driver_shaft: String,
	tip: String
) -> void:
	var build := TopPartCatalog.create_build_from_names(
		attack_ring,
		core_lock,
		weight_disc,
		driver_shaft,
		tip
	)
	assert(build.is_complete(), "Cannot select an unknown or mismatched top part.")
	selected_attack_ring = attack_ring
	selected_core_lock = core_lock
	selected_weight_disc = weight_disc
	selected_driver_shaft = driver_shaft
	selected_tip = tip
	var part_ids := build.get_part_ids()
	selected_attack_ring_id = part_ids[0]
	selected_core_lock_id = part_ids[1]
	selected_weight_disc_id = part_ids[2]
	selected_driver_shaft_id = part_ids[3]
	selected_tip_id = part_ids[4]


func get_selected_build() -> TopBuildData:
	return TopPartCatalog.create_build_from_ids(
		selected_attack_ring_id,
		selected_core_lock_id,
		selected_weight_disc_id,
		selected_driver_shaft_id,
		selected_tip_id
	)


func get_battle_snapshot() -> TopBattleSnapshot:
	var build := get_selected_build()
	assert(build.is_complete(), "GameState contains an unknown or mismatched top part.")
	return AssemblyCalculator.calculate(build)


func set_map(map_name: String) -> void:
	selected_map = map_name


func set_custom_part(ring_color: Color, core_color: Color, style: String) -> void:
	custom_ring_color = ring_color
	custom_core_color = core_color
	custom_part_style = style


func add_reward(amount: int) -> void:
	coins += max(amount, 0)


func spend_coins(amount: int) -> bool:
	if amount <= 0:
		return true
	if coins < amount:
		return false
	coins -= amount
	return true


func get_build_summary() -> String:
	return "攻击环：%s\n核心锁扣：%s\n金属配重盘：%s\n驱动中轴：%s\n轴尖：%s\n样式：%s\n赏金：%d" % [
		selected_attack_ring,
		selected_core_lock,
		selected_weight_disc,
		selected_driver_shaft,
		selected_tip,
		custom_part_style,
		coins
	]


func get_battle_summary() -> String:
	return "攻击环：%s\n锁扣 / 配重：%s / %s\n中轴 / 轴尖：%s / %s\n地图：%s" % [
		selected_attack_ring,
		selected_core_lock,
		selected_weight_disc,
		selected_driver_shaft,
		selected_tip,
		selected_map
	]
