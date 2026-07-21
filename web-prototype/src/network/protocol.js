export const PROTOCOL_VERSION = 1;
export const SIMULATION_VERSION = "2026.07.21-web-v2";
export const FIXED_STEP_HZ = 60;
export const FIXED_DT = 1 / FIXED_STEP_HZ;

export const INPUT_BATCH_SIZE = 3;
export const SNAPSHOT_INTERVAL = 3;
export const HASH_CHECK_INTERVAL = 60;
export const MAX_INPUT_QUEUE = 20;
export const INPUT_SEND_HZ = FIXED_STEP_HZ / INPUT_BATCH_SIZE;
export const SNAPSHOT_SEND_HZ = FIXED_STEP_HZ / SNAPSHOT_INTERVAL;

export const MSG = {
  HELLO: "hello",
  WELCOME: "welcome",
  READY: "ready",
  LAUNCH_WINDOW: "launch_window",
  LAUNCH: "launch",
  LAUNCH_BOTH: "launch_both",
  INPUT: "input",
  INPUT_BATCH: "input_batch",
  SNAPSHOT: "snapshot",
  EVENT: "event",
  HASH_CHECK: "hash_check",
  REPLAY_SUBMIT: "replay_submit",
  RESULT: "result",
  ERROR: "error",
  PING: "ping",
  PONG: "pong",
};

export const MODE = {
  FRAME_SYNC: "frame_sync",
  STATE_SYNC: "state_sync",
  ASYNC_VERIFY: "async_verify",
  LOCAL: "local",
};

export const PHASE = {
  INIT: "init",
  CONNECTING: "connecting",
  READY: "ready",
  LAUNCH_WINDOW: "launch_window",
  RUNNING: "running",
  FINISHED: "finished",
  CLOSED: "closed",
};

export const SLOT = {
  PLAYER: 0,
  ENEMY: 1,
  SPECTATOR: 2,
};

export const QUANT = {
  POWER_FACTOR: 255,
  POWER_MIN: 0.35,
  POWER_RANGE: 0.65,
  HEIGHT_FACTOR: 255,
  DIR_FACTOR: 10,
  ANGLE_FACTOR: 127,
  CONTROL_FACTOR: 127,
};

export const FLAGS = {
  LAUNCH_READY: 1,
  DISCONNECTED: 2,
  INPUT_BOOST: 4,
  INPUT_BRAKE: 8,
};

export function quantizePower(power) {
  return Math.round(Math.max(0, Math.min(1, (power - QUANT.POWER_MIN) / QUANT.POWER_RANGE)) * QUANT.POWER_FACTOR);
}

export function dequantizePower(q) {
  return QUANT.POWER_MIN + (q / QUANT.POWER_FACTOR) * QUANT.POWER_RANGE;
}

export function quantizeHeight(h) {
  return Math.round(Math.max(0, Math.min(1, h)) * QUANT.HEIGHT_FACTOR);
}

export function dequantizeHeight(q) {
  return q / QUANT.HEIGHT_FACTOR;
}

export function quantizeDirection(d) {
  const normalized = ((d + Math.PI) % (Math.PI * 2)) - Math.PI;
  return Math.round(normalized * QUANT.DIR_FACTOR);
}

export function dequantizeDirection(q) {
  return q / QUANT.DIR_FACTOR;
}

export function quantizeAngle(a) {
  return Math.round(Math.max(-1, Math.min(1, a)) * QUANT.ANGLE_FACTOR);
}

export function dequantizeAngle(q) {
  return q / QUANT.ANGLE_FACTOR;
}

export function quantizeControl(c) {
  return Math.round(Math.max(-1, Math.min(1, c)) * QUANT.CONTROL_FACTOR);
}

export function dequantizeControl(q) {
  return q / QUANT.CONTROL_FACTOR;
}

export function quantizeVector2(v) {
  return { x: quantizeControl(v.x), y: quantizeControl(v.y) };
}

export function dequantizeVector2(d) {
  return { x: dequantizeControl(d.x | 0), y: dequantizeControl(d.y | 0) };
}

export function makeEnvelope(type, data = {}, seq = -1, ack = -1) {
  const env = { type, data };
  if (seq >= 0) env.seq = seq;
  if (ack >= 0) env.ack = ack;
  return env;
}

export function validateLaunchCommand(cmd) {
  if (cmd.power_q == null || cmd.height_q == null) return false;
  if (cmd.direction_q == null || cmd.angle_q == null) return false;
  const { power_q, height_q, angle_q } = cmd;
  if (power_q < 0 || power_q > 255 || height_q < 0 || height_q > 255) return false;
  if (angle_q < -127 || angle_q > 127) return false;
  return true;
}

export function encodeInputFrame(frame) {
  return {
    f: frame.frame | 0,
    s: frame.slot | 0,
    sq: (frame.seq | 0) || 0,
    cx: frame.cx | 0,
    cy: frame.cy | 0,
    fl: (frame.flags | 0) || 0,
  };
}

export function decodeInputFrame(d) {
  return {
    frame: d.f | 0,
    slot: d.s | 0,
    seq: d.sq | 0,
    cx: d.cx | 0,
    cy: d.cy | 0,
    flags: d.fl | 0,
  };
}

export function encodeLaunchCommand(cmd) {
  return {
    s: cmd.slot | 0,
    p: cmd.power_q | 0,
    h: cmd.height_q | 0,
    d: cmd.direction_q | 0,
    a: cmd.angle_q | 0,
  };
}

export function decodeLaunchCommand(d) {
  return {
    slot: d.s | 0,
    power_q: d.p | 0,
    height_q: d.h | 0,
    direction_q: d.d | 0,
    angle_q: d.a | 0,
  };
}

export function round6(v) {
  return Math.round(v * 1000000) / 1000000;
}

export function round4(v) {
  return Math.round(v * 10000) / 10000;
}
