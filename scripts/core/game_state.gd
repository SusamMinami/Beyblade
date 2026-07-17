extends Node

const DEFAULT_ATTACK_RING_ID := &"attack_ring.balance_six"
const DEFAULT_CORE_LOCK_ID := &"core_lock.standard"
const DEFAULT_WEIGHT_DISC_ID := &"weight_disc.standard"
const DEFAULT_DRIVER_SHAFT_ID := &"driver_shaft.standard"
const DEFAULT_TIP_ID := &"tip.rubber_balance"
const DEFAULT_MAP := "标准碗形竞技场"

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


func _part_name(part_id: StringName) -> String:
	var part := PartDatabase.get_part(part_id)
	return part.part_name if part != null else "未知零件"
