import {
  FIXED_DT,
  HASH_CHECK_INTERVAL,
  PHASE,
  SLOT,
  dequantizePower,
  dequantizeHeight,
  dequantizeDirection,
  dequantizeAngle,
  dequantizeControl,
  quantizePower,
  quantizeHeight,
  quantizeDirection,
  quantizeAngle,
  quantizeControl,
} from "./protocol.js";

const dequantizeVector2 = (d) => ({ x: dequantizeControl(d.x | 0), y: dequantizeControl(d.y | 0) });

function _encInputFrame({ frame, slot, cx, cy, flags }) {
  return { f: frame, s: slot, cx: cx | 0, cy: cy | 0, fl: (flags || 0) & 0x3f };
}
function _encLaunchCommand(cmd) {
  if (!cmd) return null;
  return { power_q: cmd.power_q ?? cmd.p, height_q: cmd.height_q ?? cmd.h, direction_q: cmd.direction_q ?? cmd.d, angle_q: cmd.angle_q ?? cmd.a, slot: cmd.slot };
}

export async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeSnapshot(snap) {
  const r6 = (v) => Math.round(v * 1e6) / 1e6;
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  const normTop = (t) => ({
    px: r6(t.position?.x ?? 0),
    py: r6(t.position?.y ?? 0),
    vx: r6(t.velocity?.x ?? 0),
    vy: r6(t.velocity?.y ?? 0),
    sp: r4(t.spin ?? 0),
    du: r4(t.durability ?? 0),
    ti: r4(t.tilt ?? 0),
    im: r4(t.imbalance ?? 0),
    sl: r4(t.spin_loss_rate ?? 0),
    rr: r4(t.ring_out_risk ?? 0),
    ss: String(t.stability_state ?? "stable"),
    rs: String(t.ring_risk_state ?? "safe"),
    sr: String(t.spin_risk_state ?? "safe"),
    ci: r4(t.control_influence ?? 0),
  });
  return {
    phase: String(snap.phase ?? "ready"),
    frame: snap.frame | 0,
    time: r6(snap.time ?? 0),
    result: snap.result && Object.keys(snap.result).length ? snap.result : null,
    player: normTop(snap.player || {}),
    enemy: normTop(snap.enemy || {}),
  };
}

export class AsyncVerifyProvider {
  constructor(sim, slot = SLOT.PLAYER, ghostSeed = 0, ghostStrategy = null) {
    this.sim = sim;
    this.mySlot = slot;
    this.phase = PHASE.INIT;
    this.ghostStrategy = ghostStrategy || this._defaultGhostStrategy(ghostSeed);
    this.listeners = { phase: [], state: [], event: [], finish: [], replay: [], error: [] };

    this._localControl = { x: 0, y: 0 };
    this._playerLaunch = null;
    this._enemyLaunch = null;
    this._launchSubmitted = false;
    this._recorder = [];
    this._checkpoints = [];
    this._tickAccumulator = 0;
  }

  on(event, cb) {
    this.listeners[event]?.push(cb);
    return this;
  }
  _emit(event, ...args) {
    (this.listeners[event] || []).forEach((cb) => cb(...args));
  }

  start() {
    this._setPhase(PHASE.READY);
  }

  submitReady() {
    this._setPhase(PHASE.LAUNCH_WINDOW);
  }

  submitLaunch(power, height, direction, angle) {
    this._playerLaunch = {
      slot: this.mySlot,
      power_q: quantizePower(power),
      height_q: quantizeHeight(height),
      direction_q: quantizeDirection(direction),
      angle_q: quantizeAngle(angle),
    };
    this._enemyLaunch = this.ghostStrategy.getLaunchCommand(1 - this.mySlot);
    this._launchSubmitted = true;
    if (this.sim.launchExplicit) {
      if (this.mySlot === SLOT.PLAYER) {
        this.sim.launchExplicit(this._playerLaunch, this._enemyLaunch);
      } else {
        this.sim.launchExplicit(this._enemyLaunch, this._playerLaunch);
      }
    }
    this._setPhase(PHASE.RUNNING);
    this._recorder = [];
    this._checkpoints = [];
    this._recordFrame(0, true);
  }

  setLocalInput(control, flags = 0) {
    this._localControl = { x: control.x, y: control.y };
    this._localFlags = flags;
  }

  _defaultGhostStrategy(seed) {
    let s = seed || Date.now();
    const rng = () => {
      s = (s + 0x9e3779b9) | 0;
      let t = s ^ (s << 13);
      t ^= t >>> 17;
      t ^= t << 5;
      return ((t >>> 0) % 1000000) / 1000000;
    };
    return {
      getLaunchCommand: () => ({
        slot: 1,
        power_q: Math.round((0.78 + rng() * 0.16) * 255),
        height_q: Math.round((0.45 + (rng() - 0.5) * 0.2) * 255),
        direction_q: Math.round((rng() - 0.5) * 0.24 * 10),
        angle_q: Math.round((rng() - 0.5) * 0.12 * 127),
      }),
      getInput: (sim, slot, frame) => {
        const self = slot === SLOT.PLAYER ? sim.player : sim.enemy;
        const opp = slot === SLOT.PLAYER ? sim.enemy : sim.player;
        if (!self || !opp) return { cx: 0, cy: 0, flags: 0 };
        const toOpp = { x: opp.position.x - self.position.x, y: opp.position.y - self.position.y };
        const dist = Math.max(Math.hypot(toOpp.x, toOpp.y), 0.001);
        const pursuit = { x: toOpp.x / dist, y: toOpp.y / dist };
        const orbit = { x: -pursuit.y, y: pursuit.x };
        const agg = Math.max(0.15, Math.min(0.8, (self.build?.attack_power ?? 0.5) - 0.3));
        let retreat = { x: 0, y: 0 };
        if (Math.hypot(self.position.x, self.position.y) > (sim.arena?.wall_radius ?? 5.5) * 0.78) {
          const r = Math.hypot(self.position.x, self.position.y);
          retreat = { x: -self.position.x / r * 0.85, y: -self.position.y / r * 0.85 };
        }
        const cx = pursuit.x * agg + orbit.x * (0.62 - agg * 0.35) + retreat.x;
        const cy = pursuit.y * agg + orbit.y * (0.62 - agg * 0.35) + retreat.y;
        const len = Math.hypot(cx, cy);
        const nx = len > 1 ? cx / len : cx;
        const ny = len > 1 ? cy / len : cy;
        return {
          cx: Math.round(nx * 127),
          cy: Math.round(ny * 127),
          flags: 0,
        };
      },
    };
  }

  poll(deltaMs) {
    const delta = deltaMs / 1000;
    this._tickAccumulator += delta;
    if (this.phase !== PHASE.RUNNING) return this.sim.getSnapshot?.() || {};
    while (this._tickAccumulator >= FIXED_DT) {
      this._tickAccumulator -= FIXED_DT;
      this._advanceTick();
    }
    const snap = this.sim.getSnapshot?.() || {};
    this._emit("state", snap);
    return snap;
  }

  _advanceTick() {
    const currentFrame = (this.sim.frame || 0) + 1;
    const pRaw = {
      cx: Math.round(Math.max(-1, Math.min(1, this._localControl.x)) * 127),
      cy: Math.round(Math.max(-1, Math.min(1, this._localControl.y)) * 127),
    };
    const eRaw = this.ghostStrategy.getInput(this.sim, SLOT.ENEMY, currentFrame);
    const pCtrl = dequantizeVector2({ x: pRaw.cx, y: pRaw.cy });
    const eCtrl = dequantizeVector2({ x: eRaw.cx, y: eRaw.cy });
    this._recorder.push({
      f: currentFrame,
      p: _encInputFrame({ frame: currentFrame, slot: SLOT.PLAYER, cx: pRaw.cx, cy: pRaw.cy, flags: 0 }),
      e: _encInputFrame({ frame: currentFrame, slot: SLOT.ENEMY, cx: eRaw.cx, cy: eRaw.cy, flags: 0 }),
    });
    this.sim.step(FIXED_DT, pCtrl, eCtrl);
    this._recordFrame(currentFrame, false);
    for (const ev of this.sim.events || []) this._emit("event", ev);
    if (this.sim.phase === "finished") this._finishAsync();
  }

  async _recordFrame(frame, isLaunch) {
    if (isLaunch || frame % HASH_CHECK_INTERVAL === 0) {
      const snap = this.sim.getSnapshot();
      const hash = await sha256Hex(JSON.stringify(normalizeSnapshot(snap)));
      this._checkpoints.push({ frame, hash, snapshot: normalizeSnapshot(snap) });
    }
  }

  async _finishAsync() {
    this._setPhase(PHASE.FINISHED);
    const finalSnap = this.sim.getSnapshot();
    const finalHash = await sha256Hex(JSON.stringify(normalizeSnapshot(finalSnap)));
    const replay = {
      manifest: {
        protocol_version: 1,
        simulation_version: "2026.07.21-web-v2",
        fixed_step_hz: FIXED_DT,
      },
      mode: "async_verify",
      seed: this.sim.seed,
      arena_id: this.sim.arena?.id || "standard",
      launches: {
        player: _encLaunchCommand(this._playerLaunch),
        enemy: _encLaunchCommand(this._enemyLaunch),
      },
      inputs: this._recorder,
      checkpoints: this._checkpoints,
      final_hash: finalHash,
      result: this.sim.result,
    };
    this._emit("finish", this.sim.result);
    this._emit("replay", replay);
  }

  _setPhase(p) {
    if (this.phase === p) return;
    this.phase = p;
    this._emit("phase", p);
  }
}
