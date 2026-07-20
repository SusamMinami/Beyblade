import { describe, expect, it } from "vitest";
import { calculateBuild } from "../src/core/assembly-calculator.js";

const STANDARD_BUILD = {
  attackRing: "attack_ring.balance_six",
  coreLock: "core_lock.standard",
  weightDisc: "weight_disc.standard",
  driverShaft: "driver_shaft.standard",
  tip: "tip.rubber_balance",
};

describe("calculateBuild", () => {
  it("合成五件式配置并返回有效战斗参数", () => {
    const result = calculateBuild(STANDARD_BUILD);

    expect(result.parts).toHaveLength(5);
    expect(result.totalMass).toBeCloseTo(1.22);
    expect(result.momentOfInertia).toBeCloseTo(0.89);
    expect(result.maxSpinSpeed).toBeCloseTo(65);
    expect(result.durability).toBeGreaterThan(0);
  });

  it("重型外缘配重提高质量和撞击动量但降低控制", () => {
    const standard = calculateBuild(STANDARD_BUILD);
    const heavy = calculateBuild({
      ...STANDARD_BUILD,
      weightDisc: "weight_disc.heavy_outer",
    });

    expect(heavy.totalMass).toBeGreaterThan(standard.totalMass);
    expect(heavy.collisionMomentum).toBeGreaterThan(
      standard.collisionMomentum,
    );
    expect(heavy.controlResponse).toBeLessThan(standard.controlResponse);
  });

  it("金属续航尖比橡胶尖衰减慢但控制更弱", () => {
    const rubber = calculateBuild(STANDARD_BUILD);
    const metal = calculateBuild({
      ...STANDARD_BUILD,
      tip: "tip.metal_stamina",
    });

    expect(metal.spinDecayPerSecond).toBeLessThan(rubber.spinDecayPerSecond);
    expect(metal.controlResponse).toBeLessThan(rubber.controlResponse);
  });

  it("拒绝缺失或类型错误的零件配置", () => {
    expect(() =>
      calculateBuild({
        ...STANDARD_BUILD,
        tip: "attack_ring.smash_three",
      }),
    ).toThrow(/轴尖/);
  });

  it("DIY 尺寸、高度与材料会进入质量、惯量和质心计算", () => {
    const standard = calculateBuild(STANDARD_BUILD);
    const customized = calculateBuild(STANDARD_BUILD, {
      "attack_ring.balance_six": {
        shape: 70,
        size: 1.2,
        height: 1.25,
        material: "alloy",
        symmetry: 3,
      },
    });

    expect(customized.totalMass).toBeGreaterThan(standard.totalMass);
    expect(customized.momentOfInertia).toBeGreaterThan(
      standard.momentOfInertia,
    );
    expect(customized.centerOfMass[1]).toBeGreaterThan(
      standard.centerOfMass[1],
    );
    expect(customized.attackPower).toBeGreaterThan(standard.attackPower);
  });

  it("默认 DIY 参数不改变既有基准数值", () => {
    const standard = calculateBuild(STANDARD_BUILD);
    const customized = calculateBuild(STANDARD_BUILD, {
      "attack_ring.balance_six": {
        shape: 0,
        size: 1,
        height: 1,
        material: "stock",
        symmetry: 2,
      },
    });

    expect(customized.totalMass).toBeCloseTo(standard.totalMass);
    expect(customized.momentOfInertia).toBeCloseTo(
      standard.momentOfInertia,
    );
    expect(customized.centerOfMass).toEqual(standard.centerOfMass);
  });

  it("偏心零件通过平行轴定理增加组合惯量", () => {
    const eccentric = calculateBuild({
      ...STANDARD_BUILD,
      weightDisc: "weight_disc.eccentric",
    });
    const rawPartInertia = eccentric.parts.reduce(
      (total, part) => total + part.inertia,
      0,
    );

    expect(eccentric.momentOfInertia).toBeGreaterThan(rawPartInertia);
  });
});
