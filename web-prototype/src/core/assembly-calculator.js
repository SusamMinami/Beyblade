import {
  getPart,
  PART_TYPE_META,
  PART_TYPES,
} from "../data/parts.js";

const REFERENCE_MASS = 1.22;
const REFERENCE_INERTIA = 0.89;
const BASE_SPIN_DECAY = 3.8;
const BASE_MAX_SPIN_SPEED = 65;
const BASE_LAUNCH_IMPULSE = 4.5;
const BASE_CONTROL_FORCE = 9;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function requirePart(id, expectedType) {
  const part = getPart(id);
  if (!part || part.type !== expectedType) {
    throw new Error(`${PART_TYPE_META[expectedType].name}配置无效：${id}`);
  }
  return part;
}

function weighted(parts, property, weights) {
  return parts.reduce(
    (total, part, index) => total + part[property] * weights[index],
    0,
  );
}

export function calculateBuild(selection) {
  const attackRing = requirePart(
    selection.attackRing,
    PART_TYPES.ATTACK_RING,
  );
  const coreLock = requirePart(selection.coreLock, PART_TYPES.CORE_LOCK);
  const weightDisc = requirePart(
    selection.weightDisc,
    PART_TYPES.WEIGHT_DISC,
  );
  const driverShaft = requirePart(
    selection.driverShaft,
    PART_TYPES.DRIVER_SHAFT,
  );
  const tip = requirePart(selection.tip, PART_TYPES.TIP);
  const parts = [attackRing, coreLock, weightDisc, driverShaft, tip];

  const totalMass = parts.reduce((total, part) => total + part.mass, 0);
  const momentOfInertia = parts.reduce(
    (total, part) => total + part.inertia,
    0,
  );
  const contactArea = parts.reduce(
    (total, part) => total + part.contactArea,
    0,
  );
  const centerOfMass = [0, 1, 2].map(
    (axis) =>
      parts.reduce(
        (total, part) => total + part.center[axis] * part.mass,
        0,
      ) / totalMass,
  );

  const friction = clamp(
    attackRing.friction * 0.15 +
      weightDisc.friction * 0.1 +
      tip.friction * 0.75,
    0.05,
    1,
  );
  const restitution = clamp(
    attackRing.restitution * 0.55 +
      weightDisc.restitution * 0.25 +
      driverShaft.restitution * 0.05 +
      tip.restitution * 0.15,
    0,
    1,
  );

  const lateralOffset = Math.hypot(centerOfMass[0], centerOfMass[2]);
  const stability = clamp(
    weighted(parts, "stability", [0.2, 0.15, 0.25, 0.2, 0.2]) -
      clamp(lateralOffset * 2.5, 0, 0.25) -
      clamp(Math.max(centerOfMass[1], 0) * 0.8, 0, 0.15),
    0.35,
    1.4,
  );

  const componentControl = weighted(
    parts,
    "control",
    [0.08, 0.07, 0.15, 0.2, 0.5],
  );
  const controlResponse = clamp(
    componentControl * (REFERENCE_MASS / Math.max(totalMass, 0.1)) ** 0.35,
    0.35,
    1.5,
  );
  const attackPower = weighted(
    parts,
    "attack",
    [0.4, 0.05, 0.3, 0.15, 0.1],
  );
  const durability = weighted(
    parts,
    "durability",
    [0.25, 0.2, 0.25, 0.15, 0.15],
  );
  const dampingMultiplier = weighted(
    parts,
    "damping",
    [0.15, 0.05, 0.1, 0.1, 0.6],
  );
  const instabilityDecay = clamp(1 / stability, 0.78, 1.4);
  const spinDecayPerSecond =
    BASE_SPIN_DECAY * dampingMultiplier * instabilityDecay;
  const maxSpinSpeed =
    BASE_MAX_SPIN_SPEED * Math.sqrt(REFERENCE_INERTIA / momentOfInertia);
  const launchForwardImpulse =
    BASE_LAUNCH_IMPULSE * (totalMass / REFERENCE_MASS) ** 0.75;

  return Object.freeze({
    selection: Object.freeze({ ...selection }),
    parts,
    totalMass,
    centerOfMass,
    momentOfInertia,
    contactArea,
    friction,
    restitution,
    stability,
    controlResponse,
    controlForce: BASE_CONTROL_FORCE * controlResponse,
    attackPower,
    durability,
    spinDecayPerSecond,
    maxSpinSpeed,
    launchForwardImpulse,
    collisionMomentum: launchForwardImpulse,
  });
}

export function getBuildRatings(build) {
  return {
    攻击: clamp((build.attackPower / 1.25) * 100, 0, 100),
    续航: clamp((5.2 / build.spinDecayPerSecond) * 72, 0, 100),
    稳定: clamp((build.stability / 1.2) * 100, 0, 100),
    控制: clamp((build.controlResponse / 1.25) * 100, 0, 100),
    耐久: clamp((build.durability / 125) * 100, 0, 100),
  };
}
