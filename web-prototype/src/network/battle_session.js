import { MODE, PHASE, SLOT, FIXED_DT } from "./protocol.js";
import { WebSocketTransport } from "./websocket_transport.js";
import { FrameSyncProvider } from "./frame_sync_provider.js";
import { AsyncVerifyProvider } from "./async_verify_provider.js";

export class BattleSession {
  constructor() {
    this.mode = MODE.LOCAL;
    this.transport = null;
    this.sim = null;
    this.provider = null;
    this.mySlot = SLOT.PLAYER;
    this.phase = PHASE.INIT;
    this._snapshotHistory = [];
    this._maxHistory = 30;
    this._listeners = {
      phase: [],
      state: [],
      event: [],
      finish: [],
      replay: [],
      error: [],
      connected: [],
      disconnected: [],
    };
  }

  on(event, cb) {
    if (this._listeners[event]) this._listeners[event].push(cb);
    return this;
  }
  _emit(event, ...args) {
    (this._listeners[event] || []).forEach((cb) => cb(...args));
  }
  _setPhase(p) {
    if (this.phase === p) return;
    this.phase = p;
    this._emit("phase", p);
  }
  _trackSnapshot(snap) {
    this._snapshotHistory.push(snap);
    if (this._snapshotHistory.length > this._maxHistory) this._snapshotHistory.shift();
  }

  static createLocalAIBattle(sim) {
    const session = new BattleSession();
    session.mode = MODE.LOCAL;
    session.sim = sim;
    session.mySlot = SLOT.PLAYER;
    session._setPhase(PHASE.READY);
    return session;
  }

  static createFrameSyncBattle(sim, transport, slot = SLOT.PLAYER) {
    const session = new BattleSession();
    session.mode = MODE.FRAME_SYNC;
    session.sim = sim;
    session.transport = transport;
    session.mySlot = slot;
    session.provider = new FrameSyncProvider(sim, transport, slot);
    session._wireProvider(session.provider);
    session.provider.start();
    if (transport?.on) {
      transport.on("connected", () => session._emit("connected"));
      transport.on("disconnected", () => session._emit("disconnected"));
    }
    return session;
  }

  static createAsyncVerifyBattle(sim, slot = SLOT.PLAYER, ghostSeed = 0, ghostStrategy = null) {
    const session = new BattleSession();
    session.mode = MODE.ASYNC_VERIFY;
    session.sim = sim;
    session.mySlot = slot;
    session.provider = new AsyncVerifyProvider(sim, slot, ghostSeed, ghostStrategy);
    session._wireProvider(session.provider);
    session.provider.start();
    return session;
  }

  _wireProvider(p) {
    p.on("phase", (ph) => this._setPhase(ph));
    p.on("state", (snap) => {
      this._trackSnapshot(snap);
      this._emit("state", snap);
    });
    p.on("event", (ev) => this._emit("event", ev));
    p.on("finish", (result) => {
      this._setPhase(PHASE.FINISHED);
      this._emit("finish", result);
    });
    p.on("replay", (r) => this._emit("replay", r));
    p.on("error", (code, msg) => this._emit("error", code, msg));
  }

  async connectToRoom(url, ticket = {}) {
    if (!this.transport) throw new Error("No transport configured");
    this._setPhase(PHASE.CONNECTING);
    if (this.transport.connectToRoom) {
      await this.transport.connectToRoom(url, ticket);
    }
  }

  submitReady() {
    if (this.mode === MODE.LOCAL) {
      this._setPhase(PHASE.LAUNCH_WINDOW);
      return;
    }
    this.provider?.submitReady?.();
  }

  submitLaunch(power, height, direction, angle) {
    if (this.mode === MODE.LOCAL) {
      this.sim.launch(power, direction, angle, height);
      this._setPhase(PHASE.RUNNING);
      return;
    }
    this.provider?.submitLaunch?.(power, height, direction, angle);
  }

  setLocalInput(control, flags = 0) {
    if (this.mode === MODE.LOCAL) return;
    this.provider?.setLocalInput?.(control, flags);
  }

  poll(deltaMs) {
    if (this.mode === MODE.LOCAL) {
      if (this.sim.phase === "running") {
        const delta = deltaMs / 1000;
        this.sim.step(delta);
        for (const ev of this.sim.events || []) this._emit("event", ev);
        if (this.sim.phase === "finished") {
          this._setPhase(PHASE.FINISHED);
          this._emit("finish", this.sim.result);
        }
      }
      const snap = this.sim.getSnapshot();
      this._trackSnapshot(snap);
      this._emit("state", snap);
      return snap;
    }
    return this.provider?.poll?.(deltaMs);
  }

  getRenderSnapshot() {
    if (this._snapshotHistory.length >= 1) return this._snapshotHistory[this._snapshotHistory.length - 1];
    return this.sim?.getSnapshot?.();
  }

  getMySlot() {
    return this.mySlot;
  }

  disconnect() {
    this.provider?.disconnect?.();
    this.transport?.disconnect?.();
  }
}
