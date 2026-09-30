import { normalizeLauncher, getLauncherPart, LAUNCHER_VERSION } from "./launcher-state.js";
import { oilEffects, launchOilResponse } from "./maintenance-state.js";
import { launchState } from "./top-dynamics.js";

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const finite = (n, fallback) => Number.isFinite(n) ? n : fallback;
export function normalizeLaunchOptions(raw = {}) {
  return { power: clamp(finite(raw.power, .86), .35, 1),
    height: clamp(finite(raw.height, .45), 0, 1),
    angle: clamp(finite(raw.angle, 0), -1, 1),
    direction: finite(raw.direction, 0), spinDirection: raw.spinDirection < 0 ? -1 : 1,
    speedScale: clamp(finite(raw.speedScale, 1), 0, 10) };
}

export function launcherLaunchState(build, rawConfig, rawOptions, effects = oilEffects()) {
  const options = normalizeLaunchOptions(rawOptions);
  const config = normalizeLauncher(rawConfig);
  const [rack, gear, coupler] = ["rack", "transmission", "coupler"]
    .map(slot => getLauncherPart(config.build[slot]));
  const initial = launchState(build, options);
  const inertia = build.momentOfInertia;
  const ratio = gear.ratio;
  // Reflected rack/gear inertia, retained spring energy and release friction
  // share one budget. Reference calibration preserves old saves at every load.
  const residualInertia = .06 * rack.mass / ratio ** 2 + gear.inertia + coupler.inertia;
  const inputBudget = .5 * (inertia + .14) * initial.spin ** 2 / (.72 * .99 * .99);
  const effort = options.power * Math.max(.4, 1 + .28 * (ratio ** 2 - 1) * inertia / .89 +
    .1 * (rack.mass - 1));
  const oil = launchOilResponse(effects, effort);
  const inputWork = inputBudget * Math.min(1, 1 / effort) * oil.heldWork;
  const transmitted = inputWork * effects.efficiency;
  // 60% of bending energy returns before exit; 40% stays in the rack/spring.
  const elasticFraction = clamp(.025 * rack.flex * (effort / options.power) ** 2, 0, .15);
  const springEnergy = transmitted * elasticFraction * .4;
  const releaseLoss = (transmitted - springEnergy) * coupler.drag;
  const available = Math.max(0, transmitted - springEnergy - releaseLoss);
  const energyLimit = Math.sqrt(2 * available / (inertia + residualInertia));
  // Kinematic cap uses the same pull-speed envelope for every gear set.
  const speedLimit = initial.spin * 1.18 * ratio * Math.sqrt(effects.efficiency / .72);
  initial.spin = Math.min(energyLimit, speedLimit);
  const kinetic = .5 * inertia * initial.spin ** 2;
  const residualEnergy = .5 * residualInertia * initial.spin ** 2;
  const unusedEnergy = Math.max(0, available - kinetic - residualEnergy);
  const errorTilt = Math.abs(options.angle) * .014 * (coupler.alignment - 1) * options.power;
  const lean = Math.sign(options.angle) || 1;
  initial.tiltVector.x += Math.cos(options.direction) * errorTilt * lean;
  initial.tiltVector.y += Math.sin(options.direction) * errorTilt * lean;
  const { x, y } = initial.velocity;
  initial.velocity.x = x * Math.cos(oil.direction) - y * Math.sin(oil.direction);
  initial.velocity.y = x * Math.sin(oil.direction) + y * Math.cos(oil.direction);
  const speed = Math.max(Math.hypot(x, y), 1e-6);
  initial.tiltVector.x += -y / speed * oil.tilt;
  initial.tiltVector.y += x / speed * oil.tilt;
  initial.tilt = Math.hypot(initial.tiltVector.x, initial.tiltVector.y);
  initial.launcherTelemetry = { version: LAUNCHER_VERSION, ratio, effort, inputBudget, inputWork,
    kinetic, residualEnergy, springEnergy, releaseLoss, unusedEnergy,
    transmissionLoss: inputWork - transmitted, releaseMs: coupler.releaseMs,
    initialSpin: initial.spin, tilt: initial.tilt, deviation: oil.direction,
    limiting: energyLimit <= speedLimit ? "energy" : "speed" };
  return initial;
}
