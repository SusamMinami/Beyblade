import { createStructure, applyStructuralImpact } from "./top-structure.js";
import { driveZoneState, insideDriveZone, DRIVE_ZONE_RULES } from "./drive-zones.js";
import { oilEffects } from "./maintenance-state.js";
import { normalizeLauncher, activeLauncherOil, LAUNCHER_VERSION } from "./launcher-state.js";
import { launcherLaunchState } from "./launcher-physics.js";
import { DYNAMICS_VERSION, lossTorques, applyGroundContact,
  updateAxis, signedSpin, loseSpin, resolveDiskContact } from "./top-dynamics.js";
import { sampleArenaContact, boundaryDistance, controlResponse, CONTACT_GRAVITY } from "./arena-contact.js";

export const SIMULATION_VERSION = `${DYNAMICS_VERSION}+${LAUNCHER_VERSION}`;

export const BATTLE_RESULT = Object.freeze({
  SPIN_OUT: "spin_out",
  RING_OUT: "ring_out",
  BREAK: "break",
  TIME: "time",
  DRAW: "draw",
});

const TOP_RADIUS = 0.69;
const MIN_ACTIVE_SPIN = 2;
const MIN_DAMAGE_IMPULSE = 0.35;
const DAMAGE_PER_IMPULSE = 1.1;
const MAX_BATTLE_TIME = 75;
const TILT_WARNING = 0.38;
const TILT_CRITICAL = 0.62;
const MAX_TILT = 0.9;
const MAX_COLLISION_LOGS = 200;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const smoothstep = (edge0, edge1, value) => {
  const ratio = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return ratio * ratio * (3 - 2 * ratio);
};
const length = (vector) => Math.hypot(vector.x, vector.y);
const dot = (left, right) => left.x * right.x + left.y * right.y;
const scale = (vector, amount) => ({
  x: vector.x * amount,
  y: vector.y * amount,
});
const normalize = (vector) => {
  const magnitude = length(vector);
  return magnitude > 0.00001
    ? scale(vector, 1 / magnitude)
    : { x: 0, y: 0 };
};
const round = (value) => Math.round(value * 1e6) / 1e6;
const plain = value => JSON.parse(JSON.stringify(value));
const canonical = value => JSON.stringify(value, function(key, item) {
  return item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item;
});
// Required solver fields follow the initial state, including nested axis,
// structure and oil data. Runtime diagnostics may add fields.
const hasStateShape = (value, template) => {
  if (template === null) return value === null || typeof value === "string";
  if (Array.isArray(template)) return Array.isArray(value) &&
    (!template.length || (value.length === template.length &&
      template.every((item, i) => hasStateShape(value[i], item))));
  if (typeof template === "object") return value !== null && typeof value === "object" &&
    !Array.isArray(value) && Object.entries(template).every(([key, item]) =>
      Object.hasOwn(value, key) && hasStateShape(value[key], item));
  return typeof value === typeof template;
};

function createTop(build, position) {
  return {
    build,
    position: { ...position },
    velocity: { x: 0, y: 0 },
    spin: 0,
    spinPhase: 0,
    spinDirection: 1,
    tiltVector: { x: 0, y: 0 },
    tiltRate: { x: 0, y: 0 },
    axis: { x: 0, y: 1, z: 0 },
    ground: { state: "gripping", slip: 0 },
    edge: { falling: false, drop: 0, velocity: 0, height: 0 },
    obstacleContacts: new Set(),
    structure: createStructure(build),
    zone: { id: null, contested: false, gain: 0 },
    stats: { zoneSeconds: 0, spinHarvested: 0, hits: 0, peakImpulse: 0 },
    durability: build.durability,
    tilt: 0,
    surfaceName: "",
    controlInput: { x: 0, y: 0 },
    controlInfluence: 0,
    imbalance: 0,
    spinLossRate: 0,
    ringOutRisk: 0,
    stabilityState: "stable",
    ringRiskState: "safe",
    spinRiskState: "safe",
  };
}

export class BattleSimulation {
  constructor({
    playerBuild,
    enemyBuild,
    arena,
    seed = 20260718,
    tuning = {},
    maintenance = {},
    launchers = {},
    diagnostics = false,
    logger = console.debug,
  }) {
    this.playerBuild = playerBuild;
    this.version = SIMULATION_VERSION;
    this.enemyBuild = enemyBuild;
    this.arena = arena;
    this.seed = seed >>> 0;
    this.diagnostics = diagnostics;
    this.logger = logger;
    this.collisionLog = [];
    this.tuning = {
      damageScale: 1,
      spinScale: 1,
      controlScale: 1,
      speedScale: 1,
      ...tuning,
    };
    this.launchers = { player: normalizeLauncher(launchers.player), enemy: normalizeLauncher(launchers.enemy) };
    this.maintenance = Object.fromEntries(["player", "enemy"].map(side => [side,
      oilEffects({ ...maintenance[side],
        launcher: activeLauncherOil(maintenance[side]?.launcher, this.launchers[side]) })]));
    this.reset();
  }

  reset() {
    this.phase = "ready";
    this.time = 0;
    this.frame = 0;
    this.result = null;
    this.events = [];
    this.contactActive = false;
    this.collisionLog = [];
    this.player = createTop(this.playerBuild, { x: 0, y: 4.45 });
    this.enemy = createTop(this.enemyBuild, { x: 0, y: -4.45 });
    this.player.oil = this.maintenance.player;
    this.enemy.oil = this.maintenance.enemy;
    this.driveZone = driveZoneState(this.arena, 0);
    this.zoneOccupants = [];
    this.lastZoneKey = "";
  }

  getSnapshot() {
    return {
      phase: this.phase,
      frame: this.frame | 0,
      time: this.time,
      result: this.result,
      player: this.player,
      enemy: this.enemy,
      events: this.events,
      driveZone: this.driveZone,
      launchers: structuredClone(this.launchers),
      simulationVersion: SIMULATION_VERSION,
    };
  }

  setTuning(nextTuning) {
    Object.assign(this.tuning, nextTuning);
  }

  _stateContext() {
    const { surfaceAt, ...arena } = this.arena;
    const builds = [this.playerBuild, this.enemyBuild].map(build => ({ ...build,
      parts: build.parts.map(({ price, description, ...part }) => part) }));
    return plain({ builds, arena,
      surfaces: [0, 3.1, 5.9, this.arena.wallRadius].map(r => surfaceAt(r)) });
  }

  // Lossless local recovery format, deliberately separate from the rounded HUD
  // snapshot and legacy binary network codec.
  exportState() {
    const topState = top => {
      const { build, obstacleContacts, ...fields } = top;
      return { ...plain(fields), obstacleContacts: [...obstacleContacts].sort((a, b) => a-b) };
    };
    return {
      schema: 1, simulationVersion: SIMULATION_VERSION, context: this._stateContext(),
      seed: this.seed, tuning: plain(this.tuning), launchers: plain(this.launchers),
      maintenance: plain(this.maintenance), phase: this.phase, frame: this.frame, time: this.time,
      result: plain(this.result), events: plain(this.events), collisionLog: plain(this.collisionLog),
      contactActive: this.contactActive, lastZoneKey: this.lastZoneKey,
      driveZone: plain(this.driveZone),
      zoneOccupants: this.zoneOccupants.map(t => t === this.player ? "player" : "enemy"),
      player: topState(this.player), enemy: topState(this.enemy),
    };
  }

  restoreState(state) {
    const fail = () => { throw new Error("战斗恢复数据损坏，或规则／装配／场地版本不匹配"); };
    const fields = ["seed", "tuning", "launchers", "maintenance", "phase", "frame", "time",
      "result", "events", "collisionLog", "contactActive", "lastZoneKey", "driveZone"];
    const valid = v => typeof v === "number" ? Number.isFinite(v) : v == null ||
      typeof v !== "object" || Object.values(v).every(valid);
    if (!state || fields.some(k => state[k] === undefined) || !valid(state) ||
      state.schema !== 1 || state.simulationVersion !== SIMULATION_VERSION ||
      canonical(state.context) !== canonical(this._stateContext()) ||
      !["ready", "running", "finished"].includes(state.phase) ||
      !Number.isInteger(state.seed) || state.seed < 0 || state.seed > 0xffffffff ||
      !Number.isInteger(state.frame) || state.frame < 0 || !(state.time >= 0) ||
      !hasStateShape(state, { time: 0, contactActive: false, lastZoneKey: "",
        tuning: this.tuning, launchers: this.launchers, maintenance: this.maintenance }) ||
      !Array.isArray(state.zoneOccupants) || state.zoneOccupants.some(s => !["player", "enemy"].includes(s)) ||
      !Array.isArray(state.events) ||
      !Array.isArray(state.collisionLog) || !state.tuning || !state.launchers || !state.maintenance) fail();
    const restored = {};
    for (const side of ["player", "enemy"]) {
      const d = state[side];
      const template = createTop(this[`${side}Build`], { x: 0, y: 0 });
      delete template.build;
      template.obstacleContacts = [];
      template.oil = this.maintenance[side];
      if (!hasStateShape(d, template) || !(d.spin >= 0) ||
        ![-1, 1].includes(d.spinDirection)) fail();
      restored[side] = { ...plain(d), build: this[`${side}Build`],
        obstacleContacts: new Set(d.obstacleContacts) };
    }
    // Validate first: a failed restore leaves the live match untouched.
    for (const key of fields) {
      this[key] = plain(state[key]);
    }
    this.player = restored.player;
    this.enemy = restored.enemy;
    this.zoneOccupants = state.zoneOccupants.map(side => this[side]);
    return this;
  }

  launch(options = {}) {
    this.reset();
    this.phase = "running";
    Object.assign(this.player, launcherLaunchState(this.playerBuild, this.launchers.player,
      { ...options, speedScale: this.tuning.speedScale }, this.player.oil));
    const enemyPower = 0.78 + this._seedUnit(3) * 0.16;
    Object.assign(this.enemy, launcherLaunchState(this.enemyBuild, this.launchers.enemy, {
      power: enemyPower, height: 0, direction: Math.PI + (this._seedUnit(5) - .5) * .24,
      angle: this._seedUnit(7) * .3, speedScale: this.tuning.speedScale }, this.enemy.oil));
    this.events.push({
      type: "launch",
      power: clamp(options.power ?? .86, .35, 1),
      height: clamp(options.height ?? .45, 0, 1),
    });
  }

  _applyLaunchToTop(top, build, power, height, direction, angle, side = 0, spinDirection = 1) {
    const launchPower = clamp(0.35 + (power / 255) * 0.65, 0.35, 1);
    const launchHeight = clamp(height / 255, 0, 1);
    const launchDir = direction / 10 + side;
    const launchAngle = clamp(angle / 127, -1, 1);
    Object.assign(top, launcherLaunchState(build, this.launchers[top === this.player ? "player" : "enemy"],
      { power: launchPower, height: launchHeight, direction: launchDir, angle: launchAngle,
        spinDirection, speedScale: this.tuning.speedScale }, top.oil));
  }

  launchExplicit(playerCmd, enemyCmd) {
    this.reset();
    this.phase = "running";
    this._applyLaunchToTop(this.player, this.playerBuild, playerCmd.power_q ?? playerCmd.p, playerCmd.height_q ?? playerCmd.h, playerCmd.direction_q ?? playerCmd.d, playerCmd.angle_q ?? playerCmd.a, 0, playerCmd.spinDirection);
    this._applyLaunchToTop(this.enemy, this.enemyBuild, enemyCmd.power_q ?? enemyCmd.p, enemyCmd.height_q ?? enemyCmd.h, enemyCmd.direction_q ?? enemyCmd.d, enemyCmd.angle_q ?? enemyCmd.a, Math.PI, enemyCmd.spinDirection);
    this.events.push({ type: "launch", power: 0.86, height: 0.45 });
  }

  step(delta, playerControl = { x: 0, y: 0 }, enemyControl = null) {
    this.events = [];
    if (this.phase !== "running") return;

    const dt = clamp(delta, 0, 1 / 30);
    if (!Number.isFinite(dt) || dt === 0) return;
    this.frame = (this.frame | 0) + 1;
    for (const top of [this.player, this.enemy]) {
      top.spinBudget = { before: top.spin, supply: 0, natural: 0, scrape: 0, ground: 0, contact: 0 };
    }
    // At the speed cap, a microstep travels less than a minimum-size contact
    // radius. Thin obstacle faces and rapidly varying rim slopes stay resolved.
    const count = Math.ceil(dt / (1 / 120));
    const start = this.time;
    for (let i = 0; i < count && this.phase === "running"; i++) {
      this._substep(dt / count, playerControl, enemyControl);
    }
    const elapsed = this.time - start;
    for (const top of [this.player, this.enemy]) {
      const budget = top.spinBudget;
      budget.after = top.spin;
      budget.contact = budget.before + budget.supply - budget.natural -
        budget.scrape - budget.ground - budget.after;
      top.spinLossRate = (budget.before - budget.after) / elapsed;
      top.zone.status = !top.zone.id ? "outside" : top.zone.gain === 0 ? "capped"
        : top.spinLossRate < -1e-6 ? "gaining" : "draining";
    }
  }

  _substep(dt, playerControl, enemyControl) {
    this.time += dt;
    this.driveZone = driveZoneState(this.arena, this.time);
    // Occupancy is sampled simultaneously, before integrating either actor.
    this.zoneOccupants = [this.player, this.enemy].filter((top) =>
      !this.driveZone.cooling && !top.edge.falling && top.spin > MIN_ACTIVE_SPIN &&
      insideDriveZone(top, this.driveZone.active));
    const zoneKey = `${this.driveZone.active?.id}:${this.driveZone.cooling}`;
    if (zoneKey !== this.lastZoneKey) {
      this.lastZoneKey = zoneKey;
      this.events.push({ type: "drive_zone", id: this.driveZone.active?.id,
        cooling: this.driveZone.cooling });
    }

    const enemyCtrl = enemyControl !== null ? enemyControl : this._getEnemyControl();
    this._integrateTop(this.player, playerControl, dt, false);
    this._integrateTop(this.enemy, enemyCtrl, dt, true);
    this._resolveCollision();
    if (this.arena.blockers) {
      this._resolveObstacles(this.player);
      this._resolveObstacles(this.enemy);
    }
    this._updateTilt(this.player, dt);
    this._updateTilt(this.enemy, dt);
    this._updateRiskStates(this.player, "player");
    this._updateRiskStates(this.enemy, "enemy");
    this._checkResult();
  }

  _integrateTop(top, input, dt, isEnemy) {
    const radius = length(top.position);
    const currentSurface = this.arena.surfaceAt(radius);
    top.surfaceName = currentSurface.name;
    top.terrain = sampleArenaContact(this.arena, top.position);
    if (top.edge.falling || !top.terrain.supported) {
      if (!top.edge.falling) {
        top.edge.falling = true;
        top.edge.height = top.terrain.height;
      }
      top.edge.velocity += CONTACT_GRAVITY * dt;
      top.edge.drop += top.edge.velocity * dt;
      top.position.x += top.velocity.x * dt;
      top.position.y += top.velocity.y * dt;
      top.ground = { state: "airborne", slip: 0, traction: 0, radius: 0 };
      top.controlInput = { x: 0, y: 0 };
      top.controlInfluence = 0;
      top.zone = { id: null, contested: false, gain: 0 };
      top.spinPhase = (top.spinPhase + signedSpin(top) * dt) % (Math.PI * 2);
      return;
    }
    top.spinPhase = (top.spinPhase + signedSpin(top) * dt) % (Math.PI * 2);
    const inZone = this.zoneOccupants.includes(top);
    const contested = this.zoneOccupants.length > 1;
    // Torque / live inertia; motor never repairs damage or revives a stopped top.
    const supplied = inZone ? DRIVE_ZONE_RULES.torque /
      top.structure.momentOfInertia * (contested ? 0.35 : 1) *
      clamp(1 - top.structure.imbalance * 0.6, 0.25, 1) : 0;
    const gain = Math.min(supplied, Math.max(0,
      top.build.maxSpinSpeed * DRIVE_ZONE_RULES.spinCap - top.spin) / Math.max(dt, 1e-6));
    top.zone = { id: inZone ? this.driveZone.active.id : null, contested: inZone && contested, gain };
    if (inZone) {
      top.stats.zoneSeconds += dt;
      top.stats.spinHarvested += gain * dt;
    }

    top.spin += gain * dt;
    if (top.spinBudget) top.spinBudget.supply += gain * dt;
    const torques = lossTorques(top, currentSurface, this.tuning.spinScale);
    // Only the ground share changes; structural/scrape loss is never lubricated away.
    torques.natural *= 1 + .35 * (top.oil.groundSpin - 1);
    loseSpin(top, torques.natural / top.structure.momentOfInertia * dt, "natural");
    loseSpin(top, torques.scrape / top.structure.momentOfInertia * dt, "scrape");
    const tractionAcceleration = applyGroundContact(top, { ...currentSurface,
      friction: currentSurface.friction * top.oil.traction,
      linearDrag: currentSurface.linearDrag * top.oil.traction }, dt);
    // Supply may only oppose drag, never exceed the motor's configured ceiling.

    const spinRatio = clamp(top.spin / top.build.maxSpinSpeed, 0, 1);
    const rawControl = controlResponse(input);
    const controlMagnitude = clamp(length(rawControl), 0, 1);
    const control = normalize(rawControl);
    const mobility = smoothstep(0.02, 0.55, spinRatio);
    const scrapeRatio = smoothstep(0.48, 0.82, top.tilt);
    const balanceControl = clamp(
      1 - top.imbalance * 0.45 - scrapeRatio * 0.35,
      0.35,
      1,
    );
    const requestedAcceleration =
      (top.build.controlForce / top.structure.totalMass) *
      currentSurface.control *
      this.tuning.controlScale *
      mobility *
      balanceControl * controlMagnitude * top.structure.stiffness;
    // Player assistance is an external force, bounded by the current tip's grip.
    const controlAcceleration = Math.min(requestedAcceleration, tractionAcceleration * mobility);
    top.velocity.x += control.x * controlAcceleration * dt;
    top.velocity.y += control.y * controlAcceleration * dt;
    top.controlInput = scale(control, controlMagnitude);
    top.controlInfluence = clamp(
      controlMagnitude *
        mobility *
        currentSurface.control *
        top.oil.traction *
        top.build.controlResponse *
        balanceControl,
      0,
      1,
    );

    const gradient = top.terrain.gradient;
    const slopeFactor = CONTACT_GRAVITY / (1 + gradient.x ** 2 + gradient.y ** 2);
    top.velocity.x -= gradient.x * slopeFactor * dt;
    top.velocity.y -= gradient.y * slopeFactor * dt;

    if (currentSurface.noise > 0) {
      const noise =
        Math.sin(this.time * 17 + this.seed * 0.17 + (isEnemy ? 4 : 0)) *
        currentSurface.noise;
      top.velocity.x += noise * dt;
      top.velocity.y -= noise * 0.7 * dt;
    }

    const drag = (1 - mobility) * 8;
    const dragFactor = Math.exp(-drag * dt);
    top.velocity.x *= dragFactor;
    top.velocity.y *= dragFactor;

    const maxSpeed =
      (0.35 + (8.15 + top.build.attackPower * 1.5) * Math.sqrt(mobility)) *
      this.tuning.speedScale;
    const speed = length(top.velocity);
    if (speed > maxSpeed) {
      top.velocity = scale(top.velocity, maxSpeed / speed);
    }
    top.position.x += top.velocity.x * dt;
    top.position.y += top.velocity.y * dt;
    this._resolveObstacles(top);
  }

  _boundaryDistance(position) {
    return boundaryDistance(this.arena, position);
  }

  _resolveObstacles(top) {
    if (top.edge.falling) return;
    const blockers = this.arena.blockers ?? [];
    for (const [index, obstacle] of blockers.entries()) {
      const px=top.position.x, py=top.position.y;
      const nearestX=clamp(px,obstacle.x-obstacle.hx,obstacle.x+obstacle.hx);
      const nearestY=clamp(py,obstacle.z-obstacle.hz,obstacle.z+obstacle.hz);
      let dx=px-nearestX, dy=py-nearestY, distance=Math.hypot(dx,dy);
      const radius = this._contactRadius(top);
      if (distance > radius + .04) top.obstacleContacts.delete(index);
      if (distance>=radius) continue;
      const entering = !top.obstacleContacts.has(index);
      top.obstacleContacts.add(index);
      let depth=radius-distance;
      if (distance<1e-8) {
        const gapX=obstacle.hx-Math.abs(px-obstacle.x);
        const gapY=obstacle.hz-Math.abs(py-obstacle.z);
        dx=gapX<gapY ? (Math.sign(px-obstacle.x)||1) : 0;
        dy=gapX<gapY ? 0 : (Math.sign(py-obstacle.z)||1);
        depth=radius+Math.min(gapX,gapY);
        distance=1;
      }
      const nx=dx/distance, ny=dy/distance;
      top.position.x+=nx*(depth+.001);
      top.position.y+=ny*(depth+.001);
      const approach=top.velocity.x*nx+top.velocity.y*ny;
      if (approach>=0) continue;
      const contact = resolveDiskContact(top, null, { x: -nx, y: -ny }, radius, 0, .52);
      if (entering && approach<-.4) {
        const impulse = contact.normal;
        applyStructuralImpact(top, impulse * 0.75 * this.tuning.damageScale, Math.atan2(-ny, -nx));
        this._applyCollisionImbalance(top, 1, this.arena.surfaceAt(length(top.position)), impulse, { x: nx, y: ny });
        this.events.push({type:"obstacle",
        position:{x:nearestX,y:nearestY}, intensity:clamp(-approach/10,.1,1), impulse,
        tangentImpulse: contact.tangent});
      }
    }
  }

  _getEnemyControl() {
    const active = this.driveZone?.active;
    if (active) {
      const enemy = this.enemy;
      const contest = insideDriveZone(this.player, active) &&
        Math.hypot(this.player.position.x - enemy.position.x, this.player.position.y - enemy.position.y) < 3.2;
      const target = contest ? this.player.position : active;
      const attackBias = clamp((enemy.build.attackPower - 0.85) * 1.8, 0, 0.8);
      const desired = {
        x: (target.x - enemy.position.x) * (contest ? 2 + attackBias : 1.6) - enemy.velocity.x * (contest ? 0.4 - attackBias * 0.3 : 1.05),
        y: (target.y - enemy.position.y) * (contest ? 2 + attackBias : 1.6) - enemy.velocity.y * (contest ? 0.4 - attackBias * 0.3 : 1.05),
      };
      // Repel from expanded obstacles; pick a lateral bypass if heading into a face.
      for (const obstacle of this.arena.blockers ?? []) {
        const dx = enemy.position.x - obstacle.x, dy = enemy.position.y - obstacle.z;
        const sx = obstacle.hx + 1.25, sy = obstacle.hz + 1.25;
        if (Math.abs(dx) < sx && Math.abs(dy) < sy) {
          const strength = (1 - Math.min(Math.abs(dx) / sx, Math.abs(dy) / sy)) * 4;
          if (Math.abs(dx) / sx > Math.abs(dy) / sy) desired.x += (Math.sign(dx) || 1) * strength;
          else {
            desired.y += (Math.sign(dy) || 1) * strength;
            desired.x += (Math.sign(target.x - obstacle.x) || 1) * 2;
          }
        }
      }
      const magnitude = length(desired);
      return magnitude > 1 ? scale(desired, 1 / magnitude) : desired;
    }
    const toPlayer = {
      x: this.player.position.x - this.enemy.position.x,
      y: this.player.position.y - this.enemy.position.y,
    };
    const distance = Math.max(length(toPlayer), 0.001);
    const pursuit = scale(toPlayer, 1 / distance);
    const orbitSign = this._seedUnit(11) > 0.5 ? 1 : -1;
    const orbit = { x: -pursuit.y * orbitSign, y: pursuit.x * orbitSign };
    const aggression = clamp(this.enemy.build.attackPower - 0.72, 0.15, 0.7);
    const retreat =
      length(this.enemy.position) > this.arena.wallRadius * 0.78
        ? scale(normalize(this.enemy.position), -0.85)
        : { x: 0, y: 0 };
    return {
      x:
        pursuit.x * aggression +
        orbit.x * (0.62 - aggression * 0.35) +
        retreat.x,
      y:
        pursuit.y * aggression +
        orbit.y * (0.62 - aggression * 0.35) +
        retreat.y,
    };
  }

  _resolveCollision() {
    if (this.player.edge.falling || this.enemy.edge.falling) {
      this.contactActive = false;
      return;
    }
    const delta = {
      x: this.enemy.position.x - this.player.position.x,
      y: this.enemy.position.y - this.player.position.y,
    };
    const distance = length(delta);
    const minimumDistance = this._contactRadius(this.player) + this._contactRadius(this.enemy);
    if (distance > minimumDistance + .04) this.contactActive = false;
    if (distance >= minimumDistance) return;
    const entering = !this.contactActive;
    this.contactActive = true;

    const normal = distance > 0.00001 ? scale(delta, 1 / distance) : { x: 1, y: 0 };
    const relativeVelocity = {
      x: this.enemy.velocity.x - this.player.velocity.x,
      y: this.enemy.velocity.y - this.player.velocity.y,
    };
    const normalSpeed = dot(relativeVelocity, normal);
    const overlap = minimumDistance - distance;
    const totalMass = this.player.structure.totalMass + this.enemy.structure.totalMass;
    const playerShare = this.enemy.structure.totalMass / totalMass;
    this.player.position.x -= normal.x * overlap * playerShare;
    this.player.position.y -= normal.y * overlap * playerShare;
    this.enemy.position.x += normal.x * overlap * (1 - playerShare);
    this.enemy.position.y += normal.y * overlap * (1 - playerShare);
    if (normalSpeed >= 0.2) return;

    const playerSurface = this.arena.surfaceAt(length(this.player.position));
    const enemySurface = this.arena.surfaceAt(length(this.enemy.position));
    const restitution =
      clamp(
        (this.player.build.restitution + this.enemy.build.restitution) * 0.5,
        0.12,
        0.82,
      ) *
      ((playerSurface.bounce + enemySurface.bounce) * 0.5);
    const inversePlayerMass = 1 / this.player.structure.totalMass;
    const inverseEnemyMass = 1 / this.enemy.structure.totalMass;
    const collisionBefore = {
      player: this._collisionTopState(this.player),
      enemy: this._collisionTopState(this.enemy),
    };
    const contact = resolveDiskContact(this.player, this.enemy, normal,
      this._contactRadius(this.player), this._contactRadius(this.enemy), restitution);
    const normalImpulse = contact.normal;
    // Rotating rim teeth can separate a sustained contact. Debit the resulting
    // translational energy from spin; this avoids motionless pushing in a zone.
    const lobeFactor = 0.65 + (this.player.build.parts[0].customization?.shape ?? 0) / 200 +
      (this.enemy.build.parts[0].customization?.shape ?? 0) / 200;
    const requestedToothImpulse = entering
      ? Math.min(1.8, Math.min(this.player.spin, this.enemy.spin) * 0.045) * lobeFactor : 0;
    const inverseMass = inversePlayerMass + inverseEnemyMass;
    const energy = [this.player, this.enemy].map(top => .5 * top.structure.momentOfInertia * top.spin ** 2);
    const available = energy[0] + energy[1];
    const separatingSpeed = Math.max(0, normalSpeed + normalImpulse * inverseMass);
    const affordable = (Math.sqrt(separatingSpeed ** 2 + 2 * inverseMass * available) - separatingSpeed) / inverseMass;
    const toothImpulse = Math.min(requestedToothImpulse, affordable);
    const transferEnergy = Math.max(0, toothImpulse * separatingSpeed +
      0.5 * toothImpulse ** 2 * inverseMass);
    for (const [index, top] of [this.player, this.enemy].entries()) {
      const debit = transferEnergy * energy[index] / Math.max(available, 1e-12);
      top.spin = Math.sqrt(Math.max(0, top.spin ** 2 - 2 * debit / top.structure.momentOfInertia));
    }
    const impulse = normalImpulse + toothImpulse;

    this.player.velocity.x -= normal.x * toothImpulse * inversePlayerMass;
    this.player.velocity.y -= normal.y * toothImpulse * inversePlayerMass;
    this.enemy.velocity.x += normal.x * toothImpulse * inverseEnemyMass;
    this.enemy.velocity.y += normal.y * toothImpulse * inverseEnemyMass;

    if (entering && impulse > MIN_DAMAGE_IMPULSE) {
      const baseDamage =
        (impulse - MIN_DAMAGE_IMPULSE) *
        DAMAGE_PER_IMPULSE *
        this.tuning.damageScale;
      const damageToPlayer =
        baseDamage * this.enemy.build.attackPower * enemySurface.damage;
      const damageToEnemy =
        baseDamage * this.player.build.attackPower * playerSurface.damage;
      const angle = Math.atan2(normal.y, normal.x);
      const playerParts = applyStructuralImpact(this.player, damageToPlayer, angle);
      const enemyParts = applyStructuralImpact(this.enemy, damageToEnemy, angle + Math.PI);
      for (const top of [this.player, this.enemy]) {
        top.stats.hits += 1;
        top.stats.peakImpulse = Math.max(top.stats.peakImpulse, impulse);
      }
      loseSpin(this.player, impulse * .19 * .89 / this.player.structure.momentOfInertia);
      loseSpin(this.enemy, impulse * .19 * .89 / this.enemy.structure.momentOfInertia);
      this._applyCollisionImbalance(
        this.player,
        this.enemy.build.attackPower,
        playerSurface,
        impulse,
        scale(normal, -1),
      );
      this._applyCollisionImbalance(
        this.enemy,
        this.player.build.attackPower,
        enemySurface,
        impulse,
        normal,
      );
      const telemetry = this._createCollisionTelemetry(
        impulse,
        collisionBefore,
        {
          player: this._collisionTopState(this.player),
          enemy: this._collisionTopState(this.enemy),
        },
        damageToPlayer,
        damageToEnemy,
      );
      telemetry.player.parts = playerParts;
      telemetry.enemy.parts = enemyParts;
      telemetry.tangentImpulse = contact.tangent;
      telemetry.contactSlip = contact.slip;
      this.collisionLog.push(telemetry);
      if (this.collisionLog.length > MAX_COLLISION_LOGS) {
        this.collisionLog.shift();
      }
      if (this.diagnostics) {
        this.logger("[BattleSimulation] collision", telemetry);
      }
      this.events.push({
        type: "collision",
        impulse,
        intensity: clamp(impulse / 7, 0, 1),
        position: {
          x: (this.player.position.x + this.enemy.position.x) * 0.5,
          y: (this.player.position.y + this.enemy.position.y) * 0.5,
        },
        telemetry,
      });
    }
  }

  _contactRadius(top) {
    const part = top.build.parts[0];
    return TOP_RADIUS * (part.customization?.size ?? 1) *
      (1 + (part.customization?.shape ?? 0) * 0.0006);
  }

  _applyCollisionImbalance(top, incomingAttack, surface, impulse, direction = { x: 1, y: 0 }) {
    const spinRatio = clamp(top.spin / top.build.maxSpinSpeed, 0, 1);
    const effectiveStability = Math.max(
      top.structure.stability * surface.stability,
      0.2,
    );
    const lowSpinVulnerability = 0.72 + (1 - spinRatio) * 0.55;
    const gain = clamp(
      ((impulse - MIN_DAMAGE_IMPULSE) / 7) *
        (incomingAttack / effectiveStability) *
        lowSpinVulnerability *
        0.48,
      0,
      0.5,
    );
    top.imbalance = clamp(top.imbalance + gain, 0, 1);
    const momentumSupport = 1 + top.structure.momentOfInertia * top.spin / 58;
    top.tiltVector.x += direction.x * gain * .28 / momentumSupport;
    top.tiltVector.y += direction.y * gain * .28 / momentumSupport;
    top.tiltRate.x += direction.x * gain * 3 / momentumSupport;
    top.tiltRate.y += direction.y * gain * 3 / momentumSupport;
    top.tilt = clamp(length(top.tiltVector), 0, MAX_TILT);
  }

  _collisionTopState(top) {
    return {
      tilt: round(top.tilt),
      spin: round(top.spin),
      launcherTelemetry: top.launcherTelemetry ? { ...top.launcherTelemetry } : null,
      imbalance: round(top.imbalance),
      durability: round(top.durability),
      structuralImbalance: round(top.structure.imbalance),
      inertia: round(top.structure.momentOfInertia),
    };
  }

  _createCollisionTelemetry(
    impulse,
    before,
    after,
    damageToPlayer,
    damageToEnemy,
  ) {
    const topDelta = (previous, next, damage) => ({
      tiltBefore: previous.tilt,
      tiltAfter: next.tilt,
      tiltDelta: round(next.tilt - previous.tilt),
      spinBefore: previous.spin,
      spinAfter: next.spin,
      spinDelta: round(next.spin - previous.spin),
      imbalanceBefore: previous.imbalance,
      imbalanceAfter: next.imbalance,
      imbalanceDelta: round(next.imbalance - previous.imbalance),
      durabilityBefore: previous.durability,
      durabilityAfter: next.durability,
      damage: round(previous.durability - next.durability),
      impactLoad: round(damage),
      structuralImbalanceBefore: previous.structuralImbalance,
      structuralImbalanceAfter: next.structuralImbalance,
      inertiaBefore: previous.inertia,
      inertiaAfter: next.inertia,
    });
    return {
      time: round(this.time),
      impulse: round(impulse),
      intensity: round(clamp(impulse / 7, 0, 1)),
      position: {
        x: round((this.player.position.x + this.enemy.position.x) * 0.5),
        y: round((this.player.position.y + this.enemy.position.y) * 0.5),
      },
      player: topDelta(before.player, after.player, damageToPlayer),
      enemy: topDelta(before.enemy, after.enemy, damageToEnemy),
    };
  }

  _updateTilt(top, dt) {
    const spinRatio = clamp(top.spin / top.build.maxSpinSpeed, 0, 1);
    const surface = this.arena.surfaceAt(length(top.position));
    const effectiveStability = top.structure.stability * surface.stability;
    updateAxis(top, surface, dt);
    const recovery =
      (0.1 + effectiveStability * 0.16) * (0.55 + spinRatio * 0.45);
    top.imbalance = Math.max(top.imbalance - recovery * dt, top.structure.imbalance);
    top.ringOutRisk = this._calculateRingOutRisk(top);
  }

  _calculateRingOutRisk(top) {
    const radius = this._boundaryDistance(top.position);
    const edgeRisk = smoothstep(
      this.arena.wallRadius * 0.7,
      this.arena.ringOutRadius,
      radius,
    );
    const edgeAxis = Math.abs(top.position.x) >= Math.abs(top.position.y) ? "x" : "y";
    const outward = this.arena.boundary === "square"
      ? Math.max(0, top.velocity[edgeAxis] * Math.sign(top.position[edgeAxis]))
      : radius > 0.001
        ? Math.max(dot(top.velocity, scale(top.position, 1 / radius)), 0)
        : 0;
    const momentumRisk = smoothstep(1.5, 9.2, outward);
    const tiltRisk = smoothstep(TILT_WARNING, MAX_TILT, top.tilt);
    return clamp(
      edgeRisk * 0.58 + momentumRisk * 0.27 + tiltRisk * 0.15,
      0,
      1,
    );
  }

  _updateRiskStates(top, actor) {
    const nextStabilityState =
      top.tilt >= TILT_CRITICAL
        ? "critical"
        : top.tilt >= TILT_WARNING
          ? "wobble"
          : "stable";
    const nextRingRiskState =
      top.ringOutRisk >= 0.78
        ? "critical"
        : top.ringOutRisk >= 0.5
          ? "warning"
          : "safe";
    const spinRatio = clamp(top.spin / top.build.maxSpinSpeed, 0, 1);
    const nextSpinRiskState =
      spinRatio <= 0.16
        ? "critical"
        : spinRatio <= 0.32
          ? "warning"
          : "safe";

    this._emitRiskTransition(
      top,
      actor,
      "stabilityState",
      nextStabilityState,
      "stability",
    );
    this._emitRiskTransition(
      top,
      actor,
      "ringRiskState",
      nextRingRiskState,
      "ring_out_risk",
    );
    this._emitRiskTransition(
      top,
      actor,
      "spinRiskState",
      nextSpinRiskState,
      "spin_risk",
    );
  }

  _emitRiskTransition(top, actor, property, nextState, type) {
    if (top[property] === nextState) return;
    top[property] = nextState;
    this.events.push({
      type,
      actor,
      state: nextState,
      tilt: round(top.tilt),
      spin: round(top.spin),
      imbalance: round(top.imbalance),
      ringOutRisk: round(top.ringOutRisk),
    });
  }

  _checkResult() {
    const failure = top => top.durability <= 0 || top.structure.failed ? BATTLE_RESULT.BREAK
      : top.edge.drop > .3 || this._boundaryDistance(top.position) > this.arena.ringOutRadius ? BATTLE_RESULT.RING_OUT
        : top.spin <= MIN_ACTIVE_SPIN ? BATTLE_RESULT.SPIN_OUT : null;
    const eliminations = { player: failure(this.player), enemy: failure(this.enemy) };
    if (eliminations.player || eliminations.enemy) {
      const both = eliminations.player && eliminations.enemy;
      this._finish(both ? "draw" : eliminations.player ? "enemy" : "player",
        both ? BATTLE_RESULT.DRAW : eliminations.player ?? eliminations.enemy, eliminations);
      return;
    }

    if (this.time >= MAX_BATTLE_TIME) {
      const playerScore =
        this.player.spin +
        (this.player.durability / this.player.build.durability) * 20;
      const enemyScore =
        this.enemy.spin +
        (this.enemy.durability / this.enemy.build.durability) * 20;
      this._finish(Math.abs(playerScore - enemyScore) <= 1e-6 ? "draw"
        : playerScore > enemyScore ? "player" : "enemy", BATTLE_RESULT.TIME);
    }
  }

  _finish(winner, reason, eliminations = {}) {
    this.phase = "finished";
    const loser = winner === "player" ? this.enemy : this.player;
    const weakest = [...loser.structure.parts].sort((a, b) => b.worst - a.worst)[0];
    this.result = { winner, reason, time: this.time, eliminations,
      cause: winner === "draw" ? "draw" : reason === BATTLE_RESULT.SPIN_OUT &&
        (loser.structure.imbalance > 0.2 || loser.structure.spinDrag > loser.build.spinDecayPerSecond * 0.35)
        ? "structural_spin_out" : reason,
      weakestPart: winner === "draw" ? null : weakest.slot,
      weakestPartName: winner === "draw" ? null : weakest.name,
      loserImbalance: winner === "draw" ? null : loser.structure.imbalance,
      stats: { player: { ...this.player.stats }, enemy: { ...this.enemy.stats } },
    };
    this.events.push({ type: "result", ...this.result });
  }

  _seedUnit(salt) {
    let value = (this.seed + salt * 0x9e3779b9) >>> 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 0xffffffff;
  }

  snapshot() {
    const topSnapshot = (top) => ({
      position: {
        x: round(top.position.x),
        y: round(top.position.y),
      },
      velocity: {
        x: round(top.velocity.x),
        y: round(top.velocity.y),
      },
      spin: round(top.spin),
      spinPhase: round(top.spinPhase),
      spinDirection: top.spinDirection,
      tiltVector: { ...top.tiltVector },
      tiltRate: { ...top.tiltRate },
      axis: { ...top.axis },
      ground: { ...top.ground },
      terrain: top.terrain ? structuredClone(top.terrain) : null,
      edge: { ...top.edge },
      spinBudget: top.spinBudget ? { ...top.spinBudget } : null,
      structure: JSON.parse(JSON.stringify(top.structure, (key, value) =>
        typeof value === "number" ? round(value) : value)),
      zone: { ...top.zone, gain: round(top.zone.gain) },
      stats: { ...top.stats },
      durability: round(top.durability),
      tilt: round(top.tilt),
      imbalance: round(top.imbalance),
      spinLossRate: round(top.spinLossRate),
      spinRatio: round(
        clamp(top.spin / Math.max(top.build.maxSpinSpeed, 0.001), 0, 1),
      ),
      ringOutRisk: round(top.ringOutRisk),
      stabilityState: top.stabilityState,
      surfaceName: top.surfaceName,
      controlInfluence: round(top.controlInfluence),
    });
    return {
      phase: this.phase,
      time: round(this.time),
      frame: this.frame,
      simulationVersion: SIMULATION_VERSION,
      launchers: structuredClone(this.launchers),
      driveZone: this.driveZone,
      result: this.result
        ? {
            ...this.result,
            time: round(this.result.time),
          }
        : null,
      player: topSnapshot(this.player),
      enemy: topSnapshot(this.enemy),
    };
  }
}
