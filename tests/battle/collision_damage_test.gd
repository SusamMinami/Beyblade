extends SceneTree

const STANDARD_IDS := [
	&"attack_ring.balance_six",
	&"core_lock.standard",
	&"weight_disc.standard",
	&"driver_shaft.standard",
	&"tip.rubber_balance"
]
const ATTACK_IDS := [
	&"attack_ring.smash_three",
	&"core_lock.standard",
	&"weight_disc.eccentric",
	&"driver_shaft.high_attack",
	&"tip.flat_attack"
]

var _failures: Array[String] = []
var _depleted_signal_count := 0

func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	await _test_damage_formula_and_settlement()
	await _test_real_physics_collision()
	_finish()


func _test_damage_formula_and_settlement() -> void:
	var defender := await _create_body(_calculate(STANDARD_IDS))
	var standard_attacker := await _create_body(_calculate(STANDARD_IDS))
	var attack_attacker := await _create_body(_calculate(ATTACK_IDS))

	_expect(defender.has_method("calculate_collision_damage"), "BeybladeBody 必须提供碰撞伤害计算")
	_expect(defender.has_method("apply_collision_damage"), "BeybladeBody 必须提供碰撞伤害结算")
	_expect(defender.has_method("is_defeated"), "BeybladeBody 必须提供击破状态")
	if not defender.has_method("apply_collision_damage"):
		_free_bodies([defender, standard_attacker, attack_attacker])
		return

	var no_damage: float = defender.apply_collision_damage(standard_attacker, 0.01)
	_expect(is_zero_approx(no_damage), "低于阈值的轻微接触不能造成伤害")

	defender.reset_top()
	var standard_damage: float = defender.apply_collision_damage(standard_attacker, 2.0)
	defender.reset_top()
	var attack_damage: float = defender.apply_collision_damage(attack_attacker, 2.0)
	_expect(standard_damage > 0.0, "有效碰撞冲量必须造成伤害")
	_expect(attack_damage > standard_damage, "攻击力更高的配置必须造成更多伤害")

	defender.reset_top()
	var durability_before := defender.current_durability
	var settled_damage: float = defender.apply_collision_damage(attack_attacker, 2.0)
	_expect(
		is_equal_approx(defender.current_durability, durability_before - settled_damage),
		"伤害必须从当前耐久中扣除"
	)

	defender.durability_depleted.connect(_on_durability_depleted)
	defender.apply_collision_damage(attack_attacker, 100.0)
	_expect(defender.is_defeated(), "耐久归零后陀螺必须进入击破状态")
	_expect(is_zero_approx(defender.current_durability), "耐久不能低于 0")
	_expect(_depleted_signal_count == 1, "击破时必须且只能触发一次 durability_depleted")

	_free_bodies([defender, standard_attacker, attack_attacker])
	await process_frame


func _test_real_physics_collision() -> void:
	var left := await _create_body(_calculate(ATTACK_IDS))
	var right := await _create_body(_calculate(STANDARD_IDS))
	left.gravity_scale = 0.0
	right.gravity_scale = 0.0
	left.global_position = Vector3(-1.2, 0.5, 0.0)
	right.global_position = Vector3(1.2, 0.5, 0.0)
	left.linear_velocity = Vector3(7.0, 0.0, 0.0)
	right.linear_velocity = Vector3(-7.0, 0.0, 0.0)
	left.is_launched = true
	right.is_launched = true
	left.spin_speed = left.max_spin_speed
	right.spin_speed = right.max_spin_speed

	var left_start := left.current_durability
	var right_start := right.current_durability
	for _frame in range(90):
		await physics_frame
		if left.current_durability < left_start or right.current_durability < right_start:
			break

	_expect(
		left.current_durability < left_start or right.current_durability < right_start,
		"两个 BeybladeBody 的真实物理碰撞必须自动结算伤害"
	)
	_free_bodies([left, right])
	await process_frame


func _create_body(data: TopBuildData) -> BeybladeBody:
	var body_scene := load("res://scenes/battle/BeybladeBody.tscn") as PackedScene
	var body := body_scene.instantiate() as BeybladeBody
	root.add_child(body)
	await process_frame
	body.apply_build_data(data)
	body.reset_top()
	return body


func _calculate(ids: Array) -> TopBuildData:
	return AssemblyCalculator.calculate_by_ids(ids[0], ids[1], ids[2], ids[3], ids[4])


func _free_bodies(bodies: Array) -> void:
	for body in bodies:
		if is_instance_valid(body):
			body.free()


func _on_durability_depleted(_body: BeybladeBody) -> void:
	_depleted_signal_count += 1


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("PASS: collision_damage_test")
		quit(0)
		return
	for failure in _failures:
		push_error(failure)
	quit(1)
