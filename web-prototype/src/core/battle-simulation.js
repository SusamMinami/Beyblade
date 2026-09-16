import { createStructure, applyStructuralImpact } from "./top-structure.js";
import { driveZoneState, insideDriveZone, DRIVE_ZONE_RULES } from "./drive-zones.js";

export const SIMULATION_VERSION = "2026.09.16-web-v4";

export const BATTLE_RESULT = Object.freeze({
  SPIN_OUT: "spin_out",
  RING_OUT: "ring_out",
  BREAK: "break",
  TIME: "time",
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

function createTop(build, position) {
  return {
    build,
    position: { ...position },
    velocity: { x: 0, y: 0 },
    spin: 0,
    spinPhase: 0,
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
    diagnostics = false,
    logger = console.debug,
  }) {
    this.playerBuild = playerBuild;
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
    this.reset();
  }

  reset() {
    this.phase = "ready";
    this.time = 0;
    this.frame = 0;
    this.result = null;
    this.events = [];
    this.collisionCooldown = 0;
    this.collisionLog = [];
    this.player = createTop(this.playerBuild, { x: 0, y: 4.45 });
    this.enemy = createTop(this.enemyBuild, { x: 0, y: -4.45 });
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
    };
  }

  setTuning(nextTuning) {
    Object.assign(this.tuning, nextTuning);
  }

  launch({ power = 0.86, height = 0.45, direction = 0, angle = 0 } = {}) {
    this.reset();
    this.phase = "running";
    const launchPower = clamp(power, 0.35, 1);
    const launchHeight = clamp(height, 0, 1);
    const launchAngle = clamp(angle, -1, 1);
    const playerSpeed =
      (3.4 + this.playerBuild.launchForwardImpulse * launchPower) *
      (0.94 + launchHeight * 0.12) *
      this.tuning.speedScale;
    const enemyPower = 0.78 + this._seedUnit(3) * 0.16;
    const enemySpeed =
      (3.4 + this.enemyBuild.launchForwardImpulse * enemyPower) *
      this.tuning.speedScale;

    this.player.velocity = {
      x: Math.sin(direction) * playerSpeed + launchAngle * 0.72,
      y: -Math.cos(direction) * playerSpeed,
    };
    const enemyDirection = (this._seedUnit(5) - 0.5) * 0.24;
    this.enemy.velocity = {
      x: Math.sin(enemyDirection) * enemySpeed,
      y: Math.cos(enemyDirection) * enemySpeed,
    };
    this.player.spin =
      this.playerBuild.maxSpinSpeed *
      launchPower *
      (1 - Math.abs(launchAngle) * 0.08) *
      (1 - launchHeight * 0.035);
    this.enemy.spin = this.enemyBuild.maxSpinSpeed * enemyPower;
    this.player.tilt =
      Math.abs(launchAngle) * 0.18 + Math.max(launchHeight - 0.55, 0) * 0.08;
    this.enemy.tilt = this._seedUnit(7) * 0.08;
    this.events.push({
      type: "launch",
      power: launchPower,
      height: launchHeight,
    });
  }

  _applyLaunchToTop(top, build, power, height, direction, angle) {
    const launchPower = clamp(0.35 + (power / 255) * 0.65, 0.35, 1);
    const launchHeight = clamp(height / 255, 0, 1);
    const launchDir = direction / 10;
    const launchAngle = clamp(angle / 127, -1, 1);
    const speed =
      (3.4 + build.launchForwardImpulse * launchPower) *
      (0.94 + launchHeight * 0.12) *
      this.tuning.speedScale;
    top.velocity = {
      x: Math.sin(launchDir) * speed + launchAngle * 0.72,
      y: -Math.cos(launchDir) * speed,
    };
    top.spin =
      build.maxSpinSpeed *
      launchPower *
      (1 - Math.abs(launchAngle) * 0.08) *
      (1 - launchHeight * 0.035);
    top.tilt = Math.abs(launchAngle) * 0.18 + Math.max(launchHeight - 0.55, 0) * 0.08;
  }

  launchExplicit(playerCmd, enemyCmd) {
    this.reset();
    this.phase = "running";
    this._applyLaunchToTop(this.player, this.playerBuild, playerCmd.power_q ?? playerCmd.p, playerCmd.height_q ?? playerCmd.h, playerCmd.direction_q ?? playerCmd.d, playerCmd.angle_q ?? playerCmd.a);
    this._applyLaunchToTop(this.enemy, this.enemyBuild, enemyCmd.power_q ?? enemyCmd.p, enemyCmd.height_q ?? enemyCmd.h, enemyCmd.direction_q ?? enemyCmd.d, enemyCmd.angle_q ?? enemyCmd.a);
    this.enemy.velocity.y = -this.enemy.velocity.y;
    this.events.push({ type: "launch", power: 0.86, height: 0.45 });
  }

  step(delta, playerControl = { x: 0, y: 0 }, enemyControl = null) {
    this.events = [];
    if (this.phase !== "running") return;

    const dt = clamp(delta, 0, 1 / 30);
    this.time += dt;
    this.frame = (this.frame | 0) + 1;
    this.collisionCooldown = Math.max(this.collisionCooldown - dt, 0);
    this.driveZone = driveZoneState(this.arena, this.time);
    // Occupancy is sampled simultaneously, before integrating either actor.
    this.zoneOccupants = [this.player, this.enemy].filter((top) =>
      !this.driveZone.cooling && top.spin > MIN_ACTIVE_SPIN &&
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
    const spinBefore = top.spin;
    top.spinPhase = (top.spinPhase + top.spin * dt * 0.32) % (Math.PI * 2);
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

    top.spin = Math.max(
      top.spin + gain * dt -
        (top.build.spinDecayPerSecond *
          currentSurface.spinDamping *
          this.tuning.spinScale + top.structure.spinDrag) *
          dt,
      0,
    );
    // Supply may only oppose drag, never exceed the motor's configured ceiling.

    const spinRatio = clamp(top.spin / top.build.maxSpinSpeed, 0, 1);
    const rawControl = {
      x: clamp(input.x ?? 0, -1, 1),
      y: clamp(input.y ?? 0, -1, 1),
    };
    const controlMagnitude = clamp(length(rawControl), 0, 1);
    const control = normalize(rawControl);
    const mobility = smoothstep(0.02, 0.55, spinRatio);
    const scrapeRatio = smoothstep(0.48, 0.82, top.tilt);
    const balanceControl = clamp(
      1 - top.imbalance * 0.45 - scrapeRatio * 0.35,
      0.35,
      1,
    );
    const controlAcceleration =
      (top.build.controlForce / top.structure.totalMass) *
      currentSurface.control *
      this.tuning.controlScale *
      mobility *
      balanceControl * controlMagnitude * top.structure.stiffness;
    top.velocity.x += control.x * controlAcceleration * dt;
    top.velocity.y += control.y * controlAcceleration * dt;
    top.controlInput = scale(control, controlMagnitude);
    top.controlInfluence = clamp(
      controlMagnitude *
        mobility *
        currentSurface.control *
        top.build.controlResponse *
        balanceControl,
      0,
      1,
    );

    if (radius > 0.01) {
      const inward = scale(top.position, -1 / radius);
      const bowlAcceleration =
        this.arena.bowlForce * (0.4 + radius / this.arena.wallRadius);
      top.velocity.x += inward.x * bowlAcceleration * dt;
      top.velocity.y += inward.y * bowlAcceleration * dt;
    }

    const eccentricity = Math.hypot(
      top.structure.centerOfMass[0],
      top.structure.centerOfMass[2],
    );
    if (eccentricity > 0.005 && spinRatio > 0.05) {
      const phase =
        this.time * (5.2 + spinRatio * 3.1) +
        (isEnemy ? 2.1 : 0.4) +
        this.seed * 0.0001;
      const wobble = eccentricity * 6.5 * Math.max(0.05, 1.2 - top.structure.stability) +
        top.structure.imbalance * 0.85;
      top.velocity.x += Math.cos(phase) * wobble * dt;
      top.velocity.y += Math.sin(phase) * wobble * dt;
    }

    if (currentSurface.noise > 0) {
      const noise =
        Math.sin(this.time * 17 + this.seed * 0.17 + (isEnemy ? 4 : 0)) *
        currentSurface.noise;
      top.velocity.x += noise * dt;
      top.velocity.y -= noise * 0.7 * dt;
    }

    if (scrapeRatio > 0) {
      const scrapeSpinLoss =
        (1.25 + top.build.friction * currentSurface.friction * 1.8) *
        scrapeRatio *
        dt;
      top.spin = Math.max(top.spin - scrapeSpinLoss, 0);
      const scrapePhase =
        this.time * 12.7 + this.seed * 0.0007 + (isEnemy ? 1.9 : 0.2);
      const scrapeDrift = scrapeRatio * (0.3 + top.imbalance * 0.9) * dt;
      top.velocity.x += Math.cos(scrapePhase) * scrapeDrift;
      top.velocity.y += Math.sin(scrapePhase) * scrapeDrift;
    }

    const drag =
      0.17 *
      top.build.friction *
      currentSurface.friction *
      currentSurface.linearDrag +
      (1 - mobility) * 8;
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
    this._resolveArenaRim(top, currentSurface);
    this._resolveObstacles(top);
    top.spinLossRate = (spinBefore - top.spin) / Math.max(dt, 1e-6);
  }

  _resolveArenaRim(top, surface) {
    if (this.arena.boundary === "square") {
      for (const axis of ["x", "y"]) {
        const value = top.position[axis];
        if (Math.abs(value) <= this.arena.wallRadius || Math.abs(value) >= this.arena.ringOutRadius) continue;
        const sign = Math.sign(value);
        const outward = top.velocity[axis] * sign;
        if (outward >= 9.2) continue;
        top.position[axis] = sign * (this.arena.wallRadius - .03);
        if (outward > 0) {
          top.velocity[axis] -= sign * outward * (1 + surface.bounce * .52);
          top.spin = Math.max(0, top.spin - outward * .24);
        }
      }
      return;
    }
    const radius = length(top.position);
    if (
      radius <= this.arena.wallRadius ||
      radius >= this.arena.ringOutRadius
    ) {
      return;
    }
    const normal = scale(top.position, 1 / radius);
    const outwardSpeed = dot(top.velocity, normal);
    const ringOutThreshold = 9.2;
    if (outwardSpeed >= ringOutThreshold) return;

    top.position = scale(normal, this.arena.wallRadius - 0.03);
    if (outwardSpeed > 0) {
      const rebound = outwardSpeed * (1 + surface.bounce * 0.52);
      top.velocity.x -= normal.x * rebound;
      top.velocity.y -= normal.y * rebound;
      top.spin = Math.max(top.spin - outwardSpeed * 0.24, 0);
    }
  }

  _boundaryDistance(position) {
    return this.arena.boundary === "square"
      ? Math.max(Math.abs(position.x), Math.abs(position.y)) : length(position);
  }

  _resolveObstacles(top) {
    for (const obstacle of this.arena.blockers ?? []) {
      const px=top.position.x, py=top.position.y;
      const nearestX=clamp(px,obstacle.x-obstacle.hx,obstacle.x+obstacle.hx);
      const nearestY=clamp(py,obstacle.z-obstacle.hz,obstacle.z+obstacle.hz);
      let dx=px-nearestX, dy=py-nearestY, distance=Math.hypot(dx,dy);
      const radius = this._contactRadius(top);
      if (distance>=radius) continue;
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
      top.velocity.x-=nx*approach*1.52;
      top.velocity.y-=ny*approach*1.52;
      top.spin=Math.max(0,top.spin+approach*.24);
      if (approach<-.4) {
        const impulse = -approach * top.structure.totalMass * 1.52;
        applyStructuralImpact(top, impulse * 0.75 * this.tuning.damageScale, Math.atan2(-ny, -nx));
        this.events.push({type:"obstacle",
        position:{x:nearestX,y:nearestY}, intensity:clamp(-approach/10,.1,1), impulse:-approach});
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
    const delta = {
      x: this.enemy.position.x - this.player.position.x,
      y: this.enemy.position.y - this.player.position.y,
    };
    const distance = length(delta);
    const minimumDistance = this._contactRadius(this.player) + this._contactRadius(this.enemy);
    if (distance >= minimumDistance) return;

    const normal = distance > 0.00001 ? scale(delta, 1 / distance) : { x: 1, y: 0 };
    const relativeVelocity = {
      x: this.enemy.velocity.x - this.player.velocity.x,
      y: this.enemy.velocity.y - this.player.velocity.y,
    };
    const normalSpeed = dot(relativeVelocity, normal);
    const overlap = minimumDistance - distance;
    this.player.position.x -= normal.x * overlap * 0.5;
    this.player.position.y -= normal.y * overlap * 0.5;
    this.enemy.position.x += normal.x * overlap * 0.5;
    this.enemy.position.y += normal.y * overlap * 0.5;
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
    const normalImpulse =
      (-(1 + restitution) * Math.min(normalSpeed, 0)) /
      (inversePlayerMass + inverseEnemyMass);
    // Rotating rim teeth can separate a sustained contact. Debit the resulting
    // translational energy from spin; this avoids motionless pushing in a zone.
    const canStrike = this.collisionCooldown <= 0;
    const lobeFactor = 0.65 + (this.player.build.parts[0].customization?.shape ?? 0) / 200 +
      (this.enemy.build.parts[0].customization?.shape ?? 0) / 200;
    const toothImpulse = canStrike
      ? Math.min(1.8, Math.min(this.player.spin, this.enemy.spin) * 0.045) * lobeFactor : 0;
    const inverseMass = inversePlayerMass + inverseEnemyMass;
    const transferEnergy = Math.max(0, toothImpulse * (normalSpeed + normalImpulse * inverseMass) +
      0.5 * toothImpulse ** 2 * inverseMass);
    for (const top of [this.player, this.enemy]) {
      top.spin = Math.sqrt(Math.max(0, top.spin ** 2 - transferEnergy / top.structure.momentOfInertia));
    }
    const impulse = normalImpulse + toothImpulse;

    this.player.velocity.x -= normal.x * impulse * inversePlayerMass;
    this.player.velocity.y -= normal.y * impulse * inversePlayerMass;
    this.enemy.velocity.x += normal.x * impulse * inverseEnemyMass;
    this.enemy.velocity.y += normal.y * impulse * inverseEnemyMass;

    if (this.collisionCooldown <= 0 && impulse > MIN_DAMAGE_IMPULSE) {
      const collisionBefore = {
        player: this._collisionTopState(this.player),
        enemy: this._collisionTopState(this.enemy),
      };
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
      this.player.spin = Math.max(this.player.spin - impulse * 0.19, 0);
      this.enemy.spin = Math.max(this.enemy.spin - impulse * 0.19, 0);
      this._applyCollisionImbalance(
        this.player,
        this.enemy.build.attackPower,
        playerSurface,
        impulse,
      );
      this._applyCollisionImbalance(
        this.enemy,
        this.player.build.attackPower,
        enemySurface,
        impulse,
      );
      this.collisionCooldown = 0.12;
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

  _applyCollisionImbalance(top, incomingAttack, surface, impulse) {
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
    top.tilt = clamp(top.tilt + gain * 0.28, 0, MAX_TILT);
  }

  _collisionTopState(top) {
    return {
      tilt: round(top.tilt),
      spin: round(top.spin),
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
    const speed = length(top.velocity);
    const spinRatio = clamp(top.spin / top.build.maxSpinSpeed, 0, 1);
    const surface = this.arena.surfaceAt(length(top.position));
    const effectiveStability = top.structure.stability * surface.stability;
    const instability = clamp(
      1.15 - effectiveStability + top.imbalance * 0.72,
      0,
      1.25,
    );
    const targetTilt = clamp(
      instability * 0.48 +
        speed * 0.012 +
        (1 - spinRatio) * 0.32 +
        top.imbalance * 0.2,
      0,
      MAX_TILT,
    );
    top.tilt += (targetTilt - top.tilt) * Math.min(dt * 4, 1);
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
    const candidates = [
      [this.player, "enemy"],
      [this.enemy, "player"],
    ];
    for (const [loser, winnerId] of candidates) {
      if (loser.durability <= 0 || loser.structure.failed) {
        this._finish(winnerId, BATTLE_RESULT.BREAK);
        return;
      }
      if (this._boundaryDistance(loser.position) > this.arena.ringOutRadius) {
        this._finish(winnerId, BATTLE_RESULT.RING_OUT);
        return;
      }
      if (loser.spin <= MIN_ACTIVE_SPIN) {
        this._finish(winnerId, BATTLE_RESULT.SPIN_OUT);
        return;
      }
    }

    if (this.time >= MAX_BATTLE_TIME) {
      const playerScore =
        this.player.spin +
        (this.player.durability / this.player.build.durability) * 20;
      const enemyScore =
        this.enemy.spin +
        (this.enemy.durability / this.enemy.build.durability) * 20;
      this._finish(playerScore >= enemyScore ? "player" : "enemy", BATTLE_RESULT.TIME);
    }
  }

  _finish(winner, reason) {
    this.phase = "finished";
    const loser = winner === "player" ? this.enemy : this.player;
    const weakest = [...loser.structure.parts].sort((a, b) => b.worst - a.worst)[0];
    this.result = { winner, reason, time: this.time,
      cause: reason === BATTLE_RESULT.SPIN_OUT &&
        (loser.structure.imbalance > 0.2 || loser.structure.spinDrag > loser.build.spinDecayPerSecond * 0.35)
        ? "structural_spin_out" : reason,
      weakestPart: weakest.slot, weakestPartName: weakest.name,
      loserImbalance: loser.structure.imbalance,
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
