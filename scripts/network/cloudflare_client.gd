class_name CloudflareClient
extends RefCounted

var base_url: String
var _http: HTTPRequest


func _init(api_base: String) -> void:
	base_url = api_base.rstrip("/")
	_http = HTTPRequest.new()


func create_room() -> Dictionary:
	var result := _post("/api/create-room", {})
	if result is Dictionary:
		return result
	return {"error": "request failed"}


func enqueue_match(player_id: String, name: String, rank: String = "bronze", rating: int = 1000, mode: String = "frame_sync") -> Dictionary:
	var result := _post("/api/match/enqueue", {
		"player_id": player_id,
		"name": name,
		"rank": rank,
		"rating": rating,
		"mode": mode
	})
	if result is Dictionary:
		return result
	return {"error": "request failed"}


func submit_replay(replay: Dictionary) -> Dictionary:
	var result := _post("/api/submit-replay", replay)
	if result is Dictionary:
		return result
	return {"error": "request failed"}


func health_check() -> Dictionary:
	return _get("/health")


func get_room_ws_url(room_id: String) -> String:
	var ws_base := base_url.replace("https://", "wss://").replace("http://", "ws://")
	return ws_base + "/room/" + room_id + "/ws"


func _get(path: String) -> Dictionary:
	return _request("GET", path, "")


func _post(path: String, body: Dictionary) -> Dictionary:
	var json_str := JSON.stringify(body)
	return _request("POST", path, json_str)


func _request(method: String, path: String, body: String) -> Dictionary:
	var http := HTTPRequest.new()
	var root := Engine.get_main_loop() as SceneTree
	if root:
		root.root.add_child(http)
	var url := base_url + path
	var headers: PackedStringArray = ["Content-Type: application/json"]
	var err := http.request(url, headers, HTTPClient.METHOD_GET if method == "GET" else HTTPClient.METHOD_POST, body)
	if err != OK:
		if http.get_parent():
			http.queue_free()
		return {"error": "http request error: " + str(err)}
	var completed := false
	var response_code := 0
	var response_body := ""
	http.request_completed.connect(func(result: int, code: int, _headers: PackedStringArray, resp_body: PackedByteArray) -> void:
		response_code = code
		response_body = resp_body.get_string_from_utf8()
		completed = true
	)
	var timeout := 10.0
	var elapsed := 0.0
	while not completed and elapsed < timeout:
		OS.delay_msec(50)
		elapsed += 0.05
		if root:
			root.process_frame()
	http.queue_free()
	if response_code != 200:
		return {"error": "HTTP " + str(response_code), "body": response_body}
	var parsed: Variant = JSON.parse_string(response_body)
	if parsed is Dictionary:
		return parsed as Dictionary
	return {"raw": response_body}
