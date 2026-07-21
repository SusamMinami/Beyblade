class_name BattleStateHasher
extends RefCounted


static func compute_snapshot_hash(snapshot: Dictionary) -> String:
	var normalized := BattleStateCodec.normalize_snapshot(snapshot)
	var json_str := JSON.stringify(normalized)
	return _sha256_string(json_str)


static func compute_replay_hash(replay: Dictionary) -> String:
	var serialized := _serialize_for_hash(replay)
	return _sha256_string(serialized)


static func compute_manifest_hash(manifest: Dictionary) -> String:
	var json_str := JSON.stringify(manifest)
	return _sha256_string(json_str)


static func _sha256_string(input: String) -> String:
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	ctx.update(input.to_utf8_buffer())
	var hash_bytes := ctx.finish()
	return hash_bytes.hex_encode()


static func _serialize_for_hash(value: Variant) -> String:
	match typeof(value):
		TYPE_NIL:
			return "null"
		TYPE_BOOL:
			return "true" if value else "false"
		TYPE_INT:
			return "i:" + str(value)
		TYPE_FLOAT:
			return "f:" + str(value)
		TYPE_STRING:
			return "s:" + str(value.length()) + ":" + value
		TYPE_ARRAY:
			var arr_str := "a:"
			for item in (value as Array):
				arr_str += _serialize_for_hash(item) + ","
			return arr_str + ";"
		TYPE_DICTIONARY:
			var d: Dictionary = value
			var keys: Array = d.keys()
			keys.sort()
			var dict_str := "d:"
			for k in keys:
				dict_str += _serialize_for_hash(str(k)) + "=" + _serialize_for_hash(d[k]) + ","
			return dict_str + ";"
		_:
			return "?" + str(typeof(value))
