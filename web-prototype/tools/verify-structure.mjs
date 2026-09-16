import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { BattleSimulation, SIMULATION_VERSION } from "../src/core/battle-simulation.js";
import { calculateBuild } from "../src/core/assembly-calculator.js";
import { applyStructuralImpact, createStructure, deriveStructure } from "../src/core/top-structure.js";
import { driveZoneState } from "../src/core/drive-zones.js";
import { DEFAULT_BUILD } from "../src/data/parts.js";
import { ARENAS } from "../src/data/arenas.js";
import { CAMPAIGN_MISSIONS } from "../src/data/campaign.js";
import { opponentIdentity } from "../src/data/opponent-identities.js";

let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks++; };
const base = calculateBuild(DEFAULT_BUILD);
const make = (options = {}) => {
  const sim = new BattleSimulation({ playerBuild: base, enemyBuild: base,
    arena: ARENAS.standard, seed: 42, ...options });
  sim.launch({ power: 1 });
  return sim;
};
const baseline = createStructure(base);
check(Math.abs(baseline.totalMass - base.totalMass) < 1e-12, "Undamaged mass matches assembly");
check(Math.abs(baseline.momentOfInertia - base.momentOfInertia) < 1e-12, "Undamaged parallel-axis inertia matches assembly");
check(baseline.spinDrag === 0 && baseline.stiffness === 1, "Undamaged structure adds no drag");

const hit = (custom = {}, angle = 0, phase = 0) => {
  const sim = make({ playerBuild: calculateBuild(DEFAULT_BUILD, { [DEFAULT_BUILD.attackRing]: custom }) });
  sim.player.spinPhase = phase;
  applyStructuralImpact(sim.player, 20, angle);
  return sim.player;
};
const oneSide = hit();
check(oneSide.structure.parts[0].sectors[0] > oneSide.structure.parts[0].sectors[4], "Impact is localized to incoming side");
check(hit({}, Math.PI).structure.parts[0].sectors[4] === oneSide.structure.parts[0].sectors[0], "Opposite contact damages opposite body sector");
check(hit({}, 0, Math.PI).structure.parts[0].sectors[4] === oneSide.structure.parts[0].sectors[0], "Spin phase rotates damage coordinates deterministically");
check(hit({ material: "alloy" }).structure.parts[0].worst < hit({ material: "polymer" }).structure.parts[0].worst, "Same impulse: alloy resists damage better than polymer");
check(hit({ height: .72, size: 1.24, shape: 100 }).structure.parts[0].worst >
  hit({ height: 1.3, size: .8 }).structure.parts[0].worst, "Thin large lobes concentrate damage");
const damaged = make();
for (let i = 0; i < 4; i++) applyStructuralImpact(damaged.player, 22, 0);
check(damaged.player.structure.totalMass < base.totalMass, "Severe local damage sheds effective mass");
check(Math.hypot(...[0,2].map((i) => damaged.player.structure.centerOfMass[i])) > .005, "Missing mass shifts COM");
check(damaged.player.structure.momentOfInertia < base.momentOfInertia, "Damage updates inertia");
check(damaged.player.spin === base.maxSpinSpeed * (1 - .45 * .035), "Shedding never creates angular speed");
for (let i = 0; i < 600; i++) damaged._updateTilt(damaged.player, 1/60);
check(damaged.player.imbalance >= damaged.player.structure.imbalance && damaged.player.imbalance > 0, "Permanent imbalance survives recovery");
const symmetric = createStructure(base);
symmetric.parts[0].sectors.fill(.85);
deriveStructure(base, symmetric);
check(Math.abs(symmetric.centerOfMass[0]) < 1e-10 && Math.abs(symmetric.centerOfMass[2]) < 1e-10, "Symmetric shedding keeps lateral COM centered");
damaged.reset();
check(damaged.player.structure.revision === 0 && damaged.player.structure.imbalance === 0, "Reset clears runtime wear");

const flat = { ...ARENAS.standard, bowlForce: 0, driveZones: [{ id: "A", x: 0, y: 0, radius: 1.25 }] };
const zoneRun = ({ bad = false, contest = false, stopped = false } = {}) => {
  const sim = make({ arena: flat });
  sim.player.position = { x: -.7, y: 0 };
  sim.enemy.position = { x: contest ? .7 : 5, y: 0 };
  sim.player.velocity = sim.enemy.velocity = { x: 0, y: 0 };
  sim.player.spin = stopped ? 1 : 32;
  if (bad) {
    // Achieve severe damage through the actual impact function, not derived-field mocks.
    for (let i = 0; i < 11; i++) applyStructuralImpact(sim.player, 24, 0);
  }
  const before = sim.player.spin;
  sim.step(1 / 60, { x: 0, y: 0 }, { x: 0, y: 0 });
  return { sim, delta: sim.player.spin - before };
};
check(zoneRun().delta > 0, "Healthy top gains net spin in a zone");
check(zoneRun({ contest: true }).sim.player.zone.contested, "Both tops share contested occupancy");
check(zoneRun({ contest: true }).sim.player.zone.gain < zoneRun().sim.player.zone.gain * .5, "Contested supply falls per top");
check(zoneRun({ bad: true }).delta < 0, "Damaged top loses net spin despite active zone");
check(zoneRun({ stopped: true }).sim.result.reason === "spin_out", "Stopped top cannot revive");
const collapsing = zoneRun({ bad: true }).sim;
for (let i = 0; i < 600 && !collapsing.result; i++) {
  collapsing.player.position = { x: 0, y: 0 };
  collapsing.player.velocity = { x: 0, y: 0 };
  collapsing.step(1/60, {x:0,y:0}, {x:0,y:0});
}
check(collapsing.result?.cause === "structural_spin_out", "Even continuously held inside the zone, local damage causes structural spin-out");
check(driveZoneState(ARENAS.standard, 7.5).cooling, "Motor has cooldown");
check(driveZoneState(ARENAS.standard, 8.1).active.id === "B", "Zone rotates on schedule");
for (const arena of Object.values(ARENAS)) {
  for (const zone of driveZoneState(arena, 0).zones) {
    check((arena.blockers ?? []).every((o) =>
      Math.hypot(Math.max(Math.abs(zone.x-o.x)-o.hx,0), Math.max(Math.abs(zone.y-o.z)-o.hz,0)) > zone.radius + .7),
    `${arena.id} ${zone.id}: entire zone plus top clearance avoids obstacles`);
  }
}
const lightControl = make({ arena: { ...flat, driveZones: [] } });
const fullControl = make({ arena: { ...flat, driveZones: [] } });
for (const sim of [lightControl, fullControl]) {
  sim.player.position = { x: 0, y: 0 }; sim.player.velocity = { x: 0, y: 0 };
}
lightControl.step(1/60, {x:.1,y:0}, {x:0,y:0});
fullControl.step(1/60, {x:1,y:0}, {x:0,y:0});
check(lightControl.player.velocity.x < fullControl.player.velocity.x * .12, "Analog magnitude affects actual force");

const first = make(), second = make();
for (let i = 0; i < 4600 && !first.result; i++) {
  const control = { x: Math.sin(i * .021), y: Math.cos(i * .037) };
  first.step(1/60, control); second.step(1/60, control);
}
assert.deepEqual(first.snapshot(), second.snapshot()); checks++;
check(first.result !== null, "Deterministic battle terminates");
const obstacleRun = make({ arena: ARENAS.ruins });
obstacleRun.player.position = { x: -2.9, y: -3.1 };
obstacleRun.player.velocity = { x: 0, y: 6 };
obstacleRun._resolveObstacles(obstacleRun.player);
check(obstacleRun.player.structure.revision > 0, "Solid obstacle impact also damages local structure");
const duel = make();
for (let i = 0; i < 4501 && !duel.result; i++) {
  // Symmetric policy comparison: the player also seeks and contests the live motor.
  const own = duel.player, rival = duel.enemy;
  duel.player = rival; duel.enemy = own;
  const activeControl = duel._getEnemyControl();
  duel.player = own; duel.enemy = rival;
  duel.step(1/60, activeControl);
}
check(duel.player.stats.zoneSeconds > 0 && duel.player.stats.hits >= 3, "Active pursuit produces occupied zones and repeated clashes");
check(duel.player.structure.revision > 0 && duel.enemy.structure.revision > 0, "Actual contested play damages both tops");
const activeDuel = { time: duel.time, result: duel.result, player: duel.player.structure, enemy: duel.enemy.structure };
const teeth = make({ tuning: { damageScale: 0 } });
teeth.player.position = { x: -.6, y: 0 }; teeth.enemy.position = { x: .6, y: 0 };
for (const top of [teeth.player, teeth.enemy]) { top.spin = 40; top.velocity = { x: 0, y: 0 }; }
const energy = (sim) => [sim.player, sim.enemy].reduce((sum, top) =>
  sum + .5 * top.structure.momentOfInertia * top.spin ** 2 +
  .5 * top.structure.totalMass * (top.velocity.x ** 2 + top.velocity.y ** 2), 0);
const energyBefore = energy(teeth);
teeth._resolveCollision();
check(energy(teeth) <= energyBefore && teeth.player.velocity.x < 0 && teeth.enemy.velocity.x > 0,
  "Rim contact separates stationary tops without creating mechanical energy");
check(Math.abs(teeth.player.velocity.x * teeth.player.structure.totalMass +
  teeth.enemy.velocity.x * teeth.enemy.structure.totalMass) < 1e-10, "Rim impulses conserve linear momentum");
const cap = zoneRun().sim;
cap.player.spin = base.maxSpinSpeed;
cap.step(1/60, {x:0,y:0}, {x:0,y:0});
check(cap.player.zone.gain === 0, "Motor supplies nothing above its configured speed limit");
const beforeZoneDamage = JSON.stringify(collapsing.player.structure);
collapsing.step(1/60);
check(JSON.stringify(collapsing.player.structure) === beforeZoneDamage, "Finished simulation cannot advance or repair structure");
const outcomes = [];
for (const mission of CAMPAIGN_MISSIONS) {
  const identity = opponentIdentity(mission);
  const sim = make({ arena: ARENAS[mission.arenaId], seed: mission.seed,
    enemyBuild: calculateBuild(mission.enemyBuild, identity.customizations) });
  for (let i = 0; i < 4600 && !sim.result; i++) sim.step(1/60);
  check(Boolean(sim.result), `${mission.id} finishes`);
  check(sim.enemy.stats.zoneSeconds > 0, `${mission.id} AI actually enters a supply zone`);
  outcomes.push({ mission: mission.id, winner: sim.result.winner, cause: sim.result.cause,
    time: +sim.time.toFixed(2), aiZoneSeconds: +sim.enemy.stats.zoneSeconds.toFixed(2),
    idleZoneSeconds: +sim.player.stats.zoneSeconds.toFixed(2), hits: sim.player.stats.hits,
    playerIntegrity: +sim.player.structure.integrity.toFixed(3) });
}
check(outcomes.filter((r) => r.winner === "enemy").length >= 7, "Idle play is beaten by active zone AI in most campaign encounters");
await mkdir("../.impeccable/review/structure", { recursive: true });
await writeFile("../.impeccable/review/structure/physics.json", JSON.stringify({ version: SIMULATION_VERSION, checks, activeDuel, outcomes }, null, 2));
console.log(`PASS ${checks}: structural causality, zone supply, deterministic replay and real campaign AI\n${JSON.stringify(outcomes, null, 2)}`);
