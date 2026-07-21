class_name LocalTransport
extends BattleTransport

var _peer_transport: LocalTransport
var _queue: Array[Dictionary] = []
var _connected := false


static func create_pair() -> Array[LocalTransport]:
	var a := LocalTransport.new()
	var b := LocalTransport.new()
	a._peer_transport = b
	b._peer_transport = a
	return [a, b]


func connect_to_room(url: String = "", ticket: Dictionary = {}) -> void:
	_connected = true
	emit_signal("connected")


func disconnect() -> void:
	_connected = false
	if _peer_transport and _peer_transport._connected:
		_peer_transport._disconnect_peer()
	emit_signal("disconnected")


func _disconnect_peer() -> void:
	_connected = false
	emit_signal("disconnected")


func is_connected() -> bool:
	return _connected


func send_message(msg: Dictionary) -> void:
	if not _connected or _peer_transport == null:
		return
	_peer_transport._queue.append(msg.duplicate(true))


func poll() -> void:
	while _queue.size() > 0:
		var msg := _queue.pop_front()
		emit_signal("message_received", msg)
