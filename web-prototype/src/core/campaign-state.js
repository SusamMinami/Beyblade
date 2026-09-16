import { CAMPAIGN_MISSIONS, getMission } from "../data/campaign.js";
import { getPart } from "../data/parts.js";

const list = (value) => Array.isArray(value) ? value : [];
const boundedCount = (value) => Math.min(999999, Math.max(0, Math.floor(Number(value) || 0)));
const validBuild = (value) => Object.fromEntries(
  Object.entries(value ?? {}).filter(([slot, id]) => getPart(id)?.type === slot),
);

export function normalizeCampaign(saved) {
  const source = saved && typeof saved === "object" ? saved : {};
  // A broken/future save cannot skip a prerequisite.
  const completed = [];
  for (const mission of CAMPAIGN_MISSIONS) {
    if (!list(source.completed).includes(mission.id)) break;
    completed.push(mission.id);
  }
  return {
    version: 1,
    completed,
    mastered: list(source.mastered).filter((id, index, all) =>
      completed.includes(id) && all.indexOf(id) === index),
    attempts: Object.fromEntries(CAMPAIGN_MISSIONS.map(({ id }) =>
      [id, boundedCount(source.attempts?.[id])])),
    journal: list(source.journal).filter((entry) =>
      entry && getMission(entry.missionId) && typeof entry.battleId === "string" &&
      ["player", "enemy", "draw"].includes(entry.winner) &&
      ["spin_out", "ring_out", "break", "time"].includes(entry.reason) &&
      Number.isFinite(entry.time) && entry.time >= 0,
    ).slice(-40).map((entry) => ({
      battleId: entry.battleId.slice(0, 100),
      missionId: entry.missionId,
      winner: entry.winner,
      reason: entry.reason,
      time: Math.min(entry.time, 3600),
      loadoutName: String(entry.loadoutName ?? "陀螺").slice(0, 40),
      build: validBuild(entry.build),
    })),
  };
}

export function canPlayMission(campaign, id) {
  const index = CAMPAIGN_MISSIONS.findIndex((mission) => mission.id === id);
  return index >= 0 && index <= campaign.completed.length;
}

export function nextMission(campaign) {
  return CAMPAIGN_MISSIONS[campaign.completed.length] ?? null;
}

export function settleMission(campaign, { missionId, battleId, result, durabilityRatio, loadout }) {
  const mission = getMission(missionId);
  if (!mission || !canPlayMission(campaign, missionId) || !battleId ||
      campaign.journal.some((entry) => entry.battleId === battleId) ||
      !result || !["player", "enemy", "draw"].includes(result.winner) ||
      !["spin_out", "ring_out", "break", "time"].includes(result.reason) ||
      !Number.isFinite(result.time) || result.time < 0) {
    return { ok: false, campaign };
  }
  const won = result.winner === "player";
  const cleared = won || mission.objective === "finish";
  const firstClear = cleared && !campaign.completed.includes(missionId);
  const challenge = mission.challenge;
  const mastered = won && (challenge.type === "win" ||
    (challenge.type === "durability" && durabilityRatio >= challenge.value) ||
    challenge.type === result.reason);
  const next = {
    ...campaign,
    completed: firstClear ? [...campaign.completed, missionId] : [...campaign.completed],
    mastered: mastered && !campaign.mastered.includes(missionId)
      ? [...campaign.mastered, missionId] : [...campaign.mastered],
    attempts: { ...campaign.attempts, [missionId]: boundedCount(campaign.attempts[missionId] + 1) },
    journal: [...campaign.journal, {
      battleId, missionId, winner: result.winner, reason: result.reason,
      time: result.time, loadoutName: loadout?.name ?? "陀螺",
      build: { ...loadout?.build },
    }].slice(-40),
  };
  return { ok: true, campaign: next, cleared, firstClear, mastered,
    story: won ? mission.victory : mission.defeat };
}
