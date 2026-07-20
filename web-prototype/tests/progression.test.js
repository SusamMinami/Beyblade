import { describe, expect, it } from "vitest";
import {
  BATTLE_REWARDS,
  getBattleReward,
  getMaterialAccess,
  getPartAccess,
  INITIAL_OWNED_MATERIAL_IDS,
  INITIAL_OWNED_PART_IDS,
  migrateProgression,
  purchaseMaterial,
  purchasePart,
  STORAGE_VERSION,
  TUTORIAL_STAGE,
} from "../src/core/progression.js";
import { PART_MATERIALS } from "../src/core/part-customization.js";
import { getPart } from "../src/data/parts.js";

describe("progression", () => {
  it("将旧存档迁移到 v2，并保留旧配置中已经装备的零件", () => {
    const progression = migrateProgression({
      coins: 215.8,
      build: { attackRing: "attack_ring.smash_three" },
    });

    expect(progression.version).toBe(STORAGE_VERSION);
    expect(progression.coins).toBe(215);
    expect(progression.ownedPartIds).toEqual(
      expect.arrayContaining([
        ...INITIAL_OWNED_PART_IDS,
        "attack_ring.smash_three",
      ]),
    );
    expect(progression.tutorial.stage).toBe(TUTORIAL_STAGE.FIRST_BATTLE);
  });

  it("保留所有出战槽位中已经装备的零件", () => {
    const progression = migrateProgression({
      version: STORAGE_VERSION,
      loadouts: [
        { build: { tip: "tip.metal_stamina" } },
        { build: { attackRing: "attack_ring.smash_three" } },
      ],
    });

    expect(progression.ownedPartIds).toEqual(
      expect.arrayContaining([
        "tip.metal_stamina",
        "attack_ring.smash_three",
      ]),
    );
  });

  it("默认只拥有原装材料，并保留旧存档已经使用的材料", () => {
    const fresh = migrateProgression({
      version: STORAGE_VERSION,
    });
    const migrated = migrateProgression({
      version: STORAGE_VERSION,
      loadouts: [
        {
          customizations: {
            "attack_ring.balance_six": { material: "alloy" },
          },
        },
      ],
      customizations: {
        "tip.round_balance": { material: "rubber" },
      },
    });

    expect(fresh.ownedMaterialIds).toEqual(
      INITIAL_OWNED_MATERIAL_IDS,
    );
    expect(migrated.ownedMaterialIds).toEqual(
      expect.arrayContaining(["stock", "alloy", "rubber"]),
    );
  });

  it("区分已拥有、可购买和金币不足三种零件状态", () => {
    const progression = migrateProgression({
      version: STORAGE_VERSION,
      coins: 180,
    });

    expect(
      getPartAccess(getPart("attack_ring.balance_six"), progression).owned,
    ).toBe(true);
    expect(
      getPartAccess(getPart("attack_ring.stamina_arc"), progression)
        .affordable,
    ).toBe(true);
    expect(
      getPartAccess(getPart("attack_ring.smash_three"), progression)
        .missingCoins,
    ).toBe(80);
  });

  it("购买成功时原子扣款并添加所有权，余额不足时不改变进度", () => {
    const progression = migrateProgression({
      version: STORAGE_VERSION,
      coins: 180,
    });
    const purchased = purchasePart(progression, "tip.flat_attack");
    const rejected = purchasePart(progression, "tip.metal_stamina");

    expect(purchased.ok).toBe(true);
    expect(purchased.progression.coins).toBe(0);
    expect(purchased.progression.ownedPartIds).toContain("tip.flat_attack");
    expect(rejected).toMatchObject({
      ok: false,
      reason: "insufficient_coins",
      missingCoins: 100,
    });
    expect(progression.coins).toBe(180);
  });

  it("材料购买会原子扣款并添加所有权", () => {
    const progression = migrateProgression({
      version: STORAGE_VERSION,
      coins: 360,
    });
    const access = getMaterialAccess(
      PART_MATERIALS.alloy,
      progression,
    );
    const purchased = purchaseMaterial(progression, "alloy");

    expect(access).toMatchObject({
      owned: false,
      affordable: true,
      missingCoins: 0,
    });
    expect(purchased.ok).toBe(true);
    expect(purchased.progression.coins).toBe(0);
    expect(purchased.progression.ownedMaterialIds).toContain("alloy");
    expect(progression.coins).toBe(360);
    expect(progression.ownedMaterialIds).toEqual(["stock"]);
  });

  it("材料余额不足时返回差额且不改变进度", () => {
    const progression = migrateProgression({
      version: STORAGE_VERSION,
      coins: 100,
    });
    const rejected = purchaseMaterial(progression, "carbon");

    expect(rejected).toMatchObject({
      ok: false,
      reason: "insufficient_coins",
      missingCoins: 320,
    });
    expect(progression.coins).toBe(100);
    expect(progression.ownedMaterialIds).toEqual(["stock"]);
  });

  it("首战无论胜负固定奖励 180，之后区分胜负奖励", () => {
    const firstBattle = {
      stage: TUTORIAL_STAGE.FIRST_BATTLE,
      firstRewardClaimed: false,
    };
    expect(getBattleReward({ won: false, tutorial: firstBattle })).toBe(
      BATTLE_REWARDS.FIRST_BATTLE,
    );
    expect(
      getBattleReward({
        won: true,
        tutorial: { ...firstBattle, firstRewardClaimed: true },
      }),
    ).toBe(BATTLE_REWARDS.WIN);
    expect(
      getBattleReward({
        won: false,
        tutorial: {
          stage: TUTORIAL_STAGE.SECOND_BATTLE,
          firstRewardClaimed: true,
        },
      }),
    ).toBe(BATTLE_REWARDS.LOSS);
  });
});
