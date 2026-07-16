extends SceneTree

const BODY_SCENE_PATH := "res://scenes/battle/BeybladeBody.tscn"
const EXPECTED_PARTS_PER_SLOT := 3
const EXPECTED_TOTAL_PARTS := 15

var _failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	_test_catalog()
	_test_default_snapshot()
	_test_physical_tradeoffs()
	_test_all_combinations()
	_test_game_state_ids()
	await _test_beyblade_body_application()
	_finish()


func _test_catalog() -> void:
	var parts := TopPartCatalog.get_all_parts()
	_expect(parts.size() == EXPECTED_TOTAL_PARTS, "零件目录必须包含 15 个零件")

	var ids: Dictionary = {}
	var names: Dictionary = {}
	var slot_counts := [0, 0, 0, 0, 0]
	for part in parts:
		_expect(part != null, "目录中的零件资源必须可加载")
		if part == null:
			continue
		_expect(not part.part_id.is_empty(), "%s 必须有唯一 ID" % part.resource_path)
		_expect(not ids.has(part.part_id), "零件 ID 重复：%s" % part.part_id)
		_expect(not names.has(part.part_name), "零件名称重复：%s" % part.part_name)
		ids[part.part_id] = true
		names[part.part_name] = true
		_expect(part.mass > 0.0, "%s 的质量必须为正" % part.part_name)
		_expect(part.moment_of_inertia > 0.0, "%s 的轴向惯量必须为正" % part.part_name)
		_expect(
			part.transverse_moment_of_inertia > 0.0,
			"%s 的横向惯量必须为正" % part.part_name
		)
		slot_counts[part.part_type] += 1

	for slot_count in slot_counts:
		_expect(
			slot_count == EXPECTED_PARTS_PER_SLOT,
			"每个槽位必须正好包含 3 个零件"
		)


func _test_default_snapshot() -> void:
	var build := _build(
		"六刃平衡攻击环",
		"标准核心锁扣",
		"标准金属配重盘",
		"标准驱动中轴",
		"橡胶平衡尖"
	)
	_expect(build.is_complete(), "默认五件式配置必须完整")

	var snapshot := AssemblyCalculator.calculate(build)
	_expect(snapshot.is_valid(), "默认配置必须生成有效战斗快照")
	_expect(is_equal_approx(snapshot.total_mass_kg, 0.0416), "默认总质量应为 41.6 g")
	_expect(snapshot.part_ids.size() == 5, "战斗快照必须保留五个零件 ID")
	_expect(snapshot.center_of_mass_m.y > 0.0, "默认质心应略高于模型原点")
	_expect(snapshot.inertia_kg_m2.y > snapshot.inertia_kg_m2.x, "轴向惯量应大于横向惯量")
	_expect(is_equal_approx(snapshot.friction, build.tip.friction), "地面摩擦必须来自轴尖")
	_expect(
		is_equal_approx(snapshot.restitution, build.attack_ring.restitution),
		"碰撞回弹必须来自攻击环"
	)


func _test_physical_tradeoffs() -> void:
	var default_snapshot := AssemblyCalculator.calculate(_build(
		"六刃平衡攻击环",
		"标准核心锁扣",
		"标准金属配重盘",
		"标准驱动中轴",
		"橡胶平衡尖"
	))
	var heavy_snapshot := AssemblyCalculator.calculate(_build(
		"圆弧续航攻击环",
		"强化核心锁扣",
		"重型外缘配重盘",
		"低位稳定中轴",
		"金属续航尖"
	))
	var eccentric_snapshot := AssemblyCalculator.calculate(_build(
		"三翼重击攻击环",
		"标准核心锁扣",
		"偏心突击配重盘",
		"高位突击中轴",
		"攻击扁平尖"
	))

	_expect(heavy_snapshot.total_mass_kg > default_snapshot.total_mass_kg, "重型配置必须更重")
	_expect(
		heavy_snapshot.inertia_kg_m2.y > default_snapshot.inertia_kg_m2.y,
		"外缘配重必须提高轴向惯量"
	)
	_expect(
		heavy_snapshot.center_of_mass_m.y < default_snapshot.center_of_mass_m.y,
		"低位中轴配置必须降低质心"
	)
	_expect(absf(eccentric_snapshot.center_of_mass_m.x) > 0.0005, "偏心盘必须产生横向质心偏移")
	_expect(
		eccentric_snapshot.contact_area_m2 > heavy_snapshot.contact_area_m2,
		"扁平尖接触面积必须大于金属尖"
	)
	_expect(eccentric_snapshot.friction > heavy_snapshot.friction, "扁平尖摩擦必须大于金属尖")


func _test_all_combinations() -> void:
	var parts_by_slot: Array[Array] = [[], [], [], [], []]
	for part in TopPartCatalog.get_all_parts():
		parts_by_slot[part.part_type].append(part)

	var combination_count := 0
	for attack_ring in parts_by_slot[TopPartResource.PartType.ATTACK_RING]:
		for core_lock in parts_by_slot[TopPartResource.PartType.CORE_LOCK]:
			for weight_disc in parts_by_slot[TopPartResource.PartType.WEIGHT_DISC]:
				for driver_shaft in parts_by_slot[TopPartResource.PartType.DRIVER_SHAFT]:
					for tip in parts_by_slot[TopPartResource.PartType.TIP]:
						var build := TopBuildData.new()
						build.attack_ring = attack_ring
						build.core_lock = core_lock
						build.weight_disc = weight_disc
						build.driver_shaft = driver_shaft
						build.tip = tip
						var snapshot := AssemblyCalculator.calculate(build)
						combination_count += 1
						_expect(snapshot.is_valid(), "所有 243 种组合都必须生成有效快照")
						_expect(
							snapshot.total_mass_kg >= 0.035
							and snapshot.total_mass_kg <= 0.055,
							"组合总质量必须保持在可信范围"
						)
						_expect(
							snapshot.center_of_mass_m.length() < 0.01,
							"组合质心偏移必须保持在碰撞体内部"
						)
	_expect(combination_count == 243, "五槽位各三零件必须生成 243 种组合")


func _test_game_state_ids() -> void:
	var game_state = root.get_node_or_null("GameState")
	_expect(game_state != null, "测试运行时必须加载 GameState")
	if game_state == null:
		return
	game_state.set_build(
		"圆弧续航攻击环",
		"强化核心锁扣",
		"重型外缘配重盘",
		"低位稳定中轴",
		"金属续航尖"
	)
	var build: TopBuildData = game_state.get_selected_build()
	_expect(build.is_complete(), "GameState 必须通过 ID 恢复完整组合")
	_expect(
		build.attack_ring.part_id == &"attack_ring_round_stamina",
		"显示名选择必须同步为稳定零件 ID"
	)
	game_state.set_build(
		"六刃平衡攻击环",
		"标准核心锁扣",
		"标准金属配重盘",
		"标准驱动中轴",
		"橡胶平衡尖"
	)


func _test_beyblade_body_application() -> void:
	var body_scene := load(BODY_SCENE_PATH) as PackedScene
	_expect(body_scene != null, "BeybladeBody 场景必须存在")
	if body_scene == null:
		return

	var body := body_scene.instantiate() as BeybladeBody
	root.add_child(body)
	await process_frame

	_expect(body.battle_snapshot != null, "刚体必须读取当前组合快照")
	if body.battle_snapshot != null:
		_expect(is_equal_approx(body.mass, 1.4), "默认真实质量应映射到 1.4 的模拟质量")
		_expect(body.inertia.y > body.inertia.x, "刚体必须应用三轴组合惯量")
		_expect(
			is_equal_approx(
				body.physics_material_override.friction,
				body.battle_snapshot.friction
			),
			"刚体必须应用轴尖摩擦"
		)

	body.is_launched = true
	body.angular_velocity = Vector3(2.5, 20.0, -1.5)
	var vertical_before := body.angular_velocity.y
	body._physics_process(0.1)
	_expect(is_equal_approx(body.angular_velocity.x, 2.5), "自旋更新不得覆盖 X 角速度")
	_expect(is_equal_approx(body.angular_velocity.z, -1.5), "自旋更新不得覆盖 Z 角速度")
	_expect(body.angular_velocity.y < vertical_before, "自旋更新必须衰减 Y 角速度")
	body.free()


func _build(
	attack_ring_name: String,
	core_lock_name: String,
	weight_disc_name: String,
	driver_shaft_name: String,
	tip_name: String
) -> TopBuildData:
	return TopPartCatalog.create_build_from_names(
		attack_ring_name,
		core_lock_name,
		weight_disc_name,
		driver_shaft_name,
		tip_name
	)


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("PASS: assembly_calculator_test")
		quit(0)
		return
	for failure in _failures:
		push_error(failure)
	quit(1)
