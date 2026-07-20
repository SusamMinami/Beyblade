import { describe, expect, it } from "vitest";
import {
  createDefaultLoadouts,
  LOADOUT_COUNT,
  migrateLoadouts,
} from "../src/core/loadouts.js";
import { DEFAULT_BUILD } from "../src/data/parts.js";

describe("loadouts", () => {
  it("创建三个可独立修改的出战槽位", () => {
    const loadouts = createDefaultLoadouts();

    expect(loadouts).toHaveLength(LOADOUT_COUNT);
    loadouts[0].build.attackRing = "attack_ring.stamina_arc";
    expect(loadouts[1].build).toEqual(DEFAULT_BUILD);
  });

  it("将旧版单配置存档放入第一个槽位", () => {
    const result = migrateLoadouts({
      build: {
        ...DEFAULT_BUILD,
        tip: "tip.metal_stamina",
      },
      colors: { ring: "#111111", core: "#222222" },
    });

    expect(result.loadouts[0].build.tip).toBe("tip.metal_stamina");
    expect(result.loadouts[0].colors).toEqual({
      ring: "#111111",
      core: "#222222",
    });
    expect(result.loadouts[1].build).toEqual(DEFAULT_BUILD);
  });

  it("修正越界槽位和无效零件", () => {
    const result = migrateLoadouts({
      activeLoadoutIndex: 99,
      loadouts: [
        {
          build: { tip: "attack_ring.smash_three" },
          colors: {},
        },
      ],
    });

    expect(result.activeLoadoutIndex).toBe(2);
    expect(result.loadouts[0].build.tip).toBe(DEFAULT_BUILD.tip);
  });

  it("迁移并规范化每个出战槽的零件 DIY 参数", () => {
    const result = migrateLoadouts({
      loadouts: [
        {
          build: DEFAULT_BUILD,
          customizations: {
            "attack_ring.balance_six": {
              shape: 180,
              size: 2,
              height: 0.2,
              material: "unknown",
              symmetry: 5,
            },
          },
        },
      ],
    });

    expect(
      result.loadouts[0].customizations["attack_ring.balance_six"],
    ).toEqual({
      shape: 100,
      size: 1.24,
      height: 0.72,
      material: "stock",
      symmetry: 2,
    });
    expect(result.loadouts[1].customizations).toEqual({});
  });
});
