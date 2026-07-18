import "./styles.css";
import { AudioEngine } from "./audio/audio-engine.js";
import { calculateBuild, getBuildRatings } from "./core/assembly-calculator.js";
import {
  BattleSimulation,
  BATTLE_RESULT,
} from "./core/battle-simulation.js";
import { migrateLoadouts } from "./core/loadouts.js";
import {
  getBattleReward,
  getPartAccess,
  migrateProgression,
  purchasePart,
  TUTORIAL_STAGE,
} from "./core/progression.js";
import { ARENA_LIST, getArena } from "./data/arenas.js";
import {
  DEFAULT_BUILD,
  getPart,
  getPartsByType,
  PART_TYPE_META,
} from "./data/parts.js";
import { ThreeStage } from "./render/three-stage.js";

const STORAGE_KEY = "spin-core-web-prototype-v2";
const LEGACY_STORAGE_KEY = "spin-core-web-prototype-v1";
const FIXED_STEP = 1 / 60;
const RESULT_LABELS = {
  [BATTLE_RESULT.SPIN_OUT]: "停转胜利",
  [BATTLE_RESULT.RING_OUT]: "撞飞胜利",
  [BATTLE_RESULT.BREAK]: "击破胜利",
  [BATTLE_RESULT.TIME]: "计时判定",
};
const TRAINING_COLORS = Object.freeze({
  ring: "#9b693f",
  core: "#d0a36a",
  finish: "wood",
});
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
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ??
        localStorage.getItem(LEGACY_STORAGE_KEY) ??
        "null",
    );
    const progression = migrateProgression(saved ?? {});
    const loadoutState = migrateLoadouts(saved ?? {});
    const activeLoadout =
      loadoutState.loadouts[loadoutState.activeLoadoutIndex];
    return {
      ...fallback,
      ...saved,
      ...progression,
      ...loadoutState,
      build: activeLoadout.build,
      colors: activeLoadout.colors,
      tuning: { ...fallback.tuning, ...saved?.tuning },
    };
  } catch {
    const loadoutState = migrateLoadouts();
    return {
      ...fallback,
      ...migrateProgression(),
      ...loadoutState,
      build: loadoutState.loadouts[0].build,
      colors: loadoutState.loadouts[0].colors,
    };
  }
}

class BeybladeApp {
  constructor(root) {
    this.root = root;
    this.state = loadState();
    this.playerBuild = calculateBuild(this.state.build);
    this.selectedArena = getArena(this.state.arenaId);
    this.activeSlot = null;
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
    if (this.state.tutorial.stage === TUTORIAL_STAGE.FIRST_BATTLE) {
      this.goTo("battle");
    } else {
      this.goTo("assembly");
    }
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
          </div>

          <div class="launch-controls is-hidden" id="launch-controls">
            <div class="launcher-heading">
              <span>LAUNCHER / 03</span>
              <b>调整发射器姿态</b>
            </div>
            <div class="launcher-dials">
              <label class="launcher-dial dial-height">
                <span>高度 <output id="launch-height-output">45%</output></span>
                <input id="launch-height" type="range" min="0" max="100" value="45">
              </label>
              <label class="launcher-dial dial-direction">
                <span>方向 <output id="launch-direction-output">0°</output></span>
                <input id="launch-direction" type="range" min="-30" max="30" value="0">
              </label>
              <label class="launcher-dial dial-angle">
                <span>倾角 <output id="launch-angle-output">0°</output></span>
                <input id="launch-angle" type="range" min="-12" max="12" value="0">
              </label>
            </div>
            <button class="launch-button" id="launch-button">
              <span>拉动发射</span><i></i>
            </button>
          </div>

          <div class="battle-controls is-hidden" id="battle-controls">
            <div class="joystick" id="joystick" aria-label="战斗方向控制">
              <i class="joystick-axis axis-x"></i>
              <i class="joystick-axis axis-y"></i>
              <b id="joystick-knob"><span id="joystick-power">0</span></b>
            </div>
          </div>
          <div class="battle-utility is-hidden" id="battle-utility">
            <button id="pause-battle">暂停</button>
            <button id="reset-battle">重置</button>
          </div>
          <div class="sr-only" aria-live="polite">
            <span id="battle-message-kicker">LIVE PHYSICS</span>
            <b id="battle-message">正在计算碰撞与转速</b>
            <span id="control-state"></span>
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
          <div class="toast is-hidden" id="toast" role="status" aria-live="polite"></div>
        </main>

        <section class="workspace">
          <div class="screen-panel" data-panel="assembly">
            <div class="loadout-status">
              <button id="previous-loadout" aria-label="上一个陀螺">‹</button>
              <div>
                <span id="loadout-index">01 / 03</span>
                <b id="loadout-name">主力</b>
              </div>
              <button id="next-loadout" aria-label="下一个陀螺">›</button>
            </div>
            <div class="loadout-dots" id="loadout-dots"></div>
            <div class="assembly-customizer is-hidden" id="assembly-customizer">
              <div class="part-heading">
                <div>
                  <span id="active-part-index"></span>
                  <h1 id="active-part-name"></h1>
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
            </div>
            <div class="assembly-view-tools">
              <button class="view-reset is-hidden" id="view-reset">重置视角</button>
              <div class="drag-hint" id="drag-hint">
                <i></i>
                <span>拖动环绕 · 轻点部件改装 · 横扫切换陀螺</span>
              </div>
            </div>
            <div class="action-row">
              <button class="button primary" id="go-map">选择竞技场 <span>→</span></button>
            </div>
          </div>

          <div class="screen-panel is-hidden" data-panel="map">
            <div class="arena-list" id="arena-list" aria-label="左右滑动选择竞技场"></div>
            <div class="action-row">
              <button class="button primary" id="start-battle">准备发射 <span>→</span></button>
            </div>
          </div>

          <div class="screen-panel is-hidden" data-panel="battle"></div>
        </section>

        <aside class="tutorial-card is-hidden" id="tutorial-card" aria-live="polite">
          <div class="tutorial-head">
            <span id="tutorial-progress">新手训练 · 1/3</span>
            <button id="tutorial-skip">跳过引导</button>
          </div>
          <h2 id="tutorial-title">先把它转起来</h2>
          <p id="tutorial-copy"></p>
          <button class="tutorial-action is-hidden" id="tutorial-action"></button>
        </aside>

        <div class="purchase-layer is-hidden" id="purchase-layer">
          <button class="purchase-scrim" id="purchase-cancel-scrim" aria-label="取消购买"></button>
          <section class="purchase-card" role="dialog" aria-modal="true" aria-labelledby="purchase-title">
            <span>PART UNLOCK</span>
            <h2 id="purchase-title">解锁零件</h2>
            <p id="purchase-description"></p>
            <div class="purchase-deltas" id="purchase-deltas"></div>
            <div class="purchase-balance">
              <span>解锁后余额</span>
              <b id="purchase-balance">0000</b>
            </div>
            <div class="purchase-actions">
              <button class="button ghost" id="purchase-cancel">取消</button>
              <button class="button primary" id="purchase-confirm">解锁并装备</button>
            </div>
          </section>
        </div>

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
      if (!goTarget) return;
      if (!this._canNavigateTo(goTarget)) {
        this._showToast("先完成当前训练步骤，或点击“跳过引导”");
        return;
      }
      this.goTo(goTarget);
    });
    this.root
      .querySelector("#tutorial-skip")
      .addEventListener("click", () => this._skipTutorial());
    this.root
      .querySelector("#tutorial-action")
      .addEventListener("click", () => {
        if (this.state.tutorial.stage === TUTORIAL_STAGE.SECOND_BATTLE) {
          this.goTo("battle");
        }
      });
    this.root.querySelector("#three-stage").addEventListener(
      "partselect",
      (event) => {
        if (!PART_TYPE_META[event.detail.slot]) return;
        this.activeSlot = event.detail.slot;
        this._renderAssembly();
        this.stage.setAssemblyActive(this.activeSlot);
        this.audio.playUi();
      },
    );
    this.root
      .querySelector("#three-stage")
      .addEventListener("assemblyclear", () => {
        if (!this.activeSlot) return;
        this.activeSlot = null;
        this._renderAssembly();
        this.stage.setAssemblyActive(null);
      });
    this.root.querySelector("#three-stage").addEventListener(
      "topswipe",
      (event) => {
        this._switchLoadout(event.detail.direction);
      },
    );
    this.root
      .querySelector("#previous-loadout")
      .addEventListener("click", () => this._switchLoadout("previous"));
    this.root
      .querySelector("#next-loadout")
      .addEventListener("click", () => this._switchLoadout("next"));
    this.root.querySelector("#view-reset").addEventListener("click", () => {
      this.stage.resetAssemblyView();
      this.audio.playUi();
    });
    this.root
      .querySelector("#variant-list")
      .addEventListener("click", (event) => {
        const button = event.target.closest("[data-part-id]");
        if (!button) return;
        const part = getPart(button.dataset.partId);
        const access = getPartAccess(part, this.state);
        if (access.owned) {
          this.state.build[this.activeSlot] = part.id;
          this._commitBuild();
          return;
        }
        if (!access.affordable) {
          this._showToast(`金币不足，还差 ${access.missingCoins} 枚`);
          navigator.vibrate?.(18);
          return;
        }
        this._openPurchase(part);
      });
    this.root.querySelector("#purchase-confirm").addEventListener(
      "click",
      () => this._confirmPurchase(),
    );
    for (const id of ["purchase-cancel", "purchase-cancel-scrim"]) {
      this.root
        .querySelector(`#${id}`)
        .addEventListener("click", () => this._setPurchaseDialog(false));
    }
    this.root.querySelector("#go-map").addEventListener("click", () => {
      this.goTo("map");
    });
    const arenaList = this.root.querySelector("#arena-list");
    arenaList.addEventListener("click", (event) => {
      const card = event.target.closest("[data-arena]");
      if (!card) return;
      card.scrollIntoView({ behavior: "smooth", inline: "center" });
      this._selectArena(card.dataset.arena);
    });
    arenaList.addEventListener("scroll", () => {
      window.cancelAnimationFrame(this.arenaScrollFrame);
      this.arenaScrollFrame = window.requestAnimationFrame(() => {
        const bounds = arenaList.getBoundingClientRect();
        const center = bounds.left + bounds.width * 0.5;
        const cards = [...arenaList.querySelectorAll("[data-arena]")];
        const closest = cards.reduce((best, card) => {
          const cardBounds = card.getBoundingClientRect();
          const distance = Math.abs(
            cardBounds.left + cardBounds.width * 0.5 - center,
          );
          return !best || distance < best.distance
            ? { card, distance }
            : best;
        }, null);
        if (closest) this._selectArena(closest.card.dataset.arena);
      });
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
          this.state.loadouts,
          this.state.activeLoadoutIndex,
          this.activeSlot,
        );
      });
    }
    for (const key of ["height", "direction", "angle"]) {
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
      if (event.key === "Escape" && this.pendingPurchaseId) {
        this._setPurchaseDialog(false);
        return;
      }
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
      this.root.querySelector("#joystick-power").textContent = String(
        Math.round(Math.min(magnitude / radius, 1) * 100),
      );
      knob.style.transform = `translate(calc(-50% + ${x * radius}px), calc(-50% + ${y * radius}px))`;
    };
    const reset = () => {
      this.control = { x: 0, y: 0 };
      knob.style.transform = "translate(-50%, -50%)";
      this.root.querySelector("#joystick-power").textContent = "0";
    };
    joystick.addEventListener("pointerdown", (event) => {
      this.joystickActive = true;
      joystick.classList.add("is-active");
      joystick.setPointerCapture(event.pointerId);
      update(event);
    });
    joystick.addEventListener("pointermove", (event) => {
      if (joystick.hasPointerCapture(event.pointerId)) update(event);
    });
    joystick.addEventListener("pointerup", (event) => {
      joystick.releasePointerCapture(event.pointerId);
      this.joystickActive = false;
      joystick.classList.remove("is-active");
      reset();
    });
    joystick.addEventListener("pointercancel", () => {
      this.joystickActive = false;
      joystick.classList.remove("is-active");
      reset();
    });
  }

  _renderAssembly() {
    const loadout = this.state.loadouts[this.state.activeLoadoutIndex];
    this.root.querySelector("#loadout-index").textContent =
      `${String(this.state.activeLoadoutIndex + 1).padStart(2, "0")} / ${String(this.state.loadouts.length).padStart(2, "0")}`;
    this.root.querySelector("#loadout-name").textContent = loadout.name;
    this.root.querySelector("#loadout-dots").innerHTML = this.state.loadouts
      .map(
        (_, index) =>
          `<i class="${index === this.state.activeLoadoutIndex ? "is-active" : ""}"></i>`,
      )
      .join("");
    const customizer = this.root.querySelector("#assembly-customizer");
    customizer.classList.toggle("is-hidden", !this.activeSlot);
    if (!this.activeSlot) return;

    const meta = PART_TYPE_META[this.activeSlot];
    const activePart = getPart(this.state.build[this.activeSlot]);
    this.root.querySelector("#active-part-index").textContent =
      `${meta.index} / 05 · ${activePart.id}`;
    this.root.querySelector("#active-part-name").textContent = meta.name;
    this.root.querySelector("#active-part-description").textContent =
      meta.description;
    this.root.querySelector("#variant-list").innerHTML = getPartsByType(
      this.activeSlot,
    )
      .map((part, index) => {
        const access = getPartAccess(part, this.state);
        const stateClass = access.owned
          ? "is-owned"
          : access.affordable
            ? "is-affordable"
            : "is-locked";
        const priceLabel = access.owned
          ? part.id === activePart.id
            ? "已装备"
            : "已拥有"
          : String(part.price);
        return `
          <button
            class="variant ${stateClass} ${part.id === activePart.id ? "is-active" : ""}"
            data-part-id="${part.id}"
            aria-label="${part.name}，${access.owned ? priceLabel : access.affordable ? `可用 ${part.price} 金币解锁` : `未解锁，还差 ${access.missingCoins} 金币`}"
          >
            <span>V${index + 1}</span>
            <b>${part.name}</b>
            <small>${part.description}</small>
            <em class="part-price"><i aria-hidden="true"></i>${priceLabel}</em>
          </button>
        `;
      })
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

  _switchLoadout(direction) {
    const offset = direction === "next" ? 1 : -1;
    const length = this.state.loadouts.length;
    this.state.activeLoadoutIndex =
      (this.state.activeLoadoutIndex + offset + length) % length;
    const loadout = this.state.loadouts[this.state.activeLoadoutIndex];
    this.state.build = loadout.build;
    this.state.colors = loadout.colors;
    this.playerBuild = calculateBuild(this.state.build);
    this.activeSlot = null;
    this._save();
    this._renderAssembly();
    this.stage.showAssembly(
      this.state.loadouts,
      this.state.activeLoadoutIndex,
      null,
    );
    this._showToast(`${loadout.name}陀螺已设为出战配置`);
    navigator.vibrate?.(12);
  }

  _openPurchase(part) {
    this.pendingPurchaseId = part.id;
    const candidateSelection = {
      ...this.state.build,
      [part.type]: part.id,
    };
    const currentRatings = getBuildRatings(this.playerBuild);
    const candidateRatings = getBuildRatings(calculateBuild(candidateSelection));
    this.root.querySelector("#purchase-title").textContent = part.name;
    this.root.querySelector("#purchase-description").textContent =
      `${part.description} 解锁后会立即装备。`;
    this.root.querySelector("#purchase-deltas").innerHTML = Object.entries(
      candidateRatings,
    )
      .map(([label, value]) => {
        const delta = Math.round(value - currentRatings[label]);
        const deltaClass =
          delta > 0 ? "is-positive" : delta < 0 ? "is-negative" : "";
        const prefix = delta > 0 ? "+" : "";
        return `
          <span>
            <small>${label}</small>
            <b class="${deltaClass}">${prefix}${delta}</b>
          </span>
        `;
      })
      .join("");
    this.root.querySelector("#purchase-balance").textContent = String(
      this.state.coins - part.price,
    ).padStart(4, "0");
    this.root.querySelector("#purchase-confirm").textContent =
      `解锁并装备 · ${part.price}`;
    this._setPurchaseDialog(true);
  }

  _confirmPurchase() {
    const part = getPart(this.pendingPurchaseId);
    if (!part) return;
    const result = purchasePart(
      {
        coins: this.state.coins,
        ownedPartIds: this.state.ownedPartIds,
      },
      part.id,
    );
    if (!result.ok) {
      this._setPurchaseDialog(false);
      if (result.reason === "insufficient_coins") {
        this._showToast(`金币不足，还差 ${result.missingCoins} 枚`);
      }
      return;
    }

    this.state.coins = result.progression.coins;
    this.state.ownedPartIds = result.progression.ownedPartIds;
    this.state.build[part.type] = part.id;
    this.activeSlot = part.type;
    if (this.state.tutorial.stage === TUTORIAL_STAGE.BUY_FIRST_PART) {
      this.state.tutorial.stage = TUTORIAL_STAGE.SECOND_BATTLE;
    }
    this._setPurchaseDialog(false);
    this._renderPersistentState();
    this._commitBuild();
    this._renderTutorial();
    this._showToast(`${part.name} 已解锁并装备`);
    navigator.vibrate?.(24);
  }

  _setPurchaseDialog(open) {
    const layer = this.root.querySelector("#purchase-layer");
    layer.classList.toggle("is-hidden", !open);
    if (open) {
      this.root.querySelector("#purchase-confirm").focus();
    } else {
      this.pendingPurchaseId = null;
    }
  }

  _showToast(message) {
    const toast = this.root.querySelector("#toast");
    window.clearTimeout(this.toastTimer);
    toast.textContent = message;
    toast.classList.remove("is-hidden");
    this.toastTimer = window.setTimeout(() => {
      toast.classList.add("is-hidden");
    }, 2400);
  }

  _canNavigateTo(screen) {
    if (this.state.tutorial.completed) return true;
    if (this.state.tutorial.stage === TUTORIAL_STAGE.FIRST_BATTLE) {
      return screen === "battle";
    }
    if (this.state.tutorial.stage === TUTORIAL_STAGE.BUY_FIRST_PART) {
      return screen === "assembly";
    }
    if (this.state.tutorial.stage === TUTORIAL_STAGE.SECOND_BATTLE) {
      return screen === "assembly" || screen === "battle";
    }
    return true;
  }

  _skipTutorial() {
    this.state.tutorial = {
      ...this.state.tutorial,
      stage: TUTORIAL_STAGE.COMPLETE,
      completed: true,
    };
    this._save();
    this._renderTutorial();
    if (this.screen === "battle") this.goTo("assembly");
    this._showToast("新手引导已跳过，可自由组装和对战");
  }

  _renderTutorial() {
    const card = this.root.querySelector("#tutorial-card");
    const { stage, completed } = this.state.tutorial;
    const visibleOnScreen =
      (stage === TUTORIAL_STAGE.FIRST_BATTLE && this.screen === "battle") ||
      (stage === TUTORIAL_STAGE.BUY_FIRST_PART &&
        this.screen === "assembly") ||
      stage === TUTORIAL_STAGE.SECOND_BATTLE;
    const hidden = completed || !visibleOnScreen;
    card.classList.toggle("is-hidden", hidden);
    this.root.querySelector(".game-shell").dataset.tutorialStage = completed
      ? TUTORIAL_STAGE.COMPLETE
      : stage;
    if (hidden) return;

    const content = {
      [TUTORIAL_STAGE.FIRST_BATTLE]: {
        progress: "新手训练 · 1/3",
        title: "先把木质陀螺转起来",
        copy: "调节发射力度、方向和倾角后出手。开战后拖动摇杆，自己探索碰撞和转速的关系。",
      },
      [TUTORIAL_STAGE.BUY_FIRST_PART]: {
        progress: "新手训练 · 2/3",
        title: "用赏金解锁第一个零件",
        copy: "轻点陀螺上的任意部件进入改装。灰色零件尚未解锁；带金色钱币标记的零件现在可以买。",
      },
      [TUTORIAL_STAGE.SECOND_BATTLE]: {
        progress: "新手训练 · 3/3",
        title: "验证你的第一次改装",
        copy: "新零件已自动装备。再次进入标准竞技场，感受属性变化带来的战斗差异。",
        action: "使用新零件出战",
      },
    }[stage];
    this.root.querySelector("#tutorial-progress").textContent =
      content.progress;
    this.root.querySelector("#tutorial-title").textContent = content.title;
    this.root.querySelector("#tutorial-copy").textContent = content.copy;
    const action = this.root.querySelector("#tutorial-action");
    action.textContent = content.action ?? "";
    action.classList.toggle(
      "is-hidden",
      !content.action || this.screen === "battle",
    );
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
          <i>左右滑动</i>
        </button>
      `,
    ).join("");
  }

  _selectArena(arenaId) {
    if (arenaId === this.selectedArena.id) return;
    this.selectedArena = getArena(arenaId);
    this.state.arenaId = this.selectedArena.id;
    this.root.querySelector(".game-shell").dataset.arena =
      this.selectedArena.id;
    this.root.querySelectorAll("[data-arena]").forEach((card) => {
      card.classList.toggle(
        "is-active",
        card.dataset.arena === this.selectedArena.id,
      );
    });
    this.stage.showArena(this.selectedArena);
    this._save();
    this.audio.playUi();
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
      this.state.loadouts,
      this.state.activeLoadoutIndex,
      this.activeSlot,
    );
    this.audio.playUi();
  }

  goTo(screen) {
    if (screen === "map") {
      this._renderMaps();
      this.stage.showArena(this.selectedArena);
      requestAnimationFrame(() => {
        this.root
          .querySelector(`[data-arena="${this.selectedArena.id}"]`)
          ?.scrollIntoView({ inline: "center" });
      });
    } else if (screen === "assembly") {
      this.simulation = null;
      this.activeSlot = null;
      this._renderAssembly();
      this.stage.showAssembly(
        this.state.loadouts,
        this.state.activeLoadoutIndex,
        null,
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
      .querySelector("#view-reset")
      .classList.toggle("is-hidden", screen !== "assembly");
    this.root
      .querySelector("#battle-hud")
      .classList.toggle("is-hidden", screen !== "battle");
    if (screen !== "battle") {
      this.root.querySelector("#battle-utility").classList.add("is-hidden");
    }
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
    this._renderTutorial();
    this.audio.playUi();
  }

  _prepareBattle() {
    const firstBattle =
      this.state.tutorial.stage === TUTORIAL_STAGE.FIRST_BATTLE;
    if (firstBattle) {
      this.selectedArena = getArena("standard");
      this.state.arenaId = "standard";
    }
    const playerSelection = firstBattle ? DEFAULT_BUILD : this.state.build;
    const battlePlayerBuild = calculateBuild(playerSelection);
    const enemySelection = firstBattle
      ? DEFAULT_BUILD
      : ENEMY_BUILDS[this.selectedArena.id];
    const enemyBuild = calculateBuild(enemySelection);
    this.simulation = new BattleSimulation({
      playerBuild: battlePlayerBuild,
      enemyBuild,
      arena: this.selectedArena,
      seed: 20260718,
      tuning: this.state.tuning,
    });
    this.stage.prepareBattle(
      this.selectedArena,
      playerSelection,
      enemySelection,
      firstBattle ? TRAINING_COLORS : this.state.colors,
    );
    this.paused = false;
    this.resultHandled = false;
    this.control = { x: 0, y: 0 };
    this.accumulator = 0;
    this.root.querySelector("#launch-controls").classList.remove("is-hidden");
    this.root.querySelector("#battle-controls").classList.add("is-hidden");
    this.root.querySelector("#battle-utility").classList.add("is-hidden");
    this.root.querySelector("#result-card").classList.add("is-hidden");
    this.root.querySelector("#pause-battle").textContent = "暂停";
    this.root.querySelector("#battle-message").textContent = firstBattle
      ? "木质训练陀螺等待发射"
      : "等待发射参数";
    this._updateLaunchOutputs();
    this._updateHud();
  }

  async _launch() {
    await this.audio.init();
    this.audio.setEnabled(this.state.sound);
    const power = 0.86;
    const height =
      Number(this.root.querySelector("#launch-height").value) / 100;
    const direction =
      (Number(this.root.querySelector("#launch-direction").value) * Math.PI) /
      180;
    const angle = Number(this.root.querySelector("#launch-angle").value) / 12;
    this.simulation.launch({ power, height, direction, angle });
    this.stage.launchBattleVisual();
    this.audio.playLaunch(power);
    this.root.querySelector("#launch-controls").classList.add("is-hidden");
    this.root.querySelector("#battle-controls").classList.remove("is-hidden");
    this.root.querySelector("#battle-utility").classList.remove("is-hidden");
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
    for (const key of ["height", "direction", "angle"]) {
      const value = this.root.querySelector(`#launch-${key}`).value;
      this.root.querySelector(`#launch-${key}-output`).value =
        key === "height" ? `${value}%` : `${value}°`;
    }
    this.stage.updateLauncherPreview({
      height: Number(this.root.querySelector("#launch-height").value) / 100,
      direction:
        (Number(this.root.querySelector("#launch-direction").value) *
          Math.PI) /
        180,
      angle:
        (Number(this.root.querySelector("#launch-angle").value) * Math.PI) /
        180,
    });
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
    const tutorialStage = this.state.tutorial.stage;
    const reward = getBattleReward({
      won,
      tutorial: this.state.tutorial,
    });
    this.state.coins += reward;
    if (tutorialStage === TUTORIAL_STAGE.FIRST_BATTLE) {
      this.state.tutorial.firstRewardClaimed = true;
      this.state.tutorial.stage = TUTORIAL_STAGE.BUY_FIRST_PART;
    } else if (tutorialStage === TUTORIAL_STAGE.SECOND_BATTLE) {
      this.state.tutorial.stage = TUTORIAL_STAGE.COMPLETE;
      this.state.tutorial.completed = true;
    }
    this._save();
    this._renderPersistentState();
    this._renderTutorial();
    this.audio.playResult(won, reason);
    this.root.querySelector("#result-kicker").textContent =
      `BATTLE COMPLETE · +${reward}`;
    this.root.querySelector("#result-title").textContent = won
      ? RESULT_LABELS[reason]
      : "本回合失败";
    this.root.querySelector("#result-copy").textContent =
      tutorialStage === TUTORIAL_STAGE.FIRST_BATTLE
        ? `${time.toFixed(1)} 秒 · 已获得 ${reward} 金币，下一步去解锁你的第一个零件。`
        : `${time.toFixed(1)} 秒 · ${won ? "你的配置完成了验证。" : `对手通过${RESULT_LABELS[reason]}结束回合。`}`;
    const assemblyButton = this.root.querySelector("#result-assembly");
    const restartButton = this.root.querySelector("#result-restart");
    assemblyButton.textContent =
      tutorialStage === TUTORIAL_STAGE.FIRST_BATTLE
        ? "领取奖励并前往组装"
        : "返回改装";
    restartButton.classList.toggle(
      "is-hidden",
      tutorialStage === TUTORIAL_STAGE.FIRST_BATTLE,
    );
    this.root.querySelector("#battle-controls").classList.add("is-hidden");
    this.root.querySelector("#battle-utility").classList.add("is-hidden");
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
    const influence = Math.round((player.controlInfluence ?? 0) * 100);
    if (!this.joystickActive) {
      const screenPosition = this.stage.getPlayerScreenPosition();
      if (screenPosition) {
        const joystick = this.root.querySelector("#joystick");
        const margin = 54;
        joystick.style.left =
          `${clamp(screenPosition.x, margin, screenPosition.width - margin)}px`;
        joystick.style.top =
          `${clamp(screenPosition.y, 110, screenPosition.height - margin)}px`;
      }
    }
    this.root.querySelector("#joystick-power").textContent =
      Math.hypot(control.x, control.y) > 0.05 ? String(influence) : "0";
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
