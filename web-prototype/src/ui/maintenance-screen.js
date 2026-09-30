import { MaintenanceStage } from "../render/maintenance-stage.js";
import { normalizeMaintenance, maintenanceForLoadout, oilKey, oilEffects,
  paintOil, OIL_ZONES } from "../core/maintenance-state.js";
import { runMaintenanceTrial } from "../core/maintenance-trial.js";
import { LAUNCHER_PARTS, LAUNCHER_SLOTS, normalizeLauncher, getLauncherPart,
  launcherKey } from "../core/launcher-state.js";
import { launcherLaunchState } from "../core/launcher-physics.js";
import { getPartAccess, purchasePart, tutorialAfterEquip } from "../core/progression.js";
import { paintLauncher } from "../render/launcher-model.js";
import "./maintenance.css";

const pct = n => `${Math.round(n * 100)}%`;
const signed = n => `${n > 0 ? "+" : ""}${n.toFixed(1)}`;

export class MaintenanceScreen {
  constructor(app) {
    this.app = app;
    this.root = document.createElement("section");
    this.root.className = "maintenance-view";
    this.root.hidden = true;
    this.root.setAttribute("aria-label", "组装工具");
    app.root.querySelector('[data-panel="assembly"]').append(this.root);
    this.root.innerHTML = `
      <header class="maintenance-header">
        <div><h1>保养</h1><p class="maintenance-name"></p></div>
        <button data-maintenance="cancel">撤回未保存修改</button>
      </header>
      <div class="maintenance-focus" role="group" aria-label="移近观察部件"></div>
      <div class="maintenance-console">
        <div class="launcher-outfit" hidden>
          <div class="launcher-slots" role="group" aria-label="更换部件槽位"></div>
          <div class="launcher-parts" role="group" aria-label="部件型号"></div>
          <p class="launcher-part-note"></p>
          <div class="launcher-equip-row"><span class="launcher-wallet"></span>
            <button data-maintenance="equip"></button></div>
          <div class="launcher-paints" role="group" aria-label="自由换色">
            <label>外壳<input type="color" data-paint="shell"></label>
            <label>装甲<input type="color" data-paint="accent"></label>
            <label>握柄<input type="color" data-paint="grip"></label>
            <button data-maintenance="red">红黑配色</button>
          </div>
        </div>
        <div class="maintenance-tools" role="group" aria-label="保养工具">
          <button data-tool="oil" aria-pressed="true">滴油</button>
          <button data-tool="wipe" aria-pressed="false">擦拭</button>
          <button data-tool="orbit" aria-pressed="false">环绕</button>
          <button data-maintenance="undo" disabled>撤销</button>
          <button data-maintenance="clean">擦净当前</button>
        </div>
        <label class="maintenance-dose">出油量
          <input type="range" min="1" max="3" step="1" value="2" aria-label="每次出油量">
          <output>适中</output>
        </label>
        <p class="maintenance-feedback" role="status">零件已自动展开，挑一处试试。</p>
        <div class="maintenance-readings" aria-label="当前保养效果"></div>
        <div class="maintenance-test-row">
          <button data-maintenance="trial">对照试拉</button>
          <p>抽拉输入 86% · 标准平面 · 滑行 3 秒<br>游戏平衡单位，试验不计奖励</p>
        </div>
        <div class="maintenance-trial" aria-live="polite" hidden></div>
        <details class="maintenance-help"><summary>操作与数值说明</summary>
          <p class="maintenance-touch-hint"></p><p class="maintenance-note"></p>
        </details>
      </div>
        <footer class="maintenance-footer">
          <span class="maintenance-draft">尚未保存</span>
          <button data-maintenance="continue"></button>
          <button class="maintenance-save" data-maintenance="save">保存保养</button>
        </footer>`;
    this.sceneTools = document.createElement("div");
    this.sceneTools.className = "maintenance-overlays";
    this.sceneTools.hidden = true;
    this.sceneTools.innerHTML = `<div class="maintenance-loading" role="status">正在展开零件…</div>
      <button class="maintenance-retry" hidden>重新载入模型</button><span class="maintenance-cross" aria-hidden="true"></span>`;
    app.root.querySelector("#three-stage").append(this.sceneTools);
    this.sceneTools.querySelector("button").addEventListener("click", () => this.action("retry"));
    this.root.querySelector(".launcher-slots").innerHTML = Object.entries(LAUNCHER_SLOTS).map(([id, label]) =>
      `<button data-launcher-slot="${id}">${label}</button>`).join("");
    this.root.querySelector(".launcher-parts").innerHTML = LAUNCHER_PARTS.map(p =>
      `<button data-launcher-part="${p.id}"><b>${p.code} ${p.name}</b><span></span></button>`).join("");
    this.root.addEventListener("click", e => {
      const button = e.target.closest("button");
      if (!button || button.disabled || button.getAttribute("aria-disabled") === "true") return;
      if (button.dataset.launcherSlot) this.selectSlot(button.dataset.launcherSlot);
      if (button.dataset.launcherPart) this.previewPart(button.dataset.launcherPart);
      if (button.dataset.target) this.selectTarget(button.dataset.target);
      if (button.dataset.focus !== undefined) this.stage?.frame(button.dataset.focus || null);
      if (button.dataset.tool) {
        this.stage?.setTool(button.dataset.tool);
        this.root.querySelectorAll("[data-tool]").forEach(b => b.setAttribute("aria-pressed", b === button));
      }
      if (button.dataset.maintenance) this.action(button.dataset.maintenance);
    });
    this.root.querySelector(".maintenance-dose input").addEventListener("input", e => {
      this.dose = Number(e.target.value);
      this.root.querySelector("output").textContent = ["少量", "适中", "较多"][this.dose - 1];
    });
    this.root.querySelectorAll("[data-paint]").forEach(input => input.addEventListener("input", () => {
      this.launcherDraft.colors[input.dataset.paint] = input.value;
      this.preview.colors = { ...this.launcherDraft.colors };
      if (this.stage?.model && this.kind === "launcher") paintLauncher(this.stage.model, this.preview.colors);
      this.refresh();
    }));
  }

  get loadout() { return this.app.state.loadouts[this.app.state.activeLoadoutIndex]; }
  get input() { return maintenanceForLoadout(this.draft, this.loadout, this.preview); }

  enter(target = "launcher", returnTo = "assembly") {
    if (this.stage) return this.selectTarget(target);
    this.root.hidden = false;
    this.sceneTools.hidden = false;
    this.returnTo = returnTo;
    this.root.dataset.room = this.app.state.lab.settings.room;
    if (!this.draft) {
      this.draft = normalizeMaintenance(this.app.state.maintenance);
      this.initial = structuredClone(this.draft);
      this.launcherInitial = normalizeLauncher(this.app.state.launcher, this.app.state.ownedPartIds);
      this.launcherDraft = structuredClone(this.launcherInitial);
      this.undo = [];
    }
    this.preview = structuredClone(this.launcherDraft);
    this.slot = "rack";
    this.dose = 2;
    this.root.querySelector(".maintenance-dose input").value = "2";
    this.root.querySelector("output").textContent = "适中";
    this.root.querySelector(".maintenance-name").textContent = `${this.loadout.name} · 随手涂抹，随时擦净`;
    this.root.querySelector(".maintenance-trial").hidden = true;
    this.root.querySelectorAll("[data-tool]").forEach(b => b.setAttribute("aria-pressed", b.dataset.tool === "oil"));
    this.stage = new MaintenanceStage(this.app.labScreen.stage, this.app.root.querySelector("#three-stage"), {
      controls: this.root,
      begin: () => { this.beforeStroke = structuredClone(this.draft); },
      paint: (hit, wipe) => this.paint(hit, wipe),
      end: rollback => this.endStroke(rollback),
      select: slot => { if (this.outfit && this.ready && LAUNCHER_SLOTS[slot]) this.selectSlot(slot); },
      loaded: () => {
        this.setLoading(false);
        this.refresh();
      },
      error: () => {
        this.setLoading(true, "实验台或模型未能载入，草稿仍保留。");
        this.sceneTools.querySelector(".maintenance-retry").hidden = false;
      },
    }, this.app.state.lab.settings);
    this.layoutObserver = new ResizeObserver(() => this.stage?.resize());
    this.layoutObserver.observe(this.root.querySelector(".maintenance-console"));
    this.selectTarget(target);
  }

  setLoading(loading, text = "正在展开零件…") {
    this.ready = !loading;
    const notice = this.sceneTools.querySelector(".maintenance-loading");
    notice.hidden = !loading; notice.textContent = text;
    this.sceneTools.querySelector(".maintenance-retry").hidden = true;
    this.root.querySelectorAll("[data-tool], [data-focus], [data-maintenance='trial'], [data-maintenance='equip'], [data-maintenance='save']")
      .forEach(b => { b.disabled = loading; });
    this.root.querySelectorAll("[data-launcher-slot], [data-launcher-part]")
      .forEach(b => b.setAttribute("aria-disabled", String(loading)));
  }

  selectTarget(kind) {
    this.stage.cancelGesture(true);
    this.outfit = kind === "outfit";
    this.kind = this.outfit ? "launcher" : kind;
    this.preview = structuredClone(this.launcherDraft);
    this.root.querySelector("h1").textContent = this.outfit ? "发射器" : this.kind === "top" ? "陀螺保养" : "发射器保养";
    this.root.querySelector(".launcher-outfit").hidden = !this.outfit;
    this.root.querySelectorAll(".maintenance-tools, .maintenance-dose").forEach(el => { el.hidden = this.outfit; });
    this.root.querySelector(".maintenance-save").textContent = this.outfit ? "保存换装" : "保存保养";
    this.root.querySelector(".maintenance-name").textContent = this.outfit
      ? `${this.loadout.name} · 选择部件，试拉比较` : `${this.loadout.name} · 随手涂抹，随时擦净`;
    this.root.querySelector(".maintenance-test-row p").innerHTML = this.outfit
      ? "抽拉输入 86% · 倾斜抽拉 · 标准平面<br>游戏平衡单位，试验不计奖励"
      : "抽拉输入 86% · 竖直抽拉 · 滑行 3 秒<br>游戏平衡单位，试验不计奖励";
    this.root.querySelector(".maintenance-touch-hint").textContent = this.outfit
      ? "点击零件选择槽位 · 拖动环绕 · 滚轮或双指缩放"
      : "直接拖动涂抹 · 双指或右键环绕 · 滚轮缩放";
    this.stage.setTool(this.outfit ? "select" : "oil");
    this.root.querySelectorAll("[data-tool]").forEach(b => b.setAttribute("aria-pressed", b.dataset.tool === "oil"));
    this.root.querySelectorAll("[data-target]").forEach(b =>
      b.setAttribute("aria-pressed", b.dataset.target === kind));
    const focus = this.kind === "launcher"
      ? [["", "全貌"], ["transmission", "传动"], ["rack", "齿条"], ["coupler", "连接头"], ["grip", "握柄"]]
      : [["", "全貌"], ["tip", "轴尖"], ["attackRing", "攻击环"], ["driverShaft", "中轴"]];
    this.root.querySelector(".maintenance-focus").innerHTML = focus.map(([id, label]) =>
      `<button data-focus="${id}">${label}</button>`).join("");
    this.root.querySelector(".maintenance-note").textContent = this.outfit
      ? "三件独立搭配，颜色不影响性能。预览不装备；装入草稿后保存，下一场生效。"
      : kind === "launcher"
      ? "传动适量润滑更顺畅，油过多会增加阻力；握柄沾油可能打滑。"
      : "轴尖沾油会降低抓地。其余固定零件可涂抹，活动机构后续补齐。";
    this.feedback(this.outfit ? "选择一款部件看效果，或点击内部零件移近观察。" :
      "零件自动展开。涂油看变化，也可以随时擦掉。");
    this.setLoading(true);
    void this.stage.load(this.kind, this.loadout, this.preview);
    this.refresh();
  }

  selectSlot(slot) {
    this.slot = slot;
    this.preview = structuredClone(this.launcherDraft);
    this.setLoading(true);
    void this.stage.swapLauncher(this.preview);
    this.stage.frame(slot);
    this.refresh();
  }

  previewPart(id) {
    this.preview = structuredClone(this.launcherDraft);
    this.preview.build[this.slot] = id;
    this.setLoading(true);
    void this.stage.swapLauncher(this.preview);
    this.feedback("正在预览；装入草稿后保存才会用于对战。");
    this.refresh();
  }

  refreshOutfit() {
    const part = getLauncherPart(this.preview.build[this.slot]);
    const access = getPartAccess(part, this.app.state);
    this.root.querySelectorAll("[data-launcher-slot]").forEach(b => {
      b.setAttribute("aria-pressed", String(b.dataset.launcherSlot === this.slot));
      b.setAttribute("aria-disabled", String(!this.ready));
    });
    this.root.querySelectorAll("[data-launcher-part]").forEach(b => {
      const p = getLauncherPart(b.dataset.launcherPart);
      b.hidden = p.slot !== this.slot;
      b.setAttribute("aria-pressed", String(part.id === p.id));
      b.setAttribute("aria-disabled", String(!this.ready));
      b.querySelector("span").textContent = this.launcherDraft.build[p.slot] === p.id ? "草稿已装" :
        this.app.state.ownedPartIds.includes(p.id) ? "已拥有" : `${p.price} 金币`;
    });
    this.root.querySelector(".launcher-part-note").textContent = part.note;
    this.root.querySelector(".launcher-wallet").textContent = `持有 ${this.app.state.coins} 金币`;
    const equip = this.root.querySelector('[data-maintenance="equip"]');
    const equipped = this.launcherDraft.build[this.slot] === part.id;
    equip.textContent = equipped ? "已在草稿中" : access.owned ? "装入草稿" :
      access.affordable ? `购买并装入 · ${part.price} 币` : `还差 ${access.missingCoins} 金币`;
    equip.disabled = !this.ready || equipped || (!access.owned && !access.affordable);
    this.root.querySelectorAll("[data-paint]").forEach(el => { el.value = this.launcherDraft.colors[el.dataset.paint]; });
    const state = launcherLaunchState(this.app.playerBuild, this.preview, { power: .86, height: .45, angle: .35 }, oilEffects(this.input));
    const t = state.launcherTelemetry;
    this.root.querySelector(".maintenance-readings").innerHTML = `
      <span>初始转速<b>${state.spin.toFixed(1)}</b></span>
      <span>抽拉负担<b>${pct(t.effort)}</b></span>
      <span>释放行程耗时<b>${t.releaseMs} ms</b></span>`;
  }

  samples() {
    return this.kind === "launcher" ? this.draft.launcher
      : Object.values(this.loadout.build).flatMap(id => this.draft.tops[oilKey(this.loadout, id)] ?? []);
  }

  paint(hit, wipe) {
    const key = this.kind === "top" ? oilKey(this.loadout, this.loadout.build[hit.slot]) : null;
    if (this.kind === "top" && !this.loadout.build[hit.slot]) return;
    const samples = key ? this.draft.tops[key] ?? [] : this.draft.launcher;
    const { slot, ...surface } = hit;
    const next = paintOil(samples, surface, [.07, .16, .32][this.dose - 1], wipe);
    if (key) this.draft.tops[key] = next; else this.draft.launcher = next;
    this.feedback(`${OIL_ZONES[hit.zone]} · ${wipe ? "正在擦拭" : "油膜已落在这里"}${
      hit.zone === "exterior" ? "，只留下油膜" : ""}`);
    if (!wipe && JSON.stringify(next) === JSON.stringify(samples))
      this.feedback("这里的油膜已足量，换个位置或用擦拭工具。");
    this.refresh();
  }

  endStroke(rollback) {
    if (!this.beforeStroke) return;
    if (rollback) this.draft = this.beforeStroke;
    else if (JSON.stringify(this.beforeStroke) !== JSON.stringify(this.draft))
      this.undo.push(this.beforeStroke);
    this.beforeStroke = null;
    this.undo = this.undo.slice(-24);
    this.refresh();
  }

  refresh() {
    this.stage?.setOil(this.samples());
    const e = oilEffects(this.input);
    this.app.labScreen.stage.drawReadout({
      title: this.outfit ? "发射器 · 改装" : "保养 · 接触油膜",
      metrics: [
        { label: "传动效率", value: e.efficiency * 100, unit: "%", decimals: 0 },
        { label: "轴尖抓地", value: e.traction * 100, unit: "%", decimals: 0 },
      ],
      status: "草稿预览 · 保存后用于发射", note: "游戏平衡单位 / 自由涂抹与擦拭",
    });
    this.root.querySelector(".maintenance-readings").innerHTML = `
      <span>传动效率<b>${pct(e.efficiency)}</b></span>
      <span>握柄 / 拉柄油膜<b>${pct(e.support)} / ${pct(e.pull)}</b></span>
      <span>轴尖抓地<b>${pct(e.traction)}</b></span>`;
    this.root.querySelector('[data-maintenance="undo"]').disabled = !this.undo.length;
    const changes = [];
    if (launcherKey(this.launcherDraft) !== launcherKey(this.launcherInitial)) changes.push("装备未保存");
    if (JSON.stringify(this.initial) !== JSON.stringify(this.draft)) changes.push("保养未保存");
    if (launcherKey(this.preview) !== launcherKey(this.launcherDraft)) changes.push("仅预览 · 未装入");
    this.root.querySelector(".maintenance-draft").textContent = changes.length
      ? `${changes.join("；")} · 离开组装将放弃` : "与已保存一致";
    this.root.querySelector('[data-maintenance="continue"]').textContent = this.app.preparationLabel;
    if (this.trialDraft && this.trialDraft !== JSON.stringify([this.draft, this.preview]))
      this.root.querySelector(".maintenance-trial").hidden = true;
    if (this.outfit) this.refreshOutfit();
  }

  feedback(text) { this.root.querySelector(".maintenance-feedback").textContent = text; }

  action(action) {
    if (action === "continue") return this.app.continuePreparation();
    if (action === "retry") return this.selectTarget(this.outfit ? "outfit" : this.kind);
    if (action === "red") {
      this.launcherDraft.colors = { shell: "#34393d", accent: "#b83722", grip: "#202733" };
      this.preview.colors = { ...this.launcherDraft.colors };
      if (this.stage.model) paintLauncher(this.stage.model, this.preview.colors);
      this.refresh(); return;
    }
    if (action === "equip") {
      const id = this.preview.build[this.slot];
      const restoreFocus = document.activeElement === this.root.querySelector('[data-maintenance="equip"]');
      if (!this.app.state.ownedPartIds.includes(id)) {
        const purchase = purchasePart(this.app.state, id);
        if (!purchase.ok) { this.feedback("金币不足，尚未购买。"); return; }
        const old = this.app.state;
        this.app.state = purchase.progression;
        try { this.app._save(); } catch {
          this.app.state = old; this.feedback("购买未保存，请检查存储空间后重试。"); return;
        }
      }
      this.launcherDraft.build[this.slot] = id;
      this.feedback("已装入草稿，保存后用于下一场对战。");
      this.refresh();
      if (restoreFocus) this.root.querySelector(`[data-launcher-part="${id}"]`).focus({ preventScroll: true });
      return;
    }
    if (action === "cancel") {
      this.leave(true);
      this.app.setWorkshopMode("top");
      return;
    }
    if (action === "undo") {
      this.stage.cancelGesture(false);
      if (this.undo.length) this.draft = this.undo.pop();
      this.feedback("已撤销上一笔。"); this.refresh();
    }
    if (action === "clean") {
      this.stage.cancelGesture(false);
      this.undo.push(structuredClone(this.draft));
      this.undo = this.undo.slice(-24);
      if (this.kind === "launcher") this.draft.launcher = [];
      else for (const id of Object.values(this.loadout.build)) delete this.draft.tops[oilKey(this.loadout, id)];
      this.feedback("已擦净当前模型，可以重新试试。"); this.refresh();
    }
    if (action === "trial") {
      this.stage.cancelGesture(false);
      const angle = this.outfit ? .35 : 0;
      const before = runMaintenanceTrial(this.app.playerBuild, maintenanceForLoadout(this.initial, this.loadout, this.launcherInitial), .86, this.launcherInitial, angle);
      const after = runMaintenanceTrial(this.app.playerBuild, this.input, .86, this.preview, angle);
      this.trialDraft = JSON.stringify([this.draft, this.preview]);
      const result = this.root.querySelector(".maintenance-trial");
      result.hidden = false;
      result.innerHTML = `<table><caption>${this.outfit ? "当前预览" : "当前草稿"} / 进入时 · 相同输入</caption>
        <thead><tr><th scope="col">测量</th><th scope="col">当前</th><th scope="col">变化</th></tr></thead>
        <tbody>${[
          ["初始转速", after.initialSpin, before.initialSpin, ""],
          ["发射偏向", after.deviation, before.deviation, "°"],
          ["3 秒滑行", after.distance, before.distance, ""],
          ["抽拉负担", after.launcher.effort * 100, before.launcher.effort * 100, "%"],
          ["输入做功", after.launcher.inputWork, before.launcher.inputWork, ""],
          ["机构残留能", after.launcher.residualEnergy, before.launcher.residualEnergy, ""],
          ["释放耗时", after.launcher.releaseMs, before.launcher.releaseMs, "ms"],
          ["释放轴线倾角", after.launcher.tilt * 180 / Math.PI, before.launcher.tilt * 180 / Math.PI, "°"],
        ].map(([label, a, b, unit]) => `<tr><th scope="row">${label}</th><td>${a.toFixed(2)}${unit}</td><td>${signed(a - b)}${unit}</td></tr>`).join("")}</tbody></table>`;
      this.stage.play(after.efficiency);
      this.feedback(this.kind === "launcher" ? "试拉完成。齿轮慢速演示中，可继续涂抹。" : "试验完成。对照滑行距离，感受抓地变化。");
    }
    if (action === "save") {
      this.stage.cancelGesture(false);
      const old = this.app.state.maintenance;
      const oldLauncher = this.app.state.launcher;
      const oldTutorial = this.app.state.tutorial;
      this.app.state.maintenance = normalizeMaintenance(this.draft);
      this.app.state.launcher = normalizeLauncher(this.launcherDraft, this.app.state.ownedPartIds);
      this.app.state.tutorial = tutorialAfterEquip(oldTutorial, this.app.state.ownedPartIds,
        this.app.state.build, this.app.state.launcher);
      try { this.app._save(); }
      catch {
        this.app.state.maintenance = old;
        this.app.state.launcher = oldLauncher;
        this.app.state.tutorial = oldTutorial;
        this.feedback("保存失败，草稿仍在。请检查浏览器存储空间后重试。");
        return;
      }
      this.initial = structuredClone(this.draft);
      this.launcherInitial = structuredClone(this.launcherDraft);
      this.feedback("已保存，下次发射生效。");
      this.app._renderPersistentState();
      this.app._renderTutorial();
      this.refresh();
    }
  }

  update(dt) { this.stage?.update(dt); }
  leave(discard = false) {
    this.layoutObserver?.disconnect();
    this.stage?.dispose(); this.stage = null; this.beforeStroke = null;
    this.root.hidden = true;
    this.sceneTools.hidden = true;
    if (discard) this.draft = null;
  }
}
