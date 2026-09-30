import assert from "node:assert/strict";
import { calculateBuild } from "../src/core/assembly-calculator.js";
import { DEFAULT_BUILD } from "../src/data/parts.js";
import { getArena } from "../src/data/arenas.js";
import { BattleSimulation } from "../src/core/battle-simulation.js";
import { normalizeMaintenance, oilEffects, paintOil, launchOilResponse,
  maintenanceForLoadout } from "../src/core/maintenance-state.js";
import { runMaintenanceTrial } from "../src/core/maintenance-trial.js";

const checks = [];
function check(ok, label) { assert.ok(ok, label); checks.push(label); }
const hit = { mesh: "test", p: [0, 0, 0], n: [0, 1, 0], radius: .1, zone: "transmission" };
const oil = (zone, count) => Array.from({ length: count }, (_, i) => ({
  ...hit, mesh: `test-${i}`, zone, p: [i * .1, 0, 0], amount: 1,
}));
const build = calculateBuild(DEFAULT_BUILD);
const sim = input => new BattleSimulation({ playerBuild: build, enemyBuild: build,
  arena: getArena("standard"), maintenance: input });
const dry = oilEffects();
const good = oilEffects({ launcher: oil("transmission", 6) });
const excess = oilEffects({ launcher: oil("transmission", 25) });
check(good.efficiency > dry.efficiency && good.efficiency < 1 &&
  excess.efficiency < good.efficiency, "Useful lubrication recovers finite loss; excess adds drag");
assert.deepEqual(oilEffects({ launcher: oil("exterior", 30) }), dry);
checks.push("Exterior oil cannot improve the drive");
const slippery = oilEffects({ launcher: [...oil("support", 20), ...oil("pull", 20)] });
check(launchOilResponse(slippery, .35).direction === 0 &&
  launchOilResponse(slippery, .86).direction > 0 &&
  launchOilResponse(slippery, .86).spinFactor < 1, "Grip effects start at a force threshold and lose pull work");
let painted = paintOil([], hit, .4);
painted = paintOil(painted, { ...hit, n: [0, -1, 0] }, .4);
painted = paintOil(painted, hit, .4, true);
check(painted.length === 1 && painted[0].n[1] === -1, "Wiping one face preserves oil on the opposite face");
const saved = normalizeMaintenance({ launcher: oil("transmission", 1000),
  tops: { "loadout-1:tip.rubber_balance": oil("tip", 4), "__proto__": [] } });
check(saved.launcher.length <= 192, "Save normalization bounds sample count");
check(normalizeMaintenance({ launcher: [{ ...hit, amount: Infinity }] }).launcher.length === 0,
  "Nonfinite stored amounts are rejected");
const loadout = { id: "loadout-2", build: { ...DEFAULT_BUILD, tip: "tip.rubber_balance" } };
check(maintenanceForLoadout(saved, loadout).tip.length === 0, "Oil belongs to the actual loadout and equipped part");
const plain = sim(), empty = sim({ player: {} });
plain.launch(); empty.launch();
for (let i = 0; i < 120; i++) { plain.step(1 / 60); empty.step(1 / 60); }
assert.deepEqual(plain.snapshot(), empty.snapshot());
checks.push("Empty maintenance is deterministic and neutral");
for (const explicit of [false, true]) {
  const plain = sim(), wet = sim({ player: { launcher: oil("transmission", 6) } });
  if (explicit) {
    const cmd = { p: 200, h: 115, d: 0, a: 0 };
    plain.launchExplicit(cmd, cmd); wet.launchExplicit(cmd, cmd);
  } else { plain.launch(); wet.launch(); }
  check(wet.player.spin > plain.player.spin, `${explicit ? "Explicit" : "Normal"} launch uses lubrication`);
  assert.deepEqual(plain.player.velocity, wet.player.velocity);
  assert.deepEqual(plain.enemy, wet.enemy);
}
checks.push("Drive oil changes axial work without multiplying forward speed or opponent state");
const baseline = runMaintenanceTrial(build, {});
const contact = runMaintenanceTrial(build, { tip: oil("tip", 8) });
check(contact.distance > baseline.distance && contact.traction < baseline.traction,
  "Oily tip reduces the solver's braking/traction and increases measured coast distance");
check(Number.isFinite(contact.finalSpin), "Bench uses finite dynamics");
console.log(JSON.stringify({ checks, baseline, contact, drive: good, excess }, null, 2));
