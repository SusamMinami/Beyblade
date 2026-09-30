import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { calculateBuild } from "../src/core/assembly-calculator.js";
import { DEFAULT_BUILD, PARTS } from "../src/data/parts.js";
import { launchState } from "../src/core/top-dynamics.js";
import { launcherLaunchState } from "../src/core/launcher-physics.js";
import { LAUNCHER_PARTS, normalizeLauncher, activeLauncherOil } from "../src/core/launcher-state.js";
import { oilEffects, launchOilResponse } from "../src/core/maintenance-state.js";
import { BattleSimulation } from "../src/core/battle-simulation.js";
import { migrateProgression, purchasePart } from "../src/core/progression.js";
import { getArena } from "../src/data/arenas.js";
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const checks = [], table = [];
const standard = calculateBuild(DEFAULT_BUILD);
const loads = [standard, ...PARTS.map(p => calculateBuild({ ...DEFAULT_BUILD, [p.type]: p.id }))];
const wet = oilEffects({ launcher: ["transmission", "support", "pull"].flatMap(zone =>
  Array.from({ length: 5 }, () => ({ zone, amount: 1 }))) });
for (const build of loads) for (const power of [.35, .86, 1]) for (const angle of [-.8, 0, .8]) {
  for (const oil of [oilEffects(), wet]) {
    const opts = { power, angle, height: .6, direction: 1.2 };
    const old = launchState(build, opts);
    const response = launchOilResponse(oil, power);
    old.spin *= response.spinFactor;
    const { x, y } = old.velocity, speed = Math.hypot(x, y);
    old.velocity = { x: x * Math.cos(response.direction) - y * Math.sin(response.direction),
      y: x * Math.sin(response.direction) + y * Math.cos(response.direction) };
    old.tilt = Math.hypot(old.tiltVector.x - y / speed * response.tilt,
      old.tiltVector.y + x / speed * response.tilt);
    const actual = launcherLaunchState(build, null, opts, oil);
    near(old.spin, actual.spin); near(old.tilt, actual.tilt);
    near(old.velocity.x, actual.velocity.x); near(old.velocity.y, actual.velocity.y);
  }
}
checks.push("Reference launcher preserves dry/wet baseline across real builds, force and tilt");
for (const rack of LAUNCHER_PARTS.filter(p => p.slot === "rack"))
  for (const gear of LAUNCHER_PARTS.filter(p => p.slot === "transmission"))
    for (const coupler of LAUNCHER_PARTS.filter(p => p.slot === "coupler")) {
      const config = normalizeLauncher({ build: { rack: rack.id, transmission: gear.id, coupler: coupler.id } });
      for (const build of loads) for (const power of [.35, .86, 1]) {
        const state = launcherLaunchState(build, config, { power, angle: .4 }, wet);
        const t = state.launcherTelemetry;
        assert.ok(Object.values(t).filter(v => typeof v === "number").every(Number.isFinite));
        near(t.inputWork, t.kinetic + t.residualEnergy + t.springEnergy + t.releaseLoss + t.transmissionLoss + t.unusedEnergy);
        assert.ok(t.kinetic <= t.inputWork && t.inputWork <= t.inputBudget);
        const dry = launcherLaunchState(build, config, { power, angle: .4 });
        const old = launchState(build, { power, angle: .4 });
        // Oil may redirect the release; dry equipment does not amplify translation.
        near(Math.hypot(dry.velocity.x, dry.velocity.y), Math.hypot(old.velocity.x, old.velocity.y));
      }
      const sim = () => new BattleSimulation({ playerBuild: standard, enemyBuild: standard,
        arena: getArena("standard"), launchers: { player: config } });
      const normal = sim(), explicit = sim();
      normal.launch({ power: .35 + 200 / 255 * .65, height: 115 / 255, direction: .4, angle: 40 / 127 });
      explicit.launchExplicit({ p: 200, h: 115, d: 4, a: 40 }, { p: 200, h: 115, d: 0, a: 0 });
      near(normal.player.spin, explicit.player.spin); near(normal.player.tilt, explicit.player.tilt);
      assert.deepEqual(normal.snapshot().launchers, explicit.snapshot().launchers);
      const t = launcherLaunchState(standard, config, { power: .86, angle: .35 }).launcherTelemetry;
      table.push({ parts: `${rack.code}/${gear.code}/${coupler.code}`, spin: t.initialSpin,
        effort: t.effort, releaseMs: t.releaseMs, tilt: t.tilt, energy: t.inputWork });
    }
checks.push("27 combinations conserve input energy; normal and quantized launch agree; velocity stays independent");
const invalid = normalizeLauncher({ build: { rack: "launcher.coupler.c03" }, colors: { shell: "<script>" } }, []);
assert.deepEqual(invalid, normalizeLauncher());
const before = migrateProgression({ version: 2, coins: 500 });
const purchase = purchasePart(before, "launcher.transmission.t02");
assert.ok(purchase.ok); assert.equal(purchase.progression.coins, 280);
assert.equal(before.coins, 500);
assert.ok(migrateProgression(purchase.progression).ownedPartIds.includes("launcher.transmission.t02"));
assert.equal(purchasePart(purchase.progression, "launcher.transmission.t02").ok, false);
assert.deepEqual(normalizeLauncher({ build: { transmission: "launcher.transmission.t02" } }, before.ownedPartIds).build,
  normalizeLauncher().build);
checks.push("Existing economy buys once; migration validates slots, colors and ownership");
const samples = [{ mesh: "Export_T01_input_rotor__steel", zone: "transmission", amount: 1 },
  { mesh: "Export_T02_input_rotor__steel", zone: "transmission", amount: 1 }];
assert.equal(activeLauncherOil(samples).length, 1);
assert.equal(activeLauncherOil(samples)[0].mesh, samples[0].mesh);
assert.equal(activeLauncherOil(samples, { build: { transmission: "launcher.transmission.t02" } })[0].mesh, samples[1].mesh);
checks.push("Removed cartridge oil cannot transfer into the newly mounted cartridge");
const bounded = launcherLaunchState(standard, null, { power: NaN, angle: Infinity, height: -Infinity });
assert.ok(Number.isFinite(bounded.spin) && Number.isFinite(bounded.tilt));
await mkdir("../.impeccable/review/launcher-integration", { recursive: true });
await writeFile("../.impeccable/review/launcher-integration/physics.json", JSON.stringify({ checks, table }, null, 2));
console.log(`PASS: ${checks.length} launcher performance contracts, 27 combinations`);
