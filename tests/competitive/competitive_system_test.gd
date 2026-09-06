extends SceneTree

const COMPETITIVE_PROFILE := preload(
	"res://scripts/competitive/competitive_profile.gd"
)
const GAME_STATE_SCRIPT := preload("res://scripts/core/game_state.gd")
const REGIONAL_MODELS := preload(
	"res://scripts/competitive/regional_competition_models.gd"
)

var _failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _run() -> void:
	_test_practice_unlock_rules()
	_test_regional_model_privacy_and_normalization()
	_test_local_battle_result_records_selected_map()
	_test_competitive_state_persistence()
	_test_v2_save_migration()
	_finish()


func _test_practice_unlock_rules() -> void:
	var profile := COMPETITIVE_PROFILE.create_default()
	_expect(
		not COMPETITIVE_PROFILE.is_competitive_unlocked(profile),
		"新玩家不能直接解锁排位赛"
	)
	profile = COMPETITIVE_PROFILE.record_practice_result(
		profile,
		"standard",
		true,
		100
	)
	profile = COMPETITIVE_PROFILE.record_practice_result(
		profile,
		"metal",
		true,
		110
	)
	profile = COMPETITIVE_PROFILE.record_practice_result(
		profile,
		"composite",
		false,
		120
	)
	_expect(
		not COMPETITIVE_PROFILE.is_competitive_unlocked(profile),
		"练习地图失败不能计入三图解锁"
	)
	profile = COMPETITIVE_PROFILE.record_practice_result(
		profile,
		"composite",
		true,
		130
	)
	_expect(
		COMPETITIVE_PROFILE.is_competitive_unlocked(profile),
		"三张练习地图各胜一场后必须解锁排位和地区入口"
	)
	_expect(
		int(profile.practice.completed_at) == 130,
		"必须记录首次完成三图练习的时间"
	)


func _test_regional_model_privacy_and_normalization() -> void:
	var location := REGIONAL_MODELS.normalize_location({
		"region_id": "cn-zj-hz-xh",
		"country_code": "cn",
		"admin_area_1": "浙江省",
		"locality": "杭州市",
		"spatial_cell": "cell_12030_3019",
		"has_public_position": true,
		"public_latitude": 30.19,
		"public_longitude": 120.30,
		"display_radius_m": 500,
		"raw_latitude": 30.193847,
		"raw_longitude": 120.301982,
		"accuracy_m": 8.0
	})
	_expect(location.country_code == "CN", "国家代码必须标准化为大写")
	_expect(
		not location.has("raw_latitude")
		and not location.has("raw_longitude")
		and not location.has("accuracy_m"),
		"地区位置模型不得保留原始 GPS 坐标或定位精度"
	)

	var arena := REGIONAL_MODELS.normalize_arena({
		"arena_id": "arena-hz-001",
		"region_id": "cn-zj-hz-xh",
		"owner_player_id": "player-1",
		"name": "西湖擂台",
		"location": location,
		"battle_map_id": "unknown",
		"status": "invalid",
		"server_revision": 4
	})
	_expect(
		arena.battle_map_id == "standard",
		"地区擂台必须回退到有效战斗地图"
	)
	_expect(arena.status == "active", "无效擂台状态必须回退为 active")


func _test_local_battle_result_records_selected_map() -> void:
	var save_path := (
		"res://.godot/competitive_battle_result_test_%d.cfg"
		% Time.get_ticks_usec()
	)
	var state = GAME_STATE_SCRIPT.new()
	state.save_path = save_path
	state.set_map("金属高速竞技场")
	state.apply_battle_result(true)
	_expect(
		state.get_practice_wins("metal") == 1,
		"本地战斗胜利必须记录到当前练习地图"
	)
	_expect(
		state.get_practice_wins("standard") == 0,
		"当前地图胜利不能污染其他练习地图"
	)
	_cleanup(save_path)
	state.free()


func _test_competitive_state_persistence() -> void:
	var save_path := (
		"res://.godot/competitive_state_test_%d.cfg"
		% Time.get_ticks_usec()
	)
	var source = GAME_STATE_SCRIPT.new()
	source.save_path = save_path
	source.record_practice_result("standard", true, 100)
	source.record_practice_result("metal", true, 110)
	source.record_practice_result("composite", true, 130)
	_expect(source.is_competitive_unlocked(), "GameState 必须暴露竞技入口解锁状态")

	_expect(
		source.apply_ranked_server_snapshot({
			"season_id": "s1",
			"tier_id": "silver",
			"division": 2,
			"rating": 1280,
			"peak_rating": 1310,
			"wins": 12,
			"losses": 8,
			"placement_matches_remaining": 0,
			"server_revision": 7,
			"last_synced_at": 200
		}),
		"较新的排位快照必须被接受"
	)
	_expect(
		not source.apply_ranked_server_snapshot({
			"tier_id": "bronze",
			"rating": 900,
			"server_revision": 6
		}),
		"旧版排位快照不得覆盖较新的本地缓存"
	)
	_expect(
		source.apply_regional_profile_server_snapshot({
			"eligible": true,
			"eligibility_reason": "eligible",
			"required_tier_id": "silver",
			"home_region": {
				"region_id": "cn-zj-hz-xh",
				"country_code": "CN",
				"locality": "杭州市",
				"spatial_cell": "cell_12030_3019",
				"has_public_position": true,
				"public_latitude": 30.19,
				"public_longitude": 120.30,
				"display_radius_m": 500
			},
			"owned_arena_ids": ["arena-hz-001"],
			"champion_arena_ids": ["arena-hz-001"],
			"medals": [{
				"medal_id": "medal-hz-s1",
				"season_id": "s1",
				"region_id": "cn-zj-hz-xh",
				"arena_id": "arena-hz-001",
				"holder_player_id": "player-1",
				"title": "西湖区擂王",
				"awarded_at": 300,
				"active": true
			}],
			"server_revision": 3,
			"last_synced_at": 310
		}),
		"地区资格与奖牌快照必须可缓存"
	)
	_expect(
		source.apply_regional_cache_server_snapshot({
			"query_region_id": "cn-zj-hz-xh",
			"arenas": [{
				"arena_id": "arena-hz-001",
				"region_id": "cn-zj-hz-xh",
				"owner_player_id": "player-1",
				"name": "西湖擂台",
				"battle_map_id": "metal",
				"status": "active",
				"server_revision": 2
			}],
			"challenges": [{
				"challenge_id": "challenge-001",
				"arena_id": "arena-hz-001",
				"challenger_player_id": "player-2",
				"defender_player_id": "player-1",
				"status": "queued",
				"best_of": 3,
				"server_revision": 1
			}],
			"server_revision": 5,
			"last_synced_at": 320
		}),
		"附近擂台和挑战快照必须可缓存"
	)

	_expect(source.save_state() == OK, "竞技状态必须能够写入 v3 存档")
	var restored = GAME_STATE_SCRIPT.new()
	restored.save_path = save_path
	_expect(restored.load_state() == OK, "竞技状态必须能够从 v3 存档恢复")
	_expect(restored.is_competitive_unlocked(), "必须恢复三图解锁状态")
	_expect(
		restored.get_ranked_profile().rating == 1280,
		"必须恢复排位服务端快照"
	)
	_expect(
		restored.get_regional_profile().medals.size() == 1,
		"必须恢复地区奖牌缓存"
	)
	_expect(
		restored.get_regional_cache().arenas.size() == 1,
		"必须恢复附近擂台缓存"
	)

	_cleanup(save_path)
	source.free()
	restored.free()


func _test_v2_save_migration() -> void:
	var save_path := (
		"res://.godot/competitive_v2_migration_test_%d.cfg"
		% Time.get_ticks_usec()
	)
	var legacy := ConfigFile.new()
	legacy.set_value("meta", "version", 2)
	legacy.set_value("profile", "selected_map", "复合材质竞技场")
	legacy.set_value("profile", "coins", 240)
	legacy.set_value("progression", "tutorial", {
		"stage": "complete",
		"completed": true,
		"first_reward_claimed": true
	})
	_expect(legacy.save(save_path) == OK, "测试用 v2 存档必须写入成功")

	var migrated = GAME_STATE_SCRIPT.new()
	migrated.save_path = save_path
	_expect(migrated.load_state() == OK, "GameState 必须读取 v2 存档")
	_expect(migrated.coins == 240, "v2 迁移不能丢失已有赏金")
	_expect(
		not migrated.is_competitive_unlocked(),
		"没有按地图胜利证据的 v2 存档不得自动解锁竞技入口"
	)

	var upgraded := ConfigFile.new()
	_expect(
		upgraded.load(save_path) == OK,
		"读取 v2 后必须自动写回可读的 v3 存档"
	)
	_expect(
		int(upgraded.get_value("meta", "version", 0)) == 3,
		"迁移保存后存档版本必须升级为 v3"
	)
	_expect(
		upgraded.get_value("competitive", "profile", {}) is Dictionary,
		"v3 存档必须包含竞技档案"
	)
	_expect(
		upgraded.get_value("competitive", "regional_cache", {}) is Dictionary,
		"v3 存档必须包含地区数据缓存"
	)

	_cleanup(save_path)
	migrated.free()


func _cleanup(path: String) -> void:
	if FileAccess.file_exists(path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))


func _expect(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)


func _finish() -> void:
	if _failures.is_empty():
		print("PASS: competitive_system_test")
		quit(0)
		return
	for failure in _failures:
		push_error(failure)
	quit(1)
