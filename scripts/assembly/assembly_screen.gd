extends Control

@onready var ring_options: OptionButton = %RingOptions
@onready var weight_options: OptionButton = %WeightOptions
@onready var tip_options: OptionButton = %TipOptions
@onready var summary_label: Label = %SummaryLabel

func _ready() -> void:
	_populate_options()
	_update_summary()


func _populate_options() -> void:
	_add_options(ring_options, ["平衡外圈", "重击外圈", "轻量续航外圈"])
	_add_options(weight_options, ["标准配重", "重型配重", "偏心攻击配重"])
	_add_options(tip_options, ["橡胶平衡尖", "金属续航尖", "攻击扁平尖"])


func _add_options(option_button: OptionButton, items: Array[String]) -> void:
	option_button.clear()
	for item in items:
		option_button.add_item(item)


func _on_option_changed(_index: int) -> void:
	_update_summary()


func _update_summary() -> void:
	var ring := ring_options.get_item_text(ring_options.selected)
	var weight := weight_options.get_item_text(weight_options.selected)
	var tip := tip_options.get_item_text(tip_options.selected)
	summary_label.text = "当前组装\n外圈：%s\n配重：%s\n底尖：%s" % [ring, weight, tip]


func _on_next_button_pressed() -> void:
	GameState.set_build(
		ring_options.get_item_text(ring_options.selected),
		weight_options.get_item_text(weight_options.selected),
		tip_options.get_item_text(tip_options.selected)
	)
	get_tree().change_scene_to_file("res://scenes/maps/MapSelectScreen.tscn")
