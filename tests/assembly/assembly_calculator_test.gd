extends SceneTree

const DEFAULT_IDS := [
	"attack_ring.balance_six",
	"core_lock.standard",
	"weight_disc.standard",
	"driver_shaft.standard",
	"tip.rubber_balance"
]

var _failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	_test_database()
	_test_derived_attributes()
	await _test_body_integration()
	_finish()


func _test_database() -> void:
	var validation_errors := PartDatabase.validate_database()
	_expect(validation_errors.is_empty(), "零件数据库校验必须通过：%s" % str(validation_errors))

	var all_parts := PartDatabase.get_all_parts()
	_expect(all_parts.size() == 15, "零件数据库必须包含 15 个正式资源")

	var unique_ids := {}
	for part in all_parts:
		_expect(not part.part_id.is_empty(), "每个零件必须具有稳定 part_id")
		_expect(not unique_ids.has(part.part_id), "part_id 必须唯一：%s" % part.part_id)
		unique_ids[part.part_id] = true

	for part_type in range(TopPartResource.PartType.size()):
		var typed_parts := PartDatabase.get_parts_by_type(part_type as TopPartResource.PartType)
		_expect(typed_parts.size() == 3, "每个 DIY 位置必须包含 3 个零件，类型：%d" % part_type)


func _test_derived_attributes() -> void:
	var standard := _calculate(DEFAULT_IDS)
	_expect(standard != null and standard.is_valid(), "标准配置必须成功生成派生属性")
	if standard == null:
		return

	_expect(standard.total_mass > 0.0, "总质量必须大于 0")
	_expect(standard.moment_of_inertia > 0.0, "转动惯量必须大于 0")
	_expect(standard.friction > 0.0, "摩擦必须大于 0")
	_expect(standard.restitution >= 0.0, "回弹不能为负数")
	_expect(standard.spin_decay_per_second > 0.0, "转速衰减必须大于 0")
	_expect(standard.stability > 0.0, "稳定性必须大于 0")
	_expect(standard.control_response > 0.0, "控制响应必须大于 0")
	_expect(standard.attack_power > 0.0, "攻击力必须大于 0")
	_expect(standard.durability > 0.0, "耐久必须大于 0")

	var heavy_ids := DEFAULT_IDS.duplicate()
	heavy_ids[2] = "weight_disc.heavy_outer"
	var heavy := _calculate(heavy_ids)
	_expect(heavy.total_mass > standard.total_mass, "重型配重盘必须提高总质量")
	_expect(heavy.moment_of_inertia > standard.moment_of_inertia, "重型配重盘必须提高转动惯量")
	_expect(heavy.collision_momentum > standard.collision_momentum * 1.08, "重型配重盘必须明显提高撞击动量")
	_expect(heavy.max_spin_speed < standard.max_spin_speed * 0.95, "重型配重盘必须明显降低启动转速")
	_expect(heavy.control_response < standard.control_response * 0.95, "重型配重盘必须明显降低控制响应")

	var metal_ids := DEFAULT_IDS.duplicate()
	metal_ids[4] = "tip.metal_stamina"
	var metal := _calculate(metal_ids)
	_expect(metal.spin_decay_per_second < standard.spin_decay_per_second, "金属尖必须降低转速衰减")
	_expect(metal.control_response < standard.control_response, "金属尖必须降低控制响应")

	var rubber := standard
	_expect(rubber.control_response > metal.control_response, "橡胶尖控制必须强于金属尖")
	_expect(rubber.spin_decay_per_second > metal.spin_decay_per_second, "橡胶尖转速衰减必须快于金属尖")

	var eccentric_ids := DEFAULT_IDS.duplicate()
	eccentric_ids[2] = "weight_disc.eccentric"
	var eccentric := _calculate(eccentric_ids)
	_expect(absf(eccentric.center_of_mass.x) > absf(standard.center_of_mass.x), "偏心配重必须产生横向重心偏移")
	_expect(eccentric.attack_power > standard.attack_power, "偏心配重必须提高攻击力")
	_expect(eccentric.stability < standard.stability, "偏心配重必须降低稳定性")


func _test_body_integration() -> void:
	var body_scene := load("res://scenes/battle/BeybladeBody.tscn") as PackedScene
	_expect(body_scene != null, "战斗陀螺场景必须可加载")
	if body_scene == null:
		return

	var body := body_scene.instantiate() as BeybladeBody
	root.add_child(body)
	await process_frame
	_expect(body.has_method("apply_build_data"), "BeybladeBody 必须提供 apply_build_data")
	if not body.has_method("apply_build_data"):
		body.free()
		await process_frame
		return

	var heavy_ids := DEFAULT_IDS.duplicate()
	heavy_ids[2] = "weight_disc.heavy_outer"
	var heavy := _calculate(heavy_ids)
	body.apply_build_data(heavy)

	_expect(is_equal_approx(body.mass, heavy.total_mass), "BeybladeBody 必须应用总质量")
	_expect(body.center_of_mass.is_equal_approx(heavy.center_of_mass), "BeybladeBody 必须应用重心")
	_expect(is_equal_approx(body.inertia.y, heavy.moment_of_inertia), "BeybladeBody 必须应用转动惯量")
	_expect(is_equal_approx(body.max_spin_speed, heavy.max_spin_speed), "BeybladeBody 必须应用启动转速")
	_expect(is_equal_approx(body.spin_decay_per_second, heavy.spin_decay_per_second), "BeybladeBody 必须应用转速衰减")
	_expect(is_equal_approx(body.launch_forward_impulse, heavy.launch_forward_impulse), "BeybladeBody 必须应用发射动量")
	_expect(is_equal_approx(body.control_force, heavy.control_force), "BeybladeBody 必须应用控制力")
	_expect(is_equal_approx(body.stability, heavy.stability), "BeybladeBody 必须应用稳定性")
	_expect(is_equal_approx(body.attack_power, heavy.attack_power), "BeybladeBody 必须应用攻击力")
	_expect(is_equal_approx(body.max_durability, heavy.durability), "BeybladeBody 必须应用耐久")
	_expect(body.physics_material_override != null, "BeybladeBody 必须应用物理材质")
	if body.physics_material_override != null:
		_expect(
			is_equal_approx(body.physics_material_override.friction, heavy.friction),
			"BeybladeBody 必须应用摩擦"
		)
		_expect(
			is_equal_approx(body.physics_material_override.bounce, heavy.restitution),
			"BeybladeBody 必须应用回弹"
		)

	body.free()
	await process_frame


func _calculate(ids: Array) -> TopBuildData:
	return AssemblyCalculator.calculate_by_ids(
		ids[0],
		ids[1],
		ids[2],
		ids[3],
		ids[4]
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
