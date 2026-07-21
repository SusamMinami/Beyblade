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


static func _pack_utf8(str: String) -> PackedByteArray:
	var raw := str.to_utf8_buffer()
	var out := PackedByteArray()
	out.resize(1 + raw.size())
	out[0] = raw.size()
	for i in range(raw.size()):
		out[1 + i] = raw[i]
	return out


static func _unpack_utf8(buf: PackedByteArray, offset: int) -> Array:
	var n := buf[offset]
	var start := offset + 1
	var s := buf.slice(start, start + n).get_string_from_utf8()
	return [s, start + n]


static fnv1a_hash(str: String) -> String:
	var h: int = 0x811c9dc5
	for i in range(str.length()):
		h = h ^ str.unicode_at(i)
		h = (h * 0x01000193) & 0xffffffff
	return "%08x" % h


static func encode_binary_welcome(slot: int, seed: int, arena_id: String, server_time: int) -> PackedByteArray:
	var arena_bytes := arena_id.to_utf8_buffer()
	var sim_bytes := BattleProtocol.SIMULATION_VERSION.to_utf8_buffer()
	var size := 1 + 1 + 1 + 1 + sim_bytes.size() + 4 + 1 + arena_bytes.size() + 4
	var buf := PackedByteArray()
	buf.resize(size)
	var w := StreamPeerBuffer.new()
	w.big_endian = true
	w.data_array = buf
	w.put_u8(BattleProtocol.MSG_WELCOME)
	w.put_u8(slot)
	w.put_u8(BattleProtocol.PROTOCOL_VERSION)
	w.put_u8(sim_bytes.size())
	for b in sim_bytes:
		w.put_u8(b)
	w.put_u32(seed)
	w.put_u8(arena_bytes.size())
	for b in arena_bytes:
		w.put_u8(b)
	w.put_u32(server_time)
	return w.data_array


static func encode_binary_error(code: int, msg_str: String) -> PackedByteArray:
	var mb := msg_str.to_utf8_buffer()
	var buf := PackedByteArray()
	buf.resize(1 + 2 + 1 + mb.size())
	var w := StreamPeerBuffer.new()
	w.big_endian = true
	w.data_array = buf
	w.put_u8(BattleProtocol.MSG_ERROR)
	w.put_16(code)
	w.put_u8(mb.size())
	for b in mb:
		w.put_u8(b)
	return w.data_array


static func encode_binary_launch_window(window_ms: int, seed: int, arena_id: String) -> PackedByteArray:
	var ab := arena_id.to_utf8_buffer()
	var buf := PackedByteArray()
	buf.resize(1 + 2 + 4 + 1 + ab.size())
	var w := StreamPeerBuffer.new()
	w.big_endian = true
	w.data_array = buf
	w.put_u8(BattleProtocol.MSG_LAUNCH_WINDOW)
	w.put_u16(window_ms)
	w.put_u32(seed)
	w.put_u8(ab.size())
	for b in ab:
		w.put_u8(b)
	return w.data_array


static func encode_binary_launch_both(own_cmd: Dictionary, opp_cmd: Dictionary) -> PackedByteArray:
	var buf := PackedByteArray()
	buf.resize(1 + 4 + 4)
	var w := StreamPeerBuffer.new()
	w.big_endian = true
	w.data_array = buf
	w.put_u8(BattleProtocol.MSG_LAUNCH_BOTH)
	w.put_u8(int(own_cmd.power_q) & 0xff)
	w.put_u8(int(own_cmd.height_q) & 0xff)
	w.put_8(int(own_cmd.direction_q))
	w.put_8(int(own_cmd.angle_q))
	w.put_u8(int(opp_cmd.power_q) & 0xff)
	w.put_u8(int(opp_cmd.height_q) & 0xff)
	w.put_8(int(opp_cmd.direction_q))
	w.put_8(int(opp_cmd.angle_q))
	return w.data_array


static func encode_binary_input_batch(frames: Array, _sender_slot: int = -1) -> PackedByteArray:
	var count := min(frames.size(), BattleProtocol.INPUT_BATCH_MAX)
	var payload_size := 1
	var chunks: Array = []
	var last_cx := 0
	var last_cy := 0
	var last_fl := 0
	for i in range(count):
		var f := frames[i]
		var cx := int(f.get("cx", 0))
		var cy := int(f.get("cy", 0))
		var fl := int(f.get("fl", f.get("flags", 0))) & BattleProtocol.FRAME_FLAGS_MASK
		var fn := int(f.get("f", 0))
		var is_delta := cx == last_cx and cy == last_cy and fl == last_fl and chunks.size() > 0
		if not is_delta:
			last_cx = cx
			last_cy = cy
			last_fl = fl
		chunks.append({"delta": is_delta, "f": fn, "cx": last_cx, "cy": last_cy, "fl": last_fl})
		payload_size += 3 if is_delta else 5
	var total := 1 + payload_size
	var buf := PackedByteArray()
	buf.resize(total)
	var w := StreamPeerBuffer.new()
	w.big_endian = true
	w.data_array = buf
	w.put_u8(BattleProtocol.MSG_INPUT)
	w.put_u8(count & 0xff)
	for ch in chunks:
		var hdr: int = ch.fl & BattleProtocol.FRAME_FLAGS_MASK
		if ch.delta:
			hdr = hdr | BattleProtocol.FRAME_FLAG_DELTA
		w.put_u8(hdr)
		w.put_u16(ch.f & 0xffff)
		if not ch.delta:
			w.put_8(ch.cx)
			w.put_8(ch.cy)
	return w.data_array


static func encode_binary_ping() -> PackedByteArray:
	var buf := PackedByteArray()
	buf.resize(1)
	buf[0] = BattleProtocol.MSG_PING
	return buf


static func encode_binary_pong() -> PackedByteArray:
	var buf := PackedByteArray()
	buf.resize(1)
	buf[0] = BattleProtocol.MSG_PONG
	return buf


static func encode_binary_ready(slot: int) -> PackedByteArray:
	var buf := PackedByteArray()
	buf.resize(2)
	buf[0] = BattleProtocol.MSG_READY
	buf[1] = slot & 0xff
	return buf


static func encode_binary_hello() -> PackedByteArray:
	var sv := BattleProtocol.SIMULATION_VERSION.to_utf8_buffer()
	var buf := PackedByteArray()
	buf.resize(1 + 1 + 1 + 1 + sv.size() + 1)
	var w := StreamPeerBuffer.new()
	w.big_endian = true
	w.data_array = buf
	w.put_u8(BattleProtocol.MSG_HELLO)
	w.put_u8(BattleProtocol.PROTOCOL_VERSION)
	w.put_u8(sv.size())
	for b in sv:
		w.put_u8(b)
	w.put_u8(0)
	return w.data_array


static func encode_binary_launch(power_q: int, height_q: int, direction_q: int, angle_q: int) -> PackedByteArray:
	var buf := PackedByteArray()
	buf.resize(1 + 4)
	var w := StreamPeerBuffer.new()
	w.big_endian = true
	w.data_array = buf
	w.put_u8(BattleProtocol.MSG_LAUNCH)
	w.put_u8(power_q & 0xff)
	w.put_u8(height_q & 0xff)
	w.put_8(direction_q)
	w.put_8(angle_q)
	return w.data_array


static func encode_binary_hash_check(frame: int, hash_str: String) -> PackedByteArray:
	var hb := hash_str.to_utf8_buffer()
	var buf := PackedByteArray()
	buf.resize(1 + 2 + 1 + hb.size())
	var w := StreamPeerBuffer.new()
	w.big_endian = true
	w.data_array = buf
	w.put_u8(BattleProtocol.MSG_HASH_CHECK)
	w.put_u16(frame & 0xffff)
	w.put_u8(hb.size())
	for b in hb:
		w.put_u8(b)
	return w.data_array


static func decode_binary_message(packet: PackedByteArray) -> Dictionary:
	if packet.size() < 1:
		return {}
	var r := StreamPeerBuffer.new()
	r.big_endian = true
	r.data_array = packet
	var type_id := r.get_u8()
	var data := {}
	match type_id:
		BattleProtocol.MSG_WELCOME:
			if packet.size() < 3:
				return {}
			var w_slot := r.get_u8()
			var w_proto := r.get_u8()
			var sv_len := r.get_u8()
			var sv_bytes := r.get_data(sv_len)[1]
			var w_sv := sv_bytes.get_string_from_utf8()
			var w_seed := r.get_u32()
			var alen := r.get_u8()
			var a_bytes := r.get_data(alen)[1]
			var w_arena := a_bytes.get_string_from_utf8()
			var w_time := r.get_u32()
			data = {
				"slot": w_slot,
				"protocol_version": w_proto,
				"simulation_version": w_sv,
				"seed": w_seed,
				"arena_id": w_arena,
				"server_time": w_time,
			}
		BattleProtocol.MSG_ERROR:
			if packet.size() < 4:
				return {}
			var e_code := r.get_16()
			var elen := r.get_u8()
			var ebytes := r.get_data(elen)[1]
			data = {"code": e_code, "message": ebytes.get_string_from_utf8()}
		BattleProtocol.MSG_LAUNCH_WINDOW:
			if packet.size() < 8:
				return {}
			var lw_window := r.get_u16()
			var lw_seed := r.get_u32()
			var lw_alen := r.get_u8()
			var lw_ab := r.get_data(lw_alen)[1]
			data = {"window_ms": lw_window, "seed": lw_seed, "arena_id": lw_ab.get_string_from_utf8()}
		BattleProtocol.MSG_LAUNCH_BOTH:
			if packet.size() < 9:
				return {}
			var lb_p_p := r.get_u8()
			var lb_p_h := r.get_u8()
			var lb_p_d := r.get_8()
			var lb_p_a := r.get_8()
			var lb_e_p := r.get_u8()
			var lb_e_h := r.get_u8()
			var lb_e_d := r.get_8()
			var lb_e_a := r.get_8()
			data = {
				"player": {"p": lb_p_p, "h": lb_p_h, "d": lb_p_d, "a": lb_p_a},
				"enemy": {"p": lb_e_p, "h": lb_e_h, "d": lb_e_d, "a": lb_e_a},
			}
		BattleProtocol.MSG_INPUT_BATCH:
			if packet.size() < 3:
				return {}
			var ib_count := r.get_u8()
			var sender_slot := r.get_u8()
			var frames_arr: Array = []
			var fc := 0
			var icx := 0
			var icy := 0
			var ifl := 0
			while fc < ib_count and r.get_available_bytes() >= 3:
				var ihdr := r.get_u8()
				var idelta := (ihdr & BattleProtocol.FRAME_FLAG_DELTA) != 0
				var iflags := ihdr & BattleProtocol.FRAME_FLAGS_MASK
				var ifn := r.get_u16()
				if not idelta:
					if r.get_available_bytes() < 2:
						break
					icx = r.get_8()
					icy = r.get_8()
					ifl = iflags
				frames_arr.append({"f": ifn, "s": sender_slot, "cx": icx, "cy": icy, "fl": ifl})
				fc += 1
			data = {"frames": frames_arr, "sender_slot": sender_slot}
		BattleProtocol.MSG_RESULT:
			if packet.size() < 3:
				return {}
			var r_winner := r.get_8()
			var rlen := r.get_u8()
			var rbytes := r.get_data(rlen)[1]
			data = {"winner": r_winner, "reason": rbytes.get_string_from_utf8()}
		BattleProtocol.MSG_ROOM_STATE:
			if packet.size() < 3:
				return {}
			var rs_started := r.get_u8() != 0
			var rs_finished := r.get_u8() != 0
			var players_arr: Array = [null, null]
			for pslot in range(2):
				if r.get_available_bytes() < 1:
					break
				var present := r.get_u8()
				if present != 0:
					if r.get_available_bytes() < 2:
						break
					var ready := r.get_u8() != 0
					var nlen := r.get_u8()
					if r.get_available_bytes() < nlen:
						break
					var nb := r.get_data(nlen)[1]
					players_arr[pslot] = {"name": nb.get_string_from_utf8(), "ready": ready}
			data = {"started": rs_started, "finished": rs_finished, "players": players_arr}
		BattleProtocol.MSG_PING:
			data = {}
		BattleProtocol.MSG_PONG:
			data = {}
		BattleProtocol.MSG_HASH_CHECK:
			if packet.size() < 4:
				return {}
			var hc_frame := r.get_u16()
			var hlen := r.get_u8()
			var hbytes := r.get_data(hlen)[1]
			data = {"frame": hc_frame, "hash": hbytes.get_string_from_utf8()}
		BattleProtocol.MSG_REPLAY_ACK:
			if packet.size() < 3:
				return {}
			var ra_acc := r.get_u8() != 0
			var rlen2 := r.get_u8()
			var rbytes2 := r.get_data(rlen2)[1]
			var rid := rbytes2.get_string_from_utf8()
			var err_str := ""
			if r.get_available_bytes() >= 1:
				var elen2 := r.get_u8()
				if elen2 > 0 and r.get_available_bytes() >= elen2:
					err_str = r.get_data(elen2)[1].get_string_from_utf8()
			data = {"accepted": ra_acc, "replay_id": rid, "error": err_str}
		_:
			return {}
	return {"type": type_id, "data": data}


static func _round6(v: float) -> float:
	return roundf(v * 1000000.0) / 1000000.0


static func _round4(v: float) -> float:
	return roundf(v * 10000.0) / 10000.0
