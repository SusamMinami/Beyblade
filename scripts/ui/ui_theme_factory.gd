class_name UiThemeFactory
extends RefCounted

const PAPER := Color(0.969, 0.953, 0.914, 1.0)
const WHITE := Color(1.0, 0.995, 0.975, 1.0)
const INK := Color(0.071, 0.082, 0.102, 1.0)
const MUTED_INK := Color(0.30, 0.34, 0.38, 1.0)
const BLUE := Color(0.137, 0.549, 1.0, 1.0)
const ORANGE := Color(0.957, 0.357, 0.165, 1.0)


static func create_graffiti_theme() -> Theme:
	var result := Theme.new()
	result.default_font_size = 18
	result.set_color("font_color", "Label", INK)
	result.set_color("font_shadow_color", "Label", Color(1.0, 1.0, 1.0, 0.42))
	result.set_constant("shadow_offset_x", "Label", 1)
	result.set_constant("shadow_offset_y", "Label", 1)

	var panel := _style(WHITE, INK, 3, 8)
	panel.shadow_color = Color(0.071, 0.082, 0.102, 0.92)
	panel.shadow_size = 4
	panel.shadow_offset = Vector2(4.0, 4.0)
	result.set_stylebox("panel", "Panel", panel)
	result.set_stylebox("panel", "PanelContainer", panel)

	var button_normal := _style(WHITE, INK, 2, 6)
	var button_hover := _style(Color(0.91, 0.96, 1.0, 1.0), INK, 3, 6)
	var button_pressed := _style(BLUE, INK, 3, 6)
	var button_disabled := _style(Color(0.86, 0.85, 0.81, 1.0), MUTED_INK, 2, 6)
	result.set_stylebox("normal", "Button", button_normal)
	result.set_stylebox("hover", "Button", button_hover)
	result.set_stylebox("pressed", "Button", button_pressed)
	result.set_stylebox("focus", "Button", button_hover)
	result.set_stylebox("disabled", "Button", button_disabled)
	result.set_color("font_color", "Button", INK)
	result.set_color("font_hover_color", "Button", INK)
	result.set_color("font_pressed_color", "Button", WHITE)
	result.set_color("font_disabled_color", "Button", MUTED_INK)
	result.set_font_size("font_size", "Button", 17)

	for state in ["normal", "hover", "pressed", "focus", "disabled"]:
		result.set_stylebox(state, "OptionButton", result.get_stylebox(state, "Button"))
	result.set_color("font_color", "OptionButton", INK)
	result.set_color("font_hover_color", "OptionButton", INK)
	result.set_color("font_pressed_color", "OptionButton", WHITE)
	result.set_font_size("font_size", "OptionButton", 17)
	return result


static func create_battle_theme(map_name: String) -> Theme:
	var palette := get_battle_palette(map_name)
	var result := Theme.new()
	result.default_font_size = 17
	var ink: Color = palette.ink
	var accent: Color = palette.accent
	var panel_color: Color = palette.panel

	result.set_color("font_color", "Label", ink)
	result.set_color("font_shadow_color", "Label", Color(0.0, 0.0, 0.0, 0.72))
	result.set_constant("shadow_offset_x", "Label", 1)
	result.set_constant("shadow_offset_y", "Label", 2)

	var panel := _style(panel_color, accent, 2, 10)
	panel.shadow_color = Color(0.0, 0.0, 0.0, 0.45)
	panel.shadow_size = 6
	result.set_stylebox("panel", "Panel", panel)
	result.set_stylebox("panel", "PanelContainer", panel)

	var button_normal := _style(panel_color.lightened(0.06), accent, 2, 8)
	var button_hover := _style(panel_color.lightened(0.13), accent, 3, 8)
	var button_pressed := _style(accent, accent, 2, 8)
	result.set_stylebox("normal", "Button", button_normal)
	result.set_stylebox("hover", "Button", button_hover)
	result.set_stylebox("pressed", "Button", button_pressed)
	result.set_stylebox("focus", "Button", button_hover)
	result.set_color("font_color", "Button", ink)
	result.set_color("font_hover_color", "Button", ink)
	result.set_color("font_pressed_color", "Button", Color(0.03, 0.05, 0.06, 1.0))
	return result


static func get_battle_palette(map_name: String) -> Dictionary:
	if map_name == "金属高速竞技场":
		return {
			"background": Color(0.025, 0.105, 0.145, 1.0),
			"arena": Color(0.16, 0.29, 0.34, 1.0),
			"center": Color(0.54, 0.83, 0.90, 1.0),
			"wall": Color(0.035, 0.16, 0.20, 1.0),
			"accent": Color(0.44, 0.91, 1.0, 1.0),
			"panel": Color(0.025, 0.12, 0.16, 0.9),
			"ink": Color(0.93, 0.98, 1.0, 1.0)
		}
	if map_name == "复合材质竞技场":
		return {
			"background": Color(0.25, 0.09, 0.07, 1.0),
			"arena": Color(0.10, 0.27, 0.24, 1.0),
			"center": Color(0.92, 0.42, 0.20, 1.0),
			"wall": Color(0.31, 0.10, 0.08, 1.0),
			"accent": Color(1.0, 0.46, 0.28, 1.0),
			"panel": Color(0.23, 0.09, 0.08, 0.9),
			"ink": Color(1.0, 0.96, 0.91, 1.0)
		}
	return {
		"background": Color(0.055, 0.20, 0.39, 1.0),
		"arena": Color(0.16, 0.28, 0.42, 1.0),
		"center": Color(0.94, 0.72, 0.18, 1.0),
		"wall": Color(0.04, 0.12, 0.24, 1.0),
		"accent": Color(1.0, 0.82, 0.25, 1.0),
		"panel": Color(0.045, 0.16, 0.31, 0.9),
		"ink": Color(0.97, 0.98, 1.0, 1.0)
	}


static func _style(
	background: Color,
	border: Color,
	border_width: int,
	corner_radius: int
) -> StyleBoxFlat:
	var result := StyleBoxFlat.new()
	result.bg_color = background
	result.border_color = border
	result.set_border_width_all(border_width)
	result.set_corner_radius_all(corner_radius)
	result.content_margin_left = 14.0
	result.content_margin_right = 14.0
	result.content_margin_top = 10.0
	result.content_margin_bottom = 10.0
	return result
