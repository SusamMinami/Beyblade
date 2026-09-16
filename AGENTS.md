# Working order

- Start with `docs/README.md` for task-specific documentation. Dated July
  handoffs and `.impeccable/review/` reports are historical evidence, not the
  current backlog. Keep implementation status separate from design proposals.
- User-confirmed on 2026-09-15: implement and validate gameplay, interface, and
  scene-art changes in `web-prototype/` first. Port accepted work to Godot later.
- The more complete Web prototype is the active development target. Existing
  Godot scenes and scripts are retained; their presence does not make them the
  default implementation target.
- Reference-image systems may be introduced incrementally. Implement their
  local behavior where possible, and explicitly label unavailable backend or
  payment capabilities instead of omitting their planned interface.
- Reuse the existing loadouts, ownership, prices, progression, and calculation
  model. Do not create parallel sample inventories or change battle physics
  merely to match an art reference.
- Prototype measurements use game-balance units; see
  `docs/top_part_physics_baseline.md`. Do not relabel them as grams or millimeters.
- Web checks: `npm test`, `npm run build`, and `npm run verify:lab` when changing
  the test lab. The last command needs the local dev server and installed Chrome.
- Current lab entry: `http://127.0.0.1:5173/#lab`.
- Current collection entry: `http://127.0.0.1:5173/#collection`. Use
  `npm run verify:showroom` for stage/lift/wind changes. It uses an isolated save.
- Collection switches must lower the old specimen before committing the selected
  loadout, then raise the new specimen. Previewing a locked stage must never equip
  it or mutate ownership; stages use the existing laboratory XP progression.
- Test-driven spin is independent of optional idle rotation. Wind inspection is
  a local demonstration with explicit units/telemetry, not a battle-solver change.
- For battle-world, obstacle, or scene-inspection changes, also run
  `npm run verify:worlds` in `web-prototype/` with the dev server and Chrome.
