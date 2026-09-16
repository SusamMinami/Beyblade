extends Node3D

const LAB_SET := preload("res://resources/test_lab/test_lab.glb")
const TOP_SCENE := preload("res://scenes/assembly/FivePartTopModel.tscn")

var top_model: FivePartTopModel
var center_marker: MeshInstance3D
var scan_ring: MeshInstance3D
var camera: Camera3D
var specimen := Node3D.new()
var scanning := false
var show_center := false
var elapsed := 0.0


func _ready() -> void:
	var lab := LAB_SET.instantiate()
	add_child(lab)
	# glTF COLOR_0 contains linear base color and baked contact occlusion.
	for mesh in lab.find_children("*", "MeshInstance3D", true, false):
		var colors = mesh.mesh.surface_get_arrays(0)[Mesh.ARRAY_COLOR]
		if colors != null and not colors.is_empty():
			var material: StandardMaterial3D = mesh.get_active_material(0).duplicate()
			material.vertex_color_use_as_albedo = true
			material.vertex_color_is_srgb = false
			mesh.material_override = material
	_create_lighting()
	camera = Camera3D.new()
	camera.position = Vector3(0.25, 4.35, 9.7)
	camera.fov = 43.0
	add_child(camera)
	camera.look_at(Vector3(0, 1.22, 0))
	camera.current = true

	add_child(specimen)
	top_model = TOP_SCENE.instantiate()
	specimen.add_child(top_model)
	center_marker = MeshInstance3D.new()
	var sphere := SphereMesh.new()
	sphere.radius = 0.035
	sphere.height = 0.07
	center_marker.mesh = sphere
	var marker_material := _light_material(Color(1.0, 0.73, 0.13))
	marker_material.no_depth_test = true
	marker_material.render_priority = 127
	center_marker.material_override = marker_material
	center_marker.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	specimen.add_child(center_marker)
	_create_shield()
	scan_ring = MeshInstance3D.new()
	var ring := TorusMesh.new()
	ring.inner_radius = 0.883
	ring.outer_radius = 0.895
	ring.rings = 64
	ring.ring_segments = 8
	scan_ring.mesh = ring
	scan_ring.material_override = _light_material(Color(0.15, 0.95, 0.80))
	scan_ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(scan_ring)
	scan_ring.visible = false


func configure(state: Node, data: TopBuildData) -> void:
	top_model.configure(
		state.selected_attack_ring_id, state.selected_core_lock_id,
		state.selected_weight_disc_id, state.selected_driver_shaft_id,
		state.selected_tip_id, state.custom_ring_color, state.custom_core_color,
		state.get_active_loadout_customizations()
	)
	top_model.set_active_part(-1)
	# Fit the actual DIY geometry, but keep the marker in the same rule-space transform.
	var bounds := AABB()
	var first := true
	for mesh in top_model.find_children("*", "MeshInstance3D", true, false):
		var local: Transform3D = top_model.global_transform.affine_inverse() * mesh.global_transform
		var part_bounds: AABB = local * mesh.get_aabb()
		bounds = part_bounds if first else bounds.merge(part_bounds)
		first = false
	var fit := minf(1.48 / maxf(bounds.size.x, bounds.size.z), 1.26 / maxf(bounds.size.y, 0.01))
	specimen.scale = Vector3.ONE * fit
	specimen.position = Vector3(0, 0.43 - bounds.position.y * fit, 0)
	center_marker.position = data.center_of_mass if data != null else Vector3.ZERO
	center_marker.visible = show_center


func set_display_texture(texture: Texture2D) -> void:
	var display := MeshInstance3D.new()
	var face := QuadMesh.new()
	face.size = Vector2(2.43, 1.22)
	display.mesh = face
	display.position = Vector3(0, 3.06, -0.618)
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_texture = texture
	material.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR
	display.material_override = material
	display.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(display)


func set_center_visible(value: bool) -> void:
	show_center = value
	center_marker.visible = value


func _process(delta: float) -> void:
	elapsed += delta
	# The apparatus stays still; only the specimen and active measurement sweep move.
	specimen.rotation.y += delta * (1.8 if scanning else 0.18)
	scan_ring.visible = scanning
	if scanning:
		scan_ring.position.y = 0.47 + (sin(elapsed * 2.6) * 0.5 + 0.5) * 1.16


func _create_lighting() -> void:
	var environment := Environment.new()
	var sky := Sky.new()
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color(0.38, 0.42, 0.45)
	sky_material.sky_horizon_color = Color(0.65, 0.68, 0.67)
	sky_material.ground_bottom_color = Color(0.22, 0.26, 0.28)
	sky_material.ground_horizon_color = Color(0.63, 0.68, 0.69)
	sky.sky_material = sky_material
	environment.sky = sky
	environment.background_mode = Environment.BG_SKY
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.86, 0.89, 0.9)
	environment.ambient_light_energy = 0.8
	environment.background_energy_multiplier = 0.8
	environment.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	var world := WorldEnvironment.new()
	world.environment = environment
	add_child(world)

	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-48, -32, 0)
	key.light_color = Color(1.0, 0.96, 0.89)
	key.light_energy = 1.1
	key.shadow_enabled = true
	key.directional_shadow_max_distance = 18.0
	key.shadow_bias = 0.04
	add_child(key)
	var fill := OmniLight3D.new()
	fill.position = Vector3(-3.0, 3.2, 3.8)
	fill.light_color = Color(0.87, 0.94, 1.0)
	fill.light_energy = 1.2
	fill.omni_range = 9.0
	add_child(fill)
	var rim := OmniLight3D.new()
	rim.position = Vector3(2.0, 3.6, -1.8)
	rim.light_color = Color(0.72, 1.0, 0.90)
	rim.light_energy = 0.28
	rim.omni_range = 5.0
	add_child(rim)
	var inspection := OmniLight3D.new()
	inspection.position = Vector3(-0.7, 2.1, 1.8)
	inspection.light_color = Color(0.92, 0.97, 1.0)
	inspection.light_energy = 1.8
	inspection.omni_range = 3.0
	add_child(inspection)


func _create_shield() -> void:
	# Open-ended cylinder: Fresnel edges suggest acrylic without veiling the model.
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	var vertices := PackedVector3Array()
	var normals := PackedVector3Array()
	var indices := PackedInt32Array()
	for index in range(97):
		var angle := TAU * float(index) / 96.0
		var normal := Vector3(cos(angle), 0, sin(angle))
		for y in [0.385, 1.77]:
			vertices.append(normal * 0.91 + Vector3(0, y, 0))
			normals.append(normal)
		if index < 96:
			var k := index * 2
			indices.append_array([k, k + 1, k + 2, k + 1, k + 3, k + 2])
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_NORMAL] = normals
	arrays[Mesh.ARRAY_INDEX] = indices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var shader := Shader.new()
	shader.code = """
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never;
void fragment() {
	float edge = pow(1.0 - abs(dot(normalize(NORMAL), normalize(VIEW))), 5.0);
	ALBEDO = vec3(0.72, 0.94, 0.96);
	ALPHA = 0.018 + edge * 0.19;
}
"""
	var material := ShaderMaterial.new()
	material.shader = shader
	var shield := MeshInstance3D.new()
	shield.mesh = mesh
	shield.material_override = material
	shield.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(shield)
	for y in [0.39, 1.77]:
		var edge := MeshInstance3D.new()
		var ring := TorusMesh.new()
		ring.inner_radius = 0.904
		ring.outer_radius = 0.916
		ring.rings = 96
		ring.ring_segments = 6
		edge.mesh = ring
		edge.position.y = y
		edge.material_override = _light_material(Color(0.62, 0.81, 0.82))
		edge.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(edge)


func _light_material(color: Color) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = color
	return material
