class_name PartCustomization
extends RefCounted

const DEFAULT := {
	"shape": 0.0,
	"size": 1.0,
	"height": 1.0,
	"material": "stock",
	"symmetry": 2
}
const MATERIALS := {
	"stock": {
		"id": "stock",
		"name": "原装材料",
		"price": 0,
		"density": 1.0,
		"friction": 1.0,
		"restitution": 1.0,
		"damping": 1.0,
		"stability": 1.0,
		"control": 1.0,
		"attack": 1.0,
		"durability": 1.0
	},
	"polymer": {
		"id": "polymer",
		"name": "轻质聚合物",
		"price": 160,
		"density": 0.78,
		"friction": 1.04,
		"restitution": 0.92,
		"damping": 0.94,
		"stability": 1.02,
		"control": 1.08,
		"attack": 0.9,
		"durability": 0.84
	},
	"alloy": {
		"id": "alloy",
		"name": "高密度合金",
		"price": 360,
		"density": 1.2,
		"friction": 0.96,
		"restitution": 1.1,
		"damping": 1.05,
		"stability": 0.98,
		"control": 0.9,
		"attack": 1.1,
		"durability": 1.2
	},
	"carbon": {
		"id": "carbon",
		"name": "碳纤维复材",
		"price": 420,
		"density": 0.7,
		"friction": 0.92,
		"restitution": 0.96,
		"damping": 0.88,
		"stability": 1.06,
		"control": 1.04,
		"attack": 0.96,
		"durability": 1.06
	},
	"rubber": {
		"id": "rubber",
		"name": "高抓地橡胶",
		"price": 260,
		"density": 0.94,
		"friction": 1.24,
		"restitution": 0.72,
		"damping": 1.24,
		"stability": 1.04,
		"control": 1.12,
		"attack": 0.9,
		"durability": 0.96
	}
}
const SYMMETRY_OPTIONS := [2, 3, 4, 6]


static func normalize(value: Dictionary = {}) -> Dictionary:
	var material_id := str(value.get("material", DEFAULT.material))
	if not MATERIALS.has(material_id):
		material_id = DEFAULT.material
	var symmetry := int(value.get("symmetry", DEFAULT.symmetry))
	if symmetry not in SYMMETRY_OPTIONS:
		symmetry = DEFAULT.symmetry
	return {
		"shape": clampf(float(value.get("shape", DEFAULT.shape)), 0.0, 100.0),
		"size": clampf(float(value.get("size", DEFAULT.size)), 0.78, 1.24),
		"height": clampf(float(value.get("height", DEFAULT.height)), 0.72, 1.35),
		"material": material_id,
		"symmetry": symmetry
	}


static func normalize_map(value: Dictionary = {}) -> Dictionary:
	var result := {}
	for part_id in value:
		var customization = value[part_id]
		if str(part_id).is_empty() or not customization is Dictionary:
			continue
		result[str(part_id)] = normalize(customization)
	return result


static func is_default(value: Dictionary = {}) -> bool:
	var normalized := normalize(value)
	return (
		is_equal_approx(float(normalized.shape), float(DEFAULT.shape))
		and is_equal_approx(float(normalized.size), float(DEFAULT.size))
		and is_equal_approx(float(normalized.height), float(DEFAULT.height))
		and normalized.material == DEFAULT.material
		and normalized.symmetry == DEFAULT.symmetry
	)


static func get_material(material_id: String) -> Dictionary:
	return MATERIALS.get(material_id, MATERIALS.stock).duplicate(true)


static func get_material_list() -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	for material_id in MATERIALS:
		result.append(MATERIALS[material_id].duplicate(true))
	return result


static func apply_to_part(
	part: TopPartResource,
	value: Dictionary = {}
) -> TopPartResource:
	if part == null or value.is_empty() or is_default(value):
		return part

	var customization := normalize(value)
	var material: Dictionary = MATERIALS[customization.material]
	var result := part.duplicate(true) as TopPartResource
	var volume_scale: float = pow(float(customization.size), 2.0) * float(
		customization.height
	)
	var mass_scale: float = volume_scale * float(material.density)
	var shape_strength: float = float(customization.shape) / 100.0
	var symmetry_balance := {
		2: 0.94,
		3: 0.97,
		4: 1.01,
		6: 1.05
	}
	var symmetry_attack := {
		2: 1.08,
		3: 1.06,
		4: 1.01,
		6: 0.96
	}
	var height_stability := clampf(
		1.0 - maxf(float(customization.height) - 1.0, 0.0) * 0.34,
		0.82,
		1.0
	)
	var low_profile_stability := clampf(
		1.0 + maxf(1.0 - float(customization.height), 0.0) * 0.2,
		1.0,
		1.08
	)

	result.mass = part.mass * mass_scale
	result.center_of_mass_offset = Vector3(
		part.center_of_mass_offset.x,
		part.center_of_mass_offset.y * float(customization.height)
		+ (float(customization.height) - 1.0) * 0.045,
		part.center_of_mass_offset.z
	)
	result.moment_of_inertia = (
		part.moment_of_inertia
		* mass_scale
		* pow(float(customization.size), 2.0)
	)
	result.transverse_moment_of_inertia = (
		part.transverse_moment_of_inertia
		* mass_scale
		* pow(float(customization.height), 2.0)
	)
	result.friction = part.friction * float(material.friction)
	result.restitution = clampf(
		part.restitution * float(material.restitution),
		0.0,
		1.0
	)
	result.contact_area = (
		part.contact_area
		* pow(float(customization.size), 2.0)
		* (1.0 + shape_strength * 0.16)
	)
	result.spin_damping_multiplier = (
		part.spin_damping_multiplier * float(material.damping)
	)
	result.stability = (
		part.stability
		* float(material.stability)
		* height_stability
		* low_profile_stability
		* (1.0 + (
			float(symmetry_balance[customization.symmetry]) - 1.0
		) * shape_strength)
	)
	result.control_response = (
		part.control_response
		* float(material.control)
		* clampf(1.0 / sqrt(mass_scale), 0.82, 1.15)
	)
	result.attack_power = (
		part.attack_power
		* float(material.attack)
		* (1.0 + (
			float(symmetry_attack[customization.symmetry]) - 1.0
		) * shape_strength)
		* (1.0 + shape_strength * 0.08)
	)
	result.durability = (
		part.durability
		* float(material.durability)
		* pow(volume_scale, 0.28)
	)
	return result
