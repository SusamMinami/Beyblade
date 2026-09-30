import { describe, expect, it } from "vitest";
import { calculateBuild } from "../src/core/assembly-calculator.js";
import {
  BattleSimulation,
  BATTLE_RESULT,
} from "../src/core/battle-simulation.js";
import { ARENAS } from "../src/data/arenas.js";

const STANDARD_BUILD = calculateBuild({
  attackRing: "attack_ring.balance_six",
  coreLock: "core_lock.standard",
  weightDisc: "weight_disc.standard",
  driverShaft: "driver_shaft.standard",
  tip: "tip.rubber_balance",
});

describe("BattleSimulation", () => {
  it("相同种子和输入产生相同状态", () => {
    const create = () =>
      new BattleSimulation({
        playerBuild: STANDARD_BUILD,
        enemyBuild: STANDARD_BUILD,
        arena: ARENAS.standard,
        seed: 42,
      });
    const first = create();
    const second = create();
    first.launch({ power: 0.8, direction: -0.1, angle: 0.2 });
    second.launch({ power: 0.8, direction: -0.1, angle: 0.2 });

    for (let frame = 0; frame < 240; frame += 1) {
      const control = { x: Math.sin(frame * 0.05), y: -0.3 };
      first.step(1 / 60, control);
      second.step(1 / 60, control);
    }

    expect(second.snapshot()).toEqual(first.snapshot());
  });

  it("有效碰撞扣除耐久并记录冲量", () => {
    const battle = new BattleSimulation({
      playerBuild: STANDARD_BUILD,
      enemyBuild: STANDARD_BUILD,
      arena: ARENAS.standard,
      seed: 7,
    });
    battle.launch({ power: 1, direction: 0, angle: 0 });
    battle.player.position = { x: -0.45, y: 0 };
    battle.enemy.position = { x: 0.45, y: 0 };
    battle.player.velocity = { x: 7, y: 0 };
    battle.enemy.velocity = { x: -7, y: 0 };
    const durabilityBefore =
      battle.player.durability + battle.enemy.durability;

    battle.step(1 / 60, { x: 0, y: 0 });

    expect(
      battle.player.durability + battle.enemy.durability,
    ).toBeLessThan(durabilityBefore);
    expect(battle.events.some((event) => event.type === "collision")).toBe(
      true,
    );
  });

  it.each([
    { scenario: "撞击加重原有倾斜", launchSign: -1, tiltDeltaSign: 1 },
    { scenario: "反向撞击抵消部分倾斜", launchSign: 1, tiltDeltaSign: -1 },
  ])("诊断模式准确记录倾角、转速与失衡：$scenario", ({ launchSign, tiltDeltaSign }) => {
    const diagnostics = [];
    const battle = new BattleSimulation({
      playerBuild: STANDARD_BUILD,
      enemyBuild: STANDARD_BUILD,
      arena: ARENAS.standard,
      seed: 17,
      diagnostics: true,
      logger: (message, telemetry) => diagnostics.push({
        message,
        telemetry,
        // Copy the real collision-time state before the rest of the step
        // applies axis motion and imbalance recovery.
        observed: Object.fromEntries(["player", "enemy"].map(id => {
          const top = battle[id];
          return [id, {
            tilt: top.tilt,
            tiltVector: { ...top.tiltVector },
            spin: top.spin,
            imbalance: top.imbalance,
            durability: top.durability,
          }];
        })),
      }),
    });
    // Public launch commands initialize tilt and tiltVector together.
    // The enemy launch frame is rotated by PI, so the same signed command
    // makes both tops lean toward, or away from, their point of contact.
    battle.launchExplicit(
      { power_q: 255, height_q: 0, direction_q: 0, angle_q: launchSign * 85 },
      { power_q: 255, height_q: 0, direction_q: 0, angle_q: launchSign * 57 },
    );
    const initialTilts = {};
    for (const id of ["player", "enemy"]) {
      const top = battle[id];
      expect(top.tilt).toBeCloseTo(Math.hypot(top.tiltVector.x, top.tiltVector.y), 12);
      initialTilts[id] = top.tilt;
    }
    battle.player.position = { x: -0.45, y: 0 };
    battle.enemy.position = { x: 0.45, y: 0 };
    battle.player.velocity = { x: 7, y: 0 };
    battle.enemy.velocity = { x: -7, y: 0 };

    battle.step(1 / 60, { x: 0, y: 0 }, { x: 0, y: 0 });

    const collision = battle.events.find((event) => event.type === "collision");
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain("BattleSimulation");
    expect(diagnostics[0].telemetry).toBe(collision.telemetry);
    for (const id of ["player", "enemy"]) {
      const entry = collision.telemetry[id];
      const observed = diagnostics[0].observed[id];
      expect(entry.tiltBefore).toBeCloseTo(initialTilts[id], 5);
      expect(observed.tilt).toBeCloseTo(
        Math.hypot(observed.tiltVector.x, observed.tiltVector.y), 12,
      );
      for (const metric of ["tilt", "spin", "imbalance"]) {
        expect(entry[`${metric}After`]).toBeCloseTo(observed[metric], 5);
        expect(entry[`${metric}Delta`]).toBeCloseTo(
          entry[`${metric}After`] - entry[`${metric}Before`], 5,
        );
      }
      expect(entry.tiltDelta * tiltDeltaSign).toBeGreaterThan(0);
      expect(entry.spinDelta).toBeLessThan(0);
      expect(entry.imbalanceDelta).toBeGreaterThan(0);
      expect(entry.damage).toBeGreaterThan(0);
      expect(entry.durabilityAfter).toBeCloseTo(observed.durability, 5);
      expect(entry.damage).toBeCloseTo(entry.durabilityBefore - entry.durabilityAfter, 5);
    }
    expect(battle.collisionLog).toEqual([collision.telemetry]);
  });

  it("未接触时不生成碰撞诊断、记录或伤害", () => {
    const diagnostics = [];
    const battle = new BattleSimulation({
      playerBuild: STANDARD_BUILD,
      enemyBuild: STANDARD_BUILD,
      arena: ARENAS.standard,
      diagnostics: true,
      logger: (...args) => diagnostics.push(args),
    });
    battle.launch({ power: 1, direction: 0, angle: 0 });
    battle.player.position = { x: -3, y: 0 };
    battle.enemy.position = { x: 3, y: 0 };
    battle.player.velocity = { x: 0, y: 0 };
    battle.enemy.velocity = { x: 0, y: 0 };
    const durabilityBefore = [battle.player.durability, battle.enemy.durability];

    battle.step(1 / 60, { x: 0, y: 0 }, { x: 0, y: 0 });

    expect(diagnostics).toEqual([]);
    expect(battle.collisionLog).toEqual([]);
    expect(battle.events.some(event => event.type === "collision")).toBe(false);
    expect([battle.player.durability, battle.enemy.durability]).toEqual(durabilityBefore);
  });

  it("失衡会抬高倾角、削弱控制，并随稳定性逐步恢复", () => {
    const battle = new BattleSimulation({
      playerBuild: STANDARD_BUILD,
      enemyBuild: STANDARD_BUILD,
      arena: ARENAS.standard,
    });
    battle.launch({ power: 1, direction: 0, angle: 0 });
    battle.player.position = { x: 0, y: 0 };
    battle.player.velocity = { x: 2, y: 0 };
    battle.player.imbalance = 0.8;
    battle.player.tilt = 0.55;
    const initialImbalance = battle.player.imbalance;

    battle._integrateTop(
      battle.player,
      { x: 1, y: 0 },
      1 / 60,
      false,
    );
    const impairedInfluence = battle.player.controlInfluence;

    for (let frame = 0; frame < 240; frame += 1) {
      battle._updateTilt(battle.player, 1 / 60);
    }

    expect(impairedInfluence).toBeLessThan(0.75);
    expect(battle.player.imbalance).toBeLessThan(initialImbalance * 0.25);
  });

  it("低速接触圆滑护圈会逐步回落，保持支撑", () => {
    const battle = new BattleSimulation({
      playerBuild: STANDARD_BUILD,
      enemyBuild: STANDARD_BUILD,
      arena: ARENAS.standard,
    });
    battle.launch({ power: 1, direction: 0, angle: 0 });
    battle.player.position = {
      x: ARENAS.standard.wallRadius + 0.02,
      y: 0,
    };
    battle.player.velocity = { x: .5, y: 0 };

    battle.step(1 / 60, { x: 0, y: 0 });
    // v6 follows the visible slope; the tip is not teleported behind the rim.
    expect(battle.player.position.x).toBeGreaterThan(ARENAS.standard.wallRadius);
    for (let i = 0; i < 29; i++) battle.step(1 / 60, { x: 0, y: 0 });

    expect(battle.player.position.x).toBeLessThan(
      ARENAS.standard.wallRadius,
    );
    expect(battle.player.velocity.x).toBeLessThan(0);
    expect(battle.result).toBeNull();
  });

  it("低转速时会快速失去平移速度并削弱操控影响", () => {
    const createBattle = () =>
      new BattleSimulation({
        playerBuild: STANDARD_BUILD,
        enemyBuild: STANDARD_BUILD,
        arena: ARENAS.standard,
      });
    const lowSpin = createBattle();
    const highSpin = createBattle();
    lowSpin.launch({ power: 1, direction: 0, angle: 0 });
    highSpin.launch({ power: 1, direction: 0, angle: 0 });
    lowSpin.player.position = { x: 0, y: 0 };
    highSpin.player.position = { x: 0, y: 0 };
    lowSpin.player.velocity = { x: 6, y: 0 };
    highSpin.player.velocity = { x: 6, y: 0 };
    lowSpin.player.spin = STANDARD_BUILD.maxSpinSpeed * 0.06;
    highSpin.player.spin = STANDARD_BUILD.maxSpinSpeed;

    for (let frame = 0; frame < 30; frame += 1) {
      lowSpin._integrateTop(lowSpin.player, { x: 1, y: 0 }, 1 / 60, false);
      highSpin._integrateTop(
        highSpin.player,
        { x: 1, y: 0 },
        1 / 60,
        false,
      );
    }

    expect(Math.hypot(lowSpin.player.velocity.x, lowSpin.player.velocity.y))
      .toBeLessThan(
        Math.hypot(
          highSpin.player.velocity.x,
          highSpin.player.velocity.y,
        ) * 0.4,
      );
    expect(lowSpin.player.controlInfluence).toBeLessThan(
      highSpin.player.controlInfluence * 0.25,
    );
  });

  it("较高发射位置会略增平移速度并带来更高初始倾斜", () => {
    const createBattle = () =>
      new BattleSimulation({
        playerBuild: STANDARD_BUILD,
        enemyBuild: STANDARD_BUILD,
        arena: ARENAS.standard,
        seed: 21,
      });
    const low = createBattle();
    const high = createBattle();
    low.launch({ power: 0.86, height: 0.1, angle: 0.25 });
    high.launch({ power: 0.86, height: 0.9, angle: 0.25 });

    expect(Math.hypot(high.player.velocity.x, high.player.velocity.y)).toBeGreaterThan(
      Math.hypot(low.player.velocity.x, low.player.velocity.y),
    );
    expect(high.player.tilt).toBeGreaterThan(low.player.tilt);
  });

  it("能判定停转、撞飞和击破三类结果", () => {
    const battle = new BattleSimulation({
      playerBuild: STANDARD_BUILD,
      enemyBuild: STANDARD_BUILD,
      arena: ARENAS.standard,
    });
    battle.launch({ power: 1, direction: 0, angle: 0 });
    battle.enemy.spin = 0;
    battle.step(1 / 60, { x: 0, y: 0 });
    expect(battle.result.reason).toBe(BATTLE_RESULT.SPIN_OUT);

    battle.reset();
    battle.launch({ power: 1, direction: 0, angle: 0 });
    battle.enemy.position.x = ARENAS.standard.ringOutRadius + 0.1;
    battle.step(1 / 60, { x: 0, y: 0 });
    expect(battle.result.reason).toBe(BATTLE_RESULT.RING_OUT);

    battle.reset();
    battle.launch({ power: 1, direction: 0, angle: 0 });
    battle.enemy.durability = 0;
    battle.step(1 / 60, { x: 0, y: 0 });
    expect(battle.result.reason).toBe(BATTLE_RESULT.BREAK);
  });
});
