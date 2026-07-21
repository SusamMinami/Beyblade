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
	msg["seq"] = _seq
	var json_str := JSON.stringify(msg)
	_ws.send_text(json_str)


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
				send_message(BattleProtocol.make_envelope(BattleProtocol.MSG_PING))
			_drain_messages()
		WebSocketPeer.STATE_CONNECTING:
			pass
		WebSocketPeer.STATE_CLOSED:
			emit_signal("disconnected")


func _drain_messages() -> void:
	while _ws.get_available_packet_count() > 0:
		var packet := _ws.get_packet()
		var packet_str := packet.get_string_from_utf8()
		var parsed: Variant = JSON.parse_string(packet_str)
		if parsed is Dictionary:
			var msg: Dictionary = parsed as Dictionary
			if msg.get("type", "") == BattleProtocol.MSG_PONG:
				continue
			emit_signal("message_received", msg)
