class_name FivePartTopModel
extends Node3D

enum PartSlot {
	ATTACK_RING,
	CORE_LOCK,
	WEIGHT_DISC,
	DRIVER_SHAFT,
	TIP
}

const PART_BASE_POSITIONS: Array[Vector3] = [
	Vector3(0.0, 0.24, 0.0),
	Vector3(0.0, 0.38, 0.0),
	Vector3(0.0, 0.06, 0.0),
	Vector3(0.0, -0.19, 0.0),
	Vector3(0.0, -0.54, 0.0)
]
const BROKEN_PART_OFFSETS: Array[Vector3] = [
	Vector3(0.22, 0.08, -0.08),
	Vector3(-0.14, 0.16, 0.1),
	Vector3(0.16, -0.04, 0.16),
	Vector3(-0.12, -0.14, -0.1),
	Vector3(0.1, -0.2, 0.08)
]
const DAMAGE_WARNING_THRESHOLD := 0.65
const DAMAGE_CRITICAL_THRESHOLD := 0.3
const RING_SEGMENTS := 96
const ATTACK_RING_BALANCE := &"attack_ring.balance_six"
const ATTACK_RING_SMASH := &"attack_ring.smash_three"
const ATTACK_RING_STAMINA := &"attack_ring.stamina_arc"
const CORE_LOCK_LOW := &"core_lock.low_center"
const CORE_LOCK_REINFORCED := &"core_lock.reinforced"
const WEIGHT_DISC_HEAVY := &"weight_disc.heavy_outer"
const WEIGHT_DISC_ECCENTRIC := &"weight_disc.eccentric"
const DRIVER_SHAFT_LOW := &"driver_shaft.low_stable"
const DRIVER_SHAFT_HIGH := &"driver_shaft.high_attack"
const TIP_METAL := &"tip.metal_stamina"
const TIP_FLAT := &"tip.flat_attack"
const INTERNAL_BEZEL := &"internal.bezel"

@onready var attack_ring_root: Node3D = %AttackRingRoot
@onready var core_lock_root: Node3D = %CoreLockRoot
@onready var weight_disc_root: Node3D = %WeightDiscRoot
@onready var driver_shaft_root: Node3D = %DriverShaftRoot
@onready var tip_root: Node3D = %TipRoot

var attack_ring_id := ATTACK_RING_BALANCE
var core_lock_id := &"core_lock.standard"
var weight_disc_id := &"weight_disc.standard"
var driver_shaft_id := &"driver_shaft.standard"
var tip_id := &"tip.rubber_balance"
var ring_color := Color(0.04, 0.72, 0.62, 1.0)
var core_color := Color(0.92, 0.76, 0.22, 1.0)
var active_part_index := PartSlot.ATTACK_RING

var polymer_material: StandardMaterial3D
var polymer_accent_material: StandardMaterial3D
var core_material: StandardMaterial3D
var bright_metal_material: StandardMaterial3D
var dark_metal_material: StandardMaterial3D
var rubber_material: StandardMaterial3D
var shadow_material: StandardMaterial3D
var damage_overlay_material: StandardMaterial3D
var critical_overlay_material: StandardMaterial3D
var broken_overlay_material: StandardMaterial3D

var part_integrities: Array[float] = [1.0, 1.0, 1.0, 1.0, 1.0]
var broken_parts: Array[bool] = [false, false, false, false, false]

func _ready() -> void:
	_rebuild_model()


func configure(
	new_attack_ring_id: StringName,
	new_core_lock_id: StringName,
	new_weight_disc_id: StringName,
	new_driver_shaft_id: StringName,
	new_tip_id: StringName,
	new_ring_color: Color,
	new_core_color: Color
) -> void:
	attack_ring_id = new_attack_ring_id
	core_lock_id = new_core_lock_id
	weight_disc_id = new_weight_disc_id
	driver_shaft_id = new_driver_shaft_id
	tip_id = new_tip_id
	ring_color = new_ring_color
	core_color = new_core_color
	if is_node_ready():
		_rebuild_model()


func get_customizable_part_count() -> int:
	return 5


func get_part_nodes() -> Array[Node3D]:
	return [
		attack_ring_root,
		core_lock_root,
		weight_disc_root,
		driver_shaft_root,
		tip_root
	]


func get_part_anchor_positions() -> PackedVector3Array:
	var result := PackedVector3Array()
	for part_node in get_part_nodes():
		result.append(part_node.global_position)
	return result


func set_active_part(part_index: int) -> void:
	active_part_index = clampi(part_index, -1, get_customizable_part_count() - 1)
	_apply_part_transforms()


func set_part_damage_state(
	part_index: int,
	integrity_ratio: float,
	is_broken: bool
) -> void:
	if part_index < 0 or part_index >= get_customizable_part_count():
		return
	part_integrities[part_index] = clampf(integrity_ratio, 0.0, 1.0)
	broken_parts[part_index] = is_broken
	_apply_part_transforms()


func reset_damage_visuals() -> void:
	for part_index in range(get_customizable_part_count()):
		part_integrities[part_index] = 1.0
		broken_parts[part_index] = false
	_apply_part_transforms()


func flash_part_damage(part_index: int) -> void:
	var part_nodes := get_part_nodes()
	if part_index < 0 or part_index >= part_nodes.size():
		return
	var part_node := part_nodes[part_index]
	var target_scale := part_node.scale
	part_node.scale = target_scale * 1.1
	var tween := create_tween()
	tween.set_trans(Tween.TRANS_QUAD)
	tween.set_ease(Tween.EASE_OUT)
	tween.tween_property(part_node, "scale", target_scale, 0.14)


func _rebuild_model() -> void:
	_build_materials()
	for part_node in get_part_nodes():
		_clear_children(part_node)
	_build_attack_ring()
	_build_core_lock()
	_build_weight_disc()
	_build_driver_shaft()
	_build_tip()
	_apply_part_transforms()


func _build_materials() -> void:
	polymer_material = _create_material(ring_color, 0.08, 0.22, true)
	polymer_accent_material = _create_material(ring_color.lightened(0.2), 0.18, 0.16, true)
	core_material = _create_material(core_color, 0.38, 0.2, true)
	bright_metal_material = _create_material(Color(0.72, 0.78, 0.8), 0.94, 0.17)
	dark_metal_material = _create_material(Color(0.12, 0.15, 0.17), 0.88, 0.24)
	rubber_material = _create_material(Color(0.025, 0.035, 0.04), 0.02, 0.78)
	shadow_material = _create_material(Color(0.055, 0.075, 0.08), 0.35, 0.42)
	damage_overlay_material = _create_damage_overlay(Color(1.0, 0.48, 0.08, 0.3), 0.7)
	critical_overlay_material = _create_damage_overlay(Color(1.0, 0.08, 0.03, 0.48), 1.25)
	broken_overlay_material = _create_damage_overlay(Color(0.12, 0.015, 0.01, 0.68), 0.35)


func _create_material(
	color: Color,
	metallic: float,
	roughness: float,
	use_clearcoat := false
) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.metallic = metallic
	material.roughness = roughness
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	if use_clearcoat:
		material.clearcoat_enabled = true
		material.clearcoat = 0.72
		material.clearcoat_roughness = 0.16
	return material


func _create_damage_overlay(color: Color, emission_energy: float) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.emission_enabled = true
	material.emission = Color(color.r, color.g, color.b)
	material.emission_energy_multiplier = emission_energy
	return material


func _build_attack_ring() -> void:
	var ring_body := _create_profiled_ring_mesh(
		0.52,
		0.22,
		RING_SEGMENTS,
		PartSlot.ATTACK_RING,
		attack_ring_id
	)
	_add_mesh(attack_ring_root, "AttackRingBody", ring_body, polymer_material)

	var insert_mesh := _create_attack_insert_mesh(attack_ring_id)
	_add_mesh(
		attack_ring_root,
		"ContactInserts",
		insert_mesh,
		bright_metal_material,
		Vector3(0.0, 0.015, 0.0)
	)

	var inner_bezel := _create_profiled_ring_mesh(
		0.5,
		0.055,
		64,
		PartSlot.WEIGHT_DISC,
		INTERNAL_BEZEL
	)
	_add_mesh(
		attack_ring_root,
		"InnerBezel",
		inner_bezel,
		dark_metal_material,
		Vector3(0.0, 0.125, 0.0),
		Vector3.ZERO,
		Vector3(0.82, 1.0, 0.82)
	)

	var detail_count := _attack_lobe_count(attack_ring_id)
	for index in range(detail_count):
		var angle := TAU * float(index) / float(detail_count)
		var screw := _cylinder_mesh(0.034, 0.034, 0.025, 20)
		_add_mesh(
			attack_ring_root,
			"RingBolt%d" % index,
			screw,
			dark_metal_material,
			Vector3(cos(angle) * 0.64, 0.145, sin(angle) * 0.64)
		)


func _build_core_lock() -> void:
	var lock_radius := 0.37
	var lock_height := 0.18
	var root_offset_y := 0.0
	if core_lock_id == CORE_LOCK_LOW:
		lock_radius = 0.41
		lock_height = 0.14
		root_offset_y = -0.025
	elif core_lock_id == CORE_LOCK_REINFORCED:
		lock_radius = 0.4
		lock_height = 0.22

	_add_mesh(
		core_lock_root,
		"LockBody",
		_cylinder_mesh(lock_radius, lock_radius * 0.92, lock_height, 32),
		core_material,
		Vector3(0.0, root_offset_y, 0.0)
	)
	_add_mesh(
		core_lock_root,
		"LockCap",
		_cylinder_mesh(0.28, 0.31, 0.085, 16),
		dark_metal_material,
		Vector3(0.0, root_offset_y + lock_height * 0.52, 0.0),
		Vector3(0.0, PI / 16.0, 0.0)
	)
	_add_mesh(
		core_lock_root,
		"CoreEmblem",
		_cylinder_mesh(0.165, 0.165, 0.028, 32),
		polymer_accent_material,
		Vector3(0.0, root_offset_y + lock_height * 0.78, 0.0)
	)

	var clamp_count := 3 if core_lock_id != CORE_LOCK_REINFORCED else 6
	for index in range(clamp_count):
		var angle := TAU * float(index) / float(clamp_count)
		var clamp_mesh := _create_box_mesh(Vector3(0.15, 0.075, 0.08))
		_add_mesh(
			core_lock_root,
			"LockClamp%d" % index,
			clamp_mesh,
			bright_metal_material,
			Vector3(cos(angle) * 0.31, root_offset_y + 0.015, sin(angle) * 0.31),
			Vector3(0.0, -angle, 0.0)
		)


func _build_weight_disc() -> void:
	var disc_mesh := _create_profiled_ring_mesh(
		0.29,
		0.14,
		80,
		PartSlot.WEIGHT_DISC,
		weight_disc_id
	)
	var disc_offset := Vector3.ZERO
	if weight_disc_id == WEIGHT_DISC_ECCENTRIC:
		disc_offset.x = 0.065
	_add_mesh(weight_disc_root, "WeightDisc", disc_mesh, bright_metal_material, disc_offset)

	_add_mesh(
		weight_disc_root,
		"WeightHub",
		_cylinder_mesh(0.34, 0.34, 0.165, 32),
		dark_metal_material,
		disc_offset
	)

	var inset_count := 8 if weight_disc_id == WEIGHT_DISC_HEAVY else 6
	for index in range(inset_count):
		var angle := TAU * float(index) / float(inset_count)
		var radius := 0.58
		var inset_mesh := _cylinder_mesh(0.05, 0.05, 0.025, 16)
		_add_mesh(
			weight_disc_root,
			"WeightInset%d" % index,
			inset_mesh,
			shadow_material,
			disc_offset + Vector3(cos(angle) * radius, 0.085, sin(angle) * radius)
		)


func _build_driver_shaft() -> void:
	var shaft_height := 0.4
	var shaft_radius := 0.17
	var shaft_offset_y := 0.0
	if driver_shaft_id == DRIVER_SHAFT_LOW:
		shaft_height = 0.32
		shaft_radius = 0.21
		shaft_offset_y = 0.035
	elif driver_shaft_id == DRIVER_SHAFT_HIGH:
		shaft_height = 0.5
		shaft_radius = 0.145
		shaft_offset_y = -0.045

	_add_mesh(
		driver_shaft_root,
		"DriverShaft",
		_cylinder_mesh(shaft_radius, shaft_radius * 0.92, shaft_height, 32),
		shadow_material,
		Vector3(0.0, shaft_offset_y, 0.0)
	)
	_add_mesh(
		driver_shaft_root,
		"UpperCollar",
		_cylinder_mesh(0.285, 0.245, 0.1, 32),
		core_material,
		Vector3(0.0, shaft_offset_y + shaft_height * 0.38, 0.0)
	)
	_add_mesh(
		driver_shaft_root,
		"LowerCollar",
		_cylinder_mesh(shaft_radius * 1.12, shaft_radius, 0.08, 32),
		dark_metal_material,
		Vector3(0.0, shaft_offset_y - shaft_height * 0.42, 0.0)
	)

	var rib_count := 6
	for index in range(rib_count):
		var angle := TAU * float(index) / float(rib_count)
		_add_mesh(
			driver_shaft_root,
			"ShaftRib%d" % index,
			_create_box_mesh(Vector3(0.04, shaft_height * 0.58, 0.055)),
			bright_metal_material,
			Vector3(cos(angle) * shaft_radius, shaft_offset_y, sin(angle) * shaft_radius),
			Vector3(0.0, -angle, 0.0)
		)


func _build_tip() -> void:
	if tip_id == TIP_METAL:
		_add_mesh(
			tip_root,
			"TipHousing",
			_cylinder_mesh(0.17, 0.07, 0.22, 32),
			dark_metal_material,
			Vector3(0.0, 0.03, 0.0)
		)
		_add_mesh(
			tip_root,
			"ContactPoint",
			_sphere_mesh(0.065, 0.13, 32),
			bright_metal_material,
			Vector3(0.0, -0.105, 0.0)
		)
	elif tip_id == TIP_FLAT:
		_add_mesh(
			tip_root,
			"TipHousing",
			_cylinder_mesh(0.22, 0.18, 0.18, 32),
			rubber_material,
			Vector3(0.0, 0.02, 0.0)
		)
		_add_mesh(
			tip_root,
			"FlatContact",
			_cylinder_mesh(0.19, 0.19, 0.065, 32),
			core_material,
			Vector3(0.0, -0.095, 0.0)
		)
	else:
		_add_mesh(
			tip_root,
			"TipHousing",
			_cylinder_mesh(0.2, 0.095, 0.22, 32),
			core_material,
			Vector3(0.0, 0.025, 0.0)
		)
		_add_mesh(
			tip_root,
			"RubberContact",
			_sphere_mesh(0.105, 0.18, 32),
			rubber_material,
			Vector3(0.0, -0.115, 0.0),
			Vector3.ZERO,
			Vector3(1.0, 0.72, 1.0)
		)


func _apply_part_transforms() -> void:
	var part_nodes := get_part_nodes()
	for index in range(part_nodes.size()):
		var part_node := part_nodes[index]
		part_node.position = PART_BASE_POSITIONS[index]
		part_node.rotation_degrees = Vector3.ZERO
		part_node.scale = Vector3.ONE
		if index == active_part_index:
			part_node.scale = Vector3.ONE * 1.035
		var damage_amount := 1.0 - part_integrities[index]
		if broken_parts[index]:
			part_node.position += BROKEN_PART_OFFSETS[index]
			part_node.rotation_degrees = Vector3(
				18.0 + index * 5.0,
				12.0 - index * 7.0,
				22.0 + index * 8.0
			)
			part_node.scale *= 0.72
		elif damage_amount > 0.0:
			part_node.position += BROKEN_PART_OFFSETS[index] * damage_amount * 0.16
			part_node.rotation_degrees = Vector3(
				damage_amount * (index + 1) * 1.2,
				0.0,
				damage_amount * (3.0 + index)
			)
			part_node.scale *= 1.0 - damage_amount * 0.04
		_apply_part_damage_overlay(part_node, part_integrities[index], broken_parts[index])


func _apply_part_damage_overlay(
	part_node: Node,
	integrity_ratio: float,
	is_broken: bool
) -> void:
	for child in part_node.get_children():
		if child is MeshInstance3D:
			if is_broken:
				child.material_overlay = broken_overlay_material
				child.transparency = 0.22
			elif integrity_ratio <= DAMAGE_CRITICAL_THRESHOLD:
				child.material_overlay = critical_overlay_material
				child.transparency = 0.06
			elif integrity_ratio <= DAMAGE_WARNING_THRESHOLD:
				child.material_overlay = damage_overlay_material
				child.transparency = 0.0
			else:
				child.material_overlay = null
				child.transparency = 0.0
		if child.get_child_count() > 0:
			_apply_part_damage_overlay(child, integrity_ratio, is_broken)


func _create_profiled_ring_mesh(
	inner_radius: float,
	height: float,
	segments: int,
	part_slot: PartSlot,
	variant_id: StringName
) -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var half_height := height * 0.5
	for index in range(segments):
		var angle_a := TAU * float(index) / float(segments)
		var angle_b := TAU * float(index + 1) / float(segments)
		var outer_a := _outer_radius(angle_a, part_slot, variant_id)
		var outer_b := _outer_radius(angle_b, part_slot, variant_id)
		_append_annular_section(
			surface,
			angle_a,
			angle_b,
			inner_radius,
			inner_radius,
			outer_a,
			outer_b,
			-half_height,
			half_height
		)
	return surface.commit()


func _create_attack_insert_mesh(variant_id: StringName) -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var lobe_count := _attack_lobe_count(variant_id)
	var half_width := 0.2
	if variant_id == ATTACK_RING_SMASH:
		half_width = 0.34
	elif variant_id == ATTACK_RING_STAMINA:
		half_width = 0.13
	var segment_steps := 8
	for lobe_index in range(lobe_count):
		var center_angle := TAU * float(lobe_index) / float(lobe_count)
		for step in range(segment_steps):
			var angle_a := center_angle - half_width + half_width * 2.0 * float(step) / float(segment_steps)
			var angle_b := center_angle - half_width + half_width * 2.0 * float(step + 1) / float(segment_steps)
			_append_annular_section(
				surface,
				angle_a,
				angle_b,
				0.76,
				0.76,
				_outer_radius(angle_a, PartSlot.ATTACK_RING, variant_id) + 0.018,
				_outer_radius(angle_b, PartSlot.ATTACK_RING, variant_id) + 0.018,
				0.075,
				0.145
			)
	return surface.commit()


func _append_annular_section(
	surface: SurfaceTool,
	angle_a: float,
	angle_b: float,
	inner_a: float,
	inner_b: float,
	outer_a: float,
	outer_b: float,
	bottom_y: float,
	top_y: float
) -> void:
	var inner_bottom_a := _radial_point(angle_a, inner_a, bottom_y)
	var inner_bottom_b := _radial_point(angle_b, inner_b, bottom_y)
	var outer_bottom_a := _radial_point(angle_a, outer_a, bottom_y)
	var outer_bottom_b := _radial_point(angle_b, outer_b, bottom_y)
	var inner_top_a := _radial_point(angle_a, inner_a, top_y)
	var inner_top_b := _radial_point(angle_b, inner_b, top_y)
	var outer_top_a := _radial_point(angle_a, outer_a, top_y)
	var outer_top_b := _radial_point(angle_b, outer_b, top_y)

	_add_quad(surface, inner_top_a, inner_top_b, outer_top_b, outer_top_a, Vector3.UP)
	_add_quad(surface, inner_bottom_a, outer_bottom_a, outer_bottom_b, inner_bottom_b, Vector3.DOWN)

	var mid_angle := (angle_a + angle_b) * 0.5
	var outer_normal := Vector3(cos(mid_angle), 0.0, sin(mid_angle))
	var inner_normal := -outer_normal
	_add_quad(surface, outer_bottom_a, outer_top_a, outer_top_b, outer_bottom_b, outer_normal)
	_add_quad(surface, inner_bottom_b, inner_top_b, inner_top_a, inner_bottom_a, inner_normal)


func _outer_radius(angle: float, part_slot: PartSlot, variant_id: StringName) -> float:
	if part_slot == PartSlot.ATTACK_RING:
		if variant_id == ATTACK_RING_SMASH:
			var attack_pulse := pow(maxf(0.0, cos(angle * 3.0 - 0.28)), 4.0)
			return 0.91 + attack_pulse * 0.3
		if variant_id == ATTACK_RING_STAMINA:
			return 1.01 + cos(angle * 8.0) * 0.022
		var balance_pulse := pow(0.5 + 0.5 * cos(angle * 6.0), 2.0)
		return 0.94 + balance_pulse * 0.12

	if variant_id == WEIGHT_DISC_HEAVY:
		return 0.82 + cos(angle * 8.0) * 0.018
	if variant_id == WEIGHT_DISC_ECCENTRIC:
		return 0.74 + cos(angle) * 0.075 + cos(angle * 5.0) * 0.018
	if variant_id == INTERNAL_BEZEL:
		return 0.72
	return 0.74 + cos(angle * 6.0) * 0.012


func _attack_lobe_count(variant_id: StringName) -> int:
	if variant_id == ATTACK_RING_SMASH:
		return 3
	if variant_id == ATTACK_RING_STAMINA:
		return 8
	return 6


func _radial_point(angle: float, radius: float, y: float) -> Vector3:
	return Vector3(cos(angle) * radius, y, sin(angle) * radius)


func _add_quad(
	surface: SurfaceTool,
	a: Vector3,
	b: Vector3,
	c: Vector3,
	d: Vector3,
	normal: Vector3
) -> void:
	_add_triangle(surface, a, b, c, normal)
	_add_triangle(surface, a, c, d, normal)


func _add_triangle(
	surface: SurfaceTool,
	a: Vector3,
	b: Vector3,
	c: Vector3,
	normal: Vector3
) -> void:
	surface.set_normal(normal)
	surface.add_vertex(a)
	surface.set_normal(normal)
	surface.add_vertex(b)
	surface.set_normal(normal)
	surface.add_vertex(c)


func _cylinder_mesh(
	top_radius: float,
	bottom_radius: float,
	height: float,
	segments: int
) -> CylinderMesh:
	var mesh := CylinderMesh.new()
	mesh.top_radius = top_radius
	mesh.bottom_radius = bottom_radius
	mesh.height = height
	mesh.radial_segments = segments
	mesh.rings = 2
	return mesh


func _sphere_mesh(radius: float, height: float, segments: int) -> SphereMesh:
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = height
	mesh.radial_segments = segments
	mesh.rings = 16
	return mesh


func _create_box_mesh(size: Vector3) -> BoxMesh:
	var mesh := BoxMesh.new()
	mesh.size = size
	return mesh


func _add_mesh(
	parent: Node3D,
	node_name: String,
	mesh: Mesh,
	material: Material,
	local_position := Vector3.ZERO,
	local_rotation := Vector3.ZERO,
	local_scale := Vector3.ONE
) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.name = node_name
	instance.mesh = mesh
	instance.material_override = material
	instance.position = local_position
	instance.rotation = local_rotation
	instance.scale = local_scale
	parent.add_child(instance)
	return instance


func _clear_children(parent: Node) -> void:
	for child in parent.get_children():
		child.free()
