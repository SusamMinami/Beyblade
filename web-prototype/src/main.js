import "./styles.css";
import { AudioEngine } from "./audio/audio-engine.js";
import { calculateBuild, getBuildRatings } from "./core/assembly-calculator.js";
import {
  BattleSimulation,
  BATTLE_RESULT,
} from "./core/battle-simulation.js";
import { ARENA_LIST, getArena } from "./data/arenas.js";
import {
  DEFAULT_BUILD,
  getPart,
  getPartsByType,
  PART_TYPE_META,
} from "./data/parts.js";
import { ThreeStage } from "./render/three-stage.js";

const STORAGE_KEY = "spin-core-web-prototype-v1";
const FIXED_STEP = 1 / 60;
const SLOT_ORDER = [
  "attackRing",
  "coreLock",
  "weightDisc",
  "driverShaft",
  "tip",
];
const RESULT_LABELS = {
  [BATTLE_RESULT.SPIN_OUT]: "停转胜利",
  [BATTLE_RESULT.RING_OUT]: "撞飞胜利",
  [BATTLE_RESULT.BREAK]: "击破胜利",
  [BATTLE_RESULT.TIME]: "计时判定",
};
const ENEMY_BUILDS = {
  standard: {
    attackRing: "attack_ring.balance_six",
    coreLock: "core_lock.reinforced",
    weightDisc: "weight_disc.standard",
    driverShaft: "driver_shaft.low_stable",
    tip: "tip.rubber_balance",
  },
  metal: {
    attackRing: "attack_ring.smash_three",
    coreLock: "core_lock.standard",
    weightDisc: "weight_disc.eccentric",
    driverShaft: "driver_shaft.high_attack",
    tip: "tip.flat_attack",
  },
  composite: {
    attackRing: "attack_ring.stamina_arc",
    coreLock: "core_lock.low_center",
    weightDisc: "weight_disc.heavy_outer",
    driverShaft: "driver_shaft.low_stable",
    tip: "tip.metal_stamina",
  },
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function loadState() {
  const fallback = {
    build: { ...DEFAULT_BUILD },
    colors: { ring: "#27c9b3", core: "#efbd3c" },
    arenaId: "standard",
    coins: 0,
    sound: true,
    tuning: {
      damageScale: 1,
      spinScale: 1,
      controlScale: 1,
      speedScale: 1,
    },
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      ...fallback,
      ...saved,
      build: { ...fallback.build, ...saved?.build },
      colors: { ...fallback.colors, ...saved?.colors },
      tuning: { ...fallback.tuning, ...saved?.tuning },
    };
  } catch {
    return fallback;
  }
}

class BeybladeApp {
  constructor(root) {
    this.root = root;
    this.state = loadState();
    this.playerBuild = calculateBuild(this.state.build);
    this.selectedArena = getArena(this.state.arenaId);
    this.activeSlot = "attackRing";
    this.screen = "assembly";
    this.audio = new AudioEngine();
    this.audio.setEnabled(this.state.sound);
    this.simulation = null;
    this.paused = false;
    this.resultHandled = false;
    this.control = { x: 0, y: 0 };
    this.keys = new Set();
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.lastHudUpdate = 0;

    this._mount();
    this.stage = new ThreeStage(this.root.querySelector("#three-stage"));
    this._bindEvents();
    this._renderAssembly();
    this._renderMaps();
    this._renderPersistentState();
    this.stage.showAssembly(
      this.state.build,
      this.state.colors,
      this.activeSlot,
    );
    requestAnimationFrame((time) => this._tick(time));
  }

  _mount() {
    this.root.innerHTML = `
      <div class="game-shell" data-screen="assembly" data-arena="${this.state.arenaId}">
        <header class="topbar">
          <button class="brand" data-go="assembly" aria-label="返回组装">
            <span class="brand-mark">S/C</span>
            <span><b>SPIN/CORE</b><small>PHYSICS LAB</small></span>
          </button>
          <nav class="phase-nav" aria-label="游戏进度">
            <button class="phase is-active" data-go="assembly"><i></i><span>组装</span></button>
            <button class="phase" data-go="map"><i></i><span>场地</span></button>
            <button class="phase" data-phase-only="battle"><i></i><span>对战</span></button>
          </nav>
          <div class="top-actions">
            <span class="wallet"><small>赏金</small><b id="coin-count">0</b></span>
            <button class="icon-button" id="sound-toggle" aria-label="切换声音">声</button>
          </div>
        </header>

        <main class="stage-shell">
          <div id="three-stage" aria-label="Three.js 三维预览"></div>
          <div class="stage-vignette"></div>
          <div class="stage-caption">
            <span id="stage-kicker">ASSEMBLY / 01</span>
            <strong id="stage-title">五层结构实验</strong>
          </div>
          <div class="drag-hint" id="drag-hint"><i></i>拖动旋转模型</div>

          <div class="battle-hud is-hidden" id="battle-hud">
            <div class="fighter-card player-card">
              <div class="fighter-head"><span>YOU</span><b id="player-spin">0</b></div>
              <div class="meter durability"><i id="player-durability-bar"></i></div>
              <small id="player-status">待发射</small>
            </div>
            <div class="battle-clock"><small>ROUND 01</small><b id="battle-time">00.0</b></div>
            <div class="fighter-card enemy-card">
              <div class="fighter-head"><b id="enemy-spin">0</b><span>AI</span></div>
              <div class="meter durability"><i id="enemy-durability-bar"></i></div>
              <small id="enemy-status">待发射</small>
            </div>
            <div class="surface-chip" id="surface-chip">标准地面</div>
            <div class="control-feedback" id="control-feedback">
              <i id="control-arrow">↑</i>
              <span><small>操控影响</small><b id="control-power">0%</b></span>
              <em id="control-state">拖动摇杆决定偏转方向</em>
            </div>
          </div>

          <button class="tune-button is-hidden" id="tune-open">调参</button>
          <div class="result-card is-hidden" id="result-card">
            <span id="result-kicker">BATTLE COMPLETE</span>
            <h2 id="result-title">对战结束</h2>
            <p id="result-copy"></p>
            <div class="result-actions">
              <button class="button ghost" id="result-assembly">返回改装</button>
              <button class="button primary" id="result-restart">再次对战</button>
            </div>
          </div>
        </main>

        <section class="workspace">
          <div class="screen-panel" data-panel="assembly">
            <div class="part-rail" id="part-rail"></div>
            <div class="part-heading">
              <div>
                <span id="active-part-index">01 / 05</span>
                <h1 id="active-part-name">攻击环</h1>
                <p id="active-part-description"></p>
              </div>
              <div class="color-pair">
                <label title="攻击环颜色"><input id="ring-color" type="color"><i></i></label>
                <label title="核心颜色"><input id="core-color" type="color"><i></i></label>
              </div>
            </div>
            <div class="variant-list" id="variant-list"></div>
            <div class="metric-panel">
              <div class="metric-head">
                <span>实时性能谱</span>
                <b id="build-mass">1.22 kg</b>
              </div>
              <div class="metric-grid" id="metric-grid"></div>
            </div>
            <div class="action-row">
              <button class="button ghost" id="random-build">随机配置</button>
              <button class="button primary" id="go-map">选择竞技场 <span>→</span></button>
            </div>
          </div>

          <div class="screen-panel is-hidden" data-panel="map">
            <div class="section-heading">
              <span>ARENA SELECT / 02</span>
              <h1>竞技场物理</h1>
              <p>场地材质会改变摩擦、续航、回弹、操控和碰撞伤害。</p>
            </div>
            <div class="arena-list" id="arena-list"></div>
            <div class="action-row">
              <button class="button ghost" data-go="assembly">返回组装</button>
              <button class="button primary" id="start-battle">进入发射台 <span>→</span></button>
            </div>
          </div>

          <div class="screen-panel is-hidden" data-panel="battle">
            <div class="launch-controls" id="launch-controls">
              <div class="section-heading compact">
                <span>LAUNCH CONTROL / 03</span>
                <h1>设定发射</h1>
              </div>
              <div class="launch-grid">
                <label>
                  <span>拉绳力度 <output id="launch-power-output">86%</output></span>
                  <input id="launch-power" type="range" min="35" max="100" value="86">
                </label>
                <label>
                  <span>发射方向 <output id="launch-direction-output">0°</output></span>
                  <input id="launch-direction" type="range" min="-30" max="30" value="0">
                </label>
                <label>
                  <span>入场倾角 <output id="launch-angle-output">0°</output></span>
                  <input id="launch-angle" type="range" min="-12" max="12" value="0">
                </label>
              </div>
              <button class="launch-button" id="launch-button">
                <span>按下发射</span><i></i>
              </button>
            </div>

            <div class="battle-controls is-hidden" id="battle-controls">
              <div class="joystick-wrap">
                <div class="joystick" id="joystick">
                  <i class="joystick-axis axis-x"></i>
                  <i class="joystick-axis axis-y"></i>
                  <b id="joystick-knob"></b>
                </div>
                <p>拖动微调 · WASD / 方向键</p>
              </div>
              <div class="battle-actions">
                <div class="battle-message">
                  <span id="battle-message-kicker">LIVE PHYSICS</span>
                  <b id="battle-message">正在计算碰撞与转速</b>
                </div>
                <button class="button ghost" id="pause-battle">暂停</button>
                <button class="button ghost" id="reset-battle">重置</button>
              </div>
            </div>
          </div>
        </section>

        <aside class="tuning-drawer" id="tuning-drawer" aria-hidden="true">
          <div class="drawer-head">
            <div><span>LIVE TUNING</span><h2>实时调参</h2></div>
            <button class="icon-button" id="tune-close" aria-label="关闭调参">×</button>
          </div>
          <p>参数立即作用于当前回合，并保存在本机。</p>
          <div class="tuning-list">
            ${this._tuningControl("damageScale", "碰撞伤害", 50, 180)}
            ${this._tuningControl("spinScale", "转速衰减", 60, 160)}
            ${this._tuningControl("controlScale", "控制响应", 50, 180)}
            ${this._tuningControl("speedScale", "移动速度", 70, 140)}
          </div>
          <button class="button ghost full" id="reset-tuning">恢复基准参数</button>
        </aside>
        <div class="drawer-scrim" id="drawer-scrim"></div>
      </div>
    `;
  }

  _tuningControl(key, label, min, max) {
    const value = Math.round(this.state.tuning[key] * 100);
    return `
      <label>
        <span>${label}<output data-tuning-output="${key}">${value}%</output></span>
        <input data-tuning="${key}" type="range" min="${min}" max="${max}" value="${value}">
      </label>
    `;
  }

  _bindEvents() {
    this.root.addEventListener("click", (event) => {
      const goTarget = event.target.closest("[data-go]")?.dataset.go;
      if (goTarget) this.goTo(goTarget);
    });
    this.root.querySelector("#part-rail").addEventListener("click", (event) => {
      const button = event.target.closest("[data-slot]");
      if (!button) return;
      this.activeSlot = button.dataset.slot;
      this._renderAssembly();
      this.stage.setAssemblyActive(this.activeSlot);
      this.audio.playUi();
    });
    this.root
      .querySelector("#variant-list")
      .addEventListener("click", (event) => {
        const button = event.target.closest("[data-part-id]");
        if (!button) return;
        this.state.build[this.activeSlot] = button.dataset.partId;
        this._commitBuild();
      });
    this.root.querySelector("#random-build").addEventListener("click", () => {
      for (const slot of SLOT_ORDER) {
        const variants = getPartsByType(slot);
        this.state.build[slot] =
          variants[Math.floor(Math.random() * variants.length)].id;
      }
      this._commitBuild();
    });
    this.root.querySelector("#go-map").addEventListener("click", () => {
      this.goTo("map");
    });
    this.root.querySelector("#arena-list").addEventListener("click", (event) => {
      const card = event.target.closest("[data-arena]");
      if (!card) return;
      this.selectedArena = getArena(card.dataset.arena);
      this.state.arenaId = this.selectedArena.id;
      this._save();
      this._renderMaps();
      this.stage.showArena(this.selectedArena);
      this.audio.playUi();
    });
    this.root.querySelector("#start-battle").addEventListener("click", () => {
      this.goTo("battle");
    });

    for (const colorKey of ["ring", "core"]) {
      const input = this.root.querySelector(`#${colorKey}-color`);
      input.addEventListener("input", () => {
        this.state.colors[colorKey] = input.value;
        this._save();
        this.stage.showAssembly(
          this.state.build,
          this.state.colors,
          this.activeSlot,
        );
      });
    }
    for (const key of ["power", "direction", "angle"]) {
      const input = this.root.querySelector(`#launch-${key}`);
      input.addEventListener("input", () => this._updateLaunchOutputs());
    }
    this.root
      .querySelector("#launch-button")
      .addEventListener("click", () => this._launch());
    this.root
      .querySelector("#pause-battle")
      .addEventListener("click", () => this._togglePause());
    this.root
      .querySelector("#reset-battle")
      .addEventListener("click", () => this._prepareBattle());
    this.root
      .querySelector("#result-restart")
      .addEventListener("click", () => this._prepareBattle());
    this.root
      .querySelector("#result-assembly")
      .addEventListener("click", () => this.goTo("assembly"));

    this.root
      .querySelector("#sound-toggle")
      .addEventListener("click", async () => {
        if (!this.audio.ready) await this.audio.init();
        this.state.sound = !this.state.sound;
        this.audio.setEnabled(this.state.sound);
        this._save();
        this._renderPersistentState();
        this.audio.playUi();
      });
    this.root.querySelector("#tune-open").addEventListener("click", () => {
      this._setTuningDrawer(true);
    });
    this.root.querySelector("#tune-close").addEventListener("click", () => {
      this._setTuningDrawer(false);
    });
    this.root.querySelector("#drawer-scrim").addEventListener("click", () => {
      this._setTuningDrawer(false);
    });
    this.root.querySelectorAll("[data-tuning]").forEach((input) => {
      input.addEventListener("input", () => {
        const key = input.dataset.tuning;
        this.state.tuning[key] = Number(input.value) / 100;
        this.root.querySelector(
          `[data-tuning-output="${key}"]`,
        ).value = `${input.value}%`;
        this.simulation?.setTuning(this.state.tuning);
        this._save();
      });
    });
    this.root.querySelector("#reset-tuning").addEventListener("click", () => {
      this.state.tuning = {
        damageScale: 1,
        spinScale: 1,
        controlScale: 1,
        speedScale: 1,
      };
      this.root.querySelectorAll("[data-tuning]").forEach((input) => {
        input.value = 100;
        this.root.querySelector(
          `[data-tuning-output="${input.dataset.tuning}"]`,
        ).value = "100%";
      });
      this.simulation?.setTuning(this.state.tuning);
      this._save();
    });

    this._bindJoystick();
    window.addEventListener("keydown", (event) => {
      this.keys.add(event.key.toLowerCase());
      if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(
        event.key.toLowerCase(),
      )) {
        event.preventDefault();
      }
    });
    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.key.toLowerCase());
    });
  }

  _bindJoystick() {
    const joystick = this.root.querySelector("#joystick");
    const knob = this.root.querySelector("#joystick-knob");
    const update = (event) => {
      const bounds = joystick.getBoundingClientRect();
      const radius = bounds.width * 0.34;
      const rawX = event.clientX - (bounds.left + bounds.width * 0.5);
      const rawY = event.clientY - (bounds.top + bounds.height * 0.5);
      const magnitude = Math.hypot(rawX, rawY);
      const scale = magnitude > radius ? radius / magnitude : 1;
      const x = (rawX * scale) / radius;
      const y = (rawY * scale) / radius;
      this.control = { x, y };
      knob.style.transform = `translate(calc(-50% + ${x * radius}px), calc(-50% + ${y * radius}px))`;
    };
    const reset = () => {
      this.control = { x: 0, y: 0 };
      knob.style.transform = "translate(-50%, -50%)";
    };
    joystick.addEventListener("pointerdown", (event) => {
      joystick.setPointerCapture(event.pointerId);
      update(event);
    });
    joystick.addEventListener("pointermove", (event) => {
      if (joystick.hasPointerCapture(event.pointerId)) update(event);
    });
    joystick.addEventListener("pointerup", (event) => {
      joystick.releasePointerCapture(event.pointerId);
      reset();
    });
    joystick.addEventListener("pointercancel", reset);
  }

  _renderAssembly() {
    const meta = PART_TYPE_META[this.activeSlot];
    const activePart = getPart(this.state.build[this.activeSlot]);
    this.root.querySelector("#part-rail").innerHTML = SLOT_ORDER.map((slot) => {
      const item = PART_TYPE_META[slot];
      return `
        <button class="${slot === this.activeSlot ? "is-active" : ""}" data-slot="${slot}">
          <span>${item.index}</span><b>${item.name}</b>
        </button>
      `;
    }).join("");
    this.root.querySelector("#active-part-index").textContent =
      `${meta.index} / 05 · ${activePart.id}`;
    this.root.querySelector("#active-part-name").textContent = meta.name;
    this.root.querySelector("#active-part-description").textContent =
      meta.description;
    this.root.querySelector("#variant-list").innerHTML = getPartsByType(
      this.activeSlot,
    )
      .map(
        (part, index) => `
          <button class="variant ${part.id === activePart.id ? "is-active" : ""}" data-part-id="${part.id}">
            <span>V${index + 1}</span>
            <b>${part.name}</b>
            <small>${part.description}</small>
          </button>
        `,
      )
      .join("");

    const ratings = getBuildRatings(this.playerBuild);
    this.root.querySelector("#metric-grid").innerHTML = Object.entries(ratings)
      .map(
        ([label, value]) => `
          <div class="metric">
            <span>${label}<b>${Math.round(value)}</b></span>
            <i><em style="width:${value}%"></em></i>
          </div>
        `,
      )
      .join("");
    this.root.querySelector("#build-mass").textContent =
      `${this.playerBuild.totalMass.toFixed(2)} kg · ${this.playerBuild.maxSpinSpeed.toFixed(0)} rad/s`;
    this.root.querySelector("#ring-color").value = this.state.colors.ring;
    this.root.querySelector("#core-color").value = this.state.colors.core;
  }

  _renderMaps() {
    this.root.querySelector("#arena-list").innerHTML = ARENA_LIST.map(
      (arena) => `
        <button class="arena-card ${arena.id === this.selectedArena.id ? "is-active" : ""}" data-arena="${arena.id}" style="--arena-accent:${arena.accent}">
          <span class="arena-number">${arena.number}</span>
          <span class="arena-copy">
            <small>${arena.tag} · ${arena.surfaceAt(0).name}</small>
            <b>${arena.name}</b>
            <em>${arena.description}</em>
          </span>
          <i></i>
        </button>
      `,
    ).join("");
  }

  _renderPersistentState() {
    this.root.querySelector("#coin-count").textContent = String(
      this.state.coins,
    ).padStart(4, "0");
    const soundButton = this.root.querySelector("#sound-toggle");
    soundButton.classList.toggle("is-off", !this.state.sound);
    soundButton.textContent = this.state.sound ? "声" : "静";
  }

  _commitBuild() {
    this.playerBuild = calculateBuild(this.state.build);
    this._save();
    this._renderAssembly();
    this.stage.showAssembly(
      this.state.build,
      this.state.colors,
      this.activeSlot,
    );
    this.audio.playUi();
  }

  goTo(screen) {
    if (screen === "map") {
      this._renderMaps();
      this.stage.showArena(this.selectedArena);
    } else if (screen === "assembly") {
      this.simulation = null;
      this.stage.showAssembly(
        this.state.build,
        this.state.colors,
        this.activeSlot,
      );
    } else if (screen === "battle") {
      this._prepareBattle();
    }
    this.screen = screen;
    const shell = this.root.querySelector(".game-shell");
    shell.dataset.screen = screen;
    shell.dataset.arena = this.selectedArena.id;
    if (screen !== "battle") {
      this.root.querySelector("#result-card").classList.add("is-hidden");
      this.resultHandled = false;
    }
    this.root.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.classList.toggle("is-hidden", panel.dataset.panel !== screen);
    });
    this.root.querySelector(".workspace").scrollTo({ top: 0, left: 0 });
    this.root.querySelector(".game-shell").scrollLeft = 0;
    this.root.querySelectorAll(".phase").forEach((phase) => {
      phase.classList.toggle("is-active", phase.dataset.go === screen);
      if (screen === "battle" && phase.dataset.phaseOnly === "battle") {
        phase.classList.add("is-active");
      }
    });
    this.root
      .querySelector("#drag-hint")
      .classList.toggle("is-hidden", screen !== "assembly");
    this.root
      .querySelector("#battle-hud")
      .classList.toggle("is-hidden", screen !== "battle");
    this.root
      .querySelector("#tune-open")
      .classList.toggle("is-hidden", screen !== "battle");
    const caption = {
      assembly: ["ASSEMBLY / 01", "五层结构实验"],
      map: ["ARENA / 02", this.selectedArena.shortName],
      battle: ["BATTLE / 03", this.selectedArena.shortName],
    }[screen];
    this.root.querySelector("#stage-kicker").textContent = caption[0];
    this.root.querySelector("#stage-title").textContent = caption[1];
    this.audio.playUi();
  }

  _prepareBattle() {
    const enemySelection = ENEMY_BUILDS[this.selectedArena.id];
    const enemyBuild = calculateBuild(enemySelection);
    this.simulation = new BattleSimulation({
      playerBuild: this.playerBuild,
      enemyBuild,
      arena: this.selectedArena,
      seed: 20260718,
      tuning: this.state.tuning,
    });
    this.stage.prepareBattle(
      this.selectedArena,
      this.state.build,
      enemySelection,
      this.state.colors,
    );
    this.paused = false;
    this.resultHandled = false;
    this.control = { x: 0, y: 0 };
    this.accumulator = 0;
    this.root.querySelector("#launch-controls").classList.remove("is-hidden");
    this.root.querySelector("#battle-controls").classList.add("is-hidden");
    this.root.querySelector("#result-card").classList.add("is-hidden");
    this.root.querySelector("#pause-battle").textContent = "暂停";
    this.root.querySelector("#battle-message").textContent = "等待发射参数";
    this._updateHud();
  }

  async _launch() {
    await this.audio.init();
    this.audio.setEnabled(this.state.sound);
    const power = Number(this.root.querySelector("#launch-power").value) / 100;
    const direction =
      (Number(this.root.querySelector("#launch-direction").value) * Math.PI) /
      180;
    const angle = Number(this.root.querySelector("#launch-angle").value) / 12;
    this.simulation.launch({ power, direction, angle });
    this.audio.playLaunch(power);
    this.root.querySelector("#launch-controls").classList.add("is-hidden");
    this.root.querySelector("#battle-controls").classList.remove("is-hidden");
    this.root.querySelector("#battle-message").textContent =
      "拖动摇杆微调轨迹";
  }

  _togglePause() {
    if (!this.simulation || this.simulation.phase !== "running") return;
    this.paused = !this.paused;
    this.root.querySelector("#pause-battle").textContent = this.paused
      ? "继续"
      : "暂停";
    this.root.querySelector("#battle-message").textContent = this.paused
      ? "模拟已暂停"
      : "正在计算碰撞与转速";
  }

  _updateLaunchOutputs() {
    for (const key of ["power", "direction", "angle"]) {
      const value = this.root.querySelector(`#launch-${key}`).value;
      this.root.querySelector(`#launch-${key}-output`).value =
        key === "power" ? `${value}%` : `${value}°`;
    }
  }

  _keyboardControl() {
    let x = 0;
    let y = 0;
    if (this.keys.has("a") || this.keys.has("arrowleft")) x -= 1;
    if (this.keys.has("d") || this.keys.has("arrowright")) x += 1;
    if (this.keys.has("w") || this.keys.has("arrowup")) y -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) y += 1;
    if (x === 0 && y === 0) return this.control;
    const magnitude = Math.hypot(x, y);
    return { x: x / magnitude, y: y / magnitude };
  }

  _processEvents() {
    for (const event of this.simulation.events) {
      if (event.type === "collision") {
        this.stage.spawnImpact(event.position, event.intensity);
        this.audio.playCollision(event.intensity);
        this.root.querySelector("#battle-message-kicker").textContent =
          event.intensity > 0.58 ? "HEAVY IMPACT" : "CONTACT";
        this.root.querySelector("#battle-message").textContent =
          `碰撞冲量 ${event.impulse.toFixed(2)}`;
      }
      if (event.type === "result") this._handleResult();
    }
  }

  _handleResult() {
    if (this.resultHandled || !this.simulation.result) return;
    this.resultHandled = true;
    const { winner, reason, time } = this.simulation.result;
    const won = winner === "player";
    if (won) {
      this.state.coins += 120;
      this._save();
      this._renderPersistentState();
    }
    this.audio.playResult(won, reason);
    this.root.querySelector("#result-kicker").textContent = won
      ? "BATTLE COMPLETE · +120"
      : "BATTLE COMPLETE";
    this.root.querySelector("#result-title").textContent = won
      ? RESULT_LABELS[reason]
      : "本回合失败";
    this.root.querySelector("#result-copy").textContent =
      `${time.toFixed(1)} 秒 · ${won ? "你的配置完成了验证。" : `对手通过${RESULT_LABELS[reason]}结束回合。`}`;
    this.root.querySelector("#result-card").classList.remove("is-hidden");
  }

  _updateHud() {
    if (!this.simulation) return;
    const { player, enemy, time } = this.simulation;
    this.root.querySelector("#player-spin").textContent =
      `${Math.round(player.spin)} RPM`;
    this.root.querySelector("#enemy-spin").textContent =
      `${Math.round(enemy.spin)} RPM`;
    this.root.querySelector("#player-durability-bar").style.width =
      `${(player.durability / player.build.durability) * 100}%`;
    this.root.querySelector("#enemy-durability-bar").style.width =
      `${(enemy.durability / enemy.build.durability) * 100}%`;
    this.root.querySelector("#player-status").textContent =
      `${Math.ceil(player.durability)} DUR · ${player.surfaceName || "待机"}`;
    this.root.querySelector("#enemy-status").textContent =
      `${Math.ceil(enemy.durability)} DUR · ${enemy.surfaceName || "待机"}`;
    this.root.querySelector("#battle-time").textContent = time.toFixed(1);
    this.root.querySelector("#surface-chip").textContent =
      player.surfaceName || this.selectedArena.surfaceAt(0).name;
    const control = player.controlInput ?? { x: 0, y: 0 };
    const controlAngle = (Math.atan2(control.y, control.x) * 180) / Math.PI + 90;
    const influence = Math.round((player.controlInfluence ?? 0) * 100);
    const controlArrow = this.root.querySelector("#control-arrow");
    controlArrow.style.transform = `rotate(${controlAngle}deg)`;
    controlArrow.classList.toggle(
      "is-idle",
      Math.hypot(control.x, control.y) < 0.05,
    );
    this.root.querySelector("#control-power").textContent = `${influence}%`;
    const spinRatio = player.spin / Math.max(player.build.maxSpinSpeed, 0.001);
    this.root.querySelector("#control-state").textContent =
      this.simulation.phase !== "running"
        ? "发射后显示实时施力方向"
        : spinRatio < 0.18
        ? "低转速：推力和移动距离显著衰减"
        : influence > 0
          ? "箭头方向即当前施力方向"
          : "拖动摇杆决定偏转方向";
  }

  _setTuningDrawer(open) {
    const drawer = this.root.querySelector("#tuning-drawer");
    drawer.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", String(!open));
    this.root.querySelector("#drawer-scrim").classList.toggle("is-open", open);
    this.root.querySelector(".game-shell").scrollLeft = 0;
  }

  _tick(time) {
    const delta = clamp((time - this.lastTime) / 1000, 0, 0.05);
    this.lastTime = time;
    if (
      this.simulation?.phase === "running" &&
      !this.paused &&
      this.screen === "battle"
    ) {
      this.accumulator += delta;
      while (this.accumulator >= FIXED_STEP) {
        this.simulation.step(FIXED_STEP, this._keyboardControl());
        this._processEvents();
        this.accumulator -= FIXED_STEP;
      }
    }
    if (time - this.lastHudUpdate > 66) {
      this._updateHud();
      this.lastHudUpdate = time;
    }
    this.audio.update(
      this.simulation?.player.spin ?? 0,
      this.simulation?.enemy.spin ?? 0,
      this.simulation?.phase === "running" && !this.paused,
    );
    this.stage.update(delta, this.simulation);
    requestAnimationFrame((nextTime) => this._tick(nextTime));
  }

  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }
}

new BeybladeApp(document.querySelector("#app"));
