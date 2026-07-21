class_name LocalInputSource
extends BattleInputSource

var _pending_launch: Dictionary = {}
var _pending_inputs: Array[Dictionary] = []
var _current_control := Vector2.ZERO
var _current_flags := 0
var _launch_set := false


func set_launch(power: float, height: float, direction: float, angle: float) -> void:
	_pending_launch = {
		"slot": BattleProtocol.SLOT_PLAYER,
		"power_q": BattleProtocol.quantize_power(power),
		"height_q": BattleProtocol.quantize_height(height),
		"direction_q": BattleProtocol.quantize_direction(direction),
		"angle_q": BattleProtocol.quantize_angle(angle)
	}
	_launch_set = true


func set_input(control: Vector2, flags: int = 0) -> void:
	_current_control = control
	_current_flags = flags


func queue_input(frame: int, control: Vector2, flags: int = 0) -> void:
	_pending_inputs.append({
		"frame": frame,
		"slot": BattleProtocol.SLOT_PLAYER,
		"cx": BattleProtocol.quantize_control(control.x),
		"cy": BattleProtocol.quantize_control(control.y),
		"flags": flags
	})


func get_launch_command(slot: int) -> Dictionary:
	if _launch_set:
		var cmd := _pending_launch.duplicate()
		cmd["slot"] = slot
		return cmd
	return super.get_launch_command(slot)


func get_input(sim: BattleSimulation, slot: int, frame: int) -> Dictionary:
	for i in range(_pending_inputs.size()):
		if _pending_inputs[i].frame == frame and _pending_inputs[i].slot == slot:
			var result := _pending_inputs[i].duplicate()
			_pending_inputs.remove_at(i)
			return result
	return {
		"frame": frame,
		"slot": slot,
		"cx": BattleProtocol.quantize_control(_current_control.x),
		"cy": BattleProtocol.quantize_control(_current_control.y),
		"flags": _current_flags
	}
