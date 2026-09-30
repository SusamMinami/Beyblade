class_name BattleV6Presentation
extends RefCounted

static func screen_to_world(camera: Camera3D, input: Vector2) -> Vector2:
	var right := camera.global_basis.x
	right.y = 0
	right = Vector3.RIGHT if right.length_squared()<1e-10 else right.normalized()
	return Vector2(right.x*input.x-right.z*input.y,right.z*input.x+right.x*input.y)

static func world_to_screen(camera: Camera3D, input: Vector2) -> Vector2:
	var right := screen_to_world(camera,Vector2.RIGHT)
	return Vector2(input.dot(right),input.dot(Vector2(-right.y,right.x)))

static func pose(state: Dictionary) -> Basis:
	var lean = state.tiltVector
	var magnitude = sqrt(lean.x*lean.x+lean.y*lean.y)
	var ratio = sin(state.tilt)/maxf(magnitude,1e-12)
	var axis := Vector3(lean.x*ratio,cos(state.tilt),lean.y*ratio).normalized()
	return Basis(Quaternion(Vector3.UP,axis)*Quaternion(Vector3.UP,float(state.spinPhase)))

static func zone_mesh(map: ArenaMapResource, zone: Dictionary) -> MeshInstance3D:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in 64:
		var points: Array[Vector3] = []
		for pair in [[i,zone.radius-.045],[i,zone.radius+.045],[i+1,zone.radius+.045],[i+1,zone.radius-.045]]:
			var angle = pair[0]/64.0*TAU
			var point := Vector3(zone.x+cos(angle)*pair[1],0,zone.y+sin(angle)*pair[1])
			point.y = map.get_height_at(point)+.016
			points.append(point)
		for index in [0,1,2,0,2,3]:
			surface.set_normal(Vector3.UP)
			surface.add_vertex(points[index])
	var instance := MeshInstance3D.new()
	instance.name = "DriveZone"+str(zone.id)
	instance.mesh = surface.commit()
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.cull_mode = BaseMaterial3D.CULL_DISABLED
	instance.material_override = material
	instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	instance.set_meta("zone_id",zone.id)
	return instance
