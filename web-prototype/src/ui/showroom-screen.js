import { ShowroomStage } from "../render/showroom-stage.js";
import { calculateBuild, getBuildRatings } from "../core/assembly-calculator.js";
import { DISPLAY_STAGES, equipDisplayStage } from "../core/showroom-state.js";
import { labLevel } from "../core/lab-state.js";
import { getPart } from "../data/parts.js";
import { labIcon } from "./lab-screen.js";
import "./showroom.css";

const html = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export class ShowroomScreen {
  constructor(app) {
    this.app = app;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
    this.root = document.createElement("section");
    this.root.className = "lab-view collection-view";
    this.root.setAttribute("aria-label", "陀螺陈列室");
    app.root.querySelector(".game-shell").append(this.root);
    this.root.innerHTML = `
      <div class="collection-scene"></div>
      <header class="lab-header">
        <div class="lab-title"><h1>陀螺陈列室</h1><p>TOP COLLECTION</p></div>
        <div class="lab-wallets"><button data-collection="shop" aria-label="金币与零件商店">${labIcon("coin")}<b class="collection-coins">0</b><i>${labIcon("plus")}</i></button><button data-collection="gems" aria-label="钻石系统规划">${labIcon("gem")}<b>0</b><i>${labIcon("plus")}</i></button></div>
        <button class="lab-level" data-collection="level"><span>实验室等级</span><strong class="collection-level">LV.1</strong><small class="collection-xp"></small><progress class="collection-progress"></progress></button>
      </header>
      <aside class="lab-utilities" aria-label="陈列室工具">
        <button data-collection="stages" aria-label="选择展示舞台"><span>${labIcon("lab")}</span><small>展示舞台</small></button>
        <button data-collection="records" aria-label="测试记录"><span>${labIcon("folder")}</span><small>测试记录</small></button>
        <button data-collection="help" aria-label="陈列室帮助"><span>${labIcon("help")}</span><small>帮助</small></button>
      </aside>
      <div class="collection-stage-label"><span class="collection-tier">STAGE I</span><b class="collection-stage-name">全息陈列舱</b><span class="collection-preview" hidden>预览中</span></div>
      <div class="collection-top-label"><b></b><span>五层组装 · 当前配置</span></div>
      <div class="collection-inspection">
        <button data-collection="inspect">近距离查看</button>
        <button data-collection="inspect-back" hidden>返回舞台</button>
        <p class="collection-inspect-hint" aria-live="polite">点击陀螺查看 · 左右滑动切换</p>
        <div class="collection-parts" hidden>
          ${[["coreLock","核心锁"],["attackRing","攻击环"],["weightDisc","配重盘"],["driverShaft","中轴"],["tip","陀尖"]].map(([id,name])=>`<button data-inspect-part="${id}">${name}</button>`).join("")}
        </div>
      </div>
      <div class="collection-loading" role="status">正在准备升降舞台…</div>
      <div class="collection-bottom">
        <div class="lab-loadouts">
          <button class="lab-arrow previous" data-collection="previous" aria-label="上一个陀螺">${labIcon("chevron")}</button>
          <div class="lab-loadout-list"></div>
          <button class="lab-arrow" data-collection="next" aria-label="下一个陀螺">${labIcon("chevron")}</button>
        </div>
        <article class="collection-details">
          <div class="collection-description"><h2></h2><p></p></div>
          <div class="collection-stats" aria-label="当前配置相对性能"></div>
          <div class="collection-metrics"></div>
          <button class="collection-use" disabled>使用中</button>
        </article>
        <nav class="lab-nav" aria-label="游戏导航">
          ${[["collection", "top", "陀螺库", "COLLECTION"], ["assembly", "tools", "改装台", "CUSTOMIZE"], ["lab", "lab", "测试室", "LAB"], ["battle", "battle", "对战", "BATTLE"], ["shop", "shop", "商店", "SHOP"]].map(([action, icon, title, en]) =>
            `<button data-collection="${action}" ${action === "collection" ? 'aria-current="page"' : ""}>${labIcon(icon)}<span>${title}</span><small>${en}</small></button>`).join("")}
        </nav>
      </div>
      <div class="collection-notice" role="status" hidden></div>
      <dialog class="lab-dialog collection-stage-dialog"><header><h2>展示舞台</h2><button data-collection="close" aria-label="关闭面板">${labIcon("close")}</button></header><div class="lab-dialog-content"></div></dialog>
    `;
    this.dialog = this.root.querySelector("dialog");
    this.dialog.addEventListener("click", (event) => { if (event.target === this.dialog) this.dialog.close(); });
    this.root.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button || button.disabled) return;
      if (button.dataset.collection) this.action(button.dataset.collection);
      if (button.dataset.showLoadout !== undefined) this.select(Number(button.dataset.showLoadout));
      if (button.dataset.previewStage) this.preview(button.dataset.previewStage);
      if (button.dataset.equipStage) this.equip(button.dataset.equipStage);
      if (button.dataset.inspectPart) this.focusPart(button.dataset.inspectPart);
    });
    this.stage = new ShowroomStage(this.root.querySelector(".collection-scene"), app.labScreen.stage);
    this.stage.container.addEventListener("topswipe",e=>this.select(this.app.state.activeLoadoutIndex+e.detail.direction));
    this.stage.container.addEventListener("inspectionchange",e=>{
      this.root.dataset.inspect=String(e.detail.active);
      this.root.querySelector('[data-collection="inspect"]').hidden=e.detail.active;
      this.root.querySelector('[data-collection="inspect-back"]').hidden=!e.detail.active;
      this.root.querySelector(".collection-parts").hidden=!e.detail.active;
      this.root.querySelector(".collection-inspect-hint").textContent=e.detail.active
        ? "拖动环视 · 滚轮 / 双指缩放 · 点击零件" : "点击陀螺查看 · 左右滑动切换";
    });
    this.stage.container.addEventListener("inspectpart",e=>this.updatePartHint(e.detail.slot));
    this.root.addEventListener("keydown",e=>{
      if (e.key==="Escape" && !this.dialog.open) this.stage.setInspection(false);
    });
    this.stage.ready.then(() => {
      this.ready = true;
      this.root.querySelector(".collection-loading").hidden = true;
      this.updateBusy();
    }).catch(() => {
      this.root.querySelector(".collection-loading").textContent = "舞台载入失败，请刷新重试。";
    });
  }

  get loadout() { return this.app.state.loadouts[this.app.state.activeLoadoutIndex]; }
  get showroom() { return this.app.state.showroom; }

  focusPart(slot) {
    this.stage.activePart=slot;
    this.stage.focusPart(slot);
    this.updatePartHint(slot);
  }

  updatePartHint(slot) {
    this.root.querySelectorAll("[data-inspect-part]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.inspectPart===slot)));
    this.root.querySelector(".collection-inspect-hint").textContent=slot && this.loadout.build[slot]
      ? getPart(this.loadout.build[slot]).name : "拖动环视 · 滚轮 / 双指缩放 · 点击零件";
  }

  enter() {
    this.stage.attach();
    this.stage.setStage(this.showroom.equipped);
    this.previewing = null;
    this.stage.setSpecimen(this.loadout);
    this.refresh();
  }

  leave() {
    this.stage.detach();
    this.dialog.close();
    this.previewing = null;
  }

  refresh() {
    const { state } = this.app;
    this.root.querySelector(".collection-coins").textContent = state.coins.toLocaleString();
    const level = labLevel(state.lab.xp);
    this.root.querySelector(".collection-level").textContent = `LV.${level.level}`;
    this.root.querySelector(".collection-xp").textContent = `${level.current} / ${level.required}`;
    const progress = this.root.querySelector(".collection-progress");
    progress.max = level.required;
    progress.value = level.current;
    const list = this.root.querySelector(".lab-loadout-list");
    list.innerHTML = state.loadouts.map((loadout, index) => `<button data-show-loadout="${index}" aria-label="选择${html(loadout.name)}" aria-pressed="${index === state.activeLoadoutIndex}"><span class="lab-slot-number">0${index+1}</span><em>${index === state.activeLoadoutIndex ? "使用中" : ""}</em><canvas aria-hidden="true"></canvas><b>${html(loadout.name)}</b></button>`).join("");
    this.app.labScreen.stage.renderThumbnails(state.loadouts, [...list.querySelectorAll("canvas")]);
    this.stage.resize();
    this.updateDescription();
    this.updateStageLabel();
    this.updateBusy();
  }

  updateDescription() {
    const build = calculateBuild(this.loadout.build, this.loadout.customizations);
    const ring = getPart(this.loadout.build.attackRing);
    const title = `${String(this.app.state.activeLoadoutIndex+1).padStart(2, "0")} ${this.loadout.name}`;
    this.root.querySelector(".collection-description h2").textContent = title;
    this.root.querySelector(".collection-top-label b").textContent = title;
    this.root.querySelector(".collection-description p").textContent = `${ring.name}。${ring.description}`;
    this.root.querySelector(".collection-description p").title = `${ring.name}。${ring.description}`;
    const ratings = getBuildRatings(build);
    const stats = ["攻击", "耐久", "续航", "稳定", "控制"].map((name) => [name, ratings[name]]);
    this.root.querySelector(".collection-stats").innerHTML = stats.map(([label, score]) => {
      const value = Math.round(Math.min(100, Math.max(0, score)));
      return `<div><span>${label}</span><meter min="0" max="100" value="${value}" aria-label="${label}评分">${value}</meter><b>${value}</b></div>`;
    }).join("");
    this.root.querySelector(".collection-metrics").innerHTML = `<span>${labIcon("weight")}质量 <b>${build.totalMass.toFixed(2)}</b></span><span>${labIcon("target")}质心 Y <b>${build.centerOfMass[1].toFixed(4)}</b></span><span>游戏平衡单位</span>`;
  }

  updateBusy() {
    const busy = Boolean(this.stage.transition);
    this.root.dataset.lift = busy ? (this.stage.transition.swapped ? "rising" : "lowering") : "idle";
    this.root.querySelectorAll("[data-show-loadout], .lab-arrow, [data-collection='stages']").forEach((button) => { button.disabled = busy || !this.ready; });
    this.root.querySelector(".collection-use").textContent = busy ? (this.stage.transition.swapped ? "正在升起…" : "正在收起…") : "使用中";
  }

  select(index) {
    if (this.stage.transition || !this.ready) return;
    const { state } = this.app;
    index = (index + state.loadouts.length) % state.loadouts.length;
    if (index === state.activeLoadoutIndex) return;
    const loadout = state.loadouts[index];
    this.stage.switchSpecimen(loadout, {
      reducedMotion: this.reduced.matches,
      onHidden: () => {
        const oldIndex = state.activeLoadoutIndex;
        const old = state.loadouts[oldIndex];
        Object.assign(state, { activeLoadoutIndex: index, build: loadout.build, colors: loadout.colors, customizations: loadout.customizations });
        try { this.app._save(); }
        catch {
          Object.assign(state, { activeLoadoutIndex: oldIndex, build: old.build, colors: old.colors, customizations: old.customizations });
          this.notify("存储不可用，保留原来的陀螺。");
          return false;
        }
        this.app.playerBuild = calculateBuild(loadout.build, loadout.customizations);
        this.root.querySelectorAll("[data-show-loadout]").forEach((button) => {
          const active = Number(button.dataset.showLoadout) === index;
          button.setAttribute("aria-pressed", String(active));
          button.querySelector("em").textContent = active ? "使用中" : "";
        });
        this.updateDescription();
        return true;
      },
      onComplete: () => this.updateBusy(),
    });
    this.updateBusy();
  }

  update(delta) {
    this.stage.update(delta, this.reduced.matches);
    if (this.stage.transition) this.updateBusy();
  }

  updateStageLabel() {
    const id = this.previewing ?? this.showroom.equipped;
    const stage = DISPLAY_STAGES.find((item) => item.id === id);
    this.root.dataset.stage = id;
    this.root.querySelector(".collection-tier").textContent = `STAGE ${stage.tier}`;
    this.root.querySelector(".collection-stage-name").textContent = stage.name;
    this.root.querySelector(".collection-preview").hidden = !this.previewing;
  }

  showStages() {
    const level = labLevel(this.app.state.lab.xp).level;
    this.dialog.querySelector(".lab-dialog-content").innerHTML = `
      <p>基础舞台已开放，实验室 LV.2 可免费解锁冠军舞台。舞台外观不改变战斗属性。</p>
      ${DISPLAY_STAGES.map((stage) => {
        const owned = this.showroom.owned.includes(stage.id);
        const equipped = this.showroom.equipped === stage.id;
        return `<article class="stage-option" data-tier="${stage.id}"><span class="stage-option-tier">${stage.tier}</span><h3>${stage.name}</h3><p>${stage.description}</p><small>${owned ? "已解锁" : `实验室 LV.${stage.level} 解锁 · 当前 LV.${level}`}</small><div><button data-preview-stage="${stage.id}">预览</button><button data-equip-stage="${stage.id}" ${equipped || (!owned && level < stage.level) ? "disabled" : ""}>${equipped ? "使用中" : owned ? "使用此舞台" : level >= stage.level ? "解锁并使用" : `需要 LV.${stage.level}`}</button></div></article>`;
      }).join("")}
      ${this.previewing ? '<button class="lab-sheet-secondary" data-collection="end-preview">结束预览</button>' : ""}
    `;
    if (!this.dialog.open) this.dialog.showModal();
  }

  preview(id) {
    if (!DISPLAY_STAGES.some((stage) => stage.id === id)) return;
    this.previewing = id !== this.showroom.equipped ? id : null;
    this.stage.setStage(id);
    this.updateStageLabel();
    this.dialog.close();
    if (this.previewing) this.notify("舞台预览中 · 可在展示舞台中解锁，离开页面恢复已装备舞台");
  }

  equip(id) {
    const result = equipDisplayStage(this.showroom, id, this.app.state.lab.xp);
    if (!result.ok) return this.notify("先提升实验室等级，再解锁这座舞台。");
    const previous = this.showroom;
    this.app.state.showroom = result.showroom;
    try { this.app._save(); }
    catch { this.app.state.showroom = previous; return this.notify("舞台未保存，请检查本机存储。"); }
    this.previewing = null;
    this.stage.setStage(id);
    this.updateStageLabel();
    this.dialog.close();
    this.notify("展示舞台已装备");
  }

  notify(message) {
    const node = this.root.querySelector(".collection-notice");
    node.textContent = message;
    node.hidden = false;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => { node.hidden = true; }, 3500);
  }

  action(action) {
    if (action === "close") return this.dialog.close();
    if (action === "inspect") return this.stage.setInspection(true);
    if (action === "inspect-back") return this.stage.setInspection(false);
    if (action === "collection") return;
    if (action === "help") return this.notify("点击陀螺卡片启动升降切换；展示舞台中可预览并解锁新场景。属性为当前配置的相对评分。");
    if (this.stage.transition) return this.notify("升降台运行中，请稍候。");
    if (action === "stages") return this.showStages();
    if (action === "end-preview") return this.preview(this.showroom.equipped);
    if (action === "next" || action === "previous") return this.select(this.app.state.activeLoadoutIndex + (action === "next" ? 1 : -1));
    if (["shop", "gems", "records", "level"].includes(action)) {
      this.app.goTo("lab");
      return this.app.labScreen.action(action);
    }
    this.app.goTo(action === "battle" ? "map" : action);
  }
}
