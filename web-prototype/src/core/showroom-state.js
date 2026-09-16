import { labLevel } from "./lab-state.js";

export const DISPLAY_STAGES = [
  { id: "holo", name: "全息陈列舱", tier: "I", level: 1, color: "#56e9df",
    description: "青色扫描光幕、悬浮环与环形升降台。", label: "HOLOGRAPHIC VAULT" },
  { id: "arena", name: "冠军竞技舞台", tier: "II", level: 2, color: "#f4cc80",
    description: "金色徽记、机械桁架与聚光灯阵，为每次登场点亮舞台。", label: "CHAMPIONS ARENA" },
];

export function normalizeShowroom(saved = {}) {
  const storedOwned = Array.isArray(saved?.owned) ? saved.owned : [];
  const owned = DISPLAY_STAGES.filter((stage) => stage.id === "holo" || storedOwned.includes(stage.id)).map((stage) => stage.id);
  return { owned, equipped: owned.includes(saved?.equipped) ? saved.equipped : "holo" };
}

export function equipDisplayStage(showroom, id, xp) {
  const stage = DISPLAY_STAGES.find((item) => item.id === id);
  if (!stage) return { ok: false, reason: "invalid-stage" };
  const current = normalizeShowroom(showroom);
  if (!current.owned.includes(id) && labLevel(xp).level < stage.level) return { ok: false, reason: "locked" };
  return { ok: true, showroom: { equipped: id, owned: [...new Set([...current.owned, id])] } };
}
