class_name TopPartResource
extends Resource

enum PartType {
	RING,
	WEIGHT,
	TIP
}

@export var part_name: String = ""
@export var part_type: PartType = PartType.RING
@export var mass: float = 1.0
@export var moment_of_inertia: float = 1.0
@export var friction: float = 1.0
@export var stability: float = 1.0
@export var attack_power: float = 1.0
@export var durability: float = 100.0
@export_multiline var description: String = ""
