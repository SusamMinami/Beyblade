// One shared motor budget, changing station every eight seconds.
export const DRIVE_ZONE_RULES = Object.freeze({
  period: 8, activeSeconds: 7, radius: 1.25, torque: 6.4, spinCap: 0.92,
});
export const DEFAULT_DRIVE_ZONES = Object.freeze([
  { id: "A", x: -2.35, y: 0, radius: DRIVE_ZONE_RULES.radius },
  { id: "B", x: 2.35, y: 0, radius: DRIVE_ZONE_RULES.radius },
  { id: "C", x: 0, y: 2.35, radius: DRIVE_ZONE_RULES.radius },
]);

export function driveZoneState(arena, time) {
  const zones = arena.driveZones ?? DEFAULT_DRIVE_ZONES;
  if (!zones.length) return { zones, active: null, remaining: 0, cooling: true };
  const cycle = Math.floor(time / DRIVE_ZONE_RULES.period);
  const elapsed = time % DRIVE_ZONE_RULES.period;
  const cooling = elapsed >= DRIVE_ZONE_RULES.activeSeconds;
  return { zones, active: zones[cycle % zones.length], cooling,
    remaining: (cooling ? DRIVE_ZONE_RULES.period : DRIVE_ZONE_RULES.activeSeconds) - elapsed };
}

export function insideDriveZone(top, zone) {
  return Boolean(zone && Math.hypot(top.position.x - zone.x, top.position.y - zone.y) <= zone.radius);
}
