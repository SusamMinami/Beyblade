import { describe, expect, it } from "vitest";
import { Object3D, PerspectiveCamera, Vector3 } from "three";
import { calculateBuild, getBuildRatings } from "../src/core/assembly-calculator.js";
import { BattleSimulation } from "../src/core/battle-simulation.js";
import { applyStructuralImpact } from "../src/core/top-structure.js";
import { launchState, bodyToWorld, resolveDiskContact, applyGroundContact,
  signedSpin, lossTorques } from "../src/core/top-dynamics.js";
import { getBuildMeasurements } from "../src/core/build-measurements.js";
import { DEFAULT_BUILD } from "../src/data/parts.js";
import { SURFACES } from "../src/data/arenas.js";
import { applyBattlePose, screenControlToWorld } from "../src/render/battle-pose.js";
import { normalizeCampaign, settleMission } from "../src/core/campaign-state.js";
import { getBattleReward, TUTORIAL_STAGE } from "../src/core/progression.js";
import { normalizeBattleNotes } from "../src/core/growth-state.js";
import { FrameSyncProvider } from "../src/network/frame_sync_provider.js";
import { AsyncVerifyProvider } from "../src/network/async_verify_provider.js";
import { oilEffects } from "../src/core/maintenance-state.js";
import { launcherLaunchState } from "../src/core/launcher-physics.js";

const base = calculateBuild(DEFAULT_BUILD);
const flat = { id: "test", wallRadius: 1000, ringOutRadius: 1001, bowlForce: 0,
  driveZones: [], surfaceAt: () => SURFACES.standard };
const zero = { x: 0, y: 0 };
function simulation(options = {}) {
  const sim = new BattleSimulation({ playerBuild: base, enemyBuild: base, arena: flat, ...options });
  sim.launch({ power: 1, height: 0 });
  for (const top of [sim.player, sim.enemy]) top.velocity = { ...zero };
  return sim;
}
const energy = t => .5 * t.structure.totalMass * (t.velocity.x ** 2 + t.velocity.y ** 2) +
  .5 * t.structure.momentOfInertia * t.spin ** 2;
const pairEnergy = sim => energy(sim.player) + energy(sim.enemy);
const angular = t => t.structure.momentOfInertia * signedSpin(t) +
  t.structure.totalMass * (t.position.y * t.velocity.x - t.position.x * t.velocity.y);
const nearVector = (a, b, digits = 9) => {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
};

describe("v5 predictable physics", () => {
  it("launch rotates locally; all actual parts use the same full-power energy", () => {
    const original = launchState(base, { angle: .8, direction: .2 });
    for (const turn of [.3, Math.PI / 2, Math.PI, -1.4]) {
      const state = launchState(base, { angle: .8, direction: .2 + turn });
      nearVector(state.velocity, bodyToWorld(original.velocity.x, original.velocity.y, -turn));
      nearVector(state.tiltVector, bodyToWorld(original.tiltVector.x, original.tiltVector.y, -turn));
    }
    const heavy = calculateBuild({ ...DEFAULT_BUILD, weightDisc: "weight_disc.heavy_outer" });
    expect(heavy.momentOfInertia * launchState(heavy, { power: 1, height: 0 }).spin ** 2)
      .toBeCloseTo(base.momentOfInertia * base.maxSpinSpeed ** 2, 9);
  });

  it("direct and explicit launches share the preview state, including maintenance", () => {
    const maintenance = { player: { launcher: [{ mesh: "support_grip", zone: "support", amount: 8 }] } };
    const sim = simulation({ maintenance });
    const params = { power: .35 + 200 / 255 * .65, height: 95 / 255, direction: .3, angle: 40 / 127 };
    sim.launch(params);
    const state = launcherLaunchState(base, undefined, params, oilEffects(maintenance.player));
    nearVector(sim.player.velocity, state.velocity);
    nearVector(sim.player.tiltVector, state.tiltVector);
    const direct = sim.player.spin;
    sim.launchExplicit({ p: 200, h: 95, d: 3, a: 40 }, { p: 200, h: 95, d: 3, a: 40 });
    nearVector(sim.player.velocity, state.velocity);
    expect(sim.player.spin).toBeCloseTo(direct, 10);
    const clean = launcherLaunchState(base, undefined, { ...params, direction: params.direction + Math.PI });
    nearVector(sim.enemy.velocity, clean.velocity);
  });

  it("camera right projects right at every azimuth", () => {
    const camera = new PerspectiveCamera(40, .6, .1, 100);
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8;
      camera.position.set(Math.sin(a) * 10, 8, Math.cos(a) * 10);
      camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
      const control = screenControlToWorld(camera, { x: 1, y: 0 });
      const start = new Vector3().project(camera);
      const moved = new Vector3(control.x, 0, control.y).project(camera);
      expect(moved.x).toBeGreaterThan(start.x);
      const up = screenControlToWorld(camera, { x: 0, y: -1 });
      expect(new Vector3(up.x, 0, up.y).project(camera).y).toBeGreaterThan(start.y);
    }
  });

  it("fixed lean remains fixed through a complete visible spin cycle", () => {
    const model = new Object3D();
    const state = { tilt: .62, tiltVector: { x: .62 / Math.sqrt(2), y: .62 / Math.sqrt(2) } };
    for (let i = 0; i <= 64; i++) {
      applyBattlePose(model, state, i * Math.PI / 32);
      const axis = new Vector3(0, 1, 0).applyQuaternion(model.quaternion);
      expect(Math.acos(axis.y)).toBeCloseTo(.62, 12);
      const tip = new Vector3(0, -.5, 0).applyQuaternion(model.quaternion);
      const origin = axis.clone().multiplyScalar(.5);
      expect(tip.add(origin).length()).toBeLessThan(1e-12);
    }
  });

  it.each(["spin_out", "ring_out", "break", "time"])("symmetric %s yields a draw, independent of actor order", reason => {
    const sim = simulation();
    for (const top of [sim.player, sim.enemy]) {
      top.spin = base.maxSpinSpeed;
      top.tilt = 0; top.tiltVector = { ...zero };
      if (reason === "spin_out") top.spin = 2.01;
      if (reason === "ring_out") top.position.x = 1002;
      if (reason === "break") top.durability = 0;
    }
    if (reason === "time") sim.time = 75;
    sim.step(1 / 60, zero, zero);
    expect(sim.result.winner).toBe("draw");
    const reversed = simulation();
    reversed.player = sim.enemy; reversed.enemy = sim.player;
    reversed.time = sim.time; reversed._checkResult();
    expect(reversed.result.winner).toBe("draw");
  });

  it("mixed same-step eliminations retain both reasons; draws never grant progress", () => {
    const sim = simulation();
    sim.player.spin = 0; sim.enemy.durability = 0;
    sim._checkResult();
    expect(sim.result.eliminations).toEqual({ player: "spin_out", enemy: "break" });
    const settled = settleMission(normalizeCampaign(), { missionId: "first-echo", battleId: "draw-1",
      result: sim.result, durabilityRatio: 1, loadout: { build: DEFAULT_BUILD } });
    expect(settled.ok).toBe(true);
    expect(settled.cleared).toBe(false);
    expect(normalizeCampaign(settled.campaign).journal[0].winner).toBe("draw");
    expect(getBattleReward({ won: false, draw: true,
      tutorial: { stage: TUTORIAL_STAGE.FIRST_BATTLE, firstRewardClaimed: false } })).toBe(0);
    expect(normalizeBattleNotes({ "loadout-1": { build: DEFAULT_BUILD, winner: "draw", time: 1 } })["loadout-1"].winner).toBe("draw");
  });

  it("opposite damage directions produce opposite drift and axis response", () => {
    const a = simulation(), b = simulation();
    for (const [sim, angle] of [[a, 0], [b, Math.PI]]) {
      sim.player.position = { ...zero };
      for (let i = 0; i < 4; i++) applyStructuralImpact(sim.player, 22, angle);
      for (let i = 0; i < 30; i++) {
        sim._integrateTop(sim.player, zero, 1 / 60, false);
        sim._updateTilt(sim.player, 1 / 60);
      }
    }
    expect(Math.hypot(a.player.position.x, a.player.position.y)).toBeGreaterThan(1e-5);
    nearVector(a.player.position, { x: -b.player.position.x, y: -b.player.position.y });
    nearVector(a.player.tiltVector, { x: -b.player.tiltVector.x, y: -b.player.tiltVector.y });
    expect(a.player.spin).toBeCloseTo(b.player.spin, 10);
  });

  it("directional collision response rotates with the force", () => {
    const a = simulation(), b = simulation();
    a._applyCollisionImbalance(a.player, 1, SURFACES.standard, 8, { x: 1, y: 0 });
    b._applyCollisionImbalance(b.player, 1, SURFACES.standard, 8, { x: 0, y: 1 });
    a._updateTilt(a.player, 1 / 60); b._updateTilt(b.player, 1 / 60);
    nearVector(b.player.tiltVector, bodyToWorld(a.player.tiltVector.x, a.player.tiltVector.y, -Math.PI / 2));
  });

  it("disk impulses conserve momentum and never create energy, for both spin directions", () => {
    for (let i = 1; i <= 160; i++) {
      const sim = simulation();
      const a = sim.player, b = sim.enemy;
      a.position = { x: -.69, y: 0 }; b.position = { x: .69, y: 0 };
      a.velocity = { x: i % 9 + .2, y: Math.sin(i) * 5 };
      b.velocity = { x: -i % 7, y: Math.cos(i) * 4 };
      a.spin = i % 67; b.spin = i % 53; b.spinDirection = i % 2 ? 1 : -1;
      const before = pairEnergy(sim), momentum = angular(a) + angular(b);
      const px = a.velocity.x * base.totalMass + b.velocity.x * base.totalMass;
      const py = a.velocity.y * base.totalMass + b.velocity.y * base.totalMass;
      resolveDiskContact(a, b, { x: 1, y: 0 }, .69, .69, .7);
      expect(pairEnergy(sim)).toBeLessThanOrEqual(before + 1e-9);
      expect(angular(a) + angular(b)).toBeCloseTo(momentum, 9);
      expect(a.velocity.x * base.totalMass + b.velocity.x * base.totalMass).toBeCloseTo(px, 10);
      expect(a.velocity.y * base.totalMass + b.velocity.y * base.totalMass).toBeCloseTo(py, 10);
    }
  });

  it("same-spin rims slip; opposite equal spins roll at an ideal head-on contact", () => {
    const runs = [1, -1].map(direction => {
      const sim = simulation();
      sim.player.velocity.x = 3; sim.enemy.velocity.x = -3;
      sim.player.spin = sim.enemy.spin = 40; sim.enemy.spinDirection = direction;
      return resolveDiskContact(sim.player, sim.enemy, { x: 1,  y: 0 }, .69, .69, .5);
    });
    expect(Math.abs(runs[0].tangent)).toBeGreaterThan(0);
    expect(runs[1].tangent).toBeCloseTo(0, 12);
  });

  it("ground impulse cannot add translational plus axial energy", () => {
    for (let i = 0; i < 100; i++) {
      const top = simulation().player;
      top.velocity = { x: Math.sin(i) * 7, y: Math.cos(i) * 5 };
      top.tiltVector = { x: .3 * Math.cos(i), y: .4 * Math.sin(i) };
      top.spinDirection = i % 2 ? -1 : 1;
      applyStructuralImpact(top, i % 30, i);
      const before = energy(top);
      applyGroundContact(top, SURFACES.rubber, 1 / 60);
      expect(energy(top)).toBeLessThanOrEqual(before + 1e-9);
    }
  });

  it("tooth separation stays within the remaining spin-energy budget", () => {
    for (const spin of [.001, .1, 2, 40, 100]) {
      const sim = simulation({ tuning: { damageScale: 0 } });
      sim.player.position = { x: -.6, y: 0 }; sim.enemy.position = { x: .6, y: 0 };
      sim.player.spin = sim.enemy.spin = spin;
      const before = pairEnergy(sim);
      sim._resolveCollision();
      expect(pairEnergy(sim)).toBeLessThanOrEqual(before + 1e-10);
    }
  });

  it("persistent contact gives one hit; separated recontact below 120ms gives another", () => {
    const sim = simulation();
    const collide = () => {
      sim.player.position = { x: -.6, y: 0 }; sim.enemy.position = { x: .6, y: 0 };
      sim.player.velocity = { x: 3, y: 0 }; sim.enemy.velocity = { x: -3, y: 0 };
      sim._resolveCollision();
    };
    collide(); collide();
    expect(sim.player.stats.hits).toBe(1);
    sim.enemy.position.x = 4; sim._resolveCollision();
    sim.time += 1 / 60;
    collide();
    expect(sim.player.stats.hits).toBe(2);
  });

  it("obstacle side-swipe dissipates energy and recontact damages again", () => {
    const sim = simulation({ arena: { ...flat, blockers: [{ x: 0, z: 0, hx: 1, hz: 1 }] } });
    const top = sim.player;
    const collide = () => {
      top.position = { x: -1.5, y: 0 }; top.velocity = { x: 4, y: 2 };
      const before = energy(top);
      sim._resolveObstacles(top);
      expect(energy(top)).toBeLessThan(before);
      expect(top.velocity.x).toBeLessThan(0);
    };
    collide(); const revision = top.structure.revision;
    top.position.x = -3; sim._resolveObstacles(top);
    collide();
    expect(top.structure.revision).toBe(revision + 1);
  });

  it("the whole-step spin budget includes impacts", () => {
    const sim = simulation();
    sim.player.position = { x: -.6, y: 0 }; sim.enemy.position = { x: .6, y: 0 };
    sim.player.velocity.x = 3; sim.enemy.velocity.x = -3;
    sim.step(1 / 60, zero, zero);
    const b = sim.player.spinBudget;
    expect(b.contact).not.toBe(0);
    expect(b.before + b.supply - b.natural - b.scrape - b.ground - b.contact).toBeCloseTo(b.after, 12);
    expect(sim.player.spinLossRate).toBeCloseTo((b.before - b.after) * 60, 12);
  });

  it("ratings follow the declared measured ordering and share the cache", () => {
    const heavy = calculateBuild({ ...DEFAULT_BUILD, weightDisc: "weight_disc.heavy_outer" });
    const builds = [base, heavy, calculateBuild(DEFAULT_BUILD, { [DEFAULT_BUILD.attackRing]: { size: .78 } }),
      calculateBuild(DEFAULT_BUILD, { [DEFAULT_BUILD.attackRing]: { size: 1.24 } })];
    for (const a of builds) for (const b of builds) {
      expect(Math.sign(getBuildRatings(a).续航 - getBuildRatings(b).续航))
        .toBe(Math.sign(getBuildMeasurements(a).freeSeconds - getBuildMeasurements(b).freeSeconds));
      expect(Math.sign(getBuildRatings(a).耐久 - getBuildRatings(b).耐久))
        .toBe(Math.sign(getBuildMeasurements(b).worstDamage - getBuildMeasurements(a).worstDamage));
    }
    expect(getBuildMeasurements(base)).toBe(getBuildMeasurements(calculateBuild(DEFAULT_BUILD)));
    expect(getBuildMeasurements(heavy).freeSeconds).toBeGreaterThan(getBuildMeasurements(base).freeSeconds);
  });

  it("metal tip slides farther and spins longer than the rubber tip", () => {
    const runs = ["tip.rubber_balance", "tip.metal_stamina"].map(tip => {
      const build = calculateBuild({ ...DEFAULT_BUILD, tip });
      const sim = simulation({ playerBuild: build });
      sim.player.velocity = { x: 4, y: 0 }; sim.player.position = { ...zero };
      for (let i = 0; i < 60; i++) sim._integrateTop(sim.player, zero, 1 / 60, false);
      return { distance: sim.player.position.x, duration: getBuildMeasurements(build).freeSeconds };
    });
    expect(runs[1].distance).toBeGreaterThan(runs[0].distance);
    expect(runs[1].duration).toBeGreaterThan(runs[0].duration);
    const top = simulation().player;
    const torque = lossTorques(top, SURFACES.standard).natural;
    expect(torque).toBeGreaterThan(0);
  });

  it("30/60/120Hz presentation batching preserves a fixed-step replay", () => {
    const replay = hz => {
      const sim = simulation();
      let accumulator = 0, frame = 0;
      for (let rendered = 0; rendered < hz * 4; rendered++) {
        accumulator += 1 / hz;
        while (accumulator >= 1 / 60 - 1e-12) {
          sim.step(1 / 60, { x: Math.sin(frame * .03), y: -.2 }, zero);
          frame++; accumulator -= 1 / 60;
        }
      }
      return sim.snapshot();
    };
    expect(replay(30)).toEqual(replay(60));
    expect(replay(120)).toEqual(replay(60));
  });

  it("unmigrated network providers reject the new solver explicitly", () => {
    const sim = simulation();
    expect(() => new FrameSyncProvider(sim, null)).toThrow(/尚未迁移/);
    expect(() => new AsyncVerifyProvider(sim)).toThrow(/尚未支持/);
  });
});
