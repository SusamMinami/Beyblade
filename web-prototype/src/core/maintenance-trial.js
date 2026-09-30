import { BattleSimulation } from "./battle-simulation.js";
import { oilEffects } from "./maintenance-state.js";
import { getArena } from "../data/arenas.js";

// Same integration as battles, on a flat, unpowered surface with no opponent contact.
// A bench measurement, never a reward-bearing match.
export function runMaintenanceTrial(build, maintenance, power = .86, launcher, angle = 0) {
  const standard = getArena("standard");
  const surface = { ...standard.surfaceAt(0), noise: 0 };
  const arena = { ...standard, driveZones: [], blockers: [], bowlForce: 0,
    wallRadius: 1000, ringOutRadius: 1100, surfaceAt: () => surface };
  const sim = new BattleSimulation({ playerBuild: build, enemyBuild: build,
    arena, seed: 20260923, maintenance: { player: maintenance }, launchers: { player: launcher } });
  sim.launch({ power, height: .45, direction: 0, angle });
  const initialSpin = sim.player.spin;
  const start = { ...sim.player.position };
  sim.enemy.position = { x: 500, y: 500 };
  for (let i = 0; i < 180; i++) sim.step(1 / 60, { x: 0, y: 0 }, { x: 0, y: 0 });
  const effects = oilEffects(maintenance);
  return {
    initialSpin, finalSpin: sim.player.spin,
    distance: Math.hypot(sim.player.position.x - start.x, sim.player.position.y - start.y),
    deviation: sim.player.launcherTelemetry.deviation * 180 / Math.PI,
    launcher: { ...sim.player.launcherTelemetry },
    traction: effects.traction, efficiency: effects.efficiency,
  };
}
