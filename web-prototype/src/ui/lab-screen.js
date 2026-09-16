import { LabStage } from "../render/lab-stage.js";
import { calculateBuild } from "../core/assembly-calculator.js";
import { completeLabTest, LAB_MODES, labLevel, measureBuild, TERRAIN_OPTIONS, WIND_OPTIONS, WIND_PRESETS, windParameters } from "../core/lab-state.js";
import { PARTS, PART_TYPE_META, getPart } from "../data/parts.js";
import { getPartAccess, purchasePart } from "../core/progression.js";
import "./lab.css";

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const iconPaths = {
  lab: '<path d="M9 3h6M10 3v6l-6 10q-1 2 2 2h12q3 0 2-2L14 9V3M8 15h8"/><circle cx="12" cy="17" r="1"/>',
  top: '<path d="m12 3 3 4 6 3-3 6-6 5-6-5-3-6 6-3Z"/><path d="m3 10 9 4 9-4M12 14v7M8 8l4 2 4-2"/>',
  tools: '<path d="m4 3 5 5-2 2-5-5v5l4 3 3-1 9 9 3-3-9-9 1-3-3-4H5M17 3l4 4-5 5M3 21l5-5"/>',
  battle: '<path d="m3 3 5 1 12 14-3 3L4 8ZM21 3l-5 1-4 5M4 17l3 4 4-5M15 17l5-5"/>',
  shop: '<path d="M3 4h3l3 12h10l3-9H7"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
  folder: '<path d="M3 7V4h6l3 3h9v13H3Z"/><path d="M3 10h18"/>',
  settings: '<path d="m10 2 4 0 1 3 3 1 3 3-2 3 1 3-3 3-3-1-3 2-3-2v-3l-3-2 1-4 3-1Z"/><circle cx="12" cy="11" r="3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17v.5"/>',
  weight: '<path d="M5 8h14l2 13H3ZM9 8V5a3 3 0 0 1 6 0v3"/>',
  target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/>',
  balance: '<path d="M4 8a9 9 0 0 1 15-2l2 2M21 3v5h-5M20 16a9 9 0 0 1-15 2l-2-2M3 21v-5h5"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m5 5 14 14M5 19 19 5"/>',
  chevron: '<path d="m9 4 8 8-8 8"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8a5 5 0 1 0 0 8M9 5v3M9 16v3"/>',
  gem: '<path d="m3 8 4-5h10l4 5-9 13ZM3 8h18M7 3l5 18 5-18"/>',
};
export const labIcon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] ?? iconPaths.lab}</svg>`;
const timeLabel = (value) => new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export class LabScreen {
  constructor(app) {
    this.app = app;
    this.mode = "mass";
    this.progress = 0;
    this.busy = false;
    this.complete = false;
    this.lastDraw = 0;
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    this.root = document.createElement("section");
    this.root.className = "lab-view";
    this.root.setAttribute("aria-label", "陀螺测试实验室");
    app.root.querySelector(".game-shell").append(this.root);
    this.mount();
    try {
      this.stage = new LabStage(this.root.querySelector(".lab-scene"));
      this.stage.ready.then(() => {
        this.loaded = true;
        this.root.querySelector(".lab-loading").hidden = true;
        if (this.active) this.refresh();
      }).catch(() => this.assetError());
    } catch {
      this.assetError();
    }
  }

  get lab() { return this.app.state.lab; }
  get loadout() { return this.app.state.loadouts[this.app.state.activeLoadoutIndex]; }
  get build() { return this.app.playerBuild; }

  mount() {
    this.root.innerHTML = `
      <div class="lab-scene" aria-hidden="true"></div>
      <header class="lab-header">
        <div class="lab-title"><h1>陀螺测试实验室</h1><p>TOP TEST LAB</p></div>
        <div class="lab-wallets">
          <button data-lab="coins" title="金币与零件商店" aria-label="金币与零件商店">${labIcon("coin")}<b id="lab-coins">0</b><i>${labIcon("plus")}</i></button>
          <button data-lab="gems" title="钻石系统规划" aria-label="钻石系统规划">${labIcon("gem")}<b>0</b><i>${labIcon("plus")}</i></button>
        </div>
        <button class="lab-level" data-lab="level" aria-label="查看实验室等级">
          <span>实验室等级</span><strong id="lab-level">LV.1</strong><small id="lab-xp">0 / 120</small><progress id="lab-xp-bar" value="0" max="120"></progress>
        </button>
      </header>
      <aside class="lab-utilities" aria-label="实验室工具">
        ${[["records", "folder", "测试记录"], ["settings", "settings", "实验室设置"], ["help", "help", "帮助"]].map(([action, icon, title]) =>
          `<button data-lab="${action}" aria-label="${title}"><span>${labIcon(icon)}</span><small>${title}</small></button>`).join("")}
      </aside>
      <div class="lab-loading" role="status"><span>正在准备实验台</span><small>载入仪器与当前陀螺</small></div>
      <div class="lab-inspect-toolbar" role="group" aria-label="观察视角">
        <button data-view="front" aria-pressed="true">近景</button>
        <button data-view="top" aria-pressed="false">俯视</button>
        <button data-lab="wind" aria-expanded="false">风场 <span class="lab-wind-summary"></span></button>
      </div>
      <section class="lab-wind-controls" aria-label="风场参数" hidden>
        <label>风速 <output id="lab-wind-speed">0.0 m/s</output><input aria-label="风速" data-setting="windSpeed" type="range" min="0" max="12" step="0.5"></label>
        <label>流向 <output id="lab-wind-direction">0°</output><input aria-label="风向" data-setting="windDirection" type="range" min="0" max="360" step="15"></label>
        <small>流向：0° 向北 · 90° 向东，箭头指向下风侧</small>
      </section>
      <div class="lab-overhead-values" aria-live="polite" hidden></div>
      <div class="lab-motion-readout"><span>演示转速 <b id="lab-rpm">0</b> RPM</span><span>倾斜 <b id="lab-lean">0.0</b>°</span><span>偏移 <b id="lab-drift">0.000</b></span></div>
      <div class="lab-caption"><span id="lab-sample-name">主力</span><small>配置估算 · 游戏单位</small></div>
      <div class="lab-console">
        <div class="lab-primary-row">
          <button class="lab-start" data-lab="test" disabled><b>开始测试</b><small>START TEST</small></button>
          <button class="lab-calibrate" data-lab="calibrate">${labIcon("balance")}<span>校准设备</span></button>
        </div>
        <div class="lab-test-modes" role="group" aria-label="测试类型">
          ${LAB_MODES.map((mode, i) => `<button data-mode="${mode.id}" aria-pressed="${i === 0}">${labIcon(["weight", "target", "balance"][i])}<span>${mode.name}<small>${mode.en}</small></span></button>`).join("")}
        </div>
        <div class="lab-loadouts" aria-label="测试陀螺">
          <button class="lab-arrow previous" data-lab="previous" aria-label="上一个陀螺">${labIcon("chevron")}</button>
          <div class="lab-loadout-list"></div>
          <button class="lab-arrow" data-lab="next" aria-label="下一个陀螺">${labIcon("chevron")}</button>
        </div>
        <nav class="lab-nav" aria-label="游戏导航">
          ${[["collection", "top", "陀螺库", "COLLECTION"], ["assembly", "tools", "改装台", "CUSTOMIZE"], ["lab", "lab", "测试室", "LAB"], ["battle", "battle", "对战", "BATTLE"], ["shop", "shop", "商店", "SHOP"]].map(([action, icon, title, en]) =>
            `<button data-lab="${action}" ${action === "lab" ? 'aria-current="page"' : ""}>${labIcon(icon)}<span>${title}</span><small>${en}</small></button>`).join("")}
        </nav>
      </div>
      <output class="lab-accessible-readout sr-only" aria-live="polite"></output>
      <div class="lab-notice" role="status" hidden></div>
      <dialog class="lab-dialog"><header><h2></h2><button data-lab="close" aria-label="关闭面板">${labIcon("close")}</button></header><div class="lab-dialog-content"></div></dialog>
    `;
    this.dialog = this.root.querySelector("dialog");
    this.dialog.addEventListener("click", (event) => { if (event.target === this.dialog) this.closeSheet(); });
    this.dialog.addEventListener("close", () => { this.sheet = null; this.pendingPart = null; });
    this.root.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button || button.disabled) return;
      if (button.dataset.mode) this.selectMode(button.dataset.mode);
      if (button.dataset.view) this.setView(button.dataset.view);
      if (button.dataset.loadout !== undefined) this.selectLoadout(Number(button.dataset.loadout));
      if (button.dataset.part) this.confirmPart(button.dataset.part);
      if (button.dataset.lab) this.action(button.dataset.lab);
    });
    this.root.addEventListener("change", (event) => {
      const setting = event.target.dataset.setting;
      if (!setting) return;
      const value = event.target.type === "checkbox" ? event.target.checked
        : event.target.type === "range" ? Number(event.target.value) : event.target.value;
      if (setting === "room" && value === "advanced" && labLevel(this.lab.xp).level < 2) return;
      const settings = { ...this.lab.settings, [setting]: value, ...(setting === "wind" ? WIND_PRESETS[value] : {}) };
      const next = { ...this.lab, settings };
      if (!this.persist(next)) return;
      this.complete = false;
      this.stage?.setQuality(this.lab.settings.quality);
      this.stage?.setRoom(this.lab.settings.room);
      this.root.dataset.room=this.lab.settings.room;
      this.stage?.clearTrace();
      this.updateWindControls();
      this.draw();
    });
    this.root.addEventListener("input", (event) => {
      const setting = event.target.dataset.setting;
      if (setting === "windSpeed") this.root.querySelector("#lab-wind-speed").textContent = `${Number(event.target.value).toFixed(1)} m/s`;
      if (setting === "windDirection") this.root.querySelector("#lab-wind-direction").textContent = `${event.target.value}°`;
    });
  }

  assetError() {
    this.failed = true;
    this.root.querySelector(".lab-loading").innerHTML = "<span>实验台载入失败</span><small>请刷新页面重试，已有配置仍保留。</small>";
    this.root.querySelector('[data-lab="test"]').disabled = true;
  }

  persist(next) {
    const old = this.lab;
    this.app.state.lab = next;
    try { this.app._save(); return true; }
    catch {
      this.app.state.lab = old;
      this.notify("本机存储不可用，本次结果未保存。");
      return false;
    }
  }

  enter() {
    this.active = true;
    if (this.stage) this.root.querySelector(".lab-scene").append(this.stage.renderer.domElement);
    this.refresh();
    this.updateWindControls();
    requestAnimationFrame(() => this.stage?.resize());
  }

  leave() {
    this.active = false;
    this.busy = false;
    this.complete = false;
    this.closeSheet();
  }

  refresh() {
    this.buildSnapshot = calculateBuild(this.loadout.build, this.loadout.customizations);
    this.app.playerBuild = this.buildSnapshot;
    this.stage?.setSpecimen(this.loadout, this.build);
    this.stage?.setQuality(this.lab.settings.quality);
    this.stage?.setRoom(this.lab.settings.room);
    this.root.dataset.room=this.lab.settings.room;
    this.root.querySelector("#lab-sample-name").textContent = this.loadout.name;
    this.root.querySelector("#lab-coins").textContent = this.app.state.coins.toLocaleString();
    const level = labLevel(this.lab.xp);
    this.root.querySelector("#lab-level").textContent = `LV.${level.level}`;
    this.root.querySelector("#lab-xp").textContent = `${level.current} / ${level.required}`;
    const bar = this.root.querySelector("#lab-xp-bar");
    bar.max = level.required;
    bar.value = level.current;
    const list = this.root.querySelector(".lab-loadout-list");
    list.innerHTML = this.app.state.loadouts.map((loadout, i) => `
      <button data-loadout="${i}" aria-pressed="${i === this.app.state.activeLoadoutIndex}" aria-label="选择${escapeHtml(loadout.name)}">
        <span class="lab-slot-number">0${i + 1}</span><em>${i === this.app.state.activeLoadoutIndex ? "已选中" : ""}</em>
        <canvas aria-hidden="true"></canvas><b>${escapeHtml(loadout.name)}</b>
      </button>`).join("");
    if (this.stage) this.stage.renderThumbnails(this.app.state.loadouts, [...list.querySelectorAll("canvas")]);
    this.complete = false;
    this.updateButtons();
    this.draw();
  }

  updateButtons() {
    this.root.querySelectorAll("[data-mode], [data-loadout], [data-lab='previous'], [data-lab='next'], [data-lab='settings'], [data-lab='calibrate']").forEach((button) => { button.disabled = this.busy; });
    this.root.querySelectorAll("[data-mode]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.mode === this.mode)));
    const start = this.root.querySelector(".lab-start");
    start.disabled = this.busy || !this.loaded;
    start.querySelector("b").textContent = this.busy
      ? `${this.calibrating ? "校准中" : "测试中"} ${Math.floor(this.progress * 100)}%`
      : this.complete ? "再次测试" : "开始测试";
    start.querySelector("small").textContent = this.busy ? "SCANNING" : "START TEST";
    this.root.querySelectorAll(".lab-wind-controls input").forEach((input) => { input.disabled = this.busy; });
  }

  selectMode(mode) {
    if (this.busy || !LAB_MODES.some((item) => item.id === mode)) return;
    this.mode = mode;
    this.complete = false;
    this.progress = 0;
    this.stage.clearTrace();
    this.updateButtons();
    this.draw();
  }

  selectLoadout(index) {
    if (this.busy) return this.notify("当前测试完成后可切换样本。");
    const length = this.app.state.loadouts.length;
    index = (index + length) % length;
    const previousIndex = this.app.state.activeLoadoutIndex;
    const previousLoadout = this.loadout;
    this.app.state.activeLoadoutIndex = index;
    const loadout = this.app.state.loadouts[index];
    Object.assign(this.app.state, { build: loadout.build, colors: loadout.colors, customizations: loadout.customizations });
    try { this.app._save(); }
    catch {
      Object.assign(this.app.state, {
        activeLoadoutIndex: previousIndex, build: previousLoadout.build,
        colors: previousLoadout.colors, customizations: previousLoadout.customizations,
      });
      return this.notify("本机存储不可用，样本切换未保存。");
    }
    this.closeSheet();
    this.refresh();
  }

  start(calibrating = false) {
    if (this.busy || !this.loaded) return;
    this.closeSheet();
    this.busy = true;
    this.calibrating = calibrating;
    this.complete = false;
    this.progress = 0;
    this.stage.clearTrace();
    this.updateButtons();
    this.draw();
  }

  update(delta) {
    if (!this.active || !this.stage) return;
    if (this.busy) {
      this.progress = Math.min(1, this.progress + delta / (this.calibrating ? 1.6 : 5.2));
      if (this.progress >= 1) {
        this.busy = false;
        if (this.calibrating) {
          if (this.persist({ ...this.lab, calibratedAt: Date.now() })) this.notify("基准自检完成，设备已就绪。");
        } else {
          const result = completeLabTest(this.lab, this.build, this.loadout, this.mode);
          const saved = this.persist(result.lab);
          this.refresh();
          this.complete = saved;
          this.progress = saved ? 1 : 0;
          if (this.sheet === "records") this.showRecords();
          if (saved) this.notify(result.gained ? `报告已保存 · 实验室经验 +${result.gained}` : "报告已保存 · 相同配置不重复获得经验");
        }
        this.calibrating = false;
        this.updateButtons();
        this.draw();
      }
      this.lastDraw += delta;
      if (this.lastDraw > 0.1) {
        this.updateButtons();
        this.draw();
        this.lastDraw = 0;
      }
    }
    const motion = this.stage.update(delta, {
      running: this.busy, progress: this.progress,
      rotate: this.lab.settings.autoRotate,
      showCenter: this.mode === "center" || this.lab.settings.showCenter,
      reducedMotion: this.reducedMotion.matches,
      settings: this.lab.settings, calibrating: this.calibrating,
    });
    this.root.querySelector("#lab-rpm").textContent = Math.round(motion.rpm);
    this.root.querySelector("#lab-lean").textContent = motion.lean.toFixed(1);
    this.root.querySelector("#lab-drift").textContent = motion.drift.toFixed(3);
  }

  draw() {
    if (!this.stage || !this.build) return;
    const mode = LAB_MODES.find((item) => item.id === this.mode);
    const metrics = measureBuild(this.build, this.mode, this.lab.settings);
    this.root.querySelector(".lab-overhead-values").innerHTML = metrics.map((m) =>
      `<span>${m.label}<b>${m.value.toFixed(m.decimals)}</b><small>${m.unit}</small></span>`).join("");
    const status = this.busy ? `${this.calibrating ? "基准校准" : "扫描样本"} · ${Math.floor(this.progress * 100)}%`
      : this.complete ? "测试完成 · 报告已保存" : "样本就绪 · 等待测试";
    this.stage.drawReadout({
      title: mode.title, metrics, status,
      note: this.mode === "balance" ? `${this.lab.settings.wind} / ${this.lab.settings.terrain}`
        : this.mode === "center" ? "黄色标记为质心 · 规则空间" : "当前配置估算 / 非实物 SI 测量",
      progress: this.progress, running: this.busy,
    });
    if (!this.busy) this.root.querySelector(".lab-accessible-readout").textContent =
      `${mode.name}：${metrics.map((m) => `${m.label} ${m.value.toFixed(m.decimals)} ${m.unit}`).join("，")}。${status}`;
  }

  notify(message) {
    const notice = this.root.querySelector(".lab-notice");
    notice.textContent = message;
    notice.hidden = false;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => { notice.hidden = true; }, 3000);
  }

  closeSheet() { if (this.dialog.open) this.dialog.close(); }

  showSheet(title, content, name) {
    this.sheet = name;
    this.dialog.querySelector("h2").textContent = title;
    this.dialog.querySelector(".lab-dialog-content").innerHTML = content;
    if (!this.dialog.open) this.dialog.showModal();
  }

  action(action) {
    if (action === "close") return this.closeSheet();
    if (action === "test") return this.start();
    if (action === "calibrate") return this.start(true);
    if (action === "next" || action === "previous") return this.selectLoadout(this.app.state.activeLoadoutIndex + (action === "next" ? 1 : -1));
    if (action === "assembly" || action === "battle") {
      if (this.busy) return this.notify("请等待当前检测完成。");
      this.app.goTo(action === "battle" ? "map" : "assembly");
      return;
    }
    if (action === "lab") return this.closeSheet();
    if (action === "wind") {
      const panel = this.root.querySelector(".lab-wind-controls");
      panel.hidden = !panel.hidden;
      this.root.querySelector('[data-lab="wind"]').setAttribute("aria-expanded", String(!panel.hidden));
      return;
    }
    if (action === "records") return this.showRecords();
    if (action === "settings") return this.showSettings();
    if (action === "shop" || action === "coins") return this.showShop();
    if (action === "buy") return this.buyPart();
    if (action === "collection") {
      if (this.busy) return this.notify("请等待当前检测完成。");
      return this.app.goTo("collection");
    }
    if (action === "export") return this.exportRecords();
    if (action === "gems") return this.showSheet("钻石", `<div class="lab-empty">${labIcon("gem")}<h3>钻石系统准备中</h3><p>钻石余额与入口已预留。获取、充值和消费将在后续版本接入。</p><span class="lab-tag">尚未开放</span></div>`, action);
    if (action === "level") {
      const level = labLevel(this.lab.xp);
      return this.showSheet("实验室等级", `<div class="lab-level-detail"><strong>LV.${level.level}</strong><p>累计经验 ${this.lab.xp} · 完成报告 ${this.lab.records.length}</p></div><h3>测试，让研究继续</h3><p>每个新配置的每种测试首次完成获得 30 经验。相同条件重复测试不会重复奖励。</p><p>距离下一等级还需 ${level.required - level.current} 经验。LV.2 可免费使用精密实验室与冠军展示舞台，在实验室设置中切换房间。房间外观不改变测量结果。</p>`, action);
    }
    if (action === "help") return this.showSheet("测试室使用指南", `
      <ol><li><b>选择陀螺</b><p>下方三张卡片与改装台共用出战配置，DIY 材料与外形会同步。</p></li>
      <li><b>选择测试</b><p>重量显示总质量与惯量；质心显示高度与偏心；平衡显示指定风力、地面的稳定性估算。</p></li>
      <li><b>开始测试</b><p>扫描结束后生成本机报告，并为首次完成的新配置增加经验。</p></li></ol>
      <h3>观察风场</h3><p>点击俯视查看上方视角，展开风场可设置风速与流向。开始测试后陀螺加速，随风产生倾斜与偏移；箭头与黄色轨迹展示影响。测试旋转不受自动展示旋转开关限制。</p>
      <h3>关于精度</h3><p>当前使用游戏平衡单位，未换算为克或毫米。5.2 秒检测、校准与风场是局部演示，未替代战斗物理求解；转速为演示转速，偏移为模型空间单位。左侧小仪表显示参考图形。</p>
      <h3>保存与后续系统</h3><p>最近 40 份报告、实验室等级和设置保存在当前浏览器，可导出报告。钻石与等级设备升级尚未开放。</p>`, action);
  }

  showRecords() {
    const rows = this.lab.records.map((record) => `<article class="lab-report">
      <div><b>${escapeHtml(record.name)} · ${LAB_MODES.find((m) => m.id === record.mode)?.name ?? "测试"}</b><time>${timeLabel(record.timestamp)}</time></div>
      <p>${record.metrics.map((m) => `${escapeHtml(m.label)} <strong>${Number(m.value).toFixed(Math.min(4, Math.max(0, Number(m.decimals) || 0)))}</strong>`).join(" / ")}</p>
      ${record.mode === "balance" ? `<small>${Number.isFinite(record.windSpeed) ? `${record.windSpeed.toFixed(1)} m/s · ${record.windDirection}°` : escapeHtml(record.wind)} · ${escapeHtml(record.terrain)}</small>` : ""}
    </article>`).join("");
    this.showSheet("测试记录", rows ? `<p>最近 ${this.lab.records.length} 份报告 · 保存在本机</p><button class="lab-sheet-action" data-lab="export">导出 JSON 报告</button>${rows}`
      : `<div class="lab-empty">${labIcon("folder")}<h3>还没有测试报告</h3><p>选好陀螺，完成一次测试，记录就会出现在这里。</p></div>`, "records");
  }

  showSettings() {
    const settings = this.lab.settings;
    this.showSheet("实验室设置", `
      <h3>测试环境</h3>
      <label class="lab-setting">实验室场景<select data-setting="room"><option value="childhood" ${settings.room === "childhood" ? "selected" : ""}>童年书桌 · 入门</option><option value="advanced" ${settings.room === "advanced" ? "selected" : ""} ${labLevel(this.lab.xp).level < 2 ? "disabled" : ""}>精密实验室 · LV.2</option></select></label>
      <label class="lab-setting">风力<select data-setting="wind">${WIND_OPTIONS.map((v) => `<option ${v === settings.wind ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label class="lab-setting">地面<select data-setting="terrain">${TERRAIN_OPTIONS.map((v) => `<option ${v === settings.terrain ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <h3>场景表现</h3>
      <label class="lab-setting">自动展示旋转<input type="checkbox" data-setting="autoRotate" ${settings.autoRotate ? "checked" : ""}></label>
      <label class="lab-setting">常驻质心标记<input type="checkbox" data-setting="showCenter" ${settings.showCenter ? "checked" : ""}></label>
      <label class="lab-setting">画面质量<select data-setting="quality"><option value="high" ${settings.quality === "high" ? "selected" : ""}>精细 · 阴影开启</option><option value="performance" ${settings.quality === "performance" ? "selected" : ""}>流畅 · 阴影关闭</option></select></label>
      <h3>设备校准</h3><p>${this.lab.calibratedAt ? `上次基准自检：${timeLabel(this.lab.calibratedAt)}` : "设备就绪，尚未执行基准自检。"}</p>
      <button class="lab-sheet-action" data-lab="calibrate">执行基准自检</button>`, "settings");
  }

  setView(view) {
    this.root.dataset.view = view;
    this.stage?.setView(view, this.reducedMotion.matches);
    this.root.querySelectorAll("[data-view]").forEach((button) => {
      if (button.tagName === "BUTTON") button.setAttribute("aria-pressed", String(button.dataset.view === view));
    });
    this.root.querySelector(".lab-overhead-values").hidden = view !== "top";
  }

  updateWindControls() {
    const wind = windParameters(this.lab.settings);
    this.root.querySelector('[data-setting="windSpeed"]').value = wind.speed;
    this.root.querySelector('[data-setting="windDirection"]').value = wind.direction;
    this.root.querySelector("#lab-wind-speed").textContent = `${wind.speed.toFixed(1)} m/s`;
    this.root.querySelector("#lab-wind-direction").textContent = `${wind.direction}°`;
    this.root.querySelector(".lab-wind-summary").textContent = `${wind.speed.toFixed(1)} m/s · ${wind.direction}°`;
  }

  showCollection() {
    this.showSheet("陀螺库", `<p>与改装台共用的三套出战配置</p>${this.app.state.loadouts.map((loadout, i) => {
      const build = calculateBuild(loadout.build, loadout.customizations);
      return `<article class="lab-collection-item"><span>0${i + 1}</span><div><h3>${escapeHtml(loadout.name)}</h3><p>${escapeHtml(getPart(loadout.build.attackRing).name)}</p><small>质量 ${build.totalMass.toFixed(2)} · 惯量 ${build.momentOfInertia.toFixed(3)}</small></div><button data-loadout="${i}" ${this.busy ? "disabled" : ""}>${i === this.app.state.activeLoadoutIndex ? "当前" : "选择"}</button></article>`;
    }).join("")}<button class="lab-sheet-action" data-lab="assembly">前往改装台</button>`, "collection");
  }

  showShop() {
    this.showSheet("零件商店", `<p class="lab-shop-wallet">${labIcon("coin")} 可用金币 <b>${this.app.state.coins}</b></p>
      <p>金币来自对战奖励。购买会解锁零件并装入当前陀螺。</p>
      ${Object.entries(PART_TYPE_META).map(([type, meta]) => `<h3>${meta.name}</h3>${PARTS.filter((p) => p.type === type).map((part) => {
        const access = getPartAccess(part, this.app.state);
        const equipped = this.app.state.build[type] === part.id;
        return `<article class="lab-shop-item"><div><b>${escapeHtml(part.name)}</b><small>${escapeHtml(part.description)}</small></div><button data-part="${part.id}" ${this.busy || equipped ? "disabled" : ""}>${equipped ? "已装备" : access.owned ? "装备" : `${part.price} 金币`}</button></article>`;
      }).join("")}`).join("")}`, "shop");
  }

  confirmPart(id) {
    const part = getPart(id);
    if (!part || this.busy) return;
    const access = getPartAccess(part, this.app.state);
    this.pendingPart = id;
    const candidate = calculateBuild({ ...this.app.state.build, [part.type]: id }, this.app.state.customizations);
    this.showSheet(access.owned ? "装备零件" : "解锁零件", `
      <h3>${escapeHtml(part.name)}</h3><p>${escapeHtml(part.description)}</p>
      <dl class="lab-part-diff"><dt>总质量</dt><dd>${this.build.totalMass.toFixed(2)} → ${candidate.totalMass.toFixed(2)}</dd><dt>转动惯量</dt><dd>${this.build.momentOfInertia.toFixed(3)} → ${candidate.momentOfInertia.toFixed(3)}</dd></dl>
      <p>${access.owned ? "已拥有此零件，可直接装备。" : access.affordable ? `价格 ${part.price} 金币 · 购买后余额 ${this.app.state.coins - part.price}` : `还差 ${access.missingCoins} 金币，可通过对战获取。`}</p>
      <button class="lab-sheet-action" data-lab="buy" ${!access.owned && !access.affordable ? "disabled" : ""}>${access.owned ? "确认装备" : "购买并装备"}</button>
      <button class="lab-sheet-secondary" data-lab="shop">返回商店</button>`, "purchase");
  }

  buyPart() {
    const part = getPart(this.pendingPart);
    if (!part || this.busy) return;
    const previous = JSON.parse(JSON.stringify(this.app.state));
    if (!this.app.state.ownedPartIds.includes(part.id)) {
      const result = purchasePart(this.app.state, part.id);
      if (!result.ok) return this.notify("金币不足或零件已拥有，请刷新商店。");
      Object.assign(this.app.state, result.progression);
    }
    const loadout = this.app.state.loadouts[this.app.state.activeLoadoutIndex];
    loadout.build[part.type] = part.id;
    this.app.state.build = loadout.build;
    if (this.app.state.tutorial.stage === "buy_first_part") this.app.state.tutorial.stage = "second_battle";
    try { this.app._save(); }
    catch {
      this.app.state = previous;
      const active = previous.loadouts[previous.activeLoadoutIndex];
      Object.assign(this.app.state, { build: active.build, colors: active.colors, customizations: active.customizations });
      return this.notify("无法保存购买结果，本次操作已取消。");
    }
    this.refresh();
    this.app._renderPersistentState();
    this.showShop();
    this.notify(`${part.name} 已装备`);
  }

  exportRecords() {
    const blob = new Blob([JSON.stringify({ version: 1, units: "game_balance", records: this.lab.records }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `spin-core-lab-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
