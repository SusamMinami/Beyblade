class_name BattleTransport
extends RefCounted

signal connected
signal disconnected
signal message_received(msg: Dictionary)
signal error_occurred(code: int, message: String)


func connect_to_room(url: String, ticket: Dictionary = {}) -> void:
	push_error("BattleTransport.connect_to_room must be overridden")


func close_connection() -> void:
	push_error("BattleTransport.close_connection must be overridden")


func is_room_connected() -> bool:
	return false


func send_message(msg: Dictionary) -> void:
	push_error("BattleTransport.send_message must be overridden")


func poll() -> void:
	pass
