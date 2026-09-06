class_name RegionalCompetitionModels
extends RefCounted

const DEFAULT_BATTLE_MAP_ID := "standard"
const DEFAULT_PUBLIC_RADIUS_M := 500
const MIN_PUBLIC_RADIUS_M := 250
const MAX_PUBLIC_RADIUS_M := 5000
const VALID_BATTLE_MAP_IDS := ["standard", "metal", "composite"]
const VALID_ARENA_STATUSES := [
	"active",
	"paused",
	"closed",
	"under_review"
]
const VALID_CHALLENGE_STATUSES := [
	"queued",
	"active",
	"challenger_won",
	"defender_won",
	"cancelled",
	"expired"
]


static func create_empty_location() -> Dictionary:
	return {
		"region_id": "",
		"country_code": "",
		"admin_area_1": "",
		"admin_area_2": "",
		"locality": "",
		"spatial_cell": "",
		"has_public_position": false,
		"public_latitude": 0.0,
		"public_longitude": 0.0,
		"display_radius_m": DEFAULT_PUBLIC_RADIUS_M,
		"updated_at": 0
	}


static func normalize_location(value) -> Dictionary:
	var source: Dictionary = value if value is Dictionary else {}
	var has_public_position := bool(
		source.get("has_public_position", false)
	)
	var public_latitude := 0.0
	var public_longitude := 0.0
	if has_public_position:
		public_latitude = snappedf(
			clampf(
				float(source.get("public_latitude", 0.0)),
				-90.0,
				90.0
			),
			0.001
		)
		public_longitude = snappedf(
			clampf(
				float(source.get("public_longitude", 0.0)),
				-180.0,
				180.0
			),
			0.001
		)
	return {
		"region_id": str(source.get("region_id", "")).strip_edges(),
		"country_code": str(
			source.get("country_code", "")
		).strip_edges().to_upper(),
		"admin_area_1": str(source.get("admin_area_1", "")).strip_edges(),
		"admin_area_2": str(source.get("admin_area_2", "")).strip_edges(),
		"locality": str(source.get("locality", "")).strip_edges(),
		"spatial_cell": str(source.get("spatial_cell", "")).strip_edges(),
		"has_public_position": has_public_position,
		"public_latitude": public_latitude,
		"public_longitude": public_longitude,
		"display_radius_m": clampi(
			int(source.get("display_radius_m", DEFAULT_PUBLIC_RADIUS_M)),
			MIN_PUBLIC_RADIUS_M,
			MAX_PUBLIC_RADIUS_M
		),
		"updated_at": maxi(int(source.get("updated_at", 0)), 0)
	}


static func create_empty_arena() -> Dictionary:
	return normalize_arena({})


static func normalize_arena(value) -> Dictionary:
	var source: Dictionary = value if value is Dictionary else {}
	var battle_map_id := str(
		source.get("battle_map_id", DEFAULT_BATTLE_MAP_ID)
	)
	if battle_map_id not in VALID_BATTLE_MAP_IDS:
		battle_map_id = DEFAULT_BATTLE_MAP_ID
	var status := str(source.get("status", "active"))
	if status not in VALID_ARENA_STATUSES:
		status = "active"
	return {
		"arena_id": str(source.get("arena_id", "")).strip_edges(),
		"region_id": str(source.get("region_id", "")).strip_edges(),
		"owner_player_id": str(
			source.get("owner_player_id", "")
		).strip_edges(),
		"owner_display_name": str(
			source.get("owner_display_name", "")
		).strip_edges(),
		"name": str(source.get("name", "")).strip_edges(),
		"location": normalize_location(source.get("location", {})),
		"battle_map_id": battle_map_id,
		"status": status,
		"champion_player_id": str(
			source.get("champion_player_id", "")
		).strip_edges(),
		"champion_display_name": str(
			source.get("champion_display_name", "")
		).strip_edges(),
		"defense_loadout_id": str(
			source.get("defense_loadout_id", "")
		).strip_edges(),
		"successful_defenses": maxi(
			int(source.get("successful_defenses", 0)),
			0
		),
		"challenge_count": maxi(int(source.get("challenge_count", 0)), 0),
		"created_at": maxi(int(source.get("created_at", 0)), 0),
		"updated_at": maxi(int(source.get("updated_at", 0)), 0),
		"server_revision": maxi(int(source.get("server_revision", 0)), 0)
	}


static func create_empty_challenge() -> Dictionary:
	return normalize_challenge({})


static func normalize_challenge(value) -> Dictionary:
	var source: Dictionary = value if value is Dictionary else {}
	var status := str(source.get("status", "queued"))
	if status not in VALID_CHALLENGE_STATUSES:
		status = "queued"
	var best_of := int(source.get("best_of", 3))
	if best_of not in [1, 3, 5]:
		best_of = 3
	var wins_needed := int(best_of / 2) + 1
	return {
		"challenge_id": str(
			source.get("challenge_id", "")
		).strip_edges(),
		"arena_id": str(source.get("arena_id", "")).strip_edges(),
		"challenger_player_id": str(
			source.get("challenger_player_id", "")
		).strip_edges(),
		"defender_player_id": str(
			source.get("defender_player_id", "")
		).strip_edges(),
		"status": status,
		"battle_ticket_id": str(
			source.get("battle_ticket_id", "")
		).strip_edges(),
		"best_of": best_of,
		"challenger_wins": clampi(
			int(source.get("challenger_wins", 0)),
			0,
			wins_needed
		),
		"defender_wins": clampi(
			int(source.get("defender_wins", 0)),
			0,
			wins_needed
		),
		"created_at": maxi(int(source.get("created_at", 0)), 0),
		"updated_at": maxi(int(source.get("updated_at", 0)), 0),
		"finished_at": maxi(int(source.get("finished_at", 0)), 0),
		"server_revision": maxi(int(source.get("server_revision", 0)), 0)
	}


static func create_empty_medal() -> Dictionary:
	return normalize_medal({})


static func normalize_medal(value) -> Dictionary:
	var source: Dictionary = value if value is Dictionary else {}
	return {
		"medal_id": str(source.get("medal_id", "")).strip_edges(),
		"season_id": str(source.get("season_id", "")).strip_edges(),
		"region_id": str(source.get("region_id", "")).strip_edges(),
		"arena_id": str(source.get("arena_id", "")).strip_edges(),
		"holder_player_id": str(
			source.get("holder_player_id", "")
		).strip_edges(),
		"title": str(source.get("title", "")).strip_edges(),
		"awarded_at": maxi(int(source.get("awarded_at", 0)), 0),
		"revoked_at": maxi(int(source.get("revoked_at", 0)), 0),
		"active": bool(source.get("active", false))
	}


static func create_default_cache() -> Dictionary:
	return {
		"query_region_id": "",
		"arenas": [],
		"challenges": [],
		"server_revision": 0,
		"last_synced_at": 0
	}


static func normalize_cache(value) -> Dictionary:
	var source: Dictionary = value if value is Dictionary else {}
	return {
		"query_region_id": str(
			source.get("query_region_id", "")
		).strip_edges(),
		"arenas": normalize_arenas(source.get("arenas", [])),
		"challenges": normalize_challenges(source.get("challenges", [])),
		"server_revision": maxi(int(source.get("server_revision", 0)), 0),
		"last_synced_at": maxi(int(source.get("last_synced_at", 0)), 0)
	}


static func normalize_arenas(value) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	if not value is Array:
		return result
	var seen_ids := {}
	for entry in value:
		if not entry is Dictionary:
			continue
		var arena := normalize_arena(entry)
		var arena_id: String = arena.arena_id
		if arena_id.is_empty() or seen_ids.has(arena_id):
			continue
		seen_ids[arena_id] = true
		result.append(arena)
	return result


static func normalize_challenges(value) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	if not value is Array:
		return result
	var seen_ids := {}
	for entry in value:
		if not entry is Dictionary:
			continue
		var challenge := normalize_challenge(entry)
		var challenge_id: String = challenge.challenge_id
		if challenge_id.is_empty() or seen_ids.has(challenge_id):
			continue
		seen_ids[challenge_id] = true
		result.append(challenge)
	return result


static func normalize_medals(value) -> Array[Dictionary]:
	var result: Array[Dictionary] = []
	if not value is Array:
		return result
	var seen_ids := {}
	for entry in value:
		if not entry is Dictionary:
			continue
		var medal := normalize_medal(entry)
		var medal_id: String = medal.medal_id
		if medal_id.is_empty() or seen_ids.has(medal_id):
			continue
		seen_ids[medal_id] = true
		result.append(medal)
	return result
