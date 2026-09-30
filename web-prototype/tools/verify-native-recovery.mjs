import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { BattleSimulation } from "../src/core/battle-simulation.js";
import { calculateBuild } from "../src/core/assembly-calculator.js";
import { ARENAS } from "../src/data/arenas.js";

const folder = "../.impeccable/review/physics-v6";
const cases = JSON.parse(await readFile(`${folder}/native-recovery.json`, "utf8"));
let comparisons = 0, maxError = 0;
function compare(actual, expected, path) {
  if (typeof expected === "number") {
    assert.equal(typeof actual, "number", path);
    const error = Math.abs(actual - expected);
    assert.ok(error <= 1e-4, `${path}: ${actual} vs ${expected}`);
    maxError = Math.max(maxError, error); comparisons++;
  } else if (expected && typeof expected === "object") {
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), path);
    for (const key of Object.keys(expected)) compare(actual[key], expected[key], `${path}.${key}`);
  } else assert.equal(actual, expected, path);
}
for (const fixture of cases) {
  const state = fixture.initial;
  const [playerBuild, enemyBuild] = state.context.builds.map(b => calculateBuild(b.selection, b.customizations));
  const sim = new BattleSimulation({ playerBuild, enemyBuild, arena: ARENAS[state.context.arena.id] });
  sim.restoreState(state);
  for (const input of fixture.inputs) sim.step(1/60, input.player, input.enemy);
  compare(sim.exportState(), fixture.final, fixture.id);
}
const report = { cases: cases.length, comparisons, maxError, failures: [] };
await writeFile(`${folder}/web-native-recovery.json`, JSON.stringify(report, null, 2));
console.log("Native → Web recovery:", report);
