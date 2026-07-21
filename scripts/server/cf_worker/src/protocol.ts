export const PROTOCOL_VERSION = 2;
export const SIMULATION_VERSION = "2026.07.21-bin";
export const FIXED_STEP_HZ = 60;
export const FIXED_DT = 1 / FIXED_STEP_HZ;

export const INPUT_BATCH_SIZE = 6;
export const HASH_CHECK_INTERVAL = 60;
export const BATCH_FRAMES_MAX = 24;

export const MSG = {
  HELLO: 0x01,
  WELCOME: 0x02,
  READY: 0x03,
  LAUNCH_WINDOW: 0x04,
  LAUNCH: 0x05,
  LAUNCH_BOTH: 0x06,
  INPUT: 0x07,
  INPUT_BATCH: 0x08,
  HASH_CHECK: 0x09,
  RESULT: 0x0A,
  ERROR: 0x0B,
  PING: 0x0C,
  PONG: 0x0D,
  REPLAY_SUBMIT: 0x0E,
  REPLAY_ACK: 0x0F,
  ROOM_STATE: 0x10,
  MATCH_FOUND: 0x11,
} as const;

export const MODE = {
  FRAME_SYNC: "frame_sync",
  ASYNC_VERIFY: "async_verify",
} as const;

export const SLOT = {
  PLAYER: 0,
  ENEMY: 1,
} as const;

export const FRAME_FLAG_DELTA = 0x80;
export const FRAME_FLAGS_MASK = 0x3F;

export const INPUT_BOOST = 4;
export const INPUT_BRAKE = 8;

export function validateLaunchCommand(cmd: any): boolean {
  if (cmd.p == null || cmd.h == null) return false;
  if (cmd.d == null || cmd.a == null) return false;
  const { p, h, a } = cmd;
  if (p < 0 || p > 255 || h < 0 || h > 255) return false;
  if (a < -127 || a > 127) return false;
  return true;
}

export function validateInputFrame(f: any): boolean {
  if (f.f == null || f.cx == null || f.cy == null) return false;
  if (f.cx < -127 || f.cx > 127 || f.cy < -127 || f.cy > 127) return false;
  return true;
}

function readUTF8(buf: DataView, offset: number, len: number): string {
  return new TextDecoder().decode(new Uint8Array(buf.buffer, buf.byteOffset + offset, len));
}

export function encodeWelcome(slot: number, seed: number, arenaId: string, serverTime: number): ArrayBuffer {
  const arenaBytes = new TextEncoder().encode(arenaId);
  const simBytes = new TextEncoder().encode(SIMULATION_VERSION);
  const size = 1 + 1 + 1 + simBytes.length + 4 + 1 + arenaBytes.length + 4;
  const ab = new ArrayBuffer(size);
  const dv = new DataView(ab);
  let o = 0;
  dv.setUint8(o++, MSG.WELCOME);
  dv.setUint8(o++, slot);
  dv.setUint8(o++, PROTOCOL_VERSION);
  dv.setUint8(o++, simBytes.length);
  new Uint8Array(ab, o, simBytes.length).set(simBytes);
  o += simBytes.length;
  dv.setUint32(o, seed >>> 0, false); o += 4;
  dv.setUint8(o++, arenaBytes.length);
  new Uint8Array(ab, o, arenaBytes.length).set(arenaBytes);
  o += arenaBytes.length;
  dv.setUint32(o, serverTime >>> 0, false); o += 4;
  return ab;
}

export function encodeError(code: number, message: string): ArrayBuffer {
  const msgBytes = new TextEncoder().encode(message);
  const ab = new ArrayBuffer(1 + 2 + 1 + msgBytes.length);
  const dv = new DataView(ab);
  let o = 0;
  dv.setUint8(o++, MSG.ERROR);
  dv.setInt16(o, code, false); o += 2;
  dv.setUint8(o++, msgBytes.length);
  new Uint8Array(ab, o, msgBytes.length).set(msgBytes);
  return ab;
}

export function encodeLaunchWindow(windowMs: number, seed: number, arenaId: string): ArrayBuffer {
  const arenaBytes = new TextEncoder().encode(arenaId);
  const ab = new ArrayBuffer(1 + 2 + 4 + 1 + arenaBytes.length);
  const dv = new DataView(ab);
  let o = 0;
  dv.setUint8(o++, MSG.LAUNCH_WINDOW);
  dv.setUint16(o, windowMs, false); o += 2;
  dv.setUint32(o, seed >>> 0, false); o += 4;
  dv.setUint8(o++, arenaBytes.length);
  new Uint8Array(ab, o, arenaBytes.length).set(arenaBytes);
  return ab;
}

export function encodeLaunchBoth(pCmd: any, eCmd: any): ArrayBuffer {
  const ab = new ArrayBuffer(1 + 4 + 4);
  const dv = new DataView(ab);
  let o = 0;
  dv.setUint8(o++, MSG.LAUNCH_BOTH);
  dv.setUint8(o++, pCmd.p & 0xFF);
  dv.setUint8(o++, pCmd.h & 0xFF);
  dv.setInt8(o++, pCmd.d | 0);
  dv.setInt8(o++, pCmd.a | 0);
  dv.setUint8(o++, eCmd.p & 0xFF);
  dv.setUint8(o++, eCmd.h & 0xFF);
  dv.setInt8(o++, eCmd.d | 0);
  dv.setInt8(o++, eCmd.a | 0);
  return ab;
}

export function encodeInputBatch(senderSlot: number, frames: any[]): ArrayBuffer {
  let payloadSize = 2;
  const frameChunks: Array<{ delta: boolean; f: number; cx?: number; cy?: number; flags: number }> = [];
  let lastCx = 0, lastCy = 0, lastFlags = 0;
  for (const f of frames) {
    const cx = f.cx | 0;
    const cy = f.cy | 0;
    const flags = (f.fl || f.flags || 0) & FRAME_FLAGS_MASK;
    const fn = f.f | 0;
    const isDelta = cx === lastCx && cy === lastCy && flags === lastFlags && frameChunks.length > 0;
    if (!isDelta) { lastCx = cx; lastCy = cy; lastFlags = flags; }
    frameChunks.push({ delta: isDelta, f: fn, cx, cy, flags });
    payloadSize += isDelta ? 3 : 5;
  }
  const ab = new ArrayBuffer(1 + payloadSize);
  const dv = new DataView(ab);
  const u8 = new Uint8Array(ab);
  let o = 0;
  dv.setUint8(o++, MSG.INPUT_BATCH);
  dv.setUint8(o++, frameChunks.length & 0xFF);
  dv.setUint8(o++, senderSlot & 0xFF);
  for (const chunk of frameChunks) {
    let hdr = chunk.flags & FRAME_FLAGS_MASK;
    if (chunk.delta) hdr |= FRAME_FLAG_DELTA;
    dv.setUint8(o++, hdr);
    dv.setUint16(o, chunk.f & 0xFFFF, false); o += 2;
    if (!chunk.delta) {
      dv.setInt8(o++, chunk.cx!);
      dv.setInt8(o++, chunk.cy!);
    }
  }
  return ab;
}

export function encodePong(): ArrayBuffer {
  const ab = new ArrayBuffer(1);
  new DataView(ab).setUint8(0, MSG.PONG);
  return ab;
}

export function encodePing(): ArrayBuffer {
  const ab = new ArrayBuffer(1);
  new DataView(ab).setUint8(0, MSG.PING);
  return ab;
}

export function encodeResult(winner: number, reason: string): ArrayBuffer {
  const rBytes = new TextEncoder().encode(reason);
  const ab = new ArrayBuffer(1 + 1 + 1 + rBytes.length);
  const dv = new DataView(ab);
  let o = 0;
  dv.setUint8(o++, MSG.RESULT);
  dv.setInt8(o++, winner);
  dv.setUint8(o++, rBytes.length);
  new Uint8Array(ab, o, rBytes.length).set(rBytes);
  return ab;
}

export interface PlayerInfo {
  name: string;
  ready: boolean;
}

export function encodeRoomState(started: boolean, finished: boolean, players: (PlayerInfo | null)[]): ArrayBuffer {
  const parts: ArrayBuffer[] = [];
  let total = 1 + 2;
  for (const p of players) {
    if (p) {
      const nb = new TextEncoder().encode(p.name);
      const pb = new ArrayBuffer(1 + 1 + nb.length);
      const pdv = new DataView(pb);
      pdv.setUint8(0, 1);
      pdv.setUint8(1, p.ready ? 1 : 0);
      pdv.setUint8(2, nb.length);
      new Uint8Array(pb, 3).set(nb);
      parts.push(pb);
      total += pb.byteLength;
    } else {
      const pb = new ArrayBuffer(1);
      new DataView(pb).setUint8(0, 0);
      parts.push(pb);
      total += 1;
    }
  }
  const ab = new ArrayBuffer(total);
  const dv = new DataView(ab);
  let o = 0;
  dv.setUint8(o++, MSG.ROOM_STATE);
  dv.setUint8(o++, started ? 1 : 0);
  dv.setUint8(o++, finished ? 1 : 0);
  for (const pb of parts) {
    new Uint8Array(ab, o, pb.byteLength).set(new Uint8Array(pb));
    o += pb.byteLength;
  }
  return ab;
}

export function encodeReplayAck(replayId: string, accepted: boolean, error?: string): ArrayBuffer {
  const idBytes = new TextEncoder().encode(replayId);
  const errBytes = error ? new TextEncoder().encode(error) : new Uint8Array(0);
  const ab = new ArrayBuffer(1 + 1 + 1 + idBytes.length + 1 + errBytes.length);
  const dv = new DataView(ab);
  let o = 0;
  dv.setUint8(o++, MSG.REPLAY_ACK);
  dv.setUint8(o++, accepted ? 1 : 0);
  dv.setUint8(o++, idBytes.length);
  new Uint8Array(ab, o, idBytes.length).set(idBytes);
  o += idBytes.length;
  dv.setUint8(o++, errBytes.length);
  if (errBytes.length > 0) {
    new Uint8Array(ab, o, errBytes.length).set(errBytes);
  }
  return ab;
}

export function encodeHashCheck(frame: number, hash: string): ArrayBuffer {
  const hBytes = new TextEncoder().encode(hash);
  const ab = new ArrayBuffer(1 + 2 + 1 + hBytes.length);
  const dv = new DataView(ab);
  let o = 0;
  dv.setUint8(o++, MSG.HASH_CHECK);
  dv.setUint16(o, frame & 0xFFFF, false); o += 2;
  dv.setUint8(o++, hBytes.length);
  new Uint8Array(ab, o, hBytes.length).set(hBytes);
  return ab;
}

export type DecodedMessage = {
  type: number;
  data: any;
};

export function decodeMessage(buffer: ArrayBuffer): DecodedMessage | null {
  if (buffer.byteLength < 1) return null;
  const dv = new DataView(buffer);
  const u8 = new Uint8Array(buffer);
  let o = 0;
  const type = dv.getUint8(o++);
  switch (type) {
    case MSG.HELLO: {
      if (buffer.byteLength < o + 2) return null;
      const pv = dv.getUint8(o++);
      const svLen = dv.getUint8(o++);
      if (buffer.byteLength < o + svLen + 1) return null;
      const sv = readUTF8(dv, o, svLen); o += svLen;
      const slot = dv.getUint8(o++);
      return { type, data: { protocol_version: pv, simulation_version: sv, slot } };
    }
    case MSG.READY: {
      if (buffer.byteLength < o + 1) return null;
      return { type, data: { slot: dv.getUint8(o) } };
    }
    case MSG.LAUNCH: {
      if (buffer.byteLength < o + 4) return null;
      return {
        type, data: {
          p: dv.getUint8(o),
          h: dv.getUint8(o + 1),
          d: dv.getInt8(o + 2),
          a: dv.getInt8(o + 3),
        }
      };
    }
    case MSG.INPUT: {
      if (buffer.byteLength < o + 1) return null;
      const count = dv.getUint8(o++);
      const frames: any[] = [];
      let lastCx = 0, lastCy = 0, lastFlags = 0;
      for (let i = 0; i < count; i++) {
        if (buffer.byteLength < o + 1) break;
        const hdr = dv.getUint8(o++);
        const isDelta = (hdr & FRAME_FLAG_DELTA) !== 0;
        const flags = hdr & FRAME_FLAGS_MASK;
        if (buffer.byteLength < o + 2) break;
        const f = dv.getUint16(o, false); o += 2;
        if (!isDelta) {
          if (buffer.byteLength < o + 2) break;
          lastCx = dv.getInt8(o);
          lastCy = dv.getInt8(o + 1);
          lastFlags = flags;
          o += 2;
        }
        frames.push({ f, cx: lastCx, cy: lastCy, fl: lastFlags });
      }
      return { type, data: { frames } };
    }
    case MSG.HASH_CHECK: {
      if (buffer.byteLength < o + 3) return null;
      const frame = dv.getUint16(o, false); o += 2;
      const hLen = dv.getUint8(o++);
      if (buffer.byteLength < o + hLen) return null;
      const hash = readUTF8(dv, o, hLen);
      return { type, data: { frame, hash } };
    }
    case MSG.REPLAY_SUBMIT: {
      if (buffer.byteLength < o + 2) return null;
      const dLen = dv.getUint16(o, false); o += 2;
      if (buffer.byteLength < o + dLen) return null;
      let data: any = null;
      try {
        data = JSON.parse(readUTF8(dv, o, dLen));
      } catch {}
      return { type, data };
    }
    case MSG.PING:
    case MSG.PONG:
      return { type, data: {} };
    default:
      return null;
  }
}

export function errorResponse(code: number, message: string): ArrayBuffer {
  return encodeError(code, message);
}

export function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
