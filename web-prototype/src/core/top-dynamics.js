// Reduced-order dynamics in game-balance units. Positive spin follows Three.js +Y.
// Tilt is a damped axis response, not a separately conserved rigid-body energy.
export const DYNAMICS_VERSION = "2026.09.24-shared-v6";
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const REFERENCE_INERTIA = 0.89;

export function launchState(build, { power = .86, height = .45, direction = 0,
  angle = 0, spinDirection = 1, speedScale = 1 } = {}) {
  power = clamp(power, .35, 1);
  height = clamp(height, 0, 1);
  angle = clamp(angle, -1, 1);
  const forward = { x: Math.sin(direction), y: -Math.cos(direction) };
  const side = { x: Math.cos(direction), y: Math.sin(direction) };
  const speed = (3.4 + build.launchForwardImpulse * power) * (.94 + height * .12) * speedScale;
  const tilt = Math.abs(angle) * .18 + Math.max(height - .55, 0) * .08;
  const lean = Math.sign(angle) || 1;
  return {
    velocity: { x: forward.x * speed + side.x * angle * .72 * speedScale,
      y: forward.y * speed + side.y * angle * .72 * speedScale },
    // All builds share the same full-power axial energy: I * maxSpinSpeed² / 2.
    spin: build.maxSpinSpeed * power * (1 - Math.abs(angle) * .08) * (1 - height * .035),
    spinDirection: spinDirection < 0 ? -1 : 1,
    tilt, tiltVector: { x: side.x * lean * tilt, y: side.y * lean * tilt },
    tiltRate: { x: 0, y: 0 },
  };
}

export function bodyToWorld(x, y, phase) {
  const c = Math.cos(phase), s = Math.sin(phase);
  return { x: c * x + s * y, y: -s * x + c * y };
}

export function signedSpin(top) {
  return top.spin * (top.spinDirection ?? 1);
}

export function setSignedSpin(top, value) {
  if (Math.abs(value) > 1e-10) top.spinDirection = Math.sign(value);
  top.spin = Math.abs(value);
}

export function loseSpin(top, amount, channel = "contact") {
  const lost = Math.min(top.spin, Math.max(0, amount));
  top.spin -= lost;
  if (top.spinBudget) top.spinBudget[channel] += lost;
  return lost;
}

export function tipContact(build) {
  const tip = build.parts[4];
  const size = tip.customization?.size ?? 1;
  // Effective friction-moment radius, not contact area. Material damping and
  // size change the moment arm without changing Coulomb friction by area.
  return { radius: .018 * size * clamp(tip.damping, .5, 1.8),
    friction: clamp(tip.friction, .05, 1) };
}

export function lossTorques(top, surface, spinScale = 1) {
  const tip = tipContact(top.build);
  const natural = REFERENCE_INERTIA * top.build.spinDecayPerSecond *
    surface.spinDamping * spinScale * (.72 + .28 * (top.spin / 65) ** 2) *
    (.85 + .15 * tip.radius / .018);
  const scrapeRatio = clamp((top.tilt - .48) / .34, 0, 1);
  const scrape = REFERENCE_INERTIA * (top.structure.spinDrag +
    (1.25 + top.build.friction * surface.friction * 1.8) * scrapeRatio);
  return { natural, scrape };
}

export function applyGroundContact(top, surface, dt) {
  const mass = top.structure.totalMass, inertia = top.structure.momentOfInertia;
  const tip = tipContact(top.build);
  const tilt = top.tiltVector;
  const offset = bodyToWorld(top.structure.centerOfMass[0] + top.structure.bend[0],
    top.structure.centerOfMass[2] + top.structure.bend[1], top.spinPhase);
  // Support offset shares the same axis and rotating body eccentricity.
  const lever = top.structure.supportHeight;
  const rx = -tilt.x * lever - offset.x, ry = -tilt.y * lever - offset.y;
  const q = signedSpin(top);
  const vx = top.velocity.x + q * ry, vy = top.velocity.y - q * rx;
  const slip = Math.hypot(vx, vy);
  const traction = tip.friction * surface.friction * 9.8 * mass * (top.terrain?.normal.y ?? 1);
  const kxx = 1 / mass + ry * ry / inertia;
  const kyy = 1 / mass + rx * rx / inertia;
  const kxy = -rx * ry / inertia;
  const determinant = kxx * kyy - kxy * kxy;
  let jx = (-kyy * vx + kxy * vy) / determinant;
  let jy = (kxy * vx - kxx * vy) / determinant;
  // Compliant tip: partial slip relaxation; Coulomb cap bounds the force.
  const relaxation = 1 - Math.exp(-(.35 + tip.friction * 1.5) * surface.linearDrag * dt);
  const magnitude = Math.hypot(jx, jy);
  const factor = Math.min(relaxation, traction * dt / Math.max(magnitude, 1e-12));
  jx *= factor; jy *= factor;
  top.velocity.x += jx / mass;
  top.velocity.y += jy / mass;
  const before = top.spin;
  setSignedSpin(top, q + (ry * jx - rx * jy) / inertia);
  if (top.spinBudget) top.spinBudget.ground += before - top.spin;
  top.ground = { slip, state: top.tilt >= .48 ? "scraping" : slip > .18 ? "sliding" : "gripping",
    traction, radius: tip.radius };
  return traction / mass;
}

export function updateAxis(top, surface, dt) {
  const direction = bodyToWorld(top.structure.centerOfMass[0] + top.structure.bend[0],
    top.structure.centerOfMass[2] + top.structure.bend[1], top.spinPhase);
  const momentum = top.structure.momentOfInertia * top.spin;
  const support = clamp(momentum / (REFERENCE_INERTIA * 65), 0, 1.5);
  const stability = Math.max(.16, top.structure.stability * surface.stability);
  // Ground normal biases low-momentum settling; a fast top resists the slope.
  const slopeWeight = .3 / (1 + support * 2);
  const targetX = direction.x * (5 + top.structure.imbalance * 4) - top.velocity.x * .012 +
    (top.terrain?.normal.x ?? 0) * slopeWeight;
  const targetY = direction.y * (5 + top.structure.imbalance * 4) - top.velocity.y * .012 +
    (top.terrain?.normal.z ?? 0) * slopeWeight;
  const stiffness = (6 + support * 18) * stability;
  const damping = 5 + support * 2;
  // Exact rotation of the axis velocity keeps the gyroscopic term work-free.
  const precession = (top.spinDirection ?? 1) * (2.5 / (.3 + support)) * dt;
  const rate = bodyToWorld(top.tiltRate.x, top.tiltRate.y, precession);
  const decay = Math.exp(-damping * dt);
  top.tiltRate.x = (rate.x + (targetX - top.tiltVector.x) * stiffness * dt) * decay;
  top.tiltRate.y = (rate.y + (targetY - top.tiltVector.y) * stiffness * dt) * decay;
  top.tiltVector.x += top.tiltRate.x * dt;
  top.tiltVector.y += top.tiltRate.y * dt;
  // At low angular momentum, an existing lean falls outward; no actor/seed bias.
  const fall = Math.exp(Math.max(0, .18 - support) * 7 * dt);
  top.tiltVector.x *= fall; top.tiltVector.y *= fall;
  const magnitude = Math.hypot(top.tiltVector.x, top.tiltVector.y);
  const limit = Math.min(1, .9 / Math.max(magnitude, 1e-12));
  top.tiltVector.x *= limit; top.tiltVector.y *= limit;
  top.tilt = Math.min(magnitude, .9);
  const sin = Math.sin(top.tilt) / Math.max(top.tilt, 1e-12);
  top.axis = { x: top.tiltVector.x * sin, y: Math.cos(top.tilt), z: top.tiltVector.y * sin };
  top.angularMomentum = momentum;
}

// Circular contact: normal impulse followed by Coulomb-limited tangential impulse.
// B=null denotes a stationary, infinite-mass obstacle. Normal points A -> B.
export function resolveDiskContact(a, b, normal, ra, rb, restitution, friction = .24) {
  const ma = a.structure.totalMass, ia = a.structure.momentOfInertia;
  const invB = b ? 1 / b.structure.totalMass : 0;
  const ib = b?.structure.momentOfInertia ?? Infinity;
  const tangent = { x: -normal.y, y: normal.x };
  const dx = (b?.velocity.x ?? 0) - a.velocity.x;
  const dy = (b?.velocity.y ?? 0) - a.velocity.y;
  const vn = dx * normal.x + dy * normal.y;
  const jn = Math.max(0, -(1 + clamp(restitution, 0, 1)) * vn / (1 / ma + invB));
  const vt = dx * tangent.x + dy * tangent.y + signedSpin(a) * ra + (b ? signedSpin(b) * rb : 0);
  const jt = clamp(-vt / (1 / ma + invB + ra * ra / ia + rb * rb / ib),
    -friction * jn, friction * jn);
  const jx = normal.x * jn + tangent.x * jt, jy = normal.y * jn + tangent.y * jt;
  a.velocity.x -= jx / ma; a.velocity.y -= jy / ma;
  setSignedSpin(a, signedSpin(a) + ra * jt / ia);
  if (b) {
    b.velocity.x += jx * invB; b.velocity.y += jy * invB;
    setSignedSpin(b, signedSpin(b) + rb * jt / ib);
  }
  return { normal: jn, tangent: jt, normalSpeed: vn, slip: vt };
}
