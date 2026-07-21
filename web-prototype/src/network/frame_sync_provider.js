import {
  MSG,
  PHASE,
  SLOT,
  FIXED_DT,
  INPUT_BATCH_SIZE,
  HASH_CHECK_INTERVAL,
  PROTOCOL_VERSION,
  SIMULATION_VERSION,
  makeEnvelope,
  dequantizeVector2,
  encodeInputFrame,
  decodeInputFrame,
  encodeLaunchCommand,
  decodeLaunchCommand,
} from "./protocol.js";

export class FrameSyncProvider {
  constructor(sim, transport, slot = SLOT.PLAYER) {
    this.sim = sim;
    this.transport = transport;
    this.mySlot = slot;
    this.phase = PHASE.INIT;
    this.listeners = { phase: [], state: [], event: [], finish: [], error: [] };

    this._localControl = { x: 0, y: 0 };
    this._localFlags = 0;
    this._myLaunchSubmitted = false;
    this._readySent = false;
    this._inputQueue = { [SLOT.PLAYER]: [], [SLOT.ENEMY]: [] };
    this._localSeq = 0;
    this._lastSentFrame = -1;
    this._tickAccumulator = 0;
    this._hashMismatches = 0;

    if (transport) {
      transport.on("message", (msg) => this._onMessage(msg));
      transport.on("connected", () => this._onConnected());
      transport.on("disconnected", () => this._onDisconnected());
    }
  }

  on(event, cb) {
    this.listeners[event]?.push(cb);
    return this;
  }
  _emit(event, ...args) {
    (this.listeners[event] || []).forEach((cb) => cb(...args));
  }

  start() {
    this._setPhase(PHASE.CONNECTING);
    if (this.transport && typeof this.transport.connectToRoom === "function") {
    }
  }

  submitReady() {
    if (this._readySent) return;
    this._readySent = true;
    this._send(MSG.READY, { slot: this.mySlot });
  }

  submitLaunch(power, height, direction, angle) {
    const cmd = {
      slot: this.mySlot,
      power_q: Math.round(((power - 0.35) / 0.65) * 255),
      height_q: Math.round(Math.max(0, Math.min(1, height)) * 255),
      direction_q: Math.round(direction * 10),
      angle_q: Math.round(Math.max(-1, Math.min(1, angle)) * 127),
    };
    this._send(MSG.LAUNCH, encodeLaunchCommand(cmd));
    this._myLaunchSubmitted = true;
    this._pendingLaunch = cmd;
  }

  setLocalInput(control, flags = 0) {
    this._localControl = { x: control.x, y: control.y };
    this._localFlags = flags;
  }

  poll(deltaMs) {
    const delta = deltaMs / 1000;
    if (this.transport && typeof this.transport.poll === "function") {
      this.transport.poll();
    }
    this._syncPhaseFromSim();
    if (this.phase !== PHASE.RUNNING) {
      return this.sim.getSnapshot();
    }
    this._tickAccumulator += delta;
    while (this._tickAccumulator >= FIXED_DT) {
      this._tickAccumulator -= FIXED_DT;
      this._advanceTick();
    }
    return this.sim.getSnapshot();
  }

  _advanceTick() {
    const currentFrame = this.sim.frame + 1;
    let pCtrl = { x: 0, y: 0 };
    let eCtrl = { x: 0, y: 0 };
    const pInput = this._consumeInputForFrame(SLOT.PLAYER, currentFrame);
    const eInput = this._consumeInputForFrame(SLOT.ENEMY, currentFrame);
    pCtrl = dequantizeVector2({ x: pInput.cx, y: pInput.cy });
    eCtrl = dequantizeVector2({ x: eInput.cx, y: eInput.cy });
    this.sim.step(FIXED_DT, pCtrl, eCtrl);
    this._processEvents();
    this._sendInputBatch(currentFrame);
    if (this.sim.phase === "finished") {
      this._handleEnd();
    }
  }

  _consumeInputForFrame(slot, frame) {
    const queue = this._inputQueue[slot] || [];
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].f === frame) {
        const result = { ...queue[i] };
        queue.splice(i, 1);
        return decodeInputFrame(result);
      }
    }
    if (slot === this.mySlot) {
      return {
        frame,
        slot,
        cx: Math.round(Math.max(-1, Math.min(1, this._localControl.x)) * 127),
        cy: Math.round(Math.max(-1, Math.min(1, this._localControl.y)) * 127),
        flags: this._localFlags,
      };
    }
    return { frame, slot, cx: 0, cy: 0, flags: 0 };
  }

  _sendInputBatch(frame) {
    if (frame - this._lastSentFrame < INPUT_BATCH_SIZE) return;
    this._lastSentFrame = frame;
    const batch = [];
    for (let f = frame - INPUT_BATCH_SIZE + 1; f <= frame; f++) {
      batch.push(
        encodeInputFrame({
          frame: f,
          slot: this.mySlot,
          cx: Math.round(Math.max(-1, Math.min(1, this._localControl.x)) * 127),
          cy: Math.round(Math.max(-1, Math.min(1, this._localControl.y)) * 127),
          flags: this._localFlags,
        })
      );
    }
    this._localSeq++;
    this._send(MSG.INPUT, { frames: batch, seq: this._localSeq });
  }

  _processEvents() {
    for (const ev of this.sim.events || []) {
      this._emit("event", ev);
    }
  }

  _handleEnd() {
    this._setPhase(PHASE.FINISHED);
    this._emit("finish", this.sim.result);
  }

  _onConnected() {
    this._setPhase(PHASE.READY);
    this._send(MSG.HELLO, {
      protocol_version: PROTOCOL_VERSION,
      simulation_version: SIMULATION_VERSION,
      slot: this.mySlot,
    });
  }

  _onMessage(msg) {
    switch (msg.type) {
      case MSG.LAUNCH_WINDOW:
        this._setPhase(PHASE.LAUNCH_WINDOW);
        break;
      case MSG.LAUNCH_BOTH:
        this._handleLaunchBoth(msg.data);
        break;
      case MSG.INPUT_BATCH:
        this._handleInputBatch(msg.data);
        break;
      case MSG.RESULT:
        this._emit("finish", msg.data);
        this._setPhase(PHASE.FINISHED);
        break;
      case MSG.ERROR:
        this._emit("error", msg.data?.code || -1, msg.data?.message || "error");
        break;
    }
  }

  _handleLaunchBoth(data) {
    const pCmd = decodeLaunchCommand(data.player);
    const eCmd = decodeLaunchCommand(data.enemy);
    if (this.sim.launchExplicit) {
      this.sim.launchExplicit(pCmd, eCmd);
    } else {
      this.sim.launchFromCommands(pCmd, eCmd);
    }
    this._setPhase(PHASE.RUNNING);
  }

  _handleInputBatch(data) {
    const frames = data.frames || [];
    for (const f of frames) {
      const decoded = decodeInputFrame(f);
      const slot = decoded.slot;
      if (!this._inputQueue[slot]) this._inputQueue[slot] = [];
      this._inputQueue[slot].push(f);
    }
  }

  _onDisconnected() {
    this._setPhase(PHASE.CLOSED);
    this._emit("error", -1, "Disconnected");
  }

  _syncPhaseFromSim() {
    if (!this.sim) return;
    if (this.sim.phase === "running" && this.phase !== PHASE.RUNNING) {
      this._setPhase(PHASE.RUNNING);
    }
  }

  _setPhase(p) {
    if (this.phase === p) return;
    this.phase = p;
    this._emit("phase", p);
  }

  _send(type, data = {}) {
    if (this.transport?.isConnected?.()) {
      this.transport.sendMessage(makeEnvelope(type, data, this._localSeq));
    }
  }

  disconnect() {
    if (this.transport?.disconnect) this.transport.disconnect();
  }
}
