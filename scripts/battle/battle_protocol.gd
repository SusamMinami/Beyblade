class_name BattleProtocol
extends RefCounted

const PROTOCOL_VERSION := 1
const SIMULATION_VERSION := BattleSimulation.SIMULATION_VERSION
const FIXED_STEP_HZ := 60
const FIXED_DT := 1.0 / float(FIXED_STEP_HZ)

const INPUT_BATCH_SIZE := 3
const SNAPSHOT_INTERVAL := 3
const HASH_CHECK_INTERVAL := 60
const MAX_INPUT_QUEUE := 20
const INPUT_SEND_HZ := FIXED_STEP_HZ / INPUT_BATCH_SIZE
const SNAPSHOT_SEND_HZ := FIXED_STEP_HZ / SNAPSHOT_INTERVAL

const MSG_HELLO := "hello"
const MSG_WELCOME := "welcome"
const MSG_READY := "ready"
const MSG_LAUNCH_WINDOW := "launch_window"
const MSG_LAUNCH := "launch"
const MSG_LAUNCH_BOTH := "launch_both"
const MSG_INPUT := "input"
const MSG_INPUT_BATCH := "input_batch"
const MSG_SNAPSHOT := "snapshot"
const MSG_EVENT := "event"
const MSG_HASH_CHECK := "hash_check"
const MSG_REPLAY_SUBMIT := "replay_submit"
const MSG_RESULT := "result"
const MSG_ERROR := "error"
const MSG_PING := "ping"
const MSG_PONG := "pong"

const MODE_FRAME_SYNC := "frame_sync"
const MODE_STATE_SYNC := "state_sync"
const MODE_ASYNC_VERIFY := "async_verify"
const MODE_LOCAL := "local"

const PHASE_INIT := "init"
const PHASE_CONNECTING := "connecting"
const PHASE_READY := "ready"
const PHASE_LAUNCH_WINDOW := "launch_window"
const PHASE_RUNNING := "running"
const PHASE_FINISHED := "finished"
const PHASE_CLOSED := "closed"

const SLOT_PLAYER := 0
const SLOT_ENEMY := 1
const SLOT_SPECTATOR := 2

const QUANT_POWER_FACTOR := 255.0
const QUANT_POWER_MIN := 0.35
const QUANT_POWER_RANGE := 0.65
const QUANT_HEIGHT_FACTOR := 255.0
const QUANT_DIR_FACTOR := 10.0
const QUANT_ANGLE_FACTOR := 127.0
const QUANT_CONTROL_FACTOR := 127.0

const FLAG_LAUNCH_READY := 1
const FLAG_DISCONNECTED := 2
const FLAG_INPUT_BOOST := 4
const FLAG_INPUT_BRAKE := 8


static func quantize_power(power: float) -> int:
	return int(clampf((power - QUANT_POWER_MIN) / QUANT_POWER_RANGE, 0.0, 1.0) * QUANT_POWER_FACTOR + 0.5)


static func dequantize_power(q: int) -> float:
	return QUANT_POWER_MIN + (float(q) / QUANT_POWER_FACTOR) * QUANT_POWER_RANGE


static func quantize_height(height: float) -> int:
	return int(clampf(height, 0.0, 1.0) * QUANT_HEIGHT_FACTOR + 0.5)


static func dequantize_height(q: int) -> float:
	return float(q) / QUANT_HEIGHT_FACTOR


static func quantize_direction(direction: float) -> int:
	var normalized := fposmod(direction + PI, TAU) - PI
	return int(normalized * QUANT_DIR_FACTOR + 0.5)


static func dequantize_direction(q: int) -> float:
	return float(q) / QUANT_DIR_FACTOR


static func quantize_angle(angle: float) -> int:
	return int(clampf(angle, -1.0, 1.0) * QUANT_ANGLE_FACTOR + 0.5)


static func dequantize_angle(q: int) -> float:
	return float(q) / QUANT_ANGLE_FACTOR


static func quantize_control(control: float) -> int:
	return int(clampf(control, -1.0, 1.0) * QUANT_CONTROL_FACTOR + 0.5)


static func dequantize_control(q: int) -> float:
	return float(q) / QUANT_CONTROL_FACTOR


static func quantize_vector2(v: Vector2) -> Dictionary:
	return {
		"x": quantize_control(v.x),
		"y": quantize_control(v.y)
	}


static func dequantize_vector2(d: Dictionary) -> Vector2:
	return Vector2(
		dequantize_control(int(d.get("x", 0))),
		dequantize_control(int(d.get("y", 0)))
	)


static func make_envelope(msg_type: String, data: Dictionary = {}, seq: int = -1, ack: int = -1) -> Dictionary:
	var env := {
		"type": msg_type,
		"data": data
	}
	if seq >= 0:
		env["seq"] = seq
	if ack >= 0:
		env["ack"] = ack
	return env


static func validate_launch_command(cmd: Dictionary) -> bool:
	if not cmd.has("power_q") or not cmd.has("height_q"):
		return false
	if not cmd.has("direction_q") or not cmd.has("angle_q"):
		return false
	var pq := int(cmd.power_q)
	var hq := int(cmd.height_q)
	var dq := int(cmd.direction_q)
	var aq := int(cmd.angle_q)
	if pq < 0 or pq > 255 or hq < 0 or hq > 255:
		return false
	if aq < -127 or aq > 127:
		return false
	return true


static func validate_input_frame(frame: Dictionary) -> bool:
	if not frame.has("frame") or not frame.has("slot"):
		return false
	if not frame.has("cx") or not frame.has("cy"):
		return false
	var cx := int(frame.cx)
	var cy := int(frame.cy)
	if cx < -127 or cx > 127 or cy < -127 or cy > 127:
		return false
	return true
