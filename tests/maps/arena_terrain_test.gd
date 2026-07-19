extends SceneTree

const ARENA_MAP_CATALOG := preload("res://scripts/maps/arena_map_catalog.gd")
const ARENA_TERRAIN := preload("res://scripts/maps/arena_terrain.gd")

var _failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	_test_height_profiles()
	await _test_composite_visual_regions()
	await _test_slope_acceleration()
	_finish()


func _test_height_profiles() -> void:
	var bowl: ArenaMapResource = ARENA_MAP_CATALOG.get_by_name("标准碗形竞技场")
	var speed_slope: ArenaMapResource = ARENA_MAP_CATALOG.get_by_name("金属高速竞技场")
	_expect(bowl != null, "必须能加载标准碗形地图")
	_expect(speed_slope != null, "必须能加载金属高速地图")
	if bowl == null or speed_slope == null:
		return

	_expect(
		bowl.get_height_at(Vector3(6.0, 0.0, 0.0))
		> bowl.get_height_at(Vector3.ZERO),
		"碗形地图外圈必须高于中心"
	)
	var north_height := speed_slope.get_height_at(Vector3(0.0, 0.0, -3.0))
	var south_height := speed_slope.get_height_at(Vector3(0.0, 0.0, 3.0))
	_expect(
		north_height > south_height,
		"金属高速地图必须形成由北向南的下坡"
	)
	var normal := speed_slope.get_surface_normal_at(Vector3.ZERO)
	_expect(
		not normal.is_equal_approx(Vector3.UP),
		"带方向倾角的地图中心法线不能完全竖直"
	)


func _test_slope_acceleration() -> void:
	var arena_map: ArenaMapResource = ARENA_MAP_CATALOG.get_by_name("金属高速竞技场")
	var terrain := ARENA_TERRAIN.new()
	terrain.map_resource = arena_map
	root.add_child(terrain)
	await process_frame
	terrain.physics_material_override.friction = 0.0

	var body := RigidBody3D.new()
	body.mass = 1.0
	body.can_sleep = false
	body.continuous_cd = true
	var body_material := PhysicsMaterial.new()
	body_material.friction = 0.0
	body.physics_material_override = body_material
	var shape := SphereShape3D.new()
	shape.radius = 0.2
	var collision := CollisionShape3D.new()
	collision.shape = shape
	body.add_child(collision)
	root.add_child(body)
	body.global_position = Vector3(
		0.0,
		arena_map.get_height_at(Vector3.ZERO) + 0.35,
		0.0
	)

	for _frame in range(75):
		await physics_frame

	_expect(
		body.global_position.z > 0.15,
		"刚体必须在重力作用下沿实际坡面向南加速"
	)
	_expect(
		Vector2(body.linear_velocity.x, body.linear_velocity.z).length() > 0.1,
		"坡面必须把重力转化为水平速度"
	)
	body.free()
	terrain.free()
	await process_frame


func _test_composite_visual_regions() -> void:
	var arena_map: ArenaMapResource = ARENA_MAP_CATALOG.get_by_name(
		"复合材质竞技场"
	)
	var terrain := ARENA_TERRAIN.new()
	terrain.configure(arena_map, Color.WHITE)
	root.add_child(terrain)
	await process_frame

	var center_color: Color = terrain.get_surface_color_at_radius(1.0)
	var middle_color: Color = terrain.get_surface_color_at_radius(4.0)
	var edge_color: Color = terrain.get_surface_color_at_radius(6.2)
	_expect(
		not center_color.is_equal_approx(middle_color),
		"复合地图中央金属和中圈橡胶必须使用不同颜色"
	)
	_expect(
		not middle_color.is_equal_approx(edge_color),
		"复合地图中圈橡胶和边缘减速带必须使用不同颜色"
	)

	var terrain_mesh := terrain.get_node_or_null("TerrainMesh") as MeshInstance3D
	_expect(terrain_mesh != null, "地形必须生成可视网格")
	if terrain_mesh != null and terrain_mesh.mesh != null:
		var arrays := terrain_mesh.mesh.surface_get_arrays(0)
		var colors: PackedColorArray = arrays[Mesh.ARRAY_COLOR]
		_expect(not colors.is_empty(), "复合地形网格必须包含顶点颜色")
		_expect(
			colors.size() == arrays[Mesh.ARRAY_VERTEX].size(),
			"每个地形顶点必须具有对应颜色"
		)
	var boundary := terrain.get_node_or_null("Boundary")
	_expect(boundary != null and boundary.get_child_count() > 0, "地形必须生成护圈")
	if boundary != null and boundary.get_child_count() > 0:
		var wall_position: Vector3 = boundary.get_child(0).position
		var wall_radius := Vector2(wall_position.x, wall_position.z).length()
		_expect(
			is_equal_approx(wall_radius, arena_map.wall_radius + 0.12),
			"护圈几何必须使用规则层 wall_radius"
		)
	terrain.free()
	await process_frame


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("PASS: arena_terrain_test")
		quit(0)
		return
	for failure in _failures:
		push_error(failure)
	quit(1)
