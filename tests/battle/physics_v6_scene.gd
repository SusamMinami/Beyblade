extends SceneTree

const SCREEN = preload("res://scenes/battle/BattleScreen.tscn")
const MAPS = preload("res://scripts/maps/arena_map_catalog.gd")
const SESSION = preload("res://scripts/battle/battle_session.gd")
const VIEW = preload("res://scripts/battle/v6_presentation.gd")
const D = preload("res://scripts/battle/v6_data.gd")
const P = preload("res://scripts/battle/v6_dynamics.gd")
const FRAME_SYNC = preload("res://scripts/network/frame_sync_provider.gd")
const ASYNC = preload("res://scripts/network/async_verify_provider.gd")
var failures: Array = []
var checks = 0
var capture = false
var folder = "res://.impeccable/review/physics-v6/"

func _initialize() -> void:
	capture = "--capture" in OS.get_cmdline_user_args()
	call_deferred("_run")

func check(condition: bool, label: String) -> void:
	checks += 1
	if not condition: failures.append(label)

func capture_screen(label: String) -> void:
	if not capture: return
	await process_frame
	await RenderingServer.frame_post_draw
	var error = root.get_texture().get_image().save_png(folder+"godot-"+label+".png")
	check(error==OK,"render capture "+label)

func _run() -> void:
	var game = root.get_node("GameState")
	game.save_path = "res://.godot/physics_v6_scene.cfg"
	game.sound_enabled = false
	var build = game.get_build_data()
	var outcomes = []
	for hz in [30,60,120]:
		var session = SESSION.create_local_ai_battle(build,build,MAPS.get_all()[0],42)
		session.submit_launch(.86,.45,0,.2)
		session.set_local_input(Vector2(.2,-.3))
		for i in hz*3: session.poll(1.0/hz)
		outcomes.append(session.sim.export_state())
		check(session.sim.frame==180,"fixed frames at "+str(hz)+" Hz")
		var replay = JSON.parse_string(JSON.stringify(session.local_replay,"",true,true))
		var copy = SESSION.create_local_ai_battle(build,build,MAPS.get_all()[0],42)
		check(copy.restore_local_state(replay.initial),"session restore "+str(hz))
		for input in replay.inputs:
			copy.sim.core.step(1.0/60,input.player,input.enemy)
		check(copy.sim.core.equivalent(copy.sim.export_state(),session.sim.export_state()),"local replay "+str(hz))
	check(outcomes[0]==outcomes[1] and outcomes[1]==outcomes[2],"30/60/120 identical full states")

	for map in MAPS.get_all():
		game.selected_map = map.map_name
		var screen = SCREEN.instantiate()
		root.add_child(screen)
		await process_frame
		screen.set_process(false)
		screen.paused = false
		check(screen.simulation.core.arena.id==str(map.map_id),"native scene map "+str(map.map_id))
		check(screen.arena_terrain.get_node("Boundary").get_child_count()==0,"no obsolete high wall "+str(map.map_id))
		for child in screen.map_features.get_children():
			if child.has_meta("zone_id"):
				var arrays = child.mesh.surface_get_arrays(0)
				for v in arrays[Mesh.ARRAY_VERTEX]:
					if absf(v.y-map.get_height_at(v)-.016)>.00001:
						check(false,"zone follows slope "+str(map.map_id))
						break
		check(screen.map_features.get_child_count()==3+map.blockers.size(),"zones and blockers "+str(map.map_id))
		screen._on_launch_button_pressed()
		for i in 90: screen._advance_simulation(1.0/60)
		screen._sync_battle_visuals(0)
		screen._update_camera(1)
		screen._update_hud()
		screen._update_drive_zones()
		check(screen.simulation.frame>0,"scene advances "+str(map.map_id))
		check("RPM" in screen.spin_label.text and str(roundi(screen.simulation.player.spin*60/TAU)) in screen.spin_label.text,"RPM conversion "+str(map.map_id))
		var state = screen.simulation.player.data
		var support = screen.beyblade.global_position-screen.beyblade.basis*Vector3(0,state.structure.contactOffset*.92,0)
		var expected_y = state.edge.height-state.edge.drop if state.edge.falling else map.get_height_at(Vector3(state.position.x,0,state.position.y))
		check(support.distance_to(Vector3(state.position.x,expected_y+.012,state.position.y))<1e-5,"tip anchored "+str(map.map_id))
		if str(map.map_id) in ["standard","ruins"]:
			await capture_screen(str(map.map_id)+"running")

		if map.map_id==&"standard":
			await check_controls(screen)
			await check_draw(screen,game)
			check_pose(screen)
			check_network_guards(screen)
		if map.map_id==&"ruins":
			screen._prepare_for_launch()
			screen._on_launch_button_pressed()
			screen.simulation.player.position = Vector2(map.wall_radius+.01,0)
			screen.simulation.player.velocity = Vector2(.1,0)
			for i in 18: screen._advance_simulation(1.0/60)
			check(screen.simulation.result.reason=="ring_out","scene open edge settles ring out")
			check(screen.simulation.player.data.edge.falling,"scene falling state")
			screen._sync_battle_visuals(0)
			await capture_screen("ringout")
		screen.free()
		await process_frame
	# Real model bounds, not just duplicated constants.
	game.selected_map = MAPS.get_all()[0].map_name
	var screen = SCREEN.instantiate()
	root.add_child(screen)
	await process_frame
	screen.set_process(false)
	for tip in ["tip.rubber_balance","tip.metal_stamina","tip.flat_attack"]:
		for height in [.72,1,1.35]:
			var model = screen.beyblade.visual_model
			model.configure(build.attack_ring.part_id,build.core_lock.part_id,build.weight_disc.part_id,
				build.driver_shaft.part_id,tip,Color.WHITE,Color.WHITE,{tip:{"height":height}})
			model.set_active_part(-1)
			var custom_build = AssemblyCalculator.calculate_by_ids(build.attack_ring.part_id,build.core_lock.part_id,
				build.weight_disc.part_id,build.driver_shaft.part_id,tip,{tip:{"height":height}})
			var expected = P.structure(D.build_data(custom_build)).contactOffset
			var minimum = 100.0
			for mesh in model.tip_root.get_children():
				if not mesh is MeshInstance3D: continue
				var box: AABB = mesh.mesh.get_aabb()
				for corner in 8:
					var local: Vector3 = model.tip_root.transform*(mesh.transform*box.get_endpoint(corner))
					minimum = minf(minimum,local.y)
			check(absf(-minimum-expected)<1e-6,"mesh bottom "+tip+"/"+str(height))
	screen.free()
	await process_frame
	if FileAccess.file_exists(game.save_path): DirAccess.remove_absolute(game.save_path)
	for failure in failures: printerr(failure)
	print("V6 scene checks: ",checks," failures: ",failures.size())
	var file = FileAccess.open(folder+("godot-render.json" if capture else "godot-scene-v6.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify({"checks":checks,"capture":capture,"failures":failures},"\t"))
	quit(0 if failures.is_empty() else 1)

func check_controls(screen) -> void:
	for yaw in [0,PI/2,PI,-PI/2]:
		screen.camera_yaw = yaw
		screen._update_camera(1)
		screen.joystick_vector = Vector2(.8,-.3)
		var world: Vector2 = screen._get_control_vector()
		var actual := VIEW.world_to_screen(screen.camera,world)
		check(actual.distance_to(screen.joystick_vector)<1e-6,"camera control "+str(yaw))
	screen.joystick_dragging = true
	var release := InputEventMouseButton.new()
	release.button_index = MOUSE_BUTTON_LEFT
	release.pressed = false
	screen._input(release)
	check(screen.joystick_vector==Vector2.ZERO and not screen.joystick_dragging,"release outside control")
	var before: int = screen.simulation.frame
	screen._on_pause_button_pressed()
	screen._advance_simulation(1)
	check(screen.simulation.frame==before and screen.session._local_input==Vector2.ZERO,"pause clears input and time")
	screen._on_pause_button_pressed()
	screen._advance_simulation(1.0/120)
	check(screen.simulation.frame==before,"resume no accumulated burst")
	screen._notification(Node.NOTIFICATION_WM_WINDOW_FOCUS_OUT)
	check(screen.paused and screen.joystick_vector==Vector2.ZERO,"focus loss pauses")
	screen._on_pause_button_pressed()
	screen.camera_yaw = 0

func check_draw(screen, game) -> void:
	screen._prepare_for_launch()
	screen._on_launch_button_pressed()
	var coins = game.coins
	var tutorial = game.tutorial.duplicate(true)
	screen.simulation.player.spin = 0
	screen.simulation.enemy.spin = 0
	screen._advance_simulation(1.0/60)
	check(screen.simulation.result.winner=="draw","scene simultaneous draw")
	check("平局" in screen.result_label.text,"draw label")
	check(game.coins==coins and game.tutorial==tutorial,"draw no loss settlement or tutorial advancement")
	await capture_screen("draw")

func check_pose(screen) -> void:
	var data: Dictionary = screen.simulation.player.data.duplicate(true)
	data.tilt = .4
	data.tiltVector = D.vec(.4,0)
	var expected := Vector3(sin(.4),cos(.4),0)
	for i in 24:
		data.spinPhase = TAU*i/24.0
		check(VIEW.pose(data).y.distance_to(expected)<1e-6,"tilt axis independent of spin "+str(i))

func check_network_guards(screen) -> void:
	var frame = FRAME_SYNC.new(screen.simulation,null,0)
	frame.start()
	check(frame.phase==BattleProtocol.PHASE_CLOSED,"old frame sync rejected")
	var async_provider = ASYNC.new(screen.simulation)
	async_provider.start()
	async_provider.submit_launch(.86,.45,0,0)
	check(async_provider.phase==BattleProtocol.PHASE_CLOSED and not async_provider.launch_submitted,"old async verifier rejected")
