class_name BattleProtocol
extends RefCounted

const PROTOCOL_VERSION := 2
const SIMULATION_VERSION := "2026.07.21-bin"
const FIXED_STEP_HZ := 60
const FIXED_DT := 1.0 / float(FIXED_STEP_HZ)

const INPUT_BATCH_SIZE := 6
const HASH_CHECK_INTERVAL := 60
const INPUT_BATCH_MAX := 24

const SEND_RATE_HIGH_HZ := 10.0
const SEND_RATE_MID_HZ := 5.0
const SEND_RATE_LOW_HZ := 2.0
const SEND_RATE_IDLE_HZ := 1.0

const FRAME_FLAG_DELTA := 0x80
const FRAME_FLAGS_MASK := 0x3F
const FLAG_INPUT_BOOST := 4
const FLAG_INPUT_BRAKE := 8

const MSG_HELLO := 0x01
const MSG_WELCOME := 0x02
const MSG_READY := 0x03
const MSG_LAUNCH_WINDOW := 0x04
const MSG_LAUNCH := 0x05
const MSG_LAUNCH_BOTH := 0x06
const MSG_INPUT := 0x07
const MSG_INPUT_BATCH := 0x08
const MSG_HASH_CHECK := 0x09
const MSG_RESULT := 0x0A
const MSG_ERROR := 0x0B
const MSG_PING := 0x0C
const MSG_PONG := 0x0D
const MSG_REPLAY_SUBMIT := 0x0E
const MSG_REPLAY_ACK := 0x0F
const MSG_ROOM_STATE := 0x10
const MSG_MATCH_FOUND := 0x11

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


static func msg_type_to_string(type_id: int) -> String:
	match type_id:
		MSG_HELLO: return "hello"
		MSG_WELCOME: return "welcome"
		MSG_READY: return "ready"
		MSG_LAUNCH_WINDOW: return "launch_window"
		MSG_LAUNCH: return "launch"
		MSG_LAUNCH_BOTH: return "launch_both"
		MSG_INPUT: return "input"
		MSG_INPUT_BATCH: return "input_batch"
		MSG_HASH_CHECK: return "hash_check"
		MSG_RESULT: return "result"
		MSG_ERROR: return "error"
		MSG_PING: return "ping"
		MSG_PONG: return "pong"
		MSG_REPLAY_SUBMIT: return "replay_submit"
		MSG_REPLAY_ACK: return "replay_ack"
		MSG_ROOM_STATE: return "room_state"
		MSG_MATCH_FOUND: return "match_found"
	return "unknown"


static func validate_launch_command(cmd: Dictionary) -> bool:
	if not cmd.has("p") or not cmd.has("h"):
		return false
	if not cmd.has("d") or not cmd.has("a"):
		return false
	var pq := int(cmd.p)
	var hq := int(cmd.h)
	var aq := int(cmd.a)
	if pq < 0 or pq > 255 or hq < 0 or hq > 255:
		return false
	if aq < -127 or aq > 127:
		return false
	return true


static func validate_input_frame(frame: Dictionary) -> bool:
	if not frame.has("f") or not frame.has("cx") or not frame.has("cy"):
		return false
	var cx := int(frame.cx)
	var cy := int(frame.cy)
	if cx < -127 or cx > 127 or cy < -127 or cy > 127:
		return false
	return true


static func compute_intensity_level(sim: Object) -> int:
	if sim == null or sim.phase != &"running":
		return 3
	if not sim is RefCounted and not sim is Node:
		return 1
	var p_state: Variant = sim.get("player")
	var e_state: Variant = sim.get("enemy")
	if p_state == null or e_state == null:
		return 1
	var p_spin := float(p_state.get("spin", 0.0))
	var e_spin := float(e_state.get("spin", 0.0))
	var p_pos: Variant = p_state.get("position", Vector2.ZERO)
	var e_pos: Variant = e_state.get("position", Vector2.ZERO)
	var dist := 0.0
	if p_pos is Vector2 and e_pos is Vector2:
		dist = p_pos.distance_to(e_pos)
	var min_spin := minf(p_spin, e_spin)
	var max_spin_initial := 25.0
	var spin_ratio := clampf(min_spin / max_spin_initial, 0.0, 1.0)
	if spin_ratio > 0.5 and dist < 3.0:
		return 0
	elif spin_ratio > 0.25 and dist < 6.0:
		return 1
	elif spin_ratio > 0.1:
		return 2
	else:
		return 3


static func send_rate_for_level(level: int) -> float:
	match level:
		0: return SEND_RATE_HIGH_HZ
		1: return SEND_RATE_MID_HZ
		2: return SEND_RATE_LOW_HZ
		_: return SEND_RATE_IDLE_HZ
