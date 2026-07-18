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

  it("普通出射会被护圈反弹而不是立即判定撞飞", () => {
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
    battle.player.velocity = { x: 6, y: 0 };

    battle.step(1 / 60, { x: 0, y: 0 });

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
