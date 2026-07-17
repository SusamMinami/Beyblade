class_name ArenaTerrain
extends StaticBody3D

@export var map_resource: ArenaMapResource
@export var surface_color := Color(0.18, 0.2, 0.23, 1.0)

var _mesh_instance: MeshInstance3D
var _collision_shape: CollisionShape3D
var _boundary_root: Node3D


func _ready() -> void:
	if map_resource != null:
		rebuild()


func configure(arena_map: ArenaMapResource, color: Color) -> void:
	map_resource = arena_map
	surface_color = color
	rebuild()


func rebuild() -> void:
	if map_resource == null:
		return
	if _mesh_instance == null:
		_mesh_instance = MeshInstance3D.new()
		_mesh_instance.name = "TerrainMesh"
		add_child(_mesh_instance)
	if _collision_shape == null:
		_collision_shape = CollisionShape3D.new()
		_collision_shape.name = "TerrainCollision"
		add_child(_collision_shape)
	if _boundary_root == null:
		_boundary_root = Node3D.new()
		_boundary_root.name = "Boundary"
		add_child(_boundary_root)

	var vertices := PackedVector3Array()
	var radial_segments := maxi(map_resource.radial_segments, 1)
	var angular_segments := maxi(map_resource.angular_segments, 3)
	for radial_index in range(radial_segments):
		var inner_radius := (
			map_resource.terrain_radius
			* float(radial_index)
			/ float(radial_segments)
		)
		var outer_radius := (
			map_resource.terrain_radius
			* float(radial_index + 1)
			/ float(radial_segments)
		)
		for angular_index in range(angular_segments):
			var start_angle := TAU * float(angular_index) / float(angular_segments)
			var end_angle := TAU * float(angular_index + 1) / float(angular_segments)
			var inner_start := _surface_point(inner_radius, start_angle)
			var outer_start := _surface_point(outer_radius, start_angle)
			var outer_end := _surface_point(outer_radius, end_angle)
			var inner_end := _surface_point(inner_radius, end_angle)
			vertices.append_array(PackedVector3Array([
				inner_start,
				outer_start,
				outer_end,
				inner_start,
				outer_end,
				inner_end
			]))

	var array_mesh := ArrayMesh.new()
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	array_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var material := StandardMaterial3D.new()
	material.albedo_color = surface_color
	material.roughness = 0.55
	array_mesh.surface_set_material(0, material)
	_mesh_instance.mesh = array_mesh

	var collision := ConcavePolygonShape3D.new()
	collision.backface_collision = true
	collision.set_faces(vertices)
	_collision_shape.shape = collision
	_apply_surface_material()
	_rebuild_boundary()


func get_spawn_height(local_position: Vector3) -> float:
	if map_resource == null:
		return 0.0
	return map_resource.get_height_at(local_position)


func _surface_point(radius: float, angle: float) -> Vector3:
	var point := Vector3(cos(angle) * radius, 0.0, sin(angle) * radius)
	point.y = map_resource.get_height_at(point)
	return point


func _apply_surface_material() -> void:
	if map_resource.default_surface == null:
		physics_material_override = null
		return
	var material := PhysicsMaterial.new()
	material.friction = map_resource.default_surface.surface_friction
	material.bounce = 0.08 * map_resource.default_surface.bounce_multiplier
	physics_material_override = material


func _rebuild_boundary() -> void:
	for child in _boundary_root.get_children():
		_boundary_root.remove_child(child)
		child.queue_free()

	var segment_count := 48
	var segment_length := (
		TAU * (map_resource.terrain_radius + 0.12) / float(segment_count)
		+ 0.08
	)
	var wall_material := StandardMaterial3D.new()
	wall_material.albedo_color = Color(0.08, 0.1, 0.13, 1.0)
	wall_material.roughness = 0.7
	for segment_index in range(segment_count):
		var angle := TAU * float(segment_index) / float(segment_count)
		var edge_point := _surface_point(map_resource.terrain_radius, angle)
		var wall := StaticBody3D.new()
		wall.name = "BoundaryWall%d" % segment_index
		wall.position = edge_point + Vector3(
			cos(angle) * 0.12,
			0.55,
			sin(angle) * 0.12
		)
		wall.rotation.y = PI * 0.5 - angle

		var shape := BoxShape3D.new()
		shape.size = Vector3(segment_length, 1.1, 0.3)
		var collision_shape := CollisionShape3D.new()
		collision_shape.shape = shape
		wall.add_child(collision_shape)

		var mesh := BoxMesh.new()
		mesh.size = shape.size
		var mesh_instance := MeshInstance3D.new()
		mesh_instance.mesh = mesh
		mesh_instance.material_override = wall_material
		wall.add_child(mesh_instance)
		_boundary_root.add_child(wall)
