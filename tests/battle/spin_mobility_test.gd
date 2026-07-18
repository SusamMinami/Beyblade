extends SceneTree

const STANDARD_IDS := [
	&"attack_ring.balance_six",
	&"core_lock.standard",
	&"weight_disc.standard",
	&"driver_shaft.standard",
	&"tip.rubber_balance"
]

var _failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var low_spin := await _create_body()
	var high_spin := await _create_body()
	low_spin.set_physics_process(false)
	high_spin.set_physics_process(false)

	low_spin.is_launched = true
	high_spin.is_launched = true
	low_spin.spin_speed = low_spin.max_spin_speed * 0.06
	high_spin.spin_speed = high_spin.max_spin_speed
	low_spin.linear_velocity = Vector3(6.0, 0.0, 0.0)
	high_spin.linear_velocity = Vector3(6.0, 0.0, 0.0)
	low_spin.set_control_vector(Vector2.RIGHT)
	high_spin.set_control_vector(Vector2.RIGHT)

	for _frame in range(30):
		low_spin._physics_process(1.0 / 60.0)
		high_spin._physics_process(1.0 / 60.0)

	var low_speed := Vector2(low_spin.linear_velocity.x, low_spin.linear_velocity.z).length()
	var high_speed := Vector2(high_spin.linear_velocity.x, high_spin.linear_velocity.z).length()
	_expect(low_speed < high_speed * 0.4, "低转速陀螺必须比高转速陀螺更快失去平移速度")
	_expect(low_spin.has_method("get_control_influence"), "BeybladeBody 必须公开操控影响值")
	if low_spin.has_method("get_control_influence"):
		_expect(
			low_spin.get_control_influence() < high_spin.get_control_influence() * 0.25,
			"低转速时操控影响必须显著减弱"
		)

	low_spin.free()
	high_spin.free()
	await process_frame
	_finish()


func _create_body() -> BeybladeBody:
	var body_scene := load("res://scenes/battle/BeybladeBody.tscn") as PackedScene
	var body := body_scene.instantiate() as BeybladeBody
	root.add_child(body)
	await process_frame
	body.gravity_scale = 0.0
	body.apply_build_data(AssemblyCalculator.calculate_by_ids(
		STANDARD_IDS[0],
		STANDARD_IDS[1],
		STANDARD_IDS[2],
		STANDARD_IDS[3],
		STANDARD_IDS[4]
	))
	body.reset_top()
	return body


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("PASS: spin_mobility_test")
		quit(0)
		return
	for failure in _failures:
		push_error(failure)
	quit(1)
