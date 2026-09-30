// Shared visible profile and reduced-order contact, in game-balance units.
export const CONTACT_GRAVITY = 9.8;
export const RIM_WIDTH = .24;
export const RIM_HEIGHT = .16;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hermite = (x, a, b, ha, hb, ma, mb) => {
  const t = (x - a) / (b - a);
  return (2*t**3 - 3*t*t + 1)*ha + (t**3 - 2*t*t + t)*(b-a)*ma +
    (-2*t**3 + 3*t*t)*hb + (t**3 - t*t)*(b-a)*mb;
};

export function arenaHeightAt(arena, radius, angle = 0) {
  if (arena.groundHeight !== undefined) return arena.groundHeight;
  // Explicitly flat fixtures and measurement rigs remain flat.
  if (!arena.bowlForce) return 0;
  const n = clamp(radius / arena.wallRadius, 0, 1);
  let height;
  if (arena.id === "metal") {
    height = -.46 + n ** 1.5 * .76 + Math.sin(angle * 6 + n * 8) * n*n * .012;
  } else if (arena.id === "composite") {
    height = n < .46 ? hermite(n, 0, .46, -.52, -.448056, 0, .3)
      : n < .86 ? hermite(n, .46, .86, -.448056, -.16, .3, .9)
        : hermite(n, .86, 1, -.16, .295, .9, 3.25);
  } else {
    height = -.5 + n*n * .82;
  }
  // Low rounded rim, matching the visible torus (.12 radius, +.04 height).
  if (radius > arena.wallRadius) {
    const t = clamp((radius - arena.wallRadius) / RIM_WIDTH, 0, 1);
    height += Math.sin(Math.PI * t) ** 2 * RIM_HEIGHT;
  }
  return height;
}

export function boundaryDistance(arena, p) {
  return arena.boundary === "square" ? Math.max(Math.abs(p.x), Math.abs(p.y)) : Math.hypot(p.x, p.y);
}

export function sampleArenaContact(arena, p) {
  const height = (x, y) => arenaHeightAt(arena, Math.hypot(x, y), Math.atan2(y, x));
  const e = .01;
  const gx = (height(p.x + e, p.y) - height(p.x - e, p.y)) / (2*e);
  const gy = (height(p.x, p.y + e) - height(p.x, p.y - e)) / (2*e);
  const norm = Math.hypot(gx, 1, gy);
  const supportRadius = arena.wallRadius + (arena.boundary === "square" ? 0 : RIM_WIDTH);
  return { height: height(p.x, p.y), gradient: { x: gx, y: gy },
    normal: { x: -gx/norm, y: 1/norm, z: -gy/norm },
    supported: boundaryDistance(arena, p) <= supportRadius };
}

// Small radial dead zone removes stick noise; release has no smoothing delay.
export function controlResponse(input) {
  const x = clamp(Number.isFinite(input.x) ? input.x : 0, -1, 1);
  const y = clamp(Number.isFinite(input.y) ? input.y : 0, -1, 1);
  const raw = Math.hypot(x, y);
  const magnitude = clamp((raw - .035) / .965, 0, 1);
  return magnitude > 0 ? { x: x/raw*magnitude, y: y/raw*magnitude } : { x: 0, y: 0 };
}
