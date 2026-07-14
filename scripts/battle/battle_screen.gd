extends Control

@onready var battle_summary_label: Label = %BattleSummaryLabel
@onready var battle_log_label: Label = %BattleLogLabel

func _ready() -> void:
	battle_summary_label.text = "战斗配置\n%s" % GameState.get_battle_summary()
	battle_log_label.text = "MVP 战斗界面已就绪。\n下一步会接入发射参数、陀螺刚体和地形物理采样。"


func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/maps/MapSelectScreen.tscn")


func _on_restart_button_pressed() -> void:
	battle_log_label.text = "回合已重置。\n当前仍是界面原型，后续会生成可战斗陀螺。"
