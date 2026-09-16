extends SceneTree

const LAB := preload("res://scenes/assembly/TestLabScreen.tscn")
var failures: Array[String] = []
var output := "res://.impeccable/review"
var assertions := 0


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	var screen := LAB.instantiate()
	root.add_child(screen)
	current_scene = screen
	await process_frame
	screen.set_process(false)
	for mesh in screen.stage.get_child(0).find_children("*", "MeshInstance3D", true, false):
		var material = mesh.get_active_material(0)
		var colors = mesh.mesh.surface_get_arrays(0)[Mesh.ARRAY_COLOR]
		if colors != null and not colors.is_empty():
			_expect(material.vertex_color_use_as_albedo, "Baked material colors enabled: " + mesh.name)
	var data: TopBuildData = screen.build_data
	_expect(data != null and data.is_valid(), "Active build is valid")
	_expect(screen.stage.top_model.customizations == root.get_node("GameState").get_active_loadout_customizations(),
		"Rendered specimen includes active DIY parameters")
	_expect(screen.wind_options.item_count == 3, "All wind presets remain available")
	_expect(screen.terrain_options.item_count == 4, "All terrain presets remain available")
	_expect(screen.values[0].text == "%.2f" % data.total_mass, "Readout uses calculator mass")
	_expect(not screen.result_label.text.contains("kg"), "No false SI mass label")
	_expect(screen.stage.specimen.scale.x > 0, "Specimen bounds fit the apparatus")

	if DisplayServer.get_name() != "headless":
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output))
		root.size = Vector2i(720, 1280)
		await _capture("desktop.png")
		root.size = Vector2i(390, 693)
		await _capture("phone.png")
		root.size = Vector2i(720, 1280)
	screen._select_mode(1)
	_expect(screen.stage.center_marker.visible, "Center-of-mass marker visible in CG mode")
	_expect(screen.stage.center_marker.position == data.center_of_mass, "CG uses rule-space coordinates")
	var before: float = screen.stage.specimen.rotation.y
	await process_frame
	await process_frame
	_expect(screen.stage.specimen.rotation.y != before, "Specimen animates")
	screen.start_test()
	_expect(screen.testing and screen.start_button.disabled, "Measurement enters busy state")
	_expect(screen.wind_options.disabled and screen.mode_buttons[0].disabled,
		"Input is frozen during a measurement")
	screen._process(1.2)
	_expect(is_equal_approx(screen.readout_progress.value, 50), "Sweep reports progress")
	if DisplayServer.get_name() != "headless":
		await _capture("scanning.png")
	screen._process(1.3)
	_expect(screen.test_complete and not screen.testing, "Measurement completes")
	_expect(not screen.start_button.disabled and not screen.wind_options.disabled,
		"Inputs recover after a measurement")
	screen._select_mode(2)
	screen.wind_options.select(2)
	screen.terrain_options.select(3)
	screen._on_option_changed(3)
	_expect(not screen.test_complete, "Preset changes invalidate completion")
	_expect(screen.values[0].text == "%.0f" % screen._environment_stability_score("强逆风", "砂砾扰动"),
		"Environment scores retain existing rules")
	_expect(screen.build_data.total_mass == data.total_mass, "Visual state does not alter physics")
	screen._show_details()
	_expect(screen.detail_layer.visible, "Details open")
	if DisplayServer.get_name() != "headless":
		await _capture("details.png")
	screen._hide_details()
	_expect(not screen.detail_layer.visible, "Details close")
	var state := root.get_node("GameState")
	var original_tutorial: Dictionary = state.tutorial.duplicate(true)
	state.tutorial.completed = true
	screen._on_back_button_pressed()
	await scene_changed
	_expect(current_scene != null and current_scene.scene_file_path == "res://scenes/assembly/AssemblyScreen.tscn",
		"Back returns to the assembly scene")
	state.tutorial = original_tutorial
	if current_scene != null:
		current_scene.free()
	if failures.is_empty():
		print("PASS: test_lab scene smoke checks (%d assertions)" % assertions)
	else:
		for failure in failures:
			push_error(failure)
	quit(0 if failures.is_empty() else 1)


func _capture(filename: String) -> void:
	await process_frame
	await process_frame
	await RenderingServer.frame_post_draw
	var image := root.get_texture().get_image()
	_expect(not image.is_empty(), "Viewport produces pixels")
	var error := image.save_png(output.path_join(filename))
	_expect(error == OK, "Capture saved: " + filename)
	print("CAPTURE: ", filename, " ", image.get_size())


func _expect(condition: bool, message: String) -> void:
	assertions += 1
	if not condition:
		failures.append(message)
