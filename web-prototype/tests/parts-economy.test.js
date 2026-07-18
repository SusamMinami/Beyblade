import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUILD,
  getPart,
  PARTS,
} from "../src/data/parts.js";

describe("part economy data", () => {
  it("为全部零件提供非负整数价格", () => {
    for (const part of PARTS) {
      expect(Number.isInteger(part.price), part.id).toBe(true);
      expect(part.price, part.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("初始配置免费，所有替换零件都需要金币解锁", () => {
    const starterIds = new Set(Object.values(DEFAULT_BUILD));

    for (const part of PARTS) {
      if (starterIds.has(part.id)) {
        expect(getPart(part.id).price, part.id).toBe(0);
      } else {
        expect(part.price, part.id).toBeGreaterThan(0);
      }
    }
  });
});
