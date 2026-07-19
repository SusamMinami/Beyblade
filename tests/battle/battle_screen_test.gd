extends SceneTree

const BATTLE_SCREEN_SCENE := preload(
	"res://scenes/battle/BattleScreen.tscn"
)
const TEST_SAVE_PATH := "res://.godot/battle_screen_test.cfg"

var _failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var game_state = root.get_node("/root/GameState")
	var original_save_path: String = game_state.save_path
	var original_coins: int = game_state.coins
	game_state.save_path = TEST_SAVE_PATH

	var screen := BATTLE_SCREEN_SCENE.instantiate()
	root.add_child(screen)
	await process_frame

	_expect(
		screen.get_node_or_null("%EnemyBeyblade") != null,
		"战斗场景必须包含 AI 陀螺"
	)
	_expect(
		screen.get_node_or_null("%LaunchPowerSlider") != null,
		"战斗场景必须提供发射力度"
	)
	_expect(
		screen.get_node_or_null("%LaunchDirectionSlider") != null,
		"战斗场景必须提供发射方向"
	)
	_expect(
		screen.get_node_or_null("%LaunchAngleSlider") != null,
		"战斗场景必须提供入场倾角"
	)
	_expect(
		screen.get_node_or_null("%TuningPanel") != null,
		"战斗场景必须提供实时调参面板"
	)
	_expect(
		screen.get_node_or_null("%SoundButton") != null,
		"战斗场景必须提供声音开关"
	)

	var simulation = screen.get("simulation")
	_expect(simulation != null, "战斗场景必须初始化确定性模拟")
	if simulation != null:
		screen.call("_set_tuning_value", "damage_scale", 1.4)
		_expect(
			is_equal_approx(float(simulation.tuning.damage_scale), 1.4),
			"实时调参必须立即作用于当前模拟"
		)
		screen.call("_on_launch_button_pressed")
		simulation = screen.get("simulation")
		_expect(simulation.phase == &"running", "点击发射必须开始模拟")

		var enemy = simulation.enemy
		enemy.spin = 0.0
		screen.call("_advance_simulation", 1.0 / 60.0)
		simulation = screen.get("simulation")
		_expect(simulation.phase == &"finished", "AI 停转必须结束战斗")
		_expect(
			simulation.result.winner == &"player",
			"AI 停转必须判定玩家胜利"
		)

		var result_panel := screen.get_node_or_null("%ResultPanel") as Control
		_expect(
			result_panel != null and result_panel.visible,
			"战斗结束必须显示结算面板"
		)
		var result_label := screen.get_node_or_null("%ResultLabel") as Label
		_expect(
			result_label != null and "停转胜利" in result_label.text,
			"结算面板必须显示具体胜利方式"
		)

	screen.free()
	await process_frame
	game_state.coins = original_coins
	game_state.save_path = original_save_path
	if FileAccess.file_exists(TEST_SAVE_PATH):
		DirAccess.remove_absolute(
			ProjectSettings.globalize_path(TEST_SAVE_PATH)
		)
	_finish()


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("PASS: battle_screen_test")
		quit(0)
		return
	for failure in _failures:
		push_error(failure)
	quit(1)
