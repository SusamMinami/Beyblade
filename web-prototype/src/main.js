import "./styles.css";
import { AudioEngine } from "./audio/audio-engine.js";
import { calculateBuild, getBuildRatings } from "./core/assembly-calculator.js";
import {
  BattleSimulation,
  BATTLE_RESULT,
} from "./core/battle-simulation.js";
import { migrateLoadouts } from "./core/loadouts.js";
import {
  DEFAULT_PART_CUSTOMIZATION,
  normalizePartCustomization,
  PART_MATERIAL_LIST,
  SYMMETRY_OPTIONS,
} from "./core/part-customization.js";
import {
  getBattleReward,
  getMaterialAccess,
  getPartAccess,
  migrateProgression,
  purchaseMaterial,
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
import { normalizeSceneTime } from "./render/scene-time.js";
import "./ui/scene-time.css";
import { LabScreen } from "./ui/lab-screen.js";
import { normalizeLabState } from "./core/lab-state.js";
import { ShowroomScreen } from "./ui/showroom-screen.js";
import { normalizeShowroom } from "./core/showroom-state.js";
import { CAMPAIGN_MISSIONS, getMission } from "./data/campaign.js";
import { canPlayMission, nextMission, normalizeCampaign, settleMission } from "./core/campaign-state.js";
import { renderCampaign } from "./ui/campaign-panel.js";
import { opponentIdentity } from "./data/opponent-identities.js";
import "./ui/battle-structure.css";
import { battleCoach } from "./core/battle-coach.js";
import "./ui/game-flow.css";
import { normalizeBattleNotes, trainingCue } from "./core/growth-state.js";
import { renderBuildComparison, buildChangeSummary } from "./ui/build-comparison.js";
import { chapterMoment } from "./data/chapter-moments.js";
import "./ui/growth-flow.css";

const STORAGE_KEY = "spin-core-web-prototype-v2";
const PREPARATION_KEY = "spin-core-preparing-mission";
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
    sceneTime: "auto",
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
      customizations: activeLoadout.customizations,
      lab: normalizeLabState(saved?.lab),
      showroom: normalizeShowroom(saved?.showroom),
      campaign: normalizeCampaign(saved?.campaign),
      battleNotes: normalizeBattleNotes(saved?.battleNotes),
      sceneTime: normalizeSceneTime(saved?.sceneTime),
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
      customizations: loadoutState.loadouts[0].customizations,
      lab: normalizeLabState(),
      showroom: normalizeShowroom(),
      campaign: normalizeCampaign(),
      battleNotes: {},
    };
  }
}

class BeybladeApp {
  constructor(root) {
    this.root = root;
    this.state = loadState();
    this.playerBuild = calculateBuild(
      this.state.build,
      this.state.customizations,
    );
    this.selectedArena = getArena(this.state.arenaId);
    this.activeSlot = null;
    this.screen = "assembly";
    this.audio = new AudioEngine();
    this.audio.setEnabled(this.state.sound);
    this.simulation = null;
    this.paused = false;
    this.resultHandled = false;
    this.mapMode = location.hash === "#journey" ? "story" : "free";
    this.viewMissionId = nextMission(this.state.campaign)?.id ?? CAMPAIGN_MISSIONS.at(-1).id;
    try {
      const id = sessionStorage.getItem(PREPARATION_KEY);
      this.preparingMissionId = this.state.tutorial.completed && canPlayMission(this.state.campaign, id) ? id : null;
      if (this.preparingMissionId) this.viewMissionId = this.preparingMissionId;
    } catch (error) { console.warn("约战返回目标无法读取，将使用当前旅程进度。", error); }
    this.activeEncounter = null;
    this.campaignResult = null;
    this.control = { x: 0, y: 0 };
    this.keys = new Set();
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.lastHudUpdate = 0;
    this.diyDraft = null;
    this.diyPartId = null;
    this.diyView = "front";
    this.launchParams = {
      height: 0.45,
      direction: 0,
      angle: 0,
      power: 0.86,
    };

    this._mount();
    this.stage = new ThreeStage(this.root.querySelector("#three-stage"));
    this.stage.setSceneTime(this.state.sceneTime);
    this.root.querySelector("#scene-time").value = this.state.sceneTime;
    this._bindEvents();
    this._renderAssembly();
    this._renderMaps();
    this._renderPersistentState();
    if (location.hash === "#lab") {
      this.goTo("lab");
    } else if (location.hash === "#collection") {
      this.goTo("collection");
    } else if (location.hash === "#map") {
      this.goTo("map");
    } else if (location.hash === "#journey") {
      this.goTo("journey");
    } else if (location.hash === "#assembly") {
      this.goTo("assembly");
    } else if (this.state.tutorial.stage === TUTORIAL_STAGE.FIRST_BATTLE) {
      this.goTo("battle");
    } else {
      this.goTo(this.state.tutorial.completed ? "collection" : "assembly");
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
            <button class="phase" data-go="lab"><i></i><span>测试室</span></button>
            <button class="phase" data-go="collection"><i></i><span>陀螺库</span></button>
            <button class="phase" data-phase-only="battle"><i></i><span>对战</span></button>
          </nav>
          <div class="top-actions">
            <span class="wallet"><small>赏金</small><b id="coin-count">0</b></span>
            <button class="icon-button" id="sound-toggle" aria-label="切换声音">声</button>
          </div>
          <div class="battle-topbar is-hidden" id="battle-topbar">
            <div class="battle-top-fighter player-card">
              <span>YOU</span>
              <b id="player-spin">0</b>
              <i><em id="player-durability-bar"></em></i>
              <small id="player-status">待发射</small>
            </div>
            <button class="battle-clock" id="pause-battle" aria-label="暂停或继续战斗">
              <b id="battle-time">00.0</b>
              <small id="battle-pause-label">暂停</small>
            </button>
            <div class="battle-top-fighter enemy-card">
              <span id="enemy-name">AI</span>
              <b id="enemy-spin">0</b>
              <i><em id="enemy-durability-bar"></em></i>
              <small id="enemy-status">待发射</small>
            </div>
          </div>
          <div class="diy-topbar is-hidden" id="diy-topbar">
            <div class="diy-top-main">
              <strong id="diy-title">零件深度改造</strong>
              <div class="diy-view-switch" role="group" aria-label="三视图切换">
                <button data-diy-view="front" class="is-active">正</button>
                <button data-diy-view="top">俯</button>
                <button data-diy-view="side">侧</button>
              </div>
              <div class="diy-top-metrics">
                <span>质量 <b id="diy-mass-value">1.22</b></span>
                <span>惯量 <b id="diy-inertia-value">0.89</b></span>
              </div>
            </div>
            <div class="diy-symmetry">
              <span>对称延展</span>
              <div>
                ${SYMMETRY_OPTIONS.map(
                  (value) =>
                    `<button data-diy-symmetry="${value}">${value === 2 ? "左右" : `${value} 边`}</button>`,
                ).join("")}
              </div>
            </div>
          </div>
        </header>

        <main class="stage-shell">
          <div id="three-stage" role="application" tabindex="0" aria-label="可直接操作的三维预览"></div>
          <div class="stage-vignette"></div>
          <div class="stage-caption">
            <span id="stage-kicker">ASSEMBLY / 01</span>
            <strong id="stage-title">五层结构实验</strong>
          </div>
          <div class="drive-zone-hud" id="drive-zone-hud"></div>

          <div class="launch-controls is-hidden" id="launch-controls">
            <p class="campaign-brief is-hidden" id="campaign-brief"></p>
            <div class="launcher-heading">
              <span>DIRECT LAUNCH</span>
              <b>拖模型调倾角 · 拖箭头末端圆点调方向与力度</b>
            </div>
            <div class="launch-readout" aria-live="polite">
              <span>力度 <output id="launch-power-output">86%</output></span>
              <span>方向 <output id="launch-direction-output">0°</output></span>
              <span>倾角 <output id="launch-angle-output">0°</output></span>
            </div>
            <button class="launch-button" id="launch-button">
              <span>确认发射</span>
            </button>
          </div>

          <div class="battle-controls is-hidden" id="battle-controls">
            <div class="joystick-caption">
              <span>方向微调</span>
              <b><output id="joystick-input-power">0</output>%</b>
            </div>
            <div class="joystick" id="joystick" aria-label="战斗方向控制">
              <i class="joystick-axis axis-x"></i>
              <i class="joystick-axis axis-y"></i>
              <b id="joystick-knob"></b>
            </div>
          </div>
          <div class="top-influence is-hidden" id="top-influence">
            <span>控制影响</span>
            <b id="top-influence-value">0%</b>
          </div>
          <div class="sr-only" aria-live="polite">
            <span id="battle-message-kicker">LIVE PHYSICS</span>
            <b id="battle-message">正在计算碰撞与转速</b>
            <span id="control-state"></span>
            <span id="surface-chip">标准地面</span>
          </div>

          <button class="tune-button is-hidden" id="tune-open">调参</button>
          <div class="result-card is-hidden" id="result-card">
            <span id="result-kicker">BATTLE COMPLETE</span>
            <h2 id="result-title">对战结束</h2>
            <p id="result-copy"></p>
            <p id="result-cause" class="result-cause"></p>
            <p id="result-coach" class="result-coach"></p>
            <details id="result-details"><summary>展开战报与零件损伤</summary>
              <div id="result-telemetry" class="result-telemetry"></div>
              <details class="comparison-disclosure"><summary>这次改装改变了什么</summary><div id="result-comparison"></div></details>
            </details>
            <div class="campaign-result is-hidden" id="campaign-result"></div>
            <div class="result-reward">
              <small>本局赏金</small>
              <strong>+<span id="result-reward">0</span></strong>
              <em>金币已到账</em>
            </div>
            <div class="result-actions">
              <button class="button ghost" id="result-assembly">返回改装</button>
              <button class="button primary" id="result-restart">再次对战</button>
            </div>
          </div>
          <div class="victory-celebration is-hidden" id="victory-celebration" aria-hidden="true"></div>
          <div class="toast is-hidden" id="toast" role="status" aria-live="polite"></div>
          <dialog id="battle-pause-dialog" aria-labelledby="pause-title" aria-describedby="pause-copy">
            <h2 id="pause-title">对局已暂停</h2>
            <p id="pause-copy">继续后恢复计时。退出本局不会结算金币或任务进度。</p>
            <div class="pause-actions">
              <button class="button primary" id="pause-resume" autofocus>继续对局</button>
              <button class="button ghost" id="pause-exit">退出本局</button>
            </div>
          </dialog>
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
            <details class="comparison-disclosure" id="assembly-comparison">
              <summary>对比上次出战</summary><div></div>
            </details>
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
                  <b id="build-mass">质量 1.22（平衡单位）</b>
                </div>
                <div class="metric-grid" id="metric-grid"></div>
              </div>
            </div>
            <div class="assembly-view-tools">
              <div class="drag-hint" id="drag-hint">
                <i></i>
                <span>拖动环绕 · 轻点部件改装 · 横扫切换陀螺</span>
              </div>
            </div>
            <div class="action-row">
              <button class="button ghost open-lab-button" data-go="lab">测试室</button>
              <button class="button primary" id="go-map">故事远征 / 对战 <span>→</span></button>
            </div>
          </div>

          <div class="screen-panel is-hidden" data-panel="map">
            <div class="journey-modes" role="group" aria-label="选择对战模式">
              <button data-map-mode="story" aria-pressed="false">故事远征</button>
              <button data-map-mode="free" aria-pressed="true">自由对战</button>
              <label class="scene-time"><span>时段</span>
                <select id="scene-time" aria-label="比赛场景时段">
                  <option value="auto">随本地时间</option>
                  <option value="day">白天</option>
                  <option value="night">夜晚</option>
                </select>
              </label>
            </div>
            <div class="arena-list" id="arena-list" aria-label="左右滑动选择竞技场"></div>
            <section class="journey-panel" id="campaign-panel" aria-label="远征任务"></section>
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

        <section class="diy-layer is-hidden" id="diy-layer" aria-label="零件深度 DIY 编辑器">
          <div class="diy-direct-hint">
            <span><i class="size-dot"></i>大小</span>
            <span><i class="height-dot"></i>高度</span>
            <span><i class="shape-dot"></i>轮廓</span>
            <b>拖动模型手柄直接塑形</b>
          </div>
          <div class="diy-control-panel">
            <div class="diy-material">
              <span>材料 <b id="diy-material-name">原装材料</b></span>
              <div class="diy-material-list" id="diy-material-list"></div>
              <p id="diy-material-description"></p>
            </div>
            <div class="diy-actions">
              <button class="button ghost" id="diy-cancel">取消</button>
              <button class="button primary" id="diy-save">保存改造</button>
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
    window.addEventListener("hashchange", () => {
      const route = location.hash.slice(1);
      if (["journey", "map", "assembly", "lab", "collection"].includes(route)) this.goTo(route);
    });
    this.root.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button || button.disabled) return;
      void this._playButtonFeedback(button);
    });
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
        } else if (this.state.tutorial.stage === TUTORIAL_STAGE.BUY_FIRST_PART) {
          const candidate = getPartsByType("driverShaft").find(part => {
            const access = getPartAccess(part, this.state);
            return access.affordable;
          });
          this.activeSlot = candidate?.type ?? "attackRing";
          this._renderAssembly();
          this.stage.showAssembly(this.state.loadouts, this.state.activeLoadoutIndex, this.activeSlot);
          this._renderTutorial();
        } else if (this.state.tutorial.stage === TUTORIAL_STAGE.FIRST_BATTLE) {
          this.goTo("battle");
        }
      });
    this.root.querySelector("#three-stage").addEventListener(
      "partselect",
      (event) => {
        if (this.diyDraft) return;
        if (!PART_TYPE_META[event.detail.slot]) return;
        this.activeSlot = event.detail.slot;
        this._renderAssembly();
        this.stage.setAssemblyActive(this.activeSlot);
        this.audio.playUi();
      },
    );
    this.root.querySelector("#three-stage").addEventListener("arenastatus",event=>{
      const {state,message}=event.detail;
      this.root.querySelector("#launch-button").disabled=state!=="ready";
      this.root.querySelector("#three-stage").dataset.assetState=state;
      let notice=this.root.querySelector(".arena-asset-status");
      if (!notice) {
        notice=document.createElement("div");
        notice.className="arena-asset-status";
        notice.setAttribute("role","status");
        this.root.querySelector("#three-stage").append(notice);
      }
      notice.hidden=state==="ready";
      notice.textContent=message;
    });
    this.root
      .querySelector("#three-stage")
      .addEventListener("assemblyclear", () => {
        if (this.diyDraft) return;
        if (!this.activeSlot) return;
        this.activeSlot = null;
        this._renderAssembly();
        this.stage.setAssemblyActive(null);
      });
    this.root.querySelector("#three-stage").addEventListener(
      "topswipe",
      (event) => {
        if (this.diyDraft) return;
        this._switchLoadout(event.detail.direction);
      },
    );
    this.root.querySelector("#three-stage").addEventListener(
      "launchchange",
      (event) => {
        this.launchParams = { ...this.launchParams, ...event.detail };
        this._updateLaunchOutputs();
      },
    );
    this.root.querySelector("#three-stage").addEventListener(
      "diychange",
      (event) => {
        if (!this.diyDraft) return;
        this.diyDraft = normalizePartCustomization({
          ...this.diyDraft,
          [event.detail.property]: event.detail.value,
        });
        this._renderDiyEditor();
        this._previewDiy();
      },
    );
    this.root
      .querySelector("#previous-loadout")
      .addEventListener("click", () => this._switchLoadout("previous"));
    this.root
      .querySelector("#next-loadout")
      .addEventListener("click", () => this._switchLoadout("next"));
    this.root
      .querySelector("#variant-list")
      .addEventListener("click", (event) => {
        const button = event.target.closest("[data-part-id]");
        if (!button) return;
        const part = getPart(button.dataset.partId);
        const access = getPartAccess(part, this.state);
        if (access.owned) {
          if (part.id === this.state.build[this.activeSlot]) {
            this._openPartEditor(part);
            return;
          }
          this.state.build[this.activeSlot] = part.id;
          this._commitBuild({ animatePart: true });
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
      if (!this.state.tutorial.completed && this.state.tutorial.stage !== TUTORIAL_STAGE.BUY_FIRST_PART) {
        this.goTo("battle");
        return;
      }
      this.goTo(this.preparingMission || this.state.tutorial.completed ? "journey" : "map");
    });
    this.root.querySelector(".journey-modes").addEventListener("click", (event) => {
      const mode = event.target.closest("button")?.dataset.mapMode;
      if (mode) this._setMapMode(mode);
    });
    this.root.querySelector("#scene-time").addEventListener("change", event => {
      this.state.sceneTime = normalizeSceneTime(event.target.value);
      this.stage.setSceneTime(this.state.sceneTime);
      this._save();
      this.audio.playUi();
    });
    this.root.querySelector("#campaign-panel").addEventListener("change", (event) => {
      if (event.target.id !== "mission-select" || !getMission(event.target.value)) return;
      this.viewMissionId = event.target.value;
      this._setMapMode("story");
      this.root.querySelector("#mission-select").focus();
    });
    this.root.querySelector("#campaign-panel").addEventListener("click", (event) => {
      const action = event.target.closest("[data-journey-action]")?.dataset.journeyAction;
      if (action === "tutorial") this.goTo(this.state.tutorial.stage === TUTORIAL_STAGE.FIRST_BATTLE ? "battle" : "assembly");
      if (action === "skip") { this._skipTutorial(); this._setMapMode("story"); }
    });
    const arenaList = this.root.querySelector("#arena-list");
    this._bindArenaCarousel(arenaList);
    this.root.querySelector("#start-battle").addEventListener("click", () => {
      if (this.mapMode === "story") {
        if (!this.state.tutorial.completed || !canPlayMission(this.state.campaign, this.viewMissionId)) return;
        this.activeEncounter = { missionId: this.viewMissionId };
      } else this.activeEncounter = null;
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
    this.root
      .querySelector("#launch-button")
      .addEventListener("click", () => this._launch());
    this.root
      .querySelector("#pause-battle")
      .addEventListener("click", () => this._togglePause());
    this.root.querySelector("#pause-resume").addEventListener("click", () => this._setPaused(false));
    this.root.querySelector("#pause-exit").addEventListener("click", () => {
      const route = this.activeEncounter ? "journey" : this.state.tutorial.completed ? "map" : "assembly";
      this.goTo(route);
    });
    this.root.querySelector("#battle-pause-dialog").addEventListener("cancel", (event) => {
      event.preventDefault();
      this._setPaused(false);
    });
    this.root
      .querySelector("#result-restart")
      .addEventListener("click", () => {
        if (this.activeEncounter && this.campaignResult?.cleared) {
          this.viewMissionId = nextMission(this.state.campaign)?.id ?? this.activeEncounter.missionId;
          this.goTo("journey");
        } else if (!this.activeEncounter && this.state.tutorial.completed && this.tutorialJustCompleted) {
          this.goTo("journey");
        } else this._prepareBattle();
      });
    this.root
      .querySelector("#result-assembly")
      .addEventListener("click", () => {
        const slot = this.resultCoachSlot;
        this.goTo("assembly");
        if (slot) {
          this.activeSlot = slot;
          this._renderAssembly();
          this.stage.showAssembly(this.state.loadouts, this.state.activeLoadoutIndex, slot);
        }
      });

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

    this.root
      .querySelector("#diy-material-list")
      .addEventListener("click", (event) => {
        const button = event.target.closest("[data-diy-material]");
        if (!button || !this.diyDraft) return;
        const material = PART_MATERIAL_LIST.find(
          (item) => item.id === button.dataset.diyMaterial,
        );
        if (!material) return;
        const access = getMaterialAccess(material, this.state);
        if (!access.owned) {
          if (!access.affordable) {
            this._showToast(`金币不足，还差 ${access.missingCoins} 枚`);
            navigator.vibrate?.(18);
            return;
          }
          const result = purchaseMaterial(
            {
              coins: this.state.coins,
              ownedMaterialIds: this.state.ownedMaterialIds,
            },
            material.id,
          );
          if (!result.ok) return;
          this.state.coins = result.progression.coins;
          this.state.ownedMaterialIds =
            result.progression.ownedMaterialIds;
          this._save();
          this._renderPersistentState();
          this._showToast(`${material.name} 已解锁`);
          navigator.vibrate?.(24);
        }
        this.diyDraft.material = material.id;
        this._renderDiyEditor();
        this._previewDiy();
      });
    this.root.querySelector(".diy-symmetry").addEventListener(
      "click",
      (event) => {
        const button = event.target.closest("[data-diy-symmetry]");
        if (!button || !this.diyDraft) return;
        this.diyDraft.symmetry = Number(button.dataset.diySymmetry);
        this._renderDiyEditor();
        this._previewDiy();
      },
    );
    this.root.querySelector(".diy-view-switch").addEventListener(
      "click",
      (event) => {
        const button = event.target.closest("[data-diy-view]");
        if (!button || !this.diyDraft) return;
        this.diyView = button.dataset.diyView;
        this.root.querySelectorAll("[data-diy-view]").forEach((item) => {
          item.classList.toggle("is-active", item === button);
        });
        this.stage.setAssemblyOrthographicView(this.diyView);
      },
    );
    this.root
      .querySelector("#diy-save")
      .addEventListener("click", () => this._closePartEditor(true));
    this.root
      .querySelector("#diy-cancel")
      .addEventListener("click", () => this._closePartEditor(false));

    this._bindJoystick();
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && this.diyDraft) {
        this._closePartEditor(false);
        return;
      }
      if (event.key === "Escape" && this.pendingPurchaseId) {
        this._setPurchaseDialog(false);
        return;
      }
      if (this.root.querySelector("dialog[open]") || event.target.closest("input, select, textarea, [contenteditable]")) return;
      if (event.key === "Escape" && this.screen === "battle") {
        event.preventDefault();
        this._togglePause();
        return;
      }
      if (this.screen !== "battle" || this.paused || this.simulation?.phase !== "running") return;
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
    window.addEventListener("blur", () => { this._clearBattleInput(); this._setPaused(true); });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { this._clearBattleInput(); this._setPaused(true); }
    });
  }

  async _playButtonFeedback(button) {
    await this.audio.init();
    this.audio.setEnabled(this.state.sound);
    const tone =
      button.classList.contains("primary") ||
      button.classList.contains("launch-button") ||
      button.id === "purchase-confirm"
        ? "confirm"
        : button.classList.contains("ghost")
          ? "soft"
          : "tap";
    this.audio.playUi(tone);
  }

  _bindArenaCarousel(arenaList) {
    const getCards = () => [...arenaList.querySelectorAll("[data-arena]")];
    const getClosestCard = () => {
      const bounds = arenaList.getBoundingClientRect();
      const center = bounds.left + bounds.width * 0.5;
      return getCards().reduce((best, card) => {
        const cardBounds = card.getBoundingClientRect();
        const distance = Math.abs(
          cardBounds.left + cardBounds.width * 0.5 - center,
        );
        return !best || distance < best.distance
          ? { card, distance }
          : best;
      }, null)?.card;
    };
    const settleOnCard = (card) => {
      if (!card) return;
      this._selectArena(card.dataset.arena);
      this._centerArenaCard(card);
    };

    arenaList.addEventListener("pointerdown", (event) => {
      if (!event.target.closest("[data-arena]")) return;
      this.arenaCentering = false;
      this.arenaDrag = {
        card: event.target.closest(".arena-card"),
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: arenaList.scrollLeft,
        startArenaId: this.selectedArena.id,
        moved: false,
      };
      arenaList.classList.add("is-dragging");
      arenaList.setPointerCapture(event.pointerId);
    });
    arenaList.addEventListener("pointermove", (event) => {
      if (this.arenaDrag?.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - this.arenaDrag.startX;
      const deltaY = event.clientY - this.arenaDrag.startY;
      if (
        !this.arenaDrag.moved &&
        Math.abs(deltaX) < 6 &&
        Math.abs(deltaY) < 6
      ) {
        return;
      }
      if (Math.abs(deltaY) > Math.abs(deltaX) * 1.2) return;
      this.arenaDrag.moved = true;
      arenaList.scrollLeft = this.arenaDrag.startScrollLeft - deltaX;
      event.preventDefault();
    });
    const releaseArenaDrag = (event) => {
      const drag = this.arenaDrag;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - drag.startX;
      if (arenaList.hasPointerCapture(event.pointerId)) {
        arenaList.releasePointerCapture(event.pointerId);
      }
      arenaList.classList.remove("is-dragging");
      this.arenaDrag = null;
      if (event.type === "pointercancel") return;
      if (!drag.moved) {
        settleOnCard(drag.card);
        return;
      }

      this.suppressArenaClickUntil = performance.now() + 280;
      const cards = getCards();
      const startIndex = cards.findIndex(
        (card) => card.dataset.arena === drag.startArenaId,
      );
      let target = getClosestCard();
      if (Math.abs(deltaX) >= 38 && startIndex >= 0) {
        const nextIndex = Math.max(
          0,
          Math.min(cards.length - 1, startIndex + (deltaX < 0 ? 1 : -1)),
        );
        target = cards[nextIndex];
      }
      settleOnCard(target);
    };
    arenaList.addEventListener("pointerup", releaseArenaDrag);
    arenaList.addEventListener("pointercancel", releaseArenaDrag);
    arenaList.addEventListener("click", (event) => {
      if (performance.now() < (this.suppressArenaClickUntil ?? 0)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      settleOnCard(event.target.closest("[data-arena]"));
    });
    arenaList.addEventListener("scrollend", () => {
      if (this.arenaCentering) { this.arenaCentering = false; return; }
      if (this.arenaDrag || this.screen !== "map") return;
      this._selectArena(getClosestCard()?.dataset.arena);
    });
    this.arenaResizeObserver = new ResizeObserver(() => {
      if (this.screen !== "map" || this.mapMode !== "free" || this.arenaDrag) return;
      this._centerArenaCard(
        arenaList.querySelector(`.arena-card[data-arena="${this.selectedArena.id}"]`), "instant");
    });
    this.arenaResizeObserver.observe(arenaList);
  }

  _centerArenaCard(card, behavior = "smooth") {
    if (!card) return;
    const arenaList = this.root.querySelector("#arena-list");
    const left =
      card.offsetLeft - (arenaList.clientWidth - card.offsetWidth) * 0.5;
    this.arenaCentering = Math.abs(arenaList.scrollLeft - left) > 1;
    arenaList.scrollTo({ left, behavior });
  }

  _bindJoystick() {
    const joystick = this.root.querySelector("#joystick");
    const knob = this.root.querySelector("#joystick-knob");
    const update = (event) => {
      if (this.paused || this.simulation?.phase !== "running" || this.screen !== "battle") return;
      const bounds = joystick.getBoundingClientRect();
      const radius = bounds.width * 0.34;
      const rawX = event.clientX - (bounds.left + bounds.width * 0.5);
      const rawY = event.clientY - (bounds.top + bounds.height * 0.5);
      const magnitude = Math.hypot(rawX, rawY);
      const scale = magnitude > radius ? radius / magnitude : 1;
      const x = (rawX * scale) / radius;
      const y = (rawY * scale) / radius;
      this.control = { x, y };
      this.root.querySelector("#joystick-input-power").textContent = String(
        Math.round(Math.min(magnitude / radius, 1) * 100),
      );
      knob.style.transform = `translate(calc(-50% + ${x * radius}px), calc(-50% + ${y * radius}px))`;
    };
    const reset = () => {
      this.control = { x: 0, y: 0 };
      knob.style.transform = "translate(-50%, -50%)";
      this.root.querySelector("#joystick-input-power").textContent = "0";
    };
    joystick.addEventListener("pointerdown", (event) => {
      if (this.paused || this.simulation?.phase !== "running" || this.joystickActive) return;
      this.joystickPointerId = event.pointerId;
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
    joystick.addEventListener("lostpointercapture", () => this._clearBattleInput());
  }

  _renderAssembly() {
    const loadout = this.state.loadouts[this.state.activeLoadoutIndex];
    this.root.querySelector("#assembly-comparison > div").innerHTML =
      renderBuildComparison(this.state.battleNotes[loadout.id], loadout);
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
      `${meta.index} / 05`;
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
            ? "再次点击 DIY"
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
      `质量 ${this.playerBuild.totalMass.toFixed(2)} · 转速 ${this.playerBuild.maxSpinSpeed.toFixed(0)}（平衡单位）`;
    this.root.querySelector("#ring-color").value = this.state.colors.ring;
    this.root.querySelector("#core-color").value = this.state.colors.core;
  }

  _openPartEditor(part) {
    if (!part || part.id !== this.state.build[this.activeSlot]) return;
    const saved = this.state.customizations?.[part.id] ??
      DEFAULT_PART_CUSTOMIZATION;
    this.diyPartId = part.id;
    this.diyDraft = normalizePartCustomization(saved);
    this.diyView = "front";
    this.root.querySelector("#diy-layer").classList.remove("is-hidden");
    this.root.querySelector("#diy-topbar").classList.remove("is-hidden");
    this.root.querySelector(".game-shell").dataset.diyEditing = "true";
    this._renderDiyEditor();
    this._previewDiy();
    this.root.querySelector('[data-diy-view="front"]').focus();
  }

  _renderDiyEditor() {
    if (!this.diyDraft || !this.diyPartId) return;
    const part = getPart(this.diyPartId);
    this.root.querySelector("#diy-title").textContent =
      part.name;
    this.root.querySelectorAll("[data-diy-symmetry]").forEach((button) => {
      button.classList.toggle(
        "is-active",
        Number(button.dataset.diySymmetry) === this.diyDraft.symmetry,
      );
    });
    const material =
      PART_MATERIAL_LIST.find(
        (item) => item.id === this.diyDraft.material,
      ) ?? PART_MATERIAL_LIST[0];
    this.root.querySelector("#diy-material-name").textContent = material.name;
    this.root.querySelector("#diy-material-description").textContent =
      material.description;
    this.root.querySelector("#diy-material-list").innerHTML =
      PART_MATERIAL_LIST.map((item) => {
        const access = getMaterialAccess(item, this.state);
        const stateClass = access.owned
          ? "is-owned"
          : access.affordable
            ? "is-affordable"
            : "is-locked";
        const price = access.owned ? "已拥有" : `${item.price}`;
        return `
          <button
            class="${stateClass} ${item.id === material.id ? "is-active" : ""}"
            data-diy-material="${item.id}"
            aria-label="${item.name}，${access.owned ? "已拥有" : access.affordable ? `可用 ${item.price} 金币解锁` : `还差 ${access.missingCoins} 金币`}"
          >
            <b>${item.name}</b>
            <small>${price}</small>
          </button>
        `;
      }).join("");
    this.root.querySelectorAll("[data-diy-view]").forEach((button) => {
      button.classList.toggle(
        "is-active",
        button.dataset.diyView === this.diyView,
      );
    });
  }

  _previewDiy() {
    if (!this.diyDraft || !this.diyPartId) return;
    const loadout = this.state.loadouts[this.state.activeLoadoutIndex];
    const draftCustomizations = {
      ...loadout.customizations,
      [this.diyPartId]: { ...this.diyDraft },
    };
    const previewLoadouts = this.state.loadouts.map((item, index) =>
      index === this.state.activeLoadoutIndex
        ? { ...item, customizations: draftCustomizations }
        : item,
    );
    const previewBuild = calculateBuild(
      this.state.build,
      draftCustomizations,
    );
    this.stage.showAssembly(
      previewLoadouts,
      this.state.activeLoadoutIndex,
      this.activeSlot,
      { preserveCamera: true },
    );
    this.stage.enterPartEditor(
      this.activeSlot,
      previewBuild.centerOfMass,
      this.diyDraft,
    );
    this.stage.setAssemblyOrthographicView(this.diyView);
    this.root.querySelector("#diy-mass-value").textContent =
      previewBuild.totalMass.toFixed(2);
    this.root.querySelector("#diy-inertia-value").textContent =
      previewBuild.momentOfInertia.toFixed(2);
  }

  _closePartEditor(save) {
    if (!this.diyDraft || !this.diyPartId) return;
    const partName = getPart(this.diyPartId)?.name ?? "零件";
    if (save) {
      const loadout = this.state.loadouts[this.state.activeLoadoutIndex];
      loadout.customizations = {
        ...loadout.customizations,
        [this.diyPartId]: { ...this.diyDraft },
      };
      this.state.customizations = loadout.customizations;
      this.playerBuild = calculateBuild(
        this.state.build,
        this.state.customizations,
      );
      this._save();
    }
    this.diyDraft = null;
    this.diyPartId = null;
    this.root.querySelector("#diy-layer").classList.add("is-hidden");
    this.root.querySelector("#diy-topbar").classList.add("is-hidden");
    this.root.querySelector(".game-shell").dataset.diyEditing = "false";
    this.stage.exitPartEditor();
    this._renderAssembly();
    this._renderTutorial();
    this.stage.showAssembly(
      this.state.loadouts,
      this.state.activeLoadoutIndex,
      this.activeSlot,
      { preserveCamera: true },
    );
    this.audio.playUi();
    this._showToast(save ? `${partName} 的 DIY 改造已保存` : "已取消本次改造");
  }

  _switchLoadout(direction) {
    const offset = direction === "next" ? 1 : -1;
    const length = this.state.loadouts.length;
    this.state.activeLoadoutIndex =
      (this.state.activeLoadoutIndex + offset + length) % length;
    const loadout = this.state.loadouts[this.state.activeLoadoutIndex];
    this.state.build = loadout.build;
    this.state.colors = loadout.colors;
    this.state.customizations = loadout.customizations;
    this.playerBuild = calculateBuild(
      this.state.build,
      this.state.customizations,
    );
    this.activeSlot = null;
    this._save();
    this._renderAssembly();
    this._renderTutorial();
    this.stage.switchAssemblyLoadout(
      this.state.activeLoadoutIndex,
      null,
      direction,
    );
    navigator.vibrate?.(12);
  }

  _openPurchase(part) {
    this.pendingPurchaseId = part.id;
    const candidateSelection = {
      ...this.state.build,
      [part.type]: part.id,
    };
    const currentRatings = getBuildRatings(this.playerBuild);
    const candidateRatings = getBuildRatings(
      calculateBuild(candidateSelection, this.state.customizations),
    );
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
    this._commitBuild({ animatePart: true });
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
    if (screen === "lab" || screen === "collection" || screen === "journey") return true;
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
      (stage === TUTORIAL_STAGE.FIRST_BATTLE && ["battle", "assembly"].includes(this.screen)) ||
      (stage === TUTORIAL_STAGE.BUY_FIRST_PART &&
        this.screen === "assembly") ||
      (stage === TUTORIAL_STAGE.SECOND_BATTLE && ["battle", "assembly"].includes(this.screen));
    const hidden = completed || !visibleOnScreen || (this.screen === "battle" && this.simulation?.phase === "finished");
    card.classList.toggle("is-hidden", hidden);
    this.root.querySelector(".game-shell").dataset.tutorialStage = completed
      ? TUTORIAL_STAGE.COMPLETE
      : stage;
    if (hidden) return;

    const content = {
      [TUTORIAL_STAGE.FIRST_BATTLE]: {
        progress: "新手训练 · 1/3",
        title: "先把木质陀螺转起来",
        copy: "先完成一场训练，胜负都能拿到首件零件的赏金。",
        action: "返回训练场",
      },
      [TUTORIAL_STAGE.BUY_FIRST_PART]: {
        progress: "新手训练 · 2/3",
        title: "用赏金解锁第一个零件",
        copy: this.activeSlot ? "比较下方零件，再决定是否购买。金币标记表示可购买，确认后才扣款并装备。" :
          "先选一个部位看看。用首战赏金买一件零件，观察配置取舍，再打一场。",
        action: this.activeSlot ? null : "查看首件零件",
      },
      [TUTORIAL_STAGE.SECOND_BATTLE]: {
        progress: "新手训练 · 3/3",
        title: "验证你的第一次改装",
        copy: `${buildChangeSummary(this.state.battleNotes[this.state.loadouts[this.state.activeLoadoutIndex].id],
          this.state.loadouts[this.state.activeLoadoutIndex])}。这是理论评分变化，再打一场观察实际表现。`,
        action: "使用新零件出战",
      },
    }[stage];
    if (this.screen === "battle") {
      const cue = trainingCue({
        phase: this.simulation?.phase, steered: this.trainingSteered,
        spinHarvested: this.simulation?.player.stats.spinHarvested ?? 0,
        zone: this.simulation?.driveZone, second: stage === TUTORIAL_STAGE.SECOND_BATTLE,
      });
      content.title = cue.title;
      content.copy = cue.copy;
      this.trainingCueId = cue.id;
    }
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

  _setMapMode(mode) {
    this.mapMode = mode === "story" ? "story" : "free";
    if (this.mapMode === "free") this._setPreparation(null);
    this.root.querySelector(".game-shell").dataset.mapMode = this.mapMode;
    this.root.querySelectorAll(".journey-modes button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.mapMode === this.mapMode));
    });
    if (this.mapMode === "story") {
      renderCampaign(this);
      this.selectedArena = getArena(getMission(this.viewMissionId).arenaId);
      this.root.querySelector("#campaign-panel").scrollTop = 0;
    } else {
      this.selectedArena = getArena(this.state.arenaId);
      const button = this.root.querySelector("#start-battle");
      button.disabled = false;
      button.textContent = "准备发射 →";
      this._renderMaps();
      requestAnimationFrame(() => this._centerArenaCard(
        this.root.querySelector(`.arena-card[data-arena="${this.selectedArena.id}"]`), "auto"));
    }
    this.stage.showArena(this.selectedArena);
    this.root.querySelector(".game-shell").dataset.arena = this.selectedArena.id;
    this.root.querySelector("#stage-title").textContent = this.selectedArena.shortName;
    if (this.screen === "map") history.replaceState(null, "", this.mapMode === "story" ? "#journey" : "#map");
  }

  _selectArena(arenaId) {
    if (this.screen !== "map" || this.mapMode === "story") return;
    if (!arenaId || arenaId === this.selectedArena.id) return;
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
    if (this.screen === "map") {
      this.root.querySelector("#stage-title").textContent =
        this.selectedArena.shortName;
    }
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

  _commitBuild({ animatePart = false } = {}) {
    this.playerBuild = calculateBuild(
      this.state.build,
      this.state.customizations,
    );
    this._save();
    this._renderAssembly();
    if (animatePart && this.screen === "assembly" && this.activeSlot) {
      this.stage.replaceAssemblyPart(
        this.state.loadouts,
        this.state.activeLoadoutIndex,
        this.activeSlot,
      );
    } else {
      this.stage.showAssembly(
        this.state.loadouts,
        this.state.activeLoadoutIndex,
        this.activeSlot,
      );
    }
    this.audio.playUi();
  }

  get preparingMission() {
    return this.state.tutorial.completed && canPlayMission(this.state.campaign, this.preparingMissionId)
      ? getMission(this.preparingMissionId) : null;
  }

  _setPreparation(id) {
    this.preparingMissionId = this.state.tutorial.completed && canPlayMission(this.state.campaign, id) ? id : null;
    try {
      if (this.preparingMissionId) sessionStorage.setItem(PREPARATION_KEY, this.preparingMissionId);
      else sessionStorage.removeItem(PREPARATION_KEY);
    } catch (error) { console.warn("约战返回目标仅保留到本次刷新前。", error); }
  }

  goTo(screen) {
    const preparation = ["assembly", "lab", "collection"];
    if (preparation.includes(screen)) {
      if (this.screen === "map" && this.mapMode === "story") this._setPreparation(this.viewMissionId);
      else if (this.screen === "battle" && this.activeEncounter) this._setPreparation(this.activeEncounter.missionId);
    }
    if (screen === "journey" && preparation.includes(this.screen) && this.preparingMission) {
      this.viewMissionId = this.preparingMission.id;
    }
    this.root.querySelector("#battle-pause-dialog").close();
    this._clearBattleInput();
    this.paused = false;
    const journey = screen === "journey";
    if (journey) screen = "map";
    if (screen !== "battle") {
      this.activeEncounter = null;
      this.campaignResult = null;
      this.simulation = null;
    }
    if (this.screen === "lab" && screen !== "lab") this.labScreen?.leave();
    if (this.screen === "collection" && screen !== "collection") this.showroomScreen?.leave();
    if (screen === "lab" || screen === "collection") {
      this.simulation = null;
      this.labScreen ??= new LabScreen(this);
      if (screen === "collection") this.showroomScreen ??= new ShowroomScreen(this);
    } else if (screen === "map") {
      this._setMapMode(journey ? "story" : "free");
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
    if (screen === "lab") this.labScreen.enter();
    if (screen === "collection") this.showroomScreen.enter();
    this.root.querySelector("#go-map").textContent = this.preparingMission
      ? `返回约战 · ${this.preparingMission.opponent} →` : !this.state.tutorial.completed &&
        this.state.tutorial.stage !== TUTORIAL_STAGE.BUY_FIRST_PART ? "返回训练场 →" : "故事远征 / 对战 →";
    const route = journey ? "journey" : screen;
    if (location.hash !== `#${route}`) history.replaceState(null, "", `#${route}`);
    shell.dataset.arena = this.selectedArena.id;
    if (screen !== "battle") {
      this.root.querySelector("#launch-controls").classList.add("is-hidden");
      this.root.querySelector("#battle-controls").classList.add("is-hidden");
      this.root.querySelector("#result-card").classList.add("is-hidden");
      this.root.querySelector("#result-card").classList.remove("is-victory");
      this._showVictoryCelebration(false);
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
      .querySelector("#battle-topbar")
      .classList.toggle("is-hidden", screen !== "battle");
    if (screen !== "battle") {
      this.root.querySelector("#top-influence").classList.add("is-hidden");
    }
    this.root
      .querySelector("#tune-open")
      .classList.toggle("is-hidden", screen !== "battle");
    const caption = {
      assembly: ["ASSEMBLY / 01", "五层结构实验"],
      map: ["ARENA / 02", this.selectedArena.shortName],
      battle: ["BATTLE / 03", this.selectedArena.shortName],
      lab: ["TOP TEST LAB", "陀螺测试实验室"],
      collection: ["TOP COLLECTION", "陀螺陈列室"],
    }[screen];
    this.root.querySelector("#stage-kicker").textContent = caption[0];
    this.root.querySelector("#stage-title").textContent = caption[1];
    this._renderTutorial();
    this.audio.playUi();
  }

  _prepareBattle() {
    this._setPreparation(null);
    this._clearBattleInput();
    this.root.querySelector("#battle-pause-dialog").close();
    this.resultCoachSlot = null;
    this.trainingSteered = false;
    this.trainingCueId = null;
    const mission = getMission(this.activeEncounter?.missionId);
    const firstBattle =
      !mission && this.state.tutorial.stage === TUTORIAL_STAGE.FIRST_BATTLE;
    if (mission) {
      this.selectedArena = getArena(mission.arenaId);
      this.activeEncounter = {
        missionId: mission.id,
        battleId: crypto.randomUUID(),
        loadout: structuredClone(this.state.loadouts[this.state.activeLoadoutIndex]),
      };
    }
    this.campaignResult = null;
    this.tutorialJustCompleted = false;
    if (firstBattle) {
      this.selectedArena = getArena("standard");
      this.state.arenaId = "standard";
    }
    const playerSelection = firstBattle ? DEFAULT_BUILD : this.state.build;
    const playerCustomizations = firstBattle
      ? {}
      : this.state.customizations;
    const battlePlayerBuild = calculateBuild(
      playerSelection,
      playerCustomizations,
    );
    const loadout = this.state.loadouts[this.state.activeLoadoutIndex];
    this.battleSnapshot = { id: loadout.id, build: structuredClone(playerSelection),
      customizations: structuredClone(playerCustomizations) };
    this.battleBaseline = this.state.battleNotes[loadout.id] ?? null;
    const enemySelection = mission ? mission.enemyBuild : firstBattle
      ? DEFAULT_BUILD
      : ENEMY_BUILDS[this.selectedArena.id] ?? ENEMY_BUILDS.standard;
    const identity = opponentIdentity(mission, this.selectedArena.id);
    const enemyBuild = calculateBuild(enemySelection, identity.customizations);
    this.simulation = new BattleSimulation({
      playerBuild: battlePlayerBuild,
      enemyBuild,
      arena: this.selectedArena,
      seed: mission?.seed ?? 20260718,
      tuning: this.state.tuning,
      diagnostics: true,
      logger: (message, telemetry) => console.info(message, telemetry),
    });
    this.stage.prepareBattle(
      this.selectedArena,
      playerSelection,
      enemySelection,
      firstBattle ? TRAINING_COLORS : this.state.colors,
      playerCustomizations,
      identity,
    );
    this.paused = false;
    this.resultHandled = false;
    this.control = { x: 0, y: 0 };
    this.accumulator = 0;
    this.root.querySelector("#launch-controls").classList.remove("is-hidden");
    this.root.querySelector("#battle-controls").classList.add("is-hidden");
    this.root.querySelector("#result-card").classList.add("is-hidden");
    this.root.querySelector("#result-card").classList.remove("is-victory");
    this.root.querySelector("#campaign-result").classList.add("is-hidden");
    this.root.querySelector("#enemy-name").textContent = mission?.opponent ?? (firstBattle ? "训练对手" : "AI");
    const brief = this.root.querySelector("#campaign-brief");
    brief.classList.toggle("is-hidden", !this.state.tutorial.completed);
    brief.textContent = `${mission ? `${mission.opponent} / ${mission.topName} · ${mission.objectiveLabel}。` : ""}追逐亮起的 A/B/C 加速区；撞开对手独享补转，破损不会修复。`;
    this._showVictoryCelebration(false);
    this.root.querySelector("#top-influence").classList.add("is-hidden");
    this.root.querySelector("#battle-pause-label").textContent = "返回";
    this.root.querySelector("#pause-battle").setAttribute("aria-label", "返回准备");
    this.root.querySelector("#battle-message").textContent = firstBattle
      ? "木质训练陀螺等待发射"
      : "等待发射参数";
    this._updateLaunchOutputs();
    this._updateHud();
    this._renderTutorial();
  }

  async _launch() {
    if (!this.stage.arenaReady || this.simulation?.phase !== "ready") return;
    await this.audio.init();
    if (!this.stage.arenaReady || this.simulation?.phase !== "ready" || this.screen !== "battle") return;
    this.audio.setEnabled(this.state.sound);
    const { power, height, direction, angle } = this.launchParams;
    this.simulation.launch({ power, height, direction, angle });
    this.stage.launchBattleVisual();
    this.audio.playLaunch(power);
    this.root.querySelector("#battle-pause-label").textContent = "暂停";
    this.root.querySelector("#pause-battle").setAttribute("aria-label", "暂停战斗");
    this.root.querySelector("#launch-controls").classList.add("is-hidden");
    this.root.querySelector("#battle-controls").classList.remove("is-hidden");
    this.root.querySelector("#battle-message").textContent =
      "拖动摇杆微调轨迹";
    this._renderTutorial();
  }

  _togglePause() {
    if (this.simulation?.phase === "ready") {
      this.goTo(this.activeEncounter ? "journey" : this.state.tutorial.completed ? "map" : "assembly");
      return;
    }
    this._setPaused(!this.paused);
  }

  _clearBattleInput() {
    this.keys.clear();
    this.control = { x: 0, y: 0 };
    this.joystickActive = false;
    const joystick = this.root.querySelector("#joystick");
    if (this.joystickPointerId != null && joystick.hasPointerCapture(this.joystickPointerId)) {
      joystick.releasePointerCapture(this.joystickPointerId);
    }
    this.joystickPointerId = null;
    joystick.classList.remove("is-active");
    this.root.querySelector("#joystick-knob").style.transform = "translate(-50%, -50%)";
    this.root.querySelector("#joystick-input-power").textContent = "0";
  }

  _setPaused(paused) {
    if (this.screen !== "battle" || this.simulation?.phase !== "running") return;
    this.paused = paused;
    this._clearBattleInput();
    this.accumulator = 0;
    this.lastTime = performance.now();
    const dialog = this.root.querySelector("#battle-pause-dialog");
    if (paused && !dialog.open) dialog.showModal();
    if (!paused) {
      dialog.close();
      this.root.querySelector("#pause-battle").focus();
    }
    this.root.querySelector("#battle-pause-label").textContent = this.paused
      ? "继续"
      : "暂停";
    this.root.querySelector("#battle-message").textContent = this.paused
      ? "模拟已暂停"
      : "正在计算碰撞与转速";
  }

  _updateLaunchOutputs() {
    this.root.querySelector("#launch-power-output").value =
      `${Math.round(this.launchParams.power * 100)}%`;
    this.root.querySelector("#launch-direction-output").value =
      `${Math.round((this.launchParams.direction * 180) / Math.PI)}°`;
    this.root.querySelector("#launch-angle-output").value =
      `${Math.round((this.launchParams.angle * 180) / Math.PI)}°`;
    this.stage.updateLauncherPreview(this.launchParams);
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
      if (event.type === "collision" || event.type === "obstacle") {
        this.stage.spawnImpact(event.position, event.intensity);
        this.audio.playCollision(event.intensity);
        this.root.querySelector("#battle-message-kicker").textContent =
          event.intensity > 0.58 ? "HEAVY IMPACT" : "CONTACT";
        this.root.querySelector("#battle-message").textContent =
          `${event.type === "obstacle" ? "石墩碰撞" : "碰撞冲量"} ${event.impulse.toFixed(2)}`;
      }
      if (event.type === "drive_zone") {
        this.root.querySelector("#battle-message").textContent = event.cooling
          ? "加速区冷却，准备转移"
          : `${event.id} 区开始供能，抢占可补充转速`;
      }
      if (
        event.actor === "player" &&
        ["stability", "ring_out_risk", "spin_risk"].includes(event.type)
      ) {
        this.audio.playRisk(event.type, event.state);
        if (event.state === "critical") navigator.vibrate?.([22, 26, 22]);
        const messages = {
          stability: {
            wobble: this.simulation.player.structure.imbalance > 0.2
              ? "零件破损导致持续失衡，加速区不能修复"
              : "陀螺开始失衡，降低操控幅度可帮助恢复",
            critical: "倾斜危机：正在擦地并加速掉转",
            stable: "姿态已恢复稳定",
          },
          ring_out_risk: {
            warning: "靠近护圈，注意外向速度",
            critical: "Ring Out 风险极高",
            safe: "已离开出界危险区",
          },
          spin_risk: {
            warning: "转速进入衰退区",
            critical: "转速过低，控制影响快速下降",
            safe: "转速状态恢复",
          },
        };
        this.root.querySelector("#battle-message").textContent =
          messages[event.type]?.[event.state] ?? "风险状态变化";
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
      this.tutorialJustCompleted = true;
    }
    if (this.activeEncounter) {
      this.campaignResult = settleMission(this.state.campaign, {
        ...this.activeEncounter,
        result: this.simulation.result,
        durabilityRatio: this.simulation.player.durability / this.simulation.player.build.durability,
      });
      if (this.campaignResult.ok) this.state.campaign = this.campaignResult.campaign;
    }
    this.root.querySelector("#result-comparison").innerHTML =
      renderBuildComparison(this.battleBaseline, this.battleSnapshot);
    this.state.battleNotes = normalizeBattleNotes({
      ...this.state.battleNotes,
      [this.battleSnapshot.id]: { ...this.battleSnapshot, time, winner },
    });
    this._save();
    this._renderPersistentState();
    this._renderTutorial();
    this.audio.playResult(won, reason);
    this.stage.finishBattleVisual(this.simulation);
    this.root.querySelector("#result-kicker").textContent =
      `BATTLE COMPLETE · +${reward}`;
    this.root.querySelector("#result-title").textContent = won
      ? RESULT_LABELS[reason]
      : "本回合失败";
    this.root.querySelector("#result-copy").textContent =
      tutorialStage === TUTORIAL_STAGE.FIRST_BATTLE
        ? `${time.toFixed(1)} 秒 · 已获得 ${reward} 金币，下一步去解锁你的第一个零件。`
        : `${time.toFixed(1)} 秒 · ${won ? "你的配置完成了验证。" : `对手通过${RESULT_LABELS[reason]}结束回合。`}`;
    const outcome = this.simulation.result;
    const loserLabel = won ? (getMission(this.activeEncounter?.missionId)?.topName ?? "对手") : "你的陀螺";
    this.root.querySelector("#result-cause").textContent =
      outcome.cause === "structural_spin_out"
        ? `${loserLabel}带伤失速：${outcome.weakestPartName}受损，持续偏心与擦地耗尽转速。`
        : reason === BATTLE_RESULT.BREAK ? `${loserLabel}结构失效，${outcome.weakestPartName}已无法承载冲击。`
          : reason === BATTLE_RESULT.RING_OUT ? `${loserLabel}越过边界，碰撞后的动量决定了这一局。`
            : reason === BATTLE_RESULT.TIME ? "时间到，按剩余转速与结构完整度判定。"
              : `${loserLabel}先耗尽转速。抢区补转与保持结构完整，都能延长下一局的续航。`;
    const coach = battleCoach(outcome, this.simulation.player);
    this.resultCoachSlot = tutorialStage === TUTORIAL_STAGE.FIRST_BATTLE ? null : coach.slot;
    this.root.querySelector("#result-coach").textContent = tutorialStage === TUTORIAL_STAGE.FIRST_BATTLE
      ? "训练赏金已到账。去改装台查看并购买你的第一个零件，再试一次。" : coach.text;
    this.root.querySelector("#result-details").open = false;
    const report = this.root.querySelector("#result-telemetry");
    report.replaceChildren();
    for (const [label, actor] of [["你", this.simulation.player], ["对手", this.simulation.enemy]]) {
      const row = document.createElement("p");
      row.textContent = `${label} · 占区 ${actor.stats.zoneSeconds.toFixed(1)}s · 补转 ${actor.stats.spinHarvested.toFixed(1)} · 完整 ${Math.round(actor.structure.integrity * 100)}%`;
      report.append(row);
    }
    const highlight = document.createElement("p");
    highlight.textContent = `正面交锋 ${this.simulation.player.stats.hits} 次 · 最强冲量 ${this.simulation.player.stats.peakImpulse.toFixed(1)}`;
    report.append(highlight);
    const damageReport = document.createElement("details");
    const damageSummary = document.createElement("summary");
    damageSummary.textContent = "查看双方零件损伤";
    damageReport.append(damageSummary);
    for (const [label, actor] of [["你", this.simulation.player], ["对手", this.simulation.enemy]]) {
      const line = document.createElement("p");
      line.textContent = `${label} · 各零件最重局部损伤：${actor.structure.parts.map((part) =>
        `${PART_TYPE_META[part.slot].name} ${Math.round(part.worst * 100)}%`).join(" / ")}`;
      damageReport.append(line);
    }
    report.append(damageReport);
    this.root.querySelector("#result-reward").textContent = String(reward);
    this.root
      .querySelector("#result-card")
      .classList.toggle("is-victory", won);
    const assemblyButton = this.root.querySelector("#result-assembly");
    const restartButton = this.root.querySelector("#result-restart");
    restartButton.textContent = this.activeEncounter
      ? (this.campaignResult?.cleared ? (nextMission(this.state.campaign) ? "继续旅程" : "查看旅途纪念") : "再次挑战")
      : this.tutorialJustCompleted ? "开启故事远征" : "再次对战";
    const narrative = this.root.querySelector("#campaign-result");
    narrative.replaceChildren();
    narrative.classList.toggle("is-hidden", !this.campaignResult?.ok);
    if (this.campaignResult?.ok) {
      const mission = getMission(this.activeEncounter.missionId);
      const story = document.createElement("p");
      story.textContent = this.campaignResult.story;
      const memory = document.createElement("p");
      memory.textContent = this.campaignResult.firstClear ? `获得纪念：${mission.memory}` :
        this.campaignResult.cleared ? "本关已完成，纪念不会重复领取。" : "本关尚未通过。可以改装后再战，或先回远征查看情报。";
      const challenge = document.createElement("p");
      challenge.textContent = `${this.campaignResult.mastered ? "挑战达成" : "挑战未达成"}：${mission.challenge.label}（选做）`;
      const back = document.createElement("button");
      back.className = "journey-link";
      back.dataset.go = "journey";
      back.textContent = "返回远征";
      narrative.append(story, memory, challenge, back);
      const moment = this.campaignResult.firstClear && chapterMoment(mission.id);
      if (moment) {
        const bridge = document.createElement("p");
        bridge.className = "chapter-moment";
        bridge.textContent = `${moment.speaker} · ${moment.title}：${moment.text}`;
        narrative.insertBefore(bridge, back);
        restartButton.textContent = moment.nextLabel;
      }
    }
    assemblyButton.textContent =
      tutorialStage === TUTORIAL_STAGE.FIRST_BATTLE
        ? "前往改装台"
        : this.resultCoachSlot ? `检查${PART_TYPE_META[this.resultCoachSlot].name}` : "返回改装";
    restartButton.classList.toggle(
      "is-hidden",
      tutorialStage === TUTORIAL_STAGE.FIRST_BATTLE,
    );
    this.root.querySelector("#battle-controls").classList.add("is-hidden");
    this.root.querySelector("#top-influence").classList.add("is-hidden");
    // Let the actual finishing pose read before the report covers the arena.
    const finishedSimulation = this.simulation;
    const reveal = () => {
      if (this.screen !== "battle" || this.simulation !== finishedSimulation) return;
      this.root.querySelector("#result-card").classList.remove("is-hidden");
      this._showVictoryCelebration(won);
    };
    if (this.stage.reducedMotion) reveal();
    else setTimeout(reveal, 850);
  }

  _showVictoryCelebration(visible) {
    const celebration = this.root.querySelector("#victory-celebration");
    celebration.classList.toggle("is-hidden", !visible);
    if (!visible) {
      celebration.replaceChildren();
      return;
    }
    const colors = ["#ffd23f", "#37a8ff", "#f45b2a", "#55dac0", "#ffffff"];
    const bursts = [18, 50, 82]
      .map((x, burstIndex) => {
        const sparks = Array.from({ length: 12 }, (_, index) => {
          const angle = index * 30 + burstIndex * 7;
          return `<i style="--angle:${angle}deg;--spark:${colors[(index + burstIndex) % colors.length]}"></i>`;
        }).join("");
        return `<span class="firework" style="--x:${x}%;--delay:${burstIndex * 0.18}s">${sparks}</span>`;
      })
      .join("");
    const confetti = Array.from({ length: 38 }, (_, index) => {
      const left = (index * 37) % 100;
      const delay = ((index * 13) % 19) / 20;
      const drift = ((index % 7) - 3) * 16;
      const turn = 280 + (index % 5) * 90;
      return `<b class="confetti" style="--left:${left}%;--delay:${delay}s;--drift:${drift}px;--turn:${turn}deg;--confetti:${colors[index % colors.length]}"></b>`;
    }).join("");
    celebration.innerHTML = bursts + confetti;
  }

  _updateHud() {
    if (!this.simulation) return;
    const { player, enemy, time } = this.simulation;
    if (!this.state.tutorial.completed && this.screen === "battle" && this.simulation.phase === "running") {
      const cue = trainingCue({ phase: "running", steered: this.trainingSteered,
        spinHarvested: player.stats.spinHarvested, zone: this.simulation.driveZone });
      if (cue.id !== this.trainingCueId) this._renderTutorial();
    }
    this.root.querySelector("#player-spin").textContent =
      `${Math.round(player.spin)} 转速`;
    this.root.querySelector("#enemy-spin").textContent =
      `${Math.round(enemy.spin)} 转速`;
    this.root.querySelector("#player-durability-bar").style.width =
      `${(player.durability / player.build.durability) * 100}%`;
    this.root.querySelector("#enemy-durability-bar").style.width =
      `${(enemy.durability / enemy.build.durability) * 100}%`;
    for (const [id, top] of [["player", player], ["enemy", enemy]]) {
      const node = this.root.querySelector(`#${id}-status`);
      const weakest = [...top.structure.parts].sort((a, b) => b.worst - a.worst)[0];
      const partName = PART_TYPE_META[weakest.slot].name;
      node.textContent = top.structure.imbalance > 0.2
        ? `${partName}受损 · 失衡 ${Math.round(top.structure.imbalance * 100)}%`
        : weakest.worst > .35 ? `${partName}局部受损 ${Math.round(weakest.worst * 100)}%`
          : `结构 ${Math.round(top.structure.integrity * 100)}%`;
      node.title = top.structure.parts.map((part) =>
        `${PART_TYPE_META[part.slot].name} ${Math.round(part.health * 100)}%`).join(" / ");
    }
    const zone = this.simulation.driveZone;
    const zoneHud = this.root.querySelector("#drive-zone-hud");
    const zoneLabel = zone.cooling ? "冷却" : `${zone.active?.id ?? "—"} 区供能`;
    const benefit = player.zone.contested ? "争夺中 · 供能分摊"
      : player.zone.id ? (player.spinLossRate > 0 ? "带伤掉转" : "正在补转")
        : enemy.zone.id ? "对手正在补转" : "进入亮区补转";
    zoneHud.textContent = `${zoneLabel} ${Math.ceil(zone.remaining)}s · ${this.paused ? "已暂停" : benefit}`;
    zoneHud.dataset.contested = String(player.zone.contested);
    zoneHud.hidden = this.simulation.phase === "finished";
    this.root.querySelector("#battle-time").textContent = time.toFixed(1);
    this.root.querySelector("#surface-chip").textContent =
      player.surfaceName || this.selectedArena.surfaceAt(0).name;
    const influence = Math.round((player.controlInfluence ?? 0) * 100);
    const influenceBadge = this.root.querySelector("#top-influence");
    const screenPosition = this.stage.getPlayerScreenPosition();
    const showInfluence =
      this.simulation.phase === "running" && Boolean(screenPosition);
    influenceBadge.classList.toggle("is-hidden", !showInfluence);
    if (showInfluence) {
      influenceBadge.style.left =
        `${clamp(screenPosition.x, 58, screenPosition.width - 58)}px`;
      influenceBadge.style.top =
        `${clamp(screenPosition.y - 54, 104, screenPosition.height - 154)}px`;
      this.root.querySelector("#top-influence-value").textContent =
        `${influence}%`;
    }
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
        const control = this._keyboardControl();
        if (Math.hypot(control.x, control.y) > .15) this.trainingSteered = true;
        this.simulation.step(FIXED_STEP, control);
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
    if (this.screen === "lab") this.labScreen.update(delta);
    else if (this.screen === "collection") this.showroomScreen.update(delta);
    else this.stage.update(delta, this.simulation, this.paused);
    requestAnimationFrame((nextTime) => this._tick(nextTime));
  }

  _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  }
}

new BeybladeApp(document.querySelector("#app"));
