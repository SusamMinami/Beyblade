import { DEFAULT_BUILD, getPart, PART_TYPE_META } from "../data/parts.js";
import { normalizePartCustomization } from "./part-customization.js";
import { calculateBuild, getBuildRatings } from "./assembly-calculator.js";
import { LOADOUT_COUNT } from "./loadouts.js";

// Only bounded, completed battle snapshots; no economic or ownership authority.
export function normalizeBattleNotes(value) {
  const notes = {};
  for (let i = 1; i <= LOADOUT_COUNT; i++) {
    const id = `loadout-${i}`;
    const source = value?.[id];
    if (!source || !Object.keys(DEFAULT_BUILD).every(slot => getPart(source.build?.[slot])?.type === slot)) continue;
    if (!Number.isFinite(source.time) || source.time < 0 || !["player", "enemy", "draw"].includes(source.winner)) continue;
    const build = Object.fromEntries(Object.keys(DEFAULT_BUILD).map(slot => [slot, source.build[slot]]));
    notes[id] = {
      build,
      customizations: Object.fromEntries(Object.values(build).map(partId =>
        [partId, normalizePartCustomization(source.customizations?.[partId] ?? {})])),
      time: Math.min(source.time, 3600),
      winner: source.winner,
    };
  }
  return notes;
}

export function compareBuilds(previous, current) {
  if (!previous) return null;
  const before = getBuildRatings(calculateBuild(previous.build, previous.customizations));
  const after = getBuildRatings(calculateBuild(current.build, current.customizations));
  const changes = [];
  for (const slot of Object.keys(DEFAULT_BUILD)) {
    const oldId = previous.build[slot], newId = current.build[slot];
    if (oldId !== newId) changes.push(`${PART_TYPE_META[slot].name}：${getPart(oldId).name} → ${getPart(newId).name}`);
    else if (JSON.stringify(normalizePartCustomization(previous.customizations?.[oldId])) !==
      JSON.stringify(normalizePartCustomization(current.customizations?.[newId]))) {
      changes.push(`${PART_TYPE_META[slot].name}：DIY 参数已调整`);
    }
  }
  const ratings = Object.entries(after).map(([name, score]) => ({
    name, before: Math.round(before[name]), after: Math.round(score),
    delta: Math.round(score) - Math.round(before[name]),
  }));
  return { changes, ratings };
}

export function trainingCue({ phase, steered, spinHarvested, zone, second }) {
  if (phase === "ready") return {
    id: "launch", title: second ? "再试一次，感受改装" : "先让它转起来",
    copy: "直接按「确认发射」即可。想调整时，再拖动模型或箭头；这一场胜负都能继续。",
  };
  if (!steered) return {
    id: "steer", title: "轻推一下，改变轨迹",
    copy: "拖动下方摇杆，或短按 WASD / 方向键。靠近边缘时向内侧回拉。",
  };
  if (spinHarvested <= 0) return {
    id: `zone-${zone?.active?.id ?? "cooling"}-${Boolean(zone?.cooling)}`,
    title: "已完成轻推 · 试着抢区",
    copy: zone?.cooling ? "加速区正在冷却。观察下一块亮区，在场内侧准备转移。" :
      `当前 ${zone?.active?.id ?? "亮"} 区供能。轻推靠近，接近后反向微调；撞开对手可独享补转。`,
  };
  return {
    id: "supplied", title: "已经补到转速了",
    copy: "加速区会轮换，继续观察下一块亮区。补转不能修复破损，失衡时先减小操控。",
  };
}
