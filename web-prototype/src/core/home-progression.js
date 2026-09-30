import { normalizeLabState } from "./lab-state.js";
import { normalizeShowroom, equipDisplayStage } from "./showroom-state.js";
import { normalizeCampaign } from "./campaign-state.js";
import { TUTORIAL_STAGE } from "./progression.js";

export const WORKSHOP_MILESTONE = "choose-a-line";

// A story milestone raises the existing XP floor, never grants repeatable XP.
// Explicit room/stage choices have their own followStory switches.
export function syncHomeProgression(state) {
  const campaign = normalizeCampaign(state.campaign);
  const lab = normalizeLabState(state.lab);
  let showroom = normalizeShowroom(state.showroom);
  const workshopComplete = campaign.completed.includes(WORKSHOP_MILESTONE);
  if (workshopComplete) lab.xp = Math.max(120, lab.xp);
  if (lab.settings.followStory) lab.settings.room = workshopComplete ? "advanced"
    : campaign.completed.includes("rival-arrives") ? "childhood" : "minimal";
  if (workshopComplete) {
    const unlocked = equipDisplayStage(showroom, "arena", lab.xp);
    if (unlocked.ok) showroom = {
      ...unlocked.showroom,
      equipped: showroom.followStory ? "arena" : showroom.equipped,
      followStory: showroom.followStory,
    };
  }
  return { lab, showroom };
}

export function homeScreen(state) {
  if (state.tutorial?.completed || normalizeCampaign(state.campaign).completed.length) return "collection";
  return state.tutorial?.stage === TUTORIAL_STAGE.FIRST_BATTLE ? "battle" : "assembly";
}

export function homeProgressLabel(state) {
  if (state.campaign.completed.includes(WORKSHOP_MILESTONE))
    return "第二章已完成 · 精密实验室与冠军舞台已开放";
  return "完成第二章「修好它，不换掉它」，开放精密实验室与冠军舞台";
}
