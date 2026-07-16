extends SceneTree

const MODEL_SCENE_PATH := "res://scenes/assembly/FivePartTopModel.tscn"
const ASSEMBLY_SCENE_PATH := "res://scenes/assembly/AssemblyScreen.tscn"
const PART_VARIANTS := [
	["六刃平衡攻击环", "三翼重击攻击环", "圆弧续航攻击环"],
	["标准核心锁扣", "低重心核心锁扣", "强化核心锁扣"],
	["标准金属配重盘", "重型外缘配重盘", "偏心突击配重盘"],
	["标准驱动中轴", "低位稳定中轴", "高位突击中轴"],
	["橡胶平衡尖", "金属续航尖", "攻击扁平尖"]
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

	model.free()
	await _test_assembly_ui()
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
