import {
  MSG,
  PHASE,
  SLOT,
  FIXED_DT,
  INPUT_BATCH_SIZE,
  INPUT_BATCH_MAX,
  HASH_CHECK_INTERVAL,
  FRAME_FLAGS_MASK,
  quantizePower, quantizeHeight, quantizeDirection, quantizeAngle, quantizeControl, dequantizeControl, dequantizePower, dequantizeHeight, dequantizeDirection, dequantizeAngle,
  computeIntensityLevel,
  sendRateForLevel,
  encodeHello,
  encodeReady,
  encodeLaunch,
  encodeInputBatch,
  encodePong,
  encodeHashCheck,
} from "./protocol.js";

function simpleHash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

function snapshotHash(snap) {
  if (!snap) return "";
  const p = snap.player || {};
  const e = snap.enemy || {};
  const key = [
    (snap.frame | 0),
    ((p.position?.x || 0) * 1000 | 0),
    ((p.position?.y || 0) * 1000 | 0),
    ((p.velocity?.x || 0) * 1000 | 0),
    ((p.velocity?.y || 0) * 1000 | 0),
    ((p.spin || 0) * 1000 | 0),
    ((p.tilt || 0) * 1000 | 0),
    ((e.position?.x || 0) * 1000 | 0),
    ((e.position?.y || 0) * 1000 | 0),
    ((e.velocity?.x || 0) * 1000 | 0),
    ((e.velocity?.y || 0) * 1000 | 0),
    ((e.spin || 0) * 1000 | 0),
    ((e.tilt || 0) * 1000 | 0),
  ].join(",");
  return simpleHash(key);
}

export class FrameSyncProvider {
  constructor(sim, transport, slot = SLOT.PLAYER) {
    this.sim = sim;
    this.transport = transport;
    this.mySlot = slot;
    this.phase = PHASE.INIT;
    this.listeners = { phase: [], state: [], event: [], finish: [], error: [], replay: [] };

    this._localControl = { x: 0, y: 0 };
    this._localFlags = 0;
    this._myLaunchSubmitted = false;
    this._readySent = false;
    this._inputQueue = { [SLOT.PLAYER]: [], [SLOT.ENEMY]: [] };
    this._lastSentFrame = -1;
    this._tickAccumulator = 0;
    this._hashMismatches = 0;

    this._sendAccumulator = 0;
    this._currentSendInterval = 1 / 5;
    this._lastSentCx = 0x7FFF;
    this._lastSentCy = 0x7FFF;
    this._lastSentFl = 0xFF;
    this._pendingFrames = [];
    this._forceSend = false;
    this._lastIntensity = 1;

    if (transport) {
      transport.on("message", (msg) => this._onMessage(msg));
      transport.on("connected", () => this._onConnected());
      transport.on("disconnected", () => this._onDisconnected());
    }
  }

  on(event, cb) { this.listeners[event]?.push(cb); return this; }
  _emit(event, ...args) { (this.listeners[event] || []).forEach((cb) => cb(...args)); }

  start() { this._setPhase(PHASE.CONNECTING); }

  submitReady() {
    if (this._readySent) return;
    this._readySent = true;
    this._sendBinary(encodeReady(this.mySlot));
  }

  submitLaunch(power, height, direction, angle) {
    const pq = quantizePower(power);
    const hq = quantizeHeight(height);
    const dq = quantizeDirection(direction);
    const aq = quantizeAngle(angle);
    this._sendBinary(encodeLaunch(pq, hq, dq, aq));
    this._myLaunchSubmitted = true;
  }

  setLocalInput(control, flags = 0) {
    this._localControl = { x: control.x, y: control.y };
    this._localFlags = flags;
    const cx = quantizeControl(control.x);
    const cy = quantizeControl(control.y);
    const fl = flags & FRAME_FLAGS_MASK;
    if (cx !== this._lastSentCx || cy !== this._lastSentCy || fl !== this._lastSentFl) {
      this._forceSend = true;
    }
  }

  poll(deltaMs) {
    const delta = deltaMs / 1000;
    if (this.transport && typeof this.transport.poll === "function") this.transport.poll();
    this._syncPhaseFromSim();
    if (this.phase !== PHASE.RUNNING) return this.sim.getSnapshot?.() || {};
    this._tickAccumulator += delta;
    while (this._tickAccumulator >= FIXED_DT) {
      this._tickAccumulator -= FIXED_DT;
      this._advanceTick();
    }
    const snap = this.sim.getSnapshot?.() || {};
    this._maybeHashCheck(snap);
    this._emit("state", snap);
    return snap;
  }

  _advanceTick() {
    const currentFrame = (this.sim.frame | 0) + 1;
    const pInput = this._consumeInputForFrame(SLOT.PLAYER, currentFrame);
    const eInput = this._consumeInputForFrame(SLOT.ENEMY, currentFrame);
    let pCtrl = { x: dequantizeControl(pInput.cx), y: dequantizeControl(pInput.cy) };
    let eCtrl = { x: dequantizeControl(eInput.cx), y: dequantizeControl(eInput.cy) };
    if (this.mySlot === SLOT.PLAYER) {
      this.sim.step(FIXED_DT, pCtrl, eCtrl);
    } else {
      this.sim.step(FIXED_DT, eCtrl, pCtrl);
    }
    this._processEvents();
    this._queueLocalInput(currentFrame);
    this._updateSendRate();
    this._trySendPending(currentFrame);
    if (this.sim.phase === "finished") this._handleEnd();
  }

  _queueLocalInput(frame) {
    this._pendingFrames.push({
      f: frame,
      cx: quantizeControl(this._localControl.x),
      cy: quantizeControl(this._localControl.y),
      fl: this._localFlags & FRAME_FLAGS_MASK,
    });
  }

  _updateSendRate() {
    const level = computeIntensityLevel(this.sim);
    if (level !== this._lastIntensity) {
      this._lastIntensity = level;
      this._forceSend = true;
    }
    const hz = sendRateForLevel(level);
    this._currentSendInterval = 1 / hz;
  }

  _trySendPending(_currentFrame) {
    this._sendAccumulator += FIXED_DT;
    let shouldSend = this._forceSend;
    if (this._sendAccumulator >= this._currentSendInterval) shouldSend = true;
    if (this._pendingFrames.length >= INPUT_BATCH_SIZE) shouldSend = true;
    if (!shouldSend || this._pendingFrames.length === 0) return;
    this._sendAccumulator = 0;
    this._forceSend = false;
    const take = Math.min(this._pendingFrames.length, INPUT_BATCH_MAX);
    const batch = this._pendingFrames.slice(0, take);
    this._pendingFrames = this._pendingFrames.slice(take);
    if (batch.length > 0) {
      const last = batch[batch.length - 1];
      this._lastSentCx = last.cx;
      this._lastSentCy = last.cy;
      this._lastSentFl = last.fl;
      this._lastSentFrame = last.f;
      this._sendBinary(encodeInputBatch(batch));
    }
  }

  _consumeInputForFrame(slot, frame) {
    const queue = this._inputQueue[slot] || [];
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].f === frame) {
        const r = { ...queue[i] };
        queue.splice(i, 1);
        return { frame, slot, cx: r.cx | 0, cy: r.cy | 0, flags: (r.fl | 0) & FRAME_FLAGS_MASK };
      }
    }
    if (slot === this.mySlot) {
      return {
        frame, slot,
        cx: quantizeControl(this._localControl.x),
        cy: quantizeControl(this._localControl.y),
        flags: this._localFlags & FRAME_FLAGS_MASK,
      };
    }
    return { frame, slot, cx: 0, cy: 0, flags: 0 };
  }

  _processEvents() { for (const ev of this.sim.events || []) this._emit("event", ev); }

  _handleEnd() {
    this._setPhase(PHASE.FINISHED);
    this._emit("finish", this.sim.result);
  }

  _maybeHashCheck(snap) {
    if ((snap.frame | 0) % HASH_CHECK_INTERVAL !== 0) return;
    const h = snapshotHash(snap);
    this._sendBinary(encodeHashCheck(snap.frame | 0, h));
  }

  _onConnected() {
    this._setPhase(PHASE.READY);
    this._sendBinary(encodeHello());
  }

  _onMessage(msg) {
    if (!msg) return;
    let type;
    let data;
    if (typeof msg.type === "number") { type = msg.type; data = msg.data || {}; }
    else if (typeof msg.type === "string") {
      type = msg.type; data = msg.data || {};
    } else { return; }
    if (type === MSG.WELCOME || type === MSG.PONG) return;
    switch (type) {
      case MSG.PING: this._sendBinary(encodePong()); break;
      case MSG.LAUNCH_WINDOW: case "launch_window":
        this._setPhase(PHASE.LAUNCH_WINDOW); break;
      case MSG.LAUNCH_BOTH: case "launch_both":
        this._handleLaunchBoth(data); break;
      case MSG.INPUT_BATCH: case "input_batch":
        this._handleInputBatch(data); break;
      case MSG.RESULT: case "result":
        this._emit("finish", typeof data.winner === "number" ? { winner: data.winner, reason: data.reason || "" } : data);
        this._setPhase(PHASE.FINISHED); break;
      case MSG.ERROR: case "error":
        this._emit("error", data.code || -1, data.message || "error"); break;
      case MSG.HASH_CHECK: {
        const remote = String(data.hash || "");
        const snap = this.sim.getSnapshot?.() || {};
        const local = snapshotHash(snap);
        if (remote && remote !== local) this._hashMismatches++;
        break;
      }
      case MSG.ROOM_STATE: case "room_state": break;
      default: break;
    }
  }

  _handleLaunchBoth(data) {
    const own = data.player && (data.player.p !== undefined || data.player.power_q !== undefined) ? data.player : data.player;
    const opp = data.enemy && (data.enemy.p !== undefined || data.enemy.power_q !== undefined) ? data.enemy : data.enemy;
    let ownCmd, oppCmd;
    if (own && own.p !== undefined) {
      ownCmd = { power_q: own.p, height_q: own.h, direction_q: own.d, angle_q: own.a };
      oppCmd = { power_q: opp.p, height_q: opp.h, direction_q: opp.d, angle_q: opp.a };
    } else if (own && own.power_q !== undefined) {
      ownCmd = own; oppCmd = opp;
    } else {
      return;
    }
    if (this.mySlot === SLOT.PLAYER) {
      this.sim.launchExplicit(ownCmd, oppCmd);
    } else {
      this.sim.launchExplicit(oppCmd, ownCmd);
    }
    this._setPhase(PHASE.RUNNING);
  }

  _handleInputBatch(data) {
    const frames = data.frames || [];
    const senderSlot = typeof data.sender_slot === "number" ? data.sender_slot : (1 - this.mySlot);
    if (!this._inputQueue[senderSlot]) this._inputQueue[senderSlot] = [];
    for (const f of frames) this._inputQueue[senderSlot].push(f);
  }

  _onDisconnected() {
    this._setPhase(PHASE.CLOSED);
    this._emit("error", -1, "Disconnected");
  }

  _syncPhaseFromSim() {
    if (!this.sim) return;
    if (this.sim.phase === "running" && this.phase !== PHASE.RUNNING) this._setPhase(PHASE.RUNNING);
  }

  _setPhase(p) {
    if (this.phase === p) return;
    this.phase = p;
    this._emit("phase", p);
  }

  _sendBinary(ab) {
    if (!this.transport) return;
    if (typeof this.transport.sendBinary === "function") this.transport.sendBinary(ab);
    else if (typeof this.transport.sendMessage === "function") this.transport.sendMessage({ payload: ab });
  }

  disconnect() { if (this.transport?.disconnect) this.transport.disconnect(); }
}
