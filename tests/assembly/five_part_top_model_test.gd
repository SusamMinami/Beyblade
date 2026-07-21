extends SceneTree

const MODEL_SCENE_PATH := "res://scenes/assembly/FivePartTopModel.tscn"
const ASSEMBLY_SCENE_PATH := "res://scenes/assembly/AssemblyScreen.tscn"
const CUSTOMIZE_SCENE_PATH := "res://scenes/assembly/PartCustomizeScreen.tscn"
const PART_VARIANTS := [
	[&"attack_ring.balance_six", &"attack_ring.smash_three", &"attack_ring.stamina_arc"],
	[&"core_lock.standard", &"core_lock.low_center", &"core_lock.reinforced"],
	[&"weight_disc.standard", &"weight_disc.heavy_outer", &"weight_disc.eccentric"],
	[&"driver_shaft.standard", &"driver_shaft.low_stable", &"driver_shaft.high_attack"],
	[&"tip.rubber_balance", &"tip.metal_stamina", &"tip.flat_attack"]
]

var _failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var model_scene := load(MODEL_SCENE_PATH) as PackedScene
	_expect(model_scene != null, "五件式模型场景必须存在")
	if model_scene == null:
		_finish()
		return

	var model := model_scene.instantiate()
	root.add_child(model)
	await process_frame

	_expect(model.get_customizable_part_count() == 5, "模型必须暴露五个 DIY 位置")
	var part_nodes: Array[Node3D] = model.get_part_nodes()
	_expect(part_nodes.size() == 5, "模型必须返回五个独立部件节点")
	for part_node in part_nodes:
		_expect(part_node != null, "每个 DIY 位置都必须对应有效节点")

	for part_index in range(PART_VARIANTS.size()):
		for variant_name in PART_VARIANTS[part_index]:
			var selections := [
				PART_VARIANTS[0][0],
				PART_VARIANTS[1][0],
				PART_VARIANTS[2][0],
				PART_VARIANTS[3][0],
				PART_VARIANTS[4][0]
			]
			selections[part_index] = variant_name
			model.configure(
				selections[0],
				selections[1],
				selections[2],
				selections[3],
				selections[4],
				Color(0.04, 0.72, 0.62),
				Color(0.92, 0.76, 0.22)
			)
			_expect(_all_parts_have_geometry(model.get_part_nodes()), "%s 必须生成可见几何体" % variant_name)

	model.set_active_part(-1)
	model.configure(
		PART_VARIANTS[0][0],
		PART_VARIANTS[1][0],
		PART_VARIANTS[2][0],
		PART_VARIANTS[3][0],
		PART_VARIANTS[4][0],
		Color(0.04, 0.72, 0.62),
		Color(0.92, 0.76, 0.22),
		{
			"attack_ring.balance_six": {
				"shape": 70.0,
				"size": 1.2,
				"height": 1.25,
				"material": "alloy",
				"symmetry": 3
			}
		}
	)
	var customized_ring: Node3D = model.get_part_nodes()[0]
	_expect(
		is_equal_approx(customized_ring.scale.x, 1.2),
		"DIY 尺寸必须驱动模型横向比例"
	)
	_expect(
		is_equal_approx(customized_ring.scale.y, 1.25),
		"DIY 高度必须驱动模型纵向比例"
	)

	model.free()
	await _test_assembly_ui()
	await _test_customize_ui()
	await process_frame
	_finish()


func _all_parts_have_geometry(part_nodes: Array[Node3D]) -> bool:
	for part_node in part_nodes:
		if part_node.get_child_count() == 0:
			return false
	return true


func _test_assembly_ui() -> void:
	var assembly_scene := load(ASSEMBLY_SCENE_PATH) as PackedScene
	_expect(assembly_scene != null, "五件式组装界面必须存在")
	if assembly_scene == null:
		return
	var assembly_screen := assembly_scene.instantiate()
	root.add_child(assembly_screen)
	await process_frame

	var part_options := assembly_screen.get_node("%PartOptions") as OptionButton
	_expect(part_options != null, "组装界面必须提供当前部件选项")
	for part_index in range(5):
		assembly_screen.call("_select_active_part", part_index, false)
		_expect(part_options.item_count == 3, "DIY 位置 %d 必须提供三个零件方案" % part_index)
	assembly_screen.free()
	await process_frame


func _test_customize_ui() -> void:
	var customize_scene := load(CUSTOMIZE_SCENE_PATH) as PackedScene
	_expect(customize_scene != null, "深度 DIY 界面必须存在")
	if customize_scene == null:
		return
	var game_state = root.get_node("/root/GameState")
	var original_target: StringName = game_state.customizing_part_id
	game_state.customizing_part_id = &"attack_ring.balance_six"
	var customize_screen := customize_scene.instantiate()
	root.add_child(customize_screen)
	await process_frame
	_expect(
		customize_screen.get_node_or_null("%SizeHandle") != null,
		"深度 DIY 必须提供尺寸模型手柄"
	)
	_expect(
		customize_screen.get_node_or_null("%HeightHandle") != null,
		"深度 DIY 必须提供高度模型手柄"
	)
	_expect(
		customize_screen.get_node_or_null("%ShapeHandle") != null,
		"深度 DIY 必须提供轮廓模型手柄"
	)
	_expect(
		customize_screen.get_node_or_null("%MaterialOptions") != null,
		"深度 DIY 必须提供材料选择"
	)
	customize_screen.free()
	game_state.customizing_part_id = original_target
	await process_frame


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("PASS: five_part_top_model_test")
		quit(0)
		return
	for failure in _failures:
		push_error(failure)
	quit(1)
