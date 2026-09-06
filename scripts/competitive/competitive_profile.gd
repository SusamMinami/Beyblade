class_name CompetitiveProfile
extends RefCounted

const REGIONAL_MODELS := preload(
	"res://scripts/competitive/regional_competition_models.gd"
)
const PROFILE_SCHEMA_VERSION := 1
const PRACTICE_MAP_IDS := ["standard", "metal", "composite"]
const DEFAULT_RATING := 1000
const DEFAULT_PLACEMENT_MATCHES := 5


static func create_default() -> Dictionary:
	return {
		"schema_version": PROFILE_SCHEMA_VERSION,
		"practice": _create_default_practice(),
		"ranked": create_default_ranked_profile(),
		"regional": create_default_regional_profile()
	}


static func normalize(value) -> Dictionary:
	var source: Dictionary = value if value is Dictionary else {}
	return {
		"schema_version": PROFILE_SCHEMA_VERSION,
		"practice": _normalize_practice(source.get("practice", {})),
		"ranked": normalize_ranked_profile(source.get("ranked", {})),
		"regional": normalize_regional_profile(source.get("regional", {}))
	}


static func record_practice_result(
	profile_value,
	map_id: String,
	won: bool,
	completed_at: int = 0
) -> Dictionary:
	var profile := normalize(profile_value)
	if map_id not in PRACTICE_MAP_IDS:
		return profile
	var practice: Dictionary = profile.practice
	var wins_by_map: Dictionary = practice.wins_by_map.duplicate(true)
	var losses_by_map: Dictionary = practice.losses_by_map.duplicate(true)
	if won:
		wins_by_map[map_id] = int(wins_by_map.get(map_id, 0)) + 1
	else:
		losses_by_map[map_id] = int(losses_by_map.get(map_id, 0)) + 1
	practice.wins_by_map = wins_by_map
	practice.losses_by_map = losses_by_map
	practice.total_battles = int(practice.total_battles) + 1
	if (
		int(practice.completed_at) == 0
		and _has_won_all_practice_maps(wins_by_map)
	):
		practice.completed_at = maxi(completed_at, 0)
	profile.practice = practice
	return profile


static func is_competitive_unlocked(profile_value) -> bool:
	var profile := normalize(profile_value)
	return _has_won_all_practice_maps(profile.practice.wins_by_map)


static func get_practice_wins(profile_value, map_id: String) -> int:
	if map_id not in PRACTICE_MAP_IDS:
		return 0
	var profile := normalize(profile_value)
	return int(profile.practice.wins_by_map.get(map_id, 0))


static func create_default_ranked_profile() -> Dictionary:
	return {
		"season_id": "",
		"tier_id": "unranked",
		"division": 0,
		"rating": DEFAULT_RATING,
		"peak_rating": DEFAULT_RATING,
		"wins": 0,
		"losses": 0,
		"placement_matches_remaining": DEFAULT_PLACEMENT_MATCHES,
		"leaderboard_position": 0,
		"server_revision": 0,
		"last_synced_at": 0
	}


static func normalize_ranked_profile(value) -> Dictionary:
	var source: Dictionary = value if value is Dictionary else {}
	var rating := clampi(
		int(source.get("rating", DEFAULT_RATING)),
		0,
		100000
	)
	return {
		"season_id": str(source.get("season_id", "")).strip_edges(),
		"tier_id": _normalize_tier_id(source.get("tier_id", "unranked")),
		"division": clampi(int(source.get("division", 0)), 0, 10),
		"rating": rating,
		"peak_rating": clampi(
			maxi(int(source.get("peak_rating", rating)), rating),
			0,
			100000
		),
		"wins": maxi(int(source.get("wins", 0)), 0),
		"losses": maxi(int(source.get("losses", 0)), 0),
		"placement_matches_remaining": clampi(
			int(source.get(
				"placement_matches_remaining",
				DEFAULT_PLACEMENT_MATCHES
			)),
			0,
			DEFAULT_PLACEMENT_MATCHES
		),
		"leaderboard_position": maxi(
			int(source.get("leaderboard_position", 0)),
			0
		),
		"server_revision": maxi(int(source.get("server_revision", 0)), 0),
		"last_synced_at": maxi(int(source.get("last_synced_at", 0)), 0)
	}


static func create_default_regional_profile() -> Dictionary:
	return {
		"eligible": false,
		"eligibility_reason": "rank_requirement_not_met",
		"required_tier_id": "silver",
		"home_region": REGIONAL_MODELS.create_empty_location(),
		"owned_arena_ids": [],
		"champion_arena_ids": [],
		"medals": [],
		"server_revision": 0,
		"last_synced_at": 0
	}


static func normalize_regional_profile(value) -> Dictionary:
	var source: Dictionary = value if value is Dictionary else {}
	return {
		"eligible": bool(source.get("eligible", false)),
		"eligibility_reason": str(
			source.get(
				"eligibility_reason",
				"rank_requirement_not_met"
			)
		).strip_edges(),
		"required_tier_id": _normalize_tier_id(
			source.get("required_tier_id", "silver")
		),
		"home_region": REGIONAL_MODELS.normalize_location(
			source.get("home_region", {})
		),
		"owned_arena_ids": _normalize_id_array(
			source.get("owned_arena_ids", [])
		),
		"champion_arena_ids": _normalize_id_array(
			source.get("champion_arena_ids", [])
		),
		"medals": REGIONAL_MODELS.normalize_medals(
			source.get("medals", [])
		),
		"server_revision": maxi(int(source.get("server_revision", 0)), 0),
		"last_synced_at": maxi(int(source.get("last_synced_at", 0)), 0)
	}


static func should_accept_server_snapshot(
	current_value,
	incoming_value
) -> bool:
	var current: Dictionary = (
		current_value if current_value is Dictionary else {}
	)
	var incoming: Dictionary = (
		incoming_value if incoming_value is Dictionary else {}
	)
	return (
		int(incoming.get("server_revision", 0))
		> int(current.get("server_revision", 0))
	)


static func _create_default_practice() -> Dictionary:
	return {
		"wins_by_map": _empty_map_counts(),
		"losses_by_map": _empty_map_counts(),
		"total_battles": 0,
		"completed_at": 0
	}


static func _normalize_practice(value) -> Dictionary:
	var source: Dictionary = value if value is Dictionary else {}
	var wins_by_map := _normalize_map_counts(source.get("wins_by_map", {}))
	return {
		"wins_by_map": wins_by_map,
		"losses_by_map": _normalize_map_counts(
			source.get("losses_by_map", {})
		),
		"total_battles": maxi(int(source.get("total_battles", 0)), 0),
		"completed_at": (
			maxi(int(source.get("completed_at", 0)), 0)
			if _has_won_all_practice_maps(wins_by_map)
			else 0
		)
	}


static func _empty_map_counts() -> Dictionary:
	var result := {}
	for map_id in PRACTICE_MAP_IDS:
		result[map_id] = 0
	return result


static func _normalize_map_counts(value) -> Dictionary:
	var source: Dictionary = value if value is Dictionary else {}
	var result := _empty_map_counts()
	for map_id in PRACTICE_MAP_IDS:
		result[map_id] = maxi(int(source.get(map_id, 0)), 0)
	return result


static func _has_won_all_practice_maps(wins_by_map: Dictionary) -> bool:
	for map_id in PRACTICE_MAP_IDS:
		if int(wins_by_map.get(map_id, 0)) <= 0:
			return false
	return true


static func _normalize_tier_id(value) -> String:
	var result := str(value).strip_edges().to_lower()
	return result if not result.is_empty() else "unranked"


static func _normalize_id_array(value) -> Array[String]:
	var result: Array[String] = []
	if not value is Array:
		return result
	for entry in value:
		var id := str(entry).strip_edges()
		if not id.is_empty() and id not in result:
			result.append(id)
	return result
