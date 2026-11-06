import { describe, expect, it } from "vitest";
import { damageBand, partDamageReading, sectorPath } from "../src/ui/battle-damage-panel.js";
import { calculateBuild } from "../src/core/assembly-calculator.js";
import { DEFAULT_BUILD } from "../src/data/parts.js";
import { createStructure, deriveStructure } from "../src/core/top-structure.js";

describe("battle damage readings", () => {
  it("distinguishes healthy, light, worn, heavy and critical presentation bands", () => {
    expect([0, .01, .25, .55, .551, .85, 1].map(damageBand))
      .toEqual(["sound", "light", "worn", "worn", "heavy", "critical", "critical"]);
  });
  it("never substitutes average health for the worst localized damage", () => {
    const build = calculateBuild(DEFAULT_BUILD);
    const structure = createStructure(build);
    structure.parts[0].sectors[3] = .8;
    deriveStructure(build, structure);
    const reading = partDamageReading(structure.parts[0]);
    expect(reading.health).toBe(90);
    expect(reading.worst).toBe(80);
    expect(reading.sector).toBe(4);
    expect(reading.band).toBe("heavy");
    expect(reading.shed).toBe(true);
    expect(reading.sectors.filter(sector => sector.damage > 0)).toHaveLength(1);
  });
  it("reports healthy defaults and does not mutate simulation state", () => {
    const part = createStructure(calculateBuild(DEFAULT_BUILD)).parts[0];
    const before = structuredClone(part);
    expect(partDamageReading(part)).toMatchObject({ health: 100, worst: 0, band: "sound", shed: false });
    expect(part).toEqual(before);
  });
  it("shows shed mass only when the solver actually reports it", () => {
    const part = { health: .9, sectors: [.8, 0, 0, 0, 0, 0, 0, 0], lostMass: 0 };
    expect(partDamageReading(part).shed).toBe(false);
  });
  it("creates eight distinct closed wedges without NaN", () => {
    const paths = Array.from({ length: 8 }, (_, i) => sectorPath(i));
    expect(new Set(paths).size).toBe(8);
    expect(paths.every(path => path.startsWith("M") && path.endsWith("Z") && !path.includes("NaN"))).toBe(true);
  });
});
