class_name BattleStateCodec
extends RefCounted


static func normalize_snapshot(raw: Dictionary) -> Dictionary:
	var normalized := {}
	normalized["phase"] = str(raw.get("phase", "ready"))
	normalized["frame"] = int(raw.get("frame", 0))
	normalized["time"] = _round6(float(raw.get("time", 0.0)))
	if raw.has("result") and raw.result is Dictionary:
		var r: Dictionary = raw.result
		normalized["result"] = {
			"winner": str(r.get("winner", "")),
			"reason": str(r.get("reason", "")),
			"time": _round6(float(r.get("time", 0.0)))
		}
	else:
		normalized["result"] = null
	normalized["player"] = _normalize_top(raw.get("player", {}))
	normalized["enemy"] = _normalize_top(raw.get("enemy", {}))
	return normalized


static func _normalize_top(raw: Dictionary) -> Dictionary:
	var pos: Variant = raw.get("position", Vector2.ZERO)
	var vel: Variant = raw.get("velocity", Vector2.ZERO)
	var pos_x := 0.0
	var pos_y := 0.0
	var vel_x := 0.0
	var vel_y := 0.0
	if pos is Vector2:
		pos_x = pos.x
		pos_y = pos.y
	elif pos is Dictionary:
		pos_x = float(pos.get("x", 0.0))
		pos_y = float(pos.get("y", 0.0))
	if vel is Vector2:
		vel_x = vel.x
		vel_y = vel.y
	elif vel is Dictionary:
		vel_x = float(vel.get("x", 0.0))
		vel_y = float(vel.get("y", 0.0))
	return {
		"px": _round6(pos_x),
		"py": _round6(pos_y),
		"vx": _round6(vel_x),
		"vy": _round6(vel_y),
		"sp": _round4(float(raw.get("spin", 0.0))),
		"du": _round4(float(raw.get("durability", 0.0))),
		"ti": _round4(float(raw.get("tilt", 0.0))),
		"im": _round4(float(raw.get("imbalance", 0.0))),
		"sl": _round4(float(raw.get("spin_loss_rate", 0.0))),
		"rr": _round4(float(raw.get("ring_out_risk", 0.0))),
		"ss": str(raw.get("stability_state", "stable")),
		"rs": str(raw.get("ring_risk_state", "safe")),
		"sr": str(raw.get("spin_risk_state", "safe")),
		"ci": _round4(float(raw.get("control_influence", 0.0)))
	}


static func encode_to_json(snapshot: Dictionary) -> String:
	var normalized := normalize_snapshot(snapshot)
	return JSON.stringify(normalized, "\t")


static func decode_from_json(json_str: String) -> Dictionary:
	var parsed: Variant = JSON.parse_string(json_str)
	if parsed == null or not parsed is Dictionary:
		return {}
	return _denormalize(parsed as Dictionary)


static func _denormalize(n: Dictionary) -> Dictionary:
	var snap := {
		"phase": StringName(n.get("phase", "ready")),
		"frame": int(n.get("frame", 0)),
		"time": float(n.get("time", 0.0))
	}
	if n.get("result") is Dictionary:
		var r: Dictionary = n.result
		snap["result"] = {
			"winner": StringName(r.get("winner", "")),
			"reason": StringName(r.get("reason", "")),
			"time": float(r.get("time", 0.0))
		}
	else:
		snap["result"] = {}
	snap["player"] = _denormalize_top(n.get("player", {}))
	snap["enemy"] = _denormalize_top(n.get("enemy", {}))
	return snap


static func _denormalize_top(d: Dictionary) -> Dictionary:
	return {
		"position": Vector2(float(d.get("px", 0.0)), float(d.get("py", 0.0))),
		"velocity": Vector2(float(d.get("vx", 0.0)), float(d.get("vy", 0.0))),
		"spin": float(d.get("sp", 0.0)),
		"durability": float(d.get("du", 0.0)),
		"tilt": float(d.get("ti", 0.0)),
		"imbalance": float(d.get("im", 0.0)),
		"spin_loss_rate": float(d.get("sl", 0.0)),
		"ring_out_risk": float(d.get("rr", 0.0)),
		"stability_state": StringName(d.get("ss", "stable")),
		"ring_risk_state": StringName(d.get("rs", "safe")),
		"spin_risk_state": StringName(d.get("sr", "safe")),
		"control_influence": float(d.get("ci", 0.0))
	}


static func encode_input_frame(frame: Dictionary) -> Dictionary:
	return {
		"f": int(frame.frame),
		"s": int(frame.slot),
		"sq": int(frame.get("seq", 0)),
		"cx": int(frame.cx),
		"cy": int(frame.cy),
		"fl": int(frame.get("flags", 0))
	}


static func decode_input_frame(d: Dictionary) -> Dictionary:
	return {
		"frame": int(d.get("f", 0)),
		"slot": int(d.get("s", 0)),
		"seq": int(d.get("sq", 0)),
		"cx": int(d.get("cx", 0)),
		"cy": int(d.get("cy", 0)),
		"flags": int(d.get("fl", 0))
	}


static func encode_launch_command(cmd: Dictionary) -> Dictionary:
	return {
		"s": int(cmd.slot),
		"p": int(cmd.power_q),
		"h": int(cmd.height_q),
		"d": int(cmd.direction_q),
		"a": int(cmd.angle_q)
	}


static func decode_launch_command(d: Dictionary) -> Dictionary:
	return {
		"slot": int(d.get("s", 0)),
		"power_q": int(d.get("p", 0)),
		"height_q": int(d.get("h", 0)),
		"direction_q": int(d.get("d", 0)),
		"angle_q": int(d.get("a", 0))
	}


static func _round6(v: float) -> float:
	return roundf(v * 1000000.0) / 1000000.0


static func _round4(v: float) -> float:
	return roundf(v * 10000.0) / 10000.0
