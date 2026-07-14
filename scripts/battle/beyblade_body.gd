class_name BeybladeBody
extends RigidBody3D

@export var max_spin_speed: float = 65.0
@export var spin_decay_per_second: float = 3.8
@export var launch_forward_impulse: float = 4.5
@export var control_force: float = 9.0
@export var min_active_spin_speed: float = 2.0

var spin_speed: float = 0.0
var is_launched: bool = false
var control_vector: Vector2 = Vector2.ZERO

func _ready() -> void:
	can_sleep = false
	reset_top()


func _physics_process(delta: float) -> void:
	if not is_launched:
		return

	spin_speed = maxf(spin_speed - spin_decay_per_second * delta, 0.0)
	angular_velocity = Vector3.UP * spin_speed

	var control_direction := Vector3(control_vector.x, 0.0, control_vector.y)
	if control_direction.length_squared() > 0.01 and spin_speed > min_active_spin_speed:
		apply_central_force(control_direction.normalized() * control_force)

	if spin_speed <= 0.0:
		is_launched = false
		angular_velocity = Vector3.ZERO


func launch(forward_direction: Vector3 = Vector3.FORWARD) -> void:
	is_launched = true
	spin_speed = max_spin_speed
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.UP * spin_speed
	apply_central_impulse(forward_direction.normalized() * launch_forward_impulse)


func reset_top() -> void:
	is_launched = false
	spin_speed = 0.0
	control_vector = Vector2.ZERO
	global_position = Vector3(0.0, 0.45, 0.0)
	global_rotation = Vector3.ZERO
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.ZERO


func set_control_vector(value: Vector2) -> void:
	control_vector = value.limit_length(1.0)
