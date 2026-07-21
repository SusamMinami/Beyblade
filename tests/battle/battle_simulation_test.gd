extends SceneTree

const BATTLE_SIMULATION := preload(
	"res://scripts/battle/battle_simulation.gd"
)
const ARENA_MAP_CATALOG := preload(
	"res://scripts/maps/arena_map_catalog.gd"
)
const STANDARD_IDS := [
	&"attack_ring.balance_six",
	&"core_lock.standard",
	&"weight_disc.standard",
	&"driver_shaft.standard",
	&"tip.rubber_balance"
]
const SNAPSHOT_TOLERANCE := 0.0001

var _failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	_test_web_golden_snapshot()
	_test_collision_and_rim_response()
	_test_imbalance_and_launch_height()
	_test_low_spin_mobility()
	_test_battle_results()
	_test_composite_surface_sampling()
	_finish()


func _test_web_golden_snapshot() -> void:
	var battle = _create_battle(
		ARENA_MAP_CATALOG.get_by_name("标准碗形竞技场"),
		42
	)
	battle.launch(0.8, -0.1, 0.2)
	for frame in range(240):
		battle.step(
			1.0 / 60.0,
			Vector2(sin(float(frame) * 0.05), -0.3)
		)

	var snapshot: Dictionary = battle.snapshot()
	_expect(snapshot.phase == &"finished", "固定输入必须结束为已完成状态")
	_expect(snapshot.result.winner == &"enemy", "Web 金标快照必须由 AI 获胜")
	_expect(snapshot.result.reason == &"ring_out", "Web 金标快照必须为 Ring Out")
	_expect_close(snapshot.time, 1.233333, "金标结束时间")
	_expect_vector_close(
		snapshot.player.position,
		Vector2(6.230855, -3.707901),
		"金标玩家位置"
	)
	_expect_vector_close(
		snapshot.player.velocity,
		Vector2(6.8538, -6.614687),
		"金标玩家速度"
	)
	_expect_close(snapshot.player.spin, 43.674775, "金标玩家转速")
	_expect_close(snapshot.player.durability, 94.208807, "金标玩家耐久")
	_expect_close(snapshot.player.tilt, 0.415654, "金标玩家倾角")
	_expect_close(snapshot.player.imbalance, 0.194366, "金标玩家失衡")
	_expect_close(snapshot.player.spin_loss_rate, 4.41236, "金标玩家转速损耗")
	_expect_close(snapshot.player.ring_out_risk, 0.852019, "金标玩家撞飞风险")
	_expect(snapshot.player.stability_state == &"wobble", "金标玩家必须处于摇晃状态")
	_expect_close(snapshot.player.control_influence, 0.598964, "金标玩家操控")
	_expect_vector_close(
		snapshot.enemy.position,
		Vector2(-3.763804, 4.94961),
		"金标 AI 位置"
	)
	_expect_close(snapshot.enemy.spin, 54.029925, "金标 AI 转速")
	_expect_close(snapshot.enemy.imbalance, 0.143148, "金标 AI 失衡")


func _test_collision_and_rim_response() -> void:
	var arena := ARENA_MAP_CATALOG.get_by_name("标准碗形竞技场")
	var battle = _create_battle(arena)
	battle.launch(1.0, 0.0, 0.0)
	battle.player.position = Vector2(-0.45, 0.0)
	battle.enemy.position = Vector2(0.45, 0.0)
	battle.player.velocity = Vector2(7.0, 0.0)
	battle.enemy.velocity = Vector2(-7.0, 0.0)
	var durability_before: float = (
		battle.player.durability + battle.enemy.durability
	)
	battle.step(1.0 / 60.0, Vector2.ZERO)
	_expect(
		battle.player.durability + battle.enemy.durability < durability_before,
		"有效碰撞必须扣除双方耐久"
	)
	_expect(_has_event(battle.events, &"collision"), "有效碰撞必须记录事件")

	battle = _create_battle(arena)
	battle.launch(1.0, 0.0, 0.0)
	battle.player.position = Vector2(arena.wall_radius + 0.02, 0.0)
	battle.player.velocity = Vector2(6.0, 0.0)
	battle.step(1.0 / 60.0, Vector2.ZERO)
	_expect(
		battle.player.position.x < arena.wall_radius,
		"普通出射必须被护圈推回场内"
	)
	_expect(battle.player.velocity.x < 0.0, "护圈必须反弹向外速度")
	_expect(battle.result.is_empty(), "护圈反弹不能立即判定 Ring Out")


func _test_imbalance_and_launch_height() -> void:
	var arena := ARENA_MAP_CATALOG.get_by_name("标准碗形竞技场")
	var low_launch = _create_battle(arena, 21)
	var high_launch = _create_battle(arena, 21)
	low_launch.launch(0.86, 0.0, 0.25, 0.1)
	high_launch.launch(0.86, 0.0, 0.25, 0.9)
	_expect(
		high_launch.player.velocity.length() > low_launch.player.velocity.length(),
		"较高发射位置必须略微提高平移速度"
	)
	_expect(
		high_launch.player.tilt > low_launch.player.tilt,
		"较高发射位置必须带来更高初始倾斜"
	)

	var battle = _create_battle(arena, 17)
	battle.launch(1.0, 0.0, 0.0)
	battle.player.position = Vector2(-0.45, 0.0)
	battle.enemy.position = Vector2(0.45, 0.0)
	battle.player.velocity = Vector2(7.0, 0.0)
	battle.enemy.velocity = Vector2(-7.0, 0.0)
	battle.player.tilt = 0.12
	battle.enemy.tilt = 0.08
	battle.step(1.0 / 60.0, Vector2.ZERO)
	_expect(battle.player.imbalance > 0.0, "有效碰撞必须增加玩家失衡")
	_expect(battle.enemy.imbalance > 0.0, "有效碰撞必须增加 AI 失衡")
	_expect(not battle.collision_log.is_empty(), "有效碰撞必须记录诊断遥测")

	battle = _create_battle(arena)
	battle.launch(1.0, 0.0, 0.0)
	battle.player.position = Vector2.ZERO
	battle.player.velocity = Vector2(2.0, 0.0)
	battle.player.imbalance = 0.8
	battle.player.tilt = 0.55
	var initial_imbalance: float = battle.player.imbalance
	battle.integrate_top(
		battle.player,
		Vector2.RIGHT,
		1.0 / 60.0,
		false
	)
	var impaired_influence: float = battle.player.control_influence
	for _frame in range(240):
		battle._update_tilt(battle.player, 1.0 / 60.0)
	_expect(impaired_influence < 0.75, "失衡必须削弱控制影响")
	_expect(
		battle.player.imbalance < initial_imbalance * 0.25,
		"失衡必须随稳定性逐步恢复"
	)


func _test_low_spin_mobility() -> void:
	var arena := ARENA_MAP_CATALOG.get_by_name("标准碗形竞技场")
	var low_spin = _create_battle(arena)
	var high_spin = _create_battle(arena)
	low_spin.launch(1.0, 0.0, 0.0)
	high_spin.launch(1.0, 0.0, 0.0)
	for battle in [low_spin, high_spin]:
		battle.player.position = Vector2.ZERO
		battle.player.velocity = Vector2(6.0, 0.0)
	low_spin.player.spin = low_spin.player.build.max_spin_speed * 0.06
	high_spin.player.spin = high_spin.player.build.max_spin_speed

	for _frame in range(30):
		low_spin.integrate_top(
			low_spin.player,
			Vector2.RIGHT,
			1.0 / 60.0,
			false
		)
		high_spin.integrate_top(
			high_spin.player,
			Vector2.RIGHT,
			1.0 / 60.0,
			false
		)

	_expect(
		low_spin.player.velocity.length()
		< high_spin.player.velocity.length() * 0.4,
		"低转速必须显著削弱平移速度"
	)
	_expect(
		low_spin.player.control_influence
		< high_spin.player.control_influence * 0.25,
		"低转速必须显著削弱操控影响"
	)


func _test_battle_results() -> void:
	var battle = _create_battle(
		ARENA_MAP_CATALOG.get_by_name("标准碗形竞技场")
	)
	battle.launch(1.0, 0.0, 0.0)
	battle.enemy.spin = 0.0
	battle.step(1.0 / 60.0, Vector2.ZERO)
	_expect(battle.result.reason == &"spin_out", "必须判定 Spin Out")

	battle.reset()
	battle.launch(1.0, 0.0, 0.0)
	battle.enemy.position.x = battle.arena.ring_out_radius + 0.1
	battle.step(1.0 / 60.0, Vector2.ZERO)
	_expect(battle.result.reason == &"ring_out", "必须判定 Ring Out")

	battle.reset()
	battle.launch(1.0, 0.0, 0.0)
	battle.enemy.durability = 0.0
	battle.step(1.0 / 60.0, Vector2.ZERO)
	_expect(battle.result.reason == &"break", "必须判定 Break")


func _test_composite_surface_sampling() -> void:
	var arena := ARENA_MAP_CATALOG.get_by_name("复合材质竞技场")
	_expect(
		arena.get_surface_at_radius(0.0).surface_name == "低摩擦金属地面",
		"复合地图中央必须使用金属地面"
	)
	_expect(
		arena.get_surface_at_radius(4.0).surface_name == "高抓地橡胶",
		"复合地图中圈必须使用橡胶地面"
	)
	_expect(
		arena.get_surface_at_radius(6.2).surface_name == "边缘减速带",
		"复合地图边缘必须使用减速带"
	)


func _create_battle(
	arena: ArenaMapResource,
	seed: int = 20260718
):
	var build := AssemblyCalculator.calculate_by_ids(
		STANDARD_IDS[0],
		STANDARD_IDS[1],
		STANDARD_IDS[2],
		STANDARD_IDS[3],
		STANDARD_IDS[4]
	)
	return BATTLE_SIMULATION.new(build, build, arena, seed)


func _has_event(events: Array[Dictionary], event_type: StringName) -> bool:
	for event in events:
		if event.get("type", &"") == event_type:
			return true
	return false


func _expect_vector_close(
	actual: Vector2,
	expected: Vector2,
	label: String
) -> void:
	_expect_close(actual.x, expected.x, "%s.x" % label)
	_expect_close(actual.y, expected.y, "%s.y" % label)


func _expect_close(actual: float, expected: float, label: String) -> void:
	if absf(actual - expected) > SNAPSHOT_TOLERANCE:
		_failures.append(
			"%s 应为 %.6f，实际为 %.6f" % [label, expected, actual]
		)


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("PASS: battle_simulation_test")
		quit(0)
		return
	for failure in _failures:
		push_error(failure)
	quit(1)
