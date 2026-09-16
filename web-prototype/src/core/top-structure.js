// Balance-unit structural approximation. Eight body-local sectors per real part.
// No FEA, SI stress, persistent inventory wear, or random damage is implied.
import { normalizePartCustomization } from "./part-customization.js";

export const STRUCTURE_SECTORS = 8;
const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const WEIGHTS = [0.25, 0.2, 0.25, 0.15, 0.15];
const RADII = [0.69, 0.23, 0.5, 0.12, 0.08];

export function createStructure(build) {
  const structure = {
    revision: 0,
    parts: build.parts.map((part, index) => ({
      slot: part.type, id: part.id, name: part.name,
      sectors: Array(STRUCTURE_SECTORS).fill(0),
      health: 1, worst: 0, lostMass: 0, index,
    })),
  };
  deriveStructure(build, structure);
  return structure;
}

export function deriveStructure(build, structure) {
  let mass = 0, rawInertia = 0, wear = 0;
  const moment = [0, 0, 0];
  let bendX = 0, bendZ = 0;
  structure.parts.forEach((runtime, index) => {
    const part = build.parts[index];
    const custom = normalizePartCustomization(build.customizations[part.id]);
    const radius = RADII[index] * custom.size;
    let lostMass = 0, removedX = 0, removedZ = 0, bend = { x: 0, z: 0 };
    runtime.sectors.forEach((damage, sector) => {
      const angle = sector / STRUCTURE_SECTORS * TAU;
      // Cracking/bending precedes chipping. Shed fragments carry their own momentum.
      const missing = Math.max(damage - 0.55, 0) / 0.45 * 0.38;
      const removed = part.mass / STRUCTURE_SECTORS * missing;
      lostMass += removed;
      removedX += removed * radius * Math.cos(angle);
      removedZ += removed * radius * Math.sin(angle);
      bend.x -= Math.cos(angle) * damage ** 2 / STRUCTURE_SECTORS;
      bend.z -= Math.sin(angle) * damage ** 2 / STRUCTURE_SECTORS;
    });
    const remaining = part.mass - lostMass;
    runtime.health = 1 - runtime.sectors.reduce((a, b) => a + b, 0) / STRUCTURE_SECTORS;
    runtime.worst = Math.max(...runtime.sectors);
    runtime.lostMass = lostMass;
    mass += remaining;
    moment[0] += remaining * part.center[0] - removedX;
    moment[1] += remaining * part.center[1];
    moment[2] += remaining * part.center[2] - removedZ;
    rawInertia += part.inertia * (remaining / part.mass) +
      remaining * (part.center[0] ** 2 + part.center[2] ** 2) -
      2 * (part.center[0] * removedX + part.center[2] * removedZ);
    wear += (1 - runtime.health) * WEIGHTS[index];
    bendX += bend.x * radius * 0.24;
    bendZ += bend.z * radius * 0.24;
  });
  const center = moment.map((v) => v / mass);
  structure.totalMass = mass;
  structure.centerOfMass = center;
  structure.momentOfInertia = Math.max(build.momentOfInertia * 0.35,
    rawInertia - mass * (center[0] ** 2 + center[2] ** 2));
  const shift = Math.hypot(center[0] - build.centerOfMass[0] + bendX,
    center[2] - build.centerOfMass[2] + bendZ);
  const [ring, lock, , shaft, tip] = structure.parts;
  structure.wear = wear;
  structure.imbalance = clamp(shift * 9 + shaft.worst ** 2 * 0.5 +
    lock.worst ** 2 * 0.23 + ring.worst ** 2 * 0.2 + wear * 0.55, 0, 1);
  structure.stiffness = clamp(1 - wear * 0.65 -
    lock.worst ** 2 * 0.26 - shaft.worst ** 2 * 0.35, 0.16, 1);
  structure.stability = build.stability * structure.stiffness;
  structure.spinDrag = wear * 2 + structure.imbalance ** 2 * 14 +
    shaft.worst ** 2 * 6 + tip.worst ** 2 * 4;
  structure.integrity = structure.parts.reduce((sum, p, i) => sum + p.health * WEIGHTS[i], 0);
  structure.brokenSectors = structure.parts.reduce((sum, p) =>
    sum + p.sectors.filter((damage) => damage >= 0.99).length, 0);
  structure.failed = ring.health < 0.3 || lock.health < 0.35 || shaft.health < 0.3;
  return structure;
}

export function applyStructuralImpact(top, damage, worldAngle) {
  if (!(damage > 0)) return [];
  // Three.js positive rotation about Y maps +X toward -Z.
  const localAngle = ((worldAngle + top.spinPhase) % TAU + TAU) % TAU;
  const sector = Math.round(localAngle / TAU * STRUCTURE_SECTORS) % STRUCTURE_SECTORS;
  const ringCustom = normalizePartCustomization(top.build.customizations[top.build.selection.attackRing]);
  const shaftCustom = normalizePartCustomization(top.build.customizations[top.build.selection.driverShaft]);
  const leverage = 1 + Math.max(shaftCustom.height - 1, 0) * 1.3 + top.tilt * 0.6;
  const shares = [0.64, 0.13 * leverage, 0.17, 0.09 * leverage, 0.035 + top.tilt * 0.12];
  const impacts = [];
  top.structure.parts.forEach((runtime, index) => {
    const part = top.build.parts[index];
    const custom = normalizePartCustomization(top.build.customizations[part.id]);
    // Wider/thinner sections and sharp sparse lobes concentrate load.
    const section = clamp(custom.height / custom.size, 0.58, 1.55);
    const concentration = index === 0
      ? 1 + ringCustom.shape / 100 * (0.55 + 1 / ringCustom.symmetry) : 1;
    const dose = damage * shares[index] * concentration /
      (part.durability * 0.24 * section);
    for (const [offset, fraction] of [[0, 0.72], [-1, 0.14], [1, 0.14]]) {
      const at = (sector + offset + STRUCTURE_SECTORS) % STRUCTURE_SECTORS;
      runtime.sectors[at] = clamp(runtime.sectors[at] + dose * fraction, 0, 1);
    }
    impacts.push({ slot: runtime.slot, sector, dose });
  });
  top.structure.revision += 1;
  deriveStructure(top.build, top.structure);
  top.durability = top.build.durability * top.structure.integrity;
  return impacts;
}
