class_name BattleInputSource
extends RefCounted


func get_launch_command(slot: int) -> Dictionary:
	return {
		"slot": slot,
		"power_q": BattleProtocol.quantize_power(0.86),
		"height_q": BattleProtocol.quantize_height(0.45),
		"direction_q": BattleProtocol.quantize_direction(0.0),
		"angle_q": BattleProtocol.quantize_angle(0.0)
	}


func get_input(sim: BattleSimulation, slot: int, frame: int) -> Dictionary:
	return {
		"frame": frame,
		"slot": slot,
		"cx": 0,
		"cy": 0,
		"flags": 0
	}


func is_ready() -> bool:
	return true
