export const PROTOCOL_VERSION = 2;
export const SIMULATION_VERSION = "2026.07.21-bin";
export const FIXED_STEP_HZ = 60;
export const FIXED_DT = 1 / FIXED_STEP_HZ;

export const INPUT_BATCH_SIZE = 6;
export const HASH_CHECK_INTERVAL = 60;
export const INPUT_BATCH_MAX = 24;

export const SEND_RATE_HIGH_HZ = 10;
export const SEND_RATE_MID_HZ = 5;
export const SEND_RATE_LOW_HZ = 2;
export const SEND_RATE_IDLE_HZ = 1;

export const FRAME_FLAG_DELTA = 0x80;
export const FRAME_FLAGS_MASK = 0x3f;
export const FLAG_INPUT_BOOST = 4;
export const FLAG_INPUT_BRAKE = 8;

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
  RESULT: 0x0a,
  ERROR: 0x0b,
  PING: 0x0c,
  PONG: 0x0d,
  REPLAY_SUBMIT: 0x0e,
  REPLAY_ACK: 0x0f,
  ROOM_STATE: 0x10,
  MATCH_FOUND: 0x11,
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

function textEnc() { return new TextEncoder(); }
function textDec() { return new TextDecoder(); }

function writeUTF8(dv, offset, str) {
  const bytes = textEnc().encode(str);
  new Uint8Array(dv.buffer, dv.byteOffset + offset, bytes.length).set(bytes);
  return bytes.length;
}

function readUTF8(dv, offset, len) {
  return textDec().decode(new Uint8Array(dv.buffer, dv.byteOffset + offset, len));
}

export function quantizePower(power) {
  return Math.round(Math.max(0, Math.min(1, (power - QUANT.POWER_MIN) / QUANT.POWER_RANGE)) * QUANT.POWER_FACTOR);
}
export function dequantizePower(q) { return QUANT.POWER_MIN + (q / QUANT.POWER_FACTOR) * QUANT.POWER_RANGE; }
export function quantizeHeight(h) { return Math.round(Math.max(0, Math.min(1, h)) * QUANT.HEIGHT_FACTOR); }
export function dequantizeHeight(q) { return q / QUANT.HEIGHT_FACTOR; }
export function quantizeDirection(d) {
  const normalized = ((d + Math.PI) % (Math.PI * 2)) - Math.PI;
  return Math.round(normalized * QUANT.DIR_FACTOR);
}
export function dequantizeDirection(q) { return q / QUANT.DIR_FACTOR; }
export function quantizeAngle(a) { return Math.round(Math.max(-1, Math.min(1, a)) * QUANT.ANGLE_FACTOR); }
export function dequantizeAngle(q) { return q / QUANT.ANGLE_FACTOR; }
export function quantizeControl(c) { return Math.round(Math.max(-1, Math.min(1, c)) * QUANT.CONTROL_FACTOR); }
export function dequantizeControl(q) { return q / QUANT.CONTROL_FACTOR; }
export function quantizeVector2(v) { return { x: quantizeControl(v.x), y: quantizeControl(v.y) }; }
export function dequantizeVector2(d) { return { x: dequantizeControl(d.x | 0), y: dequantizeControl(d.y | 0) }; }

export function computeIntensityLevel(sim) {
  if (!sim || sim.phase !== "running") return 3;
  const pState = sim.player;
  const eState = sim.enemy;
  if (!pState || !eState) return 1;
  const pSpin = pState.spin || 0;
  const eSpin = eState.spin || 0;
  const pPos = pState.position || { x: 0, y: 0 };
  const ePos = eState.position || { x: 0, y: 0 };
  const dx = pPos.x - ePos.x;
  const dy = pPos.y - ePos.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const minSpin = Math.min(pSpin, eSpin);
  const maxInitial = 25;
  const spinRatio = Math.max(0, Math.min(1, minSpin / maxInitial));
  if (spinRatio > 0.5 && dist < 3) return 0;
  if (spinRatio > 0.25 && dist < 6) return 1;
  if (spinRatio > 0.1) return 2;
  return 3;
}

export function sendRateForLevel(level) {
  switch (level) {
    case 0: return SEND_RATE_HIGH_HZ;
    case 1: return SEND_RATE_MID_HZ;
    case 2: return SEND_RATE_LOW_HZ;
    default: return SEND_RATE_IDLE_HZ;
  }
}

function ab(size) { return new DataView(new ArrayBuffer(size)); }

export function encodeWelcome(slot, seed, arenaId, serverTime) {
  const simBytes = textEnc().encode(SIMULATION_VERSION);
  const arenaBytes = textEnc().encode(arenaId);
  const dv = ab(1 + 1 + 1 + 1 + simBytes.length + 4 + 1 + arenaBytes.length + 4);
  let o = 0;
  dv.setUint8(o++, MSG.WELCOME);
  dv.setUint8(o++, slot);
  dv.setUint8(o++, PROTOCOL_VERSION);
  dv.setUint8(o++, simBytes.length);
  new Uint8Array(dv.buffer, o, simBytes.length).set(simBytes); o += simBytes.length;
  dv.setUint32(o, seed >>> 0, false); o += 4;
  dv.setUint8(o++, arenaBytes.length);
  new Uint8Array(dv.buffer, o, arenaBytes.length).set(arenaBytes); o += arenaBytes.length;
  dv.setUint32(o, serverTime >>> 0, false);
  return dv.buffer;
}

export function encodeError(code, message) {
  const mb = textEnc().encode(message);
  const dv = ab(1 + 2 + 1 + mb.length);
  let o = 0;
  dv.setUint8(o++, MSG.ERROR);
  dv.setInt16(o, code, false); o += 2;
  dv.setUint8(o++, mb.length);
  new Uint8Array(dv.buffer, o, mb.length).set(mb);
  return dv.buffer;
}

export function encodePong() {
  const dv = ab(1);
  dv.setUint8(0, MSG.PONG);
  return dv.buffer;
}

export function encodePing() {
  const dv = ab(1);
  dv.setUint8(0, MSG.PING);
  return dv.buffer;
}

export function encodeReady(slot) {
  const dv = ab(2);
  dv.setUint8(0, MSG.READY);
  dv.setUint8(1, slot & 0xff);
  return dv.buffer;
}

export function encodeHello() {
  const sb = textEnc().encode(SIMULATION_VERSION);
  const dv = ab(1 + 1 + 1 + sb.length + 1);
  let o = 0;
  dv.setUint8(o++, MSG.HELLO);
  dv.setUint8(o++, PROTOCOL_VERSION);
  dv.setUint8(o++, sb.length);
  new Uint8Array(dv.buffer, o, sb.length).set(sb); o += sb.length;
  dv.setUint8(o++, 0);
  return dv.buffer;
}

export function encodeLaunch(pq, hq, dq, aq) {
  const dv = ab(1 + 4);
  let o = 0;
  dv.setUint8(o++, MSG.LAUNCH);
  dv.setUint8(o++, pq & 0xff);
  dv.setUint8(o++, hq & 0xff);
  dv.setInt8(o++, dq | 0);
  dv.setInt8(o++, aq | 0);
  return dv.buffer;
}

export function encodeInputBatch(frames) {
  const count = Math.min(frames.length, INPUT_BATCH_MAX);
  const chunks = [];
  let lastCx = 0, lastCy = 0, lastFl = 0;
  let payload = 1;
  for (let i = 0; i < count; i++) {
    const f = frames[i];
    const cx = f.cx | 0;
    const cy = f.cy | 0;
    const fl = (f.fl || f.flags || 0) & FRAME_FLAGS_MASK;
    const fn = f.f | 0;
    const isDelta = cx === lastCx && cy === lastCy && fl === lastFl && chunks.length > 0;
    if (!isDelta) { lastCx = cx; lastCy = cy; lastFl = fl; }
    chunks.push({ delta: isDelta, f: fn, cx, cy, fl });
    payload += isDelta ? 3 : 5;
  }
  const dv = ab(1 + payload);
  let o = 0;
  dv.setUint8(o++, MSG.INPUT);
  dv.setUint8(o++, count & 0xff);
  for (const ch of chunks) {
    let hdr = ch.fl & FRAME_FLAGS_MASK;
    if (ch.delta) hdr |= FRAME_FLAG_DELTA;
    dv.setUint8(o++, hdr);
    dv.setUint16(o, ch.f & 0xffff, false); o += 2;
    if (!ch.delta) {
      dv.setInt8(o++, ch.cx);
      dv.setInt8(o++, ch.cy);
    }
  }
  return dv.buffer;
}

export function encodeHashCheck(frame, hashStr) {
  const hb = textEnc().encode(hashStr);
  const dv = ab(1 + 2 + 1 + hb.length);
  let o = 0;
  dv.setUint8(o++, MSG.HASH_CHECK);
  dv.setUint16(o, frame & 0xffff, false); o += 2;
  dv.setUint8(o++, hb.length);
  new Uint8Array(dv.buffer, o, hb.length).set(hb);
  return dv.buffer;
}

export function decodeMessage(buffer) {
  if (!buffer || buffer.byteLength < 1) return null;
  const dv = new DataView(buffer);
  let o = 0;
  const type = dv.getUint8(o++);
  const data = {};
  switch (type) {
    case MSG.WELCOME: {
      if (buffer.byteLength < o + 3) return null;
      const slot = dv.getUint8(o++);
      const proto = dv.getUint8(o++);
      const slen = dv.getUint8(o++);
      if (buffer.byteLength < o + slen + 4 + 1) return null;
      const sv = readUTF8(dv, o, slen); o += slen;
      const seed = dv.getUint32(o, false); o += 4;
      const alen = dv.getUint8(o++);
      if (buffer.byteLength < o + alen + 4) return null;
      const arena = readUTF8(dv, o, alen); o += alen;
      const st = dv.getUint32(o, false);
      Object.assign(data, { slot, protocol_version: proto, simulation_version: sv, seed, arena_id: arena, server_time: st });
      break;
    }
    case MSG.ERROR: {
      if (buffer.byteLength < o + 3) return null;
      const code = dv.getInt16(o, false); o += 2;
      const elen = dv.getUint8(o++);
      if (buffer.byteLength < o + elen) return null;
      const msg = readUTF8(dv, o, elen);
      Object.assign(data, { code, message: msg });
      break;
    }
    case MSG.LAUNCH_WINDOW: {
      if (buffer.byteLength < o + 7) return null;
      const windowMs = dv.getUint16(o, false); o += 2;
      const seed = dv.getUint32(o, false); o += 4;
      const alen = dv.getUint8(o++);
      if (buffer.byteLength < o + alen) return null;
      const arena = readUTF8(dv, o, alen);
      Object.assign(data, { window_ms: windowMs, seed, arena_id: arena });
      break;
    }
    case MSG.LAUNCH_BOTH: {
      if (buffer.byteLength < o + 8) return null;
      const pp = dv.getUint8(o++), ph = dv.getUint8(o++), pd = dv.getInt8(o++), pa = dv.getInt8(o++);
      const ep = dv.getUint8(o++), eh = dv.getUint8(o++), ed = dv.getInt8(o++), ea = dv.getInt8(o++);
      data.player = { p: pp, h: ph, d: pd, a: pa };
      data.enemy = { p: ep, h: eh, d: ed, a: ea };
      break;
    }
    case MSG.INPUT_BATCH: {
      if (buffer.byteLength < o + 2) return null;
      const count = dv.getUint8(o++);
      const senderSlot = dv.getUint8(o++);
      const frames = [];
      let fc = 0, cx = 0, cy = 0, fl = 0;
      while (fc < count && o + 3 <= buffer.byteLength) {
        const hdr = dv.getUint8(o++);
        const isDelta = (hdr & FRAME_FLAG_DELTA) !== 0;
        const flags = hdr & FRAME_FLAGS_MASK;
        const fn = dv.getUint16(o, false); o += 2;
        if (!isDelta) {
          if (o + 2 > buffer.byteLength) break;
          cx = dv.getInt8(o); cy = dv.getInt8(o + 1); o += 2;
          fl = flags;
        }
        frames.push({ f: fn, cx, cy, fl });
        fc++;
      }
      data.sender_slot = senderSlot;
      data.frames = frames;
      break;
    }
    case MSG.RESULT: {
      if (buffer.byteLength < o + 2) return null;
      const winner = dv.getInt8(o++);
      const rlen = dv.getUint8(o++);
      if (buffer.byteLength < o + rlen) return null;
      const reason = readUTF8(dv, o, rlen);
      Object.assign(data, { winner, reason });
      break;
    }
    case MSG.ROOM_STATE: {
      if (buffer.byteLength < o + 2) return null;
      const started = dv.getUint8(o++) !== 0;
      const finished = dv.getUint8(o++) !== 0;
      const players = [null, null];
      for (let ps = 0; ps < 2; ps++) {
        if (o >= buffer.byteLength) break;
        const present = dv.getUint8(o++);
        if (present) {
          if (o + 2 > buffer.byteLength) break;
          const ready = dv.getUint8(o++) !== 0;
          const nlen = dv.getUint8(o++);
          if (o + nlen > buffer.byteLength) break;
          const name = readUTF8(dv, o, nlen); o += nlen;
          players[ps] = { name, ready };
        }
      }
      Object.assign(data, { started, finished, players });
      break;
    }
    case MSG.PING: case MSG.PONG: break;
    case MSG.HASH_CHECK: {
      if (buffer.byteLength < o + 3) return null;
      const frame = dv.getUint16(o, false); o += 2;
      const hlen = dv.getUint8(o++);
      if (buffer.byteLength < o + hlen) return null;
      const hash = readUTF8(dv, o, hlen);
      Object.assign(data, { frame, hash });
      break;
    }
    case MSG.REPLAY_ACK: {
      if (buffer.byteLength < o + 2) return null;
      const accepted = dv.getUint8(o++) !== 0;
      const rlen = dv.getUint8(o++);
      if (buffer.byteLength < o + rlen) return null;
      const rid = readUTF8(dv, o, rlen); o += rlen;
      let err = "";
      if (o < buffer.byteLength) {
        const elen = dv.getUint8(o++);
        if (elen > 0 && o + elen <= buffer.byteLength) {
          err = readUTF8(dv, o, elen);
        }
      }
      Object.assign(data, { accepted, replay_id: rid, error: err });
      break;
    }
    default: return null;
  }
  return { type, data };
}
