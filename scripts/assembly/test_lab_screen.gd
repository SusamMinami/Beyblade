extends Control

const LAB_STAGE := preload("res://scripts/assembly/test_lab_stage.gd")
const INK := Color("#172b30")
const CYAN := Color("#75efdc")
const MUTED := Color("#486268")
const TEST_DURATION := 2.4

var build_data: TopBuildData
var stage: Node3D
var wind_options: OptionButton
var terrain_options: OptionButton
var result_label: Label
var mode := 0
var test_elapsed := 0.0
var testing := false
var test_complete := false
var start_button: Button
var slot_label: Label
var detail_layer: Control
var detail_button: Button
var detail_close: Button
var readout_title: Label
var readout_status: Label
var readout_note: Label
var readout_progress: ProgressBar
var values: Array[Label] = []
var captions: Array[Label] = []
var mode_buttons: Array[Button] = []
var slot_buttons: Array[Button] = []


func _ready() -> void:
	theme = _create_theme()
	_create_scene()
	_create_interface()
	_create_readout()
	_populate_options()
	_load_specimen()


func _create_scene() -> void:
	var container := SubViewportContainer.new()
	container.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	container.stretch = true
	container.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(container)
	var viewport := SubViewport.new()
	viewport.size = Vector2i(720, 1280)
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	viewport.msaa_3d = Viewport.MSAA_4X
	viewport.own_world_3d = true
	container.add_child(viewport)
	stage = Node3D.new()
	stage.set_script(LAB_STAGE)
	viewport.add_child(stage)


func _create_interface() -> void:
	var title := _label(self, "陀螺测试实验室", Rect2(28, 28, 650, 54), 38, Color("#f4fafa"))
	var subtitle := _label(self, "TOP TEST LAB", Rect2(30, 84, 460, 30), 21, Color("#e1eeed"))
	slot_label = _label(self, "", Rect2(30, 127, 454, 32), 20, Color("#f4fafa"))
	for label in [title, subtitle, slot_label]:
		label.add_theme_color_override("font_shadow_color", Color(0.03, 0.08, 0.09, 0.8))
		label.add_theme_constant_override("shadow_offset_y", 2)
	for i in range(3):
		var button := _button(self, "%02d" % (i + 1), Rect2(526 + i * 56, 119, 48, 48))
		button.tooltip_text = "切换出战槽 %d" % (i + 1)
		button.pressed.connect(_select_slot.bind(i))
		slot_buttons.append(button)

	var footer := Panel.new()
	footer.add_theme_stylebox_override("panel", _style(Color("#d4dddd"), Color("#a1b3b5"), 0))
	_place(self, footer, Rect2(0, 954, 720, 326))
	var rule := ColorRect.new()
	rule.color = Color("#9aafb1")
	_place(self, rule, Rect2(28, 954, 664, 1))
	var modes := ["质量 / 惯量", "质心检测", "环境估算"]
	for i in range(modes.size()):
		var button := _button(self, modes[i], Rect2(28 + i * 224, 974, 216, 52))
		button.pressed.connect(_select_mode.bind(i))
		mode_buttons.append(button)

	start_button = _button(self, "开始检测", Rect2(28, 1042, 664, 64))
	start_button.add_theme_font_size_override("font_size", 28)
	_set_button_palette(start_button, Color("#d6e936"), INK)
	start_button.pressed.connect(start_test)
	_label(self, "风力", Rect2(28, 1129, 48, 42), 18, MUTED)
	wind_options = OptionButton.new()
	_place(self, wind_options, Rect2(82, 1123, 190, 48))
	_label(self, "地面", Rect2(294, 1129, 48, 42), 18, MUTED)
	terrain_options = OptionButton.new()
	_place(self, terrain_options, Rect2(348, 1123, 344, 48))
	wind_options.item_selected.connect(_on_option_changed)
	terrain_options.item_selected.connect(_on_option_changed)
	var back := _button(self, "返回改装", Rect2(28, 1198, 204, 52))
	back.pressed.connect(_on_back_button_pressed)
	_label(self, "配置估算 · 非实物测量", Rect2(238, 1209, 270, 32), 18, MUTED)
	detail_button = _button(self, "参数明细", Rect2(520, 1198, 172, 52))
	detail_button.pressed.connect(_show_details)
	_create_details()


func _create_readout() -> void:
	var viewport := SubViewport.new()
	viewport.size = Vector2i(960, 480)
	viewport.disable_3d = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(viewport)
	var screen := ColorRect.new()
	screen.color = Color("#102e34")
	screen.size = Vector2(960, 480)
	viewport.add_child(screen)
	var border := Panel.new()
	border.add_theme_stylebox_override("panel", _style(Color("#102e34"), Color("#386e70"), 8))
	_place(screen, border, Rect2(12, 12, 936, 456))
	readout_title = _label(screen, "", Rect2(40, 26, 880, 72), 48, CYAN)
	readout_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var divider := ColorRect.new()
	divider.color = Color("#30585b")
	_place(screen, divider, Rect2(55, 109, 850, 2))
	for i in range(2):
		var caption := _label(screen, "", Rect2(50 + i * 450, 129, 410, 50), 34, Color("#a5c9c8"))
		caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		captions.append(caption)
		var value := _label(screen, "", Rect2(50 + i * 450, 174, 410, 121), 94, CYAN)
		value.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		values.append(value)
	var vertical := ColorRect.new()
	vertical.color = Color("#30585b")
	_place(screen, vertical, Rect2(480, 149, 2, 134))
	readout_note = _label(screen, "", Rect2(40, 308, 880, 42), 30, Color("#a5c9c8"))
	readout_note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	readout_status = _label(screen, "", Rect2(40, 376, 880, 48), 34, CYAN)
	readout_status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	readout_progress = ProgressBar.new()
	readout_progress.show_percentage = false
	readout_progress.add_theme_stylebox_override("background", _style(Color("#204348"), Color.TRANSPARENT, 0))
	readout_progress.add_theme_stylebox_override("fill", _style(CYAN, Color.TRANSPARENT, 0))
	_place(screen, readout_progress, Rect2(54, 440, 852, 5))
	stage.set_display_texture(viewport.get_texture())


func _create_details() -> void:
	detail_layer = Control.new()
	detail_layer.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(detail_layer)
	var scrim := ColorRect.new()
	scrim.color = Color(0.03, 0.07, 0.08, 0.8)
	scrim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	detail_layer.add_child(scrim)
	var panel := Panel.new()
	panel.add_theme_stylebox_override("panel", _style(Color("#e1e9e8"), Color("#91abad"), 8))
	_place(detail_layer, panel, Rect2(32, 176, 656, 914))
	_label(panel, "当前配置参数", Rect2(30, 24, 596, 52), 30, INK)
	result_label = _label(panel, "", Rect2(30, 98, 596, 695), 23, INK)
	result_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	detail_close = _button(panel, "关闭明细", Rect2(30, 827, 596, 56))
	detail_close.pressed.connect(_hide_details)
	detail_close.focus_next = detail_close.get_path()
	detail_close.focus_previous = detail_close.get_path()
	detail_layer.hide()


func _load_specimen() -> void:
	build_data = _game_state().get_build_data()
	stage.configure(_game_state(), build_data)
	var loadout: Dictionary = _game_state().get_active_loadout()
	slot_label.text = "当前样本 / %s" % loadout.name
	for i in range(slot_buttons.size()):
		_set_button_palette(slot_buttons[i],
			Color("#24474d") if i == _game_state().active_loadout_index else Color("#e1e9e8"),
			Color("#b9f9eb") if i == _game_state().active_loadout_index else INK)
	_reset_test()
	_update_result()


func _game_state():
	return get_node("/root/GameState")


func _populate_options() -> void:
	_add_options(wind_options, ["无风", "侧风", "强逆风"])
	_add_options(terrain_options, ["标准地面", "低摩擦金属", "高摩擦橡胶", "砂砾扰动"])


func _add_options(option_button: OptionButton, items: Array[String]) -> void:
	option_button.clear()
	for item in items:
		option_button.add_item(item)


func _on_option_changed(_index: int) -> void:
	_reset_test()
	_update_result()


func _update_result() -> void:
	_update_modes()
	if build_data == null or not build_data.is_valid():
		result_label.text = "当前组装数据无效，请返回设计页重新选择零件。"
		readout_title.text = "样本数据无效"
		readout_status.text = "请返回改装台检查零件"
		for value in values:
			value.text = "--"
		start_button.disabled = true
		return

	var wind := wind_options.get_item_text(wind_options.selected)
	var terrain := terrain_options.get_item_text(terrain_options.selected)
	var stability_score := _environment_stability_score(wind, terrain)
	var control_score := _environment_control_score(terrain)
	match mode:
		0:
			readout_title.text = "质量 · 转动惯量"
			captions[0].text = "总质量"
			captions[1].text = "轴向惯量"
			values[0].text = "%.2f" % build_data.total_mass
			values[1].text = "%.3f" % build_data.moment_of_inertia
			readout_note.text = "平衡质量单位 / 轴向惯量单位"
		1:
			readout_title.text = "质心 · 轴向偏心"
			captions[0].text = "质心 Y"
			captions[1].text = "径向偏心"
			values[0].text = "%.4f" % build_data.center_of_mass.y
			values[1].text = "%.4f" % Vector2(build_data.center_of_mass.x, build_data.center_of_mass.z).length()
			readout_note.text = "规则空间坐标 · 黄色标记为质心"
		2:
			readout_title.text = "环境 · 稳定性估算"
			captions[0].text = "稳定性 / 100"
			captions[1].text = "控制响应 / 100"
			values[0].text = "%.0f" % stability_score
			values[1].text = "%.0f" % control_score
			readout_note.text = "%s / %s" % [wind, terrain]
	readout_status.text = "检测完成 · 配置估算" if test_complete else "样本就绪 · 等待检测"
	result_label.text = (
		"%s\n\n"
		+ "总质量：%.2f    轴向惯量：%.3f\n"
		+ "质心 X / Y / Z：%.4f / %.4f / %.4f\n"
		+ "摩擦：%.2f    回弹：%.2f\n"
		+ "转速衰减：%.2f/s\n"
		+ "攻击：%.2f    耐久：%.0f\n\n"
		+ "风力：%s    地面：%s\n"
		+ "稳定性估算：%.0f/100\n"
		+ "控制响应估算：%.0f/100\n\n"
		+ "数值采用游戏平衡单位，非实物 SI 测量。"
	) % [
		_game_state().get_build_summary(), build_data.total_mass, build_data.moment_of_inertia,
		build_data.center_of_mass.x, build_data.center_of_mass.y, build_data.center_of_mass.z,
		build_data.friction, build_data.restitution, build_data.spin_decay_per_second,
		build_data.attack_power, build_data.durability, wind, terrain, stability_score, control_score
	]


func _select_mode(index: int) -> void:
	mode = index
	stage.set_center_visible(mode == 1)
	_reset_test()
	_update_result()


func _select_slot(index: int) -> void:
	if testing:
		return
	_game_state().set_active_loadout_index(index)
	_load_specimen()


func _update_modes() -> void:
	for i in range(mode_buttons.size()):
		_set_button_palette(mode_buttons[i],
			Color("#24474d") if i == mode else Color("#e8eeed"),
			CYAN if i == mode else INK)


func start_test() -> void:
	if testing or build_data == null or not build_data.is_valid():
		return
	testing = true
	test_complete = false
	test_elapsed = 0.0
	stage.scanning = true
	start_button.disabled = true
	wind_options.disabled = true
	terrain_options.disabled = true
	for button in slot_buttons + mode_buttons:
		button.disabled = true
	for value in values:
		value.text = "--"


func _process(delta: float) -> void:
	if not testing:
		return
	test_elapsed += delta
	var progress := minf(test_elapsed / TEST_DURATION, 1.0)
	readout_progress.value = progress * 100.0
	start_button.text = "检测中  %02d%%" % int(progress * 100)
	readout_status.text = "扫描样本 · %02d%%" % int(progress * 100)
	if progress >= 1.0:
		_reset_test()
		test_complete = true
		readout_progress.value = 100
		start_button.text = "重新检测"
		_update_result()


func _reset_test() -> void:
	testing = false
	test_complete = false
	stage.scanning = false
	start_button.disabled = false
	start_button.text = "开始检测"
	wind_options.disabled = false
	terrain_options.disabled = false
	readout_progress.value = 0
	for button in slot_buttons + mode_buttons:
		button.disabled = false


func _show_details() -> void:
	detail_layer.show()
	detail_close.grab_focus()


func _hide_details() -> void:
	detail_layer.hide()
	detail_button.grab_focus()


func _unhandled_key_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel") and detail_layer.visible:
		_hide_details()
		get_viewport().set_input_as_handled()


func _environment_stability_score(wind: String, terrain: String) -> float:
	var score := build_data.stability * 75.0
	if wind == "侧风":
		score -= 8.0
	elif wind == "强逆风":
		score -= 15.0
	if terrain == "砂砾扰动":
		score -= 18.0
	elif terrain == "低摩擦金属":
		score -= 5.0
	elif terrain == "高摩擦橡胶":
		score += 6.0
	return clampf(score, 0.0, 100.0)


func _environment_control_score(terrain: String) -> float:
	var score := build_data.control_response * 65.0
	if terrain == "高摩擦橡胶":
		score += 12.0
	elif terrain == "低摩擦金属":
		score -= 16.0
	return clampf(score, 0.0, 100.0)


func _on_back_button_pressed() -> void:
	get_tree().change_scene_to_file("res://scenes/assembly/AssemblyScreen.tscn")


func _place(parent: Node, control: Control, rect: Rect2) -> void:
	parent.add_child(control)
	control.position = rect.position
	control.size = rect.size
	if control is Label or control is Panel:
		control.mouse_filter = Control.MOUSE_FILTER_IGNORE


func _label(parent: Node, text: String, rect: Rect2, font_size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = text
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_color", color)
	_place(parent, label, rect)
	return label


func _button(parent: Node, text: String, rect: Rect2) -> Button:
	var button := Button.new()
	button.text = text
	_place(parent, button, rect)
	return button


func _style(background: Color, border: Color, radius: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = background
	style.border_color = border
	style.set_border_width_all(1)
	style.set_corner_radius_all(radius)
	return style


func _set_button_palette(button: Button, background: Color, foreground: Color) -> void:
	button.add_theme_stylebox_override("normal", _style(background, background.darkened(0.2), 6))
	button.add_theme_stylebox_override("hover", _style(background.lightened(0.12), Color("#238b81"), 6))
	button.add_theme_stylebox_override("pressed", _style(background.darkened(0.10), Color("#238b81"), 6))
	for state in ["font_color", "font_hover_color", "font_pressed_color"]:
		button.add_theme_color_override(state, foreground)


func _create_theme() -> Theme:
	var result := Theme.new()
	result.default_font_size = 21
	for type in ["Button", "OptionButton"]:
		result.set_stylebox("normal", type, _style(Color("#e8eeed"), Color("#98adaf"), 6))
		result.set_stylebox("hover", type, _style(Color("#f4fffa"), Color("#238b81"), 6))
		result.set_stylebox("pressed", type, _style(Color("#bce0d9"), Color("#238b81"), 6))
		result.set_stylebox("disabled", type, _style(Color("#bac8c8"), Color("#98adaf"), 6))
		var focus := _style(Color.TRANSPARENT, Color("#007e73"), 6)
		focus.set_border_width_all(3)
		result.set_stylebox("focus", type, focus)
		for state in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
			result.set_color(state, type, INK)
		result.set_color("font_disabled_color", type, Color("#486268"))
	result.set_stylebox("panel", "PopupMenu", _style(Color("#e8eeed"), Color("#98adaf"), 6))
	result.set_stylebox("hover", "PopupMenu", _style(Color("#c0e7db"), Color("#238b81"), 3))
	result.set_color("font_color", "PopupMenu", INK)
	result.set_color("font_hover_color", "PopupMenu", INK)
	result.set_constant("v_separation", "PopupMenu", 16)
	return result
