import { BattleSimulation, SIMULATION_VERSION } from "./battle-simulation.js";
import { applyStructuralImpact } from "./top-structure.js";
import { SURFACES } from "../data/arenas.js";

const cache = new Map();
const DT = 1 / 60;
const arena = { id: "measurement", wallRadius: 1e6, ringOutRadius: 1e6,
  bowlForce: 0, driveZones: [], surfaceAt: () => SURFACES.standard };
export const MEASUREMENT_CONDITIONS = "标准平地 · 基础发射器 · 无保养 · 满功率 · 零高度/倾角 · 初始静止 · 无操控/碰撞/供能；耐久：载荷20、相位0、取最重扇区";

export function getBuildMeasurements(build) {
  const key = JSON.stringify([SIMULATION_VERSION, build.parts]);
  if (cache.has(key)) return cache.get(key);
  const sim = new BattleSimulation({ playerBuild: build, enemyBuild: build, arena, seed: 0 });
  sim.launch({ power: 1, height: 0, angle: 0 });
  const top = sim.player;
  top.position = { x: 0, y: 0 };
  top.velocity = { x: 0, y: 0 };
  let steps = 0;
  // Same integration and axis code as battle, isolated from the other actor.
  while (top.spin > 2 && steps < 7200) {
    sim.time += DT;
    sim._integrateTop(top, { x: 0, y: 0 }, DT, false);
    sim._updateTilt(top, DT);
    steps++;
  }
  sim.reset();
  applyStructuralImpact(sim.player, 20, 0);
  const worstDamage = Math.max(...sim.player.structure.parts.map(part => part.worst));
  const result = Object.freeze({ version: SIMULATION_VERSION, freeSeconds: steps * DT,
    capped: steps === 7200, worstDamage, conditions: MEASUREMENT_CONDITIONS });
  cache.set(key, result);
  if (cache.size > 96) cache.delete(cache.keys().next().value);
  return result;
}

export function measurementSummary(build) {
  const measured = getBuildMeasurements(build);
  return `自由转时 ${measured.capped ? "≥" : ""}${measured.freeSeconds.toFixed(1)}s · 等载荷局部损伤 ${(measured.worstDamage * 100).toFixed(1)}%`;
}
