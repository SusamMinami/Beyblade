class_name WebSocketTransport
extends BattleTransport

var _ws: WebSocketPeer
var _url: String = ""
var _ticket: Dictionary = {}
var _seq: int = 0
var _poll_interval := 0.0
var _heartbeat_timer := 0.0
var _heartbeat_interval := 5.0
var _last_poll_time := 0


func _init() -> void:
	_ws = WebSocketPeer.new()


func connect_to_room(url: String, ticket: Dictionary = {}) -> void:
	_url = url
	_ticket = ticket
	var headers: PackedStringArray = []
	if ticket.has("token"):
		headers.append("Authorization: Bearer " + str(ticket.token))
	if ticket.has("room_id"):
		headers.append("X-Room-Id: " + str(ticket.room_id))
	var err := _ws.connect_to_url(url, headers)
	if err != OK:
		emit_signal("error_occurred", err, "Failed to connect to " + url)
		return


func disconnect() -> void:
	_ws.close()


func is_connected() -> bool:
	return _ws.get_ready_state() == WebSocketPeer.STATE_OPEN


func send_message(msg: Dictionary) -> void:
	if not is_connected():
		return
	_seq += 1
	if msg.has("_binary") and msg["_binary"] is PackedByteArray:
		_ws.send(msg["_binary"], WebSocketPeer.WRITE_MODE_BINARY)
	elif msg.has("_text"):
		_ws.send_text(str(msg["_text"]))
	else:
		var payload: PackedByteArray = msg.get("payload", PackedByteArray())
		_ws.send(payload, WebSocketPeer.WRITE_MODE_BINARY)


func send_binary(data: PackedByteArray) -> void:
	if is_connected():
		_seq += 1
		_ws.send(data, WebSocketPeer.WRITE_MODE_BINARY)


func poll(delta: float = -1.0) -> void:
	if _ws.get_ready_state() == WebSocketPeer.STATE_CLOSED:
		emit_signal("disconnected")
		return
	_ws.poll()
	var dt := delta
	if dt < 0.0:
		var now := OS.get_ticks_msec()
		if _last_poll_time == 0:
			_last_poll_time = now
		dt = float(now - _last_poll_time) / 1000.0
		_last_poll_time = now
	match _ws.get_ready_state():
		WebSocketPeer.STATE_OPEN:
			_heartbeat_timer += dt
			if _heartbeat_timer >= _heartbeat_interval:
				_heartbeat_timer = 0.0
				send_binary(BattleStateCodec.encode_binary_ping())
			_drain_messages()
		WebSocketPeer.STATE_CONNECTING:
			pass
		WebSocketPeer.STATE_CLOSED:
			emit_signal("disconnected")


func _drain_messages() -> void:
	while _ws.get_available_packet_count() > 0:
		var packet := _ws.get_packet()
		if packet.size() < 1:
			continue
		var first_byte := packet[0]
		var msg: Dictionary = {}
		if first_byte == ord('{') or first_byte == ord('['):
			var parsed: Variant = JSON.parse_string(packet.get_string_from_utf8())
			if parsed is Dictionary:
				msg = parsed as Dictionary
		else:
			msg = BattleStateCodec.decode_binary_message(packet)
		if msg.is_empty():
			continue
		var type_val: Variant = msg.get("type", "")
		if type_val == BattleProtocol.MSG_PONG or (type_val is String and type_val == "pong"):
			continue
		emit_signal("message_received", msg)
