import { activeLauncherOil } from "./launcher-state.js";
// Local surface samples, in mesh coordinates. Amounts are game-balance units.
export const OIL_ZONES = Object.freeze({
  transmission: "传动接触面", support: "主握柄", pull: "抽拉柄",
  tip: "轴尖接地面", exterior: "外表面",
});
export const MAX_OIL_SAMPLES = 192;
export const MAX_MESH_OIL_SAMPLES = 48;
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const vector = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

export function normalizeOil(samples) {
  if (!Array.isArray(samples)) return [];
  const counts = new Map();
  return samples.slice(0, MAX_OIL_SAMPLES).filter(s => s &&
    typeof s.mesh === "string" && /^[\w.-]{1,180}$/.test(s.mesh) &&
    Object.hasOwn(OIL_ZONES, s.zone) && vector(s.p) && vector(s.n) &&
    s.p.every(v => Math.abs(v) <= 20) && s.amount > 0).map(s => ({
    mesh: s.mesh, zone: s.zone, p: [...s.p], n: s.n.map(v => clamp(v, -1, 1)),
    amount: clamp(finite(s.amount), 0, 1),
    radius: clamp(finite(s.radius, .08), .025, .2),
  })).filter(s => {
    const count = counts.get(s.mesh) ?? 0;
    counts.set(s.mesh, count + 1);
    return s.amount > 0 && count < MAX_MESH_OIL_SAMPLES;
  });
}

export function normalizeMaintenance(raw) {
  const tops = {};
  // Three existing loadouts, all five part types; never invent ownership.
  for (const [key, oil] of Object.entries(raw?.tops ?? {}).slice(0, 60)) {
    if (/^loadout-[123]:[\w.]+$/.test(key)) tops[key] = normalizeOil(oil);
  }
  return { version: 1, launcher: normalizeOil(raw?.launcher), tops };
}

export const oilKey = (loadout, partId) => `${loadout.id}:${partId}`;

export function paintOil(samples, hit, amount, wipe = false) {
  const next = samples.map(s => ({ ...s }));
  const radius = hit.radius;
  const distance = s => Math.hypot(...s.p.map((v, i) => v - hit.p[i]));
  // Opposite faces remain independent, including very thin rack faces.
  const sameFace = s => s.mesh === hit.mesh &&
    s.n.reduce((v, n, i) => v + n * hit.n[i], 0) > .3;
  if (wipe) return next.map(s => sameFace(s) && distance(s) < radius * 1.8
    ? { ...s, amount: Math.max(0, s.amount - amount * 2) } : s).filter(s => s.amount > .001);
  const nearest = next.filter(s => sameFace(s) && distance(s) < radius * .7)
    .sort((a, b) => distance(a) - distance(b))[0];
  if (nearest) nearest.amount = clamp(nearest.amount + amount, 0, 1);
  else if (next.length < MAX_OIL_SAMPLES &&
    next.filter(s => s.mesh === hit.mesh).length < MAX_MESH_OIL_SAMPLES)
    next.push({ ...hit, amount: clamp(amount, 0, 1) });
  // At the cap keep existing paint, rather than silently deleting an old patch.
  return next;
}

export function oilEffects({ launcher = [], tip = [], material = "stock", tipId = "" } = {}) {
  const dose = zone => (zone === "tip" ? tip : launcher)
    .filter(s => s.zone === zone).reduce((n, s) => n + s.amount, 0);
  const transmission = dose("transmission");
  const wet = 1 - Math.exp(-transmission / 2.2);
  const excess = clamp((transmission - 6) / 12, 0, 1);
  // Fixed pull work: lubrication recovers some loss, never creates energy.
  const efficiency = clamp(.72 + .16 * wet - .22 * excess ** 2, .5, .88);
  const support = 1 - Math.exp(-dose("support") / 2.4);
  const pull = 1 - Math.exp(-dose("pull") / 2.4);
  const contact = 1 - Math.exp(-dose("tip") / 2);
  const rubber = material === "rubber" || (material === "stock" && tipId === "tip.rubber_balance");
  const sensitivity = rubber ? .65 : .48;
  return {
    transmission, efficiency, excess, support, pull, contact,
    traction: 1 - sensitivity * contact,
    groundSpin: 1 - .2 * contact + .12 * clamp((dose("tip") - 6) / 12, 0, 1),
  };
}

export function maintenanceForLoadout(state, loadout, launcher) {
  const maintenance = normalizeMaintenance(state);
  const tipId = loadout.build.tip;
  return {
    launcher: activeLauncherOil(maintenance.launcher, launcher),
    tip: maintenance.tops[oilKey(loadout, tipId)] ?? [],
    tipId, material: loadout.customizations?.[tipId]?.material ?? "stock",
  };
}

export function launchOilResponse(effects, power) {
  // Hand support has a force threshold. The rack pulls to a fixed physical side;
  // slip rotates the release direction towards it, with no random oil penalty.
  const demand = clamp(power, .35, 2);
  const supportLimit = 1.12 - effects.support * .53;
  const pullLimit = 1.14 - effects.pull * .58;
  const slip = Math.max(0, demand - supportLimit);
  const heldWork = Math.min(1, pullLimit / demand);
  return {
    spinFactor: Math.sqrt(effects.efficiency / .72 * heldWork),
    direction: slip * .48,
    tilt: slip * .18,
    heldWork,
  };
}
