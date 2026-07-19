extends SceneTree

const MAP_SELECT_SCENE := preload(
	"res://scenes/maps/MapSelectScreen.tscn"
)

var _failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var game_state = root.get_node("/root/GameState")
	var original_map: String = game_state.selected_map
	game_state.selected_map = "复合材质竞技场"

	var screen := MAP_SELECT_SCENE.instantiate()
	root.add_child(screen)
	await process_frame
	var options := screen.get_node("%MapOptions") as OptionButton
	_expect(
		options.get_item_text(options.selected) == "复合材质竞技场",
		"地图选择页必须恢复已保存地图"
	)

	screen.free()
	game_state.selected_map = original_map
	await process_frame
	_finish()


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("PASS: map_select_screen_test")
		quit(0)
		return
	for failure in _failures:
		push_error(failure)
	quit(1)
