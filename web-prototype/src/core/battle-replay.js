// Local regression/recovery tooling. No economy settlement or network authority.
export const REPLAY_SCHEMA = 1;
export const FIXED_DT = 1 / 60;

export function createReplay(sim) {
  return { schema: REPLAY_SCHEMA, initial: sim.exportState(), inputs: [] };
}

export function recordStep(sim, replay, player = { x: 0, y: 0 }, enemy = null) {
  replay.inputs.push({ player: { ...player }, enemy: enemy === null ? null : { ...enemy } });
  sim.step(FIXED_DT, player, enemy);
}

export function playReplay(sim, replay, inspect = () => {}) {
  if (replay.schema !== REPLAY_SCHEMA || !Array.isArray(replay.inputs)) {
    throw new Error("不支持的本地回放格式");
  }
  sim.restoreState(replay.initial);
  for (const [i, input] of replay.inputs.entries()) {
    sim.step(FIXED_DT, input.player, input.enemy);
    inspect(sim, i);
  }
  return sim;
}

// Render rate is not simulation time; callers supply controls by fixed frame.
export class FixedBattleClock {
  constructor() { this.accumulator = 0; }
  reset() { this.accumulator = 0; }
  advance(seconds, tick) {
    this.accumulator += Math.min(.05, Math.max(0, seconds));
    let steps = 0;
    while (this.accumulator >= FIXED_DT - 1e-12) {
      tick();
      this.accumulator -= FIXED_DT;
      steps++;
    }
    return steps;
  }
}
