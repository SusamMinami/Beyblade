import { PART_TYPE_META } from "../data/parts.js";

const SLOTS = ["coreLock", "attackRing", "weightDisc", "driverShaft", "tip"];
const percent = value => Math.round(Math.max(0, Math.min(1, value)) * 100);

// Presentation bands, not new solver thresholds. Only > .55 has a physical
// meaning in the existing solver: equivalent shed mass begins there.
export function damageBand(damage) {
  return damage >= .85 ? "critical" : damage > .55 ? "heavy"
    : damage >= .25 ? "worn" : damage > 0 ? "light" : "sound";
}
const BAND_LABEL = { sound: "完好", light: "轻损", worn: "受损", heavy: "重损", critical: "临界" };

export function partDamageReading(part) {
  const worst = Math.max(...part.sectors);
  return {
    health: percent(part.health), worst: percent(worst), band: damageBand(worst),
    sector: part.sectors.indexOf(worst) + 1,
    shed: part.lostMass > 0,
    sectors: part.sectors.map(damage => ({ damage: percent(damage), band: damageBand(damage) })),
  };
}

// Each wedge is centered on the solver's sector sample. This is a body-local
// diagnostic, deliberately not rotated with the spinning top or world camera.
export function sectorPath(index, count = 8) {
  const point = (radius, angle) => `${(20 + Math.cos(angle) * radius).toFixed(3)},${(20 + Math.sin(angle) * radius).toFixed(3)}`;
  const middle = index / count * Math.PI * 2 - Math.PI / 2;
  const half = Math.PI / count - .045;
  return `M${point(17, middle - half)} A17,17 0 0 1 ${point(17, middle + half)} L${point(10, middle + half)} A10,10 0 0 0 ${point(10, middle - half)} Z`;
}
const diagram = slot => `<svg class="damage-part-diagram damage-part-${slot}" viewBox="0 0 40 40" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => `<path d="${sectorPath(i)}" data-sector="${i}" data-band="sound"/>`).join("")}<path class="damage-part-axis" d="M20 6v-4M18 4l2-2 2 2"/></svg>`;

export class BattleDamagePanel {
  constructor(root) {
    this.root = root;
    this.actor = "player";
    this.selected = "attackRing";
    root.innerHTML = `<details class="damage-panel-disclosure" open>
      <summary><span>部件状态</span><span class="damage-panel-overview">尚未受损</span></summary>
      <div class="damage-panel-body">
        <div class="damage-panel-actors" role="group" aria-label="查看哪一方的部件"><button type="button" data-damage-actor="player" aria-pressed="true">我的陀螺</button><button type="button" data-damage-actor="enemy" aria-pressed="false">对手</button></div>
        <div class="damage-panel-columns"><span>分层结构 / 本体方向</span><span>平均完整</span></div>
        <div class="damage-panel-parts" role="group" aria-label="选择部件查看局部损伤">${SLOTS.map(slot => `<button type="button" class="damage-part" data-damage-slot="${slot}" aria-pressed="${slot === this.selected}">${diagram(slot)}<span class="damage-part-caption"><b>${PART_TYPE_META[slot].name}</b><small>完好</small></span><strong class="damage-part-health">100%</strong></button>`).join("")}</div>
        <div class="damage-panel-detail"><b class="damage-panel-part-name"></b><span class="damage-panel-local"></span><p class="damage-panel-consequence"></p></div>
        <p class="damage-panel-key"><i></i>完好 <i></i>受损 <i></i>重损 <i></i>临界</p>
        <p class="damage-panel-note">八格为本体方向：顶端 1 号，顺时针；非赛场方位。本局结束后重置。</p>
      </div>
    </details>`;
    this.rows = new Map([...root.querySelectorAll("[data-damage-slot]")].map(row => [row.dataset.damageSlot, row]));
    this.overview = root.querySelector(".damage-panel-overview");
    this.local = root.querySelector(".damage-panel-local");
    this.partName = root.querySelector(".damage-panel-part-name");
    this.consequence = root.querySelector(".damage-panel-consequence");
    root.addEventListener("click", event => {
      const actor = event.target.closest("[data-damage-actor]");
      const slot = event.target.closest("[data-damage-slot]");
      if (actor) this.actor = actor.dataset.damageActor;
      if (slot) this.selected = slot.dataset.damageSlot;
      if (actor || slot) this.render(true);
    });
    // Block new steering while a panel control has focus, but always let keyup
    // reach the app: a steering key may have been pressed before focus moved here.
    root.addEventListener("keydown", event => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "w", "a", "s", "d", "W", "A", "S", "D"].includes(event.key)) event.stopPropagation();
    });
  }

  update(simulation, visible = true) {
    this.root.hidden = !visible || simulation?.phase !== "running";
    if (!simulation) { this.simulation = null; return; }
    if (simulation !== this.simulation) {
      this.actor = "player";
      this.selected = "attackRing";
      this.structure = null;
      this.revision = -1;
    }
    this.simulation = simulation;
    if (!this.root.hidden) this.render();
  }

  render(force = false) {
    const top = this.simulation?.[this.actor];
    if (!top?.structure) return;
    const structure = top.structure;
    if (!force && this.structure === structure && this.revision === structure.revision) return;
    this.structure = structure;
    this.revision = structure.revision;
    this.root.dataset.actor = this.actor;
    this.root.querySelectorAll("[data-damage-actor]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.damageActor === this.actor)));
    const worstPart = structure.parts.reduce((a, b) => a.worst >= b.worst ? a : b);
    this.overview.textContent = worstPart.worst > 0
      ? `${PART_TYPE_META[worstPart.slot].name} · ${BAND_LABEL[damageBand(worstPart.worst)]}` : "尚未受损";
    this.overview.dataset.band = damageBand(worstPart.worst);
    for (const part of structure.parts) {
      const row = this.rows.get(part.slot);
      if (!row) continue;
      const reading = partDamageReading(part);
      row.setAttribute("aria-pressed", String(part.slot === this.selected));
      row.dataset.band = reading.band;
      row.querySelector("small").textContent = reading.shed ? "等效掉块" : BAND_LABEL[reading.band];
      row.querySelector(".damage-part-health").textContent = `${reading.health}%`;
      row.setAttribute("aria-label", `${PART_TYPE_META[part.slot].name}，平均完整 ${reading.health}%，最重局部损伤 ${reading.worst}%${reading.shed ? "，已产生等效掉块" : ""}`);
      row.querySelectorAll("[data-sector]").forEach((path, index) => {
        path.dataset.band = reading.sectors[index].band;
        path.style.setProperty("--damage", String(part.sectors[index]));
      });
      if (part.slot !== this.selected) continue;
      this.partName.textContent = part.name;
      this.local.textContent = reading.worst > 0
        ? `${reading.sector} 号扇区最重 · 局部损伤 ${reading.worst}%` : "八个方向均完好 · 局部损伤 0%";
      this.consequence.textContent = `${reading.shed ? "已计入等效质量损失" : "未产生等效掉块"} · 结构失衡 ${percent(structure.imbalance)}%。${reading.shed ? "当前模型表现为压瘪，尚无独立飞散碎片。" : "供能只补转，不修复部件。"}`;
    }
  }
}
