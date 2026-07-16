class_name TopPartResource
extends Resource

## Baseline physical values use SI units:
## mass in kg, offsets in m, inertia in kg*m^2, and contact area in m^2.
enum PartType {
	ATTACK_RING,
	CORE_LOCK,
	WEIGHT_DISC,
	DRIVER_SHAFT,
	TIP
}

@export var part_id: StringName
@export var part_name: String = ""
@export var part_type: PartType = PartType.ATTACK_RING
@export var mass: float = 1.0
@export var center_of_mass_offset: Vector3 = Vector3.ZERO
@export var moment_of_inertia: float = 1.0
@export var transverse_moment_of_inertia: float = 1.0
@export var friction: float = 1.0
@export var restitution: float = 0.2
@export var contact_area: float = 1.0
@export var spin_damping_multiplier: float = 1.0
@export var stability: float = 1.0
@export var control_response: float = 1.0
@export var attack_power: float = 1.0
@export var durability: float = 100.0
## Driver shafts use this to move the ring, lock and weight stack vertically.
@export var upper_stack_height_offset: float = 0.0
@export_multiline var description: String = ""
