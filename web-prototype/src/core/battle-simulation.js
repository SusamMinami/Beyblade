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
    durability: build.durability,
    tilt: 0,
    surfaceName: "",
    controlInput: { x: 0, y: 0 },
    controlInfluence: 0,
  };
}

export class BattleSimulation {
  constructor({
    playerBuild,
    enemyBuild,
    arena,
    seed = 20260718,
    tuning = {},
  }) {
    this.playerBuild = playerBuild;
    this.enemyBuild = enemyBuild;
    this.arena = arena;
    this.seed = seed >>> 0;
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
    this.result = null;
    this.events = [];
    this.collisionCooldown = 0;
    this.player = createTop(this.playerBuild, { x: 0, y: 4.45 });
    this.enemy = createTop(this.enemyBuild, { x: 0, y: -4.45 });
  }

  setTuning(nextTuning) {
    Object.assign(this.tuning, nextTuning);
  }

  launch({ power = 0.86, direction = 0, angle = 0 } = {}) {
    this.reset();
    this.phase = "running";
    const launchPower = clamp(power, 0.35, 1);
    const launchAngle = clamp(angle, -1, 1);
    const playerSpeed =
      (3.4 + this.playerBuild.launchForwardImpulse * launchPower) *
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
      (1 - Math.abs(launchAngle) * 0.08);
    this.enemy.spin = this.enemyBuild.maxSpinSpeed * enemyPower;
    this.player.tilt = Math.abs(launchAngle) * 0.18;
    this.enemy.tilt = this._seedUnit(7) * 0.08;
    this.events.push({ type: "launch", power: launchPower });
  }

  step(delta, playerControl = { x: 0, y: 0 }) {
    this.events = [];
    if (this.phase !== "running") return;

    const dt = clamp(delta, 0, 1 / 30);
    this.time += dt;
    this.collisionCooldown = Math.max(this.collisionCooldown - dt, 0);

    const enemyControl = this._getEnemyControl();
    this._integrateTop(this.player, playerControl, dt, false);
    this._integrateTop(this.enemy, enemyControl, dt, true);
    this._resolveCollision();
    this._updateTilt(this.player, dt);
    this._updateTilt(this.enemy, dt);
    this._checkResult();
  }

  _integrateTop(top, input, dt, isEnemy) {
    const radius = length(top.position);
    const currentSurface = this.arena.surfaceAt(radius);
    top.surfaceName = currentSurface.name;

    top.spin = Math.max(
      top.spin -
        top.build.spinDecayPerSecond *
          currentSurface.spinDamping *
          this.tuning.spinScale *
          dt,
      0,
    );

    const spinRatio = clamp(top.spin / top.build.maxSpinSpeed, 0, 1);
    const rawControl = {
      x: clamp(input.x ?? 0, -1, 1),
      y: clamp(input.y ?? 0, -1, 1),
    };
    const controlMagnitude = clamp(length(rawControl), 0, 1);
    const control = normalize(rawControl);
    const mobility = smoothstep(0.02, 0.55, spinRatio);
    const controlAcceleration =
      (top.build.controlForce / top.build.totalMass) *
      currentSurface.control *
      this.tuning.controlScale *
      mobility;
    top.velocity.x += control.x * controlAcceleration * dt;
    top.velocity.y += control.y * controlAcceleration * dt;
    top.controlInput = scale(control, controlMagnitude);
    top.controlInfluence = clamp(
      controlMagnitude *
        mobility *
        currentSurface.control *
        top.build.controlResponse,
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
      top.build.centerOfMass[0],
      top.build.centerOfMass[2],
    );
    if (eccentricity > 0.005 && spinRatio > 0.05) {
      const phase =
        this.time * (5.2 + spinRatio * 3.1) +
        (isEnemy ? 2.1 : 0.4) +
        this.seed * 0.0001;
      const wobble = eccentricity * 6.5 * (1.2 - top.build.stability);
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
  }

  _resolveArenaRim(top, surface) {
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

  _getEnemyControl() {
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
    const minimumDistance = TOP_RADIUS * 2;
    if (distance >= minimumDistance || distance <= 0.00001) return;

    const normal = scale(delta, 1 / distance);
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
    if (normalSpeed >= 0) return;

    const playerSurface = this.arena.surfaceAt(length(this.player.position));
    const enemySurface = this.arena.surfaceAt(length(this.enemy.position));
    const restitution =
      clamp(
        (this.player.build.restitution + this.enemy.build.restitution) * 0.5,
        0.12,
        0.82,
      ) *
      ((playerSurface.bounce + enemySurface.bounce) * 0.5);
    const inversePlayerMass = 1 / this.player.build.totalMass;
    const inverseEnemyMass = 1 / this.enemy.build.totalMass;
    const impulse =
      (-(1 + restitution) * normalSpeed) /
      (inversePlayerMass + inverseEnemyMass);

    this.player.velocity.x -= normal.x * impulse * inversePlayerMass;
    this.player.velocity.y -= normal.y * impulse * inversePlayerMass;
    this.enemy.velocity.x += normal.x * impulse * inverseEnemyMass;
    this.enemy.velocity.y += normal.y * impulse * inverseEnemyMass;

    if (this.collisionCooldown <= 0 && impulse > MIN_DAMAGE_IMPULSE) {
      const baseDamage =
        (impulse - MIN_DAMAGE_IMPULSE) *
        DAMAGE_PER_IMPULSE *
        this.tuning.damageScale;
      const damageToPlayer =
        baseDamage * this.enemy.build.attackPower * enemySurface.damage;
      const damageToEnemy =
        baseDamage * this.player.build.attackPower * playerSurface.damage;
      this.player.durability = Math.max(
        this.player.durability - damageToPlayer,
        0,
      );
      this.enemy.durability = Math.max(
        this.enemy.durability - damageToEnemy,
        0,
      );
      this.player.spin = Math.max(this.player.spin - impulse * 0.19, 0);
      this.enemy.spin = Math.max(this.enemy.spin - impulse * 0.19, 0);
      this.collisionCooldown = 0.12;
      this.events.push({
        type: "collision",
        impulse,
        intensity: clamp(impulse / 7, 0, 1),
        position: {
          x: (this.player.position.x + this.enemy.position.x) * 0.5,
          y: (this.player.position.y + this.enemy.position.y) * 0.5,
        },
      });
    }
  }

  _updateTilt(top, dt) {
    const speed = length(top.velocity);
    const spinRatio = clamp(top.spin / top.build.maxSpinSpeed, 0, 1);
    const instability = clamp(1.15 - top.build.stability, 0, 0.8);
    const targetTilt = clamp(
      instability * 0.5 + speed * 0.012 + (1 - spinRatio) * 0.32,
      0,
      0.62,
    );
    top.tilt += (targetTilt - top.tilt) * Math.min(dt * 4, 1);
  }

  _checkResult() {
    const candidates = [
      [this.player, this.enemy, "enemy"],
      [this.enemy, this.player, "player"],
    ];
    for (const [loser, winner, winnerId] of candidates) {
      if (loser.durability <= 0) {
        this._finish(winnerId, BATTLE_RESULT.BREAK);
        return;
      }
      if (length(loser.position) > this.arena.ringOutRadius) {
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
    this.result = { winner, reason, time: this.time };
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
      durability: round(top.durability),
      tilt: round(top.tilt),
      surfaceName: top.surfaceName,
      controlInfluence: round(top.controlInfluence),
    });
    return {
      phase: this.phase,
      time: round(this.time),
      result: this.result
        ? {
            winner: this.result.winner,
            reason: this.result.reason,
            time: round(this.result.time),
          }
        : null,
      player: topSnapshot(this.player),
      enemy: topSnapshot(this.enemy),
    };
  }
}
