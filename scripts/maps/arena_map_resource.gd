class_name ArenaMapResource
extends Resource

@export var map_name: String = ""
@export var scene_path: String = ""
@export var default_surface: TerrainSurfaceResource
@export var supports_composite_terrain: bool = false
@export_range(4.0, 12.0, 0.1) var terrain_radius: float = 7.0
@export_range(0.0, 2.5, 0.05) var bowl_depth: float = 0.6
@export_range(1.0, 4.0, 0.1) var bowl_curve: float = 2.0
@export_range(-12.0, 12.0, 0.25) var directional_slope_degrees: float = 0.0
@export_range(-180.0, 180.0, 1.0) var slope_direction_degrees: float = 0.0
@export_range(12, 48, 1) var radial_segments: int = 28
@export_range(24, 96, 1) var angular_segments: int = 64
@export var recommended_players: int = 2
@export_multiline var description: String = ""


func get_height_at(local_position: Vector3) -> float:
	var radial_distance := Vector2(local_position.x, local_position.z).length()
	var radial_ratio := clampf(
		radial_distance / maxf(terrain_radius, 0.001),
		0.0,
		1.0
	)
	var bowl_height := bowl_depth * pow(radial_ratio, bowl_curve)
	var slope_angle := deg_to_rad(directional_slope_degrees)
	var slope_direction := Vector2(
		cos(deg_to_rad(slope_direction_degrees)),
		sin(deg_to_rad(slope_direction_degrees))
	)
	var directional_distance := Vector2(
		local_position.x,
		local_position.z
	).dot(slope_direction)
	return bowl_height + tan(slope_angle) * directional_distance


func get_surface_normal_at(local_position: Vector3) -> Vector3:
	var sample_step := 0.02
	var height_x_minus := get_height_at(
		local_position - Vector3(sample_step, 0.0, 0.0)
	)
	var height_x_plus := get_height_at(
		local_position + Vector3(sample_step, 0.0, 0.0)
	)
	var height_z_minus := get_height_at(
		local_position - Vector3(0.0, 0.0, sample_step)
	)
	var height_z_plus := get_height_at(
		local_position + Vector3(0.0, 0.0, sample_step)
	)
	var gradient_x := (height_x_plus - height_x_minus) / (sample_step * 2.0)
	var gradient_z := (height_z_plus - height_z_minus) / (sample_step * 2.0)
	return Vector3(-gradient_x, 1.0, -gradient_z).normalized()


func get_max_incline_degrees() -> float:
	var bowl_edge_gradient := bowl_depth * bowl_curve / maxf(terrain_radius, 0.001)
	var directional_gradient := absf(tan(deg_to_rad(directional_slope_degrees)))
	return rad_to_deg(atan(bowl_edge_gradient + directional_gradient))
