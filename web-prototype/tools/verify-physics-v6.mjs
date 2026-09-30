import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { BattleSimulation, SIMULATION_VERSION } from "../src/core/battle-simulation.js";
import { calculateBuild } from "../src/core/assembly-calculator.js";
import { DEFAULT_BUILD } from "../src/data/parts.js";
import { ARENAS, SURFACES } from "../src/data/arenas.js";
import { LAUNCHER_PARTS, DEFAULT_LAUNCHER_BUILD, DEFAULT_LAUNCHER_COLORS } from "../src/core/launcher-state.js";
import { sampleArenaContact, arenaHeightAt, controlResponse } from "../src/core/arena-contact.js";
import { createReplay, recordStep, playReplay, FixedBattleClock } from "../src/core/battle-replay.js";
import { applyStructuralImpact } from "../src/core/top-structure.js";
import { assemblySupport, SLOT_Y } from "../src/core/assembly-geometry.js";
import { createTopModel, disposeTopModel } from "../src/render/top-model.js";

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const equal = (a, b, message) => { assert.deepEqual(a, b, message); checks++; };
const base = calculateBuild(DEFAULT_BUILD);
const zero = { x: 0, y: 0 };
const flat = { id: "fixture", groundHeight: 0, wallRadius: 100, ringOutRadius: 101,
  bowlForce: 0, driveZones: [], surfaceAt: () => SURFACES.standard };
const make = (arena = ARENAS.standard, options = {}) => new BattleSimulation({
  playerBuild: base, enemyBuild: base, arena, ...options,
});

for (const arena of Object.values(ARENAS)) {
  for (const r of [0, .5, 2.5, 5, arena.wallRadius]) {
    const p = { x: r, y: 0 }, contact = sampleArenaContact(arena, p);
    check(Math.abs(contact.height - arenaHeightAt(arena, r, 0)) < 1e-12 &&
      Math.abs(Math.hypot(...Object.values(contact.normal)) - 1) < 1e-12, `${arena.id}: shared height/normal ${r}`);
  }
}
for (const join of [.46, .86]) {
  const r = join * ARENAS.composite.wallRadius, e = 1e-5;
  const left = sampleArenaContact(ARENAS.composite, { x: r-e, y: 0 });
  const right = sampleArenaContact(ARENAS.composite, { x: r+e, y: 0 });
  check(Math.abs(left.height-right.height) < 1e-4 &&
    Math.abs(left.gradient.x-right.gradient.x) < 1e-4, `composite: continuous seam ${join}`);
}
equal(controlResponse({ x: .02, y: -.01 }), zero, "stick deadzone");
equal(controlResponse(zero), zero, "release zero");
check(controlResponse({ x: .4, y: 0 }).x < controlResponse({ x: .8, y: 0 }).x, "proportional steering");
for (const tip of ["tip.rubber_balance", "tip.metal_stamina", "tip.flat_attack"]) {
  for (const height of [.72, 1, 1.35]) {
    const build = calculateBuild({ ...DEFAULT_BUILD, tip }, { [tip]: { height } });
    const model = createTopModel(build.selection, undefined, build.customizations);
    const support = assemblySupport(build);
    check(Math.abs(model.userData.contactOffset - support.contactOffset) < 1e-6,
      `${tip}/${height}: contact anchor equals actual mesh bounds`);
    disposeTopModel(model);
  }
}
const edge = make(ARENAS.ruins);
edge.launch();
edge.player.position = { x: ARENAS.ruins.wallRadius + .01, y: 0 };
edge.player.velocity = { x: .1, y: 0 };
edge.step(1/60, { x: -1, y: 0 }, zero);
check(edge.player.edge.falling && edge.player.ground.state === "airborne" &&
  edge.player.controlInfluence === 0 && edge.player.velocity.x > 0, "open edge has no invisible rebound or air steering");
for (let i = 0; i < 30; i++) edge.step(1/60, zero, zero);
check(edge.result?.reason === "ring_out", "loss of support settles a ring-out");

// Full restore in persistent pair contact and obstacle contact. Compare every
// complete subsequent state (including event order), not only a final position.
for (const mode of ["pair", "obstacle", "zone", "falling"]) {
  const arena = mode === "obstacle" ? ARENAS.ruins : ARENAS.standard;
  const a = make(arena), b = make(arena);
  a.launch();
  if (mode === "pair") {
    a.player.position = { x: -.6, y: 0 }; a.enemy.position = { x: .6, y: 0 };
    a.player.velocity = { x: 3, y: 0 }; a.enemy.velocity = { x: -3, y: 0 };
    a._resolveCollision();
  } else if (mode === "obstacle") {
    const o = arena.blockers[0];
    a.player.position = { x: o.x-o.hx-.2, y: o.z };
    a.player.velocity = { x: 4, y: 0 }; a._resolveObstacles(a.player);
  } else if (mode === "zone") {
    a.time = 6.99; a.player.position = { x: -2.35, y: 0 };
  } else {
    a.player.position.x = arena.wallRadius + .3; a.step(1/60);
  }
  applyStructuralImpact(a.player, 25, .8);
  b.restoreState(JSON.parse(JSON.stringify(a.exportState())));
  equal(a.exportState(), b.exportState(), `${mode}: lossless initial restore`);
  for (let frame = 0; frame < 120; frame++) {
    const input = { x: Math.sin(frame * .12)*.5, y: -.1 };
    a.step(1/60, input); b.step(1/60, input);
    assert.deepEqual(a.exportState(), b.exportState(), `${mode}: divergence frame ${frame}`);
  }
  checks++;
  const before = b.exportState();
  const bad = structuredClone(before); bad.simulationVersion = "old";
  assert.throws(() => b.restoreState(bad));
  equal(b.exportState(), before, `${mode}: rejected restore is atomic`);
}
for (const corrupt of [
  s => { delete s.player.spinPhase; },
  s => { delete s.enemy.velocity.y; },
  s => { delete s.player.structure.momentOfInertia; },
  s => { s.enemy.structure.parts[0].sectors[2] = "bad"; },
  s => { s.player.edge.falling = 1; },
  s => { s.tuning.controlScale = "1"; },
]) {
  const sim = make(); sim.launch();
  const before = sim.exportState(), bad = structuredClone(before);
  corrupt(bad);
  assert.throws(() => sim.restoreState(bad), "incomplete state must be rejected");
  equal(sim.exportState(), before, "malformed state leaves live match untouched");
}
const replay = (() => {
  const s = make(flat); s.launch();
  const r = createReplay(s);
  for (let i = 0; i < 240; i++) recordStep(s, r, { x: Math.sin(i*.03)*.7, y: -.2 }, zero);
  const restored = playReplay(make(flat), JSON.parse(JSON.stringify(r)));
  equal(restored.exportState(), s.exportState(), "JSON replay exact");
  return r;
})();
const replayAt = hz => {
  const sim = make(flat).restoreState(replay.initial), clock = new FixedBattleClock();
  let frame = 0;
  for (let rendered = 0; rendered < hz*4; rendered++) clock.advance(1/hz, () => {
    const input = replay.inputs[frame++];
    sim.step(1/60, input.player, input.enemy);
  });
  return sim.exportState();
};
equal(replayAt(30), replayAt(60), "30/60 Hz render batching");
equal(replayAt(120), replayAt(60), "120/60 Hz render batching");

// Export canonical numeric configuration from the real Web data. Native assets
// use these arena and launcher records; no second sample inventory is created.
const arenaRecords = Object.fromEntries(Object.values(ARENAS).map(arena => {
  const { surfaceAt, ...record } = arena;
  return [arena.id, { ...record, surfaces: [0, 3.1, 5.9].map(radius => ({ radius, ...surfaceAt(radius) })) }];
}));
const catalog = { version: SIMULATION_VERSION, arenas: arenaRecords, slotY: SLOT_Y,
  launcherParts: LAUNCHER_PARTS, defaultLauncherBuild: DEFAULT_LAUNCHER_BUILD,
  defaultLauncherColors: DEFAULT_LAUNCHER_COLORS };

const fixtures = [];
const cases = [
  ...Object.values(ARENAS).map(arena => ({ id: arena.id, arena })),
  { id: "custom-left", arena: ARENAS.metal, options: {
    playerBuild: calculateBuild({ ...DEFAULT_BUILD, weightDisc: "weight_disc.eccentric",
      tip: "tip.metal_stamina" }, { [DEFAULT_BUILD.attackRing]: { size: 1.24, height: .72, shape: 70, symmetry: 3 } }),
    launchers: { player: { build: { rack: "launcher.rack.r02", transmission: "launcher.transmission.t02",
      coupler: "launcher.coupler.c02" } } },
    maintenance: { player: { launcher: [{ mesh: "support", zone: "support", amount: 5 }],
      tip: [{ mesh: "tip", zone: "tip", amount: 3 }], tipId: "tip.metal_stamina" } },
  }, launch: { power: .93, direction: .7, angle: -.6, spinDirection: -1 } },
  { id: "draw", arena: ARENAS.standard, setup: sim => {
    sim.player.spin = sim.enemy.spin = 2.001;
    sim.player.velocity = { ...zero }; sim.enemy.velocity = { ...zero };
  } },
  { id: "edge", arena: ARENAS.ruins, setup: sim => {
    sim.player.position = { x: 6.95, y: 0 }; sim.player.velocity = { x: .1, y: 0 };
  } },
  { id: "impact", arena: ARENAS.ruins, setup: sim => {
    sim.player.position = { x: -.6, y: 0 }; sim.enemy.position = { x: .6, y: 0 };
    sim.player.velocity = { x: 3, y: 0 }; sim.enemy.velocity = { x: -3, y: 0 };
  } },
];
for (const c of cases) {
  const sim = make(c.arena, c.options);
  sim.launch(c.launch); c.setup?.(sim);
  const fixture = { id: c.id, options: c.options ?? {}, launch: c.launch ?? {},
    initial: sim.exportState(), inputs: [], checkpoints: [] };
  for (let f = 0; f < 1800 && sim.phase === "running"; f++) {
    const player = { x: Math.sin(f*.037)*.65, y: Math.cos(f*.021)*.45 };
    const enemy = f % 180 < 90 ? null : { x: Math.cos(f*.028)*.4, y: -.2 };
    fixture.inputs.push({ player, enemy });
    sim.step(1/60, player, enemy);
    if ([0, 14, 59, 179, 479].includes(f) || sim.phase === "finished" || f === 1799) {
      fixture.checkpoints.push({ frame: f+1, state: sim.exportState() });
    }
  }
  check(sim.phase === "finished", `${c.id}: bounded deterministic match completes`);
  fixtures.push(fixture);
}
await mkdir("../resources/physics", { recursive: true });
await writeFile("../resources/physics/v6_catalog.json", JSON.stringify(catalog, null, 2));
await writeFile("../resources/physics/v6_fixtures.json", JSON.stringify({ version: SIMULATION_VERSION, fixtures }));
await mkdir("../.impeccable/review/physics-v6", { recursive: true });
await writeFile("../.impeccable/review/physics-v6/numeric.json", JSON.stringify({
  version: SIMULATION_VERSION, checks, cases: fixtures.map(f => ({
    id: f.id, frames: f.inputs.length, result: f.checkpoints.at(-1).state.result,
  })),
}, null, 2));
console.log(`v6 Web: ${checks} checks passed; ${fixtures.length} native parity fixtures exported.`);
