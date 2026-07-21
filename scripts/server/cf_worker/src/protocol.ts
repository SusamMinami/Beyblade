export const PROTOCOL_VERSION = 1;
export const SIMULATION_VERSION = "2026.07.21-web-v2";
export const FIXED_STEP_HZ = 60;
export const FIXED_DT = 1 / FIXED_STEP_HZ;
export const INPUT_BATCH_SIZE = 3;
export const HASH_CHECK_INTERVAL = 60;

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
  REPLAY_ACK: "replay_ack",
  RESULT: "result",
  ERROR: "error",
  PING: "ping",
  PONG: "pong",
  MATCH_FOUND: "match_found",
} as const;

export const MODE = {
  FRAME_SYNC: "frame_sync",
  ASYNC_VERIFY: "async_verify",
} as const;

export const SLOT = {
  PLAYER: 0,
  ENEMY: 1,
} as const;

export function makeEnvelope(type: string, data: unknown = {}, seq = -1): Record<string, unknown> {
  const env: Record<string, unknown> = { type, data };
  if (seq >= 0) env.seq = seq;
  return env;
}

export function validateLaunchCommand(cmd: any): boolean {
  if (cmd.power_q == null || cmd.height_q == null) return false;
  if (cmd.direction_q == null || cmd.angle_q == null) return false;
  const { power_q, height_q, angle_q } = cmd;
  if (power_q < 0 || power_q > 255 || height_q < 0 || height_q > 255) return false;
  if (angle_q < -127 || angle_q > 127) return false;
  return true;
}

export function validateInputFrame(f: any): boolean {
  if (f.f == null || f.s == null || f.cx == null || f.cy == null) return false;
  if (f.cx < -127 || f.cx > 127 || f.cy < -127 || f.cy > 127) return false;
  return true;
}

export function errorResponse(code: number, message: string): Record<string, unknown> {
  return makeEnvelope(MSG.ERROR, { code, message });
}

export function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
